/**
 * Extração de contatos (telefone + nome) a partir de linhas de planilha já parseadas (objetos
 * cabeçalho→valor) — isomórfico (client + server): puro, sem depender de DOM/File nem de bibliotecas de
 * parsing de arquivo. Usado tanto pelo upload manual no navegador (client/src/lib/listaContatos.ts, que lê o
 * `File` e chama `extrairContatos`) quanto pela leitura de arquivo no servidor (fontes de dados por upload —
 * server/services/fontesErpCampanhas.ts, que baixa o arquivo do UploadThing e chama a mesma função aqui).
 *
 * Exige uma coluna de telefone (aceita apelidos comuns: celular, whatsapp, fone, telefone_1...); a de nome
 * (nome_cliente, cliente, nome, razão social...) é opcional. Se houver várias colunas de telefone, vale a
 * primeira preenchida da linha. O cabeçalho pode estar fora da 1ª linha (`extrairContatosDeMatriz`).
 * Não valida o telefone aqui: quem normaliza/higieniza é `server/services/campanhasWhatsapp.ts`, para o
 * relatório de inválidos ser único em todos os pontos de entrada (upload manual, fontes, webhook).
 */

export const MAX_CONTATOS_LISTA = 20_000;

export interface ContatoLido { telefone: string; nome: string }

export type LeituraLista =
  | { ok: true; contatos: ContatoLido[]; linhasLidas: number; colunaTelefone: string; colunaNome: string }
  | { ok: false; erro: string };

const APELIDOS_TELEFONE = [
  "telefone", "celular", "whatsapp", "fone", "phone", "tel", "cel", "mobile",
  "telefone_celular", "telefone_principal", "numero_telefone", "numero_whatsapp", "numero",
];
const APELIDOS_NOME = [
  "nome_cliente", "nomecliente", "cliente", "nome", "name", "nome_do_cliente", "cliente_nome", "nome_completo",
  "razao_social", "nome_fantasia", "nome_contato", "contato", "empresa",
];
/** "telefone_1", "celular 2", "whatsapp3"...: várias colunas de telefone na mesma lista. */
const TELEFONE_NUMERADO = /^(telefone|celular|whatsapp|fone|phone|tel|cel)_?\d+$/;
/** Quantas linhas do topo procuramos pelo cabeçalho (planilhas exportadas costumam ter título/logo antes). */
const LINHAS_PARA_ACHAR_CABECALHO = 20;

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

/** Todas as colunas de telefone, na ordem de prioridade: a primeira preenchida da linha vale. */
function acharColunasTelefone(cabecalhos: string[]): string[] {
  const principais = APELIDOS_TELEFONE.flatMap(apelido => cabecalhos.filter(c => chaveCabecalho(c) === apelido));
  const numeradas = cabecalhos.filter(c => TELEFONE_NUMERADO.test(chaveCabecalho(c)) && !principais.includes(c));
  return [...principais, ...numeradas];
}

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  return String(v).trim();
}

/** Tem cara de telefone (≥ 8 dígitos): "Não informado" ou "-" numa coluna não impede de usar a próxima. */
function pareceTelefone(v: string): boolean {
  return v.replace(/\D/g, "").length >= 8;
}

/** Linhas já lidas da planilha (objetos cabeçalho→valor) → contatos. Puro. */
export function extrairContatos(linhas: Record<string, unknown>[]): LeituraLista {
  if (linhas.length === 0) return { ok: false, erro: "A planilha não tem linhas de dados." };

  const cabecalhos = Object.keys(linhas[0]);
  const colunasTelefone = acharColunasTelefone(cabecalhos);
  // O nome é opcional: o template do WhatsApp pode nem usá-lo. Sem coluna de nome, a lista segue só com telefones.
  const colunaNome = acharColuna(cabecalhos, APELIDOS_NOME) ?? "";
  if (colunasTelefone.length === 0) {
    return {
      ok: false,
      erro: `Coluna de telefone não encontrada. Use um cabeçalho como "telefone", "celular" ou "whatsapp". Colunas encontradas: ${cabecalhos.filter(Boolean).join(", ") || "nenhuma"}.`,
    };
  }

  const contatos: ContatoLido[] = [];
  for (const l of linhas) {
    const candidatos = colunasTelefone.map(c => texto(l[c]));
    const telefone = candidatos.find(pareceTelefone) ?? candidatos.find(Boolean) ?? "";
    const nome = colunaNome ? texto(l[colunaNome]) : "";
    if (!telefone && !nome) continue; // linha em branco
    contatos.push({ telefone, nome });
  }
  if (contatos.length === 0) return { ok: false, erro: "Nenhuma linha preenchida foi encontrada na planilha." };
  if (contatos.length > MAX_CONTATOS_LISTA) {
    return { ok: false, erro: `A lista tem ${contatos.length.toLocaleString("pt-BR")} contatos; o máximo por disparo é ${MAX_CONTATOS_LISTA.toLocaleString("pt-BR")}. Divida em mais de um registro.` };
  }
  return { ok: true, contatos, linhasLidas: linhas.length, colunaTelefone: colunasTelefone[0], colunaNome };
}

/**
 * Planilha como matriz (`sheet_to_json` com `header: 1`) → contatos. Procura o cabeçalho nas primeiras linhas
 * (arquivos exportados de outros sistemas costumam ter título ou linhas em branco antes), então a lista não
 * precisa ser arrumada à mão antes de subir. Sem cabeçalho reconhecível, cai na 1ª linha e o erro lista as colunas.
 */
export function extrairContatosDeMatriz(matriz: unknown[][]): LeituraLista {
  const indiceCabecalho = matriz
    .slice(0, LINHAS_PARA_ACHAR_CABECALHO)
    .findIndex(linha => acharColunasTelefone(linha.map(texto)).length > 0);
  const inicio = Math.max(indiceCabecalho, 0);
  const cabecalho = (matriz[inicio] ?? []).map(texto);
  // Cabeçalho repetido ou vazio ganha um nome único, senão as colunas se sobrescrevem no objeto.
  const usados = new Set<string>();
  const chaves = cabecalho.map((nome, i) => {
    let chave = nome || `coluna_${i + 1}`;
    for (let n = 2; usados.has(chave); n++) chave = `${nome || `coluna_${i + 1}`}_${n}`;
    usados.add(chave);
    return chave;
  });
  const linhas = matriz.slice(inicio + 1).map(valores => {
    const objeto: Record<string, unknown> = {};
    chaves.forEach((chave, i) => { objeto[chave] = valores[i] ?? ""; });
    return objeto;
  });
  return extrairContatos(linhas);
}

/** Separador mais frequente na 1ª linha de um CSV — mesma heurística usada nos dois lados (client e server). */
export function detectarSeparadorCsv(primeiraLinha: string): string {
  const contagem = { ";": 0, ",": 0, "\t": 0 };
  for (const ch of primeiraLinha) if (ch in contagem) contagem[ch as keyof typeof contagem]++;
  return (Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0]);
}
