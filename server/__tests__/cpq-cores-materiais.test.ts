import { describe, expect, it } from "vitest";
import { sugerirMaterialParaCor, type CpqCorrespondenciaCorInput } from "../services/cpqCoresMateriais";

/**
 * Impressão digital (gradiente/complexa): o custo só fica completo quando a transmissão de luz do vinil também
 * atende à iluminação do projeto — a regra pedida para faces iluminadas (migration 0069). Região sólida não
 * passa por aqui, então estes testes usam sempre `tipoCor: "gradiente"`.
 */
function entrada(extra: Partial<CpqCorrespondenciaCorInput> = {}): CpqCorrespondenciaCorInput {
  return {
    regiao: { key: "r1", tipoCor: "gradiente", areaM2: 2 },
    chapas: [],
    adesivos: [],
    iluminacao: "sem_iluminacao",
    baseImpressao: "branco",
    laminar: false,
    precos: {
      vinilBrancoM2: 30, vinilBrancoTransmissaoPct: 40,
      vinilTransparenteM2: 35, vinilTransparenteTransmissaoPct: null,
      impressaoM2: 20, laminacaoM2: 10,
    },
    ...extra,
  };
}

describe("CPQ cores — custo de impressão digital e transmissão de luz", () => {
  it("sem iluminação, a transmissão não é exigida: custo = (vinil + impressão) × área", () => {
    const r = sugerirMaterialParaCor(entrada({ precos: { vinilBrancoM2: 30, impressaoM2: 20 } }));
    expect(r.tipoSugestao).toBe("impresso");
    expect(r.custoEstimado).toBe(100); // (30 + 20) × 2 m²
    expect(r.avisos.some(a => a.includes("Transmissão"))).toBe(false);
  });

  it("face iluminada sem transmissão cadastrada deixa o custo pendente e avisa", () => {
    const r = sugerirMaterialParaCor(entrada({
      iluminacao: "frontlight", precos: { vinilBrancoM2: 30, impressaoM2: 20 },
    }));
    expect(r.custoEstimado).toBeNull();
    expect(r.precificacao).toBeNull();
    expect(r.avisos).toContain("Transmissão de luz do vinil branco não cadastrada; confirme a compatibilidade antes de aprovar.");
  });

  it("transmissão zero é incompatível com face iluminada", () => {
    const r = sugerirMaterialParaCor(entrada({
      iluminacao: "backlight", transmissaoMinimaPct: 20,
      precos: { vinilBrancoM2: 30, vinilBrancoTransmissaoPct: 0, impressaoM2: 20 },
    }));
    expect(r.custoEstimado).toBeNull();
    expect(r.avisos.some(a => a.includes("sem transmissão de luz"))).toBe(true);
  });

  it("transmissão abaixo do mínimo de engenharia bloqueia o custo", () => {
    const r = sugerirMaterialParaCor(entrada({ iluminacao: "backlight", transmissaoMinimaPct: 50 })); // vinil branco = 40%
    expect(r.custoEstimado).toBeNull();
    expect(r.avisos.some(a => a.includes("abaixo do mínimo informado (50%)"))).toBe(true);
  });

  it("transmissão que atinge o mínimo libera o custo e registra a transmissão na precificação", () => {
    const r = sugerirMaterialParaCor(entrada({ iluminacao: "backlight", transmissaoMinimaPct: 30 }));
    expect(r.custoEstimado).toBe(100);
    expect(r.precificacao?.transmissaoLuzPct).toBe(40);
  });

  it("frontlight com transmissão positiva e sem mínimo libera o custo, mas pede confirmação da engenharia", () => {
    const r = sugerirMaterialParaCor(entrada({ iluminacao: "frontlight" }));
    expect(r.custoEstimado).toBe(100);
    expect(r.avisos).toContain("Transmissão do vinil cadastrada; engenharia precisa confirmar se atende ao nível de iluminação do projeto.");
  });

  it("usa a transmissão da base escolhida (transparente) e não a do branco", () => {
    const r = sugerirMaterialParaCor(entrada({ iluminacao: "frontlight", baseImpressao: "transparente" })); // transparente sem transmissão
    expect(r.custoEstimado).toBeNull();
    expect(r.avisos.some(a => a.includes("vinil transparente não cadastrada"))).toBe(true);
  });

  it("custo ausente continua impedindo o custo, com ou sem iluminação", () => {
    const r = sugerirMaterialParaCor(entrada({ precos: { vinilBrancoM2: null, impressaoM2: 20 } }));
    expect(r.custoEstimado).toBeNull();
    expect(r.avisos).toContain("Custo por m² do vinil branco não cadastrado.");
  });
});
