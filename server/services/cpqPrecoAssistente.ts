import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ENV } from "../_core/env";
import { invokeLLM } from "../_core/llm";

export const precoContextoSchema = z.object({
  produto: z.string().min(1).max(256),
  custoDireto: z.number().finite().nonnegative(),
  // Em Propostas, custoDireto é material + mão de obra; o piso bruto inclui
  // também as taxas sobre a venda. O CPQ legado não informa estes campos.
  precoMinimo: z.number().finite().nonnegative().optional(),
  taxasSobreVendaPct: z.number().finite().min(0).max(100).optional(),
  precoAtual: z.number().finite().nonnegative(),
  regra: z.string().min(1).max(500),
  margemAtualPct: z.number().finite().min(-1000).max(1000).nullable(),
  itens: z.array(z.object({
    nome: z.string().min(1).max(256),
    quantidade: z.number().finite().nonnegative(),
    custoTotal: z.number().finite().nonnegative(),
  }).strict()).max(300),
}).strict();

export type PrecoContexto = z.infer<typeof precoContextoSchema>;
export type FluxoPreco = "cpq" | "propostas";

type AtorAprovador = { id: string; nome: string; role: string };
type TicketSugestao = {
  v: 1;
  tipo: "sugestao";
  fluxo: FluxoPreco;
  atorId: string;
  baseHash: string;
  contextoHash: string;
  sugestaoId: string;
  precoSugerido: number;
  margemSugeridaPct: number | null;
  parecer: string;
  alertas: string[];
  exp: number;
};
type ReciboAprovacao = {
  v: 1;
  tipo: "aprovacao";
  fluxo: FluxoPreco;
  baseHash: string;
  contextoHash: string;
  precoAprovado: number;
  origem: "gpt" | "calculado";
  sugestaoId: string | null;
  parecer: string | null;
  alertas: string[];
  sugeridoPorId: string | null;
  aprovadoPor: AtorAprovador;
  aprovadoEm: string;
  exp: number;
};

export type ResultadoSugestaoPreco = {
  ticket: string;
  sugestaoId: string;
  precoSugerido: number;
  margemSugeridaPct: number | null;
  parecer: string;
  alertas: string[];
};

export type ResultadoAprovacaoPreco = Omit<ReciboAprovacao, "v" | "tipo" | "fluxo" | "baseHash" | "contextoHash" | "exp"> & {
  recibo: string;
};

const schemaResposta = {
  type: "object",
  additionalProperties: false,
  properties: {
    precoSugerido: { type: "number" },
    parecer: { type: "string" },
    alertas: { type: "array", items: { type: "string" } },
  },
  required: ["precoSugerido", "parecer", "alertas"],
} as const;

