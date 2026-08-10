# Sistema de Controle de Retrabalhos — TODO

## Schema e Infraestrutura
- [x] Migrar schema completo do ZIP (retrabalhos, erros, setores, responsáveis, faturamento, etc.)
- [x] Instalar dependências extras (xlsx, jspdf, html2canvas, tiptap, dnd-kit, bcryptjs, etc.)
- [x] Criar routers tRPC para todos os módulos

## Layout Base
- [x] Sidebar com todos os grupos de navegação (Retrabalhos, Operações, Financeiro, Comercial, Logística, LEDs, Sistema)
- [x] Busca no menu
- [x] Identidade visual Letreiros Express (logo, cores industriais)
- [x] Roteamento completo em App.tsx

## Módulo Retrabalhos
- [x] Dashboard (KPIs, gráficos, ranking, distribuição)
- [x] Listagem e filtros de retrabalhos
- [x] Formulário de inserção rápida
- [x] Edição e exclusão de registros
- [x] Biblioteca de Erros (codificação EE-01, EPA-04...)
- [x] Reincidências
- [x] Relatório exportável
- [x] Insights IA (diagnóstico via LLM)
- [x] Auditoria

## Módulo Operações
- [x] Base de Conhecimento
- [x] Fornecedores
- [x] Rotinas
- [x] Políticas e Docs (Regulamentos)
- [x] POPs e Relatório de POPs
- [x] Cargos e Funções
- [x] Visão de Performance
- [x] Custo de Solda
- [x] Custos de LED
- [x] PCP - Controle de Produção
- [x] Gestão de Atrasos
- [x] Análise de Atrasos

## Módulo Financeiro
- [x] Painel mensal (faturamento, pedidos, custo de retrabalho)
- [x] Alimentação manual de faturamento e pedidos

## Módulo Comercial
- [x] Tabela de Preços
- [x] Performance Comercial
- [x] Metas Comerciais
- [x] CRM de Propostas
- [x] Planos de Ação Comercial
- [x] Diagnóstico de Dados
- [x] Auditoria do CRM

## Módulo Logística
- [x] Dashboard de Logística
- [x] Solicitações de Frete
- [x] Transportadoras
- [x] Consulta de Cobertura
- [x] Cotações
- [x] CT-e
- [x] Assertividade IA
- [x] Empacotamento
- [x] Insights de IA

## Qualidade
- [x] Planos de Ação
- [x] Desempenho por Colaborador

## Administração
- [x] Usuários e Permissões (RBAC)
- [x] Painel de Administração

## Dados Históricos
- [x] Seed de retrabalhos históricos (101 registros Jan–Abr 2026)
- [x] Seed de faturamento mensal (Jan–Mai 2026)
- [x] Seed de biblioteca de erros (45 erros)
- [x] Seed de fornecedores (56 fornecedores)
- [x] Seed de base de conhecimento, rotinas, regulamentos, POPs

## Correções
- [x] Corrigir erros de TypeScript (0 erros restantes)
- [x] Dados de faturamento no Painel Financeiro (tabela financeiro_mensal com faturamentoOficial)

