import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { CampanhaLinha } from "./comuns";

interface Props {
  /** `null` = fechado. */
  campanha: CampanhaLinha | null;
  onClose: () => void;
}

/**
 * "Copiar uma campanha para não ter que configurar tudo de novo" (pedido do usuário 27/09/2026) — útil para
 * criar rapidamente campanhas parecidas (ex.: "subcampanhas" de prospecção por estado). Copia categoria, tipo,
 * cadência/quarentena, fontes vinculadas e modelos de mensagem; não copia arquivos da pasta nem histórico de
 * disparos (ver server/routers/campanhasWhatsapp.ts, `duplicarCampanha`).
 */
export default function DuplicarCampanhaDialog({ campanha, onClose }: Props) {
  const utils = trpc.useUtils();
  const [novoNome, setNovoNome] = useState("");

  useEffect(() => {
    if (campanha) setNovoNome(`${campanha.nome} (cópia)`);
  }, [campanha]);

  const duplicar = trpc.campanhasWhatsapp.duplicarCampanha.useMutation({
    onSuccess: () => {
      utils.campanhasWhatsapp.invalidate();
      toast.success("Campanha duplicada — ajuste o nome/fonte da cópia conforme precisar.");
      onClose();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <Dialog open={!!campanha} onOpenChange={v => { if (!v && !duplicar.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicar campanha</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cria uma cópia de <strong>{campanha?.nome}</strong> com a mesma categoria, tipo, cadência, quarentena,
            fontes de dados e modelos de mensagem. Arquivos e histórico de disparos não são copiados.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="dup-nome">Nome da cópia</Label>
            <Input id="dup-nome" value={novoNome} onChange={e => setNovoNome(e.target.value)} maxLength={160} autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={duplicar.isPending}>Cancelar</Button>
          <Button
            onClick={() => {
              if (!campanha) return;
              if (!novoNome.trim()) return toast.error("Informe o nome da cópia.");
              duplicar.mutate({ id: campanha.id, novoNome: novoNome.trim() });
            }}
            disabled={duplicar.isPending}
          >
            {duplicar.isPending && <Spinner className="mr-2" />}Duplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
