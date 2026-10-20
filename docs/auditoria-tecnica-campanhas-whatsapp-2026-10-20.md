# Auditoria técnica do módulo Campanhas WhatsApp

**Data da auditoria:** 20/10/2026

**Escopo:** código ativo do repositório, documentação, schema/migrations, testes versionados e referências Git locais disponíveis.

**Branch auditada:** `codex/marketing-financeiro-metricas`, commit `e4f206b`, limpa e acompanhando `origin/codex/marketing-financeiro-metricas`.
**Base remota observada:** `origin/main` em `255476f`.

> Esta é uma auditoria e um plano. Não foram alterados código de aplicação, schema, migrations ou dados; não houve disparos, chamadas a serviços externos, consulta ao banco de produção ou execução de testes. O único artefato desta etapa é este documento. A presença de código comprova que há uma implementação no repositório, não que o fluxo esteja configurado ou funcionando em produção.

## 1. Resumo para decisão

O módulo atual já administra campanhas e públicos, controla cadência/quarentena, registra opt-out manual, envia templates pelo provedor Ceci.Chat/WTS.Chat, mantém histórico de disparos, consulta alguns status por destinatário sob demanda e exibe um relatório operacional simples por período. As fontes automáticas usam o histórico local sincronizado do MubiSys. Há também exportação XLSX das listas de contatos.

O relatório visível no branch baseado em `main` não é um relatório de resultado comercial. Ele mede estado atual das campanhas e registros de envio. Não recebe respostas dos clientes, não associa respostas a botões ou a uma campanha com certeza, não calcula conversão, vendas atribuídas, receita, margem ou ROI. O campo “Mensagens enviadas” é baseado no registro/aceite do lote, e não numa confirmação de entrega da Meta.

Existe código mais avançado de IA, heatmap, análise de conversas, atribuição de receita, retargeting e PDF em `origin/publish/estoque-perfis`. Esse código foi commitado e enviado para uma branch remota, mas não está integrado a `main` nem à branch auditada. A branch depende de configuração externa do webhook e de processamento agendado; sua documentação declara que o webhook real da Ceci.Chat ainda não estava apontado para o endpoint. Além disso, ela diverge de `main` e cria uma migration `0115` diferente da migration `0115` já existente em `main`, então não deve ser mesclada sem reconciliação e revisão do journal de migrations.

**Conclusão:** existe uma base operacional para campanhas, mas o produto descrito nos requisitos ainda não está completo. O Robô Auditor pode começar como catálogo e plano de testes; a automação de auditoria com bloqueio de publicação depende primeiro de testes frontend, simulação integrada, definição dos eventos do provedor e CI que rode verificações críticas.

## 2. Método, limites e grau de certeza

Foram lidos os arquivos do módulo, serviços e rotas relevantes, documentação atual, schema e migrations, testes de campanhas e de integração, configuração de build/deploy e referências Git locais. Não foram lidos valores de segredos.

| Fonte de evidência | O que confirma | O que não confirma |
|---|---|---|
| Código e schema na branch auditada | Procedimentos, telas, validações e persistência implementados no código versionado | Configuração de secrets, estado real do banco ou sucesso do provedor |
| Testes versionados | Cenários automatizados escritos para regras e integração simulada | Resultado atual dos testes; eles não foram executados nesta auditoria |
| Documentação do módulo | Decisões e limitações registradas pelo projeto | Que o comportamento documentado continua igual ao ambiente publicado |
| Referências `origin/*` já existentes no clone | Commit e diferenças de branches conhecidos localmente | Estado instantâneo do GitHub ou produção se não houver novo fetch/consulta externa |
| `vercel.json` e scripts | Comando de build/migration configurado no repositório | Qual commit está publicado, saúde do deployment ou secrets da Vercel |

Classificação usada no catálogo:

- **Implementado no branch auditado:** existe fluxo de código no branch atual; ainda pode depender de configuração ou validação em execução.
- **Parcial:** há uma parte do requisito, mas faltam cobertura, persistência, integração ou precisão para afirmar que ele foi atendido.
- **Outra branch:** há evidência de código em uma branch remota separada, sem integração com `main`.
- **Ausente:** não foi encontrada implementação suficiente nos branches examinados.
- **Não verificado:** exige teste em ambiente real ou acesso externo que não foi usado nesta etapa.

## 3. Inventário do projeto e arquitetura do módulo

### 3.1 Stack encontrada

| Camada | Tecnologia observada |
|---|---|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4, tRPC React Query e componentes internos |
| Backend | Node.js, Express 4, TypeScript, tRPC 11 e Zod |
| Banco | PostgreSQL/Neon, Drizzle ORM; mudanças estruturais versionadas em `drizzle/` |
| Autenticação | Better Auth local; acesso do módulo protegido também por role no servidor |
| ERP | Cliente HTTP MubiSys e histórico local de OS/orçamentos; há sincronização/backfill de telefones |
| Envio WhatsApp | API Ceci.Chat/WTS.Chat. O código ativo não faz chamada direta à Meta Graph API |
| Arquivos | UploadThing e parser de CSV/XLS/XLSX/XML |
| IA no branch auditado | Assistente de geração de texto de campanha via `invokeLLM`; não analisa respostas recebidas |
| IA na branch separada | Gemini para qualificação de respostas, sem tráfego real confirmado pela integração descrita |
| Testes | Vitest; suítes backend de regras, banco, fontes e cliente WTS. Não foi encontrado teste frontend dedicado a Campanhas |

