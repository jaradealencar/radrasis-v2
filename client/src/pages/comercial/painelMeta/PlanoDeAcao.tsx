import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { totaisCenario, dividirFunil, type ResultadoMeta } from "@shared/meta-faturamento";
import type { PainelMetaDados, DestinoRecomendacao, VistaDestino } from "./tipos";
import { SEMANAS_POR_MES } from "./tipos";
import { Cartao, Selo, brlCurto, fmtNum } from "./comuns";

type Recomendacao = PainelMetaDados["recomendacoes"][number];

const ROTULO_DESTINO: Record<DestinoRecomendacao, string> = {
  crm: "Abrir o CRM",
  "fila-acoes": "Abrir a Fila de Ações",
  retencao: "Abrir a Retenção",
  funil: "Abrir o Funil",
  clientes: "Abrir Clientes",
  crescimento: "Abrir Crescimento e Resultado",
  radar: "Abrir o Radar de Mercado",
};

const VISTA_DO_DESTINO: Partial<Record<DestinoRecomendacao, VistaDestino>> = {
  "fila-acoes": "fila",
  retencao: "retencao",
  funil: "funil",
  clientes: "clientes",
  crescimento: "crescimento",
};

const ROTA_DO_DESTINO: Partial<Record<DestinoRecomendacao, string>> = { crm: "/comercial/crm", radar: "/comercial/radar-mercado" };

function BotaoDestino({ destino, onIrPara, disponiveis }: { destino: DestinoRecomendacao; onIrPara: (v: VistaDestino) => void; disponiveis: VistaDestino[] }) {
  const classe = "inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-md px-2.5 py-1.5";
  const rota = ROTA_DO_DESTINO[destino];
  if (rota) {
    return <Link href={rota} className={classe}>{ROTULO_DESTINO[destino]}<ArrowRight className="w-3.5 h-3.5" /></Link>;
  }
  const vista = VISTA_DO_DESTINO[destino];
  if (!vista || !disponiveis.includes(vista)) return null;
  return <button type="button" onClick={() => onIrPara(vista)} className={classe}>{ROTULO_DESTINO[destino]}<ArrowRight className="w-3.5 h-3.5" /></button>;
}

