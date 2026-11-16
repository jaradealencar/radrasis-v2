# Escola Corporativa do Radrasys

A Escola Corporativa organiza conteúdo por setor, matéria, aula, avaliação e questão. O primeiro percurso publicado é Comercial → **Técnicas de Closer**, baseado no POP-COM-01, versão V1.2. A navegação fica em **Operações → Escola Corporativa** (`/treinamento`).

## Conteúdo e manutenção

O conteúdo fica nas tabelas `training_sectors`, `training_subjects`, `training_lessons`, `training_lesson_versions`, `training_assessments`, `training_questions` e `training_assessment_materials`. Os setores, matérias, aulas e avaliações podem ser criados, publicados, reordenados ou arquivados por usuários com os papéis `admin`, `master` ou `gestor`. O editor de questões permite selecionar um perfil entre onze modelos e editar visualmente enunciados, alternativas e gabaritos, além de manter uma área de edição avançada em JSON. Cada questão pode ser refeita com IA no mesmo formato; o resultado fica em revisão na tela e só altera a avaliação quando o instrutor salva uma nova versão. O servidor valida cada formato antes de salvar. Cada edição da aula grava a versão anterior e a nova no histórico, e a conclusão do aluno fica vinculada à versão estudada.

### Criar matéria e prova a partir de um POP

Na aba **Administrar conteúdo**, `admin`, `master` ou `gestor` pode enviar um POP em PDF, DOCX ou TXT e pedir ao sistema que prepare uma matéria, uma aula e uma avaliação. A geração só chama a IA depois que o instrutor clica em **Gerar rascunho**. O sistema extrai o texto do arquivo; para PDF escaneado, tenta transcrever as páginas sob demanda. Arquivos acima de 32 MB e textos acima do limite de leitura são recusados.

A proposta inclui perguntas de melhor resposta com quatro alternativas próprias, uma correta, três distratores plausíveis e feedback ligado a cada opção. O conteúdo e as respostas precisam ser revisados por uma pessoa. **Salvar como rascunho** grava matéria, aula, versão da aula, avaliação, questões e o POP original em uma única transação; os itens ficam sem publicação até um instrutor revisar e publicar. A matéria registra o nome do POP como fonte, e o arquivo fica ligado à avaliação como material de apoio. A geração usa a integração OpenAI já configurada no servidor e não publica nem cria conteúdo automaticamente.

Cada avaliação pode ter vários materiais de apoio enviados por instrutores. São aceitos PDF, Word, PowerPoint, Excel, TXT e imagens PNG/JPG/WEBP, limitados a 32 MB por arquivo. O aluno matriculado vê a lista na própria avaliação, com ações para consultar online ou baixar; os materiais não são exibidos antes da matrícula. O UploadThing armazena os arquivos, e a migration `0117_corporate_training` cria os registros que os vinculam à avaliação.

Ao salvar uma avaliação existente, a versão aumenta e as questões atuais são substituídas. Cada tentativa guarda um snapshot próprio, incluindo enunciados, alternativas, gabarito e explicações. Assim, a correção e o feedback de uma tentativa antiga continuam vinculados à versão que o aluno respondeu.

## Modos e pontuação

- **Prática:** cada envio recebe correção e explicação do servidor. O aluno pode tentar novamente sem limite; no resultado da tentativa, vale a maior pontuação obtida em cada questão.
- **Avaliação formal:** cada questão aceita uma resposta na tentativa, sem correção detalhada até a conclusão. A tentativa concluída apresenta a nota e o feedback.
- A nota final é sempre de **0 a 10**, independentemente da quantidade de questões ou dos pontos atribuídos: `(pontos obtidos ÷ pontos possíveis) × 10`, arredondada para duas casas decimais. Em múltipla seleção com crédito parcial, calcula-se `(corretas selecionadas − incorretas selecionadas) ÷ respostas corretas`, limitado ao intervalo de zero a um, vezes os pontos da questão.
- Nas simulações ramificadas, cada escolha recebe a pontuação e os critérios configurados para aquela etapa; a pontuação da questão é a média das etapas percorridas.

O sistema registra tentativas e respostas sem gravar textos privados em logs. O aluno consulta suas tentativas; `admin`, `master` e `gestor` consultam o relatório agregado. A autorização é verificada no servidor pela role e pela permissão da página `treinamento`.

Antes de iniciar qualquer prova de uma matéria, o usuário deve se matricular nela pelo botão **Matricular-se**. A matrícula fica registrada por usuário e matéria e é idempotente. As aulas continuam acessíveis antes da matrícula; o servidor exige a matrícula para iniciar, responder, concluir e revisar uma prova própria, além de desabilitar os botões correspondentes na interface.

