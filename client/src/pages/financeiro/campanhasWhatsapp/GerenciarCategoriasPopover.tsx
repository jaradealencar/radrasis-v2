import { useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Check, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";

/**
 * Gerenciamento das categorias de campanha (criar, renomear, arquivar/reativar, excluir sem uso) — o usuário
 * pediu poder acrescentar categorias em vez de ficar preso à lista fixa original. Popover (não Dialog) porque
 * é aberto de dentro do CampanhaFormDialog, que já é um Dialog (mesmo padrão de ScriptsFaixaPopover).
 */
export default function GerenciarCategoriasPopover() {
  const [open, setOpen] = useState(false);
  const [novoLabel, setNovoLabel] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const utils = trpc.useUtils();
  const invalidar = () => utils.campanhasWhatsapp.listarCategorias.invalidate();
  const { data: categorias, isLoading } = trpc.campanhasWhatsapp.listarCategorias.useQuery(undefined, { enabled: open });

  const criar = trpc.campanhasWhatsapp.criarCategoria.useMutation({
    onSuccess: () => { setNovoLabel(""); invalidar(); },
    onError: e => toast.error(e.message),
  });
  const renomear = trpc.campanhasWhatsapp.renomearCategoria.useMutation({
    onSuccess: () => { setEditandoId(null); invalidar(); },
    onError: e => toast.error(e.message),
  });
  const arquivar = trpc.campanhasWhatsapp.arquivarCategoria.useMutation({
    onSuccess: invalidar,
    onError: e => toast.error(e.message),
  });
  const excluir = trpc.campanhasWhatsapp.excluirCategoria.useMutation({
    onSuccess: invalidar,
    onError: e => toast.error(e.message),
  });

  const criarNova = () => {
    const label = novoLabel.trim();
    if (label) criar.mutate({ label });
  };
  const salvarRenome = (id: number) => {
    const label = editLabel.trim();
    if (label) renomear.mutate({ id, label });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs gap-1 text-muted-foreground">
          <Settings2 size={12} /> Gerenciar categorias
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-80 max-h-(--radix-popover-content-available-height) overflow-y-auto p-3 space-y-3">
        <p className="text-xs font-semibold text-slate-700">Categorias de campanha</p>

        {isLoading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : (
          <ul className="space-y-0.5 max-h-64 overflow-y-auto">
            {categorias?.length === 0 && <li className="text-xs text-muted-foreground text-center py-2">Nenhuma categoria ainda.</li>}
            {categorias?.map(c => (
              <li key={c.id} className="flex items-center gap-1 text-sm rounded px-1.5 py-1 hover:bg-slate-50">
                {editandoId === c.id ? (
                  <>
                    <Input
                      value={editLabel} onChange={e => setEditLabel(e.target.value)} className="h-7 text-xs flex-1" autoFocus maxLength={80}
                      onKeyDown={e => { if (e.key === "Enter") salvarRenome(c.id); if (e.key === "Escape") setEditandoId(null); }}
                    />
                    <button className="p-1 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-40" title="Salvar"
                      disabled={!editLabel.trim() || renomear.isPending} onClick={() => salvarRenome(c.id)}>
                      <Check size={14} />
                    </button>
                    <button className="p-1 text-slate-500 hover:bg-slate-100 rounded" title="Cancelar" onClick={() => setEditandoId(null)}>
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 truncate ${!c.ativo ? "text-muted-foreground line-through" : ""}`}>{c.label}</span>
                    {c.emUso > 0 && <span className="text-[10px] text-muted-foreground shrink-0" title="Campanhas usando esta categoria">{c.emUso}×</span>}
                    <button className="p-1 text-slate-500 hover:bg-slate-100 rounded" title="Renomear"
                      onClick={() => { setEditandoId(c.id); setEditLabel(c.label); }}>
                      <Pencil size={13} />
                    </button>
                    <button className="p-1 text-slate-500 hover:bg-slate-100 rounded" title={c.ativo ? "Arquivar" : "Reativar"}
                      disabled={arquivar.isPending} onClick={() => arquivar.mutate({ id: c.id, ativo: !c.ativo })}>
                      {c.ativo ? <Archive size={13} /> : <ArchiveRestore size={13} />}
                    </button>
                    {c.emUso === 0 && (
                      <button className="p-1 text-red-500 hover:bg-red-50 rounded" title="Excluir" disabled={excluir.isPending}
                        onClick={() => { if (window.confirm(`Excluir a categoria "${c.label}"?`)) excluir.mutate({ id: c.id }); }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-1.5 pt-2 border-t">
          <Input
            value={novoLabel} onChange={e => setNovoLabel(e.target.value)} placeholder="Nova categoria" maxLength={80}
            className="h-8 text-xs flex-1" onKeyDown={e => { if (e.key === "Enter") criarNova(); }}
          />
          <Button size="sm" className="h-8 gap-1" disabled={!novoLabel.trim() || criar.isPending} onClick={criarNova}>
            {criar.isPending ? <Spinner className="size-3.5" /> : <Plus size={14} />}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
