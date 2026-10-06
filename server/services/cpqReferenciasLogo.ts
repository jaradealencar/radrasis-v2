import { z } from "zod";

/**
 * Imagens de referência adicionais da MESMA logo (site oficial, redes sociais, papelaria...), enviadas pelo vendedor junto da
 * foto principal. O GPT Image usa as extras só para confirmar letras, símbolo e proporções que a foto principal não mostra com
 * clareza; a foto principal continua sendo a referência da versão a reproduzir. Nada é buscado na internet: quem escolhe as
 * fontes é o vendedor.
 */
export const TIPOS_REFERENCIA_LOGO = ["site", "redes", "papelaria", "outra"] as const;
export type TipoReferenciaLogo = (typeof TIPOS_REFERENCIA_LOGO)[number];

export const ROTULO_REFERENCIA_LOGO: Record<TipoReferenciaLogo, string> = {
  site: "logotipo no site oficial do cliente",
  redes: "foto de perfil ou publicação em rede social",
  papelaria: "cartão, papelaria ou material impresso",
  outra: "outra imagem da mesma logo",
};

export const MAX_REFERENCIAS_EXTRAS = 2;
/** O corpo da requisição na Vercel é limitado a 4,5 MB; as imagens vão em base64 (~33% a mais). */
export const MAX_BYTES_PRINCIPAL = 1_500_000;
export const MAX_BYTES_REFERENCIA = 900_000;

const imagemSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png"]),
  dataBase64: z.string().min(20).max(Math.ceil(MAX_BYTES_PRINCIPAL * 1.4)),
});

export const entradaReferenciasSchema = z.object({
  escopo: z.enum(["somente_logo", "letreiro_completo", "elementos_selecionados"]),
  elementosSelecionados: z.string().trim().max(500).optional(),
  principal: imagemSchema,
  referencias: z.array(imagemSchema.extend({ tipo: z.enum(TIPOS_REFERENCIA_LOGO) })).max(MAX_REFERENCIAS_EXTRAS).default([]),
}).strict();

export type ImagemDecodificada = { imageBuffer: Buffer; mimeType: "image/jpeg" | "image/png" };
export type ReferenciaDecodificada = ImagemDecodificada & { tipo: TipoReferenciaLogo };

const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const ehPng = (b: Buffer) => b.length > 8 && b.subarray(0, 4).equals(ASSINATURA_PNG);
const ehJpeg = (b: Buffer) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** Decodifica o base64 e confere o tamanho e se os bytes são mesmo do formato declarado (o tipo enviado não basta). */
export function decodificarImagem(imagem: { mimeType: "image/jpeg" | "image/png"; dataBase64: string }, maximoBytes: number, nome: string): ImagemDecodificada {
  const base64 = imagem.dataBase64.replace(/^data:[^,]+,/, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error(`A ${nome} não é uma imagem válida.`);
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > maximoBytes) throw new Error(`A ${nome} ficou grande demais (${(buffer.length / 1_000_000).toFixed(1)} MB; o máximo é ${(maximoBytes / 1_000_000).toFixed(1)} MB).`);
  const confere = imagem.mimeType === "image/png" ? ehPng(buffer) : ehJpeg(buffer);
  if (!confere) throw new Error(`A ${nome} não é um ${imagem.mimeType === "image/png" ? "PNG" : "JPG"} válido.`);
  return { imageBuffer: buffer, mimeType: imagem.mimeType };
}

/** Valida a entrada do cliente e devolve a foto principal e as referências extras prontas para o GPT Image. */
export function prepararReferencias(entrada: unknown): {
  escopo: z.infer<typeof entradaReferenciasSchema>["escopo"];
  elementosSelecionados?: string;
  principal: ImagemDecodificada;
  referencias: ReferenciaDecodificada[];
} {
  const dados = entradaReferenciasSchema.parse(entrada);
  return {
    escopo: dados.escopo,
    elementosSelecionados: dados.elementosSelecionados,
    principal: decodificarImagem(dados.principal, MAX_BYTES_PRINCIPAL, "foto principal"),
    referencias: dados.referencias.map((referencia, indice) => ({
      ...decodificarImagem(referencia, MAX_BYTES_REFERENCIA, `referência adicional ${indice + 1}`),
      tipo: referencia.tipo,
    })),
  };
}

/**
 * Instrução que explica ao GPT Image o papel de cada imagem. A ordem das imagens enviadas é: 1 = foto principal, 2.. = referências.
 * Sem referências extras devolve texto vazio (o prompt segue exatamente como antes).
 */
export function instrucaoReferenciasLogo(referencias: Array<{ tipo: TipoReferenciaLogo }>): string {
  if (!referencias.length) return "";
  const lista = referencias.map((referencia, indice) => `- IMAGEM ${indice + 2}: ${ROTULO_REFERENCIA_LOGO[referencia.tipo]}.`).join("\n");
  return [
    "REFERÊNCIAS ADICIONAIS DA MESMA LOGO (enviadas pelo operador):",
    "- IMAGEM 1: a FOTO PRINCIPAL (fachada ou letreiro). Ela define a versão da identidade a reproduzir e é a IMAGEM-ALVO desta execução.",
    lista,
    "Como usar as imagens adicionais:",
    "- Use-as SÓ para resolver dúvidas concretas da foto principal: letra ilegível ou cortada, parte escondida, símbolo difícil de identificar, proporção do desenho.",
    "- Se uma imagem adicional mostrar uma versão DIFERENTE da logo (outro símbolo, outra tipografia, outra cor de marca), mantenha a versão da foto principal e não misture as duas.",
    "- Cores: estime a partir da foto principal; não troque pelas cores de uma referência adicional.",
    "- Não invente nem acrescente elementos que não apareçam em nenhuma das imagens.",
  ].join("\n");
}
