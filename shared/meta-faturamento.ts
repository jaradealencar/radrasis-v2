/**
 * Motor "meta de faturamento" — usado pelo servidor (que mede os indicadores
 * reais) e pelo painel (que simula cenários). Fica em shared/ para a fórmula
 * existir num único lugar.
 *
 * O faturamento mensal é a soma de 4 grupos de clientes, e cada grupo é o
 * produto de 3 indicadores:
 *
 *   faturamento do grupo = clientes por mês × pedidos por cliente × ticket por pedido
 *
 * Grupos (cada pedido cai em exatamente um, então a soma bate com o total):
 *  - novos: clientes que compraram pela 1ª vez no mês
 *  - reativados: voltaram depois de 6+ meses sem comprar
 *  - recompraConquistados: novos/reativados dos últimos 12 meses comprando de novo
 *  - carteira: clientes antigos que seguem comprando (recorrência)
 */

export type SegmentoId = "novos" | "reativados" | "recompraConquistados" | "carteira";
export const SEGMENTOS: SegmentoId[] = ["novos", "reativados", "recompraConquistados", "carteira"];

export type CampoAlavanca = "clientes" | "pedidosPorCliente" | "ticket";
export const CAMPOS_ALAVANCA: CampoAlavanca[] = ["clientes", "pedidosPorCliente", "ticket"];

export interface Alavanca {
  clientes: number;
  pedidosPorCliente: number;
  ticket: number;
}

export type Cenario = Record<SegmentoId, Alavanca>;
export type IdAlavanca = `${SegmentoId}.${CampoAlavanca}`;
/** Indicadores que o usuário fixou manualmente (o resto se ajusta sozinho). */
export type Fixos = Partial<Record<IdAlavanca, number>>;

export const FATOR_MAXIMO = 10;

export function idAlavanca(segmento: SegmentoId, campo: CampoAlavanca): IdAlavanca {
  return `${segmento}.${campo}`;
}

export function vendasSegmento(a: Alavanca): number {
  return a.clientes * a.pedidosPorCliente;
}

export function faturamentoSegmento(a: Alavanca): number {
  return a.clientes * a.pedidosPorCliente * a.ticket;
}

export interface TotaisCenario {
  faturamento: number;
  vendas: number;
  ticketMedio: number;
  porSegmento: Record<SegmentoId, { faturamento: number; vendas: number }>;
}

export function totaisCenario(c: Cenario): TotaisCenario {
  const porSegmento = {} as TotaisCenario["porSegmento"];
  let faturamento = 0;
  let vendas = 0;
  for (const s of SEGMENTOS) {
    const f = faturamentoSegmento(c[s]);
    const v = vendasSegmento(c[s]);
    porSegmento[s] = { faturamento: f, vendas: v };
    faturamento += f;
    vendas += v;
  }
  return { faturamento, vendas, ticketMedio: vendas > 0 ? faturamento / vendas : 0, porSegmento };
}

/** Cenário em que os indicadores fixados mantêm o valor do usuário e todos os
 * livres valem (valor de referência × fator). */
export function aplicarFator(base: Cenario, fixos: Fixos, fator: number): Cenario {
  const saida = {} as Cenario;
  for (const s of SEGMENTOS) {
    const a = { ...base[s] };
    for (const campo of CAMPOS_ALAVANCA) {
      const fixo = fixos[idAlavanca(s, campo)];
      a[campo] = fixo !== undefined ? fixo : base[s][campo] * fator;
    }
    saida[s] = a;
  }
  return saida;
}

export interface ResultadoMeta {
  cenario: Cenario;
  totais: TotaisCenario;
  /** Quanto cada indicador livre foi multiplicado (1,08 = +8%). */
  fator: number;
  /** Quantos indicadores ainda estão livres para se ajustar. */
  livres: number;
  /** false = mesmo com os livres no máximo (FATOR_MAXIMO×) a meta não fecha. */
  atingivel: boolean;
}

/** Descobre o quanto os indicadores livres precisam mudar (todos pelo mesmo
 * fator) para o faturamento do cenário igualar a meta, respeitando os que o
 * usuário fixou. Como o faturamento só cresce com o fator, basta bisseção. */
