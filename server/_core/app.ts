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
