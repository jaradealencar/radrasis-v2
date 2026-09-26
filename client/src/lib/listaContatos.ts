import * as XLSX from "xlsx";

/**
 * Leitura da lista de contatos de um disparo (CSV/XLSX) para as Campanhas WhatsApp.
 * Exige as colunas `telefone` e `nome_cliente` (aceita apelidos comuns: celular, whatsapp, cliente, nome...).
 * Não valida o telefone aqui: quem normaliza/higieniza é o servidor, para o relatório de inválidos ser único.
 */

export const MAX_CONTATOS_LISTA = 20_000;

export interface ContatoLido { telefone: string; nome: string }

export type LeituraLista =
  | { ok: true; contatos: ContatoLido[]; linhasLidas: number; colunaTelefone: string; colunaNome: string }
  | { ok: false; erro: string };

const APELIDOS_TELEFONE = ["telefone", "celular", "whatsapp", "fone", "phone", "tel"];
const APELIDOS_NOME = ["nome_cliente", "nomecliente", "cliente", "nome", "name"];

function chaveCabecalho(h: string): string {
  return h.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[\s\-]+/g, "_");
}

function acharColuna(cabecalhos: string[], apelidos: string[]): string | null {
  // Igualdade exata (não "contém"): "nome_do_vendedor" não pode ser confundida com "nome".
  for (const apelido of apelidos) {
    const h = cabecalhos.find(c => chaveCabecalho(c) === apelido);
    if (h !== undefined) return h;
  }
  return null;
}

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  return String(v).trim();
}

/** Linhas já lidas da planilha (objetos cabeçalho→valor) → contatos. Puro. */
export function extrairContatos(linhas: Record<string, unknown>[]): LeituraLista {
  if (linhas.length === 0) return { ok: false, erro: "A planilha não tem linhas de dados." };

  const cabecalhos = Object.keys(linhas[0]);
  const colunaTelefone = acharColuna(cabecalhos, APELIDOS_TELEFONE);
  const colunaNome = acharColuna(cabecalhos, APELIDOS_NOME);
  if (!colunaTelefone || !colunaNome) {
    const faltando = [!colunaTelefone && "telefone", !colunaNome && "nome_cliente"].filter(Boolean).join(" e ");
    return {
      ok: false,
      erro: `Coluna obrigatória ausente: ${faltando}. Colunas encontradas: ${cabecalhos.filter(Boolean).join(", ") || "nenhuma"}.`,
    };
  }

  const contatos: ContatoLido[] = [];
  for (const l of linhas) {
    const telefone = texto(l[colunaTelefone]);
    const nome = texto(l[colunaNome]);
    if (!telefone && !nome) continue; // linha em branco
    contatos.push({ telefone, nome });
  }
  if (contatos.length === 0) return { ok: false, erro: "Nenhuma linha preenchida foi encontrada na planilha." };
  if (contatos.length > MAX_CONTATOS_LISTA) {
    return { ok: false, erro: `A lista tem ${contatos.length.toLocaleString("pt-BR")} contatos; o máximo por disparo é ${MAX_CONTATOS_LISTA.toLocaleString("pt-BR")}. Divida em mais de um registro.` };
  }
  return { ok: true, contatos, linhasLidas: linhas.length, colunaTelefone, colunaNome };
}

function detectarSeparador(primeiraLinha: string): string {
  const contagem = { ";": 0, ",": 0, "\t": 0 };
  for (const ch of primeiraLinha) if (ch in contagem) contagem[ch as keyof typeof contagem]++;
  return (Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0]);
}

/** Lê um `.csv` (UTF-8, `;` `,` ou tab) ou `.xlsx/.xls` (primeira aba). */
export async function lerListaContatos(arquivo: File): Promise<LeituraLista> {
  try {
    const ehCsv = /\.(csv|txt)$/i.test(arquivo.name) || arquivo.type.startsWith("text/");
    let wb: XLSX.WorkBook;
    if (ehCsv) {
      // Decodifica como UTF-8 explicitamente (o padrão do SheetJS para bytes é Windows-1252 e estragaria acentos).
      const conteudo = new TextDecoder("utf-8").decode(await arquivo.arrayBuffer());
      const FS = detectarSeparador(conteudo.split(/\r?\n/, 1)[0] ?? "");
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
