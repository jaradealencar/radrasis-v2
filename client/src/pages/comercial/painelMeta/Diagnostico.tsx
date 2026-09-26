import { totaisCenario, faturamentoSegmento, type SegmentoId } from "@shared/meta-faturamento";
import { Link } from "wouter";
import type { PainelMetaDados } from "./tipos";
import { Cartao, Selo, brlCurto, fmtNum } from "./comuns";
import { canaisDeReceita, lucroEstimado, parceirosAtivos } from "./calculos";
import { gerarInsights, variacoesAnuais, baseRetidaPct } from "./insights";

const COR_CANAL: Record<string, string> = { novos: "bg-blue-500", reativados: "bg-violet-500", baseRetida: "bg-emerald-500" };

const GRUPOS: Array<{ id: SegmentoId; rotulo: string }> = [
  { id: "novos", rotulo: "Gráficas novas" },
  { id: "reativados", rotulo: "Gráficas reativadas" },
  { id: "recompraConquistados", rotulo: "Recompra das conquistadas" },
  { id: "carteira", rotulo: "Carteira (recorrência)" },
];

function LinhaAno({ rotulo, anterior, atual, formato, casas = 0 }: {
  rotulo: string; anterior: number | null; atual: number | null; formato: "num" | "brl" | "pct"; casas?: number;
}) {
  const f = (v: number | null) => {
    if (v === null) return "—";
    if (formato === "brl") return `R$ ${fmtNum(v, 0)}`;
    if (formato === "pct") return `${fmtNum(v, casas)}%`;
    return fmtNum(v, casas);
  };
  let variacao: string | null = null;
  let bom = true;
  if (anterior !== null && atual !== null && anterior > 0) {
    if (formato === "pct") {
      const pp = atual - anterior;
      variacao = `${pp >= 0 ? "+" : ""}${fmtNum(pp, 1)} p.p.`;
      bom = pp >= 0;
    } else {
      const pct = (atual / anterior - 1) * 100;
      variacao = `${pct >= 0 ? "+" : ""}${fmtNum(pct, 1)}%`;
      bom = pct >= 0;
    }
  }
  return (
    <tr className="border-t border-slate-100">
      <td className="py-1.5 pr-2 text-slate-600">{rotulo}</td>
      <td className="py-1.5 px-2 text-right text-slate-500 whitespace-nowrap">{f(anterior)}</td>
      <td className="py-1.5 px-2 text-right font-semibold text-slate-800 whitespace-nowrap">{f(atual)}</td>
      <td className={`py-1.5 pl-2 text-right font-semibold ${variacao === null ? "text-slate-400" : bom ? "text-emerald-600" : "text-red-600"} whitespace-nowrap`}>{variacao ?? "—"}</td>
    </tr>
  );
}

