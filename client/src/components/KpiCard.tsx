import { isValidElement, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Componente lucide (Icon) ou um nó já pronto (<Icon size={16} />). */
  icon?: LucideIcon | ReactNode;
  /** Cor de destaque em hex. */
  color?: string;
  variant?: "accent" | "border";
  className?: string;
  onClick?: () => void;
  /** Conteúdo explicando fórmula/fonte/período/se é real ou estimado — quando
   * presente, mostra um ícone (i) ao lado do label que revela o tooltip. */
  tooltip?: ReactNode;
}

function LabelComTooltip({ label, tooltip }: { label: string; tooltip?: ReactNode }) {
  if (!tooltip) return <>{label}</>;
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <Info size={11} className="text-muted-foreground/70 hover:text-muted-foreground cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{tooltip}</TooltipContent>
      </Tooltip>
    </span>
  );
}

function renderIcon(icon: KpiCardProps["icon"], color: string) {
  if (!icon) return null;
  if (isValidElement(icon)) {
    return <span style={{ color }}>{icon}</span>;
  }
  const Icon = icon as LucideIcon;
  return <Icon className="w-5 h-5" style={{ color }} />;
}

export default function KpiCard({
  label,
  value,
  sub,
  icon,
  color = "#1e6fd9",
  variant = "accent",
  className,
  onClick,
  tooltip,
}: KpiCardProps) {
  const clickable = onClick
    ? "cursor-pointer transition-shadow hover:shadow-md"
    : "";

  if (variant === "border") {
    return (
      <Card
        className={cn("border-l-4", clickable, className)}
        style={{ borderLeftColor: color }}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              <LabelComTooltip label={label} tooltip={tooltip} />
            </span>
            {renderIcon(icon, color)}
          </div>
          <div className="text-2xl font-bold" style={{ color }}>
            {value}
          </div>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 relative overflow-hidden",
        clickable,
        className,
      )}
      onClick={onClick}
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-slate-500">
            <LabelComTooltip label={label} tooltip={tooltip} />
          </p>
          <p className="text-2xl font-bold metric-value" style={{ color }}>
            {value}
          </p>
          {sub && <p className="text-xs mt-1 text-slate-400">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-lg" style={{ background: `${color}15` }}>
          {renderIcon(icon, color)}
        </div>
      </div>
    </div>
  );
}
