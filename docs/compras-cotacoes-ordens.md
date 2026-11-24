# Cotações e ordens de compra

Na Auditoria NF de Compra (`/comercial/nf-compra`), a análise de PDF usa cinco colunas com quebra de texto. Quantidade e preço ficam juntos; as compras anteriores ficam agrupadas. A última coluna compara cotação, última compra e MubiSys na mesma unidade, com conversão de chapas em m² visível e editável.

A análise também mostra uma simulação do preço final: valor da mercadoria + frete + ICMS de 10% sobre essa base, como na auditoria de NF. No frete por kg, a tarifa só é multiplicada por um peso total disponível: o PDF pode fornecer esse peso explicitamente, itens todos cotados em KG permitem somar as quantidades, e nos demais casos o comprador pode informar o peso manualmente. Sem peso ou sem frete definido, o preço final fica pendente; salvar a cotação continua permitido, mas gerar a ordem exige completar a base. O frete total é distribuído entre os itens proporcionalmente ao valor cotado para exibir o custo unitário final estimado.

## Cotação salva

Depois de revisar os vínculos e conversões, use **Salvar cotação**. O documento guarda fornecedor, data, validade, condições, frete informado, descrição/código, quantidade, preço, matéria-prima, fator, fórmula e custo do MubiSys naquele momento. O total salvo é recalculado no servidor pelos itens mais o frete informado; não inclui impostos ou encargos não discriminados nos itens.

Cada salvamento com dados alterados cria um novo documento. A chave de repetição impede duplicações por tentativas repetidas da mesma gravação. Ao reabrir um documento sem alterar dados, gerar uma ordem usa a cotação já salva. As cotações mostram os 200 documentos mais recentes; as ordens têm paginação de 50 registros e filtros por fornecedor/número, transportadora e datas de emissão em Campo Grande. O PDF original não é armazenado neste fluxo; o nome do arquivo é preservado.

Itens sem vínculo ou sem conversão podem ser salvos, mas ficam pendentes na comparação por unidade de consumo. O cadastro da MP no servidor define a unidade de destino válida. Não se usa preço zero como substituto de custo ausente.

## Ordem de compra

Use **Gerar ordem de compra** na análise ou na lista de cotações salvas. A ordem traz os mesmos itens e preços. Edite as quantidades; zero exclui o item. Escolha empresa/CNPJ ou Daniel/CPF, pagamento à vista ou faturado, condições, transportadora, número da coleta, frete e observações. O volume alterado pode exigir renegociação com o fornecedor; o preço permanece o da cotação de origem.

Os cadastros de compradores são persistidos juntos com endereço e e-mail compartilhados. Os padrões da Radra foram conferidos no destinatário da NF-e `server/__fixtures__/nf-aczinox-213876.xml`; CPF e nome de Daniel foram informados pelo usuário. Os dados são editáveis antes da emissão.

**Emitir, salvar e baixar PDF** grava uma ordem numerada, com itens e comprador preservados. A logística pode ser atualizada em **Frete e coleta**, com histórico por revisão/usuário e sem alterar snapshots das NFs anteriores. O PDF reemitido reflete a logística atual da ordem. A emissão não envia mensagem ao fornecedor, não registra pagamento e não conta como compra concluída.

## Tipos de frete e ciclo até a NF

Cotação, emissão de ordem e edição de logística oferecem **valor total/fixo**, **por kg** e **grátis**. A tarifa por kg é separada do valor total. Sem peso previsto, o total por kg fica pendente; não se apresenta a tarifa como se fosse o frete total. Com peso previsto, a tela e o PDF identificam o total como estimado.

Confirme o frete na ordem (inclusive quando grátis), preencha transportadora e número da coleta manualmente. Peso previsto é opcional. Alterações têm controle de revisão concorrente e registro em `compras_logistica_historico`.

Ao carregar o XML, a auditoria exige selecionar uma ordem de compra já ligada à cotação antes de concluir a nova NF. A seleção traz logística e frete: no modo por kg, tarifa × peso definitivo da NF; no modo fixo, a parcela de frete atribuída à nota, limitada ao saldo da ordem; no grátis, zero explícito. O frete contido no XML não é somado novamente. Com frete positivo ou tarifa por kg, é obrigatório informar peso válido para concluir. A tela mostra total ÷ peso = R$/kg. Compras locais mantêm o frete acordado; a seleção local altera apenas o ICMS adicional.

