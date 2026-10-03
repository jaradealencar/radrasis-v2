import { useEffect, useState, type FormEvent } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Package, Plus, Search, Trash2, ArrowLeft, Boxes, Layers, Download, Link2, Copy, Pencil, Settings2, Ruler, RefreshCw } from "lucide-react";
import { fmtBrl } from "@/lib/format";
import { UNIDADE_CONSUMO_MATERIA_PRIMA, UNIDADE_CONSUMO_LABEL, type UnidadeConsumoMateriaPrima } from "@shared/produto-composicao";

export default function Produtos() {
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const [dialogNovoAberto, setDialogNovoAberto] = useState(false);
  const [aba, setAba] = useState("produtos");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description="Produtos, matérias-primas e dados técnicos de fabricação."
        icon={Package}
      />

      <Tabs value={aba} onValueChange={setAba} className="space-y-4">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="materias-primas">Matérias-primas</TabsTrigger>
        </TabsList>
        <TabsContent value="produtos" className="mt-0 space-y-4">
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
        </TabsContent>
        <TabsContent value="materias-primas" className="mt-0">
          <CadastroMateriasPrimas />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type MateriaPrimaCadastroItem = RouterOutputs["produtos"]["materiasPrimas"]["listar"][number];
type MateriaPrimaCategoriaItem = RouterOutputs["produtos"]["materiasPrimas"]["categoriasListar"][number];
type FormatoChapaForm = {
  id?: number;
  nome: string;
  larguraMm: string;
  alturaMm: string;
  pantoneCode: string;
  cmykC: string;
  cmykM: string;
  cmykY: string;
  cmykK: string;
  transmissaoLuzPct: string;
  ativo: boolean;
  principal: boolean;
};

function CadastroMateriasPrimas() {
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [materialEditando, setMaterialEditando] = useState<MateriaPrimaCadastroItem | null>(null);
  const [gerenciarCategorias, setGerenciarCategorias] = useState(false);
  const { data: materias, isLoading, error, refetch } = trpc.produtos.materiasPrimas.listar.useQuery();
  const { data: categorias = [] } = trpc.produtos.materiasPrimas.categoriasListar.useQuery();

  const listaFiltrada = (materias ?? []).filter(material => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const correspondeBusca = !termo || material.nome.toLocaleLowerCase("pt-BR").includes(termo)
      || String(material.id).includes(termo)
      || (material.categoriaMubiSys ?? "").toLocaleLowerCase("pt-BR").includes(termo);
    const correspondeCategoria = categoriaFiltro === "todas"
      || material.categoriaId === Number(categoriaFiltro)
      || (categoriaFiltro === "sem-categoria" && material.categoriaId == null);
    return correspondeBusca && correspondeCategoria;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Matérias-primas</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Classifique os materiais do MubiSys e mantenha os dados técnicos locais usados na fabricação.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setGerenciarCategorias(true)} className="gap-1.5">
              <Settings2 className="h-4 w-4" /> Gerenciar categorias
            </Button>
            <Button size="sm" variant="outline" onClick={() => void refetch()} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Atualizar catálogo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_240px]">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por matéria-prima ou código MubiSys..." value={busca} onChange={event => setBusca(event.target.value)} />
            </div>
            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                <SelectItem value="sem-categoria">Sem categoria</SelectItem>
                {categorias.map(categoria => <SelectItem key={categoria.id} value={String(categoria.id)}>{categoria.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : error ? (
            <Empty><EmptyHeader><EmptyMedia variant="icon"><Boxes /></EmptyMedia><EmptyTitle>Catálogo indisponível</EmptyTitle><EmptyDescription>{error.message}</EmptyDescription></EmptyHeader></Empty>
          ) : listaFiltrada.length === 0 ? (
            <Empty><EmptyHeader><EmptyMedia variant="icon"><Boxes /></EmptyMedia><EmptyTitle>Nenhuma matéria-prima encontrada</EmptyTitle><EmptyDescription>Revise a busca ou atualize o catálogo do MubiSys.</EmptyDescription></EmptyHeader></Empty>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Matéria-prima</TableHead><TableHead>Categoria Radrasys</TableHead><TableHead>Unidade e custo MubiSys</TableHead><TableHead>Dados técnicos</TableHead><TableHead className="w-24">Ação</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {listaFiltrada.map(material => (
                    <TableRow key={material.id}>
                      <TableCell>
                        <div className="font-medium">{material.nome}</div>
                        <div className="text-xs text-muted-foreground">MubiSys #{material.id}{material.categoriaMubiSys ? ` · ${material.categoriaMubiSys}` : ""}</div>
                      </TableCell>
                      <TableCell>
                        {material.categoriaNome ? <Badge variant="secondary">{material.categoriaNome}</Badge> : <span className="text-sm text-muted-foreground">Sem categoria</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {material.unidadeCusto || material.unidadeMovimentacao || "—"}
                        <div className="text-xs text-muted-foreground">{material.valorCusto > 0 ? `${fmtBrl(material.valorCusto)} / ${material.unidadeCusto || "un."}` : "Custo não informado"}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {material.categoriaUsaDadosChapa ? (
                          <span>{material.espessuraMm ?? "—"} mm · {material.densidadeKgM3 ?? "—"} kg/m³ · {material.chapas.filter(chapa => chapa.ativo).length} formato(s)</span>
                        ) : <span className="text-muted-foreground">{material.tipo || "Sem dados técnicos adicionais"}</span>}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setMaterialEditando(material)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Nome, custo e unidade são sincronizados do MubiSys. As categorias e especificações de fabricação são editadas localmente no Radrasys.</p>
        </CardContent>
      </Card>

      <DialogEditarMateriaPrima
        material={materialEditando}
        categorias={categorias}
        onFechar={() => setMaterialEditando(null)}
      />
      <DialogCategoriasMateriaPrima aberto={gerenciarCategorias} onFechar={() => setGerenciarCategorias(false)} />
    </div>
  );
}

function DialogEditarMateriaPrima({
  material,
  categorias,
  onFechar,
}: {
  material: MateriaPrimaCadastroItem | null;
  categorias: MateriaPrimaCategoriaItem[];
  onFechar: () => void;
}) {
  const utils = trpc.useUtils();
  const [categoriaId, setCategoriaId] = useState("sem-categoria");
  const [espessuraMm, setEspessuraMm] = useState("");
  const [densidadeKgM3, setDensidadeKgM3] = useState("");
  const [chapas, setChapas] = useState<FormatoChapaForm[]>([]);
  const categoria = categorias.find(item => String(item.id) === categoriaId);

  useEffect(() => {
    if (!material) return;
    setCategoriaId(material.categoriaId == null ? "sem-categoria" : String(material.categoriaId));
    setEspessuraMm(material.espessuraMm == null ? "" : String(material.espessuraMm));
    setDensidadeKgM3(material.densidadeKgM3 == null ? "" : String(material.densidadeKgM3));
    setChapas(material.chapas.map(chapa => ({
      id: chapa.id,
      nome: chapa.nome,
      larguraMm: String(chapa.larguraMm),
      alturaMm: String(chapa.alturaMm),
      pantoneCode: chapa.pantoneCode ?? "",
      cmykC: chapa.cmykC == null ? "" : String(chapa.cmykC),
      cmykM: chapa.cmykM == null ? "" : String(chapa.cmykM),
      cmykY: chapa.cmykY == null ? "" : String(chapa.cmykY),
      cmykK: chapa.cmykK == null ? "" : String(chapa.cmykK),
      transmissaoLuzPct: chapa.transmissaoLuzPct == null ? "" : String(chapa.transmissaoLuzPct),
      ativo: chapa.ativo,
      principal: chapa.principal,
    })));
  }, [material]);

  const salvar = trpc.produtos.materiasPrimas.salvar.useMutation({
    onSuccess: async () => {
      toast.success("Matéria-prima atualizada");
      await utils.produtos.materiasPrimas.listar.invalidate();
      onFechar();
    },
    onError: error => toast.error("Não foi possível salvar", { description: error.message }),
  });

  const atualizarChapa = (index: number, values: Partial<FormatoChapaForm>) => {
    setChapas(atual => atual.map((chapa, i) => i === index ? { ...chapa, ...values } : chapa));
  };

  const handleSalvar = (event: FormEvent) => {
    event.preventDefault();
    if (!material) return;
    const formatos = chapas.map((chapa, index) => ({
      ...(chapa.id == null ? {} : { id: chapa.id }),
      nome: chapa.nome.trim() || `${material.nome} · ${chapa.larguraMm} × ${chapa.alturaMm} mm`,
      larguraMm: Number(chapa.larguraMm),
      alturaMm: Number(chapa.alturaMm),
      pantoneCode: chapa.pantoneCode.trim() || null,
      cmykC: chapa.cmykC.trim() === "" ? null : Number(chapa.cmykC),
      cmykM: chapa.cmykM.trim() === "" ? null : Number(chapa.cmykM),
      cmykY: chapa.cmykY.trim() === "" ? null : Number(chapa.cmykY),
      cmykK: chapa.cmykK.trim() === "" ? null : Number(chapa.cmykK),
      transmissaoLuzPct: chapa.transmissaoLuzPct.trim() === "" ? null : Number(chapa.transmissaoLuzPct),
      ativo: categoria?.usaDadosChapa ? chapa.ativo : false,
      principal: categoria?.usaDadosChapa && chapa.ativo ? chapa.principal : false,
      index,
    }));
    if (categoria?.usaDadosChapa && formatos.some(chapa => !Number.isInteger(chapa.larguraMm) || !Number.isInteger(chapa.alturaMm) || chapa.larguraMm < 10 || chapa.alturaMm < 10)) {
      toast.error("Informe largura e altura em milímetros para todos os formatos.");
      return;
    }
    salvar.mutate({
      mubisysMateriaPrimaId: material.id,
      categoriaId: categoriaId === "sem-categoria" ? null : Number(categoriaId),
      espessuraMm: categoria?.usaDadosChapa ? Number(espessuraMm) : null,
      densidadeKgM3: categoria?.usaDadosChapa ? Number(densidadeKgM3) : null,
      chapas: formatos.map(({ index: _index, ...chapa }) => chapa),
    });
  };

  return (
    <Dialog open={material != null} onOpenChange={aberto => !aberto && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar matéria-prima</DialogTitle>
          <DialogDescription>{material?.nome} · MubiSys #{material?.id}. Nome e custo são mantidos pelo catálogo do MubiSys.</DialogDescription>
        </DialogHeader>
        {material && <form onSubmit={handleSalvar} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem-categoria">Sem categoria</SelectItem>
                  {categorias.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Custo no MubiSys</Label>
              <Input readOnly value={material.valorCusto > 0 ? `${fmtBrl(material.valorCusto)} / ${material.unidadeCusto || "un."}` : "Não informado"} />
            </div>
          </div>

          {categoria?.usaDadosChapa && <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center gap-2"><Ruler className="h-4 w-4 text-primary" /><div><h3 className="font-medium">Dados da chapa</h3><p className="text-xs text-muted-foreground">Dimensões são mantidas em orientação horizontal para o nesting.</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Espessura (mm)</Label><Input type="number" min="0.001" step="0.001" value={espessuraMm} onChange={event => setEspessuraMm(event.target.value)} required /></div>
              <div className="space-y-2"><Label>Densidade (kg/m³)</Label><Input type="number" min="0.0001" step="0.0001" value={densidadeKgM3} onChange={event => setDensidadeKgM3(event.target.value)} required /></div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2"><div><h4 className="text-sm font-medium">Tamanhos cadastrados</h4><p className="text-xs text-muted-foreground">Cadastre cada formato de chapa disponível para esta matéria-prima.</p></div><Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setChapas(atual => [...atual, { nome: "", larguraMm: "", alturaMm: "", pantoneCode: "", cmykC: "", cmykM: "", cmykY: "", cmykK: "", transmissaoLuzPct: "", ativo: true, principal: atual.length === 0 }])}><Plus className="h-3.5 w-3.5" /> Adicionar tamanho</Button></div>
              {chapas.length === 0 ? <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhum tamanho cadastrado.</p> : chapas.map((chapa, index) => (
                <div key={chapa.id ?? `novo-${index}`} className="space-y-3 rounded-md border p-3">
                  <div className="grid gap-2 sm:grid-cols-[minmax(130px,1fr)_110px_110px_auto]">
                    <div className="space-y-1"><Label className="text-xs">Identificação</Label><Input value={chapa.nome} placeholder="Ex.: 3000 × 1500 mm" onChange={event => atualizarChapa(index, { nome: event.target.value })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Largura (mm)</Label><Input type="number" min="10" step="1" value={chapa.larguraMm} onChange={event => atualizarChapa(index, { larguraMm: event.target.value })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Altura (mm)</Label><Input type="number" min="10" step="1" value={chapa.alturaMm} onChange={event => atualizarChapa(index, { alturaMm: event.target.value })} /></div>
                    <div className="flex flex-wrap items-end gap-1">
                      <Button type="button" size="sm" variant={chapa.principal ? "default" : "outline"} aria-pressed={chapa.principal} onClick={() => setChapas(atual => atual.map((item, i) => ({ ...item, principal: i === index })))}>{chapa.principal ? "Principal" : "Definir principal"}</Button>
                      <Button type="button" size="icon" variant="ghost" aria-label="Remover tamanho" onClick={() => setChapas(atual => atual.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                      {chapa.id != null && <label className="flex w-full items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={chapa.ativo} onChange={event => atualizarChapa(index, { ativo: event.target.checked })} /> Disponível para nesting</label>}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1"><Label className="text-xs">Pantone</Label><Input value={chapa.pantoneCode} placeholder="Ex.: 185 C" onChange={event => atualizarChapa(index, { pantoneCode: event.target.value })} /></div>
                    {(["cmykC", "cmykM", "cmykY", "cmykK"] as const).map((channel, channelIndex) => <div key={channel} className="space-y-1"><Label className="text-xs">CMYK {(["C", "M", "Y", "K"] as const)[channelIndex]} (%)</Label><Input type="number" min="0" max="100" step="0.01" value={chapa[channel]} onChange={event => atualizarChapa(index, { [channel]: event.target.value })} /></div>)}
                    <div className="space-y-1"><Label className="text-xs">Transmissão de luz (%)</Label><Input type="number" min="0" max="100" step="0.1" value={chapa.transmissaoLuzPct} onChange={event => atualizarChapa(index, { transmissaoLuzPct: event.target.value })} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onFechar}>Cancelar</Button>
            <Button type="submit" disabled={salvar.isPending}>{salvar.isPending && <Spinner className="mr-2 h-4 w-4" />}Salvar matéria-prima</Button>
          </div>
        </form>}
      </DialogContent>
    </Dialog>
  );
}

function LinhaCategoriaMateriaPrima({ categoria }: { categoria: MateriaPrimaCategoriaItem }) {
  const utils = trpc.useUtils();
  const [nome, setNome] = useState(categoria.nome);
  const [usaDadosChapa, setUsaDadosChapa] = useState(categoria.usaDadosChapa);
  useEffect(() => { setNome(categoria.nome); setUsaDadosChapa(categoria.usaDadosChapa); }, [categoria]);
  const atualizar = trpc.produtos.materiasPrimas.categoriaAtualizar.useMutation({
    onSuccess: async () => {
      toast.success("Categoria atualizada");
      await Promise.all([utils.produtos.materiasPrimas.categoriasListar.invalidate(), utils.produtos.materiasPrimas.listar.invalidate()]);
    },
    onError: error => toast.error("Não foi possível atualizar a categoria", { description: error.message }),
  });
  const remover = trpc.produtos.materiasPrimas.categoriaRemover.useMutation({
    onSuccess: async () => {
      toast.success("Categoria removida");
      await utils.produtos.materiasPrimas.categoriasListar.invalidate();
    },
    onError: error => toast.error("Não foi possível remover a categoria", { description: error.message }),
  });
  const alterada = nome.trim() !== categoria.nome || usaDadosChapa !== categoria.usaDadosChapa;
  return (
    <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(180px,1fr)_auto_auto_auto] sm:items-center">
      <Input value={nome} onChange={event => setNome(event.target.value)} aria-label={`Nome da categoria ${categoria.nome}`} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={usaDadosChapa} onChange={event => setUsaDadosChapa(event.target.checked)} /> Categoria de chapa</label>
      <Button size="sm" variant="outline" disabled={!alterada || atualizar.isPending} onClick={() => atualizar.mutate({ id: categoria.id, nome: nome.trim(), usaDadosChapa })}>Salvar</Button>
      <Button size="icon" variant="ghost" aria-label={`Remover categoria ${categoria.nome}`} disabled={remover.isPending} onClick={() => remover.mutate({ id: categoria.id })}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}

function DialogCategoriasMateriaPrima({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const utils = trpc.useUtils();
  const [nome, setNome] = useState("");
  const [usaDadosChapa, setUsaDadosChapa] = useState(false);
  const { data: categorias = [] } = trpc.produtos.materiasPrimas.categoriasListar.useQuery();
  const criar = trpc.produtos.materiasPrimas.categoriaCriar.useMutation({
    onSuccess: async () => {
      setNome("");
      setUsaDadosChapa(false);
      toast.success("Categoria criada");
      await utils.produtos.materiasPrimas.categoriasListar.invalidate();
    },
    onError: error => toast.error("Não foi possível criar a categoria", { description: error.message }),
  });
  return (
    <Dialog open={aberto} onOpenChange={value => !value && onFechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Gerenciar categorias de matérias-primas</DialogTitle><DialogDescription>Renomeie, crie ou remova categorias. Só categorias marcadas como chapa abrem os campos técnicos e os tamanhos de chapa.</DialogDescription></DialogHeader>
        <form className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(180px,1fr)_auto_auto] sm:items-center" onSubmit={event => { event.preventDefault(); criar.mutate({ nome: nome.trim(), usaDadosChapa }); }}>
          <Input value={nome} onChange={event => setNome(event.target.value)} placeholder="Nova categoria" required />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={usaDadosChapa} onChange={event => setUsaDadosChapa(event.target.checked)} /> Categoria de chapa</label>
          <Button type="submit" size="sm" disabled={!nome.trim() || criar.isPending}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
        </form>
        <div className="space-y-2">{categorias.map(categoria => <LinhaCategoriaMateriaPrima key={categoria.id} categoria={categoria} />)}</div>
        <div className="flex justify-end"><Button variant="outline" onClick={onFechar}>Concluir</Button></div>
      </DialogContent>
    </Dialog>
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
          Busque o produto no catálogo do MubiSys. Nome e categoria vêm de lá; depois de criar, você pode importar a
          ficha de matéria-prima e configurar kit e precificação.
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
  const [custoMaoObra, setCustoMaoObra] = useState("");
  const [idPrecificacao, setIdPrecificacao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [prazoFabricacaoDiasUteis, setPrazoFabricacaoDiasUteis] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");

  useEffect(() => {
    if (!data) return;
    setPercentualCustoFixo(String(Number(data.produto.percentualCustoFixo)));
    setCustoMaoObra(data.produto.custoMaoObra == null ? "" : String(Number(data.produto.custoMaoObra)));
    setIdPrecificacao(data.produto.idPrecificacao != null ? String(data.produto.idPrecificacao) : "");
    setObservacao(data.produto.observacao ?? "");
    setPrazoFabricacaoDiasUteis(data.produto.prazoFabricacaoDiasUteis != null ? String(data.produto.prazoFabricacaoDiasUteis) : "");
    setInstagramUrl(data.produto.instagramUrl ?? "");
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
    const maoDeObra = custoMaoObra.trim() ? parseFloat(custoMaoObra.replace(",", ".")) : null;
    const prazo = parseInt(prazoFabricacaoDiasUteis, 10);
    salvar.mutate({
      id: produto.id,
      mubisysProdutoId: produto.mubisysProdutoId,
      mubisysModeloId: produto.mubisysModeloId,
      nome: produto.nome,
      categoria: produto.categoria ?? undefined,
      ativo: produto.ativo,
      percentualCustoFixo: isNaN(pct) ? 0 : pct,
      custoMaoObra: maoDeObra != null && Number.isFinite(maoDeObra) ? maoDeObra : null,
      idPrecificacao: idPrecificacao.trim() ? Number(idPrecificacao) : undefined,
      prazoFabricacaoDiasUteis: isNaN(prazo) ? undefined : prazo,
      instagramUrl: instagramUrl.trim() || undefined,
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
        <CardContent className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Mão de obra direta por unidade (R$)</Label>
            <Input type="number" min="0" step="0.01" value={custoMaoObra} onChange={(e) => setCustoMaoObra(e.target.value)} placeholder="Informe o custo; vazio = pendente" />
            <p className="text-[11px] text-muted-foreground">Usado no decupador interno; custo pendente não é tratado como zero.</p>
          </div>
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
            <Label className="text-xs">Prazo de fabricação (dias úteis)</Label>
            <Input value={prazoFabricacaoDiasUteis} onChange={(e) => setPrazoFabricacaoDiasUteis(e.target.value)} placeholder="Ex: 5" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Link do Instagram</Label>
            <Input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." />
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

      <ComposicaoMateriaPrima
        produtoId={id}
        mubisysProdutoId={produto.mubisysProdutoId}
        mubisysModeloId={produto.mubisysModeloId}
        composicao={data.composicao}
      />
      <KitProduto produtoId={id} kit={data.kit} />
    </div>
  );
}

// ─── Composição de matéria-prima ────────────────────────────────────────────

function ComposicaoMateriaPrima({
  produtoId,
  mubisysProdutoId,
  mubisysModeloId,
  composicao,
}: {
  produtoId: number;
  mubisysProdutoId: number;
  mubisysModeloId: number;
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
        <MubiSysCompositionImporter
          produtoId={produtoId}
          mubisysProdutoId={mubisysProdutoId}
          mubisysModeloId={mubisysModeloId}
        />
        <ClonarComposicaoProduto produtoId={produtoId} />
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
                <TableHead>Modelo / variação</TableHead>
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
                  <TableCell className="text-xs">{item.variacaoNome ? `${item.variacaoNome}${item.variacaoPadrao ? " (padrão)" : ""}` : "Comum ao modelo"}</TableCell>
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

function ClonarComposicaoProduto({ produtoId }: { produtoId: number }) {
  const utils = trpc.useUtils();
  const [aberto, setAberto] = useState(false);
  const [produtoOrigemId, setProdutoOrigemId] = useState<number | null>(null);
  const { data: produtos } = trpc.produtos.listar.useQuery();
  const { data: origem, isLoading: carregandoOrigem } = trpc.produtos.obter.useQuery(
    { id: produtoOrigemId ?? 0 },
    { enabled: produtoOrigemId != null },
  );

  const clonar = trpc.produtos.composicaoClonar.useMutation({
    onSuccess: (resultado) => {
      const avisoKits = resultado.kitsIgnorados ? ` ${resultado.kitsIgnorados} item(ns) de kit ignorado(s) para evitar o produto em si no kit.` : "";
      toast.success("Materiais e kits clonados", {
        description: `${resultado.materias} matéria(s)-prima(s) e ${resultado.itensKit} item(ns) de kit copiado(s).${avisoKits}`,
      });
      utils.produtos.obter.invalidate({ id: produtoId });
      setAberto(false);
      setProdutoOrigemId(null);
    },
    onError: (error) => toast.error("Erro ao clonar composição", { description: error.message }),
  });

  const opcoes = (produtos ?? []).filter((produto) => produto.id !== produtoId);

  return (
    <div className="flex justify-end">
      <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setAberto(true)}>
        <Copy className="h-4 w-4" /> Clonar composição de outro produto
      </Button>
      <Dialog open={aberto} onOpenChange={(open) => {
        setAberto(open);
        if (!open) setProdutoOrigemId(null);
      }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Clonar composição</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            O produto atual será mantido. As matérias-primas e os itens de kit do produto de origem substituirão os atuais.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Produto de origem</Label>
            <Select value={produtoOrigemId == null ? "" : String(produtoOrigemId)} onValueChange={(value) => setProdutoOrigemId(Number(value))}>
              <SelectTrigger><SelectValue placeholder="Escolha um produto" /></SelectTrigger>
              <SelectContent>
                {opcoes.map((produto) => <SelectItem key={produto.id} value={String(produto.id)}>{produto.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {produtoOrigemId != null && (
            carregandoOrigem ? <div className="flex justify-center py-5"><Spinner /></div> : origem ? (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">{origem.produto.nome}</p>
                {origem.composicao.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Matérias-primas · {origem.composicao.length}</p>
                    <div className="max-h-48 overflow-y-auto divide-y">
                      {origem.composicao.slice(0, 8).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span>{item.materialNome}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {Number(item.quantidade)} · {UNIDADE_CONSUMO_LABEL[item.unidadeConsumo as UnidadeConsumoMateriaPrima]}
                          </span>
                        </div>
                      ))}
                      {origem.composicao.length > 8 && <p className="py-2 text-xs text-muted-foreground">e mais {origem.composicao.length - 8} item(ns)</p>}
                    </div>
                  </div>
                )}
                {origem.kit.length > 0 && (
                  <div className="border-t pt-2">
                    <p className="text-xs font-medium text-muted-foreground">Itens de kit · {origem.kit.length}</p>
                    <div className="max-h-36 overflow-y-auto divide-y">
                      {origem.kit.slice(0, 6).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span>{item.nomeAssociado}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">Qtd. {Number(item.quantidade)}</span>
                        </div>
                      ))}
                      {origem.kit.length > 6 && <p className="py-2 text-xs text-muted-foreground">e mais {origem.kit.length - 6} item(ns)</p>}
                    </div>
                  </div>
                )}
                {origem.composicao.length === 0 && origem.kit.length === 0 && (
                  <p className="text-sm text-muted-foreground">Este produto não tem matérias-primas nem itens de kit para clonar.</p>
                )}
              </div>
            ) : null
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button
              onClick={() => produtoOrigemId != null && clonar.mutate({ produtoId, produtoOrigemId })}
              disabled={produtoOrigemId == null || carregandoOrigem || (!origem?.composicao.length && !origem?.kit.length) || clonar.isPending}
            >
              {clonar.isPending && <Spinner className="mr-2 h-4 w-4" />}
              Clonar materiais + kits
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type CatalogoComposicaoMubiSys = {
  produtos: Array<{
    id: number;
    modelos: Array<{
      id: number;
      nome: string;
      unidade: string;
      variacoes: Array<{ id: number; nome: string; padrao: boolean }>;
    }>;
  }>;
  materias: Array<{ id: number; nome: string; unidade: string; valor: number }>;
  composicoesMubiSys: Array<{
    modeloId: number | null;
    variacaoId: number | null;
    materiaPrimaId: number;
    quantidade: number;
    unidade: string;
  }>;
  mubisysWebConectado: boolean;
  erroComposicoesMubiSys: string | null;
};

function normalizarUnidadeConsumo(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/²/g, "2").replace(/[^a-z0-9]/g, "");
}

function inferirUnidadeConsumo(unidadeMubiSys: string, unidadeModelo: string): UnidadeConsumoMateriaPrima {
  const unidade = normalizarUnidadeConsumo(unidadeMubiSys);
  if (["m2", "metroquadrado", "metrosquadrados", "areadequadrada"].some((s) => unidade.includes(s))) return "m2";
  if (["ml", "metrolinear", "metroslineares", "metro", "metros"].some((s) => unidade.includes(s))) return "ml";
  if (["perimetro", "comprimento", "linear"].some((s) => unidade.includes(s))) return "perimetro";
  if (["un", "und", "unidade", "unidades", "peca", "pecas"].some((s) => unidade === s || unidade.startsWith(s))) return "unidade";

  const unidadeBase = normalizarUnidadeConsumo(unidadeModelo);
  if (["m2", "area", "quadrad"].some((s) => unidadeBase.includes(s))) return "m2";
  if (["perimetro", "linear", "comprimento"].some((s) => unidadeBase.includes(s)) || unidadeBase === "m") return "perimetro";
  return "unidade";
}

function numeroPtBr(valor: string): number {
  const limpo = valor.trim().replace(/\s/g, "");
  if (!limpo) return Number.NaN;
  return Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
}

function MubiSysCompositionImporter({
  produtoId,
  mubisysProdutoId,
  mubisysModeloId,
}: {
  produtoId: number;
  mubisysProdutoId: number;
  mubisysModeloId: number;
}) {
  const utils = trpc.useUtils();
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [mostrarConexao, setMostrarConexao] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [catalogo, setCatalogo] = useState<CatalogoComposicaoMubiSys | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [unidadesEditadas, setUnidadesEditadas] = useState<Record<string, UnidadeConsumoMateriaPrima>>({});
  const [quantidadesEditadas, setQuantidadesEditadas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    fetch("/api/letra-caixa/mubisys/sessao", { credentials: "same-origin", cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Falha ao verificar a sessão MubiSys.");
        return body as { connected?: boolean };
      })
      .then((body) => { if (ativo) setConectado(Boolean(body.connected)); })
      .catch(() => { if (ativo) setConectado(false); });
    return () => { ativo = false; };
  }, []);

  const importar = trpc.produtos.composicaoImportarMubisys.useMutation({
    onSuccess: (resultado) => {
      toast.success("Composição importada do MubiSys", {
        description: `${resultado.adicionadas} adicionada(s) e ${resultado.atualizadas} atualizada(s).`,
      });
      utils.produtos.obter.invalidate({ id: produtoId });
      setDialogAberto(false);
      setImportando(false);
    },
    onError: (error) => {
      toast.error("Erro ao importar composição", { description: error.message });
      setImportando(false);
    },
  });

  const carregarFicha = async () => {
    setCarregando(true);
    setErro("");
    try {
      const response = await fetch("/api/letra-caixa/catalogo", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Não foi possível consultar o catálogo do MubiSys.");

      const dados = body as CatalogoComposicaoMubiSys;
      setCatalogo(dados);
      setConectado(Boolean(dados.mubisysWebConectado));
      if (!dados.mubisysWebConectado) {
        setMostrarConexao(true);
        throw new Error(dados.erroComposicoesMubiSys || "Conecte sua conta MubiSys para ler a ficha de materiais.");
      }
      if (dados.erroComposicoesMubiSys) throw new Error(dados.erroComposicoesMubiSys);

      const modelo = dados.produtos.find((produto) => produto.id === mubisysProdutoId)
        ?.modelos.find((item) => item.id === mubisysModeloId);
      const variationIds = new Set((modelo?.variacoes ?? []).map((item) => item.id));
      const linhas = dados.composicoesMubiSys.filter((linha) =>
        linha.modeloId === mubisysModeloId || (linha.modeloId == null && linha.variacaoId != null && variationIds.has(linha.variacaoId)),
      );
      const hasModelRows = linhas.some((linha) => linha.variacaoId == null && linha.modeloId === mubisysModeloId);
      if (!hasModelRows && !linhas.some((linha) => linha.variacaoId != null)) {
        throw new Error("Não encontrei matérias-primas vinculadas a este modelo no MubiSys.");
      }

      setUnidadesEditadas({});
      setQuantidadesEditadas({});
      setDialogAberto(true);
    } catch (cause) {
      const mensagem = cause instanceof Error ? cause.message : "Não foi possível ler a ficha de materiais do MubiSys.";
      setErro(mensagem);
      toast.error("Composição do MubiSys indisponível", { description: mensagem });
    } finally {
      setCarregando(false);
    }
  };

  const conectar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const dados = new FormData(form);
    setConectando(true);
    setErro("");
    try {
      const response = await fetch("/api/letra-caixa/mubisys/sessao", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: String(dados.get("codigo") || ""),
          usuario: String(dados.get("usuario") || ""),
          senha: String(dados.get("senha") || ""),
        }),
      });
      const body = await response.json().catch(() => ({}));
      form.reset();
      if (!response.ok) throw new Error(body.error || "Não foi possível conectar ao MubiSys.");
      setConectado(true);
      setMostrarConexao(false);
      toast.success("MubiSys conectado. Lendo a ficha do modelo.");
      await carregarFicha();
    } catch (cause) {
      form.reset();
      const mensagem = cause instanceof Error ? cause.message : "Não foi possível conectar ao MubiSys.";
      setErro(mensagem);
      toast.error("Falha na conexão com o MubiSys", { description: mensagem });
    } finally {
      setConectando(false);
    }
  };

  const modelo = catalogo?.produtos.find((produto) => produto.id === mubisysProdutoId)
    ?.modelos.find((item) => item.id === mubisysModeloId);
  const variationIds = new Set((modelo?.variacoes ?? []).map((item) => item.id));
  const linhasDoModelo = (catalogo?.composicoesMubiSys ?? []).filter((linha) =>
    linha.modeloId === mubisysModeloId || (linha.modeloId == null && linha.variacaoId != null && variationIds.has(linha.variacaoId)),
  );
  const variacoesComFicha = [...new Set(linhasDoModelo.map((linha) => linha.variacaoId).filter((id): id is number => id != null))]
    .map((id) => modelo?.variacoes.find((variation) => variation.id === id) ?? { id, nome: `Variação #${id}`, padrao: false });
  const linhasModeloCompartilhadas = linhasDoModelo.filter((linha) => linha.variacaoId == null && linha.modeloId === mubisysModeloId);
  const linhasSelecionadas = [...linhasModeloCompartilhadas, ...linhasDoModelo.filter((linha) => linha.variacaoId != null)];
  const preview = linhasSelecionadas.map((linha, index) => {
    const materia = catalogo?.materias.find((item) => item.id === linha.materiaPrimaId);
    const variacao = linha.variacaoId == null ? null : variacoesComFicha.find((item) => item.id === linha.variacaoId);
    const chave = `${linha.variacaoId ?? "modelo"}-${index}-${linha.materiaPrimaId}`;
    return {
      linha,
      materia,
      variacao,
      chave,
      unidade: unidadesEditadas[chave] ?? inferirUnidadeConsumo(linha.unidade || materia?.unidade || "", modelo?.unidade || ""),
      quantidade: quantidadesEditadas[chave] ?? String(linha.quantidade),
    };
  });
  const previewValido = preview.length > 0 && preview.every((item) => {
    const quantidade = numeroPtBr(item.quantidade);
    return item.materia != null && Number.isFinite(quantidade) && quantidade >= 0 && quantidade <= 99999999.9999;
  });

  const confirmarImportacao = () => {
    const linhasAgrupadas = new Map<string, {
      mubisysMateriaPrimaId: number;
      materialNome: string;
      mubisysVariacaoId: number | null;
      variacaoNome: string | null;
      variacaoPadrao: boolean;
      unidadeConsumo: UnidadeConsumoMateriaPrima;
      quantidade: number;
    }>();
    for (const item of preview) {
      if (!item.materia) continue;
      const quantidade = numeroPtBr(item.quantidade);
      const chave = `${item.linha.variacaoId ?? "modelo"}:${item.materia.id}:${item.unidade}`;
      const existente = linhasAgrupadas.get(chave);
      if (existente) existente.quantidade += quantidade;
      else linhasAgrupadas.set(chave, {
        mubisysMateriaPrimaId: item.materia.id,
        materialNome: item.materia.nome,
        mubisysVariacaoId: item.linha.variacaoId,
        variacaoNome: item.variacao?.nome ?? null,
        variacaoPadrao: item.variacao?.padrao ?? false,
        unidadeConsumo: item.unidade,
        quantidade,
      });
    }
    setImportando(true);
    importar.mutate({ produtoId, linhas: [...linhasAgrupadas.values()] });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Ficha de matéria-prima do MubiSys</p>
          <p className="text-xs text-muted-foreground">
            {conectado === null ? "Verificando conexão..." : conectado ? "Conectado" : "Conecte sua conta para importar os materiais do modelo."}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={conectado ? carregarFicha : () => setMostrarConexao((aberto) => !aberto)}
          disabled={carregando || conectado === null}
          className="gap-1.5"
        >
          {carregando ? <Spinner className="h-4 w-4" /> : conectado ? <Download className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {carregando ? "Consultando..." : conectado ? "Importar composição" : "Conectar MubiSys"}
        </Button>
      </div>

      {mostrarConexao && conectado !== true && (
        <form onSubmit={conectar} className="space-y-3 rounded-md border bg-background p-3">
          <p className="text-xs text-muted-foreground">Informe código da empresa, usuário e senha. A senha será usada apenas para abrir a sessão e não será salva. A sessão fica protegida por até 8 horas.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1"><Label className="text-xs">Código da empresa</Label><Input name="codigo" autoComplete="off" required /></div>
            <div className="space-y-1"><Label className="text-xs">Usuário</Label><Input name="usuario" autoComplete="username" required /></div>
            <div className="space-y-1"><Label className="text-xs">Senha</Label><Input name="senha" type="password" autoComplete="current-password" required /></div>
          </div>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={conectando}>{conectando ? "Conectando..." : "Conectar e importar"}</Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setMostrarConexao(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Importar composição do MubiSys</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">O Radrasys importa a composição comum do modelo e a ficha de cada variação. Na cotação, você escolhe quais variações entram e pode remover materiais quando necessário.</p>
          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            Quantidade e unidade informadas na ficha vêm do MubiSys. Quando falta unidade, a sugestão usa a unidade do modelo. Revise a unidade de consumo antes de salvar.
          </div>
          {preview.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Não há matérias-primas cadastradas para esta opção no MubiSys.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Variação</TableHead><TableHead>Matéria-prima</TableHead><TableHead>Quantidade</TableHead><TableHead>Unidade MubiSys</TableHead><TableHead>Consumo Radrasys</TableHead><TableHead>Custo atual</TableHead></TableRow></TableHeader>
                <TableBody>
                  {preview.map((item) => (
                    <TableRow key={item.chave}>
                      <TableCell className="text-xs">{item.variacao ? `${item.variacao.nome}${item.variacao.padrao ? " (padrão)" : ""}` : "Comum ao modelo"}</TableCell>
                      <TableCell className="font-medium">{item.materia?.nome ?? `Matéria-prima #${item.linha.materiaPrimaId} não encontrada`}</TableCell>
                      <TableCell><Input className="h-8 w-24" inputMode="decimal" value={item.quantidade} onChange={(event) => setQuantidadesEditadas((atual) => ({ ...atual, [item.chave]: event.target.value }))} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.linha.unidade || item.materia?.unidade || "—"}</TableCell>
                      <TableCell>
                        <Select value={item.unidade} onValueChange={(value) => setUnidadesEditadas((atual) => ({ ...atual, [item.chave]: value as UnidadeConsumoMateriaPrima }))}>
                          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{UNIDADE_CONSUMO_MATERIA_PRIMA.map((opcao) => <SelectItem key={opcao} value={opcao}>{UNIDADE_CONSUMO_LABEL[opcao]}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{item.materia ? `${fmtBrl(item.materia.valor)} / ${item.materia.unidade || "un."}` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!previewValido && preview.length > 0 && <p className="text-sm text-destructive">Há material ausente ou quantidade inválida. Corrija antes de importar.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button onClick={confirmarImportacao} disabled={!previewValido || importando || importar.isPending}>
              {(importando || importar.isPending) && <Spinner className="mr-2 h-4 w-4" />}
              Importar {preview.length} {preview.length === 1 ? "linha" : "linhas"} de composição
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
