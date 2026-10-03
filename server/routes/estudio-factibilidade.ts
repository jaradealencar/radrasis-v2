import { fromNodeHeaders } from "better-auth/node";
import { createHash } from "node:crypto";
import type { Express, Request, Response } from "express";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { estudioChapas } from "../../drizzle/schema";
import { criarAlerta } from "../db/alertas-helpers";
import { auth } from "../_core/auth";
import { getDb } from "../db/db";
import { listarMateriasPrimas } from "../integrations/mubisys-client";
import {
  calcularFactibilidadeFabricacao,
  calcularHashFactibilidade,
  CpqFactibilidadeError,
  emitirReciboDecisaoFactibilidade,
  emitirTicketAnaliseFactibilidade,
  validarAcaoFactibilidade,
  verificarTicketAnaliseFactibilidade,
  type CpqFactibilidadeMaterial,
} from "../services/cpqFactibilidadeFabricacao";

const analisarInput = z
  .object({
    sourceId: z.string().min(1).max(80),
    svg: z.string().min(20).max(1_500_000),
    larguraSvgMm: z.number().finite().positive().max(50_000),
    alturaSvgMm: z.number().finite().positive().max(50_000),
    materiaPrimaIds: z.array(z.number().int().positive()).min(1).max(10),
  })
  .strict()
  .superRefine((input, context) => {
    if (new Set(input.materiaPrimaIds).size !== input.materiaPrimaIds.length)
      context.addIssue({
        code: "custom",
        message: "A lista de matérias-primas não pode ter IDs repetidos.",
      });
  });

const decisionInput = z
  .object({
    sourceId: z.string().min(1).max(80),
    resultadoHash: z.string().regex(/^[a-f0-9]{64}$/),
    ticketAnalise: z.string().min(20).max(2000),
    acao: z.string().refine(validarAcaoFactibilidade),
    fatorEscalaAprovada: z.number().finite().positive().max(1).optional(),
    detalhesCorte: z.object({
      pecas_afetadas: z.array(z.string().max(120)).max(500),
      quantidade_emendas: z.number().int().nonnegative().max(5000),
      coordenadas_linha_corte: z.array(z.object({
        x1: z.number().finite(), y1: z.number().finite(), x2: z.number().finite(), y2: z.number().finite(),
        materiaPrimaId: z.number().int().positive(), materiaPrima: z.string().max(256), pecaId: z.string().max(120),
      }).strict()).max(2000),
    }).strict(),
  })
  .strict();

function respostaErro(res: Response, status: number, mensagem: string): void {
  res.status(status).json({ error: mensagem });
}

function mesmaOrigem(req: Request, res: Response): boolean {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    if (new URL(origin).host === req.get("host")) return true;
  } catch {
    // Rejeita cabeçalho Origin inválido.
  }
  respostaErro(res, 403, "A solicitação precisa vir do próprio sistema.");
  return false;
}

function rota(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((error: unknown) => {
      console.error("[EstudioFactibilidade] Falha na rota:", error);
      if (!res.headersSent)
        respostaErro(res, 500, "Não foi possível analisar a factibilidade agora.");
    });
  };
}

async function obterAtor(req: Request, res: Response) {
  const sessao = await auth.api
    .getSession({ headers: fromNodeHeaders(req.headers) })
    .catch(() => null);
  if (!sessao) {
    respostaErro(res, 401, "Entre no Radrasys para analisar a factibilidade de fabricação.");
    return null;
  }
  return {
    id: sessao.user.id,
    nome: sessao.user.name,
    role: String(sessao.user.role ?? ""),
  };
}

/** Factibilidade por matéria-prima e recibos assinados das decisões de emenda. */
export function registrarRotasEstudioFactibilidade(app: Express): void {
  app.post("/api/letra-caixa/factibilidade", rota(analisar));
  app.post("/api/letra-caixa/factibilidade/decidir", rota(decidir));
}

async function analisar(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  if (!(await obterAtor(req, res))) return;
  const parsed = analisarInput.safeParse(req.body);
  if (!parsed.success)
    return void respostaErro(
      res,
      400,
      "Confira SVG, escala física e matérias-primas selecionadas."
    );
  const db = await getDb();
  if (!db) return void respostaErro(res, 503, "O banco de dados está indisponível.");

  const [catalogo, chapas] = await Promise.all([
    listarMateriasPrimas(),
    db
      .select()
      .from(estudioChapas)
      .where(inArray(estudioChapas.mubisysMateriaPrimaId, parsed.data.materiaPrimaIds))
      .then(rows => rows.filter(row => row.ativo)),
  ]);
  const byId = new Map(catalogo.map(material => [material.id, material]));
  const materials: CpqFactibilidadeMaterial[] = [];
  for (const id of parsed.data.materiaPrimaIds) {
    const material = byId.get(id);
    if (!material)
      return void respostaErro(
        res,
        422,
        `A matéria-prima ${id} não está no catálogo atual do MubiSys.`
      );
    materials.push({
      id: material.id,
      nome: material.nome,
      chapas: chapas
        .filter(chapa => chapa.mubisysMateriaPrimaId === id)
        .map(chapa => ({
          id: chapa.id,
          nome: chapa.nome,
          larguraMm: chapa.larguraMm,
          alturaMm: chapa.alturaMm,
        })),
    });
  }

  try {
    const resultado = calcularFactibilidadeFabricacao({
      svg: parsed.data.svg,
      larguraSvgMm: parsed.data.larguraSvgMm,
      alturaSvgMm: parsed.data.alturaSvgMm,
      materiais: materials,
    });
    const resultadoHash = calcularHashFactibilidade(parsed.data.sourceId, resultado);
    const ticketAnalise = emitirTicketAnaliseFactibilidade({
      sourceId: parsed.data.sourceId,
      resultadoHash,
      hashSvgEntrada: createHash("sha256").update(parsed.data.svg).digest("hex"),
      detalhesCorteHash: createHash("sha256").update(JSON.stringify(resultado.detalhes_corte)).digest("hex"),
      statusFactibilidade: resultado.status_factibilidade,
      fatorEscalaAplicado: resultado.fator_escala_aplicado,
      fatorEscalaMinimoParaCaber: resultado.fator_escala_minimo_para_caber,
      hashSvgRedimensionadoOpcao: resultado.hash_svg_redimensionado_opcao,
      materiais: resultado.materiais.map(material => ({
        idMateriaPrima: material.id_materia_prima,
        idChapa: material.id_maior_chapa,
        hashSvgParaNesting: material.hash_svg_para_nesting,
        hashPecasParaNesting: material.hash_pecas_para_nesting,
        hashPecasRedimensionadasOpcao: material.hash_pecas_redimensionadas_opcao,
      })),
    });
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      ...resultado,
      sourceId: parsed.data.sourceId,
      resultadoHash,
      ticketAnalise,
      calculadoEm: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof CpqFactibilidadeError) {
      const status =
        error.code === "configuration"
          ? 503
          : error.code === "missing_board"
            ? 422
            : 400;
      respostaErro(res, status, error.message);
      return;
    }
    throw error;
  }
}

