import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Bot,
  CalendarPlus,
  Download,
  FileSpreadsheet,
  Megaphone,
  MessageSquareText,
  PauseCircle,
  Send,
  ShieldCheck,
  ShoppingCart,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import { fmtBrl, fmtNum, fmtPct } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  formatarDataBr,
  hojeCampoGrande,
  somarDias,
} from "@shared/campanhas-whatsapp";
import AgendarCampanhaDialog from "./AgendarCampanhaDialog";
import QualificacaoIaDialog from "./QualificacaoIaDialog";
import { AgendamentoItem, type CampanhaLinha } from "./comuns";

type Periodo = { inicio: string; fim: string };
type FiltroStatus = "todas" | "ativa" | "inativa";

function inicioDoMes(iso: string): string {
  return `${iso.slice(0, 8)}01`;
}

function fimDoMes(iso: string): string {
  const ano = Number(iso.slice(0, 4));
  const mes = Number(iso.slice(5, 7));
  return somarDias(
    mes === 12
      ? `${ano + 1}-01-01`
      : `${ano}-${String(mes + 1).padStart(2, "0")}-01`,
    -1
  );
}

const criarAtalhos = (
  hoje: string
): Array<{ label: string; periodo: Periodo }> => {
  const mesPassadoAncora = somarDias(inicioDoMes(hoje), -1);
  return [
    {
      label: "Este mês",
      periodo: { inicio: inicioDoMes(hoje), fim: fimDoMes(hoje) },
    },
    {
      label: "Mês passado",
      periodo: {
        inicio: inicioDoMes(mesPassadoAncora),
        fim: fimDoMes(mesPassadoAncora),
      },
    },
    {
      label: "Últimos 30 dias",
      periodo: { inicio: somarDias(hoje, -29), fim: hoje },
    },
    {
      label: "Este ano",
      periodo: {
        inicio: `${hoje.slice(0, 4)}-01-01`,
        fim: `${hoje.slice(0, 4)}-12-31`,
      },
    },
  ];
};

