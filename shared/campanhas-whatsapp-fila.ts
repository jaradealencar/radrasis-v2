/** Regras puras do calendário de campanhas WhatsApp processado em segundo plano. */

export const TAMANHO_LOTE_WTS = 100;
export const QUANTIDADES_ENVIO_PROGRAMADO = [4, 5, 6] as const;
export const MAX_TENTATIVAS_AUTOMATICAS_429 = 5;
export const FUSO_HORARIO_FILA = "America/Campo_Grande";

export type JanelaEnvioFila = {
  ativa: boolean;
  horaInicio: string;
  horaFim: string;
  diasSemana: number[];
};

type PartesLocais = { ano: number; mes: number; dia: number; hora: number; minuto: number; segundo: number; diaSemana: number };

function partesLocais(instante: Date, timeZone = FUSO_HORARIO_FILA): PartesLocais {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);
  const valor = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? "0";
  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    ano: Number(valor("year")), mes: Number(valor("month")), dia: Number(valor("day")),
    hora: Number(valor("hour")), minuto: Number(valor("minute")), segundo: Number(valor("second")),
    diaSemana: dias[valor("weekday")] ?? 0,
  };
}

function minutosDoDia(hora: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!match) throw new Error("Informe os horÃ¡rios no formato HH:mm.");
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) throw new Error("O horÃ¡rio informado nÃ£o Ã© vÃ¡lido.");
  return h * 60 + m;
}

function converterHoraLocalParaUtc(ano: number, mes: number, dia: number, hora: string, timeZone: string): Date {
  const totalMinutos = minutosDoDia(hora);
  const desejadoUtc = Date.UTC(ano, mes - 1, dia, Math.floor(totalMinutos / 60), totalMinutos % 60);
  const obterDeslocamento = (instante: Date) => {
    const local = partesLocais(instante, timeZone);
    return Date.UTC(local.ano, local.mes - 1, local.dia, local.hora, local.minuto, local.segundo) - instante.getTime();
  };
  const aproximado = new Date(desejadoUtc - obterDeslocamento(new Date(desejadoUtc)));
  return new Date(desejadoUtc - obterDeslocamento(aproximado));
}

function validarJanela(janela: JanelaEnvioFila): void {
  if (!janela.ativa) return;
  const inicio = minutosDoDia(janela.horaInicio);
  const fim = minutosDoDia(janela.horaFim);
  if (inicio >= fim) throw new Error("O fim da janela precisa ser posterior ao inÃ­cio no mesmo dia.");
  if (!janela.diasSemana.length || janela.diasSemana.some(dia => !Number.isInteger(dia) || dia < 0 || dia > 6)) {
    throw new Error("Escolha ao menos um dia vÃ¡lido para a janela de envio.");
  }
}

export function estaDentroJanelaEnvio(instante: Date, janela: JanelaEnvioFila, timeZone = FUSO_HORARIO_FILA): boolean {
  validarJanela(janela);
  if (!janela.ativa) return true;
  const local = partesLocais(instante, timeZone);
  const minutoAtual = local.hora * 60 + local.minuto;
  return janela.diasSemana.includes(local.diaSemana)
    && minutoAtual >= minutosDoDia(janela.horaInicio)
    && minutoAtual < minutosDoDia(janela.horaFim);
}

/** Retorna o instante original se estiver dentro da janela; caso contrÃ¡rio, o inÃ­cio vÃ¡lido seguinte. */
export function proximoInstantePermitido(instante: Date, janela: JanelaEnvioFila, timeZone = FUSO_HORARIO_FILA): Date {
  validarJanela(janela);
  if (!janela.ativa || estaDentroJanelaEnvio(instante, janela, timeZone)) return new Date(instante);
  const atual = partesLocais(instante, timeZone);
  const dataBase = new Date(Date.UTC(atual.ano, atual.mes - 1, atual.dia));
  for (let acrescimo = 0; acrescimo <= 7; acrescimo++) {
    const data = new Date(dataBase);
    data.setUTCDate(data.getUTCDate() + acrescimo);
    if (!janela.diasSemana.includes(data.getUTCDay())) continue;
    const candidato = converterHoraLocalParaUtc(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate(), janela.horaInicio, timeZone);
    if (candidato.getTime() >= instante.getTime()) return candidato;
  }
  throw new Error("NÃ£o foi possÃ­vel calcular o prÃ³ximo horÃ¡rio permitido.");
}

export function gerarDatasProgramadas(dataInicial: string, quantidade: number, intervaloDias: number): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicial)) throw new Error("Informe uma data inicial válida.");
  if (!QUANTIDADES_ENVIO_PROGRAMADO.includes(quantidade as (typeof QUANTIDADES_ENVIO_PROGRAMADO)[number])) {
    throw new Error("A quantidade de envios precisa ser 4, 5 ou 6.");
  }
  if (!Number.isInteger(intervaloDias) || intervaloDias < 1 || intervaloDias > 730) {
    throw new Error("O intervalo precisa ser de 1 a 730 dias.");
  }
  const [ano, mes, dia] = dataInicial.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, dia));
  if (inicio.toISOString().slice(0, 10) !== dataInicial) throw new Error("A data inicial não existe.");
  return Array.from({ length: quantidade }, (_, index) => {
    const data = new Date(inicio);
    data.setUTCDate(data.getUTCDate() + intervaloDias * index);
    return data.toISOString().slice(0, 10);
  });
}

export function contarLotes(totalContatos: number, tamanhoLote = TAMANHO_LOTE_WTS): number {
  if (!Number.isInteger(totalContatos) || totalContatos < 0) throw new Error("A quantidade de contatos precisa ser um inteiro não negativo.");
  if (!Number.isInteger(tamanhoLote) || tamanhoLote < 1) throw new Error("O tamanho do lote precisa ser maior que zero.");
  return Math.ceil(totalContatos / tamanhoLote);
}

