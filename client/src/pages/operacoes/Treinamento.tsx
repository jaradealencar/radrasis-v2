import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  GraduationCap,
  GripVertical,
  LockKeyhole,
  Mic,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  ShieldCheck,
  Target,
  Trash2,
  Trophy,
  Upload,
  Volume2,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { enviarArquivo } from "@/lib/upload";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type AttemptView = {
  assessmentId: number;
  attemptId: number;
  assignmentStudentId?: number;
  initialQuestionIndex?: number;
  currentQuestionAnswered?: boolean;
  mode: "practice" | "formal";
  title: string;
  version: number;
  progresso?: AttemptProgress;
  questions: Array<{
    key: string;
    type: string;
    prompt: string;
    points: number;
    config: any;
  }>;
};

type AttemptProgress = {
  perguntasRespondidas: number;
  totalPerguntas: number;
  questoesRestantes: number;
  percentualConcluido: number;
  percentualRestante: number;
  pontosGanhos: number;
  pontosPossiveisRespondidos: number;
  percentualAcerto: number | null;
};

type SimulatedAttempt = {
  id: string;
  assessment: string;
  subject: string;
  score: number;
  startedAt: string;
};

type SimulatedStudent = {
  id: string;
  name: string;
  attempts: SimulatedAttempt[];
};

type OrderingStep = { id: string; text: string };

type GeneratedCoursePreview = {
  subjectTitle: string;
  subjectDescription: string;
  lessonTitle: string;
  lessonSummary: string;
  lessonContent: string;
  assessmentTitle: string;
  assessmentDescription: string;
  questions: Array<{
    key: string;
    type: "best_response";
    prompt: string;
    points: number;
    position: number;
    config: {
      options: Array<{
        id: string;
        text: string;
        correct: boolean;
        feedback: string;
      }>;
      explanation: string;
    };
  }>;
  sourceFile: {
    fileName: string;
    url: string;
    fileKey: string;
    mimeType: string;
    sizeBytes: number;
  };
};

