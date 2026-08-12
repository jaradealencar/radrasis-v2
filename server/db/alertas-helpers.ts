import { alertasSistema } from "../../drizzle/schema";
import { getDb } from "./db";

export async function criarAlerta(params: {
  tipo: "reincidencia" | "meta_excedida" | "sem_acao" | "prazo_vencido" | "novo_retrabalho" | "atraso_expedicao" | "manual";
  severidade: "info" | "aviso" | "critico";
  titulo: string;
  descricao?: string;
  referenciaId?: number;
  referenciaTipo?: string;
  referenciaExtra?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(alertasSistema).values({
    tipo: params.tipo,
    severidade: params.severidade,
    titulo: params.titulo,
    descricao: params.descricao ?? null,
    referenciaId: params.referenciaId ?? null,
    referenciaTipo: params.referenciaTipo ?? null,
    referenciaExtra: params.referenciaExtra ?? null,
    status: "ativo",
  });
}
