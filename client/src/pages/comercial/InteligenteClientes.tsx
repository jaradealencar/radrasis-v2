import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Users, UserPlus, TrendingDown, TrendingUp, ShoppingCart,
  AlertTriangle, Percent, CalendarDays, DollarSign, Repeat, Trophy, Info,
  CheckCircle2, XCircle, Clock3, ChevronRight, HelpCircle, Filter, Layers,
  Download, Sparkles, Send, UserCheck, SlidersHorizontal, MessageSquareText,
  Eye, ShieldCheck, Printer,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Table, TableHeader, TableBody, TableFooter,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, ResponsiveContainer, Cell, ReferenceArea,
  PieChart, Pie, Legend,
} from "recharts";
import KpiCard from "@/components/KpiCard";
import { fmtBrl, fmtNum, fmtPct, fmtDate, fmtDateTime } from "@/lib/format";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { FaixaDiasConfigForm } from "@/components/FaixaDiasConfigForm";
import MarketingFinanceiro from "@/pages/financeiro/MarketingFinanceiro";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function pad(n: number) { return String(n).padStart(2, "0"); }

function formatarPeriodo(ini: string, fim: string) {
  const [aIni, mIni] = ini.split("-").map(Number);
  const [aFim, mFim] = fim.split("-").map(Number);
  if (ini === fim) return `${MESES[mIni - 1]}/${aIni}`;
  if (aIni === aFim) return `${MESES[mIni - 1]} a ${MESES[mFim - 1]}/${aFim}`;
  return `${MESES[mIni - 1]}/${aIni} a ${MESES[mFim - 1]}/${aFim}`;
}

export const CLASSIFICACAO_INFO: Record<string, { label: string; cor: string; icone: string; corHex: string; descricao: string }> = {
  primeira_compra: {
    label: "Primeira compra", cor: "bg-blue-50 text-blue-700 border-blue-200", icone: "🆕", corHex: "#3b82f6",
    descricao: "Cliente com apenas 1 compra válida em todo o histórico local. Ainda não há uma segunda compra para saber se ele vai voltar.",
  },
  recompra_observada: {
    label: "Recompra observada", cor: "bg-slate-100 text-slate-700 border-slate-200", icone: "🔁", corHex: "#64748b",
    descricao: "Cliente com 2 ou mais compras, sem sinal de atraso relevante nem variação forte de volume — está comprando dentro do padrão de sempre dele.",
  },
  em_crescimento: {
    label: "Em crescimento", cor: "bg-green-50 text-green-700 border-green-200", icone: "📈", corHex: "#22c55e",
    descricao: "O valor comprado na janela atual está 20% ou mais acima da janela anterior de mesmo tamanho — sinal de aumento de consumo.",
  },
  reducao_volume: {
    label: "Redução de volume", cor: "bg-red-50 text-red-700 border-red-200", icone: "📉", corHex: "#ef4444",
    descricao: "O valor comprado na janela atual caiu 20% ou mais em relação à janela anterior de mesmo tamanho — sinal de queda de consumo.",
  },
  intervalo_acima_habitual: {
    label: "Atraso na recompra", cor: "bg-amber-50 text-amber-700 border-amber-200", icone: "⏰", corHex: "#f59e0b",
    descricao: "Já se passou 1,5x ou mais o intervalo mediano de compra desse cliente sem uma nova compra registrada — pode ser atraso, não é necessariamente perda do cliente.",
  },
  historico_insuficiente: {
    label: "Histórico insuficiente", cor: "bg-slate-50 text-slate-500 border-slate-200", icone: "❔", corHex: "#94a3b8",
    descricao: "Menos de 3 compras válidas em todo o histórico — amostra pequena demais para calcular mediana de intervalo ou tendência com confiança.",
  },
};

/** Ordem fixa de exibição no dashboard e na legenda — do sinal mais positivo
 * ao mais crítico, com "sem dado suficiente" por último. */
const ORDEM_CLASSIFICACOES = [
  "em_crescimento", "recompra_observada", "primeira_compra",
  "intervalo_acima_habitual", "reducao_volume", "historico_insuficiente",
] as const;

