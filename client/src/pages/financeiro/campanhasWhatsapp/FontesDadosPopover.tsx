import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Database, FolderInput } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import GerenciarFontesPopover from "./GerenciarFontesPopover";

/**
 * Multi-seleção de Fontes de Dados de uma campanha (pedido do usuário: combinar ERP + externas ao mesmo
 * tempo). Autosave a cada clique (mesmo padrão responsivo dos Scripts) — sem botão "salvar" separado.
 */
export default function FontesDadosPopover({ campanhaId }: { campanhaId: number }) {
  const [open, setOpen] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const utils = trpc.useUtils();

  const { data: fontes, isLoading: carregandoFontes } = trpc.campanhasWhatsapp.listarFontes.useQuery();
  const { data: vinculadas, isLoading: carregandoVinculadas } = trpc.campanhasWhatsapp.listarFontesDaCampanha.useQuery({ campanhaId });

  useEffect(() => {
    if (vinculadas) setSelecionadas(new Set(vinculadas.map(f => f.id)));
  }, [vinculadas]);

  const vincular = trpc.campanhasWhatsapp.vincularFontes.useMutation({
    onError: e => toast.error(e.message),
    onSettled: () => utils.campanhasWhatsapp.listarFontesDaCampanha.invalidate({ campanhaId }),
  });

  const alternar = (fonteId: number) => {
    const nova = new Set(selecionadas);
    nova.has(fonteId) ? nova.delete(fonteId) : nova.add(fonteId);
    setSelecionadas(nova);
    vincular.mutate({ campanhaId, fonteIds: [...nova] });
  };

  const ativas = (fontes ?? []).filter(f => f.ativo);
  const carregando = carregandoFontes || carregandoVinculadas;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs gap-1 text-muted-foreground">
          <Database size={12} /> Fontes de dados{selecionadas.size > 0 ? ` (${selecionadas.size})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-96 max-w-[calc(100vw-2rem)] max-h-(--radix-popover-content-available-height) overflow-y-auto p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700">Combine as audiências desta campanha</p>
          {vincular.isPending && <Spinner className="size-3.5" />}
        </div>

        {carregando ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : ativas.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhuma fonte disponível ainda — crie uma abaixo.</p>
        ) : (
          <ul className="space-y-1 max-h-56 overflow-y-auto">
            {ativas.map(f => (
              <li key={f.id}>
                <label className="flex items-start gap-2 text-sm rounded px-1.5 py-1 hover:bg-slate-50 cursor-pointer">
                  <Checkbox checked={selecionadas.has(f.id)} onCheckedChange={() => alternar(f.id)} className="mt-0.5" />
                  {f.tipo === "erp"
                    ? <span title="Fonte automática do histórico local" className="text-blue-500 shrink-0 mt-0.5">⚙</span>
                    : <FolderInput size={13} className="text-amber-600 shrink-0 mt-0.5" />}
                  <span className="flex-1">
                    <span className="block">{f.label}</span>
                    {f.descricao && <span className="block text-[11px] text-muted-foreground">{f.descricao}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-2 border-t"><GerenciarFontesPopover /></div>
      </PopoverContent>
    </Popover>
  );
}
