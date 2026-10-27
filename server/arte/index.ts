import { resolve } from "node:path";
import { carregarConfigArte } from "./config";
import { criarAppArte, servirArte } from "./app";
const config = carregarConfigArte();
const app = criarAppArte(config);
if (process.env.NODE_ENV !== "production") {
  const { createServer } = await import("vite");
  const { configArteVite } = await import("../../vite.arte.config");
  const vite = await createServer({
    ...configArteVite,
    configFile: false,
    server: { middlewareMode: true, hmr: false },
  });
  app.get("/cpq-vetorizador-local.js", (_req, res) =>
    res.sendFile(resolve("client/public/cpq-vetorizador-local.js"))
  );
  app.get(["/", "/login"], async (_req, res, next) => {
    try {
      const { readFile } = await import("node:fs/promises");
      res
        .type("html")
        .send(
          await vite.transformIndexHtml(
            "/cpq-redesenho-vetorizacao.html",
            await readFile(
              resolve("client/cpq-redesenho-vetorizacao.html"),
              "utf8"
            )
          )
        );
    } catch (error) {
      next(error);
    }
  });
  app.use(vite.middlewares);
} else servirArte(app, resolve("public"));
const port = Number(process.env.PORT || 4320);
app.listen(port, "0.0.0.0", () =>
  console.log(`[arte] Aplicativo independente em ${config.origin}`)
);
