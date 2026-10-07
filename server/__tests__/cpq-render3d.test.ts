import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  jsonCanonico,
  render3dSnapshotSchema,
  sugerirRenderRole,
  type CpqRender3dKitConstruction,
  type CpqRenderRole,
} from "../../shared/cpq-render3d";
import { presetPbr } from "../../shared/cpq-render3d-presets";
import { emitirTicketAnaliseFactibilidade } from "../services/cpqFactibilidadeFabricacao";
import {
  CpqRender3dError,
  chaveVinculo,
  emitirTicketRender3d,
  hashCpqRender3dSpec,
  montarBlocoSnapshot,
  resolveCpqRender3dSpec,
  verificarRender3dNaEmissao,
  verifyCpqRender3dTicket,
  visaoPublicaDoSpec,
  type CpqRender3dFonte,
  type DadosMateriaRender,
  type VinculoVisualResolvido,
} from "../services/cpqRender3d";

const SOURCE = "cot-teste-3d";
const USER = { id: "u-1", name: "Vendedor Teste", role: "vendas" };

// Duas letras retangulares (a primeira com um vazado) num viewBox 100×40; caixa dos contornos = 80×30 unidades.
const SVG = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40">`,
  `<g id="Face">`,
  `<path d="M10 5 L40 5 L40 35 L10 35 Z M20 15 L30 15 L30 25 L20 25 Z" fill="#fff" stroke="#000"/>`,
  `<path d="M60 5 L90 5 L90 35 L60 35 Z" fill="#fff" stroke="#000"/>`,
  `</g></svg>`,
].join("");
const sha = (valor: string) => createHash("sha256").update(valor).digest("hex");

const CONSTRUCAO: CpqRender3dKitConstruction = {
  kind: "frontlight",
  boxDepthMm: 80,
  wallStandoffMm: 30,
  faceLipMm: 0,
  ledPitchMm: 60,
  ledEdgeClearanceMm: 15,
};

const ACRILICO = 1001, PERFIL = 1002, FUNDO = 1003, LED = 1004, ACRILICO_AZUL = 1005;

function perfil(id: number, familia: VinculoVisualResolvido["perfil"]["familia"], calibrado = true, versao = 1): VinculoVisualResolvido {
  return { perfil: { id, versao, nome: `Perfil ${id}`, familia, calibrado, pbr: presetPbr(familia), assets: [] }, overrides: null };
}

function fonte(opcoes: {
  construcao?: CpqRender3dKitConstruction | null;
  vinculos?: Record<string, VinculoVisualResolvido>;
  materias?: Record<number, Partial<DadosMateriaRender>>;
} = {}): CpqRender3dFonte {
  const construcao = opcoes.construcao === undefined ? CONSTRUCAO : opcoes.construcao;
  const vinculos = opcoes.vinculos ?? {
    [chaveVinculo(ACRILICO, "face")]: perfil(11, "acrylic_translucent"),
    [chaveVinculo(ACRILICO_AZUL, "face")]: perfil(12, "acrylic_translucent"),
    [chaveVinculo(PERFIL, "profile")]: perfil(13, "aluminum_profile"),
    [chaveVinculo(FUNDO, "back")]: perfil(14, "expanded_pvc"),
    [chaveVinculo(LED, "led")]: perfil(15, "led_module"),
  };
  const base: Record<number, DadosMateriaRender> = {
    [ACRILICO]: { id: ACRILICO, usaChapa: true, usaBobina: false, usaPerfil: false, temFormatoChapa: true, espessuraMm: 3, perfilAlturaMm: null, perfilLarguraMm: null },
    [ACRILICO_AZUL]: { id: ACRILICO_AZUL, usaChapa: true, usaBobina: false, usaPerfil: false, temFormatoChapa: true, espessuraMm: 3, perfilAlturaMm: null, perfilLarguraMm: null },
    [PERFIL]: { id: PERFIL, usaChapa: false, usaBobina: false, usaPerfil: true, temFormatoChapa: false, espessuraMm: 1.5, perfilAlturaMm: 80, perfilLarguraMm: 20 },
    [FUNDO]: { id: FUNDO, usaChapa: true, usaBobina: false, usaPerfil: false, temFormatoChapa: true, espessuraMm: 10, perfilAlturaMm: null, perfilLarguraMm: null },
    [LED]: { id: LED, usaChapa: false, usaBobina: false, usaPerfil: false, temFormatoChapa: false, espessuraMm: null, perfilAlturaMm: null, perfilLarguraMm: null },
  };
  return {
    async construcaoDoKit() { return construcao; },
    async materias(ids) {
      return new Map(ids.flatMap(id => (base[id] ? [[id, { ...base[id], ...opcoes.materias?.[id] }] as const] : [])));
    },
    async vinculos(pedidos) {
      const mapa = new Map<string, VinculoVisualResolvido>();
      for (const pedido of pedidos) {
        const vinculo = vinculos[chaveVinculo(pedido.materiaPrimaId, pedido.role)];
        if (vinculo) mapa.set(chaveVinculo(pedido.materiaPrimaId, pedido.role), vinculo);
      }
      return mapa;
    },
  };
}

