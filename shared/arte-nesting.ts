/** Unidades: dimensões em mm, áreas em m² e perímetro em metros. */
export type MetricasNestingArte = {
  quantidadeChapas: number;
  quantidadePecas: number;
  areaChapaM2: number;
  areaUtilizadaM2: number;
  areaLiquidaM2: number;
  perimetroM: number;
};

export type PecaNestingArte = {
  id: string;
  svg: string;
  larguraMm: number;
  alturaMm: number;
  cor: string;
};

export type PecaEditorNestingArte = PecaNestingArte & {
  xMm: number;
  yMm: number;
  dProjeto: string;
  areaLiquidaM2: number;
  perimetroM: number;
};

export type PreparacaoNestingArte = {
  larguraMm: number;
  alturaMm: number;
  pecas: PecaEditorNestingArte[];
};

export type ResultadoNestingArte = {
  grupoId: string;
  nome: string;
  motor: "deepnest" | "interno";
  espacamentoMm: number;
  margemBordaMm: number;
  chapas: Array<{
    indice: number;
    larguraMm: number;
    alturaMm: number;
    svg: string;
    metricas: MetricasNestingArte;
  }>;
  total: MetricasNestingArte;
};

export function somarMetricasNestingArte(
  valores: MetricasNestingArte[]
): MetricasNestingArte {
  return valores.reduce(
    (total, item) => ({
      quantidadeChapas: total.quantidadeChapas + item.quantidadeChapas,
      quantidadePecas: total.quantidadePecas + item.quantidadePecas,
      areaChapaM2: total.areaChapaM2 + item.areaChapaM2,
      areaUtilizadaM2: total.areaUtilizadaM2 + item.areaUtilizadaM2,
      areaLiquidaM2: total.areaLiquidaM2 + item.areaLiquidaM2,
      perimetroM: total.perimetroM + item.perimetroM,
    }),
    {
      quantidadeChapas: 0,
      quantidadePecas: 0,
      areaChapaM2: 0,
      areaUtilizadaM2: 0,
      areaLiquidaM2: 0,
      perimetroM: 0,
    }
  );
}
