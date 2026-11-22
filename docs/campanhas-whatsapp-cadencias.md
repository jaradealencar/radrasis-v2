# Campanhas WhatsApp: motor de cadências

O motor adiciona etapas assíncronas às campanhas existentes. A migration 0119 copia `wts_template_id` para a etapa 1, versão 1, e deixa `motor_cadencia_ativo=false` em todas as campanhas. A migration 0120 cria as quatro fontes padrão de regras ERP. Nenhuma migration liga campanhas ou envia mensagens.

## Dados e estados

- `campanhas_whatsapp_etapas` guarda versões imutáveis de 1 a 6 etapas. Inscrições copiam a lista de etapas no início e continuam nessa versão.
- Ao salvar uma nova versão enquanto a campanha está ativa, o painel exige nova confirmação humana de aprovação Meta para todos os templates; inscrições existentes mantêm o snapshot anterior.
- `campanhas_whatsapp_inscricoes` usa E.164 como identidade de entrega e uma restrição parcial impede duas cadências ativas para o mesmo telefone. Resposta inbound pausa qualquer inscrição ativa; opt-out bloqueia o telefone globalmente.
- O ERP agrupa pedidos e orçamentos por telefone normalizado. Cadastros MubiSys que compartilham telefone viram uma única audiência; o cadastro de maior ID fornece nome, CNPJ e cliente para exibição.
- Listas importadas são lotes congelados. Cada lote registra arquivo, importador, momento de importação e declaração de opt-in. O motor suprime contatos encontrados como ativos no ERP (pedido histórico ou pedido nos últimos 90 dias).
- Prioridade efetiva: primeira compra/pós-venda (0), reativação (20), orçamento pendente e recorrentes (30), listas externas (100 ou mais). Ao vencer uma cadência de prioridade maior, ela encerra a inscrição ativa anterior. Uma resposta pausa o telefone em todas as campanhas e preserva a trava contra novo envio.
- `total_orders = 1` continua verdadeiro até uma segunda compra; por isso a fonte padrão de pós-venda é tratada como coorte de evento e só admite uma inscrição por telefone, evitando reentradas mensais no mesmo segmento.
- Ao deixar de satisfazer a fonte, a inscrição termina como `removido_por_conversao`. Se voltar a se qualificar, cria outra inscrição na etapa 1 após o cooldown da campanha/quarentena.
- O aceite WTS fica em conciliação até o callback `SENT`/`DELIVERED`/`READ` ou confirmação manual de administrador. Timeout e retorno sem ID não geram retry automático. Callback de falha confirmada cancela a inscrição.
- A ação manual “Disparar WTS” fica bloqueada na campanha com o motor ligado e ignora telefones com outra inscrição ativa/pausada, para não competir com a cadência.

## Segmentos ERP padrão

| Chave | Regra |
| --- | --- |
| `reativacao_inativos` | `days_since_purchase >= 60` |
| `orcou_nao_comprou` | último orçamento pendente, pelo menos 15 dias, sem pedido posterior |
| `primeira_compra_pos_venda` | `total_orders = 1` |
| `ativos_recorrentes` | `total_orders >= 5` e `days_since_purchase < 60` |

As regras são JSON validadas no servidor, combinadas com AND e nunca executadas como SQL livre. As fontes podem ser vinculadas a campanhas pela tela de fontes.

## Polling e suspensão fail-closed

Configure cron externo com `Authorization: Bearer $CAMPANHAS_API_KEY`:

| Frequência | Método e endpoint |
| --- | --- |
| A cada 15 min | `POST /api/scheduled/campanhasWhatsapp/sincronizarErp?recurso=ordens` |
| A cada 15 min | `POST /api/scheduled/campanhasWhatsapp/sincronizarErp?recurso=orcamentos` |
| A cada 15–30 min, após os dois recursos | `POST /api/v1/campaigns/sync-audiences` |
| A cada 5 min | `POST /api/v1/campaigns/process-cadence` |
| Diariamente | `POST /api/scheduled/campanhasWhatsapp/sincronizarClientes?pagina=1` — páginas seguintes são enfileiradas pelo QStash |
| Diariamente | `POST /api/scheduled/sincronizarHistorico?mesesAtras=1` — rota histórica existente; hoje não exige chave |