function linha(id: number, nome: string, papel: string, renderRole: CpqRenderRole | null, extra: Record<string, unknown> = {}) {
  return { mubisysMateriaPrimaId: id, nome, unidade: "m2", quantidade: 1, papel, renderRole, ...extra };
}

function orcamento(sobrescritas: Record<string, unknown> = {}) {
  return {
    mubisysProdutoId: 10,
    mubisysModeloId: 20,
    nestingSvg: SVG,
    larguraNestingMm: 800,
    alturaNestingMm: 300,
    factibilidade: {
      resultadoHash: "a".repeat(64),
      ticketAnalise: emitirTicketAnaliseFactibilidade({
        sourceId: SOURCE, resultadoHash: "a".repeat(64), hashSvgEntrada: sha(SVG), detalhesCorteHash: "b".repeat(64),
        statusFactibilidade: "APTO_NESTING", fatorEscalaAplicado: 1, fatorEscalaMinimoParaCaber: 1, hashSvgRedimensionadoOpcao: null, materiais: [],
      }),
    },
    tiposFixacao: ["barra_roscada"],
    materiais: [
      linha(ACRILICO, "Acrílico branco 3mm", "Face", "face"),
      linha(PERFIL, "Perfil lateral 80mm", "Lateral", "profile"),
      linha(FUNDO, "PVC 10mm", "Fundo", "back"),
      linha(LED, "Módulo LED", "Iluminação", "led", { unidade: "un", quantidade: 40 }),
    ],
    mapeamentoCores: null,
    ...sobrescritas,
  };
}

const resolver = (snapshot: unknown, f: CpqRender3dFonte = fonte()) => resolveCpqRender3dSpec({ sourceId: SOURCE, snapshot, user: USER, fonte: f });
const codigos = (spec: Awaited<ReturnType<typeof resolver>>) => spec.blockers.map(item => item.code);

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 ? process.env.JWT_SECRET : "teste-render3d-segredo-com-mais-de-32-caracteres";
});

describe("papel 3D sugerido a partir do papel na peça", () => {
  it("sugere só quando inequívoco e distingue perfil de chapa na lateral", () => {
    expect(sugerirRenderRole("Face")).toBe("face");
    expect(sugerirRenderRole("Aro")).toBe("return");
    expect(sugerirRenderRole("Lateral", { ehPerfil: true })).toBe("profile");
    expect(sugerirRenderRole("Lateral", { ehPerfil: false })).toBe("return");
    expect(sugerirRenderRole("Fundo")).toBe("back");
    expect(sugerirRenderRole("Iluminação")).toBe("led");
    expect(sugerirRenderRole("Fixação")).toBe("fixing");
    expect(sugerirRenderRole("Pintura")).toBe("finish");
    expect(sugerirRenderRole("Insumo fabricação")).toBe("ignored");
    expect(sugerirRenderRole("Face e fundo")).toBeNull();
    expect(sugerirRenderRole("")).toBeNull();
    expect(sugerirRenderRole(null)).toBeNull();
  });
});