function OrderingStepRow({
  step,
  index,
  total,
  disabled,
  onMove,
}: {
  step: OrderingStep;
  index: number;
  total: number;
  disabled: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="flex items-center gap-2 rounded-lg border bg-card p-3"
    >
      <div className="flex shrink-0 flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={disabled || index === 0}
          onClick={() => onMove(index, -1)}
          aria-label={`Mover ${step.text} para cima`}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={disabled || index === total - 1}
          onClick={() => onMove(index, 1)}
          aria-label={`Mover ${step.text} para baixo`}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
      <Badge variant="secondary" className="shrink-0">
        {index + 1}
      </Badge>
      <span className="min-w-0 flex-1 text-sm">{step.text}</span>
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label={`Reordenar etapa ${index + 1}: ${step.text}. Use espaço e as setas.`}
        title="Arraste ou pressione espaço e use as setas para mover"
        className="touch-none cursor-grab rounded-md p-2 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

const QUESTIONS_PER_MODULE = 10;

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

const QUESTION_PROFILES = [
  { type: "multiple_choice", label: "Múltipla escolha" },
  { type: "multiple_select", label: "Múltipla seleção" },
  { type: "matching", label: "Conectar elementos" },
  { type: "sum", label: "Somatório" },
  { type: "fill_blank", label: "Completar palavras" },
  { type: "ordering", label: "Ordenar etapas" },
  { type: "best_response", label: "Melhor resposta" },
  { type: "negotiation", label: "Simulação de negociação" },
  { type: "true_false", label: "Verdadeiro ou falso" },
  { type: "yes_no_matrix", label: "Sim ou não por frase" },
  { type: "short_answer", label: "Resposta curta" },
] as const;
type QuestionProfile = (typeof QUESTION_PROFILES)[number]["type"];

function parseQuestionJson(raw: string): any[] | null {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function questionProfileTemplate(type: QuestionProfile) {
  const templates: Record<
    QuestionProfile,
    { label: string; prompt: string; config: Record<string, unknown> }
  > = {
    multiple_choice: {
      label: "Múltipla escolha",
      prompt: "Escreva a pergunta de múltipla escolha.",
      config: {
        options: [
          { id: "a", text: "Alternativa correta", correct: true },
          { id: "b", text: "Outra alternativa", correct: false },
        ],
        explanation: "Explique por que essa é a resposta esperada.",
      },
    },
    multiple_select: {
      label: "Múltipla seleção",
      prompt: "Selecione todas as alternativas corretas.",
      config: {
        allowPartialCredit: true,
        options: [
          { id: "a", text: "Alternativa correta", correct: true },
          { id: "b", text: "Alternativa incorreta", correct: false },
          { id: "c", text: "Outra alternativa correta", correct: true },
        ],
        explanation: "Explique o critério de seleção.",
      },
    },
    matching: {
      label: "Conectar elementos",
      prompt: "Relacione cada situação à melhor ação.",
      config: {
        allowPartialCredit: true,
        leftItems: [
          {
            id: "etapa-1",
            text: "O cliente pede desconto, mas não diz o que pode mudar.",
          },
          {
            id: "etapa-2",
            text: "O cliente vai conversar com o sócio antes de decidir.",
          },
        ],
        rightItems: [
          {
            id: "descricao-1",
            text: "Perguntar o que precisa manter e conferir se existe outra opção segura.",
          },
          {
            id: "descricao-2",
            text: "Combinar quando falar de novo e perguntar se falta alguma informação.",
          },
          {
            id: "distrator-1",
            text: "Oferecer outra condição antes de conferir os custos e pedir aprovação.",
          },
          {
            id: "distrator-2",
            text: "Enviar o catálogo inteiro e deixar que o cliente procure as diferenças.",
          },
        ],
        correctPairs: [
          { leftId: "etapa-1", rightId: "descricao-1" },
          { leftId: "etapa-2", rightId: "descricao-2" },
        ],
      },
    },
    sum: {
      label: "Somatório",
      prompt: "Selecione os itens corretos e some os valores indicados.",
      config: {
        options: [
          { id: "1", text: "Afirmação 1", value: 1, correct: true },
          { id: "2", text: "Afirmação 2", value: 2, correct: false },
          { id: "4", text: "Afirmação 3", value: 4, correct: true },
        ],
      },
    },
    fill_blank: {
      label: "Completar palavras",
      prompt: "Complete: O closer primeiro {{1}} o cliente.",
      config: {
        allowPartialCredit: true,
        blanks: [{ id: "1", acceptedAnswers: ["escuta"] }],
      },
    },
    ordering: {
      label: "Ordenar etapas",
      prompt: "Organize as etapas na ordem correta.",
      config: {
        steps: [
          { id: "etapa-1", text: "Primeira etapa" },
          { id: "etapa-2", text: "Segunda etapa" },
          { id: "etapa-3", text: "Terceira etapa" },
        ],
        correctOrder: ["etapa-1", "etapa-2", "etapa-3"],
      },
    },
    best_response: {
      label: "Melhor resposta",
      prompt: "Qual é a melhor resposta para a situação apresentada?",
      config: {
        options: [
          { id: "a", text: "Resposta mais adequada", correct: true },
          { id: "b", text: "Resposta menos adequada", correct: false },
        ],
        explanation: "Explique o que torna essa resposta mais adequada.",
      },
    },
    negotiation: {
      label: "Simulação de negociação",
      prompt: "Como você conduziria esta conversa com o cliente?",
      config: {
        nodes: [
          {
            id: "inicio",
            clientText: "O cliente apresenta uma situação para você conduzir.",
            options: [
              {
                id: "adequada",
                text: "Resposta adequada",
                score: 100,
                feedback: "Explique por que essa condução funciona.",
              },
              {
                id: "inadequada",
                text: "Resposta a revisar",
                score: 0,
                feedback: "Explique o que pode ser melhorado.",
              },
            ],
          },
        ],
        finalFeedback: "Descreva os critérios gerais da simulação.",
      },
    },
    true_false: {
      label: "Verdadeiro ou falso",
      prompt: "A afirmação apresentada está correta?",
      config: { correctBoolean: true },
    },
    yes_no_matrix: {
      label: "Sim ou não por frase",
      prompt: "Para cada frase, marque Sim ou Não.",
      config: {
        statements: [
          {
            id: "frase-1",
            text: "Escreva uma frase para avaliar.",
            correctBoolean: true,
            feedback: "Explique por que a resposta é Sim ou Não.",
          },
          {
            id: "frase-2",
            text: "Escreva outra frase sobre o mesmo assunto.",
            correctBoolean: false,
            feedback: "Explique o critério usado nesta frase.",
          },
        ],
        explanation: "Explique o critério geral da questão.",
      },
    },
    short_answer: {
      label: "Resposta curta",
      prompt: "Responda com uma frase curta.",
      config: { acceptedAnswers: ["resposta aceita"] },
    },
  };
  return templates[type];
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function TrainingLoadError({
  errorCode,
  onRetry,
  isRetrying,
}: {
  errorCode?: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <Card className="m-6 max-w-2xl border-amber-300">
      <CardHeader>
        <CardTitle>Não foi possível carregar o treinamento</CardTitle>
        <CardDescription>
          Este ambiente pode ainda não ter recebido as tabelas da Escola
          Corporativa. Depois que o banco for atualizado, tente novamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {errorCode && (
          <p className="text-xs text-muted-foreground">
            Código do erro: {errorCode}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          disabled={isRetrying}
        >
          {isRetrying ? "Tentando novamente…" : "Tentar novamente"}
        </Button>
      </CardContent>
    </Card>
  );
}

async function downloadAssessmentMaterial(url: string, name: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("O arquivo não pôde ser acessado.");
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    toast.error("Não foi possível baixar o arquivo. Tente consultá-lo online.");
  }
}

function localDateTimeDaysFromNow(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
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

function SpeechReadButton({ text }: { text: string }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window)
        window.speechSynthesis.cancel();
    },
    []
  );

  if (!canSpeak || !text.trim()) return null;

  const toggleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = "pt-BR";
    utterance.rate = 0.94;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleSpeech}
      aria-pressed={isSpeaking}
      aria-label={isSpeaking ? "Parar áudio" : "Ouvir explicação"}
      className="shrink-0 rounded-full border-sky-200 bg-white/80"
    >
      {isSpeaking ? (
        <Square className="h-4 w-4 fill-current" />
      ) : (
        <Volume2 className="h-4 w-4" />
      )}
      {isSpeaking ? "Parar áudio" : "Ouvir explicação"}
    </Button>
  );
}

function YesNoMatrixReview({ responses }: { responses: any[] }) {
  if (!responses?.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {responses.map(item => (
        <div key={item.id} className="rounded-xl border bg-white p-3 text-sm">
          <p className="font-medium leading-6">{item.text}</p>
          <p className="mt-1 text-slate-600">
            Sua resposta: <strong>{item.selectedAnswer}</strong>
          </p>
          {!item.isCorrect && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="font-semibold text-amber-950">
                Correção: a resposta esperada é {item.expectedAnswer}.
              </p>
              {item.feedback && (
                <p className="mt-1 leading-6 text-slate-700">{item.feedback}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FeedbackPanel({
  feedback,
  hideExpectedAnswer = false,
  hideDetails = false,
}: {
  feedback: any;
  hideExpectedAnswer?: boolean;
  hideDetails?: boolean;
}) {
  if (!feedback) return null;
  const audioText =
    feedback.audioText ||
    [
      feedback.selectedText ? `Sua escolha: ${feedback.selectedText}` : "",
      !hideExpectedAnswer && feedback.expectedAnswer
        ? `Resposta esperada: ${feedback.expectedAnswer}`
        : "",
      feedback.explanation,
      ...(feedback.details ?? []),
      ...(feedback.corrections ?? []).map(
        (item: any) =>
          `Na opção ${item.text}, o correto era ${item.expectedAnswer.toLowerCase()}. ${item.feedback ?? ""}`
      ),
    ]
      .filter(Boolean)
      .join(". ");
  return (
    <div
      className={`mt-5 rounded-2xl border p-4 shadow-sm ${feedback.isCorrect ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white" : "border-amber-200 bg-gradient-to-br from-amber-50 to-white"}`}
    >
      <div className="flex items-center gap-2 font-semibold">
        {feedback.isCorrect ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
        ) : (
          <ShieldCheck className="h-5 w-5 text-amber-700" />
        )}
        {feedback.isCorrect ? "Boa escolha" : "Vamos revisar o raciocínio"}
      </div>
      <div className="mt-3">
        <SpeechReadButton text={audioText} />
      </div>
      {feedback.selectedText && (
        <p className="mt-2 text-sm text-slate-700">
          Sua escolha: {feedback.selectedText}
        </p>
      )}
      {!hideExpectedAnswer && feedback.expectedAnswer && (
        <p className="mt-2 text-sm text-slate-700">
          <strong>Resposta esperada:</strong> {feedback.expectedAnswer}
        </p>
      )}
      {feedback.explanation && (
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {feedback.explanation}
        </p>
      )}
      {!hideDetails && feedback.details?.length > 0 && (
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

function OptionCorrection({ correction }: { correction: any }) {
  const action = correction.expectedAnswer.toLowerCase();
  return (
    <div
      role="status"
      className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950"
    >
      <p className="font-semibold">
        Correção: o correto era {action} esta opção.
      </p>
      {correction.feedback && <p className="mt-1">{correction.feedback}</p>}
    </div>
  );
}

function MultipleSelectCorrections({ corrections }: { corrections: any[] }) {
  if (!corrections.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {corrections.map(correction => (
        <div
          key={correction.id}
          className="rounded-xl border border-amber-200 bg-amber-50/50 p-3"
        >
          <p className="mb-2 text-sm font-medium text-slate-900">
            {correction.text}
          </p>
          <OptionCorrection correction={correction} />
        </div>
      ))}
    </div>
  );
}

function multipleSelectCorrectionAudio(corrections: any[]) {
  return corrections
    .map(
      correction =>
        `Na opção ${correction.text}, o correto era ${correction.expectedAnswer.toLowerCase()}. ${correction.feedback ?? ""}`
    )
    .join(" ");
}

function TrainingAdmin({ onChanged }: { onChanged: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading, error, refetch, isRefetching } =
    trpc.treinamento.adminCatalog.useQuery();
  const [sectorId, setSectorId] = useState<number | undefined>();
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [lessonId, setLessonId] = useState<number | undefined>();
  const [assessmentId, setAssessmentId] = useState<number | undefined>();
  const [sector, setSector] = useState<any>(EMPTY_SECTOR);
  const [subject, setSubject] = useState<any>(EMPTY_SUBJECT);
  const [lesson, setLesson] = useState<any>(EMPTY_LESSON);
  const [assessment, setAssessment] = useState<any>(EMPTY_ASSESSMENT);
  const [questionJson, setQuestionJson] = useState("[]");
  const [regeneratingQuestionKey, setRegeneratingQuestionKey] = useState<
    string | null
  >(null);
  const [questionAiInstructions, setQuestionAiInstructions] = useState<
    Record<string, string>
  >({});
  const [questionProfile, setQuestionProfile] =
    useState<QuestionProfile>("multiple_choice");
  const [newQuestionPrompt, setNewQuestionPrompt] = useState("");
  const [newQuestionPoints, setNewQuestionPoints] = useState(1);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [materialUploadProgress, setMaterialUploadProgress] = useState(0);
  const materialInputRef = useRef<HTMLInputElement>(null);
  const [popFile, setPopFile] = useState<File | null>(null);
  const [popSectorId, setPopSectorId] = useState<number | undefined>();
  const [popQuestionCount, setPopQuestionCount] = useState(10);
  const [popUploadProgress, setPopUploadProgress] = useState(0);
  const [isPreparingPop, setIsPreparingPop] = useState(false);
  const [popUploadedFile, setPopUploadedFile] = useState<{
    url: string;
    key: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  } | null>(null);
  const [popDraft, setPopDraft] = useState<GeneratedCoursePreview | null>(null);
  const popInputRef = useRef<HTMLInputElement>(null);
  const [reportFilter, setReportFilter] = useState<number | undefined>();
  const [assignmentAssessmentId, setAssignmentAssessmentId] = useState<
    number | undefined
  >();
  const [assignmentDeadline, setAssignmentDeadline] = useState(() =>
    localDateTimeDaysFromNow(7)
  );
  const [assignmentMaxAttempts, setAssignmentMaxAttempts] = useState(1);
  const [assignmentStudentIds, setAssignmentStudentIds] = useState<string[]>(
    []
  );
  const { data: lessonVersions = [] } =
    trpc.treinamento.lessonVersions.useQuery(
      { lessonId: lessonId ?? 0 },
      { enabled: Boolean(lessonId) }
    );
  const {
    data: assessmentMaterials = [],
    isLoading: assessmentMaterialsLoading,
  } = trpc.treinamento.listAssessmentMaterials.useQuery(
    { assessmentId: assessmentId ?? 0 },
    { enabled: Boolean(assessmentId) }
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
    onError: error =>
      toast.error(
        error.message.includes("opções extras")
          ? "Inclua duas opções erradas que façam sentido para esta pergunta e use textos diferentes."
          : error.message.includes("opções próprias")
            ? "Cada questão de associação precisa de alternativas diferentes. Revise os textos repetidos."
            : error.message
      ),
  });
  const regenerateQuestionWithAI =
    trpc.treinamento.regenerateQuestionWithAI.useMutation();
  const generateFromPop = trpc.treinamento.generateFromPop.useMutation();
  const saveGeneratedCourse = trpc.treinamento.saveGeneratedCourse.useMutation({
    onSuccess: async result => {
      await utils.treinamento.adminCatalog.invalidate();
      await utils.treinamento.catalog.invalidate();
      setSubjectId(result.subjectId);
      setLessonId(result.lessonId);
      setAssessmentId(result.assessmentId);
      setPopDraft(null);
      setPopFile(null);
      if (popInputRef.current) popInputRef.current.value = "";
      toast.success(
        "Mat\u00e9ria, aula e avalia\u00e7\u00e3o salvas como rascunho. Revise e publique quando estiverem prontas."
      );
      onChanged();
    },
    onError: error => toast.error(error.message),
  });
  const addAssessmentMaterial =
    trpc.treinamento.addAssessmentMaterial.useMutation({
      onSuccess: async () => {
        if (assessmentId)
          await utils.treinamento.listAssessmentMaterials.invalidate({
            assessmentId,
          });
        if (assessment?.subjectId)
          await utils.treinamento.subject.invalidate({
            id: assessment.subjectId,
          });
        toast.success("Material de apoio anexado à avaliação.");
      },
    });
  const createExamAssignment =
    trpc.treinamento.createExamAssignment.useMutation({
      onSuccess: async result => {
        await utils.treinamento.assignmentReport.invalidate();
        setAssignmentStudentIds([]);
        toast.success(
          "Prova aplicada a " +
            result.assigned +
            " aluno(s). Prazo e limite de tentativas configurados."
        );
      },
      onError: error => toast.error(error.message),
    });
  const { data: results = [], isLoading: resultsLoading } =
    trpc.treinamento.resultsReport.useQuery({ subjectId: reportFilter });
  const { data: leaderboards = [], isLoading: leaderboardsLoading } =
    trpc.treinamento.leaderboardReport.useQuery({ subjectId: reportFilter });
  const assignmentAssessment = data?.assessments.find(
    item => item.id === assignmentAssessmentId
  );
  const { data: enrolledStudents = [], isLoading: enrolledStudentsLoading } =
    trpc.treinamento.enrolledStudents.useQuery(
      { subjectId: assignmentAssessment?.subjectId ?? 0 },
      { enabled: Boolean(assignmentAssessment?.subjectId) }
    );
  const { data: examAssignments = [], isLoading: examAssignmentsLoading } =
    trpc.treinamento.assignmentReport.useQuery({});
  const [simulationStudents, setSimulationStudents] = useState<
    SimulatedStudent[]
  >([]);
  const [simulationStudentCount, setSimulationStudentCount] = useState(12);
  const [simulationMaxAttempts, setSimulationMaxAttempts] = useState(4);
  const [simulationDays, setSimulationDays] = useState(30);
  const studentSummaries = useMemo(() => {
    const grouped = new Map<
      string,
      { name: string; attempts: typeof results }
    >();
    for (const attempt of results) {
      const student = grouped.get(attempt.userId) ?? {
        name: attempt.userName,
        attempts: [],
      };
      student.attempts.push(attempt);
      grouped.set(attempt.userId, student);
    }
    return [...grouped.entries()]
      .map(([userId, student]) => ({ userId, ...student }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [results]);
  const editorQuestions = useMemo(
    () => parseQuestionJson(questionJson),
    [questionJson]
  );

  useEffect(() => {
    if (!data) return;
    if (popSectorId === undefined) {
      const activeSector = data.sectors.find(row => !row.archivedAt);
      if (activeSector) setPopSectorId(activeSector.id);
    }
    if (sectorId === undefined && data.sectors[0])
      setSectorId(data.sectors[0].id);
    if (subjectId === undefined && data.subjects[0])
      setSubjectId(data.subjects[0].id);
    if (lessonId === undefined && data.lessons[0])
      setLessonId(data.lessons[0].id);
    if (assessmentId === undefined && data.assessments[0])
      setAssessmentId(data.assessments[0].id);
  }, [data, sectorId, subjectId, lessonId, assessmentId, popSectorId]);

  useEffect(() => {
    if (assignmentAssessmentId !== undefined || !data) return;
    const firstFormalAssessment = data.assessments.find(
      item => item.allowFormal && item.isPublished && !item.archivedAt
    );
    if (firstFormalAssessment)
      setAssignmentAssessmentId(firstFormalAssessment.id);
  }, [data, assignmentAssessmentId]);

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
      setQuestionAiInstructions({});
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

  if (isLoading)
    return (
      <p className="p-6 text-sm text-slate-500">
        Carregando conteúdo de autoria…
      </p>
    );
  if (error || !data)
    return (
      <TrainingLoadError
        errorCode={error?.data?.code}
        onRetry={() => void refetch()}
        isRetrying={isRefetching}
      />
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

  const updateQuestionList = (update: (questions: any[]) => any[]) => {
    setQuestionJson(currentJson => {
      const questions = parseQuestionJson(currentJson);
      if (!questions) return currentJson;
      return JSON.stringify(update(questions), null, 2);
    });
  };

  const regenerateQuestion = async (question: any) => {
    const questionKey = String(question.key ?? "");
    if (!questionKey) {
      toast.error(
        "Salve a chave da pergunta antes de pedir uma nova vers\u00e3o."
      );
      return;
    }
    const extraInstruction = questionAiInstructions[questionKey]?.trim();
    setRegeneratingQuestionKey(questionKey);
    try {
      const context = [
        subject.title ? `Mat\u00e9ria: ${subject.title}` : "",
        subject.description
          ? `Sobre a mat\u00e9ria: ${subject.description}`
          : "",
        lesson.title ? `Aula: ${lesson.title}` : "",
        lesson.content ? `Conte\u00fado da aula: ${lesson.content}` : "",
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 20_000);
      const regenerated = await regenerateQuestionWithAI.mutateAsync({
        question,
        assessmentTitle: assessment.title,
        assessmentDescription: assessment.description,
        context,
        extraInstruction,
      });
      updateQuestionList(questions => {
        const index = questions.findIndex(
          item => String(item.key ?? "") === questionKey
        );
        if (index < 0) return questions;
        const current = questions[index];
        const replacement = {
          ...regenerated,
          key: current.key,
          type: current.type,
          points: current.points,
          position: current.position,
        };
        return questions.map((item, itemIndex) =>
          itemIndex === index ? replacement : item
        );
      });
      toast.success(
        "A pergunta foi refeita. Revise o novo enunciado e o gabarito."
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "N\u00e3o consegui refazer a pergunta agora. Tente novamente."
      );
    } finally {
      setRegeneratingQuestionKey(null);
    }
  };

  const updateQuestionPrompt = (questionIndex: number, prompt: string) => {
    updateQuestionList(questions =>
      questions.map((question, index) =>
        index === questionIndex ? { ...question, prompt } : question
      )
    );
  };

  const updateQuestionOption = (
    questionIndex: number,
    optionIndex: number,
    updates: Record<string, unknown>
  ) => {
    updateQuestionList(questions =>
      questions.map((question, index) => {
        if (index !== questionIndex) return question;
        const options = Array.isArray(question.config?.options)
          ? question.config.options
          : [];
        return {
          ...question,
          config: {
            ...question.config,
            options: options.map((option: any, currentIndex: number) =>
              currentIndex === optionIndex ? { ...option, ...updates } : option
            ),
          },
        };
      })
    );
  };

  const setQuestionOptionCorrect = (
    questionIndex: number,
    optionIndex: number
  ) => {
    const question = editorQuestions?.[questionIndex];
    const options = Array.isArray(question?.config?.options)
      ? question.config.options
      : [];
    if (!question || !options.length) return;
    const multipleCorrect = ["multiple_select", "sum"].includes(question.type);
    if (multipleCorrect && options[optionIndex]?.correct) {
      if (options.filter((option: any) => option.correct).length === 1) {
        toast.error("Mantenha pelo menos uma alternativa correta.");
        return;
      }
      updateQuestionOption(questionIndex, optionIndex, { correct: false });
      return;
    }
    if (multipleCorrect) {
      updateQuestionOption(questionIndex, optionIndex, { correct: true });
      return;
    }
    updateQuestionList(questions =>
      questions.map((item, index) => {
        if (index !== questionIndex) return item;
        const currentOptions = Array.isArray(item.config?.options)
          ? item.config.options
          : [];
        return {
          ...item,
          config: {
            ...item.config,
            options: currentOptions.map(
              (option: any, currentIndex: number) => ({
                ...option,
                correct: currentIndex === optionIndex,
              })
            ),
          },
        };
      })
    );
  };

  const addQuestionOption = (questionIndex: number) => {
    const currentOptions = editorQuestions?.[questionIndex]?.config?.options;
    if (!Array.isArray(currentOptions)) return;
    if (currentOptions.length >= 12) {
      toast.error("Cada pergunta pode ter no m\u00e1ximo 12 alternativas.");
      return;
    }
    updateQuestionList(questions =>
      questions.map((question, index) => {
        if (index !== questionIndex) return question;
        const options = Array.isArray(question.config?.options)
          ? [...question.config.options]
          : [];
        const newOption: Record<string, unknown> = {
          id: `opcao-${Date.now()}-${options.length + 1}`,
          text: "Nova alternativa",
          correct: false,
          feedback: "",
        };
        if (question.type === "sum") newOption.value = 0;
        options.push(newOption);
        return { ...question, config: { ...question.config, options } };
      })
    );
  };

  const deleteQuestionOption = (questionIndex: number, optionIndex: number) => {
    const options = editorQuestions?.[questionIndex]?.config?.options;
    const question = editorQuestions?.[questionIndex];
    if (!Array.isArray(options) || options.length <= 2) {
      toast.error("Mantenha pelo menos duas alternativas na pergunta.");
      return;
    }
    const multipleCorrect = ["multiple_select", "sum"].includes(question?.type);
    if (
      options[optionIndex]?.correct &&
      options.filter((option: any) => option.correct).length <= 1 &&
      multipleCorrect
    ) {
      toast.error("Mantenha pelo menos uma alternativa correta.");
      return;
    }
    updateQuestionList(questions =>
      questions.map((question, index) => {
        if (index !== questionIndex) return question;
        const nextOptions = question.config.options.filter(
          (_option: any, currentIndex: number) => currentIndex !== optionIndex
        );
        if (
          !multipleCorrect &&
          question.config.options[optionIndex]?.correct &&
          nextOptions.length > 0
        ) {
          nextOptions[0] = { ...nextOptions[0], correct: true };
        }
        return {
          ...question,
          config: { ...question.config, options: nextOptions },
        };
      })
    );
  };

  const addMatchingOption = (questionIndex: number) => {
    const question = editorQuestions?.[questionIndex];
    const rightItems = question?.config?.rightItems;
    if (!Array.isArray(rightItems) || rightItems.length >= 20) {
      toast.error("Esta pergunta pode ter no máximo 20 alternativas.");
      return;
    }
    updateQuestionConfig(questionIndex, config => ({
      ...config,
      rightItems: [
        ...config.rightItems,
        {
          id: `resposta-${Date.now()}-${rightItems.length + 1}`,
          text: "Nova resposta",
        },
      ],
    }));
  };

  const deleteMatchingOption = (questionIndex: number, rightId: string) => {
    const question = editorQuestions?.[questionIndex];
    const rightItems = question?.config?.rightItems;
    const leftItems = question?.config?.leftItems;
    if (!Array.isArray(rightItems) || !Array.isArray(leftItems)) return;
    if (rightItems.length <= leftItems.length + 2) {
      toast.error(
        "Mantenha duas alternativas erradas além das respostas certas."
      );
      return;
    }
    if (
      question.config?.correctPairs?.some(
        (pair: any) => pair.rightId === rightId
      )
    ) {
      toast.error(
        "Escolha outra resposta certa antes de excluir esta alternativa."
      );
      return;
    }
    updateQuestionConfig(questionIndex, config => ({
      ...config,
      rightItems: config.rightItems.filter((item: any) => item.id !== rightId),
    }));
  };

  const changeOrderingPosition = (
    questionIndex: number,
    position: number,
    selectedId: string
  ) => {
    updateQuestionConfig(questionIndex, config => {
      const order = Array.isArray(config.correctOrder)
        ? [...config.correctOrder]
        : config.steps.map((item: any) => item.id);
      const previousId = order[position];
      const selectedPosition = order.indexOf(selectedId);
      if (selectedPosition >= 0) {
        order[selectedPosition] = previousId;
      }
      order[position] = selectedId;
      return { ...config, correctOrder: order };
    });
  };

  const addNegotiationOption = (questionIndex: number, nodeIndex: number) => {
    const node = editorQuestions?.[questionIndex]?.config?.nodes?.[nodeIndex];
    const options = node?.options;
    if (!Array.isArray(options) || options.length >= 12) {
      toast.error("Cada situação pode ter no máximo 12 respostas.");
      return;
    }
    updateQuestionConfig(questionIndex, config => ({
      ...config,
      nodes: config.nodes.map((item: any, index: number) =>
        index === nodeIndex
          ? {
              ...item,
              options: [
                ...item.options,
                {
                  id: `resposta-${Date.now()}-${options.length + 1}`,
                  text: "Nova resposta",
                  score: 0,
                  feedback: "",
                },
              ],
            }
          : item
      ),
    }));
  };

  const deleteNegotiationOption = (
    questionIndex: number,
    nodeIndex: number,
    optionIndex: number
  ) => {
    const options =
      editorQuestions?.[questionIndex]?.config?.nodes?.[nodeIndex]?.options;
    if (!Array.isArray(options) || options.length <= 2) {
      toast.error("Mantenha pelo menos duas respostas na situação.");
      return;
    }
    updateQuestionConfig(questionIndex, config => ({
      ...config,
      nodes: config.nodes.map((item: any, index: number) =>
        index === nodeIndex
          ? {
              ...item,
              options: item.options.filter(
                (_option: any, currentIndex: number) =>
                  currentIndex !== optionIndex
              ),
            }
          : item
      ),
    }));
  };

  const deleteQuestion = (questionIndex: number) => {
    if (!window.confirm("Excluir esta pergunta da avaliação?")) return;
    updateQuestionList(questions =>
      questions.filter((_question, index) => index !== questionIndex)
    );
  };

  const updateQuestionConfig = (
    questionIndex: number,
    update: (config: any) => any
  ) => {
    updateQuestionList(questions =>
      questions.map((question, index) =>
        index === questionIndex
          ? { ...question, config: update(question.config ?? {}) }
          : question
      )
    );
  };

  const selectPopFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!file) return;
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) {
      toast.error("Envie um POP em PDF, DOCX ou TXT.");
      return;
    }
    const maximumSize = /\.txt$/i.test(file.name)
      ? 8 * 1024 * 1024
      : 32 * 1024 * 1024;
    if (file.size < 1 || file.size > maximumSize) {
      toast.error(
        /\.txt$/i.test(file.name)
          ? "O arquivo TXT pode ter no m\u00e1ximo 8 MB."
          : "O arquivo precisa ter entre 1 byte e 32 MB."
      );
      return;
    }
    setPopFile(file);
    setPopUploadedFile(null);
    setPopDraft(null);
  };

  const generateCourseFromPop = async () => {
    if (!popSectorId) {
      toast.error("Crie ou escolha um setor ativo primeiro.");
      return;
    }
    if (!popFile) {
      toast.error("Escolha o arquivo POP que deseja usar.");
      return;
    }
    setPopUploadProgress(0);
    setIsPreparingPop(true);
    try {
      const uploaded =
        popUploadedFile ??
        (await enviarArquivo("materialAvaliacao", popFile, {
          onProgress: setPopUploadProgress,
        }));
      if (!popUploadedFile) setPopUploadedFile(uploaded);
      setPopUploadProgress(100);
      const result = await generateFromPop.mutateAsync({
        sectorId: popSectorId,
        questionCount: popQuestionCount,
        sourceFile: {
          fileName: uploaded.fileName,
          url: uploaded.url,
          fileKey: uploaded.key,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.fileSize,
        },
      });
      setPopDraft({
        ...result,
        questions: result.questions.map(question => ({
          ...question,
          type: "best_response" as const,
          config: {
            ...question.config,
            options: (question.config.options ?? []).map(option => ({
              id: option.id,
              text: option.text,
              correct: Boolean(option.correct),
              feedback: option.feedback ?? "",
            })),
            explanation: question.config.explanation ?? "",
          },
        })),
      });
      setPopFile(null);
      setPopUploadedFile(null);
      toast.success("Rascunho gerado. Revise o conteúdo antes de salvar.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "N\u00e3o consegui gerar o rascunho. Confira o arquivo e tente novamente."
      );
    } finally {
      setIsPreparingPop(false);
    }
  };

  const updatePopDraft = (
    update: (draft: GeneratedCoursePreview) => GeneratedCoursePreview
  ) => {
    setPopDraft(current => (current ? update(current) : current));
  };

  const savePopDraft = () => {
    if (!popDraft) return;
    const slug = slugify(popDraft.subjectTitle) || `materia-pop-${Date.now()}`;
    saveGeneratedCourse.mutate({
      sectorId: popSectorId ?? 0,
      subject: {
        title: popDraft.subjectTitle,
        slug,
        description: popDraft.subjectDescription,
      },
      lesson: {
        title: popDraft.lessonTitle,
        summary: popDraft.lessonSummary,
        content: popDraft.lessonContent,
      },
      assessment: {
        title: popDraft.assessmentTitle,
        description: popDraft.assessmentDescription,
      },
      questions: popDraft.questions,
      sourceFile: popDraft.sourceFile,
    });
  };

  const discardPopDraft = () => {
    setPopDraft(null);
    setPopFile(null);
    setPopUploadedFile(null);
    if (popInputRef.current) popInputRef.current.value = "";
  };

  const uploadAssessmentMaterial = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!assessmentId) {
      toast.error("Salve a avaliação antes de anexar materiais.");
      return;
    }
    if (!/\.(pdf|docx?|pptx?|xlsx?|txt|png|jpe?g|webp)$/i.test(file.name)) {
      toast.error(
        "Envie PDF, Word, PowerPoint, Excel, TXT ou uma imagem PNG/JPG/WEBP."
      );
      return;
    }
    if (file.size > 32 * 1024 * 1024) {
      toast.error("O arquivo pode ter no máximo 32 MB.");
      return;
    }

    setUploadingMaterial(true);
    setMaterialUploadProgress(0);
    let uploaded = false;
    try {
      const uploadedFile = await enviarArquivo("materialAvaliacao", file, {
        onProgress: setMaterialUploadProgress,
      });
      uploaded = true;
      await addAssessmentMaterial.mutateAsync({
        assessmentId,
        name: uploadedFile.fileName,
        url: uploadedFile.url,
        fileKey: uploadedFile.key,
        mimeType: uploadedFile.mimeType,
        sizeBytes: uploadedFile.fileSize,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";
      toast.error(
        uploaded
          ? `O arquivo foi enviado, mas não foi vinculado à avaliação: ${message}`
          : `Não foi possível enviar o material: ${message}`
      );
    } finally {
      setUploadingMaterial(false);
      setMaterialUploadProgress(0);
    }
  };

  const addQuestionProfile = () => {
    let parsed: any[];
    try {
      parsed = JSON.parse(questionJson);
      if (!Array.isArray(parsed))
        throw new Error("O conteúdo deve ser uma lista JSON.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "JSON inválido.");
      return;
    }
    const template = questionProfileTemplate(questionProfile);
    const nextPosition =
      parsed.reduce(
        (maximum, question) =>
          Math.max(maximum, Number(question?.position) || 0),
        0
      ) + 10;
    parsed.push({
      key: `questao-${Date.now()}-${parsed.length + 1}`,
      type: questionProfile,
      prompt: newQuestionPrompt.trim() || template.prompt,
      points: newQuestionPoints,
      position: nextPosition,
      config: template.config,
    });
    setQuestionJson(JSON.stringify(parsed, null, 2));
    setNewQuestionPrompt("");
    toast.success(
      `Modelo “${template.label}” adicionado. Revise as respostas; em associação, use opções diferentes e inclua duas respostas erradas que façam sentido para a pergunta.`
    );
  };

  const generateSimulation = () => {
    const assessments = data.assessments.filter(
      item =>
        !item.archivedAt && (!reportFilter || item.subjectId === reportFilter)
    );
    if (assessments.length === 0) {
      toast.error("Não há avaliações disponíveis para este filtro.");
      return;
    }

    const studentCount = Math.min(100, Math.max(1, simulationStudentCount));
    const maxAttempts = Math.min(20, Math.max(1, simulationMaxAttempts));
    const days = Math.min(365, Math.max(1, simulationDays));
    const now = Date.now();
    const generated = Array.from({ length: studentCount }, (_, index) => {
      const attemptCount = 1 + Math.floor(Math.random() * maxAttempts);
      const attempts = Array.from(
        { length: attemptCount },
        (_, attemptIndex) => {
          const assessment =
            assessments[Math.floor(Math.random() * assessments.length)];
          const startedAt = new Date(
            now - Math.random() * days * 24 * 60 * 60 * 1000
          ).toISOString();
          return {
            id: `sim-${index}-${attemptIndex}-${now}`,
            assessment: assessment.title,
            subject:
              data.subjects.find(subject => subject.id === assessment.subjectId)
                ?.title ?? "Matéria",
            score: Math.round((3.5 + Math.random() * 6.5) * 100) / 100,
            startedAt,
          };
        }
      ).sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
      return {
        id: `sim-aluno-${index}-${now}`,
        name: `Aluno de teste ${String(index + 1).padStart(2, "0")}`,
        attempts,
      };
    });
    setSimulationStudents(generated);
    toast.success(`${studentCount} alunos fictícios simulados.`);
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-sky-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 shadow-sm dark:border-sky-900 dark:from-slate-950 dark:via-card dark:to-indigo-950/30">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-sky-100 p-2 text-sky-800 dark:bg-sky-900 dark:text-sky-100">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Criar matéria a partir de um POP</CardTitle>
              <CardDescription className="mt-1 max-w-3xl">
                Envie um POP e gere uma proposta de matéria, aula e prova. A IA
                só é chamada quando você pedir a geração. Revise tudo antes de
                salvar; o material fica como rascunho e não é publicado sozinho.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!popDraft ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
              <div className="space-y-4 rounded-xl border border-sky-100 bg-white/80 p-4 dark:border-slate-700 dark:bg-card/80">
                <div className="space-y-2">
                  <Label htmlFor="pop-sector">Setor da matéria</Label>
                  <select
                    id="pop-sector"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={popSectorId ?? ""}
                    onChange={event =>
                      setPopSectorId(Number(event.target.value) || undefined)
                    }
                  >
                    <option value="">Escolha um setor</option>
                    {data.sectors
                      .filter(row => !row.archivedAt)
                      .map(row => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pop-file">Arquivo POP</Label>
                  <input
                    ref={popInputRef}
                    id="pop-file"
                    type="file"
                    className="sr-only"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={selectPopFile}
                  />
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-sky-300 bg-sky-50/70 p-3 dark:border-slate-600 dark:bg-slate-900/60">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => popInputRef.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Escolher arquivo
                    </Button>
                    <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                      {popFile?.name ??
                        popUploadedFile?.fileName ??
                        "PDF ou DOCX até 32 MB; TXT até 8 MB"}
                    </span>
                  </div>
                  {(popFile || popUploadedFile) && (
                    <p className="text-xs text-muted-foreground">
                      {popUploadedFile
                        ? `${formatFileSize(popUploadedFile.fileSize)} enviado. O arquivo será lido ao gerar.`
                        : "O arquivo só será enviado quando você clicar em Gerar rascunho."}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pop-question-count">
                    Quantidade de perguntas
                  </Label>
                  <select
                    id="pop-question-count"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:max-w-xs"
                    value={popQuestionCount}
                    onChange={event =>
                      setPopQuestionCount(Number(event.target.value))
                    }
                  >
                    {[5, 8, 10, 15, 20].map(count => (
                      <option key={count} value={count}>
                        {count} perguntas
                      </option>
                    ))}
                  </select>
                </div>
                {(isPreparingPop || generateFromPop.isPending) && (
                  <div className="space-y-2" aria-live="polite">
                    <Progress value={popUploadProgress} />
                    <p className="text-xs text-muted-foreground">
                      {popUploadProgress < 100
                        ? `Enviando arquivo: ${Math.round(popUploadProgress)}%`
                        : "Lendo o POP e preparando a matéria e a prova…"}
                    </p>
                  </div>
                )}
                <Button
                  type="button"
                  onClick={generateCourseFromPop}
                  disabled={
                    (!popFile && !popUploadedFile) ||
                    !popSectorId ||
                    isPreparingPop ||
                    generateFromPop.isPending
                  }
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {isPreparingPop || generateFromPop.isPending
                    ? "Preparando rascunho…"
                    : "Gerar rascunho"}
                </Button>
              </div>
              <div className="flex flex-col justify-center rounded-xl bg-white/60 p-4 text-sm dark:bg-card/60">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  O que será criado
                </h3>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    Uma matéria e uma aula em linguagem simples.
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    Uma prova com alternativas próprias e erros possíveis.
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    Explicações baseadas no POP para corrigir as respostas.
                  </li>
                </ul>
                <p className="mt-4 rounded-md bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  Se o POP for um PDF escaneado, o sistema tenta ler as páginas
                  com a IA. O rascunho precisa ser conferido por uma pessoa
                  antes de ser publicado.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                  <div>
                    <h3 className="font-semibold">
                      Rascunho pronto para revisar
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Confira o conteúdo, o gabarito e as explicações. Você
                      ainda poderá alterar tudo antes de salvar.
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">
                  {popDraft.questions.length} perguntas · POP:{" "}
                  {popDraft.sourceFile.fileName}
                </Badge>
              </div>

              <section className="grid gap-4 rounded-xl border bg-background/80 p-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pop-subject-title">Nome da matéria</Label>
                  <Input
                    id="pop-subject-title"
                    value={popDraft.subjectTitle}
                    onChange={event =>
                      updatePopDraft(draft => ({
                        ...draft,
                        subjectTitle: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome da aula</Label>
                  <Input
                    value={popDraft.lessonTitle}
                    onChange={event =>
                      updatePopDraft(draft => ({
                        ...draft,
                        lessonTitle: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>Descrição da matéria</Label>
                  <Textarea
                    value={popDraft.subjectDescription}
                    onChange={event =>
                      updatePopDraft(draft => ({
                        ...draft,
                        subjectDescription: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>Resumo da aula</Label>
                  <Textarea
                    value={popDraft.lessonSummary}
                    onChange={event =>
                      updatePopDraft(draft => ({
                        ...draft,
                        lessonSummary: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>Conteúdo da aula</Label>
                  <Textarea
                    className="min-h-64"
                    value={popDraft.lessonContent}
                    onChange={event =>
                      updatePopDraft(draft => ({
                        ...draft,
                        lessonContent: event.target.value,
                      }))
                    }
                  />
                </div>
              </section>

              <section className="space-y-4 rounded-xl border bg-background/80 p-4">
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome da prova</Label>
                    <Input
                      value={popDraft.assessmentTitle}
                      onChange={event =>
                        updatePopDraft(draft => ({
                          ...draft,
                          assessmentTitle: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instrução da prova</Label>
                    <Input
                      value={popDraft.assessmentDescription}
                      onChange={event =>
                        updatePopDraft(draft => ({
                          ...draft,
                          assessmentDescription: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  {popDraft.questions.map((question, questionIndex) => (
                    <article
                      key={question.key}
                      className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          Pergunta {questionIndex + 1}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Marque a resposta certa e revise as outras
                          alternativas.
                        </span>
                      </div>
                      <div className="space-y-2">
                        <Label>Pergunta</Label>
                        <Textarea
                          value={question.prompt}
                          onChange={event =>
                            updatePopDraft(draft => ({
                              ...draft,
                              questions: draft.questions.map((item, index) =>
                                index === questionIndex
                                  ? { ...item, prompt: event.target.value }
                                  : item
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {question.config.options.map((option, optionIndex) => (
                          <div
                            key={option.id}
                            className="space-y-2 rounded-lg border bg-background p-3"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`pop-answer-${question.key}`}
                                aria-label={`Marcar alternativa ${optionIndex + 1} como certa`}
                                checked={option.correct}
                                onChange={() =>
                                  updatePopDraft(draft => ({
                                    ...draft,
                                    questions: draft.questions.map(
                                      (item, index) =>
                                        index === questionIndex
                                          ? {
                                              ...item,
                                              config: {
                                                ...item.config,
                                                options:
                                                  item.config.options.map(
                                                    (answer, answerIndex) => ({
                                                      ...answer,
                                                      correct:
                                                        answerIndex ===
                                                        optionIndex,
                                                    })
                                                  ),
                                              },
                                            }
                                          : item
                                    ),
                                  }))
                                }
                              />
                              <Label className="text-xs">
                                {option.correct
                                  ? "Resposta certa"
                                  : "Marcar como certa"}
                              </Label>
                            </div>
                            <Input
                              value={option.text}
                              aria-label={`Texto da alternativa ${optionIndex + 1}`}
                              onChange={event =>
                                updatePopDraft(draft => ({
                                  ...draft,
                                  questions: draft.questions.map(
                                    (item, index) =>
                                      index === questionIndex
                                        ? {
                                            ...item,
                                            config: {
                                              ...item.config,
                                              options: item.config.options.map(
                                                (answer, answerIndex) =>
                                                  answerIndex === optionIndex
                                                    ? {
                                                        ...answer,
                                                        text: event.target
                                                          .value,
                                                      }
                                                    : answer
                                              ),
                                            },
                                          }
                                        : item
                                  ),
                                }))
                              }
                            />
                            <Textarea
                              rows={2}
                              value={option.feedback}
                              aria-label={`Explicação da alternativa ${optionIndex + 1}`}
                              placeholder="Explicação desta alternativa"
                              onChange={event =>
                                updatePopDraft(draft => ({
                                  ...draft,
                                  questions: draft.questions.map(
                                    (item, index) =>
                                      index === questionIndex
                                        ? {
                                            ...item,
                                            config: {
                                              ...item.config,
                                              options: item.config.options.map(
                                                (answer, answerIndex) =>
                                                  answerIndex === optionIndex
                                                    ? {
                                                        ...answer,
                                                        feedback:
                                                          event.target.value,
                                                      }
                                                    : answer
                                              ),
                                            },
                                          }
                                        : item
                                  ),
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <Label>Explicação da resposta</Label>
                        <Textarea
                          value={question.config.explanation}
                          onChange={event =>
                            updatePopDraft(draft => ({
                              ...draft,
                              questions: draft.questions.map((item, index) =>
                                index === questionIndex
                                  ? {
                                      ...item,
                                      config: {
                                        ...item.config,
                                        explanation: event.target.value,
                                      },
                                    }
                                  : item
                              ),
                            }))
                          }
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={discardPopDraft}
                >
                  Descartar rascunho
                </Button>
                <Button
                  type="button"
                  onClick={savePopDraft}
                  disabled={saveGeneratedCourse.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saveGeneratedCourse.isPending
                    ? "Salvando…"
                    : "Salvar como rascunho"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
              data-testid="assessment-editor-selector"
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
              <section className="mb-4 space-y-3 rounded-lg border p-4">
                <div>
                  <h3 className="font-semibold">
                    Adicionar questão por perfil
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Escolha um dos 11 modelos. O sistema insere uma estrutura
                    inicial para você completar e revisar no editor abaixo.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_2fr_120px_auto] md:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="question-profile">Perfil da questão</Label>
                    <select
                      id="question-profile"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={questionProfile}
                      onChange={event =>
                        setQuestionProfile(
                          event.target.value as QuestionProfile
                        )
                      }
                    >
                      {QUESTION_PROFILES.map(profile => (
                        <option key={profile.type} value={profile.type}>
                          {profile.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-question-prompt">Enunciado</Label>
                    <Input
                      id="new-question-prompt"
                      value={newQuestionPrompt}
                      onChange={event =>
                        setNewQuestionPrompt(event.target.value)
                      }
                      placeholder={
                        questionProfileTemplate(questionProfile).prompt
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-question-points">Pontos</Label>
                    <Input
                      id="new-question-points"
                      type="number"
                      min={1}
                      max={100}
                      value={newQuestionPoints}
                      onChange={event =>
                        setNewQuestionPoints(
                          Math.min(
                            100,
                            Math.max(
                              1,
                              Math.floor(Number(event.target.value) || 1)
                            )
                          )
                        )
                      }
                    />
                  </div>
                  <Button type="button" onClick={addQuestionProfile}>
                    <Plus className="mr-1 h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </section>
              <section className="space-y-4">
                <div>
                  <h3 className="font-semibold">Perguntas da avaliação</h3>
                  <p className="text-sm text-muted-foreground">
                    Edite o enunciado e as respostas. O gabarito fica visível
                    para quem administra e pode ser alterado.
                  </p>
                </div>
                {editorQuestions === null ? (
                  <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    O JSON está incompleto ou inválido. Corrija-o na edição
                    avançada para voltar ao editor visual.
                  </p>
                ) : editorQuestions.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Ainda não há perguntas nesta avaliação. Use &quot;Adicionar
                    questão por perfil&quot; acima para começar.
                  </p>
                ) : (
                  editorQuestions.map((question, questionIndex) => {
                    const questionKey = String(
                      question.key ?? `pergunta-${questionIndex + 1}`
                    );
                    const options = Array.isArray(question.config?.options)
                      ? question.config.options
                      : null;
                    const statements = Array.isArray(
                      question.config?.statements
                    )
                      ? question.config.statements
                      : null;
                    const leftItems = Array.isArray(question.config?.leftItems)
                      ? question.config.leftItems
                      : null;
                    const rightItems = Array.isArray(
                      question.config?.rightItems
                    )
                      ? question.config.rightItems
                      : null;
                    const steps = Array.isArray(question.config?.steps)
                      ? question.config.steps
                      : null;
                    const blanks = Array.isArray(question.config?.blanks)
                      ? question.config.blanks
                      : null;
                    const nodes = Array.isArray(question.config?.nodes)
                      ? question.config.nodes
                      : null;
                    const multipleCorrect = ["multiple_select", "sum"].includes(
                      question.type
                    );
                    const correctCount = options?.filter(
                      (option: any) => option.correct
                    ).length;
                    const regenerationInProgress =
                      regeneratingQuestionKey === questionKey;
                    const profileLabel = QUESTION_PROFILES.find(
                      profile => profile.type === question.type
                    )?.label;

                    return (
                      <Card
                        key={`${questionKey}-${questionIndex}`}
                        data-testid={`assessment-question-${questionKey}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                Pergunta {questionIndex + 1}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {profileLabel ?? question.type}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteQuestion(questionIndex)}
                              disabled={regenerationInProgress}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              Excluir pergunta
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor={`question-prompt-${questionIndex}`}>
                              Enunciado
                            </Label>
                            <Textarea
                              id={`question-prompt-${questionIndex}`}
                              value={question.prompt ?? ""}
                              disabled={regenerationInProgress}
                              onChange={event =>
                                updateQuestionPrompt(
                                  questionIndex,
                                  event.target.value
                                )
                              }
                              rows={2}
                            />
                          </div>

                          {options ? (
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-medium">Alternativas</p>
                                  <p className="text-xs text-muted-foreground">
                                    {multipleCorrect
                                      ? "Marque todas as respostas certas."
                                      : "Escolha qual alternativa é a certa."}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">
                                    Gabarito: {correctCount ?? 0} certa(s)
                                  </Badge>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      addQuestionOption(questionIndex)
                                    }
                                    disabled={
                                      regenerationInProgress ||
                                      options.length >= 12
                                    }
                                  >
                                    <Plus className="mr-1 h-4 w-4" />
                                    Adicionar alternativa
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-3">
                                {options.map(
                                  (option: any, optionIndex: number) => (
                                    <div
                                      key={String(option.id ?? optionIndex)}
                                      className="space-y-2 rounded-lg border bg-muted/20 p-3"
                                    >
                                      <div className="flex items-start gap-3">
                                        <label className="flex min-w-24 items-center gap-2 pt-2 text-sm">
                                          <input
                                            type={
                                              multipleCorrect
                                                ? "checkbox"
                                                : "radio"
                                            }
                                            name={`question-answer-${questionKey}`}
                                            checked={Boolean(option.correct)}
                                            disabled={regenerationInProgress}
                                            onChange={() =>
                                              setQuestionOptionCorrect(
                                                questionIndex,
                                                optionIndex
                                              )
                                            }
                                          />
                                          Certa
                                        </label>
                                        <Textarea
                                          aria-label={`Texto da alternativa ${optionIndex + 1}`}
                                          value={option.text ?? ""}
                                          disabled={regenerationInProgress}
                                          onChange={event =>
                                            updateQuestionOption(
                                              questionIndex,
                                              optionIndex,
                                              { text: event.target.value }
                                            )
                                          }
                                          rows={2}
                                          className="min-h-10 flex-1"
                                        />
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          onClick={() =>
                                            deleteQuestionOption(
                                              questionIndex,
                                              optionIndex
                                            )
                                          }
                                          disabled={
                                            regenerationInProgress ||
                                            options.length <= 2
                                          }
                                          aria-label={`Excluir alternativa ${optionIndex + 1}`}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      {question.type === "sum" && (
                                        <div className="flex items-center gap-2 pl-1">
                                          <Label
                                            htmlFor={`question-option-value-${questionIndex}-${optionIndex}`}
                                          >
                                            Valor
                                          </Label>
                                          <Input
                                            id={`question-option-value-${questionIndex}-${optionIndex}`}
                                            className="w-24"
                                            type="number"
                                            value={option.value ?? 0}
                                            disabled={regenerationInProgress}
                                            onChange={event =>
                                              updateQuestionOption(
                                                questionIndex,
                                                optionIndex,
                                                {
                                                  value: Number(
                                                    event.target.value
                                                  ),
                                                }
                                              )
                                            }
                                          />
                                        </div>
                                      )}
                                      {option.feedback !== undefined && (
                                        <Input
                                          aria-label={`Explicação da alternativa ${optionIndex + 1}`}
                                          placeholder="Explicação desta resposta (opcional)"
                                          value={option.feedback ?? ""}
                                          disabled={regenerationInProgress}
                                          onChange={event =>
                                            updateQuestionOption(
                                              questionIndex,
                                              optionIndex,
                                              { feedback: event.target.value }
                                            )
                                          }
                                        />
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                              {question.config?.explanation !== undefined && (
                                <div className="space-y-2">
                                  <Label
                                    htmlFor={`question-explanation-${questionIndex}`}
                                  >
                                    Explicação da resposta
                                  </Label>
                                  <Textarea
                                    id={`question-explanation-${questionIndex}`}
                                    value={question.config.explanation ?? ""}
                                    disabled={regenerationInProgress}
                                    onChange={event =>
                                      updateQuestionList(questions =>
                                        questions.map((item, index) =>
                                          index === questionIndex
                                            ? {
                                                ...item,
                                                config: {
                                                  ...item.config,
                                                  explanation:
                                                    event.target.value,
                                                },
                                              }
                                            : item
                                        )
                                      )
                                    }
                                    rows={2}
                                  />
                                </div>
                              )}
                            </div>
                          ) : question.type === "true_false" ? (
                            <div className="space-y-2 rounded-lg border p-3">
                              <p className="font-medium">Gabarito</p>
                              <div className="flex flex-wrap gap-5">
                                {[true, false].map(answer => (
                                  <label
                                    key={String(answer)}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <input
                                      type="radio"
                                      name={`question-boolean-${questionKey}`}
                                      checked={
                                        question.config?.correctBoolean ===
                                        answer
                                      }
                                      disabled={regenerationInProgress}
                                      onChange={() =>
                                        updateQuestionList(questions =>
                                          questions.map((item, index) =>
                                            index === questionIndex
                                              ? {
                                                  ...item,
                                                  config: {
                                                    ...item.config,
                                                    correctBoolean: answer,
                                                  },
                                                }
                                              : item
                                          )
                                        )
                                      }
                                    />
                                    {answer ? "Verdadeiro" : "Falso"}
                                  </label>
                                ))}
                              </div>
                            </div>
                          ) : question.type === "yes_no_matrix" &&
                            statements ? (
                            <section className="space-y-3">
                              <div>
                                <p className="font-medium">Frases e gabarito</p>
                                <p className="text-xs text-muted-foreground">
                                  Revise cada frase e marque se a resposta certa
                                  é Sim ou Não.
                                </p>
                              </div>
                              {statements.map(
                                (statement: any, statementIndex: number) => (
                                  <div
                                    key={String(statement.id ?? statementIndex)}
                                    className="space-y-2 rounded-lg border bg-muted/20 p-3"
                                  >
                                    <Textarea
                                      aria-label={`Frase ${statementIndex + 1}`}
                                      value={statement.text ?? ""}
                                      disabled={regenerationInProgress}
                                      onChange={event =>
                                        updateQuestionConfig(
                                          questionIndex,
                                          config => ({
                                            ...config,
                                            statements: config.statements.map(
                                              (item: any, index: number) =>
                                                index === statementIndex
                                                  ? {
                                                      ...item,
                                                      text: event.target.value,
                                                    }
                                                  : item
                                            ),
                                          })
                                        )
                                      }
                                      rows={2}
                                    />
                                    <div className="flex flex-wrap items-center gap-5">
                                      <span className="text-sm font-medium">
                                        Gabarito:
                                      </span>
                                      {[true, false].map(answer => (
                                        <label
                                          key={String(answer)}
                                          className="flex items-center gap-2 text-sm"
                                        >
                                          <input
                                            type="radio"
                                            name={`matrix-answer-${questionKey}-${statementIndex}`}
                                            checked={
                                              statement.correctBoolean ===
                                              answer
                                            }
                                            disabled={regenerationInProgress}
                                            onChange={() =>
                                              updateQuestionConfig(
                                                questionIndex,
                                                config => ({
                                                  ...config,
                                                  statements:
                                                    config.statements.map(
                                                      (
                                                        item: any,
                                                        index: number
                                                      ) =>
                                                        index === statementIndex
                                                          ? {
                                                              ...item,
                                                              correctBoolean:
                                                                answer,
                                                            }
                                                          : item
                                                    ),
                                                })
                                              )
                                            }
                                          />
                                          {answer ? "Sim" : "Não"}
                                        </label>
                                      ))}
                                      {statement.feedback !== undefined && (
                                        <Input
                                          className="min-w-56 flex-1"
                                          aria-label={`Explicação da frase ${statementIndex + 1}`}
                                          placeholder="Explicação desta resposta"
                                          value={statement.feedback ?? ""}
                                          disabled={regenerationInProgress}
                                          onChange={event =>
                                            updateQuestionConfig(
                                              questionIndex,
                                              config => ({
                                                ...config,
                                                statements:
                                                  config.statements.map(
                                                    (
                                                      item: any,
                                                      index: number
                                                    ) =>
                                                      index === statementIndex
                                                        ? {
                                                            ...item,
                                                            feedback:
                                                              event.target
                                                                .value,
                                                          }
                                                        : item
                                                  ),
                                              })
                                            )
                                          }
                                        />
                                      )}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Excluir frase ${statementIndex + 1}`}
                                        disabled={
                                          regenerationInProgress ||
                                          statements.length <= 2
                                        }
                                        onClick={() =>
                                          updateQuestionConfig(
                                            questionIndex,
                                            config => ({
                                              ...config,
                                              statements:
                                                config.statements.filter(
                                                  (_item: any, index: number) =>
                                                    index !== statementIndex
                                                ),
                                            })
                                          )
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                )
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={
                                  regenerationInProgress ||
                                  statements.length >= 30
                                }
                                onClick={() =>
                                  updateQuestionConfig(
                                    questionIndex,
                                    config => ({
                                      ...config,
                                      statements: [
                                        ...config.statements,
                                        {
                                          id: `frase-${Date.now()}`,
                                          text: "Nova frase para avaliar",
                                          correctBoolean: false,
                                          feedback: "",
                                        },
                                      ],
                                    })
                                  )
                                }
                              >
                                <Plus className="mr-1 h-4 w-4" />
                                Adicionar frase
                              </Button>
                            </section>
                          ) : question.type === "matching" &&
                            leftItems &&
                            rightItems ? (
                            <section className="space-y-3">
                              <div>
                                <p className="font-medium">
                                  Associações corretas
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Escolha a resposta certa para cada situação.
                                </p>
                              </div>
                              {leftItems.map(
                                (leftItem: any, leftIndex: number) => {
                                  const pair =
                                    question.config?.correctPairs?.find(
                                      (item: any) => item.leftId === leftItem.id
                                    );
                                  return (
                                    <div
                                      key={String(leftItem.id ?? leftIndex)}
                                      className="grid gap-2 rounded-lg border p-3 md:grid-cols-2 md:items-center"
                                    >
                                      <span className="text-sm">
                                        {leftItem.text}
                                      </span>
                                      <select
                                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                        aria-label={`Resposta certa para ${leftItem.text}`}
                                        value={pair?.rightId ?? ""}
                                        disabled={regenerationInProgress}
                                        onChange={event =>
                                          updateQuestionConfig(
                                            questionIndex,
                                            config => {
                                              const otherPairs = (
                                                config.correctPairs ?? []
                                              ).filter(
                                                (item: any) =>
                                                  item.leftId !== leftItem.id
                                              );
                                              return {
                                                ...config,
                                                correctPairs: event.target.value
                                                  ? [
                                                      ...otherPairs,
                                                      {
                                                        leftId: leftItem.id,
                                                        rightId:
                                                          event.target.value,
                                                      },
                                                    ]
                                                  : otherPairs,
                                              };
                                            }
                                          )
                                        }
                                      >
                                        <option value="">
                                          Escolha a resposta certa
                                        </option>
                                        {rightItems.map((rightItem: any) => (
                                          <option
                                            key={rightItem.id}
                                            value={rightItem.id}
                                            disabled={Boolean(
                                              question.config?.correctPairs?.some(
                                                (item: any) =>
                                                  item.rightId ===
                                                    rightItem.id &&
                                                  item.leftId !== leftItem.id
                                              )
                                            )}
                                          >
                                            {rightItem.text}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  );
                                }
                              )}
                              <div className="space-y-2 rounded-lg border border-dashed p-3">
                                <div>
                                  <p className="font-medium">
                                    Alternativas de resposta
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Edite as respostas certas e erradas.
                                    Mantenha pelo menos duas erradas.
                                  </p>
                                </div>
                                {rightItems.map(
                                  (rightItem: any, rightIndex: number) => (
                                    <div
                                      key={String(rightItem.id ?? rightIndex)}
                                      className="flex items-start gap-2"
                                    >
                                      <Textarea
                                        aria-label={`Alternativa de associação ${rightIndex + 1}`}
                                        value={rightItem.text ?? ""}
                                        disabled={regenerationInProgress}
                                        onChange={event =>
                                          updateQuestionConfig(
                                            questionIndex,
                                            config => ({
                                              ...config,
                                              rightItems: config.rightItems.map(
                                                (item: any, index: number) =>
                                                  index === rightIndex
                                                    ? {
                                                        ...item,
                                                        text: event.target
                                                          .value,
                                                      }
                                                    : item
                                              ),
                                            })
                                          )
                                        }
                                        rows={2}
                                        className="flex-1"
                                      />
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={`Excluir alternativa de associação ${rightIndex + 1}`}
                                        disabled={
                                          regenerationInProgress ||
                                          rightItems.length <=
                                            leftItems.length + 2 ||
                                          question.config?.correctPairs?.some(
                                            (pair: any) =>
                                              pair.rightId === rightItem.id
                                          )
                                        }
                                        onClick={() =>
                                          deleteMatchingOption(
                                            questionIndex,
                                            rightItem.id
                                          )
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={
                                    regenerationInProgress ||
                                    rightItems.length >= 20
                                  }
                                  onClick={() =>
                                    addMatchingOption(questionIndex)
                                  }
                                >
                                  <Plus className="mr-1 h-4 w-4" />
                                  Adicionar alternativa
                                </Button>
                              </div>
                            </section>
                          ) : question.type === "ordering" && steps ? (
                            <section className="space-y-3">
                              <div>
                                <p className="font-medium">Ordem correta</p>
                                <p className="text-xs text-muted-foreground">
                                  Confira os passos e escolha qual deve vir em
                                  cada posição.
                                </p>
                              </div>
                              {steps.map((step: any, stepIndex: number) => (
                                <div
                                  key={String(step.id ?? stepIndex)}
                                  className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_1fr] md:items-center"
                                >
                                  <Input
                                    aria-label={`Texto da etapa ${stepIndex + 1}`}
                                    value={step.text ?? ""}
                                    disabled={regenerationInProgress}
                                    onChange={event =>
                                      updateQuestionConfig(
                                        questionIndex,
                                        config => ({
                                          ...config,
                                          steps: config.steps.map(
                                            (item: any, index: number) =>
                                              index === stepIndex
                                                ? {
                                                    ...item,
                                                    text: event.target.value,
                                                  }
                                                : item
                                          ),
                                        })
                                      )
                                    }
                                  />
                                  <label className="flex items-center gap-2 text-sm">
                                    <span className="shrink-0">
                                      Posição {stepIndex + 1}
                                    </span>
                                    <select
                                      className="w-full rounded-md border bg-background px-3 py-2"
                                      value={
                                        question.config?.correctOrder?.[
                                          stepIndex
                                        ] ??
                                        steps[stepIndex]?.id ??
                                        ""
                                      }
                                      disabled={regenerationInProgress}
                                      onChange={event =>
                                        changeOrderingPosition(
                                          questionIndex,
                                          stepIndex,
                                          event.target.value
                                        )
                                      }
                                    >
                                      {steps.map((choice: any) => (
                                        <option
                                          key={choice.id}
                                          value={choice.id}
                                          disabled={Boolean(
                                            question.config?.correctOrder?.some(
                                              (id: string, index: number) =>
                                                id === choice.id &&
                                                index !== stepIndex
                                            )
                                          )}
                                        >
                                          {choice.text}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              ))}
                            </section>
                          ) : question.type === "fill_blank" && blanks ? (
                            <section className="space-y-3">
                              <p className="font-medium">Respostas aceitas</p>
                              {blanks.map((blank: any, blankIndex: number) => (
                                <div
                                  key={String(blank.id ?? blankIndex)}
                                  className="space-y-2"
                                >
                                  <Label
                                    htmlFor={`blank-answers-${questionIndex}-${blankIndex}`}
                                  >
                                    Espaço {blank.id ?? blankIndex + 1} (uma
                                    resposta por linha)
                                  </Label>
                                  <Textarea
                                    id={`blank-answers-${questionIndex}-${blankIndex}`}
                                    value={(blank.acceptedAnswers ?? []).join(
                                      "\n"
                                    )}
                                    disabled={regenerationInProgress}
                                    onChange={event =>
                                      updateQuestionConfig(
                                        questionIndex,
                                        config => ({
                                          ...config,
                                          blanks: config.blanks.map(
                                            (item: any, index: number) =>
                                              index === blankIndex
                                                ? {
                                                    ...item,
                                                    acceptedAnswers:
                                                      event.target.value
                                                        .split("\n")
                                                        .map(value =>
                                                          value.trim()
                                                        )
                                                        .filter(Boolean),
                                                  }
                                                : item
                                          ),
                                        })
                                      )
                                    }
                                    rows={3}
                                  />
                                </div>
                              ))}
                            </section>
                          ) : question.type === "short_answer" ? (
                            <div className="space-y-2">
                              <Label
                                htmlFor={`accepted-answers-${questionIndex}`}
                              >
                                Respostas aceitas (uma por linha)
                              </Label>
                              <Textarea
                                id={`accepted-answers-${questionIndex}`}
                                value={(
                                  question.config?.acceptedAnswers ?? []
                                ).join("\n")}
                                disabled={regenerationInProgress}
                                onChange={event =>
                                  updateQuestionConfig(
                                    questionIndex,
                                    config => ({
                                      ...config,
                                      acceptedAnswers: event.target.value
                                        .split("\n")
                                        .map(value => value.trim())
                                        .filter(Boolean),
                                    })
                                  )
                                }
                                rows={3}
                              />
                            </div>
                          ) : question.type === "negotiation" && nodes ? (
                            <section className="space-y-3">
                              <p className="font-medium">
                                Situações e respostas
                              </p>
                              {nodes.map((node: any, nodeIndex: number) => (
                                <div
                                  key={String(node.id ?? nodeIndex)}
                                  className="space-y-3 rounded-lg border p-3"
                                >
                                  <div className="rounded-md bg-muted/30 p-2 text-sm">
                                    <span className="font-medium">
                                      Gabarito (maior nota):
                                    </span>{" "}
                                    {(node.options ?? [])
                                      .filter(
                                        (option: any) =>
                                          Number(option.score ?? 0) ===
                                          Math.max(
                                            0,
                                            ...(node.options ?? []).map(
                                              (item: any) =>
                                                Number(item.score ?? 0)
                                            )
                                          )
                                      )
                                      .map((option: any) => option.text)
                                      .join(" / ") || "Sem respostas"}
                                  </div>
                                  <div className="space-y-2">
                                    <Label
                                      htmlFor={`negotiation-client-${questionIndex}-${nodeIndex}`}
                                    >
                                      O que o cliente diz
                                    </Label>
                                    <Textarea
                                      id={`negotiation-client-${questionIndex}-${nodeIndex}`}
                                      value={node.clientText ?? ""}
                                      disabled={regenerationInProgress}
                                      onChange={event =>
                                        updateQuestionConfig(
                                          questionIndex,
                                          config => ({
                                            ...config,
                                            nodes: config.nodes.map(
                                              (item: any, index: number) =>
                                                index === nodeIndex
                                                  ? {
                                                      ...item,
                                                      clientText:
                                                        event.target.value,
                                                    }
                                                  : item
                                            ),
                                          })
                                        )
                                      }
                                      rows={2}
                                    />
                                  </div>
                                  {(node.options ?? []).map(
                                    (option: any, optionIndex: number) => (
                                      <div
                                        key={String(option.id ?? optionIndex)}
                                        className="space-y-2 rounded-md bg-muted/30 p-3"
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="text-sm font-medium">
                                            Resposta {optionIndex + 1}
                                          </span>
                                          <label className="flex items-center gap-2 text-sm">
                                            Nota (0 a 100)
                                            <Input
                                              className="w-24"
                                              type="number"
                                              min={0}
                                              max={100}
                                              value={option.score ?? 0}
                                              disabled={regenerationInProgress}
                                              onChange={event =>
                                                updateQuestionConfig(
                                                  questionIndex,
                                                  config => ({
                                                    ...config,
                                                    nodes: config.nodes.map(
                                                      (
                                                        item: any,
                                                        index: number
                                                      ) =>
                                                        index === nodeIndex
                                                          ? {
                                                              ...item,
                                                              options:
                                                                item.options.map(
                                                                  (
                                                                    choice: any,
                                                                    choiceIndex: number
                                                                  ) =>
                                                                    choiceIndex ===
                                                                    optionIndex
                                                                      ? {
                                                                          ...choice,
                                                                          score:
                                                                            Math.min(
                                                                              100,
                                                                              Math.max(
                                                                                0,
                                                                                Number(
                                                                                  event
                                                                                    .target
                                                                                    .value
                                                                                ) ||
                                                                                  0
                                                                              )
                                                                            ),
                                                                        }
                                                                      : choice
                                                                ),
                                                            }
                                                          : item
                                                    ),
                                                  })
                                                )
                                              }
                                            />
                                          </label>
                                          <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            aria-label={`Excluir resposta ${optionIndex + 1}`}
                                            disabled={
                                              regenerationInProgress ||
                                              node.options.length <= 2
                                            }
                                            onClick={() =>
                                              deleteNegotiationOption(
                                                questionIndex,
                                                nodeIndex,
                                                optionIndex
                                              )
                                            }
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        <Textarea
                                          aria-label={`Texto da resposta ${optionIndex + 1}`}
                                          value={option.text ?? ""}
                                          disabled={regenerationInProgress}
                                          onChange={event =>
                                            updateQuestionConfig(
                                              questionIndex,
                                              config => ({
                                                ...config,
                                                nodes: config.nodes.map(
                                                  (item: any, index: number) =>
                                                    index === nodeIndex
                                                      ? {
                                                          ...item,
                                                          options:
                                                            item.options.map(
                                                              (
                                                                choice: any,
                                                                choiceIndex: number
                                                              ) =>
                                                                choiceIndex ===
                                                                optionIndex
                                                                  ? {
                                                                      ...choice,
                                                                      text: event
                                                                        .target
                                                                        .value,
                                                                    }
                                                                  : choice
                                                            ),
                                                        }
                                                      : item
                                                ),
                                              })
                                            )
                                          }
                                          rows={2}
                                        />
                                        <Input
                                          aria-label={`Explicação da resposta ${optionIndex + 1}`}
                                          placeholder="Explicação desta resposta"
                                          value={option.feedback ?? ""}
                                          disabled={regenerationInProgress}
                                          onChange={event =>
                                            updateQuestionConfig(
                                              questionIndex,
                                              config => ({
                                                ...config,
                                                nodes: config.nodes.map(
                                                  (item: any, index: number) =>
                                                    index === nodeIndex
                                                      ? {
                                                          ...item,
                                                          options:
                                                            item.options.map(
                                                              (
                                                                choice: any,
                                                                choiceIndex: number
                                                              ) =>
                                                                choiceIndex ===
                                                                optionIndex
                                                                  ? {
                                                                      ...choice,
                                                                      feedback:
                                                                        event
                                                                          .target
                                                                          .value,
                                                                    }
                                                                  : choice
                                                            ),
                                                        }
                                                      : item
                                                ),
                                              })
                                            )
                                          }
                                        />
                                      </div>
                                    )
                                  )}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      regenerationInProgress ||
                                      node.options.length >= 12
                                    }
                                    onClick={() =>
                                      addNegotiationOption(
                                        questionIndex,
                                        nodeIndex
                                      )
                                    }
                                  >
                                    <Plus className="mr-1 h-4 w-4" />
                                    Adicionar resposta
                                  </Button>
                                </div>
                              ))}
                            </section>
                          ) : (
                            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                              Este formato tem uma estrutura própria. Edite os
                              detalhes no JSON avançado abaixo; o botão de IA
                              também pode refazer esta pergunta.
                            </p>
                          )}

                          <div className="space-y-2 rounded-lg border border-dashed p-3">
                            <Label htmlFor={`ai-instruction-${questionIndex}`}>
                              Orientação para a IA (opcional)
                            </Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Input
                                id={`ai-instruction-${questionIndex}`}
                                placeholder="Ex.: use uma situação de atendimento ao cliente"
                                value={
                                  questionAiInstructions[questionKey] ?? ""
                                }
                                disabled={regenerationInProgress}
                                onChange={event =>
                                  setQuestionAiInstructions(current => ({
                                    ...current,
                                    [questionKey]: event.target.value,
                                  }))
                                }
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => regenerateQuestion(question)}
                                disabled={regenerationInProgress}
                              >
                                <Sparkles className="mr-2 h-4 w-4" />
                                {regenerationInProgress
                                  ? "Refazendo..."
                                  : "Refazer com IA"}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              A pergunta atual fica salva enquanto a nova versão
                              é criada. Depois, revise o enunciado e o gabarito
                              antes de salvar a avaliação.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </section>
              <details className="rounded-lg border p-4">
                <summary className="cursor-pointer font-medium">
                  Edição avançada em JSON
                </summary>
                <div className="mt-3 space-y-2">
                  <Label>Questões em JSON</Label>
                  <Textarea
                    className="min-h-72 font-mono text-xs"
                    value={questionJson}
                    onChange={event => setQuestionJson(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use este campo para ajustes avançados. Os formatos especiais
                    e seus gabaritos também podem ser editados nos cartões
                    acima. O gabarito não aparece para o aluno antes da
                    correção.
                  </p>
                </div>
              </details>
            </div>
            <Button onClick={saveQuestions} disabled={saveAssessment.isPending}>
              <Save className="mr-1 h-4 w-4" />
              Salvar avaliação e nova versão
            </Button>
            <section className="space-y-3 rounded-lg border p-4">
              <div>
                <h3 className="font-semibold">
                  Material de apoio da avaliação
                </h3>
                <p className="text-sm text-muted-foreground">
                  Envie arquivos para os alunos consultarem online ou baixarem.
                  Aceita PDF, Word, PowerPoint, Excel, TXT e imagens
                  PNG/JPG/WEBP de até 32 MB.
                </p>
              </div>
              {!assessmentId ? (
                <p className="text-sm text-amber-700">
                  Salve a avaliação primeiro; depois selecione-a para anexar os
                  materiais.
                </p>
              ) : (
                <>
                  <input
                    ref={materialInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp"
                    onChange={uploadAssessmentMaterial}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => materialInputRef.current?.click()}
                    disabled={
                      uploadingMaterial || addAssessmentMaterial.isPending
                    }
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingMaterial
                      ? `Enviando ${Math.round(materialUploadProgress)}%`
                      : "Enviar material"}
                  </Button>
                  {assessmentMaterialsLoading ? (
                    <p className="text-sm text-muted-foreground">
                      Carregando materiais...
                    </p>
                  ) : assessmentMaterials.length > 0 ? (
                    <ul className="space-y-2">
                      {assessmentMaterials.map(material => (
                        <li
                          key={material.id}
                          className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-3 text-sm"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 break-all">
                            {material.name}
                            <span className="ml-2 text-muted-foreground">
                              {formatFileSize(material.sizeBytes)}
                            </span>
                          </span>
                          <a
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                            href={material.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FileText className="h-4 w-4" />
                            Abrir online
                          </a>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                            onClick={() =>
                              downloadAssessmentMaterial(
                                material.url,
                                material.name
                              )
                            }
                          >
                            <Download className="h-4 w-4" />
                            Baixar
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum material anexado a esta avaliação.
                    </p>
                  )}
                </>
              )}
            </section>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aplicar prova</CardTitle>
          <CardDescription>
            Escolha uma avaliação formal publicada, selecione alunos já
            matriculados e defina o prazo e o limite de tentativas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="assignment-assessment">Avaliação formal</Label>
              <select
                id="assignment-assessment"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={assignmentAssessmentId ?? ""}
                onChange={event => {
                  setAssignmentAssessmentId(
                    Number(event.target.value) || undefined
                  );
                  setAssignmentStudentIds([]);
                }}
              >
                <option value="">Selecione uma avaliação</option>
                {data.assessments
                  .filter(
                    item =>
                      item.allowFormal && item.isPublished && !item.archivedAt
                  )
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-deadline">Data limite</Label>
              <Input
                id="assignment-deadline"
                type="datetime-local"
                value={assignmentDeadline}
                onChange={event => setAssignmentDeadline(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-max-attempts">
                Tentativas permitidas por aluno
              </Label>
              <Input
                id="assignment-max-attempts"
                type="number"
                min={1}
                max={20}
                value={assignmentMaxAttempts}
                onChange={event =>
                  setAssignmentMaxAttempts(
                    Math.min(20, Math.max(1, Number(event.target.value) || 1))
                  )
                }
              />
            </div>
          </div>
          {assignmentAssessment && (
            <section className="space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Alunos matriculados</h3>
                  <p className="text-sm text-muted-foreground">
                    Matéria:{" "}
                    {data.subjects.find(
                      item => item.id === assignmentAssessment.subjectId
                    )?.title ?? "—"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setAssignmentStudentIds(
                        enrolledStudents.map(student => student.userId)
                      )
                    }
                    disabled={
                      enrolledStudentsLoading || enrolledStudents.length === 0
                    }
                  >
                    Selecionar todos
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAssignmentStudentIds([])}
                    disabled={assignmentStudentIds.length === 0}
                  >
                    Limpar seleção
                  </Button>
                </div>
              </div>
              {enrolledStudentsLoading ? (
                <p className="text-sm text-muted-foreground">
                  Carregando alunos matriculados…
                </p>
              ) : enrolledStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ainda não há alunos matriculados nesta matéria.
                </p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {enrolledStudents.map(student => (
                    <label
                      key={student.userId}
                      className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={assignmentStudentIds.includes(student.userId)}
                        onChange={event =>
                          setAssignmentStudentIds(previous =>
                            event.target.checked
                              ? [...previous, student.userId]
                              : previous.filter(id => id !== student.userId)
                          )
                        }
                      />
                      <span className="flex-1">{student.name}</span>
                      <span className="text-muted-foreground">
                        Matriculado em {formatDate(student.enrolledAt)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {assignmentStudentIds.length} selecionado(s)
                </span>
                <Button
                  onClick={() =>
                    createExamAssignment.mutate({
                      assessmentId: assignmentAssessment.id,
                      dueAt: new Date(assignmentDeadline),
                      maxAttempts: assignmentMaxAttempts,
                      userIds: assignmentStudentIds,
                    })
                  }
                  disabled={
                    assignmentStudentIds.length === 0 ||
                    !assignmentDeadline ||
                    new Date(assignmentDeadline).getTime() <= Date.now() ||
                    createExamAssignment.isPending
                  }
                >
                  {createExamAssignment.isPending
                    ? "Aplicando prova…"
                    : "Aplicar prova"}
                </Button>
              </div>
            </section>
          )}
          <section className="space-y-3 border-t pt-5">
            <h3 className="font-semibold">Provas aplicadas e notas</h3>
            {examAssignmentsLoading ? (
              <p className="text-sm text-muted-foreground">
                Carregando aplicações…
              </p>
            ) : examAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma prova formal foi aplicada ainda.
              </p>
            ) : (
              <div className="space-y-4">
                {examAssignments.map((assignment: any) => (
                  <div
                    key={assignment.id}
                    className="space-y-3 rounded-xl border p-4"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {assignment.assessmentTitle} ·{" "}
                          {assignment.subjectTitle}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Aplicada em {formatDate(assignment.createdAt)} · prazo{" "}
                          {formatDate(assignment.dueAt)} ·{" "}
                          {assignment.maxAttempts} tentativa(s) permitida(s)
                        </p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Aluno</TableHead>
                            <TableHead>Tentativas usadas</TableHead>
                            <TableHead>Notas e datas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignment.students.map((student: any) => (
                            <TableRow key={student.id}>
                              <TableCell className="font-medium">
                                {student.name}
                              </TableCell>
                              <TableCell>
                                {student.attempts.length} /{" "}
                                {assignment.maxAttempts}
                              </TableCell>
                              <TableCell>
                                {student.attempts.length === 0 ? (
                                  <span className="text-sm text-muted-foreground">
                                    Ainda não iniciou
                                  </span>
                                ) : (
                                  <div className="space-y-2">
                                    {student.attempts.map((attempt: any) => (
                                      <div
                                        key={attempt.id}
                                        className="flex flex-wrap items-center gap-2 text-sm"
                                      >
                                        <span>
                                          {formatDate(attempt.startedAt)}
                                        </span>
                                        {attempt.status === "completed" ? (
                                          <Badge variant="secondary">
                                            {Number(attempt.score ?? 0).toFixed(
                                              2
                                            )}
                                            /10
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline">
                                            Em andamento
                                          </Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Simulacro do painel de alunos</CardTitle>
            <Badge variant="outline">Fictício · não salva</Badge>
          </div>
          <CardDescription>
            Gere alunos, datas, quantidade de provas e notas para conferir a
            apresentação dos resultados sem registrar uma tentativa real.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="training-report-filter">Filtrar matéria</Label>
            <select
              id="training-report-filter"
              className="max-w-sm rounded-md border bg-background px-3 py-2 text-sm"
              value={reportFilter ?? ""}
              onChange={event => {
                setReportFilter(Number(event.target.value) || undefined);
                setSimulationStudents([]);
              }}
            >
              <option value="">Todas</option>
              {data.subjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sim-students">Alunos fictícios</Label>
              <Input
                id="sim-students"
                type="number"
                min={1}
                max={100}
                value={simulationStudentCount}
                onChange={event =>
                  setSimulationStudentCount(Number(event.target.value) || 1)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sim-attempts">Máximo de provas por aluno</Label>
              <Input
                id="sim-attempts"
                type="number"
                min={1}
                max={20}
                value={simulationMaxAttempts}
                onChange={event =>
                  setSimulationMaxAttempts(Number(event.target.value) || 1)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sim-days">
                Distribuir datas nos últimos dias
              </Label>
              <Input
                id="sim-days"
                type="number"
                min={1}
                max={365}
                value={simulationDays}
                onChange={event =>
                  setSimulationDays(Number(event.target.value) || 1)
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={generateSimulation}>Gerar simulacro</Button>
            <Button
              variant="outline"
              disabled={simulationStudents.length === 0}
              onClick={() => setSimulationStudents([])}
            >
              Limpar simulacro
            </Button>
          </div>
          {simulationStudents.length > 0 && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-sm text-muted-foreground">
                      Alunos simulados
                    </p>
                    <p className="text-2xl font-semibold">
                      {simulationStudents.length}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-sm text-muted-foreground">
                      Provas simuladas
                    </p>
                    <p className="text-2xl font-semibold">
                      {simulationStudents.reduce(
                        (total, student) => total + student.attempts.length,
                        0
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-sm text-muted-foreground">
                      Média das pontuações
                    </p>
                    <p className="text-2xl font-semibold">
                      {(
                        simulationStudents
                          .flatMap(student => student.attempts)
                          .reduce((sum, attempt) => sum + attempt.score, 0) /
                        Math.max(
                          1,
                          simulationStudents.reduce(
                            (total, student) => total + student.attempts.length,
                            0
                          )
                        )
                      ).toFixed(2)}
                      /10
                    </p>
                  </CardContent>
                </Card>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Provas</TableHead>
                      <TableHead>Provas distintas</TableHead>
                      <TableHead>Data mais recente</TableHead>
                      <TableHead>Pontuações por prova</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulationStudents.map(student => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {student.name}
                        </TableCell>
                        <TableCell>{student.attempts.length}</TableCell>
                        <TableCell>
                          {
                            new Set(
                              student.attempts.map(item => item.assessment)
                            ).size
                          }
                        </TableCell>
                        <TableCell>
                          {formatDate(student.attempts[0]?.startedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            {student.attempts.map(attempt => (
                              <div
                                key={attempt.id}
                                className="flex flex-wrap items-center gap-2 text-sm"
                              >
                                <span>
                                  {attempt.assessment} · {attempt.subject}
                                </span>
                                <span className="text-muted-foreground">
                                  {formatDate(attempt.startedAt)}
                                </span>
                                <Badge variant="secondary">
                                  {attempt.score.toFixed(2)}/10
                                </Badge>
                              </div>
                            ))}
                          </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Ranking das provas formais</CardTitle>
          <CardDescription>
            Cada aluno aparece pela sua melhor nota concluída em cada avaliação.
            Empates recebem a mesma posição; a data desempata a ordem visual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {leaderboardsLoading ? (
            <p className="text-sm text-slate-500">Carregando rankings…</p>
          ) : leaderboards.length === 0 ? (
            <p className="text-sm text-slate-500">
              Ainda não há provas formais concluídas para classificar.
            </p>
          ) : (
            leaderboards.map(exam => (
              <section
                key={exam.assessmentId}
                className="space-y-3 rounded-xl border p-4"
              >
                <div>
                  <h3 className="font-semibold">{exam.assessment}</h3>
                  <p className="text-sm text-muted-foreground">
                    {exam.sector} · {exam.subject}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Posição</TableHead>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Melhor nota</TableHead>
                        <TableHead>Data da nota</TableHead>
                        <TableHead>Tentativas concluídas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exam.students.map(student => (
                        <TableRow key={student.userId}>
                          <TableCell>
                            <Badge
                              variant={
                                student.rank <= 3 ? "secondary" : "outline"
                              }
                            >
                              {student.rank}º
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {student.userName}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {student.score.toFixed(2)}/10
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDate(student.completedAt)}
                          </TableCell>
                          <TableCell>{student.completedAttempts}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Painel dos alunos</CardTitle>
          <CardDescription>
            Resumo das avaliações reais: quantidade de provas, atividade mais
            recente e pontuação de cada tentativa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resultsLoading ? (
            <p className="text-sm text-slate-500">Carregando painel…</p>
          ) : studentSummaries.length === 0 ? (
            <p className="text-sm text-slate-500">
              Ainda não há alunos com tentativas registradas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Provas concluídas / tentativas</TableHead>
                    <TableHead>Data mais recente</TableHead>
                    <TableHead>Pontuações por prova</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentSummaries.map(student => (
                    <TableRow key={student.userId}>
                      <TableCell className="font-medium">
                        {student.name}
                      </TableCell>
                      <TableCell>
                        {
                          student.attempts.filter(
                            attempt => attempt.status === "completed"
                          ).length
                        }{" "}
                        / {student.attempts.length}
                      </TableCell>
                      <TableCell>
                        {formatDate(student.attempts[0]?.startedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="max-h-56 space-y-2 overflow-y-auto">
                          {student.attempts.map(attempt => (
                            <div
                              key={attempt.attemptId}
                              className="flex flex-wrap items-center gap-2 text-sm"
                            >
                              <span>
                                {attempt.assessment} · {attempt.subject}
                              </span>
                              <span className="text-muted-foreground">
                                {formatDate(attempt.startedAt)}
                              </span>
                              {attempt.status === "completed" ? (
                                <Badge variant="secondary">
                                  {Number(attempt.score ?? 0).toFixed(2)}/10
                                </Badge>
                              ) : (
                                <Badge variant="outline">Em andamento</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tentativas reais detalhadas</CardTitle>
          <CardDescription>
            Consulta administrativa; tentativas próprias do aluno também ficam
            disponíveis no histórico da matéria.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                          : `${Number(row.score).toFixed(2)}/10`}
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
  const {
    data: sectors = [],
    isLoading,
    error: catalogError,
    refetch: retryCatalog,
    isRefetching: isCatalogRefetching,
  } = trpc.treinamento.catalog.useQuery();
  const { data: progress = [] } = trpc.treinamento.myProgress.useQuery();
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [lessonId, setLessonId] = useState<number | undefined>();
  const [tab, setTab] = useState("study");
  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [attemptProgress, setAttemptProgress] =
    useState<AttemptProgress | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | string[]>("");
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [scenarioNode, setScenarioNode] = useState<any>(null);
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [moduleCheckpoint, setModuleCheckpoint] = useState(false);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [savingLesson, setSavingLesson] = useState(false);
  const [reviewAttemptId, setReviewAttemptId] = useState<number | undefined>();
  const [voiceStatus, setVoiceStatus] = useState<
    "idle" | "checking" | "installing" | "listening"
  >("idle");
  const speechRecognitionRef = useRef<any>(null);
  const orderingSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
  const currentModuleNumber =
    Math.floor(questionIndex / QUESTIONS_PER_MODULE) + 1;
  const moduleCount = attempt
    ? Math.ceil(attempt.questions.length / QUESTIONS_PER_MODULE)
    : 0;
  const moduleStartQuestion =
    (currentModuleNumber - 1) * QUESTIONS_PER_MODULE + 1;
  const moduleEndQuestion = attempt
    ? Math.min(
        currentModuleNumber * QUESTIONS_PER_MODULE,
        attempt.questions.length
      )
    : 0;
  const activeScenario = scenarioNode ?? currentQuestion?.config;
  const enrollSubject = trpc.treinamento.enrollSubject.useMutation({
    onSuccess: async () => {
      await utils.treinamento.subject.invalidate({ id: subjectId ?? 0 });
      toast.success("Matrícula confirmada. As avaliações foram liberadas.");
    },
    onError: error => toast.error(error.message),
  });
  const startAttempt = trpc.treinamento.startAttempt.useMutation({
    onError: error => toast.error(error.message),
    onSuccess: async data => {
      setAttempt(data as AttemptView);
      setAttemptProgress((data as AttemptView).progresso ?? null);
      setQuestionIndex(data.initialQuestionIndex ?? 0);
      setSelected("");
      setOrderedIds([]);
      setScenarioNode(null);
      setAnswerResult(
        data.currentQuestionAnswered ? { questionComplete: true } : null
      );
      setFinalResult(null);
      setModuleCheckpoint(false);
      await utils.treinamento.subject.invalidate({ id: subjectId ?? 0 });
    },
  });
  const submitAnswer = trpc.treinamento.submitAnswer.useMutation({
    onSuccess: data => {
      setAnswerResult(data);
      if (data.progresso) setAttemptProgress(data.progresso as AttemptProgress);
      if (data.nextQuestion?.config) setScenarioNode(data.nextQuestion.config);
    },
  });
  const completeAttempt = trpc.treinamento.completeAttempt.useMutation({
    onSuccess: async data => {
      setFinalResult(data);
      await Promise.all([
        utils.treinamento.history.invalidate(),
        utils.treinamento.myProgress.invalidate(),
        utils.treinamento.subject.invalidate({ id: subjectId ?? 0 }),
        utils.treinamento.resultsReport.invalidate(),
        utils.treinamento.assignmentReport.invalidate(),
        utils.treinamento.leaderboardReport.invalidate(),
        utils.treinamento.subject.invalidate({ id: subjectId ?? 0 }),
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
    speechRecognitionRef.current?.abort?.();
    speechRecognitionRef.current = null;
    setVoiceStatus("idle");
    if (currentQuestion?.type === "ordering")
      setOrderedIds(currentQuestion.config.steps.map((step: any) => step.id));
    else setOrderedIds([]);
    if (currentQuestion?.type === "matching")
      setSelected(Array(currentQuestion.config.leftItems.length).fill(""));
    else if (currentQuestion?.type === "fill_blank")
      setSelected(Array(currentQuestion.config.blanks.length).fill(""));
    else if (
      currentQuestion?.type === "multiple_select" ||
      currentQuestion?.type === "sum" ||
      currentQuestion?.type === "yes_no_matrix"
    )
      setSelected(
        currentQuestion?.type === "yes_no_matrix"
          ? Array((currentQuestion.config.statements ?? []).length).fill("")
          : []
      );
    else setSelected("");
    setScenarioNode(
      currentQuestion?.type === "negotiation" ? currentQuestion.config : null
    );
    setAnswerResult(
      attempt?.currentQuestionAnswered &&
        attempt.initialQuestionIndex === questionIndex
        ? { questionComplete: true }
        : null
    );
  }, [attempt?.attemptId, questionIndex, currentQuestion?.key]);

  useEffect(() => () => speechRecognitionRef.current?.abort?.(), []);

  const lessonComplete = (id: number) =>
    (currentProgress as any)?.completedLessonIds?.includes(id) ?? false;

  const start = (
    assessmentId: number,
    mode: "practice" | "formal",
    assignmentStudentId?: number
  ) => startAttempt.mutate({ assessmentId, mode, assignmentStudentId });

  const startLocalTranscription = async () => {
    if (voiceStatus === "listening") {
      speechRecognitionRef.current?.stop?.();
      return;
    }
    const speechApi = window as any;
    const SpeechRecognition =
      speechApi.SpeechRecognition ?? speechApi.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(
        "A transcrição local não está disponível neste navegador. Use um Chrome atualizado ou digite sua resposta."
      );
      return;
    }

    setVoiceStatus("checking");
    try {
      if (
        typeof SpeechRecognition.available !== "function" ||
        typeof SpeechRecognition.install !== "function"
      ) {
        throw new Error("Este navegador não oferece transcrição local.");
      }
      let availability = await SpeechRecognition.available({
        langs: ["pt-BR"],
        processLocally: true,
      });
      if (availability === "downloadable") {
        setVoiceStatus("installing");
        const installed = await SpeechRecognition.install({
          langs: ["pt-BR"],
          processLocally: true,
        });
        if (!installed) throw new Error("Não foi possível instalar o idioma.");
        availability = "available";
      }
      if (availability === "downloading") {
        toast.message(
          "O idioma português está sendo preparado no navegador. Tente de novo em alguns instantes."
        );
        setVoiceStatus("idle");
        return;
      }
      if (availability !== "available")
        throw new Error(
          "A transcrição local em português não está disponível."
        );

      const recognition = new SpeechRecognition();
      recognition.lang = "pt-BR";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.processLocally = true;
      recognition.onresult = (event: any) => {
        const transcript = String(
          event.results?.[event.resultIndex]?.[0]?.transcript ?? ""
        ).trim();
        if (!transcript) return;
        setSelected(previous =>
          `${typeof previous === "string" ? previous.trim() : ""} ${transcript}`.trim()
        );
        toast.success("Texto transcrito. Revise antes de enviar.");
      };
      recognition.onerror = (event: any) => {
        setVoiceStatus("idle");
        speechRecognitionRef.current = null;
        if (!["aborted", "no-speech"].includes(event.error))
          toast.error(
            "Não foi possível transcrever. Confira o microfone e tente de novo."
          );
      };
      recognition.onend = () => {
        setVoiceStatus("idle");
        speechRecognitionRef.current = null;
      };
      speechRecognitionRef.current = recognition;
      setVoiceStatus("listening");
      recognition.start();
    } catch (error) {
      setVoiceStatus("idle");
      speechRecognitionRef.current = null;
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a transcrição local."
      );
    }
  };

  const sendAnswer = () => {
    if (!attempt || !currentQuestion) return;
    let response: any = selected;
    if (currentQuestion.type === "ordering") response = orderedIds;
    if (currentQuestion.type === "negotiation")
      response = { nodeId: activeScenario.nodeId, optionId: selected };
    const requiresEveryValue = [
      "matching",
      "fill_blank",
      "yes_no_matrix",
    ].includes(currentQuestion.type);
    if (
      (Array.isArray(response) &&
        (response.length === 0 ||
          (requiresEveryValue &&
            response.some(value => !String(value).trim())))) ||
      response === ""
    ) {
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
    else if ((questionIndex + 1) % QUESTIONS_PER_MODULE === 0)
      setModuleCheckpoint(true);
    else {
      setQuestionIndex(questionIndex + 1);
      setSelected("");
      setScenarioNode(null);
      setAnswerResult(null);
    }
  };
  const closeAttempt = () => {
    speechRecognitionRef.current?.abort?.();
    speechRecognitionRef.current = null;
    setVoiceStatus("idle");
    setAttempt(null);
    setAttemptProgress(null);
    setFinalResult(null);
    setAnswerResult(null);
    setModuleCheckpoint(false);
    void utils.treinamento.subject.invalidate({ id: subjectId ?? 0 });
  };
  const continueToNextModule = () => {
    setQuestionIndex(questionIndex + 1);
    setSelected("");
    setOrderedIds([]);
    setScenarioNode(null);
    setAnswerResult(null);
    setModuleCheckpoint(false);
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
  const handleOrderingDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || answerResult) return;
    setOrderedIds(previous => {
      const oldIndex = previous.indexOf(String(active.id));
      const newIndex = previous.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return previous;
      return arrayMove(previous, oldIndex, newIndex);
    });
  };
  const markLesson = (id: number) => {
    setSavingLesson(true);
    markComplete.mutate({ lessonId: id });
  };

  const studentBody = () => {
    if (attempt && finalResult)
      return (
        <Card className="mx-auto max-w-4xl overflow-hidden border-sky-100 shadow-xl shadow-sky-950/5">
          <CardHeader className="bg-gradient-to-br from-white via-sky-50/70 to-violet-50/70">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {finalResult.mode === "practice"
                  ? "Prática"
                  : "Avaliação formal"}
              </Badge>
              <Badge variant="outline">Versão {finalResult.version}</Badge>
            </div>
            <CardTitle className="text-2xl">
              Tentativa concluída · {finalResult.score.toFixed(2)}/10
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
                {item.type === "yes_no_matrix" && (
                  <YesNoMatrixReview
                    responses={item.statementResponses ?? []}
                  />
                )}
                {item.selected &&
                  item.type !== "yes_no_matrix" &&
                  (!Array.isArray(item.selected) ||
                    typeof item.selected[0] !== "object") && (
                    <p className="mt-2 text-sm text-slate-600">
                      <strong>Sua resposta:</strong>{" "}
                      {Array.isArray(item.selected)
                        ? item.selected.join(" → ")
                        : item.selected}
                    </p>
                  )}
                {item.type === "multiple_select" && (
                  <MultipleSelectCorrections
                    corrections={item.optionCorrections ?? []}
                  />
                )}
                {item.type !== "yes_no_matrix" &&
                  item.type !== "multiple_select" && (
                    <p className="mt-2 text-sm text-slate-600">
                      <strong>Resposta esperada / orientação:</strong>{" "}
                      {item.expectedAnswer}
                    </p>
                  )}
                {item.explanation && (
                  <p className="mt-2 text-sm text-slate-600">
                    {item.explanation}
                  </p>
                )}
                <div className="mt-3">
                  <SpeechReadButton
                    text={[
                      item.explanation,
                      item.type === "yes_no_matrix"
                        ? (item.statementResponses ?? [])
                            .filter((response: any) => !response.isCorrect)
                            .map(
                              (response: any) =>
                                `Correção. ${response.text}. Resposta esperada: ${response.expectedAnswer}. ${response.feedback ?? ""}`
                            )
                            .join(" ")
                        : item.type === "multiple_select"
                          ? multipleSelectCorrectionAudio(
                              item.optionCorrections ?? []
                            )
                          : item.expectedAnswer,
                      ...(item.details ?? []),
                    ]
                      .filter(Boolean)
                      .join(". ")}
                  />
                </div>
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
                  const assignmentStudentId = attempt.assignmentStudentId;
                  closeAttempt();
                  if (id) start(id, attempt.mode, assignmentStudentId);
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
    if (attempt && moduleCheckpoint)
      return (
        <Card className="mx-auto max-w-4xl overflow-hidden border-sky-100 shadow-xl shadow-sky-950/5">
          <CardHeader className="bg-gradient-to-br from-white via-sky-50/50 to-violet-50/50">
            <Badge variant="secondary" className="w-fit">
              Módulo {currentModuleNumber} concluído
            </Badge>
            <CardTitle className="text-2xl">Seu progresso foi salvo</CardTitle>
            <CardDescription>
              Você concluiu as questões {moduleStartQuestion} a{" "}
              {moduleEndQuestion}. A nota final será calculada quando todos os
              módulos forem concluídos.
            </CardDescription>
            <Progress
              value={(moduleEndQuestion / attempt.questions.length) * 100}
            />
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={continueToNextModule}>
              Continuar para o módulo {currentModuleNumber + 1}
            </Button>
            <Button variant="outline" onClick={closeAttempt}>
              Sair e retomar depois
            </Button>
          </CardContent>
        </Card>
      );
    if (attempt && currentQuestion) {
      const options =
        currentQuestion.type === "negotiation"
          ? (activeScenario?.options ?? [])
          : (currentQuestion.config.options ?? []);
      const isMulti =
        currentQuestion.type === "multiple_select" ||
        currentQuestion.type === "sum";
      const isOrdering = currentQuestion.type === "ordering";
      const orderedSteps: OrderingStep[] = isOrdering
        ? orderedIds
            .map(id =>
              currentQuestion.config.steps.find(
                (step: OrderingStep) => step.id === id
              )
            )
            .filter((step: OrderingStep | undefined): step is OrderingStep =>
              Boolean(step)
            )
        : [];
      const isMatching = currentQuestion.type === "matching";
      const isFillBlank = currentQuestion.type === "fill_blank";
      const isYesNoMatrix = currentQuestion.type === "yes_no_matrix";
      const isShortAnswer = currentQuestion.type === "short_answer";
      const isScenario = currentQuestion.type === "negotiation";
      const submitted = Boolean(
        answerResult &&
        (currentQuestion.type !== "negotiation" ||
          answerResult.questionComplete)
      );
      return (
        <Card className="mx-auto max-w-4xl overflow-hidden border-sky-100 shadow-xl shadow-sky-950/5">
          <CardHeader className="bg-gradient-to-br from-white via-sky-50/50 to-violet-50/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <Badge variant="outline">
                  {attempt.mode === "practice"
                    ? "Modo prática"
                    : "Avaliação formal"}
                </Badge>
                <Badge variant="outline">v{attempt.version}</Badge>
                <Badge variant="secondary">
                  Módulo {currentModuleNumber} de {moduleCount}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={closeAttempt}>
                Sair e retomar depois
              </Button>
            </div>
            <CardTitle>{attempt.title}</CardTitle>
            <CardDescription>
              Módulo {currentModuleNumber} de {moduleCount} · questões{" "}
              {moduleStartQuestion}–{moduleEndQuestion}
              <span className="block">
                Questão {questionIndex + 1} de {attempt.questions.length} ·{" "}
                {currentQuestion.points} ponto(s)
              </span>
            </CardDescription>
            <div className="mt-3 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-violet-50 p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Sparkles className="h-4 w-4 text-violet-500" />
                Seu termômetro da prova
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Target className="h-4 w-4 text-sky-600" />
                      Andamento
                    </span>
                    <Badge className="rounded-full bg-sky-100 text-sky-900 hover:bg-sky-100">
                      {Math.round(attemptProgress?.percentualConcluido ?? 0)}%
                    </Badge>
                  </div>
                  <Progress
                    value={attemptProgress?.percentualConcluido ?? 0}
                    className="h-3 bg-sky-100"
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {attemptProgress?.perguntasRespondidas ?? 0} de{" "}
                    {attemptProgress?.totalPerguntas ??
                      attempt.questions.length}{" "}
                    respondidas · faltam{" "}
                    {attemptProgress?.questoesRestantes ??
                      attempt.questions.length}{" "}
                    questões (
                    {Math.round(attemptProgress?.percentualRestante ?? 100)}%).
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white/90 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      Acerto até agora
                    </span>
                    <Badge className="rounded-full bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                      {attemptProgress?.percentualAcerto == null
                        ? "—"
                        : `${Math.round(attemptProgress.percentualAcerto)}%`}
                    </Badge>
                  </div>
                  <div
                    role="meter"
                    aria-label="Percentual de acerto nas questões respondidas"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={attemptProgress?.percentualAcerto ?? 0}
                    className="h-3 overflow-hidden rounded-full bg-emerald-100"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
                      style={{
                        width: `${attemptProgress?.percentualAcerto ?? 0}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {attemptProgress?.percentualAcerto == null
                      ? "Responda à primeira questão para ver seu acerto."
                      : `${attemptProgress.pontosGanhos} de ${attemptProgress.pontosPossiveisRespondidos} pontos nas questões respondidas.`}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                As respostas ficam salvas. Você pode sair e retomar depois; a
                nota final aparece ao concluir todos os módulos.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-violet-50 p-4 sm:p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className="rounded-full bg-white">
                  <Sparkles className="mr-1 h-3.5 w-3.5 text-violet-500" />
                  Desafio {questionIndex + 1}
                </Badge>
                <span className="text-xs font-medium text-slate-500">
                  Leia com calma e escolha sua resposta
                </span>
              </div>
              <h3 className="text-lg font-semibold leading-7 text-slate-900">
                {isFillBlank
                  ? currentQuestion.prompt.replace(/\{\{([^}]+)\}\}/g, "_____")
                  : currentQuestion.prompt}
              </h3>
            </div>
            {isScenario && (
              <div className="mt-4 rounded-lg border-l-4 border-primary bg-muted/60 p-4 text-sm leading-6">
                {activeScenario?.clientText}
              </div>
            )}
            {isOrdering && (
              <div className="mt-5 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Arraste pelo ícone para mudar a ordem. Você também pode usar
                  as setas.
                </p>
                <DndContext
                  sensors={orderingSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleOrderingDragEnd}
                >
                  <SortableContext
                    items={orderedSteps.map(step => step.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {orderedSteps.map((step, index) => (
                        <OrderingStepRow
                          key={step.id}
                          step={step}
                          index={index}
                          total={orderedSteps.length}
                          disabled={submitted}
                          onMove={moveStep}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
            {isMatching && (
              <div className="mt-5 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Há mais opções do que situações. Algumas opções vão ficar sem
                  par.
                </p>
                {currentQuestion.config.leftItems.map(
                  (item: any, index: number) => (
                    <div
                      key={item.id}
                      className="grid gap-2 rounded-lg border p-3 md:grid-cols-2 md:items-center"
                    >
                      <span className="text-sm font-medium">{item.text}</span>
                      <select
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={
                          Array.isArray(selected) ? (selected[index] ?? "") : ""
                        }
                        disabled={submitted || Boolean(answerResult)}
                        onChange={event =>
                          setSelected(previous => {
                            const values = Array.isArray(previous)
                              ? [...previous]
                              : Array(
                                  currentQuestion.config.leftItems.length
                                ).fill("");
                            values[index] = event.target.value;
                            return values;
                          })
                        }
                      >
                        <option value="">Selecione a associação</option>
                        {currentQuestion.config.rightItems.map((right: any) => (
                          <option
                            key={right.id}
                            value={right.id}
                            disabled={
                              Array.isArray(selected) &&
                              selected.includes(right.id) &&
                              selected[index] !== right.id
                            }
                          >
                            {right.text}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                )}
              </div>
            )}
            {isFillBlank && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {currentQuestion.config.blanks.map(
                  (blank: any, index: number) => (
                    <div key={blank.id} className="space-y-2">
                      <Label htmlFor={`blank-${blank.id}`}>
                        Lacuna {index + 1}
                      </Label>
                      <Input
                        id={`blank-${blank.id}`}
                        value={
                          Array.isArray(selected) ? (selected[index] ?? "") : ""
                        }
                        disabled={submitted || Boolean(answerResult)}
                        onChange={event =>
                          setSelected(previous => {
                            const values = Array.isArray(previous)
                              ? [...previous]
                              : Array(
                                  currentQuestion.config.blanks.length
                                ).fill("");
                            values[index] = event.target.value;
                            return values;
                          })
                        }
                      />
                    </div>
                  )
                )}
              </div>
            )}
            {isYesNoMatrix && (
              <div className="mt-5 space-y-3">
                {(currentQuestion.config.statements ?? []).map(
                  (statement: any, index: number) => {
                    const correction = (
                      answerResult?.feedback?.corrections ?? []
                    ).find((item: any) => item.id === statement.id);
                    return (
                      <fieldset
                        key={statement.id}
                        className={`flex flex-col gap-3 rounded-xl border p-4 shadow-sm transition sm:flex-row sm:items-center sm:justify-between ${correction ? "border-amber-300 bg-amber-50/50" : "border-slate-200 bg-white hover:border-sky-200 hover:shadow-md"}`}
                      >
                        <legend className="px-1 text-sm leading-6">
                          {statement.text}
                        </legend>
                        <div className="flex shrink-0 gap-4">
                          {[
                            { value: "sim", label: "Sim" },
                            { value: "nao", label: "Não" },
                          ].map(answer => (
                            <label
                              key={answer.value}
                              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${Array.isArray(selected) && selected[index] === answer.value ? (answer.value === "sim" ? "border-emerald-300 bg-emerald-100 text-emerald-900" : "border-violet-300 bg-violet-100 text-violet-900") : "border-slate-200 bg-white hover:bg-sky-50"}`}
                            >
                              <input
                                type="radio"
                                name={`q-${currentQuestion.key}-${statement.id}`}
                                value={answer.value}
                                checked={
                                  Array.isArray(selected) &&
                                  selected[index] === answer.value
                                }
                                disabled={submitted || Boolean(answerResult)}
                                onChange={() =>
                                  setSelected(previous => {
                                    const values = Array.isArray(previous)
                                      ? [...previous]
                                      : Array(
                                          (
                                            currentQuestion.config.statements ??
                                            []
                                          ).length
                                        ).fill("");
                                    values[index] = answer.value;
                                    return values;
                                  })
                                }
                              />
                              {answer.label}
                            </label>
                          ))}
                        </div>
                        {correction && (
                          <div
                            role="status"
                            className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950 sm:basis-full"
                          >
                            <p className="font-semibold">
                              Correção: a resposta esperada é{" "}
                              {correction.expectedAnswer}.
                            </p>
                            {correction.feedback && (
                              <p className="mt-1">{correction.feedback}</p>
                            )}
                          </div>
                        )}
                      </fieldset>
                    );
                  }
                )}
              </div>
            )}
            {isShortAnswer && (
              <div className="mt-5 space-y-2">
                <Label htmlFor="short-answer-response">Sua resposta</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="short-answer-response"
                    className="min-h-11 flex-1 rounded-xl bg-white"
                    value={typeof selected === "string" ? selected : ""}
                    disabled={submitted || Boolean(answerResult)}
                    onChange={event => setSelected(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant={
                      voiceStatus === "listening" ? "default" : "outline"
                    }
                    className="min-h-11 rounded-xl"
                    onClick={startLocalTranscription}
                    disabled={
                      submitted ||
                      Boolean(answerResult) ||
                      voiceStatus === "checking" ||
                      voiceStatus === "installing"
                    }
                  >
                    <Mic className="h-4 w-4" />
                    {voiceStatus === "listening"
                      ? "Ouvindo…"
                      : voiceStatus === "installing"
                        ? "Preparando português…"
                        : voiceStatus === "checking"
                          ? "Verificando…"
                          : "Falar resposta"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O Chrome transcreve no próprio aparelho quando houver suporte.
                  Revise o texto antes de enviar.
                </p>
              </div>
            )}
            {!isOrdering &&
              !isMatching &&
              !isFillBlank &&
              !isYesNoMatrix &&
              !isShortAnswer && (
                <div className="mt-5 space-y-2">
                  {options.map((option: any) => {
                    const checked = isMulti
                      ? Array.isArray(selected) && selected.includes(option.id)
                      : selected === option.id;
                    const correction =
                      currentQuestion.type === "multiple_select"
                        ? (answerResult?.feedback?.corrections ?? []).find(
                            (item: any) => item.id === option.id
                          )
                        : null;
                    return (
                      <div key={option.id} className="space-y-2">
                        <label
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${correction ? "border-amber-300 bg-amber-50/50" : checked ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/40"}`}
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
                          <span className="text-sm leading-6">
                            {currentQuestion.type === "sum" && (
                              <strong className="mr-1">{option.value}.</strong>
                            )}
                            {option.text}
                          </span>
                        </label>
                        {correction && (
                          <OptionCorrection correction={correction} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            {currentQuestion.type === "sum" && (
              <p className="mt-3 text-sm text-muted-foreground">
                Somatório selecionado:{" "}
                {options
                  .filter(
                    (option: any) =>
                      Array.isArray(selected) && selected.includes(option.id)
                  )
                  .reduce(
                    (sum: number, option: any) =>
                      sum + (Number(option.value) || 0),
                    0
                  )}
              </p>
            )}
            {answerResult?.feedback && (
              <FeedbackPanel
                feedback={answerResult.feedback}
                hideExpectedAnswer={
                  isYesNoMatrix || currentQuestion.type === "multiple_select"
                }
                hideDetails={
                  isYesNoMatrix || currentQuestion.type === "multiple_select"
                }
              />
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
                      if (currentQuestion.type === "matching")
                        setSelected(
                          Array(currentQuestion.config.leftItems.length).fill(
                            ""
                          )
                        );
                      else if (currentQuestion.type === "fill_blank")
                        setSelected(
                          Array(currentQuestion.config.blanks.length).fill("")
                        );
                      else if (currentQuestion.type === "yes_no_matrix")
                        setSelected(
                          Array(
                            (currentQuestion.config.statements ?? []).length
                          ).fill("")
                        );
                      else
                        setSelected(
                          currentQuestion.type === "multiple_select" ||
                            currentQuestion.type === "sum"
                            ? []
                            : ""
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
              Nota final de 0 a 10: (pontos obtidos ÷ pontos possíveis) × 10.
              {isYesNoMatrix
                ? " Nesta questão, cada frase correta soma uma parte dos pontos."
                : " Em múltipla seleção, a pontuação parcial usa respostas corretas selecionadas menos incorretas, divididas pelo total de corretas, com mínimo zero."}
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
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline">
                        {currentProgress?.progressPercent ?? 0}% concluído
                      </Badge>
                      {subject.isEnrolled ? (
                        <Badge variant="secondary">
                          Matriculado · {formatDate(subject.enrolledAt)}
                        </Badge>
                      ) : (
                        <Button
                          onClick={() =>
                            enrollSubject.mutate({ subjectId: subject.id })
                          }
                          disabled={enrollSubject.isPending}
                        >
                          {enrollSubject.isPending
                            ? "Matriculando…"
                            : "Matricular-se"}
                        </Button>
                      )}
                    </div>
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
                        : `${currentProgress.lastScore.toFixed(2)}/10`}
                    </span>
                    <span>
                      Melhor nota:{" "}
                      {currentProgress?.bestScore == null
                        ? "—"
                        : `${currentProgress.bestScore.toFixed(2)}/10`}
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
                    {!subject.isEnrolled && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                        Matricule-se nesta matéria para liberar as provas. As
                        aulas continuam disponíveis.
                      </div>
                    )}
                    {subject.assessments.map((assessment: any) => (
                      <div
                        key={assessment.id}
                        className="rounded-lg border p-4"
                      >
                        <p className="font-medium">{assessment.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {assessment.description}
                        </p>
                        {subject.isEnrolled && (
                          <div className="mt-3 space-y-2 rounded-lg bg-muted/40 p-3">
                            <p className="flex items-center gap-2 text-sm font-medium">
                              <FileText className="h-4 w-4" />
                              Material de apoio
                            </p>
                            {assessment.materials?.length ? (
                              <ul className="space-y-2">
                                {assessment.materials.map((material: any) => (
                                  <li
                                    key={material.id}
                                    className="flex flex-wrap items-center gap-2 text-sm"
                                  >
                                    <span className="min-w-0 flex-1 break-all">
                                      {material.name}
                                      <span className="ml-2 text-muted-foreground">
                                        {formatFileSize(material.sizeBytes)}
                                      </span>
                                    </span>
                                    <a
                                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                                      href={material.url}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <FileText className="h-4 w-4" />
                                      Consultar online
                                    </a>
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                                      onClick={() =>
                                        downloadAssessmentMaterial(
                                          material.url,
                                          material.name
                                        )
                                      }
                                    >
                                      <Download className="h-4 w-4" />
                                      Baixar
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Nenhum material de apoio disponível.
                              </p>
                            )}
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {assessment.allowPractice && (
                            <Button
                              size="sm"
                              onClick={() => start(assessment.id, "practice")}
                              disabled={
                                !subject.isEnrolled || startAttempt.isPending
                              }
                            >
                              <Play className="mr-1 h-4 w-4" />
                              {assessment.hasActivePracticeAttempt
                                ? "Retomar prática"
                                : "Praticar"}
                            </Button>
                          )}
                          {assessment.allowFormal &&
                            subject.assignedExams
                              .filter(
                                (item: any) =>
                                  item.assessmentId === assessment.id
                              )
                              .map((assigned: any) => {
                                const activeAttempt = assigned.attempts.find(
                                  (item: any) => item.status === "in_progress"
                                );
                                const attemptsLeft =
                                  assigned.maxAttempts -
                                  assigned.attempts.length;
                                const deadlinePassed =
                                  new Date(assigned.deadlineAt).getTime() <
                                  Date.now();
                                const canStart =
                                  subject.isEnrolled &&
                                  (Boolean(activeAttempt) ||
                                    (!deadlinePassed && attemptsLeft > 0));
                                return (
                                  <div
                                    key={assigned.assignmentStudentId}
                                    className="mt-3 w-full rounded-lg bg-muted/40 p-3"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant="outline">
                                        Prova formal aplicada
                                      </Badge>
                                      <span className="text-sm">
                                        Prazo: {formatDate(assigned.deadlineAt)}
                                      </span>
                                      <span className="text-sm text-muted-foreground">
                                        Tentativas: {assigned.attempts.length}/
                                        {assigned.maxAttempts}
                                      </span>
                                    </div>
                                    {assigned.attempts.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {assigned.attempts.map(
                                          (attempt: any, index: number) => (
                                            <Badge
                                              key={attempt.id}
                                              variant={
                                                attempt.status === "completed"
                                                  ? "secondary"
                                                  : "outline"
                                              }
                                            >
                                              Tentativa{" "}
                                              {assigned.attempts.length - index}
                                              :{" "}
                                              {attempt.status === "completed"
                                                ? Number(
                                                    attempt.score ?? 0
                                                  ).toFixed(2) + "/10"
                                                : "Em andamento"}
                                            </Badge>
                                          )
                                        )}
                                      </div>
                                    )}
                                    <Button
                                      className="mt-3"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        start(
                                          assessment.id,
                                          "formal",
                                          assigned.assignmentStudentId
                                        )
                                      }
                                      disabled={
                                        !canStart || startAttempt.isPending
                                      }
                                    >
                                      <LockKeyhole className="mr-1 h-4 w-4" />
                                      {activeAttempt
                                        ? "Continuar prova"
                                        : attemptsLeft <= 0
                                          ? "Tentativas esgotadas"
                                          : deadlinePassed
                                            ? "Prazo encerrado"
                                            : "Iniciar prova formal"}
                                    </Button>
                                  </div>
                                );
                              })}
                          {assessment.allowFormal &&
                            subject.isEnrolled &&
                            !subject.assignedExams.some(
                              (item: any) => item.assessmentId === assessment.id
                            ) && (
                              <p className="mt-3 text-sm text-muted-foreground">
                                A prova formal será liberada quando o instrutor
                                aplicá-la a você.
                              </p>
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
                                  : `${Number(row.score).toFixed(2)}/10`}
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
                          {reviewedAttempt.score.toFixed(2)}/10
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
                          ) : item.type === "yes_no_matrix" ? (
                            <YesNoMatrixReview
                              responses={item.statementResponses ?? []}
                            />
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
                          {item.type === "multiple_select" && (
                            <MultipleSelectCorrections
                              corrections={item.optionCorrections ?? []}
                            />
                          )}
                          {item.type !== "yes_no_matrix" &&
                            item.type !== "multiple_select" && (
                              <p className="mt-2 text-sm">
                                <strong>Esperado:</strong> {item.expectedAnswer}
                              </p>
                            )}
                          {item.explanation && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {item.explanation}
                            </p>
                          )}
                          <div className="mt-3">
                            <SpeechReadButton
                              text={[
                                item.explanation,
                                item.type === "yes_no_matrix"
                                  ? (item.statementResponses ?? [])
                                      .filter(
                                        (response: any) => !response.isCorrect
                                      )
                                      .map(
                                        (response: any) =>
                                          `Correção. ${response.text}. Resposta esperada: ${response.expectedAnswer}. ${response.feedback ?? ""}`
                                      )
                                      .join(" ")
                                  : item.type === "multiple_select"
                                    ? multipleSelectCorrectionAudio(
                                        item.optionCorrections ?? []
                                      )
                                    : item.expectedAnswer,
                                ...(item.details ?? []),
                              ]
                                .filter(Boolean)
                                .join(". ")}
                            />
                          </div>
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
          ) : catalogError ? (
            <TrainingLoadError
              errorCode={catalogError.data?.code}
              onRetry={() => void retryCatalog()}
              isRetrying={isCatalogRefetching}
            />
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
