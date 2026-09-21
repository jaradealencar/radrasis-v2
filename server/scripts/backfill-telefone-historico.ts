/**
 * Backfill do telefone em `historico_os` (coluna adicionada na migration 0037/2026-09-21
 * junto com o Guia de Fornecedores — ver server/routers/guiaFornecedores.ts).
 *
 * `scheduled-sync-historico.ts` só grava telefone dali pra frente (mês corrente + anterior,
 * a cada rodada do cron); OS mais antigas já gravadas no banco ficam com telefone NULL até
 * este script rodar uma vez. Sem isso, o Guia de Fornecedores ficaria sem WhatsApp para
 * qualquer cliente cuja última compra válida caiu fora da janela de 2 meses que o cron toca.
 *
 * Busca só as OS (não orçamentos) em janelas de 7 dias, em paralelo — medido em 19-21/09/2026:
 * um mês inteiro de OS fecha em ~3-4s desse jeito (bem mais rápido que os ~26s/janela de
 * 2 dias que scheduled-sync-historico.ts usa para OS+orçamentos juntos), então cabe tranquilo
 * no maxDuration de uma execução manual. Roda uma vez (ou toda vez que quiser reforçar
 * meses fora da janela do cron); é idempotente — só atualiza onde telefone ainda é NULL.
 *
 * Uso:
 *   npx tsx server/scripts/backfill-telefone-historico.ts            # últimos 13 meses, grava
 *   npx tsx server/scripts/backfill-telefone-historico.ts --dry-run  # só mostra o que faria
 *   npx tsx server/scripts/backfill-telefone-historico.ts --meses=6  # janela menor
 */
import "dotenv/config";
import { getPool } from "../db/db-connection";
import { listarOSMubiSys } from "../integrations/mubisys-client";

const pad = (n: number) => String(n).padStart(2, "0");
const JANELA_DIAS = 7;

function primeiroTelefone(os: any): string {
  const contatos: any[] = Array.isArray(os?.cliente_contato) ? os.cliente_contato : [];
  const numeroDe = (c: any) => c?.celular || c?.telefone || c?.fone || "";
  const ativo = (c: any) => String(c?.status ?? "").toLowerCase() !== "inativo";
  const escolhido = contatos.find(c => numeroDe(c) && ativo(c)) ?? contatos.find(c => numeroDe(c));
  return numeroDe(escolhido);
}

function fatiarMesEmJanelas(mes: number, ano: number): Array<{ di: string; df: string }> {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const hoje = new Date();
  const fimMes = (ano === hoje.getFullYear() && mes === hoje.getMonth() + 1) ? hoje.getDate() : ultimoDia;
  const janelas: Array<{ di: string; df: string }> = [];
  for (let dia = 1; dia <= fimMes; dia += JANELA_DIAS) {
    const fim = Math.min(dia + JANELA_DIAS - 1, fimMes);
    janelas.push({ di: `${ano}-${pad(mes)}-${pad(dia)}`, df: `${ano}-${pad(mes)}-${pad(fim)}` });
  }
  return janelas;
}

async function buscarTelefonesDoMes(mes: number, ano: number): Promise<Map<string, string>> {
  const janelas = fatiarMesEmJanelas(mes, ano);
  const resultados = await Promise.all(janelas.map(j =>
    listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial: j.di, datafinal: j.df })
  ));
  const mapa = new Map<string, string>();
  for (const r of resultados) {
    for (const os of r.itens) {
      const numero = String((os as any).sequencial_ordem ?? (os as any).id ?? "");
      const tel = primeiroTelefone(os);
      if (numero && tel) mapa.set(numero, tel);
    }
  }
  return mapa;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const argMeses = args.find(a => a.startsWith("--meses="));
  const totalMeses = argMeses ? parseInt(argMeses.split("=")[1], 10) : 13;

  const pool = getPool();
  const hoje = new Date();
  let totalAtualizadas = 0;
  let totalCandidatas = 0;

  for (let i = 0; i < totalMeses; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mes = d.getMonth() + 1, ano = d.getFullYear();

    const { rows: pendentes } = await pool.query(
      `SELECT count(*)::int AS n FROM historico_os WHERE mes = $1 AND ano = $2 AND telefone IS NULL`,
      [mes, ano]
    );
    const qtdPendente = pendentes[0]?.n ?? 0;
    totalCandidatas += qtdPendente;
    if (qtdPendente === 0) {
      console.log(`${pad(mes)}/${ano}: nada pendente, pulando`);
      continue;
    }

    const t0 = Date.now();
    let telefonesPorOs: Map<string, string>;
    try {
      telefonesPorOs = await buscarTelefonesDoMes(mes, ano);
    } catch (erro: any) {
      console.error(`${pad(mes)}/${ano}: ERRO ao buscar da API (${erro?.message}) — pulando este mês`);
      continue;
    }
    console.log(`${pad(mes)}/${ano}: ${qtdPendente} OS sem telefone no banco | ${telefonesPorOs.size} telefones encontrados na API em ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    if (dryRun) continue;

    let atualizadasNoMes = 0;
    for (const [osNumero, telefone] of telefonesPorOs) {
      const r = await pool.query(
        `UPDATE historico_os SET telefone = $1 WHERE "osNumero" = $2 AND telefone IS NULL`,
        [telefone, osNumero]
      );
      atualizadasNoMes += r.rowCount ?? 0;
    }
    totalAtualizadas += atualizadasNoMes;
    console.log(`${pad(mes)}/${ano}: ${atualizadasNoMes} linhas atualizadas`);
  }

  console.log(`\n${dryRun ? "[DRY RUN] " : ""}Total: ${totalCandidatas} OS estavam sem telefone, ${totalAtualizadas} foram atualizadas.`);
  await pool.end();
}

main().catch(erro => { console.error("Falha no backfill:", erro); process.exit(1); });
