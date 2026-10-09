import { useMemo, useState } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Save, Link2, Hammer } from "lucide-react";
import { toast } from "sonner";
import type { ConfigItem, MarginRow } from "@shared/price-table";

type Tabela = "principal" | "novo_cliente";
type Catalogo = RouterOutputs["price"]["listModelCatalog"];
type Mapping = Catalogo["mapeamentos"][number];
type Secao = { id: number; page: number; sectionTitle: string; contentJson: string };
type Faixa = { id: number; rotulo: string; secao: string };

function extrairFaixas(secoes: Secao[], tabela: Tabela): Faixa[] {
  const paginas = tabela === "principal" ? [1, 2, 3] : [11, 12, 13];
  const faixas: Faixa[] = [];
  for (const secao of secoes.filter(item => paginas.includes(item.page))) {
    try {
      const conteudo = JSON.parse(secao.contentJson) as { type?: string; rows?: MarginRow[]; items?: ConfigItem[] | string[] };
      if (conteudo.type === "margin_table" || conteudo.type === "margin_table_multi") {
        for (const linha of conteudo.rows ?? []) if (linha.id > 0) faixas.push({ id: linha.id, rotulo: linha.label, secao: secao.sectionTitle });
      } else if (conteudo.type === "config") {
        for (const item of (conteudo.items ?? []) as ConfigItem[]) if (typeof item === "object" && item.id > 0) faixas.push({ id: item.id, rotulo: item.label, secao: secao.sectionTitle });
      }
    } catch { /* ignora seção com JSON inválido */ }
  }
  return faixas;
}

export function PriceTableModelMappings({ tabela, secoes, podeEditar }: { tabela: Tabela; secoes: Secao[]; podeEditar: boolean }) {
  const [busca, setBusca] = useState("");
  const { data, isLoading, error } = trpc.price.listModelCatalog.useQuery(undefined, { staleTime: 60_000 });
  const utils = trpc.useUtils();
  const salvar = trpc.price.saveModelMapping.useMutation({
    onSuccess: async () => { await utils.price.listModelCatalog.invalidate(); toast.success("Vínculo do modelo atualizado."); },
    onError: erro => toast.error(erro.message),
  });
  const faixas = useMemo(() => extrairFaixas(secoes, tabela), [secoes, tabela]);
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const produtos = (data?.produtos ?? []).map(produto => ({
    ...produto,
    modelos: produto.modelos.filter(modelo => !termo || `${produto.nome} ${modelo.nome} ${produto.id} ${modelo.id}`.toLocaleLowerCase("pt-BR").includes(termo)),
  })).filter(produto => produto.modelos.length > 0);
  const mapa = new Map((data?.mapeamentos ?? []).map(item => [`${item.mubisysProdutoId}_${item.mubisysModeloId}`, item]));
  const nomeProdutividade = new Map((data?.produtividades ?? []).map(item => [item.id, item.nome]));
  const totalModelos = (data?.produtos ?? []).reduce((total, produto) => total + produto.modelos.length, 0);

  function salvarModelo(produtoId: number, modeloId: number, priceId: number | null, produtividadeIds: number[]) {
    salvar.mutate({ produtoId, modeloId, tabela, priceId, produtividadeIds });
  }

  if (isLoading) return <div className="h-40 animate-pulse rounded-lg bg-slate-100" />;
  if (error) return <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar os produtos e modelos: {error.message}</p>;

  return <Card>
    <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-blue-600" />Modelos, solda e faixas de preço</CardTitle>
        <p className="mt-1 text-sm text-slate-500">{totalModelos} modelos do catálogo MubiSys. Os vínculos de produtividade são compartilhados pelas duas tabelas; a faixa é salva separadamente para {tabela === "principal" ? "clientes antigos" : "novos clientes"}.</p>
      </div>
      <Badge variant="secondary">{tabela === "principal" ? "Clientes Antigos" : "Novo Cliente"}</Badge>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex items-center gap-2 rounded-md border bg-slate-50 px-3"><Search className="h-4 w-4 shrink-0 text-slate-400" /><Input className="border-0 bg-transparent shadow-none focus-visible:ring-0" placeholder="Buscar produto ou modelo" value={busca} onChange={event => setBusca(event.target.value)} /></div>
      {faixas.length === 0 && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Nenhuma faixa com ID foi encontrada nas páginas de preço desta tabela. Cadastre as faixas antes de vinculá-las.</p>}
      {produtos.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Nenhum modelo corresponde à busca.</p> : <div className="space-y-5">
        {produtos.map(produto => <section key={produto.id} className="overflow-hidden rounded-lg border">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3"><div className="font-medium text-slate-900">{produto.nome}</div><span className="text-xs text-slate-500">{produto.modelos.length} modelo(s) · ID {produto.id}</span></div>
          <div className="divide-y">
            {produto.modelos.map(modelo => {
              const existente = mapa.get(`${produto.id}_${modelo.id}`) as Mapping | undefined;
              const vinculados = existente?.produtividadeIds ?? [];
              const priceId = tabela === "principal" ? existente?.principalPriceId : existente?.novoClientePriceId;
              const listaProdutividades = vinculados.map(id => nomeProdutividade.get(id) ?? `Produtividade ${id}`).join(", ");
              return <ModeloRow key={modelo.id} modeloId={modelo.id} modeloNome={modelo.nome} produtividades={data?.produtividades ?? []} vinculados={vinculados} listaProdutividades={listaProdutividades} priceId={priceId ?? null} faixas={faixas} podeEditar={podeEditar} salvando={salvar.isPending} aoSalvar={(ids, id) => salvarModelo(produto.id, modelo.id, id, ids)} />;
            })}
          </div>
        </section>)}
      </div>}
      {!podeEditar && <p className="text-xs text-slate-500">Edição disponível para gestor, admin ou master.</p>}
    </CardContent>
  </Card>;
}

