type TabelaPrecoConteudo = {
  type?: string;
  columns?: unknown;
  faixaIds?: unknown;
  rows?: unknown;
};

export type CelulaTabelaPreco = {
  linhaId: number;
  linhaLabel: string;
  faixaId: number;
  faixaIndex: number;
  faixaLabel: string;
  margemPct: number;
};

function valorFaixa(texto: string): number {
  const valor = texto.trim();
  if (/k$/i.test(valor)) return Number.parseFloat(valor.replace(/k$/i, "").replace(",", ".")) * 1000;
  return Number.parseFloat(valor.replace(/\./g, "").replace(",", ".")) || 0;
}

function faixaAceita(custo: number, label: string): boolean {
  const faixa = label.replace(/R\$/g, "").trim();
  if (/^até/i.test(faixa)) {
    const limite = faixa.match(/[\d.,]+k?/i)?.[0] || "0";
    return custo <= valorFaixa(limite);
  }
  if (/\+\s*$/.test(faixa)) {
    const minimo = faixa.match(/[\d.,]+k?\+/i)?.[0]?.replace(/\+$/, "") || "0";
    return custo >= valorFaixa(minimo);
  }
  const partes = faixa.split("~");
  return partes.length === 2 && custo >= valorFaixa(partes[0]) && custo <= valorFaixa(partes[1]);
}

/** Resolve o índice de valores, pulando a coluna descritiva das margin_table_multi. */
export function selecionarCelulaTabelaPreco(
  contentJson: string,
  linhaId: number,
  custoBaseFaixa: number,
): CelulaTabelaPreco | null {
  let conteudo: TabelaPrecoConteudo;
  try { conteudo = JSON.parse(contentJson) as TabelaPrecoConteudo; }
  catch { return null; }
  if (conteudo.type !== "margin_table" && conteudo.type !== "margin_table_multi") return null;
  const colunas = Array.isArray(conteudo.columns) ? conteudo.columns.filter((item): item is string => typeof item === "string") : [];
  const rows = Array.isArray(conteudo.rows) ? conteudo.rows as Array<{ id?: unknown; label?: unknown; values?: unknown }> : [];
  const row = rows.find(item => Number(item.id) === linhaId);
  if (!row || !Array.isArray(row.values) || !Array.isArray(conteudo.faixaIds)) return null;
  const offset = conteudo.type === "margin_table_multi" ? 1 : 0;
  const faixas = colunas.slice(offset);
  if (faixas.length !== row.values.length || conteudo.faixaIds.length !== row.values.length) return null;
  const selecionado = faixas.findIndex(label => faixaAceita(custoBaseFaixa, label));
  const temFaixaDeTicket = faixas.some(label => /^até/i.test(label.trim()) || /~/.test(label) || /\+\s*$/.test(label));
  const indice = selecionado >= 0 ? selecionado : temFaixaDeTicket ? Math.max(faixas.length - 1, 0) : 0;
  const margemTexto = String(row.values[indice] ?? "").trim();
  const percentual = margemTexto.match(/^(-?\d+(?:[.,]\d+)?)\s*%$/);
  const faixaId = conteudo.faixaIds[indice];
  if (!percentual || typeof faixaId !== "number" || !Number.isInteger(faixaId) || faixaId <= 0) return null;
  const label = faixas[indice];
  if (!label || typeof row.label !== "string") return null;
  return {
    linhaId,
    linhaLabel: row.label,
    faixaId,
    faixaIndex: indice,
    faixaLabel: label,
    margemPct: Number(percentual[1].replace(",", ".")),
  };
}
