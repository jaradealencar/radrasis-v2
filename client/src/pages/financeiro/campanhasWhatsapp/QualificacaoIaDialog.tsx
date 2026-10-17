import { useMemo, useState } from "react";
import {
  Bot,
  Brain,
  Download,
  Flame,
  MessageSquareQuote,
  MousePointerClick,
  Snowflake,
  Target,
  Thermometer,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { exportRowsToXlsx } from "@/lib/exportXlsx";
import { fmtNum, fmtPct } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import KpiCard from "@/components/KpiCard";
import ChartTooltip from "@/components/ChartTooltip";
import {
  COR_CLUSTER,
  COR_FAIXA_ICP,
  CLUSTERS_LEAD,
  MOTIVOS_OBJECAO,
  ROTULO_CLUSTER,
  ROTULO_FAIXA_ICP,
  ROTULO_MOTIVO_OBJECAO,
  ROTULO_PERFIL_INTERLOCUTOR,
  type ClusterLead,
  type MotivoObjecao,
} from "@shared/campanhas-whatsapp-ia";
import { formatarTelefone } from "@shared/campanhas-whatsapp";
import type { CampanhaLinha } from "./comuns";

interface Props {
  /** `null` = fechado. */
  campanha: CampanhaLinha | null;
  onClose: () => void;
}

const TODOS = "__todos__";

/**
 * Dashboard de qualificação de leads por IA (Gemini): KPIs de engajamento real, distribuição de clusters
 * semânticos, diagnóstico de objeções, heatmap de janelas de atividade e tabela de leads com filtro/export
 * para retargeting. Ver docs/campanhas-whatsapp-ia.md.
 */
export default function QualificacaoIaDialog({ campanha, onClose }: Props) {
  const [filtroCluster, setFiltroCluster] = useState<
    ClusterLead | typeof TODOS
  >(TODOS);
  const [filtroObjecao, setFiltroObjecao] = useState<
    MotivoObjecao | typeof TODOS
  >(TODOS);

  const campanhaId = campanha?.id ?? 0;
  const habilitado = !!campanha;

  const kpis = trpc.campanhasWhatsapp.kpisEngajamento.useQuery(
    { campanhaId },
    { enabled: habilitado }
  );
  const stats = trpc.campanhasWhatsapp.estatisticasQualificacao.useQuery(
    { campanhaId },
    { enabled: habilitado }
  );
  const leads = trpc.campanhasWhatsapp.listarLeadsQualificados.useQuery(
    {
      campanhaId,
      cluster: filtroCluster === TODOS ? undefined : filtroCluster,
      motivoObjecao: filtroObjecao === TODOS ? undefined : filtroObjecao,
    },
    { enabled: habilitado }
  );

  const dadosClusters = useMemo(
    () =>
      (stats.data?.clusters ?? [])
        .filter(c => c.total > 0)
        .map(c => ({ ...c, label: ROTULO_CLUSTER[c.cluster] })),
    [stats.data]
  );
  const dadosObjecoes = useMemo(
    () =>
      (stats.data?.objecoes ?? []).map(o => ({
        ...o,
        label: ROTULO_MOTIVO_OBJECAO[o.motivo],
      })),
    [stats.data]
  );

  function exportar() {
    if (!leads.data || !campanha) return;
    exportRowsToXlsx(
      leads.data,
      [
        { header: "Nome", valor: l => l.nome ?? "" },
        { header: "Telefone", valor: l => formatarTelefone(l.telefone) },
        {
          header: "Cluster",
          valor: l => ROTULO_CLUSTER[l.cluster as ClusterLead],
        },
        { header: "Nível de interesse", valor: l => l.nivelInteresse },
        { header: "ICP Fit Score", valor: l => l.icpFitScore },
        {
          header: "Perfil",
          valor: l =>
            ROTULO_PERFIL_INTERLOCUTOR[
              l.perfilInterlocutor as keyof typeof ROTULO_PERFIL_INTERLOCUTOR
            ],
        },
        {
          header: "Resumo da intenção",
          valor: l => l.resumoIntencao,
          largura: 40,
        },
        {
          header: "Palavras-chave",
          valor: l => l.palavrasChave.join(", "),
          largura: 30,
        },
        {
          header: "Objeção",
          valor: l => ROTULO_MOTIVO_OBJECAO[l.motivoObjecao as MotivoObjecao],
        },
        {
          header: "Resumo da objeção",
          valor: l => l.resumoObjecao ?? "",
          largura: 30,
        },
      ],
      `leads-${campanha.nome.replace(/\W+/g, "-")}.xlsx`,
      "Leads qualificados"
    );
  }

  return (
    <Dialog open={!!campanha} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain size={18} className="text-violet-600" /> Qualificação de
            leads por IA
          </DialogTitle>
          <DialogDescription>
            {campanha?.nome} — análise semântica das respostas via Gemini.
          </DialogDescription>
        </DialogHeader>

        {!campanha ? null : kpis.isLoading || stats.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-7 text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Bloco 1: KPIs de engajamento real */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <KpiCard
                variant="border"
                label="Total disparado"
                value={fmtNum(kpis.data?.totalDisparado ?? 0)}
                icon={Target}
                color="#1e6fd9"
              />
              <KpiCard
                variant="border"
                label="Resposta humana"
                value={fmtNum(kpis.data?.respostaHumana ?? 0)}
                icon={MessageSquareQuote}
                color="#22c55e"
                sub={`${fmtPct(kpis.data?.taxaRespostaHumanaPct ?? 0)} dos disparos`}
              />
              <KpiCard
                variant="border"
                label="Filtrado como bot"
                value={fmtNum(kpis.data?.respostaBot ?? 0)}
                icon={Bot}
                color="#64748b"
                tooltip="Resposta em menos de 4s após o disparo (via WTS/API) ou texto batendo na blacklist semântica de auto-responder."
              />
              <KpiCard
                variant="border"
                label="Clique em botão/CTA"
                value={fmtNum(kpis.data?.cliquesBotaoCta ?? 0)}
                icon={MousePointerClick}
                color="#8b5cf6"
                sub={`${fmtPct(kpis.data?.taxaCliqueCtaPct ?? 0)} dos disparos`}
              />
              <KpiCard
                variant="border"
                label="Índice de profundidade"
                value={fmtPct(kpis.data?.indiceProfundidadePct ?? 0)}
                icon={Brain}
                color="#f59e0b"
                tooltip="Percentual de leads com resposta humana que mantiveram 3 ou mais trocas de mensagens."
              />
            </div>

            {stats.data && stats.data.tempoMedioReacaoSegundos !== null && (
              <div className="rounded-lg border bg-sky-50 border-sky-200 px-4 py-2.5 text-sm text-sky-900 flex items-center justify-between gap-3 flex-wrap">
                <span>
                  ⏱️ Tempo médio de reação comercial (Lead Velocity):{" "}
                  <strong>
                    {formatarDuracao(stats.data.tempoMedioReacaoSegundos)}
                  </strong>
                </span>
                {stats.data.melhorFaixaConversao && (
                  <span>
                    📅 Melhor horário de conversão desta campanha:{" "}
                    <strong>{stats.data.melhorFaixaConversao.faixa}</strong> (
                    {stats.data.melhorFaixaConversao.total} respostas)
                  </span>
                )}
              </div>
            )}

            {/* Bloco 2: distribuição de clusters semânticos */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Distribuição de clusters semânticos
                </h3>
                {dadosClusters.length === 0 ? (
                  <p className="text-xs text-slate-400 py-10 text-center">
                    Nenhum lead qualificado ainda.
                  </p>
                ) : (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dadosClusters}
                          dataKey="total"
                          nameKey="label"
                          innerRadius={42}
                          outerRadius={78}
                          paddingAngle={2}
                        >
                          {dadosClusters.map(d => (
                            <Cell
                              key={d.cluster}
                              fill={COR_CLUSTER[d.cluster]}
                            />
                          ))}
                        </Pie>
                        <RTooltip content={<ChartTooltip />} />
                        <Legend
                          verticalAlign="bottom"
                          height={48}
                          wrapperStyle={{ fontSize: 11 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Bloco: diagnóstico de objeções */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Diagnóstico de objeções
                </h3>
                {dadosObjecoes.length === 0 ? (
                  <p className="text-xs text-slate-400 py-10 text-center">
                    Nenhuma objeção identificada ainda.
                  </p>
                ) : (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dadosObjecoes}
                        layout="vertical"
                        margin={{ left: 8, right: 16 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="label"
                          width={130}
                          tick={{ fontSize: 11 }}
                        />
                        <RTooltip content={<ChartTooltip />} />
                        <Bar
                          dataKey="total"
                          fill="#f59e0b"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {stats.data && stats.data.frasesObjecao.length > 0 && (
                  <div className="mt-3 space-y-1 max-h-28 overflow-y-auto border-t pt-2">
                    {stats.data.frasesObjecao.slice(0, 6).map((f, i) => (
                      <p key={i} className="text-xs text-slate-600">
                        <Badge variant="outline" className="mr-1.5">
                          {ROTULO_MOTIVO_OBJECAO[f.motivo as MotivoObjecao]}
                        </Badge>
                        "{f.resumo}"
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Heatmap de janelas de atividade */}
            {stats.data && stats.data.heatmap.length > 0 && (
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Mapa de calor — janelas de resposta humana
                </h3>
                <HeatmapAtividade celulas={stats.data.heatmap} />
              </div>
            )}

            {/* Tabela de leads + filtros + export (retargeting) */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  Leads qualificados ({fmtNum(leads.data?.length ?? 0)})
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select
                    value={filtroCluster}
                    onValueChange={v =>
                      setFiltroCluster(v as typeof filtroCluster)
                    }
                  >
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue placeholder="Cluster" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODOS}>Todos os clusters</SelectItem>
                      {CLUSTERS_LEAD.map(c => (
                        <SelectItem key={c} value={c}>
                          {ROTULO_CLUSTER[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filtroObjecao}
                    onValueChange={v =>
                      setFiltroObjecao(v as typeof filtroObjecao)
                    }
                  >
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue placeholder="Objeção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODOS}>Todos os motivos</SelectItem>
                      {MOTIVOS_OBJECAO.map(m => (
                        <SelectItem key={m} value={m}>
                          {ROTULO_MOTIVO_OBJECAO[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={exportar}
                    disabled={!leads.data?.length}
                  >
                    <Download size={13} /> Exportar p/ retargeting
                  </Button>
                </div>
              </div>

              {leads.isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner className="size-6 text-muted-foreground" />
                </div>
              ) : !leads.data?.length ? (
                <p className="text-xs text-slate-400 py-8 text-center">
                  Nenhum lead casa com os filtros atuais.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contato</TableHead>
                        <TableHead>Cluster</TableHead>
                        <TableHead>ICP</TableHead>
                        <TableHead>Perfil</TableHead>
                        <TableHead>Resumo da intenção</TableHead>
                        <TableHead>Palavras-chave</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.data.map(l => (
                        <TableRow key={l.id}>
                          <TableCell>
                            <div className="font-medium">{l.nome || "—"}</div>
                            <div className="text-xs text-slate-500">
                              {formatarTelefone(l.telefone)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className="border"
                              style={{
                                backgroundColor: `${COR_CLUSTER[l.cluster as ClusterLead]}1a`,
                                color: COR_CLUSTER[l.cluster as ClusterLead],
                                borderColor: `${COR_CLUSTER[l.cluster as ClusterLead]}40`,
                              }}
                            >
                              {ROTULO_CLUSTER[l.cluster as ClusterLead]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <IcpBadge
                              score={l.icpFitScore}
                              faixa={l.faixaIcp}
                            />
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {
                              ROTULO_PERFIL_INTERLOCUTOR[
                                l.perfilInterlocutor as keyof typeof ROTULO_PERFIL_INTERLOCUTOR
                              ]
                            }
                          </TableCell>
                          <TableCell className="text-xs max-w-[220px]">
                            {l.resumoIntencao}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {l.palavrasChave.slice(0, 4).map((p, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {p}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IcpBadge({
  score,
  faixa,
}: {
  score: number;
  faixa: "quente" | "morno" | "frio";
}) {
  const Icon =
    faixa === "quente" ? Flame : faixa === "morno" ? Thermometer : Snowflake;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium"
      style={{ color: COR_FAIXA_ICP[faixa] }}
    >
      <Icon size={13} /> {score}{" "}
      <span className="text-slate-400">
        ({ROTULO_FAIXA_ICP[faixa].replace(/^\S+\s/, "")})
      </span>
    </span>
  );
}

function formatarDuracao(segundos: number): string {
  if (segundos < 60) return `${segundos}s`;
  if (segundos < 3600) return `${Math.round(segundos / 60)} min`;
  if (segundos < 86400) return `${(segundos / 3600).toFixed(1)} h`;
  return `${(segundos / 86400).toFixed(1)} dias`;
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function HeatmapAtividade({
  celulas,
}: {
  celulas: Array<{ diaSemana: number; hora: number; total: number }>;
}) {
  const porCelula = new Map<string, number>(
    celulas.map(c => [`${c.diaSemana}-${c.hora}`, c.total])
  );
  const max = Math.max(1, ...celulas.map(c => c.total));
  const horas = Array.from({ length: 24 }, (_, h) => h);

  return (
    <div className="overflow-x-auto">
      <div
        className="inline-grid gap-0.5"
        style={{ gridTemplateColumns: `32px repeat(24, 18px)` }}
      >
        <div />
        {horas.map(h => (
          <div key={h} className="text-[9px] text-slate-400 text-center">
            {h % 3 === 0 ? h : ""}
          </div>
        ))}
        {DIAS.map((dia, diaIdx) => (
          <div key={dia} className="contents">
            <div className="text-[10px] text-slate-500 flex items-center">
              {dia}
            </div>
            {horas.map(h => {
              const total = porCelula.get(`${diaIdx}-${h}`) ?? 0;
              const intensidade = total / max;
              return (
                <div
                  key={h}
                  title={`${dia} ${h}h — ${total} resposta(s)`}
                  className="w-[18px] h-[18px] rounded-sm"
                  style={{
                    backgroundColor:
                      total === 0
                        ? "#f1f5f9"
                        : `rgba(34, 197, 94, ${0.15 + intensidade * 0.85})`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
