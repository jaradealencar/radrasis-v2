import { ListChecks } from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { fmtBrl, fmtNum } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatarDataBr, formatarTelefone } from "@shared/campanhas-whatsapp";
import type { CampanhaLinha } from "./comuns";

type Venda = RouterOutputs["campanhasWhatsapp"]["vendasPosVenda"]["pendentes"][number];

interface Props {
  /** `null` = fechado. */
  campanha: CampanhaLinha | null;
  onClose: () => void;
}

function TabelaVendas({ vendas, total }: { vendas: Venda[]; total: number }) {
  if (vendas.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma venda nesta lista.</p>;
  return (
    <div className="space-y-2">
      <div className="rounded-md border overflow-x-auto max-h-[46vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>OS</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Faturamento</TableHead>
              <TableHead>Prazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendas.map(v => (
              <TableRow key={v.osNumero}>
                <TableCell className="font-mono text-xs">{v.osNumero}</TableCell>
                <TableCell className="max-w-[16rem] truncate" title={v.empresa}>{v.empresa || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {v.telefone ? formatarTelefone(v.telefone) : <Badge variant="outline" className="text-amber-700 border-amber-300">sem telefone</Badge>}
                </TableCell>
                <TableCell>{v.vendedor ?? "—"}</TableCell>
                <TableCell className="text-right">{v.valor != null ? fmtBrl(v.valor) : "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatarDataBr(v.dataFaturamento)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatarDataBr(v.prazo)}
                  {v.diasAtraso > 0 && <span className="ml-1 text-[11px] text-red-600">({v.diasAtraso}d atraso)</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {total > vendas.length && (
        <p className="text-[11px] text-muted-foreground">Mostrando as {fmtNum(vendas.length)} mais antigas de {fmtNum(total)}.</p>
      )}
    </div>
  );
}

export default function VendasPosVendaDialog({ campanha, onClose }: Props) {
  const { data, isLoading, isError, error } = trpc.campanhasWhatsapp.vendasPosVenda.useQuery(
    { campanhaId: campanha?.id ?? 0 },
    { enabled: !!campanha },
  );

  return (
    <Dialog open={!!campanha} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ListChecks size={18} className="text-blue-600" /> Vendas do pós-venda</DialogTitle>
          <DialogDescription>
            {campanha?.nome} · prazo = data de faturamento + {campanha?.frequenciaDias} dias
            {(campanha?.periodoInicio ?? campanha?.gatilhoAPartirDe) && ` · só faturadas a partir de ${formatarDataBr((campanha.periodoInicio ?? campanha.gatilhoAPartirDe)!)}`}
            {campanha?.periodoFim && ` até ${formatarDataBr(campanha.periodoFim)}`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner className="size-6" /></div>
        ) : isError ? (
          <p className="text-sm text-red-700 py-6">Não consegui carregar as vendas: {error.message}</p>
        ) : data && (
          <Tabs defaultValue="pendentes">
            <TabsList>
              <TabsTrigger value="pendentes">Para contatar ({fmtNum(data.totalPendentes)})</TabsTrigger>
              <TabsTrigger value="proximas">A vencer ({fmtNum(data.totalProximas)})</TabsTrigger>
            </TabsList>
            <TabsContent value="pendentes" className="pt-3 space-y-2">
              {data.pendentesSemTelefone > 0 && (
                <p className="text-xs text-amber-700">
                  {fmtNum(data.pendentesSemTelefone)} sem telefone (OS antigas ainda sem o número preenchido) — não entram no envio.
                </p>
              )}
              <TabelaVendas vendas={data.pendentes} total={data.totalPendentes} />
            </TabsContent>
            <TabsContent value="proximas" className="pt-3">
              <TabelaVendas vendas={data.proximas} total={data.totalProximas} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
