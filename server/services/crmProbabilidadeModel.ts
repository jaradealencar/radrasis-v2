import {
  clientesPerfilCnpj,
  historicoOrcamentos,
  historicoOs,
} from "../../drizzle/schema";
import {
  faixaTicketDoValor,
  parseDataFlexivel,
  STATUS_ABERTO,
  STATUS_GANHO,
  STATUS_PERDIDO,
} from "./inteligenciaClientes";
import { normalizeEmpresaKey } from "./probabilidadeCompra";
import { UF_PARA_REGIAO, normalizarUf } from "../utils/regioesBrasil";
import { isOsNormalDb } from "../utils/os-valida";

const PERDIDO_ABERTO_APOS_DIAS = 30;
const CACHE_MODELO_MS = 30 * 60 * 1000;
const DIAS_ANO = 365.2425;
const TICKET_FAIXAS = [
  "Até R$330", "R$335~750", "R$760~1.300", "R$1.301~5.490",
  "R$5.500~8.000", "R$8.010~12.000", "R$12k+",
];
const FAIXAS_IDADE = ["menos de 1 ano", "1 a 3 anos", "3 a 10 anos", "10+ anos", "idade desconhecida"];
const COORTES = ["sem compra anterior", "até 2022", "2023-2024", "2025+", "coorte desconhecida"];
const REGIOES = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul", "região desconhecida"];

const NUMERIC_FEATURES = [
  "ticketLog", "idadeEmpresaLog", "recenciaCompraMesesLog", "frequenciaRfm12mLog",
  "valorRfm12mLog", "comprasHistoricasLog", "tempoClienteMesesLog", "orcamentosAnterioresLog",
];
const CATEGORICAL_FEATURES = [
  ...TICKET_FAIXAS.map((v) => `ticket:${v}`),
  ...FAIXAS_IDADE.map((v) => `idade:${v}`),
  ...COORTES.map((v) => `coorte:${v}`),
  ...REGIOES.map((v) => `regiao:${v}`),
  "cliente:novo", "cliente:recorrente", "idade:disponivel", "idade:indisponivel",
];
const FEATURE_NAMES = [...NUMERIC_FEATURES, ...CATEGORICAL_FEATURES];

export interface PropostaComDesfecho {
  empresa: string;
  empresaKey: string;
  valor: number;
  data: Date;
  numero: string | null;
  ganhou: boolean;
  regiao: string | null;
}

interface OsHistorica {
  empresaKey: string;
  data: Date;
  valor: number;
  estado: string | null;
  tipoOs: string | null;
  status: string | null;
}

interface OrcamentoHistoricoCliente {
  data: Date;
  numero: string | null;
}

export interface ExemploProbabilidadeCrm {
  proposta: PropostaComDesfecho;
  alvo: 0 | 1;
  features: number[];
}

export interface CalibradorPlatt {
  mediaLogit: number;
  escalaLogit: number;
  coeficiente: number;
  intercepto: number;
  n: number;
}

export interface ModeloLogisticoCrm {
  media: number[];
  escala: number[];
  coeficientes: number[];
  intercepto: number;
  calibrador: CalibradorPlatt | null;
}

export interface ModeloProbabilidadeCrm {
  modelo: ModeloLogisticoCrm;
  exemplos: ExemploProbabilidadeCrm[];
  propostasPorCliente: Map<string, OrcamentoHistoricoCliente[]>;
  osPorCliente: Map<string, OsHistorica[]>;
  inicioEmpresaPorCliente: Map<string, Date>;
  taxaGeral: number;
  nTreino: number;
  ultimaPropostaTreino: Date | null;
  ultimaPropostaHistorico: Date | null;
  propostasHistoricoSemDesfecho: number;
  coberturaIdadeEmpresarial: { clientesHistoricos: number; clientesComIdade: number; propostasTreino: number; propostasComIdade: number };
  distribuicaoIdade: Array<{ faixa: string; n: number; percentual: number }>;
}

let modeloEmCache: ModeloProbabilidadeCrm | null = null;
let modeloExpiraEm = 0;

