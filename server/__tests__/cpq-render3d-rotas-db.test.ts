import { createHash, randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// O banco de testes é remoto (Neon): cada requisição do fluxo faz várias idas e voltas.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const sessao = vi.hoisted(() => ({ atual: null as null | { user: { id: string; name: string; role: string } } }));
vi.mock("../_core/auth", () => ({ auth: { api: { getSession: async () => sessao.atual } } }));
vi.mock("../db/storage", () => ({
  storagePut: vi.fn(async (chave: string) => ({ key: `k-${chave}`, url: `https://teste123.ufs.sh/f/${encodeURIComponent(chave)}` })),
}));
vi.mock("../integrations/mubisys-client", () => ({
  listarMateriasPrimas: async () => [
    { id: 987_655_001, nome: "Acrílico leitoso 3mm (teste 3D)", categoria: "Chapas", tipo: "x", unidade_custo: "m2", unidade_movimentacao: "m2", valor_custo: 100, data_referencia: "", status: "Ativo" },
    { id: 987_655_002, nome: "Perfil lateral 80mm (teste 3D)", categoria: "Perfis", tipo: "x", unidade_custo: "m", unidade_movimentacao: "m", valor_custo: 10, data_referencia: "", status: "Ativo" },
  ],
}));

import {
  cpqRender3dApprovals,
  cpqRenderMaterialAssets,
  cpqRenderMaterialLinks,
  cpqRenderMaterialProfiles,
  estudioChapas,
  estudioKits,
  materiaPrimaCadastros,
  materiaPrimaCategorias,
  propostas,
} from "../../drizzle/schema";
import { presetPbr } from "../../shared/cpq-render3d-presets";
import { getDb } from "../db/db";
import { registrarRotasEstudioCotacoes } from "../routes/estudio-cotacoes";
import { registrarRotasEstudioRender3d } from "../routes/estudio-render3d";
import { emitirTicketAnaliseFactibilidade } from "../services/cpqFactibilidadeFabricacao";
import { criarFonteBanco, resolveCpqRender3dSpec, verificarRender3dNaEmissao } from "../services/cpqRender3d";

/**
 * Rotas do 3D contra o banco de testes do .env (como os demais testes de dados): spec → pendências → perfis visuais → aprovação →
 * imutabilidade do perfil usado → link público. Auth e storage são simulados; ids de matéria-prima/produto são fictícios.
 */
const FACE = 987_655_001, PERFIL = 987_655_002, FUNDO = 987_655_003, LED = 987_655_004;
const PRODUTO = 987_655, MODELO = 1;
const CHAVE_KIT = `${PRODUTO}_${MODELO}`;
const SOURCE = `teste-3d-${randomBytes(6).toString("hex")}`;
const TOKEN = `t3d${randomBytes(10).toString("hex")}`;
const PREFIXO = "[ESTUDIO_COTACAO_V1]";
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><g id="Face"><path d="M10 5 L40 5 L40 35 L10 35 Z M20 15 L30 15 L30 25 L20 25 Z" fill="#fff" stroke="#000"/><path d="M60 5 L90 5 L90 35 L60 35 Z" fill="#fff" stroke="#000"/></g></svg>`;
const sha = (valor: string) => createHash("sha256").update(valor).digest("hex");

const VENDEDOR = { user: { id: "u-vend", name: "Vendedora Teste", role: "vendas" } };
const GESTOR = { user: { id: "u-gest", name: "Gestor Teste", role: "gestor" } };

let servidor: Server;
let base = "";
let categoriaChapa = 0, categoriaPerfil = 0;
const idsPerfis: number[] = [];

/** GIF mínimo (cabeçalho + término) com as dimensões pedidas: o servidor valida assinatura, dimensões e o byte final. */
function gif(largura = 800, altura = 500, terminado = true): Buffer {
  const b = Buffer.alloc(14);
  b.write("GIF89a", 0, "ascii");
  b.writeUInt16LE(largura, 6);
  b.writeUInt16LE(altura, 8);
  if (terminado) b[13] = 0x3b;
  return b;
}

function png(largura = 64, altura = 64): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(largura, 16);
  b.writeUInt32BE(altura, 20);
  return b;
}

async function api(metodo: string, caminho: string, opcoes: { corpo?: unknown; bruto?: Buffer; tipo?: string; cabecalhos?: Record<string, string> } = {}) {
  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { ...(opcoes.corpo !== undefined ? { "Content-Type": "application/json" } : opcoes.tipo ? { "Content-Type": opcoes.tipo } : {}), ...opcoes.cabecalhos },
    body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : opcoes.bruto ? new Uint8Array(opcoes.bruto) : undefined,
  });
  const texto = await resposta.text();
  let json: Record<string, any> = {};
  try { json = JSON.parse(texto); } catch { /* corpo não-JSON */ }
  return { status: resposta.status, json, texto };
}

function rascunho() {
  return {
    mubisysProdutoId: PRODUTO,
    mubisysModeloId: MODELO,
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
      { mubisysMateriaPrimaId: FACE, nome: "Acrílico leitoso 3mm (teste 3D)", unidade: "m2", quantidade: 0.2, papel: "Face", renderRole: "face" },
      { mubisysMateriaPrimaId: PERFIL, nome: "Perfil lateral 80mm (teste 3D)", unidade: "m", quantidade: 3, papel: "Lateral", renderRole: "profile" },
      { mubisysMateriaPrimaId: FUNDO, nome: "PVC 10mm (teste 3D)", unidade: "m2", quantidade: 0.2, papel: "Fundo", renderRole: "back" },
      { mubisysMateriaPrimaId: LED, nome: "Módulo LED (teste 3D)", unidade: "un", quantidade: 20, papel: "Iluminação", renderRole: "led" },
    ],
    mapeamentoCores: null,
  };
}

const pbrAcrilico = presetPbr("acrylic_translucent");

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 ? process.env.JWT_SECRET : "teste-render3d-segredo-com-mais-de-32-caracteres";
  const db = await getDb();
  if (!db) throw new Error("banco indisponível");
  await limpar();
  const [chapa] = await db.insert(materiaPrimaCategorias).values({ nome: "T3D chapa (teste)", usaDadosChapa: true }).returning({ id: materiaPrimaCategorias.id });
  const [perfil] = await db.insert(materiaPrimaCategorias).values({ nome: "T3D perfil (teste)", usaDadosPerfil: true }).returning({ id: materiaPrimaCategorias.id });
  categoriaChapa = chapa.id;
  categoriaPerfil = perfil.id;
  await db.insert(materiaPrimaCadastros).values([
    { mubisysMateriaPrimaId: FACE, categoriaId: categoriaChapa, espessuraMm: "3" },
    { mubisysMateriaPrimaId: PERFIL, categoriaId: categoriaPerfil, espessuraMm: "1.5", perfilAlturaMm: "80", perfilLarguraMm: "20" },
    { mubisysMateriaPrimaId: FUNDO, categoriaId: categoriaChapa, espessuraMm: "10" },
  ]);
  await db.insert(estudioChapas).values([
    { mubisysMateriaPrimaId: FACE, nome: "Acrílico 1000x500 (teste 3D)", larguraMm: 1000, alturaMm: 500 },
    { mubisysMateriaPrimaId: FUNDO, nome: "PVC 1000x500 (teste 3D)", larguraMm: 1000, alturaMm: 500 },
  ]);
  await db.insert(estudioKits).values({
    chave: CHAVE_KIT, produtoId: PRODUTO, modeloId: MODELO,
    dadosJson: { linhas: [], render3dConstruction: { kind: "frontlight", boxDepthMm: 80, wallStandoffMm: 30, faceLipMm: 0, ledPitchMm: 60, ledEdgeClearanceMm: 15 } },
  });
  const app = express();
  app.use(express.json({ limit: "4mb" }));
  registrarRotasEstudioRender3d(app);
  registrarRotasEstudioCotacoes(app);
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

async function limpar() {
  const db = await getDb();
  if (!db) return;
  await db.delete(cpqRender3dApprovals).where(like(cpqRender3dApprovals.sourceId, "teste-3d-%"));
  await db.delete(propostas).where(eq(propostas.token, TOKEN));
  await db.delete(estudioKits).where(eq(estudioKits.chave, CHAVE_KIT));
  await db.delete(estudioChapas).where(inArray(estudioChapas.mubisysMateriaPrimaId, [FACE, FUNDO]));
  await db.delete(cpqRenderMaterialLinks).where(inArray(cpqRenderMaterialLinks.mubisysMateriaPrimaId, [FACE, PERFIL, FUNDO, LED]));
  await db.delete(materiaPrimaCadastros).where(inArray(materiaPrimaCadastros.mubisysMateriaPrimaId, [FACE, PERFIL, FUNDO]));
  await db.delete(materiaPrimaCategorias).where(inArray(materiaPrimaCategorias.nome, ["T3D chapa (teste)", "T3D perfil (teste)"]));
  const perfis = await db.select({ id: cpqRenderMaterialProfiles.id }).from(cpqRenderMaterialProfiles).where(like(cpqRenderMaterialProfiles.slug, "t3d-%"));
  if (perfis.length) {
    await db.delete(cpqRenderMaterialAssets).where(inArray(cpqRenderMaterialAssets.profileId, perfis.map(p => p.id)));
    await db.delete(cpqRenderMaterialProfiles).where(inArray(cpqRenderMaterialProfiles.id, perfis.map(p => p.id)));
  }
}

afterAll(async () => {
  servidor?.close();
  await limpar();
});

const corpoPerfil = (nome: string, familia: string, calibrado = true) => ({ nome, familia, acabamento: null, notas: "teste", calibrado, pbr: presetPbr(familia as never), slug: `t3d-${nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` });

describe("rotas do 3D (banco de testes)", () => {
  it("exige sessão e restringe a administração a gestor/admin/master", async () => {
    sessao.atual = null;
    expect((await api("POST", "/api/letra-caixa/render3d/spec", { corpo: { sourceId: SOURCE, snapshot: rascunho() } })).status).toBe(401);
    sessao.atual = VENDEDOR;
    expect((await api("GET", "/api/letra-caixa/render3d/material-profiles")).status).toBe(403);
    expect((await api("POST", "/api/letra-caixa/render3d/material-profiles", { corpo: corpoPerfil("Nao pode", "expanded_pvc") })).status).toBe(403);
    expect((await api("PUT", `/api/letra-caixa/render3d/material-links/${FACE}`, { corpo: { profileId: null } })).status).toBe(403);
  });

  it("sem perfis visuais o spec é ESTIMADO e traz pendências estruturadas (não pode ser aprovado)", async () => {
    sessao.atual = VENDEDOR;
    const resposta = await api("POST", "/api/letra-caixa/render3d/spec", { corpo: { sourceId: SOURCE, snapshot: rascunho() } });
    expect(resposta.status).toBe(200);
    expect(resposta.json.blockers.map((b: { code: string }) => b.code)).toContain("material_sem_vinculo");
    expect(resposta.json.materials.every((m: { estimated: boolean }) => m.estimated)).toBe(true);
    expect(resposta.json.construction).toMatchObject({ boxDepthMm: 80, faceThicknessMm: 3, backThicknessMm: 10, returnSheetThicknessMm: 1.5 });
    const aprovar = await api("POST", "/api/letra-caixa/render3d/aprovar", {
      corpo: { sourceId: SOURCE, snapshot: rascunho(), specHash: resposta.json.specHash, previewDayUrl: "https://teste123.ufs.sh/f/a.png", previewNightUrl: "https://teste123.ufs.sh/f/b.png", previewExplodedUrl: "https://teste123.ufs.sh/f/c.png" },
    });
    expect(aprovar.status).toBe(422);
    expect(aprovar.json.blockers.length).toBeGreaterThan(0);
  });

  it("valida o upload de textura: tipo real pelos bytes, escala do tile e limite de tamanho; perfil do admin com mapas", async () => {
    sessao.atual = GESTOR;
    const criado = await api("POST", "/api/letra-caixa/render3d/material-profiles", { corpo: corpoPerfil("Inox escovado teste", "stainless_brushed") });
    expect(criado.status).toBe(201);
    const perfilId = criado.json.id as number;
    idsPerfis.push(perfilId);
    const url = `/api/letra-caixa/render3d/material-profiles/${perfilId}/assets`;
    // texto com Content-Type de imagem: recusado pelo conteúdo
    expect((await api("POST", `${url}?kind=normal&tileWidthMm=200&tileHeightMm=200`, { bruto: Buffer.from("<svg><script>1</script></svg>"), tipo: "image/png" })).status).toBe(400);
    // mapa de textura sem escala real
    expect((await api("POST", `${url}?kind=normal`, { bruto: png(), tipo: "image/png" })).status).toBe(400);
    // válido
    const ok = await api("POST", `${url}?kind=normal&tileWidthMm=200&tileHeightMm=200&calibrated=true&sourceNote=amostra%20A`, { bruto: png(128, 64), tipo: "image/png" });
    expect(ok.status).toBe(201);
    expect(ok.json).toMatchObject({ kind: "normal", widthPx: 128, heightPx: 64, tileWidthMm: 200, colorSpace: "none", calibrated: true });
    // trocar o mesmo tipo substitui; foto de referência é só comparação (sem escala) e fica em sRGB
    await api("POST", `${url}?kind=normal&tileWidthMm=100&tileHeightMm=100`, { bruto: png(), tipo: "image/png" });
    const referencia = await api("POST", `${url}?kind=reference`, { bruto: png(), tipo: "image/png" });
    expect(referencia.json).toMatchObject({ kind: "reference", colorSpace: "srgb" });
    const lista = await api("GET", "/api/letra-caixa/render3d/material-profiles");
    const perfil = lista.json.perfis.find((p: { id: number }) => p.id === perfilId);
    expect(perfil.assets.filter((a: { kind: string }) => a.kind === "normal")).toHaveLength(1);
    expect(perfil.assets).toHaveLength(2);
    // parâmetros PBR fora dos limites são recusados
    expect((await api("POST", "/api/letra-caixa/render3d/material-profiles", { corpo: { ...corpoPerfil("Absurdo", "expanded_pvc"), pbr: { ...presetPbr("expanded_pvc"), roughness: 7 } } })).status).toBe(400);
    expect((await api("DELETE", `/api/letra-caixa/render3d/material-profiles/${perfilId}`)).status).toBe(200);
  });

  let hashAprovado = "";
  let blocoAprovado: any = null;
  let perfilFaceId = 0;

  it("perfis + vínculos liberam o spec; aprovação exige hash atual e previews do nosso storage; registra auditoria", async () => {
    sessao.atual = GESTOR;
    const familias: Array<[number, string, string]> = [[FACE, "Acrilico leitoso teste", "acrylic_translucent"], [PERFIL, "Aluminio teste", "aluminum_profile"], [FUNDO, "PVC teste", "expanded_pvc"], [LED, "LED teste", "led_module"]];
    for (const [materia, nome, familia] of familias) {
      const criado = await api("POST", "/api/letra-caixa/render3d/material-profiles", { corpo: corpoPerfil(nome, familia) });
      expect(criado.status).toBe(201);
      idsPerfis.push(criado.json.id);
      if (materia === FACE) perfilFaceId = criado.json.id;
      expect((await api("PUT", `/api/letra-caixa/render3d/material-links/${materia}`, { corpo: { profileId: criado.json.id } })).status).toBe(200);
    }
    const lista = await api("GET", "/api/letra-caixa/render3d/material-profiles");
    expect(lista.json.materias.find((m: { id: number }) => m.id === FACE).status).toBe("aprovado");

    sessao.atual = VENDEDOR;
    const spec = await api("POST", "/api/letra-caixa/render3d/spec", { corpo: { sourceId: SOURCE, snapshot: rascunho() } });
    expect(spec.json.blockers).toEqual([]);
    expect(spec.json.materials.every((m: { estimated: boolean }) => !m.estimated)).toBe(true);
    hashAprovado = spec.json.specHash;

    const corpo = { sourceId: SOURCE, snapshot: rascunho(), specHash: hashAprovado, previewDayUrl: "https://teste123.ufs.sh/f/dia.png", previewNightUrl: "https://teste123.ufs.sh/f/noite.png", previewExplodedUrl: "https://teste123.ufs.sh/f/exp.png", previewAnimationUrl: "https://teste123.ufs.sh/f/montagem.gif" };
    // hash de outra versão do desenho → 409
    expect((await api("POST", "/api/letra-caixa/render3d/aprovar", { corpo: { ...corpo, specHash: "f".repeat(64) } })).status).toBe(409);
    // preview em host arbitrário → 400
    expect((await api("POST", "/api/letra-caixa/render3d/aprovar", { corpo: { ...corpo, previewDayUrl: "https://evil.example/x.png" } })).status).toBe(400);
    // preview via rota (ticket do spec): ticket de outro orçamento é recusado, o certo grava no storage
    const semTicket = await api("POST", `/api/letra-caixa/render3d/preview/dia?sourceId=${SOURCE}&specHash=${hashAprovado}`, { bruto: png(1600, 1000), tipo: "image/png", cabecalhos: { "x-render3d-ticket": "lixo" } });
    expect(semTicket.status).toBe(409);
    const comTicket = await api("POST", `/api/letra-caixa/render3d/preview/dia?sourceId=${SOURCE}&specHash=${hashAprovado}`, { bruto: png(1600, 1000), tipo: "image/png", cabecalhos: { "x-render3d-ticket": spec.json.ticket } });
    expect(comTicket.status).toBe(201);
    expect(comTicket.json.url).toMatch(/^https:\/\/teste123\.ufs\.sh\//);
    // animação (GIF): tipo e término conferidos pelos bytes; precisa do ticket do spec como os demais previews
    const urlGif = `/api/letra-caixa/render3d/preview/animacao?sourceId=${SOURCE}&specHash=${hashAprovado}`;
    const cab = { "x-render3d-ticket": spec.json.ticket };
    expect((await api("POST", urlGif, { bruto: gif(), tipo: "image/gif", cabecalhos: { "x-render3d-ticket": "lixo" } })).status).toBe(409);
    expect((await api("POST", urlGif, { bruto: gif(800, 500, false), tipo: "image/gif", cabecalhos: cab })).status).toBe(400); // cortado
    expect((await api("POST", urlGif, { bruto: gif(50, 50), tipo: "image/gif", cabecalhos: cab })).status).toBe(400); // pequeno demais
    expect((await api("POST", urlGif, { bruto: png(800, 500), tipo: "image/gif", cabecalhos: cab })).status).toBe(400); // PNG com cabeçalho de GIF
    const animacao = await api("POST", urlGif, { bruto: gif(), tipo: "image/gif", cabecalhos: cab });
    expect(animacao.status).toBe(201);
    expect(animacao.json.url).toMatch(/\.gif$/);
    // GIF não é aceito nos previews estáticos (PNG/JPEG)
    expect((await api("POST", `/api/letra-caixa/render3d/preview/dia?sourceId=${SOURCE}&specHash=${hashAprovado}`, { bruto: gif(), tipo: "image/gif", cabecalhos: cab })).status).toBe(415);

    const aprovado = await api("POST", "/api/letra-caixa/render3d/aprovar", { corpo });
    expect(aprovado.status).toBe(200);
    expect(aprovado.json.approval).toMatchObject({ specHash: hashAprovado, approvedBy: { id: "u-vend", role: "vendas" }, previewAnimationUrl: "https://teste123.ufs.sh/f/montagem.gif" });
    expect(aprovado.json.render3d.approval.previewAnimationUrl).toBe("https://teste123.ufs.sh/f/montagem.gif");
    // a animação é opcional: aprovar sem ela continua valendo, e ela só aceita URL do nosso storage
    expect((await api("POST", "/api/letra-caixa/render3d/aprovar", { corpo: { ...corpo, previewAnimationUrl: "https://evil.example/m.gif" } })).status).toBe(400);
    blocoAprovado = aprovado.json.render3d;
    expect(blocoAprovado.materials.find((m: { role: string }) => m.role === "face")).toMatchObject({ profileVersion: 1, thicknessMm: 3 });
    const db = (await getDb())!;
    const [auditoria] = await db.select().from(cpqRender3dApprovals).where(eq(cpqRender3dApprovals.sourceId, SOURCE));
    expect(auditoria.specHash).toBe(hashAprovado);
    expect(auditoria.profileIds.length).toBe(4);

    // a emissão confere ticket + hash contra os mesmos dados
    await expect(verificarRender3dNaEmissao({ sourceId: SOURCE, snapshot: rascunho(), render3d: blocoAprovado, user: VENDEDOR.user, fonte: criarFonteBanco() })).resolves.toMatchObject({ specHash: hashAprovado });
  });

  it("perfil usado numa aprovação é imutável: editar cria nova versão, repontua vínculos e invalida a emissão antiga", async () => {
    sessao.atual = GESTOR;
    expect((await api("POST", `/api/letra-caixa/render3d/material-profiles/${perfilFaceId}/assets?kind=reference`, { bruto: png(), tipo: "image/png" })).status).toBe(409);
    expect((await api("DELETE", `/api/letra-caixa/render3d/material-profiles/${perfilFaceId}`)).status).toBe(409);
    const novoPbr = { ...pbrAcrilico, transmission: 0.5 };
    const editado = await api("PUT", `/api/letra-caixa/render3d/material-profiles/${perfilFaceId}`, { corpo: { nome: "Acrilico leitoso teste", familia: "acrylic_translucent", acabamento: null, notas: null, calibrado: true, pbr: novoPbr } });
    expect(editado.status).toBe(201);
    expect(editado.json).toMatchObject({ novaVersao: true, versao: 2 });
    idsPerfis.push(editado.json.id);

    sessao.atual = VENDEDOR;
    const spec = await api("POST", "/api/letra-caixa/render3d/spec", { corpo: { sourceId: SOURCE, snapshot: rascunho() } });
    expect(spec.json.specHash).not.toBe(hashAprovado);
    expect(spec.json.materials.find((m: { role: string }) => m.role === "face")).toMatchObject({ profileVersion: 2 });
    await expect(verificarRender3dNaEmissao({ sourceId: SOURCE, snapshot: rascunho(), render3d: blocoAprovado, user: VENDEDOR.user, fonte: criarFonteBanco() })).rejects.toThrow(/mudou depois da aprovação/);
    // o spec "fixado" no snapshot antigo continua com a versão 1 (nada de aparência mudou para quem já recebeu o link)
    const antigo = await resolveCpqRender3dSpec({ sourceId: SOURCE, snapshot: rascunho(), user: VENDEDOR.user });
    expect(antigo.materials.find(m => m.role === "face")?.profileVersion).toBe(2);
  });

  it("link público: reconstrói a aparência APROVADA (perfil v1), sem custos nem notas internas; cotação sem 3D responde 404", async () => {
    const db = (await getDb())!;
    const snapshot = {
      sourceId: SOURCE, numeroCotacao: "COT-9999", dataEmissao: new Date().toISOString(), validadeDias: 20, modalidadeFrete: "retira", metodoPagamento: "pix",
      cliente: { cnpj: null, razao: "Cliente Teste", fantasia: null, endereco: null, email: null, whatsapp: null }, vendedor: "Vendedora", modeloNome: "Letra caixa teste",
      nestingSvg: SVG, larguraNestingMm: 800, alturaNestingMm: 300, tiposFixacao: ["barra_roscada"], mubisysProdutoId: PRODUTO, mubisysModeloId: MODELO,
      materiais: rascunho().materiais.map(m => ({ ...m, custoUnitario: 123.45, custoTotal: 987.65, formulaType: "area", multiplicador: 1, variacaoModeloId: null, variacaoModeloNome: null, variacaoMaterial: null })),
      mapeamentoCores: null, custoDireto: 4321.09, precoFinal: 9999.99, margemPct: 41.5, regraPreco: "regra interna de margem", reacaoCliente: null, areaM2: 0.2, areaGeralM2: 0.24,
      render3d: blocoAprovado,
    };
    await db.insert(propostas).values({ token: TOKEN, tituloProposta: "t", clienteNome: "Cliente Teste", vendedorNome: "Vendedora", observacoes: PREFIXO + JSON.stringify(snapshot), status: "aberta" });
    sessao.atual = null; // link do cliente: sem login
    const aviso = vi.spyOn(console, "warn");
    const resposta = await api("GET", `/api/letra-caixa/cotacoes/${TOKEN}/render3d`);
    expect(resposta.status).toBe(200);
    expect(resposta.json.materials.find((m: { role: string }) => m.role === "face")).toMatchObject({ profileVersion: 1, family: "acrylic_translucent" });
    expect(resposta.json.materials.find((m: { role: string }) => m.role === "face").pbr.transmission).toBeCloseTo(pbrAcrilico.transmission, 5);
    expect(resposta.texto).not.toMatch(/custo|margem|regra interna|987\.65|123\.45|9999|ticket|Acrílico leitoso|Perfil lateral 80mm|teste 3D|profileName/i);
    expect(resposta.json.construction).toMatchObject({ boxDepthMm: 80 });
    // o spec reconstruído a partir do snapshot é o MESMO que foi aprovado (mesmo hash): nenhum aviso de divergência
    expect(resposta.json.specHash).toBe(hashAprovado);
    expect(resposta.json.previewAnimationUrl).toBe("https://teste123.ufs.sh/f/montagem.gif");
    expect(aviso).not.toHaveBeenCalled();
    aviso.mockRestore();
    // visão pública da cotação: só as imagens estáticas
    const cotacao = await api("GET", `/api/letra-caixa/cotacoes/${TOKEN}`);
    expect(cotacao.json.render3d).toMatchObject({ previewDayUrl: "https://teste123.ufs.sh/f/dia.png", previewAnimationUrl: "https://teste123.ufs.sh/f/montagem.gif" });
    expect(cotacao.texto).not.toMatch(/ticket/);

    await db.update(propostas).set({ observacoes: PREFIXO + JSON.stringify({ ...snapshot, render3d: undefined }) }).where(eq(propostas.token, TOKEN));
    expect((await api("GET", `/api/letra-caixa/cotacoes/${TOKEN}/render3d`)).status).toBe(404);
    expect((await api("GET", `/api/letra-caixa/cotacoes/${TOKEN}`)).json.render3d).toBeNull();
  });
});
