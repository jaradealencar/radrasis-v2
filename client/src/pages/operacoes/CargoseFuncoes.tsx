import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  Briefcase, Plus, Pencil, Trash2, X, Save, Download,
  ChevronLeft, Target, ClipboardList, BarChart2, Wrench,
  GitMerge, AlertTriangle, UserCheck, Clock, Upload,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "../../components/DashboardLayout";
import RichTextEditor from "../../components/RichTextEditor";
import ImageUploadField from "../../components/ImageUploadField";
import { CurriculumUploadSection } from "../../components/CurriculumUploadSection";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from "@/components/ui/empty";

// ─── Types ────────────────────────────────────────────────────────────────────
type Cargo = {
  id: number;
  titulo: string;
  missao: string | null;
  responsabilidades: string | null;
  kpis: string | null;
  ferramentas: string | null;
  integracao: string | null;
  riscos: string | null;
  requisitos: string | null;
  condicoes: string | null;
  imagemDivulgacaoUrl: string | null;
  imagemDivulgacaoKey: string | null;
  roteiroEntrevista: string | null;
  promptAnaliseIA: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const EMPTY_FORM = {
  titulo: "",
  missao: "",
  responsabilidades: "",
  kpis: "",
  ferramentas: "",
  integracao: "",
  riscos: "",
  requisitos: "",
  condicoes: "",
  imagemDivulgacaoUrl: "",
  imagemDivulgacaoKey: "",
};

// ─── Seções do descritivo ─────────────────────────────────────────────────────
const SECTIONS = [
  { key: "missao",            label: "1. Missão Estratégica",                  icon: Target,        color: "#3b82f6" },
  { key: "responsabilidades", label: "2. Responsabilidades e Funções",          icon: ClipboardList, color: "#8b5cf6" },
  { key: "kpis",              label: "3. Indicadores de Desempenho (KPIs)",     icon: BarChart2,     color: "#10b981" },
  { key: "ferramentas",       label: "4. Ferramentas e Recursos",               icon: Wrench,        color: "#f59e0b" },
  { key: "integracao",        label: "5. Integração e Fluxo de Trabalho",       icon: GitMerge,      color: "#6366f1" },
  { key: "riscos",            label: "6. Gestão de Riscos",                     icon: AlertTriangle, color: "#ef4444" },
  { key: "requisitos",        label: "7. Requisitos Técnicos e Perfil",         icon: UserCheck,     color: "#0ea5e9" },
  { key: "condicoes",         label: "8. Condições de Trabalho",                icon: Clock,         color: "#64748b" },
] as const;

// ─── Componente de seção (visualização com HTML rico) ─────────────────────────
function SectionView({ label, icon: Icon, color, content }: {
  label: string; icon: React.ElementType; color: string; content: string | null;
}) {
  if (!content?.trim() || content === "<p></p>") return null;

  // Detecta se é HTML (gerado pelo TipTap) ou texto plano com **negrito**
  const isHtml = content.trim().startsWith("<");
  let rendered: string;
  if (isHtml) {
    rendered = content;
  } else {
    // Converte texto plano legado para HTML básico
    rendered = content
      .split("\n")
      .map(line => {
        if (!line.trim()) return "<br/>";
        const html = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        return `<p>${html}</p>`;
      })
      .join("");
  }

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18` }}>
          <Icon size={13} style={{ color }} />
        </div>
        <h3 className="text-sm font-bold text-slate-800">{label}</h3>
      </div>
      <div
        className="pl-8 prose prose-sm max-w-none text-slate-700"
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
    </div>
  );
}

// ─── Componente de seção (edição com RichTextEditor) ─────────────────────────
function SectionEdit({ label, icon: Icon, color, fieldKey, value, onChange }: {
  label: string; icon: React.ElementType; color: string;
  fieldKey: string; value: string; onChange: (k: string, v: string) => void;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18` }}>
          <Icon size={12} style={{ color }} />
        </div>
        <label className="text-xs font-bold text-slate-700">{label}</label>
      </div>
      <RichTextEditor
        value={value}
        onChange={(html) => onChange(fieldKey, html)}
        placeholder={`Conteúdo da seção "${label}"...`}
        minHeight="100px"
      />
    </div>
  );
}