async function decidir(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  const ator = await obterAtor(req, res);
  if (!ator) return;
  const parsed = decisionInput.safeParse(req.body);
  if (!parsed.success)
    return void respostaErro(res, 400, "A decisão precisa estar vinculada à análise atual.");
  const { sourceId, resultadoHash, ticketAnalise, acao, fatorEscalaAprovada } = parsed.data;
  let claims;
  try {
    claims = verificarTicketAnaliseFactibilidade(ticketAnalise, sourceId, resultadoHash);
  } catch (error) {
    return void respostaErro(
      res,
      409,
      error instanceof Error ? error.message : "A análise expirou; recalcule a factibilidade."
    );
  }

  if (acao === "SOLICITAR_ANALISE_HUMANA") {
    if (claims.statusFactibilidade !== "REQUER_APROVACAO_EMENDA") {
      respostaErro(res, 409, "A análise não requer avaliação humana para seguir ao nesting.");
      return;
    }
    const detalhesHash = createHash("sha256").update(JSON.stringify(parsed.data.detalhesCorte)).digest("hex");
    if (detalhesHash !== claims.detalhesCorteHash) {
      respostaErro(res, 409, "As linhas de corte não correspondem à análise assinada.");
      return;
    }
    const linhas = parsed.data.detalhesCorte.coordenadas_linha_corte.slice(0, 100);
    const descricao = [
      `Solicitante: ${ator.nome} (${ator.id})`,
      `sourceId: ${sourceId}`,
      `resultadoHash: ${resultadoHash}`,
      `Peças afetadas: ${parsed.data.detalhesCorte.pecas_afetadas.join(", ") || "nenhuma"}`,
      `Emendas: ${parsed.data.detalhesCorte.quantidade_emendas}`,
      `Coordenadas (máximo 100): ${JSON.stringify(linhas)}`,
    ].join("\n").slice(0, 19_500);
    await criarAlerta({
      tipo: "manual",
      severidade: "aviso",
      titulo: "Revisão de emenda técnica do CPQ",
      descricao,
      referenciaTipo: "cpq_factibilidade",
      referenciaExtra: `${sourceId}:${resultadoHash}`.slice(0, 256),
    });
    res.status(202).json({
      status_factibilidade: "ANALISE_HUMANA_SOLICITADA",
      sourceId,
      resultadoHash,
      solicitadoPor: ator,
      solicitadoEm: new Date().toISOString(),
      mensagem:
        "A cotação permanece bloqueada até a engenharia/vendas revisar e registrar uma decisão.",
    });
    return;
  }
  if (claims.statusFactibilidade !== "REQUER_APROVACAO_EMENDA") {
    respostaErro(res, 409, "Esta análise já está apta para o nesting e não precisa de aprovação de emenda.");
    return;
  }
  if (acao === "REDIMENSIONAR_PARA_CABER") {
    if (
      claims.hashSvgRedimensionadoOpcao == null ||
      fatorEscalaAprovada == null ||
      Math.abs(fatorEscalaAprovada - claims.fatorEscalaMinimoParaCaber) > 1e-8
    ) {
      respostaErro(res, 409, "O redimensionamento não corresponde à opção calculada pelo servidor.");
      return;
    }
  }
  if (!["gestor", "admin", "master"].includes(ator.role)) {
    respostaErro(
      res,
      403,
      "Somente gestor, admin ou master pode aprovar uma emenda ou o redimensionamento acima de 3%."
    );
    return;
  }
  const aprovadoEm = new Date().toISOString();
  const reciboDecisao = emitirReciboDecisaoFactibilidade({
    sourceId,
    resultadoHash,
    acao,
    aprovadoPor: ator,
    aprovadoEm,
    ...(acao === "REDIMENSIONAR_PARA_CABER" ? { fatorEscalaAprovada } : {}),
  });
  res.json({
    status_factibilidade:
      acao === "APROVAR_EMENDA_TECNICA" ? "EMENDA_APROVADA" : "REDIMENSIONAMENTO_APROVADO",
    sourceId,
    resultadoHash,
    acao,
    aprovadoPor: ator,
    aprovadoEm,
    ...(acao === "REDIMENSIONAR_PARA_CABER" ? { fatorEscalaAprovada } : {}),
    reciboDecisao,
  });
}