O servidor valida fornecedor, revisão e saldo, recalcula rateios/custos e salva cabeçalho, itens, memória e vínculo à ordem na mesma transação. O lock da ordem impede consumo concorrente do mesmo saldo; a identidade da NF impede duplicação por repetição do salvamento. Cada vínculo guarda um snapshot da modalidade, tarifa, total aplicado, peso, R$/kg, transportadora e coleta. Em entregas parciais de frete fixo, distribua o total entre as NFs; no frete por kg, cada NF usa seu peso real e a tarifa da ordem.

As NFs antigas continuam disponíveis. Ao vincular uma NF já auditada, seu frete precisa ser compatível com a ordem; os custos antigos não são reescritos silenciosamente. As ordens anteriores à migration 0148 começam com frete a confirmar.

## Comparação de chapas em m²

Dimensões explícitas como `2050X3050X3MM` preenchem largura, comprimento e área por chapa; revise os valores. As entradas ficam na própria linha e recalculam imediatamente o preço cotado por m². A conversão permanece independente da quantidade de chapas e pode ser salva mesmo antes do vínculo da MP; sem vínculo, o custo do MubiSys fica pendente.

O preço da compra anterior usa o fator e a unidade ERP salvos na auditoria da NF, separando preço do material de custo final com rateios. Por exemplo, R$ 294,69/chapa ÷ 2,9768 m² = R$ 99,00/m². Se a conversão antiga não estiver registrada, a tela informa a pendência e oferece uma simulação da área da compra anterior; essa simulação não altera o histórico. Nenhuma dimensão da chapa atual é copiada para a compra antiga.

## Evolução e auditoria

A aba **Cotações, ordens e evolução** contém as listas, o gráfico e a conferência. Filtre por MP, período, fornecedor e unidade. O gráfico só compara a mesma MP/unidade; apresenta médias simples por dia separadas entre cotação e NF. A consulta lê até 5.000 itens por origem, com aviso quando esse limite é atingido.

As NFs vêm exclusivamente das importações concluídas na auditoria. O painel mostra tanto o preço original quanto o preço do material convertido por unidade de consumo, e, em coluna separada, o custo final da NF com os rateios já auditados.

O menor preço de referência considera somente a mesma MP e unidade, cotação anterior à decisão (data da ordem, quando vinculada; caso contrário, data da NF), validade declarada ainda vigente e quantidade comprada suficiente para o volume cotado. Não considera preço futuro, validade desconhecida, conversão ausente ou MP diferente. A indicação compara apenas material, antes de frete e impostos; qualidade, disponibilidade e pagamento ainda exigem revisão humana. Uma referência de preço não prova por si só que a alternativa poderia atender a compra integral.

No histórico de ordens, **Vincular NF / conferir** associa explicitamente uma NF concluída do mesmo fornecedor. Cada NF pertence a uma única ordem; uma ordem pode ter várias NFs (recebimentos parciais). A conferência agrega quantidades por MP/unidade, aponta excesso ou falta e mantém itens sem conversão/vínculo pendentes. Dimensões e especificações continuam visíveis para revisão nas descrições.

## Estrutura

Migration `0147_compras_cotacoes_ordens`, gerada pelo Drizzle e revisada: `compras_cotacoes`, `compras_cotacao_itens`, `compras_ordens`, `compras_ordem_nfs`, `compras_compradores`. A numeração gerada inicialmente foi ajustada para 0147 para respeitar o último nome de migration existente; o timestamp gerado foi preservado e é posterior ao da 0146. O snapshot anterior 0145 foi preservado.

Aplicada em produção pelo migrador protegido em 23/11/2026; recibo `1795457812781` conferido após a aplicação.

Router autenticado: `server/routers/compras.ts`. Contratos e comparações puras: `shared/compras-cotacoes.ts`. Interface complementar: `client/src/pages/comercial/ComprasGestao.tsx`. PDF: `client/src/lib/ordemCompraPdf.ts` (jsPDF e autoTable já disponíveis no projeto). As tabelas antigas `cotacao_externa_*` continuam atendendo seus fluxos existentes; não há migração presumida de suas linhas para documentos completos.

