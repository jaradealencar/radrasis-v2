import { useEffect, useState } from "react";
import { Check, LoaderCircle, Search, X } from "lucide-react";
import { toast } from "sonner";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type CatalogProduct = RouterOutputs["produtos"]["buscarMubisys"][number];
type AffiliatedProduct = { mubisysProdutoId: number; nomeProduto: string; categoria: string | null };

export function PriceBlockAffiliationEditor({ open, onOpenChange, principalSectionId, sectionTitle, produtosAtuais }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  principalSectionId: number;
  sectionTitle: string;
  produtosAtuais: AffiliatedProduct[];
}) {
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<AffiliatedProduct[]>(produtosAtuais);
  const utils = trpc.useUtils();
  const { data: resultados = [], isFetching } = trpc.produtos.buscarMubisys.useQuery({ busca }, { enabled: open, staleTime: 15_000 });
  const salvar = trpc.price.replaceBlockProducts.useMutation({
    onSuccess: async () => {
      await utils.price.listBlockAffiliations.invalidate();
      toast.success("Produtos do bloco atualizados nas duas tabelas.");
      onOpenChange(false);
    },
    onError: error => toast.error(error.message || "Nao foi possivel salvar os produtos."),
  });
  useEffect(() => { if (open) setSelecionados(produtosAtuais); }, [open, principalSectionId, produtosAtuais]);

  function alternar(produto: CatalogProduct) {
    setSelecionados(atuais => atuais.some(item => item.mubisysProdutoId === produto.id)
      ? atuais.filter(item => item.mubisysProdutoId !== produto.id)
      : [...atuais, { mubisysProdutoId: produto.id, nomeProduto: produto.nome, categoria: produto.categoria || null }]);
  }
  function remover(id: number) { setSelecionados(atuais => atuais.filter(item => item.mubisysProdutoId !== id)); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Produtos atendidos pelo bloco</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-600">{sectionTitle}. A seleção é compartilhada com o bloco correspondente de Novo Cliente.</p>
        <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar produto no catálogo MubiSys" className="pl-9" autoFocus /></div>
        <div className="max-h-72 overflow-y-auto rounded-md border">
          {isFetching && resultados.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Buscando produtos...</div>
          ) : resultados.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">Nenhum produto encontrado.</p>
          ) : resultados.map(produto => {
            const marcado = selecionados.some(item => item.mubisysProdutoId === produto.id);
            return <button key={produto.id} type="button" onClick={() => alternar(produto)} className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50">
              <span className={"flex h-5 w-5 shrink-0 items-center justify-center rounded border " + (marcado ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300")}>{marcado && <Check className="h-3.5 w-3.5" />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{produto.nome}</span><span className="block truncate text-xs text-slate-500">{produto.categoria || "Sem categoria"} · ID MubiSys {produto.id}</span></span>
              {marcado && <Badge variant="secondary">Selecionado</Badge>}
            </button>;
          })}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><p className="text-sm font-medium">Selecionados ({selecionados.length})</p><Button type="button" variant="ghost" size="sm" onClick={() => setSelecionados([])} disabled={!selecionados.length}>Limpar</Button></div>
          {selecionados.length > 0 && <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">{selecionados.map(item => <Badge key={item.mubisysProdutoId} variant="outline" className="gap-1">{item.nomeProduto}<button type="button" onClick={() => remover(item.mubisysProdutoId)} aria-label={"Remover " + item.nomeProduto}><X className="h-3 w-3" /></button></Badge>)}</div>}
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" onClick={() => salvar.mutate({ principalSectionId, produtos: selecionados })} disabled={salvar.isPending}>{salvar.isPending ? "Salvando..." : "Salvar produtos"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
