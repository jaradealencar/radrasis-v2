# CPQ Letreiros Express — configurador inteligente de vendas

## Objetivo

**CPQ** significa **Configure, Price, Quote** (**Configurar, Preço e
Orçamento**). As três etapas formam um fluxo único:

1. **Configurar:** produto, composição, kits, modelos, variações e medidas do
   nesting escolhidos pelo vendedor.
2. **Preço:** quantitativos calculados, custos atualizados, serviços, regras de
   precificação, margem e pendências de engenharia.
3. **Orçamento:** proposta comercial revisada, com memória de cálculo interna,
   versão emitida e resposta do cliente.

Montar propostas complexas em minutos a partir de **produto → composição de
matérias-primas e kits → modelos → variações → nesting → consumo → custo → preço
e margem**. O vendedor pode ajustar a composição, selecionar várias variações
e revisar medidas. Cada proposta emitida precisa mostrar internamente como
chegou ao preço e quais dados foram usados. A meta de precisão depende de
insumos, medidas e regras válidos; dado crítico desconhecido exige correção ou
revisão identificável antes da emissão.

Este é um plano de melhoria, não uma descrição de controles já concluídos.

## Estado em 03/10/2026

- Produtos, CPQ Letreiros Express e Propostas já têm importação de composição MubiSys,
  escolha de variações e medidas de nesting. A mudança recente está commitada,
  mas sua migration ainda precisa ser aplicada e o site publicado.
- A etapa raster → SVG do CPQ chama o Vectorizer.AI no servidor após a aprovação
  da arte. Configure `VECTORIZER_API_ID` e `VECTORIZER_API_SECRET` nos ambientes;
  cada chamada de produção consome 1 crédito, inclusive uma nova tentativa ou
  uma edição aplicada. A integração precisa de uma chamada real com credenciais
  ativas para validar a saída do SVG e a geometria calculada.
- `Comercial > Propostas` ainda preenche o preço unitário inicial com
  `custoComFixo`, sem aplicar uma margem. O item só pode ser salvo depois da
  aprovação humana do preço. O servidor confere a aritmética da configuração
  enviada, mas ainda não reconsulta no MubiSys todos os custos e vínculos do
  produto (`client/src/pages/comercial/Propostas.tsx`,
  `server/routers/propostas.ts`).
- O custo do MubiSys ausente vira `null` no produto e pode entrar como zero no
  total ou no item da proposta (`server/routers/produtos.ts`,
  `client/src/pages/comercial/Propostas.tsx`). O custo geral do produto ainda
  soma linhas de variações distintas e não agrega os produtos de kit.
- O CPQ usa faixas de margem da Tabela de Preços; Propostas não usa a mesma
  regra. O modo de preço fixo do CPQ não soma instalação ao preço final, e
  o cálculo do orçamento não soma produtos associados ao kit
  (`client/public/cpq-letreiros-express.html`).
- Medidas ausentes podem virar zero no cálculo de material. O nesting mostra
  uma peça maior que a chapa como se coubesse e calcula área das peças
  separadamente do número de folhas/aproveitamento. Essas aproximações ainda
  não impedem a emissão (`client/public/cpq-letreiros-express.html`,
  `client/src/pages/comercial/Propostas.tsx`).

## Visão futura: projeto conversacional com imagem e voz

Cada orçamento começa como um projeto numa interface com cara de chat. O
vendedor adiciona imagens e explica por texto ou áudio o que quer produzir. O
CPQ mantém a conversa, os arquivos e as escolhas num briefing editável, busca
opções no catálogo real do MubiSys, prepara uma proposta visual, valida as
medidas de produção e calcula materiais e preço. A automação deve reduzir a
montagem a minutos e deixar claro o que foi reconhecido, o que foi estimado e
o que ainda precisa de confirmação. A conversa conduz o trabalho; decisões,
medidas, composição, preço e aprovações também ficam registrados em campos
estruturados para serem conferidos e usados no cálculo.

### Tags de contexto no cadastro de produtos

Cada produto poderá receber tags que descrevem onde e para que tipo de projeto
ele costuma servir — por exemplo, fachada, ambiente interno, vitrine, recepção,
retroiluminado ou sinalização externa. As tags ajudam o agente a relacionar o
briefing do cliente ao catálogo e a explicar por que encontrou um produto.