export function resolverMeta(base: Cenario, fixos: Fixos, meta: number): ResultadoMeta {
  const total = (f: number) => totaisCenario(aplicarFator(base, fixos, f)).faturamento;
  const livres = SEGMENTOS.length * CAMPOS_ALAVANCA.length - Object.keys(fixos).length;

  const montar = (fator: number, atingivel: boolean): ResultadoMeta => {
    const cenario = aplicarFator(base, fixos, fator);
    return { cenario, totais: totaisCenario(cenario), fator, livres, atingivel };
  };

  if (livres <= 0) return montar(1, total(1) >= meta * 0.9995);
  if (total(0) >= meta) return montar(0, true);
  if (total(FATOR_MAXIMO) < meta) return montar(FATOR_MAXIMO, false);

  let baixo = 0;
  let alto = FATOR_MAXIMO;
  for (let i = 0; i < 80; i++) {
    const meio = (baixo + alto) / 2;
    if (total(meio) < meta) baixo = meio; else alto = meio;
  }
  return montar((baixo + alto) / 2, true);
}

// ─── Funil: orçamentos (leads) × conversão = vendas ──────────────────────────

export interface FunilAtual {
  leadsPorMes: number | null;
  conversaoPct: number | null;
}

/** Divide o aumento de vendas entre mais orçamentos e melhor conversão
 * (pesoConversao 0 = só mais orçamentos; 1 = só melhor conversão; 0,5 = igualmente). */
export function dividirFunil(
  vendasAtual: number,
  vendasNovo: number,
  funil: FunilAtual,
  pesoConversao: number,
): { leads: number | null; conversaoPct: number | null } {
  if (!(vendasAtual > 0) || vendasNovo < 0 || funil.leadsPorMes === null || funil.conversaoPct === null) {
    return { leads: null, conversaoPct: null };
  }
  const razao = vendasNovo / vendasAtual;
  return {
    leads: funil.leadsPorMes * Math.pow(razao, 1 - pesoConversao),
    conversaoPct: funil.conversaoPct * Math.pow(razao, pesoConversao),
  };
}

// ─── Onde o esforço é menor: cada alavanca sozinha ───────────────────────────

export type IdAlavancaFunil = "leads" | "conversao" | "ticket" | "novos" | "reativados";

export interface AlavancaRanking {
  id: IdAlavancaFunil;
  rotulo: string;
  unidade: "numero" | "pct" | "brl";
  atual: number;
  /** Valor que a alavanca precisaria atingir SOZINHA (as outras ficam como estão) para fechar a meta. */
  necessario: number;
  variacaoPct: number;
  /** Em quantos meses da série histórica o indicador já esteve pelo menos no nível necessário. */
  mesesJaAtingiu: number;
  mesesSerie: number;
  esforco: "menor" | "medio" | "maior";
  /** Ex.: conversão acima de 100%. */
  inviavel: boolean;
}

export interface EntradaRanking {
  faturamentoAtual: number;
  meta: number;
  base: Cenario;
  leads: { atual: number | null; serie: number[] };
  conversao: { atual: number | null; serie: number[] };
  ticket: { serie: number[] };
  novos: { serie: number[] };
  reativados: { serie: number[] };
}

/** Ordena as alavancas do funil do menor para o maior esforço. O "esforço" é medido pelo próprio
 * histórico: um nível que o negócio já atingiu em vários meses é mais fácil de repetir do que um
 * nível que nunca apareceu. Devolve lista vazia se a meta já foi atingida. */
