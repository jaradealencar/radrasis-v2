import { describe, expect, it } from "vitest";
import { extrairRegioesCorSvg } from "../services/cpqCoresMateriais";
import { contornosFisicosDoSvg } from "../services/cpqFactibilidadeFabricacao";
import { lerDimensoesPng, montarSvgDeCamadas } from "../services/cpqPlanoBArte";

const QUADRADO_VAZADO = "M10 10 L90 10 L90 90 L10 90 Z M30 30 L30 70 L70 70 L70 30 Z";

describe("plano B da vetorização com GPT: saneamento do SVG", () => {
  it("monta um SVG que o leitor de cores e a geometria do CPQ aceitam, com o vazado", () => {
    const svg = montarSvgDeCamadas({ camadas: [{ cor: "#FECB01", d: QUADRADO_VAZADO }, { cor: "#1c3f94", d: "M100 10 C 120 10 140 30 140 50 L100 50 Z" }] }, 200, 100);
    expect(svg).toContain('viewBox="0 0 200 100"');
    expect(svg).toContain('fill="#fecb01"');
    const regioes = extrairRegioesCorSvg(svg);
    expect(regioes).toHaveLength(2);
    expect(regioes.every(r => r.tipoCor === "solida")).toBe(true);
    const poligonos = contornosFisicosDoSvg(svg, 200, 100);
    expect(poligonos.some(p => p.length === 2)).toBe(true); // casca + furo
  });

  it.each([
    [{ camadas: [{ cor: "#fecb01", d: "M0 0 L10 0 L10 10 Z <script>" }] }, /não permitidos/],
    [{ camadas: [{ cor: "#fecb01", d: "M0 0 A5 5 0 0 1 10 0 Z" }] }, /não permitidos/],
    [{ camadas: [{ cor: "#fecb01", d: "L0 0 L10 0 L10 10 Z" }] }, /não começa/],
    [{ camadas: [{ cor: "#fecb01", d: "M0 0 L10 0 L10 10 L0 10" }] }, /aberto/],
    [{ camadas: [{ cor: "#fecb01", d: "M0 0 L10 Z" }] }, /pontos suficientes/],
  ])("recusa camada insegura ou inválida: %#", (entrada, motivo) => {
    expect(() => montarSvgDeCamadas(entrada, 100, 100)).toThrow(motivo);
  });

  it("recusa cor fora de #RRGGBB e lista vazia", () => {
    expect(() => montarSvgDeCamadas({ camadas: [{ cor: "red", d: QUADRADO_VAZADO }] }, 100, 100)).toThrow();
    expect(() => montarSvgDeCamadas({ camadas: [] }, 100, 100)).toThrow();
  });

  it("lê as dimensões do cabeçalho PNG e rejeita outros formatos", () => {
    const png = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
    png.writeUInt32BE(1536, 16);
    png.writeUInt32BE(1024, 20);
    expect(lerDimensoesPng(png)).toEqual({ largura: 1536, altura: 1024 });
    expect(lerDimensoesPng(Buffer.from("não sou png, só texto comprido o bastante"))).toBeNull();
  });
});
