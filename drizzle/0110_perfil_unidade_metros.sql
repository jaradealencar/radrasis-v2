UPDATE "perfil_estoque_itens"
SET "unidade" = 'm',
    "alvo_dois_meses" = NULL,
    "observacao" = 'Espessura e histórico em metros pendentes; revise o alvo.',
    "updated_at" = now()
WHERE "chave" IN ('p025', 'p031', 'p032', 'p033', 'p035', 'p037')
  AND "unidade" = 'un';
