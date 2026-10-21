import { randomUUID } from "node:crypto";
import { getPool } from "../db/db-connection";
import { normalizarTelefoneContato } from "../../shared/campanhas-contatos";

export interface TentativaContatoEntrada {
  telefone: string;
  nome?: string | null;
  valoresOriginais?: string[];
}

interface ParametrosTentativasContato {
  campanhaId: number;
  campanhaNome: string;
  dataEnvio: string;
  disparoId: number | null;
  origem: string;
  resultado: string;
  contatos: TentativaContatoEntrada[];
}

/**
 * Cria/resolve identidades por telefone, conserva as grafias recebidas e grava
 * tentativa e participação em um único statement idempotente por disparo.
 */
export async function registrarTentativasDeContatos(p: ParametrosTentativasContato) {
  const entradas = new Map<string, { telefoneE164: string; nome: string | null; originais: Set<string> }>();
  for (const contato of p.contatos) {
    const telefoneE164 = normalizarTelefoneContato(contato.telefone);
    if (!telefoneE164) continue;
    const entrada = entradas.get(telefoneE164) ?? {
      telefoneE164,
      nome: contato.nome?.trim() || null,
      originais: new Set<string>(),
    };
    for (const original of contato.valoresOriginais ?? [contato.telefone]) {
      const limpo = String(original ?? "").trim();
      if (limpo) entrada.originais.add(limpo);
    }
    entradas.set(telefoneE164, entrada);
  }
  if (entradas.size === 0) return { tentativasRegistradas: 0 };

  const valores = [...entradas.values()];
  const ids = valores.map(v => v.telefoneE164);
  const nomes = valores.map(v => v.nome);
  const originaisJson = valores.map(v => JSON.stringify([...v.originais]));
  const idempotencyPrefix = p.disparoId === null ? `evento:${randomUUID()}` : `disparo:${p.disparoId}`;

  const result = await getPool().query(
    `WITH entrada AS (
       SELECT e.telefone_e164, e.nome, e.valores_originais
       FROM unnest($1::text[], $2::text[], $3::jsonb[]) AS e(telefone_e164, nome, valores_originais)
     ), contatos_ja_vinculados AS (
       SELECT i.telefone_e164, t.contato_id
       FROM entrada i
       JOIN campanhas_whatsapp_contato_telefones t ON t.telefone_e164 = i.telefone_e164
     ), contatos_criados AS (
       INSERT INTO campanhas_whatsapp_contatos
         (telefone_inicial_e164, nome, origem, campanha_origem_id, campanha_origem_nome)
       SELECT i.telefone_e164, i.nome, $4, $5::int, $6
       FROM entrada i
       LEFT JOIN contatos_ja_vinculados e ON e.telefone_e164 = i.telefone_e164
       WHERE e.telefone_e164 IS NULL
       ON CONFLICT (telefone_inicial_e164) DO UPDATE
         SET nome = COALESCE(campanhas_whatsapp_contatos.nome, EXCLUDED.nome), updated_at = now()
       RETURNING id, telefone_inicial_e164
     ), contatos_resolvidos AS (
       SELECT i.telefone_e164, i.nome, i.valores_originais, e.contato_id
       FROM entrada i
       JOIN contatos_ja_vinculados e ON e.telefone_e164 = i.telefone_e164
       UNION ALL
       SELECT i.telefone_e164, i.nome, i.valores_originais, c.id
       FROM entrada i
       JOIN contatos_criados c ON c.telefone_inicial_e164 = i.telefone_e164
       WHERE NOT EXISTS (
         SELECT 1 FROM contatos_ja_vinculados e WHERE e.telefone_e164 = i.telefone_e164
       )
     ), telefones AS (
       INSERT INTO campanhas_whatsapp_contato_telefones AS atual
         (contato_id, telefone_e164, valores_originais, origem)
       SELECT r.contato_id, r.telefone_e164, r.valores_originais, $4
       FROM contatos_resolvidos r
       ON CONFLICT (telefone_e164) DO UPDATE SET
         valores_originais = (
           SELECT COALESCE(jsonb_agg(DISTINCT valor), '[]'::jsonb)
           FROM jsonb_array_elements_text(atual.valores_originais || EXCLUDED.valores_originais) AS valores(valor)
         )
       RETURNING id, contato_id, telefone_e164, valores_originais
     ), tentativas AS (
       INSERT INTO campanhas_whatsapp_contato_tentativas
         (contato_id, telefone_id, telefone_e164, telefone_original, campanha_id, campanha_nome,
          disparo_id, resultado, origem, idempotency_key, data_envio)
       SELECT t.contato_id, t.id, t.telefone_e164,
              COALESCE(i.valores_originais->>0, t.telefone_e164), $5::int, $6,
              $7::int, $8, $4, $9 || ':' || t.telefone_e164, $10::date
       FROM telefones t
       JOIN entrada i ON i.telefone_e164 = t.telefone_e164
       ON CONFLICT (disparo_id, telefone_e164) WHERE disparo_id IS NOT NULL DO NOTHING
       RETURNING contato_id, campanha_id, campanha_nome, ocorrido_em
     ), participacoes AS (
       INSERT INTO campanhas_whatsapp_contato_campanhas AS atual
         (contato_id, campanha_id, campanha_nome, primeira_tentativa_em, ultima_tentativa_em, tentativas)
       SELECT t.contato_id, t.campanha_id, t.campanha_nome, min(t.ocorrido_em), max(t.ocorrido_em), count(*)::int
       FROM tentativas t
       GROUP BY t.contato_id, t.campanha_id, t.campanha_nome
       ON CONFLICT (contato_id, campanha_id) DO UPDATE SET
         campanha_nome = EXCLUDED.campanha_nome,
         primeira_tentativa_em = LEAST(atual.primeira_tentativa_em, EXCLUDED.primeira_tentativa_em),
         ultima_tentativa_em = GREATEST(atual.ultima_tentativa_em, EXCLUDED.ultima_tentativa_em),
         tentativas = atual.tentativas + EXCLUDED.tentativas,
         updated_at = now()
       RETURNING contato_id
     )
     SELECT count(*)::int AS gravadas FROM tentativas`,
    [
      ids, nomes, originaisJson,
      p.origem, p.campanhaId, p.campanhaNome, p.disparoId, p.resultado,
      idempotencyPrefix, p.dataEnvio,
    ],
  );
  return { tentativasRegistradas: Number(result.rows[0]?.gravadas ?? 0) };
}
