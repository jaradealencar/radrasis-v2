/**
 * Consultoria da Meta de Faturamento — transforma dados do ERP e do Radrasis
 * (financeiro, marketing, orçamentos, vendedores, fila de recompra, pedidos)
 * em diagnóstico e recomendações priorizadas, complementando o painel de
 * indicadores (painelMeta.ts).
 *
 * Todas as funções são puras (recebem linhas já lidas do banco) para poderem
 * ser testadas sem banco. Cada número que vira frase de recomendação sai
 * daqui; o front só apresenta.
 *
 * Princípio: recomendação sem número que a sustente não entra. Quando um dado
 * não existe (ex.: financeiro sem meses suficientes), a função devolve null e
 * a recomendação correspondente simplesmente não aparece.
 */

import {
  STATUS_GANHO, STATUS_PERDIDO, STATUS_ABERTO, parseDataFlexivel, faixaTicketDoValor,
  type OrcamentoRow, type ClienteBase, type AcaoCandidata, type FaixaTicketConversao, type FunilMensal,
} from "./inteligenciaClientes";
import type { PainelMeta } from "./painelMeta";

// ─── Economia: quanto de lucro cada real de faturamento rende ────────────────

export interface LinhaFinanceiro {
  ano: number;
  mes: number;
  faturamentoOficial: string | null;
  lucroLiquido: string | null;
  lucroBruto: string | null;
}

export interface EconomiaMensal {
  meses: number;
  periodo: string;
  /** R$ de lucro a mais para cada R$ 1 de faturamento a mais (regressão linear mês a mês). */
  inclinacao: number;
  intercepto: number;
  r2: number;
  /** Faturamento mensal em que o lucro estimado é zero; null se a regressão não for utilizável. */
  pontoEquilibrio: number | null;
  faturamentoMedio: number;
  lucroMedio: number;
  confianca: "alta" | "media" | "baixa";
}

function num(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

/** Regressão do lucro mensal contra o faturamento oficial (Financeiro). Usa até os 18 meses fechados
 * mais recentes com os dois valores lançados; exige 6 meses e inclinação positiva. */
export function calcularEconomia(linhas: LinhaFinanceiro[], atual: number): EconomiaMensal | null {
  const pontos = linhas
    .map(l => ({ chave: l.ano * 12 + (l.mes - 1), x: num(l.faturamentoOficial), y: num(l.lucroLiquido) ?? num(l.lucroBruto) }))
    .filter((p): p is { chave: number; x: number; y: number } => p.x !== null && p.y !== null && p.x > 0 && p.chave < atual)
    .sort((a, b) => a.chave - b.chave)
    .slice(-18);
  const n = pontos.length;
  if (n < 6) return null;

  const mx = pontos.reduce((s, p) => s + p.x, 0) / n;
  const my = pontos.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of pontos) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; }
  if (sxx <= 0) return null;
  const inclinacao = sxy / sxx;
  if (inclinacao <= 0) return null;
  const intercepto = my - inclinacao * mx;
  const r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 0;
  const rotulo = (ch: number) => `${String((ch % 12) + 1).padStart(2, "0")}/${Math.floor(ch / 12)}`;
  return {
    meses: n,
    periodo: `${rotulo(pontos[0].chave)} a ${rotulo(pontos[n - 1].chave)}`,
    inclinacao,
    intercepto,
    r2,
    pontoEquilibrio: -intercepto / inclinacao,
    faturamentoMedio: mx,
    lucroMedio: my,
    confianca: r2 >= 0.6 ? "alta" : r2 >= 0.3 ? "media" : "baixa",
  };
}

// ─── Aquisição: quanto custa trazer um parceiro novo ─────────────────────────

export interface LinhaMarketing {
  ano: number;
  mes: number;
  investimentoAquisicao: string | null;
  investimento: string | null;
}

export interface AquisicaoMarketing {
  meses: number;
  investimentoMedioMensal: number;
  novosMedioMensal: number;
  /** Investimento de marketing em aquisição ÷ parceiros novos no mesmo período. Não inclui equipe comercial. */
  cacPorNovo: number | null;
}

