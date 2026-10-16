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
import { MAX_DISPARO_WTS, formatarDataBr, formatarTelefone, normalizarTelefone } from "@shared/campanhas-whatsapp";
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
  const [telefoneTeste, setTelefoneTeste] = useState("");
  const [confirmandoTeste, setConfirmandoTeste] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<{
    telefone: string; enfileirado: boolean; erro: string | null; resposta: string | null;
    estado: string | null; detalhe: string | null;
  } | null>(null);
  const [resultado, setResultado] = useState<{
    enfileirados: number; totalSelecionado: number; restantes: number; erroRegistro: string | null;
    campanhaCeciId?: string | null;
    erroCampanhaCeci?: string | null;
    falhas: Array<{ nome: string; telefone: string; erro: string }>;
    amostraResposta: string | null;
    estadosAmostra: Array<{ nome: string; telefone: string; estado: string | null; detalhe: string }>;
    totalMensagensComId: number;
  } | null>(null);

  const templateWts = campanha?.wtsTemplateId?.trim() || "";
  const ehGatilho = campanha?.tipo === "gatilho_venda";

  const { data: diagCeci } = trpc.campanhasWhatsapp.diagnosticoCeci.useQuery(undefined, {
    enabled: !!campanha,
    staleTime: 60_000,
  });

  const { data, isFetching, isError, error } = trpc.campanhasWhatsapp.gerarListaDaCampanha.useQuery(
    { campanhaId: campanha?.id ?? 0 }, { enabled: !!campanha && !ehGatilho, retry: false },
  );

  useEffect(() => {
    setQuantidade(""); setConfirmando(false); setResultado(null);
    setTelefoneTeste(""); setConfirmandoTeste(false); setResultadoTeste(null);
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

  const testarWts = trpc.campanhasWhatsapp.testarNumeroWts.useMutation({
    onSuccess: r => {
      setResultadoTeste(r);
      setConfirmandoTeste(false);
      if (r.enfileirado) toast.success(`Teste aceito pela WTS.Chat para ${formatarTelefone(r.telefone)}.`);
      else toast.error(r.erro ?? "A WTS.Chat não aceitou o teste.");
    },
    onError: e => { setConfirmandoTeste(false); toast.error(e.message); },
  });

  const telefoneTesteNormalizado = normalizarTelefone(telefoneTeste);
  const mutacaoPendente = disparar.isPending || testarWts.isPending;

  const liberar = trpc.campanhasWhatsapp.liberarContatosOrfaos.useMutation({
    onSuccess: r => {
      utils.campanhasWhatsapp.invalidate();
      const total = Math.max(r.quarentenaLiberada, r.cadenciaLiberada);
      if (total > 0) toast.success(`${fmtNum(total)} contato(s) liberados para o próximo disparo.`);
      else toast.info("Nada preso por disparo desfeito hoje: o resto está em espera por outro motivo (ver “Ver contatos”).");
    },
    onError: e => toast.error(e.message),
  });

  const emEspera = data ? data.ignoradosQuarentenaGlobal.length + data.ignoradosCadenciaCampanha.length : 0;
  const semTelefone = data ? data.invalidosOuDuplicados.length : 0;

  return (
    <Dialog open={!!campanha} onOpenChange={v => { if (!v && !mutacaoPendente) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send size={18} className="text-emerald-600" /> Efetuar disparo</DialogTitle>
          <DialogDescription>{campanha?.nome}</DialogDescription>
        </DialogHeader>

        {!ehGatilho && !!templateWts && (
          <section className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-3">
            <div>
              <h3 className="text-sm font-semibold text-sky-950">Testar o template em um número</h3>
              <p className="mt-1 text-xs text-slate-600">
                Envia somente para o número informado, fora da audiência. O teste não altera cadência, quarentena ou histórico dos clientes.
                A aceitação pela WTS.Chat não confirma a entrega.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="disparo-numero-teste">Seu número com DDD</Label>
              <Input
                id="disparo-numero-teste" type="tel" inputMode="tel" autoComplete="tel"
                placeholder="(67) 99999-0000" value={telefoneTeste}
                disabled={mutacaoPendente}
                onChange={e => { setTelefoneTeste(e.target.value); setConfirmandoTeste(false); setResultadoTeste(null); }}
              />
              {telefoneTeste.trim() && !telefoneTesteNormalizado && (
                <p className="text-[11px] text-red-600">Digite um telefone brasileiro válido com DDD.</p>
              )}
            </div>
            {confirmandoTeste && telefoneTesteNormalizado ? (
              <div className="space-y-2 rounded-md bg-white/70 p-2 text-sm">
                <p>Será enviada uma mensagem real para <strong>{formatarTelefone(telefoneTesteNormalizado)}</strong>.</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" disabled={testarWts.isPending} onClick={() => setConfirmandoTeste(false)}>
                    Voltar
                  </Button>
                  <Button size="sm" className="gap-1.5" disabled={mutacaoPendente}
                    onClick={() => testarWts.mutate({ campanhaId: campanha!.id, telefone: telefoneTesteNormalizado })}>
                    {testarWts.isPending ? <Spinner className="size-3.5" /> : <Send size={14} />}
                    {testarWts.isPending ? "Enviando teste..." : "Confirmar teste"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="gap-1.5"
                disabled={!telefoneTesteNormalizado || mutacaoPendente}
                onClick={() => { setResultadoTeste(null); setConfirmandoTeste(true); }}>
                <Send size={14} /> Testar neste número
              </Button>
            )}
            {resultadoTeste && (
              <div aria-live="polite" className={`space-y-1 rounded-md border p-2 text-xs ${resultadoTeste.enfileirado ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
                <p className="font-medium">
                  {resultadoTeste.enfileirado
                    ? `WTS.Chat aceitou o teste para ${formatarTelefone(resultadoTeste.telefone)}.`
                    : `A WTS.Chat não aceitou o teste: ${resultadoTeste.erro ?? "motivo não informado"}`}
                </p>
                {resultadoTeste.enfileirado && (
                  <p>Status consultado: <strong>{resultadoTeste.estado ?? "não informado"}</strong>. Confirme também se a mensagem chegou ao aparelho.</p>
                )}
                {resultadoTeste.enfileirado && resultadoTeste.resposta?.includes('"senderId":null') && (
                  <p className="text-red-700 font-medium">
                    ⚠️ Atenção: A Ceci registrou <code>senderId: null</code>. O número configurado em <code>WTS_CHAT_FROM</code> ({diagCeci?.canalConfiguradoEnv}) não corresponde a nenhum canal ativo na Ceci, impedindo a entrega ao aparelho.
                  </p>
                )}
                {(resultadoTeste.detalhe || resultadoTeste.resposta) && (
                  <details className="rounded bg-white/70 p-2">
                    <summary className="cursor-pointer">Detalhes técnicos</summary>
                    {resultadoTeste.detalhe && <code className="mt-1 block break-all">Status: {resultadoTeste.detalhe}</code>}
                    {resultadoTeste.resposta && <code className="mt-1 block break-all">Envio: {resultadoTeste.resposta}</code>}
                  </details>
                )}
              </div>
            )}
          </section>
        )}

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
              {diagCeci && (
                <div className="pt-1 text-[11px] text-muted-foreground border-t mt-1">
                  <span>Canal configurado: <strong>{diagCeci.canalConfiguradoEnv}</strong> {diagCeci.canalIdConfigurado && <span className="text-slate-500">(ID: <code className="text-[10px]">{diagCeci.canalIdConfigurado.slice(0, 8)}...</code>)</span>}</span>
                  {diagCeci.canais && diagCeci.canais.length > 0 && (
                    <span className="ml-2 text-slate-700">
                      (Canais encontrados na Ceci: {diagCeci.canais.map((c: any) => c.phoneNumber || c.phone || c.name || c.id).join(", ")})
                    </span>
                  )}
                  {diagCeci.erroCanais && (
                    <span className="ml-2 text-amber-700 font-normal">
                      · Status canais: {diagCeci.erroCanais}
                    </span>
                  )}
                </div>
              )}
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
                {resultado.enfileirados > 0 && (
                  <p className="text-xs text-slate-600">
                    Mensagens enviadas diretamente pelo canal oficial do WhatsApp via Ceci API. Respostas dos clientes aparecerão no atendimento da Ceci.Chat.
                  </p>
                )}
                {resultado.restantes > 0 && (
                  <p>Ainda há {fmtNum(resultado.restantes)} contato(s) pronto(s): efetue outro disparo para continuar.</p>
                )}
                {resultado.estadosAmostra.length > 0 && (
                  <div className="space-y-1 rounded bg-white/70 p-2 text-xs text-slate-700">
                    <p className="font-medium">Status consultado após 4 segundos:</p>
                    {resultado.estadosAmostra.map(amostra => (
                      <div key={amostra.telefone} className={/FAIL|ERROR|REJECT|UNDELIVER/i.test(amostra.estado ?? "") ? "text-red-800" : ""}>
                        <p>
                          <strong>{amostra.nome || amostra.telefone} ({amostra.telefone}): {amostra.estado ?? "não informado"}.</strong>{" "}
                          {/QUEUE|PEND/i.test(amostra.estado ?? "") && "Ainda na fila da WTS.Chat. "}
                        </p>
                        {(/FAIL|ERROR|REJECT|UNDELIVER/i.test(amostra.estado ?? "") || !amostra.estado) && (
                          <code className="break-all">{amostra.detalhe}</code>
                        )}
                      </div>
                    ))}
                    {resultado.totalMensagensComId > resultado.estadosAmostra.length && (
                      <p>Consulta limitada às primeiras {resultado.estadosAmostra.length} mensagens; consulte o restante na Ceci.Chat.</p>
                    )}
                  </div>
                )}
                {resultado.enfileirados > 0 && resultado.estadosAmostra.length === 0 && (
                  <p className="text-xs text-amber-800">
                    A WTS.Chat aceitou o envio, mas não foi possível consultar o status porque a resposta não trouxe um ID de mensagem reconhecido.
                  </p>
                )}
                {resultado.amostraResposta && (
                  <p className="break-all rounded bg-white/70 p-2 text-[11px] text-slate-600">
                    Resposta da WTS.Chat ao primeiro envio: <code>{resultado.amostraResposta}</code>
                  </p>
                )}
                {resultado.amostraResposta && resultado.amostraResposta.includes('"senderId":null') && (
                  <div className="rounded bg-red-100 p-2 text-xs text-red-900 font-medium">
                    ⚠️ Atenção: A Ceci aceitou a mensagem mas com <code>senderId: null</code>. O número configurado em <code>WTS_CHAT_FROM</code> ({diagCeci?.canalConfiguradoEnv}) não corresponde ao canal ativo da sua conta na Ceci, impedindo a entrega ao aparelho.
                  </div>
                )}
                {resultado.falhas.length > 0 && (
                  <ul className="list-disc pl-5 text-xs text-red-700">
                    {resultado.falhas.slice(0, 5).map((f, i) => <li key={i}>{f.nome}: {f.erro}</li>)}
                    {resultado.falhas.length > 5 && <li>e mais {fmtNum(resultado.falhas.length - 5)} falha(s).</li>}
                  </ul>
                )}
              </div>
            ) : prontos === 0 ? (
              <div className="space-y-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                <p>Nenhum contato está pronto para receber agora. Veja os motivos em “Ver contatos”.</p>
                {emEspera > 0 && (
                  <>
                    <p className="text-[11px]">
                      Desfez um disparo que não chegou e os contatos continuam em espera? Este botão libera só os contatos
                      que ficaram presos hoje por um disparo que já não existe no histórico.
                    </p>
                    <Button size="sm" variant="outline" disabled={liberar.isPending}
                      onClick={() => liberar.mutate({ campanhaId: campanha!.id })}>
                      {liberar.isPending && <Spinner className="size-3.5" />} Liberar contatos presos por disparo desfeito
                    </Button>
                  </>
                )}
              </div>
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
          <Button variant="outline" onClick={onClose} disabled={mutacaoPendente}>{resultado ? "Fechar" : "Cancelar"}</Button>
          {!resultado && !ehGatilho && !!templateWts && prontos > 0 && (
            confirmando ? (
              <Button className="gap-1.5" disabled={mutacaoPendente || !quantidadeValida}
                onClick={() => disparar.mutate({ campanhaId: campanha!.id, quantidade: n })}>
                {disparar.isPending ? <Spinner className="size-3.5" /> : <Send size={14} />}
                {disparar.isPending ? "Enviando..." : `Confirmar envio para ${fmtNum(n)}`}
              </Button>
            ) : (
              <Button className="gap-1.5" disabled={!quantidadeValida || mutacaoPendente} onClick={() => setConfirmando(true)}>
                <Send size={14} /> Revisar e disparar
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
