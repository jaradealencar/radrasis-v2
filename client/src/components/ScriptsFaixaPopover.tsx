import React, { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Copy, Check, Pencil, Trash2, Plus, X, Save, MessageSquareText, Loader2,
  GripVertical, Info, Mic, ChevronDown,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ScriptRow {
  id: number;
  titulo: string | null;
  conteudo: string;
  conteudo_voz?: string | null;
  copia_count?: number;
}

interface Props {
  faixa: 1 | 2 | 3 | 11 | 12 | 13 | 20;
  label: string;
  bgCls: string;
  children: React.ReactNode;
  // Dados da proposta para substituição de variáveis
  nomeCliente?: string;
  produto?: string;
  valor?: string;
  vendedor?: string;
}

// ─── Variáveis dinâmicas disponíveis ─────────────────────────────────────────
const VARIAVEIS = [
  { token: "{nome_cliente}", label: "Nome do cliente" },
  { token: "{produto}",      label: "Produto/OS" },
  { token: "{valor}",        label: "Valor da proposta" },
  { token: "{vendedor}",     label: "Nome do vendedor" },
];

function substituirVariaveis(
  texto: string,
  vars: { nomeCliente?: string; produto?: string; valor?: string; vendedor?: string }
): string {
  return texto
    .replace(/\{nome_cliente\}/gi, vars.nomeCliente || "{nome_cliente}")
    .replace(/\{produto\}/gi,      vars.produto      || "{produto}")
    .replace(/\{valor\}/gi,        vars.valor        || "{valor}")
    .replace(/\{vendedor\}/gi,     vars.vendedor     || "{vendedor}");
}

// ─── Cores por faixa ──────────────────────────────────────────────────────────
const FAIXA_COLORS: Record<number, { header: string; badge: string; addBtn: string; grip: string }> = {
  1: {
    header:  "bg-yellow-50 border-yellow-300 text-yellow-800",
    badge:   "bg-yellow-100 text-yellow-800 border-yellow-300",
    addBtn:  "border-yellow-400 text-yellow-700 hover:bg-yellow-50",
    grip:    "text-yellow-400 hover:text-yellow-600",
  },
  2: {
    header:  "bg-pink-50 border-pink-300 text-pink-800",
    badge:   "bg-pink-100 text-pink-800 border-pink-300",
    addBtn:  "border-pink-400 text-pink-700 hover:bg-pink-50",
    grip:    "text-pink-400 hover:text-pink-600",
  },
  3: {
    header:  "bg-orange-50 border-orange-300 text-orange-800",
    badge:   "bg-orange-100 text-orange-800 border-orange-300",
    addBtn:  "border-orange-400 text-orange-700 hover:bg-orange-50",
    grip:    "text-orange-400 hover:text-orange-600",
  },
  // Status de resposta
  11: {
    header:  "bg-red-50 border-red-300 text-red-800",
    badge:   "bg-red-100 text-red-800 border-red-300",
    addBtn:  "border-red-400 text-red-700 hover:bg-red-50",
    grip:    "text-red-400 hover:text-red-600",
  },
  12: {
    header:  "bg-amber-50 border-amber-300 text-amber-800",
    badge:   "bg-amber-100 text-amber-800 border-amber-300",
    addBtn:  "border-amber-400 text-amber-700 hover:bg-amber-50",
    grip:    "text-amber-400 hover:text-amber-600",
  },
  13: {
    header:  "bg-green-50 border-green-300 text-green-800",
    badge:   "bg-green-100 text-green-800 border-green-300",
    addBtn:  "border-green-400 text-green-700 hover:bg-green-50",
    grip:    "text-green-400 hover:text-green-600",
  },
  // Objeções de Preço
  20: {
    header:  "bg-violet-50 border-violet-300 text-violet-800",
    badge:   "bg-violet-100 text-violet-800 border-violet-300",
    addBtn:  "border-violet-400 text-violet-700 hover:bg-violet-50",
    grip:    "text-violet-400 hover:text-violet-600",
  },
};

// ─── ScriptCard (sortable) ────────────────────────────────────────────────────
function ScriptCard({
  script,
  faixa,
  onRefresh,
  vars,
}: {
  script: ScriptRow;
  faixa: number;
  onRefresh: () => void;
  vars: { nomeCliente?: string; produto?: string; valor?: string; vendedor?: string };
}) {
  const [copied, setCopied] = useState(false);
  const [copiedVoz, setCopiedVoz] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitulo, setEditTitulo] = useState(script.titulo ?? "");
  const [editConteudo, setEditConteudo] = useState(script.conteudo);
  const [editConteudoVoz, setEditConteudoVoz] = useState(script.conteudo_voz ?? "");
  const [showVarHint, setShowVarHint] = useState(false);
  const [vozOpen, setVozOpen] = useState(false);
  const [editingVoz, setEditingVoz] = useState(false);
  const [vozDraft, setVozDraft] = useState(script.conteudo_voz ?? "");
  const colors = FAIXA_COLORS[faixa];

  // dnd-kit sortable
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: script.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const incrementCopia = trpc.crm.incrementCopiaCount.useMutation();
  const updateScript   = trpc.crm.updateScript.useMutation({
    onSuccess: () => { toast.success("Script salvo!"); setEditing(false); onRefresh(); },
    onError:   (e) => toast.error(e.message),
  });
  const deleteScript   = trpc.crm.deleteScript.useMutation({
    onSuccess: () => { toast.success("Script removido."); onRefresh(); },
    onError:   (e) => toast.error(e.message),
  });

  const handleCopy = async () => {
    const texto = substituirVariaveis(script.conteudo, vars);
    await navigator.clipboard.writeText(texto);
    setCopied(true);
    incrementCopia.mutate({ id: script.id });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (!editConteudo.trim()) return;
    updateScript.mutate({ id: script.id, titulo: editTitulo || undefined, conteudo: editConteudo, conteudo_voz: editConteudoVoz || undefined });
  };

  const handleSaveVoz = () => {
    updateScript.mutate(
      { id: script.id, conteudo: script.conteudo, conteudo_voz: vozDraft || undefined },
      {
        onSuccess: () => { toast.success("Script de voz salvo!"); setEditingVoz(false); onRefresh(); },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleCopyVoz = async () => {
    const texto = substituirVariaveis(script.conteudo_voz || script.conteudo, vars);
    await navigator.clipboard.writeText(texto);
    setCopiedVoz(true);
    incrementCopia.mutate({ id: script.id });
    setTimeout(() => setCopiedVoz(false), 2000);
  };

  const copiaCount = script.copia_count ?? 0;

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`flex items-center justify-between px-2 py-1.5 border-b ${colors.header}`}>
        {/* Grip de arrastar */}
        {!editing && (
          <button
            {...attributes}
            {...listeners}
            className={`p-0.5 rounded cursor-grab active:cursor-grabbing transition-colors ${colors.grip}`}
            title="Arrastar para reordenar"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}

        {editing ? (
          <Input
            value={editTitulo}
            onChange={(e) => setEditTitulo(e.target.value)}
            placeholder="Título do script..."
            className="h-6 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 font-semibold flex-1 mx-1"
          />
        ) : (
          <span className="text-xs font-semibold truncate flex-1 mx-1">{script.titulo || "Script"}</span>
        )}

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Badge contador de cópias */}
          {!editing && copiaCount > 0 && (
            <span
              title={`Copiado ${copiaCount}x`}
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${colors.badge}`}
            >
              {copiaCount}×
            </span>
          )}

          {!editing && (
            <>
              <button onClick={handleCopy} title="Copiar script" className="p-1 rounded hover:bg-white/60 transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => { setEditing(true); setEditTitulo(script.titulo ?? ""); setEditConteudo(script.conteudo); }}
                title="Editar script"
                className="p-1 rounded hover:bg-white/60 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteScript.mutate({ id: script.id })}
                title="Remover script"
                className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors"
                disabled={deleteScript.isPending}
              >
                {deleteScript.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </>
          )}

          {editing && (
            <>
              <button
                onClick={() => setShowVarHint((v) => !v)}
                title="Ver variáveis disponíveis"
                className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleSave}
                title="Salvar"
                className="p-1 rounded hover:bg-green-100 text-green-700 transition-colors"
                disabled={updateScript.isPending}
              >
                {updateScript.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setEditing(false)} title="Cancelar" className="p-1 rounded hover:bg-gray-100 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hint de variáveis (visível ao editar) */}
      {editing && showVarHint && (
        <div className="px-3 py-2 bg-blue-50 border-b border-blue-200">
          <p className="text-[10px] text-blue-700 font-semibold mb-1">Variáveis disponíveis (substituídas ao copiar):</p>
          <div className="flex flex-wrap gap-1">
            {VARIAVEIS.map((v) => (
              <button
                key={v.token}
                onClick={() => setEditConteudo((c) => c + v.token)}
                title={`Inserir ${v.token}`}
                className="text-[9px] font-mono bg-blue-100 text-blue-800 border border-blue-300 rounded px-1.5 py-0.5 hover:bg-blue-200 transition-colors"
              >
                {v.token}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="px-3 py-2">
        {editing ? (
          <Textarea
            value={editConteudo}
            onChange={(e) => setEditConteudo(e.target.value)}
            className="text-xs min-h-[80px] resize-y"
            placeholder="Texto do script... Use {nome_cliente}, {produto}, {valor}, {vendedor}"
          />
        ) : (
          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
            {substituirVariaveis(script.conteudo, vars)}
          </p>
        )}
      </div>

      {/* Botão copiar grande */}
      {!editing && (
        <div className="px-3 pb-2 space-y-2">
          <button
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded border transition-all ${
              copied
                ? "bg-green-50 border-green-300 text-green-700"
                : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copiado!" : "Copiar mensagem"}
          </button>

          {/* Subcélula de voz */}
          <Collapsible open={vozOpen} onOpenChange={setVozOpen}>
            <CollapsibleTrigger asChild>
              <button className={`w-full flex items-center justify-between gap-1.5 text-xs font-medium py-1.5 px-2 rounded border transition-all ${
                vozOpen
                  ? "bg-orange-50 border-orange-300 text-orange-700"
                  : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600"
              }`}>
                <span className="flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" />
                  Script para áudio / voz
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${vozOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1.5 rounded border border-orange-200 bg-orange-50 overflow-hidden">
                {/* Header da subcélula de voz com botão editar/salvar */}
                <div className="flex items-center justify-between px-3 pt-2 pb-1">
                  <span className="text-[10px] font-semibold text-orange-700 uppercase tracking-wide">Script de voz</span>
                  <div className="flex items-center gap-1">
                    {editingVoz ? (
                      <>
                        <button
                          onClick={handleSaveVoz}
                          disabled={updateScript.isPending}
                          title="Salvar script de voz"
                          className="p-1 rounded hover:bg-green-100 text-green-700 transition-colors"
                        >
                          {updateScript.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => { setEditingVoz(false); setVozDraft(script.conteudo_voz ?? ""); }}
                          title="Cancelar"
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setEditingVoz(true); setVozDraft(script.conteudo_voz ?? ""); }}
                        title="Editar script de voz"
                        className="p-1 rounded hover:bg-orange-100 text-orange-600 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Conteúdo de voz */}
                <div className="px-3 pb-2">
                  {editingVoz ? (
                    <Textarea
                      value={vozDraft}
                      onChange={(e) => setVozDraft(e.target.value)}
                      className="text-xs min-h-[80px] resize-y border-orange-300 bg-white focus:border-orange-400"
                      placeholder="Digite o script para áudio/voz... Use {nome_cliente}, {produto}, {valor}, {vendedor}"
                      autoFocus
                    />
                  ) : (
                    <p className="text-xs text-orange-800 whitespace-pre-wrap leading-relaxed">
                      {script.conteudo_voz
                        ? substituirVariaveis(script.conteudo_voz, vars)
                        : <span className="italic text-orange-400">Nenhum script de voz cadastrado. Clique em ✏️ para adicionar.</span>
                      }
                    </p>
                  )}
                </div>

                {!editingVoz && script.conteudo_voz && (
                  <div className="px-3 pb-2">
                    <button
                      onClick={handleCopyVoz}
                      className={`w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded border transition-all ${
                        copiedVoz
                          ? "bg-green-50 border-green-300 text-green-700"
                          : "bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200"
                      }`}
                    >
                      {copiedVoz ? <Check className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      {copiedVoz ? "Copiado!" : "Copiar script de voz"}
                    </button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}

// ─── Formulário de adição ─────────────────────────────────────────────────────
function AddScriptForm({ faixa, onAdded }: { faixa: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [showVarHint, setShowVarHint] = useState(false);
  const colors = FAIXA_COLORS[faixa];

  const addScript = trpc.crm.addScript.useMutation({
    onSuccess: () => { toast.success("Script adicionado!"); setTitulo(""); setConteudo(""); setOpen(false); onAdded(); },
    onError:   (e) => toast.error(e.message),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded border border-dashed transition-colors ${colors.addBtn}`}
      >
        <Plus className="w-3.5 h-3.5" /> Adicionar script
      </button>
    );
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">Novo script</span>
        <button
          onClick={() => setShowVarHint((v) => !v)}
          title="Ver variáveis disponíveis"
          className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {showVarHint && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2">
          <p className="text-[10px] text-blue-700 font-semibold mb-1">Clique para inserir variável:</p>
          <div className="flex flex-wrap gap-1">
            {VARIAVEIS.map((v) => (
              <button
                key={v.token}
                onClick={() => setConteudo((c) => c + v.token)}
                className="text-[9px] font-mono bg-blue-100 text-blue-800 border border-blue-300 rounded px-1.5 py-0.5 hover:bg-blue-200 transition-colors"
              >
                {v.token}
              </button>
            ))}
          </div>
        </div>
      )}

      <Input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título (ex: Urgência de prazo)"
        className="h-7 text-xs"
      />
      <Textarea
        value={conteudo}
        onChange={(e) => setConteudo(e.target.value)}
        placeholder="Texto da mensagem... Use {nome_cliente}, {produto}, {valor}, {vendedor}"
        className="text-xs min-h-[80px] resize-y"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={() => addScript.mutate({ faixa, titulo: titulo || undefined, conteudo })}
          disabled={!conteudo.trim() || addScript.isPending}
        >
          {addScript.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
          Salvar
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ─── Popover principal ────────────────────────────────────────────────────────
export function ScriptsFaixaPopover({ faixa, label, bgCls, children, nomeCliente, produto, valor, vendedor }: Props) {
  const [open, setOpen] = useState(false);
  const [localOrder, setLocalOrder] = useState<number[]>([]);
  const colors = FAIXA_COLORS[faixa];

  const { data: scripts, refetch, isLoading } = trpc.crm.listScripts.useQuery(
    { faixa },
    { enabled: open }
  );

  // Sincroniza a ordem local quando os scripts chegam do servidor
  const prevScriptsRef = React.useRef<number[]>([]);
  React.useEffect(() => {
    if (!scripts) return;
    const ids = scripts.map((s: ScriptRow) => s.id);
    const prev = prevScriptsRef.current;
    const sameIds = ids.length === prev.length && ids.every((id: number, i: number) => id === prev[i]);
    if (!sameIds) {
      prevScriptsRef.current = ids;
      setLocalOrder(ids);
    }
  }, [scripts]);

  const reorderMutation = trpc.crm.reorderScripts.useMutation({
    onError: (e) => toast.error("Erro ao salvar ordem: " + e.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalOrder((prev) => {
      const oldIndex = prev.indexOf(Number(active.id));
      const newIndex = prev.indexOf(Number(over.id));
      const newOrder = arrayMove(prev, oldIndex, newIndex);
      // Persiste no banco
      reorderMutation.mutate({ faixa, orderedIds: newOrder });
      return newOrder;
    });
  }, [faixa, reorderMutation]);

  // Ordena os scripts conforme localOrder
  const orderedScripts: ScriptRow[] = localOrder
    .map((id) => scripts?.find((s) => s.id === id))
    .filter(Boolean) as ScriptRow[];

  const FAIXA_LABELS: Record<number, string> = {
    1:  "Faixa 1 — Follow-up imediato (dias úteis 1–3)",
    2:  "Faixa 2 — Acompanhamento (dias úteis 4–7)",
    3:  "Faixa 3 — Encerramento (dias úteis 8–15)",
    11: "Scripts — Não retornou",
    12: "Scripts — Esperando cliente",
    13: "Scripts — Garantiu fechamento",
  };
  const faixaLabel = FAIXA_LABELS[faixa] ?? label;
  const safeColors = colors ?? FAIXA_COLORS[1];

  const vars = { nomeCliente, produto, valor, vendedor };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={`rounded-lg border px-2 py-1.5 cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-400 transition-all ${bgCls}`}
          title={`Ver scripts de vendas — ${label}`}
        >
          <div className="flex items-center gap-1 mb-1">
            <div className="text-[9px] font-bold text-center text-gray-500 uppercase tracking-wide flex-1">{label}</div>
            <MessageSquareText className="w-3 h-3 text-gray-400 flex-shrink-0" />
          </div>
          {children}
        </div>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        avoidCollisions={false}
        className="w-[440px] p-0 shadow-xl border-0 rounded-xl overflow-hidden"
        style={{ maxHeight: "82vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div className={`px-4 py-3 border-b flex items-center justify-between ${safeColors.header}`}>
          <div className="flex items-center gap-2">
            <MessageSquareText className="w-4 h-4" />
            <span className="text-sm font-bold">{faixaLabel}</span>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Aviso de variáveis preenchidas */}
        {(nomeCliente || produto || valor || vendedor) && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-[10px] text-blue-700 font-semibold w-full">Variáveis preenchidas automaticamente:</span>
            {nomeCliente && <span className="text-[10px] text-blue-600"><code className="font-mono">{"{nome_cliente}"}</code> → {nomeCliente}</span>}
            {produto      && <span className="text-[10px] text-blue-600"><code className="font-mono">{"{produto}"}</code> → {produto}</span>}
            {valor        && <span className="text-[10px] text-blue-600"><code className="font-mono">{"{valor}"}</code> → {valor}</span>}
            {vendedor     && <span className="text-[10px] text-blue-600"><code className="font-mono">{"{vendedor}"}</code> → {vendedor}</span>}
          </div>
        )}

        {/* Scripts com DnD */}
        <div className="p-3 space-y-3 bg-gray-50">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando scripts...
            </div>
          )}

          {!isLoading && scripts?.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-4">
              Nenhum script cadastrado para esta faixa.
            </p>
          )}

          {!isLoading && orderedScripts.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedScripts.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {orderedScripts.map((s) => (
                    <ScriptCard key={s.id} script={s} faixa={faixa} onRefresh={refetch} vars={vars} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <AddScriptForm faixa={faixa} onAdded={refetch} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
