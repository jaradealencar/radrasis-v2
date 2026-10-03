import { useState, type ReactNode } from "react";
import { CalendarCheck2, Check, Trash2, X } from "lucide-react";
import { Info } from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { diasEntre, formatarDataBr, STATUS_CAMPANHA_LABEL, type SemaforoCampanha } from "@shared/campanhas-whatsapp";

export type CampanhaLinha = RouterOutputs["campanhasWhatsapp"]["listar"]["campanhas"][number];
export type EventoCalendario = RouterOutputs["campanhasWhatsapp"]["calendario"]["eventos"][number];
export type AgendamentoLinha = RouterOutputs["campanhasWhatsapp"]["listarAgendamentos"][number];

/** Cores do semáforo: badge da tabela, chip do calendário (previsto) e ponto da legenda. */
export const SEMAFORO_ESTILO: Record<SemaforoCampanha, { emoji: string; badge: string; chip: string; ponto: string }> = {
  vermelho: { emoji: "🔴", badge: "bg-red-100 text-red-700 border-red-200", chip: "border-red-400 bg-red-50 text-red-800", ponto: "bg-red-500" },
  amarelo: { emoji: "🟡", badge: "bg-amber-100 text-amber-800 border-amber-200", chip: "border-amber-400 bg-amber-50 text-amber-900", ponto: "bg-amber-400" },
  verde: { emoji: "🟢", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", chip: "border-emerald-400 bg-emerald-50 text-emerald-800", ponto: "bg-emerald-500" },
};

const plural = (n: number, singular: string, pl: string) => `${n} ${n === 1 ? singular : pl}`;

/** Texto curto do estado da campanha ("Disparar hoje", "Atrasada 3 dias", "Em 5 dias"...). */
export function textoStatus(c: CampanhaLinha, hoje: string): string {
  if (c.tipo === "gatilho_venda") {
    if (c.clientesPendentes) return `${plural(c.clientesPendentes, "cliente", "clientes")} para contatar`;
    if (c.clientesAguardando) return `${plural(c.clientesAguardando, "cliente aguarda", "clientes aguardam")} o prazo`;
    if (!c.proximoEnvio) return "Sem vendas a vencer";
  }
  if (c.primeiroDisparoPendente) return "1º disparo pendente";
  if (!c.proximoEnvio) return "—";
  const faltam = diasEntre(hoje, c.proximoEnvio);
  if (faltam < 0) return `Atrasada ${plural(-faltam, "dia", "dias")}`;
  if (faltam === 0) return "Disparar hoje";
  if (c.semaforo === "verde") return "Em dia";
  return `Vence em ${plural(faltam, "dia", "dias")}`;
}

export function StatusCampanhaBadge({ campanha, hoje }: { campanha: CampanhaLinha; hoje: string }) {
  if (!campanha.semaforo) {
    return <Badge variant="outline" className="text-slate-500">⏸ {STATUS_CAMPANHA_LABEL[campanha.status]}</Badge>;
  }
  const estilo = SEMAFORO_ESTILO[campanha.semaforo];
  return <Badge variant="outline" className={estilo.badge}>{estilo.emoji} {textoStatus(campanha, hoje)}</Badge>;
}

/**
 * Label de campo do formulário de campanha + ícone (i) com a explicação do campo — abre no hover/foco (padrão do
 * Radix Tooltip, já usado em KpiCard.tsx) e também no clique/toque, para funcionar em telas sem mouse.
 */
export function LabelComAjuda({ htmlFor, texto, ajuda }: { htmlFor?: string; texto: string; ajuda: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex items-center gap-1">
      <Label htmlFor={htmlFor}>{texto}</Label>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="text-muted-foreground/70 hover:text-muted-foreground focus-visible:text-muted-foreground rounded-full"
            aria-label={`Ajuda: ${texto}`}
          >
            <Info size={13} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px] text-xs leading-relaxed space-y-1.5 whitespace-normal">
          {ajuda}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

const STATUS_AGENDAMENTO_ESTILO: Record<AgendamentoLinha["status"], string> = {
  planejado: "bg-blue-50 text-blue-700 border-blue-200",
  disparado: "bg-emerald-100 text-emerald-700 border-emerald-200",
  nao_disparado: "bg-red-100 text-red-700 border-red-200",
};

/**
 * Um agendamento do Planner (`campanhas_whatsapp_agendamentos`) com os botões de ação — reaproveitado no
 * calendário (`CalendarioCampanhas.tsx`) e no relatório por período (`RelatorioPeriodo.tsx`). "Disparada"/"Não
 * disparada" é só uma marcação manual do usuário (não dispara nada nem lê `campanhas_whatsapp_disparos`).
 */
export function AgendamentoItem({ agendamento, mostrarNome = false }: { agendamento: AgendamentoLinha; mostrarNome?: boolean }) {
  const utils = trpc.useUtils();
  const invalidar = () => { utils.campanhasWhatsapp.listarAgendamentos.invalidate(); utils.campanhasWhatsapp.relatorioPeriodo.invalidate(); };
  const marcar = trpc.campanhasWhatsapp.marcarAgendamento.useMutation({ onSuccess: invalidar });
  const remover = trpc.campanhasWhatsapp.removerAgendamento.useMutation({ onSuccess: invalidar });
  const ocupado = marcar.isPending || remover.isPending;

  return (
    <div className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${STATUS_AGENDAMENTO_ESTILO[agendamento.status]}`}>
      <CalendarCheck2 size={13} className="shrink-0" />
      <div className="min-w-0 flex-1">
        {mostrarNome && <div className="font-medium truncate">{agendamento.nome}</div>}
        <div className="flex items-center gap-1.5">
          <span>{formatarDataBr(agendamento.dataAgendada)}</span>
          {agendamento.observacoes && <span className="truncate text-[11px] opacity-80" title={agendamento.observacoes}>· {agendamento.observacoes}</span>}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {agendamento.status !== "disparado" && (
          <Button
            size="icon" variant="ghost" className="size-6 hover:bg-emerald-100" title="Marcar como disparada" disabled={ocupado}
            onClick={() => marcar.mutate({ id: agendamento.id, status: "disparado" })}
          ><Check size={13} className="text-emerald-700" /></Button>
        )}
        {agendamento.status !== "nao_disparado" && (
          <Button
            size="icon" variant="ghost" className="size-6 hover:bg-red-100" title="Marcar como não disparada" disabled={ocupado}
            onClick={() => marcar.mutate({ id: agendamento.id, status: "nao_disparado" })}
          ><X size={13} className="text-red-700" /></Button>
        )}
        <Button
          size="icon" variant="ghost" className="size-6 hover:bg-slate-200" title="Remover agendamento" disabled={ocupado}
          onClick={() => remover.mutate({ id: agendamento.id })}
        ><Trash2 size={13} className="text-slate-500" /></Button>
      </div>
    </div>
  );
}

export function slugArquivo(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campanha";
}
