/** Ritmo diário da meta: barra fina mostrando o realizado acumulado até hoje sobre a meta
 * mensal, com um traço marcando onde o realizado "deveria" estar hoje (rateio por dias úteis
 * ou meta cheia, conforme o indicador — ver shared/ritmo-meta.ts). Só aparece no mês corrente.
 * Mesma paleta de cor por faixa do ProgressBar desta pasta (MetasComerciais.tsx). */
export interface RitmoDiarioBarProps {
  metaMensal: number;
  esperadoAteHoje: number;
  realizadoAteHoje: number;
  fmt: (v: number) => string;
}

export default function RitmoDiarioBar({ metaMensal, esperadoAteHoje, realizadoAteHoje, fmt }: RitmoDiarioBarProps) {
  if (metaMensal <= 0) return null;

  const pctRealizado = Math.min(100, Math.max(0, (realizadoAteHoje / metaMensal) * 100));
  const pctEsperado = Math.min(100, Math.max(0, (esperadoAteHoje / metaMensal) * 100));
  const delta = esperadoAteHoje > 0 ? ((realizadoAteHoje - esperadoAteHoje) / esperadoAteHoje) * 100 : 0;
  const adiantado = realizadoAteHoje >= esperadoAteHoje;
  const bg = adiantado ? "#22c55e" : delta >= -20 ? "#f59e0b" : "#ef4444";

  return (
    <div className="mt-1.5 space-y-0.5">
      <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div style={{ width: `${pctRealizado}%`, background: bg }} className="h-full rounded-full transition-all" />
        <div
          className="absolute top-0 h-full w-px bg-slate-500"
          style={{ left: `${pctEsperado}%` }}
          title={`Esperado até hoje: ${fmt(esperadoAteHoje)}`}
        />
      </div>
      <p className="text-[10px] text-slate-400">
        Hoje: {fmt(realizadoAteHoje)}
        {" · "}
        <span className={adiantado ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
          {adiantado ? "+" : ""}{delta.toFixed(0)}% {adiantado ? "adiantado" : "atrasado"}
        </span>
      </p>
    </div>
  );
}
