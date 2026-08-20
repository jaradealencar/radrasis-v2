/**
 * Resume a diferença entre duas versões do `contentJson` de uma seção da
 * Tabela de Preços (estrutura `margin_table` ou `margin_table_multi`) num
 * texto legível — usado para popular a observação da métrica automática
 * "Alteração na Tabela de Preços" (ver server/db/db.ts, updatePriceTableSection).
 */
type LinhaMargem = { label?: string; values?: unknown[]; value?: unknown };
type ConteudoMargem = { type?: string; columns?: string[]; rows?: LinhaMargem[] };

export function resumirDiffTabelaPrecos(anteriorRaw: string, novoRaw: string): { resumo: string; qtdAlteracoes: number } {
  let antes: ConteudoMargem;
  let novo: ConteudoMargem;
  try {
    antes = JSON.parse(anteriorRaw || "{}");
    novo = JSON.parse(novoRaw || "{}");
  } catch {
    return { resumo: "conteúdo alterado", qtdAlteracoes: 1 };
  }

  const linhasAntes = Array.isArray(antes.rows) ? antes.rows : [];
  const linhasNovo = Array.isArray(novo.rows) ? novo.rows : [];
  const colunas = Array.isArray(novo.columns) ? novo.columns : [];
  // Em margin_table_multi a 1ª coluna é o rótulo da linha (ex: "Área"), então
  // os valores começam em columns[1]. Em margin_table, columns[j] já é o valor.
  const offsetColuna = novo.type === "margin_table_multi" ? 1 : 0;

  const diffs: string[] = [];
  const max = Math.max(linhasAntes.length, linhasNovo.length);
  for (let i = 0; i < max; i++) {
    const a = linhasAntes[i];
    const n = linhasNovo[i];
    if (!a || !n) continue;
    const label = n.label ?? a.label ?? `linha ${i + 1}`;
    const valoresAntes = Array.isArray(a.values) ? a.values : [a.value];
    const valoresNovo = Array.isArray(n.values) ? n.values : [n.value];
    const maxCol = Math.max(valoresAntes.length, valoresNovo.length);
    for (let j = 0; j < maxCol; j++) {
      const va = valoresAntes[j];
      const vn = valoresNovo[j];
      if (va === vn || vn === undefined) continue;
      const coluna = colunas[j + offsetColuna];
      const contexto = [label, coluna].filter(Boolean).join(" / ");
      diffs.push(`${contexto || `campo ${j + 1}`}: ${va ?? "—"} → ${vn}`);
    }
  }

  if (diffs.length === 0) {
    return { resumo: "estrutura da tabela alterada (sem mudança de valor detectada)", qtdAlteracoes: 1 };
  }

  const LIMITE = 6;
  const resumo = diffs.length > LIMITE
    ? `${diffs.slice(0, LIMITE).join("; ")}; +${diffs.length - LIMITE} outra(s) faixa(s)`
    : diffs.join("; ");

  return { resumo, qtdAlteracoes: diffs.length };
}
