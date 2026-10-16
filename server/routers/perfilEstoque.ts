import { z } from "zod";
import { protectedProcedure, requireRole, router } from "../_core/trpc";
import { listarOSMubiSys } from "../integrations/mubisys-client";
import {
  aplicarContagemBobinas,
  atualizarAlvoPerfil,
  definirSaldoFisicoPerfil,
  listarBobinasPerfil,
  listarEstoquePerfis,
  listarMovimentosPerfis,
  listarPendenciasEstoquePerfis,
  registrarEntradaPerfil,
  registrarBobinaPerfil,
  removerBobinaPerfil,
  sincronizarConsumoPerfisDasOs,
} from "../services/perfilEstoque";

const gestaoProcedure = protectedProcedure.use(
  requireRole("gestor", "admin", "master")
);
const contagemProcedure = protectedProcedure.use(
  requireRole("producao", "logistica", "gestor", "admin", "master")
);
const fmt = (data: Date) => data.toISOString().slice(0, 10);

export const perfilEstoqueRouter = router({
  painel: protectedProcedure.query(async () => {
    const [itens, movimentos, pendencias] = await Promise.all([
      listarEstoquePerfis(),
      listarMovimentosPerfis(120),
      listarPendenciasEstoquePerfis(60),
    ]);
    const itensComAlvo = itens.filter(
      item => item.alvoDoisMeses != null && item.alvoDoisMeses > 0
    );
    const abaixoDoAlvo = itensComAlvo.filter(
      item => item.saldoAtual < (item.alvoDoisMeses ?? 0)
    );
    return {
      itens,
      movimentos,
      pendencias,
      resumo: {
        perfis: itens.length,
        abaixoDoAlvo: abaixoDoAlvo.length,
        semEstoque: itens.filter(
          item => item.saldoAtual <= 0 && (item.alvoDoisMeses ?? 0) > 0
        ).length,
        compraSugeridaMetros: itens
          .filter(item => item.unidade === "m")
          .reduce((total, item) => total + (item.sugestaoCompra ?? 0), 0),
        compraSugeridaKg: itens.reduce(
          (total, item) => total + (item.sugestaoCompraKg ?? 0),
          0
        ),
        osPendentes: pendencias.length,
      },
    };
  }),

  definirSaldo: gestaoProcedure
    .input(
      z
        .object({
          perfilItemId: z.number().int().positive(),
          saldo: z.number().finite().min(0),
          observacao: z.string().trim().max(500).nullable().optional(),
        })
        .strict()
    )
    .mutation(({ input, ctx }) =>
      definirSaldoFisicoPerfil({
        ...input,
        usuario: ctx.user.name || ctx.user.id,
      })
    ),

  registrarEntrada: gestaoProcedure
    .input(
      z
        .object({
          perfilItemId: z.number().int().positive(),
          quantidade: z.number().finite().positive(),
          observacao: z.string().trim().max(500).nullable().optional(),
        })
        .strict()
    )
    .mutation(({ input, ctx }) =>
      registrarEntradaPerfil({
        ...input,
        usuario: ctx.user.name || ctx.user.id,
      })
    ),

  atualizarAlvo: gestaoProcedure
    .input(
      z
        .object({
          perfilItemId: z.number().int().positive(),
          alvoDoisMeses: z.number().finite().min(0).nullable(),
          horizonteMeses: z.number().int().min(1).max(24),
          kgPorMetro: z.number().finite().positive().nullable().optional(),
        })
        .strict()
    )
    .mutation(({ input, ctx }) =>
      atualizarAlvoPerfil({
        ...input,
        usuario: ctx.user.name || ctx.user.id,
      })
    ),

  bobinas: protectedProcedure
    .input(z.object({ perfilItemId: z.number().int().positive() }).strict())
    .query(({ input }) => listarBobinasPerfil(input.perfilItemId)),

  registrarBobina: contagemProcedure
    .input(
      z
        .object({
          perfilItemId: z.number().int().positive(),
          identificacao: z.string().trim().max(120).nullable().optional(),
          metodo: z.enum(["diametros", "foto", "peso", "metros"]),
          diametroExternoMm: z
            .number()
            .finite()
            .positive()
            .nullable()
            .optional(),
          diametroInternoMm: z
            .number()
            .finite()
            .positive()
            .nullable()
            .optional(),
          espessuraMm: z.number().finite().positive().nullable().optional(),
          pesoKg: z.number().finite().positive().nullable().optional(),
          comprimentoMetros: z
            .number()
            .finite()
            .positive()
            .nullable()
            .optional(),
          observacao: z.string().trim().max(500).nullable().optional(),
        })
        .strict()
    )
    .mutation(({ input, ctx }) =>
      registrarBobinaPerfil({
        ...input,
        usuario: ctx.user.name || ctx.user.id,
      })
    ),

  removerBobina: contagemProcedure
    .input(z.object({ id: z.number().int().positive() }).strict())
    .mutation(({ input, ctx }) =>
      removerBobinaPerfil(input.id, ctx.user.name || ctx.user.id)
    ),

  aplicarContagemBobinas: contagemProcedure
    .input(z.object({ perfilItemId: z.number().int().positive() }).strict())
    .mutation(({ input, ctx }) =>
      aplicarContagemBobinas(input.perfilItemId, ctx.user.name || ctx.user.id)
    ),

  sincronizarRecentes: gestaoProcedure
    .input(
      z
        .object({
          dias: z.number().int().min(1).max(31).default(8),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const fim = new Date();
      const inicio = new Date(fim);
      inicio.setDate(inicio.getDate() - (input?.dias ?? 8));
      const resposta = await listarOSMubiSys({
        filtrodata: "CADASTRO",
        datainicial: fmt(inicio),
        datafinal: fmt(fim),
      });
      const resultado = await sincronizarConsumoPerfisDasOs(resposta.itens);
      return { ...resultado, completo: resposta.completo };
    }),
});