function CartaoRecomendacao({ r, posicao, onIrPara, disponiveis }: { r: Recomendacao; posicao: number; onIrPara: (v: VistaDestino) => void; disponiveis: VistaDestino[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{posicao}</span>
          <h5 className="text-sm font-bold text-slate-800">{r.titulo}</h5>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Selo tom={r.esforco === "baixo" ? "verde" : r.esforco === "medio" ? "ambar" : "vermelho"}>Esforço {r.esforco === "medio" ? "médio" : r.esforco}</Selo>
          <Selo tom={r.confianca === "alta" ? "verde" : r.confianca === "media" ? "azul" : "cinza"}>Confiança {r.confianca === "media" ? "média" : r.confianca}</Selo>
        </div>
      </div>
      {(r.impactoMensal !== null || r.impactoUnico !== null) && (
        <p className="mt-2 text-sm">
          {r.impactoMensal !== null && <span className="font-bold text-emerald-700">+{brlCurto(r.impactoMensal)} por mês <span className="font-normal text-slate-500">(em regime)</span></span>}
          {r.impactoMensal !== null && r.impactoUnico !== null && <span className="text-slate-300"> · </span>}
          {r.impactoUnico !== null && <span className="font-bold text-emerald-700">{brlCurto(r.impactoUnico)} <span className="font-normal text-slate-500">de uma vez</span></span>}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-600">{r.diagnostico}</p>
      <p className="mt-2 text-xs text-slate-800"><strong>O que fazer:</strong> {r.acao}</p>
      <p className="mt-2 text-[11px] text-slate-400">Premissa: {r.premissa}</p>
      {r.destino && <div className="mt-3"><BotaoDestino destino={r.destino} onIrPara={onIrPara} disponiveis={disponiveis} /></div>}
    </div>
  );
}

export default function PlanoDeAcao({ data, meta, resultado, pesoConversao, onIrPara, destinosDisponiveis }: {
  data: PainelMetaDados;
  meta: number;
  resultado: ResultadoMeta;
  pesoConversao: number;
  onIrPara: (v: VistaDestino) => void;
  destinosDisponiveis: VistaDestino[];
}) {
  const atualTotais = totaisCenario(data.media12m.cenario);
  const alvo = resultado.totais;
  const funilAtual = { leadsPorMes: data.funil.leadsPorMes, conversaoPct: data.funil.conversaoPct };
  const funilAlvo = dividirFunil(atualTotais.vendas, alvo.vendas, funilAtual, pesoConversao);
  const semana = (v: number | null) => (v === null ? null : v / SEMANAS_POR_MES);
  const base = data.media12m.cenario;
  const cen = resultado.cenario;

  const linhas: Array<{ rotulo: string; hoje: string; alvo: string; dica: string }> = [
    ...(funilAtual.leadsPorMes !== null && funilAlvo.leads !== null
      ? [{ rotulo: "Orçamentos enviados por semana", hoje: fmtNum(semana(funilAtual.leadsPorMes), 0), alvo: fmtNum(semana(funilAlvo.leads), 0), dica: "Conte os orçamentos emitidos de segunda a sexta." }]
      : []),
    ...(funilAtual.conversaoPct !== null && funilAlvo.conversaoPct !== null
      ? [{ rotulo: "Taxa de conversão de orçamentos", hoje: `${fmtNum(funilAtual.conversaoPct, 1)}%`, alvo: `${fmtNum(funilAlvo.conversaoPct, 1)}%`, dica: "Pedidos fechados ÷ orçamentos decididos (vencido = perdido)." }]
      : []),
    { rotulo: "Pedidos fechados por semana", hoje: fmtNum(semana(atualTotais.vendas), 0), alvo: fmtNum(semana(alvo.vendas), 0), dica: "Pedidos aprovados na semana." },
    { rotulo: "Ticket médio por pedido", hoje: `R$ ${fmtNum(atualTotais.ticketMedio, 0)}`, alvo: `R$ ${fmtNum(alvo.ticketMedio, 0)}`, dica: "Faturamento ÷ pedidos, olhando a média do mês." },
    { rotulo: "Gráficas novas por semana", hoje: fmtNum(semana(base.novos.clientes), 1), alvo: fmtNum(semana(cen.novos.clientes), 1), dica: "Primeira compra de gráficas que nunca compraram." },
    { rotulo: "Gráficas reativadas por semana", hoje: fmtNum(semana(base.reativados.clientes), 1), alvo: fmtNum(semana(cen.reativados.clientes), 1), dica: "Voltaram após 6 meses ou mais sem comprar." },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600">
        As ações abaixo saem dos seus próprios dados (orçamentos, vendedores, fila de recompra, financeiro, marketing) e estão ordenadas do <strong>maior ganho para o menor esforço</strong> (ganhos de uma vez são diluídos em 6 meses para poder comparar com ganhos mensais).
        Cada uma mostra o número que a sustenta e a premissa usada — se discordar da premissa, o valor muda.
      </p>

      {data.recomendacoes.length === 0 ? (
        <Cartao><p className="text-xs text-slate-500">Ainda não há dados suficientes (orçamentos, financeiro ou marketing) para gerar recomendações com número.</p></Cartao>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {data.recomendacoes.map((r, i) => <CartaoRecomendacao key={r.id} r={r} posicao={i + 1} onIrPara={onIrPara} disponiveis={destinosDisponiveis} />)}
        </div>
      )}

      {data.pipeline.top.length > 0 && (
        <Cartao
          titulo="Comece por aqui: maiores orçamentos em aberto ainda válidos"
          subtitulo={`${data.pipeline.quantidade} orçamentos válidos somam ${brlCurto(data.pipeline.valorTotal)}; o esperado é fechar ${brlCurto(data.pipeline.valorEsperado)}. ${data.pipeline.vencendoEm3Dias.quantidade} vencem em até 3 dias.`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[11px] text-slate-400 text-left">
                  <th className="font-medium pb-1">Gráfica</th>
                  <th className="font-medium pb-1">Vendedor</th>
                  <th className="font-medium pb-1 text-right">Valor</th>
                  <th className="font-medium pb-1 text-right">Vence em</th>
                  <th className="font-medium pb-1 text-right">Chance histórica</th>
                </tr>
              </thead>
              <tbody>
                {data.pipeline.top.map((o, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-800 font-medium">{o.empresa}</td>
                    <td className="py-1.5 text-slate-600">{o.vendedor}</td>
                    <td className="py-1.5 text-right font-semibold">R$ {fmtNum(o.total, 0)}</td>
                    <td className={`py-1.5 text-right ${o.diasParaVencer <= 3 ? "text-red-600 font-semibold" : "text-slate-600"}`}>{o.diasParaVencer} dia{o.diasParaVencer === 1 ? "" : "s"}</td>
                    <td className="py-1.5 text-right text-slate-500">{o.taxaFaixaPct !== null ? `${fmtNum(o.taxaFaixaPct, 0)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      )}

      <Cartao titulo={`Rotina: metas semanais para chegar em ${brlCurto(meta)} por mês`} subtitulo="Do cenário que está no Simulador (por padrão, o caminho equilibrado). Acompanhe toda segunda-feira.">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[11px] text-slate-400 text-left">
                <th className="font-medium pb-1">O que acompanhar</th>
                <th className="font-medium pb-1 text-right">Hoje</th>
                <th className="font-medium pb-1 text-right">Meta do cenário</th>
                <th className="font-medium pb-1 pl-4">Como medir</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.rotulo} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-800 font-medium">{l.rotulo}</td>
                  <td className="py-1.5 text-right text-slate-500">{l.hoje}</td>
                  <td className="py-1.5 text-right font-bold text-blue-700">{l.alvo}</td>
                  <td className="py-1.5 pl-4 text-slate-500">{l.dica}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 text-xs text-slate-600 list-disc pl-4 space-y-1">
          <li><strong>Segunda-feira:</strong> confira a semana anterior contra a meta semanal acima e o pipeline que vence nos próximos 3 dias.</li>
          <li><strong>Quarta-feira:</strong> trabalhe a Fila de Ações (recompra atrasada e novos sem 2ª compra) e registre cada contato.</li>
          <li><strong>Sexta-feira:</strong> confira a conversão por vendedor e o ticket médio da semana; ajuste o foco de follow-up.</li>
          <li><strong>Todo mês:</strong> compare a média dos últimos 3 meses com a meta — não o mês isolado, que oscila muito.</li>
        </ul>
      </Cartao>
    </div>
  );
}
