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

  function conversaoPct(num: number, den: number): number | null {
    if (!den || den === 0) return null;
    return (num / den) * 100;
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando desempenho de novos clientes por estado…</p>;
  if (isError || !data) return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <span className="flex items-center gap-2"><AlertTriangle size={16} /> Não foi possível carregar o desempenho por estado.</span>
      <Button size="sm" variant="outline" onClick={() => refetch()}><RotateCcw size={14} className="mr-1.5" /> Tentar novamente</Button>
    </div>
  );

  // Junta, por UF, os clientes de primeira compra (pedidos) e as propostas para
  // clientes novos, já devolvidos juntos pela procedure do servidor.
  const clientesPorUf = new Map<string, (typeof data.clientesPrimeiraCompra)[number]>();
  for (const c of data.clientesPrimeiraCompra) clientesPorUf.set(c.uf, c);
  const propostasPorUf = new Map<string, (typeof data.propostasNovosClientes)[number]>();
  for (const p of data.propostasNovosClientes) propostasPorUf.set(p.uf, p);

  const ufs = new Set([...clientesPorUf.keys(), ...propostasPorUf.keys()]);
  const linhas = Array.from(ufs).map(uf => {
    const c = clientesPorUf.get(uf);
    const p = propostasPorUf.get(uf);
    const clientes = c?.clientes ?? 0;
    const oss = c?.os ?? 0;
    const faturamento = c?.faturamento ?? 0;
    const propostas = p?.propostas ?? 0;
    const clientesConvertidos = p?.clientesConvertidos ?? 0;
    const valorCotado = p?.valorPropostas ?? 0;
    const conversao = conversaoPct(clientesConvertidos, propostas);
    return { uf, clientes, oss, faturamento, propostas, clientesConvertidos, valorCotado, conversao };
  })
    .sort((a, b) => b.propostas - a.propostas || b.oss - a.oss || a.uf.localeCompare(b.uf));

  const conversaoTotal = conversaoPct(data.clientesComPropostaAntesDaCompra, data.totalPropostasNovosClientes);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Desempenho de novos clientes por Estado no período ({periodoTexto}), em uma única tabela: propostas de
        novos clientes, pedidos (O.S.) de novos clientes, faturamento e taxa de conversão por Estado. O cálculo
        não depende da API do ERP; compras ainda não sincronizadas não entram.
      </p>
      <div role="note" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        “Novo cliente” significa primeira O.S. normal encontrada no histórico disponível, que começa em março de 2023.
        A UF é a registrada no histórico da primeira O.S. para os pedidos, e a do endereço da proposta para as
        propostas; mudanças de endereço não podem ser confirmadas por este relatório. A taxa de conversão é
        clientes convertidos ÷ propostas de novos clientes. Clientes podem aparecer em UFs diferentes quando os
        endereços das propostas divergem do histórico da primeira compra; as taxas por UF são independentes nesse caso.
      </div>
      {data.fontesIndisponiveis?.length ? (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>Fontes indisponíveis: {data.fontesIndisponiveis.join(", ")}. A análise pode ficar incompleta ou imprecisa; registros sem UF continuam nos totais correspondentes.</span>
        </div>
      ) : null}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users size={17} className="text-blue-600" /> Desempenho de novos clientes por Estado
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Propostas de novos clientes, pedidos (O.S.) e taxa de conversão por Estado, em uma única janela.
            Ordenado por propostas e, empatando, por pedidos.
          </p>
        </CardHeader>
        <CardContent>
          {linhas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado de novos clientes por Estado no período.</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Novos clientes</TableHead>
                    <TableHead className="text-right">Propostas de novos clientes</TableHead>
                    <TableHead className="text-right">Pedidos (O.S.)</TableHead>
                    <TableHead className="text-right">Faturamento O.S.</TableHead>
                    <TableHead className="text-right">Clientes convertidos</TableHead>
                    <TableHead className="text-right">Valor cotado</TableHead>
                    <TableHead className="text-right">Taxa de conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map(item => (
                    <TableRow key={item.uf}>
                      <TableCell>{nomeEstado(item.uf)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtNum(item.clientes)}</TableCell>
                      <TableCell className="text-right">{fmtNum(item.propostas)}</TableCell>
                      <TableCell className="text-right">{fmtNum(item.oss)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtBrl(item.faturamento)}</TableCell>
                      <TableCell className="text-right">{fmtNum(item.clientesConvertidos)}</TableCell>
                      <TableCell className="text-right">{fmtBrl(item.valorCotado)}</TableCell>
                      <TableCell className="text-right">{item.conversao == null ? "—" : `${item.conversao.toFixed(1)}%`}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{fmtNum(data.totalClientesPrimeiraCompra)}</TableCell>
                    <TableCell className="text-right">{fmtNum(data.totalPropostasNovosClientes)}</TableCell>
                    <TableCell className="text-right">{fmtNum(data.totalOsPrimeiraCompra)}</TableCell>
                    <TableCell className="text-right">{fmtBrl(data.faturamentoPrimeiraCompra)}</TableCell>
                    <TableCell className="text-right">{fmtNum(data.clientesComPropostaAntesDaCompra)}</TableCell>
                    <TableCell className="text-right">{fmtBrl(data.valorPropostasNovosClientes)}</TableCell>
                    <TableCell className="text-right">{conversaoTotal == null ? "—" : `${conversaoTotal.toFixed(1)}%`}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Faturamento usa valor da O.S. após descontos do ERP; não é lucro. O cruzamento proposta→compra usa o
            nome normalizado do cliente, pois o histórico não guarda vínculo direto entre número da proposta e
            número da O.S.
            {data.clientesPrimeiraCompraSemUf > 0 && ` ${fmtNum(data.clientesPrimeiraCompraSemUf)} ${data.clientesPrimeiraCompraSemUf === 1 ? "cliente" : "clientes"} (${fmtNum(data.osPrimeiraCompraSemUf)} O.S., ${fmtBrl(data.faturamentoPrimeiraCompraSemUf)}) sem UF da primeira compra confiável.`}
            {data.propostasNovosClientesSemUf > 0 && ` ${fmtNum(data.propostasNovosClientesSemUf)} ${data.propostasNovosClientesSemUf === 1 ? "proposta" : "propostas"} (${fmtBrl(data.valorPropostasNovosClientesSemUf)}) sem UF confiável.`}
            {data.propostasNovosClientesSemValor > 0 && ` ${fmtNum(data.propostasNovosClientesSemValor)} ${data.propostasNovosClientesSemValor === 1 ? "proposta sem valor disponível." : "propostas sem valor disponível."}`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
