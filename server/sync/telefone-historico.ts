/**
 * Preenchimento do telefone em `historico_os` (coluna criada na migration 0037, ver
 * server/routers/guiaFornecedores.ts).
 *
 * O cron diário (scheduled-sync-historico.ts) só grava telefone dali pra frente, no mês
 * corrente e no anterior; as O.S. antigas já gravadas ficam com telefone NULL até serem
 * completadas aqui. Usado pelo botão "Completar telefones" da aba interna do Guia de
 * Fornecedores (roda dentro da Vercel, onde a credencial do banco existe) e pelo script
 * server/scripts/backfill-telefone-historico.ts.
 *
 * Uma janela de 7 dias por chamada, sequencial: cabe folgado no maxDuration de 60s da Vercel
 * e não estoura a API do MubiSys — rajadas de janelas em paralelo geraram timeouts em cadeia
 * em 21/09/2026. Idempotente: só grava onde telefone ainda é NULL.
 */
import { getPool } from "../db/db-connection";
import { getDb } from "../db/db";
import { and, asc, count, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { historicoOrcamentos } from "../../drizzle/schema";
import { listarOSMubiSys, listarOrcamentosMubiSys, buscarClientePorId } from "../integrations/mubisys-client";
import { fatiarEmJanelas, DIAS_POR_JANELA } from "./scheduled-sync-historico";
import { normalizarTelefone, semNumeroDeTelefone } from "../../shared/campanhas-whatsapp";

const pad = (n: number) => String(n).padStart(2, "0");
const JANELA_DIAS = 7;
// 24 meses (era 13 até 28/09/2026) — aumentado a pedido do usuário: as fontes ERP de Campanhas
// WhatsApp ("Inativos 6+ meses", "Compraram 1 vez e sumiram") pegam clientes sem limite superior
// de "há quanto tempo", diferente do uso original deste backfill (Guia de Fornecedores, que só
// olha a janela rolante de 12 meses) — 13 meses deixava de fora boa parte dos casos mais antigos.
export const MESES_BACKFILL_PADRAO = 24;

export interface JanelaBackfill { di: string; df: string }
export interface MesBackfill {
  mes: number; ano: number; total: number; pendentes: number;
  /** false quando só sobrou um resto pequeno — O.S. cujo contato a MubiSys nunca teve; buscar
   * de novo só gastaria chamadas lentas à toa. */
  precisa: boolean;
  janelas: JanelaBackfill[];
}

export function primeiroTelefone(os: any): string {
  const contatos: any[] = Array.isArray(os?.cliente_contato) ? os.cliente_contato : [];
  const numeroDe = (c: any) => c?.celular || c?.telefone || c?.fone || "";
  const ativo = (c: any) => String(c?.status ?? "").toLowerCase() !== "inativo";
  const escolhido = contatos.find(c => numeroDe(c) && ativo(c)) ?? contatos.find(c => numeroDe(c));
  return numeroDe(escolhido);
}

export function primeiroTelefoneCliente(cliente: any): string {
  return cliente?.celular || cliente?.telefone_pri || cliente?.telefone_sec || "";
}

export function fatiarMesEmJanelas(mes: number, ano: number, hoje: Date = new Date()): JanelaBackfill[] {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fimMes = (ano === hoje.getFullYear() && mes === hoje.getMonth() + 1) ? hoje.getDate() : ultimoDia;
  const janelas: JanelaBackfill[] = [];
  for (let dia = 1; dia <= fimMes; dia += JANELA_DIAS) {
    const fim = Math.min(dia + JANELA_DIAS - 1, fimMes);
    janelas.push({ di: `${ano}-${pad(mes)}-${pad(dia)}`, df: `${ano}-${pad(mes)}-${pad(fim)}` });
  }
  return janelas;
}

/** Meses (do mais recente ao mais antigo) com a contagem de O.S. sem telefone e as janelas
 * de 7 dias que cobririam cada um. */
export async function planoBackfillTelefone(totalMeses = MESES_BACKFILL_PADRAO, hoje: Date = new Date()): Promise<MesBackfill[]> {
  const chaveAtual = hoje.getFullYear() * 12 + hoje.getMonth() + 1;
  const chaveInicial = chaveAtual - (totalMeses - 1);
  const { rows } = await getPool().query(
    `SELECT mes, ano, count(*)::int AS total, (count(*) FILTER (WHERE telefone IS NULL))::int AS pendentes
       FROM historico_os WHERE (ano * 12 + mes) BETWEEN $1 AND $2 GROUP BY mes, ano`,
    [chaveInicial, chaveAtual],
  );
  const porMes = new Map<number, { total: number; pendentes: number }>(rows.map((r: any) => [r.ano * 12 + r.mes, { total: r.total, pendentes: r.pendentes }]));

  const plano: MesBackfill[] = [];
  for (let i = 0; i < totalMeses; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mes = d.getMonth() + 1, ano = d.getFullYear();
    const dados = porMes.get(ano * 12 + mes) ?? { total: 0, pendentes: 0 };
    const precisa = dados.pendentes > Math.max(5, Math.round(dados.total * 0.05));
    plano.push({ mes, ano, ...dados, precisa, janelas: fatiarMesEmJanelas(mes, ano, hoje) });
  }
  return plano;
}

/** Número da O.S. -> telefone, para uma janela de datas de aprovação. */
export async function buscarTelefonesDaJanela(j: JanelaBackfill): Promise<Map<string, string>> {
  const { itens } = await listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial: j.di, datafinal: j.df });
  const mapa = new Map<string, string>();
  for (const os of itens) {
    const numero = String((os as any).sequencial_ordem ?? (os as any).id ?? "");
    const tel = primeiroTelefone(os);
    if (numero && tel) mapa.set(numero, tel);
  }
  return mapa;
}

