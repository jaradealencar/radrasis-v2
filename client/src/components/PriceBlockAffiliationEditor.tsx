import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type CatalogProduct = RouterOutputs["produtos"]["buscarMubisys"][number];
type AffiliatedProduct = {
  mubisysProdutoId: number;
  nomeProduto: string;
  categoria: string | null;
  mubisysModeloIds: number[] | null;
  modelos: Array<{ id: number; nome: string }>;
};

export function PriceBlockAffiliationEditor({
  open,
  onOpenChange,
  principalSectionId,
  sectionTitle,
  produtosAtuais,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  principalSectionId: number;
  sectionTitle: string;
  produtosAtuais: AffiliatedProduct[];
}) {
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] =
    useState<AffiliatedProduct[]>(produtosAtuais);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const utils = trpc.useUtils();
  const { data: resultados = [], isFetching } =
    trpc.produtos.buscarMubisys.useQuery(
      { busca },
      { enabled: open, staleTime: 15_000 }
    );
  const modelosPorProduto = useMemo(
    () => new Map(resultados.map(produto => [produto.id, produto.modelos])),
    [resultados]
  );
  const salvar = trpc.price.replaceBlockProducts.useMutation({
    onSuccess: async () => {
      await utils.price.listBlockAffiliations.invalidate();
      toast.success(
        "Produtos e modelos do bloco atualizados nas duas tabelas."
      );
      onOpenChange(false);
    },
    onError: error =>
      toast.error(error.message || "Não foi possível salvar os produtos."),
  });
  useEffect(() => {
    if (open) {
      setSelecionados(produtosAtuais);
      setExpandidos(new Set());
    }
  }, [open, principalSectionId, produtosAtuais]);

  function obter(produto: CatalogProduct) {
    return selecionados.find(item => item.mubisysProdutoId === produto.id);
  }
  function alternarProduto(produto: CatalogProduct) {
    setSelecionados(atuais => {
      const existente = atuais.find(
        item => item.mubisysProdutoId === produto.id
      );
      if (existente?.mubisysModeloIds == null && existente)
        return atuais.filter(item => item.mubisysProdutoId !== produto.id);
      if (existente)
        return atuais.map(item => item.mubisysProdutoId === produto.id
          ? { ...item, mubisysModeloIds: null, modelos: produto.modelos }
          : item);
      return [
        ...atuais,
        {
          mubisysProdutoId: produto.id,
          nomeProduto: produto.nome,
          categoria: produto.categoria || null,
          mubisysModeloIds: null,
          modelos: produto.modelos,
        },
      ];
    });
  }
  function alternarModelo(produto: CatalogProduct, modeloId: number) {
    setSelecionados(atuais => {
      const existente = atuais.find(
        item => item.mubisysProdutoId === produto.id
      );
      const ids =
        existente?.mubisysModeloIds == null
          ? []
          : [...existente.mubisysModeloIds];
      const novosIds = ids.includes(modeloId)
        ? ids.filter(id => id !== modeloId)
        : [...ids, modeloId];
      const semProduto = atuais.filter(
        item => item.mubisysProdutoId !== produto.id
      );
      if (novosIds.length === 0) return semProduto;
      return [
        ...semProduto,
        {
          mubisysProdutoId: produto.id,
          nomeProduto: produto.nome,
          categoria: produto.categoria || null,
          mubisysModeloIds: novosIds,
          modelos: produto.modelos,
        },
      ];
    });
  }
  function remover(id: number) {
    setSelecionados(atuais =>
      atuais.filter(item => item.mubisysProdutoId !== id)
    );
  }
  function nomesSelecionados(item: AffiliatedProduct) {
    if (item.mubisysModeloIds == null) return "Todos os modelos";
    const modelos = item.modelos.length
      ? item.modelos
      : (modelosPorProduto.get(item.mubisysProdutoId) ?? []);
    const nomes = item.mubisysModeloIds
      .map(id => modelos.find(modelo => modelo.id === id)?.nome)
      .filter(Boolean);
    return nomes.length
      ? nomes.join(", ")
      : `${item.mubisysModeloIds.length} modelo(s)`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Produtos e modelos atendidos pelo bloco</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">
          {sectionTitle}. Escolha o produto inteiro ou expanda para selecionar
          modelos específicos. A seleção é compartilhada com o bloco
          correspondente de Novo Cliente.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={busca}
            onChange={event => setBusca(event.target.value)}
            placeholder="Buscar produto no catálogo MubiSys"
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="max-h-80 overflow-y-auto rounded-md border">
          {isFetching && resultados.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Buscando produtos...
            </div>
          ) : resultados.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              Nenhum produto encontrado.
            </p>
          ) : (
            resultados.map(produto => {
              const afiliado = obter(produto);
              const todos = afiliado?.mubisysModeloIds == null && !!afiliado;
              const parcial = !!afiliado && !todos;
              const aberto = expandidos.has(produto.id);
              return (
                <div key={produto.id} className="border-b last:border-b-0">
                  <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                    <button
                      type="button"
                      onClick={() => alternarProduto(produto)}
                      aria-label={
                        todos
                          ? `Remover ${produto.nome}`
                          : `Selecionar todos os modelos de ${produto.nome}`
                      }
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${todos ? "border-blue-600 bg-blue-600 text-white" : parcial ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300"}`}
                    >
                      {todos ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : parcial ? (
                        <span className="h-0.5 w-2.5 rounded bg-blue-600" />
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => alternarProduto(produto)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium">
                        {produto.nome}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {produto.categoria || "Sem categoria"} · ID MubiSys{" "}
                        {produto.id}
                        {produto.modelos.length
                          ? ` · ${produto.modelos.length} modelo(s)`
                          : ""}
                      </span>
                    </button>
                    {todos && (
                      <Badge variant="secondary">Todos os modelos</Badge>
                    )}
                    {parcial && (
                      <Badge variant="secondary">
                        {afiliado.mubisysModeloIds?.length ?? 0} modelo(s)
                      </Badge>
                    )}
                    {produto.modelos.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandidos(atual => {
                            const proximo = new Set(atual);
                            proximo.has(produto.id)
                              ? proximo.delete(produto.id)
                              : proximo.add(produto.id);
                            return proximo;
                          })
                        }
                        aria-label={aberto ? "Recolher modelos" : "Ver modelos"}
                        className="rounded p-1 text-slate-500 hover:bg-slate-200"
                      >
                        {aberto ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                  {aberto && (
                    <div className="space-y-1 border-t bg-slate-50 px-4 py-2 pl-12">
                      <p className="pb-1 text-xs text-slate-500">
                        Marque modelos individuais ou selecione o produto para
                        incluir todos.
                      </p>
                      {produto.modelos.map(modelo => {
                        const marcado =
                          todos ||
                          !!afiliado?.mubisysModeloIds?.includes(modelo.id);
                        return (
                          <button
                            key={modelo.id}
                            type="button"
                            onClick={() => alternarModelo(produto, modelo.id)}
                            disabled={todos}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${marcado ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}
                            >
                              {marcado && <Check className="h-3 w-3" />}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {modelo.nome}
                            </span>
                            <span className="text-xs text-slate-400">
                              ID {modelo.id}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Selecionados ({selecionados.length})
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelecionados([])}
              disabled={!selecionados.length}
            >
              Limpar
            </Button>
          </div>
          {selecionados.length > 0 && (
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {selecionados.map(item => (
                <Badge
                  key={item.mubisysProdutoId}
                  variant="outline"
                  className="max-w-full gap-1"
                >
                  <span className="truncate">
                    {item.nomeProduto} · {nomesSelecionados(item)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remover(item.mubisysProdutoId)}
                    aria-label={`Remover ${item.nomeProduto}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() =>
              salvar.mutate({
                principalSectionId,
                produtos: selecionados.map(
                  ({ modelos: _modelos, ...item }) => item
                ),
              })
            }
            disabled={salvar.isPending}
          >
            {salvar.isPending ? "Salvando..." : "Salvar produtos"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
