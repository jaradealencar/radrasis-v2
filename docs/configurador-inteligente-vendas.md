# Configurador inteligente de vendas

## Objetivo

Montar propostas complexas em minutos a partir de **produto → composição de
matérias-primas e kits → modelos → variações → nesting → consumo → custo → preço
e margem**. O vendedor pode ajustar a composição, selecionar várias variações
e revisar medidas. Cada proposta emitida precisa mostrar internamente como
chegou ao preço e quais dados foram usados. A meta de precisão depende de
insumos, medidas e regras válidos; dado crítico desconhecido exige correção ou
revisão identificável antes da emissão.

Este é um plano de melhoria, não uma descrição de controles já concluídos.

## Estado em 03/10/2026

- Produtos, Estúdio e Propostas já têm importação de composição MubiSys,
  escolha de variações e medidas de nesting. A mudança recente está commitada,
  mas sua migration ainda precisa ser aplicada e o site publicado.
- `Comercial > Propostas` preenche o preço unitário com `custoComFixo`, sem
  aplicar uma margem. O servidor aceita esse preço e o snapshot de materiais
  enviado pelo navegador sem recalcular o orçamento
  (`client/src/pages/comercial/Propostas.tsx`, `server/routers/propostas.ts`).
- O custo do MubiSys ausente vira `null` no produto e pode entrar como zero no
  total ou no item da proposta (`server/routers/produtos.ts`,
  `client/src/pages/comercial/Propostas.tsx`). O custo geral do produto ainda
  soma linhas de variações distintas e não agrega os produtos de kit.
- O Estúdio usa faixas de margem da Tabela de Preços; Propostas não usa a mesma
  regra. O modo de preço fixo do Estúdio não soma instalação ao preço final, e
  o cálculo do orçamento não soma produtos associados ao kit
  (`client/public/estudio-letra-caixa.html`).
- Medidas ausentes podem virar zero no cálculo de material. O nesting mostra
  uma peça maior que a chapa como se coubesse e calcula área das peças
  separadamente do número de folhas/aproveitamento. Essas aproximações ainda
  não impedem a emissão (`client/public/estudio-letra-caixa.html`,
  `client/src/pages/comercial/Propostas.tsx`).

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
devolve quantidades, custos, preço, margem e pendências por linha. Estúdio e
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
cotações recentes do Estúdio. Exibir em uma tela resumo de escolhas, consumo,
preço, margem e pendências. Medir tempo até proposta e frequência de ajustes
manuais para orientar simplificações.

## Regras comerciais a definir antes das entregas 1 e 2

- Piso de margem por produto/categoria e quem aprova exceções.
- Prazo máximo aceitável para custo de matéria-prima e comportamento quando o
  MubiSys estiver indisponível.
- Materiais cobrados por área, folha inteira, unidade ou rendimento de chapa;
  política de perdas, folgas e arredondamento.
- Quais ajustes manuais de medidas e composição exigem revisão de engenharia.
