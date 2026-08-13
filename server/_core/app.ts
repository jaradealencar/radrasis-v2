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
 * `true` quando o app está rodando como função serverless na Vercel.
 *
 * A Vercel define VERCEL=1 em runtime, em produção e em preview. Usamos isso
 * para desligar middlewares que dependem de estado in-process — hoje só o
 * rate limiting (ver bloco abaixo).
 */
const IS_SERVERLESS = process.env.VERCEL === "1";

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

  // Confiar no proxy reverso: faz req.ip / req.protocol refletirem o cliente
  // real por trás do proxy (Vercel em produção, qualquer reverse proxy no
  // deploy Node tradicional).
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
  // Só no servidor Node de vida longa (yarn dev / yarn start).
  //
  // O `express-rate-limit` conta requisições num MemoryStore dentro do
  // processo. Em serverless cada instância teria o seu próprio contador, o
  // limite efetivo viraria "300 × instâncias vivas" e todo cold start daria
  // um reset grátis — proteção nenhuma, com a aparência de proteção. Pior
  // que não ter.
  //
  // ⚠️ CONSEQUÊNCIA ACEITA E CONHECIDA: na Vercel a API roda SEM rate
  // limiting de aplicação. A proteção que resta é a mitigação de DDoS nativa
  // da plataforma (camada de rede) e, no login, o próprio Better Auth. Se
  // isso deixar de ser aceitável, a saída é um store distribuído (Redis) ou
  // regra de firewall na Vercel — nenhuma das duas está no escopo desta
  // sprint. Ver docs/sprint-migracao-vercel/README.md.
  if (!IS_SERVERLESS) {
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
  }

  // ── Better Auth + body parser ─────────────────────────────────────────────
  // A ordem entre os dois é INVERTIDA entre os ambientes, de propósito:
  //
  // • Node tradicional: `toNodeHandler` lê o corpo do stream, então precisa
  //   vir ANTES do express.json() — se o parser rodar primeiro, o client do
  //   Better Auth fica pendurado em "pending".
  //
  // • Serverless (Vercel): o runtime já consumiu o stream antes de invocar a
  //   função. O `toNodeHandler` esperaria para sempre. Então deixamos o
  //   parser rodar primeiro e reconstruímos o Request web a partir de
  //   req.body (ver ./auth-web-handler).
  //
  // Não "simplifique" isto para um caminho só sem testar OS DOIS ambientes.
  if (IS_SERVERLESS) {
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

    const { authWebHandler } = await import("./auth-web-handler");
    app.all("/api/auth/*", authWebHandler);
  } else {
    app.all("/api/auth/*", toNodeHandler(auth));

    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));
  }

  // ── UploadThing: rota de upload direto do browser ─────────────────────────
  // O arquivo NÃO passa por aqui — este endpoint só assina a permissão de
  // upload e recebe o callback de conclusão. Ver docs/sprint-migracao-vercel,
  // Fase 7: em serverless o corpo de uma requisição é limitado a 4.5 MB, o
  // que inviabilizava o upload via base64 no payload do tRPC.
  const { createRouteHandler } = await import("uploadthing/express");
  const { uploadRouter } = await import("./uploadthing");
  app.use("/api/uploadthing", createRouteHandler({ router: uploadRouter }));

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
