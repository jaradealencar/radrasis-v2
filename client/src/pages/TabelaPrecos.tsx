import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Save, X, Info, FileText, Search, Filter, ChevronDown, ChevronUp, Plus, Trash2, Copy, Check, Download, History, Clock } from "lucide-react";
import { useState, useMemo, useRef, useCallback } from "react";
import DashboardLayout from "../components/DashboardLayout";
import RichTextEditor from "../components/RichTextEditor";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConfigItem { label: string; value: string; highlight?: string; note?: string; }
interface MarginRow { label: string; values: string[]; }
interface ContentJson {
  type: "config" | "margin_table" | "margin_table_multi" | "list" | "rich_text";
  columns?: string[];
  rows?: MarginRow[];
  items?: ConfigItem[] | string[];
  html?: string;
}

interface Section {
  id: number;
  page: number;
  sectionOrder: number;
  sectionTitle: string;
  contentJson: string;
  notes: string | null;
  updatedAt: string | Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extrai apenas os dígitos e separadores numéricos de uma string (ex: "31%" → "31", "R$ 1.250,00" → "1.250,00") */
function extractNumber(val: string): string {
  // Remove tudo que não seja dígito, vírgula ou ponto
  const cleaned = val.replace(/[^0-9.,]/g, "").trim();
  return cleaned || val.trim();
}

/** Botão de copiar com feedback visual */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const numericValue = extractNumber(value);
    try {
      await navigator.clipboard.writeText(numericValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback para browsers sem clipboard API
      const ta = document.createElement("textarea");
      ta.value = numericValue;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [value]);
  return (
    <button
      onClick={handleCopy}
      title={`Copiar ${extractNumber(value)}`}
      className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-slate-400 hover:text-blue-600 focus:opacity-100 focus:outline-none"
    >
      {copied
        ? <Check size={12} className="text-green-500" />
        : <Copy size={12} />}
    </button>
  );
}

function highlightClass(h?: string) {
  if (h === "red") return "bg-red-100 text-red-800 border border-red-300 font-semibold";
  if (h === "yellow") return "bg-amber-50 text-amber-800 border border-amber-300 font-semibold";
  if (h === "blue") return "bg-blue-50 text-blue-800 border border-blue-300";
  return "bg-slate-50 text-slate-700";
}

function ConfigTable({ items }: { items: ConfigItem[] }) {
  return (
    <div className="flex flex-wrap gap-3 mb-2">
      {items.map((item, i) => (
        <div key={i} className={`group px-3 py-2 rounded-lg text-sm ${highlightClass(item.highlight)} flex items-center gap-1`}>
          <span className="font-medium">{item.label}:</span>{" "}
          <span className="text-base font-bold">{item.value}</span>
          <CopyButton value={item.value} />
          {item.note && <div className="text-xs mt-0.5 opacity-80 w-full">{item.note}</div>}
        </div>
      ))}
    </div>
  );
}

function MarginTable({ columns, rows }: { columns: string[]; rows: MarginRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-800 text-white">
            {rows.length > 1 && (
              <th className="px-3 py-2 text-center font-medium border border-slate-600 min-w-[140px]">{columns[0] ?? ""}</th>
            )}
            {(rows.length > 1 ? columns.slice(1) : columns).map((col, i) => (
              <th key={i} className="px-3 py-2 text-center font-medium border border-slate-600 whitespace-nowrap">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50"}>
              {rows.length > 1 && (
                <td className="px-3 py-2 font-medium text-slate-700 border border-slate-200">{row.label}</td>
              )}
              {row.values.map((val, vi) => (
                <td key={vi} className="group px-3 py-2 text-center border border-slate-200">
                  <span className="font-semibold text-blue-700">{val}</span>
                  {val.trim() !== "" && <CopyButton value={val} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListContent({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-700">
          <span className="text-blue-500 mt-0.5">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionContent({ contentJson }: { contentJson: string }) {
  try {
    const data: ContentJson = JSON.parse(contentJson);
    if (data.type === "config") return <ConfigTable items={data.items as ConfigItem[]} />;
    if (data.type === "margin_table" || data.type === "margin_table_multi") {
      return <MarginTable columns={data.columns ?? []} rows={data.rows ?? []} />;
    }
    if (data.type === "list") return <ListContent items={data.items as string[]} />;
    if (data.type === "rich_text" && data.html) {
      return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: data.html }} />;
    }
  } catch {}
  return <pre className="text-xs text-slate-600 whitespace-pre-wrap">{contentJson}</pre>;
}

// ─── Visual Editors ───────────────────────────────────────────────────────────

/** Editor visual para listas simples (type: "list") */
function ListEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = useMemo(() => {
    try { const d = JSON.parse(value); if (d.type === "list") return d.items as string[]; } catch {}
    return [];
  }, [value]);

  function update(items: string[]) {
    onChange(JSON.stringify({ type: "list", items }));
  }

  return (
    <div className="space-y-2">
      {parsed.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="text-blue-400 text-sm">•</span>
          <input
            className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            value={item}
            onChange={e => { const arr = [...parsed]; arr[i] = e.target.value; update(arr); }}
          />
          <button onClick={() => update(parsed.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...parsed, ""])}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
      >
        <Plus size={12} /> Adicionar item
      </button>
    </div>
  );
}

/** Editor visual para tabelas de margem (type: "margin_table") */
function MarginTableEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = useMemo(() => {
    try {
      const d = JSON.parse(value);
      if (d.type === "margin_table" || d.type === "margin_table_multi") return d as ContentJson;
    } catch {}
    return null;
  }, [value]);

  if (!parsed) return null;

  const cols = parsed.columns ?? [];
  const rows = parsed.rows ?? [];

  function updateCell(rowIdx: number, colIdx: number, val: string) {
    const newRows = rows.map((r, ri) => {
      if (ri !== rowIdx) return r;
      const newVals = [...r.values];
      newVals[colIdx] = val;
      return { ...r, values: newVals };
    });
    onChange(JSON.stringify({ ...parsed, rows: newRows }));
  }

  function updateRowLabel(rowIdx: number, val: string) {
    const newRows = rows.map((r, ri) => ri === rowIdx ? { ...r, label: val } : r);
    onChange(JSON.stringify({ ...parsed, rows: newRows }));
  }

  function updateColHeader(colIdx: number, val: string) {
    const newCols = cols.map((c, ci) => ci === colIdx ? val : c);
    onChange(JSON.stringify({ ...parsed, columns: newCols }));
  }

  function addRow() {
    const newRow: MarginRow = { label: "Nova linha", values: cols.map(() => "") };
    onChange(JSON.stringify({ ...parsed, rows: [...rows, newRow] }));
  }

  function removeRow(rowIdx: number) {
    onChange(JSON.stringify({ ...parsed, rows: rows.filter((_, i) => i !== rowIdx) }));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100">
            {rows.length > 1 && (
              <th className="px-2 py-1 border border-slate-200 min-w-[140px]">
                <input
                  className="w-full text-xs font-semibold text-center bg-transparent outline-none focus:bg-white focus:border-blue-300 rounded px-1"
                  value={cols[0] ?? ""}
                  onChange={e => updateColHeader(0, e.target.value)}
                />
              </th>
            )}
            {(rows.length > 1 ? cols.slice(1) : cols).map((col, ci) => (
              <th key={ci} className="px-2 py-1 border border-slate-200">
                <input
                  className="w-full text-xs font-semibold text-center bg-transparent outline-none focus:bg-white focus:border-blue-300 rounded px-1"
                  value={col}
                  onChange={e => updateColHeader(rows.length > 1 ? ci + 1 : ci, e.target.value)}
                />
              </th>
            ))}
            <th className="w-8 border border-slate-200" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50"}>
              {rows.length > 1 && (
                <td className="px-2 py-1 border border-slate-200">
                  <input
                    className="w-full text-xs font-medium text-center text-slate-700 bg-transparent outline-none focus:bg-white focus:border-blue-300 rounded px-1"
                    value={row.label}
                    onChange={e => updateRowLabel(ri, e.target.value)}
                  />
                </td>
              )}
              {row.values.map((val, vi) => (
                <td key={vi} className="px-2 py-1 border border-slate-200">
                  <input
                    className="w-full text-xs text-center font-semibold text-blue-700 bg-transparent outline-none focus:bg-white focus:border-blue-300 rounded px-1"
                    value={val}
                    onChange={e => updateCell(ri, vi, e.target.value)}
                  />
                </td>
              ))}
              <td className="px-1 py-1 border border-slate-200 text-center">
                <button onClick={() => removeRow(ri)} className="text-slate-300 hover:text-red-400 transition-colors">
                  <Trash2 size={11} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={addRow}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
      >
        <Plus size={12} /> Adicionar linha
      </button>
    </div>
  );
}

/** Editor visual para config items (type: "config") */
function ConfigEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = useMemo(() => {
    try { const d = JSON.parse(value); if (d.type === "config") return d.items as ConfigItem[]; } catch {}
    return [];
  }, [value]);

  function update(items: ConfigItem[]) {
    onChange(JSON.stringify({ type: "config", items }));
  }

  return (
    <div className="space-y-2">
      {parsed.map((item, i) => (
        <div key={i} className="flex gap-2 items-center flex-wrap">
          <input
            className="border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400 w-40"
            placeholder="Rótulo"
            value={item.label}
            onChange={e => { const arr = [...parsed]; arr[i] = { ...arr[i], label: e.target.value }; update(arr); }}
          />
          <input
            className="border border-slate-200 rounded px-2 py-1.5 text-sm font-bold outline-none focus:border-blue-400 w-28"
            placeholder="Valor"
            value={item.value}
            onChange={e => { const arr = [...parsed]; arr[i] = { ...arr[i], value: e.target.value }; update(arr); }}
          />
          <input
            className="border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-blue-400 flex-1 min-w-[120px]"
            placeholder="Observação (opcional)"
            value={item.note ?? ""}
            onChange={e => { const arr = [...parsed]; arr[i] = { ...arr[i], note: e.target.value || undefined }; update(arr); }}
          />
          <button onClick={() => update(parsed.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...parsed, { label: "", value: "" }])}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
      >
        <Plus size={12} /> Adicionar item
      </button>
    </div>
  );
}

/** Seleciona o editor visual correto baseado no tipo de conteúdo */
function SmartEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const type = useMemo(() => {
    try { return JSON.parse(value).type as string; } catch { return "unknown"; }
  }, [value]);

  if (type === "list") return <ListEditor value={value} onChange={onChange} />;
  if (type === "margin_table" || type === "margin_table_multi") return <MarginTableEditor value={value} onChange={onChange} />;
  if (type === "config") return <ConfigEditor value={value} onChange={onChange} />;
  if (type === "rich_text") {
    const html = (() => { try { return JSON.parse(value).html ?? ""; } catch { return ""; } })();
    return (
      <RichTextEditor
        value={html}
        onChange={h => onChange(JSON.stringify({ type: "rich_text", html: h }))}
        minHeight="120px"
      />
    );
  }
  // Fallback: editor de texto livre
  return (
    <RichTextEditor
      value={value}
      onChange={onChange}
      minHeight="120px"
    />
  );
}

// ─── EditableSection ─────────────────────────────────────────────────────────

function EditableSection({ section, highlight }: { section: Section; highlight?: string }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.sectionTitle);
  const [notes, setNotes] = useState(section.notes ?? "");
  const [contentJson, setContentJson] = useState(section.contentJson);

  const utils = trpc.useUtils();
  const updateMut = trpc.price.update.useMutation({
    onSuccess: () => {
      utils.price.list.invalidate();
      setEditing(false);
      toast.success("Seção atualizada!");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  function handleSave() {
    updateMut.mutate({ id: section.id, sectionTitle: title, contentJson, notes: notes || null });
  }

  function handleCancel() {
    setTitle(section.sectionTitle);
    setNotes(section.notes ?? "");
    setContentJson(section.contentJson);
    setEditing(false);
  }

  return (
    <Card className={`mb-4 border shadow-sm transition-all ${highlight ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          {editing ? (
            <Input value={title} onChange={e => setTitle(e.target.value)} className="font-semibold text-sm h-8" />
          ) : (
            <CardTitle className="text-sm font-semibold text-slate-800 leading-snug flex items-center gap-2 flex-wrap">
              {(() => {
                const isBrasil = section.sectionTitle.endsWith("\u2014 Clientes Brasil");
                const isMs = section.sectionTitle.endsWith("\u2014 Clientes MS");
                const baseTitle = section.sectionTitle
                  .replace(" \u2014 Clientes Brasil", "")
                  .replace(" \u2014 Clientes MS", "");
                const displayTitle = highlight
                  ? <span dangerouslySetInnerHTML={{ __html: baseTitle.replace(
                      new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
                      '<mark class="bg-yellow-200 text-yellow-900 rounded px-0.5">$1</mark>'
                    ) }} />
                  : baseTitle;
                return (
                  <>
                    {displayTitle}
                    {isBrasil && (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5 border-green-500 text-green-700 bg-green-50 shrink-0 font-semibold">
                        🌎 Geral / Brasil
                      </Badge>
                    )}
                    {isMs && (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5 border-blue-600 text-blue-700 bg-blue-50 shrink-0 font-semibold">
                        📌 Mato Grosso do Sul
                      </Badge>
                    )}
                  </>
                );
              })()}
            </CardTitle>
          )}
          <div className="flex gap-1 shrink-0">
            {editing ? (
              <>
                <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={handleSave} disabled={updateMut.isPending}>
                  <Save className="w-3 h-3 mr-1" /> Salvar
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleCancel}>
                  <X className="w-3 h-3" />
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-slate-500 hover:text-blue-600" onClick={() => setEditing(true)}>
                <Pencil className="w-3 h-3 mr-1" /> Editar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">Conteúdo</label>
              <SmartEditor value={contentJson} onChange={setContentJson} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Observações</label>
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder="Observações adicionais..."
                minHeight="80px"
              />
            </div>
          </div>
        ) : (
          <>
            <SectionContent contentJson={section.contentJson} />
            {section.notes && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                <Info className="w-3 h-3 inline mr-1" />
                <div className="inline prose prose-xs max-w-none" dangerouslySetInnerHTML={{ __html: section.notes }} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── SearchResults ─────────────────────────────────────────────────────────────

const PAGE_LABELS: Record<number, string> = {
  1: "Pág. 1 — Frontlight Galvanizado",
  2: "Pág. 2 — Inox / PVC / Acrílico",
  3: "Pág. 3 — Pintura",
  4: "Pág. 4 — Instalação",
  5: "Pág. 5 — Condições Comerciais",
};

function SearchResults({ sections, query }: { sections: Section[]; query: string }) {
  const q = query.toLowerCase();
  const matches = sections.filter(s => {
    if (s.sectionTitle.toLowerCase().includes(q)) return true;
    if (s.notes?.toLowerCase().includes(q)) return true;
    try {
      const text = JSON.stringify(JSON.parse(s.contentJson)).toLowerCase();
      return text.includes(q);
    } catch { return false; }
  });

  if (matches.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhuma seção encontrada para "<strong>{query}</strong>".</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-4">
        <strong>{matches.length}</strong> seção{matches.length !== 1 ? "ões" : ""} encontrada{matches.length !== 1 ? "s" : ""} para "<strong>{query}</strong>"
      </p>
      {matches.map(section => (
        <div key={section.id}>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
              {PAGE_LABELS[section.page] ?? `Pág. ${section.page}`}
            </Badge>
          </div>
          <EditableSection section={section} highlight={query} />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

// ─── Gerador de PDF enxuto ───────────────────────────────────────────────────
function gerarPdfTabela(sections: Section[], meta: { versao: string; dataModificacao: Date | string } | null, titulo = "Tabela de Preços") {
  const dataStr = meta?.dataModificacao
    ? new Date(meta.dataModificacao).toLocaleDateString("pt-BR")
    : new Date().toLocaleDateString("pt-BR");
  const versao = meta?.versao ?? "001";
  // Detectar se é Tabela Novo Cliente (páginas 11-13) ou Principal (páginas 1-3)
  const isNovoCliente = sections.some(s => s.page >= 11);
  const pageOffset = isNovoCliente ? 10 : 0; // 11 → 1, 12 → 2, 13 → 3
  const pageNames: Record<number, string> = {
    1: "Frontlight / Galvanizado",
    2: "Inox / PVC / Acrílico",
    3: "Pintura",
  };
  const pageIcons: Record<number, string> = {
    1: "&#x1F4A1;",
    2: "&#x2728;",
    3: "&#x1F3A8;",
  };
  const pageSubtitles: Record<number, string> = {
    1: "Letreiros iluminados e estruturas galvanizadas",
    2: "Inox escovado, PVC e acrílico",
    3: "Acabamentos e pintura especial",
  };
  const pageColors: Record<number, string> = {
    1: "#1e40af",
    2: "#0f766e",
    3: "#7c3aed",
  };

  // Helper para extrair label de identificação do título
  function getSectionLabel(title: string): { base: string; badge: string; badgeColor: string; badgeBg: string } {
    if (title.endsWith("\u2014 Clientes Brasil")) {
      return {
        base: title.replace(" \u2014 Clientes Brasil", ""),
        badge: "\uD83C\uDF0E Geral / Brasil",
        badgeColor: "#166534",
        badgeBg: "#dcfce7",
      };
    }
    if (title.endsWith("\u2014 Clientes MS")) {
      return {
        base: title.replace(" \u2014 Clientes MS", ""),
        badge: "\uD83D\uDCCC Mato Grosso do Sul",
        badgeColor: "#1e40af",
        badgeBg: "#dbeafe",
      };
    }
    return { base: title, badge: "", badgeColor: "", badgeBg: "" };
  }

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo} v${versao}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:11.5px;color:#1e293b;background:#fff}
  /* ─── CAPA ─── */
  .cover{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);color:#fff;padding:56px 48px 44px;position:relative;overflow:hidden}
  .cover::before{content:'';position:absolute;top:-60px;right:-60px;width:220px;height:220px;background:rgba(255,255,255,0.04);border-radius:50%}
  .cover::after{content:'';position:absolute;bottom:-40px;left:60px;width:160px;height:160px;background:rgba(255,255,255,0.03);border-radius:50%}
  .cover-eyebrow{font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#93c5fd;margin-bottom:12px}
  .cover-logo{font-size:30px;font-weight:800;letter-spacing:-0.5px;margin-bottom:8px}
  .cover-logo span{color:#60a5fa}
  .cover-title{font-size:36px;font-weight:700;margin:16px 0 10px;line-height:1.2}
  .cover-divider{width:56px;height:4px;background:#60a5fa;border-radius:2px;margin:16px 0}
  .cover-meta{font-size:12px;opacity:0.85;margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .cover-badge{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:4px 14px;font-size:11px;font-weight:600;backdrop-filter:blur(4px)}
  .cover-sep{opacity:0.3}
  /* ─── SEÇÕES ─── */
  .page-section{margin:0}
  .page-header{padding:16px 48px 12px;display:flex;align-items:center;gap:14px;border-bottom:3px solid}
  .page-header-icon{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:17px}
  .page-header-info{}
  .page-header-title{font-size:18px;font-weight:700;line-height:1.2}
  .page-header-sub{font-size:11px;opacity:0.6;margin-top:2px}
  .section-block{margin:0 48px 20px;padding-top:14px}
  .section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;color:#475569;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .section-title::before{content:'';display:inline-block;width:4px;height:14px;border-radius:2px;background:currentColor;opacity:0.5;flex-shrink:0}
  .section-badge{display:inline-flex;align-items:center;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.3px;border:1.5px solid;margin-left:4px}
  /* ─── TABELAS ─── */
  table{width:100%;border-collapse:separate;border-spacing:0;border-radius:8px;overflow:hidden;font-size:11px;box-shadow:0 1px 4px rgba(0,0,0,0.08)}
  thead tr{color:#fff}
  thead th{padding:9px 14px;text-align:center;font-weight:700;font-size:10.5px;letter-spacing:0.3px}
  thead th:first-child{text-align:left;border-radius:8px 0 0 0}
  thead th:last-child{border-radius:0 8px 0 0}
  tbody td{padding:8px 14px;text-align:center;border-bottom:1px solid #f1f5f9;font-size:11px}
  tbody td:first-child{text-align:left;font-weight:600;color:#1e3a5f}
  tbody tr:last-child td{border-bottom:none}
  tbody tr:last-child td:first-child{border-radius:0 0 0 8px}
  tbody tr:last-child td:last-child{border-radius:0 0 8px 0}
  tbody tr:nth-child(even) td{background:#f8fafc}
  tbody td .val{font-weight:700;color:#0f4c81;font-size:11.5px}
  /* ─── CONFIG GRID ─── */
  .config-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .config-item{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:#f8fafc;border-radius:8px;border-left:4px solid #3b82f6}
  .config-label{color:#64748b;font-size:10.5px;font-weight:500}
  .config-value{font-weight:800;color:#1e3a5f;font-size:12.5px}
  /* ─── LISTA ─── */
  .list-items{padding-left:0;list-style:none}
  .list-items li{padding:5px 0 5px 20px;position:relative;color:#374151;border-bottom:1px solid #f1f5f9;font-size:11px}
  .list-items li:before{content:"›";position:absolute;left:4px;color:#3b82f6;font-weight:700;font-size:14px;line-height:1.2}
  /* ─── NOTA ─── */
  .note-box{margin-top:10px;padding:8px 14px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;font-size:10px;color:#78350f;display:flex;gap:8px;align-items:flex-start}
  .note-icon{flex-shrink:0;font-size:13px}
  /* ─── RODAPÉ ─── */
  .footer{margin-top:28px;padding:14px 48px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#94a3b8}
  .footer-brand{font-weight:700;color:#64748b;font-size:10.5px}
  @media print{
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:11.5px}
    .page-section{page-break-inside:avoid}
    .section-block{page-break-inside:avoid}
    .cover{page-break-after:always}
    table{page-break-inside:avoid}
  }
</style></head><body>
<div class="cover">
  <div class="cover-eyebrow">Letreiros Express &mdash; Uso Interno</div>
  <div class="cover-logo">LETREIROS <span>EXPRESS</span></div>
  <div class="cover-title">${titulo}</div>
  <div class="cover-divider"></div>
  <div class="cover-meta">
    <span class="cover-badge">&#x1F4CB; Versão ${versao}</span>
    <span class="cover-sep">&bull;</span>
    <span>Modificado em ${dataStr}</span>
    <span class="cover-sep">&bull;</span>
    <span>Emitido em ${new Date().toLocaleDateString("pt-BR")}</span>
  </div>
</div>`;

  const byPage: Record<number, Section[]> = {};
  sections.forEach(s => {
    const normalizedPage = s.page > 10 ? s.page - pageOffset : s.page;
    if (!byPage[normalizedPage]) byPage[normalizedPage] = [];
    byPage[normalizedPage].push(s);
  });

  for (const page of [1, 2, 3]) {
    const pageSections = (byPage[page] ?? []).sort((a, b) => a.sectionOrder - b.sectionOrder);
    if (!pageSections.length) continue;
    const color = pageColors[page] ?? "#1e3a5f";
    html += `<div class="page-section">
      <div class="page-header" style="border-color:${color};background:linear-gradient(135deg,${color}12,${color}06)">
        <div class="page-header-icon" style="background:${color}18;color:${color}">${pageIcons[page] ?? "&#x1F4C4;"}</div>
        <div class="page-header-info">
          <div class="page-header-title" style="color:${color}">${pageNames[page] ?? "Página " + page}</div>
          <div class="page-header-sub">${pageSubtitles[page] ?? ""}</div>
        </div>
      </div>`;
    for (const sec of pageSections) {
      const lbl = getSectionLabel(sec.sectionTitle);
      const badgeHtml = lbl.badge
        ? ` <span class="section-badge" style="color:${lbl.badgeColor};background:${lbl.badgeBg};border-color:${lbl.badgeColor}">${lbl.badge}</span>`
        : "";
      html += `<div class="section-block"><div class="section-title">${lbl.base}${badgeHtml}</div>`;
      try {
        const c = JSON.parse(sec.contentJson) as ContentJson;
        if (c.type === "margin_table" || c.type === "margin_table_multi") {
          const hasMultiRows = (c.rows ?? []).length > 1;
          html += `<table><thead><tr style="background:${color}">`;
          if (hasMultiRows) html += `<th style="text-align:left">${(c.columns ?? [])[0] ?? ""}</th>`;
          (hasMultiRows ? (c.columns ?? []).slice(1) : (c.columns ?? [])).forEach(col => {
            html += `<th>${col}</th>`;
          });
          html += `</tr></thead><tbody>`;
          (c.rows ?? []).forEach((row, ri) => {
            const rowBg = ri % 2 === 0 ? "" : " style=\"background:#f8fafc\"";
            html += `<tr${rowBg}>`;
            if (hasMultiRows) html += `<td style="text-align:left;font-weight:600;color:#1e3a5f">${row.label}</td>`;
            row.values.forEach(v => { html += `<td><span class="val">${v}</span></td>`; });
            html += `</tr>`;
          });
          html += `</tbody></table>`;
        } else if (c.type === "config") {
          html += `<div class="config-grid">`;
          (c.items as ConfigItem[] ?? []).forEach(item => {
            html += `<div class="config-item"><span class="config-label">${item.label}</span><span class="config-value">${item.value}</span></div>`;
          });
          html += `</div>`;
        } else if (c.type === "list") {
          html += `<ul class="list-items">`;
          (c.items as string[] ?? []).forEach(item => { html += `<li>${item}</li>`; });
          html += `</ul>`;
        }
      } catch { /* ignorar */ }
      if (sec.notes) html += `<div class="note-box"><span class="note-icon">⚠️</span><span>${sec.notes}</span></div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  html += `<div class="footer"><span class="footer-brand">Letreiros Express</span><span>Uso interno &mdash; confidencial</span><span>${titulo} v${versao} &mdash; ${dataStr}</span></div></body></html>`;
  // Download direto como arquivo HTML (abre no browser e permite Ctrl+P para PDF)
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const nomeArquivo = titulo.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  a.download = `${nomeArquivo}_v${versao}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function TabelaPrecos() {
  const [tabelaAtiva, setTabelaAtiva] = useState<"principal" | "novo_cliente">("principal");
  const [activeTab, setActiveTab] = useState("1");
  const [activeTabNC, setActiveTabNC] = useState("11");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPage, setFilterPage] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const { data: allSections, isLoading } = trpc.price.list.useQuery({});
  const { data: allSectionsNC, isLoading: isLoadingNC } = trpc.price.list.useQuery({});
  const { data: meta } = trpc.price.getMeta.useQuery();
  const [showHistory, setShowHistory] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionPage, setNewSectionPage] = useState(11);
  const utils = trpc.useUtils();
  const addSectionMut = trpc.price.addSection.useMutation({
    onSuccess: () => {
      utils.price.list.invalidate();
      setShowAddModal(false);
      setNewSectionTitle("");
      toast.success("Seção adicionada com sucesso!");
    },
    onError: () => toast.error("Erro ao adicionar seção"),
  });
  const deleteSectionMut = trpc.price.deleteSection.useMutation({
    onSuccess: () => {
      utils.price.list.invalidate();
      toast.success("Seção removida!");
    },
    onError: () => toast.error("Erro ao remover seção"),
  });
  const { data: history } = trpc.price.getHistory.useQuery({ limit: 100 }, { enabled: showHistory });

  const isSearching = searchQuery.trim().length > 0;

  const sectionsForPage = (page: number) =>
    (allSections ?? []).filter(s => s.page === page).sort((a, b) => a.sectionOrder - b.sectionOrder);

  // Filtro combinado: busca por texto + filtro por página
  const filteredSections = useMemo(() => {
    let sections = allSections ?? [];
    if (filterPage !== "all") {
      sections = sections.filter(s => s.page === Number(filterPage));
    }
    return sections.sort((a, b) => a.page !== b.page ? a.page - b.page : a.sectionOrder - b.sectionOrder);
  }, [allSections, filterPage]);

  const allPages = [
    { key: "1", label: "Pág. 1 — Frontlight / Galvanizado" },
    { key: "2", label: "Pág. 2 — Inox / PVC / Acrílico" },
    { key: "3", label: "Pág. 3 — Pintura" },
  ];

  // Seções da Tabela Novo Cliente (pages 11, 12, 13)
  const sectionsNCForPage = (page: number) =>
    (allSections ?? []).filter(s => s.page === page).sort((a, b) => a.sectionOrder - b.sectionOrder);

  const allPagesNC = [
    { key: "11", label: "Pág. 1" },
    { key: "12", label: "Pág. 2" },
    { key: "13", label: "Pág. 3" },
  ];

  return (
    <DashboardLayout>
      {/* Navegação de Sub-abas */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-0">
        <button
          onClick={() => setTabelaAtiva("principal")}
          className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors ${
            tabelaAtiva === "principal"
              ? "bg-white border-slate-200 text-blue-700 shadow-sm -mb-px"
              : "bg-slate-50 border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText className="w-4 h-4 inline mr-1.5" />
          Tabela de Preços
        </button>
        <button
          onClick={() => setTabelaAtiva("novo_cliente")}
          className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors ${
            tabelaAtiva === "novo_cliente"
              ? "bg-white border-slate-200 text-emerald-700 shadow-sm -mb-px"
              : "bg-slate-50 border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Plus className="w-4 h-4 inline mr-1.5" />
          Tabela Novo Cliente
        </button>
      </div>

      {/* ─── ABA: TABELA NOVO CLIENTE ─── */}
      {tabelaAtiva === "novo_cliente" && (
        <div>
          {/* Header */}
          <div className="mb-5">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <Plus className="w-6 h-6 text-emerald-600" />
              <h1 className="text-2xl font-bold text-slate-900">Tabela Novo Cliente</h1>
              {meta && (
                <Badge className="bg-emerald-600 text-white text-xs">
                  v{meta.versao}
                </Badge>
              )}
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus className="w-4 h-4" />
                  Nova Seção
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => gerarPdfTabela(
                    (allSections ?? []).filter(s => s.page >= 11 && s.page <= 13),
                    meta ?? null
                  )}
                  disabled={isLoadingNC}
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </Button>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Tabela exclusiva para novos clientes. Clique em <strong>Editar</strong> para atualizar valores.
            </p>
          </div>

          {/* Tabs das páginas */}
          <Tabs value={activeTabNC} onValueChange={setActiveTabNC}>
            <TabsList className="flex flex-wrap h-auto gap-1 mb-6 bg-slate-100 p-1 rounded-lg">
              {allPagesNC.map(p => (
                <TabsTrigger key={p.key} value={p.key} className="text-xs px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Pencil className="w-3 h-3 mr-1 text-emerald-500" />
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {allPagesNC.map(p => (
              <TabsContent key={p.key} value={p.key}>
                <div className="mb-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                  <Pencil className="w-3 h-3" />
                  Clique em <strong>Editar</strong> para atualizar valores. Use <strong>Nova Seção</strong> para adicionar seções.
                </div>
                {isLoadingNC ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-32 bg-slate-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : sectionsNCForPage(Number(p.key)).length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <Plus className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Nenhuma seção nesta página</p>
                    <p className="text-xs mt-1">Clique em <strong>Nova Seção</strong> para adicionar.</p>
                    <Button
                      size="sm"
                      className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => { setNewSectionPage(Number(p.key)); setShowAddModal(true); }}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Nova Seção
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sectionsNCForPage(Number(p.key)).map(section => (
                      <div key={section.id} className="relative group">
                        <EditableSection section={section as Section} />
                        <button
                          onClick={() => {
                            if (confirm(`Remover a seção "${section.sectionTitle}"?`)) {
                              deleteSectionMut.mutate({ id: section.id });
                            }
                          }}
                          className="absolute top-3 right-14 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded px-2 py-1 text-xs flex items-center gap-1"
                          title="Remover seção"
                        >
                          <Trash2 className="w-3 h-3" /> Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}

      {/* ─── ABA: TABELA DE PREÇOS (PRINCIPAL) ─── */}
      {tabelaAtiva === "principal" && (
      <div>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <FileText className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Tabela de Preços</h1>
          {meta && (
            <Badge className="bg-blue-600 text-white text-xs">
              v{meta.versao} — {new Date(meta.dataModificacao).toLocaleDateString("pt-BR")}
            </Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-2 border-slate-300 text-slate-600 hover:bg-slate-50"
              onClick={() => setShowHistory(true)}
            >
              <History className="w-4 h-4" />
              Histórico
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => gerarPdfTabela(allSections ?? [], meta ?? null)}
              disabled={isLoading}
            >
              <Download className="w-4 h-4" />
              Baixar PDF
            </Button>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          Clique em <strong>Editar</strong> em qualquer seção para atualizar valores, margens ou observações.
          {meta && (
            <span className="ml-2 text-slate-400">
              Última modificação: {new Date(meta.dataModificacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </span>
          )}
        </p>
      </div>

      {/* Search + Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-sm">
        <div className="flex gap-3 items-center">
          <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              className="flex-1 text-sm outline-none bg-transparent placeholder-slate-400"
              placeholder="Buscar por material, espessura, margem, valor..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-3 items-center">
            <span className="text-xs font-medium text-slate-500">Filtrar por página:</span>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: "all", label: "Todas" },
                { value: "1", label: "Frontlight / Galvanizado" },
                { value: "2", label: "Inox / PVC / Acrílico" },
                { value: "3", label: "Pintura" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilterPage(opt.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterPage === opt.value
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {filterPage !== "all" && (
              <button
                onClick={() => setFilterPage("all")}
                className="text-xs text-blue-600 hover:underline ml-1"
              >
                Limpar filtro
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search Results Mode */}
      {isSearching ? (
        <div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <SearchResults sections={filteredSections} query={searchQuery.trim()} />
          )}
        </div>
      ) : (
        /* Normal Tab Mode */
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 mb-6 bg-slate-100 p-1 rounded-lg">
            {allPages.map(p => (
              <TabsTrigger key={p.key} value={p.key} className="text-xs px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Pencil className="w-3 h-3 mr-1 text-blue-500" />
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {allPages.map(p => (
            <TabsContent key={p.key} value={p.key}>
              <div className="mb-3 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                <Pencil className="w-3 h-3" />
                Clique em <strong>Editar</strong> em qualquer seção para atualizar valores.
              </div>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : sectionsForPage(Number(p.key)).length === 0 ? (
                <div className="text-center py-12 text-slate-400">Nenhuma seção encontrada para esta página.</div>
              ) : (
                sectionsForPage(Number(p.key)).map(section => (
                  <EditableSection key={section.id} section={section as Section} />
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
      </div>
      )}

      {/* Modal de Histórico de Versões */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Histórico de Versões da Tabela de Preços
            </DialogTitle>
          </DialogHeader>
          {!history || history.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma alteração registrada ainda.</p>
              <p className="text-xs mt-1">As próximas edições aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...history].reverse().map((h) => (
                <div key={h.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600 text-white text-xs px-2 py-0.5">v{h.versao}</Badge>
                      <span className="font-medium text-slate-700">{h.sectionTitle}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 text-xs">
                      <Clock className="w-3 h-3" />
                      {new Date(h.createdAt).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <div className="text-slate-500 text-xs">
                    <span className="font-medium text-slate-600">Por:</span> {h.autor ?? "sistema"} &nbsp;|&nbsp;
                    <span className="font-medium text-slate-600">Campo:</span> {h.campoAlterado}
                  </div>
                  {h.campoAlterado === "contentJson" ? (
                    <div className="mt-1 text-xs text-slate-400 italic">Conteúdo da seção atualizado</div>
                  ) : (
                    <div className="mt-1 flex gap-2 text-xs">
                      <span className="text-red-500 line-through">{h.valorAnterior?.slice(0, 60)}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-green-600">{h.valorNovo?.slice(0, 60)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
