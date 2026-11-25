import { trpc } from "@/lib/trpc";
import { fmtBrl, fmtDate } from "@/lib/format";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

export default function OrcamentosDetalhadosPorEstado({
  mes,
  ano,
}: {
  mes: number;
  ano: number;
}) {
  const [aberto, setAberto] = useState(false);
  const {
    data: orcamentos,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = trpc.performanceComercial.getOrcamentosDetalhadosPorEstado.useQuery(
    { mes, ano },
    { refetchOnWindowFocus: false, retry: 1, staleTime: 5 * 60 * 1000 }
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

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="block p-0">
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls="orcamentos-estado-conteudo"
          onClick={() => setAberto(valor => !valor)}
          className="flex w-full flex-col items-start justify-between gap-3 px-6 py-5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:flex-row sm:items-center"
        >
          <span className="flex items-center gap-3">
            <span className="font-semibold leading-none">
              Orçamentos por Estado
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${aberto ? "rotate-180" : ""}`}
            />
          </span>
          <span className="text-left text-xs font-normal text-slate-400 sm:text-right">
            {orcamentos
              ? `${orcamentos.length} proposta(s) · Total ${fmtBrl(total)} · Taxa de conversão ${taxaMedia.toFixed(1)}%`
              : isLoading
                ? "Carregando resumo..."
                : isError
                  ? "Não foi possível carregar o resumo"
                  : "Nenhum orçamento neste período"}
          </span>
        </button>
      </CardHeader>

      <div id="orcamentos-estado-conteudo" hidden={!aberto}>
        {aberto &&
          (isLoading ? (
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <Spinner className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Buscando orçamentos...</p>
            </CardContent>
          ) : isError && (!orcamentos || orcamentos.length === 0) ? (
            <CardContent className="flex flex-col items-center gap-3 py-10">
              <p className="text-sm text-red-600">
                Não foi possível ler o histórico sincronizado. O erro não
                significa que o período esteja sem orçamentos.
              </p>
              <Button
                onClick={handleRetry}
                variant="outline"
                size="sm"
                disabled={isFetching}
              >
                <RefreshCw
                  className={`mr-1 h-3 w-3 ${isFetching ? "animate-spin" : ""}`}
                />
                Tentar novamente
              </Button>
            </CardContent>
          ) : !orcamentos || orcamentos.length === 0 ? (
            <CardContent className="py-10 text-center">
              <p className="text-sm text-slate-500">
                Nenhum orçamento encontrado para este período.
              </p>
            </CardContent>
          ) : (
            <CardContent className="pb-6">
              {isError && (
                <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  A atualização falhou. Mostrando os últimos dados carregados
                  nesta sessão.
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
                    {orcamentos.map(o => (
                      <TableRow key={o.orcNumero || o.empresa + o.dataCadastro}>
                        <TableCell className="font-medium text-slate-700">
                          {o.estado ? (
                            o.estado
                          ) : (
                            <span className="text-slate-300 italic">
                              Sem UF
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-blue-700">
                          {o.orcNumero}
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">
                          {o.empresa}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {o.cidade || (
                            <span className="text-slate-300 italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-700">
                          {fmtBrl(o.total)}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {o.vendedor}
                        </TableCell>
                        <TableCell className="font-mono text-slate-600">
                          {fmtDate(o.dataCadastro)}
                        </TableCell>
                        <TableCell className="text-slate-500 capitalize">
                          {o.status}
                        </TableCell>
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
                    <TableRow className="border-t border-slate-200 bg-slate-50 font-bold">
                      <TableCell colSpan={2} className="text-right">
                        Total
                      </TableCell>
                      <TableCell
                        colSpan={2}
                        className="text-slate-500"
                      ></TableCell>
                      <TableCell className="text-right font-mono text-green-700">
                        {fmtBrl(total)}
                      </TableCell>
                      <TableCell
                        colSpan={2}
                        className="text-slate-500"
                      ></TableCell>
                      <TableCell className="text-center font-mono">
                        {taxaMedia.toFixed(1)}%
                      </TableCell>
                      <TableCell
                        colSpan={2}
                        className="text-slate-500"
                      ></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          ))}
      </div>
    </Card>
  );
}
