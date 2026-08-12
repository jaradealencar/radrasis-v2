import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import {
  TrendingUp, Edit3, Check, X, DollarSign, Users, Target, Percent, Filter,
} from "lucide-react";
import KpiCard from "@/components/KpiCard";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// 51% do faturamento de clientes novos = retorno real de marketing
const MARGEM_MARKETING = 0.51;

function fmtBRL(v: number | null | undefined): string {
  if (v == null || isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtBRLShort(v: number): string {
  if (Math.abs(v) >= 1_000_000) return "R$ " + (v / 1_000_000).toFixed(1) + "M";
  if (Math.abs(v) >= 1_000) return "R$ " + (v / 1_000).toFixed(0) + "k";
  return fmtBRL(v);
}

interface Props {
  anoSel: number;
}

export default function MarketingFinanceiro({ anoSel }: Props) {
  const [marketingEditando, setMarketingEditando] = useState<number | null>(null);
  const [marketingInput, setMarketingInput] = useState("");
  const [marketingObs, setMarketingObs] = useState("");
  // Filtro de mês: null = todos os meses
  const [mesFiltro, setMesFiltro] = useState<number | null>(null);

  const { data: custoMarketingAno = [], refetch: refetchMarketing } = trpc.financeiro.getCustoMarketingAno.useQuery({ ano: anoSel });
  const { data: clientesNovosAno = [] } = trpc.performanceComercial.getClientesNovosAno.useQuery({ ano: anoSel });

  const upsertMarketing = trpc.financeiro.upsertCustoMarketing.useMutation({
    onSuccess: () => {
      toast.success("Investimento em marketing salvo!");
      setMarketingEditando(null);
      refetchMarketing();
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  const custoMarketingMap = useMemo(() => {
    const m: Record<number, typeof custoMarketingAno[0]> = {};
    for (const r of custoMarketingAno) m[r.mes] = r;
    return m;
  }, [custoMarketingAno]);

  const clientesNovosMap = useMemo(() => {
    const m: Record<number, { osNovos: number; faturamentoNovos: number; ticketMedioNovos: number; clientesNovosUnicos: number }> = {};
    for (const r of clientesNovosAno) m[r.mes] = r;
    return m;
  }, [clientesNovosAno]);

  // ─── Cálculos por mês ───────────────────────────────────────────────────────
  const dadosMeses = useMemo(() => MESES.map((nome, idx) => {
    const mes = idx + 1;
    const mk = custoMarketingMap[mes];
    const novos = clientesNovosMap[mes];
    const investimento = mk ? parseFloat(mk.investimento) : null;
    const clientesNovosQtd = novos?.clientesNovosUnicos ?? null;
    const faturamentoNovos = novos?.faturamentoNovos ?? null;

    // CAC = Investimento / Nº Clientes Novos
    const cac = investimento != null && clientesNovosQtd != null && clientesNovosQtd > 0
      ? investimento / clientesNovosQtd : null;

    // Retorno real = 51% do faturamento de clientes novos
    const retornoReal = faturamentoNovos != null ? faturamentoNovos * MARGEM_MARKETING : null;

    // ROI em R$ = Retorno Real - Investimento
    const roiReais = retornoReal != null && investimento != null
      ? retornoReal - investimento : null;

    // ROI em % = (Retorno Real - Investimento) / Investimento × 100
    const roiPct = roiReais != null && investimento != null && investimento > 0
      ? (roiReais / investimento) * 100 : null;

    return {
      mes, nome, abrev: MESES_ABREV[idx],
      investimento, clientesNovosQtd, faturamentoNovos,
      retornoReal, cac, roiReais, roiPct,
    };
  }), [custoMarketingMap, clientesNovosMap]);

  // Meses com dados para o filtro
  const mesesComDados = useMemo(() =>
    dadosMeses.filter(d => d.investimento != null || d.faturamentoNovos != null),
    [dadosMeses]
  );

  // Dados filtrados pelo mês selecionado
  const dadosFiltrados = useMemo(() =>
    mesFiltro != null ? dadosMeses.filter(d => d.mes === mesFiltro) : dadosMeses,
    [dadosMeses, mesFiltro]
  );

  // ─── KPIs agregados (baseados no filtro) ────────────────────────────────────
  const totalInvestido = useMemo(() =>
    dadosFiltrados.reduce((s, d) => s + (d.investimento ?? 0), 0), [dadosFiltrados]);

  const totalClientesNovos = useMemo(() =>
    dadosFiltrados.reduce((s, d) => s + (d.clientesNovosQtd ?? 0), 0), [dadosFiltrados]);

  const totalFaturamentoNovos = useMemo(() =>
    dadosFiltrados.reduce((s, d) => s + (d.faturamentoNovos ?? 0), 0), [dadosFiltrados]);

  const totalRetornoReal = totalFaturamentoNovos * MARGEM_MARKETING;

  const cacMedio = useMemo(() => {
    const com = dadosFiltrados.filter(d => d.cac != null);
    if (!com.length) return null;
    return com.reduce((s, d) => s + (d.cac ?? 0), 0) / com.length;
  }, [dadosFiltrados]);

  // ROI total em R$ e %
  const roiTotalReais = totalInvestido > 0 ? totalRetornoReal - totalInvestido : null;
  const roiTotalPct = totalInvestido > 0 && roiTotalReais != null
    ? (roiTotalReais / totalInvestido) * 100 : null;

  // ROI por cliente novo = ROI total R$ / total de clientes novos
  const roiPorCliente = roiTotalReais != null && totalClientesNovos > 0
    ? roiTotalReais / totalClientesNovos : null;

  // ROI médio (média dos meses com dados)
  const roiMedioReais = useMemo(() => {
    const com = dadosFiltrados.filter(d => d.roiReais != null);
    if (!com.length) return null;
    return com.reduce((s, d) => s + (d.roiReais ?? 0), 0) / com.length;
  }, [dadosFiltrados]);

  const roiMedioPct = useMemo(() => {
    const com = dadosFiltrados.filter(d => d.roiPct != null);
    if (!com.length) return null;
    return com.reduce((s, d) => s + (d.roiPct ?? 0), 0) / com.length;
  }, [dadosFiltrados]);

  // ─── Dados para gráficos (sempre todos os meses com dados) ──────────────────
  const dadosGrafico = useMemo(() =>
    mesesComDados.map(d => ({
      mes: d.abrev,
      "Investimento": d.investimento ?? 0,
      "Fat. Clientes Novos": d.faturamentoNovos ?? 0,
      "Retorno Real (51%)": d.retornoReal ?? 0,
    })),
    [mesesComDados]
  );

  const dadosRoi = useMemo(() =>
    mesesComDados
      .filter(d => d.roiPct != null)
      .map(d => ({
        mes: d.abrev,
        "ROI (%)": Math.round(d.roiPct ?? 0),
        "ROI (R$)": Math.round(d.roiReais ?? 0),
      })),
    [mesesComDados]
  );

  const labelFiltro = mesFiltro != null ? MESES[mesFiltro - 1] : `Ano ${anoSel}`;

  return (
    <div className="space-y-6">

      {/* ─── Filtro de mês ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter size={13} />
          Filtrar por mês:
        </div>
        <button
          onClick={() => setMesFiltro(null)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
            mesFiltro === null
              ? "bg-purple-600 text-white border-purple-600"
              : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
          }`}
        >
          Todos
        </button>
        {mesesComDados.map(d => (
          <button
            key={d.mes}
            onClick={() => setMesFiltro(mesFiltro === d.mes ? null : d.mes)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              mesFiltro === d.mes
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
            }`}
          >
            {d.abrev}
          </button>
        ))}
      </div>

      {/* ─── KPIs ──────────────────────────────────────────────────────────────── */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <div className="w-3 h-0.5 bg-purple-500 rounded" />
          Indicadores — {labelFiltro}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Total Investido em Mkt"
            value={fmtBRL(totalInvestido)}
            sub={`${dadosFiltrados.filter(d => d.investimento != null).length} meses`}
            color="#7c3aed"
            icon={<DollarSign size={18} />}
            variant="border"
          />
          <KpiCard
            label="Fat. Clientes Novos"
            value={fmtBRLShort(totalFaturamentoNovos)}
            sub={`Retorno real (51%): ${fmtBRLShort(totalRetornoReal)}`}
            color="#16a34a"
            icon={<TrendingUp size={18} />}
            variant="border"
          />
          <KpiCard
            label="Clientes Novos"
            value={String(totalClientesNovos)}
            sub="Sem compra anterior"
            color="#2563eb"
            icon={<Users size={18} />}
            variant="border"
          />
          <KpiCard
            label="CAC Médio"
            value={cacMedio != null ? fmtBRL(cacMedio) : "—"}
            sub="Custo por cliente novo"
            color="#ea580c"
            icon={<Target size={18} />}
            variant="border"
          />
          <KpiCard
            label="ROI de Marketing"
            value={
              <>
                {roiTotalReais != null ? fmtBRLShort(roiTotalReais) : "—"}
                {roiTotalPct != null && (
                  <span className="block text-sm font-semibold mt-0.5 opacity-80">
                    {roiTotalPct.toFixed(0)}% sobre investimento
                  </span>
                )}
              </>
            }
            sub={[
              `Média mensal: ${roiMedioReais != null ? fmtBRLShort(roiMedioReais) : "—"} / ${roiMedioPct != null ? roiMedioPct.toFixed(0) + "%" : "—"}`,
              roiPorCliente != null ? `ROI por cliente: ${fmtBRL(roiPorCliente)}` : "",
            ].filter(Boolean).join(" · ")}
            color={roiTotalReais != null && roiTotalReais >= 0 ? "#16a34a" : "#dc2626"}
            icon={<Percent size={18} />}
            variant="border"
          />
        </div>
      </div>

      {/* ─── Nota metodológica ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-800">
        <Percent size={13} className="mt-0.5 shrink-0" />
        <span>
          <strong>Metodologia ROI:</strong> O retorno real do marketing é calculado como <strong>51% do faturamento de clientes novos</strong> (margem operacional estimada).
          ROI em R$ = Retorno Real − Investimento &nbsp;|&nbsp; ROI em % = (Retorno Real − Investimento) ÷ Investimento × 100
        </span>
      </div>

      {/* ─── Gráficos ──────────────────────────────────────────────────────────── */}
      {dadosGrafico.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Barras: Investimento vs Faturamento vs Retorno Real */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp size={16} className="text-purple-600" />
                Investimento vs Faturamento vs Retorno Real
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dadosGrafico} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Legend iconSize={10} />
                  <Bar dataKey="Investimento" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Fat. Clientes Novos" fill="#16a34a" radius={[3, 3, 0, 0]} opacity={0.7} />
                  <Bar dataKey="Retorno Real (51%)" fill="#059669" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Linha: ROI % e R$ por mês */}
          {dadosRoi.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Percent size={16} className="text-emerald-600" />
                  ROI de Marketing por Mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={dadosRoi} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="pct" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <YAxis yAxisId="reais" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v: number, name: string) =>
                        name === "ROI (%)" ? `${v}%` : fmtBRL(v)
                      }
                    />
                    <Legend iconSize={10} />
                    <ReferenceLine yAxisId="pct" y={0} stroke="#e2e8f0" strokeWidth={1.5} />
                    <Line
                      yAxisId="pct"
                      type="monotone"
                      dataKey="ROI (%)"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#16a34a" }}
                    />
                    <Line
                      yAxisId="reais"
                      type="monotone"
                      dataKey="ROI (R$)"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#7c3aed" }}
                      strokeDasharray="5 3"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── Tabela mensal ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp size={18} className="text-purple-600" />
            Custo de Marketing e ROI — {labelFiltro}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Preencha o investimento mensal em marketing. Os demais campos são calculados automaticamente.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground bg-slate-50">
                  <th className="text-left py-2.5 px-3 font-semibold">Mês</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Investimento</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Clientes Novos</th>
                  <th className="text-right py-2.5 px-3 font-semibold">CAC</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Fat. Clientes Novos</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Retorno Real (51%)</th>
                  <th className="text-right py-2.5 px-3 font-semibold">ROI (R$)</th>
                  <th className="text-right py-2.5 px-3 font-semibold">ROI (%)</th>
                  <th className="text-center py-2.5 px-3 font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody>
                {dadosFiltrados.map(({ mes, nome, investimento, clientesNovosQtd, faturamentoNovos, retornoReal, cac, roiReais, roiPct }) => {
                  const mk = custoMarketingMap[mes];
                  const isEditing = marketingEditando === mes;
                  return (
                    <tr key={mes} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium">{nome}</td>
                      <td className="py-2.5 px-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-muted-foreground text-xs">R$</span>
                            <Input
                              className="w-32 h-7 text-right text-sm"
                              value={marketingInput}
                              onChange={e => setMarketingInput(e.target.value)}
                              placeholder="0,00"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  const val = parseFloat(marketingInput.replace(/\./g, "").replace(",", "."));
                                  if (isNaN(val) || val < 0) { toast.error("Valor inválido"); return; }
                                  upsertMarketing.mutate({ mes, ano: anoSel, investimento: val, observacao: marketingObs || null });
                                }
                                if (e.key === "Escape") setMarketingEditando(null);
                              }}
                            />
                          </div>
                        ) : (
                          <span className={investimento != null ? "font-semibold text-purple-700" : "text-muted-foreground"}>
                            {investimento != null ? fmtBRL(investimento) : "—"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {clientesNovosQtd != null
                          ? <span className="font-medium text-blue-700">{clientesNovosQtd}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {cac != null
                          ? <span className="font-semibold text-orange-600">{fmtBRL(cac)}</span>
                          : <span className="text-muted-foreground">{investimento != null ? "sem dados" : "—"}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {faturamentoNovos != null
                          ? <span className="font-medium text-emerald-700">{fmtBRL(faturamentoNovos)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {retornoReal != null
                          ? <span className="font-medium text-teal-700">{fmtBRL(retornoReal)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {roiReais != null
                          ? <span className={`font-bold ${roiReais >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtBRL(roiReais)}</span>
                          : <span className="text-muted-foreground">{investimento != null ? "sem dados" : "—"}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {roiPct != null
                          ? <span className={`font-bold ${roiPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>{roiPct.toFixed(0)}%</span>
                          : <span className="text-muted-foreground">{investimento != null ? "sem dados" : "—"}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                              onClick={() => {
                                const val = parseFloat(marketingInput.replace(/\./g, "").replace(",", "."));
                                if (isNaN(val) || val < 0) { toast.error("Valor inválido"); return; }
                                upsertMarketing.mutate({ mes, ano: anoSel, investimento: val, observacao: marketingObs || null });
                              }}
                              disabled={upsertMarketing.isPending}
                            >
                              <Check size={14} />
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                              onClick={() => setMarketingEditando(null)}
                            >
                              <X size={14} />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-purple-600"
                            onClick={() => {
                              setMarketingEditando(mes);
                              setMarketingInput(investimento != null ? investimento.toFixed(2).replace(".", ",") : "");
                              setMarketingObs(mk?.observacao ?? "");
                            }}
                          >
                            <Edit3 size={13} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {totalInvestido > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-sm">
                      {mesFiltro != null ? MESES[mesFiltro - 1] : `Total ${anoSel}`}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-purple-700">{fmtBRL(totalInvestido)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-blue-700">{totalClientesNovos}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-orange-600">
                      {cacMedio != null ? fmtBRL(cacMedio) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{fmtBRL(totalFaturamentoNovos)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-teal-700">{fmtBRL(totalRetornoReal)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                      {roiTotalReais != null ? fmtBRL(roiTotalReais) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                      {roiTotalPct != null ? `${roiTotalPct.toFixed(0)}%` : "—"}
                    </td>
                    <td />
                  </tr>
                  {mesFiltro === null && (
                    <tr className="border-t border-slate-200">
                      <td className="py-2 px-3 text-xs text-muted-foreground font-medium">Média mensal</td>
                      <td colSpan={4} />
                      <td colSpan={1} />
                      <td className="py-2 px-3 text-right text-xs font-semibold text-emerald-600">
                        {roiMedioReais != null ? fmtBRL(roiMedioReais) : "—"}
                      </td>
                      <td className="py-2 px-3 text-right text-xs font-semibold text-emerald-600">
                        {roiMedioPct != null ? `${roiMedioPct.toFixed(0)}%` : "—"}
                      </td>
                      <td />
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
