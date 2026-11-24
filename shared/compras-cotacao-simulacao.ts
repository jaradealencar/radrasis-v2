import { calcularFreteCompra } from "./compras-frete";
import { calcularRateioFrete } from "./nf-frete";

export type ModoFreteCotacao = "valor_total" | "por_kg" | "gratis" | "cif";

export type ItemSimulacaoCotacaoEntrada = {
  quantidade: number;
  unidade: string;
  precoUnitario: number;
};

export type SimulacaoCotacao = {
  subtotalMercadoria: number;
  valorFrete: number | null;
  percentualIcms: 10;
  valorIcms: number | null;
  totalFinal: number | null;
  pendencia: "peso" | "frete" | "cif" | null;
  rateioFreteEstimado: boolean;
  diferencaPesoKg: number | null;
  itens: Array<{
    rateioFrete: number;
    rateioDesconto: number;
    rateioIcms: number;
    custoFinalTotal: number;
    custoFinalUnitario: number;
  }>;
};

const arredondar2 = (valor: number) => Number(valor.toFixed(2));
const arredondar4 = (valor: number) => Number(valor.toFixed(4));

/**
 * Simula o custo final da cotação com a mesma base de ICMS da auditoria de NF:
 * (mercadoria + frete) + 10% de ICMS sobre essa base.
 * Quando só há peso total, distribui o frete entre os itens pelo valor cotado.
 */
export function simularCustoFinalCotacao(args: {
  itens: ItemSimulacaoCotacaoEntrada[];
  freteModo: ModoFreteCotacao;
  valorFreteInformado: number | null;
  pesoTotalKg: number | null;
  descontoTotal?: number;
}): SimulacaoCotacao {
  const itensTodosKg = args.itens.length > 0 && args.itens.every(item =>
    ["KG", "KGS", "KGM"].includes(String(item.unidade).trim().toUpperCase())
  );
  const pesoItensKg = itensTodosKg
    ? args.itens.reduce((total, item) => total + Math.max(0, Number(item.quantidade) || 0), 0)
    : null;
  const valoresItens = args.itens.map(item => {
    const quantidade = Number(item.quantidade);
    const precoUnitario = Number(item.precoUnitario);
    return Number.isFinite(quantidade) && quantidade > 0 &&
      Number.isFinite(precoUnitario) && precoUnitario >= 0
      ? arredondar2(quantidade * precoUnitario)
      : 0;
  });
  const subtotalMercadoria = arredondar2(
    valoresItens.reduce((soma, valor) => soma + valor, 0)
  );
  const calculoFrete = calcularFreteCompra(
    args.freteModo,
    args.valorFreteInformado,
    args.freteModo === "por_kg" && itensTodosKg ? pesoItensKg : args.pesoTotalKg
  );
  const pendencia = calculoFrete.total != null
    ? null
    : args.freteModo === "cif"
      ? "cif"
      : args.freteModo === "por_kg" &&
        !(args.pesoTotalKg != null && Number.isFinite(args.pesoTotalKg) && args.pesoTotalKg > 0)
      ? "peso"
      : "frete";

  if (calculoFrete.total == null) {
    return {
      subtotalMercadoria,
      valorFrete: null,
      percentualIcms: 10,
      valorIcms: null,
      totalFinal: null,
      pendencia,
      rateioFreteEstimado: args.freteModo === "por_kg" && !itensTodosKg,
      diferencaPesoKg: null,
      itens: [],
    };
  }

  const rateio = calcularRateioFrete({
    itens: args.itens.map((item, indice) => ({
      quantidade: item.quantidade,
      unidadeCompra: item.unidade,
      valorTotalItem: valoresItens[indice],
    })),
    modo: args.freteModo === "por_kg" && itensTodosKg ? "por_kg" : "valor_total",
    valor: args.freteModo === "por_kg" && itensTodosKg
      ? Number(args.valorFreteInformado ?? 0)
      : calculoFrete.total,
    criterio: "valor",
  });
  const descontoTotal = Math.min(
    Math.max(0, Number(args.descontoTotal ?? 0)),
    subtotalMercadoria + calculoFrete.total
  );
  const rateioDesconto = calcularRateioFrete({
    itens: args.itens.map((item, indice) => ({
      quantidade: item.quantidade,
      unidadeCompra: item.unidade,
      valorTotalItem: valoresItens[indice] + (rateio.itens[indice] ?? 0),
    })),
    modo: "valor_total",
    valor: descontoTotal,
    criterio: "valor",
  });
  const itens = args.itens.map((item, indice) => {
    const rateioFrete = rateio.itens[indice] ?? 0;
    const descontoItem = rateioDesconto.itens[indice] ?? 0;
    const rateioIcms = arredondar4(
      Math.max(0, valoresItens[indice] + rateioFrete - descontoItem) * 0.1
    );
    const custoFinalTotal = arredondar4(
      Math.max(0, valoresItens[indice] + rateioFrete - descontoItem) + rateioIcms
    );
    return {
      rateioFrete,
      rateioDesconto: descontoItem,
      rateioIcms,
      custoFinalTotal,
      custoFinalUnitario: item.quantidade > 0
        ? Number((custoFinalTotal / item.quantidade).toFixed(6))
        : 0,
    };
  });
  const baseIcms = subtotalMercadoria + calculoFrete.total - descontoTotal;
  const valorIcms = arredondar2(baseIcms * 0.1);

  return {
    subtotalMercadoria,
    valorFrete: calculoFrete.total,
    percentualIcms: 10,
    valorIcms,
    totalFinal: arredondar2(baseIcms + valorIcms),
    pendencia: null,
    rateioFreteEstimado: args.freteModo === "por_kg" && !itensTodosKg,
    diferencaPesoKg: itensTodosKg && args.pesoTotalKg != null && pesoItensKg != null
      ? Number((Number(args.pesoTotalKg) - pesoItensKg).toFixed(3))
      : null,
    itens,
  };
}
