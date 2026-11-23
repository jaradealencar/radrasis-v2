import { AlertTriangle, MapPin, RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

function nomeEstado(uf: string): string {
  return NOMES_UF[uf] ? `${NOMES_UF[uf]} (${uf})` : uf;
}

function dataIsoLocal(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

export default function MarketingEstadosNovos({ dataInicial, dataFinal }: { dataInicial: string; dataFinal: string }) {
  const { data, isLoading, isError, refetch } = trpc.marketingFinanceiro.getDistribuicaoEstadosNovos.useQuery(
    { dataInicial, dataFinal },
    { staleTime: 5 * 60 * 1000 },
  );
  const periodoTexto = `${fmtDate(dataIsoLocal(dataInicial))} a ${fmtDate(dataIsoLocal(dataFinal))}`;

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando clientes novos e propostas por estado…</p>;
  if (isError || !data) return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <span className="flex items-center gap-2"><AlertTriangle size={16} /> Não foi possível carregar a origem por estado.</span>
      <Button size="sm" variant="outline" onClick={() => refetch()}><RotateCcw size={14} className="mr-1.5" /> Tentar novamente</Button>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Desempenho de clientes cuja primeira O.S. normal registrada ocorreu no período ({periodoTexto}), calculado pelo histórico local até a última sincronização. A consulta não depende da API do ERP; compras ainda não sincronizadas não entram. O faturamento soma as O.S. normais desses mesmos clientes no intervalo; o investimento de campanha não é rateado por Estado.
      </p>
      <div role="note" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        “Novo cliente” significa primeira O.S. normal encontrada no histórico disponível, que começa em março de 2023. A UF é a registrada no histórico da primeira O.S.; compras anteriores ao início da base e mudanças de endereço não podem ser confirmadas por este relatório.
      </div>
      {data.fontesIndisponiveis?.length ? (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>Fontes indisponíveis: {data.fontesIndisponiveis.join(", ")}. A análise pode ficar incompleta ou imprecisa; registros sem UF continuam nos totais correspondentes.</span>
        </div>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users size={17} className="text-blue-600" /> Desempenho dos novos clientes por Estado
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Ordenado pelo faturamento. Propostas são vinculadas ao mesmo cliente e só entram se foram emitidas antes da primeira compra, dentro do período.
          </p>
        </CardHeader>
        <CardContent>
          {data.totalClientesPrimeiraCompra === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente de primeira compra identificado no período.</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado da 1ª O.S.</TableHead>
                    <TableHead className="text-right">Novos clientes</TableHead>
                    <TableHead className="text-right">O.S. no período</TableHead>
                    <TableHead className="text-right">Faturamento O.S.</TableHead>
                    <TableHead className="text-right">Média / cliente</TableHead>
                    <TableHead className="text-right">Clientes com proposta prévia</TableHead>
                    <TableHead className="text-right">Propostas antes da compra</TableHead>
                    <TableHead className="text-right">Valor cotado antes da compra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.clientesPrimeiraCompra.map(item => (
                    <TableRow key={item.uf}>
                      <TableCell>{nomeEstado(item.uf)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtNum(item.clientes)}</TableCell>
                      <TableCell className="text-right">{fmtNum(item.os)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtBrl(item.faturamento)}</TableCell>
                      <TableCell className="text-right">{fmtBrl(item.ticketMedioPorCliente)}</TableCell>
                      <TableCell className="text-right">{fmtNum(item.clientesComPropostaAntesDaCompra)}</TableCell>
                      <TableCell className="text-right">{fmtNum(item.propostasAntesDaCompra)}</TableCell>
                      <TableCell className="text-right">{fmtBrl(item.valorPropostasAntesDaCompra)}</TableCell>
                    </TableRow>
                  ))}
                  {data.clientesPrimeiraCompraSemUf > 0 && (
                    <TableRow className="text-muted-foreground">
                      <TableCell>Sem UF confiável</TableCell>
                      <TableCell className="text-right">{fmtNum(data.clientesPrimeiraCompraSemUf)}</TableCell>
                      <TableCell className="text-right">{fmtNum(data.osPrimeiraCompraSemUf)}</TableCell>
                      <TableCell className="text-right">{fmtBrl(data.faturamentoPrimeiraCompraSemUf)}</TableCell>
                      <TableCell className="text-right">{fmtBrl(data.clientesPrimeiraCompraSemUf > 0 ? data.faturamentoPrimeiraCompraSemUf / data.clientesPrimeiraCompraSemUf : 0)}</TableCell>
                      <TableCell className="text-right">{fmtNum(data.clientesComPropostaAntesDaCompraSemUf)}</TableCell>
                      <TableCell className="text-right">{fmtNum(data.propostasAntesDaCompraSemUf)}</TableCell>
                      <TableCell className="text-right">{fmtBrl(data.valorPropostasAntesDaCompraSemUf)}</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{fmtNum(data.totalClientesPrimeiraCompra)}</TableCell>
                    <TableCell className="text-right">{fmtNum(data.totalOsPrimeiraCompra)}</TableCell>
                    <TableCell className="text-right">{fmtBrl(data.faturamentoPrimeiraCompra)}</TableCell>
                    <TableCell className="text-right">{fmtBrl(data.totalClientesPrimeiraCompra > 0 ? data.faturamentoPrimeiraCompra / data.totalClientesPrimeiraCompra : 0)}</TableCell>
                    <TableCell className="text-right">{fmtNum(data.clientesComPropostaAntesDaCompra)}</TableCell>
                    <TableCell className="text-right">{fmtNum(data.totalPropostasAntesDaCompra)}</TableCell>
                    <TableCell className="text-right">{fmtBrl(data.valorPropostasAntesDaCompra)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Faturamento usa valor da O.S. após descontos do ERP; não é lucro. O cruzamento proposta→compra usa o nome normalizado do cliente, pois o histórico não guarda vínculo direto entre número da proposta e número da O.S.
            {data.clientesPrimeiraCompraSemUf > 0 && ` ${fmtNum(data.clientesPrimeiraCompraSemUf)} ${data.clientesPrimeiraCompraSemUf === 1 ? "cliente" : "clientes"} (${fmtNum(data.osPrimeiraCompraSemUf)} O.S., ${fmtBrl(data.faturamentoPrimeiraCompraSemUf)}) sem UF da primeira compra confiável.`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin size={17} className="text-violet-600" /> Pipeline de propostas para prospects por Estado
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Propostas emitidas no período ({periodoTexto}) antes de qualquer compra válida registrada para o cliente. O Estado vem do endereço da proposta quando disponível.
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
                    <TableHead className="text-right">Prospects</TableHead>
                    <TableHead className="text-right">Propostas</TableHead>
                    <TableHead className="text-right">Valor cotado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.propostasNovosClientes.map(item => (
                    <TableRow key={item.uf}>
                      <TableCell>{nomeEstado(item.uf)}</TableCell>
                      <TableCell className="text-right">{fmtNum(item.clientes)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtNum(item.propostas)}</TableCell>
                      <TableCell className="text-right">{fmtBrl(item.valorPropostas)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {fmtNum(data.totalPropostasNovosClientes)} propostas · {fmtBrl(data.valorPropostasNovosClientes)} no total com valor disponível. Clientes podem aparecer em UFs diferentes quando os endereços registrados nas propostas divergem.
            {data.propostasNovosClientesSemUf > 0 && ` ${fmtNum(data.propostasNovosClientesSemUf)} propostas (${fmtBrl(data.valorPropostasNovosClientesSemUf)}) sem UF confiável.`}
            {data.propostasNovosClientesSemValor > 0 && ` ${fmtNum(data.propostasNovosClientesSemValor)} ${data.propostasNovosClientesSemValor === 1 ? "proposta sem valor disponível." : "propostas sem valor disponível."}`}
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
