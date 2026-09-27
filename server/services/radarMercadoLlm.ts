/**
 * Extração estruturada de sinais de mercado (Radar de Mercado) com fallback entre
 * provedores — mesmo princípio do Consultor da Meta (server/services/consultorLlm.ts):
 * tenta Gemini → Claude → OpenAI, na ordem dos que tiverem chave configurada, e cai
 * para o próximo quando um falha (sem crédito, limite gratuito, chave ausente...).
 *
 * Diferente do Consultor da Meta (conversa em texto livre), aqui a resposta precisa
 * ser um JSON estruturado fixo. Em vez de reimplementar formatos nativos de saída
 * estruturada por provedor (json_schema da OpenAI, responseSchema do Gemini, tool
 * use do Claude — cada um com regras diferentes), o prompt pede JSON puro nos três
 * casos e o parse é único; mais simples de manter, ao custo de não ter validação
 * forte de schema nos provedores que não são a OpenAI.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "../_core/env";
import { invokeLLM } from "../_core/llm";
import { extrairTextoClaude } from "./iaEconomia";
import { provedoresDisponiveis, motivoAmigavel, ErroIA, type Provedor } from "./consultorLlm";

export interface ItemBuscaMercado {
  title: string;
  snippet: string;
  link: string;
  displayLink: string;
}

export type TipoEventoMercado = "inauguracao" | "reforma" | "expansao" | "edital" | "concorrente" | "outro" | null;

export interface SinalExtraido {
  relevante: boolean;
  empresa: string | null;
  uf: string | null;
  municipio: string | null;
  tipoEvento: TipoEventoMercado;
  relacaoProdutos: string | null;
  nivelConfianca: "confirmado" | "inferencia";
}

const SYSTEM_PROMPT = `Você extrai sinais comerciais de resultados de busca para uma fábrica de letras/letreiros/fachadas que vende por terceirização para gráficas e empresas de comunicação visual, nas regiões Centro-Oeste, Sudeste e Sul do Brasil. Analise o título e trecho fornecidos. Marque relevante=false se não tiver relação plausível com esse contexto (ex: notícia genérica sem relação, empresa de outro ramo, fora das regiões-alvo quando identificável). Nunca invente dados que não estejam no texto — campos desconhecidos ficam null. nivelConfianca="confirmado" só se o trecho afirma o fato diretamente (não inferência sua); senão "inferencia".

Responda APENAS com um JSON válido (sem markdown, sem texto antes ou depois), exatamente neste formato:
{"relevante": boolean, "empresa": string ou null, "uf": string ou null, "municipio": string ou null, "tipoEvento": "inauguracao" ou "reforma" ou "expansao" ou "edital" ou "concorrente" ou "outro" ou null, "relacaoProdutos": string ou null, "nivelConfianca": "confirmado" ou "inferencia"}`;

const montarPergunta = (item: ItemBuscaMercado, termo: string) =>
  `Título: ${item.title}\nTrecho: ${item.snippet}\nURL: ${item.link}\nSite: ${item.displayLink}\nTermo de busca que trouxe este resultado: ${termo}`;

const TIPOS_EVENTO = ["inauguracao", "reforma", "expansao", "edital", "concorrente", "outro"];

function normalizarSinal(bruto: unknown): SinalExtraido {
  const obj = (bruto ?? {}) as Record<string, unknown>;
  const tipoEvento = typeof obj.tipoEvento === "string" && TIPOS_EVENTO.includes(obj.tipoEvento)
    ? (obj.tipoEvento as TipoEventoMercado)
    : null;
  return {
    relevante: obj.relevante === true,
    empresa: typeof obj.empresa === "string" ? obj.empresa : null,
    uf: typeof obj.uf === "string" ? obj.uf : null,
    municipio: typeof obj.municipio === "string" ? obj.municipio : null,
    tipoEvento,
    relacaoProdutos: typeof obj.relacaoProdutos === "string" ? obj.relacaoProdutos : null,
    nivelConfianca: obj.nivelConfianca === "confirmado" ? "confirmado" : "inferencia",
  };
}

/** Remove eventual cerca de código (```json ... ```) que algum provedor decida usar mesmo pedindo JSON puro. */
function extrairJson(texto: string): SinalExtraido {
  const limpo = texto.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  return normalizarSinal(JSON.parse(limpo));
}

async function chamarGemini(item: ItemBuscaMercado, termo: string): Promise<SinalExtraido> {
  const modelo = ENV.geminiModel;
  const resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": ENV.geminiApiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: montarPergunta(item, termo) }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 500, temperature: 0.2 },
    }),
  });
  if (!resposta.ok) throw new Error(`Gemini ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
  const json = (await resposta.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const texto = (json.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? "").join("").trim();
  if (!texto) throw new Error("Gemini não retornou texto");
  return extrairJson(texto);
}

async function chamarClaude(item: ItemBuscaMercado, termo: string): Promise<SinalExtraido> {
  const client = new Anthropic({ apiKey: ENV.anthropicApiKey });
  const r = await client.messages.create({
    model: ENV.consultorModeloAnthropic,
    max_tokens: 500,
    thinking: { type: "disabled" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: montarPergunta(item, termo) }],
  });
  return extrairJson(extrairTextoClaude(r));
}

async function chamarOpenAI(item: ItemBuscaMercado, termo: string): Promise<SinalExtraido> {
  const resp = await invokeLLM({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: montarPergunta(item, termo) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "sinal_mercado",
        strict: true,
        schema: {
          type: "object",
          properties: {
            relevante: { type: "boolean" },
            empresa: { type: ["string", "null"] },
            uf: { type: ["string", "null"] },
            municipio: { type: ["string", "null"] },
            tipoEvento: { type: ["string", "null"], enum: [...TIPOS_EVENTO, null] },
            relacaoProdutos: { type: ["string", "null"] },
            nivelConfianca: { type: "string", enum: ["confirmado", "inferencia"] },
          },
          required: ["relevante", "empresa", "uf", "municipio", "tipoEvento", "relacaoProdutos", "nivelConfianca"],
          additionalProperties: false,
        },
      },
    },
  });
  const conteudo = resp.choices?.[0]?.message?.content;
  const texto = typeof conteudo === "string" ? conteudo : "";
  if (!texto) throw new Error("OpenAI não retornou texto");
  return extrairJson(texto);
}

const CHAMADAS: Record<Provedor, (item: ItemBuscaMercado, termo: string) => Promise<SinalExtraido>> = {
  gemini: chamarGemini,
  anthropic: chamarClaude,
  openai: chamarOpenAI,
};

/** Tenta extrair o sinal com cada provedor configurado, na ordem de provedoresDisponiveis(),
 * até um dar certo. Lança ErroIA se nenhum estiver configurado ou todos falharem. */
export async function extrairSinalMercado(item: ItemBuscaMercado, termo: string): Promise<SinalExtraido> {
  const provedores = provedoresDisponiveis();
  if (provedores.length === 0) {
    throw new ErroIA("SEM_PROVEDOR", "Nenhuma chave de IA configurada no servidor (GEMINI_API_KEY, ANTHROPIC_API_KEY ou OPENAI_API_KEY).");
  }
  const falhas: string[] = [];
  for (const provedor of provedores) {
    try {
      return await CHAMADAS[provedor](item, termo);
    } catch (erro) {
      falhas.push(motivoAmigavel(provedor, erro));
    }
  }
  throw new ErroIA("TODOS_FALHARAM", `Não consegui extrair (${falhas.join("; ")}).`, falhas);
}
