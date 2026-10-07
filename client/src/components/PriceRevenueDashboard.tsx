import { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Info,
  TrendingUp,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fmtBrl, fmtPct } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const mesAtual = new Date().getMonth() + 1;
const anoAtual = new Date().getFullYear();
const nomeMes = (mes: number) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
    new Date(2024, mes - 1, 1)
  );
const dinheiro = (v: number | null | undefined) =>
  v == null ? "—" : fmtBrl(v);

export default function PriceRevenueDashboard() {
  const [mes, setMes] = useState(mesAtual);
  const [ano, setAno] = useState(anoAtual);
  const [tabela, setTabela] = useState("todas");
  const [sectionId, setSectionId] = useState("");
  const [faixaFiltro, setFaixaFiltro] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [modeloId, setModeloId] = useState("");
  const input = {
    mes,
    ano,
    ...(tabela !== "todas"
      ? { tabela: tabela as "principal" | "novo_cliente" }
      : {}),
    ...(sectionId ? { sectionId: Number(sectionId) } : {}),
    ...(produtoId ? { produtoId: Number(produtoId) } : {}),
    ...(modeloId ? { modeloId: Number(modeloId) } : {}),
  };
  const { data, isLoading, error } = trpc.price.getRevenueAnalysis.useQuery(
    input,
    { staleTime: 60_000 }
  );
  const rows = data?.rows ?? [];
  const blocos = useMemo(
    () => [
      ...new Map(
        rows.map(r => [
          r.sectionId,
          { id: r.sectionId, name: r.bloco, table: r.tabela },
        ])
      ).values(),
    ],
    [rows]
  );
  const produtos = useMemo(
    () => [
      ...new Map(
        rows
          .filter(r => r.productId != null)
          .map(r => [r.productId, { id: r.productId, name: r.produto }])
      ).values(),
    ],
    [rows]
  );
  const modelos = useMemo(
    () => [
      ...new Map(
        rows
          .filter(r => r.modelId != null)
          .map(r => [r.modelId, { id: r.modelId, name: r.modelo }])
      ).values(),
    ],
    [rows]
  );
  const exibidas = useMemo(
    () =>
      rows.filter(
        (row, index, all) =>
          all.findIndex(
            x =>
              x.productId === row.productId &&
              x.modelId === row.modelId &&
              x.sectionId === row.sectionId &&
              x.faixa === row.faixa &&
              x.linha === row.linha
          ) === index
      ),
    [rows]
  );
  const faixas = useMemo(() => [...new Set(rows.map(r => r.faixa))], [rows]);
  const linhasExibidas = exibidas.filter(
    r => !faixaFiltro || r.faixa === faixaFiltro
  );
  const abcMax = Math.max(1, ...(data?.abc ?? []).map(x => x.faturamento));

  return (
    <section className="space-y-4 rounded-xl border bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-violet-600" />
            Preços, vendas, ABC e meta
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Realizado vem das OS faturadas MubiSys. A previsão abaixo extrapola
            o ritmo diário observado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <label className="flex items-center gap-1">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <select
              className="h-9 rounded-md border bg-white px-2"
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>
                  {nomeMes(m)}
                </option>
              ))}
            </select>
          </label>
          <select
            aria-label="Ano"
            className="h-9 rounded-md border bg-white px-2"
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
          >
            {[anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1].map(a => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select
            aria-label="Tabela de preço"
            className="h-9 rounded-md border bg-white px-2"
            value={tabela}
            onChange={e => {
              setTabela(e.target.value);
              setFaixaFiltro("");
              setSectionId("");
            }}
          >
            <option value="todas">Ambas as tabelas</option>
            <option value="principal">Clientes Antigos</option>
            <option value="novo_cliente">Novo Cliente</option>
          </select>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Os indicadores de meta são mensais e da empresa; os filtros detalham
        produtos e faixas afiliados. Não há metas cadastradas por produto/faixa.
        A contribuição é comparada com a meta geral.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Meta de faturamento", dinheiro(data?.meta)],
          ["Realizado", dinheiro(data?.realizado)],
          ["Previsto no ritmo atual", dinheiro(data?.previsto)],
          [
            "Diferença prevista × meta",
            data?.diferencaMeta == null
              ? "—"
              : `${dinheiro(data.diferencaMeta)} (${fmtPct(data.diferencaMetaPct ?? 0)})`,
          ],
          ["Ritmo diário necessário", dinheiro(data?.ritmoDiarioNecessario)],
        ].map(([label, value]) => (
          <Card key={label} className="gap-2 py-3">
            <CardHeader className="px-3 pb-0">
              <CardTitle className="text-[11px] font-medium text-slate-500">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 text-lg font-semibold">
              {isLoading ? "…" : value}
            </CardContent>
          </Card>
        ))}
      </div>
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Não foi possível carregar os dados: {error.message}
        </div>
      )}
      {data && (
        <>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card className="gap-3 py-4">
              <CardHeader className="px-4 pb-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  Faturamento afiliado por Curva ABC
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4">
                {data.abc.map(x => (
                  <div
                    key={x.classe}
                    className="grid grid-cols-[35px_1fr_110px] items-center gap-2 text-xs"
                  >
                    <strong>Classe {x.classe}</strong>
                    <div className="h-2 overflow-hidden rounded bg-slate-100">
                      <div
                        className="h-full rounded bg-violet-500"
                        style={{
                          width: `${Math.min(100, (x.faturamento / abcMax) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-right tabular-nums">
                      {fmtBrl(x.faturamento)}
                    </span>
                  </div>
                ))}
                <p className="text-[11px] text-slate-500">
                  Cobertura de afiliação por ID:{" "}
                  {fmtPct(data.coberturaAfiliaçãoPct)}.
                </p>
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="px-4 pb-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Info className="h-4 w-4" />
                  Dados e premissas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 px-4 text-xs text-slate-600">
                <p>
                  Fontes: vendas e Curva ABC MubiSys; metas comerciais, com
                  fallback à meta operacional; blocos, faixas e afiliações
                  cadastradas; snapshots CPQ vinculados à OS, produto e modelo.
                </p>
                {!data.meta && (
                  <p className="text-amber-700">
                    Meta de faturamento não cadastrada para este mês.
                  </p>
                )}{" "}
                <p>
                  Ritmo atual: {dinheiro(data.ritmoDiarioAtual)}/dia; faltam{" "}
                  {data.periodo.diasRestantes} dia(s) no período.
                </p>
                <p>
                  Receita sem afiliação explícita:{" "}
                  {fmtBrl(data.receitaSemAfiliação)}. Ambígua:{" "}
                  {fmtBrl(data.receitaComAtribuiçãoAmbígua)}.
                </p>
                <p>
                  Versão atual da tabela: {data.versaoAtual ?? "não encontrada"}
                  . Sincronização MubiSys:{" "}
                  {data.sincronizadoEm
                    ? new Date(data.sincronizadoEm).toLocaleString("pt-BR")
                    : "sem registro"}
                  {data.dadosDesatualizados ? " (cache antigo)" : ""}.
                </p>
                {data.erroSync && (
                  <p className="text-amber-700">{data.erroSync}</p>
                )}
                {data.limitacoes.map((text, i) => (
                  <p key={i}>• {text}</p>
                ))}
              </CardContent>
            </Card>
          </div>
          <Card className="gap-3 py-4">
            <CardHeader className="px-4 pb-0">
              <CardTitle className="text-sm">
                Resultado por categoria afiliada
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 px-4 sm:grid-cols-2 xl:grid-cols-4">
              {data.categorias.map(c => (
                <div
                  key={c.categoria}
                  className="rounded-md bg-slate-50 p-3 text-xs"
                >
                  <strong>{c.categoria}</strong>
                  <p className="mt-1">Realizado: {fmtBrl(c.faturamento)}</p>
                  <p className="text-slate-500">
                    Previsto: {dinheiro(c.previsto)}
                  </p>
                </div>
              ))}
              {!data.categorias.length && (
                <p className="text-xs text-slate-500">
                  Sem afiliações com categoria e venda identificada.
                </p>
              )}
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Bloco ou faixa"
              className="h-9 rounded-md border bg-white px-2 text-sm"
              value={sectionId}
              onChange={e => {
                setSectionId(e.target.value);
                setFaixaFiltro("");
                setProdutoId("");
                setModeloId("");
              }}
            >
              <option value="">Todos os blocos/faixas</option>
              {blocos.map(b => (
                <option key={b.id} value={b.id}>
                  {b.table} · {b.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Faixa de preço"
              className="h-9 rounded-md border bg-white px-2 text-sm"
              value={faixaFiltro}
              onChange={e => setFaixaFiltro(e.target.value)}
            >
              <option value="">Todas as faixas</option>
              {faixas.map(faixa => (
                <option key={faixa} value={faixa}>
                  {faixa}
                </option>
              ))}
            </select>{" "}
            <select
              aria-label="Produto afiliado"
              className="h-9 max-w-64 rounded-md border bg-white px-2 text-sm"
              value={produtoId}
              onChange={e => {
                setProdutoId(e.target.value);
                setModeloId("");
              }}
            >
              <option value="">Todos os produtos afiliados</option>
              {produtos.map(p => (
                <option key={p.id} value={p.id ?? ""}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Modelo afiliado"
              className="h-9 max-w-64 rounded-md border bg-white px-2 text-sm"
              value={modeloId}
              onChange={e => setModeloId(e.target.value)}
            >
              <option value="">Todos os modelos</option>
              {modelos.map(m => (
                <option key={m.id} value={m.id ?? ""}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          {isLoading ? (
            <div className="h-24 animate-pulse rounded bg-slate-100" />
          ) : linhasExibidas.length ? (
            <div className="overflow-x-auto rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto / modelo</TableHead>
                    <TableHead>ABC</TableHead>
                    <TableHead>Tabela · versão</TableHead>
                    <TableHead>Bloco · faixa</TableHead>
                    <TableHead className="text-right">Margem atual</TableHead>
                    <TableHead className="text-right">
                      Preço observado
                    </TableHead>
                    <TableHead className="text-right">Faturado</TableHead>
                    <TableHead className="text-right">Previsto</TableHead>
                    <TableHead className="text-right">Contrib. meta</TableHead>
                    <TableHead>Vínculo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhasExibidas.map((r, i) => (
                    <TableRow
                      key={`${r.sectionId}-${r.productId}-${r.modelId}-${r.faixa}-${i}`}
                    >
                      <TableCell className="min-w-48 font-medium">
                        {r.produto}
                        <span className="block text-xs text-slate-500">
                          {r.modelo}
                          {r.linha ? ` · ${r.linha}` : ""}
                        </span>
                      </TableCell>
                      <TableCell>{r.classeAbc ?? "sem classe"}</TableCell>
                      <TableCell>
                        {r.tabela}
                        <span className="block text-xs text-slate-500">
                          Atual v{r.versaoTabela ?? "—"}
                          {r.versoesCotacoes
                            ? ` · cotação v${r.versoesCotacoes}`
                            : ""}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-40">
                        {r.bloco}
                        <span className="block text-xs text-slate-500">
                          {r.faixa}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.margemAtualPct == null
                          ? "—"
                          : fmtPct(r.margemAtualPct)}
                        {r.margemCotadaPct != null && (
                          <span className="block text-xs text-slate-500">
                            cotada {fmtPct(r.margemCotadaPct)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {dinheiro(r.precoCotado)}
                        {r.amostrasCotacao > 0 && (
                          <span className="block text-xs text-slate-500">
                            {r.amostrasCotacao} snapshot(s)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {dinheiro(r.faturamentoRealizado)}
                      </TableCell>
                      <TableCell className="text-right">
                        {dinheiro(r.faturamentoPrevisto)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.contribuicaoMetaPct == null
                          ? "—"
                          : fmtPct(r.contribuicaoMetaPct)}
                      </TableCell>
                      <TableCell className="min-w-40 text-xs">
                        {r.situacao}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-white p-6 text-center text-sm text-slate-500">
              <AlertCircle className="mx-auto mb-2 h-5 w-5" />
              Sem dados para os filtros selecionados. Confira as afiliações, o
              catálogo e as vendas do período.
            </div>
          )}
          <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>Cenários de preço indisponíveis:</strong> a base não
              contém conversão/elasticidade por faixa nem preço atual universal
              e vendido não está identificado com a faixa aplicada. O painel não
              simula receita ou margem com volume presumido. Qualquer relação
              exibida é descritiva e não prova que preço causou mudança nas
              vendas.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
