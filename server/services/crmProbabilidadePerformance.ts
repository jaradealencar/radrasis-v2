export interface PrevisaoCrmMonitorada {
  orcNumero: string;
  exibidaEm: Date;
  probabilidadePct: number;
  modeloVersao: string;
  vendedor: string | null;
  faixaTicket: string;
  faixaIdadeEmpresa: string;
  coorteCliente: string;
  faixaRecenciaCompra: string;
  comprasUltimos12m: number;
  valorComprasUltimos12m: number;
  desfecho: 0 | 1 | null;
  statusNoHistorico: string | null;
  existeNoHistorico: boolean;
}

export interface MetricasProbabilidadeCrm {
  previsoes: number;
  resolvidas: number;
  pendentes: number;
  aindaNaoSincronizadas: number;
  ganhos: number;
  perdas: number;
  vitoriasEsperadas: number;
  conversaoEsperadaPct: number | null;
  conversaoRealPct: number | null;
  diferencaConversaoPct: number | null;
  brier: number | null;
  brierBase: number | null;
  brierSkillPct: number | null;
  logLoss: number | null;
  auc: number | null;
  erroCalibracaoPct: number | null;
}

type IndicadorComparado = {
  indice: string;
  atual: number | null;
  anterior: number | null;
  variacao: number | null;
  tendencia: "melhorando" | "piorando" | "mantido" | "amostra_insuficiente";
};

const clampProbability = (value: number) =>
  Math.max(0.001, Math.min(0.999, value));
const percentage = (value: number) => value * 100;

function aucScore(
  rows: Array<{ probability: number; outcome: 0 | 1 }>
): number | null {
  const positives = rows.filter(row => row.outcome === 1).length;
  const negatives = rows.length - positives;
  if (!positives || !negatives) return null;

  const sorted = [...rows].sort((a, b) => a.probability - b.probability);
  let rankSumPositive = 0;
  let index = 0;
  while (index < sorted.length) {
    let next = index + 1;
    while (
      next < sorted.length &&
      sorted[next].probability === sorted[index].probability
    )
      next++;
    const averageRank = (index + 1 + next) / 2;
    for (let i = index; i < next; i++) {
      if (sorted[i].outcome === 1) rankSumPositive += averageRank;
    }
    index = next;
  }
  return (
    (rankSumPositive - (positives * (positives + 1)) / 2) /
    (positives * negatives)
  );
}

export function calcularMetricasProbabilidade(
  rows: PrevisaoCrmMonitorada[]
): MetricasProbabilidadeCrm {
  const resolvidas = rows.filter(
    (row): row is PrevisaoCrmMonitorada & { desfecho: 0 | 1 } =>
      row.desfecho !== null
  );
  const ganhos = resolvidas.reduce((total, row) => total + row.desfecho, 0);
  const perdas = resolvidas.length - ganhos;
  const probabilidadeMedia = resolvidas.length
    ? resolvidas.reduce((total, row) => total + row.probabilidadePct / 100, 0) /
      resolvidas.length
    : null;
  const conversaoReal = resolvidas.length ? ganhos / resolvidas.length : null;
  const brier = resolvidas.length
    ? resolvidas.reduce(
        (total, row) =>
          total + (row.probabilidadePct / 100 - row.desfecho) ** 2,
        0
      ) / resolvidas.length
    : null;
  const logLoss = resolvidas.length
    ? resolvidas.reduce((total, row) => {
        const p = clampProbability(row.probabilidadePct / 100);
        return total + (row.desfecho ? -Math.log(p) : -Math.log(1 - p));
      }, 0) / resolvidas.length
    : null;

  const calibracao = Array.from({ length: 10 }, (_, index) => {
    const faixa = resolvidas.filter(
      row =>
        Math.min(9, Math.max(0, Math.floor(row.probabilidadePct / 10))) ===
        index
    );
    if (!faixa.length) return null;
    const prevista =
      faixa.reduce((total, row) => total + row.probabilidadePct / 100, 0) /
      faixa.length;
    const observada =
      faixa.reduce((total, row) => total + row.desfecho, 0) / faixa.length;
    return {
      quantidade: faixa.length,
      diferenca: Math.abs(prevista - observada),
    };
  }).filter(
    (row): row is { quantidade: number; diferenca: number } => row !== null
  );
  const erroCalibracao = resolvidas.length
    ? calibracao.reduce(
        (total, row) =>
          total + (row.quantidade / resolvidas.length) * row.diferenca,
        0
      )
    : null;
  const brierBase =
    conversaoReal === null ? null : conversaoReal * (1 - conversaoReal);

  return {
    previsoes: rows.length,
    resolvidas: resolvidas.length,
    pendentes: rows.length - resolvidas.length,
    aindaNaoSincronizadas: rows.filter(row => !row.existeNoHistorico).length,
    ganhos,
    perdas,
    vitoriasEsperadas:
      resolvidas.length && probabilidadeMedia !== null
        ? probabilidadeMedia * resolvidas.length
        : 0,
    conversaoEsperadaPct:
      probabilidadeMedia === null ? null : percentage(probabilidadeMedia),
    conversaoRealPct: conversaoReal === null ? null : percentage(conversaoReal),
    diferencaConversaoPct:
      conversaoReal === null || probabilidadeMedia === null
        ? null
        : percentage(conversaoReal - probabilidadeMedia),
    brier,
    brierBase,
    brierSkillPct:
      brier === null || brierBase === null || brierBase === 0
        ? null
        : percentage(1 - brier / brierBase),
    logLoss,
    auc: aucScore(
      resolvidas.map(row => ({
        probability: row.probabilidadePct,
        outcome: row.desfecho,
      }))
    ),
    erroCalibracaoPct:
      erroCalibracao === null ? null : percentage(erroCalibracao),
  };
}

