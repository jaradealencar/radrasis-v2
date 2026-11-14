# Probabilidade de compra por proposta no CRM

## Como o score funciona

O CRM agora usa regressão logística regularizada com calibração Platt treinada em previsões temporais fora da amostra. O serviço reconstrói o modelo com as propostas decididas do histórico local e mantém o resultado em cache por 30 minutos; depois recalibra quando os dados mudam. Não há escrita no banco nem migração de estrutura.

Cada proposta recebe seu próprio score a partir do valor e da faixa de ticket, idade da empresa na data da proposta quando há perfil CNPJ vinculado, recência/frequência/valor das compras anteriores, tempo de relacionamento, número de cotações anteriores, coorte da primeira compra e região que já era conhecida naquela data. Para treinamento, uma proposta só vira exemplo depois de ganhar, ser perdida ou vencer a validade. Se a validade não está preenchida, propostas ainda abertas só entram como perda presumida após 30 dias; essa aproximação pode gerar algum ruído nos rótulos. Propostas ainda abertas e dentro do prazo não entram como perda.

A região é uma variável da regressão logística, junto com ticket e sinais do cliente; ela pode alterar o score de cada proposta. Na base histórica, a região de uma proposta é inferida da O.S. válida mais recente anterior à proposta. Se o cliente ainda não tinha compra, a região histórica fica como desconhecida para evitar usar endereço ou compra futura como informação vazada. Na proposta aberta atual, o CRM usa a UF do endereço do cliente no próprio orçamento e recorre ao histórico anterior quando ela não está disponível.

As features históricas usam somente informações anteriores à data da proposta. Isso evita, por exemplo, usar uma compra futura ou a região atual do cliente para prever uma proposta antiga. A saída do CRM continua limitada às propostas abertas que vêm do cache MubiSys; os desfechos históricos servem apenas para treinar o score.

O CRM mostra até que data de criação há propostas no treino, a data mais recente do espelho histórico e a cobertura do perfil CNPJ. Quando a proposta mais recente do espelho tem mais de 30 dias, exibe um aviso: o modelo continua recalculando, mas não aprende propostas ou decisões que ainda não chegaram ao histórico local. O MubiSys não fornece nesta base a data em que cada decisão foi registrada, então a tela não apresenta a data de proposta como se fosse a data do desfecho.

## Auditoria retrospectiva

Auditoria somente de leitura executada em 13/11/2026 em `historico_orcamentos`, `historico_os` e `clientes_perfil_cnpj`. O histórico tinha 6.472 propostas decididas, de 02/01/2026 a 29/09/2026; a proposta mais recente no espelho também era de 29/09/2026. Essa defasagem é relevante: recalibração automática não compensa propostas e decisões que ainda não foram sincronizadas.

O perfil de idade estava vinculado a 649 de 2.006 empresas (32,4%). Entre as propostas decididas, 4.457 de 6.472 (68,9%) tinham idade calculável, pois empresas recorrentes aparecem em várias linhas. Na distribuição de clientes com idade conhecida dentro da amostra decidida: 46,8% tinham 3–10 anos e 38,9% tinham 10 anos ou mais; juntas, as categorias acima de 3 anos representavam 85,7%. Esses percentuais não representam toda a carteira, porque quase 68% dos clientes históricos não têm idade vinculada.

As duas proporções informadas anteriormente (“80% entre 3–10 anos” e “43% acima de 10”) não podem ser categorias exclusivas do mesmo denominador. Na amostra local vinculada, a divisão observada foi 46,8% e 38,9% dos clientes com idade conhecida. A tela distingue a distribuição por cliente da distribuição por proposta.

Conversão observada por faixa de ticket na base decidida:

| Ticket da proposta | Ganhos / propostas | Conversão observada |
| --- | ---: | ---: |
| Até R$330 | 253 / 526 | 48,1% |
| R$335–750 | 209 / 638 | 32,8% |
| R$760–1.300 | 187 / 785 | 23,8% |
| R$1.301–5.490 | 548 / 3.261 | 16,8% |
| R$5.500–8.000 | 66 / 576 | 11,5% |
| R$8.010–12.000 | 26 / 360 | 7,2% |
| Acima de R$12.000 | 19 / 326 | 5,8% |

