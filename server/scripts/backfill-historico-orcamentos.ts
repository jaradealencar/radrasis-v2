/**
 * Carrega em `historico_orcamentos` os orçamentos antigos do MubiSys (padrão: 03/2023 a 12/2025), para a
 * taxa de conversão e a contagem de cotações por cliente olharem todo o histórico e não só 2026.
 * Só orçamentos: `historico_os` não é tocada. Idempotente (upsert por orcNumero) e retomável.
 *
 * Por padrão SÓ SIMULA: lê a API do ERP e conta, sem gravar. Para gravar é preciso `--gravar` e
 * `--confirmo-alvo=host/banco` igual ao do DATABASE_URL em uso (o script imprime o alvo).
 *
 * Uso (o DATABASE_URL vem do ambiente; nunca é impresso):
 *   npx tsx server/scripts/backfill-historico-orcamentos.ts                       # simula 2023-03..2025-12
 *   npx tsx server/scripts/backfill-historico-orcamentos.ts --desde=2024-01 --ate=2024-03
 *   npx tsx server/scripts/backfill-historico-orcamentos.ts --gravar --confirmo-alvo=host/banco
 *
 * Gravar em produção exige autorização explícita (ver AGENTS.md).
 */
import "dotenv/config";
import { getPool } from "../db/db-connection";
import { sincronizarSoOrcamentosDoMubiSys } from "../sync/scheduled-sync-historico";
import { DESDE_PADRAO, confirmarAlvo, identificarAlvo, mesesDoIntervalo } from "../sync/backfill-historico-orcamentos";

const pad = (n: number) => String(n).padStart(2, "0");
const arg = (nome: string) => process.argv.slice(2).find(a => a.startsWith(`--${nome}=`))?.split("=").slice(1).join("=");

async function main() {
  const gravar = process.argv.includes("--gravar");
  const meses = mesesDoIntervalo(arg("desde") ?? DESDE_PADRAO, arg("ate") ?? "2025-12");

  const alvo = gravar ? confirmarAlvo(process.env.DATABASE_URL, arg("confirmo-alvo")) : identificarAlvo(process.env.DATABASE_URL);
  console.log(`${gravar ? "GRAVANDO" : "SIMULAÇÃO (nada é gravado)"} em ${alvo} | ${meses.length} mês(es): ${pad(meses[0].mes)}/${meses[0].ano} a ${pad(meses.at(-1)!.mes)}/${meses.at(-1)!.ano}`);

  let encontrados = 0, jaExistiam = 0, gravados = 0, comProblema = 0;
  for (const { mes, ano } of meses) {
    const r = await sincronizarSoOrcamentosDoMubiSys(mes, ano, { gravar });
    encontrados += r.encontrados;
    jaExistiam += r.jaExistiam ?? 0;
    gravados += r.gravados;
    const problema = !r.completo || r.janelasFalhadas.length > 0;
    if (problema) comProblema++;
    console.log(
      `${pad(mes)}/${ano}: ${String(r.encontrados).padStart(4)} orçamentos | ${r.jaExistiam ?? "?"} já no banco | ` +
      `${gravar ? `${r.gravados} gravados` : "simulado"}` +
      (r.completo ? "" : " | INCOMPLETO (teto de páginas)") +
      (r.janelasFalhadas.length ? ` | ${r.janelasFalhadas.length} janela(s) falharam: ${r.janelasFalhadas.join(", ")}` : ""),
    );
  }

  console.log(`\nTotal: ${encontrados} orçamentos na API, ${jaExistiam} já existiam, ${gravar ? `${gravados} gravados` : "nada gravado (simulação)"}, ${comProblema} mês(es) com problema.`);
  await getPool().end();
  if (comProblema > 0) { console.error("Há meses incompletos: rode de novo (é idempotente) para refazer só o que faltou."); process.exit(2); }
}

main().catch(erro => { console.error("Falha no backfill:", erro?.message ?? erro); process.exit(1); });
