import { normalizarTelefone } from "../../shared/campanhas-whatsapp";

export interface RelatorioCampanha {
  id: number;
  nome: string;
  categoria: string;
  status: string;
  tipo: string;
  templateConfigurado: boolean;
  fontesAtivas: number;
  disparosNoPeriodo: number;
  contatosEnviadosNoPeriodo: number;
  contatosApiNoPeriodo: number;
}

export interface ContatoEnvioRelatorio {
  campanhaId: number;
  telefone: string;
  enviadoEm: string;
}

export interface RespostaRelatorio {
  campanhaId: number | null;
  telefone: string;
  recebidoEm: string;
  tipoMensagem: string;
  ehBot: boolean;
  bufferAte: string;
  processado: boolean;
}

export interface LeadRelatorio {
  campanhaId: number;
  telefone: string;
  analisadoEm: string;
  icpFitScore: number;
  nivelInteresse: number;
}

export interface OrcamentoRelatorio {
  id: string;
  telefone: string | null;
  data: string | null;
  status: "aberto" | "ganho" | "perdido" | "outro";
  valor: number;
}

export interface OrdemRelatorio {
  id: string;
  telefone: string | null;
  data: string | null;
  valor: number;
}

export interface RelatorioJornadaEntrada {
  inicio: string;
  fim: string;
  hoje: string;
  agora: string;
  janelaDias: number;
  campanhas: RelatorioCampanha[];
  contatos: ContatoEnvioRelatorio[];
  respostas: RespostaRelatorio[];
  leads: LeadRelatorio[];
  orcamentos: OrcamentoRelatorio[];
  ordens: OrdemRelatorio[];
  optouts: number;
  telefonesNaQuarentena: number;
  agendamentosAtrasados: number;
}

function diaIso(valor: string): string {
  return valor.slice(0, 10);
}