/** Grava os telefones num único UPDATE; devolve quantas linhas foram alteradas. */
export async function gravarTelefones(mapa: Map<string, string>): Promise<number> {
  if (mapa.size === 0) return 0;
  const numeros = [...mapa.keys()];
  const telefones = numeros.map(n => mapa.get(n)!);
  const r = await getPool().query(
    `UPDATE historico_os h SET telefone = v.tel
       FROM unnest($1::text[], $2::text[]) AS v(os, tel)
      WHERE h."osNumero" = v.os AND h.telefone IS NULL`,
    [numeros, telefones],
  );
  return r.rowCount ?? 0;
}

export async function completarTelefonesJanela(j: JanelaBackfill): Promise<{ encontrados: number; atualizadas: number }> {
  const mapa = await buscarTelefonesDaJanela(j);
  const atualizadas = await gravarTelefones(mapa);
  return { encontrados: mapa.size, atualizadas };
}

/** Só aceita janelas curtas e recentes — a procedure é chamada do navegador. */
export function janelaValida(
  j: JanelaBackfill,
  hoje: Date = new Date(),
  totalMeses = MESES_BACKFILL_PADRAO,
): boolean {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(j.di) || !re.test(j.df)) return false;
  const di = new Date(`${j.di}T00:00:00`), df = new Date(`${j.df}T00:00:00`);
  if (Number.isNaN(di.getTime()) || Number.isNaN(df.getTime()) || df < di) return false;
  const dias = (df.getTime() - di.getTime()) / 86_400_000;
  if (dias > JANELA_DIAS) return false;
  const limiteAntigo = new Date(hoje.getFullYear(), hoje.getMonth() - totalMeses, 1);
  return di >= limiteAntigo && df <= new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
}

