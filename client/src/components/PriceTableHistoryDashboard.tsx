import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  History,
  Minus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RouterOutputs } from "@/lib/trpc";

type HistoryRecord = RouterOutputs["price"]["getHistory"][number];
type TableFilter = "todas" | "principal" | "novo_cliente";

interface Props {
  history: HistoryRecord[] | undefined;
  sections: Array<{ id: number; page: number }>;
  isLoading?: boolean;
  error?: string;
  initialTable?: TableFilter;
}
interface MarginChange {
  row: string;
  range: string;
  before: string;
  after: string;
  delta: number;
}
interface SectionChange {
  sectionId: number;
  title: string;
  page: number;
  changes: MarginChange[];
}
interface HistoryBatch {
  id: string;
  author: string;
  firstAt: Date;
  lastAt: Date;
  versionStart: string;
  versionEnd: string;
  pages: number[];
  sections: SectionChange[];
  increases: number;
  decreases: number;
  netDelta: number;
  changedCells: number;
}

function parsePercent(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  return match ? Number(match[1].replace(",", ".")) : null;
}
function formatPp(value: number, signed = false): string {
  const rounded = Math.round(value * 100) / 100;
  const prefix = signed && rounded > 0 ? "+" : "";
  return `${prefix}${rounded.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} p.p.`;
}
function formatDate(value: Date): string {
  return value.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
function pageLabel(page: number): string {
  return page >= 11 && page <= 13 ? "Novo Cliente" : "Clientes Antigos";
}

function summarizeRecord(
  record: HistoryRecord,
  page: number
): SectionChange | null {
  if (!record.valorAnterior || !record.valorNovo) return null;
  try {
    const before = JSON.parse(record.valorAnterior) as {
      rows?: Array<{ label?: string; values?: unknown[] }>;
    };
    const after = JSON.parse(record.valorNovo) as {
      type?: string;
      columns?: string[];
      rows?: Array<{ label?: string; values?: unknown[] }>;
    };
    const changes: MarginChange[] = [];
    const rowsBefore = before.rows ?? [];
    const rowsAfter = after.rows ?? [];
    const multi = after.type === "margin_table_multi";
    for (
      let rowIndex = 0;
      rowIndex < Math.min(rowsBefore.length, rowsAfter.length);
      rowIndex++
    ) {
      const previousRow = rowsBefore[rowIndex];
      const nextRow = rowsAfter[rowIndex];
      const valuesBefore = previousRow.values ?? [];
      const valuesAfter = nextRow.values ?? [];
      for (
        let columnIndex = 0;
        columnIndex < Math.min(valuesBefore.length, valuesAfter.length);
        columnIndex++
      ) {
        const previousValue = valuesBefore[columnIndex];
        const nextValue = valuesAfter[columnIndex];
        const previousPercent = parsePercent(previousValue);
        const nextPercent = parsePercent(nextValue);
        if (
          previousPercent === null ||
          nextPercent === null ||
          previousPercent === nextPercent
        )
          continue;
        const column = after.columns?.[columnIndex + (multi ? 1 : 0)];
        changes.push({
          row: nextRow.label ?? previousRow.label ?? `Linha ${rowIndex + 1}`,
          range: column ?? `Faixa ${columnIndex + 1}`,
          before: String(previousValue),
          after: String(nextValue),
          delta: Math.round((nextPercent - previousPercent) * 100) / 100,
        });
      }
    }
    return changes.length
      ? {
          sectionId: record.sectionId,
          title: record.sectionTitle ?? `Seção #${record.sectionId}`,
          page,
          changes,
        }
      : null;
  } catch {
    return null;
  }
}

export function PriceTableHistoryDashboard({
  history,
  sections,
  isLoading = false,
  error,
  initialTable = "todas",
}: Props) {
  const [tableFilter, setTableFilter] = useState<TableFilter>(initialTable);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sectionById = useMemo(
    () => new Map(sections.map(section => [section.id, section])),
    [sections]
  );
  const batches = useMemo(() => {
    const eligiblePages = (page: number) =>
      (page >= 1 && page <= 3) || (page >= 11 && page <= 13);
    const records = (history ?? [])
      .filter(record => record.campoAlterado === "contentJson")
      .map(record => {
        const section = sectionById.get(record.sectionId);
        if (!section || !eligiblePages(section.page)) return null;
        if (tableFilter === "principal" && section.page >= 11) return null;
        if (tableFilter === "novo_cliente" && section.page < 11) return null;
        const detail = summarizeRecord(record, section.page);
        if (!detail) return null;
        return {
          record,
          detail,
          createdAt: new Date(record.createdAt),
          author: record.autor ?? "sistema",
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const result: HistoryBatch[] = [];
    for (const entry of records) {
      let batch = result[result.length - 1];
      const withinBatchWindow =
        batch &&
        batch.author === entry.author &&
        entry.createdAt.getTime() - batch.lastAt.getTime() <= 5 * 60 * 1000;
      if (!withinBatchWindow) {
        batch = {
          id: String(entry.record.id),
          author: entry.author,
          firstAt: entry.createdAt,
          lastAt: entry.createdAt,
          versionStart: entry.record.versao,
          versionEnd: entry.record.versao,
          pages: [],
          sections: [],
          increases: 0,
          decreases: 0,
          netDelta: 0,
          changedCells: 0,
        };
        result.push(batch);
      }
      batch.lastAt = entry.createdAt;
      batch.versionEnd = entry.record.versao;
      batch.pages = [...new Set([...batch.pages, entry.detail.page])].sort(
        (a, b) => a - b
      );
      batch.sections.push(entry.detail);
      for (const change of entry.detail.changes) {
        batch.changedCells++;
        batch.netDelta += change.delta;
        if (change.delta > 0) batch.increases++;
        else if (change.delta < 0) batch.decreases++;
      }
    }
    return result.reverse();
  }, [history, sectionById, tableFilter]);
  const totals = useMemo(
    () =>
      batches.reduce(
        (summary, batch) => ({
          increases: summary.increases + batch.increases,
          decreases: summary.decreases + batch.decreases,
          changedCells: summary.changedCells + batch.changedCells,
        }),
        { increases: 0, decreases: 0, changedCells: 0 }
      ),
    [batches]
  );
  const maxAverageDelta = Math.max(
    1,
    ...batches.map(batch =>
      Math.abs(batch.netDelta / Math.max(1, batch.changedCells))
    )
  );
  const oldestDate = batches.length
    ? batches[batches.length - 1].firstAt
    : null;
  const newestDate = batches.length ? batches[0].lastAt : null;

  if (isLoading)
    return <div className="h-48 animate-pulse rounded-lg bg-slate-100" />;
  if (error)
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        Não foi possível carregar o histórico: {error}
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">
            Evolução reconstruída a partir dos snapshots gravados no histórico
            da Tabela de Preços.
          </p>
          {oldestDate && newestDate && (
            <p className="mt-1 text-xs text-slate-500">
              Período disponível: {oldestDate.toLocaleDateString("pt-BR")} a{" "}
              {newestDate.toLocaleDateString("pt-BR")}. As alterações agrupadas
              ocorreram com o mesmo autor em intervalos de até 5 minutos.
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Tabela
          <select
            value={tableFilter}
            onChange={event => {
              setTableFilter(event.target.value as TableFilter);
              setExpandedId(null);
            }}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="todas">Ambas</option>
            <option value="principal">Clientes Antigos</option>
            <option value="novo_cliente">Novo Cliente</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-3 py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-xs font-medium text-slate-500">
              Lotes com mudança de margem
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-2xl font-bold">
            {batches.length}
          </CardContent>
        </Card>
        <Card className="gap-3 border-emerald-200 py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="flex items-center gap-1 text-xs font-medium text-emerald-700">
              <ArrowUpRight size={14} />
              Faixas aumentadas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-2xl font-bold text-emerald-700">
            {totals.increases}
          </CardContent>
        </Card>
        <Card className="gap-3 border-rose-200 py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="flex items-center gap-1 text-xs font-medium text-rose-700">
              <ArrowDownRight size={14} />
              Faixas reduzidas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-2xl font-bold text-rose-700">
            {totals.decreases}
          </CardContent>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-xs font-medium text-slate-500">
              Faixas com alteração
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-2xl font-bold">
            {totals.changedCells}
          </CardContent>
        </Card>
      </div>
      {!batches.length ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
          {history?.length
            ? "Não há mudanças percentuais registradas para esta tabela no período disponível."
            : "Nenhum histórico encontrado. As próximas alterações serão registradas automaticamente."}
        </div>
      ) : (
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <History size={17} />
              Alterações de margem ao longo do tempo
            </CardTitle>
            <p className="text-xs text-slate-500">
              A barra representa a variação líquida média por faixa alterada.
              Abra um lote para ver os valores anteriores e novos.
            </p>
          </CardHeader>
          <div className="divide-y">
            {batches.map(batch => {
              const average = batch.netDelta / Math.max(1, batch.changedCells);
              const barWidth = Math.max(
                3,
                Math.min(100, (Math.abs(average) / maxAverageDelta) * 100)
              );
              const isExpanded = expandedId === batch.id;
              return (
                <div key={batch.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : batch.id)}
                    aria-expanded={isExpanded}
                    className="grid w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 lg:grid-cols-[190px_minmax(190px,1fr)_210px] lg:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                        <Clock3 size={14} className="text-slate-400" />
                        {formatDate(batch.firstAt)}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">
                        {batch.author}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          {batch.sections.length} seções · {batch.changedCells}{" "}
                          faixas · v{batch.versionStart}–{batch.versionEnd}
                        </span>
                        <span
                          className={
                            average >= 0
                              ? "font-semibold text-emerald-700"
                              : "font-semibold text-rose-700"
                          }
                        >
                          {formatPp(average, true)}
                        </span>
                      </div>
                      <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className="absolute inset-y-0 left-1/2 w-px bg-slate-400" />
                        <div
                          className={`absolute inset-y-0 ${average >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                          style={
                            average >= 0
                              ? { left: "50%", width: `${barWidth / 2}%` }
                              : { right: "50%", width: `${barWidth / 2}%` }
                          }
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                      {batch.pages.map(page => (
                        <Badge
                          key={page}
                          variant="outline"
                          className="text-[10px]"
                        >
                          {pageLabel(page)}
                        </Badge>
                      ))}
                      {batch.increases > 0 && (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          ↑ {batch.increases}
                        </Badge>
                      )}
                      {batch.decreases > 0 && (
                        <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">
                          ↓ {batch.decreases}
                        </Badge>
                      )}
                      {batch.increases === 0 && batch.decreases === 0 && (
                        <Minus size={14} className="text-slate-400" />
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="space-y-3 border-t bg-slate-50 px-4 py-4">
                      <p className="text-xs text-slate-600">
                        {batch.increases} aumento(s), {batch.decreases}{" "}
                        redução(ões); variação líquida total de{" "}
                        {formatPp(batch.netDelta, true)} nas células alteradas.
                      </p>
                      <div className="max-h-[360px] space-y-2 overflow-y-auto">
                        {batch.sections.map(section => {
                          const sectionDelta = section.changes.reduce(
                            (sum, change) => sum + change.delta,
                            0
                          );
                          return (
                            <details
                              key={`${batch.id}-${section.sectionId}`}
                              className="rounded-md border bg-white px-3 py-2"
                            >
                              <summary className="cursor-pointer list-none">
                                <span className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <span className="font-semibold text-slate-700">
                                    {section.title}
                                  </span>
                                  <span className="text-slate-500">
                                    {section.changes.length} faixa(s) ·{" "}
                                    {formatPp(sectionDelta, true)}
                                  </span>
                                </span>
                              </summary>
                              <div className="mt-2 divide-y border-t text-xs">
                                {section.changes.map((change, index) => (
                                  <div
                                    key={`${change.row}-${change.range}-${index}`}
                                    className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 py-1.5"
                                  >
                                    <span
                                      className="truncate text-slate-600"
                                      title={`${change.row} · ${change.range}`}
                                    >
                                      {change.row} · {change.range}
                                    </span>
                                    <span className="text-slate-500">
                                      {change.before}
                                    </span>
                                    <span className="text-slate-400">→</span>
                                    <span
                                      className={
                                        change.delta > 0
                                          ? "font-semibold text-emerald-700"
                                          : "font-semibold text-rose-700"
                                      }
                                    >
                                      {change.after} (
                                      {formatPp(change.delta, true)})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <p className="text-xs text-slate-500">
        O painel compara snapshots de margens percentuais. Alterações em
        títulos, descrições, preços mínimos em reais e células sem percentual
        não entram nos indicadores.
      </p>
    </div>
  );
}
