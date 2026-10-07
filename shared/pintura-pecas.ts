/**
 * Pintura só em parte do letreiro no CPQ (pedido de 06/10/2026): na Ficha técnica o vendedor marca as peças do desenho que levam
 * pintura e a cor de cada uma (o perfil, por exemplo, já vem pintado de fábrica). As linhas de pintura do orçamento passam a ser
 * cobradas pela área líquida só dessas peças e vão ao snapshot como quantidade fixa; este resumo registra de onde ela vem.
 *
 * O HTML do CPQ (`client/public/cpq-letreiros-express.html`, `resumoPinturaPecas`) calcula o resumo; o servidor confere se ele é
 * coerente com as medidas do letreiro (não tem como remedir as peças, que ficam no SVG e na marcação do vendedor).
 */
export const MAX_PECAS_PINTURA = 5000;
export const MAX_CORES_PINTURA = 50;
export const MAX_NOME_TINTA = 60;

export interface CorPinturaPecas {
  corHex: string;
  pecas: number;
  areaM2: number;
  /** Nome/código da tinta digitado pelo vendedor, ou o nome do metal escolhido (Prata, Azul Bic…). */
  nome?: string;
}

export interface ResumoPinturaPecas {
  areaPintadaM2: number;
  areaLiquidaTotalM2: number;
  pecasPintadas: number;
  pecasTotal: number;
  cores: CorPinturaPecas[];
}

/** Folga de arredondamento (m²) nas comparações de área. */
const TOLERANCIA_M2 = 0.005;

/**
 * Confere a coerência do resumo com a área líquida do letreiro (`areaM2` do snapshot). Devolve a mensagem do primeiro problema ou
 * `null`: pintar mais que o letreiro, somas que não fecham ou área total diferente da medida são sinais de dado adulterado ou velho.
 */
export function erroPinturaPecas(resumo: ResumoPinturaPecas, areaLiquidaM2: number | null): string | null {
  if (resumo.pecasPintadas > resumo.pecasTotal) return "A pintura marca mais peças do que o desenho tem.";
  if (resumo.areaPintadaM2 > resumo.areaLiquidaTotalM2 + TOLERANCIA_M2) return "A área pintada é maior que a área líquida do letreiro.";
  if (areaLiquidaM2 == null || Math.abs(resumo.areaLiquidaTotalM2 - areaLiquidaM2) > Math.max(TOLERANCIA_M2, areaLiquidaM2 * 0.01))
    return "A área líquida usada na pintura não corresponde à medida atual do letreiro.";
  const somaArea = resumo.cores.reduce((total, cor) => total + cor.areaM2, 0);
  if (Math.abs(somaArea - resumo.areaPintadaM2) > Math.max(TOLERANCIA_M2, resumo.areaPintadaM2 * 0.01))
    return "As áreas por cor de pintura não fecham com a área pintada.";
  const somaPecas = resumo.cores.reduce((total, cor) => total + cor.pecas, 0);
  if (somaPecas !== resumo.pecasPintadas) return "As peças por cor de pintura não fecham com o total de peças pintadas.";
  return null;
}
