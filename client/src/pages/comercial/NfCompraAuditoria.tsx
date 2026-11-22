import { useState, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { fmtBrl, fmtNum, fmtPct } from "@/lib/format";
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
} from "lucide-react";

interface ItemEditavel {
  numeroItem: number;
  codigoFornecedor: string;
  descricaoNf: string;
  ncm: string | null;
  unidadeCompra: string;
  quantidade: number;
  valorUnitario: number;
  valorTotalItem: number;
  materiaPrimaId: number | null;
  nomeMateriaPrima: string | null;
  unidadeErp: "ML" | "M2" | "UN" | "LT" | null;
  fatorConversao: number | null;
  origemFator: string | null;
  baseCalculoTexto: string | null;
  confianca: "alta" | "media" | "baixa" | "nenhuma";
  pendencias: string[];
  custoCadastrado: number | null;
}

export default function NfCompraAuditoria() {
  const [abaAtiva, setAbaAtiva] = useState<"importar" | "memoria">("importar");

  // Configurações do frete e ICMS
  const [modoFrete, setModoFrete] = useState<"por_kg" | "valor_total">("por_kg");
  const [freteValor, setFreteValor] = useState<number>(2.21); // default R$ 2,21/kg (martinslog)
  const [percentualIcms, setPercentualIcms] = useState<number>(10);

  // Estado da NF carregada
  const [xmlTexto, setXmlTexto] = useState<string>("");
  const [cabecalho, setCabecalho] = useState<{
    numero?: string;
    serie?: string;
    chaveAcesso?: string | null;
    dataEmissao?: string | null;
    cnpjFornecedor: string;
    nomeFornecedor?: string;
    valorProdutos: number;
    valorFreteNf: number;
    pesoLiquidoTotalKg: number | null;
  } | null>(null);

  const [itens, setItens] = useState<ItemEditavel[]>([]);
  const [itemEmEdicao, setItemEmEdicao] = useState<number | null>(null);
  const [buscaMp, setBuscaMp] = useState<string>("");

  // Queries e mutations tRPC
  const processarXmlMutation = trpc.nfCompra.processarXml.useMutation();
  const calcularPreviaMutation = trpc.nfCompra.calcularPrevia.useMutation();
  const salvarMutation = trpc.nfCompra.salvarEGravarMemoria.useMutation();
  const buscarMpsQuery = trpc.nfCompra.buscarMateriasPrimas.useQuery(
    { busca: buscaMp, limite: 15 },
    { enabled: buscaMp.trim().length >= 2 }
  );
  const memoriasQuery = trpc.nfCompra.listarMemoriaPorFornecedor.useQuery(
    { cnpjFornecedor: cabecalho?.cnpjFornecedor },
    { enabled: abaAtiva === "memoria" }
  );

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
          setItens(
            data.itens.map((i) => ({
              numeroItem: i.numeroItem,
              codigoFornecedor: i.codigoFornecedor,
              descricaoNf: i.descricaoNf,
              ncm: i.ncm,
              unidadeCompra: i.unidadeCompra,
              quantidade: i.quantidade,
              valorUnitario: i.valorUnitario,
              valorTotalItem: i.valorTotalItem,
              materiaPrimaId: i.materiaPrimaId,
              nomeMateriaPrima: i.nomeMateriaPrima,
              unidadeErp: i.unidadeErp as any,
              fatorConversao: i.fatorConversao,
              origemFator: i.origemFator,
              baseCalculoTexto: i.baseCalculoTexto,
              confianca: i.confianca,
              pendencias: i.pendencias,
              custoCadastrado: i.custoCadastrado,
            }))
          );
        },
      }
    );
  };

  // Cálculo ao vivo derivado
  const calculoAoVivo = useMemo(() => {
    if (!cabecalho || itens.length === 0) return null;
    const freteValorPorKg = modoFrete === "por_kg" ? freteValor : undefined;
    const freteValorTotal = modoFrete === "valor_total" ? freteValor : 0;

    let totalFrete = 0;
    let totalIcms = 0;
    let totalCustoGeral = 0;

    const itensCalculados = itens.map((item) => {
      const peso = item.unidadeCompra === "KG" ? item.quantidade : 0;
      const rateioFrete =
        freteValorPorKg !== undefined
          ? peso * freteValorPorKg
          : cabecalho.valorProdutos > 0
          ? freteValorTotal * (item.valorTotalItem / cabecalho.valorProdutos)
          : 0;

      const rateioIcms = (item.valorTotalItem + rateioFrete) * (percentualIcms / 100);
      const custoItemTotal = item.valorTotalItem + rateioFrete + rateioIcms;

      totalFrete += rateioFrete;
      totalIcms += rateioIcms;
      totalCustoGeral += custoItemTotal;

      let custoRealErp = 0;
      let divergenciaPct: number | null = null;
      let defasado = false;

      if (item.fatorConversao && item.fatorConversao > 0) {
        const qtdErp = item.quantidade * item.fatorConversao;
        custoRealErp = qtdErp > 0 ? custoItemTotal / qtdErp : 0;
      } else {
        custoRealErp = item.quantidade > 0 ? custoItemTotal / item.quantidade : 0;
      }

      if (item.custoCadastrado && item.custoCadastrado > 0 && custoRealErp > 0) {
        divergenciaPct = ((custoRealErp - item.custoCadastrado) / item.custoCadastrado) * 100;
        defasado = Math.abs(divergenciaPct) > 0.005;
      }

      return {
        ...item,
        rateioFrete,
        rateioIcms,
        custoItemTotal,
        custoRealErp,
        divergenciaPct,
        defasado,
      };
    });

    return {
      totalFrete,
      totalIcms,
      totalCustoGeral,
      itens: itensCalculados,
    };
  }, [cabecalho, itens, modoFrete, freteValor, percentualIcms]);

  // Ação de vincular uma matéria-prima selecionada a um item da NF
  const selecionarMpParaItem = (idxItem: number, mp: any) => {
    setItens((prev) => {
      const copia = [...prev];
      const alvo = copia[idxItem];
      const unidadeErp = mp.unidadeMedida?.toLowerCase().includes("metro linear")
        ? "ML"
        : mp.unidadeMedida?.toLowerCase().includes("quadrad")
        ? "M2"
        : "UN";

      // Tentar calcular fator teórico se tiver espessura+largura+densidade (formato tira)
      let fator = alvo.fatorConversao;
      let baseTexto = alvo.baseCalculoTexto;
      let origemFator = "manual";

      if (alvo.unidadeCompra === "KG" && unidadeErp === "ML" && mp.tecnico?.densidadeGCm3 && mp.tecnico?.espessuraMm && mp.tecnico?.perfilLarguraMm) {
        const kgPorM = (mp.tecnico.perfilLarguraMm * mp.tecnico.espessuraMm * mp.tecnico.densidadeGCm3) / 1000;
        fator = Number((1 / kgPorM).toFixed(6));
        origemFator = "cadastro_densidade_perfil";
        baseTexto = `Perfil (tira): ${mp.tecnico.perfilLarguraMm}mm larg × ${mp.tecnico.espessuraMm}mm esp × ${mp.tecnico.densidadeGCm3} g/cm³ = ${kgPorM.toFixed(4)} kg/m → 1 kg = ${fator} ml.`;
      }

      copia[idxItem] = {
        ...alvo,
        materiaPrimaId: mp.id,
        nomeMateriaPrima: mp.nome,
        unidadeErp,
        fatorConversao: fator,
        origemFator,
        baseCalculoTexto: baseTexto,
        custoCadastrado: mp.custoUnitario,
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
    salvarMutation.mutate(
      {
        cabecalho: {
          numero: cabecalho.numero,
          serie: cabecalho.serie,
          chaveAcesso: cabecalho.chaveAcesso ?? undefined,
          cnpjFornecedor: cabecalho.cnpjFornecedor,
          nomeFornecedor: cabecalho.nomeFornecedor,
          dataEmissao: cabecalho.dataEmissao ?? undefined,
          valorProdutos: cabecalho.valorProdutos,
          valorFreteNf: cabecalho.valorFreteNf,
          pesoLiquidoTotalKg: cabecalho.pesoLiquidoTotalKg,
          modoRateioFrete: modoFrete,
          freteValorPorKg: modoFrete === "por_kg" ? freteValor : null,
          percentualIcms,
        },
        itens: calculoAoVivo.itens.map((i) => ({
          numeroItem: i.numeroItem,
          codigoFornecedor: i.codigoFornecedor,
          descricaoNf: i.descricaoNf,
          ncm: i.ncm,
          unidadeCompra: i.unidadeCompra,
          quantidade: i.quantidade,
          valorUnitario: i.valorUnitario,
          valorTotalItem: i.valorTotalItem,
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
          alert("Auditoria salva com sucesso! Os vínculos foram memorizados para as próximas NFs deste fornecedor.");
        },
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
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setAbaAtiva("importar")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            abaAtiva === "importar"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Conferir NF de Compra
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("memoria")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            abaAtiva === "memoria"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Brain className="w-4 h-4" />
          Memória de Vínculos por Fornecedor (Auditoria)
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
                  onChange={(e) => setModoFrete(e.target.value as any)}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white"
                >
                  <option value="por_kg">Por KG (transportadora cobra R$/kg)</option>
                  <option value="valor_total">Valor total na NF (rateio por R$)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {modoFrete === "por_kg" ? "Frete por KG (R$/kg)" : "Frete Total (R$)"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={freteValor}
                  onChange={(e) => setFreteValor(Number(e.target.value))}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                ICMS aplicado item a item:
              </span>
              <label className="flex items-center gap-1 font-medium text-slate-700">
                <input
                  type="number"
                  step="0.5"
                  value={percentualIcms}
                  onChange={(e) => setPercentualIcms(Number(e.target.value))}
                  className="w-14 px-2 py-0.5 border border-slate-300 rounded text-right text-xs"
                />
                % sobre (mercadoria + frete)
              </label>
            </div>
          </div>

          {/* Card 2: Resumo do Cabeçalho da NF */}
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    2. Calibração e Linkagem de Cada Item com o Mubisys
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Itens identificados pela memória aparecem com badge verde. Para os novos, busque a MP e confirme o fator.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={salvarAuditoria}
                  disabled={salvarMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {salvarMutation.isPending ? "Gravando..." : "Confirmar e Gravar Memória"}
                </button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-64">Item na NF (Fornecedor)</TableHead>
                    <TableHead className="w-72">Matéria-Prima no Radrasys / Mubisys</TableHead>
                    <TableHead className="text-right w-24">Qtd / Un. Compra</TableHead>
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
                          <input
                            type="number"
                            step="0.0001"
                            value={item.fatorConversao ?? ""}
                            onChange={(e) => {
                              const valor = Number(e.target.value);
                              setItens((prev) => {
                                const c = [...prev];
                                c[idx].fatorConversao = valor > 0 ? valor : null;
                                c[idx].origemFator = "manual";
                                return c;
                              });
                            }}
                            placeholder="ex: 3.15"
                            className="w-20 px-2 py-1 text-right text-xs border border-slate-300 rounded"
                          />
                          <span className="text-[10px] text-slate-400 block">{item.unidadeErp ?? "—"}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-slate-800">
                          {fmtBrl(item.custoRealErp)}
                          <span className="text-[10px] text-slate-400 block font-normal">/{item.unidadeErp ?? item.unidadeCompra}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-slate-600">
                          {item.custoCadastrado ? fmtBrl(item.custoCadastrado) : "—"}
                          <span className="text-[10px] text-slate-400 block font-normal">/{item.unidadeErp ?? "—"}</span>
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
                  <TableCell className="text-xs font-mono">{m.unidadeErp}</TableCell>
                  <TableCell className="text-xs font-mono text-right">{fmtNum(Number(m.fatorConversao), 6)}</TableCell>
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
                  <TableCell colSpan={8} className="text-center py-6 text-slate-400 text-xs">
                    Nenhum vínculo memorizado ainda. Confirme sua primeira NF para começar a alimentar a memória.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
