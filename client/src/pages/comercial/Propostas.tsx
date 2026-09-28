import { useEffect, useState } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { FileText, Plus, Search, Trash2, ArrowLeft, Link as LinkIcon, Settings2, Download, FileDown } from "lucide-react";
import { fmtBrl, fmtDateTime } from "@/lib/format";
import { enviarArquivo } from "@/lib/upload";
import { gerarPdfProposta } from "@/lib/pdfProposta";

const FORMAS_PAGAMENTO = ["À vista", "Cartão de crédito", "Boleto", "PIX", "Transferência"];

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
};

function linkPublico(token: string): string {
  return `${window.location.origin}/proposta/${token}`;
}

export default function Propostas() {
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Propostas"
        description="Monte uma cotação a partir do catálogo de Produtos e gere um link para o cliente."
        icon={FileText}
      />

      <Tabs defaultValue="propostas">
        <TabsList>
          <TabsTrigger value="propostas">Propostas</TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-1.5"><Settings2 className="w-3.5 h-3.5" /> Configurações</TabsTrigger>
        </TabsList>
        <TabsContent value="propostas" className="space-y-4 mt-4">
          {selecionadoId === null ? (
            <ListaPropostas onSelecionar={setSelecionadoId} />
          ) : (
            <DetalheProposta id={selecionadoId} onVoltar={() => setSelecionadoId(null)} />
          )}
        </TabsContent>
        <TabsContent value="configuracoes" className="mt-4">
          <ConfiguracoesComerciais />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Lista de propostas ─────────────────────────────────────────────────────

function ListaPropostas({ onSelecionar }: { onSelecionar: (id: number) => void }) {
  const utils = trpc.useUtils();
  const { data: lista, isLoading } = trpc.propostas.listar.useQuery();
  const [criando, setCriando] = useState(false);
  const [clienteNome, setClienteNome] = useState("");
  const [vendedorNome, setVendedorNome] = useState("");

  const criar = trpc.propostas.criar.useMutation({
    onSuccess: (r) => {
      toast.success("Proposta criada");
      utils.propostas.listar.invalidate();
      setCriando(false);
      setClienteNome("");
      setVendedorNome("");
      onSelecionar(r.id);
    },
    onError: (e) => toast.error("Erro ao criar proposta", { description: e.message }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Propostas</CardTitle>
        {!criando && (
          <Button size="sm" onClick={() => setCriando(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Nova proposta
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {criando && (
          <div className="border rounded-lg p-3 flex flex-wrap items-end gap-3 bg-muted/30">
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Input className="w-56" value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Nome do cliente" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vendedor</Label>
              <Input className="w-48" value={vendedorNome} onChange={(e) => setVendedorNome(e.target.value)} placeholder="Nome do vendedor" />
            </div>
            <Button
              size="sm"
              disabled={!clienteNome.trim() || !vendedorNome.trim() || criar.isPending}
              onClick={() => criar.mutate({ clienteNome, vendedorNome })}
            >
              Criar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCriando(false)}>Cancelar</Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : !lista || lista.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileText /></EmptyMedia>
              <EmptyTitle>Nenhuma proposta criada</EmptyTitle>
              <EmptyDescription>Crie uma proposta e adicione produtos do catálogo pra gerar o link do cliente.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelecionar(p.id)}>
                  <TableCell className="font-medium">{p.clienteNome}</TableCell>
                  <TableCell className="text-muted-foreground">{p.vendedorNome}</TableCell>
                  <TableCell>{p.qtdItens}</TableCell>
                  <TableCell>{fmtBrl(p.valorTotal)}</TableCell>
                  <TableCell><Badge variant="secondary">{STATUS_LABEL[p.status] ?? p.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{fmtDateTime(p.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Detalhe de uma proposta ────────────────────────────────────────────────

function DetalheProposta({ id, onVoltar }: { id: number; onVoltar: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.propostas.obter.useQuery({ id });

  const [clienteNome, setClienteNome] = useState("");
  const [clienteContato, setClienteContato] = useState("");
  const [vendedorNome, setVendedorNome] = useState("");
  const [formasPagamento, setFormasPagamento] = useState<string[]>([]);
  const [condicaoPagamentoObs, setCondicaoPagamentoObs] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState<"aberta" | "aceita" | "recusada" | "expirada">("aberta");

  useEffect(() => {
    if (!data) return;
    setClienteNome(data.proposta.clienteNome);
    setClienteContato(data.proposta.clienteContato ?? "");
    setVendedorNome(data.proposta.vendedorNome);
    setFormasPagamento(JSON.parse(data.proposta.formasPagamentoJson || "[]"));
    setCondicaoPagamentoObs(data.proposta.condicaoPagamentoObs ?? "");
    setObservacoes(data.proposta.observacoes ?? "");
    setStatus(data.proposta.status);
  }, [data?.proposta.id]);

  const salvar = trpc.propostas.atualizar.useMutation({
    onSuccess: () => {
      toast.success("Proposta atualizada");
      utils.propostas.obter.invalidate({ id });
      utils.propostas.listar.invalidate();
    },
    onError: (e) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const remover = trpc.propostas.remover.useMutation({
    onSuccess: () => {
      toast.success("Proposta removida");
      utils.propostas.listar.invalidate();
      onVoltar();
    },
    onError: (e) => toast.error("Erro ao remover", { description: e.message }),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const toggleForma = (forma: string) => {
    setFormasPagamento((prev) => (prev.includes(forma) ? prev.filter((f) => f !== forma) : [...prev, forma]));
  };

  const handleSalvar = () => {
    salvar.mutate({
      id,
      clienteNome,
      clienteContato: clienteContato || undefined,
      vendedorNome,
      formasPagamento,
      condicaoPagamentoObs: condicaoPagamentoObs || undefined,
      observacoes: observacoes || undefined,
      status,
    });
  };

  const link = linkPublico(data.proposta.token);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onVoltar} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              gerarPdfProposta({
                clienteNome: data.proposta.clienteNome,
                vendedorNome: data.proposta.vendedorNome,
                createdAt: data.proposta.createdAt,
                itens: data.itens,
                valorTotal: data.valorTotal,
                prazoFabricacaoDiasUteis: data.prazoFabricacaoDiasUteis,
                formasPagamento: JSON.parse(data.proposta.formasPagamentoJson || "[]"),
                condicaoPagamentoObs: data.proposta.condicaoPagamentoObs,
              })
            }
          >
            <FileDown className="w-4 h-4" /> Gerar PDF
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => confirm(`Remover a proposta de "${data.proposta.clienteNome}"?`) && remover.mutate({ id })}
          >
            <Trash2 className="w-4 h-4" /> Remover
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da proposta</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LinkIcon className="w-3.5 h-3.5" />
            <code className="bg-muted px-1.5 py-0.5 rounded">{link}</code>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}
            >
              Copiar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente</Label>
            <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contato do cliente</Label>
            <Input value={clienteContato} onChange={(e) => setClienteContato(e.target.value)} placeholder="Telefone/e-mail" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vendedor</Label>
            <Input value={vendedorNome} onChange={(e) => setVendedorNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Formas de pagamento aceitas</Label>
            <div className="flex flex-wrap gap-3 pt-1">
              {FORMAS_PAGAMENTO.map((forma) => (
                <label key={forma} className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={formasPagamento.includes(forma)} onCheckedChange={() => toggleForma(forma)} />
                  {forma}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-3 space-y-1.5">
            <Label className="text-xs">Condição de pagamento (observação)</Label>
            <Textarea value={condicaoPagamentoObs} onChange={(e) => setCondicaoPagamentoObs(e.target.value)} rows={2} placeholder="Ex: 50% de entrada, saldo na entrega" />
          </div>
          <div className="sm:col-span-3 space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>
          <div className="sm:col-span-3">
            <Button size="sm" onClick={handleSalvar} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar dados da proposta"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-4 space-y-1">
            <p className="text-xs text-muted-foreground">Valor total (itens ativos)</p>
            <p className="text-lg font-semibold">{fmtBrl(data.valorTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 space-y-1">
            <p className="text-xs text-muted-foreground">Prazo de fabricação</p>
            <p className="text-lg font-semibold">
              {data.prazoFabricacaoDiasUteis != null ? `${data.prazoFabricacaoDiasUteis} dias úteis` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <ItensProposta propostaId={id} itens={data.itens} />
    </div>
  );
}

// ─── Itens da proposta ──────────────────────────────────────────────────────

function ItensProposta({
  propostaId,
  itens,
}: {
  propostaId: number;
  itens: NonNullable<RouterOutputs["propostas"]["obter"]>["itens"];
}) {
  const utils = trpc.useUtils();
  const { data: produtosCadastrados } = trpc.produtos.listar.useQuery();
  const [busca, setBusca] = useState("");
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [precoUnitario, setPrecoUnitario] = useState("");

  const { data: produtoDetalhe } = trpc.produtos.obter.useQuery(
    { id: Number(produtoSelecionadoId) },
    { enabled: !!produtoSelecionadoId },
  );

  useEffect(() => {
    if (produtoDetalhe) setPrecoUnitario(String(produtoDetalhe.custoComFixo.toFixed(2)));
  }, [produtoDetalhe?.produto.id]);

  const adicionar = trpc.propostas.itemAdicionar.useMutation({
    onSuccess: () => {
      toast.success("Item adicionado");
      utils.propostas.obter.invalidate({ id: propostaId });
      setProdutoSelecionadoId("");
      setQuantidade("1");
      setPrecoUnitario("");
      setBusca("");
    },
    onError: (e) => toast.error("Erro ao adicionar item", { description: e.message }),
  });

  const remover = trpc.propostas.itemRemover.useMutation({
    onSuccess: () => utils.propostas.obter.invalidate({ id: propostaId }),
    onError: (e) => toast.error("Erro ao remover", { description: e.message }),
  });

  const opcoes = (produtosCadastrados ?? []).filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()));

  const handleAdicionar = () => {
    const qtd = parseFloat(quantidade.replace(",", "."));
    const preco = parseFloat(precoUnitario.replace(",", "."));
    if (!produtoSelecionadoId || isNaN(qtd) || qtd <= 0 || isNaN(preco) || preco < 0) {
      toast.error("Preencha produto, quantidade e preço corretamente");
      return;
    }
    adicionar.mutate({ propostaId, produtoId: Number(produtoSelecionadoId), quantidade: qtd, precoUnitario: preco });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Itens da proposta</CardTitle>
        <p className="text-xs text-muted-foreground">Produtos vêm do catálogo cadastrado em Comercial &gt; Produtos.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 border rounded-lg p-3 bg-muted/30">
          <div className="space-y-1">
            <Label className="text-xs">Produto</Label>
            <div className="flex gap-2">
              <Input className="w-48 h-8 text-xs" placeholder="Filtrar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              <Select value={produtoSelecionadoId} onValueChange={setProdutoSelecionadoId}>
                <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {opcoes.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quantidade</Label>
            <Input className="w-24 h-8 text-xs" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preço de venda (un.)</Label>
            <Input className="w-32 h-8 text-xs" value={precoUnitario} onChange={(e) => setPrecoUnitario(e.target.value)} />
            {produtoDetalhe && (
              <p className="text-[11px] text-muted-foreground">custo: {fmtBrl(produtoDetalhe.custoComFixo)}</p>
            )}
          </div>
          <Button size="sm" onClick={handleAdicionar} disabled={adicionar.isPending}>Adicionar</Button>
        </div>

        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item adicionado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Preço unit.</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>Prazo (d.ú.)</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => (
                <TableRow key={item.id} className={!item.ativo ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{item.produtoNome}</TableCell>
                  <TableCell>{Number(item.quantidade)}</TableCell>
                  <TableCell>{fmtBrl(Number(item.precoUnitario))}</TableCell>
                  <TableCell>{fmtBrl(Number(item.precoUnitario) * Number(item.quantidade))}</TableCell>
                  <TableCell>{item.prazoFabricacaoDiasUteis ?? "—"}</TableCell>
                  <TableCell>{item.ativo ? "Sim" : "Desligado pelo cliente"}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remover.mutate({ id: item.id })}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Configurações comerciais (condições + juros) ───────────────────────────

function ConfiguracoesComerciais() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.propostas.configuracoesObter.useQuery();
  const [juros, setJuros] = useState<{ parcelas: string; jurosPct: string }[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!data) return;
    setJuros(data.jurosParcelamento.map((j: { parcelas: number; jurosPct: number }) => ({ parcelas: String(j.parcelas), jurosPct: String(j.jurosPct) })));
  }, [data?.updatedAt]);

  const salvar = trpc.propostas.configuracoesSalvar.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas");
      utils.propostas.configuracoesObter.invalidate();
    },
    onError: (e) => toast.error("Erro ao salvar", { description: e.message }),
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  const handleUpload = async (file: File) => {
    setEnviando(true);
    try {
      const enviado = await enviarArquivo("documento", file);
      salvar.mutate({
        condicoesComerciaisUrl: enviado.url,
        condicoesComerciaisNome: enviado.fileName,
        jurosParcelamento: juros.map((j) => ({ parcelas: Number(j.parcelas) || 1, jurosPct: Number(j.jurosPct) || 0 })),
      });
    } catch (e: any) {
      toast.error("Erro ao subir arquivo", { description: e.message });
    } finally {
      setEnviando(false);
    }
  };

  const handleSalvarJuros = () => {
    salvar.mutate({
      condicoesComerciaisUrl: data.condicoesComerciaisUrl ?? undefined,
      condicoesComerciaisNome: data.condicoesComerciaisNome ?? undefined,
      jurosParcelamento: juros
        .filter((j) => j.parcelas.trim())
        .map((j) => ({ parcelas: Number(j.parcelas) || 1, jurosPct: Number(j.jurosPct) || 0 })),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Condições comerciais</CardTitle>
          <p className="text-xs text-muted-foreground">Documento (PDF) que aparece no rodapé de toda proposta pública.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.condicoesComerciaisUrl && (
            <a href={data.condicoesComerciaisUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline w-fit">
              <Download className="w-3.5 h-3.5" /> {data.condicoesComerciaisNome || "Arquivo atual"}
            </a>
          )}
          <Input
            type="file"
            accept="application/pdf"
            disabled={enviando}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Juros de parcelamento no cartão de crédito</CardTitle>
          <p className="text-xs text-muted-foreground">Percentual de juros aplicado sobre o valor total, por número de parcelas.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {juros.map((j, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="w-24 h-8 text-xs"
                placeholder="Parcelas"
                value={j.parcelas}
                onChange={(e) => setJuros((prev) => prev.map((x, idx) => (idx === i ? { ...x, parcelas: e.target.value } : x)))}
              />
              <span className="text-xs text-muted-foreground">x —</span>
              <Input
                className="w-24 h-8 text-xs"
                placeholder="Juros %"
                value={j.jurosPct}
                onChange={(e) => setJuros((prev) => prev.map((x, idx) => (idx === i ? { ...x, jurosPct: e.target.value } : x)))}
              />
              <span className="text-xs text-muted-foreground">%</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setJuros((prev) => prev.filter((_, idx) => idx !== i))}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setJuros((prev) => [...prev, { parcelas: "", jurosPct: "0" }])}>
            <Plus className="w-3.5 h-3.5" /> Adicionar faixa
          </Button>
          <div>
            <Button size="sm" onClick={handleSalvarJuros} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar juros de parcelamento"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
