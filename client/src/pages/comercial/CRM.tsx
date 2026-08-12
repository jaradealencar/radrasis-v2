import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  MessageCircle, Trophy, XCircle, Loader2, RefreshCw, Users, Calendar,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";
import { ScriptsFaixaPopover } from "@/components/ScriptsFaixaPopover";
import {
  Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";

// ─── Constantes ───────────────────────────────────────────────────────────────
const OPCOES_RESPOSTA = [
  { value: "nao_retornou" as const, label: "Não retornou", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50 border-red-200 hover:bg-red-100", badgeBg: "bg-red-100 text-red-700 border-red-200", emoji: "🔴" },
  { value: "esperando_cliente" as const, label: "Esperando cliente", icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-200 hover:bg-amber-100", badgeBg: "bg-amber-100 text-amber-700 border-amber-200", emoji: "🟡" },
  { value: "garantiu_fechamento" as const, label: "Garantiu fechamento", icon: ThumbsUp, color: "text-green-600", bg: "bg-green-50 border-green-200 hover:bg-green-100", badgeBg: "bg-green-100 text-green-700 border-green-200", emoji: "🟢" },
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
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtDate(s: string | Date | null | undefined) {
  if (!s) return "—";
  const d = typeof s === "string" ? new Date(s) : s;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function fmtShort(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
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
function getDates(dataCriacao: string): Date[] {
  const parsed = parseDateLocal(dataCriacao);
  if (!parsed) return [];
  const { y, m, d } = parsed;
  return Array.from({ length: 15 }, (_, i) => new Date(y, m - 1, d + i + 1));
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function buildWaLink(tel: string | null | undefined) {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${num}`;
}

function getCanalInfo(canal: string) {
  return OPCOES_RESPOSTA.find(o => o.value === canal) ?? null;
}

// ─── PropostaRow ─────────────────────────────────────────────────────────────
function PropostaRow({ p, vendedor, onRefresh, showVendedor }: {
  p: Proposta; vendedor: string; onRefresh: () => void; showVendedor: boolean;
}) {
  const [modalStatus, setModalStatus] = useState(false);
  // modalContato: null = fechado; { date, desfazer } = aberto
  const [modalContato, setModalContato] = useState<{ date: Date; desfazer: boolean } | null>(null);
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

  const desfazarContato = trpc.crm.desfazarContato.useMutation({
    onSuccess: () => {
      toast.success("Contato removido.");
      setModalContato(null);
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

  const dates = getDates(p.dataCriacao);
  const waLink = buildWaLink(p.telefone);

  // Mapear contatos por chave de data
  const contatoMap: Record<string, { canal: string }> = {};
  if (p.contato1?.data) {
    const d = new Date(p.contato1.data);
    contatoMap[toDateKey(d)] = { canal: p.contato1.canal };
  }
  if (p.contato2?.data) {
    const d = new Date(p.contato2.data);
    contatoMap[toDateKey(d)] = { canal: p.contato2.canal };
  }

  const hoje = new Date();
  const hojeKey = toDateKey(hoje);

  const rowBg = p.diasAberto > 15 ? "bg-red-50 hover:bg-red-100"
    : p.diasAberto > 7 ? "bg-amber-50 hover:bg-amber-100"
    : p.diasAberto > 3 ? "bg-yellow-50 hover:bg-yellow-100"
    : "bg-white hover:bg-gray-50";

  const confirmContato = () => {
    if (!modalContato || !respostaSelecionada) return;
    registrarContato.mutate({
      orcamentoId: p.id,
      vendedor: vendedor || p.vendedor,
      empresa: p.nomeCliente,
      canal: respostaSelecionada,
      observacao: obs || null,
      dataContato: modalContato.date.toISOString(),
    });
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
                onClick={(e) => { e.stopPropagation(); setModalContato({ date: dt, desfazer: true }); }}
                title={`${canalInfo.label} — clique para desfazer`}
                className="w-6 h-6 rounded flex items-center justify-center text-sm hover:opacity-70 transition-opacity cursor-pointer bg-white border border-gray-200 shadow-sm"
              >{canalInfo.emoji}</button>
            );
          }
          const isFuture = key > hojeKey;
          return (
            <button key={i}
              onClick={(e) => { e.stopPropagation(); setModalContato({ date: dt, desfazer: false }); setRespostaSelecionada(null); setObs(""); }}
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

  // Renderizar um grupo de células (faixa) — mantido para compatibilidade
  const renderFaixa = (faixaDates: Date[], label: string, bgCls: string) => (
    <div className={`rounded-lg border px-2 py-1.5 ${bgCls}`}>
      <div className="text-[9px] font-bold text-center text-gray-500 mb-1 uppercase tracking-wide">{label}</div>
      <div className="text-[8px] text-center text-gray-400 mb-1.5 leading-tight">
        {faixaDates.map(dt => fmtShort(dt)).join(" ")}
      </div>
      <div className="flex gap-1 justify-center">
        {faixaDates.map((dt, i) => {
          const key = toDateKey(dt);
          const isPast = key <= hojeKey;
          const contato = contatoMap[key];
          const canalInfo = contato ? getCanalInfo(contato.canal) : null;

          if (contato && canalInfo) {
            return (
              <button key={i}
                onClick={() => setModalContato({ date: dt, desfazer: true })}
                title={`${canalInfo.label} — clique para desfazer`}
                className="w-6 h-6 rounded flex items-center justify-center text-sm hover:opacity-70 transition-opacity cursor-pointer bg-white border border-gray-200 shadow-sm"
              >
                {canalInfo.emoji}
              </button>
            );
          }

          // Todas as células são clicáveis — futuras ficam levemente opacas mas ainda clicáveis
          const isFuture = key > hojeKey;
          return (
            <button key={i}
              onClick={() => { setModalContato({ date: dt, desfazer: false }); setRespostaSelecionada(null); setObs(""); }}
              title={`Registrar contato em ${fmtShort(dt)}`}
              className={`w-6 h-6 rounded border-2 bg-white active:scale-95 transition-all cursor-pointer flex items-center justify-center ${
                isFuture
                  ? "border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-400"
                  : "border-gray-300 hover:border-blue-500 hover:bg-blue-50"
              }`}
            >
              <span className="text-[7px] font-bold text-gray-500 leading-tight">{fmtShort(dt)}</span>
            </button>
          );
        })}
      </div>
    </div>
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
              </div>
              <div className="text-xs text-muted-foreground">{fmt(p.valor)}</div>
            </div>
          </div>
        </TableCell>

        {/* Nome do Contato / WhatsApp */}
        <TableCell className="min-w-[140px] whitespace-normal">
          <div className="text-sm font-medium">{p.nomeContato || "—"}</div>
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded-full border border-green-200 mt-1">
              <MessageCircle className="w-3 h-3" /> WhatsApp
            </a>
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
              faixa={1} label="Faixa 1 (1-3 du)" bgCls="bg-yellow-50 border-yellow-200"
              nomeCliente={p.nomeContato || p.nomeCliente}
              produto={`OS #${p.sequencial || p.id}`}
              valor={fmt(p.valor)}
              vendedor={p.vendedor}
            >
              {renderFaixaContent(dates.slice(0, 3))}
            </ScriptsFaixaPopover>
            <ScriptsFaixaPopover
              faixa={2} label="Faixa 2 (4-7 du)" bgCls="bg-pink-50 border-pink-200"
              nomeCliente={p.nomeContato || p.nomeCliente}
              produto={`OS #${p.sequencial || p.id}`}
              valor={fmt(p.valor)}
              vendedor={p.vendedor}
            >
              {renderFaixaContent(dates.slice(3, 7))}
            </ScriptsFaixaPopover>
            <ScriptsFaixaPopover
              faixa={3} label="Faixa 3 (8-15 du)" bgCls="bg-orange-50 border-orange-200"
              nomeCliente={p.nomeContato || p.nomeCliente}
              produto={`OS #${p.sequencial || p.id}`}
              valor={fmt(p.valor)}
              vendedor={p.vendedor}
            >
              {renderFaixaContent(dates.slice(7, 15))}
            </ScriptsFaixaPopover>
          </div>
        </TableCell>

        {/* Perdida */}
        <TableCell className="text-center">
          <button onClick={() => marcarPerdida.mutate({ orcamentoId: p.id, vendedor: vendedor || p.vendedor, empresa: p.nomeCliente })}
            disabled={marcarPerdida.isPending}
            className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center mx-auto transition-colors"
            title="Marcar como perdida">
            {marcarPerdida.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          </button>
        </TableCell>

        {/* Venci */}
        <TableCell className="text-center">
          <button onClick={() => marcarGanha.mutate({ orcamentoId: p.id, vendedor: vendedor || p.vendedor, empresa: p.nomeCliente })}
            disabled={marcarGanha.isPending}
            className="w-8 h-8 rounded-full bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center mx-auto transition-colors"
            title="Marcar como ganha">
            {marcarGanha.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trophy className="w-3.5 h-3.5" />}
          </button>
        </TableCell>
      </TableRow>

      {/* Modal: registrar contato */}
      <Dialog open={!!modalContato && !modalContato?.desfazer} onOpenChange={() => setModalContato(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Contato — {modalContato ? fmtShort(modalContato.date) : ""}</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-semibold">{p.nomeCliente}</p>
          <p className="text-xs text-muted-foreground mb-3">Qual foi a resposta do cliente?</p>
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
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setModalContato(null)}>Cancelar</Button>
            <Button size="sm" onClick={confirmContato} disabled={!respostaSelecionada || registrarContato.isPending} className="gap-1">
              {registrarContato.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: desfazer contato */}
      <Dialog open={!!modalContato?.desfazer} onOpenChange={() => setModalContato(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Desfazer contato?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Isso removerá o registro de contato de {modalContato ? fmtShort(modalContato.date) : ""}. Tem certeza?
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setModalContato(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={confirmDesfazer} disabled={desfazarContato.isPending} className="gap-1">
              {desfazarContato.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Remover contato
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
              {marcarGanha.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />} Ganha
            </Button>
            <Button variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2"
              onClick={() => marcarPerdida.mutate({ orcamentoId: p.id, vendedor: vendedor || p.vendedor, empresa: p.nomeCliente })}
              disabled={marcarPerdida.isPending}>
              {marcarPerdida.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Perdida
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
  const [filtroResposta, setFiltroResposta] = useState<string>("todos");
  const [filtroFaixa, setFiltroFaixa] = useState<string>("todas");
  const [abaAtiva, setAbaAtiva] = useState<string>("propostas");

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

  const { data, isLoading, refetch } = trpc.crm.getPropostas.useQuery(
    { vendedor: vendedor || undefined, preset: "personalizado", dataInicio, dataFim },
    { refetchOnWindowFocus: false }
  );

  const { data: vendedoresData } = trpc.crm.getVendedores.useQuery(undefined, { refetchOnWindowFocus: false });

  const propostas: Proposta[] = (data?.propostas ?? []) as Proposta[];
  const stats = data?.stats;

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
      const hoje = new Date();
      const hojeKey = `${hoje.getFullYear()}-${hoje.getMonth()}-${hoje.getDate()}`;
      list = list.filter(p => {
        const dates = getDates(p.dataCriacao);
        if (dates.length === 0) return false;
        const faixa1Dates = dates.slice(0, 5);
        const faixa2Dates = dates.slice(5, 10);
        const faixa3Dates = dates.slice(10, 15);
        const inFaixa = (fd: Date[]) => fd.some(d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === hojeKey);
        if (filtroFaixa === "faixa1") return inFaixa(faixa1Dates);
        if (filtroFaixa === "faixa2") return inFaixa(faixa2Dates);
        if (filtroFaixa === "faixa3") return inFaixa(faixa3Dates);
        return true;
      });
    }
    if (apenasHoje) {
      const hoje = new Date();
      const hojeKey = toDateKey(hoje);
      list = list.filter(p => {
        const dates = getDates(p.dataCriacao);
        return dates.some(d => toDateKey(d) === hojeKey);
      });
      // Ordenar do maior para o menor valor quando filtro Hoje estiver ativo
      list = [...list].sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0));
    }
    return list;
  }, [propostas, apenasNovos, apenasHoje, filtroResposta, filtroFaixa]);

  const propostasHistorico = useMemo(() => propostas.filter(p => p.meta2Contatos), [propostas]);
  const showVendedor = !vendedor;

  // Alerta de acompanhamento atrasado
  const propostasAtrasadas = useMemo(() => {
    const hoje = new Date();
    const hojeKey = toDateKey(hoje);
    return propostasAtivas.filter(p => {
      const dates = getDates(p.dataCriacao);
      const contatosDatas = new Set<string>();
      if (p.contato1?.data) { const d = new Date(p.contato1.data); contatosDatas.add(toDateKey(d)); }
      if (p.contato2?.data) { const d = new Date(p.contato2.data); contatosDatas.add(toDateKey(d)); }
      return dates.some(dt => {
        const key = toDateKey(dt);
        return key < hojeKey && !contatosDatas.has(key);
      });
    });
  }, [propostasAtivas]);

  // Painel de agenda diária: propostas que têm hoje dentro de sua faixa e ainda sem contato hoje
  const agendaDiaria = useMemo(() => {
    const hoje = new Date();
    const hojeKey = toDateKey(hoje);
    const faixa1: Proposta[] = [];
    const faixa2: Proposta[] = [];
    const faixa3: Proposta[] = [];
    for (const p of propostasAtivas) {
      const dates = getDates(p.dataCriacao); // 15 datas: D+1..D+15
      const contatosDatas = new Set<string>();
      if (p.contato1?.data) { const d = new Date(p.contato1.data); contatosDatas.add(toDateKey(d)); }
      if (p.contato2?.data) { const d = new Date(p.contato2.data); contatosDatas.add(toDateKey(d)); }
      // Verificar se hoje está em alguma das faixas e sem contato
      for (let i = 0; i < 15; i++) {
        const key = toDateKey(dates[i]);
        if (key === hojeKey && !contatosDatas.has(key)) {
          if (i < 5) faixa1.push(p);
          else if (i < 10) faixa2.push(p);
          else faixa3.push(p);
          break;
        }
      }
    }
    return { faixa1, faixa2, faixa3 };
  }, [propostasAtivas]);

  const vendedorAtual = vendedor || "Todos os vendedores";

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">CRM de Propostas</h1>
          <p className="text-sm text-muted-foreground">Propostas em aberto · {vendedorAtual}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 self-start sm:self-auto">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

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
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="propostas" className="gap-1.5">
            Propostas
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{propostasAtivas.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-1.5">
            Agenda de Hoje
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700">{agendaDiaria.faixa1.length + agendaDiaria.faixa2.length + agendaDiaria.faixa3.length}</Badge>
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
          const hoje = new Date();
          const hojeKey = toDateKey(hoje);
          const countHoje = propostas.filter(p => !p.meta2Contatos && getDates(p.dataCriacao).some(d => toDateKey(d) === hojeKey)).length;
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
              <SelectItem value="faixa1">Faixa 1 (D+1 a D+5)</SelectItem>
              <SelectItem value="faixa2">Faixa 2 (D+6 a D+10)</SelectItem>
              <SelectItem value="faixa3">Faixa 3 (D+11 a D+15)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filtro por tipo de resposta */}
      <div className="flex flex-wrap gap-2 items-start">
        {[
          { value: "todos", label: "Todos", emoji: "📋", cls: "bg-gray-100 text-gray-700 border-gray-200", scriptFaixa: null },
          { value: "sem_contato", label: "Sem contato", emoji: "⬜", cls: "bg-gray-50 text-gray-600 border-gray-200", scriptFaixa: null },
          { value: "nao_retornou", label: "Não retornou", emoji: "🔴", cls: "bg-red-100 text-red-700 border-red-200", scriptFaixa: 11 },
          { value: "esperando_cliente", label: "Esperando cliente", emoji: "🟡", cls: "bg-amber-100 text-amber-700 border-amber-200", scriptFaixa: 12 },
          { value: "garantiu_fechamento", label: "Garantiu fechamento", emoji: "🟢", cls: "bg-green-100 text-green-700 border-green-200", scriptFaixa: 13 },
          { value: "_objecoes", label: "Objeções Preço", emoji: "💰", cls: "bg-violet-100 text-violet-800 border-violet-300", scriptFaixa: 20 },
        ].map(o => (
          <div key={o.value} className="flex flex-col items-center gap-1">
            <button onClick={() => { if (o.value !== "_objecoes") setFiltroResposta(o.value); }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${o.cls} ${filtroResposta === o.value ? "ring-2 ring-offset-1 ring-gray-400 opacity-100" : "opacity-60 hover:opacity-100"}`}>
              {o.emoji} {o.label}
            </button>
            {o.scriptFaixa !== null && (
              <ScriptsFaixaPopover
                faixa={o.scriptFaixa as 1 | 2 | 3 | 11 | 12 | 13 | 20}
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
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando propostas do ERP...</span>
          </div>
        ) : propostasAtivas.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CheckSquare className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <p className="text-sm font-medium">Nenhuma proposta encontrada.</p>
            <p className="text-xs mt-1">Tente ajustar os filtros.</p>
          </div>
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
                  <PropostaRow key={p.id} p={p} vendedor={vendedor || user?.name || ""} onRefresh={refetch} showVendedor={showVendedor} />
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
                Faixa 1 — D+1 a D+5
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
                      {p.telefone && (
                        <a href={buildWaLink(p.telefone) ?? "#"} target="_blank" rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700 flex-shrink-0" title="WhatsApp">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Faixa 2 */}
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
              <div className="text-xs font-bold text-pink-700 mb-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />
                Faixa 2 — D+6 a D+10
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
                      {p.telefone && (
                        <a href={buildWaLink(p.telefone) ?? "#"} target="_blank" rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700 flex-shrink-0" title="WhatsApp">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Faixa 3 */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="text-xs font-bold text-orange-700 mb-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                Faixa 3 — D+11 a D+15
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
                      {p.telefone && (
                        <a href={buildWaLink(p.telefone) ?? "#"} target="_blank" rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700 flex-shrink-0" title="WhatsApp">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
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
                    <PropostaRow key={p.id} p={p} vendedor={vendedor || user?.name || ""} onRefresh={refetch} showVendedor={showVendedor} />
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
              <Loader2 className="w-5 h-5 animate-spin" />
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
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                      Nenhuma exclusão registrada no período.
                    </div>
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
                  <div className="bg-gray-50 border rounded-xl p-8 text-center text-sm text-muted-foreground">
                    Nenhuma atividade registrada no período selecionado.
                  </div>
                )}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
