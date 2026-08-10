/**
 * Serviço de Sincronização Diária com ERP (MubiSys)
 * Executa automaticamente às 02:00 AM todos os dias
 * Busca OSs dos últimos 30 dias e armazena em cache local
 */

import { getDb } from "./db";

let db: any = null;

async function initDb() {
  if (!db) {
    db = await getDb();
  }
  return db;
}
import { syncLogs, erpOsCache, InsertErpOsCache, InsertSyncLog } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { buscarDadosOSParaFrete } from "./mubisys-frete";

interface ErpOsData {
  numero_os: string;
  razao_social: string;
  cnpj: string;
  email?: string;
  cep?: string;
  municipio?: string;
  estado?: string;
  endereco?: string;
  telefone?: string;
  data_emissao?: string;
  data_entrega_prevista?: string;
  status?: string;
  valor_total?: number;
  descricao?: string;
}

/**
 * Função principal de sincronização
 * Busca OSs do MubiSys e armazena no banco local
 */
export async function sincronizarOsDoErp(): Promise<void> {
  const inicioExecucao = Date.now();
  let quantidadeImportada = 0;
  let statusExecucao: "SUCESSO" | "ERRO" = "SUCESSO";
  let mensagemErro: string | null = null;

  try {
    console.log("🔄 [SYNC] Iniciando sincronização de OSs do ERP...");

    // ✅ PASSO 1: Buscar OSs dos últimos 30 dias
    const osListaDoErp = await buscarOsDoMubisys();
    console.log(`📊 [SYNC] Total de OSs encontradas: ${osListaDoErp.length}`);

    if (osListaDoErp.length === 0) {
      console.warn("⚠️ [SYNC] Nenhuma OS encontrada no ERP");
      quantidadeImportada = 0;
    } else {
      // ✅ PASSO 2: Sincronizar cada OS no banco local
      for (const osData of osListaDoErp) {
        try {
          await sincronizarOsIndividual(osData);
          quantidadeImportada++;
        } catch (err) {
          console.error(`❌ [SYNC] Erro ao sincronizar OS ${osData.numero_os}:`, err);
          // Continuar com próxima OS mesmo se uma falhar
        }
      }

      console.log(`✅ [SYNC] ${quantidadeImportada} OSs sincronizadas com sucesso`);
    }
  } catch (error: any) {
    statusExecucao = "ERRO";
    mensagemErro = error.message || "Erro desconhecido na sincronização";
    console.error("❌ [SYNC] Erro na sincronização:", error);
  }

  // ✅ PASSO 3: Registrar execução nos logs
  const tempoExecucaoMs = Date.now() - inicioExecucao;
  const proximaExecucao = calcularProximaExecucao();

  try {
    await db.insert(syncLogs).values({
      quantidadeOsImportadas: quantidadeImportada,
      status: statusExecucao,
      mensagemErro: mensagemErro,
      tempoExecucaoMs: tempoExecucaoMs,
      proximaExecucao: proximaExecucao,
    } as InsertSyncLog);

    console.log(
      `📝 [SYNC] Log de execução registrado: ${statusExecucao} (${tempoExecucaoMs}ms)`
    );
  } catch (logError) {
    console.error("❌ [SYNC] Erro ao registrar log:", logError);
  }
}

/**
 * Buscar OSs do MubiSys (últimos 30 dias)
 */
async function buscarOsDoMubisys(): Promise<ErpOsData[]> {
  try {
    // ✅ Aqui você integraria com a API real do MubiSys
    // Por enquanto, retornamos dados simulados para teste
    // Em produção, substitua por chamada real à API

    console.log("🔍 [SYNC] Buscando OSs do MubiSys...");

    // Simulação: buscar últimas 30 OSs
    // TODO: Integrar com API real do MubiSys
    const osSimuladas: ErpOsData[] = [
      {
        numero_os: "6906",
        razao_social: "DENIS RODRIGUES DE OLIVEIRA",
        cnpj: "43.001.533/0001-09",
        email: "contato@denisrodrigues.com.br",
        cep: "16901-125",
        municipio: "ANDRADINA",
        estado: "SP",
        endereco: "Rua das Flores, 123",
        telefone: "(18) 3000-0000",
        status: "ativa",
        valor_total: 5000.0,
        descricao: "Letreiro em Acrílico - Frontlight",
      },
      // Adicione mais OSs conforme necessário
    ];

    return osSimuladas;
  } catch (error) {
    console.error("❌ [SYNC] Erro ao buscar OSs do MubiSys:", error);
    throw error;
  }
}

