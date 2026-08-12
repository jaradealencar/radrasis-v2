import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TrendingUp, Brain, Truck, MapPin, CheckCircle2, Clock, AlertTriangle, Loader2, BarChart3, Home, Calendar, ChevronUp, ChevronDown, Minus, Tag, X, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Link } from "wouter";
import PageHeader from "@/components/PageHeader";
import { STATUS_COLORS } from "@/lib/chartColors";

export default function Assertividade() {
  const [analise, setAnalise] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");
  // Estado do modal de marcação de retrabalho
  const [modalRetrabalho, setModalRetrabalho] = useState<{id: number; osNum: string | null; temRetrabalho: boolean; tipoRetrabalho: string | null; motivoRetrabalho: string | null} | null>(null);
  const [formTipoRetrabalho, setFormTipoRetrabalho] = useState("");
  const [formMotivoRetrabalho, setFormMotivoRetrabalho] = useState("");
  const [formTemRetrabalho, setFormTemRetrabalho] = useState(false);

  const { data: cotacoesList } = trpc.cotacoesFrete.list.useQuery({ pageSize: 100 });
  const cotacoes = cotacoesList?.data ?? [];
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
  const { data: transportadoras = [] } = trpc.transportadoras.list.useQuery({ apenasAtivas: false });
  const { data: ctes = [] } = trpc.cte.list.useQuery({});

  const analisarIA = trpc.logistica.analisarAssertividade.useMutation({
    onSuccess: (data) => {
      setAnalise(typeof data.analise === 'string' ? data.analise : String(data.analise ?? ''));
      setCarregando(false);
    },
    onError: (e) => {
      toast.error(e.message);
      setCarregando(false);
    },
  });

  const handleAnalisar = (tipo: string) => {
    setCarregando(true);
    setAnalise(null);
    analisarIA.mutate({ tipo, pergunta });
  };

  // Métricas calculadas localmente
  const totalCotacoes = cotacoes.length;
  const concluidas = cotacoes.filter((c: any) => c.status === "enviada").length;
  const emAndamento = cotacoes.filter((c: any) => c.status === "aberta" || c.status === "cotando" || c.status === "selecao").length;
  const prontas = cotacoes.filter((c: any) => c.status === "cotada").length;
  const taxaConclusao = totalCotacoes > 0 ? Math.round((concluidas / totalCotacoes) * 100) : 0;

  // Ranking de transportadoras por uso
  const rankingTransp: Record<string, number> = {};
  cotacoes.forEach((c: any) => {
    const opcaoSelecionada = (c.opcoes ?? []).find((o: any) => o.selecionada === "sim");
    if (opcaoSelecionada?.transportadoraNome) {
      rankingTransp[opcaoSelecionada.transportadoraNome] = (rankingTransp[opcaoSelecionada.transportadoraNome] ?? 0) + 1;
    }
  });
  const rankingArr = Object.entries(rankingTransp)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Destinos mais frequentes
  const destinoMap: Record<string, number> = {};
  cotacoes.forEach((c: any) => {
    const dest = `${c.municipio ?? ""}/${c.estado ?? ""}`;
    if (c.municipio) destinoMap[dest] = (destinoMap[dest] ?? 0) + 1;
  });
  const topDestinos = Object.entries(destinoMap)
    .map(([dest, total]) => ({ dest, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const formatDate = (d: string | Date | null | undefined) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR");
  };

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
      {/* Header */}
      <PageHeader
        title="Assertividade Logística"
        description="Análise inteligente de cotações históricas e sugestões de melhoria"
        icon={Brain}
        iconColor={STATUS_COLORS.destaque}
      />

      {/* Cards de métricas gerais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <BarChart3 className="w-4 h-4" />Total Cotações
            </div>
            <p className="text-2xl font-bold">{totalCotacoes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />Taxa de Conclusão
            </div>
            <p className="text-2xl font-bold text-green-600">{taxaConclusao}%</p>
            <p className="text-xs text-muted-foreground">{concluidas} concluídas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Clock className="w-4 h-4 text-amber-500" />Em Andamento
            </div>
            <p className="text-2xl font-bold text-amber-600">{emAndamento}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <AlertTriangle className="w-4 h-4 text-blue-500" />Aguardando Envio
            </div>
            <p className="text-2xl font-bold text-blue-600">{prontas}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── DASHBOARD DE PRAZO DE EXPEDIÇÃO ── */}
      <Card className="border-2 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="w-5 h-5 text-blue-600" />
            Prazo de Expedição — Previsto vs. Real
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Compara a data de entrega prevista no Mubisys com a data real de despacho (quando o card vai para "Concluído").
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros de período */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">De</label>
              <Input type="date" value={filtroDe} onChange={e => setFiltroDe(e.target.value)} className="h-8 text-sm w-36" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Até</label>
              <Input type="date" value={filtroAte} onChange={e => setFiltroAte(e.target.value)} className="h-8 text-sm w-36" />
            </div>
            {(filtroDe || filtroAte) && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setFiltroDe(""); setFiltroAte(""); }}>
                Limpar filtro
              </Button>
            )}
          </div>

          {prazoLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando dados de prazo...
            </div>
          ) : !prazoStats || prazoStats.total === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Nenhum despacho com data prevista registrado ainda.</p>
              <p className="text-xs mt-1">Os dados aparecerão aqui conforme os cards forem movidos para "Concluído" e a data de entrega do Mubisys for preenchida.</p>
            </div>
          ) : (
            <>
              {/* KPIs de prazo */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-green-700 text-xs font-semibold mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> No Prazo
                  </div>
                  <p className="text-3xl font-bold text-green-700">{prazoStats.pctNoPrazo}%</p>
                  <p className="text-xs text-green-600 mt-0.5">{prazoStats.noPrazo} de {prazoStats.total}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-blue-700 text-xs font-semibold mb-1">
                    <ChevronUp className="w-3.5 h-3.5" /> Antecipados
                  </div>
                  <p className="text-3xl font-bold text-blue-700">{prazoStats.pctAntecipados}%</p>
                  <p className="text-xs text-blue-600 mt-0.5">{prazoStats.antecipados} de {prazoStats.total}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-red-700 text-xs font-semibold mb-1">
                    <ChevronDown className="w-3.5 h-3.5" /> Atrasados
                  </div>
                  <p className="text-3xl font-bold text-red-700">{prazoStats.pctAtrasados}%</p>
                  <p className="text-xs text-red-600 mt-0.5">{prazoStats.atrasados} de {prazoStats.total}</p>
                </div>
              </div>

              {/* Tabela de pedidos */}
              <div className="rounded-lg border border-gray-200">
                <Table className="text-xs">
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="text-gray-600">OS / ID</TableHead>
                      <TableHead className="text-gray-600">Destinatário</TableHead>
                      <TableHead className="text-gray-600">Material</TableHead>
                      <TableHead className="text-gray-600">Destino</TableHead>
                      <TableHead className="text-gray-600">Prev. Entrega</TableHead>
                      <TableHead className="text-gray-600">Data Despacho</TableHead>
                      <TableHead className="text-gray-600">Diferença</TableHead>
                      <TableHead className="text-gray-600">Situação</TableHead>
                      <TableHead className="text-gray-600">Retrabalho</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prazoStats.pedidos.map((p: any) => (
                      <TableRow key={p.id} className="hover:bg-gray-50">
                        <TableCell className="font-mono text-gray-700">
                          {p.empacotamentoPedidoNumero ? `OS #${p.empacotamentoPedidoNumero}` : `#${p.id}`}
                        </TableCell>
                        <TableCell className="text-gray-700 max-w-[140px] truncate">{p.destinatarioNome ?? "—"}</TableCell>
                        <TableCell className="text-gray-500 max-w-[100px] truncate">{p.tipoMaterial ?? "—"}</TableCell>
                        <TableCell className="text-gray-500">{p.municipio && p.estado ? `${p.municipio}/${p.estado}` : "—"}</TableCell>
                        <TableCell className="text-gray-700">{formatDate(p.dataEntregaPrevista)}</TableCell>
                        <TableCell className="text-gray-700">{formatDate(p.dataDespacho)}</TableCell>
                        <TableCell>
                          {p.diffDias === 0 ? (
                            <span className="flex items-center gap-1 text-green-700"><Minus className="w-3 h-3" /> No dia</span>
                          ) : p.diffDias < 0 ? (
                            <span className="flex items-center gap-1 text-blue-700"><ChevronUp className="w-3 h-3" /> {Math.abs(p.diffDias)}d antes</span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-700"><ChevronDown className="w-3 h-3" /> {p.diffDias}d atraso</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {p.situacao === "no_prazo" && <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">No Prazo</Badge>}
                          {p.situacao === "antecipado" && <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Antecipado</Badge>}
                          {p.situacao === "atrasado" && <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Atrasado</Badge>}
                        </TableCell>
                        <TableCell>
                          {p.situacao === "atrasado" ? (
                            <button
                              onClick={() => handleAbrirModalRetrabalho(p)}
                              className={`flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border transition-colors ${p.temRetrabalho ? "bg-orange-100 text-orange-800 border-orange-300 font-semibold" : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200"}`}
                            >
                              <Tag className="w-3 h-3" />
                              {p.temRetrabalho ? (p.tipoRetrabalho ?? "Com Retrabalho") : "Marcar"}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── DASHBOARD DE RETRABALHO NOS PEDIDOS ATRASADOS ── */}
      <Card className="border-2 border-orange-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="w-5 h-5 text-orange-600" />
            Retrabalho nos Pedidos Atrasados
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Identifica e classifica quais pedidos atrasados possuem retrabalho associado. Use o botão "Marcar" na coluna Retrabalho da tabela acima para etiquetar cada pedido.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {metricasRetLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando métricas de retrabalho...
            </div>
          ) : !metricasRet || metricasRet.totalAtrasados === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Nenhum pedido atrasado registrado ainda.</p>
              <p className="text-xs mt-1">Os dados aparecerão conforme os cards forem concluídos com atraso.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-red-700 text-xs font-semibold mb-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Total Atrasados
                  </div>
                  <p className="text-3xl font-bold text-red-700">{metricasRet.totalAtrasados}</p>
                  <p className="text-xs text-red-500 mt-0.5">pedidos</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-orange-700 text-xs font-semibold mb-1">
                    <Tag className="w-3.5 h-3.5" /> Com Retrabalho
                  </div>
                  <p className="text-3xl font-bold text-orange-700">{metricasRet.pctComRetrabalho}%</p>
                  <p className="text-xs text-orange-600 mt-0.5">{metricasRet.comRetrabalho} de {metricasRet.totalAtrasados}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-600 text-xs font-semibold mb-1">
                    <X className="w-3.5 h-3.5" /> Sem Retrabalho
                  </div>
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
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-400 rounded-full" style={{ width: `${item.pct}%` }} />
                          </div>
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
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-300 rounded-full" style={{ width: `${t.totalAtrasados > 0 ? 100 : 0}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-24 text-right">{t.totalAtrasados} atr. / {t.comRetrabalho} ret.</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {metricasRet.comRetrabalho > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Pedidos Atrasados com Retrabalho</h4>
                  <div className="rounded-lg border border-orange-200">
                    <Table className="text-xs">
                      <TableHeader className="bg-orange-50">
                        <TableRow>
                          <TableHead className="text-orange-700">OS / ID</TableHead>
                          <TableHead className="text-orange-700">Destinatário</TableHead>
                          <TableHead className="text-orange-700">Atraso</TableHead>
                          <TableHead className="text-orange-700">Tipo Retrabalho</TableHead>
                          <TableHead className="text-orange-700">Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metricasRet.lista.filter((p: any) => p.temRetrabalho).map((p: any) => (
                          <TableRow key={p.id} className="hover:bg-orange-50">
                            <TableCell className="font-mono text-gray-700">{p.empacotamentoPedidoNumero ? `OS #${p.empacotamentoPedidoNumero}` : `#${p.id}`}</TableCell>
                            <TableCell className="text-gray-700 max-w-[120px] truncate">{p.destinatarioNome ?? "—"}</TableCell>
                            <TableCell className="text-red-700 font-semibold">+{p.diffDias}d</TableCell>
                            <TableCell><Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">{p.tipoRetrabalho ?? "Não categorizado"}</Badge></TableCell>
                            <TableCell className="text-gray-500 max-w-[160px] truncate">{p.motivoRetrabalho ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
              <input type="checkbox" id="temRetrabalho" checked={formTemRetrabalho} onChange={e => setFormTemRetrabalho(e.target.checked)} className="w-4 h-4 accent-orange-600" />
              <label htmlFor="temRetrabalho" className="text-sm font-medium text-orange-900 cursor-pointer">Este pedido atrasado possui retrabalho associado</label>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ranking de transportadoras */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Truck className="w-4 h-4" />Transportadoras Mais Selecionadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rankingArr.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhuma transportadora selecionada ainda</p>
            ) : (
              <div className="space-y-2">
                {rankingArr.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="w-6 h-6 flex items-center justify-center text-xs p-0">{i + 1}</Badge>
                      <span className="text-sm">{item.nome}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.round((item.total / (rankingArr[0]?.total || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{item.total}x</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top destinos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4" />Destinos Mais Frequentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topDestinos.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum destino registrado ainda</p>
            ) : (
              <div className="space-y-2">
                {topDestinos.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                      <span className="text-sm">{item.dest}</span>
                    </div>
                    <Badge variant="secondary">{item.total} cotações</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Análise IA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            Análise Inteligente com IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecione um tipo de análise ou faça uma pergunta específica sobre as cotações e transportadoras.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="h-auto py-3 flex flex-col gap-1 text-left"
              disabled={carregando}
              onClick={() => handleAnalisar("desempenho")}
            >
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-sm">Desempenho Geral</span>
              <span className="text-xs text-muted-foreground font-normal">Análise de eficiência e gargalos</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-3 flex flex-col gap-1 text-left"
              disabled={carregando}
              onClick={() => handleAnalisar("transportadoras")}
            >
              <Truck className="w-4 h-4 text-green-500" />
              <span className="font-medium text-sm">Transportadoras</span>
              <span className="text-xs text-muted-foreground font-normal">Comparativo e recomendações</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-3 flex flex-col gap-1 text-left"
              disabled={carregando}
              onClick={() => handleAnalisar("oportunidades")}
            >
              <Brain className="w-4 h-4 text-purple-500" />
              <span className="font-medium text-sm">Oportunidades</span>
              <span className="text-xs text-muted-foreground font-normal">Sugestões de melhoria</span>
            </Button>
          </div>

          <div className="flex gap-2">
            <Textarea
              placeholder="Ou faça uma pergunta específica: 'Qual transportadora tem melhor custo-benefício para SP?' ..."
              value={pergunta}
              onChange={e => setPergunta(e.target.value)}
              rows={2}
              className="text-sm"
            />
            <Button
              className="shrink-0"
              disabled={carregando || !pergunta.trim()}
              onClick={() => handleAnalisar("pergunta")}
            >
              {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            </Button>
          </div>

          {carregando && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analisando dados com IA...
            </div>
          )}

          {analise && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-semibold text-purple-800">Análise da IA</span>
              </div>
              <div className="text-sm text-purple-900 whitespace-pre-wrap">{analise}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
