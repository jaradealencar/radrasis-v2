# Fase 1 — Fundação: criar as primitivas compartilhadas

**Depende de:** nada. É a primeira fase.
**Todas as outras fases importam o que esta cria.** Não pule, não reordene.

## Objetivo

Criar 5 arquivos novos com os componentes/utilitários que hoje estão
duplicados nas páginas, e provar que funcionam refatorando **uma única
página piloto** (`qualidade/Metas.tsx`, 289 linhas).

Nesta fase você **cria** as primitivas. Você **não** sai trocando as
páginas — isso é trabalho das fases 2 a 11. A única página tocada aqui é a
piloto.

## Arquivos a criar

| Arquivo | Substitui |
|---|---|
| `client/src/lib/format.ts` | `fmtBrl`, `fmtDate`, `formatDate`, `formatCurrency`, `fmtNum`, `pct` locais (10+ páginas) |
| `client/src/lib/chartColors.ts` | `COLORS` / `CORES` hardcoded (7 páginas) e hex soltos |
| `client/src/components/PageHeader.tsx` | 134 cabeçalhos `<h1 className="text-2xl font-bold …">` |
| `client/src/components/KpiCard.tsx` | 7 `KpiCard` locais |
| `client/src/components/ChartTooltip.tsx` | 7 `CustomTooltip` locais |

---

## 1.1 — `client/src/lib/format.ts`

Crie exatamente este arquivo:

```ts
/**
 * Formatadores compartilhados (pt-BR).
 * Antes desta sprint cada página tinha sua própria versão destas funções.
 */

/** R$ 1.234,56 */
export function fmtBrl(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** R$ 1,2 mi / R$ 34,5 mil / R$ 123 — para eixos de gráfico e KPIs apertados */
export function fmtBrlCompact(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")} mil`;
  return `R$ ${v.toFixed(0)}`;
}

/** 1.234 (inteiro) ou 1.234,5 com casas */
export function fmtNum(v: number | null | undefined, casas = 0): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** 12,3% — recebe o número já em escala de percentual (12.3, não 0.123) */
export function fmtPct(v: number | null | undefined, casas = 1): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

/** parte / total em percentual, protegido contra divisão por zero */
export function pct(parte: number | null | undefined, total: number | null | undefined): number {
  if (!total || !parte) return 0;
  return (parte / total) * 100;
}

/** 31/12/2025 */
export function fmtDate(d: Date | string | number | null | undefined): string {
  if (d == null || d === "") return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

/** 31/12/2025 14:30 */
export function fmtDateTime(d: Date | string | number | null | undefined): string {
  if (d == null || d === "") return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 31/12 — para eixo de gráfico */
export function fmtDateShort(d: Date | string | number | null | undefined): string {
  if (d == null || d === "") return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export const MESES_ABREV = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;
```

> **Atenção ao `"—"` como retorno para nulo.** Várias páginas hoje retornam
> `""`, `"-"` ou `"R$ 0,00"` nesse caso. A Fase 2 diz explicitamente como
> lidar com cada divergência — não tente resolver isso aqui.

### Teste

Crie `client/src/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fmtBrl, fmtNum, fmtPct, pct, fmtDate, fmtBrlCompact } from "./format";

describe("format", () => {
  it("fmtBrl formata moeda pt-BR", () => {
    expect(fmtBrl(1234.5)).toContain("1.234,50");
    expect(fmtBrl(null)).toBe("—");
  });

  it("fmtBrlCompact abrevia milhares e milhões", () => {
    expect(fmtBrlCompact(1_500_000)).toBe("R$ 1,5 mi");
    expect(fmtBrlCompact(34_500)).toBe("R$ 34,5 mil");
    expect(fmtBrlCompact(123)).toBe("R$ 123");
  });

  it("fmtNum respeita casas decimais", () => {
    expect(fmtNum(1234)).toBe("1.234");
    expect(fmtNum(1234.56, 2)).toBe("1.234,56");
  });

  it("fmtPct e pct", () => {
    expect(fmtPct(12.34)).toBe("12,3%");
    expect(pct(50, 200)).toBe(25);
    expect(pct(50, 0)).toBe(0);
  });

  it("fmtDate lida com string, Date e inválido", () => {
    expect(fmtDate(new Date(2025, 11, 31))).toBe("31/12/2025");
    expect(fmtDate("não é data")).toBe("—");
    expect(fmtDate(undefined)).toBe("—");
  });
});
```

---

## 1.2 — `client/src/lib/chartColors.ts`

Hoje cada página redeclara seu próprio array de cores. Os valores abaixo
foram extraídos das declarações existentes (`Dashboard.tsx:19`,
`comercial/PerformanceComercial.tsx:1028`, `comercial/InteligenteClientes.tsx:572`,
`operacoes/Performance.tsx:1264`, `comercial/EvolucaoDiariaVendedor.tsx:10`).

```ts
/**
 * Paleta única de gráficos. Antes desta sprint cada página tinha o seu
 * próprio array COLORS/CORES com hex quase iguais.
 */

/** Série categórica — use com índice: CHART_COLORS[i % CHART_COLORS.length] */
export const CHART_COLORS = [
  "#3b82f6", // azul
  "#8b5cf6", // roxo
  "#22c55e", // verde
  "#f59e0b", // âmbar
  "#ef4444", // vermelho
  "#0ea5e9", // ciano
  "#ec4899", // rosa
  "#14b8a6", // teal
  "#f97316", // laranja
  "#84cc16", // lima
] as const;

/** Cores semânticas — status, KPIs, badges */
export const STATUS_COLORS = {
  positivo: "#22c55e",
  negativo: "#ef4444",
  atencao: "#f59e0b",
  neutro: "#64748b",
  info: "#3b82f6",
  destaque: "#8b5cf6",
} as const;

export type StatusColor = keyof typeof STATUS_COLORS;

/** Pega a cor da série pelo índice, com wrap-around. */
export function chartColor(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length];
}
```

---

## 1.3 — `client/src/components/PageHeader.tsx`

Padrão extraído dos 134 cabeçalhos manuais. Cobre os três formatos em uso:
só título; título + subtítulo; título + subtítulo + ícone + ações à direita.

```tsx
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
```

---

## 1.4 — `client/src/components/KpiCard.tsx`

Une as 7 versões locais. Duas variantes cobrem todos os formatos hoje em uso:

- `variant="accent"` — a de `Dashboard.tsx` / `PerformanceComercial.tsx`:
  faixa de gradiente no topo, ícone em caixa tonalizada.
- `variant="border"` — a de `financeiro/CustosFixos.tsx` / `PainelDRE.tsx`:
  `Card` com borda esquerda colorida.

```tsx
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
}