- Preferir uma taxonomia gerenciada, com sinônimos de busca, para termos iguais
  não virarem tags incompatíveis por diferenças de escrita. Permitir várias
  tags por produto e revisar/remover tags no cadastro.
- Usar tags como contexto de descoberta e ranqueamento. Confirmar as
  características técnicas, modelos, variações, composição e custos nos dados
  reais do catálogo; uma tag não prova compatibilidade física ou elétrica.
- Se modelos ou variações do mesmo produto servirem a contextos diferentes,
  permitir especializar tags nesse nível ou indicar claramente que as tags do
  produto são herdadas.
- Mostrar na recomendação quais tags e requisitos do briefing combinaram e
  quais critérios técnicos ainda precisam ser confirmados.

### Briefing comercial e de engenharia conduzido pelo chat

O chat coleta os dados que mudam configuração, consumo e preço, perguntando só
pelos campos ainda não esclarecidos. Antes de cotar, apresenta um resumo
estruturado para o vendedor confirmar:

- **Iluminação:** sem luz, iluminação frontal ou retroiluminada. Registrar a
  escolha explicitamente; não inferir o tipo apenas pela imagem.
- **Medidas e origem:** aceitar dimensões informadas pelo usuário ou solicitar
  que o CPQ extraia cotas dos arquivos anexados. Salvar valor, unidade, arquivo
  e localização/origem de cada medida, além da confirmação do vendedor. Se o
  arquivo for uma imagem sem escala ou cota física, pedir uma dimensão de
  referência; pixels sozinhos não determinam centímetros.
- **Acabamento/entrega:** oferecer “pronto para instalar” com os acabamentos
  especificados — por exemplo, LED, pintura e componentes necessários — ou
  “semiacabado”. Perguntar quais operações e componentes entram no semiacabado;
  não presumir que esse termo define uma composição padrão. Serviço de instalação
  no local deve ser discriminado à parte quando fizer parte do orçamento.
- **Alternativas:** permitir gerar as duas versões para comparação. Reutilizar
  projeto, medidas e geometria, mas montar composição, componentes, custos,
  preço e margem separados para cada nível de acabamento.

Informações ausentes devem gerar uma pergunta ou pendência visível. O chat pode
manter a conversa natural, mas as respostas precisam atualizar os campos
estruturados do projeto para alimentar cálculo e snapshot da proposta.

### Jornada pretendida

1. **Abrir projeto e conversar:** iniciar um projeto de orçamento numa tela de
   chat, anexar uma ou mais imagens e descrever por texto ou áudio o letreiro.
   Transcrever a fala e organizar a conversa em campos editáveis — por exemplo,
   dimensões e sua origem, iluminação (nenhuma, frontal ou retroiluminada),
   acabamento (pronto para instalar, semiacabado ou ambos), local de instalação
   e quantidade — perguntando pelo que estiver ausente ou ambíguo.
2. **Entender e configurar:** detectar elementos visuais e quantidade de cores
   visíveis, procurar produtos, modelos, variações, materiais e kits disponíveis
   no MubiSys e cruzar os resultados com as tags de contexto dos produtos.
   Apresentar os produtos mais alinhados em ordem de aderência, com os motivos,
   requisitos atendidos e pontos que precisam de confirmação.
   Cor visível na imagem não determina sozinha o material ou acabamento de
   fabricação; cada camada precisa ser associada a uma opção real e confirmada.
3. **Preparar o desenho:** gerar uma prévia redesenhada a partir da referência
   e do briefing aprovado. Manter o desenho de apresentação separado da
   geometria de produção: antes de calcular consumo ou nesting, a forma vetorial,
   escala, dimensões e detalhes relevantes precisam de validação.
4. **Validar produção e nesting:** com geometria aprovada, calcular e apresentar
   área externa/bruta, área líquida, perímetro externo e perímetros internos
   quando houver recortes, além de chapas, perdas e compatibilidade com as
   dimensões reais do material. Mostrar a origem e a unidade de cada medida,
   limitações e aproximações; solicitar revisão de engenharia quando a geometria
   ou o encaixe forem incertos.
