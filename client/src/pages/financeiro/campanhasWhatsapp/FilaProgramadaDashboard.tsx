import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, CircleCheck, Clock3, Pause, Play, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarDataBr } from "@shared/campanhas-whatsapp";
import { detectarAlertasFila, estimarDuracaoFilaSegundos, formatarDuracaoEstimada } from "@shared/campanhas-whatsapp-fila";

type Selecionado = { id: number; modo: "revisar" | "acompanhar" } | null;

const situacoes: Record<string, string> = {
  pendente_revisao: "Pendente",
  em_andamento: "Em andamento",
  pausado: "Pausado",
  agendado: "Agendado",
  concluido: "Concluído",
};

function classeSituacao(status: string) {
  if (status === "em_andamento" || status === "concluido") return "bg-emerald-100 text-emerald-800";
  if (status === "pausado") return "bg-amber-100 text-amber-900";
  if (status === "pendente_revisao") return "bg-slate-100 text-slate-700";
  return "bg-blue-100 text-blue-800";
}

export default function FilaProgramadaDashboard() {
  const utils = trpc.useUtils();
  const { data: campanhas, isLoading, isError, error } = trpc.campanhasWhatsapp.listarFilasProgramadas.useQuery(undefined, { refetchInterval: 10_000 });
  const estadosAnteriores = useRef<Map<number, string> | null>(null);
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(() => typeof Notification !== "undefined" && Notification.permission === "granted");
  const [selecionado, setSelecionado] = useState<Selecionado>(null);
  const [calendarioCampanha, setCalendarioCampanha] = useState<number | null>(null);
  const detalhes = trpc.campanhasWhatsapp.revisarEnvioProgramado.useQuery(
    { envioProgramadoId: selecionado?.id ?? 0 },
    { enabled: !!selecionado, refetchInterval: selecionado?.modo === "acompanhar" ? 5_000 : false, retry: false },
  );
  const calendario = trpc.campanhasWhatsapp.obterProgramacaoFila.useQuery(
    { campanhaId: calendarioCampanha ?? 0 }, { enabled: calendarioCampanha !== null, retry: false },
  );
  const invalidar = async () => Promise.all([
    utils.campanhasWhatsapp.listarFilasProgramadas.invalidate(),
    utils.campanhasWhatsapp.obterProgramacaoFila.invalidate(),
    utils.campanhasWhatsapp.revisarEnvioProgramado.invalidate(),
    utils.campanhasWhatsapp.listar.invalidate(),
  ]);
  const iniciar = trpc.campanhasWhatsapp.iniciarEnvioProgramado.useMutation({
    onSuccess: async r => { toast.success(r.reutilizado ? "Execução existente retomada pelo worker." : "Fila iniciada em segundo plano."); await invalidar(); setSelecionado({ id: r.envioProgramadoId, modo: "acompanhar" }); },
    onError: e => toast.error(e.message),
  });
  const pausar = trpc.campanhasWhatsapp.pausarEnvioProgramado.useMutation({ onSuccess: async () => { toast.success("Fila pausada."); await invalidar(); }, onError: e => toast.error(e.message) });
  const retomar = trpc.campanhasWhatsapp.retomarEnvioProgramado.useMutation({ onSuccess: async () => { toast.success("Fila retomada."); await invalidar(); }, onError: e => toast.error(e.message) });
  const verificar = trpc.campanhasWhatsapp.verificarItemEnvioProgramado.useMutation({
    onSuccess: async r => { toast.info(`Status WTS.Chat: ${r.estado ?? "sem confirmação"}.`); await invalidar(); },
    onError: e => toast.error(e.message),
  });
  const reprocessarFalhas = trpc.campanhasWhatsapp.reprocessarFalhasEnvioProgramado.useMutation({
    onSuccess: async r => { toast.success(`${r.reprocessados} falhas reprocessadas.`); await invalidar(); },
    onError: e => toast.error(e.message),
  });

  const revisar = (id: number) => setSelecionado({ id, modo: "revisar" });
  const acompanhar = (id: number) => setSelecionado({ id, modo: "acompanhar" });

  useEffect(() => {
    if (!campanhas) return;
    const atuais = campanhas.map(c => ({
      envioProgramadoId: c.envioProgramadoId,
      campanhaNome: c.campanhaNome,
      status: c.status,
      motivoPausa: c.motivoPausa,
    }));
    const anteriores = estadosAnteriores.current;
    if (anteriores) {
      for (const alerta of detectarAlertasFila(anteriores, atuais)) {
        const concluido = alerta.tipo === "concluido";
        const titulo = concluido ? "Envio concluído" : "Fila pausada por autorização";
        const descricao = concluido
          ? `${alerta.campanhaNome}: etapa finalizada. Confira aceitos, entregues e falhas no painel.`
          : `${alerta.campanhaNome}: ${alerta.motivoPausa ?? "A WTS.Chat recusou a autorização."}`;
        if (document.visibilityState === "hidden" && typeof Notification !== "undefined" && Notification.permission === "granted") {
          const notification = new Notification(titulo, { body: descricao, tag: `campanha-fila-${alerta.envioProgramadoId}-${alerta.tipo}` });
          notification.onclick = () => { window.focus(); acompanhar(alerta.envioProgramadoId); notification.close(); };
        } else if (concluido) {
          toast.success(titulo, { description: descricao });
        } else {
          toast.error(titulo, { description: descricao });
        }
      }
    }
    estadosAnteriores.current = new Map(atuais.map(c => [c.envioProgramadoId, c.status]));
  }, [campanhas]);

  const ativarNotificacoes = async () => {
    if (typeof Notification === "undefined") {
      toast.error("Este navegador não oferece notificações de sistema.");
      return;
    }
    const permissao = await Notification.requestPermission();
    setNotificacoesAtivas(permissao === "granted");
    if (permissao === "granted") toast.success("Alertas do navegador ativados.");
    else toast.info("Permissão de notificação não concedida. O painel ainda mostrará a situação da fila.");
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-slate-800">Fila de envios programados</h3>
        <p className="text-xs text-muted-foreground">Uma linha por campanha. O worker continua no servidor depois que você fecha a tela.</p>
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={ativarNotificacoes} disabled={notificacoesAtivas}>
          <Bell size={14} className="mr-1" />{notificacoesAtivas ? "Alertas ativados" : "Ativar alertas do navegador"}
        </Button>
      </div>
      {isLoading ? <div className="flex justify-center py-10"><Spinner /></div> : isError ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Não foi possível carregar a fila: {error.message}</p>
      ) : !campanhas?.length ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma campanha tem programação ativa. Ative o calendário em “Editar campanha”.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Campanha</TableHead><TableHead>Etapa</TableHead><TableHead>Data</TableHead><TableHead>Situação</TableHead><TableHead>Progresso</TableHead><TableHead className="text-right">Ação</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {campanhas.map(c => {
                const busy = c.status === "em_andamento";
                const processados = Math.max(0, c.totalContatos - c.pendentes - c.incertos);
                const progress = c.totalContatos ? Math.round((processados / c.totalContatos) * 100) : 0;
                return <TableRow key={c.campanhaId}>
                  <TableCell className="min-w-44 font-medium">{c.campanhaNome}</TableCell>
                  <TableCell className="whitespace-nowrap">{c.etapa}º de {c.totalEtapas}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatarDataBr(String(c.data).slice(0, 10))}</TableCell>
                  <TableCell><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classeSituacao(c.situacao)}`}>{situacoes[c.situacao] ?? c.situacao}</span></TableCell>
                  <TableCell className="min-w-52">
                    {busy || c.status === "pausado" ? <div className="space-y-1">
                      <div className="flex justify-between gap-2 text-xs"><span>{c.lotesConcluidos} de {c.lotes} lotes concluídos</span><span>{progress}%</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
                      <div className="text-[11px] text-muted-foreground">{fmtNum(c.aceitos)} aceitos · {fmtNum(c.pendentes)} pendentes · {fmtNum(c.incertos)} incertos · {fmtNum(c.falhas)} falhas · {fmtNum(c.cancelados)} cancelados{c.proximoProcessamentoEm && busy ? ` · Próximo ${fmtDateTime(c.proximoProcessamentoEm)}` : ""}</div>
                    </div> : <span className="text-xs text-muted-foreground">{c.totalContatos ? `${fmtNum(c.totalContatos)} contatos · ${c.lotes} lotes` : "Aguardando revisão"}</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setCalendarioCampanha(c.campanhaId)}><CalendarDays size={14} className="mr-1" />Calendário</Button>
                      {c.situacao === "pendente_revisao" && <Button size="sm" onClick={() => revisar(c.envioProgramadoId)}><Send size={14} className="mr-1" />Revisar envio</Button>}
                      {(busy || c.status === "concluido" && c.falhas > 0) && <>
                        <Button size="sm" variant="outline" onClick={() => acompanhar(c.envioProgramadoId)}>Acompanhar</Button>
                        {busy && <Button size="sm" variant="outline" disabled={pausar.isPending} onClick={() => pausar.mutate({ envioProgramadoId: c.envioProgramadoId })}><Pause size={14} className="mr-1" />Pausar fila</Button>}
                      </>}
                      {c.status === "pausado" && <>
                        <Button size="sm" variant="outline" onClick={() => acompanhar(c.envioProgramadoId)}>Ver motivo</Button>
                        <Button size="sm" disabled={retomar.isPending} onClick={() => retomar.mutate({ envioProgramadoId: c.envioProgramadoId })}><Play size={14} className="mr-1" />Retomar</Button>
                      </>}
                      {c.situacao === "agendado" && <Button size="sm" variant="outline" onClick={() => setCalendarioCampanha(c.campanhaId)}>Ver calendário</Button>}
                    </div>
                  </TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selecionado} onOpenChange={open => { if (!open) setSelecionado(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>
            {detalhes.data ? `${detalhes.data.campanha.nome} · ${detalhes.data.envio.etapa}º de ${detalhes.data.fila?.quantidadeEnvios} envios` : "Revisar envio"}
          </DialogTitle></DialogHeader>
          {detalhes.isLoading || !detalhes.data ? <div className="flex justify-center py-8"><Spinner /></div> : <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Data</p><p className="font-semibold">{formatarDataBr(String(detalhes.data.envio.dataAgendada).slice(0, 10))}</p></div>
              <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Canal WTS.Chat</p><p className="truncate text-sm font-medium">{detalhes.data.canal.telefone} · {detalhes.data.canal.id}</p></div>
              <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Pausa entre lotes</p><p className="font-semibold">{detalhes.data.fila?.pausaLotesMinutos} min</p></div>
            </div>
            <p className="text-xs text-muted-foreground">Template da etapa programada: <code>{detalhes.data.envio.templateId}</code></p>

            <section className="space-y-2 rounded-lg border p-3">
              <h4 className="text-sm font-semibold">Revisão por etapa de contato</h4>
              {detalhes.data.grupos.length ? detalhes.data.grupos.map(g => <div key={`${g.etapa}-${g.templateId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
                <span><strong>{g.etapa}º envio</strong> · template <code>{g.templateId}</code></span><span>{fmtNum(g.quantidade)} contatos · {g.lotes} lotes</span>
              </div>) : <p className="text-sm text-muted-foreground">Nenhum contato apto nesta etapa.</p>}
              <div className="grid grid-cols-2 gap-2 border-t pt-2 text-sm">
                <span>Contatos aptos</span><strong className="text-right">{fmtNum(detalhes.data.contatosAptos)}</strong>
                <span>Lotes de até 100</span><strong className="text-right">{fmtNum(detalhes.data.lotes)}</strong>
                <span>Duração estimada</span><strong className="text-right">{formatarDuracaoEstimada(estimarDuracaoFilaSegundos(detalhes.data.contatosAptos, detalhes.data.fila?.pausaLotesMinutos ?? 5))}</strong>
              </div>
              <p className="text-[11px] text-muted-foreground">Estimativa baseada no ritmo da fila e na pausa configurada. Limites ou esperas adicionais do provedor podem aumentar o tempo.</p>
            </section>

            {detalhes.data.envio.status !== "agendado" && <section className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Acompanhamento da fila</h4>
                <span className="text-xs text-muted-foreground">{fmtNum(detalhes.data.envio.aceitos)} aceitos · {fmtNum(detalhes.data.envio.entregues)} entregues · {fmtNum(detalhes.data.envio.falhas)} falhas</span>
              </div>
              {detalhes.data.envio.motivoPausa && <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950">{detalhes.data.envio.motivoPausa}</p>}
              <div className="space-y-1.5">
                {(detalhes.data.lotesDetalhe ?? []).map(l => <div key={l.lote} className="flex items-center gap-2 rounded bg-slate-50 px-2.5 py-2 text-sm">
                  {l.pendentes ? <Clock3 size={15} className="text-blue-700" /> : <CircleCheck size={15} className="text-emerald-700" />}
                  <span className="font-medium">Lote {l.lote}</span><span className="text-muted-foreground">· {l.aceitos} aceitos · {l.pendentes} pendentes · {l.incertos} incertos · {l.falhas} falhas · {l.cancelados} cancelados</span>
                </div>)}
              </div>
              {!!detalhes.data.itensIncertos?.length && <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                <p className="text-sm font-medium">Resultado incerto — verifique o status antes de qualquer nova tentativa.</p>
                {detalhes.data.itensIncertos.map(item => <div key={item.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1">Etapa {item.etapa} · {item.telefone} · {item.erro}</span>
                  <Button size="sm" variant="outline" disabled={verificar.isPending} onClick={() => verificar.mutate({ itemId: item.id })}><RefreshCw size={13} className="mr-1" />Verificar status</Button>
                </div>)}
              </div>}
            </section>}

            {selecionado?.modo === "revisar" && <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setSelecionado(null)}>Fechar</Button>
              <Button disabled={!detalhes.data.podeIniciar || iniciar.isPending} onClick={() => iniciar.mutate({ envioProgramadoId: detalhes.data.envio.id })}>
                {iniciar.isPending ? <Spinner className="mr-2 size-4" /> : <Play size={15} className="mr-2" />} ▶ Iniciar envio
              </Button>
            </div>}
            {selecionado?.modo === "acompanhar" && detalhes.data.envio.status === "pausado" && !detalhes.data.itensIncertos?.length && <div className="flex justify-end border-t pt-3">
              <Button disabled={retomar.isPending} onClick={() => retomar.mutate({ envioProgramadoId: detalhes.data.envio.id })}><Play size={15} className="mr-2" />Retomar fila</Button>
            </div>}
            {selecionado?.modo === "acompanhar" && detalhes.data.podeReprocessarFalhas && <div className="flex justify-end border-t pt-3">
              <Button variant="outline" disabled={reprocessarFalhas.isPending} onClick={() => reprocessarFalhas.mutate({ envioProgramadoId: detalhes.data.envio.id })}>
                <RefreshCw size={14} className="mr-1" />Reprocessar {fmtNum(detalhes.data.envio.falhas)} falhas confirmadas
              </Button>
            </div>}
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={calendarioCampanha !== null} onOpenChange={open => { if (!open) setCalendarioCampanha(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Calendário da campanha {calendario.data?.campanha.nome ? `· ${calendario.data.campanha.nome}` : ""}</DialogTitle></DialogHeader>
          {calendario.isLoading || !calendario.data ? <div className="flex justify-center py-8"><Spinner /></div> : <div className="space-y-2">
            {calendario.data.envios.map(e => <div key={e.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="font-medium">{e.etapa}º envio</span><span>{formatarDataBr(String(e.dataAgendada).slice(0, 10))}</span><span className={`rounded-full px-2 py-0.5 text-xs ${classeSituacao(e.situacao)}`}>{situacoes[e.situacao] ?? e.situacao}</span>
              {e.situacao === "pendente_revisao" && <Button size="sm" onClick={() => { setCalendarioCampanha(null); revisar(e.id); }}>Revisar envio</Button>}
              {e.status === "concluido" && e.falhas > 0 && <Button size="sm" variant="outline" onClick={() => { setCalendarioCampanha(null); acompanhar(e.id); }}>Ver {fmtNum(e.falhas)} falhas</Button>}
            </div>)}
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
