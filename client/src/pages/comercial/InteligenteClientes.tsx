import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Users, UserPlus, RefreshCw, Clock, TrendingUp, ShoppingCart,
  AlertTriangle, Percent, ChevronDown, ChevronUp, CalendarDays,
  Snowflake, Zap, Lock, Unlock,
} from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ChartTooltip from "@/components/ChartTooltip";
import { chartColor } from "@/lib/chartColors";
import { fmtNum } from "@/lib/format";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function pad(n: number) { return String(n).padStart(2, "0"); }

function anoMesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function formatarPeriodo(ini: string, fim: string) {
  const [aIni, mIni] = ini.split("-").map(Number);
  const [aFim, mFim] = fim.split("-").map(Number);
  if (ini === fim) return `${MESES[mIni - 1]}/${aIni}`;
  if (aIni === aFim) return `${MESES[mIni - 1]} a ${MESES[mFim - 1]}/${aFim}`;
  return `${MESES[mIni - 1]}/${aIni} a ${MESES[mFim - 1]}/${aFim}`;
}

function formatarDataCalculo(d: any) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Seletor de Período ───────────────────────────────────────────────────────

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
      {/* Atalhos de ano completo */}
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

      {/* Seletor mês/ano inicial */}
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

      {/* Seletor mês/ano final */}
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

// ─── Componente principal ─────────────────────────────────────────────────────

interface InteligenteClientesProps {
  anoSelecionado: number;
}

