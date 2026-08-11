import { trpc } from "@/lib/trpc";
import {
  ChevronDown, ChevronUp, FileText, Plus, Trash2, X,
  Sparkles, CheckCircle2, AlertTriangle, ClipboardCheck,
  Check, BookOpen, Download, Pencil, Image, Upload, ZoomIn,
} from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import DashboardLayout from "../../components/DashboardLayout";
import { useLocation } from "wouter";
import { downloadPopAsPdf } from "@/lib/popPdf";
import RichTextEditor from "../../components/RichTextEditor";

const SECTORS = [
  "SOLDA","PINTURA","EXPEDIÇÃO","PROJETO","FIBRA","ROUTER","CO2",
  "DOBRADEIRA","FORNECEDOR","TRANSPORTE","INSTALAÇÃO","VENDAS","POLIMENTO",
  "Produção", "Logística", "Comercial", "Administrativo", "Qualidade",
];

const EMPTY_FORM = {
  code: "", title: "", sector: "Produção",
  objective: "", steps: "", responsible: "", version: "1.0",
};

function isAIGenerated(code: string): boolean {
  return /^POP-[A-Z]{2,3}-\d+$/.test(code);
}

function StepsRenderer({ steps }: { steps: string }) {
  // Se for HTML (TipTap), renderizar diretamente com estilos adequados
  if (steps.trim().startsWith("<")) {
    return (
      <div className="mt-3">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={13} className="text-slate-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Passos do Procedimento</span>
        </div>
        <div
          className="prose prose-sm max-w-none text-slate-700
            prose-p:text-slate-700 prose-p:leading-relaxed prose-p:my-1
            prose-ol:my-2 prose-ul:my-2
            prose-li:text-slate-700 prose-li:my-1
            prose-strong:text-slate-900 prose-strong:font-semibold
            prose-h2:text-slate-800 prose-h2:font-bold prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2
            prose-h3:text-slate-700 prose-h3:font-semibold prose-h3:text-sm prose-h3:mt-3 prose-h3:mb-1"
          dangerouslySetInnerHTML={{ __html: steps }}
        />
      </div>
    );
  }

  // Texto puro (legado) — parser de linhas
  const lines = steps.split("\n");
  const stepLines: { num: string; action: string; check: string }[] = [];
  const attentionLines: string[] = [];
  const criteriaLines: string[] = [];
  let section: "steps" | "attention" | "criteria" = "steps";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("⚠️") || trimmed.includes("PONTOS DE ATENÇÃO")) { section = "attention"; continue; }
    if (trimmed.startsWith("✅") || trimmed.includes("CRITÉRIO DE ACEITAÇÃO")) { section = "criteria"; continue; }

    if (section === "steps") {
      const stepMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
      const checkMatch = trimmed.match(/^\s*[✓•]\s+(.+)/);
      if (stepMatch) {
        stepLines.push({ num: stepMatch[1], action: stepMatch[2], check: "" });
      } else if (checkMatch && stepLines.length > 0) {
        stepLines[stepLines.length - 1].check = checkMatch[1];
      }
    } else if (section === "attention") {
      if (trimmed.startsWith("•")) attentionLines.push(trimmed.slice(1).trim());
      else if (trimmed) attentionLines.push(trimmed);
    } else if (section === "criteria") {
      criteriaLines.push(trimmed);
    }
  }

  if (stepLines.length > 0) {
    return (
      <div className="space-y-4 mt-3">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={13} className="text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Passos do Procedimento</span>
          </div>
          <div className="space-y-2">
            {stepLines.map((s) => (
              <div key={s.num} className="flex gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                  style={{ background: "oklch(0.52 0.18 240)", minWidth: 24 }}>
                  {s.num}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{s.action}</p>
                  {s.check && (
                    <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                      <Check size={11} className="flex-shrink-0" />
                      {s.check}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {attentionLines.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={13} className="text-amber-600" />
              <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Pontos de Atenção</span>
            </div>
            <ul className="space-y-1">
              {attentionLines.map((pt, i) => (
                <li key={i} className="text-sm text-amber-900 flex items-start gap-2">
                  <span className="mt-1 flex-shrink-0">•</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {criteriaLines.length > 0 && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={13} className="text-green-600" />
              <span className="text-xs font-bold uppercase tracking-wide text-green-700">Critério de Aceitação</span>
            </div>
            <p className="text-sm text-green-900 leading-relaxed">{criteriaLines.join(" ")}</p>
          </div>
        )}
      </div>
    );
  }

  return <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2 leading-relaxed">{steps}</p>;
}

// Modal de visualização de imagem ampliada
function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white" onClick={onClose}>
        <X size={20} />
      </button>
      <img
        src={url}
        alt="Anexo POP"
        className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

// Componente de edição inline do POP
function PopEditPanel({ item, onClose, onSaved }: {
  item: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [objective, setObjective] = useState(item.objective ?? "");
  const [steps, setSteps] = useState(item.steps);
  const [responsible, setResponsible] = useState(item.responsible ?? "");
  const [version, setVersion] = useState(item.version ?? "1.0");
  const [sector, setSector] = useState(item.sector);
  const updateMut = trpc.pops.updateContent.useMutation();

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({ id: item.id, title, objective: objective || null, steps, responsible: responsible || null, version, sector });
      toast.success("POP atualizado!");
      onSaved();
      onClose();
    } catch {
      toast.error("Erro ao salvar POP");
    }
  };

  return (
    <div className="border-t border-blue-100 bg-blue-50/30 px-4 py-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1">
          <Pencil size={12} /> Editando POP
        </span>
        <button onClick={onClose} className="p-1 rounded hover:bg-blue-100 text-blue-400">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Título</label>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
            value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Setor</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-white"
            value={sector} onChange={e => setSector(e.target.value)}>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Responsável</label>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
            value={responsible} onChange={e => setResponsible(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Versão</label>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
            value={version} onChange={e => setVersion(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Objetivo</label>
        <RichTextEditor
          value={objective}
          onChange={setObjective}
          placeholder="Descreva o objetivo deste procedimento..."
          minHeight="60px"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
          Passos / Procedimento
          <span className="ml-2 font-normal text-blue-500 normal-case">— use negrito, listas e títulos para organizar</span>
        </label>
        <RichTextEditor
          value={steps}
          onChange={setSteps}
          placeholder="Descreva os passos do procedimento. Use listas numeradas para cada passo e negrito para termos importantes..."
          minHeight="240px"
        />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 font-medium text-gray-600">
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={updateMut.isPending || !title || !steps}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white font-semibold disabled:opacity-50"
          style={{ background: "oklch(0.52 0.18 240)" }}
        >
          {updateMut.isPending ? "Salvando..." : <><Check size={14} /> Salvar Alterações</>}
        </button>
      </div>
    </div>
  );
}

// Componente de anexos de imagem
function PopAttachments({ item, onUpdated }: { item: any; onUpdated: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadMut = trpc.pops.uploadImage.useMutation();
  const removeMut = trpc.pops.removeImage.useMutation();

  let attachments: string[] = [];
  try { attachments = item.attachments ? JSON.parse(item.attachments) : []; } catch { attachments = []; }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande. Máximo 5MB."); return; }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await uploadMut.mutateAsync({ popId: item.id, fileName: file.name, fileBase64: base64, mimeType: file.type });
      toast.success("Imagem adicionada ao POP!");
      onUpdated();
    } catch {
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = async (url: string) => {
    if (!confirm("Remover esta imagem?")) return;
    try {
      await removeMut.mutateAsync({ popId: item.id, url });
      toast.success("Imagem removida.");
      onUpdated();
    } catch { toast.error("Erro ao remover imagem"); }
  };

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      {lightbox && <ImageLightbox url={lightbox} onClose={() => setLightbox(null)} />}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Image size={13} className="text-slate-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Imagens em Anexo ({attachments.length})
          </span>
        </div>
        <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${uploading ? "opacity-50 pointer-events-none" : "hover:bg-blue-50 text-blue-600 border border-blue-200"}`}>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
          {uploading ? <><Upload size={12} className="animate-bounce" /> Enviando...</> : <><Upload size={12} /> Adicionar Imagem</>}
        </label>
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Nenhuma imagem anexada. Clique em "Adicionar Imagem" para incluir fotos, diagramas ou referências visuais ao procedimento.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {attachments.map((url, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-square">
              <img src={url} alt={`Anexo ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => setLightbox(url)}
                  className="p-1.5 rounded-full bg-white/90 text-slate-700 hover:bg-white"
                  title="Ampliar"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  onClick={() => handleRemove(url)}
                  className="p-1.5 rounded-full bg-white/90 text-red-600 hover:bg-white"
                  title="Remover"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Pops() {
  const [, navigate] = useLocation();
  const [filterSector, setFilterSector] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filterType, setFilterType] = useState<"all" | "ai" | "manual">("all");

  const { data, isLoading, refetch } = trpc.pops.list.useQuery({ sector: filterSector || undefined });
  const createMut = trpc.pops.create.useMutation({
    onSuccess: () => { refetch(); setShowForm(false); setForm({ ...EMPTY_FORM }); toast.success("POP criado!"); }
  });
  const deleteMut = trpc.pops.delete.useMutation({ onSuccess: () => { refetch(); toast.success("POP removido."); } });
  const registrarAcessoMut = trpc.pops.registrarAcesso.useMutation();

  const allItems = data ?? [];

  const items = useMemo(() => {
    return allItems.filter(item => {
      if (filterType === "ai") return isAIGenerated(item.code);
      if (filterType === "manual") return !isAIGenerated(item.code);
      return true;
    });
  }, [allItems, filterType]);

  const aiCount = allItems.filter(i => isAIGenerated(i.code)).length;
  const manualCount = allItems.filter(i => !isAIGenerated(i.code)).length;
  const uniqueSectors = Array.from(new Set(allItems.map(i => i.sector))).sort();

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "oklch(0.52 0.18 240 / 0.1)" }}>
            <FileText size={18} style={{ color: "oklch(0.52 0.18 240)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#0f172a" }}>POPs</h1>
            <p className="text-sm text-gray-500">
              Procedimentos Operacionais Padrão —{" "}
              <span className="text-blue-600 font-medium">{allItems.length} total</span>
              {aiCount > 0 && (
                <span className="ml-2 text-purple-600 font-medium">
                  · {aiCount} gerado{aiCount !== 1 ? "s" : ""} por IA
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "oklch(0.52 0.18 240)" }}
        >
          <Plus size={15} /> Novo POP
        </button>
      </div>

      {/* Banner IA */}
      {aiCount === 0 && (
        <div className="mb-5 p-4 rounded-xl border flex items-start gap-3"
          style={{ background: "oklch(0.52 0.18 240 / 0.04)", borderColor: "oklch(0.52 0.18 240 / 0.15)" }}>
          <Sparkles size={18} style={{ color: "oklch(0.52 0.18 240)", flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "oklch(0.32 0.18 240)" }}>
              POPs gerados automaticamente por IA
            </p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Acesse a{" "}
              <button onClick={() => navigate("/biblioteca")} className="text-blue-600 underline font-medium">Biblioteca de Erros</button>
              , descreva a ação corretiva de cada erro e clique em{" "}
              <strong>Gerar POP</strong> — os procedimentos aparecerão aqui automaticamente.
            </p>
          </div>
        </div>
      )}

      {/* Filtros de tipo */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {[
          { key: "all", label: `Todos (${allItems.length})` },
          { key: "ai", label: `✨ Gerados por IA (${aiCount})` },
          { key: "manual", label: `Manual (${manualCount})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterType(key as any)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === key ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
            style={filterType === key ? { background: "oklch(0.52 0.18 240)" } : {}}
          >
            {label}
          </button>
        ))}
        {uniqueSectors.length > 0 && (
          <>
            <span className="text-slate-300 text-sm">|</span>
            <button
              onClick={() => setFilterSector("")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !filterSector ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
              style={!filterSector ? { background: "#64748b" } : {}}
            >
              Todos setores
            </button>
            {uniqueSectors.map(s => (
              <button
                key={s}
                onClick={() => setFilterSector(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterSector === s ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                style={filterSector === s ? { background: "#64748b" } : {}}
              >
                {s}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Form de criação */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Novo POP Manual</h3>
            <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Código *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="ex: POP-001" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Título *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Setor</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))}>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Responsável</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                value={form.responsible} onChange={e => setForm(p => ({ ...p, responsible: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Versão</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Objetivo</label>
            <RichTextEditor
              value={form.objective}
              onChange={v => setForm(p => ({ ...p, objective: v }))}
              placeholder="Descreva o objetivo deste procedimento..."
              minHeight="60px"
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
              Passos / Procedimento *
              <span className="ml-2 font-normal text-blue-500 normal-case">— use listas numeradas para cada passo</span>
            </label>
            <RichTextEditor
              value={form.steps}
              onChange={v => setForm(p => ({ ...p, steps: v }))}
              placeholder="Descreva os passos do procedimento. Use listas numeradas para cada passo..."
              minHeight="180px"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancelar</button>
            <button
              onClick={() => createMut.mutate({ code: form.code, title: form.title, sector: form.sector, objective: form.objective || null, steps: form.steps, responsible: form.responsible || null, version: form.version || null })}
              disabled={!form.code || !form.title || !form.steps.replace(/<[^>]+>/g, "").trim()}
              className="px-4 py-2 text-sm rounded-lg text-white font-semibold disabled:opacity-50"
              style={{ background: "oklch(0.52 0.18 240)" }}
            >
              Salvar POP
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <FileText size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm">Nenhum POP encontrado.</p>
          {filterType === "ai" && (
            <p className="text-xs text-slate-400 mt-2">
              Gere POPs automaticamente na{" "}
              <button onClick={() => navigate("/biblioteca")} className="text-blue-500 underline">Biblioteca de Erros</button>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const aiGen = isAIGenerated(item.code);
            const isExpanded = expandedId === item.id;
            const isEditing = editingId === item.id;
            return (
              <div key={item.id}
                className="bg-white border rounded-xl overflow-hidden"
                style={{ borderColor: aiGen ? "oklch(0.52 0.18 240 / 0.25)" : "#e2e8f0" }}>
                {/* Header do card */}
                <div className="flex items-center gap-3 p-4">
                  <button
                    className="flex items-center gap-3 flex-1 text-left hover:bg-gray-50/50 rounded-lg transition-colors -m-1 p-1"
                    onClick={() => {
                      if (!isExpanded) {
                        // Registrar visualização ao expandir
                        registrarAcessoMut.mutate({ popId: item.id, popCode: item.code, popTitle: item.title, tipo: "visualizacao" });
                      }
                      setExpandedId(isExpanded ? null : item.id);
                      if (isEditing) setEditingId(null);
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                      style={{ background: aiGen ? "oklch(0.52 0.18 240)" : "#64748b" }}
                    >
                      {aiGen ? <Sparkles size={16} /> : <FileText size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded"
                          style={{
                            background: aiGen ? "oklch(0.52 0.18 240 / 0.08)" : "#f1f5f9",
                            color: aiGen ? "oklch(0.42 0.18 240)" : "#475569",
                            border: `1px solid ${aiGen ? "oklch(0.52 0.18 240 / 0.2)" : "#e2e8f0"}`,
                          }}>
                          {item.code}
                        </span>
                        <span className="font-semibold text-sm" style={{ color: "#0f172a" }}>{item.title}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">{item.sector}</span>
                        {item.version && <span className="text-xs text-gray-400">v{item.version}</span>}
                        {aiGen && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "oklch(0.52 0.18 240 / 0.08)", color: "oklch(0.42 0.18 240)", border: "1px solid oklch(0.52 0.18 240 / 0.2)" }}>
                            <Sparkles size={10} /> Gerado por IA
                          </span>
                        )}
                      </div>
                      {item.objective && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{item.objective}</p>
                      )}
                    </div>
                  </button>
                  {/* Ações */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(isEditing ? null : item.id);
                        if (!isExpanded) setExpandedId(item.id);
                      }}
                      className={`p-1.5 rounded transition-colors ${isEditing ? "bg-blue-100 text-blue-600" : "hover:bg-blue-50 text-gray-400 hover:text-blue-500"}`}
                      title="Editar POP"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={async e => {
                        e.stopPropagation();
                        const toastId = toast.loading("Gerando PDF...");
                        try {
                          await downloadPopAsPdf(item);
                          // Registrar download
                          registrarAcessoMut.mutate({ popId: item.id, popCode: item.code, popTitle: item.title, tipo: "download" });
                          toast.success(`PDF do ${item.code} gerado!`, { id: toastId });
                        } catch (err) {
                          console.error("Erro ao gerar PDF:", err);
                          toast.error("Erro ao gerar PDF", { id: toastId });
                        }
                      }}
                      className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors"
                      title="Baixar POP em PDF"
                    >
                      <Download size={13} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); if (confirm("Remover POP?")) deleteMut.mutate({ id: item.id }); }}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remover POP"
                    >
                      <Trash2 size={13} />
                    </button>
                    <button
                      onClick={() => { setExpandedId(isExpanded ? null : item.id); if (isEditing) setEditingId(null); }}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Painel de edição */}
                {isEditing && (
                  <PopEditPanel
                    item={item}
                    onClose={() => setEditingId(null)}
                    onSaved={() => refetch()}
                  />
                )}

                {/* Conteúdo expandido */}
                {isExpanded && !isEditing && (
                  <div className="px-4 pb-5 border-t border-gray-100">
                    {item.objective && (
                      <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                        <div className="flex items-center gap-2 mb-1">
                          <ClipboardCheck size={13} className="text-blue-600" />
                          <span className="text-xs font-bold uppercase tracking-wide text-blue-600">Objetivo</span>
                        </div>
                        {item.objective.trim().startsWith("<") ? (
                          <div
                            className="text-sm text-blue-900 leading-relaxed prose prose-sm max-w-none prose-p:text-blue-900 prose-li:text-blue-900"
                            dangerouslySetInnerHTML={{ __html: item.objective }}
                          />
                        ) : (
                          <p className="text-sm text-blue-900 leading-relaxed">{item.objective}</p>
                        )}
                      </div>
                    )}
                    <StepsRenderer steps={item.steps} />
                    {item.responsible && (
                      <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                        <BookOpen size={11} />
                        Responsável: <strong>{item.responsible}</strong>
                      </p>
                    )}
                    <PopAttachments item={item} onUpdated={() => refetch()} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
