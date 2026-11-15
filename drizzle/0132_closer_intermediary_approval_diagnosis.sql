WITH question_config AS (
  SELECT
    q."id",
    q."assessment_id",
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            q."config",
            '{nodes,0,options,0,text}',
            to_jsonb('Ah, compreendi. Me diga uma coisa: vamos supor que seu cliente fechasse o pedido hoje, agora. Você aprovaria esta proposta comigo ou ainda teria algum ponto para analisar, como o preço ou a comparação com propostas concorrentes? Como você faria?'::text),
            false
          ),
          '{nodes,0,options,0,feedback}',
          to_jsonb('Investiga se o próprio cliente ainda tem dúvidas, como preço ou comparação com concorrentes, mesmo que o cliente final aprove.'::text),
          false
        ),
        '{nodes,1,clientText}',
        to_jsonb('O cliente responde: “Eu ainda preciso comparar o acabamento e confirmar o que está incluído para instalação.”'::text),
        false
      ),
      '{finalFeedback}',
      to_jsonb('A simulação avalia se o vendedor identifica as dúvidas do próprio cliente, esclarece acabamento e escopo com informações verificáveis e combina o próximo passo. Não prometa que o cliente final aprovará.'::text),
      false
    ) AS updated_config
  FROM "training_questions" AS q
  JOIN "training_assessments" AS a ON a."id" = q."assessment_id"
  JOIN "training_subjects" AS s ON s."id" = a."subject_id"
  WHERE s."slug" = 'closer'
    AND q."question_key" = 'sim_aprovacao_final'
),
question_with_explanation AS (
  SELECT
    "id",
    "assessment_id",
    jsonb_set(
      updated_config,
      '{explanation}',
      to_jsonb('A pergunta distingue a aprovação do cliente final das dúvidas do intermediário. Se ele ainda tiver algo a analisar, como preço, acabamento ou escopo, esclareça com informações verificáveis e combine o próximo passo. A decisão do cliente final não é garantida.'::text),
      false
    ) AS updated_config
  FROM question_config
),
changed_question AS (
  UPDATE "training_questions" AS q
  SET "config" = question_with_explanation.updated_config,
      "updated_at" = now()
  FROM question_with_explanation
  WHERE q."id" = question_with_explanation."id"
    AND q."config" IS DISTINCT FROM question_with_explanation.updated_config
  RETURNING q."assessment_id"
)
UPDATE "training_assessments" AS a
SET "version" = a."version" + 1,
    "updated_at" = now()
WHERE a."id" IN (SELECT "assessment_id" FROM changed_question);
