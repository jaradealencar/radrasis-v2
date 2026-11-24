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
import { enviarArquivo } from "@/lib/upload";
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
  cotacoesMesmoEscopo,
  quantidadeAceitaNoRecebimento,
  COMPRADORES_RESPONSAVEIS,
  type DecisaoCotacaoCompra,
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
function chaveComprador(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

// O editor existente mantém os vínculos/calculadora; este bloco salva o documento completo.
export function SalvarCotacaoCompra({
  resultado,
  nomeArquivo,
  arquivoPdf,
  onAbrirOrdem,
  onSimulacaoChange,
}: {
  resultado: any;
  nomeArquivo: string;
  arquivoPdf: File | null;
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
  const [arquivoFonte, setArquivoFonte] = useState(() => ({
    arquivoPdfUrl: resultado.arquivoPdfUrl ?? null,
    arquivoPdfKey: resultado.arquivoPdfKey ?? null,
    arquivoPdfSha256: resultado.arquivoPdfSha256 ?? null,
    arquivoPdfTamanho: resultado.arquivoPdfTamanho ?? null,
  }));
  const [salvo, setSalvo] = useState<{ id: number; assinatura: string } | null>(
    null
  );
  const [enviandoCotacao, setEnviandoCotacao] = useState(false);
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
    ...arquivoFonte,
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
    if (enviandoCotacao) return;
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
      setEnviandoCotacao(true);
      if (controle.current.assinatura !== assinatura)
        controle.current = { assinatura, chave: crypto.randomUUID() };
      let arquivoAtual = arquivoFonte;
      if (!arquivoAtual.arquivoPdfUrl && arquivoPdf) {
        const enviado = await enviarArquivo("documento", arquivoPdf);
        const digest = await crypto.subtle.digest(
          "SHA-256",
          await arquivoPdf.arrayBuffer()
        );
        const sha256 = [...new Uint8Array(digest)]
          .map(byte => byte.toString(16).padStart(2, "0"))
          .join("");
        arquivoAtual = {
          arquivoPdfUrl: enviado.url,
          arquivoPdfKey: enviado.key,
          arquivoPdfSha256: sha256,
          arquivoPdfTamanho: enviado.fileSize,
        };
        setArquivoFonte(arquivoAtual);
      }
      const payloadComArquivo = { ...payload, ...arquivoAtual };
      const assinaturaComArquivo = JSON.stringify(payloadComArquivo);
      controle.current = { assinatura: assinaturaComArquivo, chave: controle.current.chave };
      const entrada = cotacaoCompraSchema.safeParse({
        ...payloadComArquivo,
        chave: controle.current.chave,
      });
      if (!entrada.success) {
        toast.error(
          `Confira os dados da cotação: ${entrada.error.issues[0]?.path.join(".")} - ${entrada.error.issues[0]?.message}`
        );
        return;
      }
      const res = await salvar.mutateAsync(entrada.data);
      setSalvo({ id: res.id, assinatura: assinaturaComArquivo });
      await utils.compras.listarCotacoes.invalidate();
      await utils.compras.painel.invalidate();
      toast.success(`Cotação #${res.id} salva no histórico.`);
      if (ordem) onAbrirOrdem(res.id);
    } catch (e) {
      erro(e);
    } finally {
      setEnviandoCotacao(false);
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
      <div className="rounded border bg-white px-3 py-2 text-xs text-slate-600">
        <strong>Documento da cotação:</strong> {nomeArquivo || "PDF não informado"} · {arquivoFonte.arquivoPdfUrl ? <><a className="text-blue-700 underline" href={arquivoFonte.arquivoPdfUrl} target="_blank" rel="noreferrer">abrir original</a>{arquivoFonte.arquivoPdfSha256 && <span> · SHA-256 {arquivoFonte.arquivoPdfSha256.slice(0, 16)}…</span>}</> : arquivoPdf ? "o PDF será armazenado ao salvar a cotação" : "sem arquivo original"}
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
        <strong className="block text-sm text-slate-800">
          Preço puro cotado x preço final — ICMS 10%
        </strong>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="block text-xs font-medium text-slate-500">
              Total puro cotado (sem frete/ICMS)
            </span>
            <strong className="mt-1 block text-lg leading-6 text-slate-900">
              {fmtBrl(simulacao.subtotalMercadoria)}
            </strong>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-500">
              Frete calculado
            </span>
            <strong className="mt-1 block text-lg leading-6 text-slate-900">
              {simulacao.valorFrete == null
                ? "Pendente"
                : fmtBrl(simulacao.valorFrete)}
            </strong>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-500">
              ICMS (10%)
            </span>
            <strong className="mt-1 block text-lg leading-6 text-slate-900">
              {simulacao.valorIcms == null
                ? "Pendente"
                : fmtBrl(simulacao.valorIcms)}
            </strong>
          </div>
          <div className="rounded-md bg-white/80 p-2 ring-1 ring-blue-200">
            <span className="block text-xs font-semibold text-emerald-800">
              Total final com frete + ICMS
            </span>
            <strong className="mt-1 block text-2xl leading-7 text-emerald-900">
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
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-blue-700">
            Comparar preço puro e preço final por item
          </summary>
          <div className="mt-2 space-y-2">
            {resultado.itens.map((item: any, indice: number) => {
              const linha = simulacao.itens[indice];
              const quantidade = Number(item.quantidade);
              const totalPuro = quantidade * Number(item.precoUnitario);
              return (
                <div
                  key={`${item.codigo ?? item.descricao}-${indice}`}
                  className="grid gap-2 border-t border-blue-100 pt-2 sm:grid-cols-[minmax(0,1fr)_minmax(260px,1fr)]"
                >
                  <span className="self-center text-xs text-slate-600">
                    {item.descricao} · {fmtNum(quantidade, 3)} {item.unidade}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded border bg-white p-2">
                      <span className="block text-[11px] font-medium text-slate-500">
                        Original puro
                      </span>
                      <strong className="block text-base text-slate-900">
                        {fmtBrl(Number(item.precoUnitario))}/{item.unidade}
                      </strong>
                      <span className="block text-xs text-slate-600">
                        Total do item: {fmtBrl(totalPuro)}
                      </span>
                    </div>
                    <div className="rounded border border-emerald-200 bg-emerald-50 p-2">
                      <span className="block text-[11px] font-medium text-emerald-800">
                        Final / un. · frete + ICMS
                      </span>
                      {linha ? (
                        <>
                          <strong className="block text-base text-emerald-900">
                            {fmtBrl(linha.custoFinalUnitario)}/{item.unidade}
                          </strong>
                          <span className="block text-xs text-emerald-800">
                            Total final do item: {fmtBrl(linha.custoFinalTotal)}
                          </span>
                        </>
                      ) : (
                        <strong className="block text-sm text-amber-800">
                          Pendente: informe frete e peso, se for por kg
                        </strong>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={salvar.isPending || enviandoCotacao || atualSalvo}
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
          disabled={salvar.isPending || enviandoCotacao}
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
  decisaoCotacao,
  fechar,
}: {
  cotacaoId: number | null;
  decisaoCotacao?: DecisaoCotacaoCompra | null;
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
            key={`${q.data.id}-${JSON.stringify(decisaoCotacao ?? null)}`}
            cotacao={q.data}
            cadastro={c.data}
            decisaoCotacao={decisaoCotacao ?? null}
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
  decisaoCotacao,
  fechar,
}: {
  cotacao: Cotacao;
  cadastro: Cadastro;
  decisaoCotacao: DecisaoCotacaoCompra | null;
  fechar: () => void;
}) {
  const utils = trpc.useUtils();
  const [dados, setDados] = useState(cadastro);
  const [tipo, setTipo] = useState<"empresa" | "pessoa">("empresa");
  const [nomeComprador, setNomeComprador] = useState("");
  const [descontoObtido, setDescontoObtido] = useState("0");
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
  const [dataPrevistaEntrega, setDataPrevistaEntrega] = useState("");
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
  const subtotalMercadorias = itensValidos
    ? linhasAtivas.reduce((s, i) => {
        const quantidade = numeroEditado(quantidades[i.id] ?? "")!;
        const preco = numeroEditado(precos[i.id] ?? "")!;
        return s + Math.round(quantidade * preco * 100) / 100;
      }, 0)
    : null;
  const totalBruto =
    subtotalMercadorias == null || freteCalculado.total == null
      ? null
      : subtotalMercadorias + freteCalculado.total;
  const descontoObtidoNumero = descontoObtido.trim()
    ? numeroEditado(descontoObtido)
    : 0;
  const descontoValido =
    totalBruto != null &&
    descontoObtidoNumero != null &&
    descontoObtidoNumero >= 0 &&
    descontoObtidoNumero <= totalBruto;
  const total =
    totalBruto == null || descontoObtidoNumero == null
      ? null
      : totalBruto - descontoObtidoNumero;
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
    if (!descontoValido) {
      toast.error(
        "Informe um desconto igual ou inferior ao total bruto da ordem."
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
        dataPrevistaEntrega: dataPrevistaEntrega || null,
        comparacaoCotacoes: decisaoCotacao,
        comprador: comprador.data,
        pagamento,
        condicaoPagamento: condicao,
        transportadora,
        numeroColeta: coleta,
        descontoTotal: descontoObtidoNumero ?? 0,
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
      if (ordem.statusAprovacao === "pendente") {
        toast.warning(`Ordem OC-${ordem.id} salva e aguardando aprovação; o PDF para envio ficará disponível depois.`);
      } else {
        baixarOrdemCompraPdf(ordem, cotacao.fornecedor);
        toast.success(`Ordem OC-${ordem.id} emitida e salva.`);
      }
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
        <datalist id="compradores-responsaveis-ordem">
          {COMPRADORES_RESPONSAVEIS.map(nome => (
            <option key={nome} value={nome} />
          ))}
        </datalist>
        <Input
          list="compradores-responsaveis-ordem"
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
        <Campo titulo="Data prevista de entrega (opcional)">
          <Input
            type="date"
            value={dataPrevistaEntrega}
            onChange={e => setDataPrevistaEntrega(e.target.value)}
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
        <Campo titulo="Desconto obtido no pedido (R$)">
          <Input
            inputMode="decimal"
            value={descontoObtido}
            onChange={e => setDescontoObtido(e.target.value)}
            placeholder="0,00"
          />
        </Campo>
      </div>
      <p className="text-xs text-slate-500">
        O desconto é registrado como bônus total do pedido. Ele não altera os
        preços unitários nem os totais dos itens.
      </p>
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
        <div className="space-y-1 text-sm">
          <div>
            {totalBruto == null
              ? subtotalMercadorias == null
                ? "Subtotal dos itens: revise os itens"
                : `Subtotal dos itens: ${fmtBrl(subtotalMercadorias)} · frete pendente`
              : `Subtotal + frete: ${fmtBrl(totalBruto)}`}
            {totalBruto != null && freteModo === "por_kg"
              ? " (estimado)"
              : ""}
          </div>
          <div>Desconto obtido: -{fmtBrl(descontoObtidoNumero ?? 0)}</div>
          <strong>
            Total líquido: {total == null ? "Não calculado até definir o frete" : fmtBrl(total)}
          </strong>
        </div>
        <Button
          disabled={
            emitir.isPending ||
            !itensValidos ||
            !expedicaoValida ||
            !pesoFreteKgValido ||
            !descontoValido ||
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
  onOrdem: (id: number, decisao?: DecisaoCotacaoCompra) => void;
}) {
  const utils = trpc.useUtils();
  const removerOrdem = trpc.compras.excluirOrdem.useMutation();
  const [aba, setAba] = useState<"cotacoes" | "evolucao" | "ordens" | "fornecedores">(
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
  const [receberOrdem, setReceberOrdem] = useState<CompraOrdemRegistro | null>(null);
  const [historicoComercialId, setHistoricoComercialId] = useState<number | null>(null);
  const [editarOrdem, setEditarOrdem] = useState<CompraOrdemRegistro | null>(
    null
  );
  const [excluirOrdem, setExcluirOrdem] = useState<CompraOrdemRegistro | null>(
    null
  );
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [cotacoesComparacao, setCotacoesComparacao] = useState<Cotacao[] | null>(null);
  const [buscaOrdem, setBuscaOrdem] = useState("");
  const [inicioOrdem, setInicioOrdem] = useState("");
  const [fimOrdem, setFimOrdem] = useState("");
  const [paginaOrdem, setPaginaOrdem] = useState(0);
  const [limiteAprovacaoInput, setLimiteAprovacaoInput] = useState("");
  const cotacoes = trpc.compras.listarCotacoes.useQuery();
  const ordens = trpc.compras.listarOrdens.useQuery({
    busca: buscaOrdem || undefined,
    inicio: inicioOrdem || undefined,
    fim: fimOrdem || undefined,
    pagina: paginaOrdem,
  });
  const descontosObtidos = trpc.compras.descontosObtidos.useQuery(
    { inicio: inicioOrdem || undefined, fim: fimOrdem || undefined },
    { enabled: aba === "ordens" }
  );
  const politicaAprovacao = trpc.compras.politicaAprovacao.useQuery(undefined, { enabled: aba === "ordens" });
  const salvarPolitica = trpc.compras.salvarPoliticaAprovacao.useMutation();
  const aprovarOrdem = trpc.compras.aprovarOrdem.useMutation();
  const indicadoresFornecedores = trpc.compras.indicadoresFornecedores.useQuery(undefined, { enabled: aba === "fornecedores" });
  const sincronizarCadastroFornecedores = trpc.compras.sincronizarCadastroFornecedores.useMutation();
  useEffect(() => {
    if (politicaAprovacao.data) setLimiteAprovacaoInput(politicaAprovacao.data.limiteAprovacao == null ? "" : String(politicaAprovacao.data.limiteAprovacao).replace(".", ","));
  }, [politicaAprovacao.data?.limiteAprovacao]);
  const descontosPorComprador = useMemo(() => {
    const agregados = new Map<
      string,
      { comprador: string; descontoTotal: number; quantidadeOrdens: number }
    >();
    for (const linha of descontosObtidos.data?.porComprador ?? []) {
      const chave = chaveComprador(linha.comprador);
      const atual = agregados.get(chave);
      if (atual) {
        atual.descontoTotal += linha.descontoTotal;
        atual.quantidadeOrdens += linha.quantidadeOrdens;
      } else {
        agregados.set(chave, { ...linha });
      }
    }
    const nomesConhecidos = new Map(
      COMPRADORES_RESPONSAVEIS.map(nome => [chaveComprador(nome), nome])
    );
    for (const [chave, nome] of nomesConhecidos) {
      if (!agregados.has(chave))
        agregados.set(chave, {
          comprador: nome,
          descontoTotal: 0,
          quantidadeOrdens: 0,
        });
    }
    return [...agregados.values()].sort(
      (a, b) => b.descontoTotal - a.descontoTotal || a.comprador.localeCompare(b.comprador, "pt-BR")
    );
  }, [descontosObtidos.data]);
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
  const salvarLimite = async () => {
    const valor = limiteAprovacaoInput.trim() ? Number(limiteAprovacaoInput.replace(",", ".")) : null;
    if (valor != null && (!Number.isFinite(valor) || valor <= 0)) {
      toast.error("Informe um valor maior que zero ou deixe em branco para não exigir aprovação por valor.");
      return;
    }
    try {
      await salvarPolitica.mutateAsync({ limiteAprovacao: valor });
      await Promise.all([politicaAprovacao.refetch(), ordens.refetch()]);
      toast.success(valor == null ? "Aprovação por valor desativada." : `Ordens a partir de ${fmtBrl(valor)} precisarão de aprovação.`);
    } catch (e) { erro(e); }
  };
  const aprovar = async (id: number) => {
    try {
      await aprovarOrdem.mutateAsync({ id });
      await Promise.all([ordens.refetch(), utils.compras.listarOrdens.invalidate()]);
      toast.success(`Ordem OC-${id} aprovada.`);
    } catch (e) { erro(e); }
  };
  const sincronizarFornecedores = async () => {
    try {
      const resultado = await sincronizarCadastroFornecedores.mutateAsync();
      await indicadoresFornecedores.refetch();
      toast.success(`${resultado.fornecedoresSincronizados} fornecedores sincronizados; ${resultado.cadastrosCriados} cadastros novos criados.`);
    } catch (e) { erro(e); }
  };
  const carregarComparacao = async () => {
    try {
      const ids = [...selecionadas].slice(0, 10);
      const completas = await Promise.all(
        ids.map(id => utils.compras.obterCotacao.fetch({ id }))
      );
      setCotacoesComparacao(completas);
    } catch (e) {
      erro(e);
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
            ["fornecedores", "Indicadores de fornecedores"],
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
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3">
            <p className="text-xs text-slate-600">
              Marque até 10 cotações para comparar escopo, preço final estimado, frete e condições.
            </p>
            <Button size="sm" variant="outline" disabled={selecionadas.size < 2 || selecionadas.size > 10} onClick={() => void carregarComparacao()}>
              Comparar {selecionadas.size ? `(${selecionadas.size})` : "cotações"}
            </Button>
          </div>
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
                  <TableHead className="w-12">Comparar</TableHead>
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
                      <input
                        type="checkbox"
                        aria-label={`Incluir cotação ${c.id} na comparação`}
                        checked={selecionadas.has(c.id)}
                        onChange={e => setSelecionadas(atual => {
                          const proximo = new Set(atual);
                          if (e.target.checked) {
                            if (proximo.size < 10) proximo.add(c.id);
                          } else proximo.delete(c.id);
                          return proximo;
                        })}
                      />
                    </TableCell>
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
                      {c.arquivoPdfUrl && (
                        <a className="block text-blue-600" href={c.arquivoPdfUrl} target="_blank" rel="noreferrer">
                          Ver PDF original
                        </a>
                      )}
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
          <div className="grid gap-2 rounded-lg border bg-slate-50 p-3 sm:grid-cols-[minmax(220px,1fr)_auto] sm:items-end">
            <div>
              <strong className="text-sm">Aprovação por exceção</strong>
              <p className="mt-1 text-xs text-slate-600">
                {politicaAprovacao.data?.limiteAprovacao == null
                  ? "Sem limite configurado: as ordens seguem sem etapa adicional."
                  : `Ordens com total líquido a partir de ${fmtBrl(politicaAprovacao.data.limiteAprovacao)} aguardam aprovação de gestor.`}
              </p>
            </div>
            {politicaAprovacao.data?.podeConfigurar && (
              <div className="flex items-end gap-2">
                <Campo titulo="Limite de aprovação (R$); vazio desativa">
                  <Input inputMode="decimal" value={limiteAprovacaoInput} onChange={e => setLimiteAprovacaoInput(e.target.value)} placeholder="Sem limite" />
                </Campo>
                <Button size="sm" disabled={salvarPolitica.isPending} onClick={() => void salvarLimite()}>
                  {salvarPolitica.isPending ? "Salvando..." : "Salvar limite"}
                </Button>
              </div>
            )}
          </div>
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
          {descontosObtidos.isLoading ? (
            <Spinner />
          ) : descontosObtidos.error ? (
            <p className="text-sm text-red-600">
              {descontosObtidos.error.message}
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_2fr]">
              <KpiCard
                label="Descontos obtidos"
                value={fmtBrl(descontosObtidos.data?.descontoTotal ?? 0)}
                sub={`${descontosObtidos.data?.quantidadeOrdens ?? 0} ordens no período selecionado`}
                tooltip="Soma dos descontos totais registrados nas ordens ativas. Os preços unitários dos itens permanecem sem alteração."
              />
              <div className="rounded-xl border bg-white p-3">
                <h3 className="mb-2 text-sm font-semibold">
                  Descontos por comprador
                </h3>
                <Table className={compacta}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Comprador responsável</TableHead>
                      <TableHead>Ordens</TableHead>
                      <TableHead className="text-right">
                        Desconto obtido
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {descontosPorComprador.map(linha => (
                      <TableRow key={linha.comprador}>
                        <TableCell>{linha.comprador}</TableCell>
                        <TableCell>{linha.quantidadeOrdens}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmtBrl(linha.descontoTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-2 text-[11px] text-slate-500">
                  Inclui todas as ordens ativas no período, independentemente
                  da página atual da lista.
                </p>
              </div>
            </div>
          )}
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
                      {o.dataPrevistaEntrega && <span className="block text-slate-500">Prevista: {fmtDate(o.dataPrevistaEntrega + "T12:00:00")}</span>}
                      <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${o.statusAprovacao === "pendente" ? "bg-amber-100 text-amber-900" : o.statusAprovacao === "aprovada" ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>
                        {o.statusAprovacao === "pendente" ? "Aprovação pendente" : o.statusAprovacao === "aprovada" ? `Aprovada por ${o.aprovacaoNome || "gestor"}` : "Fluxo direto"}
                      </span>
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
                      {Number(o.descontoTotal ?? 0) > 0 && (
                        <span className="block text-emerald-700">
                          Desconto obtido: -
                          {fmtBrl(Number(o.descontoTotal))}
                        </span>
                      )}
                      <strong>
                        {o.freteModo === "por_kg"
                          ? o.pesoPrevistoKg == null
                            ? "Total líquido sem frete: "
                            : "Total líquido estimado: "
                          : "Total líquido: "}
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
                        className={`block ${o.statusAprovacao === "pendente" ? "text-slate-400" : "text-blue-600"}`}
                        disabled={o.statusAprovacao === "pendente"}
                        onClick={() => baixarOrdemCompraPdf(o, f)}
                      >
                        {o.statusAprovacao === "pendente" ? "PDF após aprovação" : "Baixar PDF"}
                      </button>
                      {o.statusAprovacao === "pendente" && politicaAprovacao.data?.podeAprovar && (
                        <button className="block text-emerald-700" disabled={aprovarOrdem.isPending} onClick={() => void aprovar(o.id)}>
                          Aprovar ordem
                        </button>
                      )}
                      <button className="block text-blue-600" disabled={o.statusAprovacao === "pendente"} onClick={() => setReceberOrdem({ ordem: o, fornecedor: f })}>
                        Registrar recebimento
                      </button>
                      <button
                        className="block text-blue-600"
                        onClick={() => setAuditar(o.id)}
                      >
                        Vincular NF / conferir
                      </button>
                      <button className="block text-blue-600" onClick={() => setHistoricoComercialId(o.id)}>
                        Histórico comercial
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
      {aba === "fornecedores" && (
        <>
          {indicadoresFornecedores.isLoading ? <Spinner /> : indicadoresFornecedores.error ? (
            <p className="text-sm text-red-600">{indicadoresFornecedores.error.message}</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Matérias-primas conciliadas"
                  value={indicadoresFornecedores.data?.resumo.materiasPrimasConciliadas ?? 0}
                  sub="Vínculo válido em NF concluída"
                  tooltip="Conta MPs distintas que aparecem em NF concluída com quantidade, unidade de consumo e custo final válidos."
                />
                <KpiCard
                  label="Fornecedores cadastrados"
                  value={indicadoresFornecedores.data?.resumo.fornecedoresCadastrados ?? 0}
                  sub={`${indicadoresFornecedores.data?.resumo.cadastrosPendentes ?? 0} com cadastro a completar`}
                />
                <KpiCard
                  label="Fornecedores nas cotações"
                  value={indicadoresFornecedores.data?.resumo.fornecedoresNasCotacoes ?? 0}
                  sub={`${indicadoresFornecedores.data?.resumo.fornecedoresVinculadosAoCadastro ?? 0} vinculados ao cadastro`}
                  tooltip="O vínculo usa CNPJ e, quando ele não existe, nome normalizado sem ambiguidade."
                />
                <KpiCard
                  label="Fornecedores com compra registrada"
                  value={indicadoresFornecedores.data?.resumo.fornecedoresComCompraRegistrada ?? 0}
                  sub={`${indicadoresFornecedores.data?.resumo.documentosDeCompraNoCadastro ?? 0} NFs no cadastro de fornecedores`}
                />
                <KpiCard
                  label="Fornecedores com ordens"
                  value={indicadoresFornecedores.data?.fornecedores.length ?? 0}
                />
                <KpiCard
                  label="Valor líquido em ordens"
                  value={fmtBrl((indicadoresFornecedores.data?.fornecedores ?? []).reduce((s, f) => s + f.valorComprado, 0))}
                />
              </div>
              {(indicadoresFornecedores.data?.resumo.fornecedoresSemCadastro ?? 0) > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  <p>
                    {indicadoresFornecedores.data?.resumo.fornecedoresSemCadastro} fornecedor(es) das cotações ainda não estão vinculados ao cadastro. A sincronização cria ou encontra o cadastro sem registrar uma compra; somente uma NF identificada entra como compra.
                  </p>
                  <Button size="sm" variant="outline" disabled={sincronizarCadastroFornecedores.isPending} onClick={() => void sincronizarFornecedores()}>
                    {sincronizarCadastroFornecedores.isPending ? "Sincronizando..." : "Sincronizar cadastro"}
                  </Button>
                </div>
              ) : (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  Integração ativa: todos os fornecedores das cotações estão vinculados ao cadastro. Cotações salvas também criam ou localizam o fornecedor automaticamente.
                </p>
              )}
              <p className="text-xs text-slate-500">
                Indicadores calculados dos registros disponíveis. Prazo no prazo só considera ordens com data prevista preenchida; divergência de NF só é comparada quando há recebimento físico completo e unidade compatível.
              </p>
              <section className="space-y-2 rounded-lg border bg-white p-3">
                <div>
                  <h3 className="font-semibold">Fornecedores com maior frete por kg</h3>
                  <p className="text-xs text-slate-600">
                    Usa a cotação mais recente por fornecedor com tarifa ou peso suficiente para calcular R$/kg. A participação é frete rateado ÷ preço final da MP (mercadoria + frete + ICMS simulado de 10%).
                  </p>
                </div>
                {(indicadoresFornecedores.data?.cotacoesSemPesoParaFreteKg ?? 0) > 0 && (
                  <p className="text-xs text-amber-800">
                    {indicadoresFornecedores.data?.cotacoesSemPesoParaFreteKg} cotação(ões) com frete total sem peso não entram no ranking por kg.
                  </p>
                )}
                {!indicadoresFornecedores.data?.rankingFretePorKg.length ? (
                  <Empty><p>Não há cotações com base suficiente para comparar o frete por kg.</p></Empty>
                ) : (
                  <Table className={compacta}>
                    <TableHeader><TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Cotação mais recente com frete/kg</TableHead>
                      <TableHead>Frete (R$/kg)</TableHead>
                      <TableHead>Frete sobre preço final da MP</TableHead>
                      <TableHead>Preço final e participação por MP</TableHead>
                      <TableHead>Cadastro</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{indicadoresFornecedores.data?.rankingFretePorKg.map(f => (
                      <TableRow key={f.cnpj || f.fornecedor}>
                        <TableCell>
                          <strong>{f.fornecedor}</strong>
                          {f.cnpj && <span className="block text-xs text-slate-500">{f.cnpj}</span>}
                        </TableCell>
                        <TableCell>
                          #{f.cotacaoId} · {fmtDate(f.dataCotacao + "T12:00:00")}
                          <span className="block text-xs text-slate-500">
                            Validade: {f.validadeDias == null ? "não informada" : `${f.validadeDias} dias`}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">{fmtBrl(f.fretePorKg)} / kg</TableCell>
                        <TableCell className="font-semibold">
                          {f.percentualFretePrecoFinalMp == null ? "Sem peso ou MP conciliada" : `${fmtNum(f.percentualFretePrecoFinalMp, 2)}%`}
                        </TableCell>
                        <TableCell>
                          {f.materiasPrimas.length ? f.materiasPrimas.map(mp => (
                            <div key={mp.materiaPrimaId} className="border-b py-1 last:border-b-0">
                              <strong>{mp.nome}</strong>
                              <span className="block text-xs text-slate-600">
                                Final {fmtBrl(mp.precoFinalUnitario)}/{mp.unidade} · frete {fmtBrl(mp.freteUnitario)}/{mp.unidade} · {fmtNum(mp.percentualFretePrecoFinal, 2)}%
                              </span>
                            </div>
                          )) : <span className="text-slate-500">Sem MP conciliada na cotação</span>}
                        </TableCell>
                        <TableCell>
                          {f.cadastroFornecedorId == null ? <span className="text-red-700">Sem vínculo</span> : f.cadastroConcluido
                            ? <span className="text-emerald-700">Cadastrado</span>
                            : <span className="text-amber-700">Cadastro incompleto</span>}
                          {f.cadastroFornecedorNome && <span className="block text-xs text-slate-500">{f.cadastroFornecedorNome}</span>}
                        </TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                )}
              </section>
              {!indicadoresFornecedores.data?.fornecedores.length ? <Empty><p>Registre ordens e recebimentos para formar o histórico de fornecedores.</p></Empty> : (
                <Table className={compacta}>
                  <TableHeader><TableRow>
                    <TableHead>Fornecedor</TableHead><TableHead>Ordens</TableHead><TableHead>Valor líquido</TableHead>
                    <TableHead>Descontos</TableHead><TableHead>1º recebimento (dias)</TableHead><TableHead>Entregas no prazo</TableHead>
                    <TableHead>Recebimentos com recusa</TableHead><TableHead>Ordens com diferença NF</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{indicadoresFornecedores.data?.fornecedores.map(f => <TableRow key={f.cnpj || f.fornecedor}>
                    <TableCell><strong>{f.fornecedor}</strong>{f.cnpj && <span className="block text-slate-500">{f.cnpj}</span>}</TableCell>
                    <TableCell>{f.quantidadeOrdens}</TableCell><TableCell>{fmtBrl(f.valorComprado)}</TableCell><TableCell>{fmtBrl(f.descontos)}</TableCell>
                    <TableCell>{f.prazoMedioPrimeiroRecebimentoDias == null ? "Sem registros" : `${fmtNum(f.prazoMedioPrimeiroRecebimentoDias, 1)} dias`}</TableCell>
                    <TableCell>{f.percentualEntregaNoPrazo == null ? "Sem prazo registrado" : `${fmtNum(f.percentualEntregaNoPrazo, 1)}% (${f.ordensComPrazo} ordens)`}</TableCell>
                    <TableCell>{f.recebimentosComRecusa}</TableCell>
                    <TableCell>{f.ordensComDivergenciaNf}</TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              )}
            </>
          )}
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
      <RegistrarRecebimentoDialog registro={receberOrdem} fechar={() => setReceberOrdem(null)} />
      <HistoricoOrdemDialog id={historicoComercialId} fechar={() => setHistoricoComercialId(null)} />
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
      {cotacoesComparacao && (
        <CompararCotacoesDialog
          cotacoes={cotacoesComparacao}
          fechar={() => setCotacoesComparacao(null)}
          gerarOrdem={(id, decisao) => {
            setCotacoesComparacao(null);
            onOrdem(id, decisao);
          }}
        />
      )}
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
                    <TableHead>Recebimento (chegou / aceito)</TableHead>
                    <TableHead>Recusado</TableHead>
                    <TableHead>NF vinculada</TableHead>
                    <TableHead>Conferência 3 vias</TableHead>
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
                    const fisicos = q.data!.recebimentosFisicos.flatMap(r => r.itens).filter(
                      linha => pedidos.some(pedido => pedido.itemId === linha.itemId)
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
                    const qtdFisico = fisicos.reduce((soma, linha) => {
                      const pedido = pedidos.find(i => i.itemId === linha.itemId);
                      return soma + linha.quantidadeRecebida * (pedido?.fatorConversao ?? 0);
                    }, 0);
                    const qtdAceito = fisicos.reduce((soma, linha) => {
                      const pedido = pedidos.find(i => i.itemId === linha.itemId);
                      return soma + quantidadeAceitaNoRecebimento(linha) * (pedido?.fatorConversao ?? 0);
                    }, 0);
                    const qtdRecusada = fisicos.reduce((soma, linha) => {
                      const pedido = pedidos.find(i => i.itemId === linha.itemId);
                      return soma + linha.quantidadeRecusada * (pedido?.fatorConversao ?? 0);
                    }, 0);
                    const qtdNf = recebidos.reduce(
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
                          {pendente ? "Pendente conversão" : qtdFisico > 0
                            ? `${fmtNum(qtdFisico, 3)} ${[...unidades][0]} chegaram · ${fmtNum(qtdAceito, 3)} aceitas`
                            : "Não registrado"}
                        </TableCell>
                        <TableCell>
                          {pendente ? "Pendente conversão" : qtdRecusada > 0
                            ? `${fmtNum(qtdRecusada, 3)} ${[...unidades][0]}`
                            : "Nenhum"}
                        </TableCell>
                        <TableCell>
                          {pendente ? "Pendente conversão" : recebidos.length ? `${fmtNum(qtdNf, 3)} ${[...unidades][0]}` : "Sem NF vinculada"}
                        </TableCell>
                        <TableCell>
                          {pendente ? "Revise a conversão" : qtdFisico <= 0 ? "Aguardando recebimento físico" : qtdAceito + Math.max(1e-3, qtdPedido * 0.01) < qtdPedido ? qtdRecusada > 0 ? "Reposição / saldo aceito pendente" : "Recebimento parcial" : recebidos.length && Math.abs(qtdNf - qtdFisico) <= Math.max(1e-3, qtdFisico * 0.01) ? "NF confere com recebido" : recebidos.length ? "Diferença entre NF e recebimento" : "Aguardando NF"}
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
                A conferência compara a ordem, o recebimento físico registrado e as quantidades da NF. Diferenças pequenas até 1% aparecem como toleradas; confirme exceções antes de concluir a auditoria.
              </p>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

function CompararCotacoesDialog({
  cotacoes,
  fechar,
  gerarOrdem,
}: {
  cotacoes: Cotacao[];
  fechar: () => void;
  gerarOrdem: (id: number, decisao: DecisaoCotacaoCompra) => void;
}) {
  const [escolhida, setEscolhida] = useState(cotacoes[0]?.id ?? 0);
  const [motivo, setMotivo] = useState("");
  const comparacaoEquivalente = cotacoesMesmoEscopo(cotacoes.map(c => ({
    itens: c.itens.map(i => ({
      materiaPrimaId: i.materiaPrimaId,
      codigo: i.codigo,
      descricao: i.descricao,
      quantidade: Number(i.quantidade),
      unidade: i.unidade,
      unidadeDestino: i.unidadeDestino,
      fatorConversao: i.fatorConversao == null ? null : Number(i.fatorConversao),
    })),
  })));
  const calculos = cotacoes.map(c => {
    const freteModo = (c.freteModo ?? "valor_total") as ModoFreteCompra;
    const valorFrete = freteModo === "gratis"
      ? 0
      : c.freteValorInformado != null
        ? Number(c.freteValorInformado)
        : c.frete == null
          ? null
          : Number(c.frete);
    const simulacao = simularCustoFinalCotacao({
      itens: c.itens.map(i => ({ quantidade: Number(i.quantidade), unidade: i.unidade, precoUnitario: Number(i.precoUnitario) })),
      freteModo,
      valorFreteInformado: valorFrete,
      pesoTotalKg: c.pesoFreteKg == null ? null : Number(c.pesoFreteKg),
    });
    const totalOriginalComFrete = simulacao.valorFrete == null
      ? null
      : Number((simulacao.subtotalMercadoria + simulacao.valorFrete).toFixed(2));
    return { cotacao: c, totalOriginalComFrete, subtotalMercadoria: simulacao.subtotalMercadoria, totalFinal: simulacao.totalFinal };
  });
  const menorFinal = comparacaoEquivalente && calculos.every(c => c.totalFinal != null)
    ? Math.min(...calculos.map(c => c.totalFinal!))
    : null;
  const selecionada = calculos.find(c => c.cotacao.id === escolhida);
  const menorEscolhida = menorFinal != null && selecionada?.totalFinal != null && Math.abs(selecionada.totalFinal - menorFinal) <= 0.01;
  const justificativaObrigatoria = !menorEscolhida;
  const emitir = () => {
    if (!selecionada) return;
    const justificativa = motivo.trim() || (menorEscolhida
      ? "Menor preço final estimado entre propostas equivalentes."
      : "");
    if (justificativa.length < 3) return;
    gerarOrdem(escolhida, {
      cotacoesComparadasIds: cotacoes.map(c => c.id),
      cotacaoEscolhidaId: escolhida,
      motivoEscolha: justificativa,
    });
  };
  return (
    <Dialog open onOpenChange={aberto => { if (!aberto) fechar(); }}>
      <DialogContent className="!max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparar cotações salvas</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-slate-600">
          O preço final estimado inclui frete e ICMS simulado de 10%. Cotações sem peso ou frete definido ficam sem total final.
        </p>
        {!comparacaoEquivalente && (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            As cotações têm itens, unidades ou quantidades diferentes. Os totais aparecem para consulta, mas não são uma comparação equivalente; explique a escolha antes de gerar a ordem.
          </p>
        )}
        <Table className={compacta}>
          <TableHeader>
            <TableRow>
              <TableHead>Escolher</TableHead>
              <TableHead>Fornecedor / cotação</TableHead>
              <TableHead>Escopo</TableHead>
              <TableHead>Mercadoria + frete</TableHead>
              <TableHead>Final simulado</TableHead>
              <TableHead>Prazo / pagamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calculos.map(({ cotacao, totalOriginalComFrete, subtotalMercadoria, totalFinal }) => (
              <TableRow key={cotacao.id} className={cotacao.id === escolhida ? "bg-blue-50" : undefined}>
                <TableCell>
                  <input type="radio" name="cotacao-escolhida" checked={escolhida === cotacao.id} onChange={() => setEscolhida(cotacao.id)} aria-label={`Escolher ${cotacao.fornecedor}`} />
                </TableCell>
                <TableCell>
                  <strong>{cotacao.fornecedor}</strong>
                  <span className="block">#{cotacao.id} · {fmtDate(cotacao.dataCotacao + "T12:00:00")}</span>
                  {cotacao.arquivoPdfUrl && <a className="text-blue-700 underline" href={cotacao.arquivoPdfUrl} target="_blank" rel="noreferrer">PDF original</a>}
                </TableCell>
                <TableCell>{cotacao.itens.length} itens{comparacaoEquivalente ? " · equivalente" : " · diferente"}</TableCell>
                <TableCell>{totalOriginalComFrete == null ? <>Mercadoria {fmtBrl(subtotalMercadoria)}<span className="block text-amber-700">Frete pendente</span></> : fmtBrl(totalOriginalComFrete)}</TableCell>
                <TableCell className="font-semibold">{totalFinal == null ? "Pendente: frete/peso" : fmtBrl(totalFinal)}{totalFinal != null && totalFinal === menorFinal && comparacaoEquivalente && <span className="block text-emerald-700">Menor estimativa</span>}</TableCell>
                <TableCell>{cotacao.prazoEntrega || "Prazo não informado"}<span className="block">{cotacao.condicaoPagamento || "Pagamento não informado"}</span></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Campo titulo={justificativaObrigatoria ? "Motivo da escolha (obrigatório)" : "Motivo da escolha (opcional)"}>
          <Input maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder={menorEscolhida ? "Menor preço final estimado entre propostas equivalentes" : "Ex.: prazo, disponibilidade, especificação ou condição comercial"} />
        </Campo>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={fechar}>Fechar</Button>
          <Button disabled={!selecionada || (justificativaObrigatoria && motivo.trim().length < 3)} onClick={emitir}>Gerar ordem da escolhida</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function dataLocalCampoGrande() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Campo_Grande" }).format(new Date());
}

function RegistrarRecebimentoDialog({
  registro,
  fechar,
}: {
  registro: CompraOrdemRegistro | null;
  fechar: () => void;
}) {
  const utils = trpc.useUtils();
  const ordem = registro?.ordem;
  const [dataRecebimento, setDataRecebimento] = useState(dataLocalCampoGrande());
  const [observacoes, setObservacoes] = useState("");
  const [quantidades, setQuantidades] = useState<Record<number, string>>({});
  const [recusadas, setRecusadas] = useState<Record<number, string>>({});
  const auditoria = trpc.compras.auditarOrdem.useQuery(
    { id: ordem?.id ?? 0 },
    { enabled: ordem != null }
  );
  const salvar = trpc.compras.registrarRecebimento.useMutation();
  useEffect(() => {
    setDataRecebimento(dataLocalCampoGrande());
    setObservacoes("");
    setQuantidades({});
    setRecusadas({});
  }, [ordem?.id]);
  const recebidoAntes = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const recebimento of auditoria.data?.recebimentosFisicos ?? []) {
      for (const linha of recebimento.itens) mapa.set(linha.itemId, (mapa.get(linha.itemId) ?? 0) + quantidadeAceitaNoRecebimento(linha));
    }
    return mapa;
  }, [auditoria.data?.recebimentosFisicos]);
  const confirmar = async () => {
    if (!ordem) return;
    const linhas = ordem.itens.map(item => ({
      itemId: item.itemId,
      quantidadeRecebida: Number((quantidades[item.itemId] ?? "0").replace(",", ".")),
      quantidadeRecusada: Number((recusadas[item.itemId] ?? "0").replace(",", ".")),
    }));
    try {
      await salvar.mutateAsync({ ordemId: ordem.id, dataRecebimento, observacoes, itens: linhas });
      await Promise.all([
        utils.compras.auditarOrdem.invalidate({ id: ordem.id }),
        utils.compras.indicadoresFornecedores.invalidate(),
        utils.compras.listarOrdens.invalidate(),
      ]);
      toast.success(`Recebimento registrado para OC-${ordem.id}.`);
      fechar();
    } catch (e) { erro(e); }
  };
  return (
    <Dialog open={registro != null} onOpenChange={aberto => { if (!aberto) fechar(); }}>
      <DialogContent className="!max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Recebimento físico — OC-{ordem?.id}</DialogTitle></DialogHeader>
        {auditoria.isLoading ? <Spinner /> : auditoria.error ? <p className="text-red-600">{auditoria.error.message}</p> : ordem && (
          <>
            {ordem.statusAprovacao === "pendente" && <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">A ordem precisa ser aprovada antes de registrar o recebimento.</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              <Campo titulo="Data do recebimento"><Input type="date" value={dataRecebimento} onChange={e => setDataRecebimento(e.target.value)} /></Campo>
              <Campo titulo="Observações (opcional)"><Input value={observacoes} maxLength={2000} onChange={e => setObservacoes(e.target.value)} placeholder="Ex.: entrega parcial, embalagem avariada" /></Campo>
            </div>
            <Table className={compacta}>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Pedido</TableHead><TableHead>Já aceito</TableHead><TableHead>Recebido agora</TableHead><TableHead>Recusado</TableHead></TableRow></TableHeader>
              <TableBody>{ordem.itens.map(item => {
                const anterior = recebidoAntes.get(item.itemId) ?? 0;
                const restante = Math.max(0, item.quantidade - anterior);
                return <TableRow key={item.itemId}>
                  <TableCell>{item.descricao}<span className="block text-slate-500">{item.codigo || ""} {item.unidade}</span></TableCell>
                  <TableCell>{fmtNum(item.quantidade, 3)} {item.unidade}</TableCell>
                  <TableCell>{fmtNum(anterior, 3)} {item.unidade}</TableCell>
                  <TableCell><Input type="number" min="0" max={restante} step="any" value={quantidades[item.itemId] ?? ""} onChange={e => setQuantidades(v => ({ ...v, [item.itemId]: e.target.value }))} aria-label={`Quantidade recebida de ${item.descricao}`} /></TableCell>
                  <TableCell><Input type="number" min="0" step="any" value={recusadas[item.itemId] ?? ""} onChange={e => setRecusadas(v => ({ ...v, [item.itemId]: e.target.value }))} aria-label={`Quantidade recusada de ${item.descricao}`} /></TableCell>
                </TableRow>;
              })}</TableBody>
            </Table>
            <p className="text-xs text-slate-500">Informe a quantidade física que chegou. A quantidade recusada fica registrada para o histórico do fornecedor e continua visível na conferência com a NF.</p>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={fechar}>Cancelar</Button><Button disabled={salvar.isPending || ordem.statusAprovacao === "pendente"} onClick={() => void confirmar()}>{salvar.isPending ? "Salvando..." : "Registrar recebimento"}</Button></div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistoricoOrdemDialog({ id, fechar }: { id: number | null; fechar: () => void }) {
  const historico = trpc.compras.historicoOrdem.useQuery({ id: id ?? 0 }, { enabled: id != null });
  const resumo = (snapshot: unknown) => {
    if (!snapshot || typeof snapshot !== "object") return "—";
    const dado = snapshot as Record<string, unknown>;
    const itens = Array.isArray(dado.itens) ? dado.itens.length : null;
    return [
      dado.total != null ? `Total ${fmtBrl(Number(dado.total))}` : null,
      dado.descontoTotal != null && Number(dado.descontoTotal) > 0 ? `desconto ${fmtBrl(Number(dado.descontoTotal))}` : null,
      itens != null ? `${itens} itens` : null,
      dado.nomeComprador ? `comprador ${String(dado.nomeComprador)}` : null,
      dado.statusAprovacao ? String(dado.statusAprovacao) : null,
    ].filter(Boolean).join(" · ");
  };
  return (
    <Dialog open={id != null} onOpenChange={aberto => { if (!aberto) fechar(); }}>
      <DialogContent className="!max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Histórico comercial — OC-{id}</DialogTitle></DialogHeader>
        {historico.isLoading ? <Spinner /> : historico.error ? <p className="text-red-600">{historico.error.message}</p> : !historico.data?.length ? <Empty><p>Sem alterações registradas.</p></Empty> : (
          <div className="space-y-3">{historico.data.map(e => (
            <div key={e.id} className="rounded-lg border bg-white p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><strong>{e.evento.replaceAll("_", " ")}</strong><span>{fmtDate(e.createdAt)} · {e.nomeUsuario || "Usuário não informado"}</span></div>
              {e.motivo && <p className="mt-1 text-slate-600">{e.motivo}</p>}
              <p className="mt-2 text-xs text-slate-500">Antes: {resumo(e.antes)}<br />Depois: {resumo(e.depois)}</p>
              <details className="mt-2 text-xs"><summary className="cursor-pointer text-blue-700">Ver snapshot completo</summary><pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-50 p-2">{JSON.stringify({ antes: e.antes, depois: e.depois }, null, 2)}</pre></details>
            </div>
          ))}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
