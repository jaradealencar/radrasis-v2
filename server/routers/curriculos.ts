import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { invokeLLM, buildFileContent, TextContent } from "../_core/llm";
import {
  createAnaliseCurriculo,
  getAnaliseCurriculosByCargo,
  updateAnaliseCurriculo,
  getCargoById,
} from "../db/db";

export const curriculosRouter = router({
  // Upload currículo e iniciar análise
  uploadAndAnalyze: protectedProcedure
    .input(z.object({
      cargoId: z.number(),
      fileName: z.string(),
      url: z.string().url(),
      key: z.string().min(1),
      fileType: z.string(), // application/pdf, text/plain, etc
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // 1. Criar registro no banco
        const analise = await createAnaliseCurriculo({
          cargoId: input.cargoId,
          curriculoFileName: input.fileName,
          curriculoUrl: input.url,
          curriculoKey: input.key,
          status: "analisando",
          uploadedBy: ctx.user.id,
          uploadedByName: ctx.user.name ?? ctx.user.email ?? "Usuário",
        });

        if (!analise) {
          throw new Error("Falha ao criar registro de análise");
        }

        // 3. Buscar cargo e seu prompt
        const cargo = await getCargoById(input.cargoId);
        if (!cargo || !cargo.promptAnaliseIA) {
          throw new Error("Cargo não encontrado ou sem prompt configurado");
        }

        // 4. Invocar LLM com o prompt específico
        const fileResp = await fetch(input.url);
        const fileBase64 = Buffer.from(await fileResp.arrayBuffer()).toString("base64");
        const fileContent = await buildFileContent(
          fileBase64,
          input.fileType,
          input.fileName
        );
        const llmResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: cargo.promptAnaliseIA,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Por favor, analise o currículo anexado e forneça a triagem conforme as instruções.`,
                },
                fileContent,
              ],
            },
          ],
        });

        const messageContent = llmResponse.choices?.[0]?.message?.content;
        const resultado = typeof messageContent === "string"
          ? messageContent
          : Array.isArray(messageContent)
            ? messageContent.filter((c): c is TextContent => c.type === "text").map(c => c.text).join("\n")
            : "";

        // 5. Atualizar registro com resultado
        await updateAnaliseCurriculo(analise.id, {
          resultado,
          status: "concluido",
        });

        return {
          id: analise.id,
          resultado,
          status: "concluido",
        };
      } catch (error) {
        console.error("[Currículos] Erro ao analisar:", error);
        const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";

        // Tentar atualizar o registro com o erro
        if (input.cargoId) {
          const analises = await getAnaliseCurriculosByCargo(input.cargoId);
          if (analises.length > 0) {
            const latest = analises[0];
            if (latest.status === "analisando") {
              await updateAnaliseCurriculo(latest.id, {
                status: "erro",
                erroMensagem: errorMsg,
              });
            }
          }
        }

        throw new Error(`Falha ao analisar currículo: ${errorMsg}`);
      }
    }),

  // Listar análises de um cargo
  listByCargo: protectedProcedure
    .input(z.object({ cargoId: z.number() }))
    .query(async ({ input }) => {
      return getAnaliseCurriculosByCargo(input.cargoId);
    }),

  // Deletar análise
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      // TODO: Implementar deleção física do arquivo S3 se necessário
      return { ok: true };
    }),
});
