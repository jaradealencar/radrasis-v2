import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
  AreaChart, Area, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, BarChart2,
  PieChart as PieIcon, AlertTriangle, CheckCircle2, Minus,
} from "lucide-react";

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function fmt(v: number | null | undefined, prefix = "R$ "): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${prefix}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${prefix}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${prefix}${abs.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function fmtFull(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

function delta(curr: number | null | undefined, prev: number | null | undefined) {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

// KPI Card estilo Power BI
function KpiCard({
  label, value, sub, trend, color = "emerald", icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number | null;
  color?: "emerald" | "red" | "blue" | "amber" | "violet" | "slate";
  icon?: React.ElementType;
}) {
  const colors = {
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", accent: "bg-emerald-500" },
    red:     { bg: "bg-red-50",     border: "border-red-200",     text: "text-red-700",     accent: "bg-red-500" },
    blue:    { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    accent: "bg-blue-500" },
    amber:   { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   accent: "bg-amber-500" },
    violet:  { bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-700",  accent: "bg-violet-500" },
    slate:   { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-700",   accent: "bg-slate-500" },
  };
  const c = colors[color];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 relative overflow-hidden`}>
      <div className={`absolute top-0 left-0 w-1 h-full ${c.accent} rounded-l-xl`} />
      <div className="pl-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          {Icon && <Icon size={14} className={c.text} />}
        </div>
        <div className={`text-2xl font-bold ${c.text} leading-tight`}>{value}</div>
        {(sub || trend != null) && (
          <div className="flex items-center gap-2 mt-1">
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
            {trend != null && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(trend).toFixed(1)}% vs mês ant.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Tooltip customizado
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-sm min-w-[200px]">
      <div className="font-semibold text-slate-700 mb-2 border-b pb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-bold text-slate-800">{fmtFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Tooltip de percentual
function PctTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-sm min-w-[180px]">
      <div className="font-semibold text-slate-700 mb-2 border-b pb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-bold text-slate-800">{(p.value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

const PIE_COLORS = ["#10b981", "#f87171", "#fb923c", "#6366f1", "#f59e0b", "#06b6d4"];

export default function PainelDRE({ anoSel }: { anoSel: number }) {
  const [mesSel, setMesSel] = useState<number | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<"dre" | "comparativo">("dre");

  const { data: dreDados = [] } = trpc.financeiro.getDreMensal.useQuery({ ano: anoSel });
  const { data: finDados = [] } = trpc.financeiro.list.useQuery({ ano: anoSel });

  // Ordenar por ano/mês
  const dadosOrdenados = useMemo(() => {
    return [...dreDados].sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);
  }, [dreDados]);

  // Mapa de dados financeiros básicos por mês
  const finMap = useMemo(() => {
    const m: Record<number, typeof finDados[0]> = {};
    for (const r of finDados) m[r.mes] = r;
    return m;
  }, [finDados]);

  // Meses disponíveis: apenas os que têm dados em financeiro_mensal OU dre_mensal
  const todosMeses = useMemo(() => {
    const mesesComDados = new Set<number>();
    for (const r of finDados) mesesComDados.add(r.mes);
    for (const d of dadosOrdenados) mesesComDados.add(d.mes);
    return Array.from(mesesComDados).sort((a, b) => a - b);
  }, [finDados, dadosOrdenados]);

  // Dados comparativos por mês (usando finDados como fonte principal, DRE como fallback)
  const comparativoData = useMemo(() => {
    return todosMeses.map(mes => {
      const fin = finMap[mes];
      const dre = dadosOrdenados.find(d => d.mes === mes);
      // Faturamento: financeiro_mensal tem prioridade, fallback para DRE total_entradas
      const fat = fin?.faturamentoOficial ? parseFloat(fin.faturamentoOficial)
        : (dre?.totalEntradas ? parseFloat(String(dre.totalEntradas)) : null);
      // Despesas: financeiro_mensal tem prioridade, fallback para DRE total_saidas
      const fixas = fin?.despesasFixas ? parseFloat(fin.despesasFixas)
        : (dre?.despesasFixas ? parseFloat(String(dre.despesasFixas)) : null);
      const variaveis = fin?.despesasVariaveis ? parseFloat(fin.despesasVariaveis)
        : (dre?.despesaVariavel ? parseFloat(String(dre.despesaVariavel)) : null);
      // Total despesas: financeiro_mensal, ou DRE total_saidas, ou soma fixas+variáveis
      const totalDespDre = dre?.totalSaidas ? parseFloat(String(dre.totalSaidas)) : null;
      const totalDesp = (fixas != null && variaveis != null) ? fixas + variaveis
        : totalDespDre;
      // Lucro líquido: financeiro_mensal, ou DRE lucro_liquido, ou fat - totalDesp
      const lucro = fin?.lucroLiquido ? parseFloat(fin.lucroLiquido)
        : (dre?.lucroLiquido ? parseFloat(String(dre.lucroLiquido))
          : (fat != null && totalDesp != null ? fat - totalDesp : null));
      return {
        mes,
        label: MESES_ABREV[mes - 1] + "/" + String(anoSel).slice(2),
        faturamento: fat,
        despesasFixas: fixas,
        despesasVariaveis: variaveis,
        totalDespesas: totalDesp,
        lucroLiquido: lucro,
        margem: fat && lucro != null ? lucro / fat : null,
        numColaboradores: fin?.numColaboradores ?? null,
        receitaColab: fat && fin?.numColaboradores ? fat / fin.numColaboradores : null,
        temDados: !!fin,
        // Campos novos
        impostoDas: fin?.impostoDas ? parseFloat(fin.impostoDas) : null,
        impostoIcmsDifal: fin?.impostoIcmsDifal ? parseFloat(fin.impostoIcmsDifal) : null,
        impostoDaems: fin?.impostoDaems ? parseFloat(fin.impostoDaems) : null,
        tl1: fin?.tl1 ? parseFloat(fin.tl1) : null,
        tl2: fin?.tl2 ? parseFloat(fin.tl2) : null,
        tl3: fin?.tl3 ? parseFloat(fin.tl3) : null,
        resultadoEfetivo: fin?.resultadoEfetivo ? parseFloat(fin.resultadoEfetivo) : null,
        saldoMes: fin?.saldoMes ? parseFloat(fin.saldoMes) : null,
        // DRE
        dreDisponivel: !!dre,
      };
    });
  }, [todosMeses, finMap, dadosOrdenados, anoSel]);

  // Acumulados e médias
  const acumulados = useMemo(() => {
    const comDados = comparativoData.filter(d => d.temDados);
    const fatTotal = comDados.reduce((s, d) => s + (d.faturamento ?? 0), 0);
    const lucroTotal = comDados.reduce((s, d) => s + (d.lucroLiquido ?? 0), 0);
    const despTotal = comDados.reduce((s, d) => s + (d.totalDespesas ?? 0), 0);
    const n = comDados.length;
    return {
      fatTotal, lucroTotal, despTotal,
      fatMedia: n > 0 ? fatTotal / n : null,
      lucroMedia: n > 0 ? lucroTotal / n : null,
      despMedia: n > 0 ? despTotal / n : null,
      margemMedia: fatTotal > 0 ? lucroTotal / fatTotal : null,
      mesesComDados: n,
      // Lucro acumulado mês a mês
      acumuladoMes: comparativoData.map((d, i) => ({
        label: d.label,
        mes: d.mes,
        lucroMes: d.lucroLiquido,
        acumulado: comparativoData.slice(0, i + 1).reduce((s, x) => s + (x.lucroLiquido ?? 0), 0),
        temDados: d.temDados,
      })),
    };
  }, [comparativoData]);

  const ultimo = dadosOrdenados[dadosOrdenados.length - 1] ?? null;
  const penultimo = dadosOrdenados[dadosOrdenados.length - 2] ?? null;

  // Métricas do último mês disponível
  const mesLabel = ultimo ? `${MESES_ABREV[(ultimo.mes - 1)]}/${ultimo.ano}` : "—";

  // Dados para gráficos
  const chartDRE = useMemo(() => dadosOrdenados.map(d => ({
    name: `${MESES_ABREV[(d.mes - 1)]}/${String(d.ano).slice(2)}`,
    "Receita Op.": d.receitaOperacionalBruta,
    "Total Saídas": d.totalSaidas,
    "Lucro Operacional": d.lucroOperacional,
    "Lucro Líquido": d.lucroLiquido,
  })), [dadosOrdenados]);

  const chartMargem = useMemo(() => dadosOrdenados.map(d => ({
    name: `${MESES_ABREV[(d.mes - 1)]}/${String(d.ano).slice(2)}`,
    "Resultado Efetivo %": d.margemResultadoEfetivo,
    "Lucro Operacional %": d.lucroOperacional != null && d.receitaOperacionalBruta
      ? d.lucroOperacional / d.receitaOperacionalBruta
      : null,
  })), [dadosOrdenados]);

  const chartComposicao = useMemo(() => dadosOrdenados.map(d => ({
    name: `${MESES_ABREV[(d.mes - 1)]}/${String(d.ano).slice(2)}`,
    "Mat. Prima": d.percMateriaPrima,
    "Fixo Rateado": d.percFixoRateado,
    "Tributos": d.percTributos,
    "Comissão": d.percComissaoInterna,
    "Descontos": d.percDescontos,
  })), [dadosOrdenados]);

  // Composição de custos do último mês para o gráfico de pizza
  const pieData = useMemo(() => {
    if (!ultimo) return [];
    const custos = [
      { name: "Mat. Prima", value: ultimo.materiaPrima ?? 0 },
      { name: "Pessoal", value: ultimo.despesasPessoal ?? 0 },
      { name: "Desp. Fixas", value: ultimo.despesasFixas ?? 0 },
      { name: "Desp. Financeiras", value: ultimo.despesasFinanceiras ?? 0 },
      { name: "GGF", value: ultimo.gastosGeraisFabricacao ?? 0 },
      { name: "Não Operac.", value: ultimo.despesasNaoOperacionais ?? 0 },
    ].filter(d => d.value > 0);
    return custos;
  }, [ultimo]);

  // Tabela DRE resumida
  const tabelaDRE = useMemo(() => {
    const linhas = [
      { label: "(+) Receita Operacional Bruta", key: "receitaOperacionalBruta", positivo: true },
      { label: "(-) Impostos sobre Vendas", key: "impostosVendas", positivo: false },
      { label: "(=) Receita Bruta Operacional", key: "receitaBrutaOperacional", positivo: true, subtotal: true },
      { label: "(-) Despesa Variável", key: "despesaVariavel", positivo: false },
      { label: "(-) Despesa Operacional", key: "despesaOperacional", positivo: false },
      { label: "(=) Lucro Bruto", key: "lucroBruto", positivo: true, subtotal: true },
      { label: "(-) Despesas Fixas", key: "despesasFixas", positivo: false },
      { label: "(-) Despesas com Pessoal", key: "despesasPessoal", positivo: false },
      { label: "(-) Despesas Financeiras", key: "despesasFinanceiras", positivo: false },
      { label: "(+) Receitas Financeiras", key: "receitaFinanceira", positivo: true },
      { label: "(=) Lucro / Prejuízo Operacional", key: "lucroOperacional", positivo: true, subtotal: true },
      { label: "(-) Despesas Não Operacionais", key: "despesasNaoOperacionais", positivo: false },
      { label: "(+) Receitas Não Operacionais", key: "receitaNaoOperacional", positivo: true },
      { label: "(=) Lucro / Prejuízo Líquido", key: "lucroLiquido", positivo: true, subtotal: true, destaque: true },
    ];
    return linhas;
  }, []);

  if (comparativoData.filter(d => d.temDados).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <BarChart2 size={40} className="opacity-30" />
        <p className="text-sm">Nenhum dado de fechamento disponível para {anoSel}.</p>
        <p className="text-xs">Cadastre os dados mensais na aba Financeiro.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Abas DRE / Comparativo */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setAbaAtiva("dre")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            abaAtiva === "dre"
              ? "border-blue-600 text-blue-700 bg-blue-50"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          DRE Gerencial
        </button>
        <button
          onClick={() => setAbaAtiva("comparativo")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            abaAtiva === "comparativo"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          Comparativo Anual
        </button>
      </div>

      {/* Aba Comparativo Anual */}
      {abaAtiva === "comparativo" && (
        <div className="space-y-6">
          {/* Cards de resumo acumulado */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Faturamento Acumulado"
              value={fmt(acumulados.fatTotal)}
              sub={`Média: ${fmt(acumulados.fatMedia)}/mês`}
              color="emerald"
              icon={DollarSign}
            />
            <KpiCard
              label="Total Despesas Acum."
              value={fmt(acumulados.despTotal)}
              sub={`Média: ${fmt(acumulados.despMedia)}/mês`}
              color="red"
              icon={TrendingDown}
            />
            <KpiCard
              label={acumulados.lucroTotal >= 0 ? "Lucro Acumulado" : "Prejuízo Acumulado"}
              value={fmt(acumulados.lucroTotal)}
              sub={`Média: ${fmt(acumulados.lucroMedia)}/mês`}
              color={acumulados.lucroTotal >= 0 ? "blue" : "red"}
              icon={acumulados.lucroTotal >= 0 ? CheckCircle2 : AlertTriangle}
            />
            <KpiCard
              label="Margem Média"
              value={fmtPct(acumulados.margemMedia)}
              sub={`${acumulados.mesesComDados} meses com dados`}
              color={acumulados.margemMedia != null && acumulados.margemMedia >= 0 ? "violet" : "red"}
              icon={BarChart2}
            />
          </div>

          {/* Gráfico de lucro/prejuízo acumulado */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                Lucro / Prejuízo Acumulado no Ano
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={acumulados.acumuladoMes.filter(d => d.temDados)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => fmt(v, "")} tick={{ fontSize: 10 }} width={65} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={2} />
                  <Bar dataKey="lucroMes" name="Lucro do Mês" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.8} />
                  <Line dataKey="acumulado" name="Acumulado" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico faturamento vs despesas */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Faturamento vs Despesas por Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={comparativoData.filter(d => d.temDados)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => fmt(v, "")} tick={{ fontSize: 10 }} width={65} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="faturamento" name="Faturamento" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.85} />
                  <Bar dataKey="totalDespesas" name="Total Despesas" fill="#f87171" radius={[4, 4, 0, 0]} opacity={0.8} />
                  <Line dataKey="lucroLiquido" name="Lucro Líquido" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tabela comparativa mensal */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-500" />
                Tabela Comparativa — {anoSel}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-600 uppercase tracking-wide">Mês</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-slate-600 uppercase tracking-wide">Faturamento</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-slate-600 uppercase tracking-wide">Desp. Fixas</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-slate-600 uppercase tracking-wide">Desp. Variáveis</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-slate-600 uppercase tracking-wide">Total Desp.</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-slate-600 uppercase tracking-wide">Lucro Líquido</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-slate-600 uppercase tracking-wide">Margem</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-slate-600 uppercase tracking-wide">Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acumulados.acumuladoMes.map((d, i) => {
                      const comp = comparativoData[i];
                      const isLucro = d.lucroMes != null && d.lucroMes >= 0;
                      const isAcumLucro = d.acumulado >= 0;
                      return (
                        <tr key={d.mes} className={`border-b transition-colors ${
                          !comp.temDados ? "opacity-40" : "hover:bg-slate-50/50"
                        }`}>
                          <td className="px-4 py-2 font-semibold text-slate-700">{d.label}</td>
                          <td className="text-right px-3 py-2 font-mono text-emerald-700">{comp.faturamento != null ? fmtFull(comp.faturamento) : "—"}</td>
                          <td className="text-right px-3 py-2 font-mono text-red-500">{comp.despesasFixas != null ? fmtFull(comp.despesasFixas) : "—"}</td>
                          <td className="text-right px-3 py-2 font-mono text-red-400">{comp.despesasVariaveis != null ? fmtFull(comp.despesasVariaveis) : "—"}</td>
                          <td className="text-right px-3 py-2 font-mono text-red-600 font-semibold">{comp.totalDespesas != null ? fmtFull(comp.totalDespesas) : "—"}</td>
                          <td className={`text-right px-3 py-2 font-mono font-bold ${
                            !comp.temDados ? "text-muted-foreground" : isLucro ? "text-emerald-700" : "text-red-600"
                          }`}>{d.lucroMes != null ? fmtFull(d.lucroMes) : "—"}</td>
                          <td className={`text-right px-3 py-2 font-mono ${
                            comp.margem == null ? "text-muted-foreground" : comp.margem >= 0 ? "text-blue-700" : "text-red-500"
                          }`}>{comp.margem != null ? fmtPct(comp.margem) : "—"}</td>
                          <td className={`text-right px-3 py-2 font-mono font-bold ${
                            isAcumLucro ? "text-emerald-700" : "text-red-600"
                          }`}>{comp.temDados ? fmtFull(d.acumulado) : "—"}</td>
                        </tr>
                      );
                    })}
                    {/* Linha de médias */}
                    <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
                      <td className="px-4 py-2.5 text-blue-800">Média Mensal</td>
                      <td className="text-right px-3 py-2.5 font-mono text-emerald-700">{acumulados.fatMedia != null ? fmtFull(acumulados.fatMedia) : "—"}</td>
                      <td className="text-right px-3 py-2.5 font-mono text-red-500">—</td>
                      <td className="text-right px-3 py-2.5 font-mono text-red-400">—</td>
                      <td className="text-right px-3 py-2.5 font-mono text-red-600">{acumulados.despMedia != null ? fmtFull(acumulados.despMedia) : "—"}</td>
                      <td className={`text-right px-3 py-2.5 font-mono ${
                        acumulados.lucroMedia != null && acumulados.lucroMedia >= 0 ? "text-emerald-700" : "text-red-600"
                      }`}>{acumulados.lucroMedia != null ? fmtFull(acumulados.lucroMedia) : "—"}</td>
                      <td className={`text-right px-3 py-2.5 font-mono ${
                        acumulados.margemMedia != null && acumulados.margemMedia >= 0 ? "text-blue-700" : "text-red-500"
                      }`}>{acumulados.margemMedia != null ? fmtPct(acumulados.margemMedia) : "—"}</td>
                      <td className={`text-right px-3 py-2.5 font-mono ${
                        acumulados.lucroTotal >= 0 ? "text-emerald-700" : "text-red-600"
                      }`}>{fmtFull(acumulados.lucroTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Aba DRE Gerencial */}
      {abaAtiva === "dre" && <div className="space-y-6">

      {/* Seletor de mês de referência — agora mostra todos os meses do ano */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mês de referência:</span>
        {todosMeses.map(mes => {
          const temDados = !!finMap[mes] || !!dadosOrdenados.find(d => d.mes === mes);
          const isAtivo = mesSel === null ? mes === (ultimo?.mes ?? todosMeses[todosMeses.length - 1]) : mes === mesSel;
          const podeClicar = temDados;
          return (
            <button
              key={mes}
              onClick={() => setMesSel(isAtivo ? null : mes)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                isAtivo
                  ? "bg-blue-600 text-white border-blue-600"
                  : temDados
                  ? "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                  : "bg-slate-50 text-slate-400 border-slate-100 cursor-default"
              }`}
            >
              {MESES_ABREV[mes - 1]}/{String(anoSel).slice(2)}
              {!temDados && <span className="ml-1 opacity-50">+</span>}
            </button>
          );
        })}
      </div>

      {/* KPIs do mês selecionado */}
      {(() => {
        // Usa dre_mensal se disponível, senão usa o último mês com dados DRE
        const selMes = mesSel ?? ultimo?.mes ?? todosMeses[todosMeses.length - 1];
        const sel = dadosOrdenados.find(d => d.mes === selMes) ?? ultimo;
        const prev = sel ? dadosOrdenados[dadosOrdenados.indexOf(sel) - 1] ?? null : null;
        if (!sel) return null;
        const label = `${MESES_ABREV[sel.mes - 1]}/${sel.ano}`;
        return (
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
              <div className="w-3 h-0.5 bg-blue-500 rounded" />
              Indicadores — {label}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="Receita Op. Bruta"
                value={fmt(sel.receitaOperacionalBruta)}
                sub={`Pedidos: ${fmt(sel.valorPedidos)}`}
                trend={delta(sel.receitaOperacionalBruta, prev?.receitaOperacionalBruta)}
                color="emerald"
                icon={DollarSign}
              />
              <KpiCard
                label="Total Saídas"
                value={fmt(sel.totalSaidas)}
                sub="Todas as despesas"
                trend={delta(sel.totalSaidas, prev?.totalSaidas)}
                color="red"
                icon={TrendingDown}
              />
              <KpiCard
                label="Lucro Operacional"
                value={fmt(sel.lucroOperacional)}
                sub={sel.lucroOperacional != null && sel.receitaOperacionalBruta
                  ? fmtPct(sel.lucroOperacional / sel.receitaOperacionalBruta)
                  : undefined}
                trend={delta(sel.lucroOperacional, prev?.lucroOperacional)}
                color={sel.lucroOperacional != null && sel.lucroOperacional >= 0 ? "blue" : "red"}
                icon={BarChart2}
              />
              <KpiCard
                label="Lucro / Prejuízo Líquido"
                value={fmt(sel.lucroLiquido)}
                sub={`Resultado Efetivo: ${fmtPct(sel.margemResultadoEfetivo)}`}
                trend={delta(sel.lucroLiquido, prev?.lucroLiquido)}
                color={sel.lucroLiquido != null && sel.lucroLiquido >= 0 ? "emerald" : "red"}
                icon={sel.lucroLiquido != null && sel.lucroLiquido >= 0 ? CheckCircle2 : AlertTriangle}
              />
            </div>

            {/* Segunda linha de KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <KpiCard
                label="Margem Resultado Efetivo"
                value={fmtPct(sel.margemResultadoEfetivo)}
                sub="Sobre valor dos pedidos"
                color="violet"
                icon={PieIcon}
              />
              <KpiCard
                label="Mat. Prima / Pedidos"
                value={fmtPct(sel.percMateriaPrima)}
                sub={fmt(sel.materiaPrima)}
                color="amber"
              />
              <KpiCard
                label="Fixo Rateado / Pedidos"
                value={fmtPct(sel.percFixoRateado)}
                sub={fmt(sel.despesasFixas)}
                color="slate"
              />
              <KpiCard
                label="Tributos / Pedidos"
                value={fmtPct(sel.percTributos)}
                sub={fmt(sel.impostosVendas)}
                color="amber"
              />
            </div>
          </div>
        );
      })()}

      {/* Gráficos — linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Receita vs Saídas */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              Receita Operacional vs Total de Saídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartDRE} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => fmt(v, "")} tick={{ fontSize: 10 }} width={65} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Receita Op." fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.9} />
                <Bar dataKey="Total Saídas" fill="#f87171" radius={[4, 4, 0, 0]} opacity={0.85} />
                <Line dataKey="Lucro Líquido" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Evolução de Margens */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-500" />
              Evolução de Margens (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartMargem} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradViolet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => (v * 100).toFixed(0) + "%"} tick={{ fontSize: 10 }} width={45} />
                <Tooltip content={<PctTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={1.5} />
                <Area dataKey="Resultado Efetivo %" stroke="#8b5cf6" fill="url(#gradViolet)" strokeWidth={2.5} dot={{ r: 4 }} type="monotone" />
                <Area dataKey="Lucro Operacional %" stroke="#3b82f6" fill="url(#gradBlue)" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos — linha 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Composição de custos % sobre pedidos */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              Composição de Custos (% sobre Pedidos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartComposicao} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => (v * 100).toFixed(0) + "%"} tick={{ fontSize: 10 }} width={40} />
                <Tooltip content={<PctTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Mat. Prima" stackId="a" fill="#f59e0b" opacity={0.9} />
                <Bar dataKey="Fixo Rateado" stackId="a" fill="#6366f1" opacity={0.9} />
                <Bar dataKey="Tributos" stackId="a" fill="#f87171" opacity={0.9} />
                <Bar dataKey="Comissão" stackId="a" fill="#10b981" opacity={0.9} />
                <Bar dataKey="Descontos" stackId="a" fill="#94a3b8" opacity={0.9} radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pizza de composição do último mês */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Distribuição de Custos — {mesLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtFull(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {pieData.map((d, i) => {
                  const total = pieData.reduce((s, x) => s + x.value, 0);
                  const pct = total > 0 ? (d.value / total * 100).toFixed(1) : "0";
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-slate-600 flex-1 truncate">{d.name}</span>
                      <span className="font-semibold text-slate-800">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela DRE Gerencial */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-500" />
            DRE Gerencial — Demonstrativo de Resultados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide w-64">Linha DRE</th>
                  {dadosOrdenados.map(d => (
                    <th key={`${d.ano}-${d.mes}`} className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                      {MESES_ABREV[d.mes - 1]}/{String(d.ano).slice(2)}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Média</th>
                </tr>
              </thead>
              <tbody>
                {tabelaDRE.map((linha, idx) => {
                  const isSubtotal = linha.subtotal;
                  const isDestaque = linha.destaque;
                  const valores = dadosOrdenados.map(d => (d as any)[linha.key] as number | null);
                  const media = valores.filter(v => v != null).length > 0
                    ? valores.filter(v => v != null).reduce((s, v) => s + v!, 0) / valores.filter(v => v != null).length
                    : null;
                  return (
                    <tr
                      key={idx}
                      className={`border-b transition-colors ${
                        isDestaque
                          ? "bg-blue-50 border-blue-200 font-bold"
                          : isSubtotal
                          ? "bg-slate-50 font-semibold"
                          : "hover:bg-slate-50/50"
                      }`}
                    >
                      <td className={`px-4 py-2 text-xs ${isDestaque ? "text-blue-800" : isSubtotal ? "text-slate-700" : "text-slate-600"}`}>
                        {linha.label}
                      </td>
                      {valores.map((v, i) => (
                        <td key={i} className={`text-right px-3 py-2 text-xs font-mono ${
                          v == null ? "text-muted-foreground" :
                          isDestaque ? (v >= 0 ? "text-emerald-700" : "text-red-600") :
                          isSubtotal ? "text-slate-800" :
                          linha.positivo ? "text-emerald-700" : "text-red-600"
                        }`}>
                          {v != null ? fmtFull(v) : "—"}
                        </td>
                      ))}
                      <td className={`text-right px-3 py-2 text-xs font-mono ${
                        media == null ? "text-muted-foreground" :
                        isDestaque ? (media >= 0 ? "text-emerald-700 font-bold" : "text-red-600 font-bold") :
                        "text-slate-600"
                      }`}>
                        {media != null ? fmtFull(media) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de composição de custos por mês */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            Composição de Custos por Mês (% sobre Pedidos)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Componente</th>
                  {dadosOrdenados.map(d => (
                    <th key={`${d.ano}-${d.mes}`} className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                      {MESES_ABREV[d.mes - 1]}/{String(d.ano).slice(2)}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Média</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Matéria Prima", key: "percMateriaPrima", color: "bg-amber-400" },
                  { label: "Fixo Rateado", key: "percFixoRateado", color: "bg-indigo-400" },
                  { label: "Tributos", key: "percTributos", color: "bg-red-400" },
                  { label: "Comissão Interna", key: "percComissaoInterna", color: "bg-emerald-400" },
                  { label: "Descontos", key: "percDescontos", color: "bg-slate-400" },
                  { label: "Resultado Efetivo", key: "margemResultadoEfetivo", color: "bg-violet-500" },
                ].map((linha, idx) => {
                  const valores = dadosOrdenados.map(d => (d as any)[linha.key] as number | null);
                  const media = valores.filter(v => v != null).length > 0
                    ? valores.filter(v => v != null).reduce((s, v) => s + v!, 0) / valores.filter(v => v != null).length
                    : null;
                  const isResultado = linha.key === "margemResultadoEfetivo";
                  return (
                    <tr key={idx} className={`border-b hover:bg-slate-50/50 ${isResultado ? "bg-violet-50 font-semibold" : ""}`}>
                      <td className="px-4 py-2 text-xs text-slate-700 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-sm ${linha.color}`} />
                        {linha.label}
                      </td>
                      {valores.map((v, i) => (
                        <td key={i} className={`text-right px-3 py-2 text-xs font-mono ${
                          v == null ? "text-muted-foreground" :
                          isResultado ? (v >= 0 ? "text-violet-700 font-bold" : "text-red-600 font-bold") :
                          "text-slate-700"
                        }`}>
                          {v != null ? fmtPct(v) : "—"}
                        </td>
                      ))}
                      <td className={`text-right px-3 py-2 text-xs font-mono ${
                        media == null ? "text-muted-foreground" :
                        isResultado ? (media >= 0 ? "text-violet-700 font-bold" : "text-red-600 font-bold") :
                        "text-slate-600"
                      }`}>
                        {media != null ? fmtPct(media) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      </div>}{/* fim aba DRE */}

    </div>
  );
}
