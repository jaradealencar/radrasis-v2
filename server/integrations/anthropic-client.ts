import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "../_core/env";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!ENV.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada — o chat de IA do Painel Financeiro está desativado.");
  }
  if (!client) client = new Anthropic({ apiKey: ENV.anthropicApiKey });
  return client;
}

const SYSTEM_PROMPT = `Você é um CFO sênior atuando como consultor interno da Radra (Letreiros Express), uma indústria de comunicação visual (letreiros, placas, painéis de LED). Você responde perguntas do gestor sobre a saúde financeira da empresa usando os dados reais fornecidos no contexto abaixo.

Use, quando fizerem sentido para a pergunta, estes frameworks de análise financeira:
- EBITDA e Margem EBITDA
- Margem de Contribuição por canal/produto
- LTV vs. CAC (Lifetime Value / Customer Acquisition Cost)
- Working Capital (Capital de Giro) e Ciclo de Caixa
- ROIC e ROE
- Análise de Variância (Orçado vs. Realizado)
- Análise de Coorte (retenção por mês de entrada do cliente)
- Análise de Sensibilidade / Cenários (Otimista, Base, Pessimista)
- Análise de Pareto (80/20) por produto/cliente
- Regressão linear / tendência de vendas (forecasting)

Regra inegociável: NUNCA invente ou estime um número financeiro como se fosse dado real. Se o dado necessário para responder algo com precisão não estiver no contexto fornecido, diga explicitamente que falta esse dado e o que seria preciso para calculá-lo — não preencha a lacuna com um chute. Você pode fazer projeções/estimativas explicitamente rotuladas como tal (ex: "projeção baseada em regressão linear sobre os últimos N meses"), mas nunca as apresente como número realizado.

Seja direto e quantitativo. Responda em português do Brasil.`;

export interface MensagemChat {
  role: "user" | "assistant";
  texto: string;
}

/**
 * Chama o Claude com o contexto de dados financeiros (montado pelo caller a partir
 * do banco) mais o histórico da conversa e a pergunta atual. O contexto é
 * reconstruído a cada chamada para refletir o estado mais recente do banco.
 */
export async function perguntarSobreFinanceiro(
  contextoDados: string,
  historico: MensagemChat[],
  pergunta: string,
): Promise<string> {
  const anthropic = getClient();

  const messages: Anthropic.MessageParam[] = [
    ...historico.map((m): Anthropic.MessageParam => ({
      role: m.role,
      content: m.texto,
    })),
    { role: "user", content: pergunta },
  ];

  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: contextoDados },
    ],
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    messages,
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) throw new Error("Claude não retornou texto na resposta.");
  return textBlock.text;
}

/**
 * Chama o Claude com um system prompt e um contexto de dados já calculados (JSON
 * serializado pelo caller) mais uma pergunta única — sem histórico de conversa.
 * Usado pelo Assistente de Inteligência de Clientes (server/routers/performanceComercial.ts),
 * que refaz o contexto do zero a cada pergunta em vez de manter uma conversa contínua.
 */
export async function perguntarSobreClientes(
  systemPrompt: string,
  contextoDados: string,
  pergunta: string,
): Promise<string> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    system: [
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
      { type: "text", text: contextoDados },
    ],
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    messages: [{ role: "user", content: pergunta }],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) throw new Error("Claude não retornou texto na resposta.");
  return textBlock.text;
}
