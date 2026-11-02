/**
 * Buffer de mensagens inbound das Campanhas WhatsApp (webhook → debounce → Gemini).
 *
 * Fluxo:
 * 1. `registrarMensagemInbound` grava cada mensagem recebida (webhook da Meta/Ceci), já classificando
 *    bot vs. humana e calculando o fim da janela de buffer (`bufferAte` = agora + DEBOUNCE_BUFFER_SEGUNDOS).
 * 2. `consolidarBuffersVencidos` (chamada pelo cron/endpoint de processamento) busca contatos cujo buffer
 *    já venceu e ninguém mais escreveu depois, concatena as mensagens humanas da janela, chama o Gemini uma
 *    única vez por contato e grava o lead qualificado.
 *
 * Não usa Redis (deploy é Vercel serverless — ver AGENTS.md sobre MemoryStore não sobreviver entre
 * instâncias): o buffer é a própria tabela `campanhas_whatsapp_mensagens_inbound`, com `bufferAte` e
 * `processado`. Reprocessamento é seguro: `processado=true` é só marcado depois de qualificar com sucesso.
 */

import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb } from "../db/db";
import {
  campanhasWhatsappContatosHistorico,
  campanhasWhatsappDisparos,
  campanhasWhatsappLeadsQualificados,
  campanhasWhatsappMensagensInbound,
  type CampanhaWhatsappMensagemInbound,
} from "../../drizzle/schema";
import { normalizarTelefone } from "../../shared/campanhas-whatsapp";
import {
  DEBOUNCE_BUFFER_SEGUNDOS,
  MAX_CHARS_MENSAGEM_UNITARIA,
  MAX_MENSAGENS_POR_ANALISE,
  detectarBot,
  formatarFaixaHeatmap,
  type TipoMensagemInbound,
} from "../../shared/campanhas-whatsapp-ia";
import { analisarRespostaComGemini } from "./campanhasWhatsappIa";

async function obterDb() {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  return db;
}

export interface MensagemInboundEntrada {
  /** Telefone bruto como veio no webhook; normalizado internamente. */
  telefone: unknown;
  nome?: string | null;
  tipoMensagem: TipoMensagemInbound;
  texto?: string | null;
  /** Corpo cru do webhook (JSON stringificado), guardado para auditoria/debug. */
  payloadRaw?: string | null;
  /** ID da mensagem no provedor, se vier — usado para não gravar a mesma mensagem duas vezes num retry. */
  mensagemIdExterno?: string | null;
  /** Timestamp do disparo mais recente para este telefone, se conhecido pelo chamador (evita nova consulta). */
  enviadoEm?: Date | null;
  /** Momento real em que o cliente enviou a mensagem (campo `timestamp` do webhook da Meta). Sem ele, usa o
   * instante do processamento — menos preciso se o webhook chegou atrasado/em fila. */
  recebidoEm?: Date | null;
}

export interface ResultadoRegistroInbound {
  ok: boolean;
  /** `null` quando o telefone não parece válido — a mensagem não é gravada. */
  telefone: string | null;
  ehBot: boolean;
  motivoBot: string | null;
  /** `true` quando era uma mensagem repetida (mesmo `mensagemIdExterno`) e foi ignorada silenciosamente. */
  duplicada: boolean;
  id: number | null;
}

/**
 * Momento confiável do último envio para este telefone, só quando o disparo foi `origem = "api"` (WTS
 * automático via `dispararWts`, ou webhook externo `log-send`): nos dois casos o registro acontece
 * imediatamente após o envio real, então `campanhas_whatsapp_contatos_historico.updated_at` (timestamp
 * completo, gravado no INSERT/UPDATE da linha) é um proxy confiável do horário real de envio.
 *
 * Deliberadamente NÃO faz essa conta para `origem = "app"` (Registrar disparo manual): ali o vendedor envia
 * pelo WhatsApp Web/app por fora do sistema e só registra na tela depois — minutos, horas ou dias depois.
 * Usar `updatedAt` (hora do REGISTRO, não do envio real) naquele caso faria o "tempo de resposta" ficar
 * artificialmente pequeno (ou negativo, truncado a 0) e marcaria respostas humanas reais como
 * "resposta_rapida" — descartando lead de verdade por um viés de medição, não por ser bot de fato. Sem
 * `origem = "api"` confirmada, `detectarBot` roda só com a blacklist semântica (ver `registrarMensagemInbound`).
 */
