import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../db/db";
import { getPool } from "../db/db-connection";
import {
  campanhasWhatsapp,
  campanhasWhatsappCadenciaEnvios,
  campanhasWhatsappCampanhaFontes,
  campanhasWhatsappClienteFatos,
  campanhasWhatsappContatosHistorico,
  campanhasWhatsappEtapas,
  campanhasWhatsappFontes,
  campanhasWhatsappImportacaoContatos,
  campanhasWhatsappImportacoes,
  campanhasWhatsappInscricoes,
  campanhasWhatsappOptout,
  campanhasWhatsappQuarentena,
  campanhasWhatsappStatusWebhookEventos,
  campanhasWhatsappDisparos,
  mubisysClientesCache,
  type CampanhaWhatsapp,
  type CampanhaWhatsappFonte,
} from "../../drizzle/schema";
import { normalizarTelefone, hojeCampoGrande } from "../../shared/campanhas-whatsapp";
import { enviarTemplateWtsSeguro, idMensagemWts } from "../integrations/wts-chat-client";
import {
  carregarContextoErp,
  lerArquivoDeUrl,
  resolverFonteErp,
  resolverFonteRetargeting,
  type ContatoFonte,
} from "./fontesErpCampanhas";
import {
  e164ParaDigitos,
  avaliarRegrasErp,
  diasEntreDatasIso,
  detectarPedidoOptOut,
  hojeIsoCampoGrande,
  proximoHorarioEntreDisparos,
  proximoHorarioUtil,
  telefoneParaE164,
  type FatosContatoErp,
  type RegraCadenciaErp,
} from "./campanhaCadenciaRules";
import {
  buscarFatosContatoErp,
  obterContatosErpAtivos,
  obterSaudeSyncErp,
} from "./campanhaCadenciaErp";

const ESTADOS_ATIVOS = ["aguardando", "enviando", "pendente_conciliacao", "pausado_por_resposta"] as const;

export interface EtapaSnapshot {
  numero: number;
  templateId: string;
  atrasoDiasUteis: number;
}

interface ContatoAudiencia {
  telefoneE164: string;
  nome: string;
  cnpj: string | null;
  clienteId: number | null;
  origemTipo: string;
  origemId: number | null;
  prioridade: number;
}

interface InscricaoDisparo {
  id: number;
  campanha_id: number;
  telefone_e164: string;
  nome: string;
  cliente_id: number | null;
  cnpj: string | null;
  etapa_atual: number;
  versao_etapas: number;
  snapshot_etapas: EtapaSnapshot[];
  lease_token: string;
  campanha_nome: string;
  intervalo_minimo_segundos: number;
  intervalo_maximo_segundos: number;
}

function regrasValidas(valor: unknown): RegraCadenciaErp[] {
  if (!Array.isArray(valor)) return [];
  const campos = new Set(["days_since_purchase", "total_orders", "orders_last_90_days", "quote_status", "days_since_quote", "orders_after_latest_quote"]);
  const operadores = new Set(["eq", "neq", "gt", "gte", "lt", "lte"]);
  const regras: RegraCadenciaErp[] = [];
  for (const item of valor) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (!campos.has(String(r.campo)) || !operadores.has(String(r.operador))) continue;
    if (r.campo === "quote_status") {
      if (!["pending", "won", "lost", "other"].includes(String(r.valor))) continue;
      regras.push({ campo: "quote_status", operador: r.operador as RegraCadenciaErp["operador"], valor: String(r.valor) });
      continue;
    }
    const n = Number(r.valor);
    if (!Number.isFinite(n)) continue;
    regras.push({ campo: r.campo as RegraCadenciaErp["campo"], operador: r.operador as RegraCadenciaErp["operador"], valor: n });
  }
  return regras;
}

function contatoErp(fatos: FatosContatoErp | null, origemTipo: string, origemId: number | null, prioridade: number): ContatoAudiencia | null {
  if (!fatos) return null;
  return {
    telefoneE164: fatos.telefoneE164,
    nome: fatos.nome,
    cnpj: fatos.cnpj,
    clienteId: fatos.clienteId,
    origemTipo,
    origemId,
    prioridade,
  };
}

function contatoLegado(contato: ContatoFonte, origemTipo: string, origemId: number, prioridade: number): ContatoAudiencia | null {
  const telefoneE164 = telefoneParaE164(contato.telefone);
  if (!telefoneE164) return null;
  return { telefoneE164, nome: contato.nome || "", cnpj: null, clienteId: null, origemTipo, origemId, prioridade };
}

async function resolverContatosFonte(
  campanha: CampanhaWhatsapp,
  fonte: CampanhaWhatsappFonte,
  prioridadeContato: number,
  fatos: FatosContatoErp[],
  ativosErp: Set<string>,
  imports: Map<number, Array<{ telefoneE164: string; nome: string }>>,
  importsCampanha: Array<{ telefoneE164: string; nome: string }>,
  contextoErp: Awaited<ReturnType<typeof carregarContextoErp>> | null
): Promise<ContatoAudiencia[]> {
  const candidatos: ContatoAudiencia[] = [];
  if (fonte.tipo === "regras_erp") {
    const regras = regrasValidas(fonte.regrasErp?.regras);
    if (!regras.length) return candidatos;
    for (const f of fatos) {
      if (avaliarRegrasErp(f, regras)) {
        const contato = contatoErp(f, fonte.tipo, fonte.id, prioridadeContato);
        if (contato) candidatos.push(contato);
      }
    }
  } else if (fonte.tipo === "erp" && fonte.consultaErp && contextoErp) {
    const contatos = await resolverFonteErp(fonte.consultaErp, hojeCampoGrande(), contextoErp);
    for (const c of contatos) {
      const contato = contatoLegado(c, fonte.tipo, fonte.id, prioridadeContato);
      if (contato) candidatos.push(contato);
    }
  } else if (fonte.tipo === "arquivo") {
    for (const c of imports.get(fonte.id) ?? []) {
      if (ativosErp.has(c.telefoneE164)) continue;
      candidatos.push({ telefoneE164: c.telefoneE164, nome: c.nome, cnpj: null, clienteId: null, origemTipo: fonte.tipo, origemId: fonte.id, prioridade: prioridadeContato });
    }
  } else if (fonte.tipo === "campanha_arquivos") {
    for (const c of importsCampanha) {
      if (ativosErp.has(c.telefoneE164)) continue;
      candidatos.push({ telefoneE164: c.telefoneE164, nome: c.nome, cnpj: null, clienteId: null, origemTipo: fonte.tipo, origemId: fonte.id, prioridade: prioridadeContato });
    }
  } else if (fonte.tipo === "retargeting") {
    const contacts = await resolverFonteRetargeting(fonte.retargetingConfig);
    for (const c of contacts) {
      const contato = contatoLegado(c, fonte.tipo, fonte.id, prioridadeContato);
      if (contato && !ativosErp.has(contato.telefoneE164)) candidatos.push(contato);
    }
  }
  return candidatos;
}

