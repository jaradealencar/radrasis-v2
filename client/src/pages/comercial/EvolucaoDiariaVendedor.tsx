import { trpc } from "@/lib/trpc";
import { useState, useMemo, useRef, useCallback } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { chartColor } from "@/lib/chartColors";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

const INDICADORES = [
  { id: "os",  label: "Vendas Realizadas",  acumId: "acumOs",  fmt: "num" as const },
  { id: "fat", label: "Faturamento", acumId: "acumFat", fmt: "brl" as const },
  { id: "cot", label: "Cotações",    acumId: "acumCot", fmt: "num" as const },
  { id: "orc", label: "Valor Orçado",acumId: "acumOrc", fmt: "brl" as const },
];

type IndicadorId = "os" | "fat" | "cot" | "orc";

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtNum(v: number) { return v.toLocaleString("pt-BR"); }
function fmt(v: number, tipo: "brl" | "num") { return tipo === "brl" ? fmtBrl(v) : fmtNum(v); }

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const VENDEDORES_PRINCIPAIS = ["STHEFANIE LOUIS", "Letícia Carozzo", "Karize Boaventura"];

interface Props { mes: number; ano: number; }

export default function EvolucaoDiariaVendedor({ mes, ano }: Props) {
  const [indicador, setIndicador] = useState<IndicadorId>("os");
  const [modo, setModo] = useState<"diario" | "acumulado">("acumulado");
  const [vendedoresSelecionados, setVendedoresSelecionados] = useState<Set<string>>(new Set());
  const [exportando, setExportando] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = trpc.performanceComercial.getEvolucaoDiariaMes.useQuery(
    { mes, ano },
    { staleTime: 5 * 60 * 1000 }
  );

  const ind = INDICADORES.find(i => i.id === indicador)!;
  const campo = modo === "acumulado" ? ind.acumId : ind.id;

  const vendedores = useMemo(() => data?.vendedores ?? [], [data]);
  const vendedoresFiltrados = useMemo(() => {
    if (vendedoresSelecionados.size === 0) return vendedores;
    return vendedores.filter(v => vendedoresSelecionados.has(v));
  }, [vendedores, vendedoresSelecionados]);

  const chartData = useMemo(() => {
    if (!data?.dias) return [];
    return data.dias.map(dia => {
      const row: Record<string, any> = { label: dia.label };
      const pv = dia.porVendedor ?? {};
      for (const v of vendedoresFiltrados) {
        row[v] = (pv[v] as any)?.[campo] ?? 0;
      }
      return row;
    });
  }, [data, vendedoresFiltrados, campo]);

  const ultimoDia = useMemo(() => {
    if (!data?.dias || data.dias.length === 0) return null;
    return data.dias[data.dias.length - 1];
  }, [data]);

  const toggleVendedor = (v: string) => {
    setVendedoresSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(v)) { next.delete(v); } else { next.add(v); }
      return next;
    });
  };

  const exportarPDF = useCallback(async () => {
    if (!chartRef.current) return;
    setExportando(true);
    try {
      const canvas = await html2canvas(chartRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pW = pdf.internal.pageSize.getWidth();
      const pH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.height / canvas.width;
      const imgH = pW * ratio;
      pdf.addImage(imgData, 'PNG', 0, (pH - imgH) / 2, pW, imgH);
      pdf.save(`evolucao-vendedor-${MESES[mes-1]}-${ano}.pdf`);
    } finally {
      setExportando(false);
    }
  }, [mes, ano]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-sm text-slate-500">Carregando dados diários da API MubiSys...</p>
        <p className="text-xs text-slate-400 mt-1">Isso pode levar alguns segundos na primeira carga</p>
      </div>
    );
  }

  if (!data || data.dias.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nenhum dado disponível para {MESES[mes - 1]}/{ano}.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Gráfico principal */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              Evolução Diária — {MESES[mes - 1]}/{ano}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {data.dias.length} dias registrados · {vendedores.length} vendedores ativos
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Filtro rápido por vendedor */}
            <div className="flex items-center gap-1">
              {VENDEDORES_PRINCIPAIS.map(v => {
                const nome = v.split(' ')[0];
                const ativo = vendedoresSelecionados.size === 0 || vendedoresSelecionados.has(v);
                return (
                  <button
                    key={v}
                    onClick={() => toggleVendedor(v)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      ativo
                        ? "bg-indigo-50 text-indigo-700 border-indigo-300"
                        : "bg-slate-50 text-slate-400 border-slate-200"
                    }`}
                  >
                    {nome}
                  </button>
                );
              })}
            </div>
            {/* Botão exportar PDF */}
            <button
              onClick={exportarPDF}
              disabled={exportando}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 transition-all disabled:opacity-50"
            >
              {exportando ? (
                <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              PDF
            </button>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(["acumulado", "diario"] as const).map(m => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  modo === m ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "acumulado" ? "Acumulado" : "Diário"}
              </button>
            ))}
          </div>
        </div>

        {/* Seletor de indicador */}
        <div className="flex flex-wrap gap-2 mb-5">
          {INDICADORES.map(i => (
            <button
              key={i.id}
              onClick={() => setIndicador(i.id as IndicadorId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                indicador === i.id
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>

        <div ref={chartRef}>
        <ResponsiveContainer width="100%" height={320}>
          {modo === "acumulado" ? (
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                interval={Math.max(1, Math.floor(chartData.length / 10))}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={v => ind.fmt === "brl" ? `R$${(v/1000).toFixed(0)}k` : String(v)}
                width={ind.fmt === "brl" ? 60 : 40}
              />
              <Tooltip
                formatter={(v: number) => [fmt(v, ind.fmt), ""]}
                labelStyle={{ fontSize: 11, fontWeight: 600 }}
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {vendedoresFiltrados.map((v, i) => (
                <Line
                  key={v}
                  type="monotone"
                  dataKey={v}
                  stroke={chartColor(i)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                interval={Math.max(1, Math.floor(chartData.length / 10))}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={v => ind.fmt === "brl" ? `R$${(v/1000).toFixed(0)}k` : String(v)}
                width={ind.fmt === "brl" ? 60 : 40}
              />
              <Tooltip
                formatter={(v: number) => [fmt(v, ind.fmt), ""]}
                labelStyle={{ fontSize: 11, fontWeight: 600 }}
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {vendedoresFiltrados.map((v, i) => (
                <Bar key={v} dataKey={v} fill={chartColor(i)} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          ) as any}
        </ResponsiveContainer>
        </div>
      </div>

      {/* Cards de totais por vendedor (clicáveis para filtrar) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {vendedores.map((v, i) => {
          const cor = chartColor(i);
          const ativo = vendedoresSelecionados.size === 0 || vendedoresSelecionados.has(v);
          const pv = (ultimoDia?.porVendedor ?? {})[v] as any;
          const totalOs = pv?.acumOs ?? 0;
          const totalFat = pv?.acumFat ?? 0;
          const totalCot = pv?.acumCot ?? 0;
          return (
            <button
              key={v}
              onClick={() => toggleVendedor(v)}
              className={`text-left p-3 rounded-xl border transition-all ${
                ativo
                  ? "bg-white border-slate-200 shadow-sm hover:shadow-md"
                  : "bg-slate-50 border-slate-100 opacity-40"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cor }} />
                <span className="text-xs font-semibold text-slate-700 truncate">{v}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">OS</span>
                  <span className="text-xs font-bold text-slate-800">{totalOs}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Fat.</span>
                  <span className="text-xs font-semibold" style={{ color: cor }}>
                    {fmtBrl(totalFat)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Cot.</span>
                  <span className="text-xs text-slate-600">{totalCot}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Clique nos cards para filtrar vendedores no gráfico · Dados em tempo real da API MubiSys
      </p>
    </div>
  );
}
