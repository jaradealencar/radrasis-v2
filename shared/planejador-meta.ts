/**
 * Planejador de meta: transforma o cenário do simulador (os números que precisam valer) numa linha
 * do tempo — "em que mês o faturamento chega na meta?" — e nos marcos mês a mês do plano.
 *
 * Método (simples de propósito, para o dono conseguir conferir a conta):
 *  - "Hoje" é a média dos 12 meses fechados (a mesma referência do painel) e vale para o mês corrente.
 *  - O cenário do simulador é o ponto de chegada. Cada um dos 12 indicadores sobe (ou desce) em
 *    linha reta, do valor de hoje até o valor do cenário, ao longo do PRAZO que o usuário escolhe;
 *    depois do prazo fica estável. O faturamento de cada mês é a mesma fórmula do simulador
 *    (gráficas × pedidos × ticket, somando os 4 grupos) aplicada aos indicadores daquele mês.
 *  - Quanto tempo leva para chegar aos números é uma decisão do usuário (só ele sabe o quanto
 *    consegue acelerar a captação, a recompra...): por isso o prazo é uma entrada, não uma previsão.
 *
 * Fora da conta, de propósito: (1) o efeito das gráficas novas continuarem comprando nos meses
 * seguintes (o simulador trata cada indicador separadamente; ver a aba "Metas comparadas") e
 * (2) a oscilação natural de um mês para o outro, que o gráfico mostra como faixa.
 */

import { SEGMENTOS, CAMPOS_ALAVANCA, totaisCenario, type Cenario, type TotaisCenario } from "./meta-faturamento";

// ─── Meta mensal por sazonalidade (Nov/Dez consistentes; outros meses sem padrão confiável) ──
//
// Testado em 26-27/09/2026 com o histórico real (ver docs/inteligencia-clientes.md): aplicar o índice
// sazonal a TODOS os meses piora a previsão (22% de erro contra 17% da média simples — já descartado no
// motor de projeção). Mas mês a mês a história é diferente: alguns meses concordam ano após ano (novembro
// sempre acima da média, dezembro sempre abaixo — 3 de 3 anos, a mesma direção, variação pequena entre os
// anos); outros oscilam sem padrão (janeiro foi 93%, 101% e 55% da média em 3 anos — não dá pra confiar
// nisso). Por isso o ajuste só vale para os meses em que os anos concordam.

/** Mesma tolerância que o simulador usa para dizer que "a meta fecha". */
export const TOLERANCIA_META = 0.9995;
export const PRAZO_PADRAO_MESES = 6;
export const PRAZO_MAXIMO_MESES = 24;
/** Mínimo de meses mostrados na linha do tempo, mesmo com prazo curto. */
export const HORIZONTE_MINIMO_MESES = 12;

const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export interface MesCalendario {
  ano: number;
  /** 1 a 12. */
  mes: number;
  /** "out/2026". */
  rotulo: string;
}

/** O mês de calendário `k` meses depois do mês da data de referência (k = 0 é o mês corrente). */
export function mesApos(dataReferenciaISO: string, k: number): MesCalendario {
  const d = new Date(dataReferenciaISO);
  const indice = d.getUTCFullYear() * 12 + d.getUTCMonth() + k;
  const ano = Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  return { ano, mes, rotulo: `${NOMES_MES[mes - 1]}/${ano}` };
}

/** Prazo válido: inteiro entre 1 e o máximo (entradas vindas da tela nem sempre são). */
export function prazoValido(prazoMeses: number): number {
  if (!Number.isFinite(prazoMeses)) return PRAZO_PADRAO_MESES;
  return Math.min(PRAZO_MAXIMO_MESES, Math.max(1, Math.round(prazoMeses)));
}

/** Quantos meses mostrar: o prazo mais uma folga para ver o cenário se estabilizar. */
export function horizonteDaLinhaDoTempo(prazoMeses: number): number {
  return Math.min(PRAZO_MAXIMO_MESES, Math.max(HORIZONTE_MINIMO_MESES, prazoValido(prazoMeses) + 3));
}

