import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../server/_core/app";

/**
 * Entrypoint da função serverless da Vercel.
 *
 * A Vercel roda cada arquivo de `api/` como uma função. Um app Express é
 * uma função `(req, res)`, então serve direto de handler — não existe
 * `listen()` aqui.
 *
 * `appPromise` é memoizado no escopo do módulo: dentro de uma mesma
 * instância quente, o app é montado uma vez só e reaproveitado entre
 * invocações. Numa instância fria, monta de novo — e tudo bem, porque
 * `createApp()` não guarda estado que precise sobreviver (ver Fase 4).
 */
let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (!appPromise) {
    appPromise = createApp();
  }
  const app = await appPromise;
  return (app as unknown as (r: IncomingMessage, s: ServerResponse) => void)(req, res);
}
