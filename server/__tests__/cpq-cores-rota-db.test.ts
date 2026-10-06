import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { estudioChapas, estudioMapeamentoCoresCotacao } from "../../drizzle/schema";
import { getDb } from "../db/db";

/**
 * Rota de análise de cores com as duas correções do vendedor: a cor indicada no desenho (`coresManuais`) e a troca do material
 * sugerido (`escolhas`). Sessão simulada; banco real do teste com chapas fictícias (ids 987_654_8xx), removidas no final.
 */
if ((process.env.JWT_SECRET ?? "").length < 32) process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";
vi.mock("../_core/auth", () => ({ auth: { api: { getSession: async () => ({ user: { id: "teste", name: "Teste", role: "vendas" } }) } } }));

const { registrarRotasEstudioCores } = await import("../routes/estudio-cores");

const SOURCE_ID = "teste-cores-rota-db";
const MATERIAL_LARANJA = 987_654_801;
const MATERIAL_AZUL = 987_654_802;
// 1 unidade do SVG = 1 mm. Caminhos 0 e 1: letras lidas como PRETAS (eram brancas); caminho 2: o "X" vermelho.
const retangulo = (x: number, cor: string) => `<path d="M${x} 10H${x + 80}V110H${x}Z" fill="${cor}"/>`;
const arte = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" width="400" height="120">${retangulo(10, "#000000")}${retangulo(110, "#000000")}${retangulo(310, "#fd0000")}</svg>`;
const geometria = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" width="400" height="120">${retangulo(10, "#000")}${retangulo(110, "#000")}${retangulo(310, "#000")}</svg>`;

let servidor: Server;
let base = "";
const idsChapas: number[] = [];

const analisar = (extra: Record<string, unknown>) =>
  fetch(`${base}/api/letra-caixa/cores/analisar-svg`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceId: SOURCE_ID, svgArte: arte, svgGeometria: geometria, larguraSvgMm: 400, alturaSvgMm: 120,
      iluminacao: "sem_iluminacao", baseImpressao: "branco", construcaoFace: "acrilico_total", laminar: false, ...extra,
    }),
  });

type Resultado = { regionKey: string; corHex: string; tipoSugestao: string; chapaId: number | null; chapaMateriaPrimaId: number | null; escolhaManual?: boolean; avisos: string[]; pathIndexes: number[] };
type Resposta = { resultados: Resultado[]; opcoes: Record<string, Array<{ tipo: string; mubisysMateriaPrimaId: number | null; bloqueada: boolean }>> };

