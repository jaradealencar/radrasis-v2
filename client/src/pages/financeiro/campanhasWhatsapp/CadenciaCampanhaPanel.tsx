import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { fmtDateTime } from "@/lib/format";
import { formatarTelefone } from "@shared/campanhas-whatsapp";

type EtapaEditavel = { templateId: string; atrasoDiasUteis: number };

export default function CadenciaCampanhaPanel({ campanhaId, aberto }: { campanhaId: number; aberto: boolean }) {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const ehAdmin = user?.role === "admin" || user?.role === "master";
  const { data, isLoading, error } = trpc.campanhasWhatsapp.obterConfiguracaoCadencia.useQuery(
    { campanhaId }, { enabled: aberto, retry: false, refetchInterval: aberto ? 30_000 : false },
  );
  const { data: inscricoes } = trpc.campanhasWhatsapp.listarInscricoesCadencia.useQuery(
    { campanhaId, limite: 50 }, { enabled: aberto, retry: false, refetchInterval: aberto ? 30_000 : false },
  );
  const [etapas, setEtapas] = useState<EtapaEditavel[]>([]);
  const [prioridade, setPrioridade] = useState("100");
  const [intervaloMin, setIntervaloMin] = useState("3");
  const [intervaloMax, setIntervaloMax] = useState("8");
  const [cooldown, setCooldown] = useState("30");
  const [confirmouOptIn, setConfirmouOptIn] = useState(false);
  const [confirmouTemplates, setConfirmouTemplates] = useState(false);

  useEffect(() => {
    if (!data) return;
    setEtapas(data.etapas.length
      ? data.etapas.map(e => ({ templateId: e.templateId, atrasoDiasUteis: e.atrasoDiasUteis }))
      : data.campanha.wtsTemplateId ? [{ templateId: data.campanha.wtsTemplateId, atrasoDiasUteis: 0 }] : [{ templateId: "", atrasoDiasUteis: 0 }]);
    setPrioridade(String(data.campanha.prioridadeCadencia));
    setIntervaloMin(String(data.campanha.intervaloMinimoSegundos));
    setIntervaloMax(String(data.campanha.intervaloMaximoSegundos));
    setCooldown(String(data.campanha.intervaloMinimoEntreCampanhasDias));
  }, [data]);

  const invalidar = async () => Promise.all([
    utils.campanhasWhatsapp.obterConfiguracaoCadencia.invalidate({ campanhaId }),
    utils.campanhasWhatsapp.listarInscricoesCadencia.invalidate({ campanhaId, limite: 50 }),
    utils.campanhasWhatsapp.listar.invalidate(),
  ]);
  const salvarEtapas = trpc.campanhasWhatsapp.salvarEtapasCadencia.useMutation({
    onSuccess: async ({ versao }) => { toast.success(`Etapas salvas na versão ${versao}.`); setConfirmouTemplates(false); await invalidar(); },
    onError: e => toast.error(e.message),
  });
  const configurar = trpc.campanhasWhatsapp.configurarMotorCadencia.useMutation({
    onSuccess: async r => {
      toast.success(r.ativo ? `Motor ativo. ${r.inscricoesCriadas} contato(s) entraram na etapa 1.` : "Motor de cadência desativado.");
      setConfirmouOptIn(false); setConfirmouTemplates(false); await invalidar();
    },
    onError: e => toast.error(e.message),
  });
  const conciliar = trpc.campanhasWhatsapp.conciliarEnvioCadencia.useMutation({
    onSuccess: async () => { toast.success("Conciliação registrada."); await invalidar(); },
    onError: e => toast.error(e.message),
  });

  const atualizarEtapa = (index: number, patch: Partial<EtapaEditavel>) => {
    setEtapas(current => current.map((etapa, i) => i === index ? { ...etapa, ...patch } : etapa));
  };
  const ativar = data?.campanha.motorCadenciaAtivo ?? false;
  const totalInscritos = data?.inscricoes.reduce((total, item) => total + Number(item.total), 0) ?? 0;

  return (
    <section className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Motor de cadência</h3>
          <p className="text-[11px] text-muted-foreground">Campanhas antigas ficam desligadas até ativação manual.</p>
        </div>
        {data && <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${ativar ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
          {ativar ? "Ativo" : "Desligado"}
        </span>}
      </div>

      {isLoading ? <div className="flex justify-center py-3"><Spinner /></div> : error ? <p className="text-xs text-red-600">{error.message}</p> : data && <>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Etapas ({etapas.length}/6)</Label>
            <Button type="button" variant="outline" size="sm" disabled={etapas.length >= 6}
              onClick={() => setEtapas(current => [...current, { templateId: "", atrasoDiasUteis: 3 }])}>
              <Plus size={14} /> Adicionar etapa
            </Button>
          </div>
          {etapas.map((etapa, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_92px_32px] items-end gap-2 rounded-md bg-slate-50 p-2">
              <div className="space-y-1">
                <Label htmlFor={`cadencia-template-${campanhaId}-${index}`} className="text-[11px]">Etapa {index + 1} · template aprovado</Label>
                <Input id={`cadencia-template-${campanhaId}-${index}`} value={etapa.templateId} maxLength={120}
                  placeholder="ID do template Meta/WTS" onChange={e => atualizarEtapa(index, { templateId: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`cadencia-delay-${campanhaId}-${index}`} className="text-[11px]">Dias úteis</Label>
                <Input id={`cadencia-delay-${campanhaId}-${index}`} inputMode="numeric" type="number" min={0} max={365}
                  value={index === 0 ? 0 : etapa.atrasoDiasUteis} disabled={index === 0}
                  onChange={e => atualizarEtapa(index, { atrasoDiasUteis: Math.max(0, Number(e.target.value) || 0) })} />
              </div>
              <Button type="button" variant="ghost" size="icon" title="Remover etapa" disabled={etapas.length <= 1}
                onClick={() => setEtapas(current => current.filter((_, i) => i !== index))}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">O prazo conta do aceite WTS; a próxima etapa só é liberada após a confirmação de entrega. Horários: dias úteis, feriados nacionais e 08:30–17:30 em Campo Grande.</p>
          <Button type="button" size="sm" variant="outline" disabled={salvarEtapas.isPending || etapas.some(e => !e.templateId.trim()) || (ativar && !confirmouTemplates)}
            onClick={() => salvarEtapas.mutate({ campanhaId, etapas, confirmarTemplatesAprovados: confirmouTemplates })}>
            {salvarEtapas.isPending && <Spinner className="size-3.5" />} Salvar nova versão
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-4">
          <div className="space-y-1"><Label className="text-[11px]">Prioridade</Label><Input type="number" min={0} max={9999} disabled={ativar} value={prioridade} onChange={e => setPrioridade(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-[11px]">Intervalo mínimo (s)</Label><Input type="number" min={3} max={8} disabled={ativar} value={intervaloMin} onChange={e => setIntervaloMin(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-[11px]">Intervalo máximo (s)</Label><Input type="number" min={3} max={8} disabled={ativar} value={intervaloMax} onChange={e => setIntervaloMax(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-[11px]">Cooldown (dias)</Label><Input type="number" min={0} max={365} disabled={ativar} value={cooldown} onChange={e => setCooldown(e.target.value)} /></div>
        </div>
        <p className="text-[11px] text-muted-foreground">Primeira compra/pós-venda recebe prioridade máxima sobre reativação; planilhas e retargeting ficam abaixo das audiências ERP.</p>

        {!ativar && <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-2">
          <label className="flex items-start gap-2 text-xs"><Checkbox checked={confirmouOptIn} onCheckedChange={v => setConfirmouOptIn(v === true)} className="mt-0.5" />Confirmo que a audiência desta campanha tem base legal e opt-in válidos para contato via WhatsApp.</label>
        </div>}
        <label className={`flex items-start gap-2 rounded-md border p-2 text-xs ${!ativar ? "border-amber-200 bg-amber-50" : "border-slate-200"}`}><Checkbox checked={confirmouTemplates} onCheckedChange={v => setConfirmouTemplates(v === true)} className="mt-0.5" />Confirmo que todos os templates desta versão estão aprovados na Meta. Esta confirmação também é exigida ao salvar novas etapas com o motor ativo.</label>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">{totalInscritos} inscrições · {data.enviosPendentesConciliacao} envio(s) aguardando confirmação</div>
          <Button type="button" variant={ativar ? "destructive" : "default"} size="sm" disabled={configurar.isPending || (!ativar && (!confirmouOptIn || !confirmouTemplates))}
            onClick={() => configurar.mutate({
              campanhaId, ativo: !ativar, prioridade: Number(prioridade),
              intervaloMinimoSegundos: Number(intervaloMin), intervaloMaximoSegundos: Number(intervaloMax),
              intervaloMinimoEntreCampanhasDias: Number(cooldown),
              confirmarOptInAudiencia: confirmouOptIn, confirmarTemplatesAprovados: confirmouTemplates,
            })}>
            {configurar.isPending && <Spinner className="size-3.5" />}{ativar ? "Desativar motor" : "Ativar campanha"}
          </Button>
        </div>

        <div className="space-y-1 border-t pt-2">
          <p className="text-xs font-medium">Saúde do MubiSys · envios pausam se os dados ficarem desatualizados</p>
          {data.saudeErp.detalhes.map(item => <p key={item.recurso} className={`text-[11px] ${data.saudeErp.ok ? "text-emerald-700" : "text-amber-700"}`}>
            {item.recurso}: {item.status}{item.idadeMs !== null ? ` · ${Math.round(item.idadeMs / 60000)} min` : " · sem sincronização"}{item.erro ? ` · ${item.erro}` : ""}
          </p>)}
        </div>

        {data.enviosPendentes.length > 0 && <div className="space-y-2 border-t pt-2">
          <p className="text-xs font-medium">Conciliação manual</p>
          {data.enviosPendentes.map(item => <div key={item.id} className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="min-w-0 flex-1">{formatarTelefone(item.telefoneE164)} · etapa {item.etapa} · {item.status}{item.idMensagemExterno ? ` · WTS ${item.idMensagemExterno}` : ""} · {item.erro || item.templateId}</span>
            {ehAdmin && <>
              <Button type="button" size="sm" variant="outline" disabled={conciliar.isPending} onClick={() => conciliar.mutate({ envioId: item.id, decisao: "entregue" })}>Entregue</Button>
              <Button type="button" size="sm" variant="ghost" disabled={conciliar.isPending} onClick={() => conciliar.mutate({ envioId: item.id, decisao: "falhou" })}>Falhou</Button>
            </>}
          </div>)}
        </div>}

        {!!inscricoes?.itens.length && <div className="space-y-1 border-t pt-2">
          <p className="text-xs font-medium">Inscrições recentes (até 50)</p>
          <div className="max-h-52 space-y-1 overflow-y-auto">
            {inscricoes.itens.slice(0, 50).map(item => <div key={item.id} className="flex flex-wrap items-center gap-2 rounded bg-slate-50 px-2 py-1.5 text-[11px]">
              <span className="min-w-0 flex-1 truncate">{item.nome || formatarTelefone(item.telefoneE164)} · etapa {item.etapaAtual}/{item.snapshotEtapas.length}</span>
              <span className="text-muted-foreground">{item.status.replaceAll("_", " ")}</span>
              {item.proximoEnvioEm && <span className="text-muted-foreground">{fmtDateTime(item.proximoEnvioEm)}</span>}
            </div>)}
          </div>
        </div>}
      </>}
    </section>
  );
}
