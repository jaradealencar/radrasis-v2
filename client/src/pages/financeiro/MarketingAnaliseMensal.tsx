import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit3, Check, X, Download, Target, RefreshCw, Layers } from "lucide-react";
import { competenciaIso, fmtBrl, fmtPct, fmtNum, MESES } from "@/lib/format";
import { exportRowsToXlsx } from "@/lib/exportXlsx";
import type { RouterOutputs } from "@/lib/trpc";
import MarketingInvestimentoInput from "./MarketingInvestimentoInput";
import {
  calcularResultadoGrupo,
  calcularResultadoConsolidado,
  cacPonderado,
  custoReativacaoPonderado,
  parseInvestimentoMarketing,
  somarOuNull,
} from "@shared/marketing-financeiro";

type MesRelatorio = RouterOutputs["marketingFinanceiro"]["getRelatorioAno"]["meses"][number];

interface Props {
  meses: MesRelatorio[];
  periodoTexto: string;
  nomeArquivo: string;
}

function celulaValor(v: number | null | undefined, cor: string): React.ReactNode {
  return v != null ? <span className={cor}>{fmtBrl(v)}</span> : <span className="text-muted-foreground">—</span>;
}

function celulaRoi(v: number | null | undefined): React.ReactNode {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  return <span className={`font-semibold ${v >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtPct(v, 0)}</span>;
}

/** Cada bloco (Aquisição/Reativação) é uma tabela estreita e independente —
 * editar o investimento de um não exige tocar no outro (a mutation aceita os
 * dois campos separadamente, tri-state: campo omitido = não altera). Isso
 * também resolve a tabela larga demais de antes, que exigia rolar a barra
 * horizontal pra ver Aquisição e Reativação ao mesmo tempo. */

export default function MarketingAnaliseMensal({ meses, periodoTexto, nomeArquivo }: Props) {
  const utils = trpc.useUtils();
  const upsertMarketing = trpc.financeiro.upsertCustoMarketing.useMutation({
    onSuccess: () => {
      toast.success("Investimento salvo!");
      void utils.marketingFinanceiro.invalidate();
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  // ─── Bloco Aquisição ────────────────────────────────────────────────────
  const [editAquisicao, setEditAquisicao] = useState<string | null>(null);
  const [inputAquisicao, setInputAquisicao] = useState("");

  function iniciarEdicaoAquisicao(m: MesRelatorio) {
    setEditAquisicao(competenciaIso(m.ano, m.mes));
    setInputAquisicao(m.investimentoAquisicao != null ? m.investimentoAquisicao.toFixed(2).replace(".", ",") : "");
  }
  function salvarAquisicao({ mes, ano }: MesRelatorio) {
    const val = parseInvestimentoMarketing(inputAquisicao);
    if (val === undefined || (val != null && val < 0)) { toast.error("Valor inválido"); return; }
    upsertMarketing.mutate({ mes, ano, investimentoAquisicao: val }, { onSuccess: () => setEditAquisicao(null) });
  }

  // ─── Bloco Reativação ───────────────────────────────────────────────────
  const [editReativacao, setEditReativacao] = useState<string | null>(null);
  const [inputReativacao, setInputReativacao] = useState("");

  function iniciarEdicaoReativacao(m: MesRelatorio) {
    setEditReativacao(competenciaIso(m.ano, m.mes));
    setInputReativacao(m.investimentoReativacao != null ? m.investimentoReativacao.toFixed(2).replace(".", ",") : "");
  }
  function salvarReativacao({ mes, ano }: MesRelatorio) {
    const val = parseInvestimentoMarketing(inputReativacao);
    if (val === undefined || (val != null && val < 0)) { toast.error("Valor inválido"); return; }
    upsertMarketing.mutate({ mes, ano, investimentoReativacao: val }, { onSuccess: () => setEditReativacao(null) });
  }

  const mesesFechados = meses.filter(m => !m.mesParcial);
  const mesesAquisicaoCobertos = mesesFechados.filter(m => m.investimentoAquisicao != null);
  const mesesReativacaoCobertos = mesesFechados.filter(m => m.investimentoReativacao != null);
  const mesesConsolidadosCobertos = mesesFechados.filter(m => m.investimentoAquisicao != null && m.investimentoReativacao != null);

  const investimentoAquisicaoTotal = somarOuNull(mesesAquisicaoCobertos.map(m => m.investimentoAquisicao));
  const clientesNovosCobertos = mesesAquisicaoCobertos.reduce((s, m) => s + m.novo.qtdClientesUnicos, 0);
  const faturamentoNovosCobertos = mesesAquisicaoCobertos.reduce((s, m) => s + m.novo.faturamento, 0);
  const margemNovosCobertos = mesesAquisicaoCobertos.reduce((s, m) => s + m.novo.margem.margemTotal, 0);
  const resultadoAquisicaoTotal = calcularResultadoGrupo(investimentoAquisicaoTotal, margemNovosCobertos, faturamentoNovosCobertos);
  const cacTotal = cacPonderado(investimentoAquisicaoTotal, clientesNovosCobertos);

  const investimentoReativacaoTotal = somarOuNull(mesesReativacaoCobertos.map(m => m.investimentoReativacao));
  const eventosReativacaoCobertos = mesesReativacaoCobertos.reduce((s, m) => s + m.reativado.qtdClientesUnicos, 0);
  const faturamentoReativacaoCoberto = mesesReativacaoCobertos.reduce((s, m) => s + m.reativado.faturamento, 0);
  const margemReativacaoCoberta = mesesReativacaoCobertos.reduce((s, m) => s + m.reativado.margem.margemTotal, 0);
  const resultadoReativacaoTotal = calcularResultadoGrupo(investimentoReativacaoTotal, margemReativacaoCoberta, faturamentoReativacaoCoberto);
  const custoReativacaoTotal = custoReativacaoPonderado(investimentoReativacaoTotal, eventosReativacaoCobertos);

  const investimentoConsolidadoTotal = somarOuNull(mesesConsolidadosCobertos.map(m => m.investimentoAquisicao! + m.investimentoReativacao!));
  const resultadoConsolidadoTotal = calcularResultadoConsolidado([
    { investimento: somarOuNull(mesesConsolidadosCobertos.map(m => m.investimentoAquisicao)), margemContribuicao: mesesConsolidadosCobertos.reduce((s, m) => s + m.novo.margem.margemTotal, 0) },
    { investimento: somarOuNull(mesesConsolidadosCobertos.map(m => m.investimentoReativacao)), margemContribuicao: mesesConsolidadosCobertos.reduce((s, m) => s + m.reativado.margem.margemTotal, 0) },
  ]);

  function exportar() {
    exportRowsToXlsx(
      meses,
      [
        { header: "Mês", valor: m => MESES[m.mes - 1], largura: 12 },
        { header: "Ano", valor: m => m.ano, largura: 8 },
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
      nomeArquivo,
      "ROI Marketing",
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground max-w-xl">
          Preencha o investimento mensal em cada bloco (vazio = pendente; use 0 quando não houve gasto). Os totais usam valores lançados em meses fechados, calculados pelos totais e não pela média dos meses. Aquisição e Reativação são independentes.
        </p>
        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={exportar}>
          <Download size={14} /> Exportar Excel do período
        </Button>
      </div>

      {/* ─── Bloco Aquisição ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-purple-700"><Target size={17} /> Aquisição — {periodoTexto}</CardTitle>
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
                {meses.map(m => {
                  const isEditing = editAquisicao === competenciaIso(m.ano, m.mes);
                  return (
                    <TableRow key={competenciaIso(m.ano, m.mes)} className={m.mesParcial ? "bg-blue-50/40" : ""}>
                      <TableCell className="font-medium">
                        {MESES[m.mes - 1]} / {m.ano}
                        {m.mesParcial && <Badge variant="outline" className="ml-1.5 text-[9px] bg-blue-50 text-blue-700 border-blue-200">Parcial</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <MarketingInvestimentoInput
                            wrapperClassName="ml-auto w-28"
                            inputClassName="h-7 text-right text-xs"
                            value={inputAquisicao}
                            placeholder="vazio"
                            autoFocus
                            ariaLabel={`Investimento de aquisição em ${MESES[m.mes - 1]} / ${m.ano}`}
                            onChange={setInputAquisicao}
                            onKeyDown={e => { if (e.key === "Enter") salvarAquisicao(m); if (e.key === "Escape") setEditAquisicao(null); }}
                          />
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
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-emerald-600" onClick={() => salvarAquisicao(m)} disabled={upsertMarketing.isPending}><Check size={13} /></Button>
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
              <TableFooter>
                <TableRow className="bg-purple-50/60 font-semibold hover:bg-purple-50/60">
                  <TableCell className="text-purple-700">Total · {mesesAquisicaoCobertos.length}/{mesesFechados.length} meses</TableCell>
                  <TableCell className="text-right">{celulaValor(investimentoAquisicaoTotal, "text-purple-700")}</TableCell>
                  <TableCell className="text-right">{fmtNum(clientesNovosCobertos)}</TableCell>
                  <TableCell className="text-right">{cacTotal != null ? fmtBrl(cacTotal) : "—"}</TableCell>
                  <TableCell className="text-right text-emerald-700">{fmtBrl(faturamentoNovosCobertos)}</TableCell>
                  <TableCell className="text-right">{fmtBrl(margemNovosCobertos)}</TableCell>
                  <TableCell className="text-right">{celulaRoi(resultadoAquisicaoTotal.roiPct)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Bloco Reativação ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-orange-700"><RefreshCw size={17} /> Reativação — {periodoTexto}</CardTitle>
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
                {meses.map(m => {
                  const isEditing = editReativacao === competenciaIso(m.ano, m.mes);
                  return (
                    <TableRow key={competenciaIso(m.ano, m.mes)} className={m.mesParcial ? "bg-blue-50/40" : ""}>
                      <TableCell className="font-medium">
                        {MESES[m.mes - 1]} / {m.ano}
                        {m.mesParcial && <Badge variant="outline" className="ml-1.5 text-[9px] bg-blue-50 text-blue-700 border-blue-200">Parcial</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <MarketingInvestimentoInput
                            wrapperClassName="ml-auto w-28"
                            inputClassName="h-7 text-right text-xs"
                            value={inputReativacao}
                            placeholder="vazio"
                            autoFocus
                            ariaLabel={`Investimento de reativação em ${MESES[m.mes - 1]} / ${m.ano}`}
                            onChange={setInputReativacao}
                            onKeyDown={e => { if (e.key === "Enter") salvarReativacao(m); if (e.key === "Escape") setEditReativacao(null); }}
                          />
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
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-emerald-600" onClick={() => salvarReativacao(m)} disabled={upsertMarketing.isPending}><Check size={13} /></Button>
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
              <TableFooter>
                <TableRow className="bg-orange-50/60 font-semibold hover:bg-orange-50/60">
                  <TableCell className="text-orange-700">Total · {mesesReativacaoCobertos.length}/{mesesFechados.length} meses</TableCell>
                  <TableCell className="text-right">{celulaValor(investimentoReativacaoTotal, "text-orange-700")}</TableCell>
                  <TableCell className="text-right">{fmtNum(eventosReativacaoCobertos)}</TableCell>
                  <TableCell className="text-right">{custoReativacaoTotal != null ? fmtBrl(custoReativacaoTotal) : "—"}</TableCell>
                  <TableCell className="text-right text-emerald-700">{fmtBrl(faturamentoReativacaoCoberto)}</TableCell>
                  <TableCell className="text-right">{fmtBrl(margemReativacaoCoberta)}</TableCell>
                  <TableCell className="text-right">{celulaRoi(resultadoReativacaoTotal.roiPct)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Bloco Recorrente Ativo + Consolidado (só leitura) ─────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-emerald-700"><Layers size={17} /> Recorrente Ativo e Consolidado — {periodoTexto}</CardTitle>
          <p className="text-xs text-muted-foreground">Recorrentes são informativos. O ROI consolidado considera apenas meses fechados com investimento preenchido nas duas frentes ({mesesConsolidadosCobertos.length}/{mesesFechados.length}).</p>
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
                {meses.map(m => (
                  <TableRow key={competenciaIso(m.ano, m.mes)} className={m.mesParcial ? "bg-blue-50/40" : ""}>
                    <TableCell className="font-medium">
                      {MESES[m.mes - 1]} / {m.ano}
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
              <TableFooter>
                <TableRow className="bg-emerald-50/60 font-semibold hover:bg-emerald-50/60">
                  <TableCell className="text-emerald-700">Total do período</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right text-emerald-700">{fmtBrl(mesesFechados.reduce((s, m) => s + m.recorrenteAtivo.faturamento, 0))}</TableCell>
                  <TableCell className="text-right border-l">{fmtNum(mesesFechados.reduce((s, m) => s + m.novo.qtdOs + m.recorrenteAtivo.qtdOs + m.reativado.qtdOs, 0))}</TableCell>
                  <TableCell className="text-right">{celulaValor(investimentoConsolidadoTotal, "text-emerald-700")}</TableCell>
                  <TableCell className={`text-right ${resultadoConsolidadoTotal.resultado != null && resultadoConsolidadoTotal.resultado < 0 ? "text-red-500" : "text-emerald-600"}`}>{resultadoConsolidadoTotal.resultado != null ? fmtBrl(resultadoConsolidadoTotal.resultado) : "—"}</TableCell>
                  <TableCell className="text-right">{celulaRoi(resultadoConsolidadoTotal.roiPct)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
