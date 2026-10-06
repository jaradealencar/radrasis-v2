import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calcularFactibilidadeFabricacao } from "../services/cpqFactibilidadeFabricacao";
import { calcularNestingMultiMaterialParcial, type CpqChapa } from "../services/cpqNesting";
import { medidasDaPeca } from "../services/cpqNestingInterno";

const retangulo = (l: number, a: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l} ${a}" width="${l}mm" height="${a}mm"><path d="M0 0 L${l} 0 L${l} ${a} L0 ${a} Z"/></svg>`;

const chapa = (): CpqChapa => ({ id: 1, mubisysMateriaPrimaId: 1, nome: "Chapa 1220x2440", larguraMm: 2440, alturaMm: 1220 });
const bobina = (larguraRoloMm = 1200): CpqChapa => ({ id: 2, mubisysMateriaPrimaId: 1, nome: `Bobina ${larguraRoloMm}`, larguraMm: 50_000, alturaMm: larguraRoloMm, bobina: true });

async function nestar(l: number, a: number, chapas: CpqChapa[], extra: { rotacao?: "livre" | "veio"; margemBordaMm?: number } = {}) {
  return calcularNestingMultiMaterialParcial({
    pecas: [{ id: "peca-1", svg: retangulo(l, a), larguraMm: l, alturaMm: a }],
    espacamentoMm: 3,
    margemBordaMm: extra.margemBordaMm ?? 0,
    materiais: [{ id: 1, nome: "Material", custoUnitario: 10, unidadeCusto: "m²", chapas, rotacao: extra.rotacao }],
  });
}

function factibilidade(l: number, a: number, chapas: CpqChapa[], rotacao?: "livre" | "veio") {
  return calcularFactibilidadeFabricacao({
    svg: retangulo(l, a), larguraSvgMm: l, alturaSvgMm: a, margemBordaMm: 0,
    materiais: [{ id: 1, nome: "Material", chapas, rotacao }],
  });
}

describe("nesting: motor interno e bobina/escovado (auditoria 05/10/2026)", () => {
  beforeEach(() => {
    vi.stubEnv("DEEPNEST_REMOTE_URL", "");
    vi.stubEnv("DEEPNEST_NODE_BIN", "");
    vi.stubEnv("DEEPNEST_NODE_ENTRY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  describe("factibilidade", () => {
    it("bobina: peça mais alta que o rolo mas que cabe deitada não pede emenda nem redução", () => {
      const resultado = factibilidade(800, 1500, [bobina(1200)]);
      expect(resultado.status_factibilidade).toBe("APTO_NESTING");
      expect(resultado.fator_escala_minimo_para_caber).toBe(1);
      expect(resultado.detalhes_corte.quantidade_emendas).toBe(0);
    });

    it("bobina: peça que não cabe nem girada continua exigindo emenda", () => {
      const resultado = factibilidade(1300, 1300, [bobina(1200)]);
      expect(resultado.status_factibilidade).toBe("REQUER_APROVACAO_EMENDA");
    });

    it("escovado (veio): a peça não gira 90°, então a que só cabe girada exige emenda; livre aceita", () => {
      expect(factibilidade(800, 1500, [chapa()], "livre").status_factibilidade).toBe("APTO_NESTING");
      expect(factibilidade(800, 1500, [chapa()], "veio").status_factibilidade).toBe("REQUER_APROVACAO_EMENDA");
      expect(factibilidade(1500, 800, [chapa()], "veio").status_factibilidade).toBe("APTO_NESTING");
    });
  });

  describe("nesting do escovado", () => {
    it("só avalia a chapa com o lado maior em X e mantém as peças a 0°/180°", async () => {
      const { resultados, falhas } = await nestar(1500, 800, [chapa()], { rotacao: "veio" });
      expect(falhas).toEqual([]);
      const [material] = resultados;
      expect(material.chapa).toEqual({ largura_mm: 2440, altura_mm: 1220 });
      expect(material.posicionamentos.every(p => p.rotacaoGraus === 0 || p.rotacaoGraus === 180)).toBe(true);
      expect(material.formatos_avaliados.filter(f => f.status === "apto")).toHaveLength(1);
    });

    it("não vira a chapa para esconder a rotação proibida: peça 800×1500 no escovado é recusada com aviso claro", async () => {
      const { resultados, falhas } = await nestar(800, 1500, [chapa()], { rotacao: "veio" });
      expect(resultados).toEqual([]);
      expect(falhas[0].codigo).toBe("no_fit");
      expect(falhas[0].mensagem).toMatch(/só admite 0°\/180° \(veio\)/);
    });

    it("sem a regra do escovado a mesma peça cabe, girada 90°", async () => {
      const { resultados } = await nestar(800, 1500, [chapa()], { rotacao: "livre" });
      expect(resultados[0].posicionamentos[0].rotacaoGraus).toBe(90);
    });
  });

  describe("alerta antes do motor: peça maior que a área útil", () => {
    it("bobina: explica a largura útil do rolo (menos a margem) e sugere bobina mais larga", async () => {
      const { resultados, falhas } = await nestar(1300, 1300, [bobina(1200)], { margemBordaMm: 10 });
      expect(resultados).toEqual([]);
      expect(falhas[0].mensagem).toMatch(/largura mínima de 1300 mm/);
      expect(falhas[0].mensagem).toMatch(/largura útil de 1180 mm \(rolo de 1200 mm menos 20 mm de margem de borda\)/);
      expect(falhas[0].mensagem).toMatch(/bobina mais larga/);
      expect(falhas[0].mensagem).not.toMatch(/chapa maior/);
    });

    it("chapa: cita a área útil depois da margem e sugere emenda, redução ou chapa maior", async () => {
      const { falhas } = await nestar(1300, 1300, [chapa()], { margemBordaMm: 10 });
      expect(falhas[0].codigo).toBe("no_fit");
      expect(falhas[0].mensagem).toMatch(/área útil de 2420 × 1200 mm/);
      expect(falhas[0].mensagem).toMatch(/aprove a emenda/);
      expect(falhas[0].mensagem).toMatch(/chapa maior/);
    });

    it("margem que consome todo o formato é avisada em vez de falhar no motor", async () => {
      const { falhas } = await nestar(100, 100, [bobina(90)], { margemBordaMm: 50 });
      expect(falhas[0].mensagem).toMatch(/deixa sem área útil/);
    });

    it("peça que cabe girada em ângulo qualquer não é recusada (a conferência só barra o impossível)", async () => {
      // Losango de lado 100 mm (diagonal 141 mm): a menor largura é 100 mm, e cabe numa faixa de 105 mm.
      const d = "M70.711 0 L141.421 70.711 L70.711 141.421 L0 70.711 Z";
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 141.421 141.421" width="141.421mm" height="141.421mm"><path d="' + d + '"/></svg>';
      const medidas = medidasDaPeca({ id: "losango", svg, larguraMm: 141.421, alturaMm: 141.421 });
      expect(medidas.menorLarguraMm).toBeCloseTo(100, 2);
      expect(medidas.larguraMm).toBeCloseTo(141.421, 2);
      const { falhas } = await calcularNestingMultiMaterialParcial({
        pecas: [{ id: "losango", svg, larguraMm: 141.421, alturaMm: 141.421 }], espacamentoMm: 0, margemBordaMm: 0,
        materiais: [{ id: 1, nome: "Material", custoUnitario: 10, unidadeCusto: "m²", chapas: [bobina(105)] }],
      });
      expect(falhas.every(f => !/largura mínima/.test(f.mensagem))).toBe(true);
    });
  });
});
