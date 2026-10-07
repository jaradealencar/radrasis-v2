import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BotaoCopiarImagem } from "@/components/BotaoCopiarImagem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableFooter,
} from "@/components/ui/table";
import { toast } from "sonner";
import { fmtBrl, fmtDate, fmtNum } from "@/lib/format";
import { adicionarDiasUteisComFeriados } from "@shared/feriados-nacionais";
import { ledPowerSourceTextKey } from "@shared/led-power-sources";
import {
  FATOR_RECOMENDADO,
  FATOR_TOLERANCIA,
  dimensionarFontes,
  resumirPlano,
  type FonteDisponivel,
  type PlanoFontes,
} from "@shared/led-fontes-calculo";
import {
  AROS_FRONTLIGHT,
  CATEGORIAS_PRODUTIVIDADE,
  ESTILO_PRODUTIVIDADE_VAZIO,
  FORMATOS_PRODUTIVIDADE,
  FUNDOS_PRODUTIVIDADE,
  MATERIAIS_SOLDA,
  ROTULO_ARO_FRONTLIGHT,
  ROTULO_CATEGORIA_PRODUTIVIDADE,
  ROTULO_FORMATO_PRODUTIVIDADE,
  ROTULO_FUNDO_PRODUTIVIDADE,
  ROTULO_MATERIAL_SOLDA,
  ROTULO_TAMANHO_PRODUTIVIDADE,
  ROTULO_TIPO_SOLDA,
  TAMANHOS_PRODUTIVIDADE,
  TIPOS_SOLDA,
  alternarAroFrontlight,
  alternarCategoriaProdutividade,
  alternarFormatoProdutividade,
  alternarFundoProdutividade,
  alternarMaterialSolda,
  alternarTamanhoProdutividade,
  alternarTipoSolda,
  rotulosEstiloProdutividade,
  type AroFrontlight,
  type CategoriaProdutividade,
  type EstiloProdutividade,
  type FormatoProdutividade,
  type FundoProdutividade,
  type MaterialSolda,
  type TamanhoProdutividade,
  type TipoSolda,
} from "@shared/produtividade-solda";
import { useAuth } from "@/hooks/useAuth";
import type {
  LedModuleTable,
  LedPowerSourceTables,
  LedPowerSourceTextOverrides,
  LedTapeTable,
} from "@shared/led-power-sources";
import {
  Pencil,
  Save,
  X,
  Info,
  FileText,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  History,
  Image as ImageIcon,
  Upload,
  Hammer,
  RefreshCw,
  Calculator,
  BarChart3,
} from "lucide-react";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { enviarArquivo } from "@/lib/upload";
import RichTextEditor from "../../components/RichTextEditor";
import type { ConfigItem, MarginRow, ContentJson } from "@shared/price-table";
import { PriceTableHistoryDashboard } from "@/components/PriceTableHistoryDashboard";
import { PriceAdjustmentCalculator } from "@/components/PriceAdjustmentCalculator";
import { PriceBlockAffiliationEditor } from "@/components/PriceBlockAffiliationEditor";
import { Link2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type BlockAffiliation = RouterOutputs["price"]["listBlockAffiliations"][number];

interface Section {
  id: number;
  page: number;
  sectionOrder: number;
  sectionTitle: string;
  contentJson: string;
  notes: string | null;
  updatedAt: string | Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extrai apenas os dígitos e separadores numéricos de uma string (ex: "31%" → "31", "R$ 1.250,00" → "1.250,00") */
function extractNumber(val: string): string {
  // Remove tudo que não seja dígito, vírgula ou ponto
  const cleaned = val.replace(/[^0-9.,]/g, "").trim();
  return cleaned || val.trim();
}

/** Botão de copiar com feedback visual. Por padrão só aparece no hover do
 * grupo pai (`.group`); `forceVisible` mantém sempre visível — usado em
 * IdBadge, onde o objetivo é copiar o ID sem precisar passar o mouse. */
function CopyButton({
  value,
  forceVisible,
}: {
  value: string;
  forceVisible?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const numericValue = extractNumber(value);
      try {
        await navigator.clipboard.writeText(numericValue);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // fallback para browsers sem clipboard API
        const ta = document.createElement("textarea");
        ta.value = numericValue;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    },
    [value]
  );
  return (
    <button
      onClick={handleCopy}
      title={`Copiar ${extractNumber(value)}`}
      className={`ml-1.5 transition-opacity duration-150 text-slate-400 hover:text-blue-600 focus:opacity-100 focus:outline-none ${forceVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
    >
      {copied ? (
        <Check size={12} className="text-green-500" />
      ) : (
        <Copy size={12} />
      )}
    </button>
  );
}

function highlightClass(h?: string) {
  if (h === "red")
    return "bg-red-100 text-red-800 border border-red-300 font-semibold";
  if (h === "yellow")
    return "bg-amber-50 text-amber-800 border border-amber-300 font-semibold";
  if (h === "blue") return "bg-blue-50 text-blue-800 border border-blue-300";
  return "bg-slate-50 text-slate-700";
}

/**
 * Renderiza um texto trocando cada "<número>%" por: o número como texto normal
 * (copiável) + o "%" como conteúdo CSS (::after) — visível e acinzentado, mas
 * nunca um caractere de verdade. Assim, selecionar/copiar o valor (manualmente
 * ou pelo CopyButton) nunca traz o sinal de porcentagem junto, só o numeral.
 */
function renderPercentDecorated(text: string): React.ReactNode {
  const re = /(-?\d+(?:,\d+)?)\s*%/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    parts.push(
      <span key={key++} className="whitespace-nowrap">
        {m[1]}
        <span
          className="after:content-['%'] after:text-slate-400"
          aria-hidden="true"
        />
      </span>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : text;
}

/** Badge com o ID estável da linha/regra (ver shared/price-table.ts) — usado
 * para cadastrar o produto no precificador automatizado externo, cruzando
 * pelo ID em vez do texto do label. Botão de copiar sempre visível (não só
 * no hover) porque o uso típico é copiar vários IDs em sequência. */
function IdBadge({ id }: { id: number }) {
  if (!id) {
    return (
      <span
        title="ID ainda não atribuído — salve a linha para gerar um"
        className="text-[11px] font-mono text-slate-300 italic"
      >
        novo
      </span>
    );
  }
  return (
    <span
      title={`ID #${id} — use este número para cadastrar o produto no precificador`}
      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-slate-500"
    >
      #{id}
      <CopyButton value={String(id)} forceVisible />
    </span>
  );
}

function ConfigTable({ items }: { items: ConfigItem[] }) {
  return (
    <div className="flex flex-wrap gap-3 mb-2">
      {items.map((item, i) => (
        <div
          key={i}
          className={`group px-3 py-2 rounded-lg text-sm ${highlightClass(item.highlight)} flex items-center gap-1`}
        >
          <IdBadge id={item.id} />
          <span className="font-medium">{item.label}:</span>{" "}
          <span className="text-base font-bold">
            {renderPercentDecorated(item.value)}
          </span>
          <CopyButton value={item.value} />
          {item.note && (
            <div className="text-xs mt-0.5 opacity-80 w-full">{item.note}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function MarginTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: MarginRow[];
}) {
  return (
    <Table className="border-collapse">
      <TableHeader>
        <TableRow className="bg-slate-100">
          <TableHead className="text-center border border-slate-300 w-20 text-slate-800 font-semibold">
            ID
          </TableHead>
          {rows.length > 1 && (
            <TableHead className="text-center border border-slate-300 min-w-[140px] text-slate-800 font-semibold">
              {columns[0] ?? ""}
            </TableHead>
          )}
          {(rows.length > 1 ? columns.slice(1) : columns).map((col, i) => (
            <TableHead
              key={i}
              className="text-center border border-slate-300 text-slate-800 font-semibold"
            >
              {col}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, ri) => (
          <TableRow
            key={ri}
            className={ri % 2 === 0 ? "bg-white" : "bg-slate-50"}
          >
            <TableCell className="text-center border border-slate-200">
              <IdBadge id={row.id} />
            </TableCell>
            {rows.length > 1 && (
              <TableCell className="font-medium text-slate-700 border border-slate-200">
                {row.label}
              </TableCell>
            )}
            {row.values.map((val, vi) => (
              <TableCell
                key={vi}
                className="group text-center border border-slate-200"
              >
                <span className="font-semibold text-blue-700">
                  {renderPercentDecorated(val)}
                </span>
                {val.trim() !== "" && <CopyButton value={val} />}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EditableLedText({
  textKey,
  value,
  texts,
  className = "",
  showValue = true,
}: {
  textKey: string;
  value: string;
  texts: LedPowerSourceTextOverrides;
  className?: string;
  showValue?: boolean;
}) {
  const displayed = texts[textKey] ?? value;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayed);
  const utils = trpc.useUtils();
  const saveMutation = trpc.custoLed.saveDimensionamentoTexto.useMutation({
    onSuccess: () => {
      utils.custoLed.getDimensionamentoFontes.invalidate();
      setEditing(false);
      toast.success("Texto atualizado.");
    },
    onError: () => toast.error("Não foi possível salvar o texto."),
  });

  useEffect(() => {
    if (!editing) setDraft(displayed);
  }, [displayed, editing]);

  if (editing) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <Input
          autoFocus
          value={draft}
          maxLength={300}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") saveMutation.mutate({ key: textKey, value: draft });
            if (event.key === "Escape") setEditing(false);
          }}
          className="h-7 min-w-24 px-2 text-sm"
          aria-label="Editar texto"
        />
        <button
          type="button"
          title="Salvar texto"
          aria-label="Salvar texto"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate({ key: textKey, value: draft })}
          className="rounded p-1 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Cancelar edição"
          aria-label="Cancelar edição"
          onClick={() => { setDraft(displayed); setEditing(false); }}
          className="rounded p-1 text-slate-500 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </span>
    );
  }

  return (
    <span className={`group/led-text inline-flex items-center gap-1 ${className}`}>
      {showValue && <span>{displayed}</span>}
      <button
        type="button"
        title={`Editar: ${displayed || "texto vazio"}`}
        aria-label={`Editar texto ${displayed || "vazio"}`}
        onClick={() => setEditing(true)}
        className="rounded p-0.5 text-sky-700 opacity-70 transition-opacity hover:bg-sky-50 hover:opacity-100 focus:opacity-100"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </span>
  );
}

function formatarMetrosLed(valor: number, tabela: LedTapeTable, unit: string): string {
  const casas = tabela.fixedDecimals || !Number.isInteger(valor) ? tabela.decimals : 0;
  return `${fmtNum(valor, casas)} ${unit}`;
}

function LedTapePowerTable({ tabela, texts }: { tabela: LedTapeTable; texts: LedPowerSourceTextOverrides }) {
  const columns: Array<["source" | "voltage" | "power" | "recommended" | "maximum", string]> = [
    ["source", "Fonte"],
    ["voltage", "Tensão"],
    ["power", "Potência da fonte"],
    ["recommended", `Fita LED ${tabela.wattsPerMeter} W/m — recomendado (85%)`],
    ["maximum", `Fita LED ${tabela.wattsPerMeter} W/m — limite máximo (100%)`],
  ];
  const subtitle = `Fita LED linear · consumo de ${tabela.wattsPerMeter} W por metro`;
  const title = getLedText(texts, ledPowerSourceTextKey.title(tabela.key), tabela.title);

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="items-start gap-1 pb-3 pt-3 text-left">
        <CardTitle className="text-left text-base font-semibold text-slate-800">
          <EditableLedText textKey={ledPowerSourceTextKey.title(tabela.key)} value={tabela.title} texts={texts} />
        </CardTitle>
        <span className="block w-fit max-w-full rounded border border-sky-200 bg-sky-100 px-2.5 py-1 text-sm font-semibold text-sky-800">
          <EditableLedText textKey={ledPowerSourceTextKey.subtitle(tabela.key)} value={subtitle} texts={texts} />
        </span>
        <LedImageLink tableKey={tabela.key} title={title} texts={texts} />
      </CardHeader>
      <div className="overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-slate-100">
              {columns.map(([key, value]) => <TableHead key={key} className="whitespace-nowrap"><EditableLedText textKey={ledPowerSourceTextKey.column(tabela.key, key)} value={value} texts={texts} /></TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tabela.rows.map((row, rowIndex) => (
              <TableRow key={row.source}>
                <TableCell className="font-medium"><EditableLedText textKey={ledPowerSourceTextKey.row(tabela.key, rowIndex, "source")} value={row.source} texts={texts} /></TableCell>
                <TableCell><EditableLedText textKey={ledPowerSourceTextKey.row(tabela.key, rowIndex, "voltage")} value={row.voltage} texts={texts} /></TableCell>
                <TableCell>{fmtNum(row.powerW)} <EditableLedText textKey={ledPowerSourceTextKey.common("powerUnit")} value="W" texts={texts} /></TableCell>
                <TableCell>{fmtNum(row.recommendedMeters, tabela.fixedDecimals || !Number.isInteger(row.recommendedMeters) ? tabela.decimals : 0)} <EditableLedText textKey={ledPowerSourceTextKey.common("meterUnit")} value="m" texts={texts} /></TableCell>
                <TableCell>{fmtNum(row.maximumMeters, tabela.fixedDecimals || !Number.isInteger(row.maximumMeters) ? tabela.decimals : 0)} <EditableLedText textKey={ledPowerSourceTextKey.common("meterUnit")} value="m" texts={texts} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function LedModulePowerTable({ tabela, texts }: { tabela: LedModuleTable; texts: LedPowerSourceTextOverrides }) {
  const columns: Array<["source" | "voltage" | "power" | "recommended" | "maximum", string]> = [
    ["source", "Fonte"],
    ["voltage", "Tensão"],
    ["power", "Potência da fonte"],
    ["recommended", "Recomendado para vendas (85%)"],
    ["maximum", "Limite máximo (100%)"],
  ];
  const title = getLedText(texts, ledPowerSourceTextKey.title(tabela.key), tabela.title);
  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="items-start gap-1 pb-3 pt-3 text-left">
        <CardTitle className="text-left text-base font-semibold text-slate-800">
          <EditableLedText textKey={ledPowerSourceTextKey.title(tabela.key)} value={tabela.title} texts={texts} />
        </CardTitle>
        <span className="block w-fit max-w-full rounded border border-violet-200 bg-violet-100 px-2.5 py-1 text-sm font-semibold text-violet-800">
          <EditableLedText textKey={ledPowerSourceTextKey.subtitle(tabela.key)} value={tabela.subtitle} texts={texts} />
        </span>
        <LedImageLink tableKey={tabela.key} title={title} texts={texts} />
      </CardHeader>
      <div className="overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-slate-100">
              {columns.map(([key, value]) => <TableHead key={key} className="whitespace-nowrap"><EditableLedText textKey={ledPowerSourceTextKey.column(tabela.key, key)} value={value} texts={texts} /></TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tabela.rows.map((row, rowIndex) => (
              <TableRow key={row.source}>
                <TableCell className="font-medium"><EditableLedText textKey={ledPowerSourceTextKey.row(tabela.key, rowIndex, "source")} value={row.source} texts={texts} /></TableCell>
                <TableCell><EditableLedText textKey={ledPowerSourceTextKey.row(tabela.key, rowIndex, "voltage")} value={row.voltage} texts={texts} /></TableCell>
                <TableCell>{fmtNum(row.powerW)} <EditableLedText textKey={ledPowerSourceTextKey.common("powerUnit")} value="W" texts={texts} /></TableCell>
                <TableCell><EditableLedText textKey={ledPowerSourceTextKey.common("moduleRecommendedPrefix")} value="Até" texts={texts} /> {fmtNum(row.recommendedModules)} <EditableLedText textKey={ledPowerSourceTextKey.common("moduleUnit")} value="módulos" texts={texts} /></TableCell>
                <TableCell>{fmtNum(row.maximumModules)} <EditableLedText textKey={ledPowerSourceTextKey.common("moduleUnit")} value="módulos" texts={texts} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

interface OpcaoCalculadoraLed {
  chave: string;
  grupo: "fita" | "modulo";
  rotulo: string;
  tensao: string;
  wattsPorUnidade: number;
  /** Menor fração pedida: 0,1 m na fita, 1 módulo. */
  passo: number;
  fontes: FonteDisponivel[];
}

const casasWatts = (watts: number) => (Number.isInteger(watts) ? 0 : 1);
/** 2.380 W ou 649,4 W: sem casas decimais quando o valor é inteiro. */
const fmtWatts = (watts: number) => `${fmtNum(watts, casasWatts(watts))} W`;

/** Monta as opções do menu a partir das tabelas da própria página (mesmas fontes, mesmos nomes editados). */
function opcoesCalculadoraLed(dimensionamento: { tables: LedPowerSourceTables; texts: LedPowerSourceTextOverrides }): OpcaoCalculadoraLed[] {
  const { tables, texts } = dimensionamento;
  const fontesDe = (tabela: LedTapeTable | LedModuleTable): FonteDisponivel[] =>
    tabela.rows.map((linha, indice) => ({
      nome: getLedText(texts, ledPowerSourceTextKey.row(tabela.key, indice, "source"), linha.source),
      potenciaW: linha.powerW,
    }));
  const tensaoDe = (tabela: LedTapeTable | LedModuleTable) =>
    getLedText(texts, ledPowerSourceTextKey.row(tabela.key, 0, "voltage"), tabela.rows[0]?.voltage ?? "");
  const tituloDe = (tabela: LedTapeTable | LedModuleTable) => getLedText(texts, ledPowerSourceTextKey.title(tabela.key), tabela.title);
  return [
    ...tables.tapes.map((tabela): OpcaoCalculadoraLed => ({
      chave: tabela.key,
      grupo: "fita",
      rotulo: `${tituloDe(tabela)} · ${fmtNum(tabela.wattsPerMeter, casasWatts(tabela.wattsPerMeter))} W/m`,
      tensao: tensaoDe(tabela),
      wattsPorUnidade: tabela.wattsPerMeter,
      passo: 0.1,
      fontes: fontesDe(tabela),
    })),
    ...tables.modules.map((tabela): OpcaoCalculadoraLed => ({
      chave: tabela.key,
      grupo: "modulo",
      rotulo: `${tituloDe(tabela)} · ${fmtNum(tabela.wattsPerModule, casasWatts(tabela.wattsPerModule))} W/módulo`,
      tensao: tensaoDe(tabela),
      wattsPorUnidade: tabela.wattsPerModule,
      passo: 1,
      fontes: fontesDe(tabela),
    })),
  ];
}

function PlanoFontesCard({ titulo, plano, opcao, destaque }: { titulo: string; plano: PlanoFontes; opcao: OpcaoCalculadoraLed; destaque?: boolean }) {
  const unidade = opcao.grupo === "fita" ? "m" : "módulos";
  const casasQuantidade = opcao.grupo === "fita" ? 1 : 0;
  const resumo = resumirPlano(plano).map(grupo => `${grupo.copias} × ${grupo.nome}`).join(" + ");
  const noLimite = plano.faixa === "tolerancia";
  return (
    <div className={`space-y-3 rounded-md border p-3 ${destaque ? "border-blue-300 bg-blue-50/40" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
          <p className="text-lg font-bold text-slate-900">{resumo}</p>
          <p className="text-xs text-slate-500">
            {opcao.tensao} · {fmtWatts(plano.potenciaInstaladaW)} instalados · {plano.totalFontes === 1 ? "1 fonte" : `${plano.totalFontes} fontes`}
          </p>
        </div>
        <Badge
          variant="outline"
          className={noLimite ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}
        >
          {noLimite
            ? `Passa de ${fmtNum(FATOR_RECOMENDADO * 100)}%, mas cabe em ${fmtNum(FATOR_TOLERANCIA * 100)}%: não precisa de outra fonte`
            : `Dentro da margem de ${fmtNum(FATOR_RECOMENDADO * 100)}%`}
        </Badge>
      </div>
      <div className="overflow-x-auto rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Fonte</TableHead>
              <TableHead className="text-right">LED ligado a ela</TableHead>
              <TableHead className="text-right">Carga</TableHead>
              <TableHead className="text-right">Uso da fonte</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plano.fontes.map((item, indice) => (
              <TableRow key={`${item.fonte.nome}-${indice}`}>
                <TableCell className="font-medium">
                  {plano.totalFontes > 1 ? `${indice + 1}. ` : ""}{item.fonte.nome} <span className="text-xs font-normal text-slate-500">({fmtNum(item.fonte.potenciaW)} W)</span>
                </TableCell>
                <TableCell className="text-right">{fmtNum(item.quantidade, casasQuantidade)} {unidade}</TableCell>
                <TableCell className="text-right">{fmtWatts(item.cargaW)}</TableCell>
                <TableCell className={`text-right font-semibold ${item.faixa === "tolerancia" ? "text-amber-700" : "text-emerald-700"}`}>
                  {fmtNum(item.utilizacao * 100, 1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CalculadoraFontesLed({ dimensionamento }: { dimensionamento: { tables: LedPowerSourceTables; texts: LedPowerSourceTextOverrides } }) {
  const opcoes = useMemo(() => opcoesCalculadoraLed(dimensionamento), [dimensionamento]);
  const [chave, setChave] = useState(opcoes[0]?.chave ?? "");
  const [quantidadeInformada, setQuantidadeInformada] = useState("");
  const opcao = opcoes.find(item => item.chave === chave) ?? opcoes[0];
  const quantidade = Number(quantidadeInformada.replace(",", "."));
  const preenchida = quantidadeInformada.trim() !== "";

  const resultado = useMemo(
    () =>
      opcao && preenchida
        ? dimensionarFontes({ fontes: opcao.fontes, wattsPorUnidade: opcao.wattsPorUnidade, passo: opcao.passo, quantidade })
        : null,
    [opcao, preenchida, quantidade]
  );

  if (!opcao) return null;
  const unidadeCampo = opcao.grupo === "fita" ? "metros" : "módulos";
  const grupos: Array<[OpcaoCalculadoraLed["grupo"], string]> = [["fita", "Fitas LED (por metro)"], ["modulo", "Módulos LED (por unidade)"]];

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-blue-600" />
          Calculadora de fontes
        </CardTitle>
        <p className="text-xs text-slate-500">
          Escolha o LED e a quantidade: o sistema indica quais fontes e quantas usar. Trabalha com {fmtNum(FATOR_RECOMENDADO * 100)}% de uso da fonte e aceita até {fmtNum(FATOR_TOLERANCIA * 100)}% antes de sugerir outra.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
          <label className="space-y-1 text-xs font-medium text-slate-600">
            LED utilizado
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-slate-900"
              value={opcao.chave}
              onChange={event => setChave(event.target.value)}
            >
              {grupos.map(([grupo, rotuloGrupo]) => (
                <optgroup key={grupo} label={rotuloGrupo}>
                  {opcoes.filter(item => item.grupo === grupo).map(item => (
                    <option key={item.chave} value={item.chave}>{item.rotulo}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Quantidade ({unidadeCampo})
            <Input
              type="number"
              min="0"
              step={opcao.passo}
              inputMode="decimal"
              value={quantidadeInformada}
              onChange={event => setQuantidadeInformada(event.target.value)}
              placeholder={opcao.grupo === "fita" ? "Ex.: 12,5" : "Ex.: 150"}
            />
          </label>
        </div>

        {!resultado ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Informe a quantidade de {unidadeCampo} para ver as fontes indicadas.
          </p>
        ) : resultado.aviso && !resultado.recomendado ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{resultado.aviso}</p>
        ) : (
          resultado.recomendado && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Consumo total: <strong className="text-slate-900">{fmtWatts(resultado.consumoTotalW)}</strong>
                <span className="text-xs text-slate-500"> ({fmtNum(quantidade, casasWatts(quantidade))} {unidadeCampo} × {fmtWatts(opcao.wattsPorUnidade)})</span>
              </p>
              <PlanoFontesCard titulo="Recomendado" plano={resultado.recomendado} opcao={opcao} destaque />
              {resultado.comFolga && (
                <PlanoFontesCard titulo={`Se preferir ficar dentro de ${fmtNum(FATOR_RECOMENDADO * 100)}%`} plano={resultado.comFolga} opcao={opcao} />
              )}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

function LedPowerSourcesSection({ dimensionamento }: { dimensionamento?: { tables: LedPowerSourceTables; texts: LedPowerSourceTextOverrides } }) {
  if (!dimensionamento) {
    return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  }

  return (
    <div className="space-y-3">
    <CalculadoraFontesLed dimensionamento={dimensionamento} />
    <div className="flex items-center gap-2 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
      <Pencil className="h-3.5 w-3.5 shrink-0" />
      Passe o cursor sobre um texto e clique no lápis para editá-lo.
    </div>
    <Tabs defaultValue="fitas" className="space-y-4">
      <TabsList className="grid h-auto w-full max-w-md grid-cols-2 bg-slate-100 p-1">
        <div className="relative">
          <TabsTrigger value="fitas" className="w-full py-2">{getLedText(dimensionamento.texts, ledPowerSourceTextKey.page("tapesTab"), "Fitas LED (metros)")}</TabsTrigger>
          <EditableLedText textKey={ledPowerSourceTextKey.page("tapesTab")} value="Fitas LED (metros)" texts={dimensionamento.texts} showValue={false} className="absolute right-1 top-1/2 z-10 -translate-y-1/2" />
        </div>
        <div className="relative">
          <TabsTrigger value="modulos" className="w-full py-2">{getLedText(dimensionamento.texts, ledPowerSourceTextKey.page("modulesTab"), "Módulos LED (unidades)")}</TabsTrigger>
          <EditableLedText textKey={ledPowerSourceTextKey.page("modulesTab")} value="Módulos LED (unidades)" texts={dimensionamento.texts} showValue={false} className="absolute right-1 top-1/2 z-10 -translate-y-1/2" />
        </div>
      </TabsList>
      <TabsContent value="fitas" className="space-y-4">
        {dimensionamento.tables.tapes.map(tabela => <LedTapePowerTable key={tabela.key} tabela={tabela} texts={dimensionamento.texts} />)}
      </TabsContent>
      <TabsContent value="modulos" className="space-y-4">
        {dimensionamento.tables.modules.map(tabela => <LedModulePowerTable key={tabela.key} tabela={tabela} texts={dimensionamento.texts} />)}
      </TabsContent>
    </Tabs>
    </div>
  );
}

function gerarHtmlTabelaFitasLed(color: string, tabela: LedTapeTable, texts: LedPowerSourceTextOverrides) {
  const columns: Array<["source" | "voltage" | "power" | "recommended" | "maximum", string]> = [
    ["source", "Fonte"], ["voltage", "Tensão"], ["power", "Potência da fonte"],
    ["recommended", `Fita LED ${tabela.wattsPerMeter} W/m — recomendado (85%)`],
    ["maximum", `Fita LED ${tabela.wattsPerMeter} W/m — limite máximo (100%)`],
  ];
  const powerUnit = getLedText(texts, ledPowerSourceTextKey.common("powerUnit"), "W");
  const meterUnit = getLedText(texts, ledPowerSourceTextKey.common("meterUnit"), "m");
  const rows = tabela.rows.map((row, rowIndex) => `
    <tr>
      <td>${escapeHtml(getLedText(texts, ledPowerSourceTextKey.row(tabela.key, rowIndex, "source"), row.source))}</td>
      <td>${escapeHtml(getLedText(texts, ledPowerSourceTextKey.row(tabela.key, rowIndex, "voltage"), row.voltage))}</td>
      <td>${fmtNum(row.powerW)} ${escapeHtml(powerUnit)}</td>
      <td>${escapeHtml(formatarMetrosLed(row.recommendedMeters, tabela, meterUnit))}</td>
      <td>${escapeHtml(formatarMetrosLed(row.maximumMeters, tabela, meterUnit))}</td>
    </tr>`).join("");
  const subtitle = `Fita LED linear · consumo de ${tabela.wattsPerMeter} W por metro`;
  const title = getLedText(texts, ledPowerSourceTextKey.title(tabela.key), tabela.title);
  const subtitleText = getLedText(texts, ledPowerSourceTextKey.subtitle(tabela.key), subtitle);
  return `<div class="section-block"><div class="section-title">${escapeHtml(title)}</div><div style="display:inline-block;margin:4px 0 6px;padding:4px 9px;border:1px solid #bae6fd;border-radius:4px;background:#e0f2fe;color:#075985;font-weight:600">${escapeHtml(subtitleText)}</div>${gerarHtmlLinkImagemLed(tabela.key, texts)}<table><thead><tr style="background:${color}">${columns.map(([key, fallback]) => `<th>${escapeHtml(getLedText(texts, ledPowerSourceTextKey.column(tabela.key, key), fallback))}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function gerarHtmlTabelaModulosLed(color: string, tabela: LedModuleTable, texts: LedPowerSourceTextOverrides) {
  const columns: Array<["source" | "voltage" | "power" | "recommended" | "maximum", string]> = [
    ["source", "Fonte"], ["voltage", "Tensão"], ["power", "Potência da fonte"],
    ["recommended", "Recomendado para vendas (85%)"],
    ["maximum", "Limite máximo (100%)"],
  ];
  const powerUnit = getLedText(texts, ledPowerSourceTextKey.common("powerUnit"), "W");
  const moduleUnit = getLedText(texts, ledPowerSourceTextKey.common("moduleUnit"), "módulos");
  const recommendedPrefix = getLedText(texts, ledPowerSourceTextKey.common("moduleRecommendedPrefix"), "Até");
  const rows = tabela.rows.map((row, rowIndex) => `
    <tr>
      <td>${escapeHtml(getLedText(texts, ledPowerSourceTextKey.row(tabela.key, rowIndex, "source"), row.source))}</td>
      <td>${escapeHtml(getLedText(texts, ledPowerSourceTextKey.row(tabela.key, rowIndex, "voltage"), row.voltage))}</td>
      <td>${fmtNum(row.powerW)} ${escapeHtml(powerUnit)}</td>
      <td>${escapeHtml(recommendedPrefix)} ${fmtNum(row.recommendedModules)} ${escapeHtml(moduleUnit)}</td>
      <td>${fmtNum(row.maximumModules)} ${escapeHtml(moduleUnit)}</td>
    </tr>`).join("");
  const title = getLedText(texts, ledPowerSourceTextKey.title(tabela.key), tabela.title);
  const subtitle = getLedText(texts, ledPowerSourceTextKey.subtitle(tabela.key), tabela.subtitle);
  return `<div class="section-block"><div class="section-title">${escapeHtml(title)}</div><div style="display:inline-block;margin:4px 0 6px;padding:4px 9px;border:1px solid #ddd6fe;border-radius:4px;background:#ede9fe;color:#5b21b6;font-weight:600">${escapeHtml(subtitle)}</div>${gerarHtmlLinkImagemLed(tabela.key, texts)}<table><thead><tr style="background:${color}">${columns.map(([key, fallback]) => `<th>${escapeHtml(getLedText(texts, ledPowerSourceTextKey.column(tabela.key, key), fallback))}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function gerarHtmlDimensionamentoLed(color: string, dimensionamento: LedPowerSourceTables, texts: LedPowerSourceTextOverrides) {
  const fitas = dimensionamento.tapes.map(tabela => gerarHtmlTabelaFitasLed(color, tabela, texts)).join("");
  const modulos = dimensionamento.modules.map(tabela => gerarHtmlTabelaModulosLed(color, tabela, texts)).join("");
  const tapeHeading = getLedText(texts, ledPowerSourceTextKey.page("tapesHeading"), "Fitas de LED por metro linear (W/m)");
  const moduleHeading = getLedText(texts, ledPowerSourceTextKey.page("modulesHeading"), "Módulos de LED por unidade (peças)");
  return `<div class="section-block"><div class="section-title">${escapeHtml(tapeHeading)}</div>${fitas}</div><div class="section-block"><div class="section-title">${escapeHtml(moduleHeading)}</div>${modulos}</div>`;
}
function ListContent({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-700">
          <span className="text-blue-500 mt-0.5">•</span>
          <span>{renderPercentDecorated(item)}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionContent({ contentJson }: { contentJson: string }) {
  try {
    const data: ContentJson = JSON.parse(contentJson);
    if (data.type === "config")
      return <ConfigTable items={data.items as ConfigItem[]} />;
    if (data.type === "margin_table" || data.type === "margin_table_multi") {
      return (
        <MarginTable columns={data.columns ?? []} rows={data.rows ?? []} />
      );
    }
    if (data.type === "list")
      return <ListContent items={data.items as string[]} />;
    if (data.type === "rich_text" && data.html) {
      return (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: data.html }}
        />
      );
    }
  } catch {}
  return (
    <pre className="text-xs text-slate-600 whitespace-pre-wrap">
      {contentJson}
    </pre>
  );
}

// ─── Visual Editors ───────────────────────────────────────────────────────────

/** Editor visual para listas simples (type: "list") */
function ListEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const parsed = useMemo(() => {
    try {
      const d = JSON.parse(value);
      if (d.type === "list") return d.items as string[];
    } catch {}
    return [];
  }, [value]);

  function update(items: string[]) {
    onChange(JSON.stringify({ type: "list", items }));
  }

  return (
    <div className="space-y-2">
      {parsed.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="text-blue-400 text-sm">•</span>
          <input
            className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            value={item}
            onChange={e => {
              const arr = [...parsed];
              arr[i] = e.target.value;
              update(arr);
            }}
          />
          <button
            onClick={() => update(parsed.filter((_, j) => j !== i))}
            className="text-slate-300 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...parsed, ""])}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
      >
        <Plus size={12} /> Adicionar item
      </button>
    </div>
  );
}

/** Editor visual para tabelas de margem (type: "margin_table") */
function MarginTableEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const parsed = useMemo(() => {
    try {
      const d = JSON.parse(value);
      if (d.type === "margin_table" || d.type === "margin_table_multi")
        return d as ContentJson;
    } catch {}
    return null;
  }, [value]);

  if (!parsed) return null;

  const cols = parsed.columns ?? [];
  const rows = parsed.rows ?? [];

  function updateCell(rowIdx: number, colIdx: number, val: string) {
    const newRows = rows.map((r, ri) => {
      if (ri !== rowIdx) return r;
      const newVals = [...r.values];
      newVals[colIdx] = val;
      return { ...r, values: newVals };
    });
    onChange(JSON.stringify({ ...parsed, rows: newRows }));
  }

  function updateRowLabel(rowIdx: number, val: string) {
    const newRows = rows.map((r, ri) =>
      ri === rowIdx ? { ...r, label: val } : r
    );
    onChange(JSON.stringify({ ...parsed, rows: newRows }));
  }

  function updateColHeader(colIdx: number, val: string) {
    const newCols = cols.map((c, ci) => (ci === colIdx ? val : c));
    onChange(JSON.stringify({ ...parsed, columns: newCols }));
  }

  function addRow() {
    // id: 0 = sentinela "ainda não atribuído" — o servidor atribui o próximo
    // ID estável disponível ao salvar (ver server/integrations/priceTableIds.ts).
    const newRow: MarginRow = {
      id: 0,
      label: "Nova linha",
      values: cols.map(() => ""),
    };
    onChange(JSON.stringify({ ...parsed, rows: [...rows, newRow] }));
  }

  function removeRow(rowIdx: number) {
    onChange(
      JSON.stringify({ ...parsed, rows: rows.filter((_, i) => i !== rowIdx) })
    );
  }

  return (
    <div>
      <Table className="border-collapse">
        <TableHeader>
          <TableRow className="bg-slate-100">
            <TableHead className="border border-slate-200 w-20 text-center text-xs font-semibold">
              ID
            </TableHead>
            {rows.length > 1 && (
              <TableHead className="border border-slate-200 min-w-[140px]">
                <input
                  className="w-full text-xs font-semibold text-center bg-transparent outline-none focus:bg-white focus:border-blue-300 rounded px-1"
                  value={cols[0] ?? ""}
                  onChange={e => updateColHeader(0, e.target.value)}
                />
              </TableHead>
            )}
            {(rows.length > 1 ? cols.slice(1) : cols).map((col, ci) => (
              <TableHead key={ci} className="border border-slate-200">
                <input
                  className="w-full text-xs font-semibold text-center bg-transparent outline-none focus:bg-white focus:border-blue-300 rounded px-1"
                  value={col}
                  onChange={e =>
                    updateColHeader(
                      rows.length > 1 ? ci + 1 : ci,
                      e.target.value
                    )
                  }
                />
              </TableHead>
            ))}
            <TableHead className="w-8 border border-slate-200" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, ri) => (
            <TableRow
              key={ri}
              className={ri % 2 === 0 ? "bg-white" : "bg-slate-50"}
            >
              <TableCell className="text-center border border-slate-200">
                <IdBadge id={row.id} />
              </TableCell>
              {rows.length > 1 && (
                <TableCell className="border border-slate-200">
                  <input
                    className="w-full text-xs font-medium text-center text-slate-700 bg-transparent outline-none focus:bg-white focus:border-blue-300 rounded px-1"
                    value={row.label}
                    onChange={e => updateRowLabel(ri, e.target.value)}
                  />
                </TableCell>
              )}
              {row.values.map((val, vi) => (
                <TableCell key={vi} className="border border-slate-200">
                  <input
                    className="w-full text-xs text-center font-semibold text-blue-700 bg-transparent outline-none focus:bg-white focus:border-blue-300 rounded px-1"
                    value={val}
                    onChange={e => updateCell(ri, vi, e.target.value)}
                  />
                </TableCell>
              ))}
              <TableCell className="border border-slate-200 text-center">
                <button
                  onClick={() => removeRow(ri)}
                  className="text-slate-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <button
        onClick={addRow}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
      >
        <Plus size={12} /> Adicionar linha
      </button>
    </div>
  );
}

/** Editor visual para config items (type: "config") */
function ConfigEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const parsed = useMemo(() => {
    try {
      const d = JSON.parse(value);
      if (d.type === "config") return d.items as ConfigItem[];
    } catch {}
    return [];
  }, [value]);

  function update(items: ConfigItem[]) {
    onChange(JSON.stringify({ type: "config", items }));
  }

  return (
    <div className="space-y-2">
      {parsed.map((item, i) => (
        <div key={i} className="flex gap-2 items-center flex-wrap">
          <IdBadge id={item.id} />
          <input
            className="border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400 w-40"
            placeholder="Rótulo"
            value={item.label}
            onChange={e => {
              const arr = [...parsed];
              arr[i] = { ...arr[i], label: e.target.value };
              update(arr);
            }}
          />
          <input
            className="border border-slate-200 rounded px-2 py-1.5 text-sm font-bold outline-none focus:border-blue-400 w-28"
            placeholder="Valor"
            value={item.value}
            onChange={e => {
              const arr = [...parsed];
              arr[i] = { ...arr[i], value: e.target.value };
              update(arr);
            }}
          />
          <input
            className="border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-blue-400 flex-1 min-w-[120px]"
            placeholder="Observação (opcional)"
            value={item.note ?? ""}
            onChange={e => {
              const arr = [...parsed];
              arr[i] = { ...arr[i], note: e.target.value || undefined };
              update(arr);
            }}
          />
          <button
            onClick={() => update(parsed.filter((_, j) => j !== i))}
            className="text-slate-300 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...parsed, { id: 0, label: "", value: "" }])}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
      >
        <Plus size={12} /> Adicionar item
      </button>
    </div>
  );
}

/** Seleciona o editor visual correto baseado no tipo de conteúdo */
function SmartEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const type = useMemo(() => {
    try {
      return JSON.parse(value).type as string;
    } catch {
      return "unknown";
    }
  }, [value]);

  if (type === "list") return <ListEditor value={value} onChange={onChange} />;
  if (type === "margin_table" || type === "margin_table_multi")
    return <MarginTableEditor value={value} onChange={onChange} />;
  if (type === "config")
    return <ConfigEditor value={value} onChange={onChange} />;
  if (type === "rich_text") {
    const html = (() => {
      try {
        return JSON.parse(value).html ?? "";
      } catch {
        return "";
      }
    })();
    return (
      <RichTextEditor
        value={html}
        onChange={h => onChange(JSON.stringify({ type: "rich_text", html: h }))}
        minHeight="120px"
      />
    );
  }
  // Fallback: editor de texto livre
  return <RichTextEditor value={value} onChange={onChange} minHeight="120px" />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getLedText(texts: LedPowerSourceTextOverrides, key: string, fallback: string): string {
  return texts[key] ?? fallback;
}

function gerarHtmlLinkImagemLed(
  tableKey: LedTapeTable["key"] | LedModuleTable["key"],
  texts: LedPowerSourceTextOverrides,
): string {
  const imageUrl = getLedText(texts, ledPowerSourceTextKey.image(tableKey), "");
  if (!imageUrl) return "";
  return `<div style="margin:2px 0 6px 4px;font-size:10.5px"><a href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener noreferrer" style="color:#0369a1;font-weight:600;text-decoration:underline">Clique para ver a imagem</a></div>`;
}

function LedImageLink({
  tableKey,
  title,
  texts,
}: {
  tableKey: LedTapeTable["key"] | LedModuleTable["key"];
  title: string;
  texts: LedPowerSourceTextOverrides;
}) {
  const imageKey = ledPowerSourceTextKey.image(tableKey);
  const imageUrl = getLedText(texts, imageKey, "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();
  const saveImage = trpc.custoLed.saveDimensionamentoTexto.useMutation();

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error("A imagem precisa ter no máximo 16 MB.");
      return;
    }

    setUploading(true);
    try {
      let uploaded: Awaited<ReturnType<typeof enviarArquivo>>;
      try {
        uploaded = await enviarArquivo("imagem", file);
        if (!uploaded?.url) throw new Error("O serviço não retornou uma URL para a imagem.");
      } catch (error) {
        console.error("[Tabela de Preços] Falha no upload da imagem de LED:", error);
        const reason = error instanceof Error ? error.message : String(error);
        toast.error(`Falha ao enviar a imagem ao serviço de arquivos: ${reason}`, { duration: 10000 });
        return;
      }

      try {
        await saveImage.mutateAsync({ key: imageKey, value: uploaded.url });
      } catch (error) {
        console.error("[Tabela de Preços] Imagem enviada, mas falhou ao salvar a URL:", error);
        const reason = error instanceof Error ? error.message : String(error);
        toast.error(`A imagem foi enviada, mas não foi possível salvar o link: ${reason}`, { duration: 10000 });
        return;
      }

      void utils.custoLed.getDimensionamentoFontes.invalidate().catch(error => {
        console.error("[Tabela de Preços] Imagem salva, mas não foi possível atualizar a tabela:", error);
      });
      toast.success("Imagem do LED salva.");
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    try {
      await saveImage.mutateAsync({ key: imageKey, value: "" });
      await utils.custoLed.getDimensionamentoFontes.invalidate();
      toast.success("Imagem removida.");
    } catch {
      toast.error("Não foi possível remover a imagem.");
    }
  }

  return (
    <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs">
      {imageUrl && (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="inline-flex items-center gap-1 font-medium text-sky-700 hover:text-sky-900 hover:underline"
        >
          <ImageIcon className="h-3.5 w-3.5" /> Clique para ver a imagem
        </button>
      )}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1 text-slate-500 hover:text-sky-700 disabled:opacity-50"
      >
        <Upload className="h-3.5 w-3.5" />
        {uploading ? "Enviando imagem…" : imageUrl ? "Trocar imagem" : "Adicionar imagem do LED"}
      </button>
      {imageUrl && (
        <button
          type="button"
          onClick={removeImage}
          disabled={saveImage.isPending}
          className="text-slate-400 hover:text-red-600 disabled:opacity-50"
        >
          Remover
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Imagem — {title}</DialogTitle>
          </DialogHeader>
          {imageUrl && (
            <img
              src={imageUrl}
              alt={title}
              className="mx-auto max-h-[75vh] max-w-full rounded object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── EditableSection ─────────────────────────────────────────────────────────

function EditableSection({
  section,
  highlight,
  products = [],
  showProducts = false,
  canEditProducts = false,
  onEditProducts,
}: {
  section: Section;
  highlight?: string;
  products?: BlockAffiliation["produtos"];
  showProducts?: boolean;
  canEditProducts?: boolean;
  onEditProducts?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.sectionTitle);
  const [notes, setNotes] = useState(section.notes ?? "");
  const [contentJson, setContentJson] = useState(section.contentJson);

  const utils = trpc.useUtils();
  const updateMut = trpc.price.update.useMutation({
    onSuccess: () => {
      utils.price.list.invalidate();
      setEditing(false);
      toast.success("Seção atualizada!");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  function handleSave() {
    updateMut.mutate({
      id: section.id,
      sectionTitle: title,
      contentJson,
      notes: notes || null,
    });
  }

  function handleCancel() {
    setTitle(section.sectionTitle);
    setNotes(section.notes ?? "");
    setContentJson(section.contentJson);
    setEditing(false);
  }

  return (
    <Card
      className={`mb-4 border shadow-sm transition-all ${highlight ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          {editing ? (
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="font-semibold text-sm h-8"
            />
          ) : (
            <CardTitle className="text-sm font-semibold text-slate-800 leading-snug flex items-center gap-2 flex-wrap">
              {(() => {
                const isBrasil = section.sectionTitle.endsWith(
                  "\u2014 Clientes Brasil"
                );
                const isMs =
                  section.sectionTitle.endsWith("\u2014 Clientes MS");
                const baseTitle = section.sectionTitle
                  .replace(" \u2014 Clientes Brasil", "")
                  .replace(" \u2014 Clientes MS", "");
                const displayTitle = highlight ? (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: escapeHtml(baseTitle).replace(
                        new RegExp(
                          `(${escapeHtml(highlight).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
                          "gi"
                        ),
                        '<mark class="bg-yellow-200 text-yellow-900 rounded px-0.5">$1</mark>'
                      ),
                    }}
                  />
                ) : (
                  baseTitle
                );
                return (
                  <>
                    {displayTitle}
                    {isBrasil && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-2 py-0.5 h-5 border-green-500 text-green-700 bg-green-50 shrink-0 font-semibold"
                      >
                        🌎 Geral / Brasil
                      </Badge>
                    )}
                    {isMs && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-2 py-0.5 h-5 border-blue-600 text-blue-700 bg-blue-50 shrink-0 font-semibold"
                      >
                        📌 Mato Grosso do Sul
                      </Badge>
                    )}
                  </>
                );
              })()}
            </CardTitle>
          )}
          <div className="flex gap-1 shrink-0">
            {canEditProducts && onEditProducts && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onEditProducts}>
                <Link2 className="mr-1 h-3 w-3" />Produtos ({products.length})
              </Button>
            )}
            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-2 text-xs"
                  onClick={handleSave}
                  disabled={updateMut.isPending}
                >
                  <Save className="w-3 h-3 mr-1" /> Salvar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={handleCancel}
                >
                  <X className="w-3 h-3" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-slate-500 hover:text-blue-600"
                onClick={() => setEditing(true)}
              >
                <Pencil className="w-3 h-3 mr-1" /> Editar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {(showProducts || products.length > 0 || canEditProducts) && (
        <div className="border-t border-slate-100 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-slate-500">Produtos atendidos:</span>
            {products.length ? products.map(product => <Badge key={product.mubisysProdutoId} variant="secondary" className="text-[11px]">{product.nomeProduto}</Badge>) : <span className="text-xs text-slate-400">Nenhum produto vinculado</span>}
          </div>
        </div>
      )}
      <CardContent className="px-4 pb-4 space-y-3">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">
                Conteúdo
              </label>
              <SmartEditor value={contentJson} onChange={setContentJson} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Observações
              </label>
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder="Observações adicionais..."
                minHeight="80px"
              />
            </div>
          </div>
        ) : (
          <>
            <SectionContent contentJson={section.contentJson} />
            {section.notes && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                <Info className="w-3 h-3 inline mr-1" />
                <div
                  className="inline prose prose-xs max-w-none"
                  dangerouslySetInnerHTML={{ __html: section.notes }}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── SearchResults ─────────────────────────────────────────────────────────────

const PAGE_LABELS: Record<number, string> = {
  1: "Pág. 1 — Frontlight Galvanizado",
  2: "Pág. 2 — Inox / PVC / Acrílico",
  3: "Pág. 3 — Pintura",
  4: "Pág. 4 — Fontes Chaveadas",
  5: "Pág. 5 — Produtividades de solda",
  6: "Pág. 6 — Condições Comerciais",
};

function SearchResults({
  sections,
  query,
  affiliations,
  canEditProducts,
  onEditProducts,
}: {
  sections: Section[];
  query: string;
  affiliations: Map<number, BlockAffiliation>;
  canEditProducts: boolean;
  onEditProducts: (sectionId: number) => void;
}) {
  const q = query.toLowerCase();
  const matches = sections.filter(s => {
    if (s.sectionTitle.toLowerCase().includes(q)) return true;
    if (s.notes?.toLowerCase().includes(q)) return true;
    try {
      const text = JSON.stringify(JSON.parse(s.contentJson)).toLowerCase();
      return text.includes(q);
    } catch {
      return false;
    }
  });

  if (matches.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search />
          </EmptyMedia>
          <EmptyTitle>
            Nenhuma seção encontrada para "<strong>{query}</strong>".
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-4">
        <strong>{matches.length}</strong> seção
        {matches.length !== 1 ? "ões" : ""} encontrada
        {matches.length !== 1 ? "s" : ""} para "<strong>{query}</strong>"
      </p>
      {matches.map(section => (
        <div key={section.id}>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="text-xs text-blue-600 border-blue-200"
            >
              {PAGE_LABELS[section.page] ?? `Pág. ${section.page}`}
            </Badge>
          </div>
          <EditableSection section={section} highlight={query} products={affiliations.get(section.id)?.produtos ?? []} showProducts={affiliations.has(section.id)} canEditProducts={canEditProducts && section.page >= 1 && section.page <= 3 && affiliations.has(section.id)} onEditProducts={() => onEditProducts(section.id)} />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

// ─── Gerador de PDF enxuto ───────────────────────────────────────────────────
type MateriaPrimaProdutividade = RouterOutputs["produtos"]["materiasPrimas"]["listar"][number];

function gerarPdfTabela(
  sections: Section[],
  meta: { versao: string; dataModificacao: Date | string } | null,
  dimensionamentoLed: LedPowerSourceTables,
  ledTexts: LedPowerSourceTextOverrides,
  titulo = "Tabela de Preços",
  produtividadesSolda?: MateriaPrimaProdutividade[]
) {
  const dataStr = meta?.dataModificacao
    ? new Date(meta.dataModificacao).toLocaleDateString("pt-BR")
    : new Date().toLocaleDateString("pt-BR");
  const versao = meta?.versao ?? "001";
  // Detectar se é Tabela Novo Cliente (páginas 11-13) ou Principal (páginas 1-3)
  const isNovoCliente = sections.some(s => s.page >= 11);
  const pageOffset = isNovoCliente ? 10 : 0; // 11 → 1, 12 → 2, 13 → 3
  const pageNames: Record<number, string> = {
    1: "Frontlight / Galvanizado",
    2: "Inox / PVC / Acrílico",
    3: "Pintura",
    4: getLedText(ledTexts, ledPowerSourceTextKey.page("pdfTitle"), "Fontes Chaveadas"),
    5: "Produtividades de solda",
    6: "Condições Comerciais",
  };
  const pageIcons: Record<number, string> = {
    1: "&#x1F4A1;",
    2: "&#x2728;",
    3: "&#x1F3A8;",
    4: "&#x1F50C;",
    5: "&#x1F527;",
    6: "&#x1F4C4;",
  };
  const pageSubtitles: Record<number, string> = {
    1: "Letreiros iluminados e estruturas galvanizadas",
    2: "Inox escovado, PVC e acrílico",
    3: "Acabamentos e pintura especial",
    4: getLedText(ledTexts, ledPowerSourceTextKey.page("pdfSubtitle"), "Fontes chaveadas e capacidade de módulos LED"),
    5: "Custos atuais do catálogo MubiSys, por aplicação e classificação",
    6: "Condições comerciais",
  };
  const pageColors: Record<number, string> = {
    1: "#1e40af",
    2: "#0f766e",
    3: "#7c3aed",
    4: "#c2410c",
    5: "#b45309",
    6: "#475569",
  };

  // Helper para extrair label de identificação do título
  function getSectionLabel(title: string): {
    base: string;
    badge: string;
    badgeColor: string;
    badgeBg: string;
  } {
    if (title.endsWith("\u2014 Clientes Brasil")) {
      return {
        base: title.replace(" \u2014 Clientes Brasil", ""),
        badge: "\uD83C\uDF0E Geral / Brasil",
        badgeColor: "#166534",
        badgeBg: "#dcfce7",
      };
    }
    if (title.endsWith("\u2014 Clientes MS")) {
      return {
        base: title.replace(" \u2014 Clientes MS", ""),
        badge: "\uD83D\uDCCC Mato Grosso do Sul",
        badgeColor: "#1e40af",
        badgeBg: "#dbeafe",
      };
    }
    return { base: title, badge: "", badgeColor: "", badgeBg: "" };
  }

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo} v${versao}</title>
<style>
  @page{size:A3 landscape;margin:10mm 12mm}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;line-height:1.3;color:#1e293b;background:#fff}
  /* ─── CABEÇALHO DO DOCUMENTO (compacto, não ocupa página própria) ─── */
  .doc-header{background:linear-gradient(135deg,#0f172a,#1e40af);color:#fff;border-radius:6px;padding:7px 14px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
  .doc-header-title{font-size:15px;font-weight:800;letter-spacing:-0.2px}
  .doc-header-title span{color:#93c5fd;font-weight:800}
  .doc-header-sub{font-size:10px;opacity:0.75;font-weight:400;margin-left:6px}
  .doc-header-meta{display:flex;gap:6px;align-items:center;font-size:10px;opacity:0.9;flex-wrap:wrap}
  .doc-header-badge{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:12px;padding:2px 9px;font-weight:700;white-space:nowrap}
  /* ─── SEÇÕES ─── */
  .page-section{margin:0}
  .page-header{padding:4px 0;display:flex;align-items:baseline;gap:8px;border-bottom:2px solid;margin:6px 0 5px}
  .page-header-icon{width:19px;height:19px;border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px}
  .page-header-title{font-size:13.5px;font-weight:700;line-height:1.2}
  .page-header-sub{font-size:9.5px;opacity:0.65;font-weight:400}
  .section-block{margin:0 0 6px;padding-top:1px}
  .section-title{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:3px;padding-bottom:2px;border-bottom:1px solid #e2e8f0;color:#475569;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .section-title::before{content:'';display:inline-block;width:3px;height:11px;border-radius:2px;background:currentColor;opacity:0.5;flex-shrink:0}
  .section-badge{display:inline-flex;align-items:center;padding:1px 7px;border-radius:16px;font-size:8.5px;font-weight:700;letter-spacing:0.2px;border:1px solid;margin-left:2px}
  /* ─── TABELAS ─── */
  table{width:100%;border-collapse:separate;border-spacing:0;border-radius:5px;overflow:hidden;font-size:10.5px;box-shadow:0 1px 2px rgba(0,0,0,0.07)}
  thead tr{color:#fff}
  thead th{padding:3px 7px;text-align:center;font-weight:700;font-size:9.5px;letter-spacing:0.2px}
  thead th:first-child{text-align:left;border-radius:5px 0 0 0}
  thead th:last-child{border-radius:0 5px 0 0}
  tbody td{padding:2.5px 7px;text-align:center;border-bottom:1px solid #f1f5f9;font-size:10.5px}
  tbody td:first-child{text-align:left;font-weight:600;color:#1e3a5f}
  tbody tr:last-child td{border-bottom:none}
  tbody tr:last-child td:first-child{border-radius:0 0 0 5px}
  tbody tr:last-child td:last-child{border-radius:0 0 5px 0}
  tbody tr:nth-child(even) td{background:#f8fafc}
  tbody td .val{font-weight:700;color:#0f4c81;font-size:11px}
  /* ─── CONFIG GRID ─── */
  .config-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px}
  .config-item{display:flex;justify-content:space-between;align-items:center;padding:3px 8px;background:#f8fafc;border-radius:5px;border-left:3px solid #3b82f6}
  .config-label{color:#64748b;font-size:9.5px;font-weight:500}
  .config-value{font-weight:800;color:#1e3a5f;font-size:11.5px}
  /* ─── LISTA ─── */
  .list-items{padding-left:0;list-style:none}
  .list-items li{padding:2px 0 2px 14px;position:relative;color:#374151;border-bottom:1px solid #f1f5f9;font-size:10.5px}
  .list-items li:before{content:"›";position:absolute;left:2px;color:#3b82f6;font-weight:700;font-size:12px;line-height:1.2}
  /* ─── NOTA ─── */
  .note-box{margin-top:3px;padding:3px 8px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border-left:3px solid #f59e0b;border-radius:0 5px 5px 0;font-size:9.5px;color:#78350f;display:flex;gap:6px;align-items:flex-start}
  .note-icon{flex-shrink:0;font-size:11px}
  /* ─── RODAPÉ ─── */
  .footer{margin-top:6px;padding:4px 0;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:8.5px;color:#94a3b8}
  .footer-brand{font-weight:700;color:#64748b;font-size:9.5px}
  @media print{
    html,body{width:100%;background:#fff}
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:12px;line-height:1.35}
    .doc-header{break-inside:avoid;page-break-inside:avoid;padding:9px 16px;margin-bottom:10px}
    .doc-header-title{font-size:17px}
    .doc-header-sub,.doc-header-meta{font-size:11px}
    .page-section{break-inside:auto;page-break-inside:auto}
    .page-section+.page-section{break-before:page;page-break-before:always}
    .page-header{break-after:avoid-page;page-break-after:avoid;margin:10px 0 8px;padding:6px 0}
    .page-header-title{font-size:16px}
    .page-header-sub{font-size:11px}
    .section-block{break-inside:auto;page-break-inside:auto;margin-bottom:10px}
    .section-title{break-after:avoid-page;page-break-after:avoid;font-size:12.5px;margin-bottom:5px;padding-bottom:3px}
    .section-badge{font-size:10px;padding:2px 8px}
    table{width:100%;font-size:12.5px;box-shadow:none;break-inside:auto;page-break-inside:auto}
    thead{display:table-header-group}
    thead th{font-size:11.5px;padding:6px 9px}
    tbody tr{break-inside:avoid;page-break-inside:avoid}
    tbody td{font-size:12.5px;line-height:1.3;padding:5px 9px}
    tbody td .val{font-size:13px}
    .config-grid{grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:7px}
    .config-item{break-inside:avoid;padding:5px 10px}
    .config-label{font-size:11px}
    .config-value{font-size:12.5px}
    .list-items li{font-size:12.5px;padding:4px 0 4px 16px;break-inside:avoid}
    .note-box{font-size:11px;margin-top:5px;padding:6px 10px;break-inside:avoid}
    .footer{font-size:10px;margin-top:10px;padding:6px 0}
    .footer-brand{font-size:10.5px}
  }
</style></head><body>
<div class="doc-header">
  <div class="doc-header-title">LETREIROS <span>EXPRESS</span><span class="doc-header-sub">${titulo} &mdash; Uso Interno</span></div>
  <div class="doc-header-meta">
    <span class="doc-header-badge">Versão ${versao}</span>
    <span>Modificado em ${dataStr}</span>
    <span>&bull;</span>
    <span>Emitido em ${new Date().toLocaleDateString("pt-BR")}</span>
  </div>
</div>`;

  const byPage: Record<number, Section[]> = {};
  sections.forEach(s => {
    const normalizedPage = s.page > 10 ? s.page - pageOffset : s.page === 5 && !isNovoCliente ? 6 : s.page;
    if (!byPage[normalizedPage]) byPage[normalizedPage] = [];
    byPage[normalizedPage].push(s);
  });

  const pagesToRender = produtividadesSolda ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4];
  for (const page of pagesToRender) {
    const pageSections = page === 4 || page === 5 ? [] : (byPage[page] ?? []).sort(
      (a, b) => a.sectionOrder - b.sectionOrder
    );
    if (!pageSections.length && page !== 4 && page !== 5) continue;
    const color = pageColors[page] ?? "#1e3a5f";
    html += `<div class="page-section">
      <div class="page-header" style="border-color:${color}">
        <div class="page-header-icon" style="background:${color}18;color:${color}">${pageIcons[page] ?? "&#x1F4C4;"}</div>
        <div class="page-header-title" style="color:${color}">${pageNames[page] ?? "Página " + page}<span class="page-header-sub"> — ${pageSubtitles[page] ?? ""}</span></div>
      </div>`;
    if (page === 4) {
      html += gerarHtmlDimensionamentoLed(color, dimensionamentoLed, ledTexts);
    } else if (page === 5) {
      const escaparHtml = (texto: string) =>
        texto
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      const itensSolda = (produtividadesSolda ?? []).filter(
        item => item.ehProdutividade
      );
      if (itensSolda.length === 0) {
        html += `<p>Nenhuma produtividade de solda encontrada no catálogo MubiSys.</p>`;
      } else {
        html += `<table><thead><tr style="background:${color}"><th>Matéria-prima MubiSys</th><th>Aplicável a</th><th>Tipo de solda</th><th>Tamanho</th><th>Estilo</th><th>Unidade</th><th>Custo MubiSys</th></tr></thead><tbody>`;
        itensSolda.forEach(item => {
          const materiais = item.produtividadeMateriais.map(material => ROTULO_MATERIAL_SOLDA[material]).join(", ") || "Sem material";
          const tipos = item.produtividadeTiposSolda.map(tipo => ROTULO_TIPO_SOLDA[tipo]).join(", ") || "Sem tipo";
          const tamanho = item.produtividadeTamanhos.map(valor => ROTULO_TAMANHO_PRODUTIVIDADE[valor]).join(", ") || "Sem tamanho";
          const estilo = rotulosEstiloProdutividade(estiloDaMateria(item)).join(", ") || "—";
          html += `<tr><td>${escaparHtml(item.nome)}<br><small>Código MubiSys #${item.id}</small></td><td>${escaparHtml(materiais)}</td><td>${escaparHtml(tipos)}</td><td>${escaparHtml(tamanho)}</td><td>${escaparHtml(estilo)}</td><td>${escaparHtml(item.unidadeCusto || "—")}</td><td><span class="val">${fmtBrl(item.valorCusto)}</span></td></tr>`;
        });
        html += `</tbody></table>`;
      }
    } else for (const sec of pageSections) {
      const lbl = getSectionLabel(sec.sectionTitle);
      const badgeHtml = lbl.badge
        ? ` <span class="section-badge" style="color:${lbl.badgeColor};background:${lbl.badgeBg};border-color:${lbl.badgeColor}">${lbl.badge}</span>`
        : "";
      html += `<div class="section-block"><div class="section-title">${lbl.base}${badgeHtml}</div>`;
      try {
        const c = JSON.parse(sec.contentJson) as ContentJson;
        if (c.type === "margin_table" || c.type === "margin_table_multi") {
          const hasMultiRows = (c.rows ?? []).length > 1;
          html += `<table><thead><tr style="background:${color}">`;
          if (hasMultiRows)
            html += `<th style="text-align:left">${(c.columns ?? [])[0] ?? ""}</th>`;
          (hasMultiRows
            ? (c.columns ?? []).slice(1)
            : (c.columns ?? [])
          ).forEach(col => {
            html += `<th>${col}</th>`;
          });
          html += `</tr></thead><tbody>`;
          (c.rows ?? []).forEach((row, ri) => {
            const rowBg = ri % 2 === 0 ? "" : ' style="background:#f8fafc"';
            html += `<tr${rowBg}>`;
            if (hasMultiRows)
              html += `<td style="text-align:left;font-weight:600;color:#1e3a5f">${row.label}</td>`;
            row.values.forEach(v => {
              html += `<td><span class="val">${v}</span></td>`;
            });
            html += `</tr>`;
          });
          html += `</tbody></table>`;
        } else if (c.type === "config") {
          html += `<div class="config-grid">`;
          ((c.items as ConfigItem[]) ?? []).forEach(item => {
            html += `<div class="config-item"><span class="config-label">${item.label}</span><span class="config-value">${item.value}</span></div>`;
          });
          html += `</div>`;
        } else if (c.type === "list") {
          html += `<ul class="list-items">`;
          ((c.items as string[]) ?? []).forEach(item => {
            html += `<li>${item}</li>`;
          });
          html += `</ul>`;
        }
      } catch {
        /* ignorar */
      }
      if (sec.notes)
        html += `<div class="note-box"><span class="note-icon">⚠️</span><span>${sec.notes}</span></div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  html += `<div class="footer"><span class="footer-brand">Letreiros Express</span><span>Uso interno &mdash; confidencial</span><span>${titulo} v${versao} &mdash; ${dataStr}</span></div></body></html>`;
  // Download direto como arquivo HTML (abre no browser e permite Ctrl+P para PDF)
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const nomeArquivo = titulo.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  a.download = `${nomeArquivo}_v${versao}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const TIPOS_SOLDA_FILTRO: { value: TipoSolda | "todos"; label: string }[] = [
  { value: "todos", label: "Todos os tipos" },
  { value: "barra_roscada", label: ROTULO_TIPO_SOLDA.barra_roscada },
  { value: "patinha_led", label: ROTULO_TIPO_SOLDA.patinha_led },
  {
    value: "chapinha_dupla_face",
    label: ROTULO_TIPO_SOLDA.chapinha_dupla_face,
  },
  { value: "orelhinha", label: ROTULO_TIPO_SOLDA.orelhinha },
  { value: "sem_fixacao", label: ROTULO_TIPO_SOLDA.sem_fixacao },
];

const TAMANHOS_SOLDA_FILTRO: {
  value: TamanhoProdutividade | "todos";
  label: string;
}[] = [
  { value: "todos", label: "Todos os tamanhos" },
  { value: "ate_11cm", label: ROTULO_TAMANHO_PRODUTIVIDADE.ate_11cm },
  { value: "acima_11cm", label: ROTULO_TAMANHO_PRODUTIVIDADE.acima_11cm },
];

/** Estilo (categoria, aro, formato e fundo) de uma matéria-prima de produtividade vinda da listagem. */
function estiloDaMateria(material: Pick<MateriaPrimaProdutividade, "produtividadeCategorias" | "produtividadeAros" | "produtividadeFormatos" | "produtividadeFundos">): EstiloProdutividade {
  return {
    categorias: material.produtividadeCategorias,
    aros: material.produtividadeAros,
    formatos: material.produtividadeFormatos,
    fundos: material.produtividadeFundos,
  };
}

const temEstilo = (material: Parameters<typeof estiloDaMateria>[0]) => rotulosEstiloProdutividade(estiloDaMateria(material)).length > 0;

/** Uma linha de filtro por botões ("Todos" + as opções, cada uma com a contagem de itens). */
function LinhaFiltroChips<T extends string>({
  rotulo,
  rotuloTodos,
  total,
  opcoes,
  ativo,
  aoEscolher,
  contar,
}: {
  rotulo: string;
  rotuloTodos: string;
  total: number;
  opcoes: { value: T; label: string }[];
  ativo: T | "todos";
  aoEscolher: (valor: T | "todos") => void;
  contar: (valor: T) => number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 text-xs font-semibold uppercase tracking-wide text-slate-500">{rotulo}</span>
      <Button size="sm" variant={ativo === "todos" ? "secondary" : "ghost"} onClick={() => aoEscolher("todos")}>
        {rotuloTodos} ({total})
      </Button>
      {opcoes.map(opcao => (
        <Button
          key={opcao.value}
          size="sm"
          variant={ativo === opcao.value ? "secondary" : "ghost"}
          onClick={() => aoEscolher(opcao.value)}
        >
          {opcao.label} ({contar(opcao.value)})
        </Button>
      ))}
    </div>
  );
}

function ProdutividadesSolda() {
  const [busca, setBusca] = useState("");
  const [materialEditando, setMaterialEditando] =
    useState<MateriaPrimaProdutividade | null>(null);
  const [materiaisEditados, setMateriaisEditados] = useState<MaterialSolda[]>([]);
  const [tiposEditados, setTiposEditados] = useState<TipoSolda[]>([]);
  const [tamanhosEditados, setTamanhosEditados] = useState<TamanhoProdutividade[]>([]);
  const [estiloEditado, setEstiloEditado] = useState<EstiloProdutividade>(ESTILO_PRODUTIVIDADE_VAZIO);
  const { user } = useAuth();
  const podeEditarClassificação =
    user != null && ["gestor", "admin", "master"].includes(user.role ?? "");
  const utils = trpc.useUtils();
  const salvarClassificação =
    trpc.produtos.materiasPrimas.produtividadeClassificacaoSalvar.useMutation({
      onSuccess: () => {
        void utils.produtos.materiasPrimas.listar.invalidate();
        setMaterialEditando(null);
        toast.success("Classificação da produtividade atualizada.");
      },
      onError: error => toast.error(error.message),
    });
  const [materialAtivo, setMaterialAtivo] = useState<
    MaterialSolda | "todos" | "sem_material"
  >("todos");
  const [tipoAtivo, setTipoAtivo] = useState<TipoSolda | "todos">("todos");
  const [tamanhoAtivo, setTamanhoAtivo] = useState<
    TamanhoProdutividade | "todos"
  >("todos");
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaProdutividade | "todos">("todos");
  const [aroAtivo, setAroAtivo] = useState<AroFrontlight | "todos">("todos");
  const [formatoAtivo, setFormatoAtivo] = useState<FormatoProdutividade | "todos">("todos");
  const [fundoAtivo, setFundoAtivo] = useState<FundoProdutividade | "todos">("todos");
  const {
    data: catalogo,
    isLoading,
    isFetching,
    error,
    refetch,
  } = trpc.produtos.materiasPrimas.listar.useQuery(undefined, {
    staleTime: 60_000,
  });

  const produtividades = useMemo(
    () => (catalogo ?? []).filter(material => material.ehProdutividade),
    [catalogo]
  );
  const incompletas = useMemo(
    () =>
      produtividades.filter(
        material =>
          material.produtividadeTiposSolda.length === 0 ||
          material.produtividadeTamanhos.length === 0 ||
          material.produtividadeMateriais.length === 0
      ).length,
    [produtividades]
  );
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return produtividades.filter(material => {
      const correspondeBusca =
        !termo ||
        `${material.nome} ${material.id} ${material.categoriaMubiSys ?? ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(termo);
      const correspondeMaterial =
        materialAtivo === "todos" ||
        (materialAtivo === "sem_material"
          ? material.produtividadeMateriais.length === 0
          : material.produtividadeMateriais.includes(materialAtivo));
      const correspondeTipo =
        tipoAtivo === "todos" ||
        material.produtividadeTiposSolda.includes(tipoAtivo);
      const correspondeTamanho =
        tamanhoAtivo === "todos" ||
        material.produtividadeTamanhos.includes(tamanhoAtivo);
      const correspondeCategoria =
        categoriaAtiva === "todos" ||
        material.produtividadeCategorias.includes(categoriaAtiva);
      // O aro é uma subcategoria do Frontlight: só filtra quando o Frontlight está escolhido.
      const correspondeAro =
        categoriaAtiva !== "frontlight" ||
        aroAtivo === "todos" ||
        material.produtividadeAros.includes(aroAtivo);
      const correspondeFormato =
        formatoAtivo === "todos" ||
        material.produtividadeFormatos.includes(formatoAtivo);
      const correspondeFundo =
        fundoAtivo === "todos" ||
        material.produtividadeFundos.includes(fundoAtivo);
      return (
        correspondeBusca &&
        correspondeMaterial &&
        correspondeTipo &&
        correspondeTamanho &&
        correspondeCategoria &&
        correspondeAro &&
        correspondeFormato &&
        correspondeFundo
      );
    });
  }, [
    aroAtivo,
    busca,
    categoriaAtiva,
    formatoAtivo,
    fundoAtivo,
    materialAtivo,
    produtividades,
    tamanhoAtivo,
    tipoAtivo,
  ]);

  const escolherCategoria = (valor: CategoriaProdutividade | "todos") => {
    setCategoriaAtiva(valor);
    if (valor !== "frontlight") setAroAtivo("todos");
  };

  const quantidadePorMaterial = (material: MaterialSolda | "sem_material") =>
    material === "sem_material"
      ? produtividades.filter(item => item.produtividadeMateriais.length === 0)
          .length
      : produtividades.filter(item =>
          item.produtividadeMateriais.includes(material)
        ).length;

  const abrirEdição = (material: MateriaPrimaProdutividade) => {
    setMaterialEditando(material);
    setMateriaisEditados([...material.produtividadeMateriais]);
    setTiposEditados([...material.produtividadeTiposSolda]);
    setTamanhosEditados([...material.produtividadeTamanhos]);
    setEstiloEditado(estiloDaMateria(material));
  };

  const confirmarEdição = () => {
    if (!materialEditando) return;
    salvarClassificação.mutate({
      mubisysMateriaPrimaId: materialEditando.id,
      produtividadeMateriais: materiaisEditados,
      produtividadeTiposSolda: tiposEditados,
      produtividadeTamanhos: tamanhosEditados,
      produtividadeCategorias: estiloEditado.categorias,
      produtividadeAros: estiloEditado.aros,
      produtividadeFormatos: estiloEditado.formatos,
      produtividadeFundos: estiloEditado.fundos,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Hammer className="h-6 w-6 text-amber-700" />
            <h1 className="text-2xl font-bold text-slate-900">
              Produtividades de solda
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Valores atuais e cadastro de matérias-primas do MubiSys, organizados
            pela classificação de solda.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
          Atualizar MubiSys
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        <span>
          <strong>{produtividades.length}</strong> produtividade(s) de solda no
          catálogo.
        </span>
        {incompletas > 0 && (
          <Badge
            variant="outline"
            className="border-amber-400 bg-white text-amber-800"
          >
            {incompletas} aguardando classificação completa
          </Badge>
        )}
        <span className="text-xs text-amber-800">
          Classifique em Produtos → Matérias-primas; os nomes e valores são
          lidos do MubiSys.
        </span>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-3 rounded-md border bg-slate-50 p-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Search
                className="h-5 w-5 shrink-0 text-blue-600"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="produtividade-solda-busca"
                  className="mb-1 block text-sm font-semibold text-slate-700"
                >
                  Buscar produtividade de solda
                </label>
                <Input
                  id="produtividade-solda-busca"
                  placeholder="Digite o nome, código ou categoria MubiSys..."
                  value={busca}
                  onChange={event => setBusca(event.target.value)}
                  className="bg-white"
                />
              </div>
            </div>
            <span className="shrink-0 text-sm text-muted-foreground">
              {filtradas.length} de {produtividades.length} item(ns)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Material
            </span>
            <Button
              size="sm"
              variant={materialAtivo === "todos" ? "default" : "outline"}
              onClick={() => setMaterialAtivo("todos")}
            >
              Todos ({produtividades.length})
            </Button>
            {MATERIAIS_SOLDA.map(material => (
              <Button
                key={material}
                size="sm"
                variant={materialAtivo === material ? "default" : "outline"}
                onClick={() => setMaterialAtivo(material)}
              >
                {ROTULO_MATERIAL_SOLDA[material]} (
                {quantidadePorMaterial(material)})
              </Button>
            ))}
            <Button
              size="sm"
              variant={materialAtivo === "sem_material" ? "default" : "outline"}
              onClick={() => setMaterialAtivo("sem_material")}
            >
              Sem material ({quantidadePorMaterial("sem_material")})
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tipo de solda
            </span>
            {TIPOS_SOLDA_FILTRO.map(filtro => (
              <Button
                key={filtro.value}
                size="sm"
                variant={tipoAtivo === filtro.value ? "secondary" : "ghost"}
                onClick={() => setTipoAtivo(filtro.value)}
              >
                {filtro.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tamanho
            </span>
            {TAMANHOS_SOLDA_FILTRO.map(filtro => (
              <Button
                key={filtro.value}
                size="sm"
                variant={tamanhoAtivo === filtro.value ? "secondary" : "ghost"}
                onClick={() => setTamanhoAtivo(filtro.value)}
              >
                {filtro.label}
              </Button>
            ))}
          </div>
          <LinhaFiltroChips
            rotulo="Categoria"
            rotuloTodos="Todas"
            total={produtividades.length}
            opcoes={CATEGORIAS_PRODUTIVIDADE.map(value => ({ value, label: ROTULO_CATEGORIA_PRODUTIVIDADE[value] }))}
            ativo={categoriaAtiva}
            aoEscolher={escolherCategoria}
            contar={categoria => produtividades.filter(item => item.produtividadeCategorias.includes(categoria)).length}
          />
          {categoriaAtiva === "frontlight" && (
            <LinhaFiltroChips
              rotulo="Frontlight"
              rotuloTodos="Todos os aros"
              total={produtividades.filter(item => item.produtividadeCategorias.includes("frontlight")).length}
              opcoes={AROS_FRONTLIGHT.map(value => ({ value, label: ROTULO_ARO_FRONTLIGHT[value] }))}
              ativo={aroAtivo}
              aoEscolher={setAroAtivo}
              contar={aro =>
                produtividades.filter(item => item.produtividadeCategorias.includes("frontlight") && item.produtividadeAros.includes(aro)).length
              }
            />
          )}
          <LinhaFiltroChips
            rotulo="Formato"
            rotuloTodos="Todos"
            total={produtividades.length}
            opcoes={FORMATOS_PRODUTIVIDADE.map(value => ({ value, label: ROTULO_FORMATO_PRODUTIVIDADE[value] }))}
            ativo={formatoAtivo}
            aoEscolher={setFormatoAtivo}
            contar={formato => produtividades.filter(item => item.produtividadeFormatos.includes(formato)).length}
          />
          <LinhaFiltroChips
            rotulo="Fundo"
            rotuloTodos="Todos"
            total={produtividades.length}
            opcoes={FUNDOS_PRODUTIVIDADE.map(value => ({ value, label: ROTULO_FUNDO_PRODUTIVIDADE[value] }))}
            ativo={fundoAtivo}
            aoEscolher={setFundoAtivo}
            contar={fundo => produtividades.filter(item => item.produtividadeFundos.includes(fundo)).length}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(item => (
            <div
              key={item}
              className="h-14 animate-pulse rounded-lg bg-slate-100"
            />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-medium text-rose-700">
                Não foi possível carregar as matérias-primas do MubiSys.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error.message}
              </p>
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : filtradas.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Hammer />
            </EmptyMedia>
            <EmptyTitle>
              {produtividades.length === 0
                ? "Nenhuma produtividade de solda no catálogo"
                : "Nenhum item corresponde aos filtros"}
            </EmptyTitle>
            <EmptyDescription>
              {produtividades.length === 0
                ? "O catálogo do MubiSys não retornou matérias-primas com o nome Produtividade."
                : "Altere os filtros ou limpe a busca para ver outros itens."}
            </EmptyDescription>
          </EmptyHeader>
          {busca && (
            <EmptyContent>
              <Button variant="outline" onClick={() => setBusca("")}>
                Limpar busca
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table className="table-fixed text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="h-auto w-[25%] whitespace-normal px-2 py-2 text-xs leading-tight">
                  Matéria-prima MubiSys
                </TableHead>
                <TableHead className="h-auto w-[12%] whitespace-normal px-1.5 py-2 text-xs leading-tight">
                  Aplicável a
                </TableHead>
                <TableHead className="h-auto w-[13%] whitespace-normal px-1.5 py-2 text-xs leading-tight">
                  Tipo de solda
                </TableHead>
                <TableHead className="h-auto w-[10%] whitespace-normal px-1.5 py-2 text-xs leading-tight">
                  Tamanho
                </TableHead>
                <TableHead className="h-auto w-[16%] whitespace-normal px-1.5 py-2 text-xs leading-tight">
                  Estilo
                </TableHead>
                <TableHead className="h-auto w-[7%] whitespace-normal px-1.5 py-2 text-xs leading-tight">
                  Unidade
                </TableHead>
                <TableHead className="h-auto w-[10%] whitespace-normal px-1.5 py-2 text-right text-xs leading-tight">
                  Custo MubiSys
                </TableHead>
                <TableHead className="h-auto w-[7%] px-1 py-2 text-center text-xs leading-tight">
                  Editar
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map(material => (
                <TableRow key={material.id}>
                  <TableCell className="max-w-0 whitespace-normal break-words px-2 py-1.5 text-xs leading-snug">
                    <div className="break-words [overflow-wrap:anywhere] font-medium">
                      {material.nome}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                      Código MubiSys #{material.id}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-0 whitespace-normal px-1.5 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {material.produtividadeMateriais.length ? (
                        material.produtividadeMateriais.map(aplicável => (
                          <Badge
                            key={aplicável}
                            variant="outline"
                            className="px-1.5 py-0 text-[10px] leading-4"
                          >
                            {ROTULO_MATERIAL_SOLDA[aplicável]}
                          </Badge>
                        ))
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-400 px-1.5 py-0 text-[10px] leading-4 text-amber-800"
                        >
                          Sem material
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-0 whitespace-normal px-1.5 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {material.produtividadeTiposSolda.length ? (
                        material.produtividadeTiposSolda.map(tipo => (
                          <Badge
                            key={tipo}
                            variant="secondary"
                            className="px-1.5 py-0 text-[10px] leading-4"
                          >
                            {ROTULO_TIPO_SOLDA[tipo]}
                          </Badge>
                        ))
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-400 px-1.5 py-0 text-[10px] leading-4 text-amber-800"
                        >
                          Sem tipo
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-0 whitespace-normal break-words px-1.5 py-1.5 text-xs leading-tight">
                    {material.produtividadeTamanhos.length ? (
                      material.produtividadeTamanhos
                        .map(valor => ROTULO_TAMANHO_PRODUTIVIDADE[valor])
                        .join(" · ")
                    ) : (
                      <span className="text-amber-700">Sem tamanho</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-0 whitespace-normal px-1.5 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {rotulosEstiloProdutividade(estiloDaMateria(material)).map(rotulo => (
                        <Badge
                          key={rotulo}
                          variant="outline"
                          className="px-1.5 py-0 text-[10px] leading-4"
                        >
                          {rotulo}
                        </Badge>
                      ))}
                      {!temEstilo(material) && (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-0 whitespace-normal break-words px-1.5 py-1.5 text-xs leading-tight">
                    {material.unidadeCusto || "—"}
                  </TableCell>
                  <TableCell className="whitespace-normal px-1.5 py-1.5 text-right text-xs font-semibold leading-tight">
                    {fmtBrl(material.valorCusto)}
                  </TableCell>
                  <TableCell className="px-1 py-1 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={podeEditarClassificação ? "Editar classificação" : "Edição disponível para gestor, admin e master"}
                      aria-label={`Editar classificação de ${material.nome}`}
                      disabled={!podeEditarClassificação}
                      onClick={() => abrirEdição(material)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <Dialog
        open={materialEditando != null}
        onOpenChange={open => {
          if (!open && !salvarClassificação.isPending) setMaterialEditando(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar classificação da produtividade</DialogTitle>
          </DialogHeader>
          {materialEditando && (
            <div className="space-y-5">
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <strong>Sele&ccedil;&atilde;o m&uacute;ltipla:</strong> a mesma produtividade pode receber mais de uma op&ccedil;&atilde;o em cada grupo: v&aacute;rios materiais, at&eacute; 3 tipos de solda e os dois tamanhos. &ldquo;Sem fixa&ccedil;&atilde;o&rdquo; &eacute; exclusiva dentro do grupo de tipo de solda.
              </div>
              <div>
                <p className="font-medium">{materialEditando.nome}</p>
                <p className="text-sm text-muted-foreground">
                  Código MubiSys #{materialEditando.id}
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Material aplicável</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={materiaisEditados.length === 0 ? "secondary" : "outline"}
                    onClick={() => setMateriaisEditados([])}
                  >
                    Sem material
                  </Button>
                  {MATERIAIS_SOLDA.map(material => (
                    <Button
                      key={material}
                      type="button"
                      size="sm"
                      variant={materiaisEditados.includes(material) ? "default" : "outline"}
                      onClick={() => setMateriaisEditados(atual => alternarMaterialSolda(atual, material))}
                    >
                      {ROTULO_MATERIAL_SOLDA[material]}
                    </Button>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Tipo de solda</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={tiposEditados.length === 0 ? "secondary" : "outline"}
                    onClick={() => setTiposEditados([])}
                  >
                    Sem tipo
                  </Button>
                  {TIPOS_SOLDA.map(tipo => (
                    <Button
                      key={tipo}
                      type="button"
                      size="sm"
                      variant={tiposEditados.includes(tipo) ? "default" : "outline"}
                      onClick={() =>
                        setTiposEditados(atual => {
                          const proximo = alternarTipoSolda(atual, tipo);
                          if (!atual.includes(tipo) && proximo.length === atual.length)
                            toast.error("Selecione no máximo 3 tipos; sem fixação é exclusivo.");
                          return proximo;
                        })
                      }
                    >
                      {ROTULO_TIPO_SOLDA[tipo]}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecione até 3 tipos. "Sem fixação" não combina com os demais.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Tamanho</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={tamanhosEditados.length === 0 ? "secondary" : "outline"}
                    onClick={() => setTamanhosEditados([])}
                  >
                    Sem tamanho
                  </Button>
                  {TAMANHOS_PRODUTIVIDADE.map(tamanho => (
                    <Button
                      key={tamanho}
                      type="button"
                      size="sm"
                      variant={tamanhosEditados.includes(tamanho) ? "default" : "outline"}
                      onClick={() => setTamanhosEditados(atual => alternarTamanhoProdutividade(atual, tamanho))}
                    >
                      {ROTULO_TAMANHO_PRODUTIVIDADE[tamanho]}
                    </Button>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Categoria</h3>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIAS_PRODUTIVIDADE.map(categoria => (
                    <Button
                      key={categoria}
                      type="button"
                      size="sm"
                      variant={estiloEditado.categorias.includes(categoria) ? "default" : "outline"}
                      aria-pressed={estiloEditado.categorias.includes(categoria)}
                      onClick={() => setEstiloEditado(atual => ({ ...atual, ...alternarCategoriaProdutividade(atual, categoria) }))}
                    >
                      {ROTULO_CATEGORIA_PRODUTIVIDADE[categoria]}
                    </Button>
                  ))}
                </div>
                {estiloEditado.categorias.includes("frontlight") && (
                  <div className="ml-4 space-y-2 border-l-2 border-blue-200 pl-3">
                    <h4 className="text-xs font-semibold text-slate-600">Aro do Frontlight</h4>
                    <div className="flex flex-wrap gap-2">
                      {AROS_FRONTLIGHT.map(aro => (
                        <Button
                          key={aro}
                          type="button"
                          size="sm"
                          variant={estiloEditado.aros.includes(aro) ? "default" : "outline"}
                          aria-pressed={estiloEditado.aros.includes(aro)}
                          onClick={() => setEstiloEditado(atual => ({ ...atual, aros: alternarAroFrontlight(atual.aros, aro) }))}
                        >
                          {ROTULO_ARO_FRONTLIGHT[aro]}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Formato</h3>
                <div className="flex flex-wrap gap-2">
                  {FORMATOS_PRODUTIVIDADE.map(formato => (
                    <Button
                      key={formato}
                      type="button"
                      size="sm"
                      variant={estiloEditado.formatos.includes(formato) ? "default" : "outline"}
                      aria-pressed={estiloEditado.formatos.includes(formato)}
                      onClick={() => setEstiloEditado(atual => ({ ...atual, formatos: alternarFormatoProdutividade(atual.formatos, formato) }))}
                    >
                      {ROTULO_FORMATO_PRODUTIVIDADE[formato]}
                    </Button>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Fundo</h3>
                <div className="flex flex-wrap gap-2">
                  {FUNDOS_PRODUTIVIDADE.map(fundo => (
                    <Button
                      key={fundo}
                      type="button"
                      size="sm"
                      variant={estiloEditado.fundos.includes(fundo) ? "default" : "outline"}
                      aria-pressed={estiloEditado.fundos.includes(fundo)}
                      onClick={() => setEstiloEditado(atual => ({ ...atual, fundos: alternarFundoProdutividade(atual.fundos, fundo) }))}
                    >
                      {ROTULO_FUNDO_PRODUTIVIDADE[fundo]}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Categoria, formato e fundo: clique de novo para desmarcar; sem marcação, a produtividade fica sem essa classificação. O aro só existe dentro do Frontlight.
                </p>
              </section>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMaterialEditando(null)}
                  disabled={salvarClassificação.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={confirmarEdição}
                  disabled={salvarClassificação.isPending}
                >
                  {salvarClassificação.isPending ? "Salvando..." : "Salvar classificação"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const TAXAS_CARTAO_LINK = {
  avista: 3.05,
  ate6Parcelas: 2.8,
  ate12Parcelas: 3.53,
  ate18Parcelas: 3.83,
  parcelamentoPorParcela: 0.9,
};

function calcularTaxaVendaCartao(parcelas: number): number {
  if (parcelas <= 1) return TAXAS_CARTAO_LINK.avista;
  if (parcelas <= 6) return TAXAS_CARTAO_LINK.ate6Parcelas;
  if (parcelas <= 12) return TAXAS_CARTAO_LINK.ate12Parcelas;
  return TAXAS_CARTAO_LINK.ate18Parcelas;
}

function SimuladorCartao() {
  const [valorInformado, setValorInformado] = useState("1000");
  const [modo, setModo] = useState<"receber" | "cobrar">("receber");
  const [parcelas, setParcelas] = useState("3");
  const valor = Number(valorInformado.replace(",", "."));
  const numeroParcelas = Number(parcelas);
  const taxaVenda = calcularTaxaVendaCartao(numeroParcelas);
  const taxaParcelamento = numeroParcelas > 1 ? numeroParcelas * TAXAS_CARTAO_LINK.parcelamentoPorParcela : 0;
  const taxaTotal = taxaVenda + taxaParcelamento;
  const parametrosValidos = Number.isFinite(valor) && valor > 0 && Number.isInteger(numeroParcelas) && numeroParcelas >= 1 && numeroParcelas <= 18 && taxaTotal < 100;

  const simulacao = useMemo(() => {
    if (!parametrosValidos) return null;
    const valorCentavos = Math.round(valor * 100);
    const totalCentavos = modo === "receber" ? Math.round(valorCentavos / (1 - taxaTotal / 100)) : valorCentavos;
    const taxaVendaCentavos = Math.round(totalCentavos * taxaVenda / 100);
    const taxaParcelamentoCentavos = Math.round(totalCentavos * taxaParcelamento / 100);
    return {
      totalCobrado: totalCentavos / 100,
      valorRecebido: (totalCentavos - taxaVendaCentavos - taxaParcelamentoCentavos) / 100,
      taxaVenda: taxaVendaCentavos / 100,
      taxaParcelamento: taxaParcelamentoCentavos / 100,
      percentualVenda: taxaVenda,
      percentualParcelamento: taxaParcelamento,
      valorParcela: totalCentavos / 100 / numeroParcelas,
    };
  }, [modo, numeroParcelas, parametrosValidos, taxaParcelamento, taxaTotal, taxaVenda, valor]);

  return (
    <Card className="mb-4 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-blue-600" />
          Simulador de cartão — Link de pagamento
        </CardTitle>
        <p className="text-xs text-slate-500">
          Parcelado pelo vendedor, com recebimento na hora e tarifas do Mercado Pago informadas.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-slate-600">O que deseja calcular?</legend>
              <div className="flex w-fit rounded-full border bg-slate-50 p-1">
                {(["receber", "cobrar"] as const).map(opcao => (
                  <button
                    key={opcao}
                    type="button"
                    aria-pressed={modo === opcao}
                    onClick={() => setModo(opcao)}
                    className={"rounded-full px-3 py-1.5 text-xs font-medium transition-colors " + (modo === opcao ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900")}
                  >
                    {opcao === "receber" ? "Receber" : "Cobrar"}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-slate-600">
                {modo === "receber" ? "Quanto você quer receber? (R$)" : "Quanto quer cobrar? (R$)"}
                <Input type="number" min="0" step="0.01" value={valorInformado} onChange={e => setValorInformado(e.target.value)} placeholder="1000.00" />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Em quantas parcelas?
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-slate-900" value={parcelas} onChange={e => setParcelas(e.target.value)}>
                  {Array.from({ length: 18 }, (_, indice) => indice + 1).map(quantidade => (
                    <option key={quantidade} value={quantidade}>
                      {quantidade} {quantidade === 1 ? "parcela (à vista)" : "parcelas"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-2 rounded-md bg-slate-50 p-3 text-xs sm:grid-cols-2">
              <div><span className="text-slate-500">Meio de cobrança</span><div className="font-medium">Link de pagamento</div></div>
              <div><span className="text-slate-500">Forma de pagamento</span><div className="font-medium">Cartão de crédito</div></div>
              <div><span className="text-slate-500">Tipo de parcelamento</span><div className="font-medium">{numeroParcelas === 1 ? "À vista" : "Parcelado pelo vendedor"}</div></div>
              <div><span className="text-slate-500">Prazo para receber</span><div className="font-medium">Na hora</div></div>
            </div>
          </div>
          <div className="space-y-3 rounded-md border p-3">
            {simulacao ? (
              <>
                <div className="flex items-center justify-between border-b pb-3 text-sm font-semibold">
                  <span>{modo === "receber" ? "Para receber" : "Você recebe"}</span>
                  <span>{fmtBrl(simulacao.valorRecebido)}</span>
                </div>
                <div className="flex items-start justify-between gap-3 border-b py-2 text-sm">
                  <div>Taxa por venda<div className="text-xs text-slate-500">Na hora · {fmtNum(simulacao.percentualVenda, 2)}%</div></div>
                  <span className="whitespace-nowrap">+ {fmtBrl(simulacao.taxaVenda)}</span>
                </div>
                <div className="flex items-start justify-between gap-3 border-b py-2 text-sm">
                  <div>Taxa de parcelamento<div className="text-xs text-slate-500">{fmtNum(simulacao.percentualParcelamento, 2)}%</div></div>
                  <span className="whitespace-nowrap">+ {fmtBrl(simulacao.taxaParcelamento)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 pt-1 text-sm font-semibold">
                  <span>Cliente paga</span>
                  <span>{fmtBrl(simulacao.totalCobrado)}</span>
                </div>
                <p className="text-xs text-slate-500">Em {numeroParcelas}x de {fmtBrl(simulacao.valorParcela)}</p>
                <BotaoCopiarImagem
                  className="w-full"
                  nomeArquivo={`simulacao-cartao-${numeroParcelas}x.png`}
                  montar={() => ({
                    titulo: "Pagamento no cartão de crédito",
                    subtitulo: numeroParcelas === 1 ? "Link de pagamento · à vista" : `Link de pagamento · em ${numeroParcelas}x`,
                    larguraMinima: 460,
                    blocos: [
                      { tipo: "linha", rotulo: modo === "receber" ? "Para receber" : "Você recebe", valor: fmtBrl(simulacao.valorRecebido), forte: true },
                      { tipo: "linha", rotulo: "Taxa por venda", detalhe: `Na hora · ${fmtNum(simulacao.percentualVenda, 2)}%`, valor: `+ ${fmtBrl(simulacao.taxaVenda)}` },
                      { tipo: "linha", rotulo: "Taxa de parcelamento", detalhe: `${fmtNum(simulacao.percentualParcelamento, 2)}%`, valor: `+ ${fmtBrl(simulacao.taxaParcelamento)}` },
                      { tipo: "linha", rotulo: "Cliente paga", valor: fmtBrl(simulacao.totalCobrado), forte: true },
                      { tipo: "nota", texto: `Em ${numeroParcelas}x de ${fmtBrl(simulacao.valorParcela)}` },
                    ],
                  })}
                />
              </>
            ) : (
              <p className="text-xs text-amber-700">Informe um valor positivo e selecione de 1 a 18 parcelas.</p>
            )}
          </div>
        </div>
        <details className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium">Tarifas usadas na simulação</summary>
          <p className="mt-2">
            Taxa por venda na hora: à vista 3,05%; de 2x a 6x 2,80%; de 7x a 12x 3,53%; de 13x a 18x 3,83%. Taxa de parcelamento pelo vendedor: 0,90% por parcela (3x = 2,70%; 6x = 5,40%).
          </p>
          <p className="mt-1">O valor cobrado desconta as duas taxas do total para chegar ao valor líquido informado.</p>
        </details>
      </CardContent>
    </Card>
  );
}

function dataLocalIso(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function lerDataLocal(valor: string): Date | null {
  const partes = valor.split("-").map(Number);
  if (partes.length !== 3 || partes.some(parte => !Number.isInteger(parte))) return null;
  const [ano, mes, dia] = partes;
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia ? data : null;
}

function adicionarDiasCorridos(data: Date, dias: number): Date {
  const resultado = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

type JurosBoletoFaixas = {
  prazo7: number;
  prazo14: number;
  prazo21: number;
  prazo28: number;
  adicional28: number;
};

function calcularTaxaBoleto(dias: number, taxas: JurosBoletoFaixas): number {
  const faixas = [
    { dias: 7, taxa: taxas.prazo7 },
    { dias: 14, taxa: taxas.prazo14 },
    { dias: 21, taxa: taxas.prazo21 },
    { dias: 28, taxa: taxas.prazo28 },
  ];

  if (dias <= 7) return (Math.max(0, dias) / 7) * taxas.prazo7;
  for (let indice = 1; indice < faixas.length; indice++) {
    const anterior = faixas[indice - 1];
    const atual = faixas[indice];
    if (dias <= atual.dias) {
      const proporcao = (dias - anterior.dias) / (atual.dias - anterior.dias);
      return anterior.taxa + (atual.taxa - anterior.taxa) * proporcao;
    }
  }
  return taxas.prazo28 + ((dias - 28) / 28) * taxas.adicional28;
}

const MAX_BOLETOS = 12;
const MAX_PRAZO_BOLETO_DIAS = 365;
const INTERVALOS_BOLETO_RAPIDOS = [7, 14, 15, 20, 21, 28, 30];

function SimuladorBoletos() {
  const [valorBase, setValorBase] = useState("1000");
  const [dataBase, setDataBase] = useState(() => dataLocalIso(new Date()));
  const [diasParaFaturar, setDiasParaFaturar] = useState("7");
  const [quantidade, setQuantidade] = useState("3");
  const [intervalo, setIntervalo] = useState("20");
  // Vazio = o 1º boleto vence no mesmo prazo do intervalo (ex.: 20 / 40 / 60).
  const [primeiroPrazo, setPrimeiroPrazo] = useState("");
  const [jurosEditaveis, setJurosEditaveis] = useState({
    prazo7: "0",
    prazo14: "0.25",
    prazo21: "0.5",
    prazo28: "0.75",
    adicional28: "1",
  });

  const valor = Number(valorBase.replace(",", "."));
  const valorValido = Number.isFinite(valor) && valor > 0;
  const diasFaturamento = Number(diasParaFaturar);
  const dataReferencia = useMemo(() => lerDataLocal(dataBase), [dataBase]);
  const numeroBoletos = Number(quantidade);
  const intervaloDias = Number(intervalo);
  const primeiroDias = primeiroPrazo.trim() === "" ? intervaloDias : Number(primeiroPrazo);
  const intervaloValido = intervalo.trim() !== "" && Number.isInteger(intervaloDias) && intervaloDias >= 1 && intervaloDias <= MAX_PRAZO_BOLETO_DIAS;
  const primeiroValido = Number.isInteger(primeiroDias) && primeiroDias >= 0 && primeiroDias <= MAX_PRAZO_BOLETO_DIAS;
  const ultimoPrazo = primeiroDias + (numeroBoletos - 1) * intervaloDias;
  const prazosDentroDoLimite = ultimoPrazo <= MAX_PRAZO_BOLETO_DIAS;
  const prazosValidos = intervaloValido && primeiroValido && prazosDentroDoLimite;

  const prazos = useMemo(
    () => (prazosValidos ? Array.from({ length: numeroBoletos }, (_, indice) => primeiroDias + indice * intervaloDias) : []),
    [intervaloDias, numeroBoletos, prazosValidos, primeiroDias],
  );
  const taxasNumericas = useMemo(() => ({
    prazo7: Number(jurosEditaveis.prazo7.replace(",", ".")),
    prazo14: Number(jurosEditaveis.prazo14.replace(",", ".")),
    prazo21: Number(jurosEditaveis.prazo21.replace(",", ".")),
    prazo28: Number(jurosEditaveis.prazo28.replace(",", ".")),
    adicional28: Number(jurosEditaveis.adicional28.replace(",", ".")),
  }), [jurosEditaveis]);
  const taxasValidas = Object.values(jurosEditaveis).every(valorTaxa => {
    const taxa = Number(valorTaxa.replace(",", "."));
    return valorTaxa.trim() !== "" && Number.isFinite(taxa) && taxa >= 0 && taxa <= 100;
  });
  const parametrosValidos =
    valorValido &&
    Boolean(dataReferencia) &&
    [7, 10].includes(diasFaturamento) &&
    Number.isInteger(numeroBoletos) &&
    numeroBoletos >= 1 &&
    numeroBoletos <= MAX_BOLETOS &&
    prazosValidos &&
    taxasValidas;

  const simulacao = useMemo(() => {
    if (!parametrosValidos || !dataReferencia) return null;
    const faturamento = adicionarDiasUteisComFeriados(dataReferencia, diasFaturamento);
    const totalCentavos = Math.round(valor * 100);
    const parcelaBaseCentavos = Math.floor(totalCentavos / prazos.length);
    let somaParcelasCentavos = 0;
    const parcelas = prazos.map((dias, indice) => {
      const principalCentavos = indice === prazos.length - 1
        ? totalCentavos - parcelaBaseCentavos * (prazos.length - 1)
        : parcelaBaseCentavos;
      const percentualJuros = calcularTaxaBoleto(dias, taxasNumericas);
      const jurosCentavos = Math.round(principalCentavos * percentualJuros / 100);
      const totalParcelaCentavos = principalCentavos + jurosCentavos;
      somaParcelasCentavos += totalParcelaCentavos;
      return {
        dias,
        vencimento: adicionarDiasCorridos(faturamento, dias),
        principal: principalCentavos / 100,
        percentualJuros,
        juros: jurosCentavos / 100,
        total: totalParcelaCentavos / 100,
      };
    });
    return {
      faturamento,
      parcelas,
      base: totalCentavos / 100,
      total: somaParcelasCentavos / 100,
      juros: (somaParcelasCentavos - totalCentavos) / 100,
    };
  }, [dataReferencia, diasFaturamento, parametrosValidos, prazos, taxasNumericas, valor]);

  const atualizarJuros = (campo: keyof typeof jurosEditaveis, valorCampo: string) => {
    setJurosEditaveis(atual => ({ ...atual, [campo]: valorCampo }));
  };

  const campoSelect = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-slate-900";
  const camposJuros: Array<{ campo: keyof typeof jurosEditaveis; rotulo: string }> = [
    { campo: "prazo7", rotulo: "Boleto 7 dias (%)" },
    { campo: "prazo14", rotulo: "Boleto 14 dias (%)" },
    { campo: "prazo21", rotulo: "Boleto 21 dias (%)" },
    { campo: "prazo28", rotulo: "Boleto 28 dias (%)" },
    { campo: "adicional28", rotulo: "Adicional por mais 28 dias (%)" },
  ];

  return (
    <Card className="mb-4 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-blue-600" />
          Simulador de boletos
        </CardTitle>
        <p className="text-xs text-slate-500">
          Escolha em quantos boletos e o intervalo entre eles; as datas e os valores aparecem na hora.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Valor do pedido (R$)
            <Input type="number" min="0" step="0.01" value={valorBase} onChange={e => setValorBase(e.target.value)} placeholder="1000.00" />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Data base do pedido
            <Input type="date" value={dataBase} onChange={e => setDataBase(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Faturar após
            <select className={campoSelect} value={diasParaFaturar} onChange={e => setDiasParaFaturar(e.target.value)}>
              <option value="7">7 dias úteis</option>
              <option value="10">10 dias úteis</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Em quantos boletos?
            <select className={campoSelect} value={quantidade} onChange={e => setQuantidade(e.target.value)}>
              {Array.from({ length: MAX_BOLETOS }, (_, indice) => indice + 1).map(opcao => (
                <option key={opcao} value={opcao}>
                  {opcao} {opcao === 1 ? "boleto (à vista)" : "boletos"}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1">
            <label htmlFor="boleto-intervalo" className="text-xs font-medium text-slate-600">Intervalo entre os boletos (dias)</label>
            <Input id="boleto-intervalo" type="number" min="1" max={MAX_PRAZO_BOLETO_DIAS} step="1" value={intervalo} onChange={e => setIntervalo(e.target.value)} placeholder="20" />
            <div className="flex flex-wrap gap-1 pt-1">
              {INTERVALOS_BOLETO_RAPIDOS.map(dias => (
                <button
                  key={dias}
                  type="button"
                  aria-pressed={intervaloDias === dias}
                  onClick={() => setIntervalo(String(dias))}
                  className={"rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors " + (intervaloDias === dias ? "border-blue-300 bg-blue-50 text-blue-900" : "bg-white text-slate-500 hover:text-slate-900")}
                >
                  {dias}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="boleto-primeiro-prazo" className="text-xs font-medium text-slate-600">Prazo do 1º boleto (dias)</label>
            <Input id="boleto-primeiro-prazo" type="number" min="0" max={MAX_PRAZO_BOLETO_DIAS} step="1" value={primeiroPrazo} onChange={e => setPrimeiroPrazo(e.target.value)} placeholder={intervalo.trim() || "igual ao intervalo"} />
            <p className="text-[11px] text-slate-500">Dias após o faturamento. Vazio = igual ao intervalo.</p>
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          {simulacao ? (
            <>
              <div className="grid gap-2 rounded-md bg-slate-50 p-3 text-xs sm:grid-cols-2">
                <div><span className="text-slate-500">Faturamento estimado</span><div className="font-medium">{fmtDate(simulacao.faturamento)} <span className="font-normal text-slate-500">({diasFaturamento} dias úteis após a data base)</span></div></div>
                <div><span className="text-slate-500">Condição</span><div className="font-medium">{simulacao.parcelas.map(parcela => parcela.dias).join(" / ")} dias</div></div>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Boleto</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Principal</TableHead>
                      <TableHead>Juros</TableHead>
                      <TableHead className="text-right">Valor do boleto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulacao.parcelas.map((parcela, indice) => (
                      <TableRow key={`${parcela.dias}-${indice}`}>
                        <TableCell>
                          {indice + 1}/{simulacao.parcelas.length} <span className="text-xs text-slate-500">({parcela.dias} dias)</span>
                        </TableCell>
                        <TableCell>{fmtDate(parcela.vencimento)}</TableCell>
                        <TableCell>{fmtBrl(parcela.principal)}</TableCell>
                        <TableCell>
                          {fmtBrl(parcela.juros)} <span className="text-xs text-slate-500">({fmtNum(parcela.percentualJuros, 2)}%)</span>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{fmtBrl(parcela.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>Cliente paga</TableCell>
                      <TableCell>{fmtBrl(simulacao.base)}</TableCell>
                      <TableCell>{fmtBrl(simulacao.juros)}</TableCell>
                      <TableCell className="text-right">{fmtBrl(simulacao.total)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
              <p className="text-xs text-slate-500">
                {simulacao.parcelas.length > 1 && `Em ${simulacao.parcelas.length}x de ${fmtBrl(simulacao.total / simulacao.parcelas.length)} em média. `}As datas contam dias corridos após o faturamento.
              </p>
              <BotaoCopiarImagem
                nomeArquivo={`simulacao-boletos-${simulacao.parcelas.length}x.png`}
                montar={() => ({
                  titulo: "Condição de pagamento em boletos",
                  subtitulo: `Pedido de ${fmtBrl(valor)} · faturamento estimado em ${fmtDate(simulacao.faturamento)}`,
                  blocos: [
                    {
                      tipo: "tabela",
                      colunas: [
                        { titulo: "Boleto" },
                        { titulo: "Vencimento" },
                        { titulo: "Principal", alinhar: "dir" },
                        { titulo: "Juros", alinhar: "dir" },
                        { titulo: "Valor do boleto", alinhar: "dir" },
                      ],
                      linhas: simulacao.parcelas.map((parcela, indice) => [
                        `${indice + 1}/${simulacao.parcelas.length} (${parcela.dias} dias)`,
                        fmtDate(parcela.vencimento),
                        fmtBrl(parcela.principal),
                        `${fmtBrl(parcela.juros)} (${fmtNum(parcela.percentualJuros, 2)}%)`,
                        fmtBrl(parcela.total),
                      ]),
                    },
                    { tipo: "linha", rotulo: "Cliente paga", detalhe: `Principal ${fmtBrl(valor)} + juros ${fmtBrl(simulacao.juros)}`, valor: fmtBrl(simulacao.total), forte: true },
                  ],
                })}
              />
            </>
          ) : (
            <p className="text-xs text-amber-700">
              {!valorValido
                ? "Informe um valor do pedido maior que zero."
                : !dataReferencia
                  ? "Informe a data base do pedido."
                  : !intervaloValido
                    ? `Informe o intervalo entre os boletos em dias inteiros, de 1 a ${MAX_PRAZO_BOLETO_DIAS}.`
                    : !primeiroValido
                      ? `Informe o prazo do 1º boleto em dias inteiros, de 0 a ${MAX_PRAZO_BOLETO_DIAS}, ou deixe vazio.`
                      : !prazosDentroDoLimite
                        ? `O último boleto venceria em ${ultimoPrazo} dias; o limite é ${MAX_PRAZO_BOLETO_DIAS}. Reduza a quantidade ou o intervalo.`
                        : "Informe cada taxa de juros entre 0 e 100%."}
            </p>
          )}
        </div>

        <details className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium">Configurar juros do boleto</summary>
          <p className="mt-2">
            Valores iniciais baixos e editáveis. Entre as faixas, o simulador interpola; após 28 dias, aplica a taxa adicional proporcional a cada período de 28 dias. O juro de cada boleto é calculado sobre o principal dele, conforme os dias após o faturamento.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {camposJuros.map(({ campo, rotulo }) => (
              <label key={campo} className="space-y-1 text-xs font-medium text-slate-600">
                {rotulo}
                <Input type="number" min="0" max="100" step="0.01" value={jurosEditaveis[campo]} onChange={e => atualizarJuros(campo, e.target.value)} />
              </label>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export default function TabelaPrecos() {
  const [tabelaAtiva, setTabelaAtiva] = useState<
    "principal" | "novo_cliente" | "dashboard"
  >(
    "principal"
  );
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("1");
  const [activeTabNC, setActiveTabNC] = useState("11");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPage, setFilterPage] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const { data: allSections, isLoading } = trpc.price.list.useQuery({});
  const { data: blockAffiliations } = trpc.price.listBlockAffiliations.useQuery();
  const [affiliationEditingSectionId, setAffiliationEditingSectionId] = useState<number | null>(null);
  const canEditBlockProducts = !!user && ["gestor", "admin", "master"].includes(user.role ?? "");
  const affiliationsBySection = useMemo(() => {
    const map = new Map<number, BlockAffiliation>();
    for (const pair of blockAffiliations ?? []) { map.set(pair.principalSectionId, pair); map.set(pair.novoClienteSectionId, pair); }
    return map;
  }, [blockAffiliations]);
  const isLoadingNC = isLoading;
  const { data: meta } = trpc.price.getMeta.useQuery();
  const { data: dimensionamentoLed } = trpc.custoLed.getDimensionamentoFontes.useQuery();
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryTable, setSelectedHistoryTable] = useState<"principal" | "novo_cliente">("principal");
  const [showPriceCalculator, setShowPriceCalculator] = useState(false);
  const [tabelaCalculadora, setTabelaCalculadora] = useState<"principal" | "novo_cliente">(
    "principal"
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionPage, setNewSectionPage] = useState(11);
  const utils = trpc.useUtils();
  const addSectionMut = trpc.price.addSection.useMutation({
    onSuccess: () => {
      utils.price.list.invalidate();
      setShowAddModal(false);
      setNewSectionTitle("");
      toast.success("Seção adicionada com sucesso!");
    },
    onError: () => toast.error("Erro ao adicionar seção"),
  });
  const deleteSectionMut = trpc.price.deleteSection.useMutation({
    onSuccess: () => {
      utils.price.list.invalidate();
      toast.success("Seção removida!");
    },
    onError: () => toast.error("Erro ao remover seção"),
  });
  const { data: history, isLoading: isHistoryLoading, error: historyError } = trpc.price.getHistory.useQuery(
    { limit: 1000 },
    { enabled: showHistory || tabelaAtiva === "dashboard" }
  );

  function adicionarSecao() {
    const sectionTitle = newSectionTitle.trim();
    if (!sectionTitle) {
      toast.error("Informe o nome da seção.");
      return;
    }
    const page = newSectionPage;
    addSectionMut.mutate({
      page,
      sectionTitle,
      contentJson: JSON.stringify({ type: "rich_text", html: "<p></p>" }),
      notes: null,
    }, {
      onSuccess: () => {
        if (page >= 11) setActiveTabNC(String(page));
        else setActiveTab(String(page));
      },
    });
  }

  const isSearching = searchQuery.trim().length > 0;

  const sectionsForPage = (page: number) => {
    if (page === 4 || page === 5) return [];
    const storedPages = page === 6 ? [5, 6] : [page];
    return (allSections ?? [])
      .filter(section => storedPages.includes(section.page))
      .map(section => section.page === 5 ? { ...section, page: 6 } : section)
      .sort((a, b) => a.sectionOrder - b.sectionOrder);
  };

  // Filtro combinado: busca por texto + filtro por página
  const filteredSections = useMemo(() => {
    let sections = (allSections ?? []).filter(section => section.page !== 4).map(section => section.page === 5 ? { ...section, page: 6 } : section);
    if (filterPage !== "all") {
      sections = sections.filter(s => s.page === Number(filterPage));
    }
    return sections.sort((a, b) =>
      a.page !== b.page ? a.page - b.page : a.sectionOrder - b.sectionOrder
    );
  }, [allSections, filterPage]);

  const allPages = [
    { key: "1", label: "Pág. 1 — Frontlight / Galvanizado" },
    { key: "2", label: "Pág. 2 — Inox / PVC / Acrílico" },
    { key: "3", label: "Pág. 3 — Pintura" },
    { key: "4", label: "Pág. 4 — Fontes Chaveadas" },
    { key: "5", label: "Pág. 5 — Produtividades de solda" },
    { key: "6", label: "Pág. 6 — Condições Comerciais" },
  ];

  // Seções da Tabela Novo Cliente (pages 11, 12, 13)
  const sectionsNCForPage = (page: number) =>
    page === 4 ? [] : (allSections ?? [])
      .filter(s => s.page === page)
      .sort((a, b) => a.sectionOrder - b.sectionOrder);

  const allPagesNC = [
    { key: "11", label: "Pág. 1" },
    { key: "12", label: "Pág. 2" },
    { key: "13", label: "Pág. 3" },
    { key: "4", label: "Pág. 4 — Fontes Chaveadas" },
  ];

  return (
    <>
      {/* Navegação de Sub-abas */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-0">
        <button
          onClick={() => setTabelaAtiva("principal")}
          className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors ${
            tabelaAtiva === "principal"
              ? "bg-white border-slate-200 text-blue-700 shadow-sm -mb-px"
              : "bg-slate-50 border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText className="w-4 h-4 inline mr-1.5" />
          Tabela Clientes Antigos
        </button>
        <button
          onClick={() => setTabelaAtiva("novo_cliente")}
          className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors ${
            tabelaAtiva === "novo_cliente"
              ? "bg-white border-slate-200 text-emerald-700 shadow-sm -mb-px"
              : "bg-slate-50 border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Plus className="w-4 h-4 inline mr-1.5" />
          Tabela Novo Cliente
        </button>
        <button
          onClick={() => setTabelaAtiva("dashboard")}
          className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors ${
            tabelaAtiva === "dashboard"
              ? "bg-white border-slate-200 text-violet-700 shadow-sm -mb-px"
              : "bg-slate-50 border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-1.5" />
          Dashboard
        </button>
      </div>


      {/* ─── ABA: TABELA NOVO CLIENTE ─── */}
      {tabelaAtiva === "novo_cliente" && (
        <div>
          {/* Header */}
          <div className="mb-5">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <Plus className="w-6 h-6 text-emerald-600" />
              <h1 className="text-2xl font-bold text-slate-900">
                Tabela Novo Cliente
              </h1>
              {meta && (
                <Badge className="bg-emerald-600 text-white text-xs">
                  v{meta.versao}
                </Badge>
              )}
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => {
                    setTabelaCalculadora("novo_cliente");
                    setShowPriceCalculator(true);
                  }}
                >
                  <Calculator className="w-4 h-4" />
                  Simular reajuste
                </Button>
                {activeTabNC !== "4" && (
                  <Button
                    size="sm"
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      setNewSectionPage(Number(activeTabNC));
                      setNewSectionTitle("");
                      setShowAddModal(true);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Nova Seção
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => { setSelectedHistoryTable("novo_cliente"); setShowHistory(true); }}
                >
                  <History className="w-4 h-4" />
                  Histórico
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() =>
                    gerarPdfTabela(
                      (allSections ?? []).filter(
                        s => (s.page >= 11 && s.page <= 13) || s.page === 4
                      ),
                      meta ?? null,
                      dimensionamentoLed!.tables,
                      dimensionamentoLed!.texts,
                      "Tabela Novo Cliente"
                    )
                  }
                  disabled={isLoadingNC || !dimensionamentoLed}
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </Button>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Tabela exclusiva para novos clientes. Clique em{" "}
              <strong>Editar</strong> para atualizar valores.
            </p>
          </div>

          {/* Tabs das páginas */}
          <Tabs value={activeTabNC} onValueChange={setActiveTabNC}>
            <TabsList className="flex flex-wrap h-auto gap-1 mb-6 bg-slate-100 p-1 rounded-lg">
              {allPagesNC.map(p => (
                <TabsTrigger
                  key={p.key}
                  value={p.key}
                  className="text-xs px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <Pencil className="w-3 h-3 mr-1 text-emerald-500" />
                  {p.key === "4" ? getLedText(dimensionamentoLed?.texts ?? {}, ledPowerSourceTextKey.page("tableTabLabel"), p.label) : p.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {allPagesNC.map(p => (
              <TabsContent key={p.key} value={p.key}>
                {p.key === "4" ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                      <span>Nome da aba:</span>
                      <EditableLedText textKey={ledPowerSourceTextKey.page("tableTabLabel")} value="Pág. 4 — Fontes Chaveadas" texts={dimensionamentoLed?.texts ?? {}} />
                    </div>
                    <LedPowerSourcesSection dimensionamento={dimensionamentoLed} />
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                      <Pencil className="w-3 h-3" />
                      Clique em <strong>Editar</strong> para atualizar valores. Use{" "}
                      <strong>Nova Seção</strong> para adicionar seções.
                    </div>
                    {isLoadingNC ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                          <div
                            key={i}
                            className="h-32 bg-slate-100 rounded-lg animate-pulse"
                          />
                        ))}
                      </div>
                    ) : sectionsNCForPage(Number(p.key)).length === 0 ? (
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Plus />
                          </EmptyMedia>
                          <EmptyTitle>Nenhuma seção nesta página</EmptyTitle>
                          <EmptyDescription>
                            Clique em <strong>Nova Seção</strong> para adicionar.
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => {
                              setNewSectionPage(Number(p.key));
                              setShowAddModal(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-1" /> Nova Seção
                          </Button>
                        </EmptyContent>
                      </Empty>
                    ) : (
                      <div className="space-y-4">
                        {sectionsNCForPage(Number(p.key)).map(section => (
                          <div key={section.id} className="relative group">
                            <EditableSection section={section as Section} products={affiliationsBySection.get(section.id)?.produtos ?? []} showProducts={affiliationsBySection.has(section.id)} />
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Remover a seção "${section.sectionTitle}"?`
                                  )
                                ) {
                                  deleteSectionMut.mutate({ id: section.id });
                                }
                              }}
                              className="absolute top-3 right-14 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded px-2 py-1 text-xs flex items-center gap-1"
                              title="Remover seção"
                            >
                              <Trash2 className="w-3 h-3" /> Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}

      {/* ─── ABA: TABELA DE PREÇOS (PRINCIPAL) ─── */}
      {tabelaAtiva === "dashboard" && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-violet-600" />
                <h1 className="text-2xl font-bold text-slate-900">
                  Dashboard das Tabelas de Preço
                </h1>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Acompanhe os reajustes registrados nas tabelas de Clientes Antigos
                e Novo Cliente.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setTabelaCalculadora("principal");
                  setShowPriceCalculator(true);
                }}
              >
                <Calculator className="h-4 w-4" />
                Impacto e Curva ABC · Clientes Antigos
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setTabelaCalculadora("novo_cliente");
                  setShowPriceCalculator(true);
                }}
              >
                <Calculator className="h-4 w-4" />
                Impacto e Curva ABC · Novo Cliente
              </Button>
            </div>
          </div>
          <PriceTableHistoryDashboard
            key="dashboard-precos"
            history={history}
            sections={(allSections ?? []).map(section => ({
              id: section.id,
              page: section.page,
            }))}
            isLoading={isHistoryLoading}
            error={historyError?.message}
            initialTable="todas"
          />
        </section>
      )}
      {tabelaAtiva === "principal" && (
        <div>
          {/* Header */}
          <div className="mb-5">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <FileText className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">
                Tabela Clientes Antigos
              </h1>
              {meta && (
                <Badge className="bg-blue-600 text-white text-xs">
                  v{meta.versao} —{" "}
                  {new Date(meta.dataModificacao).toLocaleDateString("pt-BR")}
                </Badge>
              )}
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    setTabelaCalculadora("principal");
                    setShowPriceCalculator(true);
                  }}
                >
                  <Calculator className="w-4 h-4" />
                  Simular reajuste
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2 border-slate-300 text-slate-600 hover:bg-slate-50"
                  onClick={() => { setSelectedHistoryTable("principal"); setShowHistory(true); }}
                >
                  <History className="w-4 h-4" />
                  Histórico
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                  onClick={async () => {
                    try {
                      const catalogo = await utils.produtos.materiasPrimas.listar.fetch();
                      gerarPdfTabela(
                        (allSections ?? []).filter(s => s.page >= 1 && s.page <= 6),
                        meta ?? null,
                        dimensionamentoLed!.tables,
                        dimensionamentoLed!.texts,
                        "Tabela Clientes Antigos",
                        catalogo.filter(material => material.ehProdutividade)
                      );
                    } catch (erro) {
                      console.error("[Tabela de Preços] Falha ao carregar produtividades para impressão:", erro);
                      toast.error("Não foi possível carregar as produtividades de solda para o PDF.");
                    }
                  }}
                  disabled={isLoading || !dimensionamentoLed}
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </Button>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Clique em <strong>Editar</strong> em qualquer seção para atualizar
              valores, margens ou observações.
              {meta && (
                <span className="ml-2 text-slate-400">
                  Última modificação:{" "}
                  {new Date(meta.dataModificacao).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
            </p>
          </div>

          {/* Search + Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-sm">
            <div className="flex gap-3 items-center">
              <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  className="flex-1 text-sm outline-none bg-transparent placeholder-slate-400"
                  placeholder="Buscar por material, espessura, margem, valor..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-3.5 h-3.5" />
                Filtros
                {showFilters ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </Button>
            </div>

            {/* Expanded filters */}
            {showFilters && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-3 items-center">
                <span className="text-xs font-medium text-slate-500">
                  Filtrar por página:
                </span>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: "all", label: "Todas" },
                    { value: "1", label: "Frontlight / Galvanizado" },
                    { value: "2", label: "Inox / PVC / Acrílico" },
                    { value: "3", label: "Pintura" },
                    { value: "4", label: "Fontes Chaveadas" },
                    { value: "6", label: "Condições Comerciais" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterPage(opt.value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        filterPage === opt.value
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {filterPage !== "all" && (
                  <button
                    onClick={() => setFilterPage("all")}
                    className="text-xs text-blue-600 hover:underline ml-1"
                  >
                    Limpar filtro
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Search Results Mode */}
          {isSearching ? (
            <div>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className="h-32 bg-slate-100 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <SearchResults
                  sections={filteredSections}
                  query={searchQuery.trim()}
                  affiliations={affiliationsBySection}
                  canEditProducts={canEditBlockProducts}
                  onEditProducts={setAffiliationEditingSectionId}
                />
              )}
            </div>
          ) : (
            /* Normal Tab Mode */
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex flex-wrap h-auto gap-1 mb-6 bg-slate-100 p-1 rounded-lg">
                {allPages.map(p => (
                  <TabsTrigger
                    key={p.key}
                    value={p.key}
                    className="text-xs px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    {p.key === "5" ? <Hammer className="w-3 h-3 mr-1 text-amber-700" /> : <Pencil className="w-3 h-3 mr-1 text-blue-500" />}
                    {p.key === "4" ? getLedText(dimensionamentoLed?.texts ?? {}, ledPowerSourceTextKey.page("tableTabLabel"), p.label) : p.label}
                  </TabsTrigger>
                ))}
              </TabsList>

            {allPages.map(p => (
              <TabsContent key={p.key} value={p.key}>
                {p.key === "5" ? (
                  <ProdutividadesSolda />
                ) : p.key === "4" ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                      <span>Nome da aba:</span>
                      <EditableLedText textKey={ledPowerSourceTextKey.page("tableTabLabel")} value="Pág. 4 — Fontes Chaveadas" texts={dimensionamentoLed?.texts ?? {}} />
                    </div>
                    <LedPowerSourcesSection dimensionamento={dimensionamentoLed} />
                  </div>
                ) : (
                  <>
                    {p.key === "6" && (
                      <div className="grid gap-4 xl:grid-cols-2">
                        <SimuladorBoletos />
                        <SimuladorCartao />
                      </div>
                    )}
                    <div className="mb-3 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                      <Pencil className="w-3 h-3" />
                      Clique em <strong>Editar</strong> em qualquer seção para
                      atualizar valores.
                    </div>
                    {isLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                          <div
                            key={i}
                            className="h-32 bg-slate-100 rounded-lg animate-pulse"
                          />
                        ))}
                      </div>
                    ) : sectionsForPage(Number(p.key)).length === 0 ? (
                      <Empty>
                        <EmptyHeader>
                          <EmptyTitle>
                            Nenhuma seção encontrada para esta página.
                          </EmptyTitle>
                        </EmptyHeader>
                      </Empty>
                    ) : (
                      sectionsForPage(Number(p.key)).map(section => (
                        <EditableSection
                          key={section.id}
                          section={section as Section}
                          products={affiliationsBySection.get(section.id)?.produtos ?? []}
                          showProducts={affiliationsBySection.has(section.id)}
                          canEditProducts={canEditBlockProducts && section.page >= 1 && section.page <= 3 && affiliationsBySection.has(section.id)}
                          onEditProducts={() => setAffiliationEditingSectionId(section.id)}
                        />
                      ))
                    )}
                  </>
                )}
              </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      )}

      <Dialog
        open={showAddModal}
        onOpenChange={open => {
          setShowAddModal(open);
          if (!open) setNewSectionTitle("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar seção à página {newSectionPage}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="nova-secao-titulo" className="text-sm font-medium text-slate-700">
              Nome da seção
            </label>
            <Input
              id="nova-secao-titulo"
              value={newSectionTitle}
              onChange={e => setNewSectionTitle(e.target.value)}
              placeholder="Ex.: Fontes para módulos LED"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") adicionarSecao(); }}
            />
            <p className="text-xs text-slate-500">
              Depois de criar, use Editar para inserir uma tabela ou descrição.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={adicionarSecao}
              disabled={!newSectionTitle.trim() || addSectionMut.isPending}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" />
              {addSectionMut.isPending ? "Adicionando..." : "Adicionar seção"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Painel de Histórico e Evolução das Margens */}
      {(() => {
        const pair = (blockAffiliations ?? []).find(item => item.principalSectionId === affiliationEditingSectionId);
        const section = (allSections ?? []).find(item => item.id === affiliationEditingSectionId);
        return pair && section ? <PriceBlockAffiliationEditor open={true} onOpenChange={open => { if (!open) setAffiliationEditingSectionId(null); }} principalSectionId={pair.principalSectionId} sectionTitle={section.sectionTitle} produtosAtuais={pair.produtos} /> : null;
      })()}
      <PriceAdjustmentCalculator
        open={showPriceCalculator}
        onOpenChange={setShowPriceCalculator}
        tabela={tabelaCalculadora}
        secoes={allSections ?? []}
      />

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Histórico e evolução das margens
            </DialogTitle>
          </DialogHeader>
          <PriceTableHistoryDashboard
            key={selectedHistoryTable}
            history={history}
            sections={(allSections ?? []).map(section => ({
              id: section.id,
              page: section.page,
            }))}
            isLoading={isHistoryLoading}
            error={historyError?.message}
            initialTable={selectedHistoryTable}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
