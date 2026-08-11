/**
 * Heartbeat Job: Sincronização Diária de OSs do ERP
 * 
 * Este arquivo define um job que:
 * 1. Executa AGORA (primeira sincronização)
 * 2. Repete DIARIAMENTE no mesmo horário
 * 3. Armazena APENAS OSs dos últimos 30 dias
 * 4. Remove OSs antigas automaticamente
 */

import { defineHeartbeatJob } from "../_core/heartbeat";
import { db } from "../db/db";
import { syncLogs, erpOsCache, InsertErpOsCache } from "../../drizzle/schema";
import { eq, sql, lt } from "drizzle-orm";

/**
 * Buscar OSs do MubiSys (últimos 30 dias)
 * TODO: Integrar com API real do MubiSys
 */
async function buscarOsDoMubisys(): Promise<Array<{
  numero_os: string;
  razao_social: string;
  cnpj: string;
  email?: string;
  cep?: string;
  municipio?: string;
  estado?: string;
  endereco?: string;
  telefone?: string;
  status?: string;
  valor_total?: number;
  descricao?: string;
}>> {
  try {
    console.log("🔍 [SYNC-HEARTBEAT] Buscando OSs do MubiSys...");

    // ✅ Simulação: Em produção, substitua por chamada real à API MubiSys
    // Exemplo de integração real:
    // const response = await fetch('https://api.mubisys.com/os?dias=30', {
    //   headers: { 'Authorization': `Bearer ${process.env.MUBISYS_ACCESS_TOKEN}` }
    // });
    // return response.json();

    // Para teste, retornar dados simulados
    const osSimuladas = [
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
    ];

    console.log(`✅ [SYNC-HEARTBEAT] ${osSimuladas.length} OSs encontradas`);
    return osSimuladas;
  } catch (error) {
    console.error("❌ [SYNC-HEARTBEAT] Erro ao buscar OSs:", error);
    throw error;
  }
}

/**
 * Sincronizar uma OS individual
 */
async function sincronizarOsIndividual(osData: any): Promise<void> {
  try {
    // Verificar se OS já existe
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
      status: osData.status,
      valorTotal: osData.valor_total?.toString(),
      descricao: osData.descricao,
    };

    if (osExistente.length > 0) {
      // Atualizar OS existente
      await db
        .update(erpOsCache)
        .set(cacheData)
        .where(eq(erpOsCache.numeroOs, osData.numero_os));

      console.log(`🔄 [SYNC-HEARTBEAT] OS ${osData.numero_os} atualizada`);
    } else {
      // Inserir nova OS
      await db.insert(erpOsCache).values(cacheData);
      console.log(`✨ [SYNC-HEARTBEAT] OS ${osData.numero_os} inserida`);
    }
  } catch (error) {
    console.error(
      `❌ [SYNC-HEARTBEAT] Erro ao sincronizar OS ${osData.numero_os}:`,
      error
    );
    throw error;
  }
}

/**
 * Limpar OSs antigas (mais de 30 dias)
 */
async function limparOsAntigas(): Promise<number> {
  try {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 30);

    const resultado = await db
      .delete(erpOsCache)
      .where(lt(erpOsCache.sincronizadoEm, dataLimite));

    console.log(
      `🗑️ [SYNC-HEARTBEAT] ${resultado.rowsAffected || 0} OSs antigas removidas`
    );
    return resultado.rowsAffected || 0;
  } catch (error) {
    console.error("❌ [SYNC-HEARTBEAT] Erro ao limpar OSs antigas:", error);
    return 0;
  }
}

/**
 * Job Principal: Sincronização Diária
 */
export const syncErpHeartbeatJob = defineHeartbeatJob({
  id: "sync-erp-daily",
  name: "Sincronização Diária de OSs do ERP",
  description:
    "Sincroniza OSs dos últimos 30 dias do MubiSys e remove dados antigos",

  // ✅ AGORA: Executar imediatamente na primeira vez
  // DEPOIS: Repetir diariamente no mesmo horário
  schedule: "0 2 * * *", // 02:00 AM todos os dias
  runImmediately: true, // ✅ CRÍTICO: Executar AGORA também

  async handler() {
    const inicioExecucao = Date.now();
    let quantidadeImportada = 0;
    let quantidadeLimpa = 0;
    let statusExecucao: "SUCESSO" | "ERRO" = "SUCESSO";
    let mensagemErro: string | null = null;

    try {
      console.log("🚀 [SYNC-HEARTBEAT] Iniciando sincronização de OSs...");

      // ✅ PASSO 1: Buscar OSs dos últimos 30 dias
      const osListaDoErp = await buscarOsDoMubisys();

      if (osListaDoErp.length === 0) {
        console.warn("⚠️ [SYNC-HEARTBEAT] Nenhuma OS encontrada no ERP");
        quantidadeImportada = 0;
      } else {
        // ✅ PASSO 2: Sincronizar cada OS
        for (const osData of osListaDoErp) {
          try {
            await sincronizarOsIndividual(osData);
            quantidadeImportada++;
          } catch (err) {
            console.error(
              `❌ [SYNC-HEARTBEAT] Erro ao sincronizar OS ${osData.numero_os}:`,
              err
            );
            // Continuar com próxima OS mesmo se uma falhar
          }
        }

        console.log(
          `✅ [SYNC-HEARTBEAT] ${quantidadeImportada} OSs sincronizadas`
        );
      }

      // ✅ PASSO 3: Limpar OSs antigas (mais de 30 dias)
      quantidadeLimpa = await limparOsAntigas();

      // ✅ PASSO 4: Registrar execução nos logs
      const tempoExecucaoMs = Date.now() - inicioExecucao;
      const proximaExecucao = new Date();
      proximaExecucao.setDate(proximaExecucao.getDate() + 1);
      proximaExecucao.setHours(2, 0, 0, 0);

      await db.insert(syncLogs).values({
        quantidadeOsImportadas: quantidadeImportada,
        status: statusExecucao,
        mensagemErro: mensagemErro,
        tempoExecucaoMs: tempoExecucaoMs,
        proximaExecucao: proximaExecucao,
      });

      console.log(
        `📝 [SYNC-HEARTBEAT] Sincronização concluída em ${tempoExecucaoMs}ms`
      );
      console.log(
        `📊 [SYNC-HEARTBEAT] Resumo: ${quantidadeImportada} importadas, ${quantidadeLimpa} removidas`
      );

      return {
        success: true,
        message: `Sincronização concluída: ${quantidadeImportada} OSs importadas, ${quantidadeLimpa} removidas`,
        data: {
          quantidadeImportada,
          quantidadeLimpa,
          tempoExecucaoMs,
        },
      };
    } catch (error: any) {
      statusExecucao = "ERRO";
      mensagemErro = error.message || "Erro desconhecido na sincronização";

      console.error("❌ [SYNC-HEARTBEAT] Erro na sincronização:", error);

      // Registrar erro nos logs
      try {
        await db.insert(syncLogs).values({
          quantidadeOsImportadas: quantidadeImportada,
          status: statusExecucao,
          mensagemErro: mensagemErro,
          tempoExecucaoMs: Date.now() - inicioExecucao,
        });
      } catch (logError) {
        console.error("[SYNC-HEARTBEAT] Erro ao registrar log:", logError);
      }

      return {
        success: false,
        message: `Erro na sincronização: ${mensagemErro}`,
        error: mensagemErro,
      };
    }
  },
});
