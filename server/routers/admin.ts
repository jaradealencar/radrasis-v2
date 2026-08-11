import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const adminRouter = router({
  // ✅ Obter status de sincronização
  obterStatusSincronizacao: publicProcedure.query(async () => {
    try {
      const { selectQuery } = await import("../db/db-connection");

      const logs = await selectQuery(
        `SELECT "dataExecucao", status, "quantidadeOsImportadas", "mensagemErro" FROM sync_logs ORDER BY "dataExecucao" DESC LIMIT 1`,
        [],
      );
      const ultimoLog = logs?.[0] ?? null;

      const countRows = await selectQuery("SELECT COUNT(*) AS total FROM erp_os_cache", []);
      const totalOs = Number(countRows?.[0]?.total ?? 0);

      // Calcular próxima execução (02:00 AM do próximo dia)
      const agora = new Date();
      const proximaExecucao = new Date(agora);
      proximaExecucao.setDate(proximaExecucao.getDate() + 1);
      proximaExecucao.setHours(2, 0, 0, 0);

      return {
        status: ultimoLog?.status || "NUNCA_EXECUTADO",
        ultimaSincronizacao: ultimoLog?.dataExecucao ?? null,
        proximaExecucao: proximaExecucao.toISOString(),
        totalOs,
        mensagemErro: ultimoLog?.mensagemErro ?? null,
        tempoExecucaoMs: null,
        quantidadeImportada: Number(ultimoLog?.quantidadeOsImportadas ?? 0),
      };
    } catch (error: any) {
      console.error("[Admin] Erro ao obter status:", error);
      return {
        status: "ERRO",
        ultimaSincronizacao: null,
        proximaExecucao: null,
        totalOs: 0,
        mensagemErro: error.message,
        tempoExecucaoMs: null,
        quantidadeImportada: 0,
      };
    }
  }),

  // ✅ Forçar sincronização manual
  forcarSincronizacaoManual: publicProcedure.mutation(async () => {
    try {
      console.log("🔄 [Admin] Iniciando sincronização manual...");

      // Usa a rotina corrigida (colunas reais do cache + log em sync_logs)
      const { sincronizarOSDoMubiSys } = await import("../sync/scheduled-sync-os");
      const resultado = await sincronizarOSDoMubiSys();

      console.log("✅ [Admin] Sincronização manual concluída:", resultado);

      return {
        success: true,
        mensagem: `Sincronização concluída: ${resultado.quantidadeOsImportadas} OS processadas`,
        resultado,
      };
    } catch (error: any) {
      console.error("[Admin] Erro ao forçar sincronização:", error);
      throw new Error(`Erro ao sincronizar: ${error.message}`);
    }
  }),

  // ✅ Obter histórico de sincronizações
  obterHistoricoSincronizacoes: publicProcedure
    .input(z.object({ limite: z.number().default(10) }))
    .query(async ({ input }) => {
      try {
        const { selectQuery } = await import("../db/db-connection");
        const limite = Math.max(1, Math.min(Number(input.limite) || 10, 100));
        const logs = await selectQuery(
          `SELECT id, "dataExecucao", status, "quantidadeOsImportadas", "mensagemErro"
           FROM sync_logs ORDER BY "dataExecucao" DESC LIMIT ${limite}`,
          [],
        );

        return logs.map((log: any) => ({
          id: log.id,
          dataExecucao: log.dataExecucao,
          status: log.status,
          quantidadeOsImportadas: Number(log.quantidadeOsImportadas ?? 0),
          mensagemErro: log.mensagemErro ?? null,
          tempoExecucaoMs: null,
        }));
      } catch (error: any) {
        console.error("[Admin] Erro ao obter histórico:", error);
        return [];
      }
    }),

  // ✅ Limpar cache de OSs antigas (>30 dias)
  limparCacheAntigo: publicProcedure.mutation(async () => {
    try {
      console.log("🗑️ [Admin] Limpando cache de OSs antigas...");

      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 30);

      const { mutationQuery } = await import("../db/db-connection");
      const resultado: any = await mutationQuery(
        `DELETE FROM erp_os_cache WHERE "sincronizadoEm" < ?`,
        [dataLimite],
      );
      const removidas = Number(resultado?.affectedRows ?? 0);
      console.log(`✅ [Admin] Cache limpo: ${removidas} OS removida(s)`);

      return {
        success: true,
        mensagem: `Cache limpo: ${removidas} OS com mais de 30 dias removida(s)`,
        removidas,
      };
    } catch (error: any) {
      console.error("[Admin] Erro ao limpar cache:", error);
      throw new Error(`Erro ao limpar cache: ${error.message}`);
    }
  }),
});