function serializarEstavel(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(serializarEstavel).join(",")}]`;
  const registro = value as Record<string, unknown>;
  return `{${Object.keys(registro).sort().map((chave) => `${JSON.stringify(chave)}:${serializarEstavel(registro[chave])}`).join(",")}}`;
}

export function hashBasePreco(base: unknown): string {
  return createHash("sha256").update(serializarEstavel(base)).digest("hex");
}

function chaveAssinatura(): string {
  if (!ENV.cookieSecret) throw new Error("Configure JWT_SECRET para habilitar aprovação segura de preços.");
  return ENV.cookieSecret;
}

function assinar(payload: Record<string, unknown>): string {
  const corpo = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const assinatura = createHmac("sha256", chaveAssinatura()).update(corpo).digest("base64url");
  return `${corpo}.${assinatura}`;
}

function lerToken<T extends { exp: number }>(token: string): T {
  const [corpo, assinatura, ...resto] = token.split(".");
  if (!corpo || !assinatura || resto.length) throw new Error("A aprovação de preço está inválida. Gere uma nova sugestão.");
  const esperada = createHmac("sha256", chaveAssinatura()).update(corpo).digest();
  let recebida: Buffer;
  try {
    recebida = Buffer.from(assinatura, "base64url");
  } catch {
    throw new Error("A aprovação de preço está inválida. Gere uma nova sugestão.");
  }
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) {
    throw new Error("A aprovação de preço está inválida. Gere uma nova sugestão.");
  }
  let payload: T;
  try {
    payload = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as T;
  } catch {
    throw new Error("A aprovação de preço está inválida. Gere uma nova sugestão.");
  }
  if (payload.exp <= Date.now()) throw new Error("A aprovação de preço expirou. Faça a análise novamente.");
  return payload;
}

function margemPercentual(preco: number, contexto: PrecoContexto): number | null {
  if (preco <= 0) return null;
  return ((preco - contexto.custoDireto - preco * (contexto.taxasSobreVendaPct ?? 0) / 100) / preco) * 100;
}

export async function sugerirPrecoComGPT(args: {
  fluxo: FluxoPreco;
  base: unknown;
  contexto: PrecoContexto;
  atorId: string;
}): Promise<ResultadoSugestaoPreco> {
  const contexto = precoContextoSchema.parse(args.contexto);
  if (contexto.custoDireto <= 0) throw new Error("O custo direto está zerado. Revise custos e composição antes de gerar preço automático.");
  const response = await invokeLLM({
    model: "gpt-5-mini",
    maxCompletionTokens: 1200,
    reasoningEffort: "low",
    messages: [
      {
        role: "system",
        content: [
          "Você é um consultor de precificação B2B para fabricação de letreiros.",
          "Analise somente os dados numéricos e a regra informados; não invente custo, imposto, concorrente ou dado de mercado.",
          "Sugira um preço unitário em reais que preserve pelo menos o preço mínimo bruto informado, quando presente; caso contrário preserve o custo direto.",
          "Use o preço atual e a regra como referência. Explique as premissas e sinalize riscos ou dados insuficientes.",
          "A sugestão não é uma aprovação e nunca deve ser tratada como preço final sem aprovação humana.",
        ].join(" "),
      },
      { role: "user", content: JSON.stringify(contexto) },
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: { name: "sugestao_preco_cpq", strict: true, schema: schemaResposta },
    },
  });
  const raw = response.choices[0]?.message.content;
  if (typeof raw !== "string") throw new Error("O consultor de preço não retornou uma sugestão legível.");
  let sugestao: { precoSugerido: number; parecer: string; alertas: string[] };
  try {
    sugestao = z.object({
      precoSugerido: z.number().finite().positive(),
      parecer: z.string().min(1).max(3000),
      alertas: z.array(z.string().min(1).max(500)).max(12),
    }).strict().parse(JSON.parse(raw));
  } catch {
    throw new Error("A resposta do consultor de preço veio fora do formato esperado.");
  }
  if (sugestao.precoSugerido + 0.005 < (contexto.precoMinimo ?? contexto.custoDireto)) {
    throw new Error("A sugestão ficou abaixo do preço mínimo e não pode ser aprovada como preço automático.");
  }
  const ticket: TicketSugestao = {
    v: 1,
    tipo: "sugestao",
    fluxo: args.fluxo,
    atorId: args.atorId,
    baseHash: hashBasePreco(args.base),
    contextoHash: hashBasePreco(contexto),
    sugestaoId: randomUUID(),
    precoSugerido: Math.round((sugestao.precoSugerido + Number.EPSILON) * 100) / 100,
    margemSugeridaPct: margemPercentual(Math.round((sugestao.precoSugerido + Number.EPSILON) * 100) / 100, contexto),
    parecer: sugestao.parecer,
    alertas: sugestao.alertas,
    exp: Date.now() + 20 * 60 * 1000,
  };
  return {
    ticket: assinar(ticket),
    sugestaoId: ticket.sugestaoId,
    precoSugerido: ticket.precoSugerido,
    margemSugeridaPct: ticket.margemSugeridaPct,
    parecer: ticket.parecer,
    alertas: ticket.alertas,
  };
}

export function aprovarSugestaoPreco(args: {
  ticket: string;
  fluxo: FluxoPreco;
  base: unknown;
  contexto: PrecoContexto;
  ator: AtorAprovador;
}): ResultadoAprovacaoPreco {
  const ticket = lerToken<TicketSugestao>(args.ticket);
  const contexto = precoContextoSchema.parse(args.contexto);
  if (ticket.v !== 1 || ticket.tipo !== "sugestao" || ticket.fluxo !== args.fluxo
    || ticket.baseHash !== hashBasePreco(args.base) || ticket.contextoHash !== hashBasePreco(contexto)) {
    throw new Error("Os dados do preço mudaram depois da análise. Gere uma nova sugestão.");
  }
  return emitirRecibo({
    fluxo: args.fluxo,
    baseHash: ticket.baseHash,
    contextoHash: ticket.contextoHash,
    preco: ticket.precoSugerido,
    origem: "gpt",
    sugeridoPorId: ticket.atorId,
    sugestaoId: ticket.sugestaoId,
    parecer: ticket.parecer,
    alertas: ticket.alertas,
    ator: args.ator,
  });
}

export function aprovarPrecoCalculado(args: {
  fluxo: FluxoPreco;
  base: unknown;
  contexto: PrecoContexto;
  preco: number;
  ator: AtorAprovador;
  justificativaExcecao?: string;
}): ResultadoAprovacaoPreco {
  const contexto = precoContextoSchema.parse(args.contexto);
  const preco = z.number().finite().nonnegative().parse(args.preco);
  if (contexto.custoDireto <= 0) throw new Error("O custo direto está zerado. Revise custos e composição antes da aprovação.");
  const precoMinimo = contexto.precoMinimo ?? contexto.custoDireto;
  const estaAbaixoDoPiso = preco + 0.005 < precoMinimo;
  const justificativa = args.justificativaExcecao?.trim();
  if (estaAbaixoDoPiso && !justificativa) {
    throw new Error("O preço está abaixo do preço mínimo. Corrija-o ou solicite aprovação por alçada de exceção.");
  }
  if (justificativa && (!estaAbaixoDoPiso || args.fluxo !== "propostas")) {
    throw new Error("A justificativa de exceção só pode ser usada para preço abaixo do piso em propostas.");
  }
  if (justificativa && (justificativa.length < 10 || !["gestor", "admin", "master"].includes(args.ator.role))) {
    throw new Error("A exceção exige justificativa válida e aprovação por gestor, admin ou master.");
  }
  return emitirRecibo({
    fluxo: args.fluxo,
    baseHash: hashBasePreco(args.base),
    contextoHash: hashBasePreco(contexto),
    preco,
    origem: "calculado",
    sugeridoPorId: null,
    sugestaoId: null,
    parecer: justificativa ? `Exceção autorizada por alçada superior: ${justificativa}` : null,
    alertas: justificativa ? ["PRECO_ABAIXO_DO_PISO"] : [],
    ator: args.ator,
  });
}

function emitirRecibo(args: {
  fluxo: FluxoPreco;
  baseHash: string;
  contextoHash: string;
  preco: number;
  origem: "gpt" | "calculado";
  sugeridoPorId: string | null;
  sugestaoId: string | null;
  parecer: string | null;
  alertas: string[];
  ator: AtorAprovador;
}): ResultadoAprovacaoPreco {
  const reciboPayload: ReciboAprovacao = {
    v: 1,
    tipo: "aprovacao",
    fluxo: args.fluxo,
    baseHash: args.baseHash,
    contextoHash: args.contextoHash,
    precoAprovado: Math.round((args.preco + Number.EPSILON) * 100) / 100,
    origem: args.origem,
    sugeridoPorId: args.sugeridoPorId,
    sugestaoId: args.sugestaoId,
    parecer: args.parecer,
    alertas: args.alertas,
    aprovadoPor: args.ator,
    aprovadoEm: new Date().toISOString(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const { v: _v, tipo: _tipo, fluxo: _fluxo, baseHash: _baseHash, contextoHash: _contextoHash, exp: _exp, ...publico } = reciboPayload;
  return { ...publico, recibo: assinar(reciboPayload) };
}

export function verificarAprovacaoPreco(args: {
  recibo: string;
  fluxo: FluxoPreco;
  base: unknown;
  contexto: PrecoContexto;
  preco: number;
}): Omit<ReciboAprovacao, "v" | "tipo" | "fluxo" | "baseHash" | "contextoHash" | "exp"> {
  const recibo = lerToken<ReciboAprovacao>(args.recibo);
  const contexto = precoContextoSchema.parse(args.contexto);
  if (recibo.v !== 1 || recibo.tipo !== "aprovacao" || recibo.fluxo !== args.fluxo
    || recibo.baseHash !== hashBasePreco(args.base) || recibo.contextoHash !== hashBasePreco(contexto)
    || Math.abs(recibo.precoAprovado - args.preco) >= 0.005) {
    throw new Error("A aprovação não corresponde ao preço ou à configuração atual. Aprove o preço novamente.");
  }
  const { v: _v, tipo: _tipo, fluxo: _fluxo, baseHash: _baseHash, contextoHash: _contextoHash, exp: _exp, ...publico } = recibo;
  return publico;
}
