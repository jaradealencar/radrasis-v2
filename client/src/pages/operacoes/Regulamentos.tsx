import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronUp, Edit2, Plus, Save, ScrollText, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "../../components/DashboardLayout";
import RichTextEditor from "../../components/RichTextEditor";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

const TYPES = [
  { value: "regulamento", label: "Regulamento" },
  { value: "memorando", label: "Memorando" },
  { value: "politica", label: "Política" },
  { value: "procedimento", label: "Procedimento" },
];

const TYPE_COLORS: Record<string, string> = {
  regulamento: "bg-blue-50 text-blue-700",
  memorando: "bg-yellow-50 text-yellow-700",
  politica: "bg-purple-50 text-purple-700",
  procedimento: "bg-green-50 text-green-700",
};

const EMPTY_FORM = { title: "", type: "regulamento" as const, content: "", version: "" };

export default function Regulamentos() {
  const [filterType, setFilterType] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editVersion, setEditVersion] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data, isLoading, refetch } = trpc.regulations.list.useQuery({ type: filterType || undefined });
  const createMut = trpc.regulations.create.useMutation({
    onSuccess: () => { refetch(); setShowForm(false); setForm({ ...EMPTY_FORM }); toast.success("Documento criado!"); }
  });
  const updateMut = trpc.regulations.update.useMutation({
    onSuccess: () => { refetch(); setEditingId(null); toast.success("Documento atualizado!"); }
  });
  const deleteMut = trpc.regulations.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Documento removido."); }
  });

  const items = data ?? [];

  function startEdit(item: typeof items[0]) {
    setEditingId(item.id);
    setEditContent(item.content ?? "");
    setEditTitle(item.title);
    setEditVersion(item.version ?? "");
    setExpandedId(item.id);
  }

  function saveEdit(id: number) {
    updateMut.mutate({ id, data: { content: editContent, title: editTitle, version: editVersion || null } });
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "oklch(0.52 0.18 240 / 0.1)" }}>
            <ScrollText size={18} style={{ color: "oklch(0.52 0.18 240)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#0f172a" }}>Regulamentos e Memorandos</h1>
            <p className="text-sm text-gray-500">Documentos internos, políticas e procedimentos</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "oklch(0.52 0.18 240)" }}>
          <Plus size={15} /> Novo Documento
        </button>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setFilterType("")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!filterType ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`} style={!filterType ? { background: "oklch(0.52 0.18 240)" } : {}}>
          Todos ({items.length})
        </button>
        {TYPES.map(t => {
          const count = (data ?? []).filter(i => i.type === t.value).length;
          return (
            <button key={t.value} onClick={() => setFilterType(t.value)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterType === t.value ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`} style={filterType === t.value ? { background: "oklch(0.52 0.18 240)" } : {}}>
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Novo Documento</h3>
            <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Título *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Tipo</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Versão</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="ex: v1.0" value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Conteúdo *</label>
            <RichTextEditor
              value={form.content}
              onChange={html => setForm(p => ({ ...p, content: html }))}
              placeholder="Digite o conteúdo do documento..."
              minHeight="150px"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancelar</button>
            <button
              onClick={() => createMut.mutate({ title: form.title, type: form.type, content: form.content, version: form.version || null })}
              disabled={!form.title || !form.content}
              className="px-4 py-2 text-sm rounded-lg text-white font-semibold disabled:opacity-50"
              style={{ background: "oklch(0.52 0.18 240)" }}
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ScrollText /></EmptyMedia>
            <EmptyTitle>Nenhum documento encontrado.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Header row */}
              <div
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => {
                  if (editingId === item.id) return;
                  setExpandedId(expandedId === item.id ? null : item.id);
                }}
              >
                <div className="flex-1 min-w-0">
                  {editingId === item.id ? (
                    <input
                      className="w-full border border-blue-300 rounded px-2 py-1 text-sm font-semibold outline-none focus:border-blue-500"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: "#0f172a" }}>{item.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[item.type] ?? "bg-gray-100 text-gray-600"}`}>
                        {TYPES.find(t => t.value === item.type)?.label ?? item.type}
                      </span>
                      {item.version && <span className="text-xs text-gray-400">{item.version}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.active === "sim" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                        {item.active === "sim" ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {editingId === item.id ? (
                    <>
                      <button
                        onClick={() => saveEdit(item.id)}
                        disabled={updateMut.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                        style={{ background: "#16a34a" }}
                      >
                        <Save size={12} /> Salvar
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(item)}
                        className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => { if (confirm("Remover documento?")) deleteMut.mutate({ id: item.id }); }}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                  {expandedId === item.id ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                </div>
              </div>

              {/* Expanded content */}
              {expandedId === item.id && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  {editingId === item.id ? (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Versão</label>
                        <input
                          className="border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-blue-400 w-32"
                          placeholder="ex: v1.0"
                          value={editVersion}
                          onChange={e => setEditVersion(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Conteúdo</label>
                        <RichTextEditor
                          value={editContent}
                          onChange={setEditContent}
                          minHeight="180px"
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      className="text-sm text-gray-700 mt-3 leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: item.content ?? "" }}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