function renderIcon(icon: KpiCardProps["icon"], color: string) {
  if (!icon) return null;
  if (typeof icon === "function") {
    const Icon = icon as LucideIcon;
    return <Icon className="w-5 h-5" style={{ color }} />;
  }
  return <span style={{ color }}>{icon}</span>;
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
              {label}
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
            {label}
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
```

---

## 1.5 — `client/src/components/ChartTooltip.tsx`

Une os 7 `CustomTooltip` locais. O que variava entre eles era só **como o
valor é formatado** — vira a prop `format`.

```tsx
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
```

Uso no recharts (a fase 5 detalha):

```tsx
<Tooltip content={<ChartTooltip format={fmtBrl} />} />
```

---

## 1.6 — Página piloto: `client/src/pages/qualidade/Metas.tsx`

Prova de que as primitivas funcionam. Aplique **as quatro** nesta página:

1. **PageHeader** — o cabeçalho está em `qualidade/Metas.tsx:119-125`
   (`<div className="flex items-center justify-between">` com
   `<h1 className="text-2xl font-bold text-slate-800">Metas e Benchmarks</h1>`).
   Troque por `<PageHeader title="Metas e Benchmarks" description="…" actions={…} />`,
   mantendo o botão que hoje fica à direita como `actions`.

2. **Tabela** — `qualidade/Metas.tsx:199` tem um `<table className="w-full
   text-sm">`. Converta para `ui/table` seguindo o mapeamento da Fase 6
   (resumo: `<table>`→`<Table>`, `<thead>`→`<TableHeader>`,
   `<tbody>`→`<TableBody>`, `<tr>`→`<TableRow>`, `<th>`→`<TableHead>`,
   `<td>`→`<TableCell>`). Se o `<table>` estiver dentro de um
   `<div className="overflow-x-auto">`, **remova esse div** — o `<Table>` do
   shadcn já traz o container com `overflow-x-auto`.

3. **format.ts** — a página já importa `MESES` local (`qualidade/Metas.tsx:13`,
   array de meses abreviados). Remova e importe `MESES_ABREV` de
   `@/lib/format`. Troque os `toLocaleString` inline por `fmtBrl`/`fmtNum`.

4. **chartColors** — a página usa recharts (`BarChart`). Se houver hex de cor
   hardcoded, troque por `chartColor(i)` ou `STATUS_COLORS.*`.

**Não aplique `KpiCard` nesta página** se ela não tiver cards de KPI — não
force.

---

## Verificação

```bash
yarn run check
yarn test          # os testes novos de format.ts precisam passar
yarn build
```

Depois, `yarn dev` e abra a rota de **Metas** (qualidade). Compare com o
`git stash` / com a versão anterior: a tabela pode ter borda/padding
ligeiramente diferentes (é o shadcn), mas **as mesmas colunas, na mesma
ordem, com os mesmos valores**.

## Definição de pronto

- [ ] `client/src/lib/format.ts` criado
- [ ] `client/src/lib/format.test.ts` criado e passando
- [ ] `client/src/lib/chartColors.ts` criado
- [ ] `client/src/components/PageHeader.tsx` criado
- [ ] `client/src/components/KpiCard.tsx` criado
- [ ] `client/src/components/ChartTooltip.tsx` criado
- [ ] `qualidade/Metas.tsx` usando PageHeader + `ui/table` + `format.ts`
- [ ] `yarn run check`, `yarn test` e `yarn build` passando
- [ ] Commit: `refactor(pages): cria primitivas compartilhadas e refatora Metas como piloto (sprint pages, fase 1)`
