import { MapPin, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtBrl, fmtNum } from "@/lib/format";
import { trpc } from "@/lib/trpc";

const NOMES_UF: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

export default function MarketingEstadosCampanhas({ ano }: { ano: number }) {
  const { data, isLoading, isError } = trpc.marketingFinanceiro.rankingEstadosCampanhas.useQuery(
    { ano },
    { staleTime: 5 * 60 * 1000 },
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin size={17} className="text-indigo-600" /> Estados com melhor desempenho das campanhas
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Top 3 por receita de O.S. atribuída às campanhas WhatsApp em {ano}. Atribuição pelo último disparo elegível nos 30 dias anteriores à compra.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Calculando estados…</p>
        ) : isError || !data ? (
          <p className="text-sm text-red-600">Não foi possível carregar o ranking de estados.</p>
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
      </CardContent>
    </Card>
  );
}
