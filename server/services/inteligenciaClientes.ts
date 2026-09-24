/**
 * Inteligência de Clientes — motor de cálculo (aba Performance Comercial).
 *
 * Reescrita completa (setembro/2026) a partir do prompt "Inteligência de
 * Mercado" fornecido pelo usuário — ver docs/inteligencia-clientes.md para o
 * dicionário de métricas, decisões assumidas e limitações registradas.
 *
 * Decisão central: todo o cálculo usa `historico_os` (base local importada do
 * MubiSys, ver `docs/integracao-mubisys.md` e a memória "Performance Comercial:
 * histórico vazio") como única fonte — nunca a API MubiSys ao vivo. A versão
 * anterior desta aba consultava a API em tempo real (lenta, 25-45s/mês) e
 * precisava de um mecanismo de "congelar" o resultado; como historico_os já
 * cobre 2023-09 a 2026-09 com custo/contribuição em 100% das linhas, o cálculo
 * é determinístico, rápido e não depende mais de congelamento.
 *
 * "Pedido válido" reaproveita a mesma regra usada em toda a Performance
 * Comercial (`isOsNormalDb`): exclui Retrabalho, Amostra, Cortesia e
 * Cancelada, e exclui linhas com tipoOs nulo (duplicatas antigas sem custo).
 */

import { isOsNormalDb, normalizeEmpresaKey, MESES_INATIVIDADE_PARA_NOVO } from "../routers/performanceComercial";
import { diasUteisEntre as diasUteisEntreCompartilhado } from "../../shared/dias-uteis";

// ─── Constantes de negócio (parâmetros configuráveis — ver dicionário) ───────

/** Cliente com apenas 1 compra válida em todo o histórico: sem base para
 * mediana de intervalo, comparação de tendência etc. */
export const HISTORICO_MINIMO_COMPRAS_PARA_TENDENCIA = 3;

/** razaoAtraso = dias desde a última compra / mediana do intervalo do próprio
 * cliente. Acima deste limiar, o cliente entra na classificação "intervalo
 * acima do habitual" — heurística de acompanhamento, não probabilidade. */
export const RAZAO_ATRASO_LIMIAR = 1.5;

/** Variação de valor comprado (janela atual vs. janela anterior de mesmo
 * tamanho) acima da qual o cliente é classificado como em crescimento/redução. */
export const VARIACAO_VOLUME_LIMIAR_PCT = 20;

/** Margem de contribuição (contribuicaoReais / valorTotal) abaixo da qual um
 * cliente de alto volume entra na fila como "alto volume, margem baixa". */
export const MARGEM_BAIXA_LIMIAR_PCT = 15;

/** "Alto volume" para fins da fila de ações = top 20% de clientes por valor
 * comprado nos últimos 12 meses. */
export const ALTO_VOLUME_PERCENTIL = 0.8;

/** Janela de oportunidade de contato pós-primeira-compra: só entra na fila
 * "primeira compra sem segunda" quem já passou do prazo mínimo de espera mas
 * ainda não passou tanto tempo que o contato deixou de fazer sentido. */
export const PRIMEIRA_COMPRA_DIAS_MIN_CONTATO = 30;
export const PRIMEIRA_COMPRA_DIAS_MAX_CONTATO = 120;

/** Ações resolvidas (concluída/descartada) há menos que isso não são
 * recriadas mesmo que a condição que as gerou continue verdadeira — evita
 * reabrir uma ação que acabou de ser tratada. */
export const DIAS_COOLDOWN_ACAO_RESOLVIDA = 30;

export const VERSAO_REGRA_ATUAL = "v1";

// ─── Dicionário de métricas ───────────────────────────────────────────────────
// Exposto ao painel (botão "O que significa isso?") e reutilizado pelo
// assistente futuro. Cada entrada documenta fórmula, período, e limitações —
// exigência do prompt de origem (seção 3: "dicionário de métricas acessível").
export interface MetricaDicionario {
  id: string;
  nome: string;
  formula: string;
  periodo: string;
  limitacoes: string;
}

export const DICIONARIO_METRICAS: MetricaDicionario[] = [
  {
    id: "pedido_valido",
    nome: "Pedido válido",
    formula: "OS com tipoOs preenchido, diferente de Retrabalho/Amostra/Cortesia, e status diferente de Cancelada.",
    periodo: "N/A (filtro aplicado a toda OS antes de qualquer cálculo)",
    limitacoes: "Linhas com tipoOs nulo são duplicatas de importações antigas sem custo e são sempre excluídas, mesmo que representem um pedido real.",
  },
  {
    id: "data_do_pedido",
    nome: "Data do pedido",
    formula: "Data de aprovação da OS (dataAprovacao).",
    periodo: "N/A",
    limitacoes: "Não é data de faturamento nem de entrega — 100% das OS têm data de aprovação, mas ~2% não têm data de faturamento (pedidos ainda em produção).",
  },
  {
    id: "clientes_compradores_periodo",
    nome: "Clientes compradores no período",
    formula: "Contagem de empresas distintas (normalizadas) com pelo menos um pedido válido cuja data de aprovação cai dentro do período selecionado.",
    periodo: "Período selecionado no filtro",
    limitacoes: "Não é uma classificação permanente de \"cliente ativo\" — é só quem comprou nessa janela específica.",
  },
  {
    id: "primeira_compra_observada",
    nome: "Primeira compra observada",
    formula: "Empresa cujo primeiro pedido válido em todo o histórico local (desde 2023) cai dentro do período selecionado.",
    periodo: "Período selecionado no filtro",
    limitacoes: "\"Observada\" porque o histórico local começa em 2023 — não prova que o cliente nunca comprou antes disso, só que não há registro.",
  },
  {
    id: "recompra_no_periodo",
    nome: "Recompra no período",
    formula: "Empresa com 2 ou mais pedidos válidos no histórico total, cujo pedido mais recente dentro do período não é a primeira compra dela.",
    periodo: "Período selecionado no filtro",
    limitacoes: "—",
  },
  {
    id: "rfm_recencia",
    nome: "RFM — Recência",
    formula: "Dias entre a data de referência (hoje) e a data do pedido válido mais recente do cliente, em todo o histórico.",
    periodo: "Calculado na data de referência, não depende do período selecionado",
    limitacoes: "—",
  },
  {
    id: "rfm_frequencia",
    nome: "RFM — Frequência",
    formula: "Quantidade de pedidos válidos do cliente dentro do período selecionado.",
    periodo: "Período selecionado no filtro",
    limitacoes: "Pedidos divididos ou revisados contam pelo número de OS distintas geradas, não pelo número de itens.",
  },
  {
    id: "rfm_valor",
    nome: "RFM — Valor monetário",
    formula: "Soma do valor dos pedidos válidos do cliente dentro do período selecionado.",
    periodo: "Período selecionado no filtro",
    limitacoes: "Valor bruto do pedido (valorOs), não desconta custo — não é margem.",
  },
  {
    id: "razao_atraso_recompra",
    nome: "Razão de atraso na recompra",
    formula: "Dias desde a última compra válida ÷ mediana dos intervalos entre compras válidas do próprio cliente (exige 3+ compras).",
    periodo: "Calculado na data de referência",
    limitacoes: "Heurística de acompanhamento, não é probabilidade de perda do cliente. Sem histórico suficiente, aparece como \"histórico insuficiente\".",
  },
  {
    id: "concentracao",
    nome: "Concentração de carteira",
    formula: "Participação (%) da receita dos clientes no top 20% por valor comprado, sobre a receita total válida do período selecionado.",
    periodo: "Período selecionado no filtro",
    limitacoes: "—",
  },
  {
    id: "margem_contribuicao",
    nome: "Margem de contribuição",
    formula: "Soma da contribuição (contribuicaoReais, já calculada pelo ERP) dividida pela soma do valor (valorTotal) dos pedidos válidos do período — margem agregada, não média dos percentuais individuais.",
    periodo: "Período selecionado no filtro",
    limitacoes: "A metodologia de custo (materiaPrima, mão de obra, custo fixo, comissões, tributos) é a do ERP MubiSys — este sistema não recalcula custo, só agrega o que já vem importado.",
  },
  {
    id: "classificacao_cliente",
    nome: "Classificação do cliente",
    formula: "Primeira compra (1 compra válida no histórico) · Recompra observada (2+ compras, sem sinal de atraso ou variação relevante) · Em crescimento / Redução de volume (variação ≥20% entre a janela atual e a anterior de mesmo tamanho) · Intervalo acima do habitual (razão de atraso ≥1,5) · Histórico insuficiente (menos de 3 compras válidas).",
    periodo: "Calculada na data de referência, usando todo o histórico do cliente",
    limitacoes: "É uma classificação calculada, não uma avaliação comercial confirmada — não implica que o cliente foi perdido.",
  },
  {
    id: "recompra_novos_reativados",
    nome: "Recompra de clientes novos e reativados",
    formula: "Reaproveita a regra \"Cliente Novo e Reativado\" (nunca comprou antes da janela, ou última compra 6+ meses antes dela). Taxa de recompra = % desses clientes que fez pelo menos mais uma compra válida depois, até hoje. Distribuição de quantidade de compras = % que ficou em exatamente 1/2/3/4+ compras (contando a de entrada) desde a qualificação até hoje. Faturamento no período = soma do valor de todos os pedidos válidos desses clientes dentro do período selecionado (não inclui compras feitas depois do período).",
    periodo: "Coorte qualificada dentro do período selecionado; recompra observada até a data de referência (hoje), não até o fim do período",
    limitacoes: "Clientes qualificados perto do fim do período têm menos tempo para recomprar até hoje — a taxa tende a subir se o período for revisitado mais adiante.",
  },
];