/** Cenário a `progresso` (0 = hoje, 1 = cenário final) do caminho entre `base` e `regime`. */
export function interpolarCenario(base: Cenario, regime: Cenario, progresso: number): Cenario {
  const p = Math.min(1, Math.max(0, progresso));
  const saida = {} as Cenario;
  for (const s of SEGMENTOS) {
    const a = { ...base[s] };
    for (const campo of CAMPOS_ALAVANCA) a[campo] = base[s][campo] + (regime[s][campo] - base[s][campo]) * p;
    saida[s] = a;
  }
  return saida;
}

export interface PontoDaLinhaDoTempo {
  /** 0 = mês corrente (números de hoje), 1 = próximo mês... */
  mes: number;
  /** Quanto do caminho já foi percorrido (0 a 1). */
  progresso: number;
  cenario: Cenario;
  totais: TotaisCenario;
}

export function linhaDoTempo(base: Cenario, regime: Cenario, prazoMeses: number, horizonte?: number): PontoDaLinhaDoTempo[] {
  const prazo = prazoValido(prazoMeses);
  const ate = horizonte ?? horizonteDaLinhaDoTempo(prazo);
  const pontos: PontoDaLinhaDoTempo[] = [];
  for (let k = 0; k <= ate; k++) {
    const progresso = Math.min(1, k / prazo);
    const cenario = interpolarCenario(base, regime, progresso);
    pontos.push({ mes: k, progresso, cenario, totais: totaisCenario(cenario) });
  }
  return pontos;
}

/** Primeiro mês (0 = este mês) em que o faturamento previsto alcança a meta; null se não alcança no período. */
export function primeiroMesNaMeta(pontos: Array<{ mes: number; totais: { faturamento: number } }>, meta: number): number | null {
  const ponto = pontos.find(p => p.totais.faturamento >= meta * TOLERANCIA_META);
  return ponto ? ponto.mes : null;
}

/** Mínimo de anos concordando na mesma direção para confiar no padrão de um mês do calendário. */
export const MINIMO_OBSERVACOES_SAZONAL = 3;
/** Coeficiente de variação (desvio padrão ÷ média) máximo entre os anos — acima disso, os anos discordam
 * demais em intensidade mesmo concordando na direção. */
export const CV_MAXIMO_SAZONAL = 0.15;
/** Encolhimento (regressão à média) do ajuste: com poucos anos de dado, confia só em parte na média
 * observada — `peso = n ÷ (n + K)`; K=2 dá 60% de peso com 3 anos, subindo conforme mais anos se acumulam. */
export const ENCOLHIMENTO_SAZONAL_K = 2;

export interface ConfiabilidadeSazonalMes {
  /** 1 a 12 (1 = janeiro). */
  mes: number;
  /** Quantos anos entraram na conta (razão daquele mês ÷ média móvel de 12 meses ao redor dele). */
  observacoes: number;
  /** Razão média entre os anos (1 = igual à média; 0,8 = 20% abaixo). */
  mediaRazao: number;
  /** Desvio padrão ÷ média entre os anos; null com menos de 2 observações. */
  coeficienteVariacao: number | null;
  /** Fração dos anos do mesmo lado da média (todos acima ou todos abaixo de 1); 1 = concordância total. */
  mesmoSinalPct: number;
  /** true = padrão consistente o bastante para ajustar a meta deste mês (ver os limiares acima). */
  confiavel: boolean;
  /** Fator a aplicar na meta deste mês (já com o encolhimento); 1 (sem ajuste) se não confiável. */
  fatorAjustado: number;
}

/** Para cada um dos 12 meses do calendário, mede se o desvio em relação à média dos 12 meses ao redor se
 * repete de forma consistente ano a ano — só esses meses recebem ajuste na meta (ver decisão acima).
 * `razoesPorMes[m]` = lista de razões (uma por ano observado) para o mês `m` (1 a 12). */
