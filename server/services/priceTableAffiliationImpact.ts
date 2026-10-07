export type VendaComIdsMubiSys = { produtoId: number | null; modeloId: number | null; variacaoId: number | null };

/** Resolve a venda somente por IDs do ERP e do espelho local, nunca pela descri??o. */
export function filtrarVendasPorProdutosAfiliados<T extends VendaComIdsMubiSys>(
  vendas: T[],
  produtosAfiliados: Set<number>,
  produtoPorVariacao: Map<number, number>,
  produtoPorModelo: Map<number, number>,
): T[] {
  if (produtosAfiliados.size === 0) return [];
  return vendas.filter(venda => {
    const produtoId = venda.produtoId
      ?? (venda.variacaoId == null ? undefined : produtoPorVariacao.get(venda.variacaoId))
      ?? (venda.modeloId == null ? undefined : produtoPorModelo.get(venda.modeloId));
    return produtoId != null && produtosAfiliados.has(produtoId);
  });
}
