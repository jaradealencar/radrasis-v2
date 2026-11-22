import { and, eq, inArray } from "drizzle-orm";
import { campanhasWhatsappFilaInscricoes, campanhasWhatsappFilaItens } from "../../drizzle/schema";
import { normalizarTelefone } from "../../shared/campanhas-whatsapp";
import { getDb } from "../db/db";

/** Cancela itens ainda nÃ£o enviados e encerra inscriÃ§Ãµes da cadÃªncia fixa quando hÃ¡ opt-out global. */
export async function cancelarFilaProgramadaPorOptout(telefones: string[], quando = new Date()): Promise<number> {
  const normalizados = [...new Set(telefones.map(normalizarTelefone).filter((telefone): telefone is string => !!telefone))];
  if (!normalizados.length) return 0;
  const db = await getDb();
  if (!db) return 0;

  return db.transaction(async tx => {
    await tx.update(campanhasWhatsappFilaInscricoes).set({ status: "opt_out", updatedAt: quando })
      .where(and(inArray(campanhasWhatsappFilaInscricoes.telefone, normalizados), eq(campanhasWhatsappFilaInscricoes.status, "ativa")));
    const cancelados = await tx.update(campanhasWhatsappFilaItens).set({
      status: "cancelado",
      erro: "Cancelado porque o contato pediu para não receber mais mensagens.",
      updatedAt: quando,
    }).where(and(
      inArray(campanhasWhatsappFilaItens.telefone, normalizados),
      eq(campanhasWhatsappFilaItens.status, "pendente"),
    )).returning({ id: campanhasWhatsappFilaItens.id });
    return cancelados.length;
  });
}
