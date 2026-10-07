// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { presetPbr } from "@shared/cpq-render3d-presets";
import {
  afastamentoGeral,
  duracaoDaAnimacao,
  FIM_DO_ENCAIXE_S,
  PARTES_MONTAGEM,
  POSE_FINAL_MONTAGEM,
  POSE_INICIAL_MONTAGEM,
  quadroDaMontagem,
  suavizar,
} from "../animacaoMontagem";
import { cenaIluminada, construirCena, type DesenhoSpec } from "../cena";
import { createPhysicalMaterial, emissaoDaFace, faceAcendeComLed, INTENSIDADE_FACE_ACESA } from "../materialLibrary";
import { instantesDoGif } from "../gifQuadros";

describe("linha do tempo da montagem", () => {
  it("começa com todas as peças afastadas, de dia e com a câmera na pose aberta", () => {
    const quadro = quadroDaMontagem(0, true);
    for (const parte of PARTES_MONTAGEM) expect(quadro.partes[parte]).toBe(1);
    expect(quadro.noite).toBe(0);
    expect(quadro.azimute).toBeCloseTo(POSE_INICIAL_MONTAGEM.azimute, 9);
    expect(quadro.elevacao).toBeCloseTo(POSE_INICIAL_MONTAGEM.elevacao, 9);
  });

  it("encaixa de trás para a frente: fixadores, fundo, LEDs, retorno e por último a face", () => {
    const chegada = PARTES_MONTAGEM.map(parte => {
      for (let t = 0; t <= FIM_DO_ENCAIXE_S + 0.01; t += 0.01) if (quadroDaMontagem(t, true).partes[parte] <= 0.001) return t;
      return Infinity;
    });
    expect(chegada).toEqual([...chegada].sort((a, b) => a - b));
    expect(chegada.every(Number.isFinite)).toBe(true);
    expect(chegada[chegada.length - 1]).toBeLessThanOrEqual(FIM_DO_ENCAIXE_S + 0.02);
    // a ordem do array é a ordem física de encaixe
    expect(PARTES_MONTAGEM).toEqual(["fixadores", "fundo", "leds", "retorno", "face"]);
  });

  it("os afastamentos nunca saem de 0..1 (a peça não atravessa as vizinhas) e só diminuem", () => {
    const anterior = Object.fromEntries(PARTES_MONTAGEM.map(parte => [parte, 1])) as Record<(typeof PARTES_MONTAGEM)[number], number>;
    for (let t = 0; t <= duracaoDaAnimacao(true); t += 0.02) {
      const { partes } = quadroDaMontagem(t, true);
      for (const parte of PARTES_MONTAGEM) {
        expect(partes[parte]).toBeGreaterThanOrEqual(0);
        expect(partes[parte]).toBeLessThanOrEqual(1);
        expect(partes[parte]).toBeLessThanOrEqual(anterior[parte] + 1e-9);
        anterior[parte] = partes[parte];
      }
    }
  });

  it("termina com tudo encaixado, câmera na pose final e, se iluminado, de noite (letreiro aceso)", () => {
    const aceso = quadroDaMontagem(duracaoDaAnimacao(true), true);
    expect(afastamentoGeral(aceso.partes)).toBe(0);
    expect(aceso.noite).toBe(1);
    expect(aceso.azimute).toBeCloseTo(POSE_FINAL_MONTAGEM.azimute, 9);
    const apagado = quadroDaMontagem(duracaoDaAnimacao(false), false);
    expect(afastamentoGeral(apagado.partes)).toBe(0);
    expect(apagado.noite).toBe(0);
  });

  it("só acende depois de tudo encaixado, e a versão sem iluminação é mais curta", () => {
    expect(quadroDaMontagem(FIM_DO_ENCAIXE_S - 0.01, true).noite).toBe(0);
    expect(duracaoDaAnimacao(true)).toBeGreaterThan(duracaoDaAnimacao(false));
    expect(quadroDaMontagem(duracaoDaAnimacao(false) - 0.1, false).noite).toBe(0);
  });

  it("é determinística (mesmo tempo, mesmo quadro) e suavizar respeita 0 e 1", () => {
    expect(quadroDaMontagem(3.3, true)).toEqual(quadroDaMontagem(3.3, true));
    expect(suavizar(-1)).toBe(0);
    expect(suavizar(0.5)).toBeCloseTo(0.5, 9);
    expect(suavizar(2)).toBe(1);
  });
});

describe("quadros do GIF", () => {
  it("passos fixos de 60 ms que terminam exatamente no fim da animação", () => {
    const instantes = instantesDoGif(true);
    expect(instantes[0]).toBe(0);
    expect(instantes[1]).toBeCloseTo(0.06, 9);
    expect(instantes[instantes.length - 1]).toBeCloseTo(duracaoDaAnimacao(true), 9);
    expect(instantes.length).toBeGreaterThan(100);
    expect(instantes.length).toBeLessThan(200); // GIF de poucos MB
    expect(instantesDoGif(false).length).toBeLessThan(instantes.length);
  });
});

