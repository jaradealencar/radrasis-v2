import { useState } from "react";
import { FileText, Download, Eye, Users, TrendingUp, Calendar, Filter } from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import { trpc } from "../../lib/trpc";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PopRelatorio() {
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "visualizacao" | "download">("todos");
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<"detalhado" | "resumo">("resumo");

  const { data: estatisticas, isLoading: loadingEst } = trpc.pops.estatisticasAcessos.useQuery();
  const { data: acessos, isLoading: loadingAcessos } = trpc.pops.relatorioAcessos.useQuery({
    tipo: filtroTipo,
    dataInicio: filtroInicio || undefined,
    dataFim: filtroFim || undefined,
  });

  type EstatRow = { popCode: string; popTitle: string; totalVisualizacoes: number | string; totalDownloads: number | string; total: number | string; ultimoAcesso: Date | string | null };
  type AcessoRow = { id: number; popId: number; popCode: string; popTitle: string; usuarioNome: string; tipo: string; createdAt: Date | string };

  const totalVisualizacoes = (estatisticas ?? []).reduce((s: number, r: EstatRow) => s + Number(r.totalVisualizacoes ?? 0), 0);
  const totalDownloads = (estatisticas ?? []).reduce((s: number, r: EstatRow) => s + Number(r.totalDownloads ?? 0), 0);
  const totalAcessos = totalVisualizacoes + totalDownloads;
  const popsAcessados = (estatisticas ?? []).length;

  // Usuários únicos nos acessos detalhados
  const usuariosUnicos = new Set((acessos ?? []).map((a: AcessoRow) => a.usuarioNome)).size;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "oklch(0.52 0.18 240 / 0.1)" }}>
            <TrendingUp size={18} style={{ color: "oklch(0.52 0.18 240)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#0f172a" }}>Relatório de Acessos — POPs</h1>
            <p className="text-sm text-gray-500">Quem visualizou e baixou os Procedimentos Operacionais Padrão</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-blue-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Acessos</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalAcessos}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Eye size={14} className="text-purple-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visualizações</span>
          </div>
          <p className="text-2xl font-bold text-purple-700">{totalVisualizacoes}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Download size={14} className="text-green-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Downloads</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{totalDownloads}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={14} className="text-orange-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">POPs Acessados</span>
          </div>
          <p className="text-2xl font-bold text-orange-700">{popsAcessados}</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        <button
          onClick={() => setAbaAtiva("resumo")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${abaAtiva === "resumo" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Resumo por POP
        </button>
        <button
          onClick={() => setAbaAtiva("detalhado")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${abaAtiva === "detalhado" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Histórico Detalhado
          {(acessos ?? []).length > 0 && (
            <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">{(acessos ?? []).length}</span>
          )}
        </button>
      </div>

      {/* ABA RESUMO */}
      {abaAtiva === "resumo" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loadingEst ? (
            <div className="text-center py-12 text-gray-400">Carregando...</div>
          ) : (estatisticas ?? []).length === 0 ? (
            <div className="text-center py-12">
              <FileText size={36} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm">Nenhum acesso registrado ainda.</p>
              <p className="text-gray-400 text-xs mt-1">Os acessos serão registrados automaticamente quando os usuários abrirem ou baixarem POPs.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Título</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span className="flex items-center justify-center gap-1"><Eye size={11} /> Visualizações</span>
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span className="flex items-center justify-center gap-1"><Download size={11} /> Downloads</span>
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Último Acesso</th>
                </tr>
              </thead>
              <tbody>
                {(estatisticas ?? []).map((row: EstatRow, i: number) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{row.popCode}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-700 font-medium">{row.popTitle}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-purple-700 font-semibold">
                        <Eye size={12} /> {Number(row.totalVisualizacoes ?? 0)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
                        <Download size={12} /> {Number(row.totalDownloads ?? 0)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-gray-800">{Number(row.total ?? 0)}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">{formatDate(row.ultimoAcesso)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ABA DETALHADO */}
      {abaAtiva === "detalhado" && (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 mb-4 p-4 bg-white border border-gray-200 rounded-xl">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-500">Filtros:</span>
            </div>
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value as any)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos os tipos</option>
              <option value="visualizacao">Visualizações</option>
              <option value="download">Downloads</option>
            </select>
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-gray-400" />
              <input
                type="date"
                value={filtroInicio}
                onChange={e => setFiltroInicio(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Data início"
              />
              <span className="text-gray-400 text-xs">até</span>
              <input
                type="date"
                value={filtroFim}
                onChange={e => setFiltroFim(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Data fim"
              />
            </div>
            {(filtroInicio || filtroFim || filtroTipo !== "todos") && (
              <button
                onClick={() => { setFiltroInicio(""); setFiltroFim(""); setFiltroTipo("todos"); }}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Limpar filtros
              </button>
            )}
            {(acessos ?? []).length > 0 && (
              <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
                <Users size={12} /> {usuariosUnicos} usuário{usuariosUnicos !== 1 ? "s" : ""} únicos
              </span>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {loadingAcessos ? (
              <div className="text-center py-12 text-gray-400">Carregando...</div>
            ) : (acessos ?? []).length === 0 ? (
              <div className="text-center py-12">
                <Eye size={36} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 text-sm">Nenhum acesso encontrado com os filtros selecionados.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data/Hora</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuário</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">POP</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {(acessos ?? []).map((row: AcessoRow, i: number) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-4 text-xs text-gray-500 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-gray-800 text-sm">{row.usuarioNome}</div>

                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 mr-2">{row.popCode}</span>
                        <span className="text-sm text-gray-700">{row.popTitle}</span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {row.tipo === "download" ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-700">
                            <Download size={10} /> Download
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-700">
                            <Eye size={10} /> Visualização
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