export function calcularMarketing(linhas: LinhaMarketing[], historico: PainelMeta["historico"]): AquisicaoMarketing | null {
  const novosPorMes = new Map(historico.map(h => [h.mes, h.clientes.novos] as const));
  let invest = 0, novos = 0, meses = 0;
  for (const l of linhas) {
    const inv = num(l.investimentoAquisicao) ?? num(l.investimento);
    const chave = `${String(l.mes).padStart(2, "0")}/${l.ano}`;
    const n = novosPorMes.get(chave);
    if (inv === null || n === undefined) continue;
    invest += inv; novos += n; meses++;
  }
  if (meses === 0) return null;
  return {
    meses,
    investimentoMedioMensal: invest / meses,
    novosMedioMensal: novos / meses,
    cacPorNovo: novos > 0 ? invest / novos : null,
  };
}

// ─── Vendedores: conversão e peso no faturamento ─────────────────────────────

export interface VendedorFunil {
  vendedor: string;
  leadsPorMes: number;
  decididos: number;
  conversaoPct: number | null;
  faturamento12m: number;
  pctFaturamento: number;
  pedidos12m: number;
  ticket12m: number;
}

export interface AnaliseVendedores {
  vendedores: VendedorFunil[];
  concentracaoTop1: { vendedor: string; pct: number } | null;
  benchmark: { vendedor: string; conversaoPct: number } | null;
  /** Ganho mensal se cada vendedor abaixo do benchmark fechasse METADE da diferença de conversão. */
  impactoFecharMetadeDoGap: number | null;
  abaixoDoBenchmark: Array<{ vendedor: string; conversaoPct: number; leadsPorMes: number; ganhoMensalMetadeGap: number }>;
}

const MINIMO_DECISOES_BENCHMARK = 100;
const MINIMO_DECISOES_VENDEDOR = 50;

function classificarOrcamento(r: { status: string | null; dataCadastro: string | null; validade: string | null }, hoje: Date): "ganho" | "perdido" | null {
  const statusKey = (r.status ?? "").trim().toLowerCase();
  if (STATUS_GANHO.has(statusKey)) return "ganho";
  if (STATUS_PERDIDO.has(statusKey)) return "perdido";
  if (statusKey === STATUS_ABERTO) {
    const cadastro = parseDataFlexivel(r.dataCadastro);
    const dias = parseFloat(String(r.validade ?? "0")) || 0;
    if (cadastro && dias > 0) {
      const vencimento = new Date(cadastro);
      vencimento.setDate(vencimento.getDate() + dias);
      if (vencimento < hoje) return "perdido";
    }
  }
  return null;
}

