import type { RouterOutputs } from "@/lib/trpc";

export type PainelMetaDados = RouterOutputs["performanceComercial"]["getPainelMeta"];

/** Destinos que as recomendações podem abrir dentro do sistema. */
export type DestinoRecomendacao = NonNullable<PainelMetaDados["recomendacoes"][number]["destino"]>;

/** Abas da Inteligência de Clientes que o painel sabe abrir. */
export type VistaDestino = "clientes" | "fila" | "retencao" | "funil" | "crescimento";

export const META_PADRAO_1 = 430_000;
export const META_PADRAO_2 = 500_000;
/** Semanas por mês (média) — usado para transformar metas mensais em metas semanais. */
export const SEMANAS_POR_MES = 4.33;

export interface MensagemConsultor {
  role: "user" | "assistant";
  texto: string;
  /** Quem respondeu (só nas respostas da IA). */
  provedor?: string;
  modelo?: string;
}

const CHAVE_CONVERSA = "radrasis:painel-meta:consultor:v1";
const MAX_MENSAGENS_GUARDADAS = 40;

/** A conversa fica só no navegador (conveniência); se o armazenamento estiver bloqueado, segue sem ela. */
export function carregarConversa(): MensagemConsultor[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE_CONVERSA);
    const lista: unknown = bruto ? JSON.parse(bruto) : [];
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((m): m is MensagemConsultor => (m?.role === "user" || m?.role === "assistant") && typeof m.texto === "string")
      .slice(-MAX_MENSAGENS_GUARDADAS);
  } catch {
    return [];
  }
}

export function salvarConversa(mensagens: MensagemConsultor[]): void {
  try {
    window.localStorage.setItem(CHAVE_CONVERSA, JSON.stringify(mensagens.slice(-MAX_MENSAGENS_GUARDADAS)));
  } catch {
    /* armazenamento indisponível: a conversa só não será lembrada depois */
  }
}
