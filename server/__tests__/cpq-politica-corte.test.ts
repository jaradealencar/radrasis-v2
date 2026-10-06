import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  angulosPermitidos, normalizarRotacao, PADRAO_PROCESSO_CORTE, resolverPoliticaCorte, rotacoesDoDeepnest,
} from "../../shared/politica-corte";
import { calcularFactibilidadeFabricacao } from "../services/cpqFactibilidadeFabricacao";
import { calcularNestingMultiMaterial } from "../services/cpqNesting";
import { executarMotorInterno } from "../services/cpqNestingInterno";
import { angulosDaPeca } from "../services/cpqNestingRaster";

const retangulo = (id: string, largura: number, altura: number) => ({
  id, svg: `<svg viewBox="0 0 ${largura} ${altura}"><path d="M0 0 L${largura} 0 L${largura} ${altura} L0 ${altura} Z"/></svg>`, larguraMm: largura, alturaMm: altura,
});

describe("política de corte por matéria-prima (shared)", () => {
  const orcamento = { espacamentoMm: 3, margemBordaMm: 5 };

  it("sem cadastro: padrão do orçamento e rotação livre (comportamento de sempre)", () => {
    expect(resolverPoliticaCorte(null, orcamento)).toEqual({
      processo: null, rotacao: "livre", espacamentoMm: 3, margemBordaMm: 5, origemEspacamento: "orcamento", origemMargem: "orcamento",
    });
  });

  it("precedência: valor próprio > padrão do processo > padrão do orçamento", () => {
    const soProcesso = resolverPoliticaCorte({ processoCorte: "router" }, orcamento);
    expect(soProcesso).toMatchObject({ processo: "router", espacamentoMm: PADRAO_PROCESSO_CORTE.router.espacamentoMm, margemBordaMm: PADRAO_PROCESSO_CORTE.router.margemBordaMm, origemEspacamento: "processo" });
    const proprio = resolverPoliticaCorte({ processoCorte: "plasma", espacamentoMm: 12.5, margemBordaMm: null }, orcamento);
    expect(proprio).toMatchObject({ espacamentoMm: 12.5, origemEspacamento: "material", margemBordaMm: PADRAO_PROCESSO_CORTE.plasma.margemBordaMm, origemMargem: "processo" });
    expect(resolverPoliticaCorte({ espacamentoMm: 0 }, orcamento)).toMatchObject({ espacamentoMm: 0, origemEspacamento: "material" }); // 0 é valor válido
  });

  it("só o escovado (veio) restringe a rotação: 0° e 180°; o resto continua livre", () => {
    expect(angulosPermitidos("veio")).toEqual([0, 180]);
    expect(angulosPermitidos("livre")).toBeNull();
    expect(rotacoesDoDeepnest("veio")).toBe(2);
    expect(rotacoesDoDeepnest("livre")).toBe(72);
    expect(normalizarRotacao("quadrantes")).toBe("livre"); // valores antigos/desconhecidos viram livre
    expect(normalizarRotacao(null)).toBe("livre");
  });
});

describe("rotação do escovado nos motores", () => {
  it("com veio, o encaixe por contorno só usa 0° e 180°", () => {
    const losango: Array<[number, number]> = [[0, 50], [100, 0], [200, 50], [100, 100]];
    expect(angulosDaPeca(losango, [0, 180])).toEqual([0, 180]);
    expect(angulosDaPeca(losango).length).toBeGreaterThan(4); // livre: 4 lados + alinhamento da aresta inclinada
  });

  it("peça longa que só cabe girada 90°: livre encaixa; escovado não gira e recusa", () => {
    // Chapa útil 100 × 300 (x × y); peça 250 × 40 só cabe em pé (girada 90°).
    const peca = [retangulo("longa", 250, 40)];
    const livre = executarMotorInterno(peca, 100, 300, 0);
    expect(livre.completo).toBe(true);
    expect(livre.placements[0].rotacaoGraus % 180).toBe(90);
    const escovado = executarMotorInterno(peca, 100, 300, 0, { rotacao: "veio" });
    expect(escovado.completo).toBe(false);
    expect(escovado.quantidadePosicionada).toBe(0);
  });

  it("com veio, todas as peças ficam em 0° ou 180° (caixas e contorno), sem sobreposição de espaço", () => {
    const pecas = Array.from({ length: 6 }, (_, i) => retangulo(`r${i}`, 120 + i * 10, 60));
    const r = executarMotorInterno(pecas, 800, 300, 4, { rotacao: "veio" });
    expect(r.completo).toBe(true);
    expect(r.placements.every(p => p.rotacaoGraus === 0 || p.rotacaoGraus === 180)).toBe(true);
  });
});