Instrutores aplicam uma avaliação formal publicada aos alunos já matriculados, escolhendo os destinatários, a data limite e de 1 a 20 tentativas. O servidor valida novamente a publicação e a matrícula no momento da aplicação e do início. Cada tentativa fica vinculada à aplicação; uma prova em andamento pode ser retomada, o limite considera tentativas iniciadas e as concluídas mostram suas notas individualmente para o aluno e no relatório do instrutor. O acesso à prova e às notas requer matrícula ativa.

As avaliações são divididas automaticamente em módulos sequenciais de até 10 questões, conforme o total da versão iniciada (por exemplo, 29 questões formam três módulos). Cada questão enviada é salva; o aluno pode sair a qualquer momento e retomar a tentativa aberta pela mesma avaliação. Ao concluir um módulo, pode avançar ou sair e voltar depois. O sistema calcula a nota somente ao concluir o último módulo. A prática também retoma a tentativa em andamento.

O painel administrativo também apresenta o ranking de cada avaliação formal concluída. Cada aluno aparece uma vez por avaliação, com sua melhor nota, data da nota e quantidade de tentativas concluídas. Notas iguais compartilham a posição; as práticas não entram no ranking.

## Cobertura integral da avaliação de Técnicas de Closer

Após aplicar a migration `0120_closer_full_coverage`, a avaliação **Closer · Atendimento consultivo** recebe 21 questões situacionais e de conhecimento, sem apagar questões anteriores. Na seed original de `0121`, que tem oito questões, o banco totaliza 29; cada tentativa inclui todas as questões publicadas, inclusive as que instrutores adicionarem depois. A matriz liga todas as 14 seções e os anexos visuais A–F do POP-COM-01 ao banco da avaliação.

| Parte do material             | Questões da avaliação                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1. Objetivo e regra central   | `venda_solucao_beneficio`                                                                              |
| 2. Pergunta de entrada        | `pergunta_entrada_obrigatoria`, `classificacao_por_perfil`, `classificar_hibrido`                      |
| 3. Grupo 1 — começando        | `oportunidade_grupo1`, `mapa_necessidade_evidencia`                                                    |
| 4. Grupo 2 — fabrica          | `dois_motivos_grupo2`, `escopo_pronto_para_instalar`, `mapa_necessidade_evidencia`                     |
| 5. Grupo 3 — terceiriza       | `diagnostico_grupo3`, `mapa_necessidade_evidencia`                                                     |
| 6.1 Prazo                     | `prazo_confirmado`, `referencias_prazo`                                                                |
| 6.2 Acabamento                | `objecao_acabamento`, `mapa_necessidade_evidencia`                                                     |
| 6.3 Atendimento               | `objecao_atendimento`                                                                                  |
| 6.4 Preço                     | `resposta_preco`, `sim_objecao_valor`, `mapa_necessidade_evidencia`                                    |
| 7. Evidências institucionais  | `uso_responsavel_evidencias`, `mapa_necessidade_evidencia`                                             |
| 8. Construção da argumentação | `etapas_whatsapp`, `fala_consultiva`, `etapas_argumentacao`                                            |
| 9. Três confianças            | `tres_confiancas`                                                                                      |
| 10. Perspectivas do comprador | `perspectivas_comprador`                                                                               |
| 11. Registro no CRM           | `crm_qualificacao`, `crm_campos_completos`                                                             |
| 12. Avanço para cotação       | `dados_para_cotacao`                                                                                   |
| 13. Limites comerciais        | `limites_comerciais`, `resposta_preco`, `prazo_confirmado`, `sim_aprovacao_final`, `sim_objecao_valor` |
| 14. Monitoramento e melhoria  | `indicadores_closer`, `lideranca_treinamento`                                                          |
| Anexo A — Fluxograma          | `pergunta_entrada_obrigatoria`, `classificacao_por_perfil`, `mapa_necessidade_evidencia`               |
| Anexo B — Mapa mental         | `oportunidade_grupo1`, `mapa_necessidade_evidencia`                                                    |
| Anexo C — Resolver problemas  | `venda_solucao_beneficio`                                                                              |
| Anexo D — Classificação       | `pergunta_entrada_obrigatoria`, `classificacao_por_perfil`, `classificar_hibrido`                      |
| Anexo E — Grupos e interesses | `classificacao_por_perfil`, `tres_confiancas`, `perspectivas_comprador`                                |
| Anexo F — Roteiro WhatsApp    | `etapas_whatsapp`, `etapas_argumentacao`                                                               |

