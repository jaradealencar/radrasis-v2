import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FolderOpen, Loader2, Trash2, Upload, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { enviarArquivo } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";

/**
 * "Pasta" de arquivos da campanha (pedido do usuário: um lugar para salvar listas de contatos, sem precisar
 * ter feito um disparo ainda). Upload direto ao UploadThing (mesma rota "documento" do Registrar Disparo);
 * o registro só guarda nome/url/tamanho. Ver server/routers/campanhasWhatsapp.ts (listArquivos/adicionarArquivo).
 */

function fmtBytes(n: number): string {
  if (n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ArquivosCampanhaPopover({ campanhaId }: { campanhaId: number }) {
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: arquivos, isLoading } = trpc.campanhasWhatsapp.listArquivos.useQuery({ campanhaId });
  const invalidar = () => utils.campanhasWhatsapp.listArquivos.invalidate({ campanhaId });

  const adicionar = trpc.campanhasWhatsapp.adicionarArquivo.useMutation({
    onSuccess: invalidar,
  });
  const remover = trpc.campanhasWhatsapp.removerArquivo.useMutation({
    onSuccess: invalidar,
    onError: e => toast.error(e.message),
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setEnviando(true);
    let uploadConcluido = false;
    try {
      const up = await enviarArquivo("documento", file);
      uploadConcluido = true;
      await adicionar.mutateAsync({ campanhaId, nome: file.name, url: up.url, tamanhoBytes: file.size });
      toast.success("Arquivo salvo.");
    } catch (erro) {
      const detalhe = erro instanceof Error ? erro.message : "Tente novamente.";
      toast.error(
        uploadConcluido
          ? `O arquivo foi enviado, mas não consegui vinculá-lo à campanha. ${detalhe}`
          : `Não consegui enviar o arquivo. ${detalhe}`,
        { duration: 8000 },
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs gap-1 text-muted-foreground">
          <FolderOpen size={12} /> Arquivos{arquivos && arquivos.length > 0 ? ` (${arquivos.length})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-96 max-w-[calc(100vw-2rem)] max-h-(--radix-popover-content-available-height) p-0 shadow-xl border-0 rounded-xl overflow-y-auto">
        <div className="px-4 py-3 border-b flex items-center justify-between bg-amber-50 border-amber-300 text-amber-800">
          <div className="flex items-center gap-2"><FolderOpen className="w-4 h-4" /><span className="text-sm font-bold">Listas de contatos e arquivos</span></div>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/50"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-3 space-y-3 bg-gray-50">
          <input ref={inputRef} type="file" className="hidden" onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
          <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 border-amber-400 text-amber-700 hover:bg-amber-50"
            onClick={() => inputRef.current?.click()} disabled={enviando}>
            {enviando ? <Spinner className="size-3.5" /> : <Upload size={14} />} {enviando ? "Enviando..." : "Enviar arquivo"}
          </Button>

          {isLoading && <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...</div>}
          {!isLoading && arquivos?.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">Nenhum arquivo salvo ainda.</p>}
          {!isLoading && arquivos && arquivos.length > 0 && (
            <ul className="space-y-1 max-h-56 overflow-y-auto rounded-lg border bg-white divide-y">
              {arquivos.map(a => (
                <li key={a.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                  <a href={a.url} target="_blank" rel="noreferrer" title={`Baixar ${a.nome}`}
                    className="flex-1 min-w-0 flex items-center gap-1.5 truncate text-blue-700 hover:underline">
                    <Download size={12} className="shrink-0" /> <span className="truncate">{a.nome}</span>
                  </a>
                  <span className="text-[10px] text-muted-foreground shrink-0">{fmtBytes(a.tamanhoBytes)}</span>
                  <button onClick={() => remover.mutate({ id: a.id })} title="Remover" className="p-1 rounded hover:bg-red-100 text-red-500 shrink-0" disabled={remover.isPending}>
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
