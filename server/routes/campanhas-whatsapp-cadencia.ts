import type { Express, Request, Response } from "express";
import { z } from "zod";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { exigirChaveApi } from "./campanhas-whatsapp-api";
import { exigirChaveWebhookWtsDedicada } from "./campanhas-whatsapp-webhook-auth";
import { sincronizarCampanhasWhatsappErp } from "../sync/scheduled-sync-campanhas-whatsapp-erp";
import { sincronizarClientesLote } from "../sync/clientes-mubisys";
import { recalcularFatosContatoErp, registrarTentativaSyncErp } from "../services/campanhaCadenciaErp";
import { invalidarCacheContextoErp } from "../services/fontesErpCampanhas";
import {
  campanhasWhatsapp,
  campanhasWhatsappInscricoes,
} from "../../drizzle/schema";
import { getDb } from "../db/db";
import {
  processarUmaEtapaCadencia,
  registrarStatusWebhookWts,
  sincronizarAudienciasCadencia,
} from "../services/campanhaCadenciaEngine";

function erro(res: Response, e: unknown) {
  const mensagem = e instanceof Error ? e.message : "Falha ao processar a engine de cadências.";
  console.error("[campanhas-whatsapp-cadencia]", e);
  res.status(503).json({ ok: false, erro: mensagem });
}

async function enfileirarProximoWorker(delaySegundos: number): Promise<boolean> {
  const token = process.env.QSTASH_TOKEN?.trim();
  const destino = process.env.CAMPANHAS_CADENCIA_WORKER_URL?.trim();
  const chave = process.env.CAMPANHAS_API_KEY?.trim();
  if (!token || !destino || !chave) return false;
  const destinoUrl = new URL(destino);
  if (destinoUrl.protocol !== "https:") throw new Error("CAMPANHAS_CADENCIA_WORKER_URL precisa usar HTTPS.");
  const response = await fetch(`https://qstash.upstash.io/v2/publish/${destino}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Upstash-Delay": `${Math.max(1, delaySegundos)}s`,
      "Upstash-Retries": "0",
      "Upstash-Forward-x-api-key": chave,
    },
    body: JSON.stringify({ origem: "continuidade-cadencia" }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`QStash recusou a continuação (HTTP ${response.status}).`);
  return true;
}

async function enfileirarPaginaClientes(pagina: number): Promise<boolean> {
  const token = process.env.QSTASH_TOKEN?.trim();
  const chave = process.env.CAMPANHAS_API_KEY?.trim();
  const workerUrl = process.env.CAMPANHAS_CADENCIA_WORKER_URL?.trim();
  if (!token || !chave || !workerUrl) return false;
  const base = new URL(workerUrl);
  if (base.protocol !== "https:") throw new Error("CAMPANHAS_CADENCIA_WORKER_URL precisa usar HTTPS.");
  const destino = new URL("/api/scheduled/campanhasWhatsapp/sincronizarClientes", base.origin);
  const response = await fetch(`https://qstash.upstash.io/v2/publish/${destino.href}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Upstash-Delay": "2s",
      "Upstash-Retries": "0",
      "Upstash-Forward-x-api-key": chave,
    },
    body: JSON.stringify({ origem: "sincronizacao-clientes", pagina }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`QStash recusou a sincronização da página ${pagina} (HTTP ${response.status}).`);
  return true;
}

function extrairStatusWts(raw: unknown): { idMensagem: string; status: string; ocorridoEm?: Date } | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const content = root.content && typeof root.content === "object" ? root.content as Record<string, unknown> : {};
  const message = root.message && typeof root.message === "object" ? root.message as Record<string, unknown> : {};
  const id = root.messageId ?? root.message_id ?? root.id ?? content.messageId ?? content.message_id ?? content.id ?? message.id;
  const status = root.status ?? root.statusName ?? root.eventType ?? content.status ?? content.eventType ?? message.status;
  if (typeof id !== "string" || id.length < 8 || id.length > 128 || typeof status !== "string" || status.length > 32) return null;
  const rawDate = root.timestamp ?? root.date ?? content.timestamp ?? content.date;
  const numeroDate = typeof rawDate === "number" ? rawDate : typeof rawDate === "string" && /^\d{10,13}$/.test(rawDate) ? Number(rawDate) : null;
  const date = numeroDate !== null
    ? new Date(numeroDate < 1_000_000_000_000 ? numeroDate * 1000 : numeroDate)
    : typeof rawDate === "string" ? new Date(rawDate) : null;
  return { idMensagem: id, status, ocorridoEm: date && !Number.isNaN(date.getTime()) ? date : undefined };
}