function LinhaAuditoria({
  titulo,
  detalhe,
  quantidade,
  severidade = "info",
}: {
  titulo: string;
  detalhe: string;
  quantidade?: number;
  severidade?: "ok" | "aviso" | "info";
}) {
  const estilo = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
    aviso: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-slate-200 bg-slate-50 text-slate-700",
  }[severidade];

  return (
    <div className={`flex items-start gap-2 rounded-md border p-2.5 ${estilo}`}>
      {severidade === "ok" ? (
        <BadgeCheck size={15} className="mt-0.5 shrink-0" />
      ) : (
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold">
          <span>{titulo}</span>
          {quantidade !== undefined && (
            <span className="tabular-nums">{fmtNum(quantidade)}</span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
          {detalhe}
        </p>
      </div>
    </div>
  );
}

/** Relatório da operação e da jornada comercial por coorte de envios. */
export default function RelatorioPeriodo({
  campanhas,
}: {
  campanhas: CampanhaLinha[];
}) {
  const hoje = hojeCampoGrande();
  const [periodo, setPeriodo] = useState<Periodo>(() => ({
    inicio: inicioDoMes(hoje),
    fim: fimDoMes(hoje),
  }));
  const [janelaDias, setJanelaDias] = useState(30);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const [busca, setBusca] = useState("");
  const [agendarPara, setAgendarPara] = useState<{
    id: number;
    nome: string;
  } | null>(null);
  const [analiseIa, setAnaliseIa] = useState<CampanhaLinha | null>(null);

  const { data: categorias } =
    trpc.campanhasWhatsapp.listarCategorias.useQuery();
  const labelCategoria = (chave: string) =>
    categorias?.find(c => c.chave === chave)?.label ?? chave;
  const relatorio = trpc.campanhasWhatsapp.relatorioPeriodo.useQuery(periodo, {
    placeholderData: previous => previous,
  });
  const jornada = trpc.campanhasWhatsapp.relatorios.relatorioJornada.useQuery(
    { ...periodo, janelaDias },
    { placeholderData: previous => previous }
  );

  const atalhos = criarAtalhos(hoje);
  const atalhoAtivo = atalhos.find(
    a => a.periodo.inicio === periodo.inicio && a.periodo.fim === periodo.fim
  )?.label;
  const porCampanhaJornada = useMemo(
    () => new Map((jornada.data?.porCampanha ?? []).map(c => [c.id, c])),
    [jornada.data?.porCampanha]
  );
  const linhas = useMemo(() => {
    const todas = relatorio.data?.porCampanha ?? [];
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return todas.filter(c => {
      const statusOk =
        filtroStatus === "todas" ||
        (filtroStatus === "ativa"
          ? c.status === "ativa"
          : c.status !== "ativa");
      const buscaOk =
        !termo ||
        `${c.nome} ${labelCategoria(c.categoria)}`
          .toLocaleLowerCase("pt-BR")
          .includes(termo);
      return statusOk && buscaOk;
    });
  }, [relatorio.data?.porCampanha, busca, filtroStatus, categorias]);

  const exportar = () => {
    if (!jornada.data) return;
    const campanhasPlanilha = linhas.map(c => {
      const j = porCampanhaJornada.get(c.id);
      return {
        Campanha: c.nome,
        Categoria: labelCategoria(c.categoria),
        Status: c.status,
        "Disparos registrados": c.disparosNoPeriodo,
        "Contatos enviados": c.contatosEnviadosNoPeriodo,
        "Contatos na coorte": j?.contatosNaCoorte ?? 0,
        "Respostas humanas": j?.respostasHumanas ?? 0,
        "Respostas de bot": j?.respostasBot ?? 0,
        "Cliques em CTA": j?.cliquesCta ?? 0,
        "Taxa de resposta (%)": j?.taxaRespostaPct ?? 0,
        "Leads qualificados por IA": j?.leadsQualificados ?? 0,
        "Oportunidades estimadas": j?.oportunidadesEstimadas ?? 0,
        "Cotações associadas": j?.orcamentos ?? 0,
        "Cotações abertas": j?.orcamentosAbertos ?? 0,
        "Cotações com outro status": j?.orcamentosOutros ?? 0,
        "O.S. associadas": j?.ordensServico ?? 0,
        "Receita associada (R$)": j?.receitaAssociada ?? 0,
        "Ticket médio associado (R$)": j?.ticketMedio ?? 0,
      };
    });
    const auditoria = [
      {
        Verificação: "Campanhas ativas sem template",
        Quantidade: jornada.data.auditoria.campanhasAtivasSemTemplate.length,
      },
      {
        Verificação: "Campanhas recorrentes sem fonte",
        Quantidade: jornada.data.auditoria.campanhasRecorrentesSemFonte.length,
      },
      {
        Verificação: "Agendamentos atrasados",
        Quantidade: jornada.data.auditoria.agendamentosAtrasados,
      },
      {
        Verificação: "Respostas sem campanha associada",
        Quantidade: jornada.data.auditoria.respostasSemCampanha,
      },
      {
        Verificação: "Respostas sem telefone no ERP",
        Quantidade:
          jornada.data.auditoria.ordensSemTelefone +
          jornada.data.auditoria.orcamentosSemTelefone,
      },
      {
        Verificação: "O.S. associadas a mais de uma campanha",
        Quantidade: jornada.data.auditoria.ordensAssociadasAMaisDeUmaCampanha,
      },
      {
        Verificacao: "Cotacoes associadas a mais de uma campanha",
        Quantidade:
          jornada.data.auditoria.orcamentosAssociadosAMaisDeUmaCampanha,
      },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(campanhasPlanilha),
      "Jornada por campanha"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(auditoria),
      "Auditoria"
    );
    XLSX.writeFile(
      workbook,
      `relatorio-campanhas-whatsapp-${periodo.inicio}-${periodo.fim}.xlsx`
    );
  };

  const campanhaComAnalise = (id: number) =>
    campanhas.find(c => c.id === id) ?? null;
  const auditoria = jornada.data?.auditoria;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {atalhos.map(a => (
          <Button
            key={a.label}
            size="sm"
            variant={atalhoAtivo === a.label ? "default" : "outline"}
            onClick={() => setPeriodo(a.periodo)}
          >
            {a.label}
          </Button>
        ))}
        <span className="mx-1 text-slate-300">·</span>
        <Input
          type="date"
          value={periodo.inicio}
          max={periodo.fim}
          onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))}
          className="w-40"
        />
        <span className="text-sm text-muted-foreground">até</span>
        <Input
          type="date"
          value={periodo.fim}
          min={periodo.inicio}
          onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))}
          className="w-40"
        />
        {(relatorio.isFetching || jornada.isFetching) && <Spinner />}
      </div>

      {relatorio.isError && (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <AlertTriangle size={26} className="text-amber-500" />
          <p className="text-sm">
            Não consegui carregar os indicadores operacionais
            {relatorio.error ? `: ${relatorio.error.message}` : "."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => relatorio.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {relatorio.data && (
        <>
          <section aria-label="Indicadores operacionais">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Operação no período
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <KpiCard
                variant="border"
                label="Campanhas ativas"
                value={relatorio.data.kpis.campanhasAtivas}
                icon={Megaphone}
                color="#1e6fd9"
                sub="Estado atual"
              />
              <KpiCard
                variant="border"
                label="Campanhas inativas"
                value={relatorio.data.kpis.campanhasInativas}
                icon={PauseCircle}
                color="#64748b"
                sub="Pausadas + arquivadas"
              />
              <KpiCard
                variant="border"
                label="Contatos alcançados"
                value={relatorio.data.kpis.contatosCadastradosNoPeriodo}
                icon={Users}
                color="#059669"
                sub="Último envio no recorte"
              />
              <KpiCard
                variant="border"
                label="Disparos registrados"
                value={relatorio.data.kpis.disparosRealizadosNoPeriodo}
                icon={Send}
                color="#d97706"
                sub="Registros de envio no período"
              />
              <KpiCard
                variant="border"
                label="Mensagens enviadas"
                value={relatorio.data.kpis.contatosEnviadosNoPeriodo}
                icon={MessageSquareText}
                color="#7c3aed"
                sub="Soma dos disparos registrados"
              />
            </div>
          </section>

          {jornada.isError && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              Não foi possível montar a jornada comercial:{" "}
              {jornada.error.message}
              <Button
                size="sm"
                variant="outline"
                className="ml-3"
                onClick={() => jornada.refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {jornada.data && (
            <>
              <section aria-label="Jornada comercial">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">
                      Jornada comercial dos contatos enviados
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Coorte: último envio registrado por telefone entre{" "}
                      {formatarDataBr(periodo.inicio)} e{" "}
                      {formatarDataBr(periodo.fim)}.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="mr-1 text-xs text-muted-foreground">
                      Janela após envio:
                    </span>
                    {[7, 15, 30, 60].map(dias => (
                      <Button
                        key={dias}
                        size="sm"
                        variant={janelaDias === dias ? "default" : "outline"}
                        className="h-8 px-2.5"
                        onClick={() => setJanelaDias(dias)}
                      >
                        {dias}d
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  <KpiCard
                    variant="border"
                    label="Respostas humanas"
                    value={fmtNum(jornada.data.kpis.respostasHumanas)}
                    icon={MessageSquareText}
                    color="#059669"
                    sub={`${fmtPct(jornada.data.kpis.taxaRespostaPct)} dos contatos enviados`}
                  />
                  <KpiCard
                    variant="border"
                    label="Leads qualificados por IA"
                    value={fmtNum(jornada.data.kpis.leadsQualificados)}
                    icon={Bot}
                    color="#7c3aed"
                    sub="Classificação persistida"
                  />
                  <KpiCard
                    variant="border"
                    label="Oportunidades estimadas"
                    value={fmtNum(jornada.data.kpis.oportunidadesEstimadas)}
                    icon={Target}
                    color="#d97706"
                    sub="ICP ≥ 80 e interesse ≥ 4"
                  />
                  <KpiCard
                    variant="border"
                    label="Cotações encontradas"
                    value={fmtNum(jornada.data.kpis.orcamentos)}
                    icon={FileSpreadsheet}
                    color="#0284c7"
                    sub={`${fmtNum(jornada.data.kpis.orcamentosAbertos)} abertas - ${fmtNum(jornada.data.kpis.orcamentosGanhos)} ganhas - ${fmtNum(jornada.data.kpis.orcamentosPerdidos)} perdidas - ${fmtNum(jornada.data.kpis.orcamentosOutros)} outros`}
                  />
                  <KpiCard
                    variant="border"
                    label="O.S. encontradas"
                    value={fmtNum(jornada.data.kpis.ordensServico)}
                    icon={ShoppingCart}
                    color="#0f766e"
                    sub="Associadas por telefone"
                  />
                  <KpiCard
                    variant="border"
                    label="Receita identificada"
                    value={fmtBrl(jornada.data.kpis.receitaIdentificadaUnica)}
                    icon={Wallet}
                    color="#16a34a"
                    sub="O.S. únicas no conjunto"
                  />
                </div>
              </section>

              <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-950">
                <strong>Como ler estes números:</strong> respostas são eventos
                recebidos pelo webhook; leads são classificados pelo Gemini;
                “oportunidade estimada” usa ICP ≥ 80 e interesse ≥ 4. Cotações e
                O.S. são associadas pelo telefone normalizado dentro de{" "}
                {janelaDias} dias do envio. Isso indica associação temporal, não
                prova que a campanha causou a venda. Os totais globais
                deduplicam O.S. e cotacoes; os valores por campanha podem se
                sobrepor.
              </div>

              <section className="space-y-3 rounded-lg border bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Comparativo por campanha
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      As contagens de ERP usam o último envio por contato e
                      podem não localizar registros sem telefone.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={exportar}
                    disabled={!linhas.length}
                  >
                    <Download size={14} /> Exportar XLSX
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar campanha ou categoria"
                    className="h-9 w-64"
                  />
                  {(["todas", "ativa", "inativa"] as const).map(status => (
                    <Button
                      key={status}
                      size="sm"
                      variant={filtroStatus === status ? "default" : "outline"}
                      onClick={() => setFiltroStatus(status)}
                    >
                      {status === "todas"
                        ? "Todas"
                        : status === "ativa"
                          ? "Ativas"
                          : "Inativas"}
                    </Button>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campanha</TableHead>
                        <TableHead className="text-right">Envios</TableHead>
                        <TableHead className="text-right">Respostas</TableHead>
                        <TableHead className="text-right">
                          Cliques CTA
                        </TableHead>
                        <TableHead className="text-right">Taxa</TableHead>
                        <TableHead className="text-right">Leads IA</TableHead>
                        <TableHead className="text-right">
                          Oportunidades*
                        </TableHead>
                        <TableHead className="text-right">Cotações</TableHead>
                        <TableHead className="text-right">O.S.</TableHead>
                        <TableHead className="text-right">
                          Receita associada
                        </TableHead>
                        <TableHead className="min-w-64">Agendamentos</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhas.map(c => {
                        const j = porCampanhaJornada.get(c.id);
                        return (
                          <TableRow
                            key={c.id}
                            className={
                              c.status !== "ativa" ? "opacity-70" : undefined
                            }
                          >
                            <TableCell className="min-w-52">
                              <div className="font-medium">{c.nome}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {labelCategoria(c.categoria)} ·{" "}
                                {c.status === "ativa" ? "Ativa" : "Inativa"}
                              </div>
                              <div className="mt-1 flex gap-1">
                                {j &&
                                  !j.templateConfigurado &&
                                  c.status === "ativa" && (
                                    <Badge
                                      variant="outline"
                                      className="border-amber-300 px-1.5 text-[10px] text-amber-800"
                                    >
                                      Sem template
                                    </Badge>
                                  )}
                                {j &&
                                  j.fontesAtivas === 0 &&
                                  c.status === "ativa" &&
                                  j.tipo === "recorrente" && (
                                    <Badge
                                      variant="outline"
                                      className="border-slate-300 px-1.5 text-[10px]"
                                    >
                                      Sem fonte
                                    </Badge>
                                  )}
                              </div>
                            </TableCell>
                            <TableCell
                              className="text-right tabular-nums"
                              title={`${fmtNum(j?.contatosNaCoorte ?? 0)} contatos únicos no histórico da coorte`}
                            >
                              {fmtNum(c.contatosEnviadosNoPeriodo)}
                              <div className="text-[10px] text-muted-foreground">
                                {fmtNum(j?.contatosNaCoorte ?? 0)} contatos
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtNum(j?.respostasHumanas ?? 0)}
                              <div className="text-[10px] text-muted-foreground">
                                {fmtNum(j?.respostasBot ?? 0)} bot
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtNum(j?.cliquesCta ?? 0)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtPct(j?.taxaRespostaPct ?? 0)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtNum(j?.leadsQualificados ?? 0)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtNum(j?.oportunidadesEstimadas ?? 0)}
                            </TableCell>
                            <TableCell
                              className="text-right tabular-nums"
                              title={`${fmtNum(j?.orcamentosGanhos ?? 0)} aceitos; ${fmtNum(j?.orcamentosPerdidos ?? 0)} perdidos`}
                            >
                              {fmtNum(j?.orcamentos ?? 0)}
                              <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {fmtNum(j?.orcamentosAbertos ?? 0)} abertos ·{" "}
                                {fmtNum(j?.orcamentosGanhos ?? 0)} ganhos ·{" "}
                                {fmtNum(j?.orcamentosPerdidos ?? 0)} perdidos ·{" "}
                                {fmtNum(j?.orcamentosOutros ?? 0)} outros
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtNum(j?.ordensServico ?? 0)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtBrl(j?.receitaAssociada ?? 0)}
                              <div className="text-[10px] text-muted-foreground">
                                média {fmtBrl(j?.ticketMedio ?? 0)}
                              </div>
                            </TableCell>
                            <TableCell>
                              {c.agendamentos.length === 0 ? (
                                <span className="text-[11px] text-muted-foreground">
                                  Nenhum agendamento no período
                                </span>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {c.agendamentos.map(a => (
                                    <AgendamentoItem
                                      key={a.id}
                                      agendamento={{
                                        ...a,
                                        campanhaId: c.id,
                                        nome: c.nome,
                                        categoria: c.categoria,
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2"
                                  onClick={() =>
                                    setAnaliseIa(campanhaComAnalise(c.id))
                                  }
                                  aria-label={`Abrir análise de ${c.nome}`}
                                  title="Abrir qualificação e análise completa"
                                >
                                  <Bot size={15} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-1 px-2"
                                  disabled={c.status !== "ativa"}
                                  onClick={() =>
                                    setAgendarPara({ id: c.id, nome: c.nome })
                                  }
                                >
                                  <CalendarPlus size={14} /> Agendar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {!linhas.length && (
                        <TableRow>
                          <TableCell
                            colSpan={12}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            Nenhuma campanha corresponde aos filtros.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  * Oportunidade estimada: lead classificado com ICP ≥ 80 e
                  nível de interesse ≥ 4. Não é uma etapa comercial manual.
                </p>
              </section>

              {auditoria && (
                <section className="space-y-3 rounded-lg border bg-white p-4">
                  <div className="flex items-start gap-2">
                    <ShieldCheck size={18} className="mt-0.5 text-slate-700" />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">
                        Robo Auditor · verificações automáticas
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Regras determinísticas sobre os registros disponíveis;
                        não valida a entrega no aparelho nem a configuração
                        externa dos provedores.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    <LinhaAuditoria
                      titulo="Templates oficiais"
                      quantidade={auditoria.campanhasAtivasSemTemplate.length}
                      severidade={
                        auditoria.campanhasAtivasSemTemplate.length
                          ? "aviso"
                          : "ok"
                      }
                      detalhe={
                        auditoria.campanhasAtivasSemTemplate.length
                          ? `${auditoria.campanhasAtivasSemTemplate.length} campanha(s) ativa(s) não podem enviar pelo botão WTS até configurar o template.`
                          : "Todas as campanhas ativas têm ID de template configurado."
                      }
                    />
                    <LinhaAuditoria
                      titulo="Fontes de público"
                      quantidade={auditoria.campanhasRecorrentesSemFonte.length}
                      severidade={
                        auditoria.campanhasRecorrentesSemFonte.length
                          ? "aviso"
                          : "ok"
                      }
                      detalhe={
                        auditoria.campanhasRecorrentesSemFonte.length
                          ? "Campanhas recorrentes ativas não têm fonte ativa vinculada."
                          : "Campanhas recorrentes ativas têm fonte vinculada."
                      }
                    />
                    <LinhaAuditoria
                      titulo="Agendamentos vencidos"
                      quantidade={auditoria.agendamentosAtrasados}
                      severidade={
                        auditoria.agendamentosAtrasados ? "aviso" : "ok"
                      }
                      detalhe="Planejamentos anteriores a hoje que continuam com status ‘planejado’. Agendamento é lembrete; não dispara mensagem sozinho."
                    />
                    <LinhaAuditoria
                      titulo="Respostas sem campanha associada"
                      quantidade={auditoria.respostasSemCampanha}
                      severidade={
                        auditoria.respostasSemCampanha ? "aviso" : "ok"
                      }
                      detalhe="A origem depende do último envio registrado para o telefone; mensagens sem correspondência não entram no funil da campanha."
                    />
                    <LinhaAuditoria
                      titulo="Mensagens aguardando processamento"
                      quantidade={auditoria.mensagensPendentes}
                      severidade={auditoria.mensagensPendentes ? "aviso" : "ok"}
                      detalhe="Mensagens cujo buffer já venceu, mas ainda não foram consolidadas pela rotina de processamento."
                    />
                    <LinhaAuditoria
                      titulo="Contatos em mais de uma campanha"
                      quantidade={auditoria.contatosEmMaisDeUmaCampanha}
                      severidade={
                        auditoria.contatosEmMaisDeUmaCampanha ? "aviso" : "ok"
                      }
                      detalhe="Pode haver sobreposição de respostas, cotações e receita entre campanhas concorrentes."
                    />
                    <LinhaAuditoria
                      titulo="O.S. associadas a mais de uma campanha"
                      quantidade={auditoria.ordensAssociadasAMaisDeUmaCampanha}
                      severidade={
                        auditoria.ordensAssociadasAMaisDeUmaCampanha
                          ? "aviso"
                          : "ok"
                      }
                      detalhe="A receita por campanha pode se repetir; o total global deduplica cada O.S. pelo número do ERP."
                    />
                    <LinhaAuditoria
                      titulo="Cotacoes associadas a mais de uma campanha"
                      quantidade={
                        auditoria.orcamentosAssociadosAMaisDeUmaCampanha
                      }
                      severidade={
                        auditoria.orcamentosAssociadosAMaisDeUmaCampanha
                          ? "aviso"
                          : "ok"
                      }
                      detalhe="O mesmo orcamento pode aparecer em campanhas diferentes se o telefone recebeu mais de uma abordagem."
                    />
                    <LinhaAuditoria
                      titulo="Registros ERP sem telefone"
                      quantidade={
                        auditoria.ordensSemTelefone +
                        auditoria.orcamentosSemTelefone
                      }
                      severidade={
                        auditoria.ordensSemTelefone +
                        auditoria.orcamentosSemTelefone
                          ? "aviso"
                          : "ok"
                      }
                      detalhe={`${fmtNum(auditoria.orcamentosSemTelefone)} cotação(ões) e ${fmtNum(auditoria.ordensSemTelefone)} O.S. não puderam ser cruzadas por telefone.`}
                    />
                    <LinhaAuditoria
                      titulo="Retornos e bloqueios globais"
                      quantidade={auditoria.totalOptouts}
                      severidade="info"
                      detalhe={`${fmtNum(auditoria.totalOptouts)} opt-out(s) permanentes e ${fmtNum(auditoria.telefonesNaQuarentena)} telefone(s) no histórico de quarentena compartilhado por Campanhas, CRM e Retenção. Integrações externas precisam consultar a verificação antes de enviar.`}
                    />
                    <LinhaAuditoria
                      titulo="Recebimento do webhook"
                      quantidade={auditoria.enviosApiNoPeriodo}
                      severidade={
                        auditoria.semRespostasHumanasNoPeriodo
                          ? "aviso"
                          : "info"
                      }
                      detalhe={
                        auditoria.semRespostasHumanasNoPeriodo
                          ? "Houve envio via API, mas nenhuma resposta humana no período. Pode ser ausência de resposta ou webhook não configurado; o Radrasys não confirma a configuração da Ceci/Meta."
                          : "Confirme com o provedor se o webhook inbound e a rotina de consolidação estão ativos."
                      }
                    />
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
                    <strong>Limites que afetam os números:</strong> a Ceci.Chat
                    não fornece recibo de leitura confiável nesta integração;
                    status “aceito/enfileirado” não comprova entrega. Atribuição
                    usa telefone e janela temporal, não prova causalidade.
                    Envios manuais têm data registrada, mas sem horário exato;
                    velocidade de resposta é mais confiável para envios de API.
                    O custo por mensagem e o ROI financeiro não são exibidos
                    porque não há custo real por campanha confirmado.
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      <AgendarCampanhaDialog
        open={!!agendarPara}
        onOpenChange={open => {
          if (!open) setAgendarPara(null);
        }}
        campanhaIdInicial={agendarPara?.id}
      />
      <QualificacaoIaDialog
        campanha={analiseIa}
        onClose={() => setAnaliseIa(null)}
      />
    </div>
  );
}
