import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { enviarArquivos } from "@/lib/upload";
import { NovaCotacaoDialog } from "./NovaCotacaoDialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Truck, MapPin, Package, MessageSquare, ChevronLeft, ChevronRight, X, CheckCircle2, Eye, Copy, ClipboardCheck, Home, Trash2, Clock, User, Printer, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { montarRomaneioHtml, type CotacaoRomaneio } from "./romaneio";

/**
 * Abre o romaneio de despacho em uma nova janela e dispara a impressão.
 * As fotografias são intencionalmente omitidas do documento do motorista.
 */
function imprimirRomaneio(cotacoes: CotacaoRomaneio[]) {
  if (cotacoes.length === 0) {
    toast.error("Nenhum pedido pronto para despacho");
    return;
  }
  const html = montarRomaneioHtml(cotacoes);
  const janela = window.open("", "_blank", "width=900,height=700");
  if (!janela) {
    toast.error("Permita pop-ups para imprimir o romaneio");
    return;
  }
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 400);
  toast.success(`Romaneio gerado com ${cotacoes.length} pedido(s)`);
}

const STATUS_LABELS: Record<string, string> = {
  aberta: "Fila",
  cotando: "Em Cotação",
  selecao: "Seleção do Frete",
  cotada: "Pronto — Aguardando Envio",
  enviada: "Despachado",
  cancelada: "Cancelada",
};
const STATUS_COLORS: Record<string, string> = {
  aberta: "bg-slate-100 text-slate-700 border-slate-200",
  cotando: "bg-amber-50 text-amber-700 border-amber-200",
  selecao: "bg-violet-50 text-violet-700 border-violet-200",
  cotada: "bg-blue-50 text-blue-700 border-blue-200",
  enviada: "bg-green-50 text-green-700 border-green-200",
  cancelada: "bg-rose-50 text-rose-700 border-rose-200",
};
const STATUS_HEADER_COLORS: Record<string, string> = {
  aberta: "bg-slate-50 border-slate-200",
  cotando: "bg-amber-50 border-amber-200",
  selecao: "bg-violet-50 border-violet-200",
  cotada: "bg-blue-50 border-blue-200",
  enviada: "bg-green-50 border-green-200",
  cancelada: "bg-rose-50 border-rose-200",
};

// Fallbacks seguros: se o banco devolver um status inesperado, o card ainda renderiza
// em vez de quebrar a tela com "Cannot read properties of undefined".
const statusLabel = (s?: string | null) => STATUS_LABELS[s ?? ""] ?? (s || "Sem status");
const statusColor = (s?: string | null) =>
  STATUS_COLORS[s ?? ""] ?? "bg-slate-100 text-slate-700 border-slate-200";
const statusHeaderColor = (s?: string | null) =>
  STATUS_HEADER_COLORS[s ?? ""] ?? "bg-slate-50 border-slate-200";

type Cotacao = {
  id: number;
  osNumero: string | null;
  destinatarioNome: string | null;
  destinatarioCnpj: string | null;
  municipio: string | null;
  estado: string | null;
  pesoKg: string | null;
  valorNf: string | null;
  observacoes: string | null;
  observacaoGol: string | null;
  fotoUrl: string | null;
  empacotamentoId: number | null;
  dimensoesLargura: string | null;
  dimensoesAltura: string | null;
  dimensoesComprimento: string | null;
  cepDestino: string | null;
  quantidadeVolumes: number | null;
  volumesJson: string | null;
  fotosJson?: string | null;
  modalidadeFrete?: "cif" | "fob" | null;
  /** Dados próprios da OS (cada OS tem os seus) */
  osAprovacao?: string | null;
  osEntrega?: string | null;
  osVendedor?: string | null;
  status: string;
  solicitanteNome: string | null;
  empacotadores: string | null;
  createdAt: Date;
  updatedAt: Date;
  opcoes: Array<{
    id: number;
    transportadoraNome: string | null;
    valorFrete: string;
    prazoDias: number | null;
    tipoPrazo: string | null;
    selecionada: string;
  }>;
};

const CNPJ_REMETENTE = "11.073.532/0001-77"; // Letreiros Express

/** Lê os volumes gravados no card, com fallback para as dimensões soltas. */
function lerVolumes(cotacao: Cotacao): Array<{ largura?: any; comprimento?: any; altura?: any; peso?: any }> {
  let vols: any[] = [];
  try { vols = cotacao.volumesJson ? JSON.parse(cotacao.volumesJson) : []; } catch { vols = []; }
  if (Array.isArray(vols) && vols.length > 0) return vols;
  // Fallback: dimensões gravadas em colunas soltas (cards antigos)
  if (cotacao.dimensoesLargura || cotacao.dimensoesComprimento || cotacao.dimensoesAltura) {
    return [{
      largura: cotacao.dimensoesLargura,
      comprimento: cotacao.dimensoesComprimento,
      altura: cotacao.dimensoesAltura,
      peso: cotacao.pesoKg,
    }];
  }
  return [];
}

