import { describe, expect, it } from "vitest";
import { hexDoPantone } from "../../shared/pantone-referencia";
import { sugerirMaterialParaCor, type CpqCorCatalogo } from "../services/cpqCoresMateriais";

const chapa = (id: number, pantoneCode: string | null, extra: Partial<CpqCorCatalogo> = {}): CpqCorCatalogo =>
  ({ id, mubisysMateriaPrimaId: id, materialNome: `Acrílico ${id}`, nome: `Chapa ${id}`, pantoneCode, ativo: true, ...extra });

function sugerir(regiao: Record<string, unknown>, chapas: CpqCorCatalogo[]) {
  return sugerirMaterialParaCor({
    regiao: { key: "r1", tipoCor: "solida", areaM2: 1, ...regiao },
    chapas, adesivos: [], iluminacao: "sem_iluminacao", baseImpressao: "branco", laminar: false,
    precos: { vinilBrancoM2: 30, impressaoM2: 20 }, construcaoFace: "acrilico_total",
  } as Parameters<typeof sugerirMaterialParaCor>[0]);
}

describe("chapa com várias referências Pantone na mesma célula", () => {
  it("usa a referência que melhor casa: cor igual à amostra do 2º Pantone da lista escolhe essa chapa", () => {
    const r = sugerir({ corHex: hexDoPantone("PMS 299") }, [
      chapa(1, "PMS 185"),
      chapa(2, "PMS 185, PMS 299"),
    ]);
    expect(r.tipoSugestao).toBe("chapa");
    expect(r.chapaId).toBe(2);
    expect(r.deltaE00).toBeLessThan(0.5);
  });

  it("'021 C  804 C' digitado com dois espaços vira duas referências e a 1ª (com amostra) entra no casamento", () => {
    const r = sugerir({ corHex: hexDoPantone("Orange 021") }, [chapa(3, "021 C  804 C"), chapa(4, "PMS 299")]);
    expect(r.chapaId).toBe(3);
    expect(r.deltaE00).toBeLessThan(0.5);
  });

  it("código fora da tabela de amostras (804 C) ainda casa pelo código exato da arte", () => {
    const r = sugerir({ pantoneCode: "804 c" }, [chapa(5, "PMS 299"), chapa(6, "021 C, 804 C")]);
    expect(r.chapaId).toBe(6);
    expect(r.deltaE00).toBe(0);
  });

  it("uma referência só continua funcionando como antes", () => {
    const r = sugerir({ corHex: hexDoPantone("PMS 185") }, [chapa(7, "PMS 185"), chapa(8, "PMS 299")]);
    expect(r.chapaId).toBe(7);
  });
});
