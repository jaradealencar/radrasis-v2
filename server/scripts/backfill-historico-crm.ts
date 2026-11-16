/**
 * Recarrega os históricos de O.S. e orçamentos desde o início da cobertura do
 * MubiSys. Popula `historico_os.clienteId` e completa a série de orçamentos.
 *
 * A operação só grava quando recebe `--gravar` e a confirmação explícita do
 * alvo (`--confirmo-alvo=host/banco`). O upsert preserva telefone já salvo se
 * a API não devolver um número nessa linha.
 *
 * Uso:
 *   npx tsx server/scripts/backfill-historico-crm.ts --gravar --confirmo-alvo=host/banco
 *   npx tsx server/scripts/backfill-historico-crm.ts --desde=2025-01 --ate=2025-06 --gravar --confirmo-alvo=host/banco
 */
import "dotenv/config";
import { getPool, safeErrorType } from "../db/db-connection";
import { confirmarAlvo, DESDE_PADRAO, mesesDoIntervalo } from "../sync/backfill-historico-orcamentos";
import { sincronizarHistoricoDoMubiSys } from "../sync/scheduled-sync-historico";

const pad = (n: number) => String(n).padStart(2, "0");
const arg = (nome: string) => process.argv.slice(2).find(a => a.startsWith(`--${nome}=`))?.split("=").slice(1).join("=");

async function main() {
  if (!process.argv.includes("--gravar")) {
    throw new Error("Este backfill altera os históricos. Para gravar, informe --gravar e --confirmo-alvo=host/banco.");
  }

  const hoje = new Date();
  const atePadrao = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`;
  const meses = mesesDoIntervalo(arg("desde") ?? DESDE_PADRAO, arg("ate") ?? atePadrao);
  const alvo = confirmarAlvo(process.env.DATABASE_URL, arg("confirmo-alvo"));
  console.log(`GRAVANDO em ${alvo} | ${meses.length} mês(es): ${pad(meses[0].mes)}/${meses[0].ano} a ${pad(meses.at(-1)!.mes)}/${meses.at(-1)!.ano}`);

  let osProcessadas = 0;
  let orcamentosProcessados = 0;
  let mesesIncompletos = 0;

  for (const { mes, ano } of meses) {
    const resultado = await sincronizarHistoricoDoMubiSys(mes, ano);
    osProcessadas += resultado.osProcessadas;
    orcamentosProcessados += resultado.orcamentosProcessados;
    if (resultado.status !== "SUCESSO" || resultado.completo === false) mesesIncompletos++;
    console.log(
      `${pad(mes)}/${ano}: ${resultado.osProcessadas} O.S. | ${resultado.orcamentosProcessados} orçamentos` +
      (resultado.completo === false ? " | INCOMPLETO — rode novamente para refazer janelas faltantes" : ""),
    );
  }

  console.log(`\nTotal: ${osProcessadas} O.S., ${orcamentosProcessados} orçamentos, ${mesesIncompletos} mês(es) incompleto(s).`);
  await getPool().end();
  if (mesesIncompletos > 0) process.exit(2);
}

main().catch(async erro => {
  console.error("Falha no backfill do histórico do CRM:", safeErrorType(erro));
  try { await getPool().end(); } catch { /* a conexão pode não ter sido aberta */ }
  process.exit(1);
});
