import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "./app";

/**
 * Fonte do entrypoint da função serverless da Vercel.
 *
 * Não fica em `api/` porque a Vercel só transpila o arquivo de entrada — os
 * módulos que ele importa (este arquivo importa `./app`, que importa boa
 * parte do server) não são empacotados junto automaticamente, e o import
 * relativo sem extensão (`moduleResolution: "bundler"` no tsconfig) quebra
 * em runtime com `type: module` puro. `yarn build:api` (esbuild --bundle)
 * gera um `api/index.js` autocontido, sem nenhum import local sobrando, a
 * partir daqui.
 *
 * Esse `api/index.js` gerado FICA COMMITADO no repo (não é gitignored):
 * a Vercel valida o glob de `functions` em `vercel.json` contra os arquivos
 * já existentes em `api/` ANTES de rodar o `buildCommand` — se o arquivo só
 * aparecesse depois do build, o deploy falha com "the pattern doesn't match
 * any Serverless Functions". O `buildCommand` roda `yarn build:api` de novo
 * e sobrescreve esse arquivo com uma versão fresca antes do deploy, então a
 * cópia commitada só precisa existir pra satisfazer essa validação — o
 * conteúdo publicado é sempre o gerado no build. `api/index.ts` não existe
 * mais no repo de propósito, pra não haver dois arquivos (fonte + gerado)
 * disputando a mesma rota `/api`. Ver `vercel.json` (buildCommand +
 * functions).
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
