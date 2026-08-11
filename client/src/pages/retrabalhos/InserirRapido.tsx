import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Plus, Trash2, Save, ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
import UserSelect from "@/components/UserSelect";

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

type Row = {
  id: string;
  osRetrabalhada: string;
  osOriginal: string;
  data: string;
  setor: string;
  tipo: "INTERNO" | "EXTERNO";
  mes: string;
  codigoErro: string;
  custo: string;
  frete: string;
  horasImpacto: string;
  responsavel: string;
  classe: "EVITÁVEL" | "INEVITÁVEL";
  descricao: string;
  tipoRegistro: "retrabalho" | "cnq";
  saving?: boolean;
  saved?: boolean;
  error?: string;
};

function newRow(): Row {
  const today = new Date().toISOString().split("T")[0];
  const mesAtual = MESES[new Date().getMonth()];
  return {
    id: Math.random().toString(36).slice(2),
    osRetrabalhada: "",
    osOriginal: "",
    data: today,
    setor: "",
    tipo: "INTERNO",
    mes: mesAtual,
    codigoErro: "",
    custo: "",
    frete: "",
    horasImpacto: "",
    responsavel: "",
    classe: "EVITÁVEL",
    descricao: "",
    tipoRegistro: "retrabalho",
  };
}

const inputCls = "w-full h-8 px-2 text-xs border border-transparent rounded focus:outline-none focus:border-blue-400 focus:bg-white bg-transparent transition-colors";
const selCls = "w-full h-8 px-1 text-xs border border-transparent rounded focus:outline-none focus:border-blue-400 focus:bg-white bg-transparent transition-colors appearance-none cursor-pointer";

