import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtNum } from "@/lib/format";

type RegraImposto = { categoria: string; impostoPct: string };
type TaxaPagamento = { parcelas: string; jurosPct: string; custoFinanceiroPct: string };

export default function ParametrosDecupagem() {
  const utils = trpc.useUtils();
  const { data } = trpc.propostas.configuracoesObter.useQuery();
  const { data: vendedores } = trpc.propostas.vendedoresAdminListar.useQuery();
  const [impostoPct, setImpostoPct] = useState("0");
  const [custoFixoPct, setCustoFixoPct] = useState("0");
  const [regras, setRegras] = useState<RegraImposto[]>([]);
  const [taxas, setTaxas] = useState<TaxaPagamento[]>([]);
  const [nome, setNome] = useState("");
  const [comissao, setComissao] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    setImpostoPct(String(data.impostoPct));
    setCustoFixoPct(String(data.custoFixoPct));
    setRegras(data.impostosPorCategoria.map((item) => ({ categoria: item.categoria, impostoPct: String(item.impostoPct) })));
    setTaxas(data.jurosParcelamento.map((item) => ({ parcelas: String(item.parcelas), jurosPct: String(item.jurosPct), custoFinanceiroPct: String(item.custoFinanceiroPct) })));
  }, [data?.updatedAt]);

  const salvarParametros = trpc.propostas.configuracoesSalvar.useMutation({
    onSuccess: () => { toast.success("Parâmetros de precificação salvos"); utils.propostas.configuracoesObter.invalidate(); utils.propostas.opcoesPagamento.invalidate(); },
    onError: (error) => toast.error("Não foi possível salvar os parâmetros", { description: error.message }),
  });
  const salvarVendedor = trpc.propostas.vendedorSalvar.useMutation({
    onSuccess: () => { toast.success("Vendedor salvo"); setNome(""); setComissao(""); setEditandoId(null); utils.propostas.vendedoresAdminListar.invalidate(); utils.propostas.vendedoresAtivos.invalidate(); },
    onError: (error) => toast.error("Não foi possível salvar o vendedor", { description: error.message }),
  });
  const removerVendedor = trpc.propostas.vendedorRemover.useMutation({
    onSuccess: () => { toast.success("Vendedor removido"); utils.propostas.vendedoresAdminListar.invalidate(); utils.propostas.vendedoresAtivos.invalidate(); },
    onError: (error) => toast.error("Não foi possível remover o vendedor", { description: error.message }),
  });

  const salvarTudo = () => {
    if (!data) return;
    salvarParametros.mutate({
      condicoesComerciaisUrl: data.condicoesComerciaisUrl ?? undefined,
      condicoesComerciaisNome: data.condicoesComerciaisNome ?? undefined,
      jurosParcelamento: taxas.filter((item) => item.parcelas.trim()).map((item) => ({
        parcelas: Number(item.parcelas),
        jurosPct: Number(item.jurosPct) || 0,
        custoFinanceiroPct: Number(item.custoFinanceiroPct) || 0,
      })),
      impostoPct: Number(impostoPct) || 0,
      custoFixoPct: Number(custoFixoPct) || 0,
      impostosPorCategoria: regras.filter((item) => item.categoria.trim()).map((item) => ({
        categoria: item.categoria.trim(),
        impostoPct: Number(item.impostoPct) || 0,
      })),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impostos e custo fixo</CardTitle>
          <p className="text-xs text-muted-foreground">Taxas sobre o preço bruto de venda. Uma categoria configurada substitui o imposto padrão.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Imposto padrão (%)</Label><Input type="number" min="0" max="100" step="0.01" value={impostoPct} onChange={(event) => setImpostoPct(event.target.value)} /></div>
            <div className="space-y-1"><Label>Custo fixo / operacional rateado (%)</Label><Input type="number" min="0" max="100" step="0.01" value={custoFixoPct} onChange={(event) => setCustoFixoPct(event.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><p className="text-sm font-medium">Imposto por categoria</p><Button size="sm" variant="outline" onClick={() => setRegras((current) => [...current, { categoria: "", impostoPct: "0" }])}><Plus className="mr-1 h-3.5 w-3.5" /> Adicionar</Button></div>
            {regras.map((item, index) => <div key={index} className="flex items-center gap-2">
              <Input className="flex-1" placeholder="Nome da categoria do produto" value={item.categoria} onChange={(event) => setRegras((current) => current.map((rule, i) => i === index ? { ...rule, categoria: event.target.value } : rule))} />
              <Input className="w-28" type="number" min="0" max="100" step="0.01" aria-label="Imposto da categoria em percentual" value={item.impostoPct} onChange={(event) => setRegras((current) => current.map((rule, i) => i === index ? { ...rule, impostoPct: event.target.value } : rule))} />
              <span className="text-xs">%</span>
              <Button size="icon" variant="ghost" onClick={() => setRegras((current) => current.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>)}
          </div>
          <Button onClick={salvarTudo} disabled={salvarParametros.isPending}>{salvarParametros.isPending ? "Salvando…" : "Salvar taxas e custos"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Taxa financeira por parcelamento</CardTitle>
          <p className="text-xs text-muted-foreground">O custo financeiro interno é mantido separado dos juros apresentados ao cliente.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {taxas.map((item, index) => <div key={index} className="grid grid-cols-[5rem_1fr_1fr_auto] items-end gap-2">
            <div className="space-y-1"><Label className="text-xs">Parcelas</Label><Input type="number" min="1" step="1" value={item.parcelas} onChange={(event) => setTaxas((current) => current.map((rate, i) => i === index ? { ...rate, parcelas: event.target.value } : rate))} /></div>
            <div className="space-y-1"><Label className="text-xs">Juros ao cliente (%)</Label><Input type="number" min="0" max="100" step="0.01" value={item.jurosPct} onChange={(event) => setTaxas((current) => current.map((rate, i) => i === index ? { ...rate, jurosPct: event.target.value } : rate))} /></div>
            <div className="space-y-1"><Label className="text-xs">Custo financeiro (%)</Label><Input type="number" min="0" max="100" step="0.01" value={item.custoFinanceiroPct} onChange={(event) => setTaxas((current) => current.map((rate, i) => i === index ? { ...rate, custoFinanceiroPct: event.target.value } : rate))} /></div>
            <Button size="icon" variant="ghost" onClick={() => setTaxas((current) => current.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          </div>)}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setTaxas((current) => [...current, { parcelas: "", jurosPct: "0", custoFinanceiroPct: "0" }])}><Plus className="mr-1 h-3.5 w-3.5" /> Adicionar parcelamento</Button>
            <Button size="sm" onClick={salvarTudo} disabled={salvarParametros.isPending}>Salvar taxas financeiras</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Vendedores e comissões</CardTitle><p className="text-xs text-muted-foreground">O nome informado na proposta deve corresponder ao cadastro para associar a comissão.</p></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-52 flex-1 space-y-1"><Label>Nome do vendedor</Label><Input value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Mesmo nome usado na proposta" /></div>
            <div className="w-32 space-y-1"><Label>Comissão (%)</Label><Input type="number" min="0" max="100" step="0.01" value={comissao} onChange={(event) => setComissao(event.target.value)} /></div>
            <Button disabled={!nome.trim() || !comissao.trim() || salvarVendedor.isPending} onClick={() => salvarVendedor.mutate({ id: editandoId ?? undefined, nome: nome.trim(), comissaoPct: Number(comissao), ativo: true })}>{editandoId ? "Atualizar" : "Cadastrar"}</Button>
            {editandoId && <Button variant="ghost" onClick={() => { setEditandoId(null); setNome(""); setComissao(""); }}>Cancelar</Button>}
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Vendedor</TableHead><TableHead>Comissão</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{(vendedores ?? []).map((vendedor) => <TableRow key={vendedor.id}>
              <TableCell>{vendedor.nome}</TableCell><TableCell>{fmtNum(Number(vendedor.comissaoPct), 2)}%</TableCell><TableCell>{vendedor.ativo ? "Ativo" : "Inativo"}</TableCell>
              <TableCell className="text-right"><div className="flex justify-end gap-1">
                <Button size="sm" variant="outline" onClick={() => { setEditandoId(vendedor.id); setNome(vendedor.nome); setComissao(String(Number(vendedor.comissaoPct))); }}>Editar</Button>
                <Button size="icon" variant="ghost" aria-label="Remover vendedor" onClick={() => removerVendedor.mutate({ id: vendedor.id })}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
