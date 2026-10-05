/**
 * Gabarito de fixação em papel kraft (produto MubiSys 127, modelo 570; matéria-prima #1098).
 * O papel acompanha o letreiro aberto da prancha técnica: o comprimento é a largura do letreiro e a
 * altura atravessa a bobina. Passando da largura da bobina, repete o papel em faixas.
 * O CPQ (HTML estático) repete esta regra em `FORMULA_TYPES.gabaritoKraft`; mantenha os dois iguais.
 */
export const GABARITO_PRODUTO_ID = 127;
export const GABARITO_MODELO_KRAFT_ID = 570;
export const KRAFT_MATERIA_PRIMA_ID = 1098;
export const KRAFT_LARGURA_BOBINA_M = 1.2;

export function faixasGabaritoKraft(alturaM: number, larguraBobinaM = KRAFT_LARGURA_BOBINA_M): number {
  // O snapshot do CPQ guarda medidas em mm inteiros; arredondar aqui evita divergência no limite.
  const alturaMm = Math.round(alturaM * 1000);
  return Math.max(1, Math.ceil(alturaMm / (larguraBobinaM * 1000)));
}

/** Consumo cobrado de papel em m²: faixas × largura da bobina × comprimento (largura do letreiro). */
export function consumoGabaritoKraftM2(larguraLetreiroM: number, alturaLetreiroM: number, larguraBobinaM = KRAFT_LARGURA_BOBINA_M): number {
  const comprimentoM = Math.round(larguraLetreiroM * 1000) / 1000;
  return faixasGabaritoKraft(alturaLetreiroM, larguraBobinaM) * larguraBobinaM * comprimentoM;
}
