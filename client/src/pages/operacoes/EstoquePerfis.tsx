import { useMemo, useState } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import KpiCard from "@/components/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDateTime, fmtNum } from "@/lib/format";
import {
  AlertTriangle,
  ArrowDownToLine,
  Boxes,
  CircleDot,
  ClipboardCheck,
  PackageCheck,
  Pencil,
  RefreshCw,
  Search,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import BobinasPerfilDialog from "./BobinasPerfilDialog";

type Painel = RouterOutputs["perfilEstoque"]["painel"];
type Perfil = Painel["itens"][number];
type Acao = "saldo" | "entrada" | "alvo";

const parseNumero = (valor: string) => {
  const texto = valor.trim().replace(/\s/g, "");
  if (!texto) return null;
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
};

const tituloCurto = (nome: string) => nome.split("|")[0].trim();
const detalheNome = (nome: string) =>
  nome.includes("|") ? nome.split("|").slice(1).join("|").trim() : null;

function StatusEstoque({ item }: { item: Perfil }) {
  if (item.alvoDoisMeses == null)
    return <Badge variant="secondary">Alvo pendente</Badge>;
  if (item.saldoAtual <= 0 && item.alvoDoisMeses > 0)
    return <Badge variant="destructive">Sem estoque</Badge>;
  if (item.statusCompra === "critico")
    return <Badge variant="destructive">Crítico</Badge>;
  if (item.statusCompra === "comprar")
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        Comprar agora
      </Badge>
    );
  if (item.statusCompra === "abaixo_ideal")
    return (
      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
        Abaixo do ideal
      </Badge>
    );
  return (
    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
      Ideal
    </Badge>
  );
}

