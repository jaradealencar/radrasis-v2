import type { RouterOutputs } from "@/lib/trpc";
import type { Cenario, Fixos, TotaisCenario } from "@shared/meta-faturamento";

export type PainelMetaDados = RouterOutputs["performanceComercial"]["getPainelMeta"];

/** Destinos que as recomendações podem abrir dentro do sistema. */
export type DestinoRecomendacao = NonNullable<PainelMetaDados["recomendacoes"][number]["destino"]>;

/** Abas da Inteligência de Clientes que o painel sabe abrir. */
export type VistaDestino = "clientes" | "fila" | "retencao" | "funil" | "crescimento";

/** Uma linha da tabela do Planejador — o suficiente para gravar como Meta Geral do mês
 * (botão "Aplicar como Meta"). `mes` é o k relativo usado por mesApos (0 = mês corrente). */
export interface LinhaAplicarMeta {
  mes: number;
  rotulo: string;
  totais: TotaisCenario;
  cenario: Cenario;
  leads: number | null;
  conversaoPct: number | null;
}

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

/** Estado do Simulador que faz sentido lembrar entre visitas (travas do cadeado, meta, modo
 * automático etc.) — sem isso, sair da página (não só trocar de aba) apaga tudo e a tela volta
 * pros padrões do sistema, dando a impressão de que a trava "não funciona". */
export interface SimuladorEstadoSalvo {
  fixos: Fixos;
  modoAuto: boolean;
  meta: number;
  meta2: number;
  pesoConversao: number;
  margemEditada: number | null;
  prazo: number;
}

const CHAVE_SIMULADOR = "radrasis:painel-meta:simulador:v1";

/** Só o navegador guarda isso (conveniência); armazenamento bloqueado ou conteúdo inválido
 * simplesmente volta aos padrões — nunca quebra a tela. */
export function carregarSimulador(): Partial<SimuladorEstadoSalvo> {
  try {
    const bruto = window.localStorage.getItem(CHAVE_SIMULADOR);
    if (!bruto) return {};
    const obj: unknown = JSON.parse(bruto);
    if (!obj || typeof obj !== "object") return {};
    const o = obj as Record<string, unknown>;
    const saida: Partial<SimuladorEstadoSalvo> = {};
    if (o.fixos && typeof o.fixos === "object" && !Array.isArray(o.fixos)) {
      const fixos: Fixos = {};
      for (const [chave, v] of Object.entries(o.fixos as Record<string, unknown>)) {
        if (typeof v === "number" && Number.isFinite(v)) (fixos as Record<string, number>)[chave] = v;
      }
      saida.fixos = fixos;
    }
    if (typeof o.modoAuto === "boolean") saida.modoAuto = o.modoAuto;
    if (typeof o.meta === "number" && Number.isFinite(o.meta) && o.meta > 0) saida.meta = o.meta;
    if (typeof o.meta2 === "number" && Number.isFinite(o.meta2) && o.meta2 > 0) saida.meta2 = o.meta2;
    if (typeof o.pesoConversao === "number" && Number.isFinite(o.pesoConversao) && o.pesoConversao >= 0 && o.pesoConversao <= 1) saida.pesoConversao = o.pesoConversao;
    if (o.margemEditada === null) saida.margemEditada = null;
    else if (typeof o.margemEditada === "number" && Number.isFinite(o.margemEditada)) saida.margemEditada = o.margemEditada;
    if (typeof o.prazo === "number" && Number.isFinite(o.prazo) && o.prazo > 0) saida.prazo = o.prazo;
    return saida;
  } catch {
    return {};
  }
}

export function salvarSimulador(estado: SimuladorEstadoSalvo): void {
  try {
    window.localStorage.setItem(CHAVE_SIMULADOR, JSON.stringify(estado));
  } catch {
    /* armazenamento indisponível: as travas só não serão lembradas na próxima visita */
  }
}
