import { useEffect, useRef, useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import {
  TrendingUp, Edit3, Check, X, DollarSign, Users, Target, Percent, Filter, Upload, RefreshCw,
  Loader2, AlertTriangle,
} from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ImportarCustoMarketing from "./ImportarCustoMarketing";
import DetalhamentoMarketing from "./DetalhamentoMarketing";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LayoutGrid, ListTree } from "lucide-react";

// Retry único: se a API do MubiSys estiver lenta/indisponível, tentar de novo
// automaticamente só multiplica a espera pelo mesmo resultado (ver PerformanceComercial.tsx)
const RETRY_MUBISYS = { retry: 1, refetchOnWindowFocus: false } as const;

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// 51% do faturamento de clientes novos = retorno real de marketing
const MARGEM_MARKETING = 0.51;

function fmtBRL(v: number | null | undefined): string {
  if (v == null || isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtBRLShort(v: number): string {
  if (Math.abs(v) >= 1_000_000) return "R$ " + (v / 1_000_000).toFixed(1) + "M";
  if (Math.abs(v) >= 1_000) return "R$ " + (v / 1_000).toFixed(0) + "k";
  return fmtBRL(v);
}

interface Props {
  anoSel: number;
}

export default function MarketingFinanceiro({ anoSel }: Props) {
  const [marketingEditando, setMarketingEditando] = useState<number | null>(null);
  const [marketingInputAquisicao, setMarketingInputAquisicao] = useState("");
  const [marketingInputReativacao, setMarketingInputReativacao] = useState("");
  const [marketingObs, setMarketingObs] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  // Filtro de mês: null = todos os meses
  const [mesFiltro, setMesFiltro] = useState<number | null>(null);

  const {
    data: custoMarketingAno = [],
    isLoading: loadingMarketing,
    refetch: refetchMarketing,
  } = trpc.financeiro.getCustoMarketingAno.useQuery({ ano: anoSel });

  const {
    data: clientesNovosAno = [],
    isLoading: loadingClientesNovos,
    isError: errorClientesNovos,
    refetch: refetchClientesNovos,
  } = trpc.performanceComercial.getClientesNovosAno.useQuery({ ano: anoSel }, RETRY_MUBISYS);

  // Reaparece automaticamente se uma nova tentativa também falhar
  const [erroDispensado, setErroDispensado] = useState(false);
  useEffect(() => {
    if (errorClientesNovos) setErroDispensado(false);
  }, [errorClientesNovos]);

  // ─── Indicador de fonte/velocidade dos dados (mesmo padrão de PerformanceComercial.tsx) ───
  const loadStartRef = useRef<number>(0);
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null);
  useEffect(() => {
    loadStartRef.current = Date.now();
    setLoadTimeMs(null);
  }, [anoSel]);
  useEffect(() => {
    if (!loadingClientesNovos && clientesNovosAno && loadStartRef.current > 0) {
      setLoadTimeMs(Date.now() - loadStartRef.current);
      loadStartRef.current = 0;
    }
  }, [loadingClientesNovos, clientesNovosAno]);

  // "local" = veio do histórico sincronizado (historico_os), não de uma consulta ao vivo
  // à API MubiSys — ver getClientesNovosAno. "congelado" = mês auditado/fechado.
  const origemDados = useMemo(() => {
    if (!clientesNovosAno.length) return null;
    if (clientesNovosAno.some((r: any) => r.origem === "indisponivel")) return "indisponivel";
    if (clientesNovosAno.every((r: any) => r.origem === "congelado")) return "congelado";
    return "local";
  }, [clientesNovosAno]);

  const upsertMarketing = trpc.financeiro.upsertCustoMarketing.useMutation({
    onSuccess: () => {
      toast.success("Investimento em marketing salvo!");
      setMarketingEditando(null);
      refetchMarketing();
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  const custoMarketingMap = useMemo(() => {
    const m: Record<number, typeof custoMarketingAno[0]> = {};
    for (const r of custoMarketingAno) m[r.mes] = r;
    return m;
  }, [custoMarketingAno]);

  const clientesNovosMap = useMemo(() => {
    const m: Record<number, { osNovos: number; faturamentoNovos: number; ticketMedioNovos: number; clientesNovosUnicos: number; clientesReativados: number }> = {};
    for (const r of clientesNovosAno) m[r.mes] = r;
    return m;
  }, [clientesNovosAno]);

  // ─── Cálculos por mês ───────────────────────────────────────────────────────
  const dadosMeses = useMemo(() => MESES.map((nome, idx) => {
    const mes = idx + 1;
    const mk = custoMarketingMap[mes];
    const novos = clientesNovosMap[mes];
    const investimentoAquisicao = mk ? parseFloat(mk.investimentoAquisicao) : null;
    const investimentoReativacao = mk ? parseFloat(mk.investimentoReativacao) : null;
    const investimento = mk ? parseFloat(mk.investimento) : null;
    const clientesNovosQtd = novos?.clientesNovosUnicos ?? null;
    const clientesReativadosQtd = novos?.clientesReativados ?? null;
    const faturamentoNovos = novos?.faturamentoNovos ?? null;
    const pedidosNovos = novos?.osNovos ?? null;

    // CAC de aquisição = Investimento em Aquisição / Nº Clientes Novos
    // (reativação não gera "cliente novo", não entra nesse cálculo)
    const cac = investimentoAquisicao != null && clientesNovosQtd != null && clientesNovosQtd > 0
      ? investimentoAquisicao / clientesNovosQtd : null;

    // Retorno real = 51% do faturamento de clientes novos
    const retornoReal = faturamentoNovos != null ? faturamentoNovos * MARGEM_MARKETING : null;

    // ROI em R$ = Retorno Real - Investimento em Aquisição
    const roiReais = retornoReal != null && investimentoAquisicao != null
      ? retornoReal - investimentoAquisicao : null;

    // ROI em % = (Retorno Real - Investimento em Aquisição) / Investimento em Aquisição × 100
    const roiPct = roiReais != null && investimentoAquisicao != null && investimentoAquisicao > 0
      ? (roiReais / investimentoAquisicao) * 100 : null;

    return {
      mes, nome, abrev: MESES_ABREV[idx],
      investimentoAquisicao, investimentoReativacao, investimento,
      clientesNovosQtd, clientesReativadosQtd, faturamentoNovos, pedidosNovos,
      retornoReal, cac, roiReais, roiPct,
    };
  }), [custoMarketingMap, clientesNovosMap]);

  // Meses com dados para o filtro
  const mesesComDados = useMemo(() =>
    dadosMeses.filter(d => d.investimento != null || d.faturamentoNovos != null),
    [dadosMeses]
  );

  // Dados filtrados pelo mês selecionado
  const dadosFiltrados = useMemo(() =>
    mesFiltro != null ? dadosMeses.filter(d => d.mes === mesFiltro) : dadosMeses,
    [dadosMeses, mesFiltro]
  );

  // ─── KPIs agregados (baseados no filtro) ────────────────────────────────────
  const totalInvestidoAquisicao = useMemo(() =>
    dadosFiltrados.reduce((s, d) => s + (d.investimentoAquisicao ?? 0), 0), [dadosFiltrados]);

  const totalInvestidoReativacao = useMemo(() =>
    dadosFiltrados.reduce((s, d) => s + (d.investimentoReativacao ?? 0), 0), [dadosFiltrados]);

  const totalInvestido = useMemo(() =>
    dadosFiltrados.reduce((s, d) => s + (d.investimento ?? 0), 0), [dadosFiltrados]);

  const totalClientesNovos = useMemo(() =>
    dadosFiltrados.reduce((s, d) => s + (d.clientesNovosQtd ?? 0), 0), [dadosFiltrados]);

  const totalClientesReativados = useMemo(() =>
    dadosFiltrados.reduce((s, d) => s + (d.clientesReativadosQtd ?? 0), 0), [dadosFiltrados]);

  const totalFaturamentoNovos = useMemo(() =>
    dadosFiltrados.reduce((s, d) => s + (d.faturamentoNovos ?? 0), 0), [dadosFiltrados]);

  const totalPedidosNovos = useMemo(() =>
    dadosFiltrados.reduce((s, d) => s + (d.pedidosNovos ?? 0), 0), [dadosFiltrados]);

  const totalRetornoReal = totalFaturamentoNovos * MARGEM_MARKETING;

  const cacMedio = useMemo(() => {
    const com = dadosFiltrados.filter(d => d.cac != null);
    if (!com.length) return null;
    return com.reduce((s, d) => s + (d.cac ?? 0), 0) / com.length;
  }, [dadosFiltrados]);

  // ROI total em R$ e % — considera só o investimento em aquisição (reativação não gera "cliente novo")
  const roiTotalReais = totalInvestidoAquisicao > 0 ? totalRetornoReal - totalInvestidoAquisicao : null;
  const roiTotalPct = totalInvestidoAquisicao > 0 && roiTotalReais != null
    ? (roiTotalReais / totalInvestidoAquisicao) * 100 : null;

  // ROI por cliente novo = ROI total R$ / total de clientes novos
  const roiPorCliente = roiTotalReais != null && totalClientesNovos > 0
    ? roiTotalReais / totalClientesNovos : null;

  // ROI médio (média dos meses com dados)
  const roiMedioReais = useMemo(() => {
    const com = dadosFiltrados.filter(d => d.roiReais != null);
    if (!com.length) return null;
    return com.reduce((s, d) => s + (d.roiReais ?? 0), 0) / com.length;
  }, [dadosFiltrados]);

  const roiMedioPct = useMemo(() => {
    const com = dadosFiltrados.filter(d => d.roiPct != null);
    if (!com.length) return null;
    return com.reduce((s, d) => s + (d.roiPct ?? 0), 0) / com.length;
  }, [dadosFiltrados]);

  // ─── Dados para gráficos (sempre todos os meses com dados) ──────────────────
  const dadosGrafico = useMemo(() =>
    mesesComDados.map(d => ({
      mes: d.abrev,
      "Aquisição": d.investimentoAquisicao ?? 0,
      "Reativação": d.investimentoReativacao ?? 0,
      "Fat. Clientes Novos": d.faturamentoNovos ?? 0,
      "Retorno Real (51%)": d.retornoReal ?? 0,
    })),
    [mesesComDados]
  );

  const dadosRoi = useMemo(() =>
    mesesComDados
      .filter(d => d.roiPct != null)
      .map(d => ({
        mes: d.abrev,
        "ROI (%)": Math.round(d.roiPct ?? 0),
        "ROI (R$)": Math.round(d.roiReais ?? 0),
      })),
    [mesesComDados]
  );

  const labelFiltro = mesFiltro != null ? MESES[mesFiltro - 1] : `Ano ${anoSel}`;

  // Primeira carga do custo de marketing (fonte principal da aba) ainda em andamento
  if (loadingMarketing) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 size={28} className="animate-spin" />
        <p className="text-sm">Carregando dados de marketing...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral" className="gap-1.5">
            <LayoutGrid size={14} /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="detalhamento" className="gap-1.5">
            <ListTree size={14} /> Detalhamento por Fornecedor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6 pt-4">

      {/* ─── Modal de erro: falha ao buscar dados do MubiSys ────────────────────── */}
      <AlertDialog
        open={errorClientesNovos && !erroDispensado}
        onOpenChange={(open) => { if (!open) setErroDispensado(true); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              Erro ao buscar dados do MubiSys
            </AlertDialogTitle>
            <AlertDialogDescription>
              Não foi possível carregar os dados de clientes novos (via API do MubiSys) para calcular CAC e ROI. Isso costuma acontecer quando a API do MubiSys está lenta ou temporariamente indisponível. Os valores de investimento em marketing continuam disponíveis normalmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar sem esses dados</AlertDialogCancel>
            <AlertDialogAction onClick={() => refetchClientesNovos()}>
              Tentar novamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Filtro de mês + Importar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter size={13} />
            Filtrar por mês:
          </div>
          {loadingClientesNovos && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 animate-pulse ml-2">
              <Loader2 size={11} className="animate-spin" />
              BUSCANDO DADOS...
            </span>
          )}
          {!loadingClientesNovos && origemDados === "local" && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 ml-2"
              title="Números de clientes novos vêm da sincronização diária do histórico do MubiSys (historico_os), não de uma consulta ao vivo. O mês corrente pode ficar até ~1 dia defasado."
            >
              🗄️ DADOS LOCAIS (sync diário)
            </span>
          )}
          {!loadingClientesNovos && origemDados === "congelado" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200 ml-2">
              🔒 CONGELADO
            </span>
          )}
          {!loadingClientesNovos && origemDados === "indisponivel" && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200 ml-2"
              title="Não foi possível conectar ao banco de dados para calcular clientes novos."
            >
              ⚠️ BANCO INDISPONÍVEL
            </span>
          )}
          {loadTimeMs !== null && !loadingClientesNovos && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                loadTimeMs < 2000
                  ? "bg-green-50 text-green-600 border-green-200"
                  : loadTimeMs < 10000
                  ? "bg-amber-50 text-amber-600 border-amber-200"
                  : "bg-red-50 text-red-600 border-red-200"
              }`}
              title="Tempo de resposta da consulta"
            >
              {loadTimeMs < 1000 ? `${loadTimeMs}ms` : `${(loadTimeMs / 1000).toFixed(1)}s`}
            </span>
          )}
          <button
            onClick={() => setMesFiltro(null)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              mesFiltro === null
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
            }`}
          >
            Todos
          </button>
          {mesesComDados.map(d => (
            <button
              key={d.mes}
              onClick={() => setMesFiltro(mesFiltro === d.mes ? null : d.mes)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                mesFiltro === d.mes
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
              }`}
            >
              {d.abrev}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50"
          onClick={() => setImportOpen(true)}
        >
          <Upload size={14} />
          Importar planilha
        </Button>
      </div>

      <ImportarCustoMarketing
        open={importOpen}
        onOpenChange={setImportOpen}
        anoSel={anoSel}
        onImported={() => refetchMarketing()}
      />

      {/* ─── KPIs ──────────────────────────────────────────────────────────────── */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <div className="w-3 h-0.5 bg-purple-500 rounded" />
          Indicadores — {labelFiltro}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Total Investido em Mkt"
            value={fmtBRL(totalInvestido)}
            sub={`${dadosFiltrados.filter(d => d.investimento != null).length} meses`}
            color="#7c3aed"
            icon={<DollarSign size={18} />}
            variant="border"
          />
          <KpiCard
            label="Invest. Reativação"
            value={fmtBRL(totalInvestidoReativacao)}
            sub="Clientes 6+ meses sem comprar"
            color="#0891b2"
            icon={<RefreshCw size={18} />}
            variant="border"
          />
          <KpiCard
            label="Fat. Clientes Novos"
            value={fmtBRLShort(totalFaturamentoNovos)}
            sub={`Retorno real (51%): ${fmtBRLShort(totalRetornoReal)}`}
            color="#16a34a"
            icon={<TrendingUp size={18} />}
            variant="border"
          />
          <KpiCard
            label="Clientes Novos"
            value={String(totalClientesNovos)}
            sub="Novos ou reativados (6+ meses sem pedir)"
            color="#2563eb"
            icon={<Users size={18} />}
            variant="border"
          />
          <KpiCard
            label="CAC de Aquisição"
            value={cacMedio != null ? fmtBRL(cacMedio) : "—"}
            sub="Invest. aquisição / cliente novo"
            color="#ea580c"
            icon={<Target size={18} />}
            variant="border"
          />
          <KpiCard
            label="ROI de Marketing"
            value={
              <>
                {roiTotalReais != null ? fmtBRLShort(roiTotalReais) : "—"}
                {roiTotalPct != null && (
                  <span className="block text-sm font-semibold mt-0.5 opacity-80">
                    {roiTotalPct.toFixed(0)}% sobre aquisição
                  </span>
                )}
              </>
            }
            sub={[
              `Média mensal: ${roiMedioReais != null ? fmtBRLShort(roiMedioReais) : "—"} / ${roiMedioPct != null ? roiMedioPct.toFixed(0) + "%" : "—"}`,
              roiPorCliente != null ? `ROI por cliente: ${fmtBRL(roiPorCliente)}` : "",
            ].filter(Boolean).join(" · ")}
            color={roiTotalReais != null && roiTotalReais >= 0 ? "#16a34a" : "#dc2626"}
            icon={<Percent size={18} />}
            variant="border"
          />
        </div>
      </div>

      {/* ─── Nota metodológica ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-800">
        <Percent size={13} className="mt-0.5 shrink-0" />
        <span>
          <strong>Metodologia ROI:</strong> O investimento em marketing é dividido em <strong>Aquisição</strong> (atrai clientes novos) e <strong>Reativação</strong> (resgata clientes 6+ meses sem comprar). "Clientes novos" considera clientes que nunca compraram <strong>ou</strong> ficaram <strong>6+ meses sem pedir e voltaram</strong> (reativados, mostrados na coluna própria).
          O retorno real considerado no ROI é <strong>51% do faturamento de clientes novos</strong> (margem operacional estimada), comparado apenas ao investimento em <strong>aquisição</strong> — a reativação não gera "cliente novo" e por isso não entra nesse cálculo.
          ROI em R$ = Retorno Real − Invest. Aquisição &nbsp;|&nbsp; ROI em % = (Retorno Real − Invest. Aquisição) ÷ Invest. Aquisição × 100
        </span>
      </div>

      {/* ─── Gráficos ──────────────────────────────────────────────────────────── */}
      {dadosGrafico.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Barras: Investimento vs Faturamento vs Retorno Real */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp size={16} className="text-purple-600" />
                Investimento (Aquisição x Reativação) vs Retorno Real
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dadosGrafico} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Legend iconSize={10} />
                  <Bar dataKey="Aquisição" stackId="mkt" fill="#7c3aed" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Reativação" stackId="mkt" fill="#0891b2" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Fat. Clientes Novos" fill="#16a34a" radius={[3, 3, 0, 0]} opacity={0.7} />
                  <Bar dataKey="Retorno Real (51%)" fill="#059669" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Linha: ROI % e R$ por mês */}
          {dadosRoi.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Percent size={16} className="text-emerald-600" />
                  ROI de Marketing por Mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={dadosRoi} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="pct" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <YAxis yAxisId="reais" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v: number, name: string) =>
                        name === "ROI (%)" ? `${v}%` : fmtBRL(v)
                      }
                    />
                    <Legend iconSize={10} />
                    <ReferenceLine yAxisId="pct" y={0} stroke="#e2e8f0" strokeWidth={1.5} />
                    <Line
                      yAxisId="pct"
                      type="monotone"
                      dataKey="ROI (%)"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#16a34a" }}
                    />
                    <Line
                      yAxisId="reais"
                      type="monotone"
                      dataKey="ROI (R$)"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#7c3aed" }}
                      strokeDasharray="5 3"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── Tabela mensal ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp size={18} className="text-purple-600" />
            Custo de Marketing e ROI — {labelFiltro}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Preencha o investimento mensal em Aquisição e Reativação. Os demais campos são calculados automaticamente.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-muted-foreground bg-slate-50">
                <TableHead className="font-semibold">Mês</TableHead>
                <TableHead className="text-right font-semibold">Aquisição</TableHead>
                <TableHead className="text-right font-semibold">Reativação</TableHead>
                <TableHead className="text-right font-semibold">Clientes Novos</TableHead>
                <TableHead className="text-right font-semibold">Reativados</TableHead>
                <TableHead className="text-right font-semibold">Pedidos</TableHead>
                <TableHead className="text-right font-semibold">CAC Aquisição</TableHead>
                <TableHead className="text-right font-semibold">Fat. Clientes Novos</TableHead>
                <TableHead className="text-right font-semibold">Retorno Real (51%)</TableHead>
                <TableHead className="text-right font-semibold">ROI (R$)</TableHead>
                <TableHead className="text-right font-semibold">ROI (%)</TableHead>
                <TableHead className="text-center font-semibold">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dadosFiltrados.map(({ mes, nome, investimentoAquisicao, investimentoReativacao, clientesNovosQtd, clientesReativadosQtd, faturamentoNovos, pedidosNovos, retornoReal, cac, roiReais, roiPct }) => {
                const mk = custoMarketingMap[mes];
                const isEditing = marketingEditando === mes;
                return (
                  <TableRow key={mes}>
                    <TableCell className="font-medium">{nome}</TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-muted-foreground text-xs">R$</span>
                          <Input
                            className="w-28 h-7 text-right text-sm"
                            value={marketingInputAquisicao}
                            onChange={e => setMarketingInputAquisicao(e.target.value)}
                            placeholder="0,00"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                const valAq = parseFloat(marketingInputAquisicao.replace(/\./g, "").replace(",", "."));
                                const valRe = parseFloat(marketingInputReativacao.replace(/\./g, "").replace(",", "."));
                                if (isNaN(valAq) || valAq < 0 || isNaN(valRe) || valRe < 0) { toast.error("Valor inválido"); return; }
                                upsertMarketing.mutate({ mes, ano: anoSel, investimentoAquisicao: valAq, investimentoReativacao: valRe, observacao: marketingObs || null });
                              }
                              if (e.key === "Escape") setMarketingEditando(null);
                            }}
                          />
                        </div>
                      ) : (
                        <span className={investimentoAquisicao != null ? "font-semibold text-purple-700" : "text-muted-foreground"}>
                          {investimentoAquisicao != null ? fmtBRL(investimentoAquisicao) : "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-muted-foreground text-xs">R$</span>
                          <Input
                            className="w-28 h-7 text-right text-sm"
                            value={marketingInputReativacao}
                            onChange={e => setMarketingInputReativacao(e.target.value)}
                            placeholder="0,00"
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                const valAq = parseFloat(marketingInputAquisicao.replace(/\./g, "").replace(",", "."));
                                const valRe = parseFloat(marketingInputReativacao.replace(/\./g, "").replace(",", "."));
                                if (isNaN(valAq) || valAq < 0 || isNaN(valRe) || valRe < 0) { toast.error("Valor inválido"); return; }
                                upsertMarketing.mutate({ mes, ano: anoSel, investimentoAquisicao: valAq, investimentoReativacao: valRe, observacao: marketingObs || null });
                              }
                              if (e.key === "Escape") setMarketingEditando(null);
                            }}
                          />
                        </div>
                      ) : (
                        <span className={investimentoReativacao != null ? "font-semibold text-cyan-700" : "text-muted-foreground"}>
                          {investimentoReativacao != null ? fmtBRL(investimentoReativacao) : "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {clientesNovosQtd != null
                        ? <span className="font-medium text-blue-700">{clientesNovosQtd}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {clientesReativadosQtd != null
                        ? <span className="font-medium text-amber-700">{clientesReativadosQtd}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {pedidosNovos != null
                        ? <span className="font-medium text-indigo-700">{pedidosNovos}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {cac != null
                        ? <span className="font-semibold text-orange-600">{fmtBRL(cac)}</span>
                        : <span className="text-muted-foreground">{investimentoAquisicao != null ? "sem dados" : "—"}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {faturamentoNovos != null
                        ? <span className="font-medium text-emerald-700">{fmtBRL(faturamentoNovos)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {retornoReal != null
                        ? <span className="font-medium text-teal-700">{fmtBRL(retornoReal)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {roiReais != null
                        ? <span className={`font-bold ${roiReais >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtBRL(roiReais)}</span>
                        : <span className="text-muted-foreground">{investimentoAquisicao != null ? "sem dados" : "—"}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {roiPct != null
                        ? <span className={`font-bold ${roiPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>{roiPct.toFixed(0)}%</span>
                        : <span className="text-muted-foreground">{investimentoAquisicao != null ? "sem dados" : "—"}</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                            onClick={() => {
                              const valAq = parseFloat(marketingInputAquisicao.replace(/\./g, "").replace(",", "."));
                              const valRe = parseFloat(marketingInputReativacao.replace(/\./g, "").replace(",", "."));
                              if (isNaN(valAq) || valAq < 0 || isNaN(valRe) || valRe < 0) { toast.error("Valor inválido"); return; }
                              upsertMarketing.mutate({ mes, ano: anoSel, investimentoAquisicao: valAq, investimentoReativacao: valRe, observacao: marketingObs || null });
                            }}
                            disabled={upsertMarketing.isPending}
                          >
                            <Check size={14} />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                            onClick={() => setMarketingEditando(null)}
                          >
                            <X size={14} />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-purple-600"
                          onClick={() => {
                            setMarketingEditando(mes);
                            setMarketingInputAquisicao(investimentoAquisicao != null ? investimentoAquisicao.toFixed(2).replace(".", ",") : "");
                            setMarketingInputReativacao(investimentoReativacao != null ? investimentoReativacao.toFixed(2).replace(".", ",") : "");
                            setMarketingObs(mk?.observacao ?? "");
                          }}
                        >
                          <Edit3 size={13} />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {totalInvestido > 0 && (
              <TableFooter className="bg-slate-50 border-t-2 border-slate-300">
                <TableRow>
                  <TableCell className="font-bold text-sm">
                    {mesFiltro != null ? MESES[mesFiltro - 1] : `Total ${anoSel}`}
                  </TableCell>
                  <TableCell className="text-right font-bold text-purple-700">{fmtBRL(totalInvestidoAquisicao)}</TableCell>
                  <TableCell className="text-right font-bold text-cyan-700">{fmtBRL(totalInvestidoReativacao)}</TableCell>
                  <TableCell className="text-right font-bold text-blue-700">{totalClientesNovos}</TableCell>
                  <TableCell className="text-right font-bold text-amber-700">{totalClientesReativados}</TableCell>
                  <TableCell className="text-right font-bold text-indigo-700">{totalPedidosNovos}</TableCell>
                  <TableCell className="text-right font-bold text-orange-600">
                    {cacMedio != null ? fmtBRL(cacMedio) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-700">{fmtBRL(totalFaturamentoNovos)}</TableCell>
                  <TableCell className="text-right font-bold text-teal-700">{fmtBRL(totalRetornoReal)}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600">
                    {roiTotalReais != null ? fmtBRL(roiTotalReais) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-600">
                    {roiTotalPct != null ? `${roiTotalPct.toFixed(0)}%` : "—"}
                  </TableCell>
                  <TableCell />
                </TableRow>
                {mesFiltro === null && (
                  <TableRow>
                    <TableCell className="text-xs text-muted-foreground font-medium">Média mensal</TableCell>
                    <TableCell colSpan={6} />
                    <TableCell colSpan={1} />
                    <TableCell className="text-right text-xs font-semibold text-emerald-600">
                      {roiMedioReais != null ? fmtBRL(roiMedioReais) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold text-emerald-600">
                      {roiMedioPct != null ? `${roiMedioPct.toFixed(0)}%` : "—"}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableFooter>
            )}
          </Table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="detalhamento" className="pt-4">
          <DetalhamentoMarketing anoSel={anoSel} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
