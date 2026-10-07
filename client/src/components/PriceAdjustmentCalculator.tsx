import { useMemo, useState } from "react";
import { Calculator, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtBrl, fmtNum } from "@/lib/format";
import { trpc, type RouterOutputs } from "@/lib/trpc";

export type TabelaCliente = "principal" | "novo_cliente";
type Secao = RouterOutputs["price"]["list"][number];
type Produto = RouterOutputs["produtos"]["listar"][number];
type ItemAbc = {
  nome: string;
  total: number;
  count: number;
  pct: string;
  pctAcum: string;
  classe: "A" | "B" | "C";
  produtoId?: number | null;
  modeloId?: number | null;
  variacaoId?: number | null;
  skuErp?: string | null;
};
type ConteudoTabela = {
  type?: string;
  columns?: string[];
  rows?: Array<{ id: number; label: string; values: string[] }>;
};
type LinhaPreco = {
  id: number;
  page: number;
  secaoId: number;
  secao: string;
  linha: string;
  conteudo: ConteudoTabela;
  valores: string[];
};
type LinhaSimulada = LinhaPreco & {
  novosValores: string[];
  margensValidas: number[];
  variacaoPrecoPct: number[];
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabela: TabelaCliente;
  secoes: Secao[];
}

function normalizarNome(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function lerMargem(value: string): number | null {
  const match = value.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*%$/);
  return match ? Number(match[1].replace(",", ".")) : null;
}
function aplicarPontos(value: string, delta: number): string {
  const margem = lerMargem(value);
  if (margem === null) return value;
  const casas = value.match(/[.,](\d+)%$/)?.[1].length ?? 0;
  return `${(margem + delta).toFixed(casas).replace(".", ",")}%`;
}
function fatorPreco(margemAtual: number, margemNova: number): number {
  const atual = margemAtual / 100;
  const nova = margemNova / 100;
  if (nova >= 1 || atual >= 1) return Number.NaN;
  return (1 - atual) / (1 - nova);
}
function pageBase(tabela: TabelaCliente): number {
  return tabela === "novo_cliente" ? 11 : 1;
}

