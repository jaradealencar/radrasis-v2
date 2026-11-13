import "dotenv/config";
import { getDb } from "../db/db";
import { safeErrorType } from "../db/db-connection";
import {
  carregarModeloProbabilidadeCrm,
  CRM_PROBABILITY_FEATURE_NAMES,
  CRM_PROBABILITY_TICKET_BANDS,
  CRM_PROBABILITY_AGE_BANDS,
  CRM_PROBABILITY_COHORTS,
  treinarRegressaoLogistica,
  preverComLogistica,
  type ExemploProbabilidadeCrm,
} from "../services/crmProbabilidadeModel";

type Linha = { faixa: string; n: number; previsto: number; observado: number };
type No = { probabilidade: number; feature?: number; corte?: number; esquerda?: No; direita?: No };
type Stump = { feature: number; corte: number; esquerda: number; direita: number };

function limitar(p: number): number { return Math.min(0.999, Math.max(0.001, p)); }
function logit(p: number): number { const x = limitar(p); return Math.log(x / (1 - x)); }
function sigmoid(x: number): number { if (x > 30) return 1; if (x < -30) return 0; return 1 / (1 + Math.exp(-x)); }
function media(values: number[]): number { return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0; }

function metricas(predicoes: number[], alvos: number[]) {
  let logLoss = 0, brier = 0;
  for (let i = 0; i < alvos.length; i++) {
    const p = limitar(predicoes[i]);
    logLoss += alvos[i] ? -Math.log(p) : -Math.log(1 - p);
    brier += (predicoes[i] - alvos[i]) ** 2;
  }
  const positivos = predicoes.filter((_, i) => alvos[i] === 1).sort((a, b) => a - b);
  const negativos = predicoes.filter((_, i) => alvos[i] === 0).sort((a, b) => a - b);
  let concordantes = 0, empates = 0;
  for (const p of positivos) for (const n of negativos) { if (p > n) concordantes++; else if (p === n) empates++; }
  return {
    logLoss: logLoss / Math.max(1, alvos.length),
    brier: brier / Math.max(1, alvos.length),
    auc: positivos.length && negativos.length ? (concordantes + empates / 2) / (positivos.length * negativos.length) : null,
  };
}

function calibracao(predicoes: number[], alvos: number[], qtd = 5): Linha[] {
  const ordenados = predicoes.map((p, i) => ({ p, y: alvos[i] })).sort((a, b) => a.p - b.p);
  return Array.from({ length: qtd }, (_, i) => {
    const inicio = Math.floor(i * ordenados.length / qtd);
    const fim = Math.floor((i + 1) * ordenados.length / qtd);
    const faixa = ordenados.slice(inicio, fim);
    return { faixa: `Q${i + 1}`, n: faixa.length, previsto: media(faixa.map((r) => r.p)), observado: media(faixa.map((r) => r.y)) };
  }).filter((r) => r.n > 0);
}

function aleatorioComSemente(seed: number) {
  let state = seed >>> 0;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
}

function impurity(rows: ExemploProbabilidadeCrm[]): number {
  if (!rows.length) return 0;
  const p = rows.reduce((s, r) => s + r.alvo, 0) / rows.length;
  return 2 * p * (1 - p);
}

