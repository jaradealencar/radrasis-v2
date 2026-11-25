import { useState, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import ModalCalculadoraFator from "@/components/ModalCalculadoraFator";
import {
  ComprasHistorico,
  OrdemCompraModal,
  SalvarCotacaoCompra,
  type SimulacaoFinalCotacao,
} from "./ComprasGestao";
import { SelecionarOrdemNf, type OrdemFrete } from "./ComprasLogistica";
import { CotacaoComparativoConsumo } from "./CotacaoComparativoConsumo";
import { medidasChapaMm } from "@shared/compras-chapas";
import { calcularRateioFrete, type BaseValorRateioFrete, type CriterioRateioFrete, type ModoFreteNf } from "@shared/nf-frete";
import { trpc } from "@/lib/trpc";
import { fmtBrl, fmtNum, fmtPct } from "@/lib/format";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Upload,
  Brain,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  Sparkles,
  Info,
  Calculator,
  BarChart3,
  FileSpreadsheet,
  History,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Layers,
} from "lucide-react";

interface ItemEditavel {
  numeroItem: number;
  codigoFornecedor: string;
  descricaoNf: string;
  ncm: string | null;
  unidadeCompra: string;
  unidadeCompraConversao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotalItem: number;
  valorIpi: number;
  pesoUnitarioFreteKg: number | null;
  pesoUnitarioFreteKgTexto: string;
  materiaPrimaId: number | null;
  nomeMateriaPrima: string | null;
  unidadeErp: "KG" | "ML" | "M2" | "UN" | "LT" | null;
  unidadeErpCadastro: "KG" | "ML" | "M2" | "UN" | "LT" | null;
  fatorConversao: number | null;
  fatorConversaoTexto?: string;
  origemFator: string | null;
  baseCalculoTexto: string | null;
  confianca: "alta" | "media" | "baixa" | "nenhuma";
  pendencias: string[];
  custoCadastrado: number | null;
  // Dados tecnicos da MP para calculo de peso (frete por kg)
  espessuraMm: number | null;
  densidadeKgM3: number | null;
  larguraMm: number | null;
  alturaMm: number | null;
  perfilFormato: string | null;
}

interface CabecalhoNf {
  numero?: string;
  serie?: string;
  chaveAcesso?: string | null;
  dataEmissao?: string | null;
  cnpjFornecedor: string;
  nomeFornecedor?: string;
  valorProdutos: number;
  valorFreteNf: number;
  pesoLiquidoTotalKg: number | null;
}

function normalizarUnidadeAuditoria(unidade: string | null | undefined): string {
  const texto = (unidade ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (texto.includes("metro linear") || texto === "ml" || texto === "m" || texto === "mt") return "ML";
  if (texto.includes("metro quadrado") || texto === "m2" || texto === "m²") return "M2";
  if (["kg", "kgm", "kgs"].includes(texto) || texto.includes("quilograma")) return "KG";
  if (texto.includes("litro") || texto === "lt" || texto === "l") return "LT";
  if (
    texto.includes("unidade") ||
    ["un", "und", "unid", "pc", "pcs", "pce", "pct", "pacote", "pacotes", "cx", "cxs", "caixa", "caixas", "fdo", "fardo", "fardos", "kit", "rl", "rolo", "rolos", "bobina", "bobinas"].includes(texto)
  ) return "UN";
  return texto.toUpperCase();
}

function lerFatorManual(texto: string): number | null {
  const normalizado = texto.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalizado || !/^[+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalizado)) return null;
  const valor = Number(normalizado);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  const fator = Number(valor.toFixed(8));
  return fator > 0 ? fator : null;
}

function lerPesoUnitarioFreteKg(texto: string): number | null {
  const normalizado = texto.trim().replace(",", ".");
  if (!normalizado || /\.$/.test(normalizado) || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalizado)) return null;
  const valor = Number(normalizado);
  return Number.isFinite(valor) && valor >= 0 ? valor : null;
}

function normalizarUnidadeErpMateriaPrima(unidade: string | null | undefined): "KG" | "ML" | "M2" | "UN" | "LT" {
  const normalizada = normalizarUnidadeAuditoria(unidade);
  if (normalizada === "KG" || normalizada === "ML" || normalizada === "M2" || normalizada === "LT") return normalizada;
  return "UN";
}

function descricaoIndicaPacote(texto: string): boolean {
  const normalizada = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /\b(caixa|cx|pacote|pct|kit|fardo|conjunto|rolos?|unidades? por|c\s*\/\s*\d+|com\s+\d+\s*(?:rolos?|unidades?|pecas?))\b/.test(normalizada);
}

function formatarCustoUnitarioAuditoria(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return "—";
  return Math.abs(valor) < 0.01 ? "R$ " + fmtNum(valor, 6) : fmtBrl(valor);
}

function formatarRateioFrete(valor: number): string {
  return "R$ " + fmtNum(valor, 4);
}

function pesoLinhaFreteKg(item: ItemEditavel): number {
  if (normalizarUnidadeAuditoria(item.unidadeCompra) === "KG") return Math.max(0, item.quantidade);
  return Math.max(0, item.quantidade) * Math.max(0, item.pesoUnitarioFreteKg ?? 0);
}