function prioridadeDaFonte(campanha: CampanhaWhatsapp, fonte: CampanhaWhatsappFonte): number {
  if (fonte.tipo === "regras_erp") {
    if (fonte.chave === "primeira_compra_pos_venda") return 0;
    if (fonte.chave === "reativacao_inativos") return 20;
    if (fonte.chave === "orcou_nao_comprou" || fonte.chave === "ativos_recorrentes") return 30;
  }
  if (["arquivo", "campanha_arquivos", "retargeting"].includes(fonte.tipo)) return Math.max(100, campanha.prioridadeCadencia);
  return campanha.prioridadeCadencia;
}

async function carregarSnapshotAtual(campanha: CampanhaWhatsapp): Promise<EtapaSnapshot[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(campanhasWhatsappEtapas).where(and(
    eq(campanhasWhatsappEtapas.campanhaId, campanha.id),
    eq(campanhasWhatsappEtapas.versao, campanha.versaoEtapasAtual)
  )).orderBy(campanhasWhatsappEtapas.numero);
  return rows.map(r => ({ numero: r.numero, templateId: r.templateId, atrasoDiasUteis: r.atrasoDiasUteis }));
}

async function carregarImports(): Promise<{
  porFonte: Map<number, Array<{ telefoneE164: string; nome: string }>>;
  porCampanha: Map<number, Array<{ telefoneE164: string; nome: string }>>;
}> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const imports = await db.select().from(campanhasWhatsappImportacoes).orderBy(desc(campanhasWhatsappImportacoes.importadoEm), desc(campanhasWhatsappImportacoes.id));
  const maisRecentePorFonte = new Map<number, number>();
  for (const item of imports) {
    if (item.fonteId && !maisRecentePorFonte.has(item.fonteId)) maisRecentePorFonte.set(item.fonteId, item.id);
  }
  const ids = imports.filter(i => i.optInConfirmado && (!i.fonteId || maisRecentePorFonte.get(i.fonteId) === i.id)).map(i => i.id);
  if (!ids.length) return { porFonte: new Map(), porCampanha: new Map() };
  const contatos = await db.select({
    importacaoId: campanhasWhatsappImportacaoContatos.importacaoId,
    telefoneE164: campanhasWhatsappImportacaoContatos.telefoneE164,
    nome: campanhasWhatsappImportacaoContatos.nome,
  }).from(campanhasWhatsappImportacaoContatos).where(inArray(campanhasWhatsappImportacaoContatos.importacaoId, ids));
  const importPorId = new Map(imports.map(i => [i.id, i]));
  const porFonte = new Map<number, Array<{ telefoneE164: string; nome: string }>>();
  const porCampanha = new Map<number, Array<{ telefoneE164: string; nome: string }>>();
  for (const c of contatos) {
    const lote = importPorId.get(c.importacaoId);
    if (!lote) continue;
    const contato = { telefoneE164: c.telefoneE164, nome: c.nome };
    if (lote.fonteId) {
      const lista = porFonte.get(lote.fonteId) ?? [];
      lista.push(contato);
      porFonte.set(lote.fonteId, lista);
    }
    if (lote.campanhaId) {
      const lista = porCampanha.get(lote.campanhaId) ?? [];
      lista.push(contato);
      porCampanha.set(lote.campanhaId, lista);
    }
  }
  return { porFonte, porCampanha };
}