Os prazos de cerca de 4 dias úteis para alguns projetos em PVC e 10 a 11 dias úteis para letreiros acabados aparecem como referências condicionais, nunca como compromisso geral. Da mesma forma, volume, carteira e processo só podem ser apresentados como evidências atuais depois de validação.

## Painel de alunos e simulacro

O painel administrativo agrupa tentativas reais por aluno e exibe quantidade concluída/total, data mais recente e pontuação de cada prova. O **Simulacro do painel de alunos** gera nomes fictícios, datas distribuídas no período informado, avaliações do filtro selecionado e notas aleatórias para exercitar a apresentação do relatório. Os dados de simulacro existem somente no estado da página: não criam usuários, tentativas ou respostas no banco, não afetam o histórico real e desaparecem ao limpar ou recarregar a tela. É uma ferramenta de conferência visual do painel, não uma execução do motor de correção das questões.

## Formato das questões

O endpoint `treinamento.saveAssessment` recebe uma lista de objetos com `key`, `type`, `prompt`, `points`, `position` e `config`. O seletor de perfil oferece estes onze tipos:

- `multiple_choice` e `best_response`: escolha única em `config.options`, com `{ id, text, correct, feedback }`; `config.explanation` explica o raciocínio.
- `multiple_select`: escolha de várias alternativas como um conjunto; `config.allowPartialCredit` habilita crédito parcial. Inclua distratores plausíveis e misture a ordem das opções. Se o aluno deve julgar cada frase individualmente, use `yes_no_matrix`.
- `matching`: associação entre `config.leftItems` e `config.rightItems`, com gabarito em `config.correctPairs` (`leftId`, `rightId`). A questão deve ter pelo menos duas opções extras em `rightItems`, além de uma resposta por item da esquerda. As opções devem ser plausíveis, próprias daquela pergunta e diferentes das usadas nas outras associações da mesma prova; o servidor rejeita opções genéricas ou repetidas.
- `sum`: seleção de itens com `value` numérico; o gabarito usa `correct: true` e a nota compara o somatório selecionado ao somatório correto.
- `fill_blank`: o enunciado usa marcadores `{{id}}`; `config.blanks` fornece respostas aceitas por lacuna. `config.allowPartialCredit` habilita crédito por lacuna.
- `ordering`: `config.steps` contém `{ id, text }` e `config.correctOrder` contém a ordem esperada de IDs.
- `negotiation`: `config.nodes` contém nós `{ id, clientText, options }`. Uma alternativa pode definir `score` (0–100), `feedback`, `criteriaScores` e `nextNodeId`; ausência de próximo nó encerra o caminho. `finalFeedback` explica os critérios gerais.
- `true_false`: `config.correctBoolean` guarda o gabarito sem enviá-lo ao aluno antes da correção.
- `yes_no_matrix`: `config.statements` lista frases com `{ id, text, correctBoolean, feedback }`. `correctBoolean: true` significa Sim e `false` significa Não. O aluno responde a cada frase; cada acerto recebe a mesma parte dos pontos da questão. O servidor só envia as frases, sem o gabarito, antes do envio.
- `short_answer`: `config.acceptedAnswers` lista respostas aceitas; a comparação ignora maiúsculas, acentos e espaços repetidos.

Na avaliação Closer, as questões que pedem para julgar cada afirmação individualmente usam `yes_no_matrix`: `classificar_hibrido`, `crm_qualificacao`, `oportunidade_grupo1`, `uso_responsavel_evidencias`, `crm_campos_completos`, `dados_para_cotacao`, `limites_comerciais` e `indicadores_closer`. Use `multiple_select` quando a tarefa for escolher várias opções como um conjunto, sem pedir Sim/Não para cada frase.

Na resposta e na revisão de `yes_no_matrix`, mostre cada frase com a resposta do aluno e coloque a explicação logo abaixo somente quando ele errar. O botão **Ouvir explicação** usa a voz do navegador sob demanda; a aplicação não chama IA nem envia texto ao próprio servidor para essa leitura. Nas questões de resposta curta, a transcrição pelo microfone usa o reconhecimento local do navegador quando disponível e só começa após o aluno pedir; caso contrário, o aluno pode digitar. Durante a prova, o termômetro mostra questões respondidas, questões restantes e percentual de acerto com base nos pontos obtidos nas questões respondidas.

O exemplo abaixo representa uma questão de escolha única:

```json
{
  "key": "pergunta-entrada",
  "type": "multiple_choice",
  "prompt": "Qual pergunta inicia a classificação do cliente?",
  "points": 1,
  "position": 10,
  "config": {
    "options": [
      {
        "id": "a",
        "text": "Hoje você fabrica letreiros ou terceiriza a produção?",
        "correct": true
      },
      {
        "id": "b",
        "text": "Qual fornecedor você considera ruim?",
        "correct": false
      }
    ],
    "explanation": "A pergunta de entrada distingue cliente iniciante, fabricante e terceirizador."
  }
}
```