const numero = (v: any): number => {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Volume total cubado em cm³ a partir das dimensões em cm de cada volume. */
function volumeTotalCm3(vols: Array<{ largura?: any; comprimento?: any; altura?: any }>): number {
  return vols.reduce(
    (total, v) => total + numero(v.largura) * numero(v.comprimento) * numero(v.altura),
    0,
  );
}

/**
 * Formata a cubagem de forma legível: m³ só quando o número faz sentido,
 * senão cm³ (evita mostrar "0,000 m³" para caixas pequenas).
 */
function formatarCubagem(cm3: number): string {
  if (cm3 <= 0) return "—";
  const m3 = cm3 / 1_000_000;
  if (m3 >= 0.001) {
    return `${m3.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³`;
  }
  return `${cm3.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} cm³`;
}

const moedaBR = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Normaliza a data de entrega da OS para o formato dd/mm/aaaa.
 * Aceita: já formatado ("23/07/2026"), ISO ("2026-07-23"), string de Date
 * ("Thu Jul 23 2026 00:00:00 GMT+0000") e "X DIAS ÚTEIS" (convertido a partir
 * da data de aprovação quando informada).
 */
function formatarEntregaOS(entrega?: string | null, aprovacao?: string | null): string {
  if (!entrega) return "—";
  const texto = String(entrega).trim();

  // Já está em dd/mm/aaaa
  const jaBR = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (jaBR) return `${jaBR[1]}/${jaBR[2]}/${jaBR[3]}`;

  // "10 DIAS ÚTEIS" ou "1 DIA ÚTIL" → soma dias úteis à data de aprovação
  const diasUteis = texto.match(/(\d+)\s*DIAS?\s*(?:[ÚU]TEIS?|[ÚU]TIL)/i);
  if (diasUteis) {
    const base = aprovacao?.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (base) {
      const d = new Date(Number(base[3]), Number(base[2]) - 1, Number(base[1]));
      let restantes = Number(diasUteis[1]);
      while (restantes > 0) {
        d.setDate(d.getDate() + 1);
        const dia = d.getDay();
        if (dia !== 0 && dia !== 6) restantes--;
      }
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
    return texto;
  }

  // ISO (2026-07-23) ou string de Date
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const parsed = new Date(texto);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  }

  return texto;
}

/**
 * Bloco fixo do card — CEP, cidade, dimensões (L×C×A) e volume total.
 * Renderiza em todos os 5 estágios do Kanban, sempre expandido.
 */
export function DadosFixosCard({ cotacao }: { cotacao: Cotacao }) {
  const vols = lerVolumes(cotacao);
  const qtd = vols.length || cotacao.quantidadeVolumes || 0;
  const cm3 = volumeTotalCm3(vols);
  const pesoTotal = vols.reduce((t, v) => t + numero(v.peso), 0) || numero(cotacao.pesoKg);

  return (
    <div className="mt-1 rounded border border-slate-200 bg-white/70 px-1.5 py-1 text-[10.5px] leading-snug text-slate-700">
      <div className="grid grid-cols-2 gap-x-2 gap-y-px">
        <div className="truncate">
          <span className="text-slate-500">CEP: </span>
          <strong className="font-semibold">{cotacao.cepDestino || "—"}</strong>
        </div>
        <div className="truncate">
          <span className="text-slate-500">Cidade: </span>
          <strong className="font-semibold">
            {cotacao.municipio || "—"}{cotacao.estado ? `/${cotacao.estado}` : ""}
          </strong>
        </div>
        <div>
          <span className="text-slate-500">Volumes: </span>
          <strong className="font-semibold">{qtd || 1}</strong>
          {pesoTotal > 0 && <span className="text-slate-500"> · {moedaBR(pesoTotal)} kg</span>}
        </div>
        <div>
          <span className="text-slate-500">Vol. total: </span>
          <strong className="font-semibold">{formatarCubagem(cm3)}</strong>
        </div>
      </div>

      <div className="mt-0.5 border-t border-slate-200/70 pt-0.5">
        <span className="text-slate-500">Dimensões (L×C×A): </span>
        {vols.length === 0 ? (
          <strong className="font-semibold">—</strong>
        ) : (
          <span className="space-y-px">
            {vols.map((v, i) => (
              <span key={i} className="block">
                {vols.length > 1 && <span className="text-slate-500">Vol {i + 1}: </span>}
                <strong className="font-semibold">
                  {v.largura ?? "—"}×{v.comprimento ?? "—"}×{v.altura ?? "—"} cm
                </strong>
                {numero(v.peso) > 0 && <span className="text-slate-500"> · {v.peso} kg</span>}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Transportadoras adicionadas à cotação, exibidas dentro do card em todos os
 * estágios, cada uma com input manual de valor (R$) e de dias úteis.
 * Salva em cotacao_opcoes ao sair do campo (blur) ou ao pressionar Enter.
 */
export function OpcoesFreteNoCard({
  cotacaoId, opcoes, onRefresh,
}: {
  cotacaoId: number;
  opcoes: Cotacao["opcoes"];
  onRefresh: () => void;
}) {
  const utils = trpc.useUtils();
  const [rascunho, setRascunho] = useState<Record<number, { valor: string; dias: string }>>({});
  const salvar = trpc.cotacoesFrete.updateOpcao.useMutation({
    onSuccess: () => {
      utils.cotacoesFrete.get.invalidate({ id: cotacaoId });
      onRefresh();
    },
    onError: (e) => toast.error(`Erro ao salvar: ${e.message}`),
  });

  const valorDe = (op: Cotacao["opcoes"][number]) => {
    if (rascunho[op.id]?.valor !== undefined) return rascunho[op.id].valor;
    const n = numero(op.valorFrete);
    return n > 0 ? moedaBR(n) : "";
  };
  const diasDe = (op: Cotacao["opcoes"][number]) => {
    if (rascunho[op.id]?.dias !== undefined) return rascunho[op.id].dias;
    return op.prazoDias != null ? String(op.prazoDias) : "";
  };
  const editar = (id: number, campo: "valor" | "dias", texto: string) =>
    setRascunho(prev => ({
      ...prev,
      [id]: { valor: prev[id]?.valor ?? "", dias: prev[id]?.dias ?? "", [campo]: texto },
    }));

  const persistir = (op: Cotacao["opcoes"][number]) => {
    const valorTexto = rascunho[op.id]?.valor;
    const diasTexto = rascunho[op.id]?.dias;
    if (valorTexto === undefined && diasTexto === undefined) return;
    const valorFrete = valorTexto !== undefined && valorTexto !== ""
      ? String(numero(valorTexto))
      : (numero(op.valorFrete) > 0 ? String(numero(op.valorFrete)) : "0");
    const prazoDias = diasTexto !== undefined && diasTexto !== ""
      ? Math.max(0, Math.round(numero(diasTexto)))
      : (op.prazoDias ?? 0);
    salvar.mutate({ opcaoId: op.id, valorFrete, prazoDias, tipoPrazo: "uteis" });
  };

  return (
    <div
      className="mt-1.5 rounded border border-indigo-200 bg-indigo-50/50 px-1.5 py-1"
      // O card inteiro é um DialogTrigger: sem isso, digitar abriria o modal.
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      draggable={false}
      onDragStart={e => { e.preventDefault(); e.stopPropagation(); }}
    >
      <p className="text-[10px] font-semibold text-indigo-800 mb-0.5">
        Transportadoras selecionadas ({opcoes.length})
      </p>
      <div className="space-y-0.5">
        {opcoes.map(op => {
          const escolhida = op.selecionada === "sim";
          return (
            <div
              key={op.id}
              className={`flex items-center gap-1 rounded px-1 py-0.5 ${escolhida ? "bg-green-100/80 border border-green-300" : "bg-white/80 border border-slate-200"}`}
            >
              {escolhida && <CheckCircle2 className="w-2.5 h-2.5 shrink-0 text-green-600" />}
              <span className="flex-1 truncate text-[10.5px] font-medium text-slate-800" title={op.transportadoraNome ?? ""}>
                {op.transportadoraNome || "—"}
              </span>
              <span className="text-[10px] text-slate-500 shrink-0">R$</span>
              <input
                type="text"
                inputMode="decimal"
                value={valorDe(op)}
                onChange={e => editar(op.id, "valor", e.target.value)}
                onBlur={() => persistir(op)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); persistir(op); } }}
                placeholder="0,00"
                aria-label={`Valor do frete da ${op.transportadoraNome ?? "transportadora"}`}
                className="w-[62px] shrink-0 rounded border border-slate-300 bg-white px-1 py-px text-[10.5px] text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <input
                type="text"
                inputMode="numeric"
                value={diasDe(op)}
                onChange={e => editar(op.id, "dias", e.target.value)}
                onBlur={() => persistir(op)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); persistir(op); } }}
                placeholder="0"
                aria-label={`Dias úteis de entrega da ${op.transportadoraNome ?? "transportadora"}`}
                className="w-[34px] shrink-0 rounded border border-slate-300 bg-white px-1 py-px text-[10.5px] text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <span className="text-[9.5px] text-slate-500 shrink-0">d.ú.</span>
            </div>
          );
        })}
      </div>
      <p className="mt-0.5 text-[9px] text-slate-500">Preencha valor e dias úteis; salva ao sair do campo.</p>
    </div>
  );
}

function TemplateTransportadora({
  cotacao, novoCep, novaMunicipio, novoEstado, novoCnpj, novoValorNf
}: {
  cotacao: Cotacao;
  novoCep: string;
  novaMunicipio: string;
  novoEstado: string;
  novoCnpj: string;
  novoValorNf: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [tipoMaterial, setTipoMaterial] = useState("Letreiro / Sinalização");

  const cep = novoCep || cotacao.cepDestino || "(não informado)";
  const municipio = novaMunicipio || cotacao.municipio || "(não informado)";
  const estado = novoEstado || cotacao.estado || "";
  const cnpjDest = novoCnpj || cotacao.destinatarioCnpj || "(não informado)";
  const valorNf = novoValorNf || cotacao.valorNf || "(não informado)";
  const peso = cotacao.pesoKg ? `${cotacao.pesoKg} kg` : "(não informado)";
  const dimensoes = (cotacao.dimensoesLargura && cotacao.dimensoesAltura && cotacao.dimensoesComprimento)
    ? `${cotacao.dimensoesLargura} x ${cotacao.dimensoesAltura} x ${cotacao.dimensoesComprimento} cm`
    : "(não informado)";

  const enderecoCompleto = `${municipio}${estado ? `/${estado}` : ""} — CEP: ${cep}`;
  const template = [
    `*SOLICITAÇÃO DE FRETE — OS #${cotacao.osNumero || cotacao.id}*`,
    ``,
    `*Remetente:* Radra Indústria LTDA`,
    `*CNPJ Remetente:* ${CNPJ_REMETENTE}`,
    ``,
    `*Destinatário:* ${cotacao.destinatarioNome || "(não informado)"}`,
    `*CNPJ Destinatário:* ${cnpjDest}`,
    `*Endereço Destino:* ${enderecoCompleto}`,
    ``,
    `*Tipo de Material:* ${tipoMaterial || "Letreiro / Sinalização"}`,
    `*Dimensões:* ${dimensoes}`,
    `*Peso:* ${peso}`,
    `*Valor NF:* R$ ${valorNf}`,
    ``,
    `*Tipo de Frete:* FOB`,
    `*CNPJ Pagador:* ${CNPJ_REMETENTE}`,
  ].join("\n");

  const copiar = () => {
    navigator.clipboard.writeText(template).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
          <Truck className="w-3.5 h-3.5" /> Template para Transportadoras
        </p>
        <Button
          size="sm"
          variant={copiado ? "default" : "outline"}
          className={`h-7 px-3 text-xs gap-1.5 ${copiado ? "bg-green-600 hover:bg-green-600 text-white" : ""}`}
          onClick={copiar}
        >
          {copiado ? <><ClipboardCheck className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar Template</>}
        </Button>
      </div>
      <div className="mb-2">
        <label className="text-xs text-slate-500 font-medium">Tipo de Material</label>
        <input
          type="text"
          value={tipoMaterial}
          onChange={e => setTipoMaterial(e.target.value)}
          className="w-full mt-0.5 text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
          placeholder="Ex: Letreiro / Sinalização"
        />
      </div>
      <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono bg-white border border-slate-100 rounded p-2 leading-relaxed">{template}</pre>
    </div>
  );
}

// ── Versão compacta para exibir diretamente no card (sem modal) ──────────────
function CardTransportadorasPorCidade({
  municipio, estado, cotacaoId, onAdicionada, jaAdicionadas = 0, nomesJaAdicionados = [],
}: {
  municipio: string;
  estado: string;
  cotacaoId: number;
  onAdicionada: () => void;
  /** Quantas transportadoras já estão na cotação (limite total de 3). */
  jaAdicionadas?: number;
  /** Nomes já adicionados, para não sugerir de novo. */
  nomesJaAdicionados?: string[];
}) {
  const { data } = trpc.transportadoras.consultarCobertura.useQuery(
    { cidade: municipio, estado },
    { staleTime: 5 * 60_000, enabled: !!municipio },
  );
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const addOpcao = trpc.cotacoesFrete.addOpcao.useMutation({
    onSuccess: () => { setSelecionadas([]); onAdicionada(); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const LIMITE = 3;
  const vagas = Math.max(0, LIMITE - jaAdicionadas);
  const normaliza = (s: string) => s.trim().toLowerCase();
  const jaTem = new Set(nomesJaAdicionados.map(normaliza));
  const atende = (data?.atende ?? []).filter((t: any) => !jaTem.has(normaliza(String(t.nome ?? ""))));

  // Limite atingido: não faz sentido continuar oferecendo sugestões.
  if (vagas === 0) return null;
  if (atende.length === 0) return null;

  const toggle = (id: number) =>
    setSelecionadas(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= vagas) {
        toast.error(`Máximo de ${LIMITE} transportadoras por cotação`);
        return prev;
      }
      return [...prev, id];
    });

  const confirmar = (e: React.MouseEvent) => {
    e.stopPropagation();
    const escolhidas = atende.filter((t: any) => selecionadas.includes(t.id)).slice(0, vagas);
    for (const t of escolhidas) {
      addOpcao.mutate({ cotacaoId, transportadoraId: t.id, transportadoraNome: t.nome, valorFrete: "0", tipoPrazo: "uteis" });
    }
    toast.success(`${escolhidas.length} transportadora(s) adicionada(s)`);
  };

  return (
    <div className="mt-2 pt-2 border-t border-amber-200" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
          <Truck className="w-3 h-3" /> {atende.length} atendem {municipio}/{estado} · {vagas} vaga(s)
        </p>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            setSelecionadas(prev => prev.length > 0 ? [] : atende.slice(0, vagas).map((t: any) => t.id));
          }}
          className="text-[10px] font-medium text-amber-700 underline hover:text-amber-900 shrink-0"
        >
          {selecionadas.length > 0 ? "Limpar" : `Selecionar ${vagas}`}
        </button>
      </div>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {atende.map((t: any) => (
          <button
            key={t.id}
            type="button"
            onClick={e => { e.stopPropagation(); toggle(t.id); }}
            className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${
              selecionadas.includes(t.id)
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-amber-700 border-amber-300 hover:bg-amber-50"
            }`}
          >
            {t.nome}
          </button>
        ))}
      </div>
      {selecionadas.length > 0 && (
        <button
          type="button"
          onClick={confirmar}
          disabled={addOpcao.isPending}
          className="text-xs bg-amber-600 text-white px-2.5 py-1 rounded-md hover:bg-amber-700 disabled:opacity-50"
        >
          + Adicionar {selecionadas.length} selecionada(s)
        </button>
      )}
    </div>
  );
}

function CotacaoCard({ cotacao, onRefresh, isVendedor }: { cotacao: Cotacao; onRefresh: () => void; isVendedor?: boolean }) {
  const [open, setOpen] = useState(false);
  const [novaOpcao, setNovaOpcao] = useState({ transportadoraNome: "", transportadoraId: undefined as number | undefined, valorFrete: "", prazoDias: "", tipoPrazo: "uteis" as "uteis" | "corridos" });
  const [novaOpcaoAC, setNovaOpcaoAC] = useState(false); // autocomplete aberto
  const [mostrarAddManual, setMostrarAddManual] = useState(false); // adição manual de transportadora
  // Edição inline de valor/prazo de uma opção já adicionada
  const [editandoOpcao, setEditandoOpcao] = useState<number | null>(null);
  const [edicaoOpcao, setEdicaoOpcao] = useState({ valorFrete: "", prazoDias: "", tipoPrazo: "uteis" as "uteis" | "corridos" });
  const [horarioDecisaoMs, setHorarioDecisaoMs] = useState("");
  const [comentario, setComentario] = useState("");
  const [novaObs, setNovaObs] = useState(cotacao.observacoes ?? "");
  const [novaObsGol, setNovaObsGol] = useState(cotacao.observacaoGol ?? "");
  const [editandoDestino, setEditandoDestino] = useState(false);
  const [novaMunicipio, setNovaMunicipio] = useState(cotacao.municipio ?? "");
  const [novoEstado, setNovoEstado] = useState(cotacao.estado ?? "");
  const [buscaCidade, setBuscaCidade] = useState("");
  const [novoCnpj, setNovoCnpj] = useState(cotacao.destinatarioCnpj ?? "");
  const [novoCep, setNovoCep] = useState(cotacao.cepDestino ?? "");
  const [novoValorNf, setNovoValorNf] = useState(cotacao.valorNf ?? "");
  const [autoFetching, setAutoFetching] = useState(false);
  // Verificar se campos críticos estão faltando (card veio do Empacotamento)
  const camposFaltantes = cotacao.empacotamentoId && (
    !cotacao.destinatarioCnpj || !cotacao.cepDestino ||
    cotacao.municipio === "(a preencher)" || !cotacao.municipio ||
    !cotacao.valorNf || !cotacao.solicitanteNome
  );
  // CNPJ faltando é condição separada — deve buscar sempre que vazio, mesmo que outros campos estejam preenchidos
  const cnpjFaltando = !!(cotacao.empacotamentoId && !cotacao.destinatarioCnpj);
  // Auto-fetch sempre que o card do empacotamento for aberto e o CNPJ ainda não estiver preenchido
  // Auto-fetch quando: modal aberto + tem número de OS + CNPJ está ausente ou vazio
  const deveAutoFetch = open && !!(cotacao.osNumero) && !(cotacao.destinatarioCnpj?.trim());
  const utils = trpc.useUtils();

  // Auto-preencher dados ao abrir o modal quando campos estão faltando
  // Prioridade: Mub (pelo número da OS) → BrasilAPI (pelo CNPJ)
  const buscarDadosQuery = trpc.cotacoesFrete.buscarDadosOs.useQuery(
    {
      numeroOs: cotacao.osNumero ?? undefined,
      cnpj: cotacao.destinatarioCnpj ?? undefined,
    },
    {
      enabled: deveAutoFetch,
      staleTime: 30_000,
    }
  );
  useEffect(() => {
    if (!open || (!camposFaltantes && !cnpjFaltando && cotacao.destinatarioCnpj?.trim())) return;
    if (!buscarDadosQuery.data) return;
    const d = buscarDadosQuery.data;
    const cepFmt = d.cep ? d.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : "";
    if (cepFmt) setNovoCep(cepFmt);
    if (d.cidade) setNovaMunicipio(d.cidade);
    if (d.estado) setNovoEstado(d.estado);
    if (d.cnpj) setNovoCnpj(d.cnpj);
    // Preencher valor da NF e nome do vendedor vindos do Mubisys
    if (d.valorNf && !cotacao.valorNf) setNovoValorNf(d.valorNf);
    const fonte = d.fonte === "mub" ? "Mub" : "Receita Federal";
    updateObs.mutate({
      id: cotacao.id,
      destinatarioCnpj: d.cnpj || cotacao.destinatarioCnpj || "",
      cepDestino: cepFmt || cotacao.cepDestino || "",
      municipio: d.cidade || cotacao.municipio || "",
      estado: d.estado || cotacao.estado || "",
      // Preencher valorNf e solicitanteNome automaticamente via Mubisys
      ...(d.valorNf && !cotacao.valorNf ? { valorNf: d.valorNf } : {}),
      ...(d.vendedor && !cotacao.solicitanteNome ? { solicitanteNome: d.vendedor } : {}),
      // Salvar dataEntregaPrevista vinda do Mubisys
      ...(d.dataEntregaPrevista ? {} : {}),
    }, { onSuccess: () => { onRefresh(); toast.success(`Dados preenchidos automaticamente via ${fonte}!`); } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscarDadosQuery.data]);

  const { user: cardUser } = useAuth();
  // Admin/logistica podem excluir em qualquer estágio; vendedor pode excluir nos estágios 1, 2 e 3
  const podeExcluir = ["admin", "supervisor", "master", "logistica"].includes(cardUser?.role ?? "")
    || (cardUser?.role === "vendas" && cotacao.status !== "concluido");
  const { data: detalhe } = trpc.cotacoesFrete.get.useQuery({ id: cotacao.id }, { enabled: open });
  const updateStatus = trpc.cotacoesFrete.updateStatus.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Status atualizado"); },
  });
  const updateObs = trpc.cotacoesFrete.update.useMutation({
    onSuccess: () => { utils.cotacoesFrete.get.invalidate({ id: cotacao.id }); onRefresh(); toast.success("Observações salvas"); },
  });
  // Autocomplete de transportadoras
  const { data: transportadorasAC } = trpc.transportadoras.list.useQuery(
    { search: novaOpcao.transportadoraNome, apenasAtivas: true },
    { enabled: novaOpcao.transportadoraNome.length >= 2 && novaOpcaoAC, staleTime: 60_000 }
  );
  const addOpcao = trpc.cotacoesFrete.addOpcao.useMutation({
    onSuccess: () => { utils.cotacoesFrete.get.invalidate({ id: cotacao.id }); onRefresh(); setNovaOpcao({ transportadoraNome: "", transportadoraId: undefined, valorFrete: "", prazoDias: "", tipoPrazo: "uteis" }); setNovaOpcaoAC(false); },
  });
  const updateOpcao = trpc.cotacoesFrete.updateOpcao.useMutation({
    onSuccess: () => {
      utils.cotacoesFrete.get.invalidate({ id: cotacao.id });
      onRefresh();
      setEditandoOpcao(null);
      setEdicaoOpcao({ valorFrete: "", prazoDias: "", tipoPrazo: "uteis" });
      toast.success("Cotação da transportadora salva");
    },
    onError: (e) => toast.error(`Erro ao salvar: ${e.message}`),
  });
  const removeOpcao = trpc.cotacoesFrete.removeOpcao.useMutation({
    onSuccess: () => {
      utils.cotacoesFrete.get.invalidate({ id: cotacao.id });
      onRefresh();
      toast.success("Transportadora removida da cotação");
    },
    onError: (e) => toast.error(`Erro ao remover: ${e.message}`),
  });
  // ── Modalidade de frete (CIF/FOB) ─────────────────────────────────────
  const updateModalidade = trpc.cotacoesFrete.update.useMutation({
    onSuccess: () => {
      utils.cotacoesFrete.get.invalidate({ id: cotacao.id });
      onRefresh();
      toast.success("Modalidade de frete atualizada");
    },
    onError: (e) => toast.error(`Erro ao salvar modalidade: ${e.message}`),
  });
  // ── Fotografias anexadas ──────────────────────────────────────────────
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [fotosLocais, setFotosLocais] = useState<string[] | null>(null);
  const fotos: string[] = (() => {
    if (fotosLocais) return fotosLocais;
    try { return cotacao.fotosJson ? JSON.parse(cotacao.fotosJson) : []; } catch { return []; }
  })();
  const uploadFotos = trpc.cotacoesFrete.uploadFotos.useMutation({
    onSuccess: (res: any) => {
      setFotosLocais(res.fotos ?? []);
      setEnviandoFoto(false);
      utils.cotacoesFrete.get.invalidate({ id: cotacao.id });
      onRefresh();
      toast.success("Fotografia(s) anexada(s)");
    },
    onError: (e) => { setEnviandoFoto(false); toast.error(`Erro ao anexar: ${e.message}`); },
  });
  const removerFotoMut = trpc.cotacoesFrete.removerFoto.useMutation({
    onSuccess: (res: any) => {
      setFotosLocais(res.fotos ?? []);
      utils.cotacoesFrete.get.invalidate({ id: cotacao.id });
      onRefresh();
      toast.success("Fotografia removida");
    },
    onError: (e) => toast.error(`Erro ao remover foto: ${e.message}`),
  });
  const anexarFotos = async (arquivos: File[]) => {
    setEnviandoFoto(true);
    try {
      const enviadas = await enviarArquivos("imagem", arquivos.slice(0, 10));
      const payload = enviadas.map(({ fileName, url, key, mimeType }) => ({ nome: fileName, url, key, tipo: mimeType }));
      uploadFotos.mutate({ id: cotacao.id, fotos: payload });
    } catch (err: any) {
      setEnviandoFoto(false);
      toast.error(err?.message ?? "Falha ao preparar as fotos");
    }
  };
  const removerFoto = (indice: number) => removerFotoMut.mutate({ id: cotacao.id, indice });
  const updateHorarioDecisao = trpc.cotacoesFrete.update.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Horário de decisão salvo!"); },
  });
  const selecionarOpcao = trpc.cotacoesFrete.selecionarOpcao.useMutation({
    onSuccess: () => { utils.cotacoesFrete.get.invalidate({ id: cotacao.id }); onRefresh(); toast.success("Opção selecionada! Cotação movida para Concluído."); },
  });
  const addComentario = trpc.cotacoesFrete.addComentario.useMutation({
    onSuccess: () => { utils.cotacoesFrete.get.invalidate({ id: cotacao.id }); setComentario(""); },
  });
  const deleteCotacao = trpc.cotacoesFrete.delete.useMutation({
    onSuccess: () => {
      setOpen(false);
      utils.cotacoesFrete.list.invalidate();
      onRefresh();
      toast.success("Cotação excluída");
    },
    onError: (err) => toast.error(`Erro ao excluir: ${err.message}`),
  });

  const nextStatus: Record<string, string> = { aberta: "cotando", cotando: "selecao", selecao: "cotada", cotada: "enviada" };
  const nextLabel: Record<string, string> = { aberta: "Iniciar Cotação", cotando: "Ir para Seleção do Frete", selecao: "Marcar Pronto", cotada: "Despachar" };
  const prevStatus: Record<string, string> = { cotando: "aberta", selecao: "cotando", cotada: "selecao", enviada: "cotada" };
  const prevLabel: Record<string, string> = { cotando: "← Voltar para Fila", selecao: "← Voltar para Em Cotação", cotada: "← Voltar para Seleção do Frete", enviada: "← Voltar para Pronto" };

  // Opção selecionada (transportadora escolhida)
  const opcaoSelecionada = cotacao.opcoes.find(o => o.selecionada === "sim");

  return (
    <div className="relative group">
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setNovaObs(cotacao.observacoes ?? ""); }}>
      <DialogTrigger asChild>
        <div className={`rounded-lg border p-2.5 cursor-pointer hover:shadow-md transition-shadow ${statusColor(cotacao.status)} ${camposFaltantes ? "ring-2 ring-amber-400" : ""}`}>
          {/* Alerta de campos faltantes no card */}
          {camposFaltantes && (
            <div className="flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded mb-1.5 font-medium">
              ⚠️ Preencher dados
            </div>
          )}

          {/* ── Cabeçalho: OS + modalidade + status ─────────────────────── */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {cotacao.osNumero
                ? <span className="text-xs font-bold text-indigo-700">OS #{cotacao.osNumero}</span>
                : <span className="text-xs font-bold text-slate-500">#{cotacao.id}</span>}
              {cotacao.modalidadeFrete && (
                <span className={`text-[9px] font-bold px-1 py-px rounded ${cotacao.modalidadeFrete === "cif" ? "bg-emerald-600 text-white" : "bg-orange-500 text-white"}`}>
                  {cotacao.modalidadeFrete.toUpperCase()}
                </span>
              )}
            </div>
            <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{statusLabel(cotacao.status).split(" ")[0]}</Badge>
          </div>

          {/* ── Destinatário e destino (sempre visíveis) ────────────────── */}
          <p className="font-medium text-[13px] leading-tight truncate mt-1" title={cotacao.destinatarioNome ?? ""}>
            {cotacao.destinatarioNome || "Sem destinatário"}
          </p>
          <p className="text-[11px] opacity-75 flex items-center gap-1 leading-tight">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            {cotacao.municipio || "—"}/{cotacao.estado || "—"}
            {cotacao.cepDestino && <span className="opacity-80">· {cotacao.cepDestino}</span>}
          </p>
          {cotacao.destinatarioCnpj && (
            <p className="text-[10.5px] opacity-70 leading-tight">CNPJ {cotacao.destinatarioCnpj}</p>
          )}

          {/* ── Dados da OS: aprovação, entrega e vendedor (todos os estágios) ── */}
          {(cotacao.osAprovacao || cotacao.osEntrega || cotacao.osVendedor) && (
            <div className="mt-1 rounded border border-slate-200 bg-slate-50/80 px-1.5 py-1 text-[10px] leading-snug text-slate-600 space-y-px">
              {cotacao.osAprovacao && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                  <span className="text-slate-500">Aprovação:</span>
                  <strong className="text-slate-700 font-semibold">{cotacao.osAprovacao}</strong>
                </div>
              )}
              {cotacao.osEntrega && (
                <div className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                  <span className="text-slate-500">Entrega:</span>
                  <strong className="text-rose-700 font-semibold">
                    <span title={cotacao.osEntrega}>
                      {formatarEntregaOS(cotacao.osEntrega, cotacao.osAprovacao)}
                    </span>
                  </strong>
                </div>
              )}
              {cotacao.osVendedor && (
                <div className="flex items-center gap-1 truncate">
                  <User className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                  <span className="text-slate-500">Vendedor:</span>
                  <strong className="text-slate-700 font-semibold truncate">{cotacao.osVendedor}</strong>
                </div>
              )}
            </div>
          )}

          {/* ── Bloco fixo obrigatório: CEP, cidade, dimensões e volume total ──
               Visível em TODOS os estágios, sem cliques nem expansões. */}
          <DadosFixosCard cotacao={cotacao} />

          {/* ── Fotos anexadas (miniaturas) ─────────────────────────────── */}
          {(() => {
            let fotos: string[] = [];
            try { fotos = cotacao.fotosJson ? JSON.parse(cotacao.fotosJson) : []; } catch { fotos = []; }
            if (cotacao.fotoUrl && !fotos.includes(cotacao.fotoUrl)) fotos = [cotacao.fotoUrl, ...fotos];
            if (fotos.length === 0) return null;
            return (
              <div className="mt-1 flex items-center gap-1">
                {fotos.slice(0, 4).map((url, i) => (
                  <img key={i} src={url} alt={`foto ${i + 1}`} className="w-7 h-7 rounded object-cover border border-slate-200" />
                ))}
                {fotos.length > 4 && <span className="text-[10px] text-slate-500">+{fotos.length - 4}</span>}
              </div>
            );
          })()}

          {/* ── Transportadoras selecionadas com valor (R$) e dias úteis ──
               Editáveis direto no card, em TODOS os estágios. */}
          {cotacao.opcoes.length > 0 && (
            <OpcoesFreteNoCard
              cotacaoId={cotacao.id}
              opcoes={cotacao.opcoes as any}
              onRefresh={onRefresh}
            />
          )}

          {/* ── Sugestões por cidade — nos estágios em que ainda se cota ──
               Some quando as 3 vagas estão preenchidas ou após o despacho. */}
          {(cotacao.status === "cotando" || cotacao.status === "selecao") && cotacao.municipio && (
            <CardTransportadorasPorCidade
              municipio={cotacao.municipio}
              estado={cotacao.estado ?? ""}
              cotacaoId={cotacao.id}
              onAdicionada={onRefresh}
              jaAdicionadas={cotacao.opcoes.length}
              nomesJaAdicionados={cotacao.opcoes.map(o => o.transportadoraNome ?? "")}
            />
          )}

          {/* ── Rodapé enxuto: solicitante + horário ────────────────────── */}
          <div className="mt-1.5 pt-1 border-t border-slate-200/70 flex items-center justify-between gap-1 text-[10px] text-slate-500">
            <span className="truncate">{cotacao.solicitanteNome || "—"}</span>
            {cotacao.createdAt && (
              <span className="shrink-0">
                {new Date(cotacao.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            {cotacao.osNumero ? `OS #${cotacao.osNumero}` : `Cotação #${cotacao.id}`} — {cotacao.destinatarioNome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dados da OS */}
          {(cotacao.osAprovacao || cotacao.osEntrega || cotacao.osVendedor) && (
            <div className="grid grid-cols-2 gap-3 text-sm bg-blue-50 rounded-lg p-3 border border-blue-100">
              {cotacao.osAprovacao && <div><span className="text-muted-foreground">Aprovação:</span> <strong>{cotacao.osAprovacao}</strong></div>}
              {cotacao.osEntrega && <div><span className="text-muted-foreground">Entrega:</span> <strong>{formatarEntregaOS(cotacao.osEntrega, cotacao.osAprovacao)}</strong></div>}
              {cotacao.osVendedor && <div className="col-span-2"><span className="text-muted-foreground">Vendedor:</span> <strong>{cotacao.osVendedor}</strong></div>}
            </div>
          )}

          {/* ── Mesmo bloco fixo do card minimizado: CEP, cidade, volumes,
               volume total e dimensões (L×C×A) por volume ─────────────── */}
          <div className="text-[13px]">
            <DadosFixosCard cotacao={cotacao} />
          </div>

          {/* ── Mesmas transportadoras do card, com inputs de R$ e dias úteis ── */}
          {cotacao.opcoes.length > 0 && (
            <OpcoesFreteNoCard
              cotacaoId={cotacao.id}
              opcoes={cotacao.opcoes as any}
              onRefresh={onRefresh}
            />
          )}

          {/* ── Sugestões por cidade, iguais às do card ─────────────────── */}
          {(cotacao.status === "cotando" || cotacao.status === "selecao") && cotacao.municipio && (
            <CardTransportadorasPorCidade
              municipio={cotacao.municipio}
              estado={cotacao.estado ?? ""}
              cotacaoId={cotacao.id}
              onAdicionada={onRefresh}
              jaAdicionadas={cotacao.opcoes.length}
              nomesJaAdicionados={cotacao.opcoes.map(o => o.transportadoraNome ?? "")}
            />
          )}

          {/* Dados */}
          <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 rounded-lg p-3">
            <div className="col-span-2 flex items-center justify-between">
              <div>
                <span className="text-muted-foreground">Destino:</span>{" "}
                {editandoDestino ? null : <strong>{cotacao.municipio}/{cotacao.estado}</strong>}
              </div>
              {!editandoDestino && (
                <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => { setEditandoDestino(true); setNovaMunicipio(cotacao.municipio ?? ""); setNovoEstado(cotacao.estado ?? ""); setBuscaCidade(""); }}>
                  Editar destino
                </Button>
              )}
            </div>
            {editandoDestino && (
              <div className="col-span-2 space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Buscar cidade</Label>
                    <Input
                      value={buscaCidade}
                      onChange={e => {
                        setBuscaCidade(e.target.value);
                        const parts = e.target.value.split("/");
                        if (parts.length === 2) {
                          setNovaMunicipio(parts[0].trim());
                          setNovoEstado(parts[1].trim().toUpperCase().slice(0, 2));
                        } else {
                          setNovaMunicipio(e.target.value);
                        }
                      }}
                      placeholder="Ex: São Paulo/SP ou Belo Horizonte/MG"
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">Digite cidade/UF (ex: Curitiba/PR)</p>
                  </div>
                  <div className="w-16">
                    <Label className="text-xs">UF</Label>
                    <Input value={novoEstado} onChange={e => setNovoEstado(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className="text-sm" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" disabled={!novaMunicipio || !novoEstado}
                    onClick={() => updateObs.mutate({ id: cotacao.id, municipio: novaMunicipio, estado: novoEstado }, {
                      onSuccess: () => { setEditandoDestino(false); toast.success("Destino atualizado!"); }
                    })}>
                    Salvar Destino
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditandoDestino(false)}>Cancelar</Button>
                </div>
              </div>
            )}
            {cotacao.pesoKg && !cotacao.empacotamentoId && <div><span className="text-muted-foreground">Peso:</span> <strong>{cotacao.pesoKg} kg</strong></div>}
            {cotacao.valorNf && <div><span className="text-muted-foreground">Valor NF:</span> <strong>R$ {cotacao.valorNf}</strong></div>}
            {detalhe?.cepDestino && <div><span className="text-muted-foreground">CEP:</span> <strong>{detalhe.cepDestino}</strong></div>}
            {cotacao.destinatarioCnpj && <div className="col-span-2"><span className="text-muted-foreground">CNPJ:</span> <strong>{cotacao.destinatarioCnpj}</strong></div>}
            {cotacao.quantidadeVolumes != null && <div><span className="text-muted-foreground">Volumes:</span> <strong>{cotacao.quantidadeVolumes}</strong></div>}
            {cotacao.dimensoesLargura && cotacao.dimensoesAltura && cotacao.dimensoesComprimento && (
              <div><span className="text-muted-foreground">Dimensões:</span> <strong>{cotacao.dimensoesLargura}×{cotacao.dimensoesAltura}×{cotacao.dimensoesComprimento} cm</strong></div>
            )}
            <div><span className="text-muted-foreground">Solicitante:</span> <strong>{cotacao.solicitanteNome || "—"}</strong></div>
            {cotacao.empacotadores && (
              <div className="col-span-2"><span className="text-muted-foreground">Empacotadores:</span> <strong>{cotacao.empacotadores}</strong></div>
            )}
            <div><span className="text-muted-foreground">Status:</span> <Badge className={`text-xs ${statusColor(cotacao.status)}`}>{statusLabel(cotacao.status)}</Badge></div>
          </div>

          {/* ── Modalidade de frete: CIF ou FOB ──────────────────────────── */}
          <div className="border rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">Modalidade de Frete</p>
            <div className="flex items-center gap-2">
              {([
                { valor: "cif" as const, titulo: "CIF", desc: "Remetente paga" },
                { valor: "fob" as const, titulo: "FOB", desc: "Destinatário paga" },
              ]).map(op => {
                const ativo = (cotacao.modalidadeFrete ?? null) === op.valor;
                return (
                  <button
                    key={op.valor}
                    onClick={() => updateModalidade.mutate({ id: cotacao.id, modalidadeFrete: ativo ? null : op.valor })}
                    disabled={updateModalidade.isPending}
                    className={`flex-1 rounded-md border px-3 py-2 text-left transition-colors disabled:opacity-60 ${
                      ativo
                        ? op.valor === "cif"
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-orange-400 bg-orange-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span className={`block text-sm font-bold ${ativo ? (op.valor === "cif" ? "text-emerald-700" : "text-orange-700") : "text-slate-600"}`}>
                      {op.titulo}
                    </span>
                    <span className="block text-[11px] text-slate-500">{op.desc}</span>
                  </button>
                );
              })}
            </div>
            {!cotacao.modalidadeFrete && (
              <p className="text-[11px] text-slate-400 mt-1.5">Nenhuma modalidade definida. Clique para selecionar.</p>
            )}
          </div>

          {/* ── Fotografias anexadas ─────────────────────────────────────── */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-700">Fotografias</p>
              <label className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer">
                {enviandoFoto ? "Enviando..." : "+ Anexar fotos"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={enviandoFoto}
                  onChange={e => {
                    const arquivos = Array.from(e.target.files ?? []);
                    if (arquivos.length > 0) anexarFotos(arquivos);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            {fotos.length === 0 ? (
              <p className="text-[11px] text-slate-400">Nenhuma fotografia anexada.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {fotos.map((url, i) => (
                  <div key={i} className="relative group/foto">
                    <a href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={`foto ${i + 1}`} className="w-full h-20 object-cover rounded border border-slate-200" />
                    </a>
                    <button
                      onClick={() => removerFoto(i)}
                      className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full w-5 h-5 text-[10px] leading-none opacity-0 group-hover/foto:opacity-100 transition-opacity"
                      title="Remover foto"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dados da expedição (integração automática com Empacotamento) */}
          {cotacao.empacotamentoId && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <p className="text-xs font-bold text-indigo-700 mb-2 flex items-center gap-1">
                <Package className="w-3.5 h-3.5" /> Dados preenchidos pela Expedição (OS #{cotacao.osNumero})
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {cotacao.fotoUrl && (
                  <div className="col-span-2">
                    <img src={cotacao.fotoUrl} alt="foto" className="w-full rounded-lg max-h-40 object-contain bg-white border" />
                  </div>
                )}
                {(cotacao.dimensoesLargura || cotacao.dimensoesAltura || cotacao.dimensoesComprimento) && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Dimensões:</span>{" "}
                    <strong>{cotacao.dimensoesLargura} × {cotacao.dimensoesAltura} × {cotacao.dimensoesComprimento} cm</strong>
                  </div>
                )}
                {cotacao.pesoKg && (
                  <div><span className="text-muted-foreground">Peso:</span> <strong>{cotacao.pesoKg} kg</strong></div>
                )}
              </div>
            </div>
          )}
          {/* ── Botão de copiar template para transportadoras ── */}
          {cotacao.empacotamentoId && (
            <TemplateTransportadora cotacao={cotacao} novoCep={novoCep} novaMunicipio={novaMunicipio} novoEstado={novoEstado} novoCnpj={novoCnpj} novoValorNf={novoValorNf} />
          )}

          {/* ── Alerta de campos faltantes para cards vindos do Empacotamento ── */}
          {camposFaltantes && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-3">
              <p className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                ⚠️ Campos obrigatórios para cotação de frete
              </p>
              <p className="text-xs text-amber-700">
                Este card veio da Expedição. Preencha os dados abaixo para desbloquear a cotação de frete.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs font-semibold">CNPJ do Destinatário</Label>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Input
                      value={novoCnpj || (buscarDadosQuery.isFetching ? "Buscando..." : "")}
                      readOnly
                      placeholder="Buscando automaticamente via Mubisys..."
                      className="text-sm h-8 bg-muted cursor-default"
                    />
                    {buscarDadosQuery.isFetching && (
                      <span className="text-xs text-muted-foreground animate-pulse">⏳</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">CNPJ preenchido automaticamente via Mubisys ao abrir o card.</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold">CEP de Destino</Label>
                  <Input
                    value={novoCep}
                    onChange={e => setNovoCep(e.target.value)}
                    placeholder="00000-000"
                    className="text-sm h-8 mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Valor da NF (R$)</Label>
                  <Input
                    value={novoValorNf}
                    onChange={e => setNovoValorNf(e.target.value)}
                    placeholder="0,00"
                    className="text-sm h-8 mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Município</Label>
                  <Input
                    value={novaMunicipio}
                    onChange={e => setNovaMunicipio(e.target.value)}
                    placeholder="Cidade"
                    className="text-sm h-8 mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">UF</Label>
                  <Input
                    value={novoEstado}
                    onChange={e => setNovoEstado(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="SP"
                    maxLength={2}
                    className="text-sm h-8 mt-0.5"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={!novoCep || !novaMunicipio || !novoEstado || updateObs.isPending}
                onClick={() => updateObs.mutate({
                  id: cotacao.id,
                  destinatarioCnpj: novoCnpj || undefined,
                  cepDestino: novoCep,
                  municipio: novaMunicipio,
                  estado: novoEstado,
                  valorNf: novoValorNf || undefined,
                }, { onSuccess: () => toast.success("Dados salvos! Card pronto para cotação.") })}
              >
                Salvar Dados e Desbloquear Cotação
              </Button>
            </div>
          )}
          {/* Foto do empacotamento no modal (quando não há integração completa) */}
          {cotacao.fotoUrl && !cotacao.empacotamentoId && (
            <div>
              <p className="text-xs font-semibold text-indigo-700 mb-1">Foto do Empacotamento</p>
              <img src={cotacao.fotoUrl} alt="foto" className="w-full rounded-lg max-h-48 object-contain bg-gray-50" />
            </div>
          )}

          {/* Bug 1 fix: Observações compartilhadas — editável por todos */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1">
              <Eye className="w-4 h-4" />Observações (compartilhadas entre vendedor e logística)
            </Label>
            <Textarea
              value={novaObs}
              onChange={e => setNovaObs(e.target.value)}
              placeholder="Dimensões, fragilidade, urgência, instruções especiais..."
              rows={3}
              className="text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-1"
              disabled={novaObs === (cotacao.observacoes ?? "")}
              onClick={() => updateObs.mutate({ id: cotacao.id, observacoes: novaObs })}
            >
              Salvar Observações
            </Button>
          </div>

          {/* Campo de observação especial para transportadora Gol — visível em todos os estágios */}
          {(opcaoSelecionada?.transportadoraNome?.toLowerCase().includes("gol") ||
            cotacao.opcoes.some(o => o.transportadoraNome?.toLowerCase().includes("gol")) ||
            cotacao.observacaoGol) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <Label className="text-sm font-semibold text-amber-800 flex items-center gap-1 mb-1">
                ✈️ Observação Gol (visível em todos os estágios)
              </Label>
              <Textarea
                value={novaObsGol}
                onChange={e => setNovaObsGol(e.target.value)}
                placeholder="Ex: Retirar no aeroporto do Galeão, voo GLA1234..."
                rows={2}
                className="text-sm bg-white"
              />
              <Button
                size="sm"
                variant="outline"
                className="mt-1 border-amber-300 text-amber-800 hover:bg-amber-100"
                disabled={novaObsGol === (cotacao.observacaoGol ?? "")}
                onClick={() => updateObs.mutate({ id: cotacao.id, observacaoGol: novaObsGol })}
              >
                Salvar Obs. Gol
              </Button>
              {cotacao.observacaoGol && (
                <p className="text-xs text-amber-700 mt-1 font-medium">⚠️ {cotacao.observacaoGol}</p>
              )}
            </div>
          )}

          {/* Ações de status */}
          {!isVendedor && (
            <div className="flex items-center gap-2 flex-wrap">
              {prevStatus[cotacao.status] && (
                <Button size="sm" variant="outline" onClick={() => { if (confirm(`Retroceder para "${prevLabel[cotacao.status].replace("← Voltar para ", "")}"?`)) updateStatus.mutate({ id: cotacao.id, status: prevStatus[cotacao.status] as any }); }}>
                  <ChevronLeft className="w-3 h-3 mr-1" />
                  {prevLabel[cotacao.status]}
                </Button>
              )}
              {nextStatus[cotacao.status] && (
                <Button size="sm" onClick={() => updateStatus.mutate({ id: cotacao.id, status: nextStatus[cotacao.status] as any })}>
                  <ChevronRight className="w-3 h-3 mr-1" />
                  {nextLabel[cotacao.status]}
                </Button>
              )}
            </div>
          )}

          {/* Bug 2 fix: Opções de frete com transportadora sempre visível */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Opções de Frete</h3>
            {/* Mod 3: Transportadoras que atendem a cidade — apenas no estágio "cotando" */}
            {cotacao.status === "cotando" && cotacao.municipio && (
              <TransportadorasPorCidade
                municipio={cotacao.municipio}
                estado={cotacao.estado ?? ""}
                cotacaoId={cotacao.id}
                onAdicionada={() => utils.cotacoesFrete.get.invalidate({ id: cotacao.id })}
              />
            )}
            {detalhe?.opcoes && detalhe.opcoes.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nenhuma opção adicionada ainda.</p>
            )}
            {detalhe?.opcoes?.map((op: any) => {
              const pctFrete = (cotacao.valorNf && parseFloat(cotacao.valorNf) > 0)
                ? ((parseFloat(String(op.valorFrete).replace(/\./g,"").replace(",",".")) / parseFloat(String(cotacao.valorNf).replace(/\./g,"").replace(",","."))) * 100).toFixed(1)
                : null;
              const selecionada = op.selecionada === 1 || op.selecionada === "1" || op.selecionada === true || op.selecionada === "sim";
              const valorNum = op.valorFrete == null ? 0 : parseFloat(String(op.valorFrete).replace(",", "."));
              return (
              <div key={op.id} className={`flex items-center justify-between p-1.5 rounded border mb-0.5 text-xs gap-2 ${selecionada ? "bg-green-50 border-green-300" : "bg-slate-50"}`}>
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Truck className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{op.transportadoraNome || "Transportadora"}</span>
                  {valorNum > 0 ? (
                    <span className="text-slate-700 font-semibold whitespace-nowrap">R$ {valorNum.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  ) : (
                    <span className="text-amber-600 font-medium whitespace-nowrap">—</span>
                  )}
                  {op.prazoEntrega && <span className="text-slate-600 whitespace-nowrap">{op.prazoEntrega}</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {selecionada ? (
                    <Badge className="bg-green-100 text-green-700 shrink-0"><CheckCircle2 className="w-3 h-3 mr-1" />Selecionada</Badge>
                  ) : !isVendedor ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditandoOpcao(op.id)}>
                        {valorNum > 0 ? "Editar" : "Cotar"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => selecionarOpcao.mutate({ cotacaoId: cotacao.id, opcaoId: op.id })}>
                        Selecionar
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 px-2"
                        onClick={() => removeOpcao.mutate({ opcaoId: op.id })}>
                        ✕
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              );
            })}

            {/* Editor inline de valor e prazo da opção selecionada para cotar */}
            {editandoOpcao != null && !isVendedor && (
              <div className="mt-1 mb-2 border border-blue-200 rounded-lg p-3 bg-blue-50/50 space-y-2">
                <p className="text-xs font-semibold text-blue-800">
                  Informar valor e prazo — {detalhe?.opcoes?.find((o: any) => o.id === editandoOpcao)?.transportadoraNome}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input className="text-sm h-8 mt-0.5" placeholder="0,00"
                      value={edicaoOpcao.valorFrete}
                      onChange={e => setEdicaoOpcao(p => ({ ...p, valorFrete: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Prazo (dias)</Label>
                    <Input className="text-sm h-8 mt-0.5" placeholder="0" inputMode="numeric"
                      value={edicaoOpcao.prazoDias}
                      onChange={e => setEdicaoOpcao(p => ({ ...p, prazoDias: e.target.value.replace(/\D/g, "") }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <select className="w-full h-8 mt-0.5 text-sm border rounded-md px-2 bg-white"
                      value={edicaoOpcao.tipoPrazo}
                      onChange={e => setEdicaoOpcao(p => ({ ...p, tipoPrazo: e.target.value as "uteis" | "corridos" }))}>
                      <option value="uteis">úteis</option>
                      <option value="corridos">corridos</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={updateOpcao.isPending}
                    onClick={() => {
                      updateOpcao.mutate({
                        opcaoId: editandoOpcao!,
                        valorFrete: edicaoOpcao.valorFrete || "0",
                        prazoDias: edicaoOpcao.prazoDias ? Number(edicaoOpcao.prazoDias) : undefined,
                        tipoPrazo: edicaoOpcao.tipoPrazo,
                      });
                    }}>
                    {updateOpcao.isPending ? "Salvando..." : "Salvar cotação"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditandoOpcao(null)}>Cancelar</Button>
                </div>
              </div>
            )}

            {/* Adição manual de transportadora — busca enxuta, valor/prazo são informados depois em "Cotar" */}
            {!isVendedor && cotacao.status !== "enviada" && (
              <div className="mt-2">
                {!mostrarAddManual ? (
                  <button
                    onClick={() => setMostrarAddManual(true)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    + Adicionar transportadora manualmente
                  </button>
                ) : (
                  <div className="relative border rounded-lg p-2 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        placeholder="Buscar transportadora..."
                        value={novaOpcao.transportadoraNome}
                        onChange={e => { setNovaOpcao(p => ({ ...p, transportadoraNome: e.target.value, transportadoraId: undefined })); setNovaOpcaoAC(true); }}
                        className="text-sm h-8"
                      />
                      <Button
                        size="sm"
                        disabled={addOpcao.isPending || !novaOpcao.transportadoraNome.trim()}
                        onClick={() => {
                          if (!novaOpcao.transportadoraNome.trim()) return;
                          addOpcao.mutate({
                            cotacaoId: cotacao.id,
                            transportadoraId: novaOpcao.transportadoraId,
                            transportadoraNome: novaOpcao.transportadoraNome.trim(),
                            valorFrete: "0",
                            tipoPrazo: "uteis",
                          });
                          setMostrarAddManual(false);
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" />Adicionar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setMostrarAddManual(false); setNovaOpcaoAC(false); }}>
                        Cancelar
                      </Button>
                    </div>
                    {novaOpcaoAC && transportadorasAC && transportadorasAC.length > 0 && (
                      <div className="absolute z-50 top-full left-2 right-2 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {transportadorasAC.map((t) => (
                          <button key={t.id} type="button"
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 hover:text-blue-700 border-b border-gray-50 last:border-0"
                            onMouseDown={() => { setNovaOpcao(p => ({ ...p, transportadoraNome: t.nome, transportadoraId: t.id })); setNovaOpcaoAC(false); }}>
                            {t.nome}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-[10.5px] text-slate-500 mt-1.5">
                      O valor e o prazo são informados depois, no botão "Cotar" da transportadora.
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Template de opcoes de frete para o vendedor */}
          {detalhe && detalhe.opcoes.length > 0 && (() => {
            const opcoesOrdenadas = [...detalhe.opcoes].sort((a, b) => parseFloat(a.valorFrete) - parseFloat(b.valorFrete));
            const valorNfNum = parseFloat((cotacao.valorNf ?? "0").replace(/\./g, "").replace(",", "."));
            const linhas = opcoesOrdenadas.map((op, i) => {
              const labelPrazo = op.tipoPrazo === "corridos" ? "dias corridos" : "dias úteis";
              const prazo = op.prazoDias ? ` — ${op.prazoDias} ${labelPrazo}` : "";
              const valorRaw = String(op.valorFrete);
              // valorFrete vem do MySQL como "60.00" (ponto decimal) — não remover pontos
              const valorNum = parseFloat(valorRaw.replace(",", "."));
              const pct = valorNfNum > 0 && valorNum > 0 ? ` (${((valorNum / valorNfNum) * 100).toFixed(1)}% do pedido)` : "";
              const valorFmt = valorNum > 0 ? valorNum.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : op.valorFrete;
              return `Opção ${i + 1}: ${op.transportadoraNome || "Transportadora"} — R$ ${valorFmt}${pct}${prazo}`;
            });
            const horarioDecisao = horarioDecisaoMs
              ? (() => {
                  const [h, m] = horarioDecisaoMs.split(":").map(Number);
                  const dfH = (h + 1) % 24;
                  const fmt = (n: number) => String(n).padStart(2, "0");
                  return `⏰ *Prazo para decisão:* até ${fmt(h)}h${fmt(m)} (Campo Grande/MS) | ${fmt(dfH)}h${fmt(m)} (Brasília/DF)`;
                })()
              : `⏰ *Prazo para decisão:* até 16h00 (Campo Grande/MS) | 17h00 (Brasília/DF)`;
            const templateFrete = [
              `*OPÇÕES DE FRETE — ${cotacao.destinatarioNome || "Cliente"}*`,
              `*Destino:* ${cotacao.municipio}/${cotacao.estado}`,
              ...(cotacao.municipio ? [`*Endereço:* ${cotacao.municipio}/${cotacao.estado} — CEP: ${cotacao.cepDestino || "(não informado)"}`] : []),
              ``,
              ...linhas,
              ``,
              horarioDecisao,
              ``,
              `_O frete é um serviço terceirizado. Havendo pequenas diferenças no valor após a chegada, informar o setor comercial._`,
              `_Nos informe qual opção ficou melhor para você!_`,
            ].join("\n");
            return (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-green-700 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" /> Template de Opções para o Vendedor
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-xs gap-1.5 border-green-300 text-green-700 hover:bg-green-100"
                    onClick={() => { navigator.clipboard.writeText(templateFrete).then(() => toast.success("Template copiado!")); }}
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </Button>
                </div>
                <pre className="text-xs text-green-800 whitespace-pre-wrap font-mono bg-white border border-green-100 rounded p-2 leading-relaxed">{templateFrete}</pre>
              </div>
            );
          })()}
          {/* Comentários — compartilhados */}
          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />Comentários da Equipe
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
              {detalhe?.comentarios.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum comentário ainda.</p>
              )}
              {detalhe?.comentarios?.map((c: any) => (
                <div key={c.id} className="text-xs bg-muted/30 rounded p-2">
                  <span className="font-medium">{c.autorNome}:</span> {c.texto}
                  <span className="text-muted-foreground ml-2">{new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar comentário..."
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }}
              />
              <Button size="sm" onClick={() => { if (comentario.trim()) addComentario.mutate({ cotacaoId: cotacao.id, autorNome: "Equipe", texto: comentario }); }}>
                Enviar
              </Button>
            </div>
          </div>

          {/* Botão Excluir — vermelho, centralizado, no final do card */}
          <div className="pt-4 mt-2 border-t border-red-100 flex justify-center">
            <button
              type="button"
              disabled={deleteCotacao.isPending}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm shadow-sm transition-all duration-150 hover:bg-red-700 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
              onClick={() => {
                const nome = cotacao.destinatarioNome || `Cotação #${cotacao.id}`;
                if (!window.confirm(`Excluir definitivamente "${nome}"?\n\nEsta ação não pode ser desfeita.`)) return;
                deleteCotacao.mutate({ id: cotacao.id });
              }}
            >
              <Trash2 className="w-4 h-4" />
              {deleteCotacao.isPending ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {/* Botão de exclusão fora do Dialog — funciona em todos os estágios */}
    {podeExcluir && (
      <div className="px-3 pb-2 -mt-1">
        <div className="pt-1 border-t border-dashed border-muted/40 flex justify-end">
          <button
            className="text-xs text-muted-foreground/50 hover:text-red-600 transition-colors flex items-center gap-1 py-0.5 px-1.5 rounded hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              const id = cotacao.id;
              const nome = cotacao.destinatarioNome || `Cotação #${id}`;
              deleteCotacao.mutate({ id });
              toast.success(`${nome} excluída`, {
                action: {
                  label: "Desfazer",
                  onClick: () => {
                    toast.info("Não é possível desfazer — contate o administrador para restaurar.");
                  },
                },
                duration: 5000,
              });
            }}
          >
            <X className="w-3 h-3" /> Excluir
          </button>
        </div>
      </div>
    )}
    </div>
  );
}

// Bug 3 fix: Kanban do vendedor — filtra apenas suas próprias cotações
function KanbanView({ cotacoes, onRefresh, isVendedor, pageNumber, setPageNumber, totalPages, isLoading }: { cotacoes: Cotacao[]; onRefresh: () => void; isVendedor?: boolean; pageNumber: number; setPageNumber: (fn: (p: number) => number) => void; totalPages: number; isLoading: boolean }) {
  const columns = ["aberta", "cotando", "selecao", "cotada", "enviada"];
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  // Status aplicado localmente durante/depois do drag (optimistic update).
  // Evita o card "desaparecer" enquanto o servidor confirma a mudança.
  const [statusOverride, setStatusOverride] = useState<Record<number, string>>({});

  // ✅ MELHORIA 1: Paginação já vem do servidor (otimizado)
  // Não precisa fazer slice em memória, dados já vêm paginados
  const cotacoesComOverride = cotacoes.map((c: any) =>
    statusOverride[c.id] ? { ...c, status: statusOverride[c.id] } : c,
  );
  const paginatedCotacoes = cotacoesComOverride;

  // Quando o servidor já devolve o status novo, limpa o override correspondente
  useEffect(() => {
    setStatusOverride(prev => {
      const next: Record<number, string> = {};
      let mudou = false;
      for (const [idStr, st] of Object.entries(prev)) {
        const atual = cotacoes.find((c: any) => c.id === Number(idStr));
        if (atual && atual.status !== st) {
          next[Number(idStr)] = st;
        } else {
          mudou = true;
        }
      }
      return mudou ? next : prev;
    });
  }, [cotacoes]);
  
  const utils = trpc.useUtils();
  const updateStatus = trpc.cotacoesFrete.updateStatus.useMutation({
    // Optimistic update: o card muda de coluna na hora, sem esperar o servidor
    onMutate: ({ id, status }) => {
      setStatusOverride(prev => ({ ...prev, [id]: status }));
    },
    onError: (err, { id }) => {
      // Rollback se o servidor recusar
      setStatusOverride(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.error(`Não foi possível mover o card: ${err.message}`);
    },
    onSuccess: async () => {
      await utils.cotacoesFrete.list.invalidate();
      onRefresh();
    },
  });

  const handleDrop = (col: string, id: number) => {
    const cotacao = cotacoesComOverride.find((c: any) => c.id === id);
    if (!cotacao) return;
    if (cotacao.status === col) return;
    updateStatus.mutate({ id, status: col as any });
  };

  // Download do romaneio em PDF real (gerado no servidor com jsPDF, sem fotografias)
  const baixarRomaneioPdf = trpc.cotacoesFrete.romaneioPdf.useMutation({
    onSuccess: (res: any) => {
      const binario = atob(res.pdfBase64);
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = res.fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Romaneio em PDF com ${res.totalPedidos} pedido(s)`);
    },
    onError: (err: any) => toast.error(`Falha ao gerar PDF: ${err.message}`),
  });
  const gerandoPdf = baixarRomaneioPdf.isPending;

  return (
    <div className="space-y-4">
      {/* ✅ Controles de Paginação */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
        <div className="text-sm text-slate-600 font-medium">
          Página <span className="font-bold text-slate-900">{pageNumber}</span> de <span className="font-bold text-slate-900">{totalPages}</span> • Mostrando {paginatedCotacoes.length} cotações por página
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            disabled={pageNumber === 1 || isLoading}
            className="text-xs"
          >
            ← Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPageNumber(p => Math.min(totalPages, p + 1))}
            disabled={pageNumber === totalPages || isLoading}
            className="text-xs"
          >
            Próxima →
          </Button>
        </div>
      </div>
      
      {/* ✅ Skeleton Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-8 bg-slate-200 rounded animate-pulse"></div>
              <div className="space-y-2">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-24 bg-slate-100 rounded animate-pulse"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* ✅ Grid do Kanban com dados paginados */}
      {!isLoading && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {columns.map(col => {
            const items = paginatedCotacoes.filter((c: any) => c.status === col);
          const isOver = dragOverCol === col;
          return (
          <div
            key={col}
            className="space-y-2"
            onDragOver={e => { e.preventDefault(); setDragOverCol(col); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
            onDrop={e => { e.preventDefault(); setDragOverCol(null); if (draggedId !== null) handleDrop(col, draggedId); setDraggedId(null); }}
          >
            <div className={`flex items-center justify-between mb-1 px-2 py-1.5 rounded-md border transition-all ${statusHeaderColor(col)} ${isOver ? "ring-2 ring-blue-400 scale-[1.01]" : ""}`}>
              <h2 className="font-semibold text-sm">{statusLabel(col)}</h2>
              <div className="flex items-center gap-1.5">
                {col === "cotada" && items.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => imprimirRomaneio(items)}
                      title="Imprimir romaneio para o motorista (sem fotografias)"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-white border border-blue-300 rounded px-1.5 py-0.5 hover:bg-blue-100"
                    >
                      <Printer className="w-3 h-3" /> Imprimir
                    </button>
                    <button
                      type="button"
                      disabled={gerandoPdf}
                      onClick={() => baixarRomaneioPdf.mutate({ ids: items.map((c: any) => c.id) })}
                      title="Baixar romaneio em PDF (sem fotografias)"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-white border border-blue-300 rounded px-1.5 py-0.5 hover:bg-blue-100 disabled:opacity-50"
                    >
                      <Download className="w-3 h-3" /> {gerandoPdf ? "Gerando..." : "PDF"}
                    </button>
                  </>
                )}
                <Badge variant="secondary">{items.length}</Badge>
              </div>
            </div>
            <div className={`space-y-2 min-h-[120px] rounded-lg transition-all ${isOver ? "bg-blue-50/60 ring-1 ring-blue-200" : ""}`}>
              {items.map((c: any) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={e => { e.stopPropagation(); setDraggedId(c.id); e.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => { setDraggedId(null); setDragOverCol(null); }}
                  className={`transition-opacity ${draggedId === c.id ? "opacity-40" : "opacity-100"}`}
                >
                  <CotacaoCard cotacao={c} onRefresh={onRefresh} isVendedor={isVendedor} />
                </div>
              ))}
              {items.length === 0 && (
                <div className={`border-2 border-dashed rounded-lg p-4 text-center text-muted-foreground text-xs transition-all ${isOver ? "border-blue-400 bg-blue-50 text-blue-500" : ""}`}>
                  {isOver ? "Soltar aqui" : "Nenhuma cotação"}
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>
      )}
    </div>
  );
}

export default function Solicitacoes() {
  const utils = trpc.useUtils();
  const { user: localUser } = useAuth();

  // ✅ MELHORIA 2: Cache inteligente com React Query + Paginação Server-Side
  // Configuração de cache: mantém dados por 5 minutos, refetch em background a cada 2 minutos
  const [pageNumber, setPageNumber] = useState(1);
  const PAGE_SIZE = 20; // Carregar 20 itens por página (otimizado para performance)
  
  const { data: paginatedData, isLoading } = trpc.cotacoesFrete.list.useQuery(
    { page: pageNumber, pageSize: PAGE_SIZE },
    {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos (antigo cacheTime)
      refetchInterval: 2 * 60 * 1000, // Refetch a cada 2 minutos em background
      refetchOnWindowFocus: false, // ✅ CRÍTICO: Não refetch ao voltar para a janela (evita perda de dados)
      refetchOnMount: false, // Não refetch ao montar (usa cache)
    }
  );

  // ✅ A API retorna { data: [...], pagination: { totalPages, ... } }
  const cotacoes = (paginatedData as any)?.data ?? [];
  const totalPages = (paginatedData as any)?.pagination?.totalPages ?? 1;
  const refresh = () => {
    utils.cotacoesFrete.list.invalidate();
    setPageNumber(1); // Resetar para primeira página ao atualizar
  };

  const isVendedor = localUser?.role === "vendas";
  const isLogistica = localUser?.role === "logistica" || localUser?.role === "admin" || localUser?.role === "master";
  
  // ✅ Indicador de status do cache
  const isCached = !isLoading && cotacoes.length > 0;

  // Bug 3 fix: vendedor vê apenas suas próprias cotações
  const minhasCotacoes = isVendedor
    ? cotacoes.filter((c: any) => c.solicitanteNome?.toLowerCase() === localUser?.name?.toLowerCase())
    : cotacoes;

  if (isLoading) {
    return <div className="p-6"><div className="h-8 bg-muted animate-pulse rounded w-48" /></div>;
  }

  return (
    <div className="p-6 space-y-4">
      {/* Barra de navegação */}
      <div className="flex items-center -mx-6 -mt-6 mb-4 px-4 py-1.5" style={{ background: "oklch(0.16 0.015 245)", borderBottom: "1px solid oklch(0.22 0.02 245)" }}>
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold no-underline transition-all duration-150 hover:opacity-80"
          style={{ background: "oklch(0.28 0.02 245)", color: "oklch(0.90 0.005 240)", border: "1px solid oklch(0.35 0.02 245)", letterSpacing: "0.04em" }}
        >
          <Home size={12} style={{ color: "oklch(0.62 0.18 240)" }} />
          VOLTAR PARA HOME
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-500" />
            Solicitações de Frete
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isVendedor ? `Minhas solicitações — ${minhasCotacoes.length} total` : `Kanban de cotações — ${cotacoes.length} total`}
            {isCached && <span className="text-xs text-green-600 ml-2">✓ Dados em cache</span>}
          </p>
        </div>
      </div>
      
      {/* ✅ Dialog renderizado fora do header para evitar desmontagem ao mudar de janela */}
      <div className="flex justify-end mb-4">
        <NovaCotacaoDialog onSuccess={refresh} />
      </div>

      {/* Bug 3 fix: abas Logística / Minhas Cotações para usuários com acesso total */}
      {isLogistica ? (
        <Tabs defaultValue="todas">
          <TabsList>
            <TabsTrigger value="todas">Todas as Cotações ({cotacoes.length})</TabsTrigger>
            <TabsTrigger value="minhas">Minhas Solicitações ({cotacoes.filter((c: any) => c.solicitanteNome?.toLowerCase() === localUser?.name?.toLowerCase()).length})</TabsTrigger>
          </TabsList>
          <TabsContent value="todas" className="mt-4">
            <KanbanView cotacoes={cotacoes as Cotacao[]} onRefresh={refresh} isVendedor={false} pageNumber={pageNumber} setPageNumber={setPageNumber} totalPages={totalPages} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="minhas" className="mt-4">
            <KanbanView cotacoes={cotacoes.filter((c: any) => c.solicitanteNome?.toLowerCase() === localUser?.name?.toLowerCase()) as Cotacao[]} onRefresh={refresh} isVendedor={true} pageNumber={pageNumber} setPageNumber={setPageNumber} totalPages={totalPages} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      ) : (
        <KanbanView cotacoes={minhasCotacoes as Cotacao[]} onRefresh={refresh} isVendedor={isVendedor} pageNumber={pageNumber} setPageNumber={setPageNumber} totalPages={totalPages} isLoading={isLoading} />
      )}
    </div>
  );
}

// ── Mod 3: Transportadoras que atendem a cidade ──────────────────────────────
function TransportadorasPorCidade({
  municipio, estado, cotacaoId, onAdicionada,
}: { municipio: string; estado: string; cotacaoId: number; onAdicionada: () => void }) {
  const { data } = trpc.transportadoras.consultarCobertura.useQuery(
    { cidade: municipio, estado },
    { staleTime: 5 * 60_000, enabled: !!municipio },
  );
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const addOpcao = trpc.cotacoesFrete.addOpcao.useMutation({
    onSuccess: onAdicionada,
    onError: (e) => toast.error(`Erro ao adicionar: ${e.message}`),
  });

  const atende = data?.atende ?? [];
  if (atende.length === 0) return null;

  const toggle = (id: number) =>
    setSelecionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const confirmar = () => {
    const escolhidas = atende.filter((t: any) => selecionadas.includes(t.id));
    for (const t of escolhidas) {
      addOpcao.mutate({
        cotacaoId,
        transportadoraId: t.id,
        transportadoraNome: t.nome,
        valorFrete: "0",
        prazoDias: undefined,
        tipoPrazo: "uteis",
      });
    }
    setSelecionadas([]);
    toast.success(`${escolhidas.length} transportadora(s) adicionada(s) à cotação`);
  };

  return (
    <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1">
        <Truck className="w-3.5 h-3.5" /> Transportadoras que atendem {municipio}/{estado}
      </p>
      <div className="flex flex-wrap gap-2 mb-2">
        {atende.map((t: any) => (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              selecionadas.includes(t.id)
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-blue-700 border-blue-300 hover:bg-blue-100"
            }`}
          >
            {t.nome}
          </button>
        ))}
      </div>
      {selecionadas.length > 0 && (
        <Button size="sm" className="text-xs h-7" onClick={confirmar} disabled={addOpcao.isPending}>
          + Adicionar {selecionadas.length} selecionada(s) à cotação
        </Button>
      )}
    </div>
  );
}
