import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, ListChecks, Plus, RefreshCw } from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  classificarStatusWts, formatarDataBr, formatarTelefone, STATUS_WTS_LABEL, type StatusWtsClasse,
} from "@shared/campanhas-whatsapp";

type Disparo = RouterOutputs["campanhasWhatsapp"]["historico"]["disparos"][number];
type Item = RouterOutputs["campanhasWhatsapp"]["listarItensDisparo"]["itens"][number];
type Resumo = RouterOutputs["campanhasWhatsapp"]["listarItensDisparo"]["resumo"];

interface Props {
  /** `null` = fechado. */
  disparo: Disparo | null;
  campanhaNome: string | undefined;
  onClose: () => void;
}

const ESTILO_STATUS: Record<StatusWtsClasse, string> = {
  lido: "bg-emerald-100 text-emerald-700 border-emerald-200",
  entregue: "bg-sky-100 text-sky-700 border-sky-200",
  na_fila: "bg-amber-100 text-amber-800 border-amber-200",
  falha: "bg-red-100 text-red-700 border-red-200",
  sem_consulta: "bg-slate-100 text-slate-600 border-slate-200",
};

function StatusBadge({ status }: { status: string | null }) {
  const classe = classificarStatusWts(status);
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ESTILO_STATUS[classe]}`}>
      {status ? status : STATUS_WTS_LABEL[classe]}
    </span>
  );
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="rounded-lg border p-2 text-center min-w-0">
      <div className={`text-lg font-bold ${cor}`}>{fmtNum(valor)}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight break-words">{rotulo}</div>
    </div>
  );
}

/** Linha colada: "telefone", "telefone, nome" ou "telefone, nome, idDaMensagem" (vírgula ou tab). */
function lerLinhasManual(texto: string): Array<{ telefone: string; nome: string | null; wtsMensagemId: string | null }> {
  return texto
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(linha => {
      const partes = linha.split(/[,\t]+/).map(p => p.trim());
      return { telefone: partes[0] ?? "", nome: partes[1] || null, wtsMensagemId: partes[2] || null };
    })
    .filter(item => item.telefone);
}

/**
 * "Ver envios" (pedido do usuário, 19/10/2026): lista os números de um disparo específico com o status de cada
 * mensagem (consultado sob demanda na Ceci/WTS.Chat, nunca automaticamente ao abrir). Disparos sem itens ainda
 * (antigos, upload manual, webhook REST) podem ser preenchidos à mão na seção "Adicionar lista manualmente".
 */
export default function DisparoEnviosDialog({ disparo, campanhaNome, onClose }: Props) {
  const utils = trpc.useUtils();
  const [mostrarManual, setMostrarManual] = useState(false);
  const [textoManual, setTextoManual] = useState("");

  const { data, isLoading, isError, error } = trpc.campanhasWhatsapp.listarItensDisparo.useQuery(
    { disparoId: disparo?.id ?? 0 }, { enabled: !!disparo },
  );

  const atualizar = trpc.campanhasWhatsapp.atualizarStatusItensDisparo.useMutation({
    onSuccess: r => {
      utils.campanhasWhatsapp.listarItensDisparo.invalidate({ disparoId: disparo?.id });
      toast.success(`${fmtNum(r.consultados)} status consultado(s) e atualizado(s).`);
    },
    onError: e => toast.error(e.message),
  });

  const salvarManual = trpc.campanhasWhatsapp.salvarItensDisparoManual.useMutation({
    onSuccess: r => {
      utils.campanhasWhatsapp.listarItensDisparo.invalidate({ disparoId: disparo?.id });
      if (r.adicionados > 0) toast.success(`${fmtNum(r.adicionados)} item(ns) adicionado(s) à lista.`);
      if (r.invalidos.length > 0) {
        toast.warning(`${fmtNum(r.invalidos.length)} linha(s) sem telefone válido: ${r.invalidos.slice(0, 3).join(", ")}${r.invalidos.length > 3 ? "…" : ""}`);
      }
      if (r.adicionados > 0 && r.invalidos.length === 0) { setTextoManual(""); setMostrarManual(false); }
    },
    onError: e => toast.error(e.message),
  });

  const itens: Item[] = data?.itens ?? [];
  const resumo: Resumo | undefined = data?.resumo;
  const temIdParaConsultar = itens.some(i => i.wtsMensagemId);
  const linhasLidas = lerLinhasManual(textoManual);

  return (
    <Dialog open={!!disparo} onOpenChange={v => { if (!v) { onClose(); setMostrarManual(false); setTextoManual(""); } }}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ListChecks size={18} className="text-slate-600" /> Envios do disparo</DialogTitle>
          <DialogDescription>
            {campanhaNome} · {disparo ? formatarDataBr(disparo.enviadoEm) : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner className="size-6 text-muted-foreground" /></div>
        ) : isError ? (
          <p className="text-sm text-red-700 py-6">Não consegui carregar os envios: {error.message}</p>
        ) : (
          <div className="space-y-4">
            {resumo && (
              <div className="grid grid-cols-5 gap-1.5">
                <Numero rotulo="Lidos" valor={resumo.lido} cor="text-emerald-700" />
                <Numero rotulo="Entregues" valor={resumo.entregue} cor="text-sky-700" />
                <Numero rotulo="Na fila" valor={resumo.na_fila} cor="text-amber-700" />
                <Numero rotulo="Falhas" valor={resumo.falha} cor="text-red-700" />
                <Numero rotulo="Sem consulta" valor={resumo.sem_consulta} cor="text-slate-600" />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm" variant="outline" className="gap-1.5" disabled={atualizar.isPending || !temIdParaConsultar}
                title={temIdParaConsultar ? undefined : "Nenhum item tem ID de mensagem — adicione um na lista manual para poder consultar."}
                onClick={() => disparo && atualizar.mutate({ disparoId: disparo.id })}
              >
                {atualizar.isPending ? <Spinner className="size-3.5" /> : <RefreshCw size={14} />}
                {atualizar.isPending ? "Consultando..." : "Atualizar status"}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setMostrarManual(v => !v)}>
                <ClipboardList size={14} /> {mostrarManual ? "Fechar lista manual" : "Adicionar lista manualmente"}
              </Button>
            </div>

            {mostrarManual && (
              <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  Um item por linha: <code>telefone</code>, <code>telefone, nome</code> ou{" "}
                  <code>telefone, nome, idDaMensagem</code>. Sem o ID da mensagem, o status desse item não pode
                  ser consultado depois.
                </p>
                <Textarea
                  rows={5} value={textoManual} onChange={e => setTextoManual(e.target.value)}
                  placeholder={"(67) 99999-0000, Ana\n(67) 98888-1111, Bia, c289e59e-f57e-4010-8363-3a72b3558232"}
                />
                <Button
                  size="sm" className="gap-1.5" disabled={linhasLidas.length === 0 || salvarManual.isPending}
                  onClick={() => disparo && salvarManual.mutate({ disparoId: disparo.id, itens: linhasLidas })}
                >
                  {salvarManual.isPending ? <Spinner className="size-3.5" /> : <Plus size={14} />}
                  Adicionar{linhasLidas.length > 0 ? ` ${fmtNum(linhasLidas.length)}` : ""}
                </Button>
              </div>
            )}

            {itens.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><ListChecks /></EmptyMedia>
                  <EmptyTitle>Nenhum envio detalhado ainda</EmptyTitle>
                  <EmptyDescription>
                    Este disparo não tem a lista de números salva (comum em disparos antigos ou registrados por
                    upload/webhook). Use "Adicionar lista manualmente" para preenchê-la.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Consultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">{formatarTelefone(item.telefone)}</TableCell>
                        <TableCell>{item.nome || "—"}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {item.statusConsultadoEm ? fmtDateTime(item.statusConsultadoEm) : (item.wtsMensagemId ? "nunca" : "sem ID")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
