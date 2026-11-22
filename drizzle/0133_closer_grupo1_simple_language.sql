WITH revised_question AS (
  SELECT
    q."id",
    q."assessment_id",
    'Um cliente do Grupo 1 está começando e ainda não tem fábrica. Quais ações podem ajudar?'::text AS prompt,
    jsonb_set(
      jsonb_set(
        q."config",
        '{options}',
        (
          SELECT jsonb_agg(
            CASE entry.value->>'id'
              WHEN 'sem_fabrica' THEN entry.value || jsonb_build_object(
                'text', 'Mostrar que ele pode avaliar a venda de letras-caixa sem comprar máquinas, contratar pessoas ou montar uma fábrica.',
                'feedback', 'Ajuda quem está começando sem prometer vendas ou lucro.'
              )
              WHEN 'portfolio' THEN entry.value || jsonb_build_object(
                'text', 'Perguntar quais modelos os clientes dele pedem e confirmar quais a Letreiros Express pode fazer.',
                'feedback', 'Descubra o que os clientes dele querem. Depois, confirme o que podemos fazer.'
              )
              WHEN 'crescimento' THEN entry.value || jsonb_build_object(
                'text', 'Mostrar que ter mais modelos pode ajudar a atender novos clientes, usando dados atuais e confirmados da empresa.',
                'feedback', 'Use só dados da empresa que estejam atuais e confirmados. Não prometa que isso vai trazer clientes.'
              )
              WHEN 'lucro_garantido' THEN entry.value || jsonb_build_object(
                'text', 'Prometer que ele vai lucrar, vender muito ou ser líder na região.',
                'feedback', 'Não prometa lucro, vendas ou liderança. Isso não pode ser garantido.'
              )
              WHEN 'beneficio_generico' THEN entry.value || jsonb_build_object(
                'text', 'Falar de todas as vantagens antes de perguntar o que os clientes dele procuram.',
                'feedback', 'Primeiro pergunte o que os clientes dele precisam. Depois fale só do que ajuda.'
              )
              ELSE entry.value
            END
            ORDER BY entry.ordinality
          )
          FROM jsonb_array_elements(q."config"->'options') WITH ORDINALITY AS entry(value, ordinality)
        ),
        false
      ),
      '{explanation}',
      to_jsonb('O Grupo 1 está começando. Pergunte o que os clientes dele procuram e mostre como vender letras-caixa pode ajudar. Use dados atuais e confirmados. Não prometa vendas nem lucro.'::text),
      false
    ) AS config
  FROM "training_questions" AS q
  JOIN "training_assessments" AS a ON a."id" = q."assessment_id"
  JOIN "training_subjects" AS s ON s."id" = a."subject_id"
  WHERE s."slug" = 'closer'
    AND q."question_key" = 'oportunidade_grupo1'
),
changed_question AS (
  UPDATE "training_questions" AS q
  SET "prompt" = revised_question.prompt,
      "config" = revised_question.config,
      "updated_at" = now()
  FROM revised_question
  WHERE q."id" = revised_question."id"
    AND (
      q."prompt" IS DISTINCT FROM revised_question.prompt
      OR q."config" IS DISTINCT FROM revised_question.config
    )
  RETURNING q."assessment_id"
)
UPDATE "training_assessments" AS a
SET "version" = a."version" + 1,
    "updated_at" = now()
WHERE a."id" IN (SELECT "assessment_id" FROM changed_question);
