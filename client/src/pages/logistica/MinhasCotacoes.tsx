import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Truck, MapPin, Package, MessageSquare, CheckCircle2, Eye, Clock , Home } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import PageHeader from "@/components/PageHeader";

const STATUS_LABELS: Record<string, string> = {
  fila: "Aguardando Cotação",
  em_cotacao: "Em Cotação",
  pronto: "Pronto — Aguardando Envio",
  concluido: "Concluído",
};
const STATUS_COLORS: Record<string, string> = {
  fila: "bg-slate-100 text-slate-700 border-slate-200",
  em_cotacao: "bg-amber-50 text-amber-700 border-amber-200",
  pronto: "bg-blue-50 text-blue-700 border-blue-200",
  concluido: "bg-green-50 text-green-700 border-green-200",
};
const STATUS_ICONS: Record<string, React.ReactNode> = {
  fila: <Clock className="w-4 h-4 text-slate-500" />,
  em_cotacao: <Truck className="w-4 h-4 text-amber-500" />,
  pronto: <CheckCircle2 className="w-4 h-4 text-blue-500" />,
  concluido: <CheckCircle2 className="w-4 h-4 text-green-500" />,
};

type Cotacao = {
  id: number;
  destinatarioNome: string | null;
  municipio: string | null;
  estado: string | null;
  pesoKg: string | null;
  valorNf: string | null;
  observacoes: string | null;
  status: string;
  solicitanteNome: string | null;
  createdAt: Date;
  opcoes: Array<{
    id: number;
    transportadoraNome: string | null;
    valorFrete: string;
    prazoDias: number | null;
    selecionada: string;
  }>;
};