describe("spec 3D: composição completa", () => {
  it("monta o spec sem pendências quando papéis, medidas e perfis estão cadastrados", async () => {
    const spec = await resolver(orcamento());
    expect(spec.blockers).toEqual([]);
    expect(spec.specHash).toMatch(/^[a-f0-9]{64}$/);
    expect(spec.vectorHash).toBe(sha(SVG));
    expect(spec.widthMm).toBe(800);
    expect(spec.construction).toMatchObject({
      kind: "frontlight", boxDepthMm: 80, faceThicknessMm: 3, returnSheetThicknessMm: 1.5, backThicknessMm: 10, ledCount: 40, fixingTypes: ["barra_roscada"],
    });
    expect(spec.materials.map(m => `${m.role}:${m.mubisysMateriaPrimaId}`)).toEqual([
      "back:1003", "face:1001", "led:1004", "profile:1002",
    ]);
    expect(spec.materials.every(m => !m.estimated)).toBe(true);
    expect(spec.defaultFaceMaterialId).toBe(ACRILICO);
  });

  it("usa as espessuras do cadastro (não as do navegador) e avisa quando profundidade e perfil divergem", async () => {
    const spec = await resolver(orcamento(), fonte({ construcao: { ...CONSTRUCAO, boxDepthMm: 100 } }));
    expect(spec.blockers).toEqual([]);
    expect(spec.warnings.some(aviso => aviso.includes("difere da altura cadastrada"))).toBe(true);
  });

  it("regiões multicoloridas usam pathIndexes e a chapa/base aprovada", async () => {
    const spec = await resolver(orcamento({
      materiais: [
        linha(ACRILICO, "Acrílico branco", "Face", "face"), linha(ACRILICO_AZUL, "Acrílico azul", "Face", "face"),
        linha(PERFIL, "Perfil", "Lateral", "profile"), linha(FUNDO, "PVC", "Fundo", "back"), linha(LED, "LED", "Iluminação", "led", { unidade: "un", quantidade: 10 }),
      ],
      mapeamentoCores: {
        aprovado: true,
        regioes: [
          { regionKey: "cor-1", corHex: "#0044aa", pathIndexes: [0], tipoSugestao: "chapa", chapaMateriaPrimaId: ACRILICO_AZUL },
          { regionKey: "cor-2", corHex: "#ffffff", pathIndexes: [1], tipoSugestao: "impresso", chapaBaseMateriaPrimaId: null, requerChapaBase: false },
        ],
      },
    }));
    expect(spec.blockers).toEqual([]);
    expect(spec.regions).toEqual([
      expect.objectContaining({ regionKey: "cor-1", pathIndexes: [0], colorHex: "#0044aa", materialId: ACRILICO_AZUL, profileId: 12 }),
      expect.objectContaining({ regionKey: "cor-2", pathIndexes: [1], colorHex: "#ffffff", materialId: ACRILICO, profileId: 11 }),
    ]);
    expect(spec.materials.filter(m => m.role === "face").map(m => m.mubisysMateriaPrimaId).sort()).toEqual([ACRILICO, ACRILICO_AZUL]);
  });

  it("região com índice fora do desenho (contorno de corte) cai na face padrão com aviso", async () => {
    const spec = await resolver(orcamento({
      mapeamentoCores: { aprovado: true, regioes: [{ regionKey: "cor-9", corHex: "#ff0000", pathIndexes: [7], tipoSugestao: "chapa", chapaMateriaPrimaId: ACRILICO }] },
    }));
    expect(spec.warnings.some(aviso => aviso.includes("não podem ser distribuídas"))).toBe(true);
    expect(spec.regions[0]).toMatchObject({ pathIndexes: [], colorHex: "#ff0000", materialId: ACRILICO });
  });
});

