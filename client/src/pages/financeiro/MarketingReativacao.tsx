import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { DollarSign, Users, RefreshCw, TrendingUp, Percent, ShoppingBag, AlertTriangle } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ChartTooltip from "@/components/ChartTooltip";
import { trpc } from "@/lib/trpc";
import { fmtBrl, fmtPct, fmtNum, MESES_ABREV } from "@/lib/format";
import type { RouterOutputs } from "@/lib/trpc";
import { custoReativacaoPonderado, calcularResultadoGrupo, somarOuNull } from "@shared/marketing-financeiro";

type RelatorioAno = RouterOutputs["marketingFinanceiro"]["getRelatorioAno"];

const COR_REATIVACAO = "#ea580c";
const COR_FATURAMENTO = "#16a34a";

interface Props {
  ano: number;
  relatorio: RelatorioAno;
  mesFiltro: number | null;
  onDrillDown: (args: { mes: number | null; categoria: "reativado"; titulo: string }) => void;
}

export default function MarketingReativacao({ ano, relatorio, mesFiltro, onDrillDown }: Props) {
  const mesesFiltrados = useMemo(
    () => (mesFiltro != null ? relatorio.meses.filter(m => m.mes === mesFiltro) : relatorio.meses).filter(m => !m.mesParcial),
    [relatorio.meses, mesFiltro],
  );
  const labelPeriodo = mesFiltro != null ? MESES_ABREV[mesFiltro - 1] : `Ano ${ano}`;

  const { data: medianaOutliers } = trpc.marketingFinanceiro.getMedianaOutliers.useQuery({ ano, mes: mesFiltro, categoria: "reativado" });

  const totais = useMemo(() => {
    const investimento = somarOuNull(mesesFiltrados.map(m => m.investimentoReativacao));
    const eventosReativacao = mesesFiltrados.reduce((s, m) => s + m.reativado.qtdClientesUnicos, 0);
    const pedidos = mesesFiltrados.reduce((s, m) => s + m.reativado.qtdOs, 0);
    const faturamento = mesesFiltrados.reduce((s, m) => s + m.reativado.faturamento, 0);
    const margem = mesesFiltrados.reduce((s, m) => s + m.reativado.margem.margemTotal, 0);
    const custoPonderado = custoReativacaoPonderado(investimento, eventosReativacao);
    const resultado = calcularResultadoGrupo(investimento, margem, faturamento);
    const ticketMedio = pedidos > 0 ? faturamento / pedidos : null;
    return { investimento, eventosReativacao, pedidos, faturamento, margem, custoPonderado, resultado, ticketMedio };
  }, [mesesFiltrados]);

  const clientesUnicosNoPeriodo = mesFiltro != null ? totais.eventosReativacao : relatorio.reativacaoAnual.clientesReativadosUnicosAno;

  const dadosGrafico = useMemo(() => mesesFiltrados.map(m => ({
    mes: MESES_ABREV[m.mes - 1],
    "Custo por Reativado": m.reativado.custoReativacaoPonderado ?? 0,
    "Ticket Médio": m.reativado.qtdOs > 0 ? Math.round((m.reativado.faturamento / m.reativado.qtdOs) * 100) / 100 : 0,
  })), [mesesFiltrados]);

  const participacao = useMemo(() => {
    const investTotal = somarOuNull(relatorio.meses.filter(m => !m.mesParcial).map(m => (m.investimentoAquisicao ?? 0) + (m.investimentoReativacao ?? 0))) ?? 0;
    const fatTotal = relatorio.meses.filter(m => !m.mesParcial).reduce((s, m) => s + m.novo.faturamento + m.recorrenteAtivo.faturamento + m.reativado.faturamento, 0);
    const pctInvest = investTotal > 0 ? ((totais.investimento ?? 0) / investTotal) * 100 : 0;
    const pctFat = fatTotal > 0 ? (totais.faturamento / fatTotal) * 100 : 0;
    return [
      { name: "% do Investimento Total", value: pctInvest },
      { name: "% do Faturamento Total", value: pctFat },
    ];
  }, [relatorio.meses, totais]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard variant="border" color={COR_REATIVACAO} icon={<DollarSign size={18} />} label="Investimento" value={totais.investimento != null ? fmtBrl(totais.investimento) : "Pendente"} />
        <KpiCard
          variant="border" color="#b45309" icon={<Users size={18} />} label="Reativados"
          value={fmtNum(clientesUnicosNoPeriodo)}
          sub={`${fmtNum(totais.eventosReativacao)} eventos · ${fmtNum(totais.pedidos)} pedidos`}
          tooltip={mesFiltro != null ? "Únicos = eventos dentro de 1 mês (não há diferença dentro de um único mês)." : "Únicos: clientes distintos reativados no ano inteiro. Eventos: cada reativação conta separadamente — o mesmo cliente pode reativar mais de uma vez."}
        />
        <KpiCard variant="border" color={COR_REATIVACAO} icon={<RefreshCw size={18} />} label="Custo por Reativado" value={totais.custoPonderado != null ? fmtBrl(totais.custoPonderado) : "—"} tooltip="Investimento em reativação ÷ eventos de reativação do período (denominador = eventos, não únicos)." />
        <KpiCard variant="border" color={COR_FATURAMENTO} icon={<TrendingUp size={18} />} label="Faturamento" value={fmtBrl(totais.faturamento)} sub={totais.ticketMedio != null ? `Ticket médio: ${fmtBrl(totais.ticketMedio)}` : undefined} />
        <KpiCard
          variant="border" color={totais.resultado.resultado != null && totais.resultado.resultado >= 0 ? COR_FATURAMENTO : "#dc2626"} icon={<Percent size={18} />}
          label="Resultado após Marketing" value={totais.resultado.resultado != null ? fmtBrl(totais.resultado.resultado) : "—"}
          sub={totais.resultado.roiPct != null ? `ROI: ${fmtPct(totais.resultado.roiPct)} · ROAS: ${totais.resultado.roas != null ? totais.resultado.roas.toFixed(2) + "x" : "—"}` : undefined}
        />
      </div>

      {medianaOutliers && medianaOutliers.qtdPedidos > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShoppingBag size={15} className="text-slate-500" /> Ticket e Concentração — {labelPeriodo}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><div className="text-xs text-muted-foreground">Ticket médio</div><div className="font-semibold">{fmtBrl(medianaOutliers.ticketMedio)}</div></div>
            <div><div className="text-xs text-muted-foreground">Ticket mediano</div><div className="font-semibold">{fmtBrl(medianaOutliers.ticketMediano)}</div></div>
            <div><div className="text-xs text-muted-foreground">Maior pedido</div><div className="font-semibold">{fmtBrl(medianaOutliers.maiorPedido)}</div></div>
            <div>
              <div className="text-xs text-muted-foreground">Participação dos 5 maiores</div>
              <div className="font-semibold flex items-center gap-1">
                {fmtPct(medianaOutliers.participacaoTop5)}
                {medianaOutliers.participacaoTop5 != null && medianaOutliers.participacaoTop5 > 40 && <AlertTriangle size={13} className="text-amber-500" />}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><RefreshCw size={16} className="text-orange-600" /> Custo por Reativado e Ticket Médio por Mês</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dadosGrafico} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtBrl(v).replace(",00", "")} />
                <Tooltip content={<ChartTooltip format={fmtBrl} />} />
                <Legend iconSize={10} />
                <Bar dataKey="Custo por Reativado" fill={COR_REATIVACAO} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Ticket Médio" fill={COR_FATURAMENTO} opacity={0.75} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Percent size={16} className="text-orange-600" /> Participação: Investimento vs. Faturamento</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={participacao} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${fmtPct(e.value)}`}>
                  <Cell fill={COR_REATIVACAO} />
                  <Cell fill={COR_FATURAMENTO} />
                </Pie>
                <Tooltip formatter={(v: number) => fmtPct(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <button onClick={() => onDrillDown({ mes: mesFiltro, categoria: "reativado", titulo: `Clientes Reativados — ${labelPeriodo}` })} className="text-xs text-purple-700 hover:underline">
          Ver detalhamento dos pedidos de clientes reativados →
        </button>
      </div>
    </div>
  );
}
