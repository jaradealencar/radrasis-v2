import { createUploadthing, type FileRouter } from "uploadthing/express";
import { UploadThingError } from "uploadthing/server";
import { fromNodeHeaders } from "better-auth/node";
import { type AppRole } from "../../drizzle/schema";
import { canRoleAccessPage } from "../db/db";
import { auth } from "./auth";

const f = createUploadthing();

/**
 * Autoriza o upload: só usuário logado sobe arquivo.
 *
 * É a mesma checagem de sessão que `createContext` faz para o tRPC
 * (`server/_core/context.ts`) — antes desta sprint a autorização vinha de
 * graça, porque o arquivo passava por uma `protectedProcedure`. Com o upload
 * direto, o browser fala com o UploadThing sem passar pelo tRPC, então a
 * checagem precisa acontecer aqui.
 */
async function requireUser(req: any) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) throw new UploadThingError("Não autenticado");
  return { userId: session.user.id };
}

async function requireTrainingEditor(req: any) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) throw new UploadThingError("Não autenticado");
  const role = String(session.user.role ?? "");
  if (
    !["admin", "master", "gestor"].includes(role) ||
    !(await canRoleAccessPage(role as AppRole, "treinamento"))
  )
    throw new UploadThingError("Somente instrutores podem enviar materiais");
  return { userId: session.user.id };
}

export const uploadRouter = {
  /**
   * Imagens: fotos de cotação, imagens de POP, biblioteca de erros, cargos,
   * fotos e anotações de empacotamento.
   */
  imagem: f({
    image: { maxFileSize: "16MB", maxFileCount: 10 },
  })
    .middleware(({ req }) => requireUser(req))
    .onUploadComplete(({ file, metadata }) => {
      // O client recebe o retorno desta função junto com url/key.
      return { uploadedBy: metadata.userId, name: file.name };
    }),

  /**
   * Documentos: currículos (PDF/DOCX/TXT) e biblioteca de arquivos.
   */
  documento: f({
    pdf: { maxFileSize: "32MB", maxFileCount: 1 },
    text: { maxFileSize: "8MB", maxFileCount: 1 },
    blob: { maxFileSize: "32MB", maxFileCount: 1 },
  })
    .middleware(({ req }) => requireUser(req))
    .onUploadComplete(({ file, metadata }) => {
      return { uploadedBy: metadata.userId, name: file.name };
    }),

  materialAvaliacao: f({
    pdf: { maxFileSize: "32MB", maxFileCount: 1, contentDisposition: "inline" },
    text: { maxFileSize: "8MB", maxFileCount: 1, contentDisposition: "inline" },
    image: {
      maxFileSize: "16MB",
      maxFileCount: 1,
      contentDisposition: "inline",
    },
    blob: {
      maxFileSize: "32MB",
      maxFileCount: 1,
      contentDisposition: "inline",
    },
  })
    .middleware(({ req }) => requireTrainingEditor(req))
    .onUploadComplete(({ file, metadata }) => ({
      uploadedBy: metadata.userId,
      name: file.name,
    })),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
