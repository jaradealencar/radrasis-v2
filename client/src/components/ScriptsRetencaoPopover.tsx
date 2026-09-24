import React, { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Copy, Check, Pencil, Trash2, Plus, X, Save, MessageSquareText, Loader2,
  GripVertical, Info, MessageCircle,
} from "lucide-react";
import { linkWhatsAppComTexto } from "@/lib/faixasCrm";
import { substituirVariaveis } from "@/lib/mensagensCrm";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Scripts sugeridos por estágio da jornada de Retenção de Clientes Novos —
 * mesmo padrão de client/src/components/ScriptsFaixaPopover.tsx (CRM), com
 * "faixa" (funil de follow-up) trocado por "estagio" (marco da jornada de 1
 * ano) e os endpoints do router `retencaoClientesNovos`.
 */

type EstagioJornada = "d16u" | "d30" | "d60" | "d90" | "d180" | "d270" | "d365";

interface ScriptRow {
  id: number;
  titulo: string | null;
  conteudo: string;
  conteudoVoz?: string | null;
  copiaCount?: number;
}

interface Props {
  estagio: EstagioJornada;
  label: string;
  children: React.ReactNode;
  nomeCliente?: string;
  vendedor?: string;
  whatsappLink?: string | null;
}

const VARIAVEIS = [
  { token: "{nome_cliente}", label: "Primeiro nome do cliente" },
  { token: "{vendedor}", label: "Nome do vendedor" },
];