export function rankearAlavancas(e: EntradaRanking): AlavancaRanking[] {
  if (!(e.faturamentoAtual > 0) || e.meta <= e.faturamentoAtual) return [];
  const razao = e.meta / e.faturamentoAtual;
  const gap = e.meta - e.faturamentoAtual;
  const totais = totaisCenario(e.base);

  const montar = (
    id: IdAlavancaFunil, rotulo: string, unidade: AlavancaRanking["unidade"],
    atual: number, necessario: number, serie: number[], inviavel = false,
  ): AlavancaRanking => {
    const valida = serie.filter(v => Number.isFinite(v));
    const mesesJaAtingiu = valida.filter(v => v >= necessario).length;
    const p = valida.length > 0 ? mesesJaAtingiu / valida.length : null;
    return {
      id, rotulo, unidade, atual, necessario,
      variacaoPct: atual > 0 ? (necessario / atual - 1) * 100 : 0,
      mesesJaAtingiu, mesesSerie: valida.length,
      esforco: inviavel ? "maior" : p === null ? "medio" : p >= 0.25 ? "menor" : p > 0 ? "medio" : "maior",
      inviavel,
    };
  };

  const lista: AlavancaRanking[] = [];
  lista.push(montar("ticket", "Ticket médio por pedido", "brl", totais.ticketMedio, totais.ticketMedio * razao, e.ticket.serie));
  if (e.leads.atual !== null) lista.push(montar("leads", "Orçamentos recebidos por mês", "numero", e.leads.atual, e.leads.atual * razao, e.leads.serie));
  if (e.conversao.atual !== null) {
    const nec = e.conversao.atual * razao;
    lista.push(montar("conversao", "Taxa de conversão de orçamentos", "pct", e.conversao.atual, nec, e.conversao.serie, nec > 100));
  }
  const receitaPorNovo = e.base.novos.pedidosPorCliente * e.base.novos.ticket;
  if (receitaPorNovo > 0) lista.push(montar("novos", "Parceiros novos por mês", "numero", e.base.novos.clientes, e.base.novos.clientes + gap / receitaPorNovo, e.novos.serie));
  const receitaPorReativado = e.base.reativados.pedidosPorCliente * e.base.reativados.ticket;
  if (receitaPorReativado > 0) lista.push(montar("reativados", "Parceiros reativados por mês", "numero", e.base.reativados.clientes, e.base.reativados.clientes + gap / receitaPorReativado, e.reativados.serie));

  const ordem = { menor: 0, medio: 1, maior: 2 } as const;
  return lista.sort((a, b) => {
    if (ordem[a.esforco] !== ordem[b.esforco]) return ordem[a.esforco] - ordem[b.esforco];
    const pa = a.mesesSerie > 0 ? a.mesesJaAtingiu / a.mesesSerie : 0;
    const pb = b.mesesSerie > 0 ? b.mesesJaAtingiu / b.mesesSerie : 0;
    if (pa !== pb) return pb - pa;
    return a.variacaoPct - b.variacaoPct;
  });
}

// ─── Conversão da base × parceiros novos (o "atalho" de cada caminho) ────────

export interface EntradaCaminhos {
  faturamentoAtual: number;
  meta: number;
  conversaoPct: number | null;
  /** Maior conversão mensal já registrada (para julgar se o caminho é realista). */
  conversaoMaximaPct: number | null;
  novosAtual: number;
  novosMaximoMensal: number;
  /** Receita média de 12 meses por parceiro novo (LTV de 12 meses); null sem dados. */
  ltv12m: number | null;
  /** Receita imediata (mês da entrada) de um parceiro novo. */
  receitaEntradaPorNovo: number;
}

export interface ResultadoCaminhos {
  gap: number;
  conversao: {
    valorPorPontoPercentual: number;
    pontosNecessarios: number;
    conversaoNecessariaPct: number;
    acimaDoMaximoHistorico: boolean;
  } | null;
  novos: {
    adicionaisPorMesEmRegime: number | null;
    adicionaisPorMesImediato: number;
    novosNecessariosEmRegime: number | null;
    acimaDoMaximoHistorico: boolean;
  };
}

/** Quanto cada caminho exigiria para fechar o buraco até a meta:
 *  - conversão: cada ponto percentual vale (faturamento ÷ conversão); efeito em 1–2 meses;
 *  - parceiros novos: cada novo por mês vale o LTV de 12 meses em regime (efeito pleno em ~12 meses). */
export function compararCaminhos(e: EntradaCaminhos): ResultadoCaminhos {
  const gap = Math.max(0, e.meta - e.faturamentoAtual);
  const conversao = e.conversaoPct !== null && e.conversaoPct > 0
    ? (() => {
        const valorPorPonto = e.faturamentoAtual / e.conversaoPct;
        const pontos = valorPorPonto > 0 ? gap / valorPorPonto : 0;
        const necessaria = e.conversaoPct + pontos;
        return {
          valorPorPontoPercentual: valorPorPonto,
          pontosNecessarios: pontos,
          conversaoNecessariaPct: necessaria,
          acimaDoMaximoHistorico: e.conversaoMaximaPct !== null && necessaria > e.conversaoMaximaPct,
        };
      })()
    : null;
  const emRegime = e.ltv12m !== null && e.ltv12m > 0 ? gap / e.ltv12m : null;
  const imediato = e.receitaEntradaPorNovo > 0 ? gap / e.receitaEntradaPorNovo : 0;
  return {
    gap,
    conversao,
    novos: {
      adicionaisPorMesEmRegime: emRegime,
      adicionaisPorMesImediato: imediato,
      novosNecessariosEmRegime: emRegime !== null ? e.novosAtual + emRegime : null,
      acimaDoMaximoHistorico: emRegime !== null && e.novosAtual + emRegime > e.novosMaximoMensal,
    },
  };
}
