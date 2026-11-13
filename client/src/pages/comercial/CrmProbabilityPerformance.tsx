import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { fmtDate, fmtNum, fmtPct } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PERIODOS = [
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
  { value: "180", label: "6 meses" },
  { value: "365", label: "12 meses" },
] as const;

type SegmentRow = {
  segmento: string;
  quantidade: number;
  resolvidas: number;
  ganhos: number;
  perdas: number;
  conversaoEsperadaPct: number | null;
  conversaoRealPct: number | null;
  diferencaConversaoPct: number | null;
  brier: number | null;
  erroCalibracaoPct: number | null;
};

function formatIndice(value: number | null | undefined, casas = 3) {
  return value == null ? "—" : fmtNum(value, casas);
}

function variacaoPp(value: number | null) {
  if (value == null) return "—";
  const prefixo = value > 0 ? "+" : "";
  return `${prefixo}${fmtNum(value, 1)} p.p.`;
}

function MetricCard({
  title,
  value,
  detail,
  tone = "blue",
}: {
  title: string;
  value: string;
  detail: string;
  tone?: "blue" | "green" | "amber" | "violet" | "rose";
}) {
  const tones = {
    blue: "border-blue-200 bg-blue-50/70 text-blue-800",
    green: "border-emerald-200 bg-emerald-50/70 text-emerald-800",
    amber: "border-amber-200 bg-amber-50/70 text-amber-800",
    violet: "border-violet-200 bg-violet-50/70 text-violet-800",
    rose: "border-rose-200 bg-rose-50/70 text-rose-800",
  };
  return (
    <Card className={`border shadow-sm ${tones[tone]}`}>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-75">
          {title}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        <p className="mt-1 text-xs opacity-80">{detail}</p>
      </CardContent>
    </Card>
  );
}

