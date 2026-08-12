import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
  BarChart, Bar, Cell,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Table, TableHeader, TableBody, TableFooter,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, BarChart2, Trophy, ArrowUpRight, ArrowDownRight } from "lucide-react";

// ─── Constantes ──────────────────────────────────────────────────────────────

const MESES_NOMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

const CORES_VENDEDORES = [
  "#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444",
  "#0ea5e9", "#a855f7", "#ec4899", "#14b8a6", "#f97316",
  "#84cc16", "#06b6d4", "#6366f1", "#d946ef", "#10b981",
];

// ─── Indicadores disponíveis ─────────────────────────────────────────────────

type Indicador = {
  key: string;
  label: string;
  fmt: (v: number) => string;
  unit?: string;
  isPct?: boolean;
  isCurrency?: boolean;
  domain?: [number | string, number | string];
  higherIsBetter?: boolean;
};

const INDICADORES: Indicador[] = [
  { key: "cotacoes", label: "Cotações", fmt: (v) => String(Math.round(v)), unit: "cot.", higherIsBetter: true },
  { key: "osGeradas", label: "Vendas Realizadas", fmt: (v) => String(Math.round(v)), unit: "OS", higherIsBetter: true },
  { key: "faturamento", label: "Faturamento", fmt: (v) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`, isCurrency: true, higherIsBetter: true },
  { key: "valorOrcado", label: "Valor Orçado", fmt: (v) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`, isCurrency: true, higherIsBetter: true },
  { key: "taxaConversao", label: "Taxa de Conversão", fmt: (v) => `${parseFloat(v.toFixed(1))}%`, isPct: true, unit: "%", domain: [0, 100], higherIsBetter: true },
  { key: "taxaFaturamento", label: "Taxa de Faturamento", fmt: (v) => `${parseFloat(v.toFixed(1))}%`, isPct: true, unit: "%", domain: [0, 100], higherIsBetter: true },
  { key: "ticketMedio", label: "Ticket Médio", fmt: (v) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`, isCurrency: true, higherIsBetter: true },
  { key: "margemPct", label: "Margem %", fmt: (v) => `${parseFloat(v.toFixed(1))}%`, isPct: true, unit: "%", higherIsBetter: true },
  { key: "resultado", label: "Resultado (R$)", fmt: (v) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`, isCurrency: true, higherIsBetter: true },
];

