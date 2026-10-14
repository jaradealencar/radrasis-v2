import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { MAX_DISPARO_WTS, formatarDataBr } from "@shared/campanhas-whatsapp";
import type { CampanhaLinha } from "./comuns";

interface Props {
  /** `null` = fechado. */
  campanha: CampanhaLinha | null;
  onClose: () => void;
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className={`text-2xl font-bold ${cor}`}>{fmtNum(valor)}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{rotulo}</div>
    </div>
  );
}

/**
 * "Efetuar disparo": o Radrasys envia o template aprovado (ID cadastrado na campanha) pela WTS.Chat aos contatos
 * prontos e já registra o disparo (cadência, quarentena, histórico). Substitui o antigo "Registrar disparo", que
 * servia a quem disparava por outro sistema (o registro manual continua no menu "⋯" da campanha).
 * A audiência usa o período gravado na campanha, o mesmo de "Ver contatos".
 */
export default function DispararCampanhaDialog({ campanha, onClose }: Props) {
  const utils = trpc.useUtils();
  const [quantidade, setQuantidade] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<{
    enfileirados: number; totalSelecionado: number; restantes: number; erroRegistro: string | null;
    falhas: Array<{ nome: string; telefone: string; erro: string }>;
  } | null>(null);

  const templateWts = campanha?.wtsTemplateId?.trim() || "";
  const ehGatilho = campanha?.tipo === "gatilho_venda";

  const { data, isFetching, isError, error } = trpc.campanhasWhatsapp.gerarListaDaCampanha.useQuery(
    { campanhaId: campanha?.id ?? 0 }, { enabled: !!campanha && !ehGatilho, retry: false },
  );

  useEffect(() => {
    setQuantidade(""); setConfirmando(false); setResultado(null);
  }, [campanha?.id]);

  const prontos = data?.aprovados.length ?? 0;
  const maximo = Math.min(prontos, MAX_DISPARO_WTS);
  const n = quantidade.trim() === "" ? maximo : Math.floor(Number(quantidade));
  const quantidadeValida = Number.isFinite(n) && n >= 1 && n <= maximo;

  const disparar = trpc.campanhasWhatsapp.dispararWts.useMutation({
    onSuccess: r => {
      setResultado(r);
      setConfirmando(false);
      utils.campanhasWhatsapp.invalidate();
      if (r.erroRegistro) toast.error(`${fmtNum(r.enfileirados)} mensagens saíram, mas o disparo NÃO foi registrado: ${r.erroRegistro}`);
      else if (r.falhas.length > 0) toast.warning(`${fmtNum(r.enfileirados)} enfileiradas; ${fmtNum(r.falhas.length)} falharam.`);
      else toast.success(`${fmtNum(r.enfileirados)} mensagens enfileiradas pela WTS.Chat e disparo registrado.`);
    },
    onError: e => { setConfirmando(false); toast.error(e.message); },
  });

  const emEspera = data ? data.ignoradosQuarentenaGlobal.length + data.ignoradosCadenciaCampanha.length : 0;
  const semTelefone = data ? data.invalidosOuDuplicados.length : 0;

  return (
    <Dialog open={!!campanha} onOpenChange={v => { if (!v && !disparar.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send size={18} className="text-emerald-600" /> Efetuar disparo</DialogTitle>
          <DialogDescription>{campanha?.nome}</DialogDescription>
        </DialogHeader>

        {ehGatilho ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Campanhas de gatilho de venda (pós-venda) ainda não disparam pelo sistema. Use “Registrar disparo manual” no menu “⋯” da campanha.
          </p>
        ) : !templateWts ? (
          <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            Esta campanha ainda não tem o ID do template da WTS.Chat. Informe-o em “Editar campanha” para poder disparar.
          </p>
        ) : isFetching ? (
          <div className="flex justify-center py-10"><Spinner className="size-6 text-muted-foreground" /></div>
        ) : isError ? (
          <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error.message}
          </p>
        ) : data ? (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <div><span className="text-muted-foreground">Template WTS.Chat: </span><code>{templateWts}</code></div>
              <div><span className="text-muted-foreground">Último disparo: </span>{campanha?.ultimoEnvio ? formatarDataBr(campanha.ultimoEnvio) : "nunca"}</div>
              <div><span className="text-muted-foreground">Quarentena: </span>{campanha?.quarentenaDias ? `${campanha.quarentenaDias} dias após o envio` : "sem quarentena"}</div>
              <div>
                <span className="text-muted-foreground">Período da audiência: </span>
                {campanha?.periodoInicio || campanha?.periodoFim
                  ? `${campanha.periodoInicio ? formatarDataBr(campanha.periodoInicio) : "início do histórico"} a ${campanha.periodoFim ? formatarDataBr(campanha.periodoFim) : "hoje"}`
                  : "padrão da fonte de dados"}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Numero rotulo="prontos para envio" valor={prontos} cor="text-emerald-700" />
              <Numero rotulo="em espera (quarentena/cadência)" valor={emEspera} cor="text-amber-700" />
              <Numero rotulo="sem telefone / inválidos" valor={semTelefone} cor="text-slate-600" />
            </div>
            {data.ignoradosBloqueados.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {fmtNum(data.ignoradosBloqueados.length)} contato(s) pediram para não receber e ficam de fora.
              </p>
            )}

            {resultado ? (
              <div className="space-y-1 rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-emerald-800">
                  <CheckCircle2 size={15} /> {fmtNum(resultado.enfileirados)} de {fmtNum(resultado.totalSelecionado)} aceitos para processamento pela WTS.Chat
                </p>
                {resultado.erroRegistro
                  ? <p className="text-red-700">As mensagens saíram, mas o disparo não foi registrado ({resultado.erroRegistro}). Registre-o à mão para a quarentena valer.</p>
                  : resultado.enfileirados > 0 && <p className="text-emerald-700">Disparo registrado: cadência e histórico atualizados.</p>}
                {resultado.restantes > 0 && (
                  <p>Ainda há {fmtNum(resultado.restantes)} contato(s) pronto(s): efetue outro disparo para continuar.</p>
                )}
                {resultado.falhas.length > 0 && (
                  <ul className="list-disc pl-5 text-xs text-red-700">
                    {resultado.falhas.slice(0, 5).map((f, i) => <li key={i}>{f.nome}: {f.erro}</li>)}
                    {resultado.falhas.length > 5 && <li>e mais {fmtNum(resultado.falhas.length - 5)} falha(s).</li>}
                  </ul>
                )}
              </div>
            ) : prontos === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Nenhum contato está pronto para receber agora. Veja os motivos em “Ver contatos”.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="disparo-quantidade">Quantos contatos disparar agora</Label>
                <Input
                  id="disparo-quantidade" type="number" min={1} max={maximo} inputMode="numeric"
                  placeholder={`Todos os prontos (${fmtNum(maximo)})`} value={quantidade}
                  disabled={disparar.isPending}
                  onChange={e => { setQuantidade(e.target.value); setConfirmando(false); }}
                />
                <p className="text-[11px] text-muted-foreground">
                  Cada envio leva no máximo {MAX_DISPARO_WTS} contatos
                  {prontos > MAX_DISPARO_WTS && `; os outros ${fmtNum(prontos - MAX_DISPARO_WTS)} ficam prontos para o próximo disparo`}.
                  Quem recebe sai da lista (cadência e quarentena).
                </p>
                {!quantidadeValida && <p className="text-[11px] text-red-600">Informe um número de 1 a {fmtNum(maximo)}.</p>}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={disparar.isPending}>{resultado ? "Fechar" : "Cancelar"}</Button>
          {!resultado && !ehGatilho && !!templateWts && prontos > 0 && (
            confirmando ? (
              <Button className="gap-1.5" disabled={disparar.isPending || !quantidadeValida}
                onClick={() => disparar.mutate({ campanhaId: campanha!.id, quantidade: n })}>
                {disparar.isPending ? <Spinner className="size-3.5" /> : <Send size={14} />}
                {disparar.isPending ? "Enviando..." : `Confirmar envio para ${fmtNum(n)}`}
              </Button>
            ) : (
              <Button className="gap-1.5" disabled={!quantidadeValida} onClick={() => setConfirmando(true)}>
                <Send size={14} /> Revisar e disparar
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
