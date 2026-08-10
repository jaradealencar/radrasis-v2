import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DollarSign, TrendingUp, TrendingDown, Edit2 } from "lucide-react";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function PainelFinanceiro() {
  const { data: financeiros } = trpc.financeiros.list.useQuery();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    mes: 1,
    ano: 2026,
    receitaBruta: 0,
    receitaOperacional: 0,
    receitaFinanceira: 0,
    despesasTotal: 0,
    despesasFixas: 0,
    despesasVariaveis: 0,
    despesasPessoal: 0,
    despesasFinanceiras: 0,
    despesasImpostos: 0,
    lucroGruto: 0,
    lucroOperacional: 0,
    lucroLiquido: 0,
    entradas: 0,
    saidas: 0,
    saldoMes: 0,
    observacoes: "",
  });

  const utils = trpc.useUtils();
  const upsertMutation = trpc.financeiros.upsert.useMutation({
    onSuccess: () => {
      toast.success("Dados financeiros atualizados!");
      utils.financeiros.list.invalidate();
      setShowDialog(false);
      setEditingId(null);
      resetForm();
    },
    onError: (e) => toast.error(e.message || "Erro ao salvar"),
  });

  const resetForm = () => {
    setFormData({
      mes: 1,
      ano: 2026,
      receitaBruta: 0,
      receitaOperacional: 0,
      receitaFinanceira: 0,
      despesasTotal: 0,
      despesasFixas: 0,
      despesasVariaveis: 0,
      despesasPessoal: 0,
      despesasFinanceiras: 0,
      despesasImpostos: 0,
      lucroGruto: 0,
      lucroOperacional: 0,
      lucroLiquido: 0,
      entradas: 0,
      saidas: 0,
      saldoMes: 0,
      observacoes: "",
    });
  };

  const handleEdit = (financeiro: any) => {
    setFormData({
      mes: financeiro.mes,
      ano: financeiro.ano,
      receitaBruta: Number(financeiro.receitaBruta) || 0,
      receitaOperacional: Number(financeiro.receitaOperacional) || 0,
      receitaFinanceira: Number(financeiro.receitaFinanceira) || 0,
      despesasTotal: Number(financeiro.despesasTotal) || 0,
      despesasFixas: Number(financeiro.despesasFixas) || 0,
      despesasVariaveis: Number(financeiro.despesasVariaveis) || 0,
      despesasPessoal: Number(financeiro.despesasPessoal) || 0,
      despesasFinanceiras: Number(financeiro.despesasFinanceiras) || 0,
      despesasImpostos: Number(financeiro.despesasImpostos) || 0,
      lucroGruto: Number(financeiro.lucroGruto) || 0,
      lucroOperacional: Number(financeiro.lucroOperacional) || 0,
      lucroLiquido: Number(financeiro.lucroLiquido) || 0,
      entradas: Number(financeiro.entradas) || 0,
      saidas: Number(financeiro.saidas) || 0,
      saldoMes: Number(financeiro.saldoMes) || 0,
      observacoes: financeiro.observacoes || "",
    });
    setEditingId(financeiro.id);
    setShowDialog(true);
  };

  const handleSave = () => {
    upsertMutation.mutate(formData);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Painel Financeiro</h2>
          <p className="text-sm text-slate-500 mt-1">Gestão de dados financeiros mensais</p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }} className="gap-2">
          <DollarSign className="w-4 h-4" />
          Novo Mês
        </Button>
      </div>

      {/* Cards de Resumo */}
      {financeiros && financeiros.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(() => {
            const totalReceita = financeiros.reduce((s, f) => s + Number(f.receitaBruta), 0);
            const totalDespesas = financeiros.reduce((s, f) => s + Number(f.despesasTotal), 0);
            const totalLucro = financeiros.reduce((s, f) => s + Number(f.lucroLiquido), 0);
            const saldoTotal = financeiros.reduce((s, f) => s + Number(f.saldoMes), 0);

            return (
              <>
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-semibold">Receita Total</p>
                      <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(totalReceita)}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-600 opacity-20" />
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-semibold">Despesas Total</p>
                      <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalDespesas)}</p>
                    </div>
                    <TrendingDown className="w-8 h-8 text-red-600 opacity-20" />
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-semibold">Lucro Líquido</p>
                      <p className={`text-xl font-bold mt-1 ${totalLucro >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        {formatCurrency(totalLucro)}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-blue-600 opacity-20" />
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-semibold">Saldo Acumulado</p>
                      <p className={`text-xl font-bold mt-1 ${saldoTotal >= 0 ? "text-emerald-600" : "text-orange-600"}`}>
                        {formatCurrency(saldoTotal)}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-emerald-600 opacity-20" />
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Tabela de Dados */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Mês/Ano</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Receita Bruta</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Despesas</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Lucro Líquido</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Saldo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {financeiros?.map((f: any) => (
                <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{MESES[f.mes - 1]}/{f.ano}</td>
                  <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold">{formatCurrency(Number(f.receitaBruta))}</td>
                  <td className="px-4 py-3 text-sm text-right text-red-600 font-semibold">{formatCurrency(Number(f.despesasTotal))}</td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold ${Number(f.lucroLiquido) >= 0 ? "text-blue-600" : "text-red-600"}`}>
                    {formatCurrency(Number(f.lucroLiquido))}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold ${Number(f.saldoMes) >= 0 ? "text-emerald-600" : "text-orange-600"}`}>
                    {formatCurrency(Number(f.saldoMes))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(f)} className="gap-1">
                      <Edit2 className="w-3.5 h-3.5" />
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar" : "Novo"} Dados Financeiros</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Mês</Label>
                <select
                  className="w-full mt-1 border border-slate-200 rounded-md px-3 py-2 text-sm"
                  value={formData.mes}
                  onChange={e => setFormData(f => ({ ...f, mes: Number(e.target.value) }))}
                >
                  {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Ano</Label>
                <Input
                  type="number"
                  value={formData.ano}
                  onChange={e => setFormData(f => ({ ...f, ano: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-slate-700">Receitas</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Receita Bruta</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.receitaBruta}
                    onChange={e => setFormData(f => ({ ...f, receitaBruta: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Receita Operacional</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.receitaOperacional}
                    onChange={e => setFormData(f => ({ ...f, receitaOperacional: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Receita Financeira</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.receitaFinanceira}
                    onChange={e => setFormData(f => ({ ...f, receitaFinanceira: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-slate-700">Despesas</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Despesas Total</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.despesasTotal}
                    onChange={e => setFormData(f => ({ ...f, despesasTotal: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Despesas Fixas</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.despesasFixas}
                    onChange={e => setFormData(f => ({ ...f, despesasFixas: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Despesas Variáveis</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.despesasVariaveis}
                    onChange={e => setFormData(f => ({ ...f, despesasVariaveis: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Despesas Pessoal</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.despesasPessoal}
                    onChange={e => setFormData(f => ({ ...f, despesasPessoal: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Despesas Financeiras</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.despesasFinanceiras}
                    onChange={e => setFormData(f => ({ ...f, despesasFinanceiras: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Despesas Impostos</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.despesasImpostos}
                    onChange={e => setFormData(f => ({ ...f, despesasImpostos: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-slate-700">Resultados</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Lucro Bruto</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.lucroGruto}
                    onChange={e => setFormData(f => ({ ...f, lucroGruto: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Lucro Operacional</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.lucroOperacional}
                    onChange={e => setFormData(f => ({ ...f, lucroOperacional: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Lucro Líquido</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.lucroLiquido}
                    onChange={e => setFormData(f => ({ ...f, lucroLiquido: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-slate-700">Fluxo de Caixa</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Entradas</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.entradas}
                    onChange={e => setFormData(f => ({ ...f, entradas: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Saídas</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.saidas}
                    onChange={e => setFormData(f => ({ ...f, saidas: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Saldo do Mês</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.saldoMes}
                    onChange={e => setFormData(f => ({ ...f, saldoMes: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs">Observações</Label>
              <textarea
                className="w-full mt-1 border border-slate-200 rounded-md px-3 py-2 text-sm"
                rows={3}
                value={formData.observacoes}
                onChange={e => setFormData(f => ({ ...f, observacoes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
