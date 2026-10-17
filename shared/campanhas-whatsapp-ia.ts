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
