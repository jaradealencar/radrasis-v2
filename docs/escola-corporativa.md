# Escola Corporativa do Radrasys

A Escola Corporativa organiza conteúdo por setor, matéria, aula, avaliação e questão. O primeiro percurso publicado é Comercial → **Técnicas de Closer**, baseado no POP-COM-01, versão V1.2. A navegação fica em **Operações → Escola Corporativa** (`/treinamento`).

## Conteúdo e manutenção

O conteúdo fica nas tabelas `training_sectors`, `training_subjects`, `training_lessons`, `training_lesson_versions`, `training_assessments`, `training_questions` e `training_assessment_materials`. Os setores, matérias, aulas e avaliações podem ser criados, publicados, reordenados ou arquivados por usuários com os papéis `admin`, `master` ou `gestor`. O editor de questões permite selecionar um perfil entre dez modelos e insere sua estrutura inicial no JSON para personalização. O servidor valida cada formato antes de salvar. Cada edição da aula grava a versão anterior e a nova no histórico, e a conclusão do aluno fica vinculada à versão estudada.

Cada avaliação pode ter vários materiais de apoio enviados por instrutores. São aceitos PDF, Word, PowerPoint, Excel, TXT e imagens PNG/JPG/WEBP, limitados a 32 MB por arquivo. O aluno matriculado vê a lista na própria avaliação, com ações para consultar online ou baixar; os materiais não são exibidos antes da matrícula. O UploadThing armazena os arquivos, e a migration `0126_stiff_gorgon` cria os registros que os vinculam à avaliação.

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

| Parte do material | Questões da avaliação |
| --- | --- |
| 1. Objetivo e regra central | `venda_solucao_beneficio` |
| 2. Pergunta de entrada | `pergunta_entrada_obrigatoria`, `classificacao_por_perfil`, `classificar_hibrido` |
| 3. Grupo 1 — começando | `oportunidade_grupo1`, `mapa_necessidade_evidencia` |
| 4. Grupo 2 — fabrica | `dois_motivos_grupo2`, `escopo_pronto_para_instalar`, `mapa_necessidade_evidencia` |
| 5. Grupo 3 — terceiriza | `diagnostico_grupo3`, `mapa_necessidade_evidencia` |
| 6.1 Prazo | `prazo_confirmado`, `referencias_prazo` |
| 6.2 Acabamento | `objecao_acabamento`, `mapa_necessidade_evidencia` |
| 6.3 Atendimento | `objecao_atendimento` |
| 6.4 Preço | `resposta_preco`, `sim_objecao_valor`, `mapa_necessidade_evidencia` |
| 7. Evidências institucionais | `uso_responsavel_evidencias`, `mapa_necessidade_evidencia` |
| 8. Construção da argumentação | `etapas_whatsapp`, `fala_consultiva`, `etapas_argumentacao` |
| 9. Três confianças | `tres_confiancas` |
| 10. Perspectivas do comprador | `perspectivas_comprador` |
| 11. Registro no CRM | `crm_qualificacao`, `crm_campos_completos` |
| 12. Avanço para cotação | `dados_para_cotacao` |
| 13. Limites comerciais | `limites_comerciais`, `resposta_preco`, `prazo_confirmado`, `sim_aprovacao_final`, `sim_objecao_valor` |
| 14. Monitoramento e melhoria | `indicadores_closer`, `lideranca_treinamento` |
| Anexo A — Fluxograma | `pergunta_entrada_obrigatoria`, `classificacao_por_perfil`, `mapa_necessidade_evidencia` |
| Anexo B — Mapa mental | `oportunidade_grupo1`, `mapa_necessidade_evidencia` |
| Anexo C — Resolver problemas | `venda_solucao_beneficio` |
| Anexo D — Classificação | `pergunta_entrada_obrigatoria`, `classificacao_por_perfil`, `classificar_hibrido` |
| Anexo E — Grupos e interesses | `classificacao_por_perfil`, `tres_confiancas`, `perspectivas_comprador` |
| Anexo F — Roteiro WhatsApp | `etapas_whatsapp`, `etapas_argumentacao` |

