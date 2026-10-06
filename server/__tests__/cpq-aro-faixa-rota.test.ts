import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Rota POST /api/letra-caixa/factibilidade: a camada Aro pode trazer `faixaMm` (padrão do CPQ 6 mm) e a rota repassa ao serviço,
 * que gera o aro como faixa de borda da face. Sessão e catálogo do MubiSys simulados; as chapas vêm de formatos temporários
 * (nada é gravado), e o banco só é consultado para ids fictícios (987_654_7xx).
 */
if ((process.env.JWT_SECRET ?? "").length < 32) process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";
vi.mock("../_core/auth", () => ({ auth: { api: { getSession: async () => ({ user: { id: "teste", name: "Teste", role: "vendas" } }) } } }));
vi.mock("../integrations/mubisys-client", async importOriginal => ({
  ...(await importOriginal<typeof import("../integrations/mubisys-client")>()),
  listarMateriasPrimas: async () => [
    { id: 987_654_701, nome: "Acrílico branco 3 mm (teste)" },
    { id: 987_654_702, nome: "Chapa galvanizada 1,2 mm (teste)" },
  ],
}));

const { registrarRotasEstudioFactibilidade } = await import("../routes/estudio-factibilidade");

const FACE = 987_654_701;
const ARO = 987_654_702;
// 1 unidade do SVG = 1 mm. "O": anel 120×200 com vazado 60×140; "R": retângulo 100×100.
const miolo = `<path d="M100 20H220V220H100Z M130 50V190H190V50Z" fill="#000" fill-rule="evenodd"/><path d="M300 20H400V120H300Z" fill="#000"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 250" width="1000" height="250"><g id="Face">${miolo}</g></svg>`;

let servidor: Server;
let base = "";

const analisar = (camadasMateriais: unknown[]) =>
  fetch(`${base}/api/letra-caixa/factibilidade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceId: "teste-aro-rota",
      svg,
      larguraSvgMm: 1000,
      alturaSvgMm: 250,
      materiaPrimaIds: [FACE, ARO],
      camadasMateriais,
      formatosTemporarios: [FACE, ARO].map(materiaPrimaId => ({ materiaPrimaId, larguraMm: 1000, alturaMm: 2000 })),
    }),
  });

beforeAll(() => {
  const app = express();
  app.use(express.json());
  registrarRotasEstudioFactibilidade(app);
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => servidor?.close());

describe("faixa do aro pela rota de factibilidade", () => {
  it("camada Aro com faixaMm 6: o aro vira as bordas da face (3 peças) e o aviso diz a largura", async () => {
    const resposta = await analisar([{ materiaPrimaId: FACE, camada: "face" }, { materiaPrimaId: ARO, camada: "aro", faixaMm: 6 }]);
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json() as { status_factibilidade: string; avisos: string[]; materiais: Array<{ id_materia_prima: number; pecas_para_nesting: Array<{ id: string }> }> };
    expect(corpo.status_factibilidade).toBe("APTO_NESTING");
    const aro = corpo.materiais.find(item => item.id_materia_prima === ARO)!;
    expect(aro.pecas_para_nesting).toHaveLength(3);
    expect(aro.pecas_para_nesting.every(peca => peca.id.startsWith("aro-"))).toBe(true);
    expect(corpo.avisos.some(aviso => /faixa de 6 mm/.test(aviso))).toBe(true);
  });

  it("outra largura chega ao serviço (10 mm)", async () => {
    const resposta = await analisar([{ materiaPrimaId: FACE, camada: "face" }, { materiaPrimaId: ARO, camada: "aro", faixaMm: 10 }]);
    expect(resposta.status).toBe(200);
    expect(((await resposta.json()) as { avisos: string[] }).avisos.some(aviso => /faixa de 10 mm/.test(aviso))).toBe(true);
  });

  it("sem faixaMm o aro continua exigindo camada própria no SVG", async () => {
    const resposta = await analisar([{ materiaPrimaId: FACE, camada: "face" }, { materiaPrimaId: ARO, camada: "aro" }]);
    expect(resposta.status).toBe(400);
    expect(((await resposta.json()) as { error: string }).error).toMatch(/camadas aro/);
  });

  it("recusa largura fora de 1–50 mm e faixa em camada que não é o Aro", async () => {
    for (const faixaMm of [0.5, 51, -6]) {
      const resposta = await analisar([{ materiaPrimaId: FACE, camada: "face" }, { materiaPrimaId: ARO, camada: "aro", faixaMm }]);
      expect(resposta.status).toBe(400);
    }
    const emFace = await analisar([{ materiaPrimaId: FACE, camada: "face", faixaMm: 6 }, { materiaPrimaId: ARO, camada: "aro" }]);
    expect(emFace.status).toBe(400);
  });
});
