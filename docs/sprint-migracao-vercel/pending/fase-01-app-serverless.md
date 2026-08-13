# Fase 1 — Separar o app do servidor: `createApp()` + `api/index.ts`

**Depende de:** nada. É a primeira fase.
**Todas as outras fases editam o arquivo que esta cria.** Não pule, não reordene.

## Objetivo

Hoje `server/_core/index.ts` faz três coisas de uma vez: **monta** o Express,
**decide** entre Vite-middleware e estático, e **sobe** o processo com
`listen()`. Na Vercel só a primeira dessas três faz sentido.

Esta fase quebra o arquivo em três pedaços com fronteiras claras:

| Arquivo | Responsabilidade | Roda onde |
|---|---|---|
| `server/_core/app.ts` (**novo**) | Monta o Express e devolve. Sem `listen`, sem Vite. | Ambos |
| `server/_core/index.ts` (reescrito) | Bootstrap local: chama `createApp()`, pluga Vite/estático, `listen()`. | Só local (`yarn dev` / `yarn start`) |
| `api/index.ts` (**novo**) | Exporta o app como handler serverless. | Só Vercel |

**A fronteira mais importante desta sprint:** `server/_core/app.ts` **nunca**
pode importar `server/_core/vite.ts`, direta ou indiretamente. Aquele arquivo
importa `vite` e o `vite.config.ts` inteiro (que por sua vez importa
`@vitejs/plugin-react`, `tailwindcss`, `fs`, plugins de dev…). Se isso entrar
na árvore de imports da função serverless, o bundle explode e o build da
Vercel falha. Essa regra vale para todas as fases seguintes.

Ao fim desta fase **nada foi deployado ainda** e o comportamento local é
idêntico ao de antes. É pura reorganização.

---

## 1.1 — Criar `server/_core/app.ts`

Crie o arquivo com exatamente este conteúdo. É um recorte literal de
`server/_core/index.ts` — **os mesmos middlewares, na mesma ordem, com os
mesmos parâmetros**. Não aproveite para "melhorar" nada.

```ts
import "dotenv/config";
import express, { type Express } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { appRouter } from "../routers";
import { createContext } from "./context";

/**
 * Monta o Express com toda a API (auth, tRPC, cron) e devolve o app.
 *
 * ⚠️ Este arquivo NÃO pode importar `./vite` — nem direta nem
 * indiretamente. Ele é a raiz da árvore de imports da função serverless da
 * Vercel (`api/index.ts`), e `./vite` arrasta o Vite inteiro junto.
 * Servir o client (Vite em dev, estático em prod) é responsabilidade do
 * bootstrap local em `./index.ts`.
 *
 * Também não chama `listen()`: quem sobe o processo é `./index.ts`; na
 * Vercel ninguém sobe, o handler é invocado por requisição.
 */
export async function createApp(): Promise<Express> {
  const app = express();

  // Confiar no proxy reverso (necessário para rate limiting correto em produção)
  app.set("trust proxy", 1);

  // ── Segurança: Headers HTTP (helmet) ─────────────────────────────────────
  // Adiciona automaticamente: X-Frame-Options, X-XSS-Protection, HSTS,
  // X-Content-Type-Options, Referrer-Policy e outros headers de proteção.
  app.use(
    helmet({
      contentSecurityPolicy: false,      // Vite/React gerencia o CSP em dev
      crossOriginEmbedderPolicy: false,  // Necessário para recursos externos (mapas, fontes)
    })
  );

  // ── Segurança: Rate Limiting ──────────────────────────────────────────────
  // Limite geral: 300 requisições por minuto por IP (proteção contra DDoS/scraping)
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições. Tente novamente em alguns instantes." },
    skip: (req) => req.path.startsWith("/__manus__"), // Não limitar ferramentas internas
  });
  app.use("/api", generalLimiter);

  // Limite estrito para login: 10 tentativas por minuto por IP (proteção contra brute-force)
  const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas tentativas de login. Aguarde 1 minuto e tente novamente." },
  });
  app.use("/api/auth/sign-in", loginLimiter);
  app.use("/api/auth/sign-up", loginLimiter);

  // ── Better Auth ────────────────────────────────────────────────────────────
  // Precisa ser montado ANTES do express.json(): o handler do Better Auth lê
  // o corpo da requisição sozinho, e rodar o parser do Express antes faz o
  // client dele ficar pendurado em "pending".
  app.all("/api/auth/*", toNodeHandler(auth));

  // ── Body parser ───────────────────────────────────────────────────────────
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ─── CRON Job Endpoints ──────────────────────────────────────────────────
  const { handleSincronizarOS, handleStatusSincronizacao } = await import("../sync/scheduled-sync-os-handler");
  app.post("/api/scheduled/sincronizarOS", handleSincronizarOS);
  app.get("/api/scheduled/sincronizarOS/status", handleStatusSincronizacao);

  return app;
}
```

