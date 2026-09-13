import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Users, Loader2 } from "lucide-react";
import { fmtBrl, fmtPct, fmtNum } from "@/lib/format";

/** Resultado por vendedor — reaproveita trpc.marketingFinanceiro.getResultadoPorVendedor
 * (que por sua vez reaproveita calcularRadarMargens, já usado pela aba Radar de
 * Margens). É uma agregação histórica completa (todos os anos), não filtrável
 * por ano — limitação herdada da função original, documentada no plano. */
export default function ResultadoPorVendedor() {
  const { data, isLoading } = trpc.marketingFinanceiro.getResultadoPorVendedor.useQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center py-10 text-muted-foreground gap-2"><Loader2 size={16} className="animate-spin" /> Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Users size={16} className="text-slate-600" /> Resultado por Vendedor</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Histórico completo (todos os anos) — mesma base do Radar de Margens. Vendedores com menos de 5 pedidos ficam fora, por volume insuficiente.</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="text-right">Margem de Contribuição</TableHead>
              <TableHead className="text-right">% Margem</TableHead>
              <TableHead className="text-right">Resultado</TableHead>
              <TableHead className="text-right">% Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map(v => (
              <TableRow key={v.vendedor}>
                <TableCell className="font-medium">{v.vendedor}</TableCell>
                <TableCell className="text-right">{fmtNum(v.count)}</TableCell>
                <TableCell className="text-right text-emerald-700">{fmtBrl(v.valorOs)}</TableCell>
                <TableCell className="text-right">{fmtBrl(v.contribuicao)}</TableCell>
                <TableCell className="text-right">{fmtPct(v.contribuicaoPct)}</TableCell>
                <TableCell className={`text-right font-semibold ${v.resultado >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtBrl(v.resultado)}</TableCell>
                <TableCell className={`text-right ${v.resultadoPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtPct(v.resultadoPct)}</TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum vendedor com volume suficiente.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