export default function NfCompraAuditoria() {
  const utils = trpc.useUtils();
  const [abaAtiva, setAbaAtiva] = useState<"importar" | "painel" | "cotacao_pdf" | "memoria" | "historico">("importar");
  const [cotacaoOrdemId, setCotacaoOrdemId] = useState<number | null>(null);
  const [cotacaoOrdemDecisao, setCotacaoOrdemDecisao] = useState<import("@shared/compras-cotacoes").DecisaoCotacaoCompra | null>(null);
  const [versaoEditorCotacao, setVersaoEditorCotacao] = useState(0);

  // Estado para modal de Histórico de Compras da Matéria-Prima
  const [mpHistoricoSelecionada, setMpHistoricoSelecionada] = useState<{ id: number; nome: string } | null>(null);

  // Estado para cotação em PDF
  const [fornecedorCadastro, setFornecedorCadastro] = useState<{ id: number; nome: string; totalCompras: number; cadastroConcluido: boolean } | null>(null);
  const [arquivoPdfNome, setArquivoPdfNome] = useState<string>("");
  const [arquivoPdf, setArquivoPdf] = useState<File | null>(null);
  const [cotacaoPdfResultado, setCotacaoPdfResultado] = useState<any | null>(null);
  const [cotacaoSimulacao, setCotacaoSimulacao] =
    useState<SimulacaoFinalCotacao | null>(null);
  const [itemCotacaoEmEdicao, setItemCotacaoEmEdicao] = useState<number | null>(null);
  const [itemCotacaoCalculadora, setItemCotacaoCalculadora] = useState<number | null>(null);
  const [buscaMateriaPrimaCotacao, setBuscaMateriaPrimaCotacao] = useState("");

  // Origem da compra (Interestadual vs Local/Dentro de MS)
  const [origemCompra, setOrigemCompra] = useState<"interestadual" | "local">("interestadual");

  // Configurações do frete e ICMS (strings no estado para permitir digitação livre de vírgula/ponto)
  const [modoFrete, setModoFrete] = useState<ModoFreteNf>("por_kg");
  const [criterioRateioFrete, setCriterioRateioFrete] = useState<CriterioRateioFrete>("valor");
  const [baseValorRateioFrete, setBaseValorRateioFrete] = useState<BaseValorRateioFrete>("valor_total");
  const [freteValorStr, setFreteValorStr] = useState<string>("2,50");
  const [percentualIcmsStr, setPercentualIcmsStr] = useState<string>("10");

  // Aceita tanto decimal brasileiro (1.234,56) quanto ponto decimal (1234.56).
  const parseNumSeguro = (val: string, fallback = 0) => {
    if (!val) return fallback;
    let limpo = val.trim().replace(/[^\d,.-]/g, "");
    if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
    const n = Number(limpo);
    return Number.isFinite(n) ? n : fallback;
  };

  const [cabecalho, setCabecalho] = useState<CabecalhoNf | null>(null);
  const [ordemNf, setOrdemNf] = useState<OrdemFrete | null>(null);
  const valorFreteLido = parseNumSeguro(freteValorStr, 0);
  const freteValor = modoFrete === "gratis"
    ? 0
    : ordemNf?.ordem.freteModo === "gratis" ? 0 : ordemNf?.ordem.freteModo === "por_kg" ? Number((Number(ordemNf.ordem.freteValorInformado ?? 0) * (cabecalho?.pesoLiquidoTotalKg ?? 0)).toFixed(2)) : Number(valorFreteLido.toFixed(modoFrete === "por_kg" ? 4 : 2));
  const percentualIcms = Number(parseNumSeguro(percentualIcmsStr, 0).toFixed(2));

  // Estado da NF carregada
  const [xmlTexto, setXmlTexto] = useState<string>("");

  const [itens, setItens] = useState<ItemEditavel[]>([]);
  const [itemEmEdicao, setItemEmEdicao] = useState<number | null>(null);
  const [itemCalculadoraFator, setItemCalculadoraFator] = useState<number | null>(null);
  const [buscaMp, setBuscaMp] = useState<string>("");

  // Queries e mutations tRPC
  const processarXmlMutation = trpc.nfCompra.processarXml.useMutation();
  const calcularPreviaMutation = trpc.nfCompra.calcularPrevia.useMutation();
  const salvarMutation = trpc.nfCompra.salvarEGravarMemoria.useMutation();
  const buscarMpsQuery = trpc.nfCompra.buscarMateriasPrimas.useQuery(
    { busca: buscaMp, limite: 15 },
    { enabled: buscaMp.trim().length >= 2 }
  );
  const buscarMpsCotacaoQuery = trpc.nfCompra.buscarMateriasPrimas.useQuery(
    { busca: buscaMateriaPrimaCotacao, limite: 10 },
    { enabled: itemCotacaoEmEdicao !== null && buscaMateriaPrimaCotacao.trim().length >= 2 }
  );
  const memoriasQuery = trpc.nfCompra.listarMemoriaPorFornecedor.useQuery(
    { cnpjFornecedor: cabecalho?.cnpjFornecedor },
    { enabled: abaAtiva === "memoria" }
  );

  // Queries para as novas funções solicitadas
  const painelDivergenciasQuery = trpc.nfCompra.obterPainelDivergencias.useQuery(undefined, {
    enabled: abaAtiva === "painel",
  });

  const historicoMpQuery = trpc.nfCompra.historicoPorMateriaPrima.useQuery(
    { materiaPrimaId: mpHistoricoSelecionada?.id ?? 0 },
    { enabled: mpHistoricoSelecionada !== null }
  );

  const analisarCotacaoPdfMutation = trpc.nfCompra.analisarCotacaoPdf.useMutation();
  const sincronizarEspelhoMubiSysMutation = trpc.nfCompra.sincronizarEspelhoMubiSys.useMutation();
  const [sincronizandoMubiSys, setSincronizandoMubiSys] = useState(false);

  const handleSincronizarMubiSys = async () => {
    if (sincronizandoMubiSys) return;
    setSincronizandoMubiSys(true);
    let espelhoSincronizado = false;
    try {
      const resultado = await sincronizarEspelhoMubiSysMutation.mutateAsync();
      espelhoSincronizado = true;
      const idsVinculados = [...new Set(
        itens
          .map(item => item.materiaPrimaId)
          .filter((id): id is number => id != null)
      )];

      if (idsVinculados.length) {
        const materiasAtualizadas = [];
        for (let inicio = 0; inicio < idsVinculados.length; inicio += 200) {
          const lote = idsVinculados.slice(inicio, inicio + 200);
          materiasAtualizadas.push(...await utils.nfCompra.buscarMateriasPrimasPorIds.fetch({ ids: lote }));
        }
        const porId = new Map(materiasAtualizadas.map(materia => [materia.id, materia]));
        setItens(prev => prev.map(item => {
          if (item.materiaPrimaId == null) return item;
          const materiaAtualizada = porId.get(item.materiaPrimaId);
          if (!materiaAtualizada) return item;
          if (
            item.nomeMateriaPrima === materiaAtualizada.nome &&
            item.custoCadastrado === materiaAtualizada.custoUnitario
          ) return item;
          return {
            ...item,
            nomeMateriaPrima: materiaAtualizada.nome,
            custoCadastrado: materiaAtualizada.custoUnitario,
          };
        }));
      }

      void utils.nfCompra.buscarMateriasPrimas.invalidate();
      toast.success(
        idsVinculados.length
          ? `Espelho do MubiSys atualizado: ${fmtNum(resultado.materiasPrimas)} matérias-primas sincronizadas e dados aplicados aos itens vinculados desta NF. Fatores e unidades foram preservados.`
          : `Espelho do MubiSys atualizado: ${fmtNum(resultado.materiasPrimas)} matérias-primas sincronizadas. Esta NF ainda não tem itens vinculados.`
      );
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : "Tente novamente em instantes.";
      toast.error(
        espelhoSincronizado
          ? `Espelho do MubiSys sincronizado, mas os itens desta NF não puderam ser atualizados: ${detalhe}`
          : `Falha ao sincronizar os dados do MubiSys: ${detalhe}`
      );
    } finally {
      setSincronizandoMubiSys(false);
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivoPdf(file);
    setArquivoPdfNome(file.name);
    setCotacaoPdfResultado(null);
    setCotacaoSimulacao(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(",")[1];
      if (base64) {
        analisarCotacaoPdfMutation.mutate(
          { pdfBase64: base64, nomeArquivo: file.name },
          {
              onSuccess: (data) => { setCotacaoSimulacao(null); setCotacaoPdfResultado(data); setVersaoEditorCotacao(v => v + 1); void utils.suppliers.list.invalidate(); },
            onError: (error) => toast.error(error.message),
          }
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const vincularMateriaPrimaCotacao = async (indice: number, mp: any) => {
    const cotacao = cotacaoPdfResultado;
    const item = cotacao?.itens?.[indice];
    if (!cotacao || !item) return;

    try {
      const historico = await utils.nfCompra.historicoCotacaoPorMateriaPrima.fetch({
        materiaPrimaId: mp.id,
        cnpjFornecedor: cotacao.cnpjFornecedor || undefined,
        fornecedor: cotacao.fornecedor || undefined,
        precoCotado: item.precoUnitario,
        unidadeCotada: item.unidade,
        dataReferencia: /^\d{4}-\d{2}-\d{2}$/.test(cotacao.dataCotacao ?? "") ? cotacao.dataCotacao : undefined,
        excluirCotacaoId: cotacao.salvoId,
      });

      setCotacaoPdfResultado((atual: any) => {
        if (!atual) return atual;
        return {
          ...atual,
          itens: atual.itens.map((linha: any, linhaIdx: number) => linhaIdx === indice
            ? {
                ...linha,
                materiaPrimaVinculada: {
                  id: mp.id,
                  nome: mp.nome,
                  mubisysId: mp.mubisysId,
                  custoUnitarioMubisys: mp.custoUnitario,
                  unidadeMubisys: mp.unidadeMedida,
                },
                fatorConversaoCotacao: normalizarUnidadeAuditoria(item.unidade) === normalizarUnidadeAuditoria(mp.unidadeMedida) ? 1 : null,
                unidadeOrigemConversaoCotacao: item.unidade,
                unidadeDestinoConversaoCotacao: mp.unidadeMedida,
                baseCalculoConversaoCotacao: null,
                origemVinculo: "vínculo manual",
                ...historico,
                variacaoPrecoCotadoVsMubisys: null,
                semHistoricoCompras: !historico.ultimaCompraGeral,
              }
            : linha),
        };
      });
      toast.success("Matéria-prima vinculada; histórico e comparação atualizados.");
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : "Tente novamente.";
      toast.error(`Não foi possível carregar o histórico desta matéria-prima: ${detalhe}`);
    } finally {
      setItemCotacaoEmEdicao(null);
      setBuscaMateriaPrimaCotacao("");
    }
  };

  // Leitura do arquivo XML via drag-and-drop ou file input
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const conteudo = String(event.target?.result ?? "");
      setXmlTexto(conteudo);
      rodarParseXml(conteudo);
    };
    reader.readAsText(file);
  };

  const rodarParseXml = (conteudoXml: string) => {
    processarXmlMutation.mutate(
      {
        xmlConteudo: conteudoXml,
        freteModo: modoFrete,
        freteValor,
        percentualIcms,
      },
      {
        onSuccess: (data) => {
          setCabecalho(data.cabecalho);
          setOrdemNf(null);
          setFornecedorCadastro(data.fornecedorCadastro);
          void utils.suppliers.list.invalidate();
          setItens(
            data.itens.map((i) => ({
              numeroItem: i.numeroItem,
              codigoFornecedor: i.codigoFornecedor,
              descricaoNf: i.descricaoNf,
              ncm: i.ncm,
              unidadeCompra: i.unidadeCompra,
              unidadeCompraConversao: i.unidadeCompraConversao ?? i.unidadeCompra,
              quantidade: i.quantidade,
              valorUnitario: i.valorUnitario,
              valorTotalItem: i.valorTotalItem,
              valorIpi: i.valorIpi ?? 0,
              pesoUnitarioFreteKg: i.pesoUnitarioFreteKg ?? null,
              pesoUnitarioFreteKgTexto: i.pesoUnitarioFreteKg != null ? String(i.pesoUnitarioFreteKg) : "",
              materiaPrimaId: i.materiaPrimaId,
              nomeMateriaPrima: i.nomeMateriaPrima,
              unidadeErp: i.unidadeErp as any,
              unidadeErpCadastro: i.unidadeErpCadastro as any,
              fatorConversao: i.fatorConversao,
              fatorConversaoTexto: i.fatorConversao != null ? String(i.fatorConversao) : "",
              origemFator: i.origemFator,
              baseCalculoTexto: i.baseCalculoTexto,
              confianca: i.confianca,
              pendencias: i.pendencias,
              custoCadastrado: i.custoCadastrado,
              espessuraMm: i.espessuraMm ?? null,
              densidadeKgM3: i.densidadeKgM3 ?? null,
              larguraMm: i.larguraMm ?? null,
              alturaMm: i.alturaMm ?? null,
              perfilFormato: i.perfilFormato ?? null,
            }))
          );
        },
      }
    );
  };

  // Cálculo ao vivo derivado
  const calculoAoVivo = useMemo(() => {
    if (!cabecalho || itens.length === 0) return null;
    const rateio = calcularRateioFrete({
      modo: modoFrete,
      valor: freteValor,
      criterio: criterioRateioFrete,
      baseValor: baseValorRateioFrete,
      itens: itens.map((item) => ({
        quantidade: item.quantidade,
        unidadeCompra: normalizarUnidadeAuditoria(item.unidadeCompra),
        valorTotalItem: item.valorTotalItem,
        valorIpi: item.valorIpi,
        pesoKg: pesoLinhaFreteKg(item),
      })),
    });

    let totalFrete = 0;
    let totalIcms = 0;
    let totalCustoGeral = 0;

    const itensCalculados = itens.map((item, idx) => {
      const pesoItemKg = pesoLinhaFreteKg(item);
      const rateioFrete = rateio.itens[idx] ?? 0;

      const rateioIcms = Number(((item.valorTotalItem + rateioFrete) * (percentualIcms / 100)).toFixed(4));
      const custoItemTotal = Number((item.valorTotalItem + rateioFrete + rateioIcms).toFixed(4));

      totalFrete += rateioFrete;
      totalIcms += rateioIcms;
      totalCustoGeral += custoItemTotal;

      const origemNormalizada = normalizarUnidadeAuditoria(item.unidadeCompraConversao);
      const destinoNormalizado = normalizarUnidadeAuditoria(item.unidadeErp);
      const exigeConversao = Boolean(item.unidadeErp && origemNormalizada !== destinoNormalizado);
      const conversaoPendente = exigeConversao && !(item.fatorConversao && item.fatorConversao > 0);
      const unidadeComparavelComMubiSys = item.unidadeErpCadastro != null &&
        item.unidadeErp === item.unidadeErpCadastro;
      let custoRealErp = 0;
      let divergenciaPct: number | null = null;
      let defasado = false;

      if (conversaoPendente) {
        custoRealErp = 0;
      } else if (item.fatorConversao && item.fatorConversao > 0) {
        const qtdErp = item.quantidade * item.fatorConversao;
        custoRealErp = qtdErp > 0 ? Number((custoItemTotal / qtdErp).toFixed(6)) : 0;
      } else {
        custoRealErp = item.quantidade > 0 ? Number((custoItemTotal / item.quantidade).toFixed(6)) : 0;
      }

      if (unidadeComparavelComMubiSys && !conversaoPendente && item.custoCadastrado && item.custoCadastrado > 0 && custoRealErp > 0) {
        divergenciaPct = ((custoRealErp - item.custoCadastrado) / item.custoCadastrado) * 100;
        defasado = Math.abs(divergenciaPct) > 0.005;
      }

      return {
        ...item,
        pesoFreteKg: pesoItemKg,
        rateioFrete,
        rateioIcms,
        custoItemTotal,
        custoRealErp,
        conversaoPendente,
        divergenciaPct,
        defasado,
      };
    });

    return {
      totalFrete,
      freteTotalInformado: modoFrete === "gratis" ? 0 : modoFrete === "valor_total" ? freteValor : totalFrete,
      criterioRateioAplicado: rateio.criterioAplicado,
      usouFallbackFinanceiro: rateio.usouFallbackFinanceiro,
      pesoElegivelKg: itens.reduce((soma, item) => soma + pesoLinhaFreteKg(item), 0),
      totalIcms,
      totalCustoGeral,
      itens: itensCalculados,
    };
  }, [cabecalho, itens, modoFrete, criterioRateioFrete, baseValorRateioFrete, freteValor, percentualIcms]);

  const temItensMistosKgUn = useMemo(() => {
    const unidades = new Set(itens.map((item) => normalizarUnidadeAuditoria(item.unidadeCompra)));
    return unidades.has("KG") && unidades.has("UN");
  }, [itens]);

  // Ação de vincular uma matéria-prima selecionada a um item da NF
  const selecionarMpParaItem = (idxItem: number, mp: any) => {
    setItens((prev) => {
      const copia = [...prev];
      const alvo = copia[idxItem];
      const unidadeErp = normalizarUnidadeErpMateriaPrima(mp.unidadeMedida);
      const unidadeCompra = normalizarUnidadeAuditoria(alvo.unidadeCompra);
      const pacoteUnParaUn = unidadeCompra === "UN" && unidadeErp === "UN" &&
        descricaoIndicaPacote(alvo.descricaoNf + " " + (mp.nome ?? ""));
      const mesmoVinculo = alvo.materiaPrimaId === mp.id && alvo.unidadeErp === unidadeErp;
      let fator = mesmoVinculo && alvo.fatorConversao && alvo.fatorConversao > 0
        ? alvo.fatorConversao
        : null;
      let fatorTexto = fator != null ? String(fator) : "";
      let baseTexto = fator != null ? alvo.baseCalculoTexto : null;
      let origemFator = fator != null ? alvo.origemFator : "manual";

      if (fator == null && unidadeCompra === unidadeErp && !pacoteUnParaUn) {
        fator = 1;
        fatorTexto = "1";
        origemFator = "unidade_identica";
        baseTexto = "Unidade de compra e unidade do MubiSys são iguais (" + unidadeErp + ") — fator 1:1.";
      } else if (fator == null && unidadeCompra === "KG" && unidadeErp === "ML" && mp.tecnico?.tipo === "perfil" && mp.tecnico?.densidadeGCm3 && mp.tecnico?.espessuraMm && mp.tecnico?.perfilLarguraMm) {
        // Não sobrescrever uma conversão humana já confirmada para o mesmo vínculo.
        const kgPorM = (mp.tecnico.perfilLarguraMm * mp.tecnico.espessuraMm * mp.tecnico.densidadeGCm3) / 1000;
        fator = Number((1 / kgPorM).toFixed(8));
        fatorTexto = String(fator);
        origemFator = "cadastro_densidade_perfil";
        baseTexto = "Perfil (tira): " + mp.tecnico.perfilLarguraMm + " mm largura × " + mp.tecnico.espessuraMm + " mm espessura × " + mp.tecnico.densidadeGCm3 + " g/cm³ = " + kgPorM.toFixed(8) + " kg/ML → 1 kg = " + fator + " ML.";
      }

      const pesoUnitarioFreteKg = mesmoVinculo && alvo.pesoUnitarioFreteKg != null
        ? alvo.pesoUnitarioFreteKg
        : unidadeCompra === "UN" && unidadeErp === "UN" && fator === 1
          ? mp.tecnico?.pesoEspecificoKg ?? null
          : null;
      const pesoUnitarioFreteKgTexto = mesmoVinculo && alvo.pesoUnitarioFreteKgTexto !== undefined
        ? alvo.pesoUnitarioFreteKgTexto
        : pesoUnitarioFreteKg != null
          ? String(pesoUnitarioFreteKg)
          : "";

      copia[idxItem] = {
        ...alvo,
        materiaPrimaId: mp.id,
        nomeMateriaPrima: mp.nome,
        unidadeCompraConversao: mesmoVinculo ? alvo.unidadeCompraConversao : alvo.unidadeCompra,
        unidadeErp,
        unidadeErpCadastro: unidadeErp,
        fatorConversao: fator,
        fatorConversaoTexto: fatorTexto,
        origemFator,
        baseCalculoTexto: baseTexto,
        custoCadastrado: mp.custoUnitario,
        pesoUnitarioFreteKg,
        pesoUnitarioFreteKgTexto,
        confianca: "media",
        pendencias: [],
      };
      return copia;
    });
    setItemEmEdicao(null);
    setBuscaMp("");
  };

  const salvarAuditoria = () => {
    if (!cabecalho || !calculoAoVivo) return;
    if (!ordemNf) { toast.error("Selecione a ordem de compra vinculada à cotação antes de concluir a NF."); return; }
    if (!ordemNf.ordem.freteConfirmado) { toast.error("Confirme o frete ou a condição CIF na ordem de compra antes de concluir a NF."); return; }
    if (ordemNf.ordem.freteModo === "cif" && !freteValorStr.trim()) { toast.error("A ordem CIF não tem valor de frete. Informe o custo destinado a esta NF ou digite 0,00 se confirmar que não há frete separado."); return; }
    if (ordemNf.ordem.freteModo !== "por_kg" && ordemNf.ordem.freteModo !== "cif" && freteValor > ordemNf.saldo + 0.001) { toast.error("O frete desta NF não pode exceder o saldo da ordem."); return; }
    if (ordemNf.ordem.freteModo === "por_kg" && !(cabecalho.pesoLiquidoTotalKg && cabecalho.pesoLiquidoTotalKg > 0)) { toast.error("Informe o peso definitivo da NF para calcular R$/kg."); return; }
    const itensSemConversao = calculoAoVivo.itens.filter((item) => {
      const origem = normalizarUnidadeAuditoria(item.unidadeCompraConversao);
      const destino = normalizarUnidadeAuditoria(item.unidadeErp);
      return Boolean(item.unidadeErp && origem !== destino && !(item.fatorConversao && item.fatorConversao > 0));
    });
    if (itensSemConversao.length > 0) {
      toast.error(
        "Informe um fator de conversão válido para " +
          itensSemConversao.length +
          " item(ns) antes de salvar. A unidade do custo precisa corresponder à unidade do MubiSys."
      );
      return;
    }
    const destinosDivergentes = calculoAoVivo.itens.filter((item) =>
      item.materiaPrimaId != null && item.unidadeErpCadastro != null && item.unidadeErp !== item.unidadeErpCadastro
    );
    if (destinosDivergentes.length > 0) {
      toast.error("O destino escolhido precisa corresponder à unidade atual do MubiSys para salvar e comparar o custo. Ajuste o menu ou vincule uma matéria-prima com a unidade desejada.");
      return;
    }
    salvarMutation.mutate(
      {
        ordemCompraId: ordemNf.ordem.id,
        logisticaRevisao: ordemNf.ordem.logisticaRevisao,
        freteAplicadoOrdem: freteValor,
        cabecalho: {
          numero: cabecalho.numero,
          serie: cabecalho.serie,
          chaveAcesso: cabecalho.chaveAcesso ?? undefined,
          cnpjFornecedor: cabecalho.cnpjFornecedor,
          nomeFornecedor: cabecalho.nomeFornecedor,
          dataEmissao: cabecalho.dataEmissao ?? undefined,
          valorProdutos: cabecalho.valorProdutos,
          valorFreteNf: calculoAoVivo.totalFrete,
          pesoLiquidoTotalKg: cabecalho.pesoLiquidoTotalKg,
          modoRateioFrete: modoFrete === "gratis"
            ? "gratis"
            : modoFrete === "por_kg"
              ? "por_kg"
              : criterioRateioFrete === "peso"
                ? "total_peso"
                : criterioRateioFrete === "quantidade"
                  ? "total_qtd"
                  : baseValorRateioFrete === "valor_total_ipi"
                    ? "total_valor_ipi"
                    : "total_valor",
          freteValorPorKg: modoFrete === "por_kg" ? freteValor : null,
          percentualIcms,
        },
        itens: calculoAoVivo.itens.map((i) => ({
          numeroItem: i.numeroItem,
          codigoFornecedor: i.codigoFornecedor,
          descricaoNf: i.descricaoNf,
          ncm: i.ncm,
          unidadeCompra: i.unidadeCompra,
          unidadeCompraConversao: i.unidadeCompraConversao,
          quantidade: i.quantidade,
          valorUnitario: i.valorUnitario,
          valorTotalItem: i.valorTotalItem,
          valorIpi: i.valorIpi,
          pesoFreteKg: i.pesoFreteKg,
          materiaPrimaId: i.materiaPrimaId,
          origemVinculo: i.origemFator === "memoria" ? "memoria" : "manual",
          unidadeErp: i.unidadeErp,
          fatorConversao: i.fatorConversao,
          origemFator: i.origemFator,
          baseCalculoTexto: i.baseCalculoTexto,
          rateioFrete: i.rateioFrete,
          rateioIcms: i.rateioIcms,
          custoItemTotal: i.custoItemTotal,
          quantidadeErp: i.fatorConversao ? i.quantidade * i.fatorConversao : null,
          custoRealErp: i.custoRealErp,
          custoCadastradoErp: i.custoCadastrado,
          divergenciaPct: i.divergenciaPct,
          defasado: i.defasado,
        })),
      },
      {
        onSuccess: () => {
          void utils.compras.obterOrdemFrete.invalidate();
          void utils.compras.auditarOrdem.invalidate();
          void utils.compras.painel.invalidate();
          alert("Auditoria salva com sucesso! Os vínculos foram memorizados para as próximas NFs deste fornecedor.");
        },
        onError: error => toast.error(error.message),
      }
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria de NF de Compra × Custos Mubisys"
        description="Lê cada item da NF/cupom, calcula o custo real na unidade de consumo (frete por kg + ICMS + conversão) e aponta qualquer defasagem vs. o cadastro do ERP."
        icon={FileText}
      />

      {/* Navegação entre Abas */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <button type="button" onClick={() => setAbaAtiva("historico")} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${abaAtiva === "historico" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>Cotações, ordens e evolução</button>
        <button
          type="button"
          onClick={() => setAbaAtiva("importar")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            abaAtiva === "importar"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          Conferir NF de Compra
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("painel")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            abaAtiva === "painel"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Painel de Defasagem Mubisys
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("cotacao_pdf")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            abaAtiva === "cotacao_pdf"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Analisar Cotação em PDF (IA)
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("memoria")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            abaAtiva === "memoria"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Brain className="w-4 h-4" />
          Memória de Vínculos (Auditoria)
        </button>
      </div>

      {abaAtiva === "importar" && (
        <div className="space-y-6">
          {/* Card 1: Upload e Configuração do Frete / ICMS */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              1. Carregar NF-e (XML)
            </h2>

            {/* Seletor de Origem da Compra (Interestadual vs Local) */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Origem da Compra:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOrigemCompra("interestadual");
                    setPercentualIcmsStr("10");
                    if (!ordemNf && parseNumSeguro(freteValorStr) === 0) setFreteValorStr("2,50");
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                    origemCompra === "interestadual"
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  🏢 Interestadual (Fora de MS) — Frete + ICMS 10%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrigemCompra("local");
                    setPercentualIcmsStr("0");
                    if (!ordemNf) setFreteValorStr("0,00");
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                    origemCompra === "local"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  📍 Compra Interna / Local (Dentro de MS) — Sem ICMS adicional
                </button>
              </div>
            </div>

            {cabecalho && <SelecionarOrdemNf selecionada={ordemNf} selecionar={dados => {
              setOrdemNf(dados);
              if (dados) { setModoFrete("valor_total"); setFreteValorStr(dados.ordem.freteModo === "cif" ? "" : String(dados.saldo)); }
            }} pesoKg={cabecalho.pesoLiquidoTotalKg} alterarPeso={peso => setCabecalho(v => v ? { ...v, pesoLiquidoTotalKg: peso } : v)} freteAplicado={freteValor} />}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Arquivo XML da NF-e (modelo 55 da SEFAZ)
                </label>
                <input
                  type="file"
                  accept=".xml,text/xml"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Modo do Frete
                </label>
                <select
                  value={modoFrete}
                  disabled={ordemNf != null}
                  onChange={(e) => setModoFrete(e.target.value as ModoFreteNf)}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white"
                >
                  <option value="gratis">Frete grátis (R$ 0,00)</option>
                  <option value="por_kg">Por KG (transportadora cobra R$/kg)</option>
                  <option value="valor_total">Valor total do frete (R$)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {modoFrete === "gratis" ? "Frete informado" : ordemNf?.ordem.freteModo === "cif" ? "Frete apurado para esta NF (R$)" : modoFrete === "por_kg" ? "Frete por KG (R$/kg)" : "Frete Total (R$)"}
                </label>
                <input
                  type="text"
                  value={ordemNf && ordemNf.ordem.freteModo !== "valor_total" && ordemNf.ordem.freteModo !== "cif" ? String(freteValor) : modoFrete === "gratis" ? "0,00" : freteValorStr}
                  onChange={(e) => setFreteValorStr(e.target.value)}
                  placeholder="0,00"
                  disabled={modoFrete === "gratis" || (ordemNf != null && ordemNf.ordem.freteModo !== "valor_total" && ordemNf.ordem.freteModo !== "cif")}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 font-mono font-bold text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              {modoFrete === "valor_total" && (
                <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                  <label className="block text-xs font-medium text-slate-600">
                    Critério de rateio do total
                    <select
                      value={criterioRateioFrete}
                      onChange={(e) => setCriterioRateioFrete(e.target.value as CriterioRateioFrete)}
                      className="mt-1 w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white"
                    >
                      <option value="peso">Por peso elegível (KG)</option>
                      <option value="quantidade">Por quantidade faturada (QTD)</option>
                      <option value="valor">Por valor financeiro do item</option>
                    </select>
                  </label>
                  {criterioRateioFrete === "valor" ? (
                    <label className="block text-xs font-medium text-slate-600">
                      Base financeira
                      <select
                        value={baseValorRateioFrete}
                        onChange={(e) => setBaseValorRateioFrete(e.target.value as BaseValorRateioFrete)}
                        className="mt-1 w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white"
                      >
                        <option value="valor_total">V.TOTAL</option>
                        <option value="valor_total_ipi">V.TOTAL + IPI</option>
                      </select>
                    </label>
                  ) : (
                    <div className="self-center text-xs text-slate-600">
                      {criterioRateioFrete === "peso"
                        ? "Usa KG da linha ou peso unitário informado em itens UN. Sem peso elegível, usa V.TOTAL."
                        : temItensMistosKgUn
                          ? "Atenção: o rateio compara quantidades em KG e UN, que são grandezas diferentes."
                          : "O total será proporcional à quantidade faturada de cada linha."}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
              {modoFrete === "gratis"
                ? "Frete grátis está definido explicitamente; todos os itens recebem R$ 0,00 de frete."
                : modoFrete === "por_kg"
                  ? "No modo R$/kg, linhas em KG usam o peso da NF. Linhas em UN ficam com frete zero até terem peso unitário cadastrado ou informado na tabela."
                  : "O frete total será distribuído pelo critério escolhido e o resumo abaixo confere o valor rateado."}
            </div>

            <div className="flex items-center gap-4 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                ICMS adicional (DIFAL):
              </span>
              <label className="flex items-center gap-1 font-medium text-slate-700">
                <input
                  type="text"
                  value={percentualIcmsStr}
                  onChange={(e) => setPercentualIcmsStr(e.target.value)}
                  className="w-14 px-2 py-0.5 border border-slate-300 rounded text-right text-xs font-mono font-bold text-slate-800"
                />
                % sobre (mercadoria + frete)
              </label>
              {origemCompra === "local" && (
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ Compra interna em MS: zerado por padrão
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Resumo do Cabeçalho da NF */}
          {fornecedorCadastro && <p className="text-xs text-blue-700"><a href="/fornecedores" className="underline">{fornecedorCadastro.nome}</a>: {fornecedorCadastro.totalCompras} compra(s) registrada(s){!fornecedorCadastro.cadastroConcluido && " - Cadastro não concluído"}</p>}
          {cabecalho && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Número da NF</span>
                <span className="font-semibold text-slate-800">{cabecalho.numero}/{cabecalho.serie}</span>
              </div>
              <div className="md:col-span-2">
                <span className="text-slate-400 block">Fornecedor</span>
                <span className="font-semibold text-slate-800">{cabecalho.nomeFornecedor}</span>
                <span className="text-[11px] text-slate-500 block">{cabecalho.cnpjFornecedor}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Produtos</span>
                <span className="font-semibold text-slate-800">{fmtBrl(cabecalho.valorProdutos)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Peso Líquido Total</span>
                <span className="font-semibold text-slate-800">{cabecalho.pesoLiquidoTotalKg ? `${fmtNum(cabecalho.pesoLiquidoTotalKg, 2)} kg` : "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Custo Total (NF+Frete+ICMS)</span>
                <span className="font-bold text-blue-700">{calculoAoVivo ? fmtBrl(calculoAoVivo.totalCustoGeral) : "—"}</span>
              </div>
            </div>
          )}

          {/* Card 3: Grid de Calibração Item a Item */}
          {calculoAoVivo && (
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    2. Calibração e Linkagem de Cada Item com o Mubisys
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Itens identificados pela memória aparecem com badge verde. Para os novos, busque a MP e confirme o fator.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSincronizarMubiSys}
                    disabled={sincronizandoMubiSys || sincronizarEspelhoMubiSysMutation.isPending || salvarMutation.isPending}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${sincronizandoMubiSys || sincronizarEspelhoMubiSysMutation.isPending ? "animate-spin" : ""}`} />
                    {sincronizandoMubiSys || sincronizarEspelhoMubiSysMutation.isPending ? "Atualizando do MubiSys..." : "Atualizar do MubiSys"}
                  </button>
                  <button
                    type="button"
                    onClick={salvarAuditoria}
                    disabled={salvarMutation.isPending || sincronizandoMubiSys || sincronizarEspelhoMubiSysMutation.isPending}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {salvarMutation.isPending ? "Gravando..." : "Confirmar e Gravar Memória"}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                Atualiza o cadastro local com os dados atuais do MubiSys e aplica nome e custo aos itens já vinculados. Mantém a matéria-prima escolhida, o fator e a unidade.
              </p>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                  <span>Resumo do frete rateado</span>
                  <span>Total aplicado: {formatarRateioFrete(calculoAoVivo.totalFrete)}</span>
                </div>
                <p className="mt-1 text-xs text-emerald-800">
                  {modoFrete === "gratis"
                    ? "Frete grátis: R$ 0,00 informado; cada item recebe R$ 0,00."
                    : modoFrete === "por_kg"
                      ? `${formatarRateioFrete(freteValor)} / kg × ${fmtNum(calculoAoVivo.pesoElegivelKg, 4)} kg elegíveis = ${formatarRateioFrete(calculoAoVivo.totalFrete)}. Itens sem peso recebem R$ 0,00.`
                      : `Informado ${formatarRateioFrete(calculoAoVivo.freteTotalInformado)} · rateado ${formatarRateioFrete(calculoAoVivo.totalFrete)} · diferença ${formatarRateioFrete(calculoAoVivo.freteTotalInformado - calculoAoVivo.totalFrete)} · critério ${calculoAoVivo.criterioRateioAplicado === "peso" ? "peso (KG)" : calculoAoVivo.criterioRateioAplicado === "quantidade" ? "quantidade (QTD)" : `valor (${criterioRateioFrete === "peso" ? "V.TOTAL no fallback" : baseValorRateioFrete === "valor_total_ipi" ? "V.TOTAL + IPI" : "V.TOTAL"})`}.`}
                </p>
                {modoFrete === "valor_total" && criterioRateioFrete === "peso" && calculoAoVivo.usouFallbackFinanceiro && (
                  <p className="mt-1 text-xs font-semibold text-amber-800">
                    Nenhum peso elegível foi informado; o total foi rateado proporcionalmente ao V.TOTAL dos itens.
                  </p>
                )}
                {modoFrete === "valor_total" && criterioRateioFrete === "quantidade" && temItensMistosKgUn && (
                  <p className="mt-1 text-xs font-semibold text-amber-800">
                    Atenção: a quantidade compara KG e UN como valores numéricos, apesar de serem grandezas diferentes.
                  </p>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-64">Item na NF (Fornecedor)</TableHead>
                    <TableHead className="w-72">Matéria-Prima no Radrasys / Mubisys</TableHead>
                    <TableHead className="text-right w-24">Qtd / Un. Compra</TableHead>
                    <TableHead className="text-right w-36">Peso por unidade de compra</TableHead>
                    <TableHead className="text-right w-28">Frete rateado</TableHead>
                    <TableHead className="text-right w-28">Fator (1 Un = X ERP)</TableHead>
                    <TableHead className="text-right w-28">Custo Real (NF)</TableHead>
                    <TableHead className="text-right w-28">Custo Mubisys</TableHead>
                    <TableHead className="text-right w-28">Defasagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculoAoVivo.itens.map((item, idx) => {
                    const isMemoria = item.origemFator === "memoria";
                    const isEditando = itemEmEdicao === idx;
                    const divPct = item.divergenciaPct ?? 0;
                    const sinal = divPct > 0 ? "+" : "";

                    return (
                      <TableRow key={item.numeroItem} className={item.defasado ? "bg-amber-50/40" : ""}>
                        <TableCell className="font-mono text-xs">{item.numeroItem}</TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-800 text-xs">{item.descricaoNf}</div>
                          <div className="text-[11px] text-slate-400 font-mono">cProd: {item.codigoFornecedor}</div>
                        </TableCell>
                        <TableCell>
                          {isEditando ? (
                            <div className="space-y-2">
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="Digite nome ou código da MP..."
                                  value={buscaMp}
                                  onChange={(e) => setBuscaMp(e.target.value)}
                                  className="w-full text-xs pl-8 pr-3 py-1.5 border border-blue-400 rounded-md"
                                />
                              </div>
                              {buscarMpsQuery.data && (
                                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-md bg-white shadow-lg text-xs divide-y divide-slate-100">
                                  {buscarMpsQuery.data.map((mp) => (
                                    <button
                                      key={mp.id}
                                      type="button"
                                      onClick={() => selecionarMpParaItem(idx, mp)}
                                      className="w-full text-left p-2 hover:bg-blue-50 transition-colors flex justify-between items-center"
                                    >
                                      <div>
                                        <span className="font-medium text-slate-800 block">{mp.nome}</span>
                                        <span className="text-[10px] text-slate-400">ID: {mp.mubisysId} | {mp.unidadeMedida}</span>
                                      </div>
                                      <span className="font-mono text-slate-600">{fmtBrl(mp.custoUnitario)}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => setItemEmEdicao(null)}
                                className="text-[11px] text-slate-500 underline"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-slate-800 text-xs">
                                  {item.nomeMateriaPrima ?? (
                                    <span className="text-amber-600 italic">Nenhuma MP vinculada</span>
                                  )}
                                </span>
                                {isMemoria && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                    🧠 Memória
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setItemEmEdicao(idx);
                                    setBuscaMp("");
                                  }}
                                  className="text-[11px] text-blue-600 hover:underline block"
                                >
                                  {item.materiaPrimaId ? "Trocar MP" : "Buscar MP para vincular"}
                                </button>
                                {item.materiaPrimaId && (
                                  <button
                                    type="button"
                                    title="Ver se já compramos antes e o histórico de preços desta MP"
                                    onClick={() =>
                                      setMpHistoricoSelecionada({
                                        id: item.materiaPrimaId!,
                                        nome: item.nomeMateriaPrima ?? "",
                                      })
                                    }
                                    className="text-[10px] text-slate-500 hover:text-blue-700 hover:underline flex items-center gap-0.5"
                                  >
                                    <History className="w-3 h-3" />
                                    Último Preço
                                  </button>
                                )}
                              </div>
                              {item.baseCalculoTexto && (
                                <div className="text-[10px] text-slate-500 bg-slate-50 p-1 rounded font-mono">
                                  {item.baseCalculoTexto}
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {fmtNum(item.quantidade, 2)} {item.unidadeCompra}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {normalizarUnidadeAuditoria(item.unidadeCompra) === "KG" ? (
                            <span>{fmtNum(item.pesoFreteKg, 4)} kg <span className="block text-[10px] text-slate-400">da linha da NF</span></span>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.pesoUnitarioFreteKgTexto}
                                  onChange={(e) => {
                                    const texto = e.target.value;
                                    const numero = lerPesoUnitarioFreteKg(texto);
                                    setItens((prev) => prev.map((linha, linhaIdx) => linhaIdx === idx
                                      ? { ...linha, pesoUnitarioFreteKgTexto: texto, pesoUnitarioFreteKg: numero }
                                      : linha));
                                  }}
                                  placeholder="0,0000"
                                  className="w-24 px-2 py-1 text-right text-xs border border-slate-300 rounded font-mono"
                                />
                                <span>kg/{normalizarUnidadeAuditoria(item.unidadeCompra)}</span>
                              </div>
                              <span className="text-[10px] text-slate-400">linha: {fmtNum(item.pesoFreteKg, 4)} kg</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-slate-800">
                          {formatarRateioFrete(item.rateioFrete)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.fatorConversaoTexto ?? (item.fatorConversao != null ? String(item.fatorConversao) : "")}
                              onChange={(e) => {
                                const texto = e.target.value;
                                const valor = lerFatorManual(texto);
                                setItens((prev) => {
                                  const c = [...prev];
                                  c[idx].fatorConversaoTexto = texto;
                                  c[idx].fatorConversao = valor;
                                  c[idx].origemFator = "manual";
                                  c[idx].baseCalculoTexto =
                                    valor != null
                                      ? "Fator manual: 1 " +
                                        normalizarUnidadeAuditoria(c[idx].unidadeCompraConversao) +
                                        " = " +
                                        fmtNum(valor, 8) +
                                        " " +
                                        (c[idx].unidadeErp ?? "—") +
                                        "."
                                      : null;
                                  return c;
                                });
                              }}
                              placeholder="ex.: 0,21645"
                              className="w-24 px-2 py-1 text-right text-xs border border-slate-300 rounded font-mono font-bold"
                            />
                            <button
                              type="button"
                              title={item.unidadeErp ? "Abrir assistente de conversão para " + item.unidadeErp : "Vincule uma matéria-prima para definir a unidade de destino"}
                              disabled={!item.unidadeErp}
                              onClick={() => setItemCalculadoraFator(idx)}
                              className="p-1 text-blue-600 hover:bg-blue-50 border border-blue-200 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            <button
                              type="button"
                              disabled={!item.unidadeErp}
                              onClick={() => setItemCalculadoraFator(idx)}
                              className="text-[10px] text-blue-600 hover:underline disabled:text-slate-300 disabled:no-underline"
                            >
                              📐 Assistente
                            </button>
                            <span className="text-[10px] text-slate-400">({item.unidadeErp ?? "—"})</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block text-right">
                            {normalizarUnidadeAuditoria(item.unidadeCompraConversao)} → {item.unidadeErp ?? "—"}
                          </span>
                          {normalizarUnidadeAuditoria(item.unidadeCompraConversao) !== normalizarUnidadeAuditoria(item.unidadeCompra) && (
                            <span className="text-[10px] text-amber-700 block text-right">
                              origem corrigida; NF: {item.unidadeCompra}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-slate-800">
                          {item.conversaoPendente ? "—" : formatarCustoUnitarioAuditoria(item.custoRealErp)}
                          <span className="text-[10px] text-slate-400 block font-normal">/{item.unidadeErp ?? item.unidadeCompra}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-slate-600">
                          {item.custoCadastrado ? formatarCustoUnitarioAuditoria(item.custoCadastrado) : "—"}
                          <span className="text-[10px] text-slate-400 block font-normal">/{item.unidadeErpCadastro ?? "—"}</span>
                          {item.unidadeErp !== item.unidadeErpCadastro && (
                            <span className="text-[10px] text-amber-700 block font-normal">unidade de destino incompatível</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {item.divergenciaPct !== null ? (
                            <span
                              className={`px-2 py-0.5 rounded text-xs inline-flex items-center gap-1 ${
                                item.divergenciaPct > 0
                                  ? "bg-red-100 text-red-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {item.divergenciaPct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {sinal}{fmtPct(item.divergenciaPct, 2)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {abaAtiva === "memoria" && (
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-600" />
                Vínculos Aprendidos na Memória
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cada confirmação grava aqui permanentemente. As próximas NFs com o mesmo fornecedor + código já puxam estes valores sozinhos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => memoriasQuery.refetch()}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1 text-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor (CNPJ)</TableHead>
                <TableHead>Código do Produto</TableHead>
                <TableHead>Descrição de Referência</TableHead>
                <TableHead>Matéria-Prima Vinculada</TableHead>
                <TableHead>Unidades (NF → cálculo → ERP)</TableHead>
                <TableHead>Unidade ERP</TableHead>
                <TableHead className="text-right">Fator Gravado</TableHead>
                <TableHead className="text-right">Vezes Usado</TableHead>
                <TableHead>Base do Cálculo (Auditoria)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memoriasQuery.data?.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.cnpjFornecedor}</TableCell>
                  <TableCell className="font-mono text-xs font-bold">{m.codigoFornecedor}</TableCell>
                  <TableCell className="text-xs text-slate-700">{m.descricaoReferencia}</TableCell>
                  <TableCell className="text-xs font-medium text-slate-800">{m.nomeMateriaPrima}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {m.unidadeCompraNf ?? "—"} → {m.unidadeCompraConversao ?? m.unidadeCompraNf ?? "—"} → {m.unidadeErp}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{m.unidadeErp}</TableCell>
                  <TableCell className="text-xs font-mono text-right">{fmtNum(Number(m.fatorConversao), 8)}</TableCell>
                  <TableCell className="text-xs font-mono text-right font-semibold text-emerald-700">
                    {m.vezesUsado}×
                  </TableCell>
                  <TableCell className="text-[11px] text-slate-500 font-mono max-w-md">
                    {m.baseCalculoTexto ?? "Vínculo manual sem memória de fórmula."}
                  </TableCell>
                </TableRow>
              ))}
              {memoriasQuery.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-slate-400 text-xs">
                    Nenhum vínculo memorizado ainda. Confirme sua primeira NF para começar a alimentar a memória.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ABA 2: Painel Estatístico de Defasagem Mubisys */}
      {abaAtiva === "painel" && (
        <div className="space-y-6">
          {painelDivergenciasQuery.isLoading && (
            <div className="p-8 text-center text-slate-400">Carregando painel de divergências...</div>
          )}

          {painelDivergenciasQuery.data && (
            <>
              {/* KPIs de Topo */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-xs text-slate-400 block font-medium">Itens de NF Auditados</span>
                  <span className="text-2xl font-black text-slate-800 font-mono mt-1 block">
                    {fmtNum(painelDivergenciasQuery.data.totalItensAuditados)}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Linhas de compra cruzadas com o ERP
                  </span>
                </div>

                <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-xs text-slate-400 block font-medium">Defasagem Média Geral</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span
                      className={`text-2xl font-black font-mono ${
                        painelDivergenciasQuery.data.defasagemMediaGeralPct > 0
                          ? "text-red-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {painelDivergenciasQuery.data.defasagemMediaGeralPct > 0 ? "+" : ""}
                      {fmtPct(painelDivergenciasQuery.data.defasagemMediaGeralPct, 2)}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Diferença média entre custo real da NF e o Mubisys
                  </span>
                </div>

                <div className="p-5 bg-red-50 rounded-xl border border-red-200 shadow-sm md:col-span-2">
                  <span className="text-xs text-red-900 block font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    Alerta de Defasagem Crítica
                  </span>
                  <p className="text-xs text-red-700 mt-1.5 leading-relaxed">
                    Itens onde o custo real da NF subiu muito acima do valor cadastrado no Mubisys fazem o CPQ gerar propostas com margem menor que a esperada. Priorize os itens da faixa vermelha abaixo!
                  </p>
                </div>
              </div>

              {/* Distribuição por Faixas de Divergência */}
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  Distribuição das Divergências por Faixa Percentual
                </h3>

                <div className="space-y-2.5">
                  {painelDivergenciasQuery.data.faixas.map((f, i) => {
                    const corBarra =
                      f.cor === "vermelho_escuro"
                        ? "bg-red-600"
                        : f.cor === "laranja"
                        ? "bg-amber-500"
                        : f.cor === "amarelo"
                        ? "bg-yellow-400"
                        : f.cor === "verde"
                        ? "bg-emerald-500"
                        : "bg-blue-500";

                    return (
                      <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{f.faixa}</span>
                          <span className="font-mono font-bold text-slate-700">
                            {f.quantidade} item(ns) ({f.percentualItens}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${corBarra} transition-all duration-300`}
                            style={{ width: `${Math.min(100, Math.max(3, f.percentualItens))}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-500">{f.descricao}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Maiores Divergências Identificadas */}
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-red-600" />
                  Itens com Maiores Desvios de Custo (Mais Urgentes para Ajustar no Mubisys)
                </h3>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matéria-Prima</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="text-right">Custo Real (NF)</TableHead>
                      <TableHead className="text-right">Custo no Mubisys</TableHead>
                      <TableHead className="text-right">Defasagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {painelDivergenciasQuery.data.maioresDivergencias.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <span className="font-medium text-slate-800 text-xs block">{m.materiaPrimaNome}</span>
                          <span className="text-[10px] text-slate-400 font-mono">ID Mubisys: {m.mubisysId ?? "—"}</span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">{m.fornecedor ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-slate-800">
                          {fmtBrl(m.custoRealErp)}/{m.unidadeErp ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-slate-600">
                          {fmtBrl(m.custoCadastradoErp)}/{m.unidadeErp ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          <span
                            className={`px-2 py-0.5 rounded text-xs inline-flex items-center gap-1 ${
                              m.divergenciaPct > 0
                                ? "bg-red-100 text-red-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {m.divergenciaPct > 0 ? "+" : ""}
                            {fmtPct(m.divergenciaPct, 2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ABA 3: Análise de Cotação em PDF (IA) */}
      {abaAtiva === "cotacao_pdf" && (
        <div className="space-y-6">
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                Upload do Orçamento / Cotação em PDF
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Suba o PDF que o fornecedor te enviou. A IA vai ler os produtos cotados e cruzar com o histórico de compras anteriores para apontar reajustes antes de comprar!
              </p>
            </div>

            <div className="p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100/60 transition-colors text-center">
              <input
                type="file"
                accept=".pdf,application/pdf"
                id="pdf-cotacao-input"
                onChange={handlePdfUpload}
                className="hidden"
              />
              <label
                htmlFor="pdf-cotacao-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold text-slate-700">
                  {analisarCotacaoPdfMutation.isPending
                    ? "Extraindo e analisando cotação com IA..."
                    : arquivoPdfNome || "Clique para selecionar o PDF do orçamento"}
                </span>
                <span className="text-xs text-slate-400">
                  Suporta propostas comerciais em PDF de qualquer fornecedor
                </span>
              </label>
            </div>
          </div>

          {cotacaoPdfResultado && (
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    {cotacaoPdfResultado.fornecedor || "Fornecedor Identificado"}
                  </h3>
                  <span className="text-xs text-slate-500">
                    Data da cotação: {cotacaoPdfResultado.dataCotacao || "—"} | Total cotado: {cotacaoPdfResultado.valorTotalCotado ? fmtBrl(cotacaoPdfResultado.valorTotalCotado) : "—"}
                  </span>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  {cotacaoPdfResultado.itens.length} itens cotados
                </span>
              </div>

              {cotacaoPdfResultado.fornecedorCadastro && <p className="text-xs text-blue-700"><a href="/fornecedores" className="underline">Cadastro do fornecedor</a>: {cotacaoPdfResultado.fornecedorCadastro.totalCompras} compra(s) registrada(s){!cotacaoPdfResultado.fornecedorCadastro.cadastroConcluido && " - Não concluído: complete os dados em Fornecedores"}</p>}
              <SalvarCotacaoCompra key={versaoEditorCotacao} resultado={cotacaoPdfResultado} nomeArquivo={arquivoPdfNome} arquivoPdf={arquivoPdf} onAbrirOrdem={setCotacaoOrdemId} onSimulacaoChange={setCotacaoSimulacao} />
              <Table className="table-fixed text-[11px] [&_th]:whitespace-normal [&_th]:px-1.5 [&_td]:whitespace-normal [&_td]:break-words [&_td]:p-1.5 [&_td]:align-top">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[18%]">Item do PDF</TableHead>
                    <TableHead className="w-[16%] text-right">
                      Preço puro / final simulado
                    </TableHead>
                    <TableHead className="w-[16%]">Matéria-prima</TableHead>
                    <TableHead className="w-[14%] text-right">Últimas compras (origem)</TableHead>
                    <TableHead className="w-[36%] text-right">Cotação × compra anterior × MubiSys — mesma unidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cotacaoPdfResultado.itens.map((item: any, i: number) => {
                    const compraFornecedor = item.ultimaCompraFornecedor;
                    const compraGeral = item.ultimaCompraGeral;
                    const mpVinculada = item.materiaPrimaVinculada;
                    const unidadeMubisys = mpVinculada?.unidadeMubisys ?? "";
                    const unidadeDestinoConversao = item.unidadeDestinoConversaoCotacao ?? unidadeMubisys;
                    const fatorConversaoCotacao = item.fatorConversaoCotacao ?? (
                      mpVinculada && normalizarUnidadeAuditoria(item.unidade) === normalizarUnidadeAuditoria(unidadeMubisys)
                        ? 1
                        : null
                    );
                    const unidadeDestinoCompativel = Boolean(
                      unidadeMubisys && unidadeDestinoConversao &&
                      normalizarUnidadeAuditoria(unidadeDestinoConversao) === normalizarUnidadeAuditoria(unidadeMubisys)
                    );
                    const custoAtualMubisys = mpVinculada?.custoUnitarioMubisys == null
                      ? item.custoMubisysAtual == null ? null : Number(item.custoMubisysAtual)
                      : Number(mpVinculada.custoUnitarioMubisys);
                    const custoMubisysComparavel = custoAtualMubisys != null && custoAtualMubisys > 0 ? custoAtualMubisys : null;
                    const simulacaoItem = cotacaoSimulacao?.itens[i] ?? null;
                    const custoFinalCotadoCompra = simulacaoItem?.custoFinalUnitario ?? null;
                    const custoFinalCotadoConsumo = custoFinalCotadoCompra != null && fatorConversaoCotacao && unidadeDestinoCompativel
                      ? Number((custoFinalCotadoCompra / fatorConversaoCotacao).toFixed(6))
                      : null;
                    const unidadeConsumoMubisys = item.unidadeMubisysAtual ?? unidadeMubisys;
                    const propostaMesmoFornecedor = (item.propostasAnterioresMesmoFornecedor ?? [])
                      .find((proposta: any) => proposta.custoFinalUnidadeConsumo != null) ?? null;
                    const melhorPropostaOutroFornecedor = (item.propostasAnterioresOutrosFornecedores ?? [])
                      .find((proposta: any) => proposta.custoFinalUnidadeConsumo != null) ?? null;
                    const custoUltimaNf = compraGeral?.custoRealErp != null &&
                      (!unidadeConsumoMubisys || normalizarUnidadeAuditoria(compraGeral.unidadeErp) === normalizarUnidadeAuditoria(unidadeConsumoMubisys))
                      ? Number(compraGeral.custoRealErp)
                      : null;
                    const linhaComparacao = (titulo: string, referencia: number | null, unidade: string, detalhe?: string) => {
                      const variacao = custoFinalCotadoConsumo != null && referencia != null && referencia > 0
                        ? ((custoFinalCotadoConsumo - referencia) / referencia) * 100
                        : null;
                      return (
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                          <span className="text-slate-500">{titulo}</span>
                          <span className="text-right">
                            <strong>{referencia == null ? titulo === "MubiSys atual" ? "Sem custo cadastrado" : "Sem referência compatível" : `${formatarCustoUnitarioAuditoria(referencia)}/${unidade || "un."}`}</strong>
                            {variacao != null && <span className={`ml-1 text-[10px] font-semibold ${variacao > 0 ? "text-red-700" : "text-emerald-700"}`}>{variacao > 0 ? "+" : ""}{fmtPct(variacao, 2)}</span>}
                            {detalhe && <span className="block text-[9px] text-slate-400">{detalhe}</span>}
                          </span>
                        </div>
                      );
                    };
                    const formatarCompra = (compra: any, mostrarFornecedor: boolean) => compra ? (
                      <div>
                        <span>{fmtBrl(compra.precoUnitario)}/{compra.unidade}</span>
                        <span className="text-[10px] text-slate-400 block">
                          {mostrarFornecedor ? compra.fornecedor : "Mesmo fornecedor"}{compra.data ? ` · ${compra.data}` : ""}
                        </span>
                      </div>
                    ) : <span className="text-slate-400">—</span>;
                    const botaoVincular = (itemCotado: any) => (
                      <button
                        type="button"
                        onClick={() => {
                          setItemCotacaoEmEdicao(i);
                          setBuscaMateriaPrimaCotacao("");
                        }}
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        {itemCotado.materiaPrimaVinculada ? "Trocar vínculo" : "Vincular matéria-prima"}
                      </button>
                    );

                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <span className="font-medium text-slate-800 text-xs block">{item.descricao}</span>
                          {item.codigo && (
                            <span className="text-[10px] text-slate-400 font-mono">Cód: {item.codigo}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="space-y-2 font-sans">
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                              <span className="block text-[11px] font-semibold text-slate-500">
                                Puro · preço original da cotação
                              </span>
                              <strong className="block whitespace-nowrap font-mono text-lg leading-6 text-slate-900">
                                {fmtBrl(item.precoUnitario)}/{item.unidade}
                              </strong>
                              <span className="block text-xs font-normal text-slate-600">
                                Qtd. {fmtNum(item.quantidade, 3)} {item.unidade}
                                {" · "}
                                Total puro: {fmtBrl(Number(item.precoUnitario) * Number(item.quantidade))}
                              </span>
                            </div>
                            {cotacaoSimulacao?.itens[i] ? (
                              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
                                <span className="block text-[11px] font-semibold text-emerald-800">
                                  Final simulado · frete + ICMS 10%
                                </span>
                                <strong className="block whitespace-nowrap font-mono text-lg leading-6 text-emerald-900">
                                  {fmtBrl(cotacaoSimulacao.itens[i].custoFinalUnitario)}/{item.unidade}
                                </strong>
                                <span className="block text-xs font-normal text-emerald-800">
                                  Total final: {fmtBrl(cotacaoSimulacao.itens[i].custoFinalTotal)}
                                </span>
                                <span className="mt-1 block text-[10px] font-normal text-emerald-800">
                                  Mercadoria {fmtBrl(Number(item.precoUnitario) * Number(item.quantidade))} + frete {fmtBrl(cotacaoSimulacao.itens[i].rateioFrete)} + ICMS {fmtBrl(cotacaoSimulacao.itens[i].rateioIcms)}
                                </span>
                              </div>
                            ) : cotacaoSimulacao?.pendencia ? (
                              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">
                                Final pendente: informe {cotacaoSimulacao.pendencia === "peso" ? "o peso total" : "o frete"}.
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span className="text-xs font-medium text-slate-800 block">
                              {item.materiaPrimaVinculada?.nome ?? (
                                <span className="text-amber-600 italic">Não vinculado</span>
                              )}
                            </span>
                            {item.origemVinculo && (
                              <span className="text-[10px] text-slate-400 block">Correspondência: {item.origemVinculo}</span>
                            )}
                            {botaoVincular(item)}
                            {itemCotacaoEmEdicao === i && (
                              <div className="mt-2 min-w-0 space-y-1 rounded border border-slate-200 bg-slate-50 p-2">
                                <input
                                  type="search"
                                  value={buscaMateriaPrimaCotacao}
                                  onChange={e => setBuscaMateriaPrimaCotacao(e.target.value)}
                                  placeholder="Buscar matéria-prima ou SKU"
                                  className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                                  aria-label={`Buscar matéria-prima para ${item.descricao}`}
                                />
                                {buscarMpsCotacaoQuery.isFetching && (
                                  <span className="block text-[10px] text-slate-400">Buscando...</span>
                                )}
                                {buscaMateriaPrimaCotacao.trim().length >= 2 && !buscarMpsCotacaoQuery.isFetching &&
                                  buscarMpsCotacaoQuery.data?.length === 0 && (
                                    <span className="block text-[10px] text-slate-500">Nenhuma matéria-prima encontrada.</span>
                                  )}
                                <div className="max-h-36 overflow-y-auto">
                                  {buscarMpsCotacaoQuery.data?.map(mp => (
                                    <button
                                      key={mp.id}
                                      type="button"
                                      onClick={() => void vincularMateriaPrimaCotacao(i, mp)}
                                      className="block w-full border-t border-slate-200 px-1 py-1.5 text-left hover:bg-blue-50"
                                    >
                                      <span className="block text-[11px] font-medium text-slate-700">{mp.nome}</span>
                                      <span className="block text-[10px] text-slate-400">
                                        {mp.unidadeMedida}{mp.custoUnitario != null && mp.custoUnitario > 0
                                          ? ` · ${fmtBrl(mp.custoUnitario)}`
                                          : " · sem custo cadastrado"}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setItemCotacaoEmEdicao(null);
                                    setBuscaMateriaPrimaCotacao("");
                                  }}
                                  className="text-[10px] text-slate-500 underline"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-slate-600">
                          <span className="block text-[9px] text-slate-400">Deste fornecedor</span>
                          {formatarCompra(compraFornecedor, false)}
                          <span className="mt-2 block text-[9px] text-slate-400">Mais recente (todos)</span>
                          {formatarCompra(compraGeral, true)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-slate-600">
                          {(medidasChapaMm(item.descricao) || normalizarUnidadeAuditoria(unidadeMubisys) === "M2" || normalizarUnidadeAuditoria(item.unidade) === "M2") ? <CotacaoComparativoConsumo key={`${i}-${item.codigo}-${item.materiaPrimaVinculada?.id ?? "sem-mp"}`} item={item} fornecedor={cotacaoPdfResultado.fornecedor} custoFinalUnitarioCompra={custoFinalCotadoCompra} propostasAnterioresMesmoFornecedor={item.propostasAnterioresMesmoFornecedor ?? []} propostasAnterioresOutrosFornecedores={item.propostasAnterioresOutrosFornecedores ?? []} alterar={(fator, formula) => setCotacaoPdfResultado((atual: any) => {
                            const linha = atual?.itens[i];
                            if (!linha || (linha.fatorConversaoCotacao === fator && linha.baseCalculoConversaoCotacao === formula && linha.unidadeDestinoConversaoCotacao === "M2")) return atual;
                            return { ...atual, itens: atual.itens.map((l: any, indice: number) => indice === i ? { ...l, fatorConversaoCotacao: fator, unidadeDestinoConversaoCotacao: "M2", unidadeOrigemConversaoCotacao: item.unidade, baseCalculoConversaoCotacao: formula } : l) };
                          })} /> : <div className="space-y-1.5">
                            <div className="rounded border border-blue-100 bg-blue-50 px-2 py-1.5 text-left space-y-1">
                              {linhaComparacao("Custo final cotado", custoFinalCotadoConsumo, unidadeConsumoMubisys,
                                custoFinalCotadoCompra != null && simulacaoItem ? `Mercadoria ${formatarCustoUnitarioAuditoria(Number(item.precoUnitario) / (fatorConversaoCotacao || 1))} + frete ${formatarCustoUnitarioAuditoria(simulacaoItem.rateioFrete / (Number(item.quantidade) * (fatorConversaoCotacao || 1)))} + ICMS ${formatarCustoUnitarioAuditoria(simulacaoItem.rateioIcms / (Number(item.quantidade) * (fatorConversaoCotacao || 1)))}` : undefined)}
                              {linhaComparacao("MubiSys atual", custoMubisysComparavel, unidadeConsumoMubisys)}
                              {linhaComparacao("Última NF · custo real", custoUltimaNf, unidadeConsumoMubisys,
                                compraGeral ? `${compraGeral.fornecedor} · ${compraGeral.data}` : undefined)}
                              {linhaComparacao("Proposta anterior · mesmo fornecedor", propostaMesmoFornecedor?.custoFinalUnidadeConsumo ?? null, unidadeConsumoMubisys,
                                propostaMesmoFornecedor ? `${propostaMesmoFornecedor.fornecedor} · ${propostaMesmoFornecedor.data} · cotação #${propostaMesmoFornecedor.cotacaoId}` : undefined)}
                              {linhaComparacao("Melhor proposta anterior · outros fornecedores", melhorPropostaOutroFornecedor?.custoFinalUnidadeConsumo ?? null, unidadeConsumoMubisys,
                                melhorPropostaOutroFornecedor ? `${melhorPropostaOutroFornecedor.fornecedor} · ${melhorPropostaOutroFornecedor.data} · cotação #${melhorPropostaOutroFornecedor.cotacaoId}` : undefined)}
                              {cotacaoSimulacao?.rateioFreteEstimado && <span className="block rounded bg-amber-50 px-1.5 py-1 text-[10px] text-amber-800">Frete por kg sem peso individual: custo do item estimado por rateio de valor.</span>}
                              {!mpVinculada && <span className="block text-[10px] text-amber-700">Vincule uma matéria-prima para comparar na unidade de consumo.</span>}
                              {mpVinculada && !fatorConversaoCotacao && <span className="block text-[10px] text-amber-700">Converta {item.unidade} para {unidadeMubisys} para comparar na unidade de consumo.</span>}
                              {custoFinalCotadoConsumo != null && custoMubisysComparavel != null && custoFinalCotadoConsumo > custoMubisysComparavel && (
                                <span className="mt-1 block rounded bg-red-50 px-1.5 py-1 text-[10px] font-semibold text-red-800">Alerta: custo cotado {fmtPct((custoFinalCotadoConsumo / custoMubisysComparavel - 1) * 100, 2)} acima do MubiSys. Avalie reajustar o cadastro antes de aprovar o pedido.</span>
                              )}
                              {item.baseCalculoConversaoCotacao && <span className="block text-[9px] font-sans text-slate-500">1 {item.unidadeOrigemConversaoCotacao ?? item.unidade} = {fmtNum(fatorConversaoCotacao, 8)} {unidadeDestinoConversao}. {item.baseCalculoConversaoCotacao}</span>}
                            </div>
                            {mpVinculada && (
                              <button type="button" onClick={() => setItemCotacaoCalculadora(i)} className="text-[10px] text-blue-600 hover:underline">
                                {fatorConversaoCotacao ? "Ver/ajustar conversão" : "Calcular preço por unidade de consumo"}
                              </button>
                            )}
                          </div>}                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {abaAtiva === "historico" && <ComprasHistorico onOrdem={(id, decisao) => { setCotacaoOrdemDecisao(decisao ?? null); setCotacaoOrdemId(id); }} onAbrirCotacao={async c => {
        const linhas = await Promise.all(c.itens.map(async i => {
          const historico = i.materiaPrimaId ? await utils.nfCompra.historicoCotacaoPorMateriaPrima.fetch({ materiaPrimaId: i.materiaPrimaId, fornecedor: c.fornecedor, cnpjFornecedor: c.cnpjFornecedor ?? undefined, precoCotado: Number(i.precoUnitario), unidadeCotada: i.unidade, dataReferencia: /^\d{4}-\d{2}-\d{2}$/.test(c.dataCotacao ?? "") ? c.dataCotacao : undefined, excluirCotacaoId: c.id }) : {};
          return { ...historico, codigo: i.codigo, descricao: i.descricao, quantidade: Number(i.quantidade), unidade: i.unidade, precoUnitario: Number(i.precoUnitario),
            icmsAliquota: i.icmsAliquota == null ? null : Number(i.icmsAliquota), icmsValor: i.icmsValor == null ? null : Number(i.icmsValor),
            ipiAliquota: i.ipiAliquota == null ? null : Number(i.ipiAliquota), ipiValor: i.ipiValor == null ? null : Number(i.ipiValor),
            totalFornecedor: i.totalFornecedor == null ? null : Number(i.totalFornecedor),
            pesoUnitarioKg: i.pesoUnitarioKg == null ? null : Number(i.pesoUnitarioKg), pesoTotalKg: i.pesoTotalKg == null ? null : Number(i.pesoTotalKg),
            materiaPrimaVinculada: i.materiaPrimaId ? { id: i.materiaPrimaId, nome: i.nomeMateriaPrima, unidadeMubisys: i.unidadeDestino, custoUnitarioMubisys: i.custoMubisys == null ? null : Number(i.custoMubisys) } : null,
            fatorConversaoCotacao: i.fatorConversao == null ? null : Number(i.fatorConversao), unidadeOrigemConversaoCotacao: i.unidadeOrigem, unidadeDestinoConversaoCotacao: i.unidadeDestino, baseCalculoConversaoCotacao: i.formula, origemVinculo: "cotação salva (snapshot)" };
        }));
        setCotacaoSimulacao(null);
        setCotacaoPdfResultado({ ...c, salvoId: c.id, valorTotalCotado: Number(c.total), valorFrete: c.frete == null ? null : Number(c.frete), itens: linhas });
        setArquivoPdfNome(c.nomeArquivo ?? `Cotação #${c.id}`); setArquivoPdf(null); setVersaoEditorCotacao(v => v + 1); setAbaAtiva("cotacao_pdf");
      }} />}
      <OrdemCompraModal cotacaoId={cotacaoOrdemId} decisaoCotacao={cotacaoOrdemDecisao} fechar={() => { setCotacaoOrdemId(null); setCotacaoOrdemDecisao(null); }} />

      {/* Modal Histórico da Matéria-Prima (Função 1 para o Comprador) */}
      {mpHistoricoSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">
                    Histórico de Compras da Matéria-Prima
                  </h3>
                  <span className="text-xs text-slate-500">{mpHistoricoSelecionada.nome}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMpHistoricoSelecionada(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
              {historicoMpQuery.isLoading && (
                <div className="text-center py-6 text-slate-400">Carregando histórico...</div>
              )}

              {historicoMpQuery.data && (
                <>
                  {/* 3 últimas compras em cards lado a lado */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Últimas 3 Compras Realizadas — preço na unidade original da NF
                    </span>

                    {historicoMpQuery.data.historico.length === 0 ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                        Nenhuma compra anterior registrada para esta matéria-prima neste sistema.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {historicoMpQuery.data.historico.slice(0, 3).map((h, idx) => {
                          const rotulos = ["1ª Mais Recente", "2ª Mais Recente", "3ª Mais Recente"];
                          const bgColor = idx === 0 ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200";
                          const textColor = idx === 0 ? "text-blue-700" : "text-slate-700";
                          const primeiraCompra = historicoMpQuery.data?.historico[0];
                          const valorTexto = idx > 0 && primeiraCompra
                            ? Number(h.valorUnitarioOriginal) - Number(primeiraCompra.valorUnitarioOriginal)
                            : null;

                          return (
                            <div key={h.itemId} className={`p-3.5 rounded-lg border ${bgColor} space-y-1`}>
                              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 block">
                                {rotulos[idx]}
                              </span>
                              <span className={`font-mono text-lg font-black block ${textColor}`}>
                                {fmtBrl(h.valorUnitarioOriginal)}
                                <span className="text-xs font-medium text-slate-500">/{h.unidadeCompra}</span>
                              </span>
                              {/* variação em relação à mais recente */}
                              {valorTexto !== null && (
                                <span
                                  className={`text-[11px] font-semibold flex items-center gap-0.5 ${
                                    valorTexto > 0 ? "text-emerald-700" : valorTexto < 0 ? "text-red-700" : "text-slate-500"
                                  }`}
                                >
                                  {valorTexto > 0
                                    ? <ArrowDownRight className="w-3 h-3" /> // ficou mais barato que essa (a atual é mais cara)
                                    : valorTexto < 0
                                    ? <ArrowUpRight className="w-3 h-3" /> // ficou mais caro
                                    : null}
                                  {valorTexto > 0 ? "era mais barato: " : valorTexto < 0 ? "era mais caro: " : "igual: "}
                                  {fmtBrl(Math.abs(valorTexto))} vs hoje
                                </span>
                              )}
                              <span className="text-[11px] text-slate-500 block truncate">{h.fornecedorNome}</span>
                              <span className="text-[10px] text-slate-400 font-mono block">{h.dataEmissao || "—"} · NF {h.numeroNf}</span>
                            </div>
                          );
                        })}
                        {/* Preenche cards vazios se tiver menos de 3 */}
                        {Array.from({ length: Math.max(0, 3 - historicoMpQuery.data.historico.length) }).map((_, i) => (
                          <div key={`vazio-${i}`} className="p-3.5 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center">
                            <span className="text-xs text-slate-400 italic">Sem dado</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Linha de custo atual no Mubisys */}
                  <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">Custo cadastrado hoje no Mubisys:</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">
                      {fmtBrl(historicoMpQuery.data.materiaPrima.custoUnitarioAtual)}/{historicoMpQuery.data.materiaPrima.unidadeMedida}
                    </span>
                  </div>

                  {/* Comparativo por Fornecedor */}
                  {(() => {
                    const historico = historicoMpQuery.data.historico;
                    if (historico.length < 2) return null;

                    // Agrupar por fornecedor e calcular média de preço
                    const porFornecedor = new Map<string, { nome: string; precos: number[]; unidade: string; ultimaData: string }>();
                    for (const h of historico) {
                      const key = h.fornecedorCnpj || h.fornecedorNome || "Desconhecido";
                      if (!porFornecedor.has(key)) {
                        porFornecedor.set(key, { nome: h.fornecedorNome || "Fornecedor sem nome", precos: [], unidade: h.unidadeCompra, ultimaData: h.dataEmissao || "" });
                      }
                      porFornecedor.get(key)!.precos.push(h.valorUnitarioOriginal);
                    }

                    // Só exibir se houver mais de 1 fornecedor OU o mesmo com múltiplas compras
                    const fornecedores = Array.from(porFornecedor.entries())
                      .map(([cnpj, dados]) => ({
                        cnpj,
                        nome: dados.nome,
                        mediaPreco: dados.precos.reduce((a, b) => a + b, 0) / dados.precos.length,
                        minPreco: Math.min(...dados.precos),
                        maxPreco: Math.max(...dados.precos),
                        totalCompras: dados.precos.length,
                        unidade: dados.unidade,
                        ultimaData: dados.ultimaData,
                      }))
                      .sort((a, b) => a.mediaPreco - b.mediaPreco); // mais barato primeiro

                    const maisBarato = fornecedores[0];

                    return (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                          Comparativo de Preço por Fornecedor (mesmo material)
                        </span>

                        <div className="space-y-1.5">
                          {fornecedores.map((f, idx) => {
                            const eMaisBarato = idx === 0 && fornecedores.length > 1;
                            const diffVsMaisBarato = idx > 0
                              ? ((f.mediaPreco - maisBarato.mediaPreco) / maisBarato.mediaPreco) * 100
                              : 0;

                            return (
                              <div
                                key={f.cnpj}
                                className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                                  eMaisBarato
                                    ? "bg-emerald-50 border-emerald-200"
                                    : "bg-white border-slate-200"
                                }`}
                              >
                                <div>
                                  <span className="font-semibold text-slate-800 block">{f.nome}</span>
                                  <span className="text-[10px] text-slate-400">
                                    {f.totalCompras} compra(s) · última: {f.ultimaData || "—"}
                                    {f.minPreco !== f.maxPreco && ` · variou de ${fmtBrl(f.minPreco)} a ${fmtBrl(f.maxPreco)}`}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className={`font-mono font-bold text-base block ${eMaisBarato ? "text-emerald-700" : "text-slate-800"}`}>
                                    {fmtBrl(f.mediaPreco)}/{f.unidade}
                                    {eMaisBarato && <span className="ml-1 text-[10px] bg-emerald-200 text-emerald-800 px-1 rounded">mais barato</span>}
                                  </span>
                                  {idx > 0 && (
                                    <span className="text-[11px] text-red-600 font-semibold">
                                      +{fmtPct(diffVsMaisBarato, 1)} vs mais barato
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Tabela com as compras passadas */}
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-2">Compras Registradas nas NFs:</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data / NF</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Preço Unit. NF</TableHead>
                          <TableHead className="text-right">Custo Real ERP</TableHead>
                          <TableHead className="text-right">Defasagem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historicoMpQuery.data.historico.map((h) => (
                          <TableRow key={h.itemId}>
                            <TableCell className="font-mono text-xs">
                              {h.dataEmissao || "—"}
                              <span className="text-[10px] text-slate-400 block">NF: {h.numeroNf}</span>
                            </TableCell>
                            <TableCell className="text-xs text-slate-700">{h.fornecedorNome}</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {fmtNum(h.quantidade)} {h.unidadeCompra}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold text-slate-800">
                              {fmtBrl(h.valorUnitarioOriginal)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {fmtBrl(h.custoRealErp)}/{h.unidadeErp}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold">
                              {h.divergenciaPct !== null ? (
                                <span className={h.divergenciaPct > 0 ? "text-red-600" : "text-emerald-600"}>
                                  {h.divergenciaPct > 0 ? "+" : ""}
                                  {fmtPct(h.divergenciaPct, 2)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {historicoMpQuery.data.historico.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-6 text-slate-400">
                              Nenhuma compra anterior encontrada para esta matéria-prima.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Assistente de Fórmulas de Conversão */}
      {itemCalculadoraFator !== null && calculoAoVivo?.itens[itemCalculadoraFator] && (
        <ModalCalculadoraFator
          key={itemCalculadoraFator + "-" + calculoAoVivo.itens[itemCalculadoraFator].unidadeCompraConversao + "-" + (calculoAoVivo.itens[itemCalculadoraFator].unidadeErp ?? "")}
          aberto={itemCalculadoraFator !== null}
          onFechar={() => setItemCalculadoraFator(null)}
          unidadeCompra={calculoAoVivo.itens[itemCalculadoraFator].unidadeCompra}
          unidadeCompraConversao={calculoAoVivo.itens[itemCalculadoraFator].unidadeCompraConversao}
          unidadeErp={calculoAoVivo.itens[itemCalculadoraFator].unidadeErp ?? ""}
          unidadeErpCadastro={calculoAoVivo.itens[itemCalculadoraFator].unidadeErpCadastro}
          descricaoNf={calculoAoVivo.itens[itemCalculadoraFator].descricaoNf}
          nomeMp={calculoAoVivo.itens[itemCalculadoraFator].nomeMateriaPrima ?? ""}
          fatorInicial={calculoAoVivo.itens[itemCalculadoraFator].fatorConversao}
          baseCalculoTextoInicial={calculoAoVivo.itens[itemCalculadoraFator].baseCalculoTexto}
          onAplicar={(fator, baseCalculoTexto, unidadeOrigem, unidadeDestino) => {
            const idx = itemCalculadoraFator;
            setItens((prev) => {
              const c = [...prev];
              c[idx] = {
                ...c[idx],
                unidadeCompraConversao: unidadeOrigem,
                unidadeErp: unidadeDestino,
                fatorConversao: fator,
                fatorConversaoTexto: String(fator),
                origemFator: "calculadora_modal",
                baseCalculoTexto,
              };
              return c;
            });
            setItemCalculadoraFator(null);
          }}
        />
      )}

      {itemCotacaoCalculadora !== null && cotacaoPdfResultado?.itens?.[itemCotacaoCalculadora]?.materiaPrimaVinculada && (
        <ModalCalculadoraFator
          key={`cotacao-${itemCotacaoCalculadora}-${cotacaoPdfResultado.itens[itemCotacaoCalculadora].unidade}-${cotacaoPdfResultado.itens[itemCotacaoCalculadora].materiaPrimaVinculada.unidadeMubisys}`}
          aberto={itemCotacaoCalculadora !== null}
          onFechar={() => setItemCotacaoCalculadora(null)}
          unidadeCompra={cotacaoPdfResultado.itens[itemCotacaoCalculadora].unidade}
          unidadeCompraConversao={cotacaoPdfResultado.itens[itemCotacaoCalculadora].unidadeOrigemConversaoCotacao}
          unidadeErp={cotacaoPdfResultado.itens[itemCotacaoCalculadora].materiaPrimaVinculada.unidadeMubisys}
          descricaoNf={cotacaoPdfResultado.itens[itemCotacaoCalculadora].descricao}
          nomeMp={cotacaoPdfResultado.itens[itemCotacaoCalculadora].materiaPrimaVinculada.nome}
          fatorInicial={cotacaoPdfResultado.itens[itemCotacaoCalculadora].fatorConversaoCotacao}
          baseCalculoTextoInicial={cotacaoPdfResultado.itens[itemCotacaoCalculadora].baseCalculoConversaoCotacao}
          onAplicar={(fator, baseCalculoTexto, unidadeOrigem, unidadeDestino) => {
            const indice = itemCotacaoCalculadora;
            setCotacaoPdfResultado((atual: any) => {
              if (!atual) return atual;
              return {
                ...atual,
                itens: atual.itens.map((linha: any, linhaIdx: number) => linhaIdx === indice
                  ? {
                      ...linha,
                      fatorConversaoCotacao: fator,
                      unidadeOrigemConversaoCotacao: unidadeOrigem,
                      unidadeDestinoConversaoCotacao: unidadeDestino,
                      baseCalculoConversaoCotacao: baseCalculoTexto,
                    }
                  : linha),
              };
            });
            setItemCotacaoCalculadora(null);
          }}
        />
      )}
    </div>
  );
}
