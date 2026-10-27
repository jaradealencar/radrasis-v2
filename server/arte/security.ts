import {
  createHash,
  createHmac,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import type { Request } from "express";
import type { ArteConfig } from "./config";

export const ARTE_COOKIE = "arte_session";
export const SESSION_MS = 8 * 60 * 60 * 1000;
export function iguais(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest()
  );
}
export function assinar(
  config: ArteConfig,
  dados: Record<string, unknown>
): string {
  const body = Buffer.from(JSON.stringify(dados)).toString("base64url");
  return `${body}.${createHmac("sha256", config.secret).update(body).digest("base64url")}`;
}
export function conferir(
  config: ArteConfig,
  token: string | undefined,
  purpose: string
): Record<string, unknown> | null {
  if (!token || token.length > 2000) return null;
  const [body, signature, extra] = token.split(".");
  if (
    !body ||
    !signature ||
    extra ||
    !iguais(
      signature,
      createHmac("sha256", config.secret).update(body).digest("base64url")
    )
  )
    return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return data.purpose === purpose &&
      typeof data.exp === "number" &&
      data.exp > Date.now()
      ? data
      : null;
  } catch {
    return null;
  }
}
export function criarSessao(config: ArteConfig): string {
  return assinar(config, {
    purpose: "session",
    sub: randomUUID(),
    exp: Date.now() + SESSION_MS,
    passwordVersion: createHmac("sha256", config.secret)
      .update(`password-version:${config.password}`)
      .digest("hex"),
  });
}
export function ator(config: ArteConfig, req: Request): string | null {
  const bearer = req.get("authorization");
  if (bearer)
    return config.integrationKey &&
      iguais(bearer, `Bearer ${config.integrationKey}`)
      ? "integration"
      : null;
  const token = req
    .get("cookie")
    ?.split(";")
    .map(x => x.trim())
    .find(x => x.startsWith(`${ARTE_COOKIE}=`))
    ?.slice(ARTE_COOKIE.length + 1);
  const data = conferir(config, token, "session");
  return data &&
    data.passwordVersion ===
      createHmac("sha256", config.secret)
        .update(`password-version:${config.password}`)
        .digest("hex") &&
    typeof data.sub === "string"
    ? data.sub
    : null;
}
export function ticketImagem(
  config: ArteConfig,
  sub: string,
  image: Buffer
): string {
  return assinar(config, {
    purpose: "image",
    sub,
    exp: Date.now() + 30 * 60 * 1000,
    hash: createHash("sha256").update(image).digest("hex"),
  });
}
export function imagemAprovada(
  config: ArteConfig,
  sub: string,
  image: Buffer,
  ticket: string | undefined
): boolean {
  const data = conferir(config, ticket, "image");
  return (
    !!data &&
    data.sub === sub &&
    data.hash === createHash("sha256").update(image).digest("hex")
  );
}