describe("spec 3D: aparência cadastrada na matéria-prima (migration 0094)", () => {
  const corCadastrada = (corHex: string | null, modo: "nao_informada" | "cor" | "textura" = "cor", corDescricao: string | null = null) =>
    ({ aparencia: { modo, corHex, corDescricao, texturaDescricao: null } });
  const corDaFace = (spec: Awaited<ReturnType<typeof resolver>>) => spec.materials.find(m => m.role === "face")!;

  it("a cor HEX cadastrada vira a cor do material e é gravada em overrides (snapshot e link público a reproduzem)", async () => {
    const spec = await resolver(orcamento(), fonte({ materias: { [ACRILICO]: corCadastrada("#1A5FB4") } }));
    expect(corDaFace(spec).pbr.colorHex).toBe("#1a5fb4");
    expect(corDaFace(spec).overrides).toEqual({ colorHex: "#1a5fb4" });
    expect(spec.blockers).toEqual([]);
  });

  it("muda o specHash (cor editada na matéria-prima invalida a aprovação) e não muda sem alteração", async () => {
    const azul = await resolver(orcamento(), fonte({ materias: { [ACRILICO]: corCadastrada("#1a5fb4") } }));
    const azulDeNovo = await resolver(orcamento(), fonte({ materias: { [ACRILICO]: corCadastrada("#1a5fb4") } }));
    const verde = await resolver(orcamento(), fonte({ materias: { [ACRILICO]: corCadastrada("#26a269") } }));
    expect(azulDeNovo.specHash).toBe(azul.specHash);
    expect(verde.specHash).not.toBe(azul.specHash);
  });

  it("override explícito do vínculo vence a cor cadastrada", async () => {
    const vinculos = {
      [chaveVinculo(ACRILICO, "face")]: { ...perfil(11, "acrylic_translucent"), overrides: { colorHex: "#ff0000" } },
      [chaveVinculo(PERFIL, "profile")]: perfil(13, "aluminum_profile"),
      [chaveVinculo(FUNDO, "back")]: perfil(14, "expanded_pvc"),
      [chaveVinculo(LED, "led")]: perfil(15, "led_module"),
    };
    const spec = await resolver(orcamento(), fonte({ vinculos, materias: { [ACRILICO]: corCadastrada("#1a5fb4") } }));
    expect(corDaFace(spec).pbr.colorHex).toBe("#ff0000");
  });

  it("perfil com mapa de cor próprio não é tingido pela cor cadastrada", async () => {
    const comMapa = perfil(11, "acrylic_translucent");
    comMapa.perfil.assets = [{ id: 1, kind: "baseColor", url: "https://utfs.io/f/x.png", storageKey: "x", mimeType: "image/png", sha256: "a".repeat(64), widthPx: 512, heightPx: 512, tileWidthMm: 100, tileHeightMm: 100, colorSpace: "srgb", sourceNote: null, calibrated: true }];
    const vinculos = {
      [chaveVinculo(ACRILICO, "face")]: comMapa,
      [chaveVinculo(PERFIL, "profile")]: perfil(13, "aluminum_profile"),
      [chaveVinculo(FUNDO, "back")]: perfil(14, "expanded_pvc"),
      [chaveVinculo(LED, "led")]: perfil(15, "led_module"),
    };
    const spec = await resolver(orcamento(), fonte({ vinculos, materias: { [ACRILICO]: corCadastrada("#1a5fb4") } }));
    expect(corDaFace(spec).overrides ?? null).toBeNull();
    expect(corDaFace(spec).pbr.colorHex).toBe(presetPbr("acrylic_translucent").colorHex);
  });

  it("aparência não informada, só descrição de cor ou só foto de textura geram aviso, nunca bloqueio", async () => {
    const semAparencia = await resolver(orcamento(), fonte({ materias: { [ACRILICO]: corCadastrada(null, "nao_informada") } }));
    expect(semAparencia.blockers).toEqual([]);
    expect(semAparencia.warnings.some(aviso => aviso.includes("não tem cor/textura cadastrada"))).toBe(true);

    const soDescricao = await resolver(orcamento(), fonte({ materias: { [ACRILICO]: corCadastrada(null, "cor", "azul royal") } }));
    expect(soDescricao.blockers).toEqual([]);
    expect(soDescricao.warnings.some(aviso => aviso.includes('só a descrição da cor ("azul royal")'))).toBe(true);

    const textura = await resolver(orcamento(), fonte({ materias: { [ACRILICO]: corCadastrada(null, "textura") } }));
    expect(textura.blockers).toEqual([]);
    expect(textura.warnings.some(aviso => aviso.includes("não vira mapa PBR"))).toBe(true);
  });

  it("HEX inválido é ignorado (não tinge) e LED/fixação não geram aviso de aparência", async () => {
    const invalido = await resolver(orcamento(), fonte({ materias: { [ACRILICO]: corCadastrada("azul"), [LED]: corCadastrada(null, "nao_informada") } }));
    expect(corDaFace(invalido).overrides ?? null).toBeNull();
    expect(invalido.warnings.some(aviso => aviso.includes("Módulo LED"))).toBe(false);
  });
});

