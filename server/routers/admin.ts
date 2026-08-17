import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

/** Próxima execução do lote 1 do agendamento (06:00 UTC = 03:00 BRT). Ver docs/cron-qstash.md. */
function calcularProximaExecucao(): string {
  const agora = new Date();
  const proxima = new Date(agora);
  proxima.setUTCHours(6, 0, 0, 0);
  if (proxima <= agora) proxima.setUTCDate(proxima.getUTCDate() + 1);
  return proxima.toISOString();
}

export const adminRouter = router({
  // ✅ Obter status de sincronização — agrega as execuções das últimas 24h
  // porque o agendamento roda em 4 lotes/dia (Fase 3 da sprint MubiSys): ler
  // só a última linha mostraria apenas o lote mais recente e subestimaria o
  // total de OS importadas no dia.
  obterStatusSincronizacao: publicProcedure.query(async () => {
    try {
      const { selectQuery } = await import("../db/db-connection");

      const logs = await selectQuery(
        `SELECT "dataExecucao", status, "quantidadeOsImportadas", "mensagemErro", "tempoExecucaoMs"
         FROM sync_logs
         WHERE "dataExecucao" >= NOW() - INTERVAL '24 hours'
         ORDER BY "dataExecucao" DESC`,
        [],
      );

      const countRows = await selectQuery("SELECT COUNT(*) AS total FROM erp_os_cache", []);
      const totalOs = Number(countRows?.[0]?.total ?? 0);

      if (!logs || logs.length === 0) {
        return {
          status: "NUNCA_EXECUTADO",
          ultimaSincronizacao: null,
          proximaExecucao: calcularProximaExecucao(),
          totalOs,
          mensagemErro: null,
          tempoExecucaoMs: null,
          quantidadeImportada: 0,
          execucoes24h: 0,
        };
      }

      const algumErro = logs.find((l: any) => l.status === "ERRO");
      const algumPendente = logs.some((l: any) => l.status === "PENDENTE");
      const status = algumErro ? "ERRO" : algumPendente ? "PENDENTE" : "SUCESSO";
      const quantidadeImportada = logs.reduce(
        (soma: number, l: any) => soma + Number(l.quantidadeOsImportadas ?? 0),
        0,
      );
      const ultimoLog = logs[0];

      return {
        status,
        ultimaSincronizacao: ultimoLog.dataExecucao,
        proximaExecucao: calcularProximaExecucao(),
        totalOs,
        mensagemErro: algumErro?.mensagemErro ?? null,
        tempoExecucaoMs: ultimoLog.tempoExecucaoMs ?? null,
        quantidadeImportada,
        execucoes24h: logs.length,
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
        execucoes24h: 0,
      };
    }
  }),

  // ✅ Forçar sincronização manual — mesma janela padrão (8/0) do lote 1 do
  // agendamento. Para os 30 dias completos, rodar os quatro lotes manualmente.
  forcarSincronizacaoManual: publicProcedure
    .input(
      z
        .object({
          dias: z.number().min(1).max(31).optional(),
          offset: z.number().min(0).max(365).optional(),
        })
        .optional(),
    )
    .mutation(async ({ input }) => {
      try {
        console.log("🔄 [Admin] Iniciando sincronização manual...", input);

        // Usa a rotina corrigida (colunas reais do cache + log em sync_logs)
        const { sincronizarOSDoMubiSys } = await import("../sync/scheduled-sync-os");
        const resultado = await sincronizarOSDoMubiSys({ dias: input?.dias, offset: input?.offset });

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
          `SELECT id, "dataExecucao", status, "quantidadeOsImportadas", "mensagemErro", "tempoExecucaoMs"
           FROM sync_logs ORDER BY "dataExecucao" DESC LIMIT ${limite}`,
          [],
        );

        return logs.map((log: any) => ({
          id: log.id,
          dataExecucao: log.dataExecucao,
          status: log.status,
          quantidadeOsImportadas: Number(log.quantidadeOsImportadas ?? 0),
          mensagemErro: log.mensagemErro ?? null,
          tempoExecucaoMs: log.tempoExecucaoMs ?? null,
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