export function confiabilidadeSazonalPorMes(razoesPorMes: Partial<Record<number, number[]>>): ConfiabilidadeSazonalMes[] {
  const resultado: ConfiabilidadeSazonalMes[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    const razoes = (razoesPorMes[mes] ?? []).filter(r => Number.isFinite(r) && r > 0);
    const n = razoes.length;
    if (n === 0) {
      resultado.push({ mes, observacoes: 0, mediaRazao: 1, coeficienteVariacao: null, mesmoSinalPct: 0, confiavel: false, fatorAjustado: 1 });
      continue;
    }
    const media = razoes.reduce((a, b) => a + b, 0) / n;
    const desvio = n > 1 ? Math.sqrt(razoes.reduce((s, r) => s + (r - media) ** 2, 0) / n) : 0;
    const coeficienteVariacao = n > 1 ? desvio / media : null;
    const acima = razoes.filter(r => r > 1).length;
    const abaixo = razoes.filter(r => r < 1).length;
    const mesmoSinalPct = Math.max(acima, abaixo) / n;
    const confiavel = n >= MINIMO_OBSERVACOES_SAZONAL && mesmoSinalPct === 1 && coeficienteVariacao !== null && coeficienteVariacao < CV_MAXIMO_SAZONAL;
    const peso = n / (n + ENCOLHIMENTO_SAZONAL_K);
    const fatorAjustado = confiavel ? 1 + peso * (media - 1) : 1;
    resultado.push({ mes, observacoes: n, mediaRazao: media, coeficienteVariacao, mesmoSinalPct, confiavel, fatorAjustado });
  }
  return resultado;
}

/** Os 12 fatores (índice 0 = janeiro) reescalados para a média dar exatamente 1 — meses "sem ajuste" ficam
 * em 1 e os meses ajustados absorvem toda a diferença, então a MÉDIA ANUAL da meta não muda: só a forma como
 * ela se distribui pelos 12 meses. */
export function fatoresSazonaisNormalizados(confiabilidade: ConfiabilidadeSazonalMes[]): number[] {
  const porMes = new Map(confiabilidade.map(c => [c.mes, c.fatorAjustado]));
  const fatores = Array.from({ length: 12 }, (_, i) => porMes.get(i + 1) ?? 1);
  const media = fatores.reduce((a, b) => a + b, 0) / 12;
  return media > 0 ? fatores.map(f => f / media) : fatores;
}

/** Aplica um fator no cenário mexendo só na quantidade de gráficas de cada grupo (pedidos/gráfica e ticket
 * ficam iguais) — a leitura fica "neste mês, tantas % a mais/menos de gráficas compram", condizente com a
 * história por trás de novembro/dezembro (mais ou menos gráficas fechando pedido, não o valor de cada uma). */
export function aplicarFatorSazonal(cenario: Cenario, fator: number): Cenario {
  const saida = {} as Cenario;
  for (const s of SEGMENTOS) saida[s] = { ...cenario[s], clientes: cenario[s].clientes * fator };
  return saida;
}

/** A mesma linha do tempo, com o faturamento de cada ponto ajustado pelo fator sazonal do mês de calendário
 * em que ele cai (`fatoresPorMes`: índice 0 = janeiro, já normalizados por `fatoresSazonaisNormalizados`).
 * Só muda a DISTRIBUIÇÃO mês a mês — a média ao longo de 12 meses seguidos continua a mesma. */
export function aplicarSazonalidadeNaLinhaDoTempo(
  pontos: PontoDaLinhaDoTempo[],
  dataReferenciaISO: string,
  fatoresPorMes: number[],
): PontoDaLinhaDoTempo[] {
  return pontos.map(p => {
    const mesCalendario = mesApos(dataReferenciaISO, p.mes).mes; // 1-12
    const fator = fatoresPorMes[mesCalendario - 1] ?? 1;
    const cenario = aplicarFatorSazonal(p.cenario, fator);
    return { ...p, cenario, totais: totaisCenario(cenario) };
  });
}

