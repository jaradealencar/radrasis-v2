import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Flame,
  MessageSquareQuote,
  MousePointerClick,
  RefreshCw,
  Snowflake,
  Sparkles,
  Target,
  Thermometer,
  TrendingUp,
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
import { fmtBrl, fmtNum, fmtPct } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  COR_TEMPERATURA_AUDIENCIA,
  CLUSTERS_LEAD,
  MOTIVOS_OBJECAO,
  ROTULO_CLUSTER,
  ROTULO_FAIXA_ICP,
  ROTULO_FAIXA_LATENCIA,
  ROTULO_MOTIVO_OBJECAO,
  ROTULO_PERFIL_INTERLOCUTOR,
  ROTULO_TEMPERATURA_AUDIENCIA,
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
 * Dashboard de qualificação de leads por IA (Gemini):
 * 1. Resumo Executivo de Alto Nível (Gemini Flash)
 * 2. Atribuição de Receita & ROI Comercial (MubiSys ERP)
 * 3. KPIs de engajamento real e Curva de Latência de Resposta (Lead Velocity)
 * 4. Distribuição de clusters semânticos e diagnóstico de objeções
 * 5. Tabela de leads com parâmetros de projeto, filtro de leads quentes e criação direta de audiência de retargeting.
 */
export default function QualificacaoIaDialog({ campanha, onClose }: Props) {
  const [filtroCluster, setFiltroCluster] = useState<
    ClusterLead | typeof TODOS
  >(TODOS);
  const [filtroObjecao, setFiltroObjecao] = useState<
    MotivoObjecao | typeof TODOS
  >(TODOS);
  const [apenasQuentes, setApenasQuentes] = useState<boolean>(false);
  const [janelaDiasAtribuicao, setJanelaDiasAtribuicao] = useState<number>(30);

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
      icpMinimo: apenasQuentes ? 80 : undefined,
    },
    { enabled: habilitado }
  );
  const resumoIa = trpc.campanhasWhatsapp.resumoExecutivoIa.useQuery(
    { campanhaId },
    { enabled: habilitado, staleTime: 1000 * 60 * 15, retry: false }
  );
  const atribuicao = trpc.campanhasWhatsapp.atribuicaoReceita.useQuery(
    { campanhaId, janelaDias: janelaDiasAtribuicao },
    { enabled: habilitado }
  );

  const utils = trpc.useUtils();
  const [modalRetargeting, setModalRetargeting] = useState(false);
  const [nomeFonte, setNomeFonte] = useState("");
  const [descricaoFonte, setDescricaoFonte] = useState("");

  const criarFonte = trpc.campanhasWhatsapp.criarFonteRetargeting.useMutation({
    onSuccess: f => {
      toast.success(
        `Audiência "${f.label}" criada com sucesso! Já está disponível em Fontes de Dados.`
      );
      setModalRetargeting(false);
      utils.campanhasWhatsapp.listarFontes.invalidate();
    },
    onError: e => toast.error(e.message),
  });

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

  function abrirRetargeting() {
    if (!campanha) return;
    const sufixos: string[] = [];
    if (filtroCluster !== TODOS) sufixos.push(ROTULO_CLUSTER[filtroCluster]);
    if (filtroObjecao !== TODOS)
      sufixos.push(ROTULO_MOTIVO_OBJECAO[filtroObjecao]);
    if (apenasQuentes) sufixos.push("Leads Quentes");
    const sufixoTexto = sufixos.length ? ` · ${sufixos.join(" · ")}` : "";

    setNomeFonte(`Retargeting: ${campanha.nome}${sufixoTexto}`.slice(0, 120));
    setDescricaoFonte(
      `Audiência dinâmica extraída da campanha #${campanha.id} (${campanha.nome}) com os filtros: Cluster = ${
        filtroCluster !== TODOS ? ROTULO_CLUSTER[filtroCluster] : "Todos"
      }, Objeção = ${filtroObjecao !== TODOS ? ROTULO_MOTIVO_OBJECAO[filtroObjecao] : "Todas"}, Apenas Quentes = ${
        apenasQuentes ? "Sim (ICP ≥ 80)" : "Não"
      }.`
    );
    setModalRetargeting(true);
  }

  function confirmarCriacaoFonte() {
    if (!campanha || !nomeFonte.trim()) {
      toast.error("Informe um nome para a nova audiência.");
      return;
    }
    criarFonte.mutate({
      label: nomeFonte.trim(),
      origemCampanhaId: campanha.id,
      origemCampanhaNome: campanha.nome,
      cluster: filtroCluster !== TODOS ? filtroCluster : null,
      motivoObjecao: filtroObjecao !== TODOS ? filtroObjecao : null,
      icpMinimo: apenasQuentes ? 80 : null,
      descricao: descricaoFonte.trim() || undefined,
    });
  }

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
          header: "Parâmetros do projeto",
          valor: l => (l.parametrosProjeto ?? []).join(", "),
          largura: 35,
        },
        {
          header: "Palavras-chave",
          valor: l => (l.palavrasChave ?? []).join(", "),
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
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Brain size={20} className="text-violet-600" /> Inteligência &
            Qualificação de Campanhas (Gemini AI)
          </DialogTitle>
          <DialogDescription>
            {campanha?.nome} — síntese executiva por IA, atribuição de receita e
            qualificação semântica de leads.
          </DialogDescription>
        </DialogHeader>

        {!campanha ? null : kpis.isLoading || stats.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-7 text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ─── BLOCO 0: RESUMO EXECUTIVO DA IA (GEMINI FLASH) ───────────────── */}
            <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/70 via-white to-slate-50 p-4 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center size-7 rounded-lg bg-violet-600 text-white shadow-sm">
                    <Sparkles size={16} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Resumo Executivo da Campanha (Gemini Flash)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Análise estratégica automatizada da resposta da audiência
                      e tração comercial
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {resumoIa.data && (
                    <Badge
                      className="border font-medium text-xs px-2.5 py-0.5"
                      style={{
                        backgroundColor: `${COR_TEMPERATURA_AUDIENCIA[resumoIa.data.temperaturaAudiencia]}15`,
                        color:
                          COR_TEMPERATURA_AUDIENCIA[
                            resumoIa.data.temperaturaAudiencia
                          ],
                        borderColor: `${COR_TEMPERATURA_AUDIENCIA[resumoIa.data.temperaturaAudiencia]}40`,
                      }}
                    >
                      {
                        ROTULO_TEMPERATURA_AUDIENCIA[
                          resumoIa.data.temperaturaAudiencia
                        ]
                      }
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-100/60"
                    onClick={() => resumoIa.refetch()}
                    disabled={resumoIa.isFetching}
                  >
                    <RefreshCw
                      size={12}
                      className={resumoIa.isFetching ? "animate-spin" : ""}
                    />
                    {resumoIa.isFetching ? "Gerando..." : "Atualizar Síntese"}
                  </Button>
                </div>
              </div>

              {resumoIa.isLoading ? (
                <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
                  <Spinner className="size-4" /> Consolidando visão executiva
                  com o Gemini Flash...
                </div>
              ) : resumoIa.data ? (
                <div className="space-y-3 pt-1">
                  <p className="text-sm text-slate-700 leading-relaxed bg-white/80 border border-violet-100 rounded-lg p-3">
                    {resumoIa.data.visaoGeral}
                  </p>

                  <div className="grid md:grid-cols-2 gap-3 text-xs">
                    {/* Pontos Fortes */}
                    <div className="rounded-lg border bg-emerald-50/50 border-emerald-200/60 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                        <CheckCircle2 size={14} className="text-emerald-600" />{" "}
                        Pontos Fortes & Tração da Oferta
                      </div>
                      <ul className="space-y-1 text-slate-700 list-disc list-inside">
                        {resumoIa.data.pontosFortesOferta.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Dores & Objeções */}
                    <div className="rounded-lg border bg-amber-50/50 border-amber-200/60 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                        <AlertTriangle size={14} className="text-amber-600" />{" "}
                        Principais Travas & Objeções
                      </div>
                      <ul className="space-y-1.5 text-slate-700">
                        {resumoIa.data.principaisDoresObjecoes.map((dor, i) => (
                          <li key={i} className="text-xs">
                            <span className="font-medium text-slate-900">
                              {dor.objecao}:
                            </span>{" "}
                            {dor.impacto}
                            {dor.citacaoReal && (
                              <span className="block text-[11px] text-slate-500 italic mt-0.5">
                                "{dor.citacaoReal}"
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Recomendações acionáveis */}
                  <div className="rounded-lg border bg-slate-900 text-slate-100 p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap font-semibold text-amber-300">
                      <span className="flex items-center gap-1.5">
                        <Sparkles size={13} /> Recomendações Estratégicas para o
                        Próximo Disparo
                      </span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        Perfil predominante:{" "}
                        <strong className="text-slate-200">
                          {resumoIa.data.perfilPredominante}
                        </strong>
                      </span>
                    </div>
                    <ul className="space-y-1 text-slate-300 list-disc list-inside">
                      {resumoIa.data.recomendacoesProximaCampanha.map(
                        (rec, i) => (
                          <li key={i}>{rec}</li>
                        )
                      )}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>

            {/* ─── BLOCO 1: ATRIBUIÇÃO DE RECEITA & ROI REAL (MUBISYS ERP) ──────── */}
            <div className="rounded-xl border p-4 space-y-3.5 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <DollarSign size={16} className="text-emerald-600" />{" "}
                    Atribuição de Receita & ROI Real (MubiSys)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    O.S. faturadas ou aprovadas de contatos que receberam
                    disparo desta campanha
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Janela de conversão:
                  </span>
                  <Select
                    value={String(janelaDiasAtribuicao)}
                    onValueChange={v => setJanelaDiasAtribuicao(Number(v))}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="15">15 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="60">60 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {atribuicao.isLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner className="size-5 text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-lg border bg-emerald-50/40 border-emerald-200/80 p-3">
                      <div className="text-[11px] font-medium text-emerald-800">
                        Receita Faturada Atribuída
                      </div>
                      <div className="text-lg font-bold text-emerald-700 mt-0.5">
                        {fmtBrl(atribuicao.data?.receitaTotal ?? 0)}
                      </div>
                      <div className="text-[10px] text-emerald-900/70 mt-0.5">
                        {atribuicao.data?.taxaConversaoDisparosPct ?? 0}%
                        conversão dos disparos
                      </div>
                    </div>

                    <div className="rounded-lg border p-3 bg-slate-50/70">
                      <div className="text-[11px] font-medium text-slate-600">
                        O.S. Convertidas
                      </div>
                      <div className="text-lg font-bold text-slate-800 mt-0.5">
                        {fmtNum(atribuicao.data?.totalOs ?? 0)}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {atribuicao.data?.clientesConvertidos ?? 0} cliente(s)
                        único(s)
                      </div>
                    </div>

                    <div className="rounded-lg border p-3 bg-slate-50/70">
                      <div className="text-[11px] font-medium text-slate-600">
                        Ticket Médio / O.S.
                      </div>
                      <div className="text-lg font-bold text-slate-800 mt-0.5">
                        {fmtBrl(atribuicao.data?.ticketMedio ?? 0)}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Média de valor por venda
                      </div>
                    </div>

                    <div className="rounded-lg border bg-indigo-50/40 border-indigo-200/80 p-3">
                      <div className="text-[11px] font-medium text-indigo-800">
                        Retorno do Investimento (ROI)
                      </div>
                      <div className="text-lg font-bold text-indigo-700 mt-0.5">
                        {atribuicao.data?.multiplicadorRetorno !== null &&
                        atribuicao.data?.multiplicadorRetorno !== undefined
                          ? `${atribuicao.data.multiplicadorRetorno}x`
                          : "—"}
                      </div>
                      <div className="text-[10px] text-indigo-900/70 mt-0.5">
                        Custo de envio:{" "}
                        {fmtBrl(atribuicao.data?.custoTotalEstimado ?? 0)}
                      </div>
                    </div>
                  </div>

                  {/* Breakdown de Receita por Cluster de IA */}
                  {atribuicao.data &&
                    atribuicao.data.receitaPorCluster.length > 0 && (
                      <div className="rounded-lg border bg-slate-50 p-2.5 text-xs flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-slate-700">
                          Origem da Receita por Cluster de IA:
                        </span>
                        <div className="flex items-center gap-3 flex-wrap">
                          {atribuicao.data.receitaPorCluster.map((rc, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5"
                            >
                              <span
                                className="size-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    rc.cluster !== "NAO_QUALIFICADO"
                                      ? COR_CLUSTER[rc.cluster as ClusterLead]
                                      : "#94a3b8",
                                }}
                              />
                              <strong>{rc.label}:</strong> {fmtBrl(rc.receita)}{" "}
                              ({rc.percentualReceita}%)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Tabela de O.S. convertidas */}
                  {atribuicao.data &&
                    atribuicao.data.ordensServico.length > 0 && (
                      <div className="border rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="text-[11px]">
                              <TableHead className="py-1.5">
                                O.S. / Cliente
                              </TableHead>
                              <TableHead className="py-1.5">
                                Data Compra
                              </TableHead>
                              <TableHead className="py-1.5">
                                Dias após Disparo
                              </TableHead>
                              <TableHead className="py-1.5">
                                Cluster IA
                              </TableHead>
                              <TableHead className="py-1.5 text-right">
                                Valor Faturado
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {atribuicao.data.ordensServico.map((os, i) => (
                              <TableRow key={i} className="text-xs">
                                <TableCell className="py-1.5 font-medium">
                                  <div>
                                    O.S. #{os.osNumero} — {os.empresa}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {formatarTelefone(os.telefone)}
                                  </div>
                                </TableCell>
                                <TableCell className="py-1.5">
                                  {os.dataCompra}
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock
                                      size={11}
                                      className="text-muted-foreground"
                                    />
                                    {os.diasAposDisparo === 0
                                      ? "Mesmo dia"
                                      : `${os.diasAposDisparo} dia(s)`}
                                  </span>
                                </TableCell>
                                <TableCell className="py-1.5">
                                  {os.clusterIa ? (
                                    <Badge
                                      className="text-[10px] py-0 px-1.5 border"
                                      style={{
                                        backgroundColor: `${COR_CLUSTER[os.clusterIa]}15`,
                                        color: COR_CLUSTER[os.clusterIa],
                                        borderColor: `${COR_CLUSTER[os.clusterIa]}40`,
                                      }}
                                    >
                                      {ROTULO_CLUSTER[os.clusterIa]}
                                    </Badge>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">
                                      Direto s/ chat
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="py-1.5 text-right font-semibold text-emerald-700">
                                  {fmtBrl(os.valor)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* ─── BLOCO 2: KPIS DE ENGAJAMENTO REAL & CURVA DE LATÊNCIA ───────── */}
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

            {/* Lead Velocity e Curva de Latência de Resposta */}
            {stats.data &&
              (stats.data.tempoMedioReacaoSegundos !== null ||
                stats.data.curvaLatencia) && (
                <div className="rounded-lg border bg-sky-50 border-sky-200 p-3.5 text-sm text-sky-950 space-y-2.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-sky-700" />
                      <span>
                        Lead Velocity: Média de{" "}
                        <strong>
                          {formatarDuracao(
                            stats.data.tempoMedioReacaoSegundos ?? 0
                          )}
                        </strong>
                        {stats.data.medianaReacaoSegundos !== null && (
                          <span className="text-xs text-sky-800 ml-1">
                            (Mediana:{" "}
                            <strong>
                              {formatarDuracao(
                                stats.data.medianaReacaoSegundos
                              )}
                            </strong>
                            )
                          </span>
                        )}
                      </span>
                    </div>

                    {stats.data.melhorFaixaConversao && (
                      <span className="text-xs">
                        📅 Melhor horário de conversão:{" "}
                        <strong>{stats.data.melhorFaixaConversao.faixa}</strong>{" "}
                        ({stats.data.melhorFaixaConversao.total} respostas)
                      </span>
                    )}
                  </div>

                  {/* Barras de Curva de Latência */}
                  {stats.data.curvaLatencia &&
                    stats.data.curvaLatencia.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
                        {stats.data.curvaLatencia.map((cl, i) => (
                          <div
                            key={i}
                            className="rounded border bg-white/90 p-2 text-center"
                          >
                            <div
                              className="text-[10px] text-muted-foreground truncate"
                              title={cl.label}
                            >
                              {cl.label}
                            </div>
                            <div className="text-sm font-bold text-slate-800 mt-0.5">
                              {cl.total}
                            </div>
                            <div className="text-[10px] text-sky-700 font-medium">
                              {cl.percentual}%
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}

            {/* ─── BLOCO 3: CLUSTERS SEMÂNTICOS & OBJEÇÕES ───────────────────────── */}
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

            {/* ─── BLOCO 4: TABELA DE LEADS + FILTROS + RETARGETING ─────────────── */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Leads qualificados ({fmtNum(leads.data?.length ?? 0)})
                  </h3>
                  <Button
                    size="sm"
                    variant={apenasQuentes ? "default" : "outline"}
                    className={`h-7 text-xs gap-1 ${apenasQuentes ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-amber-700 border-amber-300"}`}
                    onClick={() => setApenasQuentes(!apenasQuentes)}
                  >
                    <Flame size={12} />
                    {apenasQuentes
                      ? "Mostrando Leads Quentes"
                      : "Filtrar Leads Quentes (ICP ≥ 80)"}
                  </Button>
                </div>

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
                    <Download size={13} /> Exportar XLSX
                  </Button>

                  <Button
                    size="sm"
                    className="h-8 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                    onClick={abrirRetargeting}
                    disabled={!leads.data?.length}
                  >
                    <Sparkles size={13} /> Criar audiência (1 clique)
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
                        <TableHead>Parâmetros do projeto</TableHead>
                        <TableHead>Palavras-chave</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.data.map(l => (
                        <TableRow key={l.id}>
                          <TableCell>
                            <div className="font-medium text-slate-900">
                              {l.nome || "—"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatarTelefone(l.telefone)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className="border text-xs"
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
                            <div>{l.resumoIntencao}</div>
                            {l.motivoObjecao !== "NENHUMA" &&
                              l.resumoObjecao && (
                                <div className="text-[11px] text-amber-700 mt-0.5">
                                  <strong>Objeção:</strong> {l.resumoObjecao}
                                </div>
                              )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {(l.parametrosProjeto ?? []).length > 0 ? (
                                l.parametrosProjeto.map((p, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="text-[10px] bg-sky-50 text-sky-800 border-sky-200"
                                  >
                                    {p}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  —
                                </span>
                              )}
                            </div>
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

      {/* Modal de criação rápida de audiência de retargeting */}
      <Dialog open={modalRetargeting} onOpenChange={setModalRetargeting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-violet-700">
              <Sparkles size={18} /> Salvar audiência de retargeting
            </DialogTitle>
            <DialogDescription>
              Cria uma nova Fonte de Dados dinâmica alimentada pelos{" "}
              {leads.data?.length ?? 0} leads filtrados desta campanha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="space-y-1">
              <Label htmlFor="nome-fonte" className="text-xs font-semibold">
                Nome da audiência
              </Label>
              <Input
                id="nome-fonte"
                value={nomeFonte}
                onChange={e => setNomeFonte(e.target.value)}
                placeholder="Ex.: Retargeting: Dúvida Técnica"
                maxLength={120}
              />
            </div>

            <div className="rounded-md border bg-slate-50 p-2.5 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Campanha de origem:</span>
                <span className="font-medium text-slate-800">
                  {campanha?.nome}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cluster filtrado:</span>
                <span className="font-medium text-slate-800">
                  {filtroCluster !== TODOS
                    ? ROTULO_CLUSTER[filtroCluster]
                    : "Todos"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Objeção filtrada:</span>
                <span className="font-medium text-slate-800">
                  {filtroObjecao !== TODOS
                    ? ROTULO_MOTIVO_OBJECAO[filtroObjecao]
                    : "Todas"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Apenas Leads Quentes:</span>
                <span className="font-medium text-slate-800">
                  {apenasQuentes ? "Sim (ICP ≥ 80)" : "Não"}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold text-slate-900">
                <span>Total de contatos:</span>
                <span>{fmtNum(leads.data?.length ?? 0)}</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              💡 Esta audiência ficará disponível imediatamente em{" "}
              <strong>Fontes de dados</strong> para ser vinculada em campanhas
              complementares de follow-up ou reativação.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModalRetargeting(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
              onClick={confirmarCriacaoFonte}
              disabled={criarFonte.isPending || !nomeFonte.trim()}
            >
              {criarFonte.isPending ? (
                <Spinner className="size-3.5" />
              ) : (
                <Target size={14} />
              )}
              Salvar audiência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