/**
 * Sincronizar uma OS individual
 */
async function sincronizarOsIndividual(osData: ErpOsData): Promise<void> {
  try {
    // ✅ Verificar se OS já existe
    const osExistente = await db
      .select()
      .from(erpOsCache)
      .where(eq(erpOsCache.numeroOs, osData.numero_os))
      .limit(1);

    const cacheData: InsertErpOsCache = {
      numeroOs: osData.numero_os,
      razaoSocial: osData.razao_social,
      cnpj: osData.cnpj,
      email: osData.email,
      cep: osData.cep,
      municipio: osData.municipio,
      estado: osData.estado,
      endereco: osData.endereco,
      telefone: osData.telefone,
      dataEmissao: osData.data_emissao ? new Date(osData.data_emissao) : null,
      dataEntregaPrevista: osData.data_entrega_prevista
        ? new Date(osData.data_entrega_prevista)
        : null,
      status: osData.status,
      valorTotal: osData.valor_total ? osData.valor_total.toString() : null,
      descricao: osData.descricao,
    };

    if (osExistente.length > 0) {
      // ✅ Atualizar OS existente
      await db
        .update(erpOsCache)
        .set(cacheData)
        .where(eq(erpOsCache.numeroOs, osData.numero_os));

      console.log(`🔄 [SYNC] OS ${osData.numero_os} atualizada`);
    } else {
      // ✅ Inserir nova OS
      await db.insert(erpOsCache).values(cacheData);
      console.log(`✨ [SYNC] OS ${osData.numero_os} inserida`);
    }
  } catch (error) {
    console.error(`❌ [SYNC] Erro ao sincronizar OS ${osData.numero_os}:`, error);
    throw error;
  }
}

/**
 * Calcular próxima execução (amanhã às 02:00 AM)
 */
function calcularProximaExecucao(): Date {
  const agora = new Date();
  const proxima = new Date(agora);

  // Definir para amanhã às 02:00 AM
  proxima.setDate(proxima.getDate() + 1);
  proxima.setHours(2, 0, 0, 0);

  return proxima;
}

/**
 * Buscar última sincronização bem-sucedida
 */
export async function obterUltimaSincronizacao() {
  try {
    const ultimoLog = await db
      .select()
      .from(syncLogs)
      .where(eq(syncLogs.status, "SUCESSO"))
      .orderBy(sql`${syncLogs.dataExecucao} DESC`)
      .limit(1);

    return ultimoLog[0] || null;
  } catch (error) {
    console.error("❌ [SYNC] Erro ao buscar última sincronização:", error);
    return null;
  }
}

/**
 * Obter estatísticas de cache
 */
export async function obterEstatisticasCache() {
  try {
    const totalOsCache = await db.select().from(erpOsCache);
    const ultimoLog = await obterUltimaSincronizacao();

    return {
      totalOs: totalOsCache.length,
      ultimaSincronizacao: ultimoLog?.dataExecucao,
      status: ultimoLog?.status || "PENDENTE",
      proximaExecucao: ultimoLog?.proximaExecucao,
    };
  } catch (error) {
    console.error("❌ [SYNC] Erro ao obter estatísticas:", error);
    return {
      totalOs: 0,
      ultimaSincronizacao: null,
      status: "ERRO",
      proximaExecucao: null,
    };
  }
}

/**
 * Buscar OS no cache local (fallback para API)
 */
export async function buscarOsNoCache(numeroOs: string) {
  try {
    const osCache = await db
      .select()
      .from(erpOsCache)
      .where(eq(erpOsCache.numeroOs, numeroOs))
      .limit(1);

    if (osCache.length > 0) {
      console.log(`✅ [CACHE] OS ${numeroOs} encontrada no cache local`);
      return osCache[0];
    }

    console.log(`⚠️ [CACHE] OS ${numeroOs} não encontrada no cache, fallback para API`);
    return null;
  } catch (error) {
    console.error(`❌ [CACHE] Erro ao buscar OS ${numeroOs}:`, error);
    return null;
  }
}

/**
 * Forçar sincronização manual (para botão no painel)
 */
export async function forcarSincronizacaoManual(): Promise<{
  sucesso: boolean;
  mensagem: string;
}> {
  try {
    console.log("🚀 [SYNC] Sincronização manual iniciada pelo usuário");
    await sincronizarOsDoErp();
    return {
      sucesso: true,
      mensagem: "Sincronização manual concluída com sucesso",
    };
  } catch (error: any) {
    return {
      sucesso: false,
      mensagem: `Erro na sincronização: ${error.message}`,
    };
  }
}
