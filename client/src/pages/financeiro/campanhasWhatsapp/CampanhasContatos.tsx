import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2, Plus, Search, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarDataBr } from "@shared/campanhas-whatsapp";

type CampanhaOpcao = { id: number; nome: string };

export default function CampanhasContatos({ campanhas }: { campanhas: CampanhaOpcao[] }) {
  const utils = trpc.useUtils();
  const [busca, setBusca] = useState("");
  const [offset, setOffset] = useState(0);
  const [abrirNovo, setAbrirNovo] = useState(false);
  const [novoTelefone, setNovoTelefone] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [campanhaOrigemId, setCampanhaOrigemId] = useState("");
  const [contatoAberto, setContatoAberto] = useState<number | null>(null);
  const consulta = trpc.campanhasWhatsapp.contatos.listar.useQuery({ busca, limite: 50, offset });
  const criar = trpc.campanhasWhatsapp.contatos.criar.useMutation({
    onSuccess: ({ id }) => {
      toast.success("Contato cadastrado.");
      setAbrirNovo(false);
      setNovoTelefone(""); setNovoNome(""); setCampanhaOrigemId("");
      setContatoAberto(id);
      void utils.campanhasWhatsapp.contatos.listar.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  return (
    <div className="space-y-4 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xl">
          <h3 className="font-semibold text-slate-800">Contatos e histórico de tentativas</h3>
          <p className="text-sm text-muted-foreground">O telefone identifica o lead inicialmente. Vínculos com MubiSys, orçamentos e O.S. exigem confirmação manual registrada.</p>
        </div>
        <Button onClick={() => setAbrirNovo(true)} className="gap-1.5"><Plus size={15} /> Novo contato</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input value={busca} onChange={event => { setBusca(event.target.value); setOffset(0); }} placeholder="Buscar por nome ou telefone" className="pl-9" />
      </div>

      {consulta.isLoading ? <div className="flex justify-center py-10"><Spinner className="size-6" /></div> : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Contato</TableHead><TableHead>Telefones</TableHead><TableHead>Campanhas</TableHead><TableHead>Tentativas</TableHead><TableHead>Origem inicial</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {(consulta.data?.contatos ?? []).map((contato: any) => (
                <TableRow key={contato.id}>
                  <TableCell><div className="font-medium">{contato.nome || "Sem nome"}</div><div className="text-xs text-muted-foreground">Contato #{contato.id} · desde {fmtDate(contato.createdAt)}</div></TableCell>
                  <TableCell className="max-w-64 whitespace-normal text-sm">{contato.telefones.map((telefone: string) => <div key={telefone}>{telefone}</div>)}</TableCell>
                  <TableCell>{contato.totalCampanhas}</TableCell><TableCell>{contato.historicoCompleto ? contato.totalTentativas : `≥ ${contato.totalTentativas}`}</TableCell>
                  <TableCell>{contato.campanhaOrigemNome || contato.origem}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setContatoAberto(contato.id)}>Detalhes</Button></TableCell>
                </TableRow>
              ))}
              {!consulta.isLoading && (consulta.data?.contatos.length ?? 0) === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Nenhum contato encontrado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{consulta.data?.total ?? 0} contatos</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={offset + 50 >= (consulta.data?.total ?? 0)} onClick={() => setOffset(value => value + 50)}>Próxima</Button>
        </div>
      </div>

      <Dialog open={abrirNovo} onOpenChange={setAbrirNovo}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo contato de campanha</DialogTitle><DialogDescription>O número precisa ser único. Para números internacionais, informe o DDI com + ou 00.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="lead-phone">Telefone</Label><Input id="lead-phone" value={novoTelefone} onChange={event => setNovoTelefone(event.target.value)} placeholder="+44 20 7946 0958" /></div>
            <div className="space-y-1.5"><Label htmlFor="lead-name">Nome</Label><Input id="lead-name" value={novoNome} onChange={event => setNovoNome(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="lead-origin">Campanha de origem (opcional)</Label>
              <select id="lead-origin" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={campanhaOrigemId} onChange={event => setCampanhaOrigemId(event.target.value)}>
                <option value="">Sem campanha de origem</option>{campanhas.map(campanha => <option key={campanha.id} value={campanha.id}>{campanha.nome}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAbrirNovo(false)}>Cancelar</Button><Button disabled={criar.isPending || !novoTelefone.trim()} onClick={() => criar.mutate({ telefone: novoTelefone, nome: novoNome, campanhaOrigemId: campanhaOrigemId ? Number(campanhaOrigemId) : null })}>{criar.isPending ? <Spinner /> : "Cadastrar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <DetalheContatoDialog contatoId={contatoAberto} onClose={() => setContatoAberto(null)} />
    </div>
  );
}

function DetalheContatoDialog({ contatoId, onClose }: { contatoId: number | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [novoFone, setNovoFone] = useState("");
  const [nome, setNome] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"mubisys_cliente" | "orcamento" | "ordem_servico">("mubisys_cliente");
  const [chave, setChave] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const consulta = trpc.campanhasWhatsapp.contatos.detalhar.useQuery({ contatoId: contatoId ?? 0 }, { enabled: contatoId !== null });
  useEffect(() => {
    setNovoFone(""); setNome(null); setTipo("mubisys_cliente"); setChave(""); setJustificativa("");
  }, [contatoId]);
  const atualizar = () => {
    void utils.campanhasWhatsapp.contatos.detalhar.invalidate({ contatoId: contatoId ?? 0 });
    void utils.campanhasWhatsapp.contatos.listar.invalidate();
  };
  const mutacao = (success: string) => ({ onSuccess: () => { toast.success(success); atualizar(); }, onError: (error: { message: string }) => toast.error(error.message) });
  const adicionarTelefone = trpc.campanhasWhatsapp.contatos.adicionarTelefone.useMutation(mutacao("Telefone associado ao contato."));
  const renomear = trpc.campanhasWhatsapp.contatos.renomear.useMutation(mutacao("Nome atualizado."));
  const vincular = trpc.campanhasWhatsapp.contatos.vincularEntidade.useMutation({
    ...mutacao("Vínculo registrado."),
    onSuccess: () => { toast.success("Vínculo registrado."); setChave(""); setJustificativa(""); atualizar(); },
  });
  const desvincular = trpc.campanhasWhatsapp.contatos.desvincularEntidade.useMutation(mutacao("Vínculo desfeito e registrado na auditoria."));
  const registro = consulta.data;

  return (
    <Dialog open={contatoId !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader><DialogTitle>Identidade do contato {contatoId ? `#${contatoId}` : ""}</DialogTitle><DialogDescription>As tentativas são registros históricos; o status do provedor é exibido somente quando existe para aquele envio.</DialogDescription></DialogHeader>
        {consulta.isLoading || !registro ? <div className="flex justify-center py-10"><Spinner className="size-6" /></div> : (
          <div className="space-y-6">
            <section className="rounded-lg border p-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-56 flex-1 space-y-1.5"><Label>Nome</Label><Input value={nome ?? registro.contato.nome ?? ""} onChange={event => setNome(event.target.value)} placeholder="Nome do contato" /></div>
                <Button variant="outline" disabled={renomear.isPending} onClick={() => renomear.mutate({ contatoId: registro.contato.id, nome: nome ?? registro.contato.nome ?? "" })}>Salvar nome</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Origem inicial: {registro.contato.campanhaOrigemNome || registro.contato.origem} · criado em {fmtDate(registro.contato.createdAt)}</p>
              <div className="mt-3 flex flex-wrap gap-2">{registro.telefones.map((telefone: any) => <span key={telefone.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm" title={`Valores originais: ${(telefone.valoresOriginais ?? []).join(" · ")}`}>{telefone.telefoneE164}</span>)}</div>
              <div className="mt-3 flex flex-wrap gap-2"><Input className="max-w-sm" value={novoFone} onChange={event => setNovoFone(event.target.value)} placeholder="Adicionar outro telefone" /><Button size="sm" variant="outline" disabled={!novoFone.trim() || adicionarTelefone.isPending} onClick={() => adicionarTelefone.mutate({ contatoId: registro.contato.id, telefone: novoFone }, { onSuccess: () => setNovoFone("") })}><Plus size={14} className="mr-1" />Adicionar telefone</Button></div>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">Campanhas e tentativas</h3>
              <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Campanha</TableHead><TableHead>Tentativas</TableHead><TableHead>Primeira conhecida</TableHead><TableHead>Última conhecida</TableHead></TableRow></TableHeader><TableBody>
                {registro.campanhas.map((item: any, i: number) => <TableRow key={`${item.campanhaId}-${i}`}><TableCell>{item.campanhaNome} <span className="text-xs text-muted-foreground">(#{item.campanhaId})</span></TableCell><TableCell>{item.historicoCompleto ? item.tentativas : `≥ ${item.tentativas} conhecidas`}</TableCell><TableCell>{fmtDateTime(item.primeiraTentativaEm)}</TableCell><TableCell>{fmtDateTime(item.ultimaTentativaEm)}</TableCell></TableRow>)}
                {registro.campanhas.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Ainda sem tentativas registradas.</TableCell></TableRow>}
              </TableBody></Table></div>
              <div className="max-h-64 overflow-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Campanha</TableHead><TableHead>Telefone original</TableHead><TableHead>Resultado</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
                {registro.tentativas.map((item: any) => <TableRow key={item.id}><TableCell>{item.dataEnvio ? formatarDataBr(item.dataEnvio) : fmtDateTime(item.ocorridoEm)}</TableCell><TableCell>{item.campanhaNome}</TableCell><TableCell>{item.telefoneOriginal}</TableCell><TableCell>{item.resultado}</TableCell><TableCell>{item.statusProvedor ?? "sem consulta"}</TableCell></TableRow>)}
              </TableBody></Table></div>
            </section>

            <section className="space-y-3">
              <div><h3 className="font-semibold">Vínculos com registros do MubiSys</h3><p className="text-xs text-muted-foreground">Sugestões abaixo usam telefone exato e precisam de confirmação humana. Nome parecido não cria vínculo.</p></div>
              <div className="grid gap-2 md:grid-cols-3">
                {([
                  ["Clientes", registro.sugestoes.clientes], ["Orçamentos", registro.sugestoes.orcamentos], ["O.S.", registro.sugestoes.ordensServico],
                ] as Array<[string, any[]]>).map(([rotulo, lista]) => <div key={rotulo} className="rounded-lg border p-3"><div className="mb-2 text-sm font-medium">{rotulo} ({lista.length})</div>{lista.length === 0 ? <div className="text-xs text-muted-foreground">Sem correspondência exata por telefone.</div> : lista.slice(0, 5).map((item: any) => <button key={`${item.tipo}-${item.chave}`} className="mb-1 block w-full rounded p-1 text-left text-xs hover:bg-slate-100" onClick={() => { setTipo(item.tipo); setChave(String(item.chave)); }}>{item.rotulo} · {item.chave}</button>)}</div>)}
              </div>
              <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-[10rem_12rem_1fr_auto]">
                <select className="h-9 rounded-md border bg-background px-2 text-sm" value={tipo} onChange={event => setTipo(event.target.value as typeof tipo)}><option value="mubisys_cliente">Cliente</option><option value="orcamento">Orçamento</option><option value="ordem_servico">O.S.</option></select>
                <Input value={chave} onChange={event => setChave(event.target.value)} placeholder="ID do registro" />
                <Input value={justificativa} onChange={event => setJustificativa(event.target.value)} placeholder="Justificativa (mín. 8 caracteres)" />
                <Button disabled={!chave.trim() || justificativa.trim().length < 8 || vincular.isPending} onClick={() => vincular.mutate({ contatoId: registro.contato.id, entidade: { tipo, chave }, justificativa })}><Link2 size={14} className="mr-1" />Vincular</Button>
              </div>
              <div className="space-y-2">
                {registro.vinculos.map((vinculo: any) => <div key={vinculo.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"><div><div className="font-medium">{vinculo.rotulo}</div><div className="text-xs text-muted-foreground">{vinculo.tipo} · {vinculo.chave} · {vinculo.vinculadoPorNome} · {fmtDateTime(vinculo.createdAt)}</div></div><Button size="sm" variant="outline" onClick={() => { const motivo = window.prompt("Informe o motivo do desfazimento (mínimo 8 caracteres):"); if (motivo && motivo.trim().length >= 8) desvincular.mutate({ vinculoId: vinculo.id, justificativa: motivo.trim() }); }}><X size={14} className="mr-1" />Desvincular</Button></div>)}
              </div>
              <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Auditoria de vínculos ({registro.auditoria.length})</summary><div className="mt-2 space-y-1 text-xs text-muted-foreground">{registro.auditoria.map((evento: any) => <div key={evento.id}>{fmtDateTime(evento.createdAt)} · {evento.acao} · {evento.tipo} {evento.chave} · {evento.usuarioNome}: {evento.justificativa}</div>)}</div></details>
            </section>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
