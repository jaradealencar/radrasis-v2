import { trpc } from "@/lib/trpc";
import { AlertTriangle, DollarSign, TrendingDown, TrendingUp, Shield, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line } from "recharts";
import { FilterState } from "@/components/FilterBar";

type KpisData = {
  total: number;
  custoTotal: number;
  custoMedio: number;
  freteTotal: number;
  horasTotal: number;
  evitavel: number;
  inevitavel: number;
  pctEvitavel: number;
  pctInevitavel: number;
} | null | undefined;

export default function CnqPanel({ filter, kpisRetrabalho }: { filter: FilterState; kpisRetrabalho: KpisData }) {
  const { data: kpisCnq } = trpc.dashboard.kpisCnq.useQuery(filter as any);
  const { data: evolucaoCnq } = trpc.dashboard.evolucaoMensalCnq.useQuery();
  const { data: evolucaoRetrab } = trpc.dashboard.evolucaoMensalRetrabalho.useQuery();

  const totalRetrabalho = kpisRetrabalho?.custoTotal ?? 0;
  const totalCnq = kpisCnq?.custoTotal ?? 0;
  const impactoTotal = totalRetrabalho + totalCnq;
  const qtdRetrabalho = kpisRetrabalho?.total ?? 0;
  const qtdCnq = kpisCnq?.total ?? 0;
  const qtdTotal = qtdRetrabalho + qtdCnq;

  // Dados comparativos mensais
  const comparativoMensal = (evolucaoRetrab ?? []).map((retrab, i) => {
    const cnq = (evolucaoCnq ?? [])[i];
    return {
      mes: retrab.mes,
      custoRetrab: retrab.custo,
      custoCnq: cnq?.custo ?? 0,
      qtdRetrab: retrab.count,
      qtdCnq: cnq?.count ?? 0,
      total: retrab.custo + (cnq?.custo ?? 0),
    };
  });

  return (
    <div className="space-y-4">
      {/* Indicador Mestre */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl border border-slate-700 shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-lg bg-amber-500/20">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Impacto Total da Não-Qualidade</h2>
            <p className="text-xs text-slate-400">Retrabalhos + Custos da Não-Qualidade (CNQ)</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Geral */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Custo Total</p>
            <p className="text-3xl font-bold text-amber-400">
              R$ {impactoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-slate-400 mt-1">{qtdTotal} ocorrências no total</p>
          </div>
          {/* Retrabalho */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Retrabalhos</p>
            <p className="text-2xl font-bold text-red-400">
              R$ {totalRetrabalho.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-slate-400 mt-1">{qtdRetrabalho} ocorrências • Falhas de execução</p>
            {impactoTotal > 0 && (
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-red-500" style={{ width: `${(totalRetrabalho / impactoTotal) * 100}%` }} />
              </div>
            )}
          </div>
          {/* CNQ */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">CNQ</p>
            <p className="text-2xl font-bold text-amber-300">
              R$ {totalCnq.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-slate-400 mt-1">{qtdCnq} ocorrências • Falhas de processo</p>
            {impactoTotal > 0 && (
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${(totalCnq / impactoTotal) * 100}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPIs CNQ detalhados */}
      {(kpisCnq?.total ?? 0) > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-amber-50"><AlertTriangle className="w-4 h-4 text-amber-600" /></div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Total CNQ</p>
            </div>
            <p className="text-xl font-bold text-amber-700">{kpisCnq?.total ?? 0}</p>
            <p className="text-xs text-slate-400 mt-0.5">ocorrências</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-amber-50"><DollarSign className="w-4 h-4 text-amber-600" /></div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Custo CNQ</p>
            </div>
            <p className="text-xl font-bold text-amber-700">R$ {(kpisCnq?.custoTotal ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
            <p className="text-xs text-slate-400 mt-0.5">prejuízo acumulado</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-amber-50"><BarChart3 className="w-4 h-4 text-amber-600" /></div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Custo Médio</p>
            </div>
            <p className="text-xl font-bold text-amber-700">R$ {(kpisCnq?.custoMedio ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
            <p className="text-xs text-slate-400 mt-0.5">por ocorrência</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-amber-50">
                {(kpisCnq?.pctEvitavel ?? 0) > 50 ? <TrendingDown className="w-4 h-4 text-red-600" /> : <TrendingUp className="w-4 h-4 text-green-600" />}
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">% Evitável</p>
            </div>
            <p className="text-xl font-bold text-amber-700">{kpisCnq?.pctEvitavel ?? 0}%</p>
            <p className="text-xs text-slate-400 mt-0.5">{kpisCnq?.evitavel ?? 0} evitáveis</p>
          </div>
        </div>
      )}

      {/* Gráfico Comparativo Mensal */}
      {comparativoMensal.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Comparativo Mensal — Retrabalho vs CNQ</p>
              <p className="text-xs text-slate-400 mt-0.5">Evolução lado a lado dos custos por mês</p>
            </div>
            <div className="flex gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-red-400" />
                <span className="text-slate-600">Retrabalho</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-amber-400" />
                <span className="text-slate-600">CNQ</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={comparativoMensal} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg p-3 text-xs bg-white border border-slate-200 shadow-lg min-w-[180px]">
                    <p className="font-bold mb-2 text-slate-700">{label}</p>
                    {payload.map((p: any, i: number) => (
                      <div key={i} className="flex justify-between gap-4 mb-0.5">
                        <span style={{ color: p.color }}>{p.name}</span>
                        <span className="font-semibold" style={{ color: p.color }}>
                          R$ {Number(p.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-slate-200 mt-1 pt-1 flex justify-between">
                      <span className="font-bold text-slate-700">Total</span>
                      <span className="font-bold text-slate-700">
                        R$ {((payload[0]?.value as number ?? 0) + (payload[1]?.value as number ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              }} />
              <Bar dataKey="custoRetrab" name="Retrabalho" fill="#f87171" radius={[3, 3, 0, 0]} stackId="a" />
              <Bar dataKey="custoCnq" name="CNQ" fill="#fbbf24" radius={[3, 3, 0, 0]} stackId="a" />
              <Line type="monotone" dataKey="total" name="Total" stroke="#1e293b" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
