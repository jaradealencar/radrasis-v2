/**
 * Qualificação de leads por IA (Gemini Flash) das respostas de clientes a Campanhas WhatsApp.
 *
 * Isomórfico (client + server): constantes, rótulos e funções puras de filtro de bot/debounce. Sem I/O —
 * a chamada ao Gemini fica em server/services/campanhasWhatsappIa.ts; o webhook/buffer em
 * server/routes/campanhas-whatsapp-inbound.ts. Ver docs/campanhas-whatsapp-ia.md.
 */

// ─── Clusters semânticos (Prompt 1) ─────────────────────────────────────────

export const CLUSTERS_LEAD = [
  "ORCAMENTO_DIRETO",
  "DUVIDA_TECNICA",
  "OBJECAO_FORNECEDOR",
  "DESQUALIFICADO_OUTROS",
] as const;
export type ClusterLead = (typeof CLUSTERS_LEAD)[number];

export const ROTULO_CLUSTER: Record<ClusterLead, string> = {
  ORCAMENTO_DIRETO: "Orçamento direto",
  DUVIDA_TECNICA: "Dúvida técnica",
  OBJECAO_FORNECEDOR: "Objeção / Fornecedor atual",
  DESQUALIFICADO_OUTROS: "Desqualificado / Outros",
};

/** Cor por cluster, para o dashboard (bolinha/badge) — mesmo espírito de STATUS_COLORS em chartColors.ts. */
export const COR_CLUSTER: Record<ClusterLead, string> = {
  ORCAMENTO_DIRETO: "#22c55e", // verde
  DUVIDA_TECNICA: "#3b82f6", // azul
  OBJECAO_FORNECEDOR: "#f59e0b", // âmbar
  DESQUALIFICADO_OUTROS: "#ef4444", // vermelho
};

// ─── Perfil do interlocutor e objeções (Prompt 3) ───────────────────────────

export const PERFIS_INTERLOCUTOR = [
  "DECISOR_SOCIO",
  "COMPRADOR_TECNICO",
  "INTERMEDIARIO_ATENDENTE",
  "DESCONHECIDO",
] as const;
export type PerfilInterlocutor = (typeof PERFIS_INTERLOCUTOR)[number];

export const ROTULO_PERFIL_INTERLOCUTOR: Record<PerfilInterlocutor, string> = {
  DECISOR_SOCIO: "Decisor / Sócio",
  COMPRADOR_TECNICO: "Comprador técnico",
  INTERMEDIARIO_ATENDENTE: "Intermediário / Atendente",
  DESCONHECIDO: "Desconhecido",
};

export const MOTIVOS_OBJECAO = [
  "PRECO_ORCAMENTO",
  "PRAZO_ENTREGA",
  "FORNECEDOR_FIXO",
  "TIMING_INADEQUADO",
  "FORA_DE_ESCOPO",
  "NENHUMA",
] as const;
export type MotivoObjecao = (typeof MOTIVOS_OBJECAO)[number];

export const ROTULO_MOTIVO_OBJECAO: Record<MotivoObjecao, string> = {
  PRECO_ORCAMENTO: "Preço / Orçamento",
  PRAZO_ENTREGA: "Prazo de entrega",
  FORNECEDOR_FIXO: "Já tem fornecedor fixo",
  TIMING_INADEQUADO: "Timing inadequado",
  FORA_DE_ESCOPO: "Fora de escopo",
  NENHUMA: "Nenhuma",
};

/** Faixas do ICP Fit Score (1–100, Prompt 3) — usadas no ranking do dashboard. */
export const FAIXA_ICP = ["quente", "morno", "frio"] as const;
export type FaixaIcp = (typeof FAIXA_ICP)[number];

export function classificarFaixaIcp(score: number): FaixaIcp {
  if (score >= 80) return "quente";
  if (score >= 50) return "morno";
  return "frio";
}

export const ROTULO_FAIXA_ICP: Record<FaixaIcp, string> = {
  quente: "🟢 Quente",
  morno: "🟡 Morno",
  frio: "🔴 Frio",
};
export const COR_FAIXA_ICP: Record<FaixaIcp, string> = {
  quente: "#22c55e",
  morno: "#f59e0b",
  frio: "#ef4444",
};