describe("spec 3D: pendências que impedem a aprovação", () => {
  it("material sem perfil visual usa preset ESTIMADO e bloqueia", async () => {
    const spec = await resolver(orcamento(), fonte({ vinculos: {} }));
    expect(codigos(spec)).toContain("material_sem_vinculo");
    expect(spec.materials.every(m => m.estimated && m.profileId === 0)).toBe(true);
    expect(spec.materials.find(m => m.role === "led")?.family).toBe("led_module");
    expect(spec.materials.find(m => m.role === "face")?.family).toBe("generic_dielectric");
  });

  it("perfil genérico bloqueia; perfil próprio ainda não calibrado só avisa", async () => {
    const generico = await resolver(orcamento(), fonte({ vinculos: {
      [chaveVinculo(ACRILICO, "face")]: perfil(21, "generic_dielectric"),
      [chaveVinculo(PERFIL, "profile")]: perfil(13, "aluminum_profile"),
      [chaveVinculo(FUNDO, "back")]: perfil(14, "expanded_pvc"),
      [chaveVinculo(LED, "led")]: perfil(15, "led_module"),
    } }));
    expect(codigos(generico)).toEqual(["perfil_generico"]);

    const naoCalibrado = await resolver(orcamento(), fonte({ vinculos: {
      [chaveVinculo(ACRILICO, "face")]: perfil(11, "acrylic_translucent", false),
      [chaveVinculo(PERFIL, "profile")]: perfil(13, "aluminum_profile"),
      [chaveVinculo(FUNDO, "back")]: perfil(14, "expanded_pvc"),
      [chaveVinculo(LED, "led")]: perfil(15, "led_module"),
    } }));
    expect(naoCalibrado.blockers).toEqual([]);
    expect(naoCalibrado.warnings.some(aviso => aviso.includes("não foi calibrado"))).toBe(true);
  });

  it("papel não confirmado ou ambíguo em material físico bloqueia", async () => {
    const naoConfirmado = await resolver(orcamento({
      materiais: [linha(ACRILICO, "Acrílico", "Face", null), linha(PERFIL, "Perfil", "Lateral", "profile"), linha(FUNDO, "PVC", "Fundo", "back"), linha(LED, "LED", "Iluminação", "led", { unidade: "un" })],
    }));
    expect(codigos(naoConfirmado)).toContain("papel_nao_confirmado");

    const ambiguo = await resolver(orcamento({
      materiais: [linha(ACRILICO, "Acrílico", "Face e fundo", null), linha(PERFIL, "Perfil", "Lateral", "profile"), linha(FUNDO, "PVC", "Fundo", "back"), linha(LED, "LED", "Iluminação", "led", { unidade: "un" })],
    }));
    expect(codigos(ambiguo)).toContain("papel_ambiguo");
    expect(codigos(ambiguo)).toContain("sem_face");
  });

  it("papel incompatível com o cadastro (perfil em chapa; face em perfil) bloqueia", async () => {
    const spec = await resolver(orcamento({
      materiais: [linha(ACRILICO, "Acrílico", "Lateral", "profile"), linha(PERFIL, "Perfil", "Face", "face"), linha(FUNDO, "PVC", "Fundo", "back"), linha(LED, "LED", "Iluminação", "led", { unidade: "un" })],
    }));
    expect(codigos(spec).filter(codigo => codigo === "papel_incompativel")).toHaveLength(2);
  });

  it("profundidade ausente (kit sem construção 3D) é pendência, sem valor padrão silencioso", async () => {
    const spec = await resolver(orcamento(), fonte({ construcao: null }));
    expect(codigos(spec)).toContain("construcao_ausente");
    expect(spec.construction.boxDepthMm).toBe(0);
  });

  it("profundidade que não comporta face + fundo bloqueia", async () => {
    const spec = await resolver(orcamento(), fonte({ construcao: { ...CONSTRUCAO, boxDepthMm: 12 } }));
    expect(codigos(spec)).toContain("profundidade_insuficiente");
  });

  it("espessura ausente de peça estrutural bloqueia", async () => {
    const spec = await resolver(orcamento(), fonte({ materias: { [FUNDO]: { espessuraMm: null } } }));
    const pendencia = spec.blockers.find(item => item.code === "espessura_ausente");
    expect(pendencia).toMatchObject({ mubisysMateriaPrimaId: FUNDO, field: "espessuraMm" });
    expect(spec.construction.backThicknessMm).toBe(0);
  });

  it("construção iluminada sem LED na composição bloqueia; sem passo nem quantidade também", async () => {
    const semLed = await resolver(orcamento({
      materiais: [linha(ACRILICO, "Acrílico", "Face", "face"), linha(PERFIL, "Perfil", "Lateral", "profile"), linha(FUNDO, "PVC", "Fundo", "back")],
    }));
    expect(codigos(semLed)).toContain("iluminacao_sem_led");
    const semPasso = await resolver(orcamento({
      materiais: [linha(ACRILICO, "Acrílico", "Face", "face"), linha(PERFIL, "Perfil", "Lateral", "profile"), linha(FUNDO, "PVC", "Fundo", "back"), linha(LED, "Fita LED", "Iluminação", "led", { unidade: "m", quantidade: 5 })],
    }), fonte({ construcao: { ...CONSTRUCAO, ledPitchMm: null } }));
    expect(codigos(semPasso)).toContain("led_passo_ausente");
    expect(semPasso.construction.ledCount).toBeNull();
  });

  it("kit sem iluminação não exige LED", async () => {
    const spec = await resolver(orcamento({
      materiais: [linha(ACRILICO, "Acrílico", "Face", "face"), linha(PERFIL, "Perfil", "Lateral", "profile"), linha(FUNDO, "PVC", "Fundo", "back")],
    }), fonte({ construcao: { ...CONSTRUCAO, kind: "non_illuminated", ledPitchMm: null } }));
    expect(spec.blockers).toEqual([]);
  });

  it("SVG com script, imagem ou href externo é recusado; sem factibilidade e com proporção errada também", async () => {
    const ruim = await resolver(orcamento({ nestingSvg: SVG.replace("<g", `<script>alert(1)</script><g`) }));
    expect(codigos(ruim)).toContain("svg_invalido");
    const externo = await resolver(orcamento({ nestingSvg: SVG.replace("<g", `<image href="https://x.test/a.png"/><g`) }));
    expect(codigos(externo)).toContain("svg_invalido");

    const semFactibilidade = await resolver(orcamento({ factibilidade: null }));
    expect(codigos(semFactibilidade)).toContain("factibilidade_ausente");

    const outroSvg = await resolver(orcamento({ nestingSvg: SVG.replace("M60 5", "M61 5") }));
    expect(codigos(outroSvg)).toContain("svg_divergente");

    const proporcao = await resolver(orcamento({ larguraNestingMm: 800, alturaNestingMm: 600 }));
    expect(codigos(proporcao)).toContain("proporcao_incompativel");
  });

  it("mapeamento de cores não aprovado bloqueia", async () => {
    const naoAprovado = await resolver(orcamento({ mapeamentoCores: { aprovado: false, regioes: [] } }));
    expect(codigos(naoAprovado)).toContain("cores_nao_aprovadas");
  });

  it("adesivo desconsiderado (região 'pendente' num mapeamento aprovado) usa a face do kit, com aviso e sem bloquear", async () => {
    // Achado no teste real do CPQ (07/10/2026): "O projeto não precisa de adesivo" grava a região como `pendente` e o servidor aprova.
    const spec = await resolver(orcamento({
      mapeamentoCores: { aprovado: true, regioes: [{ regionKey: "cor-1", corHex: "#ffffff", pathIndexes: [0, 1], tipoSugestao: "pendente" }] },
    }));
    expect(codigos(spec)).not.toContain("cor_pendente");
    expect(spec.blockers).toEqual([]);
    expect(spec.regions[0]).toMatchObject({ regionKey: "cor-1", materialId: ACRILICO, profileId: 11 });
    expect(spec.warnings.some(aviso => aviso.includes("sem adesivo"))).toBe(true);
    // Sem face na composição não há com o que cobrir a região: continua pendência.
    const semFace = await resolver(orcamento({
      materiais: [linha(PERFIL, "Perfil", "Lateral", "profile"), linha(FUNDO, "PVC", "Fundo", "back"), linha(LED, "LED", "Iluminação", "led", { unidade: "un" })],
      mapeamentoCores: { aprovado: true, regioes: [{ regionKey: "cor-1", corHex: "#ffffff", pathIndexes: [0], tipoSugestao: "pendente" }] },
    }));
    expect(codigos(semFace)).toEqual(expect.arrayContaining(["sem_face"]));
  });
});

