import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Target, TrendingUp, Users, DollarSign, BarChart2, Percent,
  Save, Edit2, ChevronDown, ChevronUp, Trash2, Link2, UserPlus, Star,
} from "lucide-react";
import UserSelect from "@/components/UserSelect";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const VENDEDORES_EXCLUIDOS_METAS = ["Joice", "Daniel"];

function pct(real: number, meta: number | null | undefined) {
  if (!meta || meta === 0) return null;
  return Math.min(Math.round((real / meta) * 100), 999);
}

function ProgressBar({ real, meta }: { real: number; meta: number | null | undefined }) {
  const p = pct(real, meta);
  if (p === null) return <span className="text-xs text-slate-400">sem meta</span>;
  const bg = p >= 100 ? "#22c55e" : p >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div style={{ width: `${Math.min(p, 100)}%`, background: bg }} className="h-full rounded-full transition-all" />
      </div>
      <span className="text-[11px] font-bold" style={{ color: bg }}>{p}%</span>
    </div>
  );
}

function MetaInput({ label, value, onChange, prefix = "", suffix = "" }: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string; suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500 font-medium">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-xs text-slate-400">{prefix}</span>}
        <Input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-7 text-sm w-28 py-0"
          placeholder="—"
        />
        {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

const GERAL_FORM_EMPTY = {
  metaCotacoes: "", metaVendas: "", metaFaturamento: "", metaConversao: "",
  metaTicketMedio: "", metaClientesNovos: "", metaOsGeradas: "", metaOsNovos: "",
  metaCotacoesNovos: "", metaFaturamentoNovos: "", metaTaxaFaturamento: "",
  metaTicketMedioNovos: "", metaValorOrcado: "",
};

// Formulário expandido para metas individuais por vendedor
const VENDEDOR_FORM_EMPTY = {
  metaCotacoes: "", metaVendas: "", metaFaturamento: "", metaConversao: "",
  metaTicketMedio: "", metaOsGeradas: "", metaClientesNovos: "",
  metaFaturamentoNovos: "", metaTaxaFaturamento: "", metaValorOrcado: "",
};

export default function MetasComerciais() {
  const now = new Date();
  const [mesSel, setMesSel] = useState(now.getMonth() + 1);
  const [anoSel, setAnoSel] = useState(now.getFullYear());
  const [editingGeral, setEditingGeral] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState<string | null>(null);
  const [expandedVendedor, setExpandedVendedor] = useState<string | null>(null);

  const { data: mesDados, isLoading: loadingMes } = trpc.performanceComercial.getMes.useQuery(
    { mes: mesSel, ano: anoSel }
  );
  const { data: metas, refetch: refetchMetas } = trpc.performanceComercial.getMetas.useQuery(
    { mes: mesSel, ano: anoSel }
  );
  const { data: clientesNovos } = trpc.performanceComercial.getClientesNovos.useQuery(
    { mes: mesSel, ano: anoSel }
  );

  const upsertMeta = trpc.performanceComercial.upsertMeta.useMutation({
    onSuccess: () => { refetchMetas(); toast.success("Metas salvas com sucesso!"); },
    onError: (e: { message: string }) => toast.error("Erro ao salvar: " + e.message),
  });

  const vincularUsuario = trpc.crm.vincularUsuarioMeta.useMutation({
    onSuccess: () => { toast.success("Vínculo salvo!"); refetchMetas(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const excluirVendedor = trpc.crm.excluirVendedorMeta.useMutation({
    onSuccess: () => { toast.success("Vendedor removido das metas do mês."); refetchMetas(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const { data: crmMetas, refetch: refetchCrmMetas } = trpc.crm.getMetas.useQuery({ mes: mesSel, ano: anoSel });
  const _ = refetchCrmMetas;

  const metaGeral = useMemo(() => metas?.find(m => m.vendedor === "GERAL"), [metas]);
  const [geralForm, setGeralForm] = useState(GERAL_FORM_EMPTY);
  const [vendedorForm, setVendedorForm] = useState<Record<string, string>>(VENDEDOR_FORM_EMPTY);

  function openEditGeral() {
    setGeralForm({
      metaCotacoes: metaGeral?.metaCotacoes ? String(metaGeral.metaCotacoes) : "",
      metaVendas: metaGeral?.metaVendas ? String(metaGeral.metaVendas) : "",
      metaFaturamento: metaGeral?.metaFaturamento ? String(metaGeral.metaFaturamento) : "",
      metaConversao: metaGeral?.metaConversao ? String(metaGeral.metaConversao) : "",
      metaTicketMedio: metaGeral?.metaTicketMedio ? String(metaGeral.metaTicketMedio) : "",
      metaClientesNovos: metaGeral?.metaClientesNovos ? String(metaGeral.metaClientesNovos) : "",
      metaOsGeradas: metaGeral?.metaOsGeradas ? String(metaGeral.metaOsGeradas) : "",
      metaOsNovos: metaGeral?.metaOsNovos ? String(metaGeral.metaOsNovos) : "",
      metaCotacoesNovos: metaGeral?.metaCotacoesNovos ? String(metaGeral.metaCotacoesNovos) : "",
      metaFaturamentoNovos: metaGeral?.metaFaturamentoNovos ? String(metaGeral.metaFaturamentoNovos) : "",
      metaTaxaFaturamento: metaGeral?.metaTaxaFaturamento ? String(metaGeral.metaTaxaFaturamento) : "",
      metaTicketMedioNovos: metaGeral?.metaTicketMedioNovos ? String(metaGeral.metaTicketMedioNovos) : "",
      metaValorOrcado: metaGeral?.metaValorOrcado ? String(metaGeral.metaValorOrcado) : "",
    });
    setEditingGeral(true);
  }

  async function saveGeralMeta() {
    await upsertMeta.mutateAsync({
      vendedor: "GERAL",
      mes: mesSel,
      ano: anoSel,
      metaCotacoes: geralForm.metaCotacoes ? Number(geralForm.metaCotacoes) : null,
      metaVendas: geralForm.metaVendas ? Number(geralForm.metaVendas) : null,
      metaFaturamento: geralForm.metaFaturamento ? Number(geralForm.metaFaturamento) : null,
      metaConversao: geralForm.metaConversao ? Number(geralForm.metaConversao) : null,
      metaTicketMedio: geralForm.metaTicketMedio ? Number(geralForm.metaTicketMedio) : null,
      metaClientesNovos: geralForm.metaClientesNovos ? Number(geralForm.metaClientesNovos) : null,
      metaOsGeradas: geralForm.metaOsGeradas ? Number(geralForm.metaOsGeradas) : null,
      metaOsNovos: geralForm.metaOsNovos ? Number(geralForm.metaOsNovos) : null,
      metaCotacoesNovos: geralForm.metaCotacoesNovos ? Number(geralForm.metaCotacoesNovos) : null,
      metaFaturamentoNovos: geralForm.metaFaturamentoNovos ? Number(geralForm.metaFaturamentoNovos) : null,
      metaTaxaFaturamento: geralForm.metaTaxaFaturamento ? Number(geralForm.metaTaxaFaturamento) : null,
      metaTicketMedioNovos: geralForm.metaTicketMedioNovos ? Number(geralForm.metaTicketMedioNovos) : null,
      metaValorOrcado: geralForm.metaValorOrcado ? Number(geralForm.metaValorOrcado) : null,
    });
    setEditingGeral(false);
  }

  function openEditVendedor(vendedor: string) {
    const meta = metas?.find(m => m.vendedor === vendedor);
    setVendedorForm({
      metaCotacoes: meta?.metaCotacoes ? String(meta.metaCotacoes) : "",
      metaVendas: meta?.metaVendas ? String(meta.metaVendas) : "",
      metaFaturamento: meta?.metaFaturamento ? String(meta.metaFaturamento) : "",
      metaConversao: meta?.metaConversao ? String(meta.metaConversao) : "",
      metaTicketMedio: meta?.metaTicketMedio ? String(meta.metaTicketMedio) : "",
      metaOsGeradas: meta?.metaOsGeradas ? String(meta.metaOsGeradas) : "",
      metaClientesNovos: meta?.metaClientesNovos ? String(meta.metaClientesNovos) : "",
      metaFaturamentoNovos: meta?.metaFaturamentoNovos ? String(meta.metaFaturamentoNovos) : "",
      metaTaxaFaturamento: meta?.metaTaxaFaturamento ? String(meta.metaTaxaFaturamento) : "",
      metaValorOrcado: meta?.metaValorOrcado ? String(meta.metaValorOrcado) : "",
    });
    setEditingVendedor(vendedor);
  }

  async function saveVendedorMeta(vendedor: string) {
    await upsertMeta.mutateAsync({
      vendedor,
      mes: mesSel,
      ano: anoSel,
      metaCotacoes: vendedorForm.metaCotacoes ? Number(vendedorForm.metaCotacoes) : null,
      metaVendas: vendedorForm.metaVendas ? Number(vendedorForm.metaVendas) : null,
      metaFaturamento: vendedorForm.metaFaturamento ? Number(vendedorForm.metaFaturamento) : null,
      metaConversao: vendedorForm.metaConversao ? Number(vendedorForm.metaConversao) : null,
      metaTicketMedio: vendedorForm.metaTicketMedio ? Number(vendedorForm.metaTicketMedio) : null,
      metaOsGeradas: vendedorForm.metaOsGeradas ? Number(vendedorForm.metaOsGeradas) : null,
      metaClientesNovos: vendedorForm.metaClientesNovos ? Number(vendedorForm.metaClientesNovos) : null,
      metaFaturamentoNovos: vendedorForm.metaFaturamentoNovos ? Number(vendedorForm.metaFaturamentoNovos) : null,
      metaTaxaFaturamento: vendedorForm.metaTaxaFaturamento ? Number(vendedorForm.metaTaxaFaturamento) : null,
      metaValorOrcado: vendedorForm.metaValorOrcado ? Number(vendedorForm.metaValorOrcado) : null,
    });
    setEditingVendedor(null);
  }

  const vendedores = useMemo(() => {
    const rawPorVendedor = mesDados?.porVendedor;
    const all = Array.isArray(rawPorVendedor) ? rawPorVendedor : [];
    return all.filter((v: any) =>
      !VENDEDORES_EXCLUIDOS_METAS.some(excl =>
        String(v.vendedor).toLowerCase().includes(excl.toLowerCase())
      )
    );
  }, [mesDados]);

  const totalReal = {
    cotacoes: mesDados?.cotacoes ?? 0,
    vendas: mesDados?.osGeradas ?? 0,
    faturamento: mesDados?.faturamento ?? 0,
    taxaConversao: mesDados?.taxaConversao ?? 0,
    taxaFaturamento: mesDados?.taxaFaturamento ?? 0,
    ticketMedio: mesDados?.ticketMedio ?? 0,
    clientesNovos: (clientesNovos as any)?.total ?? 0,
    osNovos: (clientesNovos as any)?.osNovos ?? 0,
    cotacoesNovos: (clientesNovos as any)?.cotacoesNovos ?? 0,
    faturamentoNovos: (clientesNovos as any)?.faturamentoNovos ?? 0,
    ticketMedioNovos: (clientesNovos as any)?.ticketMedioNovos ?? 0,
    valorOrcado: mesDados?.valorOrcado ?? 0,
  };

  const geralKpis = [
    { icon: <BarChart2 className="w-4 h-4 text-blue-500" />, label: "Cotações Enviadas", real: totalReal.cotacoes, meta: metaGeral?.metaCotacoes ? Number(metaGeral.metaCotacoes) : null, fmt: (v: number) => v.toString() },
    { icon: <TrendingUp className="w-4 h-4 text-purple-500" />, label: "Vendas Realizadas", real: totalReal.vendas, meta: metaGeral?.metaOsGeradas ? Number(metaGeral.metaOsGeradas) : null, fmt: (v: number) => v.toString() },
    { icon: <DollarSign className="w-4 h-4 text-green-500" />, label: "Faturamento", real: totalReal.faturamento, meta: metaGeral?.metaFaturamento ? Number(metaGeral.metaFaturamento) : null, fmt: (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` },
    { icon: <Percent className="w-4 h-4 text-amber-500" />, label: "Taxa Conversão", real: totalReal.taxaConversao, meta: metaGeral?.metaConversao ? Number(metaGeral.metaConversao) : null, fmt: (v: number) => `${v}%` },
    { icon: <Percent className="w-4 h-4 text-orange-500" />, label: "Taxa Faturamento", real: totalReal.taxaFaturamento, meta: metaGeral?.metaTaxaFaturamento ? Number(metaGeral.metaTaxaFaturamento) : null, fmt: (v: number) => `${v}%` },
    { icon: <Target className="w-4 h-4 text-slate-500" />, label: "Ticket Médio Geral", real: totalReal.ticketMedio, meta: metaGeral?.metaTicketMedio ? Number(metaGeral.metaTicketMedio) : null, fmt: (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` },
    { icon: <Users className="w-4 h-4 text-teal-500" />, label: "Clientes Novos", real: totalReal.clientesNovos, meta: metaGeral?.metaClientesNovos ? Number(metaGeral.metaClientesNovos) : null, fmt: (v: number) => v.toString() },
  ];

  const novosKpis = [
    { icon: <UserPlus className="w-4 h-4 text-teal-500" />, label: "Cotações (Novos)", real: totalReal.cotacoesNovos, meta: metaGeral?.metaCotacoesNovos ? Number(metaGeral.metaCotacoesNovos) : null, fmt: (v: number) => v.toString() },
    { icon: <Star className="w-4 h-4 text-teal-600" />, label: "Vendas Realizadas (Novos)", real: totalReal.osNovos, meta: metaGeral?.metaOsNovos ? Number(metaGeral.metaOsNovos) : null, fmt: (v: number) => v.toString() },
    { icon: <DollarSign className="w-4 h-4 text-teal-700" />, label: "Faturamento (Novos)", real: totalReal.faturamentoNovos, meta: metaGeral?.metaFaturamentoNovos ? Number(metaGeral.metaFaturamentoNovos) : null, fmt: (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` },
    { icon: <Target className="w-4 h-4 text-teal-800" />, label: "Ticket Médio (Novos)", real: totalReal.ticketMedioNovos, meta: metaGeral?.metaTicketMedioNovos ? Number(metaGeral.metaTicketMedioNovos) : null, fmt: (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">COMERCIAL</p>
            <h1 className="text-2xl font-bold text-slate-800">Metas Comerciais</h1>
            <p className="text-sm text-slate-500 mt-0.5">Defina e acompanhe metas gerais e individuais por vendedor</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={mesSel} onChange={e => setMesSel(Number(e.target.value))} className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white">
              {MESES_NOMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={anoSel} onChange={e => setAnoSel(Number(e.target.value))} className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white">
              {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* Meta Geral */}
        <Card className="border-2 border-blue-100">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                Meta Geral — {MESES_NOMES[mesSel - 1]} {anoSel}
              </CardTitle>
              {!editingGeral ? (
                <Button size="sm" variant="outline" onClick={openEditGeral}>
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar Metas
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingGeral(false)}>Cancelar</Button>
                  <Button size="sm" onClick={saveGeralMeta} disabled={upsertMeta.isPending}>
                    <Save className="w-3.5 h-3.5 mr-1" /> Salvar
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingGeral ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Indicadores Gerais</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    <MetaInput label="Cotações Enviadas" value={geralForm.metaCotacoes} onChange={v => setGeralForm(f => ({ ...f, metaCotacoes: v }))} />
                    <MetaInput label="Vendas Realizadas" value={geralForm.metaOsGeradas} onChange={v => setGeralForm(f => ({ ...f, metaOsGeradas: v }))} />
                    <MetaInput label="Faturamento" value={geralForm.metaFaturamento} onChange={v => setGeralForm(f => ({ ...f, metaFaturamento: v }))} prefix="R$" />
                    <MetaInput label="Valor Orçado" value={geralForm.metaValorOrcado} onChange={v => setGeralForm(f => ({ ...f, metaValorOrcado: v }))} prefix="R$" />
                    <MetaInput label="Taxa de Conversão" value={geralForm.metaConversao} onChange={v => setGeralForm(f => ({ ...f, metaConversao: v }))} suffix="%" />
                    <MetaInput label="Taxa de Faturamento" value={geralForm.metaTaxaFaturamento} onChange={v => setGeralForm(f => ({ ...f, metaTaxaFaturamento: v }))} suffix="%" />
                    <MetaInput label="Ticket Médio Geral" value={geralForm.metaTicketMedio} onChange={v => setGeralForm(f => ({ ...f, metaTicketMedio: v }))} prefix="R$" />
                    <MetaInput label="Clientes Novos" value={geralForm.metaClientesNovos} onChange={v => setGeralForm(f => ({ ...f, metaClientesNovos: v }))} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" /> Novos Clientes
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    <MetaInput label="Cotações (Novos)" value={geralForm.metaCotacoesNovos} onChange={v => setGeralForm(f => ({ ...f, metaCotacoesNovos: v }))} />
                    <MetaInput label="Vendas Realizadas (Novos)" value={geralForm.metaOsNovos} onChange={v => setGeralForm(f => ({ ...f, metaOsNovos: v }))} />
                    <MetaInput label="Faturamento (Novos)" value={geralForm.metaFaturamentoNovos} onChange={v => setGeralForm(f => ({ ...f, metaFaturamentoNovos: v }))} prefix="R$" />
                    <MetaInput label="Ticket Médio (Novos)" value={geralForm.metaTicketMedioNovos} onChange={v => setGeralForm(f => ({ ...f, metaTicketMedioNovos: v }))} prefix="R$" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {geralKpis.map((item, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        {item.icon} {item.label}
                      </div>
                      <div className="text-lg font-bold text-slate-800">{item.fmt(item.real)}</div>
                      {item.meta ? (
                        <>
                          <div className="text-xs text-slate-400">Meta: {item.fmt(item.meta)}</div>
                          <ProgressBar real={item.real} meta={item.meta} />
                        </>
                      ) : (
                        <div className="text-xs text-slate-400 italic">sem meta definida</div>
                      )}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" /> Novos Clientes
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {novosKpis.map((item, i) => (
                      <div key={i} className="bg-teal-50/60 rounded-lg p-3 space-y-1.5 border border-teal-100">
                        <div className="flex items-center gap-1.5 text-xs text-teal-600 font-medium">
                          {item.icon} {item.label}
                        </div>
                        <div className="text-lg font-bold text-slate-800">{item.fmt(item.real)}</div>
                        {item.meta ? (
                          <>
                            <div className="text-xs text-teal-500">Meta: {item.fmt(item.meta)}</div>
                            <ProgressBar real={item.real} meta={item.meta} />
                          </>
                        ) : (
                          <div className="text-xs text-slate-400 italic">sem meta definida</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metas Individuais por Vendedor */}
        <div>
          <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Metas Individuais por Vendedor
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            As metas individuais são exibidas nos cards de KPI do Performance Comercial como badge de progresso por vendedor.
          </p>
          {loadingMes ? (
            <div className="text-sm text-slate-400 py-8 text-center">Carregando dados...</div>
          ) : vendedores.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nenhum dado disponível para este mês.</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-3">
              {vendedores.map((v: any) => {
                const meta = metas?.find(m => m.vendedor === v.vendedor);
                const isEditing = editingVendedor === v.vendedor;
                const isExpanded = expandedVendedor === v.vendedor || isEditing;
                const clientesNovosVendedor = (clientesNovos as any)?.porVendedor?.[v.vendedor] ?? 0;
                const novosMap = (clientesNovos as any)?.porVendedorNovos ?? {};
                const keyNorm = String(v.vendedor).trim().toLowerCase();
                const novosEntry = novosMap[v.vendedor] ?? novosMap[keyNorm] ??
                  Object.entries(novosMap).find(([k]) => k.toLowerCase() === keyNorm)?.[1] as any ?? null;
                const faturamentoNovosV = novosEntry?.faturamentoNovos ?? 0;

                // Calcular % de atingimento para cada indicador
                const indicadores = [
                  { label: "Cotações", real: v.cotacoes, meta: meta?.metaCotacoes ? Number(meta.metaCotacoes) : null, fmt: (x: number) => x.toString() },
                  { label: "Vendas Realizadas", real: v.osGeradas, meta: meta?.metaOsGeradas ? Number(meta.metaOsGeradas) : null, fmt: (x: number) => x.toString() },
                  { label: "Faturamento", real: v.faturamento, meta: meta?.metaFaturamento ? Number(meta.metaFaturamento) : null, fmt: (x: number) => `R$ ${x.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` },
                  { label: "Valor Orçado", real: v.valorOrcado, meta: meta?.metaValorOrcado ? Number(meta.metaValorOrcado) : null, fmt: (x: number) => `R$ ${x.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` },
                  { label: "Conv. Pedido", real: v.taxaConversao, meta: meta?.metaConversao ? Number(meta.metaConversao) : null, fmt: (x: number) => `${x}%` },
                  { label: "Conv. Fat.", real: v.taxaFaturamento, meta: meta?.metaTaxaFaturamento ? Number(meta.metaTaxaFaturamento) : null, fmt: (x: number) => `${x}%` },
                  { label: "Ticket Médio", real: v.ticketMedio, meta: meta?.metaTicketMedio ? Number(meta.metaTicketMedio) : null, fmt: (x: number) => `R$ ${x.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` },
                  { label: "Clientes Novos", real: clientesNovosVendedor, meta: meta?.metaClientesNovos ? Number(meta.metaClientesNovos) : null, fmt: (x: number) => x.toString() },
                  { label: "Fat. Novos", real: faturamentoNovosV, meta: meta?.metaFaturamentoNovos ? Number(meta.metaFaturamentoNovos) : null, fmt: (x: number) => `R$ ${x.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` },
                ];

                // Calcular score geral de metas com meta definida
                const comMeta = indicadores.filter(i => i.meta && i.meta > 0);
                const atingidos = comMeta.filter(i => i.meta && i.real >= i.meta).length;
                const scoreLabel = comMeta.length > 0 ? `${atingidos}/${comMeta.length} metas atingidas` : "sem metas definidas";
                const scorePct = comMeta.length > 0 ? Math.round((atingidos / comMeta.length) * 100) : null;

                const crmMeta = crmMetas?.find((m: any) => m.vendedor === v.vendedor);
                const usuarioVinculadoNome = crmMeta?.usuarioVinculadoNome ?? null;

                return (
                  <Card key={v.vendedor} className="overflow-hidden">
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedVendedor(isExpanded && !isEditing ? null : v.vendedor)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                          {v.vendedor.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{v.vendedor}</p>
                          <p className="text-xs text-slate-400">
                            {v.cotacoes} cot. · {v.osGeradas} OS · R$ {v.faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                          </p>
                          {usuarioVinculadoNome && (
                            <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                              <Link2 className="w-3 h-3" /> {usuarioVinculadoNome}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {scorePct !== null && (
                          <Badge
                            variant="outline"
                            className={`text-xs font-bold ${
                              scorePct >= 100 ? "border-green-300 text-green-700 bg-green-50"
                              : scorePct >= 60 ? "border-amber-300 text-amber-700 bg-amber-50"
                              : "border-red-300 text-red-700 bg-red-50"
                            }`}
                          >
                            {scoreLabel}
                          </Badge>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100 px-4 py-4 bg-slate-50/50">
                        {isEditing ? (
                          <div className="space-y-4">
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Indicadores Gerais</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                <MetaInput label="Cotações" value={vendedorForm.metaCotacoes ?? ""} onChange={v2 => setVendedorForm(f => ({ ...f, metaCotacoes: v2 }))} />
                                <MetaInput label="Vendas Realizadas" value={vendedorForm.metaOsGeradas ?? ""} onChange={v2 => setVendedorForm(f => ({ ...f, metaOsGeradas: v2 }))} />
                                <MetaInput label="Faturamento" value={vendedorForm.metaFaturamento ?? ""} onChange={v2 => setVendedorForm(f => ({ ...f, metaFaturamento: v2 }))} prefix="R$" />
                                <MetaInput label="Valor Orçado" value={vendedorForm.metaValorOrcado ?? ""} onChange={v2 => setVendedorForm(f => ({ ...f, metaValorOrcado: v2 }))} prefix="R$" />
                                <MetaInput label="Conv. Pedido" value={vendedorForm.metaConversao ?? ""} onChange={v2 => setVendedorForm(f => ({ ...f, metaConversao: v2 }))} suffix="%" />
                                <MetaInput label="Conv. Fat." value={vendedorForm.metaTaxaFaturamento ?? ""} onChange={v2 => setVendedorForm(f => ({ ...f, metaTaxaFaturamento: v2 }))} suffix="%" />
                                <MetaInput label="Ticket Médio" value={vendedorForm.metaTicketMedio ?? ""} onChange={v2 => setVendedorForm(f => ({ ...f, metaTicketMedio: v2 }))} prefix="R$" />
                                <MetaInput label="Clientes Novos" value={vendedorForm.metaClientesNovos ?? ""} onChange={v2 => setVendedorForm(f => ({ ...f, metaClientesNovos: v2 }))} />
                                <MetaInput label="Fat. Novos" value={vendedorForm.metaFaturamentoNovos ?? ""} onChange={v2 => setVendedorForm(f => ({ ...f, metaFaturamentoNovos: v2 }))} prefix="R$" />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => setEditingVendedor(null)}>Cancelar</Button>
                              <Button size="sm" onClick={() => saveVendedorMeta(v.vendedor)} disabled={upsertMeta.isPending}>
                                <Save className="w-3.5 h-3.5 mr-1" /> Salvar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                              {indicadores.map((kpi, i) => {
                                const p = pct(kpi.real, kpi.meta);
                                const bg = p === null ? "" : p >= 100 ? "#22c55e" : p >= 70 ? "#f59e0b" : "#ef4444";
                                return (
                                  <div key={i} className="bg-white rounded-md p-2.5 border border-slate-100 space-y-1">
                                    <div className="text-[11px] text-slate-500 font-medium">{kpi.label}</div>
                                    <div className="text-sm font-bold text-slate-800">{kpi.fmt(kpi.real)}</div>
                                    {kpi.meta ? (
                                      <>
                                        <div className="text-[10px] text-slate-400">Meta: {kpi.fmt(kpi.meta)}</div>
                                        <div className="flex items-center gap-1.5">
                                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div style={{ width: `${Math.min(p ?? 0, 100)}%`, background: bg }} className="h-full rounded-full transition-all" />
                                          </div>
                                          <span className="text-[10px] font-bold" style={{ color: bg }}>{p}%</span>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-[10px] text-slate-400 italic">sem meta</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => openEditVendedor(v.vendedor)}>
                                <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar Metas
                              </Button>

                              <div className="flex items-center gap-2">
                                <Link2 className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-xs text-slate-500">Usuário:</span>
                                <UserSelect
                                  value={usuarioVinculadoNome ?? ""}
                                  onChange={(nome) => {
                                    vincularUsuario.mutate({
                                      vendedor: v.vendedor,
                                      mes: mesSel,
                                      ano: anoSel,
                                      usuarioId: null,
                                      usuarioNome: nome || null,
                                    });
                                  }}
                                  placeholder="Vincular usuário"
                                  allowEmpty
                                  className="h-7 text-xs w-40"
                                />
                              </div>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 gap-1">
                                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir vendedor das metas?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Isso removerá <strong>{v.vendedor}</strong> das metas de {MESES_NOMES[mesSel-1]}/{anoSel}. Os dados de performance do ERP não serão afetados.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-red-600 hover:bg-red-700"
                                      onClick={() => excluirVendedor.mutate({ vendedor: v.vendedor, mes: mesSel, ano: anoSel })}
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 text-center pb-4">
          Taxa Conversão = Vendas Realizadas / Cotações · Taxa Faturamento = Faturamento OS / Valor Orçado · Clientes Novos = primeira compra no histórico
        </p>
      </div>
    </DashboardLayout>
  );
}