// ─── Configuração de Fonte de Retargeting ────────────────────────────────────

export interface FonteRetargetingConfig {
  origemCampanhaId: number;
  origemCampanhaNome?: string;
  cluster?: ClusterLead | null;
  motivoObjecao?: MotivoObjecao | null;
  icpMinimo?: number | null;
}

// ─── Filtro de bot (Prompt 2, parte 1) ──────────────────────────────────────

/** Abaixo deste intervalo entre o disparo e a resposta, a mensagem é tratada como resposta automática
 * (auto-responder/eco do próprio provedor), não uma pessoa digitando. */
export const LIMITE_RESPOSTA_BOT_SEGUNDOS = 4;

/** Termos comuns de auto-responder/fora do ar — lista deliberadamente curta e literal (sem regex de
 * linguagem natural): qualquer falso positivo aqui descarta uma resposta humana real. Comparação sempre em
 * minúsculas e sem acento (ver normalizarParaComparacao). */
export const BLACKLIST_SEMANTICA_BOT = [
  "mensagem automatica",
  "resposta automatica",
  "fora do horario de atendimento",
  "no momento nao posso atender",
  "estou ausente",
  "away message",
  "auto reply",
  "autoresponder",
] as const;

function normalizarParaComparacao(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export type TipoMensagemInbound = "text" | "button_reply" | "list_reply";

export interface DeteccaoBot {
  ehBot: boolean;
  motivo: "resposta_rapida" | "blacklist_semantica" | null;
}

/**
 * Filtro inicial de bot (Parte 1 do webhook): tempo de resposta curto demais para ser humano, ou texto batendo
 * na blacklist semântica. `button_reply`/`list_reply` NUNCA são bot (é clique real do destinatário) — o
 * chamador trata esse caso como "Engajamento Real Nível 1" antes mesmo de chegar aqui.
 */
export function detectarBot(params: {
  tipoMensagem: TipoMensagemInbound;
  texto: string | null;
  tempoRespostaSegundos: number | null;
}): DeteccaoBot {
  if (params.tipoMensagem !== "text") return { ehBot: false, motivo: null };
  if (
    params.tempoRespostaSegundos !== null &&
    params.tempoRespostaSegundos < LIMITE_RESPOSTA_BOT_SEGUNDOS
  ) {
    return { ehBot: true, motivo: "resposta_rapida" };
  }
  const normalizado = normalizarParaComparacao(params.texto ?? "");
  if (
    normalizado &&
    BLACKLIST_SEMANTICA_BOT.some(termo => normalizado.includes(termo))
  ) {
    return { ehBot: true, motivo: "blacklist_semantica" };
  }
  return { ehBot: false, motivo: null };
}

// ─── Debounce / buffer de consolidação ──────────────────────────────────────

/** Janela de silêncio antes de consolidar as mensagens picadas de um contato numa única chamada de IA. */
export const DEBOUNCE_BUFFER_SEGUNDOS = 60;

/** Teto de mensagens concatenadas por chamada de IA — contém custo mesmo se o cliente mandar uma enxurrada. */
export const MAX_MENSAGENS_POR_ANALISE = 40;

/** Teto de caracteres do texto concatenado enviado ao Gemini (cada mensagem já truncada por si). */
export const MAX_CHARS_MENSAGEM_UNITARIA = 500;

// ─── Heatmap de janelas de atividade (Parte 3) ──────────────────────────────

export const DIAS_SEMANA_LABEL = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

/** Formata "Terça-feira, 10h" a partir de (0=Domingo..6=Sábado, 0..23). */
export function formatarFaixaHeatmap(diaSemana: number, hora: number): string {
  const dia = DIAS_SEMANA_LABEL[diaSemana] ?? "?";
  return `${dia}, ${String(hora).padStart(2, "0")}h`;
}

// ─── Curva de Latência de Resposta (Lead Velocity detalhado) ────────────────

export const FAIXAS_LATENCIA = [
  "ATE_5MIN",
  "DE_5_A_15MIN",
  "DE_15_A_60MIN",
  "DE_1_A_4H",
  "DE_4_A_24H",
  "ACIMA_24H",
] as const;
export type FaixaLatencia = (typeof FAIXAS_LATENCIA)[number];

export const ROTULO_FAIXA_LATENCIA: Record<FaixaLatencia, string> = {
  ATE_5MIN: "Imediata (< 5 min)",
  DE_5_A_15MIN: "Rápida (5 a 15 min)",
  DE_15_A_60MIN: "Moderada (15 a 60 min)",
  DE_1_A_4H: "Mesmo turno (1 a 4 h)",
  DE_4_A_24H: "Mesmo dia (4 a 24 h)",
  ACIMA_24H: "Tardia (> 24 h)",
};

export function classificarFaixaLatencia(segundos: number): FaixaLatencia {
  if (segundos <= 300) return "ATE_5MIN";
  if (segundos <= 900) return "DE_5_A_15MIN";
  if (segundos <= 3600) return "DE_15_A_60MIN";
  if (segundos <= 14400) return "DE_1_A_4H";
  if (segundos <= 86400) return "DE_4_A_24H";
  return "ACIMA_24H";
}

export interface CurvaLatenciaItem {
  faixa: FaixaLatencia;
  label: string;
  total: number;
  percentual: number;
}

// ─── Resumo Executivo da Campanha por IA ─────────────────────────────────────

export const TEMPERATURAS_AUDIENCIA = [
  "MUITO_AQUECIDA",
  "INTERESSE_MODERADO",
  "FRIA_RESISTENTE",
  "DESALINHADA",
] as const;
export type TemperaturaAudiencia = (typeof TEMPERATURAS_AUDIENCIA)[number];

export const ROTULO_TEMPERATURA_AUDIENCIA: Record<
  TemperaturaAudiencia,
  string
> = {
  MUITO_AQUECIDA: "🔥 Muito Aquecida",
  INTERESSE_MODERADO: "⚡ Interesse Moderado",
  FRIA_RESISTENTE: "🧊 Fria / Resistente",
  DESALINHADA: "⚠️ Desalinhada da Oferta",
};

export const COR_TEMPERATURA_AUDIENCIA: Record<TemperaturaAudiencia, string> = {
  MUITO_AQUECIDA: "#22c55e",
  INTERESSE_MODERADO: "#3b82f6",
  FRIA_RESISTENTE: "#f59e0b",
  DESALINHADA: "#ef4444",
};

export interface DorObjecaoExecutiva {
  objecao: string;
  impacto: string;
  citacaoReal?: string | null;
}

export interface ResumoExecutivoIa {
  visaoGeral: string;
  temperaturaAudiencia: TemperaturaAudiencia;
  justificativaTemperatura: string;
  pontosFortesOferta: string[];
  principaisDoresObjecoes: DorObjecaoExecutiva[];
  perfilPredominante: string;
  recomendacoesProximaCampanha: string[];
  geradoEm: string;
}

// ─── Atribuição de Receita & ROI (Campanha ↔ MubiSys O.S.) ──────────────────

export interface OsAtribuidaReceita {
  osNumero: string;
  empresa: string;
  telefone: string;
  dataAprovacao: string | null;
  dataFaturamento: string | null;
  dataCompra: string;
  diasAposDisparo: number;
  valor: number;
  vendedor: string | null;
  clusterIa: ClusterLead | null;
}

export interface AtribuicaoReceitaResultado {
  janelaDias: number;
  receitaTotal: number;
  totalOs: number;
  ticketMedio: number;
  clientesConvertidos: number;
  taxaConversaoDisparosPct: number;
  custoTotalEstimado: number;
  roiEstimadoPct: number | null;
  multiplicadorRetorno: number | null;
  receitaPorCluster: Array<{
    cluster: ClusterLead | "NAO_QUALIFICADO";
    label: string;
    totalOs: number;
    receita: number;
    percentualReceita: number;
  }>;
  ordensServico: OsAtribuidaReceita[];
}
