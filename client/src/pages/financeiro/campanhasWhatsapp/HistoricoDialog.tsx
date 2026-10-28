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
      <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
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
          <div className="rounded-md border">
            <Table className="min-w-[1185px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Envio</TableHead>
                  <TableHead className="w-[82px] text-right">Enviados</TableHead>
                  <TableHead className="w-[92px] text-right">Quarentena</TableHead>
                  <TableHead className="w-[78px] text-right">Inválidos</TableHead>
                  <TableHead className="w-[122px]">Próximo previsto</TableHead>
                  <TableHead className="w-[145px]">Registrado por</TableHead>
                  <TableHead className="w-[270px]">Observações</TableHead>
                  <TableHead className="w-[226px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.disparos.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="w-[170px] min-w-[170px] whitespace-nowrap">
                      <div className="font-medium">{formatarDataBr(d.enviadoEm)}</div>
                      <div className="text-[11px] text-muted-foreground">registrado {fmtDateTime(d.createdAt)}</div>
                    </TableCell>
                    <TableCell className="w-[82px] min-w-[82px] text-right font-medium text-emerald-700">{fmtNum(d.contatosEnviados)}</TableCell>
                    <TableCell className="w-[92px] min-w-[92px] text-right text-amber-700">{fmtNum(d.contatosIgnorados)}</TableCell>
                    <TableCell className="w-[78px] min-w-[78px] text-right text-muted-foreground">{fmtNum(d.contatosInvalidos)}</TableCell>
                    <TableCell className="w-[122px] min-w-[122px] whitespace-nowrap">{d.proximaData ? formatarDataBr(d.proximaData) : "—"}</TableCell>
                    <TableCell className="w-[145px] min-w-[145px] whitespace-normal break-words">
                      {d.registradoPor ?? "—"} {d.origem === "api" && <Badge variant="outline" className="ml-1">API</Badge>}
                    </TableCell>
                    <TableCell className="w-[270px] min-w-[270px] max-w-[270px] whitespace-normal align-top">
                      {d.arquivoUrl && (
                        <a href={d.arquivoUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 break-all text-xs text-blue-600 hover:underline">
                          <ExternalLink size={12} /> {d.arquivoNome ?? "arquivo"}
                        </a>
                      )}
                      {d.observacoes && <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{d.observacoes}</p>}
                      {!d.arquivoUrl && !d.observacoes && "—"}
                    </TableCell>
                    <TableCell className="w-[226px] min-w-[226px] whitespace-normal align-top text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="shrink-0 gap-1 whitespace-nowrap text-xs" onClick={() => setEnvios(d)}>
                          <ListChecks size={12} /> Ver envios
                        </Button>
                        {d.origem === "api" && (
                          <Button
                            size="sm" variant="outline" className="shrink-0 gap-1 whitespace-nowrap text-xs" disabled={desfazer.isPending}
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
