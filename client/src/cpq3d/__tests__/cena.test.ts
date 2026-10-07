// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { presetPbr } from "@shared/cpq-render3d-presets";
import { construirCena, ProfundidadeAusenteError, type DesenhoSpec } from "../cena";
import { createPhysicalMaterial, familiaAceitaCorDaRegiao } from "../materialLibrary";
import { configurarTextura } from "../textureLoader";
import * as THREE from "three";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><g id="Face">
<path d="M10 5 L40 5 L40 35 L10 35 Z M20 15 L30 15 L30 25 L20 25 Z" fill="#fff" fill-rule="evenodd" stroke="#000"/>
<path d="M60 5 L90 5 L90 35 L60 35 Z" fill="#fff" stroke="#000"/></g></svg>`;

const material = (id: number, role: DesenhoSpec["materials"][number]["role"], family: DesenhoSpec["materials"][number]["family"], thicknessMm: number | null) => ({
  mubisysMateriaPrimaId: id, role, family, thicknessMm, pbr: presetPbr(family), assets: [], estimated: false,
});

function spec(parcial: Partial<DesenhoSpec> = {}, construcao: Partial<DesenhoSpec["construction"]> = {}): DesenhoSpec {
  return {
    specHash: "a".repeat(64),
    svg: SVG,
    widthMm: 800,
    heightMm: 300,
    construction: {
      kind: "frontlight", boxDepthMm: 80, wallStandoffMm: 30, faceLipMm: 0, returnSheetThicknessMm: 1.5, backThicknessMm: 10, faceThicknessMm: 3,
      ledPitchMm: 60, ledModuleWidthMm: 20, ledModuleHeightMm: 10, ledEdgeClearanceMm: 15, ledCount: null, fixingTypes: ["barra_roscada"], ...construcao,
    },
    regions: [],
    defaultFaceMaterialId: 1,
    materials: [material(1, "face", "acrylic_translucent", 3), material(2, "profile", "aluminum_profile", 1.5), material(3, "back", "expanded_pvc", 10), material(4, "led", "led_module", null)],
    ...parcial,
  };
}

describe("montagem da cena a partir do spec", () => {
  it("monta face, lateral oca, fundo, LEDs e fixadores com as medidas do spec", () => {
    const cena = construirCena(spec());
    expect(cena.profundidadeM).toBeCloseTo(0.08, 9);
    expect(cena.faceEspessuraM).toBeCloseTo(0.003, 9);
    expect(cena.fundoEspessuraM).toBeCloseTo(0.01, 9);
    expect(cena.laterEspessuraM).toBeCloseTo(0.0015, 9);
    expect(cena.larguraM).toBeCloseTo(0.8, 9);
    expect(cena.silhueta).toHaveLength(2);
    expect(cena.parede).not.toBeNull();
    expect(cena.fundo?.regioes.length).toBe(2);
    expect(cena.leds?.pontos.length).toBeGreaterThan(0);
    expect(cena.fixadores.length).toBeGreaterThan(0);
    expect(cena.halo).toEqual([]); // só o backlight tem halo
    expect(cena.avisos).toEqual([]);
  });

  it("cores por região: cada pathIndex vai para o grupo da sua cor/material", () => {
    const cena = construirCena(spec({
      regions: [
        { regionKey: "a", pathIndexes: [0], colorHex: "#0044aa", materialId: 1, profileId: 11 },
        { regionKey: "b", pathIndexes: [1], colorHex: "#ffffff", materialId: 1, profileId: 11 },
      ],
    }));
    expect(cena.grupos.map(grupo => grupo.colorHex).sort()).toEqual(["#0044aa", "#ffffff"]);
    expect(cena.grupos.reduce((total, grupo) => total + grupo.regioes.length, 0)).toBe(2);
    const azul = cena.grupos.find(grupo => grupo.colorHex === "#0044aa")!;
    expect(azul.regioes[0].holes).toHaveLength(1); // o vazado da primeira letra continua no grupo
  });

  it("backlight gera o halo seguindo a silhueta (camadas deslocadas); sem iluminação não há LED", () => {
    const backlight = construirCena(spec({}, { kind: "backlight" }));
    expect(backlight.halo.length).toBeGreaterThan(3);
    const apagado = construirCena(spec({}, { kind: "non_illuminated" }));
    expect(apagado.leds).toBeNull();
    expect(apagado.halo).toEqual([]);
  });

  it("quantidade física de LEDs da composição é respeitada exatamente", () => {
    const cena = construirCena(spec({}, { ledCount: 25 }));
    expect(cena.leds?.pontos).toHaveLength(25);
  });

  it("sem sem fixação não desenha fixadores; sem lateral/fundo na composição a peça é omitida", () => {
    const semFixacao = construirCena(spec({}, { fixingTypes: [] }));
    expect(semFixacao.fixadores).toEqual([]);
    const reduzido = construirCena(spec({ materials: [material(1, "face", "acrylic_translucent", 3)] }));
    expect(reduzido.parede).toBeNull();
    expect(reduzido.fundo).toBeNull();
  });

  it("profundidade ausente interrompe; espessura ausente usa valor VISUAL e avisa", () => {
    expect(() => construirCena(spec({}, { boxDepthMm: 0 }))).toThrow(ProfundidadeAusenteError);
    const sem = spec({ materials: [material(1, "face", "acrylic_translucent", null), material(2, "profile", "aluminum_profile", null), material(3, "back", "expanded_pvc", null)] }, { faceThicknessMm: 0, backThicknessMm: 0, returnSheetThicknessMm: 0 });
    const cena = construirCena(sem);
    expect(cena.avisos.filter(aviso => aviso.includes("não cadastrada"))).toHaveLength(3);
  });

  it("SVG inseguro ou com proporção diferente das medidas é recusado", () => {
    expect(() => construirCena(spec({ svg: SVG.replace("<g", "<script>1</script><g") }))).toThrow(/recusado/);
    expect(() => construirCena(spec({ widthMm: 800, heightMm: 600 }))).toThrow(/proporção/);
  });
});

describe("materiais físicos", () => {
  it("acrílico usa transmissão/IOR/espessura (opacity 1); a cor da arte só vale em famílias que a aceitam", () => {
    const acrilico = createPhysicalMaterial({ pbr: presetPbr("acrylic_translucent"), family: "acrylic_translucent", thicknessMm: 3 }, {}, false, { corHex: "#0044aa" });
    expect(acrilico.opacity).toBe(1);
    expect(acrilico.transmission).toBeCloseTo(0.68, 2);
    expect(acrilico.ior).toBeCloseTo(1.49, 2);
    expect(acrilico.thickness).toBeCloseTo(0.003, 9);
    expect(acrilico.color.getHexString()).toBe("0044aa");
    const inox = createPhysicalMaterial({ pbr: presetPbr("stainless_brushed"), family: "stainless_brushed", thicknessMm: 1 }, {}, false, { corHex: "#ff0000" });
    expect(inox.color.getHexString()).not.toBe("ff0000");
    expect(inox.metalness).toBe(1);
    expect(inox.anisotropy).toBeCloseTo(0.9, 2);
    expect(familiaAceitaCorDaRegiao("galvanized_pu")).toBe(false);
  });

  it("pintura PU é dielétrica (não metal exposto) e a emissão só existe em construção iluminada", () => {
    const pu = createPhysicalMaterial({ pbr: presetPbr("galvanized_pu"), family: "galvanized_pu", thicknessMm: 1 }, {}, false);
    expect(pu.metalness).toBeLessThan(0.2);
    const noite = createPhysicalMaterial({ pbr: presetPbr("acrylic_translucent"), family: "acrylic_translucent", thicknessMm: 3 }, {}, true);
    const apagado = createPhysicalMaterial({ pbr: presetPbr("acrylic_translucent"), family: "acrylic_translucent", thicknessMm: 3 }, {}, true, { iluminada: false });
    expect(noite.emissiveIntensity).toBeGreaterThan(0.3);
    expect(apagado.emissiveIntensity).toBe(0);
  });

  it("espaço de cor por tipo de mapa e repeat pelo tamanho real do tile", () => {
    const cor = configurarTextura(new THREE.Texture(), { colorSpace: "srgb", tileWidthMm: 200, tileHeightMm: 100 }, 8);
    expect(cor.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(cor.wrapS).toBe(THREE.RepeatWrapping);
    expect(cor.repeat.x).toBeCloseTo(5, 9); // 1 m / 0,2 m
    expect(cor.repeat.y).toBeCloseTo(10, 9);
    expect(cor.anisotropy).toBe(8);
    const dados = configurarTextura(new THREE.Texture(), { colorSpace: "none", tileWidthMm: null, tileHeightMm: null }, 1);
    expect(dados.colorSpace).toBe(THREE.NoColorSpace);
    expect(dados.repeat.x).toBe(1);
  });
});
