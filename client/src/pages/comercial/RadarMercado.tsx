import { useState } from "react";
import { trpc } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Radar, RefreshCw, AlertTriangle, ExternalLink, Settings, X } from "lucide-react";

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${className}`}>{children}</span>;
}

const TIPO_EVENTO_LABEL: Record<string, string> = {
  inauguracao: "Inauguração", reforma: "Reforma", expansao: "Expansão",
  edital: "Edital", concorrente: "Concorrente", outro: "Outro",
};

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo", qualificando: "Qualificando", oportunidade: "Oportunidade",
  associado_cliente: "Já é cliente", descartado: "Descartado", expirado: "Expirado",
};

function TagInput({ label, valores, onChange }: { label: string; valores: string[]; onChange: (v: string[]) => void }) {
  const [novo, setNovo] = useState("");
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</label>
      <div className="flex flex-wrap gap-1.5 mt-1 mb-1.5">
        {valores.map(v => (
          <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[11px]">
            {v}
            <button onClick={() => onChange(valores.filter(x => x !== v))}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={novo} onChange={e => setNovo(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && novo.trim()) { onChange([...valores, novo.trim()]); setNovo(""); } }}
          placeholder="Adicionar e pressionar Enter"
          className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5"
        />
      </div>
    </div>
  );
}

function ConfigRadar({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.radarMercado.getConfig.useQuery();
  const [regioes, setRegioes] = useState<string[]>([]);
  const [segmentos, setSegmentos] = useState<string[]>([]);
  const [termos, setTermos] = useState<string[]>([]);
  const [exclusoes, setExclusoes] = useState<string[]>([]);
  const [carregado, setCarregado] = useState(false);
  if (data && !carregado) {
    setRegioes(data.regioes); setSegmentos(data.segmentosAlvo); setTermos(data.termosBusca); setExclusoes(data.exclusoes);
    setCarregado(true);
  }
  const salvarMut = trpc.radarMercado.atualizarConfig.useMutation({
    onSuccess: () => { utils.radarMercado.getConfig.invalidate(); onClose(); },
  });

  if (isLoading) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">Configuração do Radar</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
      </div>
      <TagInput label="UFs (regiões)" valores={regioes} onChange={setRegioes} />
      <TagInput label="Segmentos-alvo" valores={segmentos} onChange={setSegmentos} />
      <TagInput label="Termos de busca" valores={termos} onChange={setTermos} />
      <TagInput label="Exclusões (domínios/termos a ignorar)" valores={exclusoes} onChange={setExclusoes} />
      <Button
        onClick={() => salvarMut.mutate({ regioes, segmentosAlvo: segmentos, termosBusca: termos, exclusoes })}
        disabled={salvarMut.isPending}
        className="w-full"
      >
        Salvar configuração
      </Button>
    </div>
  );
}

export default function RadarMercado() {
  const [showConfig, setShowConfig] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("");
  const utils = trpc.useUtils();
  const { data: configurada } = trpc.radarMercado.buscaConfigurada.useQuery();
  const { data: sinais, isLoading } = trpc.radarMercado.listarSinais.useQuery({ status: (filtroStatus as any) || undefined });
  const buscarMut = trpc.radarMercado.buscarSinais.useMutation({
    onSuccess: () => utils.radarMercado.listarSinais.invalidate(),
  });
  const atualizarMut = trpc.radarMercado.atualizarSinal.useMutation({
    onSuccess: () => utils.radarMercado.listarSinais.invalidate(),
  });

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        title="Radar de Mercado"
        description="Sinais externos verificáveis de novas oportunidades — gráficas e empresas de comunicação visual nas regiões Centro-Oeste, Sudeste e Sul."
        icon={Radar}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowConfig(v => !v)} className="gap-1.5"><Settings className="w-3.5 h-3.5" /> Configurar</Button>
            <Button size="sm" onClick={() => buscarMut.mutate()} disabled={buscarMut.isPending || configurada?.configurada === false} className="gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${buscarMut.isPending ? "animate-spin" : ""}`} /> {buscarMut.isPending ? "Buscando..." : "Buscar sinais agora"}
            </Button>
          </div>
        }
      />

      {configurada?.configurada === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Busca automática ainda não configurada — falta GOOGLE_SEARCH_API_KEY/GOOGLE_SEARCH_CX no servidor. A configuração de região/segmentos/termos já pode ser ajustada abaixo, mas nenhum sinal será coletado até a chave ser adicionada.
        </div>
      )}

      {buscarMut.data && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
          {buscarMut.data.resultadosBrutos} resultados brutos · {buscarMut.data.novosResultados} novos analisados · {buscarMut.data.salvos} salvos como sinal · {buscarMut.data.ignorados} descartados (irrelevantes ou excluídos).
          {buscarMut.data.erros.length > 0 && <p className="mt-1 text-red-600">{buscarMut.data.erros.length} erro(s): {buscarMut.data.erros.slice(0, 2).join(" | ")}</p>}
        </div>
      )}
      {buscarMut.isError && <p className="text-xs text-red-600">{(buscarMut.error as any)?.message}</p>}

      {showConfig && <ConfigRadar onClose={() => setShowConfig(false)} />}

      <div className="flex items-center gap-2">
        {["", "novo", "qualificando", "oportunidade", "associado_cliente", "descartado"].map(s => (
          <button
            key={s || "todos"}
            onClick={() => setFiltroStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              filtroStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
            }`}
          >
            {s === "" ? "Todos" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {isLoading && <div className="bg-white rounded-xl border border-slate-200 h-40 animate-pulse" />}
      {!isLoading && (!sinais || sinais.length === 0) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Radar /></EmptyMedia>
              <EmptyTitle>Nenhum sinal coletado ainda</EmptyTitle>
              <EmptyDescription>Clique em "Buscar sinais agora" (exige a API configurada) ou ajuste a configuração.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
      <div className="space-y-3">
        {(sinais ?? []).map(s => (
          <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge className={s.nivelConfianca === "confirmado" ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"}>
                    {s.nivelConfianca === "confirmado" ? "Confirmado" : "Inferência"}
                  </Badge>
                  <Badge className="bg-purple-50 text-purple-700 border-purple-200">{TIPO_EVENTO_LABEL[s.tipoEvento ?? "outro"] ?? s.tipoEvento}</Badge>
                  {s.localizacaoTexto && <span className="text-[11px] text-slate-400">{s.localizacaoTexto}</span>}
                </div>
                <p className="text-sm font-bold text-slate-800">{s.empresa}</p>
                <p className="text-xs text-slate-500 mt-1">{s.evidenciaTrecho}</p>
                {s.relacaoProdutos && <p className="text-xs text-blue-600 mt-1">Relação: {s.relacaoProdutos}</p>}
                <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-600 mt-1.5">
                  <ExternalLink className="w-3 h-3" /> {s.publicador} · coletado em {fmtDateTime(s.dataColeta)}
                </a>
              </div>
              <select
                value={s.status}
                onChange={e => atualizarMut.mutate({ id: s.id, status: e.target.value as any })}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
              >
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
