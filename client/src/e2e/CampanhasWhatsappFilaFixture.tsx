import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import FilaProgramadaDashboard from "@/pages/financeiro/campanhasWhatsapp/FilaProgramadaDashboard";
import ProgramacaoCadenciaPanel from "@/pages/financeiro/campanhasWhatsapp/ProgramacaoCadenciaPanel";
import { trpc } from "@/lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import { gerarDatasProgramadas } from "@shared/campanhas-whatsapp-fila";
import "@/index.css";

const CAMPANHA_ID = 101;
const ENVIO_EM_ANDAMENTO_ID = 401;
const ENVIO_PENDENTE_ID = 402;

const config = {
  quantidadeEnvios: 6,
  dataInicial: "2026-11-20",
  intervaloDias: 30,
  pausaLotesMinutos: 5,
};

let pausaAtiva = false;
let campanhaPendenteIniciada = false;

function calendarioFake(campanhaId: number) {
  const datas = gerarDatasProgramadas(config.dataInicial, config.quantidadeEnvios, config.intervaloDias);
  const status = ["concluido", "concluido", "concluido", "em_andamento", "agendado", "agendado"];
  return {
    campanha: {
      id: campanhaId,
      nome: campanhaId === CAMPANHA_ID ? "São Paulo 01" : "Campanha PR",
      status: "ativa",
      motorCadenciaAtivo: false,
    },
    fila: { id: 10, campanhaId, ...config, ativo: true },
    envios: datas.map((dataAgendada, index) => ({
      id: ENVIO_EM_ANDAMENTO_ID + index,
      filaId: 10,
      campanhaId,
      etapa: index + 1,
      dataAgendada,
      templateId: `template-etapa-${index + 1}`,
      versaoEtapas: 1,
      status: status[index],
      situacao: status[index],
      totalContatos: index < 3 ? 1700 : 0,
      aceitos: index < 3 ? 1700 : 0,
      entregues: index < 3 ? 1640 : 0,
      falhas: 0,
      cancelados: 0,
      proximoProcessamentoEm: index === 3 ? "2026-11-21T14:15:00-06:00" : null,
    })),
    canal: { id: "canal-demo-whatsapp", telefone: "5511999990000" },
  };
}

function resumoFilas() {
  const linhas = [
    {
      campanhaId: CAMPANHA_ID,
      campanhaNome: "São Paulo 01",
      campanhaStatus: "ativa",
      etapa: 4,
      totalEtapas: 6,
      data: "2027-02-18",
      status: pausaAtiva ? "pausado" : "em_andamento",
      situacao: pausaAtiva ? "pausado" : "em_andamento",
      envioProgramadoId: ENVIO_EM_ANDAMENTO_ID,
      totalContatos: 1700,
      lotes: 17,
      lotesConcluidos: 3,
      aceitos: 300,
      entregues: 280,
      pendentes: 1400,
      incertos: 0,
      falhas: 0,
      cancelados: 0,
      motivoPausa: pausaAtiva ? "Pausado pelo usuário." : null,
      proximoProcessamentoEm: pausaAtiva ? null : "2026-11-21T14:15:00-06:00",
    },
    {
      campanhaId: 102,
      campanhaNome: "Campanha PR",
      campanhaStatus: "ativa",
      etapa: 2,
      totalEtapas: 5,
      data: "2026-11-21",
      status: campanhaPendenteIniciada ? "em_andamento" : "agendado",
      situacao: campanhaPendenteIniciada ? "em_andamento" : "pendente_revisao",
      envioProgramadoId: ENVIO_PENDENTE_ID,
      totalContatos: campanhaPendenteIniciada ? 250 : 0,
      lotes: 3,
      lotesConcluidos: campanhaPendenteIniciada ? 1 : 0,
      aceitos: campanhaPendenteIniciada ? 100 : 0,
      entregues: campanhaPendenteIniciada ? 95 : 0,
      pendentes: campanhaPendenteIniciada ? 150 : 0,
      incertos: 0,
      falhas: 0,
      cancelados: 0,
      motivoPausa: null,
      proximoProcessamentoEm: campanhaPendenteIniciada ? "2026-11-21T14:20:00-06:00" : null,
    },
    {
      campanhaId: 103,
      campanhaNome: "Campanha SC",
      campanhaStatus: "ativa",
      etapa: 2,
      totalEtapas: 4,
      data: "2026-11-18",
      status: "pausado",
      situacao: "pausado",
      envioProgramadoId: 403,
      totalContatos: 400,
      lotes: 4,
      lotesConcluidos: 1,
      aceitos: 100,
      entregues: 92,
      pendentes: 300,
      incertos: 0,
      falhas: 0,
      cancelados: 0,
      motivoPausa: "Acesso negado pela WTS.Chat (HTTP 403).",
      proximoProcessamentoEm: null,
    },
  ];
  return linhas;
}

