import type { Request, Response } from "express";
import { auth } from "./auth";

/**
 * Adaptador do Better Auth para ambiente serverless.
 *
 * Em servidor Node tradicional usamos `toNodeHandler(auth)`, que lê o corpo
 * direto do stream da requisição — por isso ele é montado ANTES do
 * `express.json()`.
 *
 * Na Vercel isso não funciona: o runtime já consumiu o stream e entrega o
 * corpo pronto em `req.body`. O `toNodeHandler` ficaria esperando bytes que
 * nunca chegam e a requisição penduraria até o timeout.
 *
 * Aqui invertemos: deixamos o `express.json()` rodar primeiro e
 * reconstruímos um `Request` web a partir de `req.body`, entregando ao
 * `auth.handler()` — a mesma interface que o `toNodeHandler` embrulha.
 */
export async function authWebHandler(req: Request, res: Response) {
  const host = req.get("host") ?? "localhost";
  const url = new URL(req.originalUrl, `${req.protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  // O corpo é reserializado abaixo, então o content-length original não vale
  // mais — deixar o antigo faz o fetch interno truncar ou rejeitar.
  headers.delete("content-length");

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (typeof req.body === "string") {
      body = req.body;
    } else if (req.body != null && Object.keys(req.body).length > 0) {
      body = JSON.stringify(req.body);
      headers.set("content-type", "application/json");
    }
  }

  const response = await auth.handler(
    new Request(url.toString(), { method: req.method, headers, body })
  );

  res.status(response.status);

  // Set-Cookie é o único header que pode repetir; `getSetCookie()` devolve
  // todos separados. Colapsar em string única quebraria o login.
  const setCookie = response.headers.getSetCookie();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });
  if (setCookie.length > 0) res.setHeader("set-cookie", setCookie);

  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}