async function buscarUltimoEnvioConfiavelParaTelefone(
  telefone: string
): Promise<Date | null> {
  const db = await obterDb();
  const [r] = await db
    .select({
      atualizadoEm: campanhasWhatsappContatosHistorico.updatedAt,
      origem: campanhasWhatsappDisparos.origem,
    })
    .from(campanhasWhatsappContatosHistorico)
    .innerJoin(
      campanhasWhatsappDisparos,
      eq(
        campanhasWhatsappDisparos.id,
        campanhasWhatsappContatosHistorico.disparoId
      )
    )
    .where(
      and(
        eq(campanhasWhatsappContatosHistorico.telefone, telefone),
        eq(campanhasWhatsappDisparos.origem, "api")
      )
    )
    .orderBy(desc(campanhasWhatsappContatosHistorico.updatedAt))
    .limit(1);
  if (!r?.atualizadoEm) return null;
  return r.atualizadoEm instanceof Date
    ? r.atualizadoEm
    : new Date(r.atualizadoEm);
}

/**
 * A qual campanha/disparo atribuir uma resposta: nenhum webhook do WhatsApp devolve "campanha_id" — só o
 * telefone de quem respondeu. Usa o envio mais recente (qualquer origem) deste telefone em
 * `campanhas_whatsapp_contatos_historico` como melhor palpite. Limitação aceita: se o telefone recebeu de
 * mais de uma campanha em sequência curta, a resposta é atribuída à campanha mais recente, mesmo que seja
 * réplica de uma campanha anterior — não há como desambiguar isso sem um identificador vindo do próprio
 * WhatsApp (que não existe).
 */
async function resolverCampanhaDoTelefone(
  telefone: string
): Promise<{ campanhaId: number | null; disparoId: number | null }> {
  const db = await obterDb();
  const [r] = await db
    .select({
      campanhaId: campanhasWhatsappContatosHistorico.campanhaId,
      disparoId: campanhasWhatsappContatosHistorico.disparoId,
    })
    .from(campanhasWhatsappContatosHistorico)
    .where(eq(campanhasWhatsappContatosHistorico.telefone, telefone))
    .orderBy(desc(campanhasWhatsappContatosHistorico.updatedAt))
    .limit(1);
  return { campanhaId: r?.campanhaId ?? null, disparoId: r?.disparoId ?? null };
}

/**
 * Registra uma mensagem inbound: normaliza telefone, resolve a campanha de origem pelo histórico de envio,
 * aplica o filtro de bot (Parte 1) e grava com a janela de buffer calculada. `button_reply`/`list_reply`
 * nunca são bot. Idempotente por `mensagemIdExterno`.
 */