### 3.2 Caminho funcional existente

```text
Histórico local MubiSys (OS/orçamentos) ─┐
Arquivos/listas CSV, Excel ou XML ─────────┼─> fontes e higienização da audiência
Cadastro local de opt-out ────────────────┤   (telefone normalizado, duplicidade,
Quarentena/cadência ──────────────────────┘    validade e elegibilidade)
                                                │
                                                v
CampanhasWhatsapp.dispararWts ──> Ceci.Chat/WTS.Chat ──> template WhatsApp aprovado
            │                               │
            ├── registra lote/telefones       └── ID/status do provedor, quando retornado
            └── histórico e cadência                         │
                                                             v
                                         consulta de status manual/sob demanda
```

Na versão de `main`, respostas dos clientes ficam no atendimento da Ceci.Chat. Não foi encontrada rota ativa que receba essas respostas no Radrasys. O webhook de entrada e o classificador de IA aparecem somente em `origin/publish/estoque-perfis`.

### 3.3 Interfaces e comportamentos comprovados no código

- Cadastro, edição, duplicação, pausa/arquivamento e exclusão de campanhas; categorias editáveis; tipo recorrente ou gatilho de pós-venda; frequência, quarentena, período de apuração e ID de template.
- Dez segmentos automáticos calculados sobre histórico local do ERP: clientes ativos, primeira compra, cinco ou mais compras recentes, inativos, orçamento não ganho, clientes de compra única, novos do mês, reativados do mês e redução de volume. Também aceita fonte externa por arquivo e arquivos anexados à campanha.
- Prévia da audiência separa aptos, quarentena, sem telefone/inválidos e repetidos. A lista de contatos tem exportação `.xlsx`; o arquivo é gerado no navegador.
- Opt-out pode ser cadastrado manualmente em uma lista por telefone, com nome/motivo opcionais. O módulo exclui essa lista das audiências de campanha e do fluxo de envio nativo.
- Envio nativo pelo template da campanha, até 100 destinatários por clique, em sequência com intervalo de 1,2 segundo. A documentação registra um teste manual anterior que motivou o envio sequencial.
- Calendário de previsão de cadência e planner manual. “Agendar” registra um lembrete; não inicia um disparo automático. O usuário marca o lembrete como disparado ou não disparado.
- Histórico de lotes e diálogo “Ver envios”. Para disparos nativos, guarda os destinatários aceitos e IDs reconhecidos; consulta até dez status após o envio e permite nova consulta manual. Lotes antigos e lotes de outras origens podem precisar ser preenchidos manualmente.
- Assistente de IA de texto sugere scripts para copiar. Ele não lê mensagens de clientes, não atribui classificação aos leads e não alimenta o relatório.

### 3.4 Relatório existente e semântica dos indicadores

Arquivo de tela: `client/src/pages/financeiro/campanhasWhatsapp/RelatorioPeriodo.tsx`.
Procedure: `campanhasWhatsapp.relatorioPeriodo` em `server/routers/campanhasWhatsapp.ts`.

| Indicador/área | Como o código calcula | Limitação que afeta a interpretação |
|---|---|---|
| Campanhas ativas | Conta campanhas cujo status atual é `ativa` | Não reconstrói quais estavam ativas dentro do período escolhido |
| Campanhas inativas | Conta status atual diferente de `ativa` | Junta pausadas e arquivadas; também não é histórico do período |
| Contatos alcançados | `COUNT(DISTINCT telefone)` nas linhas de histórico cujo `ultimo_envio_em` cai no intervalo | A tabela guarda uma linha por campanha+telefone; a query não calcula o último envio global por telefone. Um número pode contar se uma campanha tem linha no período mesmo que outra campanha tenha contato posterior fora do período |
| Disparos realizados | Número de registros em `campanhas_whatsapp_disparos` com data no período | Mede lotes registrados, não eventos de envio entregues pela Meta |
| Mensagens enviadas | Soma de `contatos_enviados` dos registros do período | Mede contatos registrados/aceitos pelo provedor ou fluxo operacional, não confirmação de entrega/leitura |
| Tabela por campanha | Categoria, lotes, contatos registrados e agendamentos no período | Não exibe funil, taxas, conversão, receita ou comparação de eficácia |
| Agenda no relatório | Exibe planejamentos e permite marcá-los como feitos/não feitos | É planejamento manual independente do registro de envio; não é agendador |
| Datas | Atalhos mês atual, mês anterior, últimos 30 dias, ano atual e intervalo manual | Backend rejeita intervalo invertido e diferença superior a 366 dias |

Na tela atual não há exportação do relatório, PDF, resumo executivo, comparativo por família, resposta, interesse, rejeição ou receita atribuída. A exportação XLSX comprovada é da audiência/lista de contatos, não deste relatório de período.

## 4. Banco de dados e relacionamentos

O schema ativo é PostgreSQL em `drizzle/schema.ts`. Entre as tabelas do módulo estão:

