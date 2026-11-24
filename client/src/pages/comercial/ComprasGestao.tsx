import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { fmtBrl, fmtDate, fmtNum } from "@/lib/format";
import { toast } from "sonner";
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
import { Empty } from "@/components/ui/empty";
import KpiCard from "@/components/KpiCard";
import ChartTooltip from "@/components/ChartTooltip";
import { chartColor } from "@/lib/chartColors";
import { RotateCcw, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { baixarOrdemCompraPdf } from "@/lib/ordemCompraPdf";
import {
  FreteCompraCampos,
  LogisticaOrdemModal,
  type ModoFreteCompra,
} from "./ComprasLogistica";
import { calcularFreteCompra } from "@shared/compras-frete";
import {
  simularCustoFinalCotacao,
  type SimulacaoCotacao,
} from "@shared/compras-cotacao-simulacao";
import { EditarOrdemModal, type CompraOrdemRegistro } from "./ComprasOrdemEdit";
import {
  unidadeConsumo,
  compradorSchema,
  cotacaoCompraSchema,
} from "@shared/compras-cotacoes";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

type Outputs = inferRouterOutputs<AppRouter>["compras"];
type Cotacao = Outputs["obterCotacao"];
type Cadastro = Outputs["compradores"];
export type SimulacaoFinalCotacao = SimulacaoCotacao;
const selectClass =
  "w-full min-w-0 rounded-md border bg-white px-2 py-2 text-xs";
const compacta =
  "table-fixed text-xs [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:align-top";
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
function erro(e: unknown) {
  toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
}
function dataIso(s: string | undefined) {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
function numeroOpcional(s: string): number | null {
  if (!s.trim()) return null;
  const numero = Number(s.replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

// O editor existente mantém os vínculos/calculadora; este bloco salva o documento completo.
export function SalvarCotacaoCompra({
  resultado,
  nomeArquivo,
  onAbrirOrdem,
  onSimulacaoChange,
}: {
  resultado: any;
  nomeArquivo: string;
  onAbrirOrdem: (id: number) => void;
  onSimulacaoChange: (simulacao: SimulacaoFinalCotacao) => void;
}) {
  const utils = trpc.useUtils();
  const [data, setData] = useState(dataIso(resultado.dataCotacao));
  const [validade, setValidade] = useState(
    resultado.validadeDias == null ? "" : String(resultado.validadeDias)
  );
  const [pagamento, setPagamento] = useState(resultado.condicaoPagamento ?? "");
  const [prazo, setPrazo] = useState(resultado.prazoEntrega ?? "");
  const [frete, setFrete] = useState(
    resultado.freteValorInformado != null
      ? String(resultado.freteValorInformado)
      : resultado.valorFrete == null
        ? ""
        : String(resultado.valorFrete)
  );
  const [freteModo, setFreteModo] = useState<ModoFreteCompra>(
    resultado.freteModo ?? "valor_total"
  );
  const [pesoFrete, setPesoFrete] = useState(
    () => {
      const pesoExtraido = Number(resultado.pesoFreteKg);
      if (Number.isFinite(pesoExtraido) && pesoExtraido > 0)
        return String(pesoExtraido);
      const itens = Array.isArray(resultado.itens) ? resultado.itens : [];
      if (
        itens.length > 0 &&
        itens.every((item: any) => unidadeConsumo(item.unidade) === "KG")
      ) {
        const soma = itens.reduce(
          (total: number, item: any) => total + Number(item.quantidade || 0),
          0
        );
        return Number.isFinite(soma) && soma > 0 ? String(soma) : "";
      }
      return "";
    }
  );
  const [observacoes, setObservacoes] = useState(resultado.observacoes ?? "");
  const [salvo, setSalvo] = useState<{ id: number; assinatura: string } | null>(
    null
  );
  const controle = useRef({ assinatura: "", chave: crypto.randomUUID() });
  const salvar = trpc.compras.salvarCotacao.useMutation();
  const pesoFreteNumero = numeroOpcional(pesoFrete);
  const simulacao = useMemo(
    () =>
      simularCustoFinalCotacao({
        itens: resultado.itens.map((item: any) => ({
          quantidade: Number(item.quantidade),
          unidade: String(item.unidade ?? ""),
          precoUnitario: Number(item.precoUnitario),
        })),
        freteModo,
        valorFreteInformado:
          freteModo === "gratis" ? 0 : numeroOpcional(frete),
        pesoTotalKg: pesoFreteNumero,
      }),
    [resultado.itens, freteModo, frete, pesoFreteNumero]
  );
  useEffect(() => {
    onSimulacaoChange(simulacao);
  }, [simulacao, onSimulacaoChange]);
  const payload = {
    fornecedor: resultado.fornecedor ?? "",
    cnpjFornecedor: resultado.cnpjFornecedor ?? null,
    dataCotacao: data,
    validadeDias: validade === "" ? null : Number(validade),
    condicaoPagamento: pagamento,
    prazoEntrega: prazo,
    frete: frete === "" ? null : Number(frete.replace(",", ".")),
    freteModo,
    freteValorInformado:
      freteModo === "gratis"
        ? 0
        : frete === ""
          ? null
          : Number(frete.replace(",", ".")),
    pesoFreteKg: pesoFrete === "" ? null : Number(pesoFrete.replace(",", ".")),
    observacoes,
    nomeArquivo,
    itens: resultado.itens.map((i: any) => {
      const mp = i.materiaPrimaVinculada;
      const identica =
        mp && unidadeConsumo(i.unidade) === unidadeConsumo(mp.unidadeMubisys);
      return {
        codigo: i.codigo ?? null,
        descricao: i.descricao,
        quantidade: Number(i.quantidade),
        unidade: i.unidade,
        precoUnitario: Number(i.precoUnitario),
        materiaPrimaId: mp?.id ?? null,
        unidadeDestino:
          i.unidadeDestinoConversaoCotacao ?? mp?.unidadeMubisys ?? null,
        fatorConversao: i.fatorConversaoCotacao ?? (identica ? 1 : null),
        unidadeOrigem: i.unidadeOrigemConversaoCotacao ?? i.unidade,
        formula: i.baseCalculoConversaoCotacao ?? null,
      };
    }),
  };
  const assinatura = JSON.stringify(payload);
  const assinaturaInicial = useRef(assinatura);
  const idSalvo =
    salvo?.assinatura === assinatura
      ? salvo.id
      : resultado.salvoId && assinaturaInicial.current === assinatura
        ? Number(resultado.salvoId)
        : null;
  const atualSalvo = idSalvo != null;
  const gravar = async (ordem: boolean) => {
    try {
      if (ordem && simulacao.totalFinal == null) {
        toast.error(
          simulacao.pendencia === "peso"
            ? "Informe o peso total em kg para calcular o frete por quilo e o preço final."
            : "Informe o frete ou selecione Grátis para calcular o preço final."
        );
        return;
      }
      if (atualSalvo) {
        if (ordem) onAbrirOrdem(idSalvo);
        return;
      }
      if (controle.current.assinatura !== assinatura)
        controle.current = { assinatura, chave: crypto.randomUUID() };
      const entrada = cotacaoCompraSchema.safeParse({
        ...payload,
        chave: controle.current.chave,
      });
      if (!entrada.success) {
        toast.error(
          `Confira os dados da cotação: ${entrada.error.issues[0]?.path.join(".")} - ${entrada.error.issues[0]?.message}`
        );
        return;
      }
      const res = await salvar.mutateAsync(entrada.data);
      setSalvo({ id: res.id, assinatura });
      await utils.compras.listarCotacoes.invalidate();
      await utils.compras.painel.invalidate();
      toast.success(`Cotação #${res.id} salva no histórico.`);
      if (ordem) onAbrirOrdem(res.id);
    } catch (e) {
      erro(e);
    }
  };
  return (
    <div className="rounded-lg border bg-slate-50 p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
        <Campo titulo="Data da cotação">
          <Input
            type="date"
            value={data}
            onChange={e => setData(e.target.value)}
          />
        </Campo>
        <Campo titulo="Validade (dias)">
          <Input
            type="number"
            min="0"
            max="365"
            placeholder="Não informada"
            value={validade}
            onChange={e => setValidade(e.target.value)}
          />
        </Campo>
        <Campo titulo="Pagamento cotado">
          <Input
            value={pagamento}
            onChange={e => setPagamento(e.target.value)}
          />
        </Campo>
        <Campo titulo="Prazo de entrega">
          <Input value={prazo} onChange={e => setPrazo(e.target.value)} />
        </Campo>
        <Campo titulo="Observações">
          <Input
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
          />
        </Campo>
      </div>
      <FreteCompraCampos
        modo={freteModo}
        valor={frete}
        peso={pesoFrete}
        mudarModo={setFreteModo}
        mudarValor={setFrete}
        mudarPeso={setPesoFrete}
      />
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
        <strong className="block text-sm text-slate-800">
          Simulação do preço final — ICMS 10%
        </strong>
        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="block text-slate-500">Mercadoria</span>
            <strong>{fmtBrl(simulacao.subtotalMercadoria)}</strong>
          </div>
          <div>
            <span className="block text-slate-500">Frete calculado</span>
            <strong>
              {simulacao.valorFrete == null
                ? "Pendente"
                : fmtBrl(simulacao.valorFrete)}
            </strong>
          </div>
          <div>
            <span className="block text-slate-500">ICMS (10%)</span>
            <strong>
              {simulacao.valorIcms == null
                ? "Pendente"
                : fmtBrl(simulacao.valorIcms)}
            </strong>
          </div>
          <div>
            <span className="block text-slate-500">Preço final</span>
            <strong>
              {simulacao.totalFinal == null
                ? "Não calculado"
                : fmtBrl(simulacao.totalFinal)}
            </strong>
          </div>
        </div>
        {simulacao.pendencia ? (
          <p role="status" className="text-xs font-medium text-amber-800">
            {simulacao.pendencia === "peso"
              ? "A cotação não informa o peso total. Sem essa base não é possível multiplicar a tarifa R$/kg; informe o peso previsto no campo acima para simular o custo final."
              : "Informe o valor do frete ou selecione Grátis. O preço final e o ICMS ficam pendentes enquanto o frete não estiver definido."}
          </p>
        ) : (
          <p className="text-[11px] text-slate-600">
            Base de cálculo igual à auditoria de NF: mercadoria + frete, com
            ICMS de 10% sobre essa soma. O frete é distribuído entre os itens
            proporcionalmente ao valor cotado.
          </p>
        )}
        {simulacao.totalFinal != null && (
          <details className="text-xs">
            <summary className="cursor-pointer text-blue-700">
              Conferir preço final por item
            </summary>
            <div className="mt-2 space-y-1">
              {resultado.itens.map((item: any, indice: number) => {
                const linha = simulacao.itens[indice];
                return linha ? (
                  <div
                    key={`${item.codigo ?? item.descricao}-${indice}`}
                    className="flex flex-wrap justify-between gap-x-3 border-t border-blue-100 pt-1"
                  >
                    <span>
                      {item.descricao} · {fmtNum(Number(item.quantidade), 3)}{" "}
                      {item.unidade}
                    </span>
                    <strong>
                      {fmtBrl(linha.custoFinalUnitario)}/{item.unidade}
                    </strong>
                  </div>
                ) : null;
              })}
            </div>
          </details>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={salvar.isPending || atualSalvo}
          onClick={() => void gravar(false)}
        >
          {salvar.isPending
            ? "Salvando..."
            : atualSalvo
              ? `Cotação #${idSalvo} salva`
              : "Salvar cotação"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={salvar.isPending}
          onClick={() => void gravar(true)}
        >
          Gerar ordem de compra
        </Button>
        <span className="text-[11px] text-slate-500">
          Salvar preserva itens, vínculos e fórmulas. Alterações criam uma nova
          versão. Itens sem conversão ficam pendentes no painel.
        </span>
      </div>
    </div>
  );
}

export function OrdemCompraModal({
  cotacaoId,
  fechar,
}: {
  cotacaoId: number | null;
  fechar: () => void;
}) {
  const q = trpc.compras.obterCotacao.useQuery(
    { id: cotacaoId ?? 0 },
    { enabled: cotacaoId != null }
  );
  const c = trpc.compras.compradores.useQuery(undefined, {
    enabled: cotacaoId != null,
  });
  return (
    <Dialog
      open={cotacaoId != null}
      onOpenChange={aberto => {
        if (!aberto) fechar();
      }}
    >
      <DialogContent className="!max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar ordem de compra</DialogTitle>
        </DialogHeader>
        {q.isLoading || c.isLoading ? (
          <Spinner />
        ) : q.error || c.error ? (
          <p className="text-red-600">{q.error?.message ?? c.error?.message}</p>
        ) : q.data && c.data ? (
          <EditorOrdem
            key={q.data.id}
            cotacao={q.data}
            cadastro={c.data}
            fechar={fechar}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditorOrdem({
  cotacao,
  cadastro,
  fechar,
}: {
  cotacao: Cotacao;
  cadastro: Cadastro;
  fechar: () => void;
}) {
  const utils = trpc.useUtils();
  const [dados, setDados] = useState(cadastro);
  const [tipo, setTipo] = useState<"empresa" | "pessoa">("empresa");
  const [nomeComprador, setNomeComprador] = useState("");
  const [quantidades, setQuantidades] = useState<Record<number, string>>(
    Object.fromEntries(
      cotacao.itens.map(i => [i.id, String(i.quantidade).replace(".", ",")])
    )
  );
  const [precos, setPrecos] = useState<Record<number, string>>(
    Object.fromEntries(
      cotacao.itens.map(i => [
        i.id,
        Number(i.precoUnitario).toFixed(2).replace(".", ","),
      ])
    )
  );
  const [excluidos, setExcluidos] = useState<Set<number>>(new Set());
  const [pagamento, setPagamento] = useState<"a_vista" | "faturado">(
    cotacao.condicaoPagamento &&
      !/vista|antecipado|pix/i.test(cotacao.condicaoPagamento)
      ? "faturado"
      : "a_vista"
  );
  const [condicao, setCondicao] = useState(cotacao.condicaoPagamento ?? "");
  const [transportadora, setTransportadora] = useState("");
  const [coleta, setColeta] = useState("");
  const [frete, setFrete] = useState(
    String(cotacao.freteValorInformado ?? cotacao.frete ?? "")
  );
  const [freteModo, setFreteModo] = useState<ModoFreteCompra>(
    (cotacao.freteModo ?? "valor_total") as ModoFreteCompra
  );
  const [pesoFrete, setPesoFrete] = useState(
    cotacao.pesoFreteKg == null ? "" : String(cotacao.pesoFreteKg)
  );
  const [volumeTotal, setVolumeTotal] = useState("");
  const freteCalculado = calcularFreteCompra(
    freteModo,
    frete.trim() ? Number(frete.replace(",", ".")) : null,
    pesoFrete.trim() ? Number(pesoFrete.replace(",", ".")) : null
  );
  const [obs, setObs] = useState("");
  const emitir = trpc.compras.emitirOrdem.useMutation();
  const salvarCadastro = trpc.compras.salvarCompradores.useMutation();
  const chave = useRef({ assinatura: "", valor: crypto.randomUUID() });
  const perfil = dados[tipo];
  const linhasAtivas = cotacao.itens.filter(i => !excluidos.has(i.id));
  const numeroEditado = (valor: string) => {
    const numero = Number(valor.replace(",", "."));
    return valor.trim() && Number.isFinite(numero) ? numero : null;
  };
  const itensValidos =
    linhasAtivas.length > 0 &&
    linhasAtivas.every(i => {
      const quantidade = numeroEditado(quantidades[i.id] ?? "");
      const preco = numeroEditado(precos[i.id] ?? "");
      return (
        quantidade != null && quantidade > 0 && preco != null && preco >= 0
      );
    });
  const pesoInformado = numeroEditado(pesoFrete);
  const volumeInformado = numeroEditado(volumeTotal);
  const pesoFreteKgValido =
    freteModo !== "por_kg" ||
    (pesoInformado != null && pesoInformado > 0);
  const expedicaoValida =
    (!pesoFrete.trim() || (pesoInformado != null && pesoInformado > 0)) &&
    (!volumeTotal.trim() || (volumeInformado != null && volumeInformado > 0));
  const itens = linhasAtivas.flatMap(i => {
    const quantidade = numeroEditado(quantidades[i.id] ?? "");
    const precoUnitario = numeroEditado(precos[i.id] ?? "");
    return quantidade != null && quantidade > 0 && precoUnitario != null
      ? [{ itemId: i.id, quantidade, precoUnitario }]
      : [];
  });
  const total = itensValidos
    ? linhasAtivas.reduce((s, i) => {
        const quantidade = numeroEditado(quantidades[i.id] ?? "")!;
        const preco = numeroEditado(precos[i.id] ?? "")!;
        return s + Math.round(quantidade * preco * 100) / 100;
      }, 0) + (freteCalculado.total ?? 0)
    : null;
  const definir = (
    campo: "nome" | "documento" | "inscricaoEstadual",
    valor: string
  ) => setDados(v => ({ ...v, [tipo]: { ...v[tipo], [campo]: valor } }));
  const gerar = async () => {
    if (nomeComprador.trim().length < 3) {
      toast.error("Informe o nome de quem está fazendo a compra.");
      return;
    }
    if (!pesoFreteKgValido) {
      toast.error(
        "Informe o peso previsto da carga em kg para calcular o frete por quilo."
      );
      return;
    }
    if (
      freteModo !== "gratis" &&
      (!frete.trim() ||
        !Number.isFinite(Number(frete.replace(",", "."))) ||
        Number(frete.replace(",", ".")) < 0)
    ) {
      toast.error(
        "Informe o valor total ou a tarifa por kg do frete antes de emitir a ordem."
      );
      return;
    }
    const comprador = compradorSchema.safeParse({
      tipo,
      ...perfil,
      endereco: dados.endereco,
      emailNf: dados.emailNf,
    });
    if (!comprador.success) {
      toast.error(
        comprador.error.issues[0]?.message ?? "Confira os dados do comprador."
      );
      return;
    }
    if (!itensValidos) {
      toast.error(
        "Revise os itens: informe quantidade maior que zero e preço válido, ou exclua a linha."
      );
      return;
    }
    if (!expedicaoValida) {
      toast.error(
        "Informe peso e volume maiores que zero, ou deixe o campo vazio."
      );
      return;
    }
    try {
      const entrada = {
        cotacaoId: cotacao.id,
        nomeComprador: nomeComprador.trim(),
        comprador: comprador.data,
        pagamento,
        condicaoPagamento: condicao,
        transportadora,
        numeroColeta: coleta,
        frete: freteCalculado.total ?? 0,
        freteModo,
        freteValorInformado:
          freteModo === "gratis" ? 0 : Number(frete.replace(",", ".")),
        pesoPrevistoKg: pesoFrete.trim() ? pesoInformado : null,
        volumePrevistoM3: volumeTotal.trim() ? volumeInformado : null,
        observacoes: obs,
        itens,
      };
      const assinatura = JSON.stringify(entrada);
      if (chave.current.assinatura !== assinatura)
        chave.current = { assinatura, valor: crypto.randomUUID() };
      const ordem = await emitir.mutateAsync({
        ...entrada,
        chave: chave.current.valor,
      });
      await utils.compras.listarOrdens.invalidate();
      baixarOrdemCompraPdf(ordem, cotacao.fornecedor);
      toast.success(`Ordem OC-${ordem.id} emitida e salva.`);
      fechar();
    } catch (e) {
      erro(e);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Cotação #{cotacao.id} · <strong>{cotacao.fornecedor}</strong>
      </p>
      <Campo titulo="Nome do comprador (preenchimento manual)">
        <Input
          value={nomeComprador}
          onChange={e => setNomeComprador(e.target.value)}
          placeholder="Nome de quem está fazendo a compra"
          maxLength={256}
        />
      </Campo>
      <div className="rounded-lg border p-3 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Campo titulo="Quem está comprando?">
            <select
              className={selectClass}
              value={tipo}
              onChange={e => setTipo(e.target.value as typeof tipo)}
            >
              <option value="empresa">Empresa / CNPJ</option>
              <option value="pessoa">Daniel / CPF</option>
            </select>
          </Campo>
          <Campo titulo="Nome / razão social">
            <Input
              value={perfil.nome}
              onChange={e => definir("nome", e.target.value)}
            />
          </Campo>
          <Campo titulo={tipo === "empresa" ? "CNPJ" : "CPF"}>
            <Input
              value={perfil.documento}
              onChange={e => definir("documento", e.target.value)}
            />
          </Campo>
          <Campo titulo="Inscrição estadual">
            <Input
              disabled={tipo === "pessoa"}
              value={perfil.inscricaoEstadual}
              onChange={e => definir("inscricaoEstadual", e.target.value)}
            />
          </Campo>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Campo titulo="Endereço completo (igual nos dois cadastros)">
            <Input
              value={dados.endereco}
              onChange={e =>
                setDados(v => ({ ...v, endereco: e.target.value }))
              }
            />
          </Campo>
          <Campo titulo="Enviar nota fiscal para (e-mail dos dois cadastros)">
            <Input
              type="email"
              value={dados.emailNf}
              onChange={e => setDados(v => ({ ...v, emailNf: e.target.value }))}
            />
          </Campo>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={salvarCadastro.isPending}
          onClick={async () => {
            try {
              await salvarCadastro.mutateAsync(dados);
              await utils.compras.compradores.invalidate();
              toast.success("Cadastros de compradores salvos.");
            } catch (e) {
              erro(e);
            }
          }}
        >
          Salvar os dois cadastros de compradores
        </Button>
      </div>
      <Table className={compacta}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[48%]">Produto da cotação</TableHead>
            <TableHead>Quantidade</TableHead>
            <TableHead>Preço / un.</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cotacao.itens.map(i => {
            const excluido = excluidos.has(i.id);
            const quantidade = numeroEditado(quantidades[i.id] ?? "");
            const preco = numeroEditado(precos[i.id] ?? "");
            return (
              <TableRow
                key={i.id}
                className={excluido ? "bg-slate-50 opacity-60" : undefined}
              >
                <TableCell>
                  <span className={excluido ? "line-through" : undefined}>
                    {i.descricao}
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    {i.codigo} · {i.unidade}
                  </span>
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`Quantidade de ${i.descricao}`}
                    inputMode="decimal"
                    value={quantidades[i.id]}
                    disabled={excluido}
                    onChange={e =>
                      setQuantidades(v => ({ ...v, [i.id]: e.target.value }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`Preço unitário de ${i.descricao}`}
                    inputMode="decimal"
                    value={precos[i.id]}
                    disabled={excluido}
                    onChange={e =>
                      setPrecos(v => ({ ...v, [i.id]: e.target.value }))
                    }
                  />
                  {preco != null && preco !== Number(i.precoUnitario) && (
                    <span className="mt-1 block text-[10px] text-slate-500">
                      Cotado: {fmtBrl(Number(i.precoUnitario))}
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
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`${excluido ? "Restaurar" : "Excluir"} ${i.descricao}`}
                    onClick={() =>
                      setExcluidos(v => {
                        const proximo = new Set(v);
                        if (proximo.has(i.id)) proximo.delete(i.id);
                        else proximo.add(i.id);
                        return proximo;
                      })
                    }
                  >
                    {excluido ? (
                      <>
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restaurar
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
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
        Ajuste quantidade e preço, exclua ou restaure uma linha. Preços
        diferentes da cotação ficam identificados no PDF para conferência.
      </p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Campo titulo="Forma de pagamento">
          <select
            className={selectClass}
            value={pagamento}
            onChange={e => {
              setPagamento(e.target.value as typeof pagamento);
              setCondicao(
                e.target.value === "a_vista"
                  ? ""
                  : (cotacao.condicaoPagamento ?? "")
              );
            }}
          >
            <option value="a_vista">À vista</option>
            <option value="faturado">Faturado</option>
          </select>
        </Campo>
        <Campo titulo="Condições / vencimentos">
          <Input
            value={condicao}
            onChange={e => setCondicao(e.target.value)}
            placeholder="Ex.: 28/35/42 dias"
          />
        </Campo>
        <Campo titulo="Transportadora">
          <Input
            value={transportadora}
            onChange={e => setTransportadora(e.target.value)}
          />
        </Campo>
        <Campo titulo="Número da coleta">
          <Input value={coleta} onChange={e => setColeta(e.target.value)} />
        </Campo>
        <Campo titulo="Observações para o fornecedor">
          <Input value={obs} onChange={e => setObs(e.target.value)} />
        </Campo>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Campo titulo="Peso total da carga (kg)">
          <Input
            inputMode="decimal"
            value={pesoFrete}
            onChange={e => setPesoFrete(e.target.value)}
            placeholder="Opcional"
          />
        </Campo>
        <Campo titulo="Volume total da carga (m³)">
          <Input
            inputMode="decimal"
            value={volumeTotal}
            onChange={e => setVolumeTotal(e.target.value)}
            placeholder="Opcional"
          />
        </Campo>
      </div>
      <FreteCompraCampos
        modo={freteModo}
        valor={frete}
        peso={pesoFrete}
        mudarModo={setFreteModo}
        mudarValor={setFrete}
        mudarPeso={setPesoFrete}
        mostrarPeso={false}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong>
          {freteCalculado.pendente
            ? "Subtotal (frete aguardando peso): "
            : freteModo === "por_kg"
              ? "Total estimado: "
              : "Total: "}
          {total == null ? "Revise quantidades e preços" : fmtBrl(total)}
        </strong>
        <Button
          disabled={
            emitir.isPending ||
            !itensValidos ||
            !expedicaoValida ||
            !pesoFreteKgValido ||
            nomeComprador.trim().length < 3
          }
          onClick={() => void gerar()}
        >
          {emitir.isPending ? "Emitindo..." : "Emitir, salvar e baixar PDF"}
        </Button>
      </div>
    </div>
  );
}

export function ComprasHistorico({
  onAbrirCotacao,
  onOrdem,
}: {
  onAbrirCotacao: (cotacao: Cotacao) => void | Promise<void>;
  onOrdem: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const removerOrdem = trpc.compras.excluirOrdem.useMutation();
  const [aba, setAba] = useState<"cotacoes" | "evolucao" | "ordens">(
    "cotacoes"
  );
  const [busca, setBusca] = useState("");
  const [mp, setMp] = useState<number | undefined>();
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [unidade, setUnidade] = useState("");
  const [auditar, setAuditar] = useState<number | null>(null);
  const [logisticaId, setLogisticaId] = useState<number | null>(null);
  const [editarOrdem, setEditarOrdem] = useState<CompraOrdemRegistro | null>(
    null
  );
  const [excluirOrdem, setExcluirOrdem] = useState<CompraOrdemRegistro | null>(
    null
  );
  const [buscaOrdem, setBuscaOrdem] = useState("");
  const [inicioOrdem, setInicioOrdem] = useState("");
  const [fimOrdem, setFimOrdem] = useState("");
  const [paginaOrdem, setPaginaOrdem] = useState(0);
  const cotacoes = trpc.compras.listarCotacoes.useQuery();
  const ordens = trpc.compras.listarOrdens.useQuery({
    busca: buscaOrdem || undefined,
    inicio: inicioOrdem || undefined,
    fim: fimOrdem || undefined,
    pagina: paginaOrdem,
  });
  const materias = trpc.nfCompra.buscarMateriasPrimas.useQuery(
    { busca, limite: 20 },
    { enabled: busca.length >= 2 }
  );
  const painel = trpc.compras.painel.useQuery(
    { materiaPrimaId: mp, inicio: inicio || undefined, fim: fim || undefined },
    { enabled: aba === "evolucao" }
  );
  const pontos = (painel.data?.pontos ?? []).filter(
    p =>
      (!fornecedor || p.fornecedor === fornecedor) &&
      (!unidade || unidadeConsumo(p.unidade) === unidade)
  );
  const fornecedores = [...new Set(painel.data?.pontos.map(p => p.fornecedor))];
  const unidades = [
    ...new Set(painel.data?.pontos.map(p => unidadeConsumo(p.unidade))),
  ];
  const serie =
    mp && unidade
      ? [...new Set(pontos.map(p => p.data))].sort().map(data => {
          const linhas = pontos.filter(p => p.data === data);
          const media = (origem: string) => {
            const validos = linhas.filter(
              p => p.origem === origem && p.preco != null
            );
            return validos.length
              ? validos.reduce((s, p) => s + p.preco!, 0) / validos.length
              : null;
          };
          return {
            data: fmtDate(data + "T12:00:00"),
            Cotação: media("Cotação"),
            NF: media("NF"),
          };
        })
      : [];
  const confirmarExclusaoOrdem = async () => {
    if (!excluirOrdem) return;
    try {
      await removerOrdem.mutateAsync({ id: excluirOrdem.ordem.id });
      await utils.compras.listarOrdens.invalidate();
      toast.success(`Ordem OC-${excluirOrdem.ordem.id} excluída da lista.`);
      setExcluirOrdem(null);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível excluir a ordem."
      );
    }
  };
  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["cotacoes", "Cotações salvas"],
            ["evolucao", "Evolução e auditoria de preços"],
            ["ordens", "Ordens de compra"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            variant={aba === id ? "default" : "outline"}
            size="sm"
            onClick={() => setAba(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      {aba === "cotacoes" && (
        <>
          {cotacoes.isLoading ? (
            <Spinner />
          ) : cotacoes.error ? (
            <p>{cotacoes.error.message}</p>
          ) : !cotacoes.data?.length ? (
            <Empty>
              <p>Salve uma cotação analisada para começar o histórico.</p>
            </Empty>
          ) : (
            <Table className={compacta}>
              <TableHeader>
                <TableRow>
                  <TableHead>Data / número</TableHead>
                  <TableHead className="w-[30%]">Fornecedor</TableHead>
                  <TableHead>Total com frete informado</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cotacoes.data.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      {fmtDate(c.dataCotacao + "T12:00:00")}
                      <span className="block">#{c.id}</span>
                    </TableCell>
                    <TableCell>{c.fornecedor}</TableCell>
                    <TableCell>{fmtBrl(Number(c.total))}</TableCell>
                    <TableCell>
                      {c.validadeDias == null
                        ? "Não informada"
                        : `${c.validadeDias} dias`}
                    </TableCell>
                    <TableCell>
                      <button
                        className="block text-blue-600"
                        onClick={async () => {
                          try {
                            await onAbrirCotacao(
                              await utils.compras.obterCotacao.fetch({
                                id: c.id,
                              })
                            );
                          } catch (e) {
                            erro(e);
                          }
                        }}
                      >
                        Abrir / revisar
                      </button>
                      <button
                        className="block text-blue-600"
                        onClick={() => onOrdem(c.id)}
                      >
                        Gerar ordem
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
      {aba === "evolucao" && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
            <Campo titulo="Buscar matéria-prima">
              <Input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Nome ou código"
              />
            </Campo>
            <Campo titulo="Matéria-prima">
              <select
                className={selectClass}
                value={mp ?? ""}
                onChange={e =>
                  setMp(e.target.value ? Number(e.target.value) : undefined)
                }
              >
                <option value="">Todas</option>
                {materias.data?.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo titulo="De">
              <Input
                type="date"
                value={inicio}
                onChange={e => setInicio(e.target.value)}
              />
            </Campo>
            <Campo titulo="Até">
              <Input
                type="date"
                value={fim}
                onChange={e => setFim(e.target.value)}
              />
            </Campo>
            <Campo titulo="Fornecedor">
              <select
                className={selectClass}
                value={fornecedor}
                onChange={e => setFornecedor(e.target.value)}
              >
                <option value="">Todos</option>
                {fornecedores.map(f => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Campo>
            <Campo titulo="Unidade de consumo">
              <select
                className={selectClass}
                value={unidade}
                onChange={e => setUnidade(e.target.value)}
              >
                <option value="">Todas</option>
                {unidades.map(u => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </Campo>
          </div>
          {painel.isLoading ? (
            <Spinner />
          ) : painel.error ? (
            <p>{painel.error.message}</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <KpiCard
                  label="Itens cotados"
                  value={pontos.filter(p => p.origem === "Cotação").length}
                />
                <KpiCard
                  label="Itens comprados (NF)"
                  value={pontos.filter(p => p.origem !== "Cotação").length}
                />
                <KpiCard
                  label="Compras acima da menor cotação"
                  value={
                    pontos.filter(
                      p => p.diferenca != null && p.diferenca > 0.01
                    ).length
                  }
                  sub="Referências válidas e comparáveis"
                />
              </div>
              <p className="text-xs text-slate-500">
                Preços de material na unidade de consumo, antes de frete e
                impostos. A auditoria considera cotações anteriores à NF, dentro
                da validade e com volume cotado atendido. Sem referência
                suficiente, o resultado é inconclusivo. Condições de pagamento,
                qualidade e disponibilidade precisam de revisão.
              </p>
              {serie.length > 0 ? (
                <div className="h-64 rounded border bg-white p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={serie}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="data" />
                      <YAxis tickFormatter={v => fmtNum(v)} width={65} />
                      <Tooltip content={<ChartTooltip format={fmtBrl} />} />
                      <Legend />
                      <Line
                        dataKey="Cotação"
                        stroke={chartColor(0)}
                        connectNulls
                      />
                      <Line dataKey="NF" stroke={chartColor(1)} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs">
                  Selecione uma matéria-prima e uma unidade para ver o gráfico.
                  Valores por dia são médias simples dos registros.
                </p>
              )}
              {painel.data?.limiteAtingido && (
                <p className="text-amber-700 text-xs">
                  Exibindo até 5.000 itens de cada origem. Filtre por
                  matéria-prima para detalhar.
                </p>
              )}
              {!pontos.length ? (
                <Empty>
                  <p>Nenhum registro neste filtro.</p>
                </Empty>
              ) : (
                <Table className={compacta}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data / origem</TableHead>
                      <TableHead className="w-[24%]">
                        Material / fornecedor
                      </TableHead>
                      <TableHead>Preço na compra</TableHead>
                      <TableHead>Preço / consumo</TableHead>
                      <TableHead>Custo final NF</TableHead>
                      <TableHead className="w-[25%]">
                        Auditoria do menor preço
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pontos
                      .slice()
                      .reverse()
                      .map(p => (
                        <TableRow key={`${p.origem}-${p.id}`}>
                          <TableCell>
                            {fmtDate(p.data + "T12:00:00")}
                            <span className="block">
                              {p.origem} #{p.documentoId}
                              {p.ordemId ? ` / OC-${p.ordemId}` : ""}
                            </span>
                          </TableCell>
                          <TableCell>
                            {p.nome}
                            <span className="block text-slate-500">
                              {p.fornecedor}
                            </span>
                          </TableCell>
                          <TableCell>
                            {fmtBrl(p.precoOriginal)}/{p.unidadeOriginal}
                          </TableCell>
                          <TableCell>
                            {p.preco == null
                              ? "Conversão pendente"
                              : `${fmtBrl(p.preco)}/${p.unidade}`}
                          </TableCell>
                          <TableCell>
                            {p.custoFinal == null
                              ? "—"
                              : `${fmtBrl(p.custoFinal)}/${p.unidade}`}
                          </TableCell>
                          <TableCell>
                            {p.origem === "Cotação" ? (
                              "Referência de orçamento"
                            ) : p.menor ? (
                              <span
                                className={
                                  p.diferenca != null && p.diferenca > 0.01
                                    ? "text-amber-700"
                                    : "text-emerald-700"
                                }
                              >
                                {p.diferenca != null && p.diferenca > 0.01
                                  ? `Acima da menor referência em ${fmtBrl(p.diferenca)}`
                                  : "Preço até a menor referência"}
                                <span className="block text-slate-500">
                                  #{p.menor.cotacaoId} · {p.menor.fornecedor} ·{" "}
                                  {fmtBrl(p.menor.preco)}/{p.unidade}
                                </span>
                              </span>
                            ) : (
                              "Inconclusivo: sem cotação válida comparável"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </>
      )}
      {aba === "ordens" && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Campo titulo="Fornecedor, transportadora ou número da ordem">
              <Input
                value={buscaOrdem}
                onChange={e => {
                  setBuscaOrdem(e.target.value);
                  setPaginaOrdem(0);
                }}
              />
            </Campo>
            <Campo titulo="Data inicial">
              <Input
                type="date"
                value={inicioOrdem}
                onChange={e => {
                  setInicioOrdem(e.target.value);
                  setPaginaOrdem(0);
                }}
              />
            </Campo>
            <Campo titulo="Data final">
              <Input
                type="date"
                value={fimOrdem}
                onChange={e => {
                  setFimOrdem(e.target.value);
                  setPaginaOrdem(0);
                }}
              />
            </Campo>
          </div>
          {ordens.isLoading ? (
            <Spinner />
          ) : ordens.error ? (
            <p>{ordens.error.message}</p>
          ) : !ordens.data?.length ? (
            <Empty>
              <p>Gere uma ordem a partir de uma cotação salva.</p>
            </Empty>
          ) : (
            <Table className={compacta}>
              <TableHeader>
                <TableRow>
                  <TableHead>Ordem / data</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Comprador / pagamento</TableHead>
                  <TableHead>Frete / total</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordens.data.map(({ ordem: o, fornecedor: f }) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      OC-{o.id}
                      <span className="block">{fmtDate(o.createdAt)}</span>
                      {(o.pesoPrevistoKg != null ||
                        o.volumePrevistoM3 != null) && (
                        <span className="block text-slate-500">
                          {o.pesoPrevistoKg != null
                            ? `${fmtNum(Number(o.pesoPrevistoKg), 3)} kg`
                            : ""}
                          {o.pesoPrevistoKg != null &&
                          o.volumePrevistoM3 != null
                            ? " · "
                            : ""}
                          {o.volumePrevistoM3 != null
                            ? `${fmtNum(Number(o.volumePrevistoM3), 3)} m³`
                            : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{f}</TableCell>
                    <TableCell>
                      <strong>
                        {o.nomeComprador || "Comprador não informado"}
                      </strong>
                      <span className="block">
                        Em nome de: {o.comprador.nome}
                      </span>
                      <span className="block">
                        {o.pagamento === "a_vista" ? "À vista" : "Faturado"} ·{" "}
                        {o.condicaoPagamento}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block">
                        Frete:{" "}
                        {o.freteModo === "por_kg"
                          ? `${fmtBrl(Number(o.freteValorInformado))}/kg`
                          : o.freteModo === "gratis"
                            ? "Grátis"
                            : fmtBrl(Number(o.frete))}{" "}
                        {o.freteConfirmado ? "(confirmado)" : "(a confirmar)"}
                      </span>
                      <span className="block text-slate-500">
                        {o.transportadora || "Transportadora pendente"} · coleta{" "}
                        {o.numeroColeta || "pendente"}
                      </span>
                      <strong>
                        {o.freteModo === "por_kg"
                          ? o.pesoPrevistoKg == null
                            ? "Subtotal sem frete: "
                            : "Total estimado: "
                          : "Total: "}
                        {fmtBrl(Number(o.total))}
                      </strong>
                    </TableCell>
                    <TableCell>
                      <button
                        className="block text-blue-600"
                        onClick={() =>
                          setEditarOrdem({ ordem: o, fornecedor: f })
                        }
                      >
                        Abrir / editar
                      </button>
                      <button
                        className="block text-blue-600"
                        onClick={() => setLogisticaId(o.id)}
                      >
                        Frete e coleta
                      </button>
                      <button
                        className="block text-blue-600"
                        onClick={() => baixarOrdemCompraPdf(o, f)}
                      >
                        Baixar PDF
                      </button>
                      <button
                        className="block text-blue-600"
                        onClick={() => setAuditar(o.id)}
                      >
                        Vincular NF / conferir
                      </button>
                      <button
                        className="block text-red-600"
                        onClick={() =>
                          setExcluirOrdem({ ordem: o, fornecedor: f })
                        }
                      >
                        Excluir ordem
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex items-center justify-between text-xs">
            <Button
              size="sm"
              variant="outline"
              disabled={paginaOrdem === 0 || ordens.isFetching}
              onClick={() => setPaginaOrdem(p => p - 1)}
            >
              Anterior
            </Button>
            <span>Página {paginaOrdem + 1}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={(ordens.data?.length ?? 0) < 50 || ordens.isFetching}
              onClick={() => setPaginaOrdem(p => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </>
      )}
      <LogisticaOrdemModal
        id={logisticaId}
        fechar={() => setLogisticaId(null)}
      />
      <EditarOrdemModal
        registro={editarOrdem}
        fechar={() => setEditarOrdem(null)}
      />
      <AlertDialog
        open={excluirOrdem != null}
        onOpenChange={aberto => {
          if (!aberto) setExcluirOrdem(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir ordem OC-{excluirOrdem?.ordem.id}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A ordem sairá da lista e continuará preservada para
              rastreabilidade. Ordens com NF vinculada não podem ser excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removerOrdem.isPending}
              className="bg-red-600 hover:bg-red-700"
              onClick={event => {
                event.preventDefault();
                void confirmarExclusaoOrdem();
              }}
            >
              {removerOrdem.isPending ? "Excluindo..." : "Excluir ordem"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AuditoriaOrdem id={auditar} fechar={() => setAuditar(null)} />
    </div>
  );
}

function AuditoriaOrdem({
  id,
  fechar,
}: {
  id: number | null;
  fechar: () => void;
}) {
  const utils = trpc.useUtils();
  const [nf, setNf] = useState("");
  const q = trpc.compras.auditarOrdem.useQuery(
    { id: id ?? 0 },
    { enabled: id != null }
  );
  const nfs = trpc.nfCompra.listarImportacoes.useQuery(
    { limite: 200 },
    { enabled: id != null }
  );
  const vincular = trpc.compras.vincularNf.useMutation();
  const mpIds = new Set([
    ...(q.data?.ordem.itens.flatMap(i =>
      i.materiaPrimaId ? [i.materiaPrimaId] : []
    ) ?? []),
    ...(q.data?.recebidos.flatMap(r =>
      r.item.materiaPrimaId ? [r.item.materiaPrimaId] : []
    ) ?? []),
  ]);
  return (
    <Dialog
      open={id != null}
      onOpenChange={aberto => {
        if (!aberto) fechar();
      }}
    >
      <DialogContent className="!max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conferir OC-{id} com notas fiscais</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <select
            className={selectClass}
            value={nf}
            onChange={e => setNf(e.target.value)}
          >
            <option value="">Selecione uma NF concluída</option>
            {nfs.data
              ?.filter(n => n.status === "concluida")
              .map(n => (
                <option key={n.id} value={n.id}>
                  NF {n.numero} · {n.nomeFornecedor} · #{n.id}
                </option>
              ))}
          </select>
          <Button
            size="sm"
            disabled={!nf || !id || vincular.isPending}
            onClick={async () => {
              try {
                await vincular.mutateAsync({
                  ordemId: id!,
                  importacaoId: Number(nf),
                });
                await utils.compras.auditarOrdem.invalidate();
                await utils.compras.painel.invalidate();
                toast.success("NF vinculada à ordem.");
              } catch (e) {
                erro(e);
              }
            }}
          >
            Vincular
          </Button>
        </div>
        {q.isLoading ? (
          <Spinner />
        ) : q.error ? (
          <p>{q.error.message}</p>
        ) : (
          q.data && (
            <>
              <p className="text-xs">
                Notas vinculadas:{" "}
                {q.data.nfs.map(n => n.numero ?? n.id).join(", ") || "nenhuma"}.
                Quantidades agregadas por matéria-prima e unidade de consumo.
                Dimensões e especificações devem ser conferidas nas descrições
                originais.
              </p>
              <Table className={compacta}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matéria-prima</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Recebido</TableHead>
                    <TableHead>Conferência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...mpIds].map(mpId => {
                    const pedidos = q.data!.ordem.itens.filter(
                      i => i.materiaPrimaId === mpId
                    );
                    const recebidos = q.data!.recebidos.filter(
                      r => r.item.materiaPrimaId === mpId
                    );
                    const unidades = new Set(
                      [
                        ...pedidos.map(i => i.unidadeDestino),
                        ...recebidos.map(r => r.item.unidadeErp),
                      ]
                        .filter(Boolean)
                        .map(u => unidadeConsumo(u!))
                    );
                    const pendente =
                      pedidos.some(
                        i => !i.fatorConversao || !i.unidadeDestino
                      ) ||
                      recebidos.some(
                        r => !r.item.quantidadeErp || !r.item.unidadeErp
                      ) ||
                      unidades.size !== 1;
                    const qtdPedido = pedidos.reduce(
                      (s, i) => s + i.quantidade * (i.fatorConversao ?? 0),
                      0
                    );
                    const qtdRecebido = recebidos.reduce(
                      (s, r) => s + Number(r.item.quantidadeErp ?? 0),
                      0
                    );
                    return (
                      <TableRow key={mpId}>
                        <TableCell>
                          {pedidos[0]?.descricao ??
                            recebidos[0]?.item.descricaoNf}
                          <span className="block text-slate-500">
                            MP #{mpId}
                          </span>
                        </TableCell>
                        <TableCell>
                          {pendente
                            ? "Pendente"
                            : `${fmtNum(qtdPedido, 3)} ${[...unidades][0]}`}
                        </TableCell>
                        <TableCell>
                          {pendente
                            ? "Pendente"
                            : `${fmtNum(qtdRecebido, 3)} ${[...unidades][0]}`}
                        </TableCell>
                        <TableCell>
                          {pendente
                            ? "Revise a conversão"
                            : Math.abs(qtdPedido - qtdRecebido) < 1e-3
                              ? "Quantidade conferida"
                              : qtdRecebido > qtdPedido
                                ? "Recebido acima do pedido"
                                : "Recebimento parcial / faltante"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {(q.data.ordem.itens.some(i => !i.materiaPrimaId) ||
                q.data.recebidos.some(r => !r.item.materiaPrimaId)) && (
                <p className="text-amber-700 text-xs">
                  Há itens sem matéria-prima vinculada: a conferência está
                  incompleta.
                </p>
              )}
              <p className="text-xs text-slate-500">
                A comparação com fornecedores mais baratos está na aba Evolução
                e auditoria de preços, identificada pela NF e pela OC.
              </p>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
