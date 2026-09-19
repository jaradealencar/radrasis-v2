import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import {
  extrairContatoDaOs,
  formatarLinkWhatsApp,
  indexarContatosPorCliente,
} from "../routers/performanceComercial";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resposta real de GET /ordem-servico/numero/6917 (anonimizada) — mesmo formato de cada item da listagem. */
const fixtureOs6917 = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/mubisys-os-6917.json"), "utf-8"),
);

describe("extrairContatoDaOs", () => {
  it("lê celular, nome do contato, cidade e UF da OS real do MubiSys", () => {
    expect(extrairContatoDaOs(fixtureOs6917)).toEqual({
      telefone: "(11) 99999-0000",
      contato: "Fulano de Tal",
      cidade: "São Paulo",
      estado: "SP",
    });
  });

  it("prefere o primeiro contato ativo COM número, mesmo que não seja o primeiro da lista", () => {
    const os = {
      cliente_contato: [
        { nome_contato: "Financeiro", celular: "", status: "Ativo" },
        { nome_contato: "Antigo", celular: "67 99999-1111", status: "Inativo" },
        { nome_contato: "Aline", celular: "+556792792655", status: "Ativo" },
      ],
      cliente_endereco: [{ cidade: "CAMPO GRANDE", estado: "MS" }],
    };
    expect(extrairContatoDaOs(os)).toMatchObject({ telefone: "+556792792655", contato: "Aline" });
  });

  it("usa contato inativo só se nenhum ativo tiver número", () => {
    const os = { cliente_contato: [{ nome_contato: "Antigo", celular: "67 99999-1111", status: "Inativo" }] };
    expect(extrairContatoDaOs(os).telefone).toBe("67 99999-1111");
  });

  it("devolve vazio (sem lançar) quando a OS não tem contato nem endereço", () => {
    expect(extrairContatoDaOs({})).toEqual({ telefone: "", contato: "", cidade: "", estado: "" });
    expect(extrairContatoDaOs(null)).toEqual({ telefone: "", contato: "", cidade: "", estado: "" });
  });
});

describe("formatarLinkWhatsApp", () => {
  it("adiciona o DDI 55 a número com DDD", () => {
    expect(formatarLinkWhatsApp("(11) 99999-0000")).toBe("https://wa.me/5511999990000");
  });

  it("mantém número que já vem com DDI (+55)", () => {
    expect(formatarLinkWhatsApp("+556792792655")).toBe("https://wa.me/556792792655");
  });

  it("não confunde DDD 55 (RS) com DDI: 55 99999-0000 vira 5555999990000", () => {
    expect(formatarLinkWhatsApp("(55) 99999-0000")).toBe("https://wa.me/5555999990000");
  });

  it("devolve string vazia sem telefone", () => {
    expect(formatarLinkWhatsApp("")).toBe("");
    expect(formatarLinkWhatsApp("sem tel")).toBe("");
  });
});

describe("indexarContatosPorCliente", () => {
  it("casa por nome normalizado (sem acento/pontuação) e prefere a OS que tem telefone", () => {
    const indice = indexarContatosPorCliente([
      { cliente: "SANTO MAIS COMUNICAÇÃO VISUAL", cliente_contato: [], cliente_endereco: [{ cidade: "CAMPO GRANDE", estado: "MS" }] },
      { cliente: "SANTO MAIS COMUNICAÇÃO VISUAL", cliente_contato: [{ nome_contato: "Aline", celular: "+556792792655", status: "Ativo" }] },
    ]);
    expect(indice["santo mais comunicacao visual"]).toEqual({
      telefone: "+556792792655",
      contato: "Aline",
      cidade: "CAMPO GRANDE",
      estado: "MS",
    });
  });
});
