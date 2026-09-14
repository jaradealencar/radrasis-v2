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
  ChevronLeft, ChevronRight, Send, CheckCircle2, DollarSign,
  UserPlus, TrendingUp, AlertTriangle, Mail, Target,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";

// ─── Helpers de data (mesmo padrão de CrmAuditoria.tsx) ──────────────────────
function fmtDateISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDateBr(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function getWeekRange(offset: number) {
  const now = new Date();
  const day = now.getDay(); // 0=dom
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7 + offset * 7); // -7: semana passada é o offset "0" (semana já concluída)
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { inicio: fmtDateISO(monday), fim: fmtDateISO(sunday) };
}

function getDiaRange(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() - 1 + offset); // offset 0 = ontem (mesmo período do relatório automático)
  const iso = fmtDateISO(d);
  return { inicio: iso, fim: iso };
}

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function VariacaoBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-gray-400">sem base de comparação</span>;
  const positivo = pct >= 0;
  return (
    <Badge className={positivo ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}>
      {positivo ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}% vs. média do mês
    </Badge>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CrmMonitoramentoUso() {
  const [tipo, setTipo] = useState<"dia" | "semana">("dia");
  const [offset, setOffset] = useState(0); // dia: 0=ontem, -1=antes de ontem...; semana: 0=semana passada completa

  const range = useMemo(() => (tipo === "dia" ? getDiaRange(offset) : getWeekRange(offset)), [tipo, offset]);

  const { data, isLoading } = trpc.crm.getRelatorioMonitoramento.useQuery({
    dataInicio: range.inicio,
    dataFim: range.fim,
    tipo,
  });

  const rotuloPeriodo = range.inicio === range.fim
    ? fmtDateBr(range.inicio)
    : `${fmtDateBr(range.inicio)} a ${fmtDateBr(range.fim)}`;

  const unidade = tipo === "dia" ? "dia" : "semana";
  const podeAvancar = offset < 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Monitoramento de Uso do CRM"
        description="Números comerciais do período (MubiSys) e aderência dos vendedores ao CRM — quem clicou nas faixas, quem marcou proposta ganha/perdida."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
          <button
            onClick={() => { setTipo("dia"); setOffset(0); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${tipo === "dia" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
          >Diário</button>
          <button
            onClick={() => { setTipo("semana"); setOffset(0); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${tipo === "semana" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
          >Semanal</button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setOffset(o => o - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[160px] text-center">
            {tipo === "dia" ? "Dia" : "Semana"}: {rotuloPeriodo}
          </span>
          <Button variant="outline" size="sm" onClick={() => setOffset(o => o + 1)} disabled={!podeAvancar}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="w-3.5 h-3.5" />
          Um resumo como este chega por e-mail todo {tipo === "dia" ? "dia" : "início de semana"}, automaticamente.
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {data && (
        <>
          {/* ── Comercial ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Send className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{data.comercial.propostasEnviadas}</div>
                  <div className="text-xs text-muted-foreground">Propostas enviadas</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{data.comercial.fechamentos}</div>
                  <div className="text-xs text-muted-foreground">Fechamentos</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="text-2xl font-bold">{fmtMoeda(data.comercial.valorFaturado)}</div>
                  <div className="text-xs text-muted-foreground">Valor faturado</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <UserPlus className="w-5 h-5 text-violet-500" />
                <div>
                  <div className="text-2xl font-bold">{data.comercial.propostasNovosClientes}</div>
                  <div className="text-xs text-muted-foreground">De clientes novos</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Como este {unidade} se compara ao resto do mês
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span>Valor faturado: <b>{fmtMoeda(data.comercial.valorFaturado)}</b> (média do mês: {fmtMoeda(data.comercial.comparativoValorFaturado.mediaPeriodo)})</span>
                <div className="flex items-center gap-2">
                  <VariacaoBadge pct={data.comercial.comparativoValorFaturado.percentualVsMedia} />
                  <span className="text-xs text-muted-foreground">
                    {data.comercial.comparativoValorFaturado.posicaoRanking}º de {data.comercial.comparativoValorFaturado.totalComparados}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span>Propostas enviadas: <b>{data.comercial.propostasEnviadas}</b> (média do mês: {data.comercial.comparativoPropostasEnviadas.mediaPeriodo.toFixed(1)})</span>
                <div className="flex items-center gap-2">
                  <VariacaoBadge pct={data.comercial.comparativoPropostasEnviadas.percentualVsMedia} />
                  <span className="text-xs text-muted-foreground">
                    {data.comercial.comparativoPropostasEnviadas.posicaoRanking}º de {data.comercial.comparativoPropostasEnviadas.totalComparados}
                  </span>
                </div>
              </div>
              <div className="pt-1 text-xs text-muted-foreground">
                Taxa de conversão do período: <b>{data.comercial.taxaConversaoPct != null ? `${data.comercial.taxaConversaoPct.toFixed(0)}%` : "—"}</b>
              </div>
            </CardContent>
          </Card>

          {/* ── Uso do CRM ────────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Uso do CRM por vendedor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.usoCrm.vendedoresSemAtividade.length > 0 ? (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Sem nenhuma atividade no CRM neste {unidade}: <b>{data.usoCrm.vendedoresSemAtividade.join(", ")}</b></span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4" /> Todos os vendedores registraram alguma atividade no CRM neste {unidade}.
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-center">Contatos registrados</TableHead>
                    <TableHead className="text-center">Ganhas</TableHead>
                    <TableHead className="text-center">Perdidas</TableHead>
                    <TableHead className="text-center">Dias ativos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.usoCrm.vendedores.map(v => (
                    <TableRow key={v.vendedor} className={v.semAtividade ? "bg-red-50" : ""}>
                      <TableCell className={v.semAtividade ? "font-semibold text-red-700" : "font-medium"}>
                        {v.vendedor} {v.semAtividade && "⚠️"}
                      </TableCell>
                      <TableCell className="text-center">{v.contatosRegistrados}</TableCell>
                      <TableCell className="text-center">{v.ganhas}</TableCell>
                      <TableCell className="text-center">{v.perdidas}</TableCell>
                      <TableCell className="text-center">{v.diasComAtividade}/{v.totalDias}</TableCell>
                    </TableRow>
                  ))}
                  {data.usoCrm.vendedores.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                        Nenhum vendedor com propostas ou atividade neste período.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">
                "Contatos registrados" = cliques nos quadradinhos das faixas de follow-up (Faixa 1/2/3).
              </p>
            </CardContent>
          </Card>

          {/* ── Sugestões de Contato ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4" /> Sugestões de Contato — reengajamento da carteira
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                  <div className="text-xl font-bold text-indigo-700">{data.sugestoesContato.pendentesTotal}</div>
                  <div className="text-xs text-indigo-600">Clientes parados pendentes de contato</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div className="text-xl font-bold text-green-700">{data.sugestoesContato.contatadasPeriodo}</div>
                  <div className="text-xs text-green-600">Contatados neste {unidade}</div>
                </div>
              </div>

              {data.sugestoesContato.porVendedor.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-center">Pendentes</TableHead>
                      <TableHead className="text-center">Contatados no {unidade}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sugestoesContato.porVendedor.map(v => (
                      <TableRow key={v.vendedor}>
                        <TableCell className="font-medium">{v.vendedor}</TableCell>
                        <TableCell className="text-center">{v.pendentes}</TableCell>
                        <TableCell className="text-center">{v.contatadasPeriodo}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {data.sugestoesContato.topPendentes.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-semibold text-muted-foreground">Maior potencial parado, priorize:</p>
                  {data.sugestoesContato.topPendentes.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm bg-gray-50 border rounded-lg px-3 py-2">
                      <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 flex-shrink-0">Score {s.score}</Badge>
                      <div className="min-w-0">
                        <span className="font-medium">{s.empresa}</span>
                        {s.vendedor && <span className="text-xs text-muted-foreground"> · {s.vendedor}</span>}
                        <p className="text-xs text-muted-foreground">{s.motivo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
