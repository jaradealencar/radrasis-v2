import { trpc } from "@/lib/trpc";
import type { MetaComercial } from "../../../../drizzle/schema";
import EvolucaoVendedor from "./EvolucaoVendedor";
import EvolucaoDiariaVendedor from "./EvolucaoDiariaVendedor";
import InteligenteClientes from "./InteligenteClientes";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart,
} from "recharts";
import {
  TrendingUp, ShoppingCart, CheckCircle2, Percent, DollarSign,
  RefreshCw, Users, Target, Edit2, Check, X, ChevronDown, ChevronUp,
  MessageCircle, Phone, Star, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableHeader, TableBody, TableFooter,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import ChartTooltip from "@/components/ChartTooltip";
import { chartColor } from "@/lib/chartColors";
import { fmtNum, fmtBrl } from "@/lib/format";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

// ─── KPI Card ────────────────────────────────────────────────────────────────

// Badge de meta: mostra % atingido e status (longe/perto/atingido)
function MetaBadge({
  real, meta, metaLabel, isCurrency = false, isPct = false
}: { real: number; meta: number; metaLabel?: string; isCurrency?: boolean; isPct?: boolean }) {
  if (!meta || meta <= 0) return null;
  const pct = (real / meta) * 100;
  const over = pct >= 100;
  const near = pct >= 80;
  const mid = pct >= 50;
  const bg = over ? "bg-green-50 text-green-700 border-green-200"
    : near ? "bg-amber-50 text-amber-700 border-amber-200"
    : mid ? "bg-orange-50 text-orange-700 border-orange-200"
    : "bg-red-50 text-red-600 border-red-200";
  const statusIcon = over ? "✓" : near ? "▲" : mid ? "▶" : "▼";
  // Formatar valor da meta
  const fmtMeta = isCurrency
    ? `R$ ${meta.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : isPct ? `${meta}%`
    : meta.toLocaleString("pt-BR");
  // Distância até a meta
  const diff = real - meta;
  const diffPct = Math.abs(100 - pct);
  const diffLabel = over
    ? `+${diffPct.toFixed(0)}%`
    : `-${diffPct.toFixed(0)}%`;
  return (
    <div className={`absolute bottom-0 right-0 flex flex-col items-end gap-0 px-2 py-1 rounded-tl-lg border-t border-l text-[10px] font-semibold ${bg}`}>
      <span className="text-[9px] opacity-60 font-normal leading-tight">Meta: {metaLabel ?? fmtMeta}</span>
      <span className="font-bold leading-tight">{statusIcon} {diffLabel}</span>
    </div>
  );
}

function KpiCardComMeta({ label, value, sub, icon: Icon, color, meta, metaReal, metaTarget, isCurrency, isPct }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string;
  meta?: string; metaReal?: number; metaTarget?: number; isCurrency?: boolean; isPct?: boolean;
}) {
  const hasMeta = metaReal != null && metaTarget != null && metaTarget > 0;
  const pctAtingido = hasMeta ? Math.min((metaReal! / metaTarget!) * 100, 100) : 0;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-2 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-slate-500">{label}</p>
          <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          {sub && <p className="text-xs mt-1 text-slate-400">{sub}</p>}
          {meta && <p className="text-xs mt-1 font-medium text-slate-500">Meta: {meta}</p>}
        </div>
        <div className="p-2.5 rounded-lg" style={{ background: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      {hasMeta && (
        <div className="mt-1">
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pctAtingido}%`,
                background: pctAtingido >= 100 ? "#16a34a" : pctAtingido >= 80 ? "#d97706" : pctAtingido >= 50 ? "#ea580c" : "#dc2626"
              }}
            />
          </div>
        </div>
      )}
      {hasMeta && (
        <MetaBadge real={metaReal!} meta={metaTarget!} isCurrency={isCurrency} isPct={isPct} />
      )}
    </div>
  );
}

