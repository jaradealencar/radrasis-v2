/** Decomposição do preço bruto de venda. Percentuais incidem sobre o preço
 * bruto; materiais e mão de obra são custos unitários informados em R$.
 * O chamador deve representar custo desconhecido como null e não chamar o
 * cálculo completo até que ele tenha sido levantado. */
export type DecupadorPrecoInput = {
  precoVenda: number;
  materiaPrima: number;
  maoDeObra: number;
  custoFixoPct: number;
  comissaoPct: number;
  impostoPct: number;
  custoFinanceiroPct: number;
};

export type ComponenteDecupagem = { valor: number; percentual: number };
export type DecupagemPreco = {
  version: 1;
  calculadoEm: string;
  precoVenda: number;
  materiaPrima: ComponenteDecupagem;
  maoDeObra: ComponenteDecupagem;
  custoFixo: ComponenteDecupagem;
  comissao: ComponenteDecupagem;
  impostos: ComponenteDecupagem;
  custoFinanceiro: ComponenteDecupagem;
  lucroLiquido: ComponenteDecupagem;
  taxas: { custoFixoPct: number; comissaoPct: number; impostoPct: number; custoFinanceiroPct: number };
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function validarTaxa(nome: string, taxa: number): void {
  if (!Number.isFinite(taxa) || taxa < 0 || taxa > 100) {
    throw new Error(`${nome} deve estar entre 0% e 100%.`);
  }
}

export function decuparPreco(input: DecupadorPrecoInput): DecupagemPreco {
  if (!Number.isFinite(input.precoVenda) || input.precoVenda <= 0) throw new Error("O preço de venda precisa ser maior que zero.");
  if (!Number.isFinite(input.materiaPrima) || input.materiaPrima < 0) throw new Error("O custo de matéria-prima é inválido.");
  if (!Number.isFinite(input.maoDeObra) || input.maoDeObra < 0) throw new Error("O custo de mão de obra é inválido.");
  validarTaxa("Custo fixo", input.custoFixoPct);
  validarTaxa("Comissão", input.comissaoPct);
  validarTaxa("Imposto", input.impostoPct);
  validarTaxa("Custo financeiro", input.custoFinanceiroPct);

  const valorPorTaxa = (pct: number) => round2(input.precoVenda * pct / 100);
  const componente = (valor: number): ComponenteDecupagem => ({
    valor: round2(valor),
    percentual: round2(valor / input.precoVenda * 100),
  });
  const materiaPrima = componente(input.materiaPrima);
  const maoDeObra = componente(input.maoDeObra);
  const custoFixo = componente(valorPorTaxa(input.custoFixoPct));
  const comissao = componente(valorPorTaxa(input.comissaoPct));
  const impostos = componente(valorPorTaxa(input.impostoPct));
  const custoFinanceiro = componente(valorPorTaxa(input.custoFinanceiroPct));
  const lucroLiquido = componente(input.precoVenda - materiaPrima.valor - maoDeObra.valor - custoFixo.valor - comissao.valor - impostos.valor - custoFinanceiro.valor);

  return {
    version: 1,
    calculadoEm: new Date().toISOString(),
    precoVenda: round2(input.precoVenda),
    materiaPrima,
    maoDeObra,
    custoFixo,
    comissao,
    impostos,
    custoFinanceiro,
    lucroLiquido,
    taxas: {
      custoFixoPct: input.custoFixoPct,
      comissaoPct: input.comissaoPct,
      impostoPct: input.impostoPct,
      custoFinanceiroPct: input.custoFinanceiroPct,
    },
  };
}
