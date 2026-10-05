import { createHash, randomBytes } from "crypto";
import { fromNodeHeaders } from "better-auth/node";
import type { Express, Request, Response } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { estudioMapeamentoCoresCotacao, propostas } from "../../drizzle/schema";
import { auth } from "../_core/auth";
import { getDb } from "../db/db";
import {
  aprovarPrecoCalculado,
  aprovarSugestaoPreco,
  hashBasePreco,
  precoContextoSchema,
  sugerirPrecoComGPT,
  verificarAprovacaoPreco,
} from "../services/cpqPrecoAssistente";
import {
  verificarReciboDecisaoFactibilidade,
  verificarTicketAnaliseFactibilidade,
} from "../services/cpqFactibilidadeFabricacao";
import { verificarReciboNesting } from "../services/cpqNesting";

const PREFIXO_ESTUDIO = "[ESTUDIO_COTACAO_V1]";
const reacooes = [
  "aprovado",
  "negociar_pagamento",
  "readequar_menor",
  "em_analise",
  "fora_orcamento",
] as const;

const mapeamentoRegiaoSchema = z.object({
  regionKey: z.string().min(1).max(80),
  tipoCor: z.enum(["solida", "gradiente", "complexa", "desconhecida"]),
  corHex: z.string().regex(/^#[\da-f]{6}$/i).nullable(),
  corRgb: z.object({ r: z.number().int().min(0).max(255), g: z.number().int().min(0).max(255), b: z.number().int().min(0).max(255) }).nullable(),
  pantoneCode: z.string().max(32).nullable(),
  cmyk: z.object({ c: z.number().min(0).max(100), m: z.number().min(0).max(100), y: z.number().min(0).max(100), k: z.number().min(0).max(100) }).strict().nullable(),
  coresGradiente: z.array(z.string().regex(/^#[\da-f]{6}$/i)).max(20),
  pathIndexes: z.array(z.number().int().nonnegative().max(499)).max(500),
  areaM2: z.number().finite().nonnegative().nullable(),
  areaLiquidaM2: z.number().finite().nonnegative().nullable().optional(),
  areaTotalM2: z.number().finite().nonnegative().nullable().optional(),
  areaConsumoM2: z.number().finite().nonnegative().nullable().optional(),
  dadosPreco: z.object({
    areaLiquidaM2: z.number().finite().nonnegative(),
    areaTotalM2: z.number().finite().positive(),
    larguraMm: z.number().finite().positive(),
    alturaMm: z.number().finite().positive(),
    boundingBoxesMm: z.array(z.object({
      minX: z.number().finite(), maxX: z.number().finite(),
      minY: z.number().finite(), maxY: z.number().finite(),
    }).strict().refine(box => box.maxX > box.minX && box.maxY > box.minY)).min(1).max(500),
  }).strict().nullable().optional(),
  tipoSugestao: z.enum(["chapa", "imprimax", "impresso", "pendente"]),
  chapaId: z.number().int().positive().nullable(),
  chapaMateriaPrimaId: z.number().int().positive().nullable(),
  chapaBaseId: z.number().int().positive().nullable(),
  chapaBaseMateriaPrimaId: z.number().int().positive().nullable(),
  requerChapaBase: z.boolean(),
  requerConfirmacaoConstrucao: z.boolean(),
  imprimaxAdesivoId: z.number().int().positive().nullable(),
  deltaE00: z.number().finite().nonnegative().nullable(),
  custoEstimado: z.number().finite().nonnegative().nullable(),
  unidadeCusto: z.enum(["m2"]).nullable(),
  avisos: z.array(z.string().max(1000)).max(20),
  alternativas: z.array(z.record(z.string(), z.unknown())).max(5),
  precificacao: z.record(z.string(), z.unknown()).nullable(),
  composicaoFace: z.record(z.string(), z.unknown()).nullable(),
}).strict();

const factibilidadeSchema = z.object({
  statusFactibilidade: z.enum(["APTO_NESTING", "REQUER_APROVACAO_EMENDA"]),
  resultadoHash: z.string().regex(/^[a-f0-9]{64}$/),
  ticketAnalise: z.string().min(20).max(2000),
  fatorEscalaAplicado: z.number().finite().positive().max(1),
  margemBordaMm: z.number().finite().min(0).max(50).optional().default(0),
  acao: z.enum(["APROVAR_EMENDA_TECNICA", "REDIMENSIONAR_PARA_CABER"]).nullable(),
  reciboDecisao: z.string().min(20).max(2000).nullable(),
  detalhesCorte: z.object({
    pecas_afetadas: z.array(z.string().max(120)).max(500),
    quantidade_emendas: z.number().int().nonnegative().max(5000),
    coordenadas_linha_corte: z.array(z.object({
      x1: z.number().finite(), y1: z.number().finite(), x2: z.number().finite(), y2: z.number().finite(),
      materiaPrimaId: z.number().int().positive(), materiaPrima: z.string().max(256), pecaId: z.string().max(120),
    }).strict()).max(2000),
  }).strict(),
  avisos: z.array(z.string().max(1000)).max(20),
  materiais: z.array(z.object({
    idMateriaPrima: z.number().int().positive(),
    idChapa: z.number().int().positive(),
    hashFormatos: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    hashSvgParaNesting: z.string().regex(/^[a-f0-9]{64}$/),
    hashPecasParaNesting: z.string().regex(/^[a-f0-9]{64}$/),
    hashPecasRedimensionadasOpcao: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  }).strict()).min(1).max(10),
}).strict();

const snapshotSchema = z.object({
  dataEmissao: z.string().datetime(),
  validadeDias: z.number().int().min(1).max(365),
  modalidadeFrete: z.enum(["FOB", "CIF", "retira", "entrega"]).nullable(),
  metodoPagamento: z.enum(["boleto", "cartao", "pix", "ted"]).nullable(),
  formasPagamentoPermitidas: z.array(z.enum(["boleto", "cartao", "pix", "ted"])).refine((formas) => formas.includes("pix")).optional().default(["pix", "cartao", "boleto", "ted"]),
  jurosCartaoPct: z.array(z.number().min(0).max(100)).length(6).optional().default([0, 0, 0, 0, 0, 0]),
  cliente: z.object({
    cnpj: z.string().max(20).nullable(),
    razao: z.string().max(256).nullable(),
    fantasia: z.string().max(256).nullable(),
    endereco: z.string().max(1000).nullable(),
    email: z.string().max(320).nullable().optional().default(null),
    whatsapp: z.string().max(40).nullable().optional().default(null),
  }),
  vendedor: z.string().min(1).max(256),
  whatsappVendedor: z.string().max(32).nullable().optional().default(null),
  tituloProposta: z.string().max(256).optional().default(""),
  imagemReferenciaUrl: z.string().url().max(2048).nullable().optional().default(null),
  imagemRedesenhadaUrl: z.string().url().max(2048).nullable().optional().default(null),
  nestingSvg: z.string().max(1_500_000).nullable().optional().default(null),
  factibilidade: factibilidadeSchema.nullable().optional().default(null),
  larguraNestingMm: z.number().finite().positive().max(50_000).nullable().optional().default(null),
  alturaNestingMm: z.number().finite().positive().max(50_000).nullable().optional().default(null),
  modeloNome: z.string().min(1).max(256),
  mubisysProdutoId: z.number().int().positive().nullable().optional(),
  mubisysModeloId: z.number().int().positive().nullable().optional(),
  variacoesModelo: z.array(z.object({
    id: z.number().int().positive(),
    nome: z.string().max(256),
  }).strict()).max(100).optional().default([]),
  descricaoProduto: z.string().max(5000).default(""),
  variacoes: z.array(z.object({
    nome: z.string().min(1).max(80),
    valor: z.string().min(1).max(120),
  })).max(100).optional().default([]),
  areaM2: z.number().nonnegative().nullable(),
  areaGeralM2: z.number().nonnegative().nullable(),
  areaTotalNestingM2: z.number().nonnegative().nullable().optional(),
  perimExtM: z.number().nonnegative().nullable().optional(),
  perimTotalM: z.number().nonnegative().nullable().optional(),
  materiais: z.array(z.object({
    mubisysMateriaPrimaId: z.number().int().positive().nullable(),
    nome: z.string().max(256),
    unidade: z.string().max(80),
    custoUnitario: z.number().nonnegative(),
    quantidade: z.number().nonnegative(),
    custoTotal: z.number().nonnegative(),
    formulaType: z.string().max(40),
    multiplicador: z.number().nonnegative(),
    variacaoModeloId: z.number().int().positive().nullable(),
    variacaoModeloNome: z.string().max(256).nullable(),
    variacaoMaterial: z.object({
      nome: z.string().max(80),
      valor: z.string().max(120),
      materiaPrimaNome: z.string().max(256),
    }).nullable(),
    nesting: z.object({
      idChapa: z.number().int().positive(),
      nomeChapa: z.string().max(256),
      larguraMm: z.number().positive(),
      alturaMm: z.number().positive(),
      areaChapaM2: z.number().positive(),
      areaUtilizadaM2: z.number().positive(),
      areaLiquidaM2: z.number().positive(),
      areaSobraM2: z.number().nonnegative(),
      perimetroTotalM: z.number().nonnegative(),
      aproveitamentoPct: z.number().min(0).max(100),
      criterio: z.enum(["menor_chapa_que_comporta", "menor_sobra_financeira", "maior_aproveitamento"]),
      custoUnitarioCatalogo: z.number().nonnegative(),
      unidadeCusto: z.string().max(80),
      custoMaterialEstimado: z.number().nonnegative().nullable(),
      custoSobraEstimado: z.number().nonnegative().nullable(),
      alertaCusto: z.string().max(1000).nullable(),
      chapaPrincipal: z.boolean(),
      espacamentoPecasMm: z.number().min(0).max(50).optional(),
      margemBordaMm: z.number().min(0).max(50).optional(),
      reciboIntegridade: z.string().min(20).max(4000),
    }).nullable().optional(),
  }).strict()).max(300).optional().default([]),
  mapeamentoCores: z.object({
    aprovado: z.boolean(),
    iluminacao: z.enum(["sem_iluminacao", "frontlight", "backlight"]),
    regioes: z.array(mapeamentoRegiaoSchema).max(500),
    custoAdicional: z.number().finite().nonnegative(),
    pendencias: z.array(z.record(z.string(), z.unknown())).max(500),
  }).strict().nullable().optional().default(null),
  custoMateriais: z.number().finite().nonnegative(),
  custoFixo: z.number().finite().nonnegative(),
  custoServicos: z.number().finite().nonnegative(),
  custoDireto: z.number().finite().nonnegative(),
  precoCalculado: z.number().finite().nonnegative(),
  modoPreco: z.enum(["margem", "fixo"]),
  linhaPrecificacaoId: z.number().int().positive().nullable().optional().default(null),
  margemAplicadaPct: z.number().finite().min(0).max(99.99).nullable(),
  precoFixo: z.number().finite().nonnegative().nullable(),
  instalacao: z.number().finite().nonnegative(),
  descontoPct: z.number().finite().min(0).max(100),
  regraPreco: z.string().min(1).max(500),
  margemPct: z.number().finite().min(-1000).max(1000).nullable(),
  precificacaoIA: z.object({
    recibo: z.string().min(20).max(6000),
    contexto: precoContextoSchema,
    auditoria: z.object({
      origem: z.enum(["gpt", "calculado"]),
      sugeridoPorId: z.string().nullable(),
      aprovadoPor: z.object({ id: z.string(), nome: z.string(), role: z.string() }).strict(),
      aprovadoEm: z.string().datetime(),
      precoAprovado: z.number().nonnegative(),
      sugestaoId: z.string().nullable(),
      parecer: z.string().nullable(),
      alertas: z.array(z.string()),
      assinaturaBase: z.string().length(64),
      assinaturaCotacao: z.string().length(64),
    }).strict().optional(),
  }).strict().optional(),
  precoFinal: z.number().nonnegative(),
  prazoDiasUteis: z.number().int().nonnegative().nullable(),
  status: z.literal("enviado"),
}).strict();

const MAX_DESENHOS_POR_COTACAO = 3;
const GRUPO_ID_REGEX = /^g[A-Za-z0-9_-]{20,40}$/;
/**
 * Vários desenhos (cada um com seu produto) numa mesma proposta ao cliente: cada desenho continua sendo uma
 * cotação própria, validada e com preço aprovado como sempre; o grupo só liga essas cotações para o cliente ver
 * tudo num único link, com o total somado e uma resposta só. O código do grupo fica fora do snapshot assinado.
 */
const grupoSchema = z.object({
  id: z.string().regex(GRUPO_ID_REGEX),
  posicao: z.number().int().min(1).max(MAX_DESENHOS_POR_COTACAO),
}).strict();

const criarSchema = z.object({
  sourceId: z.string().min(1).max(80),
  snapshot: snapshotSchema,
  grupo: grupoSchema.optional(),
});

type Snapshot = z.infer<typeof snapshotSchema> & {
  sourceId: string;
  numeroCotacao: string;
  grupo?: z.infer<typeof grupoSchema> | null;
  reacaoCliente: {
    tipo: typeof reacooes[number];
    comentario: string;
    respondidoEm: string;
    formaPagamento?: "boleto" | "cartao" | "pix" | "ted";
    parcelasCartao?: number | null;
    valorPagamento?: number;
  } | null;
};

function lerSnapshot(observacoes: string | null): Snapshot | null {
  if (!observacoes?.startsWith(PREFIXO_ESTUDIO)) return null;
  try {
    const valor = JSON.parse(observacoes.slice(PREFIXO_ESTUDIO.length));
    return valor && typeof valor === "object" ? (valor as Snapshot) : null;
  } catch {
    return null;
  }
}

function gravarSnapshot(snapshot: Snapshot): string {
  return PREFIXO_ESTUDIO + JSON.stringify(snapshot);
}

function numeroCotacao(id: number): string {
  return `COT-${String(id).padStart(6, "0")}`;
}

function validarFactibilidadeSnapshot(
  sourceId: string,
  snapshot: z.infer<typeof snapshotSchema>
) {
  const factibilidade = snapshot.factibilidade;
  if (!snapshot.mapeamentoCores?.aprovado)
    throw new Error("Revise e aprove o mapeamento de cores e materiais antes de emitir a cotação.");
  const pendenciaCustoCor = snapshot.mapeamentoCores.regioes.some(regiao =>
    (regiao.tipoSugestao === "imprimax" || regiao.tipoSugestao === "impresso")
      && (regiao.custoEstimado == null || regiao.areaTotalM2 == null || regiao.areaTotalM2 <= 0
        || regiao.areaConsumoM2 == null || regiao.areaConsumoM2 <= 0
        || !regiao.dadosPreco || regiao.dadosPreco.areaTotalM2 == null || regiao.dadosPreco.areaTotalM2 <= 0)
  );
  if (pendenciaCustoCor)
    throw new Error("Há adesivo sem geometria, consumo de bobina ou custo calculado. Confira os custos e a configuração da bobina antes de emitir.");
  if (!snapshot.nestingSvg) {
    throw new Error("O SVG vetorial é obrigatório para analisar e cotar a geometria.");
  }
  if (!factibilidade)
    throw new Error("Calcule e aprove a factibilidade antes de analisar ou emitir esta cotação.");

  const analise = verificarTicketAnaliseFactibilidade(
    factibilidade.ticketAnalise,
    sourceId,
    factibilidade.resultadoHash
  );
  const fatorEscalaEsperado = factibilidade.acao === "REDIMENSIONAR_PARA_CABER"
    ? analise.fatorEscalaMinimoParaCaber
    : analise.fatorEscalaAplicado;
  if (
    analise.statusFactibilidade !== factibilidade.statusFactibilidade ||
    analise.hashSvgEntrada !== createHash("sha256").update(snapshot.nestingSvg).digest("hex") ||
    analise.detalhesCorteHash !== createHash("sha256").update(JSON.stringify(factibilidade.detalhesCorte)).digest("hex") ||
    Math.abs(fatorEscalaEsperado - factibilidade.fatorEscalaAplicado) > 1e-8 ||
    Math.abs((analise.margemBordaMm ?? 0) - factibilidade.margemBordaMm) > 1e-8
  ) {
    throw new Error("A factibilidade não corresponde ao resultado assinado pelo servidor.");
  }
  const materiaisAssinados = [...analise.materiais].sort((a, b) => a.idMateriaPrima - b.idMateriaPrima);
  const materiaisRecebidos = factibilidade.materiais
    .map(material => ({
      idMateriaPrima: material.idMateriaPrima,
      idChapa: material.idChapa,
      hashFormatos: material.hashFormatos,
      hashSvgParaNesting: material.hashSvgParaNesting,
      hashPecasParaNesting: material.hashPecasParaNesting,
      hashPecasRedimensionadasOpcao: material.hashPecasRedimensionadasOpcao,
    }))
    .sort((a, b) => a.idMateriaPrima - b.idMateriaPrima);
  if (JSON.stringify(materiaisAssinados) !== JSON.stringify(materiaisRecebidos))
    throw new Error("Os materiais ou arquivos de nesting foram alterados depois da análise.");

  const idsMateriaisComChapa = new Set(materiaisAssinados.map(material => material.idMateriaPrima));
  const linhasNesting = (snapshot.materiais ?? []).filter(linha => linha.nesting);
  for (const idMateriaPrima of idsMateriaisComChapa) {
    if (!(snapshot.materiais ?? []).some(linha => linha.mubisysMateriaPrimaId === idMateriaPrima))
      throw new Error(`O nesting da matéria-prima ${idMateriaPrima} não está no snapshot do orçamento.`);
  }
  for (const linha of snapshot.materiais ?? []) {
    const idMateriaPrima = linha.mubisysMateriaPrimaId;
    if (idMateriaPrima != null && idsMateriaisComChapa.has(idMateriaPrima) && !linha.nesting)
      throw new Error(`O nesting da matéria-prima ${idMateriaPrima} precisa constar em cada linha de consumo.`);
    if (!linha.nesting) continue;
    const nesting = linha.nesting;
    if (idMateriaPrima == null || !idsMateriaisComChapa.has(idMateriaPrima))
      throw new Error("O snapshot contém um nesting sem matéria-prima vinculada à análise.");
    const assinado = verificarReciboNesting(nesting.reciboIntegridade, sourceId, factibilidade.resultadoHash, factibilidade.acao);
    const dimensoes = { larguraMm: assinado.chapa.largura_mm, alturaMm: assinado.chapa.altura_mm };
    if (
      assinado.id_materia_prima !== idMateriaPrima ||
      assinado.materia_prima !== linha.nome ||
      (assinado.espacamento_pecas_mm != null && assinado.espacamento_pecas_mm !== nesting.espacamentoPecasMm) ||
      (assinado.margem_borda_mm != null && assinado.margem_borda_mm !== nesting.margemBordaMm) ||
      assinado.id_chapa_utilizada !== nesting.idChapa ||
      assinado.nome_chapa_utilizada !== nesting.nomeChapa ||
      dimensoes.larguraMm !== nesting.larguraMm || dimensoes.alturaMm !== nesting.alturaMm ||
      Math.abs(assinado.chapa.largura_mm * assinado.chapa.altura_mm / 1_000_000 - nesting.areaChapaM2) > 1e-8 ||
      Math.abs(assinado.area_chapa_utilizada_m2 - nesting.areaUtilizadaM2) > 1e-8 ||
      Math.abs(assinado.area_liquida_m2 - nesting.areaLiquidaM2) > 1e-8 ||
      Math.abs(assinado.area_sobra_m2 - nesting.areaSobraM2) > 1e-8 ||
      Math.abs(assinado.perimetro_total_m - nesting.perimetroTotalM) > 1e-8 ||
      Math.abs(assinado.porcentagem_aproveitamento - nesting.aproveitamentoPct) > 1e-8 ||
      assinado.criterio_escolha !== nesting.criterio ||
      assinado.chapa_principal !== nesting.chapaPrincipal ||
      (assinado.custo_unitario ?? 0) !== nesting.custoUnitarioCatalogo ||
      assinado.unidade_custo !== nesting.unidadeCusto ||
      assinado.custo_material_estimado !== nesting.custoMaterialEstimado ||
      assinado.custo_sobra_estimado !== nesting.custoSobraEstimado ||
      assinado.alerta_custo !== nesting.alertaCusto
    ) throw new Error("As métricas de nesting foram alteradas depois do cálculo no servidor.");
  }

  if (factibilidade.statusFactibilidade === "REQUER_APROVACAO_EMENDA") {
    if (!factibilidade.acao || !factibilidade.reciboDecisao)
      throw new Error("A cotação está bloqueada até a emenda ou o redimensionamento ser aprovado.");
    const decisao = verificarReciboDecisaoFactibilidade(
      factibilidade.reciboDecisao,
      sourceId,
      factibilidade.resultadoHash,
      factibilidade.acao
    );
    if (factibilidade.acao === "REDIMENSIONAR_PARA_CABER") {
      if (
        analise.hashSvgRedimensionadoOpcao == null ||
        decisao.fatorEscalaAprovada == null ||
        Math.abs(decisao.fatorEscalaAprovada - factibilidade.fatorEscalaAplicado) > 1e-8
      ) {
        throw new Error("O fator de redimensionamento não corresponde à opção aprovada.");
      }
    } else if (factibilidade.fatorEscalaAplicado !== 1) {
      throw new Error("A emenda técnica aprovada deve manter a escala original.");
    }
  } else if (factibilidade.acao || factibilidade.reciboDecisao) {
    throw new Error("Esta cotação está apta e não deve conter uma decisão de emenda.");
  }

  return {
    statusFactibilidade: factibilidade.statusFactibilidade,
    resultadoHash: factibilidade.resultadoHash,
    fatorEscalaAplicado: factibilidade.fatorEscalaAplicado,
    acao: factibilidade.acao,
    materiais: materiaisRecebidos,
  };
}

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
      console.error("[EstudioCotacoes] Falha na rota:", error);
      if (!res.headersSent) respostaErro(res, 500, "Não foi possível concluir esta operação agora.");
    });
  };
}

