/**
 * Relatório combinado de monitoramento comercial + uso do CRM, consumido
 * tanto pela tela manual (server/routers/crm.ts → getRelatorioMonitoramento)
 * quanto pelos crons de e-mail diário/semanal (server/sync/scheduled-relatorio-crm-*).
 *
 * Duas partes:
 * 1. "comercial" — números do MubiSys no período (enviadas, fechamentos,
 *    valor faturado, propostas de clientes novos, taxa de conversão) e a
 *    comparação desse período com os demais do mês (ranking + % vs. média).
 * 2. "usoCrm" — por vendedor, quantas vezes usou o CRM no período (cliques
 *    nos quadradinhos das faixas = "registrarContato", propostas marcadas
 *    ganha/perdida) e quem ficou com atividade zero.
 */
import { sql, and, eq, inArray, gte, lte, desc } from "drizzle-orm";
import { getDb } from "../db/db";
import { crmAtividadeLog, historicoOs, clienteOverrides, inteligenciaAcoesClientes } from "../../drizzle/schema";
import { buscarOrcamentosPeriodo } from "../routers/crm";
import {
  getCrmAbertosCache, refreshCrmAbertosCache, refreshCrmFechadosCache,
  CACHE_KEY_ABERTOS_PADRAO, CACHE_KEY_FECHADOS, JANELA_ABERTOS_DIAS_PADRAO,
} from "../sync/crm-abertos-cache";

// Mesmos tipos de "cliente parado" que a aba Sugestões de Contato do CRM usa
// (ver server/routers/crm.ts, getSugestoesContato) — uma única fila, duas
// visualizações (tela + e-mail).
const TIPOS_REENGAJAMENTO: Array<"atraso_recompra" | "primeira_sem_segunda"> = ["atraso_recompra", "primeira_sem_segunda"];

const STATUS_FECHADO = new Set(["aprovado", "faturado", "concluido", "concluído"]);

function fmtDateISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dentroDoPeriodo(dataStr: string | null | undefined, di: string, df: string): boolean {
  if (!dataStr) return false;
  const dia = dataStr.slice(0, 10);
  return dia >= di && dia <= df;
}

function isFechado(o: any): boolean {
  return STATUS_FECHADO.has((o.status || "").toLowerCase());
}

// ─── Fonte única "todos os orçamentos dos últimos 45 dias" (qualquer status) ──
// Mesmo cache que buscarOrcamentosPeriodo usa por baixo (ver crm.ts) — mas aqui
// buscamos o array bruto pra poder filtrar tanto por data_cadastro (enviadas)
// quanto por data_aprovacao (fechamentos), coisa que buscarOrcamentosPeriodo
// não permite (ele só filtra por data_cadastro).
async function buscarTodosOrcamentos45d(): Promise<any[]> {
  const cacheHit = await getCrmAbertosCache(CACHE_KEY_FECHADOS);
  return cacheHit ? cacheHit.itens : await refreshCrmFechadosCache();
}

// ─── Classificação "cliente novo" (mesma regra de getPropostas em crm.ts) ────
async function construirClientesComCompra(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const clientesComCompra = new Set<string>();
  const overrideMap = new Map<string, "recorrente" | "novo">();
  try {
    const osEntregues = await db.select({ empresa: historicoOs.empresa }).from(historicoOs);
    for (const row of osEntregues) {
      const nome = (row.empresa ?? "").trim();
      if (nome) clientesComCompra.add(nome.toLowerCase());
    }
    const overrides = await db.select().from(clienteOverrides);
    for (const ov of overrides) overrideMap.set(ov.empresa, ov.status);
  } catch {
    // se falhar, ninguém é marcado como novo (evita falso positivo)
  }
  return { clientesComCompra, overrideMap };
}

function nomeClienteDoOrcamento(o: any): string {
  const clienteRaw = o.cliente;
  const empresaRaw = o.empresa;
  const nome = typeof clienteRaw === "object" && clienteRaw !== null
    ? (clienteRaw as any)?.nome ?? (clienteRaw as any)?.razao_social ?? String(clienteRaw)
    : String(clienteRaw ?? empresaRaw ?? "");
  return nome;
}

function isClienteNovo(
  o: any,
  clientesComCompra: Set<string>,
  overrideMap: Map<string, "recorrente" | "novo">,
): boolean {
  const clienteKey = nomeClienteDoOrcamento(o).toLowerCase().trim();
  const overrideStatus = overrideMap.get(clienteKey);
  if (overrideStatus === "recorrente") return false;
  if (overrideStatus === "novo") return true;
  return clientesComCompra.size > 0 && !clientesComCompra.has(clienteKey);
}

