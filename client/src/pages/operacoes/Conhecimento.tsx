import { trpc } from "@/lib/trpc";
import {
  BookOpen, Brain, ChevronDown, ChevronUp, Plus, Search, Tag,
  Trash2, X, MessageSquare, Send, Download, FileText, Loader2, Edit2, Save,
  Sparkles, CheckCircle, AlertCircle, Lightbulb, ThumbsUp, FolderOpen, Eye, ExternalLink
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import DashboardLayout from "../../components/DashboardLayout";
import RichTextEditor from "../../components/RichTextEditor";
import { useLocalAuth } from "@/contexts/LocalAuthContext";

const CATEGORIES = ["Comercial", "Administrativo", "Financeiro", "Produção", "Logística", "RH", "TI", "Geral"];

// ─── PDF Export ───────────────────────────────────────────────────────────────

async function exportArticleToPdf(article: {
  title: string;
  category: string;
  content: string;
  keywords?: string | null;
  createdAt?: string | Date;
}, comments: { author: string; content: string; createdAt: string | Date }[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = 210;
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  let y = 20;

  // Header bar
  doc.setFillColor(30, 64, 175); // blue-800
  doc.rect(0, 0, pageW, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("BASE DE CONHECIMENTO — LETREIROS EXPRESS", marginL, 9);
  doc.text(new Date().toLocaleDateString("pt-BR"), pageW - marginR, 9, { align: "right" });

  y = 26;

  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(article.title, contentW);
  doc.text(titleLines, marginL, y);
  y += titleLines.length * 8 + 4;

  // Category badge
  doc.setFillColor(219, 234, 254); // blue-100
  doc.setDrawColor(147, 197, 253); // blue-300
  doc.roundedRect(marginL, y, 40, 7, 2, 2, "FD");
  doc.setTextColor(29, 78, 216); // blue-700
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(article.category, marginL + 3, y + 4.5);
  y += 12;

  // Keywords
  if (article.keywords) {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Palavras-chave: ${article.keywords}`, marginL, y);
    y += 8;
  }

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(marginL, y, pageW - marginR, y);
  y += 6;

  // Content
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const contentLines = doc.splitTextToSize(article.content, contentW);
  for (const line of contentLines) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, marginL, y);
    y += 5.5;
  }

  // Comments section
  if (comments.length > 0) {
    y += 6;
    if (y > 260) { doc.addPage(); y = 20; }

    doc.setDrawColor(226, 232, 240);
    doc.line(marginL, y, pageW - marginR, y);
    y += 6;

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Comentários e Notas da Equipe (${comments.length})`, marginL, y);
    y += 8;

    for (const c of comments) {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      const commentLines = doc.splitTextToSize(c.content, contentW - 6);
      const boxH = commentLines.length * 5 + 12;
      doc.roundedRect(marginL, y, contentW, boxH, 2, 2, "FD");

      doc.setTextColor(71, 85, 105);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(c.author, marginL + 3, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(new Date(c.createdAt).toLocaleDateString("pt-BR"), marginL + 3 + doc.getTextWidth(c.author) + 3, y + 5);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
      doc.text(commentLines, marginL + 3, y + 10);
      y += boxH + 4;
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 285, pageW, 12, "F");
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Letreiros Express — Documento gerado automaticamente", marginL, 291);
    doc.text(`Página ${i} de ${pageCount}`, pageW - marginR, 291, { align: "right" });
  }

  const filename = `${article.title.replace(/[^a-zA-Z0-9\u00C0-\u00FF ]/g, "").trim().replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}

// ─── CommentsSection ──────────────────────────────────────────────────────────

function CommentsSection({ articleId }: { articleId: number }) {
  const [newComment, setNewComment] = useState("");
  const [author, setAuthor] = useState("Equipe");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: comments, refetch } = trpc.knowledgeComments.list.useQuery({ knowledgeId: articleId });
  const createMut = trpc.knowledgeComments.create.useMutation({
    onSuccess: () => { refetch(); setNewComment(""); toast.success("Comentário adicionado!"); },
    onError: () => toast.error("Erro ao adicionar comentário."),
  });
  const deleteMut = trpc.knowledgeComments.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Comentário removido."); },
  });

  const list = comments ?? [];

  function handleSubmit() {
    if (!newComment.trim()) return;
    createMut.mutate({ knowledgeId: articleId, author: author.trim() || "Equipe", content: newComment.trim() });
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={13} className="text-gray-400" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Comentários e Notas da Equipe ({list.length})
        </span>
      </div>

      {list.length > 0 && (
        <div className="space-y-2 mb-3">
          {list.map(c => (
            <div key={c.id} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-slate-700">{c.author}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(c.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                </div>
                <button
                  onClick={() => { if (confirm("Remover este comentário?")) deleteMut.mutate({ id: c.id }); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-all shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add comment form */}
      <div className="space-y-2">
        <input
          ref={inputRef}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-400 bg-white"
          placeholder="Seu nome (ex: João, Equipe Comercial)"
          value={author}
          onChange={e => setAuthor(e.target.value)}
          maxLength={64}
        />
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
            placeholder="Adicionar nota ou comentário..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || createMut.isPending}
            className="px-3 py-2 rounded-lg text-white disabled:opacity-40 transition-colors flex items-center gap-1.5 text-sm font-medium"
            style={{ background: "oklch(0.52 0.18 240)" }}
          >
            {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ArticleCard ──────────────────────────────────────────────────────────────

function ArticleCard({
  item,
  expanded,
  onToggle,
  onDelete,
  onUpdated,
}: {
  item: { id: number; title: string; category: string; content: string; keywords?: string | null; createdAt?: string | Date };
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdated: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editContent, setEditContent] = useState(item.content);
  const [editKeywords, setEditKeywords] = useState(item.keywords ?? "");

  const { data: comments } = trpc.knowledgeComments.list.useQuery(
    { knowledgeId: item.id },
    { enabled: expanded }
  );
  const updateMut = trpc.knowledge.update.useMutation({
    onSuccess: () => { onUpdated(); setEditing(false); toast.success("Artigo atualizado!"); },
    onError: () => toast.error("Erro ao salvar."),
  });

  async function handleExport(e: React.MouseEvent) {
    e.stopPropagation();
    setExporting(true);
    try {
      await exportArticleToPdf(item, comments ?? []);
      toast.success("PDF exportado com sucesso!");
    } catch {
      toast.error("Erro ao gerar PDF.");
    } finally {
      setExporting(false);
    }
  }

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditKeywords(item.keywords ?? "");
    setEditing(true);
    if (!expanded) onToggle();
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => { if (!editing) onToggle(); }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: "#0f172a" }}>{item.title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.52 0.18 240 / 0.1)", color: "oklch(0.42 0.18 240)" }}>{item.category}</span>
          </div>
          {item.keywords && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <Tag size={11} className="text-gray-400" />
              {item.keywords.split(",").map((kw: string) => kw.trim()).filter(Boolean).map((kw: string) => (
                <span key={kw} className="text-xs text-gray-400">{kw}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {editing ? (
            <>
              <button
                onClick={() => updateMut.mutate({ id: item.id, data: { title: editTitle, content: editContent, keywords: editKeywords || null } })}
                disabled={updateMut.isPending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: "#16a34a" }}
              >
                <Save size={12} /> Salvar
              </button>
              <button onClick={() => setEditing(false)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                <X size={13} />
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit} title="Editar artigo" className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors">
                <Edit2 size={13} />
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                title="Exportar como PDF"
                className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-50"
              >
                {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              </button>
              <button
                onClick={e => { e.stopPropagation(); if (confirm("Remover artigo?")) onDelete(); }}
                className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          {expanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {editing ? (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Título</label>
                <input
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Conteúdo</label>
                <RichTextEditor
                  value={editContent}
                  onChange={setEditContent}
                  minHeight="160px"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Palavras-chave</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  placeholder="ex: precificação, comercial, desconto"
                  value={editKeywords}
                  onChange={e => setEditKeywords(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div
              className="text-sm text-gray-700 mt-3 leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: item.content }}
            />
          )}
          <CommentsSection articleId={item.id} />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Conhecimento() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", category: "Geral", content: "", keywords: "" });
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState<{
    internalSources: {
      hasContent: boolean;
      knowledge: { id: number; title: string; category: string; excerpt: string }[];
      errors: { code: string; description: string; correction: string }[];
      pops: { id: number; title: string; code: string }[];
      files?: { id: number; nome: string; categoria: string; subcategoria: string | null; fileName: string; fileUrl: string; conteudoExtraido: string | null }[];
    };
    geminiAnswer: string;
    geminiAnswerIsGeneral: boolean;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ id: number; nome: string; categoria: string; subcategoria: string | null; fileName: string; fileUrl: string; conteudoExtraido: string | null } | null>(null);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestCategory, setSuggestCategory] = useState("Geral");
  const [suggestContent, setSuggestContent] = useState("");
  const { localUser } = useLocalAuth();
  const isMaster = localUser?.role === "master" || localUser?.role === "admin";

  const { data, isLoading, refetch } = trpc.knowledge.list.useQuery({ search, category });
  const createMut = trpc.knowledge.create.useMutation({
    onSuccess: () => {
      refetch();
      setShowForm(false);
      setForm({ title: "", category: "Geral", content: "", keywords: "" });
      toast.success("Artigo criado!");
    }
  });
  const deleteMut = trpc.knowledge.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Artigo removido."); } });
  const aiMut = trpc.knowledge.askAI.useMutation({
    onMutate: () => setAiLoading(true),
    onSuccess: (d) => { setAiResult(d); setAiLoading(false); },
    onError: () => { setAiLoading(false); toast.error("Erro ao consultar IA."); },
  });

  const suggestMut = trpc.knowledgeSuggestions.create.useMutation({
    onSuccess: () => {
      toast.success("Sugestão enviada para o master revisar!");
      setShowSuggestModal(false);
    },
    onError: () => toast.error("Erro ao enviar sugestão."),
  });

  const approveMut = trpc.knowledgeSuggestions.approve.useMutation({
    onSuccess: () => {
      toast.success("Artigo incorporado à Base de Conhecimento!");
      refetch();
      setShowSuggestModal(false);
    },
    onError: (e) => toast.error(e.message || "Erro ao incorporar."),
  });

  const items = data ?? [];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "oklch(0.52 0.18 240 / 0.1)" }}>
            <BookOpen size={18} style={{ color: "oklch(0.52 0.18 240)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#0f172a" }}>Base de Conhecimento</h1>
            <p className="text-sm text-gray-500">Artigos, políticas e conhecimentos da empresa</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ background: "oklch(0.52 0.18 240)" }}
        >
          <Plus size={15} /> Novo Artigo
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search size={15} className="text-gray-400" />
          <input
            className="flex-1 text-sm outline-none bg-transparent"
            placeholder="Buscar por título, conteúdo ou tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="">Todas as categorias</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* AI Assistant */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={16} style={{ color: "oklch(0.52 0.18 240)" }} />
          <span className="text-sm font-semibold" style={{ color: "#0f172a" }}>Assistente de Conhecimento (IA)</span>
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
            placeholder="Faça uma pergunta sobre os processos da empresa..."
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && aiPrompt.trim()) aiMut.mutate({ question: aiPrompt }); }}
          />
          <button
            onClick={() => aiMut.mutate({ question: aiPrompt })}
            disabled={!aiPrompt.trim() || aiLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors"
            style={{ background: "oklch(0.52 0.18 240)" }}
          >
            {aiLoading ? <Loader2 size={14} className="animate-spin" /> : "Perguntar"}
          </button>
        </div>

        {/* Resultado em dois blocos */}
        {aiResult && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bloco 1: Base Interna */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={15} className="text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wide text-blue-700">Base Interna da Empresa</span>
              </div>
              {aiResult.internalSources.hasContent ? (
                <div className="space-y-2">
                  {aiResult.internalSources.knowledge.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-blue-600 mb-1">Artigos encontrados:</p>
                      {aiResult.internalSources.knowledge.map(k => (
                        <div key={k.id} className="text-xs text-gray-700 bg-white rounded-lg p-2 mb-1 border border-blue-100">
                          <p className="font-semibold">{k.title}</p>
                          <p className="text-gray-500 mt-0.5 line-clamp-2">{k.excerpt}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {aiResult.internalSources.errors.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-blue-600 mb-1">Erros relacionados:</p>
                      {aiResult.internalSources.errors.map((err, i) => (
                        <div key={i} className="text-xs text-gray-700 bg-white rounded-lg p-2 mb-1 border border-blue-100">
                          <p className="font-semibold">{err.code}: {err.description}</p>
                          {err.correction && <p className="text-green-700 mt-0.5">{err.correction}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {aiResult.internalSources.pops.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-blue-600 mb-1">POPs relacionados:</p>
                      {aiResult.internalSources.pops.map(p => (
                        <div key={p.id} className="text-xs text-gray-700 bg-white rounded-lg p-2 mb-1 border border-blue-100">
                          <p className="font-semibold">{p.code} — {p.title}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {(aiResult.internalSources.files ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-blue-600 mb-1">Documentos referenciados:</p>
                      {(aiResult.internalSources.files ?? []).map(f => (
                        <div key={f.id} className="text-xs text-gray-700 bg-white rounded-lg p-2 mb-1 border border-blue-100 flex items-start gap-2">
                          <FolderOpen size={13} className="text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{f.nome}</p>
                            <p className="text-gray-400 mt-0.5">{f.categoria}{f.subcategoria ? " › " + f.subcategoria : ""}</p>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-1">
                            <button
                              onClick={() => setPreviewFile(f)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Visualizar conteúdo"
                            >
                              <Eye size={11} />
                            </button>
                            <a
                              href={f.fileUrl.startsWith("/") ? f.fileUrl : "/manus-storage/" + f.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Baixar documento"
                            >
                              <Download size={11} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <AlertCircle size={13} className="text-amber-500" />
                  Nenhum conteúdo interno encontrado para esta pergunta.
                </div>
              )}
            </div>

            {/* Bloco 2: Gemini */}
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={15} className="text-green-600" />
                <span className="text-xs font-bold uppercase tracking-wide text-green-700">Resposta do Gemini (IA)</span>
                {aiResult.geminiAnswerIsGeneral && (
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Conhecimento geral</span>
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{aiResult.geminiAnswer}</p>

              {/* Botões de ação */}
              <div className="mt-3 flex flex-wrap gap-2">
                {isMaster ? (
                  <button
                    onClick={() => {
                      setSuggestTitle(aiPrompt);
                      setSuggestCategory("Geral");
                      setSuggestContent(aiResult.geminiAnswer);
                      setShowSuggestModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle size={13} /> Incorporar na Base
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSuggestTitle(aiPrompt);
                      setSuggestCategory("Geral");
                      setSuggestContent(aiResult.geminiAnswer);
                      setShowSuggestModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    <ThumbsUp size={13} /> Sugerir Incorporação
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de Pré-visualização de Documento */}
        {previewFile && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewFile(null)}>
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
              style={{ maxHeight: "85vh" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between p-5 border-b border-gray-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.52 0.18 240 / 0.1)" }}>
                    <FileText size={18} style={{ color: "oklch(0.52 0.18 240)" }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{previewFile.nome}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {previewFile.categoria}{previewFile.subcategoria ? " › " + previewFile.subcategoria : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <a
                    href={previewFile.fileUrl.startsWith("/") ? previewFile.fileUrl : "/manus-storage/" + previewFile.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                    style={{ background: "oklch(0.52 0.18 240)" }}
                    title="Abrir arquivo original"
                  >
                    <ExternalLink size={12} /> Abrir original
                  </a>
                  <button
                    onClick={() => setPreviewFile(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X size={16} className="text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Conteúdo */}
              <div className="flex-1 overflow-y-auto p-5">
                {previewFile.conteudoExtraido ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Eye size={14} className="text-blue-500" />
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Conteúdo extraído do documento</span>
                    </div>
                    <div
                      className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-4 border border-gray-100"
                      style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: "0.8rem" }}
                    >
                      {previewFile.conteudoExtraido}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FolderOpen size={40} className="text-gray-300 mb-3" />
                    <p className="text-sm font-semibold text-gray-500">Conteúdo não disponível</p>
                    <p className="text-xs text-gray-400 mt-1">Este arquivo não possui texto extraído. Abra o arquivo original para visualizá-lo.</p>
                    <a
                      href={previewFile.fileUrl.startsWith("/") ? previewFile.fileUrl : "/manus-storage/" + previewFile.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                      style={{ background: "oklch(0.52 0.18 240)" }}
                    >
                      <ExternalLink size={14} /> Abrir arquivo original
                    </a>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                <span className="text-xs text-gray-400">{previewFile.fileName}</span>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="px-4 py-1.5 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-white transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de sugestão/incorporação */}
        {showSuggestModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">{isMaster ? "Incorporar na Base de Conhecimento" : "Sugerir Incorporação"}</h3>
                <button onClick={() => setShowSuggestModal(false)}><X size={16} className="text-gray-400" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Título</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" value={suggestTitle} onChange={e => setSuggestTitle(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Categoria</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" value={suggestCategory} onChange={e => setSuggestCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Conteúdo</label>
                  <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" rows={5} value={suggestContent} onChange={e => setSuggestContent(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button onClick={() => setShowSuggestModal(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">Cancelar</button>
                {isMaster ? (
                  <button
                    onClick={() => approveMut.mutate({ id: 0, titulo: suggestTitle, categoria: suggestCategory, conteudo: suggestContent })}
                    disabled={approveMut.isPending || !suggestTitle.trim() || !suggestContent.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    {approveMut.isPending ? "Incorporando..." : "Incorporar Agora"}
                  </button>
                ) : (
                  <button
                    onClick={() => suggestMut.mutate({ pergunta: aiPrompt, conteudoSugerido: suggestContent, tituloSugerido: suggestTitle, categoriaSugerida: suggestCategory })}
                    disabled={suggestMut.isPending || !suggestTitle.trim() || !suggestContent.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {suggestMut.isPending ? "Enviando..." : "Enviar Sugestão"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New article form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Novo Artigo</h3>
            <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Título <span className="text-red-500">*</span></label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Categoria</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Conteúdo <span className="text-red-500">*</span></label>
            <RichTextEditor
              value={form.content}
              onChange={html => setForm(f => ({ ...f, content: html }))}
              placeholder="Digite o conteúdo do artigo..."
              minHeight="150px"
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Palavras-chave (separadas por vírgula)</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="ex: precificação, comercial, desconto" value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancelar</button>
            <button
              onClick={() => createMut.mutate({ title: form.title, category: form.category, content: form.content, keywords: form.keywords })}
              disabled={!form.title || !form.content}
              className="px-4 py-2 text-sm rounded-lg text-white font-semibold disabled:opacity-50"
              style={{ background: "oklch(0.52 0.18 240)" }}
            >
              Salvar Artigo
            </button>
          </div>
        </div>
      )}

      {/* Articles list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm">Nenhum artigo encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <ArticleCard
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onDelete={() => deleteMut.mutate({ id: item.id })}
              onUpdated={() => refetch()}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
