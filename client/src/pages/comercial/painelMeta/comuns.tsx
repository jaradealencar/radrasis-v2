import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { fmtBrl, fmtNum, fmtPct } from "@/lib/format";

/** R$ 349 mil / R$ 81,1 mil / R$ 4,19 mi — para textos corridos, onde o centavo só atrapalha. */
export function brlCurto(v: number): string {
  const abs = Math.abs(v);
  const sinal = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sinal}R$ ${fmtNum(abs / 1_000_000, 2)} mi`;
  if (abs >= 100_000) return `${sinal}R$ ${fmtNum(abs / 1000, 0)} mil`;
  if (abs >= 1_000) return `${sinal}R$ ${fmtNum(abs / 1000, 1)} mil`;
  return `${sinal}R$ ${fmtNum(abs, 0)}`;
}

export function kMil(v: number): string {
  return `${Math.round(v / 1000)}k`;
}

export { fmtBrl, fmtNum, fmtPct };

/** Variação relativa com cor: verde sobe, vermelho cai. `inverso` para indicadores em que cair é bom. */
export function Variacao({ valor, referencia, inverso }: { valor: number; referencia: number; inverso?: boolean }) {
  if (!(referencia > 0)) return null;
  const pct = (valor / referencia - 1) * 100;
  if (Math.abs(pct) < 0.05) return <span className="text-[11px] text-slate-400">igual a hoje</span>;
  const bom = inverso ? pct < 0 : pct > 0;
  return (
    <span className={`text-[11px] font-semibold ${bom ? "text-emerald-600" : "text-red-600"}`}>
      {pct > 0 ? "+" : ""}{fmtNum(pct, 1)}%
    </span>
  );
}

/** Input numérico que deixa o usuário apagar/digitar livremente sem "pular" o valor. */
export function CampoNumero({ valor, casas, onChange, className, ariaLabel }: {
  valor: number; casas: number; onChange: (v: number) => void; className?: string; ariaLabel?: string;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const formatado = String(Number(valor.toFixed(casas)));
  return (
    <Input
      type="number"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={texto ?? formatado}
      onFocus={() => setTexto(formatado)}
      onChange={e => {
        setTexto(e.target.value);
        const n = parseFloat(e.target.value);
        if (!Number.isNaN(n)) onChange(Math.max(0, n));
      }}
      onBlur={() => setTexto(null)}
      className={className}
    />
  );
}

export function Cartao({ titulo, subtitulo, children, className = "" }: {
  titulo?: string; subtitulo?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      {(titulo || subtitulo) && (
        <div className="px-4 pt-4 pb-2">
          {titulo && <h4 className="text-sm font-bold text-slate-800">{titulo}</h4>}
          {subtitulo && <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>}
        </div>
      )}
      <div className="px-4 pb-4">{children}</div>
    </div>
  );
}

type Tom = "verde" | "ambar" | "vermelho" | "azul" | "cinza";
const TONS: Record<Tom, string> = {
  verde: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ambar: "bg-amber-50 text-amber-700 border-amber-200",
  vermelho: "bg-red-50 text-red-700 border-red-200",
  azul: "bg-blue-50 text-blue-700 border-blue-200",
  cinza: "bg-slate-50 text-slate-600 border-slate-200",
};

export function Selo({ tom, children }: { tom: Tom; children: ReactNode }) {
  return <span className={`inline-flex items-center text-[11px] font-medium border rounded-full px-2 py-0.5 ${TONS[tom]}`}>{children}</span>;
}

export function Ficha({ rotulo, valor, sub, destaque }: { rotulo: string; valor: string; sub?: ReactNode; destaque?: "ok" | "falta" }) {
  const cor = destaque === "ok" ? "text-emerald-700" : "text-slate-800";
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className={`text-xl font-bold leading-tight ${cor}`}>{valor}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}