5. **Calcular e revisar:** combinar a composição importada com modelos,
   variações, cores e ajustes do vendedor; obter custos atuais do MubiSys e
   calcular consumo, custo, preço e margem pelo motor do servidor. Se o usuário
   pedir ambas as opções de acabamento, apresentar cenários separados e
   comparáveis. O vendedor pode revisar a composição e remover ou acrescentar
   materiais. Toda sugestão ou preço automático exige aprovação humana antes
   de entrar na proposta.
6. **Emitir a proposta:** apresentar pendências e aprovações em uma lista única.
   Quando tudo estiver confirmado, gerar a proposta com snapshot rastreável da
   imagem/arquivo, briefing/transcrição, origem e confirmação das medidas,
   iluminação, produtos selecionados, desenho, métricas de geometria, nível de
   acabamento (e cenários comparados, se houver), composição, custos, regra de
   preço e aprovações.

### Etapas de construção

- **Projeto conversacional:** criar uma conversa por projeto, com anexos de
  imagem, entrada por texto ou áudio, transcrição e briefing estruturado; o
  vendedor pode corrigir o entendimento sem perder o contexto do projeto. O
  briefing registra iluminação, dimensões e origem, nível de acabamento e
  quantidade; perguntas aparecem conforme os dados ainda faltantes.
- **Busca e recomendação de catálogo:** pesquisa de produtos, modelos,
  variações, materiais e kits reais, ranqueados pelas tags de contexto e pelos
  requisitos do briefing. Manter tags e sinônimos gerenciados no cadastro de
  produtos, com opção de especialização por modelo. Apresentar produtos
  candidatos ordenados com motivos de aderência, evidências, custos disponíveis
  e dados ausentes. Não criar materiais ou custos que não existam na fonte.
- **Desenho e geometria:** geração de prévias e conversão para geometria de
  produção editável, com dimensões e cores/layers revisáveis. Separar claramente
  estimativas visuais de medidas calculadas em geometria validada.
- **Engenharia e nesting:** validar limites de chapa, aproveitamento, perdas,
  área externa/bruta, área líquida, perímetros e fórmulas de consumo, além da
  compatibilidade; substituir as aproximações atuais por resultados que possam
  ser explicados e conferidos.
- **Alternativas de acabamento:** calcular opções pronta para instalar e
  semiacabada sobre as mesmas medidas aprovadas, mantendo BOM e preço distintos
  para comparação comercial.
- **Preço e proposta:** integrar o fluxo ao motor comum do servidor, validar
  custos e margens, exigir aprovação humana para todo preço automático e salvar
  o snapshot da decisão junto à proposta.
- **Piloto assistido:** comparar recomendações com pedidos reais, registrar
  correções feitas por vendas e engenharia e só ampliar a automação quando a
  qualidade de modelo, cores, geometria, consumo e preço for demonstrada.

**Critérios para avançar:** cada recomendação deve indicar sua fonte e grau de
confiança; informação desconhecida fica como pendência, nunca como zero ou
palpite silencioso; cores e materiais estimados precisam de confirmação; só
geometria validada pode determinar quantitativos; e nenhum preço automático é
finalizado sem aprovação humana identificável.

## Assistente de preço e aprovação humana

Em 03/10/2026 foi iniciado o uso de IA nos dois fluxos comerciais:

- CPQ Letreiros Express e Comercial > Propostas podem pedir ao GPT uma revisão
  do preço, com parecer, alertas e um valor sugerido. O modelo usado é
  `gpt-5-mini`; ele recebe custo direto, preço atual, regra informada e linhas
  de custo disponíveis. A resposta é consultiva, não consulta preços de
  concorrentes e não determina sozinha o preço final.
- Preços calculados ou sugeridos exigem aprovação explícita de uma pessoa com
  perfil `gestor`, `admin` ou `master` antes de adicionar o item à Proposta ou
  gerar o link público do CPQ. A aprovação registra identificador e nome do
  aprovador, data, origem do preço e valor aprovado.
- A aprovação é assinada no servidor usando `JWT_SECRET`, expira em sete dias
  e fica vinculada à composição, medidas, custo e preço base usados na análise.
  Alterar esses dados invalida a aprovação. Sugestões GPT expiram em vinte
  minutos. Preço abaixo do custo direto, custo zerado, custo de material ausente
  e subtotais inconsistentes são bloqueados.
