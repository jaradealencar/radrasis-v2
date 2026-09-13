import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import {
  TrendingUp, DollarSign, Users, Target, Percent, RefreshCw,
  Lightbulb, CheckCircle2, AlertTriangle, AlertCircle, ShieldAlert,
} from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ChartTooltip from "@/components/ChartTooltip";
import { fmtBrl, fmtBrlCompact, fmtPct, fmtNum, MESES_ABREV } from "@/lib/format";
import type { RouterOutputs } from "@/lib/trpc";
import {
  cacPonderado, custoReativacaoPonderado, calcularResultadoGrupo, calcularResultadoConsolidado,
  somarOuNull, avaliarSemaforoTeto, type NivelSemaforo,
} from "@shared/marketing-financeiro";

type RelatorioAno = RouterOutputs["marketingFinanceiro"]["getRelatorioAno"];
type ConfigResolvida = RouterOutputs["marketingFinanceiro"]["getConfig"];

// Paleta pedida: roxo/azul = aquisição, laranja = reativação, cinza = recorrente
// (categoria neutra, sem investimento próprio), verde = positivo, vermelho = alerta.
const COR_AQUISICAO = "#7c3aed";
const COR_REATIVACAO = "#ea580c";
const COR_RECORRENTE = "#64748b";
const COR_POSITIVO = "#16a34a";
const COR_ALERTA = "#dc2626";

const SEMAFORO_COR: Record<NivelSemaforo, string> = {
  verde: "text-emerald-600 bg-emerald-50 border-emerald-200",
  amarelo: "text-amber-600 bg-amber-50 border-amber-200",
  vermelho: "text-red-600 bg-red-50 border-red-200",
  "sem-meta": "text-slate-400 bg-slate-50 border-slate-200",
};