export async function registrarMensagemInbound(
  entrada: MensagemInboundEntrada
): Promise<ResultadoRegistroInbound> {
  const telefone = normalizarTelefone(entrada.telefone);
  if (!telefone)
    return {
      ok: false,
      telefone: null,
      ehBot: false,
      motivoBot: null,
      duplicada: false,
      id: null,
    };

  const db = await obterDb();

  if (entrada.mensagemIdExterno) {
    const [existente] = await db
      .select({ id: campanhasWhatsappMensagensInbound.id })
      .from(campanhasWhatsappMensagensInbound)
      .where(
        eq(
          campanhasWhatsappMensagensInbound.mensagemIdExterno,
          entrada.mensagemIdExterno
        )
      )
      .limit(1);
    if (existente)
      return {
        ok: true,
        telefone,
        ehBot: false,
        motivoBot: null,
        duplicada: true,
        id: existente.id,
      };
  }

  const momentoRecebimento = entrada.recebidoEm ?? new Date();
  const [enviadoEm, resolucaoCampanha] = await Promise.all([
    entrada.enviadoEm ?? buscarUltimoEnvioConfiavelParaTelefone(telefone),
    resolverCampanhaDoTelefone(telefone),
  ]);
  const { campanhaId, disparoId } = resolucaoCampanha;
  const tempoRespostaSegundos = enviadoEm
    ? Math.max(
        0,
        Math.round((momentoRecebimento.getTime() - enviadoEm.getTime()) / 1000)
      )
    : null;

  const texto = entrada.texto?.slice(0, MAX_CHARS_MENSAGEM_UNITARIA) ?? null;
  const deteccao = detectarBot({
    tipoMensagem: entrada.tipoMensagem,
    texto,
    tempoRespostaSegundos,
  });

  const bufferAte = new Date(
    momentoRecebimento.getTime() + DEBOUNCE_BUFFER_SEGUNDOS * 1000
  );

  try {
    const [inserida] = await db
      .insert(campanhasWhatsappMensagensInbound)
      .values({
        campanhaId,
        disparoId,
        telefone,
        nome: entrada.nome?.trim()?.slice(0, 200) || null,
        tipoMensagem: entrada.tipoMensagem,
        texto,
        payloadRaw: entrada.payloadRaw?.slice(0, 8000) ?? null,
        mensagemIdExterno: entrada.mensagemIdExterno?.slice(0, 128) || null,
        ehBot: deteccao.ehBot,
        motivoBot: deteccao.motivo,
        tempoRespostaSegundos,
        recebidoEm: momentoRecebimento,
        bufferAte,
        processado: deteccao.ehBot, // bot não entra na consolidação: já nasce "processado" (não é qualificado por IA)
      })
      .returning({ id: campanhasWhatsappMensagensInbound.id });
    return {
      ok: true,
      telefone,
      ehBot: deteccao.ehBot,
      motivoBot: deteccao.motivo,
      duplicada: false,
      id: inserida.id,
    };
  } catch (erro) {
    // Corrida de retry do provedor contra a unique constraint de mensagemIdExterno: trata como duplicada.
    if (
      entrada.mensagemIdExterno &&
      /duplicate key|unique constraint/i.test(String((erro as Error)?.message))
    ) {
      return {
        ok: true,
        telefone,
        ehBot: deteccao.ehBot,
        motivoBot: deteccao.motivo,
        duplicada: true,
        id: null,
      };
    }
    throw erro;
  }
}

export interface ResultadoConsolidacao {
  telefone: string;
  campanhaId: number | null;
  disparoId: number | null;
  totalMensagens: number;
  cluster: string;
  icpFitScore: number;
}

/**
 * Busca contatos com buffer vencido (bufferAte <= agora) e mensagens humanas ainda não processadas, consolida
 * a janela inteira (pode ter mais de um buffer se o cliente mandou mensagens bem espaçadas) e qualifica cada
 * um com UMA chamada ao Gemini. Processa até `limite` contatos por chamada (orçamento de tempo do cron/handler).
 *
 * "Ainda não qualificado nesta campanha" (controle de custo, Parte 1.3): se já existe um lead qualificado para
 * (campanhaId, telefone), as mensagens são marcadas processadas sem nova chamada de IA — apenas anexadas ao
 * registro existente seria um refinamento futuro; por ora, a primeira qualificação da campanha é a que vale.
 */
export async function consolidarBuffersVencidos(
  limite = 25
): Promise<ResultadoConsolidacao[]> {
  const db = await obterDb();
  const agora = new Date();

  const pendentes = await db
    .select({
      id: campanhasWhatsappMensagensInbound.id,
      telefone: campanhasWhatsappMensagensInbound.telefone,
    })
    .from(campanhasWhatsappMensagensInbound)
    .where(
      and(
        eq(campanhasWhatsappMensagensInbound.processado, false),
        lt(campanhasWhatsappMensagensInbound.bufferAte, agora)
      )
    )
    .orderBy(asc(campanhasWhatsappMensagensInbound.recebidoEm));

  const telefonesUnicos = [...new Set(pendentes.map(p => p.telefone))].slice(
    0,
    limite
  );
  const resultados: ResultadoConsolidacao[] = [];

  for (const telefone of telefonesUnicos) {
    // Garante que NENHUMA mensagem deste telefone ainda esteja dentro da janela de buffer (cliente pode ter
    // mandado outra mensagem nos últimos segundos) — se houver, pula para a próxima rodada do cron.
    const [aindaNaJanela] = await db
      .select({ id: campanhasWhatsappMensagensInbound.id })
      .from(campanhasWhatsappMensagensInbound)
      .where(
        and(
          eq(campanhasWhatsappMensagensInbound.telefone, telefone),
          eq(campanhasWhatsappMensagensInbound.processado, false),
          gte(campanhasWhatsappMensagensInbound.bufferAte, agora)
        )
      )
      .limit(1);
    if (aindaNaJanela) continue;

    const mensagens = await db
      .select()
      .from(campanhasWhatsappMensagensInbound)
      .where(
        and(
          eq(campanhasWhatsappMensagensInbound.telefone, telefone),
          eq(campanhasWhatsappMensagensInbound.processado, false)
        )
      )
      .orderBy(asc(campanhasWhatsappMensagensInbound.recebidoEm));
    if (mensagens.length === 0) continue;

    const resultado = await consolidarContato(telefone, mensagens);
    if (resultado) resultados.push(resultado);
  }

  return resultados;
}

