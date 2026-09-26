import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, ReferenceLine, ReferenceDot, Legend,
} from "recharts";
import { CalendarClock } from "lucide-react";
import { totaisCenario, dividirFunil, type ResultadoMeta } from "@shared/meta-faturamento";
import { mesApos, prazoValido, PRAZO_MAXIMO_MESES, type PontoDaLinhaDoTempo } from "@shared/planejador-meta";
import type { PainelMetaDados } from "./tipos";
import { CampoNumero, Cartao, brlCurto, fmtBrl, fmtNum, fmtPct, kMil } from "./comuns";

const PRAZOS_RAPIDOS = [3, 6, 9, 12];

const curto = (rotulo: string) => rotulo.replace(/\/20(\d\d)$/, "/$1");
const plural = (n: number, singular: string, pluralTexto: string) => (n === 1 ? singular : pluralTexto);
/** R$ 430.000 (sem centavos) para textos corridos. */
const reais = (v: number) => `R$ ${fmtNum(v, 0)}`;
const PASSO_EIXO = 50_000;

export default function Planejador({ data, meta, resultado, modoAuto, pesoConversao, prazo, setPrazo, pontos, mesMeta }: {
  data: PainelMetaDados;
  meta: number;
  resultado: ResultadoMeta;
  modoAuto: boolean;
  pesoConversao: number;
  prazo: number;
  setPrazo: (v: number) => void;
  pontos: PontoDaLinhaDoTempo[];
  /** Primeiro mês (0 = este mês) em que o faturamento previsto chega na meta; null se não chega. */
  mesMeta: number | null;
}) {
  const prazoOk = prazoValido(prazo);
  const real12 = data.media12m.faturamento;
  const totaisBase = totaisCenario(data.media12m.cenario);
  const bandaMes = data.bandas.mensal;
  const fatFinal = resultado.totais.faturamento;
  const rotulo = (k: number) => mesApos(data.dataReferencia, k).rotulo;
  const jaNaMeta = real12 >= meta * 0.9995;
  const passoPorMes = (fatFinal - real12) / prazoOk;
  const funilAtual = { leadsPorMes: data.funil.leadsPorMes, conversaoPct: data.funil.conversaoPct };

  const linhas = pontos.map(p => {
    const fat = p.totais.faturamento;
    const funil = dividirFunil(totaisBase.vendas, p.totais.vendas, funilAtual, pesoConversao);
    const ref = p.mes >= 1 ? data.projecao[p.mes - 1]?.mediaMesmoMes ?? null : null;
    return {
      k: p.mes,
      rotulo: rotulo(p.mes),
      eixo: p.mes === 0 ? `${curto(rotulo(p.mes))} (hoje)` : curto(rotulo(p.mes)),
      fat,
      baseline: real12,
      faixa: bandaMes ? [fat * (1 + bandaMes.pessimista), fat * (1 + bandaMes.otimista)] : undefined,
      totais: p.totais,
      cenario: p.cenario,
      leads: funil.leads,
      conversaoPct: funil.conversaoPct,
      ref,
    };
  });
  const pontoDaMeta = mesMeta !== null ? linhas[mesMeta] : null;

  // Eixo vertical com degraus iguais (o automático do gráfico escolhe degraus irregulares com a faixa azul).
  const todosOsValores = linhas.flatMap(l => [l.fat, l.baseline, ...(l.faixa ?? [])]).concat(meta);
  const eixoMin = Math.max(0, Math.floor(Math.min(...todosOsValores) / PASSO_EIXO) * PASSO_EIXO);
  const eixoMax = Math.ceil(Math.max(...todosOsValores) / PASSO_EIXO) * PASSO_EIXO;
  const marcasDoEixo = Array.from({ length: Math.round((eixoMax - eixoMin) / PASSO_EIXO) + 1 }, (_, i) => eixoMin + i * PASSO_EIXO);

  let tom: "verde" | "azul" | "ambar";
  let titulo: string;
  let detalhe: string;
  if (jaNaMeta) {
    tom = "verde";
    titulo = `Você já está na meta: hoje o faturamento médio é ${reais(real12)} por mês, acima de ${reais(meta)}.`;
    detalhe = "Use o planejador para uma meta maior (campo \"Minha meta\" no alto da página).";
  } else if (modoAuto && !resultado.atingivel) {
    tom = "ambar";
    titulo = `Com os indicadores que você travou a meta não fecha: o máximo é ${reais(fatFinal)} por mês.`;
    detalhe = "Destrave algum indicador (cadeado) ou reduza a meta.";
  } else if (mesMeta !== null && modoAuto) {
    tom = "azul";
    titulo = `Para chegar a ${reais(meta)} por mês em ${rotulo(prazoOk)} (daqui a ${prazoOk} ${plural(prazoOk, "mês", "meses")}), o faturamento precisa subir cerca de ${brlCurto(passoPorMes)} a cada mês.`;
    detalhe = "A tabela abaixo mostra os números que precisam estar valendo em cada mês. Mexa nos indicadores ou mude o prazo e a linha do tempo se ajusta. É o nível médio esperado: um mês isolado pode ficar acima ou abaixo (faixa azul).";
  } else if (mesMeta !== null) {
    tom = "verde";
    titulo = `Com os números que você colocou, o faturamento passa de ${reais(meta)} em ${rotulo(mesMeta)} (${mesMeta} ${plural(mesMeta, "mês", "meses")} a partir de agora).`;
    detalhe = `Considerando que você chegue nesses números em ${prazoOk} ${plural(prazoOk, "mês", "meses")}, melhorando um pouco a cada mês. É o nível médio esperado: um mês isolado pode ficar acima ou abaixo (faixa azul).`;
  } else {
    tom = "ambar";
    titulo = `Com esses números o faturamento fica em ${reais(fatFinal)} por mês e não chega a ${reais(meta)}.`;
    detalhe = `Faltam ${brlCurto(meta - fatFinal)} por mês. Aumente algum indicador ou ligue o ajuste automático.`;
  }
  const CORES = { verde: "bg-emerald-50 border-emerald-200 text-emerald-900", azul: "bg-blue-50 border-blue-200 text-blue-900", ambar: "bg-amber-50 border-amber-200 text-amber-900" } as const;

  return (
    <Cartao>
      <div className="flex items-start justify-between gap-3 flex-wrap pt-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-blue-600" />
          <div>
            <h4 className="text-sm font-bold text-slate-800">Planejador: quando chego lá?</h4>
            <p className="text-xs text-slate-500">Escolha em quantos meses você consegue chegar nos números do simulador; o painel mostra mês a mês.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            Prazo
            <CampoNumero valor={prazoOk} casas={0} onChange={v => setPrazo(prazoValido(v))} ariaLabel="Prazo em meses" className="h-8 w-16 text-right text-sm font-semibold" />
            meses
          </label>
          <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
            {PRAZOS_RAPIDOS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPrazo(p)}
                className={`px-2 py-1 text-[11px] ${prazoOk === p ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`rounded-lg border px-3 py-2.5 mt-3 ${CORES[tom]}`}>
        <p className="text-sm font-bold">{titulo}</p>
        <p className="text-xs mt-0.5 opacity-90">{detalhe}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Hoje, se nada mudar</p>
          <p className="text-lg font-bold text-slate-700">{brlCurto(real12)}<span className="text-xs font-normal text-slate-400"> por mês</span></p>
          <p className="text-[11px] text-slate-500">
            {bandaMes
              ? <>Um mês isolado costuma ficar entre {brlCurto(real12 * (1 + bandaMes.pessimista))} e {brlCurto(real12 * (1 + bandaMes.otimista))}.</>
              : "Média dos últimos 12 meses fechados."}
          </p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Em {rotulo(prazoOk)}, com o cenário</p>
          <p className="text-lg font-bold text-blue-700">{brlCurto(fatFinal)}<span className="text-xs font-normal text-slate-400"> por mês</span></p>
          <p className="text-[11px] text-slate-500">{fmtNum(resultado.totais.vendas, 0)} pedidos · ticket {fmtBrl(resultado.totais.ticketMedio)} · {fmtPct((fatFinal / meta) * 100, 0)} da meta</p>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{modoAuto ? "Ritmo necessário" : "Ritmo do seu cenário"}</p>
          <p className="text-lg font-bold text-slate-700">{passoPorMes >= 0 ? "+" : "−"}{brlCurto(Math.abs(passoPorMes))}<span className="text-xs font-normal text-slate-400"> a cada mês</span></p>
          <p className="text-[11px] text-slate-500">Sobre o faturamento de hoje ({fmtNum((fatFinal / real12 - 1) * 100, 1)}% no total, em {prazoOk} {plural(prazoOk, "mês", "meses")}).</p>
        </div>
      </div>

      <div className="mt-3">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={linhas} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="eixo" tick={{ fontSize: 11 }} interval={0} padding={{ left: 8, right: 16 }} />
            <YAxis tickFormatter={kMil} tick={{ fontSize: 11 }} width={40} domain={[eixoMin, eixoMax]} ticks={marcasDoEixo} />
            <ChartTooltip formatter={(v: number | number[]) => (Array.isArray(v) ? `${fmtBrl(v[0])} a ${fmtBrl(v[1])}` : fmtBrl(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={meta} stroke="#dc2626" strokeDasharray="5 4" label={{ value: "Meta", position: "insideTopRight", fill: "#dc2626", fontSize: 11 }} />
            {bandaMes && <Area dataKey="faixa" name="Faixa provável de um mês no cenário" stroke="none" fill="#93c5fd" fillOpacity={0.25} isAnimationActive={false} />}
            <Line dataKey="baseline" name="Se nada mudar" stroke="#94a3b8" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="fat" name="Com o cenário" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
            {pontoDaMeta && (
              <ReferenceDot x={pontoDaMeta.eixo} y={pontoDaMeta.fat} r={7} fill="#059669" stroke="#fff" strokeWidth={2} label={{ value: pontoDaMeta.rotulo, position: "top", fill: "#047857", fontSize: 11, fontWeight: 700 }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto mt-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[11px] text-slate-400 text-right">
              <th className="text-left font-medium pb-1">Mês</th>
              <th className="font-medium pb-1 px-2">Faturamento</th>
              <th className="font-medium pb-1 px-2">Contra hoje</th>
              <th className="font-medium pb-1 px-2">Pedidos</th>
              <th className="font-medium pb-1 px-2">Ticket médio</th>
              <th className="font-medium pb-1 px-2">Orçamentos</th>
              <th className="font-medium pb-1 px-2">Conversão</th>
              <th className="font-medium pb-1 px-2">Gráficas novas</th>
              <th className="font-medium pb-1 px-2">Reativadas</th>
              <th className="font-medium pb-1 pl-2" title="Média do faturamento do mesmo mês nos anos anteriores (referência, não entra na conta)">Mesmo mês em anos anteriores</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => {
              const cruzou = mesMeta !== null && l.k === mesMeta;
              return (
                <tr key={l.k} className={`border-t border-slate-100 text-right ${cruzou ? "bg-emerald-50" : l.k === 0 ? "bg-slate-50" : ""}`}>
                  <td className="py-1.5 text-left font-semibold text-slate-800 whitespace-nowrap">
                    {l.rotulo}{l.k === 0 && <span className="font-normal text-slate-400"> (este mês)</span>}
                    {cruzou && l.k > 0 && <span className="ml-1 text-emerald-700 font-bold">← chega na meta</span>}
                  </td>
                  <td className="py-1.5 px-2 font-semibold text-blue-700">{brlCurto(l.fat)}</td>
                  <td className="py-1.5 px-2 text-slate-500">{l.k === 0 ? "—" : `${l.fat >= real12 ? "+" : ""}${fmtNum((l.fat / real12 - 1) * 100, 1)}%`}</td>
                  <td className="py-1.5 px-2 text-slate-600">{fmtNum(l.totais.vendas, 0)}</td>
                  <td className="py-1.5 px-2 text-slate-600">{fmtBrl(l.totais.ticketMedio)}</td>
                  <td className="py-1.5 px-2 text-slate-600">{l.leads !== null ? `~${fmtNum(l.leads, 0)}` : "—"}</td>
                  <td className="py-1.5 px-2 text-slate-600">{l.conversaoPct !== null ? `${fmtNum(l.conversaoPct, 1)}%` : "—"}</td>
                  <td className="py-1.5 px-2 text-slate-600">{fmtNum(l.cenario.novos.clientes, 1)}</td>
                  <td className="py-1.5 px-2 text-slate-600">{fmtNum(l.cenario.reativados.clientes, 1)}</td>
                  <td className="py-1.5 pl-2 text-slate-400">{l.ref !== null ? brlCurto(l.ref) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400 mt-2">
        Como a conta é feita: hoje = média dos últimos 12 meses fechados. Cada indicador do simulador sobe (ou desce) em linha reta, um pouco a cada mês, até o valor do cenário no mês {prazoOk}, e depois fica estável;
        o faturamento de cada mês é a mesma conta do simulador (gráficas × pedidos × ticket) com os números daquele mês. O prazo é uma escolha sua: só você sabe o quão rápido consegue acelerar a captação e a recompra
        (o máximo é {PRAZO_MAXIMO_MESES} meses). A faixa azul é a variação natural de um mês para o outro observada nos últimos {data.bandas.amostras} meses — meses isolados vão acima e abaixo da linha.
        Não entra na conta o efeito extra de as gráficas novas continuarem comprando nos meses seguintes (veja as abas 4 e 5), então, nesse ponto, a estimativa tende a ser conservadora.
      </p>
    </Cartao>
  );
}
