import type { FormulaConsumoMubiSys } from "../../shared/perfil-consumo-mubisys";

export type MedidasComposicao = {
  areaM2?: number | null;
  areaGeralM2?: number | null;
  areaTotalNestingM2?: number | null;
  perimExtM?: number | null;
  perimTotalM?: number | null;
};
export type NestingComposicao = {
  materiaPrimaId: number;
  areaLiquidaM2?: number | null;
  areaUtilizadaM2?: number | null;
  perimetroTotalM?: number | null;
  custoMaterialEstimado?: number | null;
};
export type AcabamentoComposicao = {
  id: number;
  nome: string;
  tipoCalculo: string | null;
  formula?: FormulaConsumoMubiSys | null;
  quantidade: number;
  custoAdicional: number | null;
  custoMateriaPrima: number | null;
  custoMaoDeObra: number | null;
  produtividadeHora?: number | null;
  horasEquipamento?: number | null;
};
export type EquipamentoComposicao = {
  id: number;
  nome: string;
  horas: number;
  quantidade: number;
  custoHora: number | null;
};
export type ItemComposicao = {
  itemId?: number;
  materiaPrimaId: number;
  materiaPrima: string;
  unidade: string;
  formula: FormulaConsumoMubiSys;
  multiplicador: number;
  custoUnitario: number | null;
  acabamentos?: AcabamentoComposicao[];
  equipamentos?: EquipamentoComposicao[];
};
export type LinhaCustoComposicao = {
  itemId?: number;
  materiaPrimaId: number;
  materiaPrima: string;
  quantidade: number;
  custoMateriaPrima: number | null;
  acabamentos: Array<{ id: number; nome: string; quantidade: number; custo: number | null; horas: number }>;
  equipamentos: Array<{ id: number; nome: string; horas: number; custo: number | null }>;
  custoAcabamentos: number | null;
  custoEquipamentos: number | null;
  custoTotal: number | null;
  pendencias: string[];
};

function valorMedida(
  formula: FormulaConsumoMubiSys,
  materialId: number,
  medidas: MedidasComposicao,
  nestings: NestingComposicao[],
): number | null {
  const nesting = nestings.find(item => item.materiaPrimaId === materialId);
  const valor = formula === "area" ? nesting?.areaLiquidaM2 ?? medidas.areaM2
    : formula === "areaTotal" ? nesting?.areaUtilizadaM2 ?? medidas.areaTotalNestingM2
    : formula === "areaGeral" ? medidas.areaGeralM2
    : formula === "perimExt" ? medidas.perimExtM
    : formula === "perimTotal" ? nesting?.perimetroTotalM ?? medidas.perimTotalM
    : 1;
  return valor == null || !Number.isFinite(valor) ? null : Math.max(0, valor);
}

function formulaAcabamento(tipo: string | null, explicita?: FormulaConsumoMubiSys | null): FormulaConsumoMubiSys | null {
  if (explicita) return explicita;
  const chave = (tipo || "").replace(/²/g, "2").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (["m2", "area", "por m2", "metro quadrado", "por metro quadrado"].includes(chave) || chave.includes("area")) return "area";
  if (["ml", "metro linear", "por metro linear", "comprimento"].includes(chave) ||
      chave.includes("metro linear") || chave.includes("perimetro")) return "perimExt";
  if (["peca", "por peca", "unidade", "por unidade"].includes(chave) || chave.includes("peca")) return "fixo";
  if (["fixo", "valor fixo", "por produto"].includes(chave)) return "fixo";
  return null;
}

/**
 * Calcula consumo e custo após o nesting. O custo do nesting é rateado entre
 * as linhas do mesmo material conforme o custo-base de cada consumo.
 * Custo/perfil ausente vira pendência e deixa o total nulo, nunca zero silencioso.
 */
