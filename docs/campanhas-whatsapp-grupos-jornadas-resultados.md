# Campanhas WhatsApp — grupos, jornadas e resultado no MubiSys

## Objetivo

Evoluir o módulo atual de campanhas para um painel de marketing que represente o conceito usado pelo proprietário:

> **Cada campanha é um grupo de clientes. Cada grupo tem uma jornada ordenada de 6 a 8 mensagens. Cada mensagem tem seu template, execução e resultado. As propostas e vendas são reconciliadas com os identificadores do MubiSys, e os custos configurados permitem analisar retorno.**

O painel deve continuar dentro de **Marketing, Clientes e Receita → Campanhas WhatsApp**, em `MarketingFinanceiro.tsx`. Não criar uma demonstração separada nem outro módulo paralelo.

Este documento organiza a construção. Ele não altera regra comercial, schema, banco ou código de envio.

## Modelo do produto

| Conceito | Significado no produto | Situação no código atual |
| --- | --- | --- |
| **Grupo** | Audiência e objetivo duradouros: por exemplo, primeira compra, reativação ou prospecção. | `campanhas_whatsapp` já contém cadastro, público, status, frequência e quarentena. A interface ainda chama a entidade de campanha. |
| **Jornada** | Versão ordenada do plano de comunicação de um grupo. Uma jornada contém 6 a 8 etapas. | Não existe entidade de jornada/versionamento. |
| **Mensagem / etapa** | Um dos passos da jornada, com template próprio, posição, condição/data de envio e custo configurado. | Hoje há um `wts_template_id` por campanha e scripts de texto; não há vários templates ordenados por grupo. |
| **Inscrição do cliente** | Vínculo de uma pessoa ao grupo e à versão da jornada, indicando a etapa atual e se continua elegível. | As listas são resolvidas novamente pelas fontes; o histórico guarda o último contato por telefone/campanha. Não há progresso persistido de 1 a 8 por cliente. |
| **Disparo** | Execução de uma etapa para uma lista de destinatários em uma data. | `campanhas_whatsapp_disparos` já registra execuções agregadas. |
| **Resultado por mensagem** | Aceite, entrega, leitura, falha, resposta ou estado ainda incerto de cada destinatário em uma etapa. | `campanhas_whatsapp_disparo_itens` já guarda telefone, nome, ID/status do provedor; não recebe respostas do cliente como evento de campanha. |
| **Resultado ERP** | Proposta, pedido/OS, faturamento e valor vinculados ao cliente e à jornada que o influenciou. | Há dados sincronizados de propostas e OS, mas falta um vínculo confiável entre cliente/OS e inscrição na jornada. |
| **Custo e ROI** | Custo versionado das mensagens e retorno comercial atribuído sem duplicar uma venda. | Não há configuração de custo por etapa nem ROI de campanhas. |

Para preservar os dados existentes, a recomendação é **manter `campanhas_whatsapp` como identidade persistente do grupo** e introduzir a jornada de forma aditiva. Não renomear nem apagar tabelas históricas durante a primeira entrega.

## Jornada operacional proposta

1. **Configurar grupo**: nome, objetivo/categoria, público/fonte ERP, período de entrada, status, opt-out e proteções atuais.
2. **Montar jornada**: cadastrar entre 6 e 8 etapas em ordem. Cada etapa aponta para um template aprovado no provedor e tem suas próprias configurações.
3. **Definir entrada e avanço**: selecionar quem entra no grupo, em que condição cada etapa vence e o que interrompe a sequência.
4. **Pré-verificar**: resolver o `clienteId` do MubiSys, telefone, opt-out, quarentena, cadência, atendimento ativo e inscrição duplicada.
5. **Executar uma etapa**: enviar somente a etapa prevista; criar uma execução e itens por destinatário com chave idempotente antes/ao registrar o resultado do provedor.
6. **Acompanhar resultado**: distinguir tentativa, aceite, entrega, leitura, resposta, falha e estado incerto. Estado incerto não deve liberar reenvio automático.
7. **Avançar ou encerrar**: registrar resposta, oportunidade, proposta, pedido, compra, opt-out, pausa ou conclusão; aplicar as regras aprovadas para continuar ou parar.
8. **Reconciliar com MubiSys**: associar números de proposta e OS ao cliente e exibir contagens/valores sem repetir o mesmo número ERP.
9. **Calcular custo e retorno**: somar custo histórico congelado dos envios cobrados e comparar com valores ERP segundo uma regra de atribuição visível.

