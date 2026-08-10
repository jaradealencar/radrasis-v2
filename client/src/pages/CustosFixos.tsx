import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Treemap,
} from "recharts";
import {
  TrendingDown, DollarSign, Users, Building2, Wrench, Landmark,
  ShoppingBag, Monitor, Scale, Megaphone, ChevronDown, ChevronUp,
  Search, AlertCircle, CreditCard, Info, Plus, Pencil, Trash2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtBRL(v: number | null | undefined): string {
  if (v == null || isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v: number): string {
  return v.toFixed(1) + "%";
}

// ─── Cores por grupo ──────────────────────────────────────────────────────────
const GRUPO_CORES: Record<string, string> = {
  "Pessoal":             "#3b82f6",
  "Instalações":         "#10b981",
  "Operacional":         "#f59e0b",
  "TI & Admin":          "#8b5cf6",
  "Jurídico & Contábil": "#ec4899",
  "Comercial":           "#06b6d4",
  "Financeiro":          "#ef4444",
  "Outros":              "#6b7280",
};

const GRUPO_ICONES: Record<string, React.ReactNode> = {
  "Pessoal":             <Users size={16} />,
  "Instalações":         <Building2 size={16} />,
  "Operacional":         <Wrench size={16} />,
  "TI & Admin":          <Monitor size={16} />,
  "Jurídico & Contábil": <Scale size={16} />,
  "Comercial":           <Megaphone size={16} />,
  "Financeiro":          <Landmark size={16} />,
  "Outros":              <ShoppingBag size={16} />,
};

// ─── Tooltip customizado ──────────────────────────────────────────────────────
function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm min-w-[180px]">
      <div className="font-semibold mb-1">{d.name}</div>
      <div className="text-muted-foreground">{fmtBRL(d.value)}</div>
      <div className="text-xs text-muted-foreground">{fmtPct(d.payload.pct)}</div>
    </div>
  );
}

