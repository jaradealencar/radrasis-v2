import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  CheckCircle2, XCircle, AlertTriangle, TrendingUp, Users,
  Calendar, Clock, Zap, Target, Trash2, ChevronLeft, ChevronRight,
  Activity, Info
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=dom
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    inicio: monday.toISOString().split("T")[0],
    fim: sunday.toISOString().split("T")[0],
  };
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatDateShort(iso: string) {
  const [, m, d] = iso.split("-");
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dt = new Date(iso + "T12:00:00Z");
  return `${dias[dt.getUTCDay()]} ${d}/${m}`;
}

function aderenciaBadge(pct: number) {
  if (pct >= 80) return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">{pct}%</Badge>;
  if (pct >= 50) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{pct}%</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200">{pct}%</Badge>;
}

function riscoBadge(risco: string) {
  if (risco === "critico") return <Badge className="bg-red-100 text-red-800 border-red-200">🔴 Crítico</Badge>;
  if (risco === "alto") return <Badge className="bg-orange-100 text-orange-800 border-orange-200">🟠 Alto</Badge>;
  if (risco === "medio") return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">🟡 Médio</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-gray-200">⚪ Baixo</Badge>;
}

// ─── Componente de célula do calendário ──────────────────────────────────────
function CelulaRotina({ manha, tarde, acoes }: { manha: boolean; tarde: boolean; acoes: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
      <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${manha ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-400"}`}>
        {manha ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
        <span>M</span>
      </div>
      <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${tarde ? "bg-blue-100 text-blue-700" : "bg-red-50 text-red-400"}`}>
        {tarde ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
        <span>T</span>
      </div>
      {acoes > 0 && <span className="text-[10px] text-gray-400">{acoes} ações</span>}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CrmAuditoria() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [drillVendedor, setDrillVendedor] = useState<string | null>(null);
  const [drillDia, setDrillDia] = useState<string | null>(null);

  const range = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

  const { data, isLoading } = trpc.crm.getAuditoria.useQuery({
    dataInicio: range.inicio,
    dataFim: range.fim,
  });

  const { data: logDia } = trpc.crm.getLogDia.useQuery(
    { vendedor: drillVendedor ?? "", data: drillDia ?? "" },
    { enabled: !!drillVendedor && !!drillDia }
  );

  const diasSemana = data?.dias ?? [];
  const vendedores = data?.vendedores ?? [];

  // ─── Cores por vendedor ───────────────────────────────────────────────────
  const coresVendedor: Record<string, string> = {
    "Karize Boaventura": "text-violet-700",
    "Letícia Carozzo": "text-teal-700",
    "Sthefanie Louis": "text-rose-700",
  };
  function corVendedor(v: string) {
    return coresVendedor[v] ?? "text-slate-700";
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            Auditoria do CRM
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Controle de rotina comercial — manhã e tarde — por vendedor
          </p>
        </div>
        {/* Navegação de semana */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(o => o - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-slate-700 min-w-[180px] text-center">
            <Calendar className="w-3.5 h-3.5 inline mr-1 text-indigo-500" />
            {formatDate(range.inicio)} – {formatDate(range.fim)}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(o => o + 1)} disabled={weekOffset >= 0}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-indigo-600" onClick={() => setWeekOffset(0)}>
              Hoje
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mr-3" />
          Carregando dados de auditoria...
        </div>
      )}

      {!isLoading && data && (
        <>
          {/* BLOCO G — Diagnóstico executivo (destaque no topo) */}
          <Card className={`border-l-4 ${data.blocoG.startsWith("⚠️") || data.blocoG.startsWith("🚨") ? "border-l-red-500 bg-red-50" : data.blocoG.startsWith("🚨") ? "border-l-orange-500 bg-orange-50" : data.blocoG.startsWith("✅") ? "border-l-emerald-500 bg-emerald-50" : "border-l-amber-500 bg-amber-50"}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 mt-0.5 text-slate-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Diagnóstico Executivo</p>
                  <p className="text-sm text-slate-800 font-medium">{data.blocoG}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BLOCO A — Calendário de rotina */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                Bloco A — Cumprimento da Rotina (Manhã / Tarde)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vendedores.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Nenhuma atividade registrada nesta semana.</p>
              ) : (
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px]">Vendedor</TableHead>
                        {diasSemana.map(d => (
                          <TableHead key={d} className="text-center">
                            {formatDateShort(d)}
                          </TableHead>
                        ))}
                        <TableHead className="text-center">Aderência</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.blocoA.map(row => (
                        <TableRow key={row.vendedor}>
                          <TableCell className={`font-semibold ${corVendedor(row.vendedor)}`}>
                            {row.vendedor}
                          </TableCell>
                          {diasSemana.map(d => {
                            const cel = row.dias[d] ?? { manha: false, tarde: false, acoes: 0 };
                            return (
                              <TableCell key={d} className="text-center">
                                <button
                                  onClick={() => { setDrillVendedor(row.vendedor); setDrillDia(d); }}
                                  className="hover:opacity-80 transition-opacity"
                                  title={`Ver log de ${row.vendedor} em ${formatDate(d)}`}
                                >
                                  <CelulaRotina manha={cel.manha} tarde={cel.tarde} acoes={cel.acoes} />
                                </button>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center">
                            {aderenciaBadge(row.aderencia)}
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {row.manhasOk}M / {row.tardesOk}T
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              )}
              <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Clique em qualquer célula para ver o log detalhado do dia.
                <span className="ml-2 font-medium text-emerald-600">M = Manhã (06h–12h)</span>
                <span className="ml-2 font-medium text-blue-600">T = Tarde (12h–18h)</span>
              </p>
            </CardContent>
          </Card>

          {/* Drill-down: log do dia */}
          {drillVendedor && drillDia && logDia && (
            <Card className="border-indigo-200 bg-indigo-50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    Log de {drillVendedor} — {formatDate(drillDia)}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => { setDrillVendedor(null); setDrillDia(null); }}>
                    Fechar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {logDia.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma atividade registrada neste dia.</p>
                ) : (
                  <div className="space-y-1.5">
                    {logDia.map((l, i) => (
                      <div key={i} className="flex items-start gap-3 bg-white rounded-lg px-3 py-2 border border-indigo-100">
                        <span className="text-xs font-mono text-indigo-600 min-w-[40px]">{l.horaBrasilia}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${l.turno === "manha" ? "bg-emerald-100 text-emerald-700" : l.turno === "tarde" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                          {l.turno === "manha" ? "Manhã" : l.turno === "tarde" ? "Tarde" : "Noite"}
                        </span>
                        <span className="text-xs font-semibold text-slate-700">{l.acao}</span>
                        {l.empresa && <span className="text-xs text-slate-500">{l.empresa}</span>}
                        {l.detalhe && <span className="text-xs text-slate-400 italic">{l.detalhe}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* BLOCOS B, C, F — Grid de 3 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* BLOCO B — Volume por faixa */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-teal-500" />
                  Bloco B — Contatos por Faixa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-center">F1</TableHead>
                      <TableHead className="text-center">F2</TableHead>
                      <TableHead className="text-center">F3</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.blocoB.map(row => (
                      <TableRow key={row.vendedor}>
                        <TableCell className={`text-xs font-semibold ${corVendedor(row.vendedor)}`}>
                          {row.vendedor.split(" ")[0]}
                        </TableCell>
                        <TableCell className="text-center text-xs">{row.faixa1}</TableCell>
                        <TableCell className="text-center text-xs">{row.faixa2}</TableCell>
                        <TableCell className="text-center text-xs">{row.faixa3}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">{row.total}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.blocoB.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-xs text-slate-400">Sem dados</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                <p className="text-[10px] text-slate-400 mt-2">F1=1º contato · F2=2º contato · F3=3º+</p>
              </CardContent>
            </Card>

            {/* BLOCO C — Descartes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  Bloco C — Limpeza de Base
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.blocoC.map(row => (
                    <div key={row.vendedor} className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${corVendedor(row.vendedor)}`}>
                        {row.vendedor.split(" ")[0]}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${row.descartes >= 5 ? "bg-emerald-500" : row.descartes >= 2 ? "bg-amber-400" : "bg-red-400"}`}
                            style={{ width: `${Math.min(100, (row.descartes / 10) * 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold min-w-[24px] text-right ${row.descartes >= 5 ? "text-emerald-600" : row.descartes >= 2 ? "text-amber-600" : "text-red-600"}`}>
                          {row.descartes}
                        </span>
                        {row.descartes >= 5 ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                    </div>
                  ))}
                  {data.blocoC.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">Sem dados</p>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-3">Meta: ≥ 5 descartes/semana por vendedor</p>
              </CardContent>
            </Card>

            {/* BLOCO F — Ranking */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  Bloco F — Ranking de Engajamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.blocoF.map((row, i) => (
                    <div key={row.vendedor} className="flex items-center gap-3">
                      <span className="text-lg font-bold text-slate-300 min-w-[24px]">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                      </span>
                      <div className="flex-1">
                        <div className={`text-sm font-semibold ${corVendedor(row.vendedor)}`}>
                          {row.vendedor.split(" ")[0]}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {row.totalContatos} contatos · {row.totalDescartes} descartes · {row.aderencia}% aderência
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs font-bold">
                        {row.score} pts
                      </Badge>
                    </div>
                  ))}
                  {data.blocoF.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">Sem dados</p>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-3">Score = contatos×2 + descartes + aderência%</p>
              </CardContent>
            </Card>
          </div>

          {/* BLOCO D — Propostas no limbo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Bloco D — Propostas no Limbo (sem contato há &gt; 3 dias)
                {data.blocoD.length > 0 && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 ml-1">{data.blocoD.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.blocoD.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-600 py-4">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Nenhuma proposta no limbo. Excelente!</span>
                </div>
              ) : (
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Orçamento</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-center">Dias sem contato</TableHead>
                        <TableHead className="text-center">Risco</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.blocoD.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs text-slate-500">{row.orcamentoId}</TableCell>
                          <TableCell className="font-medium text-slate-700">{row.empresa}</TableCell>
                          <TableCell className={`font-semibold text-xs ${corVendedor(row.vendedor)}`}>{row.vendedor.split(" ")[0]}</TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${row.diasSemContato >= 16 ? "text-red-600" : row.diasSemContato >= 7 ? "text-orange-600" : "text-amber-600"}`}>
                              {row.diasSemContato}d
                            </span>
                          </TableCell>
                          <TableCell className="text-center">{riscoBadge(row.risco)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              )}
            </CardContent>
          </Card>

          {/* BLOCO E — Velocidade suspeita */}
          <Card className={data.blocoE.length > 0 ? "border-red-200 bg-red-50" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className={`w-4 h-4 ${data.blocoE.length > 0 ? "text-red-500" : "text-slate-400"}`} />
                Bloco E — Alertas de Velocidade Suspeita
                {data.blocoE.length > 0 && (
                  <Badge className="bg-red-100 text-red-800 border-red-200 ml-1">{data.blocoE.length} alerta{data.blocoE.length > 1 ? "s" : ""}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.blocoE.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-600 py-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Nenhum alerta de velocidade suspeita nesta semana.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.blocoE.map((alerta, i) => (
                    <div key={i} className="bg-white border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className={`font-bold text-sm ${corVendedor(alerta.vendedor)}`}>{alerta.vendedor}</span>
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">{alerta.qtdAcoes} ações em &lt;10min</Badge>
                      </div>
                      <p className="text-xs text-slate-600">
                        <span className="font-medium">Horário:</span> {new Date(alerta.dataHora).toLocaleString("pt-BR")} ·{" "}
                        <span className="font-medium">Intervalo médio:</span> {alerta.intervaloMedioSeg}s entre ações
                      </p>
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        ⚠️ Possível preenchimento aleatório — recomenda-se verificação imediata.
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-3">Gatilho: ≥ 15 ações registradas em menos de 10 minutos</p>
            </CardContent>
          </Card>

          {/* Resumo de KPIs no rodapé */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Total de Ações",
                value: data.blocoF.reduce((s, r) => s + r.totalContatos + r.totalDescartes, 0),
                icon: <Activity className="w-4 h-4 text-indigo-500" />,
                color: "text-indigo-700",
              },
              {
                label: "Aderência Média",
                value: data.blocoA.length > 0
                  ? Math.round(data.blocoA.reduce((s, r) => s + r.aderencia, 0) / data.blocoA.length) + "%"
                  : "—",
                icon: <Target className="w-4 h-4 text-teal-500" />,
                color: "text-teal-700",
              },
              {
                label: "Propostas no Limbo",
                value: data.blocoD.length,
                icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
                color: data.blocoD.length > 5 ? "text-red-700" : "text-amber-700",
              },
              {
                label: "Alertas Suspeitos",
                value: data.blocoE.length,
                icon: <Zap className="w-4 h-4 text-rose-500" />,
                color: data.blocoE.length > 0 ? "text-red-700" : "text-emerald-700",
              },
            ].map(kpi => (
              <Card key={kpi.label} className="bg-white">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    {kpi.icon}
                    <span className="text-xs text-slate-500">{kpi.label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {!isLoading && !data && (
        <div className="text-center py-12 text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum dado disponível para o período selecionado.</p>
        </div>
      )}
    </div>
  );
}