describe("hash da especificação", () => {
  it("muda quando a composição, o papel, a medida ou a profundidade mudam; avisos não entram", async () => {
    const base = await resolver(orcamento());
    const outraMedida = await resolver(orcamento({ larguraNestingMm: 801 }));
    const outraProfundidade = await resolver(orcamento(), fonte({ construcao: { ...CONSTRUCAO, boxDepthMm: 90 } }));
    const semFundo = await resolver(orcamento({
      materiais: [linha(ACRILICO, "Acrílico", "Face", "face"), linha(PERFIL, "Perfil", "Lateral", "profile"), linha(LED, "LED", "Iluminação", "led", { unidade: "un", quantidade: 40 })],
    }));
    const outroPapel = await resolver(orcamento({
      materiais: [linha(ACRILICO, "Acrílico", "Face", "face"), linha(PERFIL, "Perfil", "Lateral", "return", {}), linha(FUNDO, "PVC", "Fundo", "back"), linha(LED, "LED", "Iluminação", "led", { unidade: "un", quantidade: 40 })],
    }), fonte({ materias: { [PERFIL]: { usaPerfil: true } } }));
    const hashes = new Set([base, outraMedida, outraProfundidade, semFundo, outroPapel].map(spec => spec.specHash));
    expect(hashes.size).toBe(5);

    const repetido = await resolver(orcamento());
    expect(repetido.specHash).toBe(base.specHash);
    const { specHash: _h, ticket: _t, ...semAssinatura } = base;
    expect(hashCpqRender3dSpec({ ...semAssinatura, warnings: ["outro aviso"], blockers: [] })).toBe(base.specHash);
  });

  it("nova versão de perfil muda o hash (o snapshot antigo guarda profileId e versão)", async () => {
    const base = await resolver(orcamento());
    const novaVersao = await resolver(orcamento(), fonte({ vinculos: {
      [chaveVinculo(ACRILICO, "face")]: perfil(31, "acrylic_translucent", true, 2),
      [chaveVinculo(PERFIL, "profile")]: perfil(13, "aluminum_profile"),
      [chaveVinculo(FUNDO, "back")]: perfil(14, "expanded_pvc"),
      [chaveVinculo(LED, "led")]: perfil(15, "led_module"),
    } }));
    expect(novaVersao.specHash).not.toBe(base.specHash);
    const antigo = montarBlocoSnapshot(base, { specHash: base.specHash, ticket: "t".repeat(30), approvedAt: new Date().toISOString(), approvedBy: USER, previewDayUrl: null, previewNightUrl: null, previewExplodedUrl: null });
    expect(antigo.materials.find(m => m.role === "face")).toMatchObject({ profileId: 11, profileVersion: 1 });
  });
});