Os prazos de cerca de 4 dias úteis para alguns projetos em PVC e 10 a 11 dias úteis para letreiros acabados aparecem como referências condicionais, nunca como compromisso geral. Da mesma forma, volume, carteira e processo só podem ser apresentados como evidências atuais depois de validação.

## Painel de alunos e simulacro

O painel administrativo agrupa tentativas reais por aluno e exibe quantidade concluída/total, data mais recente e pontuação de cada prova. O **Simulacro do painel de alunos** gera nomes fictícios, datas distribuídas no período informado, avaliações do filtro selecionado e notas aleatórias para exercitar a apresentação do relatório. Os dados de simulacro existem somente no estado da página: não criam usuários, tentativas ou respostas no banco, não afetam o histórico real e desaparecem ao limpar ou recarregar a tela. É uma ferramenta de conferência visual do painel, não uma execução do motor de correção das questões.

## Formato das questões

O endpoint `treinamento.saveAssessment` recebe uma lista de objetos com `key`, `type`, `prompt`, `points`, `position` e `config`. O seletor de perfil oferece estes dez tipos:

- `multiple_choice` e `best_response`: escolha única em `config.options`, com `{ id, text, correct, feedback }`; `config.explanation` explica o raciocínio.
- `multiple_select`: escolha de várias alternativas; `config.allowPartialCredit` habilita crédito parcial.
- `matching`: associação entre `config.leftItems` e `config.rightItems`, com gabarito em `config.correctPairs` (`leftId`, `rightId`).
- `sum`: seleção de itens com `value` numérico; o gabarito usa `correct: true` e a nota compara o somatório selecionado ao somatório correto.
- `fill_blank`: o enunciado usa marcadores `{{id}}`; `config.blanks` fornece respostas aceitas por lacuna. `config.allowPartialCredit` habilita crédito por lacuna.
- `ordering`: `config.steps` contém `{ id, text }` e `config.correctOrder` contém a ordem esperada de IDs.
- `negotiation`: `config.nodes` contém nós `{ id, clientText, options }`. Uma alternativa pode definir `score` (0–100), `feedback`, `criteriaScores` e `nextNodeId`; ausência de próximo nó encerra o caminho. `finalFeedback` explica os critérios gerais.
- `true_false`: `config.correctBoolean` guarda o gabarito sem enviá-lo ao aluno antes da correção.
- `short_answer`: `config.acceptedAnswers` lista respostas aceitas; a comparação ignora maiúsculas, acentos e espaços repetidos.

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

## Testes de navegador da Escola

`yarn test:e2e:school` executa os fluxos principais da Escola em Chromium. O workflow `Quality` cria um PostgreSQL descartável, aplica as migrations, semeia contas e resultados fictícios e executa matrícula, aplicação/retomada de prova, painel e ranking. `yarn e2e:seed` e o servidor de teste validam que `DATABASE_URL` corresponde a `TEST_DATABASE_URL` local; nunca use esses fixtures em produção.

## Limites do material Closer

O POP-COM-01 apresenta seis etapas de atendimento pelo WhatsApp, não seis perguntas-guia. Não estabelece uma cadência de follow-up para cliente sem retorno nem procedimento específico para aprovação do cliente final. As simulações iniciais praticam diagnóstico, postura, clareza e alinhamento do próximo passo, sem inventar prazos ou condições comerciais.

Prazos citados para alguns projetos são referências e exigem confirmação por modelo e capacidade. Números institucionais requerem validação antes de uso externo. Qualquer alternativa de preço depende de revisão técnica, explicitação das diferenças e reorçamento. “Pronto para instalar” só pode ser usado quando todos os componentes da opção estiverem incluídos.