function treinarArvore(rows: ExemploProbabilidadeCrm[], maxDepth: number, minLeaf: number, sorteio: () => number, maxFeatures = Infinity): No {
  const taxa = (rows.reduce((s, r) => s + r.alvo, 0) + 1) / (rows.length + 2);
  const folha: No = { probabilidade: taxa };
  if (maxDepth <= 0 || rows.length < minLeaf * 2) return folha;
  const totalFeatures = rows[0]?.features.length ?? 0;
  const indices = Array.from({ length: totalFeatures }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(sorteio() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const features = indices.slice(0, Math.min(indices.length, maxFeatures));
  let melhor: { ganho: number; feature: number; corte: number; esquerda: ExemploProbabilidadeCrm[]; direita: ExemploProbabilidadeCrm[] } | null = null;
  const impurezaPai = impurity(rows);
  for (const feature of features) {
    const ordenados = [...rows].sort((a, b) => a.features[feature] - b.features[feature]);
    const passo = Math.max(1, Math.floor(ordenados.length / 24));
    for (let i = minLeaf; i <= ordenados.length - minLeaf; i += passo) {
      const atual = ordenados[i - 1].features[feature];
      const proximo = ordenados[i].features[feature];
      if (atual === proximo) continue;
      const esquerda = ordenados.slice(0, i);
      const direita = ordenados.slice(i);
      const impureza = (esquerda.length * impurity(esquerda) + direita.length * impurity(direita)) / rows.length;
      const ganho = impurezaPai - impureza;
      if (!melhor || ganho > melhor.ganho) melhor = { ganho, feature, corte: (atual + proximo) / 2, esquerda, direita };
    }
  }
  if (!melhor || melhor.ganho <= 1e-7) return folha;
  return {
    probabilidade: taxa,
    feature: melhor.feature,
    corte: melhor.corte,
    esquerda: treinarArvore(melhor.esquerda, maxDepth - 1, minLeaf, sorteio, maxFeatures),
    direita: treinarArvore(melhor.direita, maxDepth - 1, minLeaf, sorteio, maxFeatures),
  };
}

function preverArvore(no: No, features: number[]): number {
  if (no.feature === undefined || no.corte === undefined || !no.esquerda || !no.direita) return no.probabilidade;
  return preverArvore(features[no.feature] <= no.corte ? no.esquerda : no.direita, features);
}

function treinarFloresta(rows: ExemploProbabilidadeCrm[], qtd = 24, seed = 3407): (features: number[]) => number {
  const sorteio = aleatorioComSemente(seed);
  const maxFeatures = Math.max(2, Math.floor(Math.sqrt(rows[0]?.features.length ?? 1)));
  const arvores = Array.from({ length: qtd }, () => {
    const amostra = Array.from({ length: rows.length }, () => rows[Math.floor(sorteio() * rows.length)]);
    return treinarArvore(amostra, 3, 70, sorteio, maxFeatures);
  });
  return (features) => media(arvores.map((arvore) => preverArvore(arvore, features)));
}

function treinarBoosting(rows: ExemploProbabilidadeCrm[], rodadas = 35): (features: number[]) => number {
  const taxa = rows.reduce((s, r) => s + r.alvo, 0) / Math.max(1, rows.length);
  let base = logit(taxa);
  const logits = rows.map(() => base);
  const stumps: Stump[] = [];
  const learningRate = 0.06;
  const qtdFeatures = rows[0]?.features.length ?? 0;
  for (let rodada = 0; rodada < rodadas; rodada++) {
    const residuals = rows.map((r, i) => r.alvo - sigmoid(logits[i]));
    let melhor: { erro: number; stump: Stump } | null = null;
    for (let feature = 0; feature < qtdFeatures; feature++) {
      const ordenados = rows.map((row, i) => ({ x: row.features[feature], r: residuals[i] })).sort((a, b) => a.x - b.x);
      const passo = Math.max(1, Math.floor(ordenados.length / 30));
      for (let i = 60; i <= ordenados.length - 60; i += passo) {
        const a = ordenados[i - 1].x, b = ordenados[i].x;
        if (a === b) continue;
        const corte = (a + b) / 2;
        const left = ordenados.slice(0, i), right = ordenados.slice(i);
        const valorEsq = Math.max(-2, Math.min(2, media(left.map((r) => r.r))));
        const valorDir = Math.max(-2, Math.min(2, media(right.map((r) => r.r))));
        const erro = left.reduce((s, r) => s + (r.r - valorEsq) ** 2, 0) + right.reduce((s, r) => s + (r.r - valorDir) ** 2, 0);
        if (!melhor || erro < melhor.erro) melhor = { erro, stump: { feature, corte, esquerda: valorEsq, direita: valorDir } };
      }
    }
    if (!melhor) break;
    stumps.push(melhor.stump);
    for (let i = 0; i < rows.length; i++) {
      const stump = melhor.stump;
      logits[i] += learningRate * (rows[i].features[stump.feature] <= stump.corte ? stump.esquerda : stump.direita);
    }
  }
  base = logit(taxa);
  return (features) => sigmoid(base + stumps.reduce((z, stump) => z + learningRate * (features[stump.feature] <= stump.corte ? stump.esquerda : stump.direita), 0));
}

function treinarNaiveBayes(rows: ExemploProbabilidadeCrm[]): (features: number[]) => number {
  const total = Math.max(1, rows.length);
  const classes = [0, 1].map((alvo) => rows.filter((r) => r.alvo === alvo));
  const qtdNumericas = 8;
  const gaussianas = classes.map((grupo) => Array.from({ length: qtdNumericas }, (_, feature) => {
    const valores = grupo.map((r) => r.features[feature]);
    const m = media(valores);
    const variancia = Math.max(0.04, media(valores.map((v) => (v - m) ** 2)));
    return { m, variancia };
  }));
  const bernoulli = classes.map((grupo) => Array.from({ length: CRM_PROBABILITY_FEATURE_NAMES.length - qtdNumericas }, (_, offset) => {
    const soma = grupo.reduce((s, r) => s + Number(r.features[qtdNumericas + offset] > 0.5), 0);
    return (soma + 1) / (grupo.length + 2);
  }));
  const logPrior = classes.map((grupo) => Math.log((grupo.length + 1) / (total + 2)));
  return (features) => {
    const logs = [0, 1].map((cl) => {
      let score = logPrior[cl];
      for (let j = 0; j < qtdNumericas; j++) {
        const { m, variancia } = gaussianas[cl][j];
        score += -0.5 * Math.log(2 * Math.PI * variancia) - ((features[j] - m) ** 2) / (2 * variancia);
      }
      for (let j = qtdNumericas; j < features.length; j++) {
        const p = Math.min(0.999, Math.max(0.001, bernoulli[cl][j - qtdNumericas]));
        score += features[j] > 0.5 ? Math.log(p) : Math.log(1 - p);
      }
      return score;
    });
    return sigmoid(logs[1] - logs[0]);
  };
}

function taxaBayesianaSegmentos(train: ExemploProbabilidadeCrm[], teste: ExemploProbabilidadeCrm[]): number[] {
  const wins = train.reduce((s, r) => s + r.alvo, 0);
  const base = wins / Math.max(1, train.length);
  const alpha0 = base * 8, beta0 = (1 - base) * 8;
  const indices = CRM_PROBABILITY_FEATURE_NAMES;
  const ticketIndexes = CRM_PROBABILITY_TICKET_BANDS.map((v) => indices.indexOf(`ticket:${v}`));
  const ageIndexes = CRM_PROBABILITY_AGE_BANDS.map((v) => indices.indexOf(`idade:${v}`));
  const cohortIndexes = CRM_PROBABILITY_COHORTS.map((v) => indices.indexOf(`coorte:${v}`));
  const indexes = [...ticketIndexes, ...ageIndexes, ...cohortIndexes];
  const counts = new Map<string, { w: number; n: number }>();
  for (const row of train) {
    const categories = indexes.flatMap((index) => row.features[index] > 0.5 ? [index] : []);
    for (const index of categories) {
      const key = String(index);
      const current = counts.get(key) ?? { w: 0, n: 0 };
      current.w += row.alvo;
      current.n++;
      counts.set(key, current);
    }
  }
  const geralLogit = logit(base);
  return teste.map((row) => {
    let z = geralLogit;
    for (const index of indexes) if (row.features[index] > 0.5) {
      const c = counts.get(String(index)) ?? { w: 0, n: 0 };
      const p = (alpha0 + c.w) / (alpha0 + beta0 + c.n);
      z += logit(p) - geralLogit;
    }
    return sigmoid(z);
  });
}

function bayesianoAtualParaComparacao(train: ExemploProbabilidadeCrm[], teste: ExemploProbabilidadeCrm[]): number[] {
  const wins = train.reduce((s, r) => s + r.alvo, 0);
  const base = wins / Math.max(1, train.length);
  const alpha0 = base * 8, beta0 = (1 - base) * 8;
  const indices = CRM_PROBABILITY_FEATURE_NAMES;
  const ticketIndexes = CRM_PROBABILITY_TICKET_BANDS.map((v) => indices.indexOf(`ticket:${v}`));
  const regionIndexes = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"].map((v) => indices.indexOf(`regiao:${v}`));
  const counts = new Map<string, { w: number; n: number }>();
  const customerKey = (row: ExemploProbabilidadeCrm) => row.features[indices.indexOf("cliente:novo")] > 0.5
    ? "cliente:novo"
    : `cliente:${row.proposta.empresaKey}`;
  const keysFor = (row: ExemploProbabilidadeCrm) => [
    customerKey(row),
    ...ticketIndexes.filter((index) => row.features[index] > 0.5).map((index) => `faixa:${index}`),
    ...regionIndexes.filter((index) => row.features[index] > 0.5).map((index) => `regiao:${index}`),
  ];
  for (const row of train) for (const key of keysFor(row)) {
    const current = counts.get(key) ?? { w: 0, n: 0 };
    current.w += row.alvo;
    current.n++;
    counts.set(key, current);
  }
  const baseLogit = logit(base);
  return teste.map((row) => {
    let z = baseLogit;
    for (const key of keysFor(row)) {
      const c = counts.get(key) ?? { w: 0, n: 0 };
      const p = (alpha0 + c.w) / (alpha0 + beta0 + c.n);
      z += logit(p) - baseLogit;
    }
    return Math.max(0.05, Math.min(0.95, sigmoid(z)));
  });
}

function quantisPorFeature(rows: ExemploProbabilidadeCrm[], featureIndex: number, label: string): Linha[] {
  const ordenados = [...rows].sort((a, b) => a.features[featureIndex] - b.features[featureIndex]);
  return Array.from({ length: 5 }, (_, i) => {
    const fatia = ordenados.slice(Math.floor(i * ordenados.length / 5), Math.floor((i + 1) * ordenados.length / 5));
    return { faixa: `${label} Q${i + 1}`, n: fatia.length, previsto: 0, observado: media(fatia.map((r) => r.alvo)) };
  });
}

function distribuicaoCategoria(rows: ExemploProbabilidadeCrm[], categorias: string[]) {
  return categorias.map((categoria) => {
    const idx = CRM_PROBABILITY_FEATURE_NAMES.indexOf(categoria);
    const grupo = rows.filter((r) => r.features[idx] > 0.5);
    return { segmento: categoria.replace(/^[^:]+:/, ""), n: grupo.length, ganhos: grupo.reduce((s, r) => s + r.alvo, 0), conversao: media(grupo.map((r) => r.alvo)) };
  });
}

function compararModelos(train: ExemploProbabilidadeCrm[], test: ExemploProbabilidadeCrm[]) {
  const y = test.map((r) => r.alvo);
  const modelos: Array<{ nome: string; pred: number[] }> = [];
  const taxaBase = train.reduce((s, r) => s + r.alvo, 0) / Math.max(1, train.length);
  modelos.push({ nome: "Taxa base", pred: test.map(() => taxaBase) });
  const logistic = treinarRegressaoLogistica(train);
  modelos.push({ nome: "Regressão logística + calibração temporal", pred: test.map((r) => preverComLogistica(logistic, r.features)) });
  const arvore = treinarArvore(train, 3, 70, aleatorioComSemente(17));
  modelos.push({ nome: "Árvore de decisão (CART, rasa)", pred: test.map((r) => preverArvore(arvore, r.features)) });
  const floresta = treinarFloresta(train);
  modelos.push({ nome: "Random Forest (bagging, 24 árvores)", pred: test.map((r) => floresta(r.features)) });
  const boosting = treinarBoosting(train);
  modelos.push({ nome: "Gradient Boosting (stumps, não XGBoost/LightGBM)", pred: test.map((r) => boosting(r.features)) });
  const naiveBayes = treinarNaiveBayes(train);
  modelos.push({ nome: "Naive Bayes misto", pred: test.map((r) => naiveBayes(r.features)) });
  modelos.push({ nome: "Bayesiano atual (cliente, ticket, região)", pred: bayesianoAtualParaComparacao(train, test) });
  modelos.push({ nome: "Bayesiano por segmentos (ticket, idade, coorte)", pred: taxaBayesianaSegmentos(train, test) });
  return modelos.map((m) => ({ ...m, metrics: metricas(m.pred, y) }));
}

function imprimirHoldout(exemplos: ExemploProbabilidadeCrm[], dias: number) {
  const ultimaData = exemplos.reduce((latest, row) => row.proposta.data > latest ? row.proposta.data : latest, exemplos[0].proposta.data);
  const corte = new Date(ultimaData.getTime() - dias * 86400000);
  const treino = exemplos.filter((e) => e.proposta.data < corte);
  const teste = exemplos.filter((e) => e.proposta.data >= corte);
  console.log(`\n=== Holdout cronológico: ${dias} dias finais (${corte.toISOString().slice(0, 10)} a ${ultimaData.toISOString().slice(0, 10)}) ===`);
  console.log(`Treino: ${treino.length} | teste: ${teste.length} | conversão do teste: ${(media(teste.map((e) => e.alvo)) * 100).toFixed(1)}%`);
  for (const resultado of compararModelos(treino, teste)) {
    const { logLoss, brier, auc } = resultado.metrics;
    console.log(`${resultado.nome}: log-loss ${logLoss.toFixed(4)} | Brier ${brier.toFixed(4)} | AUC ${auc?.toFixed(3) ?? "n/a"}`);
    if (resultado.nome.startsWith("Regressão logística")) {
      for (const linha of calibracao(resultado.pred, teste.map((r) => r.alvo))) {
        console.log(`  ${linha.faixa} n=${linha.n}: previsto ${(linha.previsto * 100).toFixed(1)}% | observado ${(linha.observado * 100).toFixed(1)}%`);
      }
    }
  }
  const quantis = quantisPorFeature(teste, CRM_PROBABILITY_FEATURE_NAMES.indexOf("recenciaCompraMesesLog"), "Recência RFM");
  console.log("Conversão observada por quintil de recência (sem previsão):");
  for (const linha of quantis) console.log(`  ${linha.faixa}: n=${linha.n}, ${(linha.observado * 100).toFixed(1)}%`);
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Banco não disponível");
  const dados = await carregarModeloProbabilidadeCrm(db);
  const exemplos = [...dados.exemplos].sort((a, b) => a.proposta.data.getTime() - b.proposta.data.getTime());
  console.log("Auditoria retrospectiva do score de propostas do CRM (somente agregados; não grava dados).");
  const ganhos = exemplos.reduce((s, row) => s + row.alvo, 0);
  console.log(`Desfechos decididos: ${exemplos.length}; ganhos ${ganhos}; perdas ${exemplos.length - ganhos}; taxa de ganho ${(dados.taxaGeral * 100).toFixed(1)}%.`);
  if (exemplos.length) console.log(`Período: ${exemplos[0].proposta.data.toISOString().slice(0, 10)} a ${exemplos[exemplos.length - 1].proposta.data.toISOString().slice(0, 10)}.`);
  if (dados.ultimaPropostaHistorico) console.log(`Espelho histórico de propostas: até ${dados.ultimaPropostaHistorico.toISOString().slice(0, 10)}; ${dados.propostasHistoricoSemDesfecho} ainda sem desfecho observável.`);
  const c = dados.coberturaIdadeEmpresarial;
  console.log(`Cobertura de idade CNPJ: ${c.clientesComIdade}/${c.clientesHistoricos} clientes (${c.clientesHistoricos ? (c.clientesComIdade / c.clientesHistoricos * 100).toFixed(1) : "0.0"}%) e ${c.propostasComIdade}/${c.propostasTreino} propostas (${c.propostasTreino ? (c.propostasComIdade / c.propostasTreino * 100).toFixed(1) : "0.0"}%).`);
  const ultimosRegistrosPorCliente = new Map<string, ExemploProbabilidadeCrm>();
  for (const row of exemplos) ultimosRegistrosPorCliente.set(row.proposta.empresaKey, row);
  const clientesComIdade = [...ultimosRegistrosPorCliente.values()].filter((row) => row.features[CRM_PROBABILITY_FEATURE_NAMES.indexOf("idade:disponivel")] > 0.5);
  console.log(`Distribuição por cliente entre os ${clientesComIdade.length} com idade conhecida:`);
  for (const row of distribuicaoCategoria(clientesComIdade, CRM_PROBABILITY_AGE_BANDS.map((v) => `idade:${v}`))) {
    if (row.n) console.log(`  ${row.segmento}: ${row.n}/${clientesComIdade.length} clientes (${(row.n / clientesComIdade.length * 100).toFixed(1)}%), conversão das propostas ${(row.conversao * 100).toFixed(1)}%`);
  }
  console.log("Faixas de idade na amostra com idade conhecida:");
  for (const row of dados.distribuicaoIdade) console.log(`  ${row.faixa}: n=${row.n} (${row.percentual.toFixed(1)}% de todas as propostas decididas)`);
  const knownAge = exemplos.filter((e) => e.features[CRM_PROBABILITY_FEATURE_NAMES.indexOf("idade:disponivel")] > 0.5);
  console.log("Conversão por idade entre propostas com idade calculável:");
  for (const row of distribuicaoCategoria(knownAge, CRM_PROBABILITY_AGE_BANDS.map((v) => `idade:${v}`))) {
    if (row.n) console.log(`  ${row.segmento}: n=${row.n}, ganhos=${row.ganhos}, ${(row.conversao * 100).toFixed(1)}%`);
  }
  console.log("Conversão por faixa de ticket:");
  for (const row of distribuicaoCategoria(exemplos, CRM_PROBABILITY_TICKET_BANDS.map((v) => `ticket:${v}`))) {
    console.log(`  ${row.segmento}: n=${row.n}, ganhos=${row.ganhos}, ${(row.conversao * 100).toFixed(1)}%`);
  }
  console.log("Conversão por coorte da primeira compra:");
  for (const row of distribuicaoCategoria(exemplos, CRM_PROBABILITY_COHORTS.map((v) => `coorte:${v}`))) {
    if (row.n) console.log(`  ${row.segmento}: n=${row.n}, ganhos=${row.ganhos}, ${(row.conversao * 100).toFixed(1)}%`);
  }
  console.log("\nA data final é a última proposta do histórico local com desfecho observável. Um intervalo até hoje indica atraso do espelho do ERP.");
  if (process.argv.includes("--resumo")) return;
  for (const dias of [30, 60, 90]) imprimirHoldout(exemplos, dias);
  console.log("\nNota: a comparação é um replay histórico pareado, não um A/B ao vivo. Árvore, Random Forest, Gradient Boosting, Naive Bayes e Bayesianos são challengers retrospectivos. A produção usa regressão logística calibrada; XGBoost e LightGBM não estão instalados e não foram apresentados como se tivessem sido treinados.");
}

main().catch((erro) => { console.error("Falha na auditoria:", safeErrorType(erro)); process.exit(1); });
