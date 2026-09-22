import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { fmtDate } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  MessageCircle, Trophy, XCircle, RefreshCw, Users, Calendar,
  CheckSquare, Square, Clock, ThumbsUp, AlertCircle, AlertTriangle,
  ChevronDown, ChevronUp, Star,
  Activity, CheckCircle2, Target, Trash2, TrendingUp, Zap, Info,
  ChevronLeft, ChevronRight
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";
import { ScriptsFaixaPopover } from "@/components/ScriptsFaixaPopover";
import { WhatsAppScriptsPopover } from "@/components/WhatsAppScriptsPopover";
import { BibliotecaMidias } from "@/components/BibliotecaMidias";
import { faixaSugerida } from "@/lib/faixasCrm";
import { primeiroNome } from "@/lib/mensagensCrm";
import type { FaixaConfig } from "@/components/FaixaDiasConfigForm";
import { gerarDatasUteis } from "@shared/dias-uteis";
import {
  Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";

// Mesmos defaults do backend (server/routers/crm.ts, FAIXA_DEFAULTS) — usado só
// enquanto trpc.crm.getFaixaEtiquetas ainda não respondeu (primeiro carregamento).
const FAIXA_DEFAULTS_CLIENTE: Record<1 | 2 | 3, FaixaConfig> = {
  1: { faixa: 1, label: "Faixa 1 (1-2 du)", diasInicio: 1, diasFim: 2 },
  2: { faixa: 2, label: "Faixa 2 (3-5 du)", diasInicio: 3, diasFim: 5 },
  3: { faixa: 3, label: "Faixa 3 (6-10 du)", diasInicio: 6, diasFim: 10 },
};

// ─── Constantes ───────────────────────────────────────────────────────────────
const OPCOES_RESPOSTA = [
  { value: "nao_retornou" as const, label: "Não retornou", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50 border-red-200 hover:bg-red-100", badgeBg: "bg-red-100 text-red-700 border-red-200", emoji: "🔴" },
  { value: "esperando_cliente" as const, label: "Esperando cliente", icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-200 hover:bg-amber-100", badgeBg: "bg-amber-100 text-amber-700 border-amber-200", emoji: "🟡" },
  { value: "garantiu_fechamento" as const, label: "Garantiu fechamento", icon: ThumbsUp, color: "text-green-600", bg: "bg-green-50 border-green-200 hover:bg-green-100", badgeBg: "bg-green-100 text-green-700 border-green-200", emoji: "🟢" },
  // O vendedor já fez o contato, mas o cliente ainda não deu devolutiva.
  { value: "aguardando_resposta" as const, label: "Vendedor aguardando resposta", icon: MessageCircle, color: "text-blue-600", bg: "bg-blue-50 border-blue-200 hover:bg-blue-100", badgeBg: "bg-blue-100 text-blue-700 border-blue-200", emoji: "🔵" },
] as const;

type RespostaCanal = typeof OPCOES_RESPOSTA[number]["value"];

type Proposta = {
  id: string;
  sequencial: string | number;
  nomeCliente: string;
  nomeContato: string;
  telefone?: string | null;
  vendedor: string;
  valor: number;
  dataCriacao: string;
  diasAberto: number;
  janela: string;
  clienteNovo: boolean;
  contato1: { data: string; canal: string; obs: string | null } | null;
  contato2: { data: string; canal: string; obs: string | null } | null;
  qtdContatos: number;
  contato1NoPrazo: boolean | null;
  meta2Contatos: boolean;
  probabilidadeCompra: number | null;
  probabilidadeExplicacao: string[];
  qtdComprasCliente: number;
  /** Dias desde a última compra registrada no histórico local — null quando
   * o cliente é novo (sem nenhuma compra anterior) ou não há data disponível. */
  diasSemComprar: number | null;
  estadoCliente: string | null;
};

// Limiar de compras a partir do qual o cliente é elegível a parcelamento (regra do usuário)
const LIMIAR_PARCELAMENTO = 3;

// Aproximação em dias dos "6 meses de inatividade" da Lógica do Cliente Novo e
// Reativado (ver server/routers/performanceComercial.ts, MESES_INATIVIDADE_PARA_NOVO)
// — usado só para destacar visualmente o badge de dias sem comprar, não afeta
// nenhum cálculo de negócio.
const MESES_REATIVACAO_DIAS = 180;

// ─── Score de Probabilidade de Compra (Fase 1) ────────────────────────────────
function probabilidadeCor(p: number) {
  if (p >= 50) return { text: "text-green-700", bg: "bg-green-100 border-green-200" };
  if (p >= 25) return { text: "text-amber-700", bg: "bg-amber-100 border-amber-200" };
  return { text: "text-red-700", bg: "bg-red-100 border-red-200" };
}

// Ícone por tipo de sinal da explicação bayesiana (ver server/services/probabilidadeCompra.ts,
// calcularProbabilidadeBayesiana) — identificado pelo rótulo antes dos ":" de cada linha.
function iconeExplicacao(label: string): string {
  const key = label.toLowerCase().trim();
  if (key.startsWith("base")) return "📊";
  if (key.startsWith("cliente novo")) return "🆕";
  if (key.startsWith("histórico do cliente")) return "👤";
  if (key.startsWith("faixa de tíquete")) return "💰";
  if (key.startsWith("região")) return "📍";
  if (key.startsWith("ajuste")) return "⚙️";
  return "•";
}

// Realça percentuais/pontos-percentuais ("27%", "+4pp") em negrito dentro do texto.
function destacarNumeros(texto: string) {
  return texto.split(/(\d+(?:[.,]\d+)?\s?(?:%|pp))/g).map((parte, i) =>
    /^\d+(?:[.,]\d+)?\s?(?:%|pp)$/.test(parte)
      ? <span key={i} className="font-semibold text-white">{parte}</span>
      : <span key={i}>{parte}</span>
  );
}

// Cada linha vem como "Rótulo: descrição" (ver calcularProbabilidadeBayesiana) — aqui
// separamos rótulo (negrito) da descrição (cinza) e destacamos os números, em vez de
// mostrar o texto corrido puro.
function ExplicacaoLinha({ linha }: { linha: string }) {
  const m = linha.match(/^([^:]+):\s*(.*)$/);
  if (!m) return <p className="text-gray-300 leading-4">{linha}</p>;
  const [, label, resto] = m;
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-[11px] leading-4 flex-shrink-0">{iconeExplicacao(label)}</span>
      <p className="leading-4">
        <span className="font-semibold text-white">{label}:</span>{" "}
        <span className="text-gray-300">{destacarNumeros(resto)}</span>
      </p>
    </div>
  );
}

function ProbabilidadeBadge({ p, explicacao }: { p: number | null; explicacao: string[] }) {
  if (p == null) return null;
  const cor = probabilidadeCor(p);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold cursor-default ${cor.bg} ${cor.text}`}>
            <TrendingUp className="w-2.5 h-2.5" /> {p}%
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[280px] py-2">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Como chegamos a {p}%</p>
          <div className="space-y-1.5">
            {explicacao.map((linha, i) => <ExplicacaoLinha key={i} linha={linha} />)}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtShort(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// A lista de propostas abertas vem de um cache atualizado por um job em segundo plano
// (não é busca ao vivo a cada carregamento — ver server/sync/crm-abertos-cache.ts), daí
// mostrar "atualizado há X" em vez de fingir que é sempre em tempo real.
function fmtTempoRelativo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "agora";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const dias = Math.floor(h / 24);
  return `há ${dias}d`;
}

// Gera 15 datas a partir de D+1 usando parsing LOCAL (evita timezone shift)
function parseDateLocal(dataCriacao: string): { y: number; m: number; d: number } | null {
  if (!dataCriacao) return null;
  // Formato ISO: "YYYY-MM-DDTHH:mm:ss" ou "YYYY-MM-DD"
  const iso = dataCriacao.split("T")[0];
  if (iso.includes("-")) {
    const parts = iso.split("-").map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return { y: parts[0], m: parts[1], d: parts[2] };
    }
  }
  // Formato BR: "DD/MM/YYYY" ou "DD/MM/YYYY HH:mm:ss"
  const br = dataCriacao.split(" ")[0];
  if (br.includes("/")) {
    const parts = br.split("/").map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return { y: parts[2], m: parts[1], d: parts[0] };
    }
  }
  // Fallback: usar Date nativo
  const dt = new Date(dataCriacao);
  if (!isNaN(dt.getTime())) {
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
  }
  return null;
}
// Gera as `quantidade` datas ÚTEIS D+1..D+N a partir da data de criação (pula
// sábado/domingo — ver @shared/dias-uteis). `quantidade` normalmente é o
// diasFim da Faixa 3 configurada (crm.getFaixaEtiquetas), cobrindo todas as
// faixas de uma vez.
function getDates(dataCriacao: string, quantidade: number): Date[] {
  const parsed = parseDateLocal(dataCriacao);
  if (!parsed) return [];
  const { y, m, d } = parsed;
  return gerarDatasUteis(new Date(y, m - 1, d), quantidade);
}

// Fatia as datas de uma faixa a partir da config (dias 1-indexados).
function datasDaFaixa(dates: Date[], faixa: FaixaConfig): Date[] {
  return dates.slice(faixa.diasInicio - 1, faixa.diasFim);
}

// A qual faixa pertence a N-ésima data útil (1-indexado) — null se estiver
// num intervalo não coberto por nenhuma faixa configurada (gap deliberado).
function faixaDaPosicao(posicao: number, faixas: FaixaConfig[]): 1 | 2 | 3 | null {
  for (const f of faixas) {
    if (posicao >= f.diasInicio && posicao <= f.diasFim) return f.faixa;
  }
  return null;
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildWaLink(tel: string | null | undefined) {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, "");
  if (digits.length < 8) return null;
  // Com DDI 55 o número tem 12–13 dígitos; sem DDI, 10–11. Só o comprimento distingue o DDI do
  // DDD 55 (RS), que começa igual — "55 99999-0000" precisa virar 5555999990000.
  const num = digits.length >= 12 && digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${num}`;
}

// Nome que entra nas mensagens ({nome_cliente} / [Nome]): só o PRIMEIRO nome do contato da proposta
// ("Tadeu Mota" → "Tadeu"). Sem contato cadastrado, cai no nome da empresa para não sair em branco.
function nomeParaMensagem(p: Proposta): string {
  return primeiroNome(p.nomeContato) || p.nomeCliente;
}

// Botão de WhatsApp das listas "hoje" por faixa: abre o seletor de mensagens da faixa da lista
function WhatsAppAgendaBotao({ p, faixa, faixasConfig }: {
  p: Proposta; faixa: 1 | 2 | 3; faixasConfig: Record<1 | 2 | 3, FaixaConfig>;
}) {
  const link = buildWaLink(p.telefone);
  if (!link) return null;
  return (
    <WhatsAppScriptsPopover
      link={link}
      faixaSugerida={faixa}
      rotulosFaixa={{ 1: faixasConfig[1].label, 2: faixasConfig[2].label, 3: faixasConfig[3].label }}
      titulo={p.nomeContato || p.nomeCliente}
      nomeCliente={nomeParaMensagem(p)}
      produto={`OS #${p.sequencial || p.id}`}
      valor={fmt(p.valor)}
      vendedor={p.vendedor}
    >
      <button type="button" className="text-green-600 hover:text-green-700 flex-shrink-0" title="Escolher a mensagem e abrir o WhatsApp">
        <MessageCircle className="w-3.5 h-3.5" />
      </button>
    </WhatsAppScriptsPopover>
  );
}

function getCanalInfo(canal: string) {
  return OPCOES_RESPOSTA.find(o => o.value === canal) ?? null;
}

// ─── PropostaRow ─────────────────────────────────────────────────────────────
function PropostaRow({ p, vendedor, onRefresh, showVendedor, faixasConfig }: {
  p: Proposta; vendedor: string; onRefresh: () => void; showVendedor: boolean;
  faixasConfig: Record<1 | 2 | 3, FaixaConfig>;
}) {
  const [modalStatus, setModalStatus] = useState(false);
  // modalContato: null = fechado; { date } = aberto (registro novo OU edição de um já existente
  // — depende se `contatoMap` já tem essa data, ver `editando` abaixo)
  const [modalContato, setModalContato] = useState<{ date: Date } | null>(null);
  // true = mostra a confirmação "Remover contato?" em vez do formulário de resposta
  const [pedindoRemocao, setPedindoRemocao] = useState(false);
  const [respostaSelecionada, setRespostaSelecionada] = useState<RespostaCanal | null>(null);
  const [obs, setObs] = useState("");

  const registrarContato = trpc.crm.registrarContato.useMutation({
    onSuccess: () => {
      toast.success("Contato registrado!");
      setModalContato(null);
      setRespostaSelecionada(null);
      setObs("");
      onRefresh();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  // Troca a resposta de um contato já registrado (ex.: estava "aguardando_resposta" e o
  // cliente respondeu) sem apagar e recriar — mesmo registro, não consome uma nova vaga.
  const alterarContato = trpc.crm.alterarContato.useMutation({
    onSuccess: () => {
      toast.success("Contato atualizado!");
      setModalContato(null);
      setRespostaSelecionada(null);
      setObs("");
      onRefresh();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const desfazarContato = trpc.crm.desfazarContato.useMutation({
    onSuccess: () => {
      toast.success("Contato removido.");
      setModalContato(null);
      setPedindoRemocao(false);
      onRefresh();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const marcarPerdida = trpc.crm.marcarPerdida.useMutation({
    onSuccess: () => { toast.success("Proposta marcada como perdida."); setModalStatus(false); onRefresh(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const marcarGanha = trpc.crm.marcarGanha.useMutation({
    onSuccess: () => { toast.success("Proposta marcada como ganha! 🎉"); setModalStatus(false); onRefresh(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const dates = getDates(p.dataCriacao, faixasConfig[3].diasFim);
  const waLink = buildWaLink(p.telefone);
  // Grupo de mensagens que o botão de WhatsApp abre selecionado: a faixa em que a proposta está hoje
  const grupoSugerido = faixaSugerida(dates, [faixasConfig[1], faixasConfig[2], faixasConfig[3]]);

  // Mapear contatos por chave de data
  const contatoMap: Record<string, { canal: string; obs: string | null }> = {};
  if (p.contato1?.data) {
    const d = new Date(p.contato1.data);
    contatoMap[toDateKey(d)] = { canal: p.contato1.canal, obs: p.contato1.obs };
  }
  if (p.contato2?.data) {
    const d = new Date(p.contato2.data);
    contatoMap[toDateKey(d)] = { canal: p.contato2.canal, obs: p.contato2.obs };
  }

  // Editando = a data clicada já tem um contato registrado (troca a resposta em vez de criar um novo)
  const editando = !!(modalContato && contatoMap[toDateKey(modalContato.date)]);

  const hoje = new Date();
  const hojeKey = toDateKey(hoje);

  const rowBg = p.diasAberto > faixasConfig[3].diasFim ? "bg-red-50 hover:bg-red-100"
    : p.diasAberto > faixasConfig[2].diasFim ? "bg-amber-50 hover:bg-amber-100"
    : p.diasAberto > faixasConfig[1].diasFim ? "bg-yellow-50 hover:bg-yellow-100"
    : "bg-white hover:bg-gray-50";

  const confirmContato = () => {
    if (!modalContato || !respostaSelecionada) return;
    if (editando) {
      alterarContato.mutate({
        orcamentoId: p.id,
        data: modalContato.date.toISOString(),
        canal: respostaSelecionada,
        observacao: obs || null,
      });
    } else {
      registrarContato.mutate({
        orcamentoId: p.id,
        vendedor: vendedor || p.vendedor,
        empresa: p.nomeCliente,
        canal: respostaSelecionada,
        observacao: obs || null,
        dataContato: modalContato.date.toISOString(),
      });
    }
  };

  const confirmDesfazer = () => {
    if (!modalContato) return;
    desfazarContato.mutate({ orcamentoId: p.id, data: modalContato.date.toISOString() });
  };

  // Renderizar um grupo de células (faixa)
  // Renderiza apenas o conteúdo interno das datas (usado pelo ScriptsFaixaPopover)
  const renderFaixaContent = (faixaDates: Date[]) => (
    <>
      <div className="text-[8px] text-center text-gray-400 mb-1.5 leading-tight">
        {faixaDates.map(dt => fmtShort(dt)).join(" ")}
      </div>
      <div className="flex gap-1 justify-center">
        {faixaDates.map((dt, i) => {
          const key = toDateKey(dt);
          const contato = contatoMap[key];
          const canalInfo = contato ? getCanalInfo(contato.canal) : null;
          if (contato && canalInfo) {
            return (
              <button key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setModalContato({ date: dt });
                  setPedindoRemocao(false);
                  setRespostaSelecionada(contato.canal as RespostaCanal);
                  setObs(contato.obs ?? "");
                }}
                title={`${canalInfo.label} — clique para alterar`}
                className="w-6 h-6 rounded flex items-center justify-center text-sm hover:opacity-70 transition-opacity cursor-pointer bg-white border border-gray-200 shadow-sm"
              >{canalInfo.emoji}</button>
            );
          }
          const isFuture = key > hojeKey;
          return (
            <button key={i}
              onClick={(e) => { e.stopPropagation(); setModalContato({ date: dt }); setPedindoRemocao(false); setRespostaSelecionada(null); setObs(""); }}
              title={`Registrar contato em ${fmtShort(dt)}`}
              className={`w-6 h-6 rounded border-2 bg-white active:scale-95 transition-all cursor-pointer flex items-center justify-center ${
                isFuture ? "border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-400" : "border-gray-300 hover:border-blue-500 hover:bg-blue-50"
              }`}
            ><span className="text-[7px] font-bold text-gray-500 leading-tight">{fmtShort(dt)}</span></button>
          );
        })}
      </div>
    </>
  );

  return (
    <>
      <TableRow className={`transition-colors ${rowBg}`}>
        {/* Nº OS */}
        <TableCell>
          <button onClick={() => setModalStatus(true)} className="text-blue-600 hover:text-blue-800 font-bold text-sm underline underline-offset-2">
            #{p.sequencial || p.id}
          </button>
          <div className="text-xs text-muted-foreground mt-0.5">{fmtDate(p.dataCriacao)}</div>
        </TableCell>

        {/* Miniatura / Razão Social */}
        <TableCell className="min-w-[170px] whitespace-normal">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: `hsl(${(p.nomeCliente.charCodeAt(0) * 47) % 360}, 60%, 45%)` }}>
              {p.nomeCliente.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-sm leading-tight truncate max-w-[120px]" title={p.nomeCliente}>{p.nomeCliente}</span>
                {p.clienteNovo && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-shrink-0 cursor-default">
                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-400" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Cliente novo — sem compras anteriores
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {p.estadoCliente && (
                  <span className="flex-shrink-0 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1" title={`Cliente em ${p.estadoCliente}`}>
                    {p.estadoCliente}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground">{fmt(p.valor)}</span>
                <ProbabilidadeBadge p={p.probabilidadeCompra} explicacao={p.probabilidadeExplicacao} />
                {p.qtdComprasCliente > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] cursor-default ${
                          p.qtdComprasCliente > LIMIAR_PARCELAMENTO
                            ? "font-bold bg-indigo-100 text-indigo-700 border-indigo-200"
                            : "text-gray-500 bg-gray-50 border-gray-200"
                        }`}>
                          {p.qtdComprasCliente}x comprou
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-[220px]">
                        {p.qtdComprasCliente > LIMIAR_PARCELAMENTO
                          ? `Elegível a parcelamento (mais de ${LIMIAR_PARCELAMENTO} compras no histórico)`
                          : `${p.qtdComprasCliente} compra${p.qtdComprasCliente === 1 ? "" : "s"} no histórico`}
                        <br />
                        <span className="text-gray-400">Histórico local (2024 em diante); nov-dez/2025 não sincronizados, pode faltar alguma compra desse período.</span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {p.diasSemComprar != null && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] cursor-default ${
                          p.diasSemComprar > MESES_REATIVACAO_DIAS
                            ? "font-bold bg-red-100 text-red-700 border-red-200"
                            : "text-gray-500 bg-gray-50 border-gray-200"
                        }`}>
                          há {p.diasSemComprar}d sem comprar
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-[220px]">
                        {p.diasSemComprar > MESES_REATIVACAO_DIAS
                          ? `Mais de ${MESES_REATIVACAO_DIAS} dias sem comprar — se fechar, conta como cliente reativado.`
                          : "Dias desde a última compra registrada no histórico local."}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
        </TableCell>

        {/* Nome do Contato / WhatsApp */}
        <TableCell className="min-w-[140px] whitespace-normal">
          <div className="text-sm font-medium">{p.nomeContato || "—"}</div>
          {waLink && (
            <WhatsAppScriptsPopover
              link={waLink}
              faixaSugerida={grupoSugerido}
              rotulosFaixa={{ 1: faixasConfig[1].label, 2: faixasConfig[2].label, 3: faixasConfig[3].label }}
              titulo={p.nomeContato || p.nomeCliente}
              nomeCliente={nomeParaMensagem(p)}
              produto={`OS #${p.sequencial || p.id}`}
              valor={fmt(p.valor)}
              vendedor={p.vendedor}
            >
              <button type="button"
                title="Escolher a mensagem e abrir a conversa no WhatsApp"
                className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded-full border border-green-200 mt-1">
                <MessageCircle className="w-3 h-3" /> WhatsApp
              </button>
            </WhatsAppScriptsPopover>
          )}
        </TableCell>

        {/* Vendedor (quando "todos") */}
        {showVendedor && (
          <TableCell>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{p.vendedor}</span>
          </TableCell>
        )}

        {/* Faixas agrupadas */}
        <TableCell className="whitespace-normal">
          <div className="flex gap-1.5 flex-wrap">
            <ScriptsFaixaPopover
              faixa={1} label={faixasConfig[1].label} bgCls="bg-yellow-50 border-yellow-200"
              nomeCliente={nomeParaMensagem(p)}
              produto={`OS #${p.sequencial || p.id}`}
              valor={fmt(p.valor)}
              vendedor={p.vendedor}
              whatsappLink={waLink}
            >
              {renderFaixaContent(datasDaFaixa(dates, faixasConfig[1]))}
            </ScriptsFaixaPopover>
            <ScriptsFaixaPopover
              faixa={2} label={faixasConfig[2].label} bgCls="bg-pink-50 border-pink-200"
              nomeCliente={nomeParaMensagem(p)}
              produto={`OS #${p.sequencial || p.id}`}
              valor={fmt(p.valor)}
              vendedor={p.vendedor}
              whatsappLink={waLink}
            >
              {renderFaixaContent(datasDaFaixa(dates, faixasConfig[2]))}
            </ScriptsFaixaPopover>
            <ScriptsFaixaPopover
              faixa={3} label={faixasConfig[3].label} bgCls="bg-orange-50 border-orange-200"
              nomeCliente={nomeParaMensagem(p)}
              produto={`OS #${p.sequencial || p.id}`}
              valor={fmt(p.valor)}
              vendedor={p.vendedor}
              whatsappLink={waLink}
            >
              {renderFaixaContent(datasDaFaixa(dates, faixasConfig[3]))}
            </ScriptsFaixaPopover>
          </div>
        </TableCell>

        {/* Perdida */}
        <TableCell className="text-center">
          <button onClick={() => marcarPerdida.mutate({ orcamentoId: p.id, vendedor: vendedor || p.vendedor, empresa: p.nomeCliente })}
            disabled={marcarPerdida.isPending}
            className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center mx-auto transition-colors"
            title="Marcar como perdida">
            {marcarPerdida.isPending ? <Spinner className="size-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          </button>
        </TableCell>

        {/* Venci */}
        <TableCell className="text-center">
          <button onClick={() => marcarGanha.mutate({ orcamentoId: p.id, vendedor: vendedor || p.vendedor, empresa: p.nomeCliente })}
            disabled={marcarGanha.isPending}
            className="w-8 h-8 rounded-full bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center mx-auto transition-colors"
            title="Marcar como ganha">
            {marcarGanha.isPending ? <Spinner className="size-3.5" /> : <Trophy className="w-3.5 h-3.5" />}
          </button>
        </TableCell>
      </TableRow>

      {/* Modal: registrar/editar contato */}
      <Dialog open={!!modalContato && !pedindoRemocao} onOpenChange={() => { setModalContato(null); setPedindoRemocao(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Contato" : "Registrar Contato"} — {modalContato ? fmtShort(modalContato.date) : ""}</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-semibold">{p.nomeCliente}</p>
          <p className="text-xs text-muted-foreground mb-3">
            {editando ? "Já respondeu? Atualize a resposta abaixo." : "Qual foi a resposta do cliente?"}
          </p>
          <div className="space-y-2">
            {OPCOES_RESPOSTA.map(opcao => {
              const selected = respostaSelecionada === opcao.value;
              return (
                <button key={opcao.value} type="button" onClick={() => setRespostaSelecionada(opcao.value)}
                  className={`flex items-center gap-3 w-full p-3 rounded-lg border-2 text-left transition-all ${selected ? `${opcao.bg} border-current ${opcao.color} shadow-sm` : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                  <span className="text-xl leading-none">{opcao.emoji}</span>
                  <div className="flex-1">
                    <div className={`font-semibold text-sm ${selected ? opcao.color : "text-gray-700"}`}>{opcao.label}</div>
                  </div>
                  {selected && <CheckSquare className={`w-5 h-5 ${opcao.color}`} />}
                </button>
              );
            })}
          </div>
          <div className="mt-3">
            <Label className="text-xs mb-1 block text-muted-foreground">Observação (opcional)</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: Cliente pediu prazo até sexta..." className="text-sm h-20 resize-none" />
          </div>
          <DialogFooter className="mt-4 sm:justify-between">
            {editando ? (
              <Button variant="ghost" size="sm" onClick={() => setPedindoRemocao(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                Remover contato
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setModalContato(null)}>Cancelar</Button>
              <Button size="sm" onClick={confirmContato} disabled={!respostaSelecionada || registrarContato.isPending || alterarContato.isPending} className="gap-1">
                {(registrarContato.isPending || alterarContato.isPending) && <Spinner className="size-3.5" />} {editando ? "Salvar alteração" : "Confirmar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: confirmar remoção de um contato já registrado */}
      <Dialog open={!!modalContato && pedindoRemocao} onOpenChange={() => setPedindoRemocao(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover contato?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Isso apaga o registro de contato de {modalContato ? fmtShort(modalContato.date) : ""} (em vez de remover, você pode
            escolher "Salvar alteração" e trocar a resposta). Tem certeza?
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setPedindoRemocao(false)}>Voltar</Button>
            <Button variant="destructive" size="sm" onClick={confirmDesfazer} disabled={desfazarContato.isPending} className="gap-1">
              {desfazarContato.isPending && <Spinner className="size-3.5" />} Remover contato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: ganho/perdido */}
      <Dialog open={modalStatus} onOpenChange={setModalStatus}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Proposta #{p.sequencial || p.id}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{p.nomeCliente}</p>
          <p className="text-sm font-semibold">{fmt(p.valor)}</p>
          <div className="flex gap-3 mt-4">
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
              onClick={() => marcarGanha.mutate({ orcamentoId: p.id, vendedor: vendedor || p.vendedor, empresa: p.nomeCliente })}
              disabled={marcarGanha.isPending}>
              {marcarGanha.isPending ? <Spinner /> : <Trophy className="w-4 h-4" />} Ganha
            </Button>
            <Button variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2"
              onClick={() => marcarPerdida.mutate({ orcamentoId: p.id, vendedor: vendedor || p.vendedor, empresa: p.nomeCliente })}
              disabled={marcarPerdida.isPending}>
              {marcarPerdida.isPending ? <Spinner /> : <XCircle className="w-4 h-4" />} Perdida
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── SugestaoContatoCard ───────────────────────────────────────────────────────
// Um card por cliente sugerido (fila de Inteligência de Clientes, tipos
// "atraso_recompra"/"primeira_sem_segunda" — ver crm.getSugestoesContato no
// servidor). O único registro esperado do vendedor é este botão: confirma
// que ligou, a data fica gravada automaticamente (resolvidoEm no servidor).
type SugestaoContato = {
  id: number;
  tipo: string;
  empresa: string;
  vendedor: string | null;
  motivo: string;
  score: number;
  evidencia: Record<string, unknown>;
};

function SugestaoContatoCard({ s, vendedor, showVendedor, onRefresh }: {
  s: SugestaoContato; vendedor: string; showVendedor: boolean; onRefresh: () => void;
}) {
  const registrarContatoSugestao = trpc.crm.registrarContatoSugestao.useMutation({
    onSuccess: () => { toast.success("Contato registrado!"); onRefresh(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const cor = probabilidadeCor(s.score);
  const diasSemComprar = typeof s.evidencia.diasDesdeUltima === "number" ? s.evidencia.diasDesdeUltima : null;
  const tipoLabel = s.tipo === "primeira_sem_segunda" ? "1ª compra sem repetição" : "Atraso na recompra";

  return (
    <div className="flex items-start gap-3 bg-white border rounded-xl p-4 shadow-sm">
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: `hsl(${(s.empresa.charCodeAt(0) * 47) % 360}, 60%, 45%)` }}>
        {s.empresa.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm" title={s.empresa}>{s.empresa}</span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-bold ${cor.bg} ${cor.text}`}>
            Score {s.score}
          </span>
          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-1.5 py-0.5">
            {tipoLabel}
          </span>
          {diasSemComprar != null && (
            <span className="text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
              há {diasSemComprar}d sem comprar
            </span>
          )}
          {showVendedor && s.vendedor && (
            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-1.5 py-0.5">
              {s.vendedor}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{s.motivo}</p>
      </div>
      <Button size="sm" variant="outline" className="flex-shrink-0 gap-1.5"
        disabled={registrarContatoSugestao.isPending}
        onClick={() => registrarContatoSugestao.mutate({ id: s.id, vendedor: vendedor || s.vendedor || "" })}>
        {registrarContatoSugestao.isPending ? <Spinner /> : <CheckSquare className="w-3.5 h-3.5" />} Contato feito
      </Button>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function CRM() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "master" || user?.role === "gestor";

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();
  const lastDay = new Date(anoAtual, mesAtual, 0).getDate();

  // Vendedor: admin/gestor/master vê todos; vendedor comum vê apenas as suas
  const [vendedor, setVendedor] = useState("");
  useEffect(() => {
    if (user && !isAdmin) {
      setVendedor(user.name ?? "");
    }
  }, [user, isAdmin]);
  const [dataInicio, setDataInicio] = useState(`${anoAtual}-${pad(mesAtual)}-01`);
  const [dataFim, setDataFim] = useState(`${anoAtual}-${pad(mesAtual)}-${pad(lastDay)}`);
  const [verHistorico, setVerHistorico] = useState(false);
  const [apenasNovos, setApenasNovos] = useState(false);
  const [apenasHoje, setApenasHoje] = useState(false);
  const [filtroProbabilidade, setFiltroProbabilidade] = useState<"todas" | "alta" | "media" | "baixa">("todas");
  const [apenasMS, setApenasMS] = useState(false);
  const [ordenarPorProbabilidade, setOrdenarPorProbabilidade] = useState(false);
  const [filtroResposta, setFiltroResposta] = useState<string>("todos");
  const [filtroFaixa, setFiltroFaixa] = useState<string>("todas");
  const [abaAtiva, setAbaAtiva] = useState<string>("propostas");
  // Busca padrão cobre 15 dias; ativar para incluir propostas abertas há mais tempo (raro)
  const [buscarAntigas, setBuscarAntigas] = useState(false);

  // ─── Estados da aba Auditoria ────────────────────────────────────────────────
  const [audVendedor, setAudVendedor] = useState<string>("__todos__");
  const [audDataInicio, setAudDataInicio] = useState<string>(() => {
    const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  });
  const [audDataFim, setAudDataFim] = useState<string>(() => {
    const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  });

  const { data: auditoriaData, isLoading: auditoriaLoading, refetch: auditoriaRefetch } = trpc.crm.getAuditoria.useQuery(
    {
      dataInicio: audDataInicio,
      dataFim: audDataFim,
      vendedor: audVendedor === "__todos__" ? undefined : audVendedor,
    },
    { refetchOnWindowFocus: false, enabled: abaAtiva === "auditoria" }
  );

  const { data, isLoading, isError, error, refetch } = trpc.crm.getPropostas.useQuery(
    { vendedor: vendedor || undefined, preset: "personalizado", dataInicio, dataFim, buscarAntigas },
    // retry: 1 (em vez do padrão 3 do React Query) — consulta ao MubiSys pode ser lenta;
    // se falhar, falha rápido em vez de travar minutos em retries exponenciais
    { refetchOnWindowFocus: false, retry: 1 }
  );

  const { data: vendedoresData } = trpc.crm.getVendedores.useQuery(undefined, { refetchOnWindowFocus: false, retry: 1 });
  const { data: sugestoesData, isLoading: sugestoesLoading, refetch: refetchSugestoes } = trpc.crm.getSugestoesContato.useQuery(
    { vendedor: vendedor || undefined },
    { refetchOnWindowFocus: false, retry: 1 }
  );
  const { data: faixasData } = trpc.crm.getFaixaEtiquetas.useQuery();
  const faixasConfig: Record<1 | 2 | 3, FaixaConfig> = faixasData ?? FAIXA_DEFAULTS_CLIENTE;
  const faixasOrdenadas = useMemo(() => [faixasConfig[1], faixasConfig[2], faixasConfig[3]], [faixasConfig]);

  const propostas: Proposta[] = (data?.propostas ?? []) as Proposta[];
  const stats = data?.stats;
  const abertosAtualizadoEm = fmtTempoRelativo((data as any)?.abertosAtualizadoEm);

  // Filtros
  const propostasAtivas = useMemo(() => {
    let list = propostas.filter(p => !p.meta2Contatos);
    if (apenasNovos) list = list.filter(p => p.clienteNovo);
    if (filtroResposta !== "todos") {
      if (filtroResposta === "sem_contato") {
        list = list.filter(p => p.qtdContatos === 0);
      } else {
        list = list.filter(p => p.contato1?.canal === filtroResposta || p.contato2?.canal === filtroResposta);
      }
    }
    if (filtroFaixa !== "todas") {
      const hojeKey = toDateKey(new Date());
      const maxDias = faixasConfig[3].diasFim;
      list = list.filter(p => {
        const dates = getDates(p.dataCriacao, maxDias);
        if (dates.length === 0) return false;
        const inFaixa = (f: FaixaConfig) => datasDaFaixa(dates, f).some(d => toDateKey(d) === hojeKey);
        if (filtroFaixa === "faixa1") return inFaixa(faixasConfig[1]);
        if (filtroFaixa === "faixa2") return inFaixa(faixasConfig[2]);
        if (filtroFaixa === "faixa3") return inFaixa(faixasConfig[3]);
        return true;
      });
    }
    if (apenasHoje) {
      const hojeKey = toDateKey(new Date());
      const maxDias = faixasConfig[3].diasFim;
      list = list.filter(p => {
        const dates = getDates(p.dataCriacao, maxDias);
        return dates.some(d => toDateKey(d) === hojeKey);
      });
      // Ordenar do maior para o menor valor quando filtro Hoje estiver ativo
      list = [...list].sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0));
    }
    if (filtroProbabilidade !== "todas") {
      list = list.filter(p => {
        const prob = p.probabilidadeCompra;
        if (prob == null) return false;
        if (filtroProbabilidade === "alta") return prob >= 50;
        if (filtroProbabilidade === "media") return prob >= 25 && prob < 50;
        return prob < 25; // baixa
      });
    }
    if (apenasMS) list = list.filter(p => p.estadoCliente === "MS");
    if (ordenarPorProbabilidade) list = [...list].sort((a, b) => (b.probabilidadeCompra ?? -1) - (a.probabilidadeCompra ?? -1));
    return list;
  }, [propostas, apenasNovos, apenasHoje, filtroResposta, filtroFaixa, filtroProbabilidade, apenasMS, ordenarPorProbabilidade, faixasConfig]);

  const propostasHistorico = useMemo(() => propostas.filter(p => p.meta2Contatos), [propostas]);
  const showVendedor = !vendedor;

  // Alerta de acompanhamento atrasado
  const propostasAtrasadas = useMemo(() => {
    const hojeKey = toDateKey(new Date());
    const maxDias = faixasConfig[3].diasFim;
    return propostasAtivas.filter(p => {
      const dates = getDates(p.dataCriacao, maxDias);
      const contatosDatas = new Set<string>();
      if (p.contato1?.data) { const d = new Date(p.contato1.data); contatosDatas.add(toDateKey(d)); }
      if (p.contato2?.data) { const d = new Date(p.contato2.data); contatosDatas.add(toDateKey(d)); }
      return dates.some(dt => {
        const key = toDateKey(dt);
        return key < hojeKey && !contatosDatas.has(key);
      });
    });
  }, [propostasAtivas, faixasConfig]);

  // Painel de agenda diária: propostas que têm hoje dentro de sua faixa e ainda sem contato hoje
  const agendaDiaria = useMemo(() => {
    const hojeKey = toDateKey(new Date());
    const maxDias = faixasConfig[3].diasFim;
    const faixa1: Proposta[] = [];
    const faixa2: Proposta[] = [];
    const faixa3: Proposta[] = [];
    for (const p of propostasAtivas) {
      const dates = getDates(p.dataCriacao, maxDias); // D+1..D+maxDias (dias úteis)
      const contatosDatas = new Set<string>();
      if (p.contato1?.data) { const d = new Date(p.contato1.data); contatosDatas.add(toDateKey(d)); }
      if (p.contato2?.data) { const d = new Date(p.contato2.data); contatosDatas.add(toDateKey(d)); }
      // Verificar se hoje está em alguma das faixas e sem contato
      for (let i = 0; i < dates.length; i++) {
        const key = toDateKey(dates[i]);
        if (key === hojeKey && !contatosDatas.has(key)) {
          const faixa = faixaDaPosicao(i + 1, faixasOrdenadas);
          if (faixa === 1) faixa1.push(p);
          else if (faixa === 2) faixa2.push(p);
          else if (faixa === 3) faixa3.push(p);
          break;
        }
      }
    }
    return { faixa1, faixa2, faixa3 };
  }, [propostasAtivas, faixasConfig, faixasOrdenadas]);

  const vendedorAtual = vendedor || "Todos os vendedores";

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">CRM de Propostas</h1>
          <p className="text-sm text-muted-foreground">
            Propostas em aberto · {vendedorAtual}
            {abertosAtualizadoEm && !buscarAntigas && (
              <span className="ml-2 text-xs text-gray-400" title="Lista de propostas abertas atualizada em segundo plano, não em tempo real">
                · atualizado {abertosAtualizadoEm}
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 self-start sm:self-auto">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      {/* Biblioteca de mídias: arsenal de imagens para copiar e colar nas conversas */}
      <BibliotecaMidias />

      {/* Alerta de atraso */}
      {propostasAtrasadas.length > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-xl p-4 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700">
              {propostasAtrasadas.length} proposta{propostasAtrasadas.length > 1 ? "s" : ""} com acompanhamento atrasado!
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Há datas de follow-up que já passaram sem contato registrado. Priorize essas propostas!
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {propostasAtrasadas.slice(0, 5).map(p => (
                <span key={p.id} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium border border-red-200">
                  #{p.sequencial || p.id} — {p.nomeCliente.slice(0, 20)}
                </span>
              ))}
              {propostasAtrasadas.length > 5 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium border border-red-200">
                  +{propostasAtrasadas.length - 5} mais
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-abas do CRM */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-4">
          <TabsTrigger value="propostas" className="gap-1.5">
            Propostas
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{propostasAtivas.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-1.5">
            Agenda de Hoje
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700">{agendaDiaria.faixa1.length + agendaDiaria.faixa2.length + agendaDiaria.faixa3.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="sugestoes" className="gap-1.5">
            <Target className="w-3.5 h-3.5" />
            Sugestões de Contato
            {sugestoesData && sugestoesData.sugestoes.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-indigo-100 text-indigo-700">{sugestoesData.sugestoes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">
            Histórico
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{propostasHistorico.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        {/* ABA: Propostas */}
        <TabsContent value="propostas" className="space-y-4 mt-0">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 bg-white border rounded-xl p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Vendedor
          </label>
          <Select value={vendedor || "__todos__"} onValueChange={v => setVendedor(v === "__todos__" ? "" : v)}>
            <SelectTrigger className="h-9 text-sm w-48"><SelectValue placeholder="Todos os vendedores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos os vendedores</SelectItem>
              {(vendedoresData ?? []).map((v: { nome: string }) => (
                <SelectItem key={v.nome} value={v.nome}>{v.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> De
          </label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
            className="h-9 px-3 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Até</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
            className="h-9 px-3 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Hoje", di: `${anoAtual}-${pad(mesAtual)}-${pad(now.getDate())}`, df: `${anoAtual}-${pad(mesAtual)}-${pad(now.getDate())}` },
            { label: "7 dias", di: (() => { const d = new Date(now); d.setDate(now.getDate()-6); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; })(), df: `${anoAtual}-${pad(mesAtual)}-${pad(now.getDate())}` },
            { label: "15 dias", di: (() => { const d = new Date(now); d.setDate(now.getDate()-14); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; })(), df: `${anoAtual}-${pad(mesAtual)}-${pad(now.getDate())}` },
            { label: "Este mês", di: `${anoAtual}-${pad(mesAtual)}-01`, df: `${anoAtual}-${pad(mesAtual)}-${pad(lastDay)}` },
          ].map(p => (
            <button key={p.label} onClick={() => { setDataInicio(p.di); setDataFim(p.df); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${dataInicio === p.di && dataFim === p.df ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"}`}>
              {p.label}
            </button>
          ))}
        </div>
        {/* Filtro Contatar Hoje */}
        {(() => {
          const hojeKey = toDateKey(new Date());
          const countHoje = propostas.filter(p => !p.meta2Contatos && getDates(p.dataCriacao, faixasConfig[3].diasFim).some(d => toDateKey(d) === hojeKey)).length;
          return (
            <button onClick={() => setApenasHoje(!apenasHoje)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                apenasHoje
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-500 hover:text-blue-600"
              }`}>
              <Calendar className="w-3.5 h-3.5" />
              {apenasHoje ? "Hoje ✕" : "Contatar Hoje"}
              {countHoje > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  apenasHoje ? "bg-white text-blue-600" : "bg-blue-100 text-blue-700"
                }`}>{countHoje}</span>
              )}
            </button>
          );
        })()}
        {/* Filtro clientes novos */}
        <button onClick={() => setApenasNovos(!apenasNovos)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${apenasNovos ? "bg-amber-400 text-white border-amber-400 shadow-sm" : "bg-white text-gray-600 border-gray-300 hover:border-amber-400 hover:text-amber-600"}`}>
          <Star className="w-3.5 h-3.5" /> {apenasNovos ? "Apenas novos ✕" : "Clientes novos"}
        </button>
        {/* Filtro por faixa */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Faixa do dia</label>
          <Select value={filtroFaixa} onValueChange={setFiltroFaixa}>
            <SelectTrigger className="h-9 text-sm w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as faixas</SelectItem>
              <SelectItem value="faixa1">{faixasConfig[1].label}</SelectItem>
              <SelectItem value="faixa2">{faixasConfig[2].label}</SelectItem>
              <SelectItem value="faixa3">{faixasConfig[3].label}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Buscar propostas mais antigas (raro: proposta aberta há mais de 15 dias) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-transparent select-none">.</label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => setBuscarAntigas(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all h-9 ${
                    buscarAntigas ? "bg-slate-700 text-white border-slate-700 shadow-sm" : "bg-white text-gray-600 border-gray-300 hover:border-slate-500"
                  }`}>
                  <Clock className="w-3.5 h-3.5" />
                  {buscarAntigas ? "Buscando até 30 dias ✕" : "Buscar mais antigas"}
                  {isLoading && buscarAntigas && <Spinner className="size-3" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[220px]">
                Por padrão, o CRM busca propostas abertas nos últimos 15 dias. Ative para incluir até 30 dias — a busca pode demorar mais.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {/* Score de Probabilidade de Compra (Fase 1) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Probabilidade
          </label>
          <div className="flex gap-2">
            <Select value={filtroProbabilidade} onValueChange={(v: any) => setFiltroProbabilidade(v)}>
              <SelectTrigger className="h-9 text-sm w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="alta">🟢 Alta (≥50%)</SelectItem>
                <SelectItem value="media">🟡 Média (25-49%)</SelectItem>
                <SelectItem value="baixa">🔴 Baixa (&lt;25%)</SelectItem>
              </SelectContent>
            </Select>
            <button onClick={() => setOrdenarPorProbabilidade(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all h-9 ${
                ordenarPorProbabilidade ? "bg-green-600 text-white border-green-600 shadow-sm" : "bg-white text-gray-600 border-gray-300 hover:border-green-500"
              }`}>
              <TrendingUp className="w-3.5 h-3.5" /> {ordenarPorProbabilidade ? "Ordenado ✕" : "Ordenar"}
            </button>
          </div>
        </div>
        {/* Filtro por estado do cliente (MS) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-transparent select-none">.</label>
          <button onClick={() => setApenasMS(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all h-9 ${
              apenasMS ? "bg-slate-700 text-white border-slate-700 shadow-sm" : "bg-white text-gray-600 border-gray-300 hover:border-slate-500"
            }`}>
            {apenasMS ? "Só MS ✕" : "Só MS"}
          </button>
        </div>
      </div>

      {/* Filtro por tipo de resposta */}
      <div className="flex flex-wrap gap-2 items-start">
        {[
          { value: "todos", label: "Todos", emoji: "📋", cls: "bg-gray-100 text-gray-700 border-gray-200", scriptFaixa: null },
          { value: "sem_contato", label: "Sem contato", emoji: "⬜", cls: "bg-gray-50 text-gray-600 border-gray-200", scriptFaixa: null },
          { value: "_pos_orcamento", label: "Pós-orçamento", emoji: "📨", cls: "bg-blue-100 text-blue-700 border-blue-200", scriptFaixa: 0 },
          { value: "nao_retornou", label: "Não retornou", emoji: "🔴", cls: "bg-red-100 text-red-700 border-red-200", scriptFaixa: 11 },
          { value: "esperando_cliente", label: "Esperando cliente", emoji: "🟡", cls: "bg-amber-100 text-amber-700 border-amber-200", scriptFaixa: 12 },
          { value: "garantiu_fechamento", label: "Garantiu fechamento", emoji: "🟢", cls: "bg-green-100 text-green-700 border-green-200", scriptFaixa: 13 },
          { value: "aguardando_resposta", label: "Aguardando resposta", emoji: "🔵", cls: "bg-sky-100 text-sky-700 border-sky-200", scriptFaixa: null },
          { value: "_objecoes", label: "Objeções Preço", emoji: "💰", cls: "bg-violet-100 text-violet-800 border-violet-300", scriptFaixa: 20 },
        ].map(o => (
          <div key={o.value} className="flex flex-col items-center gap-1">
            <button onClick={() => { if (o.value !== "_objecoes" && o.value !== "_pos_orcamento") setFiltroResposta(o.value); }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${o.cls} ${filtroResposta === o.value ? "ring-2 ring-offset-1 ring-gray-400 opacity-100" : "opacity-60 hover:opacity-100"}`}>
              {o.emoji} {o.label}
            </button>
            {o.scriptFaixa !== null && (
              <ScriptsFaixaPopover
                faixa={o.scriptFaixa as 0 | 1 | 2 | 3 | 11 | 12 | 13 | 20}
                label={o.label}
                bgCls={o.cls}
                nomeCliente="{nome_cliente}"
                produto="{produto}"
                valor="{valor}"
                vendedor="{vendedor}"
              >
                <button className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium transition-all ${o.cls} opacity-70 hover:opacity-100`}>
                  <MessageCircle className="w-2.5 h-2.5" /> Scripts
                </button>
              </ScriptsFaixaPopover>
            )}
          </div>
        ))}
      </div>

      {/* Cards de estatísticas */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalAberto}</div>
            <div className="text-xs text-muted-foreground mt-1">Propostas abertas</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-red-600">{stats.semContato}</div>
            <div className="text-xs text-muted-foreground mt-1">Sem contato</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.com1Contato}</div>
            <div className="text-xs text-muted-foreground mt-1">1 contato feito</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-green-600">{stats.contatosHoje}</div>
            <div className="text-xs text-muted-foreground mt-1">Contatos hoje</div>
          </div>
        </div>
      )}

      {/* Tabela principal */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h2 className="font-bold text-sm flex items-center gap-2">
            Propostas em Aberto <Badge variant="secondary">{propostasAtivas.length}</Badge>
          </h2>
          <span className="text-xs text-muted-foreground hidden sm:block">
            Clique no nº → Ganho/Perdido · Clique na célula → registrar contato · Clique no emoji → desfazer
          </span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Spinner className="size-5" />
            <span className="text-sm">Carregando propostas do ERP...</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <span className="text-sm font-semibold text-red-700">Não foi possível carregar as propostas.</span>
            <span className="text-xs text-muted-foreground max-w-md">
              {buscarAntigas
                ? "A busca de propostas mais antigas pode demorar e falhar em horários de lentidão do ERP. Tente novamente em alguns minutos."
                : (error?.message || "Tente novamente em instantes.")}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-1 gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Tentar de novo
            </Button>
          </div>
        ) : propostasAtivas.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><CheckSquare className="text-green-400" /></EmptyMedia>
              <EmptyTitle>Nenhuma proposta encontrada.</EmptyTitle>
              <EmptyDescription>Tente ajustar os filtros.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº OS</TableHead>
                  <TableHead>Miniatura / Razão Social</TableHead>
                  <TableHead>Nome do Cliente</TableHead>
                  {showVendedor && <TableHead>Vendedor</TableHead>}
                  <TableHead>Faixas de Acompanhamento</TableHead>
                  <TableHead className="text-center">Perdida</TableHead>
                  <TableHead className="text-center">Venci</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propostasAtivas.map(p => (
                  <PropostaRow key={p.id} p={p} vendedor={vendedor || user?.name || ""} onRefresh={refetch} showVendedor={showVendedor} faixasConfig={faixasConfig} />
                ))}
              </TableBody>
            </Table>
        )}
      </div>

      {/* Histórico */}
        </TabsContent>

        {/* ABA: Agenda de Hoje */}
        <TabsContent value="agenda" className="mt-0">
          <div className="space-y-4">
      {/* Painel de Agenda Diária */}
      {(agendaDiaria.faixa1.length > 0 || agendaDiaria.faixa2.length > 0 || agendaDiaria.faixa3.length > 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-blue-800">Agenda de Hoje — Propostas para Contato</h3>
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200 font-medium">
              {agendaDiaria.faixa1.length + agendaDiaria.faixa2.length + agendaDiaria.faixa3.length} proposta{(agendaDiaria.faixa1.length + agendaDiaria.faixa2.length + agendaDiaria.faixa3.length) !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Faixa 1 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-xs font-bold text-yellow-700 mb-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                {faixasConfig[1].label}
                <span className="ml-auto bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-yellow-200">
                  {agendaDiaria.faixa1.length}
                </span>
              </div>
              {agendaDiaria.faixa1.length === 0 ? (
                <p className="text-xs text-yellow-600 italic">Nenhuma proposta hoje</p>
              ) : (
                <div className="space-y-1">
                  {agendaDiaria.faixa1.map(p => (
                    <div key={p.id} className="flex items-center gap-2 bg-white rounded border border-yellow-100 px-2 py-1">
                      <span className="text-xs font-bold text-yellow-700">#{p.sequencial || p.id}</span>
                      <span className="text-xs text-gray-700 truncate flex-1" title={p.nomeCliente}>{p.nomeCliente}</span>
                      {p.clienteNovo && <Star className="w-3 h-3 text-yellow-500 fill-yellow-400 flex-shrink-0" aria-label="Cliente novo" />}
                      <WhatsAppAgendaBotao p={p} faixa={1} faixasConfig={faixasConfig} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Faixa 2 */}
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
              <div className="text-xs font-bold text-pink-700 mb-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />
                {faixasConfig[2].label}
                <span className="ml-auto bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-pink-200">
                  {agendaDiaria.faixa2.length}
                </span>
              </div>
              {agendaDiaria.faixa2.length === 0 ? (
                <p className="text-xs text-pink-600 italic">Nenhuma proposta hoje</p>
              ) : (
                <div className="space-y-1">
                  {agendaDiaria.faixa2.map(p => (
                    <div key={p.id} className="flex items-center gap-2 bg-white rounded border border-pink-100 px-2 py-1">
                      <span className="text-xs font-bold text-pink-700">#{p.sequencial || p.id}</span>
                      <span className="text-xs text-gray-700 truncate flex-1" title={p.nomeCliente}>{p.nomeCliente}</span>
                      {p.clienteNovo && <Star className="w-3 h-3 text-yellow-500 fill-yellow-400 flex-shrink-0" aria-label="Cliente novo" />}
                      <WhatsAppAgendaBotao p={p} faixa={2} faixasConfig={faixasConfig} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Faixa 3 */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="text-xs font-bold text-orange-700 mb-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                {faixasConfig[3].label}
                <span className="ml-auto bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-orange-200">
                  {agendaDiaria.faixa3.length}
                </span>
              </div>
              {agendaDiaria.faixa3.length === 0 ? (
                <p className="text-xs text-orange-600 italic">Nenhuma proposta hoje</p>
              ) : (
                <div className="space-y-1">
                  {agendaDiaria.faixa3.map(p => (
                    <div key={p.id} className="flex items-center gap-2 bg-white rounded border border-orange-100 px-2 py-1">
                      <span className="text-xs font-bold text-orange-700">#{p.sequencial || p.id}</span>
                      <span className="text-xs text-gray-700 truncate flex-1" title={p.nomeCliente}>{p.nomeCliente}</span>
                      {p.clienteNovo && <Star className="w-3 h-3 text-yellow-500 fill-yellow-400 flex-shrink-0" aria-label="Cliente novo" />}
                      <WhatsAppAgendaBotao p={p} faixa={3} faixasConfig={faixasConfig} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
          </div>
        </TabsContent>

        {/* ABA: Sugestões de Contato */}
        <TabsContent value="sugestoes" className="space-y-4 mt-0">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-indigo-800">Sugestões de Contato — Reengajamento da Carteira</h3>
            </div>
            <p className="text-xs text-indigo-700">
              Clientes que pararam de comprar, ordenados pelo score interno de potencial de recompra. Ligue e confirme o contato — a lista se renova mensalmente.
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-indigo-700">
              <span className="font-semibold">{sugestoesData?.sugestoes.length ?? 0} pendente{(sugestoesData?.sugestoes.length ?? 0) !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{sugestoesData?.contatadasEsteMes ?? 0} contatado{(sugestoesData?.contatadasEsteMes ?? 0) !== 1 ? "s" : ""} este mês</span>
            </div>
          </div>

          {sugestoesLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (sugestoesData?.sugestoes.length ?? 0) === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Target className="text-indigo-400" /></EmptyMedia>
                <EmptyTitle>Nenhuma sugestão pendente</EmptyTitle>
                <EmptyDescription>Todos os clientes com atraso na recompra já foram contatados neste ciclo.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-2">
              {sugestoesData!.sugestoes.map(s => (
                <SugestaoContatoCard key={s.id} s={s} vendedor={vendedor} showVendedor={!vendedor} onRefresh={refetchSugestoes} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ABA: Histórico */}
        <TabsContent value="historico" className="mt-0">
          <div className="space-y-4">
      {propostasHistorico.length > 0 && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <button className="w-full px-5 py-3 border-b flex items-center justify-between hover:bg-gray-50 transition-colors" onClick={() => setVerHistorico(v => !v)}>
            <h2 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              Histórico — 2 contatos realizados <Badge variant="outline">{propostasHistorico.length}</Badge>
            </h2>
            {verHistorico ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {verHistorico && (
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº OS</TableHead>
                    <TableHead>Miniatura / Razão Social</TableHead>
                    <TableHead>Nome do Cliente</TableHead>
                    {showVendedor && <TableHead>Vendedor</TableHead>}
                    <TableHead>Faixas</TableHead>
                    <TableHead className="text-center">Perdida</TableHead>
                    <TableHead className="text-center">Venci</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propostasHistorico.map(p => (
                    <PropostaRow key={p.id} p={p} vendedor={vendedor || user?.name || ""} onRefresh={refetch} showVendedor={showVendedor} faixasConfig={faixasConfig} />
                  ))}
                </TableBody>
              </Table>
          )}
        </div>
      )}
          </div>
        </TabsContent>

        {/* ABA: Auditoria */}
        <TabsContent value="auditoria" className="mt-0 space-y-5">
          {/* Filtros de Auditoria */}
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              {/* Filtro Vendedor */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Vendedor
                </label>
                <Select value={audVendedor} onValueChange={setAudVendedor}>
                  <SelectTrigger className="h-9 text-sm w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__todos__">Todos os vendedores</SelectItem>
                    {(vendedoresData ?? []).map((v: { nome: string }) => (
                      <SelectItem key={v.nome} value={v.nome}>{v.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Filtro Data Início */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> De
                </label>
                <input type="date" value={audDataInicio} onChange={e => setAudDataInicio(e.target.value)}
                  className="h-9 px-3 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              {/* Filtro Data Fim */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Até</label>
                <input type="date" value={audDataFim} onChange={e => setAudDataFim(e.target.value)}
                  className="h-9 px-3 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              {/* Atalhos de período */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Hoje", fn: () => { const d = new Date(); const s = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; setAudDataInicio(s); setAudDataFim(s); } },
                  { label: "Semana", fn: () => { const d = new Date(); const e = new Date(d); e.setDate(d.getDate()-6); setAudDataInicio(`${e.getFullYear()}-${pad(e.getMonth()+1)}-${pad(e.getDate())}`); setAudDataFim(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`); } },
                  { label: "Este mês", fn: () => { const d = new Date(); const ld = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); setAudDataInicio(`${d.getFullYear()}-${pad(d.getMonth()+1)}-01`); setAudDataFim(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(ld)}`); } },
                  { label: "2 meses", fn: () => { const d = new Date(); const i = new Date(d); i.setDate(1); i.setMonth(i.getMonth()-1); setAudDataInicio(`${i.getFullYear()}-${pad(i.getMonth()+1)}-01`); setAudDataFim(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`); } },
                ].map(p => (
                  <button key={p.label} onClick={p.fn}
                    className="px-3 py-1.5 text-xs font-semibold rounded-full border bg-white text-gray-600 border-gray-300 hover:border-gray-500 hover:bg-gray-50 transition-all">
                    {p.label}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => auditoriaRefetch()} className="gap-1.5 ml-auto">
                <RefreshCw className="w-3.5 h-3.5" /> Atualizar
              </Button>
            </div>
          </div>

          {auditoriaLoading && (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Spinner className="size-5" />
              <span className="text-sm">Carregando dados de auditoria...</span>
            </div>
          )}

          {!auditoriaLoading && auditoriaData && (() => {
            const aud = auditoriaData;
            const totalAcoes = aud.blocoF.reduce((s, v) => s + v.totalContatos + v.totalDescartes, 0);
            const totalContatos = aud.blocoF.reduce((s, v) => s + v.totalContatos, 0);
            void aud.blocoC; // blocoC usado para descartes, não ganhas
            const totalExclusoes = aud.resumoExclusoes.total;

            return (
              <div className="space-y-5">
                {/* Diagnóstico executivo */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 font-medium">
                  {aud.blocoG}
                </div>

                {/* Cards de resumo */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white border rounded-xl p-4 shadow-sm">
                    <div className="text-xs text-muted-foreground mb-1 font-medium">Total de Ações</div>
                    <div className="text-2xl font-bold text-gray-900">{totalAcoes}</div>
                    <div className="text-xs text-muted-foreground mt-1">{aud.vendedores.length} vendedor{aud.vendedores.length !== 1 ? 'es' : ''}</div>
                  </div>
                  <div className="bg-white border rounded-xl p-4 shadow-sm">
                    <div className="text-xs text-muted-foreground mb-1 font-medium">Contatos Registrados</div>
                    <div className="text-2xl font-bold text-green-600">{totalContatos}</div>
                    <div className="text-xs text-muted-foreground mt-1">no período</div>
                  </div>
                  <div className="bg-white border rounded-xl p-4 shadow-sm">
                    <div className="text-xs text-muted-foreground mb-1 font-medium">No Limbo</div>
                    <div className="text-2xl font-bold text-amber-600">{aud.blocoD.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">sem contato +3 dias</div>
                  </div>
                  <div className="bg-white border rounded-xl p-4 shadow-sm">
                    <div className="text-xs text-muted-foreground mb-1 font-medium">Exclusões</div>
                    <div className="text-2xl font-bold text-red-600">{totalExclusoes}</div>
                    <div className="text-xs text-muted-foreground mt-1">{aud.resumoExclusoes.comTodasFaixas} com 3 faixas preenchidas</div>
                  </div>
                </div>

                {/* Ranking de engajamento */}
                {aud.blocoF.length > 0 && (
                  <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b bg-gray-50">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" /> Ranking de Engajamento
                      </h3>
                    </div>
                    <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Vendedor</TableHead>
                            <TableHead className="text-center">Contatos</TableHead>
                            <TableHead className="text-center">Descartes</TableHead>
                            <TableHead className="text-center">Aderência</TableHead>
                            <TableHead className="text-center">Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {aud.blocoF.map((v, i) => (
                            <TableRow key={v.vendedor}>
                              <TableCell className="font-bold text-muted-foreground">{i+1}º</TableCell>
                              <TableCell className="font-medium">{v.vendedor}</TableCell>
                              <TableCell className="text-center">
                                <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />{v.totalContatos}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                  <Trash2 className="w-3.5 h-3.5" />{v.totalDescartes}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className={`font-semibold ${
                                  v.aderencia >= 80 ? 'text-green-600' : v.aderencia >= 50 ? 'text-amber-600' : 'text-red-600'
                                }`}>{v.aderencia}%</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="font-bold text-blue-700">{v.score}</span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                  </div>
                )}

                {/* Contatos por faixa */}
                {aud.blocoB.length > 0 && (
                  <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b bg-gray-50">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Target className="w-4 h-4 text-purple-600" /> Volume de Contatos por Faixa
                      </h3>
                    </div>
                    <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vendedor</TableHead>
                            <TableHead className="text-center">Faixa 1 (D+1 a D+5)</TableHead>
                            <TableHead className="text-center">Faixa 2 (D+6 a D+10)</TableHead>
                            <TableHead className="text-center">Faixa 3 (D+11 a D+15)</TableHead>
                            <TableHead className="text-center">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {aud.blocoB.map(v => (
                            <TableRow key={v.vendedor}>
                              <TableCell className="font-medium">{v.vendedor}</TableCell>
                              <TableCell className="text-center">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">{v.faixa1}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-sm">{v.faixa2}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 font-bold text-sm">{v.faixa3}</span>
                              </TableCell>
                              <TableCell className="text-center font-bold">{v.total}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                  </div>
                )}

                {/* Exclusões de contato */}
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-red-500" /> Contatos Excluídos
                      <Badge variant="secondary" className="text-xs">{totalExclusoes}</Badge>
                    </h3>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                        {aud.resumoExclusoes.comTodasFaixas} com 3 faixas completas
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>
                        {aud.resumoExclusoes.semNenhumaFaixa} sem nenhuma faixa
                      </span>
                    </div>
                  </div>
                  {aud.blocoH.length === 0 ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>Nenhuma exclusão registrada no período.</EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Vendedor</TableHead>
                            <TableHead>OS</TableHead>
                            <TableHead className="text-center">Faixa 1</TableHead>
                            <TableHead className="text-center">Faixa 2</TableHead>
                            <TableHead className="text-center">Faixa 3</TableHead>
                            <TableHead className="text-center">Completo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {aud.blocoH.map((e, i) => {
                            const dt = new Date(e.dataExclusao);
                            const hBr = ((dt.getUTCHours() - 3) + 24) % 24;
                            const dtBr = new Date(dt.getTime() - 3*60*60*1000);
                            const dataFmt = `${String(dtBr.getUTCDate()).padStart(2,'0')}/${String(dtBr.getUTCMonth()+1).padStart(2,'0')} ${String(hBr).padStart(2,'0')}:${String(dt.getUTCMinutes()).padStart(2,'0')}`;
                            return (
                              <TableRow key={i} className={e.todasFaixas ? 'bg-red-50' : ''}>
                                <TableCell className="text-xs text-muted-foreground font-mono">{dataFmt}</TableCell>
                                <TableCell className="font-medium max-w-[180px] truncate" title={e.empresa}>{e.empresa || '—'}</TableCell>
                                <TableCell className="text-sm">{e.vendedor}</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-mono">{e.orcamentoId || '—'}</TableCell>
                                <TableCell className="text-center">{e.temFaixa1 ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-300 text-lg">·</span>}</TableCell>
                                <TableCell className="text-center">{e.temFaixa2 ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-300 text-lg">·</span>}</TableCell>
                                <TableCell className="text-center">{e.temFaixa3 ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-300 text-lg">·</span>}</TableCell>
                                <TableCell className="text-center">
                                  {e.todasFaixas
                                    ? <Badge variant="destructive" className="text-[10px] px-1.5 py-0">3/3</Badge>
                                    : <span className="text-xs text-muted-foreground">{e.faixasCompletas}/3</span>
                                  }
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                  )}
                </div>

                {/* Propostas no limbo */}
                {aud.blocoD.length > 0 && (
                  <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b bg-gray-50">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" /> Propostas no Limbo
                        <Badge variant="secondary" className="text-xs">{aud.blocoD.length}</Badge>
                      </h3>
                    </div>
                    <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Vendedor</TableHead>
                            <TableHead className="text-center">Dias sem contato</TableHead>
                            <TableHead className="text-center">Risco</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {aud.blocoD.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium max-w-[200px] truncate" title={p.empresa}>{p.empresa}</TableCell>
                              <TableCell>{p.vendedor}</TableCell>
                              <TableCell className="text-center font-bold">{p.diasSemContato}</TableCell>
                              <TableCell className="text-center">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  p.risco === 'critico' ? 'bg-red-100 text-red-700' :
                                  p.risco === 'alto' ? 'bg-orange-100 text-orange-700' :
                                  p.risco === 'medio' ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>{p.risco}</span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                  </div>
                )}

                {/* Alertas de velocidade */}
                {aud.blocoE.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-red-200">
                      <h3 className="font-semibold text-sm flex items-center gap-2 text-red-700">
                        <Zap className="w-4 h-4" /> Alertas de Velocidade Suspeita
                      </h3>
                    </div>
                    <div className="p-4 space-y-2">
                      {aud.blocoE.map((a, i) => {
                        const dt = new Date(a.dataHora);
                        const dtBr = new Date(dt.getTime() - 3*60*60*1000);
                        const hBr = ((dt.getUTCHours()-3)+24)%24;
                        return (
                          <div key={i} className="flex items-start gap-3 bg-white border border-red-200 rounded-lg p-3">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <span className="font-semibold text-red-700">{a.vendedor}</span>
                              {' '}registrou{' '}
                              <span className="font-bold">{a.qtdAcoes} ações</span>
                              {' '}em menos de 10 minutos
                              {' '}({String(hBr).padStart(2,'0')}:{String(dtBr.getUTCMinutes()).padStart(2,'0')} em {String(dtBr.getUTCDate()).padStart(2,'0')}/{String(dtBr.getUTCMonth()+1).padStart(2,'0')})
                              {a.intervaloMedioSeg > 0 && <span className="text-muted-foreground"> — intervalo médio: {a.intervaloMedioSeg}s</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Aderência à rotina */}
                {aud.blocoA.length > 0 && (
                  <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b bg-gray-50">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-600" /> Aderência à Rotina (Manhã / Tarde)
                      </h3>
                    </div>
                    <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vendedor</TableHead>
                            <TableHead className="text-center">Manhãs OK</TableHead>
                            <TableHead className="text-center">Tardes OK</TableHead>
                            <TableHead className="text-center">Total Dias</TableHead>
                            <TableHead className="text-center">Aderência</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {aud.blocoA.map(v => (
                            <TableRow key={v.vendedor}>
                              <TableCell className="font-medium">{v.vendedor}</TableCell>
                              <TableCell className="text-center">{v.manhasOk}/{v.totalDias}</TableCell>
                              <TableCell className="text-center">{v.tardesOk}/{v.totalDias}</TableCell>
                              <TableCell className="text-center">{v.totalDias}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center gap-2 justify-center">
                                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${
                                      v.aderencia >= 80 ? 'bg-green-500' : v.aderencia >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                    }`} style={{ width: `${v.aderencia}%` }} />
                                  </div>
                                  <span className={`font-semibold text-xs ${
                                    v.aderencia >= 80 ? 'text-green-600' : v.aderencia >= 50 ? 'text-amber-600' : 'text-red-600'
                                  }`}>{v.aderencia}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                  </div>
                )}

                {aud.vendedores.length === 0 && (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>Nenhuma atividade registrada no período selecionado.</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
