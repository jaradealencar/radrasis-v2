import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Truck, Clock, CheckCircle, ListOrdered, TrendingUp, Home, Calendar, ChevronUp, ChevronDown, Minus, Tag, X, AlertCircle, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";
import { toast } from "sonner";

function formatDate(val: any) {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export default function LogisticaDashboard() {
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");
  const [modalRetrabalho, setModalRetrabalho] = useState<{id: number; osNum: string | null; temRetrabalho: boolean; tipoRetrabalho: string | null; motivoRetrabalho: string | null} | null>(null);
  const [formTipoRetrabalho, setFormTipoRetrabalho] = useState("");
  const [formMotivoRetrabalho, setFormMotivoRetrabalho] = useState("");
  const [formTemRetrabalho, setFormTemRetrabalho] = useState(false);

  const { data, isLoading } = trpc.cotacoesFrete.dashboard.useQuery();
  const { data: prazoStats, isLoading: prazoLoading, refetch: refetchPrazo } = trpc.cotacoesFrete.assertividade.useQuery({
    de: filtroDe || undefined,
    ate: filtroAte || undefined,
  });
  const { data: metricasRet, isLoading: metricasRetLoading, refetch: refetchMetricas } = trpc.cotacoesFrete.metricasRetrabalho.useQuery({
    de: filtroDe || undefined,
    ate: filtroAte || undefined,
  });
  const marcarRetrabalho = trpc.cotacoesFrete.marcarRetrabalho.useMutation({
    onSuccess: () => {
      toast.success("Marcação de retrabalho salva!");
      setModalRetrabalho(null);
      refetchPrazo();
      refetchMetricas();
    },
    onError: () => toast.error("Erro ao salvar marcação"),
  });
  const handleAbrirModalRetrabalho = (p: any) => {
    setFormTemRetrabalho(p.temRetrabalho ?? false);
    setFormTipoRetrabalho(p.tipoRetrabalho ?? "");
    setFormMotivoRetrabalho(p.motivoRetrabalho ?? "");
    setModalRetrabalho({ id: p.id, osNum: p.empacotamentoPedidoNumero, temRetrabalho: p.temRetrabalho ?? false, tipoRetrabalho: p.tipoRetrabalho, motivoRetrabalho: p.motivoRetrabalho });
  };
  const handleSalvarRetrabalho = () => {
    if (!modalRetrabalho) return;
    marcarRetrabalho.mutate({
      id: modalRetrabalho.id,
      temRetrabalho: formTemRetrabalho,
      tipoRetrabalho: formTemRetrabalho ? formTipoRetrabalho : undefined,
      motivoRetrabalho: formTemRetrabalho ? formMotivoRetrabalho : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Total de Cotações", value: data?.total ?? 0, icon: ListOrdered, color: "text-blue-500" },
    { label: "Em Andamento", value: data?.emAndamento ?? 0, icon: Clock, color: "text-amber-500" },
    { label: "Concluídas", value: data?.concluidas ?? 0, icon: CheckCircle, color: "text-green-500" },
    { label: "Na Fila", value: data?.fila ?? 0, icon: Truck, color: "text-purple-500" },
  ];

  const chartData = Object.entries(data?.porMes ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([mes, total]) => {
      const [ano, m] = mes.split("-");
      const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      return { mes: `${meses[parseInt(m)-1]}/${ano.slice(2)}`, total };
    });

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
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="w-6 h-6 text-blue-500" />
          Dashboard de Logística
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das cotações de frete, prazo de expedição e retrabalhos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-3xl font-bold mt-1">{s.value}</p>
                </div>
                <s.icon className={`w-8 h-8 ${s.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4" />
              Cotações por Mês (últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#3b82f6" radius={[4,4,0,0]} name="Cotações" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {chartData.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma cotação registrada ainda.</p>
            <p className="text-sm mt-1">Crie uma solicitação de frete para começar.</p>
          </CardContent>
        </Card>
      )}

      {/* ── PRAZO DE EXPEDIÇÃO — PREVISTO VS. REAL ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-5 h-5 text-blue-500" />
              Prazo de Expedição — Previsto vs. Real
            </CardTitle>
            <div className="flex items-center gap-2">
              <input type="date" value={filtroDe} onChange={e => setFiltroDe(e.target.value)} className="h-8 text-xs rounded-md border border-input bg-background px-2 py-1" />
              <span className="text-xs text-muted-foreground">até</span>
              <input type="date" value={filtroAte} onChange={e => setFiltroAte(e.target.value)} className="h-8 text-xs rounded-md border border-input bg-background px-2 py-1" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {prazoLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="w-4 h-4 animate-spin" />Carregando dados de prazo...</div>
          ) : !prazoStats || prazoStats.total === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Nenhum pedido despachado com data prevista registrada.</p>
              <p className="text-xs mt-1">Os dados aparecerão conforme os cards forem concluídos e as OSs tiverem data de entrega no Mubisys.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-green-700 text-xs font-semibold mb-1"><CheckCircle className="w-3.5 h-3.5" /> No Prazo</div>
                  <p className="text-3xl font-bold text-green-700">{prazoStats.pctNoPrazo}%</p>
                  <p className="text-xs text-green-600 mt-0.5">{prazoStats.noPrazo} de {prazoStats.total}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-blue-700 text-xs font-semibold mb-1"><ChevronUp className="w-3.5 h-3.5" /> Antecipados</div>
                  <p className="text-3xl font-bold text-blue-700">{prazoStats.pctAntecipados}%</p>
                  <p className="text-xs text-blue-600 mt-0.5">{prazoStats.antecipados} de {prazoStats.total}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-red-700 text-xs font-semibold mb-1"><ChevronDown className="w-3.5 h-3.5" /> Atrasados</div>
                  <p className="text-3xl font-bold text-red-700">{prazoStats.pctAtrasados}%</p>
                  <p className="text-xs text-red-600 mt-0.5">{prazoStats.atrasados} de {prazoStats.total}</p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">OS / ID</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Destinatário</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Material</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Destino</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Prev. Entrega</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Data Despacho</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Diferença</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Situação</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Retrabalho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prazoStats.pedidos.map((p: any) => (
                      <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-700">{p.empacotamentoPedidoNumero ? `OS #${p.empacotamentoPedidoNumero}` : `#${p.id}`}</td>
                        <td className="px-3 py-2 text-gray-700 max-w-[140px] truncate">{p.destinatarioNome ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-[100px] truncate">{p.tipoMaterial ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{p.municipio && p.estado ? `${p.municipio}/${p.estado}` : "—"}</td>
                        <td className="px-3 py-2 text-gray-700">{formatDate(p.dataEntregaPrevista)}</td>
                        <td className="px-3 py-2 text-gray-700">{formatDate(p.dataDespacho)}</td>
                        <td className="px-3 py-2">
                          {p.diffDias === 0 ? (
                            <span className="flex items-center gap-1 text-green-700"><Minus className="w-3 h-3" /> No dia</span>
                          ) : p.diffDias < 0 ? (
                            <span className="flex items-center gap-1 text-blue-700"><ChevronUp className="w-3 h-3" /> {Math.abs(p.diffDias)}d antes</span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-700"><ChevronDown className="w-3 h-3" /> {p.diffDias}d atraso</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {p.situacao === "no_prazo" && <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">No Prazo</Badge>}
                          {p.situacao === "antecipado" && <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Antecipado</Badge>}
                          {p.situacao === "atrasado" && <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Atrasado</Badge>}
                        </td>
                        <td className="px-3 py-2">
                          {p.situacao === "atrasado" ? (
                            <button onClick={() => handleAbrirModalRetrabalho(p)} className={`flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border transition-colors ${p.temRetrabalho ? "bg-orange-100 text-orange-800 border-orange-300 font-semibold" : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200"}`}>
                              <Tag className="w-3 h-3" />{p.temRetrabalho ? (p.tipoRetrabalho ?? "Com Retrabalho") : "Marcar"}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── RETRABALHO NOS PEDIDOS ATRASADOS ── */}
      <Card className="border-2 border-orange-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="w-5 h-5 text-orange-600" />
            Retrabalho nos Pedidos Atrasados
          </CardTitle>
          <p className="text-xs text-muted-foreground">Classifica quais pedidos atrasados possuem retrabalho associado. Use o botão "Marcar" na tabela acima para etiquetar cada pedido.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {metricasRetLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="w-4 h-4 animate-spin" />Carregando métricas de retrabalho...</div>
          ) : !metricasRet || metricasRet.totalAtrasados === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Nenhum pedido atrasado registrado ainda.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-red-700 text-xs font-semibold mb-1"><AlertCircle className="w-3.5 h-3.5" /> Total Atrasados</div>
                  <p className="text-3xl font-bold text-red-700">{metricasRet.totalAtrasados}</p>
                  <p className="text-xs text-red-500 mt-0.5">pedidos</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-orange-700 text-xs font-semibold mb-1"><Tag className="w-3.5 h-3.5" /> Com Retrabalho</div>
                  <p className="text-3xl font-bold text-orange-700">{metricasRet.pctComRetrabalho}%</p>
                  <p className="text-xs text-orange-600 mt-0.5">{metricasRet.comRetrabalho} de {metricasRet.totalAtrasados}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-600 text-xs font-semibold mb-1"><X className="w-3.5 h-3.5" /> Sem Retrabalho</div>
                  <p className="text-3xl font-bold text-gray-600">{100 - metricasRet.pctComRetrabalho}%</p>
                  <p className="text-xs text-gray-500 mt-0.5">{metricasRet.semRetrabalho} de {metricasRet.totalAtrasados}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metricasRet.distribuicaoPorTipo.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Distribuição por Tipo</h4>
                    <div className="space-y-2">
                      {metricasRet.distribuicaoPorTipo.map((item: any) => (
                        <div key={item.tipo} className="flex items-center gap-2">
                          <span className="text-xs text-gray-700 w-28 truncate">{item.tipo}</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-orange-400 rounded-full" style={{ width: `${item.pct}%` }} /></div>
                          <span className="text-xs text-gray-500 w-16 text-right">{item.count}x ({item.pct}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Tendência Mensal (6 meses)</h4>
                  <div className="space-y-1.5">
                    {metricasRet.tendencia.map((t: any) => (
                      <div key={t.mes} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-14">{t.mes}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-red-300 rounded-full" style={{ width: `${t.totalAtrasados > 0 ? 100 : 0}%` }} /></div>
                        <span className="text-xs text-gray-500 w-24 text-right">{t.totalAtrasados} atr. / {t.comRetrabalho} ret.</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {metricasRet.comRetrabalho > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Pedidos Atrasados com Retrabalho</h4>
                  <div className="overflow-x-auto rounded-lg border border-orange-200">
                    <table className="w-full text-xs">
                      <thead className="bg-orange-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-orange-700">OS / ID</th>
                          <th className="text-left px-3 py-2 font-semibold text-orange-700">Destinatário</th>
                          <th className="text-left px-3 py-2 font-semibold text-orange-700">Atraso</th>
                          <th className="text-left px-3 py-2 font-semibold text-orange-700">Tipo Retrabalho</th>
                          <th className="text-left px-3 py-2 font-semibold text-orange-700">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metricasRet.lista.filter((p: any) => p.temRetrabalho).map((p: any) => (
                          <tr key={p.id} className="border-t border-orange-100 hover:bg-orange-50">
                            <td className="px-3 py-2 font-mono text-gray-700">{p.empacotamentoPedidoNumero ? `OS #${p.empacotamentoPedidoNumero}` : `#${p.id}`}</td>
                            <td className="px-3 py-2 text-gray-700 max-w-[120px] truncate">{p.destinatarioNome ?? "—"}</td>
                            <td className="px-3 py-2 text-red-700 font-semibold">+{p.diffDias}d</td>
                            <td className="px-3 py-2"><Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">{p.tipoRetrabalho ?? "Não categorizado"}</Badge></td>
                            <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate">{p.motivoRetrabalho ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de marcação de retrabalho */}
      <Dialog open={!!modalRetrabalho} onOpenChange={(open) => { if (!open) setModalRetrabalho(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-orange-600" />
              Marcar Retrabalho — {modalRetrabalho?.osNum ? `OS #${modalRetrabalho.osNum}` : `#${modalRetrabalho?.id}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
              <input type="checkbox" id="temRetrabalhoModal" checked={formTemRetrabalho} onChange={e => setFormTemRetrabalho(e.target.checked)} className="w-4 h-4 accent-orange-600" />
              <label htmlFor="temRetrabalhoModal" className="text-sm font-medium text-orange-900 cursor-pointer">Este pedido atrasado possui retrabalho associado</label>
            </div>
            {formTemRetrabalho && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tipo de Retrabalho</Label>
                  <Select value={formTipoRetrabalho} onValueChange={setFormTipoRetrabalho}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Producao">Produção</SelectItem>
                      <SelectItem value="Expedicao">Expedição</SelectItem>
                      <SelectItem value="Projeto">Projeto</SelectItem>
                      <SelectItem value="Qualidade">Qualidade</SelectItem>
                      <SelectItem value="Logistica">Logística</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Motivo (opcional)</Label>
                  <Textarea placeholder="Descreva brevemente o motivo do retrabalho..." value={formMotivoRetrabalho} onChange={e => setFormMotivoRetrabalho(e.target.value)} rows={3} className="text-sm" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalRetrabalho(null)}>Cancelar</Button>
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleSalvarRetrabalho} disabled={marcarRetrabalho.isPending || (formTemRetrabalho && !formTipoRetrabalho)}>
              {marcarRetrabalho.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Tag className="w-3 h-3 mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
