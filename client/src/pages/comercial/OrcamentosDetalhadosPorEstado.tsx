import { trpc } from "@/lib/trpc";
import { fmtBrl, fmtDate } from "@/lib/format";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useMemo } from "react";

type OrcDetalhado = {
  orcNumero: string;
  empresa: string;
  estado: string | null;
  cidade: string;
  total: number;
  vendedor: string;
  dataCadastro: string;
  status: string;
  virouOs: boolean;
};

export default function OrcamentosDetalhadosPorEstado({
  mes,
  ano,
}: {
  mes: number;
  ano: number;
}) {
  const {
    data: orcamentos,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = trpc.performanceComercial.getOrcamentosDetalhadosPorEstado.useQuery(
    { mes, ano },
    { refetchOnWindowFocus: false, retry: 1, staleTime: 5 * 60 * 1000 },
  );

  const total = useMemo(() => {
    if (!orcamentos) return 0;
    return orcamentos.reduce((acc, o) => acc + o.total, 0);
  }, [orcamentos]);

  const taxaMedia = useMemo(() => {
    if (!orcamentos || orcamentos.length === 0) return 0;
    const convertidos = orcamentos.filter(o => o.virouOs).length;
    return (convertidos / orcamentos.length) * 100;
  }, [orcamentos]);

  const handleRetry = () => {
    void refetch();
  };

  if (isLoading) {
    return (
      <Card className="flex flex-col items-center justify-center py-16">
        <CardContent className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Buscando orçamentos...</p>
        </CardContent>
      </Card>
    );
  }

  if (isError && (!orcamentos || orcamentos.length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Orçamentos por Estado</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <p className="text-sm text-red-600">Não foi possível ler o histórico sincronizado. O erro não significa que o período esteja sem orçamentos.</p>
          <Button onClick={handleRetry} variant="outline" size="sm" disabled={isFetching}>
            <RefreshCw className={`w-3 h-3 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!orcamentos || orcamentos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Orçamentos por Estado</CardTitle>
        </CardHeader>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-slate-500">Nenhum orçamento encontrado para este período.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span>Orçamentos por Estado</span>
          </div>
          <span className="text-xs font-normal text-slate-400">
            {orcamentos.length} proposta(s) · Total {fmtBrl(total)} · Taxa de conversão {taxaMedia.toFixed(1)}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isError && (
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            A atualização falhou. Mostrando os últimos dados carregados nesta sessão.
          </p>
        )}
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead>Nº Proposta</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Virou O.S.</TableHead>
                <TableHead className="text-center">Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orcamentos.map((o) => (
                <TableRow key={o.orcNumero || o.empresa + o.dataCadastro}>
                  <TableCell className="font-medium text-slate-700">
                    {o.estado ? o.estado : <span className="text-slate-300 italic">Sem UF</span>}
                  </TableCell>
                  <TableCell className="font-mono text-blue-700">{o.orcNumero}</TableCell>
                  <TableCell className="font-medium text-slate-800">{o.empresa}</TableCell>
                  <TableCell className="text-slate-600">{o.cidade || <span className="text-slate-300 italic">—</span>}</TableCell>
                  <TableCell className="text-right font-mono text-green-700">{fmtBrl(o.total)}</TableCell>
                  <TableCell className="text-slate-600">{o.vendedor}</TableCell>
                  <TableCell className="text-slate-600 font-mono">{fmtDate(o.dataCadastro)}</TableCell>
                  <TableCell className="text-slate-500 capitalize">{o.status}</TableCell>
                  <TableCell className="text-center font-medium">
                    {o.virouOs ? (
                      <span className="text-green-700">Sim</span>
                    ) : (
                      <span className="text-red-600">Não</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-mono font-bold">
                    {o.virouOs ? "100%" : "0%"}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-slate-50 font-bold border-t border-slate-200">
                <TableCell colSpan={2} className="text-right">
                  Total
                </TableCell>
                <TableCell colSpan={2} className="text-slate-500"></TableCell>
                <TableCell className="text-right font-mono text-green-700">{fmtBrl(total)}</TableCell>
                <TableCell colSpan={2} className="text-slate-500"></TableCell>
                <TableCell className="text-center font-mono">{taxaMedia.toFixed(1)}%</TableCell>
                <TableCell colSpan={2} className="text-slate-500"></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