// ─── Tooltip customizado ─────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, indicador }: any) {
  if (!active || !payload?.length) return null;
  const ind = INDICADORES.find(i => i.key === indicador);
  const sorted = [...payload].sort((a, b) => Number(b.value) - Number(a.value));
  return (
    <div className="rounded-xl p-3 text-xs bg-white border border-slate-200 shadow-xl min-w-[200px]">
      <p className="font-bold mb-2.5 text-slate-700 border-b border-slate-100 pb-2">{label}</p>
      {sorted.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-3 mb-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-slate-500 truncate max-w-[110px]">{p.name}</span>
          </div>
          <span className="font-bold text-slate-800 shrink-0">
            {ind ? ind.fmt(Number(p.value)) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface EvolucaoVendedorProps {
  anoSelecionado: number;
  mesSelecionado: number;
  metaGeral?: any;
  fonteStatus?: 'tempo-real' | 'auditado' | 'congelado';
  auditoriaData?: { dataCongelamento?: Date | number | null; auditadoPor?: string | null; congelado?: boolean } | null;
}

export default function EvolucaoVendedor({ anoSelecionado, mesSelecionado, metaGeral, fonteStatus = 'tempo-real', auditoriaData }: EvolucaoVendedorProps) {
  const [indicadorKey, setIndicadorKey] = useState("cotacoes");
  const [vendedorFoco, setVendedorFoco] = useState<string | null>(null);

  // Últimos 12 meses excluindo o mês atual
  const mesesEvolucao = useMemo(() => {
    const result: { mes: number; ano: number }[] = [];
    for (let i = 12; i >= 1; i--) {
      let m = MES_ATUAL - i;
      let a = anoSelecionado;
      if (m <= 0) { m += 12; a -= 1; }
      result.push({ mes: m, ano: a });
    }
    return result;
  }, [anoSelecionado]);

  const { data: multiMesDados, isLoading } = trpc.performanceComercial.getMultiMes.useQuery(
    { meses: mesesEvolucao },
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
  );

  const indicador = INDICADORES.find(i => i.key === indicadorKey) ?? INDICADORES[0];

  // Vendedores permitidos na aba de Evolução por Vendedor
  const VENDEDORES_PERMITIDOS = ["Sthefanie Louis", "Letícia Carozzo", "Karize Boaventura"];

  // Todos os vendedores únicos (filtrado para os 3 permitidos)
  const todosVendedores = useMemo(() => {
    if (!multiMesDados) return [];
    const set = new Set<string>();
    for (const mes of multiMesDados) {
      if (!mes) continue;
      for (const v of (mes.porVendedor ?? [])) {
        if (v.vendedor && v.vendedor !== "Sem Vendedor") {
          // Verificar se o nome do vendedor contém algum dos nomes permitidos
          const nomeNorm = String(v.vendedor).toLowerCase();
          const permitido = VENDEDORES_PERMITIDOS.some(p =>
            nomeNorm.includes(p.split(" ")[0].toLowerCase())
          );
          if (permitido) set.add(v.vendedor);
        }
      }
    }
    return Array.from(set).sort();
  }, [multiMesDados]);

  // Dados do gráfico de linha (evolução mensal)
  const chartData = useMemo(() => {
    if (!multiMesDados) return [];
    return multiMesDados.filter(Boolean).map((mes: any) => {
      const point: Record<string, any> = { label: mes.label, mes: mes.mes, ano: mes.ano };
      for (const v of (mes.porVendedor ?? [])) {
        if (v.vendedor) point[v.vendedor] = Number(v[indicadorKey] ?? 0);
      }
      return point;
    });
  }, [multiMesDados, indicadorKey]);

  // Ranking: acumulado dos últimos 12 meses por vendedor (apenas os 3 permitidos)
  const rankingData = useMemo(() => {
    if (!multiMesDados || multiMesDados.length === 0) return [];
    const totais: Record<string, number[]> = {};
    for (const mes of multiMesDados) {
      if (!mes) continue;
      for (const v of (mes.porVendedor ?? [])) {
        if (!v.vendedor || v.vendedor === "Sem Vendedor") continue;
        const nomeNorm = String(v.vendedor).toLowerCase();
        const permitido = VENDEDORES_PERMITIDOS.some(p =>
          nomeNorm.includes(p.split(" ")[0].toLowerCase())
        );
        if (!permitido) continue;
        if (!totais[v.vendedor]) totais[v.vendedor] = [];
        totais[v.vendedor].push(Number((v as any)[indicadorKey] ?? 0));
      }
    }
    const result = Object.entries(totais).map(([vendedor, vals]) => {
      const total = vals.reduce((a, b) => a + b, 0);
      const media = vals.length > 0 ? total / vals.length : 0;
      const mesesComDados = vals.filter(v => v > 0).length;
      return { vendedor, total, media, mesesComDados, meses: vals.length };
    });
    // Ordenar por total (ou média para percentuais)
    return result.sort((a, b) => {
      const va = indicador.isPct ? a.media : a.total;
      const vb = indicador.isPct ? b.media : b.total;
      return vb - va;
    });
  }, [multiMesDados, indicadorKey, indicador.isPct]);

  // Último mês completo e mês anterior para comparação
  const ultimoMes = useMemo(() => {
    if (!multiMesDados || multiMesDados.length === 0) return null;
    return multiMesDados[multiMesDados.length - 1] ?? null;
  }, [multiMesDados]);

  const penultimoMes = useMemo(() => {
    if (!multiMesDados || multiMesDados.length < 2) return null;
    return multiMesDados[multiMesDados.length - 2] ?? null;
  }, [multiMesDados]);

  // Meta do indicador
  const metaValor = useMemo(() => {
    if (!metaGeral) return null;
    const metaMap: Record<string, string> = {
      cotacoes: "metaCotacoes", osGeradas: "metaOsGeradas", faturamento: "metaFaturamento",
      taxaConversao: "metaConversao", taxaFaturamento: "metaTaxaFaturamento",
      ticketMedio: "metaTicketMedio", valorOrcado: "metaValorOrcado",
    };
    const campo = metaMap[indicadorKey];
    if (!campo) return null;
    const val = metaGeral[campo];
    return val ? Number(val) : null;
  }, [metaGeral, indicadorKey]);

  const formatYAxis = (v: number) => {
    if (indicador.isCurrency) {
      if (v >= 1000000) return `R$${(v / 1000000).toFixed(1)}M`;
      if (v >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
      return `R$${v}`;
    }
    if (indicador.isPct) return `${v}%`;
    return String(v);
  };

  const vendedoresParaGrafico = vendedorFoco ? [vendedorFoco] : todosVendedores;
  const maxRanking = rankingData.length > 0
    ? (indicador.isPct ? rankingData[0].media : rankingData[0].total)
    : 1;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Carregando evolução dos últimos 12 meses...</p>
        </div>
      </div>
    );
  }

  if (!multiMesDados || multiMesDados.filter(Boolean).length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Sem dados disponíveis para o período selecionado.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho de controles ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-end gap-4 justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-500" />
              Evolução por Vendedor
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Últimos 12 meses completos · excluindo mês atual</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Indicador</label>
              <Select value={indicadorKey} onValueChange={(v) => { setIndicadorKey(v); setVendedorFoco(null); }}>
                <SelectTrigger className="w-52 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDICADORES.map(ind => (
                    <SelectItem key={ind.key} value={ind.key}>{ind.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Foco</label>
              <Select value={vendedorFoco ?? "__todos__"} onValueChange={v => setVendedorFoco(v === "__todos__" ? null : v)}>
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos os vendedores</SelectItem>
                  {todosVendedores.map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {metaValor && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Meta Mensal</label>
                <Badge variant="outline" className="border-indigo-300 text-indigo-700 bg-indigo-50 text-xs font-mono h-8 px-3">
                  {indicador.fmt(metaValor)}
                </Badge>
              </div>
            )}
            {/* Badge de status da fonte dos dados */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Fonte</label>
              {fonteStatus === 'congelado' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200 h-8">
                  🔒 CONGELADO
                </span>
              )}
              {fonteStatus === 'auditado' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200 h-8">
                  ✅ AUDITADO
                </span>
              )}
              {fonteStatus === 'tempo-real' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200 h-8">
                  ⚡ TEMPO REAL
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Layout principal: Ranking + Gráfico ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Ranking lateral */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-700">Ranking — {indicador.label}</h3>
          </div>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">
            {indicador.isPct ? "Média dos 12 meses" : "Acumulado 12 meses"}
          </p>
          <div className="space-y-3">
            {rankingData.map((item, idx) => {
              const valor = indicador.isPct ? item.media : item.total;
              const pct = maxRanking > 0 ? (valor / maxRanking) * 100 : 0;
              const cor = CORES_VENDEDORES[todosVendedores.indexOf(item.vendedor) % CORES_VENDEDORES.length];
              const isFoco = vendedorFoco === item.vendedor;
              const ultimoMesV = ultimoMes?.porVendedor?.find((v: any) => v.vendedor === item.vendedor);
              const penultimoMesV = penultimoMes?.porVendedor?.find((v: any) => v.vendedor === item.vendedor);
              const valorUltimo = ultimoMesV ? Number((ultimoMesV as any)[indicadorKey] ?? 0) : 0;
              const valorPenultimo = penultimoMesV ? Number((penultimoMesV as any)[indicadorKey] ?? 0) : 0;
              const delta = valorPenultimo > 0 ? ((valorUltimo - valorPenultimo) / valorPenultimo) * 100 : 0;

              return (
                <button
                  key={item.vendedor}
                  onClick={() => setVendedorFoco(isFoco ? null : item.vendedor)}
                  className={`w-full text-left rounded-lg p-3 transition-all border ${
                    isFoco
                      ? "border-blue-300 bg-blue-50"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold w-5 text-center ${idx === 0 ? "text-amber-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-amber-700" : "text-slate-400"}`}>
                        {idx + 1}º
                      </span>
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[120px]" title={item.vendedor}>
                        {item.vendedor}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {delta !== 0 && (
                        <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${delta > 0 ? "text-green-600" : "text-red-500"}`}>
                          {delta > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {Math.abs(delta).toFixed(0)}%
                        </span>
                      )}
                      <span className="text-xs font-bold text-slate-800">{indicador.fmt(valor)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%`, background: cor }}
                    />
                  </div>
                  {ultimoMesV && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Último mês: <span className="font-semibold text-slate-600">{indicador.fmt(valorUltimo)}</span>
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Gráfico de linha */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-700">{indicador.label} — Evolução Mensal</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {vendedorFoco ? `Foco: ${vendedorFoco}` : `${vendedoresParaGrafico.length} vendedores`}
              </p>
            </div>
            {metaValor && (
              <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 font-mono">
                Meta: {indicador.fmt(metaValor)}
              </span>
            )}
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={formatYAxis}
                domain={indicador.domain as any ?? ["auto", "auto"]}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip indicador={indicadorKey} />} />
              {!vendedorFoco && (
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value: string) => value.length > 18 ? value.substring(0, 16) + "…" : value}
                />
              )}
              {metaValor && (
                <ReferenceLine
                  y={metaValor}
                  stroke="#6366f1"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{ value: `Meta`, position: "insideTopRight", fontSize: 10, fill: "#6366f1" }}
                />
              )}
              {vendedoresParaGrafico.map((vendedor) => {
                const idx = todosVendedores.indexOf(vendedor);
                const cor = CORES_VENDEDORES[idx % CORES_VENDEDORES.length];
                return (
                  <Line
                    key={vendedor}
                    type="monotone"
                    dataKey={vendedor}
                    name={vendedor}
                    stroke={cor}
                    strokeWidth={vendedorFoco ? 3 : 2}
                    dot={vendedorFoco ? { r: 5, fill: cor, strokeWidth: 2, stroke: "#fff" } : { r: 3 }}
                    activeDot={{ r: 7 }}
                    connectNulls={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Tabela de comparação mensal com heatmap ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-700">Comparativo Mensal — {indicador.label}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Intensidade de cor indica desempenho relativo</p>
          </div>
          {metaValor && (
            <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-2 py-1 font-mono">
              Meta: {indicador.fmt(metaValor)}
            </span>
          )}
        </div>
        <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-slate-50 min-w-[140px]">
                  Vendedor
                </TableHead>
                {chartData.map((d, i) => (
                  <TableHead key={i} className="text-right min-w-[70px]">
                    {d.label}
                  </TableHead>
                ))}
                <TableHead className="text-right bg-amber-50 min-w-[80px]">
                  Média
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(vendedorFoco ? rankingData.filter(r => r.vendedor === vendedorFoco) : rankingData).map((item, idx) => {
                const cor = CORES_VENDEDORES[todosVendedores.indexOf(item.vendedor) % CORES_VENDEDORES.length];
                const valores = chartData.map(d => d[item.vendedor] != null ? Number(d[item.vendedor]) : null);
                const valoresValidos = valores.filter(v => v !== null) as number[];
                const media = valoresValidos.length > 0
                  ? valoresValidos.reduce((a, b) => a + b, 0) / valoresValidos.length
                  : null;
                const maxVal = Math.max(...valoresValidos, 0.01);
                const minVal = Math.min(...valoresValidos.filter(v => v > 0), maxVal);

                return (
                  <TableRow key={item.vendedor}>
                    <TableCell className="sticky left-0 bg-white">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cor }} />
                        <span className="font-semibold text-slate-700 truncate max-w-[120px]" title={item.vendedor}>
                          {item.vendedor}
                        </span>
                      </div>
                    </TableCell>
                    {valores.map((v, i) => {
                      if (v === null) return (
                        <TableCell key={i} className="text-right text-slate-300">—</TableCell>
                      );
                      // Heatmap: intensidade proporcional ao valor
                      const intensity = maxVal > minVal ? (v - minVal) / (maxVal - minVal) : 0.5;
                      const bgAlpha = Math.round(intensity * 40);
                      const isMelhor = v === maxVal;
                      const isPiorPositivo = v === minVal && v > 0;
                      const atingiuMeta = metaValor !== null && v >= metaValor;
                      return (
                        <TableCell
                          key={i}
                          className="text-right font-mono"
                          style={{
                            background: isMelhor
                              ? `${cor}22`
                              : `rgba(0,0,0,${bgAlpha / 1000})`,
                            color: isMelhor ? cor : "#475569",
                            fontWeight: isMelhor ? 700 : 400,
                          }}
                        >
                          {indicador.fmt(v)}
                          {atingiuMeta && <span className="ml-1 text-[9px] text-green-500">✓</span>}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-mono font-bold text-amber-700 bg-amber-50">
                      {media !== null ? indicador.fmt(media) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold text-slate-600 sticky left-0 bg-slate-100">
                  Total / Média
                </TableCell>
                {chartData.map((d, i) => {
                  const vals = todosVendedores
                    .map(v => d[v] != null ? Number(d[v]) : null)
                    .filter(v => v !== null) as number[];
                  const agg = vals.length > 0
                    ? indicador.isPct
                      ? vals.reduce((a, b) => a + b, 0) / vals.length
                      : vals.reduce((a, b) => a + b, 0)
                    : null;
                  return (
                    <TableCell key={i} className="text-right font-mono font-semibold text-slate-700">
                      {agg !== null ? indicador.fmt(agg) : "—"}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right font-mono font-bold text-amber-800 bg-amber-50">
                  {(() => {
                    const allVals = rankingData.map(r => indicador.isPct ? r.media : r.total).filter(v => v > 0);
                    const agg = allVals.length > 0
                      ? indicador.isPct
                        ? allVals.reduce((a, b) => a + b, 0) / allVals.length
                        : allVals.reduce((a, b) => a + b, 0)
                      : null;
                    return agg !== null ? indicador.fmt(agg) : "—";
                  })()}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
      </div>

    </div>
  );
}