| Tabela | Uso observado | Relações e limites |
|---|---|---|
| `campanhas_whatsapp_categorias` | Categorias editáveis | A campanha guarda chave/categoria como texto; validação ocorre no servidor |
| `campanhas_whatsapp` | Configuração, tipo, status, frequência, template e período | Pai de disparos, agenda, scripts, arquivos, fontes e histórico por campanha |
| `campanhas_whatsapp_disparos` | Um registro por lote/data, contagem e origem | Não equivale a um evento Meta por mensagem |
| `campanhas_whatsapp_quarentena` | Último contato global dentro do módulo | Uma linha por telefone; não é alimentada pelo CRM e Retenção no branch atual |
| `campanhas_whatsapp_optout` | Blacklist manual por telefone | Telefone único, motivo/data; não guarda origem/campanha que gerou o pedido |
| `campanhas_whatsapp_gatilhos` | OS já contatadas em campanhas de pós-venda | Unicidade por campanha+OS; não faz atribuição financeira entre campanhas |
| `campanhas_whatsapp_scripts` | Textos de mensagem armazenados | Soft delete e contador de cópias |
| `campanhas_whatsapp_arquivos` | Referências a arquivos no UploadThing | Arquivo pode estar solto ou ligado a campanha |
| `campanhas_whatsapp_fontes` | Segmentos ERP ou arquivos reutilizáveis | Relação N:N com campanhas via `campanhas_whatsapp_campanha_fontes` |
| `campanhas_whatsapp_contatos_historico` | Último envio por campanha+telefone | Não é histórico de cada tentativa e não oferece sozinho identidade global |
| `campanhas_whatsapp_disparo_itens` | Um item por destinatário de lote e campos do status do provedor | ID/status pode faltar em lote antigo ou de outra origem |
| `campanhas_whatsapp_agendamentos` | Plano manual de envio por campanha/data | Sem vínculo automático com o lote que de fato ocorreu |

As migrations do módulo estão distribuídas desde `0045` (fundação) até `0053` (fontes), com ajustes posteriores como `0105_campanhas_wts_template_id.sql` e `0115_classy_mattie_franklin.sql` para detalhar itens/status do disparo. O journal atual de `main` termina em `0115`.

**Entidades que não foram encontradas no schema ativo de `main`:** mensagens recebidas; eventos de status recebidos por webhook; cliques de botão/lista; classificação de lead; histórico de sentimento/intenção; atribuição de venda por toque; custo e margem por campanha; experimentos A/B; histórico de auditorias do Robô Auditor.

## 5. Mapa da integração com o MubiSys

| Fluxo | Evidência no repositório | Estado que se pode afirmar |
|---|---|---|
| Histórico de OS | `historico_os`, sincronização do ERP e funções em `server/services/fontesErpCampanhas.ts` | Segmentos e pós-venda consultam dados locais sincronizados, não necessariamente a API em cada leitura |
| Histórico de orçamentos | `historico_orcamentos` e fonte “Orçaram e não compraram” | Pode alimentar audiência; não foi encontrada atribuição posterior da proposta à campanha |
| Cadastro de clientes/telefone | `server/sync/clientes-mubisys.ts`, cache local de clientes e operações de completar telefone | Há atualização/backfill para enriquecer contatos; disponibilidade da API e secrets não foi verificada |
| Normalização | `shared/campanhas-whatsapp.ts` e testes de `normalizarTelefone` | Normaliza telefones brasileiros com DDI 55, máscara e ajuste de celular antigo conforme a regra do módulo |
| Identidade do ERP | `construirBaseComTelefone` agrupa OS pelo nome empresarial normalizado e escolhe telefone conhecido | Telefone é a chave de envio/cadência, mas identidade de empresa e dados históricos ainda dependem de nome/telefone disponível |
| Campanhas→OS | `campanhas_whatsapp_gatilhos` guarda OS usadas no pós-venda | Controla recontato da mesma OS na campanha; não prova que uma venda aconteceu por causa do disparo |
| Receita/OS após o disparo | Não há relatório correspondente em `main` | Atribuição de receita está somente na branch avançada e usa uma janela temporal; a relação causal não foi verificada |

O backfill descrito em `docs/campanhas-whatsapp.md` é necessário porque o telefone não está presente em todo o histórico antigo. A associação entre telefone atual, telefone de outro vendedor e cadastro que entrou posteriormente no ERP não tem um mapa de identidades com trilha de aprovação no branch auditado.

## 6. Mapa de eventos WhatsApp/Meta

| Evento/etapa | Evidência ativa em `main` | Resultado da auditoria |
|---|---|---|
| Envio de template aprovado | `server/integrations/wts-chat-client.ts`: POST para Ceci.Chat, com fallback WTS.Chat e ID salvo na campanha | Há integração com provedor; não há chamada direta à Graph API da Meta |
| Aceite/enfileiramento | Resposta HTTP/corpo do provedor analisados; recusas em corpo 2xx podem ser detectadas | Aceite não confirma que o aparelho recebeu a mensagem |
| ID de mensagem e status | ID/status URL são salvos quando reconhecidos; `consultarEstadoMensagemWts` consulta o provedor | Estados crus incluem, por exemplo, `QUEUED`, `SENT`, `DELIVERED`, `READ` e `FAILED`; consulta é manual/sob demanda, não webhook de evento |
| Resposta do cliente | Atendimento segue na caixa de entrada da Ceci.Chat | Não há ingestão ativa para o Radrasys no branch auditado |
| Botão/lista interativa | Nenhum rastreador ativo no branch auditado | Só existe parser de entrada em branch separada; não se verificou contrato real da Ceci nem captura de ID de botão |
| Pedido “pare/não receber” por mensagem | A lista de opt-out é alimentada manualmente | Não há detector de palavra-chave/resposta nem exclusão automática originada da conversa |