export default function InserirRapido() {
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const { data: errorLib } = trpc.errorLibrary.list.useQuery();
  const createMut = trpc.retrabalhos.create.useMutation();
  const utils = trpc.useUtils();

  // Extrair setores únicos da biblioteca de erros (usando o campo 'category')
  const setores = Array.from(new Set((errorLib ?? []).map(e => e.category).filter(Boolean))).sort();
  const errorMap = new Map((errorLib ?? []).map(e => [e.code, e]));
  const allCodes = (errorLib ?? []).map(e => e.code);

  const set = (id: string, field: keyof Row, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value, saved: false, error: undefined } : r));
  };

  const addRow = () => setRows(prev => [...prev, newRow()]);

  const removeRow = (id: string) => {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  };

  const saveRow = async (row: Row) => {
    // Para retrabalhos, OS é obrigatório. Para CNQs, é opcional.
    if (row.tipoRegistro === "retrabalho" && !row.osRetrabalhada) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, error: "OS Retrabalhada é obrigatório para retrabalhos" } : r));
      return;
    }
    if (!row.setor) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, error: "Setor é obrigatório" } : r));
      return;
    }
    if (!row.responsavel) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, error: "Responsável é obrigatório. Se não há funcionário direto, atribua a um Gestor." } : r));
      return;
    }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, saving: true, error: undefined } : r));
    try {
      const custo = parseFloat(row.custo) || 0;
      const frete = parseFloat(row.frete) || 0;
      await createMut.mutateAsync({
        osRetrabalhada: row.osRetrabalhada,
        osOriginal: row.osOriginal || row.osRetrabalhada,
        data: new Date(row.data + "T12:00:00"),
        setor: row.setor,
        tipo: row.tipo,
        mes: row.mes,
        codigoErro: row.codigoErro || undefined,
        custo: String(custo),
        frete: String(frete),
        total: String(custo + frete),
        horasImpacto: row.horasImpacto ? parseFloat(row.horasImpacto) : undefined,
        responsavel: row.responsavel || "",
        classe: row.classe,
        descricao: row.descricao || undefined,
        tipoRegistro: row.tipoRegistro,
      });
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, saving: false, saved: true } : r));
      utils.retrabalhos.list.invalidate();
      utils.dashboard.kpis.invalidate();
      toast.success(`${row.tipoRegistro === "cnq" ? "CNQ" : "OS " + row.osRetrabalhada} registrado com sucesso!`);
    } catch {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, saving: false, error: "Erro ao salvar" } : r));
      toast.error("Erro ao salvar retrabalho");
    }
  };

  const saveAll = async () => {
    // Para retrabalhos, OS é obrigatório. Para CNQs, é opcional.
    const pending = rows.filter(r => !r.saved && r.setor && r.responsavel && (r.tipoRegistro === "cnq" || r.osRetrabalhada));
    if (pending.length === 0) { toast.info("Nenhum registro novo para salvar"); return; }
    for (const row of pending) await saveRow(row);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>, rowId: string, field: keyof Row) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // move to next row or add new row
      const idx = rows.findIndex(r => r.id === rowId);
      if (field === "descricao") {
        if (idx === rows.length - 1) addRow();
        // focus next row first field
        setTimeout(() => {
          const nextRow = document.querySelector(`[data-row="${rows[idx + 1]?.id ?? ""}"] input`) as HTMLElement;
          nextRow?.focus();
        }, 50);
      }
    }
  };

  const totalCusto = rows.reduce((s, r) => s + (parseFloat(r.custo) || 0) + (parseFloat(r.frete) || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">Registro Rápido</p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Inserção de Retrabalhos e CNQ</h1>
            <p className="text-sm text-slate-500 mt-0.5 hidden sm:block">Preencha linha a linha como na planilha. Pressione Enter para avançar.</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400">Total em aberto</p>
              <p className="text-lg font-bold font-mono text-slate-700">
                R$ {totalCusto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <Button onClick={addRow} variant="outline" size="sm" className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nova Linha</span>
              <span className="sm:hidden">+</span>
            </Button>
            <Button onClick={saveAll} size="sm" className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salvar Todos</span>
              <span className="sm:hidden">Salvar</span>
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-24">Classif.</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-28">OS Retrab. *</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-24">OS Original</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-32">Data</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-36">Setor *</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-24">Tipo</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-28">Mês</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-32">Cód. Erro</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-24">Custo (R$)</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-24">Frete (R$)</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-24" title="Horas que o retrabalho impactou na produção">Horas Imp.</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-32">Responsável *</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-28">Classe</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide w-48">Descrição</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-slate-500 uppercase tracking-wide w-20">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const errInfo = row.codigoErro ? errorMap.get(row.codigoErro) : null;
                  const rowBg = row.saved ? "bg-green-50" : row.error ? "bg-red-50" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/50";
                  return (
                    <tr key={row.id} data-row={row.id} className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors group ${rowBg}`}>
                      {/* Tipo Registro */}
                      <td className="px-1.5 py-1">
                        <select
                          className={`${selCls} ${row.tipoRegistro === "cnq" ? "text-amber-700 font-semibold" : "text-blue-700 font-semibold"}`}
                          value={row.tipoRegistro}
                          onChange={e => set(row.id, "tipoRegistro", e.target.value)}
                        >
                          <option value="retrabalho">Retrab.</option>
                          <option value="cnq">CNQ</option>
                        </select>
                      </td>
                      {/* OS Retrabalhada */}
                      <td className="px-1.5 py-1">
                        <input
                          className={`${inputCls} font-mono font-semibold text-slate-800`}
                          value={row.osRetrabalhada}
                          onChange={e => set(row.id, "osRetrabalhada", e.target.value)}
                          placeholder="Ex: 6280"
                          autoFocus={idx === rows.length - 1}
                        />
                      </td>
                      {/* OS Original */}
                      <td className="px-1.5 py-1">
                        <input
                          className={`${inputCls} font-mono text-slate-600`}
                          value={row.osOriginal}
                          onChange={e => set(row.id, "osOriginal", e.target.value)}
                          placeholder="Ex: 6205"
                        />
                      </td>
                      {/* Data */}
                      <td className="px-1.5 py-1">
                        <input
                          type="date"
                          className={`${inputCls}`}
                          value={row.data}
                          onChange={e => set(row.id, "data", e.target.value)}
                        />
                      </td>
                      {/* Setor */}
                      <td className="px-1.5 py-1">
                        <select className={selCls} value={row.setor} onChange={e => set(row.id, "setor", e.target.value)}>
                          <option value="">— Setor —</option>
                          {setores.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      {/* Tipo */}
                      <td className="px-1.5 py-1">
                        <select className={selCls} value={row.tipo} onChange={e => set(row.id, "tipo", e.target.value as "INTERNO" | "EXTERNO")}>
                          <option value="INTERNO">Interno</option>
                          <option value="EXTERNO">Externo</option>
                        </select>
                      </td>
                      {/* Mês */}
                      <td className="px-1.5 py-1">
                        <select className={selCls} value={row.mes} onChange={e => set(row.id, "mes", e.target.value)}>
                          {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </td>
                      {/* Código Erro */}
                      <td className="px-1.5 py-1">
                        <div className="relative group/err">
                          <select
                            className={`${selCls} ${row.codigoErro ? "text-blue-700 font-semibold" : ""}`}
                            value={row.codigoErro}
                            onChange={e => set(row.id, "codigoErro", e.target.value)}
                          >
                            <option value="">— Código —</option>
                            {allCodes.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          {errInfo && (
                            <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/err:block w-64 p-2.5 rounded-lg bg-slate-800 text-white text-xs shadow-xl border border-slate-600">
                              <p className="font-bold text-blue-300 mb-1">{errInfo.code} — {errInfo.category}</p>
                              <p className="text-slate-200 mb-1">{errInfo.description}</p>
                              <p className="text-green-300">✓ {errInfo.correction}</p>
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Custo */}
                      <td className="px-1.5 py-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={`${inputCls} font-mono`}
                          value={row.custo}
                          onChange={e => set(row.id, "custo", e.target.value)}
                          placeholder="0,00"
                        />
                      </td>
                      {/* Frete */}
                      <td className="px-1.5 py-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={`${inputCls} font-mono`}
                          value={row.frete}
                          onChange={e => set(row.id, "frete", e.target.value)}
                          placeholder="0,00"
                        />
                      </td>
                      {/* Horas de Impacto */}
                      <td className="px-1.5 py-1">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          className={`${inputCls} font-mono`}
                          value={row.horasImpacto}
                          onChange={e => set(row.id, "horasImpacto", e.target.value)}
                          placeholder="0h"
                          title="Horas de impacto no negócio"
                        />
                      </td>
                      {/* Responsável */}
                      <td className="px-1.5 py-1">
                        <UserSelect
                          value={row.responsavel}
                          onChange={name => set(row.id, "responsavel", name)}
                          placeholder="—"
                          className={selCls}
                        />
                      </td>
                      {/* Classe */}
                      <td className="px-1.5 py-1">
                        <select
                          className={`${selCls} font-semibold ${row.classe === "EVITÁVEL" ? "text-red-600" : "text-amber-600"}`}
                          value={row.classe}
                          onChange={e => set(row.id, "classe", e.target.value as "EVITÁVEL" | "INEVITÁVEL")}
                        >
                          <option value="EVITÁVEL">EVITÁVEL</option>
                          <option value="INEVITÁVEL">INEVITÁVEL</option>
                        </select>
                      </td>
                      {/* Descrição */}
                      <td className="px-1.5 py-1">
                        <input
                          className={inputCls}
                          value={row.descricao}
                          onChange={e => set(row.id, "descricao", e.target.value)}
                          onKeyDown={e => handleKeyDown(e, row.id, "descricao")}
                          placeholder="Descrição breve..."
                        />
                      </td>
                      {/* Ações */}
                      <td className="px-1.5 py-1">
                        <div className="flex items-center justify-center gap-1">
                          {row.saved ? (
                            <span className="text-green-600 text-xs font-semibold">✓ Salvo</span>
                          ) : (
                            <>
                              <button
                                onClick={() => saveRow(row)}
                                disabled={row.saving}
                                className="p-1 rounded text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
                                title="Salvar esta linha"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => removeRow(row.id)}
                                className="p-1 rounded text-red-400 hover:bg-red-100 transition-colors"
                                title="Remover linha"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                        {row.error && <p className="text-red-500 text-xs mt-0.5 text-center">{row.error}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer totals */}
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-200">
                  <td colSpan={7} className="px-3 py-2 text-xs font-semibold text-slate-600">
                    {rows.length} linha{rows.length !== 1 ? "s" : ""} — {rows.filter(r => r.saved).length} salva{rows.filter(r => r.saved).length !== 1 ? "s" : ""}
                  </td>
                  <td colSpan={2} className="px-3 py-2 text-xs font-bold font-mono text-slate-800 text-right">
                    Total: R$ {totalCusto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Hint */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            <strong>Dica:</strong> Passe o cursor sobre o código de erro para ver a descrição e ação corretiva. 
            Pressione <kbd className="px-1 py-0.5 bg-white border border-blue-200 rounded text-xs">Enter</kbd> na última coluna para adicionar uma nova linha automaticamente.
            Clique em <strong>Salvar</strong> em cada linha individualmente ou use <strong>Salvar Todos</strong> para registrar tudo de uma vez.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