async function exigirSessao(req: Request, res: Response): Promise<boolean> {
  const sessao = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  if (sessao) return true;
  respostaErro(res, 401, "Entre no Radrasys para acessar o histórico de cotações.");
  return false;
}

/** Cotações do CPQ Letreiros Express usam a tabela existente, com snapshot próprio no campo observações. */
export function registrarRotasEstudioCotacoes(app: Express): void {
  app.post("/api/letra-caixa/precos/sugerir", rota(sugerirPreco));
  app.post("/api/letra-caixa/precos/aprovar", rota(aprovarPreco));
  app.post("/api/letra-caixa/cotacoes", rota(criarCotacao));
  app.get("/api/letra-caixa/cotacoes", rota(listarCotacoes));
  app.get("/api/letra-caixa/cotacoes/grupo/:grupoId", rota(obterGrupoPublico));
  app.post("/api/letra-caixa/cotacoes/grupo/:grupoId/resposta", rota(registrarRespostaGrupo));
  app.get("/api/letra-caixa/cotacoes/:token", rota(obterCotacaoPublica));
  app.post("/api/letra-caixa/cotacoes/:token/resposta", rota(registrarResposta));
}

function basePrecoSnapshot(sourceId: string, snapshot: z.infer<typeof snapshotSchema>) {
  const factibilidade = validarFactibilidadeSnapshot(sourceId, snapshot);
  return {
    sourceId,
    mubisysProdutoId: snapshot.mubisysProdutoId ?? null,
    mubisysModeloId: snapshot.mubisysModeloId ?? null,
    modeloNome: snapshot.modeloNome,
    variacoesModelo: snapshot.variacoesModelo ?? [],
    medidas: {
      areaM2: snapshot.areaM2,
      areaGeralM2: snapshot.areaGeralM2,
      areaTotalNestingM2: snapshot.areaTotalNestingM2 ?? null,
      perimExtM: snapshot.perimExtM ?? null,
      perimTotalM: snapshot.perimTotalM ?? null,
    },
    materiais: snapshot.materiais ?? [],
    mapeamentoCores: snapshot.mapeamentoCores,
    factibilidade,
    custoDireto: snapshot.custoDireto,
    custoMateriais: snapshot.custoMateriais,
    custoFixo: snapshot.custoFixo,
    custoServicos: snapshot.custoServicos,
    precoCalculado: snapshot.precoCalculado,
    modoPreco: snapshot.modoPreco,
    linhaPrecificacaoId: snapshot.linhaPrecificacaoId ?? null,
    margemAplicadaPct: snapshot.margemAplicadaPct,
    precoFixo: snapshot.precoFixo,
    instalacao: snapshot.instalacao,
    descontoPct: snapshot.descontoPct,
    regraPreco: snapshot.regraPreco,
    margemPct: snapshot.margemPct,
  };
}

