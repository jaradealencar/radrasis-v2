# Qualificação de leads por IA (Gemini) — Campanhas WhatsApp

Camada de inteligência sobre o módulo de Campanhas WhatsApp (`docs/campanhas-whatsapp.md`): analisa
semanticamente as respostas de clientes a uma campanha, classifica em clusters de interesse e alimenta um
dashboard de indicadores e retargeting. Pedido do usuário em 17/10/2026, em três partes.

**Decisão de escopo — por que Gemini, não OpenAI.** O restante do app usa OpenAI para LLM (ver AGENTS.md,
"O que é este projeto": a sprint `sprint-saida-forge` removeu deliberadamente a dependência do Gemini do
repo). Esta feature foi pedida explicitamente com Gemini Flash (SDK oficial `@google/generative-ai`,
Structured Output nativo) — decisão do usuário para este módulo específico, não uma reversão geral daquela
sprint. `GEMINI_API_KEY`/`GEMINI_MODEL` já existiam em `server/_core/env.ts` para o Consultor da Meta
(`server/services/consultorLlm.ts`, que chama a API via `fetch` puro); esta feature tem cliente próprio
(`server/integrations/gemini-client.ts`) porque `responseSchema` do SDK é mais direto que montar o JSON
Schema manualmente numa chamada fetch — mas reaproveita a mesma chave de ambiente.

## Arquitetura: webhook → debounce → Gemini → dashboard

```
Cliente responde no WhatsApp
        │
        ▼
POST /api/v1/campaigns/whatsapp-inbound  (server/routes/campanhas-whatsapp-inbound.ts)
        │  — normaliza telefone, resolve campanha de origem, filtra bot (tempo de resposta / blacklist)
        │  — grava em campanhas_whatsapp_mensagens_inbound com bufferAte = agora + 60s
        ▼
POST /api/v1/campaigns/process-buffers   (cron, a cada 1-2 min — mesmo padrão QStash de docs/cron-qstash.md)
        │  — consolidarBuffersVencidos: junta as mensagens humanas de um contato cujo buffer já venceu
        │  — UMA chamada ao Gemini por contato (controle de custo: só se ainda não houver lead qualificado
        │    nesta campanha)
        ▼
campanhas_whatsapp_leads_qualificados  (cluster, ICP score, perfil, objeção, heatmap)
        │
        ▼
Painel "Qualificação por IA" (QualificacaoIaDialog.tsx) — KPIs, clusters, objeções, heatmap, tabela + export
```