function resumirGrupo(rows: PrevisaoCrmMonitorada[]) {
  const metrics = calcularMetricasProbabilidade(rows);
  return {
    quantidade: metrics.previsoes,
    resolvidas: metrics.resolvidas,
    ganhos: metrics.ganhos,
    perdas: metrics.perdas,
    conversaoEsperadaPct: metrics.conversaoEsperadaPct,
    conversaoRealPct: metrics.conversaoRealPct,
    diferencaConversaoPct: metrics.diferencaConversaoPct,
    brier: metrics.brier,
    erroCalibracaoPct: metrics.erroCalibracaoPct,
  };
}

function agruparPor(
  rows: PrevisaoCrmMonitorada[],
  chave: (row: PrevisaoCrmMonitorada) => string
) {
  const grupos = new Map<string, PrevisaoCrmMonitorada[]>();
  for (const row of rows) {
    const nome = chave(row).trim() || "Não informado";
    const grupo = grupos.get(nome) ?? [];
    grupo.push(row);
    grupos.set(nome, grupo);
  }
  return [...grupos.entries()]
    .map(([segmento, grupo]) => ({ segmento, ...resumirGrupo(grupo) }))
    .sort(
      (a, b) =>
        b.quantidade - a.quantidade ||
        a.segmento.localeCompare(b.segmento, "pt-BR")
    );
}

