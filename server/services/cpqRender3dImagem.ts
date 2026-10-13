/**
 * Validação de imagens enviadas para o 3D (texturas dos perfis visuais e previews de proposta): o tipo vem dos BYTES (assinatura do
 * arquivo), nunca do cabeçalho Content-Type nem da extensão, e as dimensões vêm do próprio cabeçalho do formato — sem decodificar
 * a imagem inteira (não há biblioteca de imagem no servidor).
 */

export type MimeImagem3d = "image/png" | "image/jpeg" | "image/webp";

export interface InfoImagem3d {
  mime: MimeImagem3d;
  largura: number;
  altura: number;
}

export const IMAGEM_3D_MAX_BYTES = 4 * 1024 * 1024; // abaixo do teto de 4,5 MB do corpo na Vercel
export const IMAGEM_3D_MIN_LADO = 16;
export const IMAGEM_3D_MAX_LADO = 4096;

function pngInfo(b: Buffer): InfoImagem3d | null {
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  if (b.toString("ascii", 12, 16) !== "IHDR") return null;
  return { mime: "image/png", largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) };
}

function jpegInfo(b: Buffer): InfoImagem3d | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const marcador = b[i + 1];
    if (marcador === 0xff) { i += 1; continue; }
    if (marcador === 0xd8 || (marcador >= 0xd0 && marcador <= 0xd7) || marcador === 0x01) { i += 2; continue; }
    const tamanho = b.readUInt16BE(i + 2);
    // SOF0..SOF15, exceto DHT (C4), JPG (C8) e DAC (CC)
    if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador))
      return { mime: "image/jpeg", altura: b.readUInt16BE(i + 5), largura: b.readUInt16BE(i + 7) };
    if (tamanho < 2) return null;
    i += 2 + tamanho;
  }
  return null;
}

function webpInfo(b: Buffer): InfoImagem3d | null {
  if (b.length < 30 || b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const tipo = b.toString("ascii", 12, 16);
  if (tipo === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { mime: "image/webp", largura: b.readUInt16LE(26) & 0x3fff, altura: b.readUInt16LE(28) & 0x3fff };
  }
  if (tipo === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits = b.readUInt32LE(21);
    return { mime: "image/webp", largura: (bits & 0x3fff) + 1, altura: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (tipo === "VP8X") {
    const largura = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    const altura = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return { mime: "image/webp", largura, altura };
  }
  return null;
}

/** Reconhece PNG, JPEG e WebP pelos bytes. `null` = não é uma imagem aceita (ou o cabeçalho está corrompido). */
export function detectarImagem3d(dados: Buffer): InfoImagem3d | null {
  return pngInfo(dados) ?? jpegInfo(dados) ?? webpInfo(dados);
}

export function extensaoDoMime(mime: MimeImagem3d): string {
  return mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp";
}

/** Teto do GIF da animação de montagem: abaixo do limite de 4,5 MB do corpo da requisição na Vercel (sobra para o cabeçalho). */
export const GIF_3D_MAX_BYTES = 4_000_000;
const GIF_3D_MIN_LADO = 240;
const GIF_3D_MAX_LADO = 1600;

/**
 * Valida o GIF da animação de montagem pelos BYTES: assinatura GIF87a/GIF89a, dimensões do cabeçalho dentro de limites sãos e o
 * byte final de término (0x3B) — um GIF cortado no meio do envio não passa. Não decodifica os quadros.
 */
export function validarGif3d(dados: Buffer, opcoes: { maxBytes?: number } = {}): { erro: string } | { largura: number; altura: number } {
  const maxBytes = opcoes.maxBytes ?? GIF_3D_MAX_BYTES;
  if (!dados.length) return { erro: "O GIF enviado está vazio." };
  if (dados.length > maxBytes) return { erro: `O GIF passa de ${(maxBytes / 1_000_000).toFixed(1)} MB.` };
  const assinatura = dados.length >= 13 ? dados.toString("ascii", 0, 6) : "";
  if (assinatura !== "GIF89a" && assinatura !== "GIF87a") return { erro: "Envie um GIF válido (o tipo é conferido pelo conteúdo do arquivo)." };
  if (dados[dados.length - 1] !== 0x3b) return { erro: "O GIF está incompleto (sem o byte de término)." };
  const largura = dados.readUInt16LE(6);
  const altura = dados.readUInt16LE(8);
  if (largura < GIF_3D_MIN_LADO || altura < GIF_3D_MIN_LADO || largura > GIF_3D_MAX_LADO || altura > GIF_3D_MAX_LADO)
    return { erro: `O GIF deve ter entre ${GIF_3D_MIN_LADO} e ${GIF_3D_MAX_LADO} px de lado.` };
  return { largura, altura };
}

/** Valida tamanho e dimensões; devolve a mensagem de erro (em português) ou a info da imagem. */
export function validarImagem3d(dados: Buffer, opcoes: { maxBytes?: number } = {}): { erro: string } | { info: InfoImagem3d } {
  const maxBytes = opcoes.maxBytes ?? IMAGEM_3D_MAX_BYTES;
  if (!dados.length) return { erro: "A imagem enviada está vazia." };
  if (dados.length > maxBytes) return { erro: `A imagem passa de ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  const info = detectarImagem3d(dados);
  if (!info) return { erro: "Envie uma imagem PNG, JPEG ou WebP válida (o tipo é conferido pelo conteúdo do arquivo)." };
  if (info.largura < IMAGEM_3D_MIN_LADO || info.altura < IMAGEM_3D_MIN_LADO)
    return { erro: `A imagem é pequena demais (mínimo ${IMAGEM_3D_MIN_LADO} px de lado).` };
  if (info.largura > IMAGEM_3D_MAX_LADO || info.altura > IMAGEM_3D_MAX_LADO)
    return { erro: `A imagem passa de ${IMAGEM_3D_MAX_LADO} px de lado. Reduza antes de enviar.` };
  return { info };
}