export default function Diagnostico({ data, meta, meta2 }: { data: PainelMetaDados; meta: number; meta2: number }) {
  const real12 = data.media12m.faturamento;
  const recente = data.ultimos3m.faturamento;
  const anterior = data.anoAnterior12m.faturamento;
  const mesesAcima = data.historico.filter(h => h.faturamento >= meta).length;
  const banda = data.bandas.media12m;
  const bandaMes = data.bandas.mensal;
  const anual = variacoesAnuais(data);
  const canais = canaisDeReceita(totaisCenario(data.media12m.cenario));
  const ativos = parceirosAtivos(data.media12m.cenario);
  const funilCruzado = data.funil.leadsPorMes !== null && data.funil.conversaoPct !== null
    ? data.funil.leadsPorMes * (data.funil.conversaoPct / 100) * data.media12m.ticketMedio
    : null;
  const insights = gerarInsights(data);
  const economia = data.economia;
  const correlacoes = data.correlacoes.itens.slice(0, 4);
  const ticketCorr = data.correlacoes.itens.find(i => i.id === "ticket");
  const ativosCorr = data.correlacoes.itens.find(i => i.id === "ativos");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Cartao titulo="Seu faturamento" subtitulo="Média dos últimos 12 meses fechados">
          <p className="text-3xl font-bold text-slate-800">{brlCurto(real12)}<span className="text-sm font-normal text-slate-400"> por mês</span></p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            <li>Últimos 3 meses: <strong>{brlCurto(recente)}</strong></li>
            <li>12 meses anteriores: {brlCurto(anterior)}{anterior > 0 && <> ({real12 >= anterior ? "+" : ""}{fmtNum((real12 / anterior - 1) * 100, 1)}%)</>}</li>
            <li>Bateu a meta de {brlCurto(meta)} em <strong>{mesesAcima} de 12</strong> meses</li>
          </ul>
          {banda && bandaMes && (
            <p className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5">
              <strong>Se nada mudar</strong>, a média dos próximos 12 meses deve ficar entre <strong>{brlCurto(real12 * (1 + banda.pessimista))}</strong> e <strong>{brlCurto(real12 * (1 + banda.otimista))}</strong> (80% de chance).
              Um mês isolado pode variar de {fmtNum(bandaMes.pessimista * 100, 0)}% a +{fmtNum(bandaMes.otimista * 100, 0)}% em relação à média.
            </p>
          )}
        </Cartao>

        <Cartao titulo="O que mudou em 1 ano" subtitulo="Últimos 12 meses × 12 meses anteriores">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[11px] text-slate-400">
                <th className="text-left font-medium pb-1">Indicador</th>
                <th className="text-right font-medium pb-1 px-2">Antes</th>
                <th className="text-right font-medium pb-1 px-2">Agora</th>
                <th className="text-right font-medium pb-1 pl-2">Variação</th>
              </tr>
            </thead>
            <tbody>
              <LinhaAno rotulo="Faturamento por mês" anterior={anual.faturamento.anterior} atual={anual.faturamento.atual} formato="brl" />
              <LinhaAno rotulo="Pedidos por mês" anterior={anual.vendas.anterior} atual={anual.vendas.atual} formato="num" />
              <LinhaAno rotulo="Ticket médio" anterior={anual.ticket.anterior} atual={anual.ticket.atual} formato="brl" />
              <LinhaAno rotulo="Gráficas ativas por mês" anterior={anual.parceirosAtivosMes.anterior} atual={anual.parceirosAtivosMes.atual} formato="num" />
              <LinhaAno rotulo="Margem de contribuição" anterior={anual.margem.anterior} atual={anual.margem.atual} formato="pct" casas={1} />
              <LinhaAno rotulo="Retenção anual da base" anterior={anual.retencao.anterior} atual={anual.retencao.atual} formato="pct" casas={1} />
            </tbody>
          </table>
        </Cartao>

        <Cartao titulo="Por que a meta importa" subtitulo={economia ? `Financeiro, ${economia.periodo}` : "Financeiro"}>
          {economia ? (
            <>
              <p className="text-xs text-slate-600">
                Cada <strong>R$ 10 mil</strong> a mais de faturamento renderam cerca de <strong>{brlCurto(economia.inclinacao * 10_000)}</strong> a mais de lucro.
                {economia.pontoEquilibrio !== null && <> O ponto de equilíbrio está perto de <strong>{brlCurto(economia.pontoEquilibrio)}</strong> por mês.</>}
              </p>
              <table className="w-full text-xs mt-2">
                <tbody>
                  {[
                    { rotulo: "Hoje", fat: real12 },
                    { rotulo: `Meta ${brlCurto(meta)}`, fat: meta },
                    { rotulo: `Meta ${brlCurto(meta2)}`, fat: meta2 },
                  ].map(l => {
                    const lucro = lucroEstimado(economia, l.fat);
                    return (
                      <tr key={l.rotulo} className="border-t border-slate-100">
                        <td className="py-1.5 text-slate-600">{l.rotulo}</td>
                        <td className={`py-1.5 text-right font-semibold ${lucro !== null && lucro < 0 ? "text-red-600" : "text-emerald-700"}`}>{lucro !== null ? `${brlCurto(lucro)} de lucro/mês` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[11px] text-slate-400 mt-2">
                Estimativa por regressão de {economia.meses} meses (ajuste de {fmtNum(economia.r2 * 100, 0)}%, confiança {economia.confianca}): despesas fixas e variáveis oscilam de mês a mês, então use como ordem de grandeza.
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500">Ainda não há meses suficientes no Financeiro (com faturamento e lucro lançados) para estimar quanto lucro cada real de faturamento rende.</p>
          )}
        </Cartao>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Cartao titulo="De onde vem o faturamento" subtitulo="Três canais de entrada — média dos últimos 12 meses">
          <div className="flex h-7 rounded-lg overflow-hidden border border-slate-200">
            {canais.map(c => (
              <div key={c.id} className={`${COR_CANAL[c.id]} flex items-center justify-center text-[11px] font-semibold text-white`} style={{ width: `${c.pct}%` }} title={`${c.rotulo}: ${brlCurto(c.valor)}`}>
                {c.pct >= 8 ? `${fmtNum(c.pct, 0)}%` : ""}
              </div>
            ))}
          </div>
          <ul className="mt-3 space-y-1.5">
            {canais.map(c => (
              <li key={c.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600"><span className={`inline-block w-2.5 h-2.5 rounded-sm ${COR_CANAL[c.id]}`} />{c.rotulo}</span>
                <span className="font-semibold text-slate-800">{brlCurto(c.valor)}<span className="font-normal text-slate-400"> /mês ({fmtNum(c.pct, 0)}%)</span></span>
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto mt-3 border-t border-slate-100 pt-2">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-400 text-right">
                  <th className="text-left font-medium pb-1">Grupo (média 12 meses)</th>
                  <th className="font-medium pb-1 px-1">Gráficas/mês</th>
                  <th className="font-medium pb-1 px-1">Pedidos/gráfica</th>
                  <th className="font-medium pb-1 px-1">Ticket</th>
                  <th className="font-medium pb-1 pl-1">Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {GRUPOS.map(g => {
                  const c = data.media12m.cenario[g.id];
                  return (
                    <tr key={g.id} className="border-t border-slate-100 text-right">
                      <td className="py-1 text-left text-slate-700">{g.rotulo}</td>
                      <td className="py-1 px-1 text-slate-600 whitespace-nowrap">{fmtNum(c.clientes, 1)}</td>
                      <td className="py-1 px-1 text-slate-600 whitespace-nowrap">{fmtNum(c.pedidosPorCliente, 2)}</td>
                      <td className="py-1 px-1 text-slate-600 whitespace-nowrap">R$ {fmtNum(c.ticket, 0)}</td>
                      <td className="py-1 pl-1 font-semibold text-slate-800 whitespace-nowrap">{brlCurto(faturamentoSegmento(c))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {funilCruzado !== null && (
            <p className="text-[11px] text-slate-500 mt-3 border-t border-slate-100 pt-2">
              Conferência pelo funil: {fmtNum(data.funil.leadsPorMes, 0)} orçamentos × {fmtNum(data.funil.conversaoPct, 1)}% de conversão × R$ {fmtNum(data.media12m.ticketMedio, 0)} de ticket = <strong>{brlCurto(funilCruzado)}</strong> por mês — bate com o faturamento real ({brlCurto(real12)}).
            </p>
          )}
        </Cartao>

        <Cartao titulo="Sua Métrica Estrela Guia" subtitulo="O número que mais move todos os outros">
          <p className="text-sm font-bold text-blue-700">Gráficas ativas por mês <span className="font-normal text-slate-500">(que fizeram ao menos 1 pedido)</span></p>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-600 list-disc pl-4">
            <li>Hoje são <strong>{fmtNum(ativos, 0)}</strong> gráficas ativas por mês, gerando em média <strong>R$ {fmtNum(real12 / Math.max(1, ativos), 0)}</strong> cada. Cada gráfica ativa a mais por mês equivale a cerca desse valor de faturamento mensal.</li>
            <li>É a única medida que junta os 3 caminhos de crescimento: trazer gráficas novas, reativar as paradas e manter as que já compram.</li>
            <li>A base retida (quem já comprou antes) gera <strong>{fmtNum(baseRetidaPct(data), 0)}%</strong> do faturamento: proteger e ampliar quem compra vale mais do que qualquer campanha isolada.</li>
            <li>Segundo ponteiro de apoio: <strong>ticket médio por pedido</strong>{ticketCorr && ativosCorr && <> (explica {fmtNum(ticketCorr.r2Pct, 0)}% da oscilação mensal do faturamento; gráficas ativas explicam {fmtNum(ativosCorr.r2Pct, 0)}%)</>}.</li>
          </ul>
          {correlacoes.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[11px] text-slate-400">O quanto cada indicador explica da oscilação do faturamento mês a mês (últimos {data.correlacoes.meses} meses):</p>
              {correlacoes.map(c => (
                <div key={c.id} className="flex items-center gap-2 text-[11px]">
                  <span className="w-44 shrink-0 text-slate-600 truncate">{c.rotulo}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-400" style={{ width: `${Math.min(100, c.r2Pct)}%` }} /></div>
                  <span className="w-9 text-right text-slate-500">{fmtNum(c.r2Pct, 0)}%</span>
                </div>
              ))}
              <p className="text-[11px] text-slate-400">Nenhum indicador sozinho explica a maior parte — o faturamento é o produto de vários. Correlação não prova causa.</p>
            </div>
          )}
        </Cartao>
      </div>

      <Cartao titulo="Demanda derivada: você vende para quem vende" subtitulo="Canal indireto — o que as gráficas conseguem vender aos comércios locais move os seus pedidos">
        <p className="text-xs text-slate-600">
          Quando o comércio local inaugura, reforma ou expande lojas, as gráficas parceiras fecham mais fachadas e letreiros — e compram de você.
          Por isso os orçamentos que chegam ({fmtNum(data.funil.leadsPorMes, 0)} por mês) são o termômetro mais antecipado das suas vendas, e a região das suas {fmtNum(data.distribuicoes.concentracao.parceirosAtivos, 0)} gráficas ativas define onde há demanda.
        </p>
        {data.sinais ? (
          <p className="mt-2 text-xs text-slate-600">
            O Radar de Mercado registrou <strong>{data.sinais.total90d}</strong> sinais ativos nos últimos 90 dias
            {data.sinais.porTipo.length > 0 && <> ({data.sinais.porTipo.map(t => t.quantidade + " " + t.tipo).join(", ")})</>}
            {data.sinais.porUf.length > 0 && <>; estados com mais sinais: {data.sinais.porUf.map(u => u.uf + " (" + u.quantidade + ")").join(", ")}</>}.
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">O Radar de Mercado ainda não tem sinais ativos nos últimos 90 dias — quando tiver, eles aparecem aqui como sinal antecedente da demanda das gráficas.</p>
        )}
        <Link href="/comercial/radar-mercado" className="inline-flex mt-3 items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-md px-2.5 py-1.5">Abrir o Radar de Mercado</Link>
      </Cartao>

      <Cartao titulo="O que os números dizem" subtitulo="Pontos fortes e pontos de atenção, com o número que sustenta cada um">
        <ul className="space-y-2">
          {insights.map((i, idx) => (
            <li key={idx} className="flex gap-3 text-xs">
              <span className="shrink-0 mt-0.5"><Selo tom={i.tom === "positivo" ? "verde" : i.tom === "risco" ? "vermelho" : "ambar"}>{i.tom === "positivo" ? "Bom" : i.tom === "risco" ? "Risco" : "Atenção"}</Selo></span>
              <span><strong className="text-slate-800">{i.titulo}.</strong> <span className="text-slate-600">{i.texto}</span></span>
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}
