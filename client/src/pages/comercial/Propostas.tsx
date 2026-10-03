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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { FileText, Plus, Search, Trash2, ArrowLeft, Link as LinkIcon, Settings2, Download, FileDown, Layers, Ungroup } from "lucide-react";
import { fmtBrl, fmtDateTime, fmtNum } from "@/lib/format";
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

type MedidasNesting = {
  areaTotalNestingM2: number | null;
  areaM2: number | null;
  areaGeralM2: number | null;
  perimExtM: number | null;
  perimTotalM: number | null;
};

type FormulaMaterial = "areaTotal" | "area" | "areaGeral" | "perimExt" | "perimTotal" | "fixo";

type MaterialCotacao = {
  mubisysMateriaPrimaId: number | null;
  nome: string;
  unidade: string;
  custoUnitario: number;
  quantidade: number;
  custoTotal: number;
  formulaType: FormulaMaterial;
  multiplicador: number;
  variacaoModeloId: number | null;
  variacaoModeloNome: string | null;
  variacaoMaterial: { nome: string; valor: string; materiaPrimaNome: string } | null;
  incluir: boolean;
};

type ConfiguracaoItemCotacao = {
  nestingSourceId: string | null;
  nestingNumero: string | null;
  nestingModeloNome: string | null;
  medidas: MedidasNesting;
  variacoesModelo: { id: number; nome: string }[];
  materiais: MaterialCotacao[];
};

const MEDIDAS_VAZIAS: MedidasNesting = {
  areaTotalNestingM2: null,
  areaM2: null,
  areaGeralM2: null,
  perimExtM: null,
  perimTotalM: null,
};

const FORMULA_LABEL: Record<FormulaMaterial, string> = {
  areaTotal: "Área total do nesting",
  area: "Área líquida",
  areaGeral: "Área geral",
  perimExt: "Perímetro externo",
  perimTotal: "Perímetro total",
  fixo: "Quantidade fixa",
};

const CAMPOS_MEDIDA: { chave: keyof MedidasNesting; rotulo: string; unidade: string }[] = [
  { chave: "areaTotalNestingM2", rotulo: "Área total das peças", unidade: "m²" },
  { chave: "areaM2", rotulo: "Área líquida", unidade: "m²" },
  { chave: "areaGeralM2", rotulo: "Área geral", unidade: "m²" },
  { chave: "perimExtM", rotulo: "Perímetro externo", unidade: "m" },
  { chave: "perimTotalM", rotulo: "Perímetro total", unidade: "m" },
];

