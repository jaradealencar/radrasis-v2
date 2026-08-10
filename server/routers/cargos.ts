import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { storagePut } from "../storage";
import { listCargos, getCargoById, createCargo, updateCargo, deleteCargo } from "../db";

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

  uploadImage: protectedProcedure
    .input(z.object({
      base64: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const buffer = Buffer.from(input.base64, "base64");
        const storageKey = `cargos/imagens/${Date.now()}-${input.fileName}`;
        const { url, key } = await storagePut(storageKey, buffer, input.mimeType);
        return { url, key, success: true };
      } catch (error) {
        console.error("[Cargos] Erro ao fazer upload de imagem:", error);
        throw new Error("Falha ao fazer upload da imagem");
      }
    }),
});