// ─── Tooltip customizado ─────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg p-3 text-xs bg-white border border-slate-200 shadow-lg min-w-[160px]">
      <p className="font-bold mb-1.5 text-slate-700">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="mb-0.5">
          {p.name}:{" "}
          {p.name?.includes("R$") || p.name?.includes("Faturamento") || p.name?.includes("Orçado")
            ? `R$ ${Number(p.value).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            : p.name?.includes("%") || p.name?.includes("Taxa")
              ? `${Number(p.value).toFixed(1)}%`
              : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Célula editável de meta ─────────────────────────────────────────────────

function MetaCell({ value, onSave }: { value: number | null | undefined; onSave: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          className="h-6 w-24 text-xs px-1 py-0"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { onSave(draft === "" ? null : Number(draft)); setEditing(false); }
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <button onClick={() => { onSave(draft === "" ? null : Number(draft)); setEditing(false); }} className="text-green-600 hover:text-green-700">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setEditing(false)} className="text-red-500 hover:text-red-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => { setDraft(value != null ? String(value) : ""); setEditing(true); }}
      className="flex items-center gap-1 group text-slate-600 hover:text-blue-600"
    >
      <span className="font-mono">{value != null ? value : <span className="text-slate-300 italic text-xs">—</span>}</span>
      <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── Barra de progresso ───────────────────────────────────────────────────────

function ProgressBar({
  real, meta, color, isCurrency, isPct
}: { real: number; meta: number | null | undefined; color: string; isCurrency?: boolean; isPct?: boolean }) {
  if (!meta || meta <= 0) return <span className="text-slate-300 text-xs">—</span>;
  const pct = Math.min((real / meta) * 100, 100);
  const rawPct = (real / meta) * 100;
  const over = real > meta;
  const diffPct = Math.abs(100 - rawPct);
  const diffLabel = over ? `+${diffPct.toFixed(0)}%` : `-${diffPct.toFixed(0)}%`;
  const fmtMeta = isCurrency
    ? `R$\u00a0${meta.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : isPct ? `${meta}%`
    : meta.toLocaleString("pt-BR");
  return (
    <div className="flex flex-col gap-0.5 w-full">
      <div className="flex items-center gap-1.5 w-full">
        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: over ? "#22c55e" : color }}
          />
        </div>
        <span className="text-[10px] font-mono font-bold" style={{ color: over ? "#16a34a" : pct >= 70 ? "#d97706" : "#dc2626" }}>
          {diffLabel}
        </span>
      </div>
      <span className="text-[9px] text-slate-400 leading-none">Meta: {fmtMeta}</span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

// ─── Tipos auxiliares ────────────────────────────────────────────────────────
type MesAno = { mes: number; ano: number };

export default function PerformanceComercial() {
  const [mesSelecionado, setMesSelecionado] = useState(MES_ATUAL);
  const [anoSelecionado, setAnoSelecionado] = useState(ANO_ATUAL);
  const [abaAtiva, setAbaAtiva] = useState<"visao-geral" | "mes-vigente" | "evolucao" | "inteligente">("visao-geral");
  const [showComparativo, setShowComparativo] = useState(true);
  const [showClientesNovos, setShowClientesNovos] = useState(true);
  const [editingMetas, setEditingMetas] = useState(false);
  const [showOverrides, setShowOverrides] = useState(false);
  const [showEvolucaoVendedor, setShowEvolucaoVendedor] = useState(false);
  const [overrideDialog, setOverrideDialog] = useState<{ empresa: string; vendedor: string } | null>(null);
  const [overrideMotivoInput, setOverrideMotivoInput] = useState("");
  const [deleteOverrideId, setDeleteOverrideId] = useState<number | null>(null);
  // ─── Estado de Auditoria / Congelamento ──────────────────────────────────────────────
  const [showAuditoriaModal, setShowAuditoriaModal] = useState(false);
  const [auditandoStep, setAuditandoStep] = useState<'idle' | 'loading' | 'confirmar' | 'congelando'>('idle');
  // ─── Congelamento em lote (múltiplos meses) ──────────────────────────────────────────────
  const [showCongelarLoteModal, setShowCongelarLoteModal] = useState(false);
  const [loteProgress, setLoteProgress] = useState<{ mes: number; ano: number; status: 'pendente' | 'processando' | 'ok' | 'erro' }[]>([]);
  const [loteRunning, setLoteRunning] = useState(false);
  // ─── Indicador de velocidade de carregamento ──────────────────────────────────────────────
  const loadStartRef = useRef<number>(0);
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null);

  // ─── Comparação de Meses (Power BI style) ────────────────────────────────
  const [showComparaMeses, setShowComparaMeses] = useState(false);
  const [comparaMesesSelecionados, setComparaMesesSelecionados] = useState<MesAno[]>(() => {
    // Padrão: últimos 4 meses
    const result: MesAno[] = [];
    for (let i = 3; i >= 0; i--) {
      let m = MES_ATUAL - i;
      let a = ANO_ATUAL;
      if (m <= 0) { m += 12; a -= 1; }
      result.push({ mes: m, ano: a });
    }
    return result;
  });
  const [comparaAno, setComparaAno] = useState(ANO_ATUAL);

  const utils = trpc.useUtils();

  // Últimos 6 meses para gráfico de evolução
  const mesesEvolucao = useMemo(() => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      let m = mesSelecionado - i;
      let a = anoSelecionado;
      if (m <= 0) { m += 12; a -= 1; }
      result.push({ mes: m, ano: a });
    }
    return result;
  }, [mesSelecionado, anoSelecionado]);

  // Meses para comparativo (mês selecionado vs 3 anteriores)
  const mesesComparativo = useMemo(() => {
    const result = [];
    for (let i = 3; i >= 0; i--) {
      let m = mesSelecionado - i;
      let a = anoSelecionado;
      if (m <= 0) { m += 12; a -= 1; }
      result.push({ mes: m, ano: a });
    }
    return result;
  }, [mesSelecionado, anoSelecionado]);

  // retry: 1 (em vez do padrão 3 do React Query) — se a consulta já levou ~50s e falhou
  // por timeout, repetir automaticamente só multiplica a espera sem nenhum ganho: o cache
  // da API MubiSys continua frio, então cada nova tentativa reproduz o mesmo custo.
  const RETRY_1 = { refetchOnWindowFocus: false, retry: 1 };

  const { data: mesDados, isLoading: loadingMes, refetch: refetchMes } =
    trpc.performanceComercial.getMes.useQuery({ mes: mesSelecionado, ano: anoSelecionado }, RETRY_1);

  // Query de auditoria para o mês selecionado
  const { data: auditoriaData, refetch: refetchAuditoria } =
    trpc.performanceComercial.getAuditoria.useQuery({ mes: mesSelecionado, ano: anoSelecionado }, RETRY_1);

  const salvarAuditoriaMut = trpc.performanceComercial.salvarAuditoria.useMutation({
    onSuccess: () => { refetchAuditoria(); },
  });
  const congelarAuditoriaMut = trpc.performanceComercial.congelarAuditoria.useMutation({
    onSuccess: () => {
      refetchAuditoria();
      utils.performanceComercial.getMes.invalidate({ mes: mesSelecionado, ano: anoSelecionado });
      setAuditandoStep('idle');
      setShowAuditoriaModal(false);
    },
  });
  const descongelarAuditoriaMut = trpc.performanceComercial.descongelarAuditoria.useMutation({
    onSuccess: () => {
      refetchAuditoria();
      utils.performanceComercial.getMes.invalidate({ mes: mesSelecionado, ano: anoSelecionado });
    },
  });

  // Fonte dos dados: congelado, auditado (salvo mas não congelado) ou tempo real
  const fonteStatus = (mesDados as any)?._fonte === 'congelado' ? 'congelado'
    : auditoriaData?.congelado ? 'congelado'
    : auditoriaData ? 'auditado'
    : 'tempo-real';

  // API MubiSys falhou/deu timeout e os números vieram do snapshot local
  // (historico_os) em vez da API — pode estar desatualizado ou zerado se o
  // mês ainda não foi importado. Não mostrar isso como "tempo real" normal.
  const dadosDeFallbackLocal = fonteStatus === 'tempo-real' && (mesDados as any)?._origemDados === 'local';

  const { data: evolucao, isLoading: loadingEvolucao, refetch: refetchEvolucao } =
    trpc.performanceComercial.getMultiMes.useQuery({ meses: mesesEvolucao }, RETRY_1);

  const { data: comparativo, isLoading: loadingComparativo } =
    trpc.performanceComercial.getMultiMes.useQuery(
      { meses: mesesComparativo },
      { enabled: showComparativo, ...RETRY_1 }
    );

  const { data: metas, refetch: refetchMetas } =
    trpc.performanceComercial.getMetas.useQuery({ mes: mesSelecionado, ano: anoSelecionado }, RETRY_1);
  const { data: dadosAno, isLoading: loadingAno, isError: errorAno } =
    trpc.performanceComercial.getAno.useQuery({ ano: anoSelecionado }, RETRY_1);
  const { data: clientesNovos, isLoading: loadingClientesNovos } =
    trpc.performanceComercial.getClientesNovos.useQuery({ mes: mesSelecionado, ano: anoSelecionado }, RETRY_1);

  // Controle de contato com clientes novos
  const { data: contatadosMap, refetch: refetchContatados } =
    trpc.performanceComercial.getContatados.useQuery({ mes: mesSelecionado, ano: anoSelecionado }, RETRY_1);
  const setContatadoMut = trpc.performanceComercial.setContatado.useMutation({
    onSuccess: () => { refetchContatados(); },
  });

  const { data: clientesNovosAno, isLoading: loadingClientesNovosAno } =
    trpc.performanceComercial.getClientesNovosAno.useQuery({ ano: anoSelecionado }, RETRY_1);

  // Query de comparação multi-mês (Power BI)
  const { data: comparaMesesDados, isLoading: loadingComparaMeses } =
    trpc.performanceComercial.getMultiMes.useQuery(
      { meses: comparaMesesSelecionados },
      { enabled: showComparaMeses && comparaMesesSelecionados.length > 0, ...RETRY_1 }
    );

  // Metas globais (vendedor = "GERAL")
  const metaGeral = useMemo(() => {
    if (!metas) return null;
    return metas.find((m: any) => m.vendedor === "GERAL") ?? null;
  }, [metas]);

  // Overrides de clientes
  const { data: clienteOverridesList, refetch: refetchOverrides } =
    trpc.performanceComercial.listClienteOverrides.useQuery();

  const upsertOverride = trpc.performanceComercial.upsertClienteOverride.useMutation({
    onSuccess: () => {
      utils.performanceComercial.listClienteOverrides.invalidate();
      utils.performanceComercial.getClientesNovos.invalidate();
      setOverrideDialog(null);
      setOverrideMotivoInput("");
    },
  });

  const deleteOverride = trpc.performanceComercial.deleteClienteOverride.useMutation({
    onSuccess: () => {
      utils.performanceComercial.listClienteOverrides.invalidate();
      utils.performanceComercial.getClientesNovos.invalidate();
      setDeleteOverrideId(null);
    },
  });

  // Comparativo anual: todos os meses do ano com dados
  const comparativoAnual = (dadosAno ?? []).filter((r: any) => r != null);

  const upsertMeta = trpc.performanceComercial.upsertMeta.useMutation({
    onSuccess: () => {
      utils.performanceComercial.getMetas.invalidate();
    },
  });

  const deleteMeta = trpc.performanceComercial.deleteMeta.useMutation({
    onSuccess: () => {
      utils.performanceComercial.getMetas.invalidate();
    },
  });

  const isLoading = loadingMes || loadingEvolucao;

  // ─── Medir tempo de carregamento ─────────────────────────────────────────────
  // Iniciar timer quando mês/ano muda
  useEffect(() => {
    loadStartRef.current = Date.now();
    setLoadTimeMs(null);
  }, [mesSelecionado, anoSelecionado]);

  // Registrar tempo quando dados chegam
  useEffect(() => {
    if (!loadingMes && mesDados && loadStartRef.current > 0) {
      const elapsed = Date.now() - loadStartRef.current;
      setLoadTimeMs(elapsed);
      loadStartRef.current = 0;
    }
  }, [loadingMes, mesDados]);

  // Breakdown por vendedor — dados já consolidados pelo servidor em porVendedor[]
  // IMPORTANTE: porVendedor pode ser {} (objeto vazio) quando dados estão congelados — normalizar para array
  const vendedoresData = useMemo(() => {
    const pv = mesDados?.porVendedor;
    if (!pv) return [];
    // Normalizar: se for objeto (não array), converter para array de valores
    const pvArray: any[] = Array.isArray(pv) ? pv : Object.values(pv);
    if (pvArray.length === 0) return [];
    const novosMap = (clientesNovos as any)?.porVendedorNovos ?? {};
    return pvArray
      .map((v: any) => {
        // Normalizar nome para cruzar com porVendedorNovos (chave em lowercase sem espaços extras)
        const keyNorm = String(v.vendedor).trim().toLowerCase();
        // Tentar match exato ou normalizado
        const novosEntry = novosMap[v.vendedor] ?? novosMap[keyNorm] ??
          Object.entries(novosMap).find(([k]) => k.toLowerCase() === keyNorm)?.[1] as any ?? null;
        const cotacoesNovos = novosEntry?.cotacoesNovos ?? 0;
        const osNovos = novosEntry?.osNovos ?? 0;
        const taxaConversaoNovos = cotacoesNovos > 0 ? parseFloat(((osNovos / cotacoesNovos) * 100).toFixed(1)) : 0;
        const valorOrcadoNovos = novosEntry?.valorOrcadoNovos ?? 0;
        const faturamentoNovos = novosEntry?.faturamentoNovos ?? 0;
        const taxaFaturamentoNovos = valorOrcadoNovos > 0 ? parseFloat(((faturamentoNovos / valorOrcadoNovos) * 100).toFixed(1)) : 0;
        return {
          vendedor: String(v.vendedor).length > 22 ? String(v.vendedor).substring(0, 20) + "…" : String(v.vendedor),
          vendedorFull: String(v.vendedor),
          cotacoes: v.cotacoes ?? 0,
          osGeradas: v.osGeradas ?? 0,
          taxa: v.taxaConversao ?? 0,
          valorOrc: v.valorOrcado ?? 0,
          valorOs: v.faturamento ?? 0,
          taxaFat: v.taxaFaturamento ?? 0,
          ticketMedio: v.ticketMedio ?? 0,
          resultado: v.resultado ?? 0,
          margemPct: v.margemPct ?? 0,
          taxaConversaoNovos,
          taxaFaturamentoNovos,
        };
      })
      .sort((a: any, b: any) => b.cotacoes - a.cotacoes)
      .slice(0, 12);
  }, [mesDados, clientesNovos]);

  // Metas indexadas por vendedor
  const metasPorVendedor = useMemo(() => {
    const map: Record<string, MetaComercial> = {};
    if (!metas) return map;
    for (const m of metas) map[m.vendedor] = m as MetaComercial;
    return map;
  }, [metas]);

  const handleSaveMeta = (vendedor: string, campo: string, valor: number | null) => {
    const existing = vendedor === "GERAL" ? metaGeral : metasPorVendedor[vendedor];
    upsertMeta.mutate({
      vendedor,
      mes: mesSelecionado,
      ano: anoSelecionado,
      metaCotacoes: campo === "metaCotacoes" ? valor : (existing?.metaCotacoes ?? null),
      metaVendas: campo === "metaVendas" ? valor : (existing?.metaVendas ?? null),
      metaFaturamento: campo === "metaFaturamento" ? valor : (existing?.metaFaturamento ? Number(existing.metaFaturamento) : null),
      metaConversao: campo === "metaConversao" ? valor : (existing?.metaConversao ? Number(existing.metaConversao) : null),
      metaTicketMedio: campo === "metaTicketMedio" ? valor : (existing?.metaTicketMedio ? Number(existing.metaTicketMedio) : null),
      metaOsGeradas: campo === "metaOsGeradas" ? valor : (existing?.metaOsGeradas ?? null),
      metaClientesNovos: campo === "metaClientesNovos" ? valor : (existing?.metaClientesNovos ?? null),
      metaFaturamentoNovos: campo === "metaFaturamentoNovos" ? valor : (existing?.metaFaturamentoNovos ? Number(existing.metaFaturamentoNovos) : null),
      metaTaxaFaturamento: campo === "metaTaxaFaturamento" ? valor : (existing?.metaTaxaFaturamento ? Number(existing.metaTaxaFaturamento) : null),
      metaTicketMedioNovos: campo === "metaTicketMedioNovos" ? valor : (existing?.metaTicketMedioNovos ? Number(existing.metaTicketMedioNovos) : null),
      metaValorOrcado: campo === "metaValorOrcado" ? valor : (existing?.metaValorOrcado ? Number(existing.metaValorOrcado) : null),
      metaConversaoNovos: campo === "metaConversaoNovos" ? valor : (existing?.metaConversaoNovos ? Number(existing.metaConversaoNovos) : null),
      metaTaxaFaturamentoNovos: campo === "metaTaxaFaturamentoNovos" ? valor : (existing?.metaTaxaFaturamentoNovos ? Number(existing.metaTaxaFaturamentoNovos) : null),
    });
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header — mobile-first: empilhado no mobile, lado a lado no desktop */}
        <div className="flex flex-col gap-3">
          {/* Título */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">Comercial</p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Performance Comercial</h1>
            <p className="text-xs sm:text-sm mt-0.5 text-slate-500">
              Cotações × Vendas × Faturamento — dados do ERP Mubisys
            </p>
          </div>
          {/* Controles: seletores + badge + botões */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            {/* Linha 1 no mobile: seletores de mês/ano + badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={String(mesSelecionado)} onValueChange={v => setMesSelecionado(Number(v))}>
                <SelectTrigger className="w-32 sm:w-36 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES_NOMES.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(anoSelecionado)} onValueChange={v => setAnoSelecionado(Number(v))}>
                <SelectTrigger className="w-20 sm:w-24 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2].map(a => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Badge de status da fonte dos dados */}
              {loadingMes && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 animate-pulse">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  BUSCANDO NA API...
                </span>
              )}
              {!loadingMes && fonteStatus === 'congelado' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                  🔒 CONGELADO
                </span>
              )}
              {!loadingMes && fonteStatus === 'auditado' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                  ✅ AUDITADO
                </span>
              )}
              {!loadingMes && fonteStatus === 'tempo-real' && !dadosDeFallbackLocal && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                  ⚡ TEMPO REAL
                </span>
              )}
              {!loadingMes && dadosDeFallbackLocal && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200"
                  title="A API MubiSys não respondeu a tempo. Estes números vêm do snapshot local, que pode estar desatualizado ou zerado se o mês ainda não foi importado."
                >
                  ⚠️ API INDISPONÍVEL — dados locais
                </span>
              )}
              {/* Indicador de velocidade de carregamento */}
              {loadTimeMs !== null && !loadingMes && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                    fonteStatus === 'congelado'
                      ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : loadTimeMs < 2000
                        ? 'bg-green-50 text-green-600 border-green-200'
                        : loadTimeMs < 10000
                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : 'bg-red-50 text-red-600 border-red-200'
                  }`}
                  title={fonteStatus === 'congelado' ? 'Dados carregados do banco (congelados)' : 'Tempo de resposta da API'}
                >
                  {loadTimeMs < 1000
                    ? `${loadTimeMs}ms`
                    : `${(loadTimeMs / 1000).toFixed(1)}s`}
                  {fonteStatus === 'congelado' ? ' 🗄️' : ' 🌐'}
                </span>
              )}
            </div>
            {/* Linha 2 no mobile: botões de ação */}
            <div className="flex items-center gap-2">
              {/* Botão Auditar/Congelar */}
              {fonteStatus !== 'congelado' ? (
                <Button
                  variant="outline" size="sm"
                  onClick={() => setShowAuditoriaModal(true)}
                  disabled={loadingMes || !mesDados}
                  className="gap-1.5 h-9 border-blue-300 text-blue-700 hover:bg-blue-50 flex-1 sm:flex-none text-xs sm:text-sm"
                >
                  🔒 Auditar e Congelar
                </Button>
              ) : (
                <Button
                  variant="outline" size="sm"
                  onClick={() => descongelarAuditoriaMut.mutate({ mes: mesSelecionado, ano: anoSelecionado })}
                  disabled={descongelarAuditoriaMut.isPending}
                  className="gap-1.5 h-9 border-amber-300 text-amber-700 hover:bg-amber-50 flex-1 sm:flex-none text-xs sm:text-sm"
                >
                  🔓 Recalibrar
                </Button>
              )}
              <Button
                variant="outline" size="sm"
                onClick={() => { refetchMes(); refetchEvolucao(); refetchMetas(); }}
                disabled={isLoading || fonteStatus === 'congelado'}
                className="gap-1.5 h-9 flex-1 sm:flex-none text-xs sm:text-sm"
                title={fonteStatus === 'congelado' ? 'Dados congelados — use Recalibrar para atualizar' : ''}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              {/* Botão congelar múltiplos meses históricos */}
              <Button
                variant="outline" size="sm"
                onClick={() => {
                  // Inicializar lote com meses históricos do ano selecionado
                  // IMPORTANTE: usar data em tempo real ao clicar (não constante de carregamento)
                  // para evitar congelar o mês atual quando a página foi carregada no mês anterior
                  const agora = new Date();
                  const mesAtualReal = agora.getMonth() + 1;
                  const anoAtualReal = agora.getFullYear();
                  const mesesHist = [];
                  for (let m = 1; m <= 12; m++) {
                    if (anoSelecionado === anoAtualReal && m >= mesAtualReal) break;
                    mesesHist.push({ mes: m, ano: anoSelecionado, status: 'pendente' as const });
                  }
                  setLoteProgress(mesesHist);
                  setShowCongelarLoteModal(true);
                }}
                className="gap-1.5 h-9 border-purple-300 text-purple-700 hover:bg-purple-50 hidden sm:flex text-xs sm:text-sm"
                title="Congelar múltiplos meses históricos de uma vez"
              >
                📅 Congelar Histórico
              </Button>
            </div>
          </div>
        </div>

        {/* ─── Subabas ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          {([
            { id: "visao-geral" as const, label: "Visão Geral", icon: "📊" },
            { id: "mes-vigente" as const, label: "Mês Vigente", icon: "📅" },
            { id: "evolucao" as const, label: "Evolução por Vendedor", icon: "📈" },
            { id: "inteligente" as const, label: "Inteligência de Clientes", icon: "🧠" },
          ]).map(aba => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                abaAtiva === aba.id
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}
            >
              <span>{aba.icon}</span>
              <span>{aba.label}</span>
            </button>
          ))}
        </div>

        {/* ─── Aba: Mês Vigente ─────────────────────────────────────────────────── */}
        {abaAtiva === "mes-vigente" && (
          <EvolucaoDiariaVendedor mes={mesSelecionado} ano={anoSelecionado} />
        )}

        {/* ─── Aba: Evolução por Vendedor ───────────────────────────────────────── */}
        {abaAtiva === "evolucao" && (
          <EvolucaoVendedor
            anoSelecionado={anoSelecionado}
            mesSelecionado={mesSelecionado}
            metaGeral={metaGeral}
            fonteStatus={fonteStatus}
            auditoriaData={auditoriaData}
          />
        )}

        {/* ─── Aba: Inteligência de Clientes ──────────────────────────────────── */}
        {abaAtiva === "inteligente" && (
          <InteligenteClientes anoSelecionado={anoSelecionado} />
        )}

        <div style={{ display: abaAtiva !== "visao-geral" ? "none" : undefined }}>

        {/* KPIs do mês */}
        {loadingMes ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 h-24 animate-pulse" />
              ))}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <span>Buscando dados atualizados na API MubiSys... Isso pode levar alguns segundos na primeira consulta do mês.</span>
            </div>
          </div>
        ) : false ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm">
            {undefined}
          </div>
        ) : mesDados ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            <KpiCardComMeta
              label="Cotações Enviadas"
              value={String(mesDados.cotacoes ?? 0)}
              sub={`${MESES_NOMES[mesSelecionado - 1]} ${anoSelecionado}`}
              icon={ShoppingCart}
              color="#3b82f6"
              metaReal={mesDados.cotacoes ?? 0}
              metaTarget={metaGeral?.metaCotacoes ?? undefined}
            />
            <KpiCardComMeta
              label="Vendas Realizadas"
              value={String(mesDados.osGeradas ?? 0)}
              sub="Vendas aprovadas no mês"
              icon={CheckCircle2}
              color="#8b5cf6"
              metaReal={mesDados.osGeradas ?? 0}
              metaTarget={metaGeral?.metaOsGeradas ?? undefined}
            />
            <KpiCardComMeta
              label="Taxa de Conversão"
              value={`${mesDados.taxaConversao ?? 0}%`}
              sub="Vendas / Cotações"
              icon={Percent}
              color={Number(mesDados.taxaConversao) >= 30 ? "#22c55e" : Number(mesDados.taxaConversao) >= 15 ? "#f59e0b" : "#ef4444"}
              metaReal={Number(mesDados.taxaConversao ?? 0)}
              metaTarget={metaGeral?.metaConversao ? Number(metaGeral.metaConversao) : undefined}
              isPct
            />
            <KpiCardComMeta
              label="Valor Orçado"
              value={`R$ ${(mesDados.valorOrcado ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              sub="Total das cotações"
              icon={TrendingUp}
              color="#64748b"
              metaReal={mesDados.valorOrcado ?? 0}
              metaTarget={metaGeral?.metaValorOrcado ? Number(metaGeral.metaValorOrcado) : undefined}
              isCurrency
            />
            <KpiCardComMeta
              label="Faturamento Gerado"
              value={`R$ ${(mesDados.faturamento ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              sub="Total das OS normais"
              icon={DollarSign}
              color="#22c55e"
              metaReal={mesDados.faturamento ?? 0}
              metaTarget={metaGeral?.metaFaturamento ? Number(metaGeral.metaFaturamento) : undefined}
              isCurrency
            />
            <KpiCardComMeta
              label="Taxa de Faturamento"
              value={`${mesDados.taxaFaturamento ?? 0}%`}
              sub="Faturamento / Orçado"
              icon={Percent}
              color={Number(mesDados.taxaFaturamento) >= 30 ? "#22c55e" : Number(mesDados.taxaFaturamento) >= 15 ? "#f59e0b" : "#ef4444"}
              metaReal={Number(mesDados.taxaFaturamento ?? 0)}
              metaTarget={metaGeral?.metaTaxaFaturamento ? Number(metaGeral.metaTaxaFaturamento) : undefined}
              isPct
            />
            <KpiCardComMeta
              label="Clientes Novos"
              value={loadingClientesNovos ? "..." : String(clientesNovos?.total ?? 0)}
              sub="1ª OS no histórico"
              icon={UserPlus}
              color="#0ea5e9"
              metaReal={clientesNovos?.total ?? 0}
              metaTarget={metaGeral?.metaClientesNovos ?? undefined}
            />
            <KpiCardComMeta
              label="Cotações (Novos)"
              value={loadingClientesNovos ? "..." : String(clientesNovos?.cotacoesNovos ?? 0)}
              sub="Cotações de novos clientes"
              icon={ShoppingCart}
              color="#a855f7"
              metaReal={clientesNovos?.cotacoesNovos ?? 0}
              metaTarget={metaGeral?.metaCotacoesNovos ?? undefined}
            />
            <KpiCardComMeta
              label="Vendas (Novos Clientes)"
              value={loadingClientesNovos ? "..." : String(clientesNovos?.osNovos ?? 0)}
              sub="Vendas de clientes novos (incl. recompras)"
              icon={CheckCircle2}
              color="#06b6d4"
              metaReal={clientesNovos?.osNovos ?? 0}
              metaTarget={metaGeral?.metaOsNovos ?? undefined}
            />
            <KpiCardComMeta
              label="Faturamento (Novos)"
              value={loadingClientesNovos ? "..." : `R$ ${(((clientesNovos as any)?.faturamentoNovos ?? 0) as number).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              sub="Total das OS de novos clientes"
              icon={DollarSign}
              color="#f59e0b"
              metaReal={(clientesNovos as any)?.faturamentoNovos ?? 0}
              metaTarget={metaGeral?.metaFaturamentoNovos ? Number(metaGeral.metaFaturamentoNovos) : undefined}
              isCurrency
            />
            {/* Quatro taxas de conversão: Geral (pedido + fat) e Novos (pedido + fat) */}
            <KpiCardComMeta
              label="Taxa Conv. Geral"
              value={`${mesDados.taxaConversao ?? 0}%`}
              sub="Vendas / Cotações (todos)"
              icon={Percent}
              color={Number(mesDados.taxaConversao) >= 30 ? "#22c55e" : Number(mesDados.taxaConversao) >= 15 ? "#f59e0b" : "#ef4444"}
              metaReal={Number(mesDados.taxaConversao ?? 0)}
              metaTarget={metaGeral?.metaConversao ? Number(metaGeral.metaConversao) : undefined}
              isPct
            />
            <KpiCardComMeta
              label="Taxa Fat. Geral"
              value={`${mesDados.taxaFaturamento ?? 0}%`}
              sub="Fat. / Orçado (todos)"
              icon={Percent}
              color={Number(mesDados.taxaFaturamento) >= 30 ? "#22c55e" : Number(mesDados.taxaFaturamento) >= 15 ? "#f59e0b" : "#ef4444"}
              metaReal={Number(mesDados.taxaFaturamento ?? 0)}
              metaTarget={metaGeral?.metaTaxaFaturamento ? Number(metaGeral.metaTaxaFaturamento) : undefined}
              isPct
            />
            <KpiCardComMeta
              label="Taxa Conv. Novos"
              value={loadingClientesNovos ? "..." : `${clientesNovos?.taxaConversaoNovos ?? 0}%`}
              sub="Vendas / Cotações (novos)"
              icon={Percent}
              color={!clientesNovos ? "#94a3b8" : Number(clientesNovos?.taxaConversaoNovos) >= 30 ? "#22c55e" : Number(clientesNovos?.taxaConversaoNovos) >= 15 ? "#f59e0b" : "#ef4444"}
              metaReal={Number(clientesNovos?.taxaConversaoNovos ?? 0)}
              metaTarget={metaGeral?.metaConversaoNovos ? Number(metaGeral.metaConversaoNovos) : undefined}
              isPct
            />
            <KpiCardComMeta
              label="Taxa Fat. Novos"
              value={loadingClientesNovos ? "..." : `${(clientesNovos as any)?.taxaFaturamentoNovos ?? 0}%`}
              sub="Fat. / Orçado (novos)"
              icon={Percent}
              color={!clientesNovos ? "#94a3b8" : Number((clientesNovos as any)?.taxaFaturamentoNovos) >= 30 ? "#22c55e" : Number((clientesNovos as any)?.taxaFaturamentoNovos) >= 15 ? "#f59e0b" : "#ef4444"}
              metaReal={Number((clientesNovos as any)?.taxaFaturamentoNovos ?? 0)}
              metaTarget={metaGeral?.metaTaxaFaturamentoNovos ? Number(metaGeral.metaTaxaFaturamentoNovos) : undefined}
              isPct
            />
            <KpiCardComMeta
              label="Ticket Médio Geral"
              value={`R$ ${Number(mesDados.ticketMedio ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              sub="Faturamento / Vendas realizadas"
              icon={TrendingUp}
              color="#6366f1"
              metaReal={Number(mesDados.ticketMedio ?? 0)}
              metaTarget={metaGeral?.metaTicketMedio ? Number(metaGeral.metaTicketMedio) : undefined}
              isCurrency
            />
            <KpiCardComMeta
              label="Ticket Médio Novos"
              value={(() => {
                const fat = Number((clientesNovos as any)?.faturamentoNovos ?? 0);
                const os = Number((clientesNovos as any)?.osNovos ?? 0);
                const ticket = os > 0 ? fat / os : 0;
                return loadingClientesNovos ? "..." : `R$ ${ticket.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
              })()}
              sub="Fat. novos / OS novos"
              icon={TrendingUp}
              color="#f59e0b"
              metaReal={(() => {
                const fat = Number((clientesNovos as any)?.faturamentoNovos ?? 0);
                const os = Number((clientesNovos as any)?.osNovos ?? 0);
                return os > 0 ? fat / os : 0;
              })()}
              metaTarget={metaGeral?.metaTicketMedioNovos ? Number(metaGeral.metaTicketMedioNovos) : undefined}
              isCurrency
            />
          </div>
        ) : null}

        {/* Gráfico de Evolução do Ticket Médio — ano inteiro */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Ticket Médio — Evolução {anoSelecionado}</h2>
          <p className="text-xs text-slate-400 mb-4">Ticket médio geral vs ticket médio de clientes novos por mês</p>
          {(loadingAno || loadingClientesNovosAno) ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm animate-pulse">Carregando dados...</div>
          ) : (() => {
            // Montar dados combinados: ticketMedio geral (de dadosAno) + ticketMedioNovos (de clientesNovosAno)
            const novosMap = new Map<number, number>();
            for (const n of (clientesNovosAno ?? [])) novosMap.set(n.mes, n.ticketMedioNovos);
            const chartData = (dadosAno ?? [])
              .filter((r: any) => r != null)
              .map((r: any) => ({
                label: r.label,
                mes: r.mes,
                ticketGeral: r.ticketMedio ?? 0,
                ticketNovos: novosMap.get(r.mes) ?? 0,
              }));
            if (chartData.length === 0) return (
              <div className="h-48">
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>
                      {errorAno
                        ? "⚠️ API MubiSys indisponível — não foi possível carregar os dados"
                        : "Sem dados para o período"}
                    </EmptyTitle>
                  </EmptyHeader>
                </Empty>
              </div>
            );
            return (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `R$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                      name,
                    ]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="ticketGeral"
                    name="Ticket Médio Geral"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#6366f1" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ticketNovos"
                    name="Ticket Médio Novos"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    strokeDasharray="5 3"
                    dot={{ r: 4, fill: "#f59e0b" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            );
          })()}
        </div>

        {/* Gráfico de Evolução dos últimos 6 meses */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Evolução — Últimos 6 Meses</h2>
          <p className="text-xs text-slate-400 mb-4">Cotações × Vendas × Faturamento × Taxa de Conversão</p>
          {loadingEvolucao ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm animate-pulse">
              Carregando dados do ERP...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={evolucao ?? []} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="cotacoes" name="Cotações" fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar yAxisId="left" dataKey="osGeradas" name="Vendas Realizadas" fill="#8b5cf6" radius={[3,3,0,0]} />
                <Line yAxisId="right" type="monotone" dataKey="taxaConversao" name="Taxa Conv. %" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="taxaFaturamento" name="Taxa Fat. %" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="4 2" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ─── COMPARAÇÃO DE MESES (Power BI Style) ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
            onClick={() => setShowComparaMeses(v => !v)}
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                <div className="w-1.5 h-5 rounded-sm bg-blue-500" />
                <div className="w-1.5 h-4 rounded-sm bg-purple-500" />
                <div className="w-1.5 h-6 rounded-sm bg-green-500" />
                <div className="w-1.5 h-3 rounded-sm bg-amber-500" />
              </div>
              <span className="text-sm font-semibold text-slate-700">Comparar Meses</span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Power BI</span>
            </div>
            <div className="flex items-center gap-2">
              {showComparaMeses && (
                <span className="text-xs text-blue-600 font-medium">{comparaMesesSelecionados.length} meses selecionados</span>
              )}
              {showComparaMeses ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {showComparaMeses && (
            <div className="border-t border-slate-100">
              {/* Seletor de meses */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Selecionar meses:</span>
                  <Select value={String(comparaAno)} onValueChange={v => setComparaAno(Number(v))}>
                    <SelectTrigger className="w-24 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2].map(a => (
                        <SelectItem key={a} value={String(a)} className="text-xs">{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1.5">
                    {MESES_NOMES.map((nome, idx) => {
                      const m = idx + 1;
                      const isSelected = comparaMesesSelecionados.some(s => s.mes === m && s.ano === comparaAno);
                      return (
                        <button
                          key={m}
                          onClick={() => {
                            setComparaMesesSelecionados(prev => {
                              const exists = prev.some(s => s.mes === m && s.ano === comparaAno);
                              if (exists) return prev.filter(s => !(s.mes === m && s.ano === comparaAno));
                              return [...prev, { mes: m, ano: comparaAno }].sort((a, b) =>
                                a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes
                              );
                            });
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                          }`}
                        >
                          {nome.slice(0, 3)}/{String(comparaAno).slice(2)}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setComparaMesesSelecionados([])}
                    className="text-xs text-red-500 hover:text-red-700 underline ml-auto"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* Conteúdo da comparação */}
              {comparaMesesSelecionados.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Selecione pelo menos um mês acima para comparar</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : loadingComparaMeses ? (
                <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Carregando dados...</div>
              ) : (comparaMesesDados ?? []).filter(Boolean).length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Sem dados para os meses selecionados</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (() => {
                const dados = ((comparaMesesDados ?? []).filter(Boolean) as any[]);

                return (
                  <div className="p-5 space-y-6">

                    {/* KPIs comparativos em cards */}
                    {(() => {
                      const cardDefs: { key: string; label: string; fmt: (v: number) => string; color: string; metaKey?: string; isNovos?: boolean }[] = [
                        { key: "cotacoes", label: "Cotações", fmt: (v) => String(Math.round(v)), color: "#3b82f6", metaKey: "metaCotacoes" },
                        { key: "osGeradas", label: "Vendas Realizadas", fmt: (v) => String(Math.round(v)), color: "#8b5cf6", metaKey: "metaOsGeradas" },
                        { key: "faturamento", label: "Faturamento", fmt: (v) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`, color: "#22c55e", metaKey: "metaFaturamento" },
                        { key: "taxaConversao", label: "Taxa Conv.", fmt: (v) => `${parseFloat(v.toFixed(1))}%`, color: "#f59e0b", metaKey: "metaConversao" },
                        { key: "taxaFaturamento", label: "Taxa Fat.", fmt: (v) => `${parseFloat(v.toFixed(1))}%`, color: "#ef4444", metaKey: "metaTaxaFaturamento" },
                        { key: "valorOrcado", label: "Valor Orçado", fmt: (v) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`, color: "#64748b", metaKey: "metaValorOrcado" },
                        { key: "ticketMedio", label: "Ticket Médio", fmt: (v) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`, color: "#6366f1", metaKey: "metaTicketMedio" },
                        { key: "osNovos", label: "OS (Novos)", fmt: (v) => String(Math.round(v)), color: "#0d9488", metaKey: "metaOsNovos", isNovos: true },
                        { key: "faturamentoNovos", label: "Fat. (Novos)", fmt: (v) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`, color: "#0891b2", metaKey: "metaFaturamentoNovos", isNovos: true },
                        { key: "ticketMedioNovos", label: "Ticket (Novos)", fmt: (v) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`, color: "#7c3aed", metaKey: "metaTicketMedioNovos", isNovos: true },
                        { key: "cotacoesNovos", label: "Cot. (Novos)", fmt: (v) => String(Math.round(v)), color: "#f97316", metaKey: "metaCotacoesNovos", isNovos: true },
                        { key: "taxaConversaoNovos", label: "Conv. Novos", fmt: (v) => `${parseFloat(v.toFixed(1))}%`, color: "#84cc16", metaKey: "metaConversaoNovos", isNovos: true },
                        { key: "taxaFaturamentoNovos", label: "Taxa Fat. Novos", fmt: (v) => `${parseFloat(v.toFixed(1))}%`, color: "#06b6d4", metaKey: "metaTaxaFaturamentoNovos", isNovos: true },
                      ];
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                          {cardDefs.map(({ key, label, fmt, color, metaKey, isNovos }) => {
                            const values = dados.map((d: any) => ({ label: d.label, value: d[key] ?? 0, mes: d.mes, ano: d.ano }));
                            const maxVal = Math.max(...values.map(v => v.value));
                            const minVal = Math.min(...values.map(v => v.value));
                            // Média geral (inclui todos os meses selecionados)
                            const valuesParaMedia = values;
                            const mediaGeral = valuesParaMedia.length > 0
                              ? valuesParaMedia.reduce((acc, v) => acc + v.value, 0) / valuesParaMedia.length
                              : null;
                            // Meta geral para este indicador
                            const metaGeralVal = metaKey && metaGeral?.[metaKey as keyof typeof metaGeral]
                              ? Number(metaGeral[metaKey as keyof typeof metaGeral])
                              : null;
                            return (
                              <div key={key} className={`rounded-xl border p-3 ${isNovos ? "bg-teal-50/60 border-teal-200" : "bg-slate-50 border-slate-200"}`}>
                                {/* Meta no topo */}
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${isNovos ? "text-teal-600" : "text-slate-500"}`}>{label}</p>
                                  {metaGeralVal ? (
                                    <span className="text-[9px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-500 font-medium">
                                      Meta: {fmt(metaGeralVal)}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="space-y-1.5">
                                  {/* Linha de média geral */}
                                  {mediaGeral !== null && valuesParaMedia.length > 0 && (
                                    <div className="flex items-center gap-2 rounded-lg px-2 py-1 bg-amber-100 border-2 border-amber-400 mb-2">
                                      <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-amber-500" />
                                      <span className="text-[11px] text-amber-800 shrink-0 w-12 font-bold">Média</span>
                                      <div className="flex-1 bg-amber-200 rounded-full h-2 overflow-hidden">
                                        <div
                                          className="h-full rounded-full bg-amber-500"
                                          style={{ width: maxVal > 0 ? `${(mediaGeral / maxVal) * 100}%` : "0%" }}
                                        />
                                      </div>
                                      <span className="text-[11px] font-extrabold shrink-0 text-amber-800">{fmt(mediaGeral)}</span>
                                      {metaGeralVal && (
                                        <span className={`text-[10px] font-extrabold shrink-0 ${mediaGeral >= metaGeralVal ? "text-green-700" : "text-red-600"}`}>
                                          {mediaGeral >= metaGeralVal ? `+${((mediaGeral / metaGeralVal) * 100 - 100).toFixed(0)}%` : `${((mediaGeral / metaGeralVal) * 100 - 100).toFixed(0)}%`}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {values.map((v, i) => {
                                    const isMesAtual = v.mes === MES_ATUAL && v.ano === ANO_ATUAL;
                                    const atingiu = !isMesAtual && metaGeralVal !== null && v.value >= metaGeralVal;
                                    const metaDiff = !isMesAtual && metaGeralVal !== null && metaGeralVal > 0
                                      ? ((v.value / metaGeralVal) * 100 - 100)
                                      : null;
                                    const metaDiffLabel = metaDiff !== null
                                      ? (metaDiff >= 0 ? `+${metaDiff.toFixed(0)}%` : `${metaDiff.toFixed(0)}%`)
                                      : null;
                                    return (
                                      <div key={i} className={`flex items-center gap-2 rounded px-1 py-0.5 ${atingiu ? "bg-green-50 border border-green-200" : ""}`}>
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: chartColor(i) }} />
                                        <span className="text-[10px] text-slate-500 shrink-0 w-12 truncate">{v.label}</span>
                                        <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                          <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                              width: maxVal > 0 ? `${(v.value / maxVal) * 100}%` : "0%",
                                              background: atingiu ? "#22c55e" : v.value === maxVal ? color : v.value === minVal && values.length > 1 ? "#94a3b8" : color + "99",
                                            }}
                                          />
                                        </div>
                                        <span className={`text-[10px] font-bold shrink-0 ${atingiu ? "text-green-700" : "text-slate-700"}`}>{fmt(v.value)}</span>
                                        {metaDiffLabel && (
                                          <span className={`text-[9px] font-bold shrink-0 ${atingiu ? "text-green-600" : metaDiff! >= -20 ? "text-amber-600" : "text-red-500"}`}>
                                            {metaDiffLabel}
                                          </span>
                                        )}
                                        {isMesAtual && metaGeralVal !== null && (
                                          <span className="text-[9px] text-slate-400 shrink-0 italic">em curso</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Gráfico de barras agrupadas: Cotações vs Vendas Realizadas */}
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold text-slate-700 mb-1">Cotações vs Vendas Realizadas por Mês</p>
                      <p className="text-[10px] text-slate-400 mb-3">Comparação direta do volume de cotações e OS aprovadas</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip content={<ChartTooltip format={fmtNum} />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="cotacoes" name="Cotações" fill="#3b82f6" radius={[4,4,0,0]} />
                          <Bar dataKey="osGeradas" name="Vendas Realizadas" fill="#8b5cf6" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Gráfico de linhas: Faturamento por mês */}
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold text-slate-700 mb-1">Faturamento vs Valor Orçado por Mês</p>
                      <p className="text-[10px] text-slate-400 mb-3">Evolução do faturamento gerado e valor total orçado</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <ComposedChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$${(v/1000).toFixed(0)}k`} />
                          <Tooltip
                            formatter={(value: any, name: string) => [
                              `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                              name,
                            ]}
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="faturamento" name="Faturamento" fill="#22c55e" radius={[4,4,0,0]} opacity={0.85} />
                          <Line type="monotone" dataKey="valorOrcado" name="Valor Orçado" stroke="#64748b" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 4 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Gráfico de linhas: Taxas de conversão */}
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold text-slate-700 mb-1">Taxas de Conversão e Faturamento por Mês</p>
                      <p className="text-[10px] text-slate-400 mb-3">Evolução das taxas de conversão (OS/Cotações) e faturamento (Fat/Orçado)</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 'auto']} />
                          <Tooltip
                            formatter={(value: any, name: string) => [`${Number(value).toFixed(1)}%`, name]}
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="taxaConversao" name="Taxa Conv. (OS/Cot.)" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 5, fill: "#f59e0b" }} activeDot={{ r: 7 }} />
                          <Line type="monotone" dataKey="taxaFaturamento" name="Taxa Fat. (Fat/Orç.)" stroke="#ef4444" strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 5, fill: "#ef4444" }} activeDot={{ r: 7 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Tabela comparativa */}
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-2">Tabela Comparativa Detalhada</p>
                      <Table className="text-xs">
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>Mês</TableHead>
                            <TableHead className="text-right">Cotações</TableHead>
                            <TableHead className="text-right">Vendas Realizadas</TableHead>
                            <TableHead className="text-right">Taxa Conv.</TableHead>
                            <TableHead className="text-right">Valor Orçado</TableHead>
                            <TableHead className="text-right">Faturamento</TableHead>
                            <TableHead className="text-right">Taxa Fat.</TableHead>
                            <TableHead className="text-right">Ticket Médio</TableHead>
                            <TableHead className="text-right text-teal-600">OS Novos</TableHead>
                            <TableHead className="text-right text-teal-600">Fat. Novos</TableHead>
                            <TableHead className="text-right text-teal-600">Ticket Novos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dados.map((r: any, i: number) => {
                            const isAtual = r.mes === mesSelecionado && r.ano === anoSelecionado;
                            const maxFat = Math.max(...dados.map((d: any) => d.faturamento ?? 0));
                            // Verificar se atingiu metas
                            const atingiuFat = metaGeral?.metaFaturamento && r.faturamento >= Number(metaGeral.metaFaturamento);
                            const atingiuOS = metaGeral?.metaOsGeradas && r.osGeradas >= Number(metaGeral.metaOsGeradas);
                            return (
                              <TableRow key={i} className={isAtual ? "bg-blue-50 font-semibold" : ""}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: chartColor(i) }} />
                                    <span className="text-slate-700">{r.label}</span>
                                    {isAtual && <Badge variant="secondary" className="text-[10px] py-0">atual</Badge>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-blue-700">{r.cotacoes}</TableCell>
                                <TableCell className={`text-right font-mono ${atingiuOS ? "text-green-700 font-bold" : "text-purple-700"}`}>
                                  {r.osGeradas}{atingiuOS ? " ✓" : ""}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={`font-bold ${
                                    r.taxaConversao >= 30 ? "text-green-600" : r.taxaConversao >= 15 ? "text-amber-600" : "text-red-600"
                                  }`}>{r.taxaConversao}%</span>
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-600">
                                  R$ {Number(r.valorOrcado).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className={`font-mono font-semibold ${atingiuFat ? "text-green-700" : "text-green-700"}`}>
                                      R$ {Number(r.faturamento).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{atingiuFat ? " ✓" : ""}
                                    </span>
                                    {maxFat > 0 && (
                                      <div className="w-16 bg-slate-100 rounded-full h-1 overflow-hidden">
                                        <div
                                          className="h-full rounded-full"
                                          style={{ width: `${(r.faturamento / maxFat) * 100}%`, background: atingiuFat ? "#22c55e" : "#86efac" }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={`font-bold ${
                                    r.taxaFaturamento >= 30 ? "text-green-600" : r.taxaFaturamento >= 15 ? "text-amber-600" : "text-red-600"
                                  }`}>{r.taxaFaturamento}%</span>
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-600">
                                  R$ {Number(r.ticketMedio).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-right font-mono text-teal-700">{r.osNovos ?? 0}</TableCell>
                                <TableCell className="text-right font-mono text-teal-700">
                                  R$ {Number(r.faturamentoNovos ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-right font-mono text-teal-700">
                                  R$ {Number(r.ticketMedioNovos ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                        <TableFooter>
                          {(() => {
                            const dadosParaMedia = dados;
                            if (dadosParaMedia.length === 0) return null;
                            const avg = (key: string) =>
                              dadosParaMedia.reduce((acc: number, d: any) => acc + (Number(d[key]) || 0), 0) / dadosParaMedia.length;
                            return (
                              <TableRow className="bg-amber-50">
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                    <span className="text-amber-700 font-bold text-xs">Média</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-amber-700">{avg("cotacoes").toFixed(0)}</TableCell>
                                <TableCell className="text-right font-mono font-bold text-amber-700">{avg("osGeradas").toFixed(0)}</TableCell>
                                <TableCell className="text-right font-bold text-amber-700">{avg("taxaConversao").toFixed(1)}%</TableCell>
                                <TableCell className="text-right font-mono font-bold text-amber-700">
                                  R$ {avg("valorOrcado").toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-amber-700">
                                  R$ {avg("faturamento").toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-right font-bold text-amber-700">{avg("taxaFaturamento").toFixed(1)}%</TableCell>
                                <TableCell className="text-right font-mono font-bold text-amber-700">
                                  R$ {avg("ticketMedio").toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-amber-700">{avg("osNovos").toFixed(0)}</TableCell>
                                <TableCell className="text-right font-mono font-bold text-amber-700">
                                  R$ {avg("faturamentoNovos").toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-amber-700">
                                  R$ {avg("ticketMedioNovos").toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </TableCell>
                              </TableRow>
                            );
                          })()}
                        </TableFooter>
                      </Table>
                    </div>

                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Comparativo Anual — todos os meses do ano */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
            onClick={() => setShowComparativo(v => !v)}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">
                Comparativo Anual — {anoSelecionado} (todos os meses)
              </span>
            </div>
            {showComparativo ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showComparativo && (
            <div className="px-5 pb-5">
              {loadingComparativo ? (
                <div className="h-32 flex items-center justify-center text-slate-400 text-sm animate-pulse">
                  Carregando comparativo...
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mês</TableHead>
                          <TableHead className="text-right">Cotações</TableHead>
                          <TableHead className="text-right">Vendas Realizadas</TableHead>
                          <TableHead className="text-right">Taxa Conv.</TableHead>
                          <TableHead className="text-right">Valor Orçado</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right">Taxa Fat.</TableHead>
                          <TableHead className="text-right">Ticket Médio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(comparativo ?? []).filter((r): r is NonNullable<typeof r> => r != null).map((r, i) => {
                          const isAtual = r.mes === mesSelecionado && r.ano === anoSelecionado;
                          return (
                            <TableRow key={i} className={isAtual ? "bg-blue-50 font-semibold" : ""}>
                              <TableCell className="text-slate-700">
                                {r.label}
                                {isAtual && <Badge variant="secondary" className="ml-2 text-[10px] py-0">atual</Badge>}
                              </TableCell>
                              <TableCell className="text-right font-mono text-blue-700">{r.cotacoes}</TableCell>
                              <TableCell className="text-right font-mono text-purple-700">{r.osGeradas}</TableCell>
                              <TableCell className="text-right">
                                <span className={`font-bold ${r.taxaConversao >= 30 ? "text-green-600" : r.taxaConversao >= 15 ? "text-amber-600" : "text-red-600"}`}>
                                  {r.taxaConversao}%
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-slate-600">
                                R$ {Number(r.valorOrcado).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </TableCell>
                              <TableCell className="text-right font-mono text-green-700 font-semibold">
                                R$ {Number(r.faturamento).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={`font-bold ${r.taxaFaturamento >= 30 ? "text-green-600" : r.taxaFaturamento >= 15 ? "text-amber-600" : "text-red-600"}`}>
                                  {r.taxaFaturamento}%
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-slate-600">
                                R$ {Number(r.ticketMedio).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={comparativo ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip format={fmtNum} />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="cotacoes" name="Cotações" fill="#3b82f6" radius={[3,3,0,0]} />
                      <Bar dataKey="osGeradas" name="Vendas Realizadas" fill="#8b5cf6" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          )}
        </div>


        {/* Top 3 Vendedores — destaque das duas taxas de conversão */}
        {vendedoresData.length >= 3 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-700">Top 3 Vendedores — {MESES_NOMES[mesSelecionado - 1]} {anoSelecionado}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {vendedoresData.slice(0, 3).map((v: any, i: number) => {
                const medalColors = ["#f59e0b", "#94a3b8", "#cd7f32"];
                const medalLabels = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"];
                // Dados de clientes novos para este vendedor — mesma normalização de
                // busca (exata ou case-insensitive) usada em vendedoresData acima
                const novosMapTop3 = (clientesNovos as any)?.porVendedorNovos ?? {};
                const keyNormTop3 = String(v.vendedorFull).trim().toLowerCase();
                const novos = (novosMapTop3[v.vendedorFull] ?? novosMapTop3[keyNormTop3] ??
                  Object.entries(novosMapTop3).find(([k]) => k.toLowerCase() === keyNormTop3)?.[1]) as {
                  clientesNovos: number; osNovos: number; faturamentoNovos: number;
                  cotacoesNovos: number; valorOrcadoNovos: number;
                  taxaConvNovos: number; taxaFatNovos: number;
                } | undefined;
                return (
                  <div key={v.vendedorFull} className="rounded-lg border-2 p-4 space-y-3" style={{ borderColor: medalColors[i] + "40", background: medalColors[i] + "08" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{medalLabels[i]}</span>
                      <div>
                        <p className="font-bold text-slate-800 text-sm leading-tight">{v.vendedorFull}</p>
                        <p className="text-xs text-slate-400">{v.cotacoes} cotações · {v.osGeradas} OS</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {/* Taxas gerais */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Conv. por Pedido</span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${v.taxa >= 30 ? "bg-green-100 text-green-700" : v.taxa >= 15 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                          {v.taxa}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Conv. Faturamento</span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${v.taxaFat >= 30 ? "bg-green-100 text-green-700" : v.taxaFat >= 15 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                          {v.taxaFat}%
                        </span>
                      </div>
                      <div className="pt-1 border-t border-slate-100">
                        <p className="text-xs text-slate-500">Faturamento</p>
                        <p className="font-bold text-green-700 text-sm">R$ {v.valorOs.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                      </div>
                      {/* Taxas de clientes novos */}
                      {novos && (
                        <>
                          <div className="pt-1 border-t border-slate-100">
                            <p className="text-xs font-semibold text-teal-600 mb-1.5">Clientes Novos ⭐ ({novos.clientesNovos} clientes · {novos.cotacoesNovos} cot. · {novos.osNovos} OS)</p>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-500">Conv. Pedido (Novos)</span>
                              <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${novos.taxaConvNovos >= 30 ? "bg-green-100 text-green-700" : novos.taxaConvNovos >= 15 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                                {novos.taxaConvNovos}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-500">Conv. Fat. (Novos)</span>
                              <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${novos.taxaFatNovos >= 30 ? "bg-green-100 text-green-700" : novos.taxaFatNovos >= 15 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                                {novos.taxaFatNovos}%
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Fat. Novos</p>
                            <p className="font-bold text-teal-700 text-sm">R$ {novos.faturamentoNovos.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Clientes Novos do mês com WhatsApp */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
            onClick={() => setShowClientesNovos(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-semibold text-slate-700">
                Clientes Novos — {MESES_NOMES[mesSelecionado - 1]} {anoSelecionado}
                {clientesNovos && (
                  <span className="ml-2 bg-teal-100 text-teal-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {clientesNovos.total} novos
                  </span>
                )}
              </span>
            </div>
            {showClientesNovos ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showClientesNovos && (
            <div className="border-t border-slate-100 p-5">
              {loadingClientesNovos ? (
                <div className="text-sm text-slate-400 py-4 text-center animate-pulse">Buscando clientes e telefones no ERP...</div>
              ) : !clientesNovos || clientesNovos.total === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Nenhum cliente novo identificado neste mês.</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 mb-3">
                    Empresas que aparecem pela primeira vez no histórico de OS — clique no ícone para abrir conversa no WhatsApp.
                  </p>
                  <Table className="text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Contato</TableHead>
                          <TableHead>Cidade</TableHead>
                          <TableHead>UF</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>OS</TableHead>
                          <TableHead className="text-right">Valor OS</TableHead>
                          <TableHead className="text-center">WhatsApp</TableHead>
                          <TableHead className="text-center" title="Marque quando entrar em contato com o cliente">Contatado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(clientesNovos.lista ?? []).map((c: any, i: number) => {
                          const empresaKey = (c.empresa ?? "").toLowerCase().trim();
                          const jaContatado = contatadosMap?.[empresaKey]?.contatado ?? false;
                          return (
                          <TableRow key={i} className={jaContatado ? 'bg-green-50 hover:bg-green-100' : ''}>
                            <TableCell className="font-medium text-slate-800">{c.empresa}</TableCell>
                            <TableCell className="text-slate-600">{c.contato || <span className="text-slate-300">—</span>}</TableCell>
                            <TableCell className="text-slate-600">{c.cidade || <span className="text-slate-300">—</span>}</TableCell>
                            <TableCell className="text-slate-600 font-medium">{c.estado || <span className="text-slate-300">—</span>}</TableCell>
                            <TableCell className="text-slate-600">{c.vendedor}</TableCell>
                            <TableCell className="font-mono text-blue-700">{c.osNumero ?? "—"}</TableCell>
                            <TableCell className="text-right font-mono text-green-700">
                              {c.valorOs ? `R$ ${Number(c.valorOs).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              {c.whatsappLink ? (
                                <a
                                  href={c.whatsappLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full transition-colors"
                                  title={c.telefone}
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  {c.telefone.replace(/\D/g, "").slice(-9).replace(/(\d{5})(\d{4})/, "$1-$2")}
                                </a>
                              ) : (
                                <span className="text-slate-300 flex items-center justify-center gap-1">
                                  <Phone className="w-3 h-3" /> sem tel.
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <button
                                onClick={() => setContatadoMut.mutate({ empresa: c.empresa, mes: mesSelecionado, ano: anoSelecionado, contatado: !jaContatado })}
                                disabled={setContatadoMut.isPending}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                                  jaContatado
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'border-slate-300 hover:border-green-400 bg-white'
                                }`}
                                title={jaContatado ? 'Marcar como não contatado' : 'Marcar como contatado'}
                              >
                                {jaContatado && <Check className="w-3 h-3" />}
                              </button>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Desempenho por Vendedor com Metas */}
        {vendedoresData.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-700">
                  Desempenho por Vendedor — {MESES_NOMES[mesSelecionado - 1]} {anoSelecionado}
                </h2>
              </div>
              <Button
                variant={editingMetas ? "default" : "outline"}
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => setEditingMetas(v => !v)}
              >
                <Target className="w-3.5 h-3.5" />
                {editingMetas ? "Fechar Metas" : "Editar Metas"}
              </Button>
            </div>

            {editingMetas && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                Clique em qualquer valor de meta para editar. Pressione Enter para salvar ou Esc para cancelar.
              </div>
            )}

            <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Cotações</TableHead>
                    <TableHead className="text-right">Vendas Realizadas</TableHead>
                    <TableHead className="text-right">Taxa Conv.</TableHead>
                    <TableHead className="text-right">Valor Orçado</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Taxa Fat.</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                    <TableHead className="text-right text-teal-600 text-[10px]">Conv. Novos</TableHead>
                    <TableHead className="text-right text-teal-600 text-[10px]">Fat. Novos</TableHead>
                    {editingMetas && <TableHead></TableHead>}
                  </TableRow>
                  {editingMetas && (
                    <TableRow className="bg-blue-50/60">
                      <TableCell className="text-blue-600 font-semibold text-[10px] uppercase tracking-wide flex items-center gap-1">
                        <Target className="w-3 h-3" /> Metas
                      </TableCell>
                      <TableCell className="text-right text-blue-500 text-[10px]">Nº cotações</TableCell>
                      <TableCell className="text-right text-blue-500 text-[10px]">Nº vendas</TableCell>
                      <TableCell className="text-right text-blue-500 text-[10px]">% conversão</TableCell>
                      <TableCell className="text-right text-blue-500 text-[10px]">—</TableCell>
                      <TableCell className="text-right text-blue-500 text-[10px]">R$ faturamento</TableCell>
                      <TableCell className="text-right text-blue-500 text-[10px]">—</TableCell>
                      <TableCell className="text-right text-blue-500 text-[10px]">R$ ticket médio</TableCell>
                      <TableCell className="text-right text-teal-600 text-[10px]">% conv. novos</TableCell>
                      <TableCell className="text-right text-teal-600 text-[10px]">% fat. novos</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                </TableHeader>
                <TableBody>
                  {vendedoresData.map((v, i) => {
                    const meta = metasPorVendedor[v.vendedorFull];
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-slate-700" title={v.vendedorFull}>{v.vendedor}</TableCell>

                        {/* Cotações */}
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono text-blue-700 font-semibold">{v.cotacoes}</span>
                            {editingMetas && (
                              <MetaCell
                                value={meta?.metaCotacoes ?? null}
                                onSave={val => handleSaveMeta(v.vendedorFull, "metaCotacoes", val)}
                              />
                            )}
                            {!editingMetas && meta?.metaCotacoes && (
                              <ProgressBar real={v.cotacoes} meta={meta.metaCotacoes} color="#3b82f6" />
                            )}
                          </div>
                        </TableCell>

                        {/* Vendas Realizadas */}
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono text-purple-700">{v.osGeradas}</span>
                            {editingMetas && (
                              <MetaCell
                                value={meta?.metaVendas ?? null}
                                onSave={val => handleSaveMeta(v.vendedorFull, "metaVendas", val)}
                              />
                            )}
                            {!editingMetas && meta?.metaVendas && (
                              <ProgressBar real={v.osGeradas} meta={meta.metaVendas} color="#8b5cf6" />
                            )}
                          </div>
                        </TableCell>

                        {/* Taxa Conversão */}
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={`font-bold ${v.taxa >= 30 ? "text-green-600" : v.taxa >= 15 ? "text-amber-600" : "text-red-600"}`}>
                              {v.taxa}%
                            </span>
                            {editingMetas && (
                              <MetaCell
                                value={meta?.metaConversao ? Number(meta.metaConversao) : null}
                                onSave={val => handleSaveMeta(v.vendedorFull, "metaConversao", val)}
                              />
                            )}
                            {!editingMetas && meta?.metaConversao && (
                              <ProgressBar real={v.taxa} meta={Number(meta.metaConversao)} color="#22c55e" />
                            )}
                          </div>
                        </TableCell>

                        {/* Valor Orçado */}
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono text-slate-500">
                              R$ {v.valorOrc.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                            {editingMetas && (
                              <MetaCell
                                value={meta?.metaValorOrcado ? Number(meta.metaValorOrcado) : null}
                                onSave={val => handleSaveMeta(v.vendedorFull, "metaValorOrcado", val)}
                              />
                            )}
                            {!editingMetas && meta?.metaValorOrcado && (
                              <ProgressBar real={v.valorOrc} meta={Number(meta.metaValorOrcado)} color="#64748b" />
                            )}
                          </div>
                        </TableCell>

                        {/* Faturamento */}
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono text-green-700 font-semibold">
                              R$ {v.valorOs.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                            {editingMetas && (
                              <MetaCell
                                value={meta?.metaFaturamento ? Number(meta.metaFaturamento) : null}
                                onSave={val => handleSaveMeta(v.vendedorFull, "metaFaturamento", val)}
                              />
                            )}
                            {!editingMetas && meta?.metaFaturamento && (
                              <ProgressBar real={v.valorOs} meta={Number(meta.metaFaturamento)} color="#22c55e" />
                            )}
                          </div>
                        </TableCell>

                        {/* Taxa Faturamento */}
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={`font-bold ${v.taxaFat >= 30 ? "text-green-600" : v.taxaFat >= 15 ? "text-amber-600" : "text-red-600"}`}>
                              {v.taxaFat}%
                            </span>
                            {editingMetas && (
                              <MetaCell
                                value={meta?.metaTaxaFaturamento ? Number(meta.metaTaxaFaturamento) : null}
                                onSave={val => handleSaveMeta(v.vendedorFull, "metaTaxaFaturamento", val)}
                              />
                            )}
                            {!editingMetas && meta?.metaTaxaFaturamento && (
                              <ProgressBar real={v.taxaFat} meta={Number(meta.metaTaxaFaturamento)} color="#f59e0b" />
                            )}
                          </div>
                        </TableCell>

                        {/* Ticket Médio */}
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono text-slate-600">
                              R$ {v.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                            {editingMetas && (
                              <MetaCell
                                value={meta?.metaTicketMedio ? Number(meta.metaTicketMedio) : null}
                                onSave={val => handleSaveMeta(v.vendedorFull, "metaTicketMedio", val)}
                              />
                            )}
                            {!editingMetas && meta?.metaTicketMedio && (
                              <ProgressBar real={v.ticketMedio} meta={Number(meta.metaTicketMedio)} color="#64748b" />
                            )}
                          </div>
                        </TableCell>
                        {/* Conv. Novos — sempre visível */}
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-bold text-teal-700">{v.taxaConversaoNovos ?? 0}%</span>
                            {editingMetas && (
                              <MetaCell
                                value={meta?.metaConversaoNovos ? Number(meta.metaConversaoNovos) : null}
                                onSave={val => handleSaveMeta(v.vendedorFull, "metaConversaoNovos", val)}
                              />
                            )}
                            {!editingMetas && meta?.metaConversaoNovos && (
                              <ProgressBar real={v.taxaConversaoNovos ?? 0} meta={Number(meta.metaConversaoNovos)} color="#0d9488" />
                            )}
                          </div>
                        </TableCell>

                        {/* Fat. Novos — sempre visível */}
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-bold text-cyan-700">{v.taxaFaturamentoNovos ?? 0}%</span>
                            {editingMetas && (
                              <MetaCell
                                value={meta?.metaTaxaFaturamentoNovos ? Number(meta.metaTaxaFaturamentoNovos) : null}
                                onSave={val => handleSaveMeta(v.vendedorFull, "metaTaxaFaturamentoNovos", val)}
                              />
                            )}
                            {!editingMetas && meta?.metaTaxaFaturamentoNovos && (
                              <ProgressBar real={v.taxaFaturamentoNovos ?? 0} meta={Number(meta.metaTaxaFaturamentoNovos)} color="#0891b2" />
                            )}
                          </div>
                        </TableCell>

                        {/* Botão excluir meta do vendedor */}
                        {editingMetas && (
                          <TableCell className="text-center">
                            {meta?.id ? (
                              <button
                                onClick={() => {
                                  if (confirm(`Excluir todas as metas de ${v.vendedorFull} para ${MESES_NOMES[mesSelecionado - 1]}/${anoSelecionado}?`)) {
                                    deleteMeta.mutate({ id: meta.id });
                                  }
                                }}
                                className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                                title="Excluir metas deste vendedor"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-slate-200 text-xs">—</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  {/* Linha de Metas Gerais */}
                  {editingMetas && (
                    <TableRow className="bg-indigo-50">
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="text-xs font-bold text-indigo-700">META GERAL</span>
                        </div>
                        <p className="text-[10px] text-indigo-400 mt-0.5">Metas globais da empresa</p>
                      </TableCell>
                      {/* Meta Cotações */}
                      <TableCell className="text-right">
                        <MetaCell
                          value={metaGeral?.metaCotacoes ?? null}
                          onSave={val => handleSaveMeta("GERAL", "metaCotacoes", val)}
                        />
                      </TableCell>
                      {/* Meta Vendas Realizadas */}
                      <TableCell className="text-right">
                        <MetaCell
                          value={metaGeral?.metaOsGeradas ?? null}
                          onSave={val => handleSaveMeta("GERAL", "metaOsGeradas", val)}
                        />
                      </TableCell>
                      {/* Meta Taxa Conversão */}
                      <TableCell className="text-right">
                        <MetaCell
                          value={metaGeral?.metaConversao ? Number(metaGeral.metaConversao) : null}
                          onSave={val => handleSaveMeta("GERAL", "metaConversao", val)}
                        />
                      </TableCell>
                      {/* Meta Valor Orçado */}
                      <TableCell className="text-right">
                        <MetaCell
                          value={metaGeral?.metaValorOrcado ? Number(metaGeral.metaValorOrcado) : null}
                          onSave={val => handleSaveMeta("GERAL", "metaValorOrcado", val)}
                        />
                      </TableCell>
                      {/* Meta Faturamento */}
                      <TableCell className="text-right">
                        <MetaCell
                          value={metaGeral?.metaFaturamento ? Number(metaGeral.metaFaturamento) : null}
                          onSave={val => handleSaveMeta("GERAL", "metaFaturamento", val)}
                        />
                      </TableCell>
                      {/* Meta Taxa Faturamento */}
                      <TableCell className="text-right">
                        <MetaCell
                          value={metaGeral?.metaTaxaFaturamento ? Number(metaGeral.metaTaxaFaturamento) : null}
                          onSave={val => handleSaveMeta("GERAL", "metaTaxaFaturamento", val)}
                        />
                      </TableCell>
                      {/* Meta Ticket Médio */}
                      <TableCell className="text-right">
                        <MetaCell
                          value={metaGeral?.metaTicketMedio ? Number(metaGeral.metaTicketMedio) : null}
                          onSave={val => handleSaveMeta("GERAL", "metaTicketMedio", val)}
                        />
                      </TableCell>
                      {/* Meta Taxa Conversão Novos */}
                      <TableCell className="text-right">
                        <MetaCell
                          value={metaGeral?.metaConversaoNovos ? Number(metaGeral.metaConversaoNovos) : null}
                          onSave={val => handleSaveMeta("GERAL", "metaConversaoNovos", val)}
                        />
                      </TableCell>
                      {/* Meta Taxa Faturamento Novos */}
                      <TableCell className="text-right">
                        <MetaCell
                          value={metaGeral?.metaTaxaFaturamentoNovos ? Number(metaGeral.metaTaxaFaturamentoNovos) : null}
                          onSave={val => handleSaveMeta("GERAL", "metaTaxaFaturamentoNovos", val)}
                        />
                      </TableCell>
                      {editingMetas && (
                        <TableCell className="text-center">
                          {metaGeral?.id ? (
                            <button
                              onClick={() => {
                                if (confirm("Excluir metas gerais da empresa para este mês?")) {
                                  deleteMeta.mutate({ id: metaGeral.id });
                                }
                              }}
                              className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                              title="Excluir metas gerais"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-slate-200 text-xs">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )}
                  {!editingMetas && metaGeral && (
                    <TableRow className="bg-indigo-50/50">
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Target className="w-3 h-3 text-indigo-500" />
                          <span className="text-[11px] font-bold text-indigo-600">META GERAL</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {metaGeral.metaCotacoes ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[11px] font-mono text-indigo-600">{metaGeral.metaCotacoes}</span>
                            <MetaBadge real={mesDados?.cotacoes ?? 0} meta={metaGeral.metaCotacoes} />
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {metaGeral.metaOsGeradas ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[11px] font-mono text-indigo-600">{metaGeral.metaOsGeradas}</span>
                            <MetaBadge real={mesDados?.osGeradas ?? 0} meta={metaGeral.metaOsGeradas} />
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {metaGeral.metaConversao ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[11px] font-mono text-indigo-600">{Number(metaGeral.metaConversao)}%</span>
                            <MetaBadge real={Number(mesDados?.taxaConversao ?? 0)} meta={Number(metaGeral.metaConversao)} />
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {metaGeral.metaValorOrcado ? (
                          <span className="text-[11px] font-mono text-indigo-600">
                            R$ {Number(metaGeral.metaValorOrcado).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {metaGeral.metaFaturamento ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[11px] font-mono text-indigo-600">
                              R$ {Number(metaGeral.metaFaturamento).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                            <MetaBadge real={mesDados?.faturamento ?? 0} meta={Number(metaGeral.metaFaturamento)} />
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {metaGeral.metaTaxaFaturamento ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[11px] font-mono text-indigo-600">{Number(metaGeral.metaTaxaFaturamento)}%</span>
                            <MetaBadge real={Number(mesDados?.taxaFaturamento ?? 0)} meta={Number(metaGeral.metaTaxaFaturamento)} />
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {metaGeral.metaTicketMedio ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[11px] font-mono text-indigo-600">
                              R$ {Number(metaGeral.metaTicketMedio).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </TableCell>
                      {/* Conv. Novos */}
                      <TableCell className="text-right">
                        {metaGeral.metaConversaoNovos ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[11px] font-mono text-teal-700">{Number(metaGeral.metaConversaoNovos)}%</span>
                            <MetaBadge real={Number((clientesNovos as any)?.taxaConversaoNovos ?? 0)} meta={Number(metaGeral.metaConversaoNovos)} />
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </TableCell>
                      {/* Fat. Novos */}
                      <TableCell className="text-right">
                        {metaGeral.metaTaxaFaturamentoNovos ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[11px] font-mono text-teal-700">{Number(metaGeral.metaTaxaFaturamentoNovos)}%</span>
                            <MetaBadge real={Number((clientesNovos as any)?.taxaFaturamentoNovos ?? 0)} meta={Number(metaGeral.metaTaxaFaturamentoNovos)} />
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell className="text-slate-700">TOTAL</TableCell>
                    <TableCell className="text-right font-mono text-blue-700">{mesDados?.cotacoes ?? 0}</TableCell>
                    <TableCell className="text-right font-mono text-purple-700">{mesDados?.osGeradas ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold ${Number(mesDados?.taxaConversao) >= 30 ? "text-green-600" : Number(mesDados?.taxaConversao) >= 15 ? "text-amber-600" : "text-red-600"}`}>
                        {mesDados?.taxaConversao ?? 0}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-600">
                      R$ {(mesDados?.valorOrcado ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-700">
                      R$ {(mesDados?.faturamento ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold ${Number(mesDados?.taxaFaturamento) >= 30 ? "text-green-600" : Number(mesDados?.taxaFaturamento) >= 15 ? "text-amber-600" : "text-red-600"}`}>
                        {mesDados?.taxaFaturamento ?? 0}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-600">
                      {mesDados?.osGeradas && mesDados.osGeradas > 0
                        ? `R$ ${Math.round((mesDados.faturamento ?? 0) / mesDados.osGeradas).toLocaleString("pt-BR")}`
                        : "—"}
                    </TableCell>
                    {/* Conv. Novos total */}
                    <TableCell className="text-right">
                      <span className={`font-bold ${Number((clientesNovos as any)?.taxaConversaoNovos ?? 0) >= 30 ? "text-green-600" : Number((clientesNovos as any)?.taxaConversaoNovos ?? 0) >= 15 ? "text-amber-600" : "text-teal-700"}`}>
                        {(clientesNovos as any)?.taxaConversaoNovos ?? 0}%
                      </span>
                    </TableCell>
                    {/* Fat. Novos total */}
                    <TableCell className="text-right">
                      <span className={`font-bold ${Number((clientesNovos as any)?.taxaFaturamentoNovos ?? 0) >= 30 ? "text-green-600" : Number((clientesNovos as any)?.taxaFaturamentoNovos ?? 0) >= 15 ? "text-amber-600" : "text-cyan-700"}`}>
                        {(clientesNovos as any)?.taxaFaturamentoNovos ?? 0}%
                      </span>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>

            {/* Gráfico de faturamento por vendedor */}
            <div className="mt-6">
              <p className="text-xs text-slate-500 mb-3">Faturamento Gerado × Valor Orçado por Vendedor</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={vendedoresData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="vendedor" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip format={fmtBrl} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="valorOrc" name="R$ Orçado" fill="#94a3b8" radius={[3,3,0,0]} />
                  <Bar dataKey="valorOs" name="R$ Faturamento" fill="#22c55e" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ─── Relatório: 4 Taxas de Conversão por Vendedor ─────────────────── */}
        {vendedoresData.length > 0 && (() => {
          const novosMap = (clientesNovos as any)?.porVendedorNovos ?? {};
          // Normalizar chaves do mapa de novos para lookup case-insensitive
          const novosLower: Record<string, any> = {};
          for (const k of Object.keys(novosMap)) novosLower[k.toLowerCase()] = novosMap[k];
          return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-5 border-b border-slate-100">
                <Percent className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-semibold text-slate-700">
                  Relatório de Taxas de Conversão — {MESES_NOMES[mesSelecionado - 1]} {anoSelecionado}
                </h2>
                <span className="ml-auto text-xs text-slate-400">Todos os vendedores · 4 taxas</span>
              </div>
              <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Cot.</TableHead>
                      <TableHead className="text-right">OS</TableHead>
                      <TableHead className="text-right text-blue-600">Conv. Pedido</TableHead>
                      <TableHead className="text-right text-blue-600">Conv. Fat.</TableHead>
                      <TableHead className="text-right text-yellow-600">Cot. ⭐</TableHead>
                      <TableHead className="text-right text-yellow-600">OS ⭐</TableHead>
                      <TableHead className="text-right text-yellow-600">Conv. Pedido ⭐</TableHead>
                      <TableHead className="text-right text-yellow-600">Conv. Fat. ⭐</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendedoresData.map((v: any, i: number) => {
                      const novos = novosLower[v.vendedorFull.toLowerCase()] as any;
                      const taxaConvN = novos?.taxaConvNovos ?? 0;
                      const taxaFatN = novos?.taxaFatNovos ?? 0;
                      const taxaColor = (t: number) =>
                        t >= 30 ? "text-green-600" : t >= 15 ? "text-amber-600" : "text-red-500";
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-slate-800">{v.vendedorFull}</TableCell>
                          <TableCell className="text-right font-mono text-slate-600">{v.cotacoes}</TableCell>
                          <TableCell className="text-right font-mono text-slate-600">{v.osGeradas}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-bold ${taxaColor(v.taxa)}`}>{v.taxa}%</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-bold ${taxaColor(v.taxaFat)}`}>{v.taxaFat}%</span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-yellow-700">
                            {novos ? novos.cotacoesNovos : <span className="text-slate-300">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-yellow-700">
                            {novos ? novos.osNovos : <span className="text-slate-300">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {novos
                              ? <span className={`font-bold ${taxaColor(taxaConvN)}`}>{taxaConvN}%</span>
                              : <span className="text-slate-300">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {novos
                              ? <span className={`font-bold ${taxaColor(taxaFatN)}`}>{taxaFatN}%</span>
                              : <span className="text-slate-300">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="text-slate-700">TOTAL</TableCell>
                      <TableCell className="text-right font-mono text-slate-700">{mesDados?.cotacoes ?? 0}</TableCell>
                      <TableCell className="text-right font-mono text-slate-700">{mesDados?.osGeradas ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold ${ Number(mesDados?.taxaConversao) >= 30 ? "text-green-600" : Number(mesDados?.taxaConversao) >= 15 ? "text-amber-600" : "text-red-500"}`}>
                          {mesDados?.taxaConversao ?? 0}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold ${ Number(mesDados?.taxaFaturamento) >= 30 ? "text-green-600" : Number(mesDados?.taxaFaturamento) >= 15 ? "text-amber-600" : "text-red-500"}`}>
                          {mesDados?.taxaFaturamento ?? 0}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-yellow-700">{clientesNovos?.cotacoesNovos ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-yellow-700">{clientesNovos?.osNovos ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold ${ Number(clientesNovos?.taxaConversaoNovos) >= 30 ? "text-green-600" : Number(clientesNovos?.taxaConversaoNovos) >= 15 ? "text-amber-600" : "text-red-500"}`}>
                          {clientesNovos?.taxaConversaoNovos ?? 0}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold ${ Number((clientesNovos as any)?.taxaFaturamentoNovos) >= 30 ? "text-green-600" : Number((clientesNovos as any)?.taxaFaturamentoNovos) >= 15 ? "text-amber-600" : "text-red-500"}`}>
                          {(clientesNovos as any)?.taxaFaturamentoNovos ?? 0}%
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              <p className="text-xs text-slate-400 px-5 py-3">⭐ = métricas exclusivas de clientes novos (sem compra anterior)</p>
            </div>
          );
        })()}

        {/* ─── Dashboard: Clientes Novos por Vendedor ──────────────────────── */}
        {(() => {
          const novosMap = (clientesNovos as any)?.porVendedorNovos ?? {};
          const vendedoresNovos = Object.entries(novosMap) as [string, any][];
          if (vendedoresNovos.length === 0) return null;
          const taxaColor = (t: number) =>
            t >= 30 ? "text-green-600" : t >= 15 ? "text-amber-600" : "text-red-500";
          const taxaBg = (t: number) =>
            t >= 30 ? "bg-green-50 border-green-200" : t >= 15 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
          return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-5 border-b border-slate-100">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-400" />
                <h2 className="text-sm font-semibold text-slate-700">
                  Dashboard Clientes Novos por Vendedor — {MESES_NOMES[mesSelecionado - 1]} {anoSelecionado}
                </h2>
                <span className="ml-auto text-xs text-slate-400">{vendedoresNovos.length} vendedores com novos clientes</span>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {vendedoresNovos
                  .sort((a, b) => (b[1].clientesNovos ?? 0) - (a[1].clientesNovos ?? 0))
                  .map(([nome, stats]: [string, any]) => (
                    <div key={nome} className="rounded-xl border border-yellow-200 bg-yellow-50/40 p-4 space-y-3">
                      {/* Cabeçalho do card */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-800 leading-tight">{nome}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {stats.clientesNovos} cliente{stats.clientesNovos !== 1 ? "s" : ""} novo{stats.clientesNovos !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-400 mt-0.5 shrink-0" />
                      </div>

                      {/* Cotações e OS */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white rounded-lg border border-slate-200 p-2.5 text-center">
                          <p className="text-xs text-slate-400 mb-0.5">Cotações</p>
                          <p className="text-lg font-bold text-blue-600">{stats.cotacoesNovos ?? 0}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-slate-200 p-2.5 text-center">
                          <p className="text-xs text-slate-400 mb-0.5">Vendas Realizadas</p>
                          <p className="text-lg font-bold text-purple-600">{stats.osNovos ?? 0}</p>
                        </div>
                      </div>

                      {/* Taxas de conversão */}
                      <div className="space-y-1.5">
                        <div className={`flex items-center justify-between rounded-lg border px-3 py-1.5 ${taxaBg(stats.taxaConvNovos ?? 0)}`}>
                          <span className="text-xs text-slate-600">Conv. por Pedido</span>
                          <span className={`text-sm font-bold ${taxaColor(stats.taxaConvNovos ?? 0)}`}>
                            {stats.taxaConvNovos ?? 0}%
                          </span>
                        </div>
                        <div className={`flex items-center justify-between rounded-lg border px-3 py-1.5 ${taxaBg(stats.taxaFatNovos ?? 0)}`}>
                          <span className="text-xs text-slate-600">Conv. Faturamento</span>
                          <span className={`text-sm font-bold ${taxaColor(stats.taxaFatNovos ?? 0)}`}>
                            {stats.taxaFatNovos ?? 0}%
                          </span>
                        </div>
                      </div>

                      {/* Faturamento */}
                      <div className="border-t border-yellow-200 pt-2.5">
                        <p className="text-xs text-slate-500 mb-0.5">Faturamento (novos)</p>
                        <p className="text-base font-bold text-green-600">
                          R$ {Number(stats.faturamentoNovos ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        {stats.valorOrcadoNovos > 0 && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            de R$ {Number(stats.valorOrcadoNovos).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} orçados
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })()}

        {/* ─── Gráfico: Faturamento Novos vs Recorrentes ──────────────────── */}
        {comparativoAnual.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-teal-600" />
              <h2 className="text-sm font-semibold text-slate-700">
                Faturamento: Novos vs Recorrentes — {anoSelecionado}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Faturamento mensal dividido entre clientes novos (1ª compra) e recorrentes (compraram antes)
            </p>
            {(() => {
              // Para cada mês do ano, calcular faturamento recorrente = total - novos
              // Nota: getClientesNovos só busca 1 mês por vez; aqui usamos os dados do banco
              // O faturamento de novos por mês está disponível apenas para o mês selecionado
              // Para o gráfico anual, usamos comparativoAnual (faturamento total por mês)
              // e marcamos o mês selecionado com o split novos/recorrentes
              const chartData = comparativoAnual.map((r: any) => {
                const isSelected = r.mes === mesSelecionado && r.ano === anoSelecionado;
                const fatNovos = isSelected ? ((clientesNovos as any)?.faturamentoNovos ?? 0) : 0;
                const fatRecorrentes = Math.max(0, (r.faturamento ?? 0) - fatNovos);
                return {
                  label: r.label,
                  mes: r.mes,
                  fatNovos: isSelected ? parseFloat(fatNovos.toFixed(0)) : null,
                  fatRecorrentes: isSelected ? parseFloat(fatRecorrentes.toFixed(0)) : parseFloat((r.faturamento ?? 0).toFixed(0)),
                  faturamentoTotal: parseFloat((r.faturamento ?? 0).toFixed(0)),
                  isSelected,
                };
              });
              return (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: any, name: string) => [
                          `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                          name,
                        ]}
                        labelFormatter={(label) => `Mês: ${label}`}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="fatRecorrentes" name="Recorrentes" fill="#3b82f6" stackId="a" radius={[0,0,0,0]} />
                      <Bar dataKey="fatNovos" name="Novos ⭐" fill="#f59e0b" stackId="a" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-slate-400 text-center">
                    ⭐ Novos visível apenas no mês selecionado (requer cálculo individual por mês). Selecione cada mês para ver o split.
                  </p>
                </div>
              );
            })()}
          </div>
        )}

        {/* ─── Gerenciamento de Overrides de Clientes ──────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
            onClick={() => setShowOverrides(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-slate-700">
                Correções Manuais de Clientes
                {clienteOverridesList && clienteOverridesList.length > 0 && (
                  <span className="ml-2 bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {clienteOverridesList.length} override{clienteOverridesList.length !== 1 ? "s" : ""}
                  </span>
                )}
              </span>
            </div>
            {showOverrides ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showOverrides && (
            <div className="border-t border-slate-100 p-5 space-y-5">
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
                <strong>Para que serve?</strong> Se um cliente comprou antes de jan/2024 (fora do histórico importado), ele aparece como "novo" incorretamente.
                Aqui você pode marcá-lo como <strong>Recorrente</strong> para que não seja contabilizado como cliente novo.
                Também é possível forçar um cliente como <strong>Novo</strong> caso necessário.
              </div>

              {/* Clientes novos do mês — botão para marcar como recorrente */}
              {clientesNovos && clientesNovos.lista && clientesNovos.lista.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                    Clientes identificados como novos em {MESES_NOMES[mesSelecionado - 1]}/{anoSelecionado}
                  </h3>
                  <div className="overflow-x-auto">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead className="text-center">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientesNovos.lista.map((c: any, i: number) => {
                          const jaTemOverride = (clienteOverridesList ?? []).some(
                            (ov: any) => ov.empresaOriginal === c.empresa
                          );
                          return (
                            <TableRow key={i} className={jaTemOverride ? "bg-orange-50" : ""}>
                              <TableCell className="font-medium text-slate-800">
                                {c.empresa}
                                {jaTemOverride && (
                                  <Badge variant="outline" className="ml-2 text-[10px] py-0 border-orange-300 text-orange-600">override</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-slate-600">{c.vendedor}</TableCell>
                              <TableCell className="text-center">
                                {!jaTemOverride ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                                    onClick={() => {
                                      setOverrideDialog({ empresa: c.empresa, vendedor: c.vendedor });
                                      setOverrideMotivoInput("");
                                    }}
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    Marcar Recorrente
                                  </Button>
                                ) : (
                                  <span className="text-orange-500 text-xs font-medium">✓ Corrigido</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Lista de overrides existentes */}
              {clienteOverridesList && clienteOverridesList.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                    Overrides cadastrados ({clienteOverridesList.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Por</TableHead>
                          <TableHead className="text-center">Remover</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clienteOverridesList.map((ov: any) => (
                          <TableRow key={ov.id}>
                            <TableCell className="font-medium text-slate-800">{ov.empresaOriginal}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={ov.status === "recorrente" ? "border-blue-300 text-blue-700 bg-blue-50" : "border-teal-300 text-teal-700 bg-teal-50"}
                              >
                                {ov.status === "recorrente" ? "Recorrente" : "Novo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-500 max-w-[200px] truncate">{ov.motivo ?? "—"}</TableCell>
                            <TableCell className="text-slate-500">{ov.criadoPor ?? "—"}</TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 border-red-300 text-red-600 hover:bg-red-50"
                                onClick={() => setDeleteOverrideId(ov.id)}
                              >
                                <X className="w-3 h-3" />
                                Remover
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {(!clienteOverridesList || clienteOverridesList.length === 0) && (!clientesNovos || clientesNovos.lista.length === 0) && (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Nenhum override cadastrado e nenhum cliente novo no mês selecionado.</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          )}
        </div>

        {/* Dialog para confirmar override */}
        <Dialog open={!!overrideDialog} onOpenChange={(open) => { if (!open) { setOverrideDialog(null); setOverrideMotivoInput(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Marcar como Recorrente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <p className="text-sm text-slate-600 mb-1">Empresa:</p>
                <p className="text-sm font-semibold text-slate-800">{overrideDialog?.empresa}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Vendedor:</p>
                <p className="text-sm text-slate-700">{overrideDialog?.vendedor}</p>
              </div>
              <div>
                <label className="text-sm text-slate-600 block mb-1">Motivo (opcional):</label>
                <Textarea
                  placeholder="Ex: Cliente comprou em 2023, antes do histórico importado"
                  value={overrideMotivoInput}
                  onChange={e => setOverrideMotivoInput(e.target.value)}
                  className="text-sm resize-none h-20"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setOverrideDialog(null); setOverrideMotivoInput(""); }}>Cancelar</Button>
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                disabled={upsertOverride.isPending}
                onClick={() => {
                  if (!overrideDialog) return;
                  upsertOverride.mutate({
                    empresaOriginal: overrideDialog.empresa,
                    status: "recorrente",
                    motivo: overrideMotivoInput.trim() || undefined,
                  });
                }}
              >
                {upsertOverride.isPending ? "Salvando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AlertDialog para confirmar remoção de override */}
        <AlertDialog open={deleteOverrideId !== null} onOpenChange={(open) => { if (!open) setDeleteOverrideId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover override?</AlertDialogTitle>
              <AlertDialogDescription>
                O cliente voltará a ser identificado automaticamente pelo sistema (novo ou recorrente conforme o histórico de OS).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => { if (deleteOverrideId !== null) deleteOverride.mutate({ id: deleteOverrideId }); }}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ─── Evolução por Vendedor ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
            onClick={() => setShowEvolucaoVendedor(v => !v)}
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                <div className="w-1.5 h-3 rounded-sm bg-blue-500" />
                <div className="w-1.5 h-5 rounded-sm bg-purple-500" />
                <div className="w-1.5 h-4 rounded-sm bg-green-500" />
                <div className="w-1.5 h-6 rounded-sm bg-amber-500" />
                <div className="w-1.5 h-3 rounded-sm bg-red-400" />
              </div>
              <span className="text-sm font-semibold text-slate-700">Evolução por Vendedor</span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Últimos 12 meses · gráficos de linha</span>
            </div>
            {showEvolucaoVendedor ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showEvolucaoVendedor && (
            <div className="border-t border-slate-100 p-5">
              <EvolucaoVendedor
                anoSelecionado={anoSelecionado}
                mesSelecionado={mesSelecionado}
                metaGeral={metaGeral}
              />
            </div>
          )}
        </div>


        </div>{/* fim aba visao-geral */}

        {/* Nota de rodapé */}
        <p className="text-xs text-slate-400 text-center">
          {fonteStatus === 'congelado'
            ? `🔒 Dados CONGELADOS em ${auditoriaData?.dataCongelamento ? new Date(auditoriaData.dataCongelamento).toLocaleDateString('pt-BR') : '--'} por ${auditoriaData?.auditadoPor ?? '--'} · Use Recalibrar para atualizar`
            : 'Dados obtidos em tempo real do ERP Mubisys · Taxa de Conversão = Vendas Realizadas / Cotações Enviadas · Taxa de Faturamento = Faturamento / Valor Orçado'
          }
        </p>
      </div>

      {/* ─── MODAL DE AUDITORIA E CONGELAMENTO ──────────────────────────────────────── */}
      <Dialog open={showAuditoriaModal} onOpenChange={setShowAuditoriaModal}>
        {/* max-w-2xl no desktop, full-width com margem no mobile */}
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-1 text-base sm:text-lg leading-snug">
              <span>🔒 Auditar e Congelar</span>
              <span className="text-slate-500 font-normal text-sm">{MESES_NOMES[mesSelecionado - 1]} {anoSelecionado}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tabela de auditoria — scroll horizontal no mobile */}
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table className="text-xs sm:text-sm min-w-[300px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indicador</TableHead>
                      <TableHead className="text-right">Valor ERP</TableHead>
                      <TableHead className="text-center hidden sm:table-cell">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { label: 'Cotações Enviadas', value: (mesDados as any)?.cotacoes ?? 0, fmt: (v: number) => v.toLocaleString('pt-BR') },
                      { label: 'Vendas Realizadas', value: (mesDados as any)?.osGeradas ?? 0, fmt: (v: number) => v.toLocaleString('pt-BR') },
                      { label: 'Taxa de Conversão', value: (mesDados as any)?.taxaConversao ?? 0, fmt: (v: number) => `${v.toFixed(1)}%` },
                      { label: 'Faturamento Total', value: (mesDados as any)?.faturamento ?? 0, fmt: (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
                      { label: 'Valor Orçado', value: (mesDados as any)?.valorOrcado ?? 0, fmt: (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
                      { label: 'Clientes Novos', value: (mesDados as any)?.clientesNovos ?? (clientesNovos as any)?.total ?? 0, fmt: (v: number) => v.toLocaleString('pt-BR') },
                      { label: 'Taxa Conv. Novos', value: (mesDados as any)?.taxaConvNovos ?? (clientesNovos as any)?.taxaConversaoNovos ?? 0, fmt: (v: number) => `${v.toFixed(1)}%` },
                    ].map(row => (
                      <TableRow key={row.label}>
                        <TableCell className="text-slate-700 font-medium">{row.label}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-slate-800">{row.fmt(row.value)}</TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            ✓ ERP
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </div>

            {/* Aviso */}
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-amber-600 text-base flex-shrink-0">⚠️</span>
              <div className="text-xs sm:text-sm text-amber-800">
                <p className="font-semibold">Ao congelar, esses dados ficam protegidos.</p>
                <p className="mt-0.5">O sistema não irá sobrescrever esses valores. Para atualizar, use <strong>Recalibrar</strong>.</p>
              </div>
            </div>

            {/* Log de validação */}
            <div className="text-[10px] sm:text-xs text-slate-500 bg-slate-50 rounded p-2 font-mono break-all">
              Leitura: {new Date().toLocaleString('pt-BR')} | ERP: OK | Fonte: API MubiSys
            </div>
          </div>

          {/* Footer empilhado no mobile */}
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowAuditoriaModal(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                const d = mesDados as any;
                const cn = clientesNovos as any;
                salvarAuditoriaMut.mutate({
                  mes: mesSelecionado,
                  ano: anoSelecionado,
                  cotacoes: d?.cotacoes ?? 0,
                  osNormais: d?.osGeradas ?? 0,
                  taxaConversao: d?.taxaConversao ?? 0,
                  faturamento: d?.faturamento ?? 0,
                  valorOrcado: d?.valorOrcado ?? 0,
                  clientesNovos: d?.clientesNovos ?? cn?.total ?? 0,
                  cotacoesNovos: cn?.cotacoesNovos ?? 0,
                  taxaConvNovos: d?.taxaConvNovos ?? cn?.taxaConversaoNovos ?? 0,
                  faturamentoNovos: d?.faturamentoNovos ?? cn?.faturamentoNovos ?? 0,
                  statusValidacao: 'validado',
                  observacoes: `Auditado em ${new Date().toLocaleString('pt-BR')} | Fonte: API MubiSys`,
                }, {
                  onSuccess: () => {
                    congelarAuditoriaMut.mutate({ mes: mesSelecionado, ano: anoSelecionado });
                  }
                });
              }}
              disabled={salvarAuditoriaMut.isPending || congelarAuditoriaMut.isPending}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {(salvarAuditoriaMut.isPending || congelarAuditoriaMut.isPending)
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Congelando...</>
                : <>🔒 Confirmar e Congelar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal de Congelamento em Lote ─────────────────────────────────── */}
      <Dialog open={showCongelarLoteModal} onOpenChange={open => { if (!loteRunning) setShowCongelarLoteModal(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              📅 Congelar Meses Históricos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Isso irá buscar os dados de cada mês na API MubiSys e congelar automaticamente.
              Meses já congelados serão ignorados.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {loteProgress.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg border border-slate-100 bg-slate-50">
                  <span className="text-sm font-medium text-slate-700 w-32">
                    {MESES_NOMES[item.mes - 1]} {item.ano}
                  </span>
                  <div className="flex-1">
                    {item.status === 'pendente' && <span className="text-xs text-slate-400">⏳ Aguardando...</span>}
                    {item.status === 'processando' && <span className="text-xs text-amber-600 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Processando...</span>}
                    {item.status === 'ok' && <span className="text-xs text-green-600">✅ Congelado</span>}
                    {item.status === 'erro' && <span className="text-xs text-red-500">❌ Erro</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCongelarLoteModal(false)}
              disabled={loteRunning}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                setLoteRunning(true);
                const updated = [...loteProgress];
                for (let i = 0; i < updated.length; i++) {
                  updated[i] = { ...updated[i], status: 'processando' };
                  setLoteProgress([...updated]);
                  try {
                    // Buscar dados do mês via API
                    const d = await utils.performanceComercial.getMes.fetch({ mes: updated[i].mes, ano: updated[i].ano });
                    const cn = await utils.performanceComercial.getClientesNovos.fetch({ mes: updated[i].mes, ano: updated[i].ano });
                    // Salvar e congelar
                    await new Promise<void>((resolve, reject) => {
                      salvarAuditoriaMut.mutate({
                        mes: updated[i].mes,
                        ano: updated[i].ano,
                        cotacoes: (d as any)?.cotacoes ?? 0,
                        osNormais: (d as any)?.osGeradas ?? 0,
                        taxaConversao: (d as any)?.taxaConversao ?? 0,
                        faturamento: (d as any)?.faturamento ?? 0,
                        valorOrcado: (d as any)?.valorOrcado ?? 0,
                        clientesNovos: (d as any)?.clientesNovos ?? (cn as any)?.total ?? 0,
                        cotacoesNovos: (cn as any)?.cotacoesNovos ?? 0,
                        taxaConvNovos: (d as any)?.taxaConvNovos ?? (cn as any)?.taxaConversaoNovos ?? 0,
                        faturamentoNovos: (d as any)?.faturamentoNovos ?? (cn as any)?.faturamentoNovos ?? 0,
                        statusValidacao: 'validado',
                        observacoes: `Congelado em lote em ${new Date().toLocaleString('pt-BR')}`,
                      }, {
                        onSuccess: () => {
                          congelarAuditoriaMut.mutate({ mes: updated[i].mes, ano: updated[i].ano }, {
                            onSuccess: () => resolve(),
                            onError: (e) => reject(e),
                          });
                        },
                        onError: (e) => reject(e),
                      });
                    });
                    updated[i] = { ...updated[i], status: 'ok' };
                  } catch {
                    updated[i] = { ...updated[i], status: 'erro' };
                  }
                  setLoteProgress([...updated]);
                }
                setLoteRunning(false);
                // Invalidar queries para refletir os dados congelados
                utils.performanceComercial.getMes.invalidate();
                utils.performanceComercial.getAuditoria.invalidate();
              }}
              disabled={loteRunning || loteProgress.length === 0}
              className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
            >
              {loteRunning
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processando...</>
                : <>🔒 Iniciar Congelamento</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

