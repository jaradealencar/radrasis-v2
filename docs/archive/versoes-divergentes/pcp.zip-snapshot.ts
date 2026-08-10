import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  buscarOSMubiSys,
  identificarSetores,
  calcularPrazoEntrega,
  criarSetoresOrdem,
  criarOrdemProducao,
  getOrdemProducaoById,
  getOrdemProducaoPorOS,
  listarOrdensProducao,
  verificarAtrasos,
  listarMotivosAtraso,
  seedFeriados,
  seedMotivosAtraso,
  deletarOrdemProducao,
} from "../pcp-helpers";

export const pcpRouter = router({
  // Inicializar dados padrão (feriados e motivos)
  inicializar: protectedProcedure.mutation(async () => {
    try {
      await seedFeriados();
      await seedMotivosAtraso();
      return { success: true };
    } catch (error) {
      console.error("[PCP] Erro ao inicializar:", error);
      throw new Error("Falha ao inicializar PCP");
    }
  }),

  // Criar ordem de produção a partir de número de OS
  criarOrdemPorOS: protectedProcedure
    .input(z.object({
      osNumero: z.string(),
      dataEntrada: z.date().optional(),
      clienteNome: z.string().optional(),
      descricaoPedido: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Verificar se já existe
        const existente = await getOrdemProducaoPorOS(input.osNumero);
        if (existente) {
          throw new Error("Ordem de produção já existe para esta OS");
        }

        // Buscar dados no MubiSys
        let osMubisys = await buscarOSMubiSys(input.osNumero);
        
        // Se não encontrar no MubiSys, usar dados fornecidos ou criar com valores padrão
        if (!osMubisys) {
          console.warn(`[PCP] OS ${input.osNumero} não encontrada no MubiSys, usando dados fornecidos`);
          osMubisys = {
            id: input.osNumero,
            numero: input.osNumero,
            cliente: {
              id: "desconhecido",
              nome: input.clienteNome || "Cliente Desconhecido",
            },
            descricao: input.descricaoPedido || "Pedido sem descrição",
            dataCriacao: new Date().toISOString(),
            itens: [],
          };
        }

        // Identificar setores
        const setoresConfig = identificarSetores(osMubisys);

        // Calcular prazo
        const dataEntrada = input.dataEntrada || new Date();
        const { dataPrazo, diasUteisTotais } = await calcularPrazoEntrega(
          dataEntrada,
          setoresConfig.temPintura,
          setoresConfig.temPvcExpandido,
          setoresConfig.temAcrilico
        );

        // Criar ordem
        const ordem = await criarOrdemProducao({
          osNumero: input.osNumero,
          clienteNome: osMubisys.cliente?.nome || "Cliente Desconhecido",
          clienteId: osMubisys.cliente?.id,
          descricaoPedido: osMubisys.descricao,
          dataEntrada,
          dataPrazo,
          diasUteisTotais,
          statusGeral: "nao_iniciado",
          temPintura: setoresConfig.temPintura,
          temPvcExpandido: setoresConfig.temPvcExpandido,
          temAcrilico: setoresConfig.temAcrilico,
          temGalvanizado: setoresConfig.temGalvanizado,
          temInox: setoresConfig.temInox,
          temPerfil: setoresConfig.temPerfil,
          temLed: setoresConfig.temLed,
          temAdesivo: setoresConfig.temAdesivo,
          temGabarito: setoresConfig.temGabarito,
          criadoPor: ctx.user.name ?? ctx.user.email ?? "sistema",
        });

        if (!ordem) {
          throw new Error("Falha ao criar ordem de produção");
        }

        // Criar setores
        await criarSetoresOrdem(ordem.id, setoresConfig, dataPrazo, diasUteisTotais, dataEntrada);

        // Verificar atrasos
        await verificarAtrasos(ordem.id);

        return {
          success: true,
          ordem,
          setoresConfig,
        };
      } catch (error) {
        console.error("[PCP] Erro ao criar ordem:", error);
        throw error;
      }
    }),

  // Listar ordens de produção
  listar: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      cliente: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return listarOrdensProducao(input);
    }),

  // Obter detalhes de uma ordem
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getOrdemProducaoById(input.id);
    }),

  // Listar motivos de atraso
  listarMotivos: protectedProcedure.query(async () => {
    return listarMotivosAtraso();
  }),

  // Verificar atrasos de uma ordem
  verificarAtrasos: protectedProcedure
    .input(z.object({ ordemId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        await verificarAtrasos(input.ordemId);
        return { success: true };
      } catch (error) {
        console.error("[PCP] Erro ao verificar atrasos:", error);
        throw error;
      }
    }),

  // Deletar ordem de producao
  deletar: protectedProcedure
    .input(z.object({ ordemId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const sucesso = await deletarOrdemProducao(input.ordemId);
        if (!sucesso) {
          throw new Error("Falha ao deletar ordem de producao");
        }
        return { success: true, message: "Ordem deletada com sucesso" };
      } catch (error) {
        console.error("[PCP] Erro ao deletar ordem:", error);
        throw error;
      }
    }),
});
