import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import express, { type Express, type Request, type Response } from "express";
import { auth } from "../_core/auth";
import { gerarTemplateComposicaoCsv, importarComposicaoArquivo, importarComposicaoJson, sincronizarCatalogoMubiSys, carregarCatalogoEspelhado } from "../services/mubisysEspelho";
import { calcularComposicaoComAcabamentos } from "../services/cpqComposicao";
import { BASES_COBRANCA_PRODUTO } from "../../shared/base-cobranca-produto";

const ROLES_GESTAO = new Set(["admin", "master", "gestor"]);

function mesmaOrigem(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === req.get("host"); } catch { return false; }
}

async function exigirGestao(req: Request, res: Response): Promise<boolean> {
  if (!mesmaOrigem(req)) {
    res.status(403).json({ error: "A solicitação precisa vir do próprio sistema." });
    return false;
  }
  const sessao = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  if (!sessao) {
    res.status(401).json({ error: "Entre no Radrasys para gerenciar o espelho MubiSys." });
    return false;
  }
  if (!ROLES_GESTAO.has(String(sessao.user.role ?? ""))) {
    res.status(403).json({ error: "Somente gestor, admin ou master pode sincronizar/importar o espelho." });
    return false;
  }
  return true;
}

function rota(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch(error => {
      console.error("[MubiSysEspelho] Falha na operação:", error);
      if (!res.headersSent) res.status(422).json({ error: error instanceof Error ? error.message : "Não foi possível atualizar o espelho local." });
    });
  };
}

