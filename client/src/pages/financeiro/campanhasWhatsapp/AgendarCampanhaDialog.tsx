import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { hojeCampoGrande } from "@shared/campanhas-whatsapp";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-preenchido quando aberto a partir de uma linha de campanha já conhecida (relatório). */
  campanhaIdInicial?: number;
  /** Pré-preenchido quando aberto a partir de um clique num dia do calendário. */
  dataInicial?: string;
}

/**
 * "Planner": agenda uma campanha para uma data ("eu planejo disparar isto neste dia") — pedido do usuário
 * 27/09/2026. É só um plano/lembrete, não processa nenhuma lista de contatos; depois de agendada, o usuário
 * marca com um clique se disparou ou não (`AgendamentoItem`, em comuns.tsx).
 */
export default function AgendarCampanhaDialog({ open, onOpenChange, campanhaIdInicial, dataInicial }: Props) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.campanhasWhatsapp.listar.useQuery(undefined, { enabled: open });
  const ativas = data?.campanhas.filter(c => c.status === "ativa") ?? [];

  const [campanhaId, setCampanhaId] = useState("");
  const [dataAgendada, setDataAgendada] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!open) return;
    setCampanhaId(campanhaIdInicial ? String(campanhaIdInicial) : "");
    setDataAgendada(dataInicial ?? hojeCampoGrande());
    setObservacoes("");
  }, [open, campanhaIdInicial, dataInicial]);

  const criar = trpc.campanhasWhatsapp.criarAgendamento.useMutation({
    onSuccess: () => {
      utils.campanhasWhatsapp.listarAgendamentos.invalidate();
      utils.campanhasWhatsapp.relatorioPeriodo.invalidate();
      toast.success("Campanha agendada.");
      onOpenChange(false);
    },
    onError: e => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => { if (!criar.isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar campanha</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Campanha</Label>
            <Select value={campanhaId} onValueChange={setCampanhaId} disabled={isLoading || !!campanhaIdInicial}>
              <SelectTrigger><SelectValue placeholder={isLoading ? "Carregando..." : "Selecione"} /></SelectTrigger>
              <SelectContent>
                {ativas.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agenda-data">Data planejada</Label>
            <Input id="agenda-data" type="date" value={dataAgendada} onChange={e => setDataAgendada(e.target.value)} className="sm:w-48" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agenda-obs">Observações (opcional)</Label>
            <Textarea id="agenda-obs" value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} maxLength={500}
              placeholder="Ex.: lote 2, só cidades do interior..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={criar.isPending}>Cancelar</Button>
          <Button
            onClick={() => {
              if (!campanhaId) return toast.error("Selecione a campanha.");
              if (!dataAgendada) return toast.error("Informe a data.");
              criar.mutate({ campanhaId: Number(campanhaId), dataAgendada, observacoes: observacoes.trim() || null });
            }}
            disabled={criar.isPending}
          >
            {criar.isPending && <Spinner className="mr-2" />}Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
