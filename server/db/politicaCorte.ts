import { inArray } from "drizzle-orm";
import { materiaPrimaCadastros } from "../../drizzle/schema";
import { resolverPoliticaCorte, type PoliticaCorteResolvida } from "../../shared/politica-corte";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * Política de corte (processo, rotação permitida, espaçamento e margem) de cada matéria-prima, já resolvida: o valor próprio do
 * cadastro vale mais que o padrão do processo, que vale mais que o padrão do orçamento. Matéria-prima sem cadastro (ou sem
 * política) recebe exatamente o padrão do orçamento e rotação livre, como antes.
 */
export async function carregarPoliticaCorte(
  db: Db,
  materiaPrimaIds: number[],
  padraoOrcamento: { espacamentoMm: number; margemBordaMm: number },
): Promise<Map<number, PoliticaCorteResolvida>> {
  const ids = Array.from(new Set(materiaPrimaIds));
  const linhas = ids.length
    ? await db
        .select({
          id: materiaPrimaCadastros.mubisysMateriaPrimaId,
          processoCorte: materiaPrimaCadastros.processoCorte,
          rotacaoPermitida: materiaPrimaCadastros.rotacaoPermitida,
          espacamentoMm: materiaPrimaCadastros.espacamentoMm,
          margemBordaMm: materiaPrimaCadastros.margemBordaMm,
        })
        .from(materiaPrimaCadastros)
        .where(inArray(materiaPrimaCadastros.mubisysMateriaPrimaId, ids))
    : [];
  const porId = new Map(linhas.map(linha => [linha.id, linha]));
  return new Map(ids.map(id => {
    const linha = porId.get(id);
    return [id, resolverPoliticaCorte(linha ? {
      processoCorte: linha.processoCorte,
      rotacaoPermitida: linha.rotacaoPermitida,
      espacamentoMm: linha.espacamentoMm == null ? null : Number(linha.espacamentoMm),
      margemBordaMm: linha.margemBordaMm == null ? null : Number(linha.margemBordaMm),
    } : null, padraoOrcamento)];
  }));
}
