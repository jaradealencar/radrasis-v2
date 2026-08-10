import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell, PieChart, Pie,
} from "recharts";
import {
  TrendingUp, TrendingDown, Plus, Edit2, Target, AlertTriangle,
  CheckCircle, Zap, Package, Hammer, BarChart2, DollarSign, Star,
  Clock, XCircle, Award, Trophy, RefreshCw, Users, ShoppingBag,
  GitCompare, Receipt, AlertCircle, Timer, Wallet, UserCheck,
} from "lucide-react";
import { toast } from "sonner";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const ANOS = [2024, 2025, 2026, 2027];
const META_FATURAMENTO_DEFAULT = 425000;

type PerformanceRow = {
  id: number; mes: number; ano: number;
  faturamentoRealizado?: string | null;
  projetosEntregues?: number | null; projetosNoPrazo?: number | null;
  osGeradas?: number | null; osExpedicao?: number | null;
  capacidadeNominalSolda?: number | null; producaoInternaSolda?: number | null;
  demandaTotalSolda?: number | null; osTerceirizadas?: number | null;
  metrosTerceirizados?: number | null; deficitFinalizacao?: string | null;
  destaques?: string | null; gargalos?: string | null; observacoes?: string | null;
  metaProducaoSolda?: number | null; metaPercTerceirizacao?: string | null;
  metaOsGeradas?: number | null; metaOsExpedicao?: number | null;
  metaEntregaNoPrazoPct?: string | null; metaRetrabalhoPct?: string | null;
  metaFaturamento?: string | null;
  retrabalhosAutoCount?: number;
  pedidosAutoCount?: number;
  totalPedidos?: number | null;
  [key: string]: unknown;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const n = (v: string | number | null | undefined) => parseFloat(String(v ?? 0)) || 0;
const fmt = (v: number | null | undefined, d = 0) => v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Cálculo de Pontuação Final ───────────────────────────────────────────────
type PontoItem = { label: string; peso: number; atingido: number; pct: number; ok: boolean };
function calcPontuacao(row: PerformanceRow, metaFatDefault = META_FATURAMENTO_DEFAULT): { pontos: PontoItem[]; scoreFinal: number | null } {
  const pontos: PontoItem[] = [];
  // 1. Meta de Faturamento (peso 35)
  const fat = n(row.faturamentoRealizado);
  const metaFat = n(row.metaFaturamento) || metaFatDefault;
  if (fat > 0) {
    const pctFat = (fat / metaFat) * 100;
    pontos.push({ label: "Faturamento", peso: 35, atingido: (pctFat / 100) * 35, pct: pctFat, ok: pctFat >= 100 });
  }
  // 2. Entrega no Prazo (peso 25)
  const entregues = n(row.projetosEntregues);
  const noPrazo = n(row.projetosNoPrazo);
  if (entregues > 0) {
    const pctPrazo = (noPrazo / entregues) * 100;
    const metaPrazo = n(row.metaEntregaNoPrazoPct) || 90;
    pontos.push({ label: "Entrega no Prazo", peso: 25, atingido: (pctPrazo / 100) * 25, pct: pctPrazo, ok: pctPrazo >= metaPrazo });
  }
  // 3. Índice de Retrabalho (peso 20)
  const pedidos = row.pedidosAutoCount ?? 0;
  const retrabalhos = row.retrabalhosAutoCount ?? 0;
  if (pedidos > 0) {
    const pctRetrab = (retrabalhos / pedidos) * 100;
    const metaRetrab = n(row.metaRetrabalhoPct) || 5;
    // Pontuação inversa: se pctRetrab <= meta, score = 100%; se dobrar a meta, score = 0%
    const score = Math.max(0, Math.min(100, ((metaRetrab * 2 - pctRetrab) / (metaRetrab * 2)) * 100));
    pontos.push({ label: "Índice de Retrabalho", peso: 20, atingido: (score / 100) * 20, pct: pctRetrab, ok: pctRetrab <= metaRetrab });
  }
  // 4. OS Geradas (peso 20)
  const osGeradas = n(row.osGeradas);
  const metaOs = n(row.metaOsGeradas);
  if (osGeradas > 0 && metaOs > 0) {
    const pctOs = (osGeradas / metaOs) * 100;
    pontos.push({ label: "OS Geradas", peso: 20, atingido: (pctOs / 100) * 20, pct: pctOs, ok: pctOs >= 100 });
  }
  if (pontos.length === 0) return { pontos: [], scoreFinal: null };
  const totalPeso = pontos.reduce((s, p) => s + p.peso, 0);
  const totalAtingido = pontos.reduce((s, p) => s + p.atingido, 0);
  const scoreFinal = totalPeso > 0 ? (totalAtingido / totalPeso) * 100 : null;
  return { pontos, scoreFinal };
}

// ─── Cálculos de Custo de Solda ──────────────────────────────────────────────
function calcCustoSolda(row: PerformanceRow) {
  const CUSTO_HORA_SOLDA = 85;
  const HORAS_MES_NOMINAL = 176;
  const CUSTO_METRO_TERCEIRIZADO = 12.5;
  const producaoInterna = n(row.producaoInternaSolda);
  const demandaTotal = n(row.demandaTotalSolda);
  const metrosTerceirizados = n(row.metrosTerceirizados);
  const custoInternoTotal = CUSTO_HORA_SOLDA * HORAS_MES_NOMINAL;
  const custoTerceirizado = metrosTerceirizados * CUSTO_METRO_TERCEIRIZADO;
  const custoTotal = custoInternoTotal + custoTerceirizado;
  const custoMetroInterno = producaoInterna > 0 ? custoInternoTotal / producaoInterna : 0;
  const eficiencia = demandaTotal > 0 ? (producaoInterna / demandaTotal) * 100 : 0;
  return { custoInternoTotal, custoTerceirizado, custoTotal, custoMetroInterno, eficiencia };
}

// ─── Field component (fora do FormularioPerformance para evitar re-render) ────
type FieldProps = {
  label: string;
  fkey: string;
  value: string;
  onChange: (key: string, value: string) => void;
  hint?: string;
};
// Aceita apenas dígitos, ponto decimal e vírgula (sem negativos, letras ou símbolos)
const NUMERIC_PATTERN = /^[0-9]*[.,]?[0-9]*$/;

const PerformanceField = ({ label, fkey, value, onChange, hint }: FieldProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Permite campo vazio ou valores que correspondam ao padrão numérico positivo
    if (raw === "" || NUMERIC_PATTERN.test(raw)) {
      onChange(fkey, raw);
    }
    // Caracteres inválidos (letras, símbolos, negativo) são silenciosamente ignorados
  };

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        className="h-8 text-sm mt-1"
        placeholder={hint ?? ""}
        value={value}
        onChange={handleChange}
        inputMode="decimal"
      />
    </div>
  );
};

