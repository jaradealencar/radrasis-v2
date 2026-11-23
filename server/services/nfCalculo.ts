// ─── CÁLCULO PURA — NF DE COMPRA × CUSTO CADASTRADO (MUBISYS) ───
// Zero dependência de I/O. Recebe dados brutos e devolve o cálculo pronto.
// Ideal para testar com vitest antes de conectar ao banco.

import { calcularRateioFrete, type BaseValorRateioFrete, type CriterioRateioFrete, type ModoFreteNf } from "../../shared/nf-frete";

export type UnidadeCompra = "KG" | "UN" | "LT" | "ML" | "M2";
export type UnidadeErp = "ML" | "M2" | "UN" | "LT";

export interface ItemCalculoEntrada {
  descricao: string;
  quantidade: number;
  unidadeCompra: UnidadeCompra;
  valorUnitario: number;      // valor unitário da NF (sem rateio)
  valorTotalItem: number;     // valor total do item na NF (sem rateio)
  valorIpi?: number;
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
 * O rateio compartilhado aceita frete grátis, valor por KG ou total da NF.
 * No total, distribui por peso, quantidade ou valor financeiro; o peso sem
 * linhas elegíveis cai para a proporção por V.TOTAL. Itens em UN só contam
 * como peso se vierem com peso unitário explícito.
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
    modoFrete?: ModoFreteNf;
    criterioRateioFrete?: CriterioRateioFrete;
    baseValorRateioFrete?: BaseValorRateioFrete;
    freteValorPorKg?: number;
    percentualIcms?: number;
    itens: ItemCalculoEntrada[];
  }
): {
  baseNf: number;
  valorIcms: number;
  custoTotalNf: number;
  itens: ItemCalculoSaida[];
} {
  const { valorMercadoria, itens } = entrada;
  const percentualIcms = entrada.percentualIcms ?? 10;
  const modoFrete = entrada.modoFrete ?? (entrada.freteValorPorKg != null ? "por_kg" : "valor_total");
  const valorFreteInformado = modoFrete === "por_kg" ? entrada.freteValorPorKg ?? 0 : entrada.valorFrete;
  const rateio = calcularRateioFrete({
    itens,
    modo: modoFrete,
    valor: valorFreteInformado,
    criterio: entrada.criterioRateioFrete,
    baseValor: entrada.baseValorRateioFrete,
  });
  const baseNf = valorMercadoria + rateio.totalRateado;
  const valorIcms = baseNf * (percentualIcms / 100);
  const custoTotalNf = baseNf + valorIcms;

  const itensCalculados: ItemCalculoSaida[] = itens.map((item, indice) => {
    const rateioFrete = rateio.itens[indice] ?? 0;

    // ICMS item a item: (valor do item + frete do item) × percentual
    const rateioIcms = Number(((item.valorTotalItem + rateioFrete) * (percentualIcms / 100)).toFixed(4));
    const custoItemTotal = Number((item.valorTotalItem + rateioFrete + rateioIcms).toFixed(4));

    const custoPorUnidadeCompra = item.quantidade > 0 ? custoItemTotal / item.quantidade : 0;

    let unidadeErp: UnidadeErp | undefined;
    let fatorConversao: number | undefined;
    let quantidadeErp: number | undefined;
    let custoRealErp = 0;

    if (item.fatorConversao && item.fatorConversao > 0) {
      unidadeErp = item.unidadeErp;
      fatorConversao = item.fatorConversao;
      quantidadeErp = item.quantidade * fatorConversao;
      custoRealErp = quantidadeErp > 0 ? Number((custoItemTotal / quantidadeErp).toFixed(6)) : 0;
    } else {
      // Sem conversão: custo real = custo por unidade de compra
      custoRealErp = Number(custoPorUnidadeCompra.toFixed(6));
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
      custoPorUnidadeCompra: Number(custoPorUnidadeCompra.toFixed(6)),
      unidadeErp,
      fatorConversao,
      quantidadeErp: quantidadeErp ? Number(quantidadeErp.toFixed(4)) : undefined,
      custoRealErp: Number(custoRealErp.toFixed(6)),
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