export function registrarRotasCampanhasWhatsappCadencia(app: Express) {
  app.post("/api/scheduled/campanhasWhatsapp/sincronizarClientes", exigirChaveApi, async (req: Request, res: Response) => {
    const pagina = Math.max(1, Math.floor(Number(req.body?.pagina ?? req.query.pagina) || 1));
    try {
      await registrarTentativaSyncErp("clientes", "Sincronização do cadastro em andamento.", false);
      if (pagina === 1) {
        await registrarTentativaSyncErp("fatos", "Aguardando conclusão da sincronização do cadastro ERP.", false);
      }
      const lote = await sincronizarClientesLote(pagina, 20);
      if (lote.proximaPagina) {
        const continuacaoEnfileirada = await enfileirarPaginaClientes(lote.proximaPagina);
        if (!continuacaoEnfileirada) throw new Error("QStash não está configurado para concluir a sincronização do cadastro ERP.");
        res.status(200).json({ ok: true, completo: false, ...lote, continuacaoEnfileirada });
        return;
      }
      invalidarCacheContextoErp();
      await recalcularFatosContatoErp();
      await registrarTentativaSyncErp("fatos");
      await registrarTentativaSyncErp("clientes");
      res.status(200).json({ ok: true, completo: true, ...lote, continuacaoEnfileirada: false });
    } catch (e) {
      await registrarTentativaSyncErp("clientes", e instanceof Error ? e.message : "Falha ao sincronizar o cadastro de clientes.", false).catch(() => undefined);
      await registrarTentativaSyncErp("fatos", e instanceof Error ? e.message : "Falha ao atualizar fatos após sincronizar o cadastro de clientes.", false).catch(() => undefined);
      erro(res, e);
    }
  });

  app.post("/api/scheduled/campanhasWhatsapp/sincronizarErp", exigirChaveApi, async (req: Request, res: Response) => {
    const recurso = req.query.recurso;
    if (recurso !== "ordens" && recurso !== "orcamentos") {
      res.status(400).json({ ok: false, erro: "Informe recurso=ordens ou recurso=orcamentos." });
      return;
    }
    try {
      const resultado = await sincronizarCampanhasWhatsappErp(recurso);
      res.status(200).json({ ok: true, ...resultado });
    } catch (e) { erro(res, e); }
  });

  app.post("/api/v1/campaigns/sync-audiences", exigirChaveApi, async (_req: Request, res: Response) => {
    try {
      const resultado = await sincronizarAudienciasCadencia();
      res.status(200).json({ ok: true, ...resultado });
    } catch (e) { erro(res, e); }
  });

  app.post("/api/v1/campaigns/process-cadence", exigirChaveApi, async (_req: Request, res: Response) => {
    try {
      const resultado = await processarUmaEtapaCadencia();
      let continuaçãoEnfileirada = false;
      if (!resultado.semFila && resultado.proximoDelaySegundos) {
        try { continuaçãoEnfileirada = await enfileirarProximoWorker(resultado.proximoDelaySegundos); }
        catch (e) { console.error("[campanhas-whatsapp-cadencia] falha ao enfileirar continuação:", e); }
      }
      res.status(200).json({ ok: true, ...resultado, continuaçãoEnfileirada });
    } catch (e) { erro(res, e); }
  });

  app.post("/api/v1/campaigns/wts-status", exigirChaveWebhookWtsDedicada, async (req: Request, res: Response) => {
    const parsed = extrairStatusWts(req.body);
    if (!parsed) {
      res.status(400).json({ ok: false, erro: "Payload sem ID de mensagem ou status reconhecível." });
      return;
    }
    try {
      const resultado = await registrarStatusWebhookWts({ ...parsed, payload: req.body as Record<string, unknown> });
      const db = await getDb();
      const saude = await db?.select({ id: campanhasWhatsappInscricoes.id })
        .from(campanhasWhatsappInscricoes)
        .innerJoin(campanhasWhatsapp, eq(campanhasWhatsapp.id, campanhasWhatsappInscricoes.campanhaId))
        .where(and(
          eq(campanhasWhatsapp.motorCadenciaAtivo, true),
          eq(campanhasWhatsapp.status, "ativa"),
          eq(campanhasWhatsappInscricoes.status, "aguardando"),
          isNotNull(campanhasWhatsappInscricoes.proximoEnvioEm),
          gte(campanhasWhatsappInscricoes.proximoEnvioEm, sql`now() - interval '1 minute'`)
        )).limit(1);
      let continuaçãoEnfileirada = false;
      if (saude?.length) {
        try { continuaçãoEnfileirada = await enfileirarProximoWorker(1); } catch (e) { console.error("[campanhas-whatsapp-cadencia] falha ao acordar worker após webhook:", e); }
      }
      res.status(200).json({ ok: true, ...resultado, continuaçãoEnfileirada });
    } catch (e) { erro(res, e); }
  });
}
