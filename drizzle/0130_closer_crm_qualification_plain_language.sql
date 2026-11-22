UPDATE "training_questions" AS q
SET "config" = $question${"allowPartialCredit":true,"options":[{"id":"perfil","text":"Tipo de cliente: está começando, fabrica ou compra de outra empresa. Se faz os dois, anote por que pediu.","correct":true,"feedback":"Anote se está começando, fabrica ou compra de outra empresa. Se faz os dois, anote por que pediu."},{"id":"motivo","text":"O que o cliente quer resolver.","correct":true,"feedback":"Anote o que ele quer resolver."},{"id":"decisao","text":"O que mais importa para ele decidir e o que ainda deixa dúvida.","correct":true,"feedback":"Anote se pesa mais o preço, o produto ou a aprovação de outra pessoa. Registre também a dúvida que ainda precisa ser esclarecida."},{"id":"necessidade","text":"O que o cliente precisa, escrito com as palavras dele.","correct":true,"feedback":"Use uma frase curta com as palavras do cliente."},{"id":"beneficio","text":"Como podemos ajudar e o que mostramos para provar.","correct":true,"feedback":"Registre como podemos ajudar e o que foi mostrado para provar."},{"id":"proximo","text":"Qual será o próximo passo e quem vai cuidar dele.","correct":true,"feedback":"Anote o que será feito e quem fará. Por exemplo: pedir uma amostra ou confirmar o prazo."},{"id":"garantia","text":"Prometer que o cliente vai vender e ganhar dinheiro, sem ter prova.","correct":false,"feedback":"Não prometa que o cliente vai vender ou ganhar dinheiro. O POP não permite essa promessa."},{"id":"inferido","text":"Escrever no CRM uma coisa que você imaginou como se o cliente tivesse dito.","correct":false,"feedback":"Não registre uma coisa que você imaginou como se o cliente tivesse dito."}],"explanation":"Registre o tipo de cliente e o motivo, o que ele quer resolver, o que mais pesa na decisão e o que ainda deixa dúvida. Anote também como você pode ajudar, o que mostrou para provar e qual será o próximo passo. Inclua detalhes do pedido quando o cliente informar."}$question$::jsonb,
    "updated_at" = now()
FROM "training_assessments" AS a
JOIN "training_subjects" AS s ON s."id" = a."subject_id"
WHERE q."assessment_id" = a."id"
  AND s."slug" = 'closer'
  AND q."question_key" = 'crm_qualificacao';
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
      AND q."question_key" = 'crm_qualificacao'
  );
