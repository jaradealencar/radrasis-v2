# Cotações e ordens de compra

Na Auditoria NF de Compra (`/comercial/nf-compra`), a análise de PDF usa cinco colunas com quebra de texto. Quantidade e preço ficam juntos; as compras anteriores ficam agrupadas. A última coluna compara cotação, última compra e MubiSys na mesma unidade, com conversão de chapas em m² visível e editável.

A análise também mostra lado a lado o preço puro original da cotação e a simulação do preço final por unidade, com os totais puros e finais de cada item. O preço final soma mercadoria + frete + ICMS de 10% sobre essa base, como na auditoria de NF. No frete por kg, a tarifa só é multiplicada por um peso total disponível: o PDF pode fornecer esse peso explicitamente, itens todos cotados em KG permitem somar as quantidades, e nos demais casos o comprador pode informar o peso manualmente. Sem peso ou sem valor de frete, o preço final fica pendente. A cotação pode ser salva; para emitir a ordem, os modos valor total e por kg exigem a base completa. O modo CIF permite emitir sem tarifa e sem peso: a ordem informa que o frete está pendente, não grátis, e seu total considera apenas os itens até o frete ser apurado. Frete fixo é rateado proporcionalmente ao valor dos itens; no frete por kg, linhas cotadas em KG aplicam a tarifa à quantidade da própria linha. Se o fornecedor informa apenas o peso total para itens em outras unidades, o custo por item fica estimado pelo valor e recebe um aviso.

A análise compara o custo final na unidade de consumo — mercadoria + frete + ICMS de 10% — com o custo atual do MubiSys, o custo real da última NF concluída, propostas anteriores do mesmo fornecedor e a melhor proposta anterior de outros fornecedores. Referências sem unidade/conversão compatível não entram no comparativo; propostas com data posterior à cotação também ficam de fora. Custo final acima do MubiSys gera alerta para avaliar reajuste antes da aprovação da ordem. A tela de aprovação recalcula o custo com as quantidades, frete e desconto efetivos da ordem.
## Cotação salva

Depois de revisar os vínculos e conversões, use **Salvar cotação**. O documento guarda fornecedor, data, validade, condições, frete informado, descrição/código, quantidade, preço, matéria-prima, fator, fórmula e custo do MubiSys naquele momento. O total salvo é recalculado no servidor pelos itens mais o frete informado; não inclui impostos ou encargos não discriminados nos itens.

Cada salvamento com dados alterados cria um novo documento. A chave de repetição impede duplicações por tentativas repetidas da mesma gravação. Ao reabrir um documento sem alterar dados, gerar uma ordem usa a cotação já salva. As cotações mostram os 200 documentos mais recentes; as ordens têm paginação de 50 registros e filtros por fornecedor/número, transportadora e datas de emissão em Campo Grande. Quando enviado, o PDF original fica guardado no UploadThing com URL, chave, hash SHA-256 e tamanho para consulta posterior.

Itens sem vínculo ou sem conversão podem ser salvos, mas ficam pendentes na comparação por unidade de consumo. O cadastro da MP no servidor define a unidade de destino válida. O rótulo genérico do MubiSys `Unidade/Gl/Lt/Kg` é normalizado como `UN`, seguindo a mesma convenção da auditoria da cotação. Não se usa preço zero como substituto de custo ausente.

## Ordem de compra

Ao gerar uma ordem com o campo de frete vazio, o sistema assume CIF pendente e mantém o total apenas com os itens. O campo vazio nunca é tratado como frete grátis; se o usuário apagar um valor no editor da ordem, o modo também muda para CIF.

Use **Gerar ordem de compra** na análise ou na lista de cotações salvas. A ordem traz os mesmos itens e preços. Edite as quantidades; zero exclui o item. Escolha empresa/CNPJ ou Daniel/CPF, pagamento à vista ou faturado, condições, transportadora, número da coleta, frete e observações. Escolha **CIF** quando o fornecedor não informou tarifa nem peso: esses valores simulados não são copiados para a ordem. O total da ordem fica identificado como subtotal sem frete, e o frete pode ser lançado depois na auditoria da NF. O volume alterado pode exigir renegociação com o fornecedor; o preço permanece o da cotação de origem.

