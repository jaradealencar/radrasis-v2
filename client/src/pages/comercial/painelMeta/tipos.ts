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
