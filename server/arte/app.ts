import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { z } from "zod";
import type { ArteConfig } from "./config";
import {
  ARTE_COOKIE,
  SESSION_MS,
  ator,
  criarSessao,
  iguais,
  ticketImagem,
  imagemAprovada,
} from "./security";
import { redesenharLetreiro } from "../services/letraCaixaRedesign";
import { vetorizarComGpt, lerDimensoesPng } from "../services/cpqPlanoBArte";
import { vectorizeImage, VectorizerAiError } from "../services/vectorizerAi";
import {
  prepararNestingArteInput,
  calcularNestingArteInput,
  calcularNestingArte,
} from "../services/cpqNestingArte";
import {
  extrairPecasNestingArte,
  CpqFactibilidadeError,
} from "../services/cpqFactibilidadeFabricacao";
import { CpqNestingError } from "../services/cpqNesting";
import {
  consultarOpenAi,
  consultarVectorizer,
} from "../services/arteServicosStatus";
import { informarUsoArte } from "../services/arteUsage";
import { lerInstrucoesArte } from "../services/arteInstrucoes";
import { criarOpenApiArte } from "./openapi";

type Dependencies = {
  redraw: typeof redesenharLetreiro;
  vector: typeof vectorizeImage;
  gpt: typeof vetorizarComGpt;
  status: () => Promise<unknown>;
};

