import { cn } from "@/lib/utils";

interface ChartTooltipProps {
  /** injetadas pelo recharts */
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
  /** Como formatar cada valor. Default: número pt-BR. Ex.: format={fmtBrl} */
  format?: (v: number) => string;
  className?: string;
}

export default function ChartTooltip({
  active,
  payload,
  label,
  format,
  className,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const fmt = (v: number | string | undefined) => {
    if (typeof v !== "number") return String(v ?? "—");
    return format ? format(v) : v.toLocaleString("pt-BR");
  };

  return (
    <div
      className={cn(
        "bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-sm min-w-[180px]",
        className,
      )}
    >
      {label != null && (
        <div className="font-semibold text-slate-700 mb-2 border-b pb-1">
          {label}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: p.color }} className="font-medium">
            {p.name}
          </span>
          <span className="font-bold text-slate-800">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