function numero(valor: unknown): number {
  const parsed = Number(String(valor ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function lerData(valor: string | Date | null | undefined): Date | null {
  if (valor instanceof Date && Number.isFinite(valor.getTime())) return valor;
  if (typeof valor !== "string" || !valor.trim()) return null;
  return parseDataFlexivel(valor) ?? null;
}

function mesesEntre(inicio: Date, fim: Date): number {
  return Math.max(0, (fim.getTime() - inicio.getTime()) / (DIAS_ANO / 12 * 86400000));
}

function faixaIdade(anos: number | null): string {
  if (anos === null || !Number.isFinite(anos) || anos < 0) return "idade desconhecida";
  if (anos < 1) return "menos de 1 ano";
  if (anos < 3) return "1 a 3 anos";
  if (anos < 10) return "3 a 10 anos";
  return "10+ anos";
}

function faixaCoorte(primeiraCompra: Date | null): string {
  if (!primeiraCompra) return "sem compra anterior";
  const ano = primeiraCompra.getFullYear();
  if (ano <= 2022) return "até 2022";
  if (ano <= 2024) return "2023-2024";
  return "2025+";
}

function idadeNaData(inicioEmpresa: Date | null, data: Date): number | null {
  if (!inicioEmpresa || inicioEmpresa > data) return null;
  return (data.getTime() - inicioEmpresa.getTime()) / (DIAS_ANO * 86400000);
}

function featuresParaProposta(args: {
  valor: number;
  data: Date;
  empresaKey: string;
  numero?: string | null;
  regiao?: string | null;
  propostasPorCliente: Map<string, OrcamentoHistoricoCliente[]>;
  osPorCliente: Map<string, OsHistorica[]>;
  inicioEmpresaPorCliente: Map<string, Date>;
}): number[] {
  const { valor, data, empresaKey } = args;
  const nomeFeatures = new Map<string, number>();
  const anteriores = args.propostasPorCliente.get(empresaKey) ?? [];
  const cotacoesAntes = anteriores.reduce((n, item) => {
    const mesmoOrcamento = Boolean(args.numero && item.numero && String(args.numero) === String(item.numero));
    return n + Number(item.data < data && !mesmoOrcamento);
  }, 0);
  const osAnteriores = (args.osPorCliente.get(empresaKey) ?? []).filter((os) => os.data < data && isOsNormalDb(os));
  const primeiraCompra = osAnteriores.length ? osAnteriores[0].data : null;
  const ultimaCompra = osAnteriores.length ? osAnteriores[osAnteriores.length - 1].data : null;
  const corte12m = new Date(data.getTime() - DIAS_ANO * 86400000);
  const compras12m = osAnteriores.filter((os) => os.data >= corte12m);
  const valor12m = compras12m.reduce((total, os) => total + os.valor, 0);
  const inicioEmpresa = args.inicioEmpresaPorCliente.get(empresaKey) ?? null;
  const idadeAnos = idadeNaData(inicioEmpresa, data);
  const estadoAnterior = [...osAnteriores].reverse().find((os) => normalizarUf(os.estado))?.estado ?? null;
  const regiao = args.regiao ?? (estadoAnterior ? UF_PARA_REGIAO[normalizarUf(estadoAnterior) ?? ""] ?? null : null);
  const regiaoNormalizada = REGIOES.includes(regiao ?? "") ? regiao! : "região desconhecida";
  const idadeMeses = primeiraCompra ? mesesEntre(primeiraCompra, data) : 0;
  const recenciaMeses = ultimaCompra ? Math.min(120, mesesEntre(ultimaCompra, data)) : 120;
  const faixaTicket = faixaTicketDoValor(Math.max(0, valor));
  const idadeGrupo = faixaIdade(idadeAnos);
  const coorte = faixaCoorte(primeiraCompra);

  nomeFeatures.set("ticketLog", Math.log1p(Math.max(0, valor)));
  nomeFeatures.set("idadeEmpresaLog", idadeAnos === null ? 0 : Math.log1p(Math.min(100, idadeAnos)));
  nomeFeatures.set("recenciaCompraMesesLog", Math.log1p(recenciaMeses));
  nomeFeatures.set("frequenciaRfm12mLog", Math.log1p(compras12m.length));
  nomeFeatures.set("valorRfm12mLog", Math.log1p(Math.max(0, valor12m)));
  nomeFeatures.set("comprasHistoricasLog", Math.log1p(osAnteriores.length));
  nomeFeatures.set("tempoClienteMesesLog", Math.log1p(Math.min(240, idadeMeses)));
  nomeFeatures.set("orcamentosAnterioresLog", Math.log1p(cotacoesAntes));
  for (const item of TICKET_FAIXAS) nomeFeatures.set(`ticket:${item}`, Number(item === faixaTicket));
  for (const item of FAIXAS_IDADE) nomeFeatures.set(`idade:${item}`, Number(item === idadeGrupo));
  for (const item of COORTES) nomeFeatures.set(`coorte:${item}`, Number(item === coorte));
  for (const item of REGIOES) nomeFeatures.set(`regiao:${item}`, Number(item === regiaoNormalizada));
  nomeFeatures.set("cliente:novo", Number(osAnteriores.length === 0));
  nomeFeatures.set("cliente:recorrente", Number(osAnteriores.length > 0));
  nomeFeatures.set("idade:disponivel", Number(idadeAnos !== null));
  nomeFeatures.set("idade:indisponivel", Number(idadeAnos === null));
  return FEATURE_NAMES.map((name) => nomeFeatures.get(name) ?? 0);
}

function sigmoide(x: number): number {
  if (x > 30) return 1;
  if (x < -30) return 0;
  return 1 / (1 + Math.exp(-x));
}

function logit(p: number): number {
  const limitado = Math.min(0.999, Math.max(0.001, p));
  return Math.log(limitado / (1 - limitado));
}

function prepararMatriz(exemplos: ExemploProbabilidadeCrm[]) {
  const dimensoes = FEATURE_NAMES.length;
  const media = Array.from({ length: dimensoes }, (_, j) => exemplos.reduce((s, e) => s + e.features[j], 0) / exemplos.length);
  const escala = Array.from({ length: dimensoes }, (_, j) => {
    const variancia = exemplos.reduce((s, e) => s + (e.features[j] - media[j]) ** 2, 0) / exemplos.length;
    return Math.sqrt(variancia) || 1;
  });
  const x = exemplos.map((e) => e.features.map((v, j) => (v - media[j]) / escala[j]));
  return { media, escala, x, y: exemplos.map((e) => e.alvo) };
}

export function treinarRegressaoLogistica(
  exemplos: ExemploProbabilidadeCrm[],
  calibrar = true,
): ModeloLogisticoCrm {
  if (!exemplos.length) {
    return { media: FEATURE_NAMES.map(() => 0), escala: FEATURE_NAMES.map(() => 1), coeficientes: FEATURE_NAMES.map(() => 0), intercepto: logit(0.2), calibrador: null };
  }
  const { media, escala, x, y } = prepararMatriz(exemplos);
  const taxa = y.reduce<number>((s, v) => s + v, 0) / y.length;
  const coeficientes = FEATURE_NAMES.map(() => 0);
  let intercepto = logit(taxa);
  const l2 = 1.5;
  const passo = 0.12;
  const iteracoes = 700;
  for (let iteracao = 0; iteracao < iteracoes; iteracao++) {
    let gradienteB = 0;
    const gradienteW = FEATURE_NAMES.map(() => 0);
    for (let i = 0; i < x.length; i++) {
      let z = intercepto;
      for (let j = 0; j < coeficientes.length; j++) z += coeficientes[j] * x[i][j];
      const erro = sigmoide(z) - y[i];
      gradienteB += erro;
      for (let j = 0; j < coeficientes.length; j++) gradienteW[j] += erro * x[i][j];
    }
    intercepto -= passo * gradienteB / x.length;
    for (let j = 0; j < coeficientes.length; j++) {
      coeficientes[j] -= passo * (gradienteW[j] / x.length + l2 * coeficientes[j] / x.length);
    }
  }
  const modelo: ModeloLogisticoCrm = { media, escala, coeficientes, intercepto, calibrador: null };
  if (calibrar && exemplos.length >= 300) modelo.calibrador = treinarCalibradorTemporal(exemplos);
  return modelo;
}

function logitBruto(modelo: ModeloLogisticoCrm, features: number[]): number {
  let z = modelo.intercepto;
  for (let j = 0; j < modelo.coeficientes.length; j++) {
    z += modelo.coeficientes[j] * (features[j] - modelo.media[j]) / modelo.escala[j];
  }
  return z;
}

function treinarCalibradorTemporal(exemplos: ExemploProbabilidadeCrm[]): CalibradorPlatt | null {
  const ordenados = [...exemplos].sort((a, b) => a.proposta.data.getTime() - b.proposta.data.getTime());
  const inicio = Math.floor(ordenados.length * 0.45);
  const preditos: Array<{ z: number; y: number }> = [];
  const blocos = 5;
  const tamanho = Math.max(1, Math.floor((ordenados.length - inicio) / blocos));
  for (let bloco = 0; bloco < blocos; bloco++) {
    const comecoTeste = inicio + bloco * tamanho;
    const fimTeste = bloco === blocos - 1 ? ordenados.length : Math.min(ordenados.length, comecoTeste + tamanho);
    if (fimTeste <= comecoTeste || comecoTeste < 100) continue;
    const treinoPrefixo = ordenados.slice(0, comecoTeste);
    const modeloPrefixo = treinarRegressaoLogistica(treinoPrefixo, false);
    for (const exemplo of ordenados.slice(comecoTeste, fimTeste)) {
      preditos.push({ z: logitBruto(modeloPrefixo, exemplo.features), y: exemplo.alvo });
    }
  }
  if (preditos.length < 100) return null;
  const mediaLogit = preditos.reduce((s, item) => s + item.z, 0) / preditos.length;
  const escalaLogit = Math.sqrt(preditos.reduce((s, item) => s + (item.z - mediaLogit) ** 2, 0) / preditos.length) || 1;
  const x = preditos.map((item) => (item.z - mediaLogit) / escalaLogit);
  const y = preditos.map((item) => item.y);
  let coeficiente = 1;
  let intercepto = 0;
  for (let iteracao = 0; iteracao < 800; iteracao++) {
    let gradA = 0;
    let gradB = 0;
    for (let i = 0; i < x.length; i++) {
      const erro = sigmoide(intercepto + coeficiente * x[i]) - y[i];
      gradA += erro * x[i];
      gradB += erro;
    }
    coeficiente -= 0.08 * (gradA / x.length + 0.05 * (coeficiente - 1));
    intercepto -= 0.08 * gradB / x.length;
  }
  return { mediaLogit, escalaLogit, coeficiente, intercepto, n: preditos.length };
}

export function preverComLogistica(modelo: ModeloLogisticoCrm, features: number[]): number {
  const z = logitBruto(modelo, features);
  if (!modelo.calibrador) return sigmoide(z);
  const c = modelo.calibrador;
  return sigmoide(c.intercepto + c.coeficiente * ((z - c.mediaLogit) / c.escalaLogit));
}

function rotular(r: { status: string | null; dataCadastro: string | null; validade: string | null }, agora: Date): 0 | 1 | null {
  const status = (r.status ?? "").trim().toLowerCase();
  if (STATUS_GANHO.has(status)) return 1;
  if (STATUS_PERDIDO.has(status)) return 0;
  if (status !== STATUS_ABERTO) return null;
  const data = lerData(r.dataCadastro);
  if (!data) return null;
  const validadeDias = numero(r.validade);
  if (validadeDias > 0) {
    const vencimento = new Date(data);
    vencimento.setDate(vencimento.getDate() + validadeDias);
    return vencimento < agora ? 0 : null;
  }
  return (agora.getTime() - data.getTime()) / 86400000 > PERDIDO_ABERTO_APOS_DIAS ? 0 : null;
}

export async function construirModeloProbabilidadeCrm(db: any, agora = new Date()): Promise<ModeloProbabilidadeCrm> {
  if (modeloEmCache && Date.now() < modeloExpiraEm) return modeloEmCache;
  const modelo = await carregarModeloProbabilidadeCrm(db, agora);
  modeloEmCache = modelo;
  modeloExpiraEm = Date.now() + CACHE_MODELO_MS;
  return modelo;
}

export async function carregarModeloProbabilidadeCrm(db: any, agora = new Date()): Promise<ModeloProbabilidadeCrm> {
  const [orcRows, osRows, perfis] = await Promise.all([
    db.select({ empresa: historicoOrcamentos.empresa, numero: historicoOrcamentos.orcNumero, status: historicoOrcamentos.status, total: historicoOrcamentos.total, dataCadastro: historicoOrcamentos.dataCadastro, validade: historicoOrcamentos.validade }).from(historicoOrcamentos),
    db.select({ empresa: historicoOs.empresa, dataAprovacao: historicoOs.dataAprovacao, valorTotal: historicoOs.valorTotal, valorOs: historicoOs.valorOs, estado: historicoOs.estado, tipoOs: historicoOs.tipoOs, status: historicoOs.status }).from(historicoOs),
    db.select({ empresaKey: clientesPerfilCnpj.empresaKey, dataInicioAtividade: clientesPerfilCnpj.dataInicioAtividade }).from(clientesPerfilCnpj),
  ]);

  const propostasPorCliente = new Map<string, OrcamentoHistoricoCliente[]>();
  const perfilInicioPorCliente = new Map<string, Date>();
  for (const perfil of perfis as Array<{ empresaKey: string; dataInicioAtividade: string | null }>) {
    const chave = normalizeEmpresaKey(perfil.empresaKey ?? "");
    const inicio = lerData(perfil.dataInicioAtividade);
    if (chave && inicio) perfilInicioPorCliente.set(chave, inicio);
  }
  const osPorCliente = new Map<string, OsHistorica[]>();
  for (const row of osRows as Array<{ empresa: string | null; dataAprovacao: string | null; valorTotal: string | null; valorOs: string | null; estado: string | null; tipoOs: string | null; status: string | null }>) {
    const empresaKey = normalizeEmpresaKey(row.empresa ?? "");
    const data = lerData(row.dataAprovacao);
    if (!empresaKey || !data) continue;
    const itens = osPorCliente.get(empresaKey) ?? [];
    itens.push({ empresaKey, data, valor: numero(row.valorTotal || row.valorOs), estado: row.estado, tipoOs: row.tipoOs, status: row.status });
    osPorCliente.set(empresaKey, itens);
  }
  for (const itens of osPorCliente.values()) itens.sort((a, b) => a.data.getTime() - b.data.getTime());

  const propostasOrdenadas = (orcRows as Array<{ empresa: string | null; numero: string | null; status: string | null; total: string | null; dataCadastro: string | null; validade: string | null }>)
    .map((r) => ({ ...r, data: lerData(r.dataCadastro), empresaKey: normalizeEmpresaKey(r.empresa ?? "") }))
    .filter((r) => r.data && r.empresaKey)
    .sort((a, b) => a.data!.getTime() - b.data!.getTime());
  for (const row of propostasOrdenadas) {
    const propostas = propostasPorCliente.get(row.empresaKey) ?? [];
    propostas.push({ data: row.data!, numero: row.numero });
    propostasPorCliente.set(row.empresaKey, propostas);
  }

  const exemplos: ExemploProbabilidadeCrm[] = [];
  for (const row of propostasOrdenadas) {
    const alvo = rotular(row, agora);
    if (alvo === null) continue;
    const data = row.data!;
    const empresaKey = row.empresaKey;
    const osAntigas = (osPorCliente.get(empresaKey) ?? []).filter((os) => os.data < data && isOsNormalDb(os));
    const estadoAntigo = [...osAntigas].reverse().find((os) => normalizarUf(os.estado))?.estado ?? null;
    const regiao = estadoAntigo ? UF_PARA_REGIAO[normalizarUf(estadoAntigo) ?? ""] ?? null : null;
    const proposta: PropostaComDesfecho = {
      empresa: row.empresa ?? "",
      empresaKey,
      valor: numero(row.total),
      data,
      numero: row.numero,
      ganhou: alvo === 1,
      regiao,
    };
    exemplos.push({
      proposta,
      alvo,
      features: featuresParaProposta({ valor: proposta.valor, data, empresaKey, numero: proposta.numero, regiao, propostasPorCliente, osPorCliente, inicioEmpresaPorCliente: perfilInicioPorCliente }),
    });
  }

  const clientesHistoricos = new Set(propostasOrdenadas.map((r) => r.empresaKey));
  const clientesComIdade = [...clientesHistoricos].filter((key) => perfilInicioPorCliente.has(key));
  const propostasTreino = exemplos.length;
  const faixaIndices = FAIXAS_IDADE.map((faixa) => ({ faixa, index: FEATURE_NAMES.indexOf(`idade:${faixa}`) }));
  const distribuicaoIdade = faixaIndices.map(({ faixa, index }) => {
    const n = exemplos.reduce((s, e) => s + Number(e.features[index] > 0), 0);
    return { faixa, n, percentual: propostasTreino ? n / propostasTreino * 100 : 0 };
  });
  const modelo = treinarRegressaoLogistica(exemplos);
  const ultimaPropostaTreino = exemplos.reduce<Date | null>((ultima, e) => !ultima || e.proposta.data > ultima ? e.proposta.data : ultima, null);
  return {
    modelo,
    exemplos,
    propostasPorCliente,
    osPorCliente,
    inicioEmpresaPorCliente: perfilInicioPorCliente,
    taxaGeral: exemplos.length ? exemplos.reduce((s, e) => s + e.alvo, 0) / exemplos.length : 0.2,
    nTreino: exemplos.length,
    ultimaPropostaTreino,
    ultimaPropostaHistorico: propostasOrdenadas.at(-1)?.data ?? null,
    propostasHistoricoSemDesfecho: Math.max(0, propostasOrdenadas.length - exemplos.length),
    coberturaIdadeEmpresarial: {
      clientesHistoricos: clientesHistoricos.size,
      clientesComIdade: clientesComIdade.length,
      propostasTreino,
      propostasComIdade: exemplos.reduce((s, e) => s + Number(e.features[FEATURE_NAMES.indexOf("idade:disponivel")] > 0), 0),
    },
    distribuicaoIdade,
  } satisfies Omit<ModeloProbabilidadeCrm, "modelo"> & { modelo: ModeloLogisticoCrm };
}

export function calcularProbabilidadeCrmAprendida(args: {
  modelo: ModeloProbabilidadeCrm;
  nomeCliente: string;
  valorProposta: number;
  dataProposta?: string | Date | null;
  numeroProposta?: string | null;
  regiaoCliente?: string | null;
}): { probabilidade: number; explicacao: string[] } {
  const empresaKey = normalizeEmpresaKey(args.nomeCliente);
  const data = lerData(args.dataProposta) ?? new Date();
  const regiao = args.regiaoCliente ? UF_PARA_REGIAO[normalizarUf(args.regiaoCliente) ?? ""] ?? args.regiaoCliente : null;
  const features = featuresParaProposta({
    valor: args.valorProposta,
    data,
    empresaKey,
    numero: args.numeroProposta,
    regiao,
    propostasPorCliente: args.modelo.propostasPorCliente,
    osPorCliente: args.modelo.osPorCliente,
    inicioEmpresaPorCliente: args.modelo.inicioEmpresaPorCliente,
  });
  const bruto = preverComLogistica(args.modelo.modelo, features);
  const probabilidade = Math.max(1, Math.min(99, Math.round(bruto * 100)));
  const idadeIndex = FEATURE_NAMES.indexOf("idade:disponivel");
  const recencia = Math.min(120, mesesEntre(
    [...(args.modelo.osPorCliente.get(empresaKey) ?? [])].filter((os) => os.data < data && isOsNormalDb(os)).at(-1)?.data ?? data,
    data,
  ));
  const idadeGrupo = FAIXAS_IDADE.find((faixa) => features[FEATURE_NAMES.indexOf(`idade:${faixa}`)] > 0) ?? "idade desconhecida";
  const calibracao = args.modelo.modelo.calibrador;
  const explicacao = [
    `Modelo: regressão logística recalibrada com ${args.modelo.nTreino} propostas decididas; conversão histórica da base ${(args.modelo.taxaGeral * 100).toFixed(1)}%.`,
    `Ticket da proposta: ${faixaTicketDoValor(args.valorProposta)} (R$ ${args.valorProposta.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}); faixa e valor entram no cálculo individual.`,
    `Perfil: ${idadeGrupo}; recência de compra ${recencia.toFixed(0)} meses; histórico RFM e coorte entram quando disponíveis.`,
    features[idadeIndex] > 0
      ? `Idade da empresa: calculada na data da proposta; perfil identificado em ${args.modelo.coberturaIdadeEmpresarial.clientesComIdade}/${args.modelo.coberturaIdadeEmpresarial.clientesHistoricos} clientes do histórico.`
      : `Idade da empresa: cadastro CNPJ sem vínculo; o modelo não inventa esse dado.`,
  ];
  if (calibracao) explicacao.push(`Calibração temporal: automática, baseada em ${calibracao.n} previsões históricas fora da amostra.`);
  if (args.modelo.ultimaPropostaTreino) explicacao.push(`Desfechos até: ${args.modelo.ultimaPropostaTreino.toLocaleDateString("pt-BR")}.`);
  if (args.modelo.ultimaPropostaHistorico) explicacao.push(`Histórico de propostas: até ${args.modelo.ultimaPropostaHistorico.toLocaleDateString("pt-BR")}; ${args.modelo.propostasHistoricoSemDesfecho} ainda sem desfecho para treino.`);
  return { probabilidade, explicacao };
}

export const CRM_PROBABILITY_FEATURE_NAMES = FEATURE_NAMES;
export const CRM_PROBABILITY_TICKET_BANDS = TICKET_FAIXAS;
export const CRM_PROBABILITY_AGE_BANDS = FAIXAS_IDADE;
export const CRM_PROBABILITY_COHORTS = COORTES;
export const CRM_PROBABILITY_REGIONS = REGIOES;
