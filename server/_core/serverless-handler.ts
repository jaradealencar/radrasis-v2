import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "./app";

/**
 * Fonte do entrypoint da função serverless da Vercel.
 *
 * Não fica em `api/` porque a Vercel só transpila o arquivo de entrada — os
 * módulos que ele importa (este arquivo importa `./app`, que importa boa
 * parte do server) precisam vir todos já empacotados num único arquivo
 * autocontido. `yarn build:api` (esbuild --bundle) gera esse pacote em
 * `api/index.js` a partir daqui; `api/index.ts` não existe mais no repo de
 * propósito, pra não haver dois arquivos (fonte + gerado) disputando a mesma
 * rota `/api`. Ver `vercel.json` (buildCommand + functions).
 *
 * A Vercel roda `api/index.js` (o bundle gerado) como uma função. Um app
 * Express é uma função `(req, res)`, então serve direto de handler — não
 * existe `listen()` aqui.
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
