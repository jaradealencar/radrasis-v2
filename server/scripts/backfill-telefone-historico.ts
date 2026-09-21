/**
 * Preenche `historico_os.telefone` das O.S. antigas (coluna criada na migration 0037, ver
 * server/sync/telefone-historico.ts). Em produção o caminho normal é o botão "Completar
 * telefones" na aba Guia de Fornecedores; este script serve para rodar contra o banco do .env.
 * Idempotente — só grava onde telefone ainda é NULL.
 *
 * Uso:
 *   npx tsx server/scripts/backfill-telefone-historico.ts            # últimos 13 meses, grava
 *   npx tsx server/scripts/backfill-telefone-historico.ts --dry-run  # só mostra o que faria
 *   npx tsx server/scripts/backfill-telefone-historico.ts --meses=6  # janela menor
 */
import "dotenv/config";
import { getPool } from "../db/db-connection";
import {
  MESES_BACKFILL_PADRAO, planoBackfillTelefone, buscarTelefonesDaJanela, gravarTelefones,
} from "../sync/telefone-historico";

const pad = (n: number) => String(n).padStart(2, "0");

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const argMeses = args.find(a => a.startsWith("--meses="));
  const totalMeses = argMeses ? parseInt(argMeses.split("=")[1], 10) : MESES_BACKFILL_PADRAO;

  let totalCandidatas = 0, totalAtualizadas = 0, janelasComErro = 0;
  for (const m of await planoBackfillTelefone(totalMeses)) {
    if (!m.precisa) { console.log(`${pad(m.mes)}/${m.ano}: nada a fazer (${m.pendentes} sem telefone, resto normal), pulando`); continue; }
    totalCandidatas += m.pendentes;

    let encontrados = 0, atualizadas = 0;
    for (const j of m.janelas) {
      try {
        const mapa = await buscarTelefonesDaJanela(j);
        encontrados += mapa.size;
        if (!dryRun) atualizadas += await gravarTelefones(mapa);
      } catch (erro: any) {
        janelasComErro++;
        console.error(`  ${j.di}..${j.df}: ERRO (${erro?.message}) — rode de novo para retomar`);
      }
    }
    totalAtualizadas += atualizadas;
    console.log(`${pad(m.mes)}/${m.ano}: ${m.pendentes} OS sem telefone | ${encontrados} telefones na API | ${dryRun ? "(dry-run)" : `${atualizadas} linhas atualizadas`}`);
  }

  console.log(`\n${dryRun ? "[DRY RUN] " : ""}Total: ${totalCandidatas} OS sem telefone, ${totalAtualizadas} atualizadas, ${janelasComErro} janela(s) com erro.`);
  await getPool().end();
}

main().catch(erro => { console.error("Falha no backfill:", erro); process.exit(1); });
