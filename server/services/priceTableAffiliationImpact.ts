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

export type AfiliacaoProdutoModelos = Map<number, Set<number> | null>;

/** Filtra vendas pelo produto afiliado e, quando definido, pelos modelos escolhidos. */
export function filtrarVendasPorModelosAfiliados<T extends VendaComIdsMubiSys>(
  vendas: T[],
  produtosAfiliados: AfiliacaoProdutoModelos,
  produtoPorVariacao: Map<number, number>,
  produtoPorModelo: Map<number, number>,
  modeloPorVariacao: Map<number, number>,
): T[] {
  if (produtosAfiliados.size === 0) return [];
  return vendas.filter(venda => {
    const produtoId = venda.produtoId
      ?? (venda.variacaoId == null ? undefined : produtoPorVariacao.get(venda.variacaoId))
      ?? (venda.modeloId == null ? undefined : produtoPorModelo.get(venda.modeloId));
    if (produtoId == null || !produtosAfiliados.has(produtoId)) return false;
    const modelosSelecionados = produtosAfiliados.get(produtoId);
    if (modelosSelecionados == null) return true;
    const modeloId = venda.modeloId
      ?? (venda.variacaoId == null ? undefined : modeloPorVariacao.get(venda.variacaoId));
    return modeloId != null && modelosSelecionados.has(modeloId);
  });
}
