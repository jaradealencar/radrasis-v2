import { Lock, LockOpen, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  SEGMENTOS, CAMPOS_ALAVANCA, idAlavanca, totaisCenario, dividirFunil,
  type SegmentoId, type CampoAlavanca, type Fixos, type IdAlavanca, type ResultadoMeta, type Alavanca,
} from "@shared/meta-faturamento";
import type { PainelMetaDados } from "./tipos";
import { CampoNumero, Ficha, Variacao, brlCurto, fmtBrl, fmtNum, fmtPct } from "./comuns";
import { lucroEstimado } from "./calculos";

const TEXTO_SEGMENTO: Record<SegmentoId, { titulo: string; descricao: string }> = {
  novos: { titulo: "Gráficas novas", descricao: "Compraram pela 1ª vez no mês." },
  reativados: { titulo: "Gráficas reativadas", descricao: "Voltaram a comprar depois de 6 meses ou mais paradas." },
  recompraConquistados: { titulo: "Recompra de gráficas conquistadas", descricao: "Novas ou reativadas dos últimos 12 meses que compraram de novo." },
  carteira: { titulo: "Gráficas ativas (recorrência)", descricao: "Gráficas antigas que continuam comprando." },
};

const TEXTO_CAMPO: Record<CampoAlavanca, string> = {
  clientes: "Gráficas por mês",
  pedidosPorCliente: "Pedidos por gráfica (no mês)",
  ticket: "Ticket médio por pedido",
};

function fmtCampo(campo: CampoAlavanca, v: number): string {
  if (campo === "clientes") return fmtNum(v, 1);
  if (campo === "pedidosPorCliente") return fmtNum(v, 2);
  return `R$ ${fmtNum(v, 0)}`;
}

function configSlider(campo: CampoAlavanca, base: number): { max: number; passo: number } {
  if (campo === "clientes") return { max: Math.max(base * 3, 20), passo: 0.5 };
  if (campo === "pedidosPorCliente") return { max: Math.max(base * 2.5, 3), passo: 0.05 };
  return { max: Math.ceil(Math.max(base * 2.5, 1000) / 100) * 100, passo: 10 };
}

