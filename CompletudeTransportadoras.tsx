import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle, CheckCircle2, Pencil, Layers, Power, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const ROTULO_PRIORIDADE: Record<number, { texto: string; classe: string }> = {
  1: { texto: "Crítico", classe: "bg-red-100 text-red-700 border-red-200" },
  2: { texto: "Importante", classe: "bg-amber-100 text-amber-700 border-amber-200" },
  3: { texto: "Complementar", classe: "bg-slate-100 text-slate-600 border-slate-200" },
};

const FORMAS_COTACAO = ["site", "whatsapp", "telefone", "email"];

type Status = "ativas" | "inativas" | "todas";
type Origem = "Frenet" | "Manual" | "todas";
type Modo = "vazios" | "preenchidos" | "todos";

/**
 * Subaba de gestão de completude do cadastro de transportadoras.
 *
 * Permite trabalhar em etapas: escolhe-se um campo (ex.: endereço), filtra-se
 * quem ainda não tem o dado e preenche-se um a um ou em lote, sem abrir o
 * cadastro completo de cada transportadora.
 */
export default function CompletudeTransportadoras() {
  const utils = trpc.useUtils();
  const [campoAtivo, setCampoAtivo] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("todas");
  const [origem, setOrigem] = useState<Origem>("todas");
  const [modo, setModo] = useState<Modo>("vazios");
  const [editando, setEditando] = useState<number | null>(null);
  const [valorEdicao, setValorEdicao] = useState("");
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [valorLote, setValorLote] = useState("");
  const [expandidos, setExpandidos] = useState<number[]>([]);

  const { data: panorama } = trpc.transportadoras.panoramaCadastro.useQuery();
  const { data: resumo, isLoading: carregandoResumo } =
    trpc.transportadoras.resumoCompletude.useQuery({ status, origem });
  const { data: lista, isLoading: carregandoLista } = trpc.transportadoras.pendentesPorCampo.useQuery(
    { campo: campoAtivo, busca: busca || undefined, page, pageSize: 20, status, origem, modo },
  );

  const invalidarTudo = () => {
    utils.transportadoras.resumoCompletude.invalidate();
    utils.transportadoras.pendentesPorCampo.invalidate();
    utils.transportadoras.panoramaCadastro.invalidate();
    utils.transportadoras.list.invalidate();
  };

  const salvarCampo = trpc.transportadoras.atualizarCampo.useMutation({
    onSuccess: () => {
      invalidarTudo();
      setValorEdicao("");
      // Edição sequencial: abre automaticamente o próximo registro pendente da lista
      const proximo = proximoPendente(editando);
      setEditando(proximo);
      toast.success(proximo ? "Campo preenchido — próximo pendente aberto" : "Campo preenchido");
    },
    onError: (e) => toast.error(`Erro ao salvar: ${e.message}`),
  });

  const salvarLote = trpc.transportadoras.atualizarCampoEmLote.useMutation({
    onSuccess: (r: any) => {
      invalidarTudo();
      setSelecionados([]);
      setValorLote("");
      toast.success(`${r.afetados} cadastro(s) atualizado(s)`);
    },
    onError: (e) => toast.error(`Erro no preenchimento em lote: ${e.message}`),
  });

  const alternarStatus = trpc.transportadoras.definirStatus.useMutation({
    onSuccess: () => {
      invalidarTudo();
      toast.success("Status atualizado");
    },
    onError: (e) => toast.error(`Erro ao alterar status: ${e.message}`),
  });

  const grupoAtivo = resumo?.grupos.find((g: any) => g.campo === campoAtivo);
  const gruposVisiveis = (resumo?.grupos ?? []).filter(
    (g: any) => prioridadeFiltro === null || g.prioridade === prioridadeFiltro,
  );
  const registros = lista?.data ?? [];
  const idsPagina = registros.map((t: any) => t.id);
  const todosMarcados = idsPagina.length > 0 && idsPagina.every((id: number) => selecionados.includes(id));

  /**
   * Próximo registro da página que ainda está com o campo ativo em branco,
   * usado para o fluxo de preenchimento sequencial.
   */
  function proximoPendente(idAtual: number | null): number | null {
    if (!campoAtivo) return null;
    const inicio = idAtual === null ? 0 : registros.findIndex((t: any) => t.id === idAtual) + 1;
    for (let i = Math.max(0, inicio); i < registros.length; i++) {
      const v = registros[i][campoAtivo];
      if (v === null || v === undefined || String(v).trim() === "") return registros[i].id;
    }
    return null;
  }

  const MODAL_ROTULO: Record<string, string> = {
    rodoviario: "Rodoviário",
    aereo: "Aéreo",
    onibus: "Ônibus",
  };

  function modaisDe(t: any): string {
    try {
      const lista = typeof t.modais === "string" ? JSON.parse(t.modais) : t.modais;
      if (Array.isArray(lista) && lista.length > 0) {
        return lista.map((m: string) => MODAL_ROTULO[m] ?? m).join(", ");
      }
    } catch {
      if (typeof t.modais === "string" && t.modais.trim()) return t.modais;
    }
    return "—";
  }

  const trocarCampo = (campo: string) => {
    const mesmo = campoAtivo === campo;
    setCampoAtivo(mesmo ? null : campo);
    setPage(1);
    setBusca("");
    setEditando(null);
    setSelecionados([]);
  };

  const valorDoCampo = (t: any) => {
    const v = campoAtivo ? t[campoAtivo] : null;
    if (v === null || v === undefined || String(v).trim() === "") return null;
    return String(v);
  };

  if (carregandoResumo) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Panorama do cadastro ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {[
          { rotulo: "Total", valor: panorama?.total ?? 0, classe: "text-slate-900" },
          { rotulo: "Ativas", valor: panorama?.ativas ?? 0, classe: "text-emerald-700" },
          { rotulo: "Inativas", valor: panorama?.inativas ?? 0, classe: "text-slate-500" },
          { rotulo: "Origem Frenet", valor: panorama?.frenet ?? 0, classe: "text-indigo-700" },
          { rotulo: "Cadastro manual", valor: panorama?.manual ?? 0, classe: "text-blue-700" },
          { rotulo: "Alcance nacional", valor: panorama?.nacionais ?? 0, classe: "text-teal-700" },
        ].map(c => (
          <div key={c.rotulo} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <p className="text-[11px] text-gray-500">{c.rotulo}</p>
            <p className={`text-lg font-bold leading-tight ${c.classe}`}>{c.valor}</p>
          </div>
        ))}
      </div>

      {/* ── Progresso geral ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">Completude do recorte selecionado</p>
            <p className="text-xs text-gray-500">
              {resumo?.total ?? 0} transportadoras no filtro · {resumo?.completos ?? 0} com todos os campos preenchidos
            </p>
          </div>
          <span className="text-2xl font-bold text-blue-600">{resumo?.percentualGeral ?? 0}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
            style={{ width: `${resumo?.percentualGeral ?? 0}%` }}
          />
        </div>
        {(resumo?.comCriticoVazio ?? 0) > 0 && (
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
            <AlertTriangle className="w-3.5 h-3.5" />
            {resumo?.comCriticoVazio} cadastro(s) com pelo menos um campo crítico em branco
          </p>
        )}
      </div>

      {/* ── Filtros de recorte ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500 w-20">Status</span>
          {([
            { v: "todas", t: "Todas" },
            { v: "ativas", t: "Ativas" },
            { v: "inativas", t: "Inativas" },
          ] as { v: Status; t: string }[]).map(op => (
            <button
              key={op.v}
              onClick={() => { setStatus(op.v); setPage(1); setSelecionados([]); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                status === op.v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {op.t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500 w-20">Origem</span>
          {([
            { v: "todas", t: "Todas" },
            { v: "Frenet", t: "Frenet" },
            { v: "Manual", t: "Manual" },
          ] as { v: Origem; t: string }[]).map(op => (
            <button
              key={op.v}
              onClick={() => { setOrigem(op.v); setPage(1); setSelecionados([]); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                origem === op.v ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {op.t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500 w-20">Criticidade</span>
          {[
            { valor: null, texto: "Todos" },
            { valor: 1, texto: "Críticos" },
            { valor: 2, texto: "Importantes" },
            { valor: 3, texto: "Complementares" },
          ].map(op => (
            <button
              key={String(op.valor)}
              onClick={() => setPrioridadeFiltro(op.valor)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                prioridadeFiltro === op.valor ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {op.texto}
            </button>
          ))}
        </div>
      </div>

      {/* ── Agrupamentos por campo ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {gruposVisiveis.map((g: any) => {
          const rotulo = ROTULO_PRIORIDADE[g.prioridade];
          const ativo = campoAtivo === g.campo;
          const completo = g.faltando === 0;
          return (
            <button
              key={g.campo}
              onClick={() => trocarCampo(g.campo)}
              className={`text-left rounded-lg border p-3 transition-all ${
                ativo ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200" : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 leading-tight">{g.titulo}</p>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${rotulo.classe}`}>{rotulo.texto}</Badge>
              </div>
              <p className={`text-xs mt-1.5 font-medium ${completo ? "text-green-700" : "text-gray-600"}`}>
                {completo ? (
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Todos preenchidos</span>
                ) : (
                  <>{g.faltando} sem este dado · {g.preenchidos} com o dado</>
                )}
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${completo ? "bg-green-500" : "bg-amber-500"}`}
                  style={{ width: `${g.percentualPreenchido}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{g.percentualPreenchido}% preenchido</p>
            </button>
          );
        })}
      </div>

      {/* ── Tabela do campo selecionado ─────────────────────────────────── */}
      {!campoAtivo ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-600">Selecione um campo acima para começar a preencher dados</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{grupoAtivo?.titulo}</p>
              <p className="text-xs text-gray-500">{lista?.pagination.total ?? 0} registro(s) no recorte</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {([
                { v: "vazios", t: "Sem o dado" },
                { v: "preenchidos", t: "Com o dado" },
                { v: "todos", t: "Todos" },
              ] as { v: Modo; t: string }[]).map(op => (
                <button
                  key={op.v}
                  onClick={() => { setModo(op.v); setPage(1); setSelecionados([]); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    modo === op.v ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {op.t}
                </button>
              ))}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  className="pl-9 h-9"
                  placeholder="Buscar por nome..."
                  value={busca}
                  onChange={e => { setBusca(e.target.value); setPage(1); }}
                />
              </div>
            </div>
          </div>

          {/* Preenchimento em lote */}
          {selecionados.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 p-3">
              <Layers className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="text-xs font-medium text-amber-800">
                {selecionados.length} selecionada(s) — aplicar o mesmo valor a todas:
              </span>
              {grupoAtivo?.tipo === "enum-forma" ? (
                <select
                  className="h-8 rounded-md border px-2 text-xs bg-white"
                  value={valorLote}
                  onChange={e => setValorLote(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {FORMAS_COTACAO.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              ) : (
                <Input
                  className="h-8 w-56 text-xs"
                  placeholder={grupoAtivo?.titulo}
                  value={valorLote}
                  onChange={e => setValorLote(e.target.value)}
                />
              )}
              <Button
                size="sm"
                className="h-8"
                disabled={salvarLote.isPending || !valorLote.trim()}
                onClick={() => salvarLote.mutate({ ids: selecionados, campo: campoAtivo, valor: valorLote })}
              >
                {salvarLote.isPending ? "Aplicando..." : "Aplicar a todas"}
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setSelecionados([])}>
                Limpar seleção
              </Button>
            </div>
          )}

          {carregandoLista ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : registros.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              Nenhuma transportadora neste recorte.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="w-9 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={todosMarcados}
                        onChange={e =>
                          setSelecionados(prev =>
                            e.target.checked
                              ? Array.from(new Set([...prev, ...idsPagina]))
                              : prev.filter(id => !idsPagina.includes(id)),
                          )
                        }
                      />
                    </th>
                    <th className="px-3 py-2 text-left">Transportadora</th>
                    <th className="px-3 py-2 text-left w-28">Modal</th>
                    <th className="px-3 py-2 text-left w-24">Origem</th>
                    <th className="px-3 py-2 text-left">Contato / Endereço</th>
                    <th className="px-3 py-2 text-left">{grupoAtivo?.titulo}</th>
                    <th className="px-3 py-2 text-left w-32">Completude</th>
                    <th className="px-3 py-2 text-left w-24">Status</th>
                    <th className="px-3 py-2 text-right w-32">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {registros.map((t: any) => {
                    const valorAtual = valorDoCampo(t);
                    const emEdicao = editando === t.id;
                    const ativaSim = t.ativa === "sim";
                    return (
                      <tr key={t.id} className="hover:bg-gray-50/60">
                        <td className="px-3 py-2 align-top">
                          <input
                            type="checkbox"
                            checked={selecionados.includes(t.id)}
                            onChange={e =>
                              setSelecionados(prev =>
                                e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id),
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-medium text-gray-900 truncate">{t.nome}</span>
                            {t.origem === "Frenet" && (
                              <Badge variant="outline" className="text-[9px] border-indigo-200 bg-indigo-50 text-indigo-700 shrink-0">
                                Frenet
                              </Badge>
                            )}
                            {t.coberturaTotal === 1 && (
                              <Badge variant="outline" className="text-[9px] border-teal-200 bg-teal-50 text-teal-700 shrink-0">
                                Nacional
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 truncate">
                            {[t.cidade, t.uf].filter(Boolean).join("/") || "Sede não informada"}
                            {t.site && (
                              <a
                                href={t.site}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1 inline-flex items-center gap-0.5 text-blue-600 hover:underline"
                                onClick={e => e.stopPropagation()}
                              >
                                site <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </p>
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] text-gray-600">{modaisDe(t)}</td>
                        <td className="px-3 py-2 align-top">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              t.origem === "Frenet"
                                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                : "border-blue-200 bg-blue-50 text-blue-700"
                            }`}
                          >
                            {t.origem === "Frenet" ? "[Frenet]" : "Manual"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] text-gray-600">
                          <p className="truncate">
                            {t.telefoneContato || t.whatsappContato || t.emailContatoNegocial || (
                              <span className="text-red-600">sem contato</span>
                            )}
                          </p>
                          <p className="truncate text-gray-400">
                            {t.endereco || <span className="text-red-500">sem endereço</span>}
                          </p>
                        </td>
                        <td className="px-3 py-2 align-top">
                          {emEdicao ? (
                            <div className="space-y-2">
                              {grupoAtivo?.tipo === "enum-forma" ? (
                                <select
                                  className="w-full h-9 border rounded-md px-2 text-sm bg-white"
                                  value={valorEdicao}
                                  onChange={e => setValorEdicao(e.target.value)}
                                >
                                  <option value="">Selecione...</option>
                                  {FORMAS_COTACAO.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                              ) : (
                                <Input
                                  autoFocus
                                  className="h-9"
                                  inputMode={grupoAtivo?.tipo === "numero" ? "decimal" : undefined}
                                  placeholder={grupoAtivo?.titulo}
                                  value={valorEdicao}
                                  onChange={e => setValorEdicao(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter" && valorEdicao.trim()) {
                                      salvarCampo.mutate({ id: t.id, campo: campoAtivo, valor: valorEdicao });
                                    }
                                    if (e.key === "Escape") setEditando(null);
                                  }}
                                />
                              )}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="h-7"
                                  disabled={salvarCampo.isPending || !valorEdicao.trim()}
                                  onClick={() => salvarCampo.mutate({ id: t.id, campo: campoAtivo, valor: valorEdicao })}
                                >
                                  {salvarCampo.isPending ? "Salvando..." : "Salvar"}
                                </Button>
                                <Button size="sm" variant="outline" className="h-7" onClick={() => setEditando(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : valorAtual ? (
                            <span className="text-gray-700 break-words">{valorAtual}</span>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-red-200 bg-red-50 text-red-700">
                              em branco
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-14 rounded-full bg-gray-100 overflow-hidden shrink-0">
                              <div
                                className={`h-full rounded-full ${
                                  t.completudePercentual >= 80
                                    ? "bg-emerald-500"
                                    : t.completudePercentual >= 40
                                      ? "bg-amber-500"
                                      : "bg-red-400"
                                }`}
                                style={{ width: `${t.completudePercentual ?? 0}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-medium text-gray-500">{t.completudePercentual ?? 0}%</span>
                          </div>
                          {(t.camposFaltantes ?? []).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-0.5">
                              {(expandidos.includes(t.id)
                                ? (t.camposFaltantes ?? [])
                                : (t.camposFaltantes ?? []).slice(0, 3)
                              ).map((c: any) => (
                                <span
                                  key={c.campo}
                                  title={c.titulo}
                                  className={`rounded px-1 py-px text-[9px] ${
                                    c.prioridade === 1
                                      ? "bg-red-50 text-red-600"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {c.titulo}
                                </span>
                              ))}
                              {(t.camposFaltantes ?? []).length > 3 && (
                                <button
                                  onClick={() =>
                                    setExpandidos(prev =>
                                      prev.includes(t.id) ? prev.filter(i => i !== t.id) : [...prev, t.id],
                                    )
                                  }
                                  className="text-[9px] font-medium text-blue-600 hover:underline"
                                >
                                  {expandidos.includes(t.id)
                                    ? "ver menos"
                                    : `+${(t.camposFaltantes ?? []).length - 3} ver todos`}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <button
                            onClick={() => alternarStatus.mutate({ id: t.id, ativa: !ativaSim })}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                              ativaSim
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}
                            title="Clique para alternar"
                          >
                            <Power className="w-3 h-3" />
                            {ativaSim ? "Ativa" : "Inativa"}
                          </button>
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          {!emEdicao && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1"
                              onClick={() => { setEditando(t.id); setValorEdicao(valorAtual ?? ""); }}
                            >
                              <Pencil className="w-3 h-3" />
                              {valorAtual ? "Editar" : "Preencher"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {(lista?.pagination.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 p-3 text-xs text-gray-500">
              <span>Página {lista?.pagination.page} de {lista?.pagination.totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Anterior</Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= (lista?.pagination.totalPages ?? 1)}
                  onClick={() => setPage(p => p + 1)}
                >
                  Próxima →
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
