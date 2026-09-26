import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { resolverMeta, aplicarFator, totaisCenario, type Fixos, type ResultadoMeta } from "@shared/meta-faturamento";
import { CampoNumero, brlCurto, fmtNum } from "./painelMeta/comuns";
import { META_PADRAO_1, META_PADRAO_2, type VistaDestino } from "./painelMeta/tipos";
import Diagnostico from "./painelMeta/Diagnostico";
import PlanoDeAcao from "./painelMeta/PlanoDeAcao";
import Simulador from "./painelMeta/Simulador";
import Comparativo from "./painelMeta/Comparativo";
import Projecao from "./painelMeta/Projecao";

type Aba = "diagnostico" | "plano" | "simulador" | "metas" | "projecao";

const ABAS: Array<{ id: Aba; rotulo: string; dica: string }> = [
  { id: "diagnostico", rotulo: "1. Onde estou", dica: "Diagnóstico do faturamento, do lucro e da métrica que mais importa" },
  { id: "plano", rotulo: "2. O que fazer", dica: "Ações priorizadas por ganho e esforço, com metas semanais" },
  { id: "simulador", rotulo: "3. Simulador", dica: "Mude um indicador e veja os outros se ajustarem para bater a meta" },
  { id: "metas", rotulo: "4. Metas comparadas", dica: "Hoje × R$ 430 mil × R$ 500 mil, indicador por indicador" },
  { id: "projecao", rotulo: "5. Próximos 12 meses", dica: "Projeção com faixa de erro e a vida de uma gráfica nova" },
];

const TODOS_DESTINOS: VistaDestino[] = ["clientes", "fila", "retencao", "funil", "crescimento"];

export default function PainelMeta({ onIrPara, destinosDisponiveis = TODOS_DESTINOS }: { onIrPara?: (v: VistaDestino) => void; destinosDisponiveis?: VistaDestino[] }) {
  const { data, isLoading, isError } = trpc.performanceComercial.getPainelMeta.useQuery();
  const [aba, setAba] = useState<Aba>("diagnostico");
  const [meta, setMeta] = useState(META_PADRAO_1);
  const [meta2, setMeta2] = useState(META_PADRAO_2);
  const [fixos, setFixos] = useState<Fixos>({});
  const [modoAuto, setModoAuto] = useState(true);
  const [pesoConversao, setPesoConversao] = useState(0.5);
  const [sazonal, setSazonal] = useState(false);
  const [margemEditada, setMargemEditada] = useState<number | null>(null);

  const metaValida = Math.max(1, meta);
  const meta2Valida = Math.max(1, meta2);

  const resultado: ResultadoMeta | null = useMemo(() => {
    if (!data || !data.dadosSuficientes) return null;
    const base = data.media12m.cenario;
    if (modoAuto) return resolverMeta(base, fixos, metaValida);
    const cenario = aplicarFator(base, fixos, 1);
    const totais = totaisCenario(cenario);
    return { cenario, totais, fator: 1, livres: 12 - Object.keys(fixos).length, atingivel: totais.faturamento >= metaValida };
  }, [data, fixos, modoAuto, metaValida]);

  if (isLoading) return <div className="bg-white rounded-xl border border-slate-200 h-72 animate-pulse" />;
  if (isError || !data) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">Não foi possível carregar o painel da meta agora. Tente atualizar a página.</div>;
  }
  if (!data.dadosSuficientes || !resultado) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        Ainda não há 12 meses fechados de histórico de pedidos para medir seus indicadores. Importe o histórico (ver fluxo mensal de import) e volte aqui.
      </div>
    );
  }

  const real12 = data.media12m.faturamento;
  const falta = metaValida - real12;
  const abaixo = falta > 0;
  const mesesAcima = data.historico.filter(h => h.faturamento >= metaValida).length;
  const margemPct = margemEditada ?? data.margem.media12mPct ?? 0;
  const irPara = onIrPara ?? (() => undefined);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-base font-bold text-slate-800">Painel da meta: onde estou e o que fazer para crescer</h3>
            <p className="text-xs text-slate-500">Números reais do seu ERP e do Radrasis; cada recomendação mostra o dado que a sustenta.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {data.metaSistema && Math.round(data.metaSistema.faturamento) !== Math.round(metaValida) && (
            <button
              type="button"
              onClick={() => setMeta(Math.round(data.metaSistema!.faturamento))}
              className="text-[11px] text-blue-700 border border-blue-200 bg-blue-50 rounded-md px-2 py-1 hover:bg-blue-100"
              title={`Fonte: ${data.metaSistema.fonte === "metas_comerciais" ? "Metas Comerciais" : "metas do CRM"} de ${String(data.metaSistema.mes).padStart(2, "0")}/${data.metaSistema.ano}`}
            >
              Usar a meta cadastrada no sistema: {brlCurto(data.metaSistema.faturamento)}
            </button>
          )}
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Minha meta (R$/mês)
            <CampoNumero valor={metaValida} casas={0} onChange={setMeta} ariaLabel="Minha meta por mês" className="h-9 w-32 text-right text-sm font-bold" />
          </label>
        </div>
      </div>

      <div className={`rounded-xl border px-4 py-3 ${abaixo ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
        <p className={`text-sm font-bold ${abaixo ? "text-amber-900" : "text-emerald-900"}`}>
          {abaixo
            ? `Hoje você fatura em média ${brlCurto(real12)} por mês — ${brlCurto(falta)} (${fmtNum((falta / real12) * 100, 1)}%) abaixo da meta de ${brlCurto(metaValida)}.`
            : `Você já está acima da meta: média de ${brlCurto(real12)} por mês (${brlCurto(-falta)} acima de ${brlCurto(metaValida)}).`}
        </p>
        <p className="text-xs text-slate-700 mt-0.5">
          Média dos últimos 12 meses fechados; você bateu a meta em <strong>{mesesAcima} dos 12</strong> meses. O mês isolado oscila muito — olhe sempre a média.
        </p>
      </div>

      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto" role="tablist">
        {ABAS.map(a => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            title={a.dica}
            onClick={() => setAba(a.id)}
            className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${aba === a.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"}`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === "diagnostico" && <Diagnostico data={data} meta={metaValida} meta2={meta2Valida} />}
      {aba === "plano" && <PlanoDeAcao data={data} meta={metaValida} resultado={resultado} pesoConversao={pesoConversao} onIrPara={irPara} destinosDisponiveis={destinosDisponiveis} />}
      {aba === "simulador" && (
        <Simulador
          data={data}
          meta={metaValida}
          fixos={fixos}
          setFixos={setFixos}
          modoAuto={modoAuto}
          setModoAuto={setModoAuto}
          pesoConversao={pesoConversao}
          setPesoConversao={setPesoConversao}
          resultado={resultado}
          margemPct={margemPct}
          setMargemPct={setMargemEditada}
        />
      )}
      {aba === "metas" && (
        <Comparativo
          data={data}
          meta1={metaValida}
          meta2={meta2Valida}
          setMeta1={setMeta}
          setMeta2={setMeta2}
          pesoConversao={pesoConversao}
          setPesoConversao={setPesoConversao}
          margemPct={margemPct}
        />
      )}
      {aba === "projecao" && <Projecao data={data} meta={metaValida} resultado={resultado} sazonal={sazonal} setSazonal={setSazonal} margemPct={margemPct} />}
    </div>
  );
}