export function estimarDuracaoFilaSegundos(
  totalContatos: number,
  pausaLotesMinutos: number,
  intervaloEntreContatosSegundos = 3,
): number {
  if (!Number.isInteger(totalContatos) || totalContatos < 0) throw new Error("A quantidade de contatos precisa ser um inteiro nÃ£o negativo.");
  if (!Number.isInteger(pausaLotesMinutos) || pausaLotesMinutos < 1) throw new Error("A pausa entre lotes precisa ser de ao menos um minuto.");
  if (!Number.isInteger(intervaloEntreContatosSegundos) || intervaloEntreContatosSegundos < 0) throw new Error("O intervalo entre contatos precisa ser nÃ£o negativo.");
  const lotes = contarLotes(totalContatos);
  return Math.max(0, totalContatos - 1) * intervaloEntreContatosSegundos
    + Math.max(0, lotes - 1) * pausaLotesMinutos * 60;
}

export function formatarDuracaoEstimada(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) throw new Error("A duraÃ§Ã£o precisa ser um valor nÃ£o negativo.");
  if (segundos === 0) return "0 min";
  const minutos = Math.ceil(segundos / 60);
  const horasInteiras = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  if (horasInteiras === 0) return `${Math.max(1, minutosRestantes)} min`;
  return minutosRestantes ? `${horasInteiras} h ${minutosRestantes} min` : `${horasInteiras} h`;
}

/** 429 Ã© uma recusa explÃ­cita; usa espera exponencial e nunca fica abaixo do Retry-After do provedor. */
export function calcularAtrasoRateLimitSegundos(tentativa: number, retryAfterSeconds?: number): number {
  if (!Number.isInteger(tentativa) || tentativa < 1) throw new Error("A tentativa precisa ser um inteiro positivo.");
  if (retryAfterSeconds !== undefined && (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds < 0)) {
    throw new Error("O Retry-After precisa ser nÃ£o negativo.");
  }
  const exponencial = Math.min(30 * 2 ** Math.min(tentativa - 1, 10), 1800);
  return Math.max(exponencial, Math.ceil(retryAfterSeconds ?? 0));
}

export function numeroLote(indiceContato: number, tamanhoLote = TAMANHO_LOTE_WTS): number {
  if (!Number.isInteger(indiceContato) || indiceContato < 0) throw new Error("O índice do contato precisa ser não negativo.");
  return Math.floor(indiceContato / tamanhoLote) + 1;
}

export type LinhaResumoFila = {
  lote: number;
  status: string;
  statusEntrega?: string | null;
  quantidade?: number;
};

export type EstadoFilaNotificavel = {
  envioProgramadoId: number;
  campanhaNome: string;
  status: string;
  motivoPausa?: string | null;
};

export type AlertaFilaNotificavel = EstadoFilaNotificavel & {
  tipo: "concluido" | "autorizacao";
};

/** Identifica apenas transiÃ§Ãµes ocorridas apÃ³s o painel carregar, evitando alertas antigos na abertura. */
export function detectarAlertasFila(
  anteriores: Map<number, string>,
  atuais: EstadoFilaNotificavel[],
) : AlertaFilaNotificavel[] {
  const alertas: AlertaFilaNotificavel[] = [];
  for (const atual of atuais) {
    const anterior = anteriores.get(atual.envioProgramadoId);
    if (anterior === "em_andamento" && atual.status === "concluido") {
      alertas.push({ ...atual, tipo: "concluido" });
      continue;
    }
    if (anterior === "em_andamento" && atual.status === "pausado" && /401|403|autoriza|acesso negado/i.test(atual.motivoPausa ?? "")) {
      alertas.push({ ...atual, tipo: "autorizacao" });
    }
  }
  return alertas;
}

/** Consolida contadores e lotes a partir das linhas persistidas, inclusive em pausas/retomadas. */
export function resumirFilaProgramada(linhas: LinhaResumoFila[]) {
  const resumo = { aceitos: 0, entregues: 0, pendentes: 0, incertos: 0, falhas: 0, cancelados: 0, lotesConcluidos: 0 };
  const lotes = new Map<number, { aberto: boolean }>();
  const falhasEntrega = new Set(["FAILED", "ERROR", "REJECTED", "FALHOU", "ERRO", "REJEITADO"]);
  const entregues = new Set(["DELIVERED", "READ", "LIDO", "ENTREGUE"]);

  for (const linha of linhas) {
    const quantidade = linha.quantidade ?? 1;
    const statusEntrega = linha.statusEntrega?.toUpperCase() ?? "";
    const lote = lotes.get(linha.lote) ?? { aberto: false };
    if (linha.status === "aceito") resumo.aceitos += quantidade;
    if (entregues.has(statusEntrega)) resumo.entregues += quantidade;
    if (linha.status === "pendente" || linha.status === "enviando") {
      resumo.pendentes += quantidade;
      lote.aberto = true;
    }
    if (linha.status === "incerto") {
      resumo.incertos += quantidade;
      lote.aberto = true;
    }
    if (linha.status === "falha" || falhasEntrega.has(statusEntrega)) resumo.falhas += quantidade;
    if (linha.status === "cancelado") resumo.cancelados += quantidade;
    lotes.set(linha.lote, lote);
  }
  resumo.lotesConcluidos = [...lotes.values()].filter(lote => !lote.aberto).length;
  return resumo;
}

export function formatarEtapa(etapa: number, total: number): string {
  const sufixo = etapa === 1 ? "º" : "º";
  return `${etapa}${sufixo} de ${total}`;
}
