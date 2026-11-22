import { useState } from "react";
import { toast } from "sonner";
import { Calculator, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { RouterOutputs } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { competenciaIso, fmtBrl, fmtNum, MESES } from "@/lib/format";
import { parseInvestimentoMarketing } from "@shared/marketing-financeiro";
import MarketingInvestimentoInput from "./MarketingInvestimentoInput";

type MesRelatorio = RouterOutputs["marketingFinanceiro"]["getRelatorioAno"]["meses"][number];

function sugerirMes(meses: MesRelatorio[]) {
  const recentes = [...meses].reverse();
  return recentes.find(m => m.novo.qtdClientesUnicos > 0 && m.investimentoAquisicao == null)
    ?? recentes.find(m => m.faturamentoTotalValido > 0 || m.investimentoAquisicao != null)
    ?? recentes[0];
}

function valorInicial(mes: MesRelatorio): string {
  const valor = mes.investimentoAquisicao;
  return valor != null ? valor.toFixed(2).replace(".", ",") : "";
}

export default function MarketingLancamentoCAC({ meses }: { meses: MesRelatorio[] }) {
  const utils = trpc.useUtils();
  const mesInicial = sugerirMes(meses);
  const [competencia, setCompetencia] = useState(() => competenciaIso(mesInicial.ano, mesInicial.mes));
  const [valor, setValor] = useState(() => valorInicial(mesInicial));
  const mesRelatorio = meses.find(m => competenciaIso(m.ano, m.mes) === competencia);
  const salvar = trpc.financeiro.upsertCustoMarketing.useMutation({
    onSuccess: () => {
      toast.success("Investimento salvo. O CAC foi atualizado.");
      void utils.marketingFinanceiro.getRelatorioAno.invalidate();
    },
    onError: erro => toast.error("Erro ao salvar: " + erro.message),
  });

  function selecionarMes(novaCompetencia: string) {
    const novoMes = meses.find(m => competenciaIso(m.ano, m.mes) === novaCompetencia);
    if (!novoMes) return;
    setCompetencia(novaCompetencia);
    setValor(valorInicial(novoMes));
  }

  function salvarInvestimento() {
    if (!mesRelatorio || salvar.isPending) return;
    const investimentoAquisicao = parseInvestimentoMarketing(valor);
    if (investimentoAquisicao === undefined || (investimentoAquisicao != null && investimentoAquisicao < 0)) {
      toast.error("Informe um valor válido, como 1250,50.");
      return;
    }
    if (investimentoAquisicao == null && mesRelatorio?.investimentoAquisicao == null) {
      toast.error("Digite o investimento ou informe 0 se não houve gasto.");
      return;
    }

    salvar.mutate({ mes: mesRelatorio.mes, ano: mesRelatorio.ano, investimentoAquisicao });
  }

  return (
    <section className="rounded-xl border border-purple-200 bg-purple-50/60 p-4 sm:p-5" aria-labelledby="lancamento-cac-titulo">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-lg bg-white p-2 text-purple-700 shadow-sm">
          <Calculator size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 id="lancamento-cac-titulo" className="font-semibold text-slate-900">Lançar investimento e calcular CAC</h2>
          <p className="mt-1 text-sm text-slate-600">
            Escolha o mês e informe o total gasto para adquirir clientes. O CAC aparece atualizado depois de salvar. O campo aceita vírgula ou ponto decimal.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(150px,0.8fr)_minmax(220px,1.2fr)_auto] md:items-end">
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          Mês de referência
          <select
            value={competencia}
            onChange={e => selecionarMes(e.target.value)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            {meses.map(m => {
              const id = competenciaIso(m.ano, m.mes);
              return <option key={id} value={id}>{MESES[m.mes - 1]} / {m.ano}</option>;
            })}
          </select>
        </label>

        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          Investimento em aquisição
          <MarketingInvestimentoInput
            wrapperClassName="w-full"
            inputClassName="h-10 bg-white"
            value={valor}
            onChange={setValor}
            onKeyDown={e => { if (e.key === "Enter") salvarInvestimento(); }}
            ariaLabel="Valor investido em aquisição"
          />
          <span className="block text-xs font-normal text-slate-500">Use 0 se não houve gasto no mês.</span>
        </label>

        <Button
          type="button"
          onClick={salvarInvestimento}
          disabled={salvar.isPending || !mesRelatorio}
          className="h-10 gap-2 bg-purple-700 text-white hover:bg-purple-800"
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          {salvar.isPending ? "Salvando…" : mesRelatorio ? "Salvar e calcular CAC" : "Dados do mês indisponíveis"}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 rounded-lg border border-purple-100 bg-white p-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-500">Clientes novos no mês</p>
          <p className="mt-0.5 font-semibold text-slate-900">{fmtNum(mesRelatorio?.novo.qtdClientesUnicos ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">CAC calculado{mesRelatorio && ` para ${MESES[mesRelatorio.mes - 1]}/${mesRelatorio.ano}`}</p>
          <p className="mt-0.5 font-semibold text-purple-800">
            {!mesRelatorio
              ? "Dados do mês indisponíveis"
              : mesRelatorio?.novo.cacPonderado != null
              ? fmtBrl(mesRelatorio.novo.cacPonderado)
              : mesRelatorio?.investimentoAquisicao == null
                ? "Salve o investimento para calcular"
                : "Sem clientes novos no mês"}
          </p>
        </div>
      </div>
    </section>
  );
}
