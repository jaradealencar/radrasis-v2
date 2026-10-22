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
  app.options([
    "/api/publico/guia-fornecedores",
    "/api/publico/guia-fornecedores/proximos",
    "/api/publico/guia-fornecedores/clique",
    "/api/publico/guia-fornecedores/visita",
    "/api/publico/guia-fornecedores/questionario/:token",
    "/api/publico/guia-fornecedores/questionario/:token/logo",
  ], permitirCors, (_req, res) => res.sendStatus(204));

  app.get("/api/publico/guia-fornecedores", permitirCors, async (_req, res) => {
    try {
      const dados = await callerAnonimo().guiaFornecedores.listarPublico();
      res.json(dados);
    } catch (erro: any) {
      console.error("[publico/guia-fornecedores] erro ao listar:", erro);
      res.status(500).json({ erro: "Não foi possível carregar o guia." });
    }
  });

  app.get("/api/publico/guia-fornecedores/proximos", permitirCors, async (req, res) => {
    const cep = String(req.query.cep ?? "").trim();
    const raio = Number(req.query.raio ?? 300);
    if (!cep) {
      res.status(400).json({ erro: "CEP é obrigatório." });
      return;
    }
    try {
      const dados = await callerAnonimo().guiaFornecedores.buscarPorCep({
        cep,
        raioKm: isNaN(raio) ? 300 : raio,
      });
      res.json(dados);
    } catch (erro: any) {
      console.error("[publico/guia-fornecedores/proximos] erro:", erro);
      const msg = erro?.message || "Não foi possível buscar fornecedores por proximidade.";
      res.status(erro?.code === "NOT_FOUND" ? 404 : 500).json({ erro: msg });
    }
  });

  app.get("/api/publico/guia-fornecedores/questionario/:token", permitirCors, async (req, res) => {
    const token = String(req.params.token ?? "").trim();
    if (!token) {
      res.status(400).json({ erro: "Token obrigatório." });
      return;
    }
    try {
      const dados = await callerAnonimo().guiaFornecedores.obterQuestionarioPublico({ token });
      res.json(dados);
    } catch (erro: any) {
      res.status(erro?.code === "NOT_FOUND" ? 404 : 500).json({ erro: erro?.message || "Erro ao consultar questionário." });
    }
  });

  app.post("/api/publico/guia-fornecedores/questionario/:token", permitirCors, async (req, res) => {
    const token = String(req.params.token ?? "").trim();
    if (!token) {
      res.status(400).json({ erro: "Token obrigatório." });
      return;
    }
    try {
      const resp = await callerAnonimo().guiaFornecedores.responderQuestionarioPublico({
        token,
        ...req.body,
      });
      res.json(resp);
    } catch (erro: any) {
      res.status(erro?.code === "NOT_FOUND" ? 404 : 500).json({ erro: erro?.message || "Erro ao salvar questionário." });
    }
  });

  app.post("/api/publico/guia-fornecedores/questionario/:token/logo", permitirCors, async (req, res) => {
    const token = String(req.params.token ?? "").trim();
    const { base64, contentType, nomeArquivo } = req.body ?? {};
    if (!token || !base64) {
      res.status(400).json({ erro: "Token e imagem base64 são obrigatórios." });
      return;
    }
    try {
      const resp = await callerAnonimo().guiaFornecedores.uploadLogoPublico({
        token,
        base64,
        contentType: contentType || "image/png",
        nomeArquivo: nomeArquivo || "logo.png",
      });
      res.json(resp);
    } catch (erro: any) {
      res.status(erro?.code === "BAD_REQUEST" ? 400 : 500).json({ erro: erro?.message || "Erro no upload da logo." });
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