Migration `0148_compras_ciclo_frete`: modalidades/tarifas/peso da cotação e ordem, confirmação/revisão de logística, histórico de alterações e snapshot de frete por NF. Gerada pelo Drizzle, com o nome renumerado para 0148 para evitar colisão com nomes antigos e preservando o timestamp gerado. Serviços em `server/services/comprasFrete.ts`, regras em `shared/compras-frete.ts` e `shared/compras-chapas.ts`, interfaces em `ComprasLogistica.tsx` e `CotacaoComparativoConsumo.tsx`.

Aplicada em produção pelo migrador protegido em 23/11/2026 (recibo `1795464834153`). Validação desta ampliação: typecheck, build Vercel, 24 testes puros/regressões e revisão local com APIs simuladas de conversão em m², fretes fixo/por kg/grátis, confirmação de logística e salvamento da NF com R$ 2,50/kg × 150 kg = R$ 375,00. PDF por kg renderizado e conferido visualmente.

Validação: typecheck, build Vercel, testes puros de conversão/validade/quantidade/emissão e regressões de NF; fluxo local com API simulada para salvar, emitir e baixar PDF; inspeção visual do PDF renderizado e da tabela em 1366 px.

## Ajustes da ordem de compra

Antes de emitir, o comprador pode alterar quantidade e preço unitário de cada linha, excluir itens e restaurá-los. A ordem guarda o preço unitário efetivamente enviado e também o preço original da cotação para deixar alterações explícitas no PDF. A cotação salva permanece intacta. O campo manual **Nome do comprador** identifica a pessoa responsável pela compra, separado da razão social/CPF/CNPJ em nome de quem a ordem é emitida; o nome aparece no histórico e no PDF. Ordens anteriores à migration 0149 exibem esse campo vazio como não informado.

Migration `0149_nome_comprador_ordem` adiciona `compras_ordens.nome_comprador`, com valor vazio para preservar as ordens existentes. Aplicada em produção pelo migrador protegido em 23/11/2026; recibo `1795466747333` conferido após a aplicação. Esta revisão passou no typecheck completo, build Vercel e 7 testes do contrato de compras.

## Ordens salvas, edição e dados da carga

A aba **Ordens de compra** mantém as ordens emitidas com busca por fornecedor/transportadora/número e filtros de data. **Abrir / editar** altera comprador responsável e dados fiscais, pagamento, condições, observações, quantidades e preços dos itens; a cotação de origem continua preservada. **Baixar PDF** gera o documento com os dados atuais da ordem, incluindo o nome do comprador, peso e volume quando informados. **Excluir ordem** usa exclusão lógica para manter rastreabilidade; uma ordem com NF vinculada não pode ser excluída nem ter seus itens/dados comerciais editados. A logística pode continuar sendo revisada pela ação **Frete e coleta**.

O nome do comprador responsável é obrigatório na interface atual, com pelo menos três caracteres. Para requests de interfaces anteriores, o servidor usa o nome legal validado como fallback; se elas omitirem o preço unitário, usa o preço salvo na cotação e bloqueia a emissão caso esse preço esteja ausente. Peso (kg) e volume (m³) são opcionais na emissão e podem ser completados ou atualizados em **Frete e coleta**. Valores preenchidos precisam ser maiores que zero. O peso previsto também participa da estimativa do frete por kg; o volume é armazenado para logística e aparece no histórico/PDF quando disponível.

A migration `0150_ordens_itens_volume_exclusao` adiciona volume previsto e marcação de exclusão lógica em `compras_ordens`; não remove nem altera ordens existentes. O volume também entra no histórico de revisões logísticas.

## Desconto obtido na ordem

Na emissão e edição da ordem, **Desconto obtido no pedido (R$)** registra o bônus como um valor total separado. O sistema mantém os preços unitários e totais das linhas intactos, calcula o total líquido como subtotal dos itens + frete − desconto e impede que o desconto ultrapasse o total bruto. O PDF mostra subtotal, frete, desconto e total líquido em linhas separadas.

A aba **Ordens de compra** mostra o valor acumulado dos descontos obtidos e o total por comprador responsável. O resumo considera todas as ordens ativas no período selecionado, sem depender da paginação da lista. A consulta agrupa o nome salvo na ordem; o campo oferece sugestões para Daniel, Débora, Suellen, Érick e Henrique, além de aceitar outros nomes.

A migration `0151_desconto_obtido_ordem` adiciona `compras_ordens.desconto_total` com valor padrão zero para preservar o total das ordens existentes.
