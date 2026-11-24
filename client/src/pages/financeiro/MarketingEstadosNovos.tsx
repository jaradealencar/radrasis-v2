import { AlertTriangle, RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtBrl, fmtDate, fmtNum, fmtPct } from "@/lib/format";
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

  function conversaoPct(convertidos: number, empresasCotadas: number): number | null {
    if (!empresasCotadas) return null;
    return (convertidos / empresasCotadas) * 100;
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
    const oss = c?.os ?? 0;
    const faturamento = c?.faturamento ?? 0;
    const propostas = p?.propostas ?? 0;
    const empresasCotadas = p?.clientes ?? 0;
    const clientesConvertidos = p?.clientesConvertidos ?? 0;
    const conversao = conversaoPct(clientesConvertidos, empresasCotadas);
    return { uf, oss, faturamento, propostas, empresasCotadas, clientesConvertidos, conversao };
  })
    .sort((a, b) => b.propostas - a.propostas || b.faturamento - a.faturamento || a.uf.localeCompare(b.uf));

  const conversaoTotal = conversaoPct(data.totalClientesConvertidosNovosClientes, data.totalClientesCotadosNovosClientes);
  const media = linhas.length ? {
    propostas: linhas.reduce((soma, item) => soma + item.propostas, 0) / linhas.length,
    oss: linhas.reduce((soma, item) => soma + item.oss, 0) / linhas.length,
    faturamento: linhas.reduce((soma, item) => soma + item.faturamento, 0) / linhas.length,
    conversao: (() => {
      const taxas = linhas.flatMap(item => item.conversao == null ? [] : [item.conversao]);
      return taxas.length ? taxas.reduce((soma, taxa) => soma + taxa, 0) / taxas.length : null;
    })(),
  } : null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Cotações para novos clientes, pedidos (O.S.), faturamento e conversão por Estado no período ({periodoTexto}).
        A tabela mostra o total do período e a média por Estado; compras ainda não sincronizadas não entram.
      </p>
      <div role="note" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        “Novo cliente” significa primeira O.S. normal encontrada no histórico disponível, que começa em março de 2023.
        A UF é a registrada no histórico da primeira O.S. para pedidos e faturamento, e a do endereço da proposta
        para cotações. A conversão compara empresas cotadas com empresas cuja primeira compra foi localizada depois
        da proposta, usando o nome normalizado; não há vínculo direto entre uma proposta e uma O.S. Assim, a taxa é
        por empresa única, enquanto cotações contam cada proposta.
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
            <Users size={17} className="text-blue-600" /> Cotações, pedidos e faturamento por Estado
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Conversão = empresas com primeira compra localizada depois da cotação ÷ empresas cotadas. Ordenado
            por cotações e, em caso de empate, por faturamento.
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
                    <TableHead className="text-right">Cotações</TableHead>
                    <TableHead className="text-right">Pedidos (O.S.)</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Conversão de clientes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map(item => (
                    <TableRow key={item.uf}>
                      <TableCell>{nomeEstado(item.uf)}</TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{fmtNum(item.propostas)}</div>
                        <div className="text-xs text-muted-foreground">{fmtNum(item.empresasCotadas)} empresas</div>
                      </TableCell>
                      <TableCell className="text-right">{fmtNum(item.oss)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtBrl(item.faturamento)}</TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{item.conversao == null ? "—" : fmtPct(item.conversao, 1)}</div>
                        <div className="text-xs text-muted-foreground">{fmtNum(item.clientesConvertidos)} empresas</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Total geral</TableCell>
                    <TableCell className="text-right">{fmtNum(data.totalPropostasNovosClientes)}</TableCell>
                    <TableCell className="text-right">{fmtNum(data.totalOsPrimeiraCompra)}</TableCell>
                    <TableCell className="text-right">{fmtBrl(data.faturamentoPrimeiraCompra)}</TableCell>
                    <TableCell className="text-right">
                      <div>{conversaoTotal == null ? "—" : fmtPct(conversaoTotal, 1)}</div>
                      <div className="text-xs font-normal">{fmtNum(data.totalClientesConvertidosNovosClientes)} / {fmtNum(data.totalClientesCotadosNovosClientes)} empresas</div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Média por Estado</TableCell>
                    <TableCell className="text-right">{media ? fmtNum(media.propostas, 1) : "—"}</TableCell>
                    <TableCell className="text-right">{media ? fmtNum(media.oss, 1) : "—"}</TableCell>
                    <TableCell className="text-right">{media ? fmtBrl(media.faturamento) : "—"}</TableCell>
                    <TableCell className="text-right">{media?.conversao == null ? "—" : fmtPct(media.conversao, 1)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Faturamento usa valor da O.S. após descontos do ERP; não é lucro. A média por Estado considera somente
            as UFs listadas; a conversão geral é ponderada por empresas únicas cotadas, e a média de conversão
            estadual é a média simples das taxas de cada UF.
            {data.clientesPrimeiraCompraSemUf > 0 && ` ${fmtNum(data.clientesPrimeiraCompraSemUf)} ${data.clientesPrimeiraCompraSemUf === 1 ? "cliente" : "clientes"} (${fmtNum(data.osPrimeiraCompraSemUf)} O.S., ${fmtBrl(data.faturamentoPrimeiraCompraSemUf)}) sem UF da primeira compra confiável.`}
            {data.propostasNovosClientesSemUf > 0 && ` ${fmtNum(data.propostasNovosClientesSemUf)} ${data.propostasNovosClientesSemUf === 1 ? "proposta" : "propostas"} (${fmtBrl(data.valorPropostasNovosClientesSemUf)}) sem UF confiável.`}
            {data.propostasNovosClientesSemValor > 0 && ` ${fmtNum(data.propostasNovosClientesSemValor)} ${data.propostasNovosClientesSemValor === 1 ? "proposta sem valor disponível." : "propostas sem valor disponível."}`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