function detalhesFake(envioProgramadoId: number) {
  const emAndamento = envioProgramadoId === ENVIO_EM_ANDAMENTO_ID;
  const total = emAndamento ? 1700 : 250;
  const lotes = Math.ceil(total / 100);
  const etapa = emAndamento ? 4 : 2;
  const itensAceitos = emAndamento ? 300 : campanhaPendenteIniciada ? 100 : 0;
  const envio = {
    id: envioProgramadoId,
    filaId: emAndamento ? 10 : 11,
    campanhaId: emAndamento ? CAMPANHA_ID : 102,
    etapa,
    dataAgendada: emAndamento ? "2027-02-18" : "2026-11-21",
    templateId: `template-etapa-${etapa}`,
    status: emAndamento ? (pausaAtiva ? "pausado" : "em_andamento") : campanhaPendenteIniciada ? "em_andamento" : "agendado",
    totalContatos: total,
    aceitos: itensAceitos,
    entregues: emAndamento ? 280 : 95,
    falhas: 0,
    motivoPausa: emAndamento && pausaAtiva ? "Pausado pelo usuário." : null,
    proximoProcessamentoEm: "2026-11-21T14:15:00-06:00",
  };
  const lotesDetalhe = Array.from({ length: lotes }, (_, index) => {
    const aceitosNoLote = Math.max(0, Math.min(100, itensAceitos - index * 100));
    const tamanho = Math.min(100, total - index * 100);
    return {
      lote: index + 1,
      total: tamanho,
      aceitos: aceitosNoLote,
      entregues: Math.min(aceitosNoLote, Math.round(aceitosNoLote * 0.93)),
      pendentes: tamanho - aceitosNoLote,
      incertos: 0,
      falhas: 0,
      cancelados: 0,
    };
  });
  return {
    campanha: { id: envio.campanhaId, nome: emAndamento ? "São Paulo 01" : "Campanha PR" },
    envio,
    fila: { id: envio.filaId, quantidadeEnvios: emAndamento ? 6 : 5, pausaLotesMinutos: config.pausaLotesMinutos },
    grupos: [{ etapa, templateId: envio.templateId, quantidade: total, lotes }],
    contatosAptos: total,
    lotes,
    contatosPorEtapa: [{ etapa, quantidade: total }],
    lotesDetalhe,
    itensIncertos: [],
    canal: { id: "canal-demo-whatsapp", telefone: "5511999990000" },
    podeIniciar: !emAndamento && !campanhaPendenteIniciada,
    bloqueio: null,
  };
}

function unpackInput(raw: string | null, index: number): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { json?: unknown };
    const batchEntry = (parsed as Record<string, unknown>)[String(index)];
    const value = batchEntry ?? parsed.json ?? parsed;
    const first = Array.isArray(value) ? value[0] : value;
    if (!first || typeof first !== "object") return {};
    const record = first as Record<string, unknown>;
    const unwrapped = record.json && typeof record.json === "object" ? record.json : record;
    return unwrapped as Record<string, unknown>;
  } catch {
    return {};
  }
}

const fakeTrpcFetch: typeof fetch = async (requestInput, init) => {
  const requestUrl = requestInput instanceof Request
    ? new URL(requestInput.url)
    : new URL(String(requestInput), window.location.origin);
  const procedures = requestUrl.pathname.replace("/api/trpc/", "").split(",");
  const body = typeof init?.body === "string" ? init.body : null;
  const rawInput = body ?? requestUrl.searchParams.get("input");

  const results = procedures.map((procedure, index) => {
    const payloadInput = unpackInput(rawInput, index);
    if (procedure.endsWith("listarFilasProgramadas")) return resumoFilas();
    if (procedure.endsWith("obterProgramacaoFila")) return calendarioFake(Number(payloadInput.campanhaId ?? CAMPANHA_ID));
    if (procedure.endsWith("obterConfiguracaoCadencia")) {
      return { etapas: Array.from({ length: 6 }, (_, index) => ({ numero: index + 1, templateId: `template-etapa-${index + 1}` })), versaoAtual: 1 };
    }
    if (procedure.endsWith("revisarEnvioProgramado")) return detalhesFake(Number(payloadInput.envioProgramadoId ?? ENVIO_EM_ANDAMENTO_ID));
    if (procedure.endsWith("salvarProgramacaoFila")) {
      Object.assign(config, payloadInput);
      return { ativo: true, datas: gerarDatasProgramadas(String(config.dataInicial), Number(config.quantidadeEnvios), Number(config.intervaloDias)) };
    }
    if (procedure.endsWith("iniciarEnvioProgramado")) {
      campanhaPendenteIniciada = true;
      return { envioProgramadoId: ENVIO_PENDENTE_ID, reutilizado: false, status: "em_andamento" };
    }
    if (procedure.endsWith("pausarEnvioProgramado")) {
      pausaAtiva = true;
      return { ok: true };
    }
    if (procedure.endsWith("retomarEnvioProgramado")) {
      pausaAtiva = false;
      return { ok: true };
    }
    if (procedure.endsWith("verificarItemEnvioProgramado")) return { estado: "QUEUED", detalhe: "Mensagem aceita pela WTS.Chat." };
    return null;
  });

  const payload = results.map(result => ({ result: { data: { json: result } } }));
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, fetch: fakeTrpcFetch })],
});

function CampanhasWhatsappFilaFixture() {
  return (
    <main className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Prévia · campanhas de WhatsApp</h1>
        <p className="text-sm text-muted-foreground">Dados fictícios para revisão visual. Nenhuma mensagem será enviada e nenhum banco será acessado.</p>
      </header>
      <FilaProgramadaDashboard />
      <ProgramacaoCadenciaPanel campanhaId={CAMPANHA_ID} aberto />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <CampanhasWhatsappFilaFixture />
      <Toaster />
    </QueryClientProvider>
  </trpc.Provider>,
);