- A consulta ao GPT depende de `OPENAI_API_KEY` e da disponibilidade do modelo;
  sem a IA, o fluxo ainda permite aprovar humanamente o preço calculado.
- O servidor verifica a consistência aritmética dos dados enviados pelo
  navegador e impede a alteração do preço depois da aprovação. A validação
  ainda não busca novamente todos os custos e o BOM diretamente no MubiSys nem
  resolve a margem vinculada à Tabela de Preços; por isso, a confirmação dos
  custos importados e a aprovação humana continuam necessárias. A próxima
  entrega do motor CPQ deve transferir o cálculo definitivo de consumo, custo,
  preço e margem para uma função de domínio no servidor.

## Próximas entregas, em ordem

### 0. Colocar a configuração já construída em produção

Aplicar e revisar a migration da composição por variação, publicar o código e
validar uma cotação real com produto, modelo, múltiplas variações, matérias-primas
e nesting nos dois fluxos. Esta etapa não resolve os riscos de cálculo abaixo.

### 1. Impedir propostas com custo, medida ou margem desconhecidos

- Tratar custo ausente, zero suspeito, material inativo, unidade incompatível e
  custo desatualizado como pendências explícitas; nunca substituir custo ausente
  por zero silenciosamente.
- Exigir somente as medidas que as fórmulas selecionadas usam. Sinalizar a
  origem da medida e todo ajuste manual.
- Resolver a faixa da Tabela de Preços e aplicar piso de margem por regra de
  negócio. Uma exceção comercial deve registrar responsável, motivo e aprovação.
- Exibir um estado único **Pronta para enviar / Precisa de revisão** nos dois
  fluxos, com a lista exata de pendências. Bloquear link público/PDF final
  enquanto houver pendência crítica.

**Critério de aceite:** nenhuma proposta final com insumo sem custo válido,
medida obrigatória ausente, unidade sem conversão ou preço abaixo do piso sem
aprovação.

### 2. Unificar o motor de orçamento no servidor

Uma função de domínio deve receber produto, composição editada, modelos,
variações, medidas, serviços, instalação, descontos e regras comerciais. Ela
devolve quantidades, custos, preço, margem e pendências por linha. CPQ e
Propostas devem usar o mesmo cálculo. Ao salvar/emitir, o servidor recalcula o
resultado e grava um snapshot versionado das entradas, fontes de custo, regra
de preço e resultado. Incluir produtos associados ao kit e verificar os modos
de preço fixo e por margem.

**Critério de aceite:** uma mesma configuração produz o mesmo preço nos dois
fluxos; alterar o payload do navegador não altera o cálculo definitivo.

### 3. Validar a engenharia e o consumo de chapa

Vincular cada chapa às dimensões reais do material; rejeitar peça que não
caiba. Separar área líquida, área das peças, folhas necessárias, perda e
quantidade faturável/consumida. Definir a regra por insumo: área, comprimento,
perímetro, unidade, folha inteira ou outra medida. Incluir folga, corte/refilo
e arredondamento quando aplicáveis. Sobreposição ou geometria aproximada pede
revisão de engenharia identificável.

**Critério de aceite:** o quantitativo exibido para cada insumo reconcilia com
a fórmula e com o plano de corte aprovado; peça fora da chapa não recebe preço
final automático.

### 4. Reduzir o tempo de montagem

Criar configurações aprovadas reutilizáveis por produto/modelo/variação,
mantendo edição e exclusão de materiais por cotação. Ao importar nesting antigo,
reutilizar a geometria, atualizar composição e custos e mostrar o que mudou.
Ter biblioteca pesquisável de nestings aprovados, em vez de depender das 100
cotações recentes do CPQ. Exibir em uma tela resumo de escolhas, consumo,
preço, margem e pendências. Medir tempo até proposta e frequência de ajustes
manuais para orientar simplificações.

## Regras comerciais a definir antes das entregas 1 e 2

- Piso de margem por produto/categoria e quem aprova exceções.
- Prazo máximo aceitável para custo de matéria-prima e comportamento quando o
  MubiSys estiver indisponível.
- Materiais cobrados por área, folha inteira, unidade ou rendimento de chapa;
  política de perdas, folgas e arredondamento.
- Quais ajustes manuais de medidas e composição exigem revisão de engenharia.
