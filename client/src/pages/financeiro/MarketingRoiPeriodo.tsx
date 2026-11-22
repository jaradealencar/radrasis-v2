import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { competenciaIso, fmtPeriodoMeses } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import MarketingAnaliseMensal from "./MarketingAnaliseMensal";
import MarketingLancamentoCAC from "./MarketingLancamentoCAC";

export default function MarketingRoiPeriodo({ inicio, fim }: { inicio: string; fim: string }) {
  const anoInicial = Number(inicio.slice(0, 4));
  const anoFinal = Number(fim.slice(0, 4));
  const anos = Array.from({ length: anoFinal - anoInicial + 1 }, (_, i) => anoInicial + i);
  const consultas = trpc.useQueries(t => anos.map(ano =>
    t.marketingFinanceiro.getRelatorioAno({ ano, vendedor: null, cidade: null }),
  ));

  const falhas = consultas.filter(q => q.isError || q.data?.origem === "indisponivel");
  if (falhas.length) {
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>Não foi possível carregar o relatório de ROI de todo o período.</p>
        <Button variant="outline" size="sm" onClick={() => falhas.forEach(q => void q.refetch())}>Tentar novamente</Button>
      </div>
    );
  }
  if (consultas.some(q => !q.data)) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Carregando o ROI do período…</div>;
  }

  const meses = consultas.flatMap(q => q.data?.meses ?? []).filter(m => {
    const competencia = competenciaIso(m.ano, m.mes);
    return competencia >= inicio && competencia <= fim;
  });
  if (!meses.length) {
    return <Empty><EmptyHeader><EmptyTitle>Nenhum mês disponível no período selecionado.</EmptyTitle></EmptyHeader></Empty>;
  }

  return (
    <>
      <MarketingLancamentoCAC meses={meses} />
      <MarketingAnaliseMensal meses={meses} periodoTexto={fmtPeriodoMeses(inicio, fim)} nomeArquivo={`roi-marketing-${inicio}-a-${fim}`} />
    </>
  );
}
