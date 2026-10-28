/**
 * Regras puras do backfill de `historico_orcamentos` (ver server/scripts/backfill-historico-orcamentos.ts):
 * lista de meses a percorrer e a trava que impede gravar no banco errado.
 */
import { databaseIdentity } from "../scripts/migration-safety";

/** Primeiro mês com orçamento no MubiSys (medido em 27/10/2026: jan e fev/2023 vêm vazios, 6 em mar/2023). */
export const DESDE_PADRAO = "2023-03";
/** Teto para um erro de digitação não disparar anos de chamadas ao ERP. */
export const MAX_MESES = 120;

const FORMATO_MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function mesesDoIntervalo(desde: string, ate: string): Array<{ mes: number; ano: number }> {
  const d = FORMATO_MES.exec(desde);
  const a = FORMATO_MES.exec(ate);
  if (!d || !a) throw new Error("Use o formato AAAA-MM (ex.: 2023-03).");

  let ano = Number(d[1]);
  let mes = Number(d[2]);
  const fim = Number(a[1]) * 12 + Number(a[2]);
  if (ano * 12 + mes > fim) throw new Error("--desde não pode ser depois de --ate.");

  const meses: Array<{ mes: number; ano: number }> = [];
  while (ano * 12 + mes <= fim) {
    meses.push({ mes, ano });
    mes++;
    if (mes > 12) { mes = 1; ano++; }
  }
  if (meses.length > MAX_MESES) throw new Error(`Intervalo grande demais (${meses.length} meses; máximo ${MAX_MESES}).`);
  return meses;
}

/** "host/banco" do DATABASE_URL — nunca inclui usuário nem senha. */
export function identificarAlvo(connectionString: string | undefined): string {
  const { host, database } = databaseIdentity(connectionString);
  return `${host}/${database}`;
}

/**
 * Só deixa gravar quando quem roda digitou o mesmo "host/banco" do DATABASE_URL atual, para um .env
 * apontando para o banco errado (de desenvolvimento, de teste, de outro projeto) não receber a carga.
 */
export function confirmarAlvo(connectionString: string | undefined, confirmacao: string | undefined): string {
  const alvo = identificarAlvo(connectionString);
  if (!confirmacao || confirmacao.trim().toLowerCase() !== alvo.toLowerCase()) {
    throw new Error(`Gravação recusada: --confirmo-alvo precisa ser exatamente "${alvo}" (host/banco do DATABASE_URL atual).`);
  }
  return alvo;
}
