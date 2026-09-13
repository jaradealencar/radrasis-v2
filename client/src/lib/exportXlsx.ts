import * as XLSX from "xlsx";

/**
 * Export genérico de linhas para .xlsx — mesmo padrão já usado em
 * client/src/pages/comercial/AnaliseGeografica.tsx (aoa_to_sheet + writeFile),
 * generalizado para qualquer tela do projeto.
 */
export interface ColunaExport<T> {
  header: string;
  /** Extrai o valor da linha para esta coluna. */
  valor: (row: T) => string | number | null | undefined;
  /** Largura da coluna no Excel (em caracteres, unidade "wch" do SheetJS). */
  largura?: number;
}

export function exportRowsToXlsx<T>(rows: T[], colunas: ColunaExport<T>[], filename: string, sheetName = "Dados"): void {
  const wsData = [
    colunas.map(c => c.header),
    ...rows.map(row => colunas.map(c => c.valor(row) ?? "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = colunas.map(c => ({ wch: c.largura ?? 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)); // Excel limita nome de aba a 31 caracteres
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