// ─── Formulário de Performance ────────────────────────────────────────────────
function FormularioPerformance({ initial, onSaved, onClose }: {
  initial?: PerformanceRow;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    mes: String(initial?.mes ?? new Date().getMonth() + 1),
    ano: String(initial?.ano ?? new Date().getFullYear()),
    // Para faturamento, exibe o valor sem formatação especial para facilitar edição
    faturamentoRealizado: initial?.faturamentoRealizado ? String(parseFloat(String(initial.faturamentoRealizado)).toFixed(2)) : "",
    projetosEntregues: String(initial?.projetosEntregues ?? ""),
    projetosNoPrazo: String(initial?.projetosNoPrazo ?? ""),
    osGeradas: String(initial?.osGeradas ?? ""),
    osExpedicao: String(initial?.osExpedicao ?? ""),
    capacidadeNominalSolda: String(initial?.capacidadeNominalSolda ?? ""),
    producaoInternaSolda: String(initial?.producaoInternaSolda ?? ""),
    demandaTotalSolda: String(initial?.demandaTotalSolda ?? ""),
    osTerceirizadas: String(initial?.osTerceirizadas ?? ""),
    metrosTerceirizados: String(initial?.metrosTerceirizados ?? ""),
    deficitFinalizacao: String(initial?.deficitFinalizacao ?? ""),
    destaques: initial?.destaques ?? "",
    gargalos: initial?.gargalos ?? "",
    observacoes: initial?.observacoes ?? "",
    metaProducaoSolda: String(initial?.metaProducaoSolda ?? ""),
    metaPercTerceirizacao: String(initial?.metaPercTerceirizacao ?? ""),
    metaOsGeradas: String(initial?.metaOsGeradas ?? ""),
    metaOsExpedicao: String(initial?.metaOsExpedicao ?? ""),
    metaEntregaNoPrazoPct: String(initial?.metaEntregaNoPrazoPct ?? ""),
    metaRetrabalhoPct: String(initial?.metaRetrabalhoPct ?? ""),
    metaFaturamento: String(initial?.metaFaturamento ?? META_FATURAMENTO_DEFAULT),
    totalPedidos: String(initial?.totalPedidos ?? ""),
  });

  const toInt = (s: string) => parseInt(s.replace(/\./g, '').replace(',', '.')) || null;
  // Converte string para número suportando:
  // - Formato BR com milhar: "434.940,00" → 434940.00
  // - Formato com ponto decimal (sem vírgula): "434940.00" → 434940.00
  // - Inteiro: "434940" → 434940
  const toNum = (s: string) => {
    if (!s) return null;
    let cleaned: string;
    if (s.includes(',')) {
      // Formato BR: remove pontos de milhar, troca vírgula por ponto decimal
      cleaned = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Sem vírgula: o ponto (se houver) é decimal — não remover
      cleaned = s;
    }
    const v = parseFloat(cleaned);
    return isNaN(v) ? null : v;
  };

  const [saved, setSaved] = useState(false);
  const upsert = trpc.performance.upsert.useMutation({
    onSuccess: () => {
      setSaved(true);
      toast.success("Dados salvos!");
      onSaved();
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    upsert.mutate({
      mes: parseInt(form.mes),
      ano: parseInt(form.ano),
      faturamentoRealizado: toNum(form.faturamentoRealizado),
      projetosEntregues: toInt(form.projetosEntregues),
      projetosNoPrazo: toInt(form.projetosNoPrazo),
      osGeradas: toInt(form.osGeradas),
      osExpedicao: toInt(form.osExpedicao),
      capacidadeNominalSolda: toInt(form.capacidadeNominalSolda),
      producaoInternaSolda: toInt(form.producaoInternaSolda),
      demandaTotalSolda: toInt(form.demandaTotalSolda),
      osTerceirizadas: toInt(form.osTerceirizadas),
      metrosTerceirizados: toInt(form.metrosTerceirizados),
      deficitFinalizacao: toNum(form.deficitFinalizacao),
      destaques: form.destaques || null,
      gargalos: form.gargalos || null,
      observacoes: form.observacoes || null,
      metaProducaoSolda: toInt(form.metaProducaoSolda),
      metaPercTerceirizacao: toNum(form.metaPercTerceirizacao),
      metaOsGeradas: toInt(form.metaOsGeradas),
      metaOsExpedicao: toInt(form.metaOsExpedicao),
      metaEntregaNoPrazoPct: toNum(form.metaEntregaNoPrazoPct),
      metaRetrabalhoPct: toNum(form.metaRetrabalhoPct),
      metaFaturamento: toNum(form.metaFaturamento),
      totalPedidos: toInt(form.totalPedidos),
    });
  };

  const handleFieldChange = useCallback((key: string, value: string) => {
    setForm(p => ({ ...p, [key]: value }));
  }, []);
  // NOTA: Field wrapper removido — usar PerformanceField diretamente para evitar re-render
  const fval = (k: keyof typeof form) => form[k];

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Mês</Label>
          <Select value={form.mes} onValueChange={v => setForm(p => ({ ...p, mes: v }))}>
            <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Ano</Label>
          <Select value={form.ano} onValueChange={v => setForm(p => ({ ...p, ano: v }))}>
            <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg p-3 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-500" /> Faturamento</h4>
        <div className="grid grid-cols-2 gap-3">
          <PerformanceField label="Faturamento Realizado (R$)" fkey="faturamentoRealizado" value={fval("faturamentoRealizado")} onChange={handleFieldChange} hint="ex: 434940.00" />
          <PerformanceField label="Meta de Faturamento (R$)" fkey="metaFaturamento" value={fval("metaFaturamento")} onChange={handleFieldChange} hint="ex: 425000.00" />
          <PerformanceField label="Total de Pedidos (para ticket médio)" fkey="totalPedidos" value={fval("totalPedidos")} onChange={handleFieldChange} hint="ex: 187" />
        </div>
      </div>

      <div className="border rounded-lg p-3 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-blue-500" /> Projetos & OS</h4>
        <div className="grid grid-cols-2 gap-3">
          <PerformanceField label="Projetos Entregues" fkey="projetosEntregues" value={fval("projetosEntregues")} onChange={handleFieldChange} />
          <PerformanceField label="Projetos no Prazo" fkey="projetosNoPrazo" value={fval("projetosNoPrazo")} onChange={handleFieldChange} />
          <PerformanceField label="OS Geradas" fkey="osGeradas" value={fval("osGeradas")} onChange={handleFieldChange} />
          <PerformanceField label="OS Expedidas" fkey="osExpedicao" value={fval("osExpedicao")} onChange={handleFieldChange} />
          <PerformanceField label="Meta OS Geradas" fkey="metaOsGeradas" value={fval("metaOsGeradas")} onChange={handleFieldChange} />
          <PerformanceField label="Meta OS Expedidas" fkey="metaOsExpedicao" value={fval("metaOsExpedicao")} onChange={handleFieldChange} />
          <PerformanceField label="Meta Entrega no Prazo (%)" fkey="metaEntregaNoPrazoPct" value={fval("metaEntregaNoPrazoPct")} onChange={handleFieldChange} hint="90" />
          <PerformanceField label="Meta Retrabalho (%)" fkey="metaRetrabalhoPct" value={fval("metaRetrabalhoPct")} onChange={handleFieldChange} hint="5" />
        </div>
      </div>

      <div className="border rounded-lg p-3 space-y-3">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Hammer className="w-4 h-4 text-orange-500" /> Setor de Solda</h4>
        <div className="grid grid-cols-2 gap-3">
          <PerformanceField label="Cap. Nominal Solda (m)" fkey="capacidadeNominalSolda" value={fval("capacidadeNominalSolda")} onChange={handleFieldChange} hint="2000" />
          <PerformanceField label="Produção Interna (m)" fkey="producaoInternaSolda" value={fval("producaoInternaSolda")} onChange={handleFieldChange} hint="2531" />
          <PerformanceField label="Demanda Total (m)" fkey="demandaTotalSolda" value={fval("demandaTotalSolda")} onChange={handleFieldChange} />
          <PerformanceField label="OS Terceirizadas" fkey="osTerceirizadas" value={fval("osTerceirizadas")} onChange={handleFieldChange} />
          <PerformanceField label="Metros Terceirizados" fkey="metrosTerceirizados" value={fval("metrosTerceirizados")} onChange={handleFieldChange} />
          <PerformanceField label="Meta Produção Solda (m)" fkey="metaProducaoSolda" value={fval("metaProducaoSolda")} onChange={handleFieldChange} />
          <PerformanceField label="Meta % Terceirização" fkey="metaPercTerceirizacao" value={fval("metaPercTerceirizacao")} onChange={handleFieldChange} />
          <PerformanceField label="Déficit Finalização (%)" fkey="deficitFinalizacao" value={fval("deficitFinalizacao")} onChange={handleFieldChange} />
        </div>
      </div>

      <div className="border rounded-lg p-3 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" /> Observações</h4>
        <div>
          <Label className="text-xs">Destaques</Label>
          <Textarea className="text-sm mt-1" rows={2} value={form.destaques} onChange={e => setForm(p => ({ ...p, destaques: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Gargalos</Label>
          <Textarea className="text-sm mt-1" rows={2} value={form.gargalos} onChange={e => setForm(p => ({ ...p, gargalos: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Observações Gerais</Label>
          <Textarea className="text-sm mt-1" rows={2} value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button
          onClick={handleSubmit}
          disabled={upsert.isPending || saved}
          className={saved ? "bg-green-600 hover:bg-green-700 text-white" : ""}
        >
          {upsert.isPending ? "Salvando..." : saved ? (
            <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Salvo!</span>
          ) : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  title, value, unit, meta, icon: Icon, color, trend, invertMeta, statusColor, statusLabel, pctMeta, isGood,
}: {
  title: string; value: string | number | null | undefined; unit?: string;
  meta?: string | number; icon: React.ElementType; color: string;
  trend?: "up" | "down" | "neutral"; invertMeta?: boolean;
  statusColor?: string; statusLabel?: string; pctMeta?: number; isGood?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      {statusColor && <div className={`absolute top-0 left-0 right-0 h-1 ${statusColor}`} title={statusLabel ?? ""} />}
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">{title}</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold">{value}</span>
              {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
            </div>
            {meta != null && (
              <div className="flex items-center gap-1 mt-1">
                <p className="text-xs text-muted-foreground">Meta: {meta}</p>
                {statusLabel && (
                  <span className={`text-[10px] font-medium px-1 rounded ${
                    isGood ? "text-green-600 bg-green-50" :
                    pctMeta! >= 70 ? "text-yellow-600 bg-yellow-50" :
                    "text-red-600 bg-red-50"
                  }`}>{pctMeta!.toFixed(0)}%</span>
                )}
              </div>
            )}
          </div>
          <div className={`p-2 rounded-lg ${color} ml-2`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
        {trend && (
          <div className="absolute top-2 right-2">
            {trend === "up" ? <TrendingUp className="w-3 h-3 text-green-500" /> :
             trend === "down" ? <TrendingDown className="w-3 h-3 text-red-500" /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Painel de Pontuação Final ────────────────────────────────────────────────
function PainelPontuacao({ row, metaFatDefault = META_FATURAMENTO_DEFAULT }: { row: PerformanceRow; metaFatDefault?: number }) {
  const { pontos, scoreFinal } = calcPontuacao(row, metaFatDefault);

  if (pontos.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Preencha os dados do mês (faturamento, projetos entregues) para ver a pontuação.</p>
      </div>
    );
  }

  const scoreColor = scoreFinal == null ? "text-slate-500"
    : scoreFinal >= 90 ? "text-green-600" : scoreFinal >= 70 ? "text-yellow-600" : "text-red-600";
  const scoreBg = scoreFinal == null ? "bg-slate-50"
    : scoreFinal >= 90 ? "bg-green-50 border-green-200" : scoreFinal >= 70 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";
  const scoreLabel = scoreFinal == null ? "—"
    : scoreFinal >= 90 ? "🏆 Excelente" : scoreFinal >= 75 ? "✅ Bom" : scoreFinal >= 60 ? "⚠️ Regular" : "❌ Abaixo da meta";

  const pieData = pontos.map(p => ({ name: p.label, value: parseFloat(p.atingido.toFixed(1)), fill: p.ok ? "#22c55e" : "#ef4444" }));

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border-2 p-6 text-center ${scoreBg}`}>
        <Award className={`w-10 h-10 mx-auto mb-2 ${scoreColor}`} />
        <p className="text-sm font-medium text-muted-foreground mb-1">Pontuação Final do Mês</p>
        <p className={`text-5xl font-black ${scoreColor}`}>{scoreFinal?.toFixed(1) ?? "—"}<span className="text-2xl font-bold">/100</span></p>
        <p className={`text-lg font-semibold mt-2 ${scoreColor}`}>{scoreLabel}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          {pontos.map(p => (
            <div key={p.label} className="rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {p.ok ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  <span className="text-sm font-medium">{p.label}</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${p.ok ? "text-green-600" : "text-red-600"}`}>
                    {p.atingido.toFixed(1)}/{p.peso}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">pts</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${p.ok ? "bg-green-500" : "bg-red-400"}`}
                  style={{ width: `${Math.min((p.atingido / p.peso) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Realizado: {fmt(p.pct, 1)}% {p.label === "Faturamento" ? "da meta" : p.label === "Índice de Retrabalho" ? "(meta: ≤ máx)" : ""}
              </p>
            </div>
          ))}
        </div>

        <div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v} pts`, ""]} />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-center text-xs text-muted-foreground mt-2">Verde = atingido · Vermelho = abaixo da meta</p>
        </div>
      </div>
    </div>
  );
}

// ─── Painel Faturamento ───────────────────────────────────────────────────────
function PainelFaturamento({ row, metaFatDefault = META_FATURAMENTO_DEFAULT }: { row: PerformanceRow; metaFatDefault?: number }) {
  const fat = n(row.faturamentoRealizado);
  const metaFat = n(row.metaFaturamento) || metaFatDefault;
  const pctFat = fat > 0 ? (fat / metaFat) * 100 : 0;
  const entregues = n(row.projetosEntregues);
  const noPrazo = n(row.projetosNoPrazo);
  const pctPrazo = entregues > 0 ? (noPrazo / entregues) * 100 : 0;
  const metaPrazo = n(row.metaEntregaNoPrazoPct) || 90;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Faturamento vs Meta</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1">{fat > 0 ? fmtBRL(fat) : "—"}</div>
            <div className="text-sm text-muted-foreground mb-3">Meta: {fmtBRL(metaFat)}</div>
            {fat > 0 && (
              <>
                <div className="w-full bg-slate-100 rounded-full h-3 mb-1">
                  <div className={`h-3 rounded-full ${pctFat >= 100 ? "bg-green-500" : pctFat >= 80 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(pctFat, 100)}%` }} />
                </div>
                <p className={`text-sm font-semibold ${pctFat >= 100 ? "text-green-600" : "text-red-600"}`}>
                  {fmt(pctFat, 1)}% da meta
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Entrega no Prazo</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1">{entregues > 0 ? `${fmt(pctPrazo, 1)}%` : "—"}</div>
            <div className="text-sm text-muted-foreground mb-3">Meta: {metaPrazo}% · {noPrazo}/{entregues} projetos</div>
            {entregues > 0 && (
              <>
                <div className="w-full bg-slate-100 rounded-full h-3 mb-1">
                  <div className={`h-3 rounded-full ${pctPrazo >= metaPrazo ? "bg-green-500" : pctPrazo >= metaPrazo * 0.8 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(pctPrazo, 100)}%` }} />
                </div>
                <p className={`text-sm font-semibold ${pctPrazo >= metaPrazo ? "text-green-600" : "text-red-600"}`}>
                  {pctPrazo >= metaPrazo ? "✅ Meta atingida" : "❌ Abaixo da meta"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Painel Custo Solda ───────────────────────────────────────────────────────
function PainelCustoSolda({ row }: { row: PerformanceRow }) {
  const { custoInternoTotal, custoTerceirizado, custoTotal, custoMetroInterno, eficiencia } = calcCustoSolda(row);
  const producaoInterna = n(row.producaoInternaSolda);
  const demandaTotal = n(row.demandaTotalSolda);
  const metrosTerceirizados = n(row.metrosTerceirizados);
  const capacidadeNominal = n(row.capacidadeNominalSolda);

  if (producaoInterna === 0 && demandaTotal === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Hammer className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Preencha os dados de solda para ver a análise.</p>
      </div>
    );
  }

  const soldaData = [
    { name: "Produção Interna", value: producaoInterna, fill: "#f97316" },
    { name: "Terceirizado", value: metrosTerceirizados, fill: "#a855f7" },
    { name: "Cap. Nominal", value: capacidadeNominal, fill: "#94a3b8" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Custo Interno Total</p>
            <p className="text-xl font-bold mt-1">{fmtBRL(custoInternoTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Custo Terceirização</p>
            <p className="text-xl font-bold mt-1">{fmtBRL(custoTerceirizado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Custo Total Solda</p>
            <p className="text-xl font-bold mt-1">{fmtBRL(custoTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Custo/Metro Interno</p>
            <p className="text-xl font-bold mt-1">{custoMetroInterno > 0 ? fmtBRL(custoMetroInterno) : "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Eficiência de Solda: {fmt(eficiencia, 1)}%</CardTitle></CardHeader>
        <CardContent>
          <div className="w-full bg-slate-100 rounded-full h-4 mb-2">
            <div className={`h-4 rounded-full ${eficiencia >= 100 ? "bg-green-500" : eficiencia >= 80 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(eficiencia, 100)}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Produção: {producaoInterna}m</span>
            <span>Demanda: {demandaTotal}m</span>
            <span>Terceirizado: {metrosTerceirizados}m</span>
          </div>
        </CardContent>
      </Card>

      {soldaData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição de Produção (metros)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={soldaData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {soldaData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Classe ABC Badge ─────────────────────────────────────────────────────────
function ClasseBadge({ classe }: { classe: "A" | "B" | "C" }) {
  const colors = { A: "bg-green-100 text-green-800 border-green-300", B: "bg-yellow-100 text-yellow-800 border-yellow-300", C: "bg-slate-100 text-slate-600 border-slate-300" };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border ${colors[classe]}`}>{classe}</span>;
}

// ─── Paleta de cores para os produtos ───────────────────────────────────────
const PROD_COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6",
  "#f97316", "#8b5cf6", "#06b6d4", "#84cc16", "#ef4444",
  "#a78bfa", "#34d399", "#fbbf24", "#fb7185", "#2dd4bf",
];

// ─── Gráfico de Área Empilhada — Evolução de Produtos ────────────────────────
function GraficoEvolucaoProdutos() {
  const MESES_NOMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const anoAtual = new Date().getFullYear();

  // Seletor de meses: por padrão os últimos 4 meses disponíveis
  const [mesesSelecionados, setMesesSelecionados] = useState<{ mes: number; ano: number }[]>(() => {
    const agora = new Date();
    const result: { mes: number; ano: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      result.push({ mes: d.getMonth() + 1, ano: d.getFullYear() });
    }
    return result;
  });
  const [topN, setTopN] = useState(8);
  const [viewMode, setViewMode] = useState<"pct" | "valor">("pct");
  const [showTabela, setShowTabela] = useState(false);

  const { data, isLoading } = trpc.performanceAbc.getEvolucaoProdutos.useQuery(
    { meses: mesesSelecionados, topN },
    { enabled: mesesSelecionados.length > 0 }
  );

  // Gerar lista de meses disponíveis (últimos 12 meses)
  const mesesDisponiveis = (() => {
    const agora = new Date();
    const result: { mes: number; ano: number; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      result.push({ mes: d.getMonth() + 1, ano: d.getFullYear(), label: `${MESES_NOMES[d.getMonth()]} ${d.getFullYear()}` });
    }
    return result;
  })();

  const toggleMes = (mes: number, ano: number) => {
    const key = `${mes}-${ano}`;
    const exists = mesesSelecionados.some(m => `${m.mes}-${m.ano}` === key);
    if (exists) {
      if (mesesSelecionados.length <= 1) return; // mínimo 1
      setMesesSelecionados(prev => prev.filter(m => `${m.mes}-${m.ano}` !== key));
    } else {
      if (mesesSelecionados.length >= 6) {
        toast.error("Máximo de 6 meses para comparação");
        return;
      }
      setMesesSelecionados(prev => [...prev, { mes, ano }].sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes));
    }
  };

  const topProdutos = data?.topProdutos ?? [];
  const chartData = data?.chartData ?? [];
  const tabela = data?.tabela ?? [];
  const mesesLabels = data?.mesesLabels ?? [];

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {mesesDisponiveis.map(({ mes, ano, label }) => {
            const ativo = mesesSelecionados.some(m => m.mes === mes && m.ano === ano);
            return (
              <button
                key={`${mes}-${ano}`}
                onClick={() => toggleMes(mes, ano)}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                  ativo
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-background text-muted-foreground border-border hover:border-indigo-400"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">Top</span>
          <select
            value={topN}
            onChange={e => setTopN(Number(e.target.value))}
            className="text-xs border rounded px-1.5 py-1 bg-background"
          >
            {[5, 8, 10, 12, 15].map(n => <option key={n} value={n}>{n} produtos</option>)}
          </select>
          <div className="flex border rounded overflow-hidden text-xs">
            <button
              onClick={() => setViewMode("pct")}
              className={`px-2.5 py-1 ${viewMode === "pct" ? "bg-indigo-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >% Part.</button>
            <button
              onClick={() => setViewMode("valor")}
              className={`px-2.5 py-1 ${viewMode === "valor" ? "bg-indigo-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >R$ Valor</button>
          </div>
        </div>
      </div>

      {/* Gráfico */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando dados...</span>
        </div>
      ) : chartData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum dado disponível para os meses selecionados.</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                {topProdutos.map((prod, i) => (
                  <linearGradient key={prod} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PROD_COLORS[i % PROD_COLORS.length]} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={PROD_COLORS[i % PROD_COLORS.length]} stopOpacity={0.3} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={v => viewMode === "pct" ? `${v}%` : `${(v / 1000).toFixed(0)}k`}
                width={48}
              />
              <Tooltip
                formatter={(value: number, name: string) =>
                  viewMode === "pct"
                    ? [`${value.toFixed(1)}%`, name]
                    : [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`, name]
                }
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value) => value.length > 30 ? value.substring(0, 28) + "…" : value}
              />
              {topProdutos.map((prod, i) => (
                <Area
                  key={prod}
                  type="monotone"
                  dataKey={prod}
                  stackId="1"
                  stroke={PROD_COLORS[i % PROD_COLORS.length]}
                  fill={`url(#grad-${i})`}
                  strokeWidth={1.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>

          {/* Tabela comparativa */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Mostrando participação dos {topProdutos.length} principais produtos em {mesesLabels.length} meses
            </p>
            <button
              onClick={() => setShowTabela(v => !v)}
              className="text-xs text-indigo-600 hover:underline"
            >
              {showTabela ? "Ocultar tabela" : "Ver tabela comparativa"}
            </button>
          </div>

          {showTabela && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium">Produto</th>
                    {mesesLabels.map(l => (
                      <th key={l} className="text-right px-3 py-2 font-medium">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabela.map((row, idx) => (
                    <tr key={idx} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-1.5 font-medium max-w-[200px] truncate">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
                          style={{ backgroundColor: PROD_COLORS[idx % PROD_COLORS.length] }}
                        />
                        {row.produto}
                      </td>
                      {mesesLabels.map(l => (
                        <td key={l} className="text-right px-3 py-1.5 tabular-nums">
                          {viewMode === "pct"
                            ? `${row[l] ?? 0}%`
                            : `R$ ${Number(row[`${l}_valor`] ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Painel ABC Produtos ──────────────────────────────────────────────────────
function PainelAbcProdutos({ mes, ano }: { mes: number; ano: number }) {
  const [forceRefresh, setForceRefresh] = useState(false);
  const { data, isLoading, refetch } = trpc.performanceAbc.getAbc.useQuery(
    { mes, ano, tipo: "produtos", forceRefresh },
    { enabled: true }
  );

  const handleRefresh = () => {
    setForceRefresh(true);
    setTimeout(() => { refetch(); setForceRefresh(false); }, 100);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
      <RefreshCw className="w-4 h-4 animate-spin" />
      <span className="text-sm">Buscando dados do ERP...</span>
    </div>
  );

  const items = data?.items ?? [];
  const classA = items.filter(i => i.classe === "A");
  const classB = items.filter(i => i.classe === "B");
  const classC = items.filter(i => i.classe === "C");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-sm">
          <span className="text-muted-foreground">Total OS: <strong>{data?.totalOs ?? 0}</strong></span>
          <span className="text-muted-foreground">Faturamento: <strong>{data?.faturamento ? fmtBRL(data.faturamento) : "—"}</strong></span>
          {data?.fromCache && <Badge variant="outline" className="text-xs">Cache</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1 text-xs">
          <RefreshCw className="w-3 h-3" /> Atualizar do ERP
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum dado disponível para este mês.</p>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {/* Classe A */}
          <AccordionItem value="A" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline bg-green-50 hover:bg-green-100">
              <div className="flex items-center gap-3 flex-1 text-left">
                <ClasseBadge classe="A" />
                <span className="font-semibold text-green-800">Classe A — Alto Impacto</span>
                <span className="text-xs text-green-700 ml-auto mr-2">{classA.length} produtos · {fmtBRL(classA.reduce((s, i) => s + i.total, 0))}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <p className="text-xs text-muted-foreground mb-3">Produtos que representam até 80% do faturamento — foco principal.</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-1 pr-2">#</th>
                  <th className="text-left py-1">Produto</th>
                  <th className="text-right py-1 px-2">Qtd</th>
                  <th className="text-right py-1 px-2">Total</th>
                  <th className="text-right py-1 px-2">%</th>
                  <th className="text-right py-1">% Acum.</th>
                </tr></thead>
                <tbody>
                  {classA.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-1.5 pr-2 text-muted-foreground text-xs">{idx + 1}</td>
                      <td className="py-1.5 font-medium max-w-[200px] truncate">{item.nome}</td>
                      <td className="py-1.5 text-right px-2 text-muted-foreground">{item.count}</td>
                      <td className="py-1.5 text-right px-2 font-medium">{fmtBRL(item.total)}</td>
                      <td className="py-1.5 text-right px-2 text-green-700">{item.pct}%</td>
                      <td className="py-1.5 text-right text-muted-foreground">{item.pctAcum}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AccordionContent>
          </AccordionItem>

          {/* Classe B */}
          <AccordionItem value="B" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline bg-yellow-50 hover:bg-yellow-100">
              <div className="flex items-center gap-3 flex-1 text-left">
                <ClasseBadge classe="B" />
                <span className="font-semibold text-yellow-800">Classe B — Impacto Médio</span>
                <span className="text-xs text-yellow-700 ml-auto mr-2">{classB.length} produtos · {fmtBRL(classB.reduce((s, i) => s + i.total, 0))}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <p className="text-xs text-muted-foreground mb-3">Produtos que representam de 80% a 95% do faturamento acumulado.</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-1 pr-2">#</th>
                  <th className="text-left py-1">Produto</th>
                  <th className="text-right py-1 px-2">Qtd</th>
                  <th className="text-right py-1 px-2">Total</th>
                  <th className="text-right py-1 px-2">%</th>
                  <th className="text-right py-1">% Acum.</th>
                </tr></thead>
                <tbody>
                  {classB.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-1.5 pr-2 text-muted-foreground text-xs">{classA.length + idx + 1}</td>
                      <td className="py-1.5 font-medium max-w-[200px] truncate">{item.nome}</td>
                      <td className="py-1.5 text-right px-2 text-muted-foreground">{item.count}</td>
                      <td className="py-1.5 text-right px-2 font-medium">{fmtBRL(item.total)}</td>
                      <td className="py-1.5 text-right px-2 text-yellow-700">{item.pct}%</td>
                      <td className="py-1.5 text-right text-muted-foreground">{item.pctAcum}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AccordionContent>
          </AccordionItem>

          {/* Classe C */}
          <AccordionItem value="C" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline bg-slate-50 hover:bg-slate-100">
              <div className="flex items-center gap-3 flex-1 text-left">
                <ClasseBadge classe="C" />
                <span className="font-semibold text-slate-700">Classe C — Baixo Impacto</span>
                <span className="text-xs text-slate-500 ml-auto mr-2">{classC.length} produtos · {fmtBRL(classC.reduce((s, i) => s + i.total, 0))}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <p className="text-xs text-muted-foreground mb-3">Produtos que representam os últimos 5% do faturamento acumulado.</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-1 pr-2">#</th>
                  <th className="text-left py-1">Produto</th>
                  <th className="text-right py-1 px-2">Qtd</th>
                  <th className="text-right py-1 px-2">Total</th>
                  <th className="text-right py-1 px-2">%</th>
                  <th className="text-right py-1">% Acum.</th>
                </tr></thead>
                <tbody>
                  {classC.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-1.5 pr-2 text-muted-foreground text-xs">{classA.length + classB.length + idx + 1}</td>
                      <td className="py-1.5 font-medium max-w-[200px] truncate">{item.nome}</td>
                      <td className="py-1.5 text-right px-2 text-muted-foreground">{item.count}</td>
                      <td className="py-1.5 text-right px-2 font-medium">{fmtBRL(item.total)}</td>
                      <td className="py-1.5 text-right px-2 text-slate-500">{item.pct}%</td>
                      <td className="py-1.5 text-right text-muted-foreground">{item.pctAcum}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

// // ─── Painel ABC Clientes ──────────────────────────────────────────────────
function PainelAbcClientes({ mes, ano }: { mes: number; ano: number }) {
  const [forceRefresh, setForceRefresh] = useState(false);
  const { data, isLoading, refetch } = trpc.performanceAbc.getAbc.useQuery(
    { mes, ano, tipo: "clientes", forceRefresh },
    { enabled: true }
  );
  const { data: tagsData } = trpc.performanceAbc.getClienteTags.useQuery(
    { mes, ano },
    { enabled: true }
  );
  const retrabalhosPorCliente = tagsData?.retrabalhos ?? {};
  const atrasosPorCliente = tagsData?.atrasos ?? {};

  const handleRefresh = () => {
    setForceRefresh(true);
    setTimeout(() => { refetch(); setForceRefresh(false); }, 100);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
      <RefreshCw className="w-4 h-4 animate-spin" />
      <span className="text-sm">Buscando dados do ERP...</span>
    </div>
  );

  const items = data?.items ?? [];
  const classA = items.filter(i => i.classe === "A");
  const classB = items.filter(i => i.classe === "B");
  const classC = items.filter(i => i.classe === "C");

  const ClienteRow = ({ item, rank }: { item: typeof items[0]; rank: number }) => {
    const temRetrabalho = (retrabalhosPorCliente[item.nome] ?? 0) > 0;
    const temAtraso = (atrasosPorCliente[item.nome] ?? 0) > 0;
    return (
      <tr className="border-b last:border-0 hover:bg-muted/30">
        <td className="py-1.5 pr-2 text-muted-foreground text-xs">{rank}</td>
        <td className="py-1.5 max-w-[180px]">
          <div className="font-medium truncate">{item.nome}</div>
          <div className="flex gap-1 mt-0.5">
            {temRetrabalho && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] bg-red-100 text-red-700 border border-red-200">
                <AlertCircle className="w-2.5 h-2.5" /> Retrabalho
              </span>
            )}
            {temAtraso && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] bg-orange-100 text-orange-700 border border-orange-200">
                <Timer className="w-2.5 h-2.5" /> Atraso
              </span>
            )}
          </div>
        </td>
        <td className="py-1.5 text-right px-2 text-muted-foreground">{item.count}</td>
        <td className="py-1.5 text-right px-2 font-medium">{fmtBRL(item.total)}</td>
        <td className="py-1.5 text-right px-2">{item.pct}%</td>
        <td className="py-1.5 text-right text-muted-foreground">{item.pctAcum}%</td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-sm flex-wrap">
          <span className="text-muted-foreground">Total OS: <strong>{data?.totalOs ?? 0}</strong></span>
          <span className="text-muted-foreground">Faturamento: <strong>{data?.faturamento ? fmtBRL(data.faturamento) : "—"}</strong></span>
          {data?.fromCache && <Badge variant="outline" className="text-xs">Cache</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1 text-xs">
          <RefreshCw className="w-3 h-3" /> Atualizar do ERP
        </Button>
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-red-200 border border-red-300" /> Houve retrabalho no mês</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-orange-200 border border-orange-300" /> Houve atraso no mês</span>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum dado disponível para este mês.</p>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          <AccordionItem value="A" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline bg-green-50 hover:bg-green-100">
              <div className="flex items-center gap-3 flex-1 text-left">
                <ClasseBadge classe="A" />
                <span className="font-semibold text-green-800">Classe A — Principais Clientes</span>
                <span className="text-xs text-green-700 ml-auto mr-2">{classA.length} clientes · {fmtBRL(classA.reduce((s, i) => s + i.total, 0))}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <p className="text-xs text-muted-foreground mb-3">Clientes que representam até 80% do faturamento — relacionamento prioritário.</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-1 pr-2">#</th>
                  <th className="text-left py-1">Cliente</th>
                  <th className="text-right py-1 px-2">OS</th>
                  <th className="text-right py-1 px-2">Total</th>
                  <th className="text-right py-1 px-2">%</th>
                  <th className="text-right py-1">% Acum.</th>
                </tr></thead>
                <tbody>{classA.map((item, idx) => <ClienteRow key={idx} item={item} rank={idx + 1} />)}</tbody>
              </table>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="B" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline bg-yellow-50 hover:bg-yellow-100">
              <div className="flex items-center gap-3 flex-1 text-left">
                <ClasseBadge classe="B" />
                <span className="font-semibold text-yellow-800">Classe B — Clientes Relevantes</span>
                <span className="text-xs text-yellow-700 ml-auto mr-2">{classB.length} clientes · {fmtBRL(classB.reduce((s, i) => s + i.total, 0))}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <p className="text-xs text-muted-foreground mb-3">Clientes que representam de 80% a 95% do faturamento acumulado.</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-1 pr-2">#</th>
                  <th className="text-left py-1">Cliente</th>
                  <th className="text-right py-1 px-2">OS</th>
                  <th className="text-right py-1 px-2">Total</th>
                  <th className="text-right py-1 px-2">%</th>
                  <th className="text-right py-1">% Acum.</th>
                </tr></thead>
                <tbody>{classB.map((item, idx) => <ClienteRow key={idx} item={item} rank={classA.length + idx + 1} />)}</tbody>
              </table>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="C" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline bg-slate-50 hover:bg-slate-100">
              <div className="flex items-center gap-3 flex-1 text-left">
                <ClasseBadge classe="C" />
                <span className="font-semibold text-slate-700">Classe C — Demais Clientes</span>
                <span className="text-xs text-slate-500 ml-auto mr-2">{classC.length} clientes · {fmtBRL(classC.reduce((s, i) => s + i.total, 0))}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <p className="text-xs text-muted-foreground mb-3">Clientes que representam os últimos 5% do faturamento acumulado.</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-1 pr-2">#</th>
                  <th className="text-left py-1">Cliente</th>
                  <th className="text-right py-1 px-2">OS</th>
                  <th className="text-right py-1 px-2">Total</th>
                  <th className="text-right py-1 px-2">%</th>
                  <th className="text-right py-1">% Acum.</th>
                </tr></thead>
                <tbody>{classC.map((item, idx) => <ClienteRow key={idx} item={item} rank={classA.length + classB.length + idx + 1} />)}</tbody>
              </table>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

// ─── Painel Comparação Entre Meses ────────────────────────────────────────────
function PainelComparacao({ rows }: { rows: PerformanceRow[] }) {
  const [mesesSelecionados, setMesesSelecionados] = useState<number[]>(() => {
    const ids = rows.map(r => r.id);
    return ids.slice(-2);
  });

  const toggleMes = (id: number) => {
    setMesesSelecionados(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id].slice(-3) // máx 3 meses
    );
  };

  const selecionados = rows.filter(r => mesesSelecionados.includes(r.id));

  const indicadores: Array<{
    label: string;
    icon: React.ElementType;
    getValue: (r: PerformanceRow) => string;
    getNum: (r: PerformanceRow) => number;
    higherIsBetter: boolean;
    unit?: string;
  }> = [
    {
      label: "Faturamento",
      icon: DollarSign,
      getValue: r => n(r.faturamentoRealizado) > 0 ? fmtBRL(n(r.faturamentoRealizado)) : "—",
      getNum: r => n(r.faturamentoRealizado),
      higherIsBetter: true,
    },
    {
      label: "Ticket Médio",
      icon: Receipt,
      getValue: r => {
        const fat = n(r.faturamentoRealizado);
        const ped = n(r.totalPedidos) || n(r.osGeradas);
        return fat > 0 && ped > 0 ? fmtBRL(fat / ped) : "—";
      },
      getNum: r => {
        const fat = n(r.faturamentoRealizado);
        const ped = n(r.totalPedidos) || n(r.osGeradas);
        return fat > 0 && ped > 0 ? fat / ped : 0;
      },
      higherIsBetter: true,
    },
    {
      label: "Entrega no Prazo",
      icon: Clock,
      getValue: r => n(r.projetosEntregues) > 0 ? `${fmt((n(r.projetosNoPrazo) / n(r.projetosEntregues)) * 100, 1)}%` : "—",
      getNum: r => n(r.projetosEntregues) > 0 ? (n(r.projetosNoPrazo) / n(r.projetosEntregues)) * 100 : 0,
      higherIsBetter: true,
      unit: "%",
    },
    {
      label: "Taxa de Retrabalho",
      icon: AlertTriangle,
      getValue: r => (r.pedidosAutoCount ?? 0) > 0 ? `${fmt(((r.retrabalhosAutoCount ?? 0) / (r.pedidosAutoCount ?? 1)) * 100, 2)}%` : "—",
      getNum: r => (r.pedidosAutoCount ?? 0) > 0 ? ((r.retrabalhosAutoCount ?? 0) / (r.pedidosAutoCount ?? 1)) * 100 : 0,
      higherIsBetter: false,
      unit: "%",
    },
    {
      label: "OS Geradas",
      icon: BarChart2,
      getValue: r => {
        const val = r.osGeradas ?? (r as any).totalPedidos;
        return val != null ? String(val) : "—";
      },
      getNum: r => n(r.osGeradas) || n((r as any).totalPedidos),
      higherIsBetter: true,
    },
    {
      label: "OS Expedidas",
      icon: CheckCircle,
      getValue: r => r.osExpedicao != null ? String(r.osExpedicao) : "—",
      getNum: r => n(r.osExpedicao),
      higherIsBetter: true,
    },
    {
      label: "Produção Solda",
      icon: Hammer,
      getValue: r => r.producaoInternaSolda != null ? `${r.producaoInternaSolda}m` : "—",
      getNum: r => n(r.producaoInternaSolda),
      higherIsBetter: true,
      unit: "m",
    },
    {
      label: "Metros Terceirizados",
      icon: Package,
      getValue: r => r.metrosTerceirizados != null ? `${r.metrosTerceirizados}m` : "—",
      getNum: r => n(r.metrosTerceirizados),
      higherIsBetter: false,
      unit: "m",
    },
    {
      label: "Déficit Finalização",
      icon: TrendingDown,
      getValue: r => r.deficitFinalizacao != null ? `${fmt(n(r.deficitFinalizacao), 0)}%` : "—",
      getNum: r => n(r.deficitFinalizacao),
      higherIsBetter: false,
      unit: "%",
    },
  ];

  const chartData = indicadores
    .filter(ind => selecionados.some(r => ind.getNum(r) > 0))
    .map(ind => {
      const entry: Record<string, string | number> = { name: ind.label };
      selecionados.forEach(r => {
        entry[`${MESES[r.mes - 1].slice(0, 3)} ${r.ano}`] = ind.getNum(r);
      });
      return entry;
    });

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b"];

  return (
    <div className="space-y-6">
      {/* Seletor de meses */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitCompare className="w-4 h-4" /> Selecionar meses para comparar (máx. 3)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {rows.map(r => (
              <Button
                key={r.id}
                variant={mesesSelecionados.includes(r.id) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleMes(r.id)}
              >
                {MESES[r.mes - 1].slice(0, 3)} {r.ano}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selecionados.length < 2 ? (
        <div className="text-center py-10 text-muted-foreground">
          <GitCompare className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Selecione pelo menos 2 meses para comparar.</p>
        </div>
      ) : (
        <>
          {/* Tabela comparativa de todos os indicadores */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Comparativo de Indicadores</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Indicador</th>
                    {selecionados.map((r, i) => (
                      <th key={r.id} className="text-right py-2 px-3 font-medium" style={{ color: COLORS[i] }}>
                        {MESES[r.mes - 1].slice(0, 3)} {r.ano}
                      </th>
                    ))}
                    {selecionados.length === 2 && (
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Variação</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {indicadores.map(ind => {
                    const nums = selecionados.map(r => ind.getNum(r));
                    const variacao = selecionados.length === 2 && nums[0] > 0
                      ? ((nums[1] - nums[0]) / nums[0]) * 100
                      : null;
                    const variacaoOk = variacao != null
                      ? (ind.higherIsBetter ? variacao >= 0 : variacao <= 0)
                      : null;
                    return (
                      <tr key={ind.label} className="border-b hover:bg-muted/30">
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <ind.icon className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium">{ind.label}</span>
                          </div>
                        </td>
                        {selecionados.map((r, i) => (
                          <td key={r.id} className="text-right py-2 px-3 font-mono text-sm">
                            {ind.getValue(r)}
                          </td>
                        ))}
                        {selecionados.length === 2 && (
                          <td className={`text-right py-2 px-3 text-sm font-semibold ${
                            variacao == null ? "text-muted-foreground" :
                            variacaoOk ? "text-green-600" : "text-red-600"
                          }`}>
                            {variacao != null ? (
                              <span className="flex items-center justify-end gap-1">
                                {variacaoOk ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {variacao > 0 ? "+" : ""}{fmt(variacao, 1)}%
                              </span>
                            ) : "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Gráfico de barras comparativo */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Gráfico Comparativo — Indicadores Numéricos</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Nota: valores em escalas diferentes (R$, %, unidades) são exibidos em barras separadas por indicador.</p>
              <div className="space-y-4">
                {/* Faturamento */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Faturamento (R$)</p>
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={[{
                      name: "Faturamento",
                      ...Object.fromEntries(selecionados.map(r => [`${MESES[r.mes - 1].slice(0, 3)} ${r.ano}`, n(r.faturamentoRealizado)]))
                    }]} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" hide />
                      <Tooltip formatter={(v: number) => fmtBRL(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {selecionados.map((r, i) => (
                        <Bar key={r.id} dataKey={`${MESES[r.mes - 1].slice(0, 3)} ${r.ano}`} fill={COLORS[i]} radius={[0, 4, 4, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* OS */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">OS Geradas / Expedidas</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={[
                      { name: "OS Geradas", ...Object.fromEntries(selecionados.map(r => [`${MESES[r.mes - 1].slice(0, 3)} ${r.ano}`, n(r.osGeradas) || n((r as any).totalPedidos)])) },
                      { name: "OS Expedidas", ...Object.fromEntries(selecionados.map(r => [`${MESES[r.mes - 1].slice(0, 3)} ${r.ano}`, n(r.osExpedicao)])) },
                    ]} layout="vertical" margin={{ left: 80, right: 20, top: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {selecionados.map((r, i) => (
                        <Bar key={r.id} dataKey={`${MESES[r.mes - 1].slice(0, 3)} ${r.ano}`} fill={COLORS[i]} radius={[0, 4, 4, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function Performance() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<PerformanceRow | undefined>();
  const [mesSelecionado, setMesSelecionado] = useState<number | null>(null);
  const [anoSelecionado, setAnoSelecionado] = useState<number | null>(null);

  const { data: rows = [], refetch } = trpc.performance.list.useQuery();
  const { data: metasConfig } = trpc.metasOperacionais.get.useQuery({ ano: new Date().getFullYear() });
  const metaTicketMedio = metasConfig?.metaTicketMedio ? Number(metasConfig.metaTicketMedio) : 3000;
  // Metas globais da configuração de metas (usadas quando o mês não tem meta própria)
  const metaFatConfig = metasConfig?.metaFaturamentoMensal ? Number(metasConfig.metaFaturamentoMensal) : META_FATURAMENTO_DEFAULT;
  const metaRetrabConfig = metasConfig?.metaMaxRetrabalhoPct ? Number(metasConfig.metaMaxRetrabalhoPct) : 5;
  const metaEntregaConfig = metasConfig?.metaEntregaNoPrazoPct ? Number(metasConfig.metaEntregaNoPrazoPct) : 90;
  const anoFinanceiro = anoSelecionado ?? new Date().getFullYear();
  const { data: financeiroList = [] } = trpc.financeiro.list.useQuery({ ano: anoFinanceiro });

  const mesAtualNum = mesSelecionado ?? (rows.length > 0 ? rows[rows.length - 1].mes : new Date().getMonth() + 1);
  const anoAtualNum = anoSelecionado ?? (rows.length > 0 ? rows[rows.length - 1].ano : new Date().getFullYear());

  const { data: rowDetalhe } = trpc.performance.getByMesAno.useQuery(
    { mes: mesAtualNum, ano: anoAtualNum },
    { enabled: rows.length > 0 }
  );

  const rowAtual: PerformanceRow | null = useMemo(() => {
    if (rowDetalhe !== undefined) {
      if (!rowDetalhe) return null;
      return {
        ...rowDetalhe,
        retrabalhosAutoCount: Number((rowDetalhe as any).retrabalhosAutoCount ?? 0),
        pedidosAutoCount: Number((rowDetalhe as any).pedidosAutoCount ?? 0),
      } as PerformanceRow;
    }
    if (rows.length === 0) return null;
    const found = rows.find(r => r.mes === mesAtualNum && r.ano === anoAtualNum);
    return found ?? rows[rows.length - 1] ?? null;
  }, [rowDetalhe, rows, mesAtualNum, anoAtualNum]);

  // Ticket médio calculado
  const ticketMedio = useMemo(() => {
    if (!rowAtual) return null;
    const fat = n(rowAtual.faturamentoRealizado);
    const pedidos = n(rowAtual.totalPedidos) || n(rowAtual.osGeradas);
    if (fat > 0 && pedidos > 0) return fat / pedidos;
    return null;
  }, [rowAtual]);

  // Dados financeiros do mês atual
  const financeiroAtual = useMemo(() => {
    if (!rowAtual) return null;
    return financeiroList.find(f => f.mes === rowAtual.mes) ?? null;
  }, [financeiroList, rowAtual]);

  // Faturamento oficial (do financeiro, se disponível; senão usa o da performance)
  const faturamentoOficial = useMemo(() => {
    if (financeiroAtual?.faturamentoOficial) return parseFloat(financeiroAtual.faturamentoOficial);
    return n(rowAtual?.faturamentoRealizado);
  }, [financeiroAtual, rowAtual]);

  // Lucro líquido do mês
  const lucroLiquido = useMemo(() => {
    if (!financeiroAtual) return null;
    if (financeiroAtual.lucroLiquido) return parseFloat(financeiroAtual.lucroLiquido);
    const fat = financeiroAtual.faturamentoOficial ? parseFloat(financeiroAtual.faturamentoOficial) : null;
    const fixas = financeiroAtual.despesasFixas ? parseFloat(financeiroAtual.despesasFixas) : null;
    const variaveis = financeiroAtual.despesasVariaveis ? parseFloat(financeiroAtual.despesasVariaveis) : null;
    if (fat != null && fixas != null && variaveis != null) return fat - fixas - variaveis;
    return null;
  }, [financeiroAtual]);

  // Receita por colaborador
  const receitaPorColaborador = useMemo(() => {
    if (!financeiroAtual?.numColaboradores || !faturamentoOficial) return null;
    return faturamentoOficial / financeiroAtual.numColaboradores;
  }, [financeiroAtual, faturamentoOficial]);

  const chartEvolution = useMemo(() =>
    rows.map(r => ({
      label: `${MESES[r.mes - 1].slice(0, 3)}/${r.ano}`,
      "OS Geradas": r.osGeradas ?? (r as any).totalPedidos ?? 0,
      "OS Expedidas": r.osExpedicao ?? 0,
      "Meta OS Geradas": r.metaOsGeradas ?? null,
      "Prod. Solda (m)": r.producaoInternaSolda ?? 0,
      "Demanda Solda (m)": r.demandaTotalSolda ?? 0,
      "Faturamento (k)": n(r.faturamentoRealizado) / 1000,
      "Meta Fat. (k)": (n(r.metaFaturamento) || metaFatConfig) / 1000,
      "Ticket Médio": (() => {
        const fat = n(r.faturamentoRealizado);
        const ped = n((r as any).totalPedidos) || n(r.osGeradas);
        return fat > 0 && ped > 0 ? Math.round(fat / ped) : 0;
      })(),
    })), [rows]);

  const handleEdit = (row: PerformanceRow) => { setEditRow(row); setDialogOpen(true); };
  const handleNew = () => { setEditRow(undefined); setDialogOpen(true); };

  const fat = rowAtual ? n(rowAtual.faturamentoRealizado) : 0;
  // Usa meta do mês se preenchida, senão usa da configuração de metas
  const metaFatAtual = rowAtual ? (n(rowAtual.metaFaturamento) || metaFatConfig) : metaFatConfig;
  const pctMetaFat = fat > 0 && metaFatAtual > 0 ? (fat / metaFatAtual) * 100 : null;

  return (
    <DashboardLayout>
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Visão de Performance</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Faturamento, projetos, retrabalhos, metas e pontuação mensal
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNew} className="gap-2"><Plus className="w-4 h-4" /> Adicionar Mês</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editRow ? `Editar — ${MESES[editRow.mes - 1]} ${editRow.ano}` : "Adicionar Dados do Mês"}</DialogTitle>
            </DialogHeader>
            <FormularioPerformance key={editRow?.id ?? 'new'} initial={editRow} onSaved={refetch} onClose={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {rows.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <BarChart2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">Nenhum dado registrado ainda.</p>
            <Button onClick={handleNew} className="mt-4 gap-2"><Plus className="w-4 h-4" /> Adicionar primeiro mês</Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="dashboard">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="faturamento">Faturamento & Prazo</TabsTrigger>
            <TabsTrigger value="pontuacao">Pontuação Final</TabsTrigger>
            <TabsTrigger value="evolucao">Evolução Mensal</TabsTrigger>
            <TabsTrigger value="solda">Análise de Solda</TabsTrigger>
            <TabsTrigger value="abc-produtos">
              <ShoppingBag className="w-3.5 h-3.5 mr-1" />Curva ABC Produtos
            </TabsTrigger>
            <TabsTrigger value="abc-clientes">
              <Users className="w-3.5 h-3.5 mr-1" />Curva ABC Clientes
            </TabsTrigger>
            <TabsTrigger value="comparacao">
              <GitCompare className="w-3.5 h-3.5 mr-1" />Comparação
            </TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* Seletor de mês compartilhado */}
          <div className="flex gap-2 items-center flex-wrap mb-4">
            <span className="text-sm text-muted-foreground">Mês:</span>
            {rows.map(r => (
              <Button
                key={`${r.mes}-${r.ano}`}
                variant={rowAtual?.mes === r.mes && rowAtual?.ano === r.ano ? "default" : "outline"}
                size="sm"
                onClick={() => { setMesSelecionado(r.mes); setAnoSelecionado(r.ano); }}
              >
                {MESES[r.mes - 1].slice(0, 3)} {r.ano}
              </Button>
            ))}
          </div>

          {/* ─── ABA: Dashboard ─── */}
          <TabsContent value="dashboard" className="space-y-6">
            {rowAtual && (
              <>
                {/* KPIs principais — linha 1 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard title="Faturamento" value={n(rowAtual.faturamentoRealizado) > 0 ? fmtBRL(n(rowAtual.faturamentoRealizado)) : "—"}
                    meta={fmtBRL(metaFatAtual)}
                    icon={DollarSign} color="bg-emerald-500"
                    pctMeta={pctMetaFat ?? undefined}
                    statusLabel={pctMetaFat != null ? `${pctMetaFat.toFixed(1)}% da meta` : undefined}
                    isGood={pctMetaFat != null && pctMetaFat >= 100}
                    trend={n(rowAtual.faturamentoRealizado) >= metaFatAtual ? "up" : "down"} />
                  <KpiCard title="Ticket Médio" value={ticketMedio != null ? fmtBRL(ticketMedio) : "—"}
                    meta={fmtBRL(metaTicketMedio)}
                    icon={Receipt} color="bg-teal-500"
                    pctMeta={ticketMedio != null ? (ticketMedio / metaTicketMedio) * 100 : undefined}
                    statusLabel={ticketMedio != null ? `${((ticketMedio / metaTicketMedio) * 100).toFixed(1)}% da meta` : undefined}
                    isGood={ticketMedio != null && ticketMedio >= metaTicketMedio}
                    trend={ticketMedio != null ? (ticketMedio >= metaTicketMedio ? "up" : "down") : "neutral"} />
                  <KpiCard title="Entrega no Prazo" value={n(rowAtual.projetosEntregues) > 0 ? `${fmt((n(rowAtual.projetosNoPrazo) / n(rowAtual.projetosEntregues)) * 100, 1)}%` : "—"}
                    meta={`≥ ${n(rowAtual.metaEntregaNoPrazoPct) || metaEntregaConfig}%`}
                    icon={Clock} color="bg-blue-500"
                    trend={n(rowAtual.projetosEntregues) > 0 && (n(rowAtual.projetosNoPrazo) / n(rowAtual.projetosEntregues)) * 100 >= (n(rowAtual.metaEntregaNoPrazoPct) || metaEntregaConfig) ? "up" : "down"} />
                  <KpiCard title="Taxa de Retrabalho"
                    value={(rowAtual.pedidosAutoCount ?? 0) > 0 ? `${fmt(((rowAtual.retrabalhosAutoCount ?? 0) / (rowAtual.pedidosAutoCount ?? 1)) * 100, 2)}%` : "—"}
                    meta={`≤ ${n(rowAtual.metaRetrabalhoPct) || metaRetrabConfig}%`}
                    icon={AlertTriangle} color="bg-orange-500" invertMeta />
                </div>

                {/* KPIs — linha 2 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(() => {
                    const osVal = rowAtual.osGeradas ?? rowAtual.totalPedidos;
                    return (
                      <KpiCard title="OS Geradas" value={osVal ?? "—"} unit="OS"
                        meta={rowAtual.metaOsGeradas ?? undefined}
                        icon={BarChart2} color="bg-blue-500"
                        trend={rowAtual.metaOsGeradas && osVal != null ? (osVal >= rowAtual.metaOsGeradas ? "up" : "down") : "neutral"} />
                    );
                  })()}
                  <KpiCard title="OS Expedidas" value={rowAtual.osExpedicao ?? "—"} unit="OS"
                    meta={rowAtual.metaOsExpedicao ?? undefined}
                    icon={CheckCircle} color="bg-green-500" />
                  <KpiCard title="Produção Solda" value={rowAtual.producaoInternaSolda ?? "—"} unit="m"
                    meta={rowAtual.metaProducaoSolda ?? undefined}
                    icon={Hammer} color="bg-orange-500" />
                  <KpiCard title="Metros Terceirizados" value={rowAtual.metrosTerceirizados ?? "—"} unit="m"
                    icon={Package} color="bg-purple-500" />
                </div>

                {/* KPIs Financeiros — linha 3 (dados do módulo Financeiro) */}
                {(financeiroAtual || lucroLiquido != null || receitaPorColaborador != null) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <KpiCard
                      title="Faturamento Oficial"
                      value={faturamentoOficial > 0 ? fmtBRL(faturamentoOficial) : "—"}
                      meta={financeiroAtual?.faturamentoOficial ? "Fonte: Módulo Financeiro" : "Fonte: Performance"}
                      icon={DollarSign} color="bg-emerald-600"
                      trend={faturamentoOficial >= metaFatAtual ? "up" : "down"}
                    />
                    <KpiCard
                      title="Lucro Líquido"
                      value={lucroLiquido != null ? fmtBRL(lucroLiquido) : "—"}
                      meta={lucroLiquido != null && faturamentoOficial > 0 ? `${fmt((lucroLiquido / faturamentoOficial) * 100, 1)}% de margem` : "Informe despesas no Financeiro"}
                      icon={Wallet} color="bg-indigo-500"
                      trend={lucroLiquido != null ? (lucroLiquido > 0 ? "up" : "down") : "neutral"}
                    />
                    <KpiCard
                      title="Receita / Colaborador"
                      value={receitaPorColaborador != null ? fmtBRL(receitaPorColaborador) : "—"}
                      meta={financeiroAtual?.numColaboradores ? `${financeiroAtual.numColaboradores} colaboradores` : "Informe colaboradores no Financeiro"}
                      icon={UserCheck} color="bg-violet-500"
                      trend="neutral"
                    />
                  </div>
                )}

                {/* Ticket médio detalhado */}
                {ticketMedio != null && (() => {
                  const pctTicket = (ticketMedio / metaTicketMedio) * 100;
                  const distancia = ticketMedio - metaTicketMedio;
                  const melhoriaPos = ticketMedio < metaTicketMedio
                    ? ((metaTicketMedio - ticketMedio) / ticketMedio) * 100
                    : 0;
                  const isAcima = ticketMedio >= metaTicketMedio;
                  return (
                    <Card className={`border-2 ${isAcima ? 'border-teal-300 bg-teal-50/30' : 'border-amber-200 bg-amber-50/20'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="p-2 rounded-lg bg-teal-500 shrink-0">
                            <Receipt className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground font-medium mb-1">Ticket Médio por Pedido</p>
                            <div className="flex items-baseline gap-3 flex-wrap">
                              <p className="text-xl font-bold">{fmtBRL(ticketMedio)}</p>
                              <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                                isAcima ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {isAcima ? '✅' : '⚠️'} {pctTicket.toFixed(1)}% da meta
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                              <div className="bg-muted/40 rounded p-2">
                                <p className="text-muted-foreground">Meta de Ticket Médio</p>
                                <p className="font-semibold text-sm">{fmtBRL(metaTicketMedio)}</p>
                              </div>
                              <div className={`rounded p-2 ${isAcima ? 'bg-green-50' : 'bg-red-50'}`}>
                                <p className="text-muted-foreground">{isAcima ? 'Acima da meta' : 'Distância da meta'}</p>
                                <p className={`font-semibold text-sm ${isAcima ? 'text-green-700' : 'text-red-600'}`}>
                                  {isAcima ? '+' : ''}{fmtBRL(distancia)}
                                </p>
                              </div>
                              {!isAcima && (
                                <div className="bg-blue-50 rounded p-2">
                                  <p className="text-muted-foreground">Melhoria necessária</p>
                                  <p className="font-semibold text-sm text-blue-700">+{melhoriaPos.toFixed(1)}% possível</p>
                                </div>
                              )}
                              {isAcima && (
                                <div className="bg-green-50 rounded p-2">
                                  <p className="text-muted-foreground">Superação da meta</p>
                                  <p className="font-semibold text-sm text-green-700">+{(pctTicket - 100).toFixed(1)}% acima</p>
                                </div>
                              )}
                            </div>
                            <div className="mt-2 w-full bg-slate-100 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${isAcima ? 'bg-teal-500' : 'bg-amber-400'}`}
                                style={{ width: `${Math.min(pctTicket, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {fmtBRL(n(rowAtual.faturamentoRealizado))} ÷ {n(rowAtual.totalPedidos) || n(rowAtual.osGeradas)} pedidos
                              {!rowAtual.totalPedidos && rowAtual.osGeradas && (
                                <span className="ml-1 text-amber-600">(usando OS Geradas — informe "Total de Pedidos" para maior precisão)</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Destaques e Gargalos */}
                {(rowAtual.destaques || rowAtual.gargalos) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rowAtual.destaques && (
                      <Card className="border-green-200">
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-green-700 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Destaques</CardTitle></CardHeader>
                        <CardContent><p className="text-sm whitespace-pre-line">{rowAtual.destaques}</p></CardContent>
                      </Card>
                    )}
                    {rowAtual.gargalos && (
                      <Card className="border-red-200">
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Gargalos</CardTitle></CardHeader>
                        <CardContent><p className="text-sm whitespace-pre-line">{rowAtual.gargalos}</p></CardContent>
                      </Card>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(rowAtual)} className="gap-2">
                    <Edit2 className="w-4 h-4" /> Editar dados de {MESES[(rowAtual.mes ?? 1) - 1]} {rowAtual.ano}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ─── ABA: Faturamento & Prazo ─── */}
          <TabsContent value="faturamento" className="space-y-4">
             {rowAtual && <PainelFaturamento row={rowAtual} metaFatDefault={metaFatConfig} />}
          </TabsContent>

          {/* ─── ABA: Pontuação Final ─── */}
          <TabsContent value="pontuacao" className="space-y-4">
             {rowAtual && <PainelPontuacao row={rowAtual} metaFatDefault={metaFatConfig} />}
          </TabsContent>

          {/* ─── ABA: Evolução Mensal ─── */}
          <TabsContent value="evolucao" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Faturamento Mensal vs Meta</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartEvolution} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}k`} />
                    <Tooltip formatter={(v: number) => [`R$ ${fmt(v * 1000, 0)}`, ""]} />
                    <Legend />
                    <Bar dataKey="Faturamento (k)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="Meta Fat. (k)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Ticket Médio por Mês</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartEvolution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [fmtBRL(v), "Ticket Médio"]} />
                    <Line type="monotone" dataKey="Ticket Médio" stroke="#14b8a6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Evolução de OS — Geradas vs Expedidas</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartEvolution} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="OS Geradas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="OS Expedidas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    {rows.some(r => r.metaOsGeradas) && (
                      <Line type="monotone" dataKey="Meta OS Geradas" stroke="#f59e0b" strokeDasharray="5 5" dot={false} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Evolução de Solda — Produção Interna vs Demanda Total</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartEvolution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Prod. Solda (m)" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Demanda Solda (m)" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tabela comparativa */}
            <Card>
              <CardHeader><CardTitle className="text-base">Tabela Comparativa</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Mês</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Faturamento</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">% Meta Fat.</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Ticket Médio</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">OS Geradas</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">OS Expedidas</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Prod. Solda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const fat = n(r.faturamentoRealizado);
                      const metaF = n(r.metaFaturamento) || metaFatConfig;
                      const pct = fat > 0 ? (fat / metaF) * 100 : null;
                      const ped = n((r as any).totalPedidos) || n(r.osGeradas);
                      const ticket = fat > 0 && ped > 0 ? fat / ped : null;
                      return (
                        <tr key={r.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => handleEdit(r)}>
                          <td className="py-2 pr-4 font-medium">{MESES[r.mes - 1]} {r.ano}</td>
                          <td className="text-right py-2 px-2">{fat > 0 ? fmtBRL(fat) : "—"}</td>
                          <td className={`text-right py-2 px-2 font-medium ${pct == null ? "" : pct >= 100 ? "text-green-600" : "text-red-600"}`}>
                            {pct != null ? `${fmt(pct, 1)}%` : "—"}
                          </td>
                          <td className="text-right py-2 px-2 text-teal-700 font-medium">{ticket != null ? fmtBRL(ticket) : "—"}</td>
                          <td className="text-right py-2 px-2">{r.osGeradas ?? (r as any).totalPedidos ?? "—"}</td>
                          <td className="text-right py-2 px-2">{r.osExpedicao ?? "—"}</td>
                          <td className="text-right py-2 px-2">{r.producaoInternaSolda ? `${r.producaoInternaSolda}m` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── ABA: Análise de Solda ─── */}
          <TabsContent value="solda" className="space-y-4">
            {rowAtual && <PainelCustoSolda row={rowAtual} />}
          </TabsContent>

          {/* ─── ABA: Curva ABC Produtos ─── */}
          <TabsContent value="abc-produtos" className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="w-5 h-5 text-muted-foreground" />
              <div>
                <h2 className="text-base font-semibold">Curva ABC de Produtos</h2>
                <p className="text-xs text-muted-foreground">Ranking mensal e evolução comparativa — dados do ERP Mubisys</p>
              </div>
            </div>

            <Tabs defaultValue="ranking">
              <TabsList className="mb-4">
                <TabsTrigger value="ranking">
                  <ShoppingBag className="w-3.5 h-3.5 mr-1" />
                  Ranking do Mês
                </TabsTrigger>
                <TabsTrigger value="evolucao">
                  <TrendingUp className="w-3.5 h-3.5 mr-1" />
                  Evolução Mensal
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ranking">
                <p className="text-xs text-muted-foreground mb-3">
                  {rowAtual ? `${MESES[rowAtual.mes - 1]} ${rowAtual.ano}` : "—"} — classificação por faturamento
                </p>
                {rowAtual && <PainelAbcProdutos mes={rowAtual.mes} ano={rowAtual.ano} />}
              </TabsContent>

              <TabsContent value="evolucao">
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground">
                    Selecione os meses para comparar a participação dos principais produtos no faturamento. Máx. 6 meses.
                  </p>
                </div>
                <GraficoEvolucaoProdutos />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ─── ABA: Curva ABC Clientes ─── */}
          <TabsContent value="abc-clientes" className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <h2 className="text-base font-semibold">Curva ABC de Clientes</h2>
                <p className="text-xs text-muted-foreground">
                  {rowAtual ? `${MESES[rowAtual.mes - 1]} ${rowAtual.ano}` : "—"} — dados do ERP Mubisys
                </p>
              </div>
            </div>
            {rowAtual && (
              <PainelAbcClientes
                mes={rowAtual.mes}
                ano={rowAtual.ano}
              />
            )}
          </TabsContent>

          {/* ─── ABA: Comparação Entre Meses ─── */}
          <TabsContent value="comparacao" className="space-y-4">
            <PainelComparacao rows={rows} />
          </TabsContent>

          {/* ─── ABA: Histórico ─── */}
          <TabsContent value="historico" className="space-y-3">
            {rows.map(r => {
              const fat = n(r.faturamentoRealizado);
              const metaF = n(r.metaFaturamento) || metaFatConfig;
              const ped = n((r as any).totalPedidos) || n(r.osGeradas);
              const ticket = fat > 0 && ped > 0 ? fat / ped : null;
              return (
                <Card key={r.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{MESES[r.mes - 1]} {r.ano}</h3>
                        <div className="flex gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                          {fat > 0 && <span>💰 {fmtBRL(fat)} ({fmt((fat / metaF) * 100, 0)}% da meta)</span>}
                          {ticket && <span>🎫 Ticket médio: {fmtBRL(ticket)}</span>}
                          {r.osGeradas && <span>📋 {r.osGeradas} OS geradas</span>}
                          {r.osExpedicao && <span>✅ {r.osExpedicao} expedidas</span>}
                          {r.producaoInternaSolda && <span>🔧 {r.producaoInternaSolda}m solda</span>}
                        </div>
                        {r.observacoes && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.observacoes}</p>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(r)}><Edit2 className="w-4 h-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      )}
    </div>
    </DashboardLayout>
  );
}
