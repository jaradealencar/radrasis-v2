import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Props {
  /** Prefixo para ids dos campos (evita colisão quando há mais de um período na mesma tela). */
  id: string;
  inicio: string;
  onInicio: (v: string) => void;
  /** `true` = sem data final: a apuração acompanha o relógio e a lista se retroalimenta. */
  fimAutomatico: boolean;
  onFimAutomatico: (v: boolean) => void;
  fim: string;
  onFim: (v: string) => void;
  hoje: string;
  /** Mostrado no campo inicial enquanto o usuário não escolheu uma data (ex.: primeira compra do histórico). */
  inicioPadrao?: string | null;
}

/**
 * Período de apuração de uma campanha: data inicial + data final OU "automático". O automático não tem data
 * final, então quem entra no grupo depois aparece sozinho (lista permanente, como a de clientes a reativar).
 * Mesmo controle no formulário da campanha e em "Ver contatos".
 */
export default function PeriodoApuracao({ id, inicio, onInicio, fimAutomatico, onFimAutomatico, fim, onFim, hoje, inicioPadrao }: Props) {
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
      <div className="space-y-1">
        <Label htmlFor={`${id}-inicio`} className="text-xs">Início da apuração</Label>
        <Input id={`${id}-inicio`} type="date" className="w-44" max={fimAutomatico ? hoje : (fim || hoje)}
          value={inicio || inicioPadrao || ""} onChange={e => onInicio(e.target.value)} />
        {!inicio && inicioPadrao && <p className="text-[11px] text-muted-foreground">Padrão: primeiro registro do histórico.</p>}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Final da apuração</Label>
        <RadioGroup value={fimAutomatico ? "auto" : "data"} onValueChange={v => onFimAutomatico(v === "auto")} className="gap-2">
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="auto" id={`${id}-fim-auto`} />
            Automático (sem data final, atualiza sozinho)
          </label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="data" id={`${id}-fim-data`} />
              Data final
            </label>
            <Input id={`${id}-fim`} type="date" className="w-44" max={hoje} disabled={fimAutomatico}
              value={fim} onChange={e => onFim(e.target.value)} aria-label="Data final da apuração" />
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
