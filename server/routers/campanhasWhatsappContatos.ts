import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, requireRole, router } from "../_core/trpc";
import { getPool } from "../db/db-connection";
import { normalizarTelefoneContato, variantesTelefoneContato } from "../../shared/campanhas-contatos";

const campanhasProcedure = protectedProcedure.use(requireRole("admin", "master", "gestor"));
const limite = z.number().int().min(1).max(100).default(30);
const entidadeSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("mubisys_cliente"),
    chave: z.string().trim().regex(/^\d{1,10}$/).refine(valor => Number(valor) <= 2_147_483_647, "ID do cliente fora do limite do MubiSys."),
  }),
  z.object({ tipo: z.literal("orcamento"), chave: z.string().trim().min(1).max(32) }),
  z.object({ tipo: z.literal("ordem_servico"), chave: z.string().trim().min(1).max(32) }),
]);

type Entidade = z.infer<typeof entidadeSchema>;

async function rotuloEntidade(entidade: Entidade): Promise<string> {
  if (entidade.tipo === "mubisys_cliente") {
    const r = await getPool().query(
      `SELECT id::text AS chave, COALESCE(NULLIF(nome_fantasia, ''), NULLIF(razao_social, ''), id::text) AS rotulo
       FROM mubisys_clientes_cache WHERE id = $1::int LIMIT 1`,
      [Number(entidade.chave)],
    );
    if (!r.rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente MubiSys não encontrado no cache sincronizado." });
    return `${r.rows[0].rotulo} · cliente ${r.rows[0].chave}`;
  }
  if (entidade.tipo === "orcamento") {
    const r = await getPool().query(
      `SELECT "orcNumero" AS chave, COALESCE(NULLIF(empresa, ''), "orcNumero") AS rotulo
       FROM historico_orcamentos WHERE "orcNumero" = $1 LIMIT 1`,
      [entidade.chave],
    );
    if (!r.rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Orçamento não encontrado no histórico sincronizado." });
    return `${r.rows[0].rotulo} · orçamento ${r.rows[0].chave}`;
  }
  const r = await getPool().query(
    `SELECT "osNumero" AS chave, COALESCE(NULLIF(empresa, ''), "osNumero") AS rotulo
     FROM historico_os WHERE "osNumero" = $1 LIMIT 1`,
    [entidade.chave],
  );
  if (!r.rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "O.S. não encontrada no histórico sincronizado." });
  return `${r.rows[0].rotulo} · O.S. ${r.rows[0].chave}`;
}

async function sugerirVinculos(telefones: string[]) {
  const variantes = variantesTelefoneContato(telefones);
  if (variantes.length === 0) return { clientes: [], orcamentos: [], ordensServico: [] };
  const [clientes, orcamentos, ordensServico] = await Promise.all([
    getPool().query(
      `SELECT id::text AS chave, COALESCE(NULLIF(nome_fantasia, ''), NULLIF(razao_social, ''), id::text) AS rotulo,
              telefone, 'mubisys_cliente'::text AS tipo
       FROM mubisys_clientes_cache
       WHERE regexp_replace(COALESCE(telefone, ''), '[^0-9]', '', 'g') = ANY($1::text[])
       ORDER BY atualizado_em DESC LIMIT 20`, [variantes],
    ),
    getPool().query(
      `SELECT "orcNumero" AS chave, COALESCE(NULLIF(empresa, ''), "orcNumero") AS rotulo,
              telefone, 'orcamento'::text AS tipo
       FROM historico_orcamentos
       WHERE "orcNumero" IS NOT NULL
         AND regexp_replace(COALESCE(telefone, ''), '[^0-9]', '', 'g') = ANY($1::text[])
       ORDER BY ano DESC, mes DESC LIMIT 20`, [variantes],
    ),
    getPool().query(
      `SELECT "osNumero" AS chave, COALESCE(NULLIF(empresa, ''), "osNumero") AS rotulo,
              telefone, 'ordem_servico'::text AS tipo
       FROM historico_os
       WHERE "osNumero" IS NOT NULL
         AND regexp_replace(COALESCE(telefone, ''), '[^0-9]', '', 'g') = ANY($1::text[])
       ORDER BY ano DESC, mes DESC LIMIT 20`, [variantes],
    ),
  ]);
  return { clientes: clientes.rows, orcamentos: orcamentos.rows, ordensServico: ordensServico.rows };
}

export const campanhasWhatsappContatosRouter = router({
  listar: campanhasProcedure
    .input(z.object({ busca: z.string().trim().max(160).default(""), limite: limite, offset: z.number().int().min(0).default(0) }).optional())
    .query(async ({ input }) => {
      const busca = input?.busca?.trim() ?? "";
      const buscaFone = busca.replace(/\D/g, "");
      const pageSize = input?.limite ?? 30;
      const offset = input?.offset ?? 0;
      const [contatos, total] = await Promise.all([
        getPool().query(
          `SELECT c.id, c.nome, c.telefone_inicial_e164 AS "telefoneInicialE164", c.origem,
                  c.campanha_origem_id AS "campanhaOrigemId", c.campanha_origem_nome AS "campanhaOrigemNome",
                  c.created_at AS "createdAt",
                  COALESCE((SELECT count(*)::int FROM campanhas_whatsapp_contato_campanhas cc WHERE cc.contato_id = c.id), 0) AS "totalCampanhas",
                  COALESCE((SELECT sum(cc.tentativas)::int FROM campanhas_whatsapp_contato_campanhas cc WHERE cc.contato_id = c.id), 0) AS "totalTentativas",
                  COALESCE((SELECT bool_and(cc.historico_completo) FROM campanhas_whatsapp_contato_campanhas cc WHERE cc.contato_id = c.id), true) AS "historicoCompleto",
                  COALESCE((SELECT array_agg(p.telefone_e164 ORDER BY p.created_at) FROM campanhas_whatsapp_contato_telefones p WHERE p.contato_id = c.id), ARRAY[]::text[]) AS telefones
           FROM campanhas_whatsapp_contatos c
           WHERE ($1 = '' OR COALESCE(c.nome, '') ILIKE '%' || $1 || '%'
             OR ($2 <> '' AND EXISTS (SELECT 1 FROM campanhas_whatsapp_contato_telefones p WHERE p.contato_id = c.id AND p.telefone_e164 ILIKE '%' || $2 || '%')))
           ORDER BY COALESCE((SELECT max(cc.ultima_tentativa_em) FROM campanhas_whatsapp_contato_campanhas cc WHERE cc.contato_id = c.id), c.created_at) DESC, c.id DESC LIMIT $3 OFFSET $4`,
          [busca, buscaFone, pageSize, offset],
        ),
        getPool().query(
          `SELECT count(*)::int AS total FROM campanhas_whatsapp_contatos c
           WHERE ($1 = '' OR COALESCE(c.nome, '') ILIKE '%' || $1 || '%'
             OR ($2 <> '' AND EXISTS (SELECT 1 FROM campanhas_whatsapp_contato_telefones p WHERE p.contato_id = c.id AND p.telefone_e164 ILIKE '%' || $2 || '%')))` ,
          [busca, buscaFone],
        ),
      ]);
      return { contatos: contatos.rows, total: total.rows[0]?.total ?? 0, limite: pageSize, offset };
    }),

  detalhar: campanhasProcedure
    .input(z.object({ contatoId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const pool = getPool();
      const [contato, telefones, campanhas, tentativas, vinculos, auditoria] = await Promise.all([
        pool.query(
          `SELECT id, nome, telefone_inicial_e164 AS "telefoneInicialE164", origem,
                  campanha_origem_id AS "campanhaOrigemId", campanha_origem_nome AS "campanhaOrigemNome",
                  criado_por_nome AS "criadoPorNome", created_at AS "createdAt", updated_at AS "updatedAt"
           FROM campanhas_whatsapp_contatos WHERE id = $1 LIMIT 1`, [input.contatoId],
        ),
        pool.query(
          `SELECT id, telefone_e164 AS "telefoneE164", valores_originais AS "valoresOriginais", origem,
                  created_at AS "createdAt"
           FROM campanhas_whatsapp_contato_telefones WHERE contato_id = $1 ORDER BY created_at, id`, [input.contatoId],
        ),
        pool.query(
          `SELECT campanha_id AS "campanhaId", campanha_nome AS "campanhaNome", tentativas,
                  historico_completo AS "historicoCompleto",
                  primeira_tentativa_em AS "primeiraTentativaEm", ultima_tentativa_em AS "ultimaTentativaEm"
           FROM campanhas_whatsapp_contato_campanhas WHERE contato_id = $1
           ORDER BY ultima_tentativa_em DESC`, [input.contatoId],
        ),
        pool.query(
          `SELECT t.id, t.telefone_e164 AS "telefoneE164", t.telefone_original AS "telefoneOriginal",
                  t.campanha_id AS "campanhaId", t.campanha_nome AS "campanhaNome", t.disparo_id AS "disparoId",
                  t.resultado, t.origem, t.ocorrido_em AS "ocorridoEm", t.data_envio AS "dataEnvio",
                  i.status AS "statusProvedor", i.wts_mensagem_id AS "mensagemProvedorId"
           FROM campanhas_whatsapp_contato_tentativas t
           LEFT JOIN campanhas_whatsapp_disparo_itens i
             ON i.disparo_id = t.disparo_id AND i.telefone = regexp_replace(t.telefone_e164, '[^0-9]', '', 'g')
           WHERE t.contato_id = $1 ORDER BY t.ocorrido_em DESC, t.id DESC LIMIT 100`, [input.contatoId],
        ),
        pool.query(
          `SELECT id, tipo_entidade AS tipo, chave_entidade AS chave, rotulo_entidade AS rotulo,
                  metodo, confianca, justificativa, vinculado_por_nome AS "vinculadoPorNome", created_at AS "createdAt"
           FROM campanhas_whatsapp_contato_vinculos WHERE contato_id = $1 AND ativo = true ORDER BY created_at DESC`, [input.contatoId],
        ),
        pool.query(
          `SELECT id, vinculo_id AS "vinculoId", tipo_entidade AS tipo, chave_entidade AS chave,
                  acao, justificativa, usuario_nome AS "usuarioNome", created_at AS "createdAt"
           FROM campanhas_whatsapp_contato_vinculo_auditoria WHERE contato_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100`, [input.contatoId],
        ),
      ]);
      const registro = contato.rows[0];
      if (!registro) throw new TRPCError({ code: "NOT_FOUND", message: "Contato não encontrado." });
      const sugestoes = await sugerirVinculos((telefones.rows as Array<{ telefoneE164: string }>).map(row => row.telefoneE164));
      return {
        contato: registro,
        telefones: telefones.rows,
        campanhas: campanhas.rows,
        tentativas: tentativas.rows,
        vinculos: vinculos.rows,
        auditoria: auditoria.rows,
        sugestoes,
      };
    }),

  criar: campanhasProcedure
    .input(z.object({ telefone: z.string().trim().min(1).max(40), nome: z.string().trim().max(200).nullish(), campanhaOrigemId: z.number().int().positive().nullish() }))
    .mutation(async ({ input, ctx }) => {
      const telefoneE164 = normalizarTelefoneContato(input.telefone);
      if (!telefoneE164) throw new TRPCError({ code: "BAD_REQUEST", message: "Telefone inválido. Use padrão brasileiro ou DDI internacional com +/00." });
      let campanhaOrigem: { id: number; nome: string } | null = null;
      if (input.campanhaOrigemId) {
        const campanha = await getPool().query("SELECT id, nome FROM campanhas_whatsapp WHERE id = $1", [input.campanhaOrigemId]);
        if (!campanha.rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha de origem não encontrada." });
        campanhaOrigem = campanha.rows[0];
      }
      const pool = getPool();
      const existentes = await pool.query(
        "SELECT contato_id AS id FROM campanhas_whatsapp_contato_telefones WHERE telefone_e164 = $1 LIMIT 1", [telefoneE164],
      );
      if (existentes.rows[0]) throw new TRPCError({ code: "CONFLICT", message: `Este telefone já está no contato #${existentes.rows[0].id}; revise o registro antes de criar outro.` });
      try {
        const r = await pool.query(
          `WITH novo AS (
             INSERT INTO campanhas_whatsapp_contatos
               (telefone_inicial_e164, nome, origem, campanha_origem_id, campanha_origem_nome, criado_por_id, criado_por_nome)
             VALUES ($1, NULLIF($2, ''), 'manual', $3::int, $4, $5, $6)
             RETURNING id
           ), telefone AS (
             INSERT INTO campanhas_whatsapp_contato_telefones
               (contato_id, telefone_e164, valores_originais, origem, criado_por_id)
             SELECT id, $1, jsonb_build_array($7::text), 'manual', $5 FROM novo
             RETURNING contato_id
           )
           SELECT contato_id AS id FROM telefone`,
          [telefoneE164, input.nome?.trim() ?? "", campanhaOrigem?.id ?? null, campanhaOrigem?.nome ?? null,
            ctx.user.id, ctx.user.name ?? ctx.user.email ?? "usuário", input.telefone],
        );
        if (!r.rows[0]) throw new Error("Não foi possível criar o contato.");
        return { id: r.rows[0].id as number };
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "23505") {
          const duplicado = await pool.query("SELECT contato_id AS id FROM campanhas_whatsapp_contato_telefones WHERE telefone_e164 = $1", [telefoneE164]);
          throw new TRPCError({ code: "CONFLICT", message: `Este telefone já pertence ao contato #${duplicado.rows[0]?.id ?? "existente"}; nenhum contato foi fundido.` });
        }
        throw error;
      }
    }),

  renomear: campanhasProcedure
    .input(z.object({ contatoId: z.number().int().positive(), nome: z.string().trim().max(200) }))
    .mutation(async ({ input }) => {
      const r = await getPool().query(
        `UPDATE campanhas_whatsapp_contatos SET nome = NULLIF($2, ''), updated_at = now()
         WHERE id = $1 RETURNING id`, [input.contatoId, input.nome],
      );
      if (!r.rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Contato não encontrado." });
      return { atualizado: true };
    }),

  adicionarTelefone: campanhasProcedure
    .input(z.object({ contatoId: z.number().int().positive(), telefone: z.string().trim().min(1).max(40) }))
    .mutation(async ({ input, ctx }) => {
      const telefoneE164 = normalizarTelefoneContato(input.telefone);
      if (!telefoneE164) throw new TRPCError({ code: "BAD_REQUEST", message: "Telefone inválido. Use padrão brasileiro ou DDI internacional com +/00." });
      const pool = getPool();
      const existeContato = await pool.query("SELECT id FROM campanhas_whatsapp_contatos WHERE id = $1", [input.contatoId]);
      if (!existeContato.rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Contato não encontrado." });
      const existente = await pool.query("SELECT contato_id AS id FROM campanhas_whatsapp_contato_telefones WHERE telefone_e164 = $1", [telefoneE164]);
      if (existente.rows[0] && Number(existente.rows[0].id) !== input.contatoId) {
        throw new TRPCError({ code: "CONFLICT", message: `Esse telefone pertence ao contato #${existente.rows[0].id}. Nenhuma identidade foi fundida.` });
      }
      const r = await pool.query(
        `INSERT INTO campanhas_whatsapp_contato_telefones AS atual
           (contato_id, telefone_e164, valores_originais, origem, criado_por_id)
         VALUES ($1, $2, jsonb_build_array($3::text), 'manual', $4)
         ON CONFLICT (telefone_e164) DO UPDATE SET
           valores_originais = (SELECT COALESCE(jsonb_agg(DISTINCT valor), '[]'::jsonb)
             FROM jsonb_array_elements_text(atual.valores_originais || EXCLUDED.valores_originais) AS valores(valor))
         WHERE atual.contato_id = EXCLUDED.contato_id
         RETURNING id`, [input.contatoId, telefoneE164, input.telefone, ctx.user.id],
      );
      if (!r.rows[0]) throw new TRPCError({ code: "CONFLICT", message: "O telefone foi associado a outro contato durante esta operação." });
      await pool.query("UPDATE campanhas_whatsapp_contatos SET updated_at = now() WHERE id = $1", [input.contatoId]);
      return { adicionado: true };
    }),

  vincularEntidade: campanhasProcedure
    .input(z.object({ contatoId: z.number().int().positive(), entidade: entidadeSchema, justificativa: z.string().trim().min(8).max(500) }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      const contato = await pool.query("SELECT id FROM campanhas_whatsapp_contatos WHERE id = $1", [input.contatoId]);
      if (!contato.rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Contato não encontrado." });
      const rotulo = await rotuloEntidade(input.entidade);
      const r = await pool.query(
        `WITH novo AS (
           INSERT INTO campanhas_whatsapp_contato_vinculos
             (contato_id, tipo_entidade, chave_entidade, rotulo_entidade, metodo, confianca, justificativa, vinculado_por_id, vinculado_por_nome)
           VALUES ($1, $2, $3, $4, 'manual', NULL, $5, $6, $7)
           ON CONFLICT (contato_id, tipo_entidade, chave_entidade) WHERE ativo = true DO NOTHING
           RETURNING id, contato_id, tipo_entidade, chave_entidade
         ), auditoria AS (
           INSERT INTO campanhas_whatsapp_contato_vinculo_auditoria
             (contato_id, vinculo_id, tipo_entidade, chave_entidade, acao, justificativa, usuario_id, usuario_nome)
           SELECT contato_id, id, tipo_entidade, chave_entidade, 'vinculado', $5, $6, $7 FROM novo
           RETURNING id
         )
         SELECT id, contato_id AS "contatoId" FROM novo`,
        [input.contatoId, input.entidade.tipo, input.entidade.chave, rotulo, input.justificativa,
          ctx.user.id, ctx.user.name ?? ctx.user.email ?? "usuário"],
      );
      if (r.rows[0]) return { vinculado: true, id: r.rows[0].id as number };
      const conflito = await pool.query(
        `SELECT id, contato_id AS "contatoId" FROM campanhas_whatsapp_contato_vinculos
         WHERE contato_id = $1 AND tipo_entidade = $2 AND chave_entidade = $3 AND ativo = true LIMIT 1`,
        [input.contatoId, input.entidade.tipo, input.entidade.chave],
      );
      if (conflito.rows[0]) return { vinculado: false, existente: true, id: conflito.rows[0].id as number };
      throw new TRPCError({ code: "CONFLICT", message: "Não foi possível salvar o vínculo. Atualize o contato e tente novamente." });
    }),

  desvincularEntidade: campanhasProcedure
    .input(z.object({ vinculoId: z.number().int().positive(), justificativa: z.string().trim().min(8).max(500) }))
    .mutation(async ({ input, ctx }) => {
      const r = await getPool().query(
        `WITH desfeito AS (
           UPDATE campanhas_whatsapp_contato_vinculos SET ativo = false, updated_at = now()
           WHERE id = $1 AND ativo = true
           RETURNING id, contato_id, tipo_entidade, chave_entidade
         ), auditoria AS (
           INSERT INTO campanhas_whatsapp_contato_vinculo_auditoria
             (contato_id, vinculo_id, tipo_entidade, chave_entidade, acao, justificativa, usuario_id, usuario_nome)
           SELECT contato_id, id, tipo_entidade, chave_entidade, 'desvinculado', $2, $3, $4 FROM desfeito
           RETURNING id
         ) SELECT id FROM desfeito`,
        [input.vinculoId, input.justificativa, ctx.user.id, ctx.user.name ?? ctx.user.email ?? "usuário"],
      );
      if (!r.rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Vínculo ativo não encontrado." });
      return { desvinculado: true };
    }),
});
