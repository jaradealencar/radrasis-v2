/**
 * Campanhas WhatsApp — constantes, datas, telefone e semáforo de prazo.
 * Isomórfico (client + server): funções puras, sem I/O. Ver docs/campanhas-whatsapp.md.
 *
 * Datas circulam como string `YYYY-MM-DD` (coluna `date` do Postgres) e a aritmética é feita em UTC sobre
 * o calendário puro — nunca sobre `new Date()` local, que muda de dia conforme o fuso do ambiente (a Vercel roda
 * em UTC; depois das 21h em Campo Grande `new Date()` já é o dia seguinte).
 */

export const FUSO_CAMPANHAS = "America/Campo_Grande";

export const CATEGORIAS_CAMPANHA = ["novo_lead", "orcamento_perdido", "reativacao_inativo", "pos_venda", "outbound"] as const;
export type CategoriaCampanha = (typeof CATEGORIAS_CAMPANHA)[number];
export const CATEGORIA_CAMPANHA_LABEL: Record<CategoriaCampanha, string> = {
  novo_lead: "Novo lead",
  orcamento_perdido: "Orçamento perdido",
  reativacao_inativo: "Reativação de inativos",
  pos_venda: "Pós-venda",
  outbound: "Outbound",
};

export const TIPOS_CAMPANHA = ["recorrente", "gatilho_venda"] as const;
export type TipoCampanha = (typeof TIPOS_CAMPANHA)[number];
export const TIPO_CAMPANHA_LABEL: Record<TipoCampanha, string> = {
  recorrente: "Recorrente (lote periódico)",
  gatilho_venda: "Gatilho de venda (pós-venda)",
};

export const STATUS_CAMPANHA = ["ativa", "pausada", "arquivada"] as const;
export type StatusCampanha = (typeof STATUS_CAMPANHA)[number];
export const STATUS_CAMPANHA_LABEL: Record<StatusCampanha, string> = {
  ativa: "Ativa",
  pausada: "Pausada",
  arquivada: "Arquivada",
};

export type SemaforoCampanha = "vermelho" | "amarelo" | "verde";

/** Amarelo quando faltam até 3 dias para o prazo. */
export const LIMITE_ALERTA_DIAS = 3;
/** "Campanhas da semana": prazo entre amanhã e +7 dias (o que vence hoje ou antes já está no vermelho). */
export const JANELA_SEMANA_DIAS = 7;

const ISO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Hoje no calendário de Campo Grande (`YYYY-MM-DD`), independente do fuso do servidor/navegador. */
export function hojeCampoGrande(agora: Date = new Date()): string {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_CAMPANHAS, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(agora);
}

function isoParaUtcMs(iso: string): number {
  const m = ISO_DATA.exec(iso);
  if (!m) throw new Error(`Data inválida: "${iso}" (esperado YYYY-MM-DD)`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** `true` só para datas reais do calendário (rejeita 2026-02-30). */
export function dataIsoValida(iso: unknown): iso is string {
  if (typeof iso !== "string" || !ISO_DATA.test(iso)) return false;
  return new Date(isoParaUtcMs(iso)).toISOString().slice(0, 10) === iso;
}

/** Soma (ou subtrai, com `dias` negativo) dias corridos a uma data ISO. */
export function somarDias(iso: string, dias: number): string {
  return new Date(isoParaUtcMs(iso) + dias * 86_400_000).toISOString().slice(0, 10);
}

/** Dias corridos de `de` até `ate` (positivo quando `ate` é posterior). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((isoParaUtcMs(ate) - isoParaUtcMs(de)) / 86_400_000);
}

/** Próximo envio de uma campanha recorrente: `último envio + frequência`. */
export function calcularProximoEnvio(ultimoEnvio: string, frequenciaDias: number): string {
  return somarDias(ultimoEnvio, frequenciaDias);
}

/**
 * Semáforo de prazo:
 * - vermelho: `hoje >= proxima` (atrasada ou para disparar hoje);
 * - amarelo: faltam até 3 dias;
 * - verde: faltam mais de 3 dias.
 */
export function classificarSemaforo(proxima: string, hoje: string): SemaforoCampanha {
  const faltam = diasEntre(hoje, proxima);
  if (faltam <= 0) return "vermelho";
  if (faltam <= LIMITE_ALERTA_DIAS) return "amarelo";
  return "verde";
}

/**
 * Telefone brasileiro só com dígitos e DDI 55 (`5567999990000`), ou `null` se não parecer um número válido.
 * Aceita máscara, `+55`, zero de tronco e número sem DDI (10–11 dígitos). Mesma regra de DDI de
 * `formatarLinkWhatsApp` (server/routers/performanceComercial.ts): só o comprimento distingue o DDI 55 do DDD 55 (RS).
 * Exige DDD válido (11–99, sem zero no 2º dígito) e 8 dígitos (fixo) ou 9 começando em 9 (celular).
 */
export function normalizarTelefone(bruto: unknown): string | null {
  const digitos = String(bruto ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digitos) return null;
  const completo = digitos.length >= 12 && digitos.startsWith("55") ? digitos : `55${digitos}`;
  return /^55[1-9][1-9](9\d{8}|[2-9]\d{7})$/.test(completo) ? completo : null;
}

/** `5567999990000` → `(67) 99999-0000` (só para exibição). */
export function formatarTelefone(normalizado: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(normalizado);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : normalizado;
}

/**
 * `2026-09-26` → `26/09/2026`, por string. Não usar `new Date(iso)` para exibir: uma data pura é lida como
 * meia-noite UTC e no Brasil (UTC-4) apareceria um dia antes.
 */
export function formatarDataBr(iso: string | null | undefined): string {
  const m = iso ? ISO_DATA.exec(iso.slice(0, 10)) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}