/** Servidor dedicado: não importa auth, banco, ERP ou rotas administrativas do Radrasys. */
export function criarAppArte(
  config: ArteConfig,
  overrides: Partial<Dependencies> = {}
) {
  const app = express();
  const deps: Dependencies = {
    redraw: redesenharLetreiro,
    vector: vectorizeImage,
    gpt: vetorizarComGpt,
    status: async () => {
      const [vectorizer, openai] = await Promise.all([
        consultarVectorizer(),
        consultarOpenAi(),
      ]);
      return { checkedAt: new Date().toISOString(), vectorizer, openai };
    },
    ...overrides,
  };
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  // A página herdada ainda contém seu script local inline. Nenhum script remoto é autorizado.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "blob:", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.production ? [] : null,
        },
      },
      strictTransportSecurity: config.production ? undefined : false,
    })
  );
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Request-Id", randomUUID());
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, application: "arte", version: 1 })
  );
  app.use("/api", (req, res, next) => {
    const origin = req.get("origin");
    if (
      (origin && origin !== config.origin) ||
      req.get("sec-fetch-site") === "cross-site"
    ) {
      res
        .status(403)
        .json({
          error: "A solicitação precisa vir do domínio desta ferramenta.",
        });
      return;
    }
    next();
  });
  app.get("/api/arte/session", (req, res) =>
    res.json({ authenticated: !!ator(config, req) })
  );
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Muitas tentativas de acesso. Aguarde 15 minutos." },
  });
  app.post(
    "/api/arte/login",
    loginLimit,
    express.json({ limit: "4kb" }),
    (req, res) => {
      if (
        typeof req.body?.password !== "string" ||
        !iguais(req.body.password, config.password)
      ) {
        res.status(401).json({ error: "Senha de acesso incorreta." });
        return;
      }
      res.cookie(ARTE_COOKIE, criarSessao(config), {
        httpOnly: true,
        secure: config.production,
        sameSite: "strict",
        path: "/",
        maxAge: SESSION_MS,
      });
      res.json({ ok: true });
    }
  );
  app.post("/api/arte/logout", (_req, res) => {
    res.clearCookie(ARTE_COOKIE, {
      httpOnly: true,
      secure: config.production,
      sameSite: "strict",
      path: "/",
    });
    res.json({ ok: true });
  });
  app.use("/api", (req, res, next) => {
    const sub = ator(config, req);
    if (!sub) {
      res
        .status(401)
        .json({
          error: "Entre nesta ferramenta ou utilize a chave de integração.",
        });
      return;
    }
    res.locals.ator = sub;
    next();
  });
  app.get("/api/v1/integracao", (_req, res) =>
    res.json({
      baseUrl: config.origin,
      authentication: "Bearer ARTE_INTEGRATION_API_KEY",
      integrationConfigured: !!config.integrationKey,
      credentials: {
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        VECTORIZER_API_ID: !!process.env.VECTORIZER_API_ID,
        VECTORIZER_API_SECRET: !!process.env.VECTORIZER_API_SECRET,
      },
      models: {
        redraw: "gpt-image-2.5-sunburst",
        vector: process.env.CPQ_GPT_SVG_MODEL || "gpt-5.5",
      },
    })
  );
  app.get("/api/v1/openapi.json", (_req, res) =>
    res.json(criarOpenApiArte(config.origin))
  );
  app.get(
    ["/api/letra-caixa/servicos-status", "/api/v1/servicos"],
    rateLimit({
      windowMs: 60_000,
      limit: 6,
      legacyHeaders: false,
      message: {
        error: "Aguarde um instante antes de consultar os serviços novamente.",
      },
    }),
    (_req, res, next) => {
      deps
        .status()
        .then(data => res.json(data))
        .catch(next);
    }
  );
  const operations = express.Router();
  operations.use(
    rateLimit({
      windowMs: 60_000,
      limit: 20,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: {
        error: "Limite de 20 operações por minuto. Aguarde um instante.",
      },
    })
  );
  const imageParser = express.raw({
    type: ["image/png", "image/jpeg"],
    limit: "4mb",
  });
  const image = (req: Request) => {
    const mime = req.get("content-type")?.split(";")[0];
    if (
      (mime !== "image/png" && mime !== "image/jpeg") ||
      !Buffer.isBuffer(req.body) ||
      !req.body.length
    )
      throw new Error("Envie uma imagem PNG ou JPG válida.");
    const b = req.body as Buffer;
    if (
      mime === "image/png"
        ? !lerDimensoesPng(b)
        : !(b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255)
    )
      throw new Error("O conteúdo não corresponde ao formato da imagem.");
    return {
      imageBuffer: b,
      imageMimeType: mime as "image/png" | "image/jpeg",
      imageFilename: mime === "image/png" ? "arte.png" : "arte.jpg",
    };
  };
  const run =
    (fn: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
      void fn(req, res).catch(next);
    };
  operations.post(
    ["/aprovar-imagem-original", "/imagem/aprovar"],
    imageParser,
    run(async (req, res) => {
      const data = image(req);
      res.setHeader(
        "X-Redesenho-Token",
        ticketImagem(config, res.locals.ator, data.imageBuffer)
      );
      res.json({ ok: true, expiresInSeconds: 1800 });
    })
  );
  operations.post(
    "/redesenho",
    imageParser,
    run(async (req, res) => {
      const data = image(req);
      const quality = z
        .enum(["high", "xhigh"])
        .parse(req.query.qualidade ?? "high");
      const result = await deps.redraw({
        ...data,
        quality,
        escopo: "somente_logo",
        instrucoes: lerInstrucoesArte(req),
      });
      informarUsoArte(res, result.usage);
      res.setHeader(
        "X-Redesenho-Token",
        ticketImagem(config, res.locals.ator, result.imageBuffer)
      );
      res.type(result.mimeType).send(result.imageBuffer);
    })
  );
  const vector = (gpt: boolean) =>
    run(async (req, res) => {
      const data = image(req);
      if (
        !imagemAprovada(
          config,
          res.locals.ator,
          data.imageBuffer,
          req.get("x-redesenho-token")
        )
      ) {
        res
          .status(409)
          .json({
            error:
              "Aprove os bytes exatos desta imagem antes de vetorizar. O ticket dura 30 minutos.",
          });
        return;
      }
      const instrucoes = lerInstrucoesArte(req);
      if (!gpt && instrucoes) {
        res
          .status(400)
          .json({
            error:
              "Ajustes por texto são aplicados pelo GPT. Selecione Vetorizar com GPT.",
          });
        return;
      }
      let svg: string | Buffer;
      if (gpt) {
        const dim = lerDimensoesPng(data.imageBuffer);
        if (!dim) {
          res
            .status(415)
            .json({ error: "Converta a imagem para PNG antes de usar o GPT." });
          return;
        }
        svg = await deps.gpt({
          imageBuffer: data.imageBuffer,
          mimeType: "image/png",
          largura: dim.largura,
          altura: dim.altura,
          instrucoes,
          onUsage: usage => informarUsoArte(res, usage),
        });
      } else {
        const result = await deps.vector(data);
        informarUsoArte(res, undefined, result.creditsCharged);
        svg = result.svgBuffer;
      }
      res.setHeader(
        "X-Redesenho-Token",
        ticketImagem(config, res.locals.ator, data.imageBuffer)
      );
      res.type("image/svg+xml").send(svg);
    });
  operations.post(
    ["/vetorizacao", "/vetor/vectorizer"],
    imageParser,
    vector(false)
  );
  operations.post(
    ["/vetorizacao-gpt", "/vetor/gpt"],
    imageParser,
    vector(true)
  );
  operations.use(express.json({ limit: "2mb" }));
  operations.post(
    "/nesting-arte/preparar",
    run(async (req, res) => {
      const data = prepararNestingArteInput.parse(req.body);
      res.json(
        extrairPecasNestingArte(data.svg, data.larguraMm, data.alturaMm)
      );
    })
  );
  operations.post(
    "/nesting-arte/calcular",
    run(async (req, res) => {
      res.json(
        await calcularNestingArte(calcularNestingArteInput.parse(req.body))
      );
    })
  );
  app.use(["/api/v1", "/api/letra-caixa"], operations);
  app.use("/api", (_req, res) => {
    res
      .status(404)
      .json({ error: "Endpoint inexistente. Consulte /api/v1/openapi.json." });
  });
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const message = error instanceof Error ? error.message : "";
      // Nunca devolve nem registra o corpo de erro do provedor (pode conter o briefing).
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({
            error: "Parâmetros inválidos.",
            issues: error.issues.map(x => ({
              path: x.path,
              message: x.message,
            })),
          });
        return;
      }
      if (
        error instanceof CpqFactibilidadeError ||
        error instanceof CpqNestingError
      ) {
        res.status(422).json({ error: message });
        return;
      }
      if ((error as { type?: string })?.type === "entity.too.large") {
        res.status(413).json({ error: "Arquivo acima do limite permitido." });
        return;
      }
      if ((error as { type?: string })?.type === "entity.parse.failed") {
        res.status(400).json({ error: "JSON inválido." });
        return;
      }
      if (error instanceof VectorizerAiError) {
        res
          .status(error.code === "credits" ? 429 : 503)
          .json({
            error:
              error.code === "credits"
                ? "Vectorizer.AI bloqueado por créditos ou limite."
                : "Vectorizer.AI indisponível. Confira configuração e status dos serviços.",
          });
        return;
      }
      if (/insufficient_quota|billing|rate_limit|\b429\b/i.test(message)) {
        res
          .status(429)
          .json({
            error:
              "OpenAI bloqueou a chamada por crédito ou limite de uso. Confira o faturamento da API.",
          });
        return;
      }
      if (/OPENAI_API_KEY|invalid_api_key|\b401\b/i.test(message)) {
        res
          .status(503)
          .json({ error: "A chave da OpenAI está ausente ou não foi aceita." });
        return;
      }
      if (/Envie |conteúdo não|Descreva |descrição do ajuste/i.test(message)) {
        res.status(400).json({ error: message });
        return;
      }
      res
        .status(502)
        .json({
          error:
            "A operação não foi concluída. Confira o status e a configuração dos serviços.",
        });
    }
  );
  return app;
}

export function servirArte(
  app: ReturnType<typeof criarAppArte>,
  publicDir: string
): void {
  app.get(["/", "/login", "/cpq-redesenho-vetorizacao.html"], (_req, res) =>
    res.sendFile(resolve(publicDir, "index.html"))
  );
  app.use(express.static(publicDir, { index: false, dotfiles: "deny" }));
}
