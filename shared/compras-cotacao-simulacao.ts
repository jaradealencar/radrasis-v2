import { calcularFreteCompra } from "./compras-frete";
import { calcularRateioFrete } from "./nf-frete";

export type ModoFreteCotacao = "valor_total" | "por_kg" | "gratis";

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
  pendencia: "peso" | "frete" | null;
  itens: Array<{
    rateioFrete: number;
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
}): SimulacaoCotacao {
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
    args.pesoTotalKg
  );
  const pendencia = calculoFrete.total != null
    ? null
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
      itens: [],
    };
  }

  const rateio = calcularRateioFrete({
    itens: args.itens.map((item, indice) => ({
      quantidade: item.quantidade,
      unidadeCompra: item.unidade,
      valorTotalItem: valoresItens[indice],
    })),
    modo: "valor_total",
    valor: calculoFrete.total,
    criterio: "valor",
  });
  const itens = args.itens.map((item, indice) => {
    const rateioFrete = rateio.itens[indice] ?? 0;
    const rateioIcms = arredondar4(
      (valoresItens[indice] + rateioFrete) * 0.1
    );
    const custoFinalTotal = arredondar4(
      valoresItens[indice] + rateioFrete + rateioIcms
    );
    return {
      rateioFrete,
      rateioIcms,
      custoFinalTotal,
      custoFinalUnitario: item.quantidade > 0
        ? Number((custoFinalTotal / item.quantidade).toFixed(6))
        : 0,
    };
  });
  const baseIcms = subtotalMercadoria + calculoFrete.total;
  const valorIcms = arredondar2(baseIcms * 0.1);

  return {
    subtotalMercadoria,
    valorFrete: calculoFrete.total,
    percentualIcms: 10,
    valorIcms,
    totalFinal: arredondar2(baseIcms + valorIcms),
    pendencia: null,
    itens,
  };
}
