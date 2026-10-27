import type { Express, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../_core/auth";

import {
  consultarVectorizer,
  consultarOpenAi,
} from "../services/arteServicosStatus";

export function registrarRotaStatusServicosCpq(app: Express): void {
  app.get("/api/letra-caixa/servicos-status", (req, res) => {
    void consultarStatus(req, res);
  });
}

async function consultarStatus(req: Request, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const session = await auth.api
    .getSession({ headers: fromNodeHeaders(req.headers) })
    .catch(() => null);
  if (!session) {
    res
      .status(401)
      .json({
        error: "Entre no sistema para consultar o status dos serviços.",
      });
    return;
  }
  if (session.user.role !== "admin" && session.user.role !== "master") {
    res
      .status(403)
      .json({
        error: "O painel de serviços está disponível para administradores.",
      });
    return;
  }

  const [vectorizer, openai] = await Promise.all([
    consultarVectorizer(),
    consultarOpenAi(),
  ]);
  res.json({ checkedAt: new Date().toISOString(), vectorizer, openai });
}