describe("tickets do 3D", () => {
  it("aceita o ticket do próprio orçamento/spec e recusa outro orçamento, outro hash, adulteração e expiração", () => {
    const hash = "c".repeat(64);
    const ticket = emitirTicketRender3d({ kind: "render3d-spec", sourceId: SOURCE, specHash: hash, user: USER });
    expect(verifyCpqRender3dTicket(ticket, SOURCE, hash)).toMatchObject({ sourceId: SOURCE, specHash: hash, userId: USER.id, kind: "render3d-spec" });
    expect(() => verifyCpqRender3dTicket(ticket, "outro-orcamento", hash)).toThrow(CpqRender3dError);
    expect(() => verifyCpqRender3dTicket(ticket, SOURCE, "d".repeat(64))).toThrow(/outro orçamento ou a outra versão/);
    expect(() => verifyCpqRender3dTicket(ticket, SOURCE, hash, "render3d-approval")).toThrow(/outro tipo/);
    const [corpo, assinatura] = ticket.split(".");
    expect(() => verifyCpqRender3dTicket(`${corpo}x.${assinatura}`, SOURCE, hash)).toThrow(/assinatura/);
    expect(() => verifyCpqRender3dTicket("lixo", SOURCE, hash)).toThrow(/inválido/);
    expect(() => verifyCpqRender3dTicket(ticket, SOURCE, hash, "render3d-spec", Date.now() + 3 * 60 * 60 * 1000)).toThrow(/expirou/);
    const aprovacao = emitirTicketRender3d({ kind: "render3d-approval", sourceId: SOURCE, specHash: hash, user: USER });
    expect(() => verifyCpqRender3dTicket(aprovacao, SOURCE, hash, "render3d-approval", Date.now() + 3 * 60 * 60 * 1000)).not.toThrow();
    expect(() => verifyCpqRender3dTicket(aprovacao, SOURCE, hash, "render3d-approval", Date.now() + 8 * 24 * 60 * 60 * 1000)).toThrow(/expirou/);
  });
});

