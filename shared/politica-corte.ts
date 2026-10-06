/**
 * Política de corte por matéria-prima (nesting): processo de corte, rotação permitida e espaçamento/margem.
 *
 * - Rotação permitida: só o material ESCOVADO (galvanizada escovada, acrílico/ACM escovado) tem regra: o veio exige que as
 *   peças girem apenas 0° e 180°. Todos os demais ficam "livre" (padrão), com o comportamento anterior do motor.
 * - Processo de corte: laser, router CNC, plasma ou faca. Cada um tem um espaçamento entre peças e uma margem de borda
 *   iniciais (a fresa precisa passar entre as peças; o plasma deforma e precisa de entrada de corte...). São pontos de
 *   partida: o cadastro da matéria-prima pode sobrescrever o espaçamento e a margem, e o orçamento tem um padrão geral.
 *
 * Ordem de precedência de espaçamento e margem: valor próprio da matéria-prima > padrão do processo > padrão do orçamento.
 */
export const PROCESSOS_CORTE = ["laser", "router", "plasma", "faca"] as const;
export type ProcessoCorte = (typeof PROCESSOS_CORTE)[number];

export const ROTACOES_PERMITIDAS = ["livre", "veio"] as const;
export type RotacaoPermitida = (typeof ROTACOES_PERMITIDAS)[number];

export const ROTULO_PROCESSO_CORTE: Record<ProcessoCorte, string> = {
  laser: "Laser",
  router: "Router CNC",
  plasma: "Plasma",
  faca: "Faca / lâmina",
};

export const ROTULO_ROTACAO: Record<RotacaoPermitida, string> = {
  livre: "Livre (qualquer ângulo)",
  veio: "Escovado: só 0° e 180°",
};

/** Pontos de partida (mm); confirme com um corte de teste na máquina. */
export const PADRAO_PROCESSO_CORTE: Record<ProcessoCorte, { espacamentoMm: number; margemBordaMm: number; dica: string }> = {
  laser: { espacamentoMm: 3, margemBordaMm: 8, dica: "Kerf de 0,2 a 0,3 mm; espaço extra evita deformar pelo calor." },
  router: { espacamentoMm: 8, margemBordaMm: 12, dica: "A fresa passa entre as peças: use o diâmetro da fresa + 2 mm (fresa de 6 mm = 8 mm); a borda precisa de espaço para a fixação." },
  plasma: { espacamentoMm: 10, margemBordaMm: 20, dica: "Kerf de 1,5 a 2,5 mm, deformação pelo calor e entrada de corte: precisa de mais espaço e margem." },
  faca: { espacamentoMm: 3, margemBordaMm: 5, dica: "Lâmina sem perda de material: espaço só para o arrasto." },
};

export function ehProcessoCorte(valor: unknown): valor is ProcessoCorte {
  return typeof valor === "string" && (PROCESSOS_CORTE as readonly string[]).includes(valor);
}

export function normalizarRotacao(valor: unknown): RotacaoPermitida {
  return typeof valor === "string" && (ROTACOES_PERMITIDAS as readonly string[]).includes(valor) ? (valor as RotacaoPermitida) : "livre";
}

/** Ângulos permitidos em graus; null = livre (o motor escolhe). */
export function angulosPermitidos(rotacao: RotacaoPermitida | null | undefined): number[] | null {
  return rotacao === "veio" ? [0, 180] : null;
}

/** Valor do parâmetro `rotations` do Deepnest (quantas rotações iguais em 360°): 2 = só 0° e 180° (escovado); 72 = livre. */
export function rotacoesDoDeepnest(rotacao: RotacaoPermitida | null | undefined): number {
  return rotacao === "veio" ? 2 : 72;
}

export type PoliticaCorteCadastro = {
  processoCorte?: string | null;
  rotacaoPermitida?: string | null;
  espacamentoMm?: number | null;
  margemBordaMm?: number | null;
};

export type PoliticaCorteResolvida = {
  processo: ProcessoCorte | null;
  rotacao: RotacaoPermitida;
  espacamentoMm: number;
  margemBordaMm: number;
  origemEspacamento: "material" | "processo" | "orcamento";
  origemMargem: "material" | "processo" | "orcamento";
};

/** Resolve o que vale para uma matéria-prima: o próprio valor > padrão do processo > padrão do orçamento. */
export function resolverPoliticaCorte(
  cadastro: PoliticaCorteCadastro | null | undefined,
  padraoOrcamento: { espacamentoMm: number; margemBordaMm: number },
): PoliticaCorteResolvida {
  const processo = ehProcessoCorte(cadastro?.processoCorte) ? cadastro!.processoCorte as ProcessoCorte : null;
  const doProcesso = processo ? PADRAO_PROCESSO_CORTE[processo] : null;
  const proprioEspacamento = cadastro?.espacamentoMm != null && Number.isFinite(cadastro.espacamentoMm) ? cadastro.espacamentoMm : null;
  const propriaMargem = cadastro?.margemBordaMm != null && Number.isFinite(cadastro.margemBordaMm) ? cadastro.margemBordaMm : null;
  return {
    processo,
    rotacao: normalizarRotacao(cadastro?.rotacaoPermitida),
    espacamentoMm: proprioEspacamento ?? doProcesso?.espacamentoMm ?? padraoOrcamento.espacamentoMm,
    margemBordaMm: propriaMargem ?? doProcesso?.margemBordaMm ?? padraoOrcamento.margemBordaMm,
    origemEspacamento: proprioEspacamento != null ? "material" : doProcesso ? "processo" : "orcamento",
    origemMargem: propriaMargem != null ? "material" : doProcesso ? "processo" : "orcamento",
  };
}