function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm min-w-[200px]">
      <div className="font-semibold mb-2 truncate max-w-[220px]">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.fill }}>{p.name}</span>
          <span className="font-medium">{fmtBRL(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  titulo, valor, sub, cor, icon, destaque
}: {
  titulo: string; valor: string; sub?: string; cor: string; icon: React.ReactNode; destaque?: boolean;
}) {
  return (
    <Card className={`border-l-4 ${destaque ? "shadow-md" : ""}`} style={{ borderLeftColor: cor }}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{titulo}</span>
          <span style={{ color: cor }}>{icon}</span>
        </div>
        <div className="text-2xl font-bold" style={{ color: cor }}>{valor}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
const GRUPOS_OPCOES = [
  "Pessoal", "Instalações", "Operacional", "TI & Admin",
  "Jurídico & Contábil", "Comercial", "Financeiro", "Outros",
];

const TIPOS_OPCOES = ["Fixa", "Variavel", "Operacional"];

const EMPTY_FORM = {
  id: undefined as number | undefined,
  plano: "",
  categoria: "",
  grupoCategoria: "Pessoal",
  fornecedor: "",
  tipo: "Fixa",
  valor: "",
  vencimento: "",
  observacao: "",
};

export default function CustosFixos() {
  const [busca, setBusca] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState<string>("Todos");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [mesDivida, setMesDivida] = useState<number>(new Date().getMonth() + 1);

  // ─── Estado do modal CRUD ──────────────────────────────────────────────────
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  function abrirNovo() {
    setForm({ ...EMPTY_FORM });
    setModalAberto(true);
  }

  function abrirEditar(c: typeof custosFixos[0]) {
    setForm({
      id: c.id,
      plano: c.plano ?? "",
      categoria: c.categoria,
      grupoCategoria: c.grupoCategoria,
      fornecedor: c.fornecedor,
      tipo: c.tipo,
      valor: String(c.valor),
      vencimento: c.vencimento != null ? String(c.vencimento) : "",
      observacao: c.observacao ?? "",
    });
    setModalAberto(true);
  }

  const utils = trpc.useUtils();

  const upsertMut = trpc.financeiro.upsertCustoFixo.useMutation({
    onSuccess: () => {
      toast.success(form.id ? "Despesa atualizada!" : "Despesa adicionada!");
      setModalAberto(false);
      utils.financeiro.getCustosFixos.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const deleteMut = trpc.financeiro.deleteCustoFixo.useMutation({
    onSuccess: () => {
      toast.success("Despesa removida!");
      utils.financeiro.getCustosFixos.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  function handleSave() {
    const valorNum = parseFloat(String(form.valor).replace(/\./g, "").replace(",", "."));
    if (!form.categoria.trim()) return toast.error("Informe a categoria.");
    if (isNaN(valorNum) || valorNum < 0) return toast.error("Valor inválido.");
    upsertMut.mutate({
      id: form.id,
      plano: form.plano || form.categoria,
      categoria: form.categoria,
      grupoCategoria: form.grupoCategoria,
      fornecedor: form.fornecedor || "DIVERSOS",
      tipo: form.tipo,
      valor: valorNum,
      vencimento: form.vencimento ? parseInt(form.vencimento) : null,
      observacao: form.observacao || null,
    });
  }

  function handleDelete(id: number, nome: string) {
    if (!window.confirm(`Remover "${nome}"?`)) return;
    deleteMut.mutate({ id });
  }

  const { data: custosFixos = [], isLoading: loadingFixos } = trpc.financeiro.getCustosFixos.useQuery();
  const { data: dividas = [], isLoading: loadingDividas } = trpc.financeiro.getDividas.useQuery();

  const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const MESES_KEYS = ["janValor","fevValor","marValor","abrValor","maiValor","junValor","julValor","agoValor","setValor","outValor","novValor","dezValor"] as const;

  // ─── Cálculos principais ────────────────────────────────────────────────────
  const totalFixo = useMemo(() => custosFixos.reduce((s, c) => s + c.valor, 0), [custosFixos]);

  const porGrupo = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of custosFixos) {
      m[c.grupoCategoria] = (m[c.grupoCategoria] ?? 0) + c.valor;
    }
    return Object.entries(m)
      .map(([grupo, valor]) => ({ grupo, valor, pct: totalFixo > 0 ? valor / totalFixo * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
  }, [custosFixos, totalFixo]);

  const porCategoria = useMemo(() => {
    const m: Record<string, { categoria: string; grupo: string; valor: number }> = {};
    for (const c of custosFixos) {
      if (!m[c.categoria]) m[c.categoria] = { categoria: c.categoria, grupo: c.grupoCategoria, valor: 0 };
      m[c.categoria].valor += c.valor;
    }
    return Object.values(m).sort((a, b) => b.valor - a.valor);
  }, [custosFixos]);

  const totalDividaMes = useMemo(() => {
    const key = MESES_KEYS[mesDivida - 1];
    return dividas.reduce((s, d) => s + (d[key] ?? 0), 0);
  }, [dividas, mesDivida]);

  const totalDividaMedia = useMemo(() => dividas.reduce((s, d) => s + (d.media ?? 0), 0), [dividas]);

  const totalGeral = totalFixo + totalDividaMedia;

  // ─── Dados filtrados para tabela ────────────────────────────────────────────
  const custosFiltered = useMemo(() => {
    return custosFixos.filter(c => {
      const matchGrupo = grupoFiltro === "Todos" || c.grupoCategoria === grupoFiltro;
      const matchBusca = !busca || 
        c.categoria.toLowerCase().includes(busca.toLowerCase()) ||
        c.fornecedor.toLowerCase().includes(busca.toLowerCase()) ||
        c.plano.toLowerCase().includes(busca.toLowerCase());
      return matchGrupo && matchBusca;
    });
  }, [custosFixos, grupoFiltro, busca]);

  // ─── Dados para gráfico de barras por categoria (top 10) ───────────────────
  const topCategorias = useMemo(() =>
    porCategoria.slice(0, 12).map(c => ({
      name: c.categoria.length > 22 ? c.categoria.slice(0, 20) + "…" : c.categoria,
      fullName: c.categoria,
      valor: c.valor,
      fill: GRUPO_CORES[c.grupo] ?? "#6b7280",
    })),
    [porCategoria]
  );

  // ─── Dados para gráfico de dívidas por mês ─────────────────────────────────
  const dividasPorMes = useMemo(() =>
    MESES_ABREV.map((mes, i) => {
      const key = MESES_KEYS[i];
      const total = dividas.reduce((s, d) => s + (d[key] ?? 0), 0);
      return { mes, total };
    }),
    [dividas]
  );

  const grupos = ["Todos", ...Object.keys(GRUPO_CORES)];

  if (loadingFixos || loadingDividas) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-muted-foreground animate-pulse">Carregando dados financeiros…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── KPIs Principais ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          titulo="Total Custos Fixos"
          valor={fmtBRL(totalFixo)}
          sub={`${custosFixos.length} itens cadastrados`}
          cor="#ef4444"
          icon={<TrendingDown size={20} />}
          destaque
        />
        <KpiCard
          titulo="Dívidas / Parcelamentos"
          valor={fmtBRL(totalDividaMedia)}
          sub="Média mensal 2026"
          cor="#f59e0b"
          icon={<CreditCard size={20} />}
        />
        <KpiCard
          titulo="Comprometimento Total"
          valor={fmtBRL(totalGeral)}
          sub="Fixos + dívidas/mês"
          cor="#8b5cf6"
          icon={<DollarSign size={20} />}
          destaque
        />
        <KpiCard
          titulo="Maior Grupo"
          valor={porGrupo[0]?.grupo ?? "—"}
          sub={porGrupo[0] ? `${fmtBRL(porGrupo[0].valor)} (${fmtPct(porGrupo[0].pct)})` : ""}
          cor="#3b82f6"
          icon={<Users size={20} />}
        />
      </div>

      {/* ─── Gráficos: Pizza + Barras ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pizza por grupo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-600" />
              Distribuição por Grupo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={porGrupo.map(g => ({ ...g, name: g.grupo }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="valor"
                >
                  {porGrupo.map((entry) => (
                    <Cell key={entry.grupo} fill={GRUPO_CORES[entry.grupo] ?? "#6b7280"} />
                  ))}
                </Pie>
                <RTooltip content={<CustomPieTooltip />} />
                <Legend
                  formatter={(value) => <span className="text-xs">{value}</span>}
                  iconSize={10}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Barras por categoria (top 12) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown size={16} className="text-red-500" />
              Top Categorias de Custo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topCategorias} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                <RTooltip content={<CustomBarTooltip />} />
                <Bar dataKey="valor" name="Valor" radius={[0, 4, 4, 0]}>
                  {topCategorias.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ─── Cards por grupo com detalhes ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown size={16} className="text-red-500" />
              Detalhamento de Custos Fixos
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar…"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="pl-8 h-8 w-48 text-sm"
                />
              </div>
              <select
                value={grupoFiltro}
                onChange={e => setGrupoFiltro(e.target.value)}
                className="h-8 text-sm border rounded px-2 bg-white"
              >
                {grupos.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white" onClick={abrirNovo}>
                <Plus size={14} /> Nova Despesa
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Resumo por grupo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 pb-4">
            {porGrupo.map(g => (
              <button
                key={g.grupo}
                onClick={() => setGrupoFiltro(grupoFiltro === g.grupo ? "Todos" : g.grupo)}
                className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
                  grupoFiltro === g.grupo ? "ring-2 shadow-sm" : ""
                }`}
                style={{
                  borderColor: GRUPO_CORES[g.grupo] + "40",
                  backgroundColor: GRUPO_CORES[g.grupo] + "08",
                  outline: grupoFiltro === g.grupo ? `2px solid ${GRUPO_CORES[g.grupo]}` : undefined,
                }}
              >
                <span style={{ color: GRUPO_CORES[g.grupo] }}>{GRUPO_ICONES[g.grupo]}</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{g.grupo}</div>
                  <div className="text-sm font-bold" style={{ color: GRUPO_CORES[g.grupo] }}>
                    {fmtBRL(g.valor)}
                  </div>
                  <div className="text-xs text-muted-foreground">{fmtPct(g.pct)}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Tabela detalhada */}
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Grupo</th>
                  <th className="text-left py-2 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Categoria</th>
                  <th className="text-left py-2 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Fornecedor</th>
                  <th className="text-left py-2 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Tipo</th>
                  <th className="text-right py-2 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Valor/Mês</th>
                  <th className="text-right py-2 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">% do Total</th>
                  <th className="text-center py-2 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Venc.</th>
                  <th className="text-center py-2 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {custosFiltered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum item encontrado
                    </td>
                  </tr>
                )}
                {custosFiltered.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-3">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: (GRUPO_CORES[c.grupoCategoria] ?? "#6b7280") + "18",
                          color: GRUPO_CORES[c.grupoCategoria] ?? "#6b7280",
                        }}
                      >
                        {GRUPO_ICONES[c.grupoCategoria]}
                        {c.grupoCategoria}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-medium">{c.categoria}</td>
                    <td className="py-2 px-3 text-muted-foreground">{c.fornecedor}</td>
                    <td className="py-2 px-3">
                      <Badge variant={c.tipo === "Fixa" ? "default" : "secondary"} className="text-xs">
                        {c.tipo}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right font-semibold">
                      {c.valor > 0 ? fmtBRL(c.valor) : <span className="text-muted-foreground text-xs">Reserva anual</span>}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {c.valor > 0 && totalFixo > 0 ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, c.valor / totalFixo * 100)}%`,
                                backgroundColor: GRUPO_CORES[c.grupoCategoria] ?? "#6b7280",
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {fmtPct(c.valor / totalFixo * 100)}
                          </span>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="py-2 px-3 text-center text-muted-foreground text-xs">
                      {c.vencimento ? `Dia ${c.vencimento}` : "—"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => abrirEditar(c)}
                          className="p-1 rounded hover:bg-blue-50 text-blue-600 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.categoria)}
                          className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors"
                          title="Remover"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {custosFiltered.length > 0 && (
                <tfoot className="bg-muted/50 border-t-2">
                  <tr>
                    <td colSpan={4} className="py-2 px-3 font-bold text-sm">
                      Total ({custosFiltered.length} itens)
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-red-600">
                      {fmtBRL(custosFiltered.reduce((s, c) => s + c.valor, 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Dívidas e Parcelamentos ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard size={16} className="text-amber-500" />
              Dívidas e Parcelamentos 2026
            </CardTitle>
            <div className="flex items-center gap-1 flex-wrap">
              {MESES_ABREV.map((m, i) => (
                <button
                  key={m}
                  onClick={() => setMesDivida(i + 1)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    mesDivida === i + 1
                      ? "bg-amber-500 text-white font-semibold"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Gráfico de linha de dívidas por mês */}
          <div className="mb-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dividasPorMes} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={55} />
                <RTooltip formatter={(v: number) => [fmtBRL(v), "Total do mês"]} />
                <Bar dataKey="total" name="Total" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                  {dividasPorMes.map((_, i) => (
                    <Cell key={i} fill={i + 1 === mesDivida ? "#d97706" : "#f59e0b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela de dívidas */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Credor</th>
                  <th className="text-left py-2 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Categoria</th>
                  {MESES_ABREV.map(m => (
                    <th key={m} className={`text-right py-2 px-2 font-medium text-xs uppercase tracking-wide ${
                      MESES_ABREV[mesDivida - 1] === m ? "text-amber-600 bg-amber-50" : "text-muted-foreground"
                    }`}>{m}</th>
                  ))}
                  <th className="text-right py-2 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground bg-muted">Média</th>
                  <th className="text-left py-2 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {dividas.map((d) => {
                  return (
                    <tr key={d.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-medium">{d.fornecedor}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-xs">{d.categoria}</Badge>
                      </td>
                      {MESES_KEYS.map((key, i) => (
                        <td key={key} className={`py-2 px-2 text-right text-xs ${
                          i + 1 === mesDivida ? "bg-amber-50 font-semibold text-amber-700" : ""
                        }`}>
                          {d[key] != null ? fmtBRL(d[key]) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-semibold bg-muted/30">
                        {fmtBRL(d.media)}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground max-w-[160px] truncate">
                        {d.observacao || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/50 border-t-2">
                <tr>
                  <td colSpan={2} className="py-2 px-3 font-bold text-sm">Total</td>
                  {MESES_KEYS.map((key, i) => {
                    const tot = dividas.reduce((s, d) => s + (d[key] ?? 0), 0);
                    return (
                      <td key={key} className={`py-2 px-2 text-right text-xs font-bold ${
                        i + 1 === mesDivida ? "bg-amber-100 text-amber-700" : ""
                      }`}>
                        {tot > 0 ? fmtBRL(tot) : "—"}
                      </td>
                    );
                  })}
                  <td className="py-2 px-3 text-right font-bold text-amber-600 bg-muted/30">
                    {fmtBRL(totalDividaMedia)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Resumo Consolidado ──────────────────────────────────────────────── */}
      <Card className="border-2 border-purple-200 bg-purple-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle size={16} className="text-purple-600" />
            Resumo Consolidado — Comprometimento Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Barras de composição */}
            <div className="md:col-span-2 space-y-3">
              {porGrupo.map(g => (
                <div key={g.grupo} className="flex items-center gap-3">
                  <div className="w-32 text-xs font-medium truncate flex items-center gap-1.5">
                    <span style={{ color: GRUPO_CORES[g.grupo] }}>{GRUPO_ICONES[g.grupo]}</span>
                    {g.grupo}
                  </div>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                      style={{
                        width: `${Math.max(2, g.pct)}%`,
                        backgroundColor: GRUPO_CORES[g.grupo] ?? "#6b7280",
                      }}
                    >
                      {g.pct > 8 && (
                        <span className="text-white text-xs font-semibold">{fmtPct(g.pct)}</span>
                      )}
                    </div>
                  </div>
                  <div className="w-28 text-right text-xs font-semibold">{fmtBRL(g.valor)}</div>
                </div>
              ))}
              {/* Dívidas */}
              <div className="flex items-center gap-3">
                <div className="w-32 text-xs font-medium flex items-center gap-1.5">
                  <CreditCard size={14} className="text-amber-500" />
                  Dívidas/Parcelas
                </div>
                <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{
                      width: `${Math.max(2, totalGeral > 0 ? totalDividaMedia / totalGeral * 100 : 0)}%`,
                      backgroundColor: "#f59e0b",
                    }}
                  >
                    {totalGeral > 0 && totalDividaMedia / totalGeral * 100 > 8 && (
                      <span className="text-white text-xs font-semibold">
                        {fmtPct(totalDividaMedia / totalGeral * 100)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-28 text-right text-xs font-semibold">{fmtBRL(totalDividaMedia)}</div>
              </div>
            </div>

            {/* Totais */}
            <div className="space-y-3 border-l pl-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Custos Fixos</span>
                <span className="font-bold text-red-600">{fmtBRL(totalFixo)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Dívidas/Parcelas</span>
                <span className="font-bold text-amber-600">{fmtBRL(totalDividaMedia)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="text-sm font-semibold">Total Comprometido</span>
                <span className="font-bold text-purple-700 text-lg">{fmtBRL(totalGeral)}</span>
              </div>
              <div className="bg-white rounded-lg p-3 border text-xs text-muted-foreground">
                <Info size={12} className="inline mr-1" />
                Para cobrir esses custos, o faturamento mínimo necessário é de{" "}
                <strong className="text-foreground">{fmtBRL(totalGeral)}</strong>/mês.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Modal Adicionar / Editar Despesa ───────────────────────────────────────────────── */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {form.id ? <Pencil size={16} className="text-blue-600" /> : <Plus size={16} className="text-red-600" />}
              {form.id ? "Editar Despesa Fixa" : "Nova Despesa Fixa"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            {/* Grupo */}
            <div className="space-y-1.5">
              <Label htmlFor="cf-grupo">Grupo <span className="text-red-500">*</span></Label>
              <select
                id="cf-grupo"
                value={form.grupoCategoria}
                onChange={e => setForm(f => ({ ...f, grupoCategoria: e.target.value }))}
                className="w-full h-9 text-sm border rounded px-2 bg-white"
              >
                {GRUPOS_OPCOES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <Label htmlFor="cf-tipo">Tipo <span className="text-red-500">*</span></Label>
              <select
                id="cf-tipo"
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full h-9 text-sm border rounded px-2 bg-white"
              >
                {TIPOS_OPCOES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Categoria */}
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="cf-categoria">Categoria / Descrição <span className="text-red-500">*</span></Label>
              <Input
                id="cf-categoria"
                placeholder="Ex: Aluguel, Salários, Energia Elétrica..."
                value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              />
            </div>

            {/* Fornecedor */}
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="cf-fornecedor">Fornecedor / Beneficiário</Label>
              <Input
                id="cf-fornecedor"
                placeholder="Ex: LETREIROS EXPRESS LTDA, COPEL..."
                value={form.fornecedor}
                onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))}
              />
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <Label htmlFor="cf-valor">Valor Mensal (R$) <span className="text-red-500">*</span></Label>
              <Input
                id="cf-valor"
                placeholder="Ex: 5.000,00"
                value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
              />
            </div>

            {/* Vencimento */}
            <div className="space-y-1.5">
              <Label htmlFor="cf-venc">Dia do Vencimento</Label>
              <Input
                id="cf-venc"
                type="number"
                min={1}
                max={31}
                placeholder="Ex: 5, 10, 15..."
                value={form.vencimento}
                onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))}
              />
            </div>

            {/* Observação */}
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="cf-obs">Observação</Label>
              <Input
                id="cf-obs"
                placeholder="Informações adicionais..."
                value={form.observacao}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={upsertMut.isPending}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {upsertMut.isPending ? "Salvando..." : form.id ? "Salvar Alterações" : "Adicionar Despesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