O editor autorizado acessa a aba **Administrar conteúdo** dentro da mesma página. Ao publicar novas matérias, use a organização já existente por setor e mantenha perguntas, respostas e explicações alinhadas a uma fonte aprovada.

### Correções em múltipla seleção

Em `multiple_select`, depois que o aluno responde, a correção aparece logo abaixo das alternativas julgadas errado: opções corretas que ele não marcou e distratores que marcou. Opções tratadas corretamente não recebem correção, e a lista geral do gabarito fica oculta nessa explicação.

## Testes de navegador da Escola

`yarn test:e2e:school` executa os fluxos principais da Escola em Chromium. O workflow `Quality` cria um PostgreSQL descartável, aplica as migrations, semeia contas e resultados fictícios e executa matrícula, aplicação/retomada de prova, painel, ranking, edição de alternativas e gabarito, prévia de questão refeita com IA e geração de rascunho a partir de um POP. Os cenários de IA e UploadThing usam respostas simuladas; nenhum serviço externo é chamado nos testes. `yarn e2e:seed` e o servidor de teste validam que `DATABASE_URL` corresponde a `TEST_DATABASE_URL` local; nunca use esses fixtures em produção.

Ao criar ou revisar provas, use a skill global `$escola-corporativa-provas`. Ela orienta a escrever alternativas claras, plausíveis e específicas para cada questão, sem deixar o gabarito óbvio por palavras repetidas ou por eliminação simples.

## Limites do material Closer

### Diagnóstico da aprovação do cliente final

Complemento de treinamento fornecido pelo usuário, não uma regra textual do POP-COM-01: além de descobrir o que o cliente final ainda precisa avaliar, pergunte se o próprio intermediário aprovaria a proposta caso seu cliente fechasse agora. Isso ajuda a revelar dúvidas sobre preço, concorrentes, acabamento ou escopo. Se houver outra dúvida, responda com informação verificável e combine o próximo passo; não prometa que o cliente final aprovará.

Script: “Ah, compreendi. Me diga uma coisa: vamos supor que seu cliente fechasse o pedido hoje, agora. Você aprovaria esta proposta comigo ou ainda teria algum ponto para analisar, como o preço ou a comparação com propostas concorrentes? Como você faria?”

### Pedido de desconto com proposta no menor preço

Na questão `resposta_preco`, o cenário considera que o cliente pede desconto mesmo com a proposta enxuta e no menor preço para aquela configuração. Informe que esse é o menor preço e que não trabalhamos com desconto. Só encaminhe a proposta ao diretor comercial para revisão se o cliente confirmar que fechará caso uma condição diferente seja aprovada. A revisão não garante aprovação.

Script pronto: “Para esta configuração, este já é o menor preço e não trabalhamos com desconto. Não consigo mudar nada por conta própria. Se você confirmar que fechará o pedido caso o diretor comercial aprove uma condição diferente, posso levar a proposta para revisão. A aprovação não é garantida; retorno com a decisão antes de confirmar qualquer condição.”

### Atendimento presente do vendedor

Para a objeção sobre demora nas atualizações, use como evidência o atendimento pessoal informado pelo usuário: respostas rápidas, contato próximo e acompanhamento da produção quando o cliente precisar, de segunda a sexta. Esta é uma orientação interna do vendedor, não uma afirmação do POP-COM-01.

Script pronto: “Entendo. De segunda a sexta, você fala comigo: respondo rápido, acompanho seu pedido de perto e, quando precisar, verifico com a produção e te atualizo.” Não prometa atendimento à noite, nos fins de semana ou 24 horas.

Na questão de confiança no vendedor, inclua também atendimento com entusiasmo e fala confiante. Essa orientação foi fornecida pelo usuário e não deve ser atribuída ao POP-COM-01.

O POP-COM-01 apresenta seis etapas de atendimento pelo WhatsApp, não seis perguntas-guia. Não estabelece uma cadência de follow-up para cliente sem retorno nem procedimento específico para aprovação do cliente final. As simulações iniciais praticam diagnóstico, postura, clareza e alinhamento do próximo passo, sem inventar prazos ou condições comerciais.

Prazos citados para alguns projetos são referências e exigem confirmação por modelo e capacidade. Números institucionais requerem validação antes de uso externo. Qualquer alternativa de preço depende de revisão técnica, explicitação das diferenças e reorçamento. “Pronto para instalar” só pode ser usado quando todos os componentes da opção estiverem incluídos.