describe("verificação na emissão", () => {
  async function aprovado(snapshot = orcamento(), f = fonte()) {
    const spec = await resolver(snapshot, f);
    expect(spec.blockers).toEqual([]);
    const approvedAt = new Date().toISOString();
    const ticket = emitirTicketRender3d({ kind: "render3d-approval", sourceId: SOURCE, specHash: spec.specHash, vectorHash: spec.vectorHash, user: USER, approvedAt });
    const bloco = montarBlocoSnapshot(spec, {
      specHash: spec.specHash, ticket, approvedAt, approvedBy: USER,
      previewDayUrl: "https://abc.ufs.sh/f/dia.png", previewNightUrl: "https://abc.ufs.sh/f/noite.png", previewExplodedUrl: "https://abc.ufs.sh/f/exp.png",
    });
    return { spec, bloco };
  }

  it("o bloco do snapshot respeita o schema e a emissão passa quando nada mudou", async () => {
    const { bloco } = await aprovado();
    expect(render3dSnapshotSchema.safeParse(bloco).success).toBe(true);
    await expect(verificarRender3dNaEmissao({ sourceId: SOURCE, snapshot: orcamento(), render3d: bloco, user: USER, fonte: fonte() })).resolves.toMatchObject({ specHash: bloco.specHash });
  });

  it("derruba a emissão quando composição, medida, papel, cor, profundidade ou perfil mudam depois da aprovação", async () => {
    const { bloco } = await aprovado();
    const tentar = (snapshot: unknown, f = fonte()) => verificarRender3dNaEmissao({ sourceId: SOURCE, snapshot, render3d: bloco, user: USER, fonte: f });

    await expect(tentar(orcamento({ larguraNestingMm: 810 }))).rejects.toThrow(/mudou depois da aprovação/);
    await expect(tentar(orcamento({ materiais: [linha(ACRILICO, "Acrílico", "Face", "face"), linha(PERFIL, "Perfil", "Lateral", "profile"), linha(LED, "LED", "Iluminação", "led", { unidade: "un", quantidade: 40 })] }))).rejects.toThrow(CpqRender3dError);
    await expect(tentar(orcamento({ mapeamentoCores: { aprovado: true, regioes: [{ regionKey: "cor-1", corHex: "#00ff00", pathIndexes: [0], tipoSugestao: "chapa", chapaMateriaPrimaId: ACRILICO }] } }))).rejects.toThrow(/mudou depois da aprovação/);
    await expect(tentar(orcamento(), fonte({ construcao: { ...CONSTRUCAO, boxDepthMm: 90 } }))).rejects.toThrow(/mudou depois da aprovação/);
    await expect(tentar(orcamento(), fonte({ vinculos: {
      [chaveVinculo(ACRILICO, "face")]: perfil(32, "acrylic_translucent", true, 2),
      [chaveVinculo(PERFIL, "profile")]: perfil(13, "aluminum_profile"),
      [chaveVinculo(FUNDO, "back")]: perfil(14, "expanded_pvc"),
      [chaveVinculo(LED, "led")]: perfil(15, "led_module"),
    } }))).rejects.toThrow(CpqRender3dError);
  });

  it("recusa ticket de outro orçamento, hash adulterado e aprovação de outro usuário", async () => {
    const { bloco } = await aprovado();
    await expect(verificarRender3dNaEmissao({ sourceId: "outro", snapshot: orcamento(), render3d: bloco, user: USER, fonte: fonte() })).rejects.toThrow(/outro orçamento/);
    await expect(verificarRender3dNaEmissao({ sourceId: SOURCE, snapshot: orcamento(), render3d: { ...bloco, specHash: "e".repeat(64) }, user: USER, fonte: fonte() })).rejects.toThrow(/outro orçamento|outra versão/);
    await expect(verificarRender3dNaEmissao({
      sourceId: SOURCE, snapshot: orcamento(), user: USER, fonte: fonte(),
      render3d: { ...bloco, approval: { ...bloco.approval, approvedBy: { ...USER, id: "intruso" } } },
    })).rejects.toThrow(/alterados/);
  });

  it("não emite quando o 3D passou a ter pendências (ex.: perfil removido)", async () => {
    const { bloco } = await aprovado();
    await expect(verificarRender3dNaEmissao({ sourceId: SOURCE, snapshot: orcamento(), render3d: bloco, user: USER, fonte: fonte({ vinculos: {} }) })).rejects.toThrow(/pendências/);
  });
});

describe("visão pública", () => {
  it("não expõe nomes internos, notas nem fotos de referência, e traz só o necessário para desenhar", async () => {
    const spec = await resolver(orcamento());
    const publico = visaoPublicaDoSpec(
      { ...spec, materials: spec.materials.map(m => ({ ...m, assets: [{ id: 1, kind: "reference", url: "https://x.ufs.sh/a.png", storageKey: null, mimeType: "image/png", sha256: "f".repeat(64), widthPx: 10, heightPx: 10, tileWidthMm: null, tileHeightMm: null, colorSpace: "srgb", sourceNote: "foto interna", calibrated: false }] })) },
      { dia: null, noite: null, explodido: null },
    );
    const texto = jsonCanonico(publico);
    expect(texto).not.toMatch(/Acrílico branco|Perfil lateral 80mm|PVC 10mm|foto interna|ticket|custo|margem|recibo|profileName/i);
    expect(publico.materials.every(m => m.assets.length === 0)).toBe(true);
    expect(publico.materials.map(m => m.materialName).sort()).toEqual(["Face", "Fundo", "Iluminação", "Perfil lateral"]);
  });
});

describe("snapshot antigo (sem render3d) continua legível pelo resolver", () => {
  it("ignora chaves desconhecidas do snapshot completo", async () => {
    const spec = await resolver({ ...orcamento(), precoFinal: 123, cliente: { cnpj: null }, custoDireto: 50 });
    expect(spec.blockers).toEqual([]);
  });
});