// Score de Probabilidade de Compra (Fase 1) — mesma fórmula/cores do CRM de
// Propostas (client/src/pages/comercial/CRM.tsx), sem ajuste por proposta
// específica (aqui é o perfil do cliente, não uma proposta em aberto).
function ProbabilidadeBadge({ p, explicacao }: { p: number | null | undefined; explicacao?: string[] }) {
  if (p == null) return <span className="text-slate-300">—</span>;
  const cor = p >= 50 ? "text-green-700 bg-green-100 border-green-200"
    : p >= 25 ? "text-amber-700 bg-amber-100 border-amber-200"
    : "text-red-700 bg-red-100 border-red-200";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold cursor-default ${cor}`}>
            <TrendingUp className="w-2.5 h-2.5" /> {p}%
          </span>
        </TooltipTrigger>
        {explicacao && explicacao.length > 0 && (
          <TooltipContent side="top" className="text-xs max-w-[260px]">
            <div className="space-y-0.5">
              {explicacao.map((linha, i) => <p key={i}>{linha}</p>)}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

const TIPO_ACAO_INFO: Record<string, { label: string; cor: string }> = {
  primeira_sem_segunda: { label: "1ª compra sem repetição", cor: "bg-blue-50 text-blue-700 border-blue-200" },
  atraso_recompra: { label: "Atraso na recompra", cor: "bg-amber-50 text-amber-700 border-amber-200" },
  alto_volume_baixa_margem: { label: "Alto volume, margem baixa", cor: "bg-purple-50 text-purple-700 border-purple-200" },
};

const RESULTADO_OPCOES: Array<{ value: string; label: string }> = [
  { value: "contato_realizado", label: "Contato realizado" },
  { value: "sem_resposta", label: "Sem resposta" },
  { value: "projeto_futuro", label: "Projeto futuro" },
  { value: "orcamento_solicitado", label: "Orçamento solicitado" },
  { value: "compra", label: "Compra" },
  { value: "adiamento", label: "Adiamento" },
  { value: "sem_interesse", label: "Sem interesse" },
];

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

// ─── Seletor de Período (mês/ano, convertido para datas no consumo) ──────────

function SeletorPeriodo({
  dataInicial, dataFinal, onChange,
}: {
  dataInicial: string; dataFinal: string;
  onChange: (ini: string, fim: string) => void;
}) {
  const anos = useMemo(() => {
    const a = new Date().getFullYear();
    return [a, a - 1, a - 2, a - 3];
  }, []);

  const [anoIni, mesIni] = dataInicial.split("-").map(Number);
  const [anoFim, mesFim] = dataFinal.split("-").map(Number);

  function setAnoCompleto(ano: number) {
    onChange(`${ano}-01`, `${ano}-12`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {anos.map(a => (
        <button
          key={a}
          onClick={() => setAnoCompleto(a)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
            dataInicial === `${a}-01` && dataFinal === `${a}-12`
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600"
          }`}
        >
          {a}
        </button>
      ))}
      <div className="w-px h-5 bg-slate-200" />
      <div className="flex items-center gap-1.5">
        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
        <select
          value={mesIni}
          onChange={e => onChange(`${anoIni}-${pad(Number(e.target.value))}`, dataFinal)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-blue-400"
        >
          {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m.slice(0, 3)}</option>)}
        </select>
        <select
          value={anoIni}
          onChange={e => onChange(`${e.target.value}-${pad(mesIni)}`, dataFinal)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-blue-400"
        >
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <span className="text-xs text-slate-400 font-medium">até</span>
      <div className="flex items-center gap-1.5">
        <select
          value={mesFim}
          onChange={e => onChange(dataInicial, `${anoFim}-${pad(Number(e.target.value))}`)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-blue-400"
        >
          {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m.slice(0, 3)}</option>)}
        </select>
        <select
          value={anoFim}
          onChange={e => onChange(dataInicial, `${e.target.value}-${pad(mesFim)}`)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-blue-400"
        >
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─── Modal do dicionário de métricas ──────────────────────────────────────────

function DicionarioMetricasModal({ open, onOpenChange, metricas }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  metricas: Array<{ id: string; nome: string; formula: string; periodo: string; limitacoes: string }> | undefined;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>O que significa cada métrica</DialogTitle>
          <DialogDescription>Fórmula, período de cálculo e limitações conhecidas de cada indicador desta tela.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {(metricas ?? []).map(m => (
            <div key={m.id} className="border-b border-slate-100 pb-3 last:border-0">
              <p className="text-sm font-bold text-slate-800">{m.nome}</p>
              <p className="text-xs text-slate-600 mt-1"><span className="font-semibold">Fórmula:</span> {m.formula}</p>
              <p className="text-xs text-slate-500 mt-0.5"><span className="font-semibold">Período:</span> {m.periodo}</p>
              {m.limitacoes && m.limitacoes !== "—" && (
                <p className="text-xs text-amber-600 mt-0.5"><span className="font-semibold">Limitações:</span> {m.limitacoes}</p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ficha do cliente (modal) ─────────────────────────────────────────────────

function FichaClienteModal({ empresaKey, onClose }: { empresaKey: string | null; onClose: () => void }) {
  const { data, isLoading } = trpc.performanceComercial.getFichaCliente.useQuery(
    { empresaKey: empresaKey ?? "" },
    { enabled: !!empresaKey }
  );

  return (
    <Dialog open={!!empresaKey} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        {isLoading && <p className="text-sm text-slate-500 py-8 text-center">Carregando ficha...</p>}
        {!isLoading && data && (
          <>
            <DialogHeader>
              <DialogTitle>{data.empresaExibicao}</DialogTitle>
              {data.analise && (
                <DialogDescription>
                  <Badge className={CLASSIFICACAO_INFO[data.analise.classificacao]?.cor ?? ""}>
                    {CLASSIFICACAO_INFO[data.analise.classificacao]?.icone} {CLASSIFICACAO_INFO[data.analise.classificacao]?.label}
                  </Badge>
                  {data.analise.confiancaClassificacao === "baixa" && (
                    <span className="ml-2 text-[11px] text-amber-600">(amostra pequena — classificação de baixa confiança)</span>
                  )}
                </DialogDescription>
              )}
            </DialogHeader>
            {data.analise && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Compras válidas</p>
                  <p className="text-lg font-bold text-slate-800">{data.analise.totalComprasValidas}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Última compra</p>
                  <p className="text-sm font-bold text-slate-800">{fmtDate(data.analise.ultimaCompra)}</p>
                  <p className="text-[10px] text-slate-400">{data.analise.diasDesdeUltimaCompra} dias atrás</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Intervalo típico</p>
                  <p className="text-sm font-bold text-slate-800">{data.analise.medianaIntervaloDias ? `${Math.round(data.analise.medianaIntervaloDias)} dias` : "—"}</p>
                  <p className="text-[10px] text-slate-400">{data.analise.qtdIntervalos} intervalo(s)</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Margem histórica</p>
                  <p className="text-sm font-bold text-slate-800">{data.analise.margemHistoricaPct !== null ? fmtPct(data.analise.margemHistoricaPct) : "indisponível"}</p>
                </div>
              </div>
            )}
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Histórico de pedidos ({data.historico.length})</p>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead>Vendedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...data.historico].reverse().map((h, i) => (
                  <TableRow key={i}>
                    <TableCell>{fmtDate(h.data)}</TableCell>
                    <TableCell>{h.osNumero}</TableCell>
                    <TableCell className="text-right">{fmtBrl(h.valor)}</TableCell>
                    <TableCell className="text-right">
                      {h.contribuicao !== null && h.valor > 0 ? fmtPct((h.contribuicao / h.valor) * 100) : "—"}
                    </TableCell>
                    <TableCell>{h.vendedor}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Vista: Visão Geral ────────────────────────────────────────────────────────

function VistaVisaoGeral({ dataInicial, dataFinal }: { dataInicial: string; dataFinal: string }) {
  const [showDicionario, setShowDicionario] = useState(false);
  const { data, isLoading } = trpc.performanceComercial.getVisaoGeralClientes.useQuery({ dataInicial, dataFinal });
  const vg = data?.visaoGeral;

  if (isLoading) {
    return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 h-24 animate-pulse" />)}</div>;
  }
  if (!vg || vg.clientesCompradoresPeriodo === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Users /></EmptyMedia>
            <EmptyTitle>Sem clientes compradores no período</EmptyTitle>
            <EmptyDescription>Escolha outro período de análise.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Base de clientes — {formatarPeriodo(dataInicial.slice(0, 7), dataFinal.slice(0, 7))}
        </p>
        <button onClick={() => setShowDicionario(true)} className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-semibold">
          <HelpCircle className="w-3.5 h-3.5" /> O que significa isso?
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Clientes compradores" value={fmtNum(vg.clientesCompradoresPeriodo)} sub="Empresas com pedido válido no período" color="#3b82f6" />
        <KpiCard icon={UserPlus} label="Primeira compra observada" value={fmtNum(vg.primeiraCompraObservada)} sub="Sem histórico anterior no sistema" color="#22c55e" />
        <KpiCard icon={Repeat} label="Recompra no período" value={fmtNum(vg.recompraNoPeriodo)} sub="Já haviam comprado antes" color="#8b5cf6" />
        <KpiCard icon={ShoppingCart} label="Ticket médio" value={vg.ticketMedioPedido !== null ? fmtBrl(vg.ticketMedioPedido) : "—"} sub={`${fmtNum(vg.qtdPedidosValidos)} pedidos válidos`} color="#0ea5e9" />
        <KpiCard icon={Trophy} label="Concentração (top 20%)" value={vg.concentracaoTop20PctReceitaPct !== null ? fmtPct(vg.concentracaoTop20PctReceitaPct) : "—"} sub={`${vg.concentracaoTop20PctClientes} clientes concentram esse valor`} color={vg.concentracaoTop20PctReceitaPct && vg.concentracaoTop20PctReceitaPct > 60 ? "#ef4444" : "#f59e0b"} />
        <KpiCard
          icon={DollarSign} label="Margem de contribuição" value={vg.margemContribuicaoPct !== null ? fmtPct(vg.margemContribuicaoPct) : "indisponível"}
          sub={vg.margemContribuicaoCobertura === "completa" ? "Cobertura completa" : vg.margemContribuicaoCobertura === "parcial" ? "Cobertura parcial — alguns pedidos sem custo" : "Sem pedidos com custo conhecido"}
          color="#14b8a6"
        />
        <KpiCard icon={AlertTriangle} label="Intervalo acima do habitual" value={fmtNum(vg.classificacoes.intervalo_acima_habitual)} sub="Clientes com sinal de atraso na recompra" color="#f59e0b" />
        <KpiCard icon={TrendingDown} label="Redução de volume" value={fmtNum(vg.classificacoes.reducao_volume)} sub="Comprando menos que na janela anterior" color="#ef4444" />
      </div>

      <SecaoTempoFollowUp />
      <SecaoConversaoPorFaixaTicket />

      <SecaoRecompraNovosReativados dataInicial={dataInicial} dataFinal={dataFinal} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Top clientes por valor comprado no período</h3>
          {vg.amostraPequena && <p className="text-xs text-amber-600 mt-0.5">Amostra pequena ({vg.clientesCompradoresPeriodo} clientes) — RFM e rankings têm baixa confiabilidade estatística.</p>}
        </div>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vg.topClientesPorValor.map((c, i) => (
              <TableRow key={i}>
                <TableCell className="font-semibold">{c.empresa}</TableCell>
                <TableCell className="text-right">{fmtBrl(c.valor)}</TableCell>
                <TableCell className="text-right">{c.qtdPedidos}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DicionarioMetricasModal open={showDicionario} onOpenChange={setShowDicionario} metricas={data?.dicionarioMetricas} />
    </div>
  );
}

// ─── Seção: Recompra de Clientes Novos e Reativados ──────────────────────────

function SecaoRecompraNovosReativados({ dataInicial, dataFinal }: { dataInicial: string; dataFinal: string }) {
  const { data, isLoading } = trpc.performanceComercial.getRecompraNovosReativados.useQuery({ dataInicial, dataFinal });
  if (isLoading) return <div className="bg-white rounded-xl border border-slate-200 h-40 animate-pulse" />;
  if (!data) return null;

  const grupos: Array<{ chave: "novos" | "reativados"; label: string; icone: string }> = [
    { chave: "novos", label: "Clientes Novos", icone: "🆕" },
    { chave: "reativados", label: "Clientes Reativados", icone: "🔄" },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-700">Recompra — Clientes Novos e Reativados</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Novo: nunca comprou antes do período. Reativado: última compra {data.mesesInatividadeParaReativado}+ meses antes do período.
          Recompra é medida até hoje, não só dentro do período.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {grupos.map(g => {
          const grupo = data[g.chave];
          return (
            <div key={g.chave} className="p-4">
              <p className="text-xs font-bold text-slate-600 mb-2">{g.icone} {g.label} ({grupo.total})</p>
              {grupo.total === 0 ? (
                <p className="text-xs text-slate-400">Nenhum cliente nesta categoria no período.</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-2xl font-bold text-slate-800">{grupo.taxaPct !== null ? fmtPct(grupo.taxaPct) : "—"}</span>
                    <span className="text-xs text-slate-400">recompraram ({grupo.comRecompra} de {grupo.total})</span>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-3 py-2 mb-3">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Faturamento no período</p>
                    <p className="text-lg font-bold text-slate-800">{fmtBrl(grupo.faturamentoNoPeriodo)}</p>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-1">Quantidade de compras desde então</p>
                    <p className="w-24 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest" title="Soma do valor gasto nas compras subsequentes à qualificação (recompras) — não conta a compra de entrada">
                      Gasto em recompras
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {grupo.distribuicaoQtdCompras.map(f => (
                      <div key={f.faixa} className="flex items-center gap-2 text-xs">
                        <span className="w-14 text-slate-500 font-mono">{f.faixa}x</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full" style={{ width: `${f.pct}%` }} />
                        </div>
                        <span className="w-20 text-right text-slate-600">{f.quantidade} ({fmtPct(f.pct)})</span>
                        <span className="w-24 text-right text-slate-500 font-mono">
                          {f.faixa === "1" ? "—" : fmtBrl(f.valorRecompras)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Vista: Clientes ────────────────────────────────────────────────────────

/** Modal para o vendedor confirmar que entrou em contato com o cliente,
 * com observação livre opcional — fica visível para o gestor na aba Equipe. */
function ConfirmarContatoModal({ cliente, onClose, onConfirm, isPending }: {
  cliente: { empresaKey: string; empresaExibicao: string } | null;
  onClose: () => void;
  onConfirm: (observacao: string) => void;
  isPending: boolean;
}) {
  const [observacao, setObservacao] = useState("");
  useEffect(() => { setObservacao(""); }, [cliente?.empresaKey]);

  return (
    <Dialog open={!!cliente} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirmar contato — {cliente?.empresaExibicao}</DialogTitle>
          <DialogDescription>Registra que você entrou em contato com este cliente. Fica visível para o gestor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <textarea
            value={observacao} onChange={e => setObservacao(e.target.value)}
            placeholder="O que foi conversado? (opcional)" rows={3}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none"
          />
          <button
            onClick={() => onConfirm(observacao)}
            disabled={isPending}
            className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg"
          >
            {isPending ? "Salvando..." : "Confirmar contato realizado"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function diasAtras(data: string | Date): number {
  const d = typeof data === "string" ? new Date(data) : data;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
}

function VistaClientes({ dataInicial, dataFinal }: { dataInicial: string; dataFinal: string }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "master" || user?.role === "gestor";
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string | null>(null);
  const [diasMin, setDiasMin] = useState("");
  const [diasMax, setDiasMax] = useState("");
  const [ordenarPorTicket, setOrdenarPorTicket] = useState(false);
  const [filtroVendedor, setFiltroVendedor] = useState("");
  const [contatandoCliente, setContatandoCliente] = useState<{ empresaKey: string; empresaExibicao: string } | null>(null);
  const { data, isLoading } = trpc.performanceComercial.listarClientesInteligencia.useQuery({ dataInicial, dataFinal });
  const utils = trpc.useUtils();
  const { data: contatos } = trpc.performanceComercial.getContatosClientes.useQuery({ limite: 500 });
  const registrarContatoMut = trpc.performanceComercial.registrarContatoCliente.useMutation({
    onSuccess: () => {
      utils.performanceComercial.getContatosClientes.invalidate();
      setContatandoCliente(null);
    },
  });

  // Vendedor comum vê por padrão só a própria carteira; gestor/admin vê todos
  // e pode trocar — mesmo padrão de client/src/pages/comercial/CRM.tsx.
  useEffect(() => {
    if (user && !isAdmin) setFiltroVendedor(user.name ?? "");
  }, [user, isAdmin]);

  const vendedores = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.map(c => c.vendedor))].sort();
  }, [data]);

  const ultimoContatoPorCliente = useMemo(() => {
    const mapa = new Map<string, { vendedor: string; contatadoEm: string; observacao: string | null }>();
    for (const c of contatos ?? []) {
      const atual = mapa.get(c.empresaKey);
      if (!atual || new Date(c.contatadoEm) > new Date(atual.contatadoEm)) {
        mapa.set(c.empresaKey, { vendedor: c.vendedor, contatadoEm: c.contatadoEm as unknown as string, observacao: c.observacao });
      }
    }
    return mapa;
  }, [contatos]);

  const filtrados = useMemo(() => {
    if (!data) return [];
    const min = diasMin !== "" ? Number(diasMin) : null;
    const max = diasMax !== "" ? Number(diasMax) : null;
    let lista = data.filter(c =>
      (min === null || c.diasDesdeUltimaCompra >= min) &&
      (max === null || c.diasDesdeUltimaCompra <= max) &&
      (filtroVendedor === "" || c.vendedor === filtroVendedor)
    );
    if (ordenarPorTicket) lista = [...lista].sort((a, b) => b.ticketMedioHistorico - a.ticketMedioHistorico);
    return lista;
  }, [data, diasMin, diasMax, ordenarPorTicket, filtroVendedor]);

  const distribuicaoClassificacao = useMemo(() => {
    const contagem: Record<string, number> = {};
    for (const chave of ORDEM_CLASSIFICACOES) contagem[chave] = 0;
    for (const c of filtrados) contagem[c.classificacao] = (contagem[c.classificacao] ?? 0) + 1;
    const total = filtrados.length;
    return ORDEM_CLASSIFICACOES.map(chave => ({
      chave,
      label: CLASSIFICACAO_INFO[chave].label,
      quantidade: contagem[chave],
      pct: total > 0 ? (contagem[chave] / total) * 100 : 0,
    }));
  }, [filtrados]);

  if (isLoading) return <div className="bg-white rounded-xl border border-slate-200 h-64 animate-pulse" />;
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10">
        <Empty><EmptyHeader><EmptyMedia variant="icon"><Users /></EmptyMedia><EmptyTitle>Sem clientes no período</EmptyTitle></EmptyHeader></Empty>
      </div>
    );
  }

  return (
    <div className="space-y-3" id="painel-clientes-print">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #painel-clientes-print, #painel-clientes-print * { visibility: visible; }
          #painel-clientes-print { position: absolute; left: 0; top: 0; width: 100%; padding: 12px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500"><SlidersHorizontal className="w-3.5 h-3.5" /> Faixa de dias sem compra:</span>
        <input type="number" min={0} placeholder="mín" value={diasMin} onChange={e => setDiasMin(e.target.value)} className="w-20 text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
        <span className="text-xs text-slate-400">até</span>
        <input type="number" min={0} placeholder="máx" value={diasMax} onChange={e => setDiasMax(e.target.value)} className="w-20 text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
        {(diasMin !== "" || diasMax !== "") && (
          <button onClick={() => { setDiasMin(""); setDiasMax(""); }} className="text-[11px] text-slate-400 hover:text-slate-600 underline">limpar</button>
        )}
        <div className="w-px h-5 bg-slate-200" />
        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
        <select
          value={filtroVendedor}
          onChange={e => setFiltroVendedor(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
        >
          <option value="">Todos os vendedores</option>
          {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <div className="w-px h-5 bg-slate-200" />
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 cursor-pointer">
          <input type="checkbox" checked={ordenarPorTicket} onChange={e => setOrdenarPorTicket(e.target.checked)} />
          Priorizar por faturamento médio (ticket histórico)
        </label>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg"
        >
          <Printer className="w-3.5 h-3.5" /> Imprimir PDF
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-700">Visão geral por classificação</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {filtroVendedor ? `Carteira de ${filtroVendedor}` : "Toda a carteira"} — {fmtNum(filtrados.length)} cliente{filtrados.length === 1 ? "" : "s"} no período selecionado{(diasMin !== "" || diasMax !== "") ? ", já considerando a faixa de dias sem compra" : ""}.
            </p>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">Sem clientes para montar o gráfico com os filtros atuais.</p>
        ) : (
          <div className="grid md:grid-cols-[minmax(0,260px)_1fr] gap-6 items-center">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribuicaoClassificacao.filter(d => d.quantidade > 0)}
                    dataKey="quantidade"
                    nameKey="label"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {distribuicaoClassificacao.filter(d => d.quantidade > 0).map(d => (
                      <Cell key={d.chave} fill={CLASSIFICACAO_INFO[d.chave].corHex} />
                    ))}
                  </Pie>
                  <ChartTooltip formatter={(value: number, _name, item: any) => [`${value} (${fmtPct(item.payload.pct)})`, item.payload.label]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {distribuicaoClassificacao.map(d => (
                <div key={d.chave} className="flex items-start gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: CLASSIFICACAO_INFO[d.chave].corHex }} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700">
                      {CLASSIFICACAO_INFO[d.chave].icone} {d.label} — {fmtNum(d.quantidade)} <span className="font-normal text-slate-400">({fmtPct(d.pct)})</span>
                    </p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{CLASSIFICACAO_INFO[d.chave].descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Clientes ({filtrados.length}{filtrados.length !== data.length ? ` de ${data.length}` : ""})</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Clique em um cliente para ver a ficha completa. {ordenarPorTicket ? "Ordenado por faturamento médio histórico." : "Ordenado por quem precisa de mais atenção primeiro."}
          </p>
        </div>
        {filtrados.length === 0 ? (
          <div className="p-8"><Empty><EmptyHeader><EmptyTitle>Nenhum cliente nessa faixa de dias</EmptyTitle></EmptyHeader></Empty></div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Probabilidade</TableHead>
                <TableHead className="text-right">Valor no período</TableHead>
                <TableHead className="text-right">Ticket médio histórico</TableHead>
                <TableHead className="text-right">Dias desde última compra</TableHead>
                <TableHead className="text-right">Razão de atraso</TableHead>
                <TableHead>Último contato</TableHead>
                <TableHead className="no-print" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map(c => {
                const contato = ultimoContatoPorCliente.get(c.empresaKey);
                return (
                  <TableRow key={c.empresaKey} className="cursor-pointer hover:bg-slate-50" onClick={() => setEmpresaSelecionada(c.empresaKey)}>
                    <TableCell className="font-semibold">{c.empresaExibicao}</TableCell>
                    <TableCell className="text-slate-500">{c.vendedor}</TableCell>
                    <TableCell>
                      <Badge className={CLASSIFICACAO_INFO[c.classificacao]?.cor ?? ""}>
                        {CLASSIFICACAO_INFO[c.classificacao]?.icone} {CLASSIFICACAO_INFO[c.classificacao]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell><ProbabilidadeBadge p={c.probabilidadeCompra} explicacao={c.probabilidadeExplicacao} /></TableCell>
                    <TableCell className="text-right">{fmtBrl(c.valorJanelaAtual)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtBrl(c.ticketMedioHistorico)}</TableCell>
                    <TableCell className="text-right">{c.diasDesdeUltimaCompra}</TableCell>
                    <TableCell className="text-right">{c.razaoAtraso !== null ? `${c.razaoAtraso.toFixed(1)}x` : "—"}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      {contato ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 text-emerald-700 cursor-default">
                                <CheckCircle2 className="w-3 h-3" /> {contato.vendedor} · há {diasAtras(contato.contatadoEm)}d
                              </span>
                            </TooltipTrigger>
                            {contato.observacao && (
                              <TooltipContent side="top" className="text-xs max-w-[240px]">{contato.observacao}</TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-slate-300">Sem registro</span>
                      )}
                    </TableCell>
                    <TableCell className="no-print" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setContatandoCliente({ empresaKey: c.empresaKey, empresaExibicao: c.empresaExibicao })}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold hover:bg-blue-100 whitespace-nowrap"
                        >
                          <MessageSquareText className="w-3 h-3" /> Confirmar contato
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 cursor-pointer" onClick={() => setEmpresaSelecionada(c.empresaKey)} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <FichaClienteModal empresaKey={empresaSelecionada} onClose={() => setEmpresaSelecionada(null)} />
        <ConfirmarContatoModal
          cliente={contatandoCliente}
          isPending={registrarContatoMut.isPending}
          onClose={() => setContatandoCliente(null)}
          onConfirm={observacao => {
            if (!contatandoCliente) return;
            registrarContatoMut.mutate({
              empresaKey: contatandoCliente.empresaKey,
              empresa: contatandoCliente.empresaExibicao,
              observacao: observacao || undefined,
            });
          }}
        />
      </div>
    </div>
  );
}

// ─── Vista: Fila de Ações ──────────────────────────────────────────────────────

/** Modal simples para escolher o resultado do contato ao concluir uma ação —
 * substitui o antigo window.prompt() de texto livre pelas opções estruturadas
 * do enum inteligencia_acao_resultado (seção 8 do prompt de origem). */
function ConcluirAcaoModal({ acaoId, onClose, onConfirm }: {
  acaoId: number | null; onClose: () => void;
  onConfirm: (resultado: string, observacao: string) => void;
}) {
  const [resultado, setResultado] = useState("contato_realizado");
  const [observacao, setObservacao] = useState("");
  useEffect(() => { setResultado("contato_realizado"); setObservacao(""); }, [acaoId]);

  return (
    <Dialog open={acaoId !== null} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Concluir ação — qual foi o resultado?</DialogTitle>
          <DialogDescription>Use isso depois de já ter contatado o cliente, não antes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <select value={resultado} onChange={e => setResultado(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
            {RESULTADO_OPCOES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <textarea
            value={observacao} onChange={e => setObservacao(e.target.value)}
            placeholder="Observação (opcional)" rows={2}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none"
          />
          <button
            onClick={() => onConfirm(resultado, observacao)}
            className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg"
          >
            Confirmar conclusão
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VistaFilaAcoes() {
  const [filtroStatus, setFiltroStatus] = useState<string>("pendente");
  const [filtroVendedor, setFiltroVendedor] = useState<string>("");
  const [concluindoId, setConcluindoId] = useState<number | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.performanceComercial.getFilaAcoesClientes.useQuery({
    status: (filtroStatus as any) || undefined,
    vendedor: filtroVendedor || undefined,
  });
  const { data: vendedores } = trpc.performanceComercial.getVendedoresFilaAcoes.useQuery();
  const atualizarMut = trpc.performanceComercial.atualizarAcaoCliente.useMutation({
    onSuccess: () => utils.performanceComercial.getFilaAcoesClientes.invalidate(),
  });
  const gerarPdfMut = trpc.performanceComercial.gerarFilaAcoesPdf.useMutation({
    onSuccess: (res) => {
      const binario = atob(res.pdfBase64);
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url; link.download = res.fileName; link.click();
      URL.revokeObjectURL(url);
      setGerandoPdf(false);
    },
    onError: () => setGerandoPdf(false),
  });

  function handleGerarPdf() {
    setGerandoPdf(true);
    gerarPdfMut.mutate({ status: (filtroStatus as any) || undefined, vendedor: filtroVendedor || undefined });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          {["pendente", "adiada", "concluida", "descartada", ""].map(s => (
            <button
              key={s || "todas"}
              onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                filtroStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
              }`}
            >
              {s === "" ? "Todas" : s === "pendente" ? "Pendentes" : s === "adiada" ? "Adiadas" : s === "concluida" ? "Concluídas" : "Descartadas"}
            </button>
          ))}
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filtroVendedor}
            onChange={e => setFiltroVendedor(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
          >
            <option value="">Todos os vendedores</option>
            {(vendedores ?? []).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <button
          onClick={handleGerarPdf}
          disabled={gerandoPdf || !data || data.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" /> {gerandoPdf ? "Gerando..." : "Gerar PDF"}
        </button>
      </div>

      {isLoading && <div className="bg-white rounded-xl border border-slate-200 h-40 animate-pulse" />}
      {!isLoading && (!data || data.length === 0) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10">
          <Empty><EmptyHeader><EmptyMedia variant="icon"><CheckCircle2 /></EmptyMedia><EmptyTitle>Nenhuma ação nesta situação</EmptyTitle></EmptyHeader></Empty>
        </div>
      )}
      <div className="space-y-3">
        {(data ?? []).map(acao => (
          <div key={acao.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge className={TIPO_ACAO_INFO[acao.tipo]?.cor ?? ""}>{TIPO_ACAO_INFO[acao.tipo]?.label}</Badge>
                  <span className="text-[10px] text-slate-400 font-mono">prioridade {acao.prioridade}</span>
                  {acao.vendedor && <span className="text-[10px] text-slate-400">· vendedor: {acao.vendedor}</span>}
                </div>
                <p className="text-sm font-bold text-slate-800">{acao.titulo}</p>
                <p className="text-xs text-slate-500 mt-1">{acao.motivo}</p>
                {acao.proximoPasso && <p className="text-xs text-blue-600 mt-1">Próximo passo: {acao.proximoPasso}</p>}
              </div>
              {acao.status === "pendente" && (
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => setConcluindoId(acao.id)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-[11px] font-bold hover:bg-green-100"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Concluir
                  </button>
                  <button
                    onClick={() => atualizarMut.mutate({ id: acao.id, status: "adiada", prazo: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) })}
                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-bold hover:bg-amber-100"
                  >
                    <Clock3 className="w-3 h-3" /> Adiar 7d
                  </button>
                  <button
                    onClick={() => atualizarMut.mutate({ id: acao.id, status: "descartada" })}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-bold hover:bg-slate-100"
                  >
                    <XCircle className="w-3 h-3" /> Descartar
                  </button>
                </div>
              )}
              {acao.status !== "pendente" && (
                <Badge className="bg-slate-100 text-slate-500 border-slate-200">
                  {acao.status === "concluida" ? `Concluída${acao.resultado ? " — " + (RESULTADO_OPCOES.find(r => r.value === acao.resultado)?.label ?? acao.resultado) : ""}` : acao.status === "adiada" ? `Adiada até ${fmtDate(acao.prazo)}` : "Descartada"}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
      <ConcluirAcaoModal
        acaoId={concluindoId}
        onClose={() => setConcluindoId(null)}
        onConfirm={(resultado, observacao) => {
          if (concluindoId === null) return;
          atualizarMut.mutate({ id: concluindoId, status: "concluida", resultado: resultado as any, resultadoObservacao: observacao || undefined });
          setConcluindoId(null);
        }}
      />
    </div>
  );
}

// ─── Vista: Funil de Orçamentos ────────────────────────────────────────────────

/** Soma o `percentual` de data.distribuicaoDias para dias no intervalo
 * [deDias, ateDias] (ambos inclusive) — usado para transformar o gráfico de
 * distribuição em números diretos ("fecha em até X dias: Y%"), já que o
 * usuário achou o gráfico difícil de ler e os cards de percentil (P25-P75,
 * P90, Mín-Máx) pouco úteis no dia a dia (13/09/2026). */
function pctAcumulado(distribuicaoDias: { dias: number; percentual: number }[], deDias: number, ateDias: number): number {
  return distribuicaoDias
    .filter(d => d.dias >= deDias && d.dias <= ateDias)
    .reduce((s, d) => s + d.percentual, 0);
}

// Cores por faixa consistentes com CRM.tsx/ScriptsFaixaPopover (1=amarelo, 2=rosa, 3=laranja).
const FAIXA_OVERLAY_COR: Record<1 | 2 | 3, string> = { 1: "#facc15", 2: "#f472b6", 3: "#fb923c" };

/** Acha o label do balde de distribuicaoDias correspondente a um dia (1-indexado).
 * Dias além do maior balde nomeado caem na cauda ("10+du") — usa o último balde. */
function labelDoDia(dist: { dias: number; label: string }[], dia: number): string | undefined {
  const exato = dist.find(d => d.dias === dia);
  if (exato) return exato.label;
  return dist.length > 0 ? dist[dist.length - 1].label : undefined;
}

function SecaoTempoFollowUp() {
  const { data, isLoading } = trpc.performanceComercial.getTempoOrcamentoPedido.useQuery();
  const { data: faixasConfig } = trpc.crm.getFaixaEtiquetas.useQuery();
  if (isLoading) return <div className="bg-white rounded-xl border border-slate-200 h-40 animate-pulse" />;
  if (!data) return null;

  const dist = data.distribuicaoDias ?? [];
  const ateUmDia = pctAcumulado(dist, 0, 1);
  const ateTresDias = pctAcumulado(dist, 0, 3);
  const ateSeteDias = pctAcumulado(dist, 0, 7);
  const depoisDeSeteDias = Math.max(0, 100 - ateSeteDias);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-700">Prazo de fechamento: orçamento → pedido (dias úteis)</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Quanto tempo, em dias úteis (seg-sex), leva entre o orçamento ser aberto e virar pedido — use isso para calibrar até quando um follow-up ainda faz sentido.
        </p>
        <p className="text-xs text-amber-600 mt-1">
          Aproximação: o ERP não guarda o vínculo direto entre orçamento e pedido — este número casa cada orçamento aprovado com a OS mais próxima da mesma empresa, dentro de {JANELA_MAXIMA_DIAS_LABEL} dias corridos. Não desconta feriados, só fins de semana. Trate como estimativa, não fato confirmado.
        </p>
      </div>
      {data.amostra === 0 ? (
        <div className="p-6 text-xs text-slate-400">Amostra insuficiente para calcular (nenhum orçamento pareado com uma OS).</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 p-4">
            <KpiCard icon={Clock3} label="Mediana" value={data.medianaDias !== null ? `${Math.round(data.medianaDias)}du` : "—"} sub="Metade fecha em até este prazo" color="#0ea5e9" />
            <KpiCard icon={Clock3} label="Fecha em até 1 dia" value={dist.length > 0 ? fmtPct(ateUmDia) : "—"} sub="Dos casos decididos" color="#0ea5e9" />
            <KpiCard icon={Clock3} label="Fecha em até 3 dias" value={dist.length > 0 ? fmtPct(ateTresDias) : "—"} sub="Acumulado desde o dia 0" color="#38bdf8" />
            <KpiCard icon={Clock3} label="Fecha em até 7 dias" value={dist.length > 0 ? fmtPct(ateSeteDias) : "—"} sub="Acumulado desde o dia 0" color="#8b5cf6" />
            <KpiCard icon={Clock3} label="Depois de 7 dias" value={dist.length > 0 ? fmtPct(depoisDeSeteDias) : "—"} sub={data.maxDias !== null ? `Cauda longa — até ${data.maxDias}du no pior caso` : "Cauda longa"} color="#f59e0b" />
            <KpiCard icon={Clock3} label="Taxa de pareamento" value={data.taxaPareamentoPct !== null ? fmtPct(data.taxaPareamentoPct) : "—"} sub={`Amostra: ${data.amostra} de ${data.totalOrcamentosGanhos}`} color={data.taxaPareamentoPct && data.taxaPareamentoPct >= 50 ? "#22c55e" : "#f59e0b"} />
          </div>
          {data.distribuicaoDias && data.distribuicaoDias.length > 0 && (
            <div className="px-4 pb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Distribuição: % dos casos que fecham em cada dia útil
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.distribuicaoDias} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={v => `${v}%`}
                    width={36}
                  />
                  <ChartTooltip
                    formatter={(v: number, _n, item: any) => [`${v.toFixed(1)}% (${item.payload.quantidade} casos)`, "% da amostra"]}
                    labelFormatter={label => `Fecha em ${label}`}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Bar dataKey="percentual" radius={[3, 3, 0, 0]}>
                    {data.distribuicaoDias.map((d, i) => (
                      <Cell key={i} fill={d.dias === 0 ? "#0ea5e9" : "#38bdf8"} />
                    ))}
                  </Bar>
                  {faixasConfig && ([1, 2, 3] as const).map(n => {
                    const f = faixasConfig[n];
                    const x1 = labelDoDia(dist, f.diasInicio);
                    const x2 = labelDoDia(dist, f.diasFim);
                    if (!x1 || !x2) return null;
                    return (
                      <ReferenceArea
                        key={n}
                        x1={x1}
                        x2={x2}
                        fill={FAIXA_OVERLAY_COR[n]}
                        fillOpacity={0.14}
                        stroke={FAIXA_OVERLAY_COR[n]}
                        strokeOpacity={0.4}
                        ifOverflow="extendDomain"
                        label={{ value: f.label, position: "insideTop", fontSize: 9, fill: FAIXA_OVERLAY_COR[n] }}
                      />
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-slate-400 mt-1">
                Último balde ("{data.distribuicaoDias[data.distribuicaoDias.length - 1].label}") agrupa toda a cauda longa.
                {faixasConfig && " As faixas sombreadas mostram as faixas de follow-up configuradas atualmente (editável abaixo)."}
              </p>
            </div>
          )}
          {data.sugestaoFollowUpDias && (
            <div className="px-4 pb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Prazo sugerido de follow-up (dias úteis, baseado nos percentis reais)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-blue-700">{data.sugestaoFollowUpDias.primeiro}du</p>
                  <p className="text-[10px] text-blue-500">1º contato</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-blue-700">{data.sugestaoFollowUpDias.segundo}du</p>
                  <p className="text-[10px] text-blue-500">2º contato</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-blue-700">{data.sugestaoFollowUpDias.terceiro}du</p>
                  <p className="text-[10px] text-blue-500">3º contato (último antes de considerar perdido)</p>
                </div>
              </div>
            </div>
          )}
          <div className="px-4 pb-4 pt-1 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Faixas de follow-up do CRM — ajuste com base na distribuição acima
            </p>
            <FaixaDiasConfigForm variant="compact" />
          </div>
        </>
      )}
    </div>
  );
}

function SecaoConversaoPorFaixaTicket() {
  const { data, isLoading } = trpc.performanceComercial.getConversaoPorFaixaTicket.useQuery();
  if (isLoading) return <div className="bg-white rounded-xl border border-slate-200 h-40 animate-pulse" />;
  if (!data) return null;
  const totalDecidido = data.reduce((s, f) => s + f.ganhos + f.perdidos, 0);
  if (totalDecidido === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-700">Conversão por faixa de tíquete</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Dos orçamentos já decididos (ganhos + perdidos), qual % fecha em cada faixa de valor — quanto maior o tíquete, menor a taxa de fechamento histórica. Esse mesmo efeito também entra como fator no Score de Probabilidade de Compra.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4 p-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="faixa" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `${v}%`} width={36} />
            <ChartTooltip
              formatter={(v: number, _n, item: any) => [`${v.toFixed(1)}% (${item.payload.ganhos}G / ${item.payload.perdidos}P)`, "Conversão"]}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
            <Bar dataKey="taxaConversaoPct" radius={[3, 3, 0, 0]}>
              {data.map((f, i) => (
                <Cell key={i} fill={f.taxaConversaoPct == null ? "#e2e8f0" : f.taxaConversaoPct >= 45 ? "#22c55e" : f.taxaConversaoPct >= 25 ? "#f59e0b" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Faixa</TableHead>
              <TableHead className="text-right">Ganhos</TableHead>
              <TableHead className="text-right">Perdidos</TableHead>
              <TableHead className="text-right">Conversão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(f => (
              <TableRow key={f.faixa}>
                <TableCell className="font-medium">{f.faixa}</TableCell>
                <TableCell className="text-right">{fmtNum(f.ganhos)}</TableCell>
                <TableCell className="text-right">{fmtNum(f.perdidos)}</TableCell>
                <TableCell className="text-right font-bold">{f.taxaConversaoPct !== null ? fmtPct(f.taxaConversaoPct) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const JANELA_MAXIMA_DIAS_LABEL = 90;

function VistaFunil() {
  const { data, isLoading } = trpc.performanceComercial.getFunilOrcamentos.useQuery();
  if (isLoading) return <div className="bg-white rounded-xl border border-slate-200 h-64 animate-pulse" />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
        {data.cobertura.observacao} (dados de {data.cobertura.anoInicio === data.cobertura.anoFim ? data.cobertura.anoInicio : `${data.cobertura.anoInicio}–${data.cobertura.anoFim}`})
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Percent} label="Taxa de conversão histórica" value={data.taxaConversao.taxaPct !== null ? fmtPct(data.taxaConversao.taxaPct) : "sem decisões"} sub={`${data.taxaConversao.decididoGanho} ganhos / ${data.taxaConversao.decididoPerdido} perdidos`} color="#22c55e" />
        <KpiCard icon={AlertTriangle} label="Decisões vencidas" value={fmtNum(data.decisoesVencidas.quantidade)} sub={fmtBrl(data.decisoesVencidas.valor)} color="#ef4444" />
        <KpiCard icon={HelpCircle} label="Aprovado, depois cancelado" value={fmtNum(data.taxaConversao.aprovadoMasCanceladoDepois)} sub="Fora do cálculo de conversão" color="#94a3b8" />
        <KpiCard icon={Layers} label="Status distintos" value={fmtNum(data.porStatus.length)} sub="Etapas usadas pela equipe" color="#8b5cf6" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-700">Orçamentos por status</h3></div>
        <Table className="text-xs">
          <TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.porStatus.map(s => (
              <TableRow key={s.status}><TableCell className="font-semibold">{s.status}</TableCell><TableCell className="text-right">{s.quantidade}</TableCell><TableCell className="text-right">{fmtBrl(s.valor)}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-700">Idade dos orçamentos "Em aberto"</h3></div>
        <Table className="text-xs">
          <TableHeader><TableRow><TableHead>Faixa</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.emAbertoPorIdadeDias.map(f => (
              <TableRow key={f.faixa}><TableCell>{f.faixa}</TableCell><TableCell className="text-right">{f.quantidade}</TableCell><TableCell className="text-right">{fmtBrl(f.valor)}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data.perdasComMotivo.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-700">Perdas com motivo registrado</h3></div>
          <Table className="text-xs">
            <TableHeader><TableRow><TableHead>Motivo</TableHead><TableHead className="text-right">Quantidade</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.perdasComMotivo.map(m => (
                <TableRow key={m.motivo}><TableCell>{m.motivo}</TableCell><TableCell className="text-right">{m.quantidade}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Vista: Previsões ────────────────────────────────────────────────────────

function VistaPrevisoes() {
  const { data, isLoading } = trpc.performanceComercial.getPrevisaoComercial.useQuery();
  if (isLoading) return <div className="bg-white rounded-xl border border-slate-200 h-64 animate-pulse" />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
        {data.premissas.map((p, i) => <p key={i} className="text-xs text-blue-700">• {p}</p>)}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-700">Carteira confirmada × oportunidades abertas (estimativa)</h3></div>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Faixa (dias)</TableHead>
              <TableHead className="text-right">Carteira confirmada</TableHead>
              <TableHead className="text-right">Oportunidades abertas (estimativa)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.faixas.map(f => (
              <TableRow key={f.faixa}>
                <TableCell className="font-semibold">{f.faixa}</TableCell>
                <TableCell className="text-right">{fmtBrl(f.carteiraConfirmada)}</TableCell>
                <TableCell className="text-right text-slate-500">{fmtBrl(f.oportunidadesAbertasEstimativa)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">Sem prazo definido</TableCell>
              <TableCell className="text-right">{fmtBrl(data.carteiraConfirmadaSemPrazo)}</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Referência de sazonalidade (não é parcela somável)</h3>
          <p className="text-xs text-slate-400 mt-0.5">Média do faturamento no mesmo mês em anos anteriores — comparação, não estimativa a somar.</p>
        </div>
        <Table className="text-xs">
          <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Média histórica</TableHead><TableHead>Anos considerados</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.estimativaSazonalidade.map(e => (
              <TableRow key={e.mesAlvo}>
                <TableCell>{e.mesAlvo}</TableCell>
                <TableCell className="text-right">{e.mediaHistorica !== null ? fmtBrl(e.mediaHistorica) : "sem histórico"}</TableCell>
                <TableCell className="text-slate-400">{e.anosConsiderados.join(", ") || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Vista: Assistente de IA ──────────────────────────────────────────────────

interface MensagemChat { pergunta: string; resposta: string; }

function VistaAssistente({ dataInicial, dataFinal }: { dataInicial: string; dataFinal: string }) {
  const [pergunta, setPergunta] = useState("");
  const [historico, setHistorico] = useState<MensagemChat[]>([]);
  const perguntarMut = trpc.performanceComercial.perguntarInteligenciaClientes.useMutation({
    onSuccess: (res) => setHistorico(h => [...h, { pergunta, resposta: res.resposta }]),
  });

  function enviar() {
    if (!pergunta.trim() || perguntarMut.isPending) return;
    perguntarMut.mutate({ pergunta: pergunta.trim(), dataInicial, dataFinal });
    setPergunta("");
  }

  const SUGESTOES = [
    "Quais clientes eu preciso acompanhar hoje?",
    "Quais clientes aumentaram compras mas estão com margem baixa?",
    "Quanto dos próximos 60 dias está confirmado e quanto é estimativa?",
    "Explique o que é RFM e como foi aplicado aqui.",
  ];

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-700 flex items-start gap-2">
        <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        Responde só com base nos números já calculados para o período selecionado acima — não inventa clientes nem valores. Previsões e prioridades continuam sendo estimativas, não garantias.
      </div>

      {historico.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGESTOES.map(s => (
            <button key={s} onClick={() => setPergunta(s)} className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-purple-300 hover:text-purple-600">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {historico.map((m, i) => (
          <div key={i} className="space-y-2">
            <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-800 self-end max-w-[80%] ml-auto">{m.pergunta}</div>
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{m.resposta}</div>
          </div>
        ))}
        {perguntarMut.isPending && <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-400 animate-pulse">Pensando...</div>}
        {perguntarMut.isError && <p className="text-xs text-red-600">{(perguntarMut.error as any)?.message ?? "Erro ao perguntar."}</p>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-2">
        <input
          value={pergunta}
          onChange={e => setPergunta(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") enviar(); }}
          placeholder="Pergunte sobre os clientes deste período..."
          className="flex-1 text-sm border-none outline-none"
        />
        <button onClick={enviar} disabled={perguntarMut.isPending || !pergunta.trim()} className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Vista: Perfil de Clientes por CNPJ ───────────────────────────────────────

function VistaPerfilCnpj() {
  const [cnpjInputs, setCnpjInputs] = useState<Record<string, string>>({});
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const utils = trpc.useUtils();
  const filtroData = { dataInicial: dataInicial || undefined, dataFinal: dataFinal || undefined };
  const { data: agregado, isLoading: loadingAgregado } = trpc.perfilClientesCnpj.getPerfilAgregado.useQuery();
  const { data: semCnpj, isLoading: loadingSemCnpj } = trpc.perfilClientesCnpj.listarClientesSemCnpj.useQuery({ limite: 30, ...filtroData });
  const vincularMut = trpc.perfilClientesCnpj.vincularCnpj.useMutation({
    onSuccess: () => {
      utils.perfilClientesCnpj.getPerfilAgregado.invalidate();
      utils.perfilClientesCnpj.listarClientesSemCnpj.invalidate();
    },
  });
  const sincronizarMut = trpc.perfilClientesCnpj.sincronizarDeErpCache.useMutation({
    onSuccess: () => {
      utils.perfilClientesCnpj.getPerfilAgregado.invalidate();
      utils.perfilClientesCnpj.listarClientesSemCnpj.invalidate();
    },
  });
  const enriquecerMubisysMut = trpc.perfilClientesCnpj.enriquecerViaMubisys.useMutation({
    onSuccess: () => {
      utils.perfilClientesCnpj.getPerfilAgregado.invalidate();
      utils.perfilClientesCnpj.listarClientesSemCnpj.invalidate();
    },
  });

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
        O histórico de pedidos não guarda CNPJ dos clientes — o botão "Preencher automaticamente via MubiSys" consulta a API do ERP ao vivo (que traz o CNPJ de cada cliente) e enriquece direto, sem digitar nada. Todo número aqui é sobre a amostra já vinculada, não a carteira inteira — a cobertura é sempre mostrada.
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Filtrar por data de compra (opcional — aplica ao vincular e ao preenchimento automático)</p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={dataInicial} onChange={e => setDataInicial(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
          <span className="text-xs text-slate-400">até</span>
          <input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
          {(dataInicial || dataFinal) && (
            <button onClick={() => { setDataInicial(""); setDataFinal(""); }} className="text-[11px] text-slate-400 hover:text-slate-600 underline">limpar</button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => enriquecerMubisysMut.mutate({ limite: 15, ...filtroData })}
            disabled={enriquecerMubisysMut.isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
          >
            <Sparkles className="w-3.5 h-3.5" /> {enriquecerMubisysMut.isPending ? "Consultando o ERP..." : "Preencher automaticamente via MubiSys"}
          </button>
        </div>
        {enriquecerMubisysMut.data && (
          <p className="text-[11px] text-slate-500 mt-2">
            {enriquecerMubisysMut.data.sucessoCnpj} vinculados · {enriquecerMubisysMut.data.pessoaFisica} pessoa física (pulados) · {enriquecerMubisysMut.data.semDocumento} sem documento no ERP · {enriquecerMubisysMut.data.falhaErp} falha ao consultar OS · {enriquecerMubisysMut.data.falhaOpenCnpj} falha ao consultar CNPJ
            {enriquecerMubisysMut.data.restantes > 0 && ` · ${enriquecerMubisysMut.data.restantes} clientes restantes (clique de novo para continuar)`}
          </p>
        )}
        {enriquecerMubisysMut.isError && <p className="text-xs text-red-600 mt-2">{(enriquecerMubisysMut.error as any)?.message}</p>}
      </div>

      {loadingAgregado ? (
        <div className="bg-white rounded-xl border border-slate-200 h-40 animate-pulse" />
      ) : agregado && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cobertura</p>
                <p className="text-2xl font-bold text-slate-800">{fmtNum(agregado.totalMapeados)} <span className="text-sm text-slate-400 font-normal">de {fmtNum(agregado.totalClientesBase)} clientes ({fmtPct(agregado.coberturaPct)})</span></p>
              </div>
              <button
                onClick={() => sincronizarMut.mutate()}
                disabled={sincronizarMut.isPending}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
              >
                <Sparkles className="w-3.5 h-3.5" /> {sincronizarMut.isPending ? "Sincronizando..." : "Buscar CNPJs já conhecidos"}
              </button>
            </div>
            {sincronizarMut.data && (
              <p className="text-[11px] text-slate-500 mt-2">
                {sincronizarMut.data.sucesso} vinculados, {sincronizarMut.data.falha} falharam, de {sincronizarMut.data.tentativas} candidatos encontrados.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={CalendarDays} label="Fundadas há 3+ anos" value={agregado.pctIdadeMaior3Anos !== null ? fmtPct(agregado.pctIdadeMaior3Anos) : "—"} sub="Entre os clientes já vinculados" color="#22c55e" />
            <KpiCard icon={UserCheck} label="2+ sócios no QSA" value={agregado.pctDoisOuMaisSocios !== null ? fmtPct(agregado.pctDoisOuMaisSocios) : "—"} sub="Entre os clientes já vinculados" color="#8b5cf6" />
            <KpiCard icon={Users} label="Clientes vinculados" value={fmtNum(agregado.totalMapeados)} sub={`${fmtPct(agregado.coberturaPct)} da carteira`} color="#3b82f6" />
            <KpiCard icon={Trophy} label="Porte mais comum" value={agregado.distribuicaoPorte[0]?.chave ?? "—"} sub={agregado.distribuicaoPorte[0] ? fmtPct(agregado.distribuicaoPorte[0].pct) : ""} color="#f59e0b" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { titulo: "Distribuição por porte", dados: agregado.distribuicaoPorte },
              { titulo: "Distribuição por idade da empresa", dados: agregado.distribuicaoIdade.map(d => ({ chave: d.chave, quantidade: d.quantidade, pct: d.pct })) },
              { titulo: "Natureza jurídica (top 8)", dados: agregado.distribuicaoNaturezaJuridica },
              { titulo: "UF (top 8)", dados: agregado.distribuicaoUf },
            ].map(bloco => (
              <div key={bloco.titulo} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs font-bold text-slate-600 mb-2">{bloco.titulo}</p>
                {bloco.dados.length === 0 ? <p className="text-xs text-slate-400">Sem dados suficientes.</p> : (
                  <div className="space-y-1.5">
                    {bloco.dados.map(d => (
                      <div key={d.chave} className="flex items-center gap-2 text-xs">
                        <span className="w-28 truncate text-slate-600">{d.chave}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full" style={{ width: `${d.pct}%` }} />
                        </div>
                        <span className="w-16 text-right text-slate-500">{d.quantidade} ({fmtPct(d.pct)})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Vincular CNPJ manualmente</h3>
          <p className="text-xs text-slate-400 mt-0.5">Clientes com maior valor histórico comprado, ainda sem CNPJ vinculado.</p>
        </div>
        {loadingSemCnpj ? <div className="p-6 text-xs text-slate-400">Carregando...</div> : (
          <Table className="text-xs">
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Valor histórico</TableHead><TableHead>CNPJ</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(semCnpj ?? []).map(c => (
                <TableRow key={c.empresaKey}>
                  <TableCell className="font-semibold">{c.empresa}</TableCell>
                  <TableCell className="text-right">{fmtBrl(c.valorHistorico)}</TableCell>
                  <TableCell>
                    <input
                      value={cnpjInputs[c.empresaKey] ?? ""}
                      onChange={e => setCnpjInputs(prev => ({ ...prev, [c.empresaKey]: e.target.value }))}
                      placeholder="00.000.000/0001-00"
                      className="w-40 text-xs border border-slate-200 rounded-lg px-2 py-1"
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => vincularMut.mutate({ empresaKey: c.empresaKey, empresaExibicao: c.empresa, cnpj: cnpjInputs[c.empresaKey] ?? "" })}
                      disabled={!cnpjInputs[c.empresaKey] || vincularMut.isPending}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg"
                    >
                      Vincular
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {vincularMut.isError && <p className="text-xs text-red-600 p-3">{(vincularMut.error as any)?.message}</p>}
      </div>
    </div>
  );
}

// ─── Vista: Equipe (gestor) ────────────────────────────────────────────────────
// Pedido do gestor (13/09/2026): visibilidade de quem da equipe está de fato
// usando este painel, e das confirmações de contato registradas por cliente.
// Só aparece nas VISTAS para admin/master/gestor (ver componente principal).

const JANELAS_ACESSO = [7, 30, 90] as const;

function VistaEquipe() {
  const [janelaDias, setJanelaDias] = useState<number>(30);
  const [filtroVendedorContatos, setFiltroVendedorContatos] = useState("");
  const { data: acessos, isLoading: loadingAcessos } = trpc.performanceComercial.getAcessosInteligenciaClientes.useQuery({ dias: janelaDias });
  const { data: contatos, isLoading: loadingContatos } = trpc.performanceComercial.getContatosClientes.useQuery({
    vendedor: filtroVendedorContatos || undefined,
    limite: 200,
  });

  const vendedoresContato = useMemo(() => [...new Set((contatos ?? []).map(c => c.vendedor))].sort(), [contatos]);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Eye className="w-4 h-4 text-slate-400" /> Acessos ao painel</h3>
            <p className="text-xs text-slate-400 mt-0.5">Quem entrou na aba "Clientes" da Inteligência de Clientes e quando foi a última vez.</p>
          </div>
          <div className="flex items-center gap-1">
            {JANELAS_ACESSO.map(d => (
              <button
                key={d}
                onClick={() => setJanelaDias(d)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  janelaDias === d ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        {loadingAcessos ? (
          <div className="p-6 text-xs text-slate-400">Carregando...</div>
        ) : !acessos || acessos.length === 0 ? (
          <div className="p-8"><Empty><EmptyHeader><EmptyMedia variant="icon"><Eye /></EmptyMedia><EmptyTitle>Ninguém acessou este painel nos últimos {janelaDias} dias</EmptyTitle></EmptyHeader></Empty></div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead className="text-right">Acessos no período</TableHead>
                <TableHead>Último acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {acessos.map(a => (
                <TableRow key={a.userId}>
                  <TableCell className="font-semibold">{a.userName}</TableCell>
                  <TableCell className="text-right">{a.qtdAcessos}</TableCell>
                  <TableCell>{fmtDateTime(a.ultimoAcesso)} <span className="text-slate-400">(há {diasAtras(a.ultimoAcesso)}d)</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><MessageSquareText className="w-4 h-4 text-slate-400" /> Confirmações de contato</h3>
            <p className="text-xs text-slate-400 mt-0.5">Registros feitos pelos vendedores na aba "Clientes" (mais recentes primeiro, até 200).</p>
          </div>
          <select
            value={filtroVendedorContatos}
            onChange={e => setFiltroVendedorContatos(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
          >
            <option value="">Todos os vendedores</option>
            {vendedoresContato.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        {loadingContatos ? (
          <div className="p-6 text-xs text-slate-400">Carregando...</div>
        ) : !contatos || contatos.length === 0 ? (
          <div className="p-8"><Empty><EmptyHeader><EmptyMedia variant="icon"><MessageSquareText /></EmptyMedia><EmptyTitle>Nenhuma confirmação de contato registrada ainda</EmptyTitle></EmptyHeader></Empty></div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Quando</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contatos.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-semibold">{c.empresa}</TableCell>
                  <TableCell>{c.vendedor}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDateTime(c.contatadoEm)}</TableCell>
                  <TableCell className="text-slate-500 max-w-[320px] truncate" title={c.observacao ?? ""}>{c.observacao ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface InteligenteClientesProps {
  anoSelecionado: number;
}

function periodoInicialDoAno(ano: number): string {
  const atual = new Date();
  return ano === atual.getFullYear() ? `${ano}-${pad(atual.getMonth() + 1)}` : `${ano}-12`;
}

type Vista = "visao-geral" | "crescimento" | "clientes" | "fila" | "funil" | "previsoes" | "assistente" | "perfil-cnpj" | "equipe";

const VISTAS: Array<{ id: Vista; label: string; icon: string }> = [
  { id: "visao-geral", label: "Visão Geral", icon: "📊" },
  { id: "crescimento", label: "Crescimento e Resultado", icon: "📈" },
  { id: "clientes", label: "Clientes", icon: "👥" },
  { id: "fila", label: "Fila de Ações", icon: "✅" },
  { id: "funil", label: "Funil", icon: "🔻" },
  { id: "previsoes", label: "Previsões", icon: "🔮" },
  { id: "assistente", label: "Assistente", icon: "✨" },
  { id: "perfil-cnpj", label: "Perfil (CNPJ)", icon: "🏢" },
  { id: "equipe", label: "Equipe", icon: "🛡️" },
];

export default function InteligenteClientes({ anoSelecionado }: InteligenteClientesProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "master" || user?.role === "gestor";
  const [dataInicialMes, setDataInicialMes] = useState(() => periodoInicialDoAno(anoSelecionado));
  const [dataFinalMes, setDataFinalMes] = useState(() => periodoInicialDoAno(anoSelecionado));
  const [vista, setVista] = useState<Vista>("visao-geral");
  // "equipe" e "crescimento" ficam restritas a admin/master/gestor — esta última
  // mostra CAC, ROI, lucro/prejuízo e ponto de equilíbrio, dado sensível demais
  // pra ficar exposto a qualquer papel que um dia ganhe acesso a Performance
  // Comercial (hoje a página inteira já é admin-only, mas isso é reforço).
  const vistasVisiveis = useMemo(() => VISTAS.filter(v => (v.id !== "equipe" && v.id !== "crescimento") || isAdmin), [isAdmin]);

  // Registra 1 acesso por montagem — dá ao gestor visibilidade de quem de fato
  // usa este painel (aba "Equipe"). Falha silenciosa: não deve travar a tela.
  const registrarAcessoMut = trpc.performanceComercial.registrarAcessoInteligenciaClientes.useMutation();
  const acessoRegistradoRef = useRef(false);
  useEffect(() => {
    if (acessoRegistradoRef.current || !user) return;
    acessoRegistradoRef.current = true;
    registrarAcessoMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const anoRef = useRef(anoSelecionado);
  useEffect(() => {
    if (anoSelecionado !== anoRef.current) {
      anoRef.current = anoSelecionado;
      const periodo = periodoInicialDoAno(anoSelecionado);
      setDataInicialMes(periodo);
      setDataFinalMes(periodo);
    }
  }, [anoSelecionado]);

  const [anoFimCalc, mesFimCalc] = dataFinalMes.split("-").map(Number);
  const lastDay = new Date(anoFimCalc, mesFimCalc, 0).getDate();
  const dataInicial = `${dataInicialMes}-01`;
  const dataFinal = `${dataFinalMes}-${pad(lastDay)}`;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Período de Análise</p>
            <SeletorPeriodo dataInicial={dataInicialMes} dataFinal={dataFinalMes} onChange={(ini, fim) => { setDataInicialMes(ini); setDataFinalMes(fim); }} />
          </div>
          <p className="text-[11px] text-slate-400 max-w-xs text-right">
            Calculado direto do histórico local de OS (2023–hoje) — sem consulta à API do ERP, sem necessidade de congelar.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
        {vistasVisiveis.map(v => (
          <button
            key={v.id}
            onClick={() => setVista(v.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              vista === v.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            }`}
          >
            <span>{v.icon}</span><span>{v.label}</span>
          </button>
        ))}
      </div>

      {vista === "visao-geral" && <VistaVisaoGeral dataInicial={dataInicial} dataFinal={dataFinal} />}
      {vista === "crescimento" && isAdmin && <MarketingFinanceiro anoSel={anoSelecionado} />}
      {vista === "clientes" && <VistaClientes dataInicial={dataInicial} dataFinal={dataFinal} />}
      {vista === "fila" && <VistaFilaAcoes />}
      {vista === "funil" && <VistaFunil />}
      {vista === "previsoes" && <VistaPrevisoes />}
      {vista === "assistente" && <VistaAssistente dataInicial={dataInicial} dataFinal={dataFinal} />}
      {vista === "perfil-cnpj" && <VistaPerfilCnpj />}
      {vista === "equipe" && isAdmin && <VistaEquipe />}
    </div>
  );
}