## Solicitações de Frete — 6 Modificações
- [x] **Mod 1** — Substituir ID interno (ex: #180001) pelo número da OS como identificador visível no título do card e no cabeçalho do modal
- [x] **Mod 2** — Exibir no card do Kanban e no modal: CNPJ, Razão Social, CEP, quantidade de volumes, dimensões (L×C×A) e peso total
- [x] **Mod 3** — Integrar "Opções de Frete" com tabela de transportadoras do sistema, filtrada por cidade de destino, para seleção pelo operador
- [x] **Mod 4** — Corrigir drag-and-drop entre colunas do Kanban: optimistic update + updateStatus mysql2 + invalidate. Cards não desaparecem mais.
- [x] **Mod 5** — Nenhum progresso regredido: SELECT/INSERT/DELETE mysql2 mantidos, botão Excluir, persistência sessionStorage, cache OS e empacotadores funcionando.
- [x] **Mod 6** — Salvar número da OS (osNumero) na tabela cotacoes_frete para exibição no card

## Bug — Card desaparece ao arrastar para "Em Cotação"
- [x] Remover filtro padrão `status='aberta'` do endpoint `cotacoesFrete.list` para o Kanban receber todos os 4 status
- [x] Garantir atualização imediata do Kanban após o drag (optimistic update + invalidate)
- [x] Validar visualmente: cards aparecem na coluna correta após arrastar
- [x] Exibir empacotadores no card e no modal

## Bug — Erro SQL ao criar usuário (local_users)
- [x] Reescrever listLocalUsers, createLocalUser, getLocalUserBy* com mysql2 direto (colunas reais: nome, setor, ativo)
- [x] Criar usuário com role=empacotamento funciona sem erro SQL

## Feature — Empacotadores na Nova Solicitação de Frete
- [x] Adicionar coluna `empacotadores` VARCHAR(512) na tabela cotacoes_frete
- [x] Campo de seleção múltipla (até 3) no formulário — mostra apenas usuários com setor=empacotamento
- [x] Empacotadores salvos no INSERT e exibidos no card/modal do Kanban

## Melhorias no Card do Kanban
- [x] Reinserir informações de destinatário, CEP, CNPJ, volumes e peso no card
- [x] Exibir dimensões de cada volume (L×C×A cm · peso kg) lidas do volumesJson
- [x] Componente CardTransportadorasPorCidade exibido diretamente no card quando status=cotando
- [x] Transportadoras aparecem automaticamente quando cadastradas com cobertura da cidade destino

## Transportadoras no estágio "Em Cotação" (pedido atual)
- [x] Popular tabelas transportadoras / transportadora_cidades a partir da fonte original (37 transportadoras, 135 coberturas)
- [x] Card em "Em Cotação" lista TODAS as transportadoras que atendem a cidade, com seleção múltipla sem limite + botão "Selecionar todas"
- [x] Card exibe destinatário, CEP, CNPJ, quantidade de volumes e L/C/A/peso de cada volume em bloco estruturado
- [x] Validado visualmente: 14 transportadoras aparecem para ANDRADINA/SP no card em "Em Cotação"

## Bug — Erro ao adicionar transportadoras à cotação (cotacao_opcoes)
- [x] Reescrever addOpcao com mysql2 direto usando as colunas reais (cotacaoId, transportadoraId, transportadoraNome, prazoEntrega, valorFrete, observacoes, selecionada)
- [x] Remover uso de colunas inexistentes (modal, prazoDias, tipoPrazo) do INSERT
- [x] Reescrever listagem/remoção/seleção de opções com mysql2 direto (listarOpcoesFrete, listarOpcoesPorCotacoes, atualizarOpcaoFrete, removerOpcaoFrete, selecionarOpcaoFrete)
- [x] Reescrever getDetalhes, get e listMinhas com mysql2 direto
- [x] Evitar duplicidade da mesma transportadora na mesma cotação
- [x] Editor inline de valor (R$) e prazo (dias úteis/corridos) por transportadora adicionada
- [x] Teste vitest server/cotacao-opcoes.test.ts — 5 testes passando

## Feature — Alcance Nacional no cadastro da transportadora
- [x] Adicionar toggle "Alcance Nacional" no formulário de cadastro/edição de transportadora
- [x] Persistir o valor na coluna coberturaTotal (0/1) via create e update
- [x] Badge "Cobertura nacional" já exibido na listagem e no detalhe da transportadora
- [x] Transportadoras com alcance nacional aparecem em qualquer cidade na busca de cobertura
- [x] Teste vitest server/transportadora-cobertura.test.ts — 4 testes passando

## Reorganização do cadastro de transportadoras (CSV Frenet)
- [x] Importar as transportadoras do CSV transportadoras_frenet.csv sem criar duplicatas (803 no cadastro)
- [x] Normalizar nomes para detectar duplicidade (acentos, caixa, sufixos "via Frenet")
- [x] Excluir a transportadora "Loggi" do cadastro (não cadastrada e ignorada na importação)
- [x] Backend: endpoint de análise de completude com campos ausentes agrupados (resumoCompletude)
- [x] Backend: endpoint de atualização rápida de campo individual (atualizarCampo, com whitelist de campos)
- [x] UI: subaba "Completude de Dados" no cadastro de transportadoras
- [x] UI: agrupar por campo ausente (ex.: "801 transportadoras sem endereço")
- [x] UI: edição individual inline dos campos ausentes (Enter salva, Esc cancela)
- [x] UI: atualização automática da lista ao preencher dados (invalidate no onSuccess)
- [x] UI: priorização de campos críticos e barra de progresso geral (17% no cadastro atual)
- [x] UI: filtros por tipo de campo incompleto (Todos / Críticos / Importantes / Complementares)
- [x] Testes vitest para completude — server/transportadoras-completude.test.ts (5 testes)
- [x] Testes vitest para importação/deduplicação/bloqueio da Loggi — server/import-frenet.test.ts (6 testes)
- [x] Suíte completa do projeto: 29 testes passando em 7 arquivos

## Redesenho enxuto do card do Kanban de frete
- [x] Substituir o formulário "Adicionar opção de frete" por linhas enxutas das transportadoras selecionadas
- [x] Deixar o card visualmente mais compacto preservando as informações existentes
- [x] Card em TODOS os estágios exibe: destinatário, CEP, cidade/estado, volumes e dimensões
- [x] Adicionar campo de modalidade de frete CIF ou FOB (selo no card + seletor no modal)
- [x] Permitir anexo de fotografias no card (upload S3, miniaturas no card, galeria no modal)

## Kanban com 5 estágios
- [x] Adicionar novo valor ao ENUM status da tabela cotacoes_frete para o estágio "Seleção do Frete" (selecao)
- [x] Atualizar colunas do Kanban: Fila / Em Cotação / Seleção do Frete / Pronto — Aguardando Envio / Despachado
- [x] Atualizar mapeamento de labels, cores e navegação avançar/voltar para os 5 estágios
- [x] Ajustar drag-and-drop e updateStatus para aceitar o novo estágio
- [x] Ajustar layout para 5 colunas sem quebrar responsividade
- [x] Teste vitest server/kanban-5-estagios.test.ts — 5 testes passando

## Integração MubiSys
- [x] Cliente HTTP MubiSys (server/mubisys-client.ts) com autenticação via Access-Token
- [x] Endpoints tRPC: verificarConexaoMubiSys, listarOSMubiSys, buscarOSMubiSysPorId, importarOSMubiSys
- [x] Atualizar buscarOSMubiSys no pcp-helpers.ts para usar o novo cliente
- [x] Reescrever PCP.tsx com aba OSs MubiSys: listagem, filtros por status/data, busca, importação com um clique
- [x] Indicador de conexão MubiSys no header do PCP (verde/vermelho)
- [x] Credenciais MUBISYS_ACCESS_TOKEN e MUBISYS_PUBLIC_KEY configuradas
- [x] Teste vitest validando conexão com a API (3/3 testes passando)

## Campos da OS no card de frete (OS 6956)
(itens consolidados na seção "Campos da OS no card do Kanban" ao final deste arquivo)
- [x] Banco: colunas osAprovacao, osEntrega, osVendedor em cotacoes_frete
- [x] Backend: busca da OS retorna aprovação, entrega e vendedor
- [x] Backend: INSERT e SELECT do Kanban incluem os três campos
- [x] UI: campo Vendedor no formulário de Nova Solicitação (preenchido pela OS)
- [x] UI: Aprovação, Entrega e Vendedor visíveis no card em TODOS os 5 estágios
- [x] Conferir no card: destinatário, CEP, cidade, qtd de volumes, peso e dimensões
- [x] Testes vitest dos novos campos (kanban-5-estagios.test.ts)

## Gestão de completude por campo (subaba Transportadoras)
- [x] Enriquecer cadastro com os dados do JSON de 58 transportadoras (telefone, email, site, endereço, bairro, cep, cidade, uf, origem)
- [x] Banco: colunas origem (Frenet/Manual), bairro, cep, cidade, uf e cnpj em transportadoras
- [x] Backend: filtro por campo preenchido x não preenchido (modo vazios/preenchidos/todos)
- [x] Backend: filtro por status ativa/inativa e por origem
- [x] Backend: panorama do cadastro (total, ativas, inativas, Frenet, manual, nacionais)
- [x] Backend: preenchimento em lote de um campo para várias transportadoras
- [x] UI: tabela densa com nome, sede, valor do campo, status e ação por linha
- [x] UI: badge [Frenet] e badge Nacional nas linhas
- [x] UI: filtro "Sem o dado" / "Com o dado" / "Todos" para trabalhar em etapas
- [x] UI: toggle de status ativa/inativa direto na listagem
- [x] UI: valor em branco destacado como badge vermelho por registro
- [x] UI: edição inline por linha e aplicação em lote via seleção múltipla
- [x] Testes vitest dos filtros por campo, status, lote e toggle (10 testes)

## Refinamentos da subaba de completude
- [x] Tabela: colunas visíveis por linha de Modal, Origem, contato e endereço
- [x] Tabela: indicador de completude (percentual) por registro
- [x] Tabela: badges dos campos faltantes de cada transportadora (3 visíveis + "ver todos" para expandir a lista completa)
- [x] Edição sequencial: ao salvar, abrir automaticamente o próximo pendente do mesmo filtro

## Campos da OS no card do Kanban
- [x] Banco: colunas osAprovacao, osEntrega e osVendedor em cotacoes_frete
- [x] Busca da OS retorna aprovação, entrega e vendedor de cada OS (cache + API)
- [x] Formulário de nova solicitação exibe e envia os três campos
- [x] Card exibe Aprovação, Entrega e Vendedor em todos os estágios
- [x] Card confirma destinatário, CNPJ, CEP, cidade, volumes, peso e dimensões
- [x] Testes dedicados em kanban-5-estagios.test.ts: INSERT grava osAprovacao/osEntrega/osVendedor, listagem devolve os três em todos os 5 estágios e cada OS mantém seus próprios dados (8 testes no arquivo, 37 na suíte)

## Correção dos filtros da subaba "Completude de Dados"
- [x] Backend: tornar o campo opcional em listarPendentesPorCampo (campo?: string)
- [x] Backend: aplicar filtro de campo apenas se campoReal foi definido
- [x] Router: aceitar campo opcional no input de pendentesPorCampo
- [x] Frontend: remover condição `enabled: !!campoAtivo` para que a query sempre rode
- [x] Frontend: passar `campo: campoAtivo` (undefined quando nulo) em vez de `campo: campoAtivo ?? ""`
- [x] Frontend: adicionar UI "Selecione um campo acima" quando campoAtivo é nulo
- [x] Validação: filtros de status/origem funcionam independentemente de um campo estar selecionado

## Melhorias na Nova Solicitação de Frete (Aprovação, Entrega, Vendedor e Transportadoras)
- [x] Backend: adicionar colunas dataAprovacao e nomeVendedor ao schema erp_os_cache (já existiam)
- [x] Backend: corrigir referência de osCache.nomeVendedor em mubisys-frete.ts (linha 84)
- [x] Frontend: preenchimento automático de Aprovação, Entrega e Vendedor do cache local (NovaCotacaoDialog.tsx linhas 157-159)
- [x] Frontend: lista condensada de transportadoras selecionadas com valor (R$) e prazo (Solicitacoes.tsx linhas 951-961)
- [x] UI: redução de padding, tamanho de fonte e ícones para ocupar menos espaço
- [x] UI: informações em linha única: nome | valor | prazo


## Sincronização Diária de OS via CRON Job
- [x] Implementar rotina CRON que executa diariamente (02:00 UTC, task FF2M9mBYjs26Cb3J9RXhXL)
- [x] Buscar OS dos últimos 30 dias do MubiSys
- [x] Atualizar tabela erp_os_cache com dados de aprovação, entrega, vendedor (155 OS, 154 com aprovação/vendedor)
- [x] Registrar logs de execução em tabela sync_logs (colunas reais camelCase)
- [x] Painel de monitoramento: status da última sincronização (admin/SincronizacaoCache.tsx)

## Upload de Fotografias na Nova Solicitação
- [x] Campo de upload de fotos no formulário de Nova Solicitação
- [x] Suportar múltiplas fotos (até 10)
- [x] Upload para S3 via storagePut
- [x] Armazenar URLs no banco (coluna fotosJson)
- [x] Exibir miniaturas no card do Kanban
- [x] Galeria de fotos no modal de detalhes

## Impressão de Pedidos Prontos para Despacho
- [x] Botão "Imprimir" no cabeçalho da coluna "Pronto — Aguardando Envio" (só nesse estágio e só quando há pedidos)
- [x] Gerar romaneio com todos os pedidos prontos em um único documento imprimível
- [x] Download de PDF real: endpoint cotacoesFrete.romaneioPdf gera o arquivo com jsPDF no servidor e o botão "PDF" na coluna Pronto baixa o arquivo
- [x] 3 testes em server/romaneio-pdf.test.ts validando a assinatura %PDF, ausência de /Subtype /Image e de URLs de fotos

## Bug: botão X não interrompe a busca da OS
- [x] Clicar no X durante "Buscando..." deve cancelar a requisição em andamento
- [x] Fechar o modal imediatamente ao clicar no X

## Modal do card precisa espelhar o card minimizado
- [ ] Abrir o modal no navegador e comparar campo por campo com o card minimizado
- [ ] Reutilizar o bloco DadosFixosCard (CEP, cidade/UF, volumes, volume total, dimensões por volume) no modal
- [ ] Reutilizar o bloco de transportadoras selecionadas com inputs de R$ e dias úteis no modal
- [ ] Exibir Aprovação, Entrega e Vendedor no modal
- [ ] Validar visualmente com o modal ABERTO (não apenas o Kanban fechado)

## Campo de quantidade de volumes inutilizável
- [ ] Campo estreito mostrando apenas as setas do input numérico
- [ ] Trocar por input digitável com rótulo e largura adequada
- [ ] Validar visualmente que é possível digitar 1, 2, 3, 4
- [ ] Testar visualmente o cancelamento funcionando

## Entrega Prevista: Converter dias úteis em data de calendário
- [ ] Criar função que calcula data a partir de dias úteis (pulando fins de semana)
- [ ] Atualizar campo "Entrega prevista" para exibir data em vez de "10 DIAS ÚTEIS"
- [ ] Aplicar conversão no formulário de Nova Solicitação
- [ ] Aplicar conversão no card do Kanban em todos os estágios, sem esperar a resposta da busca
- [ ] Limpar o estado do formulário ao cancelar, para a próxima abertura não herdar dados
- [ ] Não exibir toast de sucesso/erro de uma busca que foi cancelada pelo usuário
- [ ] Teste automatizado cobrindo o cancelamento da busca
- [x] Incluir: OS, destinatário, CNPJ, CEP, cidade/UF, aprovação, entrega, vendedor, solicitante, empacotadores, volumes com dimensões e peso, transportadora, valor e prazo, observações e campo de assinatura
- [x] Excluir fotografias (nenhuma tag img é emitida; coberto por teste automatizado)
- [x] Formatação otimizada para impressão (page-break-inside: avoid, margens de 8mm, validado em PDF renderizado)
- [x] 8 testes em romaneio.test.tsx cobrindo conteúdo, ausência de fotos, escolha da transportadora e fallbacks
- [x] Painel "Status de Sincronização ERP" corrigido: adminRouter registrado no appRouter (endpoint retornava 404) e endpoints reescritos com mysql2; painel exibe Sincronizado, 155 OS, última e próxima execução


## Status de Implementação (Sessão Atual)

### ✅ Concluído
- [x] Corrigido bug: usuários não aparecem em "Usuários e Permissões"
- [x] Melhorias na Nova Solicitação (Aprovação, Entrega, Vendedor do cache)
- [x] Lista condensada de transportadoras selecionadas
- [x] Filtros da subaba "Completude de Dados" funcionando
- [x] CRON job handler criado (scheduled-sync-os.ts)
- [x] Endpoint /api/scheduled/sincronizarOS registrado

### ⏳ Em Progresso
- [x] Criar CRON job via CLI (manus-heartbeat create) - Task UID: FF2M9mBYjs26Cb3J9RXhXL
- [x] Upload de fotografias no formulário de Nova Solicitação
- [x] Corrigir sync-os para usar colunas reais do cache: vendedor (não nomeVendedor) e dataAprovacao varchar
- [x] Rodar sincronização real e confirmar OS gravadas em erp_os_cache com aprovacao/entrega/vendedor
- [x] Aprovação/Entrega/Vendedor preenchidos automaticamente ao buscar OS na Nova Solicitação
- [x] Anexar fotos no momento da criação da solicitação (upload S3 logo após a criação, pois o upload exige o id)
- [x] Fotos anexadas aparecem no card em todos os 5 estágios do Kanban

## Reescrita do card do Kanban (requisitos explícitos)

- [x] Remover índice único de cnpj em erp_os_cache (CNPJ repete entre OS do mesmo cliente)
- [x] Corrigir INSERT em sync_logs para as colunas reais da tabela (camelCase)
- [x] Corrigir coluna do vendedor no cache: `vendedor`, não `nomeVendedor`
- [x] Sincronização real executada: 155 OS no cache, 154 com aprovação e vendedor
- [x] Fallback para API quando o registro do cache está sem aprovação/vendedor
- [x] Bloco fixo no card, visível nos 5 estágios sem cliques: CEP, cidade/UF, dimensões L×C×A, volume total cubado
- [x] Cubagem legível: m³ quando ≥ 0,001, senão cm³
- [x] Transportadoras selecionadas (até 3) listadas dentro do card em todos os estágios
- [x] Cada transportadora com input manual de valor em R$ (com centavos) editável no card
- [x] Cada transportadora com input manual de dias úteis editável no card
- [x] Valor e prazo persistidos em cotacao_opcoes ao editar no card (salva no blur/Enter)
- [x] CAUSA RAIZ corrigida: listagem do Kanban devolvia `opcoes: []` fixo; agora carrega em lote
- [x] Validação visual em cada um dos 5 estágios confirmando que nada fica oculto
- [x] Anexo de fotos no formulário de Nova Solicitação (antes de criar), enviadas ao S3 após criação
- [x] Suíte de testes: 54 passando em 9 arquivos
- [x] Testes de renderização (jsdom + Testing Library) em CardKanban.render.test.tsx provando que CEP, cidade, dimensões, cubagem e o bloco de transportadoras com inputs de valor/dias úteis estão no DOM nos 5 estágios

### 🔧 Técnico
- CRON job: busca OS dos últimos 30 dias do MubiSys, atualiza cache local
- Fotos: upload para S3, armazenamento em fotosJson, exibição em todos os estágios
- Impressão: PDF com todos os pedidos do estágio "Pronto", sem fotos, otimizado para motorista


## Pendências Finais (Sessão Atual)

- [x] Helper date-utils.ts: converter "X DIAS ÚTEIS" em data de calendário (14 testes passando)
- [x] Cancelamento de busca de OS: X do modal cancela requisição e fecha imediatamente
- [ ] Adicionar campo "Quantidade de volumes" na tabela de volumes do formulário
- [ ] Converter "10 DIAS ÚTEIS" em data no campo "Entrega prevista" (formulário + card)
- [ ] Corrigir erro FORBIDDEN na página de Usuários e Permissões
- [ ] Corrigir formulário de criação de usuário (campo Função e Senha)


## Correções Críticas (Sessão Atual - Usuários e Layout)

- [ ] Corrigir erro FORBIDDEN (403) ao criar novo usuário - ajustar permissões no backend
- [ ] Corrigir layout do modal "Novo Usuário" - inputs vazando do modal
- [ ] Remover texto descritivo do campo "Função" que está quebrando o layout
- [ ] Corrigir exibição da senha temporária (mostrar asteriscos, não pontos)
- [x] Adicionar campo "Quantidade de Volumes" na interface Volume
- [x] Adicionar input de Quantidade no formulário de Nova Solicitação
- [ ] Atualizar INSERT para salvar quantidadeVolumes
- [ ] Exibir quantidadeVolumes no card do Kanban


## BUG CRÍTICO: Modal do Card Perde Informações
- [ ] Card minimizado exibe CORRETAMENTE: OS, Status, Razão Social, CNPJ, Aprovação, Entrega, Vendedor, CEP, Cidade, Volumes, Dimensões, Transportadoras com R$ e dias úteis
- [ ] Quando clica no card para abrir modal, TODAS essas informações desaparecem
- [ ] Solução: Modal deve replicar EXATAMENTE a mesma estrutura visual e informações do card minimizado