function SegmentTable({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: SegmentRow[];
}) {
  return (
    <Card className="min-w-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="pt-0">
        {!rows.length ? (
          <p className="py-5 text-center text-sm text-muted-foreground">
            Sem previsões nesse recorte.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {title === "Por vendedor"
                    ? "Vendedor"
                    : title === "Por modelo"
                      ? "Versão"
                      : title.startsWith("Por região")
                        ? "Região"
                        : "Faixa"}
                </TableHead>
                <TableHead className="text-right">Previsões</TableHead>
                <TableHead className="text-right">Decididas</TableHead>
                <TableHead className="text-right">Prevista</TableHead>
                <TableHead className="text-right">Real</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-right">Brier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.segmento}>
                  <TableCell
                    className="max-w-44 truncate font-medium"
                    title={row.segmento}
                  >
                    {row.segmento}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNum(row.quantidade)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNum(row.resolvidas)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtPct(row.conversaoEsperadaPct)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtPct(row.conversaoRealPct)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${(row.diferencaConversaoPct ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                  >
                    {variacaoPp(row.diferencaConversaoPct)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatIndice(row.brier)}
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

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "melhorando")
    return <TrendingUp className="size-4 text-emerald-600" />;
  if (trend === "piorando")
    return <TrendingDown className="size-4 text-rose-600" />;
  if (trend === "mantido")
    return <CheckCircle2 className="size-4 text-blue-600" />;
  return <Activity className="size-4 text-amber-600" />;
}

export function CrmProbabilityPerformance({ active }: { active: boolean }) {
  const [dias, setDias] = useState<(typeof PERIODOS)[number]["value"]>("90");
  const { data, isLoading, isError, refetch, isFetching } =
    trpc.crm.getDesempenhoProbabilidade.useQuery(
      { dias },
      { enabled: active, refetchOnWindowFocus: false, retry: 1 }
    );
  const painel = data?.painel;

  if (!active) return null;
  if (isLoading)
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground">
        <Spinner className="size-5" />
        Calculando desempenho...
      </div>
    );
  if (isError || !data || !painel)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangle className="text-amber-600" />
          </EmptyMedia>
          <EmptyTitle>Não foi possível carregar o painel</EmptyTitle>
          <EmptyDescription>
            Confira a sincronização do histórico e tente novamente.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={() => void refetch()}>
          <RefreshCw className="mr-2 size-4" />
          Tentar novamente
        </Button>
      </Empty>
    );

  const atual = painel.atual;
  const benchmark = data.benchmarkHistorico;
  const benchmarkJanela =
    benchmark.janelas.find(item => item.dias === Number(dias)) ??
    benchmark.janelas.find(item => item.dias === 90)!;
  const performanceRows = [
    [
      "Brier",
      atual.brier,
      atual.brierBase,
      "Menor é melhor; mede erro quadrático da probabilidade.",
    ],
    [
      "Log-loss",
      atual.logLoss,
      null,
      "Menor é melhor; penaliza previsões confiantes e erradas.",
    ],
    [
      "AUC",
      atual.auc,
      null,
      "Maior é melhor; mede se propostas ganhas ficam acima das perdidas.",
    ],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <BarChart3 className="size-5 text-blue-700" />
            Desempenho das probabilidades
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Previsões feitas no CRM comparadas aos resultados explícitos
            sincronizados do MubiSys.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={dias}
            onValueChange={value => setDias(value as typeof dias)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map(periodo => (
                <SelectItem key={periodo.value} value={periodo.value}>
                  {periodo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            aria-label="Atualizar painel"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw
              className={`size-4 ${isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-950">
        <p className="font-semibold">Acompanhamento prospectivo das probabilidades</p>
        <p className="mt-1">
          O CRM registra a primeira probabilidade entregue para cada proposta.
          Depois que a tabela estiver ativa, recarregue o CRM para iniciar a
          coleta. Os índices usam esses registros e ganhos/perdas explícitos.
          Propostas abertas ou ainda não sincronizadas ficam pendentes; o
          benchmark histórico separado abaixo não é misturado com esta medição.
        </p>
      </div>
      {!data.trackingDisponivel && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">
            A tabela de acompanhamento ainda não está disponível no banco.
          </p>
          <p className="mt-1">
            O painel está no ar, mas a migration{" "}
            <code>crm_probabilidade_previsoes</code> precisa ser aplicada ao
            banco de produção para começar a registrar previsões.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Conversão prevista"
          value={fmtPct(atual.conversaoEsperadaPct)}
          detail={`${fmtNum(atual.vitoriasEsperadas, 1)} ganhos esperados entre ${fmtNum(atual.resolvidas)} decisões`}
          tone="blue"
        />
        <MetricCard
          title="Conversão real"
          value={fmtPct(atual.conversaoRealPct)}
          detail={`${fmtNum(atual.ganhos)} ganhos de ${fmtNum(atual.resolvidas)} propostas decididas`}
          tone="green"
        />
        <MetricCard
          title="Real − prevista"
          value={variacaoPp(atual.diferencaConversaoPct)}
          detail="Diferença em pontos percentuais; positivo indica resultado acima da previsão."
          tone={(atual.diferencaConversaoPct ?? 0) >= 0 ? "green" : "rose"}
        />
        <MetricCard
          title="Amostra acompanhada"
          value={fmtNum(atual.previsoes)}
          detail={`${fmtNum(atual.resolvidas)} decididas · ${fmtNum(atual.pendentes)} pendentes · ${fmtNum(atual.aindaNaoSincronizadas)} ainda fora do histórico`}
          tone="violet"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Brier score"
          value={formatIndice(atual.brier)}
          detail={`Referência constante nesta amostra: ${formatIndice(atual.brierBase)} · skill ${fmtPct(atual.brierSkillPct)}`}
          tone="amber"
        />
        <MetricCard
          title="Log-loss"
          value={formatIndice(atual.logLoss)}
          detail="Penaliza previsões muito confiantes quando o resultado vem ao contrário."
          tone="blue"
        />
        <MetricCard
          title="AUC"
          value={formatIndice(atual.auc)}
          detail="0,50 equivale a ordenar ao acaso; 1,00 separa perfeitamente os resultados."
          tone="violet"
        />
        <MetricCard
          title="Erro de calibração"
          value={fmtPct(atual.erroCalibracaoPct)}
          detail="Distância média entre o percentual previsto e o observado por faixa."
          tone="rose"
        />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução dos índices</CardTitle>
          <p className="text-xs text-muted-foreground">
            Compara os últimos {fmtNum(Number(dias))} dias com os{" "}
            {fmtNum(Number(dias))} dias anteriores. Só classifica tendência com
            pelo menos 30 propostas decididas em cada período.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {painel.tendencias.map(item => (
              <div key={item.indice} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <TrendIcon trend={item.tendencia} />
                  <p className="text-sm font-semibold">{item.indice}</p>
                </div>
                <Badge variant="outline" className="mt-2">
                  {item.tendencia === "amostra_insuficiente"
                    ? "Amostra insuficiente"
                    : item.tendencia === "mantido"
                      ? "Mantido"
                      : item.tendencia === "melhorando"
                        ? "Melhorando"
                        : "Piorando"}
                </Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  Atual:{" "}
                  {item.atual == null
                    ? "—"
                    : item.indice === "Erro da conversão esperada"
                      ? variacaoPp(item.atual)
                      : item.indice === "Erro de calibração"
                        ? fmtPct(item.atual)
                        : formatIndice(item.atual)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Anterior:{" "}
                  {item.anterior == null
                    ? "—"
                    : item.indice === "Erro da conversão esperada"
                      ? variacaoPp(item.anterior)
                      : item.indice === "Erro de calibração"
                        ? fmtPct(item.anterior)
                        : formatIndice(item.anterior)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">
              Conversão ao longo do período
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Taxa prevista média e conversão real por mês de exibição da
              previsão.
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            {painel.porMes.length ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={painel.porMes}
                    margin={{ top: 12, right: 10, bottom: 0, left: -18 }}
                  >
                    <defs>
                      <linearGradient
                        id="crm-prevista"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#2563eb"
                          stopOpacity={0.24}
                        />
                        <stop
                          offset="95%"
                          stopColor="#2563eb"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient id="crm-real" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#16a34a"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor="#16a34a"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={value => `${value}%`}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        `${fmtNum(Number(value), 1)}%`,
                        name === "conversaoEsperadaPct" ? "Prevista" : "Real",
                      ]}
                    />
                    <Legend
                      formatter={value =>
                        value === "conversaoEsperadaPct" ? "Prevista" : "Real"
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="conversaoEsperadaPct"
                      name="conversaoEsperadaPct"
                      connectNulls
                      stroke="#2563eb"
                      fill="url(#crm-prevista)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="conversaoRealPct"
                      name="conversaoRealPct"
                      connectNulls
                      stroke="#16a34a"
                      fill="url(#crm-real)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Os meses aparecerão conforme as previsões forem acompanhadas até
                um resultado.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Resumo do período atual × anterior
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Base de propostas com desfecho explícito; os demais status
              permanecem fora dos índices.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicador</TableHead>
                  <TableHead className="text-right">Atual</TableHead>
                  <TableHead className="text-right">Anterior</TableHead>
                  <TableHead className="text-right">Variação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">
                    Propostas decididas
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtNum(atual.resolvidas)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtNum(painel.anterior.resolvidas)}
                  </TableCell>
                  <TableCell className="text-right">—</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Ganhos / perdas</TableCell>
                  <TableCell className="text-right">
                    {fmtNum(atual.ganhos)} / {fmtNum(atual.perdas)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtNum(painel.anterior.ganhos)} /{" "}
                    {fmtNum(painel.anterior.perdas)}
                  </TableCell>
                  <TableCell className="text-right">—</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">
                    Conversão prevista
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtPct(atual.conversaoEsperadaPct)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtPct(painel.anterior.conversaoEsperadaPct)}
                  </TableCell>
                  <TableCell className="text-right">
                    {variacaoPp(
                      atual.conversaoEsperadaPct != null &&
                        painel.anterior.conversaoEsperadaPct != null
                        ? atual.conversaoEsperadaPct -
                            painel.anterior.conversaoEsperadaPct
                        : null
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Conversão real</TableCell>
                  <TableCell className="text-right">
                    {fmtPct(atual.conversaoRealPct)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtPct(painel.anterior.conversaoRealPct)}
                  </TableCell>
                  <TableCell className="text-right">
                    {variacaoPp(
                      atual.conversaoRealPct != null &&
                        painel.anterior.conversaoRealPct != null
                        ? atual.conversaoRealPct -
                            painel.anterior.conversaoRealPct
                        : null
                    )}
                  </TableCell>
                </TableRow>
                {performanceRows.map(([label, current, constant, detail]) => {
                  const previous =
                    label === "Brier"
                      ? painel.anterior.brier
                      : label === "Log-loss"
                        ? painel.anterior.logLoss
                        : painel.anterior.auc;
                  return (
                    <TableRow key={label}>
                      <TableCell className="font-medium">
                        <span title={detail}>{label}</span>
                        {label === "Brier" && (
                          <span className="block text-[10px] font-normal text-muted-foreground">
                            Base constante: {formatIndice(constant)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatIndice(current)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatIndice(previous)}
                      </TableCell>
                      <TableCell className="text-right">
                        {current == null || previous == null
                          ? "—"
                          : formatIndice(current - previous)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SegmentTable
          title="Faixas de probabilidade"
          description="Verifica se as taxas reais acompanham os percentuais prometidos pelo modelo."
          rows={painel.faixasProbabilidade}
        />
        <SegmentTable
          title="Por modelo"
          description="A versão fica registrada no primeiro snapshot e permite comparar futuras versões implantadas."
          rows={painel.porVersao}
        />
        <SegmentTable
          title="Por vendedor"
          description="Comparação por carteira do vendedor; use o número de decididas para avaliar a robustez."
          rows={painel.porVendedor}
        />
        <SegmentTable
          title="Por ticket da proposta"
          description="Cada oportunidade é avaliada pelo valor do orçamento, além do histórico do cliente."
          rows={painel.porTicket}
        />
        <SegmentTable
          title="Por idade da empresa"
          description="Idade vinculada ao CNPJ na data da previsão; desconhecidos ficam separados."
          rows={painel.porIdadeEmpresa}
        />
        <SegmentTable
          title="Por coorte de cliente"
          description="Cohort da primeira compra válida anterior à proposta."
          rows={painel.porCoorte}
        />
        <SegmentTable
          title="Por recência RFM"
          description="Tempo desde a compra anterior; inclui explicitamente clientes sem compra anterior."
          rows={painel.porRecencia}
        />
        <SegmentTable
          title="Por região"
          description="Compara probabilidade prevista e conversão real por região informada na proposta ou inferida do histórico anterior."
          rows={painel.porRegiao}
        />
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conversão histórica por região</CardTitle>
            <p className="text-xs text-muted-foreground">
              Propostas do histórico usadas pelo treino; região conhecida vem
              de uma compra anterior à proposta. Sem esse dado, fica
              desconhecida.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Região</TableHead>
                  <TableHead className="text-right">No treino</TableHead>
                  <TableHead className="text-right">Ganhos</TableHead>
                  <TableHead className="text-right">Perdas</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.modelo?.conversaoHistoricaPorRegiao ?? []).map(row => (
                  <TableRow key={row.regiao}>
                    <TableCell>{row.regiao}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(row.propostasDecididas)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(row.ganhos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(row.perdas)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(row.conversaoPct)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">
              Quando não há status explícito, proposta aberta vencida entra
              como perda presumida no treino. A tabela prospectiva acima só
              conta ganhos e perdas sincronizados explicitamente.
            </p>
          </CardContent>
        </Card>
        <SegmentTable
          title="Por frequência de compra"
          description="Quantidade de compras válidas nos 12 meses anteriores à proposta."
          rows={painel.porFrequencia}
        />
        <SegmentTable
          title="Por valor RFM (12 meses)"
          description="Quartis do valor de compras anteriores à proposta, calculados dentro do período selecionado."
          rows={painel.porValorRfm}
        />
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Coleta e atualização do modelo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Versão de previsão</span>
              <Badge variant="secondary">
                {data.modelo?.versao ?? "indisponível"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Propostas no treino</span>
              <span className="font-semibold tabular-nums">
                {fmtNum(data.modelo?.propostasTreino)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                Última proposta no histórico
              </span>
              <span className="font-semibold">
                {fmtDate(data.modelo?.ultimaPropostaHistorico)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                Última proposta decidida no treino
              </span>
              <span className="font-semibold">
                {fmtDate(data.modelo?.ultimaPropostaTreino)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                Histórico sem desfecho para treino
              </span>
              <span className="font-semibold tabular-nums">
                {fmtNum(data.modelo?.propostasHistoricoSemDesfecho)}
              </span>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
              Idade CNPJ vinculada a{" "}
              {fmtNum(data.modelo?.coberturaIdade.clientesComIdade)} de{" "}
              {fmtNum(data.modelo?.coberturaIdade.clientesHistoricos)} clientes
              históricos;{" "}
              {fmtNum(data.modelo?.coberturaIdade.propostasComIdade)} propostas
              de treino tinham idade conhecida.
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Histórico de O.S. usado pelo modelo</CardTitle>
            <p className="text-xs text-muted-foreground">
              O espelho local é carregado por inteiro. Compras válidas seguem
              a regra comercial, que exclui retrabalho, amostra, cortesia,
              cancelada e tipo ausente.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Registros sincronizados</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {fmtNum(data.modelo?.coberturaHistoricoOs.registrosSincronizados)}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Compras válidas no histórico</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {fmtNum(data.modelo?.coberturaHistoricoOs.comprasValidas)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Período das compras: {fmtDate(data.modelo?.coberturaHistoricoOs.primeiraCompra)}
              a {fmtDate(data.modelo?.coberturaHistoricoOs.ultimaCompra)}. UF
              conhecida em {fmtNum(data.modelo?.coberturaHistoricoOs.comUf)}
              compras; sem UF em
              {" "}
              {fmtNum(data.modelo?.coberturaHistoricoOs.semUf)}.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Região da O.S.</TableHead>
                  <TableHead className="text-right">Compras válidas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.modelo?.coberturaHistoricoOs.porRegiao ?? []).map(row => (
                  <TableRow key={row.regiao}>
                    <TableCell>{row.regiao}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtNum(row.quantidade)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-300 bg-slate-50/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Benchmark retrospectivo antes do acompanhamento ao vivo
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Replay cronológico validado em {fmtDate(benchmark.validadoEm)} com{" "}
            {fmtNum(benchmark.amostraHistoricaDecidida)} propostas decididas.
            Este resultado histórico não foi exibido aos vendedores e não prova
            causalidade.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              {benchmark.metodo} A regressão logística calibrada foi comparada
              ao modelo bayesiano anterior. Árvores, floresta, boosting simples
              e Naive Bayes também foram avaliados no replay; XGBoost/LightGBM
              não fazem parte da versão implantada.
            </span>
          </div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Janela histórica comparável selecionada: {benchmarkJanela.dias} dias
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo no replay</TableHead>
                <TableHead className="text-right">Brier ↓</TableHead>
                <TableHead className="text-right">Log-loss ↓</TableHead>
                <TableHead className="text-right">AUC ↑</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-semibold">
                  Regressão logística calibrada
                </TableCell>
                <TableCell className="text-right">
                  {formatIndice(benchmarkJanela.atualBrier)}
                </TableCell>
                <TableCell className="text-right">
                  {formatIndice(benchmarkJanela.atualLogLoss)}
                </TableCell>
                <TableCell className="text-right">
                  {formatIndice(benchmarkJanela.atualAuc)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Modelo bayesiano anterior</TableCell>
                <TableCell className="text-right">
                  {formatIndice(benchmarkJanela.anteriorBrier)}
                </TableCell>
                <TableCell className="text-right">
                  {formatIndice(benchmarkJanela.anteriorLogLoss)}
                </TableCell>
                <TableCell className="text-right">
                  {formatIndice(benchmarkJanela.anteriorAuc)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-right text-xs text-muted-foreground">
        Painel atualizado em {fmtDate(data.painel.geradoEm)} · janela de
        acompanhamento:{" "}
        {PERIODOS.find(periodo => periodo.value === dias)?.label}
      </p>
    </div>
  );
}