export default function EstoquePerfis() {
  const { user } = useAuth();
  const podeGerir = ["gestor", "admin", "master"].includes(
    String(user?.role ?? "")
  );
  const podeContar = [
    "producao",
    "logistica",
    "gestor",
    "admin",
    "master",
  ].includes(String(user?.role ?? ""));
  const utils = trpc.useUtils();
  const painel = trpc.perfilEstoque.painel.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const [busca, setBusca] = useState("");
  const [familia, setFamilia] = useState("todas");
  const [filtroEstoque, setFiltroEstoque] = useState("todos");
  const [acao, setAcao] = useState<Acao | null>(null);
  const [selecionado, setSelecionado] = useState<Perfil | null>(null);
  const [perfilBobinas, setPerfilBobinas] = useState<Perfil | null>(null);
  const [valor, setValor] = useState("");
  const [kgPorMetro, setKgPorMetro] = useState("");
  const [horizonteMeses, setHorizonteMeses] = useState("2");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [observacao, setObservacao] = useState("");

  const aposSalvar = async (mensagem: string) => {
    toast.success(mensagem);
    setAcao(null);
    setSelecionado(null);
    setValor("");
    setKgPorMetro("");
    setHorizonteMeses("2");
    setEstoqueMinimo("");
    setObservacao("");
    await utils.perfilEstoque.painel.invalidate();
  };
  const definirSaldo = trpc.perfilEstoque.definirSaldo.useMutation({
    onSuccess: () => void aposSalvar("Inventário físico registrado."),
    onError: error => toast.error(error.message),
  });
  const registrarEntrada = trpc.perfilEstoque.registrarEntrada.useMutation({
    onSuccess: () => void aposSalvar("Entrada de estoque registrada."),
    onError: error => toast.error(error.message),
  });
  const atualizarAlvo = trpc.perfilEstoque.atualizarAlvo.useMutation({
    onSuccess: () => void aposSalvar("Alvo de estoque atualizado."),
    onError: error => toast.error(error.message),
  });
  const sincronizar = trpc.perfilEstoque.sincronizarRecentes.useMutation({
    onSuccess: async resultado => {
      toast.success(
        `${resultado.ordens} O.S. verificadas e ${resultado.movimentos} baixas atualizadas.`
      );
      await utils.perfilEstoque.painel.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const familias = useMemo(
    () =>
      [...new Set((painel.data?.itens ?? []).map(item => item.familia))].sort(
        (a, b) => a.localeCompare(b, "pt-BR")
      ),
    [painel.data?.itens]
  );
  const itens = useMemo(
    () =>
      (painel.data?.itens ?? []).filter(item => {
        const termo = busca.trim().toLocaleLowerCase("pt-BR");
        return (
          (familia === "todas" || item.familia === familia) &&
          (filtroEstoque === "todos" ||
            (filtroEstoque === "comprar_acao" &&
              ["critico", "comprar"].includes(item.statusCompra)) ||
            item.statusCompra === filtroEstoque) &&
          (!termo || item.nome.toLocaleLowerCase("pt-BR").includes(termo))
        );
      }),
    [painel.data?.itens, busca, familia, filtroEstoque]
  );

  const abrir = (item: Perfil, proximaAcao: Acao) => {
    setSelecionado(item);
    setAcao(proximaAcao);
    setObservacao("");
    setValor(
      proximaAcao === "saldo"
        ? String(item.saldoAtual).replace(".", ",")
        : proximaAcao === "alvo"
          ? String(item.alvoAtual ?? "").replace(".", ",")
          : ""
    );
    setKgPorMetro(
      proximaAcao === "alvo"
        ? String(item.kgPorMetro ?? "").replace(".", ",")
        : ""
    );
    setHorizonteMeses(String(item.horizonteMeses ?? 2));
    const minimoSugerido = item.estoqueMinimoConfigurado ?? item.consumoMensal;
    setEstoqueMinimo(
      minimoSugerido == null ? "" : String(minimoSugerido).replace(".", ",")
    );
  };
  const salvar = () => {
    if (!selecionado || !acao) return;
    const numero = parseNumero(valor);
    if (numero == null || numero < 0 || (acao === "entrada" && numero <= 0)) {
      toast.error("Informe uma quantidade válida.");
      return;
    }
    if (acao === "saldo")
      definirSaldo.mutate({
        perfilItemId: selecionado.id,
        saldo: numero,
        observacao: observacao || null,
      });
    if (acao === "entrada")
      registrarEntrada.mutate({
        perfilItemId: selecionado.id,
        quantidade: numero,
        observacao: observacao || null,
      });
    if (acao === "alvo") {
      const peso = kgPorMetro.trim() ? parseNumero(kgPorMetro) : null;
      if (peso != null && peso <= 0) {
        toast.error("O peso por metro precisa ser maior que zero.");
        return;
      }
      const meses = Number(horizonteMeses);
      if (!Number.isInteger(meses) || meses < 1 || meses > 24) {
        toast.error("Informe um horizonte entre 1 e 24 meses.");
        return;
      }
      const minimo = estoqueMinimo.trim() ? parseNumero(estoqueMinimo) : null;
      if (estoqueMinimo.trim() && (minimo == null || minimo < 0)) {
        toast.error("Informe um estoque mínimo válido e não negativo.");
        return;
      }
      if (minimo != null && minimo > numero) {
        toast.error(
          "O estoque mínimo não pode superar o nível ideal do horizonte."
        );
        return;
      }
      atualizarAlvo.mutate({
        perfilItemId: selecionado.id,
        alvoDoisMeses: (numero * 2) / meses,
        horizonteMeses: meses,
        estoqueMinimo: minimo,
        kgPorMetro: peso,
      });
    }
  };
  const pendente =
    definirSaldo.isPending ||
    registrarEntrada.isPending ||
    atualizarAlvo.isPending;

  if (painel.isLoading)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  if (painel.error || !painel.data)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangle />
          </EmptyMedia>
          <EmptyTitle>Estoque indisponível</EmptyTitle>
          <EmptyDescription>
            {painel.error?.message ?? "Não foi possível carregar o estoque."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  const { resumo } = painel.data;
  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <PageHeader
        title="Estoque de Perfis"
        description="Saldo físico, baixas automáticas por O.S. e planejamento de compras."
        icon={Boxes}
      />

      <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="text-sm text-blue-950 dark:text-blue-100">
            <div className="font-semibold">
              Baixa automática vinculada à sincronização do MubiSys
            </div>
            <p className="mt-1 text-xs leading-relaxed text-blue-800/80 dark:text-blue-200/80 sm:text-sm">
              Cada O.S. usa a BOM espelhada do modelo e da variação. O.S. sem
              composição ou medidas ficam em Pendências e não baixam material
              silenciosamente.
            </p>
          </div>
          {podeGerir && (
            <Button
              onClick={() => sincronizar.mutate({ dias: 8 })}
              disabled={sincronizar.isPending}
              className="w-full shrink-0 gap-2 sm:w-auto"
            >
              <RefreshCw
                className={`h-4 w-4 ${sincronizar.isPending ? "animate-spin" : ""}`}
              />{" "}
              Sincronizar O.S. recentes
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Perfis controlados"
          value={fmtNum(resumo.perfis)}
          icon={Boxes}
          color="#176e9b"
          className="min-w-0 p-3 sm:p-5 [&_.metric-value]:text-xl sm:[&_.metric-value]:text-2xl"
        />
        <KpiCard
          label="Sem estoque"
          value={fmtNum(resumo.semEstoque)}
          sub="com alvo acima de zero"
          icon={AlertTriangle}
          color="#b3463b"
          className="min-w-0 p-3 sm:p-5 [&_.metric-value]:text-xl sm:[&_.metric-value]:text-2xl"
        />
        <KpiCard
          label="Abaixo do alvo"
          value={fmtNum(resumo.abaixoDoAlvo)}
          sub="abaixo do horizonte configurado por perfil"
          icon={ShoppingCart}
          color="#d78d32"
          className="min-w-0 p-3 sm:p-5 [&_.metric-value]:text-xl sm:[&_.metric-value]:text-2xl"
        />
        <KpiCard
          label="Compra sugerida"
          value={`${fmtNum(resumo.compraSugeridaMetros, 0)} m`}
          sub={`${fmtNum(resumo.compraSugeridaKg, 2)} kg teóricos`}
          icon={PackageCheck}
          color="#178b82"
          className="min-w-0 p-3 sm:p-5 [&_.metric-value]:text-xl sm:[&_.metric-value]:text-2xl"
        />
        <KpiCard
          label="O.S. pendentes"
          value={fmtNum(resumo.osPendentes)}
          sub="exigem revisão da BOM"
          icon={ClipboardCheck}
          color="#805ad5"
          className="min-w-0 p-3 sm:p-5 [&_.metric-value]:text-xl sm:[&_.metric-value]:text-2xl"
        />
      </div>

      <Tabs defaultValue="estoque" className="min-w-0 space-y-3 sm:space-y-4">
        <TabsList className="flex h-auto w-full max-w-full flex-nowrap justify-start overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger
            className="shrink-0 px-3 text-xs sm:text-sm"
            value="estoque"
          >
            Estoque e compras
          </TabsTrigger>
          <TabsTrigger
            className="shrink-0 px-3 text-xs sm:text-sm"
            value="movimentos"
          >
            Movimentações
          </TabsTrigger>
          <TabsTrigger
            className="shrink-0 px-3 text-xs sm:text-sm"
            value="pendencias"
          >
            Pendências ({resumo.osPendentes})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="estoque" className="space-y-4">
          <Card className="min-w-0">
            <CardHeader className="px-3 pb-3 pt-4 sm:px-6">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span>Perfis</span>
                <Badge variant="secondary">{itens.length} exibido(s)</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-3 px-3 pb-4 sm:space-y-4 sm:px-6">
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_200px_220px]">
                <div className="relative min-w-0">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={event => setBusca(event.target.value)}
                    className="min-w-0 pl-9"
                    placeholder="Buscar liga, largura ou acabamento..."
                  />
                </div>
                <Select value={familia} onValueChange={setFamilia}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as famílias</SelectItem>
                    {familias.map(item => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroEstoque} onValueChange={setFiltroEstoque}>
                  <SelectTrigger aria-label="Filtrar por nível de estoque">
                    <SelectValue placeholder="Todos os níveis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os níveis</SelectItem>
                    <SelectItem value="comprar_acao">
                      Crítico / comprar agora
                    </SelectItem>
                    <SelectItem value="critico">Crítico</SelectItem>
                    <SelectItem value="comprar">Comprar agora</SelectItem>
                    <SelectItem value="abaixo_ideal">
                      Abaixo do ideal
                    </SelectItem>
                    <SelectItem value="ideal">Ideal</SelectItem>
                    <SelectItem value="configurar">Alvo pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="hidden overflow-x-auto rounded-md border lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Saldo atual</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead className="text-right">
                        Médio / comprar
                      </TableHead>
                      <TableHead className="text-right">
                        Ideal · horizonte
                      </TableHead>
                      <TableHead className="text-right">Comprar</TableHead>
                      <TableHead className="text-right">
                        Equivalente kg
                      </TableHead>
                      <TableHead className="w-[270px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="max-w-[420px]">
                          <div className="font-medium">
                            {tituloCurto(item.nome)}
                          </div>
                          {detalheNome(item.nome) && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {detalheNome(item.nome)}
                            </div>
                          )}
                          <Badge variant="outline" className="mt-1.5">
                            {item.familia}
                          </Badge>
                          {item.statusCatalogo === "descontinuado" && (
                            <Badge
                              variant="destructive"
                              className="ml-1.5 mt-1.5"
                            >
                              Descontinuado no MubiSys
                            </Badge>
                          )}
                          {item.observacao && (
                            <div className="mt-1 text-xs text-amber-700">
                              {item.observacao}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusEstoque item={item} />
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${item.saldoAtual < 0 ? "text-destructive" : ""}`}
                        >
                          {fmtNum(item.saldoAtual, 2)} {item.unidade}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.estoqueMinimo == null
                            ? "—"
                            : `${fmtNum(item.estoqueMinimo, 2)} ${item.unidade}`}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.estoqueMedio == null
                            ? "—"
                            : `${fmtNum(item.estoqueMedio, 2)} ${item.unidade}`}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.alvoAtual == null
                            ? "—"
                            : `${fmtNum(item.alvoAtual, 0)} ${item.unidade}`}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-amber-700">
                          {item.sugestaoCompra == null
                            ? "—"
                            : `${fmtNum(item.sugestaoCompra, 2)} ${item.unidade}`}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.sugestaoCompraKg == null
                            ? "—"
                            : `${fmtNum(item.sugestaoCompraKg, 2)} kg`}
                        </TableCell>
                        <TableCell>
                          <Acoes
                            item={item}
                            podeGerir={podeGerir}
                            podeContar={podeContar}
                            abrir={abrir}
                            abrirBobinas={setPerfilBobinas}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 sm:space-y-3 lg:hidden">
                {itens.map(item => (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="space-y-3 p-3 sm:p-4">
                      <div>
                        <div className="font-semibold leading-snug">
                          {tituloCurto(item.nome)}
                        </div>
                        {detalheNome(item.nome) && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {detalheNome(item.nome)}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="outline">{item.familia}</Badge>
                          {item.statusCatalogo === "descontinuado" && (
                            <Badge variant="destructive">
                              Descontinuado no MubiSys
                            </Badge>
                          )}
                          <StatusEstoque item={item} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                        <div>
                          <span className="block text-xs text-muted-foreground">
                            Saldo atual
                          </span>
                          <b>
                            {fmtNum(item.saldoAtual, 2)} {item.unidade}
                          </b>
                        </div>
                        <div>
                          <span className="block text-xs text-muted-foreground">
                            Mínimo
                          </span>
                          <b>
                            {item.estoqueMinimo == null
                              ? "Definir"
                              : `${fmtNum(item.estoqueMinimo, 2)} ${item.unidade}`}
                          </b>
                        </div>
                        <div>
                          <span className="block text-xs text-muted-foreground">
                            Médio · comprar ao atingir
                          </span>
                          <b>
                            {item.estoqueMedio == null
                              ? "—"
                              : `${fmtNum(item.estoqueMedio, 2)} ${item.unidade}`}
                          </b>
                        </div>
                        <div>
                          <span className="block text-xs text-muted-foreground">
                            Ideal · {item.horizonteMeses}{" "}
                            {item.horizonteMeses === 1 ? "mês" : "meses"}
                          </span>
                          <b>
                            {item.alvoAtual == null
                              ? "—"
                              : `${fmtNum(item.alvoAtual, 0)} ${item.unidade}`}
                          </b>
                        </div>
                        <div>
                          <span className="block text-xs text-muted-foreground">
                            Comprar
                          </span>
                          <b className="text-amber-700">
                            {item.sugestaoCompra == null
                              ? "—"
                              : `${fmtNum(item.sugestaoCompra, 2)} ${item.unidade}`}
                          </b>
                        </div>
                        <div>
                          <span className="block text-xs text-muted-foreground">
                            Peso da compra
                          </span>
                          <b>
                            {item.sugestaoCompraKg == null
                              ? "—"
                              : `${fmtNum(item.sugestaoCompraKg, 2)} kg`}
                          </b>
                        </div>
                      </div>
                      {item.observacao && (
                        <p className="text-xs text-amber-700">
                          {item.observacao}
                        </p>
                      )}
                      <Acoes
                        item={item}
                        podeGerir={podeGerir}
                        podeContar={podeContar}
                        abrir={abrir}
                        abrirBobinas={setPerfilBobinas}
                        mobile
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimentos">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Histórico de movimentações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {painel.data.movimentos.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Nenhuma movimentação</EmptyTitle>
                    <EmptyDescription>
                      Cadastre o inventário inicial ou sincronize as O.S.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <>
                  <div className="hidden overflow-x-auto rounded-md border lg:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Perfil</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead className="text-right">
                            Quantidade
                          </TableHead>
                          <TableHead>Responsável / observação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {painel.data.movimentos.map(movimento => (
                          <TableRow key={movimento.id}>
                            <TableCell className="whitespace-nowrap">
                              {fmtDateTime(movimento.updatedAt)}
                            </TableCell>
                            <TableCell className="max-w-[340px] font-medium">
                              {tituloCurto(movimento.perfilNome)}
                            </TableCell>
                            <TableCell>
                              {movimento.tipo === "saida_os" ? (
                                <Badge variant="outline">
                                  O.S. {movimento.osNumero}
                                </Badge>
                              ) : movimento.tipo === "entrada_manual" ? (
                                <Badge className="bg-emerald-100 text-emerald-800">
                                  Entrada
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Inventário</Badge>
                              )}
                            </TableCell>
                            <TableCell
                              className={`text-right font-semibold ${movimento.quantidade < 0 ? "text-red-700" : "text-emerald-700"}`}
                            >
                              {movimento.quantidade > 0 ? "+" : ""}
                              {fmtNum(movimento.quantidade, 2)}{" "}
                              {movimento.unidade}
                            </TableCell>
                            <TableCell className="max-w-[360px]">
                              <div>{movimento.criadoPor}</div>
                              <div className="text-xs text-muted-foreground">
                                {movimento.descricao}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-2 lg:hidden">
                    {painel.data.movimentos.map(movimento => (
                      <Card key={movimento.id} className="min-w-0">
                        <CardContent className="space-y-2 p-3">
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-semibold">
                                {tituloCurto(movimento.perfilNome)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {fmtDateTime(movimento.updatedAt)}
                              </div>
                            </div>
                            <span
                              className={`shrink-0 text-right font-semibold ${movimento.quantidade < 0 ? "text-red-700" : "text-emerald-700"}`}
                            >
                              {movimento.quantidade > 0 ? "+" : ""}
                              {fmtNum(movimento.quantidade, 2)}{" "}
                              {movimento.unidade}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {movimento.tipo === "saida_os" ? (
                              <Badge variant="outline">
                                O.S. {movimento.osNumero}
                              </Badge>
                            ) : movimento.tipo === "entrada_manual" ? (
                              <Badge className="bg-emerald-100 text-emerald-800">
                                Entrada
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Inventário</Badge>
                            )}
                            {movimento.criadoPor && (
                              <span className="text-xs text-muted-foreground">
                                {movimento.criadoPor}
                              </span>
                            )}
                          </div>
                          {movimento.descricao && (
                            <p className="break-words text-xs text-muted-foreground">
                              {movimento.descricao}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pendencias">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                O.S. que precisam de revisão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {painel.data.pendencias.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <PackageCheck />
                    </EmptyMedia>
                    <EmptyTitle>Nenhuma pendência</EmptyTitle>
                    <EmptyDescription>
                      As O.S. sincronizadas possuem dados suficientes para o
                      estoque de perfis.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                painel.data.pendencias.map(os => (
                  <div
                    key={os.osMubisysId}
                    className="rounded-lg border border-amber-200 bg-amber-50/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <b>O.S. {os.osNumero}</b>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {os.status}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {fmtDateTime(os.updatedAt)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {os.itensMapeados} de {os.itensTotal} itens mapeados ·{" "}
                      {os.linhasConsumo} linha(s) de perfil
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                      {os.pendenciasJson.map((pendencia, index) => (
                        <li key={index}>{pendencia}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!acao && !!selecionado}
        onOpenChange={aberto => {
          if (!aberto) {
            setAcao(null);
            setSelecionado(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acao === "saldo"
                ? "Registrar inventário físico"
                : acao === "entrada"
                  ? "Registrar entrada"
                  : "Revisar alvo de estoque"}
            </DialogTitle>
            <DialogDescription>
              {selecionado ? tituloCurto(selecionado.nome) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="quantidade-perfil">
                {acao === "saldo"
                  ? "Saldo físico contado"
                  : acao === "entrada"
                    ? "Quantidade recebida"
                    : `Consumo base para ${horizonteMeses || "…"} ${horizonteMeses === "1" ? "mês" : "meses"}`}{" "}
                ({selecionado?.unidade})
              </Label>
              <Input
                id="quantidade-perfil"
                inputMode="decimal"
                value={valor}
                onChange={event => setValor(event.target.value)}
                placeholder="0,00"
                className="mt-1.5"
              />
            </div>
            {acao === "alvo" && (
              <div>
                <Label htmlFor="horizonte-perfil">
                  Estoque para quantos meses?
                </Label>
                <Input
                  id="horizonte-perfil"
                  type="number"
                  min={1}
                  max={24}
                  step={1}
                  value={horizonteMeses}
                  onChange={event => {
                    const novoHorizonte = event.target.value;
                    const anterior = Number(horizonteMeses);
                    const novo = Number(novoHorizonte);
                    if (
                      Number.isFinite(anterior) &&
                      anterior > 0 &&
                      Number.isFinite(novo) &&
                      novo > 0
                    ) {
                      const atual = parseNumero(valor);
                      if (atual != null)
                        setValor(
                          String((atual / anterior) * novo).replace(".", ",")
                        );
                    }
                    setHorizonteMeses(novoHorizonte);
                  }}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  O consumo base é atualizado automaticamente para o horizonte
                  escolhido.
                </p>
              </div>
            )}
            {acao === "alvo" && (
              <div>
                <Label htmlFor="estoque-minimo-perfil">
                  Estoque mínimo que devo manter ({selecionado?.unidade})
                </Label>
                <Input
                  id="estoque-minimo-perfil"
                  inputMode="decimal"
                  value={estoqueMinimo}
                  onChange={event => setEstoqueMinimo(event.target.value)}
                  placeholder={
                    selecionado?.consumoMensal == null
                      ? "Informe o mínimo"
                      : `Sugestão: ${fmtNum(selecionado.consumoMensal, 2)}`
                  }
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  O nível médio para compra é o mínimo mais 1 mês de consumo,
                  considerando o prazo de entrega do slitter.
                </p>
              </div>
            )}
            {acao === "alvo" && selecionado?.unidade === "m" && (
              <div>
                <Label htmlFor="peso-metro-perfil">
                  Peso teórico por metro (kg/m)
                </Label>
                <Input
                  id="peso-metro-perfil"
                  inputMode="decimal"
                  value={kgPorMetro}
                  onChange={event => setKgPorMetro(event.target.value)}
                  placeholder="Ex.: 0,314"
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Usado para converter o saldo e a sugestão de compra de metros
                  para kg.
                </p>
              </div>
            )}
            {acao !== "alvo" && (
              <div>
                <Label htmlFor="observacao-perfil">Observação</Label>
                <Input
                  id="observacao-perfil"
                  value={observacao}
                  onChange={event => setObservacao(event.target.value)}
                  placeholder={
                    acao === "entrada"
                      ? "Fornecedor, nota fiscal ou lote"
                      : "Contagem realizada por..."
                  }
                  className="mt-1.5"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAcao(null);
                setSelecionado(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={pendente}>
              {pendente ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {perfilBobinas && (
        <BobinasPerfilDialog
          perfil={perfilBobinas}
          aberto
          onOpenChange={aberto => {
            if (!aberto) setPerfilBobinas(null);
          }}
          onSaldoAtualizado={async () => {
            await utils.perfilEstoque.painel.invalidate();
          }}
        />
      )}
    </div>
  );
}

function Acoes({
  item,
  podeGerir,
  podeContar,
  abrir,
  abrirBobinas,
  mobile = false,
}: {
  item: Perfil;
  podeGerir: boolean;
  podeContar: boolean;
  abrir: (item: Perfil, acao: Acao) => void;
  abrirBobinas: (item: Perfil) => void;
  mobile?: boolean;
}) {
  if (!podeGerir && !podeContar)
    return (
      <span className="text-xs text-muted-foreground">Somente consulta</span>
    );
  return (
    <div className={`${mobile ? "grid grid-cols-2" : "flex flex-wrap"} gap-2`}>
      {podeContar && (
        <Button
          size="sm"
          variant="outline"
          className={`${mobile ? "h-auto min-h-10 w-full justify-start whitespace-normal px-2 py-2 text-xs" : "gap-1 px-2"}`}
          onClick={() => abrirBobinas(item)}
          disabled={item.unidade !== "m"}
        >
          <CircleDot className="h-3.5 w-3.5 shrink-0" /> Bobinas
        </Button>
      )}
      {podeGerir && (
        <Button
          size="sm"
          variant="outline"
          className={`${mobile ? "h-auto min-h-10 w-full justify-start whitespace-normal px-2 py-2 text-xs" : "gap-1 px-2"}`}
          onClick={() => abrir(item, "saldo")}
        >
          <ClipboardCheck className="h-3.5 w-3.5 shrink-0" /> Inventário
        </Button>
      )}
      {podeGerir && (
        <Button
          size="sm"
          variant="outline"
          className={`${mobile ? "h-auto min-h-10 w-full justify-start whitespace-normal px-2 py-2 text-xs" : "gap-1 px-2"}`}
          onClick={() => abrir(item, "entrada")}
        >
          <ArrowDownToLine className="h-3.5 w-3.5 shrink-0" /> Entrada
        </Button>
      )}
      {podeGerir && (
        <Button
          size="sm"
          variant="outline"
          className={`${mobile ? "h-auto min-h-10 w-full justify-start whitespace-normal px-2 py-2 text-xs" : "gap-1 px-2"}`}
          onClick={() => abrir(item, "alvo")}
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" /> Alvo
        </Button>
      )}
    </div>
  );
}
