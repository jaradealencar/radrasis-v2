/**
 * Aro do letreiro (papel "Aro" da peça): chapa metálica da qual se corta o miolo, sobrando só as bordas — uma faixa que acompanha o
 * contorno de cada letra/símbolo (e o de cada vazado) e sustenta o acrílico da face nos letreiros frontlight de face iluminada.
 *
 * Quando o SVG não traz uma camada "Aro" própria, o sistema gera a faixa a partir da silhueta da face (server/services/cpqFaixaAro.ts).
 * Largura padrão de 6 mm, decisão do usuário em 06/10/2026; ela é ajustável em Administração > Configurações.
 */
export const LARGURA_FAIXA_ARO_PADRAO_MM = 6;
export const LARGURA_FAIXA_ARO_MIN_MM = 1;
export const LARGURA_FAIXA_ARO_MAX_MM = 50;

export function larguraFaixaAroValida(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= LARGURA_FAIXA_ARO_MIN_MM && valor <= LARGURA_FAIXA_ARO_MAX_MM;
}

/** Largura a usar: a informada, se válida; senão a padrão (6 mm). */
export function larguraFaixaAroOuPadrao(valor: unknown): number {
  return larguraFaixaAroValida(valor) ? valor : LARGURA_FAIXA_ARO_PADRAO_MM;
}

/**
 * O papel da linha do kit é o Aro metálico? Só vale o papel "Aro" (sem acento/caixa, como palavra inteira): "Lateral", "Perfil" e
 * "Contorno" também caem na camada física `aro` do nesting, mas NÃO ganham a faixa automática.
 */
export function papelEhAro(papel: unknown): boolean {
  const palavras = String(papel ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return palavras.includes("aro");
}
