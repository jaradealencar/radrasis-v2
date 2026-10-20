import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, History, ListChecks, Undo2 } from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarDataBr } from "@shared/campanhas-whatsapp";
import DisparoEnviosDialog from "./DisparoEnviosDialog";
import type { CampanhaLinha } from "./comuns";

type DisparoLinha = RouterOutputs["campanhasWhatsapp"]["historico"]["disparos"][number];

interface Props {
  /** `null` = fechado. */
  campanha: CampanhaLinha | null;
  onClose: () => void;
}

export default function HistoricoDialog({ campanha, onClose }: Props) {
  const utils = trpc.useUtils();
  const [envios, setEnvios] = useState<DisparoLinha | null>(null);
  useEffect(() => { if (!campanha) setEnvios(null); }, [campanha]);
  const { data, isLoading, isError, error } = trpc.campanhasWhatsapp.historico.useQuery(
    { campanhaId: campanha?.id ?? 0 },
    { enabled: !!campanha },
  );
  const desfazer = trpc.campanhasWhatsapp.excluirDisparoApi.useMutation({
    onSuccess: r => {
      utils.campanhasWhatsapp.invalidate();
      toast.success(`Disparo desfeito: ${fmtNum(r.contatosLiberados)} contato(s) voltaram para a lista de prontos.`);
    },
    onError: e => toast.error(e.message),
  });

  return (
    <Dialog open={!!campanha} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History size={18} className="text-slate-600" /> Histórico de disparos</DialogTitle>
          <DialogDescription>{campanha?.nome}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner className="size-6" /></div>
        ) : isError ? (
          <p className="text-sm text-red-700 py-6">Não consegui carregar o histórico: {error.message}</p>
        ) : !data || data.disparos.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><History /></EmptyMedia>
              <EmptyTitle>Nenhum disparo registrado</EmptyTitle>
              <EmptyDescription>Use "Efetuar disparo" na tabela para fazer o primeiro envio desta campanha.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Envio</TableHead>
                  <TableHead className="text-right">Enviados</TableHead>
                  <TableHead className="text-right">Quarentena</TableHead>
                  <TableHead className="text-right">Inválidos</TableHead>
                  <TableHead>Próximo previsto</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.disparos.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-medium">{formatarDataBr(d.enviadoEm)}</div>
                      <div className="text-[11px] text-muted-foreground">registrado {fmtDateTime(d.createdAt)}</div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-700">{fmtNum(d.contatosEnviados)}</TableCell>
                    <TableCell className="text-right text-amber-700">{fmtNum(d.contatosIgnorados)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtNum(d.contatosInvalidos)}</TableCell>
                    <TableCell className="whitespace-nowrap">{d.proximaData ? formatarDataBr(d.proximaData) : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {d.registradoPor ?? "—"} {d.origem === "api" && <Badge variant="outline" className="ml-1">API</Badge>}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {d.arquivoUrl && (
                        <a href={d.arquivoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <ExternalLink size={12} /> {d.arquivoNome ?? "arquivo"}
                        </a>
                      )}
                      {d.observacoes && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{d.observacoes}</p>}
                      {!d.arquivoUrl && !d.observacoes && "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setEnvios(d)}>
                          <ListChecks size={12} /> Ver envios
                        </Button>
                        {d.origem === "api" && (
                          <Button
                            size="sm" variant="outline" className="gap-1 text-xs" disabled={desfazer.isPending}
                            title="Use quando as mensagens não chegaram: o registro some e os contatos voltam para a lista de prontos."
                            onClick={() => {
                              if (window.confirm(`Desfazer este disparo de ${fmtNum(d.contatosEnviados)} contato(s)? Eles voltam para a lista de prontos. Isso NÃO cancela mensagens que já tenham sido entregues.`)) {
                                desfazer.mutate({ disparoId: d.id });
                              }
                            }}
                          >
                            <Undo2 size={12} /> Desfazer
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>

      <DisparoEnviosDialog disparo={envios} campanhaNome={data?.campanha.nome} onClose={() => setEnvios(null)} />
    </Dialog>
  );
}