function assinaturaSnapshotCotacao(sourceId: string, snapshot: z.infer<typeof snapshotSchema>): string {
  const { precificacaoIA: _precificacaoIA, status: _status, ...conteudo } = snapshot;
  return hashBasePreco({ sourceId, snapshot: conteudo });
}

function contextoPrecoSnapshot(snapshot: z.infer<typeof snapshotSchema>) {
  for (const linha of snapshot.materiais ?? []) {
    const medida = linha.formulaType === "areaTotal" ? (linha.nesting?.areaUtilizadaM2 ?? snapshot.areaTotalNestingM2 ?? snapshot.areaGeralM2 ?? 0)
      : linha.formulaType === "area" ? (linha.nesting?.areaLiquidaM2 ?? snapshot.areaM2)
      : linha.formulaType === "areaGeral" ? snapshot.areaGeralM2
      : linha.formulaType === "perimExt" ? snapshot.perimExtM
      : linha.formulaType === "perimTotal" ? (linha.nesting?.perimetroTotalM ?? snapshot.perimTotalM)
      : 1;
    if (linha.formulaType !== "fixo" && ["areaTotal", "area", "areaGeral", "perimExt", "perimTotal"].includes(linha.formulaType)
      && (medida == null || (medida <= 0 && linha.multiplicador > 0))) {
      throw new Error(`A medida usada pela fórmula de ${linha.nome} está ausente ou zerada.`);
    }
    const quantidadeEsperada = (medida ?? 0) * linha.multiplicador;
    if (Math.abs(linha.quantidade - quantidadeEsperada) > 0.005) {
      throw new Error(`A quantidade de ${linha.nome} não corresponde à fórmula e às medidas atuais.`);
    }
  }
  const custoMateriaisLinhas = (snapshot.materiais ?? []).reduce(
    (total, linha) => total + linha.custoTotal,
    snapshot.mapeamentoCores?.custoAdicional ?? 0,
  );
  if ((snapshot.materiais ?? []).some((linha) => linha.quantidade > 0 && linha.custoUnitario <= 0)) {
    throw new Error("Há matéria-prima sem custo válido. Atualize os custos antes da análise ou aprovação.");
  }
  if ((snapshot.materiais ?? []).some((linha) => Math.abs(linha.custoTotal - linha.quantidade * linha.custoUnitario) > 0.02)) {
    throw new Error("O subtotal de uma matéria-prima não corresponde à quantidade e ao custo unitário.");
  }
  const custoDiretoEsperado = snapshot.custoMateriais + snapshot.custoFixo + snapshot.custoServicos;
  const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
  if (Math.abs(arredondar(custoMateriaisLinhas) - arredondar(snapshot.custoMateriais)) > 0.02
    || Math.abs(arredondar(custoDiretoEsperado) - arredondar(snapshot.custoDireto)) > 0.02) {
    throw new Error("Os custos das linhas não fecham com o custo direto. Recalcule o orçamento antes da aprovação.");
  }
  const precoEsperado = snapshot.modoPreco === "fixo"
    ? (snapshot.precoFixo ?? 0) * (1 - snapshot.descontoPct / 100)
    : snapshot.margemAplicadaPct == null || snapshot.margemAplicadaPct >= 100
      ? Number.NaN
      : (snapshot.custoDireto / (1 - snapshot.margemAplicadaPct / 100) + snapshot.instalacao) * (1 - snapshot.descontoPct / 100);
  if (!Number.isFinite(precoEsperado) || Math.abs(arredondar(precoEsperado) - arredondar(snapshot.precoCalculado)) > 0.02) {
    throw new Error("O preço calculado não corresponde à regra informada. Recalcule o orçamento antes da aprovação.");
  }
  return precoContextoSchema.parse({
    produto: snapshot.modeloNome,
    custoDireto: snapshot.custoDireto,
    precoAtual: snapshot.precoCalculado,
    regra: snapshot.regraPreco,
    margemAtualPct: snapshot.margemPct,
    itens: [
      ...(snapshot.materiais ?? []).map((material) => ({
        nome: material.nome,
        quantidade: material.quantidade,
        custoTotal: material.custoTotal,
      })),
      ...(snapshot.mapeamentoCores?.regioes ?? [])
        .filter(region => region.tipoSugestao === "imprimax" || region.tipoSugestao === "impresso")
        .map(region => ({
          nome: `${region.tipoSugestao === "impresso" ? "Adesivo impresso" : "Adesivo Imprimax"} · ${region.corHex ?? region.regionKey}`,
          quantidade: region.areaConsumoM2 ?? region.areaM2 ?? 0,
          custoTotal: region.custoEstimado ?? 0,
        })),
    ],
  });
}

