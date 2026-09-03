import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Treemap, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import { MapPin, Building2, Receipt, Trophy, AlertTriangle, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import ChartTooltip from "@/components/ChartTooltip";
import { chartColor, CHART_COLORS } from "@/lib/chartColors";
import { fmtBrl, fmtBrlCompact, fmtNum, fmtPct, MESES } from "@/lib/format";

const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

const NOMES_ESTADOS: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
  PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

const REGIOES: Record<string, string> = {
  AC: "Norte", AM: "Norte", AP: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MS: "Centro-Oeste", MT: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

const STALE = { staleTime: 5 * 60 * 1000 };

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-2 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-slate-500">{label}</p>
          <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          {sub && <p className="text-xs mt-1 text-slate-400">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-lg" style={{ background: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function TreemapCell(props: any) {
  const { x, y, width, height, name, value, index } = props;
  if (width < 2 || height < 2) return null;
  const showLabel = width > 55 && height > 30;
  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height}
        style={{ fill: chartColor(index), stroke: "#fff", strokeWidth: 2 }}
      />
      {showLabel && (
        <>
          <text x={x + 6} y={y + 18} fontSize={13} fontWeight={700} fill="#fff">
            {name}
          </text>
          <text x={x + 6} y={y + 34} fontSize={11} fill="#ffffffcc">
            {fmtBrlCompact(value)}
          </text>
        </>
      )}
    </g>
  );
}