// ─── Recompra mecânica: novas/reativadas de hoje → recompra daqui a alguns meses ─────────────
//
// No Simulador, "Recompra de gráficas conquistadas" é um indicador LIVRE: quando o usuário mexe em
// "gráficas novas", o solver ajusta a recompra (e os outros indicadores livres) do jeito que for preciso
// para fechar a meta — sem nenhuma relação com quantas gráficas realmente entraram. Na vida real existe
// essa relação (quem compra de novo são as PRÓPRIAS gráficas que entraram nos últimos 12 meses), só que
// ela é lenta: uma gráfica nova ou reativada não passa a ser "recompra de conquistada" no mês seguinte —
// ela segue a CURVA DE VIDA (quanto % de uma turma volta a comprar em cada mês depois da entrada).
//
// Testado com os dados reais (26/09/2026): prever o valor em R$ de cada mês por essa mecânica piorou o
// erro (35,7% contra 31% da média simples — ver docs/inteligencia-clientes.md), porque a mecânica é
// barulhenta mês a mês. Mas a MÉDIA de longo prazo bate: com o ritmo de entradas de hoje, a mecânica prevê
// ~37,9 gráficas/mês de recompra contra as ~38,4 reais — a mecânica erra o mês, não a tendência. Por isso
// este cálculo entra só no Planejador (que já pensa em meses, não num instante só) e é OPCIONAL: o gestor
// escolhe se quer ver a versão "independente" (o solver ajusta livre) ou a "mecânica" (a recompra é
// consequência das entradas, e leva ~12 meses para acompanhar uma mudança de ritmo).

export interface EntradaHistoricaMes {
  /** Gráficas novas (1ª compra) naquele mês. */
  novos: number;
  /** Gráficas reativadas (voltaram depois de 6+ meses) naquele mês. */
  reativados: number;
}

/** `ativosPct[k]` = % de uma turma de entrada que compra de novo no k-ésimo mês depois da entrada
 * (k = 1..11; k = 0 seria a própria entrada e não entra aqui). Vem de `PainelMeta.coorte`/`coorteReativados`. */
export type CurvaRecompra = Array<{ k: number; ativosPct: number | null }>;

/** Recompra de conquistadas esperada no mês `indice` da linha do tempo (0 = hoje), somando o que cada
 * turma de entrada dos até 11 meses anteriores costuma comprar de novo naquele mês de vida. Turmas
 * anteriores a "hoje" (índice negativo) usam `historicoRecente` (o histórico real); turmas dentro do
 * plano usam o próprio ritmo (rampa) daquele mês, já calculado em `pontos`. */
function recompraMecanicaDoMes(
  indice: number,
  pontos: PontoDaLinhaDoTempo[],
  historicoRecente: EntradaHistoricaMes[],
  curvaNovos: CurvaRecompra,
  curvaReativados: CurvaRecompra,
): number {
  const taxa = (curva: CurvaRecompra, k: number): number | null => curva.find(m => m.k === k)?.ativosPct ?? null;
  const entradasDoMes = (idxMes: number): EntradaHistoricaMes => {
    if (idxMes >= 0) {
      const ponto = pontos[idxMes];
      return ponto ? { novos: ponto.cenario.novos.clientes, reativados: ponto.cenario.reativados.clientes } : { novos: 0, reativados: 0 };
    }
    const pos = historicoRecente.length + idxMes; // idxMes=-1 → último elemento do histórico
    return pos >= 0 && pos < historicoRecente.length ? historicoRecente[pos] : { novos: 0, reativados: 0 };
  };

  let recompra = 0;
  for (let k = 1; k <= 11; k++) {
    const entrada = entradasDoMes(indice - k);
    const taxaNovo = taxa(curvaNovos, k);
    const taxaReat = taxa(curvaReativados, k);
    if (taxaNovo !== null) recompra += entrada.novos * (taxaNovo / 100);
    if (taxaReat !== null) recompra += entrada.reativados * (taxaReat / 100);
  }
  return recompra;
}

