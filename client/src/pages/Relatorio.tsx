import { trpc } from "@/lib/trpc";
import DashboardLayout from "../components/DashboardLayout";
import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import FilterBar, { FilterState } from "@/components/FilterBar";
import { Download, Pencil, Check, X, FileText } from "lucide-react";
import { exportarRelatorioPDF } from "@/lib/exportarRelatorioPDF";
import { Button } from "@/components/ui/button";
import { ErrorCodeBadge, useErrorMap } from "@/components/ErrorCodeBadge";
import { toast } from "sonner";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Paleta de cores para as categorias
const CATEGORY_COLORS: Record<string, string> = {
  "SOLDA":       "#f97316",
  "PINTURA":     "#a855f7",
  "EXPEDIÇÃO":   "#3b82f6",
  "PROJETO":     "#6366f1",
  "FIBRA":       "#22c55e",
  "ROUTER":      "#06b6d4",
  "CO2":         "#ef4444",
  "DOBRADEIRA":  "#eab308",
  "FORNECEDOR":  "#14b8a6",
  "TRANSPORTE":  "#0ea5e9",
  "INSTALAÇÃO":  "#84cc16",
  "VENDAS":      "#fb923c",
  "POLIMENTO":   "#94a3b8",
  "OUTROS":      "#64748b",
};

const COLOR_FALLBACKS = [
  "#3b82f6","#ef4444","#22c55e","#f97316","#a855f7",
  "#06b6d4","#eab308","#14b8a6","#6366f1","#84cc16",
  "#fb923c","#94a3b8","#0ea5e9","#64748b","#ec4899",
];

function getCategoryColor(cat: string | null, idx: number): string {
  if (!cat) return COLOR_FALLBACKS[idx % COLOR_FALLBACKS.length];
  return CATEGORY_COLORS[cat] ?? COLOR_FALLBACKS[idx % COLOR_FALLBACKS.length];
}

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

// Tooltip customizado para o gráfico de pizza
function CustomPieTooltip({ active, payload, type }: { active?: boolean; payload?: any[]; type: "count" | "cost" }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-slate-800">{d.name ?? "Sem categoria"}</p>
      {type === "count" ? (
        <p className="text-blue-600 font-bold">{d.value} retrabalhos ({d.payload.pct}%)</p>
      ) : (
        <p className="text-red-600 font-bold">{formatCurrency(d.value)} ({d.payload.pct}%)</p>
      )}
    </div>
  );
}

// Label customizado dentro da fatia
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, pct }: any) {
  if (pct < 4) return null; // não mostra label em fatias muito pequenas
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {pct}%
    </text>
  );
}

type ReportTab = "retrabalho" | "cnq" | "ambos";