export default function AnaliseGeografica() {
  const [ano, setAno] = useState(ANO_ATUAL);
  const [mes, setMes] = useState<number>(0); // 0 = ano inteiro
  const [exportando, setExportando] = useState<string | null>(null); // null = nenhum; "*" = todos; "SP" etc = um Estado

  const utils = trpc.useUtils();

  const { data: anosDisponiveis } = trpc.analiseGeografica.getAnosDisponiveis.useQuery(undefined, STALE);
  const { data: porEstado, isLoading } = trpc.analiseGeografica.getPorEstado.useQuery(
    { ano, mes: mes || null },
    STALE,
  );
  const { data: evolucao } = trpc.analiseGeografica.getEvolucaoMensal.useQuery({ ano }, STALE);

  const anos = anosDisponiveis?.length ? anosDisponiveis : [ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2];

  const estados = porEstado?.estados ?? [];
  const totalOs = porEstado?.totalOs ?? 0;
  const totalFaturamento = porEstado?.totalFaturamento ?? 0;
  const semEstado = porEstado?.semEstado ?? 0;
  const estadoLider = estados[0];
  const mesesFallback = porEstado?.mesesFallback ?? [];

  const porRegiao = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of estados) {
      const reg = REGIOES[e.estado] ?? "Não identificado";
      map.set(reg, (map.get(reg) ?? 0) + e.faturamento);
    }
    return Array.from(map.entries())
      .map(([regiao, faturamento]) => ({ regiao, faturamento, pct: totalFaturamento > 0 ? (faturamento / totalFaturamento) * 100 : 0 }))
      .sort((a, b) => b.faturamento - a.faturamento);
  }, [estados, totalFaturamento]);

  const barData = estados.slice(0, 12).map((e) => ({
    estado: e.estado,
    nome: NOMES_ESTADOS[e.estado] ?? e.estado,
    pctFaturamento: e.pctFaturamento,
    pctOs: e.pctOs,
  }));

  const treemapData = estados.map((e) => ({
    name: e.estado,
    value: e.faturamento,
  }));

  const evolucaoData = (evolucao?.meses ?? []).map((m) => ({
    ...m,
    nomeMes: MESES[m.mes - 1]?.slice(0, 3) ?? String(m.mes),
  }));
  const topEstadosEvolucao = evolucao?.topEstados ?? [];

  const exportarClientesExcel = async (estado?: string) => {
    setExportando(estado ?? "*");
    try {
      const clientes = await utils.analiseGeografica.getListaClientes.fetch({
        ano,
        mes: mes || null,
        estado: estado ?? null,
      });
      if (!clientes || clientes.length === 0) {
        toast.error(estado ? `Nenhum cliente encontrado para ${estado}.` : "Nenhum cliente encontrado para exportar.");
        return;
      }
      const wsData = [
        ["Estado", "Nome do Estado", "Região", "Cidade", "Cliente", "Qtd. OS", "Faturamento Total"],
        ...clientes.map((c) => [
          c.estado,
          NOMES_ESTADOS[c.estado] ?? c.estado,
          REGIOES[c.estado] ?? "—",
          c.cidade,
          c.empresa,
          c.qtdOs,
          c.faturamento,
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [
        { wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 40 }, { wch: 10 }, { wch: 16 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, estado ? `Clientes ${estado}` : "Clientes por Estado");
      const periodo = mes ? `${ano}-${String(mes).padStart(2, "0")}` : String(ano);
      const arquivo = estado ? `clientes-${estado}-${periodo}.xlsx` : `clientes-por-estado-${periodo}.xlsx`;
      XLSX.writeFile(wb, arquivo);
      toast.success(`${clientes.length} clientes exportados com sucesso!`);
    } catch {
      toast.error("Erro ao exportar clientes.");
    } finally {
      setExportando(null);
    }
  };

  return (
      <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-blue-600" />
              Análise Geográfica
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Distribuição de OS e faturamento por Estado — dados em tempo real da API Mubisys
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportarClientesExcel()}
              disabled={exportando !== null}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} /> {exportando === "*" ? "Exportando…" : "Exportar clientes do período (Excel)"}
            </button>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Ano inteiro</SelectItem>
                {MESES.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-24 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anos.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading && (
          <div className="text-sm text-slate-400 py-10 text-center">Carregando dados geográficos…</div>
        )}

        {!isLoading && estados.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nenhuma OS encontrada com Estado identificado para este período.</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}

        {!isLoading && estados.length > 0 && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Faturamento no período"
                value={fmtBrlCompact(totalFaturamento)}
                sub={fmtBrl(totalFaturamento)}
                icon={Receipt}
                color="#3b82f6"
              />
              <KpiCard
                label="OS consideradas"
                value={fmtNum(totalOs)}
                sub={mes ? MESES[mes - 1] : `Ano ${ano} inteiro`}
                icon={Building2}
                color="#8b5cf6"
              />
              <KpiCard
                label="Estados atendidos"
                value={String(estados.length)}
                sub={`${estados.reduce((s, e) => s + e.qtdClientes, 0)} clientes`}
                icon={MapPin}
                color="#22c55e"
              />
              <KpiCard
                label="Estado líder"
                value={estadoLider ? estadoLider.estado : "—"}
                sub={estadoLider ? `${fmtPct(estadoLider.pctFaturamento)} do faturamento` : undefined}
                icon={Trophy}
                color="#f59e0b"
              />
            </div>

            {semEstado > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {fmtNum(semEstado)} OS sem Estado identificado (cliente não encontrado no cadastro) — não entram nos percentuais.
              </div>
            )}

            {mesesFallback.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                A API Mubisys não respondeu a tempo para {mesesFallback.length === 1 ? "o mês" : "os meses"}{" "}
                {mesesFallback.map((m) => MESES[m - 1]).join(", ")} — usando snapshot local, que pode estar
                desatualizado ou incompleto para esse período.
              </div>
            )}

            {/* Barras: % faturamento x % pedidos por estado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">% de Faturamento e % de Pedidos por Estado (top 12)</h3>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} fontSize={12} />
                    <YAxis type="category" dataKey="estado" width={40} fontSize={12} />
                    <Tooltip content={<ChartTooltip format={(v) => `${v.toFixed(1)}%`} />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="pctFaturamento" name="% Faturamento" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="pctOs" name="% Pedidos" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Faturamento por Estado (área proporcional)</h3>
                <ResponsiveContainer width="100%" height={360}>
                  <Treemap
                    data={treemapData}
                    dataKey="value"
                    stroke="#fff"
                    content={<TreemapCell />}
                    isAnimationActive={false}
                  />
                </ResponsiveContainer>
              </div>
            </div>

            {/* Donut por região + evolução mensal */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Faturamento por Região</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={porRegiao}
                      dataKey="faturamento"
                      nameKey="regiao"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      label={({ regiao, pct }) => `${regiao} (${pct.toFixed(0)}%)`}
                      labelLine={false}
                      fontSize={11}
                    >
                      {porRegiao.map((_, i) => (
                        <Cell key={i} fill={chartColor(i)} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip format={fmtBrl} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Evolução Mensal — Top Estados ({ano})</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={evolucaoData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="nomeMes" fontSize={12} />
                    <YAxis tickFormatter={(v) => fmtBrlCompact(v)} fontSize={11} width={60} />
                    <Tooltip content={<ChartTooltip format={fmtBrl} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {topEstadosEvolucao.map((uf, i) => (
                      <Area
                        key={uf}
                        type="monotone"
                        dataKey={uf}
                        stackId="1"
                        stroke={chartColor(i)}
                        fill={chartColor(i)}
                        fillOpacity={0.7}
                        name={uf}
                      />
                    ))}
                    <Area
                      type="monotone"
                      dataKey="outros"
                      stackId="1"
                      stroke="#94a3b8"
                      fill="#94a3b8"
                      fillOpacity={0.4}
                      name="Outros"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabela detalhada */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 overflow-x-auto">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Detalhamento por Estado</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead className="text-right">Qtd. OS</TableHead>
                    <TableHead className="text-right">% Pedidos</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">% Faturamento</TableHead>
                    <TableHead className="text-right">Nº Clientes</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                    <TableHead>Principais Cidades</TableHead>
                    <TableHead className="text-center">Exportar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estados.map((e) => (
                    <TableRow key={e.estado}>
                      <TableCell className="font-semibold">{NOMES_ESTADOS[e.estado] ?? e.estado} <span className="text-slate-400 font-normal">({e.estado})</span></TableCell>
                      <TableCell className="text-slate-500">{REGIOES[e.estado] ?? "—"}</TableCell>
                      <TableCell className="text-right">{fmtNum(e.qtdOs)}</TableCell>
                      <TableCell className="text-right">{fmtPct(e.pctOs)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtBrl(e.faturamento)}</TableCell>
                      <TableCell className="text-right font-semibold text-blue-600">{fmtPct(e.pctFaturamento)}</TableCell>
                      <TableCell className="text-right">{fmtNum(e.qtdClientes)}</TableCell>
                      <TableCell className="text-right">{fmtBrl(e.ticketMedio)}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {e.topCidades.map((c) => c.cidade).join(", ")}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => exportarClientesExcel(e.estado)}
                          disabled={exportando !== null}
                          title={`Baixar clientes de ${e.estado} em Excel`}
                          className="inline-flex items-center justify-center p-1.5 rounded-md text-green-700 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download size={15} />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
  );
}
