/**
 * Atribui um ID estável e numérico a cada linha de margem (`rows[].id`,
 * seções type "margin_table"/"margin_table_multi") e a cada regra
 * (`items[].id`, seções type "config") da Tabela de Preços — para o
 * precificador automatizado externo referenciar uma linha/regra específica
 * sem depender do texto do label. Ver server/routes/price-table-api.ts
 * (export consumido pelo precificador) e shared/price-table.ts.
 *
 * Linhas e regras têm espaços de numeração separados (id de linha e id de
 * regra podem coincidir sem colidir entre si), mas dentro de cada espaço a
 * numeração é global — soma todas as páginas/abas (Clientes Antigos e Novo
 * Cliente). Uma mesma categoria de produto (ex: "Galvanizado fechado frente
 * e fundo") recebe IDs DIFERENTES em cada aba — decisão do usuário
 * 28/09/2026: não há tentativa de casar a linha de uma aba com a linha
 * equivalente da outra, mesmo cobrindo o mesmo produto.
 *
 * Chamado por updatePriceTableSection/addPriceTableSection (server/db/db.ts)
 * antes de persistir — nunca confia em `id` vindo do client. `outrasSecoes`
 * deve conter TODAS as seções já existentes exceto a que está sendo salva
 * (senão o id atual da própria linha, já presente no banco, seria visto
 * como "reservado por outra seção" e trocado a cada edição).
 */
type ListaChave = "rows" | "items";

function ehTabelaDeMargem(tipo: unknown): boolean {
  return tipo === "margin_table" || tipo === "margin_table_multi";
}

function extrairIdsUsados(
  contentJson: string,
  chave: ListaChave,
  tipoEsperado: (tipo: unknown) => boolean
): Set<number> {
  const usados = new Set<number>();
  let parsed: any;
  try {
    parsed = JSON.parse(contentJson);
  } catch {
    return usados;
  }
  if (!tipoEsperado(parsed.type) || !Array.isArray(parsed[chave]))
    return usados;
  for (const item of parsed[chave]) {
    if (item && typeof item.id === "number" && item.id > 0) usados.add(item.id);
  }
  return usados;
}

export function normalizarIdsTabelaPrecos(
  contentJsonNovo: string,
  outrasSecoes: { contentJson: string }[]
): string {
  let parsed: any;
  try {
    parsed = JSON.parse(contentJsonNovo);
  } catch {
    return contentJsonNovo;
  }

  const isMargin = ehTabelaDeMargem(parsed.type);
  const isConfig = parsed.type === "config";
  if (!isMargin && !isConfig) return contentJsonNovo;

  const chave: ListaChave = isMargin ? "rows" : "items";
  const tipoEsperado = isMargin
    ? ehTabelaDeMargem
    : (t: unknown) => t === "config";
  const lista = parsed[chave];
  if (!Array.isArray(lista)) return contentJsonNovo;

  const reservados = new Set<number>();
  for (const sec of outrasSecoes) {
    for (const id of extrairIdsUsados(sec.contentJson, chave, tipoEsperado))
      reservados.add(id);
  }

  let maiorConhecido = reservados.size ? Math.max(...reservados) : 0;
  const usadosNestaSecao = new Set<number>();
  const novaLista = lista.map((item: any) => {
    const idValido =
      typeof item?.id === "number" &&
      item.id > 0 &&
      !reservados.has(item.id) &&
      !usadosNestaSecao.has(item.id);
    const id = idValido ? item.id : ++maiorConhecido;
    usadosNestaSecao.add(id);
    return { ...item, id };
  });

  return JSON.stringify({ ...parsed, [chave]: novaLista });
}
