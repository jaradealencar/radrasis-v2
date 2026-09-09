import { useState, useRef, useEffect, useMemo, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  ResponsiveContainer, ComposedChart, BarChart, AreaChart, Bar, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  TrendingUp, DollarSign, PieChart as PieIcon, Receipt, AlertTriangle, Loader2, Radar,
  Sparkles, Send, Wallet, Gauge, ArrowRight, Users, ListChecks,
} from "lucide-react";
import KpiCard from "@/components/KpiCard";
import { STATUS_COLORS } from "@/lib/chartColors";
import ChartTooltip from "@/components/ChartTooltip";
import { fmtBrl, fmtBrlCompact, fmtPct, fmtNum, MESES_ABREV } from "@/lib/format";

const RETRY_1 = { retry: 1 } as const;

// Cores fixas por papel (não por índice de série) — mesma leitura em todos os
// gráficos desta aba: azul = vendido/contribuição, laranja = custo variável,
// cinza = custo fixo, verde = resultado líquido.
const COR_VENDIDO = "#3b82f6";
const COR_VARIAVEL = "#f59e0b";
const COR_FIXO = "#64748b";
const COR_RESULTADO = STATUS_COLORS.positivo;
const COR_CONTRIBUICAO = "#3b82f6";
const COR_TRIBUTOS = "#0ea5e9";
const COR_COMISSOES = "#eab308";
const COR_TERCEIRIZADOS = "#ec4899";
const COR_MAODEOBRA = "#8b5cf6";

function DeltaPill({ value, unit = "%" }: { value: number; unit?: string }) {
  const pos = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ml-1.5 align-middle ${
        pos ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"
      }`}
    >
      {pos ? "+" : ""}
      {value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
      {unit}
    </span>
  );
}

function CompareRow({
  label, value, delta, deltaUnit = "%", last,
}: { label: string; value: string; delta?: number | null; deltaUnit?: string; last?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline py-1.5 ${last ? "" : "border-b border-dashed border-slate-200"}`}>
      <span className="text-xs text-slate-500">{label}</span>
      <span className="font-mono text-sm font-semibold text-slate-800">
        {value}
        {delta != null && <DeltaPill value={delta} unit={deltaUnit} />}
      </span>
    </div>
  );
}

function StatBox({ label, value, delta }: { label: string; value: string; delta?: number | null }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">{label}</div>
      <div className="font-mono text-sm font-semibold text-slate-800">
        {value}
        {delta != null && <DeltaPill value={delta} />}
      </div>
    </div>
  );
}

interface MensagemAsk { role: "user" | "assistant"; texto: string }