export function calcularComposicaoComAcabamentos(
  itens: ItemComposicao[],
  medidas: MedidasComposicao,
  nestings: NestingComposicao[] = [],
): { linhas: LinhaCustoComposicao[]; custoTotal: number | null; pendencias: string[] } {
  const calculados = itens.map(item => {
    const medida = valorMedida(item.formula, item.materiaPrimaId, medidas, nestings);
    const quantidade = medida == null ? 0 : medida * item.multiplicador;
    return { item, medida, quantidade, custoBase: item.custoUnitario == null ? null : quantidade * item.custoUnitario };
  });
  const custoBasePorMaterial = new Map<number, number>();
  for (const linha of calculados) {
    if (linha.custoBase == null) continue;
    custoBasePorMaterial.set(linha.item.materiaPrimaId,
      (custoBasePorMaterial.get(linha.item.materiaPrimaId) || 0) + linha.custoBase);
  }

  const linhas: LinhaCustoComposicao[] = calculados.map(({ item, medida, quantidade, custoBase }) => {
    const pendencias: string[] = [];
    if (medida == null) pendencias.push("Medida ausente para " + item.materiaPrima + ".");
    if (quantidade > 0 && (item.custoUnitario == null || item.custoUnitario <= 0))
      pendencias.push("Custo unitário ausente ou inválido para " + item.materiaPrima + ".");
    const nesting = nestings.find(value => value.materiaPrimaId === item.materiaPrimaId);
    let custoMateriaPrima = custoBase;
    if (nesting?.custoMaterialEstimado != null) {
      const divisor = custoBasePorMaterial.get(item.materiaPrimaId) || 0;
      const linhasMesmoMaterial = calculados.filter(value => value.item.materiaPrimaId === item.materiaPrimaId).length;
      const parcela = divisor > 0 ? (custoBase || 0) / divisor : 1 / Math.max(1, linhasMesmoMaterial);
      custoMateriaPrima = Math.max(0, nesting.custoMaterialEstimado * parcela);
    }

    let custoAcabamentos = 0;
    let acabamentoPendente = false;
    const acabamentos = (item.acabamentos || []).map(acabamento => {
      const formula = formulaAcabamento(acabamento.tipoCalculo, acabamento.formula);
      const medidaAcabamento = formula ? valorMedida(formula, item.materiaPrimaId, medidas, nestings) : null;
      const qtd = medidaAcabamento == null ? 0 : medidaAcabamento * acabamento.quantidade;
      const unitario = acabamento.custoAdicional ??
        (acabamento.custoMateriaPrima != null && acabamento.custoMaoDeObra != null
          ? acabamento.custoMateriaPrima + acabamento.custoMaoDeObra
          : null);
      const custo = unitario == null ? null : qtd * unitario;
      const horas = acabamento.horasEquipamento != null
        ? acabamento.horasEquipamento * acabamento.quantidade
        : acabamento.produtividadeHora && acabamento.produtividadeHora > 0
          ? qtd / acabamento.produtividadeHora : 0;
      if (!formula) {
        acabamentoPendente = true;
        pendencias.push("Tipo de cálculo ausente ou desconhecido no acabamento " + acabamento.nome + ".");
      }
      if (qtd > 0 && (unitario == null || unitario <= 0)) {
        acabamentoPendente = true;
        pendencias.push("Custo ausente ou inválido no acabamento " + acabamento.nome + ".");
      }
      if (custo != null) custoAcabamentos += custo;
      return { id: acabamento.id, nome: acabamento.nome, quantidade: qtd, custo, horas };
    });

    let custoEquipamentos = 0;
    let equipamentoPendente = false;
    const equipamentos = (item.equipamentos || []).map(equipamento => {
      const horas = equipamento.horas * equipamento.quantidade;
      const custo = equipamento.custoHora == null ? null : horas * equipamento.custoHora;
      if (horas > 0 && (equipamento.custoHora == null || equipamento.custoHora <= 0)) {
        equipamentoPendente = true;
        pendencias.push("Custo por hora ausente ou inválido no equipamento " + equipamento.nome + ".");
      }
      if (custo != null) custoEquipamentos += custo;
      return { id: equipamento.id, nome: equipamento.nome, horas, custo };
    });
    const custoTotal = custoMateriaPrima == null || pendencias.length
      ? null
      : custoMateriaPrima + custoAcabamentos + custoEquipamentos;
    return {
      itemId: item.itemId, materiaPrimaId: item.materiaPrimaId, materiaPrima: item.materiaPrima,
      quantidade, custoMateriaPrima, acabamentos, equipamentos,
      custoAcabamentos: acabamentoPendente ? null : custoAcabamentos,
      custoEquipamentos: equipamentoPendente ? null : custoEquipamentos,
      custoTotal, pendencias,
    };
  });
  const pendencias = linhas.flatMap(linha => linha.pendencias);
  return {
    linhas,
    custoTotal: pendencias.length ? null : linhas.reduce((total, linha) => total + (linha.custoTotal ?? 0), 0),
    pendencias,
  };
}