import type { Express, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../_core/auth";
import {
  calcularNestingArte,
  calcularNestingArteInput,
  prepararNestingArteInput,
} from "../services/cpqNestingArte";
import {
  CpqFactibilidadeError,
  extrairPecasNestingArte,
} from "../services/cpqFactibilidadeFabricacao";
import { CpqNestingError } from "../services/cpqNesting";

async function autorizado(req: Request, res: Response): Promise<boolean> {
  const origin = req.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host")) throw new Error("origin");
    } catch {
      res
        .status(403)
        .json({ error: "A solicitação precisa vir do próprio sistema." });
      return false;
    }
  }
  const session = await auth.api
    .getSession({ headers: fromNodeHeaders(req.headers) })
    .catch(() => null);
  if (session) return true;
  res
    .status(401)
    .json({
      error: "Entre no Radrasys para preparar peças e calcular o nesting.",
    });
  return false;
}

export function registrarRotasNestingArte(app: Express): void {
  const registrar = (path: string, calcular: boolean) =>
    app.post(path, (req, res) => {
      void (async () => {
        if (!(await autorizado(req, res))) return;
        res.setHeader("Cache-Control", "private, no-store");
        if (calcular) {
          const input = calcularNestingArteInput.safeParse(req.body);
          if (!input.success)
            return void res
              .status(400)
              .json({
                error:
                  input.error.issues[0]?.message ||
                  "Confira as peças e o tamanho da chapa.",
              });
          res.json(await calcularNestingArte(input.data));
        } else {
          const input = prepararNestingArteInput.safeParse(req.body);
          if (!input.success)
            return void res
              .status(400)
              .json({
                error: "Informe o vetor e seu tamanho real em milímetros.",
              });
          res.json(
            extrairPecasNestingArte(
              input.data.svg,
              input.data.larguraMm,
              input.data.alturaMm
            )
          );
        }
      })().catch((error: unknown) => {
        if (
          error instanceof CpqFactibilidadeError ||
          error instanceof CpqNestingError
        ) {
          res
            .status(error.code === "engine" ? 502 : 422)
            .json({ error: error.message });
        } else {
          console.error(
            "[NestingArte] Falha no cálculo:",
            error instanceof Error ? error.name : "unknown"
          );
          res
            .status(500)
            .json({ error: "Não foi possível calcular o nesting agora." });
        }
      });
    });
  registrar("/api/letra-caixa/nesting-arte/preparar", false);
  registrar("/api/letra-caixa/nesting-arte/calcular", true);
}
