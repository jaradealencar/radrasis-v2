import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db/db";
import {
  campanhasWhatsapp,
  campanhasWhatsappDisparoItens,
  campanhasWhatsappDisparos,
  campanhasWhatsappEnviosProgramados,
  campanhasWhatsappFilas,
  campanhasWhatsappFilaInscricoes,
  campanhasWhatsappFilaItens,
  campanhasWhatsappOptout,
  campanhasWhatsappQuarentena,
  campanhasWhatsappContatosHistorico,
  campanhasWhatsappMotorEstado,
} from "../../drizzle/schema";
import { enviarTemplateWtsSeguro, idMensagemWts, urlStatusMensagemWts } from "../integrations/wts-chat-client";
import { hojeCampoGrande, normalizarTelefone } from "../../shared/campanhas-whatsapp";
import { calcularAtrasoRateLimitSegundos, estaDentroJanelaEnvio, MAX_TENTATIVAS_AUTOMATICAS_429, proximoInstantePermitido, TAMANHO_LOTE_WTS, type JanelaEnvioFila } from "../../shared/campanhas-whatsapp-fila";

const INTERVALO_ENTRE_CONTATOS_SEGUNDOS = 3;
const LEASE_SEGUNDOS = 60;

type Claim = {
  envio: typeof campanhasWhatsappEnviosProgramados.$inferSelect;
  item: typeof campanhasWhatsappFilaItens.$inferSelect;
  quantidadeEnvios: number;
  pausaLotesMinutos: number;
  janela: JanelaEnvioFila;
  leaseToken: string;
};

function janelaDaFila(fila: typeof campanhasWhatsappFilas.$inferSelect): JanelaEnvioFila {
  return {
    ativa: fila.janelaEnvioAtiva,
    horaInicio: fila.janelaHoraInicio,
    horaFim: fila.janelaHoraFim,
    diasSemana: fila.janelaDiasSemana,
  };
}

async function proximoDelayPendente(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ quando: campanhasWhatsappEnviosProgramados.proximoProcessamentoEm, fila: campanhasWhatsappFilas })
    .from(campanhasWhatsappEnviosProgramados)
    .innerJoin(campanhasWhatsappFilas, eq(campanhasWhatsappFilas.id, campanhasWhatsappEnviosProgramados.filaId))
    .where(and(
      eq(campanhasWhatsappEnviosProgramados.status, "em_andamento"),
      isNotNull(campanhasWhatsappEnviosProgramados.proximoProcessamentoEm),
    ))
    .orderBy(asc(campanhasWhatsappEnviosProgramados.proximoProcessamentoEm));
  if (!rows.length) return null;
  const [motor] = await db.select().from(campanhasWhatsappMotorEstado).where(eq(campanhasWhatsappMotorEstado.id, 1)).limit(1);
  const liberaEm = Math.max(motor?.proximoEnvioEm ? new Date(motor.proximoEnvioEm).getTime() : 0, motor?.leaseAte ? new Date(motor.leaseAte).getTime() : 0);
  const prontaEm = Math.min(...rows.map(row => Math.max(
    proximoInstantePermitido(new Date(row.quando!), janelaDaFila(row.fila)).getTime(),
    liberaEm,
  )));
  return Math.max(1, Math.ceil((prontaEm - Date.now()) / 1000));
}

