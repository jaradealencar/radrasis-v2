import { describe, expect, it } from "vitest";
import { consolidarRegioesFotograficas, sugerirMaterialParaCor, type CpqGrupoCor } from "../services/cpqCoresMateriais";

const grupo = (indice: number, areaM2: number, extra: Partial<CpqGrupoCor> = {}): CpqGrupoCor => ({
  tipoCor: "solida", corHex: `#${(indice * 4099 % 0xffffff).toString(16).padStart(6, "0")}`, pantoneCode: null, cmyk: null,
  coresGradiente: [], areaM2, pathIndexes: [indice], caixasMm: [{ minX: indice, maxX: indice + 10, minY: 0, maxY: 10 }], ...extra,
});

describe("foto dentro do logotipo", () => {
  it("reúne dezenas de cores pequenas numa única região complexa (adesivo impresso)", () => {
    const grandes = [grupo(0, 1.2), grupo(1, 0.8)];
    const pequenas = Array.from({ length: 25 }, (_, i) => grupo(i + 2, 0.002));
    const resultado = consolidarRegioesFotograficas([...grandes, ...pequenas]);
    expect(resultado).toHaveLength(3);
    const foto = resultado.find(item => item.tipoCor === "complexa")!;
    expect(foto.pathIndexes).toHaveLength(25);
    expect(foto.caixasMm).toHaveLength(25);
    expect(foto.areaM2).toBeCloseTo(0.05, 6);
    expect(foto.observacao).toContain("25 cores reunidas");
    expect(resultado.filter(item => item.tipoCor === "solida").map(item => item.pathIndexes[0])).toEqual([0, 1]);
  });

  it("poucas cores pequenas (um logotipo comum) ficam como estão", () => {
    const grupos = [grupo(0, 1), grupo(1, 0.5), ...Array.from({ length: 8 }, (_, i) => grupo(i + 2, 0.001))];
    expect(consolidarRegioesFotograficas(grupos)).toEqual(grupos);
  });

  it("a região reunida segue para impressão digital e avisa o vendedor", () => {
    const foto = consolidarRegioesFotograficas([grupo(0, 1), ...Array.from({ length: 22 }, (_, i) => grupo(i + 1, 0.001))])
      .find(item => item.tipoCor === "complexa")!;
    const r = sugerirMaterialParaCor({
      regiao: { key: "foto", tipoCor: foto.tipoCor, observacao: foto.observacao, areaM2: foto.areaM2 },
      chapas: [], adesivos: [], iluminacao: "sem_iluminacao", baseImpressao: "branco", laminar: false,
      precos: { vinilBrancoM2: 30, impressaoM2: 20 }, construcaoFace: "acrilico_total",
    });
    expect(r.tipoSugestao).toBe("impresso");
    expect(r.avisos.some(aviso => aviso.includes("Foto ou arte com muitas cores pequenas"))).toBe(true);
  });
});