export function calcularVendedores(
  orcamentos: OrcamentoRow[],
  base: Map<string, ClienteBase>,
  hoje: Date,
  ticketMedioPedido: number,
): AnaliseVendedores {
  const atual = hoje.getFullYear() * 12 + hoje.getMonth();
  const funilPorVendedor = new Map<string, { leads: number; ganhos: number; perdidos: number }>();
  const mesesOrc = new Set<number>();
  for (const r of orcamentos) {
    const chave = r.ano * 12 + (r.mes - 1);
    if (chave >= atual) continue;
    mesesOrc.add(chave);
    const nome = (r.vendedor ?? "").trim() || "Sem vendedor";
    const acc = funilPorVendedor.get(nome) ?? { leads: 0, ganhos: 0, perdidos: 0 };
    acc.leads++;
    const c = classificarOrcamento(r, hoje);
    if (c === "ganho") acc.ganhos++; else if (c === "perdido") acc.perdidos++;
    funilPorVendedor.set(nome, acc);
  }
  const mesesConsiderados = Math.max(1, mesesOrc.size);

  // Faturamento dos últimos 12 meses fechados por vendedor (vendedor da própria compra).
  const fatPorVendedor = new Map<string, { faturamento: number; pedidos: number }>();
  let fatTotal = 0;
  for (const cliente of base.values()) {
    for (const c of cliente.compras) {
      const ch = c.data.getFullYear() * 12 + c.data.getMonth();
      if (ch < atual - 12 || ch > atual - 1) continue;
      const nome = (c.vendedor ?? "").trim() || "Sem vendedor";
      const acc = fatPorVendedor.get(nome) ?? { faturamento: 0, pedidos: 0 };
      acc.faturamento += c.valor; acc.pedidos++;
      fatPorVendedor.set(nome, acc);
      fatTotal += c.valor;
    }
  }

  const nomes = new Set([...funilPorVendedor.keys(), ...fatPorVendedor.keys()]);
  const vendedores: VendedorFunil[] = [...nomes].map(nome => {
    const f = funilPorVendedor.get(nome);
    const v = fatPorVendedor.get(nome);
    const decididos = f ? f.ganhos + f.perdidos : 0;
    return {
      vendedor: nome,
      leadsPorMes: f ? f.leads / mesesConsiderados : 0,
      decididos,
      conversaoPct: decididos > 0 ? (f!.ganhos / decididos) * 100 : null,
      faturamento12m: v?.faturamento ?? 0,
      pctFaturamento: fatTotal > 0 && v ? (v.faturamento / fatTotal) * 100 : 0,
      pedidos12m: v?.pedidos ?? 0,
      ticket12m: v && v.pedidos > 0 ? v.faturamento / v.pedidos : 0,
    };
  }).sort((a, b) => b.faturamento12m - a.faturamento12m);

  const top1 = vendedores[0];
  const elegiveisBenchmark = vendedores.filter(v => v.conversaoPct !== null && v.decididos >= MINIMO_DECISOES_BENCHMARK);
  const bench = elegiveisBenchmark.length >= 2
    ? elegiveisBenchmark.reduce((m, v) => (v.conversaoPct! > m.conversaoPct! ? v : m))
    : null;

  const abaixo = bench
    ? vendedores
        .filter(v => v.vendedor !== bench.vendedor && v.conversaoPct !== null && v.decididos >= MINIMO_DECISOES_VENDEDOR && v.conversaoPct < bench.conversaoPct!)
        .map(v => ({
          vendedor: v.vendedor,
          conversaoPct: v.conversaoPct!,
          leadsPorMes: v.leadsPorMes,
          ganhoMensalMetadeGap: v.leadsPorMes * ((bench.conversaoPct! - v.conversaoPct!) / 100) * 0.5 * ticketMedioPedido,
        }))
        .sort((a, b) => b.ganhoMensalMetadeGap - a.ganhoMensalMetadeGap)
    : [];

  return {
    vendedores: vendedores.filter(v => v.faturamento12m > 0 || v.decididos >= MINIMO_DECISOES_VENDEDOR).slice(0, 8),
    concentracaoTop1: top1 && top1.pctFaturamento > 0 ? { vendedor: top1.vendedor, pct: top1.pctFaturamento } : null,
    benchmark: bench ? { vendedor: bench.vendedor, conversaoPct: bench.conversaoPct! } : null,
    impactoFecharMetadeDoGap: bench ? abaixo.reduce((s, v) => s + v.ganhoMensalMetadeGap, 0) : null,
    abaixoDoBenchmark: abaixo,
  };
}

// ─── Pipeline: orçamentos em aberto ainda dentro da validade ─────────────────

export interface OportunidadeAberta {
  empresa: string;
  vendedor: string;
  total: number;
  diasParaVencer: number;
  /** Conversão histórica da faixa de valor em que este orçamento se encaixa. */
  taxaFaixaPct: number | null;
}

export interface PipelineAberto {
  quantidade: number;
  valorTotal: number;
  /** Soma de (valor × conversão histórica da faixa) — o que se espera fechar sem ação extra. */
  valorEsperado: number;
  vencendoEm3Dias: { quantidade: number; valor: number };
  top: OportunidadeAberta[];
}