As rotas REST ativas do módulo são `POST /api/v1/campaigns/:id/log-send` e `POST /api/v1/contacts/check-quarantine`, protegidas por `CAMPANHAS_API_KEY`. `log-send` registra um envio que já aconteceu; não é callback da Meta. `check-quarantine` consulta quarentena, não é um endpoint de supressão global.

## 7. Git, branches e publicação

Estado observado nas referências disponíveis no clone:

| Referência | Estado observado | Consequência |
|---|---|---|
| Branch atual `codex/marketing-financeiro-metricas` | Limpa; `e4f206b` está em `origin/codex/marketing-financeiro-metricas`, sobre `origin/main` `255476f` | Commit atual trata de métricas do módulo Marketing Financeiro, não das funcionalidades avançadas de Campanhas |
| `origin/main` | Último commit localmente conhecido `255476f` | Inclui o relatório básico e os últimos ajustes de envio/status já incorporados em `main` |
| `origin/publish/estoque-perfis` | 7 commits à frente e 4 atrás de `origin/main`, conforme refs locais | Tem recursos avançados de Campanhas, porém ainda separados e com divergência de banco/schema |
| `codex/wts-chat-diagnostics` local | 8 commits à frente e 1 atrás do tracking remoto da própria branch | Há 5 commits locais não presentes em `origin/main`: 3 correções/envio de Campanhas (`0bb69a3`, `e634385`, `5b1d0d2`) e 2 commits de Guia de Fornecedores. Nenhum foi publicado em `origin/main` nas refs observadas |
| `origin/codex/wts-chat-diagnostics` | Ainda tem um commit de cronômetro/status anterior que não aparece em `origin/main` (`5a22a53`) | Branch de trabalho antiga; não deve ser tratada como o código publicado em `main` |
| Vercel/produção | `vercel.json` aponta build `yarn db:migrate && yarn build:client && yarn build:api` | Commit de produção, variáveis de ambiente e saúde atual do deployment não puderam ser confirmados |

Não existe diretório `.github/workflows` neste clone. O comando de build da Vercel não executa `yarn test` nem `yarn run check`; portanto, este repositório não comprova um bloqueio automático de publicação por testes críticos. Isso não exclui a possibilidade de regra configurada diretamente no provedor Git/Vercel, que não foi consultada.

### 7.1 Recursos avançados presentes apenas em `origin/publish/estoque-perfis`

| Commit | Recurso visível na branch |
|---|---|
| `a57d029` | Qualificação de leads por IA, webhook de mensagens e debounce |
| `4a0e461` | Audiência dinâmica de retargeting criada a partir de leads qualificados |
| `f50d7f3` | Resumo executivo por IA, atribuição temporal de receita e lead velocity |
| `d9ab11b` | PDF técnico e script de geração |
| `66007fe` | Unificação de quarentena entre Campanhas, CRM e Retenção |
| `cf8ba10` | Cache em memória do contexto ERP para campanhas |
| `fe74015` | Regras de cadência em calendário, incluindo fim de mês/dia fixo |

A própria documentação da branch registra dependências ainda externas: configurar a Ceci.Chat para enviar mensagens recebidas a `/api/v1/campaigns/whatsapp-inbound`, configurar um cron para chamar `/api/v1/campaigns/process-buffers` e disponibilizar `GEMINI_API_KEY`. A documentação dessa branch também relata que o endpoint de entrada ainda não recebia tráfego real. O relatório/PDF nessa branch é um artefato e script versionados, não prova de geração automática no sistema atualmente publicado.

**Risco de integração alto:** `main` contém `drizzle/0115_classy_mattie_franklin.sql`; a branch avançada contém migrations diferentes `0115_redundant_vision.sql` até `0118_gorgeous_bill_hollister.sql`. As duas linhas de trabalho reivindicam a numeração `0115`. O journal e o SQL precisam ser reconciliados a partir da ponta atual de `main` antes de qualquer merge/deploy. Não aplicar a sequência da branch diretamente em produção.

## 8. Testes, logs e monitoramento

### Testes encontrados

- `server/__tests__/campanhas-whatsapp.test.ts`: normalização de telefone, datas, cadência, higienização, pós-venda e contratos REST.
- `server/__tests__/campanhas-whatsapp-db.test.ts`: procedimentos com banco para campanhas, fontes, categorias, disparos, calendário, relatório e opt-out.
- `server/__tests__/fontes-erp-campanhas.test.ts`: regras das fontes ERP.
- `server/__tests__/wts-chat-client.test.ts`: formato de requisição, respostas, estados e falhas do cliente WTS/Ceci.
- Testes extras de MubiSys/telefone e campanhas em outros módulos também existem, mas não substituem validação de atribuição financeira ou de integração de ponta a ponta.
- Não foi encontrado arquivo de teste de componente/página para o relatório ou telas de Campanhas.
- `server/__tests__/mubisys.test.ts` contém teste de contrato de rede condicionado por `describe.skipIf(!rodarContrato)`; portanto, a integração real pode ser pulada sem configuração explícita.
- Não foi encontrada suíte de simulação integral de campanha, clique interativo, webhook real de entrada, supressão em todos os canais ou cálculo financeiro de Campanhas.

### Logs e observabilidade

O módulo persiste lotes, destinatários detalhados de parte dos envios e o último status consultado. A API pode registrar erros no log do servidor. Não foi encontrado no branch auditado um histórico estruturado de eventos inbound, correlação de ponta a ponta, alertas de falha do webhook, painel de saúde do provedor ou trilha de auditoria própria do módulo. O status do provedor pode estar desatualizado até alguém consultar novamente.

