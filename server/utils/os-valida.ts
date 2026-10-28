/** Filtra OS normais do banco local: exclui retrabalhos (tipoOs começa com 'Retrabalho'),
 * amostras, cortesias, canceladas e registros sem tipoOs (NULL = importação antiga sem custo).
 *
 * Fica num util puro (e não em routers/performanceComercial.ts) para que
 * services/probabilidadeCompra.ts use a MESMA regra de "compra válida" das estrelas
 * de cliente novo/reativado sem criar dependência circular — performanceComercial.ts
 * reexporta esta função, então os imports antigos continuam valendo. */
export function isOsNormalDb(os: { tipoOs?: string | null; status?: string | null }): boolean {
  if (os.tipoOs === null || os.tipoOs === undefined) return false;
  const tipo = (os.tipoOs ?? "").toLowerCase();
  const status = (os.status ?? "").toLowerCase();
  if (tipo.startsWith("retrabalho")) return false;
  if (tipo === "amostra") return false;
  if (tipo === "cortesia") return false;
  if (status === "cancelada") return false;
  return true;
}
