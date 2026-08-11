import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useState, useMemo, useEffect, useRef } from "react";
import { downloadPopParsedAsPdf } from "@/lib/popPdfFromParsed";
import RichTextEditor from "@/components/RichTextEditor";
import {
  Search, Pencil, Check, X, BookOpen, ChevronDown, ChevronRight,
  Wrench, Plus, Trash2, Sparkles, Loader2, ExternalLink,
  AlertTriangle, ClipboardCheck, GitMerge, Download,
  ImagePlus, ImageOff, Shield, Target, Eye,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "../../components/DashboardLayout";
import { useLocation, useSearch } from "wouter";
import * as XLSX from "xlsx";

const CATEGORY_COLORS: Record<string, { bg: string; border: string; dot: string; text: string; accent: string }> = {
  "SOLDA":       { bg: "#fff7ed", border: "#fed7aa", dot: "#f97316", text: "#c2410c", accent: "#ea580c" },
  "PINTURA":     { bg: "#faf5ff", border: "#e9d5ff", dot: "#a855f7", text: "#7e22ce", accent: "#9333ea" },
  "EXPEDIÇÃO":   { bg: "#eff6ff", border: "#bfdbfe", dot: "#3b82f6", text: "#1d4ed8", accent: "#2563eb" },
  "PROJETO":     { bg: "#eef2ff", border: "#c7d2fe", dot: "#6366f1", text: "#4338ca", accent: "#4f46e5" },
  "FIBRA":       { bg: "#f0fdf4", border: "#bbf7d0", dot: "#22c55e", text: "#15803d", accent: "#16a34a" },
  "ROUTER":      { bg: "#ecfeff", border: "#a5f3fc", dot: "#06b6d4", text: "#0e7490", accent: "#0891b2" },
  "CO2":         { bg: "#fff1f2", border: "#fecdd3", dot: "#ef4444", text: "#b91c1c", accent: "#dc2626" },
  "DOBRADEIRA":  { bg: "#fefce8", border: "#fef08a", dot: "#eab308", text: "#a16207", accent: "#ca8a04" },
  "FORNECEDOR":  { bg: "#f0fdfa", border: "#99f6e4", dot: "#14b8a6", text: "#0f766e", accent: "#0d9488" },
  "TRANSPORTE":  { bg: "#f0f9ff", border: "#bae6fd", dot: "#0ea5e9", text: "#0369a1", accent: "#0284c7" },
  "INSTALAÇÃO":  { bg: "#f7fee7", border: "#d9f99d", dot: "#84cc16", text: "#4d7c0f", accent: "#65a30d" },
  "VENDAS":      { bg: "#fff7ed", border: "#fed7aa", dot: "#fb923c", text: "#c2410c", accent: "#f97316" },
  "POLIMENTO":   { bg: "#f8fafc", border: "#e2e8f0", dot: "#64748b", text: "#475569", accent: "#475569" },
  "ILUMINAÇÃO":  { bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b", text: "#b45309", accent: "#d97706" },
};

const ALL_CATEGORIES = ["SOLDA","PINTURA","EXPEDIÇÃO","PROJETO","FIBRA","ROUTER","CO2","DOBRADEIRA","FORNECEDOR","TRANSPORTE","INSTALAÇÃO","VENDAS","POLIMENTO","ILUMINAÇÃO","OUTROS"];

function getColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? { bg: "#f8fafc", border: "#e2e8f0", dot: "#64748b", text: "#475569", accent: "#475569" };
}

type ErrorItem = { id: number; code: string; category: string; description: string; correction: string; imageUrl?: string | null; imageKey?: string | null };
type PopItem = { id: number; code: string; title: string; sector: string };

type GeneratedPop = {
  action?: "created" | "updated";
  popCode: string;
  title: string;
  newVersion?: string;
  stepsText: string;
  errorImages?: Array<{ code: string; description: string; imageUrl: string }>;
  parsed: {
    title?: string;
    objective: string;
    steps: Array<{ step: number; action: string; check: string }>;
    attention_points: string[];
    acceptance_criteria: string;
  };
};

const EMPTY_NEW = { code: "", category: "SOLDA", description: "", correction: "", newCategory: "" };

// Modal de visualização do POP gerado/atualizado
function PopPreviewModal({ pop, mode, onClose }: { pop: GeneratedPop; mode: "generated" | "incorporated"; onClose: () => void }) {
  const [, navigate] = useLocation();
  const [exporting, setExporting] = useState(false);
  const col = getColor(pop.popCode.replace("POP-", ""));
  const accentColor = col.accent;

  const handleExportPdf = () => {
    setExporting(true);
    try {
      downloadPopParsedAsPdf({
        popCode: pop.popCode,
        title: pop.parsed.title ?? pop.title,
        version: pop.newVersion ?? "1.0",
        sector: pop.popCode.replace("POP-", ""),
        parsed: pop.parsed,
      });
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      console.error("Erro ao exportar PDF:", err);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setExporting(false);
    }
  };

  const title = pop.parsed.title ?? pop.title;
  const version = pop.newVersion ?? "1.0";
  const sector = pop.popCode.replace("POP-", "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header do modal */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100" style={{ borderTop: `4px solid ${accentColor}` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${accentColor}18` }}>
              {mode === "generated" ? <Sparkles size={20} style={{ color: accentColor }} /> : <GitMerge size={20} style={{ color: accentColor }} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded" style={{ background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}40` }}>
                  {pop.popCode}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">v{version}</span>
                {mode === "generated" ? (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    pop.action === "created"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    {pop.action === "created" ? "✨ POP Criado" : "🔄 POP Atualizado"}
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    🔀 Incorporado {pop.newVersion ? `→ v${pop.newVersion}` : ""}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-slate-800 mt-1 text-base leading-tight">{title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Setor: {sector} • {new Date().toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors ml-2 flex-shrink-0">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Conteúdo do modal */}
        <div className="flex-1 overflow-y-auto">
          {/* Objetivo */}
          <div className="mx-5 mt-5">
            <div className="rounded-xl p-4 border" style={{ background: `${accentColor}08`, borderColor: `${accentColor}30`, borderLeft: `4px solid ${accentColor}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Target size={15} style={{ color: accentColor }} />
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: accentColor }}>Objetivo do Procedimento</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">{pop.parsed.objective}</p>
            </div>
          </div>

          {/* Passos */}
          <div className="mx-5 mt-5">
            <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: `2px solid ${accentColor}` }}>
              <ClipboardCheck size={15} style={{ color: accentColor }} />
              <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Passos do Procedimento</span>
              <span className="ml-auto text-xs text-slate-400">{pop.parsed.steps.length} passos</span>
            </div>
            <div className="space-y-2">
              {pop.parsed.steps.map((s, idx) => (
                <div key={s.step} className="flex gap-0 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                  {/* Número */}
                  <div className="w-12 flex-shrink-0 flex items-start justify-center pt-3.5" style={{ background: accentColor }}>
                    <span className="text-lg font-black text-white">{s.step}</span>
                  </div>
                  {/* Conteúdo */}
                  <div className={`flex-1 p-3.5 ${idx % 2 === 0 ? "bg-slate-50" : "bg-white"}`}>
                    <p className="text-sm font-semibold text-slate-800 leading-relaxed mb-2">{s.action}</p>
                    <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: "#f0fdf4", borderLeft: "3px solid #16a34a" }}>
                      <Check size={12} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-green-800 leading-relaxed">{s.check}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pontos de atenção */}
          {pop.parsed.attention_points.length > 0 && (
            <div className="mx-5 mt-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={15} className="text-amber-600" />
                  <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Pontos de Atenção</span>
                </div>
                <ul className="space-y-2">
                  {pop.parsed.attention_points.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold flex-shrink-0 mt-0.5">▸</span>
                      <span className="text-sm text-amber-900 leading-relaxed">{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Imagens de referência */}
          {pop.errorImages && pop.errorImages.length > 0 && (
            <div className="mx-5 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye size={14} className="text-slate-500" />
                <span className="text-xs font-bold uppercase tracking-wide text-slate-600">Imagens de Referência</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {pop.errorImages.map(img => (
                  <div key={img.code} className="border border-slate-200 rounded-xl overflow-hidden max-w-[180px] bg-slate-50 shadow-sm hover:shadow-md transition-shadow">
                    <div className="bg-slate-100 p-2 flex items-center justify-center h-32">
                      <img
                        src={img.imageUrl}
                        alt={img.code}
                        className="max-h-28 max-w-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(img.imageUrl, "_blank")}
                        title="Clique para ampliar"
                      />
                    </div>
                    <div className="p-2 border-t border-slate-200">
                      <p className="text-xs font-bold text-slate-700">{img.code}</p>
                      <p className="text-xs text-slate-500 truncate">{img.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Critério de aceitação */}
          <div className="mx-5 mt-4 mb-5">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4" style={{ borderLeft: "4px solid #16a34a" }}>
              <div className="flex items-center gap-2 mb-2">
                <Shield size={15} className="text-green-600" />
                <span className="text-xs font-bold uppercase tracking-wide text-green-700">Critério de Aceitação</span>
              </div>
              <p className="text-sm text-green-900 leading-relaxed font-medium">{pop.parsed.acceptance_criteria}</p>
            </div>
          </div>
        </div>

        {/* Footer do modal */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <p className="text-xs text-slate-500">
            POP salvo em <strong>Operações → POPs</strong>
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-white transition-colors font-medium text-slate-600">
              Fechar
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-semibold transition-colors text-white"
              style={{ background: exporting ? "#94a3b8" : accentColor }}
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {exporting ? "Exportando..." : "Exportar PDF"}
            </button>
            <button
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg text-white font-semibold transition-colors"
              style={{ background: "#0f172a" }}
              onClick={() => { onClose(); navigate("/pops"); }}>
              <ExternalLink size={14} />
              Ver POPs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal de seleção de POP para incorporar
function IncorporateModal({
  item,
  pops,
  onClose,
}: {
  item: ErrorItem;
  pops: PopItem[];
  onClose: () => void;
}) {
  const [selectedPopId, setSelectedPopId] = useState<number | null>(null);
  const [result, setResult] = useState<GeneratedPop | null>(null);
  const incorporateMut = trpc.pops.incorporateError.useMutation();
  const utils = trpc.useUtils();

  const handleIncorporate = async () => {
    if (!selectedPopId) return;
    try {
      toast.info("Incorporando conhecimento ao POP... Aguarde.", { duration: 10000 });
      const res = await incorporateMut.mutateAsync({
        popId: selectedPopId,
        errorCode: item.code,
        errorDescription: item.description,
        errorCategory: item.category,
        correction: item.correction,
      });
      utils.pops.list.invalidate();
      setResult(res as GeneratedPop);
      toast.success(`Conhecimento incorporado ao POP ${res.popCode} (v${res.newVersion})`);
    } catch (err: any) {
      toast.error("Erro ao incorporar: " + (err?.message ?? "tente novamente"));
    }
  };

  if (result) {
    return <PopPreviewModal pop={result} mode="incorporated" onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <GitMerge size={18} style={{ color: "oklch(0.52 0.18 240)" }} />
            <h3 className="font-bold text-slate-800">Incorporar a POP Existente</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X size={16} className="text-slate-400" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Erro selecionado</p>
            <p className="text-sm font-semibold text-slate-800">{item.code} — {item.description}</p>
            <p className="text-xs text-green-700 mt-1 line-clamp-2">{item.correction}</p>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
              Selecione o POP que receberá este conhecimento *
            </label>
            {pops.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Nenhum POP cadastrado ainda. Crie um POP primeiro.</p>
            ) : (
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 bg-white"
                value={selectedPopId ?? ""}
                onChange={e => setSelectedPopId(Number(e.target.value) || null)}
              >
                <option value="">— Escolha um POP —</option>
                {pops.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.title} ({p.sector})
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            A IA irá ler o POP selecionado e incorporar o conhecimento deste erro de forma complementar,
            sem remover o conteúdo existente. A versão do POP será incrementada automaticamente.
          </p>
        </div>
        <div className="flex gap-2 justify-end p-5 pt-0">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 font-medium text-slate-600">
            Cancelar
          </button>
          <button
            onClick={handleIncorporate}
            disabled={!selectedPopId || incorporateMut.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white font-semibold disabled:opacity-50 transition-colors"
            style={{ background: "oklch(0.52 0.18 240)" }}
          >
            {incorporateMut.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Incorporando...</>
            ) : (
              <><GitMerge size={14} /> Incorporar com IA</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ErrorRow({
  item,
  canEdit,
  pops,
  temPlano,
  onDelete,
}: {
  item: ErrorItem;
  canEdit: boolean;
  pops: PopItem[];
  temPlano?: boolean;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.correction);
  const [titleValue, setTitleValue] = useState(item.description);
  const [showIncorporate, setShowIncorporate] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const updateMut = trpc.errorLibrary.updateItem.useMutation();
  const uploadImageMut = trpc.errorLibrary.uploadImage.useMutation();
  const removeImageMut = trpc.errorLibrary.removeImage.useMutation();
  const utils = trpc.useUtils();
  const col = getColor(item.category);

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem válida."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande. Máximo 5MB."); return; }
    setUploadingImg(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        await uploadImageMut.mutateAsync({ code: item.code, fileName: file.name, fileBase64: base64, mimeType: file.type });
        utils.errorLibrary.list.invalidate();
        toast.success("Imagem de referência salva!");
        setUploadingImg(false);
      };
      reader.readAsDataURL(file);
    } catch { toast.error("Erro ao fazer upload da imagem."); setUploadingImg(false); }
  };

  const handleRemoveImage = async () => {
    if (!confirm("Remover imagem de referência?")) return;
    try {
      await removeImageMut.mutateAsync({ code: item.code });
      utils.errorLibrary.list.invalidate();
      toast.success("Imagem removida.");
    } catch { toast.error("Erro ao remover imagem."); }
  };

  const save = async () => {
    // Remove tags HTML para validar se há conteúdo real
    const plainText = value.replace(/<[^>]+>/g, "").trim();
    if (!plainText || !titleValue.trim()) return;
    try {
      await updateMut.mutateAsync({ code: item.code, description: titleValue.trim(), correction: value.trim() });
      utils.errorLibrary.list.invalidate();
      toast.success(`Erro "${item.code}" atualizado`);
      setEditing(false);
    } catch { toast.error("Erro ao salvar"); }
  };

  return (
    <>
      {showIncorporate && (
        <IncorporateModal item={item} pops={pops} onClose={() => setShowIncorporate(false)} />
      )}
      <div className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors border-b border-slate-100 last:border-0">
        <div className="shrink-0 mt-0.5 flex flex-col items-start gap-1">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded"
            style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>
            {item.code}
          </span>
          {temPlano && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-300 whitespace-nowrap">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Plano de Ação
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              type="text"
              className="w-full text-sm font-medium p-1.5 mb-2 rounded border border-blue-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              autoFocus
              placeholder="Título do erro..."
            />
          ) : (
            <p className="text-sm font-medium text-slate-800 mb-1.5">{item.description}</p>
          )}
          <div className="flex items-start gap-1.5">
            <Wrench className="w-3 h-3 mt-0.5 shrink-0 text-green-600" />
            {editing ? (
              <div className="flex-1 space-y-2">
                <RichTextEditor
                  value={value}
                  onChange={v => setValue(v)}
                  placeholder="Descreva detalhadamente como corrigir e prevenir este erro..."
                  minHeight="120px"
                />
                <div className="flex gap-1.5">
                  <button onClick={save} disabled={updateMut.isPending}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    <Check className="w-3 h-3" />{updateMut.isPending ? "Salvando..." : "Salvar"}
                  </button>
                  <button onClick={() => { setValue(item.correction); setTitleValue(item.description); setEditing(false); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                    <X className="w-3 h-3" />Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="text-xs text-green-700 leading-relaxed flex-1 prose prose-xs max-w-none"
                dangerouslySetInnerHTML={{ __html: item.correction }}
              />
            )}
          </div>
          {/* Imagem de referência */}
          {item.imageUrl && (
            <div className="mt-2 relative group w-fit">
              <img
                src={item.imageUrl}
                alt={`Referência ${item.code}`}
                className="max-h-40 rounded-lg border border-slate-200 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(item.imageUrl!, "_blank")}
                title="Clique para ampliar"
              />
              {canEdit && (
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 p-1 rounded bg-white/80 border border-red-200 text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remover imagem"
                >
                  <ImageOff className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
        {canEdit && !editing && (
          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
            {/* Botão Incorporar a POP existente */}
            {pops.length > 0 && (
              <button
                onClick={() => setShowIncorporate(true)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors border"
                style={{
                  background: "oklch(0.55 0.15 280 / 0.08)",
                  borderColor: "oklch(0.55 0.15 280 / 0.3)",
                  color: "oklch(0.45 0.15 280)",
                }}
                title="Incorporar este conhecimento a um POP existente"
              >
                <GitMerge className="w-3 h-3" />
                Incorporar
              </button>
            )}
            {/* Botão upload de imagem */}
            <label
              className="p-1.5 rounded text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
              title={item.imageUrl ? "Substituir imagem de referência" : "Adicionar imagem de referência"}
            >
              {uploadingImg
                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                : <ImagePlus className="w-3.5 h-3.5" style={{ color: item.imageUrl ? "#10b981" : undefined }} />
              }
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
              />
            </label>
            <button onClick={() => setEditing(true)}
              className="p-1.5 rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Editar ação corretiva">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete}
              className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Remover erro">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function BibliotecaErros() {
  const { data: errorLib, isLoading, refetch } = trpc.errorLibrary.list.useQuery();
  const { data: popsList } = trpc.pops.list.useQuery({});
  const { data: planosAcaoList = [] } = trpc.planosAcao.list.useQuery({});
  const createMut = trpc.errorLibrary.create.useMutation({
    onSuccess: () => {
      refetch();
      setShowNew(false);
      setNewForm({ ...EMPTY_NEW });
      toast.success("Erro cadastrado na biblioteca!");
    },
    onError: (err) => {
      const msg = err.message ?? "";
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("already") || msg.toLowerCase().includes("entry")) {
        toast.error(`Código "${newForm.code}" já existe na biblioteca. Use um código diferente.`);
      } else if (msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("login")) {
        toast.error("Você precisa estar logado para cadastrar erros.");
      } else {
        toast.error(`Erro ao cadastrar: ${msg || "Tente novamente."}`);
      }
    }
  });
  const deleteMut = trpc.errorLibrary.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Erro removido."); } });
  const generateCategoryPopMut = trpc.pops.generateFromCategory.useMutation();
  const utilsMain = trpc.useUtils();
  const [categoryPopResult, setCategoryPopResult] = useState<{ cat: string; pop: GeneratedPop } | null>(null);
  const [generatingCat, setGeneratingCat] = useState<string | null>(null);
  // Mapear todos os códigos de erro que têm plano de ação vinculado
  const codigosComPlano = new Set<string>(
    (planosAcaoList as any[]).flatMap((p: any) => {
      const extras: string[] = (() => { try { return JSON.parse(p.codigosErro || "[]"); } catch { return []; } })();
      const prev: string[] = (() => { try { return JSON.parse(p.errosPrevenidos || "[]"); } catch { return []; } })();
      const res: string[] = (() => { try { return JSON.parse(p.errosResolvidos || "[]"); } catch { return []; } })();
      return [p.codigoErro, ...extras, ...prev, ...res].filter(Boolean);
    })
  );
  const { user } = useAuth();
  const canEdit = !!user;
  const [search, setSearch] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [highlightCode, setHighlightCode] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const searchStr = useSearch();

  // Ao montar ou mudar query string, expandir categoria e destacar o item
  useEffect(() => {
    const params = new URLSearchParams(searchStr);
    const codigo = params.get("codigo");
    if (!codigo || !errorLib) return;
    const item = errorLib.find(e => e.code === codigo);
    if (!item) return;
    setHighlightCode(codigo);
    setExpandedCats(prev => { const n = new Set(prev); n.add(item.category); return n; });
    setTimeout(() => {
      if (highlightRef.current) {
        highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 350);
  }, [searchStr, errorLib]);

  const handleGenerateCategoryPop = async (category: string, items: ErrorItem[]) => {
    const withCorrection = items.filter(e => e.correction && e.correction.trim().length >= 5);
    if (withCorrection.length === 0) {
      toast.error("Cadastre ações corretivas nos erros desta categoria antes de gerar o POP.");
      return;
    }
    setGeneratingCat(category);
    try {
      toast.info(`Gerando POP da categoria ${category}... Aguarde.`, { duration: 12000 });
      const result = await generateCategoryPopMut.mutateAsync({
        category,
        errors: withCorrection.map(e => ({ code: e.code, description: e.description, correction: e.correction, imageUrl: e.imageUrl ?? null })),
      });
  
      utilsMain.pops.list.invalidate();
      setCategoryPopResult({ cat: category, pop: result as GeneratedPop });
      toast.success(`POP da categoria ${category} ${result.action === "created" ? "criado" : "atualizado"}: ${result.popCode}`);
    } catch (err: any) {
      toast.error("Erro ao gerar POP: " + (err?.message ?? "tente novamente"));
    } finally {
      setGeneratingCat(null);
    }
  };
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ ...EMPTY_NEW });
  const [customCats, setCustomCats] = useState<string[]>([]);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [filtroTipoRegistro, setFiltroTipoRegistro] = useState<"todos" | "retrabalho" | "cnq">("todos");

  const allAvailableCats = [...ALL_CATEGORIES, ...customCats.filter(c => !ALL_CATEGORIES.includes(c))];

  const pops: PopItem[] = (popsList ?? []).map(p => ({ id: p.id, code: p.code, title: p.title, sector: p.sector }));

  const grouped = useMemo(() => {
    const filtered = (errorLib ?? []).filter(e => {
      // Filtro por tipo de registro
      if (filtroTipoRegistro !== "todos" && (e as any).tipoRegistro !== filtroTipoRegistro) return false;
      if (!search) return true;
      return e.code.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        e.category.toLowerCase().includes(search.toLowerCase()) ||
        e.correction.toLowerCase().includes(search.toLowerCase());
    });
    const map = new Map<string, ErrorItem[]>();
    for (const e of filtered) {
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [errorLib, search, filtroTipoRegistro]);

  const allCats = grouped.map(([cat]) => cat);
  const toggleCat = (cat: string) => {
    setExpandedCats(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "oklch(0.52 0.18 240 / 0.1)" }}>
            <BookOpen size={18} style={{ color: "oklch(0.52 0.18 240)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#0f172a" }}>Biblioteca de Erros e CNQ</h1>
            <p className="text-sm text-gray-500">
              {errorLib?.length ?? 0} itens em {grouped.length} categorias
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setExpandedCats(new Set(allCats))} className="text-xs text-blue-600 hover:underline">Expandir tudo</button>
          <span className="text-slate-300">|</span>
          <button onClick={() => setExpandedCats(new Set())} className="text-xs text-slate-500 hover:underline">Recolher</button>
          {/* Botão Exportar Excel */}
          <button
            onClick={() => {
              const allErrors = (errorLib ?? []);
              if (allErrors.length === 0) { toast.error("Nenhum erro para exportar."); return; }
              const wsData = [
                ["Código", "Categoria", "Descrição", "Ação / Correção"],
                ...allErrors.map(e => [e.code, e.category, e.description, e.correction]),
              ];
              const ws = XLSX.utils.aoa_to_sheet(wsData);
              ws["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 60 }, { wch: 80 }];
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Biblioteca de Erros");
              const today = new Date().toISOString().slice(0, 10);
              XLSX.writeFile(wb, `biblioteca-erros-${today}.xlsx`);
              toast.success(`${allErrors.length} erros exportados com sucesso!`);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-colors ml-1"
          >
            <Download size={14} /> Exportar Excel
          </button>
          <button
            onClick={() => setShowNew(!showNew)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white ml-1"
            style={{ background: "oklch(0.52 0.18 240)" }}
          >
            <Plus size={15} /> Novo Erro
          </button>
        </div>
      </div>

      {/* Banner explicativo */}
      {canEdit && (
        <div className="mb-5 p-4 rounded-xl border" style={{ background: "oklch(0.52 0.18 240 / 0.04)", borderColor: "oklch(0.52 0.18 240 / 0.15)" }}>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Sparkles size={16} style={{ color: "oklch(0.52 0.18 240)", flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-xs font-bold text-slate-700 mb-0.5">✨ Gerar POP</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Cria um novo Procedimento Operacional Padrão para a categoria, com passos, pontos de atenção e critério de aceitação — preservando integralmente as instruções cadastradas.
                </p>
              </div>
            </div>
            <div className="w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-start gap-3 flex-1">
              <GitMerge size={16} style={{ color: "oklch(0.55 0.15 280)", flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-xs font-bold text-slate-700 mb-0.5">🔀 Incorporar</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enriquece um POP já existente com o conhecimento deste erro, sem apagar o conteúdo anterior. Versão incrementada automaticamente.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Error Form */}
      {showNew && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Cadastrar Novo Perfil de Erro</h3>
            <button onClick={() => setShowNew(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Código *</label>
              <input
                className={`w-full border rounded-lg px-3 py-2 text-sm outline-none font-mono ${
                  newForm.code && (errorLib ?? []).some(e => e.code === newForm.code)
                    ? "border-red-400 bg-red-50 focus:border-red-500"
                    : "border-gray-200 focus:border-blue-400"
                }`}
                placeholder="ex: ES-10, EP-05"
                value={newForm.code}
                onChange={e => setNewForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
              />
              {newForm.code && (errorLib ?? []).some(e => e.code === newForm.code) && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <span>⚠️</span> Código já existe na biblioteca
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Categoria *</label>
              {addingCat ? (
                <div className="flex gap-1">
                  <input
                    autoFocus
                    className="flex-1 border border-blue-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 uppercase"
                    placeholder="Nova categoria..."
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value.toUpperCase())}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newCatName.trim()) {
                        const cat = newCatName.trim().toUpperCase();
                        setCustomCats(prev => prev.includes(cat) ? prev : [...prev, cat]);
                        setNewForm(p => ({ ...p, category: cat }));
                        setNewCatName("");
                        setAddingCat(false);
                      } else if (e.key === "Escape") {
                        setAddingCat(false);
                        setNewCatName("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cat = newCatName.trim().toUpperCase();
                      if (cat) {
                        setCustomCats(prev => prev.includes(cat) ? prev : [...prev, cat]);
                        setNewForm(p => ({ ...p, category: cat }));
                      }
                      setNewCatName("");
                      setAddingCat(false);
                    }}
                    className="px-2 py-1 rounded-lg text-white text-xs font-semibold"
                    style={{ background: "oklch(0.52 0.18 240)" }}
                  >
                    <Check size={14} />
                  </button>
                  <button type="button" onClick={() => { setAddingCat(false); setNewCatName(""); }} className="px-2 py-1 rounded-lg border border-gray-200 text-xs">
                    <X size={14} className="text-gray-400" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <select
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                    value={newForm.category}
                    onChange={e => setNewForm(p => ({ ...p, category: e.target.value }))}
                  >
                    {allAvailableCats.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAddingCat(true)}
                    className="px-2 py-1 rounded-lg border border-dashed border-blue-300 text-blue-500 hover:bg-blue-50 text-xs flex items-center gap-1"
                    title="Criar nova categoria"
                  >
                    <Plus size={13} /> Nova
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Descrição do Erro *</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="Descreva o tipo de erro"
                value={newForm.description}
                onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
              Ação Corretiva *
              <span className="ml-2 font-normal text-blue-500 normal-case">
                — quanto mais detalhada, melhor o POP gerado pela IA
              </span>
            </label>
            <RichTextEditor
              value={newForm.correction}
              onChange={v => setNewForm(p => ({ ...p, correction: v }))}
              placeholder="Descreva passo a passo como corrigir e prevenir este erro..."
              minHeight="120px"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancelar</button>
            <button
              onClick={() => createMut.mutate({ code: newForm.code, category: newForm.category, description: newForm.description, correction: newForm.correction, tipoRegistro: filtroTipoRegistro === "cnq" ? "cnq" : "retrabalho" })}
              disabled={!newForm.code || !newForm.description || !newForm.correction.replace(/<[^>]+>/g, "").trim() || createMut.isPending || !!(newForm.code && (errorLib ?? []).some(e => e.code === newForm.code))}
              className="px-4 py-2 text-sm rounded-lg text-white font-semibold disabled:opacity-50"
              style={{ background: "oklch(0.52 0.18 240)" }}
            >
              {createMut.isPending ? "Salvando..." : "Cadastrar Erro"}
            </button>
          </div>
        </div>
      )}

      {/* Filtro Retrabalho / CNQ */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo:</span>
        {(["todos", "retrabalho", "cnq"] as const).map(t => (
          <button
            key={t}
            onClick={() => setFiltroTipoRegistro(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filtroTipoRegistro === t
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t === "todos" ? "Todos" : t === "retrabalho" ? "Retrabalho" : "CNQ"}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all"
          placeholder="Buscar por código, categoria ou descrição..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {grouped.map(([cat, items]) => {
          const col = getColor(cat);
          return (
            <button key={cat} onClick={() => toggleCat(cat)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:shadow-sm"
              style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text }}>
              <span className="w-2 h-2 rounded-full" style={{ background: col.dot }} />
              {cat} <span className="opacity-60">({items.length})</span>
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && grouped.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhum erro encontrado{search ? ` para "${search}"` : ""}.</p>
        </div>
      )}

      {/* Modal de resultado da geração de POP por categoria */}
      {categoryPopResult && (
        <PopPreviewModal
          pop={categoryPopResult.pop}
          mode="generated"
          onClose={() => setCategoryPopResult(null)}
        />
      )}

      {/* Categories */}
      <div className="space-y-3">
        {grouped.map(([category, items]) => {
          const col = getColor(category);
          const isOpen = expandedCats.has(category);
          const isGenerating = generatingCat === category;
          return (
            <div key={category} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                style={{ borderLeft: `4px solid ${col.dot}` }}
              >
                <button
                  onClick={() => toggleCat(category)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <span className="font-bold text-slate-800 text-sm tracking-wide">{category}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>
                    {items.length} erro{items.length !== 1 ? "s" : ""}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleGenerateCategoryPop(category, items); }}
                      disabled={isGenerating || generatingCat !== null}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors border"
                      style={{
                        background: isGenerating ? "#f1f5f9" : "oklch(0.52 0.18 240 / 0.08)",
                        borderColor: "oklch(0.52 0.18 240 / 0.3)",
                        color: isGenerating ? "#94a3b8" : "oklch(0.42 0.18 240)",
                      }}
                      title={`Gerar POP unificado para a categoria ${category}`}
                    >
                      {isGenerating
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Sparkles className="w-3 h-3" />
                      }
                      {isGenerating ? "Gerando..." : "Gerar POP"}
                    </button>
                  )}
                  <button onClick={() => toggleCat(category)} className="p-1">
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-slate-400" />
                      : <ChevronRight className="w-4 h-4 text-slate-400" />
                    }
                  </button>
                </div>
              </div>

              {isOpen && (
                <div>
                  {items.map(item => {
                    const isHighlighted = highlightCode === item.code;
                    return (
                      <div
                        key={item.id}
                        ref={isHighlighted ? highlightRef : null}
                        className={isHighlighted ? "ring-2 ring-blue-400 ring-offset-1 rounded-lg transition-all duration-500" : ""}
                      >
                        <ErrorRow
                          item={item}
                          canEdit={canEdit}
                          pops={pops}
                          temPlano={codigosComPlano.has(item.code)}
                          onDelete={() => { if (confirm(`Remover erro ${item.code}?`)) deleteMut.mutate({ id: item.id }); }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
