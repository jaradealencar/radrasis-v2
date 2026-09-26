/**
 * Painel da Meta de Faturamento — mede, a partir de historico_os, os
 * indicadores que formam o faturamento mensal (ver shared/meta-faturamento.ts
 * para a fórmula) e dá a base para simular "o que precisa mudar para chegar
 * na meta".
 *
 * Decisões de método (validadas por backtest em 26/09/2026, ver
 * docs/inteligencia-clientes.md):
 *  - A referência é a MÉDIA DOS ÚLTIMOS 12 MESES FECHADOS. O faturamento
 *    mensal deste negócio oscila muito (R$ 200 mil a R$ 450 mil); prever mês a
 *    mês tem erro de ~17–20% mesmo no melhor método, e métodos "sofisticados"
 *    (sazonalidade sozinha, ajuste por ritmo de aquisição) erraram MAIS (22–26%).
 *  - Classificação novo/reativado é sempre por MÊS (nunca por pedido), a mesma
 *    regra do resto da Performance Comercial: cliente sem compra antes do mês =
 *    novo; última compra anterior há 6+ meses de calendário = reativado.
 *  - Cada cliente-mês cai em exatamente um grupo, então a soma dos 4 grupos é
 *    igual ao faturamento total do mês.
 */

import type { ClienteBase } from "./inteligenciaClientes";
import {
  SEGMENTOS, totaisCenario,
  type Cenario, type SegmentoId,
} from "../../shared/meta-faturamento";

/** Meses de calendário (após a entrada) durante os quais um cliente
 * conquistado ainda conta como "recompra de conquistados" e não como carteira. */
export const MESES_CLIENTE_CONQUISTADO = 12;

export interface MesRealizado {
  mes: string; // "09/2025"
  faturamento: number;
  vendas: number;
  ticketMedio: number;
  /** Clientes distintos que compraram no mês, por grupo. */
  clientes: Record<SegmentoId, number>;
  /** Margem de contribuição do mês (%); null se nenhum pedido trouxe contribuição. */
  margemPct: number | null;
}

export interface ResumoCenario {
  cenario: Cenario;
  faturamento: number;
  vendas: number;
  ticketMedio: number;
}

export interface PainelMeta {
  dataReferencia: string;
  /** false quando não há 12 meses fechados de histórico para medir. */
  dadosSuficientes: boolean;
  /** Últimos 12 meses fechados, em ordem cronológica (exclui o mês corrente). */
  historico: MesRealizado[];
  media12m: ResumoCenario;
  ultimos3m: ResumoCenario;
  /** Dos clientes que entraram (novos ou reativados) num período com pelo menos
   * 3 meses de "tempo para voltar", % que comprou de novo. */
  recompra: { taxaPct: number | null; clientesAnalisados: number; periodo: string };
  /** Os 12 meses fechados imediatamente anteriores aos de `media12m` — base para medir crescimento. */
  anoAnterior12m: ResumoCenario;
  /** Margem de contribuição (contribuição ÷ faturamento dos pedidos que informam contribuição).
   * O mês fechado mais recente fica de fora: os custos das OS recentes ainda estão sendo
   * lançados no ERP e derrubam a margem artificialmente (ex.: 29% num mês em que o normal é 55%). */
  margem: {
    media12mPct: number | null;
    ultimos3mPct: number | null;
    /** 12 meses anteriores (mesma janela deslocada em 12 meses) — base para medir a elevação da margem. */
    anoAnteriorPct: number | null;
    /** Rótulo da janela usada em media12mPct (ex.: "08/2025 a 07/2026"). */
    periodo: string;
  };
  /** Vida de um parceiro novo: quantos ainda compram a cada mês depois da 1ª compra e quanto rendem. */
  coorte: {
    parceirosAnalisados: number;
    /** Meses de entrada das coortes consideradas (ex.: "06/2024 a 08/2026"). */
    periodo: string;
    /** k = meses desde a 1ª compra (0 = mês da entrada). */
    meses: Array<{ k: number; elegiveis: number; ativosPct: number | null; receitaPorParceiro: number | null }>;
    /** Receita média por parceiro novo nos primeiros 12 meses (soma dos k = 0..11); null com poucos dados. */
    ltv12m: number | null;
    ltvAcumulado: Array<number | null>;
  };
  /** Faixa provável do faturamento mensal, medida pelo erro histórico do método "média dos 12 meses anteriores". */
  bandas: {
    amostras: number;
    /** Variação relativa (P10 e P90 do erro) de um mês isolado em relação à média; ex.: -0.28 / +0.22. */
    mensal: { pessimista: number; otimista: number } | null;
    /** Idem para a MÉDIA dos 12 meses (bootstrap de 12 erros sorteados). */
    media12m: { pessimista: number; otimista: number } | null;
  };
  /** Quanto cada indicador explica da oscilação mensal do faturamento (R² de Pearson, últimos ≤24 meses). */
  correlacoes: { meses: number; itens: Array<{ id: string; rotulo: string; r2Pct: number }> };
  /** Retenção anual: dos clientes que compraram nos 12 meses anteriores aos últimos 12, % que voltou a comprar. */
  retencao: {
    taxaPct: number | null;
    clientesBase: number;
    retidos: number;
    /** Mesma medição um ano antes (para ver a tendência). */
    taxaAnteriorPct: number | null;
    /** Clientes distintos que compraram nos últimos 12 meses. */
    clientesAtivos12m: number;
    periodoBase: string;
    periodoAtual: string;
  };
  /** 12 índices (jan..dez) com média 1 — formato do mês em relação ao normal. */
  sazonalidade: { disponivel: boolean; indices: number[] };
  /** Próximos 12 meses (a partir do mês seguinte ao corrente). */
  projecao: Array<{
    mes: string;
    indiceSazonal: number;
    /** Média do faturamento do mesmo mês nos anos anteriores (até 3 meses fechados); null se não há histórico. */
    mediaMesmoMes: number | null;
    anosConsiderados: number[];
  }>;
  /** Erro médio (em %) ao prever cada um dos últimos 12 meses só com dados anteriores. */
  backtest: { semSazonalidadePct: number | null; comSazonalidadePct: number | null; meses: number };
}

