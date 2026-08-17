import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { ENV } from "../_core/env";
import { listarOSMubiSys, listarOrcamentosMubiSys } from "../integrations/mubisys-client";
import { getDb } from "../db/db";
import { metasComerciais, historicoOs, historicoOrcamentos, clienteOverrides, faturamento, inteligenciaClientesCache, performanceAuditada, mubisysApiCache, clienteNovosContato } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// ─── Cache em memória para evitar chamadas duplicadas à API ────────────────────
// TTL: 5 minutos para mês atual, 6 horas para meses históricos (dados não mudam)
const apiCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_ATUAL_MS = 60 * 60 * 1000;      // 60 minutos (evita rebusca frequente na API)
const CACHE_TTL_HISTORICO_MS = 6 * 60 * 60 * 1000; // 6 horas

// ─── Cache persistente no banco de dados ─────────────────────────────────────
// Sobrevive a reinicializações do servidor. Evita cotações/faturamento zerados
// após restart quando a API MubiSys está lenta ou com timeout.
async function getDbCache(cacheKey: string): Promise<{ allOs: any[]; allOrc: any[] } | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(mubisysApiCache)
      .where(eq(mubisysApiCache.cacheKey, cacheKey)).limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
    // Verificar se expirou
    if (new Date() > new Date(row.expiresAt)) {
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

async function setDbCache(cacheKey: string, mes: number, ano: number, allOs: any[], allOrc: any[]): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const now = new Date();
    const ttlMs = isMesAtual(mes, ano) ? CACHE_TTL_ATUAL_MS : CACHE_TTL_HISTORICO_MS;
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

function isMesAtual(mes: number, ano: number): boolean {
  const now = new Date();
  return mes === now.getMonth() + 1 && ano === now.getFullYear();
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

// Manter compatibilidade com setCache existente
function setCache(key: string, data: any): void {
  apiCache.set(key, { data, ts: Date.now() });
}

function deleteCache(key: string): void {
  apiCache.delete(key);
}

// ─── Buscar dados do banco (histórico importado) ─────────────────────────────

/** Filtra OS normais do banco local: exclui retrabalhos (tipoOs começa com 'Retrabalho'),
 * amostras, cortesias, canceladas e registros sem tipoOs (NULL = importação antiga sem custo). */
function isOsNormalDb(os: { tipoOs?: string | null; status?: string | null }): boolean {
  if (os.tipoOs === null || os.tipoOs === undefined) return false;
  const tipo = (os.tipoOs ?? "").toLowerCase();
  const status = (os.status ?? "").toLowerCase();
  if (tipo.startsWith("retrabalho")) return false;
  if (tipo === "amostra") return false;
  if (tipo === "cortesia") return false;
  if (status === "cancelada") return false;
  return true;
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
  }

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
    },
    orcamentos: {
      total: orcRows.length,
      valorTotal: totalValorOrc,
      porVendedor: orcPorVendedor,
    },
  };
}

// ─── Buscar dados da API ERP (mês atual em tempo real) ───────────────────────

// Mapa de promessas em andamento para deduplicar chamadas simultâneas
const pendingApiCalls = new Map<string, Promise<any>>();

async function getMesFromApi(publicKey: string, accessToken: string, mes: number, ano: number) {
  const cacheKey = `mes_${mes}_${ano}`;
  
  // Verificar cache primeiro
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  // Deduplicar chamadas simultâneas para o mesmo mês
  const existing = pendingApiCalls.get(cacheKey);
  if (existing) return existing;
  
  const promise = _getMesFromApiImpl(publicKey, accessToken, mes, ano).then(result => {
    setCache(cacheKey, result);
    pendingApiCalls.delete(cacheKey);
    return result;
  }).catch(err => {
    pendingApiCalls.delete(cacheKey);
    throw err;
  });
  
  pendingApiCalls.set(cacheKey, promise);
  return promise;
}

async function _getMesFromApiImpl(publicKey: string, accessToken: string, mes: number, ano: number) {
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
      // Buscar da API MubiSys SEQUENCIALMENTE (primeiro OS, depois orçamentos)
      // Busca sequencial evita sobrecarga na API e reduz chance de timeout
      // OS: filtrodata=APROVACAO (data de aprovação = faturamento real, igual ao relatório de Vendas do MubiSys)
      const osResult = await listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial, datafinal });
      // Orçamentos: filtrodata=CADASTRO (data de criação = quando a cotação foi enviada)
      const orcResult = await listarOrcamentosMubiSys({ status: "TODOS", datainicial, datafinal });
      allOs = osResult.itens;
      allOrc = orcResult.itens;
      // Salvar em memória sempre (mesmo parcial — melhor que zero para o usuário atual)
      setCacheWithTTL(osCacheKey, allOs, mes, ano);
      setCacheWithTTL(orcCacheKey, allOrc, mes, ano);
      // Cache persistente: SOMENTE salvar se AMBAS as buscas foram completas
      // Dados parciais no cache persistente causam cotações/faturamento errados após restart
      if (osResult.completo && orcResult.completo) {
        setDbCache(rawCacheKey, mes, ano, allOs, allOrc).catch(() => {});
        console.log(`[MubiSys] Cache persistente salvo para ${mes}/${ano}: ${allOs.length} OS, ${allOrc.length} orçamentos`);
      } else {
        console.warn(`[MubiSys] Busca incompleta para ${mes}/${ano} — cache persistente NÃO salvo (OS: ${osResult.completo}, Orc: ${orcResult.completo})`);
      }
    }
  }

  // Filtrar OS Normais:
  // - Excluir tipo Retrabalho, Amostra, Cortesia
  // - Excluir status Cancelada
  const TIPOS_EXCLUIDOS = ["retrabalho", "amostra", "cortesia"];
  const osNormais = allOs.filter(os =>
    !TIPOS_EXCLUIDOS.includes((os.tipo || "").toLowerCase()) &&
    (os.status || "").toLowerCase() !== "cancelada"
  );

  const osPorVendedor: Record<string, { total: number; valor: number; custo: number; resultado: number }> = {};
  let totalValorOs = 0;
  let totalCustoOs = 0;
  let totalResultadoOs = 0;

  for (const os of osNormais) {
    const vendedor = os.vendedor || "Sem Vendedor";
    const valor = parseFloat(String(os.valor_total ?? "0")) || 0;
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
  }

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
    osNormais: { total: osNormais.length, valorTotal: totalValorOs, custo: totalCustoOs, resultado: totalResultadoOs, porVendedor: osPorVendedor },
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

