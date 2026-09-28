import { useMemo, useState } from "react";
import { CalendarCheck2, CalendarClock, CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { MESES } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatarDataBr, hojeCampoGrande, somarDias } from "@shared/campanhas-whatsapp";
import AgendarCampanhaDialog from "./AgendarCampanhaDialog";
import { AgendamentoItem, SEMAFORO_ESTILO, type EventoCalendario } from "./comuns";

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
  const [agendarNoDia, setAgendarNoDia] = useState<string | null>(null);
  const { data: categorias } = trpc.campanhasWhatsapp.listarCategorias.useQuery();
  const labelCategoria = (chave: string) => categorias?.find(c => c.chave === chave)?.label ?? chave;

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
  const { data: agendamentos } = trpc.campanhasWhatsapp.listarAgendamentos.useQuery(
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

  const agendamentosPorDia = useMemo(() => {
    const mapa = new Map<string, NonNullable<typeof agendamentos>>();
    for (const a of agendamentos ?? []) {
      if (!mapa.has(a.dataAgendada)) mapa.set(a.dataAgendada, []);
      mapa.get(a.dataAgendada)!.push(a);
    }
    return mapa;
  }, [agendamentos]);

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
  const agendamentosDoDia = diaAberto ? agendamentosPorDia.get(diaAberto) ?? [] : [];

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
        <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-blue-100 border border-blue-300" /> Agendado (Planner)</span>
      </div>
      <p className="text-[11px] text-muted-foreground">Clique em qualquer dia para ver os eventos e agendar uma campanha.</p>

      {isError && <p className="text-sm text-red-700">Não consegui carregar o calendário: {error.message}</p>}

      <div className="overflow-x-auto">
        <div className="min-w-[720px] rounded-lg border overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 border-b text-center text-[11px] font-medium text-muted-foreground">
            {DIAS_SEMANA.map(d => <div key={d} className="py-1.5">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {dias.map(dia => {
              const eventos = porDia.get(dia) ?? [];
              const agendamentosDia = agendamentosPorDia.get(dia) ?? [];
              const totalChips = eventos.length + agendamentosDia.length;
              const foraDoMes = modo === "mes" && dia.slice(0, 7) !== ancora.slice(0, 7);
              const ehHoje = dia === hoje;
              const limite = modo === "mes" ? MAX_CHIPS_MES : totalChips;
              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => setDiaAberto(dia)}
                  className={`min-w-0 overflow-hidden text-left border-b border-r p-1.5 flex flex-col gap-1 align-top transition-colors cursor-pointer
                    ${modo === "mes" ? "min-h-24" : "min-h-56"}
                    ${foraDoMes ? "bg-slate-50/70" : "bg-white"}
                    hover:bg-blue-50/40`}
                >
                  <span className={`text-xs font-medium self-start rounded-full px-1.5
                    ${ehHoje ? "bg-blue-600 text-white" : foraDoMes ? "text-slate-400" : "text-slate-700"}`}>
                    {Number(dia.slice(8, 10))}
                  </span>
                  {eventos.slice(0, limite).map((e, i) => <Chip key={`ev-${e.campanhaId}-${e.evento}-${i}`} e={e} />)}
                  {agendamentosDia.slice(0, Math.max(0, limite - eventos.length)).map(a => (
                    <div
                      key={`ag-${a.id}`}
                      className="flex w-full min-w-0 items-center gap-1 rounded border border-blue-300 bg-blue-100 px-1.5 py-0.5 text-[11px] leading-tight text-blue-800"
                      title={`Agendado: ${a.nome}`}
                    >
                      <CalendarPlus size={10} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                    </div>
                  ))}
                  {totalChips > limite && <span className="text-[11px] text-blue-700">+{totalChips - limite} mais</span>}
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
            <DialogDescription>
              {eventosDoDia.length} evento(s) de campanhas · {agendamentosDoDia.length} agendamento(s) do Planner
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {agendamentosDoDia.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600">Agendado (Planner)</p>
                {agendamentosDoDia.map(a => <AgendamentoItem key={a.id} agendamento={a} mostrarNome />)}
              </div>
            )}

            {eventosDoDia.length > 0 && (
              <div className="space-y-1.5">
                {agendamentosDoDia.length > 0 && <p className="text-xs font-medium text-slate-600">Previsão da cadência / disparos</p>}
                <ul className="space-y-2">
                  {eventosDoDia.map((e, i) => (
                    <li key={`${e.campanhaId}-${e.evento}-${i}`} className="rounded-lg border p-3 space-y-1">
                      <Chip e={e} />
                      <p className="text-sm">{descricaoEvento(e)}</p>
                      <p className="text-[11px] text-muted-foreground">{labelCategoria(e.categoria)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {eventosDoDia.length === 0 && agendamentosDoDia.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum evento ou agendamento neste dia.</p>
            )}

            <Button
              variant="outline" size="sm" className="gap-1.5 w-full"
              onClick={() => { setAgendarNoDia(diaAberto); setDiaAberto(null); }}
            >
              <CalendarPlus size={14} /> Agendar campanha para este dia
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AgendarCampanhaDialog
        open={!!agendarNoDia} onOpenChange={v => { if (!v) setAgendarNoDia(null); }}
        dataInicial={agendarNoDia ?? undefined}
      />
    </div>
  );
}