export function PriceAdjustmentCalculator({
  open,
  onOpenChange,
  tabela,
  secoes,
}: Props) {
  const [deltaPp, setDeltaPp] = useState(2);
  const [pagina, setPagina] = useState("todas");
  const [mesAno, setMesAno] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  });
  const [vinculosManuais, setVinculosManuais] = useState<
    Record<string, string>
  >({});
  const [aplicando, setAplicando] = useState(false);
  const [forcarAtualizacao, setForcarAtualizacao] = useState(false);
  const utils = trpc.useUtils();
  const partesData = mesAno.split("-").map(Number);
  const ano = partesData[0] || new Date().getFullYear();
  const mes = partesData[1] || new Date().getMonth() + 1;
  const {
    data: abc,
    isLoading: abcCarregando,
    isFetching: abcBuscando,
    error: abcErro,
    refetch: refazerAbc,
  } = trpc.performanceAbc.getAbc.useQuery(
    { mes, ano, tipo: "produtos", forceRefresh: forcarAtualizacao, detalhado: true },
    { enabled: open }
  );
  const { data: produtos, isLoading: produtosCarregando } =
    trpc.produtos.listar.useQuery(undefined, { enabled: open });
  const atualizarSecao = trpc.price.update.useMutation();
  const { data: impactoHistorico, isLoading: historicoCarregando, error: historicoErro } =
    trpc.price.getHistoricalImpact.useQuery({ mes, ano, tabela }, { enabled: open });

  const base = pageBase(tabela);
  const secoesAtivas = useMemo(
    () =>
      secoes.filter(
        secao =>
          secao.page >= base &&
          secao.page <= base + 2 &&
          (pagina === "todas" || secao.page === base + Number(pagina) - 1)
      ),
    [secoes, base, pagina]
  );
  const linhas = useMemo(() => {
    const resultado: LinhaPreco[] = [];
    for (const secao of secoesAtivas) {
      let conteudo: ConteudoTabela;
      try {
        conteudo = JSON.parse(secao.contentJson) as ConteudoTabela;
      } catch {
        continue;
      }
      if (
        conteudo.type !== "margin_table" &&
        conteudo.type !== "margin_table_multi"
      )
        continue;
      for (const linha of conteudo.rows ?? []) {
        if (!Array.isArray(linha.values)) continue;
        resultado.push({
          id: linha.id,
          page: secao.page,
          secaoId: secao.id,
          secao: secao.sectionTitle,
          linha: linha.label,
          conteudo,
          valores: linha.values,
        });
      }
    }
    return resultado;
  }, [secoesAtivas]);
  const linhasPorId = useMemo(
    () => new Map(linhas.map(linha => [linha.id, linha])),
    [linhas]
  );
  const linhasSimuladas = useMemo<LinhaSimulada[]>(
    () =>
      linhas.map(linha => {
        const novosValores = linha.valores.map(valor =>
          aplicarPontos(valor, deltaPp)
        );
        const margens = linha.valores
          .map(lerMargem)
          .filter((valor): valor is number => valor !== null);
        const variacoes = linha.valores.flatMap(valor => {
          const anterior = lerMargem(valor);
          const nova = lerMargem(aplicarPontos(valor, deltaPp));
          if (anterior === null || nova === null) return [];
          return [(fatorPreco(anterior, nova) - 1) * 100];
        });
        return {
          ...linha,
          novosValores,
          margensValidas: margens,
          variacaoPrecoPct: variacoes,
        };
      }),
    [linhas, deltaPp]
  );
  const celulasValidas = linhasSimuladas.reduce(
    (total, linha) => total + linha.margensValidas.length,
    0
  );
  const margensAtuais = linhasSimuladas.flatMap(linha => linha.margensValidas);
  const mediaAtual = margensAtuais.length
    ? margensAtuais.reduce((total, valor) => total + valor, 0) /
      margensAtuais.length
    : 0;
  const mediaNova = mediaAtual + deltaPp;
  const invalida = linhasSimuladas.some(linha =>
    linha.novosValores.some(valor => {
      const margem = lerMargem(valor);
      return margem !== null && (margem < 0 || margem >= 95);
    })
  );
  const produtosAtivos = useMemo(
    () => (produtos ?? []).filter(produto => produto.ativo),
    [produtos]
  );
  const linhaPorNomeAbc = (item: ItemAbc): LinhaPreco | undefined => {
    const escolha = vinculosManuais[item.nome];
    if (escolha !== undefined)
      return escolha ? linhasPorId.get(Number(escolha)) : undefined;
    const nome = normalizarNome(item.nome);
    const porModelo = item.modeloId == null ? [] : produtosAtivos.filter(
      produto => produto.mubisysModeloId === item.modeloId &&
        produto.idPrecificacao != null && linhasPorId.has(produto.idPrecificacao)
    );
    const matches = porModelo.length ? porModelo : produtosAtivos.filter(
      produto =>
        normalizarNome(produto.nome) === nome &&
        produto.idPrecificacao != null &&
        linhasPorId.has(produto.idPrecificacao)
    );
    if (matches.length !== 1) return undefined;
    return linhasPorId.get(matches[0].idPrecificacao!);
  };
  const itensAbc = (abc?.items ?? []) as ItemAbc[];
  const impactos = useMemo(
    () =>
      itensAbc.map(item => {
        const linha = linhaPorNomeAbc(item);
        if (!linha)
          return {
            item,
            linha: undefined,
            baixa: null as number | null,
            alta: null as number | null,
          };
        const fatores = linha.valores.flatMap(valor => {
          const atual = lerMargem(valor);
          const nova = lerMargem(aplicarPontos(valor, deltaPp));
          if (atual === null || nova === null) return [];
          const fator = fatorPreco(atual, nova);
          return Number.isFinite(fator) ? [fator] : [];
        });
        if (!fatores.length) return { item, linha, baixa: null, alta: null };
        const fatoresOrdenados = [...fatores].sort((a, b) => a - b);
        return {
          item,
          linha,
          baixa: item.total * (fatoresOrdenados[0] - 1),
          alta:
            item.total * (fatoresOrdenados[fatoresOrdenados.length - 1] - 1),
        };
      }),
    [itensAbc, vinculosManuais, produtosAtivos, linhasPorId, deltaPp]
  );
  const impactosMapeados = impactos.filter(
    item => item.linha && item.baixa !== null && item.alta !== null
  );
  const faturamentoMapeado = impactosMapeados.reduce(
    (total, item) => total + item.item.total,
    0
  );
  const impactoBaixo = impactosMapeados.reduce(
    (total, item) => total + item.baixa!,
    0
  );
  const impactoAlto = impactosMapeados.reduce(
    (total, item) => total + item.alta!,
    0
  );
  const coberturaAbc =
    (abc?.faturamento ?? 0) > 0
      ? (faturamentoMapeado / (abc?.faturamento ?? 1)) * 100
      : 0;
  const rowsInvalidos = linhasSimuladas.flatMap(linha =>
    linha.novosValores
      .map((valor, index) => ({ linha, valor, index }))
      .filter(celula => {
        const margem = lerMargem(celula.valor);
        return margem !== null && (margem < 0 || margem >= 95);
      })
  );
  const nomeTabela =
    tabela === "novo_cliente" ? "Novo Cliente" : "Clientes Antigos";

  async function atualizarDadosAbc() {
    setForcarAtualizacao(true);
    window.setTimeout(() => {
      void refazerAbc().finally(() => setForcarAtualizacao(false));
    }, 100);
  }

  async function aplicarAjuste() {
    if (!deltaPp || !linhas.length || invalida || aplicando) return;
    const atualizacoesPorSecao = new Map<
      number,
      { secao: Secao; conteudo: ConteudoTabela }
    >();
    for (const secao of secoesAtivas) {
      let conteudo: ConteudoTabela;
      try {
        conteudo = JSON.parse(secao.contentJson) as ConteudoTabela;
      } catch {
        continue;
      }
      if (
        conteudo.type !== "margin_table" &&
        conteudo.type !== "margin_table_multi"
      )
        continue;
      let alterou = false;
      conteudo.rows = (conteudo.rows ?? []).map(linha => {
        const novos = (linha.values ?? []).map(valor => {
          if (lerMargem(valor) === null) return valor;
          const novoValor = aplicarPontos(valor, deltaPp);
          if (novoValor !== valor) alterou = true;
          return novoValor;
        });
        return { ...linha, values: novos };
      });
      if (alterou) atualizacoesPorSecao.set(secao.id, { secao, conteudo });
    }
    const atualizacoes = [...atualizacoesPorSecao.entries()];
    setAplicando(true);
    let concluidas = 0;
    try {
      for (const [id, atualizacao] of atualizacoes) {
        await atualizarSecao.mutateAsync({
          id,
          contentJson: JSON.stringify(atualizacao.conteudo),
        });
        concluidas++;
      }
      await Promise.all([
        utils.price.list.invalidate(),
        utils.price.getMeta.invalidate(),
        utils.price.getHistory.invalidate(),
      ]);
      toast.success(
        `Ajuste de ${fmtNum(deltaPp, 1)} p.p. aplicado em ${concluidas} seções de ${nomeTabela}.`
      );
      onOpenChange(false);
    } catch (error) {
      await Promise.all([
        utils.price.list.invalidate(),
        utils.price.getMeta.invalidate(),
        utils.price.getHistory.invalidate(),
      ]);
      toast.error(
        `Ajuste parcial: ${concluidas} de ${atualizacoes.length} seções salvas. Confira o histórico antes de continuar. ${error instanceof Error ? error.message : ""}`
      );
    } finally {
      setAplicando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            Calculadora de reajuste — {nomeTabela}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-4 rounded-lg border bg-slate-50 p-4 md:grid-cols-[1fr_1fr_1.2fr] md:items-end">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Variação da margem (pontos percentuais)
              <Input
                type="number"
                step="0.1"
                min="-50"
                max="50"
                value={deltaPp}
                onChange={event => setDeltaPp(Number(event.target.value))}
              />
              <span className="block text-xs font-normal text-slate-500">
                Positivo aumenta a margem; negativo reduz. A simulação e a
                gravação usam essa mesma variação.
              </span>
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Escopo de páginas
              <select
                value={pagina}
                onChange={event => setPagina(event.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="todas">Todas as páginas de preço</option>
                <option value="1">Página 1</option>
                <option value="2">Página 2</option>
                <option value="3">Página 3</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Mês de vendas da Curva ABC
              <div className="flex gap-2">
                <Input
                  type="month"
                  value={mesAno}
                  onChange={event => setMesAno(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={atualizarDadosAbc}
                  disabled={abcBuscando}
                  title="Atualizar dados do MubiSys"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${abcBuscando ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
              {abc?.updatedAt && (
                <span className="block text-xs font-normal text-slate-500">
                  Dados atualizados em{" "}
                  {new Date(abc.updatedAt).toLocaleString("pt-BR")}
                  {abc.fromCache ? " (cache)" : ""}
                </span>
              )}
            </label>
          </div>

          {abc?.stale && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Atualização MubiSys indisponível. Exibindo Curva ABC salva em {new Date(abc.updatedAt).toLocaleString("pt-BR")} sem descartar dados. {abc.syncError}
            </div>
          )}
          {invalida && (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
              Este reajuste levaria uma ou mais margens para fora do intervalo
              seguro (0% a 95%). Reduza o ajuste para continuar.
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="gap-2 py-4">
              <CardHeader className="px-4 pb-0">
                <CardTitle className="text-xs text-slate-500">
                  Células de margem
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-xl font-bold">
                {celulasValidas}
              </CardContent>
            </Card>
            <Card className="gap-2 py-4">
              <CardHeader className="px-4 pb-0">
                <CardTitle className="text-xs text-slate-500">
                  Margem média
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-xl font-bold">
                {fmtNum(mediaAtual, 1)}%{" "}
                <span className="text-sm font-normal text-slate-500">
                  → {fmtNum(mediaNova, 1)}%
                </span>
              </CardContent>
            </Card>
            <Card className="gap-2 py-4">
              <CardHeader className="px-4 pb-0">
                <CardTitle className="text-xs text-slate-500">
                  ABC associado
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-xl font-bold">
                {impactosMapeados.length}{" "}
                <span className="text-sm font-normal text-slate-500">
                  de {itensAbc.length} itens
                </span>
              </CardContent>
            </Card>
            <Card className="gap-2 py-4">
              <CardHeader className="px-4 pb-0">
                <CardTitle className="text-xs text-slate-500">
                  Impacto mensal estimado
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-lg font-bold">
                {fmtBrl(impactoBaixo)} – {fmtBrl(impactoAlto)}
              </CardContent>
            </Card>
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            Estimativa de preço base com custo e volume constantes: o CPQ
            calcula preço como custo direto ÷ (1 − margem). A faixa em reais
            aplica as novas margens mínima e máxima da linha ao faturamento
            observado. A ABC é mensal e mostra até 50 produtos;{" "}
            {fmtNum(coberturaAbc, 1)}% do faturamento do mês está associado a
            uma regra nesta simulação. Correspondências automáticas usam nome
            normalizado exato. Vínculos manuais abaixo valem apenas para esta
            simulação.
          </div>

          {abcCarregando || produtosCarregando ? (
            <div className="h-28 animate-pulse rounded bg-slate-100" />
          ) : abcErro ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              A ABC não carregou: {abcErro.message}. A projeção da tabela segue
              disponível, mas sem ponderação por vendas.
            </div>
          ) : !abc?.items.length ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500">
              Sem itens ABC para o mês selecionado. Atualize os dados do MubiSys
              ou escolha outro mês.
            </div>
          ) : (
            <Card className="gap-0 py-0">
              <CardHeader className="border-b px-4 py-3">
                <CardTitle className="text-base">
                  Impacto ponderado pela Curva ABC
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Faturamento ABC do mês: {fmtBrl(abc?.faturamento ?? 0)} ·
                  cobertura exata do vínculo: {fmtBrl(faturamentoMapeado)}
                </p>
              </CardHeader>
              <div className="max-h-[360px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Classe</TableHead>
                      <TableHead>Produto vendido</TableHead>
                      <TableHead>Regra da tabela</TableHead>
                      <TableHead className="text-right">
                        Faturamento do mês
                      </TableHead>
                      <TableHead className="text-right">
                        Variação estimada
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {impactos.map(({ item, linha, baixa, alta }) => (
                      <TableRow key={item.nome}>
                        <TableCell>
                          <Badge
                            variant={
                              item.classe === "A" ? "default" : "outline"
                            }
                            className={
                              item.classe === "A"
                                ? "bg-emerald-600"
                                : item.classe === "B"
                                  ? "border-amber-400 text-amber-700"
                                  : "text-slate-500"
                            }
                          >
                            {item.classe}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="max-w-[220px] truncate"
                          title={item.nome}
                        >
                          {item.nome}
                        </TableCell>
                        <TableCell className="min-w-[260px]">
                          <select
                            value={
                              linha
                                ? String(linha.id)
                                : (vinculosManuais[item.nome] ?? "")
                            }
                            onChange={event =>
                              setVinculosManuais(current => ({
                                ...current,
                                [item.nome]: event.target.value,
                              }))
                            }
                            className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs"
                          >
                            <option value="">Sem vínculo</option>
                            {linhas.map(opcao => (
                              <option key={opcao.id} value={opcao.id}>
                                #{opcao.id} · {opcao.secao} · {opcao.linha}
                              </option>
                            ))}
                          </select>
                          {!vinculosManuais[item.nome] && linha && (
                            <span className="text-[10px] text-emerald-700">
                              Correspondência automática exata
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtBrl(item.total)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {baixa === null || alta === null
                            ? "—"
                            : `${fmtBrl(baixa)} a ${fmtBrl(alta)}`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="text-base">Histórico de alterações × vendas reais e Curva ABC</CardTitle>
              <p className="text-xs text-slate-500">Versões registradas da tabela selecionada, cruzadas com o faturamento MubiSys do mês escolhido.</p>
            </CardHeader>
            {historicoCarregando ? (
              <div className="m-4 h-20 animate-pulse rounded bg-slate-100" />
            ) : historicoErro ? (
              <p className="p-4 text-sm text-amber-800">Não foi possível carregar o cruzamento histórico: {historicoErro.message}</p>
            ) : !impactoHistorico?.itens.length ? (
              <p className="p-4 text-sm text-slate-500">Sem alterações de margem e vendas vinculáveis neste período. O histórico antigo sem snapshots completos não permite reconstruir diferenças.</p>
            ) : (
              <>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Versão / data</TableHead><TableHead>Seção / item</TableHead><TableHead>ABC</TableHead>
                      <TableHead className="text-right">Ajuste</TableHead><TableHead className="text-right">Faturamento do mês</TableHead>
                      <TableHead className="text-right">Impacto estimado</TableHead><TableHead>Vínculo</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{impactoHistorico.itens.map((item, index) => (
                      <TableRow key={`${item.versao}-${item.item}-${index}`}>
                        <TableCell><Badge variant="outline">v{item.versao}</Badge><div className="text-xs text-slate-500">{new Date(item.data).toLocaleDateString("pt-BR")}</div></TableCell>
                        <TableCell className="min-w-[220px]"><div className="font-medium">{item.item}</div><div className="text-xs text-slate-500">{item.secao}</div></TableCell>
                        <TableCell>{item.classe === "—" ? "—" : <Badge variant={item.classe === "A" ? "default" : "outline"} className={item.classe === "A" ? "bg-emerald-600" : item.classe === "B" ? "border-amber-400 text-amber-700" : "text-slate-500"}>{item.classe}</Badge>}</TableCell>
                        <TableCell className="text-right">{item.deltaPp > 0 ? "+" : ""}{fmtNum(item.deltaPp, 2)} p.p.</TableCell>
                        <TableCell className="text-right">{fmtBrl(item.faturamento)}</TableCell>
                        <TableCell className="text-right">{fmtBrl(item.impactoMin)} a {fmtBrl(item.impactoMax)}</TableCell>
                        <TableCell><Badge variant={item.correspondencia === "sem venda compatível" ? "outline" : "secondary"}>{item.correspondencia}</Badge></TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
                <p className="border-t p-3 text-xs text-slate-500">{impactoHistorico.observacao} As versões antigas recuperadas pelo painel anterior podem guardar apenas “conteúdo da seção atualizado”; nesse caso, não há snapshot para reconstruir o antes/depois.</p>
              </>
            )}
          </Card>
          <details className="rounded-lg border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
              Prévia das {linhasSimuladas.length} linhas de preço que serão
              alteradas
            </summary>
            <div className="max-h-[300px] overflow-auto border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seção</TableHead>
                    <TableHead>Linha</TableHead>
                    <TableHead>Faixas</TableHead>
                    <TableHead className="text-right">
                      Efeito no preço base*
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhasSimuladas.map(linha => {
                    const validos = linha.margensValidas;
                    const efeitos = linha.variacaoPrecoPct;
                    return (
                      <TableRow key={`${linha.secaoId}-${linha.id}`}>
                        <TableCell
                          className="max-w-[260px] truncate"
                          title={linha.secao}
                        >
                          {linha.secao}
                        </TableCell>
                        <TableCell>{linha.linha}</TableCell>
                        <TableCell className="text-xs">
                          {validos.length} ·{" "}
                          {validos.length
                            ? `${fmtNum(Math.min(...validos), 1)}% → ${fmtNum(Math.min(...validos) + deltaPp, 1)}% até ${fmtNum(Math.max(...validos), 1)}% → ${fmtNum(Math.max(...validos) + deltaPp, 1)}%`
                            : "sem margens"}
                        </TableCell>
                        <TableCell className="text-right">
                          {efeitos.length
                            ? `${fmtNum(Math.min(...efeitos), 2)}% a ${fmtNum(Math.max(...efeitos), 2)}%`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="max-w-3xl text-xs text-slate-500">
              Ao aplicar, cada seção gera seu registro no histórico existente da
              tabela. Vínculos de ABC usados nesta simulação não são gravados.
            </p>
            <Button
              onClick={aplicarAjuste}
              disabled={!deltaPp || !linhas.length || invalida || aplicando}
              className="gap-2"
            >
              {aplicando ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {aplicando
                ? "Aplicando às seções..."
                : `Aplicar ${deltaPp > 0 ? "+" : ""}${fmtNum(deltaPp, 1)} p.p. em ${linhas.length} linhas`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
