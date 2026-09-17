import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit3, Check, X, Download, Target, RefreshCw, Layers } from "lucide-react";
import { fmtBrl, fmtPct, fmtNum, MESES } from "@/lib/format";
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

function celulaRoi(v: number | null | undefined): React.ReactNode {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  return <span className={`font-semibold ${v >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtPct(v, 0)}</span>;
}

function parseValor(texto: string): number | null {
  if (texto.trim() === "") return null; // vazio = limpar (tri-state), não zero
  const n = parseFloat(texto.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? NaN : n;
}

/** Cada bloco (Aquisição/Reativação) é uma tabela estreita e independente —
 * editar o investimento de um não exige tocar no outro (a mutation aceita os
 * dois campos separadamente, tri-state: campo omitido = não altera). Isso
 * também resolve a tabela larga demais de antes, que exigia rolar a barra
 * horizontal pra ver Aquisição e Reativação ao mesmo tempo. */

export default function MarketingAnaliseMensal({ ano, relatorio, refetch }: Props) {
  const utils = trpc.useUtils();
  const upsertMarketing = trpc.financeiro.upsertCustoMarketing.useMutation({
    onSuccess: () => {
      toast.success("Investimento salvo!");
      refetch();
      utils.marketingFinanceiro.invalidate();
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  // ─── Bloco Aquisição ────────────────────────────────────────────────────
  const [editAquisicao, setEditAquisicao] = useState<number | null>(null);
  const [inputAquisicao, setInputAquisicao] = useState("");

  function iniciarEdicaoAquisicao(m: MesRelatorio) {
    setEditAquisicao(m.mes);
    setInputAquisicao(m.investimentoAquisicao != null ? m.investimentoAquisicao.toFixed(2).replace(".", ",") : "");
  }
  function salvarAquisicao(mes: number) {
    const val = parseValor(inputAquisicao);
    if (Number.isNaN(val) || (val != null && val < 0)) { toast.error("Valor inválido"); return; }
    upsertMarketing.mutate({ mes, ano, investimentoAquisicao: val }, { onSuccess: () => setEditAquisicao(null) });
  }

  // ─── Bloco Reativação ───────────────────────────────────────────────────
  const [editReativacao, setEditReativacao] = useState<number | null>(null);
  const [inputReativacao, setInputReativacao] = useState("");

  function iniciarEdicaoReativacao(m: MesRelatorio) {
    setEditReativacao(m.mes);
    setInputReativacao(m.investimentoReativacao != null ? m.investimentoReativacao.toFixed(2).replace(".", ",") : "");
  }
  function salvarReativacao(mes: number) {
    const val = parseValor(inputReativacao);
    if (Number.isNaN(val) || (val != null && val < 0)) { toast.error("Valor inválido"); return; }
    upsertMarketing.mutate({ mes, ano, investimentoReativacao: val }, { onSuccess: () => setEditReativacao(null) });
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
      `roi-marketing-${ano}`,
      `Marketing ${ano}`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground max-w-xl">
          Preencha o investimento mensal em cada bloco (deixe em branco para "não preenchido" — diferente de zero). Editar Aquisição não mexe em Reativação, e vice-versa. Os demais campos são calculados automaticamente.
        </p>
        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={exportar}>
          <Download size={14} /> Exportar Excel completo
        </Button>
      </div>

      {/* ─── Bloco Aquisição ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-purple-700"><Target size={17} /> Aquisição — {ano}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Invest.</TableHead>
                  <TableHead className="text-right">Novos</TableHead>
                  <TableHead className="text-right">CAC</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead className="w-10">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorio.meses.map(m => {
                  const isEditing = editAquisicao === m.mes;
                  return (
                    <TableRow key={m.mes} className={m.mesParcial ? "bg-blue-50/40" : ""}>
                      <TableCell className="font-medium">
                        {MESES[m.mes - 1]}
                        {m.mesParcial && <Badge variant="outline" className="ml-1.5 text-[9px] bg-blue-50 text-blue-700 border-blue-200">Parcial</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input className="w-24 h-7 text-right text-xs ml-auto" value={inputAquisicao} placeholder="vazio" autoFocus onChange={e => setInputAquisicao(e.target.value)} onKeyDown={e => { if (e.key === "Enter") salvarAquisicao(m.mes); if (e.key === "Escape") setEditAquisicao(null); }} />
                        ) : celulaValor(m.investimentoAquisicao, "font-semibold text-purple-700")}
                      </TableCell>
                      <TableCell className="text-right">{fmtNum(m.novo.qtdClientesUnicos)}</TableCell>
                      <TableCell className="text-right">{m.novo.cacPonderado != null ? fmtBrl(m.novo.cacPonderado) : "—"}</TableCell>
                      <TableCell className="text-right text-emerald-700">{fmtBrl(m.novo.faturamento)}</TableCell>
                      <TableCell className="text-right">{fmtBrl(m.novo.margem.margemTotal)}</TableCell>
                      <TableCell className="text-right">{celulaRoi(m.novo.roiPct)}</TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-emerald-600" onClick={() => salvarAquisicao(m.mes)} disabled={upsertMarketing.isPending}><Check size={13} /></Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => setEditAquisicao(null)}><X size={13} /></Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-purple-600" onClick={() => iniciarEdicaoAquisicao(m)}><Edit3 size={12} /></Button>
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

      {/* ─── Bloco Reativação ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-orange-700"><RefreshCw size={17} /> Reativação — {ano}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Invest.</TableHead>
                  <TableHead className="text-right">Reativados</TableHead>
                  <TableHead className="text-right">Custo/Reat.</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead className="w-10">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorio.meses.map(m => {
                  const isEditing = editReativacao === m.mes;
                  return (
                    <TableRow key={m.mes} className={m.mesParcial ? "bg-blue-50/40" : ""}>
                      <TableCell className="font-medium">
                        {MESES[m.mes - 1]}
                        {m.mesParcial && <Badge variant="outline" className="ml-1.5 text-[9px] bg-blue-50 text-blue-700 border-blue-200">Parcial</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input className="w-24 h-7 text-right text-xs ml-auto" value={inputReativacao} placeholder="vazio" autoFocus onChange={e => setInputReativacao(e.target.value)} onKeyDown={e => { if (e.key === "Enter") salvarReativacao(m.mes); if (e.key === "Escape") setEditReativacao(null); }} />
                        ) : celulaValor(m.investimentoReativacao, "font-semibold text-orange-700")}
                      </TableCell>
                      <TableCell className="text-right">{fmtNum(m.reativado.qtdClientesUnicos)}</TableCell>
                      <TableCell className="text-right">{m.reativado.custoReativacaoPonderado != null ? fmtBrl(m.reativado.custoReativacaoPonderado) : "—"}</TableCell>
                      <TableCell className="text-right text-emerald-700">{fmtBrl(m.reativado.faturamento)}</TableCell>
                      <TableCell className="text-right">{fmtBrl(m.reativado.margem.margemTotal)}</TableCell>
                      <TableCell className="text-right">{celulaRoi(m.reativado.roiPct)}</TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-emerald-600" onClick={() => salvarReativacao(m.mes)} disabled={upsertMarketing.isPending}><Check size={13} /></Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => setEditReativacao(null)}><X size={13} /></Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-orange-600" onClick={() => iniciarEdicaoReativacao(m)}><Edit3 size={12} /></Button>
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

      {/* ─── Bloco Recorrente Ativo + Consolidado (só leitura) ─────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-emerald-700"><Layers size={17} /> Recorrente Ativo e Consolidado — {ano}</CardTitle>
          <p className="text-xs text-muted-foreground">Sem investimento próprio — só leitura, calculado a partir dos dois blocos acima.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Recorrentes</TableHead>
                  <TableHead className="text-right">Fat. Recorrentes</TableHead>
                  <TableHead className="text-right border-l">Pedidos</TableHead>
                  <TableHead className="text-right">Invest. Total</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                  <TableHead className="text-right">ROI Consolidado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorio.meses.map(m => (
                  <TableRow key={m.mes} className={m.mesParcial ? "bg-blue-50/40" : ""}>
                    <TableCell className="font-medium">
                      {MESES[m.mes - 1]}
                      {m.mesParcial && <Badge variant="outline" className="ml-1.5 text-[9px] bg-blue-50 text-blue-700 border-blue-200">Parcial</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{fmtNum(m.recorrenteAtivo.qtdClientesUnicos)}</TableCell>
                    <TableCell className="text-right text-emerald-700">{fmtBrl(m.recorrenteAtivo.faturamento)}</TableCell>
                    <TableCell className="text-right border-l">{fmtNum(m.novo.qtdOs + m.recorrenteAtivo.qtdOs + m.reativado.qtdOs)}</TableCell>
                    <TableCell className="text-right">{m.investimentoTotal != null ? fmtBrl(m.investimentoTotal) : "—"}</TableCell>
                    <TableCell className={`text-right font-bold ${m.consolidado.resultado != null ? (m.consolidado.resultado >= 0 ? "text-emerald-600" : "text-red-500") : "text-muted-foreground"}`}>{m.consolidado.resultado != null ? fmtBrl(m.consolidado.resultado) : "—"}</TableCell>
                    <TableCell className="text-right">{celulaRoi(m.consolidado.roiPct)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
