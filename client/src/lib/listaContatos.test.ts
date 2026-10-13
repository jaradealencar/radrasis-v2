import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { extrairContatos, extrairContatosDeMatriz, lerListaContatos, MAX_CONTATOS_LISTA } from "./listaContatos";

describe("extrairContatos", () => {
  it("lê telefone e nome_cliente e ignora linhas em branco", () => {
    const r = extrairContatos([
      { telefone: "(67) 99999-0000", nome_cliente: "Ana" },
      { telefone: "", nome_cliente: "" },
      { telefone: 67988887777, nome_cliente: " Bia " },
    ]);
    expect(r).toMatchObject({ ok: true, linhasLidas: 3, colunaTelefone: "telefone", colunaNome: "nome_cliente" });
    if (r.ok) expect(r.contatos).toEqual([{ telefone: "(67) 99999-0000", nome: "Ana" }, { telefone: "67988887777", nome: "Bia" }]);
  });

  it("aceita apelidos e cabeçalho com acento/caixa/espaço, sem confundir 'nome_do_vendedor' com nome", () => {
    const r = extrairContatos([{ "Nome do Vendedor": "Zé", "Nome Cliente": "Ana", "WhatsApp": "67999990000" }]);
    expect(r).toMatchObject({ ok: true, colunaTelefone: "WhatsApp", colunaNome: "Nome Cliente" });
  });

  it("mantém a linha com nome e sem telefone (o servidor a reporta como inválida)", () => {
    const r = extrairContatos([{ telefone: "", nome_cliente: "Sem fone" }]);
    if (r.ok) expect(r.contatos).toEqual([{ telefone: "", nome: "Sem fone" }]);
    else throw new Error("deveria ler");
  });

  it("o nome é opcional: lista só com telefones segue", () => {
    const r = extrairContatos([{ telefone: "67999990000", cidade: "CG" }]);
    expect(r).toMatchObject({ ok: true, colunaNome: "" });
    if (r.ok) expect(r.contatos).toEqual([{ telefone: "67999990000", nome: "" }]);
  });

  it("erro claro quando falta a coluna de telefone", () => {
    const r = extrairContatos([{ nome_cliente: "Ana", cidade: "CG" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/telefone.*Colunas encontradas: nome_cliente, cidade/);
  });

  it("com várias colunas de telefone, usa a primeira preenchida da linha", () => {
    const r = extrairContatos([
      { Nome: "Ana", "Telefone 1": "", "Telefone 2": "(67) 99999-0000" },
      { Nome: "Bia", "Telefone 1": "Não informado", "Telefone 2": "67 98888-7777" },
      { Nome: "Cléo", "Telefone 1": "(67) 97777-6666", "Telefone 2": "(67) 96666-5555" },
    ]);
    expect(r.ok && r.contatos).toEqual([
      { telefone: "(67) 99999-0000", nome: "Ana" },
      { telefone: "67 98888-7777", nome: "Bia" },
      { telefone: "(67) 97777-6666", nome: "Cléo" },
    ]);
  });

  it("aceita razão social como nome", () => {
    const r = extrairContatos([{ "Razão Social": "Loja X", Celular: "67999990000" }]);
    expect(r).toMatchObject({ ok: true, colunaNome: "Razão Social", colunaTelefone: "Celular" });
  });

  it("rejeita planilha vazia e lista acima do limite", () => {
    expect(extrairContatos([]).ok).toBe(false);
    expect(extrairContatos([{ telefone: "", nome_cliente: "" }]).ok).toBe(false);
    const grande = Array.from({ length: MAX_CONTATOS_LISTA + 1 }, (_, i) => ({ telefone: String(67900000000 + i), nome_cliente: "x" }));
    expect(extrairContatos(grande).ok).toBe(false);
  });
});

describe("extrairContatosDeMatriz", () => {
  it("acha o cabeçalho depois de título e linhas em branco", () => {
    const r = extrairContatosDeMatriz([
      ["Relatório de clientes — outubro"],
      [],
      ["Cliente", "Celular", "Cidade"],
      ["Ana", "(67) 99999-0000", "CG"],
      ["Bia", 67988887777, "Dourados"],
    ]);
    expect(r).toMatchObject({ ok: true, colunaTelefone: "Celular", colunaNome: "Cliente" });
    if (r.ok) expect(r.contatos).toEqual([{ telefone: "(67) 99999-0000", nome: "Ana" }, { telefone: "67988887777", nome: "Bia" }]);
  });

  it("cabeçalhos repetidos ou vazios não se sobrescrevem", () => {
    const r = extrairContatosDeMatriz([["telefone", "", "telefone"], ["", "x", "67999990000"]]);
    expect(r.ok && r.contatos).toEqual([{ telefone: "67999990000", nome: "" }]);
  });

  it("sem cabeçalho reconhecível, lista as colunas encontradas", () => {
    const r = extrairContatosDeMatriz([["a", "b"], [1, 2]]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/Colunas encontradas: a, b/);
  });

  it("só cabeçalho, sem dados, é planilha vazia", () => {
    expect(extrairContatosDeMatriz([["telefone", "nome_cliente"]]).ok).toBe(false);
  });
});

describe("lerListaContatos", () => {
  it("XML do Excel (SpreadsheetML), mesmo anunciado como text/xml, com título antes do cabeçalho", async () => {
    const xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Lista"><Table>
  <Row><Cell><Data ss:Type="String">Clientes outubro</Data></Cell></Row>
  <Row><Cell><Data ss:Type="String">Nome</Data></Cell><Cell><Data ss:Type="String">WhatsApp</Data></Cell></Row>
  <Row><Cell><Data ss:Type="String">Ana</Data></Cell><Cell><Data ss:Type="String">(67) 99999-0000</Data></Cell></Row>
 </Table></Worksheet>
</Workbook>`;
    const r = await lerListaContatos(new File([xml], "lista.xml", { type: "text/xml" }));
    expect(r.ok && r.contatos).toEqual([{ telefone: "(67) 99999-0000", nome: "Ana" }]);
  });

  it("CSV com ';' e acentos em UTF-8, preservando o zero à esquerda do telefone", async () => {
    const csv = "﻿telefone;nome_cliente\r\n067999990000;José da Conceição\r\n(67) 98888-7777;Ângela\r\n";
    const r = await lerListaContatos(new File([csv], "lista.csv", { type: "text/csv" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.contatos).toEqual([
      { telefone: "067999990000", nome: "José da Conceição" },
      { telefone: "(67) 98888-7777", nome: "Ângela" },
    ]);
  });

  it("CSV com vírgula", async () => {
    const r = await lerListaContatos(new File(["telefone,nome_cliente\n67999990000,Ana\n"], "l.csv", { type: "text/csv" }));
    expect(r.ok && r.contatos).toEqual([{ telefone: "67999990000", nome: "Ana" }]);
  });

  it("XLSX (telefone numérico na célula)", async () => {
    const ws = XLSX.utils.aoa_to_sheet([["telefone", "nome_cliente"], [67999990000, "Ana"], ["(67) 98888-7777", "Bia"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lista");
    const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const r = await lerListaContatos(new File([bytes], "lista.xlsx"));
    expect(r.ok && r.contatos).toEqual([{ telefone: "67999990000", nome: "Ana" }, { telefone: "(67) 98888-7777", nome: "Bia" }]);
  });

  it("arquivo ilegível vira erro amigável, não exceção", async () => {
    const r = await lerListaContatos(new File([new Uint8Array([0, 1, 2, 3])], "lixo.xlsx"));
    expect(r.ok).toBe(false);
  });
});
