WITH revised_question AS (
  SELECT
    'O cliente pede desconto e diz que o orçamento ficou acima da sua faixa. A proposta já está enxuta e no menor preço para essa configuração. Qual resposta segue melhor a orientação do treinamento?'::text AS prompt,
    $question${"options":[{"id":"a","text":"Posso retirar material e acabamento agora para chegar ao preço, sem precisar revisar a configuração.","correct":false,"feedback":"Mudanças exigem conferência técnica, transparência sobre diferenças e reorçamento."},{"id":"b","text":"Qual é sua faixa de investimento e o que não pode mudar? Posso estudar opções técnicas e mostrar exatamente o que muda.","correct":false,"feedback":"Essa resposta pode servir antes de rever preço e escopo, mas não deixa claro que o valor já é o menor nem condiciona a revisão ao compromisso do cliente."},{"id":"c","text":"Este é o preço mínimo. Não consigo mudar nada por conta própria. Não trabalhamos com desconto. Se você confirmar que fechará o pedido caso o diretor comercial aprove uma condição diferente, posso pedir que ele revise a proposta. A aprovação não é garantida.","correct":true,"feedback":"Informa o menor preço e o limite para desconto. Só oferece a revisão depois da confirmação de fechamento, sem prometer aprovação."}],"explanation":"Como a proposta já está no menor preço, informe isso e diga que não trabalhamos com desconto. Só ofereça levar a proposta ao diretor comercial se o cliente confirmar que fechará caso uma condição diferente seja aprovada. A revisão não garante aprovação."}$question$::jsonb AS config
),
updated_question AS (
  UPDATE "training_questions" AS q
  SET "prompt" = revised_question.prompt,
      "config" = revised_question.config,
      "updated_at" = now()
  FROM revised_question,
       "training_assessments" AS a
  JOIN "training_subjects" AS s ON s."id" = a."subject_id"
  WHERE q."assessment_id" = a."id"
    AND s."slug" = 'closer'
    AND q."question_key" = 'resposta_preco'
    AND (
      q."prompt" IS DISTINCT FROM revised_question.prompt
      OR q."config" IS DISTINCT FROM revised_question.config
    )
  RETURNING q."assessment_id"
)
UPDATE "training_assessments" AS a
SET "version" = a."version" + 1,
    "updated_at" = now()
WHERE a."id" IN (SELECT "assessment_id" FROM updated_question);
--> statement-breakpoint
WITH updated_lesson AS (
  UPDATE "training_lessons" AS l
  SET "content" = l."content" || E'\n\n' || $lesson$Pedido de desconto com proposta enxuta e no menor preço

Quando o cliente pedir desconto e a proposta já estiver enxuta e no menor preço para aquela configuração, informe isso com clareza. Diga que não trabalhamos com desconto e não prometa que outra condição será aprovada.

Só leve a proposta ao diretor comercial para revisão depois que o cliente confirmar que fechará o pedido caso uma condição diferente seja aprovada. A revisão não garante aprovação. Aguarde a decisão antes de confirmar qualquer condição.

Script pronto: “Para esta configuração, este já é o menor preço e não trabalhamos com desconto. Não consigo mudar nada por conta própria. Se você confirmar que fechará o pedido caso o diretor comercial aprove uma condição diferente, posso levar a proposta para revisão. A aprovação não é garantida; retorno com a decisão antes de confirmar qualquer condição.”$lesson$,
      "version" = l."version" + 1,
      "updated_at" = now()
  FROM "training_subjects" AS s
  WHERE l."subject_id" = s."id"
    AND s."slug" = 'closer'
    AND l."title" = 'Objeção de preço e alternativas técnicas'
    AND strpos(
      l."content",
      'Pedido de desconto com proposta enxuta e no menor preço'
    ) = 0
  RETURNING l."id", l."version", l."title", l."summary", l."content"
)
INSERT INTO "training_lesson_versions" (
  "lesson_id", "version", "title", "summary", "content"
)
SELECT "id", "version", "title", "summary", "content"
FROM updated_lesson
ON CONFLICT ("lesson_id", "version") DO NOTHING;
