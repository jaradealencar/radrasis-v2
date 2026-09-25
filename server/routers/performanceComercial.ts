import { router, publicProcedure, protectedProcedure, requireRole } from "../_core/trpc";
import { z } from "zod";
import { ENV } from "../_core/env";
import { listarOSMubiSys, listarOrcamentosMubiSys, urlOrcamentoMubiSys, buscarOrcamentoPorNumero } from "../integrations/mubisys-client";
import { getDb } from "../db/db";
import { metasComerciais, historicoOs, historicoOrcamentos, clienteOverrides, faturamento, inteligenciaAcoesClientes, performanceAuditada, mubisysApiCache, clienteNovosContato, performancePropostasFollowup, performancePropostasContatado, inteligenciaClientesAcessos, inteligenciaClientesContatos, crmAtividadeLog } from "../../drizzle/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

// Endpoints de monitoramento de equipe (acessos ao painel) — só quem pode agir
// como gestor sobre a equipe comercial deve ver isso, mesmo padrão de
// isAdmin usado em client/src/pages/comercial/CRM.tsx.
const gestorProcedure = protectedProcedure.use(requireRole("admin", "master", "gestor"));
import {
  construirBaseClientes, calcularVisaoGeral, analisarCliente, calcularCandidatosAcao,
  calcularFunilOrcamentos, calcularPrevisaoComercial, calcularRecompraNovosReativados, calcularTempoOrcamentoPedido,
  calcularConversaoPorFaixaTicket,
  montarContextoAssistenteClientes, PROMPT_ASSISTENTE_CLIENTES_V1, VERSAO_PROMPT_ASSISTENTE_CLIENTES,
  DICIONARIO_METRICAS, DIAS_COOLDOWN_ACAO_RESOLVIDA, VERSAO_REGRA_ATUAL,
  type AnaliseCliente,
} from "../services/inteligenciaClientes";
import { construirMapaConversaoClientes, calcularProbabilidade } from "../services/probabilidadeCompra";
import { perguntarSobreClientes } from "../integrations/anthropic-client";

// ─── Cache em memória para evitar chamadas duplicadas à API ────────────────────
// TTL: 60 minutos para mês atual, 6 horas para meses históricos (dados não mudam).
// Vive só enquanto a instância serverless estiver quente — não é o cache que
// resolve reinicialização, ver CACHE_TTL_HISTORICO_PERSISTENTE_MS abaixo.
const apiCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_ATUAL_MS = 60 * 60 * 1000;      // 60 minutos (evita rebusca frequente na API)
const CACHE_TTL_HISTORICO_MS = 6 * 60 * 60 * 1000; // 6 horas

// TTL do cache PERSISTENTE (banco, sobrevive a restart) para mês fechado.
// Mês fechado não muda mais — 30 dias evita rebuscar da API MubiSys (lenta e
// instável, ~25-45s por mês, às vezes timeout) toda vez que expira. Medido em
// 20/08/2026: a API chegou a dar timeout em 3 tentativas seguidas de 50s cada
// pra listar um único mês, então esse cache precisa durar o quanto der.
const CACHE_TTL_HISTORICO_PERSISTENTE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

// ─── Cache persistente no banco de dados ─────────────────────────────────────
// Sobrevive a reinicializações do servidor. Evita cotações/faturamento zerados
// após restart quando a API MubiSys está lenta ou com timeout.
async function getDbCache(cacheKey: string, opts?: { ignorarExpiracao?: boolean }): Promise<{ allOs: any[]; allOrc: any[] } | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(mubisysApiCache)
      .where(eq(mubisysApiCache.cacheKey, cacheKey)).limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
    // Verificar se expirou — pulado quando ignorarExpiracao=true (usado só como
    // referência de plausibilidade, ver checagem de zero implausível no mês vigente
    // em _getMesFromApiImpl; nesse caso não queremos apagar o único backup bom).
    if (!opts?.ignorarExpiracao && new Date() > new Date(row.expiresAt)) {
      // Expirado — apagar e retornar null para forçar nova busca
      await db.delete(mubisysApiCache).where(eq(mubisysApiCache.cacheKey, cacheKey));
      return null;
    }
    const allOs = row.osData ? JSON.parse(row.osData) : [];
    const allOrc = row.orcData ? JSON.parse(row.orcData) : [];
    return { allOs, allOrc };
  } catch {
    return null;
  }
}

async function setDbCache(cacheKey: string, mes: number, ano: number, allOs: any[], allOrc: any[], ttlMsFixo?: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const now = new Date();
    const ttlMs = ttlMsFixo ?? (isMesFechado(mes, ano) ? CACHE_TTL_HISTORICO_PERSISTENTE_MS : CACHE_TTL_ATUAL_MS);
    const expiresAt = new Date(now.getTime() + ttlMs);
    // Upsert: atualizar se já existe, inserir se não
    const existing = await db.select({ id: mubisysApiCache.id }).from(mubisysApiCache)
      .where(eq(mubisysApiCache.cacheKey, cacheKey)).limit(1);
    if (existing.length > 0) {
      await db.update(mubisysApiCache)
        .set({ osData: JSON.stringify(allOs), orcData: JSON.stringify(allOrc), fetchedAt: now, expiresAt })
        .where(eq(mubisysApiCache.cacheKey, cacheKey));
    } else {
      await db.insert(mubisysApiCache).values({ cacheKey, mes, ano, osData: JSON.stringify(allOs), orcData: JSON.stringify(allOrc), fetchedAt: now, expiresAt });
    }
  } catch {
    // Falha silenciosa — cache persistente é best-effort
  }
}

async function deleteDbCache(cacheKey: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.delete(mubisysApiCache).where(eq(mubisysApiCache.cacheKey, cacheKey));
  } catch {}
}

/** Normaliza nome de empresa para chave de comparação: minúsculas, sem acentos,
 * sem pontuação. Precisa ser idêntica à normalização usada em upsertClienteOverride
 * (routers.ts), senão overrides manuais nunca casam com nomes acentuados. */
