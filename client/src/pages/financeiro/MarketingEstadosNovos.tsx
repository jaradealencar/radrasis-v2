import { AlertTriangle, FileDown, RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtBrl, fmtDate, fmtNum, fmtPct } from "@/lib/format";
import { exportarMarketingEstadosNovosPdf } from "@/lib/marketingEstadosNovosPdf";
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

  function conversaoPct(pedidos: number, cotacoes: number): number | null {
    if (!cotacoes) return null;
    return (pedidos / cotacoes) * 100;
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando desempenho de novos clientes por estado…</p>;
  if (isError || !data) return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <span className="flex items-center gap-2"><AlertTriangle size={16} /> Não foi possível carregar o desempenho por estado.</span>
      <Button size="sm" variant="outline" onClick={() => refetch()}><RotateCcw size={14} className="mr-1.5" /> Tentar novamente</Button>
    </div>
  );

  const reportData = data;

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
    const conversao = conversaoPct(oss, propostas);
    const clientesUnicos = c?.clientes ?? 0;
    const clientesComRecompra = c?.clientesComRecompra ?? 0;
    const taxaRecompra = c?.taxaRecompra ?? null;
    return { uf, oss, faturamento, propostas, conversao, clientesUnicos, clientesComRecompra, taxaRecompra };
  })
    .sort((a, b) => b.propostas - a.propostas || b.faturamento - a.faturamento || a.uf.localeCompare(b.uf));

  if (data.propostasNovosClientesSemUf > 0 || data.osPrimeiraCompraSemUf > 0) {
    linhas.push({
      uf: "",
      oss: data.osPrimeiraCompraSemUf,
      faturamento: data.faturamentoPrimeiraCompraSemUf,
      propostas: data.propostasNovosClientesSemUf,
      conversao: null,
      clientesUnicos: data.clientesPrimeiraCompraSemUf,
      clientesComRecompra: data.clientesComRecompraSemUf,
      taxaRecompra: data.taxaRecompraSemUf,
    });
  }

  const conversaoTotal = conversaoPct(data.totalOsPrimeiraCompra, data.totalPropostasNovosClientes);
  const linhasPorEstado = linhas.filter(item => item.uf !== "");
  const media = linhasPorEstado.length ? {
    propostas: linhasPorEstado.reduce((soma, item) => soma + item.propostas, 0) / linhasPorEstado.length,
    oss: linhasPorEstado.reduce((soma, item) => soma + item.oss, 0) / linhasPorEstado.length,
    faturamento: linhasPorEstado.reduce((soma, item) => soma + item.faturamento, 0) / linhasPorEstado.length,
    clientesUnicos: linhasPorEstado.reduce((soma, item) => soma + item.clientesUnicos, 0) / linhasPorEstado.length,
    clientesComRecompra: linhasPorEstado.reduce((soma, item) => soma + item.clientesComRecompra, 0) / linhasPorEstado.length,
    conversao: (() => {
      const taxas = linhasPorEstado.flatMap(item => item.conversao == null ? [] : [item.conversao]);
      return taxas.length ? taxas.reduce((soma, taxa) => soma + taxa, 0) / taxas.length : null;
    })(),
    taxaRecompra: (() => {
      const taxas = linhasPorEstado.flatMap(item => item.taxaRecompra == null ? [] : [item.taxaRecompra]);
      return taxas.length ? taxas.reduce((soma, taxa) => soma + taxa, 0) / taxas.length : null;
    })(),
  } : null;

  function exportarPdf() {
    exportarMarketingEstadosNovosPdf({
      periodo: periodoTexto,
      linhas: linhas.map(item => ({
        estado: item.uf ? nomeEstado(item.uf) : "UF não identificada",
        cotacoes: item.propostas,
        pedidos: item.oss,
        faturamento: item.faturamento,
        conversao: item.conversao,
        clientesUnicos: item.clientesUnicos,
        clientesComRecompra: item.clientesComRecompra,
        taxaRecompra: item.taxaRecompra,
      })),
      total: {
        cotacoes: reportData.totalPropostasNovosClientes,
        pedidos: reportData.totalOsPrimeiraCompra,
        faturamento: reportData.faturamentoPrimeiraCompra,
        conversao: conversaoTotal,
        clientesUnicos: reportData.totalClientesPrimeiraCompra,
        clientesComRecompra: reportData.totalClientesComRecompra,
        taxaRecompra: reportData.taxaRecompraGeral,
      },
      media: media ? {
        cotacoes: media.propostas,
        pedidos: media.oss,
        faturamento: media.faturamento,
        conversao: media.conversao,
        clientesUnicos: media.clientesUnicos,
        clientesComRecompra: media.clientesComRecompra,
        taxaRecompra: media.taxaRecompra,
      } : null,
      fontesIndisponiveis: reportData.fontesIndisponiveis,
      cotacoesSemValor: reportData.propostasNovosClientesSemValor,
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Período: {periodoTexto}. Inclui cotações e O.S. normais de clientes sem compra em meses anteriores; clientes
        marcados como recorrentes ficam fora. Cada O.S. conta como uma venda.
      </p>
      {data.fontesIndisponiveis?.length ? (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>Fontes indisponíveis: {data.fontesIndisponiveis.join(", ")}. A análise pode ficar incompleta ou imprecisa; registros sem UF continuam nos totais correspondentes.</span>
        </div>
      ) : null}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users size={17} className="text-blue-600" /> Cotações, pedidos e faturamento por Estado
            </CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={exportarPdf}>
              <FileDown size={15} /> Exportar PDF
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Taxa Conv. Novos = pedidos (O.S.) ÷ cotações por UF. Clientes únicos são empresas com primeira compra no período;
            recompra conta outra O.S. válida após a compra de entrada, observada até hoje e agrupada pela UF da primeira compra.
            O ERP não liga cada O.S. à cotação de origem, então a taxa de conversão compara volumes. Ordenado por cotações e, em caso de empate, por faturamento.
          </p>
        </CardHeader>
        <CardContent>
          {linhas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado de novos clientes por Estado no período.</p>
          ) : (
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="h-8">
                  <TableHead className="py-1">Estado</TableHead>
                  <TableHead className="py-1 text-right">Cotações</TableHead>
                  <TableHead className="py-1 text-right">Pedidos (O.S.)</TableHead>
                  <TableHead className="py-1 text-right">Clientes únicos</TableHead>
                  <TableHead className="py-1 text-right">Faturamento</TableHead>
                  <TableHead className="py-1 text-right">Taxa Conv. Novos</TableHead>
                  <TableHead className="py-1 text-right">Taxa Recompra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map(item => (
                  <TableRow key={item.uf || "sem-uf"} className="h-8">
                    <TableCell className="py-1">{item.uf ? nomeEstado(item.uf) : "UF não identificada"}</TableCell>
                    <TableCell className="py-1 text-right">
                      <div className="font-medium">{fmtNum(item.propostas)}</div>
                    </TableCell>
                    <TableCell className="py-1 text-right">{fmtNum(item.oss)}</TableCell>
                    <TableCell className="py-1 text-right">{fmtNum(item.clientesUnicos)}</TableCell>
                    <TableCell className="py-1 text-right font-medium">{fmtBrl(item.faturamento)}</TableCell>
                    <TableCell className="py-1 text-right">
                      {item.conversao == null ? "—" : fmtPct(item.conversao, 1)}
                    </TableCell>
                    <TableCell className="py-1 text-right" title={`${fmtNum(item.clientesComRecompra)} de ${fmtNum(item.clientesUnicos)} clientes recompraram`}>
                      {item.taxaRecompra == null ? "—" : (
                        <>
                          <div>{fmtPct(item.taxaRecompra, 1)}</div>
                          <div className="text-[10px] font-normal text-muted-foreground">{fmtNum(item.clientesComRecompra)} / {fmtNum(item.clientesUnicos)}</div>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="h-8 bg-muted/40 font-semibold">
                  <TableCell className="py-1">Total geral</TableCell>
                  <TableCell className="py-1 text-right">{fmtNum(data.totalPropostasNovosClientes)}</TableCell>
                  <TableCell className="py-1 text-right">{fmtNum(data.totalOsPrimeiraCompra)}</TableCell>
                  <TableCell className="py-1 text-right">{fmtNum(data.totalClientesPrimeiraCompra)}</TableCell>
                  <TableCell className="py-1 text-right">{fmtBrl(data.faturamentoPrimeiraCompra)}</TableCell>
                  <TableCell className="py-1 text-right">{conversaoTotal == null ? "—" : fmtPct(conversaoTotal, 1)}</TableCell>
                  <TableCell className="py-1 text-right" title={`${fmtNum(data.totalClientesComRecompra)} de ${fmtNum(data.totalClientesPrimeiraCompra)} clientes recompraram`}>
                    {data.taxaRecompraGeral == null ? "—" : (
                      <>
                        <div>{fmtPct(data.taxaRecompraGeral, 1)}</div>
                        <div className="text-[10px] font-normal text-muted-foreground">{fmtNum(data.totalClientesComRecompra)} / {fmtNum(data.totalClientesPrimeiraCompra)}</div>
                      </>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow className="h-8">
                  <TableCell className="py-1">Média por Estado</TableCell>
                  <TableCell className="py-1 text-right">{media ? fmtNum(media.propostas, 1) : "—"}</TableCell>
                  <TableCell className="py-1 text-right">{media ? fmtNum(media.oss, 1) : "—"}</TableCell>
                  <TableCell className="py-1 text-right">{media ? fmtNum(media.clientesUnicos, 1) : "—"}</TableCell>
                  <TableCell className="py-1 text-right">{media ? fmtBrl(media.faturamento) : "—"}</TableCell>
                  <TableCell className="py-1 text-right">{media?.conversao == null ? "—" : fmtPct(media.conversao, 1)}</TableCell>
                  <TableCell className="py-1 text-right">
                    {media?.taxaRecompra == null ? "—" : (
                      <>
                        <div>{fmtPct(media.taxaRecompra, 1)}</div>
                        <div className="text-[10px] font-normal text-muted-foreground">{fmtNum(media.clientesComRecompra, 1)} / {fmtNum(media.clientesUnicos, 1)}</div>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Faturamento usa valor da O.S. após descontos; não é lucro. Recompra = clientes únicos com outra O.S. normal após a primeira compra,
            medida até hoje; clientes mais recentes tiveram menos tempo para recomprar, então a taxa pode aumentar com o tempo. Total Conv. = O.S. ÷ cotações;
            a média estadual é simples entre UFs identificadas. Registros sem UF aparecem na linha “UF não identificada” e entram no total, mas não na média estadual.
            {data.propostasNovosClientesSemValor > 0 && ` ${fmtNum(data.propostasNovosClientesSemValor)} ${data.propostasNovosClientesSemValor === 1 ? "cotação sem valor disponível." : "cotações sem valor disponível."}`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
