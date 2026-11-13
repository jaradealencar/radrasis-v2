CREATE TABLE "training_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" integer NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"allow_practice" boolean DEFAULT true NOT NULL,
	"allow_formal" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_attempt_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"attempt_id" integer NOT NULL,
	"question_key" varchar(80) NOT NULL,
	"step_key" varchar(80),
	"response" jsonb NOT NULL,
	"points_awarded" numeric(8, 2) DEFAULT '0' NOT NULL,
	"is_correct" boolean,
	"is_terminal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"assessment_id" integer NOT NULL,
	"mode" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'in_progress' NOT NULL,
	"assessment_version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"score" numeric(7, 2),
	"points_earned" numeric(8, 2),
	"points_possible" numeric(8, 2),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "training_lesson_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" integer NOT NULL,
	"title" varchar(180) NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"question_key" varchar(80) NOT NULL,
	"type" varchar(32) NOT NULL,
	"prompt" text NOT NULL,
	"config" jsonb NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_sectors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"sector_id" integer NOT NULL,
	"title" varchar(180) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source_reference" varchar(256),
	"version" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_assessments" ADD CONSTRAINT "training_assessments_subject_id_training_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."training_subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_attempt_answers" ADD CONSTRAINT "training_attempt_answers_attempt_id_training_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."training_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_attempts" ADD CONSTRAINT "training_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_attempts" ADD CONSTRAINT "training_attempts_assessment_id_training_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."training_assessments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lesson_progress" ADD CONSTRAINT "training_lesson_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lesson_progress" ADD CONSTRAINT "training_lesson_progress_lesson_id_training_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."training_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_subject_id_training_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."training_subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_questions" ADD CONSTRAINT "training_questions_assessment_id_training_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."training_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_subjects" ADD CONSTRAINT "training_subjects_sector_id_training_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."training_sectors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "training_assessments_subject_idx" ON "training_assessments" USING btree ("subject_id","position");--> statement-breakpoint
