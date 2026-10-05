import { randomBytes } from "crypto";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { propostas } from "../../drizzle/schema";
import { getDb } from "../db/db";
import { registrarRotasEstudioCotacoes } from "../routes/estudio-cotacoes";

/**
 * Várias cotações (uma por desenho) ligadas por um código de grupo: o cliente abre um único link, vê o total somado
 * e uma resposta vale para todas. Usa o banco de testes do .env, como os demais testes de dados do projeto.
 */
const PREFIXO = "[ESTUDIO_COTACAO_V1]";
const grupoId = "g" + randomBytes(18).toString("base64url");
const tokens = [randomBytes(12).toString("hex"), randomBytes(12).toString("hex")];
const ids: number[] = [];
let servidor: Server;
let base = "";

function snapshot(posicao: number, preco: number, modelo: string) {
  return {
    sourceId: `teste-${grupoId}-${posicao}`, numeroCotacao: `COT-9000${posicao}`, grupo: { id: grupoId, posicao },
    dataEmissao: new Date().toISOString(), validadeDias: 20, modalidadeFrete: "retira", metodoPagamento: "pix",
    formasPagamentoPermitidas: ["pix", "cartao"], jurosCartaoPct: [0, 3, 4, 5, 6, 7],
    cliente: { cnpj: "11222333000181", razao: "Cliente Teste", fantasia: "Teste", endereco: null, email: null, whatsapp: null },
    vendedor: "Vendedora", whatsappVendedor: null, tituloProposta: `Desenho ${posicao}`, modeloNome: modelo,
    descricaoProduto: "", variacoes: [], areaM2: posicao, areaGeralM2: posicao, precoFinal: preco, prazoDiasUteis: 5 + posicao,
    reacaoCliente: null,
  };
}

beforeAll(async () => {
  const db = await getDb();
  if (!db) throw new Error("banco indisponível");
  for (const [i, token] of tokens.entries()) {
    const dados = snapshot(i + 1, i === 0 ? 2000 : 1300, i === 0 ? "Letra caixa" : "Placa ACM");
    const [linha] = await db.insert(propostas).values({
      token, tituloProposta: dados.tituloProposta, clienteNome: "Cliente Teste", clienteCnpj: "11222333000181",
      vendedorNome: "Vendedora", observacoes: PREFIXO + JSON.stringify(dados), status: "aberta",
    }).returning({ id: propostas.id });
    ids.push(linha.id);
  }
  const app = express();
  app.use(express.json());
  registrarRotasEstudioCotacoes(app);
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(async () => {
  servidor?.close();
  const db = await getDb();
  if (db && ids.length) await db.delete(propostas).where(inArray(propostas.id, ids));
});

describe("cotação com vários desenhos (grupo)", () => {
  it("devolve os desenhos em ordem, com o total somado e os números das cotações", async () => {
    const resposta = await fetch(`${base}/api/letra-caixa/cotacoes/grupo/${grupoId}`);
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.itens).toHaveLength(2);
    expect(corpo.itens.map((item: { modeloNome: string }) => item.modeloNome)).toEqual(["Letra caixa", "Placa ACM"]);
    expect(corpo.precoFinal).toBe(3300);
    expect(corpo.areaM2).toBe(3);
    expect(corpo.prazoDiasUteis).toBe(7);
    expect(corpo.numero).toBe("COT-90001 + COT-90002");
    expect(corpo.reacaoCliente).toBeNull();
  });

  it("código de grupo inexistente ou malformado vira 404", async () => {
    expect((await fetch(`${base}/api/letra-caixa/cotacoes/grupo/${"g" + randomBytes(18).toString("base64url")}`)).status).toBe(404);
    expect((await fetch(`${base}/api/letra-caixa/cotacoes/grupo/curto`)).status).toBe(404);
  });

  it("uma resposta do cliente vale para todos os desenhos e usa o juros do cartão em cada um", async () => {
    const resposta = await fetch(`${base}/api/letra-caixa/cotacoes/grupo/${grupoId}/resposta`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "aprovado", comentario: "Fechado", formaPagamento: "cartao", parcelasCartao: 2 }),
    });
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.reacaoCliente.valorPagamento).toBeCloseTo(3300 * 1.03, 5);

    const db = await getDb();
    const linhas = await db!.select().from(propostas).where(inArray(propostas.id, ids));
    expect(linhas.every(linha => linha.status === "aceita")).toBe(true);
    const publico = await (await fetch(`${base}/api/letra-caixa/cotacoes/grupo/${grupoId}`)).json();
    expect(publico.reacaoCliente.tipo).toBe("aprovado");
    // o link individual de cada desenho também mostra a mesma resposta
    const individual = await (await fetch(`${base}/api/letra-caixa/cotacoes/${tokens[1]}`)).json();
    expect(individual.reacaoCliente.comentario).toBe("Fechado");
    expect(individual.precoFinal).toBe(1300);
  });

  it("recusa forma de pagamento que o vendedor não habilitou", async () => {
    const resposta = await fetch(`${base}/api/letra-caixa/cotacoes/grupo/${grupoId}/resposta`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "aprovado", formaPagamento: "boleto" }),
    });
    expect(resposta.status).toBe(400);
  });
});

