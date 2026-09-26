import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, ReferenceLine, ErrorBar, Cell, Legend,
} from "recharts";
import { Switch } from "@/components/ui/switch";
import type { ResultadoMeta } from "@shared/meta-faturamento";
import type { PainelMetaDados } from "./tipos";
import { Cartao, brlCurto, fmtBrl, fmtNum, kMil } from "./comuns";

export default function Projecao({ data, meta, resultado, sazonal, setSazonal, margemPct }: {
  data: PainelMetaDados;
  meta: number;
  resultado: ResultadoMeta;
  sazonal: boolean;
  setSazonal: (v: boolean) => void;
  margemPct: number;
}) {
  const real12 = data.media12m.faturamento;
  const bandaMes = data.bandas.mensal;
  const bandaAno = data.bandas.media12m;
  const cenarioFat = resultado.totais.faturamento;

  const linhas = data.projecao.map(p => {
    const indice = sazonal ? p.indiceSazonal : 1;
    const realista = real12 * indice;
    const pess = bandaMes ? realista * (1 + bandaMes.pessimista) : null;
    const otim = bandaMes ? realista * (1 + bandaMes.otimista) : null;
    return {
      mes: p.mes,
      historica: p.mediaMesmoMes,
      realista,
      pess,
      otim,
      cenario: cenarioFat * indice,
      erro: pess !== null && otim !== null ? [realista - pess, otim - realista] : [0, 0],
    };
  });
  const somaRealista = linhas.reduce((s, l) => s + l.realista, 0);
  const somaCenario = linhas.reduce((s, l) => s + l.cenario, 0);
  const somaHistorica = linhas.reduce((s, l) => s + (l.historica ?? 0), 0);
  const historicoTemTudo = linhas.every(l => l.historica !== null);
  const totalPess = bandaAno ? somaRealista * (1 + bandaAno.pessimista) : null;
  const totalOtim = bandaAno ? somaRealista * (1 + bandaAno.otimista) : null;
  const historico = data.historico.map(h => ({ ...h, acima: h.faturamento >= meta }));
  const coorte = data.coorte;
  const cac = data.marketing?.cacPorNovo ?? null;
  const ltv = coorte.ltv12m;
  const retorno = coorte.meses.slice(1).map(m => ({ mes: `mês ${m.k}`, ativos: m.ativosPct ?? 0 }));
  const acumulado = coorte.ltvAcumulado.map((v, k) => ({ mes: k === 0 ? "1ª compra" : `mês ${k}`, valor: v ?? 0 }));
  const entradaPct = ltv && coorte.meses[0]?.receitaPorParceiro ? (coorte.meses[0].receitaPorParceiro / ltv) * 100 : null;
  const ativosDepois = coorte.meses.slice(1).map(m => m.ativosPct).filter((v): v is number => v !== null);

  return (
    <div className="space-y-4">
      <Cartao
        titulo="Próximos 12 meses: se você manter o ritmo de hoje"
        subtitulo="Barras = mantendo o ritmo (a linha vertical mostra a faixa pessimista–otimista); linha azul = cenário do Simulador; tracejada = média do mesmo mês em anos anteriores."
      >
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <p className="text-xs text-slate-600">
            Realista: <strong>{brlCurto(somaRealista)}</strong> em 12 meses
            {totalPess !== null && totalOtim !== null && <> (entre <strong>{brlCurto(totalPess)}</strong> pessimista e <strong>{brlCurto(totalOtim)}</strong> otimista)</>}
            {' '}· cenário do simulador: <strong>{brlCurto(somaCenario)}</strong> · meta: {brlCurto(meta * 12)}
          </p>
          <label className="flex items-center gap-2 text-[11px] text-slate-500">
            <Switch checked={sazonal} onCheckedChange={setSazonal} disabled={!data.sazonalidade.disponivel} />
            Considerar sazonalidade (média dos anos anteriores)
          </label>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={linhas} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={kMil} tick={{ fontSize: 11 }} width={40} />
            <ChartTooltip formatter={(v: number | number[]) => (Array.isArray(v) ? `−${fmtBrl(v[0])} / +${fmtBrl(v[1])}` : fmtBrl(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={meta} stroke="#dc2626" strokeDasharray="5 4" label={{ value: "Meta", position: "insideTopRight", fill: "#dc2626", fontSize: 11 }} />
            <Bar dataKey="realista" name="Mantendo o ritmo (realista)" fill="#94a3b8" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {bandaMes && <ErrorBar dataKey="erro" width={4} strokeWidth={1.5} stroke="#475569" />}
            </Bar>
            <Line dataKey="historica" name="Média do mesmo mês (anos anteriores)" stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={1.5} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
            <Line dataKey="cenario" name="Cenário do simulador" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[11px] text-slate-400 text-right">
                <th className="text-left font-medium pb-1">Mês</th>
                <th className="font-medium pb-1 px-2">Média do mesmo mês em anos anteriores</th>
                <th className="font-medium pb-1 px-2">Pessimista</th>
                <th className="font-medium pb-1 px-2">Realista</th>
                <th className="font-medium pb-1 px-2">Otimista</th>
                <th className="font-medium pb-1 px-2">No cenário</th>
                <th className="font-medium pb-1 pl-2">Contribuição (realista)</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.mes} className="border-t border-slate-100 text-right">
                  <td className="py-1.5 text-left font-semibold text-slate-800">{l.mes}</td>
                  <td className="py-1.5 px-2 text-slate-500">{l.historica !== null ? brlCurto(l.historica) : "—"}</td>
                  <td className="py-1.5 px-2 text-slate-500">{l.pess !== null ? brlCurto(l.pess) : "—"}</td>
                  <td className="py-1.5 px-2 font-semibold text-slate-800">{brlCurto(l.realista)}</td>
                  <td className="py-1.5 px-2 text-slate-500">{l.otim !== null ? brlCurto(l.otim) : "—"}</td>
                  <td className="py-1.5 px-2 font-semibold text-blue-700">{brlCurto(l.cenario)}</td>
                  <td className="py-1.5 pl-2 text-slate-500">{brlCurto(l.realista * (margemPct / 100))}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 text-right font-bold">
                <td className="py-1.5 text-left text-slate-800">12 meses</td>
                <td className="py-1.5 px-2 text-slate-500">{historicoTemTudo ? brlCurto(somaHistorica) : "—"}</td>
                <td className="py-1.5 px-2 text-slate-600">{totalPess !== null ? brlCurto(totalPess) : "—"}</td>
                <td className="py-1.5 px-2 text-slate-800">{brlCurto(somaRealista)}</td>
                <td className="py-1.5 px-2 text-slate-600">{totalOtim !== null ? brlCurto(totalOtim) : "—"}</td>
                <td className="py-1.5 px-2 text-blue-700">{brlCurto(somaCenario)}</td>
                <td className="py-1.5 pl-2 text-slate-600">{brlCurto(somaRealista * (margemPct / 100))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          As faixas vêm do erro que o método "média dos 12 meses anteriores" teve ao prever cada um dos últimos {data.bandas.amostras} meses (80% dos meses caíram dentro da faixa mensal).
          Os erros são sorteados como independentes; na prática choques como a saída de um vendedor se repetem em sequência, então a faixa dos 12 meses pode estar um pouco otimista.
          {" "}Valores nominais (sem descontar inflação): o ticket médio já subiu {fmtNum((data.media12m.ticketMedio / Math.max(1, data.anoAnterior12m.ticketMedio) - 1) * 100, 0)}% em 12 meses, e parte disso pode ser reajuste de preço.
          {data.backtest.semSazonalidadePct !== null && <> Testamos também a sazonalidade: {data.backtest.comSazonalidadePct !== null ? `errou ${fmtNum(data.backtest.comSazonalidadePct, 0)}% contra ${fmtNum(data.backtest.semSazonalidadePct, 0)}% sem ela` : `o método simples errou ${fmtNum(data.backtest.semSazonalidadePct, 0)}%`}, por isso ela vem desligada.</>}
        </p>
      </Cartao>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Cartao titulo="Últimos 12 meses (real)" subtitulo="Verde = mês que bateu a meta. Linha vermelha = meta; cinza = sua média.">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={historico} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={kMil} tick={{ fontSize: 11 }} width={40} />
              <ChartTooltip formatter={(v: number) => fmtBrl(v)} />
              <ReferenceLine y={meta} stroke="#dc2626" strokeDasharray="5 4" label={{ value: "Meta", position: "insideTopRight", fill: "#dc2626", fontSize: 11 }} />
              <ReferenceLine y={real12} stroke="#64748b" strokeDasharray="2 3" label={{ value: "Média", position: "insideBottomRight", fill: "#64748b", fontSize: 11 }} />
              <Bar dataKey="faturamento" name="Faturamento" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {historico.map(h => <Cell key={h.mes} fill={h.acima ? "#059669" : "#94a3b8"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Cartao>

        <Cartao
          titulo="Vida de uma gráfica nova (coorte) e valor vitalício"
          subtitulo={coorte.parceirosAnalisados > 0 ? `${coorte.parceirosAnalisados} gráficas que fizeram a 1ª compra entre ${coorte.periodo}` : "Sem dados suficientes"}
        >
          {ltv !== null ? (
            <>
              <p className="text-xs text-slate-600">
                Uma gráfica nova rende em média <strong>{brlCurto(ltv)}</strong> nos primeiros 12 meses
                {entradaPct !== null && <> — {fmtNum(entradaPct, 0)}% já na 1ª compra</>}.
                {ativosDepois.length > 0 && <> Depois da 1ª compra, de {fmtNum(Math.min(...ativosDepois), 0)}% a {fmtNum(Math.max(...ativosDepois), 0)}% delas compram em cada mês.</>}
                {data.retencao.taxaPct !== null && <> Retenção anual da base: {fmtNum(data.retencao.taxaPct, 0)}% (churn de {fmtNum(100 - data.retencao.taxaPct, 0)}%).</>}
                {cac !== null && <> Custo de aquisição em marketing: {brlCurto(cac)} → retorno de ~{fmtNum(ltv / cac, 0)}× em 12 meses.</>}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <p className="text-[11px] text-slate-400">% que compra em cada mês depois da 1ª compra</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={retorno} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <XAxis dataKey="mes" tick={{ fontSize: 9 }} interval={1} />
                      <YAxis tick={{ fontSize: 9 }} width={26} tickFormatter={v => `${v}%`} />
                      <ChartTooltip formatter={(v: number) => `${fmtNum(v, 1)}%`} />
                      <Bar dataKey="ativos" fill="#60a5fa" isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Receita acumulada por gráfica nova (R$)</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <ComposedChart data={acumulado} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <XAxis dataKey="mes" tick={{ fontSize: 9 }} interval={2} />
                      <YAxis tick={{ fontSize: 9 }} width={34} tickFormatter={kMil} />
                      <ChartTooltip formatter={(v: number) => fmtBrl(v)} />
                      <Line dataKey="valor" stroke="#059669" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">Ainda não há gráficas novas suficientes com 12 meses de vida para estimar o valor vitalício.</p>
          )}
        </Cartao>
      </div>
    </div>
  );
}