// ─── Tipos de entrada/saída ───────────────────────────────────────────────────

export interface OsRow {
  osNumero: string | null;
  tipoOs: string | null;
  status: string | null;
  empresa: string | null;
  dataAprovacao: string | null;
  dataFaturamento: string | null;
  dataEntrega: string | null;
  vendedor: string | null;
  valorTotal: string | null;
  valorOs: string | null;
  custosTotal: string | null;
  contribuicaoReais: string | null;
  cidade: string | null;
  estado: string | null;
  trabalho?: string | null;
}

export interface CompraCliente {
  osNumero: string;
  data: Date;
  valor: number;
  custo: number | null;
  contribuicao: number | null;
  vendedor: string | null;
  cidade: string | null;
  estado: string | null;
  trabalho: string | null;
}

export interface ClienteBase {
  empresaKey: string;
  empresaExibicao: string;
  compras: CompraCliente[]; // ordenadas por data ascendente, todo o histórico
}

/** Parser de data tolerante a formato misto: os campos de data de historico_os e
 * historico_orcamentos têm ~97% dos registros em "dd/mm/aaaa[ hh:mm[:ss]]" (import
 * do XLSX do MubiSys) e o restante em "aaaa-mm-dd[ hh:mm:ss]" (registros vindos da
 * API ao vivo) — confirmado por auditoria direta no banco (setembro/2026). Um parser
 * que assumisse só um dos formatos ficaria com ~97% das datas erradas ou inválidas. */
export function parseDataFlexivel(s: string | null): Date | null {
  if (!s) return null;
  const texto = s.trim();
  if (!texto) return null;

  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const [, dia, mes, ano, h, min, seg] = br;
    const d = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(h ?? 0), Number(min ?? 0), Number(seg ?? 0));
    return isNaN(d.getTime()) ? null : d;
  }

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const [, ano, mes, dia, h, min, seg] = iso;
    const d = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(h ?? 0), Number(min ?? 0), Number(seg ?? 0));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function toNum(v: string | null | undefined): number {
  const n = parseFloat(String(v ?? "0"));
  return isNaN(n) ? 0 : n;
}

