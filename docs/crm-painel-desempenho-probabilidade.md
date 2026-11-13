# Painel de desempenho das probabilidades do CRM

## O que é medido

O CRM registra a primeira probabilidade que devolve para cada orçamento aberto. O snapshot fica em `crm_probabilidade_previsoes`, com chave única por `orc_numero`, horário de exibição, versão do modelo, percentual previsto, vendedor, ticket, idade da empresa, região e sinais RFM/coorte anteriores à proposta. Não grava nome do cliente nem CNPJ. A tabela só acompanha previsões; a fila operacional continua limitada a orçamentos abertos do MubiSys.

O resultado é associado depois por `historico_orcamentos.orcNumero`. Só status explícitos reconhecidos como ganho ou perda entram nas métricas. Propostas ainda abertas, com status não reconhecido ou ausentes do espelho permanecem pendentes; o painel não deduz perda pela validade nem pelo tempo em aberto.

## Métricas e comparações

- Conversão prevista média e conversão real, incluindo a diferença em pontos percentuais e ganhos esperados contra ganhos observados.
- Quadro executivo com 20 indicadores: volume de previsões e desfechos, conversão prevista/real, qualidade do score e valores/tickets das propostas decididas. Mostra o acumulado desde o início do acompanhamento, o histórico anterior, cada um dos três últimos meses completos e o agregado desses três meses.
- Brier score, Brier skill contra um preditor constante com a conversão observada, log-loss, AUC e erro de calibração esperado por dez faixas de probabilidade.
- Tendência dos últimos 30, 60, 90, 180 ou 365 dias contra uma janela anterior do mesmo tamanho. “Melhorando”, “piorando” e “mantido” só aparecem quando ambas as janelas têm no mínimo 30 propostas decididas; até lá, a amostra é insuficiente.
- Evolução mensal e desempenho por vendedor, ticket, idade do CNPJ, região, coorte da primeira compra, recência, frequência e valor de compras em 12 meses. Os grupos monetários usam quartis do período escolhido.
- Conversão histórica por região com ganhos, perdas, amostra e proporção. O painel também informa quantas O.S. do espelho completo entram como compras válidas, a cobertura de UF e a distribuição regional. O score histórico só usa região de O.S. anterior à proposta; propostas sem compra anterior ficam em “região desconhecida”.

Desfechos que chegarem ao espelho após a previsão atualizam a mesma linha do painel; a previsão original não é reescrita. O filtro de período se refere ao dia em que a probabilidade foi exibida, não ao dia do orçamento ou do desfecho.

No quadro mensal de probabilidades, a conversão agregada é ponderada pelo número de propostas, não é a média aritmética das taxas mensais. O comparativo de tendência confronta os três últimos meses completos com o período anterior; só classifica melhora/piora/estabilidade quando cada lado tem pelo menos 30 propostas decididas. Meses sem snapshots aparecem sem valor: a coleta prospectiva começa depois da ativação da migration e não reconstrói previsões antigas.

O card de conversão comercial usa o histórico de orçamentos sincronizado do MubiSys e agrupa cada proposta pela data de cadastro. Ele mostra os três últimos meses completos, os totais do período recente e o histórico geral. Só estados explícitos de ganho/perda entram no denominador da conversão; linhas abertas ou ambíguas são mostradas como sem desfecho e não viram perda presumida. A data da proposta mais recente no espelho fica visível para ajudar a perceber atraso de sincronização.

Mudanças comerciais podem ser registradas com título, data de início e contexto. O painel compara a conversão de propostas criadas nos 30 dias anteriores e posteriores à data registrada, usando somente desfechos explícitos. A comparação só classifica melhora/piora/estabilidade com 30 ou mais propostas decididas em cada janela; a taxa ainda pode mudar quando o MubiSys sincronizar novos desfechos. Essa comparação observacional contextualiza a evolução, mas não prova causalidade — sazonalidade, ticket, região, carteira e outras mudanças podem explicar parte do resultado. Para avaliar causalidade com mais segurança, compare grupos equivalentes e planeje um teste controlado.

## Benchmark anterior ao painel

Os valores históricos no painel são um replay cronológico de 6.472 propostas decididas, validado em 13/11/2026 e documentado em `docs/crm-probabilidade-auto-calibracao.md`. O replay não foi mostrado aos vendedores e não é um A/B ao vivo. Para 90 dias, a regressão logística calibrada obteve Brier 0,1339, log-loss 0,4243 e AUC 0,743; o modelo bayesiano anterior obteve 0,1407, 0,4450 e 0,708. O histórico auditado chegava a 29/09/2026 e pode estar defasado.

Este benchmark fica separado das medições prospectivas. O painel não interpreta associação ou melhora de métricas como prova de causalidade; um A/B exigiria randomização de versões de previsão e registro do grupo experimental.

## Publicação

A tabela foi adicionada pela migration `0117_gigantic_mordo.sql`, que inclui a região no snapshot. Gere e revise a migration junto com `drizzle/schema.ts`; não aplique direto ao banco de produção. A medição ao vivo só começa depois de a migration ser aplicada pelo fluxo protegido de banco. Se o código chegar antes, a aba informa que o armazenamento ainda está indisponível e mantém o benchmark histórico visível.
