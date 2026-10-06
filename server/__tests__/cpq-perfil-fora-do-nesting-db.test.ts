import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { materiaPrimaCadastros, materiaPrimaCategorias } from "../../drizzle/schema";
import { getDb } from "../db/db";
import { idsDeMateriasPerfil } from "../db/materiaPerfil";

/** Ids fictícios (fora do MubiSys) e categorias de teste; tudo é removido no final. */
const ID_PERFIL = 987_654_411;
const ID_CHAPA = 987_654_412;
const ID_SEM_CATEGORIA = 987_654_413;
const IDS = [ID_PERFIL, ID_CHAPA, ID_SEM_CATEGORIA];
const NOME_PERFIL = "ZZ teste perfil fora do nesting";
const NOME_CHAPA = "ZZ teste chapa no nesting";

describe("perfil nunca entra no nesting (regra do negócio)", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível para o teste");
    await db.delete(materiaPrimaCadastros).where(inArray(materiaPrimaCadastros.mubisysMateriaPrimaId, IDS));
    await db.delete(materiaPrimaCategorias).where(inArray(materiaPrimaCategorias.nome, [NOME_PERFIL, NOME_CHAPA]));
    const [perfil] = await db.insert(materiaPrimaCategorias).values({ nome: NOME_PERFIL, usaDadosPerfil: true }).returning();
    const [chapa] = await db.insert(materiaPrimaCategorias).values({ nome: NOME_CHAPA, usaDadosChapa: true }).returning();
    await db.insert(materiaPrimaCadastros).values([
      { mubisysMateriaPrimaId: ID_PERFIL, categoriaId: perfil.id },
      { mubisysMateriaPrimaId: ID_CHAPA, categoriaId: chapa.id },
      { mubisysMateriaPrimaId: ID_SEM_CATEGORIA },
    ]);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(materiaPrimaCadastros).where(inArray(materiaPrimaCadastros.mubisysMateriaPrimaId, IDS));
    await db.delete(materiaPrimaCategorias).where(inArray(materiaPrimaCategorias.nome, [NOME_PERFIL, NOME_CHAPA]));
  });

  it("identifica só as matérias-primas de categoria perfil", async () => {
    const db = await getDb();
    expect(await idsDeMateriasPerfil(db!, [ID_PERFIL, ID_CHAPA, ID_SEM_CATEGORIA, 987_654_499])).toEqual([ID_PERFIL]);
    expect(await idsDeMateriasPerfil(db!, [ID_CHAPA, ID_SEM_CATEGORIA])).toEqual([]);
    expect(await idsDeMateriasPerfil(db!, [])).toEqual([]);
  });

  it("ids repetidos não duplicam o resultado", async () => {
    const db = await getDb();
    expect(await idsDeMateriasPerfil(db!, [ID_PERFIL, ID_PERFIL])).toEqual([ID_PERFIL]);
    const [linha] = await db!.select().from(materiaPrimaCadastros).where(eq(materiaPrimaCadastros.mubisysMateriaPrimaId, ID_PERFIL));
    expect(linha.categoriaId).not.toBeNull();
  });
});