async function reivindicarContato(): Promise<Claim | null> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const agora = new Date();

  return db.transaction(async tx => {
    const [motor] = await tx.select().from(campanhasWhatsappMotorEstado)
      .where(eq(campanhasWhatsappMotorEstado.id, 1)).limit(1).for("update", { skipLocked: true });
    if (!motor) return null;
    if ((motor.leaseAte && new Date(motor.leaseAte).getTime() > agora.getTime()) ||
        (motor.proximoEnvioEm && new Date(motor.proximoEnvioEm).getTime() > agora.getTime())) return null;

    const [envio] = await tx.select().from(campanhasWhatsappEnviosProgramados)
      .where(and(
        eq(campanhasWhatsappEnviosProgramados.status, "em_andamento"),
        lte(campanhasWhatsappEnviosProgramados.proximoProcessamentoEm, agora),
        or(isNull(campanhasWhatsappEnviosProgramados.leaseAte), lte(campanhasWhatsappEnviosProgramados.leaseAte, agora)),
      ))
      .orderBy(asc(campanhasWhatsappEnviosProgramados.proximoProcessamentoEm), asc(campanhasWhatsappEnviosProgramados.dataAgendada))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!envio) return null;

    const [fila] = await tx.select().from(campanhasWhatsappFilas)
      .where(eq(campanhasWhatsappFilas.id, envio.filaId)).limit(1);
    if (!fila?.ativo) {
      await tx.update(campanhasWhatsappEnviosProgramados).set({
        status: "pausado",
        motivoPausa: "A programação da campanha foi desativada.",
        leaseToken: null,
        leaseAte: null,
        updatedAt: agora,
      }).where(eq(campanhasWhatsappEnviosProgramados.id, envio.id));
      return null;
    }

    const janela = janelaDaFila(fila);
    if (!estaDentroJanelaEnvio(agora, janela)) {
      const proximaJanela = proximoInstantePermitido(agora, janela);
      await tx.update(campanhasWhatsappEnviosProgramados).set({
        proximoProcessamentoEm: proximaJanela,
        updatedAt: agora,
      }).where(eq(campanhasWhatsappEnviosProgramados.id, envio.id));
      return null;
    }

    const [campanha] = await tx.select({ status: campanhasWhatsapp.status })
      .from(campanhasWhatsapp).where(eq(campanhasWhatsapp.id, envio.campanhaId)).limit(1);
    if (campanha?.status !== "ativa") {
      await tx.update(campanhasWhatsappEnviosProgramados).set({
        status: "pausado",
        motivoPausa: "A campanha está inativa.",
        leaseToken: null,
        leaseAte: null,
        updatedAt: agora,
      }).where(eq(campanhasWhatsappEnviosProgramados.id, envio.id));
      return null;
    }

    const [incerto] = await tx.select({ id: campanhasWhatsappFilaItens.id })
      .from(campanhasWhatsappFilaItens)
      .where(and(eq(campanhasWhatsappFilaItens.envioProgramadoId, envio.id), eq(campanhasWhatsappFilaItens.status, "incerto")))
      .limit(1);
    if (incerto) {
      await tx.update(campanhasWhatsappEnviosProgramados).set({
        status: "pausado",
        motivoPausa: "Há um resultado incerto. Consulte o status na WTS.Chat antes de retomar.",
        leaseToken: null,
        leaseAte: null,
        updatedAt: agora,
      }).where(eq(campanhasWhatsappEnviosProgramados.id, envio.id));
      return null;
    }

    const limiteLease = new Date(agora.getTime() - LEASE_SEGUNDOS * 1000);
    const enviosAbandonados = await tx.select().from(campanhasWhatsappFilaItens)
      .where(and(
        eq(campanhasWhatsappFilaItens.envioProgramadoId, envio.id),
        eq(campanhasWhatsappFilaItens.status, "enviando"),
        lte(campanhasWhatsappFilaItens.updatedAt, limiteLease),
      ));
    if (enviosAbandonados.length) {
      for (const item of enviosAbandonados) {
        await tx.update(campanhasWhatsappFilaItens).set({
          status: "incerto",
          erro: "O worker foi interrompido antes de confirmar o resultado do provedor.",
          updatedAt: agora,
        }).where(eq(campanhasWhatsappFilaItens.id, item.id));
      }
      await tx.update(campanhasWhatsappEnviosProgramados).set({
        status: "pausado",
        motivoPausa: "O worker foi interrompido com um envio em andamento. Verifique o status na WTS.Chat antes de retomar.",
        leaseToken: null,
        leaseAte: null,
        updatedAt: agora,
      }).where(eq(campanhasWhatsappEnviosProgramados.id, envio.id));
      return null;
    }

    const [item] = await tx.select().from(campanhasWhatsappFilaItens)
      .where(and(eq(campanhasWhatsappFilaItens.envioProgramadoId, envio.id), eq(campanhasWhatsappFilaItens.status, "pendente")))
      .orderBy(asc(campanhasWhatsappFilaItens.lote), asc(campanhasWhatsappFilaItens.id))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!item) {
      const pendentes = await tx.select({ total: sql<number>`count(*)::int` })
        .from(campanhasWhatsappFilaItens)
        .where(and(eq(campanhasWhatsappFilaItens.envioProgramadoId, envio.id), eq(campanhasWhatsappFilaItens.status, "pendente")));
      const enviando = await tx.select({ total: sql<number>`count(*)::int` })
        .from(campanhasWhatsappFilaItens)
        .where(and(eq(campanhasWhatsappFilaItens.envioProgramadoId, envio.id), eq(campanhasWhatsappFilaItens.status, "enviando")));
      if (Number(pendentes[0]?.total ?? 0) === 0 && Number(enviando[0]?.total ?? 0) === 0) {
        await tx.update(campanhasWhatsappEnviosProgramados).set({
          status: "concluido",
          proximoProcessamentoEm: null,
          concluidoEm: agora,
          leaseToken: null,
          leaseAte: null,
          motivoPausa: null,
          updatedAt: agora,
        }).where(eq(campanhasWhatsappEnviosProgramados.id, envio.id));
      } else {
        await tx.update(campanhasWhatsappEnviosProgramados).set({
          proximoProcessamentoEm: new Date(agora.getTime() + 30_000),
          leaseToken: null,
          leaseAte: null,
          updatedAt: agora,
        }).where(eq(campanhasWhatsappEnviosProgramados.id, envio.id));
      }
      return null;
    }

    const token = randomUUID();
    await tx.update(campanhasWhatsappMotorEstado).set({
      leaseToken: token,
      leaseAte: new Date(agora.getTime() + LEASE_SEGUNDOS * 1000),
      proximoEnvioEm: null,
      updatedAt: agora,
    }).where(eq(campanhasWhatsappMotorEstado.id, 1));
    await tx.update(campanhasWhatsappEnviosProgramados).set({
      leaseToken: token,
      leaseAte: new Date(agora.getTime() + LEASE_SEGUNDOS * 1000),
      updatedAt: agora,
    }).where(eq(campanhasWhatsappEnviosProgramados.id, envio.id));
    const [reivindicado] = await tx.update(campanhasWhatsappFilaItens).set({
      status: "enviando",
      tentativas: sql`${campanhasWhatsappFilaItens.tentativas} + 1`,
      enviadoEm: agora,
      updatedAt: agora,
    }).where(and(eq(campanhasWhatsappFilaItens.id, item.id), eq(campanhasWhatsappFilaItens.status, "pendente"))).returning();
    if (!reivindicado) return null;
    return { envio, item: reivindicado, quantidadeEnvios: fila.quantidadeEnvios, pausaLotesMinutos: fila.pausaLotesMinutos, janela, leaseToken: token };
  });
}

