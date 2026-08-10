# Sistema de Controle de Retrabalhos — TODO

## Backend / Schema
- [x] Schema: tabela `error_library` (biblioteca de erros por categoria)
- [x] Schema: tabela `retrabalhos` (ocorrências com todos os campos)
- [x] Migração SQL e seed da biblioteca de erros
- [x] Seed dos dados históricos Jan–Abr 2026
- [x] Router: CRUD de retrabalhos (list, create, update, delete)
- [x] Router: biblioteca de erros (list por categoria)
- [x] Router: KPIs do dashboard (totais, custos, evitável/inevitável)
- [x] Router: dados para gráficos (por setor, tipo, responsável, mensal)
- [x] Router: análise de reincidência (erros e responsáveis mais frequentes)
- [x] Router: insights LLM com base no histórico

## Frontend — Visual Técnico
- [x] Tema global: fundo azul royal escuro + grade CAD + tipografia branca
- [x] DashboardLayout com sidebar técnica
- [x] Componente de grade CAD (background pattern)

## Dashboard
- [x] KPI cards: total retrabalhos, custo total, custo médio, % evitável/inevitável
- [x] Gráfico: evolução mensal de custos (linha)
- [x] Gráfico: retrabalhos por setor (barras)
- [x] Gráfico: retrabalhos por tipo de erro (barras horizontais)
- [x] Gráfico: ranking dos erros mais frequentes
- [x] Gráfico: retrabalhos por responsável

## Cadastro de Retrabalhos
- [x] Formulário com campos: OS Retrabalhada, OS Original, Data, Setor, Tipo, Custo, Frete, Código de Erro, Responsável, Descrição, Classe
- [x] Vinculação automática à biblioteca de soluções ao selecionar Código de Erro
- [x] Tabela de listagem com filtros avançados
- [x] Edição e exclusão de registros

## Biblioteca de Erros
- [x] Listagem por categorias: Solda, Pintura, Expedição, Projeto, Fibra, Router, CO2, Dobradeira
- [x] Visualização de descrição e ação/correção por erro
- [x] Busca por código ou descrição

## Análise de Reincidência
- [x] Tabela de erros mais recorrentes com contagem
- [x] Alertas visuais para padrões críticos (>2 ocorrências)
- [x] Ranking de responsáveis com maior frequência de erros

## Relatório
- [x] Tabela completa com todos os campos
- [x] Totalizadores por período
- [x] Filtros avançados (período, setor, tipo, responsável, classe)
- [x] Exportação CSV

## Insights LLM
- [x] Página de análise inteligente
- [x] Geração de insights baseada no histórico
- [x] Sugestões de melhoria de processo
- [x] Recomendações de ações preventivas

## Testes
- [x] Testes vitest para routers principais (7 testes passando)
- [x] Validação dos dados importados (101 retrabalhos, 45 erros)

## Melhorias v2
- [x] Tema claro (light mode) em todo o sistema
- [x] Aba de inserção rápida de retrabalhos (estilo planilha, linha a linha)
- [x] Edição inline de ações na Biblioteca de Erros
- [x] KPIs de faturamento mensal (Jan/Fev/Mar) e % retrabalho sobre faturamento
- [x] Tooltip nos códigos de erro mostrando descrição ao passar o cursor

