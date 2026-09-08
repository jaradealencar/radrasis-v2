import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import {
  TrendingUp, DollarSign, PieChart as PieIcon, Receipt, AlertTriangle, Loader2, Radar,
} from "lucide-react";
import KpiCard from "@/components/KpiCard";
import { STATUS_COLORS } from "@/lib/chartColors";
import ChartTooltip from "@/components/ChartTooltip";
import { fmtBrl, fmtBrlCompact, fmtPct, fmtNum } from "@/lib/format";

const RETRY_1 = { retry: 1 } as const;

// Cores fixas por papel (não por índice de série) — mesma leitura em todos os
// gráficos desta aba: azul = vendido/contribuição, laranja = custo variável,
// cinza = custo fixo, verde = resultado líquido.
const COR_VENDIDO = "#3b82f6";
const COR_VARIAVEL = "#f59e0b";
const COR_FIXO = "#64748b";
const COR_RESULTADO = STATUS_COLORS.positivo;
const COR_CONTRIBUICAO = "#3b82f6";

export default function RadarMargens({ anoSel }: { anoSel: number }) {
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = trpc.financeiro.getRadarMargens.useQuery(undefined, RETRY_1);

  const meses = data?.meses ?? [];
  const vendedores = data?.vendedores ?? [];

  const anoAnterior = anoSel - 1;
  const mesesAno = useMemo(() => meses.filter(m => m.ano === anoSel), [meses, anoSel]);
  const mesesAnoAnterior = useMemo(() => meses.filter(m => m.ano === anoAnterior), [meses, anoAnterior]);

  // Compara só os meses que o ano corrente já tem, no mesmo recorte do ano anterior —
  // sem isso, um ano parcial (ex: até setembro) pareceria menor que o ano completo anterior.
  const qtdMesesComparar = mesesAno.length;
  const anoAnteriorComparavel = mesesAnoAnterior.slice(0, qtdMesesComparar);

  const somar = (arr: typeof meses, campo: "valorOs" | "resultado" | "contribuicao") =>
    arr.reduce((acc, m) => acc + m[campo], 0);

  const totalAtual = {
    valorOs: somar(mesesAno, "valorOs"),
    resultado: somar(mesesAno, "resultado"),
    contribuicao: somar(mesesAno, "contribuicao"),
    count: mesesAno.reduce((a, m) => a + m.count, 0),
  };
  const totalAnterior = {
    valorOs: somar(anoAnteriorComparavel, "valorOs"),
    resultado: somar(anoAnteriorComparavel, "resultado"),
    contribuicao: somar(anoAnteriorComparavel, "contribuicao"),
    count: anoAnteriorComparavel.reduce((a, m) => a + m.count, 0),
  };
  const resultadoPctAtual = totalAtual.valorOs ? (totalAtual.resultado / totalAtual.valorOs) * 100 : 0;
  const contribPctAtual = totalAtual.valorOs ? (totalAtual.contribuicao / totalAtual.valorOs) * 100 : 0;
  const resultadoPctAnterior = totalAnterior.valorOs ? (totalAnterior.resultado / totalAnterior.valorOs) * 100 : 0;
  const contribPctAnterior = totalAnterior.valorOs ? (totalAnterior.contribuicao / totalAnterior.valorOs) * 100 : 0;
  const ticketMedioAtual = totalAtual.count ? totalAtual.valorOs / totalAtual.count : 0;

  const variacaoPedidos = totalAnterior.count ? ((totalAtual.count / totalAnterior.count) - 1) * 100 : null;
  const variacaoValor = totalAnterior.valorOs ? ((totalAtual.valorOs / totalAnterior.valorOs) - 1) * 100 : null;

  const melhorMes = mesesAno.length ? mesesAno.reduce((a, b) => (b.resultadoPct > a.resultadoPct ? b : a)) : null;
  const piorMes = mesesAno.length ? mesesAno.reduce((a, b) => (b.resultadoPct < a.resultadoPct ? b : a)) : null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 size={28} className="animate-spin" />
        <p className="text-sm">Carregando histórico de O.S....</p>
      </div>
    );
  }

  if (isError) {
    return (
      <Empty className="py-20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangle />
          </EmptyMedia>
          <EmptyTitle>Não foi possível carregar o Radar de Margens.</EmptyTitle>
          <EmptyDescription>Falha ao consultar o servidor. Tente novamente.</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
      </Empty>
    );
  }

  if (meses.length === 0) {
    return (
      <Empty className="py-20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Radar />
          </EmptyMedia>
          <EmptyTitle>Sem histórico de O.S. sincronizado ainda.</EmptyTitle>
          <EmptyDescription>A tabela historico_os está vazia — verifique a sincronização com o MubiSys.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
        Cada O.S. entra no mês em que foi <b>vendida/aprovada</b> (não em que foi faturada) — o critério oficial
        já usado no cálculo do DRE. Exclui retrabalho, amostra, cortesia e canceladas.
      </div>

      {/* KPIs do ano em foco (anoSel), comparados ao mesmo recorte do ano anterior */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label={`Vendido em ${anoSel}`}
          value={fmtBrlCompact(totalAtual.valorOs)}
          sub={variacaoValor != null ? `${variacaoValor >= 0 ? "+" : ""}${fmtPct(variacaoValor)} vs. ${anoAnterior}` : undefined}
          color={COR_VENDIDO}
          icon={DollarSign}
          variant="border"
        />
        <KpiCard
          label="Margem líquida"
          value={fmtPct(resultadoPctAtual)}
          sub={`${resultadoPctAnterior ? fmtPct(resultadoPctAnterior) : "—"} em ${anoAnterior}`}
          color={COR_RESULTADO}
          icon={TrendingUp}
          variant="border"
        />
        <KpiCard
          label="Margem de contribuição"
          value={fmtPct(contribPctAtual)}
          sub={`${contribPctAnterior ? fmtPct(contribPctAnterior) : "—"} em ${anoAnterior}`}
          color={COR_CONTRIBUICAO}
          icon={PieIcon}
          variant="border"
        />
        <KpiCard
          label="Ticket médio"
          value={fmtBrl(ticketMedioAtual)}
          sub={variacaoPedidos != null ? `${fmtNum(totalAtual.count)} O.S. (${variacaoPedidos >= 0 ? "+" : ""}${fmtPct(variacaoPedidos)})` : `${fmtNum(totalAtual.count)} O.S.`}
          color={COR_VARIAVEL}
          icon={Receipt}
          variant="border"
        />
      </div>

      {/* Evolução — valor vendido decomposto */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: COR_VENDIDO }} />
            Evolução da Margem — Valor Vendido Decomposto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={meses} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.floor(meses.length / 12)} />
              <YAxis tickFormatter={v => fmtBrlCompact(v)} tick={{ fontSize: 10 }} width={60} />
              <Tooltip content={<ChartTooltip format={fmtBrl} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="variavel" name="Custo variável" stackId="a" fill={COR_VARIAVEL} />
              <Bar dataKey="fixo" name="Custo fixo" stackId="a" fill={COR_FIXO} />
              <Bar dataKey="resultado" name="Resultado líquido" stackId="a" fill={COR_RESULTADO} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-1">
            A fronteira entre o 1º e o 2º segmento é a margem de contribuição; o topo do 3º é o resultado líquido.
          </p>
        </CardContent>
      </Card>

      {/* Margem % ao longo do tempo */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: COR_RESULTADO }} />
            Margem de Contribuição × Margem Líquida (%)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={meses} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.floor(meses.length / 12)} />
              <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} width={45} domain={[0, "auto"]} />
              <Tooltip content={<ChartTooltip format={fmtPct} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="contribuicaoPct" name="Margem de contribuição" stroke={COR_CONTRIBUICAO} strokeWidth={2} dot={false} type="monotone" />
              <Line dataKey="resultadoPct" name="Margem líquida" stroke={COR_RESULTADO} strokeWidth={2} dot={false} type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
          {melhorMes && piorMes && (
            <p className="text-xs text-muted-foreground mt-1">
              Em {anoSel}: melhor mês <b className="text-emerald-700">{melhorMes.label}</b> ({fmtPct(melhorMes.resultadoPct)}) ·
              {" "}pior mês <b className="text-red-600">{piorMes.label}</b> ({fmtPct(piorMes.resultadoPct)})
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ranking por vendedor */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: COR_VENDIDO }} />
            Valor Vendido por Vendedor (histórico completo)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-slate-50 border-slate-200">
                <TableHead className="font-semibold text-slate-600 uppercase tracking-wide">Vendedor</TableHead>
                <TableHead className="text-right font-semibold text-slate-600 uppercase tracking-wide">O.S.</TableHead>
                <TableHead className="text-right font-semibold text-slate-600 uppercase tracking-wide">Valor vendido</TableHead>
                <TableHead className="text-right font-semibold text-slate-600 uppercase tracking-wide">Margem líquida</TableHead>
                <TableHead className="text-right font-semibold text-slate-600 uppercase tracking-wide">Margem contrib.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendedores.map(v => (
                <TableRow key={v.vendedor}>
                  <TableCell className="font-semibold text-slate-700">{v.vendedor}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(v.count)}</TableCell>
                  <TableCell className="text-right font-mono text-blue-700">{fmtBrl(v.valorOs)}</TableCell>
                  <TableCell className="text-right font-mono text-emerald-700">{fmtPct(v.resultadoPct)}</TableCell>
                  <TableCell className="text-right font-mono text-blue-600">{fmtPct(v.contribuicaoPct)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
