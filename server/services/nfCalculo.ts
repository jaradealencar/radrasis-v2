// ─── CÁLCULO PURA — NF DE COMPRA × CUSTO CADASTRADO (MUBISYS) ───
// Zero dependência de I/O. Recebe dados brutos e devolve o cálculo pronto.
// Ideal para testar com vitest antes de conectar ao banco.

export type UnidadeCompra = "KG" | "UN" | "LT" | "ML" | "M2";
export type UnidadeErp = "ML" | "M2" | "UN" | "LT";

export interface ItemCalculoEntrada {
  descricao: string;
  quantidade: number;
  unidadeCompra: UnidadeCompra;
  valorUnitario: number;      // valor unitário da NF (sem rateio)
  valorTotalItem: number;     // valor total do item na NF (sem rateio)
  materiaPrimaId?: number;
  unidadeErp?: UnidadeErp;
  fatorConversao?: number;    // 1 unidade_compra = fator unidade_erp
  custoCadastrado?: number;   // custo atualmente cadastrado no Radrasys/Mubisys
  // Peso do item em kg — usado para ratear o frete por peso quando
  // `freteValorPorKg` é informado na entrada. Se ausente e unidadeCompra
  // for "KG", assume-se pesoKg = quantidade.
  pesoKg?: number;
}

export interface ItemCalculoSaida {
  descricao: string;
  quantidade: number;
  unidadeCompra: UnidadeCompra;
  valorTotalItem: number;
  rateioFrete: number;
  rateioIcms: number;
  custoItemTotal: number;
  custoPorUnidadeCompra: number;
  unidadeErp?: UnidadeErp;
  fatorConversao?: number;
  quantidadeErp?: number;     // quantidade convertida para unidade ERP
  custoRealErp: number;       // custo por unidade ERP (o que importa comparar)
  custoCadastrado?: number;
  divergenciaPct?: number;    // (real - cadastrado) / cadastrado × 100
  defasado: boolean;          // true se houver qualquer divergência != 0
}

/**
 * Calcula custo real por item de NF de compra e compara com custo cadastrado.
 *
 * Dois modos de rateio de frete, escolhidos pela entrada:
 *
 * 1) `freteValorPorKg` informado (ex: transportadora cobra R$/kg): o frete de
 *    cada item é `pesoKg (ou quantidade, se unidadeCompra="KG") × freteValorPorKg`.
 *    Este é o caso real de transporte rodoviário de chapa/perfil — o valor pago
 *    já é por kg transportado, não proporcional ao valor da mercadoria.
 * 2) Caso contrário, `valorFrete` total é rateado proporcional ao valor de cada
 *    item sobre o valor total da mercadoria (modo antigo, para fretes fixos
 *    sem base de peso).
 *
 * Fórmula do ICMS (conforme definido pelo usuário): por item,
 *   ICMS = (valor do item + frete do item) × percentualIcms / 100   (default 10%)
 * — não sobre a NF inteira, item a item, para não distorcer o rateio.
 *
 * - Custo real ERP = (custo item total / quantidade) ÷ fator de conversão
 * - Divergência = (custo real - custo cadastrado) / custo cadastrado × 100
 * - Defasado = verdadeiro se houver qualquer divergência diferente de zero
 *   (usuário quer ver defasagem a partir de 1%, inclusive abaixo disso)
 */
export function calcularNfCompra(
  entrada: {
    valorMercadoria: number;
    valorFrete: number;
    freteValorPorKg?: number; // ex: 2.21 — se informado, ignora rateio por valor
    percentualIcms?: number;
    itens: ItemCalculoEntrada[];
  }
): {
  baseNf: number;
  valorIcms: number;
  custoTotalNf: number;
  itens: ItemCalculoSaida[];
} {
  const { valorMercadoria, valorFrete, itens } = entrada;
  const percentualIcms = entrada.percentualIcms ?? 10;
  const freteValorPorKg = entrada.freteValorPorKg;

  const baseNf = valorMercadoria + valorFrete;
  const valorIcms = baseNf * (percentualIcms / 100);
  const custoTotalNf = baseNf + valorIcms;

  const totalValorItens = itens.reduce((sum, i) => sum + i.valorTotalItem, 0);

  const itensCalculados: ItemCalculoSaida[] = itens.map((item) => {
    let rateioFrete: number;

    if (freteValorPorKg && freteValorPorKg > 0) {
      // Rateio por peso: usa pesoKg explícito, ou a própria quantidade quando
      // a unidade de compra já é KG.
      const pesoKg = item.pesoKg ?? (item.unidadeCompra === "KG" ? item.quantidade : 0);
      rateioFrete = pesoKg * freteValorPorKg;
    } else {
      const proporcao = totalValorItens > 0 ? item.valorTotalItem / totalValorItens : 0;
      rateioFrete = valorFrete * proporcao;
    }

    // ICMS item a item: (valor do item + frete do item) × percentual
    const rateioIcms = (item.valorTotalItem + rateioFrete) * (percentualIcms / 100);
    const custoItemTotal = item.valorTotalItem + rateioFrete + rateioIcms;

    const custoPorUnidadeCompra = item.quantidade > 0 ? custoItemTotal / item.quantidade : 0;

    let unidadeErp: UnidadeErp | undefined;
    let fatorConversao: number | undefined;
    let quantidadeErp: number | undefined;
    let custoRealErp = 0;

    if (item.fatorConversao && item.fatorConversao > 0) {
      unidadeErp = item.unidadeErp;
      fatorConversao = item.fatorConversao;
      quantidadeErp = item.quantidade * fatorConversao;
      custoRealErp = quantidadeErp > 0 ? custoItemTotal / quantidadeErp : 0;
    } else {
      // Sem conversão: custo real = custo por unidade de compra
      custoRealErp = custoPorUnidadeCompra;
    }

    let divergenciaPct: number | undefined;
    let defasado = false;

    if (item.custoCadastrado && item.custoCadastrado > 0) {
      const rawDivergencia = ((custoRealErp - item.custoCadastrado) / item.custoCadastrado) * 100;
      divergenciaPct = Number(rawDivergencia.toFixed(2));
      // Qualquer diferença diferente de zero (além do arredondamento de 2 casas) é defasada
      defasado = Math.abs(divergenciaPct) > 0.005;
    }

    return {
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidadeCompra: item.unidadeCompra,
      valorTotalItem: item.valorTotalItem,
      rateioFrete: Number(rateioFrete.toFixed(4)),
      rateioIcms: Number(rateioIcms.toFixed(4)),
      custoItemTotal: Number(custoItemTotal.toFixed(4)),
      custoPorUnidadeCompra: Number(custoPorUnidadeCompra.toFixed(4)),
      unidadeErp,
      fatorConversao,
      quantidadeErp: quantidadeErp ? Number(quantidadeErp.toFixed(4)) : undefined,
      custoRealErp: Number(custoRealErp.toFixed(4)),
      custoCadastrado: item.custoCadastrado,
      divergenciaPct: divergenciaPct ? Number(divergenciaPct.toFixed(2)) : undefined,
      defasado,
    };
  });

  return {
    baseNf: Number(baseNf.toFixed(2)),
    valorIcms: Number(valorIcms.toFixed(2)),
    custoTotalNf: Number(custoTotalNf.toFixed(2)),
    itens: itensCalculados,
  };
}