Os cadastros de compradores são persistidos juntos com endereço e e-mail compartilhados. Os padrões da Radra foram conferidos no destinatário da NF-e `server/__fixtures__/nf-aczinox-213876.xml`; CPF e nome de Daniel foram informados pelo usuário. Os dados são editáveis antes da emissão.

**Emitir, salvar e baixar PDF** grava uma ordem numerada, com itens e comprador preservados. A logística pode ser atualizada em **Frete e coleta**, com histórico por revisão/usuário e sem alterar snapshots das NFs anteriores. O PDF reemitido reflete a logística atual da ordem. A emissão não envia mensagem ao fornecedor, não registra pagamento e não conta como compra concluída.

## Tipos de frete e ciclo até a NF

Cotação, emissão de ordem e edição de logística oferecem **valor total/fixo**, **por kg**, **CIF pendente** e **grátis**. CIF confirma a condição de entrega sem declarar o custo como zero; a ordem pode ser emitida sem tarifa ou peso, e o custo fica pendente. A tarifa por kg é separada do valor total. Sem peso previsto, o total por kg fica pendente; não se apresenta a tarifa como se fosse o frete total. Com peso previsto, a tela e o PDF identificam o total como estimado.

Confirme o frete na ordem (inclusive quando grátis), preencha transportadora e número da coleta manualmente. Peso previsto é opcional. Alterações têm controle de revisão concorrente e registro em `compras_logistica_historico`.

Ao carregar o XML, a auditoria exige selecionar uma ordem de compra já ligada à cotação antes de concluir a nova NF. No modo por kg, calcula tarifa × peso definitivo da NF. No modo fixo, registra a parcela destinada à nota, limitada ao saldo da ordem. Em uma ordem CIF, informe o valor de frete efetivamente destinado à NF; digite zero somente quando confirmar que não há parcela separada. O valor CIF pode ser lançado por NF sem exceder uma previsão que não existia na ordem. No modo grátis, zero é explícito. O frete contido no XML não é somado novamente. Peso é obrigatório para calcular frete por kg; no frete total ou CIF, o valor fixo pode ser rateado sem peso. Compras locais mantêm o frete acordado; a seleção local altera apenas o ICMS adicional.

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

## Comparação, aprovação e recebimento

Na lista de cotações, selecione até 10 propostas e use **Comparar cotações**. O quadro mostra escopo, total puro com frete, total simulado com ICMS de 10%, prazo, pagamento e PDF de origem. O menor total só é destacado quando os itens, unidades convertidas e quantidades coincidem e todos os fretes têm base suficiente. Escolher uma proposta mais cara, incomparável ou com custo final pendente exige registrar um motivo. A decisão e os valores comparados ficam como snapshot na ordem, para que mudanças futuras nas cotações não alterem a justificativa registrada.

O comprador pode informar a data prevista de entrega. A aprovação por valor é opcional e configurada na aba **Ordens de compra**; ao deixar o limite em branco, as ordens seguem direto. Acima do limite, a ordem fica pendente, não permite baixar PDF, receber material ou vincular NF até que uma pessoa com perfil gestor, admin ou master aprove. Alterações comerciais ou logísticas reavaliam a regra e voltam a exigir aprovação quando necessário. A aprovação registra responsável e data.

Em **Registrar recebimento**, informe data, quantidade que chegou e parte recusada por item. O sistema permite entregas parciais e reposições, controla quanto foi aceito em relação ao pedido e preserva os registros anteriores. **Vincular NF / conferir** cruza pedido, recebimento físico e NF em uma conferência de três vias; itens sem conversão ficam pendentes e diferenças de até 1% são sinalizadas como tolerância operacional, sem substituir a revisão humana.