function CotacaoDetalhe({ cotacao, onRefresh }: { cotacao: Cotacao; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [comentario, setComentario] = useState("");
  const [novaObs, setNovaObs] = useState(cotacao.observacoes ?? "");
  const utils = trpc.useUtils();

  const { data: detalhe } = trpc.cotacoesFrete.get.useQuery({ id: cotacao.id }, { enabled: open });
  const updateObs = trpc.cotacoesFrete.update.useMutation({
    onSuccess: () => { utils.cotacoesFrete.get.invalidate({ id: cotacao.id }); onRefresh(); toast.success("Observações salvas"); },
  });
  const addComentario = trpc.cotacoesFrete.addComentario.useMutation({
    onSuccess: () => { utils.cotacoesFrete.get.invalidate({ id: cotacao.id }); setComentario(""); },
  });

  const opcaoSelecionada = cotacao.opcoes.find(o => o.selecionada === "sim");

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setNovaObs(cotacao.observacoes ?? ""); }}>
      <DialogTrigger asChild>
        <div className={`rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow ${STATUS_COLORS[cotacao.status]}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {STATUS_ICONS[cotacao.status]}
                <p className="font-semibold text-sm truncate">{cotacao.destinatarioNome || "Sem destinatário"}</p>
              </div>
              <p className="text-xs opacity-70 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />{cotacao.municipio}/{cotacao.estado}
              </p>
              <p className="text-xs opacity-60 mt-0.5">
                {new Date(cotacao.createdAt).toLocaleDateString("pt-BR")} — #{cotacao.id}
              </p>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">{STATUS_LABELS[cotacao.status]}</Badge>
          </div>

          {/* Resultado da cotação — visível para o vendedor */}
          {opcaoSelecionada && (
            <div className="mt-2 p-2 bg-green-100 rounded border border-green-200">
              <p className="text-xs font-semibold text-green-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />Frete definido pela logística:
              </p>
              <p className="text-sm font-bold text-green-900 mt-0.5">
                {opcaoSelecionada.transportadoraNome} — R$ {opcaoSelecionada.valorFrete}
                {opcaoSelecionada.prazoDias && ` (${opcaoSelecionada.prazoDias} dias úteis)`}
              </p>
            </div>
          )}
          {cotacao.status === "pronto" && !opcaoSelecionada && (
            <div className="mt-2 p-2 bg-blue-100 rounded border border-blue-200">
              <p className="text-xs text-blue-700 font-medium">✓ Cotação pronta — aguardando confirmação do cliente</p>
            </div>
          )}
          {cotacao.status === "em_cotacao" && (
            <p className="text-xs mt-2 opacity-70 italic">A logística está cotando o frete...</p>
          )}
        </div>
      </DialogTrigger>

      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Solicitação #{cotacao.id} — {cotacao.destinatarioNome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            {STATUS_ICONS[cotacao.status]}
            <Badge className={STATUS_COLORS[cotacao.status]}>{STATUS_LABELS[cotacao.status]}</Badge>
          </div>

          {/* Dados da solicitação */}
          <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 rounded-lg p-3">
            <div><span className="text-muted-foreground">Destino:</span> <strong>{cotacao.municipio}/{cotacao.estado}</strong></div>
            {cotacao.pesoKg && <div><span className="text-muted-foreground">Peso:</span> <strong>{cotacao.pesoKg} kg</strong></div>}
            {cotacao.valorNf && <div><span className="text-muted-foreground">Valor NF:</span> <strong>R$ {cotacao.valorNf}</strong></div>}
            {detalhe?.cepDestino && <div><span className="text-muted-foreground">CEP:</span> <strong>{detalhe.cepDestino}</strong></div>}
          </div>

          {/* Observações — compartilhadas com logística */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1">
              <Eye className="w-4 h-4" />Observações (visíveis para a logística)
            </Label>
            <Textarea
              value={novaObs}
              onChange={e => setNovaObs(e.target.value)}
              placeholder="Adicione informações sobre dimensões, fragilidade, urgência..."
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

          {/* Opções de frete — somente visualização */}
          {detalhe?.opcoes && detalhe.opcoes.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2">Opções de Frete Disponíveis</h3>
              {detalhe.opcoes.map((op) => (
                <div key={op.id} className={`flex items-center justify-between p-2.5 rounded border mb-1 text-sm ${op.selecionada === "sim" ? "bg-green-50 border-green-300" : "bg-background"}`}>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium">{op.transportadoraNome || "—"}</span>
                      <span className="text-muted-foreground ml-2">R$ {op.valorFrete}</span>
                      {op.prazoDias && <span className="text-muted-foreground ml-2">{op.prazoDias} dias úteis</span>}
                    </div>
                  </div>
                  {op.selecionada === "sim" && (
                    <Badge className="bg-green-100 text-green-700 shrink-0">
                      <CheckCircle2 className="w-3 h-3 mr-1" />Selecionada
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Comentários */}
          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />Comentários com a Logística
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
              {detalhe?.comentarios.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum comentário ainda.</p>
              )}
              {detalhe?.comentarios.map(c => (
                <div key={c.id} className="text-xs bg-muted/30 rounded p-2">
                  <span className="font-medium">{c.autorNome}:</span> {c.texto}
                  <span className="text-muted-foreground ml-2">{new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Mensagem para a logística..."
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && comentario.trim()) addComentario.mutate({ cotacaoId: cotacao.id, autorNome: "Vendedor", texto: comentario }); }}
              />
              <Button size="sm" onClick={() => { if (comentario.trim()) addComentario.mutate({ cotacaoId: cotacao.id, autorNome: "Vendedor", texto: comentario }); }}>
                Enviar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NovaSolicitacaoDialog({ onSuccess, solicitanteNome }: { onSuccess: () => void; solicitanteNome: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ destinatarioNome: "", municipio: "", estado: "", cepDestino: "", pesoKg: "", valorNf: "", observacoes: "" });

  const create = trpc.cotacoesFrete.create.useMutation({
    onSuccess: () => { onSuccess(); setOpen(false); toast.success("Solicitação enviada para a logística!"); setForm({ destinatarioNome: "", municipio: "", estado: "", cepDestino: "", pesoKg: "", valorNf: "", observacoes: "" }); },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" />Nova Solicitação de Frete</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Solicitar Cotação de Frete</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Destinatário *</Label>
              <Input value={form.destinatarioNome} onChange={e => setForm(p => ({ ...p, destinatarioNome: e.target.value }))} placeholder="Nome do cliente/empresa" />
            </div>
            <div>
              <Label>Município *</Label>
              <Input value={form.municipio} onChange={e => setForm(p => ({ ...p, municipio: e.target.value }))} placeholder="Cidade de destino" />
            </div>
            <div>
              <Label>Estado *</Label>
              <Input value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="UF" maxLength={2} />
            </div>
            <div>
              <Label>CEP</Label>
              <Input value={form.cepDestino} onChange={e => setForm(p => ({ ...p, cepDestino: e.target.value }))} placeholder="00000-000" />
            </div>
            <div>
              <Label>Peso (kg)</Label>
              <Input value={form.pesoKg} onChange={e => setForm(p => ({ ...p, pesoKg: e.target.value }))} placeholder="Ex: 15.5" />
            </div>
            <div>
              <Label>Valor NF (R$)</Label>
              <Input value={form.valorNf} onChange={e => setForm(p => ({ ...p, valorNf: e.target.value }))} placeholder="Ex: 2500,00" />
            </div>
          </div>
          <div>
            <Label>Observações para a logística</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Dimensões, fragilidade, urgência, instruções especiais..." rows={3} />
          </div>
          <Button
            className="w-full"
            disabled={!form.destinatarioNome || !form.municipio || !form.estado || create.isPending}
            onClick={() => create.mutate({ ...form, solicitanteNome })}
          >
            {create.isPending ? "Enviando..." : "Enviar para Logística"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MinhasCotacoes() {
  const utils = trpc.useUtils();
  const { user: localUser } = useAuth();
  const nome = localUser?.name ?? "";
  const userId = localUser?.id;

  // Usar endpoint dedicado: por ID se disponível, senão por nome
  const { data: minhasCotacoes = [], isLoading } = trpc.cotacoesFrete.listMinhas.useQuery(
    userId ? { solicitanteId: userId, solicitanteNome: nome } : { solicitanteNome: nome },
    { enabled: !!nome }
  );
  const refresh = () => utils.cotacoesFrete.listMinhas.invalidate();

  const pendentes = minhasCotacoes.filter(c => c.status === "aberta" || c.status === "cotando" || c.status === "selecao");
  const prontas = minhasCotacoes.filter(c => c.status === "cotada");
  const concluidas = minhasCotacoes.filter(c => c.status === "enviada");

  if (isLoading) {
    return <div className="p-6"><div className="h-8 bg-muted animate-pulse rounded w-48" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Barra de navegação */}
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
      <PageHeader
        title="Minhas Solicitações de Frete"
        description={`${nome ? `Solicitações de ${nome}` : "Suas solicitações de cotação de frete"} — ${minhasCotacoes.length} total`}
        icon={Package}
        actions={<NovaSolicitacaoDialog onSuccess={refresh} solicitanteNome={nome} />}
      />

      {minhasCotacoes.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma solicitação encontrada</p>
          <p className="text-sm mt-1">Clique em "Nova Solicitação de Frete" para começar</p>
        </div>
      )}

      {prontas.length > 0 && (
        <div>
          <h2 className="font-semibold text-sm text-blue-700 mb-2 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />Prontas para enviar ao cliente ({prontas.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {prontas.map(c => <CotacaoDetalhe key={c.id} cotacao={c} onRefresh={refresh} />)}
          </div>
        </div>
      )}

      {pendentes.length > 0 && (
        <div>
          <h2 className="font-semibold text-sm text-amber-700 mb-2 flex items-center gap-1">
            <Clock className="w-4 h-4" />Em andamento ({pendentes.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendentes.map(c => <CotacaoDetalhe key={c.id} cotacao={c} onRefresh={refresh} />)}
          </div>
        </div>
      )}

      {concluidas.length > 0 && (
        <div>
          <h2 className="font-semibold text-sm text-green-700 mb-2 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />Concluídas ({concluidas.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {concluidas.map(c => <CotacaoDetalhe key={c.id} cotacao={c} onRefresh={refresh} />)}
          </div>
        </div>
      )}
    </div>
  );
}
