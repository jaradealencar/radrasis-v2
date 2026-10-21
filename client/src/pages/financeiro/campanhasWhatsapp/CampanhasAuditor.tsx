import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Clipboard,
  Download,
  History,
  Play,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { fmtDateTime, fmtNum, fmtPct } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CAMPANHAS_AUDITOR_MODULES,
  CAMPANHAS_AUDITOR_STATUS,
  type CampanhaAuditorStatus,
} from "@shared/campanhas-auditor";

const STATUS_LABEL: Record<CampanhaAuditorStatus, string> = {
  nao_implementado: "Não implementado",
  implementado_nao_testado: "Implementado, não testado",
  aprovado_simulacao: "Aprovado em simulação",
  aprovado_integracao_real: "Aprovado em integração real",
  aprovado_publicado: "Aprovado em ambiente publicado",
  reprovado: "Reprovado",
  bloqueado_dependencia: "Bloqueado por dependência",
  inconclusivo: "Inconclusivo",
};

const STATUS_STYLE: Record<CampanhaAuditorStatus, string> = {
  nao_implementado: "border-slate-300 bg-slate-100 text-slate-700",
  implementado_nao_testado: "border-amber-300 bg-amber-50 text-amber-800",
  aprovado_simulacao: "border-blue-300 bg-blue-50 text-blue-800",
  aprovado_integracao_real: "border-emerald-300 bg-emerald-50 text-emerald-800",
  aprovado_publicado: "border-green-400 bg-green-50 text-green-800",
  reprovado: "border-red-300 bg-red-50 text-red-800",
  bloqueado_dependencia: "border-orange-300 bg-orange-50 text-orange-800",
  inconclusivo: "border-gray-300 bg-gray-50 text-gray-700",
};

type Resumo = {
  testesExecutados: number;
  testesAprovados: number;
  testesReprovados: number;
  taxaAprovacao: number | null;
  requisitosCobertos: number;
  requisitosNoEscopo: number;
  requisitosAprovadosSimulacao: number;
  requisitosReprovados: number;
  requisitosNaoImplementados: number;
  requisitosNaoVerificados: number;
  coberturaRequisitos: number;
  alertasCriticos: number;
  deployVerificado: boolean;
  avisoVersao: string;
};

type Resultado = {
  requirementId: string;
  status: CampanhaAuditorStatus;
  executed: boolean;
  testIds: string[];
  evidence: Record<string, unknown>;
  expected: string;
  actual: string;
  phase: string;
  severity: string;
  hypothesis?: string;
  recommendation?: string;
};

type Relatorio = {
  id: number;
  escopo: string;
  modulo: string | null;
  modo: string;
  finalizada?: boolean;
  resumo: Resumo;
  checks: Array<{
    id: string;
    name: string;
    critical: boolean;
    passed: boolean;
    expected: string;
    actual: string;
    phase: string;
    severity: string;
    evidence: Record<string, unknown>;
    hypothesis?: string;
    recommendation?: string;
  }>;
  resultados: Resultado[];
  versao: {
    commitSha: string | null;
    branch: string | null;
    ambiente: string | null;
    publishedSha: string | null;
    origemVersao: string;
  };
  iniciadoEm: Date;
  concluidoEm: Date;
};

function statusValido(value: string): CampanhaAuditorStatus {
  return CAMPANHAS_AUDITOR_STATUS.includes(value as CampanhaAuditorStatus)
    ? (value as CampanhaAuditorStatus)
    : "inconclusivo";
}

function BadgeStatus({ status }: { status: string }) {
  const normalized = statusValido(status);
  return (
    <Badge variant="outline" className={STATUS_STYLE[normalized]}>
      {STATUS_LABEL[normalized]}
    </Badge>
  );
}