// ─── Converte HTML do TipTap para linhas de texto puro ────────────────────────
function htmlToLines(html: string): Array<{ text: string; bold: boolean; italic: boolean; heading: number; listItem: boolean; ordered: boolean; listIndex?: number }> {
  if (!html?.trim()) return [];

  // Se não é HTML, converte texto plano legado
  if (!html.trim().startsWith("<")) {
    return html.split("\n").map(line => ({
      text: line.replace(/\*\*(.*?)\*\*/g, "$1"),
      bold: false, italic: false, heading: 0, listItem: false, ordered: false,
    }));
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const lines: Array<{ text: string; bold: boolean; italic: boolean; heading: number; listItem: boolean; ordered: boolean; listIndex?: number }> = [];

  function nodeText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    return Array.from(node.childNodes).map(nodeText).join("");
  }

  function isBold(node: Node): boolean {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.tagName === "STRONG" || el.tagName === "B") return true;
    }
    return node.parentElement ? isBold(node.parentElement) : false;
  }

  function processNode(node: Node, listOrdered = false, listIdx = { n: 0 }) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName;

    if (tag === "P" || tag === "DIV") {
      const text = nodeText(el).trim();
      if (text) lines.push({ text, bold: false, italic: false, heading: 0, listItem: false, ordered: false });
    } else if (tag === "H1" || tag === "H2") {
      lines.push({ text: nodeText(el).trim(), bold: true, italic: false, heading: 2, listItem: false, ordered: false });
    } else if (tag === "H3") {
      lines.push({ text: nodeText(el).trim(), bold: true, italic: false, heading: 3, listItem: false, ordered: false });
    } else if (tag === "UL") {
      Array.from(el.children).forEach(li => {
        lines.push({ text: nodeText(li).trim(), bold: false, italic: false, heading: 0, listItem: true, ordered: false });
      });
    } else if (tag === "OL") {
      Array.from(el.children).forEach((li, idx) => {
        lines.push({ text: nodeText(li).trim(), bold: false, italic: false, heading: 0, listItem: true, ordered: true, listIndex: idx + 1 });
      });
    } else if (tag === "STRONG" || tag === "B") {
      const text = nodeText(el).trim();
      if (text) lines.push({ text, bold: true, italic: false, heading: 0, listItem: false, ordered: false });
    } else if (tag === "EM" || tag === "I") {
      const text = nodeText(el).trim();
      if (text) lines.push({ text, bold: false, italic: true, heading: 0, listItem: false, ordered: false });
    } else {
      Array.from(el.childNodes).forEach(child => processNode(child, listOrdered, listIdx));
    }
  }

  Array.from(doc.body.childNodes).forEach(n => processNode(n));
  return lines.filter(l => l.text.length > 0);
}

