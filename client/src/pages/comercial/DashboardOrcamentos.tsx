import { useState } from "react";
import { CalendarDays, FileText, TrendingUp, Wallet, Percent } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fmtBrl, fmtNum } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import KpiCard from "@/components/KpiCard";
import ChartTooltip from "@/components/ChartTooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColor } from "@/lib/chartColors";

function hojeLocal() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return ano + "-" + mes + "-" + dia;
}

function primeiroDiaDoMes() {
  return hojeLocal().slice(0, 7) + "-01";
}

export default function DashboardOrcamentos() {
  const [de, setDe] = useState(primeiroDiaDoMes);
  const [ate, setAte] = useState(hojeLocal);
  const { data, isLoading, isError } = trpc.propostas.dashboard.useQuery({ de, ate });

  return (
    <div className="space-y-5">
      <PageHeader title="Painel executivo de orçamentos" description="Emissão, conversão, rentabilidade, produtos e desempenho por vendedor." icon={TrendingUp} />
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-4">
          <div className="space-y-1"><Label htmlFor="painel-de">De</Label><Input id="painel-de" type="date" value={de} onChange={(event) => setDe(event.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="painel-ate">Até</Label><Input id="painel-ate" type="date" value={ate} onChange={(event) => setAte(event.target.value)} /></div>
          <p className="text-xs text-muted-foreground"><CalendarDays className="mr-1 inline h-3.5 w-3.5" />Dados das propostas comerciais criadas no período.</p>
        </CardContent>
      </Card>
      {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : isError || !data ? (
        <Empty><EmptyHeader><EmptyMedia variant="icon"><FileText /></EmptyMedia><EmptyTitle>Não foi possível carregar o painel</EmptyTitle><EmptyDescription>Revise o período ou tente novamente.</EmptyDescription></EmptyHeader></Empty>
      ) : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Propostas geradas" value={fmtNum(data.propostas, 0)} icon={FileText} color={chartColor(0)} variant="border" />
          <KpiCard label="Valor emitido" value={fmtBrl(data.valorEmitido)} icon={Wallet} color={chartColor(1)} variant="border" sub={"Convertido: " + fmtBrl(data.valorConvertido)} />
          <KpiCard label="Margem média" value={fmtBrl(data.margemMediaValor)} icon={Percent} color={chartColor(2)} variant="border" sub={fmtNum(data.margemMediaPct, 2) + "% das propostas com decupagem completa"} />
          <KpiCard label="Ticket médio" value={fmtBrl(data.ticketMedio)} icon={TrendingUp} color={chartColor(3)} variant="border" />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Faturamento cotado por margem</CardTitle></CardHeader>
            <CardContent>
              {data.porMargem.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Ainda não há decupagens completas neste período.</p> : <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.porMargem} margin={{ top: 12, right: 12, bottom: 4, left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="faixa" />
                    <YAxis tickFormatter={(value) => fmtBrl(Number(value))} width={92} />
                    <Tooltip content={<ChartTooltip format={fmtBrl} />} />
                    <Bar dataKey="valor" name="Valor cotado" fill={chartColor(0)} radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Desempenho por vendedor</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Vendedor</TableHead><TableHead>Orçado</TableHead><TableHead>Fechado</TableHead><TableHead>Conversão</TableHead><TableHead>Margem média</TableHead></TableRow></TableHeader>
                <TableBody>{data.vendedores.map((vendedor) => <TableRow key={vendedor.nome}>
                  <TableCell className="font-medium">{vendedor.nome}</TableCell><TableCell>{fmtBrl(vendedor.valorOrcado)}</TableCell><TableCell>{fmtBrl(vendedor.valorFechado)}</TableCell><TableCell>{fmtNum(vendedor.conversaoPct, 1)}%</TableCell><TableCell>{vendedor.margemMediaPct == null ? "—" : fmtNum(vendedor.margemMediaPct, 1) + "%"}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Produtos mais orçados</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Itens</TableHead><TableHead>Valor cotado</TableHead></TableRow></TableHeader>
              <TableBody>{data.produtos.map((item) => <TableRow key={item.nome}><TableCell>{item.nome}</TableCell><TableCell>{fmtNum(item.ocorrencias, 0)}</TableCell><TableCell>{fmtBrl(item.valor)}</TableCell></TableRow>)}</TableBody>
            </Table>{data.produtos.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">Nenhum item no período.</p>}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Matérias-primas mais orçadas</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>Insumo</TableHead><TableHead>Linhas</TableHead><TableHead>Quantidade</TableHead></TableRow></TableHeader>
              <TableBody>{data.materiais.map((item) => <TableRow key={item.nome}><TableCell>{item.nome}</TableCell><TableCell>{fmtNum(item.ocorrencias, 0)}</TableCell><TableCell>{fmtNum(item.quantidade, 3)}</TableCell></TableRow>)}</TableBody>
            </Table>{data.materiais.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">Nenhuma matéria-prima no período.</p>}</CardContent>
          </Card>
        </div>
      </>}
    </div>
  );
}
