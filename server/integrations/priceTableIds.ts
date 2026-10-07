/** Stable IDs for margin rows, config items, and price-table ranges. */
type ListaChave = "rows" | "items" | "faixaIds";

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
    const id = typeof item === "number" ? item : item?.id;
    if (typeof id === "number" && id > 0) usados.add(id);
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
    const candidato = typeof item?.id === "number" ? item.id : 0;
    const valido =
      candidato > 0 &&
      !reservados.has(candidato) &&
      !usadosNestaSecao.has(candidato);
    const id = valido ? candidato : ++maiorConhecido;
    usadosNestaSecao.add(id);
    return { ...item, id };
  });
  let resultado = { ...parsed, [chave]: novaLista };

  if (isMargin) {
    const reservadosFaixa = new Set<number>();
    for (const sec of outrasSecoes) {
      for (const id of extrairIdsUsados(
        sec.contentJson,
        "faixaIds",
        ehTabelaDeMargem
      ))
        reservadosFaixa.add(id);
    }
    const faixaIdsAntigos = Array.isArray(parsed.faixaIds)
      ? parsed.faixaIds
      : [];
    const maiorExistente = faixaIdsAntigos.reduce(
      (maior: number, id: unknown) =>
        typeof id === "number" && id > maior ? id : maior,
      0
    );
    let maiorFaixa = Math.max(
      maiorExistente,
      reservadosFaixa.size ? Math.max(...reservadosFaixa) : 0
    );
    const usadosNestaSecaoFaixas = new Set<number>();
    const offset = parsed.type === "margin_table_multi" ? 1 : 0;
    const quantidade = Math.max(
      0,
      (Array.isArray(parsed.columns) ? parsed.columns.length : 0) - offset
    );
    const faixaIds = Array.from({ length: quantidade }, (_, i) => {
      const candidato = faixaIdsAntigos[i];
      const valido =
        typeof candidato === "number" &&
        candidato > 0 &&
        !reservadosFaixa.has(candidato) &&
        !usadosNestaSecaoFaixas.has(candidato);
      const id = valido ? candidato : ++maiorFaixa;
      usadosNestaSecaoFaixas.add(id);
      return id;
    });
    resultado = { ...resultado, faixaIds };
  }

  return JSON.stringify(resultado);
}