**Execução de testes nesta etapa:** nenhuma. Assim, as suítes listadas são evidência de testes escritos, não de aprovação atual.

## 9. Riscos e lacunas prioritárias

1. **Supressão incompleta entre canais:** o opt-out vale para listas nativas de Campanhas, mas a documentação ativa diz que CRM e Retenção não alimentam a mesma quarentena. O endpoint externo `check-quarantine` tampouco retorna a lista de opt-out. Um disparador externo pode, portanto, não conhecer a supressão.
2. **Envio não é entrega:** HTTP 200/`QUEUED` é aceite do provedor; não é confirmação do aparelho. A consulta é sob demanda e os lotes antigos podem não ter ID por destinatário.
3. **Sem ingestão de respostas em `main`:** não existe base para taxas de resposta/interesse, bot/humano, tempo de atendimento, interação ou classificação.
4. **Identidade ambígua:** a audiência ERP agrupa OS por nome empresarial normalizado e usa telefone disponível. Mudança de telefone ou WhatsApp de vendedor não tem associação segura versionada.
5. **Relatório operacional tem semântica limitada:** status atual aparece em filtro de datas; `contatos alcançados` não calcula o último envio global; `mensagens enviadas` não distingue aceite, entrega e leitura.
6. **Atribuição causal não comprovada:** associar uma OS por proximidade de datas/telefone é indício, não prova de que a campanha gerou a venda. Recompra e vendas assistidas exigem regras de deduplicação explícitas.
7. **Branch avançada sem integração e sem tráfego real:** o código de IA e relatório avançado não aparece em `main`; webhook/job externo precisam ser habilitados e testados.
8. **Conflito de migrations:** numeração `0115` divergente entre `main` e a branch avançada pode fazer migration ser rejeitada ou aplicada fora de sequência; o journal deve ser regenerado/reconciliado.
9. **Publicação sem gate verificável:** o build configurado não roda as suítes nem o typecheck; não há workflow do GitHub no clone que prove bloqueio por falha crítica.
10. **Produção não verificada:** não se confirmou deployment, secrets, estado do banco, canal configurado ou eventos reais do provedor.

## 10. Plano de implementação por fases

Estimativas qualitativas são de esforço/risco, não de calendário. Antes das fases, a branch avançada deve ser revisada contra `main` e seu schema/migrations reconciliados.

| Fase | Entrega e critério de conclusão | Dependências principais | Complexidade |
|---|---|---|---|
| 0. Fechamento de contrato e integração | Confirmar o payload real de entrada e status da Ceci; fixar semântica dos KPIs; decidir a fonte única de supressão; reconciliar migrations e branch | Acesso/contrato do provedor, revisão do banco | Média |
| 1. Identidade, eventos e supressão | Ingestão idempotente de envio/status/resposta/botão; mapa telefone↔cliente aprovado; opt-out automático e bloqueio antes de qualquer fluxo promocional | Fase 0, migrations compatíveis, segredo/webhook/cron | Muito alta |
| 2. Qualificação de conversa | Separar bot/humano, polaridade, intenção, ICP, objeções, perfil e profundidade; persistir confiança/evidência e permitir revisão humana | Fase 1, política de dados, provedor de IA | Alta |
| 3. Vínculo ERP e atribuição financeira | Resolver lead→cliente→orçamento→OS; contabilizar primeira compra/recompra e janelas; impedir dupla atribuição; explicitar custo e limitações de margem/ROI | Fases 1–2, regras financeiras e IDs ERP confiáveis | Muito alta |
| 4. Relatórios comerciais | Dashboard e funil, comparação de campanha/família, eficácia por tentativa, segmentos, atendimento, financeiro, exportação e retargeting com filtros/supressão | Dados estáveis das fases 1–3 | Alta |
| 5. Robô Auditor e gate | Catálogo versionado, suíte backend/frontend/integração/simulação, histórico de auditorias, painel e relatórios simples/técnicos; CI impede publicar quando um teste crítico falhar | Requisitos e dados das fases anteriores; pipeline CI/CD | Alta |

### 10.1 Plano de testes recomendado

1. **Unidade backend:** telefone e identidade, idempotência, opt-out, quarentena, estado de mensagem, classificação e cálculo financeiro.
2. **Banco/migrations:** relações e unicidade, repetição de webhooks, deduplicação de OS/venda, compatibilidade de migrations da branch sobre o último snapshot de `main`.
3. **Integração com provedor em sandbox:** payload real, aceite/erro HTTP, callbacks repetidos, status atrasado, falhas e retries; nunca usar listas reais para simulação.
4. **Simulação controlada:** contatos fictícios, campanha sem envio real, fluxos de opt-out, cliques, resposta bot/humana e tentativa 1/2/N.
5. **Frontend:** filtros/data, KPIs versus fixture conhecida, tabelas, XLSX, acessibilidade básica e mensagens de falha/sem dados.
6. **MubiSys:** fixtures versionadas e teste de contrato explicitamente habilitado; validar paginação, telefone ausente, telefone alterado, orçamentos e OS duplicadas.
7. **Regressão:** cadência, limite sequencial, disparo manual/API, opt-out, fontes ERP/arquivo, histórico e calendário.
8. **Financeiro:** regra de atribuição documentada; casos de primeira compra, recompra, várias campanhas, venda sem contato confirmado, custos desconhecidos e ausência de margem.
9. **Gate de release:** `yarn run check`, suíte relevante e migrações em banco de teste devem ser checks obrigatórios antes do deploy. A Vercel hoje não mostra esses comandos no `buildCommand` observado.