/** Rotas administrativas para refrescar o catálogo oficial e importar a BOM local. */
export function registrarRotasEstudioMubiSysEspelho(app: Express): void {
  app.post("/api/letra-caixa/mubisys/sincronizar", rota(async (req, res) => {
    if (!(await exigirGestao(req, res))) return;
    const resultado = await sincronizarCatalogoMubiSys();
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...resultado });
  }));

  app.get("/api/letra-caixa/mubisys/composicoes/template.csv", rota(async (req, res) => {
    if (!(await exigirGestao(req, res))) return;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=radrasys-composicoes-mubisys.csv");
    res.setHeader("Cache-Control", "no-store");
    res.send("\uFEFF" + await gerarTemplateComposicaoCsv());
  }));

  // Esta rota é registrada antes dos parsers JSON globais: CSV/XLSX chega como bytes,
  // com limite explícito e sem multipart/serviço externo de upload.
  app.put("/api/letra-caixa/mubisys/composicoes", express.raw({ type: "*/*", limit: "4mb" }), rota(async (req, res) => {
    if (!(await exigirGestao(req, res))) return;
    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: "Envie o arquivo CSV/XLSX diretamente no corpo da requisição." });
      return;
    }
    let nomeArquivo = req.get("x-file-name") || "composicoes.csv";
    try { nomeArquivo = decodeURIComponent(nomeArquivo); } catch { /* validação do formato abaixo */ }
    nomeArquivo = nomeArquivo.replace(/[\\/\x00-\x1f]/g, "_").slice(-255);
    const resultado = await importarComposicaoArquivo(req.body, nomeArquivo);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...resultado });
  }));
  app.post("/api/sync/import-bom", express.raw({ type: "*/*", limit: "4mb" }), rota(async (req, res) => {
    if (!(await exigirGestao(req, res))) return;
    let resultado;
    if (Buffer.isBuffer(req.body)) {
      const tipoConteudo = req.get("content-type") || "";
      if (tipoConteudo.includes("application/json")) {
        let conteudoJson: unknown;
        try { conteudoJson = JSON.parse(req.body.toString("utf8")); }
        catch { res.status(400).json({ error: "JSON da BOM inválido." }); return; }
        const body = conteudoJson && typeof conteudoJson === "object" ? conteudoJson as Record<string, unknown> : null;
        if (body && (typeof body.content === "string" || typeof body.contentBase64 === "string")) {
          const bytes = typeof body.contentBase64 === "string"
            ? Buffer.from(body.contentBase64.replace(/^data:[^,]+,/, ""), "base64")
            : Buffer.from(body.content as string, "utf8");
          const nomeArquivo = typeof body.fileName === "string" ? body.fileName : "bom.csv";
          resultado = await importarComposicaoArquivo(bytes, nomeArquivo);
        } else {
          resultado = await importarComposicaoJson(conteudoJson);
        }
      } else {
        let nomeArquivo = req.get("x-file-name") || "bom.csv";
        try { nomeArquivo = decodeURIComponent(nomeArquivo); } catch { /* o importador valida o conteúdo */ }
        nomeArquivo = nomeArquivo.replace(/[\\/\x00-\x1f]/g, "_").slice(-255);
        resultado = await importarComposicaoArquivo(req.body, nomeArquivo);
      }
    } else if (req.body && typeof req.body === "object") {
      const body = req.body as Record<string, unknown>;
      if (typeof body.content === "string" || typeof body.contentBase64 === "string") {
        const bytes = typeof body.contentBase64 === "string"
          ? Buffer.from(body.contentBase64.replace(/^data:[^,]+,/, ""), "base64")
          : Buffer.from(body.content as string, "utf8");
        const nomeArquivo = typeof body.fileName === "string" ? body.fileName : "bom.csv";
        resultado = await importarComposicaoArquivo(bytes, nomeArquivo);
      } else {
        resultado = await importarComposicaoJson(req.body);
      }
    } else {
      res.status(400).json({ error: "Envie um CSV/XLSX ou um objeto JSON com items/composicoes." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...resultado });
  }));
  app.post("/api/letra-caixa/mubisys/composicoes/calcular", express.json({ limit: "512kb" }), rota(async (req, res) => {
    if (!mesmaOrigem(req)) { res.status(403).json({ error: "A solicitação precisa vir do próprio sistema." }); return; }
    const sessao = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
    if (!sessao) { res.status(401).json({ error: "Entre no Radrasys para calcular a composição." }); return; }
    const schema = z.object({
      produtoId: z.number().int().positive(),
      modeloId: z.number().int().positive(),
      variacaoIds: z.array(z.number().int().positive()).max(100).default([]),
      composicaoItemIds: z.array(z.number().int().positive()).max(300).optional().default([]),
      medidas: z.object({
        areaM2: z.number().nonnegative().nullable().optional(),
        areaGeralM2: z.number().nonnegative().nullable().optional(),
        areaTotalNestingM2: z.number().nonnegative().nullable().optional(),
        perimExtM: z.number().nonnegative().nullable().optional(),
        perimTotalM: z.number().nonnegative().nullable().optional(),
      }).strict(),
      nestings: z.array(z.object({
        materiaPrimaId: z.number().int().positive(),
        areaLiquidaM2: z.number().nonnegative().nullable().optional(),
        areaUtilizadaM2: z.number().nonnegative().nullable().optional(),
        perimetroTotalM: z.number().nonnegative().nullable().optional(),
        custoMaterialEstimado: z.number().nonnegative().nullable().optional(),
      }).strict()).max(300).default([]),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Produto, modelo, medidas ou nesting inválidos." }); return; }
    const catalogo = await carregarCatalogoEspelhado();
    const selecionadas = new Set(parsed.data.variacaoIds);
    const idsComposicao = new Set(parsed.data.composicaoItemIds);
    const itens = catalogo.composicoesMubiSys.filter(item =>
      item.produtoId === parsed.data.produtoId && item.modeloId === parsed.data.modeloId &&
      (item.variacaoId == null || selecionadas.has(item.variacaoId)) &&
      (!idsComposicao.size || idsComposicao.has(item.itemId))
    );
    if (!itens.length) {
      res.status(409).json({ error: "A BOM deste modelo/variação ainda não foi importada." });
      return;
    }
    if (idsComposicao.size && new Set(itens.map(item => item.itemId)).size !== idsComposicao.size) {
      res.status(409).json({ error: "Uma ou mais linhas selecionadas não pertencem à BOM atual deste produto/modelo." });
      return;
    }

    const variacoesComFicha = new Set(itens.filter(item => item.variacaoId != null).map(item => item.variacaoId));
    const variacoesSemFicha = parsed.data.variacaoIds.filter(id => !variacoesComFicha.has(id));
    if (selecionadas.size && variacoesSemFicha.length && !itens.some(item => item.variacaoId == null)) {
      res.status(409).json({ error: "A BOM está incompleta para as variações selecionadas.", variacoesSemFicha });
      return;
    }
    const linhasInvalidas = itens.filter(item => !BASES_COBRANCA_PRODUTO.includes(item.formulaConsumo));
    if (linhasInvalidas.length) {
      res.status(422).json({ error: "Há perfil de consumo sem fórmula segura no CPQ.", materiasPrimas: linhasInvalidas.map(item => item.materiaPrimaNome) });
      return;
    }
    const calculo = calcularComposicaoComAcabamentos(itens.map(item => ({
      itemId: item.itemId,
      materiaPrimaId: item.materiaPrimaId,
      materiaPrima: item.materiaPrimaNome,
      unidade: item.unidade,
      formula: item.formulaConsumo,
      multiplicador: item.quantidade,
      custoUnitario: item.custoUnitario,
      acabamentos: item.acabamentos.map(acabamento => ({
        id: acabamento.id, nome: acabamento.nome, tipoCalculo: acabamento.tipoCalculo,
        quantidade: acabamento.quantidade, formula: BASES_COBRANCA_PRODUTO.find(formula => formula === acabamento.formulaConsumo) ?? null, custoAdicional: acabamento.custoAdicional,
        custoMateriaPrima: acabamento.custoMateriaPrima, custoMaoDeObra: acabamento.custoMaoDeObra,
        produtividadeHora: acabamento.produtividadeHora, horasEquipamento: acabamento.horasEquipamento,
      })),
      equipamentos: item.equipamentos.map(equipamento => ({
        id: equipamento.id, nome: equipamento.nome, horas: equipamento.horas,
        quantidade: equipamento.quantidade, custoHora: equipamento.custoHora,
      })),
    })), parsed.data.medidas, parsed.data.nestings);
    if (calculo.pendencias.length) {
      res.status(422).json({ error: "A BOM tem custos ou medidas pendentes; o total não foi calculado.", ...calculo });
      return;
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ok: true, ...calculo });
  }));
}