export function calcularPipeline(orcamentos: OrcamentoRow[], faixas: FaixaTicketConversao[], hoje: Date): PipelineAberto {
  const taxaPorFaixa = new Map(faixas.map(f => [f.faixa, f.taxaConversaoPct] as const));
  const abertas: OportunidadeAberta[] = [];
  for (const r of orcamentos) {
    if ((r.status ?? "").trim().toLowerCase() !== STATUS_ABERTO) continue;
    const cadastro = parseDataFlexivel(r.dataCadastro);
    const dias = parseFloat(String(r.validade ?? "0")) || 0;
    if (!cadastro || dias <= 0) continue;
    const vencimento = new Date(cadastro);
    vencimento.setDate(vencimento.getDate() + dias);
    if (vencimento < hoje) continue;
    const total = parseFloat(String(r.total ?? "0")) || 0;
    if (total <= 0) continue;
    abertas.push({
      empresa: (r.empresa ?? "").trim() || "—",
      vendedor: (r.vendedor ?? "").trim() || "Sem vendedor",
      total,
      diasParaVencer: Math.max(0, Math.ceil((vencimento.getTime() - hoje.getTime()) / 86400000)),
      taxaFaixaPct: taxaPorFaixa.get(faixaTicketDoValor(total)) ?? null,
    });
  }
  const urgentes = abertas.filter(o => o.diasParaVencer <= 3);
  return {
    quantidade: abertas.length,
    valorTotal: abertas.reduce((s, o) => s + o.total, 0),
    valorEsperado: abertas.reduce((s, o) => s + o.total * ((o.taxaFaixaPct ?? 0) / 100), 0),
    vencendoEm3Dias: { quantidade: urgentes.length, valor: urgentes.reduce((s, o) => s + o.total, 0) },
    top: [...abertas].sort((a, b) => b.total - a.total).slice(0, 8),
  };
}

// ─── Distribuições: onde o faturamento está (ticket, estado, concentração) ────

export interface Distribuicoes {
  faixasTicket: Array<{ faixa: string; pedidos: number; pctPedidos: number; faturamento: number; pctFaturamento: number }>;
  estados: Array<{ estado: string; pedidos: number; parceiros: number; faturamento: number; pctFaturamento: number; ticket: number }>;
  concentracao: { parceirosAtivos: number; top1Pct: number; top10Pct: number; parceirosPara50Pct: number; parceirosPara80Pct: number };
  ticketMedioGeral: number;
}

const FAIXAS_PEDIDO: Array<{ faixa: string; ate: number }> = [
  { faixa: "Até R$ 750", ate: 750 },
  { faixa: "R$ 751 a 1.500", ate: 1500 },
  { faixa: "R$ 1.501 a 3.000", ate: 3000 },
  { faixa: "R$ 3.001 a 6.000", ate: 6000 },
  { faixa: "Acima de R$ 6.000", ate: Infinity },
];

export function calcularDistribuicoes(base: Map<string, ClienteBase>, hoje: Date): Distribuicoes {
  const atual = hoje.getFullYear() * 12 + hoje.getMonth();
  const faixas = FAIXAS_PEDIDO.map(f => ({ ...f, pedidos: 0, faturamento: 0 }));
  const estados = new Map<string, { pedidos: number; parceiros: Set<string>; faturamento: number }>();
  const porParceiro = new Map<string, number>();
  let pedidosTotal = 0, fatTotal = 0;

  for (const cliente of base.values()) {
    for (const c of cliente.compras) {
      const ch = c.data.getFullYear() * 12 + c.data.getMonth();
      if (ch < atual - 12 || ch > atual - 1) continue;
      pedidosTotal++; fatTotal += c.valor;
      const faixa = faixas.find(f => c.valor <= f.ate)!;
      faixa.pedidos++; faixa.faturamento += c.valor;
      const uf = (c.estado ?? "").trim().toUpperCase() || "—";
      const e = estados.get(uf) ?? { pedidos: 0, parceiros: new Set<string>(), faturamento: 0 };
      e.pedidos++; e.faturamento += c.valor; e.parceiros.add(cliente.empresaKey);
      estados.set(uf, e);
      porParceiro.set(cliente.empresaKey, (porParceiro.get(cliente.empresaKey) ?? 0) + c.valor);
    }
  }

  const valores = [...porParceiro.values()].sort((a, b) => b - a);
  let acum = 0, p50 = 0, p80 = 0;
  valores.forEach((v, i) => {
    acum += v;
    if (!p50 && acum / fatTotal >= 0.5) p50 = i + 1;
    if (!p80 && acum / fatTotal >= 0.8) p80 = i + 1;
  });

  return {
    faixasTicket: faixas.map(f => ({
      faixa: f.faixa,
      pedidos: f.pedidos,
      pctPedidos: pedidosTotal > 0 ? (f.pedidos / pedidosTotal) * 100 : 0,
      faturamento: f.faturamento,
      pctFaturamento: fatTotal > 0 ? (f.faturamento / fatTotal) * 100 : 0,
    })),
    estados: [...estados.entries()]
      .map(([estado, e]) => ({
        estado,
        pedidos: e.pedidos,
        parceiros: e.parceiros.size,
        faturamento: e.faturamento,
        pctFaturamento: fatTotal > 0 ? (e.faturamento / fatTotal) * 100 : 0,
        ticket: e.pedidos > 0 ? e.faturamento / e.pedidos : 0,
      }))
      .sort((a, b) => b.faturamento - a.faturamento)
      .slice(0, 10),
    concentracao: {
      parceirosAtivos: valores.length,
      top1Pct: fatTotal > 0 && valores.length > 0 ? (valores[0] / fatTotal) * 100 : 0,
      top10Pct: fatTotal > 0 ? (valores.slice(0, 10).reduce((s, v) => s + v, 0) / fatTotal) * 100 : 0,
      parceirosPara50Pct: p50,
      parceirosPara80Pct: p80,
    },
    ticketMedioGeral: pedidosTotal > 0 ? fatTotal / pedidosTotal : 0,
  };
}