### Proteções que continuam obrigatórias

- Opt-out deve prevalecer em todas as fontes e etapas.
- Quarentena entre grupos deve ser verificada antes de cada destinatário.
- Duas execuções concorrentes não podem reservar o mesmo cliente/etapa.
- Pausar um grupo deve impedir o próximo envio; se a operação estiver em curso, a pausa deve impedir os próximos destinatários ainda não submetidos.
- Falha do provedor ou do banco precisa deixar um item rastreável e recuperável, sem reenvio às cegas.
- O teste de template deve continuar separado da audiência, da cadência e do custo operacional da jornada.

## Estrutura de dados recomendada

Reaproveitar o que já existe e acrescentar o necessário, sempre por migrations revisadas:

1. **Jornadas versionadas** — grupo, versão, estado (rascunho/ativa/encerrada), datas e autor. Alterar a sequência não pode reescrever os resultados da versão anterior.
2. **Etapas da jornada** — versão, posição 1–8, ID do template, regra de vencimento, estado, custo configurado e moeda. Impedir ativação com menos de 6 ou mais de 8 etapas.
3. **Inscrições do grupo** — `clienteId` MubiSys quando resolvido, telefone normalizado como evidência/canal, jornada/versão, etapa atual, próxima data, estado, origem e motivo de parada. Usar chave única para impedir inscrição duplicada na mesma versão.
4. **Execuções e itens** — reaproveitar `campanhas_whatsapp_disparos` e `campanhas_whatsapp_disparo_itens`; acrescentar o vínculo à etapa/inscrição, chave idempotente, custo unitário congelado e dados de reconciliação do provedor.
5. **Eventos da jornada** — trilha append-only para envio/status/resposta/opt-out/proposta/pedido/cancelamento, com fonte, data do evento, chave externa e vínculo ao cliente/grupo/etapa quando conhecido.
6. **Atribuição ERP** — persistir, para auditoria, qual política ligou uma proposta/OS a uma jornada, os números ERP, valor e evidência. A mesma OS não pode ser somada integralmente em duas campanhas como receita direta.

Esses são conceitos de domínio, não uma autorização para executar migrations. Antes da implementação, conferir se algum campo novo pode ser acrescentado às tabelas existentes sem duplicar informação.

## Integração com o MubiSys: identificadores e lacuna concreta

O código local já sincroniza registros úteis:

- `historico_orcamentos` tem `orcNumero`, `clienteId`, status, datas e total. É uma base para contar propostas por número ERP e cliente.
- `historico_os` tem `osNumero`, status, datas de aprovação/faturamento, empresa, telefone e valores (`valorTotal`, `valorOs`, custos/contribuição), mas **não tem `clienteId`** no schema nem no mapeamento atual de `scheduled-sync-historico.ts`.
- `mubisys_vendas_itens` tem `osId`, `osNumero`, item e faturamento por item, mas não `clienteId`.
- Os registros têm chaves únicas por número de proposta/OS (e por item ERP na tabela de vendas), úteis para deduplicação.

**Bloqueio para atribuição confiável:** para ligar uma compra ao mesmo cliente que recebeu a mensagem, não se deve depender do nome livre da empresa ou apenas de telefone. A sincronização de OS precisa carregar e persistir o identificador do cliente do MubiSys, ou fornecer uma ponte confiável `osNumero → clienteId`. O histórico antigo também precisará ser conciliado; ambiguidades devem aparecer como “não atribuído”, sem adivinhação silenciosa.

### Métricas ERP que o painel deve oferecer

