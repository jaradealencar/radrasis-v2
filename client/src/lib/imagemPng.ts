/**
 * Prepara uma imagem escolhida pelo usuário para o botão de WhatsApp: PNG (único formato de
 * imagem que o navegador deixa colocar na área de transferência) e pequeno o bastante para
 * caber no corpo de requisição da Vercel (4,5 MB, e o base64 infla ~33%).
 */

/** PNG de saída: até ~2,4 MB (≈3,2 MB em base64, abaixo do teto de 4 MB do servidor). */
export const LIMITE_BYTES_PNG = 2_400_000;
/** Maior lado da imagem, em pixels — de sobra para a pré-visualização do WhatsApp. */
export const LADO_MAXIMO_PX = 1600;
/** Abaixo disso não reduzimos mais (a imagem ficaria ilegível). */
const LADO_MINIMO_PX = 700;

export interface ImagemPng {
  blob: Blob;
  largura: number;
  altura: number;
}

/** Converte JPG/WEBP/PNG em PNG, reduzindo (em passos de 15%) até caber no limite. Um PNG que já
 * está dentro do limite e do tamanho máximo é mantido como veio, sem recodificar. Lança erro se o
 * navegador não conseguir ler o arquivo (ex.: HEIC) ou se ele não couber nem reduzido. */
export async function converterParaPng(arquivo: File): Promise<ImagemPng> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    throw new Error("Não consegui ler essa imagem. Use um arquivo PNG, JPG ou WEBP.");
  }

  const maiorLado = Math.max(bitmap.width, bitmap.height);
  if (arquivo.type === "image/png" && arquivo.size <= LIMITE_BYTES_PNG && maiorLado <= LADO_MAXIMO_PX) {
    return { blob: arquivo, largura: bitmap.width, altura: bitmap.height };
  }

  let escala = Math.min(1, LADO_MAXIMO_PX / maiorLado);
  for (;;) {
    const largura = Math.max(1, Math.round(bitmap.width * escala));
    const altura = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não consegui preparar a imagem neste navegador.");
    // Fundo branco: JPG não tem transparência e, em PNG transparente, o WhatsApp mostraria o fundo escuro
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Não consegui converter a imagem para PNG.");
    if (blob.size <= LIMITE_BYTES_PNG) return { blob, largura, altura };
    if (Math.max(largura, altura) <= LADO_MINIMO_PX) {
      throw new Error("A imagem é pesada demais mesmo reduzida. Tente uma imagem mais simples ou menor.");
    }
    escala *= 0.85;
  }
}

/** Miniatura em data URL (JPEG, fundo branco) com o maior lado em `ladoMax` px — usada na
 * listagem da biblioteca para não carregar as imagens inteiras. Fica em ~10–30 KB. */
export async function gerarMiniatura(imagem: Blob, ladoMax = 240): Promise<string> {
  const bitmap = await createImageBitmap(imagem);
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não consegui gerar a miniatura neste navegador.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  return canvas.toDataURL("image/jpeg", 0.8);
}

/** Nome do arquivo → título legível: "3-motivos_letreiros.png" → "3 motivos letreiros". */
export function tituloDoArquivo(nomeArquivo: string): string {
  const base = nomeArquivo.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (base || "Imagem").slice(0, 160);
}

/** Blob → base64 puro (sem o prefixo "data:...;base64,"). */
export function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não consegui ler o arquivo."));
    leitor.onload = () => resolve(String(leitor.result).replace(/^data:[^;]*;base64,/, ""));
    leitor.readAsDataURL(blob);
  });
}

/** data URL (base64) → Blob PNG, decodificando na mão em vez de `fetch(data:)`, que alguns
 * ambientes com CSP restritiva bloqueiam. */
export function dataUrlParaBlob(dataUrl: string): Blob {
  const base64 = dataUrl.replace(/^data:[^;]*;base64,/, "");
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

/** Texto de erro legível para falhas de envio. Quando o servidor (ou a Vercel) responde uma página
 * HTML em vez de JSON — ex.: corpo grande demais —, o navegador só reclama de
 * "Unexpected token '<', "<!DOCTYPE"... is not valid JSON", que não diz nada ao usuário. */
export function mensagemDeErroEnvio(erro: unknown, padrao = "Não consegui enviar a imagem."): string {
  const texto = erro instanceof Error ? erro.message : "";
  if (/<!doctype|unexpected token '<'|is not valid json/i.test(texto)) {
    return "O servidor recusou o envio (imagem pesada demais ou instabilidade). Tente uma imagem menor ou tente de novo em instantes.";
  }
  return texto || padrao;
}

/** "1,6 MB" / "820 KB" */
export function formatarTamanho(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1).replace(".", ",")} MB`;
  return `${Math.round(bytes / 1000)} KB`;
}
