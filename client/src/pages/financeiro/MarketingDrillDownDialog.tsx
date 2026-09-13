import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fmtBrl, fmtNum, MESES } from "@/lib/format";
import { exportRowsToXlsx } from "@/lib/exportXlsx";

type Categoria = "novo" | "recorrenteAtivo" | "reativado" | "naoClassificado";

const LABEL_CATEGORIA: Record<Categoria, string> = {
  novo: "Novo",
  recorrenteAtivo: "Recorrente Ativo",
  reativado: "Reativado",
  naoClassificado: "Não classificado",
};

const COR_CATEGORIA: Record<Categoria, string> = {
  novo: "bg-blue-100 text-blue-700 border-blue-200",
  recorrenteAtivo: "bg-slate-100 text-slate-700 border-slate-200",
  reativado: "bg-orange-100 text-orange-700 border-orange-200",
  naoClassificado: "bg-red-100 text-red-700 border-red-200",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ano: number;
  mes?: number | null;
  categoria?: Categoria | null;
  titulo: string;
}

/** Detalhamento de pedidos por clique num KpiCard/célula — pedido, cliente,
 * data, valor, margem, classificação, vendedor, cidade — com export para
 * conferência dos totais mostrados no relatório. */
export default function MarketingDrillDownDialog({ open, onOpenChange, ano, mes, categoria, titulo }: Props) {
  const { data, isLoading } = trpc.marketingFinanceiro.getDetalhamentoPedidos.useQuery(
    { ano, mes: mes ?? null, categoria: categoria ?? null },
    { enabled: open },
  );

  const linhas = useMemo(() => (data ?? []).slice().sort((a, b) => b.valorOs - a.valorOs), [data]);
  const totalFaturamento = useMemo(() => linhas.reduce((s, l) => s + l.valorOs, 0), [linhas]);

  function exportar() {
    exportRowsToXlsx(
      linhas,
      [
        { header: "O.S.", valor: r => r.osNumero ?? "", largura: 10 },
        { header: "Cliente", valor: r => r.empresaOriginal, largura: 36 },
        { header: "Mês", valor: r => MESES[r.mes - 1], largura: 12 },
        { header: "Data Aprovação", valor: r => r.dataAprovacao ?? "", largura: 18 },
        { header: "Valor (R$)", valor: r => r.valorOs, largura: 14 },
        { header: "Margem (R$)", valor: r => r.contribuicaoReais ?? "", largura: 14 },
        { header: "Classificação", valor: r => LABEL_CATEGORIA[r.categoria], largura: 16 },
        { header: "Já comprou antes?", valor: r => r.jaComprouAntes ? "Sim" : "Não", largura: 16 },
        { header: "Meses desde última compra", valor: r => r.gapMesesUltimaCompra ?? "", largura: 16 },
        { header: "Vendedor", valor: r => r.vendedor ?? "", largura: 24 },
        { header: "Cidade", valor: r => r.cidade ?? "", largura: 20 },
        { header: "Estado", valor: r => r.estado ?? "", largura: 8 },
      ],
      `detalhamento-marketing-${ano}${mes ? `-${String(mes).padStart(2, "0")}` : ""}${categoria ? `-${categoria}` : ""}`,
      "Detalhamento",
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {linhas.length} pedido(s) · Total {fmtBrl(totalFaturamento)} — os totais aqui devem bater com os números exibidos no relatório (mesma fonte de dados).
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={exportar} disabled={linhas.length === 0}>
                <Download size={14} /> Exportar Excel
              </Button>
            </div>
            <div className="overflow-auto flex-1 border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow className="text-xs">
                    <TableHead>O.S.</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l, i) => (
                    <TableRow key={`${l.osNumero}-${i}`} className="text-xs">
                      <TableCell className="font-mono">{l.osNumero ?? "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={l.empresaOriginal}>{l.empresaOriginal || "(sem nome)"}</TableCell>
                      <TableCell>{MESES[l.mes - 1]}</TableCell>
                      <TableCell className="text-right font-medium">{fmtBrl(l.valorOs)}</TableCell>
                      <TableCell className="text-right">{l.contribuicaoReais != null ? fmtBrl(l.contribuicaoReais) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={COR_CATEGORIA[l.categoria]}>
                          {LABEL_CATEGORIA[l.categoria]}
                          {l.categoria === "reativado" && l.gapMesesUltimaCompra != null && (
                            <span className="ml-1 opacity-70">({fmtNum(l.gapMesesUltimaCompra)}m)</span>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate">{l.vendedor ?? "—"}</TableCell>
                      <TableCell>{l.cidade ? `${l.cidade}/${l.estado ?? "—"}` : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {linhas.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum pedido encontrado para este filtro.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
