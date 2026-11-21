UPDATE "training_questions" AS q
SET "type" = 'multiple_select',
    "prompt" = 'Quais são os três tipos de clientes descritos no POP-COM-01?',
    "config" = $question${"allowPartialCredit":true,"options":[{"id":"grupo1","text":"Grupo 1 — Iniciante: ainda não vende letreiros com frequência ou terceiriza apenas ocasionalmente.","correct":true,"feedback":"O Grupo 1 está começando ou ainda não vende letreiros de forma regular."},{"id":"grupo2","text":"Grupo 2 — Fabricante: produz letreiros e pode buscar um modelo que não fabrica ou apoio quando falta capacidade.","correct":true,"feedback":"O Grupo 2 fabrica; investigue se procura um modelo diferente ou apoio para atender um pedido."},{"id":"grupo3","text":"Grupo 3 — Terceiriza: compra a produção de outro fornecedor e quer resolver uma insatisfação específica.","correct":true,"feedback":"O Grupo 3 já terceiriza e pode querer melhorar prazo, acabamento, atendimento ou preço."},{"id":"hibrido","text":"Grupo 4 — Híbrido: fabrica e terceiriza, independentemente do motivo deste pedido.","correct":false,"feedback":"O POP não cria um quarto grupo automático. Em um perfil híbrido, classifique pelo motivo deste pedido."},{"id":"recorrente","text":"Cliente recorrente: uma categoria que substitui os Grupos 1, 2 e 3.","correct":false,"feedback":"A frequência de compra, sozinha, não substitui os três grupos descritos no POP."}],"explanation":"Os três tipos são iniciante, fabricante e cliente que terceiriza. Se o cliente fabrica e também terceiriza, não há um quarto grupo: a necessidade deste pedido é classificada pelo motivo que o levou a procurar uma alternativa."}$question$::jsonb,
    "updated_at" = now()
FROM "training_assessments" AS a
JOIN "training_subjects" AS s ON s."id" = a."subject_id"
WHERE q."assessment_id" = a."id"
  AND s."slug" = 'closer'
  AND q."question_key" = 'classificar_hibrido';
--> statement-breakpoint
UPDATE "training_assessments" AS a
SET "version" = a."version" + 1,
    "updated_at" = now()
FROM "training_subjects" AS s
WHERE a."subject_id" = s."id"
  AND s."slug" = 'closer'
  AND EXISTS (
    SELECT 1
    FROM "training_questions" AS q
    WHERE q."assessment_id" = a."id"
      AND q."question_key" = 'classificar_hibrido'
  );