// ─── Orçamentos ─────────────────────────────────────────────────────────────────────────────────────
// historico_orcamentos não guardava telefone nem o id do cliente. Dois passos, ambos idempotentes:
//  1) gravar `clienteId` — a sync já grava dali pra frente; os meses antigos precisam reler a listagem de
//     orçamentos (cara: ~26s por janela de 2 dias), por isso o navegador dirige uma janela por chamada;
//  2) resolver o telefone por cliente DISTINTO (GET /cliente/{id}), em lotes pequenos — muito menos chamadas que
//     uma por orçamento, e o resultado vale para todos os orçamentos do cliente.
// `telefone = ''` significa "consultado, cadastro sem número válido" (não consulta de novo); NULL = ainda não consultado.

// Até 12 clientes por chamada, em ondas de 4. buscarClientePorId tem timeout de 10s;
// sem retries, o pior caso nominal fica perto de 30s, deixando margem para banco e serialização.
const LOTE_CLIENTES_PADRAO = 12;
const LOTE_CLIENTES_MAXIMO = 12;
const CONCORRENCIA_CLIENTES = 4;

export interface MesOrcamentoSemCliente {
  mes: number; ano: number; total: number; pendentes: number; janelas: JanelaBackfill[];
}

export class ErroConsultaMubiSysBackfill extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroConsultaMubiSysBackfill";
  }
}

/** Meses (do mais recente ao mais antigo) com orçamentos sem `clienteId`, cada um com suas janelas de 2 dias. */
export async function planoClienteIdOrcamentos(totalMeses = MESES_BACKFILL_PADRAO, hoje: Date = new Date()): Promise<MesOrcamentoSemCliente[]> {
  const chaveAtual = hoje.getFullYear() * 12 + hoje.getMonth() + 1;
  const { rows } = await getPool().query(
    `SELECT mes, ano, count(*)::int AS total, (count(*) FILTER (WHERE "clienteId" IS NULL))::int AS pendentes
       FROM historico_orcamentos WHERE (ano * 12 + mes) BETWEEN $1 AND $2 GROUP BY mes, ano`,
    [chaveAtual - (totalMeses - 1), chaveAtual],
  );
  return rows
    .filter((r: any) => r.pendentes > Math.max(5, Math.round(r.total * 0.05)))
    .sort((a: any, b: any) => b.ano * 12 + b.mes - (a.ano * 12 + a.mes))
    .map((r: any) => {
      const ultimoDia = new Date(r.ano, r.mes, 0).getDate();
      const fim = (r.ano === hoje.getFullYear() && r.mes === hoje.getMonth() + 1) ? hoje.getDate() : ultimoDia;
      return {
        mes: r.mes, ano: r.ano, total: r.total, pendentes: r.pendentes,
        janelas: fatiarEmJanelas(`${r.ano}-${pad(r.mes)}-01`, `${r.ano}-${pad(r.mes)}-${pad(fim)}`, DIAS_POR_JANELA),
      };
    });
}

/** Lê UMA janela da listagem de orçamentos e grava o `clienteId` onde falta. Lança se a API falhar. */
export async function gravarClienteIdOrcamentosJanela(j: JanelaBackfill): Promise<{ listados: number; atualizadas: number }> {
  // A janela é pequena e processada em uma chamada do navegador. Evitamos retry
  // automático aqui: cada página do MubiSys pode levar vários segundos e retries
  // de listagem poderiam ultrapassar o limite de execução da Vercel.
  let itens: Awaited<ReturnType<typeof listarOrcamentosMubiSys>>["itens"];
  try {
    ({ itens } = await listarOrcamentosMubiSys({
      status: "TODOS", datainicial: j.di, datafinal: j.df, perPage: 50,
    }));
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro);
    throw new ErroConsultaMubiSysBackfill(`Falha na consulta de orçamentos ${j.di} a ${j.df}: ${detalhe}`);
  }
  const mapa = new Map<string, number>();
  for (const orc of itens) {
    const numero = String(orc.sequencial_orcamento || orc.id || "");
    if (numero && Number.isInteger(orc.cliente_id) && orc.cliente_id > 0) mapa.set(numero, orc.cliente_id);
  }
  if (mapa.size === 0) return { listados: itens.length, atualizadas: 0 };
  const numeros = [...mapa.keys()];
  const r = await getPool().query(
    `UPDATE historico_orcamentos h SET "clienteId" = v.cid
       FROM unnest($1::text[], $2::int[]) AS v(orc, cid)
      WHERE h."orcNumero" = v.orc AND h."clienteId" IS NULL`,
    [numeros, numeros.map(n => mapa.get(n)!)],
  );
  return { listados: itens.length, atualizadas: r.rowCount ?? 0 };
}