export default function Relatorio() {
  const searchStr = useSearch();
  const osParam = useMemo(() => new URLSearchParams(searchStr).get("os") ?? "", [searchStr]);

  const [reportTab, setReportTab] = useState<ReportTab>("ambos");
  const [filter, setFilter] = useState<FilterState>({});
  const [search, setSearch] = useState(osParam);

  // Quando chega com ?os=XXXX, pré-preenche a busca e rola para o topo
  useEffect(() => {
    if (osParam) {
      setSearch(osParam);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [osParam]);

  const utils = trpc.useUtils();
  const queryFilter = {
    ...filter,
    search: search || undefined,
    ...(reportTab !== "ambos" ? { tipoRegistro: reportTab } : {}),
  };
  const { data: all, isLoading } = trpc.retrabalhos.all.useQuery(queryFilter);
  const { data: distinct } = trpc.dashboard.distinctValues.useQuery();
  const updateRetrabalho = trpc.retrabalhos.update.useMutation({
    onSuccess: () => {
      utils.retrabalhos.all.invalidate();
      toast.success("Registro atualizado!");
      setEditingId(null);
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  type EditForm = {
    osRetrabalhada: string; osOriginal: string; data: string;
    setor: string; tipo: "INTERNO" | "EXTERNO";
    custo: string; frete: string;
    codigoErro: string; responsavel: string; descricao: string;
    classe: "EVITÁVEL" | "INEVITÁVEL"; mes: string;
  };
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  function startEdit(r: typeof rows[0]) {
    setEditingId(r.id);
    setEditForm({
      osRetrabalhada: r.osRetrabalhada ?? "",
      osOriginal: r.osOriginal ?? "",
      data: r.data ? new Date(r.data).toISOString().split("T")[0] : "",
      setor: r.setor ?? "",
      tipo: (r.tipo as "INTERNO" | "EXTERNO") ?? "INTERNO",
      custo: String(r.custo ?? "0"),
      frete: String(r.frete ?? "0"),
      codigoErro: r.codigoErro ?? "",
      responsavel: r.responsavel ?? "",
      descricao: r.descricao ?? "",
      classe: (r.classe as "EVITÁVEL" | "INEVITÁVEL") ?? "EVITÁVEL",
      mes: r.mes ?? "",
    });
  }
  function saveEdit(id: number) {
    if (!editForm) return;
    const total = (parseFloat(editForm.custo.replace(",",".")) || 0) + (parseFloat(editForm.frete.replace(",",".")) || 0);
    updateRetrabalho.mutate({
      id,
      data: {
        osRetrabalhada: editForm.osRetrabalhada,
        osOriginal: editForm.osOriginal,
        data: editForm.data ? new Date(editForm.data) : undefined,
        setor: editForm.setor,
        tipo: editForm.tipo,
        custo: editForm.custo,
        frete: editForm.frete,
        total: String(total.toFixed(2)),
        codigoErro: editForm.codigoErro || null,
        responsavel: editForm.responsavel || null,
        descricao: editForm.descricao || null,
        classe: editForm.classe,
        mes: editForm.mes || null,
      },
    });
  }
  const { data: kpis } = trpc.dashboard.kpis.useQuery(queryFilter);
  const { data: byCategoria } = trpc.dashboard.byCategoria.useQuery(queryFilter as any);
  const errorMap = useErrorMap();

  const rows = all ?? [];

  // Processar dados para os gráficos de pizza
  const { pieCount, pieCost } = useMemo(() => {
    if (!byCategoria || byCategoria.length === 0) return { pieCount: [], pieCost: [] };

    const totalCount = byCategoria.reduce((s, d) => s + Number(d.count), 0);
    const totalCost = byCategoria.reduce((s, d) => s + Number(d.custo), 0);

    const pieCount = byCategoria
      .filter(d => Number(d.count) > 0)
      .map((d, i) => ({
        name: d.categoria ?? "Sem categoria",
        value: Number(d.count),
        pct: totalCount > 0 ? Math.round((Number(d.count) / totalCount) * 100) : 0,
        color: getCategoryColor(d.categoria, i),
      }))
      .sort((a, b) => b.value - a.value);

    const pieCost = byCategoria
      .filter(d => Number(d.custo) > 0)
      .map((d, i) => ({
        name: d.categoria ?? "Sem categoria",
        value: Number(d.custo),
        pct: totalCost > 0 ? Math.round((Number(d.custo) / totalCost) * 100) : 0,
        color: getCategoryColor(d.categoria, i),
      }))
      .sort((a, b) => b.value - a.value);

    return { pieCount, pieCost };
  }, [byCategoria]);

  const exportCSV = () => {
    const headers = ["OS Retrabalhada", "OS Original", "Data", "Setor", "Tipo", "Custo", "Frete", "Total", "Código Erro", "Responsável", "Descrição", "Classe", "Mês"];
    const csvRows = rows.map(r => [
      r.osRetrabalhada, r.osOriginal,
      new Date(r.data).toLocaleDateString("pt-BR"),
      r.setor, r.tipo,
      r.custo ?? "0", r.frete ?? "0", r.total ?? "0",
      r.codigoErro ?? "", r.responsavel ?? "", (r.descricao ?? "").replace(/,/g, ";"),
      r.classe, r.mes ?? ""
    ].join(","));
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `retrabalhos_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">Exportação</p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            {reportTab === "retrabalho" ? "Relatório de Retrabalhos" : reportTab === "cnq" ? "Relatório de CNQ" : "Relatório — Retrabalhos e CNQ"}
          </h1>
          <p className="text-sm mt-0.5 text-slate-500">
            {rows.length} registros encontrados
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              const filtros: string[] = [];
              if (filter.setor) filtros.push(`Setor: ${filter.setor}`);
              if (filter.tipo) filtros.push(`Tipo: ${filter.tipo}`);
              if (filter.classe) filtros.push(`Classe: ${filter.classe}`);
              if (filter.mes) filtros.push(`Mês: ${filter.mes}`);
              if (search) filtros.push(`Busca: ${search}`);
              exportarRelatorioPDF(rows as any, filtros.length > 0 ? filtros.join(" | ") : undefined);
            }}
            className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white border-0"
            size="sm"
            disabled={rows.length === 0}
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
          <Button onClick={exportCSV} className="gap-2 shrink-0" variant="outline" size="sm">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(["ambos", "retrabalho", "cnq"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setReportTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              reportTab === tab
                ? tab === "cnq"
                  ? "bg-white text-amber-700 shadow-sm border border-amber-200"
                  : tab === "retrabalho"
                    ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                    : "bg-white text-slate-700 shadow-sm border border-slate-300"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "ambos" ? "Todos" : tab === "retrabalho" ? "Retrabalhos" : "CNQ"}
          </button>
        ))}
      </div>

      <FilterBar filter={filter} onChange={setFilter} showSearch searchValue={search} onSearchChange={setSearch} />

      {/* Totalizadores */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { label: "Total", value: String(kpis.total), color: "#1e6fd9" },
            { label: "Custo Total", value: `R$ ${kpis.custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "#ef4444" },
            { label: "Frete Total", value: `R$ ${kpis.freteTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "#f97316" },
            { label: "Evitáveis", value: `${kpis.evitavel} (${kpis.pctEvitavel}%)`, color: "#dc2626" },
            { label: "Inevitáveis", value: `${kpis.inevitavel} (${kpis.pctInevitavel}%)`, color: "#d97706" },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 text-center">
              <p className="text-xs uppercase tracking-widest mb-1 text-slate-500">{item.label}</p>
              <p className="text-base font-bold metric-value" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Gráficos de Pizza por Categoria */}
      {(pieCount.length > 0 || pieCost.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pizza: % por número de retrabalhos */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Retrabalhos por Categoria</h2>
            <p className="text-xs text-slate-400 mb-3">% sobre o total de ocorrências</p>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieCount}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  labelLine={false}
                  label={renderPieLabel}
                >
                  {pieCount.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip type="count" />} />
                <Legend
                  formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Tabela resumo */}
            <div className="mt-2 space-y-1">
              {pieCount.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-slate-600">{d.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800">{d.value} <span className="text-slate-400 font-normal">({d.pct}%)</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* Pizza: % por valor do prejuízo */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Prejuízo por Categoria</h2>
            <p className="text-xs text-slate-400 mb-3">% sobre o custo total dos retrabalhos</p>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieCost}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  labelLine={false}
                  label={renderPieLabel}
                >
                  {pieCost.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip type="cost" />} />
                <Legend
                  formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Tabela resumo */}
            <div className="mt-2 space-y-1">
              {pieCost.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-slate-600">{d.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800">{formatCurrency(d.value)} <span className="text-slate-400 font-normal">({d.pct}%)</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="tech-card rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full tech-table">
            <thead>
              <tr>
                <th className="text-left">OS Ret.</th>
                <th className="text-left">OS Ori.</th>
                <th className="text-left">Data</th>
                <th className="text-left">Setor</th>
                <th className="text-left">Tipo</th>
                <th className="text-right">Custo</th>
                <th className="text-right">Frete</th>
                <th className="text-right">Total</th>
                <th className="text-left">Erro</th>
                <th className="text-left">Responsável</th>
                <th className="text-left">Descrição</th>
                <th className="text-left">Classe</th>
                <th className="text-left">Mês</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={14} className="text-center py-8" style={{ color: "var(--bp-text-dim)" }}>Carregando...</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={14} className="text-center py-8" style={{ color: "var(--bp-text-dim)" }}>Nenhum registro encontrado</td></tr>
              )}
              {rows.map(r => {
                const isEditing = editingId === r.id;
                const ef = editForm;
                const inputCls = "w-full border border-blue-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white";
                return isEditing && ef ? (
                  <tr key={r.id} className="bg-blue-50 border-l-2 border-blue-400">
                    <td className="px-1"><input className={inputCls} value={ef.osRetrabalhada} onChange={e => setEditForm({...ef, osRetrabalhada: e.target.value})} placeholder="OS Ret." /></td>
                    <td className="px-1"><input className={inputCls} value={ef.osOriginal} onChange={e => setEditForm({...ef, osOriginal: e.target.value})} placeholder="OS Ori." /></td>
                    <td className="px-1"><input type="date" className={inputCls} value={ef.data} onChange={e => setEditForm({...ef, data: e.target.value})} /></td>
                    <td className="px-1">
                      <select className={inputCls} value={ef.setor} onChange={e => setEditForm({...ef, setor: e.target.value})}>
                        {(distinct?.setores ?? []).map((s: string | null) => <option key={s ?? ""} value={s ?? ""}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-1">
                      <select className={inputCls} value={ef.tipo} onChange={e => setEditForm({...ef, tipo: e.target.value as "INTERNO"|"EXTERNO"})}>
                        <option value="INTERNO">INTERNO</option>
                        <option value="EXTERNO">EXTERNO</option>
                      </select>
                    </td>
                    <td className="px-1"><input className={inputCls + " text-right"} value={ef.custo} onChange={e => setEditForm({...ef, custo: e.target.value})} placeholder="0.00" /></td>
                    <td className="px-1"><input className={inputCls + " text-right"} value={ef.frete} onChange={e => setEditForm({...ef, frete: e.target.value})} placeholder="0.00" /></td>
                    <td className="text-right font-mono text-xs font-bold text-amber-600 px-2">
                      R$ {((parseFloat(ef.custo.replace(",","."))||0)+(parseFloat(ef.frete.replace(",","."))||0)).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                    </td>
                    <td className="px-1">
                      <input className={inputCls} value={ef.codigoErro} onChange={e => setEditForm({...ef, codigoErro: e.target.value})} placeholder="Cód. Erro" />
                    </td>
                    <td className="px-1">
                      <select className={inputCls} value={ef.responsavel} onChange={e => setEditForm({...ef, responsavel: e.target.value})}>
                        <option value="">— sem responsável —</option>
                        {(distinct?.responsaveis ?? []).map((rv: string | null) => <option key={rv ?? ""} value={rv ?? ""}>{rv}</option>)}
                      </select>
                    </td>
                    <td className="px-1"><textarea className={inputCls + " resize-none"} rows={2} value={ef.descricao} onChange={e => setEditForm({...ef, descricao: e.target.value})} placeholder="Descrição" /></td>
                    <td className="px-1">
                      <select className={inputCls} value={ef.classe} onChange={e => setEditForm({...ef, classe: e.target.value as "EVITÁVEL"|"INEVITÁVEL"})}>
                        <option value="EVITÁVEL">EVITÁVEL</option>
                        <option value="INEVITÁVEL">INEVITÁVEL</option>
                      </select>
                    </td>
                    <td className="px-1">
                      <select className={inputCls} value={ef.mes} onChange={e => setEditForm({...ef, mes: e.target.value})}>
                        <option value="">—</option>
                        {["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className="px-1">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => saveEdit(r.id)} className="p-1 rounded bg-green-100 hover:bg-green-200 text-green-700" title="Salvar"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-500" title="Cancelar"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                <tr key={r.id} className="group hover:bg-blue-50/40 transition-colors">
                  <td className="font-mono text-xs font-semibold text-blue-700">{r.osRetrabalhada}</td>
                  <td className="font-mono text-xs text-slate-500">{r.osOriginal}</td>
                  <td className="text-xs">{new Date(r.data).toLocaleDateString("pt-BR")}</td>
                  <td className="text-xs">{r.setor}</td>
                  <td><span className={r.tipo === "INTERNO" ? "badge-interno" : "badge-externo"}>{r.tipo}</span></td>
                  <td className="text-right font-mono text-xs">R$ {Number(r.custo ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="text-right font-mono text-xs">R$ {Number(r.frete ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="text-right font-mono text-xs font-bold text-amber-600">R$ {Number(r.total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td><ErrorCodeBadge code={r.codigoErro} errorMap={errorMap} /></td>
                  <td className="text-xs">{r.responsavel ?? "—"}</td>
                  <td className="text-xs max-w-xs truncate text-slate-500" title={r.descricao ?? ""}>{r.descricao ?? "—"}</td>
                  <td><span className={r.classe === "EVITÁVEL" ? "badge-evitavel" : "badge-inevitavel"}>{r.classe}</span></td>
                  <td className="text-xs text-slate-500">{r.mes ?? "—"}</td>
                  <td className="px-1">
                    <button
                      onClick={() => startEdit(r)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-blue-100 text-blue-500"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50">
                  <td colSpan={5} className="px-3 py-2 text-xs font-bold text-blue-700">
                    TOTAL — {rows.length} registros
                  </td>
                  <td className="text-right px-3 py-2 font-mono text-xs font-bold text-amber-600">
                    R$ {rows.reduce((s, r) => s + Number(r.custo ?? 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right px-3 py-2 font-mono text-xs font-bold text-amber-600">
                    R$ {rows.reduce((s, r) => s + Number(r.frete ?? 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right px-3 py-2 font-mono text-xs font-bold text-red-600">
                    R$ {rows.reduce((s, r) => s + Number(r.total ?? 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
