import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { listCargos, getCargoById, createCargo, updateCargo, deleteCargo } from "../db/db";

const cargoSchema = z.object({
  titulo: z.string().min(1).max(128),
  missao: z.string().optional().nullable(),
  responsabilidades: z.string().optional().nullable(),
  kpis: z.string().optional().nullable(),
  ferramentas: z.string().optional().nullable(),
  integracao: z.string().optional().nullable(),
  riscos: z.string().optional().nullable(),
  requisitos: z.string().optional().nullable(),
  condicoes: z.string().optional().nullable(),
});

export const cargosRouter = router({
  list: protectedProcedure.query(async () => {
    return listCargos();
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getCargoById(input.id);
    }),

  create: protectedProcedure
    .input(cargoSchema)
    .mutation(async ({ input, ctx }) => {
      const id = await createCargo({
        ...input,
        createdBy: ctx.user.name ?? ctx.user.email ?? "sistema",
        updatedBy: ctx.user.name ?? ctx.user.email ?? "sistema",
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number() }).merge(cargoSchema.partial()))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await updateCargo(id, {
        ...data,
        updatedBy: ctx.user.name ?? ctx.user.email ?? "sistema",
      });
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCargo(input.id);
      return { ok: true };
    }),

  /**
   * O arquivo agora sobe direto do browser para o UploadThing (ver
   * client/src/lib/upload.ts); esta procedure só recebe o resultado.
   * Mantida para não quebrar o contrato do client e para o caso de passar a
   * registrar o upload no banco.
   */
  uploadImage: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      key: z.string().min(1),
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      return { url: input.url, key: input.key, success: true };
    }),
});
