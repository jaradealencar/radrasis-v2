import { inArray } from "drizzle-orm";
import { BOBINA_CUSTO_BASES, type BobinaCustoBase, type BobinaCustoConfig } from "../../shared/bobina";
import { materiaPrimaCadastros } from "../../drizzle/schema";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Base de cobrança do custo das bobinas (cadastro local), por id de matéria-prima do MubiSys. */
export async function carregarCustoBobina(db: Db, materiaPrimaIds: number[]): Promise<Map<number, BobinaCustoConfig>> {
  const resultado = new Map<number, BobinaCustoConfig>();
  if (!materiaPrimaIds.length) return resultado;
  const linhas = await db
    .select({
      id: materiaPrimaCadastros.mubisysMateriaPrimaId,
      base: materiaPrimaCadastros.bobinaCustoBase,
      comprimentoRoloMm: materiaPrimaCadastros.bobinaComprimentoRoloMm,
    })
    .from(materiaPrimaCadastros)
    .where(inArray(materiaPrimaCadastros.mubisysMateriaPrimaId, materiaPrimaIds));
  for (const linha of linhas) {
    if (!linha.base || !(BOBINA_CUSTO_BASES as readonly string[]).includes(linha.base)) continue;
    resultado.set(linha.id, {
      base: linha.base as BobinaCustoBase,
      comprimentoRoloMm: linha.comprimentoRoloMm == null ? null : Number(linha.comprimentoRoloMm),
    });
  }
  return resultado;
}
