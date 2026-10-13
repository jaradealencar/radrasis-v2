import * as XLSX from "xlsx";
import { detectarSeparadorCsv, extrairContatosDeMatriz, type LeituraLista } from "@shared/lista-contatos";

/**
 * Leitura da lista de contatos de um disparo (CSV/XLSX/XML) no navegador, a partir de um `File` do
 * `<input type="file">`. A extração pura (achar o cabeçalho e a coluna de telefone/nome) mora em
 * shared/lista-contatos.ts — reaproveitada aqui e também pela leitura de arquivo no servidor
 * (server/services/fontesErpCampanhas.ts, fontes de dados por upload).
 */
export { extrairContatos, extrairContatosDeMatriz, MAX_CONTATOS_LISTA, type ContatoLido, type LeituraLista } from "@shared/lista-contatos";

/** Lê um `.csv` (UTF-8, `;` `,` ou tab), `.xlsx/.xls` ou `.xml` (planilha XML do Excel); só a primeira aba. */
export async function lerListaContatos(arquivo: File): Promise<LeituraLista> {
  try {
    // XML do Excel (SpreadsheetML) também chega como "text/xml": não é CSV, o SheetJS o reconhece pelo conteúdo.
    const ehXml = /\.xml$/i.test(arquivo.name) || /xml/i.test(arquivo.type);
    const ehCsv = !ehXml && (/\.(csv|txt)$/i.test(arquivo.name) || arquivo.type.startsWith("text/"));
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
    return extrairContatosDeMatriz(XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true }));
  } catch {
    return { ok: false, erro: "Não consegui ler esse arquivo. Confira se é um .csv, .xlsx ou .xml válido." };
  }
}
