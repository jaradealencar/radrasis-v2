import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { fmtNum, fmtPct } from "@/lib/format";
import { chartColor } from "@/lib/chartColors";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Faixa = {
  faixa: string;
  ganhos: number;
  perdidos: number;
  emAberto: number;
  decididos: number;
  taxaConversaoPct: number | null;
};

type Mes = { chave: number; mes: string; faixas: Faixa[] };

function agregarPeriodo(meses: Mes[], faixa: string) {
  const inicial = { ganhos: 0, perdidos: 0, emAberto: 0 };
  const totais = meses.reduce((acc, mes) => {
    const dados = mes.faixas.find(item => item.faixa === faixa);
    if (!dados) return acc;
    acc.ganhos += dados.ganhos;
    acc.perdidos += dados.perdidos;
    acc.emAberto += dados.emAberto;
    return acc;
  }, inicial);
  const decididos = totais.ganhos + totais.perdidos;
  return {
    ...totais,
    decididos,
    taxa: decididos > 0 ? (totais.ganhos / decididos) * 100 : null,
  };
}

export default function EvolucaoFaixaTicket({ embedded = false }: { embedded?: boolean }) {
  const [mesesSelecionados, setMesesSelecionados] = useState<6 | 12>(12);
  const [faixaSelecionada, setFaixaSelecionada] = useState("todas");
  const { data, isLoading, isError } = trpc.performanceComercial.getEvolucaoConversaoPorFaixaTicket.useQuery({
    meses: 12,
  }, { refetchOnWindowFocus: false, retry: 1 });

  const faixas = data?.[0]?.faixas.map(item => item.faixa) ?? [];
  const dadosGrafico = useMemo(() => (data ?? []).slice(-mesesSelecionados).map(mes => {
    const stats = Object.fromEntries(mes.faixas.map(item => [item.faixa, item]));
    return {
      label: mes.mes,
      stats,
      ...Object.fromEntries(mes.faixas.map(item => [item.faixa, item.taxaConversaoPct])),
    };
  }), [data, mesesSelecionados]);
  const faixasDoGrafico = faixaSelecionada === "todas" ? faixas : [faixaSelecionada];

  const comparativo = useMemo(() => {
    if (!data) return [];
    const chaveMesAtual = new Date().getFullYear() * 12 + new Date().getMonth();
    const mesesFechados = data.filter(mes => mes.chave < chaveMesAtual);
    const recentes = mesesFechados.slice(-3);
    const anteriores = mesesFechados.slice(-6, -3);
    return faixas.map(faixa => ({
      faixa,
      recentes: agregarPeriodo(recentes, faixa),
      anteriores: agregarPeriodo(anteriores, faixa),
    }));
  }, [data, faixas]);

  return (
    <section className={embedded ? "border-t border-slate-100" : "bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"}>
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Evolução da conversão por faixa de tíquete</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Acompanhe mês a mês se as faixas com menor conversão estão melhorando. Orçamentos são agrupados pelo mês de emissão.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="periodo-evolucao-ticket">Período do gráfico</label>
          <select
            id="periodo-evolucao-ticket"
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
            value={mesesSelecionados}
            onChange={event => setMesesSelecionados(Number(event.target.value) as 6 | 12)}
          >
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
          </select>
          <label className="sr-only" htmlFor="faixa-evolucao-ticket">Faixa do gráfico</label>
          <select
            id="faixa-evolucao-ticket"
            className="h-9 min-w-44 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
            value={faixaSelecionada}
            onChange={event => setFaixaSelecionada(event.target.value)}
          >
            <option value="todas">Todas as faixas</option>
            {faixas.map(faixa => <option key={faixa} value={faixa}>{faixa}</option>)}
          </select>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="h-64 rounded-lg bg-slate-50 animate-pulse" />
        ) : isError || !data ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Não foi possível carregar a evolução das faixas agora. Tente atualizar o painel.
          </div>
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosGrafico} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis domain={[0, 100]} tickFormatter={valor => `${valor}%`} tick={{ fontSize: 10, fill: "#64748b" }} width={42} />
                  <Tooltip
                    formatter={(valor: unknown, nome: unknown, item: any) => {
                      const faixa = String(nome ?? "");
                      const stats = item.payload?.stats?.[faixa] as Faixa | undefined;
                      if (typeof valor !== "number") return ["Sem decisões", faixa];
                      return [
                        `${fmtPct(valor)} (${fmtNum(stats?.ganhos ?? 0)} ganhos / ${fmtNum(stats?.perdidos ?? 0)} perdidos; ${fmtNum(stats?.emAberto ?? 0)} em aberto)`,
                        faixa,
                      ];
                    }}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {faixasDoGrafico.map(faixa => (
                    <Line
                      key={faixa}
                      type="monotone"
                      dataKey={faixa}
                      name={faixa}
                      stroke={chartColor(faixas.indexOf(faixa))}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-2">Últimos 3 meses fechados × 3 meses anteriores</h4>
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Faixa</TableHead>
                      <TableHead className="text-right">Conversão recente</TableHead>
                      <TableHead className="text-right">Conversão anterior</TableHead>
                      <TableHead className="text-right">Variação</TableHead>
                      <TableHead className="text-right">Decididos</TableHead>
                      <TableHead className="text-right">Em aberto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparativo.map(item => {
                      const delta = item.recentes.taxa == null || item.anteriores.taxa == null
                        ? null
                        : item.recentes.taxa - item.anteriores.taxa;
                      return (
                        <TableRow key={item.faixa}>
                          <TableCell className="font-medium">{item.faixa}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {item.recentes.taxa == null ? "—" : fmtPct(item.recentes.taxa)}
                          </TableCell>
                          <TableCell className="text-right text-slate-500">
                            {item.anteriores.taxa == null ? "—" : fmtPct(item.anteriores.taxa)}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${delta == null ? "text-slate-400" : delta > 0 ? "text-green-700" : delta < 0 ? "text-red-600" : "text-slate-500"}`}>
                            {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1).replace(".", ",")} p.p.`}
                          </TableCell>
                          <TableCell className="text-right">{fmtNum(item.recentes.decididos)}</TableCell>
                          <TableCell className="text-right text-slate-500">{fmtNum(item.recentes.emAberto)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <p className="text-[10px] text-slate-400">
              Conversão = ganhos ÷ (ganhos + perdidos). Orçamentos em aberto dentro da validade ficam fora da taxa e são exibidos à parte; o mês atual é parcial. A comparação usa o volume ponderado de decisões de cada período.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
