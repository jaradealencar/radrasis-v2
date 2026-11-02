import { TRPCError } from "@trpc/server";
import { and, count, eq, gte, lt, lte } from "drizzle-orm";
import { z } from "zod";
import {
  campanhasWhatsapp,
  campanhasWhatsappAgendamentos,
  campanhasWhatsappCampanhaFontes,
  campanhasWhatsappContatosHistorico,
  campanhasWhatsappDisparos,
  campanhasWhatsappFontes,
  campanhasWhatsappLeadsQualificados,
  campanhasWhatsappMensagensInbound,
  campanhasWhatsappOptout,
  campanhasWhatsappQuarentena,
} from "../../drizzle/schema";
import {
  dataIsoValida,
  somarDias,
  hojeCampoGrande,
} from "../../shared/campanhas-whatsapp";
import { protectedProcedure, requireRole, router } from "../_core/trpc";
import { getDb } from "../db/db";
import { carregarContextoErp } from "../services/fontesErpCampanhas";
import { montarRelatorioJornada } from "../services/campanhasWhatsappRelatorio";
import {
  parseDataFlexivel,
  STATUS_GANHO,
  STATUS_PERDIDO,
} from "../services/inteligenciaClientes";
import { dataLocalParaIso } from "../services/campanhasWhatsapp";
import { isOsNormalDb } from "./performanceComercial";

const campanhasProcedure = protectedProcedure.use(
  requireRole("admin", "master", "gestor")
);

async function obterDb() {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  return db;
}

const isoSchema = z.string().refine(dataIsoValida, "Data inválida");
const formatadorDataCampoGrande = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Campo_Grande",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dataIsoCampoGrande(valor: Date): string {
  const partes = Object.fromEntries(
    formatadorDataCampoGrande.formatToParts(valor).map(p => [p.type, p.value])
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
}

