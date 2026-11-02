import { normalizarTelefone } from "../../shared/campanhas-whatsapp";
import { feriadosNacionaisDoAno } from "../../shared/feriados-nacionais";

export const FUSO_CADENCIA = "America/Campo_Grande";

export const CAMPOS_REGRA_CADENCIA = [
  "days_since_purchase",
  "total_orders",
  "orders_last_90_days",
  "quote_status",
  "days_since_quote",
  "orders_after_latest_quote",
] as const;

export type CampoRegraCadencia = (typeof CAMPOS_REGRA_CADENCIA)[number];
export type OperadorRegraCadencia = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
export interface RegraCadenciaErp {
  campo: CampoRegraCadencia;
  operador: OperadorRegraCadencia;
  valor: number | string;
}

export interface FatosContatoErp {
  telefoneE164: string;
  nome: string;
  cnpj: string | null;
  clienteId: number | null;
  totalOrders: number;
  ordersLast90Days: number;
  daysSincePurchase: number | null;
  quoteStatus: "pending" | "won" | "lost" | "other" | null;
  daysSinceQuote: number | null;
  ordersAfterLatestQuote: number;
  ultimaCompraEm: string | null;
  ultimoOrcamentoEm: string | null;
};

export function telefoneParaE164(valor: unknown): string | null {
  const digitos = normalizarTelefone(valor);
  return digitos ? `+${digitos}` : null;
}

export function detectarPedidoOptOut(texto: string): boolean {
  const normalizado = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  return /(?:^| )(?:PARAR|SAIR|DESCADASTRAR|NAO QUERO)(?: |$)/.test(normalizado);
}

export function e164ParaDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function avaliarRegrasErp(
  fatos: FatosContatoErp,
  regras: readonly RegraCadenciaErp[]
): boolean {
  if (regras.length === 0) return false;
  return regras.every(regra => {
    const fato = valorDoCampo(fatos, regra.campo);
    if (fato === null || fato === undefined) return false;
    if (regra.campo === "quote_status") {
      return comparar(String(fato), regra.operador, String(regra.valor));
    }
    const numerico = Number(regra.valor);
    return Number.isFinite(numerico) && comparar(Number(fato), regra.operador, numerico);
  });
}

function valorDoCampo(fatos: FatosContatoErp, campo: CampoRegraCadencia): number | string | null {
  switch (campo) {
    case "days_since_purchase": return fatos.daysSincePurchase;
    case "total_orders": return fatos.totalOrders;
    case "orders_last_90_days": return fatos.ordersLast90Days;
    case "quote_status": return fatos.quoteStatus;
    case "days_since_quote": return fatos.daysSinceQuote;
    case "orders_after_latest_quote": return fatos.ordersAfterLatestQuote;
  }
}

function comparar(a: number | string, op: OperadorRegraCadencia, b: number | string): boolean {
  switch (op) {
    case "eq": return a === b;
    case "neq": return a !== b;
    case "gt": return typeof a === "number" ? a > Number(b) : String(a) > String(b);
    case "gte": return typeof a === "number" ? a >= Number(b) : String(a) >= String(b);
    case "lt": return typeof a === "number" ? a < Number(b) : String(a) < String(b);
    case "lte": return typeof a === "number" ? a <= Number(b) : String(a) <= String(b);
  }
}

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_CADENCIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_CADENCIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partes(formatter: Intl.DateTimeFormat, date: Date): Record<string, number> {
  return Object.fromEntries(
    formatter.formatToParts(date).map(p => [p.type, Number(p.value)])
  );
}

function localDateToUtc(ano: number, mes: number, dia: number, hora: number, minuto: number): Date {
  const alvoUtc = Date.UTC(ano, mes - 1, dia, hora, minuto);
  let estimativa = alvoUtc;
  for (let i = 0; i < 3; i++) {
    const p = partes(dateTimeFormatter, new Date(estimativa));
    const localComoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    estimativa += alvoUtc - localComoUtc;
  }
  return new Date(estimativa);
}

function diaUtil(ano: number, mes: number, dia: number): boolean {
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const dow = data.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return !feriadosNacionaisDoAno(ano).has(iso);
}

function avancarData(ano: number, mes: number, dia: number, quantidade: number): [number, number, number] {
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() + quantidade);
  return [data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate()];
}

/** Soma dias úteis e normaliza para a janela local 08:30–17:30, incluindo feriados nacionais. */
export function proximoHorarioUtil(base: Date, diasUteis: number): Date {
  const p = partes(dateTimeFormatter, base);
  let ano = p.year;
  let mes = p.month;
  let dia = p.day;
  let restantes = Math.max(0, Math.floor(diasUteis));

  while (restantes > 0) {
    [ano, mes, dia] = avancarData(ano, mes, dia, 1);
    if (diaUtil(ano, mes, dia)) restantes--;
  }

  let hora = p.hour;
  let minuto = p.minute;
  const antesDaJanela = hora < 8 || (hora === 8 && minuto < 30);
  const depoisDaJanela = hora > 17 || (hora === 17 && (minuto > 30 || (minuto === 30 && p.second > 0)));
  if (!diaUtil(ano, mes, dia) || depoisDaJanela) {
    do {
      [ano, mes, dia] = avancarData(ano, mes, dia, 1);
    } while (!diaUtil(ano, mes, dia));
    hora = 8;
    minuto = 30;
  } else if (antesDaJanela) {
    hora = 8;
    minuto = 30;
  }
  return localDateToUtc(ano, mes, dia, hora, minuto);
}

export function proximoHorarioEntreDisparos(agora: Date, atrasoSegundos: number): Date {
  const alvo = new Date(agora.getTime() + Math.max(0, atrasoSegundos) * 1000);
  return proximoHorarioUtil(alvo, 0);
}

export function diasEntreDatasIso(inicio: string, fim: string): number {
  const [yi, mi, di] = inicio.slice(0, 10).split("-").map(Number);
  const [yf, mf, df] = fim.slice(0, 10).split("-").map(Number);
  return Math.max(0, Math.floor((Date.UTC(yf, mf - 1, df) - Date.UTC(yi, mi - 1, di)) / 86_400_000));
}

export function hojeIsoCampoGrande(agora = new Date()): string {
  const p = partes(dateFormatter, agora);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