## 11. Catálogo permanente de requisitos e critérios de aceite

Os IDs `CAMP-001` a `CAMP-074` são identificadores permanentes para esta lista; não reutilizar números se o requisito mudar. “Outra branch” significa código não integrado ao branch auditado. Os critérios abaixo definem quando cada item poderá ser considerado aceito; estar parcial/na branch não equivale a aceite.

### A. Disparos e engajamento

| ID | Req. | Estado observado | Critério mínimo de aceite |
|---|---:|---|---|
| CAMP-001 | 1 | Parcial | Cada mensagem deve ter estados de enviada, entregue e lida quando disponíveis, com origem, data/hora, idempotência e indicador que diferencie ausência de evento de falha. |
| CAMP-002 | 2 | Outra branch | Registrar resposta interativa/botão/lista recebida com telefone, campanha candidata, mensagem de origem e timestamp; validar payload real do provedor. |
| CAMP-003 | 3 | Outra branch/parcial | Persistir ID e rótulo do botão escolhido; teste deve provar que dois botões distintos não viram o mesmo evento. |
| CAMP-004 | 4 | Ausente | Pedido de saída recebido deve gravar opt-out automaticamente, normalizar telefone e impedir envios promocionais posteriores. |
| CAMP-005 | 5 | Parcial | Uma fonte central de supressão deve ser consultada pelo envio nativo, CRM, Retenção e APIs externas antes de qualquer envio. |
| CAMP-006 | 6 | Ausente | Relatório deve mostrar por campanha os bloqueios/exclusões, motivo e data, sem tratar quarentena como pedido de saída. |
| CAMP-007 | 7 | Parcial | Para cada telefone, exibir tentativas históricas completas por campanha, inclusive origem e resultado, não apenas o último contato. |
| CAMP-008 | 8 | Ausente | Marcar primeira tentativa que gerou sinal comercial e mostrar número ordinal, evidência e regra de classificação. |
| CAMP-009 | 9 | Outra branch/parcial | Medir tempo entre envio elegível, resposta do cliente e primeiro atendimento humano; deixar nulos quando origem/horário não forem confiáveis. |
| CAMP-010 | 10 | Outra branch/parcial | Heatmap deve agregar eventos reais de resposta/interação por dia e hora, com fuso explícito e filtro por campanha/período. |
| CAMP-011 | 11 | Parcial | Exibir taxas com denominadores definidos para resposta, interesse e rejeição; mensagens sem classificação não podem ser silenciosamente contadas como negativas. |

### B. Inteligência artificial

| ID | Req. | Estado observado | Critério mínimo de aceite |
|---|---:|---|---|
| CAMP-012 | 12 | Outra branch/parcial | Classificar ausência/menu/automação com tipo, evidência e confiança; validar mensagens curtas, menus e variações de texto. |
| CAMP-013 | 13 | Outra branch/parcial | Usar latência apenas como indício combinado com outros sinais; documentar limiar e não concluir “bot” só por resposta rápida. |
| CAMP-014 | 14 | Outra branch/parcial | Separar mensagem humana de automática com confiança e permitir correção humana registrada. |
| CAMP-015 | 15 | Ausente | Classificar explicitamente positiva, negativa, neutra ou incerta; cobrir todos os resultados e falhas do provedor de IA em teste. |
| CAMP-016 | 16 | Outra branch/parcial | Definir interesse comercial por evidência citável e permitir revisão; testar falso positivo, falso negativo e caso ambíguo. |
| CAMP-017 | 17 | Outra branch/parcial | Produzir intenção de compra em categorias definidas e gravar confiança; separar intenção de score ICP. |
| CAMP-018 | 18 | Outra branch | Gerar clusters versionados e explicáveis; distribuição do dashboard deve fechar com o total de leads classificados. |
| CAMP-019 | 19 | Outra branch | Classificar perfil do interlocutor com opção desconhecido e evidência da conversa; não inferir dados pessoais sem suporte. |
| CAMP-020 | 20 | Outra branch | Extrair tipo e resumo de objeção com referência à fala original e opção explícita “nenhuma/incerta”. |
| CAMP-021 | 21 | Outra branch | Calcular ICP em escala documentada, reproduzível e independente de intenção; incluir fatores que formaram a pontuação. |
| CAMP-022 | 22 | Outra branch/parcial | Manter score de intenção separado do score ICP e testar que variar um não altera automaticamente o outro. |
| CAMP-023 | 23 | Outra branch | Filtro de lead quente deve usar limiar configurável/documentado, persistir filtros e respeitar supressão antes de retargeting. |
| CAMP-024 | 24 | Outra branch/parcial | Profundidade deve contar turnos da conversa por regra definida; testar conversa curta, longa, duplicada e incompleta. |
| CAMP-025 | 25 | Outra branch | Diagnóstico deve apresentar evidências, limitações e recomendações acionáveis sem afirmar causalidade não observada. |

### C. Integração com MubiSys

