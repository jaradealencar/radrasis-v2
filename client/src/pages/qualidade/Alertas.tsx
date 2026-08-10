import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, BellOff, AlertTriangle, Info, CheckCircle2, Archive, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";

const TIPO_LABELS: Record<string, string> = {
  reincidencia: "Reincidência",
  meta_excedida: "Meta Excedida",
  sem_acao: "Sem Ação Corretiva",
  prazo_vencido: "Prazo Vencido",
  novo_retrabalho: "Novo Retrabalho",
  atraso_expedicao: "Atraso na Expedição",
};

const SEV_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string }> = {
  critico: { icon: AlertTriangle, color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  aviso: { icon: AlertTriangle, color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  info: { icon: Info, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
};

export default function Alertas() {
  const [filtroStatus, setFiltroStatus] = useState<"ativo" | "lido" | "arquivado" | "">("");
  const [filtroTipo, setFiltroTipo] = useState("");

  const { data: alertas = [], isLoading, refetch } = trpc.alertas.list.useQuery(
    { status: filtroStatus || undefined, tipo: filtroTipo || undefined },
    { refetchInterval: 30000 }
  );
  const { data: counts, refetch: refetchCounts } = trpc.alertas.countAtivos.useQuery(undefined, { refetchInterval: 30000 });
  const utils = trpc.useUtils();

  const marcarLidoMut = trpc.alertas.marcarLido.useMutation({
    onSuccess: () => { toast.success("Alerta marcado como lido."); utils.alertas.list.invalidate(); utils.alertas.countAtivos.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const arquivarMut = trpc.alertas.arquivar.useMutation({
    onSuccess: () => { toast.success("Alerta arquivado com sucesso."); utils.alertas.list.invalidate(); utils.alertas.countAtivos.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const gerarMut = trpc.alertas.verificarAlertas.useMutation({
    onSuccess: (data: any) => {
      toast.success(`${data.gerados ?? 0} alerta(s) gerado(s) automaticamente`);
      utils.alertas.list.invalidate();
      utils.alertas.countAtivos.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const marcarTodosLidos = () => {
    const ativos = (alertas as any[]).filter(a => a.status === "ativo");
    ativos.forEach(a => marcarLidoMut.mutate({ id: a.id }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Alertas do Sistema</h1>
          <p className="text-slate-500 text-sm mt-1">Notificações automáticas de reincidências, metas e prazos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => gerarMut.mutate()} disabled={gerarMut.isPending} className="gap-2">
            <Zap size={14} />
            {gerarMut.isPending ? "Gerando..." : "Gerar Alertas"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { refetch(); refetchCounts(); }} className="gap-2">
            <RefreshCw size={14} /> Atualizar
          </Button>
          {(counts?.total ?? 0) > 0 && (
            <Button size="sm" onClick={marcarTodosLidos} className="gap-2">
              <CheckCircle2 size={14} /> Marcar todos como lidos
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle size={22} className="text-red-600 flex-shrink-0" />
            <div>
              <div className="text-xs font-semibold text-red-600 uppercase tracking-wide">Críticos</div>
              <div className="text-2xl font-bold text-red-700">{counts?.criticos ?? 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Bell size={22} className="text-orange-600 flex-shrink-0" />
            <div>
              <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Avisos</div>
              <div className="text-2xl font-bold text-orange-700">{counts?.avisos ?? 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Bell size={22} className="text-slate-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Ativos</div>
              <div className="text-2xl font-bold text-slate-700">{counts?.total ?? 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filtroStatus} onValueChange={v => setFiltroStatus(v as any)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="lido">Lidos</SelectItem>
            <SelectItem value="arquivado">Arquivados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os tipos</SelectItem>
            {Object.entries(TIPO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista de alertas */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Carregando alertas...</div>
      ) : alertas.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-300">
          <CardContent className="p-10 text-center">
            <BellOff size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 font-medium">Nenhum alerta encontrado</p>
            <p className="text-slate-400 text-sm mt-1">Clique em "Gerar Alertas" para verificar reincidências e metas automaticamente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(alertas as any[]).map(alerta => {
            const sev = SEV_CONFIG[alerta.severidade ?? "aviso"] ?? SEV_CONFIG.aviso;
            const Icon = sev.icon;
            const isLido = alerta.status === "lido";
            const isArquivado = alerta.status === "arquivado";
            return (
              <Card key={alerta.id} className={`border ${sev.border} ${sev.bg} ${isLido || isArquivado ? "opacity-60" : ""} transition-opacity`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Icon size={18} className={`${sev.color} flex-shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`font-semibold text-sm ${sev.color}`}>{alerta.titulo}</span>
                          <Badge variant="outline" className="text-xs">
                            {TIPO_LABELS[alerta.tipo ?? ""] ?? alerta.tipo}
                          </Badge>
                          {alerta.referenciaExtra && (
                            <Badge variant="secondary" className="font-mono text-xs">{alerta.referenciaExtra}</Badge>
                          )}
                          {isLido && <span className="text-xs text-slate-400">✓ Lido</span>}
                          {isArquivado && <span className="text-xs text-slate-400">📦 Arquivado</span>}
                        </div>
                        {alerta.descricao && (
                          <p className="text-sm text-slate-600 mt-0.5">{alerta.descricao}</p>
                        )}
                        <div className="text-xs text-slate-400 mt-1">
                          {alerta.createdAt ? new Date(alerta.createdAt).toLocaleString("pt-BR") : ""}
                          {alerta.lidoPor && ` · Lido por ${alerta.lidoPor}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {alerta.status === "ativo" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs gap-1"
                          onClick={() => marcarLidoMut.mutate({ id: alerta.id })}
                          disabled={marcarLidoMut.isPending}
                        >
                          <CheckCircle2 size={13} /> Lido
                        </Button>
                      )}
                      {alerta.status !== "arquivado" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-slate-400 gap-1"
                          onClick={() => arquivarMut.mutate({ id: alerta.id })}
                          disabled={arquivarMut.isPending}
                        >
                          <Archive size={13} /> Arquivar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
