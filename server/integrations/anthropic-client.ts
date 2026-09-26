import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "../_core/env";
import { extrairTextoClaude, limitarHistorico } from "../services/iaEconomia";

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

const MAX_TOKENS_ANALISE = 4096;

const ESFORCOS = ["low", "medium", "high", "xhigh", "max"] as const;
type Esforco = (typeof ESFORCOS)[number];

/**
 * "Médio" é o padrão: numa medição real com o Assistente de Clientes (mesma pergunta, mesmo contexto, Opus),
 * o esforço alto gastou 3.987 tokens de saída e 58 s (perto do limite de 60 s da função na Vercel); o médio,
 * 2.649 tokens e 31 s, com resposta equivalente. Para voltar ao alto: ASSISTENTES_ANTHROPIC_EFFORT=high.
 */
const ESFORCO_PADRAO: Esforco = "medium";

function esforcoConfigurado(): Esforco {
  const valor = ENV.assistentesEsforcoAnthropic as Esforco;
  return ESFORCOS.includes(valor) ? valor : ESFORCO_PADRAO;
}

/**
 * Chamada comum aos dois chats analíticos (financeiro e clientes). O que mais pesa no custo é o modelo, o
 * esforço de raciocínio (ver ENV.assistentes*) e o tamanho do que vai junto. Pontos de economia daqui:
 * - o ponto de cache fica no bloco de DADOS (o grande), não no prompt curto: tudo até ali é guardado por
 *   5 min e as perguntas seguidas pagam uma fração (antes ficava no prompt curto, pequeno demais para
 *   ser guardado, e os dados eram reenviados pelo preço cheio a cada pergunta);
 * - a resposta sempre traz o motivo quando vem vazia (o raciocínio conta no teto de tokens);
 * - o uso de cada chamada vai para o log, para conferir o gasto real.
 */
async function chamarClaudeAnalitico(
  rotulo: string,
  systemPrompt: string,
  contextoDados: string,
  messages: Anthropic.MessageParam[],
): Promise<string> {
  const anthropic = getClient();
  const modelo = ENV.assistentesModeloAnthropic;
  const esforco = esforcoConfigurado();
  const inicio = Date.now();

  const response = await anthropic.messages.create({
    model: modelo,
    max_tokens: MAX_TOKENS_ANALISE,
    system: [
      { type: "text", text: systemPrompt },
      { type: "text", text: contextoDados, cache_control: { type: "ephemeral" } },
    ],
    thinking: { type: "adaptive" },
    output_config: { effort: esforco },
    messages,
  });

  console.log(`[ia:${rotulo}] modelo=${modelo} esforco=${esforco} uso=${JSON.stringify(response.usage)} stop=${response.stop_reason} ms=${Date.now() - inicio}`);
  return extrairTextoClaude(response);
}

/**
 * Chama o Claude com o contexto de dados financeiros (montado pelo caller a partir
 * do banco) mais o histórico da conversa e a pergunta atual. O contexto é
 * reconstruído a cada chamada para refletir o estado mais recente do banco.
 * Só as últimas mensagens da conversa seguem junto (cada uma é reenviada e cobrada a cada pergunta).
 */
export async function perguntarSobreFinanceiro(
  contextoDados: string,
  historico: MensagemChat[],
  pergunta: string,
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    ...limitarHistorico(historico).map((m): Anthropic.MessageParam => ({
      role: m.role,
      content: m.texto,
    })),
    { role: "user", content: pergunta },
  ];
  return chamarClaudeAnalitico("financeiro", SYSTEM_PROMPT, contextoDados, messages);
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
  return chamarClaudeAnalitico("clientes", systemPrompt, contextoDados, [{ role: "user", content: pergunta }]);
}