// ─── Fila de recompra (resumo de valor) ──────────────────────────────────────

export interface ResumoFila {
  atrasoRecompra: { quantidade: number; valorDeUmaCompraCadaUm: number };
  primeiraSemSegunda: { quantidade: number; valorDeUmaCompraCadaUm: number };
}

export function resumirFila(candidatos: AcaoCandidata[], base: Map<string, ClienteBase>, hoje: Date): ResumoFila {
  const limite = new Date(hoje);
  limite.setFullYear(limite.getFullYear() - 1);
  const ticketDoParceiro = (key: string): number => {
    const compras = base.get(key)?.compras.filter(c => c.data >= limite && c.data <= hoje) ?? [];
    const todas = base.get(key)?.compras ?? [];
    const usar = compras.length > 0 ? compras : todas;
    return usar.length > 0 ? usar.reduce((s, c) => s + c.valor, 0) / usar.length : 0;
  };
  const resumo: ResumoFila = {
    atrasoRecompra: { quantidade: 0, valorDeUmaCompraCadaUm: 0 },
    primeiraSemSegunda: { quantidade: 0, valorDeUmaCompraCadaUm: 0 },
  };
  for (const c of candidatos) {
    const alvo = c.tipo === "atraso_recompra" ? resumo.atrasoRecompra : c.tipo === "primeira_sem_segunda" ? resumo.primeiraSemSegunda : null;
    if (!alvo) continue;
    alvo.quantidade++;
    alvo.valorDeUmaCompraCadaUm += ticketDoParceiro(c.empresaKey);
  }
  return resumo;
}

// ─── Recomendações ───────────────────────────────────────────────────────────

export type Esforco = "baixo" | "medio" | "alto";

export interface Recomendacao {
  id: string;
  categoria: "conversao" | "pipeline" | "retencao" | "aquisicao" | "ticket" | "risco" | "expansao" | "margem";
  titulo: string;
  /** O que os números mostram (frase com os valores usados). */
  diagnostico: string;
  /** O que fazer, em passos concretos. */
  acao: string;
  /** Ganho em R$/mês em regime, quando faz sentido medir assim. */
  impactoMensal: number | null;
  /** Ganho de uma vez (ex.: fechar o que está parado), quando não é recorrente. */
  impactoUnico: number | null;
  esforco: Esforco;
  confianca: "alta" | "media" | "baixa";
  /** Onde agir no sistema. */
  destino: "crm" | "fila-acoes" | "retencao" | "funil" | "clientes" | "crescimento" | "radar" | null;
  /** Premissa usada, para o usuário poder discordar. */
  premissa: string;
}

export interface EntradaRecomendacoes {
  painel: PainelMeta;
  funil: FunilMensal;
  vendedores: AnaliseVendedores;
  pipeline: PipelineAberto;
  distribuicoes: Distribuicoes;
  fila: ResumoFila;
  marketing: AquisicaoMarketing | null;
}

const PESO_ESFORCO: Record<Esforco, number> = { baixo: 1, medio: 2, alto: 3 };