/** Telefone para gravar: o cadastro às vezes tem vários números; a coluna é varchar(32). */
export function telefoneParaGravar(cliente: any): string {
  const bruto = String(primeiroTelefoneCliente(cliente) ?? "").trim();
  if (!bruto || semNumeroDeTelefone(bruto)) return "";
  if (bruto.length <= 32) return bruto;
  return normalizarTelefone(bruto) ?? "";
}

export interface LoteTelefonesOrcamentos {
  consultados: number; comTelefone: number; semTelefone: number; falhas: number; falhasSemClienteId: number; falhasIds: number[];
  atualizadas: number; restantes: number; pagina: number; proximaPagina: number | null; fimAlcancado: boolean;
}

/** Resolve uma página de clientes do histórico. A paginação usa o conjunto estável de clienteIds
 * (sem filtrar telefone na consulta paginada), pois filtrar `telefone IS NULL` faria os offsets
 * mudarem enquanto os registros são preenchidos e poderia pular clientes. Falhas de API ficam NULL
 * para uma nova tentativa e são reportadas sem interromper o restante do lote. */
export async function completarTelefonesClientesOrcamentos(
  pagina = 1,
  limitePorLote = LOTE_CLIENTES_PADRAO,
): Promise<LoteTelefonesOrcamentos> {
  if (!Number.isInteger(pagina) || pagina < 1) throw new Error("A página do backfill deve ser um inteiro positivo.");
  if (!Number.isInteger(limitePorLote) || limitePorLote < 1 || limitePorLote > LOTE_CLIENTES_MAXIMO) {
    throw new Error(`O limite por lote deve estar entre 1 e ${LOTE_CLIENTES_MAXIMO}.`);
  }
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para completar telefones dos orçamentos.");

  const clientesQuery = db.selectDistinctOn([historicoOrcamentos.clienteId], {
    clienteId: historicoOrcamentos.clienteId,
  })
    .from(historicoOrcamentos)
    .where(isNotNull(historicoOrcamentos.clienteId))
    .orderBy(asc(historicoOrcamentos.clienteId))
    .limit(limitePorLote)
    .offset((pagina - 1) * limitePorLote);
  const [clientes, [totalClientesRow], [totalSemClienteRow], semClientePagina] = await Promise.all([
    clientesQuery,
    db.select({ total: sql<number>`count(distinct ${historicoOrcamentos.clienteId})` })
      .from(historicoOrcamentos)
      .where(isNotNull(historicoOrcamentos.clienteId)),
    db.select({ total: count() }).from(historicoOrcamentos)
      .where(and(isNull(historicoOrcamentos.clienteId), isNull(historicoOrcamentos.telefone))),
    db.select({ id: historicoOrcamentos.id, orcNumero: historicoOrcamentos.orcNumero })
      .from(historicoOrcamentos)
      .where(and(isNull(historicoOrcamentos.clienteId), isNull(historicoOrcamentos.telefone)))
      .orderBy(asc(historicoOrcamentos.id))
      .limit(limitePorLote)
      .offset((pagina - 1) * limitePorLote),
  ]);
  const ids: number[] = clientes.flatMap(row => row.clienteId == null ? [] : [row.clienteId]);
  const totalClientes = Number(totalClientesRow?.total ?? 0);
  const totalSemClienteId = Number(totalSemClienteRow?.total ?? 0);
  const fimAlcancado = pagina * limitePorLote >= Math.max(totalClientes, totalSemClienteId);
  const proximaPagina = fimAlcancado ? null : pagina + 1;

  const falhasSemClienteId = semClientePagina.length;
  for (const registro of semClientePagina) {
    console.error(`[TELEFONE-ORC] Orçamento ${registro.orcNumero ?? registro.id} sem clienteId; telefone não pode ser consultado.`);
  }

  if (ids.length === 0) {
    const [restoComCliente] = await db.select({ total: sql<number>`count(distinct ${historicoOrcamentos.clienteId})` })
      .from(historicoOrcamentos)
      .where(and(isNotNull(historicoOrcamentos.clienteId), isNull(historicoOrcamentos.telefone)));
    const [semCliente] = await db.select({ total: count() }).from(historicoOrcamentos)
      .where(and(isNull(historicoOrcamentos.clienteId), isNull(historicoOrcamentos.telefone)));
    return {
      consultados: 0, comTelefone: 0, semTelefone: 0, falhas: falhasSemClienteId,
      falhasSemClienteId, falhasIds: [], atualizadas: 0,
      restantes: Number(restoComCliente?.total ?? 0) + Number(semCliente?.total ?? 0),
      pagina, proximaPagina, fimAlcancado,
    };
  }

  const pendentes = await db.select({ clienteId: historicoOrcamentos.clienteId })
    .from(historicoOrcamentos)
    .where(and(isNull(historicoOrcamentos.telefone), inArray(historicoOrcamentos.clienteId, ids)));
  const idsPendentes = [...new Set(pendentes.flatMap(row => row.clienteId == null ? [] : [row.clienteId]))];
  const resolvidos = new Map<number, string>();
  const falhasIds: number[] = [];
  let falhas = 0;

  for (let i = 0; i < idsPendentes.length; i += CONCORRENCIA_CLIENTES) {
    await Promise.all(idsPendentes.slice(i, i + CONCORRENCIA_CLIENTES).map(async id => {
      try {
        resolvidos.set(id, telefoneParaGravar(await buscarClientePorId(id)));
      } catch (erro: unknown) {
        falhas++;
        falhasIds.push(id);
        console.error(`[TELEFONE-ORC] Falha ao consultar cliente ${id}:`, erro);
      }
    }));
  }

  let atualizadas = 0;
  if (resolvidos.size > 0) {
    const chaves = [...resolvidos.keys()];
    for (const clienteId of chaves) {
      try {
        const gravadas = await db.update(historicoOrcamentos)
          .set({ telefone: resolvidos.get(clienteId)! })
          .where(and(eq(historicoOrcamentos.clienteId, clienteId), isNull(historicoOrcamentos.telefone)))
          .returning({ id: historicoOrcamentos.id });
        atualizadas += gravadas.length;
      } catch (erro: unknown) {
        falhas++;
        falhasIds.push(clienteId);
        resolvidos.delete(clienteId);
        console.error(`[TELEFONE-ORC] Falha ao gravar telefone dos orçamentos do cliente ${clienteId}:`, erro);
      }
    }
  }

  const [resto] = await db.select({ total: sql<number>`count(distinct ${historicoOrcamentos.clienteId})` })
    .from(historicoOrcamentos)
    .where(and(isNotNull(historicoOrcamentos.clienteId), isNull(historicoOrcamentos.telefone)));
  const [semClienteId] = await db.select({ total: count() }).from(historicoOrcamentos)
    .where(and(isNull(historicoOrcamentos.clienteId), isNull(historicoOrcamentos.telefone)));
  const comTelefone = [...resolvidos.values()].filter(t => t !== "").length;
  return {
    consultados: idsPendentes.length, comTelefone, semTelefone: resolvidos.size - comTelefone,
    falhas: falhas + falhasSemClienteId, falhasSemClienteId, atualizadas,
    falhasIds,
    restantes: Number(resto?.total ?? 0) + Number(semClienteId?.total ?? 0),
    pagina, proximaPagina, fimAlcancado,
  };
}
