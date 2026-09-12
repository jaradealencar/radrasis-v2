# Radar de Mercado

Sinais externos de novas oportunidades comerciais (inaugurações, expansões,
editais, movimentos de concorrentes) — seção 4.5/7 do prompt de origem
"Inteligência de Mercado". Implementado em setembro/2026 depois de
combinar com o usuário as decisões de negócio que o próprio prompt original
exige ("não invente minha cidade ou área de atendimento").

## Decisões combinadas com o usuário

- **Regiões**: Centro-Oeste, Sudeste e Sul — as demais regiões não têm
  representatividade na Análise Geográfica do sistema (confirmado pelo
  usuário, não inferido sozinho).
- **Público-alvo**: só gráficas e empresas de comunicação visual (não outros
  ramos) — reflete o modelo de terceirização do negócio.
- **Fonte de busca**: SerpAPI (serpapi.com) — decisão explícita do usuário de
  contratar uma API de busca em vez de ficar só com entrada manual. A escolha
  inicial foi Google Custom Search JSON API, mas o Google fechou essa API
  para contas novas em 2025 (confirmado em 2026-09: chave e projeto novos
  retornam `API_KEY_SERVICE_BLOCKED` mesmo com tudo configurado corretamente
  — não é erro de configuração, é bloqueio de política para contas criadas
  depois do fechamento). Trocado para SerpAPI por ser cadastro só com e-mail,
  sem a burocracia de projeto/faturamento do Google Cloud.

## Como funciona

1. `radar_mercado_config` (linha única, id=1) guarda regiões, segmentos-alvo,
   concorrentes conhecidos, termos de busca e exclusões — tudo editável pela
   tela (`/comercial/radar-mercado`, botão "Configurar").
2. Ao clicar "Buscar sinais agora", o sistema roda cada termo de busca
   configurado contra `server/integrations/serpapi-client.ts` (SerpAPI),
   deduplicando por hash da URL contra
   `sinais_mercado` (nunca reprocessa o mesmo link).
3. Cada resultado novo passa por uma extração estruturada via IA
   (`invokeLLM` com `response_format: json_schema`) que decide se é
   relevante (relacionado ao catálogo/segmento) e extrai empresa, UF/
   município, tipo de evento e nível de confiança (`confirmado` só quando o
   trecho afirma o fato diretamente, `inferencia` caso contrário). Resultado
   marcado como não relevante é descartado, não gravado.
4. Sinais salvos entram com status `novo`; o usuário evolui o status pela
   tela (`qualificando` → `oportunidade` → `associado_cliente` ou
   `descartado`/`expirado`).

## Limitação sem a chave configurada

Sem `SERPAPI_KEY` (ver `.env.example`), a configuração fica pronta e
editável, mas o botão "Buscar sinais agora" erra com uma mensagem clara em
vez de simular dados — nunca inventa sinal sem fonte real, conforme exigido
pelo prompt de origem.

## Limitações conhecidas

- `MAX_ITENS_POR_EXECUCAO = 20` por chamada de "Buscar sinais agora" —
  controla custo de IA e tempo de execução (cada resultado novo custa uma
  chamada de LLM). Rodar de novo processa o restante na próxima execução
  (resultados já vistos não repetem, pela deduplicação por URL).
- A extração por IA pode errar UF/tipo de evento quando o trecho da busca é
  ambíguo — todo sinal mostra o trecho de evidência e o link original para
  o usuário conferir antes de agir.
- Não há agendamento automático (cron) para rodar a busca periodicamente
  nesta entrega — é um botão manual. Automatizar isso é possível reaproveitando
  o padrão de `server/sync/scheduled-sync-os.ts` (QStash), mas não foi pedido.
