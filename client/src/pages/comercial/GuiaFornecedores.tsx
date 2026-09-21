import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Store, Eye, Users, MousePointerClick, MessageCircle, Plus, Trash2, ExternalLink, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Preencher com o domínio do site espelho assim que ele for publicado (ver conversa de
// 21/09/2026) — por ora aponta para o próprio radrasis, só como placeholder.
const URL_SITE_PUBLICO = "";

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export default function GuiaFornecedores() {
  const utils = trpc.useUtils();
  const { data: guia, isLoading: carregandoGuia } = trpc.guiaFornecedores.listarPublico.useQuery();
  const { data: stats, isLoading: carregandoStats } = trpc.guiaFornecedores.getEstatisticas.useQuery();
  const { data: overrides } = trpc.guiaFornecedores.listarOverrides.useQuery();
  const { data: config } = trpc.guiaFornecedores.getConfig.useQuery();

  const [mensagem, setMensagem] = useState<string | null>(null);
  const mensagemAtual = mensagem ?? config?.mensagemWhatsapp ?? "";
  const salvarConfig = trpc.guiaFornecedores.salvarConfig.useMutation({
    onSuccess: () => { utils.guiaFornecedores.getConfig.invalidate(); utils.guiaFornecedores.listarPublico.invalidate(); toast.success("Mensagem salva."); },
    onError: e => toast.error(e.message),
  });

  const [novoOverride, setNovoOverride] = useState<{ empresa: string; acao: "incluir" | "excluir"; telefone: string; cidade: string; estado: string } | null>(null);
  const salvarOverride = trpc.guiaFornecedores.salvarOverride.useMutation({
    onSuccess: () => { utils.guiaFornecedores.listarOverrides.invalidate(); utils.guiaFornecedores.listarPublico.invalidate(); setNovoOverride(null); toast.success("Ajuste salvo."); },
    onError: e => toast.error(e.message),
  });
  const [removendoId, setRemovendoId] = useState<number | null>(null);
  const removerOverride = trpc.guiaFornecedores.removerOverride.useMutation({
    onSuccess: () => { utils.guiaFornecedores.listarOverrides.invalidate(); utils.guiaFornecedores.listarPublico.invalidate(); setRemovendoId(null); toast.success("Ajuste removido."); },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-blue-700" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Guia de Fornecedores</h1>
            <p className="text-sm text-slate-500">
              Página pública (sem login) que indica ao consumidor final os clientes ativos da Letreiros Express, por estado e cidade.
            </p>
          </div>
        </div>
        {URL_SITE_PUBLICO ? (
          <a href={URL_SITE_PUBLICO} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Abrir site público</Button>
          </a>
        ) : (
          <Badge variant="outline" className="text-amber-600 border-amber-300">Site público ainda não publicado</Badge>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Store} label="No guia agora" value={carregandoGuia ? "…" : String(guia?.totalFornecedores ?? 0)} sub={`${guia?.estados.length ?? 0} estados`} />
        <StatCard icon={Eye} label="Visitas (30 dias)" value={carregandoStats ? "…" : String(stats?.visitasTotais ?? 0)} />
        <StatCard icon={Users} label="Visitantes únicos" value={carregandoStats ? "…" : String(stats?.visitantesUnicos ?? 0)} sub="últimos 30 dias" />
        <StatCard icon={MousePointerClick} label="Cliques no WhatsApp" value={carregandoStats ? "…" : String(stats?.cliques.reduce((s, c) => s + c.cliques, 0) ?? 0)} sub="desde o início" />
      </div>

      <p className="text-xs text-slate-400">
        Regra automática: entra quem teve 2+ O.S. válidas nos últimos 12 meses (rolante) e comprou há no máximo 4 meses;
        sai sozinho assim que passar dos 4 meses sem comprar. Os ajustes abaixo funcionam por cima dessa regra.
      </p>

      {/* Mensagem padrão do WhatsApp */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-green-600" />
          <h2 className="text-sm font-semibold text-slate-700">Mensagem padrão do botão de WhatsApp</h2>
        </div>
        <p className="mb-2 text-xs text-slate-400">
          Já vai digitada quando o consumidor clica em qualquer fornecedor. <code>*negrito*</code> é a formatação do próprio WhatsApp.
        </p>
        <Textarea value={mensagemAtual} onChange={e => setMensagem(e.target.value)} rows={3} className="text-sm" />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={!mensagem || mensagem === config?.mensagemWhatsapp || salvarConfig.isPending}
            onClick={() => mensagem && salvarConfig.mutate({ mensagemWhatsapp: mensagem })}
          >
            {salvarConfig.isPending ? "Salvando..." : "Salvar mensagem"}
          </Button>
        </div>
      </div>

      {/* Ajustes manuais */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Ajustes manuais</h2>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNovoOverride({ empresa: "", acao: "excluir", telefone: "", cidade: "", estado: "" })}>
            <Plus className="h-3.5 w-3.5" /> Novo ajuste
          </Button>
        </div>
        {!overrides || overrides.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">Nenhum ajuste manual — a lista está 100% automática.</p>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Dados manuais</TableHead>
                <TableHead>Por</TableHead>
                <TableHead className="text-right">-</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.empresaNome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={o.acao === "incluir" ? "border-green-300 text-green-700" : "border-red-300 text-red-700"}>
                      {o.acao === "incluir" ? "Forçar inclusão" : "Excluir da lista"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">{[o.telefone, o.cidade, o.estado].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell className="text-slate-500">{o.usuarioNome ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-red-600 hover:bg-red-50" onClick={() => setRemovendoId(o.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Ranking de cliques */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Cliques no WhatsApp por fornecedor</h2>
        {carregandoStats ? (
          <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !stats || stats.cliques.length === 0 ? (
          <Empty><EmptyHeader><EmptyTitle>Ainda sem cliques registrados.</EmptyTitle></EmptyHeader></Empty>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead>Último clique</TableHead>
                <TableHead>No guia agora?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.cliques.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{c.empresaNome}</TableCell>
                  <TableCell className="text-right font-mono">{c.cliques}</TableCell>
                  <TableCell className="text-slate-500">{c.ultimoCliqueEm ? new Date(c.ultimoCliqueEm).toLocaleString("pt-BR") : "—"}</TableCell>
                  <TableCell>
                    {c.ativoNoGuia
                      ? <Badge variant="outline" className="border-green-300 text-green-700">Sim</Badge>
                      : <Badge variant="outline" className="border-slate-300 text-slate-500">Não</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Prévia do guia (o que o site público mostra) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Prévia — o que o site público mostra agora</h2>
        {carregandoGuia ? (
          <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !guia || guia.estados.length === 0 ? (
          <Empty><EmptyHeader><EmptyTitle>Nenhum fornecedor qualifica no momento.</EmptyTitle></EmptyHeader></Empty>
        ) : (
          <div className="max-h-[26rem] space-y-4 overflow-y-auto pr-1">
            {guia.estados.map(e => (
              <div key={e.uf}>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>{e.uf} — {e.nome}</span>
                  <span className="text-slate-400">{e.total}</span>
                </div>
                {e.cidades.map(c => (
                  <div key={c.cidade} className="mb-1 flex flex-wrap gap-1 pl-2">
                    <span className="text-[11px] font-medium text-slate-400">{c.cidade}:</span>
                    {c.fornecedores.map(f => (
                      <span key={f.nome} className="text-[11px] text-slate-600">{f.nome}{f.telefone ? "" : " (sem telefone)"};</span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Diálogo: novo ajuste manual */}
      <Dialog open={!!novoOverride} onOpenChange={aberto => { if (!aberto) setNovoOverride(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo ajuste manual</DialogTitle></DialogHeader>
          {novoOverride && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Nome da empresa (como aparece no MubiSys)</label>
                <Input value={novoOverride.empresa} onChange={e => setNovoOverride({ ...novoOverride, empresa: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Ação</label>
                <Select value={novoOverride.acao} onValueChange={(v: "incluir" | "excluir") => setNovoOverride({ ...novoOverride, acao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excluir">Excluir da lista (mesmo que qualifique)</SelectItem>
                    <SelectItem value="incluir">Forçar inclusão (mesmo sem qualificar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {novoOverride.acao === "incluir" && (
                <>
                  <p className="text-xs text-slate-400">
                    Preencha se a empresa não tiver O.S. recente o bastante para puxar isso sozinha.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Telefone (67999998888)" value={novoOverride.telefone} onChange={e => setNovoOverride({ ...novoOverride, telefone: e.target.value })} />
                    <Input placeholder="UF" maxLength={2} value={novoOverride.estado} onChange={e => setNovoOverride({ ...novoOverride, estado: e.target.value.toUpperCase() })} />
                  </div>
                  <Input placeholder="Cidade" value={novoOverride.cidade} onChange={e => setNovoOverride({ ...novoOverride, cidade: e.target.value })} />
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOverride(null)}>Cancelar</Button>
            <Button
              disabled={!novoOverride?.empresa.trim() || salvarOverride.isPending}
              onClick={() => novoOverride && salvarOverride.mutate({
                empresa: novoOverride.empresa, acao: novoOverride.acao,
                telefone: novoOverride.telefone || undefined, cidade: novoOverride.cidade || undefined, estado: novoOverride.estado || undefined,
              })}
            >
              {salvarOverride.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar remoção de ajuste */}
      <AlertDialog open={removendoId !== null} onOpenChange={aberto => { if (!aberto) setRemovendoId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este ajuste?</AlertDialogTitle>
            <AlertDialogDescription>A empresa volta a seguir só a regra automática (2+ compras em 12 meses, ativa há até 4 meses).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => removendoId != null && removerOverride.mutate({ id: removendoId })}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
