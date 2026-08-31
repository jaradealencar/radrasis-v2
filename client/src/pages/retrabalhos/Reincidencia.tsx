import { trpc } from "@/lib/trpc";
import { useState } from "react";
import FilterBar, { FilterState } from "@/components/FilterBar";
import { AlertTriangle, TrendingUp, Zap } from "lucide-react";
import { ErrorCodeBadge, useErrorMap } from "@/components/ErrorCodeBadge";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

type TabType = "retrabalho" | "cnq";

export default function Reincidencia() {
  const [activeTab, setActiveTab] = useState<TabType>("retrabalho");
  const [filter, setFilter] = useState<FilterState>({});

  const filterWithType = { ...filter, tipoRegistro: activeTab };

  const { data: reincidencia, isLoading } = trpc.dashboard.reincidencia.useQuery(filterWithType);
  const { data: byResp } = trpc.dashboard.byResponsavel.useQuery(filterWithType);
  const { data: errorLib } = trpc.errorLibrary.list.useQuery();

  const errorMapLookup = errorLib?.reduce((acc, e) => { acc[e.code] = e; return acc; }, {} as Record<string, typeof errorLib[0]>) ?? {};
  const errorMap = useErrorMap();

  const getSeverity = (count: number) => {
    if (count >= 3) return { label: "CRÍTICO", color: "#ff4444", bg: "rgba(255,68,68,0.12)" };
    return { label: "ATENÇÃO", color: "#ff9800", bg: "rgba(255,152,0,0.12)" };
  };

  const tabs: { key: TabType; label: string; color: string }[] = [
    { key: "retrabalho", label: "Retrabalhos", color: "blue" },
    { key: "cnq", label: "CNQ", color: "amber" },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-500 mb-0.5">Análise de Padrões</p>
        <h1 className="text-2xl font-bold text-slate-800">Análise de Reincidências</h1>
        <p className="text-sm mt-0.5 text-slate-500">
          Erros com 2 ou mais ocorrências — indicadores de falha de processo
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === tab.key
                ? tab.key === "retrabalho"
                  ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                  : "bg-white text-amber-700 shadow-sm border border-amber-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <FilterBar filter={filter} onChange={setFilter} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs uppercase tracking-widest mb-2 text-slate-500">
            {activeTab === "retrabalho" ? "Erros Reincidentes" : "CNQ Reincidentes"}
          </p>
          <p className={`text-3xl font-bold metric-value ${activeTab === "cnq" ? "text-amber-600" : "text-red-600"}`}>
            {reincidencia?.length ?? 0}
          </p>
          <p className="text-xs mt-1 text-slate-400">combinações erro+setor</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs uppercase tracking-widest mb-2 text-slate-500">Maior Reincidência</p>
          <p className={`text-3xl font-bold metric-value ${activeTab === "cnq" ? "text-amber-600" : "text-amber-600"}`}>
            {reincidencia?.[0]?.count ?? 0}x
          </p>
          <p className="text-xs mt-1 font-mono text-slate-400">{reincidencia?.[0]?.codigoErro ?? "—"}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs uppercase tracking-widest mb-2 text-slate-500">
            Custo {activeTab === "retrabalho" ? "Reincidências" : "CNQ Reincidentes"}
          </p>
          <p className={`text-3xl font-bold metric-value ${activeTab === "cnq" ? "text-amber-500" : "text-red-500"}`}>
            R$ {(reincidencia?.reduce((s, r) => s + Number(r.custo), 0) ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
          </p>
          <p className="text-xs mt-1 text-slate-400">custo acumulado</p>
        </div>
      </div>

      {/* Reincidência table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 flex items-center gap-2 border-b border-slate-200">
          <AlertTriangle className={`w-4 h-4 ${activeTab === "cnq" ? "text-amber-500" : "text-red-500"}`} />
          <span className={`text-xs font-bold uppercase tracking-widest ${activeTab === "cnq" ? "text-amber-600" : "text-red-500"}`}>
            {activeTab === "retrabalho" ? "Erros com Reincidência" : "CNQ com Reincidência"}
          </span>
        </div>

        {isLoading && (
          <div className="text-center py-8 text-slate-400">Analisando padrões...</div>
        )}

        {!isLoading && (reincidencia?.length ?? 0) === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nenhuma reincidência de {activeTab === "retrabalho" ? "retrabalho" : "CNQ"} encontrada com os filtros aplicados.</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}

        <div className="divide-y divide-slate-100">
          {reincidencia?.map((r, i) => {
            const sev = getSeverity(r.count);
            const errInfo = r.codigoErro ? errorMapLookup[r.codigoErro] : null;

            return (
              <div key={i} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Severity badge */}
                  <div className="shrink-0 flex flex-col items-center gap-1 w-16">
                    <div className="text-2xl font-bold metric-value" style={{ color: sev.color }}>{r.count}x</div>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded text-center"
                      style={{ background: sev.bg, color: sev.color, fontSize: "0.6rem", letterSpacing: "0.08em" }}>
                      {sev.label}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <ErrorCodeBadge code={r.codigoErro} errorMap={errorMap} />
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{r.setor}</span>
                    </div>

                    {errInfo && (
                      <p className="text-sm mb-1 text-slate-700">{errInfo.description}</p>
                    )}

                    {r.responsaveis && (
                      <p className="text-xs mb-1 text-slate-500">
                        <span className="text-slate-400">Responsáveis: </span>{r.responsaveis}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs font-mono font-semibold text-amber-600">
                        R$ {Number(r.custo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      {errInfo && (
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-green-600" />
                          <span className="text-xs text-green-700">{errInfo.correction}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Responsáveis com mais erros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 flex items-center gap-2 border-b border-slate-200">
          <TrendingUp className={`w-4 h-4 ${activeTab === "cnq" ? "text-amber-500" : "text-amber-500"}`} />
          <span className={`text-xs font-bold uppercase tracking-widest ${activeTab === "cnq" ? "text-amber-600" : "text-amber-600"}`}>
            Responsáveis com Mais {activeTab === "retrabalho" ? "Retrabalhos" : "CNQ"}
          </span>
        </div>
        <div className="p-4 space-y-2">
          {(byResp ?? []).filter(r => r.responsavel && r.count >= 2).length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nenhum responsável com 2+ {activeTab === "retrabalho" ? "retrabalhos" : "CNQ"} reincidentes.</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
          {(byResp ?? []).filter(r => r.responsavel && r.count >= 2).map((r, i) => {
            const max = byResp?.filter(x => x.responsavel)?.[0]?.count ?? 1;
            const pct = Math.round((r.count / max) * 100);
            const color = r.count >= 5 ? "#ef4444" : r.count >= 3 ? "#f97316" : "#eab308";
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs w-32 truncate shrink-0 text-slate-700">{r.responsavel}</span>
                <div className="flex-1 h-6 rounded overflow-hidden bg-slate-100">
                  <div className="h-full flex items-center px-2 transition-all"
                    style={{ width: `${pct}%`, background: `${color}20`, borderLeft: `2px solid ${color}` }}>
                    <span className="text-xs font-mono" style={{ color }}>{r.count} ocorrências</span>
                  </div>
                </div>
                <span className="text-xs font-mono w-20 text-right shrink-0 text-slate-500">
                  R$ {Number(r.custo).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