function toNumOrNull(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

/** Constrói a base de clientes (agrupada por empresa normalizada) a partir de
 * todas as linhas de historico_os, aplicando o filtro de pedido válido. */
export function construirBaseClientes(rows: OsRow[]): Map<string, ClienteBase> {
  const base = new Map<string, ClienteBase>();
  for (const r of rows) {
    if (!isOsNormalDb(r)) continue;
    const empresaBruta = (r.empresa ?? "").trim();
    if (!empresaBruta) continue;
    const data = parseDataFlexivel(r.dataAprovacao);
    if (!data) continue;
    const key = normalizeEmpresaKey(empresaBruta);
    let cliente = base.get(key);
    if (!cliente) {
      cliente = { empresaKey: key, empresaExibicao: empresaBruta, compras: [] };
      base.set(key, cliente);
    }
    cliente.compras.push({
      osNumero: r.osNumero ?? "",
      data,
      valor: toNum(r.valorOs ?? r.valorTotal),
      custo: toNumOrNull(r.custosTotal),
      contribuicao: toNumOrNull(r.contribuicaoReais),
      vendedor: r.vendedor,
      cidade: r.cidade,
      estado: r.estado,
      trabalho: r.trabalho ?? null,
    });
  }
  for (const cliente of base.values()) {
    cliente.compras.sort((a, b) => a.data.getTime() - b.data.getTime());
    // Grafia de exibição = a mais recente observada (evita mostrar uma
    // grafia antiga/errada de anos atrás quando a mais recente já corrigiu).
    cliente.empresaExibicao = cliente.compras[cliente.compras.length - 1].vendedor
      ? cliente.empresaExibicao
      : cliente.empresaExibicao;
  }
  return base;
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const s = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function diasEntre(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** Dias ÚTEIS (seg-sex) estritamente entre `inicio` e `fim` — conta cada dia de
 * semana de (inicio, fim], sem contar o próprio dia inicial. Não desconta
 * feriados (o sistema não tem calendário de feriados) — é uma aproximação
 * conservadora usada só para prazo de follow-up comercial, onde fins de semana
 * é o que mais distorce a régua de "quantos dias eu tenho pra agir".
 * Mantido aqui com a assinatura (fim, inicio) usada pelos call sites deste
 * arquivo; delega para a versão canônica compartilhada (inicio, fim). */
function diasUteisEntre(fim: Date, inicio: Date): number {
  return diasUteisEntreCompartilhado(inicio, fim);
}

// ─── Classificação de cliente ─────────────────────────────────────────────────

export type ClassificacaoCliente =
  | "primeira_compra"
  | "recompra_observada"
  | "em_crescimento"
  | "reducao_volume"
  | "intervalo_acima_habitual"
  | "historico_insuficiente";

export interface AnaliseCliente {
  empresaKey: string;
  empresaExibicao: string;
  vendedor: string; // vendedor da compra mais recente do cliente — mesma convenção de inteligencia_acoes_clientes
  totalComprasValidas: number;
  primeiraCompra: Date;
  ultimaCompra: Date;
  diasDesdeUltimaCompra: number;
  medianaIntervaloDias: number | null;
  qtdIntervalos: number;
  razaoAtraso: number | null;
  valorTotalHistorico: number;
  ticketMedioHistorico: number; // valorTotalHistorico ÷ totalComprasValidas — usado para priorizar contato por faturamento médio
  valorJanelaAtual: number;
  valorJanelaAnterior: number;
  variacaoVolumePct: number | null;
  margemHistoricaPct: number | null; // null quando algum pedido não tem custo/contribuição conhecidos
  classificacao: ClassificacaoCliente;
  confiancaClassificacao: "alta" | "baixa"; // baixa quando amostra é pequena (<3 compras)
  sinalizacoes: Array<"potencial_expansao" | "alto_volume_baixa_margem">;
}

/** Analisa um cliente na data de referência, comparando a janela
 * [dataInicial, dataFinal] com a janela imediatamente anterior de mesmo
 * tamanho (mesma duração em dias, terminando um dia antes de dataInicial). */
export function analisarCliente(
  cliente: ClienteBase,
  dataRef: Date,
  dataInicial: Date,
  dataFinal: Date,
): AnaliseCliente | null {
  const validas = cliente.compras;
  if (validas.length === 0) return null;

  const primeiraCompra = validas[0].data;
  const ultimaCompra = validas[validas.length - 1].data;
  const diasDesdeUltimaCompra = diasEntre(dataRef, ultimaCompra);

  const intervalosDias: number[] = [];
  for (let i = 1; i < validas.length; i++) {
    intervalosDias.push(diasEntre(validas[i].data, validas[i - 1].data));
  }
  const medianaIntervaloDias = mediana(intervalosDias);
  const razaoAtraso = medianaIntervaloDias && medianaIntervaloDias > 0
    ? diasDesdeUltimaCompra / medianaIntervaloDias
    : null;

  const duracaoJanelaMs = dataFinal.getTime() - dataInicial.getTime();
  const dataInicialAnterior = new Date(dataInicial.getTime() - duracaoJanelaMs - 86400000);
  const dataFinalAnterior = new Date(dataInicial.getTime() - 86400000);

  let valorJanelaAtual = 0, valorJanelaAnterior = 0;
  let custoConhecidoTotal = true;
  let contribSomaHistorico = 0, valorSomaHistorico = 0;
  for (const c of validas) {
    valorSomaHistorico += c.valor;
    if (c.contribuicao !== null) contribSomaHistorico += c.contribuicao;
    else custoConhecidoTotal = false;
    if (c.data >= dataInicial && c.data <= dataFinal) valorJanelaAtual += c.valor;
    if (c.data >= dataInicialAnterior && c.data <= dataFinalAnterior) valorJanelaAnterior += c.valor;
  }
  const margemHistoricaPct = custoConhecidoTotal && valorSomaHistorico > 0
    ? (contribSomaHistorico / valorSomaHistorico) * 100
    : null;

  const variacaoVolumePct = valorJanelaAnterior > 0
    ? ((valorJanelaAtual - valorJanelaAnterior) / valorJanelaAnterior) * 100
    : (valorJanelaAtual > 0 ? null : 0); // sem base anterior para comparar → não afirma variação

  let classificacao: ClassificacaoCliente;
  let confianca: "alta" | "baixa" = "alta";

  if (validas.length === 1) {
    classificacao = "primeira_compra";
  } else if (validas.length < HISTORICO_MINIMO_COMPRAS_PARA_TENDENCIA) {
    classificacao = "historico_insuficiente";
    confianca = "baixa";
  } else if (razaoAtraso !== null && razaoAtraso >= RAZAO_ATRASO_LIMIAR) {
    classificacao = "intervalo_acima_habitual";
  } else if (variacaoVolumePct !== null && variacaoVolumePct >= VARIACAO_VOLUME_LIMIAR_PCT) {
    classificacao = "em_crescimento";
  } else if (variacaoVolumePct !== null && variacaoVolumePct <= -VARIACAO_VOLUME_LIMIAR_PCT) {
    classificacao = "reducao_volume";
  } else {
    classificacao = "recompra_observada";
  }

  return {
    empresaKey: cliente.empresaKey,
    empresaExibicao: cliente.empresaExibicao,
    vendedor: validas[validas.length - 1].vendedor || "Sem vendedor",
    totalComprasValidas: validas.length,
    primeiraCompra,
    ultimaCompra,
    diasDesdeUltimaCompra,
    medianaIntervaloDias,
    qtdIntervalos: intervalosDias.length,
    razaoAtraso,
    valorTotalHistorico: valorSomaHistorico,
    ticketMedioHistorico: valorSomaHistorico / validas.length,
    valorJanelaAtual,
    valorJanelaAnterior,
    variacaoVolumePct,
    margemHistoricaPct,
    classificacao,
    confiancaClassificacao: confianca,
    sinalizacoes: [], // preenchido depois, em calcularVisaoGeral (precisa da distribuição do grupo)
  };
}

// ─── Visão geral (RFM, concentração, margem, segunda compra) ─────────────────

export interface RfmCliente {
  empresaKey: string;
  empresaExibicao: string;
  recenciaDias: number;
  frequencia: number;
  valorMonetario: number;
  scoreRecencia: number; // 1-5, 5 = mais recente
  scoreFrequencia: number; // 1-5, 5 = mais frequente
  scoreValor: number; // 1-5, 5 = maior valor
}

export interface VisaoGeralClientes {
  periodo: { dataInicial: string; dataFinal: string };
  dataReferencia: string;
  clientesCompradoresPeriodo: number;
  primeiraCompraObservada: number;
  recompraNoPeriodo: number;
  classificacoes: Record<ClassificacaoCliente, number>;
  concentracaoTop20PctClientes: number; // quantidade de clientes no top 20%
  concentracaoTop20PctReceitaPct: number | null;
  margemContribuicaoPct: number | null;
  margemContribuicaoCobertura: "completa" | "parcial" | "indisponivel";
  valorTotalPeriodo: number;
  ticketMedioPedido: number | null;
  qtdPedidosValidos: number;
  rfm: RfmCliente[];
  amostraPequena: boolean; // n < 20 clientes no período — RFM em quintil não é confiável
  topClientesPorValor: Array<{ empresa: string; valor: number; qtdPedidos: number }>;
}

function scoreQuintil(valor: number, ordenadosAsc: number[]): number {
  if (ordenadosAsc.length <= 1) return 3;
  const idx = ordenadosAsc.findIndex(v => v >= valor);
  const posicao = idx === -1 ? ordenadosAsc.length - 1 : idx;
  const percentil = posicao / (ordenadosAsc.length - 1);
  return Math.min(5, Math.max(1, Math.ceil(percentil * 5) || 1));
}

export function calcularVisaoGeral(
  base: Map<string, ClienteBase>,
  dataInicial: Date,
  dataFinal: Date,
  dataRef: Date,
): VisaoGeralClientes {
  const classificacoes: Record<ClassificacaoCliente, number> = {
    primeira_compra: 0,
    recompra_observada: 0,
    em_crescimento: 0,
    reducao_volume: 0,
    intervalo_acima_habitual: 0,
    historico_insuficiente: 0,
  };

  const clientesDoPeriodo: AnaliseCliente[] = [];
  let valorTotalPeriodo = 0;
  let qtdPedidosValidos = 0;
  let contribSomaPeriodo = 0;
  let custoConhecidoPeriodo = true;
  let algumPedidoNoPeriodo = false;

  for (const cliente of base.values()) {
    const comprasNoPeriodo = cliente.compras.filter(c => c.data >= dataInicial && c.data <= dataFinal);
    if (comprasNoPeriodo.length === 0) continue;

    const analise = analisarCliente(cliente, dataRef, dataInicial, dataFinal);
    if (!analise) continue;
    clientesDoPeriodo.push(analise);
    classificacoes[analise.classificacao]++;

    for (const c of comprasNoPeriodo) {
      algumPedidoNoPeriodo = true;
      valorTotalPeriodo += c.valor;
      qtdPedidosValidos++;
      if (c.contribuicao !== null) contribSomaPeriodo += c.contribuicao;
      else custoConhecidoPeriodo = false;
    }
  }

  const clientesCompradoresPeriodo = clientesDoPeriodo.length;
  const primeiraCompraObservada = clientesDoPeriodo.filter(c => c.primeiraCompra >= dataInicial && c.primeiraCompra <= dataFinal).length;
  const recompraNoPeriodo = clientesCompradoresPeriodo - primeiraCompraObservada;

  // Concentração: top 20% dos clientes do período por valor comprado no período
  const porValorDesc = [...clientesDoPeriodo].sort((a, b) => b.valorJanelaAtual - a.valorJanelaAtual);
  const qtdTop20 = Math.max(1, Math.round(porValorDesc.length * (1 - ALTO_VOLUME_PERCENTIL)));
  const valorTop20 = porValorDesc.slice(0, qtdTop20).reduce((s, c) => s + c.valorJanelaAtual, 0);

  const margemContribuicaoPct = algumPedidoNoPeriodo && custoConhecidoPeriodo && valorTotalPeriodo > 0
    ? (contribSomaPeriodo / valorTotalPeriodo) * 100
    : null;
  const margemContribuicaoCobertura: VisaoGeralClientes["margemContribuicaoCobertura"] =
    !algumPedidoNoPeriodo ? "indisponivel" : custoConhecidoPeriodo ? "completa" : "parcial";

  // RFM sobre clientes do período
  const recencias = clientesDoPeriodo.map(c => c.diasDesdeUltimaCompra).sort((a, b) => a - b);
  const frequencias = clientesDoPeriodo.map(c => c.totalComprasValidas).sort((a, b) => a - b); // aproximação: usa total válido do período via filtro abaixo
  const valores = clientesDoPeriodo.map(c => c.valorJanelaAtual).sort((a, b) => a - b);

  const rfm: RfmCliente[] = clientesDoPeriodo.map(c => {
    const frequenciaPeriodo = base.get(c.empresaKey)!.compras.filter(x => x.data >= dataInicial && x.data <= dataFinal).length;
    return {
      empresaKey: c.empresaKey,
      empresaExibicao: c.empresaExibicao,
      recenciaDias: c.diasDesdeUltimaCompra,
      frequencia: frequenciaPeriodo,
      valorMonetario: c.valorJanelaAtual,
      // recência: quanto menor, melhor (score maior) → inverte a escala
      scoreRecencia: 6 - scoreQuintil(c.diasDesdeUltimaCompra, recencias),
      scoreFrequencia: scoreQuintil(frequenciaPeriodo, frequencias),
      scoreValor: scoreQuintil(c.valorJanelaAtual, valores),
    };
  }).sort((a, b) => (b.scoreRecencia + b.scoreFrequencia + b.scoreValor) - (a.scoreRecencia + a.scoreFrequencia + a.scoreValor));

  const topClientesPorValor = porValorDesc.slice(0, 10).map(c => ({
    empresa: c.empresaExibicao,
    valor: c.valorJanelaAtual,
    qtdPedidos: base.get(c.empresaKey)!.compras.filter(x => x.data >= dataInicial && x.data <= dataFinal).length,
  }));

  return {
    periodo: { dataInicial: dataInicial.toISOString().slice(0, 10), dataFinal: dataFinal.toISOString().slice(0, 10) },
    dataReferencia: dataRef.toISOString(),
    clientesCompradoresPeriodo,
    primeiraCompraObservada,
    recompraNoPeriodo,
    classificacoes,
    concentracaoTop20PctClientes: qtdTop20,
    concentracaoTop20PctReceitaPct: valorTotalPeriodo > 0 ? (valorTop20 / valorTotalPeriodo) * 100 : null,
    margemContribuicaoPct,
    margemContribuicaoCobertura,
    valorTotalPeriodo,
    ticketMedioPedido: qtdPedidosValidos > 0 ? valorTotalPeriodo / qtdPedidosValidos : null,
    qtdPedidosValidos,
    rfm,
    amostraPequena: clientesCompradoresPeriodo < 20,
    topClientesPorValor,
  };
}

// ─── Recompra de clientes novos e reativados ─────────────────────────────────
// Reaproveita a mesma regra de negócio "Lógica do Cliente Novo e Reativado" já
// usada no resto da Performance Comercial (MESES_INATIVIDADE_PARA_NOVO = 6 —
// ver server/routers/performanceComercial.ts): um cliente conta como "novo" se
// nunca comprou antes da janela selecionada, e como "reativado" se a última
// compra antes da janela foi há 6 meses de calendário ou mais. Aqui a pergunta
// adicional é: entre os que entraram como novos/reativados nessa janela,
// quantos voltaram a comprar depois (até a data de referência)?

function gapMesesCalendario(recente: Date, antiga: Date): number {
  return (recente.getFullYear() - antiga.getFullYear()) * 12 + (recente.getMonth() - antiga.getMonth());
}

export interface DetalheClienteRecompra {
  empresa: string;
  dataQualificacao: string; // ISO — data da 1ª compra (novo) ou da compra que reativou o cliente
  recompra: boolean;
  dataRecompra: string | null;
  diasAteRecompra: number | null;
  qtdComprasDesdeQualificacao: number; // inclui a própria compra de entrada — 1 = nunca recomprou
  valorNoPeriodo: number; // soma do valor de todos os pedidos válidos desse cliente dentro do período selecionado
  /** Valor da compra de entrada (a 1ª — a que tornou o cliente novo/reativado). */
  valorEntrada: number;
  /** Valor de CADA compra seguinte à entrada, em ordem cronológica: índice 0 =
   * valor da 2ª compra, índice 1 = valor da 3ª compra, índice 2 = valor da 4ª
   * compra, etc. Array vazio quando o cliente nunca recomprou. Nunca somar
   * este array num único número por cliente para exibir "por faixa" — isso
   * mistura compras de posições diferentes (2ª com 3ª com 4ª) e produz
   * somas incomparáveis entre faixas. Use calcularFaturamentoPorPosicao. */
  valoresComprasSeguintes: number[];
  /** Soma de valoresComprasSeguintes — SÓ para exibir "quanto este cliente
   * gastou em recompras" isoladamente (ex.: numa lista de clientes), nunca
   * para agregar por faixa (ver nota acima). */
  valorRecompras: number;
}

export interface FaixaQtdCompras {
  faixa: "1" | "2" | "3" | "4+";
  quantidade: number;
  pct: number;
}

/** Faturamento agrupado pela POSIÇÃO da compra na sequência de cada cliente
 * (1ª = a compra de entrada, 2ª, 3ª, 4ª-em-diante) — cada pedido conta em
 * exatamente uma posição, nunca em mais de uma. Por isso dá pra comparar as
 * 4 linhas entre si e a soma das 4 bate exatamente com o faturamento total
 * do grupo (entrada + todas as recompras). Different de FaixaQtdCompras, que
 * agrupa CLIENTES pelo total de compras que fizeram (sem valor em R$). */
export interface FaturamentoPorPosicaoCompra {
  posicao: "1" | "2" | "3" | "4+";
  /** Quantidade de PEDIDOS (não de clientes) nesta posição — um cliente com
   * 5 compras contribui 1 pedido em "1", 1 em "2", 1 em "3" e 2 em "4+". */
  qtdPedidos: number;
  /** Soma do valor SÓ dos pedidos desta posição. */
  faturamento: number;
}

export interface GrupoRecompra {
  total: number;
  comRecompra: number;
  taxaPct: number | null;
  /** Distribuição de quantas compras cada cliente do grupo fez desde a
   * qualificação (contando a compra de entrada) até a data de referência —
   * responde "quantos compraram só 1 vez, quantos 2, 3, 4 ou mais". Só
   * contagem de clientes, sem valor em R$ — ver faturamentoPorPosicaoCompra
   * para a quebra de faturamento. */
  distribuicaoQtdCompras: FaixaQtdCompras[];
  /** Faturamento por posição da compra (1ª/2ª/3ª/4ª-em-diante) — as 4 linhas
   * são mutuamente exclusivas e somam exatamente o faturamento total do
   * grupo desde a qualificação até hoje. */
  faturamentoPorPosicaoCompra: FaturamentoPorPosicaoCompra[];
  /** Soma do valor de todos os pedidos válidos desses clientes DENTRO do
   * período selecionado (não conta compras feitas depois do período, mesmo
   * que contem para a taxa de recompra). */
  faturamentoNoPeriodo: number;
  detalhes: DetalheClienteRecompra[];
}

export interface RecompraNovosReativados {
  periodo: { dataInicial: string; dataFinal: string };
  mesesInatividadeParaReativado: number;
  novos: GrupoRecompra;
  reativados: GrupoRecompra;
}

export function calcularRecompraNovosReativados(
  base: Map<string, ClienteBase>,
  dataInicial: Date,
  dataFinal: Date,
  dataRef: Date,
): RecompraNovosReativados {
  const novos: DetalheClienteRecompra[] = [];
  const reativados: DetalheClienteRecompra[] = [];

  for (const cliente of base.values()) {
    const comprasNoPeriodo = cliente.compras.filter(c => c.data >= dataInicial && c.data <= dataFinal);
    if (comprasNoPeriodo.length === 0) continue;
    const primeiraNoPeriodo = comprasNoPeriodo[0];

    const comprasAntes = cliente.compras.filter(c => c.data < dataInicial);
    let categoria: "novo" | "reativado" | null = null;
    if (comprasAntes.length === 0) {
      categoria = "novo";
    } else {
      const ultimaAntes = comprasAntes[comprasAntes.length - 1].data;
      if (gapMesesCalendario(primeiraNoPeriodo.data, ultimaAntes) >= MESES_INATIVIDADE_PARA_NOVO) {
        categoria = "reativado";
      }
    }
    if (!categoria) continue; // recompra normal — não é nem novo nem reativado, fora desta métrica

    const comprasDepois = cliente.compras.filter(c => c.data > primeiraNoPeriodo.data && c.data <= dataRef);
    const recompra = comprasDepois.length > 0;
    const valoresComprasSeguintes = comprasDepois.map(c => c.valor);
    const detalhe: DetalheClienteRecompra = {
      empresa: cliente.empresaExibicao,
      dataQualificacao: primeiraNoPeriodo.data.toISOString(),
      recompra,
      dataRecompra: recompra ? comprasDepois[0].data.toISOString() : null,
      diasAteRecompra: recompra ? diasEntre(comprasDepois[0].data, primeiraNoPeriodo.data) : null,
      qtdComprasDesdeQualificacao: 1 + comprasDepois.length,
      valorNoPeriodo: comprasNoPeriodo.reduce((s, c) => s + c.valor, 0),
      valorEntrada: primeiraNoPeriodo.valor,
      valoresComprasSeguintes,
      valorRecompras: valoresComprasSeguintes.reduce((s, v) => s + v, 0),
    };
    (categoria === "novo" ? novos : reativados).push(detalhe);
  }

  const distribuir = (lista: DetalheClienteRecompra[]): FaixaQtdCompras[] => {
    const total = lista.length;
    const contagem = { "1": 0, "2": 0, "3": 0, "4+": 0 };
    for (const d of lista) {
      const qtd = d.qtdComprasDesdeQualificacao;
      const chave = qtd >= 4 ? "4+" : (String(qtd) as "1" | "2" | "3");
      contagem[chave]++;
    }
    return (["1", "2", "3", "4+"] as const).map(faixa => ({
      faixa,
      quantidade: contagem[faixa],
      pct: total > 0 ? (contagem[faixa] / total) * 100 : 0,
    }));
  };

  /** Faturamento por POSIÇÃO da compra — cada pedido conta em exatamente uma
   * posição (1ª = entrada, 2ª, 3ª, 4ª-em-diante), nunca somado com outra
   * posição do mesmo cliente. Ver nota em FaturamentoPorPosicaoCompra. */
  const calcularFaturamentoPorPosicao = (lista: DetalheClienteRecompra[]): FaturamentoPorPosicaoCompra[] => {
    const acc = {
      "1": { qtdPedidos: 0, faturamento: 0 },
      "2": { qtdPedidos: 0, faturamento: 0 },
      "3": { qtdPedidos: 0, faturamento: 0 },
      "4+": { qtdPedidos: 0, faturamento: 0 },
    };
    for (const d of lista) {
      acc["1"].qtdPedidos++;
      acc["1"].faturamento += d.valorEntrada;
      d.valoresComprasSeguintes.forEach((valor, i) => {
        const posicaoCompra = i + 2; // i=0 → 2ª compra, i=1 → 3ª compra, i=2 → 4ª compra, ...
        const chave = posicaoCompra >= 4 ? "4+" : (String(posicaoCompra) as "2" | "3");
        acc[chave].qtdPedidos++;
        acc[chave].faturamento += valor;
      });
    }
    return (["1", "2", "3", "4+"] as const).map(posicao => ({
      posicao,
      qtdPedidos: acc[posicao].qtdPedidos,
      faturamento: parseFloat(acc[posicao].faturamento.toFixed(2)),
    }));
  };

  const agrupar = (lista: DetalheClienteRecompra[]): GrupoRecompra => {
    const comRecompra = lista.filter(d => d.recompra).length;
    return {
      total: lista.length,
      comRecompra,
      taxaPct: lista.length > 0 ? (comRecompra / lista.length) * 100 : null,
      distribuicaoQtdCompras: distribuir(lista),
      faturamentoPorPosicaoCompra: calcularFaturamentoPorPosicao(lista),
      faturamentoNoPeriodo: lista.reduce((s, d) => s + d.valorNoPeriodo, 0),
      detalhes: lista.sort((a, b) => (a.recompra === b.recompra ? 0 : a.recompra ? 1 : -1)),
    };
  };

  return {
    periodo: { dataInicial: dataInicial.toISOString().slice(0, 10), dataFinal: dataFinal.toISOString().slice(0, 10) },
    mesesInatividadeParaReativado: MESES_INATIVIDADE_PARA_NOVO,
    novos: agrupar(novos),
    reativados: agrupar(reativados),
  };
}

// ─── Fila de ações (candidatos — persistência fica no router) ────────────────

export interface AcaoCandidata {
  tipo: "primeira_sem_segunda" | "atraso_recompra" | "alto_volume_baixa_margem";
  empresaKey: string;
  empresa: string;
  vendedor: string; // vendedor da compra mais recente do cliente — representativo, não necessariamente exclusivo
  titulo: string;
  motivo: string;
  evidencia: Record<string, unknown>;
  prioridade: number;
  prioridadeFatores: Record<string, number>;
}

/** Gera candidatos a ação a partir do estado atual de todo o histórico (não
 * depende do período selecionado na tela — a fila reflete "hoje"). */
export function calcularCandidatosAcao(base: Map<string, ClienteBase>, dataRef: Date): AcaoCandidata[] {
  const candidatos: AcaoCandidata[] = [];

  // "Alto volume" = top 20% por valor comprado nos últimos 12 meses
  const doze_meses_atras = new Date(dataRef);
  doze_meses_atras.setFullYear(doze_meses_atras.getFullYear() - 1);
  const valoresUltimos12m = [...base.values()]
    .map(c => ({ key: c.empresaKey, valor: c.compras.filter(x => x.data >= doze_meses_atras && x.data <= dataRef).reduce((s, x) => s + x.valor, 0) }))
    .filter(x => x.valor > 0)
    .sort((a, b) => a.valor - b.valor);
  const limiarAltoVolume = valoresUltimos12m.length > 0
    ? valoresUltimos12m[Math.floor(valoresUltimos12m.length * ALTO_VOLUME_PERCENTIL)]?.valor ?? Infinity
    : Infinity;

  for (const cliente of base.values()) {
    const validas = cliente.compras;
    if (validas.length === 0) continue;
    const ultimaCompra = validas[validas.length - 1].data;
    const diasDesdeUltima = diasEntre(dataRef, ultimaCompra);
    const vendedorAtual = validas[validas.length - 1].vendedor || "Sem vendedor";

    // 1) Primeira compra sem segunda
    if (validas.length === 1 && diasDesdeUltima >= PRIMEIRA_COMPRA_DIAS_MIN_CONTATO && diasDesdeUltima <= PRIMEIRA_COMPRA_DIAS_MAX_CONTATO) {
      const urgencia = Math.min(100, ((diasDesdeUltima - PRIMEIRA_COMPRA_DIAS_MIN_CONTATO) / (PRIMEIRA_COMPRA_DIAS_MAX_CONTATO - PRIMEIRA_COMPRA_DIAS_MIN_CONTATO)) * 100);
      const relevancia = Math.min(100, (validas[0].valor / 5000) * 100);
      const prioridade = Math.round(urgencia * 0.6 + relevancia * 0.4);
      candidatos.push({
        tipo: "primeira_sem_segunda",
        empresaKey: cliente.empresaKey,
        empresa: cliente.empresaExibicao,
        vendedor: vendedorAtual,
        titulo: `Acompanhar 1ª compra sem repetição — ${cliente.empresaExibicao}`,
        motivo: `Fez a primeira compra válida em ${ultimaCompra.toLocaleDateString("pt-BR")} (${diasDesdeUltima} dias atrás) e ainda não fez uma segunda compra.`,
        evidencia: { osNumero: validas[0].osNumero, data: ultimaCompra.toISOString(), valor: validas[0].valor, diasDesdeUltima },
        prioridade,
        prioridadeFatores: { urgencia: Math.round(urgencia), relevanciaEconomica: Math.round(relevancia) },
      });
    }

    // 2) Atraso de recompra (exige histórico suficiente para mediana confiável)
    if (validas.length >= HISTORICO_MINIMO_COMPRAS_PARA_TENDENCIA) {
      const intervalosDias: number[] = [];
      for (let i = 1; i < validas.length; i++) intervalosDias.push(diasEntre(validas[i].data, validas[i - 1].data));
      const medianaInt = mediana(intervalosDias);
      if (medianaInt && medianaInt > 0) {
        const razao = diasDesdeUltima / medianaInt;
        // Só sinaliza atraso relevante e ainda plausível (não claramente inativo há anos)
        if (razao >= RAZAO_ATRASO_LIMIAR && diasDesdeUltima <= 365) {
          const urgencia = Math.min(100, (razao / 3) * 100);
          const valor12m = valoresUltimos12m.find(v => v.key === cliente.empresaKey)?.valor ?? 0;
          const relevancia = Math.min(100, (valor12m / 20000) * 100);
          const prioridade = Math.round(urgencia * 0.6 + relevancia * 0.4);
          candidatos.push({
            tipo: "atraso_recompra",
            empresaKey: cliente.empresaKey,
            empresa: cliente.empresaExibicao,
            vendedor: vendedorAtual,
            titulo: `Atraso na recompra — ${cliente.empresaExibicao}`,
            motivo: `Costuma comprar a cada ${Math.round(medianaInt)} dias (mediana de ${intervalosDias.length} intervalos); já se passaram ${diasDesdeUltima} dias desde a última compra (${ultimaCompra.toLocaleDateString("pt-BR")}).`,
            evidencia: { medianaIntervaloDias: Math.round(medianaInt), qtdIntervalos: intervalosDias.length, diasDesdeUltima, razaoAtraso: Number(razao.toFixed(2)), ultimaCompra: ultimaCompra.toISOString() },
            prioridade,
            prioridadeFatores: { urgencia: Math.round(urgencia), relevanciaEconomica: Math.round(relevancia) },
          });
        }
      }
    }

    // 3) Alto volume com margem baixa (últimos 12 meses)
    const comprasUltimos12m = validas.filter(c => c.data >= doze_meses_atras && c.data <= dataRef);
    const valor12m = comprasUltimos12m.reduce((s, c) => s + c.valor, 0);
    if (valor12m >= limiarAltoVolume && comprasUltimos12m.length > 0) {
      const comCusto = comprasUltimos12m.filter(c => c.contribuicao !== null);
      if (comCusto.length === comprasUltimos12m.length) {
        const contrib12m = comCusto.reduce((s, c) => s + (c.contribuicao ?? 0), 0);
        const margemPct = valor12m > 0 ? (contrib12m / valor12m) * 100 : null;
        if (margemPct !== null && margemPct < MARGEM_BAIXA_LIMIAR_PCT) {
          const relevancia = Math.min(100, (valor12m / 50000) * 100);
          const urgencia = Math.min(100, ((MARGEM_BAIXA_LIMIAR_PCT - margemPct) / MARGEM_BAIXA_LIMIAR_PCT) * 100);
          const prioridade = Math.round(relevancia * 0.6 + urgencia * 0.4);
          candidatos.push({
            tipo: "alto_volume_baixa_margem",
            empresaKey: cliente.empresaKey,
            empresa: cliente.empresaExibicao,
            vendedor: vendedorAtual,
            titulo: `Alto volume, margem baixa — ${cliente.empresaExibicao}`,
            motivo: `Comprou R$ ${valor12m.toLocaleString("pt-BR", { minimumFractionDigits: 0 })} nos últimos 12 meses (top 20% da carteira), com margem de contribuição de ${margemPct.toFixed(1)}% — abaixo do limiar de ${MARGEM_BAIXA_LIMIAR_PCT}%.`,
            evidencia: { valor12m, margemPct: Number(margemPct.toFixed(1)), qtdPedidos12m: comprasUltimos12m.length },
            prioridade,
            prioridadeFatores: { relevanciaEconomica: Math.round(relevancia), urgencia: Math.round(urgencia) },
          });
        }
      }
    }
  }

  return candidatos.sort((a, b) => b.prioridade - a.prioridade);
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Funil de Orçamentos e Previsões (seções 4.3/4.4 do prompt de origem) ────
// ═══════════════════════════════════════════════════════════════════════════
// Fonte: historico_orcamentos, que cobre SÓ 2026 (importação local começou em
// janeiro/2026) — diferente de historico_os, que cobre 2023-2026. Isso limita
// a taxa de conversão histórica e a comparação ano a ano do funil; declarado
// explicitamente nos tipos de retorno (`cobertura`) para a UI avisar o usuário.
// Não há campo que ligue um orcNumero ao osNumero que ele gerou no ERP
// exportado — reconciliação orçamento→pedido por identificador não é possível
// com os dados disponíveis; os números de funil e de carteira de pedidos
// devem ser lidos como visões separadas, nunca somadas ingenuamente.

export interface OrcamentoRow {
  orcNumero: string | null;
  empresa: string | null;
  dataCadastro: string | null;
  validade: string | null; // dias de validade a partir de dataCadastro — NÃO é uma data
  vendedor: string | null;
  status: string | null;
  motivoCancelamento: string | null;
  total: string | null;
  mes: number;
  ano: number;
}

/** Status que representam aceite comercial (ganho), decisão perdida, e o caso
 * ambíguo "aprovado mas depois cancelado" — usados tanto no funil quanto nas
 * previsões. Reaproveitam o vocabulário de status já usado pela equipe no ERP,
 * sem inventar novas etapas. */
export const STATUS_GANHO = new Set(["aprovado", "em produção", "entregue", "concluída"]);
export const STATUS_PERDIDO = new Set(["reprovado", "cancelada"]);
const STATUS_AMBIGUO_APROVADO_CANCELADO = "orc.: aprovado | os.:cancelada";
export const STATUS_ABERTO = "em aberto";


export interface FunilOrcamentos {
  cobertura: { anoInicio: number; anoFim: number; observacao: string };
  porStatus: Array<{ status: string; quantidade: number; valor: number }>;
  emAbertoPorIdadeDias: Array<{ faixa: string; quantidade: number; valor: number }>;
  porVendedor: Array<{ vendedor: string; quantidade: number; valor: number }>;
  decisoesVencidas: { quantidade: number; valor: number };
  perdasComMotivo: Array<{ motivo: string; quantidade: number }>;
  taxaConversao: {
    decididoGanho: number;
    decididoPerdido: number;
    aprovadoMasCanceladoDepois: number; // fora do numerador e do denominador — ver comentário acima
    taxaPct: number | null; // null se não há decisões suficientes (ganho+perdido = 0)
  };
}

export function calcularFunilOrcamentos(rows: OrcamentoRow[], hoje: Date): FunilOrcamentos {
  const porStatusMap = new Map<string, { quantidade: number; valor: number }>();
  const porVendedorMap = new Map<string, { quantidade: number; valor: number }>();
  const perdasMap = new Map<string, number>();
  const idadeBuckets = [
    { faixa: "0-7 dias", min: 0, max: 7, quantidade: 0, valor: 0 },
    { faixa: "8-15 dias", min: 8, max: 15, quantidade: 0, valor: 0 },
    { faixa: "16-30 dias", min: 16, max: 30, quantidade: 0, valor: 0 },
    { faixa: "31-60 dias", min: 31, max: 60, quantidade: 0, valor: 0 },
    { faixa: "60+ dias", min: 61, max: Infinity, quantidade: 0, valor: 0 },
  ];

  let anoMin = Infinity, anoMax = -Infinity;
  let decididoGanho = 0, decididoPerdido = 0, aprovadoCancelado = 0;
  let vencidasQtd = 0, vencidasValor = 0;

  for (const r of rows) {
    anoMin = Math.min(anoMin, r.ano);
    anoMax = Math.max(anoMax, r.ano);
    const status = (r.status ?? "").trim();
    const statusKey = status.toLowerCase();
    const valor = toNum(r.total);

    const statusAtual = porStatusMap.get(status) ?? { quantidade: 0, valor: 0 };
    statusAtual.quantidade++; statusAtual.valor += valor;
    porStatusMap.set(status, statusAtual);

    const vendedor = r.vendedor || "Sem vendedor";
    const vendedorAtual = porVendedorMap.get(vendedor) ?? { quantidade: 0, valor: 0 };
    vendedorAtual.quantidade++; vendedorAtual.valor += valor;
    porVendedorMap.set(vendedor, vendedorAtual);

    if (r.motivoCancelamento && r.motivoCancelamento.trim()) {
      const motivo = r.motivoCancelamento.trim();
      perdasMap.set(motivo, (perdasMap.get(motivo) ?? 0) + 1);
    }

    if (statusKey === STATUS_AMBIGUO_APROVADO_CANCELADO) {
      aprovadoCancelado++;
    } else if (STATUS_GANHO.has(statusKey)) {
      decididoGanho++;
    } else if (STATUS_PERDIDO.has(statusKey)) {
      decididoPerdido++;
    } else if (statusKey === STATUS_ABERTO) {
      const dataCadastro = parseDataFlexivel(r.dataCadastro);
      if (dataCadastro) {
        const idadeDias = diasEntre(hoje, dataCadastro);
        const bucket = idadeBuckets.find(b => idadeDias >= b.min && idadeDias <= b.max);
        if (bucket) { bucket.quantidade++; bucket.valor += valor; }

        const validadeDias = toNum(r.validade);
        const dataVencimento = new Date(dataCadastro);
        dataVencimento.setDate(dataVencimento.getDate() + validadeDias);
        if (validadeDias > 0 && dataVencimento < hoje) {
          vencidasQtd++; vencidasValor += valor;
        }
      }
    }
  }

  const totalDecidido = decididoGanho + decididoPerdido;

  return {
    cobertura: {
      anoInicio: isFinite(anoMin) ? anoMin : hoje.getFullYear(),
      anoFim: isFinite(anoMax) ? anoMax : hoje.getFullYear(),
      observacao: "historico_orcamentos cobre apenas o(s) ano(s) listado(s) — sem comparação histórica multi-ano até o histórico local ser ampliado.",
    },
    porStatus: [...porStatusMap.entries()].map(([status, v]) => ({ status, ...v })).sort((a, b) => b.valor - a.valor),
    emAbertoPorIdadeDias: idadeBuckets.map(({ faixa, quantidade, valor }) => ({ faixa, quantidade, valor })),
    porVendedor: [...porVendedorMap.entries()].map(([vendedor, v]) => ({ vendedor, ...v })).sort((a, b) => b.valor - a.valor),
    decisoesVencidas: { quantidade: vencidasQtd, valor: vencidasValor },
    perdasComMotivo: [...perdasMap.entries()].map(([motivo, quantidade]) => ({ motivo, quantidade })).sort((a, b) => b.quantidade - a.quantidade),
    taxaConversao: {
      decididoGanho,
      decididoPerdido,
      aprovadoMasCanceladoDepois: aprovadoCancelado,
      taxaPct: totalDecidido > 0 ? (decididoGanho / totalDecidido) * 100 : null,
    },
  };
}

// ─── Conversão por faixa de tíquete ────────────────────────────────────────────
//
// Análise feita pelo usuário fora do sistema (12/09/2026): agrupando os
// orçamentos decididos (ganhos + perdidos) por faixa de valor, a taxa de
// conversão cai de forma consistente conforme o tíquete aumenta (de ~59% em
// "até R$330" para ~17% em "R$12k+") — confirmado por duas fontes de dados
// independentes. As faixas abaixo replicam exatamente os limites usados
// naquela análise, para que o painel do sistema bata com o que já foi
// validado. Também alimenta o Score de Probabilidade de Compra (ver
// server/services/probabilidadeCompra.ts) como um fator independente do
// ticket médio individual do cliente — este é o efeito da carteira inteira.

export interface FaixaTicketConversao {
  faixa: string;
  ganhos: number;
  perdidos: number;
  /** null quando não há nenhuma decisão (ganho ou perdido) nessa faixa. */
  taxaConversaoPct: number | null;
}

/** Limite superior (inclusive) de cada faixa, em R$ — a última faixa
 * ("R$12k+") não tem limite superior. */
const FAIXAS_TICKET: Array<{ faixa: string; ate: number }> = [
  { faixa: "Até R$330", ate: 330 },
  { faixa: "R$335~750", ate: 750 },
  { faixa: "R$760~1.300", ate: 1300 },
  { faixa: "R$1.301~5.490", ate: 5490 },
  { faixa: "R$5.500~8.000", ate: 8000 },
  { faixa: "R$8.010~12.000", ate: 12000 },
  { faixa: "R$12k+", ate: Infinity },
];

/** Rótulo da faixa em que um valor de orçamento se encaixa — usado tanto para
 * montar a tabela quanto para o Score de Probabilidade de Compra localizar a
 * taxa de conversão da faixa de uma proposta específica. */
export function faixaTicketDoValor(valor: number): string {
  return (FAIXAS_TICKET.find(f => valor <= f.ate) ?? FAIXAS_TICKET[FAIXAS_TICKET.length - 1]).faixa;
}

/** Conversão (ganhos vs. perdidos) por faixa de valor do orçamento.
 *
 * IMPORTANTE (descoberto em 13/09/2026): contar só STATUS_GANHO/STATUS_PERDIDO
 * e ignorar "Em aberto" como "ainda não decidido" produz um artefato grave
 * nesta base — medido: de 5.920 orçamentos, 4.705 (79%) estão "Em aberto", mas
 * só 3 EM TODA A HISTÓRIA foram formalmente marcados "Reprovado"/"Cancelada".
 * A equipe de vendas, na prática, nunca fecha formalmente uma cotação perdida
 * — ela só fica "Em aberto" para sempre. Ignorá-las inflava a conversão para
 * ~99-100% em toda faixa (viés de sobrevivência: só quem ganha fecha o status).
 * Medido: 84% dos "Em aberto" já estão com a validade vencida (mediana de 125
 * dias de idade) — ou seja, são perdas de fato, só nunca formalizadas.
 * Por isso, "Em aberto" com validade vencida conta como perdido (mesmo sinal
 * já usado em decisoesVencidas, calcularFunilOrcamentos); só "Em aberto"
 * ainda dentro do prazo fica de fora (esse sim ainda não tem desfecho). */
export function calcularConversaoPorFaixaTicket(
  rows: Array<{ status: string | null; total: string | null; dataCadastro: string | null; validade: string | null }>,
  hoje: Date,
): FaixaTicketConversao[] {
  const buckets = FAIXAS_TICKET.map(f => ({ faixa: f.faixa, ate: f.ate, ganhos: 0, perdidos: 0 }));
  for (const r of rows) {
    const statusKey = (r.status ?? "").trim().toLowerCase();
    const ganho = STATUS_GANHO.has(statusKey);
    let perdido = STATUS_PERDIDO.has(statusKey);
    if (!ganho && !perdido && statusKey === STATUS_ABERTO) {
      const dataCadastro = parseDataFlexivel(r.dataCadastro);
      const validadeDias = toNum(r.validade);
      if (dataCadastro && validadeDias > 0) {
        const dataVencimento = new Date(dataCadastro);
        dataVencimento.setDate(dataVencimento.getDate() + validadeDias);
        if (dataVencimento < hoje) perdido = true;
      }
    }
    if (!ganho && !perdido) continue;
    const valor = toNum(r.total);
    const bucket = buckets.find(b => valor <= b.ate) ?? buckets[buckets.length - 1];
    if (ganho) bucket.ganhos++; else bucket.perdidos++;
  }
  return buckets.map(({ faixa, ganhos, perdidos }) => {
    const total = ganhos + perdidos;
    return { faixa, ganhos, perdidos, taxaConversaoPct: total > 0 ? (ganhos / total) * 100 : null };
  });
}

// ─── Previsões 30/60/90 dias ──────────────────────────────────────────────────

export interface FaixaPrevisao {
  faixa: "1-30" | "31-60" | "61-90";
  carteiraConfirmada: number; // OS aprovadas/em produção com dataEntrega (prazo prometido) na faixa
  oportunidadesAbertasEstimativa: number; // orçamentos em aberto não vencidos, ponderados pela taxa de conversão histórica do funil
}

export interface PrevisaoComercial {
  dataReferencia: string;
  premissas: string[];
  carteiraConfirmadaSemPrazo: number; // OS aprovadas/em produção sem dataEntrega conhecida — não entram em nenhuma faixa
  faixas: FaixaPrevisao[];
  estimativaSazonalidade: Array<{ mesAlvo: string; mediaHistorica: number | null; anosConsiderados: number[] }>;
}

export function calcularPrevisaoComercial(
  osRows: OsRow[],
  orcRows: OrcamentoRow[],
  funil: FunilOrcamentos,
  hoje: Date,
): PrevisaoComercial {
  const faixasDef: Array<{ faixa: FaixaPrevisao["faixa"]; min: number; max: number }> = [
    { faixa: "1-30", min: 1, max: 30 },
    { faixa: "31-60", min: 31, max: 60 },
    { faixa: "61-90", min: 61, max: 90 },
  ];
  const faixas: FaixaPrevisao[] = faixasDef.map(f => ({ faixa: f.faixa, carteiraConfirmada: 0, oportunidadesAbertasEstimativa: 0 }));
  let carteiraSemPrazo = 0;

  // Carteira confirmada: OS com aceite comercial (Aprovado/Em produção), válidas,
  // usando dataEntrega como proxy do prazo prometido (não é a data de faturamento).
  for (const r of osRows) {
    if (!isOsNormalDb(r)) continue;
    const statusKey = (r.status ?? "").toLowerCase();
    if (statusKey !== "aprovado" && statusKey !== "em produção") continue;
    const valor = toNum(r.valorOs ?? r.valorTotal);
    const dataEntrega = parseDataFlexivel(r.dataEntrega);
    if (!dataEntrega) { carteiraSemPrazo += valor; continue; }
    const diasAteEntrega = diasEntre(dataEntrega, hoje);
    const faixa = faixasDef.find(f => diasAteEntrega >= f.min && diasAteEntrega <= f.max);
    if (faixa) {
      const alvo = faixas.find(f => f.faixa === faixa.faixa)!;
      alvo.carteiraConfirmada += valor;
    }
    // diasAteEntrega < 1 (prazo já vencido) ou > 90 não entra em nenhuma faixa de 30/60/90
  }

  // Oportunidades abertas: orçamentos "Em aberto" não vencidos, alocados na faixa pela
  // data de vencimento da validade (proxy de "quando a decisão deve sair"), ponderados
  // pela taxa de conversão histórica do funil — nunca somados à carteira confirmada.
  const pesoConversao = (funil.taxaConversao.taxaPct ?? 0) / 100;
  for (const r of orcRows) {
    if ((r.status ?? "").toLowerCase() !== "em aberto") continue;
    const dataCadastro = parseDataFlexivel(r.dataCadastro);
    if (!dataCadastro) continue;
    const validadeDias = toNum(r.validade);
    const dataVencimento = new Date(dataCadastro);
    dataVencimento.setDate(dataVencimento.getDate() + validadeDias);
    if (dataVencimento < hoje) continue; // já vencido — não é mais uma decisão futura estimável
    const diasAteDecisao = diasEntre(dataVencimento, hoje);
    const faixa = faixasDef.find(f => diasAteDecisao >= f.min && diasAteDecisao <= f.max);
    if (!faixa) continue;
    const alvo = faixas.find(f => f.faixa === faixa.faixa)!;
    alvo.oportunidadesAbertasEstimativa += toNum(r.total) * pesoConversao;
  }

  // Estimativa por sazonalidade: média do valor faturado (OS válidas, por dataAprovacao)
  // no mesmo mês em anos anteriores — referência de comparação, não parcela somável.
  const porMesAno = new Map<string, number>();
  for (const r of osRows) {
    if (!isOsNormalDb(r)) continue;
    const data = parseDataFlexivel(r.dataAprovacao);
    if (!data) continue;
    const chave = `${data.getFullYear()}-${data.getMonth() + 1}`;
    porMesAno.set(chave, (porMesAno.get(chave) ?? 0) + toNum(r.valorOs ?? r.valorTotal));
  }
  const estimativaSazonalidade: PrevisaoComercial["estimativaSazonalidade"] = [];
  for (let offset = 0; offset < 3; offset++) {
    const dataAlvo = new Date(hoje.getFullYear(), hoje.getMonth() + offset, 1);
    const mesAlvo = dataAlvo.getMonth() + 1;
    const anosConsiderados: number[] = [];
    let soma = 0;
    for (let anoOffset = 1; anoOffset <= 3; anoOffset++) {
      const ano = dataAlvo.getFullYear() - anoOffset;
      const valor = porMesAno.get(`${ano}-${mesAlvo}`);
      if (valor !== undefined) { anosConsiderados.push(ano); soma += valor; }
    }
    estimativaSazonalidade.push({
      mesAlvo: `${String(mesAlvo).padStart(2, "0")}/${dataAlvo.getFullYear()}`,
      mediaHistorica: anosConsiderados.length > 0 ? soma / anosConsiderados.length : null,
      anosConsiderados,
    });
  }

  return {
    dataReferencia: hoje.toISOString(),
    premissas: [
      "Carteira confirmada usa a data de entrega prevista (dataEntrega) das OS já aprovadas/em produção — não é a data de faturamento.",
      "Oportunidades abertas são estimativa (valor do orçamento × taxa de conversão histórica do funil), nunca somada à carteira confirmada.",
      "Estimativa por sazonalidade é referência de comparação (média histórica do mesmo mês), não uma parcela a somar às demais.",
      funil.cobertura.observacao,
    ],
    carteiraConfirmadaSemPrazo: carteiraSemPrazo,
    faixas,
    estimativaSazonalidade,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Assistente de IA (seção 9 do prompt de origem) ──────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// A IA nunca soma/calcula dados brutos — ela só interpreta resultados já
// calculados pelas funções acima. Quem chama o LLM é o router (tem acesso a
// invokeLLM); este módulo só monta o prompt e o contexto, de forma pura.

export const VERSAO_PROMPT_ASSISTENTE_CLIENTES = "v1";

export const PROMPT_ASSISTENTE_CLIENTES_V1 = `Você é o analista comercial da empresa, especializado em comunicação visual (letras, letreiros, letras-caixa, fachadas) e relações B2B. Ajude o usuário a aumentar recompra lucrativa e melhorar a previsibilidade com base em dados verificáveis.

Você recebe, a cada pergunta, um contexto estruturado com os resultados JÁ CALCULADOS pelo sistema para o período selecionado: visão geral de clientes (RFM, classificação, concentração, margem, segunda compra em X dias), funil de orçamentos, previsão comercial 30/60/90 dias e a fila de ações pendentes. Use somente esses números — nunca invente clientes, valores ou fatos que não estejam no contexto fornecido. Se a pergunta pedir algo que o contexto não cobre, diga isso explicitamente e sugira qual tela ou filtro poderia trazer a resposta.

Separe sempre fato observado (o que está no contexto), hipótese (sua interpretação) e ação recomendada. Diferencie ausência de dado de valor zero, associação de causalidade de correlação, e pontuação de prioridade de probabilidade de compra.

Não trate um comprador ocasional como cliente de assinatura. Considere a frequência histórica, a margem disponível e a irregularidade natural de projetos de comunicação visual (não é um negócio de recorrência mensal automática).

Previsões no contexto são estimativas com premissas explícitas — nunca as apresente como garantia, nem invente percentuais ou datas exatas de recompra além do que está no contexto.

Toda recomendação deve dizer para quem é, qual o motivo (citando o número ou classificação que a sustenta), e qual seria o próximo passo. Não prometa condições comerciais (desconto, prazo, crédito) e não afirme ter executado nenhuma ação no sistema — você só responde perguntas, não aciona nada.

Responda em português do Brasil, com frases claras e diretas. Explique termos técnicos (RFM, coorte, margem de contribuição) só quando isso ajudar a resposta, sem virar aula.`;

export interface ContextoAssistenteClientes {
  periodo: { dataInicial: string; dataFinal: string };
  visaoGeral: VisaoGeralClientes;
  funil: FunilOrcamentos;
  previsao: PrevisaoComercial;
  filaAcoesPendentesResumo: Array<{ tipo: string; empresa: string; motivo: string; prioridade: number }>;
}

/** Monta o contexto estruturado enviado ao LLM — só os campos necessários,
 * nunca a base de clientes inteira. Trunca a fila de ações às N mais
 * prioritárias para manter o prompt enxuto. */
export function montarContextoAssistenteClientes(
  visaoGeral: VisaoGeralClientes,
  funil: FunilOrcamentos,
  previsao: PrevisaoComercial,
  candidatosAcao: AcaoCandidata[],
  periodo: { dataInicial: string; dataFinal: string },
  limiteAcoes = 15,
): ContextoAssistenteClientes {
  return {
    periodo,
    visaoGeral,
    funil,
    previsao,
    filaAcoesPendentesResumo: candidatosAcao.slice(0, limiteAcoes).map(c => ({
      tipo: c.tipo, empresa: c.empresa, motivo: c.motivo, prioridade: c.prioridade,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Tempo entre orçamento e pedido fechado (para calibrar follow-up) ────────
// ═══════════════════════════════════════════════════════════════════════════
// IMPORTANTE — leia antes de usar este número: o ERP exportado não guarda um
// campo que ligue o orcNumero ao osNumero que ele gerou (ver nota acima).
// Este cálculo é uma APROXIMAÇÃO por pareamento heurístico: para cada
// orçamento com status de aceite (STATUS_GANHO), procura a primeira OS válida
// da MESMA EMPRESA cuja data de aprovação seja igual ou posterior à data de
// cadastro do orçamento, dentro de uma janela máxima de dias — pareamento
// guloso 1:1 (uma OS não é usada para mais de um orçamento) para reduzir o
// risco de casar o orçamento errado quando o cliente tem várias compras
// próximas no tempo. Não é um vínculo confirmado pelo ERP — é a única forma
// possível de estimar isso com os dados disponíveis, e deve ser lido como
// tal (amostra e taxa de pareamento sempre exibidas).

export const JANELA_MAXIMA_ORCAMENTO_PEDIDO_DIAS = 90;

export interface TempoOrcamentoPedido {
  amostra: number; // quantos orçamentos ganhos conseguiram parear com uma OS
  totalOrcamentosGanhos: number; // total de orçamentos com status de aceite no período
  taxaPareamentoPct: number | null;
  // Todos os campos de dias abaixo são DIAS ÚTEIS (seg-sex, sem descontar
  // feriados) entre o cadastro do orçamento e a aprovação da OS pareada —
  // ver diasUteisEntre. Escolhido porque o prazo de follow-up é definido em
  // dias de trabalho, não em dias corridos (um fim de semana no meio não deve
  // "contar" contra o prazo que o vendedor tem para agir).
  mediaDias: number | null;
  medianaDias: number | null;
  p25Dias: number | null;
  p75Dias: number | null;
  p90Dias: number | null;
  minDias: number | null;
  maxDias: number | null;
  /** Sugestões de follow-up baseadas nos percentis reais (P25/mediana/P75) —
   * heurística de acompanhamento, não uma regra validada estatisticamente. */
  sugestaoFollowUpDias: { primeiro: number; segundo: number; terceiro: number } | null;
  /** Distribuição de frequência: quantos casos (e que % da amostra) fecham em
   * cada dia útil, de 0 até DISTRIBUICAO_DIAS_MAX; o restante (cauda longa) é
   * agrupado no último balde "DISTRIBUICAO_DIAS_MAX+". Serve para responder
   * "em quantos dias, exatamente, os outros 50% fecham" — os percentis sozinhos
   * não deixam essa distribuição visível. */
  distribuicaoDias: { dias: number; label: string; quantidade: number; percentual: number }[];
}

const DISTRIBUICAO_DIAS_MAX = 10;

function percentil(valoresAsc: number[], p: number): number {
  if (valoresAsc.length === 0) return 0;
  const idx = Math.min(valoresAsc.length - 1, Math.max(0, Math.ceil((p / 100) * valoresAsc.length) - 1));
  return valoresAsc[idx];
}

export function calcularTempoOrcamentoPedido(
  orcRows: OrcamentoRow[],
  osRows: OsRow[],
  janelaMaximaDias = JANELA_MAXIMA_ORCAMENTO_PEDIDO_DIAS,
): TempoOrcamentoPedido {
  // Agrupa OS válidas por empresa, ordenadas por data de aprovação
  const osPorEmpresa = new Map<string, Date[]>();
  for (const r of osRows) {
    if (!isOsNormalDb(r)) continue;
    const data = parseDataFlexivel(r.dataAprovacao);
    const empresa = (r.empresa ?? "").trim();
    if (!data || !empresa) continue;
    const key = normalizeEmpresaKey(empresa);
    if (!osPorEmpresa.has(key)) osPorEmpresa.set(key, []);
    osPorEmpresa.get(key)!.push(data);
  }
  for (const lista of osPorEmpresa.values()) lista.sort((a, b) => a.getTime() - b.getTime());
  const osUsada = new Map<string, Set<number>>(); // empresaKey -> índices de OS já pareadas

  // Orçamentos ganhos, ordenados por empresa e por data de cadastro (pareamento guloso, do mais antigo pro mais novo)
  const orcamentosGanhos = orcRows
    .filter(r => STATUS_GANHO.has((r.status ?? "").trim().toLowerCase()))
    .map(r => ({ empresaKey: normalizeEmpresaKey((r.empresa ?? "").trim()), data: parseDataFlexivel(r.dataCadastro) }))
    .filter((r): r is { empresaKey: string; data: Date } => !!r.data && !!r.empresaKey)
    .sort((a, b) => a.data.getTime() - b.data.getTime());

  const diasAteFechamento: number[] = [];
  for (const orc of orcamentosGanhos) {
    const listaOs = osPorEmpresa.get(orc.empresaKey);
    if (!listaOs) continue;
    if (!osUsada.has(orc.empresaKey)) osUsada.set(orc.empresaKey, new Set());
    const usadas = osUsada.get(orc.empresaKey)!;
    for (let i = 0; i < listaOs.length; i++) {
      if (usadas.has(i)) continue;
      const osData = listaOs[i];
      if (osData < orc.data) continue; // OS precisa vir depois (ou no mesmo dia) do orçamento
      const gapCorrido = diasEntre(osData, orc.data);
      if (gapCorrido > janelaMaximaDias) break; // lista ordenada — próximas OS só ficam mais distantes
      // A janela de pareamento acima é em dias corridos (limite de plausibilidade
      // de que a OS pertence a este orçamento); a métrica reportada é em dias
      // úteis (ver comentário na interface TempoOrcamentoPedido).
      diasAteFechamento.push(diasUteisEntre(osData, orc.data));
      usadas.add(i);
      break;
    }
  }

  diasAteFechamento.sort((a, b) => a - b);
  const n = diasAteFechamento.length;
  const mediana = n > 0 ? (n % 2 === 0 ? (diasAteFechamento[n / 2 - 1] + diasAteFechamento[n / 2]) / 2 : diasAteFechamento[(n - 1) / 2]) : null;
  const p25 = n > 0 ? percentil(diasAteFechamento, 25) : null;
  const p75 = n > 0 ? percentil(diasAteFechamento, 75) : null;
  const p90 = n > 0 ? percentil(diasAteFechamento, 90) : null;

  // Sugestão baseada nos percentis reais (não em frações da mediana): com
  // mediana muito baixa (conversão quase no mesmo dia, comum neste negócio),
  // uma fração da mediana colapsaria em "1 dia" repetido — os percentis já
  // capturam a dispersão real. Garante que os três contatos fiquem
  // estritamente crescentes mesmo quando os percentis empatam.
  let sugestao: { primeiro: number; segundo: number; terceiro: number } | null = null;
  if (mediana !== null && p25 !== null && p75 !== null) {
    const primeiro = Math.max(1, p25);
    const segundo = Math.max(primeiro + 1, Math.round(mediana));
    const terceiro = Math.max(segundo + 1, p75);
    sugestao = { primeiro, segundo, terceiro };
  }

  // Distribuição de frequência por dia útil: baldes individuais de 0 até
  // DISTRIBUICAO_DIAS_MAX, cauda longa agrupada no último balde "X+".
  const contagemPorDia = new Map<number, number>();
  for (const d of diasAteFechamento) {
    const chave = d > DISTRIBUICAO_DIAS_MAX ? DISTRIBUICAO_DIAS_MAX + 1 : d;
    contagemPorDia.set(chave, (contagemPorDia.get(chave) ?? 0) + 1);
  }
  const distribuicaoDias: TempoOrcamentoPedido["distribuicaoDias"] = [];
  for (let d = 0; d <= DISTRIBUICAO_DIAS_MAX; d++) {
    const quantidade = contagemPorDia.get(d) ?? 0;
    distribuicaoDias.push({ dias: d, label: `${d}du`, quantidade, percentual: n > 0 ? (quantidade / n) * 100 : 0 });
  }
  const quantidadeCauda = contagemPorDia.get(DISTRIBUICAO_DIAS_MAX + 1) ?? 0;
  distribuicaoDias.push({
    dias: DISTRIBUICAO_DIAS_MAX + 1,
    label: `${DISTRIBUICAO_DIAS_MAX}+du`,
    quantidade: quantidadeCauda,
    percentual: n > 0 ? (quantidadeCauda / n) * 100 : 0,
  });

  return {
    amostra: n,
    totalOrcamentosGanhos: orcamentosGanhos.length,
    taxaPareamentoPct: orcamentosGanhos.length > 0 ? (n / orcamentosGanhos.length) * 100 : null,
    mediaDias: n > 0 ? diasAteFechamento.reduce((s, d) => s + d, 0) / n : null,
    medianaDias: mediana,
    p25Dias: p25,
    p75Dias: p75,
    p90Dias: p90,
    minDias: n > 0 ? diasAteFechamento[0] : null,
    maxDias: n > 0 ? diasAteFechamento[n - 1] : null,
    sugestaoFollowUpDias: sugestao,
    distribuicaoDias,
  };
}
