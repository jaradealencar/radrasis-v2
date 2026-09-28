import { useEffect, useState } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Package, Plus, Search, Trash2, ArrowLeft, Boxes, Layers } from "lucide-react";
import { fmtBrl } from "@/lib/format";
import { UNIDADE_CONSUMO_MATERIA_PRIMA, UNIDADE_CONSUMO_LABEL, type UnidadeConsumoMateriaPrima } from "@shared/produto-composicao";

export default function Produtos() {
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const [dialogNovoAberto, setDialogNovoAberto] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description="Composição de matéria-prima, kit de venda e precificação de cada produto."
        icon={Package}
      />

      {selecionadoId === null ? (
        <ListaProdutos onSelecionar={setSelecionadoId} onNovo={() => setDialogNovoAberto(true)} />
      ) : (
        <DetalheProduto id={selecionadoId} onVoltar={() => setSelecionadoId(null)} />
      )}

      <DialogNovoProduto
        aberto={dialogNovoAberto}
        onFechar={() => setDialogNovoAberto(false)}
        onCriado={(id) => {
          setDialogNovoAberto(false);
          setSelecionadoId(id);
        }}
      />
    </div>
  );
}

// ─── Lista de produtos cadastrados ──────────────────────────────────────────

function ListaProdutos({ onSelecionar, onNovo }: { onSelecionar: (id: number) => void; onNovo: () => void }) {
  const { data: lista, isLoading } = trpc.produtos.listar.useQuery();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Produtos cadastrados</CardTitle>
        <Button size="sm" onClick={onNovo} className="gap-1.5">
          <Plus className="w-4 h-4" /> Novo produto
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : !lista || lista.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Package /></EmptyMedia>
              <EmptyTitle>Nenhum produto cadastrado</EmptyTitle>
              <EmptyDescription>Cadastre um produto vinculando ao catálogo do MubiSys para começar a montar a composição.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>% custo fixo</TableHead>
                <TableHead>ID precificação</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelecionar(p.id)}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{p.categoria || "—"}</TableCell>
                  <TableCell>{Number(p.percentualCustoFixo)}%</TableCell>
                  <TableCell>{p.idPrecificacao ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
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

// ─── Dialog: novo produto (vincula ao catálogo do MubiSys) ─────────────────

function DialogNovoProduto({
  aberto,
  onFechar,
  onCriado,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriado: (id: number) => void;
}) {
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const { data: resultados, isLoading, refetch } = trpc.produtos.buscarMubisys.useQuery(
    { busca: buscaAtiva },
    { enabled: false },
  );

  const criar = trpc.produtos.upsert.useMutation({
    onSuccess: (r) => {
      toast.success("Produto criado");
      onCriado(r.id);
      setBusca("");
      setBuscaAtiva("");
    },
    onError: (e) => toast.error("Erro ao criar produto", { description: e.message }),
  });

  const handleBuscar = () => {
    setBuscaAtiva(busca);
    setTimeout(() => refetch(), 50);
  };

  const handleSelecionar = (produto: { id: number; nome: string; categoria: string }, modeloId: number) => {
    criar.mutate({
      mubisysProdutoId: produto.id,
      mubisysModeloId: modeloId,
      nome: produto.nome,
      categoria: produto.categoria,
    });
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo produto</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Busque o produto no catálogo do MubiSys. Nome e categoria vêm de lá; a composição de matéria-prima, kit e
          precificação você completa depois de criar.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Ex: Letreiro Frontlight..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
          />
          <Button onClick={handleBuscar} disabled={isLoading} className="gap-1.5 shrink-0">
            {isLoading ? <Spinner className="w-4 h-4" /> : <Search className="w-4 h-4" />} Buscar
          </Button>
        </div>
        {resultados && resultados.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum produto encontrado no MubiSys para esse termo.</p>
        )}
        {resultados && resultados.length > 0 && (
          <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
            {resultados.map((p) => (
              <div key={p.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.categoria || "sem categoria"}</p>
                  </div>
                  {p.modelos.length <= 1 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={criar.isPending}
                      onClick={() => handleSelecionar(p, p.modelos[0]?.id ?? p.id)}
                    >
                      + Adicionar
                    </Button>
                  ) : (
                    <Select onValueChange={(v) => handleSelecionar(p, Number(v))}>
                      <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Escolher modelo" /></SelectTrigger>
                      <SelectContent>
                        {p.modelos.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>{m.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Detalhe de um produto (composição, kit, precificação) ─────────────────

function DetalheProduto({ id, onVoltar }: { id: number; onVoltar: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.produtos.obter.useQuery({ id });

  const [percentualCustoFixo, setPercentualCustoFixo] = useState("");
  const [idPrecificacao, setIdPrecificacao] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!data) return;
    setPercentualCustoFixo(String(Number(data.produto.percentualCustoFixo)));
    setIdPrecificacao(data.produto.idPrecificacao != null ? String(data.produto.idPrecificacao) : "");
    setObservacao(data.produto.observacao ?? "");
  }, [data?.produto.id]);

  const salvar = trpc.produtos.upsert.useMutation({
    onSuccess: () => {
      toast.success("Produto atualizado");
      utils.produtos.obter.invalidate({ id });
      utils.produtos.listar.invalidate();
    },
    onError: (e) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const remover = trpc.produtos.remover.useMutation({
    onSuccess: () => {
      toast.success("Produto removido");
      utils.produtos.listar.invalidate();
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

  const { produto } = data;

  const handleSalvar = () => {
    const pct = parseFloat(percentualCustoFixo.replace(",", "."));
    salvar.mutate({
      id: produto.id,
      mubisysProdutoId: produto.mubisysProdutoId,
      mubisysModeloId: produto.mubisysModeloId,
      nome: produto.nome,
      categoria: produto.categoria ?? undefined,
      ativo: produto.ativo,
      percentualCustoFixo: isNaN(pct) ? 0 : pct,
      idPrecificacao: idPrecificacao.trim() ? Number(idPrecificacao) : undefined,
      observacao: observacao || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onVoltar} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="gap-1.5"
          onClick={() => confirm(`Remover "${produto.nome}"? Isso apaga a composição e o kit também.`) && remover.mutate({ id })}
        >
          <Trash2 className="w-4 h-4" /> Remover produto
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" /> {produto.nome}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{produto.categoria || "sem categoria"} · MubiSys #{produto.mubisysProdutoId} / modelo #{produto.mubisysModeloId}</p>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">% custo fixo sobre matéria-prima</Label>
            <Input value={percentualCustoFixo} onChange={(e) => setPercentualCustoFixo(e.target.value)} placeholder="Ex: 30" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ID de precificação (Tabela de Preços)</Label>
            <Input value={idPrecificacao} onChange={(e) => setIdPrecificacao(e.target.value)} placeholder="Ex: 42" />
            {data.precificacao && (
              <p className="text-xs text-muted-foreground">
                {data.precificacao.rotulo} — {data.precificacao.secaoTitulo} (pág. {data.precificacao.pagina})
              </p>
            )}
            {!data.precificacao && idPrecificacao.trim() && (
              <p className="text-xs text-amber-600">ID não encontrado em nenhuma seção da Tabela de Preços.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={1} className="min-h-9" />
          </div>
          <div className="sm:col-span-3">
            <Button size="sm" onClick={handleSalvar} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar dados do produto"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-1">
          <CardContent className="pt-4 space-y-1">
            <p className="text-xs text-muted-foreground">Custo de matéria-prima</p>
            <p className="text-lg font-semibold">{fmtBrl(data.custoMateriaPrima)}</p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-1">
          <CardContent className="pt-4 space-y-1">
            <p className="text-xs text-muted-foreground">Custo com % fixo aplicado</p>
            <p className="text-lg font-semibold">{fmtBrl(data.custoComFixo)}</p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-1">
          <CardContent className="pt-4 space-y-1">
            <p className="text-xs text-muted-foreground">Margem da Tabela de Preços</p>
            <p className="text-lg font-semibold">{data.precificacao ? data.precificacao.valores.join(" / ") : "—"}</p>
          </CardContent>
        </Card>
      </div>

      <ComposicaoMateriaPrima produtoId={id} composicao={data.composicao} />
      <KitProduto produtoId={id} kit={data.kit} />
    </div>
  );
}

// ─── Composição de matéria-prima ────────────────────────────────────────────

function ComposicaoMateriaPrima({
  produtoId,
  composicao,
}: {
  produtoId: number;
  composicao: NonNullable<RouterOutputs["produtos"]["obter"]>["composicao"];
}) {
  const utils = trpc.useUtils();
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const { data: resultados, isLoading, refetch } = trpc.produtos.buscarMateriaPrimaMubisys.useQuery(
    { busca: buscaAtiva },
    { enabled: false },
  );
  const [materialSelecionado, setMaterialSelecionado] = useState<{ id: number; nome: string } | null>(null);
  const [unidade, setUnidade] = useState<UnidadeConsumoMateriaPrima>("m2");
  const [quantidade, setQuantidade] = useState("1");

  const adicionar = trpc.produtos.composicaoAdicionar.useMutation({
    onSuccess: () => {
      toast.success("Matéria-prima adicionada");
      utils.produtos.obter.invalidate({ id: produtoId });
      setMaterialSelecionado(null);
      setQuantidade("1");
    },
    onError: (e) => toast.error("Erro ao adicionar", { description: e.message }),
  });

  const remover = trpc.produtos.composicaoRemover.useMutation({
    onSuccess: () => {
      utils.produtos.obter.invalidate({ id: produtoId });
    },
    onError: (e) => toast.error("Erro ao remover", { description: e.message }),
  });

  const handleBuscar = () => {
    setBuscaAtiva(busca);
    setTimeout(() => refetch(), 50);
  };

  const handleAdicionar = () => {
    if (!materialSelecionado) return;
    const qtd = parseFloat(quantidade.replace(",", "."));
    if (isNaN(qtd) || qtd <= 0) {
      toast.error("Quantidade inválida");
      return;
    }
    adicionar.mutate({
      produtoId,
      mubisysMateriaPrimaId: materialSelecionado.id,
      materialNome: materialSelecionado.nome,
      unidadeConsumo: unidade,
      quantidade: qtd,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Boxes className="w-4 h-4" /> Composição de matéria-prima
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar matéria-prima no MubiSys..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
          />
          <Button size="sm" onClick={handleBuscar} disabled={isLoading} className="gap-1.5 shrink-0">
            {isLoading ? <Spinner className="w-4 h-4" /> : <Search className="w-4 h-4" />} Buscar
          </Button>
        </div>

        {resultados && resultados.length > 0 && !materialSelecionado && (
          <div className="max-h-56 overflow-y-auto border rounded-lg divide-y">
            {resultados.map((m) => (
              <button
                key={m.id}
                type="button"
                className="w-full text-left p-2.5 text-sm hover:bg-muted/50 flex items-center justify-between gap-2"
                onClick={() => setMaterialSelecionado({ id: m.id, nome: m.nome })}
              >
                <span>{m.nome}</span>
                <span className="text-xs text-muted-foreground shrink-0">{fmtBrl(m.valorCusto)} / {m.unidadeCusto}</span>
              </button>
            ))}
          </div>
        )}
        {resultados && resultados.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma matéria-prima encontrada no MubiSys para esse termo.</p>
        )}

        {materialSelecionado && (
          <div className="border rounded-lg p-3 flex flex-wrap items-end gap-3 bg-muted/30">
            <div className="text-sm font-medium">{materialSelecionado.nome}</div>
            <div className="space-y-1">
              <Label className="text-xs">Unidade de consumo</Label>
              <Select value={unidade} onValueChange={(v) => setUnidade(v as UnidadeConsumoMateriaPrima)}>
                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADE_CONSUMO_MATERIA_PRIMA.map((u) => (
                    <SelectItem key={u} value={u}>{UNIDADE_CONSUMO_LABEL[u]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantidade</Label>
              <Input className="w-28 h-8 text-xs" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
            <Button size="sm" onClick={handleAdicionar} disabled={adicionar.isPending}>Adicionar</Button>
            <Button size="sm" variant="ghost" onClick={() => setMaterialSelecionado(null)}>Cancelar</Button>
          </div>
        )}

        {composicao.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma matéria-prima cadastrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matéria-prima</TableHead>
                <TableHead>Unidade de consumo</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Custo atual (MubiSys)</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {composicao.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.materialNome}</TableCell>
                  <TableCell>{UNIDADE_CONSUMO_LABEL[item.unidadeConsumo as UnidadeConsumoMateriaPrima]}</TableCell>
                  <TableCell>{Number(item.quantidade)}</TableCell>
                  <TableCell>
                    {item.custoUnitarioAtual != null ? fmtBrl(item.custoUnitarioAtual) : (
                      <span className="text-amber-600 text-xs">indisponível</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.custoUnitarioAtual != null ? fmtBrl(item.custoUnitarioAtual * Number(item.quantidade)) : "—"}
                  </TableCell>
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

// ─── Kit (produtos que acompanham a venda) ──────────────────────────────────

function KitProduto({
  produtoId,
  kit,
}: {
  produtoId: number;
  kit: NonNullable<RouterOutputs["produtos"]["obter"]>["kit"];
}) {
  const utils = trpc.useUtils();
  const { data: todosProdutos } = trpc.produtos.listar.useQuery();
  const [produtoAssociadoId, setProdutoAssociadoId] = useState("");
  const [quantidade, setQuantidade] = useState("1");

  const adicionar = trpc.produtos.kitAdicionar.useMutation({
    onSuccess: () => {
      toast.success("Item de kit adicionado");
      utils.produtos.obter.invalidate({ id: produtoId });
      setProdutoAssociadoId("");
      setQuantidade("1");
    },
    onError: (e) => toast.error("Erro ao adicionar", { description: e.message }),
  });

  const remover = trpc.produtos.kitRemover.useMutation({
    onSuccess: () => utils.produtos.obter.invalidate({ id: produtoId }),
    onError: (e) => toast.error("Erro ao remover", { description: e.message }),
  });

  const opcoes = (todosProdutos ?? []).filter(
    (p) => p.id !== produtoId && !kit.some((k) => k.produtoAssociadoId === p.id),
  );

  const handleAdicionar = () => {
    if (!produtoAssociadoId) return;
    const qtd = parseFloat(quantidade.replace(",", "."));
    adicionar.mutate({
      produtoId,
      produtoAssociadoId: Number(produtoAssociadoId),
      quantidade: isNaN(qtd) || qtd <= 0 ? 1 : qtd,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="w-4 h-4" /> Kit — produtos que acompanham a venda
        </CardTitle>
        <p className="text-xs text-muted-foreground">Ex: ao vender o letreiro, vai junto o gabarito e a fita dupla-face.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Produto que acompanha</Label>
            <Select value={produtoAssociadoId} onValueChange={setProdutoAssociadoId}>
              <SelectTrigger className="w-64 h-8 text-xs"><SelectValue placeholder="Selecione um produto cadastrado" /></SelectTrigger>
              <SelectContent>
                {opcoes.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quantidade</Label>
            <Input className="w-24 h-8 text-xs" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </div>
          <Button size="sm" onClick={handleAdicionar} disabled={!produtoAssociadoId || adicionar.isPending}>Adicionar</Button>
        </div>

        {kit.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto associado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kit.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nomeAssociado}</TableCell>
                  <TableCell>{Number(item.quantidade)}</TableCell>
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
