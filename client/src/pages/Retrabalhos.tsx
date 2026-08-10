import { trpc } from "@/lib/trpc";
import DashboardLayout from "../components/DashboardLayout";
import { useState } from "react";
import { useLocation } from "wouter";
import FilterBar, { FilterState } from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Edit2, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorCodeBadge, useErrorMap } from "@/components/ErrorCodeBadge";

export default function Retrabalhos() {
  const [filter, setFilter] = useState<FilterState>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const errorMap = useErrorMap();

  const { data, isLoading } = trpc.retrabalhos.list.useQuery({
    filter: { ...filter, search: search || undefined },
    page,
    pageSize: 50,
  });

  const deleteMut = trpc.retrabalhos.delete.useMutation({
    onSuccess: () => {
      toast.success("Retrabalho excluído");
      utils.retrabalhos.list.invalidate();
      utils.dashboard.kpis.invalidate();
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  const handleDelete = (id: number) => {
    if (confirm("Confirmar exclusão deste retrabalho?")) deleteMut.mutate({ id });
  };

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <DashboardLayout>
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">Registros</p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Retrabalhos</h1>
          <p className="text-sm text-slate-500">
            {total} ocorrências registradas
          </p>
        </div>
        <Button onClick={() => setLocation("/retrabalhos/novo")} className="gap-2 shrink-0"
          style={{ background: "var(--bp-blue)", color: "white" }}>
          <PlusCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Novo Retrabalho</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {/* Filters */}
      <FilterBar filter={filter} onChange={f => { setFilter(f); setPage(1); }}
        showSearch searchValue={search} onSearchChange={v => { setSearch(v); setPage(1); }} />

      {/* Table */}
      <div className="tech-card rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full tech-table">
            <thead>
              <tr>
                <th className="text-left">Classif.</th>
                <th className="text-left">OS Ret.</th>
                <th className="text-left">OS Ori.</th>
                <th className="text-left">Data</th>
                <th className="text-left">Setor</th>
                <th className="text-left">Int/Ext</th>
                <th className="text-left whitespace-nowrap">Erro</th>
                <th className="text-left">Responsável</th>
                <th className="text-right">Total</th>
                <th className="text-right whitespace-nowrap">Horas Imp.</th>
                <th className="text-left">Classe</th>
                <th className="text-left">Descrição</th>
                <th className="text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={13} className="text-center py-8" style={{ color: "var(--bp-text-dim)" }}>Carregando...</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={13} className="text-center py-8" style={{ color: "var(--bp-text-dim)" }}>Nenhum retrabalho encontrado</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${(r as any).tipoRegistro === "cnq" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                      {(r as any).tipoRegistro === "cnq" ? "CNQ" : "Retrab."}
                    </span>
                  </td>
                  <td className="font-mono text-xs font-semibold text-blue-700">{r.osRetrabalhada}</td>
                  <td className="font-mono text-xs text-slate-500">{r.osOriginal}</td>
                  <td className="text-xs">{new Date(r.data).toLocaleDateString("pt-BR")}</td>
                  <td>
                    <span className="text-xs font-medium px-2 py-0.5 rounded"
                      style={{ background: "rgba(30,111,217,0.15)", color: "#5ba3f5" }}>
                      {r.setor}
                    </span>
                  </td>
                  <td>
                    <span className={r.tipo === "INTERNO" ? "badge-interno" : "badge-externo"}>{r.tipo}</span>
                  </td>
                  <td className="whitespace-nowrap"><ErrorCodeBadge code={r.codigoErro} errorMap={errorMap} /></td>
                  <td className="text-xs text-slate-700">{r.responsavel ?? "—"}</td>
                  <td className="text-right font-mono text-xs font-semibold text-amber-600">
                    R$ {Number(r.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right font-mono text-xs">
                    {r.horasImpacto != null ? (
                      <span className="font-semibold text-violet-600">{Number(r.horasImpacto).toLocaleString("pt-BR", { minimumFractionDigits: 1 })}h</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td>
                    <span className={r.classe === "EVITÁVEL" ? "badge-evitavel" : "badge-inevitavel"}>{r.classe}</span>
                  </td>
                  <td className="max-w-[200px]">
                    {(r as any).titulo && (
                      <span className="block truncate text-xs font-semibold text-slate-800 mb-0.5">
                        {(r as any).titulo}
                      </span>
                    )}
                    <span title={r.descricao ?? ""} className="block truncate text-xs text-slate-500">
                      {r.descricao ?? "—"}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setLocation(`/retrabalhos/${r.id}/editar`)}
                        className="p-1.5 rounded hover:bg-blue-100 transition-colors" title="Editar">
                        <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                      </button>
                      <button onClick={() => handleDelete(r.id)}
                        className="p-1.5 rounded hover:bg-red-100 transition-colors" title="Excluir">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 50 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(30,111,217,0.15)" }}>
            <span className="text-xs" style={{ color: "var(--bp-text-dim)" }}>
              Mostrando {Math.min((page - 1) * 50 + 1, total)}–{Math.min(page * 50, total)} de {total}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-7 text-xs">Anterior</Button>
              <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="h-7 text-xs">Próximo</Button>
            </div>
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
