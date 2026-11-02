import { eq, sql } from "drizzle-orm";
import { campanhasWhatsappInboundPollingCursor } from "../../drizzle/schema";
import type { TipoMensagemInbound } from "../../shared/campanhas-whatsapp-ia";
import { getDb } from "../db/db";
import { obterCanalId } from "../integrations/wts-chat-client";
import {
  criarHelenaChatClient,
  type HelenaChatClient,
  type HelenaMessage,
  type HelenaSession,
} from "../integrations/helena-chat-client";
import {
  registrarMensagemInbound,
  type MensagemInboundEntrada,
  type ResultadoRegistroInbound,
} from "./campanhasWhatsappInboundBuffer";

const JANELA_MAXIMA_MS = 7 * 24 * 60 * 60 * 1000;
const SOBREPOSICAO_MS = 48 * 60 * 60 * 1000;
const CONCORRENCIA_SESSOES = 4;

export interface ResultadoPollingHelena {
  estado: "desabilitado" | "sem_token" | "concluido";
  desde?: string;
  ate?: string;
  sessoesConsultadas: number;
  mensagensConsultadas: number;
  mensagensRecebidas: number;
  gravadas: number;
  duplicadas: number;
  telefonesInvalidos: number;
  respostasBot: number;
  enviosDoAtendimentoIgnorados: number;
}

export function calcularInicioPollingHelena(
  cursorAt: Date | null,
  agora: Date
): Date {
  const inicioJanelaMaxima = agora.getTime() - JANELA_MAXIMA_MS;
  const cursorSeguro = cursorAt
    ? Math.min(cursorAt.getTime(), agora.getTime())
    : null;
  const inicioComSobreposicao =
    cursorSeguro !== null ? cursorSeguro - SOBREPOSICAO_MS : inicioJanelaMaxima;
  return new Date(Math.max(inicioJanelaMaxima, inicioComSobreposicao));
}

function lerData(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) ? data : null;
}

function primeiroValor(
  ...valores: Array<string | null | undefined>
): string | null {
  return (
    valores.find(valor => typeof valor === "string" && valor.trim())?.trim() ??
    null
  );
}

function mapearTipoMensagem(tipo: HelenaMessage["type"]): TipoMensagemInbound {
  if (tipo === "BUTTONS") return "button_reply";
  if (tipo === "LIST") return "list_reply";
  return "text";
}

function mapearMensagemInbound(
  sessao: HelenaSession,
  mensagem: HelenaMessage
): MensagemInboundEntrada | null {
  if (mensagem.direction !== "TO_HUB") return null;

  const telefone = primeiroValor(
    mensagem.details?.contact?.phoneNumber,
    mensagem.details?.contact?.phoneNumberFormatted,
    mensagem.details?.contact?.phonenumber,
    mensagem.details?.contact?.phonenumberFormatted,
    sessao.contactDetails?.phonenumber,
    sessao.contactDetails?.phonenumberFormatted,
    sessao.contactDetails?.phoneNumber,
    sessao.contactDetails?.phoneNumberFormatted
  );
  if (!telefone) return null;

  return {
    telefone,
    nome:
      primeiroValor(
        mensagem.details?.contact?.name,
        sessao.contactDetails?.name
      ) ?? null,
    tipoMensagem: mapearTipoMensagem(mensagem.type),
    texto: mensagem.text ?? null,
    mensagemIdExterno: mensagem.id,
    recebidoEm: lerData(mensagem.timestamp) ?? lerData(mensagem.createdAt),
    payloadRaw: JSON.stringify({
      origem: "helena_polling",
      sessionId: sessao.id,
      message: mensagem,
    }),
  };
}

async function comLimite<T, R>(
  itens: T[],
  limite: number,
  executar: (item: T) => Promise<R>
): Promise<R[]> {
  const resultados = new Array<R>(itens.length);
  let proximo = 0;
  let falhou = false;
  let primeiroErro: unknown;
  const trabalhadores = Array.from(
    { length: Math.min(limite, itens.length) },
    async () => {
      while (true) {
        if (falhou) return;
        const indice = proximo++;
        if (indice >= itens.length) return;
        try {
          resultados[indice] = await executar(itens[indice]);
        } catch (erro) {
          falhou = true;
          primeiroErro = erro;
          return;
        }
      }
    }
  );
  await Promise.all(trabalhadores);
  if (falhou) throw primeiroErro;
  return resultados;
}

export interface ImportarMensagensHelenaOptions {
  client: Pick<HelenaChatClient, "listarSessoes" | "listarMensagens">;
  registrar?: (
    input: MensagemInboundEntrada
  ) => Promise<ResultadoRegistroInbound>;
  canalId: string;
  desde: Date;
  ate: Date;
}

export interface ExecutarPollingHelenaOptions extends Omit<
  ImportarMensagensHelenaOptions,
  "desde"
> {
  cursorAt: Date | null;
  avancarCursor: (ate: Date) => Promise<void>;
}