export const campanhasWhatsappRelatoriosRouter = router({
  /** Funil comercial por coorte e auditoria operacional. ERP é correlacionado pelo telefone normalizado. */
  relatorioJornada: campanhasProcedure
    .input(
      z.object({
        inicio: isoSchema,
        fim: isoSchema,
        janelaDias: z.number().int().min(1).max(180).default(30),
      })
    )
    .query(async ({ input }) => {
      if (
        input.fim < input.inicio ||
        Math.floor(
          (Date.parse(`${input.fim}T00:00:00Z`) -
            Date.parse(`${input.inicio}T00:00:00Z`)) /
            86_400_000
        ) > 366
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Período inválido (máximo 366 dias).",
        });
      }

      const db = await obterDb();
      const agora = new Date();
      const hoje = hojeCampoGrande();
      const fimPossivel = somarDias(input.fim, input.janelaDias);
      const fimCohorte = fimPossivel < hoje ? fimPossivel : hoje;
      const inicioUtc = new Date(`${input.inicio}T00:00:00-04:00`);
      const fimUtcExclusivo = new Date(
        `${somarDias(fimCohorte, 1)}T00:00:00-04:00`
      );

      const [
        campanhas,
        disparos,
        contatos,
        respostas,
        leads,
        fontesVinculadas,
        totalOptouts,
        totalQuarentena,
        agendamentosAtrasados,
        contextoErp,
      ] = await Promise.all([
        db.select().from(campanhasWhatsapp),
        db
          .select({
            campanhaId: campanhasWhatsappDisparos.campanhaId,
            contatosEnviados: campanhasWhatsappDisparos.contatosEnviados,
            origem: campanhasWhatsappDisparos.origem,
          })
          .from(campanhasWhatsappDisparos)
          .where(
            and(
              gte(campanhasWhatsappDisparos.enviadoEm, input.inicio),
              lte(campanhasWhatsappDisparos.enviadoEm, input.fim)
            )
          ),
        db
          .select({
            campanhaId: campanhasWhatsappContatosHistorico.campanhaId,
            telefone: campanhasWhatsappContatosHistorico.telefone,
            enviadoEm: campanhasWhatsappContatosHistorico.ultimoEnvioEm,
          })
          .from(campanhasWhatsappContatosHistorico)
          .where(
            and(
              gte(
                campanhasWhatsappContatosHistorico.ultimoEnvioEm,
                input.inicio
              ),
              lte(campanhasWhatsappContatosHistorico.ultimoEnvioEm, input.fim)
            )
          ),
        db
          .select({
            campanhaId: campanhasWhatsappMensagensInbound.campanhaId,
            telefone: campanhasWhatsappMensagensInbound.telefone,
            recebidoEm: campanhasWhatsappMensagensInbound.recebidoEm,
            tipoMensagem: campanhasWhatsappMensagensInbound.tipoMensagem,
            ehBot: campanhasWhatsappMensagensInbound.ehBot,
            bufferAte: campanhasWhatsappMensagensInbound.bufferAte,
            processado: campanhasWhatsappMensagensInbound.processado,
          })
          .from(campanhasWhatsappMensagensInbound)
          .where(
            and(
              gte(campanhasWhatsappMensagensInbound.recebidoEm, inicioUtc),
              lt(campanhasWhatsappMensagensInbound.recebidoEm, fimUtcExclusivo)
            )
          ),
        db
          .select({
            campanhaId: campanhasWhatsappLeadsQualificados.campanhaId,
            telefone: campanhasWhatsappLeadsQualificados.telefone,
            analisadoEm: campanhasWhatsappLeadsQualificados.analisadoEm,
            icpFitScore: campanhasWhatsappLeadsQualificados.icpFitScore,
            nivelInteresse: campanhasWhatsappLeadsQualificados.nivelInteresse,
          })
          .from(campanhasWhatsappLeadsQualificados)
          .where(
            and(
              gte(campanhasWhatsappLeadsQualificados.analisadoEm, inicioUtc),
              lt(
                campanhasWhatsappLeadsQualificados.analisadoEm,
                fimUtcExclusivo
              )
            )
          ),
        db
          .select({ campanhaId: campanhasWhatsappCampanhaFontes.campanhaId })
          .from(campanhasWhatsappCampanhaFontes)
          .innerJoin(
            campanhasWhatsappFontes,
            eq(
              campanhasWhatsappFontes.id,
              campanhasWhatsappCampanhaFontes.fonteId
            )
          )
          .where(eq(campanhasWhatsappFontes.ativo, true)),
        db.select({ total: count() }).from(campanhasWhatsappOptout),
        db.select({ total: count() }).from(campanhasWhatsappQuarentena),
        db
          .select({ total: count() })
          .from(campanhasWhatsappAgendamentos)
          .where(
            and(
              lt(campanhasWhatsappAgendamentos.dataAgendada, hoje),
              eq(campanhasWhatsappAgendamentos.status, "planejado")
            )
          ),
        carregarContextoErp(),
      ]);

      const disparosPorCampanha = new Map<
        number,
        { disparos: number; contatosEnviados: number; contatosApi: number }
      >();
      for (const disparo of disparos) {
        const atual = disparosPorCampanha.get(disparo.campanhaId) ?? {
          disparos: 0,
          contatosEnviados: 0,
          contatosApi: 0,
        };
        atual.disparos++;
        atual.contatosEnviados += disparo.contatosEnviados;
        if (disparo.origem === "api")
          atual.contatosApi += disparo.contatosEnviados;
        disparosPorCampanha.set(disparo.campanhaId, atual);
      }

      const fontesPorCampanha = new Map<number, number>();
      for (const fonte of fontesVinculadas) {
        fontesPorCampanha.set(
          fonte.campanhaId,
          (fontesPorCampanha.get(fonte.campanhaId) ?? 0) + 1
        );
      }

      const relatorioCampanhas = campanhas.map(campanha => {
        const envio = disparosPorCampanha.get(campanha.id);
        return {
          id: campanha.id,
          nome: campanha.nome,
          categoria: campanha.categoria,
          status: campanha.status,
          tipo: campanha.tipo,
          templateConfigurado: !!campanha.wtsTemplateId?.trim(),
          fontesAtivas: fontesPorCampanha.get(campanha.id) ?? 0,
          disparosNoPeriodo: envio?.disparos ?? 0,
          contatosEnviadosNoPeriodo: envio?.contatosEnviados ?? 0,
          contatosApiNoPeriodo: envio?.contatosApi ?? 0,
        };
      });

      const relatorio = montarRelatorioJornada({
        inicio: input.inicio,
        fim: input.fim,
        hoje,
        agora: agora.toISOString(),
        janelaDias: input.janelaDias,
        campanhas: relatorioCampanhas,
        contatos: contatos.map(c => ({
          ...c,
          enviadoEm: String(c.enviadoEm).slice(0, 10),
        })),
        respostas: respostas.map(r => ({
          ...r,
          recebidoEm: dataIsoCampoGrande(r.recebidoEm),
          bufferAte: r.bufferAte.toISOString(),
        })),
        leads: leads.map(l => ({
          ...l,
          analisadoEm: dataIsoCampoGrande(l.analisadoEm),
        })),
        orcamentos: contextoErp.orcamentos.map(orcamento => {
          const data = parseDataFlexivel(orcamento.dataCadastro);
          const status = (orcamento.status ?? "").trim().toLowerCase();
          return {
            id: orcamento.orcNumero ?? String(orcamento.id),
            telefone: orcamento.telefone,
            data: data ? dataLocalParaIso(data) : null,
            status: STATUS_GANHO.has(status)
              ? ("ganho" as const)
              : STATUS_PERDIDO.has(status)
                ? ("perdido" as const)
                : ["em aberto", "aberto", "pendente", "em andamento"].includes(
                      status
                    )
                  ? ("aberto" as const)
                  : ("outro" as const),
            valor: Number(orcamento.total ?? 0),
          };
        }),
        ordens: contextoErp.osRows.filter(isOsNormalDb).map(os => {
          const dataAprovacao = parseDataFlexivel(os.dataAprovacao);
          const dataFaturamento = parseDataFlexivel(os.dataFaturamento);
          const data = dataAprovacao ?? dataFaturamento;
          return {
            id: os.osNumero ?? String(os.id),
            telefone: os.telefone,
            data: data ? dataLocalParaIso(data) : null,
            valor: Number(os.valorOs || os.valorTotal || 0),
          };
        }),
        optouts: totalOptouts[0]?.total ?? 0,
        telefonesNaQuarentena: totalQuarentena[0]?.total ?? 0,
        agendamentosAtrasados: agendamentosAtrasados[0]?.total ?? 0,
      });

      return {
        ...relatorio,
        auditoria: {
          ...relatorio.auditoria,
          orcamentosSemTelefone: contextoErp.orcamentos.filter(o => !o.telefone)
            .length,
          ordensSemTelefone: contextoErp.osRows.filter(
            os => isOsNormalDb(os) && !os.telefone
          ).length,
        },
      };
    }),
});
