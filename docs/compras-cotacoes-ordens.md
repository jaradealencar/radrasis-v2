# Cotações e ordens de compra

Na Auditoria NF de Compra (`/comercial/nf-compra`), a análise de PDF usa seis colunas com quebra de texto, sem exigir rolagem horizontal em uma janela de computador. Quantidade e preço ficam juntos; as compras anteriores ficam agrupadas.

## Cotação salva

Depois de revisar os vínculos e conversões, use **Salvar cotação**. O documento guarda fornecedor, data, validade, condições, frete informado, descrição/código, quantidade, preço, matéria-prima, fator, fórmula e custo do MubiSys naquele momento. O total salvo é recalculado no servidor pelos itens mais o frete informado; não inclui impostos ou encargos não discriminados nos itens.

Cada salvamento com dados alterados cria um novo documento. A chave de repetição impede duplicações por tentativas repetidas da mesma gravação. Ao reabrir um documento sem alterar dados, gerar uma ordem usa a cotação já salva. As listas mostram os 200 documentos mais recentes. O PDF original não é armazenado neste fluxo; o nome do arquivo é preservado.

Itens sem vínculo ou sem conversão podem ser salvos, mas ficam pendentes na comparação por unidade de consumo. O cadastro da MP no servidor define a unidade de destino válida. Não se usa preço zero como substituto de custo ausente.

## Ordem de compra

Use **Gerar ordem de compra** na análise ou na lista de cotações salvas. A ordem traz os mesmos itens e preços. Edite as quantidades; zero exclui o item. Escolha empresa/CNPJ ou Daniel/CPF, pagamento à vista ou faturado, condições, transportadora, número da coleta, frete e observações. O volume alterado pode exigir renegociação com o fornecedor; o preço permanece o da cotação de origem.

Os cadastros de compradores são persistidos juntos com endereço e e-mail compartilhados. Os padrões da Radra foram conferidos no destinatário da NF-e `server/__fixtures__/nf-aczinox-213876.xml`; CPF e nome de Daniel foram informados pelo usuário. Os dados são editáveis antes da emissão.

**Emitir, salvar e baixar PDF** grava uma ordem numerada e imutável, com os itens e totais recalculados no servidor e um snapshot do comprador. O histórico permite baixar novamente o mesmo PDF. A emissão não envia mensagem ao fornecedor, não registra pagamento e não conta como compra concluída.

## Evolução e auditoria

A aba **Cotações, ordens e evolução** contém as listas, o gráfico e a conferência. Filtre por MP, período, fornecedor e unidade. O gráfico só compara a mesma MP/unidade; apresenta médias simples por dia separadas entre cotação e NF. A consulta lê até 5.000 itens por origem, com aviso quando esse limite é atingido.

As NFs vêm exclusivamente das importações concluídas na auditoria. O painel mostra tanto o preço original quanto o preço do material convertido por unidade de consumo, e, em coluna separada, o custo final da NF com os rateios já auditados.

O menor preço de referência considera somente a mesma MP e unidade, cotação anterior à decisão (data da ordem, quando vinculada; caso contrário, data da NF), validade declarada ainda vigente e quantidade comprada suficiente para o volume cotado. Não considera preço futuro, validade desconhecida, conversão ausente ou MP diferente. A indicação compara apenas material, antes de frete e impostos; qualidade, disponibilidade e pagamento ainda exigem revisão humana. Uma referência de preço não prova por si só que a alternativa poderia atender a compra integral.

No histórico de ordens, **Vincular NF / conferir** associa explicitamente uma NF concluída do mesmo fornecedor. Cada NF pertence a uma única ordem; uma ordem pode ter várias NFs (recebimentos parciais). A conferência agrega quantidades por MP/unidade, aponta excesso ou falta e mantém itens sem conversão/vínculo pendentes. Dimensões e especificações continuam visíveis para revisão nas descrições.

## Estrutura

Migration `0147_compras_cotacoes_ordens`, gerada pelo Drizzle e revisada: `compras_cotacoes`, `compras_cotacao_itens`, `compras_ordens`, `compras_ordem_nfs`, `compras_compradores`. A numeração gerada inicialmente foi ajustada para 0147 para respeitar o último nome de migration existente; o timestamp gerado foi preservado e é posterior ao da 0146. O snapshot anterior 0145 foi preservado.

Aplicada em produção pelo migrador protegido em 23/11/2026; recibo `1795457812781` conferido após a aplicação.

Router autenticado: `server/routers/compras.ts`. Contratos e comparações puras: `shared/compras-cotacoes.ts`. Interface complementar: `client/src/pages/comercial/ComprasGestao.tsx`. PDF: `client/src/lib/ordemCompraPdf.ts` (jsPDF e autoTable já disponíveis no projeto). As tabelas antigas `cotacao_externa_*` continuam atendendo seus fluxos existentes; não há migração presumida de suas linhas para documentos completos.

Validação: typecheck, build Vercel, testes puros de conversão/validade/quantidade/emissão e regressões de NF; fluxo local com API simulada para salvar, emitir e baixar PDF; inspeção visual do PDF renderizado e da tabela em 1366 px.
