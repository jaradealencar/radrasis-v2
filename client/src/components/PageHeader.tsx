import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Ícone lucide, renderizado num quadrado tonalizado à esquerda do título. */
  icon?: LucideIcon;
  /** Cor do ícone (hex ou token CSS). Default: azul da marca. */
  iconColor?: string;
  /** Botões/filtros alinhados à direita. */
  actions?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  description,
  icon: Icon,
  iconColor = "#1e6fd9",
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-4", className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className="p-2 rounded-lg shrink-0"
            style={{ background: `${iconColor}15` }}
          >
            <Icon className="w-[18px] h-[18px]" style={{ color: iconColor }} />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
