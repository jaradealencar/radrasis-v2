import { useEffect, useState } from "react";
import { CalendarClock, Save } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { formatarDataBr, hojeCampoGrande } from "@shared/campanhas-whatsapp";

const statusLabel: Record<string, string> = {
  agendado: "Agendado",
  pendente_revisao: "Pendente de revisão",
  em_andamento: "Em andamento",
  pausado: "Pausado",
  concluido: "Concluído",
};

export default function ProgramacaoCadenciaPanel({ campanhaId, aberto }: { campanhaId: number; aberto: boolean }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.campanhasWhatsapp.obterProgramacaoFila.useQuery(
    { campanhaId }, { enabled: aberto, retry: false },
  );
  const [quantidadeEnvios, setQuantidadeEnvios] = useState("6");
  const [dataInicial, setDataInicial] = useState(hojeCampoGrande());
  const [intervaloDias, setIntervaloDias] = useState("30");
  const [pausaLotesMinutos, setPausaLotesMinutos] = useState("5");
  const [janelaEnvioAtiva, setJanelaEnvioAtiva] = useState(false);
  const [janelaHoraInicio, setJanelaHoraInicio] = useState("09:00");
  const [janelaHoraFim, setJanelaHoraFim] = useState("18:00");
  const [janelaDiasSemana, setJanelaDiasSemana] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    if (!data) return;
    setQuantidadeEnvios(String(data.fila?.quantidadeEnvios ?? 6));
    setDataInicial(String(data.fila?.dataInicial ?? hojeCampoGrande()).slice(0, 10));
    setIntervaloDias(String(data.fila?.intervaloDias ?? 30));
    setPausaLotesMinutos(String(data.fila?.pausaLotesMinutos ?? 5));
    setJanelaEnvioAtiva(data.fila?.janelaEnvioAtiva ?? false);
    setJanelaHoraInicio(data.fila?.janelaHoraInicio ?? "09:00");
    setJanelaHoraFim(data.fila?.janelaHoraFim ?? "18:00");
    setJanelaDiasSemana(data.fila?.janelaDiasSemana ?? [1, 2, 3, 4, 5]);
  }, [data]);

  const atualizar = async () => Promise.all([
    utils.campanhasWhatsapp.obterProgramacaoFila.invalidate({ campanhaId }),
    utils.campanhasWhatsapp.listarFilasProgramadas.invalidate(),
  ]);
  const salvar = trpc.campanhasWhatsapp.salvarProgramacaoFila.useMutation({
    onSuccess: async r => { toast.success(r.ativo ? r.calendarioAlterado === false ? "Controles da fila atualizados." : `Calendário salvo com ${r.datas?.length ?? 0} datas.` : "Programação desativada."); await atualizar(); },
    onError: e => toast.error(e.message),
  });
  const temCadencia = !!data?.fila?.ativo;
  const validar = () => {
    const n = Number(quantidadeEnvios);
    const intervalo = Number(intervaloDias);
    const pausa = Number(pausaLotesMinutos);
    if (![4, 5, 6].includes(n)) return "Escolha 4, 5 ou 6 envios.";
    if (!dataInicial) return "Informe a data inicial.";
    if (!Number.isInteger(intervalo) || intervalo < 1 || intervalo > 730) return "O intervalo deve ser de 1 a 730 dias.";
    if (!Number.isInteger(pausa) || pausa < 1 || pausa > 1440) return "A pausa deve ser de 1 a 1.440 minutos.";
    if (janelaEnvioAtiva && janelaHoraInicio >= janelaHoraFim) return "O fim da janela precisa ser posterior ao início.";
    if (janelaEnvioAtiva && janelaDiasSemana.length === 0) return "Escolha ao menos um dia para a janela de envio.";
    return null;
  };
  const salvarAtivo = () => {
    const erro = validar();
    if (erro) { toast.error(erro); return; }
    salvar.mutate({ campanhaId, ativo: true, quantidadeEnvios: Number(quantidadeEnvios) as 4 | 5 | 6, dataInicial, intervaloDias: Number(intervaloDias), pausaLotesMinutos: Number(pausaLotesMinutos), janelaEnvioAtiva, janelaHoraInicio, janelaHoraFim, janelaDiasSemana });
  };
  const desativar = () => {
    salvar.mutate({ campanhaId, ativo: false, quantidadeEnvios: Number(quantidadeEnvios) as 4 | 5 | 6, dataInicial, intervaloDias: Number(intervaloDias), pausaLotesMinutos: Number(pausaLotesMinutos), janelaEnvioAtiva, janelaHoraInicio, janelaHoraFim, janelaDiasSemana });
  };
  const diasDaSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const alternarDia = (dia: number) => setJanelaDiasSemana(atual => atual.includes(dia) ? atual.filter(item => item !== dia) : [...atual, dia].sort());

  return (
    <section className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <div className="flex items-start gap-2">
        <CalendarClock size={18} className="mt-0.5 text-blue-700" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Calendário de envios e fila em lotes</h3>
          <p className="text-xs text-muted-foreground">Ative esta opção por campanha. O intervalo define as datas; a pausa controla os lotes do mesmo envio.</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${temCadencia ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
          {temCadencia ? "Ativo" : "Desativado"}
        </span>
      </div>

      {isLoading ? <div className="flex justify-center py-2"><Spinner /></div> : <>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor={`fila-qtd-${campanhaId}`}>Quantidade de envios</Label>
            <select id={`fila-qtd-${campanhaId}`} className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={quantidadeEnvios} onChange={e => setQuantidadeEnvios(e.target.value)}>
              {[4, 5, 6].map(n => <option key={n} value={n}>{n} envios</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label htmlFor={`fila-data-${campanhaId}`}>Data inicial</Label>
            <Input id={`fila-data-${campanhaId}`} type="date" value={dataInicial} onChange={e => setDataInicial(e.target.value)} />
          </div>
          <div className="space-y-1"><Label htmlFor={`fila-intervalo-${campanhaId}`}>Intervalo entre envios (dias)</Label>
            <Input id={`fila-intervalo-${campanhaId}`} type="number" min={1} max={730} value={intervaloDias} onChange={e => setIntervaloDias(e.target.value)} />
          </div>
          <div className="space-y-1"><Label htmlFor={`fila-pausa-${campanhaId}`}>Pausa entre lotes (minutos)</Label>
            <Input id={`fila-pausa-${campanhaId}`} type="number" min={1} max={1440} value={pausaLotesMinutos} onChange={e => setPausaLotesMinutos(e.target.value)} />
          </div>
        </div>
        <fieldset className="space-y-3 rounded-md border bg-white p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={janelaEnvioAtiva} onChange={e => setJanelaEnvioAtiva(e.target.checked)} />
            Restringir envios a dias e horários
          </label>
          {janelaEnvioAtiva && <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor={`fila-janela-inicio-${campanhaId}`}>Início</Label>
                <Input id={`fila-janela-inicio-${campanhaId}`} type="time" value={janelaHoraInicio} onChange={e => setJanelaHoraInicio(e.target.value)} />
              </div>
              <div className="space-y-1"><Label htmlFor={`fila-janela-fim-${campanhaId}`}>Fim</Label>
                <Input id={`fila-janela-fim-${campanhaId}`} type="time" value={janelaHoraFim} onChange={e => setJanelaHoraFim(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="Dias permitidos">
              {diasDaSemana.map((nome, dia) => <Button key={dia} type="button" size="sm" variant={janelaDiasSemana.includes(dia) ? "default" : "outline"} aria-pressed={janelaDiasSemana.includes(dia)} onClick={() => alternarDia(dia)}>{nome}</Button>)}
            </div>
            <p className="text-[11px] text-muted-foreground">Horário de Cuiabá. A fila pausa fora dessa janela e continua no próximo período permitido.</p>
          </div>}
        </fieldset>
        <p className="text-[11px] text-muted-foreground">
          A fila usa o template configurado nesta campanha. Salve primeiro as alterações do template no formulário da campanha.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={salvarAtivo} disabled={salvar.isPending}>
            {salvar.isPending ? <Spinner className="size-3.5" /> : <Save size={14} />} Salvar calendário
          </Button>
          {temCadencia && <Button type="button" size="sm" variant="outline" onClick={desativar} disabled={salvar.isPending}>Desativar programação</Button>}
        </div>
        {data?.envios.length ? <div className="space-y-1 border-t pt-2">
          <h4 className="text-xs font-semibold">Calendário da campanha</h4>
          {data.envios.map(envio => (
            <div key={envio.id} className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5 text-xs">
              <span className="font-medium">{envio.etapa}º envio</span>
              <span>{formatarDataBr(String(envio.dataAgendada).slice(0, 10))}</span>
              <span className="text-muted-foreground">{statusLabel[envio.situacao] ?? statusLabel[envio.status] ?? envio.status}</span>
            </div>
          ))}
        </div> : null}
      </>}
    </section>
  );
}
