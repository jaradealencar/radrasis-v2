/**
 * Preenchimento do telefone em `historico_os` (coluna criada na migration 0037, ver
 * server/routers/guiaFornecedores.ts).
 *
 * O cron diário (scheduled-sync-historico.ts) só grava telefone dali pra frente, no mês
 * corrente e no anterior; as O.S. antigas já gravadas ficam com telefone NULL até serem
 * completadas aqui. Usado pelo botão "Completar telefones" da aba interna do Guia de
 * Fornecedores (roda dentro da Vercel, onde a credencial do banco existe) e pelo script
 * server/scripts/backfill-telefone-historico.ts.
 *
 * Uma janela de 7 dias por chamada, sequencial: cabe folgado no maxDuration de 60s da Vercel
 * e não estoura a API do MubiSys — rajadas de janelas em paralelo geraram timeouts em cadeia
 * em 21/09/2026. Idempotente: só grava onde telefone ainda é NULL.
 */
import { getPool } from "../db/db-connection";
import { listarOSMubiSys } from "../integrations/mubisys-client";

const pad = (n: number) => String(n).padStart(2, "0");
const JANELA_DIAS = 7;
export const MESES_BACKFILL_PADRAO = 13;

export interface JanelaBackfill { di: string; df: string }
export interface MesBackfill {
  mes: number; ano: number; total: number; pendentes: number;
  /** false quando só sobrou um resto pequeno — O.S. cujo contato a MubiSys nunca teve; buscar
   * de novo só gastaria chamadas lentas à toa. */
  precisa: boolean;
  janelas: JanelaBackfill[];
}

export function primeiroTelefone(os: any): string {
  const contatos: any[] = Array.isArray(os?.cliente_contato) ? os.cliente_contato : [];
  const numeroDe = (c: any) => c?.celular || c?.telefone || c?.fone || "";
  const ativo = (c: any) => String(c?.status ?? "").toLowerCase() !== "inativo";
  const escolhido = contatos.find(c => numeroDe(c) && ativo(c)) ?? contatos.find(c => numeroDe(c));
  return numeroDe(escolhido);
}

export function fatiarMesEmJanelas(mes: number, ano: number, hoje: Date = new Date()): JanelaBackfill[] {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fimMes = (ano === hoje.getFullYear() && mes === hoje.getMonth() + 1) ? hoje.getDate() : ultimoDia;
  const janelas: JanelaBackfill[] = [];
  for (let dia = 1; dia <= fimMes; dia += JANELA_DIAS) {
    const fim = Math.min(dia + JANELA_DIAS - 1, fimMes);
    janelas.push({ di: `${ano}-${pad(mes)}-${pad(dia)}`, df: `${ano}-${pad(mes)}-${pad(fim)}` });
  }
  return janelas;
}

/** Meses (do mais recente ao mais antigo) com a contagem de O.S. sem telefone e as janelas
 * de 7 dias que cobririam cada um. */
export async function planoBackfillTelefone(totalMeses = MESES_BACKFILL_PADRAO, hoje: Date = new Date()): Promise<MesBackfill[]> {
  const chaveAtual = hoje.getFullYear() * 12 + hoje.getMonth() + 1;
  const chaveInicial = chaveAtual - (totalMeses - 1);
  const { rows } = await getPool().query(
    `SELECT mes, ano, count(*)::int AS total, (count(*) FILTER (WHERE telefone IS NULL))::int AS pendentes
       FROM historico_os WHERE (ano * 12 + mes) BETWEEN $1 AND $2 GROUP BY mes, ano`,
    [chaveInicial, chaveAtual],
  );
  const porMes = new Map<number, { total: number; pendentes: number }>(rows.map((r: any) => [r.ano * 12 + r.mes, { total: r.total, pendentes: r.pendentes }]));

  const plano: MesBackfill[] = [];
  for (let i = 0; i < totalMeses; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mes = d.getMonth() + 1, ano = d.getFullYear();
    const dados = porMes.get(ano * 12 + mes) ?? { total: 0, pendentes: 0 };
    const precisa = dados.pendentes > Math.max(5, Math.round(dados.total * 0.05));
    plano.push({ mes, ano, ...dados, precisa, janelas: fatiarMesEmJanelas(mes, ano, hoje) });
  }
  return plano;
}

/** Número da O.S. -> telefone, para uma janela de datas de aprovação. */
export async function buscarTelefonesDaJanela(j: JanelaBackfill): Promise<Map<string, string>> {
  const { itens } = await listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial: j.di, datafinal: j.df });
  const mapa = new Map<string, string>();
  for (const os of itens) {
    const numero = String((os as any).sequencial_ordem ?? (os as any).id ?? "");
    const tel = primeiroTelefone(os);
    if (numero && tel) mapa.set(numero, tel);
  }
  return mapa;
}

/** Grava os telefones num único UPDATE; devolve quantas linhas foram alteradas. */
export async function gravarTelefones(mapa: Map<string, string>): Promise<number> {
  if (mapa.size === 0) return 0;
  const numeros = [...mapa.keys()];
  const telefones = numeros.map(n => mapa.get(n)!);
  const r = await getPool().query(
    `UPDATE historico_os h SET telefone = v.tel
       FROM unnest($1::text[], $2::text[]) AS v(os, tel)
      WHERE h."osNumero" = v.os AND h.telefone IS NULL`,
    [numeros, telefones],
  );
  return r.rowCount ?? 0;
}

export async function completarTelefonesJanela(j: JanelaBackfill): Promise<{ encontrados: number; atualizadas: number }> {
  const mapa = await buscarTelefonesDaJanela(j);
  const atualizadas = await gravarTelefones(mapa);
  return { encontrados: mapa.size, atualizadas };
}

/** Só aceita janelas curtas e recentes — a procedure é chamada do navegador. */
export function janelaValida(j: JanelaBackfill, hoje: Date = new Date()): boolean {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(j.di) || !re.test(j.df)) return false;
  const di = new Date(`${j.di}T00:00:00`), df = new Date(`${j.df}T00:00:00`);
  if (Number.isNaN(di.getTime()) || Number.isNaN(df.getTime()) || df < di) return false;
  const dias = (df.getTime() - di.getTime()) / 86_400_000;
  if (dias > JANELA_DIAS) return false;
  const limiteAntigo = new Date(hoje.getFullYear(), hoje.getMonth() - MESES_BACKFILL_PADRAO, 1);
  return di >= limiteAntigo && df <= new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
}