describe("letreiro aceso à noite", () => {
  const material = (id: number, role: DesenhoSpec["materials"][number]["role"], family: DesenhoSpec["materials"][number]["family"]) => ({
    mubisysMateriaPrimaId: id, role, family, thicknessMm: role === "led" ? null : 3, pbr: presetPbr(family), assets: [], estimated: false,
  });
  const spec = (kind: DesenhoSpec["construction"]["kind"], materiais: DesenhoSpec["materials"]): DesenhoSpec => ({
    specHash: "b".repeat(64),
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><g id="Face"><path d="M10 5 L90 5 L90 35 L10 35 Z" fill="#fff" stroke="#000"/></g></svg>`,
    widthMm: 800,
    heightMm: 300,
    construction: {
      kind, boxDepthMm: 80, wallStandoffMm: 30, faceLipMm: 0, returnSheetThicknessMm: 1.5, backThicknessMm: 10, faceThicknessMm: 3,
      ledPitchMm: 60, ledModuleWidthMm: 20, ledModuleHeightMm: 10, ledEdgeClearanceMm: 15, ledCount: null, fixingTypes: [],
    },
    regions: [],
    defaultFaceMaterialId: 1,
    materials: materiais,
  });
  const comLed = [material(1, "face", "acrylic_translucent"), material(2, "profile", "aluminum_profile"), material(3, "back", "expanded_pvc"), material(4, "led", "led_module")];

  it("acende quando a construção é iluminada ou quando a composição tem módulos de LED (mesmo com o kit sem iluminação)", () => {
    expect(cenaIluminada(spec("frontlight", comLed))).toBe(true);
    expect(cenaIluminada(spec("non_illuminated", comLed))).toBe(true);
    expect(cenaIluminada(spec("non_illuminated", comLed.filter(item => item.role !== "led")))).toBe(false);
  });

  it("kit sem iluminação com LED na composição monta os módulos e avisa; sem LED não monta", () => {
    const cena = construirCena(spec("non_illuminated", comLed));
    expect(cena.leds?.pontos.length).toBeGreaterThan(0);
    expect(cena.avisos.some(aviso => aviso.includes("mostra o letreiro aceso"))).toBe(true);
    expect(construirCena(spec("non_illuminated", comLed.filter(item => item.role !== "led"))).leds).toBeNull();
  });

  it("a face de acrílico (ou ainda sem perfil visual) acende com os LEDs; metal e PVC não", () => {
    expect(faceAcendeComLed("acrylic_translucent", presetPbr("acrylic_translucent"))).toBe(true);
    expect(faceAcendeComLed("acrylic_solid", presetPbr("acrylic_solid"))).toBe(true);
    expect(faceAcendeComLed("generic_dielectric", presetPbr("generic_dielectric"))).toBe(true);
    expect(faceAcendeComLed("expanded_pvc", presetPbr("expanded_pvc"))).toBe(false);
    expect(faceAcendeComLed("stainless_brushed", presetPbr("stainless_brushed"))).toBe(false);
    expect(faceAcendeComLed("expanded_pvc", { ...presetPbr("expanded_pvc"), transmission: 0.4 })).toBe(true); // PVC translúcido
  });

  it("a emissão sobe do dia para a noite e uma face acesa nunca fica abaixo do mínimo, mesmo em perfil sem emissão", () => {
    const semEmissao = presetPbr("generic_dielectric");
    expect(emissaoDaFace(semEmissao, 0, true)).toBe(0);
    expect(emissaoDaFace(semEmissao, 1, true)).toBeCloseTo(INTENSIDADE_FACE_ACESA, 9);
    expect(emissaoDaFace(semEmissao, 1, false)).toBe(0); // face opaca: não acende
    const acrilico = presetPbr("acrylic_translucent");
    expect(emissaoDaFace(acrilico, 1, true)).toBeCloseTo(Math.max(acrilico.emissiveIntensityNight, INTENSIDADE_FACE_ACESA), 9);
    expect(emissaoDaFace(acrilico, 0.5, true)).toBeGreaterThan(emissaoDaFace(acrilico, 0, true));
  });

  it("face acesa emite na própria cor (a cor do material/região), não em branco", () => {
    const pbr = presetPbr("generic_dielectric");
    const aceso = createPhysicalMaterial({ pbr, family: "generic_dielectric", thicknessMm: 3 }, {}, true, { corHex: "#c0392b", iluminada: true, faceAcende: true });
    expect(aceso.emissive.getHexString()).toBe("c0392b");
    expect(aceso.emissiveIntensity).toBeCloseTo(INTENSIDADE_FACE_ACESA, 9);
    const apagado = createPhysicalMaterial({ pbr, family: "generic_dielectric", thicknessMm: 3 }, {}, true, { corHex: "#c0392b", iluminada: false, faceAcende: false });
    expect(apagado.emissiveIntensity).toBe(0);
  });
});