CREATE INDEX "training_answers_attempt_question_idx" ON "training_attempt_answers" USING btree ("attempt_id","question_key","created_at");--> statement-breakpoint
CREATE INDEX "training_attempts_user_idx" ON "training_attempts" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "training_attempts_assessment_idx" ON "training_attempts" USING btree ("assessment_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "training_lesson_progress_user_lesson_uq" ON "training_lesson_progress" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE INDEX "training_lessons_subject_idx" ON "training_lessons" USING btree ("subject_id","position");--> statement-breakpoint
CREATE INDEX "training_questions_assessment_idx" ON "training_questions" USING btree ("assessment_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "training_questions_assessment_key_uq" ON "training_questions" USING btree ("assessment_id","question_key");--> statement-breakpoint
CREATE UNIQUE INDEX "training_sectors_slug_uq" ON "training_sectors" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "training_subjects_slug_uq" ON "training_subjects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "training_subjects_sector_idx" ON "training_subjects" USING btree ("sector_id","position");
--> statement-breakpoint
INSERT INTO "training_sectors" ("name", "slug", "description", "position", "is_published")
VALUES ('Comercial', 'comercial', 'Treinamentos de atendimento, diagnóstico e condução comercial.', 10, true);
--> statement-breakpoint
INSERT INTO "training_subjects" ("sector_id", "title", "slug", "description", "source_reference", "position", "is_published")
SELECT id, 'Closer', 'closer', 'Atendimento consultivo: classificar a necessidade, apresentar um benefício respaldado por evidência e conduzir o próximo passo.', 'POP-COM-01 · V1.2 · 12/11/2026', 10, true
FROM "training_sectors" WHERE slug = 'comercial';
--> statement-breakpoint
INSERT INTO "training_lessons" ("subject_id", "title", "summary", "content", "position", "is_published")
SELECT s.id, l.title, l.summary, l.content, l.position, true
FROM "training_subjects" s
CROSS JOIN (VALUES
  ('Objetivo e comportamento do closer', 'Vender é conectar a necessidade do cliente a uma solução e a um benefício demonstráveis.', $lesson$O objetivo é descobrir se o cliente está começando, já fabrica ou terceiriza, entender por que procurou a Letreiros Express e relacionar essa necessidade a uma evidência objetiva.

A sequência de argumentação é PROBLEMA → SOLUÇÃO → BENEFÍCIO → EVIDÊNCIA → PREÇO. A regra de atendimento é PERGUNTAR → CLASSIFICAR → DIAGNOSTICAR → BENEFÍCIO → EVIDÊNCIA → PRÓXIMO PASSO.

Escute antes de apresentar a empresa. Identifique a causa principal e, se houver, a secundária. Escolha um ou dois benefícios pertinentes, mostre um fato verificável e confirme o interesse e as informações necessárias para avançar.

Vender benefício não significa garantir resultado comercial ao cliente. Não prometa lucro, vendas, liderança de mercado, acabamento perfeito ou prazo sem confirmação.$lesson$, 10),
  ('Pergunta de entrada e classificação', 'Uma pergunta inicial distingue quem está começando, fabrica ou terceiriza.', $lesson$A pergunta de entrada é: “Hoje você fabrica letreiros ou terceiriza a produção?”

Quando a pessoa ainda não vende letreiros de forma regular ou terceiriza raramente, classifique como Grupo 1 — Iniciante. Pergunte quais modelos ela quer passar a oferecer.

Quando fabrica, classifique como Grupo 2 — Fabricante. Investigue se busca um modelo que não produz ou se precisa aliviar falta de tempo/capacidade. Se fabrica e também terceiriza, classifique pelo motivo deste pedido, não apenas pelo histórico.

Quando terceiriza, classifique como Grupo 3 — Terceiriza. Não presuma que o fornecedor atual é ruim. Pergunte o que gostaria de melhorar: prazo, acabamento, atendimento ou condições de preço.$lesson$, 20),
  ('Necessidade, benefício e evidência', 'Adapte o argumento ao motivo deste pedido.', $lesson$Grupo 1 pode buscar entrada no mercado, portfólio e diferenciação. A estrutura produtiva, os modelos efetivamente disponíveis e o histórico comercial podem ser evidências, desde que atuais e validados.

Grupo 2 pode precisar de um modelo que não fabrica ou de apoio quando há falta de tempo/capacidade. Relacione o benefício ao diagnóstico: ampliar portfólio, liberar equipe ou absorver picos de demanda. Confirme o modelo e a capacidade antes de afirmar que o pedido pode ser atendido.

Grupo 3 busca resolver uma insatisfação específica. Para prazo, consulte o prazo do modelo e a capacidade. Para acabamento, identifique o defeito, material e impacto. Para atendimento, entenda qual informação ou acompanhamento faltou. Para preço, investigue a faixa e o que é indispensável.

Construa a fala com os dados que o cliente forneceu: “Você me disse [necessidade]. Por isso, neste pedido o mais importante é [benefício]. Nossa evidência é [fato verificável]. Para avançarmos, preciso saber [pergunta/ação].”$lesson$, 30),
  ('Atendimento pelo WhatsApp em seis etapas', 'A sequência ilustrada no POP vai do acolhimento à proposta.', $lesson$O roteiro de WhatsApp tem seis etapas: 1) acolher e entender o que chamou a atenção; 2) classificar se o cliente fabrica, terceiriza ou está começando; 3) descobrir qual problema quer resolver; 4) apresentar a solução e o benefício adequado; 5) provar com evidência, usando fatos em vez de opiniões; 6) conduzir à proposta, explicando valor, prazo e próximos passos.

Use a evidência certa para cada necessidade. Números de clientes e volume de produção foram informados pela direção, mas devem ser validados antes de uso externo; volume não garante encaixe imediato. As oito etapas de conferência só devem ser descritas se o checklist estiver vigente.