// ─── Gerador de PDF profissional com jsPDF ────────────────────────────────────
async function generatePDF(cargo: Cargo) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = 210;
  const marginL = 18;
  const marginR = 18;
  const contentW = pageW - marginL - marginR;
  const HEADER_H = 22;
  const FOOTER_Y = 282;
  const MAX_Y = FOOTER_Y - 8;

  // Cores do sistema
  const NAVY  = [15, 35, 71]  as [number, number, number];  // #0f2347
  const WHITE = [255, 255, 255] as [number, number, number];
  const SLATE9 = [15, 23, 42]  as [number, number, number];  // slate-900
  const SLATE7 = [51, 65, 85]  as [number, number, number];  // slate-700
  const SLATE5 = [100, 116, 139] as [number, number, number]; // slate-500
  const SLATE2 = [226, 232, 240] as [number, number, number]; // slate-200
  const BLUE6  = [37, 99, 235]  as [number, number, number];  // blue-600

  // Cores das seções (mesmas do componente)
  const SECTION_COLORS: Record<string, [number, number, number]> = {
    missao:            [59, 130, 246],  // blue
    responsabilidades: [139, 92, 246],  // purple
    kpis:              [16, 185, 129],  // green
    ferramentas:       [245, 158, 11],  // amber
    integracao:        [99, 102, 241],  // indigo
    riscos:            [239, 68, 68],   // red
    requisitos:        [14, 165, 233],  // sky
    condicoes:         [100, 116, 139], // slate
  };

  let y = HEADER_H + 8;

  // ── Função auxiliar: desenha cabeçalho em cada página ──────────────────────
  function drawHeader(isFirst: boolean) {
    // Faixa azul escura
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, HEADER_H, "F");

    // Título à esquerda
    doc.setTextColor(...WHITE);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("DESCRITIVO DE CARGO — LETREIROS EXPRESS", marginL, 8);

    if (isFirst) {
      // Nome do cargo em destaque
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      const titleLines = doc.splitTextToSize(cargo.titulo.toUpperCase(), contentW - 30);
      doc.text(titleLines, marginL, 15);
    } else {
      // Nas demais páginas: apenas o nome do cargo menor
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(cargo.titulo, marginL, 15);
    }

    // Data à direita
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString("pt-BR"), pageW - marginR, 8, { align: "right" });
  }

  // ── Função auxiliar: desenha rodapé ────────────────────────────────────────
  function drawFooter(page: number, total: number) {
    doc.setFillColor(248, 250, 252);
    doc.rect(0, FOOTER_Y, pageW, 15, "F");
    doc.setDrawColor(...SLATE2);
    doc.line(marginL, FOOTER_Y, pageW - marginR, FOOTER_Y);
    doc.setTextColor(...SLATE5);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Letreiros Express — Documento gerado automaticamente", marginL, FOOTER_Y + 5);
    doc.text(`Página ${page} de ${total}`, pageW - marginR, FOOTER_Y + 5, { align: "right" });
  }

  // ── Função auxiliar: nova página ───────────────────────────────────────────
  function newPage() {
    doc.addPage();
    drawHeader(false);
    y = HEADER_H + 8;
  }

  // ── Função auxiliar: escreve bloco de texto com wrap ──────────────────────
  function writeLines(lines: ReturnType<typeof htmlToLines>, indent = 0) {
    for (const line of lines) {
      if (!line.text.trim()) continue;

      const prefix = line.listItem
        ? (line.ordered ? `${line.listIndex}.  ` : "•  ")
        : "";
      const fullText = prefix + line.text;
      const maxW = contentW - indent - (line.listItem ? 4 : 0);

      if (line.heading === 2) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...SLATE9);
      } else if (line.heading === 3) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...SLATE7);
      } else if (line.bold) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...SLATE9);
      } else if (line.italic) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...SLATE7);
      } else {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...SLATE7);
      }

      const wrapped = doc.splitTextToSize(fullText, maxW);
      const lineH = line.heading > 0 ? 6 : 5;
      const blockH = wrapped.length * lineH;

      if (y + blockH > MAX_Y) newPage();

      doc.text(wrapped, marginL + indent + (line.listItem ? 4 : 0), y);
      y += blockH + (line.heading > 0 ? 2 : 1);
    }
  }

  // ── Primeira página ────────────────────────────────────────────────────────
  drawHeader(true);

  // Linha de meta (data de atualização)
  doc.setTextColor(...SLATE5);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  const updatedStr = `Última atualização: ${new Date(cargo.updatedAt).toLocaleDateString("pt-BR")}${
    cargo.updatedBy ? ` · por ${cargo.updatedBy}` : ""
  }`;
  doc.text(updatedStr, marginL, y);
  y += 6;

  // Linha divisória
  doc.setDrawColor(...SLATE2);
  doc.line(marginL, y, pageW - marginR, y);
  y += 7;

  // ── Seções ─────────────────────────────────────────────────────────────────
  for (const section of SECTIONS) {
    const content = cargo[section.key as keyof Cargo] as string | null;
    if (!content?.trim() || content === "<p></p>" || content === "<p><br class=\"ProseMirror-trailingBreak\"></p>") continue;

    const sectionLines = htmlToLines(content);
    if (!sectionLines.length) continue;

    // Estima altura do bloco para evitar quebra de seção no início
    const estimatedH = sectionLines.length * 5.5 + 14;
    if (y + Math.min(estimatedH, 30) > MAX_Y) newPage();

    // Cor da seção
    const sColor = SECTION_COLORS[section.key] ?? BLUE6;

    // Barra lateral colorida
    doc.setFillColor(...sColor);
    doc.rect(marginL, y - 1, 2.5, 7, "F");

    // Título da seção
    doc.setTextColor(...sColor);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(section.label, marginL + 5, y + 5);
    y += 9;

    // Linha separadora fina
    doc.setDrawColor(...SLATE2);
    doc.line(marginL + 5, y, pageW - marginR, y);
    y += 4;

    // Conteúdo da seção com indentação
    writeLines(sectionLines, 5);
    y += 4; // espaço entre seções
  }

  // ── Rodapés em todas as páginas ────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(i, pageCount);
  }

  // ── Salva o arquivo ────────────────────────────────────────────────────────
  const filename = `cargo_${cargo.titulo.replace(/[^a-zA-Z0-9\u00C0-\u00FF ]/g, "").trim().replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function CargoseFuncoes() {
  const utils = trpc.useUtils();
  const { data: cargos, isLoading } = trpc.cargos.list.useQuery();
  const createMut = trpc.cargos.create.useMutation({
    onSuccess: () => { utils.cargos.list.invalidate(); setMode("list"); toast.success("Cargo criado com sucesso!"); },
    onError: (e) => toast.error("Erro ao criar: " + e.message),
  });
  const updateMut = trpc.cargos.update.useMutation({
    onSuccess: () => { utils.cargos.list.invalidate(); setMode("view"); toast.success("Cargo atualizado!"); },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });
  const deleteMut = trpc.cargos.delete.useMutation({
    onSuccess: () => { utils.cargos.list.invalidate(); setMode("list"); setSelected(null); toast.success("Cargo removido."); },
    onError: (e) => toast.error("Erro ao excluir: " + e.message),
  });

  const [mode, setMode] = useState<"list" | "view" | "edit" | "new">("list");
  const [selected, setSelected] = useState<Cargo | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openView = (c: Cargo) => { setSelected(c); setMode("view"); };
  const openEdit = (c: Cargo) => {
    setSelected(c);
    setForm({
      titulo: c.titulo,
      missao: c.missao ?? "",
      responsabilidades: c.responsabilidades ?? "",
      kpis: c.kpis ?? "",
      ferramentas: c.ferramentas ?? "",
      integracao: c.integracao ?? "",
      riscos: c.riscos ?? "",
      requisitos: c.requisitos ?? "",
      condicoes: c.condicoes ?? "",
      imagemDivulgacaoUrl: c.imagemDivulgacaoUrl ?? "",
      imagemDivulgacaoKey: c.imagemDivulgacaoKey ?? "",
    });
    setMode("edit");
  };
  const openNew = () => { setForm({ ...EMPTY_FORM }); setSelected(null); setMode("new"); };

  const handleSaveNew = () => {
    if (!form.titulo.trim()) { toast.error("O título do cargo é obrigatório."); return; }
    createMut.mutate(form);
  };
  const handleSaveEdit = () => {
    if (!selected) return;
    if (!form.titulo.trim()) { toast.error("O título do cargo é obrigatório."); return; }
    updateMut.mutate({ id: selected.id, ...form });
  };
  const handleDelete = (id: number) => {
    if (!confirm("Confirmar exclusão deste cargo?")) return;
    deleteMut.mutate({ id });
  };

  // ── LISTA ──────────────────────────────────────────────────────────────────
  if (mode === "list") {
    return (
      <DashboardLayout>
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "oklch(0.52 0.18 240 / 0.1)" }}>
              <Briefcase size={18} style={{ color: "oklch(0.52 0.18 240)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#0f172a" }}>Cargos e Funções</h1>
              <p className="text-sm text-gray-500">{cargos?.length ?? 0} descritivos cadastrados</p>
            </div>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "oklch(0.52 0.18 240)" }}>
            <Plus size={15} /> Novo Cargo
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">Carregando...</div>
        ) : !cargos?.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Briefcase /></EmptyMedia>
              <EmptyTitle>Nenhum cargo cadastrado ainda.</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <button onClick={openNew} className="text-sm text-blue-600 hover:underline font-medium">
                Criar o primeiro cargo
              </button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cargos.map(c => (
              <div key={c.id}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => openView(c)}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "oklch(0.52 0.18 240 / 0.1)" }}>
                      <Briefcase size={15} style={{ color: "oklch(0.52 0.18 240)" }} />
                    </div>
                    <h3 className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2">{c.titulo}</h3>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={e => { e.stopPropagation(); openEdit(c); }}
                      className="p-1.5 rounded hover:bg-blue-50 text-blue-500" title="Editar">
                      <Pencil size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(c.id); }}
                      className="p-1.5 rounded hover:bg-red-50 text-red-400" title="Excluir">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {c.imagemDivulgacaoUrl && (
                  <div className="mb-3 rounded-lg overflow-hidden bg-slate-100 h-32">
                    <img src={c.imagemDivulgacaoUrl} alt={c.titulo} className="w-full h-full object-cover" />
                  </div>
                )}
                {c.missao && (
                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                    {c.missao.replace(/<[^>]+>/g, "").replace(/\*\*(.*?)\*\*/g, "$1")}
                  </p>
                )}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Atualizado em {new Date(c.updatedAt).toLocaleDateString("pt-BR")}
                  </span>
                  <div className="flex items-center gap-2">
                    {c.imagemDivulgacaoUrl && (
                      <button onClick={e => {
                        e.stopPropagation();
                        const link = document.createElement('a');
                        link.href = c.imagemDivulgacaoUrl!;
                        link.download = `${c.titulo.replace(/\s+/g, '-').toLowerCase()}-divulgacao.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-700 transition-colors"
                      title="Baixar imagem de divulgacao">
                      <Download size={12} /> Img
                    </button>
                    )}
                    {c.roteiroEntrevista && (
                      <button onClick={e => { e.stopPropagation(); openView(c); }}
                        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 transition-colors"
                        title="Ver roteiro de entrevista">
                        <ClipboardList size={12} /> Roteiro
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); generatePDF(c); }}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors"
                      title="Baixar PDF">
                      <Download size={12} /> PDF
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardLayout>
    );
  }

  // ── VISUALIZAÇÃO ───────────────────────────────────────────────────────────
  if (mode === "view" && selected) {
    return (
      <DashboardLayout>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setMode("list")}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900 truncate">{selected.titulo}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Atualizado em {new Date(selected.updatedAt).toLocaleDateString("pt-BR")}
              {selected.updatedBy ? ` · por ${selected.updatedBy}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selected.imagemDivulgacaoUrl && (
              <button onClick={() => {
                const link = document.createElement('a');
                link.href = selected.imagemDivulgacaoUrl!;
                link.download = `${selected.titulo.replace(/\s+/g, '-').toLowerCase()}-divulgacao.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-yellow-200 text-yellow-700 hover:bg-yellow-50 transition-colors">
              <Download size={14} /> Imagem Divulgação
            </button>
            )}
            <button onClick={() => generatePDF(selected)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
              <Download size={14} /> Baixar PDF
            </button>
            <button onClick={() => openEdit(selected)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "oklch(0.52 0.18 240)" }}>
              <Pencil size={14} /> Editar
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-4xl">
          {/* Imagem de divulgação */}
          {selected.imagemDivulgacaoUrl && (
            <div className="mb-6 rounded-lg overflow-hidden bg-slate-100 h-64">
              <img src={selected.imagemDivulgacaoUrl} alt={selected.titulo} className="w-full h-full object-cover" />
            </div>
          )}
          
          {/* Título destacado */}
          <div className="mb-6 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "oklch(0.52 0.18 240 / 0.1)" }}>
                <Briefcase size={20} style={{ color: "oklch(0.52 0.18 240)" }} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Descritivo de Cargo</p>
                <h2 className="text-lg font-bold text-slate-900">{selected.titulo}</h2>
              </div>
            </div>
          </div>

          {/* Seções */}
          {SECTIONS.map(s => (
            <SectionView
              key={s.key}
              label={s.label}
              icon={s.icon}
              color={s.color}
              content={selected[s.key as keyof Cargo] as string | null}
            />
          ))}

          {/* Roteiro de Entrevista */}
          {selected.roteiroEntrevista && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: "#8b5cf618" }}>
                  <ClipboardList size={13} style={{ color: "#8b5cf6" }} />
                </div>
                <h3 className="text-sm font-bold text-slate-800">📑 Roteiro de Entrevista</h3>
              </div>
              <div className="pl-8 prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">
                {selected.roteiroEntrevista}
              </div>
            </div>
          )}

          {/* Prompt de Análise IA */}
          {selected.promptAnaliseIA && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: "#6366f118" }}>
                  <Wrench size={13} style={{ color: "#6366f1" }} />
                </div>
                <h3 className="text-sm font-bold text-slate-800">🤖 Prompt para Análise de Currículos</h3>
              </div>
              <div className="pl-8 prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">
                {selected.promptAnaliseIA}
              </div>
            </div>
          )}

          {/* Upload e Análise de Currículos */}
          {selected.promptAnaliseIA && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <CurriculumUploadSection cargoId={selected.id} cargoTitulo={selected.titulo} />
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ── FORMULÁRIO (novo / edição) ─────────────────────────────────────────────
  const isNew = mode === "new";
  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setMode(isNew ? "list" : "view")}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">
            {isNew ? "Novo Descritivo de Cargo" : `Editar: ${selected?.titulo}`}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Use a barra de ferramentas para formatar o texto de cada seção.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMode(isNew ? "list" : "view")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50">
            <X size={14} /> Cancelar
          </button>
          <button
            onClick={isNew ? handleSaveNew : handleSaveEdit}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "oklch(0.52 0.18 240)" }}>
            <Save size={14} /> {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-4xl">
        {/* Título */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Título do Cargo *</label>
          <input
            type="text"
            value={form.titulo}
            onChange={e => setField("titulo", e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
            style={{ background: "#fff", color: "#1e293b" }}
            placeholder="Ex: Assistente Administrativo Logístico"
          />
        </div>

        {/* Imagem de Divulgação */}
        <ImageUploadField
          label="Imagem de Divulgação do Cargo"
          value={form.imagemDivulgacaoUrl}
          onChange={(url, key) => {
            setField("imagemDivulgacaoUrl", url);
            setField("imagemDivulgacaoKey", key);
          }}
        />

        <div className="border-t border-slate-100 pt-5">
          {SECTIONS.map(s => (
            <SectionEdit
              key={s.key}
              label={s.label}
              icon={s.icon}
              color={s.color}
              fieldKey={s.key}
              value={form[s.key as keyof typeof form] ?? ""}
              onChange={setField}
            />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
