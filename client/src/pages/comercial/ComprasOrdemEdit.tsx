import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { fmtBrl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import {
  compradorSchema,
  editarOrdemCompraSchema,
  type CompradorCompra,
} from "@shared/compras-cotacoes";

export type CompraOrdemRegistro =
  RouterOutputs["compras"]["listarOrdens"][number];
type Cotacao = RouterOutputs["compras"]["obterCotacao"];
type TipoComprador = "empresa" | "pessoa";

const classeSelect = "w-full rounded-md border bg-white px-2 py-2 text-xs";
const numero = (valor: string) => {
  if (!valor.trim()) return null;
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function Campo({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <label className="min-w-0 space-y-1 text-xs">
      <span className="block text-slate-500">{titulo}</span>
      {children}
    </label>
  );
}

export function EditarOrdemModal({
  registro,
  fechar,
}: {
  registro: CompraOrdemRegistro | null;
  fechar: () => void;
}) {
  const frete = trpc.compras.obterOrdemFrete.useQuery(
    { id: registro?.ordem.id ?? 0 },
    { enabled: registro != null, staleTime: 0 }
  );
  const cotacao = trpc.compras.obterCotacao.useQuery(
    { id: registro?.ordem.cotacaoId ?? 0 },
    { enabled: registro != null }
  );

  return (
    <Dialog
      open={registro != null}
      onOpenChange={aberto => {
        if (!aberto) fechar();
      }}
    >
      <DialogContent className="!max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ordem de compra OC-{registro?.ordem.id}</DialogTitle>
        </DialogHeader>
        {!registro || frete.isLoading || cotacao.isLoading ? (
          <Spinner />
        ) : frete.error || cotacao.error ? (
          <p className="text-red-600">
            {frete.error?.message ?? cotacao.error?.message}
          </p>
        ) : frete.data && cotacao.data ? (
          <EditorSalva
            key={`${registro.ordem.id}-${registro.ordem.createdAt}`}
            registro={registro}
            ordem={frete.data.ordem}
            cotacao={cotacao.data}
            temNf={frete.data.vinculadas.length > 0}
            fechar={fechar}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditorSalva({
  registro,
  ordem,
  cotacao,
  temNf,
  fechar,
}: {
  registro: CompraOrdemRegistro;
  ordem: CompraOrdemRegistro["ordem"];
  cotacao: Cotacao;
  temNf: boolean;
  fechar: () => void;
}) {
  const utils = trpc.useUtils();
  const salvar = trpc.compras.editarOrdem.useMutation();
  const [nomeComprador, setNomeComprador] = useState(ordem.nomeComprador ?? "");
  const [comprador, setComprador] = useState<CompradorCompra>(ordem.comprador);
  const [tipo, setTipo] = useState<TipoComprador>(ordem.comprador.tipo);
  const [pagamento, setPagamento] = useState<"a_vista" | "faturado">(
    ordem.pagamento as "a_vista" | "faturado"
  );
  const [condicao, setCondicao] = useState(ordem.condicaoPagamento);
  const [observacoes, setObservacoes] = useState(ordem.observacoes);
  const itensOrdem = new Map(ordem.itens.map(item => [item.itemId, item]));
  const [incluidos, setIncluidos] = useState<Set<number>>(
    new Set(ordem.itens.map(item => item.itemId))
  );
  const [quantidades, setQuantidades] = useState<Record<number, string>>(
    Object.fromEntries(
      cotacao.itens.map(item => [
        item.id,
        String(itensOrdem.get(item.id)?.quantidade ?? item.quantidade).replace(
          ".",
          ","
        ),
      ])
    )
  );
  const [precos, setPrecos] = useState<Record<number, string>>(
    Object.fromEntries(
      cotacao.itens.map(item => [
        item.id,
        Number(itensOrdem.get(item.id)?.precoUnitario ?? item.precoUnitario)
          .toFixed(2)
          .replace(".", ","),
      ])
    )
  );
  const perfil = comprador;
  const definirPerfil = (
    campo: "nome" | "documento" | "inscricaoEstadual",
    valor: string
  ) => setComprador(atual => ({ ...atual, tipo, [campo]: valor }));
  const linhasAtivas = cotacao.itens.filter(item => incluidos.has(item.id));
  const validos =
    linhasAtivas.length > 0 &&
    linhasAtivas.every(item => {
      const quantidade = numero(quantidades[item.id] ?? "");
      const preco = numero(precos[item.id] ?? "");
      return (
        quantidade != null && quantidade > 0 && preco != null && preco >= 0
      );
    });
  const linhas = linhasAtivas.flatMap(item => {
    const quantidade = numero(quantidades[item.id] ?? "");
    const precoUnitario = numero(precos[item.id] ?? "");
    return quantidade != null && quantidade > 0 && precoUnitario != null
      ? [{ itemId: item.id, quantidade, precoUnitario }]
      : [];
  });
  const subtotal = validos
    ? linhasAtivas.reduce((total, item) => {
        const quantidade = numero(quantidades[item.id] ?? "")!;
        const preco = numero(precos[item.id] ?? "")!;
        return total + Math.round(quantidade * preco * 100) / 100;
      }, 0)
    : null;
  const totalAtualizado =
    subtotal == null ? null : subtotal + Number(ordem.frete ?? 0);

  const salvarAlteracoes = async () => {
    if (temNf) return;
    if (nomeComprador.trim().length < 3) {
      toast.error("Informe o nome do comprador.");
      return;
    }
    if (!validos) {
      toast.error(
        "Revise os itens ou exclua as linhas que não serão compradas."
      );
      return;
    }
    const compradorValidado = compradorSchema.safeParse({ ...comprador, tipo });
    if (!compradorValidado.success) {
      toast.error(
        compradorValidado.error.issues[0]?.message ??
          "Confira os dados fiscais do comprador."
      );
      return;
    }
    if (pagamento === "faturado" && !condicao.trim()) {
      toast.error("Informe as condições do faturamento.");
      return;
    }
    const entrada = editarOrdemCompraSchema.safeParse({
      id: ordem.id,
      nomeComprador,
      comprador: compradorValidado.data,
      pagamento,
      condicaoPagamento: condicao,
      observacoes,
      itens: linhas,
    });
    if (!entrada.success) {
      toast.error(
        entrada.error.issues[0]?.message ?? "Revise os dados da ordem."
      );
      return;
    }
    try {
      await salvar.mutateAsync(entrada.data);
      await Promise.all([
        utils.compras.listarOrdens.invalidate(),
        utils.compras.obterOrdemFrete.invalidate({ id: ordem.id }),
        utils.compras.auditarOrdem.invalidate({ id: ordem.id }),
      ]);
      toast.success(`Ordem OC-${ordem.id} atualizada.`);
      fechar();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível salvar a ordem."
      );
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm">
        <strong>{registro.fornecedor}</strong> · Cotação #{ordem.cotacaoId}
      </p>
      {temNf && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Esta ordem já tem NF vinculada e está bloqueada para edição. A
          logística pode ser revisada no botão “Frete e coleta”.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Campo titulo="Nome do comprador (obrigatório)">
          <Input
            value={nomeComprador}
            disabled={temNf}
            maxLength={256}
            onChange={e => setNomeComprador(e.target.value)}
          />
        </Campo>
        <Campo titulo="Emitir em nome de">
          <select
            className={classeSelect}
            value={tipo}
            disabled={temNf}
            onChange={e => setTipo(e.target.value as TipoComprador)}
          >
            <option value="empresa">Empresa / CNPJ</option>
            <option value="pessoa">Pessoa / CPF</option>
          </select>
        </Campo>
        <Campo titulo="Nome / razão social">
          <Input
            value={perfil.nome}
            disabled={temNf}
            onChange={e => definirPerfil("nome", e.target.value)}
          />
        </Campo>
        <Campo titulo={tipo === "empresa" ? "CNPJ" : "CPF"}>
          <Input
            value={perfil.documento}
            disabled={temNf}
            onChange={e => definirPerfil("documento", e.target.value)}
          />
        </Campo>
        <Campo titulo="Inscrição estadual">
          <Input
            value={perfil.inscricaoEstadual}
            disabled={temNf || tipo === "pessoa"}
            onChange={e => definirPerfil("inscricaoEstadual", e.target.value)}
          />
        </Campo>
        <Campo titulo="E-mail para envio da NF">
          <Input
            type="email"
            value={comprador.emailNf}
            disabled={temNf}
            onChange={e =>
              setComprador(atual => ({ ...atual, emailNf: e.target.value }))
            }
          />
        </Campo>
        <Campo titulo="Endereço">
          <Input
            value={comprador.endereco}
            disabled={temNf}
            onChange={e =>
              setComprador(atual => ({ ...atual, endereco: e.target.value }))
            }
          />
        </Campo>
        <Campo titulo="Forma de pagamento">
          <select
            className={classeSelect}
            value={pagamento}
            disabled={temNf}
            onChange={e => setPagamento(e.target.value as typeof pagamento)}
          >
            <option value="a_vista">À vista</option>
            <option value="faturado">Faturado</option>
          </select>
        </Campo>
        <Campo titulo="Condições / vencimentos">
          <Input
            value={condicao}
            disabled={temNf}
            onChange={e => setCondicao(e.target.value)}
            placeholder="Ex.: 28/35/42 dias"
          />
        </Campo>
        <Campo titulo="Observações para o fornecedor">
          <Input
            value={observacoes}
            disabled={temNf}
            onChange={e => setObservacoes(e.target.value)}
          />
        </Campo>
      </div>
      <Table className="table-fixed text-xs [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:align-top">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[42%]">Item da cotação</TableHead>
            <TableHead>Quantidade</TableHead>
            <TableHead>Preço / un.</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cotacao.itens.map(item => {
            const incluído = incluidos.has(item.id);
            const quantidade = numero(quantidades[item.id] ?? "");
            const preco = numero(precos[item.id] ?? "");
            return (
              <TableRow
                key={item.id}
                className={!incluído ? "bg-slate-50 opacity-60" : undefined}
              >
                <TableCell>
                  <span className={!incluído ? "line-through" : undefined}>
                    {item.descricao}
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    {item.codigo} · {item.unidade}
                  </span>
                </TableCell>
                <TableCell>
                  <Input
                    value={quantidades[item.id]}
                    inputMode="decimal"
                    disabled={temNf || !incluído}
                    aria-label={`Quantidade de ${item.descricao}`}
                    onChange={e =>
                      setQuantidades(v => ({ ...v, [item.id]: e.target.value }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={precos[item.id]}
                    inputMode="decimal"
                    disabled={temNf || !incluído}
                    aria-label={`Preço unitário de ${item.descricao}`}
                    onChange={e =>
                      setPrecos(v => ({ ...v, [item.id]: e.target.value }))
                    }
                  />
                  {preco != null && preco !== Number(item.precoUnitario) && (
                    <span className="block text-[10px] text-slate-500">
                      Cotado: {fmtBrl(Number(item.precoUnitario))}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {quantidade != null && quantidade > 0 && preco != null
                    ? fmtBrl(Math.round(quantidade * preco * 100) / 100)
                    : "—"}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    disabled={temNf}
                    onClick={() =>
                      setIncluidos(v => {
                        const proximo = new Set(v);
                        if (proximo.has(item.id)) proximo.delete(item.id);
                        else proximo.add(item.id);
                        return proximo;
                      })
                    }
                  >
                    {incluído ? (
                      <>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
                      </>
                    ) : (
                      <>
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restaurar
                      </>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-xs text-slate-500">
        A cotação de origem permanece preservada. O PDF identifica o preço
        cotado quando o preço da ordem foi ajustado.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong>
          {ordem.freteModo === "por_kg" && ordem.pesoPrevistoKg == null
            ? "Subtotal sem frete: "
            : "Total da ordem: "}
          {totalAtualizado == null
            ? "Revise os itens"
            : fmtBrl(totalAtualizado)}
        </strong>
        <Button
          disabled={
            temNf ||
            salvar.isPending ||
            !validos ||
            nomeComprador.trim().length < 3
          }
          onClick={() => void salvarAlteracoes()}
        >
          {salvar.isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
