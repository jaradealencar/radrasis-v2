WITH question_edits AS (
  SELECT *
  FROM (
    VALUES
      (
        'classificacao_por_perfil',
        $json$[
          {"id":"g1","text":"O dono quer testar a procura antes de investir em produção própria."},
          {"id":"g2","text":"A empresa já faz parte do trabalho; neste pedido, o acabamento solicitado é novo para a equipe."},
          {"id":"g3","text":"O cliente compra parte pronta hoje e busca uma alternativa para melhorar o resultado."}
        ]$json$::jsonb,
        $json$[
          {"id":"c","text":"Entender o que ele quer melhorar na compra atual e comparar opções com o mesmo escopo."},
          {"id":"d","text":"Começar pelo catálogo completo e depois decidir quais itens podem entrar na produção do cliente."},
          {"id":"a","text":"Descobrir quais modelos os clientes dele pedem e confirmar se há procura antes de sugerir novos gastos."},
          {"id":"e","text":"Sugerir trocar todos os fornecedores atuais para manter uma só origem de compra."},
          {"id":"b","text":"Conferir o acabamento e o que falta para atender só este pedido com segurança."}
        ]$json$::jsonb,
        'Associe cada situação do cliente à melhor forma de começar a conversa.',
        'Entenda o que o cliente já faz e o que pediu agora. Se o perfil for misto, considere o motivo deste pedido.'
      ),
      (
        'dois_motivos_grupo2',
        $json$[
          {"id":"nao_fabrica","text":"O cliente quer vender um formato que ainda não consegue fazer."},
          {"id":"sem_capacidade","text":"A equipe está cheia e o pedido novo pode atrasar os que já estão em andamento."}
        ]$json$::jsonb,
        $json$[
          {"id":"maquinas","text":"Comprar equipamento e montar o processo dentro da fábrica para vender esse formato."},
          {"id":"tempo","text":"Atender parte da demanda de fora, liberar a equipe e combinar o prazo depois de checar a fila."},
          {"id":"portfolio","text":"Incluir novos formatos na oferta sem comprar máquinas para começar."},
          {"id":"culpar","text":"Adiar toda a fila sem conferir se dá para dividir o pedido ou ajustar só uma etapa."}
        ]$json$::jsonb,
        'Associe o motivo deste pedido ao benefício que mais ajuda o cliente.',
        'Quando falta um modelo, a parceria amplia o que o cliente pode vender. Quando a equipe está cheia, pode liberar parte da demanda, após conferir prazo e capacidade.'
      ),
      (
        'diagnostico_grupo3',
        $json$[
          {"id":"prazo","text":"A instalação teve de ser remarcada porque o material chegou depois do combinado."},
          {"id":"acabamento","text":"Algumas letras chegaram com tom diferente do aprovado e uma borda soltando."},
          {"id":"atendimento","text":"O comprador precisou cobrar várias vezes para saber o andamento do pedido."},
          {"id":"preco","text":"O valor final passou do que o comprador tinha separado; ele ainda não explicou o motivo."}
        ]$json$::jsonb,
        $json$[
          {"id":"v","text":"Qual valor você tinha planejado e quais itens não pode tirar desta proposta?"},
          {"id":"historico","text":"Que outros produtos você vende e que tipo de cliente costuma atender?"},
          {"id":"p","text":"Qual data era necessária e em que etapa o atraso aconteceu? Isso já ocorreu em outros pedidos?"},
          {"id":"mudanca","text":"Quem mais participa da decisão e o que essa pessoa precisa avaliar?"},
          {"id":"a","text":"Pode mostrar onde aparece a diferença e dizer qual amostra ou acabamento foi aprovado?"},
          {"id":"t","text":"Em quais momentos esperava uma atualização? O que ainda ficou sem resposta?"}
        ]$json$::jsonb,
        'Associe cada reclamação à pergunta que ajuda a entender o problema.',
        'Pergunte primeiro sobre o que o cliente relatou. Depois, confirme outras causas sem supor quem foi o culpado.'
      ),
      (
        'tres_confiancas',
        $json$[
          {"id":"produto","text":"O comprador pergunta se a letra vai ficar bem no lugar onde será instalada."},
          {"id":"empresa","text":"Ele quer saber se a empresa consegue dar conta de pedidos grandes."},
          {"id":"vendedor","text":"O cliente pergunta se alguém vai avisar caso surja um atraso."}
        ]$json$::jsonb,
        $json$[
          {"id":"e","text":"Explicar como o pedido é acompanhado e mostrar dados ou referências que possam ser conferidos."},
          {"id":"depoimentos","text":"Usar números antigos da empresa como prova de que este pedido também sairá no prazo."},
          {"id":"v","text":"Anotar o combinado, dar retorno no dia prometido e avisar quando algo ainda não foi conferido."},
          {"id":"p","text":"Mostrar um exemplo real e conferir material, iluminação, medidas e acabamento."},
          {"id":"pressa","text":"Garantir que não haverá atraso antes de confirmar a data com quem cuida da produção."}
        ]$json$::jsonb,
        'Associe cada situação à melhor forma de responder e passar confiança.',
        'Mostre algo que possa ser conferido: uma amostra, dados da empresa ou um combinado claro de retorno.'
      ),
      (
        'perspectivas_comprador',
        $json$[
          {"id":"financeiro","text":"Quer conferir o total, como vai pagar e se ainda sobra margem."},
          {"id":"tecnico","text":"Quer saber se o material, as medidas e a fixação servem para a obra."},
          {"id":"executivo","text":"Avalia se a nova linha ajuda a empresa a crescer e atender mais tipos de pedido."}
        ]$json$::jsonb,
        $json$[
          {"id":"e","text":"Mostrar como a nova oferta pode ajudar a atender outros pedidos, com exemplos e dados confirmados."},
          {"id":"tecnica_preco","text":"Mostrar só o preço de cada peça, sem somar entrega, montagem e outros custos."},
          {"id":"f","text":"Conferir preço total, custos e formas de pagamento aprovadas; calcular a margem com dados reais."},
          {"id":"t","text":"Verificar material, medidas, acabamento e fixação antes de fechar o projeto."},
          {"id":"financeira_crescimento","text":"Dizer que essa linha vai aumentar as vendas sem confirmar se os clientes procuram esses modelos."}
        ]$json$::jsonb,
        'Associe cada dúvida à melhor ação para ajudar essa pessoa a decidir.',
        'Confira o que aquela pessoa precisa avaliar. Use valores reais, dados técnicos ou sinais de procura, conforme a dúvida.'
      ),
      (
        'mapa_necessidade_evidencia',
        $json$[
          {"id":"grupo1","text":"Um revendedor quer saber se há procura antes de investir."},
          {"id":"grupo2","text":"Um fabricante recebeu mais pedidos do que consegue terminar a tempo."},
          {"id":"acabamento","text":"Um comprador recebeu peças com falhas visíveis e quer evitar que se repita."},
          {"id":"prazo","text":"A instalação está marcada e o cliente precisa saber se a entrega chega a tempo."},
          {"id":"preco","text":"O valor passou do planejado, mas o cliente não quer abrir mão do que é essencial."}
        ]$json$::jsonb,
        $json$[
          {"id":"qualidade","text":"Pedir uma foto, confirmar o material e o acabamento pedidos e explicar como o problema será conferido."},
          {"id":"catalogo","text":"Enviar todo o catálogo e pedir que o cliente escolha, sem saber o que seus compradores procuram."},
          {"id":"capacidade","text":"Conferir a fila e a capacidade deste modelo antes de combinar o prazo e dividir o trabalho."},
          {"id":"escopo","text":"Descobrir o limite de valor e o que não pode mudar; cotar outra opção e explicar as diferenças."},
          {"id":"data","text":"Checar a data de montagem, o caminho da entrega e o prazo de produção antes de marcar a entrega."},
          {"id":"promessa","text":"Reservar a data pedida antes de conferir a fila e o prazo de transporte."},
          {"id":"portfolio","text":"Perguntar que tipos os compradores procuram e confirmar quais modelos e materiais estão disponíveis."}
        ]$json$::jsonb,
        'Associe cada situação à informação ou ação que ajuda a escolher a solução.',
        'Use uma informação ligada ao que o cliente relatou. Confirme os dados antes de prometer prazo ou reorçar.'
      )
  ) AS edits(question_key, left_items, right_items, prompt, explanation)
),
rewritten_questions AS (
  SELECT
    q."id",
    q."assessment_id",
    jsonb_set(
      jsonb_set(
        jsonb_set(q."config", '{leftItems}', edit.left_items, false),
        '{rightItems}', edit.right_items, false
      ),
      '{explanation}', to_jsonb(edit.explanation), false
    ) AS new_config,
    edit.prompt AS new_prompt
  FROM "training_questions" AS q
  JOIN "training_assessments" AS a ON a."id" = q."assessment_id"
  JOIN "training_subjects" AS s ON s."id" = a."subject_id"
  JOIN question_edits AS edit ON edit.question_key = q."question_key"
  WHERE s."slug" = 'closer'
    AND q."type" = 'matching'
),
changed_questions AS (
  UPDATE "training_questions" AS q
  SET "config" = rewritten.new_config,
      "prompt" = rewritten.new_prompt,
      "updated_at" = now()
  FROM rewritten_questions AS rewritten
  WHERE q."id" = rewritten."id"
    AND (
      q."config" IS DISTINCT FROM rewritten.new_config
      OR q."prompt" IS DISTINCT FROM rewritten.new_prompt
    )
  RETURNING q."assessment_id"
)
UPDATE "training_assessments" AS a
SET "version" = a."version" + 1,
    "updated_at" = now()
WHERE a."id" IN (SELECT DISTINCT "assessment_id" FROM changed_questions);