- **Propostas geradas**: contagem distinta de `orcNumero`, com status e data visíveis.
- **Pedidos fechados**: contagem distinta de `osNumero` segundo os estados aprovados do MubiSys; cancelamentos/retrabalhos/amostras/cortesias tratados conforme o contrato já usado nos relatórios.
- **Valores**: separar valor aprovado/contratado (`valorOs` ou medida validada) de faturamento efetivamente faturado (`dataFaturamento`/linhas faturadas). Não misturar os dois em um único número chamado “vendas”.
- **Detalhe auditável**: clicar no indicador deve abrir os números de proposta/OS, cliente MubiSys, status, datas e valor considerados.
- **Deduplicação**: contar por número ERP distinto; quando a fonte tem itens, agregar os itens por OS antes de contar/atribuir receita.

## Configurador de custo e ROI

O configurador fica no detalhe do grupo/jornada. O custo é definido por etapa/template, com histórico de vigência. Cada item enviado guarda o custo unitário vigente no momento do disparo; alterar o valor depois não reescreve relatórios passados.

O cálculo operacional proposto é:

```text
custo da etapa = soma(custo unitário congelado × quantidade considerada cobrável)
custo do grupo = soma dos custos das etapas no período
retorno líquido = valor comercial atribuído − custo do grupo
ROI (%) = (retorno líquido ÷ custo do grupo) × 100
```

Quando o custo for zero, o ROI fica “não calculável”, nunca infinito. O painel também deve mostrar receita bruta atribuída separadamente. Como o ERP tem dados de contribuição/margem em alguns registros, é recomendável mostrar **ROI sobre margem/contribuição** além de receita; não tratar faturamento bruto como lucro.

**Decisões que precisam ser fechadas antes de exibir ROI oficial:**

1. O custo cadastrado é por destinatário tentado, aceito pelo provedor ou entregue? Qual status gera cobrança?
2. O proprietário deseja custo somente por template ou também custos fixos da campanha?
3. O indicador oficial de ROI usa faturamento bruto ou margem/contribuição atribuída? Recomendação técnica: mostrar ambos e chamar de ROI apenas o cálculo aprovado.
4. Qual janela depois do contato permite associar proposta e venda à jornada?
5. Quando várias jornadas tocaram o mesmo cliente, qual regra dá crédito: primeiro contato, último contato, divisão de crédito ou “influenciada” sem somar na receita direta?

Até essas decisões serem aprovadas, a interface pode mostrar volumes, custos lançados e receita observada separadamente, mas não deve inventar uma atribuição nem apresentar ROI como fato.

### Proposta inicial para decisão do proprietário (ainda não aplicada)

- Custo por destinatário cujo envio foi aceito pelo provedor, com custo unitário congelado por etapa; ajustar depois com custo real da fatura quando houver integração.
- Mostrar faturamento e contribuição/margem em colunas diferentes; chamar de ROI o retorno calculado sobre contribuição, e exibir “não calculável” se ela faltar.
- Crédito direto único por número ERP: último contato elegível dentro de uma janela aprovada; contatos de outras campanhas podem constar como influência, sem somar o mesmo pedido novamente.
- Opt-out encerra imediatamente; resposta pausa a próxima etapa e pede atendimento/qualificação; venda encerra a sequência de aquisição. Pós-venda permanece como grupo/jornada própria.

Essas propostas não são regra ativa e não serão codificadas sem validação do proprietário.

## Interface no painel de Marketing já existente

`MarketingFinanceiro.tsx` já insere a aba Campanhas WhatsApp ao lado de ROI Marketing. A construção deve evoluir essa aba, mantendo a navegação do produto:

### Visão geral dos grupos

Tabela com grupo, público, status, etapa atual, clientes elegíveis/em espera, próximas execuções, propostas distintas, pedidos distintos, valor atribuído, custo e ROI aprovado. Filtros de período, grupo e etapa precisam afetar todas as linhas e KPIs de forma consistente.

### Detalhe de um grupo

