import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit3, Check, X, Download, Table2 } from "lucide-react";
import { fmtBrl, fmtPct, fmtNum, MESES, MESES_ABREV } from "@/lib/format";
import { exportRowsToXlsx } from "@/lib/exportXlsx";
import type { RouterOutputs } from "@/lib/trpc";

type RelatorioAno = RouterOutputs["marketingFinanceiro"]["getRelatorioAno"];
type MesRelatorio = RelatorioAno["meses"][number];

interface Props {
  ano: number;
  relatorio: RelatorioAno;
  refetch: () => void;
}

function celulaValor(v: number | null | undefined, cor: string): React.ReactNode {
  return v != null ? <span className={cor}>{fmtBrl(v)}</span> : <span className="text-muted-foreground">—</span>;
}

export default function MarketingAnaliseMensal({ ano, relatorio, refetch }: Props) {
  const [editando, setEditando] = useState<number | null>(null);
  const [inputAquisicao, setInputAquisicao] = useState("");
  const [inputReativacao, setInputReativacao] = useState("");

  const utils = trpc.useUtils();
  const upsertMarketing = trpc.financeiro.upsertCustoMarketing.useMutation({
    onSuccess: () => {
      toast.success("Investimento salvo!");
      setEditando(null);
      refetch();
      utils.marketingFinanceiro.invalidate();
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  function iniciarEdicao(m: MesRelatorio) {
    setEditando(m.mes);
    setInputAquisicao(m.investimentoAquisicao != null ? m.investimentoAquisicao.toFixed(2).replace(".", ",") : "");
    setInputReativacao(m.investimentoReativacao != null ? m.investimentoReativacao.toFixed(2).replace(".", ",") : "");
  }

  function parseValor(texto: string): number | null {
    if (texto.trim() === "") return null; // vazio = limpar (tri-state), não zero
    const n = parseFloat(texto.replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? NaN : n;
  }

  function salvar(mes: number) {
    const valAq = parseValor(inputAquisicao);
    const valRe = parseValor(inputReativacao);
    if (Number.isNaN(valAq) || Number.isNaN(valRe) || (valAq != null && valAq < 0) || (valRe != null && valRe < 0)) {
      toast.error("Valor inválido");
      return;
    }
    upsertMarketing.mutate({ mes, ano, investimentoAquisicao: valAq, investimentoReativacao: valRe });
  }

  function exportar() {
    exportRowsToXlsx(
      relatorio.meses,
      [
        { header: "Mês", valor: m => MESES[m.mes - 1], largura: 12 },
        { header: "Parcial?", valor: m => m.mesParcial ? "Sim" : "Não", largura: 10 },
        { header: "Invest. Aquisição", valor: m => m.investimentoAquisicao ?? "", largura: 16 },
        { header: "Clientes Novos", valor: m => m.novo.qtdClientesUnicos, largura: 14 },
        { header: "CAC", valor: m => m.novo.cacPonderado ?? "", largura: 12 },
        { header: "Fat. Novos", valor: m => m.novo.faturamento, largura: 14 },
        { header: "Margem Novos", valor: m => m.novo.margem.margemTotal, largura: 14 },
        { header: "Resultado Novos", valor: m => m.novo.resultado ?? "", largura: 14 },
        { header: "ROI Novos (%)", valor: m => m.novo.roiPct ?? "", largura: 12 },
        { header: "Invest. Reativação", valor: m => m.investimentoReativacao ?? "", largura: 16 },
        { header: "Reativados", valor: m => m.reativado.qtdClientesUnicos, largura: 12 },
        { header: "Custo/Reativado", valor: m => m.reativado.custoReativacaoPonderado ?? "", largura: 14 },
        { header: "Fat. Reativados", valor: m => m.reativado.faturamento, largura: 14 },
        { header: "Margem Reativados", valor: m => m.reativado.margem.margemTotal, largura: 16 },
        { header: "Resultado Reativados", valor: m => m.reativado.resultado ?? "", largura: 16 },
        { header: "ROI Reativados (%)", valor: m => m.reativado.roiPct ?? "", largura: 14 },
        { header: "Clientes Recorrentes Ativos", valor: m => m.recorrenteAtivo.qtdClientesUnicos, largura: 18 },
        { header: "Fat. Recorrentes", valor: m => m.recorrenteAtivo.faturamento, largura: 14 },
        { header: "Pedidos Total", valor: m => m.novo.qtdOs + m.recorrenteAtivo.qtdOs + m.reativado.qtdOs, largura: 12 },
        { header: "Investimento Total", valor: m => m.investimentoTotal ?? "", largura: 16 },
        { header: "Margem Total (N+R)", valor: m => m.consolidado.margemContribuicao, largura: 16 },
        { header: "Resultado Consolidado", valor: m => m.consolidado.resultado ?? "", largura: 16 },
        { header: "ROI Consolidado (%)", valor: m => m.consolidado.roiPct ?? "", largura: 16 },
      ],
      `analise-mensal-marketing-${ano}`,
      `Marketing ${ano}`,
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Table2 size={18} className="text-purple-600" /> Análise Mensal — {ano}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Preencha o investimento mensal em Aquisição e Reativação (deixe em branco para "não preenchido" — diferente de zero). Os demais campos são calculados automaticamente.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportar}>
          <Download size={14} /> Exportar Excel
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead rowSpan={2} className="sticky left-0 bg-slate-50 z-10 font-semibold align-bottom">Mês</TableHead>
                <TableHead colSpan={6} className="text-center font-semibold text-purple-700 border-l">Aquisição</TableHead>
                <TableHead colSpan={6} className="text-center font-semibold text-orange-700 border-l">Reativação</TableHead>
                <TableHead colSpan={2} className="text-center font-semibold text-slate-600 border-l">Recorrente Ativo</TableHead>
                <TableHead colSpan={4} className="text-center font-semibold text-emerald-700 border-l">Consolidado</TableHead>
                <TableHead rowSpan={2} className="align-bottom">Ação</TableHead>
              </TableRow>
              <TableRow className="bg-slate-50 text-[10px] text-muted-foreground">
                <TableHead className="border-l">Invest.</TableHead>
                <TableHead className="text-right">Novos</TableHead>
                <TableHead className="text-right">CAC</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="border-l">Invest.</TableHead>
                <TableHead className="text-right">Reativ.</TableHead>
                <TableHead className="text-right">Custo/Reat.</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="text-right border-l">Clientes</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right border-l">Pedidos</TableHead>
                <TableHead className="text-right">Invest. Total</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relatorio.meses.map(m => {
                const isEditing = editando === m.mes;
                return (
                  <TableRow key={m.mes} className={m.mesParcial ? "bg-blue-50/40" : ""}>
                    <TableCell className="sticky left-0 bg-white z-10 font-medium">
                      {MESES[m.mes - 1]}
                      {m.mesParcial && <Badge variant="outline" className="ml-1.5 text-[9px] bg-blue-50 text-blue-700 border-blue-200">Parcial</Badge>}
                    </TableCell>

                    <TableCell className="border-l">
                      {isEditing ? (
                        <Input className="w-24 h-7 text-right text-xs" value={inputAquisicao} placeholder="vazio" onChange={e => setInputAquisicao(e.target.value)} />
                      ) : celulaValor(m.investimentoAquisicao, "font-semibold text-purple-700")}
                    </TableCell>
                    <TableCell className="text-right">{fmtNum(m.novo.qtdClientesUnicos)}</TableCell>
                    <TableCell className="text-right">{m.novo.cacPonderado != null ? fmtBrl(m.novo.cacPonderado) : "—"}</TableCell>
                    <TableCell className="text-right text-emerald-700">{fmtBrl(m.novo.faturamento)}</TableCell>
                    <TableCell className="text-right">{fmtBrl(m.novo.margem.margemTotal)}</TableCell>
                    <TableCell className={`text-right font-semibold ${m.novo.roiPct != null && m.novo.roiPct >= 0 ? "text-emerald-600" : m.novo.roiPct != null ? "text-red-500" : "text-muted-foreground"}`}>{m.novo.roiPct != null ? fmtPct(m.novo.roiPct, 0) : "—"}</TableCell>

                    <TableCell className="border-l">
                      {isEditing ? (
                        <Input className="w-24 h-7 text-right text-xs" value={inputReativacao} placeholder="vazio" onChange={e => setInputReativacao(e.target.value)} />
                      ) : celulaValor(m.investimentoReativacao, "font-semibold text-orange-700")}
                    </TableCell>
                    <TableCell className="text-right">{fmtNum(m.reativado.qtdClientesUnicos)}</TableCell>
                    <TableCell className="text-right">{m.reativado.custoReativacaoPonderado != null ? fmtBrl(m.reativado.custoReativacaoPonderado) : "—"}</TableCell>
                    <TableCell className="text-right text-emerald-700">{fmtBrl(m.reativado.faturamento)}</TableCell>
                    <TableCell className="text-right">{fmtBrl(m.reativado.margem.margemTotal)}</TableCell>
                    <TableCell className={`text-right font-semibold ${m.reativado.roiPct != null && m.reativado.roiPct >= 0 ? "text-emerald-600" : m.reativado.roiPct != null ? "text-red-500" : "text-muted-foreground"}`}>{m.reativado.roiPct != null ? fmtPct(m.reativado.roiPct, 0) : "—"}</TableCell>

                    <TableCell className="text-right border-l">{fmtNum(m.recorrenteAtivo.qtdClientesUnicos)}</TableCell>
                    <TableCell className="text-right text-emerald-700">{fmtBrl(m.recorrenteAtivo.faturamento)}</TableCell>

                    <TableCell className="text-right border-l">{fmtNum(m.novo.qtdOs + m.recorrenteAtivo.qtdOs + m.reativado.qtdOs)}</TableCell>
                    <TableCell className="text-right">{m.investimentoTotal != null ? fmtBrl(m.investimentoTotal) : "—"}</TableCell>
                    <TableCell className={`text-right font-bold ${m.consolidado.resultado != null && m.consolidado.resultado >= 0 ? "text-emerald-600" : m.consolidado.resultado != null ? "text-red-500" : "text-muted-foreground"}`}>{m.consolidado.resultado != null ? fmtBrl(m.consolidado.resultado) : "—"}</TableCell>
                    <TableCell className={`text-right font-bold ${m.consolidado.roiPct != null && m.consolidado.roiPct >= 0 ? "text-emerald-600" : m.consolidado.roiPct != null ? "text-red-500" : "text-muted-foreground"}`}>{m.consolidado.roiPct != null ? fmtPct(m.consolidado.roiPct, 0) : "—"}</TableCell>

                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-emerald-600" onClick={() => salvar(m.mes)} disabled={upsertMarketing.isPending}><Check size={13} /></Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => setEditando(null)}><X size={13} /></Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-purple-600" onClick={() => iniciarEdicao(m)}><Edit3 size={12} /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
