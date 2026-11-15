WITH question_edits AS (
  SELECT *
  FROM (
    VALUES (
      'uso_responsavel_evidencias',
      $json$[
        {
          "id":"volume",
          "text":"Falar que a empresa faz mais de 400 letreiros por mês, dizer de qual período é o dado e não prometer que o pedido entra agora.",
          "correct":true,
          "feedback":"O volume mostra experiência, mas não garante espaço imediato na produção."
        },
        {
          "id":"etapas_antigo",
          "text":"Descrever as oito etapas como rotina atual porque aparecem no material, sem consultar o checklist usado hoje.",
          "correct":false,
          "feedback":"Só descreva as etapas se o checklist atual confirmar que elas continuam sendo usadas."
        },
        {
          "id":"portfolio",
          "text":"Confirmar quais materiais, acabamentos e produtos estão disponíveis antes de oferecê-los.",
          "correct":true,
          "feedback":"Consulte as opções atuais antes de apresentá-las ao cliente."
        },
        {
          "id":"auditoria",
          "text":"Repetir o número de clientes de uma apresentação antiga sem registrar a data e o critério da contagem.",
          "correct":false,
          "feedback":"Confirme a data e o significado do número antes de usá-lo."
        },
        {
          "id":"equipe_producao",
          "text":"Usar o total de colaboradores para dizer quantas pessoas conseguem produzir hoje.",
          "correct":false,
          "feedback":"Não confunda o total de colaboradores com o tamanho da equipe de produção."
        },
        {
          "id":"alternativas",
          "text":"Oferecer outra configuração só depois de confirmar que ela foi aprovada e funciona para o projeto.",
          "correct":true,
          "feedback":"A opção precisa estar aprovada e atender aos requisitos técnicos e de segurança."
        },
        {
          "id":"clientes",
          "text":"Antes de citar mais de 5 mil clientes, confirmar com a direção ou o CRM o número e o que ele representa.",
          "correct":true,
          "feedback":"Confirme se o dado está atualizado e o que ele inclui antes de usá-lo."
        },
        {
          "id":"garantia",
          "text":"Usar o ritmo médio de produção para confirmar uma data sem perguntar à produção sobre a fila atual.",
          "correct":false,
          "feedback":"A média não mostra a capacidade disponível para esta data."
        },
        {
          "id":"etapas",
          "text":"Descrever as oito etapas de conferência somente se o checklist usado hoje confirmar esse processo.",
          "correct":true,
          "feedback":"Descreva apenas um processo atual e confirmado."
        },
        {
          "id":"catalogo_antigo",
          "text":"Tratar um item de catálogo antigo como disponível porque ele já foi oferecido em outra venda.",
          "correct":false,
          "feedback":"Confira a disponibilidade atual antes de oferecer um material ou acabamento."
        },
        {
          "id":"equipe",
          "text":"Atualizar o número de colaboradores e separar o total da empresa da equipe que produz.",
          "correct":true,
          "feedback":"Use o número atual e deixe claro qual equipe ele descreve."
        },
        {
          "id":"reducao_escopo",
          "text":"Trocar material ou acabamento para baixar o preço antes de confirmar a aprovação técnica.",
          "correct":false,
          "feedback":"Mudanças de material ou acabamento exigem validação antes de serem oferecidas."
        }
      ]$json$::jsonb,
      'Use números, processos e opções atuais que possam ser confirmados. Volume, tamanho da equipe ou catálogo antigo não garantem prazo, disponibilidade ou resultado.'
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
    AND q."type" = 'multiple_select'
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