> **Sobre o `rateLimit` continuar aqui:** sim, ele fica. A Fase 4 é que trata
> disso. Esta fase é só recorte — mover e mudar ao mesmo tempo é como se
> perde um bug no meio do diff.

> **Sobre o `createApp` ser `async`:** é por causa do `await import(...)` do
> handler de cron, que já era assíncrono no original. Mantenha.

## 1.2 — Reescrever `server/_core/index.ts`

Substitua o conteúdo inteiro por este. Note que `isPortAvailable` e
`findAvailablePort` vêm literalmente do arquivo antigo — não mexa neles.

```ts
import "dotenv/config";
import { createServer } from "http";
import net from "net";
import { createApp } from "./app";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/**
 * Bootstrap do servidor local (`yarn dev` / `yarn start`).
 *
 * Este arquivo NÃO roda na Vercel — lá o entrypoint é `api/index.ts`, que
 * usa o mesmo `createApp()` mas sem `listen()` e sem servir o client (o
 * client vira estático servido pela CDN).
 */
async function startServer() {
  const app = await createApp();
  const server = createServer(app);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
```

**Confira:** a ordem importa. `setupVite`/`serveStatic` registram um
`app.use("*")` que engole tudo — eles têm que vir **depois** de todas as rotas
de API, exatamente como no arquivo original. Como `createApp()` já registrou
as rotas antes de devolver o app, a ordem está preservada.

## 1.3 — Criar `api/index.ts`

Crie a pasta `api/` na raiz do projeto (irmã de `server/`, `client/`,
`shared/`) e dentro dela:

```ts
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
```

> **Por que memoizar e não montar por invocação?** Montar o Express custa
> pouco, mas `createApp()` importa `./auth`, que cria o client Drizzle na
> carga do módulo. Repetir isso a cada requisição numa instância quente é
> desperdício puro.

> **Por que não `export default app` direto?** Porque `createApp()` é
> assíncrona. O wrapper acima é a forma mais curta de resolver isso sem
> mudar a assinatura de `createApp`.

## 1.4 — Incluir `api/` no `tsconfig.json`

Sem isso, `yarn run check` **não valida o arquivo novo** — e o erro só
apareceria no build da Vercel, que é o pior lugar para descobrir.

Em `tsconfig.json`, linha 2:

```diff
- "include": ["client/src/**/*", "shared/**/*", "server/**/*"],
+ "include": ["client/src/**/*", "shared/**/*", "server/**/*", "api/**/*"],
```

---

## Armadilhas conhecidas

- **Import relativo, não alias.** Em `api/index.ts` use
  `../server/_core/app`, não `@/…` nem `@shared/…`. Os aliases são resolvidos
  pelo Vite (client) e pelo `tsconfig` (typecheck), mas o runtime da função
  na Vercel não conhece nenhum dos dois.
- **`api/` na raiz, não dentro de `client/` ou `server/`.** A Vercel só
  procura funções em `api/` na raiz do projeto.
- **Não apague `server/_core/vite.ts`.** Ele continua sendo usado pelo
  bootstrap local. Só deixou de ser importado pelo `app.ts`.
- **Se `yarn run check` reclamar do tipo do retorno de `app`** no
  `api/index.ts`, o cast duplo (`as unknown as`) já está lá justamente por
  causa disso — não tente "consertar" tipando com `express.Express`.

## Verificação

```bash
yarn run check
yarn test
yarn build
yarn dev          # tem que subir na mesma porta de sempre e abrir no browser
```

Com o `yarn dev` de pé, confira **na mão**:

1. A SPA carrega em `http://localhost:3000/` e o HMR funciona (edite um texto
   numa página, veja atualizar sem reload).
2. Login funciona (`/api/auth/*` respondendo).
3. Qualquer página com dados carrega (tRPC respondendo em `/api/trpc`).
4. `curl -s http://localhost:3000/api/scheduled/sincronizarOS/status` devolve
   JSON, não HTML.

Se qualquer um dos quatro falhar, a ordem dos middlewares saiu errada no
recorte — compare com `git diff` contra o `index.ts` original.

**Confirme a fronteira do Vite** (o teste mais importante da fase):

```bash
grep -rn "from \"./vite\"\|from '../_core/vite'" server/_core/app.ts
# não pode devolver NADA
```

## Definição de pronto

- [ ] `server/_core/app.ts` criado, exportando `createApp()`
- [ ] `server/_core/app.ts` **não** importa `./vite`
- [ ] `server/_core/index.ts` reescrito, só bootstrap + `listen`
- [ ] `api/index.ts` criado
- [ ] `tsconfig.json` incluindo `api/**/*`
- [ ] `yarn run check`, `yarn test`, `yarn build` passando
- [ ] `yarn dev` sobe, SPA carrega, HMR funciona, login funciona, tRPC responde
- [ ] Commit: `chore(deploy): separa createApp() do bootstrap e cria handler serverless (sprint vercel, fase 1)`