/** Materializa entradas e saídas dos públicos no Postgres; pode rodar em qualquer instância serverless. */
export async function sincronizarAudienciasCadencia(): Promise<{ inscricoesCriadas: number; inscricoesRemovidas: number }> {
  const saude = await obterSaudeSyncErp();
  if (!saude.ok) throw new Error(`Sincronização MubiSys indisponível/desatualizada: ${saude.detalhes.map(d => `${d.recurso}=${d.status}`).join(", ")}`);
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const [campanhas, fatosRows, ativosErp, imports, clientesErp] = await Promise.all([
    db.select().from(campanhasWhatsapp).where(and(eq(campanhasWhatsapp.motorCadenciaAtivo, true), eq(campanhasWhatsapp.status, "ativa"))),
    db.select().from(campanhasWhatsappClienteFatos),
    obterContatosErpAtivos(),
    carregarImports(),
    db.select().from(mubisysClientesCache).orderBy(desc(mubisysClientesCache.id)),
  ]);
  const cadastroMaisRecentePorTelefone = new Map<string, { nome: string; cnpj: string | null; clienteId: number }>();
  for (const cliente of clientesErp) {
    const telefone = telefoneParaE164(cliente.telefone);
    if (!telefone || cadastroMaisRecentePorTelefone.has(telefone)) continue;
    cadastroMaisRecentePorTelefone.set(telefone, {
      nome: cliente.razaoSocial || cliente.nomeFantasia || "",
      cnpj: cliente.cnpj,
      clienteId: cliente.id,
    });
  }
  const campanhasOrdenadas = campanhas.sort((a, b) => a.prioridadeCadencia - b.prioridadeCadencia || a.id - b.id);
  const fatos: FatosContatoErp[] = fatosRows.map(f => ({
    telefoneE164: f.telefoneE164, nome: f.nome, cnpj: f.cnpj, clienteId: f.clienteId,
    totalOrders: f.totalPedidos, ordersLast90Days: f.pedidosUltimos90Dias,
    daysSincePurchase: f.diasSemComprar, quoteStatus: f.statusOrcamento as FatosContatoErp["quoteStatus"],
    daysSinceQuote: f.diasPosOrcamento, ordersAfterLatestQuote: f.pedidosAposUltimoOrcamento,
    ultimaCompraEm: f.ultimaCompraEm, ultimoOrcamentoEm: f.ultimoOrcamentoEm,
  }));
  const fontesVinculadas = campanhas.length ? await db.select({ campanhaId: campanhasWhatsappCampanhaFontes.campanhaId, fonte: campanhasWhatsappFontes })
    .from(campanhasWhatsappCampanhaFontes).innerJoin(campanhasWhatsappFontes, eq(campanhasWhatsappFontes.id, campanhasWhatsappCampanhaFontes.fonteId))
    .where(inArray(campanhasWhatsappCampanhaFontes.campanhaId, campanhas.map(c => c.id))) : [];
  const links = new Map<number, CampanhaWhatsappFonte[]>();
  for (const l of fontesVinculadas) {
    if (!l.fonte.ativo) continue;
    const list = links.get(l.campanhaId) ?? [];
    list.push(l.fonte);
    links.set(l.campanhaId, list);
  }
  const fontesPrimeiraCompra = [...links.values()].flat().filter(f => f.tipo === "regras_erp" && f.chave === "primeira_compra_pos_venda");
  const idsFontePrimeiraCompra = fontesPrimeiraCompra.map(f => f.id);
  const jaEntraramNaReguaPosVenda = new Set<string>();
  if (idsFontePrimeiraCompra.length) {
    const anteriores = await db.select({ telefone: campanhasWhatsappInscricoes.telefoneE164 })
      .from(campanhasWhatsappInscricoes)
      .where(and(
        eq(campanhasWhatsappInscricoes.origemTipo, "regras_erp"),
        inArray(campanhasWhatsappInscricoes.origemId, idsFontePrimeiraCompra),
      ));
    for (const anterior of anteriores) jaEntraramNaReguaPosVenda.add(anterior.telefone);
  }
  const jaOptOut = new Set((await db.select({ telefone: campanhasWhatsappOptout.telefone }).from(campanhasWhatsappOptout)).map(r => `+${r.telefone}`));
  const contextoErp = fontesVinculadas.some(l => l.fonte.tipo === "erp") ? await carregarContextoErp(true) : null;
  const mapaImportacoes = imports.porFonte;
  const desejados = new Map<number, Map<string, ContatoAudiencia>>();

  for (const campanha of campanhasOrdenadas) {
    const snapshot = await carregarSnapshotAtual(campanha);
    if (!snapshot.length) continue;
    const contatos = new Map<string, ContatoAudiencia>();
    const anexos = imports.porCampanha.get(campanha.id) ?? [];
    for (const fonte of links.get(campanha.id) ?? []) {
      const resolvidos = await resolverContatosFonte(campanha, fonte, prioridadeDaFonte(campanha, fonte), fatos, ativosErp, mapaImportacoes, anexos, contextoErp);
      for (const c of resolvidos) {
        if (jaOptOut.has(c.telefoneE164)) continue;
        const cadastro = cadastroMaisRecentePorTelefone.get(c.telefoneE164);
        if (cadastro && !["regras_erp", "erp"].includes(c.origemTipo)) {
          c.nome = cadastro.nome || c.nome;
          c.cnpj = cadastro.cnpj;
          c.clienteId = cadastro.clienteId;
        }
        const anterior = contatos.get(c.telefoneE164);
        if (!anterior) contatos.set(c.telefoneE164, c);
        else {
          const contatoErpPreferido = c.clienteId && !anterior.clienteId;
          const prioridadePreferida = c.prioridade < anterior.prioridade;
          if (contatoErpPreferido || prioridadePreferida) {
            contatos.set(c.telefoneE164, {
              ...(contatoErpPreferido ? c : anterior),
              prioridade: Math.min(anterior.prioridade, c.prioridade),
            });
          }
        }
      }
    }
    desejados.set(campanha.id, contatos);
  }

  let removidas = 0;
  const pendentes = await db.select().from(campanhasWhatsappInscricoes)
    .where(inArray(campanhasWhatsappInscricoes.status, ["aguardando", "enviando", "pendente_conciliacao"]));
  for (const inscricao of pendentes) {
    const segue = desejados.get(inscricao.campanhaId)?.has(inscricao.telefoneE164) ?? false;
    if (!segue) {
      const atualizadas = await db.update(campanhasWhatsappInscricoes).set({
        status: "removido_por_conversao",
        motivoFim: "criterio_audiencia_nao_atendido",
        proximoEnvioEm: null,
        leaseToken: null,
        leaseAte: null,
        updatedAt: new Date(),
      }).where(and(eq(campanhasWhatsappInscricoes.id, inscricao.id), inArray(campanhasWhatsappInscricoes.status, ["aguardando", "enviando", "pendente_conciliacao"]))).returning({ id: campanhasWhatsappInscricoes.id });
      removidas += atualizadas.length;
    }
  }

  let criadas = 0;
  const ativosPorTelefone = new Map<string, { inscricao: typeof pendentes[number]; prioridade: number }>();
  const existentes = await db.select({ inscricao: campanhasWhatsappInscricoes, prioridade: campanhasWhatsappInscricoes.prioridadeNoMomento })
    .from(campanhasWhatsappInscricoes).innerJoin(campanhasWhatsapp, eq(campanhasWhatsapp.id, campanhasWhatsappInscricoes.campanhaId))
    .where(inArray(campanhasWhatsappInscricoes.status, [...ESTADOS_ATIVOS]));
  for (const row of existentes) ativosPorTelefone.set(row.inscricao.telefoneE164, { inscricao: row.inscricao as typeof pendentes[number], prioridade: row.prioridade });
  const enviosSemResultado = await db.select({ telefone: campanhasWhatsappCadenciaEnvios.telefoneE164 })
    .from(campanhasWhatsappCadenciaEnvios)
    .where(inArray(campanhasWhatsappCadenciaEnvios.status, ["enviando", "aceito", "pendente_conciliacao"]));
  const telefonesSemResultado = new Set(enviosSemResultado.map(row => row.telefone));

  const bloqueios = new Map<string, string>((await db.select({ telefone: campanhasWhatsappQuarentena.telefone, data: campanhasWhatsappQuarentena.ultimoContatoEm }).from(campanhasWhatsappQuarentena))
    .map(r => [`+${r.telefone}`, String(r.data).slice(0, 10)] as const));
  const stepsPorCampanha = new Map<number, EtapaSnapshot[]>();
  for (const campanha of campanhasOrdenadas) stepsPorCampanha.set(campanha.id, await carregarSnapshotAtual(campanha));

  for (const campanha of campanhasOrdenadas) {
    for (const contato of desejados.get(campanha.id)?.values() ?? []) {
      // total_orders=1 remains true indefinitely; treat post-sale as an event cohort and enroll once per phone.
      if (idsFontePrimeiraCompra.includes(contato.origemId ?? -1) && jaEntraramNaReguaPosVenda.has(contato.telefoneE164)) continue;
      const existente = ativosPorTelefone.get(contato.telefoneE164);
      if (existente) {
        if (existente.inscricao.status === "pausado_por_resposta") continue;
        // Do not hand the number to another campaign while a provider outcome is unknown.
        // A preempted timeout could otherwise be sent again from a higher-priority audience.
        if (["enviando", "pendente_conciliacao"].includes(existente.inscricao.status)) continue;
        if (existente.inscricao.campanhaId === campanha.id) {
          if (existente.prioridade !== contato.prioridade) {
            await db.update(campanhasWhatsappInscricoes).set({ prioridadeNoMomento: contato.prioridade, updatedAt: new Date() })
              .where(eq(campanhasWhatsappInscricoes.id, existente.inscricao.id));
            existente.prioridade = contato.prioridade;
          }
          continue;
        }
        if (contato.prioridade < existente.prioridade) {
          await db.update(campanhasWhatsappInscricoes).set({
            status: "removido_por_prioridade", motivoFim: `substituida_pela_campanha_${campanha.id}`,
            proximoEnvioEm: null, leaseToken: null, leaseAte: null, updatedAt: new Date(),
          }).where(and(eq(campanhasWhatsappInscricoes.id, existente.inscricao.id), inArray(campanhasWhatsappInscricoes.status, [...ESTADOS_ATIVOS])));
          ativosPorTelefone.delete(contato.telefoneE164);
        } else continue;
      }

      if (telefonesSemResultado.has(contato.telefoneE164)) continue;

      const ultima = bloqueios.get(contato.telefoneE164);
      const cooldown = Math.max(campanha.intervaloMinimoEntreCampanhasDias, campanha.quarentenaDias);
      if (ultima) {
      const dias = diasEntreDatasIso(ultima, hojeIsoCampoGrande());
        if (dias < cooldown) continue;
      }
      const snapshot = stepsPorCampanha.get(campanha.id) ?? [];
      if (!snapshot.length) continue;
      const agora = new Date();
      const [row] = await db.insert(campanhasWhatsappInscricoes).values({
        campanhaId: campanha.id,
        telefoneE164: contato.telefoneE164,
        nome: contato.nome,
        cnpj: contato.cnpj,
        clienteId: contato.clienteId,
        origemTipo: contato.origemTipo,
        origemId: contato.origemId,
        status: "aguardando",
        prioridadeNoMomento: contato.prioridade,
        versaoEtapas: campanha.versaoEtapasAtual,
        snapshotEtapas: snapshot,
        etapaAtual: 1,
        proximoEnvioEm: proximoHorarioUtil(agora, 0),
        createdAt: agora,
        updatedAt: agora,
      }).onConflictDoNothing().returning({ id: campanhasWhatsappInscricoes.id });
      if (row) {
        criadas++;
        telefonesSemResultado.add(contato.telefoneE164);
        if (idsFontePrimeiraCompra.includes(contato.origemId ?? -1)) jaEntraramNaReguaPosVenda.add(contato.telefoneE164);
        ativosPorTelefone.set(contato.telefoneE164, {
          inscricao: { id: row.id, campanhaId: campanha.id, telefoneE164: contato.telefoneE164, nome: contato.nome, cnpj: contato.cnpj, clienteId: contato.clienteId, origemTipo: contato.origemTipo, origemId: contato.origemId, status: "aguardando", prioridadeNoMomento: contato.prioridade, versaoEtapas: campanha.versaoEtapasAtual, snapshotEtapas: snapshot, etapaAtual: 1, proximoEnvioEm: proximoHorarioUtil(agora, 0), ultimoEnvioAceitoEm: null, ultimaRespostaEm: null, motivoFim: null, leaseToken: null, leaseAte: null, createdAt: agora, updatedAt: agora } as typeof pendentes[number],
          prioridade: contato.prioridade,
        });
      }
    }
  }
  return { inscricoesCriadas: criadas, inscricoesRemovidas: removidas };
}