// ─── Comparação de um valor contra os demais "baldes" (dias ou semanas) do mês ─
interface Comparativo {
  valorPeriodo: number;
  mediaPeriodo: number;
  percentualVsMedia: number | null;
  posicaoRanking: number;
  totalComparados: number;
}
function compararComBaldes(valorPeriodo: number, baldes: number[]): Comparativo {
  const totalComparados = baldes.length;
  const soma = baldes.reduce((s, v) => s + v, 0);
  const mediaPeriodo = totalComparados > 0 ? soma / totalComparados : 0;
  const percentualVsMedia = mediaPeriodo > 0 ? ((valorPeriodo - mediaPeriodo) / mediaPeriodo) * 100 : null;
  const ordenado = [...baldes].sort((a, b) => b - a);
  const posicaoRanking = ordenado.findIndex(v => v <= valorPeriodo) + 1 || totalComparados;
  return { valorPeriodo, mediaPeriodo, percentualVsMedia, posicaoRanking, totalComparados };
}

export interface RelatorioComercialCrm {
  periodo: { dataInicio: string; dataFim: string; tipo: "dia" | "semana" };
  comercial: {
    propostasEnviadas: number;
    fechamentos: number;
    valorFaturado: number;
    propostasNovosClientes: number;
    taxaConversaoPct: number | null;
    comparativoValorFaturado: Comparativo;
    comparativoPropostasEnviadas: Comparativo;
  };
  usoCrm: {
    vendedores: Array<{
      vendedor: string;
      contatosRegistrados: number;
      ganhas: number;
      perdidas: number;
      diasComAtividade: number;
      totalDias: number;
      semAtividade: boolean;
    }>;
    vendedoresSemAtividade: string[];
  };
  sugestoesContato: {
    pendentesTotal: number;
    contatadasPeriodo: number;
    porVendedor: Array<{ vendedor: string; pendentes: number; contatadasPeriodo: number }>;
    topPendentes: Array<{ empresa: string; vendedor: string | null; score: number; motivo: string }>;
  };
}

/**
 * Gera o relatório combinado (comercial + uso do CRM) para o período
 * [dataInicio, dataFim] (strings "YYYY-MM-DD", inclusivas). `tipo` só decide
 * como os "baldes" de comparação do mês são agrupados: por dia ou por
 * blocos de 7 dias a partir do início do mês.
 */
