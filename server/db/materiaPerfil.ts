import { and, eq, inArray } from "drizzle-orm";
import { materiaPrimaCadastros, materiaPrimaCategorias } from "../../drizzle/schema";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export const MENSAGEM_PERFIL_FORA_DO_NESTING =
  "Perfil não entra no nesting: o consumo vem do perímetro do desenho (prancha técnica), não de chapa ou bobina.";

/** Ids (entre os informados) de matérias-primas classificadas como perfil. Perfil nunca participa do nesting. */
export async function idsDeMateriasPerfil(db: Db, materiaPrimaIds: number[]): Promise<number[]> {
  const ids = Array.from(new Set(materiaPrimaIds));
  if (!ids.length) return [];
  const linhas = await db
    .select({ id: materiaPrimaCadastros.mubisysMateriaPrimaId })
    .from(materiaPrimaCadastros)
    .innerJoin(materiaPrimaCategorias, eq(materiaPrimaCategorias.id, materiaPrimaCadastros.categoriaId))
    .where(and(inArray(materiaPrimaCadastros.mubisysMateriaPrimaId, ids), eq(materiaPrimaCategorias.usaDadosPerfil, true)));
  return linhas.map(linha => linha.id);
}
