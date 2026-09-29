import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CampanhaLinha } from "./comuns";

interface Props {
  /** `null` = fechado. */
  campanha: CampanhaLinha | null;
  onClose: () => void;
}

/**
 * Exclusão definitiva (não confundir com arquivar em `CampanhaFormDialog`, que só tira da lista ativa sem
 * apagar nada). Apaga junto disparos, agendamentos, scripts, arquivos e o vínculo com fontes — ver
 * server/routers/campanhasWhatsapp.ts (`excluir`).
 */
export default function ExcluirCampanhaDialog({ campanha, onClose }: Props) {
  const utils = trpc.useUtils();

  const excluir = trpc.campanhasWhatsapp.excluir.useMutation({
    onSuccess: () => {
      utils.campanhasWhatsapp.invalidate();
      toast.success("Campanha excluída.");
    },
    onError: e => toast.error(e.message),
  });

  return (
    <AlertDialog open={!!campanha} onOpenChange={v => { if (!v) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso apaga <strong>{campanha?.nome}</strong> e todo o histórico de disparos, agendamentos, modelos de
            mensagem e arquivos vinculados a ela. Não pode ser desfeito. Se quiser só parar de usar sem perder o
            histórico, use "Editar campanha" e mude o status para arquivada.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            onClick={() => { if (campanha) excluir.mutate({ id: campanha.id }); }}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
