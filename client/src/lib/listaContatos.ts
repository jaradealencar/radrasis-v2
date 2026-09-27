import * as XLSX from "xlsx";
import { detectarSeparadorCsv, extrairContatos, type LeituraLista } from "@shared/lista-contatos";

/**
 * Leitura da lista de contatos de um disparo (CSV/XLSX) no navegador, a partir de um `File` do
 * `<input type="file">`. A extração pura (achar coluna telefone/nome_cliente) mora em
 * shared/lista-contatos.ts — reaproveitada aqui e também pela leitura de arquivo no servidor
 * (server/services/fontesErpCampanhas.ts, fontes de dados por upload).
 */
export { extrairContatos, MAX_CONTATOS_LISTA, type ContatoLido, type LeituraLista } from "@shared/lista-contatos";

/** Lê um `.csv` (UTF-8, `;` `,` ou tab) ou `.xlsx/.xls` (primeira aba). */
export async function lerListaContatos(arquivo: File): Promise<LeituraLista> {
  try {
    const ehCsv = /\.(csv|txt)$/i.test(arquivo.name) || arquivo.type.startsWith("text/");
    let wb: XLSX.WorkBook;
    if (ehCsv) {
      // Decodifica como UTF-8 explicitamente (o padrão do SheetJS para bytes é Windows-1252 e estragaria acentos).
      const conteudo = new TextDecoder("utf-8").decode(await arquivo.arrayBuffer());
      const FS = detectarSeparadorCsv(conteudo.split(/\r?\n/, 1)[0] ?? "");
      // raw: mantém "067999990000" como texto em vez de virar número e perder o zero.
      wb = XLSX.read(conteudo, { type: "string", raw: true, FS });
    } else {
      wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
    }
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { ok: false, erro: "Não encontrei nenhuma aba na planilha." };
    return extrairContatos(XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true }));
  } catch {
    return { ok: false, erro: "Não consegui ler esse arquivo. Confira se é um .csv ou .xlsx válido." };
  }
}
