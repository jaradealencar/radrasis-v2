import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save } from "lucide-react";

export type FaixaConfig = { faixa: 1 | 2 | 3; label: string; diasInicio: number; diasFim: number };

const FAIXA_COR: Record<1 | 2 | 3, string> = {
  1: "border-yellow-300 bg-yellow-50 text-yellow-800",
  2: "border-pink-300 bg-pink-50 text-pink-800",
  3: "border-orange-300 bg-orange-50 text-orange-800",
};

/** Valida localmente as mesmas regras aplicadas no backend (crm.saveFaixas):
 * dias inteiros >= 1, fim >= início, e faixas contíguas sem sobreposição. */
export function validarFaixas(faixas: FaixaConfig[]): string | null {
  const ordenadas = [...faixas].sort((a, b) => a.faixa - b.faixa);
  for (const f of ordenadas) {
    if (!Number.isFinite(f.diasInicio) || !Number.isFinite(f.diasFim)) {
      return `Faixa ${f.faixa}: preencha os dias de início e fim.`;
    }
    if (f.diasInicio < 1) return `Faixa ${f.faixa}: o dia inicial precisa ser 1 ou mais.`;
    if (f.diasFim < f.diasInicio) return `Faixa ${f.faixa}: o dia final não pode ser menor que o inicial.`;
  }
  for (let i = 1; i < ordenadas.length; i++) {
    if (ordenadas[i].diasInicio <= ordenadas[i - 1].diasFim) {
      return `Faixa ${ordenadas[i].faixa} (dia ${ordenadas[i].diasInicio}) colide com o fim da Faixa ${ordenadas[i - 1].faixa} (dia ${ordenadas[i - 1].diasFim}).`;
    }
  }
  return null;
}

/**
 * Formulário de edição das 3 faixas de follow-up (dias úteis + etiqueta) —
 * compartilhado entre CRMConfig.tsx e InteligenteClientes.tsx (SecaoTempoFollowUp)
 * para não duplicar lógica/estado. Salva as 3 faixas de uma vez (mutation
 * atômica) para o gestor poder reordenar os limites sem se preocupar com a
 * ordem em que salva cada uma.
 */
export function FaixaDiasConfigForm({ variant = "full" }: { variant?: "full" | "compact" }) {
  const utils = trpc.useUtils();
  const { data } = trpc.crm.getFaixaEtiquetas.useQuery();
  const [rows, setRows] = useState<FaixaConfig[] | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data && !rows) {
      setRows([1, 2, 3].map(f => ({ ...data[f as 1 | 2 | 3] })));
    }
  }, [data, rows]);

  const save = trpc.crm.saveFaixas.useMutation({
    onSuccess: () => {
      toast.success("Faixas de follow-up salvas!");
      setDirty(false);
      utils.crm.getFaixaEtiquetas.invalidate();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  if (!rows) return null;

  const erro = validarFaixas(rows);
  const update = (faixa: 1 | 2 | 3, patch: Partial<FaixaConfig>) => {
    setRows(prev => prev!.map(r => (r.faixa === faixa ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.faixa} className={variant === "compact" ? "flex items-center gap-2 flex-wrap py-1.5" : "flex items-center gap-3 flex-wrap py-3 border-b last:border-0"}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 ${FAIXA_COR[r.faixa]}`}>
            {r.faixa}
          </div>
          <Input
            value={r.label}
            onChange={e => update(r.faixa, { label: e.target.value })}
            placeholder={`Nome da Faixa ${r.faixa}`}
            className="h-8 text-sm flex-1 min-w-[140px]"
          />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
            <span>dia</span>
            <Input
              type="number"
              min={1}
              value={r.diasInicio}
              onChange={e => update(r.faixa, { diasInicio: parseInt(e.target.value, 10) || 0 })}
              className="h-8 w-16 text-xs text-center"
            />
            <span>até</span>
            <Input
              type="number"
              min={1}
              value={r.diasFim}
              onChange={e => update(r.faixa, { diasFim: parseInt(e.target.value, 10) || 0 })}
              className="h-8 w-16 text-xs text-center"
            />
            <span>dias úteis</span>
          </div>
        </div>
      ))}

      {erro && <div className="text-xs text-red-600 font-medium">{erro}</div>}

      <div className="flex justify-end pt-1">
        <Button
          size="sm"
          className="h-8 text-xs gap-1"
          disabled={save.isPending || !dirty || !!erro}
          onClick={() => save.mutate({ faixas: rows })}
        >
          <Save className="w-3 h-3" />
          {save.isPending ? "Salvando..." : "Salvar faixas"}
        </Button>
      </div>
    </div>
  );
}
