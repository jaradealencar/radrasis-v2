import "dotenv/config";
import { getDb } from "../db/db";
import { historicoOrcamentos, historicoOs } from "../../drizzle/schema";
import {
  parseDataFlexivel, STATUS_GANHO, STATUS_PERDIDO, STATUS_ABERTO, faixaTicketDoValor,
} from "../services/inteligenciaClientes";
import { normalizeEmpresaKey } from "../routers/performanceComercial";
import { UF_PARA_REGIAO, normalizarUf } from "../utils/regioesBrasil";

/**
 * Validação da metodologia do Score de Probabilidade de Compra, pedida pelo
 * usuário em 13/09/2026: "simular um algoritmo de inferência bayesiana... pra
 * ter certeza do que está fazendo... validar lendo as propostas dos últimos
 * meses vs. as que fecharam". Escopo combinado: só CRM (não Performance
 * Comercial) por enquanto.
 *
 * Compara 3 modelos, todos treinados SÓ com dados anteriores ao corte de
 * teste (walk-forward, sem vazamento de informação futura):
 *   1. Baseline burro: taxa geral constante da carteira no período de treino.
 *   2. Heurística atual (replicada aqui): a mesma fórmula de
 *      server/services/probabilidadeCompra.ts (calcularProbabilidade) — base
 *      por cliente novo/individual + ajustes aditivos capados por ticket,
 *      faixa e região.
 *   3. Modelo bayesiano novo: Beta-Binomial por segmento (prior fraco
 *      centrado na taxa geral, pseudo-contagem K) combinado por soma de
 *      log-odds (Naive Bayes) entre: cliente (novo vs. individual do cliente,
 *      com encolhimento bayesiano em vez do corte rígido de amostra mínima
 *      atual) + faixa de tíquete + região.
 *
 * Rótulo ganho/perdido: mesma regra já validada em
 * calcularConversaoPorFaixaTicket (inteligenciaClientes.ts) — "Em aberto"
 * com validade vencida conta como perdido, "Em aberto" ainda dentro do prazo
 * fica fora do treino/teste (ainda não decidido).
 */

const DIAS_PRESUMIDO_PERDIDO = 30;

function foiPerdido(status: string | null, dataCadastro: string | null, validade: string | null, agora: Date): boolean {
  const statusKey = (status ?? "").trim().toLowerCase();
  if (STATUS_PERDIDO.has(statusKey)) return true;
  if (statusKey !== STATUS_ABERTO) return false;
  const data = parseDataFlexivel(dataCadastro);
  if (!data) return false;
  const validadeDias = parseFloat(String(validade ?? "0")) || 0;
  if (validadeDias > 0) {
    const dataVencimento = new Date(data);
    dataVencimento.setDate(dataVencimento.getDate() + validadeDias);
    return dataVencimento < agora;
  }
  const dias = (agora.getTime() - data.getTime()) / 86400000;
  return dias > DIAS_PRESUMIDO_PERDIDO;
}

function logit(p: number): number {
  const c = Math.min(0.999, Math.max(0.001, p));
  return Math.log(c / (1 - c));
}
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Média da posterior Beta(alpha0+ganhos, beta0+perdidos) — encolhe em direção
 * ao prior (alpha0/(alpha0+beta0)) quando a amostra do segmento é pequena, e
 * converge pra taxa observada do segmento conforme a amostra cresce. */
function betaPosteriorMean(ganhos: number, perdidos: number, alpha0: number, beta0: number): number {
  return (alpha0 + ganhos) / (alpha0 + beta0 + ganhos + perdidos);
}

interface Decidido {
  empresaKey: string;
  valor: number;
  data: Date;
  ganho: boolean;
  regiao: string | null;
}

