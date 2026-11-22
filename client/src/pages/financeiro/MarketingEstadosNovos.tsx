import { MapPin, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtNum } from "@/lib/format";
import { trpc } from "@/lib/trpc";

const NOMES_UF: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

function nomeEstado(uf: string): string {
  return NOMES_UF[uf] ? `${NOMES_UF[uf]} (${uf})` : uf;
}

export default function MarketingEstadosNovos({ ano }: { ano: number }) {
  const { data, isLoading, isError } = trpc.marketingFinanceiro.getDistribuicaoEstadosNovos.useQuery(
    { ano },
    { staleTime: 5 * 60 * 1000 },
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando clientes novos e propostas por estado…</p>;
  if (isError || !data) return <p className="text-sm text-red-600">Não foi possível carregar a origem por estado.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Distribuição comercial do ano selecionado; os dados não individualizam investimento nem atribuição a um disparo específico.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users size={17} className="text-blue-600" /> Clientes de primeira compra por Estado
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Clientes que compraram pela primeira vez em {ano}; reativações não entram.
          </p>
        </CardHeader>
        <CardContent>
          {data.clientesPrimeiraCompra.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente de primeira compra identificado no período.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Estado</TableHead><TableHead className="text-right">Clientes</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {data.clientesPrimeiraCompra.map(item => (
                    <TableRow key={item.uf}>
                      <TableCell>{nomeEstado(item.uf)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtNum(item.clientes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {fmtNum(data.totalClientesPrimeiraCompra)} clientes únicos no total.
            {data.clientesPrimeiraCompraSemUf > 0 && ` ${fmtNum(data.clientesPrimeiraCompraSemUf)} sem UF informada.`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin size={17} className="text-violet-600" /> Propostas de clientes novos por Estado
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Propostas emitidas em {ano} quando o cliente ainda não tinha compra anterior, inclusive prospects; canceladas e excluídas ficam fora.
          </p>
        </CardHeader>
        <CardContent>
          {data.propostasNovosClientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma proposta de cliente novo identificada no período.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Propostas</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.propostasNovosClientes.map(item => (
                    <TableRow key={item.uf}>
                      <TableCell>{nomeEstado(item.uf)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtNum(item.propostas)}</TableCell>
                      <TableCell className="text-right">{fmtNum(item.clientes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {fmtNum(data.totalPropostasNovosClientes)} propostas no total. A UF vem do endereço da proposta no cache ERP ou do cadastro histórico; não é inferida pelo telefone.
            {data.propostasNovosClientesSemUf > 0 && ` ${fmtNum(data.propostasNovosClientesSemUf)} propostas sem UF confiável.`}
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
