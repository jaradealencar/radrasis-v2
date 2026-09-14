/**
 * Score de Probabilidade de Compra.
 *
 * Usado por server/routers/crm.ts (cada proposta) e por
 * server/routers/performanceComercial.ts (listarClientesInteligencia, cada
 * cliente) para que os dois módulos mostrem o mesmo número para o mesmo
 * cliente.
 *
 * Fórmula:
 *   - Cliente novo: base = taxa de conversão dos clientes novos nos últimos
 *     3 meses, contando só orçamentos DECIDIDOS (ganho ou perdido) — ver nota
 *     em calcularTaxaConversaoNovosRecente.
 *   - Cliente recorrente: base = taxa de conversão INDIVIDUAL dele
 *     (orçamentos que fez vs. que fecharam, historicoOrcamentos) — com
 *     amostra mínima de MIN_AMOSTRA_TAXA_INDIVIDUAL; abaixo disso, usa a
 *     taxa geral da carteira (instável demais com 1-2 orçamentos).
 *   - Ajustes (aditivos, cada um só aplica com amostra mínima própria):
 *     ticket médio individual do cliente, faixa de valor da carteira
 *     (construirMapaFaixaTicket) e região geográfica do cliente
 *     (construirMapaConversaoPorRegiao).
 *
 * Fora de escopo: cruzamento com CNPJ (idade da empresa, sócios). A chave de
 * agrupamento é sempre normalizeEmpresaKey — mesma chave usada em
 * performanceComercial.ts/inteligenciaClientes.ts, para que o CRM e a
 * Inteligência de Clientes concordem sobre o mesmo cliente.
 */

import { historicoOrcamentos, historicoOs } from "../../drizzle/schema";
import { STATUS_GANHO, STATUS_PERDIDO, STATUS_ABERTO, parseDataFlexivel, calcularConversaoPorFaixaTicket, faixaTicketDoValor, type FaixaTicketConversao } from "./inteligenciaClientes";
import { UF_PARA_REGIAO, normalizarUf } from "../utils/regioesBrasil";

/**
 * "Perdido" explícito (STATUS_PERDIDO) OU "em aberto" há mais de
 * DIAS_PRESUMIDO_PERDIDO dias — mesmo limiar que server/routers/crm.ts já usa
 * (`janelaSugerida`: >30 dias = "perdido").
 *
 * Descoberto em 13/09/2026 medindo a distribuição real de status em
 * historico_orcamentos: só 3 de 5.920 linhas (em TODOS os meses de 2026, não
 * só os recentes) têm status "Reprovado"/"Cancelada" — a equipe, na prática,
 * nunca fecha formalmente uma proposta perdida no ERP, só abandona como "Em
 * aberto" para sempre. Contar só STATUS_PERDIDO explícito faz qualquer
 * cálculo "só decididos" (aqui e na análise de faixa de tíquete do usuário em
 * inteligenciaClientes.ts) dar ~100% de conversão — não é sinal real, é
 * artefato de como o time usa o sistema. Tratar "em aberto" antigo como
 * perdido presumido corrige isso sem abandonar a filosofia "só contar o que
 * já teve tempo de ser decidido".
 */
const DIAS_PRESUMIDO_PERDIDO = 30;

/** "Em aberto" perdido presumido: usa a validade REAL do orçamento (mesmo
 * critério de calcularConversaoPorFaixaTicket, inteligenciaClientes.ts —
 * unificado em 13/09/2026 para os dois cálculos concordarem) quando ela está
 * preenchida; cai para um limiar fixo de DIAS_PRESUMIDO_PERDIDO só nos ~9%
 * dos casos sem validade cadastrada (medido em 13/09/2026), pra não perder
 * esses orçamentos como "nunca decidido". */
function foiPerdido(status: string | null, dataCadastro: string | null, validade: string | null, agora: Date): boolean {
  const statusKey = (status ?? "").trim().toLowerCase();
  if (STATUS_PERDIDO.has(statusKey)) return true;
  if (statusKey !== "em aberto") return false;
  const data = parseDataFlexivel(dataCadastro);
  if (!data) return false;
  const validadeDias = parseFloat(String(validade ?? "0")) || 0;
  if (validadeDias > 0) {
    const dataVencimento = new Date(data);
    dataVencimento.setDate(dataVencimento.getDate() + validadeDias);
    return dataVencimento < agora;
  }
  const dias = (agora.getTime() - data.getTime()) / (1000 * 60 * 60 * 24);
  return dias > DIAS_PRESUMIDO_PERDIDO;
}

export const MIN_AMOSTRA_TAXA_INDIVIDUAL = 3;

/**
 * Cópia intencional de normalizeEmpresaKey (server/routers/performanceComercial.ts) —
 * não importada de lá para evitar dependência circular (performanceComercial.ts
 * importa este arquivo para listarClientesInteligencia). Precisa ficar idêntica
 * à de lá para as duas telas concordarem sobre a mesma chave de cliente.
 */
