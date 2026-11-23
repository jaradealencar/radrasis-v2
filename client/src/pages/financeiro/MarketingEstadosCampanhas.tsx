import { AlertTriangle, MapPin, RotateCcw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtBrl, fmtDate, fmtNum } from "@/lib/format";
import { trpc } from "@/lib/trpc";

const NOMES_UF: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

function dataIsoLocal(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

export default function MarketingEstadosCampanhas({ dataInicial, dataFinal }: { dataInicial: string; dataFinal: string }) {
  const { data, isLoading, isError, refetch } = trpc.marketingFinanceiro.rankingEstadosCampanhas.useQuery(
    { dataInicial, dataFinal },
    { staleTime: 5 * 60 * 1000 },
  );

  const periodoTexto = `${fmtDate(dataIsoLocal(dataInicial))} a ${fmtDate(dataIsoLocal(dataFinal))}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin size={17} className="text-indigo-600" /> Estados com melhor desempenho das campanhas
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Top 3 por receita de O.S. atribuída às campanhas WhatsApp no intervalo selecionado ({periodoTexto}). Atribuição pelo último disparo elegível nos 30 dias anteriores à compra.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Calculando estados…</p>
        ) : isError || !data ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span className="flex items-center gap-2"><AlertTriangle size={16} /> Não foi possível carregar o ranking de estados.</span>
            <Button size="sm" variant="outline" onClick={() => refetch()}><RotateCcw size={14} className="mr-1.5" /> Tentar novamente</Button>
          </div>
        ) : data.topEstados.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {data.vendasSemEstado > 0
              ? `${fmtNum(data.vendasSemEstado)} O.S. atribuídas foram encontradas, mas sem UF preenchida (${fmtBrl(data.receitaSemEstado)}).`
              : "Nenhuma venda de campanha atribuída no período."}
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.topEstados.map((estado, index) => (
                <div key={estado.uf} className="rounded-lg border bg-slate-50/70 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Trophy size={14} className={index === 0 ? "text-amber-500" : "text-slate-400"} />
                    {index + 1}º lugar
                  </div>
                  <div className="text-lg font-semibold text-slate-900">{NOMES_UF[estado.uf] ?? estado.uf} <span className="text-sm text-muted-foreground">({estado.uf})</span></div>
                  <div className="mt-2 text-sm font-semibold text-emerald-700">{fmtBrl(estado.receitaAtribuida)}</div>
                  <div className="text-xs text-muted-foreground">{fmtNum(estado.totalOs)} O.S. · {fmtNum(estado.clientesConvertidos)} clientes</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {fmtNum(data.totalOsAtribuidas)} O.S. atribuídas no total. Receita por estado é um indicador de associação e não representa ROI por UF; investimento regional não é separado.
              {data.vendasSemEstado > 0 && ` ${fmtNum(data.vendasSemEstado)} O.S. (${fmtBrl(data.receitaSemEstado)}) não tinham UF preenchida e ficaram fora do ranking.`}
            </p>
          </>
        )}
        {!isError && data?.fontesIndisponiveis?.length ? (
          <div role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>Fontes indisponíveis: {data.fontesIndisponiveis.join(", ")}. Os números exibidos podem estar incompletos.</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