export function normalizeEmpresaKey(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/** Valor líquido de uma OS vinda AO VIVO da API MubiSys: valor_total menos valor_desconto.
 * O relatório de Vendas do MubiSys (e a coluna "Valor O.S." de lá) já reporta o valor
 * pós-desconto — usar só valor_total infla o faturamento pelo total de descontos do mês
 * (confirmado em 24/09/2026 comparando com Resultado_*.xlsx: diferença batia exatamente
 * com a linha "Descontos" da totalização). historico_os já guarda esse valor líquido na
 * coluna valorOs (ver scheduled-sync-historico.ts); esta função é o equivalente para os
 * registros crus da API, usados nos caminhos "ao vivo" deste arquivo. */
/** Nome do cliente de uma OS crua vinda AO VIVO da API MubiSys. O campo `empresa` do
 * objeto retornado pela API é a empresa EMISSORA (Radra), não o cliente — usá-lo aqui
 * conta tudo como "um único cliente" (a própria Radra) e explica clientesUnicos/
 * clientesComRecompra saindo errados em qualquer mês buscado ao vivo (confirmado
 * 24/09/2026: só setembro, que tinha vindo do fallback local por API lenta, batia).
 * O campo certo é `cliente` (string ou objeto {nome|razao_social}) — mesma extração
 * já usada em getClientesNovosMes para este mesmo formato de registro. */
export function nomeClienteDaOsApi(os: any): string {
  const clienteRaw = os?.cliente;
  return typeof clienteRaw === "object" && clienteRaw !== null
    ? String(clienteRaw?.nome ?? clienteRaw?.razao_social ?? "")
    : String(clienteRaw ?? "");
}

export function valorLiquidoOs(os: any): number {
  const total = parseFloat(String(os?.valor_total ?? "0")) || 0;
  const desconto = parseFloat(String(os?.valor_desconto ?? "0")) || 0;
  return total - desconto;
}

function isMesAtual(mes: number, ano: number): boolean {
  const now = new Date();
  return mes === now.getMonth() + 1 && ano === now.getFullYear();
}

// "Hoje" em horário de Brasília, não no fuso do processo (Vercel roda em UTC —
// ver mesma nota em calcTurno de server/routers/crm.ts). Entre 21h e 23h59
// Brasília já é o dia seguinte em UTC; sem esse ajuste, o resumo diário
// pegaria a data errada justo nesse intervalo.
function dataHojeBrasilia(): string {
  const brasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${brasilia.getUTCFullYear()}-${pad(brasilia.getUTCMonth() + 1)}-${pad(brasilia.getUTCDate())}`;
}

/** Mês estritamente anterior ao atual — só esses têm dado definitivo (não muda
 * mais) e podem levar o TTL de 30 dias do cache persistente. Meses futuros
 * (ex: consultados via getAno para o ano corrente inteiro) SEMPRE respondem
 * "0 OS, 0 orçamentos" na API antes de começarem — cachear isso por 30 dias
 * faria o dashboard continuar mostrando zero por semanas depois que o mês
 * realmente começasse e vendas reais entrassem. */
function isMesFechado(mes: number, ano: number): boolean {
  const now = new Date();
  const anoAtual = now.getFullYear();
  const mesAtualNum = now.getMonth() + 1;
  return ano < anoAtual || (ano === anoAtual && mes < mesAtualNum);
}

function getCached(key: string): any | null {
  const entry = apiCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_HISTORICO_MS) { apiCache.delete(key); return null; }
  return entry.data;
}

function setCacheWithTTL(key: string, data: any, mes: number, ano: number): void {
  apiCache.set(key, { data, ts: Date.now() });
  // Para mês atual, agendar limpeza após 5 minutos
  if (isMesAtual(mes, ano)) {
    setTimeout(() => apiCache.delete(key), CACHE_TTL_ATUAL_MS);
  }
}

function deleteCache(key: string): void {
  apiCache.delete(key);
}

// ─── Buscar dados do banco (histórico importado) ─────────────────────────────

/** Filtra OS normais do banco local: exclui retrabalhos (tipoOs começa com 'Retrabalho'),
 * amostras, cortesias, canceladas e registros sem tipoOs (NULL = importação antiga sem custo). */
export function isOsNormalDb(os: { tipoOs?: string | null; status?: string | null }): boolean {
  if (os.tipoOs === null || os.tipoOs === undefined) return false;
  const tipo = (os.tipoOs ?? "").toLowerCase();
  const status = (os.status ?? "").toLowerCase();
  if (tipo.startsWith("retrabalho")) return false;
  if (tipo === "amostra") return false;
  if (tipo === "cortesia") return false;
  if (status === "cancelada") return false;
  return true;
}

/** Mesma regra de isOsNormalDb, mas para OS vindas ao vivo da API MubiSys (campo
 * `tipo`, não `tipoOs`). Usa startsWith("retrabalho") como o banco local — o tipo
 * retornado pela API tem variações que começam com "Retrabalho" e não batem com
 * igualdade exata, o que antes deixava essas OS vazarem como venda normal só no
 * caminho ao vivo (mês corrente), inflando Vendas Realizadas e Faturamento. */
export function isOsNormalApi(os: { tipo?: string | null; status?: string | null }): boolean {
  const tipo = (os.tipo ?? "").toLowerCase();
  const status = (os.status ?? "").toLowerCase();
  if (tipo.startsWith("retrabalho")) return false;
  if (tipo === "amostra") return false;
  if (tipo === "cortesia") return false;
  if (status === "cancelada") return false;
  return true;
}

/** Clientes únicos e clientes com recompra (2+ OS) dentro do mesmo mês, a partir de
 * historico_os. Usada tanto pelo fallback local (getMesFromDb) quanto para completar o
 * snapshot congelado (performanceAuditada), que não guarda essa granularidade por cliente. */
export async function contarClientesUnicosDoMes(mes: number, ano: number): Promise<{ clientesUnicos: number; clientesComRecompra: number }> {
  const db = await getDb();
  if (!db) return { clientesUnicos: 0, clientesComRecompra: 0 };
  const osRows = await db.select({
    empresa: historicoOs.empresa,
    tipoOs: historicoOs.tipoOs,
    status: historicoOs.status,
  }).from(historicoOs).where(and(eq(historicoOs.mes, mes), eq(historicoOs.ano, ano)));
  const osPorCliente: Record<string, number> = {};
  for (const os of osRows) {
    if (!isOsNormalDb(os)) continue;
    const chave = normalizeEmpresaKey(os.empresa ?? "");
    if (!chave) continue;
    osPorCliente[chave] = (osPorCliente[chave] ?? 0) + 1;
  }
  return {
    clientesUnicos: Object.keys(osPorCliente).length,
    clientesComRecompra: Object.values(osPorCliente).filter(n => n >= 2).length,
  };
}

// ─── Lógica do Cliente Novo e Reativado ──────────────────────────────────────
// Nome de referência do projeto para esta regra de negócio — usar este termo em
// conversas/PRs/commits futuros que mexerem nela, em vez de reexplicar do zero.
// Um cliente conta como "novo" na análise de um mês se (a) nunca teve nenhuma OS
// válida antes desse mês, OU (b) a última compra válida dele foi há 6 meses ou
// mais (cliente "reativado" após período de inatividade). Toda a base de "quem
// comprou antes" vem de historico_os (histórico real importado do MubiSys),
// nunca da API ao vivo — ver buscarTodasComprasValidas/ultimaCompraAntesDe abaixo.
export const MESES_INATIVIDADE_PARA_NOVO = 6;

export type CompraMinima = { empresa: string; mes: number; ano: number };

/** Busca TODAS as OS válidas (histórico completo, qualquer ano) já reduzidas a
 * {empresa, mes, ano} — base para calcular a última compra de cada cliente antes
 * de qualquer mês de referência. Uma única query cobre todos os meses avaliados
 * pelo chamador (o filtro "antes de X" é aplicado depois, em memória). */
export async function buscarTodasComprasValidas(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<CompraMinima[]> {
  const rows = await db.select({
    empresa: historicoOs.empresa,
    mes: historicoOs.mes,
    ano: historicoOs.ano,
    tipoOs: historicoOs.tipoOs,
    status: historicoOs.status,
  }).from(historicoOs);
  const compras: CompraMinima[] = [];
  for (const r of rows) {
    if (!isOsNormalDb(r)) continue;
    const empresa = (r.empresa ?? "").toLowerCase().trim();
    if (!empresa) continue;
    compras.push({ empresa, mes: r.mes, ano: r.ano });
  }
  return compras;
}

/** Para cada cliente, encontra o mês/ano da compra válida mais recente estritamente
 * anterior a (mes, ano). Usa a lista completa pré-carregada por buscarTodasComprasValidas
 * — pode ser chamada repetidamente (uma por mês avaliado) sem custo de banco. */
export function ultimaCompraAntesDe(compras: CompraMinima[], mes: number, ano: number): Map<string, { mes: number; ano: number }> {
  const map = new Map<string, { mes: number; ano: number }>();
  for (const c of compras) {
    if (c.ano > ano || (c.ano === ano && c.mes >= mes)) continue; // não é "antes" do mês de referência
    const atual = map.get(c.empresa);
    if (!atual || c.ano > atual.ano || (c.ano === atual.ano && c.mes > atual.mes)) {
      map.set(c.empresa, { mes: c.mes, ano: c.ano });
    }
  }
  return map;
}

/** Aplica a regra de "cliente novo": sem compra anterior, ou última compra há
 * `mesesInatividade` meses ou mais (contagem de meses de calendário). O 4º
 * parâmetro é opcional e default MESES_INATIVIDADE_PARA_NOVO (6) — todo
 * call-site existente (Performance Comercial, Inteligência de Clientes,
 * snapshots de performance_auditada) continua passando só 3 argumentos e tem
 * comportamento idêntico. Só o relatório de Marketing/Crescimento e Resultado
 * passa um valor vindo de marketing_config, para não afetar as demais telas
 * já validadas — ver server/services/marketingFinanceiroClientes.ts. */
export function isClienteNovoPorRecencia(
  ultima: { mes: number; ano: number } | undefined,
  mes: number,
  ano: number,
  mesesInatividade: number = MESES_INATIVIDADE_PARA_NOVO,
): boolean {
  if (!ultima) return true;
  const gapMeses = (ano - ultima.ano) * 12 + (mes - ultima.mes);
  return gapMeses >= mesesInatividade;
}

/** Reindexação de um mapa "última compra por empresa" (chaves em toLowerCase().trim(),
 * vindas de historico_os) para chaves normalizadas com normalizeEmpresaKey (sem acentos/
 * pontuação). Necessário sempre que o lado que vai consultar o mapa usa nome de cliente
 * vindo da API MubiSys ao vivo (getClientesNovosMes), pois a grafia entre a API e a
 * importação local diverge em acentuação/pontuação e o match por toLowerCase().trim()
 * puro falha silenciosamente — isClienteNovoPorRecencia(undefined, ...) sempre retorna
 * true, fazendo o cliente contar como "novo" mesmo já tendo comprado antes. Quando
 * ambos os lados da comparação vêm do banco local (ex.: getMultiMes, insightsComerciais),
 * essa reindexação não é necessária pois a grafia já é idêntica dos dois lados. */
export function reindexarPorChaveNormalizada(mapa: Map<string, { mes: number; ano: number }>): Map<string, { mes: number; ano: number }> {
  const normalizado = new Map<string, { mes: number; ano: number }>();
  for (const [chave, ultima] of mapa) {
    const chaveNorm = normalizeEmpresaKey(chave);
    const existente = normalizado.get(chaveNorm);
    if (!existente || ultima.ano > existente.ano || (ultima.ano === existente.ano && ultima.mes > existente.mes)) {
      normalizado.set(chaveNorm, ultima);
    }
  }
  return normalizado;
}

/** Classifica um cliente pela "Lógica do Cliente Novo e Reativado" para o relatório de
 * propostas de alto valor: "novo" = nenhuma compra registrada antes do mês; "reativado" =
 * já comprou, mas a última compra foi há 6+ meses. Segue exatamente as regras de
 * getClientesNovosMes (incluindo os overrides manuais "recorrente"/"novo"), para o mesmo
 * cliente aparecer com a mesma etiqueta nos dois relatórios. `mesesSemComprar` é contado
 * até o mês de referência, não até hoje. */
export function classificarClientePorRecencia(
  ultima: { mes: number; ano: number } | undefined,
  override: "recorrente" | "novo" | undefined,
  mes: number,
  ano: number,
): { status: "novo" | "reativado" | null; mesesSemComprar: number | null } {
  if (override === "recorrente") return { status: null, mesesSemComprar: null };
  const ehNovoOuReativado = override === "novo" ? true : isClienteNovoPorRecencia(ultima, mes, ano);
  if (!ehNovoOuReativado) return { status: null, mesesSemComprar: null };
  if (!ultima) return { status: "novo", mesesSemComprar: null };
  return { status: "reativado", mesesSemComprar: (ano - ultima.ano) * 12 + (mes - ultima.mes) };
}

async function getMesFromDb(mes: number, ano: number) {
  const db = await getDb();
  if (!db) return null;

  // OS Normais do mês (excluindo Retrabalho e Canceladas)
  const osRows = await db.select().from(historicoOs)
    .where(and(eq(historicoOs.mes, mes), eq(historicoOs.ano, ano)));

  // Orçamentos do mês
  const orcRows = await db.select().from(historicoOrcamentos)
    .where(and(eq(historicoOrcamentos.mes, mes), eq(historicoOrcamentos.ano, ano)));

  // Filtrar apenas OS Normais:
  // - Usar somente registros com tipoOs = "" (string vazia) — são os do XLS completo com custos
  // - Registros com tipoOs = NULL são importações antigas sem custo (duplicatas a ignorar)
  // - Excluir retrabalhos (tipoOs começa com "Retrabalho"), Amostra, Cortesia e Canceladas
  const osNormais = osRows.filter(os => {
    // IMPORTANTE: verificar tipoOs ANTES do ?? para detectar NULL real do banco
    if (os.tipoOs === null || os.tipoOs === undefined) return false; // ignorar duplicatas sem custo
    const tipo = os.tipoOs; // agora sabemos que não é null
    const status = (os.status ?? "").toLowerCase();
    if (tipo.toLowerCase().startsWith("retrabalho")) return false;
    if (tipo.toLowerCase() === "amostra") return false;
    if (tipo.toLowerCase() === "cortesia") return false;
    if (status === "cancelada") return false;
    return true;
  });

  // Agrupar OS por vendedor
  const osPorVendedor: Record<string, { total: number; valor: number; custo: number; resultado: number }> = {};
  let totalValorOs = 0;
  let totalCustoOs = 0;
  let totalResultadoOs = 0;
  const osPorClienteDb: Record<string, number> = {};

  for (const os of osNormais) {
    const vendedor = os.vendedor || "Sem Vendedor";
    const valor = parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
    const custo = parseFloat(String(os.custosTotal ?? "0")) || 0;
    const resultado = parseFloat(String(os.resultadoReais ?? "0")) || 0;
    totalValorOs += valor;
    totalCustoOs += custo;
    totalResultadoOs += resultado;
    if (!osPorVendedor[vendedor]) osPorVendedor[vendedor] = { total: 0, valor: 0, custo: 0, resultado: 0 };
    osPorVendedor[vendedor].total++;
    osPorVendedor[vendedor].valor += valor;
    osPorVendedor[vendedor].custo += custo;
    osPorVendedor[vendedor].resultado += resultado;
    const clienteKeyDb = normalizeEmpresaKey(os.empresa ?? "");
    if (clienteKeyDb) osPorClienteDb[clienteKeyDb] = (osPorClienteDb[clienteKeyDb] ?? 0) + 1;
  }
  const clientesUnicos = Object.keys(osPorClienteDb).length;
  const clientesComRecompra = Object.values(osPorClienteDb).filter(n => n >= 2).length;

  // Agrupar Orçamentos por vendedor
  const orcPorVendedor: Record<string, { total: number; valor: number }> = {};
  let totalValorOrc = 0;

  for (const orc of orcRows) {
    const vendedor = orc.vendedor || "Sem Vendedor";
    const valor = parseFloat(String(orc.total ?? "0")) || 0;
    totalValorOrc += valor;
    if (!orcPorVendedor[vendedor]) orcPorVendedor[vendedor] = { total: 0, valor: 0 };
    orcPorVendedor[vendedor].total++;
    orcPorVendedor[vendedor].valor += valor;
  }

  return {
    osNormais: {
      total: osNormais.length,
      valorTotal: totalValorOs,
      custo: totalCustoOs,
      resultado: totalResultadoOs,
      porVendedor: osPorVendedor,
      clientesUnicos,
      clientesComRecompra,
    },
    orcamentos: {
      total: orcRows.length,
      valorTotal: totalValorOrc,
      porVendedor: orcPorVendedor,
    },
  };
}

// ─── Buscar dados da API ERP (mês atual em tempo real) ───────────────────────

// Corrida contra timeout: procedures que rodam no mesmo lote HTTP batched de
// getMes (httpBatchLink) precisam desistir da API MubiSys antes do
// maxDuration:60s do vercel.json — senão prendem a requisição batched inteira
// até a função ser morta pela Vercel, o que aparece como loop infinito de
// retry no front (mês vigente, sem cache quente para escapar do caminho lento).
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

// Mapa de promessas em andamento para deduplicar chamadas simultâneas
const pendingApiCalls = new Map<string, Promise<any>>();

async function getMesFromApi(mes: number, ano: number) {
  const cacheKey = `mes_${mes}_${ano}`;
  
  // Verificar cache primeiro
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  // Deduplicar chamadas simultâneas para o mesmo mês
  const existing = pendingApiCalls.get(cacheKey);
  if (existing) return existing;
  
  const promise = _getMesFromApiImpl(mes, ano).then(result => {
    setCacheWithTTL(cacheKey, result, mes, ano);
    pendingApiCalls.delete(cacheKey);
    return result;
  }).catch(err => {
    pendingApiCalls.delete(cacheKey);
    throw err;
  });
  
  pendingApiCalls.set(cacheKey, promise);
  return promise;
}

async function _getMesFromApiImpl(mes: number, ano: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(ano, mes, 0).getDate();
  const datainicial = `${ano}-${pad(mes)}-01`;
  const datafinal = `${ano}-${pad(mes)}-${pad(lastDay)}`;

  // Verificar cache de dados brutos (memória primeiro, depois banco persistente)
  // O cache persistente sobrevive a reinicializações do servidor — evita cotações/faturamento zerados
  const rawCacheKey = `raw_${mes}_${ano}`;
  const osCacheKey = `os_raw_${mes}_${ano}`;
  const orcCacheKey = `orc_raw_${mes}_${ano}`;
  const cachedOs = getCached(osCacheKey);
  const cachedOrc = getCached(orcCacheKey);
  
  let allOs: any[];
  let allOrc: any[];
  
  if (cachedOs && cachedOrc) {
    // Cache em memória disponível
    allOs = cachedOs;
    allOrc = cachedOrc;
  } else {
    // Tentar cache persistente no banco antes de chamar a API
    const dbCached = await getDbCache(rawCacheKey);
    if (dbCached) {
      allOs = dbCached.allOs;
      allOrc = dbCached.allOrc;
      // Restaurar também no cache em memória
      setCacheWithTTL(osCacheKey, allOs, mes, ano);
      setCacheWithTTL(orcCacheKey, allOrc, mes, ano);
    } else {
      // Buscar da API MubiSys SEQUENCIALMENTE (primeiro OS, depois orçamentos).
      // Testado empiricamente em 17/08/2026: rodar as duas em paralelo (Promise.all)
      // não trouxe ganho consistente — a API do MubiSys é instável por natureza (o
      // mesmo endpoint de OS sozinho variou de ~5s a timeout de 45s+ entre chamadas)
      // e paralelizar arrisca a chamada de OS (normalmente rápida) competir por
      // recursos com a de orçamentos (mais lenta) e estourar o timeout também.
      // Busca sequencial evita sobrecarga na API e reduz chance de timeout.
      // OS: filtrodata=APROVACAO (data de aprovação = faturamento real, igual ao relatório de Vendas do MubiSys)
      const osResult = await listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial, datafinal });
      // Orçamentos: filtrodata=CADASTRO (data de criação = quando a cotação foi enviada)
      const orcResult = await listarOrcamentosMubiSys({ status: "TODOS", datainicial, datafinal });
      allOs = osResult.itens;
      allOrc = orcResult.itens;

      // ─── SANITY CHECK: zero implausível no MÊS VIGENTE ───────────────────
      // MubiSys às vezes responde 200 com lista vazia de forma transitória
      // (falha intermitente do lado deles, não timeout — ver TIMEOUT_LISTA_MS
      // e comentário em getMes). Para meses fechados já existe proteção
      // comparando com historico_os (banco local importado) — mas o mês
      // vigente não é importado ao vivo, então o banco local também estaria
      // zerado e não serve de referência. Em vez disso, comparamos com o
      // último resultado NÃO-VAZIO já cacheado para este mês (mesmo expirado):
      // dado aprovado/orçado não desaparece, então um zero repentino depois de
      // já ter havido dado é implausível — preferimos servir o cache anterior
      // (levemente desatualizado) a mostrar R$ 0 por um glitch passageiro.
      // Validado em 03/09/2026: getMes com forceRefresh voltou 0/0 duas vezes
      // seguidas para Set/2026 enquanto uma consulta direta à mesma janela
      // devolvia 24 OS / 97 orçamentos; chamadas subsequentes já vieram certas.
      let usouCacheAnteriorPorZeroImplausivel = false;
      if (isMesAtual(mes, ano) && allOs.length === 0 && allOrc.length === 0) {
        const anterior = await getDbCache(rawCacheKey, { ignorarExpiracao: true });
        if (anterior && (anterior.allOs.length > 0 || anterior.allOrc.length > 0)) {
          console.warn(`[MubiSys] Resposta zerada implausível para mês vigente ${mes}/${ano} — usando último cache não-vazio (${anterior.allOs.length} OS, ${anterior.allOrc.length} orçamentos) em vez do zero.`);
          allOs = anterior.allOs;
          allOrc = anterior.allOrc;
          usouCacheAnteriorPorZeroImplausivel = true;
        }
      }

      // Salvar em memória sempre (mesmo parcial — melhor que zero para o usuário atual)
      setCacheWithTTL(osCacheKey, allOs, mes, ano);
      setCacheWithTTL(orcCacheKey, allOrc, mes, ano);
      // Cache persistente: SOMENTE salvar se AMBAS as buscas foram completas.
      // Dados parciais no cache persistente causam cotações/faturamento errados
      // após restart. Também não sobrescrever com o zero implausível substituído
      // acima — isso apagaria o próprio backup que acabamos de usar.
      if (osResult.completo && orcResult.completo && !usouCacheAnteriorPorZeroImplausivel) {
        setDbCache(rawCacheKey, mes, ano, allOs, allOrc).catch(() => {});
        console.log(`[MubiSys] Cache persistente salvo para ${mes}/${ano}: ${allOs.length} OS, ${allOrc.length} orçamentos`);
      } else if (!usouCacheAnteriorPorZeroImplausivel) {
        console.warn(`[MubiSys] Busca incompleta para ${mes}/${ano} — cache persistente NÃO salvo (OS: ${osResult.completo}, Orc: ${orcResult.completo})`);
      }
    }
  }

  // Filtrar OS Normais (mesma regra de isOsNormalDb, aplicada ao campo `tipo` da API)
  const osNormais = allOs.filter(isOsNormalApi);

  const osPorVendedor: Record<string, { total: number; valor: number; custo: number; resultado: number }> = {};
  let totalValorOs = 0;
  let totalCustoOs = 0;
  let totalResultadoOs = 0;
  const osPorClienteApi: Record<string, number> = {};

  for (const os of osNormais) {
    const vendedor = os.vendedor || "Sem Vendedor";
    const valor = valorLiquidoOs(os);
    const custo = parseFloat(String(os.valor_custo ?? "0")) || 0;
    const resultado = parseFloat(String(os.valor_margem ?? "0")) || 0;
    totalValorOs += valor;
    totalCustoOs += custo;
    totalResultadoOs += resultado;
    if (!osPorVendedor[vendedor]) osPorVendedor[vendedor] = { total: 0, valor: 0, custo: 0, resultado: 0 };
    osPorVendedor[vendedor].total++;
    osPorVendedor[vendedor].valor += valor;
    osPorVendedor[vendedor].custo += custo;
    osPorVendedor[vendedor].resultado += resultado;
    const clienteKeyApi = normalizeEmpresaKey(nomeClienteDaOsApi(os));
    if (clienteKeyApi) osPorClienteApi[clienteKeyApi] = (osPorClienteApi[clienteKeyApi] ?? 0) + 1;
  }
  const clientesUnicos = Object.keys(osPorClienteApi).length;
  const clientesComRecompra = Object.values(osPorClienteApi).filter(n => n >= 2).length;

  // Cotações: excluir orçamentos com status Cancelada ou Excluída.
  // REGRA DE NEGÓCIO: cotações canceladas/excluídas NÃO entram no cálculo de taxa de conversão,
  // pois distorcem o denominador e fazem a taxa parecer menor do que realmente é.
  // Isso é consistente com o relatório de cotações do MubiSys.
  // IMPORTANTE: NÃO filtrar por versao === versao_atual pois isso descarta orçamentos
  // que a API retorna sem os campos versao/versao_atual preenchidos (null/undefined).
  const STATUS_EXCLUIDOS_ORC = ["cancelada", "cancelado", "excluída", "excluído", "excluida", "excluido"];
  const orcVersaoAtual = allOrc.filter(orc =>
    !STATUS_EXCLUIDOS_ORC.includes((orc.status ?? "").toLowerCase())
  );

  const orcPorVendedor: Record<string, { total: number; valor: number }> = {};
  let totalValorOrc = 0;

  for (const orc of orcVersaoAtual) {
    const vendedor = orc.vendedor || "Sem Vendedor";
    // valor_total vem zerado para orcamentos "Em aberto" na API MubiSys
    // Usar valor_custo + valor_margem como fallback para calcular o valor real do orcamento
    const vt = parseFloat(String(orc.valor_total ?? "0")) || 0;
    const vc = parseFloat(String(orc.valor_custo ?? "0")) || 0;
    const vm = parseFloat(String(orc.valor_margem ?? "0")) || 0;
    const valor = vt > 0 ? vt : (vc + vm);
    totalValorOrc += valor;
    if (!orcPorVendedor[vendedor]) orcPorVendedor[vendedor] = { total: 0, valor: 0 };
    orcPorVendedor[vendedor].total++;
    orcPorVendedor[vendedor].valor += valor;
  }

  return {
    osNormais: { total: osNormais.length, valorTotal: totalValorOs, custo: totalCustoOs, resultado: totalResultadoOs, porVendedor: osPorVendedor, clientesUnicos, clientesComRecompra },
    orcamentos: { total: orcVersaoAtual.length, valorTotal: totalValorOrc, porVendedor: orcPorVendedor },
  };
}

// ─── Calcular métricas consolidadas ──────────────────────────────────────────

function calcMetrics(osNormais: any, orcamentos: any, mes: number, ano: number) {
  const MESES_NOMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  const taxaConversao = orcamentos.total > 0
    ? parseFloat(((osNormais.total / orcamentos.total) * 100).toFixed(1))
    : 0;

  const taxaFaturamento = orcamentos.valorTotal > 0
    ? parseFloat(((osNormais.valorTotal / orcamentos.valorTotal) * 100).toFixed(1))
    : 0;

  const ticketMedio = osNormais.total > 0
    ? parseFloat((osNormais.valorTotal / osNormais.total).toFixed(2))
    : 0;

  const margemPct = osNormais.valorTotal > 0
    ? parseFloat(((osNormais.resultado / osNormais.valorTotal) * 100).toFixed(1))
    : 0;

  // Por vendedor
  const todosVendedores = new Set([
    ...Object.keys(osNormais.porVendedor),
    ...Object.keys(orcamentos.porVendedor),
  ]);

  const porVendedor = Array.from(todosVendedores).map(vendedor => {
    const os = osNormais.porVendedor[vendedor] ?? { total: 0, valor: 0, custo: 0, resultado: 0 };
    const orc = orcamentos.porVendedor[vendedor] ?? { total: 0, valor: 0 };
    const conv = orc.total > 0 ? parseFloat(((os.total / orc.total) * 100).toFixed(1)) : 0;
    const taxaFat = orc.valor > 0 ? parseFloat(((os.valor / orc.valor) * 100).toFixed(1)) : 0;
    const ticket = os.total > 0 ? parseFloat((os.valor / os.total).toFixed(2)) : 0;
    const margem = os.valor > 0 ? parseFloat(((os.resultado / os.valor) * 100).toFixed(1)) : 0;
    return {
      vendedor,
      cotacoes: orc.total,
      valorOrcado: parseFloat(orc.valor.toFixed(2)),
      osGeradas: os.total,
      faturamento: parseFloat(os.valor.toFixed(2)),
      custo: parseFloat(os.custo.toFixed(2)),
      resultado: parseFloat(os.resultado.toFixed(2)),
      taxaConversao: conv,
      taxaFaturamento: taxaFat,
      ticketMedio: ticket,
      margemPct: margem,
    };
  }).sort((a, b) => b.cotacoes - a.cotacoes);

  return {
    label: `${MESES_NOMES[mes - 1]}/${String(ano).slice(2)}`,
    mes,
    ano,
    cotacoes: orcamentos.total,
    osGeradas: osNormais.total,
    valorOrcado: parseFloat(orcamentos.valorTotal.toFixed(2)),
    faturamento: parseFloat(osNormais.valorTotal.toFixed(2)),
    custo: parseFloat(osNormais.custo.toFixed(2)),
    resultado: parseFloat(osNormais.resultado.toFixed(2)),
    taxaConversao,
    taxaFaturamento,
    ticketMedio,
    margemPct,
    clientesUnicos: osNormais.clientesUnicos ?? 0,
    clientesComRecompra: osNormais.clientesComRecompra ?? 0,
    porVendedor,
  };
}

// ─── Clientes novos: clientes que aparecem pela primeira vez no mês ────────────

type VendedorNovosStats = {
  clientesNovos: number;
  osNovos: number;
  faturamentoNovos: number;
  cotacoesNovos: number;
  valorOrcadoNovos: number;
  taxaConvNovos: number;
  taxaFatNovos: number;
};

/** Estatísticas de "clientes novos/reativados" de um mês, calculadas 100% a
 * partir do histórico local (historico_os) — nunca chama a API MubiSys ao
 * vivo. Usada por getClientesNovosAno para meses não congelados: somar até
 * 12 chamadas de API (uma por mês, ~20-45s cada, ver getClientesNovosMes)
 * estourava o maxDuration de 60s da Vercel e o painel de Marketing carregava
 * zerado, sem erro visível (investigação de 01/09/2026). historico_os já é
 * fonte de verdade para "quem comprou antes" (ver isClienteNovoPorRecencia);
 * aqui também vira fonte para "quem comprou neste mês". Ainda assim, aplica
 * reindexarPorChaveNormalizada: mesmo os dois lados vindo da mesma tabela, a
 * grafia da mesma empresa pode divergir entre lotes de importação (acentos,
 * pontuação) — sem normalizar, "clientesNovosUnicos" pode divergir do mesmo
 * cálculo feito em construirBaseClientes (Inteligência de Clientes), que já
 * normaliza por padrão. */
export function calcularNovosDoMesLocal(
  mes: number,
  ano: number,
  osDoAno: Array<{ empresa: string | null; tipoOs: string | null; status: string | null; mes: number; valorOs: string | null; valorTotal: string | null }>,
  todasComprasValidas: CompraMinima[],
  overrideMap: Map<string, "recorrente" | "novo">,
): { mes: number; ticketMedioNovos: number; osNovos: number; faturamentoNovos: number; faturamentoReativados: number; faturamentoNovosPuros: number; clientesNovosUnicos: number; clientesReativados: number; clientesNovosPuros: number } {
  // Reindexado com normalizeEmpresaKey (mesma chave usada pela Inteligência de
  // Clientes em construirBaseClientes) para que a mesma empresa gravada com
  // grafias diferentes em historico_os ao longo do tempo (acentuação/pontuação
  // divergente entre lotes de importação) conte como um único cliente — sem
  // isso, "clientesNovosUnicos" deste painel pode ficar inflado em relação ao
  // equivalente na Inteligência de Clientes.
  const ultimaCompraPorCliente = reindexarPorChaveNormalizada(ultimaCompraAntesDe(todasComprasValidas, mes, ano));
  const osMes = osDoAno.filter(os => os.mes === mes);

  let osNovos = 0;
  let faturamentoNovos = 0;
  let faturamentoReativados = 0;
  let clientesReativados = 0;
  const clientesVistos = new Set<string>();

  for (const os of osMes) {
    if (!isOsNormalDb(os)) continue;
    const clienteKey = normalizeEmpresaKey(os.empresa ?? "");
    if (!clienteKey) continue;

    const overrideStatus = overrideMap.get(clienteKey);
    const isNovo = overrideStatus === "recorrente" ? false
      : overrideStatus === "novo" ? true
      : isClienteNovoPorRecencia(ultimaCompraPorCliente.get(clienteKey), mes, ano);
    if (!isNovo) continue;

    const valor = parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
    const jaComprouAntes = Boolean(ultimaCompraPorCliente.get(clienteKey));
    osNovos++;
    faturamentoNovos += valor;
    // faturamentoReativados é SUBCONJUNTO de faturamentoNovos, não uma parcela
    // somada: conta as OS dos clientes que já tinham comprado antes e voltaram
    // após 6+ meses. O faturamento de "novo puro" é a diferença entre os dois.
    if (jaComprouAntes) faturamentoReativados += valor;

    if (!clientesVistos.has(clienteKey)) {
      clientesVistos.add(clienteKey);
      if (jaComprouAntes) clientesReativados++;
    }
  }

  return {
    mes,
    ticketMedioNovos: osNovos > 0 ? parseFloat((faturamentoNovos / osNovos).toFixed(2)) : 0,
    osNovos,
    faturamentoNovos: parseFloat(faturamentoNovos.toFixed(2)),
    faturamentoReativados: parseFloat(faturamentoReativados.toFixed(2)),
    // Faturamento de clientes genuinamente novos, SEM os reativados — ver nota em getClientesNovosMes.
    faturamentoNovosPuros: parseFloat((faturamentoNovos - faturamentoReativados).toFixed(2)),
    clientesNovosUnicos: clientesVistos.size,
    clientesReativados,
    // Clientes genuinamente novos (nunca compraram antes), SEM os reativados — perfis
    // diferentes de cliente, não devem ser somados na mesma métrica (ver MarketingFinanceiro.tsx).
    clientesNovosPuros: clientesVistos.size - clientesReativados,
  };
}

// ─── Contatos (telefone/WhatsApp, cidade) dos clientes novos ─────────────────

const JANELA_DIAS_BUSCA_OS = 7;

/** Busca as OS do mês em janelas curtas e paralelas. A busca agregada do mês inteiro
 * (getMesFromApi: OS + orçamentos) estoura o timeout com frequência — o mês vigente nunca
 * fica com cache quente por mais de 1h — e aí o fallback do banco local não tem telefone.
 * Só as OS, em janelas de 7 dias, voltam completas em ~3s (medido em 19/09/2026: set/2026 =
 * 119 OS e ago/2026 = 168 OS, idêntico ao cache, quase todas com cliente_contato.celular).
 * Lança erro se qualquer janela vier incompleta: um mês parcial faria clientes antigos
 * parecerem "novos". */
async function buscarOsDoMesEmJanelas(mes: number, ano: number): Promise<any[]> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const janelas: Array<[string, string]> = [];
  for (let dia = 1; dia <= ultimoDia; dia += JANELA_DIAS_BUSCA_OS) {
    const fim = Math.min(dia + JANELA_DIAS_BUSCA_OS - 1, ultimoDia);
    janelas.push([`${ano}-${pad(mes)}-${pad(dia)}`, `${ano}-${pad(mes)}-${pad(fim)}`]);
  }
  const resultados = await Promise.all(janelas.map(([datainicial, datafinal]) =>
    listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial, datafinal })
  ));
  if (resultados.some(r => !r.completo)) throw new Error("os_janelas_incompletas");
  const porId = new Map<string, any>();
  for (const os of resultados.flatMap(r => r.itens)) porId.set(String(os.id), os);
  return Array.from(porId.values());
}

type ContatoCliente = { telefone: string; contato: string; cidade: string; estado: string };

/** Extrai telefone, nome do contato, cidade e UF da OS (campos cliente_contato e
 * cliente_endereco, que já vêm com os dados do CLIENTE — nunca buscar por nome, isso
 * retornava dados da Radra, a empresa emissora). Prefere o primeiro contato ATIVO que
 * tenha celular/telefone: o primeiro da lista nem sempre é quem tem número cadastrado. */
export function extrairContatoDaOs(os: any): ContatoCliente {
  const contatos: any[] = Array.isArray(os?.cliente_contato) ? os.cliente_contato : (os?.cliente_contato ? [os.cliente_contato] : []);
  const enderecos: any[] = Array.isArray(os?.cliente_endereco) ? os.cliente_endereco : (os?.cliente_endereco ? [os.cliente_endereco] : []);
  const numeroDe = (c: any): string => c?.celular || c?.telefone || c?.fone || "";
  const ativo = (c: any) => String(c?.status ?? "").toLowerCase() !== "inativo";
  const escolhido = contatos.find(c => numeroDe(c) && ativo(c)) ?? contatos.find(c => numeroDe(c)) ?? contatos[0];
  const endereco = enderecos[0];
  return {
    telefone: numeroDe(escolhido),
    contato: escolhido?.nome_contato || escolhido?.nome || "",
    cidade: endereco?.cidade || "",
    estado: endereco?.estado || endereco?.uf || "",
  };
}

/** Link wa.me a partir do telefone do ERP. Sem DDI o número tem 10–11 dígitos (DDD + número);
 * com DDI 55 tem 12–13 — só o comprimento distingue o DDI do DDD 55 (RS), que começa igual. */
export function formatarLinkWhatsApp(tel: string): string {
  const digitos = (tel ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digitos) return "";
  const numero = digitos.length >= 12 && digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${numero}`;
}

/** Contatos por cliente (chave normalizeEmpresaKey), prefere a OS que tenha telefone. */
export function indexarContatosPorCliente(osLista: any[]): Record<string, ContatoCliente> {
  const indice: Record<string, ContatoCliente> = {};
  for (const os of osLista) {
    const clienteRaw = os?.cliente;
    const nome = typeof clienteRaw === "object" && clienteRaw !== null
      ? String(clienteRaw?.nome ?? clienteRaw?.razao_social ?? "")
      : String(clienteRaw ?? "");
    const chave = normalizeEmpresaKey(nome);
    if (!chave) continue;
    const novo = extrairContatoDaOs(os);
    const atual = indice[chave];
    if (!atual) {
      indice[chave] = novo;
      continue;
    }
    // Troca pelo telefone desta OS (com o nome do contato dono dele) só se ainda não havia
    // nenhum; cidade/UF de uma OS anterior nunca se perdem.
    if (!atual.telefone && novo.telefone) {
      atual.telefone = novo.telefone;
      atual.contato = novo.contato || atual.contato;
    }
    atual.contato ||= novo.contato;
    atual.cidade ||= novo.cidade;
    atual.estado ||= novo.estado;
  }
  return indice;
}

/** Contatos dos clientes do mês, para completar listas salvas sem telefone (meses congelados
 * cuja lista foi gravada quando a API estava fora). Cache em memória e no banco (mês fechado
 * 30 dias, mês vigente 1h) — a busca é uma vez por mês, não por consulta. Null se a API falhar. */
async function obterContatosDoMes(mes: number, ano: number): Promise<Record<string, ContatoCliente> | null> {
  const chaveCache = `contatos_${mes}_${ano}`;
  const emMemoria = getCached(chaveCache);
  if (emMemoria) return emMemoria;
  const noBanco = await getDbCache(chaveCache);
  if (noBanco?.allOs?.[0]) {
    setCacheWithTTL(chaveCache, noBanco.allOs[0], mes, ano);
    return noBanco.allOs[0];
  }
  try {
    const osLista = await withTimeout(buscarOsDoMesEmJanelas(mes, ano), 15000, "timeout_contatos_mes");
    const indice = indexarContatosPorCliente(osLista);
    setCacheWithTTL(chaveCache, indice, mes, ano);
    // O cache do banco guarda o índice como único elemento de allOs (formato compartilhado com o raw_*)
    await setDbCache(chaveCache, mes, ano, [indice], []);
    return indice;
  } catch {
    return null;
  }
}

// ─── Contatos (telefone + id do MubiSys) dos orçamentos das propostas ─────────

export type ContatoOrcamento = { telefone: string; contato: string; mubisysId: number | null };

const CONCURRENCIA_BUSCA_ORCAMENTO = 8;
// Com 8 chamadas paralelas a API rende ~2 orçamentos/s (cada uma sobe de ~1s para ~4s). Passado
// o limite, o que faltou fica para a próxima abertura — por isso o chamador manda os mais
// valiosos primeiro. Cabe folga no maxDuration:60s da Vercel.
const LIMITE_BUSCA_ORCAMENTOS_MS = 25000;
const TTL_CONTATOS_ORCAMENTO_MS = 365 * 24 * 60 * 60 * 1000; // telefone e id do orçamento não mudam

/** Telefone/contato e id interno (link do MubiSys) dos orçamentos pedidos, SEM depender do
 * cache agregado do mês (raw_*), que expira em 1h no mês vigente e some com frequência —
 * e aí o relatório de propostas ficava sem botão de WhatsApp e sem link. Aqui cada orçamento
 * é buscado individualmente pelo número (~1s, ver buscarOrcamentoPorNumero; listar o mês em
 * janelas leva >90s) e o resultado fica guardado no banco: cada orçamento é consultado
 * uma única vez. Falha de um orçamento só o deixa de fora — é tentado de novo na próxima vez. */
export async function obterContatosOrcamentos(
  mes: number,
  ano: number,
  numeros: string[],
): Promise<Record<string, ContatoOrcamento>> {
  const chaveCache = `orc_contatos_${mes}_${ano}`;
  const salvo: Record<string, ContatoOrcamento> = (await getDbCache(chaveCache, { ignorarExpiracao: true }))?.allOs?.[0] ?? {};

  const faltam = numeros.filter(n => n && !salvo[n]);
  if (faltam.length === 0) return salvo;

  const inicio = Date.now();
  let proximo = 0;
  let novos = 0;
  async function trabalhador() {
    while (proximo < faltam.length && Date.now() - inicio < LIMITE_BUSCA_ORCAMENTOS_MS) {
      const numero = faltam[proximo++];
      try {
        const orc = await buscarOrcamentoPorNumero(numero);
        // Confere o sequencial devolvido: um número errado no caminho devolveria outro orçamento
        if (!orc || String(orc.sequencial_orcamento) !== numero) continue;
        const { telefone, contato } = extrairContatoDaOs(orc);
        salvo[numero] = { telefone, contato, mubisysId: typeof orc.id === "number" ? orc.id : null };
        novos++;
      } catch {
        // API instável: fica sem dado agora e tenta de novo na próxima abertura
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCIA_BUSCA_ORCAMENTO }, trabalhador));

  if (novos > 0) await setDbCache(chaveCache, mes, ano, [salvo], [], TTL_CONTATOS_ORCAMENTO_MS);
  return salvo;
}

/** Item da lista "Clientes Novos" do mês. `reativado` separa quem já tinha comprado antes
 * (e voltou após 6+ meses sem pedir) de quem nunca comprou — mesma regra dos contadores
 * totalPuros/totalReativados, então as duas visões sempre batem. */
type ClienteNovoListaItem = {
  empresa: string; vendedor: string; osNumero: string | null; valorOs: string | null;
  telefone: string; whatsappLink: string; contato: string; cidade: string; estado: string;
  reativado: boolean;
};

async function getClientesNovosMes(mes: number, ano: number, forceRefresh = false): Promise<{
  total: number;
  totalReativados: number;
  /** Clientes genuinamente novos (nunca compraram antes), sem os reativados — ver nota em calcularNovosDoMesLocal. */
  totalPuros: number;
  cotacoesNovos: number;
  osNovos: number;
  faturamentoNovos: number;
  /** Subconjunto de faturamentoNovos: o que veio de clientes reativados. */
  faturamentoReativados: number;
  /** Faturamento de clientes genuinamente novos, sem os reativados. */
  faturamentoNovosPuros: number;
  ticketMedioNovos: number;
  valorOrcadoNovos: number;
  taxaConversaoNovos: number;
  taxaFaturamentoNovos: number;
  porVendedor: Record<string, number>;
  /** Só clientes puros (nunca compraram antes). Nunca combinar com porVendedorReativados
   * na mesma métrica — é a mesma separação usada nos KPIs de topo (totalPuros/totalReativados). */
  porVendedorNovos: Record<string, VendedorNovosStats>;
  /** Clientes que já compraram antes mas ficaram 6+ meses sem pedir. Mesmo formato de
   * porVendedorNovos, mas é uma família de cliente separada — ver [[performance-comercial-novos-vs-reativados]]. */
  porVendedorReativados: Record<string, VendedorNovosStats>;
  lista: ClienteNovoListaItem[];
}> {
  const db = await getDb();
  const EMPTY ={ total: 0, totalReativados: 0, totalPuros: 0, cotacoesNovos: 0, osNovos: 0, faturamentoNovos: 0, faturamentoReativados: 0, faturamentoNovosPuros: 0, ticketMedioNovos: 0, valorOrcadoNovos: 0, taxaConversaoNovos: 0, taxaFaturamentoNovos: 0, porVendedor: {}, porVendedorNovos: {}, porVendedorReativados: {}, lista: [] };
  if (!db) return EMPTY;

  // ─── SNAPSHOT CONGELADO: verificar se já tem lista salva ───
  // Se o mês está congelado E a lista já foi salva, retornar imediatamente sem chamar API.
  // Se a lista ainda não foi salva, calcular normalmente e salvar ao final.
  const snapCongelado = await db.select().from(performanceAuditada)
    .where(and(eq(performanceAuditada.mes, mes), eq(performanceAuditada.ano, ano), eq(performanceAuditada.congelado, true)))
    .limit(1);
  if (snapCongelado.length > 0 && snapCongelado[0].listaClientesNovos) {
    // Lista já foi salva no snapshot — retornar imediatamente sem chamar API
    const s = snapCongelado[0];
    let listaSnap: ClienteNovoListaItem[] = [];
    try { listaSnap = JSON.parse(s.listaClientesNovos ?? '[]'); } catch { listaSnap = []; }

    // Buscar cotações por vendedor e histórico de compras ANTES de agrupar por vendedor —
    // precisamos saber puro/reativado já na primeira passada, senão a separação abaixo
    // não tem como acontecer (nunca misturar as duas famílias na mesma métrica de vendedor).
    const orcMesSnap = await db.select().from(historicoOrcamentos)
      .where(and(eq(historicoOrcamentos.mes, mes), eq(historicoOrcamentos.ano, ano)));
    // Clientes anteriores para identificar novos (nunca compraram ou inativos há 6+ meses)
    const comprasSnap = await buscarTodasComprasValidas(db);
    const ultimaCompraSnap = ultimaCompraAntesDe(comprasSnap, mes, ano);
    // Reativados = clientes novos (lista salva) que já tinham comprado antes (ultima existe),
    // mas ficaram 6+ meses sem pedir. "Novo puro" = nunca comprou (ultima ausente).
    const ultimaCompraSnapNorm = reindexarPorChaveNormalizada(ultimaCompraSnap);

    // Reconstruir porVendedorNovos (puros) e porVendedorReativados a partir da lista salva
    // (OS de clientes novos por vendedor), já separados por família de cliente.
    // Isso garante que o Dashboard Clientes Novos por Vendedor apareça em todos os meses congelados
    const porVendedorNovosSnap: Record<string, { clientesNovos: number; osNovos: number; faturamentoNovos: number; cotacoesNovos: number; valorOrcadoNovos: number; taxaConvNovos: number; taxaFatNovos: number }> = {};
    const porVendedorReativadosSnap: Record<string, { clientesNovos: number; osNovos: number; faturamentoNovos: number; cotacoesNovos: number; valorOrcadoNovos: number; taxaConvNovos: number; taxaFatNovos: number }> = {};
    for (const item of listaSnap) {
      const vendedor = item.vendedor || "Sem Vendedor";
      const valor = parseFloat(String(item.valorOs ?? "0")) || 0;
      const jaComprouAntesItem = Boolean(ultimaCompraSnapNorm.get(normalizeEmpresaKey(item.empresa)));
      const bucketSnap = jaComprouAntesItem ? porVendedorReativadosSnap : porVendedorNovosSnap;
      if (!bucketSnap[vendedor]) {
        bucketSnap[vendedor] = { clientesNovos: 0, osNovos: 0, faturamentoNovos: 0, cotacoesNovos: 0, valorOrcadoNovos: 0, taxaConvNovos: 0, taxaFatNovos: 0 };
      }
      bucketSnap[vendedor].clientesNovos++;
      bucketSnap[vendedor].osNovos++;
      bucketSnap[vendedor].faturamentoNovos = parseFloat((bucketSnap[vendedor].faturamentoNovos + valor).toFixed(2));
    }
    // Listas salvas antes desta separação não têm o campo `reativado` — sempre recalcula
    // na leitura (mesma chave usada nos contadores acima) em vez de confiar no JSON salvo.
    for (const item of listaSnap) {
      item.reativado = Boolean(ultimaCompraSnapNorm.get(normalizeEmpresaKey(item.empresa)));
    }
    // Listas gravadas quando a API estava fora ficaram sem telefone/cidade — completa só esses
    // campos de contato (nenhum valor auditado muda) a partir das OS do mês, com cache.
    if (listaSnap.some(item => !item.telefone)) {
      const contatosMes = await obterContatosDoMes(mes, ano);
      if (contatosMes) {
        for (const item of listaSnap) {
          if (item.telefone) continue;
          const c = contatosMes[normalizeEmpresaKey(item.empresa)];
          if (!c) continue;
          item.telefone = c.telefone;
          item.contato ||= c.contato;
          item.cidade ||= c.cidade;
          item.estado ||= c.estado;
        }
      }
    }
    // Recalcula o link sempre: listas antigas guardam links gerados pela regra anterior
    // (que tratava DDD 55 como código do país).
    for (const item of listaSnap) item.whatsappLink = formatarLinkWhatsApp(item.telefone);
    const clientesUnicosSnap = new Set(listaSnap.map(item => normalizeEmpresaKey(item.empresa)));
    let totalReativadosSnap = 0;
    for (const chave of clientesUnicosSnap) {
      if (ultimaCompraSnapNorm.get(chave)) totalReativadosSnap++;
    }
    // Faturamento vindo de reativados: soma por OS da lista salva (não por cliente),
    // porque um reativado pode ter mais de uma OS no mês.
    let faturamentoReativadosSnap = 0;
    for (const item of listaSnap) {
      if (!ultimaCompraSnapNorm.get(normalizeEmpresaKey(item.empresa))) continue;
      faturamentoReativadosSnap += parseFloat(String(item.valorOs ?? "0")) || 0;
    }
    for (const orc of orcMesSnap) {
      const clienteKey = (orc.empresa ?? "").toLowerCase().trim();
      if (!clienteKey || !isClienteNovoPorRecencia(ultimaCompraSnap.get(clienteKey), mes, ano)) continue;
      const vendedor = orc.vendedor || "Sem Vendedor";
      const jaComprouAntesOrcSnap = Boolean(ultimaCompraSnap.get(clienteKey));
      const bucketOrcSnap = jaComprouAntesOrcSnap ? porVendedorReativadosSnap : porVendedorNovosSnap;
      if (!bucketOrcSnap[vendedor]) {
        bucketOrcSnap[vendedor] = { clientesNovos: 0, osNovos: 0, faturamentoNovos: 0, cotacoesNovos: 0, valorOrcadoNovos: 0, taxaConvNovos: 0, taxaFatNovos: 0 };
      }
      bucketOrcSnap[vendedor].cotacoesNovos++;
      bucketOrcSnap[vendedor].valorOrcadoNovos += parseFloat(String(orc.total ?? "0")) || 0;
    }
    // Calcular taxas por vendedor (puros e reativados separadamente)
    for (const mapaSnap of [porVendedorNovosSnap, porVendedorReativadosSnap]) {
      for (const v of Object.keys(mapaSnap)) {
        const entry = mapaSnap[v];
        entry.taxaConvNovos = entry.cotacoesNovos > 0 ? parseFloat(((entry.osNovos / entry.cotacoesNovos) * 100).toFixed(1)) : 0;
        entry.taxaFatNovos = entry.valorOrcadoNovos > 0 ? parseFloat(((entry.faturamentoNovos / entry.valorOrcadoNovos) * 100).toFixed(1)) : 0;
        entry.valorOrcadoNovos = parseFloat(entry.valorOrcadoNovos.toFixed(2));
      }
    }

    const cotacoesNovosSnap = (s.cotacoesNovos ?? 0) > 0 ? (s.cotacoesNovos ?? 0)
      : Object.values(porVendedorNovosSnap).reduce((acc, v) => acc + v.cotacoesNovos, 0)
        + Object.values(porVendedorReativadosSnap).reduce((acc, v) => acc + v.cotacoesNovos, 0);
    const taxaConvNovosSnap = parseFloat(String(s.taxaConvNovos ?? 0)) > 0
      ? parseFloat(String(s.taxaConvNovos ?? 0))
      : (cotacoesNovosSnap > 0 ? parseFloat((((s.clientesNovos ?? 0) / cotacoesNovosSnap) * 100).toFixed(1)) : 0);

    return {
      total: s.clientesNovos ?? 0,
      totalReativados: totalReativadosSnap,
      totalPuros: (s.clientesNovos ?? 0) - totalReativadosSnap,
      cotacoesNovos: cotacoesNovosSnap,
      osNovos: s.clientesNovos ?? 0,
      faturamentoNovos: parseFloat(String(s.faturamentoNovos ?? 0)),
      faturamentoReativados: parseFloat(faturamentoReativadosSnap.toFixed(2)),
      faturamentoNovosPuros: parseFloat((parseFloat(String(s.faturamentoNovos ?? 0)) - faturamentoReativadosSnap).toFixed(2)),
      ticketMedioNovos: s.clientesNovos ? parseFloat(String(s.faturamentoNovos ?? 0)) / s.clientesNovos : 0,
      valorOrcadoNovos: 0,
      taxaConversaoNovos: taxaConvNovosSnap,
      taxaFaturamentoNovos: 0,
      porVendedor: {},
      porVendedorNovos: porVendedorNovosSnap,
      porVendedorReativados: porVendedorReativadosSnap,
      lista: listaSnap,
    };
  }
  // Se mês congelado mas sem lista salva: calcular e salvar ao final
  // ─────────────────────────────────────────────────────────────────────────────────────────

  const publicKey = ENV.MUBISYS_PUBLIC_KEY;
  const accessToken = ENV.MUBISYS_ACCESS_TOKEN;

  // Sem credenciais da API não é possível calcular corretamente
  if (!publicKey || !accessToken) return EMPTY;

  // Buscar overrides manuais de clientes
  const overrides = await db.select().from(clienteOverrides);
  const overrideMap = new Map<string, "recorrente" | "novo">();
  for (const ov of overrides) overrideMap.set(ov.empresa, ov.status);

  // FONTE DE VERDADE: usar banco local para histórico anterior (quem comprou antes deste mês,
  // e quando foi a última vez — necessário pra regra de reativação de 6 meses)
  const todasComprasValidas = await buscarTodasComprasValidas(db);
  const ultimaCompraPorCliente = ultimaCompraAntesDe(todasComprasValidas, mes, ano);
  // Nomes de cliente aqui vêm da API MubiSys ao vivo (nomeCliente), não do banco local —
  // precisa da versão com chave normalizada (ver reindexarPorChaveNormalizada) para casar
  // corretamente com o histórico importado, senão quase todo cliente aparenta ser "novo".
  const ultimaCompraPorClienteNorm = reindexarPorChaveNormalizada(ultimaCompraPorCliente);

  // FONTE DE VERDADE: usar API Mubisys para buscar OS do mês (dados em tempo real, completos)
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(ano, mes, 0).getDate();
  const di = `${ano}-${pad(mes)}-01`;
  const df = `${ano}-${pad(mes)}-${pad(lastDay)}`;

  let allOsApi: any[] = [];
  let allOrcApiPrefetched: any[] | null = null; // será preenchido se vier do cache

  // forceRefresh: limpar o MESMO cache compartilhado que getMes usa (chaves
  // mes_/os_raw_/orc_raw_/raw_${mes}_${ano}). Sem isso, "Clientes Novos/Reativados"
  // podia refletir um instante diferente do dia do que "Vendas Realizadas/Faturamento"
  // (getMes) mesmo os dois vindo do mesmo clique em "Atualizar" — cada card parecia
  // consistente sozinho, mas a soma por vendedor não batia com o agregado porque um
  // card tinha OS aprovadas depois do outro. Ver conversa de 2026-09-23.
  if (forceRefresh) {
    deleteCache(`os_raw_${mes}_${ano}`);
    deleteCache(`orc_raw_${mes}_${ano}`);
    deleteCache(`mes_${mes}_${ano}`);
    await deleteDbCache(`raw_${mes}_${ano}`);
  }

  try {
    // Usar getMesFromApi que já tem cache e deduplicação (também popula os_raw/orc_raw
    // como efeito colateral). Timeout de 45s: este procedure roda no mesmo lote HTTP
    // batched de getMes, então precisa desistir bem antes do maxDuration:60s.
    await withTimeout(getMesFromApi(mes, ano), 45000, "timeout_clientes_novos");
    // Reconstruir lista de OS a partir dos dados agregados não é possível
    // Precisamos buscar OS individuais para identificar clientes
    // Usar cache de OS brutas separado (memória + banco persistente)
    const rawCacheKeyNovos = `raw_${mes}_${ano}`;
    const osCacheKey = `os_raw_${mes}_${ano}`;
    const orcCacheKey = `orc_raw_${mes}_${ano}`;
    const cachedOs = getCached(osCacheKey);
    const cachedOrc = getCached(orcCacheKey);

    if (cachedOs && cachedOrc) {
      // Cache em memória disponível
      allOsApi = cachedOs;
      allOrcApiPrefetched = cachedOrc;
    } else {
      // Tentar cache persistente no banco
      const dbCachedNovos = await getDbCache(rawCacheKeyNovos);
      if (dbCachedNovos) {
        allOsApi = dbCachedNovos.allOs;
        allOrcApiPrefetched = dbCachedNovos.allOrc;
        setCacheWithTTL(osCacheKey, allOsApi, mes, ano);
        setCacheWithTTL(orcCacheKey, allOrcApiPrefetched, mes, ano);
      } else {
        // Buscar da API MubiSys — em paralelo, cada chamada já tem seu próprio timeout (TIMEOUT_LISTA_MS)
        const [osResult, orcResult] = await Promise.all([
          listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial: di, datafinal: df }),
          listarOrcamentosMubiSys({ status: "TODOS", datainicial: di, datafinal: df }),
        ]);
        allOsApi = osResult.itens;
        const orcList = orcResult.itens;
        setCacheWithTTL(osCacheKey, allOsApi, mes, ano);
        setCacheWithTTL(orcCacheKey, orcList, mes, ano);
        setDbCache(rawCacheKeyNovos, mes, ano, allOsApi, orcList).catch(() => {});
        allOrcApiPrefetched = orcList;
      }
    }
  } catch {
    // Fallback 1: OS do mês em janelas curtas (~3s, com telefone/cidade). A busca agregada
    // acima costuma falhar por causa dos orçamentos, não das OS. Limite de 10s para caber
    // no maxDuration:60s depois dos 45s da tentativa anterior.
    let osEmJanelas: any[] | null = null;
    try {
      osEmJanelas = await withTimeout(buscarOsDoMesEmJanelas(mes, ano), 10000, "timeout_os_janelas");
    } catch {
      osEmJanelas = null;
    }
    if (osEmJanelas) {
      allOsApi = osEmJanelas;
    } else {
      // Fallback 2: banco local (sem telefone — só cidade/UF quando importados)
      const osMesDb = await db.select().from(historicoOs)
        .where(and(eq(historicoOs.mes, mes), eq(historicoOs.ano, ano)));
      allOsApi = osMesDb.map(os => ({
        cliente: os.empresa,
        vendedor: os.vendedor,
        sequencial_ordem: os.osNumero,
        valor_total: os.valorOs ?? os.valorTotal,
        tipo: os.tipoOs ?? "",
        status: os.status ?? "",
        cliente_endereco: [{ cidade: os.cidade ?? "", estado: os.estado ?? "" }],
      }));
    }
  }

  // Filtrar OS Normais (mesma regra de isOsNormalDb, aplicada ao campo `tipo` da API)
  const osNormaisApi = allOsApi.filter(isOsNormalApi);

  const porVendedor: Record<string, number> = {};
  // Separados desde a origem: "Novos" = nunca compraram antes (puros); "Reativados" = já
  // compraram antes mas ficaram 6+ meses sem pedir. Nunca combinar as duas famílias numa
  // mesma métrica de vendedor — mesma regra dos KPIs de topo (totalPuros/totalReativados).
  const porVendedorNovosOs: Record<string, { osNovos: number; faturamentoNovos: number; clientesNovos: number; nomeOriginal: string }> = {};
  const porVendedorReativadosOs: Record<string, { osNovos: number; faturamentoNovos: number; clientesNovos: number; nomeOriginal: string }> = {};
  let total = 0;
  let totalReativados = 0;
  let osNovosCount = 0;
  let faturamentoNovos = 0;
  let faturamentoReativados = 0;
  const clientesVistos = new Set<string>();
  // listaRaw agora inclui contato e cidade extraídos diretamente da OS
  // Os campos cliente_contato e cliente_endereco já vêm na resposta da OS com dados do CLIENTE
  // Isso elimina a necessidade de busca por nome (que retornava dados da Radra)
  const listaRaw: Array<Omit<ClienteNovoListaItem, "whatsappLink">> = [];

  for (const os of osNormaisApi) {
    // Extrair nome do cliente da API (campo 'cliente' pode ser objeto ou string)
    const clienteRaw = os.cliente;
    const nomeCliente = typeof clienteRaw === "object" && clienteRaw !== null
      ? String((clienteRaw as any)?.nome ?? (clienteRaw as any)?.razao_social ?? "")
      : String(clienteRaw ?? "");
    const clienteKey = nomeCliente.toLowerCase().trim();
    if (!clienteKey) continue;

    // Verificar override manual: "recorrente" exclui; "novo" força inclusão
    // Usa chave normalizada (sem acentos) — igual à gravada em upsertClienteOverride
    const overrideStatus = overrideMap.get(normalizeEmpresaKey(nomeCliente));
    // Regra de negócio: "novo" = nunca comprou OU está inativo há 6+ meses (reativado)
    const isNovoByHistory = isClienteNovoPorRecencia(ultimaCompraPorClienteNorm.get(normalizeEmpresaKey(nomeCliente)), mes, ano);
    const isNovo = overrideStatus === "recorrente" ? false
      : overrideStatus === "novo" ? true
      : isNovoByHistory;

    if (isNovo) {
      const vendedor = String(os.vendedor ?? "Sem Vendedor");
      const vendedorKey = vendedor.toLowerCase().trim();
      const valorOs = valorLiquidoOs(os);
      const jaComprouAntes = Boolean(ultimaCompraPorClienteNorm.get(normalizeEmpresaKey(nomeCliente)));
      faturamentoNovos += valorOs;
      // Subconjunto de faturamentoNovos — ver nota em calcularNovosDoMesLocal.
      if (jaComprouAntes) faturamentoReativados += valorOs;
      osNovosCount++;
      // Bucket por vendedor: puros e reativados nunca no mesmo contador (ver nota acima).
      const bucketOs = jaComprouAntes ? porVendedorReativadosOs : porVendedorNovosOs;
      if (!bucketOs[vendedorKey]) bucketOs[vendedorKey] = { osNovos: 0, faturamentoNovos: 0, clientesNovos: 0, nomeOriginal: vendedor };
      bucketOs[vendedorKey].osNovos++;
      bucketOs[vendedorKey].faturamentoNovos += valorOs;
      if (!clientesVistos.has(clienteKey)) {
        clientesVistos.add(clienteKey);
        total++;
        // Reativado = já tinha comprado antes (ultima compra existe), mas ficou 6+ meses sem pedir.
        // "Novo puro" = nunca comprou (sem registro de última compra).
        if (jaComprouAntes) totalReativados++;
        porVendedor[vendedor] = (porVendedor[vendedor] ?? 0) + 1;
        bucketOs[vendedorKey].clientesNovos++;
        // Contato e cidade DIRETAMENTE da OS (ver extrairContatoDaOs). O número da OS na API
        // é `sequencial_ordem` — a API não devolve `numero`.
        const { telefone: telefoneOs, contato: contatoOs, cidade: cidadeOs, estado: estadoOs } = extrairContatoDaOs(os);
        listaRaw.push({ empresa: nomeCliente, vendedor, osNumero: String(os.sequencial_ordem ?? os.numero ?? ""), valorOs: String(valorOs), telefone: telefoneOs, contato: contatoOs, cidade: cidadeOs, estado: estadoOs, reativado: jaComprouAntes });
      }
    }
  }

  // Montar lista final — contato e cidade já vêm da OS (campos cliente_contato e cliente_endereco)
  // Não é mais necessário buscar por nome na API (que retornava dados da Radra)
  const lista: ClienteNovoListaItem[] = [];
  for (const item of listaRaw) {
    lista.push({
      ...item,
      whatsappLink: formatarLinkWhatsApp(item.telefone),
    });
  }

  // Contar cotações (orçamentos) de clientes novos no mês — usar cache se disponível
  let cotacoesNovos = 0;
  let valorOrcadoNovos = 0;
  const porVendedorNovosOrc: Record<string, { cotacoesNovos: number; valorOrcadoNovos: number; nomeOriginal: string }> = {};
  const porVendedorReativadosOrc: Record<string, { cotacoesNovos: number; valorOrcadoNovos: number; nomeOriginal: string }> = {};

  {
    // Usar orçamentos já buscados (cache) ou banco local como fallback
    let allOrcApi: any[] = [];
    if (allOrcApiPrefetched !== null) {
      // Usar dados já buscados no bloco anterior (evita chamada duplicada)
      // REGRA: excluir cotações canceladas/excluídas antes de contar
      const STATUS_EXCL_ORC = ["cancelada", "cancelado", "excluída", "excluído", "excluida", "excluido"];
      allOrcApi = allOrcApiPrefetched.filter((orc: any) =>
        !STATUS_EXCL_ORC.includes((orc.status ?? "").toLowerCase())
      );
    } else {
      // Fallback: banco local
      const orcMes = await db.select().from(historicoOrcamentos)
        .where(and(eq(historicoOrcamentos.mes, mes), eq(historicoOrcamentos.ano, ano)));
      allOrcApi = orcMes.map(orc => ({
        cliente: orc.empresa,
        vendedor: orc.vendedor,
        valor_total: orc.total,
      }));
    }
    for (const orc of allOrcApi) {
      const clienteRaw = orc.cliente;
      const nomeCliente = typeof clienteRaw === "object" && clienteRaw !== null
        ? String((clienteRaw as any)?.nome ?? (clienteRaw as any)?.razao_social ?? "")
        : String(clienteRaw ?? "");
      const clienteKey = nomeCliente.toLowerCase().trim();
      const orcOverride = overrideMap.get(normalizeEmpresaKey(nomeCliente));
      const isNovoOrc = orcOverride === "recorrente" ? false
        : orcOverride === "novo" ? true
        : isClienteNovoPorRecencia(ultimaCompraPorClienteNorm.get(normalizeEmpresaKey(nomeCliente)), mes, ano);
      if (clienteKey && isNovoOrc) {
        cotacoesNovos++;
        const valor = parseFloat(String(orc.valor_total ?? orc.valor ?? orc.total ?? orc.valorTotal ?? "0")) || 0;
        valorOrcadoNovos += valor;
        const vendedorOrcRaw = String(orc.vendedor ?? orc.usuario ?? "Sem Vendedor");
        const vendedorOrcKey = vendedorOrcRaw.toLowerCase().trim();
        // Mesma separação puros/reativados da lista de OS acima.
        const jaComprouAntesOrc = Boolean(ultimaCompraPorClienteNorm.get(normalizeEmpresaKey(nomeCliente)));
        const bucketOrc = jaComprouAntesOrc ? porVendedorReativadosOrc : porVendedorNovosOrc;
        if (!bucketOrc[vendedorOrcKey]) bucketOrc[vendedorOrcKey] = { cotacoesNovos: 0, valorOrcadoNovos: 0, nomeOriginal: vendedorOrcRaw };
        bucketOrc[vendedorOrcKey].cotacoesNovos++;
        bucketOrc[vendedorOrcKey].valorOrcadoNovos += valor;
      }
    }
  }
  const osNovos = osNovosCount; // total de OS de clientes novos (pode ser > total de clientes)
  const taxaConversaoNovos = cotacoesNovos > 0
    ? parseFloat(((osNovos / cotacoesNovos) * 100).toFixed(1))
    : 0;
  // Taxa de faturamento de novos = faturamento realizado / valor orçado dos novos
  const taxaFaturamentoNovos = valorOrcadoNovos > 0
    ? parseFloat(((faturamentoNovos / valorOrcadoNovos) * 100).toFixed(1))
    : 0;
  // Montar porVendedorNovos (puros) e porVendedorReativados combinando OS + cotações por
  // vendedor, sempre a partir dos buckets já separados acima — nunca somar os dois.
  // Chaves são lowercase; usar nomeOriginal para preservar capitalização original
  const montarPorVendedorNovos = (
    osMap: Record<string, { osNovos: number; faturamentoNovos: number; clientesNovos: number; nomeOriginal: string }>,
    orcMap: Record<string, { cotacoesNovos: number; valorOrcadoNovos: number; nomeOriginal: string }>,
  ): Record<string, VendedorNovosStats> => {
    const todosVendedores = Array.from(new Set([...Object.keys(osMap), ...Object.keys(orcMap)]));
    const resultado: Record<string, VendedorNovosStats> = {};
    for (const v of todosVendedores) {
      const os = osMap[v] ?? { osNovos: 0, faturamentoNovos: 0, clientesNovos: 0, nomeOriginal: v };
      const orc = orcMap[v] ?? { cotacoesNovos: 0, valorOrcadoNovos: 0, nomeOriginal: v };
      // Usar o nome original com melhor capitalização (preferir o da API de orçamentos)
      const nomeDisplay = orc.nomeOriginal !== v ? orc.nomeOriginal : os.nomeOriginal;
      const taxaConvNovos = orc.cotacoesNovos > 0
        ? parseFloat(((os.osNovos / orc.cotacoesNovos) * 100).toFixed(1)) : 0;
      const taxaFatNovos = orc.valorOrcadoNovos > 0
        ? parseFloat(((os.faturamentoNovos / orc.valorOrcadoNovos) * 100).toFixed(1)) : 0;
      resultado[nomeDisplay] = {
        clientesNovos: os.clientesNovos,
        osNovos: os.osNovos,
        faturamentoNovos: parseFloat(os.faturamentoNovos.toFixed(2)),
        cotacoesNovos: orc.cotacoesNovos,
        valorOrcadoNovos: parseFloat(orc.valorOrcadoNovos.toFixed(2)),
        taxaConvNovos,
        taxaFatNovos,
      };
    }
    return resultado;
  };
  const porVendedorNovos = montarPorVendedorNovos(porVendedorNovosOs, porVendedorNovosOrc);
  const porVendedorReativados = montarPorVendedorNovos(porVendedorReativadosOs, porVendedorReativadosOrc);

  const ticketMedioNovos = osNovos > 0 ? parseFloat((faturamentoNovos / osNovos).toFixed(2)) : 0;

  // ─── SALVAR LISTA NO SNAPSHOT CONGELADO (se mês está congelado e lista ainda não foi salva) ───
  if (snapCongelado.length > 0 && !snapCongelado[0].listaClientesNovos && lista.length > 0) {
    db.update(performanceAuditada)
      .set({ listaClientesNovos: JSON.stringify(lista) })
      .where(and(eq(performanceAuditada.mes, mes), eq(performanceAuditada.ano, ano)))
      .execute()
      .catch(() => {});
  }

  return {
    total,
    totalReativados,
    totalPuros: total - totalReativados,
    cotacoesNovos,
    osNovos,
    faturamentoNovos: parseFloat(faturamentoNovos.toFixed(2)),
    faturamentoReativados: parseFloat(faturamentoReativados.toFixed(2)),
    faturamentoNovosPuros: parseFloat((faturamentoNovos - faturamentoReativados).toFixed(2)),
    ticketMedioNovos,
    valorOrcadoNovos: parseFloat(valorOrcadoNovos.toFixed(2)),
    taxaConversaoNovos,
    taxaFaturamentoNovos,
    porVendedor,
    porVendedorNovos,
    porVendedorReativados,
    lista,
  };
}