async function finalizarLote(
  claim: Claim,
  estado: "proximo" | "pausado" | "sem-reenvio",
  mensagem?: string,
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const agora = new Date();
  return db.transaction(async tx => {
    const [pendenteMesmoLote] = await tx.select({ total: sql<number>`count(*)::int` })
      .from(campanhasWhatsappFilaItens)
      .where(and(
        eq(campanhasWhatsappFilaItens.envioProgramadoId, claim.envio.id),
        eq(campanhasWhatsappFilaItens.lote, claim.item.lote),
        eq(campanhasWhatsappFilaItens.status, "pendente"),
      ));
    const proximoLote = await tx.select({ lote: campanhasWhatsappFilaItens.lote })
      .from(campanhasWhatsappFilaItens)
      .where(and(
        eq(campanhasWhatsappFilaItens.envioProgramadoId, claim.envio.id),
        eq(campanhasWhatsappFilaItens.status, "pendente"),
        gt(campanhasWhatsappFilaItens.lote, claim.item.lote),
      ))
      .orderBy(asc(campanhasWhatsappFilaItens.lote)).limit(1);
    const delay = Number(pendenteMesmoLote?.total ?? 0) > 0
      ? INTERVALO_ENTRE_CONTATOS_SEGUNDOS
      : proximoLote.length
        ? Math.max(1, claim.pausaLotesMinutos * 60)
        : null;
    const atualizadoEm = delay === null ? null : proximoInstantePermitido(new Date(agora.getTime() + delay * 1000), claim.janela);
    const delayAjustado = atualizadoEm === null ? null : Math.max(1, Math.ceil((atualizadoEm.getTime() - agora.getTime()) / 1000));

    await tx.update(campanhasWhatsappEnviosProgramados).set({
      ...(estado === "pausado" ? { status: "pausado", motivoPausa: mensagem ?? "Fila pausada." } : {}),
      ...(estado === "sem-reenvio" ? { status: "pausado", motivoPausa: mensagem ?? "Envio sem confirmação; confirme o status antes de reenviar." } : {}),
      ...(estado === "proximo" && delay === null ? { status: "concluido", concluidoEm: agora, motivoPausa: null } : {}),
      proximoProcessamentoEm: estado === "proximo" ? atualizadoEm : null,
      ultimoLoteConcluidoEm: Number(pendenteMesmoLote?.total ?? 0) === 0 ? agora : claim.envio.ultimoLoteConcluidoEm,
      leaseToken: null,
      leaseAte: null,
      updatedAt: agora,
    }).where(and(eq(campanhasWhatsappEnviosProgramados.id, claim.envio.id), eq(campanhasWhatsappEnviosProgramados.leaseToken, claim.leaseToken)));
    await tx.update(campanhasWhatsappMotorEstado).set({
      leaseToken: null,
      leaseAte: null,
      proximoEnvioEm: new Date(agora.getTime() + INTERVALO_ENTRE_CONTATOS_SEGUNDOS * 1000),
      updatedAt: agora,
    }).where(and(eq(campanhasWhatsappMotorEstado.id, 1), eq(campanhasWhatsappMotorEstado.leaseToken, claim.leaseToken)));
    return estado === "proximo" ? delayAjustado : null;
  });
}

