import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Users, UserPlus, TrendingDown, ShoppingCart,
  AlertTriangle, Percent, CalendarDays, DollarSign, Repeat, Trophy, Info,
  CheckCircle2, XCircle, Clock3, ChevronRight, HelpCircle, Filter, Layers,
} from "lucide-react";
import {
  Table, TableHeader, TableBody, TableFooter,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import KpiCard from "@/components/KpiCard";
import { fmtBrl, fmtNum, fmtPct, fmtDate, fmtDateTime } from "@/lib/format";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

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

const CLASSIFICACAO_INFO: Record<string, { label: string; cor: string; icone: string }> = {
  primeira_compra: { label: "Primeira compra", cor: "bg-blue-50 text-blue-700 border-blue-200", icone: "🆕" },
  recompra_observada: { label: "Recompra observada", cor: "bg-slate-100 text-slate-700 border-slate-200", icone: "🔁" },
  em_crescimento: { label: "Em crescimento", cor: "bg-green-50 text-green-700 border-green-200", icone: "📈" },
  reducao_volume: { label: "Redução de volume", cor: "bg-red-50 text-red-700 border-red-200", icone: "📉" },
  intervalo_acima_habitual: { label: "Atraso na recompra", cor: "bg-amber-50 text-amber-700 border-amber-200", icone: "⏰" },
  historico_insuficiente: { label: "Histórico insuficiente", cor: "bg-slate-50 text-slate-500 border-slate-200", icone: "❔" },
};

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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Segunda compra em X dias</h3>
          <p className="text-xs text-slate-400 mt-0.5">Clientes cuja primeira compra observada caiu neste período, e que fizeram (ou não) uma segunda compra dentro da janela.</p>
        </div>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Janela</TableHead>
              <TableHead className="text-right">Coorte (janela completa)</TableHead>
              <TableHead className="text-right">Ainda em observação</TableHead>
              <TableHead className="text-right">Fizeram 2ª compra</TableHead>
              <TableHead className="text-right">Taxa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vg.segundaCompra.map(s => (
              <TableRow key={s.janelaDias}>
                <TableCell className="font-semibold">{s.janelaDias} dias</TableCell>
                <TableCell className="text-right">{s.coorteTotal}</TableCell>
                <TableCell className="text-right text-slate-400">{s.coorteAindaEmObservacao}</TableCell>
                <TableCell className="text-right">{s.fizeramSegundaCompra}</TableCell>
                <TableCell className="text-right font-bold">{s.taxaPct !== null ? fmtPct(s.taxaPct) : "sem coorte"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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

// ─── Vista: Clientes ────────────────────────────────────────────────────────

function VistaClientes({ dataInicial, dataFinal }: { dataInicial: string; dataFinal: string }) {
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string | null>(null);
  const { data, isLoading } = trpc.performanceComercial.listarClientesInteligencia.useQuery({ dataInicial, dataFinal });

  if (isLoading) return <div className="bg-white rounded-xl border border-slate-200 h-64 animate-pulse" />;
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10">
        <Empty><EmptyHeader><EmptyMedia variant="icon"><Users /></EmptyMedia><EmptyTitle>Sem clientes no período</EmptyTitle></EmptyHeader></Empty>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-700">Clientes do período ({data.length})</h3>
        <p className="text-xs text-slate-400 mt-0.5">Clique em um cliente para ver a ficha completa. Ordenado por quem precisa de mais atenção primeiro.</p>
      </div>
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Classificação</TableHead>
            <TableHead className="text-right">Valor no período</TableHead>
            <TableHead className="text-right">Dias desde última compra</TableHead>
            <TableHead className="text-right">Razão de atraso</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map(c => (
            <TableRow key={c.empresaKey} className="cursor-pointer hover:bg-slate-50" onClick={() => setEmpresaSelecionada(c.empresaKey)}>
              <TableCell className="font-semibold">{c.empresaExibicao}</TableCell>
              <TableCell>
                <Badge className={CLASSIFICACAO_INFO[c.classificacao]?.cor ?? ""}>
                  {CLASSIFICACAO_INFO[c.classificacao]?.icone} {CLASSIFICACAO_INFO[c.classificacao]?.label}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{fmtBrl(c.valorJanelaAtual)}</TableCell>
              <TableCell className="text-right">{c.diasDesdeUltimaCompra}</TableCell>
              <TableCell className="text-right">{c.razaoAtraso !== null ? `${c.razaoAtraso.toFixed(1)}x` : "—"}</TableCell>
              <TableCell><ChevronRight className="w-3.5 h-3.5 text-slate-300" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <FichaClienteModal empresaKey={empresaSelecionada} onClose={() => setEmpresaSelecionada(null)} />
    </div>
  );
}

// ─── Vista: Fila de Ações ──────────────────────────────────────────────────────

function VistaFilaAcoes() {
  const [filtroStatus, setFiltroStatus] = useState<string>("pendente");
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.performanceComercial.getFilaAcoesClientes.useQuery({ status: filtroStatus as any || undefined });
  const atualizarMut = trpc.performanceComercial.atualizarAcaoCliente.useMutation({
    onSuccess: () => utils.performanceComercial.getFilaAcoesClientes.invalidate(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
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
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={TIPO_ACAO_INFO[acao.tipo]?.cor ?? ""}>{TIPO_ACAO_INFO[acao.tipo]?.label}</Badge>
                  <span className="text-[10px] text-slate-400 font-mono">prioridade {acao.prioridade}</span>
                </div>
                <p className="text-sm font-bold text-slate-800">{acao.titulo}</p>
                <p className="text-xs text-slate-500 mt-1">{acao.motivo}</p>
                {acao.proximoPasso && <p className="text-xs text-blue-600 mt-1">Próximo passo: {acao.proximoPasso}</p>}
              </div>
              {acao.status === "pendente" && (
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      const resultado = window.prompt("Resultado do contato (opcional): " + RESULTADO_OPCOES.map(r => r.label).join(" / "));
                      atualizarMut.mutate({ id: acao.id, status: "concluida", resultadoObservacao: resultado || undefined });
                    }}
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
                  {acao.status === "concluida" ? "Concluída" : acao.status === "adiada" ? `Adiada até ${fmtDate(acao.prazo)}` : "Descartada"}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Vista: Funil de Orçamentos ────────────────────────────────────────────────

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

// ─── Componente principal ─────────────────────────────────────────────────────

interface InteligenteClientesProps {
  anoSelecionado: number;
}

function periodoInicialDoAno(ano: number): string {
  const atual = new Date();
  return ano === atual.getFullYear() ? `${ano}-${pad(atual.getMonth() + 1)}` : `${ano}-12`;
}

type Vista = "visao-geral" | "clientes" | "fila" | "funil" | "previsoes";

const VISTAS: Array<{ id: Vista; label: string; icon: string }> = [
  { id: "visao-geral", label: "Visão Geral", icon: "📊" },
  { id: "clientes", label: "Clientes", icon: "👥" },
  { id: "fila", label: "Fila de Ações", icon: "✅" },
  { id: "funil", label: "Funil", icon: "🔻" },
  { id: "previsoes", label: "Previsões", icon: "🔮" },
];

export default function InteligenteClientes({ anoSelecionado }: InteligenteClientesProps) {
  const [dataInicialMes, setDataInicialMes] = useState(() => periodoInicialDoAno(anoSelecionado));
  const [dataFinalMes, setDataFinalMes] = useState(() => periodoInicialDoAno(anoSelecionado));
  const [vista, setVista] = useState<Vista>("visao-geral");

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
        {VISTAS.map(v => (
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
      {vista === "clientes" && <VistaClientes dataInicial={dataInicial} dataFinal={dataFinal} />}
      {vista === "fila" && <VistaFilaAcoes />}
      {vista === "funil" && <VistaFunil />}
      {vista === "previsoes" && <VistaPrevisoes />}
    </div>
  );
}