function SeloSemaforo({ nivel }: { nivel: NivelSemaforo }) {
  if (nivel === "sem-meta") return null;
  const label = nivel === "verde" ? "Dentro da meta" : nivel === "amarelo" ? "Atenção" : "Fora da meta";
  return <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${SEMAFORO_COR[nivel]}`}>{label}</span>;
}

interface Props {
  ano: number;
  relatorio: RelatorioAno;
  config: ConfigResolvida;
  mesFiltro: number | null;
  onDrillDown: (args: { mes: number | null; categoria: "novo" | "recorrenteAtivo" | "reativado" | null; titulo: string }) => void;
}

export default function MarketingVisaoGeral({ ano, relatorio, config, mesFiltro, onDrillDown }: Props) {
  const mesesFiltrados = useMemo(
    () => mesFiltro != null ? relatorio.meses.filter(m => m.mes === mesFiltro) : relatorio.meses,
    [relatorio.meses, mesFiltro],
  );
  const labelPeriodo = mesFiltro != null ? MESES_ABREV[mesFiltro - 1] : `Ano ${ano}`;

  // Meses parciais (mês corrente em andamento) ficam fora dos indicadores
  // consolidados por padrão — ver seção 4 do pedido do usuário.
  const mesesCompletos = useMemo(() => mesesFiltrados.filter(m => !m.mesParcial), [mesesFiltrados]);
  const temMesParcialExcluido = mesesFiltrados.length > mesesCompletos.length;

  const totais = useMemo(() => {
    const investAquis = somarOuNull(mesesCompletos.map(m => m.investimentoAquisicao));
    const investReativ = somarOuNull(mesesCompletos.map(m => m.investimentoReativacao));
    const clientesNovos = mesesCompletos.reduce((s, m) => s + m.novo.qtdClientesUnicos, 0);
    const eventosReativados = mesesCompletos.reduce((s, m) => s + m.reativado.qtdClientesUnicos, 0);
    const clientesRecorrentes = mesesCompletos.reduce((s, m) => s + m.recorrenteAtivo.qtdClientesUnicos, 0);
    const fatNovos = mesesCompletos.reduce((s, m) => s + m.novo.faturamento, 0);
    const fatReativados = mesesCompletos.reduce((s, m) => s + m.reativado.faturamento, 0);
    const fatRecorrente = mesesCompletos.reduce((s, m) => s + m.recorrenteAtivo.faturamento, 0);
    const margemNovos = mesesCompletos.reduce((s, m) => s + m.novo.margem.margemTotal, 0);
    const margemReativados = mesesCompletos.reduce((s, m) => s + m.reativado.margem.margemTotal, 0);
    const margemRecorrente = mesesCompletos.reduce((s, m) => s + m.recorrenteAtivo.margem.margemTotal, 0);
    const pedidosTotal = mesesCompletos.reduce((s, m) => s + m.novo.qtdOs + m.recorrenteAtivo.qtdOs + m.reativado.qtdOs, 0);
    const clientesTotal = clientesNovos + clientesRecorrentes + eventosReativados;

    const cac = cacPonderado(investAquis, clientesNovos);
    const custoReativ = custoReativacaoPonderado(investReativ, eventosReativados);
    const resultadoNovo = calcularResultadoGrupo(investAquis, margemNovos, fatNovos);
    const resultadoReativado = calcularResultadoGrupo(investReativ, margemReativados, fatReativados);
    const consolidado = calcularResultadoConsolidado([
      { investimento: investAquis, margemContribuicao: margemNovos },
      { investimento: investReativ, margemContribuicao: margemReativados },
    ]);
    const fatTotal = fatNovos + fatReativados + fatRecorrente;
    const pctFaturamentoNovos = fatTotal > 0 ? (fatNovos / fatTotal) * 100 : null;
    const pctFaturamentoReativados = fatTotal > 0 ? (fatReativados / fatTotal) * 100 : null;
    const pedidosPorCliente = clientesTotal > 0 ? pedidosTotal / clientesTotal : null;

    return {
      investAquis, investReativ, clientesNovos, eventosReativados, clientesRecorrentes,
      fatNovos, fatReativados, fatRecorrente, margemNovos, margemReativados, margemRecorrente,
      cac, custoReativ, resultadoNovo, resultadoReativado, consolidado,
      pctFaturamentoNovos, pctFaturamentoReativados, pedidosPorCliente,
    };
  }, [mesesCompletos]);

  const dadosGrafico = useMemo(() => mesesCompletos.map(m => ({
    mes: MESES_ABREV[m.mes - 1],
    "Aquisição": m.investimentoAquisicao ?? 0,
    "Reativação": m.investimentoReativacao ?? 0,
    "Margem Novos": m.novo.margem.margemTotal,
    "Margem Reativados": m.reativado.margem.margemTotal,
  })), [mesesCompletos]);

  const dadosRoi = useMemo(() => mesesCompletos
    .filter(m => m.consolidado.roiPct != null)
    .map(m => ({
      mes: MESES_ABREV[m.mes - 1],
      "ROI Aquisição (%)": m.novo.roiPct != null ? Math.round(m.novo.roiPct) : null,
      "ROI Reativação (%)": m.reativado.roiPct != null ? Math.round(m.reativado.roiPct) : null,
      "ROI Consolidado (%)": Math.round(m.consolidado.roiPct!),
    })), [mesesCompletos]);

  const dadosEvolucao = useMemo(() => mesesCompletos.map(m => ({
    mes: MESES_ABREV[m.mes - 1],
    "Novos": m.novo.qtdClientesUnicos,
    "Recorrentes Ativos": m.recorrenteAtivo.qtdClientesUnicos,
    "Reativados": m.reativado.qtdClientesUnicos,
  })), [mesesCompletos]);

  // ─── Leituras do período — sempre com linguagem prudente, nunca causal ────
  const insights = useMemo(() => {
    type Insight = { tipo: "positivo" | "atencao" | "alerta" | "dica"; texto: string };
    const lista: Insight[] = [];

    const mesesFaltando = relatorio.meses.filter(m => !m.mesParcial && m.investimentoAquisicao == null && m.investimentoReativacao == null);
    if (mesesFaltando.length > 0) {
      lista.push({ tipo: "dica", texto: `Investimento pendente em ${mesesFaltando.map(m => MESES_ABREV[m.mes - 1]).join(", ")} — esses meses não entram nos indicadores de CAC/ROI enquanto não forem preenchidos.` });
    }
    if (temMesParcialExcluido) {
      const parcial = mesesFiltrados.find(m => m.mesParcial);
      if (parcial) lista.push({ tipo: "dica", texto: `${MESES_ABREV[parcial.mes - 1]} está em andamento (mês parcial) e foi excluído dos indicadores consolidados acima, por padrão.` });
    }

    if (totais.cac != null && config.cacMaximo != null) {
      const nivel = avaliarSemaforoTeto(totais.cac, config.cacMaximo);
      if (nivel === "vermelho") lista.push({ tipo: "alerta", texto: `O CAC ponderado do período (${fmtBrl(totais.cac)}) está associado a um valor acima da meta configurada (${fmtBrl(config.cacMaximo)}) — é necessário verificar os canais/campanhas de aquisição em uso.` });
    }

    // CAC vs custo de reativação
    if (totais.cac != null && totais.custoReativ != null && totais.custoReativ > 0) {
      const diffPct = ((totais.cac - totais.custoReativ) / totais.custoReativ) * 100;
      if (diffPct > 20) lista.push({ tipo: "dica", texto: `Reativar um cliente dormente está custando em média ${fmtBrl(totais.custoReativ)}, contra ${fmtBrl(totais.cac)} para adquirir um cliente novo — pode valer avaliar deslocar parte do orçamento de Aquisição para Reativação.` });
      else if (diffPct < -20) lista.push({ tipo: "dica", texto: `Adquirir um cliente novo (${fmtBrl(totais.cac)}) está saindo mais barato que reativar um dormente (${fmtBrl(totais.custoReativ)}) — pode valer investigar a eficiência da campanha de reativação.` });
    }

    if (totais.pctFaturamentoReativados != null && totais.pctFaturamentoReativados > 30) {
      lista.push({ tipo: "dica", texto: `${fmtPct(totais.pctFaturamentoReativados)} do faturamento do período está associado a clientes reativados — favorável ao custo médio, mas a base de clientes dormentes não é infinita.` });
    }

    if (totais.consolidado.roiPct != null) {
      lista.push({
        tipo: totais.consolidado.roiPct >= 100 ? "positivo" : totais.consolidado.roiPct >= 0 ? "atencao" : "alerta",
        texto: totais.consolidado.roiPct >= 100
          ? `O resultado consolidado do período está associado a um retorno de ${fmtPct(totais.consolidado.roiPct)} sobre o investimento em marketing — o investimento parece estar se pagando com folga.`
          : totais.consolidado.roiPct >= 0
          ? `O ROI consolidado do período é positivo (${fmtPct(totais.consolidado.roiPct)}), mas apertado — pequenas variações de conversão podem levar o período a resultado negativo.`
          : `O ROI consolidado do período está negativo (${fmtPct(totais.consolidado.roiPct)}) — o investimento em marketing não está sendo coberto pela margem gerada até aqui.`,
      });
    }

    const origemMista = mesesCompletos.some(m => m.novo.margem.origem === "mista" || m.novo.margem.origem === "estimada" || m.reativado.margem.origem === "mista" || m.reativado.margem.origem === "estimada");
    if (origemMista) lista.push({ tipo: "dica", texto: "Parte do resultado deste período usa margem estimada (percentual de fallback), não a margem real por pedido — ver selo em cada card." });

    return lista;
  }, [relatorio.meses, mesesFiltrados, mesesCompletos, totais, config, temMesParcialExcluido]);

  const origemMargemNovos = mesesCompletos.length === 0 ? "sem-dado"
    : mesesCompletos.every(m => m.novo.margem.origem === "real") ? "real"
    : mesesCompletos.every(m => m.novo.margem.origem === "estimada" || m.novo.margem.origem === "sem-dado") ? "estimada"
    : "mista";

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <div className="w-3 h-0.5 bg-purple-500 rounded" />
          Indicadores — {labelPeriodo}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <KpiCard
            variant="border" color={COR_AQUISICAO} icon={<DollarSign size={18} />}
            label="Investimento em Aquisição" value={totais.investAquis != null ? fmtBrl(totais.investAquis) : "Pendente"}
            sub={totais.investAquis == null ? "Nenhum mês do período preenchido" : undefined}
            tooltip="Soma de custo_marketing.investimentoAquisicao dos meses completos do período (meses parciais e não preenchidos ficam fora, por padrão)."
          />
          <KpiCard
            variant="border" color={COR_REATIVACAO} icon={<RefreshCw size={18} />}
            label="Investimento em Reativação" value={totais.investReativ != null ? fmtBrl(totais.investReativ) : "Pendente"}
            tooltip="Soma de custo_marketing.investimentoReativacao dos meses completos do período."
          />
          <KpiCard
            variant="border" color="#2563eb" icon={<Users size={18} />}
            label="Clientes Novos" value={fmtNum(totais.clientesNovos)}
            sub={`${fmtNum(totais.clientesRecorrentes)} recorrentes ativos · ${fmtNum(totais.eventosReativados)} eventos de reativação`}
            tooltip="Clientes cuja compra no período é a primeira de todo o histórico do ERP. Categoria mutuamente exclusiva de Recorrente Ativo e Reativado."
          />
          <KpiCard
            variant="border" color={COR_RECORRENTE} icon={<Users size={18} />}
            label="Clientes Reativados (únicos no ano)" value={fmtNum(relatorio.reativacaoAnual.clientesReativadosUnicosAno)}
            sub={`${fmtNum(relatorio.reativacaoAnual.eventosReativacaoAno)} eventos de reativação no ano`}
            tooltip="Clientes distintos que reativaram ao menos 1x no ano inteiro (não afetado pelo filtro de mês). 'Eventos' conta cada reativação separadamente — o mesmo cliente pode reativar mais de uma vez."
          />
          <KpiCard
            variant="border" color="#ea580c" icon={<Target size={18} />}
            label="CAC de Aquisição (ponderado)" value={totais.cac != null ? fmtBrl(totais.cac) : "—"}
            sub={<>Invest. aquisição ÷ clientes novos {config.cacMaximo != null && <div className="mt-1"><SeloSemaforo nivel={avaliarSemaforoTeto(totais.cac, config.cacMaximo)} /></div>}</>}
            tooltip="Ponderado: soma do investimento ÷ soma de clientes novos do período — nunca a média dos CAC mensais (que distorceria a favor de meses com pouco volume)."
          />
          <KpiCard
            variant="border" color="#b45309" icon={<RefreshCw size={18} />}
            label="Custo por Reativado (ponderado)" value={totais.custoReativ != null ? fmtBrl(totais.custoReativ) : "—"}
            sub={config.custoReativacaoMaximo != null ? <SeloSemaforo nivel={avaliarSemaforoTeto(totais.custoReativ, config.custoReativacaoMaximo)} /> : undefined}
            tooltip="Investimento em reativação ÷ eventos de reativação do período (não clientes únicos — o investimento se destina a tentativas, que podem reativar o mesmo cliente mais de uma vez)."
          />
          <KpiCard
            variant="border" color={COR_POSITIVO} icon={<TrendingUp size={18} />}
            label="Margem de Contribuição (Novos+Reativados)" value={fmtBrlCompact(totais.margemNovos + totais.margemReativados)}
            sub={origemMargemNovos === "real" ? "Margem real por pedido" : origemMargemNovos === "mista" ? "Margem real + estimada (mista)" : `Margem estimada — ${config.percentualMargemFallback}%`}
            tooltip="Soma de historico_os.contribuicaoReais dos pedidos de clientes novos/reativados; usa o percentual de fallback configurável só nos pedidos sem custo real detalhado."
          />
          <KpiCard
            variant="border" color={totais.consolidado.resultado != null && totais.consolidado.resultado >= 0 ? COR_POSITIVO : COR_ALERTA} icon={totais.consolidado.resultado != null && totais.consolidado.resultado >= 0 ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
            label="Resultado após Marketing" value={totais.consolidado.resultado != null ? fmtBrl(totais.consolidado.resultado) : "—"}
            sub={totais.consolidado.roiPct != null ? `ROI consolidado: ${fmtPct(totais.consolidado.roiPct)}` : undefined}
            tooltip="Margem de contribuição (novos + reativados) menos o investimento total em marketing do período."
          />
          <KpiCard
            variant="border" color="#2563eb" icon={<Percent size={18} />}
            label="% do Faturamento vindo de Novos" value={totais.pctFaturamentoNovos != null ? fmtPct(totais.pctFaturamentoNovos) : "—"}
            tooltip="Faturamento de clientes novos ÷ faturamento total (novos + recorrentes ativos + reativados) do período."
          />
          <KpiCard
            variant="border" color="#0891b2" icon={<Percent size={18} />}
            label="% do Faturamento vindo de Reativados" value={totais.pctFaturamentoReativados != null ? fmtPct(totais.pctFaturamentoReativados) : "—"}
            tooltip="Faturamento de clientes reativados ÷ faturamento total (novos + recorrentes ativos + reativados) do período."
          />
          <KpiCard
            variant="border" color="#475569" icon={<Users size={18} />}
            label="Pedidos por Cliente" value={totais.pedidosPorCliente != null ? totais.pedidosPorCliente.toFixed(2) : "—"}
            tooltip="Total de pedidos (novos + recorrentes + reativados) ÷ total de clientes ativos no período (soma das 3 categorias, sem deduplicar entre meses)."
          />
        </div>
      </div>

      {temMesParcialExcluido && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          O mês corrente está em andamento (parcial) e foi excluído dos indicadores acima, por padrão — os números dele mudam até o mês fechar.
        </div>
      )}

      <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-800">
        <Percent size={13} className="mt-0.5 shrink-0" />
        <span>
          <strong>Metodologia:</strong> Novo, Recorrente Ativo e Reativado são categorias mutuamente exclusivas — nunca somadas uma dentro da outra.
          A margem de contribuição usa o custo real por pedido (<code>historico_os.contribuicaoReais</code>) sempre que disponível; só cai para a estimativa de {config.percentualMargemFallback}% nos pedidos sem custo detalhado.
          CAC/Custo de Reativação são <strong>ponderados</strong> (soma dos totais do período, não média dos meses).
        </span>
      </div>

      {dadosGrafico.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp size={16} className="text-purple-600" /> Investimento vs. Margem de Contribuição</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dadosGrafico} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtBrlCompact(v)} />
                  <Tooltip content={<ChartTooltip format={fmtBrl} />} />
                  <Legend iconSize={10} />
                  <Bar dataKey="Aquisição" stackId="inv" fill={COR_AQUISICAO} />
                  <Bar dataKey="Reativação" stackId="inv" fill={COR_REATIVACAO} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Margem Novos" fill={COR_POSITIVO} opacity={0.75} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Margem Reativados" fill="#0d9488" opacity={0.75} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {dadosRoi.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Percent size={16} className="text-emerald-600" /> ROI de Aquisição, Reativação e Consolidado</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={dadosRoi} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<ChartTooltip format={v => `${v}%`} />} />
                    <Legend iconSize={10} />
                    <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={1.5} />
                    <Line dataKey="ROI Aquisição (%)" stroke={COR_AQUISICAO} strokeWidth={2} dot={{ r: 3 }} type="monotone" connectNulls />
                    <Line dataKey="ROI Reativação (%)" stroke={COR_REATIVACAO} strokeWidth={2} dot={{ r: 3 }} type="monotone" connectNulls />
                    <Line dataKey="ROI Consolidado (%)" stroke={COR_POSITIVO} strokeWidth={2.5} dot={{ r: 4 }} type="monotone" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Users size={16} className="text-blue-600" /> Evolução de Clientes Novos, Recorrentes Ativos e Reativados</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dadosEvolucao} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconSize={10} />
                  <Line dataKey="Novos" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                  <Line dataKey="Recorrentes Ativos" stroke={COR_RECORRENTE} strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                  <Line dataKey="Reativados" stroke={COR_REATIVACAO} strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Lightbulb size={18} className="text-amber-500" /> Leituras do Período</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Leitura automática dos números — associações, não causalidade confirmada.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.map((ins, i) => {
              const estilo = {
                positivo: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", Icon: CheckCircle2, iconColor: "text-emerald-600" },
                atencao: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", Icon: AlertTriangle, iconColor: "text-amber-600" },
                alerta: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", Icon: AlertCircle, iconColor: "text-red-600" },
                dica: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", Icon: Lightbulb, iconColor: "text-blue-600" },
              }[ins.tipo];
              return (
                <div key={i} className={`flex items-start gap-2 ${estilo.bg} border ${estilo.border} rounded-lg p-3 text-sm ${estilo.text}`}>
                  <estilo.Icon size={16} className={`mt-0.5 shrink-0 ${estilo.iconColor}`} />
                  <span>{ins.texto}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="text-center">
        <button
          onClick={() => onDrillDown({ mes: mesFiltro, categoria: null, titulo: `Detalhamento — ${labelPeriodo}` })}
          className="text-xs text-purple-700 hover:underline"
        >
          Ver detalhamento de todos os pedidos do período →
        </button>
      </div>
    </div>
  );
}
