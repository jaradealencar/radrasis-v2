/**
 * Análise semântica das respostas de clientes a Campanhas WhatsApp via Google Gemini Flash (SDK oficial).
 *
 * Consolida o pedido dos 3 prompts:
 * - Prompt 1: Clusterização em 4 grupos ("ORCAMENTO_DIRETO", "DUVIDA_TECNICA", "OBJECAO_FORNECEDOR", "DESQUALIFICADO_OUTROS"),
 *   resumo_intencao (máx 12 palavras), nivel_interesse (1 a 5), palavras_chave (até 4).
 * - Prompt 3: ICP Fit Score (1 a 100), perfil_interlocutor, parametros_projeto, motivo_objecao, resumo_objecao.
 *
 * Tratamento de falha: qualquer erro de API/rede/timeout cai no fallback "DESQUALIFICADO_OUTROS" com score 1,
 * garantindo que uma falha de IA nunca quebre o pipeline de webhook ou debounce.
 *
 * **Clamping, não rejeição, para os campos numéricos** (achado em teste real com a API, 17/10/2026): o
 * `IntegerSchema` do SDK do Gemini (`@google/generative-ai`) não tem `minimum`/`maximum` — só `ArraySchema`
 * tem `minItems`/`maxItems` (ver node_modules/@google/generative-ai/dist/generative-ai.d.ts). A instrução de
 * range vai só em texto (system instruction + `description` do schema), que o modelo pode não respeitar à
 * risca: um teste real pediu nivel_interesse 1-5 e o Gemini devolveu 9 para uma mensagem de altíssimo
 * interesse. Se o schema Zod REJEITASSE isso (como antes), a resposta cairia inteira no fallback
 * DESQUALIFICADO_OUTROS — descartando por engano um lead quente de verdade, o pior caso possível para este
 * pipeline. `sanearRespostaGemini` faz clamp/truncamento ANTES do parse Zod (que então só garante os tipos e
 * os enums, esses sim 100% impostos pelo `format: "enum"` do schema do SDK).
 */

import { z } from "zod";
import {
  chamarGeminiJson,
  SchemaType,
  type Schema,
} from "../integrations/gemini-client";
import {
  CLUSTERS_LEAD,
  MOTIVOS_OBJECAO,
  PERFIS_INTERLOCUTOR,
  TEMPERATURAS_AUDIENCIA,
  type ClusterLead,
  type MotivoObjecao,
  type PerfilInterlocutor,
  type TemperaturaAudiencia,
  type ResumoExecutivoIa,
} from "../../shared/campanhas-whatsapp-ia";

export const resultadoAnaliseGeminiSchema = z.object({
  cluster: z.enum(CLUSTERS_LEAD),
  resumo_intencao: z.string().max(255),
  nivel_interesse: z.number().int().min(1).max(5),
  palavras_chave: z.array(z.string().max(60)).max(6),
  icp_fit_score: z.number().int().min(1).max(100),
  perfil_interlocutor: z.enum(PERFIS_INTERLOCUTOR),
  parametros_projeto: z.array(z.string().max(100)).max(10),
  motivo_objecao: z.enum(MOTIVOS_OBJECAO),
  resumo_objecao: z.string().max(255).nullish(),
});

function clampInt(
  valor: unknown,
  min: number,
  max: number,
  padrao: number
): number {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n)) return padrao;
  return Math.min(Math.max(n, min), max);
}

function truncarArray(valor: unknown, max: number): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((v): v is string => typeof v === "string").slice(0, max);
}

/** Corrige numéricos fora do range e arrays maiores que o pedido ANTES da validação Zod — ver nota acima
 * sobre por que o SDK do Gemini não impõe `minimum`/`maximum` em campos integer. */
export function sanearRespostaGemini(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  return {
    ...o,
    nivel_interesse: clampInt(o.nivel_interesse, 1, 5, 1),
    icp_fit_score: clampInt(o.icp_fit_score, 1, 100, 1),
    palavras_chave: truncarArray(o.palavras_chave, 6),
    parametros_projeto: truncarArray(o.parametros_projeto, 10),
    resumo_intencao:
      typeof o.resumo_intencao === "string"
        ? o.resumo_intencao.slice(0, 255)
        : o.resumo_intencao,
    resumo_objecao:
      typeof o.resumo_objecao === "string"
        ? o.resumo_objecao.slice(0, 255)
        : (o.resumo_objecao ?? null),
  };
}
export type ResultadoAnaliseGemini = z.infer<
  typeof resultadoAnaliseGeminiSchema
>;

