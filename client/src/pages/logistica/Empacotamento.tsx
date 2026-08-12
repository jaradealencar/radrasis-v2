import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Package, CheckCircle2, Clock, AlertCircle, Plus, Trash2, Search,
  Upload, FileImage, FileText, X, Eye, Camera, Images,
  DollarSign, Users, Calendar, BarChart3, Settings, RefreshCw,
  PackageCheck, Boxes, Timer, ChevronRight, ChevronDown,
  Play, Square, UserPlus, Edit2, Save, Check, ArrowRight,
  Truck, AlertTriangle, LayoutGrid, FileDown, Home
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";

// ─── Tipos internos ──────────────────────────────────────────────────────────
type KanbanStatus = "aguardando" | "embalando" | "patio" | "abandonado";
type Pedido = {
  id: number;
  numeroPedido: string;
  cliente: string;
  modeloId?: number | null;
  modeloNome?: string | null;
  modeloCaixaId?: number | null;
  modeloCaixaNome?: string | null;
  tipoCaixa: string;
  metrosQuadrados?: number | string | null;
  arquivoUrl?: string | null;
  arquivoTipo?: string | null;
  kanbanStatus: KanbanStatus;
  prazoEntrega?: Date | null;
  horarioMaximo?: string | null;
  observacoes?: string | null;
  finalizadoEm?: Date | null;
  larguraCm?: number | string | null;
  alturaCm?: number | string | null;
  profundidadeCm?: number | string | null;
  pesoKg?: number | string | null;
  cnpjCliente?: string | null;
  cepCliente?: string | null;
  enderecoCliente?: string | null;
  createdAt: Date;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────


// Compara datas por dia local (ignora hora) para evitar bug de timezone UTC
function toLocalDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function prazoLabel(prazo: Date | null | undefined, horario: string | null | undefined): string {
  if (!prazo) return "";
  const d = new Date(prazo);
  const hoje = new Date();
  const dataStr = d.toLocaleDateString("pt-BR");
  const horarioStr = horario ? ` até ${horario}` : "";
  const dLocal = toLocalDateOnly(d);
  const hojeLocal = toLocalDateOnly(hoje);
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
  const amanhaLocal = toLocalDateOnly(amanha);
  if (dLocal < hojeLocal) return `Atrasado — ${dataStr}${horarioStr}`;
  if (dLocal === hojeLocal) return `Hoje${horarioStr}`;
  if (dLocal === amanhaLocal) return `Amanhã${horarioStr}`;
  return `${dataStr}${horarioStr}`;
}

function prazoColor(prazo: Date | null | undefined): string {
  if (!prazo) return "text-gray-400";
  const d = new Date(prazo);
  const hoje = new Date();
  const dLocal = toLocalDateOnly(d);
  const hojeLocal = toLocalDateOnly(hoje);
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
  const amanhaLocal = toLocalDateOnly(amanha);
  if (dLocal < hojeLocal) return "text-red-600 font-bold";
  if (dLocal === hojeLocal || dLocal === amanhaLocal) return "text-orange-500 font-semibold";
  return "text-blue-600";
}

// ─── Temporizador persistente ────────────────────────────────────────────────
function formatarTempo(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

/**
 * Componente de temporizador persistente.
 * - Fonte de verdade: backend (sessão no banco).
 * - O tick local usa Date.now() para não depender de refetch.
 * - Ao pausar: o display congela no valor do banco (não zera).
 * - Ao minimizar/maximizar: o cálculo é sempre (agoraLocal - offset), nunca perde o estado.
 */
function TemporizadorSessao({
  pedidoId,
  operadorId,
  operadorNome,
  compact = false,
}: {
  pedidoId: number;
  operadorId: string;
  operadorNome: string;
  compact?: boolean;
}) {
  const utils = trpc.useUtils();
  const [displaySeg, setDisplaySeg] = useState(0);
  // offsetRef = timestamp local (ms) que corresponde a tempo=0 para a sessão ativa
  // Quando pausado, offsetRef = null e displaySeg fica congelado
  const offsetRef = useRef<number | null>(null);
  const acumuladoRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Busca sessões ativas, pausadas E finalizadas (para mostrar o tempo registrado)
  const { data: sessao, isLoading } = trpc.empacotamento.sessoes.getAtiva.useQuery(
    { pedidoId, operadorId },
    { refetchInterval: 8000, staleTime: 3000 }
  );

  const iniciarMutation = trpc.empacotamento.sessoes.iniciar.useMutation({
    onSuccess: () => utils.empacotamento.sessoes.getAtiva.invalidate({ pedidoId, operadorId }),
  });
  const pausarMutation = trpc.empacotamento.sessoes.pausar.useMutation({
    onSuccess: () => utils.empacotamento.sessoes.getAtiva.invalidate({ pedidoId, operadorId }),
  });
  const retomarMutation = trpc.empacotamento.sessoes.retomar.useMutation({
    onSuccess: () => utils.empacotamento.sessoes.getAtiva.invalidate({ pedidoId, operadorId }),
  });
  const registrarMutation = trpc.empacotamento.sessoes.registrar.useMutation({
    onSuccess: () => {
      utils.empacotamento.sessoes.getAtiva.invalidate({ pedidoId, operadorId });
      toast.success('Tempo registrado!');
    },
  });

  // Sincronizar com o banco sempre que a sessão mudar
  // LÓGICA: o backend retorna tempoAtualSegundos = totalSegundos + (agoraServidor - ultimaRetomada)
  // O frontend usa esse valor como base e adiciona o tempo local decorrido desde o fetch
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!sessao) { setDisplaySeg(0); offsetRef.current = null; return; }

    if (sessao.status === 'ativo') {
      // Usar tempoAtualSegundos do servidor como base
      // offset = timestamp local no momento do fetch - tempoAtualSegundos * 1000
      // Assim: displaySeg = floor((Date.now() - offset) / 1000) = tempoAtualSegundos + (agoraLocal - agoraFetch)
      const agoraMs = Date.now();
      const offset = agoraMs - sessao.tempoAtualSegundos * 1000;
      offsetRef.current = offset;
      setDisplaySeg(sessao.tempoAtualSegundos);
      intervalRef.current = setInterval(() => {
        if (offsetRef.current !== null) {
          const elapsed = Math.floor((Date.now() - offsetRef.current) / 1000);
          setDisplaySeg(elapsed);
        }
      }, 500);
    } else {
      // Pausado ou finalizado: congelar no totalSegundos (valor salvo no banco ao pausar)
      offsetRef.current = null;
      setDisplaySeg(sessao.totalSegundos);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // Reagir quando: id da sessão muda, status muda, ou o servidor retorna novo tempoAtualSegundos
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao?.id, sessao?.status, sessao?.tempoAtualSegundos]);

  const isPausado = sessao?.status === 'pausado';
  const isAtivo = sessao?.status === 'ativo';
  const isFinalizado = sessao?.status === 'finalizado';
  const temRegistro = !!sessao?.registradoEm;

  if (compact) {
    // Versão compacta para o card do kanban
    return (
      <div className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-mono font-bold ${
        isAtivo ? 'bg-emerald-900 text-emerald-300' :
        isPausado ? 'bg-amber-900 text-amber-300' :
        'bg-gray-800 text-gray-400'
      }`}>
        <Timer className="w-3 h-3 shrink-0" />
        <span>{formatarTempo(displaySeg)}</span>
        {isPausado && <span className="text-amber-400 text-[10px] font-sans">PAUSADO</span>}
        {temRegistro && <Check className="w-3 h-3 text-green-400" />}
      </div>
    );
  }

  // Versão completa para o modal
  return (
    <div className={`rounded-xl border p-3 space-y-2 ${
      isAtivo ? 'bg-emerald-50 border-emerald-200' :
      isPausado ? 'bg-amber-50 border-amber-200' :
      'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
          <Timer className="w-3.5 h-3.5" /> Temporizador
        </p>
        {temRegistro && (
          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
            <Check className="w-3 h-3" /> Registrado
          </span>
        )}
      </div>
      {/* Display principal */}
      <div className={`text-center py-2 rounded-lg font-mono text-3xl font-bold tracking-widest ${
        isAtivo ? 'text-emerald-700' :
        isPausado ? 'text-amber-600' :
        isFinalizado ? 'text-blue-600' :
        'text-gray-500'
      }`}>
        {isLoading ? '--:--' : formatarTempo(displaySeg)}
        {isPausado && <span className="block text-xs font-sans font-normal text-amber-500 mt-1">PAUSADO</span>}
        {isFinalizado && <span className="block text-xs font-sans font-normal text-blue-500 mt-1">REGISTRADO</span>}
      </div>
      {/* Botões */}
      <div className="flex gap-2">
        {!sessao && (
          <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            onClick={() => iniciarMutation.mutate({ pedidoId, operadorId, operadorNome })}
            disabled={iniciarMutation.isPending}>
            <Play className="w-3.5 h-3.5 mr-1" /> Iniciar
          </Button>
        )}
        {isAtivo && (
          <Button size="sm" variant="outline" className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50 text-xs"
            onClick={() => pausarMutation.mutate({ sessaoId: sessao!.id })}
            disabled={pausarMutation.isPending}>
            <Square className="w-3.5 h-3.5 mr-1" /> Pausar
          </Button>
        )}
        {isPausado && (
          <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            onClick={() => retomarMutation.mutate({ sessaoId: sessao!.id })}
            disabled={retomarMutation.isPending}>
            <Play className="w-3.5 h-3.5 mr-1" /> Retomar
          </Button>
        )}
        {(isAtivo || isPausado) && (
          <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs"
            onClick={() => registrarMutation.mutate({ sessaoId: sessao!.id })}
            disabled={registrarMutation.isPending}>
            <Check className="w-3.5 h-3.5 mr-1" /> Registrar
          </Button>
        )}
        {/* Após registrar: mostrar apenas botão de reiniciar (nova sessão) */}
        {isFinalizado && (
          <Button size="sm" variant="outline" className="flex-1 text-xs border-gray-300 text-gray-600 hover:bg-gray-50"
            onClick={() => iniciarMutation.mutate({ pedidoId, operadorId, operadorNome })}
            disabled={iniciarMutation.isPending}>
            <Play className="w-3.5 h-3.5 mr-1" /> Nova sessão
          </Button>
        )}
      </div>
    </div>
  );
}

const KANBAN_COLS: { id: KanbanStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { id: "aguardando", label: "Aguardando", color: "bg-yellow-50 border-yellow-200", icon: <Clock className="w-4 h-4 text-yellow-600" /> },
  { id: "embalando", label: "Embalando", color: "bg-blue-50 border-blue-200", icon: <Package className="w-4 h-4 text-blue-600" /> },
  { id: "patio", label: "No Pátio", color: "bg-green-50 border-green-200", icon: <Truck className="w-4 h-4 text-green-600" /> },
];

export default function Empacotamento() {
  const { user: localUser } = useAuth();
  // Supervisor = qualquer role exceto 'empacotamento' puro (operadores de chão de fábrica)
  // Isso garante que admin, master, logistica, vendas, producao, financeiro vejam as abas Gerenciar e Relatório
  const isAdmin = localUser?.role !== "empacotamento";
  // Operador de embalagem vê a aba Operador por padrão; supervisores vêem Kanban
  const [aba, setAba] = useState<"kanban" | "operador" | "dashboard" | "gerenciar" | "relatorio">(
    localUser?.role === "empacotamento" ? "operador" : "kanban"
  );
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      {/* Barra de navegação com botão Home */}
      <div className="flex items-center px-4 py-1.5" style={{ background: "oklch(0.16 0.015 245)", borderBottom: "1px solid oklch(0.22 0.02 245)" }}>
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold no-underline transition-all duration-150 hover:opacity-80"
          style={{ background: "oklch(0.28 0.02 245)", color: "oklch(0.90 0.005 240)", border: "1px solid oklch(0.35 0.02 245)", letterSpacing: "0.04em" }}
        >
          <Home size={12} style={{ color: "oklch(0.62 0.18 240)" }} />
          VOLTAR PARA HOME
        </Link>
      </div>
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Boxes className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Empacotamento</h1>
              <p className="text-sm text-gray-500">Orquestrador de Expedição</p>
            </div>
          </div>
          <div className="flex flex-wrap bg-gray-100 rounded-xl p-1 gap-1">
            {/* Aba Operador — visível para todos, é a aba padrão para empacotadores */}
            <button
              onClick={() => setAba("operador")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === "operador" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Package className="w-4 h-4" />
              Operador
            </button>
            {isAdmin && (
              <button
                onClick={() => setAba("kanban")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === "kanban" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <LayoutGrid className="w-4 h-4" />
                Kanban
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setAba("dashboard")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === "dashboard" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setAba("gerenciar")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === "gerenciar" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Settings className="w-4 h-4" />
                Gerenciar
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setAba("relatorio")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === "relatorio" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <FileText className="w-4 h-4" />
                Relatório
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        {aba === "operador" && <OperadorView localUser={localUser} isAdmin={isAdmin} />}
        {aba === "kanban" && isAdmin && <KanbanView localUser={localUser} isAdmin={isAdmin} />}
        {aba === "dashboard" && isAdmin && <DashboardEmpacotamentoView />}
        {aba === "gerenciar" && isAdmin && <GerenciarView />}
        {aba === "relatorio" && isAdmin && <RelatorioView />}
      </div>
    </div>
  );
}

// ─── KANBAN ──────────────────────────────────────────────────────────────────
function KanbanView({ localUser, isAdmin }: { localUser: ReturnType<typeof useAuth>["user"]; isAdmin: boolean }) {
  const utils = trpc.useUtils();
  const { data: todos = [], isLoading, refetch } = trpc.empacotamento.pedidos.list.useQuery({ kanbanStatus: "todos" }, { refetchInterval: 5000 });
  const { data: resumo } = trpc.empacotamento.relatorio.resumoDia.useQuery();
  const notifyOwnerMutation = trpc.system.notifyOwner.useMutation();
  const moverMutation = trpc.empacotamento.pedidos.moverKanban.useMutation({
    onSuccess: (_, variables) => {
      // Invalidar e refetch imediato para atualizar o modal com o novo status
      utils.empacotamento.pedidos.list.invalidate();
      utils.empacotamento.relatorio.resumoDia.invalidate();
      refetch();
      // Notificar supervisor quando pedido vai para o pátio
      if (variables.kanbanStatus === "patio") {
        const pedido = todos.find(p => p.id === variables.id);
        if (pedido) {
          notifyOwnerMutation.mutate({
            title: `📦 Pedido #${pedido.numeroPedido} chegou ao Pátio`,
            content: `O pedido de ${pedido.cliente} (${pedido.modeloNome ?? pedido.modeloCaixaNome ?? "sem modelo"}) foi movido para o pátio e está pronto para expedição.`,
          });
        }
      }
    },
  });

  const [pedidoAberto, setPedidoAberto] = useState<Pedido | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<KanbanStatus | null>(null);

  const porColuna = (status: KanbanStatus) => todos.filter(p => p.kanbanStatus === status) as Pedido[];

  // Ordem dos estágios para validar retroação
  const STAGE_ORDER: KanbanStatus[] = ["aguardando", "embalando", "patio"];

  const deleteCotacaoByPedido = trpc.cotacoesFrete.deleteByEmpacotamentoPedidoId.useMutation();

  const handleDrop = async (targetStatus: KanbanStatus, pedidoId: number) => {
    const pedido = todos.find(p => p.id === pedidoId);
    if (!pedido || pedido.kanbanStatus === targetStatus) return;
    const currentIdx = STAGE_ORDER.indexOf(pedido.kanbanStatus as KanbanStatus);
    const targetIdx = STAGE_ORDER.indexOf(targetStatus);
    // Permitir retroação Pátio → Embalando: remove card da logística
    if (pedido.kanbanStatus === "patio" && targetStatus === "embalando") {
      deleteCotacaoByPedido.mutate({ empacotamentoPedidoId: pedidoId }, {
        onSuccess: (data) => {
          if (data.deletados > 0) {
            toast.info(`Card de logística removido (${data.deletados} solicitação(s) de frete excluída(s)).`);
          }
          moverMutation.mutate({ id: pedidoId, kanbanStatus: targetStatus });
        },
        onError: () => {
          // Mesmo se falhar ao deletar logística, move o pedido
          moverMutation.mutate({ id: pedidoId, kanbanStatus: targetStatus });
        }
      });
      return;
    }
    // Bloquear outras retroações
    if (currentIdx >= 0 && targetIdx >= 0 && targetIdx < currentIdx) {
      toast.error(`Não é permitido retroagir de "${pedido.kanbanStatus}" para "${targetStatus}" via arraste.`);
      return;
    }
    if (targetStatus === "patio") {
      try {
        const res = await fetch(`/api/trpc/empacotamento.pedidos.checkPendencias?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { pedidoId } } }))}`);
        const data = await res.json();
        const result = data[0]?.result?.data?.json;
        if (result && !result.podeIrPatio) {
          toast.error(result.motivos.join(" | "));
          return;
        }
      } catch { /* ignora erros de rede */ }
    }
    moverMutation.mutate({ id: pedidoId, kanbanStatus: targetStatus });
  };

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 border border-gray-200 text-center">
          <div className="text-2xl font-bold text-orange-500">{resumo?.pendentes ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">Aguardando</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-200 text-center">
          <div className="text-2xl font-bold text-emerald-600">{resumo?.finalizadosHoje ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">No Pátio Hoje</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-200 text-center">
          <div className="text-2xl font-bold text-blue-600">R$ {(resumo?.totalComissaoHoje ?? 0).toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">Comissão Hoje</div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-700">{todos.length} pedido(s) total</h2>
        <div className="flex gap-2">
          {isAdmin && <NovoPedidoBtn onCreated={() => refetch()} />}
          <button onClick={() => refetch()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 bg-white">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-400">Carregando...</div>}

      {/* Colunas Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {KANBAN_COLS.map(col => (
          <div
            key={col.id}
            className={`rounded-2xl border-2 ${col.color} p-3 min-h-[200px] transition-all ${dragOverCol === col.id ? "ring-2 ring-blue-400 ring-offset-1 scale-[1.01]" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragOverCol(col.id); }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={e => { e.preventDefault(); setDragOverCol(null); if (draggedId !== null) handleDrop(col.id, draggedId); setDraggedId(null); }}
          >
            <div className="flex items-center gap-2 mb-3">
              {col.icon}
              <span className="font-semibold text-gray-700">{col.label}</span>
              <span className="ml-auto bg-white rounded-full px-2 py-0.5 text-xs font-bold text-gray-600 border">
                {porColuna(col.id).length}
              </span>
            </div>
            <div className="space-y-2">
              {porColuna(col.id).map(p => (
                <KanbanCard
                  key={p.id}
                  pedido={p}
                  localUser={localUser}
                  isAdmin={isAdmin}
                  onAbrir={() => setPedidoAberto(p)}
                  onMover={(status) => moverMutation.mutate({ id: p.id, kanbanStatus: status })}
                  onDragStart={() => setDraggedId(p.id)}
                  onDragEnd={() => setDraggedId(null)}
                />
              ))}
              {porColuna(col.id).length === 0 && (
                <div className="text-center py-6 text-gray-400 text-sm">Vazio</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {pedidoAberto && (() => {
        // Sempre usa o pedido mais atualizado da lista para refletir mudanças de status
        const pedidoAtual = todos.find(p => p.id === pedidoAberto.id) ?? pedidoAberto;
        return (
          <PedidoDetalheModal
            pedido={pedidoAtual}
            isAdmin={isAdmin}
            onClose={() => setPedidoAberto(null)}
            onMover={(status) => {
              moverMutation.mutate({ id: pedidoAtual.id, kanbanStatus: status });
              // Não fechar o modal ao mover para pátio — deixar o usuário ver a confirmação
            }}
            onRefresh={() => { utils.empacotamento.pedidos.list.invalidate(); }}
          />
        );
      })()}
    </div>
  );
}

// ─── Card do Kanban ──────────────────────────────────────────────────
function KanbanCard({
  pedido, localUser, isAdmin, onAbrir, onMover, onDragStart, onDragEnd
}: {
  pedido: Pedido;
  localUser: ReturnType<typeof useAuth>["user"];
  isAdmin: boolean;
  onAbrir: () => void;
  onMover: (s: KanbanStatus) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const prazoStr = prazoLabel(pedido.prazoEntrega, pedido.horarioMaximo);
  const prazoClr = prazoColor(pedido.prazoEntrega);

  // Verificar pendências para ir ao pátio (apenas quando embalando)
  const { data: pendencias } = trpc.empacotamento.pedidos.checkPendencias.useQuery(
    { pedidoId: pedido.id },
    { enabled: pedido.kanbanStatus === "embalando", refetchInterval: 30000 }
  );
  const { data: usuariosCard = [] } = trpc.empacotamento.pedidoUsuarios.listPorPedido.useQuery(
    { pedidoId: pedido.id },
    { enabled: pedido.kanbanStatus === "embalando", refetchInterval: 15000 }
  );
  const operadorAtivo = usuariosCard.find((u: any) => u.ativo === 1);

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-3 cursor-grab hover:shadow-md transition-shadow active:scale-[0.98] select-none"
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart?.(); }}
      onDragEnd={e => { e.stopPropagation(); onDragEnd?.(); }}
      onClick={onAbrir}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">#{pedido.numeroPedido}</p>
          <p className="text-xs text-gray-500 truncate">{pedido.cliente}</p>
        </div>
        {pedido.modeloCaixaNome && (
          <span className="shrink-0 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
            {pedido.modeloCaixaNome}
          </span>
        )}
      </div>
      {pedido.modeloNome && (
        <p className="text-xs text-gray-400 mt-1 truncate">Letreiro: {pedido.modeloNome}</p>
      )}
      {prazoStr && (
        <p className={`text-xs mt-1 flex items-center gap-1 ${prazoClr}`}>
          <Calendar className="w-3 h-3" /> {prazoStr}
        </p>
      )}
      {pedido.arquivoUrl && (
        <div className="mt-2 rounded-lg overflow-hidden h-16 bg-gray-100">
          {pedido.arquivoTipo === "image" ? (
            <img src={pedido.arquivoUrl} alt="letreiro" className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full gap-1 text-gray-400 text-xs">
              <FileText className="w-4 h-4" /> PDF
            </div>
          )}
        </div>
      )}
      {/* Operador ativo — visível apenas no estágio embalando */}
      {pedido.kanbanStatus === "embalando" && (
        <div className="mt-2 rounded-lg px-3 py-2 bg-emerald-50 border border-emerald-200">
          {operadorAtivo ? (
            <p className="text-xs text-emerald-700 font-medium">
              <span className="text-emerald-500">●</span> {operadorAtivo.usuarioNome}
            </p>
          ) : (
            <p className="text-xs text-amber-500">Sem operador</p>
          )}
        </div>
      )}
      {/* Badge de pendências — visível quando embalando e há itens pendentes */}
      {pedido.kanbanStatus === "embalando" && pendencias && !pendencias.podeIrPatio && (
        <div className="mt-2 flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5" onClick={e => e.stopPropagation()}>
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span className="text-xs text-red-600 font-medium">
            {pendencias.semOperador && pendencias.checklistPendentes > 0
              ? `Sem operador + ${pendencias.checklistPendentes} item(ns) pendente(s)`
              : pendencias.semOperador
              ? "Sem operador conectado"
              : `${pendencias.checklistPendentes} item(ns) de checklist pendente(s)`}
          </span>
        </div>
      )}
    </div>
  );
}

//// ─── Peso e Medidas Card ────────────────────────────────────────────
function PesoMedidasCard({ pedido, onSaved }: { pedido: Pedido; onSaved: () => void }) {
  const [peso, setPeso] = useState(pedido.pesoKg != null ? String(pedido.pesoKg) : "");
  const [largura, setLargura] = useState(pedido.larguraCm != null ? String(pedido.larguraCm) : "");
  const [altura, setAltura] = useState(pedido.alturaCm != null ? String(pedido.alturaCm) : "");
  const [profundidade, setProfundidade] = useState(pedido.profundidadeCm != null ? String(pedido.profundidadeCm) : "");
  const [salvando, setSalvando] = useState(false);
  const atualizarMutation = trpc.empacotamento.pedidos.atualizarDimensoes.useMutation({
    onSuccess: () => { setSalvando(false); onSaved(); toast.success("Peso e medidas salvos!"); },
    onError: () => { setSalvando(false); toast.error("Erro ao salvar"); },
  });
  const handleSalvar = () => {
    setSalvando(true);
    atualizarMutation.mutate({
      id: pedido.id,
      pesoKg: peso ? parseFloat(peso) : null,
      larguraCm: largura ? parseFloat(largura) : null,
      alturaCm: altura ? parseFloat(altura) : null,
      profundidadeCm: profundidade ? parseFloat(profundidade) : null,
    });
  };
  const temDados = peso || (largura && altura && profundidade);
  return (
    <div className="border rounded-xl p-3 space-y-2">
      <p className="text-sm font-semibold text-gray-700 flex items-center gap-1">
        <DollarSign className="w-4 h-4 text-orange-500" /> Peso e Dimensões da Caixa
        {temDados && <span className="ml-auto text-xs text-green-600 font-normal">✓ Preenchido</span>}
        {!temDados && <span className="ml-auto text-xs text-amber-500 font-normal">Obrigatório para ir ao Pátio</span>}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Peso (kg) *</Label>
          <Input
            type="number" step="0.1" min="0"
            value={peso}
            onChange={e => setPeso(e.target.value)}
            placeholder="Ex: 12.5"
            className="h-8 text-sm"
          />
        </div>
        <div className="col-span-1" />
        <div>
          <Label className="text-xs">Largura (cm) *</Label>
          <Input type="number" step="0.1" min="0" value={largura} onChange={e => setLargura(e.target.value)} placeholder="L" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Altura (cm) *</Label>
          <Input type="number" step="0.1" min="0" value={altura} onChange={e => setAltura(e.target.value)} placeholder="A" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Profundidade (cm) *</Label>
          <Input type="number" step="0.1" min="0" value={profundidade} onChange={e => setProfundidade(e.target.value)} placeholder="P" className="h-8 text-sm" />
        </div>
        <div className="flex items-end">
          <Button size="sm" className="h-8 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={handleSalvar} disabled={salvando}>
            {salvando ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
// ─── Modal de detalhe do pedido ────────────────────────────────────────────
function PedidoDetalheModal({
  pedido, isAdmin, onClose, onMover, onRefresh
}: {
  pedido: Pedido;
  isAdmin: boolean;
  onClose: () => void;
  onMover: (s: KanbanStatus) => void;
  onRefresh: () => void;
}) {
  // Auth resolvida DENTRO do modal — nunca depende de prop que pode chegar null
  const { user: localUser, isLoading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  // query de usuários: sempre ativa (não depende do auth — exibe para todos)
  const {
    data: usuarios = [],
    isLoading: usuariosLoading,
    refetch: refetchUsuarios,
  } = trpc.empacotamento.pedidoUsuarios.listPorPedido.useQuery(
    { pedidoId: pedido.id },
    { refetchInterval: 3000, placeholderData: (prev) => prev }
  );
  const { data: fotos = [] } = trpc.empacotamento.pedidos.listFotos.useQuery({ pedidoId: pedido.id });
  const { data: empacotadores = [] } = trpc.empacotamento.operadores.list.useQuery();
  const { data: checklistItens = [] } = trpc.empacotamento.checklist.listPorCaixa.useQuery(
    { modeloCaixaId: pedido.modeloCaixaId ?? 0 },
    { enabled: !!pedido.modeloCaixaId }
  );
  const { data: checklistPedido = [] } = trpc.empacotamento.checklist.getPorPedido.useQuery({ pedidoId: pedido.id });

  // Checklist por tipo de letreiro (do PDF de expedição)
  const { data: checklistLetreitoItens = [] } = trpc.empacotamento.checklistLetreiro.listPorModelo.useQuery(
    { modeloId: pedido.modeloId ?? 0 },
    { enabled: !!pedido.modeloId }
  );
  const { data: checklistLetreiroPedido = [] } = trpc.empacotamento.checklistLetreiro.getPorPedido.useQuery({ pedidoId: pedido.id });
  const marcarLetreitoMutation = trpc.empacotamento.checklistLetreiro.marcarItem.useMutation({
    onSuccess: () => utils.empacotamento.checklistLetreiro.getPorPedido.invalidate(),
  });
  const isCheckedLetreiro = (itemId: number) => checklistLetreiroPedido.some((c: any) => c.itemId === itemId && c.marcado === 1);
  const obrigatoriosLetreiroPendentes = checklistLetreitoItens.filter((i: any) => i.obrigatorio === 1 && !isCheckedLetreiro(i.id));

  const entrarMutation = trpc.empacotamento.pedidoUsuarios.entrar.useMutation({
    onSuccess: () => utils.empacotamento.pedidoUsuarios.listPorPedido.invalidate(),
  });
  const marcarMutation = trpc.empacotamento.checklist.marcarItem.useMutation({
    onSuccess: () => utils.empacotamento.checklist.getPorPedido.invalidate(),
  });
  const uploadFotoMutation = trpc.empacotamento.pedidos.uploadFoto.useMutation({
    onSuccess: () => { utils.empacotamento.pedidos.listFotos.invalidate(); toast("Foto salva!"); },
  });
  const deleteMutation = trpc.empacotamento.pedidos.delete.useMutation({
    onSuccess: () => { onRefresh(); onClose(); toast("Pedido excluído."); },
  });

  const [nomeOperador, setNomeOperador] = useState(localUser?.name ?? "");
  const [mostrarEntrar, setMostrarEntrar] = useState(false);
  const [mostrarListaOperadores, setMostrarListaOperadores] = useState(false);
  // Rastreia qual operador foi selecionado nesta sessão para este pedido
  // Persiste em sessionStorage para sobreviver ao fechar/reabrir o modal
  const sessionKey = `empac_op_${pedido.id}`;
  const [operadorSelecionadoId, setOperadorSelecionadoId] = useState<string | null>(() => {
    return sessionStorage.getItem(sessionKey);
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galeriaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && localUser) refetchUsuarios();
  }, [authLoading, localUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isReady = !authLoading && !usuariosLoading && !!localUser;

  function isSameUser(registro: any, user: NonNullable<typeof localUser>) {
    if (registro.usuarioId != null && user.id != null) return registro.usuarioId === user.id;
    return registro.usuarioNome?.trim().toLowerCase() === user.name?.trim().toLowerCase();
  }

  const sairMutation = trpc.empacotamento.pedidoUsuarios.sair.useMutation({
    onSuccess: () => utils.empacotamento.pedidoUsuarios.listPorPedido.invalidate(),
  });

  const handleEntrar = () => {
    if (!nomeOperador.trim()) return;
    entrarMutation.mutate({ pedidoId: pedido.id, usuarioId: localUser?.id, usuarioNome: nomeOperador.trim() });
    setMostrarEntrar(false);
    onRefresh();
  };

  const handleSair = (id: number) => {
    sairMutation.mutate({ id, tempoSegundos: 0 });
  };

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadFotoMutation.mutate({
        pedidoId: pedido.id,
        base64,
        mimeType: file.type,
        usuarioNome: localUser?.name ?? nomeOperador,
      });
    };
    reader.readAsDataURL(file);
  };

  const isChecked = (itemId: number) => checklistPedido.some(c => c.itemId === itemId && c.marcado === 1);
  const obrigatoriosPendentes = checklistItens.filter(i => i.obrigatorio === 1 && !isChecked(i.id));
  const totalObrigatoriosPendentes = obrigatoriosPendentes.length + obrigatoriosLetreiroPendentes.length;
  const temOperadorAtivo = usuarios.filter(u => u.ativo === 1).length > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full p-0 gap-0 sm:rounded-lg max-h-[95dvh] sm:max-h-[90vh]" style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div className="overflow-y-auto flex-1 px-6 pt-6 pb-2">
          <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Pedido #{pedido.numeroPedido}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info básica */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1">
            <p className="font-semibold text-gray-800">{pedido.cliente}</p>
            {pedido.modeloNome && <p className="text-sm text-gray-500">Letreiro: {pedido.modeloNome}</p>}
            {pedido.modeloCaixaNome && <p className="text-sm text-gray-500">Caixa: {pedido.modeloCaixaNome}</p>}
            {pedido.prazoEntrega && (
              <p className={`text-sm flex items-center gap-1 ${prazoColor(pedido.prazoEntrega)}`}>
                <Calendar className="w-3.5 h-3.5" />
                {prazoLabel(pedido.prazoEntrega, pedido.horarioMaximo)}
              </p>
            )}
            {pedido.observacoes && <p className="text-sm text-gray-500 italic">{pedido.observacoes}</p>}
          </div>

          {/* Imagem do letreiro — exibida compactada na seção de fotos abaixo */}

          {/* Operadores trabalhando */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                <Users className="w-4 h-4" /> Operadores
              </p>
              {pedido.kanbanStatus !== "patio" && (
                <button onClick={() => setMostrarEntrar(v => !v)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5" /> Entrar no projeto
                </button>
              )}
            </div>
            {mostrarEntrar && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-1">Selecione o operador:</p>
                {empacotadores.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">Nenhum usuário cadastrado no sistema.</p>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  {empacotadores.map(op => (
                    <button
                      key={op.id}
                      onClick={() => {
                        setNomeOperador(op.name);
                        setOperadorSelecionadoId(op.id);
                        sessionStorage.setItem(sessionKey, String(op.id));
                        entrarMutation.mutate({ pedidoId: pedido.id, usuarioId: op.id, usuarioNome: op.name });
                        setMostrarEntrar(false);
                        onRefresh();
                      }}
                      disabled={entrarMutation.isPending}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-sm font-medium text-emerald-800 active:scale-95 transition-all"
                    >
                      <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {op.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate">{op.name}</span>
                      {op.role && <span className="text-xs text-gray-400 ml-auto shrink-0">{op.role}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {usuarios.length === 0 && <p className="text-xs text-gray-400">Nenhum operador ainda.</p>}
            <div className="space-y-2">
              {/* Operadores inativos (histórico) */}
              {usuarios.filter(u => u.ativo === 0).map(u => (
                <div key={u.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm bg-gray-50 border border-gray-200">
                  <span className="font-medium text-gray-500">{u.usuarioNome}</span>
                  <div className="flex items-center gap-2">

                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  </div>
                </div>
              ))}
              {/* Operadores ativos com temporizador */}
              {usuarios.filter(u => u.ativo === 1).map(u => {
                const isMe = operadorSelecionadoId != null
                  ? u.usuarioId === operadorSelecionadoId
                  : localUser
                    ? (u.usuarioId != null && localUser.id != null
                        ? u.usuarioId === localUser.id
                        : u.usuarioNome?.trim().toLowerCase() === localUser.name?.trim().toLowerCase())
                    : false;
                return (
                  <div key={u.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-emerald-800 text-sm">{u.usuarioNome}</span>
                      {isMe && (
                        <button
                          onClick={() => handleSair(u.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-xs transition-colors border border-red-300"
                        >
                          <Square className="w-3 h-3" /> Sair
                        </button>
                      )}
                    </div>
                    {/* Temporizador persistente — apenas para o operador atual */}
                    {isMe && u.usuarioId != null && (
                      <TemporizadorSessao
                        pedidoId={pedido.id}
                        operadorId={u.usuarioId}
                        operadorNome={u.usuarioNome}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Checklist de Caixa */}
          {checklistItens.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Checklist da Caixa
                {obrigatoriosPendentes.length > 0 && (
                  <span className="ml-1 text-xs text-red-500">({obrigatoriosPendentes.length} obrigatório(s) pendente)</span>
                )}
              </p>
              <div className="space-y-1.5">
                {checklistItens.map(item => (
                  <label key={item.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isChecked(item.id) ? "bg-emerald-50" : "bg-gray-50 hover:bg-gray-100"}`}>
                    <input
                      type="checkbox"
                      checked={isChecked(item.id)}
                      onChange={e => marcarMutation.mutate({
                        pedidoId: pedido.id,
                        itemId: item.id,
                        marcado: e.target.checked ? 1 : 0,
                        marcadoPor: localUser?.name ?? nomeOperador,
                      })}
                      className="w-5 h-5 accent-emerald-600"
                    />
                    <span className={`text-sm ${isChecked(item.id) ? "line-through text-gray-400" : "text-gray-700"}`}>
                      {item.descricao}
                      {item.obrigatorio === 1 && !isChecked(item.id) && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Aviso quando pedido não tem tipo de letra definido */}
          {!pedido.modeloId && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">
                <strong>Tipo de letreiro não definido.</strong> O checklist de embalagem não pode ser exibido. Edite o pedido e selecione o modelo de letreiro.
              </p>
            </div>
          )}
          {/* Checklist de Embalagem do Letreiro (do PDF de expedição) */}
          {checklistLetreitoItens.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-blue-600" /> Checklist de Embalagem
                <span className="text-xs text-gray-500 font-normal ml-1">({pedido.modeloNome})</span>
                {obrigatoriosLetreiroPendentes.length > 0 && (
                  <span className="ml-1 text-xs text-red-500">({obrigatoriosLetreiroPendentes.length} pendente(s))</span>
                )}
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {checklistLetreitoItens.map((item: any) => (
                  <label key={item.id} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    isCheckedLetreiro(item.id) ? "bg-blue-50 border border-blue-100" : "bg-gray-50 hover:bg-gray-100"
                  }`}>
                    <input
                      type="checkbox"
                      checked={isCheckedLetreiro(item.id)}
                      onChange={e => marcarLetreitoMutation.mutate({
                        pedidoId: pedido.id,
                        itemId: item.id,
                        marcado: e.target.checked ? 1 : 0,
                        marcadoPor: localUser?.name ?? nomeOperador,
                      })}
                      className="w-5 h-5 accent-blue-600 mt-0.5 shrink-0"
                    />
                    <span className={`text-sm leading-snug ${
                      isCheckedLetreiro(item.id) ? "line-through text-gray-400" : "text-gray-700"
                    }`}>
                      {item.descricao}
                      {item.obrigatorio === 1 && !isCheckedLetreiro(item.id) && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Peso e Medidas */}
          <PesoMedidasCard pedido={pedido} onSaved={() => utils.empacotamento.pedidos.list.invalidate()} />
          {/* Fotos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                <Camera className="w-4 h-4" /> Fotos do projeto
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => cameraInputRef.current?.click()}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md flex items-center gap-1 transition-colors">
                  <Camera className="w-3.5 h-3.5" /> Câmera
                </button>
                <button onClick={() => galeriaInputRef.current?.click()}
                  className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded-md flex items-center gap-1 transition-colors">
                  <Images className="w-3.5 h-3.5" /> Galeria
                </button>
              </div>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={handleFoto} />
              <input ref={galeriaInputRef} type="file" accept="image/*"
                className="hidden" onChange={handleFoto} />
            </div>
            {fotos.length === 0 && !pedido.arquivoUrl && <p className="text-xs text-gray-400">Nenhuma foto ainda.</p>}
            <div className="grid grid-cols-3 gap-2">
              {/* Arquivo do supervisor (letreiro) compactado junto com as fotos */}
              {pedido.arquivoUrl && pedido.arquivoTipo === "image" && (
                <ArquivoSupervisorComAnotacao
                  url={pedido.arquivoUrl}
                  pedidoId={pedido.id}
                  onSaved={() => utils.empacotamento.pedidos.list.invalidate()}
                />
              )}
              {pedido.arquivoUrl && pedido.arquivoTipo !== "image" && (
                <a href={pedido.arquivoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center h-24 bg-gray-50 rounded-lg border border-gray-200 text-gray-400 text-xs gap-1 hover:bg-gray-100">
                  <FileText className="w-6 h-6" /> PDF
                </a>
              )}
              {fotos.map(f => (
                <FotoComAnotacao key={f.id} url={f.url} fotoId={f.id}
                  onSaved={() => utils.empacotamento.pedidos.listFotos.invalidate({ pedidoId: pedido.id })} />
              ))}
            </div>
          </div>
        </div>
        </div>{/* fim scroll */}
        <DialogFooter className="flex-col gap-2 pt-3 bg-white border-t border-gray-200 pb-4 px-6 shrink-0 sm:flex-col">
          {isAdmin && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 w-full"
              onClick={() => deleteMutation.mutate({ id: pedido.id })}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir pedido
            </Button>
          )}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

// ─── Botão Novo Pedido ────────────────────────────────────────────────────────
function NovoPedidoBtn({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: modelos = [] } = trpc.empacotamento.modelos.listAtivos.useQuery();
  const { data: modelosCaixa = [] } = trpc.empacotamento.modelosCaixa.listAtivos.useQuery();
  const { data: operadoresDisponiveis = [] } = trpc.empacotamento.operadores.list.useQuery();
  const uploadMutation = trpc.empacotamento.pedidos.uploadArquivo.useMutation();
  const createMutation = trpc.empacotamento.pedidos.create.useMutation({
    onSuccess: async (pedidoCriado) => {
      // Se há arquivo selecionado, fazer upload imediatamente após criar o pedido
      if (arquivo && pedidoCriado?.id) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = (ev.target?.result as string)?.split(",")[1];
          if (base64) {
            uploadMutation.mutate({
              pedidoId: pedidoCriado.id,
              base64,
              mimeType: arquivo.type || "image/png",
              fileName: arquivo.name,
            });
          }
        };
        reader.readAsDataURL(arquivo);
      }
      setOpen(false);
      onCreated();
      toast("Pedido criado!");
    },
  });

  const [form, setForm] = useState({
    numeroPedido: "", cliente: "", modeloId: "", modeloCaixaId: "",
    prazoEntrega: "", horarioMaximo: "", observacoes: "",
    metrosQuadrados: "",
    cnpjCliente: "", cepCliente: "", enderecoCliente: "",
  });
  // Integração Mubisys: buscar dados da OS quando o número for digitado
  const [buscandoOs, setBuscandoOs] = useState(false);
  const [osEncontrada, setOsEncontrada] = useState<boolean | null>(null);
  const debounceOsRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buscarOsQuery = trpc.empacotamento.pedidos.buscarOs.useQuery(
    { numeroOs: form.numeroPedido },
    {
      enabled: false,
      retry: false,
    }
  );
  const buscarDadosOs = async () => {
    if (!form.numeroPedido.trim()) return;
    setBuscandoOs(true);
    setOsEncontrada(null);
    try {
      const dados = await buscarOsQuery.refetch();
      if (dados.data) {
        const m2 = dados.data!.metrosQuadrados;
        setForm(p => ({
          ...p,
          cliente: dados.data!.nomeCliente || p.cliente,
          cnpjCliente: dados.data!.cnpj || "",
          cepCliente: dados.data!.cep || "",
          enderecoCliente: dados.data!.endereco ? `${dados.data!.endereco}, ${dados.data!.cidade} - ${dados.data!.estado}` : "",
          metrosQuadrados: m2 != null ? String(m2) : p.metrosQuadrados,
        }));
        setOsEncontrada(true);
        const m2Msg = m2 != null ? ` | ${m2.toFixed(2)} m²` : "";
        toast.success(`✓ OS encontrada: ${dados.data!.nomeCliente}${m2Msg}`);
      } else {
        setOsEncontrada(false);
      }
    } catch {
      setOsEncontrada(false);
    } finally {
      setBuscandoOs(false);
    }
  };
  // Dispara busca automática 800ms após o usuário parar de digitar
  useEffect(() => {
    if (debounceOsRef.current) clearTimeout(debounceOsRef.current);
    if (!form.numeroPedido.trim()) { setOsEncontrada(null); return; }
    debounceOsRef.current = setTimeout(() => { buscarDadosOs(); }, 800);
    return () => { if (debounceOsRef.current) clearTimeout(debounceOsRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.numeroPedido]);
  const tempoEstimadoQuery = trpc.empacotamento.tempoEstimado.calcular.useQuery({
    modeloId: form.modeloId ? parseInt(form.modeloId) : undefined,
    modeloCaixaId: form.modeloCaixaId ? parseInt(form.modeloCaixaId) : undefined,
    metrosQuadrados: form.metrosQuadrados ? parseFloat(form.metrosQuadrados) : undefined,
  }, { enabled: !!(form.modeloId || form.modeloCaixaId) });
  const [operadoresSelecionados, setOperadoresSelecionados] = useState<string[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const handleSubmit = async () => {
    if (!form.numeroPedido || !form.cliente) return;
    const modeloCaixa = modelosCaixa.find(m => String(m.id) === form.modeloCaixaId);
    const modelo = modelos.find(m => String(m.id) === form.modeloId);
    createMutation.mutate({
      numeroPedido: form.numeroPedido,
      cliente: form.cliente,
      modeloId: modelo ? modelo.id : undefined,
      modeloNome: modelo?.nome,
      modeloCaixaId: modeloCaixa ? modeloCaixa.id : undefined,
      modeloCaixaNome: modeloCaixa?.nome,
      // Adiciona T12:00:00 para evitar rollback de dia em fusos UTC-X (ex: UTC-3)
      prazoEntrega: form.prazoEntrega ? `${form.prazoEntrega}T12:00:00` : undefined,
      horarioMaximo: form.horarioMaximo || undefined,
      observacoes: form.observacoes || undefined,
      metrosQuadrados: form.metrosQuadrados ? parseFloat(form.metrosQuadrados) : undefined,
      cnpjCliente: form.cnpjCliente || undefined,
      cepCliente: form.cepCliente || undefined,
      enderecoCliente: form.enderecoCliente || undefined,
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
        <Plus className="w-4 h-4 mr-1" /> Novo Pedido
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Pedido de Empacotamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº do Pedido (ID OS) *</Label>
                <div className="relative">
                  <Input
                    value={form.numeroPedido}
                    onChange={e => { setForm(p => ({ ...p, numeroPedido: e.target.value })); setOsEncontrada(null); }}
                    onKeyDown={e => { if (e.key === "Enter") buscarDadosOs(); }}
                    placeholder="ID da OS"
                    className={osEncontrada === true ? "border-green-500 pr-7" : osEncontrada === false ? "border-red-400 pr-7" : "pr-7"}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {buscandoOs && <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
                    {!buscandoOs && osEncontrada === true && <Check className="w-3.5 h-3.5 text-green-500" />}
                    {!buscandoOs && osEncontrada === false && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                </div>
                {osEncontrada === false && <p className="text-xs text-red-500 mt-0.5">OS não encontrada</p>}
              </div>
              <div>
                <Label>Cliente *</Label>
                <Input
                  value={form.cliente}
                  onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))}
                  placeholder={buscandoOs ? "Buscando..." : "Nome do cliente"}
                  className={osEncontrada === true && form.cliente ? "border-green-500" : ""}
                />
                {osEncontrada === true && <p className="text-xs text-green-600 mt-0.5">✓ Preenchido pelo Mubisys</p>}
              </div>
            </div>
            <div>
              <Label>Modelo de Letreiro *</Label>
              <Select value={form.modeloId} onValueChange={v => setForm(p => ({ ...p, modeloId: v }))}>
                <SelectTrigger className={!form.modeloId ? "border-red-300" : ""}><SelectValue placeholder="Selecionar modelo" /></SelectTrigger>
                <SelectContent>
                  {modelos.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>m² do Projeto (letreiro)</Label>
              <div className="relative">
                <Input type="number" step="0.01" min="0" value={form.metrosQuadrados} onChange={e => setForm(p => ({ ...p, metrosQuadrados: e.target.value }))} placeholder="Ex: 2.5" className={osEncontrada && form.metrosQuadrados ? "border-green-400 pr-28" : ""} />
                {osEncontrada && form.metrosQuadrados && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-600 font-medium whitespace-nowrap">✓ do Mubisys</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Necessário para calcular insumos e tempo estimado</p>
            </div>
            <div>
              <Label>Modelo de Caixa *</Label>
              <Select value={form.modeloCaixaId} onValueChange={v => setForm(p => ({ ...p, modeloCaixaId: v }))}>
                <SelectTrigger className={!form.modeloCaixaId ? "border-red-300" : ""}><SelectValue placeholder="Selecionar caixa" /></SelectTrigger>
                <SelectContent>
                  {modelosCaixa.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.nome} {m.larguraCm ? `(${m.larguraCm}×${m.alturaCm}×${m.profundidadeCm}cm)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prazo de Entrega</Label>
                <Input type="date" value={form.prazoEntrega} onChange={e => setForm(p => ({ ...p, prazoEntrega: e.target.value }))} />
              </div>
              <div>
                <Label>Horário Máximo</Label>
                <Input
                  type="time"
                  min="07:00"
                  max="18:00"
                  value={form.horarioMaximo}
                  onChange={e => {
                    const v = e.target.value;
                    if (v && (v < "07:00" || v > "18:00")) return;
                    setForm(p => ({ ...p, horarioMaximo: v }));
                  }}
                />
              </div>
            </div>

            {tempoEstimadoQuery.data && (tempoEstimadoQuery.data.totalMin > 0) && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                <p className="text-sm font-semibold text-indigo-800 mb-1">⏱ Tempo Estimado</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {tempoEstimadoQuery.data.tempoLetreiMin > 0 && (
                    <div className="text-center">
                      <p className="text-indigo-600 font-medium">{tempoEstimadoQuery.data.tempoLetreiMin.toFixed(1)} min</p>
                      <p className="text-gray-500">Letreiro</p>
                    </div>
                  )}
                  {tempoEstimadoQuery.data.tempoCaixaMin > 0 && (
                    <div className="text-center">
                      <p className="text-indigo-600 font-medium">{tempoEstimadoQuery.data.tempoCaixaMin.toFixed(1)} min</p>
                      <p className="text-gray-500">Caixa</p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-indigo-800 font-bold">{tempoEstimadoQuery.data.totalMin.toFixed(1)} min</p>
                    <p className="text-gray-500">Total</p>
                  </div>
                </div>
              </div>
            )}
            <div>
              <Label>Operadores Responsáveis</Label>
              <div className="border rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                {operadoresDisponiveis.length === 0 && <p className="text-xs text-gray-400">Nenhum operador cadastrado</p>}
                {operadoresDisponiveis.map(op => (
                  <label key={op.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={operadoresSelecionados.includes(op.id)}
                      onChange={e => setOperadoresSelecionados(prev =>
                        e.target.checked ? [...prev, op.id] : prev.filter(id => id !== op.id)
                      )}
                      className="rounded"
                    />
                    <span className="text-sm">{op.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{op.role}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Opcional — os operadores também podem pegar o pedido depois.</p>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>Arquivo do Letreiro (PNG/PDF)</Label>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-400 transition-colors"
                onClick={() => document.getElementById("upload-letreiro")?.click()}>
                {arquivo ? (
                  <p className="text-sm text-emerald-600 font-medium">{arquivo.name}</p>
                ) : (
                  <div className="text-gray-400">
                    <Upload className="w-8 h-8 mx-auto mb-1" />
                    <p className="text-sm">Clique para selecionar</p>
                  </div>
                )}
                <input id="upload-letreiro" type="file" accept="image/*,.pdf" className="hidden"
                  onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
              </div>
              <p className="text-xs text-gray-400 mt-1">O arquivo será vinculado após criar o pedido.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!form.numeroPedido || !form.cliente || !form.modeloId || !form.modeloCaixaId || createMutation.isPending}
              onClick={handleSubmit}
            >
              {createMutation.isPending ? "Criando..." : "Criar Pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── GERENCIAR ───────────────────────────────────────────────────────────────
function GerenciarView() {
  const [sub, setSub] = useState<"caixas" | "letreiros" | "precos" | "insumos" | "precificacao" | "produtividade">("caixas");

  const SUBS: { id: typeof sub; label: string }[] = [
    { id: "caixas", label: "Modelos de Caixa" },
    { id: "letreiros", label: "Modelos de Letreiro" },
    { id: "precos", label: "Tabela de Preços" },
    { id: "insumos", label: "Insumos" },
    { id: "precificacao", label: "Precificação" },
    { id: "produtividade", label: "Produtividade" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {SUBS.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${sub === s.id ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"}`}>
            {s.label}
          </button>
        ))}
      </div>
      {sub === "caixas" && <ModelosCaixaAdmin />}
      {sub === "letreiros" && <ModelosLetreirosAdmin />}
      {sub === "precos" && <TabelaPrecosAdmin />}
      {sub === "insumos" && <InsumosAdmin />}
      {sub === "precificacao" && <PrecificacaoAdmin />}
      {sub === "produtividade" && <ProdutividadeAdmin />}
    </div>
  );
}

// ─── Admin: Modelos de Caixa ─────────────────────────────────────────────────
function ModelosCaixaAdmin() {
  const utils = trpc.useUtils();
  const { data: modelos = [] } = trpc.empacotamento.modelosCaixa.list.useQuery();
  const createMutation = trpc.empacotamento.modelosCaixa.create.useMutation({
    onSuccess: () => { utils.empacotamento.modelosCaixa.list.invalidate(); setForm(EMPTY); toast("Caixa criada!"); },
  });
  const updateMutation = trpc.empacotamento.modelosCaixa.update.useMutation({
    onSuccess: () => { utils.empacotamento.modelosCaixa.list.invalidate(); setEditando(null); toast("Caixa atualizada!"); },
  });
  const deleteMutation = trpc.empacotamento.modelosCaixa.delete.useMutation({
    onSuccess: () => utils.empacotamento.modelosCaixa.list.invalidate(),
  });

  const EMPTY = { nome: "", descricao: "", tipoCaixa: "padronizada" as "padronizada" | "personalizada", larguraCm: "", alturaCm: "", profundidadeCm: "", custoAquisicao: "", tempoPorM2Min: "", tempoPorMetroArestaMin: "", tempoPorM3Min: "", valorProdutividadePorCm2: "" };
  const [form, setForm] = useState(EMPTY);
  const [editando, setEditando] = useState<typeof modelos[0] | null>(null);
  const [checklistExpandido, setChecklistExpandido] = useState<number | null>(null);
  const [insumosAberto, setInsumosAberto] = useState<typeof modelos[0] | null>(null);

  const handleCreate = () => {
    if (!form.nome) return;
    createMutation.mutate({
      nome: form.nome,
      descricao: form.descricao || undefined,
      larguraCm: form.larguraCm ? parseFloat(form.larguraCm) : undefined,
      alturaCm: form.alturaCm ? parseFloat(form.alturaCm) : undefined,
      profundidadeCm: form.profundidadeCm ? parseFloat(form.profundidadeCm) : undefined,
      tipoCaixa: form.tipoCaixa,
      custoAquisicao: form.custoAquisicao ? parseFloat(form.custoAquisicao) : 0,
      tempoPorM2Min: form.tempoPorM2Min ? parseFloat(form.tempoPorM2Min) : undefined,
      tempoPorMetroArestaMin: form.tempoPorMetroArestaMin ? parseFloat(form.tempoPorMetroArestaMin) : undefined,
      tempoPorM3Min: (form as any).tempoPorM3Min ? parseFloat((form as any).tempoPorM3Min) : undefined,
      valorProdutividadePorCm2: form.valorProdutividadePorCm2 ? parseFloat(form.valorProdutividadePorCm2) : undefined,
    });
  };

  const handleUpdate = () => {
    if (!editando) return;
    updateMutation.mutate({
      id: editando.id,
      nome: editando.nome,
      descricao: editando.descricao ?? undefined,
      larguraCm: editando.larguraCm ? parseFloat(String(editando.larguraCm)) : undefined,
      alturaCm: editando.alturaCm ? parseFloat(String(editando.alturaCm)) : undefined,
      profundidadeCm: editando.profundidadeCm ? parseFloat(String(editando.profundidadeCm)) : undefined,
      tipoCaixa: (editando.tipoCaixa as "padronizada" | "personalizada") ?? "padronizada",
      custoAquisicao: editando.custoAquisicao ? parseFloat(String(editando.custoAquisicao)) : 0,
      tempoPorM2Min: (editando as any).tempoPorM2Min ? parseFloat(String((editando as any).tempoPorM2Min)) : undefined,
      tempoPorMetroArestaMin: (editando as any).tempoPorMetroArestaMin ? parseFloat(String((editando as any).tempoPorMetroArestaMin)) : undefined,
      valorProdutividadePorCm2: (editando as any).valorProdutividadePorCm2 ? parseFloat(String((editando as any).valorProdutividadePorCm2)) : undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Formulário de criação */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Nova Caixa</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="col-span-2 md:col-span-1">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Caixa Grande" />
          </div>
          <div>
            <Label>Largura (cm)</Label>
            <Input type="number" value={form.larguraCm} onChange={e => setForm(p => ({ ...p, larguraCm: e.target.value }))} />
          </div>
          <div>
            <Label>Altura (cm)</Label>
            <Input type="number" value={form.alturaCm} onChange={e => setForm(p => ({ ...p, alturaCm: e.target.value }))} />
          </div>
          <div>
            <Label>Profundidade (cm)</Label>
            <Input type="number" value={form.profundidadeCm} onChange={e => setForm(p => ({ ...p, profundidadeCm: e.target.value }))} />
          </div>
          <div>
            <Label>Tipo de Caixa</Label>
            <Select value={form.tipoCaixa} onValueChange={v => setForm(p => ({ ...p, tipoCaixa: v as "padronizada" | "personalizada", larguraCm: "", alturaCm: "", profundidadeCm: "" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="padronizada">Padronizada (dimensões fixas)</SelectItem>
                <SelectItem value="personalizada">Personalizada (dimensões no pedido)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Custo de Aquisição (R$)</Label>
            <Input type="number" step="0.01" min="0" value={form.custoAquisicao} onChange={e => setForm(p => ({ ...p, custoAquisicao: e.target.value }))} placeholder="0,00" />
          </div>
          {form.tipoCaixa === "padronizada" ? (
            <>
              <div>
                <Label>Tempo por m² (min)</Label>
                <Input type="number" step="0.01" min="0" value={form.tempoPorM2Min} onChange={e => setForm(p => ({ ...p, tempoPorM2Min: e.target.value }))} placeholder="Ex: 5" />
                <p className="text-xs text-gray-400 mt-0.5">Minutos para embalar 1 m² da caixa (área superficial)</p>
              </div>
              <div>
                <Label>Tempo por metro de aresta (min)</Label>
                <Input type="number" step="0.01" min="0" value={form.tempoPorMetroArestaMin} onChange={e => setForm(p => ({ ...p, tempoPorMetroArestaMin: e.target.value }))} placeholder="Ex: 2" />
                <p className="text-xs text-gray-400 mt-0.5">Minutos por metro de aresta da caixa</p>
              </div>
            </>
          ) : (
            <div>
              <Label>Tempo por m³ (min) — Caixa Personalizada</Label>
              <Input type="number" step="0.01" min="0" value={(form as any).tempoPorM3Min ?? ""} onChange={e => setForm(p => ({ ...p, tempoPorM3Min: e.target.value } as any))} placeholder="Ex: 120" />
              <p className="text-xs text-gray-400 mt-0.5">Minutos para embalar 1 m³ de volume da caixa personalizada</p>
            </div>
          )}
          <div>
            <Label>Produtividade por cm² (R$)</Label>
            <Input type="number" step="0.000001" min="0" value={form.valorProdutividadePorCm2} onChange={e => setForm(p => ({ ...p, valorProdutividadePorCm2: e.target.value }))} placeholder="Ex: 0.001" />
            <p className="text-xs text-gray-400 mt-0.5">Valor de comissão por cm² da caixa</p>
          </div>
          {/* Estimativa de custo por m³ */}
          {form.larguraCm && form.alturaCm && form.profundidadeCm && form.custoAquisicao && (() => {
            const l = parseFloat(form.larguraCm), a = parseFloat(form.alturaCm), p = parseFloat(form.profundidadeCm);
            const custo = parseFloat(form.custoAquisicao);
            if (!l || !a || !p || !custo) return null;
            const volumeCm3 = l * a * p;
            const custoPorM3 = (custo / volumeCm3) * 1_000_000; // cm³ → m³
            return (
              <div className="col-span-2 md:col-span-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-sm font-medium text-blue-800">
                  📦 Estimativa: <strong>R$ {custoPorM3.toFixed(2)}/m³</strong>
                  <span className="text-xs text-blue-500 ml-2">({l}×{a}×{p} cm = {(volumeCm3/1_000_000).toFixed(4)} m³ · R$ {custo}/cx)</span>
                </p>
              </div>
            );
          })()}
        </div>
        <Button className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreate} disabled={!form.nome || createMutation.isPending}>
          <Plus className="w-4 h-4 mr-1" /> Criar Caixa
        </Button>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {modelos.map(m => (
          <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-4">
            {editando?.id === m.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Label>Nome</Label>
                    <Input value={editando.nome} onChange={e => setEditando(p => p ? { ...p, nome: e.target.value } : p)} />
                  </div>
                  <div>
                    <Label>Largura (cm)</Label>
                    <Input type="number" value={editando.larguraCm ?? ""} onChange={e => setEditando(p => p ? { ...p, larguraCm: e.target.value } : p)} />
                  </div>
                  <div>
                    <Label>Altura (cm)</Label>
                    <Input type="number" value={editando.alturaCm ?? ""} onChange={e => setEditando(p => p ? { ...p, alturaCm: e.target.value } : p)} />
                  </div>
                  <div>
                    <Label>Profundidade (cm)</Label>
                    <Input type="number" value={editando.profundidadeCm ?? ""} onChange={e => setEditando(p => p ? { ...p, profundidadeCm: e.target.value } : p)} />
                  </div>
                  <div>
                    <Label>Tipo de Caixa</Label>
                    <Select value={editando.tipoCaixa ?? "padronizada"} onValueChange={v => setEditando(p => p ? { ...p, tipoCaixa: v } : p)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="padronizada">Padronizada (dimensões fixas)</SelectItem>
                        <SelectItem value="personalizada">Personalizada (dimensões no pedido)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Custo de Aquisição (R$)</Label>
                    <Input type="number" step="0.01" min="0" value={editando.custoAquisicao ?? ""} onChange={e => setEditando(p => p ? { ...p, custoAquisicao: e.target.value } : p)} placeholder="0,00" />
                    {(editando as any).custoAquisicaoAtualizadoEm && (
                      <p className="text-xs text-gray-400 mt-0.5">Atualizado em: {new Date((editando as any).custoAquisicaoAtualizadoEm).toLocaleDateString('pt-BR')}</p>
                    )}
                  </div>
                  <div>
                    <Label>Tempo por m² (min)</Label>
                    <Input type="number" step="0.01" min="0" value={(editando as any).tempoPorM2Min ?? ""} onChange={e => setEditando(p => p ? { ...p, tempoPorM2Min: e.target.value } as any : p)} placeholder="Ex: 5" />
                    <p className="text-xs text-gray-400 mt-0.5">Minutos para embalar 1 m² da caixa</p>
                  </div>
                  <div>
                    <Label>Tempo por metro de aresta (min)</Label>
                    <Input type="number" step="0.01" min="0" value={(editando as any).tempoPorMetroArestaMin ?? ""} onChange={e => setEditando(p => p ? { ...p, tempoPorMetroArestaMin: e.target.value } as any : p)} placeholder="Ex: 2" />
                    <p className="text-xs text-gray-400 mt-0.5">Minutos por metro de aresta da caixa</p>
                  </div>
                  <div>
                    <Label>Produtividade por cm² (R$)</Label>
                    <Input type="number" step="0.000001" min="0" value={(editando as any).valorProdutividadePorCm2 ?? ""} onChange={e => setEditando(p => p ? { ...p, valorProdutividadePorCm2: e.target.value } as any : p)} placeholder="Ex: 0.001" />
                    <p className="text-xs text-gray-400 mt-0.5">Valor de comissão por cm² da caixa</p>
                  </div>
                  {/* Estimativa custo por m³ no modo edição */}
                  {editando.larguraCm && editando.alturaCm && editando.profundidadeCm && editando.custoAquisicao && (() => {
                    const l = parseFloat(String(editando.larguraCm)), a = parseFloat(String(editando.alturaCm)), p2 = parseFloat(String(editando.profundidadeCm));
                    const custo = parseFloat(String(editando.custoAquisicao));
                    if (!l || !a || !p2 || !custo) return null;
                    const vol = l * a * p2;
                    const cpm3 = (custo / vol) * 1_000_000;
                    return (
                      <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <p className="text-sm font-medium text-blue-800">
                          📦 Custo estimado: <strong>R$ {cpm3.toFixed(2)}/m³</strong>
                          <span className="text-xs text-blue-500 ml-2">({l}×{a}×{p2} cm = {(vol/1_000_000).toFixed(4)} m³)</span>
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-emerald-600 text-white" onClick={handleUpdate}><Save className="w-3.5 h-3.5 mr-1" /> Salvar</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{m.nome}</p>
                  {(m.larguraCm || m.alturaCm || m.profundidadeCm) && (
                    <p className="text-sm text-gray-500">{m.larguraCm}×{m.alturaCm}×{m.profundidadeCm} cm</p>
                  )}
                  <div className="flex gap-3 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.tipoCaixa === "personalizada" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {m.tipoCaixa === "personalizada" ? "Personalizada" : "Padronizada"}
                    </span>
                    {parseFloat(String(m.custoAquisicao ?? "0")) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        Caixa: R$ {parseFloat(String(m.custoAquisicao)).toFixed(2)}
                      </span>
                    )}
                    {(m as any).custoAquisicaoAtualizadoEm && (() => {
                      const dt = new Date((m as any).custoAquisicaoAtualizadoEm);
                      const vence = new Date(dt); vence.setMonth(vence.getMonth() + 3);
                      const vencido = new Date() > vence;
                      return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${vencido ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                        Preço: {dt.toLocaleDateString('pt-BR')}{vencido ? ' ⚠️ Vencido' : ''}
                      </span>;
                    })()}
                    {(m as any).tempoPorM2Min && parseFloat(String((m as any).tempoPorM2Min)) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                        {parseFloat(String((m as any).tempoPorM2Min)).toFixed(1)} min/m²
                      </span>
                    )}
                    {(m as any).tempoPorMetroArestaMin && parseFloat(String((m as any).tempoPorMetroArestaMin)) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
                        {parseFloat(String((m as any).tempoPorMetroArestaMin)).toFixed(2)} min/m aresta
                      </span>
                    )}
                    {(m as any).valorProdutividadePorCm2 && parseFloat(String((m as any).valorProdutividadePorCm2)) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        R$ {parseFloat(String((m as any).valorProdutividadePorCm2)).toFixed(6)}/cm²
                      </span>
                    )}
                    {m.larguraCm && m.alturaCm && m.profundidadeCm && parseFloat(String(m.custoAquisicao ?? '0')) > 0 && (() => {
                      const l = parseFloat(String(m.larguraCm)), a = parseFloat(String(m.alturaCm)), p2 = parseFloat(String(m.profundidadeCm));
                      const custo = parseFloat(String(m.custoAquisicao));
                      if (!l || !a || !p2 || !custo) return null;
                      const cpm3 = (custo / (l * a * p2)) * 1_000_000;
                      return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">R$ {cpm3.toFixed(2)}/m³</span>;
                    })()}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setInsumosAberto(m)} className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg" title="Insumos desta caixa">
                    <Package className="w-4 h-4" />
                  </button>
                  <button onClick={() => setChecklistExpandido(checklistExpandido === m.id ? null : m.id)} className={`p-2 rounded-lg transition-colors ${checklistExpandido === m.id ? "bg-blue-100 text-blue-700" : "text-blue-500 hover:bg-blue-50"}`} title="Checklist">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditando(m)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteMutation.mutate({ id: m.id })} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            {checklistExpandido === m.id && (
              <ChecklistInlineCaixa modeloCaixaId={m.id} nome={m.nome} />
            )}
          </div>
        ))}
      </div>
      {insumosAberto && (
        <InsumosModeloCaixaModal caixa={insumosAberto} onClose={() => setInsumosAberto(null)} />
      )}
    </div>
  );
}


// ─── Componente de Checklist Inline (editável dentro do card do produto) ─────
function ChecklistInlineCaixa({ modeloCaixaId, nome }: { modeloCaixaId: number; nome: string }) {
  const utils = trpc.useUtils();
  const { data: itens = [], isLoading } = trpc.empacotamento.checklist.listPorCaixa.useQuery({ modeloCaixaId });
  const addMutation = trpc.empacotamento.checklist.addItem.useMutation({
    onSuccess: () => { utils.empacotamento.checklist.listPorCaixa.invalidate(); setNovoItem(""); },
  });
  const updateMutation = trpc.empacotamento.checklist.updateItem.useMutation({
    onSuccess: () => utils.empacotamento.checklist.listPorCaixa.invalidate(),
  });
  const deleteMutation = trpc.empacotamento.checklist.deleteItem.useMutation({
    onSuccess: () => utils.empacotamento.checklist.listPorCaixa.invalidate(),
  });
  const [novoItem, setNovoItem] = useState("");
  const [obrigatorio, setObrigatorio] = useState(true);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editandoTexto, setEditandoTexto] = useState("");

  const handleAdd = () => {
    if (!novoItem.trim()) return;
    addMutation.mutate({ modeloCaixaId, descricao: novoItem.trim(), obrigatorio: obrigatorio ? 1 : 0, ordem: itens.length });
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> Checklist de Embalagem
        <span className="ml-1 text-blue-600 font-bold">{itens.length}</span>
      </p>
      {isLoading && <p className="text-xs text-gray-400">Carregando...</p>}
      <div className="space-y-1 mb-2">
        {itens.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2 group">
            {editandoId === item.id ? (
              <>
                <input
                  className="flex-1 text-sm border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={editandoTexto}
                  onChange={e => setEditandoTexto(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { updateMutation.mutate({ id: item.id, descricao: editandoTexto, obrigatorio: item.obrigatorio ?? 1 }); setEditandoId(null); }
                    if (e.key === "Escape") setEditandoId(null);
                  }}
                  autoFocus
                />
                <button onClick={() => { updateMutation.mutate({ id: item.id, descricao: editandoTexto, obrigatorio: item.obrigatorio ?? 1 }); setEditandoId(null); }} className="text-green-500 hover:text-green-700">
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditandoId(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}.</span>
                <span className="flex-1 text-sm text-gray-700">{item.descricao}</span>
                {item.obrigatorio === 1 && <span className="text-xs text-red-500 shrink-0">*</span>}
                <button onClick={() => { setEditandoId(item.id); setEditandoTexto(item.descricao); }} className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-600 transition-opacity">
                  <Edit2 className="w-3 h-3" />
                </button>
                <button onClick={() => deleteMutation.mutate({ id: item.id })} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        ))}
        {itens.length === 0 && !isLoading && (
          <p className="text-xs text-gray-400 italic">Nenhum item ainda. Adicione abaixo.</p>
        )}
      </div>
      <div className="flex gap-1.5 items-center">
        <input
          className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="Novo item do checklist..."
          value={novoItem}
          onChange={e => setNovoItem(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
        <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap cursor-pointer">
          <input type="checkbox" checked={obrigatorio} onChange={e => setObrigatorio(e.target.checked)} className="accent-red-500 w-3 h-3" />
          Obrig.
        </label>
        <button onClick={handleAdd} disabled={!novoItem.trim() || addMutation.isPending} className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-1">* = obrigatório para finalizar pedido</p>
    </div>
  );
}

function ChecklistInlineLetreiro({ modeloLetreitoId, nome }: { modeloLetreitoId: number; nome: string }) {
  const utils = trpc.useUtils();
  const { data: itens = [], isLoading } = trpc.empacotamento.checklistLetreiro.listPorModelo.useQuery({ modeloId: modeloLetreitoId });
  const addMutation = trpc.empacotamento.checklistLetreiro.addItem.useMutation({
    onSuccess: () => { utils.empacotamento.checklistLetreiro.listPorModelo.invalidate(); setNovoItem(""); },
  });
  const updateMutation = trpc.empacotamento.checklistLetreiro.updateItem.useMutation({
    onSuccess: () => utils.empacotamento.checklistLetreiro.listPorModelo.invalidate(),
  });
  const deleteMutation = trpc.empacotamento.checklistLetreiro.deleteItem.useMutation({
    onSuccess: () => utils.empacotamento.checklistLetreiro.listPorModelo.invalidate(),
  });
  const [novoItem, setNovoItem] = useState("");
  const [obrigatorio, setObrigatorio] = useState(true);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editandoTexto, setEditandoTexto] = useState("");

  const handleAdd = () => {
    if (!novoItem.trim()) return;
    addMutation.mutate({ modeloId: modeloLetreitoId, descricao: novoItem.trim(), obrigatorio: obrigatorio ? 1 : 0, ordem: itens.length });
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Checklist de Embalagem
        <span className="ml-1 text-emerald-600 font-bold">{itens.length}</span>
      </p>
      {isLoading && <p className="text-xs text-gray-400">Carregando...</p>}
      <div className="space-y-1 mb-2">
        {(itens as Array<{ id: number; descricao: string; obrigatorio?: number | null; ordem?: number | null }>).map((item, i) => (
          <div key={item.id} className="flex items-center gap-2 group">
            {editandoId === item.id ? (
              <>
                <input
                  className="flex-1 text-sm border border-emerald-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  value={editandoTexto}
                  onChange={e => setEditandoTexto(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { updateMutation.mutate({ id: item.id, descricao: editandoTexto, obrigatorio: item.obrigatorio ?? 1 }); setEditandoId(null); }
                    if (e.key === "Escape") setEditandoId(null);
                  }}
                  autoFocus
                />
                <button onClick={() => { updateMutation.mutate({ id: item.id, descricao: editandoTexto, obrigatorio: item.obrigatorio ?? 1 }); setEditandoId(null); }} className="text-green-500 hover:text-green-700">
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditandoId(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}.</span>
                <span className="flex-1 text-sm text-gray-700">{item.descricao}</span>
                {item.obrigatorio === 1 && <span className="text-xs text-red-500 shrink-0">*</span>}
                <button onClick={() => { setEditandoId(item.id); setEditandoTexto(item.descricao); }} className="opacity-0 group-hover:opacity-100 text-emerald-400 hover:text-emerald-600 transition-opacity">
                  <Edit2 className="w-3 h-3" />
                </button>
                <button onClick={() => deleteMutation.mutate({ id: item.id })} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        ))}
        {itens.length === 0 && !isLoading && (
          <p className="text-xs text-gray-400 italic">Nenhum item ainda. Adicione abaixo.</p>
        )}
      </div>
      <div className="flex gap-1.5 items-center">
        <input
          className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          placeholder="Novo item do checklist..."
          value={novoItem}
          onChange={e => setNovoItem(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
        <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap cursor-pointer">
          <input type="checkbox" checked={obrigatorio} onChange={e => setObrigatorio(e.target.checked)} className="accent-red-500 w-3 h-3" />
          Obrig.
        </label>
        <button onClick={handleAdd} disabled={!novoItem.trim() || addMutation.isPending} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-1">* = obrigatório para finalizar pedido</p>
    </div>
  );
}

// ─── Modal de Checklist por Caixa ────────────────────────────────────────────
function ChecklistModal({ caixa, onClose }: { caixa: { id: number; nome: string }; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: itens = [] } = trpc.empacotamento.checklist.listPorCaixa.useQuery({ modeloCaixaId: caixa.id });
  const addMutation = trpc.empacotamento.checklist.addItem.useMutation({
    onSuccess: () => { utils.empacotamento.checklist.listPorCaixa.invalidate(); setNovoItem(""); },
  });
  const deleteMutation = trpc.empacotamento.checklist.deleteItem.useMutation({
    onSuccess: () => utils.empacotamento.checklist.listPorCaixa.invalidate(),
  });
  const [novoItem, setNovoItem] = useState("");
  const [obrigatorio, setObrigatorio] = useState(true);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Checklist — {caixa.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={novoItem} onChange={e => setNovoItem(e.target.value)}
              placeholder="Novo item do checklist..." onKeyDown={e => e.key === "Enter" && novoItem && addMutation.mutate({ modeloCaixaId: caixa.id, descricao: novoItem, obrigatorio: obrigatorio ? 1 : 0, ordem: itens.length })} />
            <label className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
              <input type="checkbox" checked={obrigatorio} onChange={e => setObrigatorio(e.target.checked)} className="accent-red-500" />
              Obrig.
            </label>
            <Button size="sm" onClick={() => novoItem && addMutation.mutate({ modeloCaixaId: caixa.id, descricao: novoItem, obrigatorio: obrigatorio ? 1 : 0, ordem: itens.length })} disabled={!novoItem}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {itens.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhum item ainda.</p>}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {itens.map((item, i) => (
              <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                <span className="flex-1 text-sm text-gray-700">{item.descricao}</span>
                {item.obrigatorio === 1 && <span className="text-xs text-red-500">*</span>}
                <button onClick={() => deleteMutation.mutate({ id: item.id })} className="text-red-400 hover:text-red-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">* = obrigatório para finalizar</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Admin: Modelos de Letreiro ───────────────────────────────────────────────
function ModelosLetreirosAdmin() {
  const utils = trpc.useUtils();
  const { data: modelos = [] } = trpc.empacotamento.modelos.list.useQuery();
  const { data: modelosCaixa = [] } = trpc.empacotamento.modelosCaixa.listAtivos.useQuery();
  const createMutation = trpc.empacotamento.modelos.create.useMutation({
    onSuccess: () => { utils.empacotamento.modelos.list.invalidate(); setForm({ nome: "", descricao: "", tempoPorM2Min: "", valorProdutividadePorMinLetreiro: "" }); toast("Modelo criado!"); },
  });
  const updateMutation = trpc.empacotamento.modelos.update.useMutation({
    onSuccess: () => { utils.empacotamento.modelos.list.invalidate(); setEditando(null); toast("Modelo atualizado!"); },
  });
  const deleteMutation = trpc.empacotamento.modelos.delete.useMutation({
    onSuccess: () => utils.empacotamento.modelos.list.invalidate(),
  });
  const [form, setForm] = useState({ nome: "", descricao: "", tempoPorM2Min: "", valorProdutividadePorMinLetreiro: "" });
  const [editando, setEditando] = useState<{ id: number; nome: string; descricao?: string | null; ativo: number; modeloCaixaIdPadrao?: number | null; tempoPorM2Min?: string | number | null; valorProdutividadePorMinLetreiro?: string | number | null } | null>(null);
  const [insumosLetreiAberto, setInsumosLetreiAberto] = useState<{ id: number; nome: string } | null>(null);
  const [checklistLetreiExpandido, setChecklistLetreiExpandido] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* Formulário de criação */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Novo Modelo de Letreiro</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Letreiro Galvanizado" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Descrição opcional" />
          </div>
          <div>
            <Label>Tempo por m² (min)</Label>
            <Input type="number" step="0.01" min="0" value={form.tempoPorM2Min} onChange={e => setForm(p => ({ ...p, tempoPorM2Min: e.target.value }))} placeholder="Ex: 8" />
            <p className="text-xs text-gray-400 mt-0.5">Minutos para embalar 1 m² deste letreiro</p>
          </div>
          <div>
            <Label>Produtividade por minuto (R$)</Label>
            <Input type="number" step="0.0001" min="0" value={form.valorProdutividadePorMinLetreiro} onChange={e => setForm(p => ({ ...p, valorProdutividadePorMinLetreiro: e.target.value }))} placeholder="Ex: 0.15" />
            <p className="text-xs text-gray-400 mt-0.5">Valor de comissão por minuto de execução</p>
          </div>
        </div>
        <Button className="mt-3 bg-emerald-600 text-white" onClick={() => form.nome && createMutation.mutate({ nome: form.nome, descricao: form.descricao || undefined, tempoPorM2Min: form.tempoPorM2Min ? parseFloat(form.tempoPorM2Min) : undefined, valorProdutividadePorMinLetreiro: form.valorProdutividadePorMinLetreiro ? parseFloat(form.valorProdutividadePorMinLetreiro) : undefined })} disabled={!form.nome}>
          <Plus className="w-4 h-4 mr-1" /> Criar
        </Button>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {modelos.map(m => (
          <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-3">
            {editando?.id === m.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Nome</Label>
                    <Input value={editando.nome} onChange={e => setEditando(p => p ? { ...p, nome: e.target.value } : p)} />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Input value={editando.descricao ?? ""} onChange={e => setEditando(p => p ? { ...p, descricao: e.target.value } : p)} />
                  </div>
                  <div>
                    <Label>Tempo por m² (min)</Label>
                    <Input type="number" step="0.01" min="0" value={editando.tempoPorM2Min ?? ""} onChange={e => setEditando(p => p ? { ...p, tempoPorM2Min: e.target.value } : p)} placeholder="Ex: 8" />
                    <p className="text-xs text-gray-400 mt-0.5">Minutos para embalar 1 m² deste letreiro</p>
                  </div>
                  <div>
                    <Label>Produtividade por minuto (R$)</Label>
                    <Input type="number" step="0.0001" min="0" value={editando.valorProdutividadePorMinLetreiro ?? ""} onChange={e => setEditando(p => p ? { ...p, valorProdutividadePorMinLetreiro: e.target.value } : p)} placeholder="Ex: 0.15" />
                    <p className="text-xs text-gray-400 mt-0.5">Valor de comissão por minuto de execução</p>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Caixa Padrão (vínculo automático ao criar pedido)</Label>
                    <Select
                      value={editando.modeloCaixaIdPadrao ? String(editando.modeloCaixaIdPadrao) : "none"}
                      onValueChange={v => setEditando(p => p ? { ...p, modeloCaixaIdPadrao: v === "none" ? null : parseInt(v) } : p)}
                    >
                      <SelectTrigger><SelectValue placeholder="Nenhuma caixa padrão" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem caixa padrão</SelectItem>
                        {modelosCaixa.map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-emerald-600 text-white" onClick={() => editando && updateMutation.mutate({ id: editando.id, nome: editando.nome, descricao: editando.descricao ?? undefined, modeloCaixaIdPadrao: editando.modeloCaixaIdPadrao ?? undefined, tempoPorM2Min: editando.tempoPorM2Min ? parseFloat(String(editando.tempoPorM2Min)) : undefined, valorProdutividadePorMinLetreiro: editando.valorProdutividadePorMinLetreiro ? parseFloat(String(editando.valorProdutividadePorMinLetreiro)) : undefined })}>
                    <Save className="w-3.5 h-3.5 mr-1" /> Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-800">{m.nome}</p>
                  {m.descricao && <p className="text-sm text-gray-500">{m.descricao}</p>}
                  {(m as typeof m & { modeloCaixaIdPadrao?: number | null }).modeloCaixaIdPadrao && (
                    <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                      <Boxes className="w-3 h-3" /> Caixa padrão: {modelosCaixa.find(c => c.id === (m as typeof m & { modeloCaixaIdPadrao?: number | null }).modeloCaixaIdPadrao)?.nome ?? ""}
                    </p>
                  )}
                  {(m as any).tempoPorM2Min && parseFloat(String((m as any).tempoPorM2Min)) > 0 && (
                    <p className="text-xs text-indigo-600 mt-0.5 flex items-center gap-1">
                      <span>⏱</span> {parseFloat(String((m as any).tempoPorM2Min)).toFixed(1)} min/m²
                    </p>
                  )}
                  {(m as any).valorProdutividadePorMinLetreiro && parseFloat(String((m as any).valorProdutividadePorMinLetreiro)) > 0 && (
                    <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                      <span>💰</span> R$ {parseFloat(String((m as any).valorProdutividadePorMinLetreiro)).toFixed(4)}/min
                    </p>
                  )}
                </div>
                <div className="flex gap-1 items-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {m.ativo ? "Ativo" : "Inativo"}
                  </span>
                  <button onClick={() => setChecklistLetreiExpandido(checklistLetreiExpandido === m.id ? null : m.id)} className={`p-2 rounded-lg transition-colors ${checklistLetreiExpandido === m.id ? "bg-emerald-100 text-emerald-700" : "text-emerald-500 hover:bg-emerald-50"}`} title="Checklist">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setInsumosLetreiAberto({ id: m.id, nome: m.nome })} className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg" title="Insumos deste letreiro">
                    <Package className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditando({ id: m.id, nome: m.nome, descricao: m.descricao, ativo: m.ativo ?? 1, modeloCaixaIdPadrao: (m as typeof m & { modeloCaixaIdPadrao?: number | null }).modeloCaixaIdPadrao, tempoPorM2Min: (m as any).tempoPorM2Min, valorProdutividadePorMinLetreiro: (m as any).valorProdutividadePorMinLetreiro })} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteMutation.mutate({ id: m.id })} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            {checklistLetreiExpandido === m.id && (
              <ChecklistInlineLetreiro modeloLetreitoId={m.id} nome={m.nome} />
            )}
          </div>
        ))}
      </div>
      {insumosLetreiAberto && (
        <InsumosLetreirosModal letreiro={insumosLetreiAberto} onClose={() => setInsumosLetreiAberto(null)} />
      )}
    </div>
  );
}

// ─── Modal: Insumos por Modelo de Caixa ──────────────────────────────────────
function InsumosModeloCaixaModal({ caixa, onClose }: { caixa: { id: number; nome: string }; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: insumosCaixa = [] } = trpc.empacotamento.consumoCaixa.listPorCaixa.useQuery({ modeloCaixaId: caixa.id });
  const { data: todosInsumos = [] } = trpc.empacotamento.insumos.list.useQuery();
  const upsertMutation = trpc.empacotamento.consumoCaixa.upsert.useMutation({
    onSuccess: () => { utils.empacotamento.consumoCaixa.listPorCaixa.invalidate(); setForm({ insumoId: "", quantidade: "", formulaConsumo: "fixo" as const, fator: "1" }); toast("Insumo salvo!"); },
  });
  const deleteMutation = trpc.empacotamento.consumoCaixa.delete.useMutation({
    onSuccess: () => utils.empacotamento.consumoCaixa.listPorCaixa.invalidate(),
  });
  const [form, setForm] = useState({ insumoId: "", quantidade: "", formulaConsumo: "fixo" as "fixo" | "area_externa_m2" | "volume_interno_m3" | "arestas_m", fator: "1" });
  const formulaLabels: Record<string, string> = { fixo: "Qtd fixa", area_externa_m2: "Área externa (m²)", volume_interno_m3: "Volume interno (m³)", arestas_m: "12 Arestas (m)" };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Insumos da Caixa — {caixa.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label>Insumo</Label>
              <Select value={form.insumoId} onValueChange={v => setForm(p => ({ ...p, insumoId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar insumo" /></SelectTrigger>
                <SelectContent>
                  {todosInsumos.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.nome} ({i.unidadeMedida})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fórmula de Consumo</Label>
              <Select value={form.formulaConsumo} onValueChange={v => setForm(p => ({ ...p, formulaConsumo: v as typeof form.formulaConsumo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixo">Quantidade Fixa</SelectItem>
                  <SelectItem value="area_externa_m2">Área Externa (m²)</SelectItem>
                  <SelectItem value="volume_interno_m3">Volume Interno (m³)</SelectItem>
                  <SelectItem value="arestas_m">12 Arestas (m)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{form.formulaConsumo === "fixo" ? "Quantidade" : "Fator multiplicador"}</Label>
              <Input type="number" step="0.001" min="0" value={form.formulaConsumo === "fixo" ? form.quantidade : form.fator}
                onChange={e => form.formulaConsumo === "fixo" ? setForm(p => ({ ...p, quantidade: e.target.value })) : setForm(p => ({ ...p, fator: e.target.value }))}
                placeholder={form.formulaConsumo === "fixo" ? "Ex: 2" : "Ex: 1.1"} />
            </div>
          </div>
          <Button className="w-full bg-emerald-600 text-white" disabled={!form.insumoId || upsertMutation.isPending}
            onClick={() => form.insumoId && upsertMutation.mutate({
              modeloCaixaId: caixa.id,
              insumoId: parseInt(form.insumoId),
              quantidadePorCaixa: form.formulaConsumo === "fixo" ? parseFloat(form.quantidade || "0") : 0,
              formulaConsumo: form.formulaConsumo,
              fator: parseFloat(form.fator || "1"),
            })}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar Insumo
          </Button>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {insumosCaixa.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhum insumo configurado.</p>}
            {insumosCaixa.map((ic: any) => (
              <div key={ic.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                <div>
                  <span className="font-medium text-gray-800">{ic.insumo?.nome ?? `ID ${ic.insumoId}`}</span>
                  <span className="text-gray-500 ml-2">({ic.insumo?.unidadeMedida})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{formulaLabels[ic.formulaConsumo ?? "fixo"] ?? ic.formulaConsumo}</span>
                  <span className="text-gray-600">× {parseFloat(String(ic.fator ?? 1)).toFixed(3)}</span>
                  <button onClick={() => deleteMutation.mutate({ id: ic.id })} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal: Insumos por Modelo de Letreiro ────────────────────────────────────
function InsumosLetreirosModal({ letreiro, onClose }: { letreiro: { id: number; nome: string }; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: insumosLetreiro = [] } = trpc.empacotamento.insumosLetreiro.listPorModelo.useQuery({ modeloLetreiId: letreiro.id });
  const { data: todosInsumos = [] } = trpc.empacotamento.insumos.list.useQuery();
  const upsertMutation = trpc.empacotamento.insumosLetreiro.upsert.useMutation({
    onSuccess: () => { utils.empacotamento.insumosLetreiro.listPorModelo.invalidate(); setForm({ insumoId: "", fatorM2: "", observacao: "" }); toast("Insumo salvo!"); },
  });
  const deleteMutation = trpc.empacotamento.insumosLetreiro.delete.useMutation({
    onSuccess: () => utils.empacotamento.insumosLetreiro.listPorModelo.invalidate(),
  });
  const [form, setForm] = useState({ insumoId: "", fatorM2: "", observacao: "" });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Insumos do Letreiro — {letreiro.nome}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-2">Configure os materiais de embalagem específicos deste modelo de letreiro.</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label>Insumo</Label>
              <Select value={form.insumoId} onValueChange={v => setForm(p => ({ ...p, insumoId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar insumo" /></SelectTrigger>
                <SelectContent>
                  {todosInsumos.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.nome} ({i.unidadeMedida})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade por m² do letreiro</Label>
              <Input type="number" step="0.001" min="0" value={form.fatorM2} onChange={e => setForm(p => ({ ...p, fatorM2: e.target.value }))} placeholder="Ex: 0.5" />
              <p className="text-xs text-gray-400 mt-1">Unidades consumidas por cada m² do letreiro</p>
            </div>
            <div>
              <Label>Observação (opcional)</Label>
              <Input value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} placeholder="Ex: envolve 2x" />
            </div>
          </div>
          <Button className="w-full bg-emerald-600 text-white" disabled={!form.insumoId || !form.fatorM2 || upsertMutation.isPending}
            onClick={() => form.insumoId && upsertMutation.mutate({
              modeloLetreiId: letreiro.id,
              insumoId: parseInt(form.insumoId),
              fatorM2: parseFloat(form.fatorM2),
              observacao: form.observacao || undefined,
            })}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar Insumo
          </Button>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {insumosLetreiro.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhum insumo configurado.</p>}
            {insumosLetreiro.map((il: any) => (
              <div key={il.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                <div>
                  <span className="font-medium text-gray-800">{il.insumo?.nome ?? `ID ${il.insumoId}`}</span>
                  <span className="text-gray-500 ml-2">({il.insumo?.unidadeMedida})</span>
                  {il.observacao && <span className="text-gray-400 ml-2 italic">{il.observacao}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-700 font-medium">{parseFloat(String(il.fatorM2 ?? il.quantidade ?? 0)).toFixed(3)}/m²</span>
                  <span className="text-xs text-gray-500">{il.insumo?.unidadeMedida}</span>
                  <button onClick={() => deleteMutation.mutate({ id: il.id })} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
            {insumosLetreiro.length > 0 && (
              <div className="flex justify-end pt-2 border-t">
                <span className="text-xs text-gray-500">
                  Custo calculado ao criar pedido (fator × m² do projeto)
                </span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Admin: Tabela de Preços ──────────────────────────────────────────────────
function TabelaPrecosAdmin() {
  const utils = trpc.useUtils();
  const { data: modelos = [] } = trpc.empacotamento.modelos.listAtivos.useQuery();
  const { data: precos = [] } = trpc.empacotamento.precos.list.useQuery();
  const upsertMutation = trpc.empacotamento.precos.upsert.useMutation({
    onSuccess: () => { utils.empacotamento.precos.list.invalidate(); toast("Preço salvo!"); },
  });
  const deleteMutation = trpc.empacotamento.precos.delete.useMutation({
    onSuccess: () => utils.empacotamento.precos.list.invalidate(),
  });

  const [form, setForm] = useState({ modeloId: "", tipoCaixa: "", valorComissao: "" });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Adicionar / Atualizar Preço</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Modelo de Letreiro</Label>
            <Select value={form.modeloId} onValueChange={v => setForm(p => ({ ...p, modeloId: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {modelos.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de Caixa</Label>
            <Input value={form.tipoCaixa} onChange={e => setForm(p => ({ ...p, tipoCaixa: e.target.value }))} placeholder="Ex: G" />
          </div>
          <div>
            <Label>Comissão (R$)</Label>
            <Input type="number" step="0.01" value={form.valorComissao} onChange={e => setForm(p => ({ ...p, valorComissao: e.target.value }))} placeholder="0,00" />
          </div>
        </div>
        <Button className="mt-3 bg-emerald-600 text-white"
          disabled={!form.modeloId || !form.tipoCaixa || !form.valorComissao}
          onClick={() => upsertMutation.mutate({ modeloId: parseInt(form.modeloId), tipoCaixa: form.tipoCaixa, valorComissao: parseFloat(form.valorComissao) })}>
          <Save className="w-4 h-4 mr-1" /> Salvar
        </Button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="text-gray-600">Modelo</TableHead>
              <TableHead className="text-gray-600">Caixa</TableHead>
              <TableHead className="text-right text-gray-600">Comissão</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {precos.map(p => {
              const modelo = modelos.find(m => m.id === p.modeloId);
              return (
                <TableRow key={p.id}>
                  <TableCell className="text-gray-700">{modelo?.nome ?? `ID ${p.modeloId}`}</TableCell>
                  <TableCell><span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-medium">{p.tipoCaixa}</span></TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600">R$ {parseFloat(String(p.valorComissao)).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <button onClick={() => deleteMutation.mutate({ id: p.id })} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
            {precos.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-400">Nenhum preço cadastrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── RELATÓRIO ────────────────────────────────────────────────────────────────
function RelatorioView() {
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
  const [dataInicio, setDataInicio] = useState(primeiroDia);
  const [dataFim, setDataFim] = useState(hoje.toISOString().split("T")[0]);
  const [abaRel, setAbaRel] = useState<"fechamento" | "expedidos">("fechamento");
  const { data, isLoading } = trpc.empacotamento.relatorio.fechamento.useQuery({ dataInicio, dataFim });
  const { data: expedidos = [], isLoading: loadingExp } = trpc.empacotamento.relatorio.expedidosCompleto.useQuery({ dataInicio, dataFim });;

  return (
    <div className="space-y-4">
      {/* Abas do relatório */}
      <div className="flex gap-2 border-b pb-2">
        <button onClick={() => setAbaRel("fechamento")} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all ${abaRel === "fechamento" ? "bg-emerald-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
          Fechamento / Comissões
        </button>
        <button onClick={() => setAbaRel("expedidos")} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all flex items-center gap-1 ${abaRel === "expedidos" ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
          <FileDown className="w-4 h-4" /> Pedidos Expedidos
        </button>
      </div>
      {/* Filtro */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Período</h3>
        <div className="flex gap-3 flex-wrap">
          <div>
            <Label>De</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
        </div>
      </div>

      {isLoading && <div className="text-center py-8 text-gray-400">Carregando...</div>}

      {data && (
        <>
          {/* Totais */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 text-center">
              <div className="text-3xl font-bold text-emerald-700">R$ {data.totalGeral.toFixed(2)}</div>
              <div className="text-sm text-emerald-600 mt-1">Total a Pagar</div>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200 text-center">
              <div className="text-3xl font-bold text-blue-700">{data.totalPedidos}</div>
              <div className="text-sm text-blue-600 mt-1">Pedidos no Pátio</div>
            </div>
          </div>

          {/* Por operador */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-800">Comissão por Operador</h3>
            </div>
            {data.porOperador.length === 0 && (
              <div className="text-center py-8 text-gray-400">Nenhum dado no período.</div>
            )}
            {data.porOperador.map((op) => (
              <div key={op.operadorNome} className="flex items-center justify-between px-4 py-3 border-b last:border-0 hover:bg-gray-50">
                <div>
                  <p className="font-semibold text-gray-800">{op.operadorNome}</p>
                  <p className="text-sm text-gray-500">{op.quantidade} pedido(s)</p>

                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-emerald-600">R$ {op.totalComissao.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>        </>
      )}

      {/* Aba: Pedidos Expedidos */}
      {abaRel === "expedidos" && (
        <div className="space-y-4">
          {loadingExp && <div className="text-center py-8 text-gray-400">Carregando pedidos expedidos...</div>}
          {!loadingExp && expedidos.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhum pedido expedido no período selecionado.</p>
            </div>
          )}
          {!loadingExp && expedidos.length > 0 && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                <span className="text-blue-700 font-semibold">{expedidos.length} pedido(s) expedido(s) no período</span>
                <button
                  className="text-xs text-blue-600 underline"
                  onClick={() => {
                    const rows = expedidos.map(p => [
                      p.numeroPedido ?? p.id,
                      p.cliente ?? "",
                      p.modeloNome ?? "",
                      p.finalizadoEm ? new Date(p.finalizadoEm).toLocaleString("pt-BR") : "",
                      (p as any).operadores?.map((o: any) => o.usuarioNome).join(", ") ?? "",
                    ].join("\t"));
                    const csv = ["OS\tCliente\tModelo\tExpedido em\tOperadores", ...rows].join("\n");
                    const blob = new Blob([csv], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = "expedidos.tsv"; a.click();
                  }}
                >
                  ↓ Exportar TSV
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {expedidos.map(pedido => (
                  <div key={pedido.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    {/* Fotos */}
                    {(pedido as any).fotos?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-0.5 bg-gray-100">
                        {(pedido as any).fotos.slice(0, 4).map((f: any, i: number) => (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer">
                            <img src={f.url} alt="foto" className="w-full h-24 object-cover hover:opacity-80 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    ) : pedido.arquivoUrl ? (
                      <a href={pedido.arquivoUrl} target="_blank" rel="noopener noreferrer">
                        <img src={pedido.arquivoUrl} alt="arquivo" className="w-full h-32 object-cover hover:opacity-80 transition-opacity" />
                      </a>
                    ) : (
                      <div className="h-24 bg-gray-50 flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                    {/* Informações */}
                    <div className="p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-700">OS #{pedido.numeroPedido ?? pedido.id}</span>
                        <span className="text-xs text-gray-400">{pedido.finalizadoEm ? new Date(pedido.finalizadoEm).toLocaleDateString("pt-BR") : ""}</span>
                      </div>
                      {pedido.cliente && <p className="text-sm font-semibold text-gray-800 truncate">{pedido.cliente}</p>}
                      {pedido.modeloNome && <p className="text-xs text-gray-500">{pedido.modeloNome}</p>}
                      {pedido.prazoEntrega && (
                        <p className="text-xs text-gray-500">Prazo: {new Date(pedido.prazoEntrega).toLocaleDateString("pt-BR")}</p>
                      )}
                      {(pedido as any).operadores?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(pedido as any).operadores.map((op: any, i: number) => (
                            <span key={i} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{op.usuarioNome}</span>
                          ))}
                        </div>
                      )}

                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
// ─── Admin: Insumos de Embalagem (ERP leve) ──────────────────────────────────────────────
function InsumosAdmin() {
  const utils = trpc.useUtils();
  const { data: insumos = [] } = trpc.empacotamento.insumos.list.useQuery();
  const createMutation = trpc.empacotamento.insumos.create.useMutation({
    onSuccess: () => { utils.empacotamento.insumos.list.invalidate(); setForm(EMPTY_INSUMO); toast("Insumo criado!"); },
  });
  const updateMutation = trpc.empacotamento.insumos.update.useMutation({
    onSuccess: () => { utils.empacotamento.insumos.list.invalidate(); setEditando(null); toast("Insumo atualizado!"); },
  });
  const deleteMutation = trpc.empacotamento.insumos.delete.useMutation({
    onSuccess: () => utils.empacotamento.insumos.list.invalidate(),
  });

  const EMPTY_INSUMO = { nome: "", unidadeMedida: "" as "m²" | "metro" | "kg" | "unidades" | "", custoUnitario: "", categoria: "" };
  const [form, setForm] = useState(EMPTY_INSUMO);
  const [editando, setEditando] = useState<{ id: number; nome: string; unidadeMedida: string; custoUnitario: string; categoria?: string | null } | null>(null);

  const categorias = Array.from(new Set(insumos.map(i => i.categoria).filter(Boolean)));

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
        <strong>Insumos de Embalagem:</strong> Cadastre os materiais utilizados nas caixas com custo unitário. Esses valores serão usados no cálculo de precificação.
      </div>

      {/* Formulário */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Novo Insumo</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Plástico Bolha" />
          </div>
          <div>
            <Label>Unidade de Medida *</Label>
            <Select value={form.unidadeMedida} onValueChange={v => setForm(p => ({ ...p, unidadeMedida: v as "m²" | "metro" | "kg" | "unidades" }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="m²">m² (metro quadrado)</SelectItem>
                <SelectItem value="metro">metro (metro linear)</SelectItem>
                <SelectItem value="kg">kg (quilograma)</SelectItem>
                <SelectItem value="unidades">unidades (peça/unidade)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Custo Unitário (R$) *</Label>
            <Input type="number" step="0.0001" value={form.custoUnitario} onChange={e => setForm(p => ({ ...p, custoUnitario: e.target.value }))} placeholder="0,0000" />
          </div>
          <div className="col-span-2">
            <Label>Categoria</Label>
            <Input value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} placeholder="Ex: Proteção, Fixação, Estrutura" />
          </div>
        </div>
        <Button
          className="mt-3 bg-emerald-600 text-white"
          disabled={!form.nome || !form.unidadeMedida || !form.custoUnitario || createMutation.isPending}
          onClick={() => form.unidadeMedida && createMutation.mutate({ nome: form.nome, unidadeMedida: form.unidadeMedida as "m²" | "metro" | "kg" | "unidades", custoUnitario: parseFloat(form.custoUnitario), categoria: form.categoria || undefined })}
        >
          <Plus className="w-4 h-4 mr-1" /> Adicionar Insumo
        </Button>
      </div>

      {/* Lista agrupada por categoria */}
      {(categorias.length > 0 ? categorias : [null]).map(cat => {
        const grupo = insumos.filter(i => (cat ? i.categoria === cat : !i.categoria));
        if (grupo.length === 0) return null;
        return (
          <div key={cat ?? "sem-categoria"} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {cat && (
              <div className="px-4 py-2 bg-gray-50 border-b">
                <span className="text-sm font-semibold text-gray-600">{cat}</span>
              </div>
            )}
            {grupo.map(ins => (
              <div key={ins.id} className="border-b last:border-0 px-4 py-3">
                {editando?.id === ins.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="col-span-2">
                        <Label>Nome</Label>
                        <Input value={editando.nome} onChange={e => setEditando(p => p ? { ...p, nome: e.target.value } : p)} />
                      </div>
                      <div>
                        <Label>Unidade</Label>
                        <Select value={editando.unidadeMedida} onValueChange={v => setEditando(p => p ? { ...p, unidadeMedida: v } : p)}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="m²">m²</SelectItem>
                            <SelectItem value="metro">metro</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="unidades">unidades</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Custo (R$)</Label>
                        <Input type="number" step="0.0001" value={editando.custoUnitario} onChange={e => setEditando(p => p ? { ...p, custoUnitario: e.target.value } : p)} />
                      </div>
                      <div className="col-span-2">
                        <Label>Categoria</Label>
                        <Input value={editando.categoria ?? ""} onChange={e => setEditando(p => p ? { ...p, categoria: e.target.value } : p)} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-emerald-600 text-white" onClick={() => editando && updateMutation.mutate({ id: editando.id, nome: editando.nome, unidadeMedida: editando.unidadeMedida as "m²" | "metro" | "kg" | "unidades" | undefined, custoUnitario: parseFloat(editando.custoUnitario), categoria: editando.categoria ?? undefined })}>
                        <Save className="w-3.5 h-3.5 mr-1" /> Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{ins.nome}</p>
                      <p className="text-sm text-gray-500">{ins.unidadeMedida}</p>
                      {(ins as any).precoAtualizadoEm && (() => {
                        const dt = new Date((ins as any).precoAtualizadoEm);
                        const vence = new Date(dt); vence.setMonth(vence.getMonth() + 3);
                        const vencido = new Date() > vence;
                        return <p className={`text-xs mt-0.5 ${vencido ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                          Preço: {dt.toLocaleDateString('pt-BR')}{vencido ? ' ⚠️ Vencido (3 meses)' : ''}
                        </p>;
                      })()}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-emerald-700">R$ {parseFloat(String(ins.custoUnitario)).toFixed(4)}<span className="text-xs text-gray-400 font-normal">/{ins.unidadeMedida}</span></span>
                      <button onClick={() => setEditando({ id: ins.id, nome: ins.nome, unidadeMedida: ins.unidadeMedida, custoUnitario: String(ins.custoUnitario), categoria: ins.categoria })} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteMutation.mutate({ id: ins.id })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {insumos.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Nenhum insumo cadastrado.</p>
          <p className="text-xs mt-1">Cadastre os materiais de embalagem para calcular o custo das caixas.</p>
        </div>
      )}
    </div>
  );
}

// Fórmulas geométricas disponíveis para consumo de insumos
const FORMULAS = [
  { value: "area_externa_m2", label: "Área Externa (m²)", desc: "2×(L×A + L×P + A×P) ÷ 10.000", cor: "bg-orange-50 text-orange-700" },
  { value: "volume_interno_m3", label: "Volume Interno (m³)", desc: "L×A×P ÷ 1.000.000", cor: "bg-purple-50 text-purple-700" },
  { value: "perimetro_m", label: "Perímetro (m)", desc: "4×(L+A+P)÷2 ÷ 100", cor: "bg-blue-50 text-blue-700" },
  { value: "fixo", label: "Quantidade Fixa", desc: "Independe das dimensões", cor: "bg-gray-50 text-gray-700" },
];

// ─── Admin: Precificação de Caixas ──────────────────────────────────────────────
function PrecificacaoAdmin() {
  const { data: modelosCaixa = [] } = trpc.empacotamento.modelosCaixa.listAtivos.useQuery();
  const { data: insumos = [] } = trpc.empacotamento.insumos.list.useQuery();
  const { data: funcionarios = [] } = trpc.empacotamento.custoFuncionario.list.useQuery();
  const utils = trpc.useUtils();

  const upsertFuncMutation = trpc.empacotamento.custoFuncionario.upsert.useMutation({
    onSuccess: () => { utils.empacotamento.custoFuncionario.list.invalidate(); setFuncForm(EMPTY_FUNC); toast("Custo salvo!"); },
  });
  const deleteFuncMutation = trpc.empacotamento.custoFuncionario.delete.useMutation({
    onSuccess: () => utils.empacotamento.custoFuncionario.list.invalidate(),
  });

  const upsertConsumMutation = trpc.empacotamento.consumoCaixa.upsert.useMutation({
    onSuccess: () => { utils.empacotamento.consumoCaixa.listPorCaixa.invalidate(); toast("Consumo salvo!"); },
  });
  const deleteConsumMutation = trpc.empacotamento.consumoCaixa.delete.useMutation({
    onSuccess: () => utils.empacotamento.consumoCaixa.listPorCaixa.invalidate(),
  });

  const EMPTY_FUNC = { nome: "", salarioMensal: "", horasMes: "176" };
  const [funcForm, setFuncForm] = useState(EMPTY_FUNC);
  const [caixaSelecionada, setCaixaSelecionada] = useState<number | null>(null);
  const [margem, setMargem] = useState("30");
  // Estado por insumo: { qtd, formula, fator }
  const [insumoConfig, setInsumoConfig] = useState<Record<number, { qtd: string; formula: string; fator: string }>>({});
  // Dimensões para simulação
  const [dimL, setDimL] = useState("");
  const [dimA, setDimA] = useState("");
  const [dimP, setDimP] = useState("");

  const { data: consumos = [] } = trpc.empacotamento.consumoCaixa.listPorCaixa.useQuery(
    { modeloCaixaId: caixaSelecionada! },
    { enabled: !!caixaSelecionada }
  );

  const calcInput = {
    modeloCaixaId: caixaSelecionada!,
    margemPercent: parseFloat(margem) || 30,
    ...(dimL && dimA && dimP ? { larguraCm: parseFloat(dimL), alturaCm: parseFloat(dimA), profundidadeCm: parseFloat(dimP) } : {}),
  };
  const { data: calc } = trpc.empacotamento.precificacao.calcular.useQuery(
    calcInput,
    { enabled: !!caixaSelecionada }
  );

  const caixaAtual = modelosCaixa.find(c => c.id === caixaSelecionada);

  return (

    <div className="space-y-4">
      {/* Custo de Funcionário */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" /> Custo de Mão-de-Obra
        </h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <Label>Nome / Cargo</Label>
            <Input value={funcForm.nome} onChange={e => setFuncForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Embalador" />
          </div>
          <div>
            <Label>Salário Mensal (R$)</Label>
            <Input type="number" value={funcForm.salarioMensal} onChange={e => setFuncForm(p => ({ ...p, salarioMensal: e.target.value }))} placeholder="2.500,00" />
          </div>
          <div>
            <Label>Horas/Mês</Label>
            <Input type="number" value={funcForm.horasMes} onChange={e => setFuncForm(p => ({ ...p, horasMes: e.target.value }))} placeholder="176" />
          </div>
        </div>
        <Button
          className="bg-blue-600 text-white"
          disabled={!funcForm.nome || !funcForm.salarioMensal || !funcForm.horasMes || upsertFuncMutation.isPending}
          onClick={() => upsertFuncMutation.mutate({ nome: funcForm.nome, salarioMensal: parseFloat(funcForm.salarioMensal), horasMes: parseFloat(funcForm.horasMes) })}
        >
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
        {funcionarios.length > 0 && (
          <div className="mt-3 space-y-1">
            {funcionarios.map(f => (
              <div key={f.id} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                <div>
                  <span className="font-medium text-gray-800">{f.nome}</span>
                  <span className="text-sm text-gray-500 ml-2">R$ {parseFloat(String(f.salarioMensal)).toFixed(2)}/mês · {f.horasMes}h</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-blue-700">R$ {parseFloat(String(f.custoHora ?? 0)).toFixed(4)}/h</span>
                  <button onClick={() => deleteFuncMutation.mutate({ id: f.id })} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Consumo por Caixa com Fórmulas Geométricas */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <Boxes className="w-4 h-4 text-emerald-600" /> Consumo de Insumos por Caixa
        </h3>
        <p className="text-xs text-gray-400 mb-3">Configure quanto de cada insumo é consumido por caixa. Use fórmulas geométricas para cálculo automático com base nas dimensões reais.</p>

        {/* Legenda das fórmulas */}
        <div className="flex flex-wrap gap-2 mb-3">
          {FORMULAS.map(f => (
            <span key={f.value} className={`text-xs px-2 py-1 rounded-lg ${f.cor}`}>
              <strong>{f.label}</strong> — {f.desc}
            </span>
          ))}
        </div>

        <div className="mb-3">
          <Label>Selecionar Modelo de Caixa</Label>
          <Select value={caixaSelecionada ? String(caixaSelecionada) : ""} onValueChange={v => { setCaixaSelecionada(parseInt(v)); setInsumoConfig({}); }}>
            <SelectTrigger><SelectValue placeholder="Escolha uma caixa para configurar" /></SelectTrigger>
            <SelectContent>
              {modelosCaixa.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {caixaSelecionada && (
          <div className="space-y-2">
            {caixaAtual && (
              <div className="bg-emerald-50 rounded-xl px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
                <Boxes className="w-3.5 h-3.5" />
                <span>Dimensões padrão: <strong>{caixaAtual.larguraCm}×{caixaAtual.alturaCm}×{caixaAtual.profundidadeCm} cm</strong></span>
                {caixaAtual.tipoCaixa === "personalizada" && <span className="text-purple-600">· Caixa personalizada</span>}
              </div>
            )}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Insumo</TableHead>
                    <TableHead>Fórmula</TableHead>
                    <TableHead className="text-right">Fator</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insumos.map(ins => {
                    const consumoExistente = consumos.find(c => c.insumoId === ins.id);
                    const cfg = insumoConfig[ins.id] ?? {
                      qtd: consumoExistente ? String(consumoExistente.quantidadePorCaixa) : "",
                      formula: consumoExistente?.formulaConsumo ?? "fixo",
                      fator: consumoExistente?.fator ? String(consumoExistente.fator) : "1",
                    };
                    const setCfg = (upd: Partial<typeof cfg>) =>
                      setInsumoConfig(p => ({ ...p, [ins.id]: { ...cfg, ...upd } }));
                    const isGeom = cfg.formula !== "fixo";
                    return (
                      <TableRow key={ins.id}>
                        <TableCell>
                          <span className="font-medium text-gray-800">{ins.nome}</span>
                          <span className="text-xs text-gray-400 ml-1">({ins.unidadeMedida})</span>
                        </TableCell>
                        <TableCell>
                          <Select value={cfg.formula} onValueChange={v => setCfg({ formula: v })}>
                            <SelectTrigger className="h-7 text-xs w-44">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FORMULAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number" step="0.001" className="w-20 h-7 text-xs text-right"
                            placeholder={isGeom ? "fator" : "qtd"}
                            value={isGeom ? cfg.fator : cfg.qtd}
                            onChange={e => isGeom ? setCfg({ fator: e.target.value }) : setCfg({ qtd: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm" variant="outline" className="h-7 px-2 text-xs"
                              disabled={upsertConsumMutation.isPending}
                              onClick={() => upsertConsumMutation.mutate({
                                modeloCaixaId: caixaSelecionada,
                                insumoId: ins.id,
                                quantidadePorCaixa: parseFloat(isGeom ? cfg.fator : cfg.qtd) || 0,
                                formulaConsumo: cfg.formula,
                                fator: parseFloat(cfg.fator) || 1,
                              })}
                            >
                              <Save className="w-3 h-3" />
                            </Button>
                            {consumoExistente && (
                              <button onClick={() => deleteConsumMutation.mutate({ id: consumoExistente.id })} className="text-red-400 hover:text-red-600 p-1">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {insumos.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Cadastre insumos primeiro na aba "Insumos".</p>}
            </div>
          </div>
        )}
      </div>

      {/* Calculadora de Preço */}
      {caixaSelecionada && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-orange-600" /> Precificação — {caixaAtual?.nome}
          </h3>
          <div className="flex items-center gap-3 mb-4">
            <Label className="whitespace-nowrap">Margem de Lucro (%)</Label>
            <Input type="number" className="w-24" value={margem} onChange={e => setMargem(e.target.value)} min="0" max="100" />
          </div>
          {calc ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-gray-800">R$ {calc.custoInsumos.toFixed(4)}</div>
                  <div className="text-xs text-gray-500 mt-1">Custo Insumos</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-blue-700">R$ {calc.custoMaoDeObra.toFixed(4)}</div>
                  <div className="text-xs text-blue-500 mt-1">Mão-de-Obra ({calc.tempoExecucaoMin} min)</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-orange-700">R$ {calc.custoTotal.toFixed(4)}</div>
                  <div className="text-xs text-orange-500 mt-1">Custo Total</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center border-2 border-emerald-300">
                  <div className="text-2xl font-bold text-emerald-700">R$ {calc.precoSugerido.toFixed(2)}</div>
                  <div className="text-xs text-emerald-600 mt-1">Preço Sugerido ({calc.margemPercent}% margem)</div>
                </div>
              </div>
              {calc.detalhesInsumos.length > 0 && (
                <div className="bg-gray-50 rounded-xl overflow-hidden">
                  <Table className="text-xs">
                    <TableHeader className="bg-gray-100">
                      <TableRow>
                        <TableHead>Insumo</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Custo Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calc.detalhesInsumos.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="py-1.5 text-gray-700">{d.nome}</TableCell>
                          <TableCell className="py-1.5 text-right text-gray-600">{d.quantidadeReal?.toFixed(4) ?? '0'} {d.unidade}</TableCell>
                          <TableCell className="py-1.5 text-right text-gray-600">R$ {d.custoUnit.toFixed(4)}</TableCell>
                          <TableCell className="py-1.5 text-right font-medium text-gray-800">R$ {d.custoTotal.toFixed(4)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {calc.custoTotal === 0 && (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
                  Configure o consumo de insumos e o custo de mão-de-obra para calcular o preço sugerido.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">Calculando...</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Admin: Produtividade ─────────────────────────────────────────────────────
function ProdutividadeAdmin() {
  const utils = trpc.useUtils();
  const { data: config } = trpc.empacotamento.configProdutividade.get.useQuery();
  const upsertConfig = trpc.empacotamento.configProdutividade.upsert.useMutation({
    onSuccess: () => { utils.empacotamento.configProdutividade.get.invalidate(); toast("Configuração salva!"); },
  });

  const [formCfg, setFormCfg] = useState({ valorPorMinuto: "", bonusPorcentagem: "", penalidadePorcentagem: "", descricao: "" });
  const [cfgCarregado, setCfgCarregado] = useState(false);

  useEffect(() => {
    if (config && !cfgCarregado) {
      setFormCfg({
        valorPorMinuto: parseFloat(String(config.valorPorMinuto)).toFixed(4),
        bonusPorcentagem: parseFloat(String(config.bonusPorcentagem)).toFixed(2),
        penalidadePorcentagem: parseFloat(String(config.penalidadePorcentagem)).toFixed(2),
        descricao: config.descricao ?? "",
      });
      setCfgCarregado(true);
    }
  }, [config, cfgCarregado]);

  // Relatório
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [dataInicio, setDataInicio] = useState(primeiroDia.toISOString().split("T")[0]);
  const [dataFim, setDataFim] = useState(hoje.toISOString().split("T")[0]);
  const { data: relatorio, isLoading: loadingRel } = trpc.empacotamento.relatorioProdutividade.porColaborador.useQuery({
    dataInicio,
    dataFim,
  });

  return (
    <div className="space-y-6">
      {/* Configuração */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Timer className="w-4 h-4 text-indigo-600" /> Configuração de Produtividade
        </h3>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 text-sm text-indigo-700">
          O valor por minuto é pago quando o pedido é entregue dentro do tempo estimado. Bônus e penalidade ajustam esse valor conforme o desempenho.
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Valor por Minuto (R$)</Label>
            <Input type="number" step="0.0001" min="0" value={formCfg.valorPorMinuto}
              onChange={e => setFormCfg(p => ({ ...p, valorPorMinuto: e.target.value }))}
              placeholder="Ex: 0.1500" />
            <p className="text-xs text-gray-400 mt-0.5">Comissão base por minuto trabalhado</p>
          </div>
          <div>
            <Label>Bônus por antecipação (%)</Label>
            <Input type="number" step="0.01" min="0" max="100" value={formCfg.bonusPorcentagem}
              onChange={e => setFormCfg(p => ({ ...p, bonusPorcentagem: e.target.value }))}
              placeholder="Ex: 20" />
            <p className="text-xs text-gray-400 mt-0.5">% a mais se entregue antes do prazo</p>
          </div>
          <div>
            <Label>Penalidade por atraso (%)</Label>
            <Input type="number" step="0.01" min="0" max="100" value={formCfg.penalidadePorcentagem}
              onChange={e => setFormCfg(p => ({ ...p, penalidadePorcentagem: e.target.value }))}
              placeholder="Ex: 30" />
            <p className="text-xs text-gray-400 mt-0.5">% a menos se entregue com atraso</p>
          </div>
          <div>
            <Label>Observação</Label>
            <Input value={formCfg.descricao} onChange={e => setFormCfg(p => ({ ...p, descricao: e.target.value }))} placeholder="Opcional" />
          </div>
        </div>
        {formCfg.valorPorMinuto && (
          <div className="mt-3 p-3 bg-gray-50 rounded-xl text-xs text-gray-600 grid grid-cols-3 gap-3">
            <div>
              <p className="font-medium text-gray-700">No prazo</p>
              <p className="text-emerald-600 font-bold text-sm">R$ {parseFloat(formCfg.valorPorMinuto || "0").toFixed(4)}/min</p>
            </div>
            <div>
              <p className="font-medium text-gray-700">Antes do prazo (+{formCfg.bonusPorcentagem}%)</p>
              <p className="text-blue-600 font-bold text-sm">R$ {(parseFloat(formCfg.valorPorMinuto || "0") * (1 + parseFloat(formCfg.bonusPorcentagem || "0") / 100)).toFixed(4)}/min</p>
            </div>
            <div>
              <p className="font-medium text-gray-700">Com atraso (-{formCfg.penalidadePorcentagem}%)</p>
              <p className="text-red-600 font-bold text-sm">R$ {(parseFloat(formCfg.valorPorMinuto || "0") * (1 - parseFloat(formCfg.penalidadePorcentagem || "0") / 100)).toFixed(4)}/min</p>
            </div>
          </div>
        )}
        <Button className="mt-3 bg-indigo-600 text-white" disabled={upsertConfig.isPending}
          onClick={() => upsertConfig.mutate({
            valorPorMinuto: parseFloat(formCfg.valorPorMinuto),
            bonusPorcentagem: parseFloat(formCfg.bonusPorcentagem),
            penalidadePorcentagem: parseFloat(formCfg.penalidadePorcentagem),
            descricao: formCfg.descricao || undefined,
          })}>
          Salvar Configuração
        </Button>
      </div>

      {/* Painel Centralizado de Tempo e Produtividade */}
      <PainelCentralProdutividade />

      {/* Relatório */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Timer className="w-4 h-4 text-emerald-600" /> Relatório de Produtividade por Colaborador
        </h3>
        <div className="flex gap-3 mb-4 flex-wrap">
          <div>
            <Label>Data Início</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div>
            <Label>Data Fim</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
        </div>

        {loadingRel && <p className="text-sm text-gray-400 text-center py-4">Carregando...</p>}

        {relatorio && relatorio.colaboradores.length === 0 && (
          <div className="text-center py-6 text-gray-400">
            <Timer className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Nenhum registro no período selecionado.</p>
          </div>
        )}

        {relatorio && relatorio.colaboradores.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 mb-2">
              Config: R$ {parseFloat(String(relatorio.config.valorPorMinuto)).toFixed(4)}/min |
              Bônus: +{relatorio.config.bonusPorcentagem}% |
              Penalidade: -{relatorio.config.penalidadePorcentagem}%
            </div>
            {relatorio.colaboradores.map(col => (
              <div key={col.nome} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-800">{col.nome}</p>
                    <p className="text-xs text-gray-500">{col.totalPedidos} pedido(s) no período</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-emerald-600">R$ {col.valorComBonus.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">base: R$ {col.valorBase.toFixed(2)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white rounded-lg p-2 border">
                    <p className="text-gray-500">Tempo Efetivo</p>
                    <p className="font-bold text-gray-800">{Math.floor(col.totalMinutosEfetivos / 60)}h {Math.round(col.totalMinutosEfetivos % 60)}min</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border">
                    <p className="text-gray-500">Tempo Pausado</p>
                    <p className="font-bold text-amber-600">{Math.floor(col.totalMinutosPausados / 60)}h {Math.round(col.totalMinutosPausados % 60)}min</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border">
                    <p className="text-gray-500">No Prazo</p>
                    <p className="font-bold text-green-600">{col.pedidosNoPrazo} pedido(s)</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border">
                    <p className="text-gray-500">Com Atraso</p>
                    <p className="font-bold text-red-500">{col.pedidosForaDoPrazo} pedido(s)</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Totais */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="font-semibold text-emerald-800 mb-2">Totais do Período</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Total Colaboradores</p>
                  <p className="font-bold text-gray-800">{relatorio.colaboradores.length}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Total Horas Efetivas</p>
                  <p className="font-bold text-gray-800">
                    {Math.floor(relatorio.colaboradores.reduce((a, c) => a + c.totalMinutosEfetivos, 0) / 60)}h {Math.round(relatorio.colaboradores.reduce((a, c) => a + c.totalMinutosEfetivos, 0) % 60)}min
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Total a Pagar</p>
                  <p className="font-bold text-emerald-700 text-lg">R$ {relatorio.colaboradores.reduce((a, c) => a + c.valorComBonus, 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── OPERADOR VIEW — Interface Mobile/Tablet para Operadores ─────────────────
function OperadorView({ localUser, isAdmin }: { localUser: ReturnType<typeof useAuth>["user"]; isAdmin: boolean }) {
  const utils = trpc.useUtils();
  const { data: pedidosEmbalando = [] } = trpc.empacotamento.pedidos.list.useQuery({ kanbanStatus: "embalando" }, { refetchInterval: 10000 });
  const { data: pedidosAguardando = [] } = trpc.empacotamento.pedidos.list.useQuery({ kanbanStatus: "aguardando" }, { refetchInterval: 10000 });
  const { data: empacotadores = [] } = trpc.empacotamento.operadores.list.useQuery();
  const moverMutation = trpc.empacotamento.pedidos.moverKanban.useMutation({
    onSuccess: () => { utils.empacotamento.pedidos.list.invalidate(); },
  });

  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);
  const [operadorAtual, setOperadorAtual] = useState<{ id: string; name: string } | null>(
    localUser ? { id: localUser.id, name: localUser.name } : null
  );
  const [mostrarTrocarOperador, setMostrarTrocarOperador] = useState(false);

  // Detectar automaticamente se o operador já está ativo em algum pedido (restaura após minimizar)
  const { data: pedidoAtivoData } = trpc.empacotamento.pedidoUsuarios.pedidoAtivoDoOperador.useQuery(
    { usuarioId: operadorAtual?.id, usuarioNome: operadorAtual?.name },
    { enabled: !!operadorAtual && !pedidoSelecionado, refetchInterval: 5000 }
  );

  // Restaurar pedidoSelecionado automaticamente se o operador já estava trabalhando
  useEffect(() => {
    if (pedidoAtivoData?.pedido && !pedidoSelecionado) {
      setPedidoSelecionado(pedidoAtivoData.pedido as unknown as Pedido);
    }
  }, [pedidoAtivoData?.pedido?.id]);

  // Atualiza pedido selecionado com dados mais recentes
  const todosPedidos = [...pedidosEmbalando, ...pedidosAguardando] as Pedido[];
  const pedidoAtual = pedidoSelecionado ? (todosPedidos.find(p => p.id === pedidoSelecionado.id) ?? pedidoSelecionado) : null;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Identificação do Operador */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xl font-bold">
              {operadorAtual?.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">{operadorAtual?.name ?? "Sem operador"}</p>
              <p className="text-sm text-gray-500">Empacotamento</p>
            </div>
          </div>
          <button
            onClick={() => setMostrarTrocarOperador(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-600 transition-all active:scale-95"
          >
            <Users className="w-4 h-4" /> Trocar
          </button>
        </div>

        {/* Lista de operadores para troca rápida */}
        {mostrarTrocarOperador && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2 font-medium">Selecione o operador:</p>
            <div className="grid grid-cols-2 gap-2">
              {empacotadores.map(op => (
                <button
                  key={op.id}
                  onClick={() => { setOperadorAtual({ id: op.id, name: op.name }); setMostrarTrocarOperador(false); }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all active:scale-95 ${
                    operadorAtual?.id === op.id
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-emerald-50 hover:border-emerald-300"
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    operadorAtual?.id === op.id ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {op.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{op.name}</span>
                </button>
              ))}
              {empacotadores.length === 0 && (
                <p className="col-span-2 text-xs text-gray-400 text-center py-2">
                  Nenhum empacotador cadastrado. Peça ao supervisor para cadastrar.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pedido em execução */}
      {pedidoAtual && pedidoAtual.kanbanStatus === "embalando" ? (
        <OperadorPedidoAtivo
          pedido={pedidoAtual}
          operador={operadorAtual}
          onFinalizar={() => {
            moverMutation.mutate({ id: pedidoAtual.id, kanbanStatus: "patio" });
            setPedidoSelecionado(null);
          }}
          onRefresh={() => utils.empacotamento.pedidos.list.invalidate()}
        />
      ) : (
        <>
          {/* Pedidos em embalagem */}
          {pedidosEmbalando.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Em Embalagem ({pedidosEmbalando.length})
              </h2>
              <div className="space-y-2">
                {(pedidosEmbalando as Pedido[]).map(p => (
                  <OperadorPedidoCard key={p.id} pedido={p} onSelecionar={() => setPedidoSelecionado(p)} />
                ))}
              </div>
            </div>
          )}

          {/* Pedidos aguardando */}
          {pedidosAguardando.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                Aguardando Início ({pedidosAguardando.length})
              </h2>
              <div className="space-y-2">
                {(pedidosAguardando as Pedido[]).map(p => (
                  <OperadorPedidoCard
                    key={p.id}
                    pedido={p}
                    onSelecionar={() => {
                      moverMutation.mutate({ id: p.id, kanbanStatus: "embalando" });
                      setPedidoSelecionado(p);
                    }}
                    acao="iniciar"
                  />
                ))}
              </div>
            </div>
          )}

          {pedidosEmbalando.length === 0 && pedidosAguardando.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <PackageCheck className="w-16 h-16 mx-auto mb-3 text-gray-200" />
              <p className="font-medium">Nenhum pedido pendente</p>
              <p className="text-sm mt-1">Todos os pedidos foram finalizados!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Card de pedido na visão do operador
function OperadorPedidoCard({ pedido, onSelecionar, acao = "abrir" }: {
  pedido: Pedido;
  onSelecionar: () => void;
  acao?: "abrir" | "iniciar";
}) {
  const prazoStr = prazoLabel(pedido.prazoEntrega, pedido.horarioMaximo);
  const prazoClr = prazoColor(pedido.prazoEntrega);

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm cursor-pointer hover:shadow-md active:scale-[0.98] transition-all"
      onClick={onSelecionar}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-bold text-gray-900 text-lg">#{pedido.numeroPedido}</p>
          <p className="text-sm text-gray-600">{pedido.cliente}</p>
        </div>
        {pedido.modeloCaixaNome && (
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium shrink-0">
            {pedido.modeloCaixaNome}
          </span>
        )}
      </div>
      {pedido.modeloNome && (
        <p className="text-sm text-gray-500 mb-2">Letreiro: {pedido.modeloNome}</p>
      )}
      {prazoStr && (
        <p className={`text-sm flex items-center gap-1.5 font-medium ${prazoClr}`}>
          <Calendar className="w-4 h-4" /> {prazoStr}
        </p>
      )}
      {pedido.arquivoUrl && pedido.arquivoTipo === "image" && (
        <div className="mt-2 rounded-xl overflow-hidden h-24 bg-gray-100">
          <img src={pedido.arquivoUrl} alt="letreiro" className="w-full h-full object-cover" />
        </div>
      )}
      <button
        className={`w-full mt-3 py-3 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all ${
          acao === "iniciar" ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"
        }`}
        onClick={e => { e.stopPropagation(); onSelecionar(); }}
      >
        {acao === "iniciar" ? (
          <><Play className="w-5 h-5" /> Iniciar Embalagem</>
        ) : (
          <><Package className="w-5 h-5" /> Ver Pedido</>
        )}
      </button>
    </div>
  );
}

// Tela de pedido ativo para o operador
function OperadorPedidoAtivo({ pedido, operador, onFinalizar, onRefresh }: {
  pedido: Pedido;
  operador: { id: string; name: string } | null;
  onFinalizar: () => void;
  onRefresh: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: usuarios = [] } = trpc.empacotamento.pedidoUsuarios.listPorPedido.useQuery({ pedidoId: pedido.id }, { refetchInterval: 5000 });
  const { data: checklistItens = [] } = trpc.empacotamento.checklist.listPorCaixa.useQuery(
    { modeloCaixaId: pedido.modeloCaixaId ?? 0 },
    { enabled: !!pedido.modeloCaixaId }
  );
  const { data: checklistPedido = [] } = trpc.empacotamento.checklist.getPorPedido.useQuery({ pedidoId: pedido.id });
  const { data: tempoEstimado } = trpc.empacotamento.tempoEstimado.calcular.useQuery({
    modeloId: pedido.modeloId ?? undefined,
    modeloCaixaId: pedido.modeloCaixaId ?? undefined,
    metrosQuadrados: pedido.metrosQuadrados ? parseFloat(String(pedido.metrosQuadrados)) : undefined,
  }, { enabled: !!(pedido.modeloId || pedido.modeloCaixaId) });

  const entrarMutation = trpc.empacotamento.pedidoUsuarios.entrar.useMutation({
    onSuccess: () => { utils.empacotamento.pedidoUsuarios.listPorPedido.invalidate(); onRefresh(); },
  });
  const sairMutation = trpc.empacotamento.pedidoUsuarios.sair.useMutation({
    onSuccess: () => utils.empacotamento.pedidoUsuarios.listPorPedido.invalidate(),
  });

  const marcarMutation = trpc.empacotamento.checklist.marcarItem.useMutation({
    onSuccess: () => utils.empacotamento.checklist.getPorPedido.invalidate(),
  });
  const uploadFotoMutation = trpc.empacotamento.pedidos.uploadFoto.useMutation({
    onSuccess: () => { utils.empacotamento.pedidos.listFotos.invalidate(); toast("Foto salva!"); },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galeriaInputRef = useRef<HTMLInputElement>(null);
  const [confirmandoFinalizar, setConfirmandoFinalizar] = useState(false);
  // Dimensões e peso (preenchidos pelo operador)
  const [dimL, setDimL] = useState(pedido.larguraCm ? String(pedido.larguraCm) : "");
  const [dimA, setDimA] = useState(pedido.alturaCm ? String(pedido.alturaCm) : "");
  const [dimP, setDimP] = useState(pedido.profundidadeCm ? String(pedido.profundidadeCm) : "");
  const [peso, setPeso] = useState((pedido as any).pesoKg ? String((pedido as any).pesoKg) : "");
  const [salvandoDim, setSalvandoDim] = useState(false);
  const atualizarDimMutation = trpc.empacotamento.pedidos.atualizarDimensoes.useMutation({
    onSuccess: () => { toast("Dimensões salvas!"); onRefresh(); setSalvandoDim(false); },
    onError: () => setSalvandoDim(false),
  });

  // Identificar o usuário ativo
  const usuarioAtivo = usuarios.find(u => u.ativo === 1 && (operador ? u.usuarioId === operador.id || u.usuarioNome === operador.name : false)) ?? null;

  // Entrar automaticamente no pedido se operador selecionado
  useEffect(() => {
    if (operador && !usuarioAtivo && pedido.kanbanStatus === "embalando") {
      entrarMutation.mutate({ pedidoId: pedido.id, usuarioId: operador.id, usuarioNome: operador.name });
    }
  }, [operador?.id, pedido.id]);

  const { data: fotosOperador = [] } = trpc.empacotamento.pedidos.listFotos.useQuery({ pedidoId: pedido.id }, { refetchInterval: 5000 });
  const isChecked = (itemId: number) => checklistPedido.some(c => c.itemId === itemId && c.marcado === 1);
  const obrigatoriosPendentes = checklistItens.filter(i => i.obrigatorio === 1 && !isChecked(i.id));
  const temFotoOperador = fotosOperador.length > 0;
  const temPesoOperador = !!(peso && parseFloat(peso) > 0);
  const temMedidasOperador = !!(dimL && dimA && dimP && parseFloat(dimL) > 0 && parseFloat(dimA) > 0 && parseFloat(dimP) > 0);
  const podeFinalizar = obrigatoriosPendentes.length === 0 && temFotoOperador && temPesoOperador && temMedidasOperador;

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadFotoMutation.mutate({ pedidoId: pedido.id, base64, mimeType: file.type, usuarioNome: operador?.name ?? "Operador" });
    };
    reader.readAsDataURL(file);
  };

  const prazoStr = prazoLabel(pedido.prazoEntrega, pedido.horarioMaximo);
  const prazoClr = prazoColor(pedido.prazoEntrega);

  return (
    <div className="space-y-3">
      {/* Card principal do pedido */}
      <div className="bg-white rounded-2xl border-2 border-emerald-400 p-4 shadow-md">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pedido Ativo</p>
            <p className="font-black text-gray-900 text-2xl">#{pedido.numeroPedido}</p>
            <p className="text-sm text-gray-600">{pedido.cliente}</p>
          </div>
          <div className="text-right">
            {pedido.modeloCaixaNome && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium block mb-1">
                {pedido.modeloCaixaNome}
              </span>
            )}
            {pedido.modeloNome && (
              <p className="text-xs text-gray-400">{pedido.modeloNome}</p>
            )}
          </div>
        </div>

        {/* Prazo */}
        {prazoStr && (
          <div className={`flex items-center gap-2 text-sm font-semibold mb-3 px-3 py-2 rounded-xl ${
            prazoClr === "text-red-600" ? "bg-red-50 text-red-600" :
            prazoClr === "text-amber-500" ? "bg-amber-50 text-amber-600" :
            "bg-green-50 text-green-700"
          }`}>
            <Calendar className="w-4 h-4" /> {prazoStr}
          </div>
        )}

        {/* Dimensões da caixa */}
        {(pedido as any).larguraCm && (
          <div className="flex gap-3 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 mb-3">
            <span className="font-medium">Caixa:</span>
            <span>{(pedido as any).larguraCm} × {(pedido as any).alturaCm} × {(pedido as any).profundidadeCm} cm</span>
          </div>
        )}
        {pedido.metrosQuadrados && (
          <div className="text-sm text-gray-600 bg-blue-50 rounded-xl px-3 py-2 mb-3">
            <span className="font-medium">Área do letreiro:</span> {parseFloat(String(pedido.metrosQuadrados)).toFixed(2)} m²
          </div>
        )}
      </div>

      {/* Botões de foto */}
      <div className="flex gap-3">
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Camera className="w-5 h-5" /> Tirar Foto
        </button>
        <button
          onClick={() => galeriaInputRef.current?.click()}
          className="flex-1 py-3 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Images className="w-5 h-5" /> Galeria
        </button>
      </div>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />
      <input ref={galeriaInputRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />

      {/* Dimensões e peso da caixa — preenchidos pelo operador */}
      <div className="bg-white rounded-2xl border border-indigo-200 p-4">
        <p className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-indigo-500" /> Dimensões e Peso da Caixa
        </p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Largura (cm)</label>
            <input
              type="number" min="0" step="0.1"
              value={dimL}
              onChange={e => setDimL(e.target.value)}
              placeholder="ex: 60"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Altura (cm)</label>
            <input
              type="number" min="0" step="0.1"
              value={dimA}
              onChange={e => setDimA(e.target.value)}
              placeholder="ex: 40"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Profundidade (cm)</label>
            <input
              type="number" min="0" step="0.1"
              value={dimP}
              onChange={e => setDimP(e.target.value)}
              placeholder="ex: 30"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Peso (kg)</label>
            <input
              type="number" min="0" step="0.1"
              value={peso}
              onChange={e => setPeso(e.target.value)}
              placeholder="ex: 5.2"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setSalvandoDim(true);
            atualizarDimMutation.mutate({
              id: pedido.id,
              larguraCm: dimL ? parseFloat(dimL) : null,
              alturaCm: dimA ? parseFloat(dimA) : null,
              profundidadeCm: dimP ? parseFloat(dimP) : null,
              pesoKg: peso ? parseFloat(peso) : null,
            });
          }}
          disabled={salvandoDim || atualizarDimMutation.isPending}
          className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {salvandoDim ? "Salvando..." : "Salvar Dimensões"}
        </button>
      </div>

      {/* Operadores no pedido */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Users className="w-4 h-4" /> Trabalhando neste pedido
        </p>
        {usuarios.length === 0 && <p className="text-sm text-gray-400">Nenhum operador ainda.</p>}
        <div className="space-y-2">
          {usuarios.map(u => (
            <div key={u.id} className={`flex items-center justify-between rounded-xl px-3 py-2 ${u.ativo === 1 ? "bg-emerald-50 border border-emerald-200" : "bg-gray-50 border border-gray-200"}`}>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                  {u.usuarioNome.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-medium text-sm text-gray-800">{u.usuarioNome}</p>

                </div>
              </div>
              {u.ativo === 1 ? (
                <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">Ativo</span>
              ) : (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Checklist */}
      {checklistItens.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Checklist
            <span className="ml-auto text-xs text-gray-400">
              {checklistItens.filter(i => isChecked(i.id)).length}/{checklistItens.length}
            </span>
          </p>
          <div className="space-y-2">
            {checklistItens.map(item => (
              <button
                key={item.id}
                onClick={() => marcarMutation.mutate({ pedidoId: pedido.id, itemId: item.id, marcado: isChecked(item.id) ? 0 : 1, marcadoPor: operador?.name ?? "Operador" })}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.98] ${
                  isChecked(item.id)
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "bg-gray-50 border-gray-200 text-gray-700"
                }`}
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  isChecked(item.id) ? "bg-emerald-600 border-emerald-600" : "border-gray-300"
                }`}>
                  {isChecked(item.id) && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="font-medium text-sm">{item.descricao}</span>
                {item.obrigatorio === 1 && <span className="ml-auto text-xs text-red-400">*</span>}
              </button>
            ))}
          </div>
          {obrigatoriosPendentes.length > 0 && (
            <p className="text-xs text-red-500 mt-2 text-center">
              {obrigatoriosPendentes.length} item(ns) obrigatório(s) pendente(s)
            </p>
          )}
        </div>
      )}

      {/* Arquivo do supervisor */}
      {pedido.arquivoUrl && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <FileImage className="w-4 h-4" /> Arquivo do Supervisor
          </p>
          {pedido.arquivoTipo === "image" ? (
            <ArquivoSupervisorComAnotacao
              url={pedido.arquivoUrl}
              pedidoId={pedido.id}
              onSaved={(novaUrl) => onRefresh()}
            />
          ) : (
            <a href={pedido.arquivoUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-medium">
              <FileText className="w-5 h-5" /> Abrir PDF do projeto
            </a>
          )}
        </div>
      )}

      {/* Botões de ação */}
      <div className="space-y-2 pb-6">
        {/* Checklist de requisitos para finalizar */}
        {!podeFinalizar && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1.5">
            <p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
              <span>⚠</span> Requisitos para mover ao Pátio:
            </p>
            <div className={`flex items-center gap-2 text-xs ${obrigatoriosPendentes.length === 0 ? "text-emerald-600" : "text-red-500"}`}>
              <span>{obrigatoriosPendentes.length === 0 ? "✓" : "✗"}</span>
              Checklist {obrigatoriosPendentes.length > 0 ? `(${obrigatoriosPendentes.length} pendente(s))` : "completo"}
            </div>
            <div className={`flex items-center gap-2 text-xs ${temFotoOperador ? "text-emerald-600" : "text-red-500"}`}>
              <span>{temFotoOperador ? "✓" : "✗"}</span>
              Fotografia do pedido embalado
            </div>
            <div className={`flex items-center gap-2 text-xs ${temPesoOperador ? "text-emerald-600" : "text-red-500"}`}>
              <span>{temPesoOperador ? "✓" : "✗"}</span>
              Peso (kg) preenchido
            </div>
            <div className={`flex items-center gap-2 text-xs ${temMedidasOperador ? "text-emerald-600" : "text-red-500"}`}>
              <span>{temMedidasOperador ? "✓" : "✗"}</span>
              Medidas A × L × P preenchidas
            </div>
          </div>
        )}
        <button
          disabled={!podeFinalizar}
          onClick={() => setConfirmandoFinalizar(true)}
          className="w-full py-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
        >
          <PackageCheck className="w-7 h-7" /> FINALIZAR — MOVER PARA PÁTIO
        </button>
      </div>

      {/* Confirmação de finalização */}
      <Dialog open={confirmandoFinalizar} onOpenChange={setConfirmandoFinalizar}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Confirmar Finalização</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <PackageCheck className="w-20 h-20 text-emerald-500 mx-auto mb-3" />
            <p className="text-gray-600 text-lg">A caixa está pronta e embalada?</p>

          </div>
          <DialogFooter className="flex gap-3">
            <Button variant="outline" onClick={() => setConfirmandoFinalizar(false)} className="flex-1 py-4">Não, voltar</Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-lg py-6"
              onClick={() => { onFinalizar(); setConfirmandoFinalizar(false); }}
            >
              SIM, FINALIZAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── DASHBOARD DE EMPACOTAMENTO ───────────────────────────────────────────────
function DashboardEmpacotamentoView() {
  const [periodo, setPeriodo] = useState<"hoje" | "semana" | "mes" | "90d">("mes");
  const [abaRelatorio, setAbaRelatorio] = useState<"colaboradores" | "pedidos" | "evolucao" | "ranking" | "registros" | "previsto">("colaboradores");
  const [filtroRegistros, setFiltroRegistros] = useState<"semana" | "mes" | "tudo">("semana");
  const [filtroPrevisto, setFiltroPrevisto] = useState<"semana" | "mes" | "tudo">("semana");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "letreiro" | "caixa">("todos");
  const [metaHorasDia, setMetaHorasDia] = useState<number>(8);
  const [editandoMeta, setEditandoMeta] = useState(false);

  const getDataInicio = (p: typeof periodo) => {
    const d = new Date();
    if (p === "hoje") { d.setHours(0, 0, 0, 0); }
    else if (p === "semana") { d.setDate(d.getDate() - 7); }
    else if (p === "mes") { d.setDate(1); d.setHours(0, 0, 0, 0); }
    else { d.setDate(d.getDate() - 90); }
    return d.toISOString();
  };

  const dataInicio = useMemo(() => getDataInicio(periodo), [periodo]);

  const { data: relatorio } = trpc.empacotamento.relatorioProdutividade.porColaborador.useQuery({
    dataInicio,
    dataFim: new Date().toISOString(),
  });
  const { data: relatorioDetalhado } = trpc.empacotamento.relatorioDetalhado.porPeriodo.useQuery({
    dataInicio,
    dataFim: new Date().toISOString(),
  });
  const [filtroRanking, setFiltroRanking] = useState<"semanal" | "mensal">("semanal");
  const [filtroEvolucaoTipo, setFiltroEvolucaoTipo] = useState<"todos" | "letreiro" | "caixa">("todos");
  const evolucaoInicio = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (periodo === "hoje" ? 1 : periodo === "semana" ? 7 : periodo === "mes" ? 30 : 90));
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [periodo]);
  const { data: evolucaoDiaria } = trpc.empacotamento.evolucaoDiaria.porPeriodo.useQuery({
    dataInicio: evolucaoInicio,
    dataFim: new Date().toISOString(),
    tipoProduto: filtroEvolucaoTipo,
  });
  const { data: rankingSemanal, refetch: refetchRankingSemanal } = trpc.empacotamento.rankingProdutividade.semanal.useQuery({ semanas: 1 });
  const { data: rankingMensal, refetch: refetchRankingMensal } = trpc.empacotamento.rankingProdutividade.mensal.useQuery({ meses: 1 });
  const deletarSessoesZeroMutation = trpc.empacotamento.sessoes.deletarSessoesZero.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deletados} sessão(es) com tempo zero removidas do ranking.`);
      refetchRankingSemanal(); refetchRankingMensal();
    },
    onError: () => toast.error('Erro ao limpar sessões com tempo zero.'),
  });
  const { data: registrosTempo = [] } = trpc.empacotamento.registrosTempo.list.useQuery({ periodo: filtroRegistros });
  const { data: previstoVsRealizado = [] } = trpc.empacotamento.previstoVsRealizado.list.useQuery({ periodo: filtroPrevisto });
  const { data: todos = [] } = trpc.empacotamento.pedidos.list.useQuery({ kanbanStatus: "todos" });

  const pedidosPatio = (todos as Pedido[]).filter(p => p.kanbanStatus === "patio");
  const pedidosEmbalando = (todos as Pedido[]).filter(p => p.kanbanStatus === "embalando");
  const pedidosAguardando = (todos as Pedido[]).filter(p => p.kanbanStatus === "aguardando");

  const agora = new Date();
  const pedidosNoPrazo = pedidosPatio.filter(p => !p.prazoEntrega || new Date(p.prazoEntrega) >= agora).length;
  const pedidosForaPrazo = pedidosPatio.filter(p => p.prazoEntrega && new Date(p.prazoEntrega) < agora).length;

  const periodoLabel = { hoje: "Hoje", semana: "7 dias", mes: "Este mês", "90d": "90 dias" };

  return (
    <div className="space-y-5">
      {/* Cabeçalho com filtro de período */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">Dashboard de Produtividade</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["hoje", "semana", "mes", "90d"] as const).map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${periodo === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {periodoLabel[p]}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs de status atual */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-3xl font-black text-orange-500">{pedidosAguardando.length}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Aguardando</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-3xl font-black text-blue-600">{pedidosEmbalando.length}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Em Embalagem</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-3xl font-black text-emerald-600">{pedidosNoPrazo}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">No Prazo (Pátio)</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-3xl font-black text-red-500">{pedidosForaPrazo}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Fora do Prazo</p>
        </div>
      </div>

      {/* KPIs do período selecionado */}
      {relatorioDetalhado && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-indigo-700">{relatorioDetalhado.totais.totalPedidos}</p>
            <p className="text-xs text-indigo-600 mt-1 font-medium">Pedidos Finalizados</p>
            <p className="text-xs text-indigo-400 mt-0.5">{periodoLabel[periodo]}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-blue-700">{(relatorioDetalhado.totais.totalRealMin / 60).toFixed(1)}h</p>
            <p className="text-xs text-blue-600 mt-1 font-medium">Horas Trabalhadas</p>
            <p className="text-xs text-blue-400 mt-0.5">{relatorioDetalhado.totais.totalRealMin.toFixed(0)} min</p>
          </div>
          <div className={`rounded-2xl p-4 text-center border ${
            (relatorioDetalhado.totais.eficienciaGeral ?? 0) >= 100
              ? "bg-emerald-50 border-emerald-200"
              : (relatorioDetalhado.totais.eficienciaGeral ?? 0) >= 80
              ? "bg-amber-50 border-amber-200"
              : "bg-red-50 border-red-200"
          }`}>
            <p className={`text-2xl font-black ${
              (relatorioDetalhado.totais.eficienciaGeral ?? 0) >= 100 ? "text-emerald-700"
              : (relatorioDetalhado.totais.eficienciaGeral ?? 0) >= 80 ? "text-amber-700"
              : "text-red-700"
            }`}>
              {relatorioDetalhado.totais.eficienciaGeral != null ? `${relatorioDetalhado.totais.eficienciaGeral}%` : "—"}
            </p>
            <p className="text-xs text-gray-600 mt-1 font-medium">Eficiência Geral</p>
            <p className="text-xs text-gray-400 mt-0.5">Previsto/Real</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-emerald-700">R$ {relatorioDetalhado.totais.totalValor.toFixed(2)}</p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">Valor Produtividade</p>
            <p className="text-xs text-emerald-400 mt-0.5">R$ {relatorioDetalhado.valorPorMinuto.toFixed(4)}/min</p>
          </div>
        </div>
      )}

      {/* Taxa de cumprimento de prazo */}
      {(pedidosNoPrazo + pedidosForaPrazo) > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-gray-700">Taxa de Cumprimento de Prazo</p>
            <p className="font-black text-lg text-emerald-600">
              {Math.round((pedidosNoPrazo / (pedidosNoPrazo + pedidosForaPrazo)) * 100)}%
            </p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className="h-3 rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round((pedidosNoPrazo / (pedidosNoPrazo + pedidosForaPrazo)) * 100)}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{pedidosNoPrazo} no prazo</span>
            <span>{pedidosForaPrazo} fora do prazo</span>
          </div>
        </div>
      )}

      {/* Abas: Por Colaborador / Por Pedido */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setAbaRelatorio("colaboradores")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            abaRelatorio === "colaboradores" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}>
          Por Colaborador
        </button>
        <button onClick={() => setAbaRelatorio("pedidos")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            abaRelatorio === "pedidos" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}>
          Previsto vs Real
        </button>
        <button onClick={() => setAbaRelatorio("evolucao")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            abaRelatorio === "evolucao" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}>
          Evolucao
        </button>
        <button onClick={() => setAbaRelatorio("ranking")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            abaRelatorio === "ranking" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}>
          Ranking
        </button>
        <button onClick={() => setAbaRelatorio("registros")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            abaRelatorio === "registros" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}>
          Registros de Tempo
        </button>
        <button onClick={() => setAbaRelatorio("previsto")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            abaRelatorio === "previsto" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}>
          Previsto vs Realizado
        </button>
      </div>

      {/* ABA: Por Colaborador */}
      {abaRelatorio === "colaboradores" && (
        <>
          {/* Painel de Metas */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-indigo-800 flex items-center gap-2">
                🎯 Meta de Produtividade
              </h3>
              <button onClick={() => setEditandoMeta(!editandoMeta)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline">
                {editandoMeta ? "Fechar" : "Editar meta"}
              </button>
            </div>
            {editandoMeta && (
              <div className="mb-3 flex items-center gap-2">
                <label className="text-xs text-indigo-700 font-medium">Meta diária por operador:</label>
                <input
                  type="number" min={1} max={24} value={metaHorasDia}
                  onChange={e => setMetaHorasDia(Number(e.target.value))}
                  className="w-16 text-center border border-indigo-300 rounded-lg px-2 py-1 text-sm font-bold text-indigo-800 bg-white"
                />
                <span className="text-xs text-indigo-600">horas/dia</span>
              </div>
            )}
            {relatorio && relatorio.colaboradores.length > 0 && (() => {
              const diasNoPeriodo = periodo === "hoje" ? 1 : periodo === "semana" ? 7 : periodo === "mes" ? 30 : 90;
              return (
                <div className="space-y-2">
                  {relatorio.colaboradores.map(col => {
                    const horasEfetivas = col.totalMinutosEfetivos / 60;
                    const metaTotal = metaHorasDia * diasNoPeriodo;
                    const pctMeta = Math.min(100, (horasEfetivas / metaTotal) * 100);
                    const atingiu = horasEfetivas >= metaTotal;
                    return (
                      <div key={col.nome}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-indigo-800">{col.nome}</span>
                          <span className={`text-xs font-bold ${atingiu ? "text-emerald-700" : "text-amber-600"}`}>
                            {horasEfetivas.toFixed(1)}h / {metaTotal}h {atingiu ? "✓" : `(${pctMeta.toFixed(0)}%)`}
                          </span>
                        </div>
                        <div className="w-full bg-indigo-100 rounded-full h-2.5">
                          <div className={`h-2.5 rounded-full transition-all ${atingiu ? "bg-emerald-500" : pctMeta >= 75 ? "bg-amber-400" : "bg-red-400"}`}
                            style={{ width: `${pctMeta}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {(!relatorio || relatorio.colaboradores.length === 0) && (
              <p className="text-xs text-indigo-400 text-center py-2">Sem dados no período para exibir progresso de metas.</p>
            )}
          </div>
          {relatorio && relatorio.colaboradores.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" /> Produtividade por Colaborador
              </h3>
              <div className="space-y-4">
                {relatorio.colaboradores
                  .sort((a, b) => b.totalMinutosEfetivos - a.totalMinutosEfetivos)
                  .map((col, idx) => {
                    const horasEfetivas = col.totalMinutosEfetivos / 60;
                    const maxHoras = Math.max(...relatorio.colaboradores.map(c => c.totalMinutosEfetivos / 60));
                    const pct = maxHoras > 0 ? (horasEfetivas / maxHoras) * 100 : 0;
                    return (
                      <div key={col.nome}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                              idx === 0 ? "bg-yellow-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-amber-600" : "bg-gray-300"
                            }`}>{idx + 1}</div>
                            <p className="font-semibold text-sm text-gray-800">{col.nome}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-emerald-700 text-sm">R$ {col.valorComBonus.toFixed(2)}</p>
                            <p className="text-xs text-gray-400">{horasEfetivas.toFixed(1)}h efetivas · {col.totalPedidos} pedidos</p>
                          </div>
                        </div>
                        {/* Barra de horas */}
                        <div className="w-full bg-gray-100 rounded-full h-2.5 mb-1">
                          <div className="h-2.5 rounded-full bg-indigo-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>{col.pedidosNoPrazo} no prazo · {col.pedidosForaDoPrazo} atrasados</span>
                          <span>{col.totalMinutosEfetivos.toFixed(0)} min</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
              {/* Total */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Total do período</p>
                  <p className="text-xs text-gray-400">{relatorio.colaboradores.reduce((a, c) => a + c.totalPedidos, 0)} pedidos · {(relatorio.colaboradores.reduce((a, c) => a + c.totalMinutosEfetivos, 0) / 60).toFixed(1)}h trabalhadas</p>
                </div>
                <p className="text-2xl font-black text-emerald-700">
                  R$ {relatorio.colaboradores.reduce((a, c) => a + c.valorComBonus, 0).toFixed(2)}
                </p>
              </div>
              {/* Export CSV colaboradores */}
              <button
                onClick={() => {
                  const header = "Colaborador,Horas Efetivas,Pedidos,No Prazo,Atrasados,Valor Base R$,Valor com Bônus R$";
                  const rows = relatorio.colaboradores.map(c => [
                    `"${c.nome}"`,
                    (c.totalMinutosEfetivos / 60).toFixed(2),
                    c.totalPedidos,
                    c.pedidosNoPrazo,
                    c.pedidosForaDoPrazo,
                    c.valorBase.toFixed(2),
                    c.valorComBonus.toFixed(2),
                  ].join(','));
                  const csv = [header, ...rows].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `colaboradores_${periodo}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 bg-gray-50 border border-gray-200 text-gray-600 rounded-xl text-xs font-medium hover:bg-gray-100 transition-colors"
              >
                ↓ Exportar CSV de Colaboradores
              </button>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p>Nenhum dado de produtividade no período selecionado.</p>
            </div>
          )}
        </>
      )}

      {/* ABA: Previsto vs Real por Pedido */}
      {abaRelatorio === "pedidos" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <Timer className="w-4 h-4" /> Tempo Previsto vs Real por Pedido
              </h3>
              {/* Export CSV */}
              {relatorioDetalhado && relatorioDetalhado.pedidos.length > 0 && (
                <button
                  onClick={() => {
                    const pedidosFiltrados = relatorioDetalhado.pedidos.filter(p => {
                      if (filtroTipo === "letreiro") return !!p.modeloNome;
                      if (filtroTipo === "caixa") return !!p.modeloCaixaNome;
                      return true;
                    });
                    const header = "Pedido,Cliente,Modelo Letreiro,Modelo Caixa,Estimado (min),Real (min),Eficiência (%),Fator Produtividade,Valor R$,Operadores,Finalizado Em";
                    const rows = pedidosFiltrados.map(p => {
                      const fator = p.tempoEstimadoMin > 0 && p.tempoRealMin > 0
                        ? (() => {
                            const v = (p.tempoRealMin - p.tempoEstimadoMin) / p.tempoEstimadoMin;
                            const passos = Math.floor(Math.abs(v) / 0.05);
                            const aj = passos * 0.05;
                            return v > 0 ? Math.max(0.5, 1.0 - aj) : Math.min(1.5, 1.0 + aj);
                          })()
                        : 1.0;
                      return [
                        p.numeroPedido,
                        `"${p.cliente}"`,
                        `"${p.modeloNome ?? ''}"`,
                        `"${p.modeloCaixaNome ?? ''}"`,
                        p.tempoEstimadoMin.toFixed(1),
                        p.tempoRealMin.toFixed(1),
                        p.eficiencia ?? '',
                        fator.toFixed(2),
                        p.valorProdutividade.toFixed(2),
                        `"${p.operadores.join(', ')}"`,
                        p.finalizadoEm ? new Date(p.finalizadoEm).toLocaleString('pt-BR') : '',
                      ].join(',');
                    });
                    const csv = [header, ...rows].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `produtividade_${periodo}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors"
                >
                  ↓ Exportar CSV
                </button>
              )}
            </div>
            {/* Filtro por tipo de produto */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 font-medium">Filtrar por tipo:</span>
              {(["todos", "letreiro", "caixa"] as const).map(tipo => (
                <button key={tipo} onClick={() => setFiltroTipo(tipo)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                    filtroTipo === tipo
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300"
                  }`}>
                  {tipo === "todos" ? "Todos" : tipo === "letreiro" ? "Letreiros" : "Caixas"}
                </button>
              ))}
              {relatorioDetalhado && relatorioDetalhado.totais.totalPedidos > 0 && (
                <span className="text-xs text-gray-400 ml-auto">
                  {relatorioDetalhado.pedidos.filter(p => {
                    if (filtroTipo === "letreiro") return !!p.modeloNome;
                    if (filtroTipo === "caixa") return !!p.modeloCaixaNome;
                    return true;
                  }).length} pedidos · Estimado: {relatorioDetalhado.totais.totalEstimadoMin.toFixed(0)} min · Real: {relatorioDetalhado.totais.totalRealMin.toFixed(0)} min
                </span>
              )}
            </div>
          </div>
          {relatorioDetalhado && relatorioDetalhado.pedidos.filter(p => {
            if (filtroTipo === "letreiro") return !!p.modeloNome;
            if (filtroTipo === "caixa") return !!p.modeloCaixaNome;
            return true;
          }).length > 0 ? (
            <div className="divide-y divide-gray-50">
              {relatorioDetalhado.pedidos.filter(p => {
                if (filtroTipo === "letreiro") return !!p.modeloNome;
                if (filtroTipo === "caixa") return !!p.modeloCaixaNome;
                return true;
              }).map(p => {
                const temEst = p.tempoEstimadoMin > 0;
                const temReal = p.tempoRealMin > 0;
                const maxMin = Math.max(p.tempoEstimadoMin, p.tempoRealMin, 1);
                const pctEst = temEst ? Math.min(100, (p.tempoEstimadoMin / maxMin) * 100) : 0;
                const pctReal = temReal ? Math.min(100, (p.tempoRealMin / maxMin) * 100) : 0;
                const atrasado = p.noPrazo === false;
                return (
                  <div key={p.id} className="px-4 py-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900">#{p.numeroPedido}</span>
                          {p.noPrazo === true && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">✓ No prazo</span>}
                          {p.noPrazo === false && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">⚠ Atrasado</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{p.cliente} · {p.operadores.join(", ") || "Sem operador"}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-xs font-semibold text-emerald-700">R$ {p.valorProdutividade.toFixed(2)}</p>
                        {p.eficiencia != null && (
                          <p className={`text-xs font-bold ${
                            p.eficiencia >= 100 ? "text-emerald-600" : p.eficiencia >= 80 ? "text-amber-600" : "text-red-500"
                          }`}>{p.eficiencia}% efic.</p>
                        )}
                      </div>
                    </div>
                    {/* Barras comparativas */}
                    {(temEst || temReal) && (
                      <div className="space-y-1">
                        {temEst && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-16 shrink-0">Previsto</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div className="h-2 rounded-full bg-indigo-300" style={{ width: `${pctEst}%` }} />
                            </div>
                            <span className="text-xs text-indigo-600 font-medium w-14 text-right shrink-0">{p.tempoEstimadoMin.toFixed(0)} min</span>
                          </div>
                        )}
                        {temReal && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-16 shrink-0">Real</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div className={`h-2 rounded-full ${
                                !temEst ? "bg-gray-400" : p.tempoRealMin <= p.tempoEstimadoMin ? "bg-emerald-400" : "bg-red-400"
                              }`} style={{ width: `${pctReal}%` }} />
                            </div>
                            <span className={`text-xs font-medium w-14 text-right shrink-0 ${
                              !temEst ? "text-gray-600" : p.tempoRealMin <= p.tempoEstimadoMin ? "text-emerald-600" : "text-red-500"
                            }`}>{p.tempoRealMin.toFixed(0)} min</span>
                          </div>
                        )}
                      </div>
                    )}
                    {!temEst && !temReal && (
                      <p className="text-xs text-gray-300">Sem dados de tempo</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Timer className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p>Nenhum pedido finalizado no período selecionado.</p>
              <p className="text-xs mt-1">Configure o tempo estimado nos modelos de caixa e letreiro para ver a comparação.</p>
            </div>
          )}
        </div>
      )}
      {/* ABA: Evolucao Diaria */}
      {abaRelatorio === "evolucao" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                Evolucao Diaria de Eficiencia
              </h3>
              <div className="flex gap-1">
                {(["todos", "letreiro", "caixa"] as const).map(tipo => (
                  <button key={tipo} onClick={() => setFiltroEvolucaoTipo(tipo)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-all border ${
                      filtroEvolucaoTipo === tipo ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300"
                    }`}>
                    {tipo === "todos" ? "Todos" : tipo === "letreiro" ? "Letreiros" : "Caixas"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {evolucaoDiaria && evolucaoDiaria.length > 0 ? (
            <div className="p-4 space-y-3">
              <div className="space-y-2">
                {evolucaoDiaria.map((dia) => {
                  const efic = dia.eficienciaMedia ?? 0;
                  const barWidth = Math.min(100, efic);
                  const barColor = efic >= 100 ? "bg-emerald-500" : efic >= 80 ? "bg-amber-400" : efic >= 70 ? "bg-orange-400" : "bg-red-400";
                  const textColor = efic >= 100 ? "text-emerald-700" : efic >= 80 ? "text-amber-700" : efic >= 70 ? "text-orange-700" : "text-red-600";
                  return (
                    <div key={dia.data} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-20 shrink-0 text-right">
                        {new Date(dia.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                        <div className={`h-5 rounded-full transition-all ${barColor}`} style={{ width: `${barWidth}%` }} />
                        {dia.eficienciaMedia != null && (
                          <span className="absolute inset-0 flex items-center px-2 text-xs font-bold text-white mix-blend-difference">
                            {efic}%
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0 w-20">
                        <span className={`text-xs font-bold ${textColor}`}>{dia.eficienciaMedia != null ? `${efic}%` : "---"}</span>
                        <span className="text-xs text-gray-400 ml-1">x {dia.totalPedidos}p</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-700 font-medium">
                  Meta minima: 70% de eficiencia. Dias abaixo de 70% aparecem em vermelho/laranja.
                </p>
                {(() => {
                  const diasAbaixo = evolucaoDiaria.filter(d => d.eficienciaMedia != null && d.eficienciaMedia < 70);
                  return diasAbaixo.length >= 3 ? (
                    <p className="text-xs text-red-700 font-bold mt-1">
                      ALERTA: {diasAbaixo.length} dias com eficiencia abaixo de 70% no periodo!
                    </p>
                  ) : null;
                })()}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p>Nenhum dado de evolucao no periodo selecionado.</p>
              <p className="text-xs mt-1">Finalize pedidos com tempo registrado para ver a evolucao diaria.</p>
            </div>
          )}
        </div>
      )}
      {/* ABA: Ranking de Produtividade */}
      {abaRelatorio === "ranking" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                Ranking de Produtividade
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { if (confirm('Apagar sessões com tempo zero do banco? Isso remove registros falsos do ranking.')) deletarSessoesZeroMutation.mutate(); }}
                  disabled={deletarSessoesZeroMutation.isPending}
                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg px-2 py-1 transition-colors disabled:opacity-50"
                  title="Remove sessões finalizadas com tempo zero (registros falsos)">
                  🗑️ Limpar zeros
                </button>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button onClick={() => setFiltroRanking("semanal")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${filtroRanking === "semanal" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  Esta semana
                </button>
                <button onClick={() => setFiltroRanking("mensal")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${filtroRanking === "mensal" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  Este mes
                </button>
                </div>
              </div>
            </div>
          </div>
          {(() => {
            const ranking = filtroRanking === "semanal" ? rankingSemanal : rankingMensal;
            if (!ranking || ranking.length === 0) {
              return (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  <p>Nenhum dado de ranking no periodo selecionado.</p>
                  <p className="text-xs mt-1">Os operadores precisam ter pedidos finalizados com cronometro ativo.</p>
                </div>
              );
            }
            const medalhas = ["1o", "2o", "3o"];
            return (
              <div className="divide-y divide-gray-50">
                {ranking.map((op, idx) => (
                  <div key={op.nome} className={`px-4 py-3 flex items-center gap-3 ${idx === 0 ? "bg-amber-50" : idx === 1 ? "bg-gray-50" : idx === 2 ? "bg-orange-50" : ""}`}>
                    <span className="text-lg font-bold w-8 text-center shrink-0 text-gray-700">{medalhas[idx] ?? `${idx + 1}o`}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{op.nome}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-500">{(op.totalMinutos / 60).toFixed(1)}h trabalhadas</span>
                        <span className="text-xs text-gray-500">{op.totalPedidos} pedidos</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {op.eficienciaMedia != null && (
                        <p className={`text-lg font-black ${op.eficienciaMedia >= 100 ? "text-emerald-600" : op.eficienciaMedia >= 80 ? "text-amber-600" : "text-red-500"}`}>
                          {op.eficienciaMedia}%
                        </p>
                      )}
                      <p className="text-xs text-emerald-600 font-semibold">R$ {op.valorTotal.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ABA: Registros de Tempo por Pedido */}
      {abaRelatorio === "registros" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">📋 Registros de Tempo por Pedido</h3>
              <div className="flex items-center gap-2">
                {registrosTempo.length > 0 && (
                  <button
                    onClick={() => {
                      const rows = registrosTempo.flatMap(reg =>
                        reg.colaboradores.map(col => ({
                          pedido: reg.pedidoCodigo,
                          colaborador: col.nome,
                          tempo_min: (col.tempoSegundos / 60).toFixed(1),
                          valor_R$: col.valorProdutividade.toFixed(2),
                          registrado_em: reg.registradoEm > 0 ? new Date(reg.registradoEm * 1000).toLocaleString('pt-BR') : '',
                        }))
                      );
                      const header = Object.keys(rows[0]).join(';');
                      const csv = [header, ...rows.map(r => Object.values(r).join(';'))].join('\n');
                      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = `produtividade-${new Date().toISOString().slice(0,10)}.csv`; a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs text-emerald-600 hover:text-emerald-800 border border-emerald-200 hover:border-emerald-400 rounded-lg px-2 py-1 transition-colors">
                    ⬇️ Exportar CSV
                  </button>
                )}
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {(["semana", "mes", "tudo"] as const).map(p => (
                  <button key={p} onClick={() => setFiltroRegistros(p)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${filtroRegistros === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    {p === "semana" ? "Esta semana" : p === "mes" ? "Este mês" : "Tudo"}
                  </button>
                ))}
                </div>
              </div>
            </div>
          </div>
          {registrosTempo.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">Nenhum registro de tempo no período selecionado.</p>
              <p className="text-xs mt-1">Os operadores precisam clicar em "Registrar" no temporizador.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {registrosTempo.map(reg => (
                <div key={reg.pedidoId} className="px-4 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-900 text-sm">Pedido #{reg.pedidoCodigo}</span>
                    <span className="text-xs text-gray-400">
                      {reg.registradoEm > 0 ? new Date(reg.registradoEm * 1000).toLocaleString('pt-BR') : ''}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {reg.colaboradores.map((col, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className="font-medium text-gray-700">{col.nome}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-gray-500 text-xs">
                            {Math.floor(col.tempoSegundos / 60)}min {col.tempoSegundos % 60}s
                          </span>
                          <span className="text-emerald-600 font-semibold text-xs">R$ {col.valorProdutividade.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500 px-1">
                    <span>Total: {Math.floor(reg.tempoTotalSegundos / 60)}min {reg.tempoTotalSegundos % 60}s</span>
                    <span className="text-emerald-600 font-semibold">
                      Total: R$ {reg.colaboradores.reduce((a, c) => a + c.valorProdutividade, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA: Previsto vs Realizado */}
      {abaRelatorio === "previsto" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">⏱ Previsto vs Realizado</h3>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {(["semana", "mes", "tudo"] as const).map(p => (
                  <button key={p} onClick={() => setFiltroPrevisto(p)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${filtroPrevisto === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    {p === "semana" ? "Esta semana" : p === "mes" ? "Este mês" : "Tudo"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {previstoVsRealizado.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">Nenhum dado no período selecionado.</p>
              <p className="text-xs mt-1">Configure o tempo estimado nos modelos de caixa/letreiro e registre sessões de empacotamento.</p>
            </div>
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <TableHead>Pedido</TableHead>
                    <TableHead className="text-right">Previsto</TableHead>
                    <TableHead className="text-right">Realizado</TableHead>
                    <TableHead className="text-right">Variação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previstoVsRealizado.map(row => {
                    const prevMin = row.tempoEstimadoSegundos > 0 ? `${Math.floor(row.tempoEstimadoSegundos / 60)}min` : '—';
                    const realMin = `${Math.floor(row.tempoRealizadoSegundos / 60)}min ${row.tempoRealizadoSegundos % 60}s`;
                    const variacao = row.variacaoPct;
                    const semPrevisto = row.tempoEstimadoSegundos === 0;
                    return (
                      <TableRow key={row.pedidoId}>
                        <TableCell className="font-semibold text-gray-900">#{row.pedidoCodigo}</TableCell>
                        <TableCell className="text-right text-gray-500">{prevMin}</TableCell>
                        <TableCell className="text-right text-gray-700 font-medium">{realMin}</TableCell>
                        <TableCell className="text-right">
                          {semPrevisto ? (
                            <span className="text-gray-400 text-xs">Sem meta</span>
                          ) : variacao !== null ? (
                            <span className={`font-bold ${variacao > 10 ? 'text-red-500' : variacao < -10 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {variacao > 0 ? '+' : ''}{variacao}%
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {semPrevisto ? (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Sem meta</span>
                          ) : variacao !== null && variacao > 10 ? (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Acima do previsto</span>
                          ) : variacao !== null && variacao < -10 ? (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Abaixo do previsto</span>
                          ) : (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Dentro do previsto</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs text-gray-400">
                          {row.registradoEm > 0 ? new Date(row.registradoEm * 1000).toLocaleDateString('pt-BR') : ''}
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
    </div>
  );
}
// ─── ARQUIVO DO SUPERVISOR COM ANOTAÇÃO (canvas sobre imagem do supervisor) ────
function ArquivoSupervisorComAnotacao({ url, pedidoId, onSaved }: { url: string; pedidoId: number; onSaved?: (novaUrl: string) => void }) {
  const [abrirEditor, setAbrirEditor] = useState(false);
  const [urlAtual, setUrlAtual] = useState(url);
  const salvarMutation = trpc.empacotamento.pedidos.atualizarArquivoPedidoAnotado.useMutation();

  const handleSalvar = async (base64: string) => {
    try {
      const result = await salvarMutation.mutateAsync({ pedidoId, base64 });
      setUrlAtual(result.url);
      onSaved?.(result.url);
      toast("Anotações salvas!");
      setAbrirEditor(false);
    } catch {
      toast("Erro ao salvar anotações");
    }
  };

  return (
    <>
      {/* Thumbnail clicável */}
      <div className="relative group cursor-pointer" onClick={() => setAbrirEditor(true)}>
        <img src={urlAtual} alt="arquivo" className="w-full rounded-xl border border-gray-200 hover:opacity-90 transition-opacity" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-all flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-full">
            <Edit2 className="w-4 h-4" /> Anotar na imagem
          </span>
        </div>
      </div>

      <Dialog open={abrirEditor} onOpenChange={setAbrirEditor}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4" /> Anotar no Arquivo do Supervisor
              <span className="text-xs text-gray-400 font-normal ml-2">Use o dedo ou caneta do tablet para marcar</span>
            </DialogTitle>
          </DialogHeader>
          <CanvasAnnotatorArquivo
            imageUrl={urlAtual}
            onClose={() => setAbrirEditor(false)}
            onSaved={handleSalvar}
            salvando={salvarMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Canvas de anotação para o arquivo do supervisor (sem fotoId, salva via pedidoId)
function CanvasAnnotatorArquivo({ imageUrl, onClose, onSaved, salvando }: { imageUrl: string; onClose: () => void; onSaved: (base64: string) => void; salvando: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [desenhando, setDesenhando] = useState(false);
  const [cor, setCor] = useState("#22c55e");
  const [espessura, setEspessura] = useState(4);
  const [ferramenta, setFerramenta] = useState<"caneta" | "check" | "borracha">("caneta");
  const ultimoPonto = useRef<{ x: number; y: number } | null>(null);
  const [imgCarregada, setImgCarregada] = useState(false);

  // Sincronizar canvas com dimensões reais da imagem
  const handleImgLoad = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    canvas.width = img.naturalWidth || img.offsetWidth || 800;
    canvas.height = img.naturalHeight || img.offsetHeight || 600;
    setImgCarregada(true);
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const iniciarDesenho = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDesenhando(true);
    const pos = getPos(e);
    ultimoPonto.current = pos;
    if (ferramenta === "check") {
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.strokeStyle = cor; ctx.lineWidth = espessura; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(pos.x - 12, pos.y); ctx.lineTo(pos.x - 4, pos.y + 10); ctx.lineTo(pos.x + 14, pos.y - 12); ctx.stroke();
    }
  };

  const desenhar = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!desenhando || ferramenta === "check") return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.strokeStyle = ferramenta === "borracha" ? "rgba(0,0,0,0)" : cor;
    ctx.lineWidth = ferramenta === "borracha" ? espessura * 5 : espessura;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalCompositeOperation = ferramenta === "borracha" ? "destination-out" : "source-over";
    ctx.beginPath(); ctx.moveTo(ultimoPonto.current!.x, ultimoPonto.current!.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    ultimoPonto.current = pos;
  };

  const pararDesenho = () => { setDesenhando(false); ultimoPonto.current = null; };
  const limpar = () => { const ctx = canvasRef.current!.getContext("2d")!; ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); };

  const handleSalvar = async () => {
    const img = imgRef.current!;
    const canvas = canvasRef.current!;
    const combined = document.createElement("canvas");
    combined.width = img.naturalWidth || 800;
    combined.height = img.naturalHeight || 600;
    const ctx = combined.getContext("2d")!;
    // Use fetch to load image as blob to avoid tainted canvas issues
    try {
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        const tempImg = new Image();
        tempImg.onload = () => { ctx.drawImage(tempImg, 0, 0, combined.width, combined.height); URL.revokeObjectURL(blobUrl); resolve(); };
        tempImg.onerror = reject;
        tempImg.src = blobUrl;
      });
    } catch {
      ctx.drawImage(img, 0, 0, combined.width, combined.height);
    }
    ctx.drawImage(canvas, 0, 0, combined.width, combined.height);
    const base64 = combined.toDataURL("image/png").split(",")[1];
    onSaved(base64);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 flex-wrap">
        <div className="flex gap-1">
          {(["caneta", "check", "borracha"] as const).map(f => (
            <button key={f} onClick={() => setFerramenta(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${ferramenta === f ? "bg-emerald-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {f === "caneta" ? "✏️ Caneta" : f === "check" ? "✅ Check" : "🧹 Borracha"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          {["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#000000"].map(c => (
            <button key={c} onClick={() => setCor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${cor === c ? "border-gray-800 scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-xs text-gray-500">Esp:</span>
          {[2, 4, 8].map(e => (
            <button key={e} onClick={() => setEspessura(e)}
              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${espessura === e ? "bg-gray-800 border-gray-800" : "bg-white border-gray-200"}`}>
              <div className="rounded-full" style={{ width: e, height: e, backgroundColor: espessura === e ? "white" : "#374151" }} />
            </button>
          ))}
        </div>
        <button onClick={limpar} className="ml-auto text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50">Limpar</button>
      </div>
      <div className="relative select-none touch-none" style={{ maxHeight: "60vh", overflow: "auto" }}>
        <img ref={imgRef} src={imageUrl} alt="arquivo" className="w-full block" draggable={false} onLoad={handleImgLoad} />
        <canvas ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ touchAction: "none", display: imgCarregada ? "block" : "none" }}
          onMouseDown={iniciarDesenho} onMouseMove={desenhar} onMouseUp={pararDesenho} onMouseLeave={pararDesenho}
          onTouchStart={iniciarDesenho} onTouchMove={desenhar} onTouchEnd={pararDesenho}
        />
      </div>
      <div className="px-4 py-3 flex justify-end gap-2 border-t border-gray-100">
        <Button variant="outline" onClick={onClose}>Fechar</Button>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSalvar} disabled={salvando || !imgCarregada}>
          {salvando ? "Salvando..." : "Salvar Anotações"}
        </Button>
      </div>
    </div>
  );
}

// ─── FOTO COM ANOTAÇÃO (canvas sobre imagem, caneta do tablet) ───────────────
function FotoComAnotacao({ url, fotoId, onSaved }: { url: string; fotoId: number; onSaved?: (novaUrl: string) => void }) {
  const [abrirEditor, setAbrirEditor] = useState(false);
  const [urlAtual, setUrlAtual] = useState(url);

  return (
    <>
      <div className="relative group cursor-pointer" onClick={() => setAbrirEditor(true)}>
        <img src={urlAtual} alt="foto" className="w-full h-20 object-cover rounded-lg border hover:opacity-90" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-all flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full">
            <Edit2 className="w-3 h-3" /> Anotar
          </span>
        </div>
      </div>

      <Dialog open={abrirEditor} onOpenChange={setAbrirEditor}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4" /> Anotar na Foto
              <span className="text-xs text-gray-400 font-normal ml-2">Use o dedo ou caneta do tablet para marcar letras conferidas</span>
            </DialogTitle>
          </DialogHeader>
          <CanvasAnnotator
            imageUrl={urlAtual}
            fotoId={fotoId}
            onClose={() => setAbrirEditor(false)}
            onSaved={(novaUrl) => {
              setUrlAtual(novaUrl);
              onSaved?.(novaUrl);
              setAbrirEditor(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Canvas de anotação sobre imagem
function CanvasAnnotator({ imageUrl, fotoId, onClose, onSaved }: { imageUrl: string; fotoId?: number; onClose: () => void; onSaved?: (novaUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [desenhando, setDesenhando] = useState(false);
  const [cor, setCor] = useState("#22c55e");
  const [espessura, setEspessura] = useState(4);
  const [ferramenta, setFerramenta] = useState<"caneta" | "check" | "borracha">("caneta");
  const ultimoPonto = useRef<{ x: number; y: number } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [imgCarregada, setImgCarregada] = useState(false);
  const salvarNoBanco = trpc.empacotamento.pedidos.atualizarFotoAnotada.useMutation();

  // Sincronizar canvas com dimensões reais da imagem após carregar
  const handleImgLoad = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    canvas.width = img.naturalWidth || img.offsetWidth || 800;
    canvas.height = img.naturalHeight || img.offsetHeight || 600;
    setImgCarregada(true);
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const iniciarDesenho = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDesenhando(true);
    const pos = getPos(e);
    ultimoPonto.current = pos;
    if (ferramenta === "check") {
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.strokeStyle = cor; ctx.lineWidth = espessura; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(pos.x - 12, pos.y); ctx.lineTo(pos.x - 4, pos.y + 10); ctx.lineTo(pos.x + 14, pos.y - 12); ctx.stroke();
    }
  };

  const desenhar = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!desenhando || ferramenta === "check") return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.strokeStyle = ferramenta === "borracha" ? "rgba(0,0,0,0)" : cor;
    ctx.lineWidth = ferramenta === "borracha" ? espessura * 5 : espessura;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalCompositeOperation = ferramenta === "borracha" ? "destination-out" : "source-over";
    ctx.beginPath(); ctx.moveTo(ultimoPonto.current!.x, ultimoPonto.current!.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    ultimoPonto.current = pos;
  };

  const pararDesenho = () => { setDesenhando(false); ultimoPonto.current = null; };
  const limpar = () => { const ctx = canvasRef.current!.getContext("2d")!; ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); };

  const getCombinedCanvas = async (): Promise<HTMLCanvasElement> => {
    const canvas = canvasRef.current!;
    const img = imgRef.current!;
    const combined = document.createElement("canvas");
    combined.width = img.naturalWidth || 800;
    combined.height = img.naturalHeight || 600;
    const ctx = combined.getContext("2d")!;
    // Use fetch to load image as blob to avoid tainted canvas issues
    try {
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        const tempImg = new Image();
        tempImg.onload = () => { ctx.drawImage(tempImg, 0, 0, combined.width, combined.height); URL.revokeObjectURL(blobUrl); resolve(); };
        tempImg.onerror = reject;
        tempImg.src = blobUrl;
      });
    } catch {
      ctx.drawImage(img, 0, 0, combined.width, combined.height);
    }
    ctx.drawImage(canvas, 0, 0, combined.width, combined.height);
    return combined;
  };

  const salvarImagem = async () => {
    const combined = await getCombinedCanvas();
    combined.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "foto-anotada.png"; a.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleSalvarNoBanco = async () => {
    setSalvando(true);
    try {
      const combined = await getCombinedCanvas();
      const base64 = combined.toDataURL("image/png").split(",")[1];
      if (fotoId) {
        const result = await salvarNoBanco.mutateAsync({ fotoId, base64 });
        toast("Anotações salvas!");
        onSaved?.(result.url);
      } else {
        // Sem fotoId: apenas fechar e notificar com base64 (para uso externo)
        toast("Anotações aplicadas!");
        onSaved?.("data:image/png;base64," + base64);
      }
      onClose();
    } catch {
      toast("Erro ao salvar anotações");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 flex-wrap">
        <div className="flex gap-1">
          {(["caneta", "check", "borracha"] as const).map(f => (
            <button key={f} onClick={() => setFerramenta(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${ferramenta === f ? "bg-emerald-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {f === "caneta" ? "✏️ Caneta" : f === "check" ? "✅ Check" : "🧹 Borracha"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          {["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#000000"].map(c => (
            <button key={c} onClick={() => setCor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${cor === c ? "border-gray-800 scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-xs text-gray-500">Esp:</span>
          {[2, 4, 8].map(e => (
            <button key={e} onClick={() => setEspessura(e)}
              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${espessura === e ? "bg-gray-800 border-gray-800" : "bg-white border-gray-200"}`}>
              <div className="rounded-full" style={{ width: e, height: e, backgroundColor: espessura === e ? "white" : "#374151" }} />
            </button>
          ))}
        </div>
        <button onClick={limpar} className="ml-auto text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50">Limpar</button>
        <button onClick={salvarImagem} className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50">Baixar</button>
      </div>

      {/* Canvas sobre a imagem */}
      <div className="relative select-none touch-none" style={{ maxHeight: "60vh", overflow: "auto" }}>
        <img ref={imgRef} src={imageUrl} alt="foto" className="w-full block" draggable={false} onLoad={handleImgLoad} />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ touchAction: "none", display: imgCarregada ? "block" : "none" }}
          onMouseDown={iniciarDesenho} onMouseMove={desenhar} onMouseUp={pararDesenho} onMouseLeave={pararDesenho}
          onTouchStart={iniciarDesenho} onTouchMove={desenhar} onTouchEnd={pararDesenho}
        />
      </div>

      <div className="px-4 py-3 flex justify-end gap-2 border-t border-gray-100">
        <Button variant="outline" onClick={onClose}>Fechar</Button>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={handleSalvarNoBanco}
          disabled={salvando || !imgCarregada}
        >
          {salvando ? "Salvando..." : "Salvar Anotações"}
        </Button>
      </div>
    </div>
  );
}

// ─── PAINEL CENTRAL DE PRODUTIVIDADE — Edita tempo/produtividade de todos os tipos de uma vez ─
function PainelCentralProdutividade() {
  const utils = trpc.useUtils();
  const { data: letreiros = [] } = trpc.empacotamento.modelos.list.useQuery();
  const { data: caixas = [] } = trpc.empacotamento.modelosCaixa.list.useQuery();
  const updateLetreiros = trpc.empacotamento.modelos.updateGlobalProdutividade.useMutation({
    onSuccess: () => { utils.empacotamento.modelos.list.invalidate(); toast("Letreiros atualizados!"); },
  });
  const updateCaixas = trpc.empacotamento.modelosCaixa.updateGlobalProdutividade.useMutation({
    onSuccess: () => { utils.empacotamento.modelosCaixa.list.invalidate(); toast("Caixas atualizadas!"); },
  });

  const [formLetreiro, setFormLetreiro] = useState({ tempoPorM2Min: "", valorProdutividadePorMinLetreiro: "" });
  const [formCaixa, setFormCaixa] = useState({ tempoPorM2Min: "", tempoPorMetroArestaMin: "", valorProdutividadePorCm2: "" });
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setExpandido(p => !p)}
      >
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <span className="text-lg">⚡</span> Painel Centralizado — Atualizar Todos os Tipos de Uma Vez
        </h3>
        <span className="text-gray-400 text-sm">{expandido ? "▲ Fechar" : "▼ Abrir"}</span>
      </button>

      {expandido && (
        <div className="mt-4 space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            ⚠️ Os valores preenchidos aqui serão aplicados a <strong>todos</strong> os modelos de letreiro ou caixa cadastrados. Deixe em branco os campos que não deseja alterar.
          </div>

          {/* Letreiros */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-1">
              <span>🪧</span> Letreiros ({letreiros.length} modelos)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Tempo por m² (min) — aplicar a todos</Label>
                <Input type="number" step="0.01" min="0" value={formLetreiro.tempoPorM2Min}
                  onChange={e => setFormLetreiro(p => ({ ...p, tempoPorM2Min: e.target.value }))}
                  placeholder="Ex: 8 — deixe vazio para não alterar" />
              </div>
              <div>
                <Label>Produtividade por minuto (R$) — aplicar a todos</Label>
                <Input type="number" step="0.0001" min="0" value={formLetreiro.valorProdutividadePorMinLetreiro}
                  onChange={e => setFormLetreiro(p => ({ ...p, valorProdutividadePorMinLetreiro: e.target.value }))}
                  placeholder="Ex: 0.15 — deixe vazio para não alterar" />
              </div>
            </div>
            <Button className="mt-2 bg-indigo-600 text-white" size="sm"
              disabled={updateLetreiros.isPending || (!formLetreiro.tempoPorM2Min && !formLetreiro.valorProdutividadePorMinLetreiro)}
              onClick={() => updateLetreiros.mutate({
                tempoPorM2Min: formLetreiro.tempoPorM2Min ? parseFloat(formLetreiro.tempoPorM2Min) : null,
                valorProdutividadePorMinLetreiro: formLetreiro.valorProdutividadePorMinLetreiro ? parseFloat(formLetreiro.valorProdutividadePorMinLetreiro) : null,
              })}>
              Aplicar a Todos os Letreiros
            </Button>
          </div>

          {/* Caixas */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-1">
              <span>📦</span> Caixas ({caixas.length} modelos)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Tempo por m² (min) — aplicar a todas</Label>
                <Input type="number" step="0.01" min="0" value={formCaixa.tempoPorM2Min}
                  onChange={e => setFormCaixa(p => ({ ...p, tempoPorM2Min: e.target.value }))}
                  placeholder="Ex: 5 — deixe vazio para não alterar" />
              </div>
              <div>
                <Label>Tempo por metro de aresta (min) — aplicar a todas</Label>
                <Input type="number" step="0.01" min="0" value={formCaixa.tempoPorMetroArestaMin}
                  onChange={e => setFormCaixa(p => ({ ...p, tempoPorMetroArestaMin: e.target.value }))}
                  placeholder="Ex: 2 — deixe vazio para não alterar" />
              </div>
              <div>
                <Label>Produtividade por cm² (R$) — aplicar a todas</Label>
                <Input type="number" step="0.000001" min="0" value={formCaixa.valorProdutividadePorCm2}
                  onChange={e => setFormCaixa(p => ({ ...p, valorProdutividadePorCm2: e.target.value }))}
                  placeholder="Ex: 0.001 — deixe vazio para não alterar" />
              </div>
            </div>
            <Button className="mt-2 bg-emerald-600 text-white" size="sm"
              disabled={updateCaixas.isPending || (!formCaixa.tempoPorM2Min && !formCaixa.tempoPorMetroArestaMin && !formCaixa.valorProdutividadePorCm2)}
              onClick={() => updateCaixas.mutate({
                tempoPorM2Min: formCaixa.tempoPorM2Min ? parseFloat(formCaixa.tempoPorM2Min) : null,
                tempoPorMetroArestaMin: formCaixa.tempoPorMetroArestaMin ? parseFloat(formCaixa.tempoPorMetroArestaMin) : null,
                valorProdutividadePorCm2: formCaixa.valorProdutividadePorCm2 ? parseFloat(formCaixa.valorProdutividadePorCm2) : null,
              })}>
              Aplicar a Todas as Caixas
            </Button>
          </div>

          {/* Tabela de visualização atual */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Valores atuais por modelo:</p>
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-gray-100">
                  <TableHead className="border border-gray-200">Tipo</TableHead>
                  <TableHead className="border border-gray-200">Nome</TableHead>
                  <TableHead className="text-right border border-gray-200">Tempo/m²</TableHead>
                  <TableHead className="text-right border border-gray-200">Tempo/aresta</TableHead>
                  <TableHead className="text-right border border-gray-200">Produtividade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {letreiros.map(l => (
                  <TableRow key={`l-${l.id}`}>
                    <TableCell className="border border-gray-200 text-indigo-600 font-medium">Letreiro</TableCell>
                    <TableCell className="border border-gray-200">{l.nome}</TableCell>
                    <TableCell className="border border-gray-200 text-right">{(l as any).tempoPorM2Min ? `${parseFloat(String((l as any).tempoPorM2Min)).toFixed(1)} min` : "—"}</TableCell>
                    <TableCell className="border border-gray-200 text-right text-gray-400">—</TableCell>
                    <TableCell className="border border-gray-200 text-right">{(l as any).valorProdutividadePorMinLetreiro ? `R$ ${parseFloat(String((l as any).valorProdutividadePorMinLetreiro)).toFixed(4)}/min` : "—"}</TableCell>
                  </TableRow>
                ))}
                {caixas.map(c => (
                  <TableRow key={`c-${c.id}`}>
                    <TableCell className="border border-gray-200 text-emerald-600 font-medium">Caixa</TableCell>
                    <TableCell className="border border-gray-200">{c.nome}</TableCell>
                    <TableCell className="border border-gray-200 text-right">{(c as any).tempoPorM2Min ? `${parseFloat(String((c as any).tempoPorM2Min)).toFixed(1)} min` : "—"}</TableCell>
                    <TableCell className="border border-gray-200 text-right">{(c as any).tempoPorMetroArestaMin ? `${parseFloat(String((c as any).tempoPorMetroArestaMin)).toFixed(2)} min/m` : "—"}</TableCell>
                    <TableCell className="border border-gray-200 text-right">{(c as any).valorProdutividadePorCm2 ? `R$ ${parseFloat(String((c as any).valorProdutividadePorCm2)).toFixed(6)}/cm²` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
