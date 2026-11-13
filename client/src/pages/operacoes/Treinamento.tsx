import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  LockKeyhole,
  Play,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type AttemptView = {
  assessmentId: number;
  attemptId: number;
  mode: "practice" | "formal";
  title: string;
  version: number;
  questions: Array<{
    key: string;
    type: string;
    prompt: string;
    points: number;
    config: any;
  }>;
};

const EMPTY_SECTOR = {
  name: "",
  slug: "",
  description: "",
  position: 0,
  isPublished: false,
  archived: false,
};
const EMPTY_SUBJECT = {
  sectorId: 0,
  title: "",
  slug: "",
  description: "",
  sourceReference: "",
  position: 0,
  isPublished: false,
  archived: false,
};
const EMPTY_LESSON = {
  subjectId: 0,
  title: "",
  summary: "",
  content: "",
  position: 0,
  isPublished: false,
  archived: false,
};
const EMPTY_ASSESSMENT = {
  subjectId: 0,
  title: "",
  description: "",
  allowPractice: true,
  allowFormal: true,
  position: 0,
  isPublished: false,
  archived: false,
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ContentParagraphs({ content }: { content: string }) {
  return (
    <div className="space-y-4 text-sm leading-7 text-slate-700">
      {content.split(/\n\s*\n/).map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function FeedbackPanel({ feedback }: { feedback: any }) {
  if (!feedback) return null;
  return (
    <div
      className={`mt-5 rounded-xl border p-4 ${feedback.isCorrect ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
    >
      <div className="flex items-center gap-2 font-semibold">
        {feedback.isCorrect ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
        ) : (
          <ShieldCheck className="h-5 w-5 text-amber-700" />
        )}
        {feedback.isCorrect ? "Boa escolha" : "Vamos revisar o raciocínio"}
      </div>
      {feedback.selectedText && (
        <p className="mt-2 text-sm text-slate-700">
          Sua escolha: {feedback.selectedText}
        </p>
      )}
      {feedback.expectedAnswer && (
        <p className="mt-2 text-sm text-slate-700">
          <strong>Resposta esperada:</strong> {feedback.expectedAnswer}
        </p>
      )}
      {feedback.explanation && (
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {feedback.explanation}
        </p>
      )}
      {feedback.details?.length > 0 && (
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
          {feedback.details.map((item: string, index: number) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
      {feedback.criteria && Object.keys(feedback.criteria).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(feedback.criteria).map(([name, value]) => (
            <Badge key={name} variant="outline">
              {name}: {String(value)}%
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function TrainingAdmin({ onChanged }: { onChanged: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.treinamento.adminCatalog.useQuery();
  const [sectorId, setSectorId] = useState<number | undefined>();
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [lessonId, setLessonId] = useState<number | undefined>();
  const [assessmentId, setAssessmentId] = useState<number | undefined>();
  const [sector, setSector] = useState<any>(EMPTY_SECTOR);
  const [subject, setSubject] = useState<any>(EMPTY_SUBJECT);
  const [lesson, setLesson] = useState<any>(EMPTY_LESSON);
  const [assessment, setAssessment] = useState<any>(EMPTY_ASSESSMENT);
  const [questionJson, setQuestionJson] = useState("[]");
  const [reportFilter, setReportFilter] = useState<number | undefined>();
  const { data: lessonVersions = [] } =
    trpc.treinamento.lessonVersions.useQuery(
      { lessonId: lessonId ?? 0 },
      { enabled: Boolean(lessonId) }
    );

  const saveSector = trpc.treinamento.saveSector.useMutation({
    onSuccess: async () => {
      await utils.treinamento.adminCatalog.invalidate();
      await utils.treinamento.catalog.invalidate();
      toast.success("Setor salvo.");
      onChanged();
    },
  });
  const saveSubject = trpc.treinamento.saveSubject.useMutation({
    onSuccess: async () => {
      await utils.treinamento.adminCatalog.invalidate();
      await utils.treinamento.catalog.invalidate();
      toast.success("Matéria salva.");
      onChanged();
    },
  });
  const saveLesson = trpc.treinamento.saveLesson.useMutation({
    onSuccess: async () => {
      await utils.treinamento.adminCatalog.invalidate();
      await utils.treinamento.catalog.invalidate();
      toast.success("Aula salva.");
      onChanged();
    },
  });
  const saveAssessment = trpc.treinamento.saveAssessment.useMutation({
    onSuccess: async () => {
      await utils.treinamento.adminCatalog.invalidate();
      await utils.treinamento.catalog.invalidate();
      toast.success("Avaliação salva em nova versão.");
      onChanged();
    },
  });
  const { data: results = [], isLoading: resultsLoading } =
    trpc.treinamento.resultsReport.useQuery({ subjectId: reportFilter });

  useEffect(() => {
    if (!data) return;
    if (sectorId === undefined && data.sectors[0])
      setSectorId(data.sectors[0].id);
    if (subjectId === undefined && data.subjects[0])
      setSubjectId(data.subjects[0].id);
    if (lessonId === undefined && data.lessons[0])
      setLessonId(data.lessons[0].id);
    if (assessmentId === undefined && data.assessments[0])
      setAssessmentId(data.assessments[0].id);
  }, [data, sectorId, subjectId, lessonId, assessmentId]);

  useEffect(() => {
    if (!data) return;
    const selected = data.sectors.find(row => row.id === sectorId);
    if (selected)
      setSector({
        id: selected.id,
        name: selected.name,
        slug: selected.slug,
        description: selected.description,
        position: selected.position,
        isPublished: selected.isPublished,
        archived: Boolean(selected.archivedAt),
      });
  }, [data, sectorId]);
  useEffect(() => {
    if (!data) return;
    const selected = data.subjects.find(row => row.id === subjectId);
    if (selected)
      setSubject({
        id: selected.id,
        sectorId: selected.sectorId,
        title: selected.title,
        slug: selected.slug,
        description: selected.description,
        sourceReference: selected.sourceReference ?? "",
        position: selected.position,
        isPublished: selected.isPublished,
        archived: Boolean(selected.archivedAt),
      });
  }, [data, subjectId]);
  useEffect(() => {
    if (!data) return;
    const selected = data.lessons.find(row => row.id === lessonId);
    if (selected)
      setLesson({
        id: selected.id,
        subjectId: selected.subjectId,
        title: selected.title,
        summary: selected.summary,
        content: selected.content,
        position: selected.position,
        isPublished: selected.isPublished,
        archived: Boolean(selected.archivedAt),
      });
  }, [data, lessonId]);
  useEffect(() => {
    if (!data) return;
    const selected = data.assessments.find(row => row.id === assessmentId);
    if (selected) {
      setAssessment({
        id: selected.id,
        subjectId: selected.subjectId,
        title: selected.title,
        description: selected.description,
        allowPractice: selected.allowPractice,
        allowFormal: selected.allowFormal,
        position: selected.position,
        isPublished: selected.isPublished,
        archived: Boolean(selected.archivedAt),
      });
      setQuestionJson(
        JSON.stringify(
          data.questions
            .filter(q => q.assessmentId === selected.id)
            .map(q => ({
              key: q.questionKey,
              type: q.type,
              prompt: q.prompt,
              points: q.points,
              position: q.position,
              config: q.config,
            })),
          null,
          2
        )
      );
    }
  }, [data, assessmentId]);

  if (isLoading || !data)
    return (
      <p className="p-6 text-sm text-slate-500">
        Carregando conteúdo de autoria…
      </p>
    );

  const checkboxes = (
    value: boolean,
    update: (next: boolean) => void,
    label: string
  ) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={value}
        onChange={event => update(event.target.checked)}
      />
      {label}
    </label>
  );
  const saveQuestions = () => {
    let parsed: any[];
    try {
      parsed = JSON.parse(questionJson);
      if (!Array.isArray(parsed))
        throw new Error("O conteúdo deve ser uma lista JSON.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "JSON inválido.");
      return;
    }
    saveAssessment.mutate({ ...assessment, questions: parsed });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manutenção do conteúdo</CardTitle>
          <CardDescription>
            Setores, matérias, aulas e avaliações têm publicação e ordem
            próprias. Arquivar mantém o histórico. Salvar uma avaliação cria uma
            nova versão; tentativas anteriores preservam o snapshot usado.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 xl:grid-cols-2">
          <section className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Setores</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSectorId(0);
                  setSector({ ...EMPTY_SECTOR });
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Novo
              </Button>
            </div>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={sectorId ?? ""}
              onChange={event => setSectorId(Number(event.target.value) || 0)}
            >
              <option value="0">Novo setor</option>
              {data.sectors.map(row => (
                <option key={row.id} value={row.id}>
                  {row.name}
                  {row.archivedAt ? " (arquivado)" : ""}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Nome</Label>
                <Input
                  value={sector.name}
                  onChange={e =>
                    setSector({
                      ...sector,
                      name: e.target.value,
                      slug: sector.id ? sector.slug : slugify(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={sector.slug}
                  onChange={e => setSector({ ...sector, slug: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={sector.description}
                onChange={e =>
                  setSector({ ...sector, description: e.target.value })
                }
              />
            </div>
            <div className="flex flex-wrap gap-4">
              {checkboxes(
                sector.isPublished,
                v => setSector({ ...sector, isPublished: v }),
                "Publicado"
              )}
              {checkboxes(
                sector.archived,
                v => setSector({ ...sector, archived: v }),
                "Arquivado"
              )}
            </div>
            <div className="flex items-center gap-3">
              <Label>Ordem</Label>
              <Input
                className="w-24"
                type="number"
                value={sector.position}
                onChange={e =>
                  setSector({ ...sector, position: Number(e.target.value) })
                }
              />
              <Button
                size="sm"
                onClick={() => saveSector.mutate(sector)}
                disabled={saveSector.isPending}
              >
                <Save className="mr-1 h-4 w-4" />
                Salvar setor
              </Button>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Matérias</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSubjectId(0);
                  setSubject({
                    ...EMPTY_SUBJECT,
                    sectorId: data.sectors[0]?.id ?? 0,
                  });
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Nova
              </Button>
            </div>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={subjectId ?? ""}
              onChange={event => setSubjectId(Number(event.target.value) || 0)}
            >
              <option value="0">Nova matéria</option>
              {data.subjects.map(row => (
                <option key={row.id} value={row.id}>
                  {row.title}
                  {row.archivedAt ? " (arquivada)" : ""}
                </option>
              ))}
            </select>
            <div>
              <Label>Setor</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={subject.sectorId}
                onChange={e =>
                  setSubject({ ...subject, sectorId: Number(e.target.value) })
                }
              >
                {data.sectors.map(row => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Nome da matéria</Label>
                <Input
                  value={subject.title}
                  onChange={e =>
                    setSubject({
                      ...subject,
                      title: e.target.value,
                      slug: subject.id ? subject.slug : slugify(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={subject.slug}
                  onChange={e =>
                    setSubject({ ...subject, slug: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={subject.description}
                onChange={e =>
                  setSubject({ ...subject, description: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Fonte de conteúdo</Label>
              <Input
                value={subject.sourceReference}
                onChange={e =>
                  setSubject({ ...subject, sourceReference: e.target.value })
                }
              />
            </div>
            <div className="flex flex-wrap gap-4">
              {checkboxes(
                subject.isPublished,
                v => setSubject({ ...subject, isPublished: v }),
                "Publicado"
              )}
              {checkboxes(
                subject.archived,
                v => setSubject({ ...subject, archived: v }),
                "Arquivado"
              )}
            </div>
            <div className="flex items-center gap-3">
              <Label>Ordem</Label>
              <Input
                className="w-24"
                type="number"
                value={subject.position}
                onChange={e =>
                  setSubject({ ...subject, position: Number(e.target.value) })
                }
              />
              <Button
                size="sm"
                onClick={() => saveSubject.mutate(subject)}
                disabled={saveSubject.isPending}
              >
                <Save className="mr-1 h-4 w-4" />
                Salvar matéria
              </Button>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Aulas</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setLessonId(0);
                  setLesson({
                    ...EMPTY_LESSON,
                    subjectId: data.subjects[0]?.id ?? 0,
                  });
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Nova
              </Button>
            </div>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={lessonId ?? ""}
              onChange={event => setLessonId(Number(event.target.value) || 0)}
            >
              <option value="0">Nova aula</option>
              {data.lessons.map(row => (
                <option key={row.id} value={row.id}>
                  {row.title}
                  {row.archivedAt ? " (arquivada)" : ""}
                </option>
              ))}
            </select>
            <div>
              <Label>Matéria</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={lesson.subjectId}
                onChange={e =>
                  setLesson({ ...lesson, subjectId: Number(e.target.value) })
                }
              >
                {data.subjects.map(row => (
                  <option key={row.id} value={row.id}>
                    {row.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Título</Label>
              <Input
                value={lesson.title}
                onChange={e => setLesson({ ...lesson, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Resumo</Label>
              <Textarea
                value={lesson.summary}
                onChange={e =>
                  setLesson({ ...lesson, summary: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Conteúdo (parágrafos separados por linha em branco)</Label>
              <Textarea
                className="min-h-44"
                value={lesson.content}
                onChange={e =>
                  setLesson({ ...lesson, content: e.target.value })
                }
              />
            </div>
            {lessonId && lessonVersions.length > 0 && (
              <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                <p className="text-sm font-medium">
                  Histórico de versões do conteúdo
                </p>
                {lessonVersions.map(version => (
                  <details
                    key={version.version}
                    className="rounded-md border bg-background p-2"
                  >
                    <summary className="cursor-pointer text-sm">
                      v{version.version} · {formatDate(version.createdAt)}
                      {version.author ? ` · ${version.author}` : ""}
                    </summary>
                    <p className="mt-2 text-sm font-medium">{version.title}</p>
                    {version.summary && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {version.summary}
                      </p>
                    )}
                    <div className="mt-2 max-h-56 overflow-auto">
                      <ContentParagraphs content={version.content} />
                    </div>
                  </details>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              {checkboxes(
                lesson.isPublished,
                v => setLesson({ ...lesson, isPublished: v }),
                "Publicado"
              )}
              {checkboxes(
                lesson.archived,
                v => setLesson({ ...lesson, archived: v }),
                "Arquivado"
              )}
            </div>
            <div className="flex items-center gap-3">
              <Label>Ordem</Label>
              <Input
                className="w-24"
                type="number"
                value={lesson.position}
                onChange={e =>
                  setLesson({ ...lesson, position: Number(e.target.value) })
                }
              />
              <Button
                size="sm"
                onClick={() => saveLesson.mutate(lesson)}
                disabled={saveLesson.isPending}
              >
                <Save className="mr-1 h-4 w-4" />
                Salvar aula
              </Button>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Avaliações e questões</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAssessmentId(0);
                  setAssessment({
                    ...EMPTY_ASSESSMENT,
                    subjectId: data.subjects[0]?.id ?? 0,
                  });
                  setQuestionJson("[]");
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Nova
              </Button>
            </div>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={assessmentId ?? ""}
              onChange={event =>
                setAssessmentId(Number(event.target.value) || 0)
              }
            >
              <option value="0">Nova avaliação</option>
              {data.assessments.map(row => (
                <option key={row.id} value={row.id}>
                  {row.title}
                  {row.archivedAt ? " (arquivada)" : ""}
                </option>
              ))}
            </select>
            <div>
              <Label>Matéria</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={assessment.subjectId}
                onChange={e =>
                  setAssessment({
                    ...assessment,
                    subjectId: Number(e.target.value),
                  })
                }
              >
                {data.subjects.map(row => (
                  <option key={row.id} value={row.id}>
                    {row.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Título</Label>
              <Input
                value={assessment.title}
                onChange={e =>
                  setAssessment({ ...assessment, title: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={assessment.description}
                onChange={e =>
                  setAssessment({ ...assessment, description: e.target.value })
                }
              />
            </div>
            <div className="flex flex-wrap gap-4">
              {checkboxes(
                assessment.allowPractice,
                v => setAssessment({ ...assessment, allowPractice: v }),
                "Modo prática"
              )}
              {checkboxes(
                assessment.allowFormal,
                v => setAssessment({ ...assessment, allowFormal: v }),
                "Modo formal"
              )}
              {checkboxes(
                assessment.isPublished,
                v => setAssessment({ ...assessment, isPublished: v }),
                "Publicado"
              )}
              {checkboxes(
                assessment.archived,
                v => setAssessment({ ...assessment, archived: v }),
                "Arquivado"
              )}
            </div>
            <div className="flex items-center gap-3">
              <Label>Ordem</Label>
              <Input
                className="w-24"
                type="number"
                value={assessment.position}
                onChange={e =>
                  setAssessment({
                    ...assessment,
                    position: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label>Questões em JSON</Label>
              <Textarea
                className="min-h-72 font-mono text-xs"
                value={questionJson}
                onChange={e => setQuestionJson(e.target.value)}
              />
              <p className="mt-2 text-xs text-slate-500">
                Tipos: multiple_choice, multiple_select, ordering, best_response
                e negotiation. Cada item usa key, type, prompt, points, position
                e config. A autoria recebe o gabarito; ele não é enviado ao
                aluno antes da correção.
              </p>
            </div>
            <Button onClick={saveQuestions} disabled={saveAssessment.isPending}>
              <Save className="mr-1 h-4 w-4" />
              Salvar avaliação e nova versão
            </Button>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultados por pessoa</CardTitle>
          <CardDescription>
            Consulta administrativa; tentativas próprias do aluno também ficam
            disponíveis no histórico da matéria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-3">
            <Label>Filtrar matéria</Label>
            <select
              className="max-w-sm rounded-md border bg-background px-3 py-2 text-sm"
              value={reportFilter ?? ""}
              onChange={e =>
                setReportFilter(Number(e.target.value) || undefined)
              }
            >
              <option value="">Todas</option>
              {data.subjects.map(row => (
                <option key={row.id} value={row.id}>
                  {row.title}
                </option>
              ))}
            </select>
          </div>
          {resultsLoading ? (
            <p className="text-sm text-slate-500">Carregando resultados…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-slate-500">
              Ainda não há tentativas registradas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Setor / matéria</TableHead>
                    <TableHead>Avaliação</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Início</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map(row => (
                    <TableRow key={row.attemptId}>
                      <TableCell>{row.userName}</TableCell>
                      <TableCell>
                        {row.sector} / {row.subject}
                      </TableCell>
                      <TableCell>
                        {row.assessment} · v{row.version}
                      </TableCell>
                      <TableCell>
                        {row.mode === "practice" ? "Prática" : "Formal"}
                      </TableCell>
                      <TableCell>
                        {row.status === "completed"
                          ? "Concluída"
                          : "Em andamento"}
                      </TableCell>
                      <TableCell>
                        {row.score == null
                          ? "—"
                          : `${Number(row.score).toFixed(2)}%`}
                      </TableCell>
                      <TableCell>{formatDate(row.startedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Treinamento() {
  const { user } = useAuth();
  const canManage = ["admin", "master", "gestor"].includes(user?.role ?? "");
  const utils = trpc.useUtils();
  const { data: sectors = [], isLoading } = trpc.treinamento.catalog.useQuery();
  const { data: progress = [] } = trpc.treinamento.myProgress.useQuery();
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [lessonId, setLessonId] = useState<number | undefined>();
  const [tab, setTab] = useState("study");
  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | string[]>("");
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [scenarioNode, setScenarioNode] = useState<any>(null);
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [savingLesson, setSavingLesson] = useState(false);
  const [reviewAttemptId, setReviewAttemptId] = useState<number | undefined>();

  useEffect(() => {
    if (!subjectId && sectors[0]?.subjects[0])
      setSubjectId(sectors[0].subjects[0].id);
  }, [sectors, subjectId]);
  const currentSector = useMemo(
    () =>
      sectors.find(sector =>
        sector.subjects.some((subject: any) => subject.id === subjectId)
      ),
    [sectors, subjectId]
  );
  const { data: subject, isLoading: subjectLoading } =
    trpc.treinamento.subject.useQuery(
      { id: subjectId ?? 0 },
      { enabled: Boolean(subjectId) }
    );
  const { data: history = [] } = trpc.treinamento.history.useQuery(
    { subjectId: subjectId ?? 0 },
    { enabled: Boolean(subjectId) }
  );
  const { data: reviewedAttempt } = trpc.treinamento.reviewAttempt.useQuery(
    { attemptId: reviewAttemptId ?? 0 },
    { enabled: Boolean(reviewAttemptId) }
  );
  const currentProgress = progress.find(row => row.subjectId === subjectId);
  const activeLesson = subject?.lessons.find(
    (item: any) => item.id === lessonId
  );
  const currentQuestion = attempt?.questions[questionIndex];
  const activeScenario = scenarioNode ?? currentQuestion?.config;
  const startAttempt = trpc.treinamento.startAttempt.useMutation({
    onSuccess: data => {
      setAttempt(data as AttemptView);
      setQuestionIndex(0);
      setSelected("");
      setOrderedIds([]);
      setScenarioNode(null);
      setAnswerResult(null);
      setFinalResult(null);
    },
  });
  const submitAnswer = trpc.treinamento.submitAnswer.useMutation({
    onSuccess: data => {
      setAnswerResult(data);
      if (data.nextQuestion?.config) setScenarioNode(data.nextQuestion.config);
    },
  });
  const completeAttempt = trpc.treinamento.completeAttempt.useMutation({
    onSuccess: async data => {
      setFinalResult(data);
      await Promise.all([
        utils.treinamento.history.invalidate(),
        utils.treinamento.myProgress.invalidate(),
      ]);
    },
  });
  const markComplete = trpc.treinamento.markLessonComplete.useMutation({
    onSuccess: async () => {
      await utils.treinamento.myProgress.invalidate();
      toast.success("Aula marcada como concluída.");
      setSavingLesson(false);
    },
  });

  useEffect(() => {
    setLessonId(subject?.lessons[0]?.id);
  }, [subject?.id]);
  useEffect(() => {
    if (currentQuestion?.type === "ordering")
      setOrderedIds(currentQuestion.config.steps.map((step: any) => step.id));
    else setOrderedIds([]);
    setSelected(currentQuestion?.type === "multiple_select" ? [] : "");
    setScenarioNode(
      currentQuestion?.type === "negotiation" ? currentQuestion.config : null
    );
    setAnswerResult(null);
  }, [attempt?.attemptId, questionIndex, currentQuestion?.key]);

  const lessonComplete = (id: number) =>
    (currentProgress as any)?.completedLessonIds?.includes(id) ?? false;

  const start = (assessmentId: number, mode: "practice" | "formal") =>
    startAttempt.mutate({ assessmentId, mode });
  const sendAnswer = () => {
    if (!attempt || !currentQuestion) return;
    let response: any = selected;
    if (currentQuestion.type === "ordering") response = orderedIds;
    if (currentQuestion.type === "negotiation")
      response = { nodeId: activeScenario.nodeId, optionId: selected };
    if ((Array.isArray(response) && response.length === 0) || response === "") {
      toast.error("Escolha ou organize sua resposta antes de continuar.");
      return;
    }
    submitAnswer.mutate({
      attemptId: attempt.attemptId,
      questionKey: currentQuestion.key,
      response,
    });
  };
  const nextQuestion = () => {
    if (!attempt || !currentQuestion) return;
    if (questionIndex + 1 >= attempt.questions.length)
      completeAttempt.mutate({ attemptId: attempt.attemptId });
    else {
      setQuestionIndex(questionIndex + 1);
      setSelected("");
      setScenarioNode(null);
      setAnswerResult(null);
    }
  };
  const closeAttempt = () => {
    setAttempt(null);
    setFinalResult(null);
    setAnswerResult(null);
  };
  const toggleMulti = (id: string) =>
    setSelected(previous =>
      Array.isArray(previous)
        ? previous.includes(id)
          ? previous.filter(value => value !== id)
          : [...previous, id]
        : [id]
    );
  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= orderedIds.length) return;
    const next = [...orderedIds];
    [next[index], next[target]] = [next[target], next[index]];
    setOrderedIds(next);
  };
  const markLesson = (id: number) => {
    setSavingLesson(true);
    markComplete.mutate({ lessonId: id });
  };

  const studentBody = () => {
    if (attempt && finalResult)
      return (
        <Card className="mx-auto max-w-4xl">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {finalResult.mode === "practice"
                  ? "Prática"
                  : "Avaliação formal"}
              </Badge>
              <Badge variant="outline">Versão {finalResult.version}</Badge>
            </div>
            <CardTitle className="text-2xl">
              Tentativa concluída · {finalResult.score.toFixed(2)}%
            </CardTitle>
            <CardDescription>
              {finalResult.pointsEarned} de {finalResult.pointsPossible} pontos.{" "}
              {finalResult.scoreMeaning}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {finalResult.feedback.map((item: any, index: number) => (
              <div key={item.key} className="rounded-xl border p-4">
                <p className="font-medium">
                  {index + 1}. {item.prompt}
                </p>
                {Array.isArray(item.selected) &&
                  item.selected.length > 0 &&
                  typeof item.selected[0] === "object" && (
                    <div className="mt-3 space-y-2">
                      {item.selected.map((step: any, stepIndex: number) => (
                        <div
                          key={stepIndex}
                          className="rounded-lg bg-muted/50 p-3 text-sm"
                        >
                          <p className="font-medium">{step.prompt}</p>
                          <p className="mt-1">Sua resposta: {step.selected}</p>
                          {step.feedback && (
                            <p className="mt-1 text-muted-foreground">
                              {step.feedback}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                {item.selected &&
                  (!Array.isArray(item.selected) ||
                    typeof item.selected[0] !== "object") && (
                    <p className="mt-2 text-sm text-slate-600">
                      <strong>Sua resposta:</strong>{" "}
                      {Array.isArray(item.selected)
                        ? item.selected.join(" → ")
                        : item.selected}
                    </p>
                  )}
                <p className="mt-2 text-sm text-slate-600">
                  <strong>Resposta esperada / orientação:</strong>{" "}
                  {item.expectedAnswer}
                </p>
                {item.explanation && (
                  <p className="mt-2 text-sm text-slate-600">
                    {item.explanation}
                  </p>
                )}
                {item.details?.length > 0 && (
                  <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
                    {item.details.map((detail: string, detailIndex: number) => (
                      <li key={detailIndex}>{detail}</li>
                    ))}
                  </ul>
                )}
                {item.criteria && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(item.criteria).map(([name, value]) => (
                      <Badge key={name} variant="outline">
                        {name}: {String(value)}%
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button onClick={closeAttempt}>Voltar à matéria</Button>
              <Button
                variant="outline"
                onClick={() => {
                  const id = attempt.assessmentId;
                  closeAttempt();
                  if (id) start(id, attempt.mode);
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Refazer{" "}
                {finalResult.mode === "practice" ? "prática" : "avaliação"}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    if (attempt && currentQuestion) {
      const options =
        currentQuestion.type === "negotiation"
          ? (activeScenario?.options ?? [])
          : (currentQuestion.config.options ?? []);
      const isMulti = currentQuestion.type === "multiple_select";
      const isOrdering = currentQuestion.type === "ordering";
      const isScenario = currentQuestion.type === "negotiation";
      const submitted = Boolean(
        answerResult &&
        (currentQuestion.type !== "negotiation" ||
          answerResult.questionComplete)
      );
      return (
        <Card className="mx-auto max-w-4xl">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <Badge variant="outline">
                  {attempt.mode === "practice"
                    ? "Modo prática"
                    : "Avaliação formal"}
                </Badge>
                <Badge variant="outline">v{attempt.version}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={closeAttempt}>
                Sair da avaliação
              </Button>
            </div>
            <CardTitle>{attempt.title}</CardTitle>
            <CardDescription>
              Questão {questionIndex + 1} de {attempt.questions.length} ·{" "}
              {currentQuestion.points} ponto(s)
            </CardDescription>
            <Progress
              value={(questionIndex / attempt.questions.length) * 100}
            />
          </CardHeader>
          <CardContent>
            <h3 className="text-lg font-semibold leading-7">
              {currentQuestion.prompt}
            </h3>
            {isScenario && (
              <div className="mt-4 rounded-lg border-l-4 border-primary bg-muted/60 p-4 text-sm leading-6">
                {activeScenario?.clientText}
              </div>
            )}
            {isOrdering && (
              <div className="mt-5 space-y-2">
                {currentQuestion.config.steps.map((step: any) => {
                  const index = orderedIds.indexOf(step.id);
                  return (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={index === 0}
                          onClick={() => moveStep(index, -1)}
                          aria-label="Mover para cima"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={index === orderedIds.length - 1}
                          onClick={() => moveStep(index, 1)}
                          aria-label="Mover para baixo"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <Badge variant="secondary">{index + 1}</Badge>
                      <span className="text-sm">{step.text}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {!isOrdering && (
              <div className="mt-5 space-y-2">
                {options.map((option: any) => {
                  const checked = isMulti
                    ? Array.isArray(selected) && selected.includes(option.id)
                    : selected === option.id;
                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${checked ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    >
                      <input
                        className="mt-1 accent-primary"
                        type={isMulti ? "checkbox" : "radio"}
                        name={`q-${currentQuestion.key}`}
                        checked={checked}
                        disabled={
                          submitted || Boolean(answerResult && !isScenario)
                        }
                        onChange={() =>
                          isMulti
                            ? toggleMulti(option.id)
                            : setSelected(option.id)
                        }
                      />
                      <span className="text-sm leading-6">{option.text}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {answerResult?.feedback && (
              <FeedbackPanel feedback={answerResult.feedback} />
            )}
            {attempt.mode === "formal" && !finalResult && answerResult && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                Resposta registrada. A correção detalhada será exibida ao
                concluir a avaliação.
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-between gap-2">
              {answerResult?.questionComplete &&
                attempt.mode === "practice" &&
                answerResult.feedback?.isCorrect === false &&
                currentQuestion.type !== "negotiation" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelected(
                        currentQuestion.type === "multiple_select" ? [] : ""
                      );
                      setAnswerResult(null);
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Tentar novamente
                  </Button>
                )}
              {!answerResult ||
              (isScenario && !answerResult.questionComplete) ? (
                <Button onClick={sendAnswer} disabled={submitAnswer.isPending}>
                  {submitAnswer.isPending
                    ? "Registrando…"
                    : isScenario
                      ? "Enviar resposta"
                      : "Responder"}
                </Button>
              ) : (
                <Button
                  onClick={nextQuestion}
                  disabled={completeAttempt.isPending}
                >
                  {completeAttempt.isPending
                    ? "Concluindo…"
                    : questionIndex + 1 === attempt.questions.length
                      ? "Concluir e ver resultado"
                      : "Próxima questão"}
                </Button>
              )}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Pontuação: pontos obtidos ÷ pontos possíveis. Em múltipla seleção,
              a pontuação parcial usa respostas corretas selecionadas menos
              incorretas, divididas pelo total de corretas, com mínimo zero.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Setores e matérias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {sectors.map(sector => (
              <div key={sector.id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {sector.name}
                </p>
                <div className="space-y-1">
                  {sector.subjects.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSubjectId(item.id);
                        setLessonId(undefined);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${subjectId === item.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {sectors.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma matéria publicada ainda.
              </p>
            )}
          </CardContent>
        </Card>
        <div className="space-y-5">
          {!subjectId && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Selecione uma matéria para começar.
              </CardContent>
            </Card>
          )}
          {subjectId && subjectLoading && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Carregando matéria…
              </CardContent>
            </Card>
          )}
          {subject && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 text-sm text-muted-foreground">
                        {currentSector?.name} / Matéria
                      </div>
                      <CardTitle className="text-2xl">
                        {subject.title}
                      </CardTitle>
                      <CardDescription className="mt-2 max-w-3xl">
                        {subject.description}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {currentProgress?.progressPercent ?? 0}% concluído
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={currentProgress?.progressPercent ?? 0} />
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>
                      {currentProgress?.completedLessons ?? 0}/
                      {currentProgress?.totalLessons ?? subject.lessons.length}{" "}
                      aulas
                    </span>
                    <span>
                      {currentProgress?.attemptCount ?? 0} avaliações concluídas
                    </span>
                    <span>
                      Última nota:{" "}
                      {currentProgress?.lastScore == null
                        ? "—"
                        : `${currentProgress.lastScore.toFixed(2)}%`}
                    </span>
                    <span>
                      Melhor nota:{" "}
                      {currentProgress?.bestScore == null
                        ? "—"
                        : `${currentProgress.bestScore.toFixed(2)}%`}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    A nota reflete o desempenho naquela tentativa e não define
                    capacidade profissional.{" "}
                    {subject.sourceReference &&
                      `Fonte: ${subject.sourceReference}.`}
                  </p>
                </CardContent>
              </Card>
              <div className="grid gap-5 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Módulos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {subject.lessons.map((lesson: any, index: number) => (
                      <button
                        key={lesson.id}
                        onClick={() => setLessonId(lesson.id)}
                        className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${lessonId === lesson.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">
                            {lesson.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {lesson.summary}
                          </span>
                        </span>
                        {lessonComplete(lesson.id) && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                      </button>
                    ))}
                    {subject.lessons.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Não há aulas publicadas.
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Avaliações</CardTitle>
                    <CardDescription>
                      Prática mostra a correção após cada resposta. Avaliação
                      formal exibe feedback depois da conclusão.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {subject.assessments.map((assessment: any) => (
                      <div
                        key={assessment.id}
                        className="rounded-lg border p-4"
                      >
                        <p className="font-medium">{assessment.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {assessment.description}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {assessment.allowPractice && (
                            <Button
                              size="sm"
                              onClick={() => start(assessment.id, "practice")}
                              disabled={startAttempt.isPending}
                            >
                              <Play className="mr-1 h-4 w-4" />
                              Praticar
                            </Button>
                          )}
                          {assessment.allowFormal && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => start(assessment.id, "formal")}
                              disabled={startAttempt.isPending}
                            >
                              <LockKeyhole className="mr-1 h-4 w-4" />
                              Avaliação formal
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {subject.assessments.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Não há avaliações publicadas.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
              {activeLesson && (
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle>{activeLesson.title}</CardTitle>
                        <CardDescription>
                          {activeLesson.summary}
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markLesson(activeLesson.id)}
                        disabled={savingLesson || markComplete.isPending}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Marcar como estudada
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ContentParagraphs content={activeLesson.content} />
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de tentativas</CardTitle>
                  <CardDescription>
                    Última nota, melhor nota e tentativas individuais permanecem
                    visíveis.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {history.length ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Avaliação</TableHead>
                            <TableHead>Modo</TableHead>
                            <TableHead>Versão</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Nota</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Feedback</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {history.map((row: any) => (
                            <TableRow key={row.id}>
                              <TableCell>{row.assessmentTitle}</TableCell>
                              <TableCell>
                                {row.mode === "practice" ? "Prática" : "Formal"}
                              </TableCell>
                              <TableCell>v{row.assessmentVersion}</TableCell>
                              <TableCell>
                                {row.status === "completed"
                                  ? "Concluída"
                                  : "Em andamento"}
                              </TableCell>
                              <TableCell>
                                {row.score == null
                                  ? "—"
                                  : `${Number(row.score).toFixed(2)}%`}
                              </TableCell>
                              <TableCell>{formatDate(row.startedAt)}</TableCell>
                              <TableCell>
                                {row.status === "completed" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setReviewAttemptId(row.id)}
                                  >
                                    Rever
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      As tentativas que você iniciar aparecerão aqui.
                    </p>
                  )}
                </CardContent>
              </Card>
              {reviewedAttempt && (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle>Revisão · {reviewedAttempt.title}</CardTitle>
                        <CardDescription>
                          {reviewedAttempt.mode === "practice"
                            ? "Prática"
                            : "Avaliação formal"}{" "}
                          · versão {reviewedAttempt.version} ·{" "}
                          {reviewedAttempt.score.toFixed(2)}%
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setReviewAttemptId(undefined)}
                      >
                        Fechar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {reviewedAttempt.feedback.map(
                      (item: any, index: number) => (
                        <div key={item.key} className="rounded-xl border p-4">
                          <p className="font-medium">
                            {index + 1}. {item.prompt}
                          </p>
                          {Array.isArray(item.selected) &&
                          typeof item.selected[0] === "object" ? (
                            <div className="mt-2 space-y-2">
                              {item.selected.map(
                                (step: any, stepIndex: number) => (
                                  <div
                                    key={stepIndex}
                                    className="rounded-lg bg-muted/50 p-3 text-sm"
                                  >
                                    <p className="font-medium">{step.prompt}</p>
                                    <p className="mt-1">
                                      Sua resposta: {step.selected}
                                    </p>
                                    {step.feedback && (
                                      <p className="mt-1 text-muted-foreground">
                                        {step.feedback}
                                      </p>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          ) : (
                            item.selected && (
                              <p className="mt-2 text-sm text-muted-foreground">
                                <strong>Sua resposta:</strong>{" "}
                                {Array.isArray(item.selected)
                                  ? item.selected.join(" → ")
                                  : item.selected}
                              </p>
                            )
                          )}
                          <p className="mt-2 text-sm">
                            <strong>Esperado:</strong> {item.expectedAnswer}
                          </p>
                          {item.explanation && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {item.explanation}
                            </p>
                          )}
                          {item.details?.length > 0 && (
                            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                              {item.details.map(
                                (detail: string, detailIndex: number) => (
                                  <li key={detailIndex}>{detail}</li>
                                )
                              )}
                            </ul>
                          )}
                        </div>
                      )
                    )}
                    <p className="text-xs text-muted-foreground">
                      {reviewedAttempt.scoreMeaning}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escola Corporativa"
        description="Aprenda, pratique e acompanhe sua evolução por setor e matéria."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="study">Estudar</TabsTrigger>
          {canManage && (
            <TabsTrigger value="manage">Administrar conteúdo</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="study" className="mt-5">
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Carregando matérias…
              </CardContent>
            </Card>
          ) : (
            studentBody()
          )}
        </TabsContent>
        {canManage && (
          <TabsContent value="manage" className="mt-5">
            <TrainingAdmin
              onChanged={() => {
                utils.treinamento.myProgress.invalidate();
              }}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
