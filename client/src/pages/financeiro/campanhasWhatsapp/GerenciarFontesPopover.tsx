import { useRef, useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, FolderInput, Loader2, Plus, Settings2, Upload, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { enviarArquivo } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";

/**
 * Gerenciamento das fontes de dados tipo "arquivo" (as 4 "erp" são fixas — só podem ser arquivadas/reativadas,
 * nunca criadas/excluídas pela tela). Fundido com "Arquivos" (decisão do usuário): o upload aqui cria um
 * arquivo "solto" (campanhas_whatsapp_arquivos sem campanhaId) e a fonte só referencia esse arquivo — os
 * contatos são extraídos dele sob demanda ao gerar a lista (server/services/fontesErpCampanhas.ts).
 */
export default function GerenciarFontesPopover() {
  const [open, setOpen] = useState(false);
  const [criando, setCriando] = useState(false);
  const [label, setLabel] = useState("");
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: fontes, isLoading } = trpc.campanhasWhatsapp.listarFontes.useQuery(undefined, { enabled: open });
  const invalidar = () => utils.campanhasWhatsapp.listarFontes.invalidate();

  const adicionarArquivo = trpc.campanhasWhatsapp.adicionarArquivo.useMutation();
  const criarFonteArquivo = trpc.campanhasWhatsapp.criarFonteArquivo.useMutation({
    onSuccess: () => { setLabel(""); setCriando(false); invalidar(); toast.success("Fonte criada."); },
    onError: e => toast.error(e.message),
  });
  const arquivar = trpc.campanhasWhatsapp.arquivarFonte.useMutation({ onSuccess: invalidar, onError: e => toast.error(e.message) });

  async function escolherArquivo(file: File | undefined) {
    if (!file || !label.trim()) {
      if (!label.trim()) toast.error("Dê um nome à fonte antes de escolher o arquivo.");
      return;
    }
    setEnviando(true);
    try {
      const up = await enviarArquivo("documento", file);
      const arquivo = await adicionarArquivo.mutateAsync({ nome: file.name, url: up.url, tamanhoBytes: file.size });
      await criarFonteArquivo.mutateAsync({ label: label.trim(), arquivoId: arquivo.id });
    } catch {
      toast.error("Não consegui salvar essa fonte. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const ocupado = enviando || arquivar.isPending;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs gap-1 text-muted-foreground">
          <Settings2 size={12} /> Gerenciar fontes
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-96 max-w-[calc(100vw-2rem)] max-h-(--radix-popover-content-available-height) overflow-y-auto p-3 space-y-3">
        <p className="text-xs font-semibold text-slate-700">Fontes de dados</p>

        {isLoading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : (
          <ul className="space-y-0.5 max-h-64 overflow-y-auto">
            {fontes?.map(f => (
              <li key={f.id} className="flex items-center gap-1.5 text-sm rounded px-1.5 py-1 hover:bg-slate-50">
                {f.tipo === "erp"
                  ? <span title="Fonte automática do histórico local" className="text-blue-500 shrink-0">⚙</span>
                  : <FolderInput size={13} className="text-amber-600 shrink-0" />}
                <span className={`flex-1 truncate ${!f.ativo ? "text-muted-foreground line-through" : ""}`} title={f.descricao ?? undefined}>
                  {f.label}
                </span>
                {f.tipo === "arquivo" && f.arquivo && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[6rem]" title={f.arquivo.nome}>{f.arquivo.nome}</span>
                )}
                <button className="p-1 text-slate-500 hover:bg-slate-100 rounded shrink-0" title={f.ativo ? "Arquivar" : "Reativar"}
                  disabled={ocupado} onClick={() => arquivar.mutate({ id: f.id, ativo: !f.ativo })}>
                  {f.ativo ? <Archive size={13} /> : <ArchiveRestore size={13} />}
                </button>
              </li>
            ))}
            {fontes?.length === 0 && <li className="text-xs text-muted-foreground text-center py-2">Nenhuma fonte ainda.</li>}
          </ul>
        )}

        <div className="pt-2 border-t space-y-2">
          {!criando ? (
            <button onClick={() => setCriando(true)} className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded border border-dashed border-amber-400 text-amber-700 hover:bg-amber-50">
              <Plus size={14} /> Nova fonte externa (upload)
            </button>
          ) : (
            <div className="space-y-2">
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Nome da fonte (ex.: Prospecção Google Maps)" className="h-8 text-xs" maxLength={120} autoFocus />
              <input ref={inputRef} type="file" className="hidden" onChange={e => { escolherArquivo(e.target.files?.[0]); e.target.value = ""; }} />
              <div className="flex gap-1.5">
                <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 flex-1" disabled={ocupado} onClick={() => inputRef.current?.click()}>
                  {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {ocupado ? "Salvando..." : "Escolher arquivo"}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8" disabled={ocupado} onClick={() => { setCriando(false); setLabel(""); }}>
                  <X size={14} />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Mesmo formato do disparo: colunas <code>telefone</code> e <code>nome_cliente</code>.</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
