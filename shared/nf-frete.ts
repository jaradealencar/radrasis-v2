export type ModoFreteNf = "gratis" | "por_kg" | "valor_total";
export type CriterioRateioFrete = "peso" | "quantidade" | "valor";
export type BaseValorRateioFrete = "valor_total" | "valor_total_ipi";

export interface ItemRateioFrete {
  quantidade: number;
  unidadeCompra: string;
  valorTotalItem: number;
  valorIpi?: number | null;
  /** Peso total da linha em kg, quando informado para uma unidade que não seja KG. */
  pesoKg?: number | null;
}

export interface ResultadoRateioFrete {
  itens: number[];
  totalRateado: number;
  criterioAplicado: CriterioRateioFrete | "por_kg" | "nenhum";
  usouFallbackFinanceiro: boolean;
}

const limitar = (valor: number | null | undefined) =>
  typeof valor === "number" && Number.isFinite(valor) ? Math.max(0, valor) : 0;

const arredondar4 = (valor: number) => Number(valor.toFixed(4));

function distribuirTotal(total: number, bases: number[]): number[] {
  if (!bases.length) return [];
  const somaBases = bases.reduce((soma, valor) => soma + limitar(valor), 0);
  const pesos = somaBases > 0 ? bases.map(limitar) : bases.map(() => 1);
  const somaPesos = pesos.reduce((soma, valor) => soma + valor, 0);
  const resultado = Array(bases.length).fill(0) as number[];
  let restante = arredondar4(total);
  const ultimoElegivel = pesos.reduce((ultimo, peso, indice) => peso > 0 ? indice : ultimo, -1);

  if (ultimoElegivel < 0) return resultado;
  for (let indice = 0; indice < pesos.length; indice += 1) {
    if (pesos[indice] <= 0) continue;
    const parcela = indice === ultimoElegivel
      ? restante
      : arredondar4(total * pesos[indice] / somaPesos);
    resultado[indice] = parcela;
    restante = arredondar4(restante - parcela);
  }
  return resultado;
}

/** Rateia o frete de forma idêntica no preview do client e no cálculo do servidor. */
export function calcularRateioFrete(args: {
  itens: ItemRateioFrete[];
  modo: ModoFreteNf;
  valor: number;
  criterio?: CriterioRateioFrete;
  baseValor?: BaseValorRateioFrete;
}): ResultadoRateioFrete {
  const { itens, modo } = args;
  const valor = limitar(args.valor);
  if (modo === "gratis" || itens.length === 0 || valor === 0) {
    return {
      itens: itens.map(() => 0),
      totalRateado: 0,
      criterioAplicado: modo === "por_kg" ? "por_kg" : "nenhum",
      usouFallbackFinanceiro: false,
    };
  }

  if (modo === "por_kg") {
    const rateios = itens.map((item) => {
      const unidade = item.unidadeCompra.trim().toUpperCase();
      const pesoKg = unidade === "KG" ? limitar(item.quantidade) : limitar(item.pesoKg);
      return arredondar4(pesoKg * valor);
    });
    return {
      itens: rateios,
      totalRateado: arredondar4(rateios.reduce((soma, rateio) => soma + rateio, 0)),
      criterioAplicado: "por_kg",
      usouFallbackFinanceiro: false,
    };
  }

  const criterio = args.criterio ?? "valor";
  const baseValor = args.baseValor ?? "valor_total";
  if (criterio === "peso") {
    const pesos = itens.map((item) =>
      item.unidadeCompra.trim().toUpperCase() === "KG"
        ? limitar(item.quantidade)
        : limitar(item.pesoKg)
    );
    if (pesos.some((peso) => peso > 0)) {
      const rateios = distribuirTotal(valor, pesos);
      return {
        itens: rateios,
        totalRateado: arredondar4(rateios.reduce((soma, rateio) => soma + rateio, 0)),
        criterioAplicado: "peso",
        usouFallbackFinanceiro: false,
      };
    }
    const valores = itens.map((item) => limitar(item.valorTotalItem));
    const rateios = distribuirTotal(valor, valores);
    return {
      itens: rateios,
      totalRateado: arredondar4(rateios.reduce((soma, rateio) => soma + rateio, 0)),
      criterioAplicado: "valor",
      usouFallbackFinanceiro: true,
    };
  }

  const bases = criterio === "quantidade"
    ? itens.map((item) => limitar(item.quantidade))
    : itens.map((item) => limitar(item.valorTotalItem) +
        (baseValor === "valor_total_ipi" ? limitar(item.valorIpi) : 0));
  const rateios = distribuirTotal(valor, bases);
  return {
    itens: rateios,
    totalRateado: arredondar4(rateios.reduce((soma, rateio) => soma + rateio, 0)),
    criterioAplicado: criterio,
    usouFallbackFinanceiro: false,
  };
}
