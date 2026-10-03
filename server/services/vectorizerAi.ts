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

export type VectorizeImageParams = {
  imageBuffer: Buffer;
  imageFilename: string;
  imageMimeType: "image/jpeg" | "image/png";
};

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
  form.append("mode", "production");
  form.append("output.file_format", "svg");
  form.append("output.group_by", "none");
  form.append("output.parameterized_shapes.flatten", "true");
  form.append("output.svg.adobe_compatibility_mode", "true");

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