Não recite todos os diferenciais. A pergunta deve vir antes do argumento, e a proposta deve refletir a especificação e o escopo confirmados.$lesson$, 40),
  ('Continuidade quando o cliente não respondeu ou aguarda aprovação', 'Pratique diagnóstico e alinhamento do próximo passo sem inventar uma cadência.', $lesson$O POP não estabelece prazo ou frequência obrigatória para retomar um cliente sem resposta, nem define um roteiro específico para a espera de aprovação do cliente final. Por isso, este módulo não fixa cadência nem cria uma promessa de retorno.

Na simulação de cliente sem resposta, investigue se existe dúvida ou informação pendente, evite presumir desinteresse e combine com o cliente um próximo passo que ele aceite.

Quando o cliente aguarda aprovação do cliente final, descubra o que ainda precisa ser avaliado. Ofereça informações verificáveis sobre escopo, material, acabamento ou prazo confirmado, conforme a necessidade, e alinhe o próximo passo sem pressionar nem garantir a decisão de terceiros.

Registre no CRM a necessidade nas palavras do cliente e o próximo passo combinado.$lesson$, 50),
  ('Objeções de prazo, acabamento e atendimento', 'Responda com investigação, evidência e limites claros.', $lesson$Prazo: consulte o prazo do modelo e a capacidade produtiva. Os prazos citados no POP para alguns projetos são referências comerciais, não regra geral nem compromisso sem confirmação. Se o prazo não atender, pergunte a data-limite e verifique com a produção antes de falar em encaixe especial.

Acabamento: acolha a preocupação, descubra qual problema ocorreu e em qual material. Explique as conferências vigentes e mostre exemplos concretos quando disponíveis. Não prometa “zero retrabalho” ou perfeição.

Atendimento: identifique o que faltou — resposta, atualização, clareza ou solução. Demonstre presença com informações corretas, registro das decisões e retorno no prazo combinado. Disponibilidade pessoal fora do expediente não é promessa institucional.$lesson$, 60),
  ('Objeção de preço e alternativas técnicas', 'Compare escopo e configuração com transparência.', $lesson$Não dispute apenas pelo menor número. Pergunte qual é o orçamento-alvo e quais características são inegociáveis. Se tecnicamente viável, estude outra configuração e deixe explícitas as diferenças de material, espessura, perfil, fixação, pintura ou acabamento.

Toda mudança de escopo depende de conferência técnica e reorçamento. Não reduza especificações sem mostrar o impacto, obter aprovação técnica e registrar o escopo. Não prometa que uma configuração diferente terá o mesmo resultado.

Uma resposta consultiva reconhece que o orçamento pode não ser o menor para a mesma configuração, investiga a faixa de investimento e os requisitos essenciais e oferece verificar alternativas técnicas antes de afirmar que há uma solução equivalente.$lesson$, 70),
  ('Confiança e perspectiva de decisão', 'Identifique o que ainda falta para o cliente decidir com segurança.', $lesson$O treinamento propõe três confianças: no produto, na empresa e no vendedor. Para o produto, podem ajudar fotos reais, especificações e escopo claro. Para a empresa, use canais e referências verificáveis e dados institucionais validados. Para o vendedor, seja transparente sobre prazo, escopo, alternativas e limites.

Pergunte o que falta para decidir com segurança: confirmar o resultado do letreiro, conhecer melhor a empresa ou esclarecer algo com você.

Considere também a perspectiva que pesa neste pedido: financeiro (preço, margem, custos e condições aprovadas), técnico (materiais, medidas, acabamento, fixação e conformidade) ou executivo (crescimento, portfólio, capacidade, tempo e reputação). Uma mesma pessoa pode considerar as três perspectivas; não são personalidades fixas.$lesson$, 80),
  ('CRM, cotação e limites comerciais', 'Registre a qualificação e avance com dados técnicos completos.', $lesson$Antes de concluir a qualificação, registre o perfil do cliente, motivo principal, critério decisório e confiança a reforçar, necessidade nas palavras do cliente, benefício e evidência apresentados, modelo/material, prazo desejado, especificações críticas, faixa de investimento quando informados, além do próximo passo e responsável.

Para cotar, solicite o desenho vetorial editável e os dados técnicos necessários. JPEG ou PNG não substitui o vetor requerido para calcular área, perímetro e nesting. Confirme material, medidas, acabamento, iluminação, fixação e modalidade de fornecimento.

Não diga “somos os melhores”, “nunca atrasamos”, “zero retrabalho” ou “menor preço do mercado” sem base objetiva. Não prometa prazo excepcional antes da confirmação da produção. “Pronto para instalar” só se aplica quando os componentes necessários estão incluídos na opção contratada. Não ataque o fornecedor atual nem prometa atendimento 24 horas sem política formal.$lesson$, 90)
) AS l(title, summary, content, position)
WHERE s.slug = 'closer';
--> statement-breakpoint
INSERT INTO "training_assessments" ("subject_id", "title", "description", "allow_practice", "allow_formal", "version", "position", "is_published")
SELECT id, 'Closer · Atendimento consultivo', 'Questões de aplicação do POP-COM-01 e simulações de conversas.', true, true, 1, 10, true
FROM "training_subjects" WHERE slug = 'closer';
--> statement-breakpoint
INSERT INTO "training_questions" ("assessment_id", "question_key", "type", "prompt", "config", "points", "position")
SELECT a.id, q.key, q.type, q.prompt, q.config::jsonb, q.points, q.position
FROM "training_assessments" a
CROSS JOIN (VALUES
  ('classificar_hibrido', 'multiple_choice', 'O cliente diz que fabrica letreiros, mas também terceiriza alguns pedidos. Como classificar a necessidade deste contato?', $question${"options":[{"id":"a","text":"Grupo 2, porque fabrica; o histórico define a classificação.","correct":false,"feedback":"O histórico sozinho não define o motivo deste pedido."},{"id":"b","text":"Classificar pelo motivo de procurar uma alternativa neste projeto.","correct":true,"feedback":"Para um perfil híbrido, o POP orienta enquadrar a necessidade deste pedido."},{"id":"c","text":"Grupo 3 automaticamente, porque terceiriza parte da produção.","correct":false,"feedback":"É preciso investigar o motivo do pedido atual."}],"explanation":"A pergunta de entrada revela se o cliente fabrica ou terceiriza. Se faz ambos, a classificação depende do motivo deste projeto."}$question$, 1, 10),
  ('crm_qualificacao', 'multiple_select', 'Quais informações fazem parte do registro mínimo de qualificação no CRM, conforme o POP?', $question${"allowPartialCredit":true,"options":[{"id":"perfil","text":"Perfil do cliente ou motivo que classifica um perfil híbrido.","correct":true,"feedback":"Inclua Grupo 1, 2, 3 ou o motivo do pedido híbrido."},{"id":"motivo","text":"Motivo principal que o cliente quer resolver.","correct":true,"feedback":"Registre a causa principal identificada."},{"id":"decisao","text":"Critério predominante e confiança que precisa ser reforçada.","correct":true,"feedback":"O POP pede critério financeiro, técnico ou executivo e ponto de confiança."},{"id":"necessidade","text":"Necessidade nas palavras do cliente, sem interpretação exagerada.","correct":true,"feedback":"Use uma frase curta e fiel ao que ele disse."},{"id":"beneficio","text":"Benefício e evidência concreta utilizados.","correct":true,"feedback":"Registre a identificação da evidência apresentada."},{"id":"proximo","text":"Próximo passo e responsável.","correct":true,"feedback":"Registre também envio de amostra, consulta técnica, prazo ou cotação quando aplicável."},{"id":"garantia","text":"Garantia de conversão e lucro estimado sem cálculo.","correct":false,"feedback":"O POP não autoriza prometer lucro nem conversão garantida."},{"id":"inferido","text":"Uma interpretação do vendedor apresentada como fala literal do cliente.","correct":false,"feedback":"A necessidade deve permanecer fiel às palavras do cliente."}],"explanation":"O cadastro também pode incluir modelo/material, prazo desejado, especificações críticas e faixa de investimento quando informados."}$question$, 2, 20),
  ('etapas_whatsapp', 'ordering', 'Ordene as seis etapas do atendimento consultivo pelo WhatsApp, conforme o material.', $question${"steps":[{"id":"acolher","text":"Acolher: entender o que chamou a atenção do cliente."},{"id":"classificar","text":"Classificar: identificar se fabrica, terceiriza ou está começando."},{"id":"descobrir","text":"Descobrir qual problema o cliente quer resolver."},{"id":"solucao","text":"Apresentar a solução e o benefício adequado."},{"id":"evidencia","text":"Provar com evidência: fatos, não opiniões."},{"id":"proposta","text":"Conduzir à proposta, esclarecendo valor, prazo e próximos passos."}],"correctOrder":["acolher","classificar","descobrir","solucao","evidencia","proposta"],"explanation":"A sequência começa escutando e classificando, diagnostica a necessidade, apresenta benefício e evidência e então conduz à proposta."}$question$, 2, 30),
  ('resposta_preco', 'best_response', 'O cliente diz: “Seu orçamento ficou acima da minha faixa.” Qual resposta segue melhor o POP?', $question${"options":[{"id":"a","text":"Posso retirar material e acabamento agora para chegar ao preço, sem precisar revisar a configuração.","correct":false,"feedback":"Mudanças exigem conferência técnica, transparência sobre diferenças e reorçamento."},{"id":"b","text":"Qual é sua faixa de investimento e o que não pode mudar? Posso estudar opções técnicas e mostrar exatamente o que muda.","correct":true,"feedback":"Investiga o orçamento-alvo e os requisitos essenciais, condicionando alternativas à análise técnica."},{"id":"c","text":"Somos o menor preço do mercado; consigo garantir o mesmo resultado.","correct":false,"feedback":"O POP proíbe alegações sem base e não promete resultado equivalente após mudança."}],"explanation":"Não dispute só o número. Investigue escopo e requisitos, depois confirme tecnicamente qualquer alternativa e refaça o orçamento."}$question$, 1, 40),
  ('prazo_confirmado', 'multiple_choice', 'O cliente pede um prazo excepcional para um modelo. O que fazer antes de assumir um compromisso?', $question${"options":[{"id":"a","text":"Prometer uma data para manter o interesse e confirmar depois.","correct":false,"feedback":"O POP orienta confirmar prazo e capacidade antes de prometer."},{"id":"b","text":"Consultar o prazo do modelo e a capacidade produtiva; só falar em encaixe após verificar com a produção.","correct":true,"feedback":"Prazos de referência não são compromissos gerais."},{"id":"c","text":"Usar os prazos de alguns projetos em PVC e de letreiros acabados como regra para todos.","correct":false,"feedback":"As referências dependem do produto e não constituem prazo geral."}],"explanation":"Prefira confirmar antes de prometer. Volume de produção não garante encaixe imediato."}$question$, 1, 50),
  ('sim_cliente_sem_retorno', 'negotiation', 'Simulação: cliente sem retorno após receber orçamento.', $question${"nodes":[{"id":"inicio","clientText":"Você encaminhou o orçamento e ainda não recebeu resposta.","options":[{"id":"diagnostico","text":"Retomar o contexto, perguntar se existe dúvida ou informação pendente e combinar um próximo passo que o cliente aceite.","score":100,"feedback":"Procura entender a situação, evita presumir desinteresse e alinha a continuidade sem impor uma cadência não definida no POP.","nextNodeId":"retorno","criteriaScores":{"Diagnóstico":100,"Postura":100,"Clareza":90,"Encaminhamento":100}},{"id":"pressao","text":"Avisar que só consegue manter o orçamento até hoje e que vai liberar uma condição especial.","score":0,"feedback":"Cria urgência e condição comercial não estabelecidas no treinamento.","nextNodeId":null,"criteriaScores":{"Diagnóstico":0,"Postura":0,"Clareza":25,"Encaminhamento":0}}]},{"id":"retorno","clientText":"Ainda não consegui analisar todos os detalhes.","options":[{"id":"esclarecer","text":"Perguntar qual informação ainda falta, esclarecer esse ponto e combinar quando faz sentido retomar.","score":100,"feedback":"Mantém o diagnóstico e deixa o momento do próximo contato acordado com o cliente.","nextNodeId":null,"criteriaScores":{"Diagnóstico":100,"Postura":100,"Clareza":100,"Encaminhamento":100}},{"id":"apresentacao","text":"Enviar uma apresentação longa sobre todos os diferenciais sem perguntar o que ainda precisa avaliar.","score":35,"feedback":"Pode acrescentar informação irrelevante; primeiro descubra a dúvida específica.","nextNodeId":null,"criteriaScores":{"Diagnóstico":25,"Postura":75,"Clareza":35,"Encaminhamento":30}}]}],"finalFeedback":"A simulação avalia diagnóstico, postura respeitosa, clareza e próximo passo combinado. O POP não define prazo ou frequência obrigatória para retomar contatos sem resposta.","explanation":"Não presuma desinteresse e não crie urgência. Identifique dúvidas pendentes e combine com o cliente a forma de continuar."}$question$, 4, 60),
  ('sim_aprovacao_final', 'negotiation', 'Simulação: cliente aguardando aprovação do cliente final.', $question${"nodes":[{"id":"inicio","clientText":"O cliente diz que está aguardando a aprovação do cliente final.","options":[{"id":"investigar","text":"Perguntar o que o cliente final ainda precisa avaliar e se há alguma informação de escopo, material ou acabamento que ajude na decisão.","score":100,"feedback":"Investiga a dúvida específica e oferece dados verificáveis sem pressionar nem garantir a decisão de terceiros.","nextNodeId":"criterio","criteriaScores":{"Diagnóstico":100,"Postura":100,"Clareza":90,"Encaminhamento":80}},{"id":"garantir","text":"Garantir que a aprovação virá e oferecer um prazo especial para fechar hoje.","score":0,"feedback":"Promete decisão de terceiro e condição/prazo não confirmados.","nextNodeId":null,"criteriaScores":{"Diagnóstico":0,"Postura":0,"Clareza":10,"Encaminhamento":0}}]},{"id":"criterio","clientText":"Ele quer comparar o acabamento e entender o que está incluído para instalação.","options":[{"id":"escopo","text":"Enviar evidência real do acabamento e esclarecer o escopo e os itens incluídos nesta opção; depois combinar o próximo passo.","score":100,"feedback":"Usa evidência e explicita o escopo. “Pronto para instalar” só se aplica quando os componentes necessários estão incluídos.","nextNodeId":null,"criteriaScores":{"Diagnóstico":100,"Postura":100,"Clareza":100,"Encaminhamento":100}},{"id":"pronto","text":"Dizer que qualquer opção chega pronta para fixar, mesmo sem revisar componentes e modalidade de fornecimento.","score":0,"feedback":"O POP proíbe afirmar que todo produto chega pronto para fixação sem verificar os itens incluídos.","nextNodeId":null,"criteriaScores":{"Diagnóstico":25,"Postura":50,"Clareza":0,"Encaminhamento":0}}]}],"finalFeedback":"A simulação avalia investigação da aprovação pendente, transparência do escopo, uso de evidência e próximo passo. Não prometa a decisão do cliente final.","explanation":"Descubra o que precisa ser aprovado e responda com informações verificáveis sobre a configuração real do pedido."}$question$, 4, 70),
  ('sim_objecao_valor', 'negotiation', 'Simulação: objeção de valor e pedido de adequação do orçamento.', $question${"nodes":[{"id":"inicio","clientText":"O cliente diz que o preço está acima do que pretende investir.","options":[{"id":"diagnosticar","text":"Perguntar qual é a faixa de investimento e quais características são indispensáveis antes de estudar outra configuração.","score":100,"feedback":"Investiga o alvo e separa o negociável do essencial antes de propor mudança.","nextNodeId":"escopo","criteriaScores":{"Diagnóstico":100,"Postura":100,"Clareza":90,"Encaminhamento":80}},{"id":"cortar","text":"Reduzir espessura ou acabamento imediatamente e dizer que o resultado será o mesmo.","score":0,"feedback":"A alteração depende de validação técnica, explicação das diferenças e reorçamento.","nextNodeId":null,"criteriaScores":{"Diagnóstico":0,"Postura":40,"Clareza":0,"Encaminhamento":0}}]},{"id":"escopo","clientText":"Tenho uma faixa definida, mas acabamento e fixação são indispensáveis.","options":[{"id":"alternativa","text":"Manter os requisitos essenciais e verificar tecnicamente se há outra composição; apresentar diferenças explícitas e reorçar.","score":100,"feedback":"Respeita o que é inegociável e condiciona qualquer alternativa à conferência técnica e ao reorçamento.","nextNodeId":null,"criteriaScores":{"Diagnóstico":100,"Postura":100,"Clareza":100,"Encaminhamento":100}},{"id":"equivalente","text":"Prometer o mesmo resultado e retirar itens da especificação sem alterar o orçamento registrado.","score":0,"feedback":"Esconde mudança de escopo e faz uma promessa sem base técnica.","nextNodeId":null,"criteriaScores":{"Diagnóstico":25,"Postura":25,"Clareza":0,"Encaminhamento":0}}]}],"finalFeedback":"A simulação avalia diagnóstico da faixa e requisitos, postura transparente, explicação das diferenças e encaminhamento para validação técnica e reorçamento.","explanation":"Não reduza especificações silenciosamente. Toda alternativa deve explicitar impactos, passar por conferência técnica e gerar novo orçamento."}$question$, 4, 80)
) AS q(key, type, prompt, config, points, position)
WHERE a.title = 'Closer · Atendimento consultivo';
--> statement-breakpoint
INSERT INTO "role_permissions" ("role", "pageKey", "canAccess")
SELECT seeded_role.value, 'treinamento', 'sim'
FROM unnest(ARRAY['gestor', 'vendas', 'logistica', 'producao', 'financeiro', 'empacotamento']::app_role[]) AS seeded_role(value)
WHERE NOT EXISTS (
  SELECT 1 FROM "role_permissions" existing
  WHERE existing."role" = seeded_role.value AND existing."pageKey" = 'treinamento'
);
