import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ClipboardCheck, CheckCircle2, Clock, AlertTriangle, Edit2, Plus } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";

const STATUS_COLORS: Record<string, string> = {
  aberto: "bg-red-100 text-red-700 border-red-200",
  em_tratamento: "bg-blue-100 text-blue-700 border-blue-200",
  resolvido: "bg-green-100 text-green-700 border-green-200",
};
const STATUS_LABELS: Record<string, string> = {
  aberto: "Aberto",
  em_tratamento: "Em Tratamento",
  resolvido: "Resolvido",
};
const STATUS_ICONS: Record<string, any> = {
  aberto: AlertTriangle,
  em_tratamento: Clock,
  resolvido: CheckCircle2,
};

interface AcaoForm {
  retrabalhoid: number;
  status: "aberto" | "em_tratamento" | "resolvido";
  acaoTomada: string;
  responsavel: string;
  prazoResolucao: string;
  custoAdicional: string;
  observacoes: string;
}

export default function AcoesCorretivas() {
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<AcaoForm>({
    retrabalhoid: 0,
    status: "aberto",
    acaoTomada: "",
    responsavel: "",
    prazoResolucao: "",
    custoAdicional: "",
    observacoes: "",
  });

  const { data: acoes = [], isLoading } = trpc.acoesCorretivas.list.useQuery(
    { status: filtroStatus !== "todos" ? filtroStatus as any : undefined },
    { refetchInterval: 60000 }
  );
  const { data: retrabalhosList = [] } = trpc.retrabalhos.list.useQuery({});
  const utils = trpc.useUtils();

  const upsertMut = trpc.acoesCorretivas.upsert.useMutation({
    onSuccess: () => {
      toast.success("Ação corretiva salva com sucesso!");
      setModalOpen(false);
      utils.acoesCorretivas.list.invalidate();
      utils.acoesCorretivas.stats.invalidate();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  // Mapear retrabalhos por ID
  const retrabalhosMap = new Map((retrabalhosList as any[]).map(r => [r.id, r]));

  const abrirNova = () => {
    setForm({ retrabalhoid: 0, status: "aberto", acaoTomada: "", responsavel: "", prazoResolucao: "", custoAdicional: "", observacoes: "" });
    setModalOpen(true);
  };

  const abrirEditar = (a: any) => {
    setForm({
      retrabalhoid: a.retrabalhoid,
      status: a.status,
      acaoTomada: a.acaoTomada ?? "",
      responsavel: a.responsavel ?? "",
      prazoResolucao: a.prazoResolucao ? new Date(a.prazoResolucao).toISOString().split("T")[0] : "",
      custoAdicional: a.custoAdicional ? String(a.custoAdicional) : "",
      observacoes: a.observacoes ?? "",
    });
    setModalOpen(true);
  };

  const salvar = () => {
    if (!form.retrabalhoid) { toast.error("Selecione um retrabalho"); return; }
    upsertMut.mutate({
      retrabalhoid: form.retrabalhoid,
      status: form.status,
      acaoTomada: form.acaoTomada || undefined,
      responsavel: form.responsavel || undefined,
      prazoResolucao: form.prazoResolucao || undefined,
      custoAdicional: form.custoAdicional ? Number(form.custoAdicional) : undefined,
      observacoes: form.observacoes || undefined,
    });
  };

  // KPIs
  const totalAbertos = (acoes as any[]).filter(a => a.status === "aberto").length;
  const totalEmTratamento = (acoes as any[]).filter(a => a.status === "em_tratamento").length;
  const totalResolvidos = (acoes as any[]).filter(a => a.status === "resolvido").length;

  // Prazo vencido
  const prazoVencido = (a: any) =>
    a.prazoResolucao && a.status !== "resolvido" && new Date(a.prazoResolucao) < new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Ações Corretivas"
        description="Registre e acompanhe o ciclo de resolução de cada retrabalho."
        actions={
          <Button onClick={abrirNova} className="gap-2">
            <Plus size={15} /> Nova Ação
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Abertos", value: totalAbertos, color: "text-red-600", bg: "bg-red-50 border-red-200" },
          { label: "Em Tratamento", value: totalEmTratamento, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
          { label: "Resolvidos", value: totalResolvidos, color: "text-green-600", bg: "bg-green-50 border-green-200" },
        ].map(k => (
          <Card key={k.label} className={`border ${k.bg}`}>
            <CardContent className="p-4 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{k.label}</div>
              <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtro */}
      <div className="flex gap-3">
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aberto">Abertos</SelectItem>
            <SelectItem value="em_tratamento">Em Tratamento</SelectItem>
            <SelectItem value="resolvido">Resolvidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Carregando...</div>
      ) : acoes.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-300">
          <CardContent className="p-10 text-center">
            <ClipboardCheck size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 font-medium">Nenhuma ação corretiva encontrada</p>
            <p className="text-slate-400 text-sm mt-1">Registre ações corretivas para os retrabalhos identificados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(acoes as any[]).map(a => {
            const retrabalho = retrabalhosMap.get(a.retrabalhoid);
            const Icon = STATUS_ICONS[a.status ?? "aberto"] ?? AlertTriangle;
            const vencido = prazoVencido(a);
            return (
              <Card key={a.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Icon size={18} className={`flex-shrink-0 mt-0.5 ${a.status === "resolvido" ? "text-green-600" : a.status === "em_tratamento" ? "text-blue-600" : "text-red-600"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {retrabalho && (
                            <span className="font-semibold text-slate-800">
                              OS {retrabalho.osOriginal ?? retrabalho.id} — {retrabalho.setor}
                            </span>
                          )}
                          {!retrabalho && <span className="font-semibold text-slate-500">Retrabalho #{a.retrabalhoid}</span>}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[a.status ?? "aberto"]}`}>
                            {STATUS_LABELS[a.status ?? "aberto"]}
                          </span>
                          {vencido && <Badge variant="destructive" className="text-xs">Prazo Vencido</Badge>}
                        </div>
                        {a.acaoTomada && <p className="text-sm text-slate-600 mt-1 line-clamp-2">{a.acaoTomada}</p>}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                          {a.responsavel && <span>👤 {a.responsavel}</span>}
                          {a.prazoResolucao && (
                            <span className={vencido ? "text-red-600 font-semibold" : ""}>
                              📅 {new Date(a.prazoResolucao).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                          {a.custoAdicional && Number(a.custoAdicional) > 0 && (
                            <span>💰 R$ {Number(a.custoAdicional).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          )}
                          <span className="text-slate-300">{new Date(a.createdAt).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => abrirEditar(a)}>
                      <Edit2 size={13} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ação Corretiva</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Retrabalho *</Label>
              <Select value={form.retrabalhoid ? String(form.retrabalhoid) : ""} onValueChange={v => setForm(f => ({ ...f, retrabalhoid: Number(v) }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o retrabalho..." />
                </SelectTrigger>
                <SelectContent>
                  {(retrabalhosList as any[]).map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      OS {r.osOriginal ?? r.id} — {r.setor} ({new Date(r.data).toLocaleDateString("pt-BR")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status *</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberto">Aberto</SelectItem>
                  <SelectItem value="em_tratamento">Em Tratamento</SelectItem>
                  <SelectItem value="resolvido">Resolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Ação Tomada</Label>
              <Textarea placeholder="Descreva a ação corretiva tomada..." value={form.acaoTomada} onChange={e => setForm(f => ({ ...f, acaoTomada: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Responsável</Label>
                <Input placeholder="Nome" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Prazo de Resolução</Label>
                <Input type="date" value={form.prazoResolucao} onChange={e => setForm(f => ({ ...f, prazoResolucao: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Custo Adicional (R$)</Label>
              <Input type="number" step="0.01" placeholder="0,00" value={form.custoAdicional} onChange={e => setForm(f => ({ ...f, custoAdicional: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea placeholder="Observações adicionais..." value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={upsertMut.isPending}>
              {upsertMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