function parseMedida(valor: string): number | null {
  const limpo = valor.trim().replace(/\s/g, "");
  if (!limpo) return null;
  const numero = Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

function calcularQuantidadeMaterial(material: MaterialCotacao, medidas: MedidasNesting): number {
  const base = material.formulaType === "fixo" ? 1
    : material.formulaType === "areaTotal" ? (medidas.areaTotalNestingM2 ?? medidas.areaGeralM2 ?? 0)
    : material.formulaType === "area" ? (medidas.areaM2 ?? 0)
    : material.formulaType === "areaGeral" ? (medidas.areaGeralM2 ?? 0)
    : material.formulaType === "perimExt" ? (medidas.perimExtM ?? 0)
    : (medidas.perimTotalM ?? 0);
  return base * material.multiplicador;
}

function recalcularMateriais(materiais: MaterialCotacao[], medidas: MedidasNesting): MaterialCotacao[] {
  return materiais.map((material) => {
    const quantidade = calcularQuantidadeMaterial(material, medidas);
    return { ...material, quantidade, custoTotal: quantidade * material.custoUnitario };
  });
}

function formulaDaUnidade(unidade: string): FormulaMaterial {
  if (unidade === "m2") return "areaTotal";
  if (unidade === "ml") return "perimExt";
  if (unidade === "perimetro") return "perimTotal";
  return "fixo";
}

function variacoesDoProduto(composicao: NonNullable<RouterOutputs["produtos"]["obter"]>["composicao"]) {
  const unicas = new Map<number, { id: number; nome: string; padrao: boolean }>();
  for (const linha of composicao) {
    if (linha.mubisysVariacaoId == null) continue;
    const id = linha.mubisysVariacaoId;
    const atual = unicas.get(id);
    unicas.set(id, {
      id,
      nome: linha.variacaoNome || `Variação #${id}`,
      padrao: linha.variacaoPadrao || Boolean(atual?.padrao),
    });
  }
  return [...unicas.values()];
}

function materiaisDoProduto(
  composicao: NonNullable<RouterOutputs["produtos"]["obter"]>["composicao"],
  variacoesSelecionadas: number[],
  medidas: MedidasNesting,
): MaterialCotacao[] {
  const linhas = composicao.filter((linha) => linha.mubisysVariacaoId == null || variacoesSelecionadas.includes(linha.mubisysVariacaoId));
  return recalcularMateriais(linhas.map((linha) => ({
    mubisysMateriaPrimaId: linha.mubisysMateriaPrimaId,
    nome: linha.materialNome,
    unidade: linha.unidadeConsumo,
    custoUnitario: linha.custoUnitarioAtual ?? 0,
    quantidade: 0,
    custoTotal: 0,
    formulaType: formulaDaUnidade(linha.unidadeConsumo),
    multiplicador: Number(linha.quantidade),
    variacaoModeloId: linha.mubisysVariacaoId,
    variacaoModeloNome: linha.variacaoNome,
    variacaoMaterial: null,
    incluir: true,
  })), medidas);
}

function materiaisDoNesting(
  materiais: RouterOutputs["propostas"]["nestingsEstudio"][number]["materiais"],
  variacoesSelecionadas: number[],
  medidas: MedidasNesting,
): MaterialCotacao[] {
  return recalcularMateriais(materiais
    .filter((linha) => linha.variacaoModeloId == null || variacoesSelecionadas.includes(linha.variacaoModeloId))
    .map((linha) => ({ ...linha, incluir: true })), medidas);
}

/** Consulta o CNPJ (OpenCNPJ, via backend) e devolve a razão social/nome
 *  fantasia pra autocompletar o nome do cliente — dispara só quando o campo
 *  de CNPJ perde o foco com 14 dígitos, nunca a cada tecla. Não cria nada no
 *  MubiSys (a API dele não tem endpoint de escrita): só evita digitação
 *  manual do nome aqui na proposta. */
function useAutocompleteCnpj(onEncontrado: (nome: string) => void) {
  const utils = trpc.useUtils();
  const [buscando, setBuscando] = useState(false);

  const buscar = async (cnpjDigitado: string) => {
    const digitos = cnpjDigitado.replace(/\D/g, "");
    if (digitos.length !== 14) return;
    setBuscando(true);
    try {
      const resultado = await utils.propostas.consultarCnpj.fetch({ cnpj: digitos });
      if (resultado.encontrado) {
        onEncontrado(resultado.nomeFantasia || resultado.razaoSocial);
        toast.success("CNPJ encontrado", { description: resultado.razaoSocial });
      } else {
        toast.warning("CNPJ não encontrado na Receita Federal");
      }
    } catch (e: any) {
      toast.error("Erro ao consultar CNPJ", { description: e.message });
    } finally {
      setBuscando(false);
    }
  };

  return { buscar, buscando };
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
  const [clienteCnpj, setClienteCnpj] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [vendedorNome, setVendedorNome] = useState("");
  const { buscar: buscarCnpj, buscando: buscandoCnpj } = useAutocompleteCnpj(setClienteNome);

  const criar = trpc.propostas.criar.useMutation({
    onSuccess: (r) => {
      toast.success("Proposta criada");
      utils.propostas.listar.invalidate();
      setCriando(false);
      setClienteCnpj("");
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
              <Label className="text-xs">CNPJ do cliente</Label>
              <Input
                className="w-44"
                value={clienteCnpj}
                onChange={(e) => setClienteCnpj(e.target.value)}
                onBlur={(e) => buscarCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cliente {buscandoCnpj && <span className="text-muted-foreground">(buscando...)</span>}</Label>
              <Input className="w-56" value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Nome do cliente" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vendedor</Label>
              <Input className="w-48" value={vendedorNome} onChange={(e) => setVendedorNome(e.target.value)} placeholder="Nome do vendedor" />
            </div>
            <Button
              size="sm"
              disabled={!clienteNome.trim() || !vendedorNome.trim() || criar.isPending}
              onClick={() => criar.mutate({ clienteNome, clienteCnpj: clienteCnpj || undefined, vendedorNome })}
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

  const [clienteCnpj, setClienteCnpj] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteContato, setClienteContato] = useState("");
  const [vendedorNome, setVendedorNome] = useState("");
  const [formasPagamento, setFormasPagamento] = useState<string[]>([]);
  const [condicaoPagamentoObs, setCondicaoPagamentoObs] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState<"aberta" | "aceita" | "recusada" | "expirada">("aberta");
  const { buscar: buscarCnpj, buscando: buscandoCnpj } = useAutocompleteCnpj(setClienteNome);

  useEffect(() => {
    if (!data) return;
    setClienteCnpj(data.proposta.clienteCnpj ?? "");
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
      clienteCnpj: clienteCnpj || undefined,
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
            <Label className="text-xs">CNPJ do cliente</Label>
            <Input
              value={clienteCnpj}
              onChange={(e) => setClienteCnpj(e.target.value)}
              onBlur={(e) => buscarCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente {buscandoCnpj && <span className="text-muted-foreground">(buscando...)</span>}</Label>
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
  const { data: nestingsSalvas } = trpc.propostas.nestingsEstudio.useQuery();
  const [busca, setBusca] = useState("");
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState("");
  const [variacoesSelecionadas, setVariacoesSelecionadas] = useState<number[]>([]);
  const [nestingSourceId, setNestingSourceId] = useState("");
  const [medidas, setMedidas] = useState<MedidasNesting>(MEDIDAS_VAZIAS);
  const [materiaisCotacao, setMateriaisCotacao] = useState<MaterialCotacao[]>([]);
  const [quantidade, setQuantidade] = useState("1");
  const [precoUnitario, setPrecoUnitario] = useState("");
  const [precoEditado, setPrecoEditado] = useState(false);
  const [sugestaoPreco, setSugestaoPreco] = useState<RouterOutputs["propostas"]["precoSugerir"] | null>(null);
  const [aprovacaoPreco, setAprovacaoPreco] = useState<RouterOutputs["propostas"]["precoAprovar"] | null>(null);
  const [descricoes, setDescricoes] = useState<Record<number, string>>({});
  const [descricoesGrupo, setDescricoesGrupo] = useState<Record<string, string>>({});
  const [itensSelecionados, setItensSelecionados] = useState<number[]>([]);
  const [dialogAgruparAberto, setDialogAgruparAberto] = useState(false);
  const [descricaoNovoGrupo, setDescricaoNovoGrupo] = useState("");

  const { data: produtoDetalhe } = trpc.produtos.obter.useQuery(
    { id: Number(produtoSelecionadoId) },
    { enabled: !!produtoSelecionadoId },
  );
  const produtoAtual = produtoDetalhe?.produto.id === Number(produtoSelecionadoId) ? produtoDetalhe : null;
  const nestingsCompativeis = (nestingsSalvas ?? []).filter((nesting) =>
    !!produtoAtual
      && (nesting.mubisysProdutoId == null || nesting.mubisysProdutoId === produtoAtual.produto.mubisysProdutoId)
      && (nesting.mubisysModeloId == null || nesting.mubisysModeloId === produtoAtual.produto.mubisysModeloId),
  );
  const nestingAtivo = nestingsCompativeis.find((nesting) => nesting.sourceId === nestingSourceId);
  const variacoesProduto = produtoAtual ? variacoesDoProduto(produtoAtual.composicao) : [];
  const nestingsDoMesmoModelo = nestingsCompativeis.filter((nesting) =>
    nesting.mubisysProdutoId === produtoAtual?.produto.mubisysProdutoId
      && nesting.mubisysModeloId === produtoAtual?.produto.mubisysModeloId,
  );
  const variacoesDisponiveis = [...new Map([
    ...variacoesProduto,
    ...nestingsDoMesmoModelo.flatMap((nesting) => nesting.variacoesModelo.map((variacao) => ({ ...variacao, padrao: false }))),
    ...(nestingAtivo?.variacoesModelo ?? []).map((variacao) => ({ ...variacao, padrao: false })),
  ].map((variacao) => [variacao.id, variacao])).values()];

  const montarMateriais = (variacoes: number[], metricas: MedidasNesting, nesting = nestingAtivo) => {
    if (!produtoAtual) return [];
    if (nesting && nesting.materiais.length > 0) {
      const idsDoNesting = nesting.variacoesModelo.map((item) => item.id);
      if (variacoes.every((id) => idsDoNesting.includes(id))) {
        return materiaisDoNesting(nesting.materiais, variacoes, metricas);
      }
    }
    return materiaisDoProduto(produtoAtual.composicao, variacoes, metricas);
  };

  const invalidarPrecoAprovado = () => {
    setAprovacaoPreco(null);
    setSugestaoPreco(null);
  };

  const montarConfiguracaoAtual = (): ConfiguracaoItemCotacao => ({
    nestingSourceId: nestingAtivo?.sourceId ?? null,
    nestingNumero: nestingAtivo?.numero ?? null,
    nestingModeloNome: nestingAtivo?.modeloNome ?? null,
    medidas,
    variacoesModelo: variacoesSelecionadas.map((id) => ({
      id,
      nome: variacoesDisponiveis.find((variacao) => variacao.id === id)?.nome
        ?? nestingAtivo?.variacoesModelo.find((variacao) => variacao.id === id)?.nome
        ?? `Variação #${id}`,
    })),
    materiais: materiaisCotacao,
  });

  const selecionarNesting = (sourceId: string) => {
    invalidarPrecoAprovado();
    setNestingSourceId(sourceId === "__manual" ? "" : sourceId);
    const nesting = nestingsCompativeis.find((item) => item.sourceId === sourceId);
    if (!nesting || !produtoAtual) {
      const variacoes = variacoesProduto.filter((item) => item.padrao).map((item) => item.id);
      const padrao = variacoes.length ? variacoes : variacoesProduto.length === 1 ? [variacoesProduto[0].id] : [];
      setMedidas(MEDIDAS_VAZIAS);
      setVariacoesSelecionadas(padrao);
      setMateriaisCotacao(materiaisDoProduto(produtoAtual?.composicao ?? [], padrao, MEDIDAS_VAZIAS));
      setPrecoEditado(false);
      return;
    }
    const metricas = nesting.medidas;
    const variacoes = nesting.variacoesModelo.map((item) => item.id);
    setMedidas(metricas);
    setVariacoesSelecionadas(variacoes);
    setMateriaisCotacao(montarMateriais(variacoes, metricas, nesting));
    setPrecoEditado(false);
  };

  const alternarVariacaoProduto = (id: number, selecionada: boolean) => {
    invalidarPrecoAprovado();
    const novas = selecionada
      ? [...new Set([...variacoesSelecionadas, id])]
      : variacoesSelecionadas.filter((variacaoId) => variacaoId !== id);
    setVariacoesSelecionadas(novas);
    setMateriaisCotacao(montarMateriais(novas, medidas));
    setPrecoEditado(false);
  };

  const alterarMedida = (campo: keyof MedidasNesting, valor: string) => {
    invalidarPrecoAprovado();
    const novasMedidas = { ...medidas, [campo]: parseMedida(valor) };
    setMedidas(novasMedidas);
    setMateriaisCotacao(montarMateriais(variacoesSelecionadas, novasMedidas));
    setPrecoEditado(false);
  };

  const alternarMaterial = (indice: number, incluir: boolean) => {
    invalidarPrecoAprovado();
    setMateriaisCotacao((atuais) => atuais.map((material, idx) => idx === indice ? { ...material, incluir } : material));
    setPrecoEditado(false);
  };

  useEffect(() => {
    if (!produtoDetalhe) return;
    const variacoes = variacoesDoProduto(produtoDetalhe.composicao);
    const padrao = variacoes.filter((item) => item.padrao).map((item) => item.id);
    const selecionadas = padrao.length ? padrao : variacoes.length === 1 ? [variacoes[0].id] : [];
    setVariacoesSelecionadas(selecionadas);
    setNestingSourceId("");
    setMedidas(MEDIDAS_VAZIAS);
    setMateriaisCotacao(materiaisDoProduto(produtoDetalhe.composicao, selecionadas, MEDIDAS_VAZIAS));
    setPrecoEditado(false);
    setPrecoUnitario(String(produtoDetalhe.custoComFixo.toFixed(2)));
    setSugestaoPreco(null);
    setAprovacaoPreco(null);
  }, [produtoDetalhe?.produto.id]);

  useEffect(() => {
    if (!produtoDetalhe || precoEditado) return;
    const custoMateriais = materiaisCotacao.filter((material) => material.incluir).reduce((total, material) => total + material.custoTotal, 0);
    const percentualFixo = Number(produtoDetalhe.produto.percentualCustoFixo) || 0;
    const temMedidas = Object.values(medidas).some((valor) => valor != null);
    const custoComFixo = temMedidas && materiaisCotacao.length > 0
      ? custoMateriais * (1 + percentualFixo / 100)
      : produtoDetalhe.custoComFixo;
    setPrecoUnitario(custoComFixo.toFixed(2));
  }, [materiaisCotacao, medidas, produtoDetalhe?.produto.id, precoEditado]);

  const adicionar = trpc.propostas.itemAdicionar.useMutation({
    onSuccess: () => {
      toast.success("Item adicionado");
      utils.propostas.obter.invalidate({ id: propostaId });
      setProdutoSelecionadoId("");
      setVariacoesSelecionadas([]);
      setNestingSourceId("");
      setMedidas(MEDIDAS_VAZIAS);
      setMateriaisCotacao([]);
      setQuantidade("1");
      setPrecoUnitario("");
      setPrecoEditado(false);
      setSugestaoPreco(null);
      setAprovacaoPreco(null);
      setBusca("");
    },
    onError: (e) => toast.error("Erro ao adicionar item", { description: e.message }),
  });

  const remover = trpc.propostas.itemRemover.useMutation({
    onSuccess: () => {
      utils.propostas.obter.invalidate({ id: propostaId });
      setItensSelecionados([]);
    },
    onError: (e) => toast.error("Erro ao remover", { description: e.message }),
  });

  const atualizarItem = trpc.propostas.itemAtualizar.useMutation({
    onSuccess: () => utils.propostas.obter.invalidate({ id: propostaId }),
    onError: (e) => toast.error("Erro ao salvar a descrição", { description: e.message }),
  });

  const sugerirPreco = trpc.propostas.precoSugerir.useMutation({
    onSuccess: (resultado) => {
      setSugestaoPreco(resultado);
      setAprovacaoPreco(null);
      toast.success("Sugestão de preço pronta", { description: "Revise a análise e aprove o preço antes de adicionar o item." });
    },
    onError: (e) => toast.error("Não foi possível analisar o preço", { description: e.message }),
  });

  const aprovarPreco = trpc.propostas.precoAprovar.useMutation({
    onSuccess: (resultado) => {
      setAprovacaoPreco(resultado);
      setPrecoUnitario(resultado.precoAprovado.toFixed(2));
      setPrecoEditado(true);
      toast.success("Preço aprovado", { description: `Aprovação registrada por ${resultado.aprovadoPor.nome}.` });
    },
    onError: (e) => toast.error("Aprovação não concluída", { description: e.message }),
  });

  const criarGrupo = trpc.propostas.grupoCriar.useMutation({
    onSuccess: () => {
      toast.success("Produtos agrupados; o cliente verá um único item");
      setItensSelecionados([]);
      setDescricaoNovoGrupo("");
      setDialogAgruparAberto(false);
      utils.propostas.obter.invalidate({ id: propostaId });
    },
    onError: (e) => toast.error("Não foi possível agrupar", { description: e.message }),
  });

  const atualizarDescricaoGrupo = trpc.propostas.grupoAtualizarDescricao.useMutation({
    onSuccess: () => utils.propostas.obter.invalidate({ id: propostaId }),
    onError: (e) => toast.error("Erro ao salvar a descrição do conjunto", { description: e.message }),
  });

  const desfazerGrupo = trpc.propostas.grupoDesfazer.useMutation({
    onSuccess: () => {
      toast.success("Grupo desfeito");
      utils.propostas.obter.invalidate({ id: propostaId });
    },
    onError: (e) => toast.error("Erro ao desfazer grupo", { description: e.message }),
  });

  const opcoes = (produtosCadastrados ?? []).filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()));
  const quantidadePorGrupo = new Map<string, number>();
  for (const item of itens) {
    if (!item.grupoId) continue;
    quantidadePorGrupo.set(item.grupoId, (quantidadePorGrupo.get(item.grupoId) ?? 0) + 1);
  }
  const statusDosSelecionados = new Set(
    itens.filter((item) => itensSelecionados.includes(item.id)).map((item) => item.ativo),
  );
  const selecaoComStatusMisturado = statusDosSelecionados.size > 1;
  const custoMateriaisSelecionados = materiaisCotacao.filter((material) => material.incluir).reduce((total, material) => total + material.custoTotal, 0);
  const temMedidasCotacao = Object.values(medidas).some((valor) => valor != null);
  const custoEstimado = temMedidasCotacao && materiaisCotacao.length > 0
    ? custoMateriaisSelecionados * (1 + (Number(produtoAtual?.produto.percentualCustoFixo) || 0) / 100)
    : (produtoAtual?.custoComFixo ?? 0);

  const solicitarSugestaoPreco = () => {
    const precoAtual = Number(precoUnitario.replace(",", "."));
    if (!produtoAtual || !propostaId || !Number.isFinite(precoAtual) || precoAtual < 0) {
      toast.error("Informe o produto e um preço atual válido antes da análise.");
      return;
    }
    invalidarPrecoAprovado();
    sugerirPreco.mutate({
      propostaId,
      produtoId: Number(produtoSelecionadoId),
      quantidade: Math.max(0.0001, Number(quantidade.replace(",", ".")) || 1),
      precoAtual,
      configuracao: montarConfiguracaoAtual(),
    });
  };

  const aprovarPrecoAtual = (origem: "calculado" | "gpt") => {
    const qtd = Number(quantidade.replace(",", "."));
    if (!produtoAtual || !Number.isFinite(qtd) || qtd <= 0) return;
    const precoAtualInformado = origem === "gpt" && sugestaoPreco
      ? sugestaoPreco.contexto.precoAtual
      : Number(precoUnitario.replace(",", "."));
    const precoAprovado = origem === "gpt" && sugestaoPreco
      ? sugestaoPreco.precoSugerido
      : Number(precoUnitario.replace(",", "."));
    if (!Number.isFinite(precoAprovado) || precoAprovado < 0) {
      toast.error("Informe um preço válido antes da aprovação.");
      return;
    }
    aprovarPreco.mutate({
      propostaId,
      produtoId: Number(produtoSelecionadoId),
      quantidade: qtd,
      configuracao: montarConfiguracaoAtual(),
      precoAtual: precoAtualInformado,
      precoAprovado,
      origem,
      ticket: origem === "gpt" ? sugestaoPreco?.ticket ?? null : null,
    });
  };
  const alternarSelecaoItem = (itemId: number, selecionado: boolean) => {
    setItensSelecionados((atuais) => selecionado
      ? [...atuais, itemId]
      : atuais.filter((id) => id !== itemId));
  };

  const handleAdicionar = () => {
    const qtd = parseFloat(quantidade.replace(",", "."));
    const preco = parseFloat(precoUnitario.replace(",", "."));
    if (!produtoSelecionadoId || isNaN(qtd) || qtd <= 0 || isNaN(preco) || preco < 0) {
      toast.error("Preencha produto, quantidade e preço corretamente");
      return;
    }
    if (!produtoAtual) {
      toast.error("Aguarde o carregamento do produto");
      return;
    }
    if (!aprovacaoPreco) {
      toast.error("Aprovação humana obrigatória", { description: "Aprove o preço calculado ou a sugestão do GPT antes de adicionar o item." });
      return;
    }
    adicionar.mutate({
      propostaId,
      produtoId: Number(produtoSelecionadoId),
      quantidade: qtd,
      precoUnitario: preco,
      configuracao: montarConfiguracaoAtual(),
      aprovacaoPreco: { recibo: aprovacaoPreco.recibo, contexto: aprovacaoPreco.contexto },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Itens da proposta</CardTitle>
        <p className="text-xs text-muted-foreground">Produtos vêm do catálogo cadastrado em Comercial &gt; Produtos.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4 rounded-lg border p-3 bg-muted/30">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Produto</Label>
              <div className="flex gap-2">
                <Input className="w-48 h-8 text-xs" placeholder="Filtrar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                <Select value={produtoSelecionadoId} onValueChange={(value) => {
                  setProdutoSelecionadoId(value);
                  setVariacoesSelecionadas([]);
                  setNestingSourceId("");
                  setMedidas(MEDIDAS_VAZIAS);
                  setMateriaisCotacao([]);
                  setPrecoEditado(false);
                  invalidarPrecoAprovado();
                }}>
                  <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {opcoes.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantidade</Label>
              <Input className="w-24 h-8 text-xs" value={quantidade} onChange={(e) => { setQuantidade(e.target.value); invalidarPrecoAprovado(); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preço de venda (un.)</Label>
              <Input className="w-32 h-8 text-xs" value={precoUnitario} onChange={(e) => { setPrecoUnitario(e.target.value); setPrecoEditado(true); invalidarPrecoAprovado(); }} />
              {produtoAtual && (
                <p className="text-[11px] text-muted-foreground">
                  custo estimado: {fmtBrl(custoEstimado)}
                </p>
              )}
            </div>
            <Button size="sm" onClick={handleAdicionar} disabled={adicionar.isPending || !produtoAtual || !aprovacaoPreco}>Adicionar</Button>
          </div>

          {produtoAtual && (
            <div className="space-y-2 rounded-md border bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={solicitarSugestaoPreco} disabled={sugerirPreco.isPending || aprovarPreco.isPending}>
                  {sugerirPreco.isPending ? "GPT analisando…" : "Analisar preço com GPT"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => aprovarPrecoAtual("calculado")} disabled={aprovarPreco.isPending || sugerirPreco.isPending || !precoUnitario}>
                  {aprovarPreco.isPending ? "Registrando aprovação…" : `Aprovar preço atual (${fmtBrl(Number(precoUnitario.replace(",", ".")) || 0)})`}
                </Button>
              </div>
              {sugestaoPreco && (
                <div className="space-y-2 rounded-md bg-muted/50 p-3 text-xs">
                  <p className="font-medium">Sugestão do GPT: {fmtBrl(sugestaoPreco.precoSugerido)} por unidade
                    {sugestaoPreco.margemSugeridaPct != null && ` · margem estimada ${fmtNum(sugestaoPreco.margemSugeridaPct, 1)}%`}
                  </p>
                  <p className="text-muted-foreground">{sugestaoPreco.parecer}</p>
                  {sugestaoPreco.alertas.length > 0 && (
                    <ul className="list-disc pl-5 text-amber-700">
                      {sugestaoPreco.alertas.map((alerta, index) => <li key={`${index}-${alerta}`}>{alerta}</li>)}
                    </ul>
                  )}
                  <Button size="sm" onClick={() => aprovarPrecoAtual("gpt")} disabled={aprovarPreco.isPending}>
                    Aprovar sugestão do GPT ({fmtBrl(sugestaoPreco.precoSugerido)})
                  </Button>
                </div>
              )}
              {aprovacaoPreco ? (
                <p className="text-[11px] text-emerald-700">
                  Preço {aprovacaoPreco.origem === "gpt" ? "sugerido pelo GPT" : "atual"} aprovado por {aprovacaoPreco.aprovadoPor.nome} em {fmtDateTime(aprovacaoPreco.aprovadoEm)}. Alterar produto, composição, medidas, quantidade ou preço invalida a aprovação.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">A aprovação deve ser feita por gestor, admin ou master. O item só entra na proposta após a aprovação do preço.</p>
              )}
            </div>
          )}

          {produtoAtual && (
            <div className="space-y-4 border-t pt-4">
              {variacoesDisponiveis.length > 0 && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Variações do modelo</Label>
                    <p className="text-[11px] text-muted-foreground">Marque todas as variações e materiais que devem participar deste item.</p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {variacoesDisponiveis.map((variacao) => (
                      <label key={variacao.id} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={variacoesSelecionadas.includes(variacao.id)}
                          onCheckedChange={(checked) => alternarVariacaoProduto(variacao.id, checked === true)}
                        />
                        <span>{variacao.nome}{variacao.padrao ? " (padrão)" : ""}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_2fr]">
                <div className="space-y-2">
                  <Label className="text-xs">Medidas do nesting salvo no CPQ Letreiros Express</Label>
                  <Select value={nestingSourceId || "__manual"} onValueChange={selecionarNesting}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__manual">Sem nesting — informar medidas</SelectItem>
                      {nestingsCompativeis.map((nesting) => (
                        <SelectItem key={nesting.sourceId} value={nesting.sourceId}>
                          {nesting.numero} · {nesting.modeloNome} · {fmtDateTime(nesting.criadaEm)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Os valores importados são editáveis. Materiais seguem as fórmulas da composição e atualizam o custo automaticamente.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {CAMPOS_MEDIDA.map((campo) => (
                    <label key={campo.chave} className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">{campo.rotulo} ({campo.unidade})</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        className="h-8 text-xs"
                        value={medidas[campo.chave] ?? ""}
                        onChange={(event) => alterarMedida(campo.chave, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs">Matérias-primas deste item ({materiaisCotacao.filter((material) => material.incluir).length} selecionadas)</Label>
                  {nestingAtivo && <Badge variant="outline">Origem: {nestingAtivo.numero}</Badge>}
                </div>
                {materiaisCotacao.length === 0 ? (
                  <p className="rounded-md border p-3 text-xs text-muted-foreground">Não há materiais na composição para as variações selecionadas.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border bg-background">
                    <Table>
                      <TableHeader><TableRow><TableHead className="w-10">Usar</TableHead><TableHead>Matéria-prima / variação</TableHead><TableHead>Fórmula</TableHead><TableHead>Qtd. por produto</TableHead><TableHead>Custo unit.</TableHead><TableHead>Custo</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {materiaisCotacao.map((material, index) => (
                          <TableRow key={`${material.mubisysMateriaPrimaId ?? material.nome}-${material.variacaoModeloId ?? "base"}-${index}`} className={!material.incluir ? "opacity-50" : ""}>
                            <TableCell><Checkbox checked={material.incluir} onCheckedChange={(checked) => alternarMaterial(index, checked === true)} aria-label={`Incluir ${material.nome}`} /></TableCell>
                            <TableCell className="font-medium">
                              {material.nome}
                              {material.variacaoModeloNome && <div className="text-[11px] font-normal text-muted-foreground">{material.variacaoModeloNome}</div>}
                              {material.variacaoMaterial && <div className="text-[11px] font-normal text-muted-foreground">{material.variacaoMaterial.nome}: {material.variacaoMaterial.valor}</div>}
                            </TableCell>
                            <TableCell className="text-xs">{FORMULA_LABEL[material.formulaType]}</TableCell>
                            <TableCell className="whitespace-nowrap">{fmtNum(material.quantidade, 3)} {material.unidade}</TableCell>
                            <TableCell>{fmtBrl(material.custoUnitario)}</TableCell>
                            <TableCell>{fmtBrl(material.custoTotal)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item adicionado ainda.</p>
        ) : (
          <div className="space-y-3">
            {itensSelecionados.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 bg-muted/30">
                <p className="text-sm">{itensSelecionados.length} produto(s) selecionado(s)</p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={itensSelecionados.length < 2 || selecaoComStatusMisturado}
                  onClick={() => setDialogAgruparAberto(true)}
                >
                  <Layers className="mr-2 h-4 w-4" /> Agrupar em um item
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setItensSelecionados([])}>
                  Limpar seleção
                </Button>
                {selecaoComStatusMisturado && (
                  <p className="w-full text-xs text-destructive">
                    Para manter o total correto, agrupe produtos que estejam todos ativos ou todos desligados.
                  </p>
                )}
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Agrupar</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Descrição para a cotação</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Preço unit.</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead>Prazo (d.ú.)</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item, itemIndex) => {
                  const ehPrimeiroDoGrupo = !!item.grupoId && itens.findIndex((candidato) => candidato.grupoId === item.grupoId) === itemIndex;
                  return (
                    <TableRow key={item.id} className={!item.ativo ? "opacity-50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={itensSelecionados.includes(item.id)}
                          disabled={!!item.grupoId}
                          aria-label={`Selecionar ${item.produtoNome} para agrupar`}
                          onCheckedChange={(checked) => alternarSelecaoItem(item.id, checked === true)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.produtoNome}</TableCell>
                      <TableCell className="min-w-64">
                        {item.grupoId ? (
                          ehPrimeiroDoGrupo ? (
                            <div className="space-y-1">
                              <Badge variant="secondary">Exibido como um único item</Badge>
                              <Textarea
                                rows={2}
                                maxLength={5000}
                                value={descricoesGrupo[item.grupoId] ?? item.grupoDescricao}
                                onChange={(e) => setDescricoesGrupo((atual) => ({ ...atual, [item.grupoId!]: e.target.value }))}
                                onBlur={(e) => {
                                  const descricao = e.target.value;
                                  if (descricao !== item.grupoDescricao) {
                                    atualizarDescricaoGrupo.mutate({ propostaId, grupoId: item.grupoId!, descricao });
                                  }
                                }}
                                placeholder="Descreva o conjunto para o cliente"
                                aria-label={`Descrição do conjunto com ${quantidadePorGrupo.get(item.grupoId) ?? 0} produtos`}
                                disabled={atualizarDescricaoGrupo.isPending}
                              />
                              <p className="text-[11px] text-muted-foreground">
                                Descrição compartilhada pelos {quantidadePorGrupo.get(item.grupoId) ?? 0} produtos. Salva ao sair.
                              </p>
                            </div>
                          ) : (
                            <Badge variant="outline">Componente oculto do cliente</Badge>
                          )
                        ) : (
                          <>
                            <Textarea
                              rows={2}
                              maxLength={5000}
                              value={descricoes[item.id] ?? item.descricao ?? ""}
                              onChange={(e) => setDescricoes((atual) => ({ ...atual, [item.id]: e.target.value }))}
                              onBlur={(e) => {
                                const descricao = e.target.value;
                                if (descricao !== (item.descricao ?? "")) {
                                  atualizarItem.mutate({
                                    id: item.id,
                                    quantidade: Number(item.quantidade),
                                    precoUnitario: Number(item.precoUnitario),
                                    descricao,
                                  });
                                }
                              }}
                              placeholder="Descreva este produto para o cliente"
                              aria-label={`Descrição para ${item.produtoNome}`}
                              disabled={atualizarItem.isPending}
                            />
                            <p className="mt-1 text-[11px] text-muted-foreground">Salva ao sair do campo</p>
                          </>
                        )}
                      </TableCell>
                      <TableCell>{Number(item.quantidade)}</TableCell>
                      <TableCell>{fmtBrl(Number(item.precoUnitario))}</TableCell>
                      <TableCell>{fmtBrl(Number(item.precoUnitario) * Number(item.quantidade))}</TableCell>
                      <TableCell>{item.prazoFabricacaoDiasUteis ?? "—"}</TableCell>
                      <TableCell>{item.ativo ? "Sim" : "Desligado pelo cliente"}</TableCell>
                      <TableCell>
                        {item.grupoId && ehPrimeiroDoGrupo && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Desfazer grupo"
                            onClick={() => desfazerGrupo.mutate({ propostaId, grupoId: item.grupoId! })}
                          >
                            <Ungroup className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remover.mutate({ id: item.id })}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Dialog open={dialogAgruparAberto} onOpenChange={setDialogAgruparAberto}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Agrupar produtos em um item</DialogTitle>
                  <DialogDescription>
                    Os {itensSelecionados.length} produtos continuarão separados no cálculo interno, mas o cliente verá uma linha com esta descrição. Agrupe itens que estejam todos ativos ou todos desligados.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="descricao-novo-grupo">Descrição exibida na proposta</Label>
                  <Textarea
                    id="descricao-novo-grupo"
                    rows={4}
                    maxLength={5000}
                    value={descricaoNovoGrupo}
                    onChange={(e) => setDescricaoNovoGrupo(e.target.value)}
                    placeholder="Ex.: Conjunto de fachada com letras caixa, estrutura e instalação"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogAgruparAberto(false)}>Cancelar</Button>
                  <Button
                    disabled={criarGrupo.isPending || itensSelecionados.length < 2}
                    onClick={() => criarGrupo.mutate({ propostaId, itemIds: itensSelecionados, descricao: descricaoNovoGrupo })}
                  >
                    {criarGrupo.isPending ? "Agrupando…" : "Agrupar produtos"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
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
