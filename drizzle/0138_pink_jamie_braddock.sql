-- Custom SQL migration file, put your code below! --
WITH changed_question AS (
  UPDATE "training_questions" AS q
  SET "type" = 'yes_no_matrix',
      "prompt" = 'Leia cada frase. Marque Sim se essa informação deve ser anotada no CRM. Marque Não se não deve.',
      "config" = $json${
        "statements": [
          {
            "id": "perfil_motivo",
            "text": "Tipo de cliente e motivo do pedido. Se ele fabrica e também terceiriza, considere o motivo deste pedido.",
            "correctBoolean": true,
            "feedback": "Anote o tipo de cliente e o motivo deste pedido."
          },
          {
            "id": "criterio_confianca",
            "text": "O que é mais importante para o cliente decidir e qual dúvida ele ainda tem sobre o produto, a empresa ou o vendedor?",
            "correctBoolean": true,
            "feedback": "Anote o que mais importa para o cliente e qual dúvida precisa ser esclarecida."
          },
          {
            "id": "voz_cliente",
            "text": "A necessidade do cliente com as palavras que ele usou, sem mudar o que ele disse.",
            "correctBoolean": true,
            "feedback": "Anote o que o cliente disse com clareza e sem mudar o sentido."
          },
          {
            "id": "proposta_e_prova",
            "text": "O benefício explicado ao cliente e a prova usada para mostrá-lo.",
            "correctBoolean": true,
            "feedback": "Anote o benefício explicado e a prova apresentada."
          },
          {
            "id": "dados_pedido",
            "text": "Modelo, material, prazo, detalhes importantes do pedido e quanto o cliente pretende investir, quando ele informar.",
            "correctBoolean": true,
            "feedback": "Anote os dados que o cliente informou e que ajudam a preparar o orçamento."
          },
          {
            "id": "proximo_passo",
            "text": "Qual será o próximo passo e quem ficará responsável? Por exemplo: consulta técnica, amostra, confirmar prazo ou fazer orçamento.",
            "correctBoolean": true,
            "feedback": "Deixe claro o que será feito e quem ficará responsável."
          },
          {
            "id": "lucro",
            "text": "Lucro e venda garantidos, mesmo sem fazer as contas.",
            "correctBoolean": false,
            "feedback": "Não prometa lucro ou venda garantidos sem fazer as contas."
          },
          {
            "id": "suposicao",
            "text": "Uma necessidade que o vendedor imaginou, anotada como se o cliente tivesse dito aquilo.",
            "correctBoolean": false,
            "feedback": "Não anote uma suposição como se fosse fala do cliente."
          }
        ],
        "explanation": "Anote dados que ajudem a entender o cliente e continuar o atendimento. Não invente promessas nem coloque palavras na boca do cliente."
      }$json$::jsonb,
      "updated_at" = now()
  FROM "training_assessments" AS a
  JOIN "training_subjects" AS s ON s."id" = a."subject_id"
  WHERE q."assessment_id" = a."id"
    AND s."slug" = 'closer'
    AND q."question_key" = 'crm_campos_completos'
    AND q."type" = 'multiple_select'
  RETURNING q."assessment_id"
)
UPDATE "training_assessments" AS a
SET "version" = a."version" + 1,
    "updated_at" = now()
WHERE a."id" IN (SELECT DISTINCT "assessment_id" FROM changed_question);