describe("nesting com política por material", () => {
  const material = (id: number, extras: Record<string, unknown> = {}) => ({
    id, nome: `Material ${id}`, custoUnitario: 100, unidadeCusto: "m2",
    chapas: [{ id: id * 10, mubisysMateriaPrimaId: id, nome: "1220x2440", larguraMm: 2440, alturaMm: 1220 }],
    ...extras,
  });
  const pecas = [retangulo("a", 300, 200), retangulo("b", 300, 200)];

  it("cada material usa o seu espaçamento e a sua margem, com o padrão do orçamento onde não há política", async () => {
    const resultados = await calcularNestingMultiMaterial({
      pecas, espacamentoMm: 3, margemBordaMm: 5,
      materiais: [
        material(1), // sem política: 3 / 5
        material(2, { espacamentoMm: 8, margemBordaMm: 12, processoCorte: "router" }),
        material(3, { espacamentoMm: 10, margemBordaMm: 20, processoCorte: "plasma", rotacao: "veio" }),
      ],
    });
    const por = new Map(resultados.map(r => [r.id_materia_prima, r]));
    expect(por.get(1)).toMatchObject({ espacamento_pecas_mm: 3, margem_borda_mm: 5, processo_corte: null, rotacao_permitida: "livre" });
    expect(por.get(2)).toMatchObject({ espacamento_pecas_mm: 8, margem_borda_mm: 12, processo_corte: "router" });
    expect(por.get(3)).toMatchObject({ espacamento_pecas_mm: 10, margem_borda_mm: 20, processo_corte: "plasma", rotacao_permitida: "veio" });
    // a margem de borda desloca as peças: a primeira peça começa na margem do próprio material
    const primeira = (id: number) => Math.min(...por.get(id)!.posicionamentos.map(p => p.xMm));
    expect(primeira(1)).toBeCloseTo(5, 3);
    expect(primeira(2)).toBeCloseTo(12, 3);
    expect(primeira(3)).toBeCloseTo(20, 3);
    // as peças do escovado só giram 0°/180°
    expect(por.get(3)!.posicionamentos.every(p => p.rotacaoGraus === 0 || p.rotacaoGraus === 180)).toBe(true);
  });

  it("espaçamento/margem fora de 0–50 mm no cadastro viram falha só daquele material", async () => {
    await expect(calcularNestingMultiMaterial({ pecas, materiais: [material(4, { margemBordaMm: 80 })] }))
      .rejects.toMatchObject({ code: "invalid_geometry" });
  });
});

describe("factibilidade com margem própria do material", () => {
  const chapas = [{ id: 1, nome: "1000 x 500", larguraMm: 1000, alturaMm: 500 }];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" width="1000" height="500"><g id="Face"><path d="M0 0H960V470H0Z"/></g></svg>`;
  const analisar = (margemBordaMm?: number) => calcularFactibilidadeFabricacao({
    svg, larguraSvgMm: 1000, alturaSvgMm: 500,
    materiais: [{ id: 1, nome: "Chapa", lotes: [{ camada: "face" as const }], chapas, ...(margemBordaMm == null ? {} : { margemBordaMm }) }],
  });

  it("sem margem própria usa a do orçamento; com margem maior a peça deixa de caber sem ajuste", () => {
    expect(analisar().fator_escala_aplicado).toBe(1);
    expect(analisar(0).fator_escala_aplicado).toBe(1);
    expect(analisar(20).fator_escala_aplicado).toBeLessThan(1); // útil 960 × 460 < peça 960 × 470
  });

  it("recusa margem própria fora de 0–50 mm", () => {
    expect(() => analisar(80)).toThrow(/entre 0 e 50/);
  });
});

describe("worker do Deepnest: rotações", () => {
  const worker = resolve(process.cwd(), "server/scripts/cpq-deepnest-worker.mjs");
  const diretorios: string[] = [];
  afterEach(async () => { await Promise.all(diretorios.splice(0).map(d => rm(d, { recursive: true, force: true }))); });

  async function rodar(extra: Record<string, unknown>) {
    const dir = await mkdtemp(join(tmpdir(), "cpq-rotacoes-"));
    diretorios.push(dir);
    const entry = join(dir, "deepnest-falso.mjs");
    // O motor falso devolve o `rotations` recebido dentro da mensagem de erro, para o teste ler.
    await writeFile(entry, "export async function nest(_s, _u, options) { throw new Error('rotations=' + options.rotations); }", "utf8");
    return new Promise<{ error?: string }>((ok, falha) => {
      const filho = spawn(process.execPath, [worker], { env: { ...process.env, DEEPNEST_NODE_ENTRY: entry }, stdio: ["pipe", "pipe", "pipe"] });
      let saida = "";
      filho.stdout.on("data", pedaco => { saida += pedaco; });
      filho.on("error", falha);
      filho.on("close", () => { try { ok(JSON.parse(saida)); } catch (e) { falha(e); } });
      filho.stdin.end(JSON.stringify({
        pecas: [{ id: "p", svg: '<svg viewBox="0 0 10 5"><path d="M0 0 L10 0 L10 5 L0 5 Z"/></svg>', larguraMm: 10, alturaMm: 5 }],
        larguraMm: 1000, alturaMm: 500, espacamentoMm: 0, timeoutMs: 2000, ...extra,
      }));
    });
  }

  it("sem o campo mantém as 72 rotações de sempre", async () => { expect((await rodar({})).error).toBe("rotations=72"); });
  it("escovado (2) manda só 0° e 180° ao Deepnest", async () => { expect((await rodar({ rotacoes: 2 })).error).toBe("rotations=2"); });
  it("recusa rotações inválidas", async () => { expect((await rodar({ rotacoes: 0 })).error).toMatch(/entre 1 e 360/); });
});