async function consolidarContato(
  telefone: string,
  mensagens: CampanhaWhatsappMensagemInbound[]
): Promise<ResultadoConsolidacao | null> {
  const db = await obterDb();
  const ids = mensagens.map(m => m.id);
  const campanhaId = mensagens.find(m => m.campanhaId)?.campanhaId ?? null;
  const disparoId = mensagens.find(m => m.disparoId)?.disparoId ?? null;
  const nome = mensagens.find(m => m.nome)?.nome ?? null;

  // Controle de custo (Parte 1.3): só qualifica quem ainda não tem lead nesta campanha.
  if (campanhaId) {
    const [jaQualificado] = await db
      .select({ id: campanhasWhatsappLeadsQualificados.id })
      .from(campanhasWhatsappLeadsQualificados)
      .where(
        and(
          eq(campanhasWhatsappLeadsQualificados.campanhaId, campanhaId),
          eq(campanhasWhatsappLeadsQualificados.telefone, telefone)
        )
      )
      .limit(1);
    if (jaQualificado) {
      await marcarProcessadas(ids);
      return null;
    }
  }

  const textosHumanos = mensagens
    .filter(m => !m.ehBot && m.texto)
    .map(m => m.texto as string)
    .slice(0, MAX_MENSAGENS_POR_ANALISE);

  // Clique em botão/lista sem nenhum texto: ainda vale registrar como engajamento real (Parte 1), mas sem
  // conteúdo para o Gemini analisar — pula a chamada de IA e marca processado.
  if (textosHumanos.length === 0) {
    await marcarProcessadas(ids);
    return null;
  }

  const primeira = mensagens[0];
  const tempoReacaoSegundos = primeira.tempoRespostaSegundos ?? null;
  const dataRecebimento =
    primeira.recebidoEm instanceof Date
      ? primeira.recebidoEm
      : new Date(primeira.recebidoEm);

  const analise = await analisarRespostaComGemini(
    "[Mensagem de campanha WhatsApp]",
    textosHumanos
  );

  if (campanhaId) {
    await db
      .insert(campanhasWhatsappLeadsQualificados)
      .values({
        campanhaId,
        disparoId,
        telefone,
        nome,
        cluster: analise.cluster,
        resumoIntencao: analise.resumo_intencao,
        nivelInteresse: analise.nivel_interesse,
        palavrasChave: analise.palavras_chave,
        icpFitScore: analise.icp_fit_score,
        perfilInterlocutor: analise.perfil_interlocutor,
        parametrosProjeto: analise.parametros_projeto,
        motivoObjecao: analise.motivo_objecao,
        resumoObjecao: analise.resumo_objecao ?? null,
        mensagensConsolidadas: textosHumanos,
        totalMensagensTrocas: mensagens.length,
        tempoReacaoSegundos,
        diaSemanaPrimeiraResposta: dataRecebimento.getDay(),
        horaPrimeiraResposta: dataRecebimento.getHours(),
      })
      .onConflictDoNothing();
  }

  await marcarProcessadas(ids);

  return {
    telefone,
    campanhaId,
    disparoId,
    totalMensagens: mensagens.length,
    cluster: analise.cluster,
    icpFitScore: analise.icp_fit_score,
  };
}

async function marcarProcessadas(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await obterDb();
  await db
    .update(campanhasWhatsappMensagensInbound)
    .set({ processado: true, processadoEm: new Date() })
    .where(inArray(campanhasWhatsappMensagensInbound.id, ids));
}

export { formatarFaixaHeatmap };