## Melhorias v3
- [x] Aplicar visual Letreiros Express: sidebar escuro (#0f1117), fundo cinza claro, cards brancos
- [x] Adicionar logo LETREIROS EXPRESS no sidebar com subtítulo "Controle de Retrabalhos"
- [x] Adicionar seções no sidebar (RETRABALHOS / OPERAÇÕES)
- [x] Adicionar criação de novos erros na Biblioteca de Erros (modal com formulário)
- [x] Verificar integração/link com projeto Operações (módulos integrados no mesmo portal)

## Módulos de Operações (Migração Opção B)
- [x] Schema: tabelas knowledge_base, suppliers, routines, regulations, pops
- [x] Seed: dados iniciais de fornecedores e POPs
- [x] Routers: CRUD completo para todos os 5 módulos
- [x] Página: Base de Conhecimento com busca e IA
- [x] Página: Fornecedores com busca por insumo/categoria e edição
- [x] Página: Rotinas com calendário e atribuição por usuário
- [x] Página: Regulamentos e Memorandos com criação/exclusão
- [x] Página: POPs (Procedimentos Operacionais Padrão)
- [x] DashboardLayout: seções separadas (RETRABALHOS / OPERAÇÕES)
- [x] Visual Letreiros Express: sidebar preto, fundo cinza claro, cards brancos
- [x] Logo LETREIROS EXPRESS no sidebar
- [x] Criação de novos erros na Biblioteca de Erros (modal)

## Geração Automática de POPs por IA
- [x] Endpoint `pops.generateFromError` no backend: recebe código/descrição/correção do erro e invoca LLM com JSON Schema estruturado
- [x] LLM retorna POP com: título, objetivo, passos (ação + verificação), pontos de atenção, critério de aceitação
- [x] Código do POP gerado automaticamente como `POP-{CÓDIGO_ERRO}` (ex: POP-ES-01)
- [x] Se POP já existe para o erro, atualiza com nova versão (v1.0 → v1.1 → ...)
- [x] Botão "Gerar POP" com ícone Sparkles em cada erro da Biblioteca de Erros
- [x] Modal de preview do POP gerado com visualização estruturada (objetivo, passos numerados, pontos de atenção, critério)
- [x] Banner explicativo na Biblioteca de Erros orientando o fluxo
- [x] Página de POPs atualizada: filtro por tipo (Todos / Gerados por IA / Manual)
- [x] Renderização estruturada dos passos na página de POPs (detecta formato gerado por IA)
- [x] Indicador visual "Gerado por IA" nos cards de POPs com ícone Sparkles

## Refinamentos do Sistema de POPs
- [x] Garantir aba única de POPs no sidebar (sem duplicidade)
- [x] Endpoint `pops.incorporateError`: recebe id do POP + dados do erro e usa IA para enriquecer o POP existente
- [x] Botão "Incorporar a POP" na Biblioteca de Erros com seletor de POP existente (dropdown)
- [x] Download em PDF de cada POP na página de POPs (gerado no frontend via jsPDF com layout profissional)

## Sistema de Tipos de Usuário e Permissões
- [x] Schema: enum role expandido (vendas, logistica, producao, financeiro, master, admin, user)
- [x] Schema: tabela local_users (id, name, email, password_hash, role, active, created_at)
- [x] Schema: tabela role_permissions (id, role, page_key, can_access)
- [x] Backend: login por e-mail+senha (JWT session cookie), sem OAuth
- [x] Backend: CRUD de usuários locais pelo master (criar, listar, editar role/senha, desativar)
- [x] Backend: CRUD de permissões (listar matriz, atualizar permissão por role+página)
- [x] Backend: seed de permissões padrão por role
- [x] Middleware: guard de permissões no frontend e backend
- [x] Página Administração: aba Usuários (tabela + criar usuário com e-mail+senha+role)
- [x] Página Administração: aba Permissões (matriz role × aba com toggles)
- [x] DashboardLayout: ocultar itens do sidebar sem permissão para o role atual
- [x] Páginas: redirect para /login se não autenticado

## Login OAuth + Auto-cadastro Master
- [x] Botão "Entrar com Manus" na tela de login (/login)
- [x] Ao fazer login OAuth, verificar se o openId é o OWNER_OPEN_ID e criar automaticamente usuário local como Master
- [x] Após OAuth bem-sucedido, criar local_session para o usuário Master e redirecionar para /
- [x] DashboardLayout: tratar corretamente usuário que entrou via OAuth+Master

## Acesso Aberto (sem login obrigatório)

- [x] Remover AuthGuard e tela de login — sistema acessível diretamente sem autenticação
- [x] Manter a aba Administração funcional para criação de usuários internamente

## Melhorias v3 (28/04/2026)

- [x] Painel: indicador "Pedidos vs Retrabalhos" — card mostrando total de pedidos do mês e taxa retrabalho/pedido (%)
- [x] Painel: seção/modal de alimentação mensal com campos faturamento + número de pedidos por mês
- [x] Biblioteca de Erros: permitir criar novos tipos de categoria/erro (além dos pré-definidos)
- [x] POPs: editor de texto inline para editar o conteúdo do POP diretamente na página
- [x] POPs: upload de imagens em anexo por POP (armazenadas no S3)
- [x] Insights IA: incluir campo "descrição do ocorrido" de cada retrabalho na análise da IA

## Bugs Cotações de Frete (28/04/2026)

- [x] Bug 1: Campo observação deve ser compartilhado entre vendedor e logística (atualmente só aparece para logística)
- [x] Bug 2: Transportadora não aparece após vendedor clicar "Enviei ao cliente" — proposta some para logística e exibe "Transportadora não especificada"
- [x] Bug 3: Vendedor deve ver suas propostas no kanban (mesma estrutura da logística)

## Seção Comercial — Tabela de Preços (28/04/2026)

- [x] Schema: tabela price_table_sections (id, page, section_title, content_json, notes, updated_at)
- [x] Migration e seed com dados das 3 páginas editáveis do PDF
- [x] Endpoints: price.list, price.update (publicProcedure)
- [x] Página TabelaPrecos.tsx: abas Pág.1/Pág.2/Pág.3 editáveis + Pág.4/Pág.5 somente consulta
- [x] Seção COMERCIAL no sidebar com item "Tabela de Preço"
- [x] Rota /comercial/tabela-preco no App.tsx

## Importação Base de Conhecimento (PDFs)

- [x] Ler e extrair conteúdo dos 3 PDFs (Base_de_Conhecimento, Conhecimento1º, Conhecimento2º)
- [x] Criar script seed para importar artigos categorizados no banco de dados
- [x] Verificar que os artigos aparecem na página Base de Conhecimento com busca funcionando

## Novas Funcionalidades (28/04/2026 — sessão 2)

- [x] Tabela de Preços: campo de busca por texto + filtro por página/material
- [x] Base de Conhecimento: schema tabela knowledge_comments (id, knowledge_id, author, content, created_at)
- [x] Base de Conhecimento: endpoints tRPC comments.list e comments.create
- [x] Base de Conhecimento: seção de comentários/notas inline em cada artigo
- [x] Base de Conhecimento: exportação em PDF de artigo individual (jsPDF)

## Bug — Campo Faturamento (29/04/2026)

- [x] Modal "Alimentar Dados Mensais": campo Faturamento Total não aceita vírgula (formato BR). Trocar type="number" por input de texto com máscara monetária brasileira e converter para número antes de salvar.

## Melhorias de Edição (29/04/2026)

- [x] Instalar TipTap e criar componente RichTextEditor (negrito, itálico, tamanho de fonte, listas)
- [x] Base de Conhecimento: editor de texto rico no campo conteúdo dos artigos
- [x] Rotinas: tornar campos editáveis com RichTextEditor
- [x] Regulamentos: tornar campos editáveis com RichTextEditor
- [x] Tabela de Preços: remover Pág.4 e Pág.5 hardcoded (páginas "printadas")
- [x] Tabela de Preços: simplificar edição — trocar JSON bruto por campos visuais simples (textarea sem JSON)
- [x] Tabela de Preços: todas as seções editáveis com RichTextEditor para notas/observações

## Incorporação Logística Radra (29/04/2026)

### Schema e Banco de Dados
- [x] Tabela: transportadoras (id, nome, site, endereço, referência, contato_negocial, contato_cotacao, forma_cotacao, modais, dimensoes_max, peso_max, horario_coleta, horario_entrega, observacoes, ativa, created_at)
- [x] Tabela: transportadora_cidades (id, transportadora_id, cidade, estado, raio_km)
- [x] Tabela: cotacoes_frete (id, solicitante_id, destinatario_nome, cep_destino, municipio, estado, dimensoes, peso, valor_nf, observacoes, status, created_at, updated_at)
- [x] Tabela: cotacao_opcoes (id, cotacao_id, transportadora_id, valor_frete, prazo_dias, selecionada, created_at)
- [x] Tabela: cotacao_comentarios (id, cotacao_id, autor, texto, audio_url, created_at)
- [x] Tabela: cte_importacoes (id, numero_cte, transportadora_id, valor, data_emissao, remetente, destinatario, created_at)

### Endpoints tRPC
- [x] Router: transportadoras (list, create, update, delete, toggleAtiva)
- [x] Router: cotacoesFrete (list, create, update, addOpcao, selecionarOpcao, encerrar, addComentario, listByUser)
- [x] Router: cte (list, importar, getStats)

### Páginas Frontend — Seção LOGÍSTICA
- [x] Seção LOGÍSTICA no sidebar (com ícone de caminhão)
- [x] Página: /logistica/dashboard — visão geral de cotações, tempo médio, desempenho da equipe
- [x] Página: /logistica/solicitacoes — kanban de cotações (Fila → Em Cotação → Pronto → Concluído)
- [x] Página: /logistica/transportadoras — lista, cadastro e detalhe de transportadoras
- [x] Página: /logistica/consulta — consulta de cobertura por CEP/cidade com mapa
- [x] Página: /logistica/minhas-cotacoes — vendedor acompanha suas próprias solicitações
- [x] Página: /logistica/importar-cte — upload e análise de CT-e em lote
- [x] Página: /logistica/assertividade — sugestões IA baseadas em cotações históricas

### Painel de Usuários e Permissões
- [x] Página: /admin/usuarios — lista de usuários do sistema com role e status
- [x] Criar usuário: nome, e-mail, senha temporária, função (Master/Admin/Supervisor/Comercial/Logística/Usuário)
- [x] Alterar função de usuário existente
- [x] Redefinir senha
- [x] Excluir usuário permanentemente
- [x] Matriz de permissões visual por módulo × role (tabela com checkmarks)
- [x] Permissões granulares por usuário (sobrescrever permissões do role)
- [x] Seção SISTEMA no sidebar com item "Usuários e Permissões"

## Módulo Visão de Performance (29/04/2026)

### Schema e Backend
- [x] Schema: tabela `performance_mensal` com todos os indicadores por mês/ano
- [x] Endpoints: performance.list, performance.upsert, performance.delete
- [x] Seed: dados de março 2026 baseados no documento

### Página Performance.tsx
- [x] Seção de cards KPI com os indicadores do mês atual
- [x] Formulário de inserção/edição mensal com todos os campos por setor
- [x] Tabela comparativa de meses (horizontal: meses, vertical: indicadores)
- [x] Gráficos: OS geradas vs capacidade, produtividade por setor, solda (interno vs terceirizado)
- [x] Painel de metas: campo para definir meta por indicador e comparar com realizado
- [x] Indicadores de status (verde/amarelo/vermelho) baseados em % da meta atingida

### Navegação
- [x] Item "Performance" na seção OPERAÇÕES do sidebar
- [x] Rota /operacoes/performance no App.tsx

### Análise de Custo de Solda (Comparativo Interno vs Terceirizado)
- [x] Schema: expandir performance_mensal com campos de custo de solda (salário base, HE valor, HE horas, custo/metro terceirizado, preço venda/metro)
- [x] Seção "Análise de Custo de Solda" na página Performance com campos editáveis
- [x] Cálculo automático: custo/metro interno (salário + HE ÷ metros produzidos)
- [x] Cálculo automático: custo/metro terceirizado (valor pago por metro)
- [x] Comparativo de margem: diferença de lucratividade interno vs terceirizado
- [x] Card visual com resultado do comparativo (qual é mais vantajoso e em quanto)

## Importação de Transportadoras (29/04/2026)

- [x] Importar 31 transportadoras da planilha Excel (transportadoras_2026-04-29.xlsx)
- [x] Importar 7.516 cidades atendidas das transportadoras
- [x] Script seed-transportadoras.mjs criado para reimportação futura

## Melhorias Transportadoras (29/04/2026)

- [x] Filtro por modal de transporte (Rodoviário, Aéreo, Ônibus) na listagem de transportadoras
- [x] Página/modal de detalhes completa: todas as informações da transportadora + lista paginada de cidades atendidas

## Detalhes Completos de Transportadoras (29/04/2026)

- [x] Schema: tabela transportadora_avaliacoes (id, transportadoraId, estrelas, comentario, autor, createdAt)
- [x] Schema: tabela transportadora_filiais (id, transportadoraId, nome, endereco, cidade, estado, createdAt)
- [x] Schema: adicionar campos à transportadoras (realizaColeta, ultAtualizTabela, whatsappContatoNegocial, portalUrl, portalUsuario, portalEmail, portalObservacao)
- [x] Endpoints tRPC: avaliacoes.list, avaliacoes.create, filiais.list, filiais.create, filiais.delete
- [x] Página detalhes: barra de completude do cadastro
- [x] Página detalhes: badges de modal (Rodoviário/Aéreo/Ônibus) e Faz Coleta
- [x] Página detalhes: seção de contato para cotações e contato negocial completos
- [x] Página detalhes: datas de atualização de cidades e tabela de preços
- [x] Página detalhes: dimensões máximas formatadas
- [x] Página detalhes: seção Filiais com adicionar/remover
- [x] Página detalhes: seção Avaliações do Serviço com estrelas e comentário
- [x] Formulário de edição: 4 abas (Principal, Contato Negocial, Modais & Dimensões, Portais de Cotação)
- [x] Filtro por modal na listagem de transportadoras

## Módulo Comparativo de Custo por Metro de Solda (29/04/2026)
- [x] Schema: campos de solda adicionados à tabela performance_mensal (soldadorSalarioBase, soldadorHorasExtras, soldadorValorHoraExtra, soldadorOutrosCustos, custoMetroTerceirizado, precoVendaMetro, producaoInternaSolda, metrosTerceirizados)
- [x] Migration SQL e endpoint tRPC: performance.getByMesAno e performance.upsert já aceitam campos de solda
- [x] Página CustoSolda.tsx: formulário de parâmetros + dashboard comparativo implementado (581 linhas)
- [x] Rota /operacoes/custo-solda registrada no App.tsx com ProtectedRoute
- [x] Link no sidebar (OPERAÇÕES) com pageKey operacoes-custo-solda

## Melhorias UI Retrabalhos (29/04/2026 — sessão 3)
- [x] Clarear filtros da barra de retrabalhos (texto branco sobre fundo escuro dificulta leitura) — já estava com fundo branco e texto escuro
- [x] Adicionar botões Editar e Excluir em cada linha da tabela de retrabalhos — já implementados

## Módulo de Segurança (29/04/2026)

- [x] Backend: rate limiting (express-rate-limit) — 300 req/min geral, 10 tentativas de login/min (server/_core/index.ts)
- [x] Backend: headers de segurança HTTP (helmet.js) — já implementado em server/_core/index.ts
- [x] Backend: validação de role em todos os endpoints sensíveis (adminProcedure / masterProcedure) — já implementado
- [x] Backend: sanitização de inputs via zod em todos os endpoints tRPC
- [x] Frontend: guard de rotas por role via ProtectedRoute (redireciona para /403)
- [x] Frontend: página 403 Acesso Negado com botões Voltar e Ir ao Painel
- [x] Frontend: timeout de sessão com aviso e redirecionamento automático após inatividade (30 min, aviso 2 min antes, contador regressivo)

## Melhorias Visuais (29/04/2026 — sessão 4)
- [x] Clarear todas as caixas de texto do sistema (inputs, selects, textareas) — fundo branco, texto escuro (RetrabalhForm.tsx corrigido)
- [x] Adicionar módulos Performance e Custo de Solda ao PAGE_KEYS e à matriz de permissões
- [x] ProtectedRoute aplicado nas rotas /operacoes/performance e /operacoes/custo-solda
- [x] Corrigir ordem do @import Google Fonts no index.css (aviso PostCSS eliminado)

## Painel de Auditoria de Retrabalhos (29/04/2026)

- [x] Schema: tabela `auditoria_retrabalhos` (id, retrabalhoId, osRetrabalhada, osOriginal, acao, usuarioId, usuarioNome, usuarioRole, detalhes JSON, createdAt)
- [x] Migration SQL gerada e aplicada no banco
- [x] Helper `db.ts`: insertAuditLog, listAuditLogs (com filtros por ação, usuário, retrabalho, período)
- [x] Endpoint tRPC: `auditoria.list` (protectedProcedure, com paginação e filtros)
- [x] Instrumentar `retrabalhos.create` para registrar evento CRIAÇÃO (fire-and-forget)
- [x] Instrumentar `retrabalhos.update` para registrar evento EDIÇÃO (com diff antes/depois)
- [x] Instrumentar `retrabalhos.delete` para registrar evento EXCLUSÃO (preserva dados do registro)
- [x] Página `Auditoria.tsx`: tabela paginada com filtros (ação, OS, período) + drawer lateral de detalhes
- [x] Rota `/auditoria` registrada no App.tsx com ProtectedRoute (pageKey: auditoria)
- [x] Link no sidebar (seção RETRABALHOS) com ícone ShieldCheck
- [x] `auditoria` adicionado ao PAGE_KEYS e à matriz de permissões (admin + master)
- [x] Testes Vitest para insertAuditLog e listAuditLogs (5 testes, todos passando)

## Botão Copiar nas Células da Tabela de Preços (29/04/2026)

- [x] Adicionar ícone de copiar (Copy) em cada célula da tabela de preços (MarginTable + ConfigTable)
- [x] Ao clicar, copiar apenas o valor numérico (sem %, R$, unidades ou espaços) via extractNumber()
- [x] Feedback visual ao copiar (ícone muda para Check verde por 1.5s, ícone apareçe no hover)

## Exportação Excel — Biblioteca de Erros (29/04/2026)

- [x] Instalar SheetJS (xlsx) como dependência frontend
- [x] Botão "Exportar Excel" na página BibliotecaErros.tsx (verde, ao lado de Novo Erro)
- [x] Exportar todas as colunas: Código, Categoria, Descrição, Ação/Correção (com larguras ajustadas)
- [x] Nome do arquivo: biblioteca-erros-{data}.xlsx (ex: biblioteca-erros-2026-04-29.xlsx)

## Módulo Desenho de Cargos e Funções (29/04/2026)

- [x] Schema: tabela `cargos_funcoes` com campos estruturados (título, missão, responsabilidades, KPIs, ferramentas, integração, riscos, requisitos, condições)
- [x] Migration SQL gerada e aplicada no banco
- [x] Endpoints tRPC: cargos.list, cargos.getById, cargos.create, cargos.update, cargos.delete
- [x] Página CargoseFuncoes.tsx: listagem em cards + visualização detalhada + edição inline + download PDF
- [x] Primeiro cargo cadastrado: Assistente Administrativo Logístico (seed via script, 8 seções preenchidas)
- [x] Rota /cargos-funcoes registrada no App.tsx com ProtectedRoute (pageKey: cargos-funcoes)
- [x] Link no sidebar (seção OPERAÇÕES, abaixo de POPs) com ícone Briefcase
- [x] cargos-funcoes adicionado ao PAGE_KEYS e à matriz de permissões (admin + master + produção)
- [x] 19 testes passando (4 suites) — sem regressos

## Editor Rico em Cargos e Funções (29/04/2026)

- [x] Substituir textareas simples por RichTextEditor (TipTap) em todos os campos de conteúdo do módulo Cargos e Funções (missão, responsabilidades, KPIs, ferramentas, integração, riscos, requisitos, condições)
- [x] Renderizar HTML salvo com dangerouslySetInnerHTML no modo de visualização (retrocompatível com texto plano legado com **negrito**)

## PDF Profissional — Cargos e Funções (29/04/2026)

- [x] Implementar generatePDF com jsPDF no CargoseFuncoes.tsx (cabeçalho com logo, seções coloridas, rodapé com numeração de páginas)
- [x] Converter HTML do TipTap para texto formatado no jsPDF via htmlToLines() (negrito, itálico, listas, títulos H2/H3)
- [x] Cabeçalho: faixa azul escura (#0f2347) com "DESCRITIVO DE CARGO — LETREIROS EXPRESS" + nome do cargo em destaque na 1ª página
- [x] Seções: barra lateral colorida (cor única por seção) + título em negrito + conteúdo com indentação
- [x] Rodapé: linha separadora + "Letreiros Express — Documento gerado automaticamente" + "Página X de Y" à direita

## Expansão Visão de Performance (01/05/2026)

- [x] Schema: campos adicionados à tabela performance_mensal — faturamentoRealizado, metaFaturamento (default 425000), projetosEntregues, projetosNoPrazo, projetosForaPrazo, metaEntregaNoPrazoPct (%), metaRetrabalhoPct (%)
- [x] Migration SQL gerada e aplicada no banco
- [x] Endpoint tRPC: performance.getByMesAno — retorna retrabalhos do mês (COUNT(*) por MONTH/YEAR da coluna `data`) e pedidos do mês (tabela faturamento) automaticamente
- [x] Endpoint tRPC: performance.upsert — aceita todos os novos campos
- [x] Página Performance.tsx: seção "Faturamento" com realizado, meta R$ 425.000 (editável), % atingido e barra de progresso colorida
- [x] Página Performance.tsx: seção "Projetos Entregues" com total, no prazo, fora do prazo, % no prazo, meta e barra de progresso
- [x] Página Performance.tsx: seção "Retrabalhos" com dados automáticos do mês (total retrabalhos vs pedidos, % retrabalho) e meta de % máximo
- [x] Página Performance.tsx: painel "Pontuação Final" com score 0–100 calculado pelo cruzamento das 3 metas e classificação (Excelente/Bom/Regular/Crítico)
- [x] Gráficos comparativos mensais para faturamento e % retrabalho (recharts AreaChart + LineChart)

## Módulo de Empacotamento/Expedição (01/05/2026)

- [x] Schema: tabelas empacotamento_modelos, empacotamento_tabela_precos, empacotamento_pedidos
- [x] Adicionar 'logistica-empacotamento' ao PAGE_KEYS no schema.ts
- [x] Migration SQL gerada com drizzle-kit generate e aplicada no banco
- [x] Helpers de DB: listPedidosEmpacotamento, createPedidoEmpacotamento, finalizarPedidoEmpacotamento, listModelosEmpacotamento, upsertTabelaPrecos, relatorioFechamento
- [x] Router tRPC: server/routers/empacotamento.ts com pedidos.list, pedidos.create, pedidos.finalizar, pedidos.delete, modelos.list, modelos.create, modelos.update, modelos.delete, precos.list, precos.upsert, relatorio.fechamento
- [x] Registrar empacotamentoRouter em server/routers.ts
- [x] Página Empacotamento.tsx: aba Fila de Pedidos (interface tablet-first, cards grandes, imagem letreiro, botão FINALIZAR verde)
- [x] Página Empacotamento.tsx: aba Gerenciar (formulário novo pedido com upload PNG/PDF, CRUD modelos, tabela de preços)
- [x] Página Empacotamento.tsx: aba Relatório de Fechamento (filtro período, total a pagar por operador)
- [x] Rota /logistica/empacotamento registrada no App.tsx
- [x] Link "Empacotamento" adicionado no sidebar (seção Logística) com ícone Boxes
- [x] Permissões: 'logistica-empacotamento' adicionado ao PAGE_GROUPS e DEFAULT_PERMISSIONS em Usuarios.tsx
- [x] Testes Vitest para o módulo de Empacotamento (11 testes, todos passando)
- [x] TypeScript 0 erros confirmado

## Empacotamento v2 — Expansão (01/05/2026)

- [x] Schema: tabela empacotamento_modelos_caixa (nome, descricao, largura_cm, altura_cm, profundidade_cm, tempo_limite_min, valor_comissao, ativo)
- [x] Schema: tabela empacotamento_checklist_itens (modelo_caixa_id, ordem, descricao, obrigatorio)
- [x] Schema: tabela empacotamento_pedido_usuarios (pedido_id, usuario_id, usuario_nome, iniciado_em, finalizado_em, tempo_segundos)
- [x] Schema: tabela empacotamento_pedido_fotos (pedido_id, storage_key, url, criado_em, usuario_nome)
- [x] Schema: tabela empacotamento_pedido_checklist (pedido_id, item_id, marcado, marcado_por, marcado_em)
- [x] Schema: colunas adicionais em empacotamento_pedidos: prazo_entrega (datetime), horario_maximo (varchar), status kanban (aguardando/embalando/patio/abandonado), modelo_caixa_id
- [x] Schema: role 'empacotamento' adicionado ao enum de roles em local_users
- [x] Migration SQL gerada e aplicada
- [x] Router: modelos_caixa.list, create, update, delete
- [x] Router: checklist.listPorCaixa, upsertItens
- [x] Router: pedidos.atribuirUsuario, pedidos.iniciarCronometro, pedidos.pararCronometro
- [x] Router: pedidos.marcarChecklistItem
- [x] Router: pedidos.uploadFoto, pedidos.listFotos
- [x] Router: pedidos.moverKanban (aguardando→embalando→patio→abandonado)
- [x] Router: relatorio.produtividadePorUsuario (tempo médio, comissão por usuário)
- [x] Frontend: Kanban 4 colunas (Aguardando Embalagem / Em Embalagem / No Pátio / Abandonados)
- [x] Frontend: Tela operacional tablet — card com relógio (iniciar/parar), checklist, botão foto
- [x] Frontend: Campo "pegar projeto" para usuários sem atribuição
- [x] Frontend: Múltiplos usuários no mesmo projeto (lista de quem está trabalhando)
- [x] Frontend: Upload de foto com câmera do tablet (input accept="image/*" capture="environment")
- [x] Frontend: Admin — CRUD modelos de caixa com cm³ e valor por tempo
- [x] Frontend: Admin — Checklist por modelo de caixa (adicionar/remover itens)
- [x] Frontend: Admin — Prazo de entrega + horário máximo ao criar pedido
- [x] Frontend: Indicador visual de prazo (verde/amarelo/vermelho conforme tempo restante)
- [x] Permissões: role 'empacotamento' adicionado ao ROLES e DEFAULT_PERMISSIONS em Usuarios.tsx
- [x] Permissões: visão simplificada para role 'empacotamento' (apenas kanban + tela operacional)
- [x] Testes Vitest para as novas procedures
- [x] TypeScript 0 erros confirmado

## Empacotamento v3 — Insumos, Precificação e Melhorias (01/05/2026)

- [x] Schema: tabela empacotamento_insumos (id, nome, unidade_medida, custo_unitario, categoria, ativo)
- [x] Schema: tabela empacotamento_consumo_caixa (id, modelo_caixa_id, insumo_id, quantidade_por_caixa)
- [x] Schema: tabela empacotamento_custo_funcionario (id, nome, salario_mensal, horas_mes, custo_hora, ativo, updated_at)
- [x] Schema: coluna modelo_caixa_id_padrao em empacotamento_modelos (vínculo letreiro→caixa padrão)
- [x] Migration SQL gerada e aplicada
- [x] Seed: insumos pré-cadastrados (plástico bolha, papelão onda B fino/grosso, fita transparente, fita kraft, filme stretch, fita de arquear, cantoneira 50x50, cantoneira 70x70)
- [x] Router: insumos.list, create, update, delete
- [x] Router: consumoCaixa.list, upsert, delete (consumo de insumos por modelo de caixa)
- [x] Router: custoFuncionario.list, upsert
- [x] Router: precificacao.calcular (recebe modelo_caixa_id, retorna custo total: insumos + mão-de-obra)
- [x] Router: modelos.update (edição de modelos de letreiro)
- [x] Frontend: fotos em qualquer status do kanban (botão câmera visível em todos os cards)
- [x] Frontend: edição de modelos de letreiro (modal editar nome/descrição/caixa padrão)
- [x] Frontend: vínculo letreiro→caixa padrão (select no modal de edição do letreiro)
- [x] Frontend: aba Insumos no Gerenciar (tabela CRUD com nome, unidade, custo)
- [x] Frontend: aba Precificação no Gerenciar (consumo de insumos por caixa + custo funcionário + resultado)
- [x] Frontend: custo de funcionário (formulário salário mensal, horas/mês, custo/hora calculado)
- [x] Frontend: resultado de precificação (custo insumos + custo mão-de-obra + margem sugerida)
- [x] Testes Vitest para as novas procedures
- [x] TypeScript 0 erros confirmado

## Empacotamento v4 — Precificação Geométrica Real

- [x] Schema: unidades de medida padronizadas (kg, metro, m²) — seed fixo no banco
- [x] Schema: coluna `formula_consumo` em empacotamento_consumo_caixa (enum: area_externa_m2, volume_interno_m3, perimetro_m, fixo) + coluna `fator` (multiplicador por unidade geométrica)
- [x] Schema: colunas `largura_cm`, `altura_cm`, `profundidade_cm` em empacotamento_pedidos (dimensões reais da caixa do pedido)
- [x] Migration SQL gerada e aplicada
- [x] Router: precificacao.calcular aceita dimensões reais (largura, altura, profundidade) e calcula área externa e volume interno
- [x] Router: fórmulas geométricas — área externa = 2*(L*A + L*P + A*P) em m², volume = L*A*P em m³, perímetro = 4*(L+A+P)/2 em metros
- [x] Router: insumos.listUnidades retorna as unidades fixas (kg, metro, m²)
- [x] Frontend: unidades de medida fixas no formulário de insumos (select: kg, metro, m²)
- [x] Frontend: tabela de preços com edição inline (clique no valor para editar)
- [x] Frontend: configurar insumos por modelo de caixa com fórmula geométrica (area_externa, volume, perimetro, fixo) + fator
- [x] Frontend: ao criar pedido, campos L×A×P cm para dimensões reais da caixa
- [x] Frontend: calculadora de precificação com dimensões reais (L×A×P) mostrando área externa, volume e custo detalhado por insumo
- [x] TypeScript 0 erros confirmado
- [x] Testes Vitest para o motor de precificação geométrica

## Empacotamento v7 — Melhorias (02/05/2026)

- [x] (1) Data de validade de preço (3 meses) em insumos e modelos de caixa — colunas precoAtualizadoEm e custoAquisicaoAtualizadoEm com alerta de vencimento
- [x] (2) Remover insumo BOLHA fantasma (id=30001) do banco de dados
- [x] (3) Insumos do letreiro por m² (fatorM2) em vez de quantidade fixa — campo fatorM2 em empacotamento_insumos_letreiro
- [x] (4) Campo m² do projeto no formulário de novo pedido — coluna metrosQuadrados em empacotamento_pedidos
- [x] (5) Tempo estimado calculado por m² (letreiro + caixa) exibido no pedido — procedure tempoEstimado.calcular
- [x] (6) Cronômetro com pausas (Pausar/Retomar) no modal de pedido — tabela empacotamento_cronometro_pausas + procedures cronometroPausas.pausar/retomar/list
- [x] (7) Configuração de produtividade (valor/min, bônus, penalidade) — tabela empacotamento_config_produtividade + procedure configProdutividade.upsert/get
- [x] (8) Relatório de produtividade por colaborador com horas efetivas e comissão — procedure relatorioProdutividade.porColaborador
- [x] (9) Aba Produtividade no Gerenciar com configuração e relatório por período
- [x] TypeScript 0 erros confirmado
- [x] Testes Vitest: 33 testes passando

## Empacotamento v8 — Melhorias (02/05/2026)

- [x] (1) Remover Pág.4 e Pág.5 da Tabela de Preços (seção Comercial)
- [x] (2) Adicionar unidade de medida "unidades" no cadastro de insumos de empacotamento
- [x] (3) Redesenhar interface do operador para mobile/tablet: cronômetro em destaque, tamanho da caixa, OS, responsável, troca fácil de usuário por lista de empacotadores
- [x] (4) Dashboard de empacotamento: pedidos no prazo vs fora do prazo, velocidade média por empacotador
- [x] (5) Seleção de operador por lista (sem digitar nome) ao "pegar projeto" no kanban
- [x] (6) Anotação em foto com caneta do tablet (canvas sobre a foto para marcar letras conferidas)
- [x] (7) Visualização e anotação do arquivo do supervisor (imagem/PDF) com caneta do tablet
- [x] (8) Corrigir bug: botão "Mover para Pátio" não aparece em pedidos com status "embalando"

## Empacotamento v9 — Tempo e Produtividade por Tipo (02/05/2026)

- [x] v9-1: Campo tempoPorMetroArestaMin no cadastro de caixas (tempo de execução por metro de aresta)
- [x] v9-2: Campo valorProdutividadePorCm2 no cadastro de caixas (valor de produtividade por cm²)
- [x] v9-3: Campo tempoPorM2Min no cadastro de letreiros (tempo de execução por m²)
- [x] v9-4: Campo valorProdutividadePorMinLetreiro no cadastro de letreiros (valor por minuto)
- [x] v9-5: Painel centralizado para editar tempo/produtividade de todas as caixas e letreiros de uma vez
- [x] v9-6: Estimativa de custo por m³ exibida no cadastro de caixas (baseada em dimensões e custo unitário)

## Empacotamento v10 — Correções e Checklist por Letreiro (03/05/2026)

- [x] v10-1: Corrigir bug de data/hora (timezone) — prazo de entrega mostrando "hoje" quando foi cadastrado para amanhã
- [x] v10-2: Botão "Finalizar" oculto no modal de pedido em status "embalando" — tornar visível
- [x] v10-3: Salvar anotações de foto no banco (canvas dataURL) — anotações somem ao fechar
- [x] v10-4: Substituir input de nome por lista de empacotadores ao "Entrar no projeto"
- [x] v10-5: Iniciar cronômetro automaticamente ao entrar no projeto
- [x] v10-6: Comparação tempo previsto vs real de execução (letreiro + caixa) no modal
- [x] v10-7: Checklist obrigatório por tipo de letreiro (PVC Expandido Cru, Galvanizado, Frontlight, Galvanizado Cru, Latão/Inox Dourado, PVC Expandido Colorido, Frontflat, Letra Acrílico Montada, Frontlight Inox, Inox Tradicional, Acrílico/ACM Cortado)

## Empacotamento v11 — Correções (03/05/2026)

- [x] v11-1: Bug data/hora — ao definir data+hora de entrega, o sistema salva como "hoje" (timezone)
- [x] v11-2: Imagem do estágio "Aguardando" deve aparecer no estágio "Embalando" para anotações
- [x] v11-3: Botão de avançar para próximo estágio no "Pátio" não está visível
- [x] v11-4: Bloquear avanço para "Embalando" se não houver operador atribuído
- [x] v11-5: Seleção de operador por lista (não digitar nome) — já parcialmente implementado, garantir funcionamento
- [x] v11-6: Cronômetro inicia automaticamente ao operador entrar no projeto

## Empacotamento v12 — Melhorias (03/05/2026)

- [x] v12-1: Arquivo do supervisor (imagem) deve ter canvas de anotação igual às fotos (editar e salvar)
- [x] v12-2: Botão centralizado e visível para avançar de "embalando" para "no pátio" no card do kanban
- [x] v12-3: Remover campos de dimensões reais (L×A×P) do formulário de novo pedido
- [x] v12-4: Campo de operadores no novo pedido deve ser seleção estrita da lista de usuários do sistema (não campo aberto)
- [x] v12-5: Temporizador com início/fim e tempo estimado visível no card do kanban (coluna embalando)

## Empacotamento + Frete v13 — Melhorias (03/05/2026)
- [x] v13-1: Prints 1 e 2 — implementar sugestões de alerta de tempo e relatório de produtividade por operador
- [x] v13-2: Frete — campo de observação quando transportadora = Gol (visível em todos os estágios)
- [x] v13-3: Arquivo do supervisor no novo pedido deve ficar na biblioteca compactado, editável com canvas (igual às fotos)
- [x] v13-4: Temporizador só ativa quando operador pega o projeto (não ao clicar "Iniciar")
- [x] v13-5: Só mover para pátio quando checklist completamente preenchido
- [x] v13-6: Retroagir estágio dos cards no kanban (botão de retorno ou drag)
- [x] v13-7: Corrigir erro de texto no canvas (print 3 — texto verde sobreposto ao modal)
- [x] v13-8: Salvar anotações nas imagens não funciona — corrigir
- [x] v13-9: Integração automática: ao mover para pátio, criar card em "Pré-Expedição" no kanban de Frete com foto e ID
- [x] v13-10: Botão "Mover para Pátio" visível e destacado dentro do modal aberto
- [x] v13-11: Relatório de pedidos expedidos com fotos, responsáveis e todas as informações

## Empacotamento v14 — Melhorias (03/05/2026)
- [x] v14-1: Botão "Iniciar Embalagem" deslocado — fixar no footer correto do card
- [x] v14-2: Imagem do supervisor compactada junto com as fotos (não aberta no meio do card)
- [x] v14-3: Tempo previsto visível ao lado do cronômetro no card do kanban
- [x] v14-4: Mover para pátio só com checklist completo E operador associado
- [x] v14-5: Campos de dimensões (L×A×P) e peso no card quando operador inicia embalagem
- [x] v14-6: Integração pátio→frete transmite dimensões, peso, OS# e foto
- [x] v14-7: Card de frete com busca de cidade de destino dentro do card (não só antes)
- [x] v14-8: Card de frete criado pela integração já vem com dados da expedição preenchidos

## Empacotamento v15 — Correções de bugs (03/05/2026)
- [x] v15-1: Anotações no canvas não estão sendo salvas (botão Salvar não funciona)
- [x] v15-2: Botão "Retroagir para estágio anterior" deslocado fora do modal (sobreposto ao kanban)
- [x] v15-3: Modal desconfigurado — "Excluir pedido" no meio, checklist separado, layout quebrado

## Empacotamento v15 — Correções de bugs (03/05/2026)
- [x] v15-1: Anotações no canvas não estão sendo salvas
- [x] v15-2: Botão Retroagir deslocado fora do modal
- [x] v15-3: Modal desconfigurado — Excluir no meio, checklist separado

## Empacotamento v16 — Kanban melhorado (03/05/2026)
- [x] v16-1: Drag-and-drop entre colunas do kanban (arrastar card para outra coluna)
- [x] v16-2: Bloqueio no card ao mover para "No Pátio" sem checklist completo (validação no KanbanCard)
- [x] v16-3: Bloqueio no card ao mover para "No Pátio" sem colaborador conectado (validação no KanbanCard)

## Empacotamento/Frete v17 (04/05/2026)
- [x] v17-1: Empacotamento — badge de alerta vermelho no card quando há checklist pendente
- [x] v17-2: Empacotamento — notificação ao supervisor quando pedido chega em "No Pátio"
- [x] v17-3: Empacotamento — restrição de retroação via drag (No Pátio não pode voltar para colunas anteriores)
- [x] v17-4: Empacotamento — remover botões "Iniciar" e "Mover para Pátio" (drag-and-drop é suficiente)
- [x] v17-5: Frete — evitar IDs duplicados (empacotamentoPedidoId único em cotacoesFrete)
- [x] v17-6: Frete — remover card da logística quando pedido retroage para "Embalando" no Empacotamento
- [x] v17-7: Frete — integrar campos faltantes (CNPJ, endereço, município, estado) nos cards vindos do Empacotamento

## Transportadoras v18-v21 (04/05/2026)
- [x] v18-1: Campos telefone e observacao na tabela transportadora_cidades
- [x] v18-2: APT Logística — 45 cidades de MS inseridas
- [x] v18-3: Andorinha — 522 cidades SP/PR inseridas
- [x] v18-4: Braspress/MS — 69 cidades com parceiro logístico inseridas
- [x] v18-5: União Express — 400 cidades com telefones inseridas
- [x] v19-1: Encoding quebrado corrigido no formulário de transportadoras
- [x] v19-2: Bug de salvar nova transportadora corrigido
- [x] v20-1: Braspress marcada como cobertura nacional (coberturaTotal=1)
- [x] v20-2: Motta — 51 cidades inseridas
- [x] v20-3: Condex — 78 cidades de MS inseridas
- [x] v20-4: Gontijo — 295 cidades em 18 estados inseridas
- [x] v21-1: Braspress e Correios aparecem para qualquer cidade na cotação (coberturaTotal)
- [x] v21-2: Versionamento automático da tabela de preços (001→002)
- [x] v21-3: Botão Baixar PDF na tabela de preços
- [x] v21-4: Unesul — 138 cidades inseridas

## v22 — Histórico de Preços + Valtur + VIOPEX (04/05/2026)
- [x] v22-1: Histórico de versões da tabela de preços (tabelas price_table_meta e price_table_history no schema e banco)
- [x] v22-2: Valtur — 43 cidades (RS, SC, PR, MS, MT) inseridas
- [x] v22-3: VIOPEX — campos endereco, responsavel, sede adicionados na tabela transportadora_cidades
- [x] v22-4: VIOPEX — 772 cidades atualizadas com dados completos de contato (endereço, responsável, sede, telefone)
- [x] v22-5: UI de cidades atualizada para exibir sede, responsável, telefone e endereço por cidade

## v23 — Eucatur (04/05/2026)
- [x] v23-1: Eucatur — 568 cidades inseridas em 9 estados (AC: 18, AM: 5, MS: 103, MT: 152, PR: 71, RO: 79, RR: 6, SC: 29, SP: 105)
- [x] v23-2: Observações incluem prazo de entrega, distância em km e serviços disponíveis (Coleta/Entrega)

## v24 — Vitlog unidades (04/05/2026)
- [x] v24-1: Vitlog — 32 unidades inseridas como filiais com nome, cidade, estado, endereço completo e telefone
- [x] v24-2: Vitlog — cidades atualizadas com telefone e endereço de cada unidade
- [x] v24-3: Coluna telefone de transportadora_filiais ampliada para 256 chars (suporta múltiplos números)

## v25 — Eucatur normalização + Atual Cargas (04/05/2026)
- [x] v25-1: Eucatur — 568 nomes normalizados (MAIÚSCULAS → Title Case com acentuação correta)
- [x] v25-2: Atual Cargas — 6.187 cidades novas inseridas (total: 6.364 cidades em 27 estados)
- [x] v25-3: Atual Cargas — nomes em Title Case com acentuação desde a inserção

## v26 — Braspress e Carvalima cobertura nacional (04/05/2026)
- [x] v26-1: Braspress — 5.520 municípios inseridos (total: 5.589 cidades, cobertura nacional IBGE)
- [x] v26-2: Carvalima — 5.571 municípios inseridos (todos os municípios do Brasil)

## v27 — Melhorias UI transportadoras (04/05/2026)
- [x] v27-1: Fonte menor na lista de cidades das transportadoras (text-xs/text-sm)
- [x] v27-2: Autocomplete de cidade no formulário de cotação (todas as transportadoras)
- [x] v27-3: Indicador visual "Cobertura Nacional" para Braspress e Carvalima
- [x] v27-4: Filtro que sempre mostra transportadoras com cobertura nacional nas cotações
- [x] v27-5: Remover duplicatas de cidades em todas as transportadoras (case-insensitive)
- [x] v27-6: Adicionar constraint UNIQUE (transportadoraId, cidade, estado) para prevenir duplicatas futuras
- [x] v27-7: "Cidades atualizada em" preenchido automaticamente com data da última inserção

## v28 — Gollog cidades (04/05/2026)
- [x] v28-1: Gollog — 3.647 cidades inseridas da planilha "Cidades Atendidas V 05 2026.xlsx" com prazo base por cidade

## v29 — Penha (04/05/2026)
- [x] v29-1: Penha — 442 cidades inseridas do PDF "Lista de Localidades" com endereço por cidade
- [x] v29-2: Penha — 451 filiais inseridas com nome (Cidade - UF) e endereço completo
- [x] v29-3: Data "Cidades atualizada em" preenchida automaticamente para a Penha

## v30 — Responsividade lista de cidades (04/05/2026)
- [x] v30-1: Corrigir layout da lista de cidades para mobile (texto cortado no celular)
- [x] v30-2: Diminuir tamanho da fonte na lista de cidades para melhor leitura

## v31 — Andorinha filiais + KM Transportes cidades (04/05/2026)
- [x] v31-1: Andorinha — 3 filiais cadastradas (Matriz Presidente Prudente/SP, Filial SP, Filial Campo Grande/MS) com telefone
- [x] v31-2: KM Transportes — 56 cidades inseridas (GO: 2, SP: 13, MS: 41)

## v32 — Solidez filiais (04/05/2026)
- [x] v32-1: Solidez — 8 filiais cadastradas com endereço completo e telefone (MT: 4, MS: 1, SP: 1, GO: 1)
- [x] v32-2: Solidez — 8 cidades inseridas com telefone e endereço da filial

## v33 — Unesul atualização (04/05/2026)
- [x] v33-1: Unesul — extrair cidades, filiais e contatos do PDF
- [x] v33-2: Unesul — inserir cidades e filiais com endereço e telefone no banco (355 cidades, 26 filiais)

## v34 — Unesul normalização IBGE (04/05/2026)
- [x] v34-1: Corrigir nomes das cidades da Unesul sem acento cruzando com base do IBGE

## v38 — Sistema de Produtividade no Empacotamento (05/05/2026)
- [x] v38-1: Schema DB — tabela empacotamento_sessoes_trabalho (pedidoId, operadorId, startedAt, pausedAt, totalSegundos, status)
- [x] v38-2: Schema DB — campo tempoEstimadoMinutos + tipoCalculo (aresta|unidade) em empacotamento_modelos_caixa
- [x] v38-3: Schema DB — campo tempoEstimadoMinPorM2 em empacotamento_modelos (letreiros)
- [x] v38-4: Schema DB — tabela empacotamento_config (valorProdutividadePorHora)
- [x] v38-5: tRPC — procedures sessões: iniciar, pausar, retomar, finalizar, listar por pedido
- [x] v38-6: tRPC — procedures config produtividade (get/set valorPorHora)
- [x] v38-7: Frontend — temporizador expandido no modal com Pause/Start/Stop
- [x] v38-8: Frontend — campo tempo estimado nos modelos de caixa (aresta/unidade)
- [x] v38-9: Frontend — campo tempo estimado nos modelos de letreiro (por m²)
- [x] v38-10: Frontend — exibir tempo previsto vs real no modal do pedido
- [x] v38-11: Frontend — painel de produtividade (diário/semanal/mensal) com horas por operador e valor

## v39 — Produtividade avançada + Requisitos pátio (05/05/2026)
- [x] v39-1: Schema — campos fotografia (url), pesoKg (decimal), altCm/largCm/profCm em empacotamento_pedidos
- [x] v39-2: SQL migration — adicionar os novos campos ao banco
- [x] v39-3: tRPC — procedure para upload de foto e salvar peso/medidas no pedido
- [x] v39-4: Frontend — bloquear drag para "no pátio" se foto+peso+medidas não preenchidos (além do checklist)
- [x] v39-5: Frontend — bloquear botão STOP do cronômetro até foto+peso+medidas+checklist completos
- [x] v39-6: Frontend — campos foto/peso/medidas no modal do pedido (upload foto, inputs numéricos)
- [x] v39-7: Integração — transportar foto/peso/medidas para o card do kanban logístico
- [x] v39-8: Caixas personalizadas — trocar cálculo de produtividade de m² para m³
- [x] v39-9: Fórmula progressiva — +/-5% de produtividade a cada 5% de variação no tempo real vs estimado
- [x] v39-10: Painel — filtro por tipo de produto (letreiro/caixa/misto) no "Previsto vs Real"
- [x] v39-11: Painel — exportar dados de produtividade para CSV
- [x] v39-12: Painel — sistema de metas com indicadores visuais de progresso (já implementado: meta de horas/dia, barra de progresso, indicadores por operador)

## v40 — Checklist editável, gráficos, ranking e câmera nativa (05/05/2026)

- [x] v40-1: Checklist editável por produto — cada modelo de letreiro/caixa tem seu próprio checklist no cadastro
- [x] v40-2: tRPC — procedures CRUD de itens de checklist por produto (listar, criar, editar, excluir, reordenar)
- [x] v40-3: UI — seção de checklist editável no cadastro de modelos de letreiro e caixa
- [x] v40-4: Gráfico de linha de evolução diária do tempo médio de execução por tipo de produto
- [x] v40-5: Notificação ao gestor quando produtividade de operador fica abaixo de 70% por 3 dias consecutivos
- [x] v40-6: Aba "Ranking de Produtividade" com operadores mais eficientes da semana e do mês
- [x] v40-7: Câmera nativa no modal de pedido (capture=environment para celular/tablet)

## Correções PDF e Editor Rich Text (05/05/2026)

- [x] Corrigir erro ao gerar PDF do POP na Biblioteca de Erros (substituir html2canvas por jsPDF puro — elimina problema CORS/S3)
- [x] Criar helper `popPdfFromParsed.ts` com geração jsPDF sem DOM: cabeçalho colorido por categoria, passos numerados, pontos de atenção, critério de aceitação, rodapé com assinatura
- [x] Adicionar RichTextEditor (Tiptap) no campo de ação corretiva da Biblioteca de Erros (edição e criação)
- [x] Exibição do HTML formatado na visualização da ação corretiva (dangerouslySetInnerHTML)
- [x] Corrigir validação do save/create para aceitar HTML do RichTextEditor

## Correções PDF e Editor POPs (05/05/2026 — sessão 2)

- [x] Corrigir texto cortado na margem direita do PDF do POP (reescrever popPdfFromParsed.ts usando padrão htmlToLines do CargoseFuncoes)
- [x] PDF do POP: calcular corretamente a largura disponível para texto dentro dos blocos de passo (contentW - faixa lateral - padding)
- [x] Adicionar RichTextEditor (Tiptap) no PopEditPanel da página de POPs (campos Objetivo e Passos)
- [x] Adicionar RichTextEditor (Tiptap) no formulário de criação de novo POP (campos Objetivo e Passos)
- [x] PDF respeita formatação do RichTextEditor: negrito, itálico, listas numeradas, listas com marcadores, títulos

## Novas Funcionalidades (06/05/2026)

- [x] Redefinição de senha de usuários de produção pelo admin diretamente na lista de usuários
- [x] Tabela knowledge_suggestions no banco para armazenar sugestões de incorporação
- [x] Procedure backend para criar, listar e aprovar/rejeitar sugestões de conhecimento
- [x] Base de Conhecimento: resposta do Gemini exibe claramente que é "Sugestão gerada por IA Gemini"
- [x] Base de Conhecimento: botão "Sugerir incorporação" para usuários comuns/admin
- [x] Base de Conhecimento: botão "Incorporar na Base" para o master (incorporação direta)
- [x] Painel de sugestões pendentes para o master revisar e aprovar/rejeitar
- [x] Usuários podem escrever sugestões livres além de sugerir a resposta do Gemini

## Correções OAuth + Painel de Sugestões (06/05/2026)

- [x] Corrigir context.ts para buscar localUser pelo e-mail de qualquer usuário OAuth (não apenas o dono)
- [x] Adicionar procedure `localAuth.myLocalRole` que retorna role do localUser resolvido pelo contexto (funciona para login local e OAuth)
- [x] Atualizar SugestoesConhecimento.tsx para usar `trpc.localAuth.myLocalRole.useQuery()` em vez de `useLocalAuth()` para verificar isMaster
- [x] Botões de aprovação/rejeição agora funcionam para usuários OAuth com role master/admin

## v41 — Painel de Produtividade e Previsto vs Realizado (07/05/2026)

- [x] v41-1: Apagar sessões de empacotamento com tempo zero (registros falsos no ranking) — procedure deletarSessoesZero + botão no painel
- [x] v41-2: Corrigir cálculo de horas trabalhadas no Ranking de Produtividade (estava mostrando 0.0h)
- [x] v41-3: Criar painel de registros de tempo por pedido (ID, colaboradores, tempo de cada um, valor de produtividade)
- [x] v41-4: Criar painel Previsto vs Realizado (tempo estimado vs tempo real de empacotamento)

## Melhorias Logística — Prazo de Expedição (08/05/2026)

- [x] Transportar tipoMaterial do Empacotamento para o card de logística (cotacoesFrete.tipoMaterial preenchido automaticamente ao criar card)
- [x] Inicializar seletor de tipoMaterial no TemplateTransportadora com valor vindo do Empacotamento
- [x] Salvar dataEntregaPrevista (do Mubisys) na cotação via updateObs ao buscar dados da OS
- [x] Procedure cotacoesFrete.assertividade: retorna total, noPrazo, antecipados, atrasados, percentuais e lista de pedidos com diffDias e situação
- [x] Dashboard de Prazo de Expedição na página /logistica/assertividade: KPIs (% no prazo, % antecipados, % atrasados) + tabela detalhada com filtro de período
- [x] Adicionar campos temRetrabalho, tipoRetrabalho, motivoRetrabalho no schema cotacoes_frete
- [x] Criar procedure marcarRetrabalho no backend
- [x] Criar procedure metricasRetrabalho no backend (KPIs, distribuição por tipo, tendência mensal)
- [x] Adicionar coluna "Retrabalho" na tabela de prazo de expedição com botão de marcação
- [x] Criar dashboard "Retrabalho nos Pedidos Atrasados" com KPIs e gráficos
- [x] Criar modal de marcação de retrabalho com tipo e motivo
- [x] Adicionar painéis "Retrabalhos de Hoje" e "Retrabalhos de Ontem" no Dashboard de Retrabalhos
- [x] Criar procedure backend retrabalhosDodia com filtro por data (hoje/ontem)
- [x] Exibir OS, setor, responsável, classe, tipo, custo e horário em cada painel diário
- [x] Atualização automática a cada 60 segundos nos painéis diários
- [x] Fechamento do ciclo Retrabalho → Ação Corretiva (status aberto/em_tratamento/resolvido)
- [x] Notificações e alertas automáticos (reincidência, meta excedida, sem ação, prazo vencido)
- [x] Metas e benchmarks com comparativo vs realizado
- [x] Gestão de reincidências com plano de ação
- [x] Painel de desempenho por colaborador com ranking e evolução mensal
- [x] Badge de alertas ativos no menu lateral
- [x] Seção Qualidade no menu lateral com 5 páginas
- [x] Biblioteca de Arquivos: tabela biblioteca_arquivos no schema
- [x] Biblioteca de Arquivos: router backend (upload, listagem, stats, delete, incrementDownload)
- [x] Biblioteca de Arquivos: página frontend com upload drag-and-drop, busca, filtro por categoria, preview de PDF/imagem, download
- [x] Biblioteca de Arquivos: link no menu lateral (Operações > Biblioteca de Arquivos)
- [x] Biblioteca de Arquivos: rota /biblioteca-arquivos registrada no App.tsx

## Integração Biblioteca de Arquivos → Base de Conhecimento (10/05/2026)
- [x] Campo `conteudoExtraido` (mediumtext) adicionado na tabela `biblioteca_arquivos` (migration 0030)
- [x] Router `bibliotecaArquivos.ts` atualizado: extração de texto via LLM no upload (PDF via file_url, outros via resumo)
- [x] Procedure `reextrairTexto` para re-extrair conteúdo de arquivos já existentes
- [x] Botão de edição de cards na Biblioteca de Arquivos (modal com formulário pré-preenchido)
- [x] Função `listArquivosBibliotecaComConteudo()` adicionada ao `server/db.ts`
- [x] Procedure `knowledge.askAI` atualizada: busca arquivos da biblioteca com conteúdo extraído, filtra por relevância (matchScore), inclui top 3 arquivos no contextText enviado ao Gemini
- [x] Campo `files` adicionado ao retorno de `internalSources` na procedure askAI
- [x] Frontend `Conhecimento.tsx` atualizado: seção "Documentos referenciados" exibe arquivos da biblioteca com nome, categoria e link para download quando a IA os utiliza como fonte

## Modal de Pré-visualização de Documentos Referenciados (10/05/2026)
- [x] Atualizar retorno da procedure knowledge.askAI para incluir conteudoExtraido nos arquivos referenciados
- [x] Criar modal de pré-visualização no Conhecimento.tsx com conteúdo extraído, nome, categoria e botão de download

## Visão de Performance — Melhorias v2 (10/05/2026)
- [x] Ticket médio: card no dashboard calculando faturamento/pedidos com comparativo mensal
- [x] Painel de comparação entre meses: aba central mostrando todos os KPIs lado a lado com variação %
- [x] Curva ABC de produtos: buscar do ERP mês a mês, exibir como accordion expansível (A/B/C)
- [x] Curva ABC de clientes: buscar do ERP mês a mês, exibir com etiquetas de retrabalho/atraso
- [x] Backend: tabela abc_cache + procedures performanceAbc.getAbc e performanceAbc.getClienteTags
- [x] Campo totalPedidos adicionado ao upsert de performance para cálculo manual de ticket médio

## Bug Performance — Valores Truncados e Edição Travada (10/05/2026)
- [x] Corrigir faturamento exibido como R$ 366 em vez de R$ 366.000 (valores corrigidos no banco + conversão toNum/toInt corrigida para aceitar formato BR)
- [x] Corrigir edição travada dos campos numéricos no modal (input usa text simples, sem máscara que bloqueava cursor)

## Visão de Performance — Dados Históricos Jan/Fev 2026 (10/05/2026)
- [x] Inserir registro de Janeiro 2026 com faturamento R$ 200.082,98 e meta R$ 425.000,00
- [x] Inserir registro de Fevereiro 2026 com faturamento R$ 360.090,33 e meta R$ 425.000,00
- [x] Taxa de retrabalho calculada automaticamente: Jan=25,7% (36/140), Fev=18,9% (25/132), Mar=11,8% (22/187)

## Configurações de Metas Operacionais (10/05/2026)
- [x] Tabela metas_operacionais no banco com os 9 indicadores configuráveis
- [x] Procedure backend: metasOperacionais.get, metasOperacionais.list, metasOperacionais.upsert
- [x] Página MetasOperacionais.tsx com formulário dos 9 indicadores (prazo, retrabalhos, faturamento, lucratividade, metros soldados, prejuízo retrabalhos, desempenho colaborador, ticket médio, metros terceirizados)
- [x] Meta de ticket médio padrão R$ 3.000,00 inserida no banco + integrada dinamicamente ao painel Performance
- [x] Rota /operacoes/metas registrada em App.tsx
- [x] Item "Configurações de Metas" adicionado ao sidebar DashboardLayout em Operações

## Aba Financeiro (10/05/2026)
- [x] Tabela financeiro_mensal no banco: faturamento oficial, despesas fixas, despesas variáveis, nº colaboradores, lucro_bruto, lucro_liquido, notas
- [x] Procedure backend: financeiro.get, financeiro.list, financeiro.upsert
- [x] Página Financeiro.tsx: formulário mensal com faturamento, despesas fixas/variáveis, colaboradores, lucro calculado
- [x] Faturamento do Financeiro é fonte primária para o painel Performance (se disponível)
- [x] Rota /financeiro registrada em App.tsx com item no sidebar (seção FINANCEIRO)
- [x] Painel Performance: cards de Faturamento Oficial, Lucro Líquido e Receita por Colaborador
- [x] Painel Performance: receita por colaborador = faturamento / nº colaboradores

## Melhorias Aba Financeiro (10/05/2026)
- [x] Gráfico interativo de evolução mensal (faturamento, despesas fixas, despesas variáveis, lucro líquido)
- [x] Botão de exportação CSV e Excel com todos os dados mensais do ano
- [x] Setas comparativas com o mês anterior nos cards de Lucro Líquido e Receita por Colaborador

## Desempenho por Colaborador — Métricas por Categoria (10/05/2026)
- [x] Schema: tabela desempenho_colaborador_mensal (id, nome, categoria, mes, ano + métricas por categoria)
- [x] SQL migration: criar tabela desempenho_colaborador_mensal
- [x] Backend: procedures desempenhoColabMensal.list, desempenhoColabMensal.upsert, desempenhoColabMensal.deleteColaborador
- [x] Frontend: reescrever DesempenhoColaborador.tsx com abas por categoria (Soldador / Vendedor / Operador de Máquinas)
- [x] Frontend: formulário de entrada de dados mensais por colaborador (modal)
- [x] Frontend: gráfico comparativo mês a mês por colaborador
- [x] Frontend: tabela de ranking por categoria com métricas específicas

## Melhorias Rotinas — Calendário e Avisos (10/05/2026)
- [x] Schema: adicionar `esporadico` ao enum frequency (substituir `trimestral`), adicionar campo `startDate` (data início) e `calendarDates` (datas específicas para esporádico)
- [x] Backend: atualizar procedures create/update para aceitar novos campos; procedure `routines.pending` retorna rotinas pendentes do usuário logado
- [x] Frontend: campo de data de início na criação/edição de rotina
- [x] Frontend: calendário visual mensal mostrando datas de execução por frequência
- [x] Frontend: badge de rotinas pendentes no sidebar (item Rotinas)
- [x] Frontend: banner/toast de aviso ao logar com rotinas pendentes ou atrasadas

## Biblioteca de Arquivos — Correções (10/05/2026)
- [x] Renomear campo `downloads` para `visualizacoes` no banco (migration SQL)
- [x] Atualizar router: renomear `incrementDownload` para `incrementView`, atualizar `stats`
- [x] Corrigir BibliotecaArquivos.tsx: usar DashboardLayout, ampliar espaçamento, trocar "downloads" por "visualizações"

## Correções Modal Alimentar Faturamento/OS (10/05/2026)
- [x] Corrigir input "Número de Pedidos": trocar type="number" por type="text" com inputMode="numeric"
- [x] Corrigir schema: chave única de faturamento deve ser (mes, ano) e não apenas (mes)
- [x] Corrigir upsertFaturamento: usar (mes, ano) como chave de duplicidade no onDuplicateKeyUpdate
- [x] Exibir ticket médio (faturamento / pedidos) no card de dados salvos e no modal

## Correções Visão de Performance (10/05/2026)
- [x] Corrigir todos os inputs numéricos: trocar type="number" por type="text" com inputMode="numeric" na página Performance
- [x] Corrigir erro de SQL: colunas faltantes adicionadas ao banco (faturamentoRealizado, metaFaturamento, totalPedidos, etc.)

## Toast de Sucesso Global (10/05/2026)
- [x] Adicionar toast.success em todos os onSuccess de mutations sem feedback visual (Performance, Dashboard/Faturamento, Rotinas, Retrabalhos, Conhecimento, Logística, Desempenho Colaborador, Financeiro, Alertas, Admin, Usuários)

## Correções Críticas Performance (10/05/2026)
- [x] Corrigir re-render/perda de foco nos inputs: extrair PerformanceField para fora do FormularioPerformance + useCallback no onChange
- [x] Corrigir erro de SQL: upsert já cria registro se não existir; problema era o re-render que causava envio de ID antigo em cache

## Validação de Campos Numéricos — Performance (10/05/2026)
- [x] Adicionar validação no PerformanceField: bloquear negativos e caracteres inválidos (aceitar apenas dígitos, ponto e vírgula)

## Correção Definitiva Performance (10/05/2026)
- [x] Reescrever FormularioPerformance com estado 100% local (sem prop drilling de onChange)
- [x] Corrigir erro SQL: ID 60001 existe no banco; problema era o Field wrapper interno causando re-render e perda de foco

## 8 Melhorias Performance e Metas (10/05/2026)
- [x] Item 1: Primeira célula da Visão de Performance mostra % da meta alcançada (faturamento realizado / meta * 100)
- [x] Item 2: Visão de Performance agora usa DashboardLayout — botão 'Voltar para Home' visível
- [x] Item 3: Taxa máxima de retrabalhos descrita como % em relação ao número de pedidos
- [x] Item 4: Margem de lucratividade mínima descrita como % do faturamento; campo 'Meta de lucratividade anual' adicionado
- [x] Item 5: Card de Ticket Médio expandido com meta, % de proximidade, distância em R$ e indicador de % de melhoria possível
- [x] Item 6: Ponto '7' (Desempenho por Colaborador) renumerado para '9' — seções reordenadas
- [x] Item 7: Ponto 6 (Custo com Retrabalhos) — primeira célula = Média de custo dos retrabalhos (R$), segunda = Custo máximo total (R$)
- [x] Item 8: Ponto 5 (Metros Soldados) — adicionados campos: Média de solda por soldador, Número de soldadores, Meta de metros soldados por mês

## Correções Performance e Metas (10/05/2026 — sessão 2)
- [x] Corrigir dados corrompidos de Jan 2026: faturamento R$ 200.082,98, totalPedidos = 140
- [x] Corrigir dados corrompidos de Fev 2026: faturamento R$ 360.090,33, totalPedidos = 132
- [x] Metas do dashboard (faturamento, retrabalho, entrega no prazo, ticket médio) agora lidas da Configuração de Metas quando o mês não tem meta própria
- [x] PainelFaturamento, PainelPontuacao e calcPontuacao recebem metaFatDefault da configuração de metas via prop

## Bug Formulário Performance — Erro SQL (10/05/2026)
- [x] Corrigir erro SQL: função toNum corrigida para não remover ponto decimal quando não há vírgula (ex: "360090.33" não virava mais "36009033")
- [x] Adicionar feedback verde no botão Salvar do formulário de performance (ícone check + cor verde por 1.2s antes de fechar)

## Bug Ticket Médio e Total de Pedidos (10/05/2026)
- [x] Corrigir: totalPedidos adicionado ao schema Drizzle da tabela performanceMensal (existia no banco mas não era retornado pelo SELECT do Drizzle)
- [x] Corrigir: texto duplicado "Meta: Meta: R$ 3.000,00" — removido prefixo "Meta:" das props meta dos KpiCards (o componente já adiciona automaticamente)

## Substituição Metas e Benchmarks por Configurações de Metas (10/05/2026)
- [x] Remover "Metas e Benchmarks" do menu de Qualidade e das rotas (import e Route removidos do App.tsx)
- [x] Colocar "Configurações de Metas" no lugar de "Metas e Benchmarks" no menu de Qualidade (aponta para /operacoes/metas)
- [x] Remover "Configurações de Metas" do menu de Operações (não duplicar)
- [x] Conteúdo de Configurações de Metas preservado intacto

## Planos de Ação — Ishikawa + 5W2H (10/05/2026)
- [x] Criar tabelas no banco: planos_acao, ishikawa_causas, acoes_5w2h
- [x] Criar router backend com CRUD completo para planos de ação
- [x] Construir interface com diagrama Ishikawa visual (6M) interativo
- [x] Construir tabela 5W2H editável vinculada ao plano
- [x] Adicionar campos: erros prevenidos, erros resolvidos, setor aplicável
- [x] Pré-popular com plano de redução de retrabalho na pintura

## Planos de Ação — PDF e Progresso (10/05/2026)
- [x] Barra de progresso visual nos cards de planos (% de ações concluídas, em andamento, pendentes)
- [x] Barra de progresso no detalhe do plano (componente ProgressBar reutilizável)
- [x] Botão "Exportar PDF" no detalhe do plano com Ishikawa + 5W2H completos (jsPDF + autoTable)
- [x] Endpoint backend exportData para retornar plano + causas + ações completos

## 5 Melhorias Performance + Planos de Ação (10/05/2026)
- [x] Item 1: OS Geradas no card da Performance deve mostrar totalPedidos do mês alimentado
- [x] Item 2: Remover célula Anexo 2 do sistema
- [x] Item 3a: Plano de ação aceita múltiplos códigos de erro (campo codigosErro como array JSON)
- [x] Item 3b: Biblioteca de Erros mostra etiqueta/badge "Plano de Ação" nos erros com plano vinculado
- [x] Item 4: Adicionar todos os erros de pintura ao plano PIN-001 (implementado como EPA-01 com 12 erros EPA vinculados)
- [x] Item 5: Gerar 5 ações preventivas via IA (5W2H) para o plano de pintura

## Melhorias v5 (10/05/2026)

- [x] Relatório de retrabalhos: gráfico de pizza mostrando % por categoria no número de retrabalhos
- [x] Relatório de retrabalhos: gráfico de pizza mostrando % por categoria no valor do prejuízo (custo)
- [x] Biblioteca de Erros: etiqueta "✓ Plano de Ação" para cada erro vinculado a um plano de ação
- [x] Plano EXP-001: adicionar causas de despacho fora do prazo por ineficiência operacional no Ishikawa
- [x] Plano EXP-001: adicionar causas de envio de pedidos com itens faltantes no Ishikawa
- [x] Plano EXP-001: adicionar ações 5W2H para prevenir atrasos e itens faltantes

## Correções v5.1 (10/05/2026)

- [x] Bug: OS Geradas de Fevereiro não aparece no comparativo de indicadores (osGeradas/totalPedidos)
- [x] Remover aba "Ações Corretivas" do menu Qualidade no sidebar
- [x] Configuração de Metas: adicionar campo de meta de número de OS criadas por mês

## Correções v5.2 (10/05/2026)

- [x] Bug: Curva ABC — itens "Desconhecido" em Janeiro, Fevereiro e Março 2026 (corrigir nomes dos produtos)
- [x] Remover aba "Alertas" do menu Qualidade no sidebar

## Funcionalidades v5.3 (10/05/2026)

- [x] Curva ABC: gráfico de área empilhada mostrando evolução mensal dos principais produtos
- [x] Curva ABC: seletor de meses para comparar evolução (ex: Jan-Abr 2026)
- [x] Curva ABC: tabela comparativa de participação % por produto e por mês
- [x] Configuração de Metas: aba "Produtos" com lista de produtos monitorados e metas de participação
- [x] Configuração de Metas: busca de produtos do ERP via CADASTRO/PRODUTOS
- [x] Configuração de Metas: salvar metas de participação % por produto no banco

## Melhorias Performance Comercial e Logística (12/05/2026)

- [x] Adicionar Metas Comerciais ao menu sidebar e criar página MetasComerciais.tsx
- [x] Adicionar Insights de IA (Logística) ao menu sidebar e criar página InsightsLogistica.tsx com Gemini
- [x] Tornar responsável obrigatório ao criar retrabalho (validação no frontend e backend)
- [x] Adicionar tipo "Gestor" no cadastro de responsáveis para metrificação separada — campo tipoResponsavel (operador/gestor) no schema, backend e formulário

## CRM Comercial
- [x] Schema: tabelas `crm_metas` e `crm_contatos` com migration SQL aplicada
- [x] Router tRPC: `crm.getPropostas` — busca propostas abertas do ERP por vendedor com dados de follow-up
- [x] Router tRPC: `crm.getMensagemMotivacional` — mensagem motivacional via Gemini com variações
- [x] Router tRPC: `crm.registrarContato` — registra contato 1 ou 2 por proposta
- [x] Router tRPC: `crm.getMeta` / `crm.saveMeta` — metas mensais por vendedor
- [x] Router tRPC: `crm.getVendedores` — visão geral para o diretor
- [x] Router tRPC: `crm.getContatos` — histórico de contatos por proposta
- [x] Página CRM: mensagem motivacional Gemini no topo com botão de refresh
- [x] Página CRM: metas do mês com barra de progresso (valor e qtd OS)
- [x] Página CRM: KPIs de follow-up (abertas, sem contato, 1 contato, meta 2 contatos)
- [x] Página CRM: janelas de conversão clicáveis baseadas em dados históricos (Pareto)
- [x] Página CRM: lista de propostas com sinalizadores visuais de janela de tempo
- [x] Página CRM: badge C1/C2 com indicador de prazo (no prazo / atrasado)
- [x] Página CRM: botão de registrar contato com modal (canal + observação)
- [x] Página CRM: filtros por janela e por status de contato
- [x] Página CRM: visão do diretor com filtro por vendedor e performance geral
- [x] Página CRMConfig: configuração de metas por vendedor e mês
- [x] Menu lateral: itens "CRM de Propostas" e "Config. Metas CRM" na seção Comercial
- [x] Análise estatística: 4 janelas de tempo (0-3d, 4-7d, 8-15d, 16-30d, >30d) com base em 2.429 vendas

## Correções e Melhorias (12/05/2026)
- [x] Card de retrabalho no dashboard: redirecionar para relatório filtrado pela OS específica (não para biblioteca de erros)
- [x] CRM Comercial: corrigir visibilidade no menu lateral (itens "CRM de Propostas" e "Config. Metas CRM" não aparecem)
- [x] Painel de Performance: adicionar indicador de clientes novos no mês (regra: nunca gerou OS antes)
- [x] Metas individuais por vendedor: adicionar botão de excluir vendedor

## Melhorias v6 (12/05/2026 — sessão 3)
- [x] Relatório de retrabalhos: edição inline de cada linha (todos os campos editáveis com botão salvar/cancelar)
- [x] CRM: nova interface em linhas (não cards), filtro por vendedor + filtro de datas
- [x] CRM: colunas de calendário D0 a D15 mostrando marcador de contato por dia
- [x] CRM: ordenação por menos contatos no topo
- [x] CRM: botão excluir proposta (marca como perdida)
- [x] CRM: link WhatsApp/telefone do cliente clicável
- [x] CRM: contador de contatos feitos no dia no painel superior
- [x] CRM: janela de trabalho de 0 a 15 dias da proposta

## CRM v3 — Refatoração Completa (13/05/2026)
- [x] Router: buscar telefone do cliente no Mubisys (endpoint /empresa ou /cliente)
- [x] Router: filtros de data pré-definidos (hoje, 7 dias, 15 dias, este mês, personalizado)
- [x] Router: retornar campo telefone/whatsapp mapeado do Mubisys
- [x] CRM: tabela clara com colunas obrigatórias (proposta, cliente, data abertura, follow-ups, status contato, WhatsApp/tel)
- [x] CRM: filtros de data pré-definidos no topo (Últimos 7d / 15d / Este mês / Personalizado)
- [x] CRM: painel de contatos do dia destacado no topo
- [x] CRM: priorização automática por menos contatos (sem contato → topo)
- [x] CRM: destaque visual para propostas próximas de 15 dias
- [x] CRM: exclusão de proposta com confirmação e mensagem clara
- [x] CRM: após registrar 2 contatos, mover proposta para histórico (não exibir na lista ativa)
- [x] CRM: aba/seção de histórico de contatos realizados

## CRM v4 — Reconstrução Completa (13/05/2026)
- [x] Router: corrigir mapeamento empresa (nomeCliente), contato (nomeContato), telefone (celular)
- [x] CRM: abrir com propostas do mês vigente por padrão
- [x] CRM: tabela limpa — nº orçamento (clicável), empresa, contato, link WhatsApp, datas D1-D15 clicáveis
- [x] CRM: clicar no quadradinho da data marca contato realizado naquele dia
- [x] CRM: clicar no número da proposta abre modal ganho/perdido
- [x] CRM: filtros por vendedor e por período de datas

- [x] CRM Metas: botão excluir vendedor da lista de metas
- [x] CRM Metas: campo para vincular vendedor a um usuário do sistema (dropdown de usuários)
- [x] CRM Propostas: células D1-D15 com 3 opções de resposta ao registrar contato (Não retornou / Esperando cliente / Garantiu fechamento)
- [x] CRM: corrigir erros TypeScript (localUser, marcarGanha, nomeContato, getVendedores)

## CRM — Correções Críticas v6 (13/05/2026)
- [x] CRM: corrigir estrela definitivamente — remover de todas as propostas, exibir apenas em clientes sem OS Entregue
- [x] CRM: restaurar células clicáveis das faixas 1, 2 e 3 com os 3 tipos de resposta (Não retornou / Esperando cliente / Garantiu fechamento)
- [x] CRM: alerta visual no painel de agenda para propostas com acompanhamento atrasado
- [x] CRM: filtro "Apenas clientes novos" deve funcionar corretamente

## Planos de Ação Comercial (13/05/2026)
- [x] Planos de Ação: adicionar campanha "Primeira Compra" para clientes novos
- [x] Planos de Ação: refazer perfil de WhatsApp por vendedor

## Performance Comercial (13/05/2026)
- [x] Performance: adicionar célula de faturamento na entrada do painel
- [x] Performance: adicionar taxa de conversão de clientes novos (2 taxas)

## Melhorias CRM e Performance Comercial (13/05/2026)

- [x] Planos de Ação Comercial: nova página com campanha de primeira compra (6 ações D+1 a D+15 com scripts prontos)
- [x] Planos de Ação Comercial: perfis editáveis de WhatsApp por vendedor (Letícia, Carise, Stephanie)
- [x] CRM: estrela ⭐ corrigida — normalização de acentos/pontuação na comparação de nomes de empresa para evitar falsos positivos
- [x] CRM: faixas 1/2/3 com quadrículos clicáveis confirmadas (renderFaixa com 3 estados: emoji/futuro/clicável)
- [x] CRM: filtro "Clientes novos" funcional — filtra apenas propostas com clienteNovo=true
- [x] Performance Comercial: KpiCard "Cotações (Novos)" adicionado
- [x] Performance Comercial: KpiCard "Taxa Conv. Novos" adicionado
- [x] Performance Comercial: backend getClientesNovosMes retorna cotacoesNovos, osNovos, taxaConversaoNovos

## Melhorias CRM e Performance Comercial (Mai/2026 — sessão 2)
- [x] Performance: card "OS Geradas (Novos)" mostrando número de OS de clientes novos no mês
- [x] Performance: duas taxas de conversão lado a lado (Taxa Geral vs Taxa Novos)
- [x] CRM: normalizar nomes com normalizeEmpresa() em ambos os lados da comparação da estrela
- [x] Skill crm-mubisys-debug: atualizar com aprendizado de o.cliente vs o.empresa e normalização

## Taxas de Conversão de Clientes Novos (Mai/2026 — sessão 3)
- [x] Performance: adicionar valorOrcadoNovos no backend (soma dos valores orçados de clientes novos)
- [x] Performance: calcular taxaFaturamentoNovos = faturamentoNovos / valorOrcadoNovos * 100
- [x] Performance: card "Taxa Conv. Pedido (Novos)" = osNovos / cotacoesNovos
- [x] Performance: card "Taxa Conv. Fat. (Novos)" = faturamentoNovos / valorOrcadoNovos

## Top 3 Vendedores — Métricas de Clientes Novos (sessão 4)
- [x] Performance: backend — calcular por vendedor: cotacoesNovos, osNovos, faturamentoNovos, valorOrcadoNovos, taxaConvNovos, taxaFatNovos
- [x] Performance: frontend — exibir métricas de clientes novos nos cards do Top 3 Vendedores

## Performance Comercial — Relatório e Dashboard de Vendedores
- [x] Performance: relatório com as 4 taxas de conversão para todos os vendedores (tabela completa por vendedor)
- [x] Performance: dashboard com métricas de clientes novos por vendedor (cards/tabela com cotacoesNovos, osNovos, faturamentoNovos, taxaConvNovos, taxaFatNovos)

## Importação histórico OS
- [x] Importar histórico de OS 2024-2026 do arquivo XLS para o banco (4.984 registros)
- [x] Validar redução de clientes novos após importação (março: 68 → 30, faturamento: R$233k → R$158k)

## Melhorias Performance Comercial (mai/2026)
- [x] Verificar se cards já refletem dados corrigidos de março/abril após importação do XLS
- [x] Funcionalidade de edição manual do status do cliente (marcar como recorrente para corrigir pré-2024)
- [x] Gráfico comparativo de faturamento: clientes novos vs recorrentes por mês
- [x] Corrigir duplicação de OS no banco (registros NULL vs vazio) — usar apenas tipoOs="" com custos preenchidos
- [x] Corrigir filtro de retrabalhos no getMesFromDb (tipoOs começa com "Retrabalho")
- [x] Excluir Amostra e Cortesia do faturamento normal
- [x] Adicionar card Ticket Médio Geral na Performance Comercial (segunda linha de KPIs)
- [x] Adicionar card Ticket Médio Clientes Novos na Performance Comercial (segunda linha de KPIs)
- [x] Gráfico de linha: evolução do ticket médio geral e de clientes novos ao longo do ano
- [x] Criar tabela custoMarketing no banco (mes, ano, investimento)
- [x] Criar procedures backend: upsertCustoMarketing, getCustoMarketingAno
- [x] Criar aba Custo Marketing no Financeiro com CAC e ROI calculados automaticamente
- [x] Corrigir contagem de propostas em aberto no CRM (Karize: 50 vs 75 no Mubisys)

## Sub-aba Custos Fixos no Painel Financeiro (14/05/2026)

- [x] Schema: tabelas custos_fixos e dividas_parcelamentos no banco
- [x] Seed: 48 custos fixos e 8 dívidas/parcelamentos importados da planilha
- [x] Backend: procedures getCustosFixos, upsertCustoFixo, deleteCustoFixo, getDividas
- [x] Frontend: sub-aba "Custos Fixos" no Painel Financeiro com navegação por abas
- [x] KPI cards: Total Custos Fixos (R$ 132.560,96), Dívidas/Parcelas, Comprometimento Total, Maior Grupo
- [x] Gráfico pizza: distribuição por grupo (Pessoal, Instalações, Operacional, etc.)
- [x] Gráfico barras horizontais: top 12 categorias de custo
- [x] Tabela detalhada com filtro por grupo e busca por texto, barra de progresso % do total
- [x] Cards de grupo clicáveis para filtrar a tabela
- [x] Seção Dívidas e Parcelamentos 2026 com gráfico de barras por mês e tabela completa
- [x] Resumo Consolidado com barras de composição e total comprometido mensal (R$ 152.643,22)

## CRUD de Despesas Fixas na Sub-aba Custos Fixos (14/05/2026)

- [x] Botão "Nova Despesa" na sub-aba Custos Fixos
- [x] Modal de formulário para adicionar/editar despesa (grupo, categoria, fornecedor, valor, tipo, vencimento, observações)
- [x] Botão de editar (lápis) e excluir (lixeira) em cada linha da tabela
- [x] Backend: procedures upsertCustoFixo e deleteCustoFixo já existem — verificar e usar

## Sub-aba Marketing no Painel Financeiro (14/05/2026)

- [x] Criar sub-aba "Marketing" no Painel Financeiro
- [x] Mover bloco de Custo de Marketing (tabela mês a mês, CAC, ROI) para a sub-aba Marketing
- [x] Remover bloco de Custo de Marketing da tela principal do Painel Financeiro

## Redesign Painel Financeiro Principal com dados de Fechamento (14/05/2026)

- [x] Analisar planilha Fechamento-2026.03 e extrair todos os dados (DRE já populado com Dez/25, Jan-Mar/26)
- [x] Criar tabelas no banco para os dados de fechamento (tabela dre_mensal criada)
- [x] Popular banco com dados da planilha via seed
- [x] Redesenhar tela principal do Painel Financeiro com visual Power BI (PainelDRE.tsx)
- [x] KPIs principais: faturamento, custos, lucro, margem, ticket médio
- [x] Gráficos: evolução mensal, composição de custos, DRE visual
- [x] Manter sub-abas Custos Fixos e Marketing intactas

## Redesign Painel Financeiro Principal com DRE (14/05/2026)

- [x] Criar tabela dre_mensal no banco e popular com dados de Dez/25, Jan/26, Fev/26, Mar/26
- [x] Backend: procedures getDreMensal e getDreMensalAno no router financeiro
- [x] Criar componente PainelDRE.tsx com visual Power BI completo
- [x] KPIs: Receita Op. Bruta, Total Saídas, Lucro Operacional, Lucro Líquido, Margens
- [x] Gráficos: Receita vs Saídas, Evolução de Margens (área), Composição de Custos (barras empilhadas), Pizza de distribuição
- [x] Tabela DRE Gerencial com todas as linhas do demonstrativo e coluna de média
- [x] Tabela de composição de custos % por mês
- [x] Seletor de mês de referência para os KPIs
- [x] Substituir conteúdo da aba Painel pelo novo PainelDRE
- [x] Manter sub-abas Custos Fixos e Marketing intactas

## Melhorias Sub-aba Marketing (14/05/2026)

- [x] Adicionar KPI "Faturamento Total de Clientes Novos" na sub-aba Marketing
- [x] Adicionar filtro de mês nas células/KPIs da sub-aba Marketing
- [x] Corrigir ROI: usar 51% do faturamento de novos clientes (margem real) em vez do faturamento bruto
- [x] Recalcular média do ROI com a nova fórmula

## PDF e Sub-aba Tabela Novo Cliente (15/05/2026)

- [x] Melhorar o visual do PDF da tabela de preços — mais moderno, legível e bem organizado
- [x] Criar sub-aba "Tabela Novo Cliente" em Precificação com os mesmos recursos da tabela principal

## Scripts CRM — Melhorias v2 (16/05/2026)
- [x] Scripts CRM: variáveis dinâmicas ({nome_cliente}, {produto}, {valor}) com substituição automática ao copiar
- [x] Scripts CRM: contador visual de cópias por script (badge com número)
- [x] Scripts CRM: drag-and-drop para reordenação dos scripts no painel (atualiza campo ordem no banco)

## Scripts CRM — Bug Edição de Voz (16/05/2026)
- [x] Bug: campo de edição do script de voz não aparecia (estava dentro do bloco !editing)
- [x] Correção: subcélula de voz tem botão ✏️ próprio com estado editingVoz independente do editing global
- [x] Ao clicar ✏️, abre Textarea com autoFocus e botões Salvar/Cancelar dentro da subcélula
- [x] Salvar envia apenas conteudoVoz sem afetar o conteudo principal do script

## Scripts CRM — Subcélula de Voz (16/05/2026)
- [x] Schema: coluna conteudo_voz (mediumtext, nullable) adicionada à tabela crm_scripts
- [x] Backend: procedures updateScript e addScript aceitam conteudoVoz opcional
- [x] Backend: validadores de faixa expandidos para aceitar até 20 (inclui Objeções Preço)
- [x] Frontend: subcélula de voz com Collapsible (laranja) abaixo do botão "Copiar mensagem" em cada script
- [x] Frontend: botão "Script para áudio / voz" com ícone de microfone e ChevronDown animado
- [x] Frontend: mensagem "Nenhum script de voz cadastrado. Clique em editar (✏️) para adicionar." quando vazio
- [x] Frontend: botão "Copiar script de voz" separado quando há conteúdo de voz
- [x] Frontend: campo de edição de conteudoVoz no modo de edição (Textarea laranja)
- [x] Frontend: popover abre para BAIXO (side=bottom, avoidCollisions=false)
- [x] TypeScript: cache limpo, 0 erros confirmado

## Performance Comercial — Comparação de Meses e Metas (16/05/2026)
- [x] Schema: expandir tabela metasComerciais com novos campos (metaOsGeradas, metaClientesNovos, metaFaturamento, metaTaxaFaturamento, metaTicketMedioNovos, metaValorOrcado)
- [x] Backend: upsertMeta aceita todos os novos campos
- [x] Frontend: badge de meta no canto inferior de cada KPI card (longe/~meta/atingido com %)
- [x] Frontend: metaGeral (vendedor = "GERAL") calculada via useMemo das metas
- [x] Frontend: linha META GERAL na tabela de desempenho por vendedor com badges de progresso
- [x] Frontend: seção "Comparar Meses — Power BI" com seletor de meses (chips clicáveis)
- [x] Frontend: cards de resumo comparativo (Cotações, OS Geradas, Faturamento, Taxa Conv., Taxa Fat., Valor Orçado, Ticket Médio) com barras horizontais por mês
- [x] Frontend: gráfico "Cotações vs OS Geradas por Mês" (barras agrupadas)
- [x] Frontend: gráfico "Faturamento vs Valor Orçado por Mês" (barras + linha pontilhada)
- [x] Frontend: gráfico "Taxas de Conversão e Faturamento por Mês" (linhas duplas)
- [x] Frontend: tabela comparativa detalhada com todos os indicadores por mês

## Metas Comerciais — Correções (17/05/2026)
- [x] Metas individuais: excluir Joice e Daniel da lista de vendedores com metas individuais
- [x] Schema/backend: adicionar campos de metas faltantes (metaFaturamentoNovos, metaTicketMedioNovos, metaOsNovos, metaCotacoesNovos, metaTaxaFaturamento)
- [x] Frontend metas: adicionar campos editáveis para todos os novos indicadores de novos clientes
- [x] Bug: metas de clientes novos não estavam salvando — corrigir upsertMeta para incluir novos campos
- [x] Comparação de meses: adicionar cards OS Novos, Faturamento Novos, Ticket Médio Novos
- [x] Comparação de meses: exibir meta atual no topo de cada card comparativo
- [x] Comparação de meses: indicar visualmente quais meses atingiram a meta (badge/destaque verde)

## Metas Comerciais — Correções (17/05/2026)
- [x] Excluir Joice e Daniel das metas individuais de vendedor (filtro EXCLUIR_METAS_INDIVIDUAIS)
- [x] Corrigir bug: metaClientesNovos não era enviado no saveGeralMeta
- [x] Adicionar campos de metas: Faturamento Novos, Ticket Médio Novos, OS Novos, Cotações Novos, Taxa Faturamento
- [x] Schema: metaOsNovos e metaCotacoesNovos adicionados à tabela metasComerciais
- [x] Backend: upsertMeta aceita todos os novos campos
- [x] Backend: getClientesNovosMes retorna ticketMedioNovos
- [x] Comparação de meses: cards OS Novos, Fat. Novos, Ticket Novos com fundo teal
- [x] Comparação de meses: meta no topo de cada card (badge "Meta: X")
- [x] Comparação de meses: destaque verde (✓) para meses que atingiram a meta
- [x] Tabela comparativa: colunas OS Novos, Fat. Novos, Ticket Novos em teal
- [x] Tabela comparativa: ✓ verde para OS Geradas e Faturamento quando meta atingida
- [x] TypeScript: 0 erros confirmado (tsc --noEmit EXIT:0)

## Bug Crítico — OS de Clientes Novos (17/05/2026)
- [x] Investigar por que OS de clientes novos caiu de 17 para 11 (mudança suspeita após atualização do getMultiMes)
- [x] Verificar se a lógica de cálculo no getClientesNovosMes (procedure getMes) diverge da nova lógica no getMultiMes
- [x] Confirmar qual é o número correto: 17 (API Mubisys em tempo real) vs 11 (banco local desatualizado)
- [x] Correção: getMultiMes agora usa getClientesNovosMes() (API em tempo real para mês atual, banco para histórico)

## Correção Definitiva — OS Clientes Novos (17/05/2026)
- [x] Investigar divergência historico_os vs API Mubisys para meses históricos (Jan-Abr/2026)
- [x] Corrigir getClientesNovosMes para usar API Mubisys em TODOS os meses (não só o atual)
- [x] Corrigir getMultiMes para consistência total com API
- [x] Verificar números Jan-Mai/2026 no browser e confirmar consistência entre cards e comparação — getMultiMes corrigido para usar API Mubisys em todos os meses
- [x] Criar skill crm-mubisys-debug documentando a lógica correta e armadilhas

## Performance Comercial — Cache e Deduplicação API (17/05/2026)
- [x] Bug: Cotações = 0 no mês atual (API Mubisys de orçamentos dava timeout por múltiplas chamadas simultâneas)
- [x] Implementar cache em memória (TTL 3 min) para resultados de getMesFromApi (OS + orçamentos)
- [x] Implementar deduplicação de chamadas simultâneas (pendingApiCalls) para evitar múltiplas requisições à API para o mesmo mês
- [x] Salvar OS e orçamentos brutos no cache para reutilização por getClientesNovosMes
- [x] Tempo de resposta reduzido de 75s para 12s (cache hit nas chamadas subsequentes)

## Correções Urgentes (17/05/2026)
- [x] Fix: Performance Comercial — sistema em looping/skeleton infinito (não carrega dados do ERP)
- [x] Fix: Área comercial sem integração ERP — CRM e Performance não puxam dados da API Mubisys
- [x] Fix: Gráfico Anexo 2 (Evolução Mensal de Custo) — redesenhar com visual melhor e dados corretos
- [x] Fix: Apagar aba "Configuração de Metas — CRM" do sidebar/menu
- [x] Fix: Revisão geral de performance — reduzir número de queries simultâneas, adicionar staleTime

## Correções e Melhorias (17/05/2026 — sessão 2)
- [x] Fix: Botão "Gerar com IA" adicionado na Tabela5W2H (endpoint gerarAcoesIA via invokeLLM)
- [x] Fix: Props titulo/problemaRaiz/codigoErro adicionados ao componente Tabela5W2H
- [x] Fix: Chamada ao Tabela5W2H atualizada com todos os props obrigatórios
- [x] Fix: Erro TypeScript em qualidade.ts (content pode ser string ou array) corrigido

## Tabela de Preços — Separação MS e Brasil (17/05/2026)
- [x] Tabela Principal: duplicar seções de PVC Expandido/Acrílico/ACM em "Clientes MS" (margens -4pp) e "Clientes Brasil"
- [x] Tabela Novo Cliente: duplicar seções de PVC Expandido/Acrílico/ACM em "Clientes MS" (margens -4pp) e "Clientes Brasil"
- [x] Criar seções via script/SQL para garantir que as duas versões existam no banco
- [x] Exibir badge/indicador visual diferenciando seções MS e Brasil na interface

## Correções (17/05/2026 — sessão 3)
- [x] Fix: Cards OS (Novos), Fat. (Novos) e Ticket (Novos) zerados em Performance Comercial — getMultiMes não incluía osNovos/faturamentoNovos/ticketMedioNovos no retorno; corrigido para calcular do banco local e enriquecer o resultado de cada mês

## Performance Comercial — Indicadores de Meta (17/05/2026)
- [x] Cards KPI: badge no canto inferior direito com meta + distância percentual (ex: −14% ou +5%) nos cards com meta definida
- [x] Barras mensais: indicador de distância da meta em cada linha de mês nos cards comparativos

## Correções (17/05/2026 — sessão 4)
- [x] Fix: Ocultar indicador de distância da meta para o mês atual (em andamento) nas barras mensais — Mai/26 mostrava 0% e −100% por dados incompletos

## Correções (17/05/2026 — sessão 5)
- [x] Fix: Cards Taxa Conv. Geral, Taxa Fat. Geral, Taxa Conv. Novos, Taxa Fat. Novos sem badge de meta
- [x] Fix: Cards Cotações (Novos) e OS Geradas (Novos) sem badge de meta
- [x] Fix: Ocultar indicador de distância da meta no mês atual (Mai/26) nas barras mensais comparativas

## Metas Comerciais — Novos Campos (17/05/2026 — sessão 6)
- [x] Schema: adicionar metaConversaoNovos (decimal 5,2) à tabela metasComerciais
- [x] Schema: adicionar metaTaxaFaturamentoNovos (decimal 5,2) à tabela metasComerciais
- [x] Migração SQL aplicada no banco
- [x] Preencher metaValorOrcado = 2125000 e metaTaxaFaturamentoNovos = 5 para o registro META GERAL do mês atual
- [x] Formulário de metas: exibir e editar metaConversaoNovos e metaTaxaFaturamentoNovos
- [x] KpiCard Taxa Conv. Novos: usar metaConversaoNovos (novo campo) em vez de metaConversao
- [x] KpiCard Taxa Fat. Novos: usar metaTaxaFaturamentoNovos (novo campo) em vez de metaTaxaFaturamento
- [x] Comparativo Power BI: incluir todos os indicadores com meta definida (cotacoesNovos, osNovos, faturamentoNovos, ticketMedioNovos, taxaConversao, taxaFaturamento, taxaConversaoNovos, taxaFaturamentoNovos, valorOrcado)

## Comparar Meses Power BI — Correções (Mai/26)
- [x] Fix: Maio/26 aparece zerado em Cotações, Taxa Conv., Taxa Fat. e Valor Orçado no comparativo — getMultiMes usa API para meses passados mas mês atual deve usar banco local
- [x] Feature: Adicionar linha de média geral por indicador nos cards do comparativo Power BI

## Comparar Meses Power BI — Média nas barras mensais (17/05/2026 — sessão 7)
- [x] Feature: Adicionar linha de média geral nas barras mensais do comparativo (igual ao card Taxa Fat. da imagem — linha âmbar "Média" acima dos meses)

## Comparar Meses Power BI — Excluir mês atual (17/05/2026 — sessão 8)
- [x] Filtrar mês atual de todos os dados do comparativo: mini-cards, tabela e gráficos

## Comparar Meses — Linha de Média nas barras mensais (17/05/2026 — sessão 9)
- [x] Adicionar linha "Média" (âmbar) no topo de cada card de barras mensais, calculada excluindo o mês em andamento

## Comparar Meses — Linha Média nos mini-cards (17/05/2026 — sessão 10)
- [x] Corrigir linha Média nos mini-cards: exibir valor médio correto (ex: R$ 386.268,77) e distância % da meta (ex: -9%)

## Comparar Meses — Arredondamento da Média (17/05/2026 — sessão 11)
- [x] Simplificar média nos mini-cards: arredondar percentuais para 1 casa decimal, ocultar centavos em valores monetários

## Relatório Mensal — Retrabalhos Zerados (17/05/2026 — sessão 12)
- [x] Investigar e corrigir retrabalhos zerados em Março, Abril e Maio no relatório mensal (faturamento e pedidos aparecem mas retrabalhos = 0)

## Planos de Ação Comercial — Novos Itens (17/05/2026 — sessão 13)
- [x] Adicionar nova aba "Planos de Ação" com checklist de itens por data
- [x] Itens com data de conclusão: Atualizar catálogo comercial, Trocar foto, Usar Vectorize.ia, Campanha novo cliente
- [x] Itens de uso permanente (recorrentes): Usar CRM diariamente com scripts de venda, Acompanhamento diário de metas e métricas, Foco em novo cliente
- [x] Campo de tipo: "Data de Conclusão" vs "Uso Permanente" por item
- [x] Itens editáveis: título, descrição, data, tipo, status (pendente/em andamento/concluído)

## Evolução por Vendedor — Gráficos (17/05/2026 — sessão 12)
- [x] Backend: procedure getEvolucaoVendedor retornando dados mensais por vendedor (cotações, OS, taxas, faturamento, novos)
- [x] Frontend: componente com seletor de vendedor + seletor de indicador + gráfico de linha Recharts
- [x] Integrar como nova seção/aba na página PerformanceComercial

## Custo Efetivo por Metro de Solda — Refatoração (18/05/2026)
- [x] Schema: adicionar coluna numSoldadores e custoProdutividadeSolda em performance_mensal
- [x] Migration SQL: ALTER TABLE performance_mensal ADD numSoldadores/custoProdutividadeSolda
- [x] Backend: adicionar numSoldadores e custoProdutividadeSolda no router upsert
- [x] Frontend CustoSolda: campo "Nº de Soldadores" na célula Soldador Interno
- [x] Frontend CustoSolda: nova célula "Custo de Produtividade da Solda (R$/mês)"
- [x] Frontend CustoSolda: recalcular custo interno = (salários × nSoldadores + produtividade) / metros internos
- [x] Frontend CustoSolda: remover célula "Preço de Venda"
- [x] Frontend CustoSolda: remover cards de Margem (dependem de preço de venda)
- [x] Frontend CustoSolda: manter comparativo visual interno vs terceirizado sem preço de venda

## Tabela de Preços — Identificação MS/Geral e Impressão (18/05/2026)
- [x] Adicionar badge/label MS vs Geral/Brasil no título das seções PVC Expandido na view da tabela
- [x] Melhorar template de impressão PDF: fontes maiores, tabelas legíveis, identificação MS/Geral clara
- [x] Adicionar @media print no CSS global para impressão direta pelo navegador

## Performance Comercial — Dados Zerados (18/05/2026)
- [x] Diagnosticar por que cotações e valor orçado estão zerados em Maio 2026
- [x] Verificar se a procedure getPerformanceComercial busca cotações do mês atual via API ou banco
- [x] Corrigir lógica de busca de cotações para o mês atual (banco pode não ter dados do mês corrente)

## Performance Comercial — Taxas de Conversão Incorretas (18/05/2026)
- [x] Diagnosticar fórmula de Taxa de Conversão (OS/Cotações) — verificar se cotações incluem duplicatas/versões
- [x] Diagnosticar Taxa de Faturamento (Fat/Orçado) — verificar se valor orçado está correto
- [x] Diagnosticar Taxa Conv. Geral, Taxa Fat. Geral, Taxa Conv. Novos, Taxa Fat. Novos
- [x] Verificar se orçamentos com múltiplas versões estão sendo contados múltiplas vezes
- [x] Corrigir fórmulas e lógica de cálculo de todas as taxas

## Conflito Faturamento Novos Clientes (18/05/2026)
- [x] Diagnosticar divergência: Marketing mostra R$ 158.453 vs Performance Comercial R$ 72.192 para Março 2026
- [x] Identificar fonte de dados de cada tela (banco local vs API MubiSys)
- [x] Unificar fonte de dados para faturamento de novos clientes — banco local tem ~45% das OS (importações parciais), API tem 100%; paginação corrigida em getClientesNovosMes resolve os valores duplicados/errados

## Correções de Paginação e Filtros OS (18/05/2026)
- [x] Corrigir paginação em getClientesNovosMes: usar data.pagination.last_page e per_page=100 (era per_page=500 + next_page_url inexistente)
- [x] Corrigir paginação em fetchAllPages (crm.ts): usar data.pagination.last_page e per_page=100
- [x] Adicionar helper isOsNormalDb() em performanceComercial.ts para filtrar OS do banco local
- [x] Aplicar isOsNormalDb() em getMultiMes (loop de OS Novos do banco local)
- [x] Aplicar isOsNormalDb() em getClientesNovosAno (loop de OS Novos do banco local)
- [x] Diagnosticar divergência Marketing vs Performance Comercial: banco local tem ~45% das OS (importações parciais), API tem 100% — divergência é esperada entre fontes
- [x] Atualizar skill crm-mubisys-debug com regras de paginação, filtros tipoOs e diagnóstico SQL

## Performance Comercial — Subabas e Gráficos (18/05/2026)

- [x] Criar subabas no Performance Comercial (Visão Geral, Mês Vigente, Evolução por Vendedor)
- [x] Criar procedure getEvolucaoDiariaMes no router performanceComercial (dados diários por vendedor)
- [x] Criar componente EvolucaoDiariaVendedor com gráfico diário e acumulado do mês vigente
- [x] Ocultar centavos nos KPI cards (maximumFractionDigits: 0 em todos os toLocaleString)
- [x] MetaBadge já existia — exibe meta no cantinho inferior direito de cada KPI card
## Metas Individuais por Vendedor e Integração MetaBadge (19/05/2026)
- [x] Aba "Mês Vigente" verificada — procedure getEvolucaoDiariaMes busca dados reais da API MubiSys sem erros
- [x] Expandir formulário de metas individuais por vendedor: adicionar OS Geradas, Valor Orçado, Taxa Faturamento, Clientes Novos, Faturamento Novos
- [x] Exibir score de metas atingidas no cabeçalho de cada vendedor na tela de Metas Comerciais
- [x] Adicionar barra de progresso de meta individual na coluna Valor Orçado da tabela de Performance Comercial
- [x] Adicionar barra de progresso de meta individual na coluna Taxa Faturamento da tabela de Performance Comercial
- [x] Adicionar campo MetaCell editável para Valor Orçado e Taxa Faturamento na tabela de Performance Comercial (modo edição)

## Correções e Melhorias (18/05/2026 — Sessão 2)

- [x] Corrigir erro JSX "Expected corresponding JSX closing tag for DashboardLayout" no PerformanceComercial.tsx (div wrapper da aba visão-geral estava ausente)
- [x] Adicionar div wrapper com display:none para aba visão-geral (substituindo hidden/contents que causava erro de parse)
- [x] Confirmar que MetaBadge exibe meta geral no canto de cada KPI card da Visão Geral
- [x] Confirmar que tabela de breakdown por vendedor tem barras de progresso individuais para todos os indicadores
- [x] Confirmar que tela MetasComerciais (/comercial/metas) está acessível e funcional com metas individuais por vendedor

## Performance Comercial — Correções e Nova Aba (19/05/2026)

- [x] Corrigir aba Mês Vigente: EvolucaoDiariaVendedor usa dia.porVendedor[v] mas procedure retorna ${v}__os etc.
- [x] Reformular aba Evolução por Vendedor com visual profissional de gestão
- [x] Criar procedure getInteligenteClientes: clientes únicos no ano, taxa de recompra, tempo proposta→pedido, clientes novos que recompraram
- [x] Criar aba Inteligência de Clientes no Performance Comercial

## Tempo Proposta → Fechamento (19/05/2026)
- [x] Substituir algoritmo de cruzamento por número de orçamento pelo cruzamento por cliente+vendedor+janela de 90 dias
- [x] Corrigir duplo dois-pontos na procedure listClienteOverrides (erro de sintaxe esbuild)
- [x] Componente InteligenteClientes já preparado para exibir dados quando disponíveis

## Importação de Dados Históricos e Inteligência de Clientes (19/05/2026)
- [x] Importar OS 2025 (2.202 registros) para historico_os
- [x] Importar Orçamentos 2025 (6.353 registros) para historico_orcamentos
- [x] Atualizar OS 2026 (675 registros) no historico_os
- [x] Atualizar Orçamentos 2026 (2.573 registros) no historico_orcamentos
- [x] Recriar componente InteligenteClientes.tsx com métricas de clientes únicos, recompra e tempo proposta→fechamento
- [x] Corrigir linha 'test' solta que impedia carregamento do sistema

## Correções e Melhorias — 2026-05-19
- [x] Restaurar rota /login no App.tsx (vendedores sem acesso ao sistema)
- [x] Adicionar botão "Entrar no sistema" no sidebar quando não há usuário logado
- [x] Adicionar ícone LogIn ao DashboardLayout
- [x] Corrigir erros de TypeScript: EvolucaoVendedor.tsx (indexação por string)
- [x] Corrigir erros de TypeScript: InteligenteClientes.tsx (tipos implícitos)
- [x] Corrigir tsconfig.json: adicionar target ES2020 e downlevelIteration
- [x] Inteligência de Clientes: adicionar % de clientes novos entre clientes únicos
- [x] Inteligência de Clientes: adicionar taxa de recompra de novos clientes
- [x] Inteligência de Clientes: adicionar média de OS por cliente no ano
- [x] Inteligência de Clientes: adicionar % de clientes sem compra há mais de 6 meses
- [x] Inteligência de Clientes: reformular KPIs em 2 seções (Base + Fidelização)
- [x] Inteligência de Clientes: atualizar tabela por vendedor com todos os 7 indicadores
- [x] Backend: adicionar campos pctClientesNovos, taxaRecompraNovosPct, mediaComprasPorCliente, pctClientesSemCompra6Meses na procedure getInteligenteClientes
- [x] Inteligência de Clientes: filtro de período por mês inicial + mês final (ex: Jan/2025 a Dez/2025)
- [x] Inteligência de Clientes: cache em banco com botão Atualizar e data da última atualização
- [x] Inteligência de Clientes: corrigir cálculo de Tempo Médio de Fechamento (algoritmo por cliente+vendedor+janela 90 dias)

## Melhorias Menu (19/05/2026)
- [x] Reativar item "Custos de LED" no menu de Operações (estava oculto)
- [x] Adicionar barra de busca no sidebar para encontrar itens do menu rapidamente

## Correções do Módulo POP (19/05/2026)
- [x] PDF do POP corrigido: popPdf.ts agora converte HTML do TipTap para texto antes de renderizar (suporte a OL, UL, P, H2, H3, STRONG, EM)
- [x] Editor do POP corrigido: espaçamento adequado entre linhas (line-height: 1.7), parágrafos (margin: 0.75em), listas e títulos no ProseMirror
- [x] StepsRenderer atualizado: detecta HTML e renderiza com prose/dangerouslySetInnerHTML; texto puro usa parser legado
- [x] Objetivo no conteúdo expandido: suporta HTML (dangerouslySetInnerHTML) e texto puro
- [x] Plugin @tailwindcss/typography adicionado ao index.css para classes prose-*

## Horas de Impacto nos Retrabalhos (20/05/2026)
- [x] Schema: adicionar campo `horasImpacto` (decimal, nullable) na tabela retrabalhos
- [x] Migration SQL: ALTER TABLE retrabalhos ADD COLUMN horasImpacto DECIMAL(6,2)
- [x] Backend: incluir horasImpacto nos endpoints list, create, update de retrabalhos
- [x] Frontend Inserção Rápida: adicionar campo "Horas de Impacto" na tabela inline
- [x] Frontend Cadastro de Retrabalho (modal/form): adicionar campo "Horas de Impacto"
- [x] Frontend Dashboard: exibir total de horas de impacto como KPI (card roxo)
- [x] Frontend Tabela Retrabalhos: coluna "Horas Imp." exibindo valor em roxo
- [x] PDF do POP corrigido com html2canvas (renderização fiel ao visual web, sem fonte monoespaçada)

## Correções Performance Comercial (22/05/2026)
- [x] Correção crítica: filtrodata=APROVACAO → filtrodata=CADASTRO nas OS da API MubiSys (performanceComercial.ts)
- [x] per_page aumentado para 500 em ambas as funções fetchAll (OS e orçamentos)
- [x] Correção bug versao===versao_atual que descartava ~200 cotações (352 vs 552)
- [x] TypeError corrigido no Mês Vigente (acesso inseguro a porVendedor[Daniel Alencar])
- [x] Evolução por Vendedor filtrada para mostrar apenas Sthefanie, Letícia e Karize
- [x] Inteligência de Clientes: per_page 100→500, bug de re-render corrigido com useEffect
- [x] Cache de Maio 2026 limpo no banco (DELETE FROM inteligencia_clientes_cache)

## Fornecedores e Admin (22/05/2026)
- [x] Fornecedores: nome da empresa em destaque, contato como secundário
- [x] Fornecedores: botão WhatsApp verde abre conversa direta com +55
- [x] Admin: enum Zod do localUsers.update e setPermission inclui "gestor" e "empacotamento"
- [x] Admin: lista ROLES atualizada com Gestor e Empacotamento

## CRM — Etiquetas das Faixas (22/05/2026)
- [x] Tabela crm_faixa_etiquetas criada no banco
- [x] Endpoints getFaixaEtiquetas e saveFaixaEtiqueta adicionados em crm.ts
- [x] UI de edição de etiquetas das faixas adicionada em CRMConfig.tsx

## Skill crm-mubisys-debug (22/05/2026)
- [x] Documentado bug crítico filtrodata=APROVACAO vs CADASTRO (causa OS aparecerem como 16 em vez de 104)
- [x] Documentado per_page=500 validado e testado
- [x] Checklist de diagnóstico atualizado com verificação de filtrodata

## Correções Performance Comercial — Maio 2026 (22/05/2026)

- [x] Corrigir per_page=500→200 para /orcamento em fetchAll (per_page=500 causa timeout silencioso → cotacoes=0)
- [x] Corrigir per_page=500→200 para /orcamento em fetchAllLocal (getMultiMes)
- [x] Corrigir per_page=500→200 para /orcamento em fetchAllPagesIC (getInteligenteClientes)
- [x] Corrigir filtrodata=APROVACAO→CADASTRO em getClientesNovos (linhas ~452)
- [x] Corrigir filtrodata=APROVACAO→CADASTRO em getMultiMes/fetchAllLocal (linhas ~1192)
- [x] Corrigir filtrodata=APROVACAO→CADASTRO em getInteligenteClientes/fetchAllPagesIC (linhas ~1428)
- [x] Remover filtro versao===versao_atual em getEvolucaoDiariaMes (linha ~1205)
- [x] Remover filtro versao===versao_atual em getInteligenteClientes (linha ~1572)
- [x] Aumentar timeout getMultiMes de 12s→40s para acomodar 3 paginas de orcamentos
- [x] Atualizar skill crm-mubisys-debug com bug do per_page e timeout

## Sistema de Auditoria e Congelamento de Dados (24/05/2026)

- [x] Schema: tabela performance_auditada (mes, ano, cotacoes, os_normais, taxa_conversao, faturamento, valor_orcado, clientes_novos, congelado, data_auditoria, observacoes)
- [x] Migration SQL e aplicar no banco
- [x] Router: procedure getAuditoria (buscar dados auditados/congelados de um mês)
- [x] Router: procedure salvarAuditoria (salvar dados auditados com status pendente)
- [x] Router: procedure congelarAuditoria (marcar congelado=1)
- [x] Router: procedure descongelarAuditoria (marcar congelado=0 para recalibragem)
- [x] Integrar getMes: verificar se há dados congelados antes de buscar API
- [x] UI: badge de status na Performance Comercial (Tempo Real / Auditado / Congelado)
- [x] UI: botão "Auditar e Congelar Dados" na Visão Geral com modal de confirmação
- [x] UI: modal mostra tabela de auditoria com valores ERP atuais e permite confirmar congelamento
- [x] UI: badge mostra data da auditoria e permite descongelar (recalibragem)

## Correção filtrodata OS — faturamento correto (24/05/2026)
- [x] OS: mudar filtrodata=CADASTRO → filtrodata=APROVACAO em todas as 5 ocorrências do performanceComercial.ts
- [x] Orçamentos: manter filtrodata=CADASTRO (data de criação = cotação enviada)
- [x] Diagnóstico confirmado: APROVACAO retorna 103 OS e R$ 252.984 (bate com Excel 103 OS / R$ 251.278)
- [x] Reiniciar servidor para limpar cache em memória com dados antigos

## Bugs e Melhorias — Maio/2026

- [x] Bug: TypeError porVendedor.map — dados congelados retornam porVendedor:{} (objeto) em vez de array, causando crash no frontend
- [x] Melhoria: Layout mobile da Performance Comercial — cabeçalho, botões e subabas empilhados verticalmente no mobile
- [x] Melhoria: Modal de auditoria responsivo — tabela com scroll horizontal, botões empilhados no mobile, texto menor

## Performance — Meses Congelados (Maio/2026)

- [x] Bug: getClientesNovos sempre chama API MubiSys mesmo quando mês está congelado — deve retornar dados do snapshot imediatamente
- [x] Bug: getMultiMes (evolução por vendedor) não verifica dados congelados — deve usar snapshot para meses congelados

## Melhorias de UX — Performance Comercial (Maio/2026 v2)

- [x] Feature: Indicador visual de velocidade/fonte — badge mostrando "Carregado em Xs — dados congelados/tempo real" no header
- [x] Feature: Botão para congelar múltiplos meses históricos de uma vez (Jan–Abr) com progresso visual

## Inteligência de Clientes — Melhorias (Maio/2026)

- [x] Bug: Verificar se "Auditar e Congelar" na aba Inteligência de Clientes funciona sem erro (crash ao clicar)
- [x] Bug: Garantir que dados congelados na Inteligência de Clientes são retornados do banco sem chamar a API
- [x] Feature: Indicador de velocidade/fonte na Inteligência de Clientes (badge "Xs — congelado/tempo real")
- [x] Feature: Estatística de tempo médio entre orçamento e fechamento (dias entre data do orçamento e data da OS aprovada)

## Bug: Permissões Suellen — Operações (Maio/2026)

- [x] Bug: pageKey "operacoes-custos" no banco ≠ "operacoes-custo-solda" no menu — Suellen não vê itens de Operações
- [x] Bug: "Custos de LED" usa mesma pageKey de "Custo de Solda" — criar pageKey "operacoes-custo-led" separada
- [x] Fix: Adicionar pageKeys corretas ao PAGE_KEYS no schema e migrar banco
- [x] Fix: Corrigir pageKeys no DashboardLayout para todos os itens de Operações
- [x] Fix: Inserir permissões corretas para role gestor no banco

## Painel Financeiro — Novos Campos (Fechamento Abr/2026)
- [x] Schema: adicionar campos novos à tabela financeiro_mensal (impostos detalhados: DAS, ICMS DIFAL, DAEMS; comissões externas BV; produtividade solda; frete retrabalho; dev software; TL1/TL2/TL3; resultado efetivo; saldo mês; receita operacional OS)
- [x] Migration: gerar e aplicar SQL da migration
- [x] Backend: atualizar procedure financeiro.upsert e financeiro.list para incluir novos campos
- [x] Frontend: adicionar novos campos ao formulário de edição mensal no Financeiro.tsx (agrupados por seção)
- [x] Frontend: exibir novos campos na visão expandida e no PainelDRE

## Painel Financeiro — Comparativo e Bug Abril
- [x] Bug: Abril não aparece nos botões de mês de referência — investigar filtro/lógica de exibição
- [x] Feature: Painel comparativo anual com todos os meses, médias e lucro/prejuízo acumulado

## Clientes Novos — Lista e Controle de Contato
- [x] Criar tabela cliente_novos_contato no banco para persistir status de contato (empresa, mes, ano, contatado, data_contato)
- [x] Adicionar campo lista_clientes_novos (mediumtext JSON) na tabela performance_auditada
- [x] Corrigir backend: ao retornar dados de meses congelados, buscar lista da API e salvar no snapshot
- [x] Adicionar procedure setContatado para marcar/desmarcar cliente como contatado
- [x] Frontend: adicionar coluna "Contatado" com checkbox na tabela de Clientes Novos
- [x] Frontend: checkbox persiste via API e não some ao navegar entre meses

## Melhorias e Bugs (28/05/2026 — sessão 3)

- [x] Clientes Novos: adicionar coluna Estado (UF) na tabela de todos os meses
- [x] Performance Comercial Abril: corrigir índices zerados (Cotações Novos=0 e Taxa Fat. Novos=0%)
- [x] Relatório de acesso/download de POPs: schema, backend e página de relatório
- [x] Fornecedores: mostrar quem cadastrou e quem fez a última edição (schema + backend + frontend)
- [x] Metas Comerciais: corrigir campos Taxa Faturamento e Ticket Médio Geral que ficam zerados após salvar

## Painel de Auditoria do CRM (29/05/2026)

- [x] Schema: tabela crm_atividade_log (id, vendedor, acao, orcamento_id, empresa, turno, detalhe, realizada_em)
- [x] Backend: função logAtividade() e calcTurno() no crm.ts
- [x] Backend: instrumentar mutations registrarContato, marcarGanha, marcarPerdida, desfazarContato
- [x] Backend: procedure getAuditoria com 7 blocos (A=rotina, B=volume faixa, C=descartes, D=limbo, E=velocidade, F=ranking, G=diagnóstico)
- [x] Backend: procedure getLogDia para drill-down por vendedor e dia
- [x] Frontend: página CrmAuditoria.tsx com calendário de rotina manhã/tarde, blocos A-G, drill-down por dia
- [x] Frontend: registrar rota /comercial/crm-auditoria no App.tsx com ProtectedRoute
- [x] Frontend: adicionar item "Auditoria do CRM" no menu lateral (seção Comercial) com ícone Activity
- [x] Frontend: adicionar pageKey "crm-auditoria" na matriz de permissões (PAGE_GROUPS + DEFAULT_PERMISSIONS admin)

## Aba Auditoria dentro do CRM (29/05/2026 — sessão 4)

- [x] Backend: atualizar procedure getAuditoria para aceitar filtros de vendedor e período (dataInicio/dataFim)
- [x] Backend: adicionar bloco de exclusões no getAuditoria — quantos contatos foram excluídos, com detalhe de quais tinham faixa1/faixa2/faixa3 preenchidas antes da exclusão (usar crmAtividadeLog acao='desfazer_contato')
- [x] Frontend: aba Auditoria dentro do CRM.tsx com filtros de vendedor (todos/individual) e período (hoje/semana/mês/2 meses/período livre)
- [x] Frontend: cards de resumo (total ações, contatos registrados, ganhas, perdidas, excluídos)
- [x] Frontend: tabela de exclusões com colunas: OS, empresa, vendedor, data exclusão, faixas que estavam preenchidas antes
- [x] Frontend: calendário de rotina manhã/tarde por vendedor com aderência %
- [x] Frontend: ranking de engajamento por score no período selecionado

## Correções Performance Comercial (29/05/2026)

- [x] Incluir Maio/26 na comparação de meses (remover exclusão do mês atual)
- [x] Corrigir Conv. Novos que aparecia 0% para Fev e Mar (alias taxaConversaoNovos no snapshot)
- [x] Dashboard Clientes Novos por Vendedor: reconstruir porVendedorNovos a partir do snapshot para todos os meses congelados
- [x] Corrigir UF/estado dos clientes novos: limpar snapshots para forçar recálculo com campo estado
- [x] Média dos cards KPI: incluir mês atual (Maio) na média geral
- [x] Linha de média da tabela comparativa: incluir mês atual

## Exportação PDF do Relatório de Retrabalhos (29/05/2026)

- [x] Instalar jsPDF + jspdf-autotable no projeto (já estava instalado)
- [x] Criar componente exportarRelatorioPDF.ts com geração client-side
- [x] Layout PDF: capa com título, período, totais e logo
- [x] Layout PDF: seção por setor com cor de destaque, lista de ocorrências com descrição completa
- [x] Layout PDF: painel de colaboradores com ranking de incidências
- [x] Botão "Exportar PDF" na página Relatorio.tsx respeitando filtros ativos

## Mistura de Tipos de LED no Controle de Custos (03/06/2026)

- [x] Schema: adicionar campo led_tipo_efetivo_id na tabela led_lancamentos
- [x] Backend: ajustar cálculo de custo efetivo para usar tipo efetivo quando diferente do previsto
- [x] Frontend: adicionar seletor "Tipo de LED Efetivo" no modal de lançamento (opcional)
- [x] Frontend: exibir na tabela quando há mistura de tipos (badge ou indicador visual)

## Observações e Análise Mensal no Painel Financeiro (03/06/2026)

- [x] Schema: criar tabela observacoes_financeiras_mensais (mes, ano, observacoes_manuais, analise_ia, updatedAt)
- [x] Backend: procedure salvarObservacao (upsert observações manuais por mês/ano)
- [x] Backend: procedure getObservacao (carregar observações + análise de um mês)
- [x] Backend: procedure gerarAnaliseIA (gerar análise automática com base nos dados financeiros + observações manuais)
- [x] Frontend: seção Observações Mensais no Painel Financeiro com abas por mês
- [x] Frontend: editor de texto editável para observações manuais (com formatação básica)
- [x] Frontend: bloco de análise gerada pela IA com botão "Gerar/Atualizar Análise"
- [x] Frontend: considerar contextos como reposição de estoque, pagamentos em duplicidade, impostos, fretes CIF
- [x] Backend: na análise IA, contrastar custos fixos previstos (aba Custos Fixos) vs reais lançados no mês
- [x] Backend: destacar gastos com transportadoras na análise mensal
- [x] Frontend: exibir comparação visual custos fixos previstos vs reais
- [x] Backend/Frontend: célula de custo de embalagem (matérias-primas de embalagem) mês a mês

## Divergência Clientes Novos: Marketing vs Performance Comercial (03/06/2026)

- [x] Investigar: como o Marketing calcula "Clientes Novos" (11) vs Performance Comercial (22)
- [x] Investigar: como o Marketing calcula "Fat. Clientes Novos" (R$ 31k) vs Performance (R$ 61.405)
- [x] Corrigir: Marketing deve usar exatamente a mesma fonte de dados da Performance Comercial
- [x] Garantir: CAC, ROI e demais métricas de Marketing usem os dados corretos
- [x] Criar skill: documentar causa raiz e regras para evitar divergência entre módulos

## Custos da Não-Qualidade (CNQ) — Nova Camada de Classificação (03/06/2026)

### Backend / Schema
- [x] Schema: adicionar campo `tipo_registro` (enum: 'retrabalho' | 'cnq') na tabela `retrabalhos`
- [x] Schema: adicionar campo `tipo_registro` na tabela `error_library` para separar categorias CNQ
- [x] Migration SQL: ALTER TABLE com default 'retrabalho' para preservar dados existentes
- [x] Router: filtros por tipo_registro em todas as queries de listagem/KPIs/gráficos

### Frontend — Biblioteca de Retrabalhos e CNQ
- [x] Renomear "Biblioteca de Erros" para "Biblioteca de Retrabalhos e CNQ" (sidebar + título)
- [x] Adicionar filtro/toggle para exibir categorias de Retrabalho, CNQ ou Ambos
- [x] Permitir cadastrar novas categorias com tipo CNQ (ex: Erro de Frete, Erro de Digitação)

### Frontend — Inserção Rápida
- [x] Adicionar campo de seleção "Tipo" (Retrabalho / CNQ) na linha de inserção rápida
- [x] Manter fluxo existente intacto — campo adicional, não substitui nenhum

### Frontend — Painel CNQ (Dashboard específico)
- [x] Criar aba/painel "CNQ" no Dashboard principal (ao lado do painel de Retrabalhos)
- [x] KPIs: total CNQ, custo total CNQ, custo médio CNQ, % evitável
- [x] Gráficos: CNQ por categoria, por responsável, evolução mensal
- [x] Filtros de período consistentes com o painel de Retrabalhos

### Frontend — Indicador Mestre (Impacto Total)
- [x] Card no topo do Dashboard: "Impacto Total da Não-Qualidade = Retrabalhos + CNQ"
- [x] Exibir breakdown: X retrabalhos (R$ Y) + Z CNQ (R$ W) = Total (R$ Y+W)

### Painel Comparativo entre Meses
- [x] Criar componente de comparação mensal no Dashboard (gráfico barras empilhadas + linha total)
- [x] Mostrar evolução: mês anterior vs mês atual para Retrabalhos, CNQ e Total
- [x] Indicadores de tendência via tooltip com total por mês

## Ajustes CNQ — Nomenclaturas e Sub-abas (03/06/2026)

- [x] Renomear Dashboard: "Painel de Retrabalhos e Custos da Não-Qualidade (CNQ)"
- [x] Renomear Inserção Rápida: "Inserção de Retrabalhos e CNQ"
- [x] Garantir célula de classificação (Retrabalho/CNQ) visível na tabela de inserção rápida
- [x] Reincidências: criar sub-abas (Retrabalhos / CNQ) com filtro por tipoRegistro
- [x] Relatório: criar abas (Retrabalho / CNQ / Ambos) com filtro por tipoRegistro


## Lançamento em Lote de Retrabalhos Combinados

- [x] Backend: criar procedure `createBatchRetrabalhos` para lançar múltiplos retrabalhos de uma vez
- [x] Backend: procedure deve aceitar array de `{ errorLibraryId, custo, horas, responsavel, tipoRegistro }`
- [x] Backend: cada retrabalho do lote deve ser lançado com os mesmos dados (OS, data, setor, etc.)
- [x] Frontend: criar componente `MultipleRetrabalhosSelector` com checkbox para selecionar da biblioteca
- [x] Frontend: modal deve mostrar custo total, horas totais e preview dos retrabalhos selecionados
- [x] Frontend: integrar modal no formulário de Novo Retrabalho (botão "Adicionar Múltiplos")
- [x] Frontend: integrar modal na Inserção Rápida (permitir selecionar vários erros por linha)
- [x] Frontend: após lançamento em lote, mostrar confirmação com lista dos retrabalhos criados
- [x] Testes: vitest para procedure de lançamento em lote

## Bug: Setores Hardcoded em Inserção Rápida (Jun/2026)
- [x] Refatorar Inseri## Bug: CNQ exige OS Retrabal--snip--
- [x] Refatorar InserirRapido.tsx para carregar setores dinamicamente da error_library
- [x] Refatorar RetrabalhForm.tsx para carregar setores dinamicamente
- [x] Verificar BibliotecaErros.tsx e Pops.tsx (usam ALL_CATEGORIES para categorias customizadas)
- [x] Testar que novo setor "FINANCEIRO" aparece em todos os dropdowns (✓ Confirmado!)
- [x] Remover validação obrigatória de OS Retrabalhada e OS Original para tipo CNQ
- [x] Permitir inserção de CNQ sem vincular a uma ordem de serviço
- [x] Testar inserção de CNQ sem preenchimento de OS (✓ Confirmado!)


## Bug: CNQ exige OS Retrabalhada (Jun/2026)
- [x] Tornar osRetrabalhada e osOriginal opcionais no schema do banco de dados
- [x] Atualizar validação em InserirRapido.tsx para permitir CNQs sem OS
- [x] Atualizar função saveAll para filtrar CNQs sem OS corretamente
- [x] Testar inserção de CNQ sem OS (✓ Confirmado!)

## Melhorias Dashboard — Separação de CNQ e Retrabalhos (Jun/2026)
- [x] Adicionar KPI card: "TOTAL DE CNQ" separado de "TOTAL DE RETRABALHOS"
- [x] Atualizar labels dos cards de hoje/ontem: "RETRABALHOS E CNQ DE HOJE/ONTEM"
- [x] Filtrar dados por tipoRegistro para contar CNQs e Retrabalhos separadamente


## Integração de Dados Financeiros — Painel Financeiro (Jun/2026)
- [x] Extrair dados do Excel (Fechamento-2026.05.xlsx): Receitas, Despesas, DRE, Fluxo de Caixa
- [x] Criar tabela financeira_mensal no banco de dados (mês, receita_bruta, despesas, lucro_bruto, etc)
- [x] Implementar interface de visualização no Dashboard (cards com KPIs financeiros)
- [x] Criar formulário de atualização de dados financeiros mensais
- [x] Integrar PainelFinanceiro à página Financeiro.tsx como nova aba "Dados Mensais"
- [x] Testar integração e validar dados


## Módulo de Desenho de Cargos e Funções (Jun/2026)
- [x] Usar tabela existente cargosFuncoes (em vez de criar novas)
- [x] Integrar cargo "Auxiliar de Embalagem e Expedição" na página CargoseFuncoes.tsx existente
- [x] Adicionar campos imagemDivulgacaoUrl e imagemDivulgacaoKey ao schema
- [x] Exibir imagem de divulgação nos cards de cargo
- [x] Implementar upload de imagem na edição de cargos com componente ImageUploadField
- [x] Testar integração e validar dados


## Imagens de Divulgação de Vagas (Jun/2026)
- [x] Adicionar campo de imagem de divulgação (JPEG/PNG) em cada cargo
- [x] Permitir download da imagem de divulgação para compartilhar em redes sociais
- [x] Importar vaga SDR com arte de divulgação fornecida
- [x] Importar vaga Empacotador/Embalador com arte de divulgação fornecida
- [x] Testar download e visualização das imagens nos cards


## Micropágina de Vagas com Roteiro e Análise de IA (Jun/2026)
- [x] Adicionar campos roteiroEntrevista e promptAnaliseIA ao schema
- [x] Criar seções de roteiro e prompt na página de visualização
- [x] Adicionar botão "Roteiro" nos cards de cargo
- [x] Importar roteiro para vaga de SDR (3 etapas: triagem, entrevista, avaliação)
- [x] Importar roteiro para vaga de Embalador
- [ ] Implementar upload de currículos e análise com IA (próxima fase)


## Upload de Currículos e Análise com IA (Jun/2026)
- [x] Adicionar campos de análise de currículos ao schema (tabela analise_curriculos)
- [x] Criar interface de upload de currículos na micropágina de vaga
- [x] Implementar análise com IA usando prompt específico por vaga
- [x] Exibir resultado da análise com candidatos aprovados/reprovados
- [x] Integrar prompts para Embalador e SDR
- [ ] Testar funcionalidade completa


## PCP - Programa de Controle de Produção (Jun/2026)
- [x] Schema: tabelas feriados, motivos_atraso, producao_ordens, producao_setores, producao_alertas, producao_historico_alteracoes
- [x] Backend: pcp-helpers.ts com integração MubiSys, cálculo de dias úteis, identificação de setores
- [x] Backend: routers/pcp.ts com procedures tRPC (criarOrdemPorOS, listar, getById, listarMotivos, verificarAtrasos)
- [x] Frontend: pages/PCP.tsx com página principal, timeline visual, dialog para criar ordens
- [x] Frontend: Rota /pcp adicionada em App.tsx
- [x] Frontend: Upload de imagem corrigido em ImageUploadField.tsx usando tRPC
- [ ] Frontend: Modal de detalhes e atualização de status de setores
- [ ] Frontend: Relatório de atrasos com filtros
- [ ] Backend: Webhook/Polling para monitorar novas OS no MubiSys
- [ ] Testes completos da funcionalidade
