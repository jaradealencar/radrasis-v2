const VECTORIZER_API_URL = "https://api.vectorizer.ai/api/v1/vectorize";
const MAX_OUTPUT_BYTES = 12 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 180_000;

export type VectorizerAiErrorCode =
  | "configuration"
  | "credentials"
  | "credits"
  | "timeout"
  | "provider";

export class VectorizerAiError extends Error {
  constructor(
    readonly code: VectorizerAiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VectorizerAiError";
  }
}

/**
 * "completo": vetor com todas as cores da arte. "corte": silhueta de uma cor só, apenas os contornos que a CNC corta
 * (uma chamada a mais, +1 crédito). Em ambos, os parâmetros evitam contornos duplos, quebrados ou cheios de nós.
 */
export type VectorizacaoModo = "completo" | "corte";

/** Ajustes que a leitura da arte (ou as regras do administrador) podem pedir; só estes três, sempre limitados. */
export type AjustesVetorizacao = {
  maxCores?: number | null;
  minAreaPx?: number | null;
  tolerancia?: number | null;
};

const LIMITES_AJUSTES = { maxCores: [2, 48], minAreaPx: [0.5, 30], tolerancia: [0.02, 0.5] } as const;

/** Qualquer valor que não seja número finito é descartado; os demais são levados para dentro da faixa permitida. */
export function limitarAjustesVetorizacao(bruto: Record<string, unknown> | null | undefined): AjustesVetorizacao {
  const saida: AjustesVetorizacao = {};
  const numero = (valor: unknown) => (typeof valor === "string" && valor.trim() !== "" ? Number(valor) : valor);
  const aplicar = (chave: keyof AjustesVetorizacao, inteiro: boolean) => {
    const valor = numero(bruto?.[chave]);
    if (typeof valor !== "number" || !Number.isFinite(valor)) return;
    const [min, max] = LIMITES_AJUSTES[chave];
    const limitado = Math.min(max, Math.max(min, valor));
    saida[chave] = inteiro ? Math.round(limitado) : Number(limitado.toFixed(3));
  };
  aplicar("maxCores", true);
  aplicar("minAreaPx", false);
  aplicar("tolerancia", false);
  return saida;
}

export type VectorizeImageParams = {
  imageBuffer: Buffer;
  imageFilename: string;
  imageMimeType: "image/jpeg" | "image/png";
  modo?: VectorizacaoModo;
  ajustes?: AjustesVetorizacao;
};

/** Parâmetros do Vectorizer.AI (nomes conforme a especificação OpenAPI oficial) pensados no corte CNC. */
export function parametrosVetorizacao(modo: VectorizacaoModo = "completo", ajustes: AjustesVetorizacao = {}): Array<[string, string]> {
  const seguros = limitarAjustesVetorizacao(ajustes as Record<string, unknown>);
  const comuns: Array<[string, string]> = [
    ["mode", "production"],
    ["output.file_format", "svg"],
    // Formas recortadas umas das outras, sem sobreposição: nada de contorno duplo empilhado.
    ["output.shape_stacking", "cutouts"],
    ["output.group_by", "none"],
    ["output.draw_style", "fill_shapes"],
    // Sem os traços auxiliares do preenchedor de frestas (viravam elementos com opacidade parcial e engordavam o corte).
    ["output.gap_filler.enabled", "false"],
    // Círculos, retângulos e estrelas viram curvas, e arcos ficam proibidos: tudo em linhas e Béziers, que o
    // editor, a factibilidade e o nesting sabem processar.
    ["output.parameterized_shapes.flatten", "true"],
    ["output.curves.allowed.circular_arc", "false"],
    ["output.curves.allowed.elliptical_arc", "false"],
    ["output.svg.adobe_compatibility_mode", "true"],
  ];
  if (modo === "corte") {
    // Uma cor só: tudo que é arte vira uma única silhueta, com vazados reais. Fotos e adesivos viram bloco cheio.
    return [...comuns, ["processing.max_colors", "1"], ["processing.shapes.min_area_px", "16"]];
  }
  // Descarta ruídos menores que ~2 × 2 px, que gerariam contornos minúsculos soltos (ajustável pela leitura da arte).
  const completo: Array<[string, string]> = [...comuns, ["processing.shapes.min_area_px", String(seguros.minAreaPx ?? 4)]];
  if (seguros.maxCores != null) completo.push(["processing.max_colors", String(seguros.maxCores)]);
  if (seguros.tolerancia != null) completo.push(["output.curves.line_fit_tolerance", String(seguros.tolerancia)]);
  return completo;
}

export type VectorizeImageResult = {
  svgBuffer: Buffer;
  creditsCharged: string | null;
};

/** Raster → SVG via Vectorizer.AI. Credentials remain on the server. */
export async function vectorizeImage(
  params: VectorizeImageParams,
): Promise<VectorizeImageResult> {
  const apiId = process.env.VECTORIZER_API_ID?.trim();
  const apiSecret = process.env.VECTORIZER_API_SECRET?.trim();
  if (!apiId || !apiSecret) {
    throw new VectorizerAiError("configuration", "Vectorizer.AI credentials are not configured.");
  }

  const form = new FormData();
  form.append(
    "image",
    new Blob([new Uint8Array(params.imageBuffer)], { type: params.imageMimeType }),
    params.imageFilename,
  );
  for (const [nome, valor] of parametrosVetorizacao(params.modo)) form.append(nome, valor);

  let response: Response;
  try {
    response = await fetch(VECTORIZER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiId}:${apiSecret}`, "utf8").toString("base64")}`,
      },
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) {
      throw new VectorizerAiError("timeout", "Vectorizer.AI timed out after 180 seconds.");
    }
    throw new VectorizerAiError("provider", "Could not connect to Vectorizer.AI.");
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    const errorMessage = `${response.status} ${response.statusText}: ${details.slice(0, 1200)}`;
    if (response.status === 401 || response.status === 403) {
      throw new VectorizerAiError("credentials", errorMessage);
    }
    if (response.status === 429) {
      throw new VectorizerAiError("credits", errorMessage);
    }
    throw new VectorizerAiError("provider", errorMessage);
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_OUTPUT_BYTES) {
    throw new VectorizerAiError("provider", "Vectorizer.AI returned an SVG larger than the supported limit.");
  }

  const svgBuffer = Buffer.from(await response.arrayBuffer());
  if (svgBuffer.length === 0 || svgBuffer.length > MAX_OUTPUT_BYTES) {
    throw new VectorizerAiError("provider", "Vectorizer.AI returned an empty or oversized SVG.");
  }
  if (!/<svg\b/i.test(svgBuffer.subarray(0, 4096).toString("utf8"))) {
    throw new VectorizerAiError("provider", "Vectorizer.AI response did not contain an SVG.");
  }

  return {
    svgBuffer,
    creditsCharged: response.headers.get("x-credits-charged"),
  };
}
