import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { fmtBrl, fmtDate } from "@/lib/format";
import { gerarPdfProposta } from "@/lib/pdfProposta";
import { Instagram, Download, FileDown, Package } from "lucide-react";

export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const utils = trpc.useUtils();
  const { data, isLoading, isError } = trpc.propostas.publico.obterPorToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token },
  );

  const toggle = trpc.propostas.publico.toggleItem.useMutation({
    onMutate: async ({ itemId, ativo }) => {
      await utils.propostas.publico.obterPorToken.cancel({ token: token! });
      const anterior = utils.propostas.publico.obterPorToken.getData({ token: token! });
      utils.propostas.publico.obterPorToken.setData({ token: token! }, (atual) => {
        if (!atual) return atual;
        const itens = atual.itens.map((i) => (i.id === itemId ? { ...i, ativo } : i));
        const ativos = itens.filter((i) => i.ativo);
        const valorTotal = ativos.reduce((s, i) => s + Number(i.precoUnitario) * Number(i.quantidade), 0);
        const prazos = ativos.map((i) => i.prazoFabricacaoDiasUteis ?? 0);
        const prazoFabricacaoDiasUteis = prazos.length ? Math.max(...prazos) : null;
        return { ...atual, itens, valorTotal, prazoFabricacaoDiasUteis };
      });
      return { anterior };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.anterior) utils.propostas.publico.obterPorToken.setData({ token: token! }, ctx.anterior);
    },
    onSettled: () => utils.propostas.publico.obterPorToken.invalidate({ token: token! }),
  });

  if (!token || isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <p className="text-muted-foreground">Link inválido.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Spinner />
      </div>
    );
  }

  const parcelas = data.jurosParcelamento.map((j) => ({
    ...j,
    valorParcela: (data.valorTotal * (1 + j.jurosPct / 100)) / j.parcelas,
  }));

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Proposta comercial</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data.proposta.clienteNome} · {fmtDate(data.proposta.createdAt)}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" /> Itens da proposta
            </CardTitle>
            <p className="text-xs text-muted-foreground">Desligue um item para simular o valor sem ele.</p>
          </CardHeader>
          <CardContent className="divide-y">
            {data.itens.map((item) => (
              <div key={item.id} className={`py-3 flex items-center justify-between gap-3 ${!item.ativo ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.produtoNome}</p>
                  {item.descricao?.trim() && (
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{item.descricao}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {Number(item.quantidade)}x {fmtBrl(Number(item.precoUnitario))}
                    {item.prazoFabricacaoDiasUteis != null && ` · ${item.prazoFabricacaoDiasUteis} dias úteis`}
                  </p>
                  {item.instagramUrl && (
                    <a
                      href={item.instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-pink-600 hover:underline mt-0.5"
                    >
                      <Instagram className="w-3 h-3" /> Ver no Instagram
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium">{fmtBrl(Number(item.precoUnitario) * Number(item.quantidade))}</span>
                  <Switch checked={item.ativo} onCheckedChange={(ativo) => toggle.mutate({ token, itemId: item.id, ativo })} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Valor total</span>
            <span className="text-2xl font-bold">{fmtBrl(data.valorTotal)}</span>
          </CardContent>
        </Card>

        {(data.prazoFabricacaoDiasUteis != null || data.proposta.formasPagamento.length > 0) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Prazo e pagamento</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.prazoFabricacaoDiasUteis != null && (
                <p><span className="text-muted-foreground">Prazo de fabricação: </span>{data.prazoFabricacaoDiasUteis} dias úteis</p>
              )}
              {data.proposta.formasPagamento.length > 0 && (
                <p><span className="text-muted-foreground">Formas de pagamento: </span>{data.proposta.formasPagamento.join(", ")}</p>
              )}
              {data.proposta.condicaoPagamentoObs && (
                <p><span className="text-muted-foreground">Condições: </span>{data.proposta.condicaoPagamentoObs}</p>
              )}
              {parcelas.length > 0 && (
                <div className="pt-2">
                  <p className="text-muted-foreground mb-1">Parcelamento no cartão de crédito:</p>
                  <ul className="text-xs space-y-0.5">
                    {parcelas.map((p) => (
                      <li key={p.parcelas}>
                        {p.parcelas}x de {fmtBrl(p.valorParcela)}{p.jurosPct > 0 ? ` (com juros de ${p.jurosPct}%)` : " (sem juros)"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              gerarPdfProposta({
                clienteNome: data.proposta.clienteNome,
                vendedorNome: data.proposta.vendedorNome,
                createdAt: data.proposta.createdAt,
                itens: data.itens,
                valorTotal: data.valorTotal,
                prazoFabricacaoDiasUteis: data.prazoFabricacaoDiasUteis,
                formasPagamento: data.proposta.formasPagamento,
                condicaoPagamentoObs: data.proposta.condicaoPagamentoObs,
              })
            }
          >
            <FileDown className="w-4 h-4" /> Baixar PDF
          </Button>
          {data.condicoesComerciaisUrl && (
            <Button variant="outline" className="gap-1.5" asChild>
              <a href={data.condicoesComerciaisUrl} target="_blank" rel="noreferrer">
                <Download className="w-4 h-4" /> {data.condicoesComerciaisNome || "Condições comerciais"}
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