/** Schema oficial do SDK do Gemini com Structured Output estrito. */
export const GEMINI_RESPOSTA_CAMPANHA_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    cluster: {
      type: SchemaType.STRING,
      format: "enum",
      enum: [...CLUSTERS_LEAD],
      description: "Cluster semântico principal da resposta do cliente.",
    },
    resumo_intencao: {
      type: SchemaType.STRING,
      description:
        "Uma frase curta (máximo 12 palavras) resumindo exatamente o que o cliente pediu ou falou.",
    },
    nivel_interesse: {
      type: SchemaType.INTEGER,
      description:
        "OBRIGATORIAMENTE um inteiro ENTRE 1 E 5, nunca fora dessa faixa (1 = nulo/negativo, 5 = altíssimo interesse/pronto para fechar). Nunca use 0, 6 ou qualquer valor fora de 1-5 — se o interesse parecer maior que 5, ainda assim responda 5.",
    },
    palavras_chave: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description:
        "Array de até 4 termos relevantes identificados (ex: ['ACM', 'LED IP67', 'prazo']).",
    },
    icp_fit_score: {
      type: SchemaType.INTEGER,
      description:
        "OBRIGATORIAMENTE um inteiro ENTRE 1 E 100, nunca fora dessa faixa. Pontuação de adequação ao perfil de cliente ideal (80-100 quente/alta, 50-79 morno, 1-49 frio).",
    },
    perfil_interlocutor: {
      type: SchemaType.STRING,
      format: "enum",
      enum: [...PERFIS_INTERLOCUTOR],
      description: "Perfil de quem está respondendo.",
    },
    parametros_projeto: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description:
        "Detalhes técnicos/medidas citados pelo cliente (ex: ['ACM', 'LED Backlight', 'Medida 3x1m', 'Prazo 15 dias']).",
    },
    motivo_objecao: {
      type: SchemaType.STRING,
      format: "enum",
      enum: [...MOTIVOS_OBJECAO],
      description: "Motivo principal de objeção ou perda, se houver.",
    },
    resumo_objecao: {
      type: SchemaType.STRING,
      description:
        "Frase curta (máx 10 palavras) detalhando a dor/objeção caso exista.",
      nullable: true,
    },
  },
  required: [
    "cluster",
    "resumo_intencao",
    "nivel_interesse",
    "palavras_chave",
    "icp_fit_score",
    "perfil_interlocutor",
    "parametros_projeto",
    "motivo_objecao",
  ],
};

const SYSTEM_INSTRUCTION = `Você é um analisador semântico de conversas comerciais B2B via WhatsApp para uma indústria de comunicação visual e letreiros (Letreiros Express / Radrasys).
Sua tarefa é analisar o histórico de mensagens enviadas por um cliente após um disparo de campanha e extrair informações cruciais de engajamento, qualificação e intenção comercial.

Regras de Classificação em Clusters:
- "ORCAMENTO_DIRETO": Cliente perguntou preço, enviou medidas, solicitou cotação formal ou demonstrou intenção clara de compra imediata.
- "DUVIDA_TECNICA": Cliente fez perguntas sobre material (ACM, acrílico, inox, lona, vinil), especificações, instalação, prazos, durabilidade ou processos de fabricação.
- "OBJECAO_FORNECEDOR": Cliente disse que já tem fornecedor fixo, que achou caro, ou pediu apresentação/tabela para comparar no futuro.
- "DESQUALIFICADO_OUTROS": Cliente pediu para remover da lista, enviou texto desconexo, recusou atendimento ou mandou mensagem irrelevante/ofensiva.

Regras de Pontuação do ICP Fit Score (1 a 100):
- 80 a 100 (Quente / Alta Prioridade): Cliente enviou medidas, solicitou cotação formal, perguntou prazo com urgência ou especificou materiais técnicos.
- 50 a 79 (Médio / Morno): Cliente fez perguntas gerais de preço sem especificações ou tirou dúvidas sobre a empresa.
- 1 a 49 (Frio / Baixa Prioridade): Cliente deu respostas monossilábicas, demonstrou desinteresse, recusou ou fez objeções rígidas de fornecedor/preço.

Regras de Perfil do Interlocutor:
- "DECISOR_SOCIO": Dono, sócio, diretor ou tomador de decisão final evidente pelo tom e contexto.
- "COMPRADOR_TECNICO": Arquiteto, engenheiro, designer, comprador ou especificador técnico.
- "INTERMEDIARIO_ATENDENTE": Recepcionista, secretário, atendente repassando contato.
- "DESCONHECIDO": Não é possível identificar o cargo a partir das mensagens.

Regras de Objeção:
- "PRECO_ORCAMENTO": Reclamou do preço ou achou caro.
- "PRAZO_ENTREGA": Precisa para ontem ou prazo não atende.
- "FORNECEDOR_FIXO": Já é atendido por outra empresa e não quer trocar.
- "TIMING_INADEQUADO": Sem verba agora, reformando só no ano que vem, projeto pausado.
- "FORA_DE_ESCOPO": Pediu produto que não fazemos (ex: brindes, camisetas, papelaria).
- "NENHUMA": Cliente não apresentou objeção ou demonstrou interesse positivo.

Campos que você DEVE retornar no JSON:
1. "cluster": Um dos 4 valores exatos ("ORCAMENTO_DIRETO", "DUVIDA_TECNICA", "OBJECAO_FORNECEDOR", "DESQUALIFICADO_OUTROS").
2. "resumo_intencao": Frase curta (MÁXIMO 12 PALAVRAS) resumindo exatamente o que o cliente pediu ou falou.
3. "nivel_interesse": Inteiro ENTRE 1 E 5, NUNCA fora dessa faixa (1 = sem interesse/recusa; 5 = altíssimo interesse/pronto para fechar). Interesse extremo ainda assim é 5, nunca 6, 9 ou 10.
4. "palavras_chave": Array de até 4 termos relevantes (ex: ["ACM", "LED IP67", "prazo"]).
5. "icp_fit_score": Inteiro ENTRE 1 E 100, NUNCA fora dessa faixa.
6. "perfil_interlocutor": Um dos valores de perfil.
7. "parametros_projeto": Array de medidas, materiais e prazos citados (vazio se nenhum).
8. "motivo_objecao": Um dos valores de objeção.
9. "resumo_objecao": Frase curta (máx 10 palavras) da dor, ou null se NENHUMA.`;