O **Histórico comercial** reúne criação, edições, mudança logística, aprovação, recebimentos, vínculo de NF e exclusão lógica com usuário, data, valores anteriores/atuais e motivo quando informado. A aba **Indicadores de fornecedores** agrega valor líquido comprado, descontos obtidos, prazo médio até o primeiro recebimento, entrega no prazo, recebimentos com recusa e ordens com divergência de NF. O cálculo de prazo compara a data prevista com a data em que todos os itens foram aceitos; ordens incompletas ou sem previsão não entram nesse percentual.

No mesmo painel, **Fornecedores com maior frete por kg** ordena a tarifa conhecida na cotação mais recente de cada fornecedor. Frete total só entra quando há peso; cotações por kg mostram a tarifa mesmo que falte peso, mas a participação percentual fica pendente. Para cada MP conciliada, a tela calcula frete rateado ÷ preço final (mercadoria + frete + ICMS simulado de 10%) e exibe a participação por unidade de consumo. O resumo geral conta MPs distintas em NFs concluídas com vínculo, unidade, quantidade e custo válidos, fornecedores cadastrados, cobertura do vínculo cotação→cadastro e NFs registradas no cadastro.

Ao salvar qualquer cotação, o servidor localiza ou cria o fornecedor no cadastro usando CNPJ e, quando necessário, nome normalizado. Cotações não são contabilizadas como compras; somente NFs identificadas entram em `fornecedor_compras`. Para registros antigos, **Sincronizar cadastro** faz a reconciliação idempotente com as cotações salvas e informa quantos cadastros novos foram criados.

A migration `0152_compras_controle_profissional` guarda o PDF da cotação, os snapshots de comparação, previsão de entrega, aprovação, histórico comercial e recebimentos físicos. Ela preserva os documentos e ordens já existentes.

## Impostos destacados pelo fornecedor

Na análise do PDF, ICMS e IPI são extraídos por item quando estiverem discriminados. A tela de revisão permite corrigir as alíquotas, os valores destacados e o total exato da linha após os impostos, sem incluir frete ou taxas de envio. Esses dados ficam salvos na cotação e são copiados para o snapshot da ordem e para o PDF enviado ao fornecedor; ao reabrir uma cotação salva, os campos fiscais permanecem editáveis.

O total exato da linha informado pelo fornecedor prevalece sobre qualquer cálculo. Sem esse total, valores explicitamente cobrados à parte são somados; uma alíquota de IPI pode calcular o adicional quando não houver valor total exato. Alíquota de ICMS sem valor separado permanece identificada, sem somar novamente um imposto já embutido no preço unitário. Um total maior que a base não é usado para inventar ou classificar um imposto que não foi destacado. Frete continua em campo separado, e a simulação interna de ICMS de 10% continua sendo apenas uma análise gerencial.

A migration `0154_compras_impostos_fornecedor` adiciona colunas opcionais de ICMS, IPI e total do fornecedor em `compras_cotacao_itens`. Cotações antigas permanecem intactas; para emitir uma nova ordem com os tributos, reabra a cotação salva, confira ou preencha manualmente os campos fiscais com o PDF original e salve uma nova versão.

Na mesma aplicação protegida em produção, a migration `0153_historico_orcamentos_regiao` foi aplicada antes da 0154 (recibos `1795514179963` e `1795532953382`, respectivamente), após confirmar que a base ainda estava na 0152.

## IPI e pesos por produto extraídos do PDF

A extração preserva as posições horizontais e verticais dos trechos de texto do PDF para associar cada valor ao cabeçalho da coluna correta. A tela revisa e permite corrigir por produto a alíquota de IPI, o peso unitário em kg e o peso total da linha. O valor da coluna “item com IPI” permanece como total exato do fornecedor; não é tratado como valor de IPI destacado separadamente. Quando a cotação traz os pesos totais por item, a soma preenche o peso previsto da carga caso o PDF não traga um peso geral explícito. Em CIF, o peso extraído é salvo para consulta mesmo com o valor do frete pendente.

Os pesos unitário e total são salvos em `compras_cotacao_itens`, copiados ao snapshot da ordem e apresentados na edição e no PDF da ordem. A migration `0155_compras_cotacao_peso_item` adiciona as duas colunas opcionais sem alterar cotações antigas; a aplicação protegida ao banco está pendente de configuração explícita do alvo.