Agende ordens e orçamentos com pelo menos 1 minuto de diferença para reduzir colisões com o limite da API MubiSys; faça `sync-audiences` depois dos dois polls.

Pedidos e orçamentos usam uma janela sobreposta de sete dias e upsert idempotente. O histórico completo e o cadastro de clientes são atualizados diariamente. A projeção de fatos ERP só é reconstruída quando ordens e orçamentos tiveram sucesso nos últimos 30 minutos. O motor suspende sincronização de audiência e envios se qualquer uma das cinco fontes de saúde (`ordens`, `orcamentos`, `fatos`, `historico`, `clientes`) estiver ausente, incompleta ou stale; histórico/cadastro têm limite de frescor de 26 horas. Uma falha mantém o último sucesso, mas o estado de erro bloqueia envios até um sync completo posterior.

QStash também encadeia uma execução após cada tentativa de envio com o atraso aleatório de 3–8 segundos e `Upstash-Retries: 0`. O cron de 5 minutos é uma recuperação se a publicação da continuação falhar. O envio e as etapas só são reivindicados após verificar saúde ERP, elegibilidade, opt-out, horário e prioridade; o mutex global serializa workers concorrentes.

O calendário usa `America/Campo_Grande`, segunda a sexta, 08:30–17:30, fins de semana e feriados nacionais. Não há calendário estadual/municipal. O intervalo de uma etapa seguinte parte do `aceitoEm` do provedor, com atraso em dias úteis.

## Configuração

Defina nos segredos do servidor:

```env
CAMPANHAS_API_KEY=...
CAMPANHAS_WTS_WEBHOOK_SECRET=...
QSTASH_TOKEN=...
CAMPANHAS_CADENCIA_WORKER_URL=https://seu-dominio/api/v1/campaigns/process-cadence
WTS_CHAT_AUTHORIZATION=...
```

Antes de ativar uma campanha, configure seu cron, faça um ciclo completo de sincronização, cadastre as etapas e fontes, e revise consentimento e aprovação dos templates. A ativação é manual por campanha e exige as duas confirmações explícitas no painel. O servidor não consulta a Meta para verificar aprovação; o administrador registra essa confirmação.

O callback de entrega usa `POST /api/v1/campaigns/wts-status`, com `x-wts-webhook-secret: <CAMPANHAS_WTS_WEBHOOK_SECRET>` e payload provisório:

```json
{"id":"ID_DA_MENSAGEM_WTS","status":"DELIVERED","timestamp":"2026-11-02T12:00:00Z"}
```

O parser também aceita `message_id`, `messageId`, `content.id` e campos equivalentes de status/data. Este contrato ainda precisa ser confirmado com um payload real sanitizado e suporte de header secreto do WTS.Chat antes de configurar o webhook em produção. Status desconhecido é registrado e não avança a régua. A rota inbound também aceita o segredo dedicado ou `CAMPANHAS_API_KEY`; até confirmar o contrato de auth do provedor, mantenha segredo não compartilhado e não abra o endpoint.

## Ativação e operação

1. Revise o SQL de 0119/0120 e aplique migrations em ambiente controlado com `corepack yarn drizzle-kit migrate` (não rode `db:push`, que também gera migrations).
2. Aguarde saúde ERP completa e verde na aba da campanha.
3. Salve etapas e vincule fontes. Templates legados aparecem como etapa 1 após a migration.
4. Ative explicitamente a campanha e confirme opt-in e aprovação de todos os templates.
5. Acompanhe inscrições e conciliações na aba da campanha. Timeout/retorno incerto pede consulta no WTS.Chat e decisão manual por administrador; não clique para reenviar o mesmo passo.
6. Para desbloquear opt-out, use a ação administrativa do painel. Todo desbloqueio fica sob controle humano.

O polling limita a detecção de novas compras do MubiSys à frequência do cron (15 min); portanto, “imediato” significa na próxima sincronização completa. Se o callback da WTS não estiver configurado ou não chegar, a campanha fica em conciliação e não prossegue automaticamente.