beforeAll(async () => {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível para o teste");
  const [laranja, azul] = await db.insert(estudioChapas).values([
    { mubisysMateriaPrimaId: MATERIAL_LARANJA, nome: "ZZ teste laranja", larguraMm: 2440, alturaMm: 1220, cmykC: "0", cmykM: "50", cmykY: "100", cmykK: "0", temCor: true, ativo: true },
    { mubisysMateriaPrimaId: MATERIAL_AZUL, nome: "ZZ teste azul", larguraMm: 2440, alturaMm: 1220, cmykC: "100", cmykM: "60", cmykY: "0", cmykK: "0", temCor: true, ativo: true },
  ]).returning({ id: estudioChapas.id });
  idsChapas.push(laranja.id, azul.id);
  const app = express();
  app.use(express.json({ limit: "5mb" }));
  registrarRotasEstudioCores(app);
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(async () => {
  servidor?.close();
  const db = await getDb();
  if (!db) return;
  await db.delete(estudioMapeamentoCoresCotacao).where(eq(estudioMapeamentoCoresCotacao.sourceId, SOURCE_ID));
  if (idsChapas.length) await db.delete(estudioChapas).where(inArray(estudioChapas.id, idsChapas));
});

describe("análise de cores pela rota — correções do vendedor", () => {
  it("sem correções, a leitura automática segue (as letras pretas continuam pretas)", async () => {
    const resposta = await analisar({});
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json() as Resposta;
    expect(corpo.resultados.map(item => item.corHex)).toEqual(["#000000", "#fd0000"]);
    expect(corpo.resultados.some(item => item.escolhaManual)).toBe(false);
  });

  it("a cor indicada no desenho substitui a lida: as letras viram brancas, agrupadas numa região só, com aviso da correção", async () => {
    const resposta = await analisar({ coresManuais: [{ pathIndexes: [0, 1], corHex: "#FFFFFF" }] });
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json() as Resposta;
    expect(corpo.resultados.map(item => item.corHex)).toEqual(["#ffffff", "#fd0000"]);
    expect(corpo.resultados[0].pathIndexes).toEqual([0, 1]);
    expect(corpo.resultados[0].avisos.some(aviso => aviso.startsWith("Cor indicada pelo vendedor no desenho técnico para 2 peça(s)"))).toBe(true);
    expect(corpo.resultados[1].avisos.some(aviso => aviso.startsWith("Cor indicada pelo vendedor"))).toBe(false);
  });

  it("o menu de opções vem na resposta, com a chapa de teste, e não faz parte dos resultados do snapshot", async () => {
    const corpo = await (await analisar({})).json() as Resposta;
    expect(Object.keys(corpo.opcoes)).toEqual(["regiao-1", "regiao-2"]);
    expect(corpo.opcoes["regiao-2"].some(opcao => opcao.tipo === "chapa" && opcao.mubisysMateriaPrimaId === MATERIAL_LARANJA)).toBe(true);
    expect(corpo.opcoes["regiao-2"].at(-1)).toMatchObject({ tipo: "impresso" });
    expect(Object.keys(corpo.resultados[0])).not.toContain("opcoes");
  });

  it("a troca do material sugerido vale, é gravada como escolha manual e aparece no resultado", async () => {
    const resposta = await analisar({ escolhas: [{ regionKey: "regiao-2", corHex: "#fd0000", tipo: "chapa", id: idsChapas[0] }] });
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json() as Resposta;
    const vermelha = corpo.resultados.find(item => item.regionKey === "regiao-2")!;
    expect(vermelha).toMatchObject({ tipoSugestao: "chapa", chapaId: idsChapas[0], chapaMateriaPrimaId: MATERIAL_LARANJA, escolhaManual: true });
    expect(vermelha.avisos.some(aviso => aviso.includes("escolhida manualmente pelo vendedor"))).toBe(true);
    const db = await getDb();
    const [linha] = await db!.select().from(estudioMapeamentoCoresCotacao).where(eq(estudioMapeamentoCoresCotacao.regionKey, "regiao-2"));
    expect((linha.detalhesJson as Record<string, unknown>).escolhaManual).toBe(true);
    expect(linha.chapaId).toBe(idsChapas[0]);
  });

  it("escolha de outra cor/região (chave igual mas cor diferente) é ignorada em vez de valer para a peça errada", async () => {
    const corpo = await (await analisar({ escolhas: [{ regionKey: "regiao-2", corHex: "#00ff00", tipo: "chapa", id: idsChapas[0] }] })).json() as Resposta;
    expect(corpo.resultados.some(item => item.escolhaManual)).toBe(false);
  });

  it("escolha que deixou de valer (chapa inexistente) cai na sugestão automática e avisa, sem derrubar a análise", async () => {
    const resposta = await analisar({ escolhas: [{ regionKey: "regiao-2", corHex: "#fd0000", tipo: "chapa", id: 987_654_999 }] });
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json() as Resposta;
    const vermelha = corpo.resultados.find(item => item.regionKey === "regiao-2")!;
    expect(vermelha.escolhaManual).toBeUndefined();
    expect(vermelha.avisos[0]).toMatch(/escolha manual do vendedor para esta cor foi descartada/);
  });

  it("peça inexistente na cor indicada devolve erro claro; corpo fora do contrato é recusado", async () => {
    const inexistente = await analisar({ coresManuais: [{ pathIndexes: [9], corHex: "#ffffff" }] });
    expect(inexistente.status).toBe(400);
    expect(((await inexistente.json()) as { error: string }).error).toMatch(/peça 10.*não existe/);
    expect((await analisar({ coresManuais: [{ pathIndexes: [0], corHex: "branco" }] })).status).toBe(400);
    expect((await analisar({ escolhas: [{ regionKey: "regiao-1", tipo: "chapa" }] })).status).toBe(400); // chapa sem id
  });

  it("a paleta devolve uma cor por matéria-prima cadastrada, com a cor de referência", async () => {
    const resposta = await fetch(`${base}/api/letra-caixa/cores/paleta`);
    expect(resposta.status).toBe(200);
    const { chapas } = await resposta.json() as { chapas: Array<{ mubisysMateriaPrimaId: number; corHex: string }> };
    const laranja = chapas.find(item => item.mubisysMateriaPrimaId === MATERIAL_LARANJA);
    expect(laranja?.corHex).toMatch(/^#[0-9a-f]{6}$/);
    expect(chapas.filter(item => item.mubisysMateriaPrimaId === MATERIAL_AZUL)).toHaveLength(1);
  });
});