async function getClientesNovosMes(mes: number, ano: number, includeTelefones = true): Promise<{
  total: number;
  cotacoesNovos: number;
  osNovos: number;
  faturamentoNovos: number;
  ticketMedioNovos: number;
  valorOrcadoNovos: number;
  taxaConversaoNovos: number;
  taxaFaturamentoNovos: number;
  porVendedor: Record<string, number>;
  porVendedorNovos: Record<string, VendedorNovosStats>;
  lista: Array<{ empresa: string; vendedor: string; osNumero: string | null; valorOs: string | null; telefone: string; whatsappLink: string; contato: string; cidade: string; estado: string }>;
}> {
  const db = await getDb();
  const EMPTY = { total: 0, cotacoesNovos: 0, osNovos: 0, faturamentoNovos: 0, ticketMedioNovos: 0, valorOrcadoNovos: 0, taxaConversaoNovos: 0, taxaFaturamentoNovos: 0, porVendedor: {}, porVendedorNovos: {}, lista: [] };
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
    let listaSnap: Array<{ empresa: string; vendedor: string; osNumero: string | null; valorOs: string | null; telefone: string; whatsappLink: string; contato: string; cidade: string; estado: string }> = [];
    try { listaSnap = JSON.parse(s.listaClientesNovos ?? '[]'); } catch { listaSnap = []; }

    // Reconstruir porVendedorNovos a partir da lista salva (OS de clientes novos por vendedor)
    // Isso garante que o Dashboard Clientes Novos por Vendedor apareça em todos os meses congelados
    const porVendedorNovosSnap: Record<string, { clientesNovos: number; osNovos: number; faturamentoNovos: number; cotacoesNovos: number; valorOrcadoNovos: number; taxaConvNovos: number; taxaFatNovos: number }> = {};
    for (const item of listaSnap) {
      const vendedor = item.vendedor || "Sem Vendedor";
      const valor = parseFloat(String(item.valorOs ?? "0")) || 0;
      if (!porVendedorNovosSnap[vendedor]) {
        porVendedorNovosSnap[vendedor] = { clientesNovos: 0, osNovos: 0, faturamentoNovos: 0, cotacoesNovos: 0, valorOrcadoNovos: 0, taxaConvNovos: 0, taxaFatNovos: 0 };
      }
      porVendedorNovosSnap[vendedor].clientesNovos++;
      porVendedorNovosSnap[vendedor].osNovos++;
      porVendedorNovosSnap[vendedor].faturamentoNovos = parseFloat((porVendedorNovosSnap[vendedor].faturamentoNovos + valor).toFixed(2));
    }
    // Buscar cotações por vendedor do banco local para calcular taxaConvNovos
    const orcMesSnap = await db.select().from(historicoOrcamentos)
      .where(and(eq(historicoOrcamentos.mes, mes), eq(historicoOrcamentos.ano, ano)));
    // Clientes anteriores para identificar novos
    const clientesAntSnap = await db.select({ empresa: historicoOs.empresa }).from(historicoOs)
      .where(sql`(${historicoOs.ano} < ${mes === 1 ? ano : ano}) AND (${historicoOs.mes} < ${mes} OR ${historicoOs.ano} < ${ano})`);
    const setAntSnap = new Set(clientesAntSnap.map(r => (r.empresa ?? "").toLowerCase().trim()));
    for (const orc of orcMesSnap) {
      const clienteKey = (orc.empresa ?? "").toLowerCase().trim();
      if (!clienteKey || setAntSnap.has(clienteKey)) continue;
      const vendedor = orc.vendedor || "Sem Vendedor";
      if (!porVendedorNovosSnap[vendedor]) {
        porVendedorNovosSnap[vendedor] = { clientesNovos: 0, osNovos: 0, faturamentoNovos: 0, cotacoesNovos: 0, valorOrcadoNovos: 0, taxaConvNovos: 0, taxaFatNovos: 0 };
      }
      porVendedorNovosSnap[vendedor].cotacoesNovos++;
      porVendedorNovosSnap[vendedor].valorOrcadoNovos += parseFloat(String(orc.total ?? "0")) || 0;
    }
    // Calcular taxas por vendedor
    for (const v of Object.keys(porVendedorNovosSnap)) {
      const entry = porVendedorNovosSnap[v];
      entry.taxaConvNovos = entry.cotacoesNovos > 0 ? parseFloat(((entry.osNovos / entry.cotacoesNovos) * 100).toFixed(1)) : 0;
      entry.taxaFatNovos = entry.valorOrcadoNovos > 0 ? parseFloat(((entry.faturamentoNovos / entry.valorOrcadoNovos) * 100).toFixed(1)) : 0;
      entry.valorOrcadoNovos = parseFloat(entry.valorOrcadoNovos.toFixed(2));
    }

    const cotacoesNovosSnap = (s.cotacoesNovos ?? 0) > 0 ? (s.cotacoesNovos ?? 0)
      : Object.values(porVendedorNovosSnap).reduce((acc, v) => acc + v.cotacoesNovos, 0);
    const taxaConvNovosSnap = parseFloat(String(s.taxaConvNovos ?? 0)) > 0
      ? parseFloat(String(s.taxaConvNovos ?? 0))
      : (cotacoesNovosSnap > 0 ? parseFloat((((s.clientesNovos ?? 0) / cotacoesNovosSnap) * 100).toFixed(1)) : 0);

    return {
      total: s.clientesNovos ?? 0,
      cotacoesNovos: cotacoesNovosSnap,
      osNovos: s.clientesNovos ?? 0,
      faturamentoNovos: parseFloat(String(s.faturamentoNovos ?? 0)),
      ticketMedioNovos: s.clientesNovos ? parseFloat(String(s.faturamentoNovos ?? 0)) / s.clientesNovos : 0,
      valorOrcadoNovos: 0,
      taxaConversaoNovos: taxaConvNovosSnap,
      taxaFaturamentoNovos: 0,
      porVendedor: {},
      porVendedorNovos: porVendedorNovosSnap,
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

  // FONTE DE VERDADE: usar banco local para histórico anterior (quem comprou antes deste mês)
  // O banco local é suficiente para determinar se um cliente é recorrente ou novo
  const clientesAnteriores = await db
    .select({ empresa: historicoOs.empresa })
    .from(historicoOs)
    .where(sql`(${historicoOs.ano} < ${ano}) OR (${historicoOs.ano} = ${ano} AND ${historicoOs.mes} < ${mes})`);
  const setAnteriores = new Set(clientesAnteriores.map(r => (r.empresa ?? "").toLowerCase().trim()));

  // FONTE DE VERDADE: usar API Mubisys para buscar OS do mês (dados em tempo real, completos)
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(ano, mes, 0).getDate();
  const di = `${ano}-${pad(mes)}-01`;
  const df = `${ano}-${pad(mes)}-${pad(lastDay)}`;

  // Tentar usar cache do getMesFromApi para evitar chamadas duplicadas
  const cacheKey = `mes_${mes}_${ano}`;
  const cachedMes = getCached(cacheKey);
  
  let allOsApi: any[] = [];
  let allOrcApiPrefetched: any[] | null = null; // será preenchido se vier do cache
  
  if (cachedMes) {
    // Reconstruir allOsApi a partir do cache (formato da API)
    // Não temos os dados brutos, precisamos buscar da API mesmo
    // Mas podemos usar o cache para os orçamentos
  }
  
  try {
    // Usar getMesFromApi que já tem cache e deduplicação
    const mesData = await getMesFromApi(publicKey, accessToken, mes, ano);
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
        // Buscar da API MubiSys
        const osResult = await listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial: di, datafinal: df });
        allOsApi = osResult.itens;
        const orcResult = await listarOrcamentosMubiSys({ status: "TODOS", datainicial: di, datafinal: df });
        const orcList = orcResult.itens;
        setCacheWithTTL(osCacheKey, allOsApi, mes, ano);
        setCacheWithTTL(orcCacheKey, orcList, mes, ano);
        setDbCache(rawCacheKeyNovos, mes, ano, allOsApi, orcList).catch(() => {});
        allOrcApiPrefetched = orcList;
      }
    }
  } catch {
    // Fallback: usar banco local se API falhar
    const osMesDb = await db.select().from(historicoOs)
      .where(and(eq(historicoOs.mes, mes), eq(historicoOs.ano, ano)));
    allOsApi = osMesDb.map(os => ({
      cliente: os.empresa,
      vendedor: os.vendedor,
      numero: os.osNumero,
      valor_total: os.valorOs ?? os.valorTotal,
      tipo: os.tipoOs ?? "",
      status: os.status ?? "",
    }));
  }

  // Filtrar OS Normais (excluir Retrabalho, Amostra, Cortesia e Canceladas)
  const osNormaisApi = allOsApi.filter(os =>
    (os.tipo || "").toLowerCase() !== "retrabalho" &&
    (os.tipo || "").toLowerCase() !== "amostra" &&
    (os.tipo || "").toLowerCase() !== "cortesia" &&
    (os.status || "").toLowerCase() !== "cancelada"
  );

  const porVendedor: Record<string, number> = {};
  const porVendedorNovosOs: Record<string, { osNovos: number; faturamentoNovos: number; clientesNovos: number; nomeOriginal: string }> = {};
  let total = 0;
  let osNovosCount = 0;
  let faturamentoNovos = 0;
  const clientesVistos = new Set<string>();
  // listaRaw agora inclui contato e cidade extraídos diretamente da OS
  // Os campos cliente_contato e cliente_endereco já vêm na resposta da OS com dados do CLIENTE
  // Isso elimina a necessidade de busca por nome (que retornava dados da Radra)
  const listaRaw: Array<{ empresa: string; vendedor: string; osNumero: string | null; valorOs: string | null; telefone: string; contato: string; cidade: string; estado: string }> = [];

  for (const os of osNormaisApi) {
    // Extrair nome do cliente da API (campo 'cliente' pode ser objeto ou string)
    const clienteRaw = os.cliente;
    const nomeCliente = typeof clienteRaw === "object" && clienteRaw !== null
      ? String((clienteRaw as any)?.nome ?? (clienteRaw as any)?.razao_social ?? "")
      : String(clienteRaw ?? "");
    const clienteKey = nomeCliente.toLowerCase().trim();
    if (!clienteKey) continue;

    // Verificar override manual: "recorrente" exclui; "novo" força inclusão
    const overrideStatus = overrideMap.get(clienteKey);
    // CORREÇÃO: remover a condição clientesAnteriores.length === 0 que descartava todos em jan
    // Se não há histórico anterior, todos os clientes do mês são novos por definição
    const isNovoByHistory = !setAnteriores.has(clienteKey);
    const isNovo = overrideStatus === "recorrente" ? false
      : overrideStatus === "novo" ? true
      : isNovoByHistory;

    if (isNovo) {
      const vendedor = String(os.vendedor ?? "Sem Vendedor");
      const vendedorKey = vendedor.toLowerCase().trim();
      const valorOs = parseFloat(String(os.valor_total ?? "0")) || 0;
      faturamentoNovos += valorOs;
      osNovosCount++;
      if (!porVendedorNovosOs[vendedorKey]) porVendedorNovosOs[vendedorKey] = { osNovos: 0, faturamentoNovos: 0, clientesNovos: 0, nomeOriginal: vendedor };
      porVendedorNovosOs[vendedorKey].osNovos++;
      porVendedorNovosOs[vendedorKey].faturamentoNovos += valorOs;
      if (!clientesVistos.has(clienteKey)) {
        clientesVistos.add(clienteKey);
        total++;
        porVendedor[vendedor] = (porVendedor[vendedor] ?? 0) + 1;
        porVendedorNovosOs[vendedorKey].clientesNovos++;
        // Extrair contato e cidade DIRETAMENTE da OS (campos cliente_contato e cliente_endereco)
        // NUNCA buscar por nome — isso retornava dados da Radra (empresa emissora)
        const contatosOs: any[] = Array.isArray(os.cliente_contato) ? os.cliente_contato : (os.cliente_contato ? [os.cliente_contato] : []);
        const enderecosOs: any[] = Array.isArray(os.cliente_endereco) ? os.cliente_endereco : (os.cliente_endereco ? [os.cliente_endereco] : []);
        const primeiroContato = contatosOs[0];
        const primeiroEndereco = enderecosOs[0];
        const telefoneOs = primeiroContato?.celular || primeiroContato?.telefone || primeiroContato?.fone || "";
        const contatoOs = primeiroContato?.nome_contato || primeiroContato?.nome || "";
        const cidadeOs = primeiroEndereco?.cidade || "";
        const estadoOs = primeiroEndereco?.estado || primeiroEndereco?.uf || "";
        listaRaw.push({ empresa: nomeCliente, vendedor, osNumero: String(os.numero ?? ""), valorOs: String(os.valor_total ?? ""), telefone: telefoneOs, contato: contatoOs, cidade: cidadeOs, estado: estadoOs });
      }
    }
  }

  function formatWhatsApp(tel: string): string {
    if (!tel) return "";
    const digits = tel.replace(/\D/g, "");
    if (!digits) return "";
    // Se já tem código do país (55), usar direto; senão adicionar
    const num = digits.startsWith("55") ? digits : `55${digits}`;
    return `https://wa.me/${num}`;
  }

  // Montar lista final — contato e cidade já vêm da OS (campos cliente_contato e cliente_endereco)
  // Não é mais necessário buscar por nome na API (que retornava dados da Radra)
  const lista: Array<{ empresa: string; vendedor: string; osNumero: string | null; valorOs: string | null; telefone: string; whatsappLink: string; contato: string; cidade: string; estado: string }> = [];
  for (const item of listaRaw) {
    lista.push({
      ...item,
      whatsappLink: formatWhatsApp(item.telefone),
    });
  }

  // Contar cotações (orçamentos) de clientes novos no mês — usar cache se disponível
  let cotacoesNovos = 0;
  let valorOrcadoNovos = 0;
  const porVendedorNovosOrc: Record<string, { cotacoesNovos: number; valorOrcadoNovos: number; nomeOriginal: string }> = {};

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
      const orcOverride = overrideMap.get(clienteKey);
      const isNovoOrc = orcOverride === "recorrente" ? false
        : orcOverride === "novo" ? true
        : !setAnteriores.has(clienteKey);
      if (clienteKey && isNovoOrc) {
        cotacoesNovos++;
        const valor = parseFloat(String(orc.valor_total ?? orc.valor ?? orc.total ?? orc.valorTotal ?? "0")) || 0;
        valorOrcadoNovos += valor;
        const vendedorOrcRaw = String(orc.vendedor ?? orc.usuario ?? "Sem Vendedor");
        const vendedorOrcKey = vendedorOrcRaw.toLowerCase().trim();
        if (!porVendedorNovosOrc[vendedorOrcKey]) porVendedorNovosOrc[vendedorOrcKey] = { cotacoesNovos: 0, valorOrcadoNovos: 0, nomeOriginal: vendedorOrcRaw };
        porVendedorNovosOrc[vendedorOrcKey].cotacoesNovos++;
        porVendedorNovosOrc[vendedorOrcKey].valorOrcadoNovos += valor;
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
  // Montar porVendedorNovos combinando OS + cotações por vendedor
  // Chaves são lowercase; usar nomeOriginal para preservar capitalização original
  const todosVendedoresNovos = Array.from(new Set([
    ...Object.keys(porVendedorNovosOs),
    ...Object.keys(porVendedorNovosOrc),
  ]));
  const porVendedorNovos: Record<string, VendedorNovosStats> = {};
  for (const v of todosVendedoresNovos) {
    const os = porVendedorNovosOs[v] ?? { osNovos: 0, faturamentoNovos: 0, clientesNovos: 0, nomeOriginal: v };
    const orc = porVendedorNovosOrc[v] ?? { cotacoesNovos: 0, valorOrcadoNovos: 0, nomeOriginal: v };
    // Usar o nome original com melhor capitalização (preferir o da API de orçamentos)
    const nomeDisplay = orc.nomeOriginal !== v ? orc.nomeOriginal : os.nomeOriginal;
    const taxaConvNovos = orc.cotacoesNovos > 0
      ? parseFloat(((os.osNovos / orc.cotacoesNovos) * 100).toFixed(1)) : 0;
    const taxaFatNovos = orc.valorOrcadoNovos > 0
      ? parseFloat(((os.faturamentoNovos / orc.valorOrcadoNovos) * 100).toFixed(1)) : 0;
    porVendedorNovos[nomeDisplay] = {
      clientesNovos: os.clientesNovos,
      osNovos: os.osNovos,
      faturamentoNovos: parseFloat(os.faturamentoNovos.toFixed(2)),
      cotacoesNovos: orc.cotacoesNovos,
      valorOrcadoNovos: parseFloat(orc.valorOrcadoNovos.toFixed(2)),
      taxaConvNovos,
      taxaFatNovos,
    };
  }

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
    cotacoesNovos,
    osNovos,
    faturamentoNovos: parseFloat(faturamentoNovos.toFixed(2)),
    ticketMedioNovos,
    valorOrcadoNovos: parseFloat(valorOrcadoNovos.toFixed(2)),
    taxaConversaoNovos,
    taxaFaturamentoNovos,
    porVendedor,
    porVendedorNovos,
    lista,
  };
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const performanceComercialRouter = router({

  // Dados de um mês específico
  getMes: publicProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020), forceRefresh: z.boolean().optional().default(false) }))
    .query(async ({ input }) => {
      const { mes, ano, forceRefresh } = input;
      const now = new Date();
      const isMesAtual = mes === now.getMonth() + 1 && ano === now.getFullYear();

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

      if (isMesAtual || forceRefresh) {
        // Mês atual ou refresh forçado: tentar API em tempo real
        // Timeout de 180s para dar tempo à busca sequencial de 4 páginas de orçamentos
        const publicKey = ENV.MUBISYS_PUBLIC_KEY;
        const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
        if (publicKey && accessToken) {
          try {
            const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 180000));
            raw = await Promise.race([getMesFromApi(publicKey, accessToken, mes, ano), timeoutPromise]);
          } catch {
            raw = null;
          }
        }
      }

      // Se não conseguiu da API ou é mês histórico, usar banco
      if (!raw) {
        raw = await getMesFromDb(mes, ano);
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
      return { ...metrics, totalPedidosBanco };
    }),

  // Múltiplos meses para comparativo e gráfico de evolução
  getMultiMes: publicProcedure
    .input(z.object({
      meses: z.array(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    }))
    .query(async ({ input }) => {
      const now = new Date();
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
      // Mapa: "mes_ano" -> { osNovos, faturamentoNovos, ticketMedioNovos, cotacoesNovos, taxaConversaoNovos, taxaFaturamentoNovos }
      const novosMap = new Map<string, { osNovos: number; faturamentoNovos: number; ticketMedioNovos: number; cotacoesNovos: number; taxaConversaoNovos: number; taxaFaturamentoNovos: number }>();
      if (db) {
        const overrides = await db.select().from(clienteOverrides);
        const overrideMap = new Map<string, "recorrente" | "novo">();
        for (const ov of overrides) overrideMap.set(ov.empresa, ov.status);

        for (const ano of anoSet) {
          const todasOsAno = dbDataByAno.get(ano)?.os ?? [];
          const todasOrcAno = dbDataByAno.get(ano)?.orc ?? [];
          // Clientes que compraram antes deste ano
          const clientesAntes = db ? await db
            .select({ empresa: historicoOs.empresa })
            .from(historicoOs)
            .where(sql`${historicoOs.ano} < ${ano}`) : [];
          const clientesVistoAte = new Set<string>(clientesAntes.map(r => (r.empresa ?? "").toLowerCase().trim()));

          const mesAtual = ano === now.getFullYear() ? now.getMonth() + 1 : 12;
          for (let mes = 1; mes <= mesAtual; mes++) {
            const osMes = todasOsAno.filter(o => o.mes === mes);
            const orcMes = todasOrcAno.filter(o => o.mes === mes);
            const clientesEsteMes = new Set<string>();
            let osNovos = 0, faturamentoNovos = 0;
            for (const os of osMes) {
              if (!isOsNormalDb(os)) continue; // excluir retrabalhos, amostras, cortesias, canceladas
              const clienteKey = (os.empresa ?? "").toLowerCase().trim();
              if (!clienteKey) continue;
              clientesEsteMes.add(clienteKey);
              const overrideStatus = overrideMap.get(clienteKey);
              const isNovo = overrideStatus === "recorrente" ? false
                : overrideStatus === "novo" ? true
                : !clientesVistoAte.has(clienteKey);
              if (isNovo) {
                const valor = parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
                osNovos++;
                faturamentoNovos += valor;
              }
            }
            // Cotações de novos: orçamentos de clientes que não estavam no histórico
            let cotacoesNovos = 0;
            let valorOrcadoNovos = 0;
            for (const orc of orcMes) {
              const clienteKey = (orc.empresa ?? "").toLowerCase().trim();
              if (!clienteKey) continue;
              const overrideStatus = overrideMap.get(clienteKey);
              const isNovo = overrideStatus === "recorrente" ? false
                : overrideStatus === "novo" ? true
                : !clientesVistoAte.has(clienteKey);
              if (isNovo) {
                cotacoesNovos++;
                valorOrcadoNovos += parseFloat(String(orc.total ?? "0")) || 0;
              }
            }
            Array.from(clientesEsteMes).forEach(c => clientesVistoAte.add(c));
            const ticketMedioNovos = osNovos > 0 ? parseFloat((faturamentoNovos / osNovos).toFixed(2)) : 0;
            const taxaConversaoNovos = cotacoesNovos > 0 ? parseFloat(((osNovos / cotacoesNovos) * 100).toFixed(1)) : 0;
            const taxaFaturamentoNovos = valorOrcadoNovos > 0 ? parseFloat(((faturamentoNovos / valorOrcadoNovos) * 100).toFixed(1)) : 0;
            novosMap.set(`${mes}_${ano}`, { osNovos, faturamentoNovos: parseFloat(faturamentoNovos.toFixed(2)), ticketMedioNovos, cotacoesNovos, taxaConversaoNovos, taxaFaturamentoNovos });
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
              clientesNovos: snap.clientesNovos ?? 0,
              // Expor como taxaConversaoNovos (nome usado pelo frontend) E taxaConvNovos (compat)
              taxaConvNovos: taxaConvNovosSnap,
              taxaConversaoNovos: taxaConvNovosSnap,
              faturamentoNovos: parseFloat(String(snap.faturamentoNovos ?? 0)),
              osNovos: osNovosSnap,
              ticketMedioNovos: novos?.ticketMedioNovos ?? 0,
              cotacoesNovos: cotacoesNovosSnap,
              taxaFaturamentoNovos: novos?.taxaFaturamentoNovos ?? 0,
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
              raw = await Promise.race([getMesFromApi(publicKey, accessToken, mes, ano), timeoutPromise]);
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
          const novos = novosMap.get(`${mes}_${ano}`) ?? { osNovos: 0, faturamentoNovos: 0, ticketMedioNovos: 0, cotacoesNovos: 0, taxaConversaoNovos: 0, taxaFaturamentoNovos: 0 };
          return { ...calcMetrics(raw.osNormais, raw.orcamentos, mes, ano), ...novos };
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

  upsertMeta: publicProcedure
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

  deleteMeta: publicProcedure
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
      const now = new Date();
      const mesAtual = now.getMonth() + 1;
      const anoAtual = now.getFullYear();
      const publicKey = ENV.MUBISYS_PUBLIC_KEY;
      const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
      const db = await getDb();

      // Buscar TODOS os dados do ano em uma única query (muito mais rápido)
      const todasOsAno = db ? await db.select().from(historicoOs).where(eq(historicoOs.ano, ano)) : [];
      const todosOrcAno = db ? await db.select().from(historicoOrcamentos).where(eq(historicoOrcamentos.ano, ano)) : [];

      const meses = Array.from({ length: 12 }, (_, i) => i + 1);
      const results = await Promise.all(
        meses.map(async (mes) => {
          const isMesAtual = mes === mesAtual && ano === anoAtual;
          let raw: any = null;
          if (isMesAtual && publicKey && accessToken) {
            raw = await getMesFromApi(publicKey, accessToken, mes, ano);
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
        })
      );
      return results; // array de 12, null para meses sem dados
    }),

  // Clientes novos do mês (primeira compra)
  getClientesNovos: publicProcedure
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      return getClientesNovosMes(input.mes, input.ano);
    }),

  // Clientes novos de todos os meses do ano (para gráfico anual) — versão otimizada
  getClientesNovosAno: publicProcedure
    .input(z.object({ ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      const { ano } = input;
      const now = new Date();
      const mesAtual = ano === now.getFullYear() ? now.getMonth() + 1 : 12;

      // FONTE ÚNICA DE VERDADE: usar getClientesNovosMes para cada mês
      // Isso garante que Marketing e Performance Comercial usem exatamente os mesmos dados
      // (API MubiSys + snapshots congelados), eliminando divergências com o banco local.
      // Executa em paralelo com concorrência limitada a 2 para não sobrecarregar a API MubiSys
      const meses = Array.from({ length: mesAtual }, (_, i) => i + 1);
      const CONCURRENCY = 2;
      const results: Array<{ mes: number; ticketMedioNovos: number; osNovos: number; faturamentoNovos: number; clientesNovosUnicos: number }> = [];

      for (let i = 0; i < meses.length; i += CONCURRENCY) {
        const batch = meses.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.allSettled(
          batch.map(async (mes) => {
            const dados = await getClientesNovosMes(mes, ano, false);
            return {
              mes,
              ticketMedioNovos: dados.ticketMedioNovos,
              osNovos: dados.osNovos,
              faturamentoNovos: dados.faturamentoNovos,
              clientesNovosUnicos: dados.total,
            };
          })
        );
        for (let j = 0; j < batchResults.length; j++) {
          const r = batchResults[j];
          const mes = batch[j];
          if (r.status === "fulfilled") {
            results.push(r.value);
          } else {
            results.push({ mes, ticketMedioNovos: 0, osNovos: 0, faturamentoNovos: 0, clientesNovosUnicos: 0 });
          }
        }
      }

      // Ordenar por mês para garantir ordem correta
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
        const [osResult, orcResult] = await Promise.all([
          listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial, datafinal }),
          listarOrcamentosMubiSys({ status: "TODOS", datainicial, datafinal }),
        ]);
        allOs = osResult.itens;
        allOrc = orcResult.itens;
        setCacheWithTTL(osCacheKey, allOs, mes, ano);
        setCacheWithTTL(orcCacheKey, allOrc, mes, ano);
      }

      const TIPOS_EXCLUIDOS = ["retrabalho", "amostra", "cortesia"];
      const osNormais = (allOs as any[]).filter((os: any) =>
        !TIPOS_EXCLUIDOS.includes((os.tipo || "").toLowerCase()) &&
        (os.status || "").toLowerCase() !== "cancelada"
      );
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
        const valor = parseFloat(String(os.valor_total ?? "0")) || 0;
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

  getInteligenteClientes: publicProcedure
    .input(z.object({
      dataInicial: z.string().regex(/^\d{4}-\d{2}$/).default(`${new Date().getFullYear()}-01`),
      dataFinal: z.string().regex(/^\d{4}-\d{2}$/).default(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`),
      forcarAtualizacao: z.boolean().optional().default(false),
    }))
    .query(async ({ input }) => {
      const { dataInicial, dataFinal, forcarAtualizacao } = input;
      const [anoIni, mesIni] = dataInicial.split('-').map(Number);
      const [anoFim, mesFim] = dataFinal.split('-').map(Number);
      const di = `${dataInicial}-01`;
      const lastDayFim = new Date(anoFim, mesFim, 0).getDate();
      const df = `${dataFinal}-${String(lastDayFim).padStart(2, '0')}`;
      const ano = anoIni; // usado para buscar clientes anteriores no histórico
      const periodoKey = `${dataInicial}_${dataFinal}`;
      const publicKey = ENV.MUBISYS_PUBLIC_KEY;
      const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
      const EMPTY = {
        clientesUnicosAno: 0,
        taxaRecompra: 0,
        clientesNovosAno: 0,
        pctClientesNovos: 0,
        clientesNovosQueRecompraram: 0,
        taxaRecompraNovosPct: 0,
        mediaComprasPorCliente: 0,
        pctClientesSemCompra6Meses: 0,
        clientesSemCompra6Meses: 0,
        tempoMedioPropostaFechamento: null as number | null,
        tempoMedianaPropostaFechamento: null as number | null,
        tempoP25: null as number | null,
        tempoP75: null as number | null,
        porVendedor: [] as Array<{
          vendedor: string;
          clientesUnicos: number;
          clientesNovos: number;
          pctClientesNovos: number;
          clientesNovosQueRecompraram: number;
          taxaRecompra: number;
          taxaRecompraNovosPct: number;
          mediaComprasPorCliente: number;
          tempoMedioFechamento: number | null;
        }>,
        distribuicaoTempo: [] as Array<{ faixa: string; quantidade: number }>,
      };

      if (!publicKey || !accessToken) return EMPTY;

      // ── Cache em banco: carrega instantaneamente, só recalcula quando solicitado ──
      const db = await getDb();
      if (db) {
        const rows = await db.select().from(inteligenciaClientesCache)
          .where(eq(inteligenciaClientesCache.periodoKey, periodoKey))
          .limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          // Se congelado, SEMPRE retornar do banco (nunca recalcular)
          if (row.congelado || !forcarAtualizacao) {
            const cached = JSON.parse(row.dadosJson);
            cached._calculadoEm = row.calculadoEm;
            cached._fonte = row.congelado ? 'congelado' : 'cache';
            cached._congelado = row.congelado;
            cached._congeladoEm = row.congeladoEm;
            return cached;
          }
        }
      }

      // Cache em memória (deduplicar chamadas simultâneas)
      const cacheKey = `inteligente_clientes_${periodoKey}`;
      const memCached = getCached(cacheKey);
      if (memCached) return memCached;

      let allOsAno: any[] = [];
      let allOrcAno: any[] = [];

      try {
        const [osResult, orcResult] = await Promise.all([
          listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial: di, datafinal: df }),
          listarOrcamentosMubiSys({ status: "TODOS", datainicial: di, datafinal: df }),
        ]);
        allOsAno = osResult.itens;
        allOrcAno = orcResult.itens;
      } catch {
        return EMPTY;
      }

      const TIPOS_EXCLUIDOS = ["retrabalho", "amostra", "cortesia"];
      const osNormais = allOsAno.filter((os: any) =>
        !TIPOS_EXCLUIDOS.includes((os.tipo || "").toLowerCase()) &&
        (os.status || "").toLowerCase() !== "cancelada"
      );

      const normNome = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();

      const clientesUnicosSet = new Set<string>();
      const clientesPorVendedor: Record<string, Set<string>> = {};

      for (const os of osNormais) {
        const cliente = normNome(os.cliente || os.empresa || "");
        const vendedor = os.vendedor || "Sem Vendedor";
        if (!cliente) continue;
        clientesUnicosSet.add(cliente);
        if (!clientesPorVendedor[vendedor]) clientesPorVendedor[vendedor] = new Set();
        clientesPorVendedor[vendedor].add(cliente);
      }

      const dbForHistory = await getDb();
      const clientesAnteriores = dbForHistory ? await dbForHistory
        .select({ empresa: historicoOs.empresa })
        .from(historicoOs)
        .where(sql`${historicoOs.ano} < ${ano}`) : [];
      const setAnteriores = new Set(clientesAnteriores.map((r: any) => normNome(r.empresa ?? "")));

      const clientesNovosSet = new Set<string>();
      const clientesNovosSetPorVendedor: Record<string, Set<string>> = {};

      for (const os of osNormais) {
        const cliente = normNome(os.cliente || os.empresa || "");
        const vendedor = os.vendedor || "Sem Vendedor";
        if (!cliente || setAnteriores.has(cliente)) continue;
        clientesNovosSet.add(cliente);
        if (!clientesNovosSetPorVendedor[vendedor]) clientesNovosSetPorVendedor[vendedor] = new Set();
        clientesNovosSetPorVendedor[vendedor].add(cliente);
      }

      const comprasPorCliente: Record<string, Set<string>> = {};
      for (const os of osNormais) {
        const cliente = normNome(os.cliente || os.empresa || "");
        if (!cliente) continue;
        const mesStr = (os.data_aprovacao || os.data_cadastro || "").substring(0, 7);
        if (!comprasPorCliente[cliente]) comprasPorCliente[cliente] = new Set();
        if (mesStr) comprasPorCliente[cliente].add(mesStr);
      }

      let clientesComRecompra = 0;
      for (const [, meses] of Object.entries(comprasPorCliente)) {
        if (meses.size >= 2) clientesComRecompra++;
      }

      const taxaRecompra = clientesUnicosSet.size > 0
        ? parseFloat(((clientesComRecompra / clientesUnicosSet.size) * 100).toFixed(1))
        : 0;

      let clientesNovosQueRecompraram = 0;
      const clientesNovosQueRecompraramPorVendedor: Record<string, number> = {};

      for (const cliente of clientesNovosSet) {
        if ((comprasPorCliente[cliente]?.size ?? 0) >= 2) clientesNovosQueRecompraram++;
      }

      for (const [vendedor, setNovos] of Object.entries(clientesNovosSetPorVendedor)) {
        let count = 0;
        for (const cliente of setNovos) {
          if ((comprasPorCliente[cliente]?.size ?? 0) >= 2) count++;
        }
        clientesNovosQueRecompraramPorVendedor[vendedor] = count;
      }

      // ── Média de compras (OS) por cliente no ano ──────────────────────────────
      // Conta total de OS por cliente e calcula a média
      const osPorCliente: Record<string, number> = {};
      for (const os of osNormais) {
        const cliente = normNome(os.cliente || os.empresa || "");
        if (!cliente) continue;
        osPorCliente[cliente] = (osPorCliente[cliente] ?? 0) + 1;
      }
      const totalOsNormais = Object.values(osPorCliente).reduce((a, b) => a + b, 0);
      const mediaComprasPorCliente = clientesUnicosSet.size > 0
        ? parseFloat((totalOsNormais / clientesUnicosSet.size).toFixed(1))
        : 0;

      // ── Clientes sem compra há mais de 6 meses (relativo a hoje) ─────────────
      // Considera apenas clientes que compraram no ano selecionado
      const hoje = new Date();
      const seisAtras = new Date(hoje);
      seisAtras.setMonth(seisAtras.getMonth() - 6);

      // Última data de OS por cliente (no ano selecionado)
      const ultimaCompraCliente: Record<string, Date> = {};
      for (const os of osNormais) {
        const cliente = normNome(os.cliente || os.empresa || "");
        if (!cliente) continue;
        const dataStr = os.data_aprovacao || os.data_cadastro;
        if (!dataStr) continue;
        const dt = new Date(dataStr);
        if (isNaN(dt.getTime())) continue;
        if (!ultimaCompraCliente[cliente] || dt > ultimaCompraCliente[cliente]) {
          ultimaCompraCliente[cliente] = dt;
        }
      }

      let clientesSemCompra6Meses = 0;
      const clientesSemCompra6MesesPorVendedor: Record<string, number> = {};
      for (const cliente of clientesUnicosSet) {
        const ultima = ultimaCompraCliente[cliente];
        if (!ultima || ultima < seisAtras) clientesSemCompra6Meses++;
      }
      // Por vendedor
      for (const [vendedor, setClientes] of Object.entries(clientesPorVendedor)) {
        let count = 0;
        for (const cliente of setClientes) {
          const ultima = ultimaCompraCliente[cliente];
          if (!ultima || ultima < seisAtras) count++;
        }
        clientesSemCompra6MesesPorVendedor[vendedor] = count;
      }

      const pctClientesSemCompra6Meses = clientesUnicosSet.size > 0
        ? parseFloat(((clientesSemCompra6Meses / clientesUnicosSet.size) * 100).toFixed(1))
        : 0;

      // ── % de clientes novos entre clientes únicos ─────────────────────────────
      const pctClientesNovos = clientesUnicosSet.size > 0
        ? parseFloat(((clientesNovosSet.size / clientesUnicosSet.size) * 100).toFixed(1))
        : 0;

      // ── Taxa de recompra de novos clientes ────────────────────────────────────
      const taxaRecompraNovosPct = clientesNovosSet.size > 0
        ? parseFloat(((clientesNovosQueRecompraram / clientesNovosSet.size) * 100).toFixed(1))
        : 0;

      const orcPorNumero: Record<string, any> = {};
      // NÃO filtrar por versao === versao_atual: a API já retorna apenas a versão atual por padrão
      const orcVersaoAtualIC = allOrcAno;
      for (const orc of orcVersaoAtualIC) {
        const num = String(orc.numero || orc.id || "");
        if (num) orcPorNumero[num] = orc;
      }

      const tempos: number[] = [];
      const temposPorVendedor: Record<string, number[]> = {};

      for (const os of osNormais) {
        const dataAprov = os.data_aprovacao || os.data_cadastro;
        const orcNum = String(os.orcamento_numero || os.orcamento || os.numero_orcamento || "");
        if (!dataAprov || !orcNum) continue;
        const orc = orcPorNumero[orcNum];
        if (!orc) continue;
        const dataCad = orc.data_cadastro;
        if (!dataCad) continue;
        const dtAprov = new Date(dataAprov);
        const dtCad = new Date(dataCad);
        const diffDias = (dtAprov.getTime() - dtCad.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDias < 0 || diffDias > 365) continue;
        tempos.push(diffDias);
        const vendedor = os.vendedor || "Sem Vendedor";
        if (!temposPorVendedor[vendedor]) temposPorVendedor[vendedor] = [];
        temposPorVendedor[vendedor].push(diffDias);
      }

      const calcStats = (arr: number[]) => {
        if (arr.length === 0) return { media: null as number | null, mediana: null as number | null, p25: null as number | null, p75: null as number | null };
        const sorted = [...arr].sort((a, b) => a - b);
        const media = parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
        const mid = Math.floor(sorted.length / 2);
        const mediana = parseFloat((sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]).toFixed(1));
        const p25 = parseFloat(sorted[Math.floor(sorted.length * 0.25)].toFixed(1));
        const p75 = parseFloat(sorted[Math.floor(sorted.length * 0.75)].toFixed(1));
        return { media, mediana, p25, p75 };
      };

      const stats = calcStats(tempos);

      const faixas = [
        { label: "Mesmo dia", min: 0, max: 0 },
        { label: "1-3 dias", min: 1, max: 3 },
        { label: "4-7 dias", min: 4, max: 7 },
        { label: "8-15 dias", min: 8, max: 15 },
        { label: "16-30 dias", min: 16, max: 30 },
        { label: ">30 dias", min: 31, max: 999 },
      ];
      const distribuicaoTempo = faixas.map(f => ({
        faixa: f.label,
        quantidade: tempos.filter(t => t >= f.min && t <= f.max).length,
      }));

      const todosVendedoresIC = new Set([
        ...Object.keys(clientesPorVendedor),
        ...Object.keys(clientesNovosSetPorVendedor),
      ]);

      const porVendedor = Array.from(todosVendedoresIC)
        .filter(v => v !== "Sem Vendedor")
        .map(v => {
          const unicos = clientesPorVendedor[v]?.size ?? 0;
          const novos = clientesNovosSetPorVendedor[v]?.size ?? 0;
          const novosRecompra = clientesNovosQueRecompraramPorVendedor[v] ?? 0;
          const temposV = temposPorVendedor[v] ?? [];
          const statsV = calcStats(temposV);
          let recompraV = 0;
          if (clientesPorVendedor[v]) {
            for (const cliente of clientesPorVendedor[v]) {
              if ((comprasPorCliente[cliente]?.size ?? 0) >= 2) recompraV++;
            }
          }
          const taxaRecompraV = unicos > 0 ? parseFloat(((recompraV / unicos) * 100).toFixed(1)) : 0;
          const taxaRecompraNovosPctV = novos > 0 ? parseFloat(((novosRecompra / novos) * 100).toFixed(1)) : 0;
          const pctNovosV = unicos > 0 ? parseFloat(((novos / unicos) * 100).toFixed(1)) : 0;
          // Média de compras por cliente do vendedor
          let totalOsV = 0;
          if (clientesPorVendedor[v]) {
            for (const cliente of clientesPorVendedor[v]) {
              totalOsV += osPorCliente[cliente] ?? 0;
            }
          }
          const mediaComprasV = unicos > 0 ? parseFloat((totalOsV / unicos).toFixed(1)) : 0;
          return {
            vendedor: v,
            clientesUnicos: unicos,
            clientesNovos: novos,
            pctClientesNovos: pctNovosV,
            clientesNovosQueRecompraram: novosRecompra,
            taxaRecompra: taxaRecompraV,
            taxaRecompraNovosPct: taxaRecompraNovosPctV,
            mediaComprasPorCliente: mediaComprasV,
            tempoMedioFechamento: statsV.media,
          };
        })
        .sort((a, b) => b.clientesUnicos - a.clientesUnicos);

      const result = {
        clientesUnicosAno: clientesUnicosSet.size,
        taxaRecompra,
        clientesNovosAno: clientesNovosSet.size,
        pctClientesNovos,
        clientesNovosQueRecompraram,
        taxaRecompraNovosPct,
        mediaComprasPorCliente,
        pctClientesSemCompra6Meses,
        clientesSemCompra6Meses,
        tempoMedioPropostaFechamento: stats.media,
        tempoMedianaPropostaFechamento: stats.mediana,
        tempoP25: stats.p25,
        tempoP75: stats.p75,
        porVendedor,
        distribuicaoTempo,
      };

      // Salvar no cache em memória
      setCacheWithTTL(cacheKey, result, new Date().getMonth() + 1, ano);

      // Salvar no banco de dados (upsert por periodoKey)
      if (db) {
        try {
          const existing = await db.select({ id: inteligenciaClientesCache.id })
            .from(inteligenciaClientesCache)
            .where(eq(inteligenciaClientesCache.periodoKey, periodoKey))
            .limit(1);
          if (existing.length > 0) {
            await db.update(inteligenciaClientesCache)
              .set({ dadosJson: JSON.stringify(result), calculadoEm: new Date() })
              .where(eq(inteligenciaClientesCache.periodoKey, periodoKey));
          } else {
            await db.insert(inteligenciaClientesCache)
              .values({ periodoKey, dadosJson: JSON.stringify(result), calculadoEm: new Date() });
          }
        } catch (e) {
          // Não bloquear o retorno se o cache falhar
          console.error('[IC cache] Erro ao salvar cache:', e);
        }
      }

      const resultWithTs = { ...result, _calculadoEm: new Date() };
      return resultWithTs;
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
      // Limpar cache para forçar nova busca da API
      deleteCache(`mes_${input.mes}_${input.ano}`);
      deleteCache(`os_raw_${input.mes}_${input.ano}`);
      deleteCache(`orc_raw_${input.mes}_${input.ano}`);
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
      const TIPOS_EXCLUIDOS = ['retrabalho', 'amostra', 'cortesia'];
      const osNormais = allOs.filter(o =>
        !TIPOS_EXCLUIDOS.includes((o.tipo || '').toLowerCase()) &&
        (o.status || '').toLowerCase() !== 'cancelada'
      );
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
  auditarMeses: publicProcedure
    .input(z.object({
      meses: z.array(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    }))
    .query(async ({ input }) => {
      const publicKey = ENV.MUBISYS_PUBLIC_KEY;
      const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
      const resultados: any[] = [];

      for (const { mes, ano } of input.meses) {
        try {
          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("timeout_90s")), 90000)
          );
          const raw = await Promise.race([
            getMesFromApi(publicKey, accessToken, mes, ano),
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

  // ─── CONGELAMENTO DA INTELIGÊNCIA DE CLIENTES ────────────────────────────────

  /** Congela o cache de inteligência de clientes para um período específico */
  congelarInteligencia: protectedProcedure
    .input(z.object({
      periodoKey: z.string().regex(/^\d{4}-\d{2}_\d{4}-\d{2}$/),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB indisponível');
      const rows = await db.select().from(inteligenciaClientesCache)
        .where(eq(inteligenciaClientesCache.periodoKey, input.periodoKey))
        .limit(1);
      if (rows.length === 0) throw new Error('Nenhum dado calculado para este período. Clique em "Atualizar Dados" primeiro.');
      await db.update(inteligenciaClientesCache)
        .set({ congelado: true, congeladoEm: new Date() })
        .where(eq(inteligenciaClientesCache.periodoKey, input.periodoKey));
      return { ok: true };
    }),

  /** Descongela o cache de inteligência de clientes para um período específico */
  descongelarInteligencia: protectedProcedure
    .input(z.object({
      periodoKey: z.string().regex(/^\d{4}-\d{2}_\d{4}-\d{2}$/),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB indisponível');
      await db.update(inteligenciaClientesCache)
        .set({ congelado: false, congeladoEm: null })
        .where(eq(inteligenciaClientesCache.periodoKey, input.periodoKey));
      return { ok: true };
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
  setContatado: publicProcedure
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
});