export function montarPayloadPrompt(
  campanhaTexto: string,
  respostasCliente: string[]
): string {
  const mensagensLimpas = respostasCliente
    .map(m => String(m ?? "").trim())
    .filter(m => m.length > 0)
    .slice(0, 40);

  return JSON.stringify(
    {
      mensagem_campanha_enviada:
        campanhaTexto.trim() ||
        "[Disparo de campanha institucional/comercial via WhatsApp]",
      mensagens_resposta_cliente:
        mensagensLimpas.length > 0
          ? mensagensLimpas
          : ["[Cliente respondeu com interação sem texto]"],
    },
    null,
    2
  );
}

/** Fallback padrão seguro quando a IA falhar ou não estiver configurada. */
export function criarFallbackPadrao(
  motivo: string = "Análise automática indisponível"
): ResultadoAnaliseGemini {
  return {
    cluster: "DESQUALIFICADO_OUTROS",
    resumo_intencao: motivo.slice(0, 60),
    nivel_interesse: 1,
    palavras_chave: [],
    icp_fit_score: 1,
    perfil_interlocutor: "DESCONHECIDO",
    parametros_projeto: [],
    motivo_objecao: "NENHUMA",
    resumo_objecao: null,
  };
}

export interface AnalisarRespostaOpcoes {
  model?: string;
  lancarErro?: boolean;
}

/**
 * Analisa as respostas de um cliente com o Gemini Flash usando Structured Outputs (JSON Schema).
 * Se a API falhar ou não estiver configurada, aplica fallback padrão "DESQUALIFICADO_OUTROS"
 * sem quebrar o fluxo chamador (a menos que `opcoes.lancarErro` seja true).
 */
export async function analisarRespostaComGemini(
  campanhaTexto: string,
  respostasCliente: string[],
  opcoes: AnalisarRespostaOpcoes = {}
): Promise<ResultadoAnaliseGemini> {
  const prompt = montarPayloadPrompt(campanhaTexto, respostasCliente);
  try {
    const raw = await chamarGeminiJson<unknown>({
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt,
      responseSchema: GEMINI_RESPOSTA_CAMPANHA_SCHEMA,
      model: opcoes.model,
      temperature: 0.2,
      maxOutputTokens: 1024,
    });
    return resultadoAnaliseGeminiSchema.parse(sanearRespostaGemini(raw));
  } catch (erro) {
    console.error(
      "[campanhas-whatsapp-ia] Falha ao analisar resposta com Gemini:",
      (erro as Error)?.message ?? erro
    );
    if (opcoes.lancarErro) throw erro;
    return criarFallbackPadrao(
      "Resposta recebida sem classificação conclusiva"
    );
  }
}

