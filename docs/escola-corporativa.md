# Escola Corporativa do Radrasys

A Escola Corporativa organiza conteúdo por setor, matéria, aula, avaliação e questão. A matéria publicada nesta atualização é Comercial → **Atendimento Novo Cliente**, baseada no arquivo `01_POP_Atendimento_Vendedor_Letreiros_Express.docx`. O próprio arquivo está marcado como versão de trabalho e aguarda validação da direção; seu conteúdo ainda não deve ser tratado como norma aprovada. A navegação fica em **Operações → Escola Corporativa** (`/treinamento`).

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

## Cobertura da matéria Atendimento Novo Cliente

A matéria publicada acompanha as dez partes do documento de trabalho. A avaliação **Atendimento Novo Cliente · Primeira compra** contém **29 questões**, distribuídas pelo sistema em três módulos sequenciais de até dez questões. A publicação permite o uso como treinamento, mas não significa que a direção aprovou o conteúdo. O POP continua marcado como versão de trabalho e precisa de validação antes de ser adotado como norma definitiva.

| Parte do documento de trabalho | Cobertura de treinamento |
| ------------------------------ | ------------------------ |
| 1. Finalidade e princípio econômico | Resolver o problema do comprador e conectar problema, proposta de valor, benefício, evidência e preço; equilibrar tempo, custo e qualidade. |
| 2. Origem e continuidade | Diferenciar leads qualificados pelo SDR, contatos diretos e clientes antigos; ler o histórico, assumir a continuidade do atendimento e não prometer transferência de uma conversa entre números de WhatsApp. |
| 3. Recebimento e diagnóstico | Responder com prontidão, não repetir perguntas já respondidas, separar tempo de resposta de tempo de orçamento e usar no máximo duas perguntas comerciais estratégicas como padrão. |
| 4. Catálogo e triagem | Identificar produtos sem iluminação, iluminados, modalidades frontlight/backlight e itens não fabricados ou terceirizados; consultar a área técnica quando a combinação não estiver cadastrada. |
| 5. Dados para cotação | Conferir modelo, material, quantidade, medidas, arte, luz, cor, acabamento, fixação e composição; distinguir fornecimento acabado de semiacabado, conferir lotes e oferecer uma ligação curta quando muitas mensagens dificultarem o levantamento. |
| 6. Necessidade, decisão e confiança | Relacionar o perfil e o problema do comprador a um benefício pertinente; considerar as perspectivas financeira, técnica e executiva como lentes, não como rótulos fixos; usar evidência real. |
| 7. Apresentação e retorno | Validar dados técnicos e comerciais antes de orçar, buscar um compromisso simples de retorno, destacar benefício e evidência relevantes e combinar o próximo passo. |
| 8. Cliente final e acompanhamento | Perguntar se o revendedor compraria caso o cliente final aprovasse aquela proposta; retomar contatos conforme o compromisso e conversar sobre barreiras antes da sétima cotação sem compra. |
| 9. Controles e melhoria | Evitar promessas sem confirmação, comparar propostas equivalentes, registrar estágio, pendências e próximos passos no CRM e acompanhar os indicadores descritos no documento. |
| 10. Validações antes da publicação | Manter visíveis os pontos que ainda precisam de definição comercial, conferência da engenharia, definição de prazo e cadência, validação de evidências e análise de conversas reais. |

### Triagem do catálogo prevista no documento

- **Sem iluminação:** ACM espelhado recortado, ACM montado, acrílico recortado, galvanizado, inox, latão e PVC expandido recortado. O documento diz para não oferecer PVC montado.
- **Com iluminação:** o POP descreve combinações de ACM montado, acrílico montado, alumínio ou galvanizado com face de acrílico, galvanizado ou inox backlight, latão e PVC backlight. Frontlight, backlight e borda infinita variam conforme o produto; acrílico montado é uma categoria própria, não deve ser tratado como backlight.
- **Não fabricar ou terceirizar:** o documento lista letreiros de entrada de cidade, MDF e promocionais para festas como itens que não fabricamos; neon, frontlight/montado em PVC expandido e letreiros termoformados como terceirizados. Combinações não cadastradas precisam ser conferidas com a área técnica. A categoria 3D iluminada aparece como possibilidade futura e não integra a oferta desta versão de trabalho.

### Status da fonte e validações pendentes

O DOCX se identifica como **“VERSÃO DE TRABALHO — A validar com a direção antes de aplicar como norma definitiva.”** Portanto, o catálogo de combinações, os nomes e conteúdos dos níveis Essencial/Acabado/Completo, a definição comercial de acabado e semiacabado, os prazos e a cadência de acompanhamento não devem ser apresentados como regras aprovadas. Também aguardam validação: combinações de materiais, bordas, fixação e LED com a engenharia; vídeos e evidências autorizados; regras financeiras e de desconto; e a auditoria de conversas antes de padronizar argumentos específicos. O documento de trabalho menciona estes assuntos, mas sua inclusão aqui não significa aprovação.

O material recomenda que, após seis orçamentos sem compra, o vendedor converse sobre barreiras antes da sétima cotação. Essa orientação também pertence à versão em validação e deve aguardar a direção antes de ser aplicada como procedimento definitivo.

### Complemento de atendimento fornecido pelo usuário

O script abaixo é uma orientação adicional informada diretamente pelo usuário, **não consta no POP de trabalho** e não deve ser atribuído ao documento nem apresentado como política institucional aprovada. Se for incorporado à matéria como instrução permanente, continua sujeito à validação da direção:

> “Entendo. De segunda a sexta, você fala comigo: respondo rápido, acompanho seu pedido de perto e, quando precisar, verifico com a produção e te atualizo.”

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

Escolha o formato de cada questão de Atendimento Novo Cliente conforme a tarefa que ela apresenta: use `yes_no_matrix` para julgar afirmações uma a uma e `multiple_select` para selecionar várias opções como um conjunto. A composição e os gabaritos desta prova continuam sujeitos à validação da direção.

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
