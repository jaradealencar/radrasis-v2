import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { diasEntre, STATUS_CAMPANHA_LABEL, type SemaforoCampanha } from "@shared/campanhas-whatsapp";

export type CampanhaLinha = RouterOutputs["campanhasWhatsapp"]["listar"]["campanhas"][number];
export type EventoCalendario = RouterOutputs["campanhasWhatsapp"]["calendario"]["eventos"][number];

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
    if (c.vendasPendentes) return `${plural(c.vendasPendentes, "venda", "vendas")} para contatar`;
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

export function slugArquivo(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campanha";
}
