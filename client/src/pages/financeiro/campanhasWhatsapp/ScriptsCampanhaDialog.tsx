import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Loader2, MessageSquareText, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/**
 * Modelos de mensagem sugeridos para a campanha — mesmo padrão de
 * client/src/components/ScriptsRetencaoPopover.tsx (CRM/Retenção), trocando "faixa"/"estágio" por "campanha".
 * Sem variáveis de substituição nem link de WhatsApp direto: aqui não há um contato individual associado (é um
 * modelo genérico para copiar e colar no disparo), diferente dos outros dois popovers.
 */

interface ScriptRow { id: number; titulo: string | null; conteudo: string; copiaCount: number }

function ScriptCard({ script, onRefresh }: { script: ScriptRow; onRefresh: () => void }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitulo, setEditTitulo] = useState(script.titulo ?? "");
  const [editConteudo, setEditConteudo] = useState(script.conteudo);

  const incrementCopia = trpc.campanhasWhatsapp.incrementCopiaScript.useMutation();
  const updateScript = trpc.campanhasWhatsapp.updateScript.useMutation({
    onSuccess: () => { toast.success("Script salvo."); setEditing(false); onRefresh(); },
    onError: e => toast.error(e.message),
  });
  const deleteScript = trpc.campanhasWhatsapp.deleteScript.useMutation({
    onSuccess: () => { toast.success("Script removido."); onRefresh(); },
    onError: e => toast.error(e.message),
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(script.conteudo);
    setCopied(true);
    incrementCopia.mutate({ id: script.id });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (!editConteudo.trim()) return;
    updateScript.mutate({ id: script.id, titulo: editTitulo || undefined, conteudo: editConteudo });
  };

  return (
    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1.5 border-b bg-blue-50 border-blue-300 text-blue-800">
        {editing ? (
          <Input value={editTitulo} onChange={e => setEditTitulo(e.target.value)} placeholder="Título do script..."
            className="h-6 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 font-semibold flex-1 mx-1" />
        ) : (
          <span className="text-xs font-semibold truncate flex-1 mx-1">{script.titulo || "Script"}</span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {!editing && script.copiaCount > 0 && (
            <span title={`Copiado ${script.copiaCount}x`} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-blue-100 text-blue-800 border-blue-300">{script.copiaCount}×</span>
          )}
          {!editing ? (
            <>
              <button onClick={handleCopy} title="Copiar script" className="p-1 rounded hover:bg-white/60">
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => { setEditing(true); setEditTitulo(script.titulo ?? ""); setEditConteudo(script.conteudo); }} title="Editar script" className="p-1 rounded hover:bg-white/60">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => deleteScript.mutate({ id: script.id })} title="Remover script" className="p-1 rounded hover:bg-red-100 text-red-500" disabled={deleteScript.isPending}>
                {deleteScript.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </>
          ) : (
            <>
              <button onClick={handleSave} title="Salvar" className="p-1 rounded hover:bg-green-100 text-green-700" disabled={updateScript.isPending}>
                {updateScript.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setEditing(false)} title="Cancelar" className="p-1 rounded hover:bg-gray-100"><X className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      </div>
      <div className="px-3 py-2">
        {editing ? (
          <Textarea value={editConteudo} onChange={e => setEditConteudo(e.target.value)} className="text-sm min-h-[140px] resize-y" placeholder="Texto do modelo de mensagem..." />
        ) : (
          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{script.conteudo}</p>
        )}
      </div>
    </div>
  );
}

function AddScriptForm({ campanhaId, onAdded }: { campanhaId: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");

  const addScript = trpc.campanhasWhatsapp.addScript.useMutation({
    onSuccess: () => { toast.success("Script adicionado."); setTitulo(""); setConteudo(""); setOpen(false); onAdded(); },
    onError: e => toast.error(e.message),
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded border border-dashed border-blue-400 text-blue-700 hover:bg-blue-50">
        <Plus className="w-3.5 h-3.5" /> Adicionar modelo de mensagem
      </button>
    );
  }
  return (
    <div className="rounded-lg border bg-white shadow-sm p-3 space-y-2">
      <span className="text-xs font-semibold text-gray-700">Novo modelo</span>
      <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título (ex.: Primeiro contato)" className="h-7 text-xs" maxLength={128} />
      <Textarea value={conteudo} onChange={e => setConteudo(e.target.value)} placeholder="Texto da mensagem..." className="text-sm min-h-[140px] resize-y" />
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs flex-1" disabled={!conteudo.trim() || addScript.isPending}
          onClick={() => addScript.mutate({ campanhaId, titulo: titulo || undefined, conteudo })}>
          {addScript.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />} Salvar
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </div>
  );
}

export default function ScriptsCampanhaDialog({ campanhaId }: { campanhaId: number }) {
  const [open, setOpen] = useState(false);
  const { data: scripts, refetch, isLoading } = trpc.campanhasWhatsapp.listScripts.useQuery({ campanhaId });

  return (
    <>
      <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs gap-1 text-muted-foreground" onClick={() => setOpen(true)}>
        <MessageSquareText size={12} /> Modelos de mensagem{scripts && scripts.length > 0 ? ` (${scripts.length})` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-blue-50 text-blue-800">
            <DialogTitle className="flex items-center gap-2 text-base"><MessageSquareText className="w-4 h-4" /> Modelos de mensagem</DialogTitle>
            <DialogDescription className="sr-only">Cadastre, edite e copie os modelos de mensagem desta campanha.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {isLoading && <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...</div>}
            {!isLoading && scripts?.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">Nenhum modelo cadastrado ainda.</p>}
            {!isLoading && (scripts ?? []).map(s => <ScriptCard key={s.id} script={s} onRefresh={refetch} />)}
            <AddScriptForm campanhaId={campanhaId} onAdded={refetch} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