function AskRadarCard() {
  const [mensagens, setMensagens] = useState<MensagemAsk[]>([]);
  const [pergunta, setPergunta] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  const perguntarMut = trpc.financeiro.perguntarIA.useMutation({
    onSuccess: (data) => setMensagens(m => [...m, { role: "assistant", texto: data.resposta }]),
    onError: (e) => toast.error("Erro ao consultar a IA: " + e.message),
  });

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, perguntarMut.isPending]);

  function enviar(e?: FormEvent) {
    e?.preventDefault();
    const texto = pergunta.trim();
    if (!texto || perguntarMut.isPending) return;
    const historico = mensagens;
    setMensagens(m => [...m, { role: "user", texto }]);
    setPergunta("");
    perguntarMut.mutate({ pergunta: texto, historico });
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Sparkles size={14} className="text-purple-500" />
          Pergunte sobre seus números
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Um chat com o Claude, com os dados financeiros — incluindo o Radar de Margens — como contexto.
          Ex.: "qual vendedor tem a pior margem?" ou "por que a margem melhorou este ano?"
        </p>
      </CardHeader>
      <CardContent>
        {mensagens.length > 0 && (
          <div ref={logRef} className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1 mb-3">
            {mensagens.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-800 rounded-bl-sm"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-xs max-w-none dark:prose-invert">
                      <Streamdown>{m.texto}</Streamdown>
                    </div>
                  ) : m.texto}
                </div>
              </div>
            ))}
            {perguntarMut.isPending && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Analisando...
                </div>
              </div>
            )}
          </div>
        )}
        <form onSubmit={enviar} className="flex gap-2">
          <Input
            value={pergunta}
            onChange={e => setPergunta(e.target.value)}
            placeholder="Pergunte algo sobre faturamento, margens, custos ou vendedores..."
            className="text-xs h-9"
            disabled={perguntarMut.isPending}
          />
          <Button type="submit" size="sm" className="h-9" disabled={perguntarMut.isPending || !pergunta.trim()}>
            <Send size={14} />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function RadarMargens({ anoSel }: { anoSel: number }) {
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = trpc.financeiro.getRadarMargens.useQuery(undefined, RETRY_1);

  const [modoHero, setModoHero] = useState<"abs" | "pct">("abs");

  // Último mês fechado do calendário real — evita comparar um mês corrente ainda
  // incompleto (poucos dias) contra o mesmo mês inteiro do ano anterior, o que
  // faria a recompra do ano corrente parecer artificialmente mais baixa (o
  // cliente ainda não teve tempo de voltar).
  const mesLimiteRetencao = useMemo(() => {
    const m = new Date().getMonth(); // 0 = jan; já é "mês anterior" 1-indexado
    return m === 0 ? 12 : m;
  }, []);
  const { data: retencaoData } = trpc.financeiro.getRetencaoClientes.useQuery(
    { mesLimite: mesLimiteRetencao },
    RETRY_1,
  );
  const retAnoAtual = retencaoData?.anos.find(a => a.ano === anoSel);
  const retAnoAnterior = retencaoData?.anos.find(a => a.ano === anoSel - 1);

  const meses = data?.meses ?? [];
  const vendedores = data?.vendedores ?? [];
  const statusPorAno = data?.statusPorAno ?? [];

  const anoAnterior = anoSel - 1;
  const mesesAno = useMemo(() => meses.filter(m => m.ano === anoSel), [meses, anoSel]);
  const mesesAnoAnterior = useMemo(() => meses.filter(m => m.ano === anoAnterior), [meses, anoAnterior]);

  // Compara só os meses que o ano corrente já tem, no mesmo recorte do ano anterior —
  // sem isso, um ano parcial (ex: até setembro) pareceria menor que o ano completo anterior.
  const qtdMesesComparar = mesesAno.length;
  const anoAnteriorComparavel = mesesAnoAnterior.slice(0, qtdMesesComparar);

  const somar = (arr: typeof meses, campo: "valorOs" | "resultado" | "contribuicao" | "fixo" | "variavel" | "maoDeObra") =>
    arr.reduce((acc, m) => acc + m[campo], 0);

  const totalAtual = {
    valorOs: somar(mesesAno, "valorOs"),
    resultado: somar(mesesAno, "resultado"),
    contribuicao: somar(mesesAno, "contribuicao"),
    count: mesesAno.reduce((a, m) => a + m.count, 0),
  };
  const totalAnterior = {
    valorOs: somar(anoAnteriorComparavel, "valorOs"),
    resultado: somar(anoAnteriorComparavel, "resultado"),
    contribuicao: somar(anoAnteriorComparavel, "contribuicao"),
    count: anoAnteriorComparavel.reduce((a, m) => a + m.count, 0),
  };
  const resultadoPctAtual = totalAtual.valorOs ? (totalAtual.resultado / totalAtual.valorOs) * 100 : 0;
  const contribPctAtual = totalAtual.valorOs ? (totalAtual.contribuicao / totalAtual.valorOs) * 100 : 0;
  const resultadoPctAnterior = totalAnterior.valorOs ? (totalAnterior.resultado / totalAnterior.valorOs) * 100 : 0;
  const contribPctAnterior = totalAnterior.valorOs ? (totalAnterior.contribuicao / totalAnterior.valorOs) * 100 : 0;
  const ticketMedioAtual = totalAtual.count ? totalAtual.valorOs / totalAtual.count : 0;
  const ticketMedioAnterior = totalAnterior.count ? totalAnterior.valorOs / totalAnterior.count : 0;
  const custosTotaisAtual = totalAtual.valorOs - totalAtual.resultado;

  const variacaoPedidos = totalAnterior.count ? ((totalAtual.count / totalAnterior.count) - 1) * 100 : null;
  const variacaoValor = totalAnterior.valorOs ? ((totalAtual.valorOs / totalAnterior.valorOs) - 1) * 100 : null;
  const variacaoTicket = ticketMedioAnterior ? ((ticketMedioAtual / ticketMedioAnterior) - 1) * 100 : null;
  const deltaResultadoPct = resultadoPctAtual - resultadoPctAnterior;
  const deltaContribPct = contribPctAtual - contribPctAnterior;

  const melhorMes = mesesAno.length ? mesesAno.reduce((a, b) => (b.resultadoPct > a.resultadoPct ? b : a)) : null;
  const piorMes = mesesAno.length ? mesesAno.reduce((a, b) => (b.resultadoPct < a.resultadoPct ? b : a)) : null;

  // Média ponderada pelo valor vendido — usada pra apontar o principal driver
  // da variação de margem (matéria-prima costuma ser o maior componente do custo variável).
  const wavg = (arr: typeof meses, campo: "materiaPrimaPct" | "fixoPorOS") => {
    const totalValor = arr.reduce((a, m) => a + m.valorOs, 0);
    if (!totalValor) return 0;
    return arr.reduce((a, m) => a + m[campo] * m.valorOs, 0) / totalValor;
  };
  const materiaPrimaPctAtual = wavg(mesesAno, "materiaPrimaPct");
  const materiaPrimaPctAnterior = wavg(anoAnteriorComparavel, "materiaPrimaPct");

  const fixoTotalAtual = somar(mesesAno, "fixo");
  const fixoTotalAnterior = somar(anoAnteriorComparavel, "fixo");
  const deltaFixoTotal = fixoTotalAnterior ? ((fixoTotalAtual / fixoTotalAnterior) - 1) * 100 : null;
  const maoDeObraTotalAtual = somar(mesesAno, "maoDeObra");
  const maoDeObraTotalAnterior = somar(anoAnteriorComparavel, "maoDeObra");
  const deltaMaoDeObraTotal = maoDeObraTotalAnterior ? ((maoDeObraTotalAtual / maoDeObraTotalAnterior) - 1) * 100 : null;

  const maxValorVendedor = vendedores.length ? Math.max(...vendedores.map(v => v.valorOs)) : 0;

  const statusAno = useMemo(() => statusPorAno.filter(s => s.ano === anoSel), [statusPorAno, anoSel]);
  const totalStatusAno = statusAno.reduce((a, s) => a + s.count, 0);
  const canceladasAno = statusAno.find(s => s.status.toLowerCase() === "cancelada")?.count ?? 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 size={28} className="animate-spin" />
        <p className="text-sm">Carregando histórico de O.S....</p>
      </div>
    );
  }

  if (isError) {
    return (
      <Empty className="py-20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangle />
          </EmptyMedia>
          <EmptyTitle>Não foi possível carregar o Radar de Margens.</EmptyTitle>
          <EmptyDescription>Falha ao consultar o servidor. Tente novamente.</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
      </Empty>
    );
  }

  if (meses.length === 0) {
    return (
      <Empty className="py-20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Radar />
          </EmptyMedia>
          <EmptyTitle>Sem histórico de O.S. sincronizado ainda.</EmptyTitle>
          <EmptyDescription>A tabela historico_os está vazia — verifique a sincronização com o MubiSys.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 flex items-start gap-2">
        <span className="text-sm leading-none">📌</span>
        <span>
          Cada O.S. entra no mês em que foi <b>vendida/aprovada</b> (não em que foi faturada) — o critério oficial
          já usado no cálculo do DRE. Exclui retrabalho, amostra, cortesia e canceladas.
        </span>
      </div>

      {melhorMes && piorMes && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-start gap-2">
          <span className="text-sm leading-none">📈</span>
          <span>
            Em {anoSel}, a margem líquida mensal variou entre <b>{fmtPct(piorMes.resultadoPct)}</b> ({piorMes.label}) e{" "}
            <b>{fmtPct(melhorMes.resultadoPct)}</b> ({melhorMes.label}), fechando o recorte em{" "}
            <b>{fmtPct(resultadoPctAtual)}</b> —{" "}
            {totalAnterior.valorOs > 0 ? (
              <>
                {deltaResultadoPct >= 0 ? `${fmtPct(deltaResultadoPct)} acima` : `${fmtPct(Math.abs(deltaResultadoPct))} abaixo`} do
                {" "}mesmo recorte de {anoAnterior} ({fmtPct(resultadoPctAnterior)}).
              </>
            ) : "sem recorte comparável no ano anterior."}
          </span>
        </div>
      )}

      <AskRadarCard />

      {/* KPIs do ano em foco (anoSel), comparados ao mesmo recorte do ano anterior */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label={`Vendido em ${anoSel}`}
          value={fmtBrlCompact(totalAtual.valorOs)}
          sub={variacaoValor != null ? `${variacaoValor >= 0 ? "+" : ""}${fmtPct(variacaoValor)} vs. ${anoAnterior}` : undefined}
          color={COR_VENDIDO}
          icon={DollarSign}
          variant="border"
        />
        <KpiCard
          label="Margem líquida"
          value={fmtPct(resultadoPctAtual)}
          sub={`${resultadoPctAnterior ? fmtPct(resultadoPctAnterior) : "—"} em ${anoAnterior}`}
          color={COR_RESULTADO}
          icon={TrendingUp}
          variant="border"
        />
        <KpiCard
          label="Margem de contribuição"
          value={fmtPct(contribPctAtual)}
          sub={`${contribPctAnterior ? fmtPct(contribPctAnterior) : "—"} em ${anoAnterior}`}
          color={COR_CONTRIBUICAO}
          icon={PieIcon}
          variant="border"
        />
        <KpiCard
          label="Custos totais"
          value={fmtBrlCompact(custosTotaisAtual)}
          sub={`${fmtPct(100 - resultadoPctAtual)} do valor vendido`}
          color={COR_FIXO}
          icon={Wallet}
          variant="border"
        />
        <KpiCard
          label="Ticket médio"
          value={fmtBrl(ticketMedioAtual)}
          sub={variacaoPedidos != null ? `${fmtNum(totalAtual.count)} O.S. (${variacaoPedidos >= 0 ? "+" : ""}${fmtPct(variacaoPedidos)})` : `${fmtNum(totalAtual.count)} O.S.`}
          color={COR_VARIAVEL}
          icon={Receipt}
          variant="border"
        />
        <KpiCard
          label="Amplitude de margem"
          value={melhorMes && piorMes ? `${fmtPct(piorMes.resultadoPct)} – ${fmtPct(melhorMes.resultadoPct)}` : "—"}
          sub={melhorMes && piorMes ? `pior: ${piorMes.label} · melhor: ${melhorMes.label}` : undefined}
          color="#8b5cf6"
          icon={Gauge}
          variant="border"
        />
      </div>

      {/* Evolução — valor vendido decomposto */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: COR_VENDIDO }} />
              Evolução da Margem — Valor Vendido Decomposto
            </CardTitle>
            <div className="inline-flex bg-slate-100 rounded-md p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setModoHero("abs")}
                className={`px-2.5 py-1 rounded ${modoHero === "abs" ? "bg-white shadow-sm font-semibold text-slate-800" : "text-slate-500"}`}
              >
                R$
              </button>
              <button
                type="button"
                onClick={() => setModoHero("pct")}
                className={`px-2.5 py-1 rounded ${modoHero === "pct" ? "bg-white shadow-sm font-semibold text-slate-800" : "text-slate-500"}`}
              >
                %
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={meses} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.floor(meses.length / 12)} />
              <YAxis
                tickFormatter={v => (modoHero === "pct" ? `${v}%` : fmtBrlCompact(v))}
                tick={{ fontSize: 10 }}
                width={modoHero === "pct" ? 40 : 60}
                domain={modoHero === "pct" ? [0, 100] : undefined}
              />
              <Tooltip content={<ChartTooltip format={modoHero === "pct" ? fmtPct : fmtBrl} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey={modoHero === "pct" ? "variavelPct" : "variavel"} name="Custo variável" stackId="a" fill={COR_VARIAVEL} />
              <Bar dataKey={modoHero === "pct" ? "fixoPct" : "fixo"} name="Custo fixo" stackId="a" fill={COR_FIXO} />
              <Bar dataKey={modoHero === "pct" ? "resultadoPct" : "resultado"} name="Resultado líquido" stackId="a" fill={COR_RESULTADO} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-1">
            A fronteira entre o 1º e o 2º segmento é a margem de contribuição; o topo do 3º é o resultado líquido.
          </p>
        </CardContent>
      </Card>

      {/* Comparação ano a ano */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            {anoAnterior} → {anoSel}: a virada
          </CardTitle>
          <p className="text-xs text-muted-foreground">Mesmo recorte de meses nos dois anos, lado a lado.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-2">
                {anoAnterior} · {qtdMesesComparar} {qtdMesesComparar === 1 ? "mês" : "meses"}
              </div>
              <CompareRow label="O.S. vendidas" value={fmtNum(totalAnterior.count)} />
              <CompareRow label="Valor vendido" value={fmtBrl(totalAnterior.valorOs)} />
              <CompareRow label="Ticket médio" value={fmtBrl(ticketMedioAnterior)} />
              <CompareRow label="Margem líquida" value={fmtPct(resultadoPctAnterior)} />
              <CompareRow label="Margem de contribuição" value={fmtPct(contribPctAnterior)} last />
            </div>
            <div className="hidden md:flex flex-col items-center text-slate-300">
              <ArrowRight size={22} />
              <span className="text-[10px] font-mono mt-1">YoY</span>
            </div>
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-4">
              <div className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-2">
                {anoSel} · {qtdMesesComparar} {qtdMesesComparar === 1 ? "mês" : "meses"}
              </div>
              <CompareRow label="O.S. vendidas" value={fmtNum(totalAtual.count)} delta={variacaoPedidos} />
              <CompareRow label="Valor vendido" value={fmtBrl(totalAtual.valorOs)} delta={variacaoValor} />
              <CompareRow label="Ticket médio" value={fmtBrl(ticketMedioAtual)} delta={variacaoTicket} />
              <CompareRow label="Margem líquida" value={fmtPct(resultadoPctAtual)} delta={deltaResultadoPct} deltaUnit=" p.p." />
              <CompareRow label="Margem de contribuição" value={fmtPct(contribPctAtual)} delta={deltaContribPct} deltaUnit=" p.p." last />
            </div>
          </div>

          {totalAnterior.valorOs > 0 && (
            <p className="text-xs leading-relaxed text-slate-600 mt-4">
              Pelo mesmo recorte de {qtdMesesComparar} {qtdMesesComparar === 1 ? "mês" : "meses"}: pedidos{" "}
              {variacaoPedidos != null && (variacaoPedidos >= 0 ? <>cresceram <b>{fmtPct(variacaoPedidos)}</b></> : <>caíram <b>{fmtPct(Math.abs(variacaoPedidos))}</b></>)}
              , valor vendido {variacaoValor != null && (variacaoValor >= 0 ? <>cresceu <b>{fmtPct(variacaoValor)}</b></> : <>caiu <b>{fmtPct(Math.abs(variacaoValor))}</b></>)}
              {" "}e o ticket médio {variacaoTicket != null && (variacaoTicket >= 0 ? <>subiu <b>{fmtPct(variacaoTicket)}</b></> : <>caiu <b>{fmtPct(Math.abs(variacaoTicket))}</b></>)}
              {" "}({fmtBrl(ticketMedioAnterior)} → {fmtBrl(ticketMedioAtual)}). A margem líquida foi de{" "}
              <b>{fmtPct(resultadoPctAnterior)}</b> para <b>{fmtPct(resultadoPctAtual)}</b>{" "}
              ({deltaResultadoPct >= 0 ? "+" : ""}{fmtPct(deltaResultadoPct)} p.p.), e a matéria-prima —
              {" "}o maior componente do custo variável — passou de <b>{fmtPct(materiaPrimaPctAnterior)}</b> para{" "}
              <b>{fmtPct(materiaPrimaPctAtual)}</b> da receita.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Margem % e composição do custo variável */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: COR_RESULTADO }} />
              Margem de Contribuição × Margem Líquida (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={meses} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.floor(meses.length / 12)} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} width={45} domain={[0, "auto"]} />
                <Tooltip content={<ChartTooltip format={fmtPct} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="contribuicaoPct" name="Margem de contribuição" stroke={COR_CONTRIBUICAO} strokeWidth={2} dot={false} type="monotone" />
                <Line dataKey="resultadoPct" name="Margem líquida" stroke={COR_RESULTADO} strokeWidth={2} dot={false} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
            {melhorMes && piorMes && (
              <p className="text-xs text-muted-foreground mt-1">
                Em {anoSel}: melhor mês <b className="text-emerald-700">{melhorMes.label}</b> ({fmtPct(melhorMes.resultadoPct)}) ·
                {" "}pior mês <b className="text-red-600">{piorMes.label}</b> ({fmtPct(piorMes.resultadoPct)})
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: COR_VARIAVEL }} />
              Composição do Custo Variável (% da receita)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={mesesAno} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} width={40} />
                <Tooltip content={<ChartTooltip format={fmtPct} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="materiaPrimaPct" name="Matéria-prima" stackId="cv" stroke={COR_VARIAVEL} fill={COR_VARIAVEL} fillOpacity={0.75} />
                <Area type="monotone" dataKey="tributosPct" name="Tributos" stackId="cv" stroke={COR_TRIBUTOS} fill={COR_TRIBUTOS} fillOpacity={0.75} />
                <Area type="monotone" dataKey="comissoesPct" name="Comissões" stackId="cv" stroke={COR_COMISSOES} fill={COR_COMISSOES} fillOpacity={0.75} />
                <Area type="monotone" dataKey="terceirizadosPct" name="Terceirizados" stackId="cv" stroke={COR_TERCEIRIZADOS} fill={COR_TERCEIRIZADOS} fillOpacity={0.75} />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-1">Detalhamento do segmento laranja do gráfico acima, em {anoSel}.</p>
          </CardContent>
        </Card>
      </div>

      {/* Custo fixo por O.S. e mix fixo × variável */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: COR_FIXO }} />
              Custo Fixo por O.S.
            </CardTitle>
            <p className="text-xs text-muted-foreground">Overhead médio absorvido por ordem vendida, em {anoSel}.</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={mesesAno} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => fmtBrlCompact(v)} tick={{ fontSize: 10 }} width={55} />
                <Tooltip content={<ChartTooltip format={fmtBrl} />} />
                <Line dataKey="fixoPorOS" name="Custo fixo por O.S." stroke={COR_FIXO} strokeWidth={2} dot={{ r: 3 }} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              Custo Fixo × Custo Variável (% da receita)
            </CardTitle>
            <p className="text-xs text-muted-foreground">As duas fatias que compõem o custo total, em {anoSel}.</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={mesesAno} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} width={40} />
                <Tooltip content={<ChartTooltip format={fmtPct} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="fixoPct" name="Custos fixos" stackId="fv" stroke={COR_FIXO} fill={COR_FIXO} fillOpacity={0.75} />
                <Area type="monotone" dataKey="variavelPct" name="Custos variáveis" stackId="fv" stroke={COR_VARIAVEL} fill={COR_VARIAVEL} fillOpacity={0.75} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Evolução dos gastos fixos */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            Evolução dos Gastos Fixos
          </CardTitle>
          <p className="text-xs text-muted-foreground">Custo fixo e mão de obra, mês a mês em {anoSel} — em reais e como fatia da receita.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <StatBox label={`Custo fixo total ${anoSel}`} value={fmtBrlCompact(fixoTotalAtual)} delta={deltaFixoTotal} />
            <StatBox label="Custo fixo / O.S. médio" value={fmtBrl(totalAtual.count ? fixoTotalAtual / totalAtual.count : 0)} />
            <StatBox label={`Mão de obra ${anoSel}`} value={fmtBrlCompact(maoDeObraTotalAtual)} delta={deltaMaoDeObraTotal} />
            <StatBox
              label="Mão de obra / receita"
              value={fmtPct(totalAtual.valorOs ? (maoDeObraTotalAtual / totalAtual.valorOs) * 100 : 0)}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Custo fixo total (R$)</p>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={mesesAno} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => fmtBrlCompact(v)} tick={{ fontSize: 10 }} width={55} />
                  <Tooltip content={<ChartTooltip format={fmtBrl} />} />
                  <Bar dataKey="fixo" name="Custo fixo" fill={COR_FIXO} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Composição do custo fixo (% da receita)</p>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={mesesAno} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} width={40} />
                  <Tooltip content={<ChartTooltip format={fmtPct} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="custoFixoPuroPct" name="Custo fixo (estrutura)" stackId="fx" stroke={COR_FIXO} fill={COR_FIXO} fillOpacity={0.75} />
                  <Area type="monotone" dataKey="maoDeObraPct" name="Mão de obra" stackId="fx" stroke={COR_MAODEOBRA} fill={COR_MAODEOBRA} fillOpacity={0.75} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ranking por vendedor */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Users size={14} className="text-blue-500" />
            Valor Vendido por Vendedor (histórico completo)
          </CardTitle>
          <p className="text-xs text-muted-foreground">Ordenado por valor vendido total no período; o percentual à direita é a margem líquida de cada carteira.</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {vendedores.map(v => {
              const largura = maxValorVendedor ? Math.max((v.valorOs / maxValorVendedor) * 100, 6) : 0;
              return (
                <div key={v.vendedor} className="grid grid-cols-[150px_1fr_84px] items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
                  <div className="text-xs font-semibold text-slate-700 truncate">
                    {v.vendedor}
                    <span className="block text-[10px] font-normal text-slate-400 font-mono">{fmtNum(v.count)} O.S.</span>
                  </div>
                  <div className="h-5 rounded bg-slate-100 relative overflow-hidden">
                    <div
                      className="h-full rounded flex items-center justify-end px-2"
                      style={{ width: `${largura}%`, background: COR_VENDIDO }}
                    >
                      <span className="text-[10px] font-mono text-white whitespace-nowrap">{fmtBrlCompact(v.valorOs)}</span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <b className="block text-sm text-emerald-700">{fmtPct(v.resultadoPct)}</b>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wide">margem líq.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Detalhamento mensal */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            Detalhamento Mensal
          </CardTitle>
          <p className="text-xs text-muted-foreground">Base dos gráficos acima — valores em reais e percentuais sobre o valor vendido do mês, em {anoSel}.</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-slate-50 border-slate-200">
                <TableHead className="font-semibold text-slate-600 uppercase tracking-wide">Mês</TableHead>
                <TableHead className="text-right font-semibold text-slate-600 uppercase tracking-wide">O.S.</TableHead>
                <TableHead className="text-right font-semibold text-slate-600 uppercase tracking-wide">Valor vendido</TableHead>
                <TableHead className="text-right font-semibold text-slate-600 uppercase tracking-wide">Custos totais</TableHead>
                <TableHead className="text-right font-semibold text-slate-600 uppercase tracking-wide">Resultado (R$)</TableHead>
                <TableHead className="text-right font-semibold text-slate-600 uppercase tracking-wide">Resultado (%)</TableHead>
                <TableHead className="text-right font-semibold text-slate-600 uppercase tracking-wide">Contribuição (R$)</TableHead>
                <TableHead className="text-right font-semibold text-slate-600 uppercase tracking-wide">Contribuição (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mesesAno.map(m => (
                <TableRow key={`${m.ano}-${m.mes}`}>
                  <TableCell className="font-semibold text-slate-700">{m.label}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(m.count)}</TableCell>
                  <TableCell className="text-right font-mono text-blue-700">{fmtBrl(m.valorOs)}</TableCell>
                  <TableCell className="text-right font-mono text-slate-600">{fmtBrl(m.variavel + m.fixo)}</TableCell>
                  <TableCell className="text-right font-mono text-emerald-700">{fmtBrl(m.resultado)}</TableCell>
                  <TableCell className="text-right font-mono text-emerald-700">{fmtPct(m.resultadoPct)}</TableCell>
                  <TableCell className="text-right font-mono text-blue-600">{fmtBrl(m.contribuicao)}</TableCell>
                  <TableCell className="text-right font-mono text-blue-600">{fmtPct(m.contribuicaoPct)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Situação das O.S. */}
      {statusAno.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <ListChecks size={14} className="text-slate-500" />
              Situação das Ordens de Serviço — {anoSel}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Status das {fmtNum(totalStatusAno)} O.S. registradas em {anoSel}. Os KPIs acima consideram as{" "}
              <b className="text-slate-700">{fmtNum(totalAtual.count)}</b> não canceladas
              {canceladasAno > 0 && <>; as {fmtNum(canceladasAno)} canceladas ficam fora do cálculo de margem</>}.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {statusAno.map(s => (
                <div
                  key={s.status}
                  className={`flex justify-between items-center text-xs px-3 py-2 rounded-lg ${
                    s.status.toLowerCase() === "cancelada" ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="truncate">{s.status}</span>
                  <b className="font-mono ml-2">{fmtNum(s.count)}</b>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Retenção de clientes — compra única × recompra × intervalo */}
      {retAnoAtual && retAnoAnterior && (
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              Retenção de Clientes — {anoSel} vs. {anoSel - 1}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Comparando janeiro a {MESES_ABREV[mesLimiteRetencao - 1]} nos dois anos — mesmo recorte, pra
              não penalizar {anoSel} por ainda não ter tido tempo de os clientes recentes voltarem a comprar.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { ano: anoSel - 1, r: retAnoAnterior },
                { ano: anoSel, r: retAnoAtual },
              ].map(({ ano, r }) => (
                <div key={ano} className={`rounded-xl border p-4 ${ano === anoSel ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200 bg-slate-50"}`}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                    {ano} (jan–{MESES_ABREV[mesLimiteRetencao - 1]}) · {fmtNum(r.totalClientes)} clientes ativos
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-slate-600">Compra única</span>
                      <span className="font-mono font-bold text-amber-600">{fmtNum(r.unicos)} <span className="text-xs text-muted-foreground">({fmtPct(r.unicosPct)})</span></span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-slate-600">Com recompra</span>
                      <span className="font-mono font-bold text-emerald-700">{fmtNum(r.recompra)} <span className="text-xs text-muted-foreground">({fmtPct(r.recompraPct)})</span></span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                      <span className="text-sm text-slate-600">Intervalo médio entre compras</span>
                      <span className="font-mono font-bold text-indigo-700">{r.intervaloMedioDias != null ? `${fmtNum(r.intervaloMedioDias, 0)} dias` : "—"}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-slate-600">Intervalo mediano</span>
                      <span className="font-mono text-slate-700">{r.intervaloMedianaDias != null ? `${fmtNum(r.intervaloMedianaDias, 0)} dias` : "—"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {retAnoAtual.recompraPct < retAnoAnterior.recompraPct && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-3">
                A taxa de recompra caiu {fmtPct(retAnoAnterior.recompraPct - retAnoAtual.recompraPct)} pontos em relação a {anoSel - 1}
                {" "}— {fmtNum(retAnoAnterior.totalClientes - retAnoAtual.totalClientes)} clientes ativos a menos no mesmo recorte.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