/** Para comparar ganhos de uma vez com ganhos mensais, o ganho de uma vez é diluído nesta quantidade de meses. */
export const MESES_DILUICAO_GANHO_UNICO = 6;

const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const pct = (v: number, casas = 0) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

export function gerarRecomendacoes(e: EntradaRecomendacoes): Recomendacao[] {
  const recs: Recomendacao[] = [];
  const { painel, vendedores, pipeline, distribuicoes, fila, marketing } = e;

  // 1) Conversão dos vendedores abaixo do melhor
  if (vendedores.benchmark && vendedores.abaixoDoBenchmark.length > 0 && (vendedores.impactoFecharMetadeDoGap ?? 0) > 0) {
    const lista = vendedores.abaixoDoBenchmark.slice(0, 3)
      .map(v => `${v.vendedor} ${pct(v.conversaoPct, 1)} (${Math.round(v.leadsPorMes)} orçamentos/mês)`)
      .join("; ");
    recs.push({
      id: "conversao-vendedores",
      categoria: "conversao",
      titulo: `Aproximar a conversão dos demais vendedores da melhor (${pct(vendedores.benchmark.conversaoPct, 1)})`,
      diagnostico: `${vendedores.benchmark.vendedor} converte ${pct(vendedores.benchmark.conversaoPct, 1)} dos orçamentos. Abaixo: ${lista}. Fechar só metade dessa diferença já muda o faturamento.`,
      acao: "Comparar o follow-up e o script de quem converte mais com o dos demais; padronizar a rotina de retorno (1º contato em até 24h, 2º em 3 dias, 3º antes de vencer a validade) e acompanhar a conversão por vendedor toda semana.",
      impactoMensal: vendedores.impactoFecharMetadeDoGap,
      impactoUnico: null,
      esforco: "medio",
      confianca: "media",
      destino: "crm",
      premissa: "Considera só metade da diferença porque parte dela pode ser qualidade dos leads de cada vendedor, não abordagem. Usa o ticket médio de pedido dos últimos 12 meses.",
    });
  }

  // 2) Follow-up do pipeline aberto
  if (pipeline.quantidade > 0 && pipeline.valorEsperado > 0) {
    const urg = pipeline.vencendoEm3Dias;
    recs.push({
      id: "pipeline-aberto",
      categoria: "pipeline",
      titulo: `Fazer follow-up nos ${pipeline.quantidade} orçamentos em aberto ainda válidos`,
      diagnostico: `Há ${pipeline.quantidade} orçamentos válidos somando ${brl(pipeline.valorTotal)}; pela conversão histórica de cada faixa de valor, o esperado é fechar ${brl(pipeline.valorEsperado)}.${urg.quantidade > 0 ? ` ${urg.quantidade} vencem em até 3 dias (${brl(urg.valor)}).` : ""}`,
      acao: "Começar pelos de maior valor e pelos que vencem primeiro; ligar (não só mensagem) nos acima de R$ 6 mil. A lista dos maiores está abaixo.",
      impactoMensal: null,
      impactoUnico: pipeline.valorEsperado * 0.2,
      esforco: "baixo",
      confianca: "media",
      destino: "crm",
      premissa: "O ganho estimado é +20% sobre o valor que já se espera fechar (contato ativo costuma elevar a taxa); é um ganho de uma vez, que se repete a cada ciclo de orçamentos.",
    });
  }

  // 3) Recompra atrasada
  if (fila.atrasoRecompra.quantidade > 0) {
    const RECUPERA = 0.2;
    recs.push({
      id: "recompra-atrasada",
      categoria: "retencao",
      titulo: `Chamar os ${fila.atrasoRecompra.quantidade} parceiros com recompra atrasada`,
      diagnostico: `${fila.atrasoRecompra.quantidade} parceiros ativos passaram do intervalo normal entre compras (a mediana deles mesmos). Uma compra de cada um vale ${brl(fila.atrasoRecompra.valorDeUmaCompraCadaUm)}.`,
      acao: "Abrir a Fila de Ações, começar pelos de maior prioridade e registrar o resultado de cada contato.",
      impactoMensal: null,
      impactoUnico: fila.atrasoRecompra.valorDeUmaCompraCadaUm * RECUPERA,
      esforco: "baixo",
      confianca: "media",
      destino: "fila-acoes",
      premissa: `Assume que ${pct(RECUPERA * 100)} deles compram de novo depois do contato; o valor é o ticket médio de cada parceiro.`,
    });
  }

  // 4) Novos parceiros que não voltaram
  const { coorte } = painel;
  const entrada = coorte.meses[0]?.receitaPorParceiro ?? null;
  const taxaRecompra = painel.recompra.taxaPct;
  if (fila.primeiraSemSegunda.quantidade > 0 && coorte.ltv12m !== null && entrada !== null && taxaRecompra && taxaRecompra > 0) {
    const valorPorQueVolta = (coorte.ltv12m - entrada) / (taxaRecompra / 100);
    const RECUPERA = 0.2;
    recs.push({
      id: "novos-sem-segunda",
      categoria: "retencao",
      titulo: `Fidelizar os ${fila.primeiraSemSegunda.quantidade} parceiros novos que ainda não fizeram a 2ª compra`,
      diagnostico: `Fizeram a 1ª compra há 30 a 120 dias e não voltaram. ${pct(taxaRecompra)} dos novos costumam voltar; cada um que volta rende cerca de ${brl(valorPorQueVolta)} nos 12 meses seguintes.`,
      acao: "Seguir a jornada de retenção (contato aos 16 dias úteis, 30, 90 e 180 dias) e oferecer condição na 2ª compra.",
      impactoMensal: null,
      impactoUnico: fila.primeiraSemSegunda.quantidade * RECUPERA * valorPorQueVolta,
      esforco: "baixo",
      confianca: "media",
      destino: "retencao",
      premissa: `Assume que ${pct(RECUPERA * 100)} desses parceiros voltam depois do contato. O valor por parceiro que volta vem da curva de vida dos parceiros novos (LTV de 12 meses).`,
    });
  }

  // 5) Aquisição: custo x retorno
  if (marketing && marketing.cacPorNovo && coorte.ltv12m !== null && coorte.ltv12m > 0) {
    const razao = coorte.ltv12m / marketing.cacPorNovo;
    recs.push({
      id: "aquisicao-cac-ltv",
      categoria: "aquisicao",
      titulo: "Testar mais investimento em aquisição de parceiros novos",
      diagnostico: `Cada parceiro novo custou ${brl(marketing.cacPorNovo)} em marketing (${marketing.novosMedioMensal.toFixed(0)} novos/mês com ${brl(marketing.investimentoMedioMensal)}/mês) e rende ${brl(coorte.ltv12m)} em 12 meses: ~${razao.toFixed(0)}× o investimento.`,
      acao: "Aumentar o investimento em etapas (por exemplo +30% por mês) e acompanhar se o número de parceiros novos sobe na mesma proporção antes de ir além.",
      impactoMensal: 5 * coorte.ltv12m,
      impactoUnico: null,
      esforco: "medio",
      confianca: "baixa",
      destino: "crescimento",
      premissa: "Impacto = +5 parceiros novos por mês, em regime (após ~12 meses). O custo considera só o marketing lançado, sem equipe comercial nem comissões — o retorno real é menor que o exibido.",
    });
  }

  // 6) Pedidos pequenos
  const pequenos = distribuicoes.faixasTicket.slice(0, 2);
  const pctPedPequenos = pequenos.reduce((s, f) => s + f.pctPedidos, 0);
  const pctFatPequenos = pequenos.reduce((s, f) => s + f.pctFaturamento, 0);
  if (pctPedPequenos >= 30 && pctFatPequenos <= pctPedPequenos / 2) {
    recs.push({
      id: "pedidos-pequenos",
      categoria: "ticket",
      titulo: "Reduzir o esforço gasto com pedidos pequenos",
      diagnostico: `${pct(pctPedPequenos)} dos pedidos (até R$ 1.500) geram só ${pct(pctFatPequenos)} do faturamento — o mesmo esforço de produção e atendimento rende pouco.`,
      acao: "Definir pedido mínimo ou pacotes/kits para parceiros que compram pouco, e oferecer upgrade de material ou tamanho no orçamento.",
      impactoMensal: null,
      impactoUnico: null,
      esforco: "medio",
      confianca: "media",
      destino: null,
      premissa: "Sem estimativa em R$ porque depende de política comercial; serve para orientar onde há capacidade a liberar.",
    });
  }

  // 7) Dependência de um vendedor
  if (vendedores.concentracaoTop1 && vendedores.concentracaoTop1.pct >= 50) {
    recs.push({
      id: "concentracao-vendedor",
      categoria: "risco",
      titulo: `Reduzir a dependência de ${vendedores.concentracaoTop1.vendedor}`,
      diagnostico: `${vendedores.concentracaoTop1.vendedor} responde por ${pct(vendedores.concentracaoTop1.pct)} do faturamento dos últimos 12 meses. Uma ausência ou saída derruba a meta.`,
      acao: "Documentar a rotina e a carteira, dividir os parceiros de maior valor entre dois vendedores e treinar um substituto para os principais.",
      impactoMensal: null,
      impactoUnico: null,
      esforco: "medio",
      confianca: "alta",
      destino: null,
      premissa: "Risco operacional, sem valor em R$ — mas protege a meta inteira.",
    });
  }

  // 8) Estados de ticket alto com poucos parceiros
  const ticketGeral = distribuicoes.ticketMedioGeral;
  const promissores = distribuicoes.estados.filter(s => s.estado !== "—" && s.ticket >= ticketGeral * 1.5 && s.pedidos >= 20 && s.parceiros <= 40);
  if (promissores.length > 0) {
    const lista = promissores.slice(0, 3).map(s => `${s.estado} (ticket ${brl(s.ticket)}, ${s.parceiros} parceiros)`).join("; ");
    recs.push({
      id: "estados-ticket-alto",
      categoria: "expansao",
      titulo: "Prospectar mais parceiros nos estados de ticket alto",
      diagnostico: `Estados onde o pedido médio é pelo menos 1,5× o geral (${brl(ticketGeral)}) e ainda há poucos parceiros: ${lista}.`,
      acao: "Direcionar a prospecção (Radar de Mercado e qualificação de leads por CNPJ) para esses estados e abordar gráficas de comunicação visual da região.",
      impactoMensal: null,
      impactoUnico: null,
      esforco: "medio",
      confianca: "baixa",
      destino: "radar",
      premissa: "Baseado em poucos pedidos por estado; use como hipótese a validar, não como certeza.",
    });
  }

  const custoPorEsforco = (r: Recomendacao) => {
    const ganho = r.impactoMensal ?? (r.impactoUnico !== null ? r.impactoUnico / MESES_DILUICAO_GANHO_UNICO : 0);
    return ganho / PESO_ESFORCO[r.esforco];
  };
  return recs.sort((a, b) => custoPorEsforco(b) - custoPorEsforco(a));
}