// ─── Resumo Executivo Geral da Campanha por IA (Gemini Flash) ───────────────

export const resumoExecutivoGeminiSchema = z.object({
  visao_geral: z.string().max(800),
  temperatura_audiencia: z.enum(TEMPERATURAS_AUDIENCIA),
  justificativa_temperatura: z.string().max(300),
  pontos_fortes_oferta: z.array(z.string().max(200)).min(1).max(5),
  principais_dores_objecoes: z.array(
    z.object({
      objecao: z.string().max(120),
      impacto: z.string().max(250),
      citacao_real: z.string().max(250).nullish(),
    })
  ).max(5),
  perfil_predominante: z.string().max(160),
  recomendacoes_proxima_campanha: z.array(z.string().max(250)).min(1).max(5),
});

export const GEMINI_RESUMO_EXECUTIVO_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    visao_geral: {
      type: SchemaType.STRING,
      description: "Síntese executiva densa (1 a 2 parágrafos) avaliando a receptividade da campanha, qualidade dos leads e taxa de conversão esperada.",
    },
    temperatura_audiencia: {
      type: SchemaType.STRING,
      format: "enum",
      enum: [...TEMPERATURAS_AUDIENCIA],
      description: "Avaliação sintética da temperatura geral do público atingido.",
    },
    justificativa_temperatura: {
      type: SchemaType.STRING,
      description: "Por que esta temperatura foi atribuída, com base nos números e no teor das respostas.",
    },
    pontos_fortes_oferta: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "De 2 a 4 pontos da copy, oferta ou posicionamento que geraram interesse e orçamentos.",
    },
    principais_dores_objecoes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          objecao: { type: SchemaType.STRING, description: "Nome da trava (ex: Preço elevado, Prazo incompatível)." },
          impacto: { type: SchemaType.STRING, description: "Explicação objetiva de como isso travou vendas." },
          citacao_real: { type: SchemaType.STRING, nullable: true, description: "Exemplo ou frase representativa dita pelos clientes." },
        },
        required: ["objecao", "impacto"],
      },
      description: "Até 4 maiores objeções diagnosticadas no lote de respostas.",
    },
    perfil_predominante: {
      type: SchemaType.STRING,
      description: "Descrição de quem mais respondeu (ex: Donos de gráficas rápidas buscando terceirização de letra caixa).",
    },
    recomendacoes_proxima_campanha: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "De 2 a 4 ações comerciais ou de copy práticas e imediatas para o próximo disparo.",
    },
  },
  required: [
    "visao_geral",
    "temperatura_audiencia",
    "justificativa_temperatura",
    "pontos_fortes_oferta",
    "principais_dores_objecoes",
    "perfil_predominante",
    "recomendacoes_proxima_campanha",
  ],
};

const SYSTEM_INSTRUCTION_RESUMO_EXECUTIVO = `Você é o Diretor Comercial e Estrategista Sênior de Marketing B2B da Letreiros Express / Radrasys (fábrica de comunicação visual, fachadas e letra caixa).
Sua tarefa é analisar os resultados consolidados de uma campanha de WhatsApp (KPIs de envio, taxas de resposta humana vs bot, clusters semânticos, principais objeções e frases literais dos clientes) e redigir um Resumo Executivo de Alto Nível para a diretoria.

Seja extremamente objetivo, técnico e orientado a negócios:
1. Avalie honestamente se a oferta funcionou ou se houve atrito comercial.
2. Identifique os padrões reais do mercado (o que o cliente valorizou vs onde ele travou).
3. Entregue recomendações acionáveis sobre preço, prazo, abordagem comercial e público-alvo para o próximo disparo.`;

export interface DadosParaResumoExecutivo {
  nomeCampanha: string;
  templateEnviado?: string | null;
  totalDisparado: number;
  respostasHumanas: number;
  taxaRespostaPct: number;
  cliquesCta: number;
  totalLeadsQualificados: number;
  clusters: Array<{ cluster: string; total: number; percentual: number }>;
  objecoes: Array<{ motivo: string; total: number; percentual: number }>;
  amostraIntencoes: string[];
  amostraObjecoes: Array<{ motivo: string; resumo: string }>;
  distribuicaoIcp: { quente: number; morno: number; frio: number };
  tempoMedioReacaoMinutos?: number | null;
}