export default function InteligenteClientes({ anoSelecionado }: InteligenteClientesProps) {
  const [expandirVendedores, setExpandirVendedores] = useState(false);
  const [dataInicial, setDataInicial] = useState(`${anoSelecionado}-01`);
  const [dataFinal, setDataFinal] = useState(anoMesAtual());
  const [forcarAtualizacao, setForcarAtualizacao] = useState(false);
  const [showDescongelarConfirm, setShowDescongelarConfirm] = useState(false);
  // Indicador de velocidade
  const loadStartRef = useRef<number>(0);
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null);

  // Sincronizar com anoSelecionado externo quando muda (usando useEffect para evitar setState durante render)
  const anoRef = useRef(anoSelecionado);
  useEffect(() => {
    if (anoSelecionado !== anoRef.current) {
      anoRef.current = anoSelecionado;
      setDataInicial(`${anoSelecionado}-01`);
      setDataFinal(anoSelecionado === new Date().getFullYear() ? anoMesAtual() : `${anoSelecionado}-12`);
      setForcarAtualizacao(false);
    }
  }, [anoSelecionado]);

  const periodoKey = `${dataInicial}_${dataFinal}`;
  const utils = trpc.useUtils();

  const { data, isLoading, refetch, isFetching } = trpc.performanceComercial.getInteligenteClientes.useQuery(
    { dataInicial, dataFinal, forcarAtualizacao },
    {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    }
  );

  // Registrar tempo de carregamento quando os dados chegam
  useEffect(() => {
    if (!isLoading && !isFetching && data) {
      setLoadTimeMs(Date.now() - loadStartRef.current);
    }
  }, [isLoading, isFetching, data]);

  const congelarMut = trpc.performanceComercial.congelarInteligencia.useMutation({
    onSuccess: () => { utils.performanceComercial.getInteligenteClientes.invalidate(); setForcarAtualizacao(false); },
  });
  const descongelarMut = trpc.performanceComercial.descongelarInteligencia.useMutation({
    onSuccess: () => { utils.performanceComercial.getInteligenteClientes.invalidate(); setShowDescongelarConfirm(false); setForcarAtualizacao(false); },
  });

  function handlePeriodoChange(ini: string, fim: string) {
    setDataInicial(ini);
    setDataFinal(fim);
    setForcarAtualizacao(false);
    loadStartRef.current = Date.now();
    setLoadTimeMs(null);
  }

  function handleAtualizar() {
    setForcarAtualizacao(true);
    setTimeout(() => refetch(), 50);
  }

  const temDadosTempo = data && data.tempoMedioPropostaFechamento !== null;
  const dadosTempo = data?.distribuicaoTempo ?? [];
  const dadosVendedores = (data?.porVendedor ?? []).slice(0, expandirVendedores ? 999 : 6);
  const calculadoEm = formatarDataCalculo(data?._calculadoEm);
  const carregando = isLoading || isFetching;
  const isCongelado = (data as any)?._congelado === true;
  const congeladoEm = formatarDataCalculo((data as any)?._congeladoEm);
  const fonteLabel = isCongelado ? 'congelado' : ((data as any)?._fonte === 'cache' ? 'cache' : 'tempo-real');

  return (
    <div className="space-y-5">

      {/* ── Barra de controles ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Período de Análise</p>
            <SeletorPeriodo
              dataInicial={dataInicial}
              dataFinal={dataFinal}
              onChange={handlePeriodoChange}
            />
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Indicador de velocidade/fonte */}
            {!carregando && data && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                isCongelado
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : fonteLabel === 'cache'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {isCongelado ? <Snowflake className="w-3 h-3" /> : fonteLabel === 'cache' ? <Zap className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                <span>
                  {isCongelado
                    ? `Congelado${congeladoEm ? ` em ${congeladoEm}` : ''}`
                    : fonteLabel === 'cache'
                      ? `Cache${loadTimeMs ? ` — ${loadTimeMs < 1000 ? `${loadTimeMs}ms` : `${(loadTimeMs/1000).toFixed(1)}s`}` : ''}`
                      : `Tempo real${loadTimeMs ? ` — ${(loadTimeMs/1000).toFixed(1)}s` : ''}`
                  }
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              {/* Botão Congelar / Descongelar */}
              {data && data.clientesUnicosAno > 0 && (
                isCongelado ? (
                  <button
                    onClick={() => setShowDescongelarConfirm(true)}
                    disabled={descongelarMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-colors border border-slate-200"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Descongelar
                  </button>
                ) : (
                  <button
                    onClick={() => congelarMut.mutate({ periodoKey })}
                    disabled={congelarMut.isPending || carregando}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    <Snowflake className="w-3.5 h-3.5" />
                    {congelarMut.isPending ? 'Congelando...' : 'Congelar Análise'}
                  </button>
                )
              )}
              <button
                onClick={() => { if (!isCongelado) { loadStartRef.current = Date.now(); setLoadTimeMs(null); handleAtualizar(); } }}
                disabled={carregando || isCongelado}
                title={isCongelado ? 'Descongelar primeiro para atualizar' : 'Buscar dados atualizados do ERP'}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${carregando ? "animate-spin" : ""}`} />
                {carregando ? "Calculando..." : "Atualizar Dados"}
              </button>
            </div>
            {calculadoEm && !carregando && (
              <p className="text-[10px] text-slate-400">
                Última atualização: {calculadoEm}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Estado de carregamento ── */}
      {carregando && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-8">
          <div className="max-w-md mx-auto text-center space-y-4">
            {/* Spinner */}
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
              <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            {/* Título */}
            <div>
              <p className="text-sm font-bold text-slate-700">
                Analisando clientes — {formatarPeriodo(dataInicial, dataFinal)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Isso pode levar até 30 segundos na primeira carga do período</p>
            </div>
            {/* Barra de progresso animada */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full animate-pulse"
                style={{ width: '100%', animation: 'progress-indeterminate 1.5s ease-in-out infinite' }}
              />
            </div>
            {/* Etapas */}
            <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 rounded-full bg-blue-50 border-2 border-blue-300 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                </div>
                <span>Buscando OS</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-blue-300 animate-pulse" style={{ animationDelay: '0.5s' }} />
                </div>
                <span>Buscando cotações</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 rounded-full bg-slate-50 border-2 border-slate-200 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
                <span>Calculando métricas</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sem dados ── */}
      {!carregando && (!data || data.clientesUnicosAno === 0) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">
            Sem dados para {formatarPeriodo(dataInicial, dataFinal)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Clique em "Atualizar Dados" para buscar do ERP
          </p>
        </div>
      )}

      {/* ── Conteúdo ── */}
      {!carregando && data && data.clientesUnicosAno > 0 && (
        <>
          {/* Título do período */}
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-700">
              {formatarPeriodo(dataInicial, dataFinal)}
            </h3>
            {calculadoEm && (
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                calculado em {calculadoEm}
              </span>
            )}
          </div>

          {/* ── Seção 1: KPIs de Base ── */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Base de Clientes</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                icon={Users}
                label="Clientes Únicos"
                value={data.clientesUnicosAno.toLocaleString("pt-BR")}
                sub="Empresas distintas com OS aprovada"
                color="#3b82f6"
              />
              <KpiCard
                icon={UserPlus}
                label="% Clientes Novos"
                value={`${data.pctClientesNovos}%`}
                sub={`${data.clientesNovosAno} novos de ${data.clientesUnicosAno} únicos`}
                color="#22c55e"
              />
              <KpiCard
                icon={ShoppingCart}
                label="Média de OS por Cliente"
                value={`${data.mediaComprasPorCliente}x`}
                sub="Pedidos médios por cliente no período"
                color="#8b5cf6"
              />
              <KpiCard
                icon={AlertTriangle}
                label="Sem Compra +6 Meses"
                value={`${data.pctClientesSemCompra6Meses}%`}
                sub={`${data.clientesSemCompra6Meses} clientes inativos`}
                color={data.pctClientesSemCompra6Meses >= 40 ? "#ef4444" : data.pctClientesSemCompra6Meses >= 20 ? "#f59e0b" : "#22c55e"}
                className={data.pctClientesSemCompra6Meses >= 30 ? "shadow-md" : undefined}
              />
            </div>
          </div>

          {/* ── Seção 2: KPIs de Recompra ── */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Fidelização e Recompra</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                icon={RefreshCw}
                label="Taxa de Recompra Geral"
                value={`${data.taxaRecompra}%`}
                sub="Clientes que compraram em 2+ meses"
                color="#8b5cf6"
              />
              <KpiCard
                icon={Percent}
                label="Recompra — Clientes Novos"
                value={`${data.taxaRecompraNovosPct}%`}
                sub={`${data.clientesNovosQueRecompraram} de ${data.clientesNovosAno} novos recompraram`}
                color="#f59e0b"
              />
              <KpiCard
                icon={Clock}
                label="Tempo Médio Fechamento"
                value={data.tempoMedioPropostaFechamento !== null ? `${data.tempoMedioPropostaFechamento} dias` : "—"}
                sub={data.tempoMedianaPropostaFechamento !== null ? `Mediana: ${data.tempoMedianaPropostaFechamento} dias` : "Requer orçamento vinculado"}
                color="#0ea5e9"
              />
              <KpiCard
                icon={TrendingUp}
                label="Intervalo de Fechamento"
                value={data.tempoP25 !== null && data.tempoP75 !== null ? `${data.tempoP25}–${data.tempoP75}d` : "—"}
                sub="P25 a P75 (50% central das OS)"
                color="#14b8a6"
              />
            </div>
          </div>

          {/* ── Seção 3: Distribuição do tempo ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-700">Tempo Proposta → Fechamento</h3>
              </div>
              {!temDadosTempo ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  <Clock className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p>Sem dados de tempo disponíveis</p>
                  <p className="text-xs mt-1">Requer campo de número do orçamento nas OS da API</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Média", value: data.tempoMedioPropostaFechamento, cor: "#3b82f6" },
                      { label: "Mediana", value: data.tempoMedianaPropostaFechamento, cor: "#8b5cf6" },
                      { label: "25% mais rápido (P25)", value: data.tempoP25, cor: "#22c55e" },
                      { label: "75% mais lento (P75)", value: data.tempoP75, cor: "#f59e0b" },
                    ].map(({ label, value, cor }) => (
                      <div key={label} className="rounded-lg p-3 border border-slate-100 bg-slate-50">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                        <p className="text-xl font-bold" style={{ color: cor }}>
                          {value !== null ? `${value}` : "—"}
                          {value !== null && <span className="text-xs font-normal text-slate-400 ml-1">dias</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">Calculado com base nas OS que têm orçamento vinculado</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                <h3 className="text-sm font-bold text-slate-700">Distribuição do Tempo de Fechamento</h3>
              </div>
              {dadosTempo.every((d: { faixa: string; quantidade: number }) => d.quantidade === 0) ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  <p>Sem dados de distribuição disponíveis</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dadosTempo} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="faixa" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip format={fmtNum} />} />
                    <Bar dataKey="quantidade" name="OS" radius={[4, 4, 0, 0]}>
                      {dadosTempo.map((_: any, index: number) => {
                        const intensity = dadosTempo.length > 1 ? index / (dadosTempo.length - 1) : 0.5;
                        const alpha = Math.round(40 + intensity * 200);
                        return <Cell key={index} fill={`rgba(139, 92, 246, ${alpha / 255})`} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Tabela por vendedor ── */}
          {data.porVendedor.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700">
                  Inteligência por Vendedor — {formatarPeriodo(dataInicial, dataFinal)}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Todos os 7 indicadores por vendedor</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-slate-500 font-semibold uppercase tracking-wide sticky left-0 bg-slate-50 min-w-[140px]">Vendedor</th>
                      <th className="text-right py-3 px-3 text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">
                        <span title="Clientes distintos com OS aprovada no período">Únicos</span>
                      </th>
                      <th className="text-right py-3 px-3 text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">
                        <span title="% de clientes novos entre os únicos do vendedor">% Novos</span>
                      </th>
                      <th className="text-right py-3 px-3 text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">
                        <span title="Taxa de recompra geral do vendedor">Recompra</span>
                      </th>
                      <th className="text-right py-3 px-3 text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">
                        <span title="Taxa de recompra dos clientes novos do vendedor">Recompra Novos</span>
                      </th>
                      <th className="text-right py-3 px-3 text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">
                        <span title="Média de OS por cliente do vendedor no período">Média OS/Cliente</span>
                      </th>
                      <th className="text-right py-3 px-3 text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">
                        <span title="Dias médios entre envio da proposta e aprovação da OS">Tempo Médio</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosVendedores.map((v: any, idx: number) => {
                      const cor = chartColor(idx);
                      const recompraColor = (pct: number) => pct >= 40 ? "#22c55e" : pct >= 20 ? "#f59e0b" : "#ef4444";
                      return (
                        <tr key={v.vendedor} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 sticky left-0 bg-white">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cor }} />
                              <span className="font-semibold text-slate-700 truncate max-w-[130px]" title={v.vendedor}>{v.vendedor}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-800">{v.clientesUnicos}</td>
                          <td className="py-3 px-3 text-right">
                            <span className="font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{v.pctClientesNovos}%</span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="font-bold px-2 py-0.5 rounded-full" style={{ color: recompraColor(v.taxaRecompra), background: recompraColor(v.taxaRecompra) + "15" }}>
                              {v.taxaRecompra}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="font-bold px-2 py-0.5 rounded-full" style={{ color: recompraColor(v.taxaRecompraNovosPct), background: recompraColor(v.taxaRecompraNovosPct) + "15" }}>
                              {v.taxaRecompraNovosPct}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700 font-semibold">{v.mediaComprasPorCliente}x</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {v.tempoMedioFechamento !== null ? `${v.tempoMedioFechamento}d` : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-200">
                      <td className="py-3 px-4 font-bold text-slate-600 sticky left-0 bg-slate-100">Total / Média</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800">{data.clientesUnicosAno}</td>
                      <td className="py-3 px-3 text-right font-bold text-green-700">{data.pctClientesNovos}%</td>
                      <td className="py-3 px-3 text-right font-bold text-purple-700">{data.taxaRecompra}%</td>
                      <td className="py-3 px-3 text-right font-bold text-amber-700">{data.taxaRecompraNovosPct}%</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">{data.mediaComprasPorCliente}x</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                        {data.tempoMedioPropostaFechamento !== null ? `${data.tempoMedioPropostaFechamento}d` : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {data.porVendedor.length > 6 && (
                <button
                  onClick={() => setExpandirVendedores(!expandirVendedores)}
                  className="w-full py-3 text-xs font-semibold text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 border-t border-slate-100"
                >
                  {expandirVendedores ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {expandirVendedores ? "Mostrar menos" : `Ver todos os ${data.porVendedor.length} vendedores`}
                </button>
              )}
            </div>
          )}

          {/* ── Nota metodológica ── */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
            <p className="font-semibold mb-1.5">Metodologia dos Indicadores</p>
            <div className="space-y-0.5 text-blue-600">
              <p>• <strong>Clientes únicos:</strong> empresas distintas com pelo menos uma OS Normal aprovada no período</p>
              <p>• <strong>% Clientes novos:</strong> proporção de clientes sem OS aprovada antes do período selecionado</p>
              <p>• <strong>Taxa de recompra geral:</strong> % de clientes únicos que compraram em 2 ou mais meses distintos</p>
              <p>• <strong>Taxa de recompra (novos):</strong> % dos clientes novos que fizeram 2+ compras no mesmo período</p>
              <p>• <strong>Média de OS por cliente:</strong> total de OS normais dividido pelo número de clientes únicos</p>
              <p>• <strong>Sem compra +6 meses:</strong> clientes cuja última OS aprovada foi há mais de 6 meses</p>
              <p>• <strong>Tempo proposta→fechamento:</strong> dias entre o cadastro do orçamento e a aprovação da OS vinculada. Requer que a OS tenha o campo "número do orçamento" preenchido no ERP.</p>
            </div>
          </div>
        </>
      )}

      {/* ── Modal de confirmação de descongelamento ── */}
      {showDescongelarConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Unlock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Descongelar Análise?</h3>
                <p className="text-xs text-slate-500">{formatarPeriodo(dataInicial, dataFinal)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mb-5">
              Os dados serão desbloqueados e poderão ser atualizados do ERP. O histórico calculado será mantido até a próxima atualização.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDescongelarConfirm(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => descongelarMut.mutate({ periodoKey })}
                disabled={descongelarMut.isPending}
                className="flex-1 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg transition-colors"
              >
                {descongelarMut.isPending ? 'Descongelando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