function chaveMes(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

export function rotuloMes(chave: number): string {
  return `${String((chave % 12) + 1).padStart(2, "0")}/${Math.floor(chave / 12)}`;
}

interface AcumMes { clientes: number; pedidos: number; faturamento: number }
type PorMes = Map<number, Record<SegmentoId, AcumMes>>;

function acumuladorVazio(): Record<SegmentoId, AcumMes> {
  return {
    novos: { clientes: 0, pedidos: 0, faturamento: 0 },
    reativados: { clientes: 0, pedidos: 0, faturamento: 0 },
    recompraConquistados: { clientes: 0, pedidos: 0, faturamento: 0 },
    carteira: { clientes: 0, pedidos: 0, faturamento: 0 },
  };
}

interface Entrada { chave: number; voltou: boolean }

interface AcumMargem { faturamento: number; contribuicao: number }

function classificarTodos(base: Map<string, ClienteBase>, mesesInatividadeParaNovo: number): {
  porMes: PorMes;
  entradas: Entrada[];
  margemPorMes: Map<number, AcumMargem>;
  gruposPorCliente: Array<Array<{ chave: number; valor: number }>>;
} {
  const porMes: PorMes = new Map();
  const entradas: Entrada[] = [];
  const margemPorMes = new Map<number, AcumMargem>();
  const gruposPorCliente: Array<Array<{ chave: number; valor: number }>> = [];

  for (const cliente of base.values()) {
    const grupos: Array<{ chave: number; primeira: Date; ultima: Date; pedidos: number; valor: number }> = [];
    for (const c of cliente.compras) {
      const chave = chaveMes(c.data);
      if (c.contribuicao !== null) {
        const m = margemPorMes.get(chave) ?? { faturamento: 0, contribuicao: 0 };
        m.faturamento += c.valor;
        m.contribuicao += c.contribuicao;
        margemPorMes.set(chave, m);
      }
      const g = grupos[grupos.length - 1];
      if (g && g.chave === chave) { g.pedidos++; g.valor += c.valor; g.ultima = c.data; }
      else grupos.push({ chave, primeira: c.data, ultima: c.data, pedidos: 1, valor: c.valor });
    }

    gruposPorCliente.push(grupos.map(g => ({ chave: g.chave, valor: g.valor })));

    let ultimaEntrada = -Infinity;
    for (let i = 0; i < grupos.length; i++) {
      const g = grupos[i];
      let segmento: SegmentoId;
      if (i === 0) {
        segmento = "novos";
        ultimaEntrada = g.chave;
        entradas.push({ chave: g.chave, voltou: grupos.length > 1 });
      } else {
        const anterior = grupos[i - 1].ultima;
        const lacuna = (g.primeira.getFullYear() - anterior.getFullYear()) * 12 + (g.primeira.getMonth() - anterior.getMonth());
        if (lacuna >= mesesInatividadeParaNovo) {
          segmento = "reativados";
          ultimaEntrada = g.chave;
          entradas.push({ chave: g.chave, voltou: i < grupos.length - 1 });
        } else {
          segmento = g.chave - ultimaEntrada <= MESES_CLIENTE_CONQUISTADO ? "recompraConquistados" : "carteira";
        }
      }
      const mes = porMes.get(g.chave) ?? acumuladorVazio();
      mes[segmento].clientes++;
      mes[segmento].pedidos += g.pedidos;
      mes[segmento].faturamento += g.valor;
      porMes.set(g.chave, mes);
    }
  }
  return { porMes, entradas, margemPorMes, gruposPorCliente };
}

function margemJanela(margemPorMes: Map<number, AcumMargem>, chaves: number[]): number | null {
  let faturamento = 0, contribuicao = 0;
  for (const ch of chaves) {
    const m = margemPorMes.get(ch);
    if (!m) continue;
    faturamento += m.faturamento;
    contribuicao += m.contribuicao;
  }
  return faturamento > 0 ? (contribuicao / faturamento) * 100 : null;
}

function calcularRetencao(gruposPorCliente: Array<Array<{ chave: number; valor: number }>>, atual: number): PainelMeta["retencao"] {
  const dentro = (meses: number[], ini: number, fim: number) => meses.some(m => m >= ini && m <= fim);
  let base1 = 0, ret1 = 0, base2 = 0, ret2 = 0, ativos = 0;
  for (const grupos of gruposPorCliente) {
    const meses = grupos.map(g => g.chave);
    const a0 = dentro(meses, atual - 12, atual - 1);
    const a1 = dentro(meses, atual - 24, atual - 13);
    const a2 = dentro(meses, atual - 36, atual - 25);
    if (a0) ativos++;
    if (a1) { base1++; if (a0) ret1++; }
    if (a2) { base2++; if (a1) ret2++; }
  }
  const MINIMO = 20;
  return {
    taxaPct: base1 >= MINIMO ? (ret1 / base1) * 100 : null,
    clientesBase: base1,
    retidos: ret1,
    taxaAnteriorPct: base2 >= MINIMO ? (ret2 / base2) * 100 : null,
    clientesAtivos12m: ativos,
    periodoBase: `${rotuloMes(atual - 24)} a ${rotuloMes(atual - 13)}`,
    periodoAtual: `${rotuloMes(atual - 12)} a ${rotuloMes(atual - 1)}`,
  };
}

function agregar(porMes: PorMes, chaves: number[]): ResumoCenario {
  const n = chaves.length || 1;
  const cenario = {} as Cenario;
  for (const s of SEGMENTOS) {
    let clientes = 0, pedidos = 0, faturamento = 0;
    for (const ch of chaves) {
      const m = porMes.get(ch)?.[s];
      if (!m) continue;
      clientes += m.clientes; pedidos += m.pedidos; faturamento += m.faturamento;
    }
    cenario[s] = {
      clientes: clientes / n,
      pedidosPorCliente: clientes > 0 ? pedidos / clientes : 0,
      ticket: pedidos > 0 ? faturamento / pedidos : 0,
    };
  }
  const t = totaisCenario(cenario);
  return { cenario, faturamento: t.faturamento, vendas: t.vendas, ticketMedio: t.ticketMedio };
}

function totalMes(porMes: PorMes, chave: number): { faturamento: number; vendas: number } | null {
  const m = porMes.get(chave);
  if (!m) return null;
  let faturamento = 0, vendas = 0;
  for (const s of SEGMENTOS) { faturamento += m[s].faturamento; vendas += m[s].pedidos; }
  return { faturamento, vendas };
}

/** Formato do mês em relação ao normal (razão ao redor da média móvel de 12
 * meses, média por mês do calendário, normalizada para média 1). null se o
 * histórico é curto demais (< 18 meses fechados) para cobrir os 12 meses. */
export function indicesSazonais(faturamentoPorMes: Map<number, number>, ateChave: number): number[] | null {
  const chaves = [...faturamentoPorMes.keys()].filter(c => c <= ateChave).sort((a, b) => a - b);
  if (chaves.length < 18) return null;
  const primeiro = chaves[0] + 1; // o primeiro mês do histórico pode estar incompleto
  const razoes: number[][] = Array.from({ length: 12 }, () => []);
  for (let t = primeiro + 6; t + 5 <= ateChave; t++) {
    let soma = 0;
    let ok = true;
    for (let k = t - 6; k <= t + 5; k++) {
      const v = faturamentoPorMes.get(k);
      if (v === undefined || k < primeiro) { ok = false; break; }
      soma += v;
    }
    if (!ok) continue;
    razoes[t % 12].push(faturamentoPorMes.get(t)! / (soma / 12));
  }
  if (razoes.some(r => r.length === 0)) return null;
  const medias = razoes.map(r => r.reduce((a, b) => a + b, 0) / r.length);
  const geral = medias.reduce((a, b) => a + b, 0) / 12;
  return medias.map(m => m / geral);
}

/** Quantil com interpolação linear (q entre 0 e 1) de uma lista já ordenada. */
function quantil(ordenados: number[], q: number): number {
  if (ordenados.length === 0) return NaN;
  const pos = (ordenados.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  return ordenados[base + 1] !== undefined ? ordenados[base] + resto * (ordenados[base + 1] - ordenados[base]) : ordenados[base];
}

/** PRNG determinístico (mulberry32): a mesma consulta sempre devolve as mesmas bandas. */
function criarPrng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Faixa provável (P10–P90) do erro relativo de um mês e da média de 12 meses, por bootstrap
 * dos erros históricos do método "média dos 12 meses anteriores". Os erros são sorteados como
 * independentes — na prática choques (perda de vendedor, feriados) se repetem em sequência, então
 * a faixa da média de 12 meses pode estar um pouco otimista. */
export function calcularBandas(erros: number[]): PainelMeta["bandas"] {
  if (erros.length < 6) return { amostras: erros.length, mensal: null, media12m: null };
  const ordenados = [...erros].sort((a, b) => a - b);
  const prng = criarPrng(20260926);
  const medias: number[] = [];
  for (let i = 0; i < 4000; i++) {
    let soma = 0;
    for (let k = 0; k < 12; k++) soma += erros[Math.floor(prng() * erros.length)];
    medias.push(soma / 12);
  }
  medias.sort((a, b) => a - b);
  return {
    amostras: erros.length,
    mensal: { pessimista: quantil(ordenados, 0.1), otimista: quantil(ordenados, 0.9) },
    media12m: { pessimista: quantil(medias, 0.1), otimista: quantil(medias, 0.9) },
  };
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 6) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

const MESES_VIDA_COORTE = 12;

/** Curva de vida de um parceiro novo. Só entram parceiros cuja 1ª compra caiu pelo menos 12 meses
 * depois do início do histórico (antes disso, "novo" pode ser um parceiro antigo que só apareceu
 * quando o histórico começou). Cada mês de vida usa só os parceiros que já viveram esse tempo. */
function calcularCoorte(
  gruposPorCliente: Array<Array<{ chave: number; valor: number }>>,
  primeiraChaveDados: number,
  atual: number,
): PainelMeta["coorte"] {
  const inicioCoorte = primeiraChaveDados + 12;
  const elegiveis = Array(MESES_VIDA_COORTE).fill(0) as number[];
  const ativos = Array(MESES_VIDA_COORTE).fill(0) as number[];
  const receita = Array(MESES_VIDA_COORTE).fill(0) as number[];
  let analisados = 0;
  let menorEntrada = Infinity, maiorEntrada = -Infinity;

  for (const grupos of gruposPorCliente) {
    if (grupos.length === 0) continue;
    const entrada = grupos[0].chave;
    if (entrada < inicioCoorte || entrada > atual - 1) continue;
    analisados++;
    menorEntrada = Math.min(menorEntrada, entrada);
    maiorEntrada = Math.max(maiorEntrada, entrada);
    const valorPorMes = new Map(grupos.map(g => [g.chave, g.valor] as const));
    for (let k = 0; k < MESES_VIDA_COORTE; k++) {
      if (entrada + k > atual - 1) break;
      elegiveis[k]++;
      const v = valorPorMes.get(entrada + k);
      if (v !== undefined) { ativos[k]++; receita[k] += v; }
    }
  }

  const meses = elegiveis.map((n, k) => ({
    k,
    elegiveis: n,
    ativosPct: n > 0 ? (ativos[k] / n) * 100 : null,
    receitaPorParceiro: n > 0 ? receita[k] / n : null,
  }));
  const MINIMO_PARA_LTV = 30;
  const confiavel = elegiveis.every(n => n >= MINIMO_PARA_LTV);
  let acumulado = 0;
  const ltvAcumulado = meses.map(m => {
    if (m.receitaPorParceiro === null || m.elegiveis < MINIMO_PARA_LTV) return null;
    acumulado += m.receitaPorParceiro;
    return acumulado;
  });
  return {
    parceirosAnalisados: analisados,
    periodo: analisados > 0 ? `${rotuloMes(menorEntrada)} a ${rotuloMes(maiorEntrada)}` : "—",
    meses,
    ltv12m: confiavel ? acumulado : null,
    ltvAcumulado,
  };
}

export function calcularPainelMeta(
  base: Map<string, ClienteBase>,
  hoje: Date,
  mesesInatividadeParaNovo: number,
): PainelMeta {
  const { porMes, entradas, margemPorMes, gruposPorCliente } = classificarTodos(base, mesesInatividadeParaNovo);
  const atual = chaveMes(hoje);
  const chaves12 = Array.from({ length: 12 }, (_, i) => atual - 12 + i);
  const chaves3 = chaves12.slice(9);
  const chavesAnoAnterior = chaves12.map(c => c - 12);
  // Margem: o mês fechado mais recente fica de fora (custos das OS recentes ainda em lançamento).
  const chavesMargem12 = Array.from({ length: 12 }, (_, i) => atual - 13 + i);
  const chavesMargem3 = chavesMargem12.slice(9);
  const chavesMargemAnterior = chavesMargem12.map(c => c - 12);
  const primeiraChaveDados = Math.min(...porMes.keys());

  const historico: MesRealizado[] = chaves12.map(ch => {
    const t = totalMes(porMes, ch) ?? { faturamento: 0, vendas: 0 };
    const seg = porMes.get(ch);
    const clientes = {} as Record<SegmentoId, number>;
    for (const s of SEGMENTOS) clientes[s] = seg ? seg[s].clientes : 0;
    return {
      mes: rotuloMes(ch),
      faturamento: t.faturamento,
      vendas: t.vendas,
      ticketMedio: t.vendas > 0 ? t.faturamento / t.vendas : 0,
      clientes,
      margemPct: margemJanela(margemPorMes, [ch]),
    };
  });
  const dadosSuficientes = historico.filter(h => h.faturamento > 0).length >= 10;

  // Recompra: só entradas com pelo menos 3 meses de "tempo para voltar".
  const periodoIni = atual - 15;
  const periodoFim = atual - 4;
  const analisadas = entradas.filter(e => e.chave >= periodoIni && e.chave <= periodoFim);
  const voltaram = analisadas.filter(e => e.voltou).length;

  // Sazonalidade e backtest usam só meses fechados (exclui o mês corrente).
  const fatPorMes = new Map<number, number>();
  for (const ch of porMes.keys()) {
    if (ch >= atual) continue;
    fatPorMes.set(ch, totalMes(porMes, ch)!.faturamento);
  }
  const indices = indicesSazonais(fatPorMes, atual - 1);

  let somaSem = 0, somaCom = 0, nSem = 0, nCom = 0;
  const errosRelativos: number[] = [];
  for (const T of chaves12) {
    const real = fatPorMes.get(T);
    if (!real) continue;
    let soma = 0, ok = true;
    for (let k = T - 12; k <= T - 1; k++) {
      const v = fatPorMes.get(k);
      if (v === undefined) { ok = false; break; }
      soma += v;
    }
    if (!ok) continue;
    const plano = soma / 12;
    somaSem += Math.abs(plano - real) / real; nSem++;
    errosRelativos.push((real - plano) / plano);
    const idx = indicesSazonais(fatPorMes, T - 1);
    if (idx) { somaCom += Math.abs(plano * idx[T % 12] - real) / real; nCom++; }
  }

  // Quanto cada indicador explica da oscilação mensal do faturamento (até 24 meses fechados).
  const series: Record<string, number[]> = { fat: [], ativos: [], pedidosPorParceiro: [], ticket: [], novos: [], reativados: [], recompra: [], carteira: [] };
  for (let ch = atual - 24; ch <= atual - 1; ch++) {
    const t = totalMes(porMes, ch);
    const seg = porMes.get(ch);
    if (!t || !seg || t.faturamento <= 0) continue;
    const ativosMes = SEGMENTOS.reduce((soma, sg) => soma + seg[sg].clientes, 0);
    series.fat.push(t.faturamento);
    series.ativos.push(ativosMes);
    series.pedidosPorParceiro.push(ativosMes > 0 ? t.vendas / ativosMes : 0);
    series.ticket.push(t.vendas > 0 ? t.faturamento / t.vendas : 0);
    series.novos.push(seg.novos.clientes);
    series.reativados.push(seg.reativados.clientes);
    series.recompra.push(seg.recompraConquistados.clientes);
    series.carteira.push(seg.carteira.clientes);
  }
  const ROTULOS_CORRELACAO: Array<[string, string]> = [
    ["ativos", "Parceiros ativos no mês"],
    ["pedidosPorParceiro", "Pedidos por parceiro"],
    ["ticket", "Ticket médio por pedido"],
    ["novos", "Parceiros novos"],
    ["reativados", "Parceiros reativados"],
    ["recompra", "Recompra de parceiros conquistados"],
    ["carteira", "Parceiros ativos da carteira"],
  ];
  const itensCorrelacao = ROTULOS_CORRELACAO
    .map(([id, rotulo]) => ({ id, rotulo, r: pearson(series[id], series.fat) }))
    .filter((i): i is { id: string; rotulo: string; r: number } => i.r !== null)
    .map(i => ({ id: i.id, rotulo: i.rotulo, r2Pct: i.r * i.r * 100 }))
    .sort((a, b) => b.r2Pct - a.r2Pct);

  return {
    dataReferencia: hoje.toISOString(),
    dadosSuficientes,
    historico,
    media12m: agregar(porMes, chaves12),
    ultimos3m: agregar(porMes, chaves3),
    recompra: {
      taxaPct: analisadas.length > 0 ? (voltaram / analisadas.length) * 100 : null,
      clientesAnalisados: analisadas.length,
      periodo: `${rotuloMes(periodoIni)} a ${rotuloMes(periodoFim)}`,
    },
    anoAnterior12m: agregar(porMes, chavesAnoAnterior),
    margem: {
      media12mPct: margemJanela(margemPorMes, chavesMargem12),
      ultimos3mPct: margemJanela(margemPorMes, chavesMargem3),
      anoAnteriorPct: margemJanela(margemPorMes, chavesMargemAnterior),
      periodo: `${rotuloMes(chavesMargem12[0])} a ${rotuloMes(chavesMargem12[11])}`,
    },
    coorte: calcularCoorte(gruposPorCliente, primeiraChaveDados, atual),
    bandas: calcularBandas(errosRelativos),
    correlacoes: { meses: series.fat.length, itens: itensCorrelacao },
    retencao: calcularRetencao(gruposPorCliente, atual),
    sazonalidade: { disponivel: indices !== null, indices: indices ?? Array(12).fill(1) },
    projecao: Array.from({ length: 12 }, (_, i) => {
      const ch = atual + 1 + i;
      const valores: number[] = [];
      const anos: number[] = [];
      for (let y = 1; y <= 4 && valores.length < 3; y++) {
        const anterior = ch - 12 * y;
        const v = anterior <= atual - 1 ? fatPorMes.get(anterior) : undefined;
        if (v !== undefined) { valores.push(v); anos.push(Math.floor(anterior / 12)); }
      }
      return {
        mes: rotuloMes(ch),
        indiceSazonal: indices ? indices[ch % 12] : 1,
        mediaMesmoMes: valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : null,
        anosConsiderados: anos,
      };
    }),
    backtest: {
      semSazonalidadePct: nSem > 0 ? (somaSem / nSem) * 100 : null,
      comSazonalidadePct: nCom > 0 ? (somaCom / nCom) * 100 : null,
      meses: nSem,
    },
  };
}
