/**
 * Camada de IA do Consultor da Meta: fala com mais de um provedor e cai para o
 * próximo quando um falha (sem crédito, limite gratuito, chave ausente...).
 *
 * Ordem padrão: Gemini (tem plano gratuito) → Claude → OpenAI, cada um só se a
 * chave estiver configurada no servidor. CONSULTOR_IA_PROVEDOR força um só.
 *
 * A lógica de escolha/queda (`conversarComFallback`) é pura e testável; as
 * chamadas reais ficam em `chamadasReais`.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "../_core/env";
import { invokeLLM } from "../_core/llm";
import { extrairTextoResposta, MODELO_CONSULTOR_META, type MensagemConsultor } from "./consultorMeta";

export type Provedor = "gemini" | "anthropic" | "openai";

export const NOME_PROVEDOR: Record<Provedor, string> = { gemini: "Gemini", anthropic: "Claude", openai: "OpenAI" };

export interface PedidoIA {
  /** Prompt do consultor + contexto com os números (parte estável, cacheável). */
  system: string;
  historico: MensagemConsultor[];
  pergunta: string;
}

export interface RespostaIA {
  texto: string;
  provedor: Provedor;
  modelo: string;
  uso?: unknown;
}

export type ChamadaIA = (pedido: PedidoIA) => Promise<RespostaIA>;

export class ErroIA extends Error {
  constructor(public codigo: "SEM_PROVEDOR" | "TODOS_FALHARAM", mensagem: string, public falhas: string[] = []) {
    super(mensagem);
  }
}

/** Provedores com chave configurada, na ordem de tentativa. */
export function provedoresDisponiveis(): Provedor[] {
  const tem: Record<Provedor, boolean> = { gemini: !!ENV.geminiApiKey, anthropic: !!ENV.anthropicApiKey, openai: !!ENV.openaiApiKey };
  const forcado = ENV.consultorProvedor as Provedor | "";
  const ordem: Provedor[] = forcado && forcado in tem ? [forcado] : ["gemini", "anthropic", "openai"];
  return ordem.filter(p => tem[p]);
}

/** Motivo curto, em português, para mostrar ao usuário sem vazar detalhes técnicos ou segredos. */
export function motivoAmigavel(provedor: Provedor, erro: unknown): string {
  const texto = String((erro as Error)?.message ?? erro);
  const nome = NOME_PROVEDOR[provedor];
  if (/insufficient_quota|credit|billing|balance/i.test(texto)) return `${nome}: sem créditos`;
  if (/429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(texto)) return `${nome}: limite de uso atingido`;
  if (/401|403|api.?key|permission|unauthorized|API_KEY_INVALID/i.test(texto)) return `${nome}: chave inválida ou sem permissão`;
  if (/404|not.?found|model/i.test(texto)) return `${nome}: modelo indisponível`;
  return `${nome}: erro na chamada`;
}

export async function conversarComFallback(
  pedido: PedidoIA,
  provedores: Provedor[],
  chamadas: Record<Provedor, ChamadaIA>,
  aoFalhar?: (provedor: Provedor, erro: unknown) => void,
): Promise<RespostaIA> {
  if (provedores.length === 0) {
    throw new ErroIA("SEM_PROVEDOR", "O consultor de IA ainda não está configurado: falta uma chave de IA no servidor (GEMINI_API_KEY — gratuita —, ANTHROPIC_API_KEY ou OPENAI_API_KEY).");
  }
  const falhas: string[] = [];
  for (const provedor of provedores) {
    try {
      return await chamadas[provedor](pedido);
    } catch (erro) {
      aoFalhar?.(provedor, erro);
      falhas.push(motivoAmigavel(provedor, erro));
    }
  }
  throw new ErroIA("TODOS_FALHARAM", `Não consegui falar com a IA agora (${falhas.join("; ")}).`, falhas);
}

// ─── Chamadas reais ──────────────────────────────────────────────────────────

const MAX_TOKENS_RESPOSTA = 2500;

async function chamarGemini(p: PedidoIA): Promise<RespostaIA> {
  const modelo = ENV.geminiModel;
  const resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": ENV.geminiApiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: p.system }] },
      contents: [
        ...p.historico.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.texto }] })),
        { role: "user", parts: [{ text: p.pergunta }] },
      ],
      generationConfig: { maxOutputTokens: 4000, temperature: 0.4 },
    }),
  });
  if (!resposta.ok) throw new Error(`Gemini ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
  const json = (await resposta.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: unknown };
  const texto = (json.candidates?.[0]?.content?.parts ?? []).map(x => x.text ?? "").join("").trim();
  if (!texto) throw new Error("Gemini não retornou texto");
  return { texto, provedor: "gemini", modelo, uso: json.usageMetadata };
}

async function chamarClaude(p: PedidoIA): Promise<RespostaIA> {
  const client = new Anthropic({ apiKey: ENV.anthropicApiKey });
  const modelo = ENV.consultorModeloAnthropic;
  const r = await client.messages.create({
    model: modelo,
    max_tokens: MAX_TOKENS_RESPOSTA,
    system: [{ type: "text", text: p.system, cache_control: { type: "ephemeral" } }],
    messages: [
      ...p.historico.map((m): Anthropic.MessageParam => ({ role: m.role, content: m.texto })),
      { role: "user", content: p.pergunta },
    ],
  });
  const bloco = r.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  const texto = bloco?.text.trim() ?? "";
  if (!texto) throw new Error("Claude não retornou texto");
  return { texto, provedor: "anthropic", modelo, uso: r.usage };
}

async function chamarOpenAI(p: PedidoIA): Promise<RespostaIA> {
  const r = await invokeLLM({
    model: MODELO_CONSULTOR_META,
    reasoningEffort: "low",
    maxCompletionTokens: 3500,
    messages: [
      { role: "system", content: p.system },
      ...p.historico.map(m => ({ role: m.role, content: m.texto })),
      { role: "user" as const, content: p.pergunta },
    ],
  });
  const texto = extrairTextoResposta(r);
  if (!texto) throw new Error("OpenAI não retornou texto");
  return { texto, provedor: "openai", modelo: r.model, uso: r.usage };
}

export const chamadasReais: Record<Provedor, ChamadaIA> = { gemini: chamarGemini, anthropic: chamarClaude, openai: chamarOpenAI };

export function conversarComIA(pedido: PedidoIA, aoFalhar?: (provedor: Provedor, erro: unknown) => void): Promise<RespostaIA> {
  return conversarComFallback(pedido, provedoresDisponiveis(), chamadasReais, aoFalhar);
}
