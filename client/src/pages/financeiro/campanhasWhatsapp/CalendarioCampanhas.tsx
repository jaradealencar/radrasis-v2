import { useMemo, useState } from "react";
import { CalendarCheck2, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { MESES } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { CATEGORIA_CAMPANHA_LABEL, formatarDataBr, hojeCampoGrande, somarDias } from "@shared/campanhas-whatsapp";
import { SEMAFORO_ESTILO, type EventoCalendario } from "./comuns";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_CHIPS_MES = 3;

const diaDaSemana = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const inicioDaSemana = (iso: string) => somarDias(iso, -diaDaSemana(iso));
const inicioDoMes = (iso: string) => `${iso.slice(0, 8)}01`;
function fimDoMes(iso: string): string {
  const ano = Number(iso.slice(0, 4));
  const mes = Number(iso.slice(5, 7));
  return somarDias(mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`, -1);
}

function Chip({ e }: { e: EventoCalendario }) {
  const executado = e.evento === "executado";
  const estilo = executado
    ? "bg-emerald-600 text-white border-emerald-600"
    : `border-dashed ${SEMAFORO_ESTILO[e.semaforo ?? "verde"].chip}`;
  // A contagem fica fora do trecho que trunca: em célula estreita o que corta é o nome, nunca o número.
  return (
    <div
      className={`flex w-full min-w-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-tight ${estilo}`}
      title={`${executado ? "Executado" : "Previsto"}: ${e.nome}${e.quantidade != null ? ` · ${e.quantidade}` : ""}`}
    >
      {executado ? <CalendarCheck2 size={10} className="shrink-0" /> : <CalendarClock size={10} className="shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{e.nome}</span>
      {e.quantidade != null && <span className="shrink-0 font-semibold">{e.quantidade}</span>}
    </div>
  );
}

function descricaoEvento(e: EventoCalendario): string {
  if (e.evento === "executado") return `Executado — ${e.quantidade ?? 0} contatos enviados`;
  if (e.tipo === "gatilho_venda") return `Previsto — ${e.quantidade ?? 0} venda(s) com prazo neste dia`;
  return "Previsto — disparo recorrente";
}

export default function CalendarioCampanhas() {
  const hoje = hojeCampoGrande();
  const [ancora, setAncora] = useState(hoje);
  const [modo, setModo] = useState<"mes" | "semana">("mes");
  const [diaAberto, setDiaAberto] = useState<string | null>(null);

  const { inicio, fim } = useMemo(() => {
    if (modo === "semana") {
      const ini = inicioDaSemana(ancora);
      return { inicio: ini, fim: somarDias(ini, 6) };
    }
    return { inicio: inicioDaSemana(inicioDoMes(ancora)), fim: somarDias(inicioDaSemana(fimDoMes(ancora)), 6) };
  }, [ancora, modo]);

  const { data, isFetching, isError, error } = trpc.campanhasWhatsapp.calendario.useQuery(
    { inicio, fim },
    { placeholderData: prev => prev },
  );

  const porDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>();
    for (const e of data?.eventos ?? []) {
      if (!mapa.has(e.data)) mapa.set(e.data, []);
      mapa.get(e.data)!.push(e);
    }
    return mapa;
  }, [data]);

  const dias = useMemo(() => {
    const lista: string[] = [];
    for (let d = inicio; d <= fim; d = somarDias(d, 1)) lista.push(d);
    return lista;
  }, [inicio, fim]);

  const titulo = modo === "mes"
    ? `${MESES[Number(ancora.slice(5, 7)) - 1]} de ${ancora.slice(0, 4)}`
    : `${formatarDataBr(inicio)} a ${formatarDataBr(fim)}`;

  const navegar = (sentido: -1 | 1) => {
    if (modo === "semana") setAncora(somarDias(ancora, 7 * sentido));
    else setAncora(sentido < 0 ? somarDias(inicioDoMes(ancora), -1) : somarDias(fimDoMes(ancora), 1));
  };

  const eventosDoDia = diaAberto ? porDia.get(diaAberto) ?? [] : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="size-8" onClick={() => navegar(-1)} aria-label="Período anterior"><ChevronLeft size={16} /></Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => navegar(1)} aria-label="Próximo período"><ChevronRight size={16} /></Button>
          <Button variant="outline" size="sm" onClick={() => setAncora(hoje)}>Hoje</Button>
          <h3 className="ml-2 text-base font-semibold text-slate-800">{titulo}</h3>
          {isFetching && <Spinner />}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={modo === "mes" ? "default" : "outline"} onClick={() => setModo("mes")}>Mês</Button>
          <Button size="sm" variant={modo === "semana" ? "default" : "outline"} onClick={() => setModo("semana")}>Semana</Button>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-emerald-600" /> Executado</span>
        <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm border border-dashed border-red-400 bg-red-50" /> Previsto atrasado / hoje</span>
        <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm border border-dashed border-amber-400 bg-amber-50" /> Previsto em até 3 dias</span>
        <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm border border-dashed border-emerald-400 bg-emerald-50" /> Previsto mais adiante</span>
      </div>

      {isError && <p className="text-sm text-red-700">Não consegui carregar o calendário: {error.message}</p>}

      <div className="overflow-x-auto">
        <div className="min-w-[720px] rounded-lg border overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 border-b text-center text-[11px] font-medium text-muted-foreground">
            {DIAS_SEMANA.map(d => <div key={d} className="py-1.5">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {dias.map(dia => {
              const eventos = porDia.get(dia) ?? [];
              const foraDoMes = modo === "mes" && dia.slice(0, 7) !== ancora.slice(0, 7);
              const ehHoje = dia === hoje;
              const limite = modo === "mes" ? MAX_CHIPS_MES : eventos.length;
              return (
                <button
                  key={dia}
                  type="button"
                  disabled={eventos.length === 0}
                  onClick={() => setDiaAberto(dia)}
                  className={`min-w-0 overflow-hidden text-left border-b border-r p-1.5 flex flex-col gap-1 align-top transition-colors
                    ${modo === "mes" ? "min-h-24" : "min-h-56"}
                    ${foraDoMes ? "bg-slate-50/70" : "bg-white"}
                    ${eventos.length ? "hover:bg-blue-50/40 cursor-pointer" : "cursor-default"}`}
                >
                  <span className={`text-xs font-medium self-start rounded-full px-1.5
                    ${ehHoje ? "bg-blue-600 text-white" : foraDoMes ? "text-slate-400" : "text-slate-700"}`}>
                    {Number(dia.slice(8, 10))}
                  </span>
                  {eventos.slice(0, limite).map((e, i) => <Chip key={`${e.campanhaId}-${e.evento}-${i}`} e={e} />)}
                  {eventos.length > limite && <span className="text-[11px] text-blue-700">+{eventos.length - limite} mais</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={!!diaAberto} onOpenChange={v => { if (!v) setDiaAberto(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{formatarDataBr(diaAberto)}</DialogTitle>
            <DialogDescription>{eventosDoDia.length} evento(s) de campanhas neste dia</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {eventosDoDia.map((e, i) => (
              <li key={`${e.campanhaId}-${e.evento}-${i}`} className="rounded-lg border p-3 space-y-1">
                <Chip e={e} />
                <p className="text-sm">{descricaoEvento(e)}</p>
                <p className="text-[11px] text-muted-foreground">{CATEGORIA_CAMPANHA_LABEL[e.categoria]}</p>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
