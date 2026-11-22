WITH rewritten_questions AS (
  SELECT
    q."id",
    q."assessment_id",
    jsonb_set(
      jsonb_set(
        q."config",
        '{rightItems}',
        (
          SELECT jsonb_agg(
            CASE
              WHEN item.value->>'id' = 'v' THEN item.value || jsonb_build_object(
                'text',
                'Escuta atenta, informações corretas, retorno combinado, atendimento com entusiasmo, fala confiante e transparência sobre limites.'
              )
              ELSE item.value
            END
            ORDER BY item.ordinality
          )
          FROM jsonb_array_elements(q."config"->'rightItems') WITH ORDINALITY AS item(value, ordinality)
        ),
        false
      ),
      '{explanation}',
      to_jsonb('Na confiança no vendedor, mostre entusiasmo e fale com confiança. Sustente a conversa com informações corretas, retorno combinado e transparência sobre limites.'::text),
      false
    ) AS new_config
  FROM "training_questions" AS q
  JOIN "training_assessments" AS a ON a."id" = q."assessment_id"
  JOIN "training_subjects" AS s ON s."id" = a."subject_id"
  WHERE s."slug" = 'closer'
    AND q."question_key" = 'tres_confiancas'
    AND q."type" = 'matching'
),
changed_questions AS (
  UPDATE "training_questions" AS q
  SET "config" = rewritten.new_config,
      "updated_at" = now()
  FROM rewritten_questions AS rewritten
  WHERE q."id" = rewritten."id"
    AND q."config" IS DISTINCT FROM rewritten.new_config
  RETURNING q."assessment_id"
)
UPDATE "training_assessments" AS a
SET "version" = a."version" + 1,
    "updated_at" = now()
WHERE a."id" IN (SELECT DISTINCT "assessment_id" FROM changed_questions);