async function registrarAceite(claim: Claim, resposta: string | undefined): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const agora = new Date();
  const idMensagem = idMensagemWts(resposta);
  const statusUrl = idMensagem ? urlStatusMensagemWts(resposta, idMensagem) : null;
  const telefone = normalizarTelefone(claim.item.telefone);
  if (!telefone) throw new Error("O telefone salvo na fila deixou de ser válido.");
  const data = hojeCampoGrande(agora);

  await db.transaction(async tx => {
    const [item] = await tx.update(campanhasWhatsappFilaItens).set({
      status: "aceito",
      idMensagemWts: idMensagem,
      statusEntrega: "ACEITO",
      erro: null,
      aceitoEm: agora,
      updatedAt: agora,
    }).where(and(eq(campanhasWhatsappFilaItens.id, claim.item.id), eq(campanhasWhatsappFilaItens.status, "enviando"))).returning();
    if (!item) return;

    await tx.update(campanhasWhatsappFilaInscricoes).set({
      etapaAtual: claim.item.etapa >= claim.quantidadeEnvios ? claim.quantidadeEnvios + 1 : claim.item.etapa + 1,
      status: claim.item.etapa >= claim.quantidadeEnvios ? "concluida" : "ativa",
      ultimoEnvioAceitoEm: agora,
      updatedAt: agora,
    }).where(and(
      eq(campanhasWhatsappFilaInscricoes.id, claim.item.inscricaoId),
      eq(campanhasWhatsappFilaInscricoes.etapaAtual, claim.item.etapa),
      eq(campanhasWhatsappFilaInscricoes.status, "ativa"),
    ));

    await tx.insert(campanhasWhatsappQuarentena).values({
      telefone,
      ultimaCampanhaId: claim.item.campanhaId,
      ultimoContatoEm: data,
      updatedAt: agora,
    }).onConflictDoUpdate({ target: campanhasWhatsappQuarentena.telefone, set: {
      ultimaCampanhaId: claim.item.campanhaId,
      ultimoContatoEm: sql`GREATEST(${campanhasWhatsappQuarentena.ultimoContatoEm}, ${data}::date)`,
      updatedAt: agora,
    } });
    await tx.insert(campanhasWhatsappContatosHistorico).values({
      campanhaId: claim.item.campanhaId,
      telefone,
      ultimoEnvioEm: data,
      disparoId: claim.envio.disparoId,
      updatedAt: agora,
    }).onConflictDoUpdate({
      target: [campanhasWhatsappContatosHistorico.campanhaId, campanhasWhatsappContatosHistorico.telefone],
      set: {
        ultimoEnvioEm: sql`GREATEST(${campanhasWhatsappContatosHistorico.ultimoEnvioEm}, ${data}::date)`,
        disparoId: claim.envio.disparoId,
        updatedAt: agora,
      },
    });
    if (claim.envio.disparoId) {
      await tx.insert(campanhasWhatsappDisparoItens).values({
        disparoId: claim.envio.disparoId,
        telefone,
        nome: item.nome,
        wtsMensagemId: idMensagem,
        statusUrl,
        status: idMensagem ? "QUEUED" : "ACEITO_SEM_ID",
        origem: "auto",
        createdAt: agora,
      });
      await tx.update(campanhasWhatsappDisparos).set({
        contatosEnviados: sql`${campanhasWhatsappDisparos.contatosEnviados} + 1`,
      }).where(eq(campanhasWhatsappDisparos.id, claim.envio.disparoId));
    }
  });
}