async function completarLease(token: string, proximoEnvio: Date | null): Promise<void> {
  await getPool().query(
    `UPDATE campanhas_whatsapp_motor_estado SET lease_token = NULL, lease_ate = NULL,
     proximo_envio_em = $2, updated_at = now() WHERE id = 1 AND lease_token = $1`,
    [token, proximoEnvio]
  );
}

async function expirarLeasesAntigos(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const expiradas = await db.select().from(campanhasWhatsappInscricoes)
    .where(and(eq(campanhasWhatsappInscricoes.status, "enviando"), sql`${campanhasWhatsappInscricoes.leaseAte} < now()`));
  for (const inscricao of expiradas) {
    await db.update(campanhasWhatsappInscricoes).set({ status: "pendente_conciliacao", motivoFim: "worker_interrompido_resultado_incerto", leaseToken: null, leaseAte: null, updatedAt: new Date() })
      .where(and(eq(campanhasWhatsappInscricoes.id, inscricao.id), eq(campanhasWhatsappInscricoes.status, "enviando")));
    await db.update(campanhasWhatsappCadenciaEnvios).set({ status: "pendente_conciliacao", erro: "A execução terminou sem confirmar o retorno do provedor.", updatedAt: new Date() })
      .where(and(eq(campanhasWhatsappCadenciaEnvios.inscricaoId, inscricao.id), eq(campanhasWhatsappCadenciaEnvios.status, "enviando")));
  }
}

async function moverEnviosVencidosParaJanelaUtil(): Promise<void> {
  const agora = new Date();
  const proximaJanela = proximoHorarioUtil(agora, 0);
  if (proximaJanela.getTime() <= agora.getTime()) return;
  await getPool().query(
    `UPDATE campanhas_whatsapp_inscricoes
     SET proximo_envio_em = $1, updated_at = now()
     WHERE status = 'aguardando' AND proximo_envio_em <= now()`,
    [proximaJanela]
  );
}

