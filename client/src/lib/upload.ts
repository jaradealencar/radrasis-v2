import { generateReactHelpers } from "@uploadthing/react";
import type { UploadRouter } from "../../../server/_core/uploadthing";

export const { useUploadThing } = generateReactHelpers<UploadRouter>();

/** O que todo call site recebe de volta depois de subir um arquivo. */
export interface ArquivoEnviado {
  url: string;
  key: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Sobe arquivos direto para o UploadThing, sem passar pelo servidor.
 *
 * Antes desta sprint os arquivos iam em base64 dentro do payload tRPC. Isso
 * não sobrevive ao limite de 4.5 MB de corpo de requisição da Vercel (base64
 * infla ~33%, então o teto real era ~3.3 MB de arquivo).
 *
 * O fluxo agora é: sobe aqui → recebe { url, key } → manda só isso para a
 * mutation tRPC, que segue gravando no banco como sempre fez.
 */
export async function enviarArquivos(
  rota: "imagem" | "documento",
  arquivos: File[],
  opts?: { onProgress?: (pct: number) => void },
): Promise<ArquivoEnviado[]> {
  const helpers = generateReactHelpers<UploadRouter>();
  const res = await helpers.uploadFiles(rota, {
    files: arquivos,
    onUploadProgress: opts?.onProgress
      ? ({ totalProgress }) => opts.onProgress!(totalProgress)
      : undefined,
  });

  return res.map((r, i) => ({
    url: r.ufsUrl,
    key: r.key,
    fileName: arquivos[i].name,
    mimeType: arquivos[i].type || "application/octet-stream",
    fileSize: arquivos[i].size,
  }));
}

/** Conveniência para os call sites que sobem um arquivo só. */
export async function enviarArquivo(
  rota: "imagem" | "documento",
  arquivo: File,
  opts?: { onProgress?: (pct: number) => void },
): Promise<ArquivoEnviado> {
  const [enviado] = await enviarArquivos(rota, [arquivo], opts);
  return enviado;
}

/**
 * Converte um data URL / base64 de canvas em File, para os call sites que
 * geram a imagem no browser em vez de receber de um `<input type="file">`
 * (as anotações de canvas do Empacotamento).
 */
export function base64ParaFile(
  base64: string,
  fileName: string,
  mimeType = "image/png",
): File {
  const limpo = base64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(limpo);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], fileName, { type: mimeType });
}
