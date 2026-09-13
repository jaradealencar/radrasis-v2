import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { DollarSign, Users, Target, TrendingUp, Percent, ShoppingBag, AlertTriangle } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ChartTooltip from "@/components/ChartTooltip";
import { trpc } from "@/lib/trpc";
import { fmtBrl, fmtPct, fmtNum, MESES_ABREV } from "@/lib/format";
import type { RouterOutputs } from "@/lib/trpc";
import { cacPonderado, calcularResultadoGrupo, somarOuNull } from "@shared/marketing-financeiro";

type RelatorioAno = RouterOutputs["marketingFinanceiro"]["getRelatorioAno"];

const COR_AQUISICAO = "#7c3aed";
const COR_FATURAMENTO = "#16a34a";

interface Props {
  ano: number;
  relatorio: RelatorioAno;
  mesFiltro: number | null;
  onDrillDown: (args: { mes: number | null; categoria: "novo"; titulo: string }) => void;
}

export default function MarketingAquisicao({ ano, relatorio, mesFiltro, onDrillDown }: Props) {
  const mesesFiltrados = useMemo(
    () => (mesFiltro != null ? relatorio.meses.filter(m => m.mes === mesFiltro) : relatorio.meses).filter(m => !m.mesParcial),
    [relatorio.meses, mesFiltro],
  );
  const labelPeriodo = mesFiltro != null ? MESES_ABREV[mesFiltro - 1] : `Ano ${ano}`;

  const { data: medianaOutliers } = trpc.marketingFinanceiro.getMedianaOutliers.useQuery({ ano, mes: mesFiltro, categoria: "novo" });

  const totais = useMemo(() => {
    const investimento = somarOuNull(mesesFiltrados.map(m => m.investimentoAquisicao));
    const clientesNovos = mesesFiltrados.reduce((s, m) => s + m.novo.qtdClientesUnicos, 0);
    const pedidos = mesesFiltrados.reduce((s, m) => s + m.novo.qtdOs, 0);
    const faturamento = mesesFiltrados.reduce((s, m) => s + m.novo.faturamento, 0);
    const margem = mesesFiltrados.reduce((s, m) => s + m.novo.margem.margemTotal, 0);
    const cac = cacPonderado(investimento, clientesNovos);
    const resultado = calcularResultadoGrupo(investimento, margem, faturamento);
    const ticketMedio = pedidos > 0 ? faturamento / pedidos : null;
    return { investimento, clientesNovos, pedidos, faturamento, margem, cac, resultado, ticketMedio };
  }, [mesesFiltrados]);

  const dadosTicket = useMemo(() => mesesFiltrados.map(m => ({
    mes: MESES_ABREV[m.mes - 1],
    "CAC": m.novo.cacPonderado ?? 0,
    "Ticket Médio": m.novo.qtdOs > 0 ? Math.round((m.novo.faturamento / m.novo.qtdOs) * 100) / 100 : 0,
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
        <KpiCard variant="border" color={COR_AQUISICAO} icon={<DollarSign size={18} />} label="Investimento" value={totais.investimento != null ? fmtBrl(totais.investimento) : "Pendente"} />
        <KpiCard variant="border" color="#2563eb" icon={<Users size={18} />} label="Clientes Novos" value={fmtNum(totais.clientesNovos)} sub={`${fmtNum(totais.pedidos)} pedidos`} />
        <KpiCard variant="border" color="#ea580c" icon={<Target size={18} />} label="CAC Ponderado" value={totais.cac != null ? fmtBrl(totais.cac) : "—"} tooltip="Investimento em aquisição ÷ clientes novos do período." />
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
          {medianaOutliers.participacaoTop5 != null && medianaOutliers.participacaoTop5 > 40 && (
            <CardContent className="pt-0">
              <p className="text-xs text-amber-700">O resultado deste período pode estar sendo influenciado por poucos pedidos de alto valor — os 5 maiores pedidos concentram {fmtPct(medianaOutliers.participacaoTop5)} do faturamento de clientes novos.</p>
            </CardContent>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target size={16} className="text-orange-600" /> CAC e Ticket Médio por Mês</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dadosTicket} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtBrl(v).replace(",00", "")} />
                <Tooltip content={<ChartTooltip format={fmtBrl} />} />
                <Legend iconSize={10} />
                <Bar dataKey="CAC" fill={COR_AQUISICAO} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Ticket Médio" fill={COR_FATURAMENTO} opacity={0.75} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Percent size={16} className="text-purple-600" /> Participação: Investimento vs. Faturamento</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={participacao} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${fmtPct(e.value)}`}>
                  <Cell fill={COR_AQUISICAO} />
                  <Cell fill={COR_FATURAMENTO} />
                </Pie>
                <Tooltip formatter={(v: number) => fmtPct(v)} />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground text-center mt-1">Se a fatia de faturamento for bem maior que a de investimento, a aquisição está gerando retorno desproporcional ao gasto.</p>
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <button onClick={() => onDrillDown({ mes: mesFiltro, categoria: "novo", titulo: `Clientes Novos — ${labelPeriodo}` })} className="text-xs text-purple-700 hover:underline">
          Ver detalhamento dos pedidos de clientes novos →
        </button>
      </div>
    </div>
  );
}
