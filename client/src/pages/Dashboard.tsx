import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import DashboardLayout from "../components/DashboardLayout";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ComposedChart
} from "recharts";
import FilterBar, { FilterState } from "@/components/FilterBar";
import { AlertTriangle, BarChart3, DollarSign, Package, Percent, TrendingDown, TrendingUp, Wrench, PlusCircle, X, ShoppingCart, CalendarDays, Clock, Tag, ChevronRight } from "lucide-react";
import { ErrorCodeBadge, useErrorMap } from "@/components/ErrorCodeBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useLocation } from "wouter";
import CnqPanel from "@/components/CnqPanel";

const COLORS = ["#1e6fd9", "#0ea5e9", "#22c55e", "#f97316", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#eab308"];

function KpiCard({ label, value, sub, icon: Icon, color, accent }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string; accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 relative overflow-hidden">
      {accent && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-slate-500">{label}</p>
          <p className="text-2xl font-bold metric-value" style={{ color }}>{value}</p>
          {sub && <p className="text-xs mt-1 text-slate-400">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-lg" style={{ background: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg p-3 text-xs bg-white border border-slate-200 shadow-lg">
      <p className="font-bold mb-1 text-slate-700">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === "number" && p.name?.includes("R$") ? `R$ ${p.value.toFixed(2)}` : p.value}</p>
      ))}
    </div>
  );
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<FilterState>({});
  const [showFatModal, setShowFatModal] = useState(false);
  const [fatForm, setFatForm] = useState({ mes: "", ano: new Date().getFullYear(), valorFaturado: "", totalPedidos: "" });

  const { data: kpis } = trpc.dashboard.kpis.useQuery(filter);
  const { data: diario } = trpc.dashboard.retrabalhosDodia.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: bySetor } = trpc.dashboard.bySetor.useQuery(filter);
  const { data: byErro } = trpc.dashboard.byCodigoErro.useQuery(filter);
  const { data: byResp } = trpc.dashboard.byResponsavel.useQuery(filter);
  const { data: evolucao } = trpc.dashboard.evolucaoMensal.useQuery();
  const { data: faturamentoData } = trpc.faturamento.list.useQuery();
  const errorMap = useErrorMap();
  const utils = trpc.useUtils();
  const upsertFat = trpc.faturamento.upsert.useMutation({
    onSuccess: () => {
      toast.success("Dados de faturamento salvos!");
      utils.faturamento.list.invalidate();
      setShowFatModal(false);
      setFatForm({ mes: "", ano: new Date().getFullYear(), valorFaturado: "", totalPedidos: "" });
    },
    onError: (e) => toast.error(e.message || "Erro ao salvar"),
  });

  const pieData = kpis ? [
    { name: "Evitável", value: kpis.evitavel },
    { name: "Inevitável", value: kpis.inevitavel },
  ] : [];

  // KPIs de faturamento por mês
  const faturamentoMap = useMemo(() => {
    const m = new Map<string, { valorFaturado: number; totalPedidos: number }>();
    for (const f of faturamentoData ?? []) {
      // normalizar chave para maiúsculas para cruzar com evolucao.mesCompleto
      m.set((f.mes ?? '').toUpperCase(), { valorFaturado: Number(f.valorFaturado), totalPedidos: f.totalPedidos });
    }
    return m;
  }, [faturamentoData]);

  // Calcular % retrabalho sobre faturamento (apenas meses com faturamento)
  const pctFaturamento = useMemo(() => {
    if (!evolucao || !faturamentoData?.length) return null;
    let totalFat = 0, totalCusto = 0;
    for (const ev of evolucao) {
      // usar mesCompleto (maiúsculas) para cruzar com faturamentoMap
      const chave = ((ev as { mesCompleto?: string }).mesCompleto ?? ev.mes ?? '').toUpperCase();
      const fat = chave ? faturamentoMap.get(chave) : undefined;
      if (fat) { totalFat += fat.valorFaturado; totalCusto += Number(ev.custo ?? 0); }
    }
    return totalFat > 0 ? ((totalCusto / totalFat) * 100).toFixed(2) : null;
  }, [evolucao, faturamentoMap, faturamentoData]);

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">Sistema de Controle</p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Painel de Retrabalhos e Custos da Não-Qualidade (CNQ)</h1>
          <p className="text-sm mt-0.5 text-slate-500">
            Monitoramento em tempo real — Retrabalhos e CNQ
          </p>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-xs font-mono text-slate-400">Jan – Abr 2026</p>
          <p className="text-xs text-slate-400">Dados históricos carregados</p>
        </div>
      </div>

      {/* ── RETRABALHOS DO DIA E DO DIA ANTERIOR ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hoje */}
        <div className="bg-white rounded-xl border-2 border-red-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-red-50">
                <CalendarDays className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Retrabalhos e CNQ de Hoje</p>
                <p className="text-xs text-slate-400">
                  {diario?.dataHoje ? new Date(diario.dataHoje).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "—"}
                </p>
              </div>
            </div>
            <span className="text-3xl font-bold text-red-600">{diario?.hoje?.length ?? 0}</span>
          </div>
          {!diario?.hoje?.length ? (
            <div className="text-center py-6 text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum retrabalho ou CNQ registrado hoje.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {diario.hoje.map((r: any) => (
                <div
                  key={r.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg bg-red-50 border border-red-100 cursor-pointer hover:bg-red-100 hover:border-red-300 transition-colors"
                  onClick={() => navigate(`/relatorio?os=${encodeURIComponent(r.osRetrabalhada)}`)}
                  title={`Ver relatório da OS ${r.osRetrabalhada}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-slate-700">OS {r.osRetrabalhada}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        r.classe === "EVITÁVEL" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}>{r.classe}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.tipo}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{r.setor}{r.responsavel ? ` • ${r.responsavel}` : ""}</p>
                    {r.descricao && <p className="text-xs text-slate-400 mt-0.5 truncate">{r.descricao}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-red-700">R$ {Number(r.total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-slate-400">{new Date(r.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {(diario?.hoje?.length ?? 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-red-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Custo total do dia</span>
              <span className="text-sm font-bold text-red-700">
                R$ {diario!.hoje.reduce((s: number, r: any) => s + Number(r.total ?? 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
        {/* Ontem */}
        <div className="bg-white rounded-xl border-2 border-amber-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-50">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Retrabalhos e CNQ de Ontem</p>
                <p className="text-xs text-slate-400">
                  {diario?.dataOntem ? new Date(diario.dataOntem).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "—"}
                </p>
              </div>
            </div>
            <span className="text-3xl font-bold text-amber-600">{diario?.ontem?.length ?? 0}</span>
          </div>
          {!diario?.ontem?.length ? (
            <div className="text-center py-6 text-slate-400">
              <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum retrabalho ou CNQ registrado ontem.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {diario.ontem.map((r: any) => (
                <div
                  key={r.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg bg-amber-50 border border-amber-100 cursor-pointer hover:bg-amber-100 hover:border-amber-300 transition-colors"
                  onClick={() => navigate(`/relatorio?os=${encodeURIComponent(r.osRetrabalhada)}`)}
                  title={`Ver relatório da OS ${r.osRetrabalhada}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-slate-700">OS {r.osRetrabalhada}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        r.classe === "EVITÁVEL" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}>{r.classe}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.tipo}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{r.setor}{r.responsavel ? ` • ${r.responsavel}` : ""}</p>
                    {r.descricao && <p className="text-xs text-slate-400 mt-0.5 truncate">{r.descricao}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-amber-700">R$ {Number(r.total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-slate-400">{new Date(r.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {(diario?.ontem?.length ?? 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Custo total do dia anterior</span>
              <span className="text-sm font-bold text-amber-700">
                R$ {diario!.ontem.reduce((s: number, r: any) => s + Number(r.total ?? 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <FilterBar filter={filter} onChange={setFilter} />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        <KpiCard label="Total de Retrabalhos" value={String(kpis?.totalRetrabalhos ?? 0)} icon={Wrench} color="#1e6fd9" accent />
        <KpiCard label="Total de CNQ" value={String(kpis?.totalCnq ?? 0)} icon={AlertTriangle} color="#f59e0b" accent />
        <KpiCard label="Custo Total" value={`R$ ${(kpis?.custoTotal ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={DollarSign} color="#ef4444" accent />
        <KpiCard label="Custo Médio" value={`R$ ${(kpis?.custoMedio ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={BarChart3} color="#f97316" accent />
        <KpiCard label="Horas de Impacto" value={`${(kpis?.horasTotal ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 1 })}h`} sub="Total de horas impactadas" icon={Clock} color="#7c3aed" accent />
        <KpiCard label="Evitáveis" value={`${kpis?.pctEvitavel ?? 0}%`} sub={`${kpis?.evitavel ?? 0} de ${(kpis?.totalRetrabalhos ?? 0) + (kpis?.totalCnq ?? 0)}`} icon={AlertTriangle} color="#dc2626" accent />
        <KpiCard label="% do Faturamento" value={pctFaturamento ? `${pctFaturamento}%` : "—"} sub={pctFaturamento ? "Custo retrabalho/fat." : "Dados parciais"} icon={Percent} color="#8b5cf6" accent />
        {/* Indicador Pedidos vs Retrabalhos */}
        {(() => {
          const totalPedidos = faturamentoData?.reduce((s, f) => s + f.totalPedidos, 0) ?? 0;
          const totalRetrab = (kpis?.totalRetrabalhos ?? 0) + (kpis?.totalCnq ?? 0);
          const taxa = totalPedidos > 0 ? ((totalRetrab / totalPedidos) * 100).toFixed(1) : null;
          return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, #0ea5e9, transparent)" }} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-slate-500">Pedidos vs Retrab.</p>
                  <p className="text-2xl font-bold" style={{ color: "#0ea5e9" }}>{totalPedidos > 0 ? totalPedidos : "—"}</p>
                  <p className="text-xs mt-1 text-slate-400">
                    {taxa ? <>{totalRetrab} retrab. • <span className={Number(taxa) > 5 ? "text-red-500 font-semibold" : "text-green-600 font-semibold"}>{taxa}%</span></> : "Sem dados de pedidos"}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg" style={{ background: "#0ea5e915" }}>
                  <ShoppingCart className="w-5 h-5" style={{ color: "#0ea5e9" }} />
                </div>
              </div>
              {totalPedidos > 0 && (
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(Number(taxa) * 5, 100)}%`, background: Number(taxa ?? 0) > 5 ? "#ef4444" : "#22c55e" }} />
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Botão de Alimentação Mensal */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setShowFatModal(true)} className="gap-2 text-xs">
          <PlusCircle className="w-3.5 h-3.5" />
          Alimentar Faturamento / Pedidos
        </Button>
      </div>

      {/* Modal de Alimentação Mensal */}
      <Dialog open={showFatModal} onOpenChange={setShowFatModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alimentar Dados Mensais</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Mês</Label>
                <select
                  className="w-full mt-1 border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={fatForm.mes}
                  onChange={e => setFatForm(f => ({ ...f, mes: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Ano</Label>
                <Input
                  type="number"
                  className="mt-1"
                  value={fatForm.ano}
                  onChange={e => setFatForm(f => ({ ...f, ano: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Faturamento Total (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Ex: 329.049,72"
                className="mt-1"
                value={fatForm.valorFaturado}
                onChange={e => {
                  // Permite apenas dígitos, ponto e vírgula
                  const raw = e.target.value.replace(/[^0-9.,]/g, "");
                  setFatForm(f => ({ ...f, valorFaturado: raw }));
                }}
              />
              <p className="text-xs text-slate-400 mt-1">Use vírgula como separador decimal (ex: 329.049,72)</p>
            </div>
            <div>
              <Label className="text-xs">Número Total de Pedidos (OS)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Ex: 195"
                className="mt-1"
                value={fatForm.totalPedidos}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  setFatForm(f => ({ ...f, totalPedidos: raw }));
                }}
              />
            </div>
            {fatForm.valorFaturado && fatForm.totalPedidos && Number(fatForm.totalPedidos) > 0 && (() => {
              const fat = Number(fatForm.valorFaturado.replace(/\./g, "").replace(",", "."));
              const pedidos = Number(fatForm.totalPedidos);
              const ticket = fat > 0 && pedidos > 0 ? fat / pedidos : 0;
              return ticket > 0 ? (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs text-blue-600 font-semibold">Ticket Médio calculado: <span className="font-bold">R$ {ticket.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                </div>
              ) : null;
            })()}
            {faturamentoData && faturamentoData.length > 0 && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Dados já cadastrados</p>
                <div className="space-y-1">
                  {faturamentoData.map(f => {
                    const fat = Number(f.valorFaturado);
                    const ticket = f.totalPedidos > 0 ? fat / f.totalPedidos : 0;
                    return (
                      <div key={`${f.mes}-${f.ano}`} className="text-xs border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                        <div className="flex justify-between">
                          <span className="text-slate-600 font-medium">{f.mes} {f.ano}</span>
                          <span className="text-slate-500">{f.totalPedidos} OS</span>
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-slate-400">Fat: R$ {fat.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          {ticket > 0 && <span className="text-blue-600 font-semibold">Ticket: R$ {ticket.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFatModal(false)}>Cancelar</Button>
            <Button
              disabled={!fatForm.mes || !fatForm.valorFaturado || !fatForm.totalPedidos || upsertFat.isPending}
              onClick={() => {
                // Converte formato BR (329.049,72) para número (329049.72)
                const valorNumerico = Number(
                  fatForm.valorFaturado
                    .replace(/\./g, "")   // remove separadores de milhar
                    .replace(",", ".")    // troca vírgula decimal por ponto
                );
                if (isNaN(valorNumerico) || valorNumerico <= 0) {
                  toast.error("Valor de faturamento inválido. Use o formato: 329.049,72");
                  return;
                }
                upsertFat.mutate({
                  mes: fatForm.mes,
                  ano: fatForm.ano,
                  valorFaturado: valorNumerico,
                  totalPedidos: Number(fatForm.totalPedidos),
                });
              }}
            >
              {upsertFat.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Faturamento mensal + % retrabalho */}
      {faturamentoData && faturamentoData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Faturamento Mensal vs Custo de Retrabalho</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {faturamentoData.map(f => {
              const ev = evolucao?.find(e => (e.mesCompleto ?? e.mes).toUpperCase() === (f.mes ?? '').toUpperCase());
              const custo = Number(ev?.custo ?? 0);
              const fat = Number(f.valorFaturado);
              const pct = fat > 0 ? ((custo / fat) * 100).toFixed(2) : "0.00";
              return (
                <div key={f.mes} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">{f.mes}</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Faturamento</span>
                      <span className="font-mono font-semibold text-slate-800">R$ {fat.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Pedidos</span>
                      <span className="font-mono font-semibold text-slate-800">{f.totalPedidos}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Retrabalhos</span>
                      <span className="font-mono font-semibold text-orange-600">{ev?.count ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">% Retrab./Pedidos</span>
                      {(() => {
                        const qtdRetrab = ev?.count ?? 0;
                        const pctRetrab = f.totalPedidos > 0 ? ((qtdRetrab / f.totalPedidos) * 100) : 0;
                        return (
                          <span className={`font-mono font-semibold ${pctRetrab > 10 ? "text-red-600" : pctRetrab > 5 ? "text-amber-600" : "text-green-600"}`}>
                            {f.totalPedidos > 0 ? pctRetrab.toFixed(1) + "%" : "—"}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Custo Retrabalho</span>
                      <span className="font-mono font-semibold text-red-600">R$ {custo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="font-semibold text-slate-600">% do Faturamento</span>
                      <span className={`font-mono font-bold ${Number(pct) > 2 ? "text-red-600" : Number(pct) > 1 ? "text-amber-600" : "text-green-600"}`}>{pct}%</span>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(Number(pct) * 20, 100)}%`, background: Number(pct) > 2 ? "#ef4444" : Number(pct) > 1 ? "#f97316" : "#22c55e" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Evitável vs Inevitável bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Classificação de Retrabalhos</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1 text-slate-500">
              <span>Evitável — {kpis?.pctEvitavel ?? 0}%</span>
              <span>Inevitável — {kpis?.pctInevitavel ?? 0}%</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden bg-slate-100">
              <div className="h-full rounded-full transition-all" style={{ width: `${kpis?.pctEvitavel ?? 0}%`, background: "linear-gradient(90deg, #ef4444, #f97316)" }} />
            </div>
          </div>
          <div className="flex gap-3 text-xs shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-400" />
              <span className="text-slate-600">Evitável: {kpis?.evitavel ?? 0}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
              <span className="text-slate-600">Inevitável: {kpis?.inevitavel ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolução Mensal — redesenhado */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Evolução Mensal — Custo de Retrabalho</p>
              <p className="text-xs text-slate-400 mt-0.5">Custo total e quantidade de ocorrências por mês</p>
            </div>
            {evolucao && evolucao.length > 0 && (() => {
              const total = evolucao.reduce((s: number, e: any) => s + Number(e.custo ?? 0), 0);
              return <span className="text-sm font-bold text-red-600">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>;
            })()}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={evolucao ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => v?.substring(0, 3)} axisLine={false} tickLine={false} />
              <YAxis yAxisId="custo" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={42} />
              <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg p-3 text-xs bg-white border border-slate-200 shadow-lg min-w-[160px]">
                    <p className="font-bold mb-2 text-slate-700">{label}</p>
                    {payload.map((p: any, i: number) => (
                      <div key={i} className="flex justify-between gap-4 mb-0.5">
                        <span style={{ color: p.color }}>{p.name}</span>
                        <span className="font-semibold" style={{ color: p.color }}>
                          {p.name === "Custo (R$)" ? `R$ ${Number(p.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : p.value}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }} />
              <Bar yAxisId="count" dataKey="count" name="Ocorrências" fill="#fca5a5" radius={[3, 3, 0, 0]} opacity={0.7} />
              <Line yAxisId="custo" type="monotone" dataKey="custo" name="Custo (R$)" stroke="#ef4444" strokeWidth={2.5} dot={{ fill: "#ef4444", r: 4, strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
          {/* Legenda manual */}
          <div className="flex gap-4 mt-2 justify-end">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-3 h-3 rounded-sm bg-red-200" />
              <span>Ocorrências</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-6 h-0.5 bg-red-500" />
              <span>Custo (R$)</span>
            </div>
          </div>
        </div>

        {/* Por Setor */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4 text-slate-500">
            Retrabalhos por Setor
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bySetor ?? []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="setor" tick={{ fontSize: 10 }} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Ocorrências" radius={[0, 3, 3, 0]}>
                {(bySetor ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ═══ PAINEL CNQ — Custos da Não-Qualidade ═══ */}
      <CnqPanel filter={filter} kpisRetrabalho={kpis} />

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Erros */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4 text-slate-500">
            Ranking dos Erros Mais Frequentes
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={(byErro ?? []).slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="codigoErro" tick={{ fontSize: 10 }} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Ocorrências" fill="#1e6fd9" radius={[0, 3, 3, 0]}>
                {(byErro ?? []).slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Evitável */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4 text-slate-500">
            Evitável vs Inevitável
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                <Cell fill="#ff6b6b" />
                <Cell fill="#ffb74d" />
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tipo Interno/Externo */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4 text-slate-500">
          Distribuição por Tipo (Interno vs Externo)
        </p>
        <div className="grid grid-cols-2 gap-4">
          {[{ tipo: "INTERNO", color: "#5ba3f5" }, { tipo: "EXTERNO", color: "#00d4ff" }].map(({ tipo, color }) => {
            // Approximate from kpis using filter
            const isInterno = tipo === "INTERNO";
            return (
              <div key={tipo} className="p-4 rounded-md"
                style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color }}>{tipo}</p>
                <p className="text-2xl font-bold metric-value" style={{ color }}>
                  {filter.tipo === tipo ? kpis?.total ?? 0 : "—"}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--bp-text-dim)" }}>
                  {filter.tipo === tipo ? `R$ ${(kpis?.custoTotal ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` : "Use filtro Tipo para ver dados"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Responsáveis */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4 text-slate-500">
          Retrabalhos por Responsável
        </p>
        <div className="space-y-2">
          {(byResp ?? []).filter(r => r.responsavel).slice(0, 8).map((r, i) => {
            const max = byResp?.[0]?.count ?? 1;
            const pct = Math.round((r.count / max) * 100);
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs w-24 sm:w-28 truncate shrink-0 text-slate-600">{r.responsavel}</span>
                <div className="flex-1 h-5 rounded overflow-hidden bg-slate-100">
                  <div className="h-full rounded flex items-center px-2 transition-all"
                    style={{ width: `${pct}%`, background: `${COLORS[i % COLORS.length]}25`, borderLeft: `2px solid ${COLORS[i % COLORS.length]}` }}>
                  </div>
                </div>
                <span className="text-xs font-mono w-8 text-right shrink-0 text-slate-800 font-semibold">{r.count}</span>
                <span className="text-xs w-16 sm:w-20 text-right shrink-0 text-slate-500 hidden xs:block">
                  R$ {Number(r.custo).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
    </DashboardLayout>
  );
}
