/**
 * Rotas REST simples (fora do tRPC) para o site espelho do Guia de Fornecedores — um segundo
 * deploy Vercel, em domínio próprio, que o Daniel compartilha com os clientes finais (sem
 * acesso ao radrasis). Um site num domínio diferente não pode chamar o tRPC batch link como o
 * próprio front-end do radrasis faz (mesma origem); JSON simples + CORS aberto aqui é mais
 * fácil de consumir de um app estranho ao monorepo do que replicar o cliente tRPC lá.
 *
 * CORS liberado para qualquer origem só nestas 3 rotas — todas de dado já público por design
 * (a própria lista que aparece no site) ou mutações de baixíssimo risco (somar 1 num contador de
 * clique/visita, sem dado sensível no corpo). Não abrir esse precedente para o resto da API.
 *
 * Reaproveita as procedures do tRPC (validação Zod, regra de negócio) via createCaller com um
 * contexto anônimo — nada de duplicar lógica aqui.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { appRouter } from "../routers";

function permitirCors(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
}

function callerAnonimo() {
  return appRouter.createCaller({ user: null, req: {} as any, res: {} as any });
}

export function registrarRotasPublicoGuiaFornecedores(app: Express) {
  app.options(["/api/publico/guia-fornecedores", "/api/publico/guia-fornecedores/clique", "/api/publico/guia-fornecedores/visita"], permitirCors, (_req, res) => res.sendStatus(204));

  app.get("/api/publico/guia-fornecedores", permitirCors, async (_req, res) => {
    try {
      const dados = await callerAnonimo().guiaFornecedores.listarPublico();
      res.json(dados);
    } catch (erro: any) {
      console.error("[publico/guia-fornecedores] erro ao listar:", erro);
      res.status(500).json({ erro: "Não foi possível carregar o guia." });
    }
  });

  app.post("/api/publico/guia-fornecedores/clique", permitirCors, async (req, res) => {
    const empresa = String(req.body?.empresa ?? "").trim();
    if (!empresa) { res.status(400).json({ erro: "empresa é obrigatória" }); return; }
    try {
      await callerAnonimo().guiaFornecedores.registrarClique({ empresa });
      res.json({ ok: true });
    } catch (erro: any) {
      console.error("[publico/guia-fornecedores/clique] erro:", erro);
      res.status(500).json({ erro: "Não foi possível registrar o clique." });
    }
  });

  app.post("/api/publico/guia-fornecedores/visita", permitirCors, async (req, res) => {
    const visitanteId = String(req.body?.visitanteId ?? "").trim();
    if (visitanteId.length < 8) { res.status(400).json({ erro: "visitanteId inválido" }); return; }
    try {
      await callerAnonimo().guiaFornecedores.registrarVisita({ visitanteId });
      res.json({ ok: true });
    } catch (erro: any) {
      console.error("[publico/guia-fornecedores/visita] erro:", erro);
      res.status(500).json({ erro: "Não foi possível registrar a visita." });
    }
  });
}