function LinhaAlavanca({ campo, base, recente, valor, fixado, modoAuto, onChange, onAlternarTrava }: {
  campo: CampoAlavanca;
  base: number;
  recente: number;
  valor: number;
  fixado: boolean;
  modoAuto: boolean;
  onChange: (v: number) => void;
  onAlternarTrava: () => void;
}) {
  const { max, passo } = configSlider(campo, base);
  const casas = campo === "clientes" ? 1 : campo === "pedidosPorCliente" ? 2 : 0;
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${fixado ? "border-amber-300 bg-amber-50/70" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-700">{TEXTO_CAMPO[campo]}</p>
          <p className="text-[11px] text-slate-400">12 meses: {fmtCampo(campo, base)} · 3 meses: {fmtCampo(campo, recente)}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <CampoNumero valor={valor} casas={casas} onChange={onChange} ariaLabel={TEXTO_CAMPO[campo]} className="h-8 w-20 text-right text-sm font-semibold" />
          {modoAuto && (
            <button
              type="button"
              onClick={onAlternarTrava}
              title={fixado ? "Travado no valor que você escolheu. Clique para deixar o painel ajustar este indicador." : "Clique para travar este indicador neste valor (os outros continuam se ajustando)."}
              className={`h-8 w-8 flex items-center justify-center rounded-md border ${fixado ? "border-amber-400 bg-amber-100 text-amber-700" : "border-slate-200 text-slate-400 hover:text-slate-600"}`}
            >
              {fixado ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2.5">
        <Slider value={[Math.min(Math.max(valor, 0), max)]} min={0} max={max} step={passo} onValueChange={([v]) => onChange(v)} />
        <div className="w-16 text-right shrink-0"><Variacao valor={valor} referencia={base} /></div>
      </div>
    </div>
  );
}

export const OPCOES_FUNIL: Array<{ peso: number; rotulo: string; dica: string }> = [
  { peso: 0, rotulo: "Mais orçamentos", dica: "Todo o aumento de vendas vem de receber mais orçamentos (conversão fica igual)." },
  { peso: 0.5, rotulo: "Metade e metade", dica: "O aumento de vendas vem igualmente de mais orçamentos e de melhor conversão." },
  { peso: 1, rotulo: "Melhor conversão", dica: "Todo o aumento de vendas vem de converter mais (orçamentos ficam iguais)." },
];

export default function Simulador({
  data, meta, fixos, setFixos, modoAuto, setModoAuto, pesoConversao, setPesoConversao, resultado, margemPct, setMargemPct,
}: {
  data: PainelMetaDados;
  meta: number;
  fixos: Fixos;
  setFixos: (f: Fixos | ((a: Fixos) => Fixos)) => void;
  modoAuto: boolean;
  setModoAuto: (v: boolean) => void;
  pesoConversao: number;
  setPesoConversao: (v: number) => void;
  resultado: ResultadoMeta;
  margemPct: number;
  setMargemPct: (v: number) => void;
}) {
  const base = data.media12m;
  const recente = data.ultimos3m;
  const cenario = resultado.cenario;
  const totais = resultado.totais;
  const real12 = base.faturamento;
  const totaisBase = totaisCenario(base.cenario);
  const numFixos = Object.keys(fixos).length;
  const fechou = totais.faturamento >= meta * 0.9995;

  const definir = (id: IdAlavanca, v: number) => setFixos(f => ({ ...f, [id]: v }));
  const alternarTrava = (id: IdAlavanca, valorAtual: number) =>
    setFixos(f => {
      if (id in f) { const { [id]: _removido, ...resto } = f; return resto; }
      return { ...f, [id]: valorAtual };
    });

  const funil = dividirFunil(totaisBase.vendas, totais.vendas, { leadsPorMes: data.funil.leadsPorMes, conversaoPct: data.funil.conversaoPct }, pesoConversao);
  const lucro = lucroEstimado(data.economia, totais.faturamento);
  const contribuicao = totais.faturamento * (margemPct / 100);

  let plano: string;
  if (!modoAuto) {
    plano = `Modo livre: você controla todos os indicadores. Nesse cenário o faturamento fica em ${fmtBrl(totais.faturamento)} por mês (${fmtPct((totais.faturamento / meta) * 100, 0)} da meta).`;
  } else if (!resultado.atingivel) {
    plano = `Com os indicadores que você travou, a meta não fecha: mesmo melhorando todos os outros ${resultado.fator}× o faturamento chegaria a ${fmtBrl(totais.faturamento)}. Destrave algum indicador ou reduza a meta.`;
  } else if (resultado.livres <= 0) {
    plano = "Todos os indicadores estão travados por você — destrave algum para o painel ajustar e fechar a meta.";
  } else if (numFixos === 0) {
    plano = `Caminho mais equilibrado: melhorar cada um dos 12 indicadores abaixo em cerca de ${fmtNum((resultado.fator - 1) * 100, 1)}%. Mexa em qualquer um — os outros se ajustam sozinhos para a conta continuar fechando em ${fmtBrl(meta)}.`;
  } else {
    const pct = (resultado.fator - 1) * 100;
    plano = pct >= 0
      ? `Com ${numFixos} indicador(es) travado(s) por você, todos os outros precisam subir cerca de ${fmtNum(pct, 1)}% para fechar ${fmtBrl(meta)}.`
      : `Com ${numFixos} indicador(es) travado(s) por você, os outros podem até cair cerca de ${fmtNum(-pct, 1)}% e a meta de ${fmtBrl(meta)} ainda fecha.`;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 space-y-1">
        <p><strong>Como usar:</strong> mexa no valor (ou no controle deslizante) de qualquer indicador — ele fica travado <Lock className="inline w-3 h-3 -mt-0.5 text-amber-600" /> no que você escolheu e os demais se ajustam sozinhos para o faturamento continuar fechando a meta. Clique no cadeado para destravar.</p>
        <p className="font-semibold">{plano}</p>
      </div>

      <div className="sticky top-0 z-20 bg-white rounded-xl border border-slate-200 shadow-md p-3 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Ficha
          rotulo="Faturamento por mês"
          valor={fmtBrl(totais.faturamento)}
          destaque={fechou ? "ok" : "falta"}
          sub={fechou ? <>fecha a meta ✓ · hoje {brlCurto(real12)}</> : <>faltam {brlCurto(meta - totais.faturamento)} · hoje {brlCurto(real12)}</>}
        />
        <Ficha rotulo="Pedidos por mês" valor={fmtNum(totais.vendas, 0)} sub={<>hoje {fmtNum(totaisBase.vendas, 0)} · <Variacao valor={totais.vendas} referencia={totaisBase.vendas} /></>} />
        <Ficha rotulo="Ticket médio por pedido" valor={fmtBrl(totais.ticketMedio)} sub={<>hoje {fmtBrl(totaisBase.ticketMedio)} · <Variacao valor={totais.ticketMedio} referencia={totaisBase.ticketMedio} /></>} />
        <Ficha
          rotulo="Orçamentos necessários por mês"
          valor={funil.leads !== null ? `~${fmtNum(funil.leads, 0)}` : "—"}
          sub={funil.leads !== null && data.funil.leadsPorMes !== null && funil.conversaoPct !== null
            ? <>hoje ~{fmtNum(data.funil.leadsPorMes, 0)} · conversão {fmtNum(funil.conversaoPct, 1)}% (hoje {fmtNum(data.funil.conversaoPct, 1)}%)</>
            : "sem orçamentos suficientes"}
        />
        <Ficha
          rotulo={lucro !== null ? "Lucro estimado por mês" : "Contribuição por mês"}
          valor={brlCurto(lucro !== null ? lucro : contribuicao)}
          sub={lucro !== null ? <>contribuição {brlCurto(contribuicao)} (margem {fmtNum(margemPct, 1)}%)</> : <>margem de {fmtNum(margemPct, 1)}%</>}
        />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <Switch checked={modoAuto} onCheckedChange={setModoAuto} />
            Ajustar automaticamente os outros indicadores para bater a meta
          </label>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>Vendas a mais vêm de:</span>
            <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
              {OPCOES_FUNIL.map(o => (
                <button
                  key={o.peso}
                  type="button"
                  title={o.dica}
                  onClick={() => setPesoConversao(o.peso)}
                  className={`px-2 py-1 text-[11px] ${pesoConversao === o.peso ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  {o.rotulo}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            Margem de contribuição
            <CampoNumero valor={margemPct} casas={1} onChange={setMargemPct} ariaLabel="Margem de contribuição" className="h-7 w-16 text-right text-xs" />%
          </label>
        </div>
        <button
          type="button"
          onClick={() => setFixos({})}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-md px-2.5 py-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {modoAuto ? "Voltar ao caminho equilibrado" : "Voltar aos números de hoje"}
        </button>
      </div>

      <div className="space-y-4">
        {SEGMENTOS.map(seg => {
          const b = base.cenario[seg];
          const r = recente.cenario[seg];
          const c = cenario[seg];
          const fatSeg = totais.porSegmento[seg].faturamento;
          const fatBase = totaisBase.porSegmento[seg].faturamento;
          return (
            <div key={seg} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-3 border-b border-slate-100">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{TEXTO_SEGMENTO[seg].titulo}</h4>
                    <p className="text-[11px] text-slate-500">{TEXTO_SEGMENTO[seg].descricao}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-blue-700">{fmtBrl(fatSeg)}<span className="text-[11px] font-normal text-slate-400">/mês</span></p>
                    <p className="text-[11px] text-slate-400">{totais.faturamento > 0 ? fmtPct((fatSeg / totais.faturamento) * 100, 0) : "—"} do total · hoje {fmtBrl(fatBase)}</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  {fmtNum(c.clientes, 1)} gráficas × {fmtNum(c.pedidosPorCliente, 2)} pedidos × R$ {fmtNum(c.ticket, 0)} por pedido = {fmtBrl(fatSeg)}
                </p>
              </div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                {CAMPOS_ALAVANCA.map(campo => {
                  const id = idAlavanca(seg, campo);
                  return (
                    <LinhaAlavanca
                      key={id}
                      campo={campo}
                      base={b[campo]}
                      recente={r[campo]}
                      valor={c[campo as keyof Alavanca]}
                      fixado={id in fixos}
                      modoAuto={modoAuto}
                      onChange={v => definir(id, v)}
                      onAlternarTrava={() => alternarTrava(id, c[campo])}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