/** A mesma linha do tempo, com "Recompra de gráficas conquistadas" recalculada pela mecânica acima em vez
 * de deixada livre para o solver. `historicoRecente` são os últimos 11 meses FECHADOS antes de hoje, em
 * ordem cronológica (do mais antigo pro mais recente) — cabe exatamente em `PainelMeta.historico.slice(1)`
 * (o histórico tem 12 meses; este cálculo usa 11, de k=1 a k=11). */
export function aplicarRecompraMecanicaNaLinhaDoTempo(
  pontos: PontoDaLinhaDoTempo[],
  historicoRecente: EntradaHistoricaMes[],
  curvaNovos: CurvaRecompra,
  curvaReativados: CurvaRecompra,
): PontoDaLinhaDoTempo[] {
  return pontos.map((p, indice) => {
    const clientes = recompraMecanicaDoMes(indice, pontos, historicoRecente, curvaNovos, curvaReativados);
    const cenario: Cenario = { ...p.cenario, recompraConquistados: { ...p.cenario.recompraConquistados, clientes } };
    return { ...p, cenario, totais: totaisCenario(cenario) };
  });
}

/**
 * A mesma mecânica, mas CALIBRADA — use esta na tela, não a de cima. Testado com os dados reais
 * (27/09/2026): a versão crua, aplicada em "hoje" (nada mudou ainda, é só o histórico real), não bate com
 * o valor real de "Recompra de conquistadas" — errou de +18% a +34% para cima em testes diferentes, porque
 * a curva de vida tem seu próprio ruído mês a mês (a mesma razão por que ela já tinha sido descartada como
 * método de PREVISÃO, só a MÉDIA de longo prazo bate). Em vez de mostrar um "hoje" que já nasce errado, a
 * curva inteira é reescalada por um fator único (`real ÷ bruto` no mês 0) que faz o mês 0 bater exatamente
 * com o valor real da tela — o FORMATO da mecânica continua valendo (reativados voltam mais rápido que
 * novos; o efeito de uma mudança de ritmo leva até 11 meses para aparecer inteiro), só o nível é ancorado
 * no real. Se o mês 0 não tiver nenhuma previsão (bruto = 0), a mecânica não tem o que calibrar e os
 * pontos voltam inalterados.
 */
export function aplicarRecompraMecanicaCalibradaNaLinhaDoTempo(
  pontos: PontoDaLinhaDoTempo[],
  historicoRecente: EntradaHistoricaMes[],
  curvaNovos: CurvaRecompra,
  curvaReativados: CurvaRecompra,
): PontoDaLinhaDoTempo[] {
  const bruto = recompraMecanicaDoMes(0, pontos, historicoRecente, curvaNovos, curvaReativados);
  const real = pontos[0]?.cenario.recompraConquistados.clientes ?? 0;
  if (bruto <= 0) return pontos;
  const fator = real / bruto;
  return pontos.map((p, indice) => {
    const clientes = recompraMecanicaDoMes(indice, pontos, historicoRecente, curvaNovos, curvaReativados) * fator;
    const cenario: Cenario = { ...p.cenario, recompraConquistados: { ...p.cenario.recompraConquistados, clientes } };
    return { ...p, cenario, totais: totaisCenario(cenario) };
  });
}

