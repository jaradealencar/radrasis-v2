import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
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

async function startServer() {
  const app = express();
  const server = createServer(app);

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

  registerStorageProxy(app);

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