// ─── Fila de ações de Inteligência de Clientes — sincronização idempotente ───
// Compartilhada por getFilaAcoesClientes e gerarFilaAcoesPdf, para não gerar
// a fila duas vezes (uma para exibir, outra para o PDF) com regras divergentes.
// Exportada: server/routers/crm.ts (aba "Sugestões de Contato") e
// server/services/relatorioComercialCrm.ts (relatório por e-mail) reusam a
// MESMA fila — em vez de recalcular "cliente parado" com outra regra, a aba
// de sugestão do CRM é só outra visualização (filtrada por tipo/vendedor) da
// fila já existente de Inteligência de Clientes.
export async function sincronizarFilaAcoesClientes(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<void> {
  const rows = await db.select().from(historicoOs);
  const base = construirBaseClientes(rows as any);
  const dataRef = new Date();
  const candidatos = calcularCandidatosAcao(base, dataRef);

  // Upsert idempotente: não recria ação resolvida (concluída/descartada) há menos de
  // DIAS_COOLDOWN_ACAO_RESOLVIDA dias; caso contrário, atualiza motivo/evidência/prioridade
  // de uma ação pendente/adiada já existente, ou cria uma nova.
  const cutoff = new Date(dataRef.getTime() - DIAS_COOLDOWN_ACAO_RESOLVIDA * 86400000);
  for (const cand of candidatos) {
    const existentes = await db.select().from(inteligenciaAcoesClientes)
      .where(and(eq(inteligenciaAcoesClientes.tipo, cand.tipo), eq(inteligenciaAcoesClientes.empresaKey, cand.empresaKey)))
      .limit(1);
    const existente = existentes[0];
    if (existente) {
      const resolvidaRecente = existente.resolvidoEm && new Date(existente.resolvidoEm) > cutoff
        && (existente.status === "concluida" || existente.status === "descartada");
      if (resolvidaRecente) continue; // não reabrir — usuário acabou de tratar
      if (existente.status === "adiada" && existente.prazo && new Date(existente.prazo) > dataRef) continue; // respeitar adiamento
      await db.update(inteligenciaAcoesClientes)
        .set({
          empresa: cand.empresa,
          vendedor: cand.vendedor,
          titulo: cand.titulo,
          motivo: cand.motivo,
          evidenciaJson: JSON.stringify(cand.evidencia),
          prioridade: cand.prioridade,
          prioridadeFatoresJson: JSON.stringify(cand.prioridadeFatores),
          dataAnalise: dataRef,
          updatedAt: dataRef,
          // Reabre uma ação concluída/descartada antiga (fora do cooldown) sem perder o histórico de resultado
          ...(existente.status === "concluida" || existente.status === "descartada" ? { status: "pendente" as const, resolvidoEm: null } : {}),
        })
        .where(eq(inteligenciaAcoesClientes.id, existente.id));
    } else {
      await db.insert(inteligenciaAcoesClientes).values({
        tipo: cand.tipo,
        empresaKey: cand.empresaKey,
        empresa: cand.empresa,
        vendedor: cand.vendedor,
        titulo: cand.titulo,
        motivo: cand.motivo,
        evidenciaJson: JSON.stringify(cand.evidencia),
        prioridade: cand.prioridade,
        prioridadeFatoresJson: JSON.stringify(cand.prioridadeFatores),
        versaoRegra: VERSAO_REGRA_ATUAL,
        dataAnalise: dataRef,
      });
    }
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const performanceComercialRouter = router({

  // Dados de um mês específico
  getMes: publicProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020), forceRefresh: z.boolean().optional().default(false) }))
    .query(async ({ input }) => {
      const { mes, ano, forceRefresh } = input;

      // ─── SNAPSHOT ESTÁTICO: verificar dados congelados ANTES de qualquer chamada à API ───
      // Dados congelados têm prioridade absoluta — nunca são sobrescritos por consultas automáticas.
      // Apenas forceRefresh explícito (recalibragem) pode ignorar o snapshot.
      if (!forceRefresh) {
        const dbSnap = await getDb();
        if (dbSnap) {
          const snap = await dbSnap.select().from(performanceAuditada)
            .where(and(eq(performanceAuditada.mes, mes), eq(performanceAuditada.ano, ano), eq(performanceAuditada.congelado, true)))
            .limit(1);
          if (snap.length > 0) {
            const s = snap[0];
            // Congelado não guarda clientesUnicos/clientesComRecompra por cliente —
            // completar a partir de historico_os (mesma fonte usada para congelar).
            const { clientesUnicos, clientesComRecompra } = await contarClientesUnicosDoMes(mes, ano);
            // Retornar dados congelados diretamente — sem chamar API ou banco histórico
            return {
              cotacoes: s.cotacoes,
              osGeradas: s.osNormais,
              taxaConversao: parseFloat(String(s.taxaConversao)),
              taxaFaturamento: s.valorOrcado && parseFloat(String(s.valorOrcado)) > 0
                ? parseFloat((parseFloat(String(s.faturamento)) / parseFloat(String(s.valorOrcado)) * 100).toFixed(2))
                : 0,
              ticketMedio: s.osNormais > 0
                ? parseFloat((parseFloat(String(s.faturamento)) / s.osNormais).toFixed(2))
                : 0,
              margemPct: 0,
              custo: 0,
              resultado: 0,
              clientesUnicos,
              clientesComRecompra,
              label: `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][s.mes - 1]}/${String(s.ano).slice(2)}`,
              mes: s.mes,
              ano: s.ano,
              faturamento: parseFloat(String(s.faturamento)),
              valorOrcado: parseFloat(String(s.valorOrcado)),
              clientesNovos: s.clientesNovos,
              taxaConvNovos: parseFloat(String(s.taxaConvNovos)),
              faturamentoNovos: parseFloat(String(s.faturamentoNovos)),
              totalPedidosBanco: null,
              _fonte: 'congelado' as const,
              _statusValidacao: s.statusValidacao,
              _dataAuditoria: s.dataAuditoria,
              _dataCongelamento: s.dataCongelamento,
              _auditadoPor: s.auditadoPor,
              // Campos extras para compatibilidade com o restante da UI
              porVendedor: {},
              top3Vendedores: [],
              metaAtingida: false,
              metaCotacoes: 0,
              metaOs: 0,
              metaFaturamento: 0,
              metaTaxaConversao: 0,
            };
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────────────────────────

      // Se forceRefresh, limpar cache do servidor para este mês (memória + banco persistente)
      if (forceRefresh) {
        const osCacheKey = `os_raw_${mes}_${ano}`;
        const orcCacheKey = `orc_raw_${mes}_${ano}`;
        const mesCacheKey = `mes_${mes}_${ano}`;
        const rawCacheKey = `raw_${mes}_${ano}`; // chave usada pelo cache persistente
        deleteCache(osCacheKey);
        deleteCache(orcCacheKey);
        deleteCache(mesCacheKey);
        // Limpar cache persistente com a chave correta (rawCacheKey = chave usada em setDbCache)
        deleteDbCache(rawCacheKey).catch(() => {});
      }

      let raw: any = null;

      // Usar API Mubisys para TODOS os meses (não só o atual) — mesmo padrão de
      // getMultiMes/getAno/getClientesNovosAno, para os números baterem entre telas.
      // A API tem cache próprio (memória + mubisys_api_cache no banco, 6h para meses
      // históricos), então repetir a mesma consulta não implica repetir a chamada HTTP.
      // Timeout de 42s — mesma margem usada em getClientesNovos/getMultiMes/getAno
      // (40-45s) neste arquivo, não os 55s que este procedure tinha antes. 55s contra
      // um maxDuration:60s deixava só ~5s pro fallback (getMesFromDb + query de
      // totalPedidos) e a serialização da resposta rodarem DEPOIS do race — e este
      // procedure roda batched (httpBatchLink) junto de getClientesNovos/getAuditoria,
      // então qualquer contenção empurrava o total pra cima de 60s, a Vercel matava a
      // função sem resposta nenhuma, e o front (com retry:1) refazia o mesmo caminho
      // lento do zero — visto como "loop infinito" ao trocar pro mês vigente (cache
      // garantidamente frio). 42s alinha com o restante do arquivo e devolve a mesma
      // folga de ~18s que as outras procedures já têm.
      const publicKey = ENV.MUBISYS_PUBLIC_KEY;
      const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
      if (publicKey && accessToken) {
        try {
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 42000));
          raw = await Promise.race([getMesFromApi(mes, ano), timeoutPromise]);
        } catch {
          raw = null;
        }
      }

      // Se não conseguiu da API, usar banco local como fallback
      let viaApi = raw !== null;
      if (!raw) {
        raw = await getMesFromDb(mes, ano);
      }

      // ─── SANITY CHECK: API "bem-sucedida" mas zerada ───────────────────────
      // A API MubiSys às vezes responde 200/201 com lista vazia de forma
      // transitória (falha intermitente do lado deles, não timeout — não cai
      // no catch acima). Para um mês que não é o atual, zero OS E zero
      // orçamentos ao mesmo tempo é implausível se já existe sync local.
      // Nesse caso, preferir o banco local em vez de aceitar o zero da API
      // como se fosse dado real. Ver conversa 20/08/2026: Julho/2026 mostrou
      // "TEMPO REAL" com todos os KPIs zerados enquanto o banco local já
      // tinha 171 OS e 831 orçamentos sincronizados para o mês.
      if (viaApi && !isMesAtual(mes, ano) && raw.osNormais?.total === 0 && raw.orcamentos?.total === 0) {
        const local = await getMesFromDb(mes, ano);
        if (local && (local.osNormais.total > 0 || local.orcamentos.total > 0)) {
          raw = local;
          viaApi = false;
        }
      }

      if (!raw) return null;
      const metrics = calcMetrics(raw.osNormais, raw.orcamentos, mes, ano);
      // Adicionar totalPedidos do banco local (alimentado manualmente) se disponível
      const db2 = await getDb();
      let totalPedidosBanco: number | null = null;
      if (db2) {
        const MESES_NOMES_UPPER = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
        const mesNome = MESES_NOMES_UPPER[mes - 1];
        const fatRow = await db2.select({ totalPedidos: faturamento.totalPedidos }).from(faturamento)
          .where(and(sql`UPPER(${faturamento.mes}) = ${mesNome}`, eq(faturamento.ano, ano))).limit(1);
        if (fatRow.length > 0 && fatRow[0].totalPedidos > 0) totalPedidosBanco = fatRow[0].totalPedidos;
      }
      // _origemDados: 'api' = veio da API MubiSys agora (ou do cache dela);
      // 'local' = API falhou/deu timeout, caiu pro snapshot local importado
      // (historico_os) — pode estar desatualizado ou zerado se o mês ainda
      // não foi importado. Front usa isso pra não mostrar R$ 0 como se fosse
      // faturamento real quando na verdade é "não conseguimos consultar".
      return { ...metrics, totalPedidosBanco, _origemDados: viaApi ? 'api' as const : 'local' as const };
    }),

  // ─── Resumo diário por vendedor, dividido em manhã/tarde ────────────────────
  // Alimenta o painel "Hoje" no topo do Performance Comercial: propostas feitas,
  // vendas realizadas e interações no CRM, separadas por turno, para dar visão
  // de produtividade AM x PM pedida pelo gestor (analogia ao BLOCO A de rotina
  // manhã/tarde já existente em crm.ts, getAuditoria).
  //
  // Busca ao vivo (não usa o cache mensal de 60min de getMes) porque é sempre
  // uma janela de só 1 dia — medido em 25/09/2026: ~5-20s por chamada, bem
  // dentro do timeout de 45s da API. Isso evita herdar a mesma defasagem de
  // cache que causou o relato de "Vendas Realizadas" divergente no mês (ver
  // investigação 143×151 do mesmo dia): aqui o dado é sempre buscado na hora.
  getResumoDiario: publicProcedure
    .input(z.object({ data: z.string().optional() })) // "YYYY-MM-DD", default hoje (Brasília)
    .query(async ({ input }) => {
      const dataStr = input.data ?? dataHojeBrasilia();

      // Sequencial, nunca em paralelo — mesma regra documentada em toda
      // integração MubiSys do projeto (paralelizar piora ou quebra as duas).
      const orcResult = await listarOrcamentosMubiSys({ datainicial: dataStr, datafinal: dataStr, perPage: 50 });
      const osResult = await listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial: dataStr, datafinal: dataStr });
      const osNormais = osResult.itens.filter(isOsNormalApi);

      // Logs de atividade do CRM do dia (registrarContato, alterarContato etc.),
      // já gravados com turno pré-calculado em horário de Brasília (ver calcTurno
      // em server/routers/crm.ts) — só precisamos recortar o dia certo aqui.
      const db = await getDb();
      const inicioUtc = new Date(dataStr + "T03:00:00.000Z"); // 00:00 Brasília
      const fimUtc = new Date(inicioUtc.getTime() + 24 * 60 * 60 * 1000 - 1); // 23:59:59.999 Brasília
      const logs = db
        ? await db.select().from(crmAtividadeLog)
            .where(and(gte(crmAtividadeLog.realizadaEm, inicioUtc), lte(crmAtividadeLog.realizadaEm, fimUtc)))
        : [];

      type Turno = { propostas: number; valorPropostas: number; vendas: number; valorVendas: number; interacoes: number; primeiraAcao: string | null; ultimaAcao: string | null };
      const novoTurno = (): Turno => ({ propostas: 0, valorPropostas: 0, vendas: 0, valorVendas: 0, interacoes: 0, primeiraAcao: null, ultimaAcao: null });
      const porVendedor: Record<string, { manha: Turno; tarde: Turno }> = {};
      const ensure = (v: string) => (porVendedor[v] ??= { manha: novoTurno(), tarde: novoTurno() });

      // As datas da API MubiSys ("YYYY-MM-DD HH:mm:ss") já vêm em horário de
      // Brasília (é o ERP local da empresa) — extrair a hora direto da string,
      // nunca via `new Date(str).getHours()`, que dependeria de o runtime estar
      // no fuso certo para dar o resultado certo (ver nota de calcTurno em crm.ts
      // sobre o servidor rodar em UTC na Vercel).
      const turnoDaHoraStr = (str: string | null | undefined): "manha" | "tarde" | "noite" => {
        const h = parseInt((str ?? "").slice(11, 13), 10);
        if (h >= 6 && h < 12) return "manha";
        if (h >= 12 && h < 18) return "tarde";
        return "noite";
      };

      for (const orc of orcResult.itens as any[]) {
        const turno = turnoDaHoraStr(orc.data_cadastro);
        if (turno === "noite") continue;
        const vendedor = orc.vendedor || "Sem Vendedor";
        const g = ensure(vendedor)[turno];
        g.propostas++;
        const vt = parseFloat(String(orc.valor_total ?? "0")) || 0;
        const vc = parseFloat(String(orc.valor_custo ?? "0")) || 0;
        const vm = parseFloat(String(orc.valor_margem ?? "0")) || 0;
        g.valorPropostas += vt > 0 ? vt : (vc + vm);
      }

      for (const os of osNormais as any[]) {
        const turno = turnoDaHoraStr(os.data_aprovacao);
        if (turno === "noite") continue;
        const vendedor = os.vendedor || "Sem Vendedor";
        const g = ensure(vendedor)[turno];
        g.vendas++;
        g.valorVendas += valorLiquidoOs(os);
      }

      for (const log of logs) {
        const turno = log.turno as "manha" | "tarde" | "noite" | null;
        if (turno !== "manha" && turno !== "tarde") continue;
        const vendedor = log.vendedor || "Sem Vendedor";
        const g = ensure(vendedor)[turno];
        g.interacoes++;
        const brasilia = new Date(new Date(log.realizadaEm).getTime() - 3 * 60 * 60 * 1000);
        const hhmm = `${String(brasilia.getUTCHours()).padStart(2, "0")}:${String(brasilia.getUTCMinutes()).padStart(2, "0")}`;
        if (!g.primeiraAcao || hhmm < g.primeiraAcao) g.primeiraAcao = hhmm;
        if (!g.ultimaAcao || hhmm > g.ultimaAcao) g.ultimaAcao = hhmm;
      }

      return {
        data: dataStr,
        vendedores: Object.entries(porVendedor)
          .map(([vendedor, turnos]) => ({ vendedor, ...turnos }))
          .sort((a, b) => a.vendedor.localeCompare(b.vendedor)),
      };
    }),

  // Múltiplos meses para comparativo e gráfico de evolução
  getMultiMes: publicProcedure
    .input(z.object({
      meses: z.array(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) })),
      forceRefresh: z.boolean().optional().default(false),
    }))
    .query(async ({ input }) => {
      const now = new Date();

      // Se forceRefresh, limpar cache do servidor de cada mês pedido (mesma lógica de getMes)
      // antes de buscar — senão a tabela comparativa fica presa ao cache de até 60min do
      // mês vigente mesmo depois do usuário clicar em "Atualizar".
      if (input.forceRefresh) {
        for (const { mes, ano } of input.meses) {
          deleteCache(`os_raw_${mes}_${ano}`);
          deleteCache(`orc_raw_${mes}_${ano}`);
          deleteCache(`mes_${mes}_${ano}`);
          deleteDbCache(`raw_${mes}_${ano}`).catch(() => {});
        }
      }
      const publicKey = ENV.MUBISYS_PUBLIC_KEY;
      const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
      const db = await getDb();

      // Buscar todos os dados do banco em uma única query por ano
      // Agrupar meses por ano para minimizar queries ao banco
      const anoSet = Array.from(new Set(input.meses.map(m => m.ano)));
      const dbDataByAno = new Map<number, { os: any[]; orc: any[] }>();
      for (const ano of anoSet) {
        const osRows = db ? await db.select().from(historicoOs).where(eq(historicoOs.ano, ano)) : [];
        const orcRows = db ? await db.select().from(historicoOrcamentos).where(eq(historicoOrcamentos.ano, ano)) : [];
        dbDataByAno.set(ano, { os: osRows, orc: orcRows });
      }

      // Pré-calcular dados de clientes novos por mês (banco local, rápido)
      // Mapa: "mes_ano" -> métricas de novos/reativados (calcularNovosDoMesLocal, mesma
      // função usada por getClientesNovosAno) + cotações de novos + clientes únicos/recompra
      // do mês inteiro (qualquer cliente, não só novos).
      const novosMap = new Map<string, {
        osNovos: number; faturamentoNovos: number; faturamentoReativados: number; faturamentoNovosPuros: number;
        clientesNovosUnicos: number; clientesReativados: number; clientesNovosPuros: number;
        ticketMedioNovos: number; cotacoesNovos: number; taxaConversaoNovos: number; taxaFaturamentoNovos: number;
        clientesUnicos: number; clientesComRecompra: number;
      }>();
      if (db) {
        const overrides = await db.select().from(clienteOverrides);
        const overrideMap = new Map<string, "recorrente" | "novo">();
        for (const ov of overrides) overrideMap.set(ov.empresa, ov.status);

        // Histórico completo (todos os anos) — a regra de "novo" (nunca comprou OU
        // inativo há 6+ meses) exige saber a última compra de cada cliente, que pode
        // ter sido em qualquer ano anterior, não só dentro de anoSet.
        const todasComprasValidas = await buscarTodasComprasValidas(db);

        for (const ano of anoSet) {
          const todasOsAno = dbDataByAno.get(ano)?.os ?? [];
          const todasOrcAno = dbDataByAno.get(ano)?.orc ?? [];

          const mesAtual = ano === now.getFullYear() ? now.getMonth() + 1 : 12;
          for (let mes = 1; mes <= mesAtual; mes++) {
            const ultimaCompraPorCliente = ultimaCompraAntesDe(todasComprasValidas, mes, ano);
            const orcMes = todasOrcAno.filter(o => o.mes === mes);

            const novosDoMes = calcularNovosDoMesLocal(mes, ano, todasOsAno, todasComprasValidas, overrideMap);

            // Clientes únicos e com recompra do mês inteiro (qualquer cliente, não só novos) —
            // mesmo critério de contarClientesUnicosDoMes, sem repetir a query ao banco.
            const osPorClienteMes: Record<string, number> = {};
            for (const os of todasOsAno.filter(o => o.mes === mes)) {
              if (!isOsNormalDb(os)) continue;
              const chave = normalizeEmpresaKey(os.empresa ?? "");
              if (!chave) continue;
              osPorClienteMes[chave] = (osPorClienteMes[chave] ?? 0) + 1;
            }
            const clientesUnicos = Object.keys(osPorClienteMes).length;
            const clientesComRecompra = Object.values(osPorClienteMes).filter(n => n >= 2).length;

            // Cotações de novos: orçamentos de clientes que não estavam no histórico
            let cotacoesNovos = 0;
            let valorOrcadoNovos = 0;
            for (const orc of orcMes) {
              const clienteKey = (orc.empresa ?? "").toLowerCase().trim();
              if (!clienteKey) continue;
              const overrideStatus = overrideMap.get(normalizeEmpresaKey(orc.empresa ?? ""));
              const isNovo = overrideStatus === "recorrente" ? false
                : overrideStatus === "novo" ? true
                : isClienteNovoPorRecencia(ultimaCompraPorCliente.get(clienteKey), mes, ano);
              if (isNovo) {
                cotacoesNovos++;
                valorOrcadoNovos += parseFloat(String(orc.total ?? "0")) || 0;
              }
            }
            const taxaConversaoNovos = cotacoesNovos > 0 ? parseFloat(((novosDoMes.osNovos / cotacoesNovos) * 100).toFixed(1)) : 0;
            const taxaFaturamentoNovos = valorOrcadoNovos > 0 ? parseFloat(((novosDoMes.faturamentoNovos / valorOrcadoNovos) * 100).toFixed(1)) : 0;
            novosMap.set(`${mes}_${ano}`, {
              osNovos: novosDoMes.osNovos,
              faturamentoNovos: novosDoMes.faturamentoNovos,
              faturamentoReativados: novosDoMes.faturamentoReativados,
              faturamentoNovosPuros: novosDoMes.faturamentoNovosPuros,
              clientesNovosUnicos: novosDoMes.clientesNovosUnicos,
              clientesReativados: novosDoMes.clientesReativados,
              clientesNovosPuros: novosDoMes.clientesNovosPuros,
              ticketMedioNovos: novosDoMes.ticketMedioNovos,
              cotacoesNovos, taxaConversaoNovos, taxaFaturamentoNovos,
              clientesUnicos, clientesComRecompra,
            });
          }
        }
      }

      // Pré-buscar snapshots congelados de todos os meses solicitados em uma única query
      const mesesSolicitados = input.meses;
      const snapsCongelados = db ? await db.select().from(performanceAuditada)
        .where(and(
          eq(performanceAuditada.congelado, true),
          sql`(${performanceAuditada.mes}, ${performanceAuditada.ano}) IN (${sql.join(
            mesesSolicitados.map(m => sql`(${m.mes}, ${m.ano})`),
            sql`, `
          )})`
        )) : [];
      const snapMap = new Map<string, typeof snapsCongelados[0]>();
      for (const s of snapsCongelados) snapMap.set(`${s.mes}_${s.ano}`, s);

      const results = await Promise.all(
        input.meses.map(async ({ mes, ano }) => {
          // ─── SNAPSHOT CONGELADO: retornar dados do banco imediatamente se congelado ───
          const snap = snapMap.get(`${mes}_${ano}`);
          if (snap) {
            const novos = novosMap.get(`${mes}_${ano}`);
            // Usar novosMap (banco local) para cotacoesNovos quando snapshot não tem (meses antigos)
            const cotacoesNovosSnap = (snap.cotacoesNovos ?? 0) > 0 ? (snap.cotacoesNovos ?? 0) : (novos?.cotacoesNovos ?? 0);
            const osNovosSnap = novos?.osNovos ?? snap.clientesNovos ?? 0;
            const taxaConvNovosSnap = parseFloat(String(snap.taxaConvNovos ?? 0)) > 0
              ? parseFloat(String(snap.taxaConvNovos ?? 0))
              : (cotacoesNovosSnap > 0 ? parseFloat(((osNovosSnap / cotacoesNovosSnap) * 100).toFixed(1)) : 0);
            return {
              mes, ano,
              label: `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][mes - 1]}/${String(ano).slice(2)}`,
              cotacoes: snap.cotacoes ?? 0,
              osGeradas: snap.osNormais ?? 0,
              taxaConversao: parseFloat(String(snap.taxaConversao ?? 0)),
              taxaFaturamento: snap.valorOrcado && parseFloat(String(snap.valorOrcado)) > 0
                ? parseFloat((parseFloat(String(snap.faturamento ?? 0)) / parseFloat(String(snap.valorOrcado)) * 100).toFixed(2))
                : 0,
              faturamento: parseFloat(String(snap.faturamento ?? 0)),
              valorOrcado: parseFloat(String(snap.valorOrcado ?? 0)),
              ticketMedio: snap.osNormais ? parseFloat(String(snap.faturamento ?? 0)) / snap.osNormais : 0,
              margemPct: 0, custo: 0, resultado: 0,
              clientesNovos: novos?.clientesNovosUnicos ?? snap.clientesNovos ?? 0,
              clientesReativados: novos?.clientesReativados ?? 0,
              // Expor como taxaConversaoNovos (nome usado pelo frontend) E taxaConvNovos (compat)
              taxaConvNovos: taxaConvNovosSnap,
              taxaConversaoNovos: taxaConvNovosSnap,
              faturamentoNovos: parseFloat(String(snap.faturamentoNovos ?? 0)),
              faturamentoReativados: novos?.faturamentoReativados ?? 0,
              faturamentoNovosPuros: novos?.faturamentoNovosPuros ?? 0,
              osNovos: osNovosSnap,
              ticketMedioNovos: novos?.ticketMedioNovos ?? 0,
              cotacoesNovos: cotacoesNovosSnap,
              taxaFaturamentoNovos: novos?.taxaFaturamentoNovos ?? 0,
              clientesUnicos: novos?.clientesUnicos ?? 0,
              clientesComRecompra: novos?.clientesComRecompra ?? 0,
              porVendedor: [], // array vazio para compatibilidade com EvolucaoVendedor
            };
          }
          // ───────────────────────────────────────────────────────────────────────

          let raw: any = null;

          // Usar API Mubisys para TODOS os meses (não apenas o atual)
          // Isso garante consistência entre histórico e dados em tempo real
          if (publicKey && accessToken) {
            try {
              // Timeout aumentado para 40s: buscar 555 orçamentos em 3 páginas (per_page=200) leva ~6-15s
              const timeoutPromise = new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), 40000)
              );
              raw = await Promise.race([getMesFromApi(mes, ano), timeoutPromise]);
            } catch {
              raw = null; // fallback para banco local
            }
          }
          const isMesAtualMulti = mes === now.getMonth() + 1 && ano === now.getFullYear();
          if (!raw) {
            // Fallback: usar dados já carregados em memória (banco local)
            const anoData = dbDataByAno.get(ano);
            if (!anoData && !isMesAtualMulti) return null;
            const osRows = (anoData?.os ?? []).filter(o => o.mes === mes);
            const orcRows = (anoData?.orc ?? []).filter(o => o.mes === mes);
            // Para o mês atual: retornar zeros em vez de null (dados em curso)
            if (osRows.length === 0 && orcRows.length === 0 && !isMesAtualMulti) return null;
            const osNormais = osRows.filter(os => {
              if (os.tipoOs === null || os.tipoOs === undefined) return false;
              const tipo = os.tipoOs;
              const status = (os.status ?? "").toLowerCase();
              if (tipo.toLowerCase().startsWith("retrabalho")) return false;
              if (tipo.toLowerCase() === "amostra" || tipo.toLowerCase() === "cortesia") return false;
              if (status === "cancelada") return false;
              return true;
            });
            const osPorVendedor: Record<string, { total: number; valor: number; custo: number; resultado: number }> = {};
            let totalValorOs = 0, totalCustoOs = 0, totalResultadoOs = 0;
            for (const os of osNormais) {
              const vendedor = os.vendedor || "Sem Vendedor";
              const valor = parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
              const custo = parseFloat(String(os.custosTotal ?? "0")) || 0;
              const resultado = parseFloat(String(os.resultadoReais ?? "0")) || 0;
              totalValorOs += valor; totalCustoOs += custo; totalResultadoOs += resultado;
              if (!osPorVendedor[vendedor]) osPorVendedor[vendedor] = { total: 0, valor: 0, custo: 0, resultado: 0 };
              osPorVendedor[vendedor].total++; osPorVendedor[vendedor].valor += valor;
              osPorVendedor[vendedor].custo += custo; osPorVendedor[vendedor].resultado += resultado;
            }
            const orcPorVendedor: Record<string, { total: number; valor: number }> = {};
            let totalValorOrc = 0;
            for (const orc of orcRows) {
              const vendedor = orc.vendedor || "Sem Vendedor";
              const valor = parseFloat(String(orc.total ?? "0")) || 0;
              totalValorOrc += valor;
              if (!orcPorVendedor[vendedor]) orcPorVendedor[vendedor] = { total: 0, valor: 0 };
              orcPorVendedor[vendedor].total++; orcPorVendedor[vendedor].valor += valor;
            }
            raw = {
              osNormais: { total: osNormais.length, valorTotal: totalValorOs, custo: totalCustoOs, resultado: totalResultadoOs, porVendedor: osPorVendedor },
              orcamentos: { total: orcRows.length, valorTotal: totalValorOrc, porVendedor: orcPorVendedor },
            };
          }
          // Para o mês atual sem dados no banco: montar raw com zeros
          if (!raw && isMesAtualMulti) {
            raw = {
              osNormais: { total: 0, valorTotal: 0, custo: 0, resultado: 0, porVendedor: {} },
              orcamentos: { total: 0, valorTotal: 0, porVendedor: {} },
            };
          }
          if (!raw) return null;

          // Enriquecer com dados de clientes novos do banco local
          const novos = novosMap.get(`${mes}_${ano}`) ?? {
            osNovos: 0, faturamentoNovos: 0, faturamentoReativados: 0, faturamentoNovosPuros: 0,
            clientesNovosUnicos: 0, clientesReativados: 0, clientesNovosPuros: 0,
            ticketMedioNovos: 0, cotacoesNovos: 0, taxaConversaoNovos: 0, taxaFaturamentoNovos: 0,
            clientesUnicos: 0, clientesComRecompra: 0,
          };
          return {
            ...calcMetrics(raw.osNormais, raw.orcamentos, mes, ano),
            ...novos,
            // clientesUnicos/clientesComRecompra do mês inteiro vêm sempre do banco local
            // (novos), nunca do cálculo ao vivo em calcMetrics — mesma fonte usada pelas
            // demais métricas de "novos" nesta função, evita o mês ficar inconsistente
            // dependendo de qual branch (API/local) respondeu primeiro.
            clientesNovos: novos.clientesNovosUnicos,
          };
        })
      );

      return results.filter(Boolean);
    }),

  // ─── Metas por vendedor ────────────────────────────────────────────────────

  getMetas: publicProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(metasComerciais)
        .where(and(eq(metasComerciais.mes, input.mes), eq(metasComerciais.ano, input.ano)));
    }),

  upsertMeta: protectedProcedure
    .input(z.object({
      vendedor: z.string().min(1),
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020),
      metaCotacoes: z.number().nullable().optional(),
      metaVendas: z.number().nullable().optional(),
      metaFaturamento: z.number().nullable().optional(),
      metaConversao: z.number().nullable().optional(),
      metaTicketMedio: z.number().nullable().optional(),
      // Novos campos
      metaOsGeradas: z.number().nullable().optional(),
      metaClientesNovos: z.number().nullable().optional(),
      metaOsNovos: z.number().nullable().optional(),
      metaCotacoesNovos: z.number().nullable().optional(),
      metaFaturamentoNovos: z.number().nullable().optional(),
      metaTaxaFaturamento: z.number().nullable().optional(),
      metaTaxaFaturamentoNovos: z.number().nullable().optional(),
      metaConversaoNovos: z.number().nullable().optional(),
      metaTicketMedioNovos: z.number().nullable().optional(),
      metaValorOrcado: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");

      const toStr = (v: number | null | undefined) => v != null ? String(v) : null;

      const setData = {
        metaCotacoes: input.metaCotacoes ?? null,
        metaVendas: input.metaVendas ?? null,
        metaFaturamento: toStr(input.metaFaturamento),
        metaConversao: toStr(input.metaConversao),
        metaTicketMedio: toStr(input.metaTicketMedio),
        metaOsGeradas: input.metaOsGeradas ?? null,
        metaClientesNovos: input.metaClientesNovos ?? null,
        metaOsNovos: input.metaOsNovos ?? null,
        metaCotacoesNovos: input.metaCotacoesNovos ?? null,
        metaFaturamentoNovos: toStr(input.metaFaturamentoNovos),
        metaTaxaFaturamento: toStr(input.metaTaxaFaturamento),
        metaTaxaFaturamentoNovos: toStr(input.metaTaxaFaturamentoNovos),
        metaConversaoNovos: toStr(input.metaConversaoNovos),
        metaTicketMedioNovos: toStr(input.metaTicketMedioNovos),
        metaValorOrcado: toStr(input.metaValorOrcado),
        updatedAt: new Date(),
      };

      const existing = await db.select().from(metasComerciais)
        .where(and(
          eq(metasComerciais.vendedor, input.vendedor),
          eq(metasComerciais.mes, input.mes),
          eq(metasComerciais.ano, input.ano),
        ));

      if (existing.length > 0) {
        await db.update(metasComerciais).set(setData)
          .where(and(
            eq(metasComerciais.vendedor, input.vendedor),
            eq(metasComerciais.mes, input.mes),
            eq(metasComerciais.ano, input.ano),
          ));
      } else {
        await db.insert(metasComerciais).values({
          vendedor: input.vendedor,
          mes: input.mes,
          ano: input.ano,
          ...setData,
        });
      }
      return { ok: true };
    }),

  deleteMeta: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");
      await db.delete(metasComerciais).where(eq(metasComerciais.id, input.id));
      return { ok: true };
    }),

  // Todos os meses de um ano para comparativo anual
  getAno: publicProcedure
    .input(z.object({ ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      const { ano } = input;
      const publicKey = ENV.MUBISYS_PUBLIC_KEY;
      const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
      const db = await getDb();

      // Buscar TODOS os dados do ano em uma única query (muito mais rápido)
      const todasOsAno = db ? await db.select().from(historicoOs).where(eq(historicoOs.ano, ano)) : [];
      const todosOrcAno = db ? await db.select().from(historicoOrcamentos).where(eq(historicoOrcamentos.ano, ano)) : [];

      // Pré-buscar snapshots congelados do ano inteiro em uma única query — meses
      // já auditados/congelados nunca precisam bater na API MubiSys (mesmo padrão
      // de getMes/getMultiMes). Sem isso, getAno reconsultava os 12 meses na API
      // a cada expiração do TTL de 6h, mesmo para meses já congelados.
      const snapsCongeladosAno = db ? await db.select().from(performanceAuditada)
        .where(and(eq(performanceAuditada.ano, ano), eq(performanceAuditada.congelado, true))) : [];
      const snapMapAno = new Map<number, typeof snapsCongeladosAno[0]>();
      for (const s of snapsCongeladosAno) snapMapAno.set(s.mes, s);
      const MESES_NOMES_ANO = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

      const meses = Array.from({ length: 12 }, (_, i) => i + 1);
      // Usar API Mubisys para os meses não-congelados (não só o atual) — mesmo
      // padrão de getMes/getMultiMes, para os números baterem entre telas.
      //
      // Todos os meses em paralelo (Promise.all), igual getMultiMes — não em
      // lotes sequenciais de 2. Testado em 20/08/2026 chamando a API
      // diretamente: uma requisição isolada pode responder em ~26s, mas a
      // mesma requisição, em outra tentativa, dá timeout completo aos 45s —
      // é flakiness real da API (não gargalo de concorrência: 1, 2 ou 8
      // chamadas simultâneas se comportam igual). Não dá pra garantir que
      // TODOS os meses respondam via API dentro do orçamento de tempo, então
      // o desenho certo é: tentar todos em paralelo (não somar timeouts em
      // série — isso é o que estourava o maxDuration:60s do vercel.json,
      // matando a função inteira antes de qualquer fallback rodar, e
      // aparecia no front como "Sem dados para o período" mesmo com os
      // meses já sincronizados no banco local) e aceitar o fallback local
      // para quem não respondeu a tempo. Pior caso ~45s, dentro do limite.
      const results: any[] = await Promise.all(meses.map(async (mes) => {
          // ─── SNAPSHOT CONGELADO: retornar do banco imediatamente, sem tocar a API ───
          const snap = snapMapAno.get(mes);
          if (snap) {
            const valorOrcadoSnap = parseFloat(String(snap.valorOrcado ?? 0));
            const faturamentoSnap = parseFloat(String(snap.faturamento ?? 0));
            const osGeradasSnap = snap.osNormais ?? 0;
            return {
              label: `${MESES_NOMES_ANO[mes - 1]}/${String(ano).slice(2)}`,
              mes, ano,
              cotacoes: snap.cotacoes ?? 0,
              osGeradas: osGeradasSnap,
              valorOrcado: valorOrcadoSnap,
              faturamento: faturamentoSnap,
              custo: 0,
              resultado: 0,
              taxaConversao: parseFloat(String(snap.taxaConversao ?? 0)),
              taxaFaturamento: valorOrcadoSnap > 0 ? parseFloat(((faturamentoSnap / valorOrcadoSnap) * 100).toFixed(2)) : 0,
              ticketMedio: osGeradasSnap > 0 ? parseFloat((faturamentoSnap / osGeradasSnap).toFixed(2)) : 0,
              margemPct: 0,
              porVendedor: [],
            };
          }
          // ───────────────────────────────────────────────────────────────────────
          let raw: any = null;
          if (publicKey && accessToken) {
            try {
              // 45s — mesmo teto usado em listarOSMubiSys/TIMEOUT_LISTA_MS.
              // Cada mês corre em paralelo com os outros 11, então esse
              // timeout não se acumula: o pior caso do getAno inteiro é
              // ~45s, com folga dentro do maxDuration:60s do vercel.json.
              const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 45000));
              raw = await Promise.race([getMesFromApi(mes, ano), timeoutPromise]);
            } catch {
              raw = null;
            }
          }
          // A API MubiSys às vezes responde "com sucesso" mas vazia de forma
          // transitória (não é timeout, não cai no catch acima). Pra um mês
          // que não é o atual, zero OS e zero orçamentos ao mesmo tempo é
          // implausível se já existe sync local — nesse caso, tratar como se
          // a API não tivesse respondido e cair no fallback local abaixo.
          if (raw && !isMesAtual(mes, ano) && raw.osNormais?.total === 0 && raw.orcamentos?.total === 0) {
            raw = null;
          }
          if (!raw) {
            // Usar dados já carregados em memória (sem nova query ao banco)
            const osRows = todasOsAno.filter(o => o.mes === mes);
            const orcRows = todosOrcAno.filter(o => o.mes === mes);
            if (osRows.length === 0 && orcRows.length === 0) return null;
            const osNormais = osRows.filter(os => {
              if (os.tipoOs === null || os.tipoOs === undefined) return false;
              const tipo = os.tipoOs;
              const status = (os.status ?? "").toLowerCase();
              if (tipo.toLowerCase().startsWith("retrabalho")) return false;
              if (tipo.toLowerCase() === "amostra") return false;
              if (tipo.toLowerCase() === "cortesia") return false;
              if (status === "cancelada") return false;
              return true;
            });
            const osPorVendedor: Record<string, { total: number; valor: number; custo: number; resultado: number }> = {};
            let totalValorOs = 0, totalCustoOs = 0, totalResultadoOs = 0;
            for (const os of osNormais) {
              const vendedor = os.vendedor || "Sem Vendedor";
              const valor = parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
              const custo = parseFloat(String(os.custosTotal ?? "0")) || 0;
              const resultado = parseFloat(String(os.resultadoReais ?? "0")) || 0;
              totalValorOs += valor; totalCustoOs += custo; totalResultadoOs += resultado;
              if (!osPorVendedor[vendedor]) osPorVendedor[vendedor] = { total: 0, valor: 0, custo: 0, resultado: 0 };
              osPorVendedor[vendedor].total++; osPorVendedor[vendedor].valor += valor;
              osPorVendedor[vendedor].custo += custo; osPorVendedor[vendedor].resultado += resultado;
            }
            const orcPorVendedor: Record<string, { total: number; valor: number }> = {};
            let totalValorOrc = 0;
            for (const orc of orcRows) {
              const vendedor = orc.vendedor || "Sem Vendedor";
              const valor = parseFloat(String(orc.total ?? "0")) || 0;
              totalValorOrc += valor;
              if (!orcPorVendedor[vendedor]) orcPorVendedor[vendedor] = { total: 0, valor: 0 };
              orcPorVendedor[vendedor].total++; orcPorVendedor[vendedor].valor += valor;
            }
            raw = {
              osNormais: { total: osNormais.length, valorTotal: totalValorOs, custo: totalCustoOs, resultado: totalResultadoOs, porVendedor: osPorVendedor },
              orcamentos: { total: orcRows.length, valorTotal: totalValorOrc, porVendedor: orcPorVendedor },
            };
          }
          if (!raw) return null;
          return calcMetrics(raw.osNormais, raw.orcamentos, mes, ano);
      }));
      return results; // array de 12, null para meses sem dados
    }),

  // Clientes novos do mês (primeira compra)
  getClientesNovos: protectedProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020), forceRefresh: z.boolean().optional().default(false) }))
    .query(async ({ input }) => {
      return getClientesNovosMes(input.mes, input.ano, input.forceRefresh);
    }),

  // Clientes novos de todos os meses do ano (para gráfico anual) — lê do histórico local
  getClientesNovosAno: publicProcedure
    .input(z.object({ ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      const { ano } = input;
      const now = new Date();
      const mesAtual = ano === now.getFullYear() ? now.getMonth() + 1 : 12;
      const meses = Array.from({ length: mesAtual }, (_, i) => i + 1);

      const db = await getDb();
      if (!db) {
        return meses.map(mes => ({
          mes, ticketMedioNovos: 0, osNovos: 0, faturamentoNovos: 0, faturamentoReativados: 0, faturamentoNovosPuros: 0,
          clientesNovosUnicos: 0, clientesReativados: 0, clientesNovosPuros: 0, origem: "indisponivel" as const,
        }));
      }

      // Meses auditados/congelados: manter o caminho existente — getClientesNovosMes já
      // retorna do snapshot salvo em performanceAuditada, sem chamar a API ao vivo.
      const snapsCongelados = await db.select({ mes: performanceAuditada.mes }).from(performanceAuditada)
        .where(and(eq(performanceAuditada.ano, ano), eq(performanceAuditada.congelado, true)));
      const congeladosSet = new Set(snapsCongelados.map(s => s.mes));

      // Demais meses: calcular 100% do histórico local (historico_os), sem tocar a API
      // MubiSys ao vivo — ver calcularNovosDoMesLocal. historico_os sincroniza 1x/dia
      // (server/sync/scheduled-sync-historico.ts), então o mês corrente pode ficar até
      // ~1 dia defasado; meses fechados não têm essa limitação.
      const overrides = await db.select().from(clienteOverrides);
      const overrideMap = new Map<string, "recorrente" | "novo">();
      for (const ov of overrides) overrideMap.set(ov.empresa, ov.status);

      const todasComprasValidas = await buscarTodasComprasValidas(db);
      const osDoAno = await db.select({
        empresa: historicoOs.empresa,
        tipoOs: historicoOs.tipoOs,
        status: historicoOs.status,
        mes: historicoOs.mes,
        valorOs: historicoOs.valorOs,
        valorTotal: historicoOs.valorTotal,
      }).from(historicoOs).where(eq(historicoOs.ano, ano));

      const results = await Promise.all(meses.map(async (mes) => {
        if (congeladosSet.has(mes)) {
          const dados = await getClientesNovosMes(mes, ano);
          return {
            mes,
            ticketMedioNovos: dados.ticketMedioNovos,
            osNovos: dados.osNovos,
            faturamentoNovos: dados.faturamentoNovos,
            faturamentoReativados: dados.faturamentoReativados,
            faturamentoNovosPuros: dados.faturamentoNovosPuros,
            clientesNovosUnicos: dados.total,
            clientesReativados: dados.totalReativados,
            clientesNovosPuros: dados.totalPuros,
            origem: "congelado" as const,
          };
        }
        return { ...calcularNovosDoMesLocal(mes, ano, osDoAno, todasComprasValidas, overrideMap), origem: "local" as const };
      }));

      results.sort((a, b) => a.mes - b.mes);
      return results;
    }),

  // Evolucao diaria do mes vigente por vendedor
  getEvolucaoDiariaMes: publicProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      const { mes, ano } = input;
      const publicKey = ENV.MUBISYS_PUBLIC_KEY;
      const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
      if (!publicKey || !accessToken) return { dias: [], vendedores: [] };

      // Reutilizar cache de OS brutas do mês (já populado pelo getMes)
      const osCacheKey = `os_raw_${mes}_${ano}`;
      const orcCacheKey = `orc_raw_${mes}_${ano}`;
      let allOs = getCached(osCacheKey) as any[] | null;
      let allOrc = getCached(orcCacheKey) as any[] | null;

      if (!allOs || !allOrc) {
        const pad = (n: number) => String(n).padStart(2, "0");
        const lastDay = new Date(ano, mes, 0).getDate();
        const datainicial = `${ano}-${pad(mes)}-01`;
        const datafinal = `${ano}-${pad(mes)}-${pad(lastDay)}`;
        try {
          // Timeout de 45s: este procedure roda no mesmo lote HTTP batched de
          // getMes (maxDuration:60s do vercel.json), precisa desistir antes disso.
          const [osResult, orcResult] = await withTimeout(
            Promise.all([
              listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial, datafinal }),
              listarOrcamentosMubiSys({ status: "TODOS", datainicial, datafinal }),
            ]),
            45000,
            "timeout_evolucao_diaria"
          );
          allOs = osResult.itens;
          allOrc = orcResult.itens;
          setCacheWithTTL(osCacheKey, allOs, mes, ano);
          setCacheWithTTL(orcCacheKey, allOrc, mes, ano);
        } catch {
          // API lenta/indisponível: devolver vazio em vez de travar o lote inteiro
          return { dias: [], vendedores: [] };
        }
      }

      const osNormais = (allOs as any[]).filter(isOsNormalApi);
      // NÃO filtrar por versao === versao_atual: a API já retorna apenas a versão atual por padrão
      // Filtrar causaria descarte de orçamentos sem os campos versao/versao_atual preenchidos (null/undefined)
      // REGRA: excluir cotações canceladas/excluídas (não entram na taxa de conversão)
      const STATUS_EXCLUIDOS_ORC_DIARIO = ["cancelada", "cancelado", "excluída", "excluído", "excluida", "excluido"];
      const orcVersaoAtual = (allOrc as any[]).filter((orc: any) =>
        !STATUS_EXCLUIDOS_ORC_DIARIO.includes((orc.status ?? "").toLowerCase())
      );

      // Agrupar OS por dia de aprovação
      const osPorDia: Record<string, Record<string, { os: number; faturamento: number }>> = {};
      for (const os of osNormais) {
        const dataAprov = (os.data_aprovacao || os.data_cadastro || "").substring(0, 10);
        if (!dataAprov) continue;
        const vendedor = os.vendedor || "Sem Vendedor";
        const valor = valorLiquidoOs(os);
        if (!osPorDia[dataAprov]) osPorDia[dataAprov] = {};
        if (!osPorDia[dataAprov][vendedor]) osPorDia[dataAprov][vendedor] = { os: 0, faturamento: 0 };
        osPorDia[dataAprov][vendedor].os++;
        osPorDia[dataAprov][vendedor].faturamento += valor;
      }

      // Agrupar cotações por dia de cadastro
      const orcPorDia: Record<string, Record<string, { cotacoes: number; valorOrcado: number }>> = {};
      for (const orc of orcVersaoAtual) {
        const dataCad = (orc.data_cadastro || "").substring(0, 10);
        if (!dataCad) continue;
        const vendedor = orc.vendedor || "Sem Vendedor";
        const vt = parseFloat(String(orc.valor_total ?? "0")) || 0;
        const vc = parseFloat(String(orc.valor_custo ?? "0")) || 0;
        const vm = parseFloat(String(orc.valor_margem ?? "0")) || 0;
        const valor = vt > 0 ? vt : (vc + vm);
        if (!orcPorDia[dataCad]) orcPorDia[dataCad] = {};
        if (!orcPorDia[dataCad][vendedor]) orcPorDia[dataCad][vendedor] = { cotacoes: 0, valorOrcado: 0 };
        orcPorDia[dataCad][vendedor].cotacoes++;
        orcPorDia[dataCad][vendedor].valorOrcado += valor;
      }

      // Montar array de dias do mês com dados diários e acumulados por vendedor
      const pad = (n: number) => String(n).padStart(2, "0");
      const lastDay = new Date(ano, mes, 0).getDate();
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

      const acumOs: Record<string, number> = {};
      const acumFat: Record<string, number> = {};
      const acumCot: Record<string, number> = {};
      const acumOrc: Record<string, number> = {};
      const dias: any[] = [];

      for (let d = 1; d <= lastDay; d++) {
        const dStr = `${ano}-${pad(mes)}-${pad(d)}`;
        if (dStr > todayStr) break;
        const label = `${pad(d)}/${pad(mes)}`;
        const osHoje = osPorDia[dStr] ?? {};
        const orcHoje = orcPorDia[dStr] ?? {};
        const todosVend = new Set([...Object.keys(osHoje), ...Object.keys(orcHoje)]);
        for (const v of todosVend) {
          acumOs[v] = (acumOs[v] ?? 0) + (osHoje[v]?.os ?? 0);
          acumFat[v] = (acumFat[v] ?? 0) + (osHoje[v]?.faturamento ?? 0);
          acumCot[v] = (acumCot[v] ?? 0) + (orcHoje[v]?.cotacoes ?? 0);
          acumOrc[v] = (acumOrc[v] ?? 0) + (orcHoje[v]?.valorOrcado ?? 0);
        }
        const ponto: Record<string, any> = { dia: d, label, data: dStr };
        // Diário
        for (const v of todosVend) {
          ponto[`${v}__os`] = osHoje[v]?.os ?? 0;
          ponto[`${v}__fat`] = parseFloat((osHoje[v]?.faturamento ?? 0).toFixed(2));
          ponto[`${v}__cot`] = orcHoje[v]?.cotacoes ?? 0;
          ponto[`${v}__orc`] = parseFloat((orcHoje[v]?.valorOrcado ?? 0).toFixed(2));
        }
        // Acumulado
        for (const v of Object.keys(acumOs)) {
          ponto[`${v}__os_ac`] = acumOs[v];
          ponto[`${v}__fat_ac`] = parseFloat(acumFat[v].toFixed(2));
        }
        for (const v of Object.keys(acumCot)) {
          ponto[`${v}__cot_ac`] = acumCot[v];
          ponto[`${v}__orc_ac`] = parseFloat(acumOrc[v].toFixed(2));
        }
        dias.push(ponto);
      }

      const vendedores = Array.from(new Set([
        ...Object.keys(acumOs),
        ...Object.keys(acumCot),
      ])).filter(v => v !== "Sem Vendedor").sort();

      return { dias, vendedores };
    }),

  // ─── Overrides manuais de status de cliente ────────────────────────────────

  listClienteOverrides: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(clienteOverrides).orderBy(clienteOverrides.empresaOriginal);
  }),

  upsertClienteOverride: protectedProcedure
    .input(z.object({
      empresaOriginal: z.string().min(1),
      status: z.enum(["recorrente", "novo"]),
      motivo: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");
      const empresaNorm = input.empresaOriginal
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
      await db
        .insert(clienteOverrides)
        .values({
          empresa: empresaNorm,
          empresaOriginal: input.empresaOriginal,
          status: input.status,
          motivo: input.motivo ?? null,
          criadoPor: ctx.user.name ?? ctx.user.email ?? "desconhecido",
        })
        .onConflictDoUpdate({
          target: clienteOverrides.empresa,
          set: {
            status: input.status,
            motivo: input.motivo ?? null,
            criadoPor: ctx.user.name ?? ctx.user.email ?? "desconhecido",
          },
        });
      return { ok: true };
    }),

  deleteClienteOverride: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");
      await db.delete(clienteOverrides).where(eq(clienteOverrides.id, input.id));
      return { ok: true };
    }),

  // ─── Inteligência de Clientes ─────────────────────────────────────────────
  // Reescrito em setembro/2026 (ver docs/inteligencia-clientes.md) — calcula tudo
  // localmente a partir de historico_os (nunca mais a API MubiSys ao vivo), por isso
  // não há mais congelamento: o cálculo é determinístico e rápido, não muda entre uma
  // consulta e outra a não ser que o histórico local seja reimportado.

  getVisaoGeralClientes: publicProcedure
    .input(z.object({
      dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const rows = await db.select().from(historicoOs);
      const base = construirBaseClientes(rows as any);
      const dataRef = new Date();
      const visaoGeral = calcularVisaoGeral(base, new Date(input.dataInicial), new Date(`${input.dataFinal}T23:59:59`), dataRef);
      return { visaoGeral, dicionarioMetricas: DICIONARIO_METRICAS };
    }),

  listarClientesInteligencia: publicProcedure
    .input(z.object({
      dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const rows = await db.select().from(historicoOs);
      const base = construirBaseClientes(rows as any);
      const dataRef = new Date();
      const dataInicial = new Date(input.dataInicial);
      const dataFinal = new Date(`${input.dataFinal}T23:59:59`);
      const clientes: AnaliseCliente[] = [];
      for (const cliente of base.values()) {
        const comprasNoPeriodo = cliente.compras.filter(c => c.data >= dataInicial && c.data <= dataFinal);
        if (comprasNoPeriodo.length === 0) continue;
        const analise = analisarCliente(cliente, dataRef, dataInicial, dataFinal);
        if (analise) clientes.push(analise);
      }
      // Ordenação padrão: prioriza quem precisa de atenção (atraso/redução) antes de quem está bem
      const ordemClassificacao: Record<string, number> = {
        intervalo_acima_habitual: 0,
        reducao_volume: 1,
        historico_insuficiente: 2,
        primeira_compra: 3,
        recompra_observada: 4,
        em_crescimento: 5,
      };
      clientes.sort((a, b) => (ordemClassificacao[a.classificacao] ?? 9) - (ordemClassificacao[b.classificacao] ?? 9) || b.valorJanelaAtual - a.valorJanelaAtual);

      // Score de Probabilidade de Compra (Fase 1) — mesma fórmula/base do CRM
      // (server/routers/crm.ts), sem o ajuste por proposta específica (não há
      // uma proposta em aberto associada a este card, só o perfil do cliente).
      try {
        const mapaConversao = await construirMapaConversaoClientes(db);
        return clientes.map(c => {
          const { probabilidade, explicacao } = calcularProbabilidade({
            clienteNovo: false, // esta tela só lista quem já comprou — nunca é "cliente novo"
            nomeCliente: c.empresaExibicao,
            valorProposta: 0, // sem proposta específica aqui — sem ajuste por valor
            mapa: mapaConversao,
            taxaNovosDoMes: 0,
          });
          return { ...c, probabilidadeCompra: probabilidade, probabilidadeExplicacao: explicacao };
        });
      } catch {
        return clientes.map(c => ({ ...c, probabilidadeCompra: null as number | null, probabilidadeExplicacao: [] as string[] }));
      }
    }),

  getFichaCliente: publicProcedure
    .input(z.object({ empresaKey: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const rows = await db.select().from(historicoOs);
      const base = construirBaseClientes(rows as any);
      const cliente = base.get(input.empresaKey);
      if (!cliente) return null;
      const dataRef = new Date();
      // Ficha usa o histórico completo como "período" para a análise (comparação de
      // janelas usa os últimos 12 meses vs. os 12 meses anteriores, mais estável para
      // uma ficha individual do que o período curto escolhido na visão geral).
      const dataFinal = dataRef;
      const dataInicial = new Date(dataRef);
      dataInicial.setFullYear(dataInicial.getFullYear() - 1);
      const analise = analisarCliente(cliente, dataRef, dataInicial, dataFinal);
      return {
        empresaKey: cliente.empresaKey,
        empresaExibicao: cliente.empresaExibicao,
        historico: cliente.compras.map(c => ({
          osNumero: c.osNumero,
          data: c.data.toISOString(),
          valor: c.valor,
          custo: c.custo,
          contribuicao: c.contribuicao,
          vendedor: c.vendedor,
          cidade: c.cidade,
          estado: c.estado,
          trabalho: c.trabalho,
        })),
        analise,
      };
    }),

  getFilaAcoesClientes: publicProcedure
    .input(z.object({
      status: z.enum(["pendente", "concluida", "adiada", "descartada"]).optional(),
      responsavel: z.string().optional(),
      vendedor: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await sincronizarFilaAcoesClientes(db);

      const filtros = [] as any[];
      if (input.status) filtros.push(eq(inteligenciaAcoesClientes.status, input.status));
      if (input.responsavel) filtros.push(eq(inteligenciaAcoesClientes.responsavel, input.responsavel));
      if (input.vendedor) filtros.push(eq(inteligenciaAcoesClientes.vendedor, input.vendedor));
      const fila = await db.select().from(inteligenciaAcoesClientes)
        .where(filtros.length > 0 ? and(...filtros) : undefined)
        .orderBy(desc(inteligenciaAcoesClientes.prioridade));
      return fila.map(a => ({
        ...a,
        evidencia: JSON.parse(a.evidenciaJson),
        prioridadeFatores: a.prioridadeFatoresJson ? JSON.parse(a.prioridadeFatoresJson) : null,
      }));
    }),

  /** Lista de vendedores distintos já presentes na fila — para popular o filtro. */
  getVendedoresFilaAcoes: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    const rows = await db.selectDistinct({ vendedor: inteligenciaAcoesClientes.vendedor }).from(inteligenciaAcoesClientes);
    return rows.map(r => r.vendedor).filter((v): v is string => !!v).sort();
  }),

  /** Gera um PDF (texto, paginado) da fila de ações filtrada — mesmo padrão de
   * server/routers/logistica.ts::romaneioPdf (jsPDF no servidor, retorna base64). */
  gerarFilaAcoesPdf: publicProcedure
    .input(z.object({
      status: z.enum(["pendente", "concluida", "adiada", "descartada"]).optional(),
      vendedor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await sincronizarFilaAcoesClientes(db);

      const filtros = [] as any[];
      if (input.status) filtros.push(eq(inteligenciaAcoesClientes.status, input.status));
      if (input.vendedor) filtros.push(eq(inteligenciaAcoesClientes.vendedor, input.vendedor));
      const fila = await db.select().from(inteligenciaAcoesClientes)
        .where(filtros.length > 0 ? and(...filtros) : undefined)
        .orderBy(desc(inteligenciaAcoesClientes.prioridade));

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margem = 40;
      const limiteY = 800;
      let y = 48;
      const escreve = (texto: string, negrito = false, tamanho = 9) => {
        const linhas = doc.splitTextToSize(texto, 515);
        for (const linha of linhas) {
          if (y > limiteY) { doc.addPage(); y = 48; }
          doc.setFont("helvetica", negrito ? "bold" : "normal");
          doc.setFontSize(tamanho);
          doc.text(linha, margem, y);
          y += tamanho + 4;
        }
      };

      const tituloTipo: Record<string, string> = {
        primeira_sem_segunda: "1ª compra sem repetição",
        atraso_recompra: "Atraso na recompra",
        alto_volume_baixa_margem: "Alto volume, margem baixa",
      };

      escreve("Fila de Ações — Inteligência de Clientes", true, 14);
      escreve(`Filtros: status=${input.status ?? "todos"} · vendedor=${input.vendedor ?? "todos"}`);
      escreve(`Total de ações: ${fila.length} · Emitido em ${new Date().toLocaleString("pt-BR")}`);
      y += 8;

      for (const a of fila) {
        escreve(`${a.empresa}  —  ${tituloTipo[a.tipo] ?? a.tipo}`, true, 11);
        escreve(`Vendedor: ${a.vendedor ?? "—"}   |   Prioridade: ${a.prioridade}   |   Status: ${a.status}`);
        escreve(a.motivo);
        if (a.proximoPasso) escreve(`Próximo passo: ${a.proximoPasso}`);
        if (a.resultado) escreve(`Resultado: ${a.resultado}${a.resultadoObservacao ? " — " + a.resultadoObservacao : ""}`);
        y += 6;
      }

      const pdfBase64 = doc.output("datauristring").split(",")[1];
      return {
        pdfBase64,
        fileName: `fila-acoes-clientes-${new Date().toISOString().slice(0, 10)}.pdf`,
        totalAcoes: fila.length,
      };
    }),

  atualizarAcaoCliente: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["pendente", "concluida", "adiada", "descartada"]).optional(),
      responsavel: z.string().nullable().optional(),
      proximoPasso: z.string().nullable().optional(),
      prazo: z.string().nullable().optional(), // YYYY-MM-DD
      resultado: z.enum(["contato_realizado", "sem_resposta", "projeto_futuro", "orcamento_solicitado", "compra", "adiamento", "sem_interesse"]).nullable().optional(),
      resultadoObservacao: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const { id, ...campos } = input;
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (campos.status !== undefined) {
        set.status = campos.status;
        set.resolvidoEm = (campos.status === "concluida" || campos.status === "descartada") ? new Date() : null;
      }
      if (campos.responsavel !== undefined) set.responsavel = campos.responsavel;
      if (campos.proximoPasso !== undefined) set.proximoPasso = campos.proximoPasso;
      if (campos.prazo !== undefined) set.prazo = campos.prazo;
      if (campos.resultado !== undefined) set.resultado = campos.resultado;
      if (campos.resultadoObservacao !== undefined) set.resultadoObservacao = campos.resultadoObservacao;
      await db.update(inteligenciaAcoesClientes).set(set).where(eq(inteligenciaAcoesClientes.id, id));
      return { ok: true };
    }),

  // ─── Inteligência de Clientes — acesso ao painel e confirmação de contato ──
  // Pedido do gestor (13/09/2026): saber se a equipe está de fato usando a aba
  // "Clientes" e permitir que cada vendedor confirme contato com um cliente
  // listado, com observação livre (ver drizzle/schema.ts para o porquê de
  // tabelas dedicadas em vez de reaproveitar crm_atividade_log/crm_contatos).

  /** Registra um acesso à aba "Clientes" — chamado uma vez por montagem do
   * componente no front. Silencioso o suficiente para não travar a tela por
   * causa disso: falhas aqui não devem impedir o uso do painel. */
  registrarAcessoInteligenciaClientes: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      await db.insert(inteligenciaClientesAcessos).values({
        userId: ctx.user.id,
        userName: ctx.user.name,
      });
      return { ok: true };
    }),

  /** Para o gestor: quem da equipe acessou a aba nos últimos `dias` dias,
   * quantas vezes e quando foi a última. */
  getAcessosInteligenciaClientes: gestorProcedure
    .input(z.object({ dias: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const desde = new Date(Date.now() - input.dias * 86400000);
      const rows = await db.select().from(inteligenciaClientesAcessos)
        .where(gte(inteligenciaClientesAcessos.acessadoEm, desde))
        .orderBy(desc(inteligenciaClientesAcessos.acessadoEm));
      const porUsuario = new Map<string, { userId: string; userName: string; qtdAcessos: number; ultimoAcesso: Date }>();
      for (const r of rows) {
        const atual = porUsuario.get(r.userId);
        if (!atual) {
          porUsuario.set(r.userId, { userId: r.userId, userName: r.userName, qtdAcessos: 1, ultimoAcesso: r.acessadoEm });
        } else {
          atual.qtdAcessos++;
        }
      }
      return [...porUsuario.values()].sort((a, b) => b.ultimoAcesso.getTime() - a.ultimoAcesso.getTime());
    }),

  /** Vendedor confirma que entrou em contato com um cliente da lista, com
   * observação livre opcional — fica visível para o gestor em getContatosClientes. */
  registrarContatoCliente: protectedProcedure
    .input(z.object({
      empresaKey: z.string().min(1),
      empresa: z.string().min(1),
      observacao: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.insert(inteligenciaClientesContatos).values({
        empresaKey: input.empresaKey,
        empresa: input.empresa,
        userId: ctx.user.id,
        vendedor: ctx.user.name,
        observacao: input.observacao || null,
      });
      return { ok: true };
    }),

  /** Lista confirmações de contato — sem filtro, dá a ficha de um cliente
   * (histórico); com filtro de vendedor/dias, dá a visão do gestor sobre a
   * equipe toda. */
  getContatosClientes: protectedProcedure
    .input(z.object({
      empresaKey: z.string().optional(),
      vendedor: z.string().optional(),
      dias: z.number().int().min(1).max(365).optional(),
      limite: z.number().int().min(1).max(500).default(200),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const filtros = [] as any[];
      if (input.empresaKey) filtros.push(eq(inteligenciaClientesContatos.empresaKey, input.empresaKey));
      if (input.vendedor) filtros.push(eq(inteligenciaClientesContatos.vendedor, input.vendedor));
      if (input.dias) filtros.push(gte(inteligenciaClientesContatos.contatadoEm, new Date(Date.now() - input.dias * 86400000)));
      return db.select().from(inteligenciaClientesContatos)
        .where(filtros.length > 0 ? and(...filtros) : undefined)
        .orderBy(desc(inteligenciaClientesContatos.contatadoEm))
        .limit(input.limite);
    }),

  // ─── Funil de Orçamentos (analítico, histórico local — complementa o CRM operacional
  // em server/routers/crm.ts, que busca orçamentos ao vivo na API MubiSys) ────────────

  getFunilOrcamentos: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const rows = await db.select().from(historicoOrcamentos);
      return calcularFunilOrcamentos(rows as any, new Date());
    }),

  /** Conversão por faixa de valor do orçamento — quanto maior o tíquete,
   * menor a taxa histórica de fechamento. Mesmo cálculo usado como fator no
   * Score de Probabilidade de Compra (ver construirMapaFaixaTicket). */
  getConversaoPorFaixaTicket: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const rows = await db.select({
        status: historicoOrcamentos.status,
        total: historicoOrcamentos.total,
        dataCadastro: historicoOrcamentos.dataCadastro,
        validade: historicoOrcamentos.validade,
      }).from(historicoOrcamentos);
      return calcularConversaoPorFaixaTicket(rows as any, new Date());
    }),

  /** Tempo entre orçamento aprovado e pedido fechado — aproximação por
   * pareamento heurístico (ver aviso em calcularTempoOrcamentoPedido), usada
   * para calibrar o prazo ideal de follow-up. */
  getTempoOrcamentoPedido: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [orcRows, osRows] = await Promise.all([
        db.select().from(historicoOrcamentos),
        db.select().from(historicoOs),
      ]);
      return calcularTempoOrcamentoPedido(orcRows as any, osRows as any);
    }),

  // ─── Previsões 30/60/90 dias ──────────────────────────────────────────────────

  getPrevisaoComercial: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [osRows, orcRows] = await Promise.all([
        db.select().from(historicoOs),
        db.select().from(historicoOrcamentos),
      ]);
      const funil = calcularFunilOrcamentos(orcRows as any, new Date());
      return calcularPrevisaoComercial(osRows as any, orcRows as any, funil, new Date());
    }),

  getRecompraNovosReativados: publicProcedure
    .input(z.object({
      dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const rows = await db.select().from(historicoOs);
      const base = construirBaseClientes(rows as any);
      return calcularRecompraNovosReativados(base, new Date(input.dataInicial), new Date(`${input.dataFinal}T23:59:59`), new Date());
    }),

  // ─── Assistente de IA (Inteligência de Clientes) ─────────────────────────────
  // Ver docs/inteligencia-clientes.md seção "Assistente de IA". Usa só os
  // resultados já calculados pelas funções acima como contexto — nunca soma
  // dados brutos, nunca recebe a base de clientes inteira.
  perguntarInteligenciaClientes: protectedProcedure
    .input(z.object({
      pergunta: z.string().min(3),
      dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const dataRef = new Date();
      const dataInicial = new Date(input.dataInicial);
      const dataFinal = new Date(`${input.dataFinal}T23:59:59`);

      const [osRows, orcRows] = await Promise.all([
        db.select().from(historicoOs),
        db.select().from(historicoOrcamentos),
      ]);
      const base = construirBaseClientes(osRows as any);
      const visaoGeral = calcularVisaoGeral(base, dataInicial, dataFinal, dataRef);
      const funil = calcularFunilOrcamentos(orcRows as any, dataRef);
      const previsao = calcularPrevisaoComercial(osRows as any, orcRows as any, funil, dataRef);
      const candidatosAcao = calcularCandidatosAcao(base, dataRef);
      const contexto = montarContextoAssistenteClientes(visaoGeral, funil, previsao, candidatosAcao, {
        dataInicial: input.dataInicial, dataFinal: input.dataFinal,
      });

      const resposta = await perguntarSobreClientes(
        PROMPT_ASSISTENTE_CLIENTES_V1,
        `Contexto (dados já calculados pelo sistema, em JSON):\n${JSON.stringify(contexto)}`,
        input.pergunta,
      );
      return { resposta, versaoPrompt: VERSAO_PROMPT_ASSISTENTE_CLIENTES };
    }),

  // ─── SISTEMA DE AUDITORIA E CONGELAMENTO DE DADOS ────────────────────────────

  /** Busca os dados auditados de um mês (congelado ou pendente) */
  getAuditoria: publicProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(performanceAuditada)
        .where(and(eq(performanceAuditada.mes, input.mes), eq(performanceAuditada.ano, input.ano)))
        .limit(1);
      return rows.length > 0 ? rows[0] : null;
    }),

  /** Salva um snapshot dos dados atuais do ERP como auditoria pendente */
  salvarAuditoria: protectedProcedure
    .input(z.object({
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020),
      cotacoes: z.number(),
      osNormais: z.number(),
      taxaConversao: z.number(),
      faturamento: z.number(),
      valorOrcado: z.number(),
      clientesNovos: z.number(),
      cotacoesNovos: z.number().default(0),
      taxaConvNovos: z.number(),
      faturamentoNovos: z.number(),
      statusValidacao: z.enum(['pendente', 'validado', 'corrigido_excel']).default('validado'),
      fonteExcel: z.string().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('DB indisponível');
      const existing = await db.select({ id: performanceAuditada.id })
        .from(performanceAuditada)
        .where(and(eq(performanceAuditada.mes, input.mes), eq(performanceAuditada.ano, input.ano)))
        .limit(1);
      const values = {
        mes: input.mes,
        ano: input.ano,
        cotacoes: input.cotacoes,
        osNormais: input.osNormais,
        taxaConversao: String(input.taxaConversao),
        faturamento: String(input.faturamento),
        valorOrcado: String(input.valorOrcado),
        clientesNovos: input.clientesNovos,
        cotacoesNovos: input.cotacoesNovos ?? 0,
        taxaConvNovos: String(input.taxaConvNovos),
        faturamentoNovos: String(input.faturamentoNovos),
        statusValidacao: input.statusValidacao,
        fonteExcel: input.fonteExcel,
        observacoes: input.observacoes,
        auditadoPor: ctx.user?.name ?? 'sistema',
        dataAuditoria: new Date(),
        congelado: false,
      };
      if (existing.length > 0) {
        await db.update(performanceAuditada).set(values).where(eq(performanceAuditada.id, existing[0].id));
      } else {
        await db.insert(performanceAuditada).values(values);
      }
      return { ok: true };
    }),

  /** Congela os dados auditados de um mês — impede sobrescrita automática */
  congelarAuditoria: protectedProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB indisponível');
      await db.update(performanceAuditada)
        .set({ congelado: true, dataCongelamento: new Date() })
        .where(and(eq(performanceAuditada.mes, input.mes), eq(performanceAuditada.ano, input.ano)));
      // Limpar cache em memória para este mês (forçar uso do snapshot congelado)
      deleteCache(`mes_${input.mes}_${input.ano}`);
      deleteCache(`os_raw_${input.mes}_${input.ano}`);
      deleteCache(`orc_raw_${input.mes}_${input.ano}`);
      return { ok: true };
    }),

  /** Descongela (recalibragem) — permite que o sistema busque dados frescos da API */
  descongelarAuditoria: protectedProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB indisponível');
      await db.update(performanceAuditada)
        .set({ congelado: false, dataCongelamento: null })
        .where(and(eq(performanceAuditada.mes, input.mes), eq(performanceAuditada.ano, input.ano)));
      // Limpar cache em memória para forçar nova busca da API. Também precisa
      // limpar o cache PERSISTENTE (mubisys_api_cache) — ele sobrevive a
      // restart/troca de instância serverless na Vercel e, sem isso, o próximo
      // getMes (mesmo já descongelado) reaproveitaria os mesmos dados antigos
      // via getDbCache em vez de ir à API MubiSys, deixando o "Recalibrar" sem
      // efeito real fora da instância que processou este clique.
      deleteCache(`mes_${input.mes}_${input.ano}`);
      deleteCache(`os_raw_${input.mes}_${input.ano}`);
      deleteCache(`orc_raw_${input.mes}_${input.ano}`);
      await deleteDbCache(`raw_${input.mes}_${input.ano}`);
      return { ok: true };
    }),

  /** Diagnóstico: retorna dados brutos da API MubiSys para auditoria cruzada com Excel */
  diagnosticoApi: protectedProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      const { mes, ano } = input;
      const pad = (n: number) => String(n).padStart(2, '0');
      const lastDay = new Date(ano, mes, 0).getDate();
      const datainicial = `${ano}-${pad(mes)}-01`;
      const datafinal = `${ano}-${pad(mes)}-${pad(lastDay)}`;

      // Buscar OS (todas as páginas)
      const [osResult, orcResult] = await Promise.all([
        listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial, datafinal }),
        listarOrcamentosMubiSys({ status: "TODOS", datainicial, datafinal }),
      ]);
      const allOs = osResult.itens as any[];
      const allOrc = orcResult.itens as any[];

      // Campos disponíveis
      const osCampos = allOs.length > 0 ? Object.keys(allOs[0]) : [];
      const orcCampos = allOrc.length > 0 ? Object.keys(allOrc[0]) : [];

      // Status das OS
      const osPorStatus: Record<string, number> = {};
      for (const o of allOs) {
        const s = String(o.status ?? o.situacao ?? 'N/A');
        osPorStatus[s] = (osPorStatus[s] ?? 0) + 1;
      }

      // Tipos das OS
      const osPorTipo: Record<string, number> = {};
      for (const o of allOs) {
        const t = String(o.tipo ?? o.tipo_os ?? 'N/A');
        osPorTipo[t] = (osPorTipo[t] ?? 0) + 1;
      }

      // Valor total OS
      const campoValorOs = osCampos.find(c => ['valor_total','total','valor','vl_total'].includes(c));
      const valorTotalOs = allOs.reduce((acc, o) => acc + (parseFloat(String(o[campoValorOs ?? ''] ?? 0)) || 0), 0);

      // Valor total orçamentos
      const campoValorOrc = orcCampos.find(c => ['valor_total','total','valor','vl_total'].includes(c));
      const valorTotalOrc = allOrc.reduce((acc, o) => acc + (parseFloat(String(o[campoValorOrc ?? ''] ?? 0)) || 0), 0);

      // Faturamento: OS com status que indica entregue/faturado
      const osNormais = allOs.filter(isOsNormalApi);
      const valorFaturamento = osNormais.reduce((acc, o) => acc + (parseFloat(String(o[campoValorOs ?? ''] ?? 0)) || 0), 0);

      // Vendedores nas OS
      const osPorVendedor: Record<string, number> = {};
      for (const o of osNormais) {
        const v = String(o.vendedor ?? o.nome_vendedor ?? 'Sem Vendedor');
        osPorVendedor[v] = (osPorVendedor[v] ?? 0) + 1;
      }

      return {
        periodo: { datainicial, datafinal },
        os: {
          totalBruto: allOs.length,
          totalNormais: osNormais.length,
          porStatus: osPorStatus,
          porTipo: osPorTipo,
          porVendedor: osPorVendedor,
          campos: osCampos,
          campoValor: campoValorOs,
          valorTotal: valorTotalOs,
          faturamento: valorFaturamento,
          exemplos: allOs.slice(0, 3),
        },
        orcamentos: {
          total: allOrc.length,
          campos: orcCampos,
          campoValor: campoValorOrc,
          valorTotal: valorTotalOrc,
          exemplos: allOrc.slice(0, 3),
        },
        taxaConversao: allOrc.length > 0 ? (osNormais.length / allOrc.length) * 100 : 0,
      };
    }),

  // Auditoria de múltiplos meses — usa mesma lógica validada do getMes
  auditarMeses: protectedProcedure
    .input(z.object({
      meses: z.array(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    }))
    .query(async ({ input }) => {
      const resultados: any[] = [];

      for (const { mes, ano } of input.meses) {
        try {
          // 50s por mês — abaixo do maxDuration:60s. Com múltiplos meses na
          // mesma requisição o total ainda pode ultrapassar 60s (soma sequencial);
          // isso é uma limitação estrutural do endpoint, não resolvida por este timeout.
          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("timeout_50s")), 50000)
          );
          const raw = await Promise.race([
            getMesFromApi(mes, ano),
            timeoutPromise,
          ]);
          if (!raw) {
            resultados.push({ mes, ano, erro: "sem_dados" });
            continue;
          }
          const metrics = calcMetrics(raw.osNormais, raw.orcamentos, mes, ano);
          resultados.push({
            mes,
            ano,
            osGeradas: metrics.osGeradas,
            cotacoes: metrics.cotacoes,
            faturamento: metrics.faturamento,
            valorOrcado: metrics.valorOrcado,
            taxaConversao: metrics.taxaConversao,
            taxaFaturamento: metrics.taxaFaturamento,
            ticketMedio: metrics.ticketMedio,
          });
        } catch (e: any) {
          resultados.push({ mes, ano, erro: e?.message ?? "erro_desconhecido" });
        }
      }

      return resultados;
    }),

  /** Retorna o mapa de clientes contatados para um mês/ano */
  getContatados: publicProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return {};
      const rows = await db.select()
        .from(clienteNovosContato)
        .where(and(eq(clienteNovosContato.mes, input.mes), eq(clienteNovosContato.ano, input.ano)));
      const mapa: Record<string, { contatado: boolean; dataContato: Date | null }> = {};
      for (const r of rows) {
        mapa[r.empresa.toLowerCase().trim()] = { contatado: r.contatado, dataContato: r.dataContato };
      }
      return mapa;
    }),

  /** Marca ou desmarca um cliente como contatado */
  setContatado: protectedProcedure
    .input(z.object({
      empresa: z.string().min(1),
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020),
      contatado: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB indisponível');
      const key = input.empresa.toLowerCase().trim();
      const existing = await db.select()
        .from(clienteNovosContato)
        .where(and(
          eq(clienteNovosContato.empresa, key),
          eq(clienteNovosContato.mes, input.mes),
          eq(clienteNovosContato.ano, input.ano)
        ))
        .limit(1);
      if (existing.length > 0) {
        await db.update(clienteNovosContato)
          .set({ contatado: input.contatado, dataContato: input.contatado ? new Date() : null })
          .where(and(
            eq(clienteNovosContato.empresa, key),
            eq(clienteNovosContato.mes, input.mes),
            eq(clienteNovosContato.ano, input.ano)
          ));
      } else {
        await db.insert(clienteNovosContato).values({
          empresa: key,
          mes: input.mes,
          ano: input.ano,
          contatado: input.contatado,
          dataContato: input.contatado ? new Date() : null,
        });
      }
      return { ok: true };
    }),

  /** Resumo leve de "silêncio" das propostas de alto valor do mês: quantas
   * seguem em aberto (não convertidas/canceladas) sem NENHUM contato registrado
   * (nem a caixinha "Contatado" nem um follow-up com motivo). Mesmo universo de
   * getPropostasAltoValor, mas sem telefone/WhatsApp/histórico — usado só para
   * o card de visão geral, então evita o custo de obterContatosOrcamentos. */
  getResumoSilencioPropostas: publicProcedure
    .input(z.object({
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020),
      valorMinimo: z.number().min(0).default(7800),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { totalAltoValor: 0, semContato: 0, taxaSilencio: 0 };
      const { mes, ano, valorMinimo } = input;

      const orcRows = await db.select().from(historicoOrcamentos)
        .where(and(eq(historicoOrcamentos.mes, mes), eq(historicoOrcamentos.ano, ano)));

      const STATUS_FINALIZADOS = ["cancelada", "cancelado", "excluída", "excluído", "excluida", "excluido", "aprovado", "faturado", "concluido", "concluído"];
      const candidatas = orcRows.filter(orc => {
        const valor = parseFloat(String(orc.total ?? "0")) || 0;
        if (valor < valorMinimo) return false;
        const status = (orc.status ?? "").toLowerCase();
        return !STATUS_FINALIZADOS.includes(status);
      });
      if (candidatas.length === 0) return { totalAltoValor: 0, semContato: 0, taxaSilencio: 0 };

      const [contatadosDb, followupsDb] = await Promise.all([
        db.select({ orcNumero: performancePropostasContatado.orcNumero, contatado: performancePropostasContatado.contatado })
          .from(performancePropostasContatado)
          .where(and(eq(performancePropostasContatado.mes, mes), eq(performancePropostasContatado.ano, ano))),
        db.select({ orcNumero: performancePropostasFollowup.orcNumero })
          .from(performancePropostasFollowup)
          .where(and(eq(performancePropostasFollowup.mes, mes), eq(performancePropostasFollowup.ano, ano))),
      ]);
      const contatadoSet = new Set(contatadosDb.filter(c => c.contatado).map(c => c.orcNumero));
      const followupSet = new Set(followupsDb.map(f => f.orcNumero));

      const semContato = candidatas.filter(orc => {
        const numero = orc.orcNumero ?? "";
        return !contatadoSet.has(numero) && !followupSet.has(numero);
      }).length;

      return {
        totalAltoValor: candidatas.length,
        semContato,
        taxaSilencio: parseFloat(((semContato / candidatas.length) * 100).toFixed(1)),
      };
    }),

  // ─── Propostas de alto valor (padrão: acima de R$ 7.800) ───────────────────
  // Lista as propostas do mês/ano em aberto (exclui canceladas/excluídas e as
  // já convertidas em venda/faturamento — essas não precisam mais de follow-up)
  // acima do valor de corte, com telefone/WhatsApp quando disponível e o
  // histórico de contatos já registrados por quem fez o follow-up. Cada proposta
  // também diz se o cliente é novo (sem compra registrada) ou reativado (6+ meses
  // sem comprar) — ver classificarClientePorRecencia.
  getPropostasAltoValor: publicProcedure
    .input(z.object({
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020),
      valorMinimo: z.number().min(0).default(7800),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { propostas: [] as any[] };
      const { mes, ano, valorMinimo } = input;

      const orcRows = await db.select().from(historicoOrcamentos)
        .where(and(eq(historicoOrcamentos.mes, mes), eq(historicoOrcamentos.ano, ano)));

      const STATUS_FINALIZADOS = ["cancelada", "cancelado", "excluída", "excluído", "excluida", "excluido", "aprovado", "faturado", "concluido", "concluído"];
      const candidatas = orcRows.filter(orc => {
        const valor = parseFloat(String(orc.total ?? "0")) || 0;
        if (valor < valorMinimo) return false;
        const status = (orc.status ?? "").toLowerCase();
        return !STATUS_FINALIZADOS.includes(status);
      });

      if (candidatas.length === 0) return { propostas: [] as any[] };

      // Telefone/contato: best-effort a partir do cache de dados brutos da API MubiSys
      // já buscado para este mês (getMesFromApi popula orc_raw_{mes}_{ano} / raw_{mes}_{ano}).
      // Não dispara uma nova busca na API só por causa do telefone — historico_orcamentos
      // não guarda telefone e a tabela `clientes` está vazia (ver comentário no schema),
      // então sem esse cache quente a proposta aparece sem botão de WhatsApp nem link do MubiSys.
      const orcCacheKey = `orc_raw_${mes}_${ano}`;
      let allOrcApi: any[] | null = getCached(orcCacheKey);
      if (!allOrcApi) {
        // ignorarExpiracao: telefone de cliente não muda — um cache expirado serve
        // (e evita apagar a linha, como getDbCache faz ao encontrar uma expirada).
        const dbCached = await getDbCache(`raw_${mes}_${ano}`, { ignorarExpiracao: true });
        allOrcApi = dbCached?.allOrc ?? null;
      }
      const telefonePorOrcNumero = new Map<string, { telefone: string; contato: string }>();
      // id interno do MubiSys, usado no link que abre o orçamento (ver urlOrcamentoMubiSys)
      const mubisysIdPorOrcNumero = new Map<string, number>();
      if (allOrcApi) {
        for (const o of allOrcApi) {
          const numero = String(o.sequencial_orcamento ?? o.id ?? "");
          if (!numero) continue;
          // Sequencial repetido (versões do orçamento; só visto em caches de 2025): fica o
          // maior id, que é a versão mais recente.
          if (typeof o.id === "number" && o.id > (mubisysIdPorOrcNumero.get(numero) ?? 0)) mubisysIdPorOrcNumero.set(numero, o.id);
          const contatosOrc: any[] = Array.isArray(o.cliente_contato) ? o.cliente_contato : (o.cliente_contato ? [o.cliente_contato] : []);
          // Primeiro contato que tenha telefone (o primeiro da lista pode vir sem número)
          const comTelefone = contatosOrc.find(c => c?.celular || c?.telefone || c?.fone);
          const telefone = comTelefone?.celular || comTelefone?.telefone || comTelefone?.fone || "";
          const contato = comTelefone?.nome_contato || comTelefone?.nome || "";
          if (telefone) telefonePorOrcNumero.set(numero, { telefone, contato });
        }
      }

      // Propostas que o cache agregado do mês não cobriu (cache vazio/expirado, ou proposta
      // criada depois dele): busca cada uma pelo número e guarda no banco — ver
      // obterContatosOrcamentos. Sem isso, o cache frio deixava a lista sem WhatsApp e sem link.
      const semDados = [...candidatas]
        .sort((a, b) => (parseFloat(String(b.total ?? "0")) || 0) - (parseFloat(String(a.total ?? "0")) || 0))
        .map(o => o.orcNumero ?? "")
        .filter(n => n && !mubisysIdPorOrcNumero.has(n));
      if (semDados.length > 0) {
        const extras = await obterContatosOrcamentos(mes, ano, semDados);
        for (const n of semDados) {
          const c = extras[n];
          if (!c) continue;
          if (c.mubisysId) mubisysIdPorOrcNumero.set(n, c.mubisysId);
          if (c.telefone) telefonePorOrcNumero.set(n, { telefone: c.telefone, contato: c.contato });
        }
      }

      const followupsDb = await db.select().from(performancePropostasFollowup)
        .where(and(eq(performancePropostasFollowup.mes, mes), eq(performancePropostasFollowup.ano, ano)))
        .orderBy(desc(performancePropostasFollowup.contatadoEm));
      const followupsPorOrc = new Map<string, typeof followupsDb>();
      for (const f of followupsDb) {
        if (!followupsPorOrc.has(f.orcNumero)) followupsPorOrc.set(f.orcNumero, []);
        followupsPorOrc.get(f.orcNumero)!.push(f);
      }

      // Caixinha "Contatado" (marca rápida, separada do log de follow-ups)
      const contatadosDb = await db.select().from(performancePropostasContatado)
        .where(and(eq(performancePropostasContatado.mes, mes), eq(performancePropostasContatado.ano, ano)));
      const contatadoPorOrc = new Map(contatadosDb.map(c => [c.orcNumero, c]));

      // Estrela de cliente novo/reativado: última compra de cada cliente ANTES do mês do
      // relatório (histórico real em historico_os), com chave normalizada nos dois lados.
      const comprasValidas = await buscarTodasComprasValidas(db);
      const ultimaCompraPorCliente = reindexarPorChaveNormalizada(ultimaCompraAntesDe(comprasValidas, mes, ano));
      const overridesClientes = await db.select().from(clienteOverrides);
      const overrideMapClientes = new Map<string, "recorrente" | "novo">();
      for (const ov of overridesClientes) overrideMapClientes.set(ov.empresa, ov.status);

      const propostas = candidatas.map(orc => {
        const numero = orc.orcNumero ?? "";
        const tel = telefonePorOrcNumero.get(numero);
        const mubisysId = mubisysIdPorOrcNumero.get(numero);
        const followups = followupsPorOrc.get(numero) ?? [];
        const marca = contatadoPorOrc.get(numero);
        const chaveCliente = normalizeEmpresaKey(orc.empresa ?? "");
        const ultimaCompra = chaveCliente ? ultimaCompraPorCliente.get(chaveCliente) : undefined;
        // Sem nome de cliente não há como saber o histórico — sem estrela, em vez de "novo" por engano
        const classe = chaveCliente
          ? classificarClientePorRecencia(ultimaCompra, overrideMapClientes.get(chaveCliente), mes, ano)
          : { status: null, mesesSemComprar: null };
        return {
          orcNumero: numero,
          mubisysLink: mubisysId ? urlOrcamentoMubiSys(mubisysId) : null,
          empresa: orc.empresa ?? "",
          vendedor: orc.vendedor ?? "",
          valor: parseFloat(String(orc.total ?? "0")) || 0,
          dataCadastro: orc.dataCadastro ?? null,
          status: orc.status ?? null,
          telefone: tel?.telefone ?? null,
          contato: tel?.contato ?? null,
          whatsappLink: tel?.telefone ? formatarLinkWhatsApp(tel.telefone) || null : null,
          clienteStatus: classe.status,
          mesesSemComprar: classe.mesesSemComprar,
          ultimaCompra: classe.status === "reativado" && ultimaCompra
            ? `${String(ultimaCompra.mes).padStart(2, "0")}/${ultimaCompra.ano}`
            : null,
          contatado: marca?.contatado ?? false,
          contatadoPor: marca?.contatado ? marca.usuarioNome : null,
          contatadoEm: marca?.contatado ? marca.contatadoEm : null,
          followups: followups.map(f => ({
            id: f.id,
            usuarioNome: f.usuarioNome,
            motivo: f.motivo,
            contatadoEm: f.contatadoEm,
          })),
          qtdFollowups: followups.length,
        };
      }).sort((a, b) => b.valor - a.valor);

      return { propostas };
    }),

  /** Marca ou desmarca uma proposta de alto valor como "contatada" (caixinha rápida, sem motivo). */
  setPropostaContatada: protectedProcedure
    .input(z.object({
      orcNumero: z.string().min(1),
      empresa: z.string().min(1),
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020),
      contatado: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const agora = new Date();
      const dados = {
        contatado: input.contatado,
        usuarioId: input.contatado ? (ctx.user?.id ?? null) : null,
        usuarioNome: input.contatado ? (ctx.user?.name ?? "Desconhecido") : null,
        contatadoEm: input.contatado ? agora : null,
        updatedAt: agora,
      };
      await db.insert(performancePropostasContatado)
        .values({ orcNumero: input.orcNumero, empresa: input.empresa, mes: input.mes, ano: input.ano, ...dados })
        .onConflictDoUpdate({ target: performancePropostasContatado.orcNumero, set: dados });
      return { ok: true };
    }),

  /** Registra um contato/follow-up feito em uma proposta de alto valor. */
  registrarFollowupProposta: protectedProcedure
    .input(z.object({
      orcNumero: z.string().min(1),
      empresa: z.string().min(1),
      mes: z.number().min(1).max(12),
      ano: z.number().min(2020),
      motivo: z.string().min(3, "Descreva o motivo do contato"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [row] = await db.insert(performancePropostasFollowup).values({
        orcNumero: input.orcNumero,
        empresa: input.empresa,
        mes: input.mes,
        ano: input.ano,
        usuarioId: ctx.user?.id ?? null,
        usuarioNome: ctx.user?.name ?? "Desconhecido",
        motivo: input.motivo,
      }).returning();
      return row;
    }),
});
