WITH question_edits AS (
  SELECT *
  FROM (
    VALUES (
      'objecao_atendimento',
      $json$[
        {
          "id":"a",
          "text":"Dizer que o sistema manda avisos em cada etapa, sem confirmar se isso existe para este pedido.",
          "correct":false,
          "feedback":"Não prometa uma função de atualização automática sem confirmar que ela existe e está ativa."
        },
        {
          "id":"b",
          "text":"Entendo. De segunda a sexta, você fala comigo: respondo rápido, acompanho seu pedido de perto e, quando precisar, verifico com a produção e te atualizo.",
          "correct":true,
          "feedback":"Use sua experiência real: respostas rápidas, contato próximo e acompanhamento da produção durante os dias de atendimento."
        },
        {
          "id":"c",
          "text":"Prometer resposta imediata a qualquer hora, inclusive à noite e nos fins de semana, sem combinar esse horário.",
          "correct":false,
          "feedback":"Seu atendimento é de segunda a sexta. Não prometa disponibilidade fora desses dias."
        }
      ]$json$::jsonb,
      'Fale do que você realmente faz. Informe seus dias de atendimento e não prometa retorno 24 horas ou nos fins de semana.'
    )
  ) AS edits(question_key, options, explanation)
),
rewritten_questions AS (
  SELECT
    q."id",
    q."assessment_id",
    jsonb_set(
      jsonb_set(q."config", '{options}', edit.options, false),
      '{explanation}', to_jsonb(edit.explanation), false
    ) AS new_config
  FROM "training_questions" AS q
  JOIN "training_assessments" AS a ON a."id" = q."assessment_id"
  JOIN "training_subjects" AS s ON s."id" = a."subject_id"
  JOIN question_edits AS edit ON edit.question_key = q."question_key"
  WHERE s."slug" = 'closer'
    AND q."type" = 'best_response'
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