| ID | Req. | Estado observado | Critério mínimo de aceite |
|---|---:|---|---|
| CAMP-026 | 26 | Parcial | Usar telefone normalizado como chave inicial do lead e preservar a origem do dado, sem exigir CNPJ na primeira prospecção. |
| CAMP-027 | 27 | Parcial | Normalizar números e associá-los a cadastro/lead com trilha de origem, conflitos detectáveis e sem fundir pessoas por coincidência de telefone. |
| CAMP-028 | 28 | Ausente | Quando lead externo entrar no ERP, reconhecer o vínculo com histórico verificável e sem duplicar lead, mesmo após sincronização tardia. |
| CAMP-029 | 29 | Parcial | Relacionar lead a cadastro de cliente por ID estável ou associação humana aprovada; mostrar confiança e permitir desfazer. |
| CAMP-030 | 30 | Parcial | Associar propostas/orçamentos por ID e telefone/cliente com trilha de evidência; não inferir vínculo apenas pelo nome aproximado. |
| CAMP-031 | 31 | Parcial | Associar OS por identificador e registrar cliente, datas e campanha candidata; cobrir OS sem telefone e OS repetida. |
| CAMP-032 | 32 | Outra branch/parcial | Contabilizar somente venda confirmada segundo status/ID do MubiSys; separar status aprovado, faturado, cancelado e não confirmado. |
| CAMP-033 | 33 | Outra branch/parcial | Calcular quantidade de vendas e conversão por campanha com denominador de contatos elegíveis explicitado e sem dupla contagem. |
| CAMP-034 | 34 | Outra branch/parcial | Somar faturamento atribuído por regra documentada e permitir auditar quais OS compõem cada total. |
| CAMP-035 | 35 | Outra branch/parcial | Ticket médio deve ser receita atribuída dividida pelo número de vendas atribuídas, com caso de zero vendas testado. |
| CAMP-036 | 36 | Outra branch/parcial | Mostrar custo estimado separado do custo real; origem do custo e ausência de dado devem ficar visíveis. |
| CAMP-037 | 37 | Outra branch/parcial | Calcular margem de contribuição/ROI com fórmula e custo confiáveis; bloquear ou sinalizar cálculo quando faltar margem/custo. |
| CAMP-038 | 38 | Parcial | Identificar primeira compra, recompra e reativação no relatório por cliente deduplicado, com período e regra explícitos. |
| CAMP-039 | 39 | Outra branch/parcial | Diferenciar receita direta, assistida e temporal por regra de atribuição; permitir inspecionar toques e janela usados. |
| CAMP-040 | 40 | Ausente | Cada venda deve ser atribuída no máximo uma vez no total e a regra de crédito entre campanhas deve ser reproduzível. |

### D. Relatórios e gestão comercial

| ID | Req. | Estado observado | Critério mínimo de aceite |
|---|---:|---|---|
| CAMP-041 | 41 | Parcial | Dashboard executivo deve resumir resultado comercial e operacional por campanha, explicando fonte, período e limitações de cada KPI. |
| CAMP-042 | 42 | Ausente | Funil deve mostrar totais e conversões entre envio, entrega, resposta, interesse, proposta e venda, com totais reconciliáveis. |
| CAMP-043 | 43 | Parcial | Comparar campanhas/famílias em períodos equivalentes, com taxa e volume e sem misturar denominadores diferentes. |
| CAMP-044 | 44 | Ausente | Relacionar resultado comercial à tentativa ordinal 1, 2, … com amostra e taxa de cada tentativa. |
| CAMP-045 | 45 | Outra branch/parcial | Mostrar qualidade e profundidade por campanha com distribuição de classes, turnos e confiança da análise. |
| CAMP-046 | 46 | Outra branch/parcial | Relatório financeiro deve reconciliar vendas/OS, receita, custos e margem com detalhamento auditável. |
| CAMP-047 | 47 | Parcial | Mostrar recompra atribuída e não atribuída, quantidade de clientes e receita por coorte/período. |
| CAMP-048 | 48 | Parcial | Permitir comparar resultado por segmento, cluster e perfil, incluindo tamanho da audiência e conversão. |
| CAMP-049 | 49 | Outra branch/parcial | Medir resposta e atendimento humano por tempo/SLA, fila e desfecho sem confundir bot com vendedor. |
| CAMP-050 | 50 | Ausente | Criar variante A/B com alocação registrada, audiência comparável, métrica primária e regra para declarar resultado. |
| CAMP-051 | 51 | Parcial | Lista de leads deve permitir busca e filtros combináveis e manter os mesmos critérios na exportação. |
| CAMP-052 | 52 | Outra branch | Filtro de leads quentes deve ser consistente entre tela, exportação e criação de audiência. |
| CAMP-053 | 53 | Parcial | Exportar XLSX com campos e filtros visíveis, mantendo telefone normalizado e sem incluir contatos suprimidos em audiência de envio. |
| CAMP-054 | 54 | Outra branch/parcial | Criar retargeting com um clique a partir de filtros ativos e revalidar permissões, opt-out e quarentena no envio final. |
| CAMP-055 | 55 | Outra branch | Resumo executivo deve apontar período, amostra, evidências e recomendações; não pode inventar vendas ou causalidade. |
| CAMP-056 | 56 | Outra branch | Gerar PDF técnico reproduzível a partir do estado auditado, com data/commit, pontos fortes, limitações e comando/script. |

### E. Robô Auditor