async function obterAtor(req: Request) {
  const sessao = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  if (!sessao) return null;
  return {
    id: sessao.user.id,
    nome: sessao.user.name,
    role: String(sessao.user.role ?? ""),
  };
}

async function lerSnapshotPreco(req: Request, res: Response) {
  const parsed = z.object({ sourceId: z.string().min(1).max(80), snapshot: snapshotSchema }).strict().safeParse(req.body);
  if (!parsed.success) {
    respostaErro(res, 400, "Confira os dados de custo e composição antes de analisar o preço.");
    return null;
  }
  const erroCores = await validarMapeamentoCoresPersistido(parsed.data.sourceId, parsed.data.snapshot);
  if (erroCores) {
    respostaErro(res, 409, erroCores);
    return null;
  }
  return parsed.data;
}

async function validarMapeamentoCoresPersistido(
  sourceId: string,
  snapshot: z.infer<typeof snapshotSchema>,
): Promise<string | null> {
  const mapping = snapshot.mapeamentoCores;
  if (!mapping?.aprovado) return "Aprove o mapeamento de cores antes de analisar ou emitir esta cotação.";
  if (mapping.pendencias.length) return "Há custos de adesivo pendentes; preencha os valores e refaça o mapeamento.";
  const db = await getDb();
  if (!db) return "O banco de dados está indisponível para validar o mapeamento de cores.";
  const saved = await db.select().from(estudioMapeamentoCoresCotacao)
    .where(eq(estudioMapeamentoCoresCotacao.sourceId, sourceId));
  if (!saved.length || saved.length !== mapping.regioes.length || saved.some(row => !row.aprovado))
    return "O mapeamento enviado não corresponde a uma análise completa aprovada no servidor. Analise e aprove as cores novamente.";

  const byKey = new Map(mapping.regioes.map(region => [region.regionKey, region]));
  const stableJson = (value: unknown): string => JSON.stringify(value, (_key, child: unknown) => {
    if (child && typeof child === "object" && !Array.isArray(child))
      return Object.fromEntries(Object.entries(child as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
    return child;
  });
  let custoPersistido = 0;
  for (const row of saved) {
    const region = byKey.get(row.regionKey);
    const details = row.detalhesJson as Record<string, unknown>;
    if (!region
      || region.tipoCor !== row.tipoCor
      || region.corHex !== row.corHex
      || stableJson(region.corRgb) !== stableJson(row.corRgbJson ?? null)
      || region.pantoneCode !== row.pantoneCode
      || region.tipoSugestao !== row.tipoSugestao
      || region.chapaId !== row.chapaId
      || region.imprimaxAdesivoId !== row.imprimaxAdesivoId
      || region.deltaE00 !== (row.deltaE00 == null ? null : Number(row.deltaE00))
      || region.custoEstimado !== (row.custoEstimado == null ? null : Number(row.custoEstimado))
      || region.areaM2 !== (row.areaM2 == null ? null : Number(row.areaM2))
      || (region.areaLiquidaM2 ?? null) !== (details.areaLiquidaM2 ?? null)
      || (region.areaTotalM2 ?? null) !== (details.areaTotalM2 ?? null)
      || (region.areaConsumoM2 ?? null) !== (details.areaConsumoM2 ?? null)
      || stableJson(region.dadosPreco ?? null) !== stableJson(details.dadosPreco ?? null)
      || mapping.iluminacao !== row.modoIluminacao
      || stableJson(region.cmyk) !== stableJson(details.cmyk ?? null)
      || stableJson(region.coresGradiente) !== stableJson(details.coresGradiente ?? [])
      || stableJson(region.pathIndexes) !== stableJson(details.pathIndexes ?? [])
      || stableJson(region.avisos) !== stableJson(details.avisos ?? [])
      || stableJson(region.alternativas) !== stableJson(details.alternativas ?? [])
      || region.unidadeCusto !== (details.unidadeCusto ?? null)
      || stableJson(region.precificacao) !== stableJson(details.precificacao ?? null)) {
      return "Os dados de cor, área, material ou custo foram alterados depois da aprovação. Refazer a análise de cores.";
    }
    if (region.chapaMateriaPrimaId !== (details.chapaMateriaPrimaId ?? null)
      || region.chapaBaseId !== (details.chapaBaseId ?? null)
      || region.chapaBaseMateriaPrimaId !== (details.chapaBaseMateriaPrimaId ?? null)
      || region.requerChapaBase !== (details.requerChapaBase ?? false)
      || region.requerConfirmacaoConstrucao !== (details.requerConfirmacaoConstrucao ?? false)
      || stableJson(region.composicaoFace) !== stableJson(details.composicaoFace ?? null)) {
      return "A composição sugerida para a face foi alterada depois da análise. Refazer o mapeamento de cores.";
    }
    if (details.requerConfirmacaoConstrucao === true
      || (details.requerChapaBase === true && details.chapaBaseMateriaPrimaId == null)
      || (row.tipoSugestao === "chapa" && details.chapaMateriaPrimaId == null)) {
      return "Há uma pergunta de composição da face sem resposta. Resolva-a antes de emitir.";
    }
    const materialFaceEsperado = row.tipoSugestao === "chapa"
      ? details.chapaMateriaPrimaId
      : details.requerChapaBase === true ? details.chapaBaseMateriaPrimaId : null;
    if (typeof materialFaceEsperado === "number"
      && !snapshot.materiais.some(material => material.mubisysMateriaPrimaId === materialFaceEsperado)) {
      return "A chapa definida pela análise de cor não participa da composição da cotação. Reaplique a composição e refaça o nesting.";
    }
    if (region.tipoSugestao === "imprimax" || region.tipoSugestao === "impresso") {
      if (region.areaTotalM2 == null || region.areaTotalM2 <= 0
        || region.areaConsumoM2 == null || region.areaConsumoM2 <= 0
        || !region.dadosPreco || region.dadosPreco.areaTotalM2 == null || region.custoEstimado == null)
        return "Há adesivo sem geometria, consumo de bobina ou custo calculado. Refaça a análise de cores e confira a configuração da bobina.";
      custoPersistido += region.custoEstimado;
    }
  }
  if (Math.abs(custoPersistido - mapping.custoAdicional) > 0.0002)
    return "O custo adicional de cores não corresponde aos valores aprovados no servidor.";
  return null;
}

async function sugerirPreco(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  const ator = await obterAtor(req);
  if (!ator) { respostaErro(res, 401, "Entre no Radrasys para analisar o preço."); return; }
  const dados = await lerSnapshotPreco(req, res);
  if (!dados) return;
  try {
    const contexto = contextoPrecoSnapshot(dados.snapshot);
    const sugestao = await sugerirPrecoComGPT({
      fluxo: "cpq",
      base: basePrecoSnapshot(dados.sourceId, dados.snapshot),
      contexto,
      atorId: ator.id,
    });
    res.json({ ...sugestao, contexto });
  } catch (error) {
    respostaErro(res, 400, error instanceof Error ? error.message : "Não foi possível analisar o preço.");
  }
}

async function aprovarPreco(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  const ator = await obterAtor(req);
  if (!ator) { respostaErro(res, 401, "Entre no Radrasys para aprovar um preço."); return; }
  if (!["gestor", "admin", "master"].includes(ator.role)) {
    respostaErro(res, 403, "A aprovação de preços está disponível para Gestor, Admin ou Master.");
    return;
  }
  const parsed = z.object({
    sourceId: z.string().min(1).max(80),
    snapshot: snapshotSchema,
    origem: z.enum(["calculado", "gpt"]),
    precoAprovado: z.number().finite().nonnegative(),
    ticket: z.string().min(20).max(6000).nullable().default(null),
  }).strict().safeParse(req.body);
  if (!parsed.success) { respostaErro(res, 400, "Confira o preço e a configuração antes de aprovar."); return; }
  const erroCores = await validarMapeamentoCoresPersistido(parsed.data.sourceId, parsed.data.snapshot);
  if (erroCores) { respostaErro(res, 409, erroCores); return; }
  try {
    const { sourceId, snapshot } = parsed.data;
    const base = basePrecoSnapshot(sourceId, snapshot);
    const contexto = contextoPrecoSnapshot(snapshot);
    const aprovacao = parsed.data.origem === "gpt"
      ? parsed.data.ticket
        ? aprovarSugestaoPreco({ ticket: parsed.data.ticket, fluxo: "cpq", base, contexto, ator })
        : null
      : aprovarPrecoCalculado({ fluxo: "cpq", base, contexto, preco: parsed.data.precoAprovado, ator });
    if (!aprovacao) { respostaErro(res, 400, "A sugestão do GPT expirou. Faça a análise novamente."); return; }
    if (Math.abs(aprovacao.precoAprovado - parsed.data.precoAprovado) >= 0.005) {
      respostaErro(res, 400, "O preço não corresponde ao valor aprovado.");
      return;
    }
    res.json({ ...aprovacao, contexto });
  } catch (error) {
    respostaErro(res, 400, error instanceof Error ? error.message : "Não foi possível aprovar o preço.");
  }
}

async function criarCotacao(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  if (!(await exigirSessao(req, res))) return;
  const parsed = criarSchema.safeParse(req.body);
  if (!parsed.success) {
    respostaErro(res, 400, "Confira os dados do orçamento antes de concluir.");
    return;
  }
  const dadosRecebidos = parsed.data.snapshot;
  const erroCores = await validarMapeamentoCoresPersistido(parsed.data.sourceId, dadosRecebidos);
  if (erroCores) {
    respostaErro(res, 409, erroCores);
    return;
  }
  if (!dadosRecebidos.precificacaoIA?.recibo) {
    respostaErro(res, 400, "Aprovação humana obrigatória. Aprove o preço antes de gerar o link da cotação.");
    return;
  }
  let dadosComAprovacao: z.infer<typeof snapshotSchema>;
  try {
    const contexto = contextoPrecoSnapshot(dadosRecebidos);
    const auditoria = verificarAprovacaoPreco({
      recibo: dadosRecebidos.precificacaoIA.recibo,
      fluxo: "cpq",
      base: basePrecoSnapshot(parsed.data.sourceId, dadosRecebidos),
      contexto,
      preco: dadosRecebidos.precoFinal,
    });
    dadosComAprovacao = {
      ...dadosRecebidos,
      precificacaoIA: {
        recibo: dadosRecebidos.precificacaoIA.recibo,
        contexto,
        auditoria: {
          ...auditoria,
          assinaturaBase: hashBasePreco(basePrecoSnapshot(parsed.data.sourceId, dadosRecebidos)),
          assinaturaCotacao: assinaturaSnapshotCotacao(parsed.data.sourceId, dadosRecebidos),
        },
      },
    };
  } catch (error) {
    respostaErro(res, 400, error instanceof Error ? error.message : "A aprovação do preço não é válida.");
    return;
  }
  const db = await getDb();
  if (!db) {
    respostaErro(res, 503, "O banco de dados está indisponível. Tente novamente.");
    return;
  }

  const { sourceId } = parsed.data;
  const dados = dadosComAprovacao;
  const grupo = parsed.data.grupo ?? null;
  if (grupo) {
    const membros = (await carregarMembrosGrupo(db, grupo.id)).filter(m => m.snapshot.sourceId !== sourceId);
    if (membros.length >= MAX_DESENHOS_POR_COTACAO) {
      respostaErro(res, 409, `Uma cotação aceita no máximo ${MAX_DESENHOS_POR_COTACAO} desenhos.`);
      return;
    }
    if (membros.some(m => m.snapshot.grupo?.posicao === grupo.posicao)) {
      respostaErro(res, 409, "Já existe outro desenho nesta posição da cotação.");
      return;
    }
    const documento = (dados.cliente.cnpj ?? "").replace(/\D/g, "");
    if (membros.some(m => (m.snapshot.cliente.cnpj ?? "").replace(/\D/g, "") !== documento)) {
      respostaErro(res, 409, "Todos os desenhos da mesma cotação precisam ser do mesmo cliente.");
      return;
    }
  }
  const existentes = await db.select().from(propostas)
    .where(sql`left(${propostas.observacoes}, ${PREFIXO_ESTUDIO.length}) = ${PREFIXO_ESTUDIO}`);
  const existente = existentes.find((item) => lerSnapshot(item.observacoes)?.sourceId === sourceId);
  if (existente) {
    const snapshotAnterior = lerSnapshot(existente.observacoes);
    const assinaturaNova = dados.precificacaoIA?.auditoria?.assinaturaCotacao;
    const assinaturaAnterior = snapshotAnterior?.precificacaoIA?.auditoria?.assinaturaCotacao;
    const mesmaVersaoComercial = !!assinaturaNova && assinaturaNova === assinaturaAnterior
      && snapshotAnterior?.precoFinal === dados.precoFinal;
    const reacaoCliente = mesmaVersaoComercial ? snapshotAnterior?.reacaoCliente ?? null : null;
    const snapshot: Snapshot = {
      ...dados,
      sourceId,
      numeroCotacao: numeroCotacao(existente.id),
      reacaoCliente,
      grupo,
    };
    await db.update(propostas).set({
      tituloProposta: dados.tituloProposta || "",
      imagemReferenciaUrl: dados.imagemReferenciaUrl,
      imagemRedesenhadaUrl: dados.imagemRedesenhadaUrl,
      clienteNome: dados.cliente.razao || dados.cliente.fantasia || dados.modeloNome,
      clienteCnpj: dados.cliente.cnpj,
      vendedorNome: dados.vendedor,
      observacoes: gravarSnapshot(snapshot),
      ...(mesmaVersaoComercial ? {} : { status: "aberta" }),
      updatedAt: new Date(),
    }).where(eq(propostas.id, existente.id));
    res.json({ id: existente.id, numero: snapshot.numeroCotacao, token: existente.token });
    return;
  }

  const token = randomBytes(24).toString("base64url");
  const snapshotBase = {
    ...dados,
    sourceId,
    numeroCotacao: "",
    reacaoCliente: null,
    grupo,
  } satisfies Snapshot;
  const [inserida] = await db.insert(propostas).values({
    token,
    tituloProposta: dados.tituloProposta || "",
    imagemReferenciaUrl: dados.imagemReferenciaUrl,
    imagemRedesenhadaUrl: dados.imagemRedesenhadaUrl,
    clienteNome: dados.cliente.razao || dados.cliente.fantasia || dados.modeloNome,
    clienteCnpj: dados.cliente.cnpj,
    vendedorNome: dados.vendedor,
    observacoes: gravarSnapshot(snapshotBase),
    status: "aberta",
  }).returning({ id: propostas.id });
  const snapshot: Snapshot = { ...snapshotBase, numeroCotacao: numeroCotacao(inserida.id) };
  await db.update(propostas).set({ observacoes: gravarSnapshot(snapshot) }).where(eq(propostas.id, inserida.id));
  res.status(201).json({ id: inserida.id, numero: snapshot.numeroCotacao, token });
}

async function listarCotacoes(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  if (!(await exigirSessao(req, res))) return;
  const db = await getDb();
  if (!db) {
    respostaErro(res, 503, "O banco de dados está indisponível.");
    return;
  }
  const linhas = await db.select().from(propostas)
    .where(sql`left(${propostas.observacoes}, ${PREFIXO_ESTUDIO.length}) = ${PREFIXO_ESTUDIO}`)
    .orderBy(desc(propostas.createdAt));
  const inicio = typeof req.query.inicio === "string" ? Date.parse(`${req.query.inicio}T00:00:00`) : NaN;
  const fim = typeof req.query.fim === "string" ? Date.parse(`${req.query.fim}T23:59:59.999`) : NaN;
  const numero = typeof req.query.numero === "string" ? req.query.numero.trim().toLowerCase() : "";
  const vendedor = typeof req.query.vendedor === "string" ? req.query.vendedor.trim().toLowerCase() : "";
  const cotacoes = linhas.flatMap((linha) => {
    const snapshot = lerSnapshot(linha.observacoes);
    if (!snapshot) return [];
    const criadaEm = linha.createdAt.toISOString();
    const dataMs = linha.createdAt.getTime();
    if (Number.isFinite(inicio) && dataMs < inicio) return [];
    if (Number.isFinite(fim) && dataMs > fim) return [];
    if (numero && !snapshot.numeroCotacao.toLowerCase().includes(numero)) return [];
    if (vendedor && !snapshot.vendedor.toLowerCase().includes(vendedor)) return [];
    return [{
      id: linha.id,
      numero: snapshot.numeroCotacao,
      token: linha.token,
      criadaEm,
      clienteNome: linha.clienteNome,
      clienteCnpj: linha.clienteCnpj,
      clienteFantasia: snapshot.cliente.fantasia,
      clienteEndereco: snapshot.cliente.endereco,
      vendedor: snapshot.vendedor,
      modeloNome: snapshot.modeloNome,
      tituloProposta: snapshot.tituloProposta || linha.tituloProposta || "",
      imagemReferenciaUrl: snapshot.imagemReferenciaUrl || linha.imagemReferenciaUrl || null,
      imagemRedesenhadaUrl: snapshot.imagemRedesenhadaUrl || linha.imagemRedesenhadaUrl || null,
      mubisysProdutoId: snapshot.mubisysProdutoId ?? null,
      mubisysModeloId: snapshot.mubisysModeloId ?? null,
      variacoesModelo: snapshot.variacoesModelo ?? [],
      areaM2: snapshot.areaM2,
      areaGeralM2: snapshot.areaGeralM2,
      areaTotalNestingM2: snapshot.areaTotalNestingM2 ?? null,
      perimExtM: snapshot.perimExtM ?? null,
      perimTotalM: snapshot.perimTotalM ?? null,
      materiais: snapshot.materiais ?? [],
      precoFinal: snapshot.precoFinal,
      modalidadeFrete: snapshot.modalidadeFrete,
      metodoPagamento: snapshot.metodoPagamento,
      status: linha.status,
      reacaoCliente: snapshot.reacaoCliente,
      grupoId: snapshot.grupo?.id ?? null,
      grupoPosicao: snapshot.grupo?.posicao ?? null,
    }];
  });
  res.json({ cotacoes });
}

async function obterCotacaoPublica(req: Request, res: Response): Promise<void> {
  const token = typeof req.params.token === "string" ? req.params.token : "";
  const db = await getDb();
  if (!db) {
    respostaErro(res, 503, "Não foi possível carregar esta cotação agora.");
    return;
  }
  const [linha] = await db.select().from(propostas).where(eq(propostas.token, token)).limit(1);
  const snapshot = lerSnapshot(linha?.observacoes ?? null);
  if (!linha || !snapshot) {
    respostaErro(res, 404, "Cotação não encontrada ou link inválido.");
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(visaoPublica(linha, snapshot));
}

function visaoPublica(linha: typeof propostas.$inferSelect, snapshot: Snapshot) {
  return {
    numero: snapshot.numeroCotacao,
    tituloProposta: snapshot.tituloProposta || linha.tituloProposta || "",
    imagemReferenciaUrl: snapshot.imagemReferenciaUrl || linha.imagemReferenciaUrl || null,
    imagemRedesenhadaUrl: snapshot.imagemRedesenhadaUrl || linha.imagemRedesenhadaUrl || null,
    dataEmissao: snapshot.dataEmissao,
    validadeDias: snapshot.validadeDias,
    modalidadeFrete: snapshot.modalidadeFrete,
    metodoPagamento: snapshot.metodoPagamento,
    formasPagamentoPermitidas: snapshot.formasPagamentoPermitidas ?? ["pix", "cartao", "boleto", "ted"],
    jurosCartaoPct: snapshot.jurosCartaoPct ?? [0, 0, 0, 0, 0, 0],
    cliente: snapshot.cliente,
    vendedor: snapshot.vendedor,
    whatsappVendedor: snapshot.whatsappVendedor || null,
    modeloNome: snapshot.modeloNome,
    descricaoProduto: snapshot.descricaoProduto || "",
    variacoes: snapshot.variacoes || [],
    areaM2: snapshot.areaM2,
    areaGeralM2: snapshot.areaGeralM2,
    areaTotalNestingM2: snapshot.areaTotalNestingM2 ?? null,
    perimExtM: snapshot.perimExtM ?? null,
    perimTotalM: snapshot.perimTotalM ?? null,
    precoFinal: snapshot.precoFinal,
    prazoDiasUteis: snapshot.prazoDiasUteis,
    status: linha.status,
    reacaoCliente: snapshot.reacaoCliente,
  };
}

type MembroGrupo = { linha: typeof propostas.$inferSelect; snapshot: Snapshot };

/** Cotações do mesmo grupo (desenhos de uma mesma proposta), em ordem de posição. */
async function carregarMembrosGrupo(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, grupoId: string): Promise<MembroGrupo[]> {
  if (!GRUPO_ID_REGEX.test(grupoId)) return [];
  const linhas = await db.select().from(propostas)
    .where(sql`left(${propostas.observacoes}, ${PREFIXO_ESTUDIO.length}) = ${PREFIXO_ESTUDIO} and ${propostas.observacoes} like ${"%" + grupoId + "%"}`);
  return linhas
    .flatMap(linha => {
      const snapshot = lerSnapshot(linha.observacoes);
      return snapshot?.grupo?.id === grupoId ? [{ linha, snapshot }] : [];
    })
    .sort((a, b) => (a.snapshot.grupo?.posicao ?? 0) - (b.snapshot.grupo?.posicao ?? 0));
}

async function obterGrupoPublico(req: Request, res: Response): Promise<void> {
  const grupoId = typeof req.params.grupoId === "string" ? req.params.grupoId : "";
  const db = await getDb();
  if (!db) {
    respostaErro(res, 503, "Não foi possível carregar esta cotação agora.");
    return;
  }
  const membros = await carregarMembrosGrupo(db, grupoId);
  if (!membros.length) {
    respostaErro(res, 404, "Cotação não encontrada ou link inválido.");
    return;
  }
  const itens = membros.map(m => visaoPublica(m.linha, m.snapshot));
  const base = itens[0];
  const soma = (valores: Array<number | null | undefined>) => valores.reduce<number>((total, valor) => total + (valor ?? 0), 0);
  const todasResponderam = itens.every(item => item.reacaoCliente);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ...base,
    grupoId,
    numero: itens.map(item => item.numero).join(" + "),
    tituloProposta: itens.length > 1 ? `Proposta com ${itens.length} desenhos` : base.tituloProposta,
    modeloNome: itens.map(item => item.modeloNome).join(", "),
    imagemReferenciaUrl: null,
    imagemRedesenhadaUrl: null,
    descricaoProduto: "",
    variacoes: [],
    areaM2: soma(itens.map(item => item.areaM2)),
    areaGeralM2: soma(itens.map(item => item.areaGeralM2)),
    areaTotalNestingM2: null,
    perimExtM: null,
    perimTotalM: null,
    precoFinal: soma(itens.map(item => item.precoFinal)),
    prazoDiasUteis: itens.some(item => item.prazoDiasUteis != null)
      ? Math.max(...itens.map(item => item.prazoDiasUteis ?? 0)) : null,
    reacaoCliente: todasResponderam ? base.reacaoCliente : null,
    itens: itens.map(item => ({
      numero: item.numero,
      tituloProposta: item.tituloProposta,
      modeloNome: item.modeloNome,
      descricaoProduto: item.descricaoProduto,
      variacoes: item.variacoes,
      imagemReferenciaUrl: item.imagemReferenciaUrl,
      imagemRedesenhadaUrl: item.imagemRedesenhadaUrl,
      areaM2: item.areaM2,
      precoFinal: item.precoFinal,
      prazoDiasUteis: item.prazoDiasUteis,
    })),
  });
}

const respostaSchema = z.object({
  tipo: z.enum(reacooes),
  comentario: z.string().max(2000).default(""),
  formaPagamento: z.enum(["boleto", "cartao", "pix", "ted"]).default("pix"),
  parcelasCartao: z.number().int().min(1).max(6).nullable().default(null),
});

/** Uma resposta do cliente vale para todos os desenhos da proposta. */
async function registrarRespostaGrupo(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  const parsed = respostaSchema.safeParse(req.body);
  if (!parsed.success) {
    respostaErro(res, 400, "Escolha uma resposta válida para a cotação.");
    return;
  }
  const db = await getDb();
  if (!db) {
    respostaErro(res, 503, "Não foi possível registrar sua resposta agora.");
    return;
  }
  const grupoId = typeof req.params.grupoId === "string" ? req.params.grupoId : "";
  const membros = await carregarMembrosGrupo(db, grupoId);
  if (!membros.length) {
    respostaErro(res, 404, "Cotação não encontrada ou link inválido.");
    return;
  }
  const formasPermitidas = membros[0].snapshot.formasPagamentoPermitidas ?? ["pix", "cartao", "boleto", "ted"];
  if (!formasPermitidas.includes(parsed.data.formaPagamento)) {
    respostaErro(res, 400, "Esta forma de pagamento não está disponível para a cotação.");
    return;
  }
  const parcelasCartao = parsed.data.formaPagamento === "cartao" ? (parsed.data.parcelasCartao ?? 1) : null;
  const respondidoEm = new Date().toISOString();
  const status = parsed.data.tipo === "aprovado" ? "aceita" : parsed.data.tipo === "fora_orcamento" ? "recusada" : "aberta";
  let valorTotal = 0;
  await db.transaction(async tx => {
    for (const { linha, snapshot } of membros) {
      const taxaCartao = parcelasCartao ? (snapshot.jurosCartaoPct?.[parcelasCartao - 1] ?? 0) : 0;
      const valorPagamento = snapshot.precoFinal * (1 + taxaCartao / 100);
      valorTotal += valorPagamento;
      const atualizado: Snapshot = {
        ...snapshot,
        reacaoCliente: {
          tipo: parsed.data.tipo, comentario: parsed.data.comentario, formaPagamento: parsed.data.formaPagamento,
          parcelasCartao, valorPagamento, respondidoEm,
        },
      };
      await tx.update(propostas).set({ observacoes: gravarSnapshot(atualizado), status, updatedAt: new Date() })
        .where(eq(propostas.id, linha.id));
    }
  });
  res.json({
    success: true,
    reacaoCliente: {
      tipo: parsed.data.tipo, comentario: parsed.data.comentario, formaPagamento: parsed.data.formaPagamento,
      parcelasCartao, valorPagamento: valorTotal, respondidoEm,
    },
  });
}

async function registrarResposta(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  const parsed = z.object({
    tipo: z.enum(reacooes),
    comentario: z.string().max(2000).default(""),
    formaPagamento: z.enum(["boleto", "cartao", "pix", "ted"]).default("pix"),
    parcelasCartao: z.number().int().min(1).max(6).nullable().default(null),
  }).safeParse(req.body);
  if (!parsed.success) {
    respostaErro(res, 400, "Escolha uma resposta válida para a cotação.");
    return;
  }
  const db = await getDb();
  if (!db) {
    respostaErro(res, 503, "Não foi possível registrar sua resposta agora.");
    return;
  }
  const token = typeof req.params.token === "string" ? req.params.token : "";
  const [linha] = await db.select().from(propostas).where(eq(propostas.token, token)).limit(1);
  const snapshot = lerSnapshot(linha?.observacoes ?? null);
  if (!linha || !snapshot) {
    respostaErro(res, 404, "Cotação não encontrada ou link inválido.");
    return;
  }
  const formasPermitidas = snapshot.formasPagamentoPermitidas ?? ["pix", "cartao", "boleto", "ted"];
  if (!formasPermitidas.includes(parsed.data.formaPagamento)) {
    respostaErro(res, 400, "Esta forma de pagamento não está disponível para a cotação.");
    return;
  }
  const parcelasCartao = parsed.data.formaPagamento === "cartao" ? (parsed.data.parcelasCartao ?? 1) : null;
  const taxaCartao = parcelasCartao ? (snapshot.jurosCartaoPct?.[parcelasCartao - 1] ?? 0) : 0;
  const valorPagamento = snapshot.precoFinal * (1 + taxaCartao / 100);
  const atualizado: Snapshot = {
    ...snapshot,
    reacaoCliente: {
      tipo: parsed.data.tipo,
      comentario: parsed.data.comentario,
      formaPagamento: parsed.data.formaPagamento,
      parcelasCartao,
      valorPagamento,
      respondidoEm: new Date().toISOString(),
    },
  };
  const status = parsed.data.tipo === "aprovado" ? "aceita" : parsed.data.tipo === "fora_orcamento" ? "recusada" : "aberta";
  await db.update(propostas).set({ observacoes: gravarSnapshot(atualizado), status, updatedAt: new Date() })
    .where(eq(propostas.id, linha.id));
  res.json({ success: true, reacaoCliente: atualizado.reacaoCliente });
}