function dentroDaJanela(
  evento: string | null,
  envio: string,
  janelaDias: number,
  hoje: string
): boolean {
  if (!evento) return false;
  const dataEvento = diaIso(evento);
  const dataEnvio = diaIso(envio);
  if (dataEvento < dataEnvio || dataEvento > hoje) return false;
  const dias = Math.floor(
    (Date.parse(`${dataEvento}T00:00:00Z`) -
      Date.parse(`${dataEnvio}T00:00:00Z`)) /
      86_400_000
  );
  return dias >= 0 && dias <= janelaDias;
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function percentual(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;
}

/**
 * Monta o funil por campanha usando o último envio registrado por telefone como início da coorte.
 * Cotações e O.S. só são associadas pelo telefone normalizado; o resultado não demonstra causalidade.
 */
export function montarRelatorioJornada(entrada: RelatorioJornadaEntrada) {
  const contatosPorCampanha = new Map<number, Map<string, string>>();
  const campanhasComContato = new Map<string, Set<number>>();

  for (const contato of entrada.contatos) {
    const enviadoEm = diaIso(contato.enviadoEm);
    if (enviadoEm < entrada.inicio || enviadoEm > entrada.fim) continue;
    const telefone = normalizarTelefone(contato.telefone);
    if (!telefone) continue;
    const mapa =
      contatosPorCampanha.get(contato.campanhaId) ?? new Map<string, string>();
    const envioAnterior = mapa.get(telefone);
    if (!envioAnterior || envioAnterior < enviadoEm)
      mapa.set(telefone, enviadoEm);
    contatosPorCampanha.set(contato.campanhaId, mapa);
    const campanhas = campanhasComContato.get(telefone) ?? new Set<number>();
    campanhas.add(contato.campanhaId);
    campanhasComContato.set(telefone, campanhas);
  }

  const campanhasPorOrcamento = new Map<string, Set<number>>();
  const orcamentosUnicos = new Map<string, OrcamentoRelatorio>();
  const porCampanha = entrada.campanhas
    .map(campanha => {
      const contatos =
        contatosPorCampanha.get(campanha.id) ?? new Map<string, string>();
      const telefonesHumanos = new Set<string>();
      const telefonesBot = new Set<string>();
      const telefonesQualificados = new Set<string>();
      const telefonesOportunidade = new Set<string>();
      const orcamentos = new Map<string, OrcamentoRelatorio>();
      const ordens = new Map<string, OrdemRelatorio>();
      let cliquesCta = 0;

      for (const resposta of entrada.respostas) {
        if (resposta.campanhaId !== campanha.id) continue;
        const telefone = normalizarTelefone(resposta.telefone);
        const envio = telefone ? contatos.get(telefone) : undefined;
        if (
          !telefone ||
          !envio ||
          !dentroDaJanela(
            resposta.recebidoEm,
            envio,
            entrada.janelaDias,
            entrada.hoje
          )
        )
          continue;
        if (resposta.ehBot) {
          telefonesBot.add(telefone);
        } else {
          telefonesHumanos.add(telefone);
          if (
            resposta.tipoMensagem === "button_reply" ||
            resposta.tipoMensagem === "list_reply"
          )
            cliquesCta++;
        }
      }

      for (const lead of entrada.leads) {
        if (lead.campanhaId !== campanha.id) continue;
        const telefone = normalizarTelefone(lead.telefone);
        const envio = telefone ? contatos.get(telefone) : undefined;
        if (
          !telefone ||
          !envio ||
          !dentroDaJanela(
            lead.analisadoEm,
            envio,
            entrada.janelaDias,
            entrada.hoje
          )
        )
          continue;
        telefonesQualificados.add(telefone);
        if (lead.icpFitScore >= 80 && lead.nivelInteresse >= 4)
          telefonesOportunidade.add(telefone);
      }

      for (const orcamento of entrada.orcamentos) {
        const telefone = orcamento.telefone
          ? normalizarTelefone(orcamento.telefone)
          : null;
        const envio = telefone ? contatos.get(telefone) : undefined;
        if (
          !telefone ||
          !envio ||
          !dentroDaJanela(
            orcamento.data,
            envio,
            entrada.janelaDias,
            entrada.hoje
          )
        )
          continue;
        orcamentos.set(orcamento.id, orcamento);
        orcamentosUnicos.set(orcamento.id, orcamento);
        const campanhasAssociadas =
          campanhasPorOrcamento.get(orcamento.id) ?? new Set<number>();
        campanhasAssociadas.add(campanha.id);
        campanhasPorOrcamento.set(orcamento.id, campanhasAssociadas);
      }

      for (const ordem of entrada.ordens) {
        const telefone = ordem.telefone
          ? normalizarTelefone(ordem.telefone)
          : null;
        const envio = telefone ? contatos.get(telefone) : undefined;
        if (
          !telefone ||
          !envio ||
          !dentroDaJanela(ordem.data, envio, entrada.janelaDias, entrada.hoje)
        )
          continue;
        ordens.set(ordem.id, ordem);
      }

      const listaOrcamentos = [...orcamentos.values()];
      const listaOrdens = [...ordens.values()];
      const receitaAssociada = arredondar(
        listaOrdens.reduce((total, ordem) => total + ordem.valor, 0)
      );
      const taxaRespostaPct = percentual(telefonesHumanos.size, contatos.size);
      const taxaOportunidadePct = percentual(
        telefonesOportunidade.size,
        contatos.size
      );

      return {
        ...campanha,
        contatosNaCoorte: contatos.size,
        respostasHumanas: telefonesHumanos.size,
        respostasBot: telefonesBot.size,
        cliquesCta,
        taxaRespostaPct,
        leadsQualificados: telefonesQualificados.size,
        oportunidadesEstimadas: telefonesOportunidade.size,
        taxaOportunidadePct,
        orcamentos: listaOrcamentos.length,
        orcamentosAbertos: listaOrcamentos.filter(o => o.status === "aberto")
          .length,
        orcamentosGanhos: listaOrcamentos.filter(o => o.status === "ganho")
          .length,
        orcamentosPerdidos: listaOrcamentos.filter(o => o.status === "perdido")
          .length,
        orcamentosOutros: listaOrcamentos.filter(o => o.status === "outro")
          .length,
        valorOrcamentosAbertos: arredondar(
          listaOrcamentos
            .filter(o => o.status === "aberto")
            .reduce((soma, o) => soma + o.valor, 0)
        ),
        ordensServico: listaOrdens.length,
        receitaAssociada,
        ticketMedio: listaOrdens.length
          ? arredondar(receitaAssociada / listaOrdens.length)
          : 0,
      };
    })
    .sort(
      (a, b) =>
        b.receitaAssociada - a.receitaAssociada ||
        b.contatosEnviadosNoPeriodo - a.contatosEnviadosNoPeriodo ||
        a.nome.localeCompare(b.nome)
    );

  const contatosUnicos = new Set<string>();
  const respostasUnicas = new Set<string>();
  const leadsUnicos = new Set<string>();
  const oportunidadesUnicas = new Set<string>();
  for (const [campanhaId, mapa] of contatosPorCampanha) {
    for (const telefone of mapa.keys()) contatosUnicos.add(telefone);
    for (const lead of entrada.leads) {
      if (lead.campanhaId !== campanhaId) continue;
      const telefone = normalizarTelefone(lead.telefone);
      const envio = telefone ? mapa.get(telefone) : undefined;
      if (
        !telefone ||
        !envio ||
        !dentroDaJanela(
          lead.analisadoEm,
          envio,
          entrada.janelaDias,
          entrada.hoje
        )
      )
        continue;
      leadsUnicos.add(`${campanhaId}:${telefone}`);
      if (lead.icpFitScore >= 80 && lead.nivelInteresse >= 4)
        oportunidadesUnicas.add(`${campanhaId}:${telefone}`);
    }
  }
  for (const resposta of entrada.respostas) {
    if (resposta.ehBot || resposta.campanhaId === null) continue;
    const telefone = normalizarTelefone(resposta.telefone);
    const envio = telefone
      ? contatosPorCampanha.get(resposta.campanhaId)?.get(telefone)
      : undefined;
    if (
      telefone &&
      envio &&
      dentroDaJanela(
        resposta.recebidoEm,
        envio,
        entrada.janelaDias,
        entrada.hoje
      )
    )
      respostasUnicas.add(telefone);
  }

  const ordensPorCampanha = new Map<string, Set<number>>();
  for (const campanha of porCampanha) {
    for (const ordem of entrada.ordens) {
      const telefone = ordem.telefone
        ? normalizarTelefone(ordem.telefone)
        : null;
      const envio = telefone
        ? contatosPorCampanha.get(campanha.id)?.get(telefone)
        : undefined;
      if (
        !telefone ||
        !envio ||
        !dentroDaJanela(ordem.data, envio, entrada.janelaDias, entrada.hoje)
      )
        continue;
      const campanhas = ordensPorCampanha.get(ordem.id) ?? new Set<number>();
      campanhas.add(campanha.id);
      ordensPorCampanha.set(ordem.id, campanhas);
    }
  }
  const ordensUnicas = new Map<string, OrdemRelatorio>();
  for (const campanha of entrada.campanhas) {
    const contatos = contatosPorCampanha.get(campanha.id);
    if (!contatos) continue;
    for (const ordem of entrada.ordens) {
      const telefone = ordem.telefone
        ? normalizarTelefone(ordem.telefone)
        : null;
      const envio = telefone ? contatos.get(telefone) : undefined;
      if (
        telefone &&
        envio &&
        dentroDaJanela(ordem.data, envio, entrada.janelaDias, entrada.hoje)
      )
        ordensUnicas.set(ordem.id, ordem);
    }
  }

  const campanhaAtivaSemTemplate = entrada.campanhas
    .filter(c => c.status === "ativa" && !c.templateConfigurado)
    .map(c => ({ id: c.id, nome: c.nome }));
  const campanhaRecorrenteSemFonte = entrada.campanhas
    .filter(
      c =>
        c.status === "ativa" && c.tipo === "recorrente" && c.fontesAtivas === 0
    )
    .map(c => ({ id: c.id, nome: c.nome }));
  const contatosEmMaisDeUmaCampanha = [...campanhasComContato.values()].filter(
    ids => ids.size > 1
  ).length;
  const respostasSemCampanha = entrada.respostas.filter(
    r =>
      r.campanhaId === null &&
      diaIso(r.recebidoEm) >= entrada.inicio &&
      diaIso(r.recebidoEm) <= entrada.fim
  ).length;
  const mensagensPendentes = entrada.respostas.filter(
    r =>
      !r.processado &&
      new Date(r.bufferAte).getTime() <= new Date(entrada.agora).getTime() &&
      diaIso(r.recebidoEm) >= entrada.inicio &&
      diaIso(r.recebidoEm) <= entrada.fim
  ).length;
  const respostasHumanasPeriodo = new Set(
    entrada.respostas
      .filter(
        r =>
          !r.ehBot &&
          r.campanhaId !== null &&
          diaIso(r.recebidoEm) >= entrada.inicio &&
          diaIso(r.recebidoEm) <= entrada.fim
      )
      .map(r => normalizarTelefone(r.telefone))
      .filter((telefone): telefone is string => !!telefone)
  );

  const somar = (
    chave:
      | "disparosNoPeriodo"
      | "contatosEnviadosNoPeriodo"
      | "contatosApiNoPeriodo"
      | "respostasHumanas"
      | "respostasBot"
      | "cliquesCta"
      | "leadsQualificados"
      | "oportunidadesEstimadas"
      | "orcamentos"
      | "orcamentosAbertos"
      | "orcamentosGanhos"
      | "orcamentosPerdidos"
      | "orcamentosOutros"
      | "ordensServico"
  ) => porCampanha.reduce((total, campanha) => total + campanha[chave], 0);
  const receitaPorCampanha = arredondar(
    porCampanha.reduce(
      (total, campanha) => total + campanha.receitaAssociada,
      0
    )
  );
  const receitaOrdensUnicas = arredondar(
    [...ordensUnicas.values()].reduce((total, ordem) => total + ordem.valor, 0)
  );
  const cotacoesUnicas = [...orcamentosUnicos.values()];

  return {
    periodo: {
      inicio: entrada.inicio,
      fim: entrada.fim,
      janelaDias: entrada.janelaDias,
    },
    kpis: {
      campanhasAtivas: entrada.campanhas.filter(c => c.status === "ativa")
        .length,
      campanhasInativas: entrada.campanhas.filter(c => c.status !== "ativa")
        .length,
      contatosNaCoorte: contatosUnicos.size,
      contatosCampanha: somar("contatosEnviadosNoPeriodo"),
      respostasHumanas: respostasUnicas.size,
      taxaRespostaPct: percentual(respostasUnicas.size, contatosUnicos.size),
      leadsQualificados: leadsUnicos.size,
      oportunidadesEstimadas: oportunidadesUnicas.size,
      orcamentos: cotacoesUnicas.length,
      orcamentosAbertos: cotacoesUnicas.filter(o => o.status === "aberto")
        .length,
      orcamentosGanhos: cotacoesUnicas.filter(o => o.status === "ganho").length,
      orcamentosPerdidos: cotacoesUnicas.filter(o => o.status === "perdido")
        .length,
      orcamentosOutros: cotacoesUnicas.filter(o => o.status === "outro").length,
      ordensServico: ordensUnicas.size,
      receitaIdentificadaUnica: receitaOrdensUnicas,
      receitaAssociadaPorCampanha: receitaPorCampanha,
      respostasHumanasNoPeriodo: respostasHumanasPeriodo.size,
    },
    porCampanha,
    auditoria: {
      campanhasAtivasSemTemplate: campanhaAtivaSemTemplate,
      campanhasRecorrentesSemFonte: campanhaRecorrenteSemFonte,
      agendamentosAtrasados: entrada.agendamentosAtrasados,
      respostasSemCampanha,
      mensagensPendentes,
      contatosEmMaisDeUmaCampanha,
      ordensAssociadasAMaisDeUmaCampanha: [
        ...ordensPorCampanha.values(),
      ].filter(ids => ids.size > 1).length,
      orcamentosAssociadosAMaisDeUmaCampanha: [
        ...campanhasPorOrcamento.values(),
      ].filter(ids => ids.size > 1).length,
      totalOptouts: entrada.optouts,
      telefonesNaQuarentena: entrada.telefonesNaQuarentena,
      enviosApiNoPeriodo: somar("contatosApiNoPeriodo"),
      semRespostasHumanasNoPeriodo:
        somar("contatosApiNoPeriodo") > 0 && somar("respostasHumanas") === 0,
    },
  };
}
