-- Custom SQL migration file, put your code below! --
WITH question_prompts(question_key, prompt) AS (
  VALUES
    (
      'classificar_hibrido',
      'Para cada frase, marque Sim se ela descreve um dos três tipos de cliente do POP. Marque Não se não descreve.'
    ),
    (
      'crm_qualificacao',
      'Para cada frase, marque Sim se essa informação deve ser anotada na qualificação do cliente. Marque Não se não deve.'
    ),
    (
      'oportunidade_grupo1',
      'Para cada frase, marque Sim se a ação é adequada para atender um cliente que está começando. Marque Não se não é.'
    ),
    (
      'uso_responsavel_evidencias',
      'Para cada frase, marque Sim se a prática respeita as regras para usar dados e exemplos da empresa. Marque Não se não respeita.'
    ),
    (
      'dados_para_cotacao',
      'Para cada frase, marque Sim se esse cuidado é necessário antes de fazer o orçamento. Marque Não se não é.'
    ),
    (
      'limites_comerciais',
      'Para cada frase, marque Sim se o vendedor deve evitar essa atitude. Marque Não se não deve.'
    ),
    (
      'indicadores_closer',
      'Para cada frase, marque Sim se esse indicador ajuda a acompanhar e melhorar o atendimento, conforme o POP. Marque Não se não ajuda.'
    )
), changed_questions AS (
  UPDATE "training_questions" AS q
  SET "type" = 'yes_no_matrix',
      "prompt" = prompt_set.prompt,
      "config" = jsonb_build_object(
        'statements', (
          SELECT jsonb_agg(
            jsonb_strip_nulls(
              jsonb_build_object(
                'id', answer_option.value->'id',
                'text', answer_option.value->'text',
                'correctBoolean', COALESCE((answer_option.value->>'correct')::boolean, false),
                'feedback', answer_option.value->'feedback'
              )
            ) ORDER BY answer_option.ordinality
          )
          FROM jsonb_array_elements(q."config"->'options') WITH ORDINALITY AS answer_option(value, ordinality)
        ),
        'explanation', q."config"->'explanation'
      ),
      "updated_at" = now()
  FROM question_prompts AS prompt_set
  JOIN "training_assessments" AS a ON true
  JOIN "training_subjects" AS s ON s."id" = a."subject_id"
  WHERE q."assessment_id" = a."id"
    AND s."slug" = 'closer'
    AND q."question_key" = prompt_set.question_key
    AND q."type" = 'multiple_select'
  RETURNING q."assessment_id"
)
UPDATE "training_assessments" AS a
SET "version" = a."version" + 1,
    "updated_at" = now()
WHERE a."id" IN (SELECT DISTINCT "assessment_id" FROM changed_questions);
