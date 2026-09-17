import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { AlertTriangle, MessageCircle, CheckCircle2, Clock } from "lucide-react";
import { fmtBrl } from "@/lib/format";

const VALOR_MINIMO_PADRAO = 8000;

function fmtDataHora(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// dataCadastro vem do historico_orcamentos com datas em formato misto (dd/mm/aaaa
// na maioria, algumas em ISO) — ver memória "Histórico: datas em formato misto".
function extrairDiaDoMes(dataStr: string | null | undefined): number | null {
  if (!dataStr) return null;
  const texto = String(dataStr).trim();
  const br = texto.match(/^(\d{2})\/\d{2}\/\d{4}/);
  if (br) return parseInt(br[1], 10);
  const iso = texto.match(/^\d{4}-\d{2}-(\d{2})/);
  if (iso) return parseInt(iso[1], 10);
  const dt = new Date(texto);
  return isNaN(dt.getTime()) ? null : dt.getDate();
}

export default function PropostasAltoValor({ mes, ano }: { mes: number; ano: number }) {
  const [listaAberta, setListaAberta] = useState(false);
  const [propostaFollowup, setPropostaFollowup] = useState<{ orcNumero: string; empresa: string } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [diaDe, setDiaDe] = useState("");
  const [diaAte, setDiaAte] = useState("");

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.performanceComercial.getPropostasAltoValor.useQuery(
    { mes, ano, valorMinimo: VALOR_MINIMO_PADRAO },
    { enabled: listaAberta || true, staleTime: 5 * 60 * 1000 }
  );

  const registrarFollowup = trpc.performanceComercial.registrarFollowupProposta.useMutation({
    onSuccess: () => {
      utils.performanceComercial.getPropostasAltoValor.invalidate({ mes, ano, valorMinimo: VALOR_MINIMO_PADRAO });
      setPropostaFollowup(null);
      setMotivo("");
    },
  });

  const propostas = data?.propostas ?? [];

  const propostasFiltradas = useMemo(() => {
    const de = diaDe ? parseInt(diaDe, 10) : null;
    const ate = diaAte ? parseInt(diaAte, 10) : null;
    if (de == null && ate == null) return propostas;
    return propostas.filter(p => {
      const dia = extrairDiaDoMes(p.dataCadastro);
      if (dia == null) return true;
      if (de != null && dia < de) return false;
      if (ate != null && dia > ate) return false;
      return true;
    });
  }, [propostas, diaDe, diaAte]);

  function confirmarFollowup() {
    if (!propostaFollowup || motivo.trim().length < 3) return;
    registrarFollowup.mutate({
      orcNumero: propostaFollowup.orcNumero,
      empresa: propostaFollowup.empresa,
      mes,
      ano,
      motivo: motivo.trim(),
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <div>
            <h2 className="text-sm font-semibold text-slate-700">
              Propostas acima de {fmtBrl(VALOR_MINIMO_PADRAO)}
            </h2>
            <p className="text-xs text-slate-400">Propostas em aberto do mês que merecem follow-up prioritário</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setListaAberta(true)}>
          Ver relatório
          {!isLoading && propostas.length > 0 && (
            <Badge variant="secondary" className="ml-2">{propostas.length}</Badge>
          )}
        </Button>
      </div>

      <Dialog open={listaAberta} onOpenChange={setListaAberta}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Propostas acima de {fmtBrl(VALOR_MINIMO_PADRAO)} — em aberto</DialogTitle>
          </DialogHeader>

          {!isLoading && propostas.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span className="font-medium">Filtrar por dia do mês:</span>
              <Input
                type="number" min={1} max={31} placeholder="De"
                value={diaDe} onChange={e => setDiaDe(e.target.value)}
                className="w-16 h-7 text-xs"
              />
              <span>até</span>
              <Input
                type="number" min={1} max={31} placeholder="Até"
                value={diaAte} onChange={e => setDiaAte(e.target.value)}
                className="w-16 h-7 text-xs"
              />
              {(diaDe || diaAte) && (
                <Button
                  size="sm" variant="ghost" className="h-7 px-2 text-xs"
                  onClick={() => { setDiaDe(""); setDiaAte(""); }}
                >
                  Limpar
                </Button>
              )}
              <span className="ml-auto">{propostasFiltradas.length} de {propostas.length} proposta{propostas.length > 1 ? "s" : ""}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center text-sm text-slate-400">Carregando propostas...</div>
          ) : propostas.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">Nenhuma proposta em aberto acima do valor de corte neste mês.</div>
          ) : propostasFiltradas.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">Nenhuma proposta cadastrada nesse intervalo de dias.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propostasFiltradas.map(p => (
                  <TableRow key={p.orcNumero}>
                    <TableCell className="font-medium">
                      {p.empresa}
                      {p.contato && <div className="text-xs text-slate-400">{p.contato}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{p.vendedor}</TableCell>
                    <TableCell className="text-right font-medium">{fmtBrl(p.valor)}</TableCell>
                    <TableCell className="text-sm text-slate-500">{p.dataCadastro}</TableCell>
                    <TableCell>
                      {p.qtdFollowups === 0 ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">Sem contato</Badge>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                            {p.qtdFollowups} contato{p.qtdFollowups > 1 ? "s" : ""}
                          </Badge>
                          <div className="text-xs text-slate-400 flex flex-col gap-0.5">
                            {p.followups.slice(0, 3).map((f: (typeof p.followups)[number]) => (
                              <div key={f.id} className="flex items-start gap-1" title={f.motivo}>
                                <Clock className="w-3 h-3 mt-0.5 shrink-0" />
                                <span className="truncate max-w-[220px]">
                                  <strong>{f.usuarioNome}</strong> ({fmtDataHora(f.contatadoEm)}): {f.motivo}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.whatsappLink && (
                          <a href={p.whatsappLink} target="_blank" rel="noopener noreferrer" title="WhatsApp">
                            <Button size="icon" variant="ghost" className="text-green-600 hover:text-green-700">
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => setPropostaFollowup({ orcNumero: p.orcNumero, empresa: p.empresa })}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Contato realizado
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!propostaFollowup} onOpenChange={(open) => { if (!open) { setPropostaFollowup(null); setMotivo(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar contato — {propostaFollowup?.empresa}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600">O que foi feito nesse follow-up?</label>
            <Textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: liguei e o cliente pediu para retornar semana que vem"
              rows={4}
              autoFocus
            />
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => { setPropostaFollowup(null); setMotivo(""); }}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarFollowup}
              disabled={motivo.trim().length < 3 || registrarFollowup.isPending}
            >
              {registrarFollowup.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