| ID | Req. | Estado observado | Critério mínimo de aceite |
|---|---:|---|---|
| CAMP-057 | 57 | Entregue nesta auditoria | Este documento cataloga 74 requisitos com IDs permanentes, situação observada e critério mínimo de aceite; alterações futuras devem versionar o histórico. |
| CAMP-058 | 58 | Parcial | Testes backend devem cobrir cada regra crítica, falhas e idempotência; gate deve registrar versão, resultado e log sem dados sensíveis. |
| CAMP-059 | 59 | Ausente | Componentes/páginas críticos devem ter testes de filtros, estados, erros, acessibilidade essencial e exportação. |
| CAMP-060 | 60 | Ausente | Simulador deve percorrer campanha e interações com fixtures sem enviar WhatsApp real nem alterar dados de produção. |
| CAMP-061 | 61 | Outra branch/parcial | Testar eventos de botão/lista desde payload recebido até contador/lead, incluindo retry e payload inválido. |
| CAMP-062 | 62 | Parcial | Testes devem provar opt-out automático/manual e bloqueio em todos os canais e APIs antes de chamar o provedor. |
| CAMP-063 | 63 | Outra branch | Testes IA devem cobrir schema, classificação, incerteza, fallback, custo/limite e regressões de prompt. |
| CAMP-064 | 64 | Parcial | Testes MubiSys devem validar contrato, paginação, falha, campos ausentes e associação por IDs; relatório deve indicar quando teste de rede foi pulado. |
| CAMP-065 | 65 | Ausente/não comprovado | Testes financeiros devem reconciliar fórmulas de receita, custo, ticket, margem, ROI e deduplicação em casos-limite. |
| CAMP-066 | 66 | Parcial | Testes devem validar cada KPI e linha do relatório contra fixtures conhecidas, inclusive limites de data e significado dos totais. |
| CAMP-067 | 67 | Parcial | Suíte de regressão deve cobrir envio sequencial, quarentena, cadência, opt-out, fontes, relatório e histórico após cada release. |
| CAMP-068 | 68 | Parcial | Auditor deve verificar commit/branch remota e deployment real por integração autorizada; nunca declarar publicado só porque existe commit local. |
| CAMP-069 | 69 | Entregue nesta auditoria | Lacunas ausentes, parciais, de outra branch e não verificadas devem ser listadas sem declarar sucesso sem evidência. |
| CAMP-070 | 70 | Entregue nesta auditoria | Registrar a ausência de testes frontend de Campanhas e que o teste de contrato MubiSys pode ser condicionalmente pulado; atualizar ao revisar suítes. |
| CAMP-071 | 71 | Ausente | Cada auditoria executada deve ter histórico imutável com data, commit, ambiente, versão de regras, resumo e localização dos detalhes. |
| CAMP-072 | 72 | Ausente | Painel visual deve mostrar aprovados, falhas, pendências e não verificados com links para os resultados correspondentes. |
| CAMP-073 | 73 | Ausente | Resultado deve oferecer síntese em linguagem simples e detalhe técnico reproduzível, sem expor tokens, telefones ou mensagens pessoais. |
| CAMP-074 | 74 | Ausente | Pipeline de publicação deve falhar automaticamente quando qualquer teste definido como crítico falhar ou não for executado. |

## 12. Estratégia de commits, push, deploy e rollback

1. Integrar a branch avançada em branch de trabalho nova baseada no `origin/main` atualizado; resolver/regerar migrations em ordem crescente e revisar SQL/journal antes de aplicar.
2. Separar commits por fase e mudança de schema. Cada commit deve incluir implementação, migration, testes e documentação da própria fase; não misturar correções de Campanhas com outros módulos.
3. Fazer push para branch de trabalho e revisão por PR. Não usar `main` como ambiente de integração nem aplicar migrations diretamente por comando manual.
4. Antes de deploy, rodar typecheck e testes relevantes num banco isolado de teste. O fluxo de auditoria deverá provar que esses checks são obrigatórios no pipeline.
5. Habilitar secrets e webhook/cron somente em ambiente de staging; testar com contatos sintéticos e sem envio promocional real. Confirmar formato do payload e status com o provedor antes de ativar tráfego.
6. Publicar com release identificada por commit, validar migrations aplicadas e smoke checks. Acompanhar logs de envio, eventos e erros no início do rollout.
7. Para rollback, reverter código quando compatível; migrations aplicadas devem ser aditivas e a reversão de banco deve ser planejada separadamente. Não reexecutar campanhas durante rollback para evitar duplicidade de mensagens.

## 13. Encerramento

**Já existe no código:** gestão de campanha e segmentos, envio via Ceci/WTS, proteção de cadência/quarentena e opt-out manual dentro do módulo, registros de lotes e alguns status por contato, calendário/planner manual, relatório operacional básico, fontes ERP/arquivo e exportação XLSX de listas.

**Ainda precisa ser desenvolvido ou integrado em `main`:** resposta/evento inbound confiável, rastreamento de interações, opt-out automático e realmente global, identidade de lead, classificação de conversas disponível em produção, atribuição financeira validada, relatórios comerciais, testes frontend/simulação e o Robô Auditor com histórico/painel/gate de publicação.

**Não pôde ser verificado:** execução atual das suítes, configuração dos secrets, tráfego real de webhook, versão publicada em produção, migrations aplicadas no banco produtivo, entrega/leitura real das mensagens e estado atual das APIs MubiSys/Ceci.Chat.

**Pronto para iniciar:** o Robô Auditor pode iniciar pela fase de catálogo, contrato de evidências e plano de testes. O bloqueio de deploy não deve ser tratado como pronto até existir CI, testes frontend/simulação e um ambiente que valide os eventos reais sem tocar em contatos de produção.

**AUDITORIA CONCLUÍDA — AGUARDANDO PRÓXIMA FASE.**
