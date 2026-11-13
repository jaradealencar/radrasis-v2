# Escola Corporativa do Radrasys

A Escola Corporativa organiza conteúdo por setor, matéria, aula, avaliação e questão. O primeiro percurso publicado é Comercial → Closer, baseado no POP-COM-01, versão V1.2. A navegação fica em **Operações → Escola Corporativa** (`/treinamento`).

## Conteúdo e manutenção

O conteúdo fica nas tabelas `training_sectors`, `training_subjects`, `training_lessons`, `training_lesson_versions`, `training_assessments` e `training_questions`. Os setores, matérias, aulas e avaliações podem ser publicados, reordenados ou arquivados por usuários com os papéis `admin`, `master` ou `gestor`. A autoria da avaliação edita as questões em JSON; o servidor valida a estrutura antes de salvar. Cada edição da aula grava a versão anterior e a nova no histórico, e a conclusão do aluno fica vinculada à versão estudada.

Ao salvar uma avaliação existente, a versão aumenta e as questões atuais são substituídas. Cada tentativa guarda um snapshot próprio, incluindo enunciados, alternativas, gabarito e explicações. Assim, a correção e o feedback de uma tentativa antiga continuam vinculados à versão que o aluno respondeu.

## Modos e pontuação

- **Prática:** cada envio recebe correção e explicação do servidor. O aluno pode tentar novamente sem limite; no resultado da tentativa, vale a maior pontuação obtida em cada questão.
- **Avaliação formal:** cada questão aceita uma resposta na tentativa, sem correção detalhada até a conclusão. A tentativa concluída apresenta a nota e o feedback.
- A nota é pontos obtidos divididos por pontos possíveis, em percentual. Em múltipla seleção com crédito parcial, calcula-se `(corretas selecionadas − incorretas selecionadas) ÷ respostas corretas`, limitado ao intervalo de zero a um, vezes os pontos da questão.
- Nas simulações ramificadas, cada escolha recebe a pontuação e os critérios configurados para aquela etapa; a pontuação da questão é a média das etapas percorridas.

O sistema registra tentativas e respostas sem gravar textos privados em logs. O aluno consulta suas tentativas; `admin`, `master` e `gestor` consultam o relatório agregado. A autorização é verificada no servidor pela role e pela permissão da página `treinamento`.

## Formato das questões

O endpoint `treinamento.saveAssessment` recebe uma lista de objetos com `key`, `type`, `prompt`, `points`, `position` e `config`. Os tipos entregues nesta primeira versão são:

- `multiple_choice` e `best_response`: `config.options` contém alternativas `{ id, text, correct, feedback }` e `config.explanation` explica o raciocínio.
- `multiple_select`: usa as mesmas alternativas e `config.allowPartialCredit` para habilitar crédito parcial.
- `ordering`: `config.steps` contém `{ id, text }` e `config.correctOrder` contém a ordem esperada de IDs.
- `negotiation`: `config.nodes` contém nós `{ id, clientText, options }`. Uma alternativa pode definir `score` (0–100), `feedback`, `criteriaScores` e `nextNodeId`; ausência de próximo nó encerra o caminho. `finalFeedback` explica os critérios gerais.

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
      { "id": "a", "text": "Hoje você fabrica letreiros ou terceiriza a produção?", "correct": true },
      { "id": "b", "text": "Qual fornecedor você considera ruim?", "correct": false }
    ],
    "explanation": "A pergunta de entrada distingue cliente iniciante, fabricante e terceirizador."
  }
}
```

O editor autorizado acessa a aba **Administrar conteúdo** dentro da mesma página. Ao publicar novas matérias, use a organização já existente por setor e mantenha perguntas, respostas e explicações alinhadas a uma fonte aprovada.

## Limites do material Closer

O POP-COM-01 apresenta seis etapas de atendimento pelo WhatsApp, não seis perguntas-guia. Não estabelece uma cadência de follow-up para cliente sem retorno nem procedimento específico para aprovação do cliente final. As simulações iniciais praticam diagnóstico, postura, clareza e alinhamento do próximo passo, sem inventar prazos ou condições comerciais.

Prazos citados para alguns projetos são referências e exigem confirmação por modelo e capacidade. Números institucionais requerem validação antes de uso externo. Qualquer alternativa de preço depende de revisão técnica, explicitação das diferenças e reorçamento. “Pronto para instalar” só pode ser usado quando todos os componentes da opção estiverem incluídos.
