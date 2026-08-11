import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
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
} from "../db/pcp-helpers";
import {
  listarOSMubiSys,
  buscarOSPorId,
  verificarConexaoMubiSys,
} from "../integrations/mubisys-client";

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
          setoresConfig.temPvcExpandido ?? false,
          setoresConfig.temAcrilico ?? false
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

  // ─── Endpoints MubiSys ────────────────────────────────────────────────────

  // Verificar conexão com o MubiSys
  verificarConexaoMubiSys: publicProcedure.query(async () => {
    return verificarConexaoMubiSys();
  }),

  // Listar OSs do MubiSys com filtros
  listarOSMubiSys: protectedProcedure
    .input(z.object({
      status: z.enum(["TODOS", "PENDENTE", "PRODUCAO", "CANCELADO", "CONCLUIDO", "PAUSADO", "ENTREGUE"]).default("TODOS"),
      filtrodata: z.enum(["CADASTRO", "PREV_ENTREGA", "APROVACAO", "ENTREGA", "FATURAMENTO", "CANCELAMENTO"]).default("CADASTRO"),
      datainicial: z.string(),
      datafinal: z.string(),
    }))
    .query(async ({ input }) => {
      return listarOSMubiSys(input);
    }),

  // Buscar OS específica do MubiSys por ID interno
  buscarOSMubiSysPorId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return buscarOSPorId(input.id);
    }),

  // Importar OS do MubiSys para o PCP (cria ordem de produção)
  importarOSMubiSys: protectedProcedure
    .input(z.object({
      osId: z.number(),        // ID interno MubiSys
      osNumero: z.string(),    // número sequencial da OS
      clienteNome: z.string(),
      descricaoPedido: z.string().optional(),
      dataEntrada: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Verificar se já existe
        const existente = await getOrdemProducaoPorOS(input.osNumero);
        if (existente) {
          throw new Error(`OS ${input.osNumero} já foi importada para o PCP`);
        }

        // Buscar dados completos no MubiSys
        const osMubisys = await buscarOSPorId(input.osId);

        // Montar objeto interno
        const osInterna = {
          id: String(osMubisys.id),
          numero: String(osMubisys.sequencial_ordem),
          cliente: { nome: osMubisys.cliente, id: String(osMubisys.cliente_id) },
          descricao: osMubisys.nome_trabalho || osMubisys.observacao_geral || "",
          dataCriacao: osMubisys.data_cadastro,
          itens: (osMubisys.itens || []).map((item) => ({
            descricao: item.descricao || item.item,
            material: item.item,
          })),
        };

        // Identificar setores e calcular prazo
        const setoresConfig = identificarSetores(osInterna);
        const dataEntrada = input.dataEntrada || new Date();
        const { dataPrazo, diasUteisTotais } = await calcularPrazoEntrega(
          dataEntrada,
          setoresConfig.temPintura,
          setoresConfig.temPvcExpandido ?? false,
          setoresConfig.temAcrilico ?? false
        );

        // Criar ordem de produção
        const ordem = await criarOrdemProducao({
          osNumero: input.osNumero,
          clienteNome: osMubisys.cliente,
          clienteId: String(osMubisys.cliente_id),
          descricaoPedido: osMubisys.nome_trabalho,
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

        if (!ordem) throw new Error("Falha ao criar ordem de produção");

        await criarSetoresOrdem(ordem.id, setoresConfig, dataPrazo, diasUteisTotais, dataEntrada);
        await verificarAtrasos(ordem.id);

        return { success: true, ordem, setoresConfig };
      } catch (error) {
        console.error("[PCP] Erro ao importar OS:", error);
        throw error;
      }
    }),
});