function logLoss(pred: number[], real: number[]): number {
  let soma = 0;
  for (let i = 0; i < pred.length; i++) {
    const p = Math.min(0.999, Math.max(0.001, pred[i]));
    soma += real[i] === 1 ? -Math.log(p) : -Math.log(1 - p);
  }
  return soma / pred.length;
}
function brierScore(pred: number[], real: number[]): number {
  let soma = 0;
  for (let i = 0; i < pred.length; i++) soma += (pred[i] - real[i]) ** 2;
  return soma / pred.length;
}
/** AUC via contagem de pares concordantes (Mann-Whitney U) — O(n log n) não é
 * necessário aqui, a amostra de teste é pequena o bastante pro O(n*m) direto. */
function auc(pred: number[], real: number[]): number | null {
  const positivos = pred.filter((_, i) => real[i] === 1);
  const negativos = pred.filter((_, i) => real[i] === 0);
  if (positivos.length === 0 || negativos.length === 0) return null;
  let concordantes = 0, empates = 0;
  for (const p of positivos) for (const n of negativos) {
    if (p > n) concordantes++;
    else if (p === n) empates++;
  }
  return (concordantes + 0.5 * empates) / (positivos.length * negativos.length);
}
function tabelaCalibracao(pred: number[], real: number[], nFaixas = 5): Array<{ faixa: string; n: number; previstoMedio: number; realMedio: number }> {
  const idx = pred.map((p, i) => ({ p, r: real[i] })).sort((a, b) => a.p - b.p);
  const tamanho = Math.ceil(idx.length / nFaixas);
  const linhas = [];
  for (let f = 0; f < nFaixas; f++) {
    const fatia = idx.slice(f * tamanho, (f + 1) * tamanho);
    if (fatia.length === 0) continue;
    const previstoMedio = fatia.reduce((s, x) => s + x.p, 0) / fatia.length;
    const realMedio = fatia.reduce((s, x) => s + x.r, 0) / fatia.length;
    linhas.push({ faixa: `Q${f + 1} (n=${fatia.length})`, n: fatia.length, previstoMedio, realMedio });
  }
  return linhas;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");

  const orcRows = await db.select({
    empresa: historicoOrcamentos.empresa, status: historicoOrcamentos.status,
    total: historicoOrcamentos.total, dataCadastro: historicoOrcamentos.dataCadastro,
    validade: historicoOrcamentos.validade,
  }).from(historicoOrcamentos);

  const osRows = await db.select({
    empresa: historicoOs.empresa, dataAprovacao: historicoOs.dataAprovacao, estado: historicoOs.estado,
  }).from(historicoOs);

  // Primeira compra observada por cliente (para clienteNovo) e estado mais recente (para região)
  const primeiraCompraPorCliente = new Map<string, Date>();
  const estadoMaisRecentePorCliente = new Map<string, { estado: string; data: Date }>();
  for (const r of osRows as Array<{ empresa: string | null; dataAprovacao: string | null; estado: string | null }>) {
    const key = normalizeEmpresaKey(r.empresa ?? "");
    if (!key) continue;
    const data = parseDataFlexivel(r.dataAprovacao);
    if (data) {
      const atual = primeiraCompraPorCliente.get(key);
      if (!atual || data < atual) primeiraCompraPorCliente.set(key, data);
    }
    const uf = normalizarUf(r.estado);
    if (uf && data) {
      const atualEstado = estadoMaisRecentePorCliente.get(key);
      if (!atualEstado || data > atualEstado.data) estadoMaisRecentePorCliente.set(key, { estado: uf, data });
    }
  }

  const agora = new Date();
  const decididos: Decidido[] = [];
  for (const r of orcRows as Array<{ empresa: string | null; status: string | null; total: string | null; dataCadastro: string | null; validade: string | null }>) {
    const empresaKey = normalizeEmpresaKey(r.empresa ?? "");
    if (!empresaKey) continue;
    const data = parseDataFlexivel(r.dataCadastro);
    if (!data) continue;
    const statusKey = (r.status ?? "").trim().toLowerCase();
    const ganho = STATUS_GANHO.has(statusKey);
    const perdido = !ganho && foiPerdido(r.status, r.dataCadastro, r.validade, agora);
    if (!ganho && !perdido) continue; // ainda não decidido — fora do treino/teste
    const valor = parseFloat(String(r.total ?? "0")) || 0;
    const uf = estadoMaisRecentePorCliente.get(empresaKey);
    const regiao = uf ? UF_PARA_REGIAO[uf.estado] ?? null : null;
    decididos.push({ empresaKey, valor, data, ganho, regiao });
  }
  decididos.sort((a, b) => a.data.getTime() - b.data.getTime());

  console.log(`Total de orçamentos decididos (ganho ou perdido): ${decididos.length}`);
  console.log(`  Ganhos: ${decididos.filter(d => d.ganho).length}`);
  console.log(`  Perdidos: ${decididos.filter(d => !d.ganho).length}`);
  if (decididos.length < 50) {
    console.log("Amostra pequena demais para uma validação estatística confiável. Abortando.");
    return;
  }
  console.log(`  Período: ${decididos[0].data.toISOString().slice(0, 10)} a ${decididos[decididos.length - 1].data.toISOString().slice(0, 10)}`);

  // Corte de teste: os últimos 60 dias corridos observados na base viram teste;
  // o resto é treino. Walk-forward simples (sem vazamento — treino é estritamente anterior).
  const ultimaData = decididos[decididos.length - 1].data;
  const corte = new Date(ultimaData);
  corte.setDate(corte.getDate() - 90);
  const treino = decididos.filter(d => d.data < corte);
  const teste = decididos.filter(d => d.data >= corte);
  console.log(`\nCorte de teste: ${corte.toISOString().slice(0, 10)} (últimos 60 dias da base)`);
  console.log(`  Treino: ${treino.length} (${treino.filter(d => d.ganho).length} ganhos)`);
  console.log(`  Teste:  ${teste.length} (${teste.filter(d => d.ganho).length} ganhos)`);
  if (treino.length < 30 || teste.length < 10) {
    console.log("Treino ou teste pequenos demais para conclusão confiável — resultado abaixo é só indicativo.");
  }

  // ─── Agregados de TREINO ───────────────────────────────────────────────────
  const ganhosTreino = treino.filter(d => d.ganho).length;
  const perdidosTreino = treino.length - ganhosTreino;
  const taxaGeralTreino = ganhosTreino / treino.length;

  const porClienteTreino = new Map<string, { ganhos: number; perdidos: number; valores: number[] }>();
  for (const d of treino) {
    const acc = porClienteTreino.get(d.empresaKey) ?? { ganhos: 0, perdidos: 0, valores: [] };
    if (d.ganho) acc.ganhos++; else acc.perdidos++;
    acc.valores.push(d.valor);
    porClienteTreino.set(d.empresaKey, acc);
  }
  // "Cliente novo": nunca apareceu em porClienteTreino ANTES desta proposta (aprox.:
  // usamos "não tem nenhum orçamento de treino anterior a esta data" via primeiraCompraPorCliente
  // vindo de historico_os, igual à regra já usada em calcularTaxaConversaoNovosRecente).
  function ehClienteNovo(empresaKey: string, dataProposta: Date): boolean {
    const primeira = primeiraCompraPorCliente.get(empresaKey);
    return !primeira || primeira >= dataProposta;
  }
  const novosTreino = treino.filter(d => ehClienteNovo(d.empresaKey, d.data));
  const ganhosNovosTreino = novosTreino.filter(d => d.ganho).length;
  const perdidosNovosTreino = novosTreino.length - ganhosNovosTreino;
  const taxaNovosTreino = novosTreino.length > 0 ? ganhosNovosTreino / novosTreino.length : taxaGeralTreino;

  const faixaTreino = new Map<string, { ganhos: number; perdidos: number }>();
  for (const d of treino) {
    const faixa = faixaTicketDoValor(d.valor);
    const acc = faixaTreino.get(faixa) ?? { ganhos: 0, perdidos: 0 };
    if (d.ganho) acc.ganhos++; else acc.perdidos++;
    faixaTreino.set(faixa, acc);
  }
  const regiaoTreino = new Map<string, { ganhos: number; perdidos: number }>();
  for (const d of treino) {
    if (!d.regiao) continue;
    const acc = regiaoTreino.get(d.regiao) ?? { ganhos: 0, perdidos: 0 };
    if (d.ganho) acc.ganhos++; else acc.perdidos++;
    regiaoTreino.set(d.regiao, acc);
  }

  console.log(`\nTaxa geral (treino): ${(taxaGeralTreino * 100).toFixed(1)}%`);
  console.log(`Taxa de clientes novos (treino): ${(taxaNovosTreino * 100).toFixed(1)}% (n=${novosTreino.length})`);
  console.log("Faixas de tíquete (treino):");
  for (const [faixa, v] of faixaTreino) console.log(`  ${faixa}: ${v.ganhos}/${v.ganhos + v.perdidos} (${((v.ganhos / (v.ganhos + v.perdidos)) * 100).toFixed(0)}%)`);
  console.log("Regiões (treino):");
  for (const [regiao, v] of regiaoTreino) console.log(`  ${regiao}: ${v.ganhos}/${v.ganhos + v.perdidos} (${((v.ganhos / (v.ganhos + v.perdidos)) * 100).toFixed(0)}%)`);

  // ─── Modelo 1: baseline constante ──────────────────────────────────────────
  const predBaseline = teste.map(() => taxaGeralTreino);

  // ─── Modelo 2: heurística atual replicada ──────────────────────────────────
  const MIN_AMOSTRA_TAXA_INDIVIDUAL = 3;
  const MIN_AMOSTRA_FAIXA_TICKET = 5;
  const AJUSTE_FAIXA_TICKET_MAX_PP = 15;
  const MIN_AMOSTRA_REGIAO = 5;
  const AJUSTE_REGIAO_MAX_PP = 15;
  function heuristicaAtual(d: Decidido): number {
    const novo = ehClienteNovo(d.empresaKey, d.data);
    let base: number;
    if (novo) {
      base = taxaNovosTreino * 100;
    } else {
      const c = porClienteTreino.get(d.empresaKey);
      const total = (c?.ganhos ?? 0) + (c?.perdidos ?? 0);
      base = c && total >= MIN_AMOSTRA_TAXA_INDIVIDUAL ? (c.ganhos / total) * 100 : taxaGeralTreino * 100;
    }
    let prob = base;
    // Ajuste por ticket médio individual (só recorrente)
    if (!novo) {
      const c = porClienteTreino.get(d.empresaKey);
      const ticketMedio = c && c.valores.length > 0 ? c.valores.reduce((s, v) => s + v, 0) / c.valores.length : null;
      if (ticketMedio && ticketMedio > 0 && d.valor > 0) {
        const ratio = d.valor / ticketMedio;
        if (ratio > 2) prob -= 20; else if (ratio > 1) prob -= 10;
      }
    }
    const peso = novo ? 0.5 : 1;
    const faixa = faixaTreino.get(faixaTicketDoValor(d.valor));
    const amostraFaixa = faixa ? faixa.ganhos + faixa.perdidos : 0;
    if (faixa && amostraFaixa >= MIN_AMOSTRA_FAIXA_TICKET) {
      const taxaFaixa = (faixa.ganhos / amostraFaixa) * 100;
      const delta = Math.max(-AJUSTE_FAIXA_TICKET_MAX_PP, Math.min(AJUSTE_FAIXA_TICKET_MAX_PP, taxaFaixa - taxaGeralTreino * 100)) * peso;
      prob += delta;
    }
    if (d.regiao) {
      const reg = regiaoTreino.get(d.regiao);
      const amostraReg = reg ? reg.ganhos + reg.perdidos : 0;
      if (reg && amostraReg >= MIN_AMOSTRA_REGIAO) {
        const taxaReg = (reg.ganhos / amostraReg) * 100;
        const delta = Math.max(-AJUSTE_REGIAO_MAX_PP, Math.min(AJUSTE_REGIAO_MAX_PP, taxaReg - taxaGeralTreino * 100)) * peso;
        prob += delta;
      }
    }
    return Math.min(95, Math.max(5, prob)) / 100;
  }
  const predHeuristica = teste.map(heuristicaAtual);

  // ─── Modelo 3: bayesiano (Beta-Binomial por segmento + combinação em log-odds) ──
  const K_PRIOR = 8; // pseudo-contagem do prior — quanto maior, mais "puxa" segmentos pequenos pra taxa geral
  const alpha0Geral = K_PRIOR * taxaGeralTreino, beta0Geral = K_PRIOR * (1 - taxaGeralTreino);

  function taxaSegmentoBayes(ganhos: number, perdidos: number): number {
    return betaPosteriorMean(ganhos, perdidos, alpha0Geral, beta0Geral);
  }

  function bayesiano(d: Decidido): number {
    const logitGeral = logit(taxaGeralTreino);
    let logitFinal = logitGeral;

    // Fator cliente: novo (segmento) OU individual do cliente com encolhimento bayesiano
    const novo = ehClienteNovo(d.empresaKey, d.data);
    if (novo) {
      const pNovo = taxaSegmentoBayes(ganhosNovosTreino, perdidosNovosTreino);
      logitFinal += logit(pNovo) - logitGeral;
    } else {
      const c = porClienteTreino.get(d.empresaKey);
      const pCliente = taxaSegmentoBayes(c?.ganhos ?? 0, c?.perdidos ?? 0);
      logitFinal += logit(pCliente) - logitGeral;
    }

    // Fator faixa de tíquete
    const faixa = faixaTreino.get(faixaTicketDoValor(d.valor));
    const pFaixa = taxaSegmentoBayes(faixa?.ganhos ?? 0, faixa?.perdidos ?? 0);
    logitFinal += logit(pFaixa) - logitGeral;

    // Fator região (só se conhecida)
    if (d.regiao) {
      const reg = regiaoTreino.get(d.regiao);
      const pRegiao = taxaSegmentoBayes(reg?.ganhos ?? 0, reg?.perdidos ?? 0);
      logitFinal += logit(pRegiao) - logitGeral;
    }

    const p = sigmoid(logitFinal);
    return Math.min(0.95, Math.max(0.05, p));
  }
  const predBayes = teste.map(bayesiano);

  const real = teste.map(d => (d.ganho ? 1 : 0));

  console.log("\n=== Resultado no conjunto de TESTE (últimos 60 dias, fora do treino) ===\n");
  const linhas = [
    { nome: "Baseline (taxa geral constante)", pred: predBaseline },
    { nome: "Heurística atual (replicada)", pred: predHeuristica },
    { nome: "Bayesiano (Beta-Binomial + log-odds)", pred: predBayes },
  ];
  for (const l of linhas) {
    const ll = logLoss(l.pred, real);
    const brier = brierScore(l.pred, real);
    const a = auc(l.pred, real);
    console.log(`${l.nome}:`);
    console.log(`  log-loss = ${ll.toFixed(4)}  |  Brier = ${brier.toFixed(4)}  |  AUC = ${a !== null ? a.toFixed(3) : "n/a (sem variação de classe)"}`);
  }

  console.log("\n=== Calibração (previsto médio vs. real médio por quintil) — modelo bayesiano ===");
  for (const linha of tabelaCalibracao(predBayes, real)) {
    console.log(`  ${linha.faixa}: previsto ${(linha.previstoMedio * 100).toFixed(0)}% | real ${(linha.realMedio * 100).toFixed(0)}%`);
  }
  console.log("\n=== Calibração — heurística atual ===");
  for (const linha of tabelaCalibracao(predHeuristica, real)) {
    console.log(`  ${linha.faixa}: previsto ${(linha.previstoMedio * 100).toFixed(0)}% | real ${(linha.realMedio * 100).toFixed(0)}%`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(erro => { console.error("Falha na validação:", erro); process.exit(1); });