function ScriptCard({
  script, estagio, onRefresh, vars, whatsappLink,
}: {
  script: ScriptRow;
  estagio: EstagioJornada;
  onRefresh: () => void;
  vars: { nomeCliente?: string; vendedor?: string };
  whatsappLink?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitulo, setEditTitulo] = useState(script.titulo ?? "");
  const [editConteudo, setEditConteudo] = useState(script.conteudo);
  const [showVarHint, setShowVarHint] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: script.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const incrementCopia = trpc.retencaoClientesNovos.incrementCopiaRetencao.useMutation();
  const updateScript = trpc.retencaoClientesNovos.updateScriptRetencao.useMutation({
    onSuccess: () => { toast.success("Script salvo!"); setEditing(false); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteScript = trpc.retencaoClientesNovos.deleteScriptRetencao.useMutation({
    onSuccess: () => { toast.success("Script removido."); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const handleCopy = async () => {
    const texto = substituirVariaveis(script.conteudo, vars);
    await navigator.clipboard.writeText(texto);
    setCopied(true);
    incrementCopia.mutate({ id: script.id });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!whatsappLink) return;
    const texto = substituirVariaveis(script.conteudo, vars);
    window.open(linkWhatsAppComTexto(whatsappLink, texto), "_blank", "noopener,noreferrer");
    incrementCopia.mutate({ id: script.id });
  };

  const handleSave = () => {
    if (!editConteudo.trim()) return;
    updateScript.mutate({ id: script.id, titulo: editTitulo || undefined, conteudo: editConteudo });
  };

  const copiaCount = script.copiaCount ?? 0;

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1.5 border-b bg-emerald-50 border-emerald-300 text-emerald-800">
        {!editing && (
          <button {...attributes} {...listeners} className="p-0.5 rounded cursor-grab active:cursor-grabbing text-emerald-400 hover:text-emerald-600" title="Arrastar para reordenar">
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}
        {editing ? (
          <Input value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} placeholder="Título do script..." className="h-6 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 font-semibold flex-1 mx-1" />
        ) : (
          <span className="text-xs font-semibold truncate flex-1 mx-1">{script.titulo || "Script"}</span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!editing && copiaCount > 0 && (
            <span title={`Usado ${copiaCount}x`} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-300">{copiaCount}×</span>
          )}
          {!editing && (
            <>
              <button onClick={handleCopy} title="Copiar script" className="p-1 rounded hover:bg-white/60"> {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}</button>
              <button onClick={() => { setEditing(true); setEditTitulo(script.titulo ?? ""); setEditConteudo(script.conteudo); }} title="Editar script" className="p-1 rounded hover:bg-white/60"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => deleteScript.mutate({ id: script.id })} title="Remover script" className="p-1 rounded hover:bg-red-100 text-red-500" disabled={deleteScript.isPending}>
                {deleteScript.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
          {editing && (
            <>
              <button onClick={() => setShowVarHint((v) => !v)} title="Ver variáveis disponíveis" className="p-1 rounded hover:bg-blue-100 text-blue-600"><Info className="w-3.5 h-3.5" /></button>
              <button onClick={handleSave} title="Salvar" className="p-1 rounded hover:bg-green-100 text-green-700" disabled={updateScript.isPending}>
                {updateScript.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setEditing(false)} title="Cancelar" className="p-1 rounded hover:bg-gray-100"><X className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      </div>

      {editing && showVarHint && (
        <div className="px-3 py-2 bg-blue-50 border-b border-blue-200">
          <p className="text-[10px] text-blue-700 font-semibold mb-1">Variáveis disponíveis (substituídas ao copiar):</p>
          <div className="flex flex-wrap gap-1">
            {VARIAVEIS.map((v) => (
              <button key={v.token} onClick={() => setEditConteudo((c) => c + v.token)} title={`Inserir ${v.token}`} className="text-[9px] font-mono bg-blue-100 text-blue-800 border border-blue-300 rounded px-1.5 py-0.5 hover:bg-blue-200">{v.token}</button>
            ))}
          </div>
        </div>
      )}

      <div className="px-3 py-2">
        {editing ? (
          <Textarea value={editConteudo} onChange={(e) => setEditConteudo(e.target.value)} className="text-xs min-h-[80px] resize-y" placeholder="Texto do script... Use {nome_cliente}, {vendedor}" />
        ) : (
          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{substituirVariaveis(script.conteudo, vars)}</p>
        )}
      </div>

      {!editing && (
        <div className="px-3 pb-2">
          <div className="flex gap-2">
            <button onClick={handleCopy} className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded border transition-all ${copied ? "bg-green-50 border-green-300 text-green-700" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"}`}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copiado!" : "Copiar mensagem"}
            </button>
            {whatsappLink && (
              <button onClick={handleWhatsApp} title="Abrir a conversa no WhatsApp já com esta mensagem digitada" className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded border border-green-300 bg-green-500 text-white hover:bg-green-600">
                <MessageCircle className="w-3.5 h-3.5" /> Enviar no WhatsApp
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddScriptForm({ estagio, onAdded }: { estagio: EstagioJornada; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");

  const addScript = trpc.retencaoClientesNovos.addScriptRetencao.useMutation({
    onSuccess: () => { toast.success("Script adicionado!"); setTitulo(""); setConteudo(""); setOpen(false); onAdded(); },
    onError: (e) => toast.error(e.message),
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded border border-dashed border-emerald-400 text-emerald-700 hover:bg-emerald-50">
        <Plus className="w-3.5 h-3.5" /> Adicionar script
      </button>
    );
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm p-3 space-y-2">
      <span className="text-xs font-semibold text-gray-700">Novo script</span>
      <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ex: Checagem de entrega)" className="h-7 text-xs" />
      <Textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="Texto da mensagem... Use {nome_cliente}, {vendedor}" className="text-xs min-h-[80px] resize-y" />
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs flex-1" onClick={() => addScript.mutate({ estagio, titulo: titulo || undefined, conteudo })} disabled={!conteudo.trim() || addScript.isPending}>
          {addScript.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />} Salvar
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </div>
  );
}

export function ScriptsRetencaoPopover({ estagio, label, children, nomeCliente, vendedor, whatsappLink }: Props) {
  const [open, setOpen] = useState(false);
  const [localOrder, setLocalOrder] = useState<number[]>([]);

  const { data: scripts, refetch, isLoading } = trpc.retencaoClientesNovos.listScriptsRetencao.useQuery({ estagio }, { enabled: open });

  const prevScriptsRef = React.useRef<number[]>([]);
  React.useEffect(() => {
    if (!scripts) return;
    const ids = scripts.map((s: ScriptRow) => s.id);
    const prev = prevScriptsRef.current;
    const sameIds = ids.length === prev.length && ids.every((id: number, i: number) => id === prev[i]);
    if (!sameIds) { prevScriptsRef.current = ids; setLocalOrder(ids); }
  }, [scripts]);

  const reorderMutation = trpc.retencaoClientesNovos.reorderScriptsRetencao.useMutation({
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
      reorderMutation.mutate({ estagio, orderedIds: newOrder });
      return newOrder;
    });
  }, [estagio, reorderMutation]);

  const orderedScripts: ScriptRow[] = localOrder.map((id) => scripts?.find((s) => s.id === id)).filter(Boolean) as ScriptRow[];
  const vars = { nomeCliente, vendedor };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="bottom" align="start" avoidCollisions={false} className="w-[420px] p-0 shadow-xl border-0 rounded-xl overflow-hidden" style={{ maxHeight: "82vh", overflowY: "auto" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between bg-emerald-50 border-emerald-300 text-emerald-800">
          <div className="flex items-center gap-2"><MessageSquareText className="w-4 h-4" /><span className="text-sm font-bold">Scripts — {label}</span></div>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/50"><X className="w-4 h-4" /></button>
        </div>

        {(nomeCliente || vendedor) && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-[10px] text-blue-700 font-semibold w-full">Variáveis preenchidas automaticamente:</span>
            {nomeCliente && <span className="text-[10px] text-blue-600"><code className="font-mono">{"{nome_cliente}"}</code> → {nomeCliente}</span>}
            {vendedor && <span className="text-[10px] text-blue-600"><code className="font-mono">{"{vendedor}"}</code> → {vendedor}</span>}
          </div>
        )}

        <div className="p-3 space-y-3 bg-gray-50">
          {isLoading && <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando scripts...</div>}
          {!isLoading && scripts?.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">Nenhum script cadastrado para este estágio ainda.</p>}
          {!isLoading && orderedScripts.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedScripts.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {orderedScripts.map((s) => <ScriptCard key={s.id} script={s} estagio={estagio} onRefresh={refetch} vars={vars} whatsappLink={whatsappLink} />)}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <AddScriptForm estagio={estagio} onAdded={refetch} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
