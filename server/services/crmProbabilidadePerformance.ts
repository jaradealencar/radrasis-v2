export interface PrevisaoCrmMonitorada {
  orcNumero: string;
  exibidaEm: Date;
  probabilidadePct: number;
  valorProposta: number;
  modeloVersao: string;
  vendedor: string | null;
  faixaTicket: string;
  faixaIdadeEmpresa: string;
  coorteCliente: string;
  faixaRecenciaCompra: string;
  regiao: string;
  comprasUltimos12m: number;
  valorComprasUltimos12m: number;
  desfecho: 0 | 1 | null;
  statusNoHistorico: string | null;
  existeNoHistorico: boolean;
}

export interface PropostaComercialHistorica {
  dataCadastro: Date;
  desfecho: 0 | 1 | null;
  valorProposta: number;
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

const INDICADORES_MENSAIS = [
  { chave: "previsoes", nome: "Previsões registradas", grupo: "Volume", unidade: "numero" },
  { chave: "resolvidas", nome: "Propostas decididas", grupo: "Volume", unidade: "numero" },
  { chave: "ganhos", nome: "Propostas ganhas", grupo: "Volume", unidade: "numero" },
  { chave: "perdas", nome: "Propostas perdidas", grupo: "Volume", unidade: "numero" },
  { chave: "pendentes", nome: "Aguardando desfecho", grupo: "Volume", unidade: "numero" },
  { chave: "conversaoRealPct", nome: "Conversão real", grupo: "Conversão", unidade: "percentual", direcao: "maior" },
  { chave: "conversaoEsperadaPct", nome: "Conversão prevista", grupo: "Conversão", unidade: "percentual" },
  { chave: "vitoriasEsperadas", nome: "Ganhos esperados pelo score", grupo: "Conversão", unidade: "numero" },
  { chave: "diferencaConversaoPct", nome: "Real menos prevista", grupo: "Conversão", unidade: "pp", direcao: "menor_abs" },
  { chave: "diferencaVitorias", nome: "Ganhos reais menos esperados", grupo: "Conversão", unidade: "numero", direcao: "menor_abs" },
  { chave: "brier", nome: "Brier score", grupo: "Qualidade do score", unidade: "indice", direcao: "menor" },
  { chave: "brierSkillPct", nome: "Brier skill", grupo: "Qualidade do score", unidade: "percentual", direcao: "maior" },
  { chave: "logLoss", nome: "Log-loss", grupo: "Qualidade do score", unidade: "indice", direcao: "menor" },
  { chave: "auc", nome: "AUC", grupo: "Qualidade do score", unidade: "indice", direcao: "maior" },
  { chave: "erroCalibracaoPct", nome: "Erro de calibração", grupo: "Qualidade do score", unidade: "percentual", direcao: "menor" },
  { chave: "valorPropostoDecidido", nome: "Valor cotado nas decididas", grupo: "Valores", unidade: "moeda" },
  { chave: "valorVendido", nome: "Valor das propostas ganhas", grupo: "Valores", unidade: "moeda" },
  { chave: "ticketMedioDecidido", nome: "Ticket médio decidido", grupo: "Valores", unidade: "moeda" },
  { chave: "ticketMedioGanho", nome: "Ticket médio ganho", grupo: "Valores", unidade: "moeda" },
  { chave: "ticketMedioPerdido", nome: "Ticket médio perdido", grupo: "Valores", unidade: "moeda" },
] as const;

type ChaveIndicadorMensal = (typeof INDICADORES_MENSAIS)[number]["chave"];
type ValoresIndicadoresMensais = Record<ChaveIndicadorMensal, number | null>;

function calcularIndicadoresMensais(rows: PrevisaoCrmMonitorada[]): {
  valores: ValoresIndicadoresMensais;
  previsoes: number;
  resolvidas: number;
} {
  const metricas = calcularMetricasProbabilidade(rows);
  const decididas = rows.filter(row => row.desfecho !== null);
  const ganhos = decididas.filter(row => row.desfecho === 1);
  const perdas = decididas.filter(row => row.desfecho === 0);
  const soma = (grupo: PrevisaoCrmMonitorada[]) =>
    grupo.reduce((total, row) => total + Math.max(0, row.valorProposta || 0), 0);
  const valorPropostoDecidido = soma(decididas);
  const valorVendido = soma(ganhos);
  const valorPerdido = soma(perdas);
  const diferencaVitorias = metricas.resolvidas
    ? metricas.ganhos - metricas.vitoriasEsperadas
    : null;

  return {
    previsoes: metricas.previsoes,
    resolvidas: metricas.resolvidas,
    valores: {
      previsoes: metricas.previsoes,
      resolvidas: metricas.resolvidas,
      ganhos: metricas.ganhos,
      perdas: metricas.perdas,
      pendentes: metricas.pendentes,
      conversaoRealPct: metricas.conversaoRealPct,
      conversaoEsperadaPct: metricas.conversaoEsperadaPct,
      vitoriasEsperadas: metricas.resolvidas ? metricas.vitoriasEsperadas : null,
      diferencaConversaoPct: metricas.diferencaConversaoPct,
      diferencaVitorias,
      brier: metricas.brier,
      brierSkillPct: metricas.brierSkillPct,
      logLoss: metricas.logLoss,
      auc: metricas.auc,
      erroCalibracaoPct: metricas.erroCalibracaoPct,
      valorPropostoDecidido: decididas.length ? valorPropostoDecidido : null,
      valorVendido: ganhos.length ? valorVendido : null,
      ticketMedioDecidido: decididas.length ? valorPropostoDecidido / decididas.length : null,
      ticketMedioGanho: ganhos.length ? valorVendido / ganhos.length : null,
      ticketMedioPerdido: perdas.length ? valorPerdido / perdas.length : null,
    },
  };
}

function criarResumoMensal(rows: PrevisaoCrmMonitorada[], inicio: Date, fim: Date) {
  const grupo = rows.filter(row => row.exibidaEm >= inicio && row.exibidaEm < fim);
  const resumo = calcularIndicadoresMensais(grupo);
  const mes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(inicio);
  return { mes, inicio: inicio.toISOString(), previsoes: resumo.previsoes, resolvidas: resumo.resolvidas, valores: resumo.valores };
}

export function calcularMetricasConversaoComercial(rows: PropostaComercialHistorica[]) {
  const decididas = rows.filter((row) => row.desfecho !== null);
  const ganhos = decididas.filter((row) => row.desfecho === 1);
  const perdas = decididas.filter((row) => row.desfecho === 0);
  const valorProposto = (grupo: PropostaComercialHistorica[]) =>
    grupo.reduce((total, row) => total + Math.max(0, row.valorProposta || 0), 0);
  const valorDecidido = valorProposto(decididas);
  const valorGanho = valorProposto(ganhos);
  const valorPerdido = valorProposto(perdas);
  return {
    propostasCriadas: rows.length,
    decididas: decididas.length,
    ganhos: ganhos.length,
    perdas: perdas.length,
    semDesfecho: rows.length - decididas.length,
    conversaoRealPct: decididas.length ? (ganhos.length / decididas.length) * 100 : null,
    valorCotado: valorProposto(rows),
    valorDecidido,
    valorVendido: ganhos.length ? valorGanho : null,
    ticketMedioDecidido: decididas.length ? valorDecidido / decididas.length : null,
    ticketMedioGanho: ganhos.length ? valorGanho / ganhos.length : null,
    ticketMedioPerdido: perdas.length ? valorPerdido / perdas.length : null,
  };
}

export function construirPainelConversaoComercial(args: {
  propostas: PropostaComercialHistorica[];
  agora?: Date;
}) {
  const agora = args.agora ?? new Date();
  const inicioMesAtual = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
  const inicioTresMeses = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 3, 1));
  const inicioSeisMeses = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 6, 1));
  const meses = [-3, -2, -1].map((offset) => {
    const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + offset, 1));
    const fim = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 1));
    const grupo = args.propostas.filter((row) => row.dataCadastro >= inicio && row.dataCadastro < fim);
    return {
      mes: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(inicio),
      ...calcularMetricasConversaoComercial(grupo),
    };
  });
  const ultimosTresMeses = args.propostas.filter((row) => row.dataCadastro >= inicioTresMeses && row.dataCadastro < inicioMesAtual);
  const tresMesesAnteriores = args.propostas.filter((row) => row.dataCadastro >= inicioSeisMeses && row.dataCadastro < inicioTresMeses);
  const geral = calcularMetricasConversaoComercial(args.propostas);
  const recente = calcularMetricasConversaoComercial(ultimosTresMeses);
  const anterior = calcularMetricasConversaoComercial(tresMesesAnteriores);
  const diferencaConversaoPp = recente.conversaoRealPct != null && anterior.conversaoRealPct != null
    ? recente.conversaoRealPct - anterior.conversaoRealPct
    : null;
  const tendencia = recente.decididas < 30 || anterior.decididas < 30 || diferencaConversaoPp == null
    ? "amostra_insuficiente"
    : diferencaConversaoPp > 1 ? "melhorando" : diferencaConversaoPp < -1 ? "piorando" : "mantido";
  const dataMaisRecente = args.propostas.reduce<Date | null>((maisRecente, row) =>
    !maisRecente || row.dataCadastro > maisRecente ? row.dataCadastro : maisRecente, null);
  const dataMaisRecenteMeioDia = dataMaisRecente
    ? new Date(Date.UTC(dataMaisRecente.getUTCFullYear(), dataMaisRecente.getUTCMonth(), dataMaisRecente.getUTCDate(), 12))
    : null;
  return {
    meses,
    geral,
    ultimosTresMeses: recente,
    tresMesesAnteriores: anterior,
    diferencaConversaoPp,
    tendencia,
    propostasNoHistorico: args.propostas.length,
    dataMaisRecente: dataMaisRecenteMeioDia?.toISOString() ?? null,
  };
}

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

  const inicioMesAtual = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
  const mesesComparados = [-3, -2, -1].map(deslocamento => {
    const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + deslocamento, 1));
    const fim = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 1));
    return criarResumoMensal(args.previsoes, inicio, fim);
  });
  const inicioTresMeses = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 3, 1));
  const grupoTresMeses = args.previsoes.filter(
    row => row.exibidaEm >= inicioTresMeses && row.exibidaEm < inicioMesAtual
  );
  const grupoHistoricoAnterior = args.previsoes.filter(row => row.exibidaEm < inicioTresMeses);
  const geralMensal = calcularIndicadoresMensais(args.previsoes);
  const tresMesesMensal = calcularIndicadoresMensais(grupoTresMeses);
  const historicoAnteriorMensal = calcularIndicadoresMensais(grupoHistoricoAnterior);
  const indicadoresMensais = INDICADORES_MENSAIS.map(indicador => {
    const geralValor = geralMensal.valores[indicador.chave];
    const anteriorValor = historicoAnteriorMensal.valores[indicador.chave];
    const recenteValor = tresMesesMensal.valores[indicador.chave];
    const direcao = "direcao" in indicador ? indicador.direcao : undefined;
    let tendencia: "melhorando" | "piorando" | "mantido" | "amostra_insuficiente" | "descritivo" = "descritivo";
    if (direcao) {
      if (
        historicoAnteriorMensal.resolvidas < 30 ||
        tresMesesMensal.resolvidas < 30 ||
        anteriorValor === null ||
        recenteValor === null
      ) {
        tendencia = "amostra_insuficiente";
      } else {
        const delta = direcao === "menor_abs"
          ? Math.abs(recenteValor) - Math.abs(anteriorValor)
          : recenteValor - anteriorValor;
        const limite = indicador.chave === "brier" ? 0.005
          : indicador.chave === "logLoss" || indicador.chave === "auc" ? 0.01
            : indicador.chave === "diferencaVitorias" ? 2
              : 1;
        tendencia = Math.abs(delta) <= limite
          ? "mantido"
          : ((direcao === "maior" && delta > 0) || (direcao !== "maior" && delta < 0))
            ? "melhorando"
            : "piorando";
      }
    }
    return {
      chave: indicador.chave,
      nome: indicador.nome,
      grupo: indicador.grupo,
      unidade: indicador.unidade,
      mediaGeral: geralValor,
      historicoAnterior: anteriorValor,
      ultimosTresMeses: recenteValor,
      tendencia,
      meses: mesesComparados.map(mes => ({ mes: mes.mes, valor: mes.valores[indicador.chave], previsoes: mes.previsoes, resolvidas: mes.resolvidas })),
    };
  });

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
    porRegiao: agruparPor(atuais, row => row.regiao),
    porFrequencia: bucketsFrequencia,
    porValorRfm: bucketsValorRfm,
    porMes: [...mensal.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, grupo]) => ({ mes, ...resumirGrupo(grupo) })),
    indicadoresMensais: {
      indicadores: indicadoresMensais,
      meses: mesesComparados.map(({ mes, previsoes, resolvidas }) => ({ mes, previsoes, resolvidas })),
      totalGeralPrevisoes: geralMensal.previsoes,
      totalGeralResolvidas: geralMensal.resolvidas,
      historicoAnteriorPrevisoes: historicoAnteriorMensal.previsoes,
      historicoAnteriorResolvidas: historicoAnteriorMensal.resolvidas,
      ultimosTresMesesPrevisoes: tresMesesMensal.previsoes,
      ultimosTresMesesResolvidas: tresMesesMensal.resolvidas,
      mesesCompletos: true,
    },
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