export function normalizeEmpresaKey(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

export interface ConversaoCliente {
  totalOrcamentos: number;
  orcamentosFechados: number;
  /** null quando a amostra é pequena demais para confiar (ver MIN_AMOSTRA_TAXA_INDIVIDUAL). */
  taxaIndividual: number | null;
  /** null quando não há nenhum orçamento com valor registrado. */
  ticketMedio: number | null;
  /** Número de compras em todo o histórico local disponível (historico_os +
   * historico_orcamentos fechados — ver nota em construirMapaConversaoClientes
   * sobre o buraco de nov/dez de 2025 não coberto por nenhuma tabela local).
   * Usado por ex. para elegibilidade de parcelamento (clientes com mais de
   * N compras). */
  qtdCompras: number;
  /** Data da compra mais recente (historico_os.dataAprovacao ou
   * historico_orcamentos.dataCadastro para orçamentos ganhos) — null quando
   * o cliente não tem nenhuma compra registrada localmente. Usada para
   * mostrar "há N dias sem comprar" no CRM. */
  ultimaCompra: Date | null;
}

export interface MapaConversaoClientes {
  porCliente: Map<string, ConversaoCliente>;
  /** Taxa de conversão agregada de toda a carteira (fallback para amostra pequena). */
  taxaGeral: number;
}

type DbClient = { select: Function };

/**
 * Lê todo o histórico de orçamentos (historico_orcamentos) e agrupa por
 * cliente. Consulta local ao Postgres — não depende do MubiSys, então é
 * rápida (nenhum risco de timeout como o já visto nas buscas ao vivo do CRM).
 */
export async function construirMapaConversaoClientes(db: any): Promise<MapaConversaoClientes> {
  const linhas = await db.select({
    empresa: historicoOrcamentos.empresa,
    status: historicoOrcamentos.status,
    total: historicoOrcamentos.total,
    dataCadastro: historicoOrcamentos.dataCadastro,
  }).from(historicoOrcamentos);

  const porCliente = new Map<string, { total: number; fechados: number; somaValor: number; qtdComValor: number; ultimaCompra: Date | null }>();
  let totalGeral = 0;
  let fechadosGeral = 0;

  for (const r of linhas as Array<{ empresa: string | null; status: string | null; total: string | null; dataCadastro: string | null }>) {
    const empresaKey = normalizeEmpresaKey(r.empresa ?? "");
    if (!empresaKey) continue;
    const fechou = STATUS_GANHO.has((r.status ?? "").trim().toLowerCase());
    const valor = r.total != null ? parseFloat(r.total) : NaN;

    let acc = porCliente.get(empresaKey);
    if (!acc) {
      acc = { total: 0, fechados: 0, somaValor: 0, qtdComValor: 0, ultimaCompra: null };
      porCliente.set(empresaKey, acc);
    }
    acc.total++;
    if (fechou) {
      acc.fechados++;
      // Sem data de fechamento própria em historico_orcamentos — usa a data
      // do orçamento como proxy da compra (mesma fonte já usada para contar
      // esse orçamento como "compra" em qtdCompras).
      const data = parseDataFlexivel(r.dataCadastro);
      if (data && (!acc.ultimaCompra || data > acc.ultimaCompra)) acc.ultimaCompra = data;
    }
    if (!isNaN(valor)) { acc.somaValor += valor; acc.qtdComValor++; }

    totalGeral++;
    if (fechou) fechadosGeral++;
  }

  // Número de compras em TODO o histórico disponível — soma duas fontes que,
  // medido em 13/09/2026, não se sobrepõem no tempo (sem risco de contar a
  // mesma compra duas vezes):
  //   - historico_os: 02/2024 a 10/2025 (parou de sincronizar depois disso)
  //   - historico_orcamentos (STATUS_GANHO, já contado acima em acc.fechados): 01/2026 em diante
  // Existe um buraco real de nov/dez de 2025 que nenhuma tabela local cobre —
  // 3 tentativas de rodar POST /api/scheduled/sincronizarHistorico?mes=11&ano=2025
  // deram timeout (60s) em produção. Compras feitas SÓ nesses 2 meses (e nunca
  // antes nem depois) não entram na contagem — caso raro, mas real.
  const osRows = await db.select({ empresa: historicoOs.empresa, dataAprovacao: historicoOs.dataAprovacao }).from(historicoOs);
  const qtdComprasPorCliente = new Map<string, number>();
  const ultimaCompraOsPorCliente = new Map<string, Date>();
  for (const r of osRows as Array<{ empresa: string | null; dataAprovacao: string | null }>) {
    const empresaKey = normalizeEmpresaKey(r.empresa ?? "");
    if (!empresaKey) continue;
    qtdComprasPorCliente.set(empresaKey, (qtdComprasPorCliente.get(empresaKey) ?? 0) + 1);
    const data = parseDataFlexivel(r.dataAprovacao);
    if (data) {
      const atual = ultimaCompraOsPorCliente.get(empresaKey);
      if (!atual || data > atual) ultimaCompraOsPorCliente.set(empresaKey, data);
    }
  }

  const resultado = new Map<string, ConversaoCliente>();
  for (const [empresaKey, acc] of porCliente.entries()) {
    const ultimaOs = ultimaCompraOsPorCliente.get(empresaKey) ?? null;
    const ultimaCompra = !acc.ultimaCompra ? ultimaOs
      : !ultimaOs ? acc.ultimaCompra
      : acc.ultimaCompra > ultimaOs ? acc.ultimaCompra : ultimaOs;
    resultado.set(empresaKey, {
      totalOrcamentos: acc.total,
      orcamentosFechados: acc.fechados,
      taxaIndividual: acc.total >= MIN_AMOSTRA_TAXA_INDIVIDUAL ? (acc.fechados / acc.total) * 100 : null,
      ticketMedio: acc.qtdComValor > 0 ? acc.somaValor / acc.qtdComValor : null,
      qtdCompras: (qtdComprasPorCliente.get(empresaKey) ?? 0) + acc.fechados,
      ultimaCompra,
    });
  }
  // Clientes com OS mas sem nenhum orçamento correspondente em historico_orcamentos
  // (bases diferentes, cobertura não é 100% igual) — ainda entram no mapa só com qtdCompras.
  for (const [empresaKey, qtd] of qtdComprasPorCliente.entries()) {
    if (!resultado.has(empresaKey)) {
      resultado.set(empresaKey, { totalOrcamentos: 0, orcamentosFechados: 0, taxaIndividual: null, ticketMedio: null, qtdCompras: qtd, ultimaCompra: ultimaCompraOsPorCliente.get(empresaKey) ?? null });
    }
  }

  const taxaGeral = totalGeral > 0 ? (fechadosGeral / totalGeral) * 100 : 0;
  return { porCliente: resultado, taxaGeral };
}

/** Amostra mínima (ganhos+perdidos) para confiar na taxa de conversão de uma
 * faixa de tíquete — abaixo disso, o ajuste no score é ignorado (instável
 * demais com poucos casos decididos). */
const MIN_AMOSTRA_FAIXA_TICKET = 5;
/** Teto do ajuste de score pela faixa de tíquete, em pontos percentuais —
 * mesma ordem de grandeza do ajuste por ticket médio individual já existente
 * (-10/-20pp), para nenhum dos dois fatores dominar sozinho o resultado. */
const AJUSTE_FAIXA_TICKET_MAX_PP = 15;

/**
 * Conversão (ganhos vs. perdidos) por faixa de valor de orçamento, indexada
 * pelo rótulo da faixa (ver calcularConversaoPorFaixaTicket/faixaTicketDoValor
 * em inteligenciaClientes.ts) — usada por calcularProbabilidade para ajustar o
 * score pelo efeito da carteira inteira (tíquetes maiores convertem menos),
 * independente do histórico individual do cliente.
 */
export async function construirMapaFaixaTicket(db: any): Promise<Map<string, FaixaTicketConversao>> {
  const linhas = await db.select({
    status: historicoOrcamentos.status,
    total: historicoOrcamentos.total,
    dataCadastro: historicoOrcamentos.dataCadastro,
    validade: historicoOrcamentos.validade,
  }).from(historicoOrcamentos);
  const faixas = calcularConversaoPorFaixaTicket(
    linhas as Array<{ status: string | null; total: string | null; dataCadastro: string | null; validade: string | null }>,
    new Date(),
  );
  return new Map(faixas.map(f => [f.faixa, f]));
}

/** Janela de meses para conversão de clientes novos — pedido do usuário
 * (13/09/2026) para alinhar com a metodologia da faixa de tíquete: em vez de
 * "pular meses imaturos" (abordagem anterior), conta só orçamentos DECIDIDOS
 * (ganho ou perdido) — um orçamento ainda "em aberto" simplesmente não entra
 * na conta, então não precisa de nenhum deslocamento artificial de janela. */
const MESES_JANELA_NOVOS = 3;

/**
 * Taxa de conversão dos orçamentos de clientes novos nos últimos
 * MESES_JANELA_NOVOS meses (por dataCadastro), contando só orçamentos
 * DECIDIDOS (STATUS_GANHO ou STATUS_PERDIDO) — mesma filosofia de
 * calcularConversaoPorFaixaTicket (inteligenciaClientes.ts): um orçamento
 * "em aberto" ainda não tem resposta, então não entra nem no numerador nem
 * no denominador, em vez de contar como "não fechou".
 *
 * "Novo" aqui é decidido POR ORÇAMENTO, comparando a data do orçamento com a
 * PRIMEIRA compra já registrada daquele cliente em historico_os — não um
 * `Set` estático de "já comprou alguma vez". Isso corrige um bug real
 * encontrado em 12/09/2026: um `Set` global de "clientes que já compraram"
 * exclui justamente os clientes novos que ACABARAM de converter (assim que
 * fecham, passam a existir em historico_os e somem do grupo "novo" — inclusive
 * retroativamente, no próprio orçamento que os converteu). Com a comparação
 * por data, um orçamento conta como "de cliente novo" se, NA DATA daquele
 * orçamento, o cliente ainda não tinha nenhuma compra anterior — mesmo que
 * ele tenha convertido depois.
 *
 * Devolve `null` (não `0`) quando não há NENHUM orçamento decidido de
 * cliente novo nessa janela — distinção importante: "sem dado ainda" não é o
 * mesmo que "converteu 0%". O chamador cai para a taxa geral da carteira
 * nesse caso (ver calcularProbabilidade).
 */
export async function calcularTaxaConversaoNovosRecente(db: any): Promise<number | null> {
  const now = new Date();
  const janelas: Array<{ mes: number; ano: number }> = [];
  for (let i = 0; i < MESES_JANELA_NOVOS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    janelas.push({ mes: d.getMonth() + 1, ano: d.getFullYear() });
  }
  const janelasSet = new Set(janelas.map(j => `${j.ano}-${j.mes}`));

  // Primeira compra registrada de cada cliente (historico_os) — usada para
  // saber se, NA DATA de um orçamento específico, o cliente já tinha comprado
  // antes ou não.
  const osRows = await db.select({
    empresa: historicoOs.empresa,
    dataAprovacao: historicoOs.dataAprovacao,
  }).from(historicoOs);
  const primeiraCompraPorCliente = new Map<string, Date>();
  for (const r of osRows as Array<{ empresa: string | null; dataAprovacao: string | null }>) {
    const key = normalizeEmpresaKey(r.empresa ?? "");
    const data = parseDataFlexivel(r.dataAprovacao);
    if (!key || !data) continue;
    const atual = primeiraCompraPorCliente.get(key);
    if (!atual || data < atual) primeiraCompraPorCliente.set(key, data);
  }

  const linhas = await db.select({
    empresa: historicoOrcamentos.empresa,
    status: historicoOrcamentos.status,
    dataCadastro: historicoOrcamentos.dataCadastro,
    validade: historicoOrcamentos.validade,
    mes: historicoOrcamentos.mes,
    ano: historicoOrcamentos.ano,
  }).from(historicoOrcamentos);

  const agora = new Date();
  let ganhos = 0;
  let perdidos = 0;
  for (const r of linhas as Array<{ empresa: string | null; status: string | null; dataCadastro: string | null; validade: string | null; mes: number; ano: number }>) {
    if (!janelasSet.has(`${r.ano}-${r.mes}`)) continue;
    const empresaKey = normalizeEmpresaKey(r.empresa ?? "");
    if (!empresaKey) continue;
    const dataOrcamento = parseDataFlexivel(r.dataCadastro);
    const primeiraCompra = primeiraCompraPorCliente.get(empresaKey);
    const eraNovoNaData = !primeiraCompra || !dataOrcamento || primeiraCompra >= dataOrcamento;
    if (!eraNovoNaData) continue; // já tinha comprado antes desse orçamento = não era "novo"
    const statusKey = (r.status ?? "").trim().toLowerCase();
    if (STATUS_GANHO.has(statusKey)) ganhos++;
    else if (foiPerdido(r.status, r.dataCadastro, r.validade, agora)) perdidos++;
    // resto (em aberto recente, status ambíguo etc.): não entra na conta ainda
  }
  const total = ganhos + perdidos;
  if (total === 0) return null;
  return (ganhos / total) * 100;
}

export interface RegiaoConversao {
  regiao: string;
  ganhos: number;
  perdidos: number;
  taxaConversaoPct: number | null;
}

/**
 * Conversão (ganhos vs. perdidos) por região do Brasil — mesma filosofia de
 * calcularConversaoPorFaixaTicket (só orçamentos DECIDIDOS, sem janela de
 * tempo), mas indexada por região em vez de faixa de valor.
 *
 * `historico_orcamentos` não tem NENHUMA coluna de cidade/estado — a região
 * de cada orçamento é derivada cruzando pelo mesmo `empresaKey`
 * (normalizeEmpresaKey) com o Estado mais recente daquele cliente em
 * `historico_os` (que tem `estado`, preenchido direto do MubiSys no sync).
 * Cliente sem nenhum registro em historico_os (nunca teve OS, ou caiu no
 * buraco de sincronização de nov-dez/2025) fica de fora da contagem — mesmo
 * critério de "sem dado suficiente" usado no resto do módulo.
 */
export async function construirMapaConversaoPorRegiao(db: any): Promise<Map<string, RegiaoConversao>> {
  const osRows = await db.select({
    empresa: historicoOs.empresa,
    estado: historicoOs.estado,
    dataAprovacao: historicoOs.dataAprovacao,
  }).from(historicoOs);
  const estadoMaisRecentePorCliente = new Map<string, { estado: string; data: Date }>();
  for (const r of osRows as Array<{ empresa: string | null; estado: string | null; dataAprovacao: string | null }>) {
    const key = normalizeEmpresaKey(r.empresa ?? "");
    const uf = normalizarUf(r.estado);
    if (!key || !uf) continue;
    const data = parseDataFlexivel(r.dataAprovacao) ?? new Date(0);
    const atual = estadoMaisRecentePorCliente.get(key);
    if (!atual || data > atual.data) estadoMaisRecentePorCliente.set(key, { estado: uf, data });
  }

  const linhas = await db.select({
    empresa: historicoOrcamentos.empresa,
    status: historicoOrcamentos.status,
    dataCadastro: historicoOrcamentos.dataCadastro,
    validade: historicoOrcamentos.validade,
  }).from(historicoOrcamentos);

  const agora = new Date();
  const porRegiao = new Map<string, { ganhos: number; perdidos: number }>();
  for (const r of linhas as Array<{ empresa: string | null; status: string | null; dataCadastro: string | null; validade: string | null }>) {
    const empresaKey = normalizeEmpresaKey(r.empresa ?? "");
    const uf = estadoMaisRecentePorCliente.get(empresaKey)?.estado;
    const regiao = uf ? UF_PARA_REGIAO[uf] : undefined;
    if (!regiao) continue; // cliente sem UF conhecida — fora da contagem
    const statusKey = (r.status ?? "").trim().toLowerCase();
    const ganho = STATUS_GANHO.has(statusKey);
    const perdido = !ganho && foiPerdido(r.status, r.dataCadastro, r.validade, agora);
    if (!ganho && !perdido) continue; // "em aberto" recente e afins: não decidido ainda

    let acc = porRegiao.get(regiao);
    if (!acc) { acc = { ganhos: 0, perdidos: 0 }; porRegiao.set(regiao, acc); }
    if (ganho) acc.ganhos++; else acc.perdidos++;
  }

  const resultado = new Map<string, RegiaoConversao>();
  for (const [regiao, acc] of porRegiao.entries()) {
    const total = acc.ganhos + acc.perdidos;
    resultado.set(regiao, {
      regiao, ganhos: acc.ganhos, perdidos: acc.perdidos,
      taxaConversaoPct: total > 0 ? (acc.ganhos / total) * 100 : null,
    });
  }
  return resultado;
}

export interface ResultadoProbabilidade {
  probabilidade: number;
  explicacao: string[];
}

const PROB_MIN = 5;
const PROB_MAX = 95;
/** Amostra mínima e teto de ajuste por região — mesmos valores da faixa de
 * tíquete (MIN_AMOSTRA_FAIXA_TICKET/AJUSTE_FAIXA_TICKET_MAX_PP), para
 * nenhum dos fatores dominar sozinho o resultado. */
const MIN_AMOSTRA_REGIAO = 5;
const AJUSTE_REGIAO_MAX_PP = 15;

/**
 * Calcula a probabilidade de fechamento de UMA proposta. Função pura e
 * síncrona — toda a leitura de dados já aconteceu em
 * construirMapaConversaoClientes/calcularTaxaConversaoNovosRecente.
 */
export function calcularProbabilidade(opts: {
  clienteNovo: boolean;
  nomeCliente: string;
  valorProposta: number;
  mapa: MapaConversaoClientes;
  taxaNovosDoMes: number | null;
  /** Opcional: quando informado, soma um ajuste pela taxa de conversão da
   * faixa de tíquete da proposta (ver construirMapaFaixaTicket) — efeito da
   * carteira inteira, independente do ticket médio individual do cliente. */
  mapaFaixaTicket?: Map<string, FaixaTicketConversao>;
  /** Opcional: mapa de conversão por região (ver construirMapaConversaoPorRegiao)
   * + a região do cliente desta proposta — aplica o mesmo tipo de ajuste da
   * faixa de tíquete, mas pela região geográfica do cliente. */
  mapaRegiao?: Map<string, RegiaoConversao>;
  regiaoCliente?: string | null;
}): ResultadoProbabilidade {
  const empresaKey = normalizeEmpresaKey(opts.nomeCliente);
  const conversao = empresaKey ? opts.mapa.porCliente.get(empresaKey) : undefined;
  const explicacao: string[] = [];
  let base: number;

  if (opts.clienteNovo && opts.taxaNovosDoMes != null) {
    base = opts.taxaNovosDoMes;
    explicacao.push(`Base: ${base.toFixed(0)}% (conversão média de clientes novos, últimos ${MESES_JANELA_NOVOS} meses)`);
  } else if (opts.clienteNovo) {
    base = opts.mapa.taxaGeral;
    explicacao.push(`Base: ${base.toFixed(0)}% (conversão geral da carteira — sem orçamentos de clientes novos recentes)`);
  } else if (conversao?.taxaIndividual != null) {
    base = conversao.taxaIndividual;
    explicacao.push(`Base: ${base.toFixed(0)}% (${conversao.orcamentosFechados} de ${conversao.totalOrcamentos} orçamentos fechados deste cliente)`);
  } else {
    base = opts.mapa.taxaGeral;
    const amostra = conversao ? `${conversao.totalOrcamentos} orçamento${conversao.totalOrcamentos === 1 ? "" : "s"}` : "sem histórico suficiente";
    explicacao.push(`Base: ${base.toFixed(0)}% (conversão geral da carteira — ${amostra} deste cliente, amostra pequena demais para taxa individual)`);
  }

  let probabilidade = base;
  const ticketMedio = conversao?.ticketMedio;
  if (!opts.clienteNovo && ticketMedio && ticketMedio > 0 && opts.valorProposta > 0) {
    const ratio = opts.valorProposta / ticketMedio;
    if (ratio > 2) {
      probabilidade -= 20;
      explicacao.push(`Ajuste: -20pp (proposta ${ratio.toFixed(1)}x acima do ticket médio deste cliente)`);
    } else if (ratio > 1) {
      probabilidade -= 10;
      explicacao.push(`Ajuste: -10pp (proposta ${ratio.toFixed(1)}x acima do ticket médio deste cliente)`);
    }
  }

  // Faixa de tíquete e região são sinais da CARTEIRA INTEIRA (misturam cliente
  // novo e recorrente) — para um recorrente, isso complementa uma taxa
  // individual já sólida; para um novo, é o único sinal "parecido com
  // personalização" que existe, então aplicar o mesmo peso cheio infla a
  // confiança demais (percebido pelo usuário em 13/09/2026: novos apareciam
  // com ~25% quando a taxa base conhecida de novos é ~15%). Peso reduzido pela
  // metade para cliente novo, cheio para recorrente — não remove o sinal,
  // só reconhece que ele é menos confiável sem histórico individual do cliente.
  const pesoAjustePortfolio = opts.clienteNovo ? 0.5 : 1;

  if (opts.valorProposta > 0 && opts.mapaFaixaTicket) {
    const faixa = opts.mapaFaixaTicket.get(faixaTicketDoValor(opts.valorProposta));
    const amostraFaixa = faixa ? faixa.ganhos + faixa.perdidos : 0;
    if (faixa && faixa.taxaConversaoPct != null && amostraFaixa >= MIN_AMOSTRA_FAIXA_TICKET) {
      const delta = faixa.taxaConversaoPct - opts.mapa.taxaGeral;
      const ajusteFaixa = Math.max(-AJUSTE_FAIXA_TICKET_MAX_PP, Math.min(AJUSTE_FAIXA_TICKET_MAX_PP, delta)) * pesoAjustePortfolio;
      if (Math.abs(ajusteFaixa) >= 1) {
        probabilidade += ajusteFaixa;
        const sufixoPeso = opts.clienteNovo ? " (peso reduzido — cliente novo)" : "";
        explicacao.push(`Ajuste: ${ajusteFaixa >= 0 ? "+" : ""}${ajusteFaixa.toFixed(0)}pp (faixa "${faixa.faixa}" converte ${faixa.taxaConversaoPct.toFixed(0)}% vs. ${opts.mapa.taxaGeral.toFixed(0)}% da carteira${sufixoPeso})`);
      }
    }
  }

  if (opts.regiaoCliente && opts.mapaRegiao) {
    const regiao = opts.mapaRegiao.get(opts.regiaoCliente);
    const amostraRegiao = regiao ? regiao.ganhos + regiao.perdidos : 0;
    if (regiao && regiao.taxaConversaoPct != null && amostraRegiao >= MIN_AMOSTRA_REGIAO) {
      const delta = regiao.taxaConversaoPct - opts.mapa.taxaGeral;
      const ajusteRegiao = Math.max(-AJUSTE_REGIAO_MAX_PP, Math.min(AJUSTE_REGIAO_MAX_PP, delta)) * pesoAjustePortfolio;
      if (Math.abs(ajusteRegiao) >= 1) {
        probabilidade += ajusteRegiao;
        const sufixoPeso = opts.clienteNovo ? " (peso reduzido — cliente novo)" : "";
        explicacao.push(`Ajuste: ${ajusteRegiao >= 0 ? "+" : ""}${ajusteRegiao.toFixed(0)}pp (região ${opts.regiaoCliente} converte ${regiao.taxaConversaoPct.toFixed(0)}% vs. ${opts.mapa.taxaGeral.toFixed(0)}% da carteira${sufixoPeso})`);
      }
    }
  }

  probabilidade = Math.min(PROB_MAX, Math.max(PROB_MIN, Math.round(probabilidade)));
  return { probabilidade, explicacao };
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Modelo bayesiano (Beta-Binomial por segmento + combinação em log-odds) ──
// ═══════════════════════════════════════════════════════════════════════════
//
// Pedido do usuário (13/09/2026): validar a metodologia preditiva com
// inferência bayesiana real contra as propostas dos últimos meses antes de
// confiar no número. Validação em
// server/scripts/validar-modelo-bayesiano-probabilidade.ts, walk-forward
// (treino estritamente anterior ao teste, sem vazamento), duas janelas de
// holdout (60 e 90 dias) sobre 5.587 orçamentos decididos: este modelo supera
// a heurística `calcularProbabilidade` acima e o baseline de taxa constante em
// log-loss, Brier e AUC nas duas janelas — ver o script para os números.
//
// Diferença central para a heurística: em vez de um corte rígido de amostra
// mínima (abaixo do qual cai pra taxa geral), cada segmento (cliente
// individual, clientes novos, faixa de tíquete, região) usa uma média a
// posteriori de Beta(alpha0+ganhos, beta0+perdidos) — o prior (alpha0, beta0)
// é centrado na taxa geral da carteira com pseudo-contagem K_PRIOR_BAYES,
// então um segmento com pouquíssima amostra fica puxado pra taxa geral de
// forma suave, e um segmento com muita amostra converge pra taxa observada
// dele. Os fatores são combinados somando o log-odds de cada um relativo ao
// log-odds da taxa geral (regra de Naive Bayes — assume os fatores
// condicionalmente independentes dado o resultado, mesma simplificação usada
// em qualquer Naive Bayes).
//
// Só ganhos/perdidos DECIDIDOS entram nas contagens — mesma regra já validada
// em calcularConversaoPorFaixaTicket (inteligenciaClientes.ts): "em aberto"
// com validade vencida conta como perdido, "em aberto" ainda dentro do prazo
// fica fora (ainda não decidido). Isso corrige uma inconsistência da
// heurística acima, cujo `ConversaoCliente.totalOrcamentos` (construído em
// construirMapaConversaoClientes) conta TODO orçamento do cliente, decidido ou
// não, subestimando a taxa individual de quem tem orçamentos recentes ainda
// em aberto.
//
// Em uso só no CRM (server/routers/crm.ts) por decisão do usuário — a
// Performance Comercial continua com calcularProbabilidade (heurística)
// enquanto não houver decisão de estender.

/** Pseudo-contagem do prior Beta — quanto maior, mais um segmento com pouca
 * amostra fica puxado pra taxa geral da carteira antes de confiar na taxa
 * observada dele. Validado com K=8 nas duas janelas de teste. */
const K_PRIOR_BAYES = 8;

function logitP(p: number): number {
  const c = Math.min(0.999, Math.max(0.001, p));
  return Math.log(c / (1 - c));
}
function sigmoidP(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
function betaPosteriorMean(ganhos: number, perdidos: number, alpha0: number, beta0: number): number {
  return (alpha0 + ganhos) / (alpha0 + beta0 + ganhos + perdidos);
}

interface ContagemGanhoPerdido { ganhos: number; perdidos: number }

export interface ModeloBayesiano {
  taxaGeral: number; // 0-1, só orçamentos decididos
  porCliente: Map<string, ContagemGanhoPerdido>;
  novos: ContagemGanhoPerdido;
  porFaixa: Map<string, ContagemGanhoPerdido>;
  porRegiao: Map<string, ContagemGanhoPerdido>;
  nTreino: number;
}

/** Lê historico_orcamentos + historico_os inteiros e monta as contagens de
 * ganhos/perdidos DECIDIDOS por segmento — chamar uma vez por request (igual
 * às demais construirMapa*), reaproveitar para cada proposta da lista. */
export async function construirModeloBayesiano(db: any): Promise<ModeloBayesiano> {
  const orcRows = await db.select({
    empresa: historicoOrcamentos.empresa, status: historicoOrcamentos.status,
    total: historicoOrcamentos.total, dataCadastro: historicoOrcamentos.dataCadastro,
    validade: historicoOrcamentos.validade,
  }).from(historicoOrcamentos);
  const osRows = await db.select({
    empresa: historicoOs.empresa, dataAprovacao: historicoOs.dataAprovacao, estado: historicoOs.estado,
  }).from(historicoOs);

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
  const porCliente = new Map<string, ContagemGanhoPerdido>();
  const novos: ContagemGanhoPerdido = { ganhos: 0, perdidos: 0 };
  const porFaixa = new Map<string, ContagemGanhoPerdido>();
  const porRegiao = new Map<string, ContagemGanhoPerdido>();
  let ganhosGeral = 0, decididos = 0;

  for (const r of orcRows as Array<{ empresa: string | null; status: string | null; total: string | null; dataCadastro: string | null; validade: string | null }>) {
    const empresaKey = normalizeEmpresaKey(r.empresa ?? "");
    if (!empresaKey) continue;
    const data = parseDataFlexivel(r.dataCadastro);
    if (!data) continue;
    const statusKey = (r.status ?? "").trim().toLowerCase();
    const ganho = STATUS_GANHO.has(statusKey);
    const perdido = !ganho && foiPerdido(r.status, r.dataCadastro, r.validade, agora);
    if (!ganho && !perdido) continue;

    decididos++;
    if (ganho) ganhosGeral++;

    const cAcc = porCliente.get(empresaKey) ?? { ganhos: 0, perdidos: 0 };
    if (ganho) cAcc.ganhos++; else cAcc.perdidos++;
    porCliente.set(empresaKey, cAcc);

    const primeira = primeiraCompraPorCliente.get(empresaKey);
    if (!primeira || primeira >= data) {
      if (ganho) novos.ganhos++; else novos.perdidos++;
    }

    const valor = parseFloat(String(r.total ?? "0")) || 0;
    const faixa = faixaTicketDoValor(valor);
    const fAcc = porFaixa.get(faixa) ?? { ganhos: 0, perdidos: 0 };
    if (ganho) fAcc.ganhos++; else fAcc.perdidos++;
    porFaixa.set(faixa, fAcc);

    const uf = estadoMaisRecentePorCliente.get(empresaKey);
    const regiao = uf ? UF_PARA_REGIAO[uf.estado] : undefined;
    if (regiao) {
      const rAcc = porRegiao.get(regiao) ?? { ganhos: 0, perdidos: 0 };
      if (ganho) rAcc.ganhos++; else rAcc.perdidos++;
      porRegiao.set(regiao, rAcc);
    }
  }

  return {
    taxaGeral: decididos > 0 ? ganhosGeral / decididos : 0.2,
    porCliente, novos, porFaixa, porRegiao, nTreino: decididos,
  };
}

/** Equivalente bayesiano de calcularProbabilidade — mesma forma de retorno
 * (ResultadoProbabilidade), pra ser um substituto direto nos call sites que
 * optarem por ele (hoje só server/routers/crm.ts). */
export function calcularProbabilidadeBayesiana(opts: {
  clienteNovo: boolean;
  nomeCliente: string;
  valorProposta: number;
  modelo: ModeloBayesiano;
  regiaoCliente?: string | null;
}): ResultadoProbabilidade {
  const { modelo } = opts;
  const alpha0 = K_PRIOR_BAYES * modelo.taxaGeral;
  const beta0 = K_PRIOR_BAYES * (1 - modelo.taxaGeral);
  const logitGeral = logitP(modelo.taxaGeral);
  let logitFinal = logitGeral;
  const explicacao: string[] = [`Base: taxa geral da carteira ${(modelo.taxaGeral * 100).toFixed(0)}% (${modelo.nTreino} orçamentos decididos)`];

  const empresaKey = normalizeEmpresaKey(opts.nomeCliente);
  if (opts.clienteNovo) {
    const p = betaPosteriorMean(modelo.novos.ganhos, modelo.novos.perdidos, alpha0, beta0);
    logitFinal += logitP(p) - logitGeral;
    explicacao.push(`Cliente novo: segmento converte ${(p * 100).toFixed(0)}% (${modelo.novos.ganhos}/${modelo.novos.ganhos + modelo.novos.perdidos} decididos, ajustado bayesianamente)`);
  } else {
    const c = modelo.porCliente.get(empresaKey);
    const n = (c?.ganhos ?? 0) + (c?.perdidos ?? 0);
    const p = betaPosteriorMean(c?.ganhos ?? 0, c?.perdidos ?? 0, alpha0, beta0);
    logitFinal += logitP(p) - logitGeral;
    explicacao.push(n > 0
      ? `Histórico do cliente: ${c!.ganhos}/${n} decididos, ajustado bayesianamente para ${(p * 100).toFixed(0)}%`
      : `Sem orçamento decidido deste cliente ainda — usa a taxa geral`);
  }

  if (opts.valorProposta > 0) {
    const faixa = faixaTicketDoValor(opts.valorProposta);
    const f = modelo.porFaixa.get(faixa);
    const p = betaPosteriorMean(f?.ganhos ?? 0, f?.perdidos ?? 0, alpha0, beta0);
    logitFinal += logitP(p) - logitGeral;
    explicacao.push(`Faixa de tíquete "${faixa}": converte ${(p * 100).toFixed(0)}% (ajustado bayesianamente)`);
  }

  if (opts.regiaoCliente) {
    const r = modelo.porRegiao.get(opts.regiaoCliente);
    const p = betaPosteriorMean(r?.ganhos ?? 0, r?.perdidos ?? 0, alpha0, beta0);
    logitFinal += logitP(p) - logitGeral;
    explicacao.push(`Região ${opts.regiaoCliente}: converte ${(p * 100).toFixed(0)}% (ajustado bayesianamente)`);
  }

  const probabilidade = Math.min(PROB_MAX, Math.max(PROB_MIN, Math.round(sigmoidP(logitFinal) * 100)));
  return { probabilidade, explicacao };
}
