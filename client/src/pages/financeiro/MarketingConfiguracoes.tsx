import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, Settings2, Target, SlidersHorizontal, AlertTriangle } from "lucide-react";

type ConfigForm = {
  mesesInatividadeReativacao: number;
  percentualMargemFallback: number;
  cacMaximo: number | null;
  custoReativacaoMaximo: number | null;
  roiMinimoPct: number | null;
  ticketMedioMinimo: number | null;
  metaClientesNovosMes: number | null;
  metaClientesReativadosMes: number | null;
  aumentoMaximoCacMensalPct: number | null;
  janelaAtribuicaoDias: number;
  direcionadorRateio: "pedidos" | "faturamento" | "custo_direto" | "rateio_erp" | "personalizado";
  custosFinanceirosIncluemMarketing: boolean;
};

function NumeroOpcionalInput({ label, sufixo, value, onChange }: { label: string; sufixo?: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          value={value ?? ""}
          placeholder="Sem meta"
          onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="h-8 text-sm"
        />
        {sufixo && <span className="text-xs text-muted-foreground shrink-0">{sufixo}</span>}
      </div>
    </div>
  );
}

/** Metas/semáforos/parâmetros do painel "Crescimento e Resultado" — mesmo
 * espírito de FaixaDiasConfigForm.tsx (estado local inicializado 1x da query,
 * dirty flag, salvamento atômico com toast+invalidate). Os defaults (6 meses,
 * 51%, sem janela de atribuição) reproduzem o comportamento que o relatório
 * já tinha antes desta tela existir — salvar aqui é opcional, não obrigatório. */
export default function MarketingConfiguracoes() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.marketingFinanceiro.getConfig.useQuery();
  const [form, setForm] = useState<ConfigForm | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data && !form) setForm({ ...data });
  }, [data, form]);

  const save = trpc.marketingFinanceiro.saveConfig.useMutation({
    onSuccess: (novo) => {
      toast.success("Configurações salvas — os números do painel são recalculados automaticamente.");
      setDirty(false);
      setForm({ ...novo });
      utils.marketingFinanceiro.invalidate();
    },
    onError: (e) => toast.error(`Erro ao salvar: ${e.message}`),
  });

  if (isLoading || !form) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Carregando configurações...</div>;
  }

  const update = <K extends keyof ConfigForm>(campo: K, valor: ConfigForm[K]) => {
    setForm(prev => prev ? { ...prev, [campo]: valor } : prev);
    setDirty(true);
  };

  const erro = form.mesesInatividadeReativacao < 1
    ? "Meses de inatividade precisa ser pelo menos 1."
    : form.percentualMargemFallback < 0 || form.percentualMargemFallback > 100
    ? "Percentual de margem estimada precisa estar entre 0 e 100."
    : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        <span>
          Mudar <strong>meses de inatividade</strong> ou <strong>percentual de margem estimada</strong> recalcula
          retroativamente todos os meses ainda não congelados do painel. Meses já auditados/congelados em
          Performance Comercial não são afetados — esta configuração é isolada, específica deste painel.
        </span>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Settings2 size={16} className="text-purple-600" /> Parâmetros de classificação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Meses sem compra para contar como "reativado"</label>
            <Input type="number" min={1} value={form.mesesInatividadeReativacao} onChange={e => update("mesesInatividadeReativacao", Math.max(1, Number(e.target.value) || 1))} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Margem de contribuição estimada (fallback, %)</label>
            <Input type="number" min={0} max={100} value={form.percentualMargemFallback} onChange={e => update("percentualMargemFallback", Number(e.target.value) || 0)} className="h-8 text-sm" />
            <p className="text-[11px] text-muted-foreground">Usada só quando o pedido não tem custo real (`contribuicaoReais`) — a maioria já tem margem real.</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Janela de atribuição</label>
            <Select value={String(form.janelaAtribuicaoDias)} onValueChange={v => update("janelaAtribuicaoDias", Number(v))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Mês calendário inteiro (padrão)</SelectItem>
                <SelectItem value="30">30 dias desde a virada</SelectItem>
                <SelectItem value="60">60 dias desde a virada</SelectItem>
                <SelectItem value="90">90 dias desde a virada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Direcionador de rateio de custo fixo</label>
            <Select value={form.direcionadorRateio} onValueChange={v => update("direcionadorRateio", v as ConfigForm["direcionadorRateio"])}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="faturamento">Faturamento</SelectItem>
                <SelectItem value="pedidos">Quantidade de pedidos</SelectItem>
                <SelectItem value="custo_direto">Custo direto</SelectItem>
                <SelectItem value="rateio_erp">Rateio já calculado pelo ERP</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Só afeta análises gerenciais por vendedor — nunca substitui o custo fixo real na ponte de resultado.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Target size={16} className="text-emerald-600" /> Metas e semáforos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumeroOpcionalInput label="CAC máximo desejado" sufixo="R$" value={form.cacMaximo} onChange={v => update("cacMaximo", v)} />
          <NumeroOpcionalInput label="Custo máximo por reativado" sufixo="R$" value={form.custoReativacaoMaximo} onChange={v => update("custoReativacaoMaximo", v)} />
          <NumeroOpcionalInput label="ROI mínimo" sufixo="%" value={form.roiMinimoPct} onChange={v => update("roiMinimoPct", v)} />
          <NumeroOpcionalInput label="Ticket médio mínimo" sufixo="R$" value={form.ticketMedioMinimo} onChange={v => update("ticketMedioMinimo", v)} />
          <NumeroOpcionalInput label="Meta de clientes novos/mês" value={form.metaClientesNovosMes} onChange={v => update("metaClientesNovosMes", v)} />
          <NumeroOpcionalInput label="Meta de clientes reativados/mês" value={form.metaClientesReativadosMes} onChange={v => update("metaClientesReativadosMes", v)} />
          <NumeroOpcionalInput label="Aumento máximo do CAC mês a mês" sufixo="%" value={form.aumentoMaximoCacMensalPct} onChange={v => update("aumentoMaximoCacMensalPct", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><SlidersHorizontal size={16} className="text-slate-600" /> Resultado Geral</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 py-1">
            <div>
              <div className="text-xs font-medium text-slate-700">As Despesas Fixas/Financeiras já incluem o investimento de marketing?</div>
              <p className="text-[11px] text-muted-foreground">Padrão: não (vêm de planilhas/fontes diferentes). Se marcar, o marketing deixa de ser subtraído de novo na ponte de resultado.</p>
            </div>
            <Switch checked={form.custosFinanceirosIncluemMarketing} onCheckedChange={v => update("custosFinanceirosIncluemMarketing", v)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        {erro && <div className="text-xs text-red-600 font-medium">{erro}</div>}
        <Button size="sm" className="gap-1.5 ml-auto" disabled={save.isPending || !dirty || !!erro} onClick={() => save.mutate(form)}>
          <Save size={14} />
          {save.isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
        <p><strong>Não implementado ainda</strong> (dependem de decisão de processo, não só de código): funil de aquisição completo (sem dado de leads), funil de reativação com contatados/respondidos (sem dado de campanha no CRM), teste de incrementalidade com grupo controle.</p>
      </div>
    </div>
  );
}
