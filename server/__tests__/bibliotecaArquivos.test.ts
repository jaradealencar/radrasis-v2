import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("mammoth", () => ({
  extractRawText: vi.fn(),
}));

vi.mock("pdf-parse/lib/pdf-parse.js", () => ({
  default: vi.fn(),
}));

vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn(),
  buildFileContent: vi.fn(),
  buildImageContent: vi.fn(),
}));

import { extrairTextoArquivo } from "../routers/bibliotecaArquivos";
import * as mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { invokeLLM, buildFileContent, buildImageContent } from "../_core/llm";

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MIME_PDF = "application/pdf";

describe("extrairTextoArquivo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extrai o conteúdo real de um XLSX gerado em memória", async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["nome", "cargo"],
      ["Ana Torres", "Instaladora Chefe"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Equipe");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const fileBase64 = buffer.toString("base64");

    const resultado = await extrairTextoArquivo(fileBase64, MIME_XLSX, "equipe.xlsx", "Equipe");

    expect(resultado).toContain("Ana Torres");
    expect(resultado).toContain("Instaladora Chefe");
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("extrai o conteúdo real de um DOCX (mammoth mockado, roteamento por mimeType)", async () => {
    vi.mocked(mammoth.extractRawText).mockResolvedValue({ value: "Texto real do contrato.", messages: [] });

    const fileBase64 = Buffer.from("conteudo docx fake").toString("base64");
    const resultado = await extrairTextoArquivo(fileBase64, MIME_DOCX, "contrato.docx", "Contrato");

    expect(resultado).toBe("Texto real do contrato.");
    expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer: Buffer.from(fileBase64, "base64") });
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("extrai o conteúdo real de um PDF com camada de texto (pdf-parse mockado, roteamento por mimeType)", async () => {
    const textoLongo = "Cláusula 1: ".repeat(10);
    vi.mocked(pdfParse).mockResolvedValue({ text: textoLongo } as never);

    const fileBase64 = Buffer.from("conteudo pdf fake").toString("base64");
    const resultado = await extrairTextoArquivo(fileBase64, MIME_PDF, "documento.pdf", "Documento");

    expect(resultado).toBe(textoLongo.trim());
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("nenhum dos 3 tipos nativos chama o LLM", async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["a"]]), "S");
    const xlsxBase64 = (XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer).toString("base64");

    vi.mocked(mammoth.extractRawText).mockResolvedValue({ value: "docx", messages: [] });
    vi.mocked(pdfParse).mockResolvedValue({ text: "x".repeat(60) } as never);

    await extrairTextoArquivo(xlsxBase64, MIME_XLSX, "a.xlsx", "A");
    await extrairTextoArquivo(Buffer.from("d").toString("base64"), MIME_DOCX, "a.docx", "A");
    await extrairTextoArquivo(Buffer.from("p").toString("base64"), MIME_PDF, "a.pdf", "A");

    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("PDF sem camada de texto (pdf-parse vazio) cai no fallback de LLM visão", async () => {
    vi.mocked(pdfParse).mockResolvedValue({ text: "" } as never);
    vi.mocked(buildFileContent).mockResolvedValue({ type: "file", file: { filename: "a.pdf", file_data: "data:application/pdf;base64,xx" } });
    vi.mocked(invokeLLM).mockResolvedValue({
      id: "1",
      created: 0,
      model: "gpt-5-mini",
      choices: [{ index: 0, message: { role: "assistant", content: "texto extraído via visão" }, finish_reason: "stop" }],
    });

    const fileBase64 = Buffer.from("pdf escaneado fake").toString("base64");
    const resultado = await extrairTextoArquivo(fileBase64, MIME_PDF, "escaneado.pdf", "Escaneado");

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(buildFileContent).toHaveBeenCalledWith(fileBase64, MIME_PDF, "escaneado.pdf");
    expect(resultado).toBe("texto extraído via visão");
  });
});