export async function gerarRelatorioComercialCrm(
  dataInicio: string,
  dataFim: string,
  tipo: "dia" | "semana",
): Promise<RelatorioComercialCrm> {
  const db = (await getDb())!;

  // ── Parte comercial (MubiSys, via cache de 45 dias) ─────────────────────────
  const todos45d = await buscarTodosOrcamentos45d();
  const { clientesComCompra, overrideMap } = await construirClientesComCompra(db);

  const enviadasPeriodo = todos45d.filter((o: any) => dentroDoPeriodo(o.data_cadastro, dataInicio, dataFim));
  const fechamentosPeriodo = todos45d.filter((o: any) =>
    isFechado(o) && dentroDoPeriodo(o.data_aprovacao, dataInicio, dataFim));
  const valorFaturado = fechamentosPeriodo.reduce((s: number, o: any) => s + parseFloat(o.valor_total ?? "0"), 0);
  const propostasNovosClientes = enviadasPeriodo.filter((o: any) => isClienteNovo(o, clientesComCompra, overrideMap)).length;
  const taxaConversaoPct = enviadasPeriodo.length > 0 ? (fechamentosPeriodo.length / enviadasPeriodo.length) * 100 : null;

  // ── Comparação com o restante do mês ────────────────────────────────────────
  // Balde = 1 dia (relatório diário) ou blocos sequenciais de 7 dias a partir
  // do dia 1 (relatório semanal) — não é semana ISO, é só pra dar uma régua de
  // comparação dentro do mês, sem pretensão de exatidão calendárica.
  const refDate = new Date(dataFim + "T12:00:00");
  const inicioMes = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-01`;
  const diasDoMesAteAqui: string[] = [];
  {
    const cursor = new Date(inicioMes + "T12:00:00");
    const fimCursor = new Date(dataFim + "T12:00:00");
    while (cursor <= fimCursor) {
      diasDoMesAteAqui.push(fmtDateISO(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const valorPorDia = new Map<string, number>();
  const enviadasPorDia = new Map<string, number>();
  for (const dia of diasDoMesAteAqui) { valorPorDia.set(dia, 0); enviadasPorDia.set(dia, 0); }
  for (const o of todos45d) {
    const diaCadastro = (o.data_cadastro || "").slice(0, 10);
    if (enviadasPorDia.has(diaCadastro)) enviadasPorDia.set(diaCadastro, (enviadasPorDia.get(diaCadastro) ?? 0) + 1);
    if (isFechado(o)) {
      const diaAprovacao = (o.data_aprovacao || "").slice(0, 10);
      if (valorPorDia.has(diaAprovacao)) {
        valorPorDia.set(diaAprovacao, (valorPorDia.get(diaAprovacao) ?? 0) + parseFloat(o.valor_total ?? "0"));
      }
    }
  }

  let baldesValor: number[];
  let baldesEnviadas: number[];
  if (tipo === "dia") {
    baldesValor = diasDoMesAteAqui.map(d => valorPorDia.get(d) ?? 0);
    baldesEnviadas = diasDoMesAteAqui.map(d => enviadasPorDia.get(d) ?? 0);
  } else {
    baldesValor = [];
    baldesEnviadas = [];
    for (let i = 0; i < diasDoMesAteAqui.length; i += 7) {
      const fatia = diasDoMesAteAqui.slice(i, i + 7);
      baldesValor.push(fatia.reduce((s, d) => s + (valorPorDia.get(d) ?? 0), 0));
      baldesEnviadas.push(fatia.reduce((s, d) => s + (enviadasPorDia.get(d) ?? 0), 0));
    }
  }

  const comparativoValorFaturado = compararComBaldes(valorFaturado, baldesValor);
  const comparativoPropostasEnviadas = compararComBaldes(enviadasPeriodo.length, baldesEnviadas);

  // ── Parte "uso do CRM" (log de atividade local) ─────────────────────────────
  // 00:00 Brasília = 03:00 UTC; 23:59:59.999 Brasília = 02:59:59.999 UTC do dia
  // seguinte. NUNCA usar a string "T26:59:59.999Z" pra representar isso — V8
  // trata hora > 23 num literal ISO com "Z" como Invalid Date (testado
  // 14/09/2026; esse padrão aparece em getAuditoria/getLogDia em crm.ts e
  // também está quebrado lá, fora do escopo desta mudança).
  const inicioDt = new Date(dataInicio + "T03:00:00.000Z");
  const fimDt = new Date(new Date(dataFim + "T03:00:00.000Z").getTime() + 24 * 60 * 60 * 1000 - 1);

  return await montarRelatorioUsoCrm({
    db, inicioDt, fimDt, dataInicio, dataFim, tipo,
    enviadasPeriodo,
    comercial: {
      propostasEnviadas: enviadasPeriodo.length,
      fechamentos: fechamentosPeriodo.length,
      valorFaturado,
      propostasNovosClientes,
      taxaConversaoPct,
      comparativoValorFaturado,
      comparativoPropostasEnviadas,
    },
  });
}

async function montarRelatorioUsoCrm(opts: {
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  inicioDt: Date; fimDt: Date;
  dataInicio: string; dataFim: string; tipo: "dia" | "semana";
  enviadasPeriodo: any[];
  comercial: RelatorioComercialCrm["comercial"];
}): Promise<RelatorioComercialCrm> {
  const { db, inicioDt, fimDt, dataInicio, dataFim, tipo, enviadasPeriodo, comercial } = opts;

  const logs = await db.select().from(crmAtividadeLog).where(
    sql`${crmAtividadeLog.realizadaEm} >= ${inicioDt} AND ${crmAtividadeLog.realizadaEm} <= ${fimDt}`,
  );

  // Vendedores esperados no período: quem apareceu no log OU quem teve
  // propostas criadas no período OU quem tem proposta em aberto agora — pra
  // não deixar de fora quem ficou 100% quieto (o log sozinho nunca detectaria isso).
  const abertosCache = await getCrmAbertosCache(CACHE_KEY_ABERTOS_PADRAO);
  const abertosAgora = abertosCache ? abertosCache.itens : await refreshCrmAbertosCache(CACHE_KEY_ABERTOS_PADRAO, JANELA_ABERTOS_DIAS_PADRAO);
  const abertosStatusAberto = abertosAgora.filter((o: any) => {
    const s = (o.status || "").toLowerCase();
    return s === "em aberto" || s === "em andamento" || s === "pendente";
  });

  const vendedoresSet = new Set<string>();
  for (const l of logs) if (l.vendedor) vendedoresSet.add(l.vendedor);
  for (const o of enviadasPeriodo) if (o.vendedor) vendedoresSet.add(o.vendedor);
  for (const o of abertosStatusAberto) if (o.vendedor) vendedoresSet.add(o.vendedor);

  const totalDias = Math.round((new Date(dataFim + "T12:00:00").getTime() - new Date(dataInicio + "T12:00:00").getTime()) / 86400000) + 1;

  const vendedores = Array.from(vendedoresSet).sort().map(v => {
    const logsV = logs.filter(l => l.vendedor === v);
    const contatosRegistrados = logsV.filter(l => l.acao === "registrarContato").length;
    const ganhas = logsV.filter(l => l.acao === "marcarGanha").length;
    const perdidas = logsV.filter(l => l.acao === "descartar").length;
    const diasComAtividadeSet = new Set<string>();
    for (const l of logsV) {
      const dt = new Date(l.realizadaEm);
      const dtBrasilia = new Date(dt.getTime() - 3 * 60 * 60 * 1000);
      diasComAtividadeSet.add(fmtDateISO(dtBrasilia));
    }
    return {
      vendedor: v,
      contatosRegistrados,
      ganhas,
      perdidas,
      diasComAtividade: diasComAtividadeSet.size,
      totalDias,
      semAtividade: contatosRegistrados + ganhas + perdidas === 0,
    };
  }).sort((a, b) => (a.contatosRegistrados + a.ganhas + a.perdidas) - (b.contatosRegistrados + b.ganhas + b.perdidas));

  const sugestoesContato = await calcularSugestoesContatoPeriodo(db, inicioDt, fimDt);

  return {
    periodo: { dataInicio, dataFim, tipo },
    comercial,
    usoCrm: {
      vendedores,
      vendedoresSemAtividade: vendedores.filter(v => v.semAtividade).map(v => v.vendedor),
    },
    sugestoesContato,
  };
}

/** Sugestões de Contato (reengajamento de carteira) para o relatório —
 * mesma fila que a aba do CRM usa (ver server/routers/crm.ts,
 * getSugestoesContato). Só LÊ a tabela — não chama sincronizarFilaAcoesClientes
 * aqui porque essa função demora ~2 minutos contra o banco de produção
 * (medido 14/09/2026) e gerarRelatorioComercialCrm também alimenta a tela
 * manual "Monitoramento de Uso do CRM" (troca de dia/semana não pode ficar
 * travada esperando isso). Quem precisa da fila fresca antes de calcular o
 * relatório é o cron (ver server/sync/scheduled-relatorio-crm-diario.ts e
 * ...-semanal.ts, que chamam sincronizarFilaAcoesClientes antes de gerar o
 * relatório — ali sim é aceitável demorar, roda em background 1x/dia). */
async function calcularSugestoesContatoPeriodo(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  inicioDt: Date,
  fimDt: Date,
): Promise<RelatorioComercialCrm["sugestoesContato"]> {
  const pendentes = await db.select().from(inteligenciaAcoesClientes).where(and(
    inArray(inteligenciaAcoesClientes.tipo, TIPOS_REENGAJAMENTO),
    eq(inteligenciaAcoesClientes.status, "pendente"),
  )).orderBy(desc(inteligenciaAcoesClientes.prioridade));

  const contatadas = await db.select().from(inteligenciaAcoesClientes).where(and(
    inArray(inteligenciaAcoesClientes.tipo, TIPOS_REENGAJAMENTO),
    eq(inteligenciaAcoesClientes.status, "concluida"),
    gte(inteligenciaAcoesClientes.resolvidoEm, inicioDt),
    lte(inteligenciaAcoesClientes.resolvidoEm, fimDt),
  ));

  const vendedoresSet = new Set<string>();
  for (const a of pendentes) if (a.vendedor) vendedoresSet.add(a.vendedor);
  for (const a of contatadas) if (a.vendedor) vendedoresSet.add(a.vendedor);
  const porVendedor = Array.from(vendedoresSet).sort().map(v => ({
    vendedor: v,
    pendentes: pendentes.filter(a => a.vendedor === v).length,
    contatadasPeriodo: contatadas.filter(a => a.vendedor === v).length,
  }));

  return {
    pendentesTotal: pendentes.length,
    contatadasPeriodo: contatadas.length,
    porVendedor,
    topPendentes: pendentes.slice(0, 5).map(a => ({ empresa: a.empresa, vendedor: a.vendedor, score: a.prioridade, motivo: a.motivo })),
  };
}
