"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import type { RouterOutputs } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, Edit, Trash2, Upload, Save, ExternalLink, ChevronRight } from "lucide-react";
import { fmtBrl, fmtNum } from "@/lib/format";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type FornecedorCotacao = NonNullable<
  RouterOutputs["cotacoesExternas"]["listarFornecedores"]
>[number];

type ItemCotacao = NonNullable<FornecedorCotacao["itens"]>[number];

interface ItemFormData {
  codigoFornecedor: string;
  descricao: string;
  unidade: string;
  precoUnitario: number;
  precoTotal: number | null;
  quantidade: number | null;
  dataCotacao: string;
  validadeDias: number | null;
  condicaoPagamento: string;
  prazoEntrega: string;
  arquivoOrigemUrl: string | null;
  materiaPrimaId: number | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function zerarItem(): ItemFormData {
  return {
    codigoFornecedor: "",
    descricao: "",
    unidade: "",
    precoUnitario: 0,
    precoTotal: null,
    quantidade: null,
    dataCotacao: "",
    validadeDias: null,
    condicaoPagamento: "",
    prazoEntrega: "",
    arquivoOrigemUrl: null,
    materiaPrimaId: null,
  };
}

function formatoDataBrasileira(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

/* ------------------------------------------------------------------ */
/* Componentes                                                        */
/* ------------------------------------------------------------------ */

export default function CotacoesExternasPage() {
  const [modalAberto, setModalAberto] = useState(false);
  const [detalheFornecedorId, setDetalheFornecedorId] = useState<number | null>(null);

  const listarQuery = trpc.cotacoesExternas.listarFornecedores.useQuery({
    limite: 50,
  });

  const fornecedores = listarQuery.data ?? [];
  const totalFornecedores = fornecedores.length;
  const fornecedoresNovos = fornecedores.filter((f) => !f.jaTrabalhamos).length;

  const todosItens = fornecedores.flatMap((f) =>
    (f.itens ?? []).map((item) => ({ ...item, fornecedor: f }))
  );

  const precoMinimo = todosItens.length
    ? Math.min(...todosItens.map((i) => i.precoUnitario))
    : 0;
  const precoMaximo = todosItens.length
    ? Math.max(...todosItens.map((i) => i.precoUnitario))
    : 0;

  const criarMutation = trpc.cotacoesExternas.criarFornecedor.useMutation({
    onSuccess: () => {
      toast.success("Fornecedor salvo com sucesso");
      listarQuery.refetch();
      setModalAberto(false);
    },
    onError: (e) => toast.error("Erro ao salvar fornecedor", { description: e.message }),
  });

  /* ---------- Detalhe do fornecedor (itens) ---------- */

  const detalheQuery = trpc.cotacoesExternas.detalheFornecedor.useQuery(
    { fornecedorId: detalheFornecedorId ?? 0 },
    { enabled: !!detalheFornecedorId }
  );

  const fornecedorDetalhe = detalheQuery.data?.fornecedor;
  const itensDetalhe = detalheQuery.data?.itens ?? [];

  const adicionarItemMutation = trpc.cotacoesExternas.adicionarItemCotacao.useMutation({
    onSuccess: () => {
      toast.success("Item adicionado à cotação");
      detalheQuery.refetch();
    },
    onError: (e) => toast.error("Erro ao adicionar item", { description: e.message }),
  });

  const atualizarItemMutation = trpc.cotacoesExternas.atualizarItemCotacao.useMutation({
    onSuccess: () => {
      toast.success("Item atualizado");
      detalheQuery.refetch();
    },
    onError: (e) => toast.error("Erro ao atualizar item", { description: e.message }),
  });

  const removerItemMutation = trpc.cotacoesExternas.removerItemCotacao.useMutation({
    onSuccess: () => {
      toast.success("Item removido");
      detalheQuery.refetch();
    },
    onError: (e) => toast.error("Erro ao remover item", { description: e.message }),
  });

  const uploadArquivoMutation = trpc.cotacoesExternas.uploadArquivoCotacao.useMutation({
    onSuccess: () => {
      toast.success("Anexo salvo");
      detalheQuery.refetch();
    },
    onError: (e) => toast.error("Erro ao salvar anexo", { description: e.message }),
  });

  const atualizarCustoMutation = trpc.cotacoesExternas.atualizarCustoMateriaPrima.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Custo de ${data.materiaPrimaId} atualizado de ${fmtBrl(data.custoAnterior ?? 0)} para ${fmtBrl(data.custoNovo)}`
      );
      detalheQuery.refetch();
      listarQuery.refetch();
    },
    onError: (e) => toast.error("Erro ao atualizar custo", { description: e.message }),
  });

  /* ---------- Estado local do modal de item ---------- */

  const [itemModalAberto, setItemModalAberto] = useState(false);
  const [itemEditando, setItemEditando] = useState<ItemCotacao | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormData>(zerarItem());

  const abrirNovoItem = () => {
    setItemEditando(null);
    setItemForm(zerarItem());
    setItemModalAberto(true);
  };

  const abrirEditarItem = (item: ItemCotacao) => {
    setItemEditando(item);
    setItemForm({
      codigoFornecedor: item.codigoFornecedor ?? "",
      descricao: item.descricao,
      unidade: item.unidade,
      precoUnitario: item.precoUnitario,
      precoTotal: item.precoTotal ?? null,
      quantidade: item.quantidade ?? null,
      dataCotacao: item.dataCotacao ?? "",
      validadeDias: item.validadeDias ?? null,
      condicaoPagamento: item.condicaoPagamento ?? "",
      prazoEntrega: item.prazoEntrega ?? "",
      arquivoOrigemUrl: item.arquivoOrigemUrl ?? null,
      materiaPrimaId: item.materiaPrimaId ?? null,
    });
    setItemModalAberto(true);
  };

  const salvarItem = () => {
    const payload = {
      codigoFornecedor: itemForm.codigoFornecedor || undefined,
      descricao: itemForm.descricao,
      unidade: itemForm.unidade,
      precoUnitario: itemForm.precoUnitario,
      precoTotal: itemForm.precoTotal,
      quantidade: itemForm.quantidade,
      dataCotacao: itemForm.dataCotacao || undefined,
      validadeDias: itemForm.validadeDias,
      condicaoPagamento: itemForm.condicaoPagamento || undefined,
      prazoEntrega: itemForm.prazoEntrega || undefined,
      arquivoOrigemUrl: itemForm.arquivoOrigemUrl,
      materiaPrimaId: itemForm.materiaPrimaId,
    };

    if (itemEditando) {
      atualizarItemMutation.mutate({ itemId: itemEditando.id, ...payload });
    } else if (detalheFornecedorId) {
      adicionarItemMutation.mutate({ fornecedorId: detalheFornecedorId, ...payload });
    }
    setItemModalAberto(false);
  };

  /* ---------- Upload de arquivo ---------- */

  const [uploadItemId, setUploadItemId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const iniciarUpload = (itemId: number) => {
    setUploadItemId(itemId);
    setUploadFile(null);
  };

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadFile(file);
  };

  const executarUpload = async () => {
    if (!uploadItemId || !uploadFile) return;
    try {
      const arrayBuffer = await uploadFile.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      await uploadArquivoMutation.mutateAsync({
        itemId: uploadItemId,
        fileName: uploadFile.name,
        contentType: uploadFile.type,
        data: base64,
      });
      setUploadItemId(null);
      setUploadFile(null);
    } catch {
      // erro tratado pelo toast da mutation
    }
  };

  /* ---------- Atualizar custo da MP ---------- */

  const [custoItemId, setCustoItemId] = useState<number | null>(null);
  const [custoCotacaoItemId, setCustoCotacaoItemId] = useState<number | null>(null);
  const [custoNovoValor, setCustoNovoValor] = useState("");
  const [custoUnidade, setCustoUnidade] = useState("");
  const [custoObservacao, setCustoObservacao] = useState("");
  const [custoConfirmarInconsistencia, setCustoConfirmarInconsistencia] = useState(false);
  const [custoInconsistenciaAviso, setCustoInconsistenciaAviso] = useState<string | null>(null);

  const abrirAtualizarCusto = (item: ItemCotacao) => {
    setCustoItemId(item.materiaPrimaId ?? null);
    setCustoCotacaoItemId(item.id);
    setCustoUnidade(item.materiaPrimaUnidadeMedida ?? item.unidade);
    setCustoNovoValor(item.precoUnitario.toString());
    setCustoObservacao("");
    setCustoConfirmarInconsistencia(false);
    setCustoInconsistenciaAviso(null);

    // Detecta antecipadamente inconsistências conhecidas para orientar o usuário.
    const custoMp = item.materiaPrimaCustoUnitario;
    const novo = Number(item.precoUnitario);
    if (custoMp != null && novo > custoMp && !item.observacao) {
      setCustoInconsistenciaAviso(
        `O novo preço (${fmtBrl(novo)}) é maior que o custo cadastrado no MubiSys (${fmtBrl(custoMp)}). Será exigida uma observação.`
      );
    }
    if (item.materiaPrimaId != null && item.materiaPrimaUnidadeMedida && item.materiaPrimaUnidadeMedida !== item.unidade) {
      setCustoInconsistenciaAviso(
        (custoInconsistenciaAviso ? custoInconsistenciaAviso + "\n" : "") +
        `A unidade do item (${item.unidade}) difere da unidade cadastrada na MP (${item.materiaPrimaUnidadeMedida}). Confirme para prosseguir.`
      );
    }
  };

  const salvarCusto = () => {
    if (!custoItemId || custoCotacaoItemId == null) return;
    atualizarCustoMutation.mutate({
      materiaPrimaId: custoItemId,
      cotacaoItemId: custoCotacaoItemId,
      custoNovo: Number(custoNovoValor),
      unidade: custoUnidade,
      observacao: custoObservacao || undefined,
      confirmarInconsistencia: custoConfirmarInconsistencia,
    });
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cotações Externas de Fornecedores"
        description="Cadastre cotações recebidas de qualquer fornecedor — incluindo empresas que ainda não trabalhamos — compare os preços com o custo cadastrado no MubiSys e use essas cotações para atualizar os valores desatualizados."
        icon={DollarSign}
      />

      {/* KPIs de topo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fornecedores cadastrados</CardTitle>
            <CardDescription className="text-xs">{totalFornecedores}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Total de fornecedores com cotações externas registradas.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas novas</CardTitle>
            <CardDescription className="text-xs">{fornecedoresNovos}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Fornecedores que ainda não aparecem no histórico de compras.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preço mínimo cotado</CardTitle>
            <CardDescription className="text-xs">
              {precoMinimo ? fmtBrl(precoMinimo) : "—"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Menor preço unitário entre as cotações registradas.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preço máximo cotado</CardTitle>
            <CardDescription className="text-xs">
              {precoMaximo ? fmtBrl(precoMaximo) : "—"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Maior preço unitário entre as cotações registradas.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Botão de nova cotação */}
      <div className="flex justify-end">
        <Button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Fornecedor / Cotação
        </Button>
      </div>

      {/* Listagem de cotações */}
      <Card>
        <CardHeader>
          <CardTitle>Cotações cadastradas</CardTitle>
          <CardDescription>
            Clique em um fornecedor para ver os itens da cotação, comparar com o
            custo cadastrado no MubiSys e atualizar valores desatualizados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {fornecedores.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum fornecedor cadastrado ainda.
                <br />
                Clique em "Novo Fornecedor / Cotação" para começar.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead className="text-right">Itens</TableHead>
                    <TableHead className="text-right">Menor preço</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Cadastro</TableHead>
                    <TableHead className="text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fornecedores.map((f) => {
                    const itens = f.itens ?? [];
                    const precos = itens.map((i) => i.precoUnitario);
                    const menor = precos.length ? Math.min(...precos) : 0;
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">
                          {f.nomeFantasia}
                          {!f.jaTrabalhamos && (
                            <Badge variant="secondary" className="ml-2">
                              Empresa nova
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {f.cnpj}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {itens.length}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {menor ? fmtBrl(menor) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={f.jaTrabalhamos ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {f.jaTrabalhamos ? "Já trabalhamos" : "Novo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {f.createdAt ? formatoDataBrasileira(f.createdAt) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            onClick={() => setDetalheFornecedorId(f.id)}
                            className="flex items-center gap-1"
                          >
                            Ver itens <ChevronRight className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---------- Modal Detalhe do Fornecedor ---------- */}
      <Dialog open={detalheFornecedorId != null} onOpenChange={(open) => {
        if (!open) setDetalheFornecedorId(null);
        setItemModalAberto(false);
      }}>
        <DialogContent className="sm:max-w-[900px] md:max-w-[1100px]">
          <DialogHeader>
            <DialogTitle>
              {fornecedorDetalhe?.nomeFantasia || "Detalhes da cotação"}
            </DialogTitle>
            <DialogDescription>
              {fornecedorDetalhe?.cnpj} • {!fornecedorDetalhe?.jaTrabalhamos ? "Empresa nova" : "Já trabalhamos"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-4">
            {detalheQuery.isLoading ? (
              <div className="text-muted-foreground text-sm">Carregando itens…</div>
            ) : fornecedorDetalhe ? (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Button
                    onClick={abrirNovoItem}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Adicionar item
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {itensDetalhe.length} item(ns) cotado(s)
                  </span>
                </div>

                {itensDetalhe.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    Nenhum item cadastrado nesta cotação.
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Preço unitário</TableHead>
                          <TableHead className="text-right">Preço total</TableHead>
                          <TableHead className="text-center">Qtd.</TableHead>
                          <TableHead className="text-center">Unidade</TableHead>
                          <TableHead className="text-right">Custo MubiSys</TableHead>
                          <TableHead className="text-right">Diferença</TableHead>
                          <TableHead className="text-center">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itensDetalhe.map((item) => {
                          const custoMp = item.materiaPrimaCustoUnitario;
                          const diferenca =
                            custoMp != null ? item.precoUnitario - custoMp : null;
                          const ehMaisBarato =
                            diferenca != null && custoMp != null && item.precoUnitario < custoMp;
                          const ehMaisCaro =
                            diferenca != null && custoMp != null && item.precoUnitario > custoMp;
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {item.descricao}
                                {item.codigoFornecedor && (
                                  <div className="text-xs text-muted-foreground">
                                    Código do fornecedor: {item.codigoFornecedor}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {fmtBrl(item.precoUnitario)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {item.precoTotal != null
                                  ? fmtBrl(item.precoTotal)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs">
                                {item.quantidade != null
                                  ? fmtNum(item.quantidade)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs">
                                {item.unidade}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {custoMp != null ? (
                                  fmtBrl(custoMp)
                                ) : (
                                  <span className="text-muted-foreground">
                                    não cadastrado
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {diferenca != null ? (
                                  <>
                                    {ehMaisBarato ? (
                                      <span className="text-foreground font-semibold">
                                        -{fmtBrl(Math.abs(diferenca))}
                                      </span>
                                    ) : ehMaisCaro ? (
                                      <span className="text-destructive">
                                        +{fmtBrl(diferenca)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        igual
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-col sm:flex-row gap-1 items-center">
                                  <Button
                                    size="sm"
                                    onClick={() => abrirEditarItem(item)}
                                    className="flex items-center gap-1 px-2 py-1.5 text-xs"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  {item.materiaPrimaId &&
                                    custoMp != null &&
                                    item.precoUnitario < custoMp && (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => {
                                          setCustoItemId(
                                            item.materiaPrimaId ?? null
                                          );
                                          setCustoUnidade(
                                            item.materiaPrimaUnidadeMedida ??
                                              item.unidade
                                          );
                                          setCustoNovoValor(
                                            item.precoUnitario.toString()
                                          );
                                          setCustoObservacao(
                                            `Atualizado via cotação externa do fornecedor "${fornecedorDetalhe.nomeFantasia}" (item ${item.id}: ${item.descricao}).`
                                          );
                                        }}
                                        className="flex items-center gap-1 px-2 py-1.5 text-xs"
                                      >
                                        Atualizar custo
                                      </Button>
                                    )}
                                  {item.arquivoOrigemUrl && (
                                    <Button
                                      size="sm"
                                      asChild
                                      className="flex items-center gap-1 px-2 py-1.5 text-xs"
                                    >
                                      <a
                                        href={item.arquivoOrigemUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </Button>
                                  )}
                                  {!item.arquivoOrigemUrl && (
                                    <Button
                                      size="sm"
                                      onClick={() => iniciarUpload(item.id)}
                                      className="flex items-center gap-1 px-2 py-1.5 text-xs"
                                    >
                                      <Upload className="w-3 h-3" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      removerItemMutation.mutate({
                                        itemId: item.id,
                                      })
                                    }
                                    className="flex items-center gap-1 px-2 py-1.5 text-xs"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground mb-2">
                        Comparativo: preço cotado pelo fornecedor vs. custo
                        unitário cadastrado no MubiSys
                        {" "}
                        {fornecedorDetalhe.nomeFantasia}. Quando o preço cotado
                        for menor que o custo cadastrado, o botão "Atualizar
                        custo" grava o novo valor no espelho local do MubiSys e
                        registra a mudança na auditoria.
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetalheFornecedorId(null)}
              disabled={detalheQuery.isLoading}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Modal Adicionar/Editar Item ---------- */}
      <Dialog open={itemModalAberto} onOpenChange={setItemModalAberto}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {itemEditando ? "Editar item da cotação" : "Novo item da cotação"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            salvarItem();
          }}>
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Descrição <span className="text-destructive">*</span></Label>
                  <Input
                    name="descricao"
                    value={itemForm.descricao}
                    onChange={(e) => setItemForm({ ...itemForm, descricao: e.target.value })}
                    className="w-full text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unidade <span className="text-destructive">*</span></Label>
                  <Input
                    name="unidade"
                    value={itemForm.unidade}
                    onChange={(e) => setItemForm({ ...itemForm, unidade: e.target.value })}
                    className="w-full text-sm"
                    placeholder="ex: KG, M2, UN"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código do fornecedor</Label>
                  <Input
                    name="codigoFornecedor"
                    value={itemForm.codigoFornecedor}
                    onChange={(e) => setItemForm({ ...itemForm, codigoFornecedor: e.target.value })}
                    className="w-full text-sm"
                    placeholder="ex: SKU-1234"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço unitário <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    name="precoUnitario"
                    value={itemForm.precoUnitario}
                    onChange={(e) => setItemForm({ ...itemForm, precoUnitario: Number(e.target.value) || 0 })}
                    className="w-full text-sm"
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    name="quantidade"
                    value={itemForm.quantidade ?? ""}
                    onChange={(e) => setItemForm({ ...itemForm, quantidade: e.target.value ? Number(e.target.value) : null })}
                    className="w-full text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço total</Label>
                  <Input
                    type="number"
                    name="precoTotal"
                    value={itemForm.precoTotal ?? ""}
                    onChange={(e) => setItemForm({ ...itemForm, precoTotal: e.target.value ? Number(e.target.value) : null })}
                    className="w-full text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data da cotação</Label>
                  <Input
                    type="date"
                    name="dataCotacao"
                    value={itemForm.dataCotacao}
                    onChange={(e) => setItemForm({ ...itemForm, dataCotacao: e.target.value })}
                    className="w-full text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Validade (dias)</Label>
                  <Input
                    type="number"
                    name="validadeDias"
                    value={itemForm.validadeDias ?? ""}
                    onChange={(e) => setItemForm({ ...itemForm, validadeDias: e.target.value ? Number(e.target.value) : null })}
                    className="w-full text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Condição de pagamento</Label>
                <Input
                  name="condicaoPagamento"
                  value={itemForm.condicaoPagamento}
                  onChange={(e) => setItemForm({ ...itemForm, condicaoPagamento: e.target.value })}
                  className="w-full text-sm"
                  placeholder="ex: 30 dias"
                />
              </div>
              <div className="space-y-2">
                <Label>Prazo de entrega</Label>
                <Input
                  name="prazoEntrega"
                  value={itemForm.prazoEntrega}
                  onChange={(e) => setItemForm({ ...itemForm, prazoEntrega: e.target.value })}
                  className="w-full text-sm"
                  placeholder="ex: 7 dias úteis"
                />
              </div>
              <div className="space-y-2">
                <Label>Vincular matéria-prima (para comparar com MubiSys)</Label>
                <Input
                  name="materiaPrimaId"
                  type="number"
                  value={itemForm.materiaPrimaId ?? ""}
                  onChange={(e) => setItemForm({ ...itemForm, materiaPrimaId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full text-sm"
                  placeholder="ID da matéria-prima"
                />
                <p className="text-xs text-muted-foreground">
                  Informe o ID da matéria-prima cadastrada no MubiSys para ativar a comparação de
                  preço e a atualização de custo.
                </p>
              </div>
              <div className="space-y-2">
                <Label>URL do arquivo de origem (anexo)</Label>
                <Input
                  name="arquivoOrigemUrl"
                  value={itemForm.arquivoOrigemUrl ?? ""}
                  onChange={(e) => setItemForm({ ...itemForm, arquivoOrigemUrl: e.target.value })}
                  className="w-full text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setItemModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={adicionarItemMutation.isPending || atualizarItemMutation.isPending}>
                {adicionarItemMutation.isPending || atualizarItemMutation.isPending ? "Salvando…" : "Salvar item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- Modal Upload de arquivo ---------- */}
      <Dialog open={uploadItemId != null} onOpenChange={(open) => {
        if (!open) setUploadItemId(null);
        setUploadFile(null);
      }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Anexar arquivo da cotação</DialogTitle>
            <DialogDescription>
              Selecione o arquivo (PDF, imagem ou planilha) que serve de origem desta cotação.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <Label>Arquivo</Label>
            <input type="file" onChange={handleUploadChange} className="block w-full text-sm text-muted-foreground" />
            {uploadFile && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {uploadFile.name} • {fmtNum(uploadFile.size / 1024)} KB
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUploadItemId(null)}>
              Cancelar
            </Button>
            <Button
              onClick={executarUpload}
              disabled={uploadArquivoMutation.isPending || !uploadFile}
            >
              {uploadArquivoMutation.isPending ? "Anexando…" : "Anexar arquivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Modal Atualizar custo MubiSys ---------- */}
      <Dialog open={custoItemId != null} onOpenChange={(open) => {
        if (!open) setCustoItemId(null);
        setCustoNovoValor("");
        setCustoObservacao("");
      }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Atualizar custo no MubiSys</DialogTitle>
            <DialogDescription>
              O novo custo será gravado no espelho local da matéria-prima e registrado na auditoria.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            salvarCusto();
          }}>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>Novo custo unitário <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  value={custoNovoValor}
                  onChange={(e) => setCustoNovoValor(e.target.value)}
                  className="w-full text-sm"
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Unidade <span className="text-destructive">*</span></Label>
                <Input
                  value={custoUnidade}
                  onChange={(e) => setCustoUnidade(e.target.value)}
                  className="w-full text-sm"
                  placeholder="ex: KG, M2, UN"
                />
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea
                  value={custoObservacao}
                  onChange={(e) => setCustoObservacao(e.target.value)}
                  rows={2}
                  className="w-full text-sm"
                  placeholder="Motivo da atualização de custo…"
                />
              </div>
              {custoInconsistenciaAviso && (
                <div className="p-3 rounded border border-amber-200 bg-amber-50 text-amber-800 text-xs">
                  {custoInconsistenciaAviso.split("\n").map((linha, i) => (
                    <> {linha} <br /> </>
                  ))}
                  {!custoConfirmarInconsistencia && (
                    <span className="block mt-1 text-amber-600 font-semibold">
                      Confirme abaixo para prosseguir mesmo com essas inconsistências.
                    </span>
                  )}
                </div>
              )}
              {custoInconsistenciaAviso && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={!!custoConfirmarInconsistencia}
                    onCheckedChange={(v) => setCustoConfirmarInconsistencia(!!v)}
                  />
                  <Label className="text-sm">
                    Confirmo que quero sobrescrever as inconsistências acima
                  </Label>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Somente gestores e administradores podem atualizar o custo cadastrado no MubiSys.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCustoItemId(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  atualizarCustoMutation.isPending ||
                  (!!custoInconsistenciaAviso && !custoConfirmarInconsistencia)
                }
              >
                {atualizarCustoMutation.isPending ? "Atualizando…" : "Atualizar custo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- Modal Novo Fornecedor ---------- */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Fornecedor / Cotação</DialogTitle>
            <DialogDescription>
              Cadastre o fornecedor. Empresa nunca vista pode ser cadastrada normalmente.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const cnpj = formData.get("cnpj") as string;
              const nomeFantasia = formData.get("nomeFantasia") as string;
              if (!cnpj || !nomeFantasia) {
                toast.error("CNPJ e Nome Fantasia são obrigatórios");
                return;
              }
              criarMutation.mutate({
                cnpj,
                nomeFantasia,
                razaoSocial: (formData.get("razaoSocial") as string) || null,
                telefone: (formData.get("telefone") as string) || null,
                email: (formData.get("email") as string) || null,
                cidade: (formData.get("cidade") as string) || null,
                estado: (formData.get("estado") as string) || null,
                observacoes: (formData.get("observacoes") as string) || null,
                jaTrabalhamos: (formData.get("jaTrabalhamos") as string) === "true",
                itens: [],
              });
            }}
          >
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>CNPJ <span className="text-destructive">*</span></Label>
                  <Input name="cnpj" placeholder="00.000.000/0000-00" className="w-full text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Nome Fantasia <span className="text-destructive">*</span></Label>
                  <Input name="nomeFantasia" placeholder="Nome da empresa" className="w-full text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Razão Social</Label>
                  <Input name="razaoSocial" placeholder="Razão social completa" className="w-full text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input name="telefone" placeholder="(11) 99999-9999" className="w-full text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input name="email" type="email" placeholder="contato@empresa.com.br" className="w-full text-sm" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox name="jaTrabalhamos" defaultChecked={false} value="true" />
                    <Label className="text-xs">Já trabalhamos com este fornecedor</Label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea name="observacoes" rows={2} placeholder="Observações sobre este fornecedor..." className="w-full text-sm" />
              </div>
              <p className="text-xs text-muted-foreground">
                Após salvar, clique em "Ver itens" para adicionar os itens da cotação, comparar
                com o custo do MubiSys e atualizar valores desatualizados.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={criarMutation.isPending}>
                {criarMutation.isPending ? "Salvando..." : "Salvar Fornecedor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