// ─── Carteira mecânica: a base ativa ganha gente (entradas que completam 12 meses) e perde gente (quem
// para de comprar) ──────────────────────────────────────────────────────────────────────────────────
//
// Diferente da recompra (uma turma de entrada só fica "elegível" por 11 meses, depois vira carteira), a
// carteira é um POOL sem prazo — um cliente fica ali por anos. Modelar isso exigiria, em tese, uma curva de
// sobrevida de longuíssimo prazo; em vez disso usamos algo mais simples e MEDIDO diretamente: a taxa de
// continuidade mensal da base "regular" (comprou em pelo menos metade dos últimos 6 meses) — 52,7% no
// histórico real, com desvio pequeno entre os meses (`PainelMeta.continuidadeCarteira`).
//
// Importante: essa taxa vem de uma população DIFERENTE da curva de vida de uma turma de entrada recém-
// chegada (quem já é "regular" há tempo tende a continuar mais do que uma turma nova qualquer — é
// sobrevivência: só quem já ficou é que compõe esse grupo). Por isso o GANHO mensal do pool não usa a
// curva de vida da recompra — é CALIBRADO (igual à recompra): supondo que as entradas de novos/reativados
// estivessem no ritmo médio há muito tempo (regime permanente), o pool "nasceria" exatamente no valor real
// de hoje; disso sai o fator de ganho por entrada, sem misturar as duas populações.

/** Taxa de continuidade mensal da base regular (0 a 1) e os dados de confiança — vem de
 * `PainelMeta.continuidadeCarteira`; o chamador decide o que fazer se `confiavel` vier falso
 * (a mecânica ainda funciona, só com menos garantia). */
export interface ContinuidadeCarteira {
  taxaMensalPct: number | null;
  amostras: number;
  coeficienteVariacao: number | null;
}

/** A mesma linha do tempo, com "Gráficas ativas da carteira" recalculada como um pool que ganha gente
 * (proporcional às entradas de 12 meses atrás) e perde gente pela taxa de continuidade medida — ancorada
 * no valor real de hoje (mês 0), igual à recompra mecânica. Se não houver taxa de continuidade medida ou
 * entrada de regime para calibrar, devolve os pontos sem mudar nada. */
export function aplicarCarteiraMecanicaCalibradaNaLinhaDoTempo(
  pontos: PontoDaLinhaDoTempo[],
  historicoRecente: EntradaHistoricaMes[],
  continuidade: ContinuidadeCarteira,
): PontoDaLinhaDoTempo[] {
  if (pontos.length === 0 || continuidade.taxaMensalPct === null) return pontos;
  const poolReal = pontos[0].cenario.carteira.clientes;
  const entradaMedia = historicoRecente.length > 0
    ? historicoRecente.reduce((s, h) => s + h.novos + h.reativados, 0) / historicoRecente.length
    : 0;
  const sobrevivencia = Math.min(0.999, Math.max(0, continuidade.taxaMensalPct / 100));
  if (entradaMedia <= 0 || poolReal <= 0) return pontos;
  // Calibração: em regime (entrada constante = entradaMedia), o pool estacionário é fatorGanho×entradaMedia/(1-sobrevivencia);
  // igualando isso a poolReal (o valor real de hoje, fruto do regime que já vinha antes) isola o fatorGanho.
  const fatorGanho = (poolReal * (1 - sobrevivencia)) / entradaMedia;

  // Para os meses ANTES de hoje (idxMes < 0), usa a MÉDIA histórica (o "regime" que já produziu o pool
  // real de hoje), não o valor exato de cada mês passado: o pool é recursivo (carrega o mês anterior pra
  // frente), então o ruído mês a mês do histórico real se acumularia e o gráfico ficaria serrilhado sem
  // representar nada de fato futuro — o que já aconteceu já está embutido no próprio valor real de hoje.
  const entradasDoMes = (idxMes: number): number => {
    if (idxMes >= 0) { const pt = pontos[idxMes]; return pt ? pt.cenario.novos.clientes + pt.cenario.reativados.clientes : 0; }
    return entradaMedia;
  };

  let poolAnterior = poolReal;
  return pontos.map((p, indice) => {
    const clientes = indice === 0 ? poolReal : poolAnterior * sobrevivencia + fatorGanho * entradasDoMes(indice - 12);
    poolAnterior = clientes;
    const cenario: Cenario = { ...p.cenario, carteira: { ...p.cenario.carteira, clientes } };
    return { ...p, cenario, totais: totaisCenario(cenario) };
  });
}