async function cancelarEnvioSeOptout(claim: Claim): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db.transaction(async tx => {
    const [bloqueado] = await tx.select({ id: campanhasWhatsappOptout.id })
      .from(campanhasWhatsappOptout)
      .where(eq(campanhasWhatsappOptout.telefone, claim.item.telefone))
      .limit(1);
    if (!bloqueado) return false;
    await tx.update(campanhasWhatsappFilaItens).set({
      status: "cancelado",
      erro: "Cancelado porque o contato pediu para não receber mais mensagens.",
      updatedAt: new Date(),
    }).where(and(eq(campanhasWhatsappFilaItens.id, claim.item.id), eq(campanhasWhatsappFilaItens.status, "enviando")));
    await tx.update(campanhasWhatsappFilaInscricoes).set({ status: "opt_out", updatedAt: new Date() })
      .where(eq(campanhasWhatsappFilaInscricoes.id, claim.item.inscricaoId));
    return true;
  });
}

export async function processarUmaEtapaFilaProgramada(): Promise<{
  enviou: boolean;
  semFila: boolean;
  proximoDelaySegundos?: number;
  envioProgramadoId?: number;
}> {
  const claim = await reivindicarContato();
  if (!claim) {
    const delay = await proximoDelayPendente();
    return delay === null ? { enviou: false, semFila: true } : { enviou: false, semFila: false, proximoDelaySegundos: delay };
  }

  if (await cancelarEnvioSeOptout(claim)) {
    const proximoDelaySegundos = await finalizarLote(claim, "proximo");
    return { enviou: false, semFila: proximoDelaySegundos === null, ...(proximoDelaySegundos ? { proximoDelaySegundos } : {}), envioProgramadoId: claim.envio.id };
  }

  let resultado;
  try {
    resultado = await enviarTemplateWtsSeguro(claim.item.telefone, claim.item.templateId);
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Falha de autorização da WTS.Chat.";
    const erroDeConfiguracao = /WTS_CHAT_AUTHORIZATION/i.test(mensagem);
    await getDb().then(db => db?.update(campanhasWhatsappFilaItens).set({ status: erroDeConfiguracao ? "pendente" : "incerto", erro: mensagem, updatedAt: new Date() }).where(eq(campanhasWhatsappFilaItens.id, claim.item.id)));
    await finalizarLote(claim, erroDeConfiguracao ? "pausado" : "sem-reenvio", erroDeConfiguracao ? mensagem : `Resultado incerto; confirme o status na WTS.Chat antes de reenviar. ${mensagem}`);
    return { enviou: false, semFila: false, envioProgramadoId: claim.envio.id };
  }

  if (resultado.ok) {
    await registrarAceite(claim, resultado.resposta);
    const pausa = await finalizarLote(claim, "proximo");
    return {
      enviou: true,
      semFila: pausa === null,
      ...(pausa === null ? {} : { proximoDelaySegundos: pausa }),
      envioProgramadoId: claim.envio.id,
    };
  }

  const idMensagem = idMensagemWts(resultado.resposta);
  if (resultado.incerto) {
    const db = await getDb();
    await db?.update(campanhasWhatsappFilaItens).set({
      status: "incerto",
      idMensagemWts: idMensagem,
      erro: resultado.erro ?? "Resultado incerto no provedor.",
      updatedAt: new Date(),
    }).where(and(eq(campanhasWhatsappFilaItens.id, claim.item.id), eq(campanhasWhatsappFilaItens.status, "enviando"))).returning({ id: campanhasWhatsappFilaItens.id }) ?? [];
    const [estadoAtual] = await db?.select({ status: campanhasWhatsappFilaItens.status }).from(campanhasWhatsappFilaItens)
      .where(eq(campanhasWhatsappFilaItens.id, claim.item.id)).limit(1) ?? [];
    if (estadoAtual?.status === "incerto") await finalizarLote(claim, "sem-reenvio", resultado.erro);
    else await finalizarLote(claim, "proximo");
    return { enviou: false, semFila: false, envioProgramadoId: claim.envio.id };
  }

  if (resultado.status === 401 || resultado.status === 403) {
    const mensagem = resultado.erro ?? `A WTS.Chat recusou a autorização (HTTP ${resultado.status}).`;
    await getDb().then(db => db?.update(campanhasWhatsappFilaItens).set({ status: "pendente", erro: mensagem, updatedAt: new Date() }).where(eq(campanhasWhatsappFilaItens.id, claim.item.id)));
    await finalizarLote(claim, "pausado", mensagem);
    return { enviou: false, semFila: false, envioProgramadoId: claim.envio.id };
  }

  if (resultado.status === 429) {
    if (claim.item.tentativas >= MAX_TENTATIVAS_AUTOMATICAS_429) {
      const db = await getDb();
      await db?.update(campanhasWhatsappFilaItens).set({ status: "falha", erro: `Limite de ${MAX_TENTATIVAS_AUTOMATICAS_429} tentativas por limite de taxa atingido. ${resultado.erro ?? ""}`.trim(), updatedAt: new Date() })
        .where(eq(campanhasWhatsappFilaItens.id, claim.item.id));
      await db?.update(campanhasWhatsappEnviosProgramados).set({ falhas: sql`${campanhasWhatsappEnviosProgramados.falhas} + 1`, updatedAt: new Date() })
        .where(eq(campanhasWhatsappEnviosProgramados.id, claim.envio.id));
      const proximoDelaySegundos = await finalizarLote(claim, "proximo");
      return { enviou: false, semFila: proximoDelaySegundos === null, ...(proximoDelaySegundos ? { proximoDelaySegundos } : {}), envioProgramadoId: claim.envio.id };
    }
    const atraso = calcularAtrasoRateLimitSegundos(claim.item.tentativas, resultado.retryAfterSeconds);
    const proximaTentativa = proximoInstantePermitido(new Date(Date.now() + atraso * 1000), claim.janela);
    const atrasoAgendado = Math.max(1, Math.ceil((proximaTentativa.getTime() - Date.now()) / 1000));
    await getDb().then(db => db?.update(campanhasWhatsappFilaItens).set({ status: "pendente", erro: resultado.erro, updatedAt: new Date() }).where(eq(campanhasWhatsappFilaItens.id, claim.item.id)));
    const db = await getDb();
    await db?.update(campanhasWhatsappEnviosProgramados).set({
      proximoProcessamentoEm: proximaTentativa,
      leaseToken: null,
      leaseAte: null,
      motivoPausa: null,
      updatedAt: new Date(),
    }).where(eq(campanhasWhatsappEnviosProgramados.id, claim.envio.id));
    await db?.update(campanhasWhatsappMotorEstado).set({
      leaseToken: null,
      leaseAte: null,
      proximoEnvioEm: new Date(Date.now() + INTERVALO_ENTRE_CONTATOS_SEGUNDOS * 1000),
      updatedAt: new Date(),
    }).where(and(eq(campanhasWhatsappMotorEstado.id, 1), eq(campanhasWhatsappMotorEstado.leaseToken, claim.leaseToken)));
    return { enviou: false, semFila: false, proximoDelaySegundos: atrasoAgendado, envioProgramadoId: claim.envio.id };
  }

  const erro = resultado.erro ?? "A WTS.Chat recusou este contato.";
  const db = await getDb();
  await db?.update(campanhasWhatsappFilaItens).set({ status: "falha", erro, updatedAt: new Date() })
    .where(eq(campanhasWhatsappFilaItens.id, claim.item.id));
  await db?.update(campanhasWhatsappEnviosProgramados).set({ falhas: sql`${campanhasWhatsappEnviosProgramados.falhas} + 1`, updatedAt: new Date() })
    .where(eq(campanhasWhatsappEnviosProgramados.id, claim.envio.id));
  const proximoDelaySegundos = await finalizarLote(claim, "proximo");
  return { enviou: false, semFila: proximoDelaySegundos === null, ...(proximoDelaySegundos ? { proximoDelaySegundos } : {}), envioProgramadoId: claim.envio.id };
}