export function construirPainelProbabilidade(args: {
  previsoes: PrevisaoCrmMonitorada[];
  dias: number;
  agora?: Date;
}) {
  const agora = args.agora ?? new Date();
  const janelaMs = args.dias * 24 * 60 * 60 * 1000;
  const inicioAtual = new Date(agora.getTime() - janelaMs);
  const inicioAnterior = new Date(agora.getTime() - 2 * janelaMs);
  const atuais = args.previsoes.filter(
    row => row.exibidaEm >= inicioAtual && row.exibidaEm <= agora
  );
  const anteriores = args.previsoes.filter(
    row => row.exibidaEm >= inicioAnterior && row.exibidaEm < inicioAtual
  );
  const atual = calcularMetricasProbabilidade(atuais);
  const anterior = calcularMetricasProbabilidade(anteriores);

  const compararIndice = (
    nome: string,
    atualValor: number | null,
    anteriorValor: number | null,
    limite: number,
    menorMelhor = true,
    usarModulo = false
  ): IndicadorComparado => {
    if (
      atualValor === null ||
      anteriorValor === null ||
      atual.resolvidas < 30 ||
      anterior.resolvidas < 30
    ) {
      return {
        indice: nome,
        atual: atualValor,
        anterior: anteriorValor,
        variacao: null,
        tendencia: "amostra_insuficiente",
      };
    }
    const variacao = atualValor - anteriorValor;
    const mudanca = usarModulo
      ? Math.abs(atualValor) - Math.abs(anteriorValor)
      : variacao;
    const favoravel = menorMelhor ? mudanca < -limite : mudanca > limite;
    const desfavoravel = menorMelhor ? mudanca > limite : mudanca < -limite;
    const tendencia = favoravel
      ? "melhorando"
      : desfavoravel
        ? "piorando"
        : "mantido";
    return {
      indice: nome,
      atual: atualValor,
      anterior: anteriorValor,
      variacao,
      tendencia,
    };
  };

  const bucketsProbabilidade = agruparPor(atuais, row => {
    const inicio = Math.min(
      90,
      Math.max(0, Math.floor(row.probabilidadePct / 10) * 10)
    );
    return `${inicio}–${inicio + 10}%`;
  }).sort(
    (a, b) =>
      Number(a.segmento.split("–")[0]) - Number(b.segmento.split("–")[0])
  );

  const bucketsFrequencia = agruparPor(atuais, row =>
    row.comprasUltimos12m >= 3
      ? "3+ compras/12m"
      : `${row.comprasUltimos12m} compras/12m`
  );
  const valoresMonetarios = atuais
    .map(row => row.valorComprasUltimos12m)
    .sort((a, b) => a - b);
  const quartisValor = [0.25, 0.5, 0.75].map(
    q =>
      valoresMonetarios[
        Math.max(0, Math.ceil(valoresMonetarios.length * q) - 1)
      ] ?? 0
  );
  const bucketsValorRfm = agruparPor(atuais, row => {
    if (row.valorComprasUltimos12m <= 0) return "Sem valor comprado em 12m";
    if (row.valorComprasUltimos12m <= quartisValor[0])
      return "Q1 · menor valor";
    if (row.valorComprasUltimos12m <= quartisValor[1])
      return "Q2 · valor baixo-médio";
    if (row.valorComprasUltimos12m <= quartisValor[2])
      return "Q3 · valor médio-alto";
    return "Q4 · maior valor";
  });
  const mensal = new Map<string, PrevisaoCrmMonitorada[]>();
  for (const row of atuais) {
    const mes = `${row.exibidaEm.getUTCFullYear()}-${String(row.exibidaEm.getUTCMonth() + 1).padStart(2, "0")}`;
    const grupo = mensal.get(mes) ?? [];
    grupo.push(row);
    mensal.set(mes, grupo);
  }

  return {
    dias: args.dias,
    geradoEm: agora.toISOString(),
    atual,
    anterior,
    tendencias: [
      compararIndice("Brier", atual.brier, anterior.brier, 0.005),
      compararIndice("Log-loss", atual.logLoss, anterior.logLoss, 0.01),
      compararIndice("AUC", atual.auc, anterior.auc, 0.01, false),
      compararIndice(
        "Erro de calibração",
        atual.erroCalibracaoPct,
        anterior.erroCalibracaoPct,
        0.5
      ),
      compararIndice(
        "Erro da conversão esperada",
        atual.diferencaConversaoPct,
        anterior.diferencaConversaoPct,
        1,
        true,
        true
      ),
    ],
    faixasProbabilidade: bucketsProbabilidade,
    porVersao: agruparPor(atuais, row => row.modeloVersao),
    porVendedor: agruparPor(atuais, row => row.vendedor ?? "Não informado"),
    porTicket: agruparPor(atuais, row => row.faixaTicket),
    porIdadeEmpresa: agruparPor(atuais, row => row.faixaIdadeEmpresa),
    porCoorte: agruparPor(atuais, row => row.coorteCliente),
    porRecencia: agruparPor(atuais, row => row.faixaRecenciaCompra),
    porFrequencia: bucketsFrequencia,
    porValorRfm: bucketsValorRfm,
    porMes: [...mensal.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, grupo]) => ({ mes, ...resumirGrupo(grupo) })),
    snapshots: args.previsoes.length,
    previsoesForaDaJanela:
      args.previsoes.length - atuais.length - anteriores.length,
  };
}

export const CRM_PROBABILITY_BACKTEST_BASELINE = {
  validadoEm: "2026-11-13",
  amostraHistoricaDecidida: 6472,
  metodo:
    "Replay cronológico anterior à publicação; não são previsões registradas no CRM.",
  janelas: [
    {
      dias: 30,
      atualBrier: 0.1405,
      atualLogLoss: 0.4495,
      atualAuc: 0.687,
      anteriorBrier: 0.1462,
      anteriorLogLoss: 0.459,
      anteriorAuc: 0.682,
    },
    {
      dias: 60,
      atualBrier: 0.1339,
      atualLogLoss: 0.4249,
      atualAuc: 0.732,
      anteriorBrier: 0.1429,
      anteriorLogLoss: 0.4515,
      anteriorAuc: 0.69,
    },
    {
      dias: 90,
      atualBrier: 0.1339,
      atualLogLoss: 0.4243,
      atualAuc: 0.743,
      anteriorBrier: 0.1407,
      anteriorLogLoss: 0.445,
      anteriorAuc: 0.708,
    },
  ],
} as const;
