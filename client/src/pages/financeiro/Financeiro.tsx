import { useState, useMemo } from "react";
import CustosFixos from "./CustosFixos";
import MarketingFinanceiro from "./MarketingFinanceiro";
import PainelDRE from "./PainelDRE";
import ObservacoesMensais from "./ObservacoesMensais";
import PainelFinanceiro from "@/components/PainelFinanceiro";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  Wallet, TrendingUp, TrendingDown, Users, DollarSign,
  PieChart, Edit3, Check, X, ChevronDown, ChevronUp,
  Info, Download, BarChart2, ReceiptText, FileText,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { STATUS_COLORS } from "@/lib/chartColors";
import ChartTooltip from "@/components/ChartTooltip";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function toNum(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function fmtBRL(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtBRLShort(v: number): string {
  if (v >= 1_000_000) return "R$ " + (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return "R$ " + (v / 1_000).toFixed(0) + "k";
  return fmtBRL(v);
}

interface FormState {
  faturamentoOficial: string;
  despesasFixas: string;
  despesasVariaveis: string;
  numColaboradores: string;
  lucroBruto: string;
  lucroLiquido: string;
  notas: string;
  // Novos campos a partir de Abr/2026
  impostoDas: string;
  impostoIcmsDifal: string;
  impostoDaems: string;
  comissoesBv: string;
  produtividadeSolda: string;
  freteRetrabalho: string;
  devSoftware: string;
  receitaOperacionalOs: string;
  resultadoEfetivo: string;
  saldoMes: string;
  tl1: string;
  tl2: string;
  tl3: string;
}

const emptyForm = (): FormState => ({
  faturamentoOficial: "",
  despesasFixas: "",
  despesasVariaveis: "",
  numColaboradores: "",
  lucroBruto: "",
  lucroLiquido: "",
  notas: "",
  impostoDas: "",
  impostoIcmsDifal: "",
  impostoDaems: "",
  comissoesBv: "",
  produtividadeSolda: "",
  freteRetrabalho: "",
  devSoftware: "",
  receitaOperacionalOs: "",
  resultadoEfetivo: "",
  saldoMes: "",
  tl1: "",
  tl2: "",
  tl3: "",
});

// Seta comparativa com mês anterior
function Seta({ atual, anterior, label }: { atual: number | null; anterior: number | null; label?: string }) {
  if (atual == null || anterior == null || anterior === 0) return null;
  const diff = ((atual - anterior) / Math.abs(anterior)) * 100;
  const up = diff >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ml-1 ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(diff).toFixed(1)}%
      {label && <span className="text-muted-foreground font-normal ml-0.5">{label}</span>}
    </span>
  );
}

export default function Financeiro() {
  const anoAtual = new Date().getFullYear();
  const [anoSel, setAnoSel] = useState(anoAtual);
  const [editingMes, setEditingMes] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [expandedMes, setExpandedMes] = useState<number | null>(null);

  const [abaAtiva, setAbaAtiva] = useState<"painel" | "custos" | "marketing" | "observacoes" | "dados-mensais">("painel");
  const utils = trpc.useUtils();
  const { data: registros = [] } = trpc.financeiro.list.useQuery({ ano: anoSel });
  const upsert = trpc.financeiro.upsert.useMutation({
    onSuccess: () => {
      toast.success("Dados financeiros salvos com sucesso!");
      setEditingMes(null);
      utils.financeiro.list.invalidate({ ano: anoSel });
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  const registroMap = useMemo(() => {
    const m: Record<number, typeof registros[0]> = {};
    for (const r of registros) m[r.mes] = r;
    return m;
  }, [registros]);

  // Dados processados por mês (com lucro calculado)
  const dadosMensais = useMemo(() => {
    return MESES.map((nome, idx) => {
      const mes = idx + 1;
      const r = registroMap[mes];
      const fat = r?.faturamentoOficial ? parseFloat(r.faturamentoOficial) : null;
      const fixas = r?.despesasFixas ? parseFloat(r.despesasFixas) : null;
      const variaveis = r?.despesasVariaveis ? parseFloat(r.despesasVariaveis) : null;
      const lucroCalc = fat != null && fixas != null && variaveis != null ? fat - fixas - variaveis : null;
      const lucroExib = r?.lucroLiquido ? parseFloat(r.lucroLiquido) : lucroCalc;
      const receitaColab = fat && r?.numColaboradores ? fat / r.numColaboradores : null;
      return { mes, nome, abrev: MESES_ABREV[idx], r, fat, fixas, variaveis, lucroCalc, lucroExib, receitaColab };
    });
  }, [registroMap]);

  // Totais do ano
  const totais = useMemo(() => {
    let fat = 0, fixas = 0, variaveis = 0, lucro = 0;
    let countFat = 0, countLucro = 0;
    for (const d of dadosMensais) {
      if (d.fat) { fat += d.fat; countFat++; }
      if (d.fixas) fixas += d.fixas;
      if (d.variaveis) variaveis += d.variaveis;
      if (d.lucroExib != null) { lucro += d.lucroExib; countLucro++; }
    }
    return { fat, fixas, variaveis, lucro, countFat, countLucro };
  }, [dadosMensais]);

  // Dados para o gráfico
  const chartData = useMemo(() => {
    return dadosMensais
      .filter(d => d.fat != null)
      .map(d => ({
        name: d.abrev,
        "Faturamento": d.fat,
        "Desp. Fixas": d.fixas,
        "Desp. Variáveis": d.variaveis,
        "Lucro Líquido": d.lucroExib,
      }));
  }, [dadosMensais]);

  function startEdit(mes: number) {
    const r = registroMap[mes];
    setForm({
      faturamentoOficial: r?.faturamentoOficial ?? "",
      despesasFixas: r?.despesasFixas ?? "",
      despesasVariaveis: r?.despesasVariaveis ?? "",
      numColaboradores: r?.numColaboradores != null ? String(r.numColaboradores) : "",
      lucroBruto: r?.lucroBruto ?? "",
      lucroLiquido: r?.lucroLiquido ?? "",
      notas: r?.notas ?? "",
      impostoDas: r?.impostoDas ?? "",
      impostoIcmsDifal: r?.impostoIcmsDifal ?? "",
      impostoDaems: r?.impostoDaems ?? "",
      comissoesBv: r?.comissoesBv ?? "",
      produtividadeSolda: r?.produtividadeSolda ?? "",
      freteRetrabalho: r?.freteRetrabalho ?? "",
      devSoftware: r?.devSoftware ?? "",
      receitaOperacionalOs: r?.receitaOperacionalOs ?? "",
      resultadoEfetivo: r?.resultadoEfetivo ?? "",
      saldoMes: r?.saldoMes ?? "",
      tl1: r?.tl1 ?? "",
      tl2: r?.tl2 ?? "",
      tl3: r?.tl3 ?? "",
    });
    setEditingMes(mes);
  }

  function handleSave(mes: number) {
    const fat = toNum(form.faturamentoOficial);
    const fixas = toNum(form.despesasFixas);
    const variaveis = toNum(form.despesasVariaveis);
    const colab = form.numColaboradores ? parseInt(form.numColaboradores) : null;
    let lucroBruto = toNum(form.lucroBruto);
    let lucroLiquido = toNum(form.lucroLiquido);
    if (fat != null && fixas != null && variaveis != null) {
      const totalDesp = fixas + variaveis;
      if (lucroBruto == null) lucroBruto = fat - totalDesp;
      if (lucroLiquido == null) lucroLiquido = fat - totalDesp;
    }
    upsert.mutate({
      mes, ano: anoSel,
      faturamentoOficial: fat, despesasFixas: fixas, despesasVariaveis: variaveis,
      numColaboradores: colab, lucroBruto, lucroLiquido, notas: form.notas || null,
      impostoDas: toNum(form.impostoDas),
      impostoIcmsDifal: toNum(form.impostoIcmsDifal),
      impostoDaems: toNum(form.impostoDaems),
      comissoesBv: toNum(form.comissoesBv),
      produtividadeSolda: toNum(form.produtividadeSolda),
      freteRetrabalho: toNum(form.freteRetrabalho),
      devSoftware: toNum(form.devSoftware),
      receitaOperacionalOs: toNum(form.receitaOperacionalOs),
      resultadoEfetivo: toNum(form.resultadoEfetivo),
      saldoMes: toNum(form.saldoMes),
      tl1: toNum(form.tl1),
      tl2: toNum(form.tl2),
      tl3: toNum(form.tl3),
    });
  }

  // Exportação CSV
  function exportCSV() {
    const header = ["Mês", "Faturamento", "Desp. Fixas", "Desp. Variáveis", "Total Despesas", "Lucro Líquido", "Margem %", "Nº Colaboradores", "Receita/Colaborador", "Observações"];
    const rows = dadosMensais.map(d => {
      const totalDesp = (d.fixas ?? 0) + (d.variaveis ?? 0);
      const margem = d.fat && d.lucroExib != null ? ((d.lucroExib / d.fat) * 100).toFixed(2) : "";
      return [
        d.nome,
        d.fat?.toFixed(2) ?? "",
        d.fixas?.toFixed(2) ?? "",
        d.variaveis?.toFixed(2) ?? "",
        totalDesp > 0 ? totalDesp.toFixed(2) : "",
        d.lucroExib?.toFixed(2) ?? "",
        margem,
        d.r?.numColaboradores ?? "",
        d.receitaColab?.toFixed(2) ?? "",
        d.r?.notas ?? "",
      ];
    });
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro_${anoSel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso!");
  }

  // Exportação Excel (via CSV com extensão .xls para compatibilidade)
  function exportExcel() {
    const header = ["Mês", "Faturamento", "Desp. Fixas", "Desp. Variáveis", "Total Despesas", "Lucro Líquido", "Margem %", "Nº Colaboradores", "Receita/Colaborador", "Observações"];
    const rows = dadosMensais.map(d => {
      const totalDesp = (d.fixas ?? 0) + (d.variaveis ?? 0);
      const margem = d.fat && d.lucroExib != null ? ((d.lucroExib / d.fat) * 100).toFixed(2) : "";
      return [d.nome, d.fat?.toFixed(2) ?? "", d.fixas?.toFixed(2) ?? "", d.variaveis?.toFixed(2) ?? "", totalDesp > 0 ? totalDesp.toFixed(2) : "", d.lucroExib?.toFixed(2) ?? "", margem, d.r?.numColaboradores ?? "", d.receitaColab?.toFixed(2) ?? "", d.r?.notas ?? ""];
    });
    // Gerar HTML table para Excel
    const tableRows = [header, ...rows].map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"/></head><body><table>${tableRows}</table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro_${anoSel}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel exportado com sucesso!");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <PageHeader
        title="Painel Financeiro"
        description="Faturamento oficial, despesas e colaboradores — fonte única para todo o sistema"
        icon={Wallet}
        iconColor={STATUS_COLORS.positivo}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setAnoSel(a => a - 1)}>← {anoSel - 1}</Button>
            <span className="font-semibold text-lg px-2">{anoSel}</span>
            <Button variant="outline" size="sm" onClick={() => setAnoSel(a => a + 1)}>{anoSel + 1} →</Button>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download size={14} /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
              <Download size={14} /> Excel
            </Button>
          </div>
        }
      />

      {/* Navegação por abas */}
      <div className="flex gap-1 border-b pb-0">
        <button
          onClick={() => setAbaAtiva("painel")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            abaAtiva === "painel"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <BarChart2 size={15} />
          Painel Financeiro
        </button>
        <button
          onClick={() => setAbaAtiva("custos")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            abaAtiva === "custos"
              ? "border-red-500 text-red-700 bg-red-50"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <ReceiptText size={15} />
          Custos Fixos
        </button>
        <button
          onClick={() => setAbaAtiva("marketing")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            abaAtiva === "marketing"
              ? "border-purple-500 text-purple-700 bg-purple-50"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <TrendingUp size={15} />
          Marketing
        </button>
        <button
          onClick={() => setAbaAtiva("observacoes")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            abaAtiva === "observacoes"
              ? "border-blue-500 text-blue-700 bg-blue-50"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <FileText size={15} />
          Observações
        </button>
        <button
          onClick={() => setAbaAtiva("dados-mensais")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            abaAtiva === "dados-mensais"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <DollarSign size={15} />
          Dados Mensais
        </button>
      </div>

      {/* Conteúdo da aba Observações */}
      {abaAtiva === "observacoes" && <ObservacoesMensais anoSel={anoSel} />}

      {/* Conteúdo da aba Dados Mensais */}
      {abaAtiva === "dados-mensais" && <PainelFinanceiro />}

      {/* Conteúdo da aba Custos Fixos */}
      {abaAtiva === "custos" && <CustosFixos />}

      {/* Conteúdo da aba Marketing */}
      {abaAtiva === "marketing" && <MarketingFinanceiro anoSel={anoSel} />}

      {/* Conteúdo da aba Painel — visível apenas quando abaAtiva === "painel" */}
      {abaAtiva === "painel" && <PainelDRE anoSel={anoSel} />}
      {false && <>

      {/* Aviso de fonte única */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          O <strong>Faturamento Oficial</strong> cadastrado aqui substitui os valores de faturamento em todo o sistema
          (Visão de Performance, Relatórios, KPIs). Preencha com os valores confirmados pela contabilidade.
        </span>
      </div>

      {/* Cards de resumo anual */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign size={14} /> Faturamento {anoSel}
            </div>
            <div className="text-xl font-bold text-emerald-600">{fmtBRL(totais.fat)}</div>
            <div className="text-xs text-muted-foreground">{totais.countFat} meses registrados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingDown size={14} /> Total Despesas
            </div>
            <div className="text-xl font-bold text-red-500">{fmtBRL(totais.fixas + totais.variaveis)}</div>
            <div className="text-xs text-muted-foreground">Fixas + Variáveis</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp size={14} /> Lucro Líquido
            </div>
            <div className={`text-xl font-bold ${totais.lucro >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {fmtBRL(totais.lucro)}
            </div>
            <div className="text-xs text-muted-foreground">{totais.countLucro} meses</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <PieChart size={14} /> Margem Média
            </div>
            <div className="text-xl font-bold text-blue-600">
              {totais.fat > 0 ? ((totais.lucro / totais.fat) * 100).toFixed(1) + "%" : "—"}
            </div>
            <div className="text-xs text-muted-foreground">Lucro / Faturamento</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico interativo de evolução */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 size={16} className="text-blue-500" />
              Evolução Mensal — {anoSel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={fmtBRLShort} tick={{ fontSize: 11 }} width={75} />
                <Tooltip content={<ChartTooltip format={fmtBRL} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Faturamento" fill="#10b981" radius={[3, 3, 0, 0]} opacity={0.85} />
                <Bar dataKey="Desp. Fixas" fill="#f87171" radius={[3, 3, 0, 0]} opacity={0.75} />
                <Bar dataKey="Desp. Variáveis" fill="#fb923c" radius={[3, 3, 0, 0]} opacity={0.75} />
                <Line dataKey="Lucro Líquido" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabela de meses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dados Mensais — {anoSel}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {dadosMensais.map((d) => {
              const { mes, nome, r, fat, fixas, variaveis, lucroCalc, lucroExib, receitaColab } = d;
              const isEditing = editingMes === mes;
              const isExpanded = expandedMes === mes;
              const temDados = r != null;
              const margem = fat && lucroExib != null ? ((lucroExib / fat) * 100).toFixed(1) : null;

              // Dados do mês anterior para comparação
              const prev = dadosMensais[mes - 2]; // mes-1 é o índice, mes-2 é o anterior
              const lucroAnterior = prev?.lucroExib ?? null;
              const receitaColabAnterior = prev?.receitaColab ?? null;

              return (
                <div key={mes} className="px-4">
                  {/* Linha principal */}
                  <div className="flex items-center gap-3 py-3">
                    <div className="w-28 font-medium text-sm">{nome}</div>

                    {temDados ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">Preenchido</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-xs">Vazio</Badge>
                    )}

                    <div className="flex-1 flex items-center gap-4 text-sm flex-wrap">
                      <span className="text-muted-foreground">
                        Fat: <span className="font-semibold text-foreground">{fmtBRL(r?.faturamentoOficial)}</span>
                      </span>
                      {lucroExib != null && (
                        <span className="text-muted-foreground">
                          Lucro: <span className={`font-semibold ${lucroExib >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {fmtBRL(lucroExib)}
                          </span>
                          <Seta atual={lucroExib} anterior={lucroAnterior} />
                        </span>
                      )}
                      {margem && (
                        <span className="text-muted-foreground">
                          Margem: <span className="font-semibold">{margem}%</span>
                        </span>
                      )}
                      {receitaColab != null && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Users size={12} />
                          Rec/Colab: <span className="font-semibold text-blue-600 ml-0.5">{fmtBRL(receitaColab)}</span>
                          <Seta atual={receitaColab} anterior={receitaColabAnterior} />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {temDados && !isEditing && (
                        <Button variant="ghost" size="sm" onClick={() => setExpandedMes(isExpanded ? null : mes)} className="h-7 w-7 p-0">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </Button>
                      )}
                      {!isEditing ? (
                        <Button variant="ghost" size="sm" onClick={() => startEdit(mes)} className="h-7 px-2 text-xs gap-1">
                          <Edit3 size={12} /> {temDados ? "Editar" : "Preencher"}
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" onClick={() => handleSave(mes)} disabled={upsert.isPending} className="h-7 px-2 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700">
                            <Check size={12} /> Salvar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingMes(null)} className="h-7 w-7 p-0">
                            <X size={12} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Formulário de edição */}
                  {isEditing && (
                    <div className="pb-4 grid grid-cols-2 md:grid-cols-3 gap-3 bg-muted/30 rounded-lg p-4 mb-2">
                      <div>
                        <Label className="text-xs font-medium">Faturamento Oficial (R$) *</Label>
                        <Input className="h-8 text-sm mt-1" placeholder="Ex: 434940.00" value={form.faturamentoOficial} onChange={e => setForm(f => ({ ...f, faturamentoOficial: e.target.value }))} />
                        <p className="text-xs text-muted-foreground mt-0.5">Fonte única para todo o sistema</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium">Despesas Fixas (R$)</Label>
                        <Input className="h-8 text-sm mt-1" placeholder="Ex: 120000.00" value={form.despesasFixas} onChange={e => setForm(f => ({ ...f, despesasFixas: e.target.value }))} />
                        <p className="text-xs text-muted-foreground mt-0.5">Aluguel, salários, etc.</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium">Despesas Variáveis (R$)</Label>
                        <Input className="h-8 text-sm mt-1" placeholder="Ex: 80000.00" value={form.despesasVariaveis} onChange={e => setForm(f => ({ ...f, despesasVariaveis: e.target.value }))} />
                        <p className="text-xs text-muted-foreground mt-0.5">Matéria-prima, comissões, etc.</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium">Nº de Colaboradores</Label>
                        <Input className="h-8 text-sm mt-1" type="number" placeholder="Ex: 25" value={form.numColaboradores} onChange={e => setForm(f => ({ ...f, numColaboradores: e.target.value }))} />
                        <p className="text-xs text-muted-foreground mt-0.5">Usado para receita/colaborador</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium">Lucro Bruto (R$) <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                        <Input className="h-8 text-sm mt-1" placeholder="Calculado automaticamente" value={form.lucroBruto} onChange={e => setForm(f => ({ ...f, lucroBruto: e.target.value }))} />
                        <p className="text-xs text-muted-foreground mt-0.5">Deixe vazio para calcular</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium">Lucro Líquido (R$) <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                        <Input className="h-8 text-sm mt-1" placeholder="Calculado automaticamente" value={form.lucroLiquido} onChange={e => setForm(f => ({ ...f, lucroLiquido: e.target.value }))} />
                        <p className="text-xs text-muted-foreground mt-0.5">Deixe vazio para calcular</p>
                      </div>
                      {/* ─── Impostos (a partir de Abr/2026) ─── */}
                      <div className="col-span-2 md:col-span-3 border-t pt-3 mt-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Impostos Detalhados</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs font-medium">DAS Simples Nacional (R$)</Label>
                            <Input className="h-8 text-sm mt-1" placeholder="Ex: 18500.00" value={form.impostoDas} onChange={e => setForm(f => ({ ...f, impostoDas: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">ICMS DIFAL / Equalizador (R$)</Label>
                            <Input className="h-8 text-sm mt-1" placeholder="Ex: 3200.00" value={form.impostoIcmsDifal} onChange={e => setForm(f => ({ ...f, impostoIcmsDifal: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">DAEMS — Guia Municipal (R$)</Label>
                            <Input className="h-8 text-sm mt-1" placeholder="Ex: 1100.00" value={form.impostoDaems} onChange={e => setForm(f => ({ ...f, impostoDaems: e.target.value }))} />
                          </div>
                        </div>
                      </div>

                      {/* ─── Despesas Específicas (a partir de Abr/2026) ─── */}
                      <div className="col-span-2 md:col-span-3 border-t pt-3 mt-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Despesas Específicas</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs font-medium">Comissões BV / Vendas Ext. (R$)</Label>
                            <Input className="h-8 text-sm mt-1" placeholder="Ex: 5000.00" value={form.comissoesBv} onChange={e => setForm(f => ({ ...f, comissoesBv: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Produtividade Solda (R$)</Label>
                            <Input className="h-8 text-sm mt-1" placeholder="Ex: 2800.00" value={form.produtividadeSolda} onChange={e => setForm(f => ({ ...f, produtividadeSolda: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Frete Retrabalho (R$)</Label>
                            <Input className="h-8 text-sm mt-1" placeholder="Ex: 1200.00" value={form.freteRetrabalho} onChange={e => setForm(f => ({ ...f, freteRetrabalho: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Desenvolvimento de Software (R$)</Label>
                            <Input className="h-8 text-sm mt-1" placeholder="Ex: 3500.00" value={form.devSoftware} onChange={e => setForm(f => ({ ...f, devSoftware: e.target.value }))} />
                          </div>
                        </div>
                      </div>

                      {/* ─── Receitas Detalhadas (a partir de Abr/2026) ─── */}
                      <div className="col-span-2 md:col-span-3 border-t pt-3 mt-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Receitas Detalhadas</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs font-medium">Receita Operacional OS (R$)</Label>
                            <Input className="h-8 text-sm mt-1" placeholder="Ex: 380000.00" value={form.receitaOperacionalOs} onChange={e => setForm(f => ({ ...f, receitaOperacionalOs: e.target.value }))} />
                            <p className="text-xs text-muted-foreground mt-0.5">Somente receita de OS</p>
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Resultado Efetivo (R$)</Label>
                            <Input className="h-8 text-sm mt-1" placeholder="Ex: 42000.00" value={form.resultadoEfetivo} onChange={e => setForm(f => ({ ...f, resultadoEfetivo: e.target.value }))} />
                            <p className="text-xs text-muted-foreground mt-0.5">Inclui OS não identificadas</p>
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Saldo do Mês (R$)</Label>
                            <Input className="h-8 text-sm mt-1" placeholder="Ex: 15000.00" value={form.saldoMes} onChange={e => setForm(f => ({ ...f, saldoMes: e.target.value }))} />
                            <p className="text-xs text-muted-foreground mt-0.5">Diferença real entrada-saída no caixa</p>
                          </div>
                        </div>
                      </div>

                      {/* ─── Indicadores TL1/TL2/TL3 (a partir de Abr/2026) ─── */}
                      <div className="col-span-2 md:col-span-3 border-t pt-3 mt-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Indicadores de Resultado (TL)</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs font-medium">TL1 — Margem de Contribuição (R$)</Label>
                            <Input className="h-8 text-sm mt-1" placeholder="Receitas − Desp. Variáveis" value={form.tl1} onChange={e => setForm(f => ({ ...f, tl1: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">TL2 — Resultado Operacional (R$)</Label>
                            <Input className="h-8 text-sm mt-1" placeholder="TL1 − Desp. Fixas" value={form.tl2} onChange={e => setForm(f => ({ ...f, tl2: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">TL3 — Resultado Final (R$)</Label>
                            <Input className="h-8 text-sm mt-1" placeholder="TL2 − Dívidas e Investimentos" value={form.tl3} onChange={e => setForm(f => ({ ...f, tl3: e.target.value }))} />
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 md:col-span-3 border-t pt-3 mt-1">
                        <Label className="text-xs font-medium">Observações</Label>
                        <Textarea className="text-sm mt-1 resize-none" rows={2} placeholder="Notas sobre o período financeiro..." value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
                      </div>
                    </div>
                  )}

                  {/* Detalhes expandidos */}
                  {isExpanded && !isEditing && r && (
                    <div className="pb-4 grid grid-cols-2 md:grid-cols-4 gap-3 bg-muted/20 rounded-lg p-4 mb-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Faturamento Oficial</div>
                        <div className="font-semibold text-emerald-600">{fmtBRL(r.faturamentoOficial)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Despesas Fixas</div>
                        <div className="font-semibold text-red-500">{fmtBRL(r.despesasFixas)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Despesas Variáveis</div>
                        <div className="font-semibold text-orange-500">{fmtBRL(r.despesasVariaveis)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Total Despesas</div>
                        <div className="font-semibold text-red-600">
                          {fixas != null && variaveis != null ? fmtBRL(fixas + variaveis) : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Lucro Bruto</div>
                        <div className={`font-semibold ${(r.lucroBruto ? parseFloat(r.lucroBruto) : lucroCalc ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {fmtBRL(r.lucroBruto ?? lucroCalc)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Lucro Líquido</div>
                        <div className={`font-semibold ${lucroExib != null && lucroExib >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {fmtBRL(lucroExib)}
                          <Seta atual={lucroExib} anterior={dadosMensais[mes - 2]?.lucroExib ?? null} label="vs mês ant." />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Margem Líquida</div>
                        <div className="font-semibold">{margem ? margem + "%" : "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1"><Users size={11} /> Receita/Colaborador</div>
                        <div className="font-semibold text-blue-600">
                          {receitaColab ? fmtBRL(receitaColab) : "—"}
                          <Seta atual={receitaColab} anterior={dadosMensais[mes - 2]?.receitaColab ?? null} label="vs mês ant." />
                        </div>
                      </div>
                      {/* Impostos detalhados */}
                      {(r.impostoDas || r.impostoIcmsDifal || r.impostoDaems) && (
                        <div className="col-span-2 md:col-span-4 border-t pt-2 mt-1">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Impostos</div>
                          <div className="grid grid-cols-3 gap-3">
                            {r.impostoDas && <div><div className="text-xs text-muted-foreground">DAS Simples</div><div className="font-semibold text-red-500">{fmtBRL(r.impostoDas)}</div></div>}
                            {r.impostoIcmsDifal && <div><div className="text-xs text-muted-foreground">ICMS DIFAL</div><div className="font-semibold text-red-500">{fmtBRL(r.impostoIcmsDifal)}</div></div>}
                            {r.impostoDaems && <div><div className="text-xs text-muted-foreground">DAEMS</div><div className="font-semibold text-red-500">{fmtBRL(r.impostoDaems)}</div></div>}
                          </div>
                        </div>
                      )}
                      {/* Despesas específicas */}
                      {(r.comissoesBv || r.produtividadeSolda || r.freteRetrabalho || r.devSoftware) && (
                        <div className="col-span-2 md:col-span-4 border-t pt-2 mt-1">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Despesas Específicas</div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {r.comissoesBv && <div><div className="text-xs text-muted-foreground">Comissões BV</div><div className="font-semibold text-orange-500">{fmtBRL(r.comissoesBv)}</div></div>}
                            {r.produtividadeSolda && <div><div className="text-xs text-muted-foreground">Produtividade Solda</div><div className="font-semibold text-orange-500">{fmtBRL(r.produtividadeSolda)}</div></div>}
                            {r.freteRetrabalho && <div><div className="text-xs text-muted-foreground">Frete Retrabalho</div><div className="font-semibold text-orange-500">{fmtBRL(r.freteRetrabalho)}</div></div>}
                            {r.devSoftware && <div><div className="text-xs text-muted-foreground">Dev. Software</div><div className="font-semibold text-orange-500">{fmtBRL(r.devSoftware)}</div></div>}
                          </div>
                        </div>
                      )}
                      {/* Receitas detalhadas */}
                      {(r.receitaOperacionalOs || r.resultadoEfetivo || r.saldoMes) && (
                        <div className="col-span-2 md:col-span-4 border-t pt-2 mt-1">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Receitas Detalhadas</div>
                          <div className="grid grid-cols-3 gap-3">
                            {r.receitaOperacionalOs && <div><div className="text-xs text-muted-foreground">Receita Op. OS</div><div className="font-semibold text-emerald-600">{fmtBRL(r.receitaOperacionalOs)}</div></div>}
                            {r.resultadoEfetivo && <div><div className="text-xs text-muted-foreground">Resultado Efetivo</div><div className={`font-semibold ${parseFloat(r.resultadoEfetivo) >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtBRL(r.resultadoEfetivo)}</div></div>}
                            {r.saldoMes && <div><div className="text-xs text-muted-foreground">Saldo do Mês</div><div className={`font-semibold ${parseFloat(r.saldoMes) >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtBRL(r.saldoMes)}</div></div>}
                          </div>
                        </div>
                      )}
                      {/* Indicadores TL */}
                      {(r.tl1 || r.tl2 || r.tl3) && (
                        <div className="col-span-2 md:col-span-4 border-t pt-2 mt-1">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Indicadores TL</div>
                          <div className="grid grid-cols-3 gap-3">
                            {r.tl1 && <div><div className="text-xs text-muted-foreground">TL1 — Margem Contribuição</div><div className={`font-semibold ${parseFloat(r.tl1) >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtBRL(r.tl1)}</div></div>}
                            {r.tl2 && <div><div className="text-xs text-muted-foreground">TL2 — Resultado Operacional</div><div className={`font-semibold ${parseFloat(r.tl2) >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtBRL(r.tl2)}</div></div>}
                            {r.tl3 && <div><div className="text-xs text-muted-foreground">TL3 — Resultado Final</div><div className={`font-semibold ${parseFloat(r.tl3) >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtBRL(r.tl3)}</div></div>}
                          </div>
                        </div>
                      )}
                      {r.notas && (
                        <div className="col-span-2 md:col-span-4">
                          <div className="text-xs text-muted-foreground">Observações</div>
                          <div className="text-sm">{r.notas}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>



      </> /* fim aba Painel legado */}
    </div>
  );
}