async function reivindicarProximaInscricao(): Promise<InscricaoDisparo | null> {
  const pool = getPool();
  const client = await pool.connect();
  const token = randomUUID();
  try {
    await client.query("BEGIN");
    const state = await client.query(
      `UPDATE campanhas_whatsapp_motor_estado SET lease_token = $1,
       lease_ate = now() + interval '45 seconds', updated_at = now()
       WHERE id = 1 AND (lease_ate IS NULL OR lease_ate <= now())
         AND (proximo_envio_em IS NULL OR proximo_envio_em <= now())
       RETURNING id`, [token]
    );
    if (!state.rowCount) {
      await client.query("ROLLBACK");
      return null;
    }
    const candidate = await client.query(
      `SELECT i.id, i.campanha_id, i.telefone_e164, i.nome, i.cliente_id, i.cnpj,
              i.etapa_atual, i.versao_etapas, i.snapshot_etapas, c.nome AS campanha_nome,
              c.intervalo_minimo_segundos, c.intervalo_maximo_segundos
       FROM campanhas_whatsapp_inscricoes i
       JOIN campanhas_whatsapp c ON c.id = i.campanha_id
       WHERE i.status = 'aguardando' AND i.proximo_envio_em <= now()
         AND c.status = 'ativa' AND c.motor_cadencia_ativo = true
         AND NOT EXISTS (
           SELECT 1 FROM campanhas_whatsapp_optout o
           WHERE o.telefone = regexp_replace(i.telefone_e164, '[^0-9]', '', 'g')
         )
       ORDER BY i.prioridade_no_momento ASC, c.prioridade_cadencia ASC, i.proximo_envio_em ASC, i.id ASC
       LIMIT 1 FOR UPDATE OF i SKIP LOCKED`
    );
    const row = candidate.rows[0] as Omit<InscricaoDisparo, "lease_token"> | undefined;
    if (!row) {
      await client.query("UPDATE campanhas_whatsapp_motor_estado SET lease_token = NULL, lease_ate = NULL, updated_at = now() WHERE id = 1 AND lease_token = $1", [token]);
      await client.query("COMMIT");
      return null;
    }
    const updated = await client.query(
      `UPDATE campanhas_whatsapp_inscricoes SET status = 'enviando', lease_token = $2,
       lease_ate = now() + interval '45 seconds', updated_at = now()
       WHERE id = $1 AND status = 'aguardando' RETURNING id`, [row.id, token]
    );
    if (!updated.rowCount) {
      await client.query("UPDATE campanhas_whatsapp_motor_estado SET lease_token = NULL, lease_ate = NULL WHERE id = 1 AND lease_token = $1", [token]);
      await client.query("COMMIT");
      return null;
    }
    const tentativa = await client.query(
      `SELECT COALESCE(MAX(tentativa), 0)::int + 1 AS tentativa FROM campanhas_whatsapp_cadencia_envios
       WHERE inscricao_id = $1 AND etapa = $2`, [row.id, row.etapa_atual]
    );
    const etapa = (row.snapshot_etapas as EtapaSnapshot[])[row.etapa_atual - 1];
    if (!etapa) {
      await client.query(`UPDATE campanhas_whatsapp_inscricoes SET status = 'concluida', proximo_envio_em = NULL, lease_token = NULL, lease_ate = NULL, updated_at = now() WHERE id = $1`, [row.id]);
      await client.query("UPDATE campanhas_whatsapp_motor_estado SET lease_token = NULL, lease_ate = NULL WHERE id = 1 AND lease_token = $1", [token]);
      await client.query("COMMIT");
      return null;
    }
    await client.query(
      `INSERT INTO campanhas_whatsapp_cadencia_envios
       (inscricao_id, campanha_id, telefone_e164, etapa, tentativa, template_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'enviando', now(), now())`,
      [row.id, row.campanha_id, row.telefone_e164, row.etapa_atual, tentativa.rows[0].tentativa, etapa.templateId]
    );
    await client.query("COMMIT");
    return { ...row, lease_token: token } as InscricaoDisparo;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function contatoAindaElegivel(inscricao: InscricaoDisparo): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [estadoInscricao] = await db.select({ status: campanhasWhatsappInscricoes.status, leaseToken: campanhasWhatsappInscricoes.leaseToken })
    .from(campanhasWhatsappInscricoes).where(eq(campanhasWhatsappInscricoes.id, inscricao.id)).limit(1);
  if (estadoInscricao?.status !== "enviando" || estadoInscricao.leaseToken !== inscricao.lease_token) return false;
  const [campanha] = await db.select().from(campanhasWhatsapp).where(eq(campanhasWhatsapp.id, inscricao.campanha_id)).limit(1);
  if (!campanha || campanha.status !== "ativa" || !campanha.motorCadenciaAtivo) return false;
  const [quarentenaAtual] = await db.select({ ultimoContatoEm: campanhasWhatsappQuarentena.ultimoContatoEm, ultimaCampanhaId: campanhasWhatsappQuarentena.ultimaCampanhaId })
    .from(campanhasWhatsappQuarentena)
    .where(eq(campanhasWhatsappQuarentena.telefone, e164ParaDigitos(inscricao.telefone_e164))).limit(1);
  if (quarentenaAtual && quarentenaAtual.ultimaCampanhaId !== campanha.id) {
    const cooldown = Math.max(campanha.intervaloMinimoEntreCampanhasDias, campanha.quarentenaDias);
    if (diasEntreDatasIso(String(quarentenaAtual.ultimoContatoEm).slice(0, 10), hojeIsoCampoGrande()) < cooldown) return false;
  }
  const links = await db.select({ fonte: campanhasWhatsappFontes }).from(campanhasWhatsappCampanhaFontes)
    .innerJoin(campanhasWhatsappFontes, eq(campanhasWhatsappFontes.id, campanhasWhatsappCampanhaFontes.fonteId))
    .where(and(eq(campanhasWhatsappCampanhaFontes.campanhaId, campanha.id), eq(campanhasWhatsappFontes.ativo, true)));
  const ativosErp = await obterContatosErpAtivos();
  const fato = await buscarFatosContatoErp(inscricao.telefone_e164);
  let contexto: Awaited<ReturnType<typeof carregarContextoErp>> | null = null;
  const imports = await carregarImports();
  for (const { fonte } of links) {
    if (fonte.tipo === "regras_erp" && fato && avaliarRegrasErp(fato, regrasValidas(fonte.regrasErp?.regras))) return true;
    if (fonte.tipo === "erp" && fonte.consultaErp) {
      contexto ??= await carregarContextoErp();
      const contatos = await resolverFonteErp(fonte.consultaErp, hojeCampoGrande(), contexto);
      if (contatos.some(c => telefoneParaE164(c.telefone) === inscricao.telefone_e164)) return true;
    }
    if (fonte.tipo === "arquivo" && (imports.porFonte.get(fonte.id) ?? []).some(c => c.telefoneE164 === inscricao.telefone_e164) && !ativosErp.has(inscricao.telefone_e164)) return true;
    if (fonte.tipo === "campanha_arquivos" && (imports.porCampanha.get(campanha.id) ?? []).some(c => c.telefoneE164 === inscricao.telefone_e164) && !ativosErp.has(inscricao.telefone_e164)) return true;
    if (fonte.tipo === "retargeting") {
      const contatos = await resolverFonteRetargeting(fonte.retargetingConfig);
      if (contatos.some(c => telefoneParaE164(c.telefone) === inscricao.telefone_e164) && !ativosErp.has(inscricao.telefone_e164)) return true;
    }
  }
  return false;
}

async function atualizarQuarentenaEHistorico(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  row: InscricaoDisparo,
  quando: Date,
  disparoId: number
): Promise<void> {
  const telefone = e164ParaDigitos(row.telefone_e164);
  const data = hojeCampoGrande(quando);
  await db.insert(campanhasWhatsappQuarentena).values({ telefone, ultimaCampanhaId: row.campanha_id, ultimoContatoEm: data, updatedAt: quando })
    .onConflictDoUpdate({ target: campanhasWhatsappQuarentena.telefone, set: { ultimaCampanhaId: row.campanha_id, ultimoContatoEm: sql`GREATEST(${campanhasWhatsappQuarentena.ultimoContatoEm}, ${data}::date)`, updatedAt: quando } });
  await db.insert(campanhasWhatsappContatosHistorico).values({ campanhaId: row.campanha_id, telefone, ultimoEnvioEm: data, disparoId, updatedAt: quando })
    .onConflictDoUpdate({ target: [campanhasWhatsappContatosHistorico.campanhaId, campanhasWhatsappContatosHistorico.telefone], set: { ultimoEnvioEm: sql`GREATEST(${campanhasWhatsappContatosHistorico.ultimoEnvioEm}, ${data}::date)`, disparoId, updatedAt: quando } });
}

async function processarEventosPendentes(idMensagem: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const eventos = await db.select().from(campanhasWhatsappStatusWebhookEventos).where(and(
    eq(campanhasWhatsappStatusWebhookEventos.idMensagemExterno, idMensagem),
    isNull(campanhasWhatsappStatusWebhookEventos.processadoEm)
  ));
  for (const evento of eventos) await aplicarStatusMensagem(evento.idMensagemExterno, evento.status, evento.ocorreuEm ?? evento.recebidoEm, evento.id);
}

export async function registrarStatusWebhookWts(input: {
  idMensagem: string;
  status: string;
  ocorridoEm?: Date;
  payload?: Record<string, unknown>;
}): Promise<{ registrado: boolean; processado: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para receber status WTS.");
  const status = input.status.trim().toUpperCase();
  const [evento] = await db.insert(campanhasWhatsappStatusWebhookEventos).values({
    idMensagemExterno: input.idMensagem,
    status,
    ocorreuEm: input.ocorridoEm ?? null,
    payload: input.payload ?? null,
  }).onConflictDoNothing().returning({ id: campanhasWhatsappStatusWebhookEventos.id });
  await processarEventosPendentes(input.idMensagem);
  return { registrado: !!evento, processado: !!evento };
}

async function aplicarStatusMensagem(idMensagem: string, statusBruto: string, quando: Date, eventoId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const status = statusBruto.toUpperCase();
  const [envio] = await db.select().from(campanhasWhatsappCadenciaEnvios)
    .where(eq(campanhasWhatsappCadenciaEnvios.idMensagemExterno, idMensagem)).limit(1);
  if (!envio) return;
  const terminalEnvio = ["entregue", "falhou", "cancelado"].includes(envio.status);
  if (terminalEnvio) {
    // Callbacks can arrive late or out of order; never downgrade an attempt or cancel a later step.
  } else if (["SENT", "ENVIADO"].includes(status)) {
    await db.update(campanhasWhatsappCadenciaEnvios).set({ status: "aceito", updatedAt: new Date() })
      .where(eq(campanhasWhatsappCadenciaEnvios.id, envio.id));
  } else if (["DELIVERED", "READ", "LIDO", "ENTREGUE"].includes(status)) {
    const entregueEm = envio.entregueEm ?? quando;
    await db.update(campanhasWhatsappCadenciaEnvios).set({ status: "entregue", entregueEm, updatedAt: new Date() })
      .where(eq(campanhasWhatsappCadenciaEnvios.id, envio.id));
    const [inscricao] = await db.select().from(campanhasWhatsappInscricoes)
      .where(eq(campanhasWhatsappInscricoes.id, envio.inscricaoId)).limit(1);
    if (inscricao && ["aguardando", "pendente_conciliacao"].includes(inscricao.status) && inscricao.etapaAtual === envio.etapa) {
      const snapshot = inscricao.snapshotEtapas as EtapaSnapshot[];
      const etapaSeguinte = snapshot[envio.etapa];
      if (!etapaSeguinte) {
        await db.update(campanhasWhatsappInscricoes).set({ status: "concluida", ultimoEnvioAceitoEm: envio.aceitoEm ?? entregueEm, proximoEnvioEm: null, motivoFim: null, leaseToken: null, leaseAte: null, updatedAt: new Date() })
          .where(and(eq(campanhasWhatsappInscricoes.id, inscricao.id), inArray(campanhasWhatsappInscricoes.status, ["aguardando", "pendente_conciliacao"])));
      } else {
        const base = envio.aceitoEm ?? entregueEm;
        const proximo = proximoHorarioUtil(base, etapaSeguinte.atrasoDiasUteis);
        await db.update(campanhasWhatsappInscricoes).set({ status: "aguardando", etapaAtual: etapaSeguinte.numero, ultimoEnvioAceitoEm: base, proximoEnvioEm: proximo, leaseToken: null, leaseAte: null, updatedAt: new Date() })
          .where(and(eq(campanhasWhatsappInscricoes.id, inscricao.id), inArray(campanhasWhatsappInscricoes.status, ["aguardando", "pendente_conciliacao"])));
      }
    }
  } else if (["FAILED", "ERROR", "REJECTED", "FALHOU", "ERRO", "REJEITADO"].includes(status)) {
    await db.update(campanhasWhatsappCadenciaEnvios).set({ status: "falhou", erro: `Status confirmado pelo provedor: ${status}`, updatedAt: new Date() })
      .where(and(eq(campanhasWhatsappCadenciaEnvios.id, envio.id), inArray(campanhasWhatsappCadenciaEnvios.status, ["aceito", "pendente_conciliacao", "enviando"])));
    await db.update(campanhasWhatsappInscricoes).set({ status: "cancelada", proximoEnvioEm: null, motivoFim: "falha_confirmada_pelo_provedor", leaseToken: null, leaseAte: null, updatedAt: new Date() })
      .where(and(eq(campanhasWhatsappInscricoes.id, envio.inscricaoId), eq(campanhasWhatsappInscricoes.etapaAtual, envio.etapa), inArray(campanhasWhatsappInscricoes.status, ["enviando", "aguardando", "pendente_conciliacao"])));
  }
  await db.update(campanhasWhatsappStatusWebhookEventos).set({ processadoEm: new Date() }).where(eq(campanhasWhatsappStatusWebhookEventos.id, eventoId));
}

export async function processarUmaEtapaCadencia(): Promise<{
  enviou: boolean;
  semFila?: boolean;
  conciliacao?: boolean;
  proximoDelaySegundos?: number;
  inscricaoId?: number;
}> {
  const saude = await obterSaudeSyncErp();
  if (!saude.ok) throw new Error("Envios suspensos: a sincronização do MubiSys está incompleta ou desatualizada.");
  await expirarLeasesAntigos();
  await moverEnviosVencidosParaJanelaUtil();
  const row = await reivindicarProximaInscricao();
  if (!row) {
    const pendencia = await getPool().query<{ quantidade: number; proximo_em: Date | null }>(
      `SELECT count(*)::int AS quantidade,
              min(GREATEST(COALESCE(i.proximo_envio_em, now()),
                           COALESCE(m.proximo_envio_em, now()),
                           COALESCE(m.lease_ate, now()))) AS proximo_em
       FROM campanhas_whatsapp_inscricoes i
       JOIN campanhas_whatsapp c ON c.id = i.campanha_id
       CROSS JOIN campanhas_whatsapp_motor_estado m
       WHERE i.status = 'aguardando' AND c.status = 'ativa' AND c.motor_cadencia_ativo = true
         AND i.proximo_envio_em IS NOT NULL AND m.id = 1`
    );
    const fila = pendencia.rows[0];
    if (!fila?.quantidade || !fila.proximo_em) return { enviou: false, semFila: true };
    const delay = Math.max(1, Math.ceil((new Date(fila.proximo_em).getTime() - Date.now()) / 1000));
    return { enviou: false, semFila: false, proximoDelaySegundos: Math.min(delay, 6 * 24 * 60 * 60) };
  }
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const envio = await db.select().from(campanhasWhatsappCadenciaEnvios)
    .where(and(eq(campanhasWhatsappCadenciaEnvios.inscricaoId, row.id), eq(campanhasWhatsappCadenciaEnvios.etapa, row.etapa_atual), eq(campanhasWhatsappCadenciaEnvios.status, "enviando")))
    .orderBy(desc(campanhasWhatsappCadenciaEnvios.tentativa)).limit(1).then(r => r[0]);
  if (!envio) {
    await completarLease(row.lease_token, null);
    return { enviou: false, semFila: true };
  }
  const telefone = e164ParaDigitos(row.telefone_e164);
  const [optout] = await db.select({ id: campanhasWhatsappOptout.id }).from(campanhasWhatsappOptout).where(eq(campanhasWhatsappOptout.telefone, telefone)).limit(1);
  if (optout) {
    await db.update(campanhasWhatsappInscricoes).set({ status: "opt_out", proximoEnvioEm: null, motivoFim: "opt_out_global", leaseToken: null, leaseAte: null, updatedAt: new Date() }).where(eq(campanhasWhatsappInscricoes.id, row.id));
    await db.update(campanhasWhatsappCadenciaEnvios).set({ status: "cancelado", erro: "Contato com bloqueio global de opt-out.", updatedAt: new Date() }).where(eq(campanhasWhatsappCadenciaEnvios.id, envio.id));
    await completarLease(row.lease_token, null);
    return { enviou: false, semFila: false, proximoDelaySegundos: 1, inscricaoId: row.id };
  }
  if (!(await contatoAindaElegivel(row))) {
    await db.update(campanhasWhatsappInscricoes).set({ status: "removido_por_conversao", proximoEnvioEm: null, motivoFim: "criterio_revalidado_antes_envio", leaseToken: null, leaseAte: null, updatedAt: new Date() })
      .where(and(eq(campanhasWhatsappInscricoes.id, row.id), eq(campanhasWhatsappInscricoes.status, "enviando"), eq(campanhasWhatsappInscricoes.leaseToken, row.lease_token)));
    await db.update(campanhasWhatsappCadenciaEnvios).set({ status: "cancelado", erro: "A audiência ou o critério mudou antes do envio.", updatedAt: new Date() }).where(eq(campanhasWhatsappCadenciaEnvios.id, envio.id));
    await completarLease(row.lease_token, null);
    return { enviou: false, semFila: false, proximoDelaySegundos: 1, inscricaoId: row.id };
  }

  const saudeImediatamenteAntesDoEnvio = await obterSaudeSyncErp();
  if (!saudeImediatamenteAntesDoEnvio.ok) {
    const retomada = proximoHorarioUtil(new Date(), 0);
    await db.update(campanhasWhatsappCadenciaEnvios).set({ status: "cancelado", erro: "Envio interrompido porque uma sincronização ERP começou antes da chamada WTS.", updatedAt: new Date() })
      .where(and(eq(campanhasWhatsappCadenciaEnvios.id, envio.id), eq(campanhasWhatsappCadenciaEnvios.status, "enviando")));
    await db.update(campanhasWhatsappInscricoes).set({ status: "aguardando", proximoEnvioEm: retomada, motivoFim: null, leaseToken: null, leaseAte: null, updatedAt: new Date() })
      .where(and(eq(campanhasWhatsappInscricoes.id, row.id), eq(campanhasWhatsappInscricoes.status, "enviando"), eq(campanhasWhatsappInscricoes.leaseToken, row.lease_token)));
    await completarLease(row.lease_token, new Date(Date.now() + 60_000));
    return { enviou: false, semFila: false, proximoDelaySegundos: 60, inscricaoId: row.id };
  }

  // A resposta inbound/opt-out pode chegar enquanto a elegibilidade ERP é revalidada.
  // Releia o lease imediatamente antes da chamada externa para fechar esse intervalo de corrida.
  const [estadoAntesDoEnvio] = await db.select({
    status: campanhasWhatsappInscricoes.status,
    leaseToken: campanhasWhatsappInscricoes.leaseToken,
  }).from(campanhasWhatsappInscricoes)
    .where(eq(campanhasWhatsappInscricoes.id, row.id)).limit(1);
  const [optoutAntesDoEnvio] = await db.select({ id: campanhasWhatsappOptout.id })
    .from(campanhasWhatsappOptout).where(eq(campanhasWhatsappOptout.telefone, telefone)).limit(1);
  if (estadoAntesDoEnvio?.status !== "enviando" || estadoAntesDoEnvio.leaseToken !== row.lease_token || optoutAntesDoEnvio) {
    if (optoutAntesDoEnvio) {
      await db.update(campanhasWhatsappInscricoes).set({ status: "opt_out", proximoEnvioEm: null, motivoFim: "opt_out_global", leaseToken: null, leaseAte: null, updatedAt: new Date() })
        .where(and(eq(campanhasWhatsappInscricoes.id, row.id), eq(campanhasWhatsappInscricoes.status, "enviando"), eq(campanhasWhatsappInscricoes.leaseToken, row.lease_token)));
    }
    await db.update(campanhasWhatsappCadenciaEnvios).set({ status: "cancelado", erro: "Inscrição pausada, removida ou bloqueada antes da chamada WTS.", updatedAt: new Date() })
      .where(and(eq(campanhasWhatsappCadenciaEnvios.id, envio.id), eq(campanhasWhatsappCadenciaEnvios.status, "enviando")));
    await completarLease(row.lease_token, null);
    return { enviou: false, semFila: false, proximoDelaySegundos: 1, inscricaoId: row.id };
  }

  const etapa = (row.snapshot_etapas as EtapaSnapshot[])[row.etapa_atual - 1];
  const resultado = await enviarTemplateWtsSeguro(row.telefone_e164, etapa.templateId);
  const agora = new Date();
  const delayMin = Math.max(3, row.intervalo_minimo_segundos);
  const delayMax = Math.max(delayMin, row.intervalo_maximo_segundos);
  const proximoDelaySegundos = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
  if (resultado.ok) {
    const idMensagem = idMensagemWts(resultado.resposta);
    if (!idMensagem) {
      await db.update(campanhasWhatsappCadenciaEnvios).set({ status: "pendente_conciliacao", respostaProvedor: resultado.resposta ?? null, erro: "API aceitou a requisição sem devolver um ID de mensagem conciliável.", aceitoEm: agora, updatedAt: agora }).where(eq(campanhasWhatsappCadenciaEnvios.id, envio.id));
      await db.update(campanhasWhatsappInscricoes).set({ status: "pendente_conciliacao", proximoEnvioEm: null, motivoFim: "aceite_sem_id_provedor", ultimoEnvioAceitoEm: agora, leaseToken: null, leaseAte: null, updatedAt: agora })
        .where(and(eq(campanhasWhatsappInscricoes.id, row.id), eq(campanhasWhatsappInscricoes.status, "enviando"), eq(campanhasWhatsappInscricoes.leaseToken, row.lease_token)));
      await completarLease(row.lease_token, proximoHorarioEntreDisparos(agora, proximoDelaySegundos));
      return { enviou: true, conciliacao: true, proximoDelaySegundos, inscricaoId: row.id };
    }
    await db.update(campanhasWhatsappCadenciaEnvios).set({ status: "aceito", idMensagemExterno: idMensagem, respostaProvedor: resultado.resposta ?? null, aceitoEm: agora, updatedAt: agora }).where(eq(campanhasWhatsappCadenciaEnvios.id, envio.id));
    await db.update(campanhasWhatsappInscricoes).set({ status: "pendente_conciliacao", proximoEnvioEm: null, motivoFim: "aguardando_confirmacao_entrega_wts", ultimoEnvioAceitoEm: agora, leaseToken: null, leaseAte: null, updatedAt: agora })
      .where(and(eq(campanhasWhatsappInscricoes.id, row.id), eq(campanhasWhatsappInscricoes.status, "enviando"), eq(campanhasWhatsappInscricoes.leaseToken, row.lease_token)));
    const [disparo] = await db.insert(campanhasWhatsappDisparos).values({
      campanhaId: row.campanha_id,
      enviadoEm: hojeCampoGrande(agora),
      contatosRecebidos: 1,
      contatosEnviados: 1,
      contatosIgnorados: 0,
      contatosInvalidos: 0,
      origem: "api",
      observacoes: `Engine de cadência — etapa ${row.etapa_atual}, versão ${row.versao_etapas}; template ${etapa.templateId}; mensagem ${idMensagem}`,
      registradoPor: "engine-cadencia",
      createdAt: agora,
    }).returning({ id: campanhasWhatsappDisparos.id });
    await atualizarQuarentenaEHistorico(db, row, agora, disparo.id);
    await completarLease(row.lease_token, proximoHorarioEntreDisparos(agora, proximoDelaySegundos));
    await processarEventosPendentes(idMensagem);
    return { enviou: true, proximoDelaySegundos, inscricaoId: row.id };
  }

  const status = resultado.incerto ? "pendente_conciliacao" : "falhou";
  await db.update(campanhasWhatsappCadenciaEnvios).set({ status, respostaProvedor: resultado.resposta ?? null, erro: resultado.erro ?? "Falha sem detalhe do provedor.", updatedAt: agora }).where(eq(campanhasWhatsappCadenciaEnvios.id, envio.id));
  await db.update(campanhasWhatsappInscricoes).set({
    status: resultado.incerto ? "pendente_conciliacao" : "cancelada",
    proximoEnvioEm: null,
    motivoFim: resultado.incerto ? "resultado_provedor_incerto" : "falha_confirmada_sem_retry_automatico",
    leaseToken: null,
    leaseAte: null,
    updatedAt: agora,
  }).where(and(eq(campanhasWhatsappInscricoes.id, row.id), eq(campanhasWhatsappInscricoes.status, "enviando"), eq(campanhasWhatsappInscricoes.leaseToken, row.lease_token)));
  await completarLease(row.lease_token, proximoHorarioEntreDisparos(agora, proximoDelaySegundos));
  return { enviou: false, conciliacao: !!resultado.incerto, proximoDelaySegundos, inscricaoId: row.id };
}

export async function listarInscricoesDaCampanha(campanhaId: number, limite = 100) {
  const db = await getDb();
  if (!db) return { resumo: [], itens: [] };
  const resumo = await db.select({ status: campanhasWhatsappInscricoes.status, total: sql<number>`count(*)::int` })
    .from(campanhasWhatsappInscricoes).where(eq(campanhasWhatsappInscricoes.campanhaId, campanhaId))
    .groupBy(campanhasWhatsappInscricoes.status);
  const itens = await db.select().from(campanhasWhatsappInscricoes)
    .where(eq(campanhasWhatsappInscricoes.campanhaId, campanhaId))
    .orderBy(desc(campanhasWhatsappInscricoes.updatedAt)).limit(Math.min(Math.max(limite, 1), 500));
  return { resumo, itens };
}

export async function conciliarEnvioCadencia(
  envioId: number,
  decisao: "entregue" | "falhou"
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const [envio] = await db.select().from(campanhasWhatsappCadenciaEnvios).where(eq(campanhasWhatsappCadenciaEnvios.id, envioId)).limit(1);
  if (!envio || !["pendente_conciliacao", "aceito"].includes(envio.status)) throw new Error("Envio não está aguardando conciliação.");
  if (decisao === "entregue") {
    await db.update(campanhasWhatsappCadenciaEnvios).set({ status: "entregue", entregueEm: new Date(), erro: "Conciliação manual por administrador.", updatedAt: new Date() }).where(eq(campanhasWhatsappCadenciaEnvios.id, envio.id));
    const [inscricao] = await db.select().from(campanhasWhatsappInscricoes).where(eq(campanhasWhatsappInscricoes.id, envio.inscricaoId)).limit(1);
    if (!inscricao || inscricao.status !== "pendente_conciliacao" || inscricao.etapaAtual !== envio.etapa) return;
    const seguinte = (inscricao.snapshotEtapas as EtapaSnapshot[])[envio.etapa];
    if (!seguinte) {
      await db.update(campanhasWhatsappInscricoes).set({ status: "concluida", proximoEnvioEm: null, motivoFim: "concluida_apos_conciliacao_manual", leaseToken: null, leaseAte: null, updatedAt: new Date() })
        .where(and(eq(campanhasWhatsappInscricoes.id, inscricao.id), eq(campanhasWhatsappInscricoes.status, "pendente_conciliacao")));
    } else {
      const base = envio.aceitoEm ?? new Date();
      await db.update(campanhasWhatsappInscricoes).set({ status: "aguardando", etapaAtual: seguinte.numero, proximoEnvioEm: proximoHorarioUtil(base, seguinte.atrasoDiasUteis), motivoFim: null, leaseToken: null, leaseAte: null, updatedAt: new Date() })
        .where(and(eq(campanhasWhatsappInscricoes.id, inscricao.id), eq(campanhasWhatsappInscricoes.status, "pendente_conciliacao")));
    }
  } else {
    await db.update(campanhasWhatsappCadenciaEnvios).set({ status: "falhou", erro: "Falha confirmada manualmente; sem retry automático.", updatedAt: new Date() }).where(eq(campanhasWhatsappCadenciaEnvios.id, envio.id));
    await db.update(campanhasWhatsappInscricoes).set({ status: "cancelada", proximoEnvioEm: null, motivoFim: "falha_confirmada_manualmente", leaseToken: null, leaseAte: null, updatedAt: new Date() })
      .where(and(eq(campanhasWhatsappInscricoes.id, envio.inscricaoId), eq(campanhasWhatsappInscricoes.status, "pendente_conciliacao")));
  }
}

export async function pausarInscricoesPorResposta(telefone: string, quando = new Date()): Promise<number> {
  const e164 = telefoneParaE164(telefone);
  if (!e164) return 0;
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.update(campanhasWhatsappInscricoes).set({
    status: "pausado_por_resposta",
    ultimaRespostaEm: quando,
    proximoEnvioEm: null,
    motivoFim: "resposta_recebida_atendimento_humano",
    leaseToken: null,
    leaseAte: null,
    updatedAt: quando,
  }).where(and(eq(campanhasWhatsappInscricoes.telefoneE164, e164), inArray(campanhasWhatsappInscricoes.status, ["aguardando", "enviando", "pendente_conciliacao"]))).returning({ id: campanhasWhatsappInscricoes.id });
  return rows.length;
}

export { detectarPedidoOptOut };

export async function registrarOptOutInbound(telefone: string, nome: string | null, texto: string, mensagemId: string | null, quando = new Date()): Promise<boolean> {
  const digits = normalizarTelefone(telefone);
  const e164 = telefoneParaE164(telefone);
  if (!digits || !e164) return false;
  const db = await getDb();
  if (!db) return false;
  const [inserted] = await db.insert(campanhasWhatsappOptout).values({
    telefone: digits,
    nome: nome?.slice(0, 200) ?? null,
    motivo: "Opt-out solicitado no WhatsApp.",
    registradoPor: "webhook-whatsapp",
    origem: "inbound",
    mensagemIdExterno: mensagemId,
    mensagemOrigem: texto.slice(0, 4000),
    createdAt: quando,
  }).onConflictDoNothing().returning({ id: campanhasWhatsappOptout.id });
  await db.update(campanhasWhatsappInscricoes).set({ status: "opt_out", proximoEnvioEm: null, ultimaRespostaEm: quando, motivoFim: "opt_out_inbound", leaseToken: null, leaseAte: null, updatedAt: quando })
    .where(and(eq(campanhasWhatsappInscricoes.telefoneE164, e164), inArray(campanhasWhatsappInscricoes.status, [...ESTADOS_ATIVOS])));
  return !!inserted;
}

\n