// ─── Sinais do Radar de Mercado (demanda derivada) ────────────────────────────

export interface LinhaSinal {
  uf: string | null;
  tipoEvento: string | null;
  status: string;
  dataColeta: Date | string;
}

export interface SinaisMercado {
  total90d: number;
  porTipo: Array<{ tipo: string; quantidade: number }>;
  porUf: Array<{ uf: string; quantidade: number }>;
}

/** Sinais ainda ativos (não descartados nem expirados) coletados nos últimos 90 dias: inaugurações, reformas e
 * expansões de comércio são o "sinal antecedente" da demanda das gráficas por fachadas e letreiros. */
export function resumirSinaisMercado(linhas: LinhaSinal[], hoje: Date): SinaisMercado | null {
  const limite = new Date(hoje.getTime() - 90 * 86400000);
  const ativos = linhas.filter(l => l.status !== "descartado" && l.status !== "expirado" && new Date(l.dataColeta) >= limite);
  if (ativos.length === 0) return null;
  const contar = (chave: (l: LinhaSinal) => string) => {
    const m = new Map<string, number>();
    for (const l of ativos) m.set(chave(l), (m.get(chave(l)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  return {
    total90d: ativos.length,
    porTipo: contar(l => (l.tipoEvento ?? "").trim() || "outro").slice(0, 5).map(([tipo, quantidade]) => ({ tipo, quantidade })),
    porUf: contar(l => (l.uf ?? "").trim().toUpperCase() || "—").slice(0, 6).map(([uf, quantidade]) => ({ uf, quantidade })),
  };
}