export async function registrarStatusFilaProgramada(input: {
  idMensagem: string;
  status: string;
  ocorridoEm?: Date;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [item] = await db.select().from(campanhasWhatsappFilaItens)
    .where(eq(campanhasWhatsappFilaItens.idMensagemWts, input.idMensagem)).limit(1);
  if (!item) return false;
  const status = input.status.trim().toUpperCase();
  const quando = input.ocorridoEm ?? new Date();
  if (["QUEUED", "SENT", "ENVIADO", "DELIVERED", "READ", "LIDO", "ENTREGUE"].includes(status) && ["incerto", "enviando"].includes(item.status)) {
    await db.transaction(async tx => {
      const [envio] = await tx.select().from(campanhasWhatsappEnviosProgramados)
        .where(eq(campanhasWhatsappEnviosProgramados.id, item.envioProgramadoId)).limit(1);
      if (!envio) return;
      const [fila] = await tx.select().from(campanhasWhatsappFilas)
        .where(eq(campanhasWhatsappFilas.id, envio.filaId)).limit(1);
      const [aceito] = await tx.update(campanhasWhatsappFilaItens).set({
        status: "aceito",
        statusEntrega: status,
        aceitoEm: quando,
        ...( ["DELIVERED", "READ", "LIDO", "ENTREGUE"].includes(status) ? { entregueEm: quando } : {}),
        erro: null,
        updatedAt: new Date(),
      }).where(and(eq(campanhasWhatsappFilaItens.id, item.id), sql`${campanhasWhatsappFilaItens.status} IN ('incerto', 'enviando')`)).returning();
      if (!aceito) return;
      await tx.update(campanhasWhatsappFilaInscricoes).set({
        etapaAtual: item.etapa + 1,
        status: item.etapa >= (fila?.quantidadeEnvios ?? item.etapa) ? "concluida" : "ativa",
        ultimoEnvioAceitoEm: quando,
        updatedAt: new Date(),
      }).where(and(eq(campanhasWhatsappFilaInscricoes.id, item.inscricaoId), eq(campanhasWhatsappFilaInscricoes.etapaAtual, item.etapa)));
      await tx.update(campanhasWhatsappEnviosProgramados).set({
        aceitos: sql`${campanhasWhatsappEnviosProgramados.aceitos} + 1`,
        ...(["DELIVERED", "READ", "LIDO", "ENTREGUE"].includes(status) ? { entregues: sql`${campanhasWhatsappEnviosProgramados.entregues} + 1` } : {}),
        updatedAt: new Date(),
      }).where(eq(campanhasWhatsappEnviosProgramados.id, item.envioProgramadoId));
      const telefone = normalizarTelefone(item.telefone);
      if (telefone) {
        const data = hojeCampoGrande(quando);
        await tx.insert(campanhasWhatsappQuarentena).values({ telefone, ultimaCampanhaId: item.campanhaId, ultimoContatoEm: data, updatedAt: quando })
          .onConflictDoUpdate({ target: campanhasWhatsappQuarentena.telefone, set: {
            ultimaCampanhaId: item.campanhaId,
            ultimoContatoEm: sql`GREATEST(${campanhasWhatsappQuarentena.ultimoContatoEm}, ${data}::date)`,
            updatedAt: quando,
          } });
        await tx.insert(campanhasWhatsappContatosHistorico).values({
          campanhaId: item.campanhaId,
          telefone,
          ultimoEnvioEm: data,
          disparoId: envio.disparoId,
          updatedAt: quando,
        }).onConflictDoUpdate({
          target: [campanhasWhatsappContatosHistorico.campanhaId, campanhasWhatsappContatosHistorico.telefone],
          set: { ultimoEnvioEm: sql`GREATEST(${campanhasWhatsappContatosHistorico.ultimoEnvioEm}, ${data}::date)`, disparoId: envio.disparoId, updatedAt: quando },
        });
        if (envio.disparoId) {
          const [existente] = await tx.select({ id: campanhasWhatsappDisparoItens.id }).from(campanhasWhatsappDisparoItens)
            .where(and(eq(campanhasWhatsappDisparoItens.disparoId, envio.disparoId), eq(campanhasWhatsappDisparoItens.telefone, telefone))).limit(1);
          if (!existente) await tx.insert(campanhasWhatsappDisparoItens).values({
            disparoId: envio.disparoId,
            telefone,
            nome: item.nome,
            wtsMensagemId: input.idMensagem,
            status: status,
            origem: "auto",
            createdAt: quando,
          });
          await tx.update(campanhasWhatsappDisparos).set({ contatosEnviados: sql`${campanhasWhatsappDisparos.contatosEnviados} + 1` })
            .where(eq(campanhasWhatsappDisparos.id, envio.disparoId));
        }
      }
    });
    return true;
  }
  if (["FAILED", "ERROR", "REJECTED", "FALHOU", "ERRO", "REJEITADO"].includes(status) && ["incerto", "enviando"].includes(item.status)) {
    await db.transaction(async tx => {
      const [falhou] = await tx.update(campanhasWhatsappFilaItens).set({
        status: "falha",
        statusEntrega: status,
        erro: `Status confirmado pela WTS.Chat: ${status}`,
        updatedAt: new Date(),
      }).where(and(eq(campanhasWhatsappFilaItens.id, item.id), sql`${campanhasWhatsappFilaItens.status} IN ('incerto', 'enviando')`)).returning();
      if (falhou) await tx.update(campanhasWhatsappEnviosProgramados).set({ falhas: sql`${campanhasWhatsappEnviosProgramados.falhas} + 1`, updatedAt: new Date() })
        .where(eq(campanhasWhatsappEnviosProgramados.id, item.envioProgramadoId));
    });
    return true;
  }
  if (["DELIVERED", "READ", "LIDO", "ENTREGUE"].includes(status)) {
    await db.transaction(async tx => {
      const [alterado] = await tx.update(campanhasWhatsappFilaItens).set({
        statusEntrega: status,
        entregueEm: item.entregueEm ?? quando,
        updatedAt: new Date(),
      }).where(and(
        eq(campanhasWhatsappFilaItens.id, item.id),
        isNull(campanhasWhatsappFilaItens.entregueEm),
        or(
          isNull(campanhasWhatsappFilaItens.statusEntrega),
          sql`${campanhasWhatsappFilaItens.statusEntrega} NOT IN ('FAILED', 'ERROR', 'REJECTED', 'FALHOU', 'ERRO', 'REJEITADO')`,
        ),
      )).returning();
      if (alterado) {
        await tx.update(campanhasWhatsappEnviosProgramados).set({ entregues: sql`${campanhasWhatsappEnviosProgramados.entregues} + 1`, updatedAt: new Date() })
          .where(eq(campanhasWhatsappEnviosProgramados.id, item.envioProgramadoId));
        if (item.envioProgramadoId) {
          const [execucao] = await tx.select({ disparoId: campanhasWhatsappEnviosProgramados.disparoId })
            .from(campanhasWhatsappEnviosProgramados).where(eq(campanhasWhatsappEnviosProgramados.id, item.envioProgramadoId)).limit(1);
          if (execucao?.disparoId) {
            await tx.update(campanhasWhatsappDisparoItens).set({ status, statusConsultadoEm: new Date() })
              .where(and(eq(campanhasWhatsappDisparoItens.disparoId, execucao.disparoId), eq(campanhasWhatsappDisparoItens.telefone, item.telefone)));
          }
        }
      }
    });
    return true;
  }
  if (["FAILED", "ERROR", "REJECTED", "FALHOU", "ERRO", "REJEITADO"].includes(status)) {
    await db.transaction(async tx => {
      const [alterado] = await tx.update(campanhasWhatsappFilaItens).set({
        statusEntrega: status,
        erro: `Status confirmado pela WTS.Chat: ${status}`,
        updatedAt: new Date(),
      }).where(and(
        eq(campanhasWhatsappFilaItens.id, item.id),
        or(
          isNull(campanhasWhatsappFilaItens.statusEntrega),
          sql`${campanhasWhatsappFilaItens.statusEntrega} NOT IN ('FAILED', 'ERROR', 'REJECTED', 'FALHOU', 'ERRO', 'REJEITADO', 'DELIVERED', 'READ', 'LIDO', 'ENTREGUE')`,
        ),
      )).returning();
      if (alterado) {
        await tx.update(campanhasWhatsappEnviosProgramados).set({ falhas: sql`${campanhasWhatsappEnviosProgramados.falhas} + 1`, updatedAt: new Date() })
          .where(eq(campanhasWhatsappEnviosProgramados.id, item.envioProgramadoId));
        if (item.envioProgramadoId) {
          const [execucao] = await tx.select({ disparoId: campanhasWhatsappEnviosProgramados.disparoId })
            .from(campanhasWhatsappEnviosProgramados).where(eq(campanhasWhatsappEnviosProgramados.id, item.envioProgramadoId)).limit(1);
          if (execucao?.disparoId) {
            await tx.update(campanhasWhatsappDisparoItens).set({ status, statusDetalhe: `Status confirmado pela WTS.Chat: ${status}`, statusConsultadoEm: new Date() })
              .where(and(eq(campanhasWhatsappDisparoItens.disparoId, execucao.disparoId), eq(campanhasWhatsappDisparoItens.telefone, item.telefone)));
          }
        }
      }
    });
    return true;
  }
  return ["QUEUED", "SENT", "ENVIADO"].includes(status);
}
