/**
 * Cliente do Google Gemini (SDK oficial `@google/generative-ai`), usado exclusivamente pela qualificação
 * semântica de respostas de Campanhas WhatsApp (server/services/campanhasWhatsappIa.ts).
 *
 * Decisão de escopo (17/10/2026): este é o único ponto do repo que chama o SDK do Gemini para texto
 * estruturado. O restante do app usa OpenAI (server/_core/llm.ts) — ver AGENTS.md, "O que é este projeto":
 * a sprint de saída do Forge removeu a dependência do Gemini deliberadamente. Esta integração foi pedida
 * explicitamente pelo usuário (17/10/2026) especificamente para este módulo; não generalizar para outras
 * features sem decisão equivalente. `GEMINI_API_KEY`/`GEMINI_MODEL` já existiam em server/_core/env.ts para
 * o Consultor da Meta (server/services/consultorLlm.ts, que chama a API via fetch puro, sem este SDK) — aqui
 * reaproveitamos a mesma chave, mas com um cliente próprio porque Structured Output (responseSchema) do SDK
 * é mais direto que montar o JSON Schema na mão em cada chamada fetch.
 */

import {
  GoogleGenerativeAI,
  SchemaType,
  type Schema,
} from "@google/generative-ai";
import { ENV } from "../_core/env";

export function geminiConfigurado(): boolean {
  return !!ENV.geminiApiKey;
}

export class ErroGemini extends Error {
  constructor(
    message: string,
    public causa?: unknown
  ) {
    super(message);
  }
}

let cliente: GoogleGenerativeAI | null = null;
function obterCliente(): GoogleGenerativeAI {
  if (!ENV.geminiApiKey)
    throw new ErroGemini("GEMINI_API_KEY não configurada no servidor.");
  if (!cliente) cliente = new GoogleGenerativeAI(ENV.geminiApiKey);
  return cliente;
}

export interface ChamadaGeminiJsonParams {
  systemInstruction: string;
  prompt: string;
  responseSchema: Schema;
  /** Sobrescreve ENV.geminiModel (ex.: para testes). */
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Chama o Gemini pedindo Structured Output (JSON Schema) e devolve o objeto já parseado. Lança `ErroGemini`
 * em qualquer falha (rede, chave ausente, resposta vazia ou JSON inválido) — o chamador decide o fallback.
 *
 * **`thinkingConfig: { thinkingBudget: 0 }` é obrigatório aqui** (achado em teste real com a API, 17/10/2026):
 * sem ele, `gemini-2.5-flash` gasta tokens de "pensamento" invisível (`thoughtsTokenCount` na resposta, não
 * contado em `maxOutputTokens` de forma previsível) antes de escrever o JSON — num teste real isso consumiu
 * 981 dos 1024 tokens do teto, cortando a resposta no meio (`finishReason: "MAX_TOKENS"`, JSON truncado e
 * inválido) em metade das chamadas de um schema de 9 campos. Mesmo problema documentado para o Claude em
 * `server/services/consultorLlm.ts` (`thinking: { type: "disabled" }`), causa diferente (orçamento de
 * tokens, não de tempo). O SDK `@google/generative-ai` 0.24.1 não tipa `thinkingConfig` em
 * `GenerationConfig` (API mais nova que o SDK) — por isso o cast; `as GenerationConfig` sozinho não bastaria,
 * o campo seria descartado silenciosamente sem o `as unknown as` por cima.
 */
export async function chamarGeminiJson<T = unknown>(
  params: ChamadaGeminiJsonParams
): Promise<T> {
  const modelo = params.model ?? ENV.geminiModel;
  try {
    const model = obterCliente().getGenerativeModel({
      model: modelo,
      systemInstruction: params.systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: params.responseSchema,
        temperature: params.temperature ?? 0.2,
        maxOutputTokens: params.maxOutputTokens ?? 1024,
        thinkingConfig: { thinkingBudget: 0 },
      } as unknown as import("@google/generative-ai").GenerationConfig,
    });
    const resultado = await model.generateContent(params.prompt);
    const texto = resultado.response.text();
    if (!texto?.trim()) throw new ErroGemini("Gemini não retornou texto.");
    try {
      return JSON.parse(texto) as T;
    } catch (erroParse) {
      throw new ErroGemini(
        `Gemini retornou JSON inválido: ${String(erroParse)}`,
        erroParse
      );
    }
  } catch (erro) {
    if (erro instanceof ErroGemini) throw erro;
    throw new ErroGemini(
      `Falha na chamada ao Gemini (${modelo}): ${(erro as Error)?.message ?? erro}`,
      erro
    );
  }
}

export { SchemaType };
export type { Schema };