function ModeloRow({ modeloId, modeloNome, produtividades, vinculados, listaProdutividades, priceId, faixas, podeEditar, salvando, aoSalvar }: {
  modeloId: number; modeloNome: string; produtividades: Catalogo["produtividades"]; vinculados: number[]; listaProdutividades: string; priceId: number | null; faixas: Faixa[]; podeEditar: boolean; salvando: boolean; aoSalvar: (ids: number[], priceId: number | null) => void;
}) {
  const [selecionadas, setSelecionadas] = useState<number[]>(vinculados);
  const [idsAnteriores, setIdsAnteriores] = useState(vinculados.join(","));
  const faixaAnterior = priceId == null ? "" : String(priceId);
  const [faixaAtual, setFaixaAtual] = useState(faixaAnterior);
  const [faixaBase, setFaixaBase] = useState(faixaAnterior);
  if (idsAnteriores !== vinculados.join(",")) { setIdsAnteriores(vinculados.join(",")); setSelecionadas(vinculados); }
  if (faixaBase !== faixaAnterior) { setFaixaBase(faixaAnterior); setFaixaAtual(faixaAnterior); }
  const sujo = selecionadas.join(",") !== vinculados.join(",") || faixaAtual !== faixaAnterior;
  return <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(150px,0.8fr)_minmax(240px,1.2fr)_minmax(240px,1.2fr)_auto] lg:items-center">
    <div><div className="font-medium text-sm">{modeloNome}</div><div className="text-xs text-slate-400">Modelo {modeloId}</div></div>
    <label className="space-y-1 text-xs text-slate-500"><span className="flex items-center gap-1"><Hammer className="h-3 w-3" />Produtividades da pág. 5</span>
      <select aria-label={`Produtividades de solda de ${modeloNome}`} multiple size={Math.min(4, Math.max(2, produtividades.length))} disabled={!podeEditar} value={selecionadas.map(String)} onChange={event => setSelecionadas(Array.from(event.currentTarget.selectedOptions, option => Number(option.value)))} className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm disabled:bg-slate-50">
        {produtividades.map(item => <option key={item.id} value={item.id}>{item.nome} · ID {item.id}</option>)}
      </select><span>Selecione várias com Ctrl ou Command. {vinculados.length ? `Salvas: ${listaProdutividades}` : "Nenhuma produtividade vinculada."}</span>
    </label>
    <label className="space-y-1 text-xs text-slate-500"><span>Faixa de preço · ID</span>
      <select aria-label={`Faixa de preço de ${modeloNome}`} disabled={!podeEditar} value={faixaAtual} onChange={event => setFaixaAtual(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm disabled:bg-slate-50">
        <option value="">Sem vínculo</option>{faixas.map(faixa => <option key={`${faixa.id}-${faixa.secao}`} value={faixa.id}>ID {faixa.id} · {faixa.secao} · {faixa.rotulo}</option>)}
      </select>
    </label>
    <Button size="sm" variant="outline" disabled={!podeEditar || !sujo || salvando} onClick={() => { aoSalvar(selecionadas, faixaAtual ? Number(faixaAtual) : null); }}><Save className="mr-1 h-3.5 w-3.5" />Salvar</Button>
  </div>;
}