export function montarPayloadResumoExecutivo(dados: DadosParaResumoExecutivo): string {
  return JSON.stringify(
    {
      campanha: dados.nomeCampanha,
      template_usado: dados.templateEnviado || "[Template institucional/comercial via WhatsApp]",
      metricas_gerais: {
        total_disparos: dados.totalDisparado,
        respostas_humanas_reais: dados.respostasHumanas,
        taxa_resposta_humana_pct: `${dados.taxaRespostaPct}%`,
        cliques_em_botoes_cta: dados.cliquesCta,
        tempo_medio_resposta_minutos: dados.tempoMedioReacaoMinutos ?? "Não apurado",
      },
      distribuicao_leads: {
        clusters: dados.clusters,
        objecoes_frequentes: dados.objecoes,
        qualidade_icp: dados.distribuicaoIcp,
      },
      amostra_resumos_intencao_clientes: dados.amostraIntencoes.slice(0, 15),
      amostra_frases_objecao_reais: dados.amostraObjecoes.slice(0, 15),
    },
    null,
    2
  );
}

export function criarFallbackResumoExecutivo(
  motivo: string,
  dados: DadosParaResumoExecutivo
): ResumoExecutivoIa {
  const temRespostas = dados.respostasHumanas > 0;
  return {
    visaoGeral: temRespostas
      ? `A campanha obteve ${dados.respostasHumanas} respostas humanas (${dados.taxaRespostaPct}% de taxa de resposta). ${motivo}`
      : `Campanha sem respostas humanas registradas até o momento. ${motivo}`,
    temperaturaAudiencia: dados.distribuicaoIcp.quente > 0 ? "INTERESSE_MODERADO" : "FRIA_RESISTENTE",
    justificativaTemperatura: `Baseado em ${dados.respostasHumanas} resposta(s) humana(s) e ${dados.distribuicaoIcp.quente} lead(s) de alta prioridade.`,
    pontosFortesOferta: [
      dados.cliquesCta > 0 ? "Geração de cliques nos botões de ação rápida" : "Disparo oficial entregue pela API",
      dados.distribuicaoIcp.quente > 0 ? "Identificação de contatos com alta propensão de cotação" : "Validação do canal de comunicação",
    ],
    principaisDoresObjecoes: dados.objecoes.slice(0, 3).map(o => ({
      objecao: o.motivo,
      impacto: `${o.total} cliente(s) mencionaram este fator (${o.percentual}% das objeções).`,
      citacaoReal: dados.amostraObjecoes.find(a => a.motivo === o.motivo)?.resumo ?? null,
    })),
    perfilPredominante: "Contatos de carteira comercial e prospects B2B.",
    recomendacoesProximaCampanha: [
      "Manter cadência de atendimento rápido aos leads quentes com cotação direta.",
      "Segmentar contatos com objeção de fornecedor para campanhas de apresentação comparativa.",
    ],
    geradoEm: new Date().toISOString(),
  };
}

export async function gerarResumoExecutivoComGemini(
  dados: DadosParaResumoExecutivo,
  opcoes: AnalisarRespostaOpcoes = {}
): Promise<ResumoExecutivoIa> {
  const prompt = montarPayloadResumoExecutivo(dados);
  try {
    const raw = await chamarGeminiJson<z.infer<typeof resumoExecutivoGeminiSchema>>({
      systemInstruction: SYSTEM_INSTRUCTION_RESUMO_EXECUTIVO,
      prompt,
      responseSchema: GEMINI_RESUMO_EXECUTIVO_SCHEMA,
      model: opcoes.model,
      temperature: 0.2,
      maxOutputTokens: 1024,
    });
    const parsed = resumoExecutivoGeminiSchema.parse(raw);
    return {
      visaoGeral: parsed.visao_geral,
      temperaturaAudiencia: parsed.temperatura_audiencia,
      justificativaTemperatura: parsed.justificativa_temperatura,
      pontosFortesOferta: parsed.pontos_fortes_oferta,
      principaisDoresObjecoes: parsed.principais_dores_objecoes.map(d => ({
        objecao: d.objecao,
        impacto: d.impacto,
        citacaoReal: d.citacao_real ?? null,
      })),
      perfilPredominante: parsed.perfil_predominante,
      recomendacoesProximaCampanha: parsed.recomendacoes_proxima_campanha,
      geradoEm: new Date().toISOString(),
    };
  } catch (erro) {
    console.error(
      "[campanhas-whatsapp-ia] Falha ao gerar resumo executivo com Gemini:",
      (erro as Error)?.message ?? erro
    );
    if (opcoes.lancarErro) throw erro;
    return criarFallbackResumoExecutivo(
      "Síntese automática preliminar consolidada localmente.",
      dados
    );
  }
}