**Nada aponta para o webhook de verdade ainda.** Hoje a resposta do cliente continua chegando só na caixa
de entrada da Ceci.Chat (ver `docs/campanhas-whatsapp.md`, seção "Disparo via WTS.Chat / Ceci.Chat": "Quando
o cliente responde ao WhatsApp, o atendimento abre normalmente... na Ceci.Chat"). Para este pipeline receber
tráfego real, a Ceci precisa ser configurada (no painel deles, fora deste repo) para replicar o webhook de
mensagem recebida para `/api/v1/campaigns/whatsapp-inbound`. Até lá, o endpoint existe, foi testado com
payloads sintéticos no formato oficial da Meta, mas não processa mensagem real nenhuma. Passo manual do
usuário, não documentado aqui por não ser deste repo.

**Por que não Redis.** O deploy é Vercel serverless (ver AGENTS.md: o rate-limiting da aplicação já foi
desligado em produção porque o `MemoryStore` do `express-rate-limit` não sobrevive entre instâncias — mesmo
problema valeria para uma fila em memória). O buffer de debounce é a própria tabela
`campanhas_whatsapp_mensagens_inbound`, com a coluna `buffer_ate` fazendo o papel do TTL: uma mensagem só
entra na consolidação quando `buffer_ate <= agora` **e** nenhuma mensagem do mesmo telefone ainda está dentro
da janela (o cliente pode ter mandado outra linha nos últimos segundos). Isso é consultado a cada chamada de
`process-buffers`, então não depende de um processo rodando continuamente.

## Parte 1 — Filtro de bot e debounce

`shared/campanhas-whatsapp-ia.ts` (`detectarBot`, isomórfico e puro):

- **`button_reply`/`list_reply` nunca são bot** — é clique real do destinatário em um template interativo
  (Engajamento Real Nível 1, conferido em `kpisEngajamento`).
- **Resposta em menos de `LIMITE_RESPOSTA_BOT_SEGUNDOS` (4s)** após o disparo mais recente vira
  `resposta_rapida` — tempo fisicamente improvável para uma pessoa ler e responder.
- **Blacklist semântica** (`BLACKLIST_SEMANTICA_BOT`): termos literais de auto-responder ("mensagem
  automática", "fora do horário de atendimento", "away message"...). Deliberadamente curta e literal —
  qualquer falso positivo aqui descarta uma resposta humana real, então nenhuma lógica de linguagem natural
  foi usada, só substring após normalizar acento/caixa.

**O tempo de resposta só é calculado quando o disparo foi `origem = "api"`** (WTS automático via
`dispararWts`, ou o webhook externo `log-send`) — `buscarUltimoEnvioConfiavelParaTelefone` em
`campanhasWhatsappInboundBuffer.ts`. Decisão deliberada: para `origem = "app"` (Registrar disparo manual), o
vendedor envia pelo WhatsApp Web/app por fora do sistema e só registra na tela depois — minutos, horas ou
dias depois. Usar o horário do REGISTRO como se fosse o do ENVIO faria o "tempo de resposta" ficar
artificialmente pequeno e classificaria respostas humanas reais como bot. Sem uma origem `"api"` confirmada
para aquele telefone, a detecção roda só com a blacklist semântica.

**Debounce de 60s** (`DEBOUNCE_BUFFER_SEGUNDOS`): cada mensagem gravada marca `buffer_ate = recebido_em + 60s`.
`consolidarBuffersVencidos` (chamada pelo cron) só processa um telefone quando **toda** mensagem pendente dele
já passou do buffer — se o cliente mandar uma nova linha enquanto o buffer anterior ainda não venceu, a janela
efetivamente se estende (consolida tudo junto na próxima rodada em que ele ficar 60s quieto). Mensagens de bot
já nascem `processado = true` (não entram na consolidação nem geram chamada de IA).

**Controle de custo** (Parte 1.3 do pedido): antes de chamar o Gemini, `consolidarContato` verifica se já existe
um lead qualificado para (campanhaId, telefone) — se sim, as mensagens são marcadas processadas sem nova
chamada. A primeira qualificação da campanha para aquele telefone é a que vale; refinar com mensagens novas da
mesma campanha é um passo futuro, não implementado.

## Parte 2 — Qualificação semântica (Prompt 1) + ICP Score e objeções (Prompt 3)

`server/services/campanhasWhatsappIa.ts` + `server/integrations/gemini-client.ts`.

**Schema de saída** (Structured Output nativo do SDK `@google/generative-ai`, `SchemaType`/`responseSchema`,
não JSON solto no prompt):

| Campo                 | Tipo           | Observação                                                                                                        |
| --------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `cluster`             | enum           | `ORCAMENTO_DIRETO` \| `DUVIDA_TECNICA` \| `OBJECAO_FORNECEDOR` \| `DESQUALIFICADO_OUTROS`                         |
| `resumo_intencao`     | string         | ≤ 12 palavras                                                                                                     |
| `nivel_interesse`     | integer 1-5    | 1 = nulo/negativo, 5 = pronto para fechar                                                                         |
| `palavras_chave`      | string[]       | até 4 termos                                                                                                      |
| `icp_fit_score`       | integer 1-100  | 80-100 quente, 50-79 morno, 1-49 frio (`classificarFaixaIcp`)                                                     |
| `perfil_interlocutor` | enum           | `DECISOR_SOCIO` \| `COMPRADOR_TECNICO` \| `INTERMEDIARIO_ATENDENTE` \| `DESCONHECIDO`                             |
| `parametros_projeto`  | string[]       | medidas/materiais/prazos citados pelo cliente                                                                     |
| `motivo_objecao`      | enum           | `PRECO_ORCAMENTO` \| `PRAZO_ENTREGA` \| `FORNECEDOR_FIXO` \| `TIMING_INADEQUADO` \| `FORA_DE_ESCOPO` \| `NENHUMA` |
| `resumo_objecao`      | string \| null | ≤ 10 palavras, só quando há objeção                                                                               |

`analisarRespostaComGemini(campanhaTexto, respostasCliente)`: monta o payload (`montarPayloadPrompt`, no
formato pedido — `mensagem_campanha_enviada` + `mensagens_resposta_cliente[]`), chama
`chamarGeminiJson` com o `responseSchema` e valida o retorno com Zod
(`resultadoAnaliseGeminiSchema`). **Qualquer falha** (API fora, rede, JSON inválido, chave ausente) cai no
fallback `criarFallbackPadrao()` — sempre `DESQUALIFICADO_OUTROS`, nível 1, ICP 1 — sem lançar, a menos que o
chamador passe `{ lancarErro: true }` (usado só em teste). O pipeline de webhook/debounce nunca quebra por uma
falha de IA.

Modelo: `ENV.geminiModel` (padrão `gemini-2.5-flash`, env `GEMINI_MODEL`). O pedido original mencionava
`gemini-1.5-flash`/`gemini-2.0-flash`; manteve-se o padrão já configurado no projeto (`gemini-2.5-flash`, mais
recente) para não haver duas convenções de modelo Gemini coexistindo. Trocável via env sem mudar código.

## Parte 3 — Heatmap de atividade e Lead Velocity

Cada lead qualificado grava `dia_semana_primeira_resposta` (0=Domingo..6=Sábado) e
`hora_primeira_resposta` (0-23) a partir do timestamp da primeira mensagem humana da janela consolidada, e
`tempo_reacao_segundos` (igual ao tempo de resposta do filtro de bot — calculado só quando a origem do disparo
é confiável, ver acima). A procedure `estatisticasQualificacao` agrega isso em memória (campanha tem no máximo
alguns milhares de leads; não há necessidade de SQL de agregação): uma célula do heatmap por (dia, hora) e a
média de `tempo_reacao_segundos` entre quem tem o dado. "Melhor horário de conversão" é a célula com mais
respostas, não a de maior taxa de conversão em valor — não há dado de venda fechada ligado ao lead ainda.

## Dashboard (`QualificacaoIaDialog.tsx`)

Acessado por "⋮ → Qualificação por IA (Gemini)" na tabela de campanhas. Consome as seguintes procedures:

- `campanhasWhatsapp.resumoExecutivoIa` — Síntese executiva automatizada via Gemini Flash (Structured Output):
  avalia a tração geral da campanha, atribui temperatura da audiência (`MUITO_AQUECIDA`, `INTERESSE_MODERADO`,
  `FRIA_RESISTENTE`, `DESALINHADA`), diagnostica pontos fortes da oferta, principais travas/objeções com citações
  reais de clientes e entrega recomendações práticas para o próximo disparo.
- `campanhasWhatsapp.atribuicaoReceita` — Atribuição comercial de O.S. faturadas/aprovadas no ERP MubiSys
  (`historico_os`) decorrentes dos disparos da campanha em janelas configuráveis (7, 15, 30 ou 60 dias). Calcula
  Receita Total Atribuída, O.S. Fechadas, Ticket Médio, Custo Estimado dos Disparos e ROI Real / Multiplicador de
  Retorno (ex: 18.5x o custo), além de quebrar a receita gerada por cluster de IA.
- `campanhasWhatsapp.kpisEngajamento` — Total disparado, resposta humana, resposta bot, cliques em
  botão/CTA, índice de profundidade (% de respondentes com 3+ trocas). "Taxa de abertura real" do prompt
  original **não foi implementada**: a WTS.Chat/Ceci não expõe confirmação de leitura (read receipt) separada
  do status de entrega no endpoint hoje usado (`consultarEstadoMensagemWts`, ver
  `server/integrations/wts-chat-client.ts`) — o indicador ficaria baseado em um dado que o sistema não tem.
- `campanhasWhatsapp.estatisticasQualificacao` — distribuição de clusters (pizza), objeções (barras +
  frases capturadas), heatmap dia×hora, tempo médio e mediana de reação (Lead Velocity), além da Curva de Latência
  de Resposta em 6 faixas temporais (< 5 min, 5-15 min, 15-60 min, 1-4h, 4-24h, > 24h).
- `campanhasWhatsapp.listarLeadsQualificados` / `exportarLeadsParaRetargeting` — tabela filtrável por
  cluster/objeção/ICP mínimo, com toggle para "🔥 Leads Quentes (ICP ≥ 80)", exibição de chips com parâmetros de
  projeto (medidas/materiais citados pelo cliente) e export `.xlsx`.
- **Retargeting com 1 clique (implementado em 17/10/2026)**: botão "Criar audiência (1 clique)" no cabeçalho
  da tabela de leads qualificados. Cria dinamicamente uma Fonte de Dados tipo `retargeting`
  (`campanhas_whatsapp_fontes.tipo = 'retargeting'`, migration `0117`) apontando para a campanha de origem e
  preservando os filtros aplicados (cluster, objeção e ICP). A nova audiência aparece imediatamente no seletor
  de Fontes de Dados de qualquer campanha e se retroalimenta dinamicamente conforme novos leads são qualificados.

## Modelo de dados (migrations `0115`, `0116`, `0117`)

| Tabela                                  | Papel                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `campanhas_whatsapp_mensagens_inbound`  | toda mensagem recebida (texto/button_reply/list_reply), com classificação de bot, tempo de resposta e janela de buffer          |
| `campanhas_whatsapp_leads_qualificados` | 1 linha por (campanha, telefone): resultado consolidado do Gemini — cluster, ICP, perfil, objeção, heatmap, mensagens de origem |
| `campanhas_whatsapp_fontes`             | expandida com `tipo = 'retargeting'` e coluna `retargeting_config` (jsonb) para audiências dinâmicas                            |

`campanhas_whatsapp_mensagens_inbound.mensagem_id_externo` é único (nulos não colidem) — evita gravar a mesma
mensagem duas vezes quando o provedor reenvia o webhook (retry comum em infra de webhook).
`campanhas_whatsapp_leads_qualificados` tem índice único em (campanha_id, telefone): suporta o controle de
custo "só qualifica quem ainda não tem lead nesta campanha" sem corrida.

## Limitações conhecidas

- **Webhook sem tráfego real** (ver acima) — a Ceci.Chat precisa ser configurada para apontar para
  `/api/v1/campaigns/whatsapp-inbound`; passo fora deste repositório, não feito.
- **Resolução de campanha por telefone é um palpite, não uma certeza.** Nenhum webhook do WhatsApp devolve
  "a qual campanha esta resposta pertence" — `resolverCampanhaDoTelefone` usa o envio mais recente (qualquer
  origem) para aquele telefone em `campanhas_whatsapp_contatos_historico`. Se o telefone recebeu de mais de
  uma campanha em sequência curta, a resposta é atribuída à mais recente, mesmo que seja réplica de uma
  campanha anterior.
- **Chamada real ao Gemini (SDK + Structured Output) validada em 17/10/2026** com `GEMINI_API_KEY` de teste:
  ver histórico de testes abaixo para o resultado exato.
- **"Taxa de abertura real"** do pedido original não foi implementada (ver seção Dashboard acima) — a API da
  WTS.Chat/Ceci hoje usada não distingue leitura de entrega.
  campanha nova/existente, reaproveitando o upload de lista já existente — não um clique único.
- **Heatmap e Lead Velocity dependem de `tempo_reacao_segundos`/`dia_semana`/`hora`, que só são confiáveis
  quando o disparo de origem foi `origem = "api"`** (ver Parte 1) — para campanhas disparadas manualmente
  (Registrar disparo), essas métricas ficam `null` e saem do cálculo da média, não zeradas.

## Testes

`server/__tests__/campanhas-whatsapp-ia.test.ts` — lógica pura (`detectarBot`, `classificarFaixaIcp`,
`formatarFaixaHeatmap`, `criarFallbackPadrao`, `montarPayloadPrompt`) e o parser do payload Meta
(`extrairMensagensDoPayload`, incluindo texto simples, `button_reply`/`list_reply` e payloads vazios/sem
mensagens). Não há teste de banco real para `campanhasWhatsappInboundBuffer.ts` ainda (análogo a
`campanhas-whatsapp-db.test.ts`) — próximo passo se o módulo avançar para uso real.
