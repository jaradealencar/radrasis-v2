import { PANTONE_REFERENCIA } from "../../shared/pantone-referencia";
import { deltaE2000, hexParaRgb, rgbParaLab } from "./cpqCoresMateriais";

export type CpqCmyk = { c: number; m: number; y: number; k: number };
export type CpqPantoneProximo = { codigo: string; hex: string; deltaE00: number };

const REFERENCIAS = PANTONE_REFERENCIA.map(([codigo, hex]) => {
  const rgb = hexParaRgb(hex)!;
  return { codigo, hex, lab: rgbParaLab(rgb) };
});

/** Lista completa para o seletor de Pantone do cadastro de chapas. */
export function listarPantone(): Array<{ codigo: string; hex: string }> {
  return PANTONE_REFERENCIA.map(([codigo, hex]) => ({ codigo, hex }));
}

/**
 * CMYK aproximado a partir de RGB (conversão ingênua, sem perfil ICC). Serve de ponto de partida:
 * o resultado impresso depende do perfil de cor da gráfica e do substrato.
 */
export function rgbParaCmykAproximado(rgb: [number, number, number]): CpqCmyk {
  const [r, g, b] = rgb.map(canal => canal / 255);
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  const arredonda = (valor: number) => Math.round(valor * 100);
  return {
    c: arredonda((1 - r - k) / (1 - k)),
    m: arredonda((1 - g - k) / (1 - k)),
    y: arredonda((1 - b - k) / (1 - k)),
    k: arredonda(k),
  };
}

/** Os `quantidade` Pantones de referência mais próximos (CIEDE2000) de uma cor. */
export function pantoneMaisProximos(hex: string, quantidade = 3): CpqPantoneProximo[] | null {
  const rgb = hexParaRgb(hex);
  if (!rgb) return null;
  const lab = rgbParaLab(rgb);
  return REFERENCIAS
    .map(ref => ({ codigo: ref.codigo, hex: ref.hex, deltaE00: Number(deltaE2000(lab, ref.lab).toFixed(2)) }))
    .sort((a, b) => a.deltaE00 - b.deltaE00)
    .slice(0, quantidade);
}