Recência também carregou sinal: no holdout de 90 dias, a conversão foi 28,1% no quintil de compras mais recentes e 10,6% no quintil de menor recência. Isso é associação preditiva, não efeito causal.

## Comparação dos modelos

O avaliador usa cortes cronológicos: treina antes da janela e mede os últimos 30, 60 e 90 dias. Métricas menores são melhores para log-loss e Brier; AUC maior é melhor.

| Holdout | Modelo | Log-loss | Brier | AUC |
| --- | --- | ---: | ---: | ---: |
| 30 dias | Regressão logística calibrada | 0,4495 | 0,1405 | 0,687 |
| 30 dias | Bayesiano atual (cliente, ticket, região) | 0,4590 | 0,1462 | 0,682 |
| 60 dias | Regressão logística calibrada | 0,4249 | 0,1339 | 0,732 |
| 60 dias | Bayesiano atual (cliente, ticket, região) | 0,4515 | 0,1429 | 0,690 |
| 90 dias | Regressão logística calibrada | 0,4243 | 0,1339 | 0,743 |
| 90 dias | Bayesiano atual (cliente, ticket, região) | 0,4450 | 0,1407 | 0,708 |

No período de 90 dias, a regressão teve Brier cerca de 4,8% menor que o modelo bayesiano usado antes. A calibração por quintil foi próxima no centro: no holdout de 90 dias, as médias previstas/observadas foram 4,5%/4,4%, 9,3%/8,8%, 17,8%/16,4%, 23,9%/23,8% e 43,4%/40,7%. Os maiores scores ainda tendem a ficar alguns pontos acima do observado, então o CRM não deve tratar o percentual como garantia de venda.

Também foram comparados, no mesmo replay, baseline constante, árvore CART rasa, Random Forest simples, Gradient Boosting de stumps, Naive Bayes misto e uma variante bayesiana por ticket/idade/coorte. Nesta amostra, a regressão teve o melhor conjunto de log-loss, Brier e AUC nas janelas de 60 e 90 dias. A árvore ficou próxima em Brier, mas abaixo em discriminação e estabilidade. Naive Bayes ficou mal calibrado.

O repositório não contém XGBoost nem LightGBM. O challenger de boosting implementado no avaliador é um Gradient Boosting simples de árvores de um nível; não é apresentado como resultado de XGBoost/LightGBM. Esses pacotes podem ser adicionados a uma etapa de pesquisa se houver necessidade, mas não são necessários para a versão de produção selecionada.

## RFM, coortes e experimentos

RFM entra como sinal por proposta: meses desde a última compra, compras válidas nos 12 meses anteriores e valor comprado nesse período. A coorte vem da primeira compra observada antes da proposta. Propostas sem histórico ficam em categorias explícitas; a ausência de perfil CNPJ não é preenchida com uma idade estimada.

A comparação foi um replay histórico pareado, não um A/B ao vivo. Um teste A/B em produção exigiria gravar, para cada proposta, a versão do modelo, a probabilidade exibida e o desfecho posterior. O CRM ainda não registra esse conjunto de evidências; por isso não se randomizou a experiência de vendedores nem se afirmou ganho causal.

O script `server/scripts/auditar-probabilidade-crm.ts` repete a auditoria e imprime apenas agregados. Ele lê todas as linhas atualmente sincronizadas em `historico_os` (consulta sem filtro por mês), resume o intervalo, conta compras válidas pela regra `isOsNormalDb`, distribui essas compras por região e mostra ganhos/perdas de propostas por região conhecida antes do orçamento. O histórico local de O.S. documentado começa em 05/2023; o relatório sempre imprime as datas reais do espelho usado. Use `yarn tsx server/scripts/auditar-probabilidade-crm.ts --resumo` para gerar o resumo sem o replay dos modelos.

O relatório separa duas evidências: compras válidas por região são sinais de relacionamento usados pelo RFM, enquanto conversão por região é calculada a partir dos status dos orçamentos. O MubiSys não fornece nesta base um identificador que ligue cada O.S. ao número exato do orçamento; portanto, não atribuímos uma compra a uma proposta específica. O agrupamento regional histórico usa a região disponível antes de cada proposta, e não prova efeito causal. O painel de desempenho também acompanha, de agora em diante, a probabilidade inicialmente exibida e os desfechos explícitos por região.