/** Só avança o cursor depois de ler todas as páginas e persistir cada resposta válida. */
export async function executarPollingHelena({
  cursorAt,
  avancarCursor,
  ...opcoes
}: ExecutarPollingHelenaOptions): Promise<ResultadoPollingHelena> {
  const desde = calcularInicioPollingHelena(cursorAt, opcoes.ate);
  const resultado = await importarMensagensHelena({ ...opcoes, desde });
  await avancarCursor(opcoes.ate);
  return resultado;
}

/** Busca respostas na Helena e as grava pelo mesmo buffer idempotente usado pelo webhook. */
export async function importarMensagensHelena({
  client,
  registrar = registrarMensagemInbound,
  canalId,
  desde,
  ate,
}: ImportarMensagensHelenaOptions): Promise<ResultadoPollingHelena> {
  const sessoes = await client.listarSessoes({
    channelId: canalId,
    after: desde,
    before: ate,
  });
  const sessoesComEntrada = sessoes.filter(sessao => {
    const ultimaEntrada = lerData(sessao.lastMessageIn);
    return ultimaEntrada !== null && ultimaEntrada >= desde;
  });

  // Primeiro lê toda a janela do provedor; uma falha de API não deixa um lote parcialmente avançado.
  const mensagensPorSessao = await comLimite(
    sessoesComEntrada,
    CONCORRENCIA_SESSOES,
    sessao => client.listarMensagens({ sessionId: sessao.id, after: desde })
  );

  const mensagens: Array<{
    entrada: MensagemInboundEntrada;
    data: Date;
  }> = [];
  let enviosDoAtendimentoIgnorados = 0;
  let telefonesSemCadastro = 0;
  let mensagensConsultadas = 0;

  sessoesComEntrada.forEach((sessao, indice) => {
    for (const mensagem of mensagensPorSessao[indice]) {
      mensagensConsultadas++;
      if (mensagem.direction !== "TO_HUB") {
        enviosDoAtendimentoIgnorados++;
        continue;
      }
      const entrada = mapearMensagemInbound(sessao, mensagem);
      if (!entrada) {
        telefonesSemCadastro++;
        continue;
      }
      const data = entrada.recebidoEm ?? ate;
      mensagens.push({ entrada, data });
    }
  });

  mensagens.sort((a, b) => a.data.getTime() - b.data.getTime());
  let gravadas = 0;
  let duplicadas = 0;
  let telefonesInvalidos = telefonesSemCadastro;
  let respostasBot = 0;
  for (const { entrada } of mensagens) {
    const resultado = await registrar(entrada);
    if (!resultado.ok) telefonesInvalidos++;
    else if (resultado.duplicada) duplicadas++;
    else {
      gravadas++;
      if (resultado.ehBot) respostasBot++;
    }
  }

  return {
    estado: "concluido",
    desde: desde.toISOString(),
    ate: ate.toISOString(),
    sessoesConsultadas: sessoesComEntrada.length,
    mensagensConsultadas,
    mensagensRecebidas: mensagens.length + telefonesSemCadastro,
    gravadas,
    duplicadas,
    telefonesInvalidos,
    respostasBot,
    enviosDoAtendimentoIgnorados,
  };
}

/** O polling só roda quando habilitado explicitamente; nunca faz uma chamada externa por padrão. */
export async function sincronizarRespostasHelena(): Promise<ResultadoPollingHelena> {
  const resultadoVazio = (
    estado: ResultadoPollingHelena["estado"]
  ): ResultadoPollingHelena => ({
    estado,
    sessoesConsultadas: 0,
    mensagensConsultadas: 0,
    mensagensRecebidas: 0,
    gravadas: 0,
    duplicadas: 0,
    telefonesInvalidos: 0,
    respostasBot: 0,
    enviosDoAtendimentoIgnorados: 0,
  });

  if (process.env.CAMPANHAS_CECI_POLLING_ENABLED !== "true") {
    return resultadoVazio("desabilitado");
  }
  const authorization = process.env.WTS_CHAT_AUTHORIZATION?.trim();
  if (!authorization) return resultadoVazio("sem_token");

  const db = await getDb();
  if (!db)
    throw new Error("Banco de dados indisponível para o polling de Campanhas.");
  const canalId = obterCanalId();
  const chave = `helena:${canalId}`;
  const [registro] = await db
    .select({ cursorAt: campanhasWhatsappInboundPollingCursor.cursorAt })
    .from(campanhasWhatsappInboundPollingCursor)
    .where(eq(campanhasWhatsappInboundPollingCursor.chave, chave))
    .limit(1);
  const agora = new Date();
  return executarPollingHelena({
    client: criarHelenaChatClient({ authorization }),
    canalId,
    ate: agora,
    cursorAt: registro?.cursorAt
      ? registro.cursorAt instanceof Date
        ? registro.cursorAt
        : new Date(registro.cursorAt)
      : null,
    avancarCursor: async ate => {
      await db
        .insert(campanhasWhatsappInboundPollingCursor)
        .values({ chave, cursorAt: ate })
        .onConflictDoUpdate({
          target: campanhasWhatsappInboundPollingCursor.chave,
          set: {
            cursorAt: sql`greatest(${campanhasWhatsappInboundPollingCursor.cursorAt}, excluded.cursor_at)`,
            updatedAt: new Date(),
          },
        });
    },
  });
}