function baixarRelatorio(report: Relatorio) {
  const file = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `auditoria-campanhas-${report.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CampanhasAuditor() {
  const [modulo, setModulo] = useState("Todos os módulos");
  const [relatorioId, setRelatorioId] = useState<number | null>(null);
  const [ultimaExecucao, setUltimaExecucao] = useState<Relatorio | null>(null);
  const utils = trpc.useUtils();
  const catalogo = trpc.campanhasWhatsapp.auditor.catalogo.useQuery();
  const historico = trpc.campanhasWhatsapp.auditor.historico.useQuery({
    limite: 30,
  });
  const detalhe = trpc.campanhasWhatsapp.auditor.detalhe.useQuery(
    { id: relatorioId ?? 0 },
    { enabled: relatorioId !== null }
  );
  const run = trpc.campanhasWhatsapp.auditor.executar.useMutation({
    onSuccess: async result => {
      setUltimaExecucao(result as Relatorio);
      setRelatorioId(result.id);
      await Promise.all([
        utils.campanhasWhatsapp.auditor.catalogo.invalidate(),
        utils.campanhasWhatsapp.auditor.historico.invalidate(),
      ]);
      await utils.campanhasWhatsapp.auditor.detalhe.invalidate({
        id: result.id,
      });
      toast.success("Auditoria concluída e registrada no histórico.");
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (relatorioId === null && historico.data?.[0])
      setRelatorioId(historico.data[0].id);
  }, [relatorioId, historico.data]);

  const report =
    relatorioId !== null && ultimaExecucao?.id === relatorioId
      ? ultimaExecucao
      : (detalhe.data as unknown as Relatorio | undefined)?.id === relatorioId
        ? (detalhe.data as unknown as Relatorio)
        : undefined;
  const rows = useMemo(
    () =>
      (catalogo.data ?? []).filter(
        item => modulo === "Todos os módulos" || item.modulo === modulo
      ),
    [catalogo.data, modulo]
  );
  const rowsById = useMemo(
    () => new Map((catalogo.data ?? []).map(item => [item.id, item])),
    [catalogo.data]
  );

  function executar() {
    if (modulo === "Todos os módulos") run.mutate({ escopo: "completo" });
    else run.mutate({ escopo: "modulo", modulo });
  }

  async function copiarRelatorio() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      toast.success("Relatório técnico copiado.");
    } catch {
      toast.error(
        "Não foi possível copiar. Use o botão de download do relatório."
      );
    }
  }

  if (catalogo.isLoading)
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-7" />
      </div>
    );
  if (catalogo.isError)
    return (
      <p role="alert" className="py-8 text-sm text-red-700">
        Não foi possível abrir o catálogo do Auditor. Verifique a conexão e
        tente novamente.
      </p>
    );

  const resumo = report?.resumo;
  const failures = report?.checks.filter(item => !item.passed) ?? [];

  return (
    <section
      aria-labelledby="campanhas-auditor-title"
      className="space-y-4 pt-3"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-white p-4">
        <div>
          <h2
            id="campanhas-auditor-title"
            className="flex items-center gap-2 text-lg font-semibold text-slate-800"
          >
            <ShieldCheck size={20} className="text-blue-700" /> Robô Auditor —
            Central de Qualidade
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Executa verificações seguras, registra evidências e mantém pendentes
            os requisitos comerciais que ainda não foram testados.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="auditor-modulo" className="sr-only">
            Escopo da auditoria e filtro de requisitos
          </label>
          <select
            id="auditor-modulo"
            value={modulo}
            onChange={event => setModulo(event.target.value)}
            className="h-9 rounded-md border bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option>Todos os módulos</option>
            {CAMPANHAS_AUDITOR_MODULES.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Button onClick={executar} disabled={run.isPending} className="gap-2">
            {run.isPending ? (
              <Spinner className="size-4" />
            ) : (
              <Play size={15} />
            )}
            {run.isPending ? "Auditando…" : "Executar auditoria"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cobertura de requisitos</CardDescription>
            <CardTitle>
              {resumo ? fmtPct(resumo.coberturaRequisitos, 0) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {resumo
              ? `${fmtNum(resumo.requisitosCobertos)} de ${fmtNum(resumo.requisitosNoEscopo)} com verificação nesta execução`
              : "Execute para medir evidências verificadas"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Testes aprovados</CardDescription>
            <CardTitle className="text-emerald-700">
              {resumo ? fmtNum(resumo.testesAprovados) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            de {fmtNum(resumo?.testesExecutados)} testes executados
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Testes reprovados</CardDescription>
            <CardTitle
              className={
                resumo?.testesReprovados ? "text-red-700" : "text-slate-700"
              }
            >
              {resumo ? fmtNum(resumo.testesReprovados) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Falhas detectadas nesta execução
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Requisitos pendentes</CardDescription>
            <CardTitle className="text-amber-700">
              {resumo ? fmtNum(resumo.requisitosNaoVerificados) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Sem evidência nesta execução
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Alertas críticos</CardDescription>
            <CardTitle
              className={
                resumo?.alertasCriticos ? "text-red-700" : "text-slate-700"
              }
            >
              {resumo ? fmtNum(resumo.alertasCriticos) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Taxa de aprovação dos testes:{" "}
            {resumo ? fmtPct(resumo.taxaAprovacao, 0) : "—"}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.8fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Resultado da auditoria</CardTitle>
                <CardDescription>
                  {report
                    ? `Execução #${report.id} · ${report.escopo === "completo" ? "todos os módulos" : report.modulo}`
                    : "Nenhuma auditoria executada ainda."}
                </CardDescription>
              </div>
              {report && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => baixarRelatorio(report)}
                    className="gap-1.5"
                  >
                    <Download size={14} /> Baixar JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copiarRelatorio}
                    className="gap-1.5"
                  >
                    <Clipboard size={14} /> Copiar relatório técnico
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {resumo && (
              <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
                <p>
                  <strong>Versão informada:</strong>{" "}
                  {report?.versao.commitSha ?? "não informada pelo runtime"}
                </p>
                <p>
                  <strong>Branch:</strong>{" "}
                  {report?.versao.branch ?? "não informada"}
                </p>
                <p>
                  <strong>Ambiente:</strong>{" "}
                  {report?.versao.ambiente ?? "não identificado"}
                </p>
                <p>
                  <strong>Publicação:</strong>{" "}
                  {resumo.deployVerificado
                    ? "metadados runtime e SHA coincidem"
                    : "não verificada"}
                </p>
                <p className="sm:col-span-2 text-xs text-muted-foreground">
                  {resumo.avisoVersao}. Push remoto e configuração de CI externa
                  não são consultados pelo painel.
                </p>
              </div>
            )}
            {detailLoading(report, detalhe.isFetching) && (
              <div className="flex justify-center py-5">
                <Spinner className="size-5" />
              </div>
            )}
            {failures.length > 0 && (
              <div className="space-y-3" aria-label="Erros detectados">
                {failures.map(item => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <XCircle size={16} className="text-red-700" />
                      <strong>{item.name}</strong>
                      <Badge variant="destructive">{item.severity}</Badge>
                      {item.critical && (
                        <Badge
                          variant="outline"
                          className="border-red-400 text-red-800"
                        >
                          Crítico
                        </Badge>
                      )}
                    </div>
                    <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                      <div>
                        <dt className="font-medium">Esperado</dt>
                        <dd>{item.expected}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">Observado</dt>
                        <dd>{item.actual}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">Etapa</dt>
                        <dd>{item.phase}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">Origem provável</dt>
                        <dd>{item.hypothesis ?? "Não determinada"}</dd>
                      </div>
                    </dl>
                    {item.recommendation && (
                      <p className="mt-2">
                        <strong>Ação recomendada:</strong> {item.recommendation}
                      </p>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium">
                        Evidência sanitizada
                      </summary>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded bg-white p-2 text-xs">
                        {JSON.stringify(item.evidence, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            )}
            {report && failures.length === 0 && (
              <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <CheckCircle2 size={17} /> Os checks executados passaram.
                Requisitos sem execução continuam pendentes.
              </p>
            )}
            {!report && (
              <p className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
                <CircleHelp size={17} /> O Auditor não marca nenhuma
                funcionalidade como aprovada antes de registrar um teste e sua
                evidência.
              </p>
            )}
            {report && (
              <div className="max-h-[28rem] overflow-auto rounded-lg border">
                <Table className="min-w-[50rem] text-sm">
                  <TableHeader className="sticky top-0 bg-slate-50">
                    <TableRow>
                      <TableHead>ID / requisito</TableHead>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Evidência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.resultados.map(result => {
                      const requirement = rowsById.get(result.requirementId);
                      return (
                        <TableRow
                          key={result.requirementId}
                          className="align-top"
                        >
                          <TableCell>
                            <strong>{result.requirementId}</strong>
                            <div className="max-w-md text-xs text-muted-foreground">
                              {requirement?.nome}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {requirement?.modulo ?? "—"}
                          </TableCell>
                          <TableCell>
                            <BadgeStatus status={result.status} />
                            {result.executed && (
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {result.testIds.join(", ")}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <details>
                              <summary className="cursor-pointer text-xs">
                                {result.executed
                                  ? result.actual
                                  : "Não verificado nesta execução"}
                              </summary>
                              <div className="mt-2 max-w-lg space-y-1 text-xs">
                                <p>
                                  <strong>Critério:</strong> {result.expected}
                                </p>
                                <p>
                                  <strong>Etapa:</strong> {result.phase}
                                </p>
                                <p>
                                  <strong>Criticidade:</strong>{" "}
                                  {result.severity}
                                </p>
                                <pre className="overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2">
                                  {JSON.stringify(result.evidence, null, 2)}
                                </pre>
                                {result.recommendation && (
                                  <p>
                                    <strong>Recomendação:</strong>{" "}
                                    {result.recommendation}
                                  </p>
                                )}
                              </div>
                            </details>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History size={17} /> Histórico de execuções
            </CardTitle>
            <CardDescription>
              Registros salvos no banco do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historico.isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner className="size-5" />
              </div>
            ) : historico.data?.length ? (
              <ul className="space-y-2">
                {historico.data.map(item => {
                  const summary = item.resumo as Partial<Resumo>;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setRelatorioId(item.id)}
                        aria-current={
                          relatorioId === item.id ? "true" : undefined
                        }
                        className={`w-full rounded-lg border p-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${relatorioId === item.id ? "border-blue-400 bg-blue-50/50" : ""}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <strong>Execução #{item.id}</strong>
                          {!item.finalizada ? (
                            <Badge
                              variant="outline"
                              className="border-amber-400 text-amber-800"
                            >
                              Incompleta
                            </Badge>
                          ) : summary.testesReprovados ? (
                            <Badge variant="destructive">
                              {fmtNum(summary.testesReprovados)} falha(s)
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-emerald-300 text-emerald-800"
                            >
                              Sem falhas nos checks
                            </Badge>
                          )}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {fmtDateTime(item.iniciadoEm)} ·{" "}
                          {item.escopo === "completo"
                            ? "Completa"
                            : item.modulo}
                        </span>
                        <span className="mt-1 block text-xs">
                          Cobertura {fmtPct(summary.coberturaRequisitos, 0)} ·
                          testes aprovados {fmtPct(summary.taxaAprovacao, 0)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ainda não há auditorias gravadas.
              </p>
            )}
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle size={14} /> Limites desta execução
              </p>
              <p className="mt-1">
                A execução manual não envia mensagens, não chama MubiSys e não
                altera cadastros comerciais. Testes de navegador, integrações
                reais, publicação e resultados comerciais aparecem como
                pendentes até haver evidência específica.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de requisitos</CardTitle>
          <CardDescription>
            {fmtNum(rows.length)} requisitos exibidos · estados de aprovação por
            ambiente são separados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {catalogo.isFetching && (
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="size-3.5" /> Atualizando catálogo…
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
            {CAMPANHAS_AUDITOR_STATUS.map(status => {
              const total = rows.filter(
                row => row.statusAtual === status
              ).length;
              return (
                <div key={status} className="rounded-lg border p-2 text-center">
                  <BadgeStatus status={status} />
                  <div className="mt-1 text-lg font-semibold">
                    {fmtNum(total)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 max-h-[32rem] overflow-auto rounded-lg border">
            <Table className="min-w-[52rem] text-sm">
              <TableHeader className="sticky top-0 bg-slate-50">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Funcionalidade e critério de aceite</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Criticidade</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Testes associados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(item => (
                  <TableRow key={item.id} className="align-top">
                    <TableCell className="whitespace-nowrap font-semibold">
                      {item.id}
                    </TableCell>
                    <TableCell className="min-w-[24rem]">
                      <details>
                        <summary className="cursor-pointer font-medium">
                          {item.nome}
                        </summary>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {item.descricao}
                        </p>
                        <p className="mt-1 text-xs">
                          <strong>Aceite:</strong> {item.criteriosAceite}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Evidência atual: {JSON.stringify(item.evidencia)}
                        </p>
                      </details>
                    </TableCell>
                    <TableCell className="text-xs">{item.modulo}</TableCell>
                    <TableCell className="text-xs capitalize">
                      {item.criticidade}
                    </TableCell>
                    <TableCell>
                      <BadgeStatus status={item.statusAtual} />
                      {item.ultimaVerificacao && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {fmtDateTime(item.ultimaVerificacao)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.testesAssociados?.length ? (
                        item.testesAssociados.join(", ")
                      ) : (
                        <span className="text-muted-foreground">
                          Planejados / sem teste disponível
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {report && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CircleHelp size={14} /> O histórico identifica versão/branch quando o
          runtime fornece esses dados; push remoto não é validado por esta tela.
        </p>
      )}
    </section>
  );
}

function detailLoading(report: Relatorio | undefined, isFetching: boolean) {
  return Boolean(isFetching && !report);
}
