"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign } from "lucide-react";
import { fmtBrl } from "@/lib/format";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export default function CotacoesExternasPage() {
  const [modalAberto, setModalAberto] = useState(false);

  const listarQuery = trpc.cotacoesExternas.listarFornecedores.useQuery(
    { limite: 50 }
  );

  const criarMutation = trpc.cotacoesExternas.criarFornecedor.useMutation({
    onSuccess: () => {
      toast.success("Cotação salva com sucesso");
      listarQuery.refetch();
      setModalAberto(false);
    },
    onError: (e) => toast.error("Erro ao salvar cotação", { description: e.message }),
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cotações Externas de Fornecedores"
        description="Cadastre cotações recebidas de qualquer fornecedor — incluindo empresas que ainda não trabalhamos — e compare os preços com o histórico de compras. Apoia a decisão de compra antes de emitir o orçamento."
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
          Nova Cotação Externa
        </Button>
      </div>

      {/* Listagem de cotações */}
      <Card>
        <CardHeader>
          <CardTitle>Cotações cadastradas</CardTitle>
          <CardDescription>
            Cada fornecedor pode ter vários itens cotados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {fornecedores.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhuma cotação externa cadastrada ainda.
                <br />
                Clique em "Nova Cotação Externa" para começar.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead className="text-right">Itens</TableHead>
                    <TableHead className="text-right">Preço unitário</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Data</TableHead>
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
                          {f.createdAt ? new Date(f.createdAt).toLocaleDateString("pt-BR") : "—"}
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

      {/* Modal Nova Cotação */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Cotação Externa</DialogTitle>
            <DialogDescription>
              Cadastre o fornecedor. Empresa nunca vista pode ser cadastrada
              normalmente.
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
                Os itens da cotação podem ser adicionados na tela de detalhes do
                fornecedor após o salvamento inicial.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={criarMutation.isPending}>
                {criarMutation.isPending ? "Salvando..." : "Salvar Cotação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
