import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, CheckCircle2, Info } from "lucide-react";

// Valores de referência do Excel de Maio 2026
const EXCEL_REFERENCIA = {
  cotacoes: 555,
  osNormais: 103,
  faturamento: 251278.09,
  valorOrcado: 2309145.82,
  taxaConversao: 18.6,
};

export default function DiagnosticoApi() {
  const [mes, setMes] = useState(5);
  const [ano, setAno] = useState(2026);
  const [enabled, setEnabled] = useState(false);

  const { data, isLoading, error, refetch } = trpc.performanceComercial.diagnosticoApi.useQuery(
    { mes, ano },
    { enabled, refetchOnWindowFocus: false, staleTime: 0 }
  );

  function fmt(v: number) {
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  }

  function diff(erp: number, excel: number) {
    const d = erp - excel;
    const pct = excel !== 0 ? ((d / excel) * 100).toFixed(1) : "N/A";
    return { d, pct, ok: Math.abs(d / (excel || 1)) < 0.02 };
  }

  const rows = data ? [
    {
      indicador: "Cotações (Orçamentos)",
      erp: data.orcamentos.total,
      excel: EXCEL_REFERENCIA.cotacoes,
      fmt: (v: number) => String(v),
    },
    {
      indicador: "OS Normais (todas)",
      erp: data.os.totalBruto,
      excel: EXCEL_REFERENCIA.osNormais,
      fmt: (v: number) => String(v),
    },
    {
      indicador: "OS Normais (excl. canceladas)",
      erp: data.os.totalNormais,
      excel: EXCEL_REFERENCIA.osNormais,
      fmt: (v: number) => String(v),
    },
    {
      indicador: "Valor Orçado Total",
      erp: data.orcamentos.valorTotal,
      excel: EXCEL_REFERENCIA.valorOrcado,
      fmt: (v: number) => `R$ ${fmt(v)}`,
    },
    {
      indicador: "Faturamento (valor OS normais)",
      erp: data.os.faturamento,
      excel: EXCEL_REFERENCIA.faturamento,
      fmt: (v: number) => `R$ ${fmt(v)}`,
    },
    {
      indicador: "Taxa de Conversão",
      erp: data.taxaConversao,
      excel: EXCEL_REFERENCIA.taxaConversao,
      fmt: (v: number) => `${v.toFixed(1)}%`,
    },
  ] : [];

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Diagnóstico de Dados — API MubiSys</h1>
          <p className="text-sm text-slate-500 mt-0.5">Extrai dados brutos do ERP e contrasta com os valores do Excel de referência</p>
        </div>
      </div>

      {/* Controles */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">Mês</label>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700"
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
            >
              {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m, i) => (
                <option key={i+1} value={i+1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">Ano</label>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700"
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
            >
              {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <Button
            onClick={() => { setEnabled(true); setTimeout(() => refetch(), 100); }}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Buscando da API...</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" /> Buscar Dados Brutos da API</>
            )}
          </Button>
        </div>
        {isLoading && (
          <p className="text-xs text-slate-400 mt-3">
            ⏳ Buscando todos os orçamentos e OS do período diretamente da API MubiSys. Pode levar 15–40 segundos...
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Erro ao buscar dados</p>
            <p className="text-xs text-red-500 mt-1">{String(error)}</p>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Tabela de auditoria */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-700">Tabela de Auditoria — ERP vs Excel</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Período: {data.periodo.datainicial} a {data.periodo.datafinal} · Excel de referência: Resultado_35377822_05_2026(3).xls
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                  <th className="text-left px-5 py-3">Indicador</th>
                  <th className="text-right px-5 py-3">Valor ERP (API)</th>
                  <th className="text-right px-5 py-3">Valor Excel</th>
                  <th className="text-right px-5 py-3">Diferença</th>
                  <th className="text-center px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const { d, pct, ok } = diff(row.erp, row.excel);
                  return (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-700">{row.indicador}</td>
                      <td className="px-5 py-3 text-right font-mono text-slate-800">{row.fmt(row.erp)}</td>
                      <td className="px-5 py-3 text-right font-mono text-slate-500">{row.fmt(row.excel)}</td>
                      <td className={`px-5 py-3 text-right font-mono text-xs ${ok ? 'text-green-600' : 'text-red-600'}`}>
                        {d >= 0 ? '+' : ''}{row.fmt(d)} ({pct}%)
                      </td>
                      <td className="px-5 py-3 text-center">
                        {ok ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                            ✅ VALIDADO
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                            ⚠️ DIVERGÊNCIA
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Detalhes técnicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* OS por status */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-3">OS por Status (API bruta)</h3>
              <div className="space-y-1.5">
                {Object.entries(data.os.porStatus).sort((a,b) => b[1]-a[1]).map(([status, count]) => (
                  <div key={status} className="flex justify-between text-sm">
                    <span className="text-slate-600">{status}</span>
                    <span className="font-mono font-semibold text-slate-800">{count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-sm font-semibold">
                <span>Total bruto</span>
                <span>{data.os.totalBruto}</span>
              </div>
            </div>

            {/* OS por tipo */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-3">OS por Tipo (API bruta)</h3>
              <div className="space-y-1.5">
                {Object.entries(data.os.porTipo).sort((a,b) => b[1]-a[1]).map(([tipo, count]) => (
                  <div key={tipo} className="flex justify-between text-sm">
                    <span className="text-slate-600">{tipo}</span>
                    <span className="font-mono font-semibold text-slate-800">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* OS por vendedor */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-3">OS por Vendedor (normais)</h3>
              <div className="space-y-1.5">
                {Object.entries(data.os.porVendedor).sort((a,b) => b[1]-a[1]).map(([v, count]) => (
                  <div key={v} className="flex justify-between text-sm">
                    <span className="text-slate-600 truncate max-w-[200px]">{v}</span>
                    <span className="font-mono font-semibold text-slate-800">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Campos disponíveis */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Campos da API</h3>
              <div className="mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">OS</p>
                <p className="text-xs text-slate-500 font-mono break-all">{data.os.campos.join(', ')}</p>
                <p className="text-xs text-blue-600 mt-1">Campo valor usado: <strong>{data.os.campoValor ?? 'não encontrado'}</strong></p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Orçamentos</p>
                <p className="text-xs text-slate-500 font-mono break-all">{data.orcamentos.campos.join(', ')}</p>
                <p className="text-xs text-blue-600 mt-1">Campo valor usado: <strong>{data.orcamentos.campoValor ?? 'não encontrado'}</strong></p>
              </div>
            </div>
          </div>

          {/* Exemplos brutos */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-600">Exemplo de registro bruto da API (OS[0])</h3>
            </div>
            <pre className="text-xs text-slate-600 overflow-auto max-h-48 bg-white rounded-lg p-3 border border-slate-200">
              {JSON.stringify(data.os.exemplos[0], null, 2)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
