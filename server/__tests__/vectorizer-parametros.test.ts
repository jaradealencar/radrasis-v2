import { describe, expect, it } from "vitest";
import { parametrosVetorizacao } from "../services/vectorizerAi";

/** Nomes e valores seguem a especificação OpenAPI oficial do Vectorizer.AI (https://vectorizer.ai/api/openapi.json). */
describe("parâmetros do Vectorizer.AI para o corte CNC", () => {
  const comoMapa = (modo?: "completo" | "corte") => new Map(parametrosVetorizacao(modo));

  it("vetoriza sem sobreposição, sem traços extras e sem arcos", () => {
    const parametros = comoMapa();
    expect(parametros.get("output.shape_stacking")).toBe("cutouts");
    expect(parametros.get("output.gap_filler.enabled")).toBe("false");
    expect(parametros.get("output.curves.allowed.circular_arc")).toBe("false");
    expect(parametros.get("output.curves.allowed.elliptical_arc")).toBe("false");
    expect(parametros.get("output.parameterized_shapes.flatten")).toBe("true");
    expect(parametros.get("output.group_by")).toBe("none");
    expect(parametros.get("output.draw_style")).toBe("fill_shapes");
    expect(parametros.get("output.file_format")).toBe("svg");
  });

  it("o modo completo mantém as cores e descarta só ruídos minúsculos", () => {
    const parametros = comoMapa("completo");
    expect(parametros.has("processing.max_colors")).toBe(false);
    expect(Number(parametros.get("processing.shapes.min_area_px"))).toBeGreaterThan(0.125);
  });

  it("o modo de corte reduz a arte a uma única cor (silhueta)", () => {
    const parametros = comoMapa("corte");
    expect(parametros.get("processing.max_colors")).toBe("1");
    expect(parametros.get("output.shape_stacking")).toBe("cutouts");
  });

  it("não repete nenhum parâmetro", () => {
    for (const modo of ["completo", "corte"] as const) {
      const nomes = parametrosVetorizacao(modo).map(([nome]) => nome);
      expect(new Set(nomes).size).toBe(nomes.length);
    }
  });
});