- **Visão geral**: progresso da jornada e resultados agregados.
- **Jornada**: 6–8 cartões numerados, template, condição/data, custo e indicadores de cada etapa.
- **Clientes**: inscrito, identificador ERP, telefone mascarado, etapa, última mensagem, status e motivo de pausa/saída.
- **Resultados MubiSys**: propostas e OS com número ERP, datas, status e valores.
- **Custos e ROI**: custo configurado, custo observado, receita, contribuição, retorno e fórmula aplicada.
- **Histórico**: linha do tempo imutável de eventos do cliente/grupo/etapa.

### Resultado por mensagem

Cada etapa deve distinguir: planejadas, tentadas, aceitas pelo provedor, entregues, lidas, respondidas, falhas e incertas. “Enviada” nunca deve ser apresentada como “entregue”. Propostas/pedidos associados aparecem por número ERP e não como uma atribuição presumida.

## Fases de implementação

### Fase 1 — Contrato de dados e regras

- Confirmar campos/IDs do MubiSys, estados que significam proposta, pedido fechado, cancelamento e faturamento.
- Fechar as cinco decisões de ROI/cobrança/janela/atribuição acima e as regras de continuação da sequência após resposta, compra, cotação ou atendimento humano/IA.
- Preservar o painel e os históricos atuais; registrar mapeamento de dados existente.

### Fase 2 — Grupos e construtor de jornada

- Exibir “Grupo” como conceito de negócio sem trocar o ID atual da campanha.
- Criar versões de jornada e construtor de 6–8 etapas/template por grupo.
- Criar inscrições com estágio atual e critério de entrada/saída; não enviar ainda pela nova sequência.
- Validar formulário, salvamento, edição, pausa e reload com banco descartável.

### Fase 3 — Execução segura por etapa

- Vincular cada disparo a uma etapa/inscrição e preservar o resultado por destinatário.
- Adicionar idempotência/reserva contra corrida, revalidação de opt-out/cadência/pausa antes de cada destinatário e tratamento de status incerto.
- Testar mocks do provedor, duplicidade concorrente, pausa durante lote, falha depois do aceite e recuperação manual.

### Fase 4 — Reconciliação MubiSys

- Persistir `clienteId` nas OS sincronizadas e definir ponte para histórico legado.
- Correlacionar proposta/OS por ID ERP; deduplicar por `orcNumero`/`osNumero`.
- Exibir lista de números ERP e relatórios de grupo/etapa em ambiente isolado. Itens sem identidade confiável ficam sem atribuição.

### Fase 5 — Custos, ROI e homologação visual

- Configurar custo por etapa/template com valor efetivo versionado e snapshot por envio.
- Implementar os cálculos aprovados e drill-down para os números ERP que sustentam cada total.
- Validar sequência completa e métricas com dados sintéticos, provedor mockado e PostgreSQL descartável; depois preparar uma demonstração no painel verdadeiro.

Nenhuma fase inclui migration em banco persistente, envio real, push, merge ou deploy sem autorização específica.

## Evidências de código usadas para este desenho

- `client/src/pages/financeiro/MarketingFinanceiro.tsx` — a aba Campanhas WhatsApp já está no painel de Marketing.
- `client/src/pages/financeiro/MarketingCampanhasWhatsapp.tsx` — cadastro, ações e abas atuais.
- `client/src/pages/financeiro/campanhasWhatsapp/RelatorioPeriodo.tsx` — relatório operacional atual, sem métricas financeiras por campanha.
- `server/routers/campanhasWhatsapp.ts` e `server/services/campanhasWhatsapp.ts` — audiência, cadência, opt-out, disparo e pós-venda.
- `server/sync/scheduled-sync-historico.ts` — sincroniza `clienteId` em orçamento, mas o mapeamento de OS não o grava.
- `drizzle/schema.ts` — tabelas atuais de campanhas, propostas, OS e itens faturados do MubiSys.
- `docs/campanhas-whatsapp.md` — regras e limitações do módulo registradas ao longo da configuração.
