import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter,
} from "@/components/ui/table";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Filter, Building2, Receipt, Crown, Wallet,
} from "lucide-react";
import KpiCard from "@/components/KpiCard";
import { chartColor } from "@/lib/chartColors";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  anoSel: number;
}

export default function DetalhamentoMarketing({ anoSel }: Props) {
  const [mesFiltro, setMesFiltro] = useState<number | null>(null);

  const { data: itens = [] } = trpc.financeiro.getCustoMarketingItensAno.useQuery({ ano: anoSel });

  const mesesComDados = useMemo(() => {
    const set = new Set(itens.map(i => i.mes));
    return Array.from(set).sort((a, b) => a - b);
  }, [itens]);

  const itensFiltrados = useMemo(
    () => mesFiltro != null ? itens.filter(i => i.mes === mesFiltro) : itens,
    [itens, mesFiltro]
  );

  const total = itensFiltrados.reduce((s, i) => s + i.valor, 0);
  const totalAquisicao = itensFiltrados.filter(i => i.categoria === "aquisicao").reduce((s, i) => s + i.valor, 0);
  const totalReativacao = itensFiltrados.filter(i => i.categoria === "reativacao").reduce((s, i) => s + i.valor, 0);

  const porFornecedor = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of itensFiltrados) m.set(i.fornecedor, (m.get(i.fornecedor) ?? 0) + i.valor);
    return Array.from(m.entries())
      .map(([fornecedor, valor]) => ({ fornecedor, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [itensFiltrados]);

  const porDespesa = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of itensFiltrados) {
      const chave = i.despesa || "Outros";
      m.set(chave, (m.get(chave) ?? 0) + i.valor);
    }
    return Array.from(m.entries())
      .map(([despesa, valor]) => ({ despesa, valor, pct: total > 0 ? (valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
  }, [itensFiltrados, total]);

  const maiorFornecedor = porFornecedor[0];
  const labelFiltro = mesFiltro != null ? MESES[mesFiltro - 1] : `Ano ${anoSel}`;

  function CustomPieTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className="bg-white border rounded-lg shadow-lg p-3 text-sm min-w-[180px]">
        <div className="font-semibold mb-1">{d.name}</div>
        <div className="text-muted-foreground">{fmtBRL(d.value)}</div>
        <div className="text-xs text-muted-foreground">{d.payload.pct.toFixed(1)}%</div>
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Nenhum lançamento detalhado importado ainda para {anoSel}. Use "Importar planilha" na aba Marketing para trazer o relatório de contas a pagar mês a mês.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Filtro de mês ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter size={13} />
          Filtrar por mês:
        </div>
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
        {mesesComDados.map(m => (
          <button
            key={m}
            onClick={() => setMesFiltro(mesFiltro === m ? null : m)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              mesFiltro === m
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
            }`}
          >
            {MESES[m - 1].slice(0, 3)}
          </button>
        ))}
      </div>

      {/* ─── KPIs ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <div className="w-3 h-0.5 bg-purple-500 rounded" />
          Detalhamento — {labelFiltro}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Total Lançado"
            value={fmtBRL(total)}
            sub={`${itensFiltrados.length} lançamento(s)`}
            color="#7c3aed"
            icon={<Wallet size={18} />}
            variant="border"
          />
          <KpiCard
            label="Aquisição x Reativação"
            value={fmtBRL(totalAquisicao)}
            sub={`Reativação: ${fmtBRL(totalReativacao)}`}
            color="#0891b2"
            icon={<Receipt size={18} />}
            variant="border"
          />
          <KpiCard
            label="Fornecedores Distintos"
            value={String(porFornecedor.length)}
            sub="No período filtrado"
            color="#2563eb"
            icon={<Building2 size={18} />}
            variant="border"
          />
          <KpiCard
            label="Maior Fornecedor"
            value={maiorFornecedor ? fmtBRL(maiorFornecedor.valor) : "—"}
            sub={maiorFornecedor?.fornecedor ?? "—"}
            color="#ea580c"
            icon={<Crown size={18} />}
            variant="border"
          />
        </div>
      </div>

      {/* ─── Gráficos ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 size={16} className="text-purple-600" />
              Gasto por Fornecedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(220, porFornecedor.length * 32)}>
              <BarChart data={porFornecedor} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`} />
                <YAxis type="category" dataKey="fornecedor" width={160} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Bar dataKey="valor" fill="#7c3aed" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt size={16} className="text-emerald-600" />
              Gasto por Tipo de Despesa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={porDespesa}
                  dataKey="valor"
                  nameKey="despesa"
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={95}
                  paddingAngle={2}
                >
                  {porDespesa.map((_, i) => <Cell key={i} fill={chartColor(i)} />)}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ─── Tabela detalhada ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt size={18} className="text-purple-600" />
            Lançamentos — {labelFiltro}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs text-muted-foreground bg-slate-50">
                  <TableHead className="font-semibold">Mês</TableHead>
                  <TableHead className="font-semibold">Fornecedor</TableHead>
                  <TableHead className="font-semibold">Tipo</TableHead>
                  <TableHead className="font-semibold">Despesa</TableHead>
                  <TableHead className="font-semibold">Categoria</TableHead>
                  <TableHead className="text-right font-semibold">Vencimento</TableHead>
                  <TableHead className="text-right font-semibold">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensFiltrados
                  .slice()
                  .sort((a, b) => b.valor - a.valor)
                  .map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="text-xs text-muted-foreground">{MESES[i.mes - 1].slice(0, 3)}</TableCell>
                      <TableCell className="font-medium">{i.fornecedor}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.tipo || "—"}</TableCell>
                      <TableCell className="text-xs">{i.despesa || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={i.categoria === "reativacao"
                            ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                            : "bg-purple-50 text-purple-700 border-purple-200"}
                        >
                          {i.categoria === "reativacao" ? "Reativação" : "Aquisição"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {i.dataVencimento ? new Date(i.dataVencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-purple-700">{fmtBRL(i.valor)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
              <TableFooter className="bg-slate-50 border-t-2 border-slate-300">
                <TableRow>
                  <TableCell colSpan={6} className="font-bold text-sm">Total — {labelFiltro}</TableCell>
                  <TableCell className="text-right font-bold text-purple-700">{fmtBRL(total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
