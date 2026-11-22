import { hojeIsoCampoGrande, proximoHorarioUtilSemFeriados } from "./campanhaCadenciaRules";

export type FaixaCrmFollowup = {
  faixa: 1 | 2 | 3;
  diasInicio: number;
  diasFim: number;
};

export type EtapaCrmFollowup = {
  numero: number;
  templateId: string;
  atrasoDiasUteis: number;
  faixaCrm: 1 | 2 | 3;
  dataInicioCrm: string;
  dataFimCrm: string;
};

export type EtapaCadencia = {
  numero: number;
  templateId: string;
  atrasoDiasUteis: number;
  faixaCrm?: 1 | 2 | 3;
  dataInicioCrm?: string;
  dataFimCrm?: string;
};

function parseDia(data: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(data);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null;
}

function adicionarDiasCalendario(iso: string, quantidade: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + quantidade));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

function ehDiaDaSemana(iso: string): boolean {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  return diaSemana !== 0 && diaSemana !== 6;
}

function gerarDiasUteis(isoInicial: string, quantidade: number): string[] {
  const dias: string[] = [];
  let cursor = isoInicial;
  for (let tentativas = 0; dias.length < quantidade && tentativas < 3700; tentativas++) {
    cursor = adicionarDiasCalendario(cursor, 1);
    if (ehDiaDaSemana(cursor)) dias.push(cursor);
  }
  return dias;
}

function horarioDaData(iso: string): Date {
  // Cuiabá/Campo Grande usam UTC-4: 12:30 UTC corresponde a 08:30 local.
  return new Date(`${iso}T12:30:00.000Z`);
}

function agendarDentroDaFaixa(inicio: string, fim: string, agora: Date): Date | null {
  const hoje = hojeIsoCampoGrande(agora);
  if (hoje > fim) return null;
  const base = hoje >= inicio ? agora : horarioDaData(inicio);
  const candidato = proximoHorarioUtilSemFeriados(base, 0);
  const dataCandidata = hojeIsoCampoGrande(candidato);
  return dataCandidata >= inicio && dataCandidata <= fim ? candidato : null;
}

/** Cria o snapshot das etapas CRM usando as mesmas faixas úteis mostradas nos cards. */
export function montarEtapasCrmFollowup(input: {
  dataCriacao: string;
  agora: Date;
  faixas: FaixaCrmFollowup[];
  templates: string[];
}): { etapas: EtapaCrmFollowup[]; primeiroEnvioEm: Date | null } {
  const dataInicial = parseDia(input.dataCriacao);
  if (!dataInicial) throw new Error("A data de criação da proposta é inválida.");
  if (input.templates.length !== 3 || input.templates.some(template => !template.trim())) {
    throw new Error("A campanha precisa ter exatamente três templates configurados.");
  }
  const faixas = [...input.faixas].sort((a, b) => a.faixa - b.faixa);
  if (faixas.length !== 3 || faixas.some((faixa, index) =>
    faixa.faixa !== index + 1 || faixa.diasInicio < 1 || faixa.diasFim < faixa.diasInicio || faixa.diasFim > 3650
  )) throw new Error("As três faixas de acompanhamento do CRM estão inválidas.");

  const dias = gerarDiasUteis(dataInicial, Math.max(...faixas.map(faixa => faixa.diasFim)));
  const etapas: EtapaCrmFollowup[] = [];
  let primeiroEnvioEm: Date | null = null;
  for (const faixa of faixas) {
    const diasDaFaixa = dias.slice(faixa.diasInicio - 1, faixa.diasFim);
    if (!diasDaFaixa.length) continue;
    const inicio = diasDaFaixa[0];
    const fim = diasDaFaixa.at(-1)!;
    const proximo = agendarDentroDaFaixa(inicio, fim, input.agora);
    if (!proximo) continue;
    etapas.push({
      numero: etapas.length + 1,
      templateId: input.templates[faixa.faixa - 1],
      atrasoDiasUteis: 0,
      faixaCrm: faixa.faixa,
      dataInicioCrm: hojeIsoCampoGrande(proximo),
      dataFimCrm: fim,
    });
    primeiroEnvioEm ??= proximo;
  }
  return { etapas, primeiroEnvioEm };
}

/** Agenda a próxima etapa em sua própria faixa e retorna null se a janela expirou. */
export function proximoEnvioEtapaCrm(etapa: EtapaCadencia, agora: Date): Date | null {
  if (!etapa.faixaCrm || !etapa.dataInicioCrm || !etapa.dataFimCrm) {
    return proximoHorarioUtilSemFeriados(agora, etapa.atrasoDiasUteis);
  }
  return agendarDentroDaFaixa(etapa.dataInicioCrm, etapa.dataFimCrm, agora);
}
