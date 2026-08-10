import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { ShieldCheck, Search, ChevronLeft, ChevronRight, Eye, X, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ─── Helpers ────────────────────────────────────────────────────────────────

type AcaoType = "CRIACAO" | "EDICAO" | "EXCLUSAO";

const ACAO_CONFIG: Record<AcaoType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  CRIACAO: {
    label: "Criação",
    color: "oklch(0.40 0.18 155)",
    bg: "oklch(0.95 0.05 155)",
    icon: <Plus size={13} />,
  },
  EDICAO: {
    label: "Edição",
    color: "oklch(0.45 0.18 250)",
    bg: "oklch(0.94 0.06 250)",
    icon: <Pencil size={13} />,
  },
  EXCLUSAO: {
    label: "Exclusão",
    color: "oklch(0.50 0.22 25)",
    bg: "oklch(0.95 0.06 25)",
    icon: <Trash2 size={13} />,
  },
};

function AcaoBadge({ acao }: { acao: AcaoType }) {
  const cfg = ACAO_CONFIG[acao];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Drawer de detalhes ──────────────────────────────────────────────────────

type AuditRow = {
  id: number;
  retrabalhoId: number | null;
  osRetrabalhada: string | null;
  osOriginal: string | null;
  acao: AcaoType;
  usuarioId: number | null;
  usuarioNome: string | null;
  usuarioRole: string | null;
  detalhes: Record<string, unknown> | null;
  createdAt: Date;
};

function DetalhesDrawer({ row, onClose }: { row: AuditRow; onClose: () => void }) {
  const cfg = ACAO_CONFIG[row.acao];

  const renderDetalhes = () => {
    if (!row.detalhes) return <p className="text-slate-400 text-sm">Sem detalhes adicionais.</p>;

    if (row.acao === "EDICAO" && row.detalhes.alteracoes) {
      const alteracoes = row.detalhes.alteracoes as Record<string, unknown>;
      const antes = (row.detalhes.antes as Record<string, unknown>) ?? {};
      const campos = Object.keys(alteracoes).filter((k) => alteracoes[k] !== undefined);
      if (campos.length === 0) return <p className="text-slate-400 text-sm">Nenhum campo alterado registrado.</p>;
      return (
        <div className="space-y-2">
          {campos.map((campo) => (
            <div key={campo} className="rounded-lg border border-slate-100 overflow-hidden">
              <div className="bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {campo}
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-100">
                <div className="px-3 py-2">
                  <div className="text-[10px] text-slate-400 mb-0.5">Antes</div>
                  <div className="text-sm text-slate-600 break-all">
                    {antes[campo] != null ? String(antes[campo]) : <span className="text-slate-300">—</span>}
                  </div>
                </div>
                <div className="px-3 py-2">
                  <div className="text-[10px] text-slate-400 mb-0.5">Depois</div>
                  <div className="text-sm font-medium text-slate-800 break-all">
                    {alteracoes[campo] != null ? String(alteracoes[campo]) : <span className="text-slate-300">—</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (row.acao === "EXCLUSAO" && row.detalhes.registroExcluido) {
      const reg = row.detalhes.registroExcluido as Record<string, unknown>;
      return (
        <div className="rounded-lg border border-red-100 bg-red-50 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Registro excluído</p>
          {Object.entries(reg).filter(([, v]) => v != null).map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="text-slate-500 min-w-[120px] shrink-0">{k}:</span>
              <span className="text-slate-800 break-all">{String(v)}</span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <pre className="text-xs bg-slate-50 rounded-lg p-3 overflow-auto max-h-64 text-slate-600">
        {JSON.stringify(row.detalhes, null, 2)}
      </pre>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.icon}
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">Evento #{row.id}</div>
              <div className="text-xs text-slate-400">{formatDate(row.createdAt)}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Info */}
        <div className="px-5 py-4 border-b border-slate-100 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Ação</div>
              <AcaoBadge acao={row.acao} />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Usuário</div>
              <div className="text-sm font-medium text-slate-800">{row.usuarioNome ?? "—"}</div>
              {row.usuarioRole && (
                <div className="text-xs text-slate-400 capitalize">{row.usuarioRole}</div>
              )}
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">OS Retrabalho</div>
              <div className="text-sm font-mono text-slate-800">{row.osRetrabalhada ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">OS Original</div>
              <div className="text-sm font-mono text-slate-800">{row.osOriginal ?? "—"}</div>
            </div>
          </div>
        </div>

        {/* Detalhes */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Detalhes da alteração</div>
          {renderDetalhes()}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function Auditoria() {
  const [acao, setAcao] = useState<AcaoType | "">("");
  const [osFilter, setOsFilter] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<AuditRow | null>(null);

  const PAGE_SIZE = 30;

  const queryInput = useMemo(() => ({
    acao: acao || undefined,
    osRetrabalhada: osFilter.trim() || undefined,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [acao, osFilter, dataInicio, dataFim, page]);

  const { data, isLoading } = trpc.auditoria.list.useQuery(queryInput);

  const rows = (data?.rows ?? []) as AuditRow[];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleFilterChange = () => setPage(1);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "oklch(0.94 0.04 240)" }}
          >
            <ShieldCheck size={20} style={{ color: "oklch(0.45 0.18 240)" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Auditoria de Retrabalhos</h1>
            <p className="text-sm text-slate-500">
              Histórico completo de criações, edições e exclusões
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Ação */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Ação</label>
              <select
                value={acao}
                onChange={(e) => { setAcao(e.target.value as AcaoType | ""); handleFilterChange(); }}
                className="h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 px-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Todas</option>
                <option value="CRIACAO">Criação</option>
                <option value="EDICAO">Edição</option>
                <option value="EXCLUSAO">Exclusão</option>
              </select>
            </div>

            {/* OS */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">OS Retrabalho</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={osFilter}
                  onChange={(e) => { setOsFilter(e.target.value); handleFilterChange(); }}
                  placeholder="Buscar OS..."
                  className="pl-8 h-9 w-40 bg-white border-slate-200 text-sm"
                />
              </div>
            </div>

            {/* Data início */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Data início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => { setDataInicio(e.target.value); handleFilterChange(); }}
                className="h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 px-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* Data fim */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Data fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => { setDataFim(e.target.value); handleFilterChange(); }}
                className="h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 px-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* Limpar */}
            {(acao || osFilter || dataInicio || dataFim) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setAcao(""); setOsFilter(""); setDataInicio(""); setDataFim(""); setPage(1); }}
                className="h-9 text-slate-500 hover:text-slate-700"
              >
                <X size={14} className="mr-1" />
                Limpar
              </Button>
            )}

            {/* Contador */}
            <div className="ml-auto text-sm text-slate-400">
              {isLoading ? "Carregando..." : `${total} evento${total !== 1 ? "s" : ""}`}
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              Carregando eventos...
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <ShieldCheck size={32} className="text-slate-200" />
              <p className="text-slate-400 text-sm">Nenhum evento de auditoria encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data/Hora</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ação</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">OS Retrabalho</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">OS Original</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuário</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Perfil</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedRow(row)}
                    >
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono text-xs">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <AcaoBadge acao={row.acao} />
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 font-medium">
                        {row.osRetrabalhada ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {row.osOriginal ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.usuarioNome ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.usuarioRole ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">
                            {row.usuarioRole}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedRow(row); }}
                          className="text-slate-400 hover:text-blue-500 transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drawer de detalhes */}
      {selectedRow && (
        <DetalhesDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </DashboardLayout>
  );
}
