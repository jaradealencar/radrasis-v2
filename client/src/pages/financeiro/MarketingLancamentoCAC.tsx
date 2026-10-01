import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Calculator, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { RouterOutputs } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtBrl, fmtNum, MESES } from "@/lib/format";

type RelatorioAno = RouterOutputs["marketingFinanceiro"]["getRelatorioAno"];

interface Props {
  ano: number;
  relatorio: RelatorioAno;
  refetch: () => void;
}

function sugerirMes(relatorio: RelatorioAno, ano: number): number {
  const mesComClientesSemInvestimento = [...relatorio.meses]
    .reverse()
    .find(m => m.novo.qtdClientesUnicos > 0 && m.investimentoAquisicao == null);
  if (mesComClientesSemInvestimento) return mesComClientesSemInvestimento.mes;

  const ultimoMesComDados = [...relatorio.meses]
    .reverse()
    .find(m => m.faturamentoTotalValido > 0 || m.investimentoAquisicao != null);
  if (ultimoMesComDados) return ultimoMesComDados.mes;

  const agora = new Date();
  return ano === agora.getFullYear() ? agora.getMonth() + 1 : 12;
}

function valorInicial(relatorio: RelatorioAno, mes: number): string {
  const valor = relatorio.meses.find(m => m.mes === mes)?.investimentoAquisicao;
  return valor != null ? valor.toFixed(2).replace(".", ",") : "";
}

function parseValor(texto: string): number | null | undefined {
  const limpo = texto.trim().replace(/^R\$\s*/i, "");
  if (!limpo) return null;
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : undefined;
}

export default function MarketingLancamentoCAC({ ano, relatorio, refetch }: Props) {
  const mesInicial = useMemo(() => sugerirMes(relatorio, ano), [ano, relatorio]);
  const [mes, setMes] = useState(mesInicial);
  const [valor, setValor] = useState(() => valorInicial(relatorio, mesInicial));
  const anoRef = useRef(ano);
  const anoRelatorioRef = useRef(relatorio.meses[0]?.ano ?? null);
  const anoDoRelatorio = relatorio.meses[0]?.ano ?? null;

  useEffect(() => {
    if (anoRef.current !== ano) {
      anoRef.current = ano;
      setMes(ano === new Date().getFullYear() ? new Date().getMonth() + 1 : 12);
      setValor("");
    }
    if (anoDoRelatorio === ano && anoRelatorioRef.current !== ano) {
      anoRelatorioRef.current = ano;
      const proximoMes = sugerirMes(relatorio, ano);
      setMes(proximoMes);
      setValor(valorInicial(relatorio, proximoMes));
    }
  }, [ano, anoDoRelatorio, relatorio]);

  const mesRelatorio = relatorio.meses.find(m => m.mes === mes);
  const mesDisponivel = mesRelatorio?.ano === ano;
  const salvar = trpc.financeiro.upsertCustoMarketing.useMutation({
    onSuccess: () => {
      toast.success("Investimento salvo. O CAC foi atualizado.");
      refetch();
    },
    onError: erro => toast.error("Erro ao salvar: " + erro.message),
  });

  function selecionarMes(novoMes: number) {
    setMes(novoMes);
    setValor(valorInicial(relatorio, novoMes));
  }

  function salvarInvestimento() {
    const investimentoAquisicao = parseValor(valor);
    if (investimentoAquisicao === undefined || (investimentoAquisicao != null && investimentoAquisicao < 0)) {
      toast.error("Informe um valor válido, como 1250,50.");
      return;
    }
    if (investimentoAquisicao == null && mesRelatorio?.investimentoAquisicao == null) {
      toast.error("Digite o investimento ou informe 0 se não houve gasto.");
      return;
    }

    salvar.mutate({ mes, ano, investimentoAquisicao });
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
            Escolha o mês e informe o total gasto para adquirir clientes. O CAC aparece atualizado depois de salvar.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(150px,0.8fr)_minmax(220px,1.2fr)_auto] md:items-end">
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          Mês de referência
          <select
            value={mes}
            onChange={e => selecionarMes(Number(e.target.value))}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            {MESES.map((nome, index) => {
              const mesExisteNoRelatorio = relatorio.meses.some(m => m.mes === index + 1 && m.ano === ano);
              return <option key={nome} value={index + 1} disabled={!mesExisteNoRelatorio}>{nome} / {ano}</option>;
            })}
          </select>
        </label>

        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          Investimento em aquisição
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">R$</span>
            <Input
              className="h-10 bg-white pl-10"
              inputMode="decimal"
              value={valor}
              onChange={e => setValor(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") salvarInvestimento(); }}
              placeholder="Ex.: 1250,50"
              aria-label="Valor investido em aquisição"
            />
          </div>
          <span className="block text-xs font-normal text-slate-500">Use 0 se não houve gasto no mês.</span>
        </label>

        <Button
          type="button"
          onClick={salvarInvestimento}
          disabled={salvar.isPending || !mesDisponivel}
          className="h-10 gap-2 bg-purple-700 text-white hover:bg-purple-800"
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          {salvar.isPending ? "Salvando…" : mesDisponivel ? "Salvar e calcular CAC" : "Dados do mês indisponíveis"}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 rounded-lg border border-purple-100 bg-white p-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-500">Clientes novos no mês</p>
          <p className="mt-0.5 font-semibold text-slate-900">{fmtNum(mesRelatorio?.novo.qtdClientesUnicos ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">CAC calculado para {MESES[mes - 1]}</p>
          <p className="mt-0.5 font-semibold text-purple-800">
            {!mesDisponivel
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
