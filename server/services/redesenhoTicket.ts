import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "../_core/env";

const TICKET_TTL_MS = 30 * 60 * 1000;
const PURPOSE = "cpq-image-preprocess-v1";

type TicketPayload = {
  sub: string;
  exp: number;
  purpose: string;
  kind: "preprocessed" | "vector-edit";
  imageSha256?: string;
};

/** Assina o usuário, a validade e os bytes exatos da imagem processada pela IA. */
export function emitirTicketRedesenho(userId: string, imageBuffer: Buffer): string {
  if (!ENV.cookieSecret) throw new Error("Configure JWT_SECRET para habilitar a aprovação do pré-processamento.");

  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Date.now() + TICKET_TTL_MS,
      purpose: PURPOSE,
      kind: "preprocessed",
      imageSha256: createHash("sha256").update(imageBuffer).digest("hex"),
    } satisfies TicketPayload),
  ).toString("base64url");
  const signature = createHmac("sha256", ENV.cookieSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/** Autoriza uma nova vetorização após o editor rasterizar um SVG já vetorizado. */
export function emitirTicketEdicaoVetor(userId: string): string {
  if (!ENV.cookieSecret) throw new Error("Configure JWT_SECRET para habilitar a aprovação do pré-processamento.");

  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Date.now() + TICKET_TTL_MS,
      purpose: PURPOSE,
      kind: "vector-edit",
    } satisfies TicketPayload),
  ).toString("base64url");
  const signature = createHmac("sha256", ENV.cookieSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/** Confere o PNG inicial ou uma edição do vetor após uma vetorização bem-sucedida. */
export function validarTicketRedesenho(
  ticket: string | undefined,
  userId: string,
  imageBuffer: Buffer,
): TicketPayload["kind"] | false {
  if (!ticket || ticket.length > 2048 || !ENV.cookieSecret) return false;
  const [payload, signature, extra] = ticket.split(".");
  if (!payload || !signature || extra !== undefined) return false;

  const expected = createHmac("sha256", ENV.cookieSecret).update(payload).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TicketPayload;
    if (
      data.sub !== userId ||
      data.purpose !== PURPOSE ||
      !Number.isFinite(data.exp) ||
      data.exp <= Date.now()
    ) {
      return false;
    }

    if (data.kind === "vector-edit") return "vector-edit";
    if (data.kind !== "preprocessed" || typeof data.imageSha256 !== "string" || !/^[a-f0-9]{64}$/.test(data.imageSha256)) {
      return false;
    }

    const expectedImageHash = Buffer.from(data.imageSha256, "hex");
    const submittedImageHash = createHash("sha256").update(imageBuffer).digest();
    return timingSafeEqual(expectedImageHash, submittedImageHash) ? "preprocessed" : false;
  } catch {
    return false;
  }
}
