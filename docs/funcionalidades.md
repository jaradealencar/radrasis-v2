# Radrasys — Levantamento de Funcionalidades

Mapa completo das funcionalidades da aplicação, levantado a partir das rotas
(`client/src/App.tsx`), do menu (`client/src/components/DashboardLayout.tsx`),
dos routers tRPC (`server/routers.ts` + `server/routers/*.ts`) e do schema
(`drizzle/schema.ts`).

> Sistema interno de gestão da Radra — cobre Retrabalhos/Qualidade, Operações,
> Financeiro, Comercial/CRM e Logística/Empacotamento.

---

## Sumário

1. [Plataforma e infraestrutura](#1-plataforma-e-infraestrutura)
2. [Autenticação, permissões e auditoria](#2-autenticação-permissões-e-auditoria)
3. [Retrabalhos e CNQ](#3-retrabalhos-e-cnq)
4. [Qualidade](#4-qualidade)
5. [Operações](#5-operações)
6. [Produção](#6-produção)
7. [Financeiro](#7-financeiro)
8. [Comercial e CRM](#8-comercial-e-crm)
9. [Logística](#9-logística)
10. [Empacotamento](#10-empacotamento)
11. [Administração](#11-administração)
12. [Funcionalidades de IA (LLM)](#12-funcionalidades-de-ia-llm)
13. [Integrações externas](#13-integrações-externas)
14. [Recursos transversais de UI](#14-recursos-transversais-de-ui)

---

## 1. Plataforma e infraestrutura

| Item | Implementação |
|---|---|
| Frontend | React 19 + Vite 7 + Tailwind 4, SPA servida pelo próprio Express |
| Roteamento | `wouter` (client-side) |
| Backend | Express 4 + tRPC 11 (`superjson` como transformer) |
| Banco | PostgreSQL (Neon) via Drizzle ORM (`pg` / `node-postgres`) |
| Migrations | `drizzle-kit generate` + `migrate` (`yarn db:push`) — nunca SQL direto |
| Auth | Better Auth local-only (e-mail+senha, hash bcrypt) |
| LLM | OpenAI (`server/_core/llm.ts`) |
| Storage de arquivos | UploadThing + S3 (`@aws-sdk/client-s3`) |
| UI kit | shadcn/ui sobre Radix, ícones Lucide, gráficos Recharts |
| Editor rich text | TipTap (`RichTextEditor.tsx`) |
| Exportações | `xlsx` (Excel), `jspdf` + `jspdf-autotable` (PDF), `html2canvas` |
| Parsing de documentos | `pdf-parse` (PDF), `mammoth` (DOCX) |
| Testes | Vitest (`server/__tests__`, testes de render em logística) |

---

## 2. Autenticação, permissões e auditoria

**Rotas:** `/login`, `/403`, `/admin/usuarios`, `/auditoria`

- **Login local** (`LocalLogin.tsx`) — e-mail **ou** nome de usuário, via plugin
  `username` do Better Auth. Usuários sem e-mail real (ex.: `producao`,
  `empacotamento`) recebem e-mail sintético interno (`<slug>@local.internal`)
  e logam pelo slug do nome.
- **Modo bootstrap** — se não existe nenhum usuário no banco, qualquer um pode
  criar o primeiro.
- **8 roles de negócio**: `master`, `admin`, `gestor`, `vendas`, `logistica`,
  `producao`, `financeiro`, `empacotamento`.
- **Permissão por página** — tabela `role_permissions`, consumida por
  `permissions.myPermissions` e pelo hook `useAuth`. Gate de rota:
  `ProtectedRoute` (`pageKey`); o menu lateral esconde itens sem acesso.
  Sem sessão, o sistema fica aberto (`canAccess === true`) — comportamento
  deliberado.
- **CRUD de usuários** (`localUsers.*`) — criar, listar, editar, ativar/desativar
  (mapeado a partir de `banned`), redefinir senha, excluir.
- **Editor de permissões** (`permissions.getAll` / `.set`) — matriz role × página.
- **Timeout por inatividade** — `IdleTimeoutWarning.tsx`.
- **Auditoria** (`/auditoria`, `auditoria.list`) — trilha de alterações em
  retrabalhos (`auditoria_retrabalhos`).
- **Endpoint CRON** — `POST /api/scheduled/sincronizarOS` protegido por segredo
  compartilhado (header `x-cron-secret`).

---

## 3. Retrabalhos e CNQ

**Rotas:** `/`, `/retrabalhos`, `/inserir`, `/retrabalhos/novo`,
`/retrabalhos/:id/editar`, `/biblioteca`, `/reincidencia`, `/relatorio`,
`/insights`

### Painel (Dashboard)
KPIs consolidados, quebra por setor, categoria, código de erro e responsável;
evolução mensal separada para Retrabalho e CNQ; KPIs específicos de CNQ;
retrabalhos do dia; filtros dinâmicos por valores distintos.

### Gestão de retrabalhos
- CRUD completo (`retrabalhos.create/update/delete/byId/list/all`).
- **Inserção rápida** — tela otimizada para lançamento em volume, com
  criação em lote (`createBatch`) e seletor múltiplo de retrabalhos.
- **Painel CNQ** (`CnqPanel.tsx`) — registro de Custo da Não Qualidade
  integrado ao mesmo fluxo.

### Biblioteca de Erros e CNQ
Catálogo de erros padronizados com código, correção sugerida, imagens
(upload/remoção) e busca por código (`errorLibrary.byCode`). Badge visual de
código de erro (`ErrorCodeBadge.tsx`).

### Reincidência
Detecção e listagem de erros reincidentes; cruzamento com planos de ação
existentes (`planosAcao.reincidenciasComPlano`).

### Relatório
Relatório consolidado de retrabalhos e CNQ com filtros e exportação.

### Insights IA
Geração de análise textual sobre os dados de retrabalho (`insights.generate`).

---

## 4. Qualidade

**Rotas:** `/qualidade/planos-acao`, `/qualidade/desempenho`,
`/qualidade/acoes-corretivas`, `/qualidade/alertas`

- **Ações corretivas** (`acoesCorretivas.*`) — vinculadas ao retrabalho de
  origem, com estatísticas.
- **Planos de ação** com metodologia estruturada:
  - **Ishikawa** — cadastro de causas por espinha (`ishikawa_causas`).
  - **5W2H** — plano de ações detalhado (`acoes_5w2h`).
  - Geração de ações por IA (`planosAcao.gerarAcoesIA`).
  - Exportação de dados (`exportData`).
- **Metas de retrabalho** (`metasRetrabalho.*`) — meta vigente, histórico e
  comparativo realizado × meta.
- **Desempenho por colaborador** — ranking, evolução e comparativo
  (`desempenhoColaborador.*`), além do lançamento mensal
  (`desempenhoColabMensal.*`).
- **Alertas do sistema** (`alertas.*`) — geração automática
  (`verificarAlertas`), contador de não lidos, marcar lido / todos lidos,
  arquivar.

---

## 5. Operações

**Rotas:** `/operacoes/performance`, `/operacoes/metas`, `/conhecimento`,
`/biblioteca-arquivos`, `/sugestoes-conhecimento`, `/fornecedores`, `/rotinas`,
`/regulamentos`, `/pops`, `/pops-relatorio`, `/cargos-funcoes`,
`/operacoes/custo-solda`, `/operacoes/custo-led`

### Visão de Performance
Página com múltiplas abas: **Dashboard**, **Faturamento & Prazo**,
**Pontuação Final**, **Evolução Mensal**, **Análise de Solda**,
**ABC de Produtos**, **ABC de Clientes**, **Comparação** e **Histórico**.
Backend: `performance.*` (lançamento mensal por mês/ano) e `performanceAbc.*`
(curva ABC, tags de cliente, evolução de produtos, produtos direto do ERP,
com cache em `abc_cache`).

### Metas Operacionais
`metasOperacionais.*` e `metaProdutos.*` — metas gerais e por produto.

### Base de Conhecimento
Artigos com editor rich text, comentários (`knowledgeComments.*`) e
**pergunta-e-resposta por IA sobre a base** (`knowledge.askAI`).

### Sugestões de Conhecimento
Fluxo de contribuição: qualquer usuário sugere, gestor **aprova/rejeita**
(`knowledgeSuggestions.*`), aprovação promove a artigo.

### Biblioteca de Arquivos
Upload de arquivos com categorias, **extração automática de texto**
(PDF/DOCX) para busca, re-extração sob demanda, contador de visualizações e
estatísticas de uso.

### Fornecedores
CRUD de cadastro de fornecedores.

### Rotinas
Rotinas periódicas com lista de pendentes e marcação de conclusão
(`routines.markDone`).

### Políticas e Documentos / Regulamentos
CRUD de documentos normativos (`regulations.*`, tabela `regulamentos`).

### POPs (Procedimentos Operacionais Padrão)
- CRUD com conteúdo rich text e imagens.
- **Geração de POP por IA** a partir de um erro (`generateFromError`) ou de
  uma categoria (`generateFromCategory`).
- **Incorporação de erro** a um POP existente (`incorporateError`).
- **Controle de acesso/leitura**: registro de acesso por usuário
  (`registrarAcesso`), **Relatório de POPs** com quem leu o quê
  (`relatorioAcessos`, `estatisticasAcessos`).

### Cargos e Funções
Cadastro de cargos com responsabilidades e KPIs (`cargos`,
`responsabilidades_cargo`, `kpis_cargo`), imagem do cargo, e
**análise de currículos por IA** contra o cargo (`curriculos.uploadAndAnalyze`,
`CurriculumUploadSection.tsx`).

### Custo de Solda
Análise de custo do processo de solda dentro da Performance.

### Custos de LED
Cadastro de tipos de LED, lançamentos e resumo mensal (`custoLed.*`).

---

## 6. Produção

**Rotas:** `/gestao-atrasos`, `/analise-atrasos`

- **Gestão de Atrasos** — tratativa operacional de OS atrasadas.
- **Análise de Atrasos** — visão analítica/estatística dos atrasos.

> O módulo PCP (Programa de Controle de Produção) foi removido do sistema
> (ver `docs/sprints/complete/remocao-pcp.md`). Estas duas páginas não
> dependiam dele — não chamam `trpc.pcp` nem tabela nenhuma do PCP — e
> continuam no ar sob o grupo de menu "Produção".

---

## 7. Financeiro

**Rota:** `/financeiro` (página única com sub-painéis) + `/cargos`

- **Painel Financeiro** (`PainelFinanceiro.tsx`) — indicadores consolidados
  mensais (`financeiro_mensal`, `financeiros_mensais`).
- **Painel DRE** (`PainelDRE.tsx`, `financeiro.getDreMensal`) — demonstrativo
  de resultado mensal (`dre_mensal`).
- **Custos Fixos** — CRUD de custos fixos (`getCustosFixos`, `upsertCustoFixo`,
  `deleteCustoFixo`).
- **Marketing** — custo de marketing por mês e visão anual
  (`custo_marketing`).
- **Dívidas e parcelamentos** (`financeiro.getDividas`,
  `dividas_parcelamentos`).
- **Observações mensais** (`observacoesFinanceiras.*`) — comentário do gestor
  por mês, com dados complementares e **análise gerada por IA**
  (`gerarAnalise`).
- **Faturamento** (`faturamento.list/upsert`) — base usada pela Performance.
- **Cargos (financeiro)** — visão de custo por cargo.

---

## 8. Comercial e CRM

**Rotas:** `/tabela-precos`, `/comercial/performance`, `/comercial/metas`,
`/comercial/crm`, `/comercial/planos-acao`, `/comercial/diagnostico-api`,
`/comercial/crm-auditoria`

### Tabela de Preços
Seções configuráveis, edição de itens, metadados e **histórico de alterações**
(`price.getHistory`, `price_table_history`).

### Performance Comercial
- Visão mensal, multi-mês e anual (`getMes`, `getMultiMes`, `getAno`).
- **Evolução diária** do mês por vendedor (`getEvolucaoDiariaMes`,
  `EvolucaoDiariaVendedor.tsx`, `EvolucaoVendedor.tsx`).
- **Clientes novos** por mês/ano, com marcação de contato
  (`cliente_novos_contato`, `getContatados` / `setContatado`).
- **Overrides de cliente** — correção manual de atribuição/classificação
  (`cliente_overrides`).
- **Inteligência de Clientes** (`getInteligenteClientes`,
  `InteligenteClientes.tsx`) com cache (`inteligencia_clientes_cache`) e
  congelar/descongelar.
- **Auditoria de performance** (`getAuditoria`, `salvarAuditoria`,
  `congelarAuditoria`/`descongelar`, `auditarMeses`) — fecha o número do mês
  contra o ERP.
- **Diagnóstico de Dados** (`diagnosticoApi`, `/comercial/diagnostico-api`) —
  tela de troubleshooting da integração com o ERP.

### Metas Comerciais
Metas por vendedor/mês (`metas_comerciais`, `crm_metas`), vinculação de
usuário à meta, exclusão de vendedor da meta.

### CRM de Propostas
- **Pipeline de propostas** (`crm_propostas`, `getPropostas`) com
  marcar **ganha** / **perdida** e desfazer contato.
- **Registro de contato** por proposta (`crm_contatos`, `registrarContato`).
- **Scripts de abordagem** (`crm_scripts`) — CRUD, reordenação, contador de
  cópias e popover por faixa (`ScriptsFaixaPopover.tsx`).
- **Faixas e etiquetas** (`crm_faixa_etiquetas`) configuráveis.
- **Mensagem motivacional** gerada por IA (`getMensagemMotivacional`).
- **Auditoria do CRM** (`/comercial/crm-auditoria`) — log de atividade diário
  por vendedor (`crm_atividade_log`, `getAuditoria`, `getLogDia`).
- **Alertas para vendedor** — hook `useVendedorAlertas` ativo globalmente.

### Planos de Ação Comercial
`planos_acao_comercial` — planos derivados dos indicadores comerciais.

---

## 9. Logística

**Rotas:** `/logistica`, `/logistica/solicitacoes`, `/logistica/transportadoras`,
`/logistica/consulta`, `/logistica/minhas-cotacoes`, `/logistica/importar-cte`,
`/logistica/assertividade`, `/logistica/insights-ia`

### Dashboard de Logística
Indicadores consolidados de cotações e fretes (`cotacoesFrete.dashboard`).

### Transportadoras
- CRUD completo com **filiais** e **cidades atendidas**
  (busca de municípios integrada).
- **Avaliações** de transportadora (`transportadora_avaliacoes`).
- **Completude de cadastro** — panorama, resumo, pendentes por campo,
  atualização campo a campo e **em lote**, definição de status
  (`CompletudeTransportadoras.tsx`).

### Consulta de Cobertura
Consulta de quais transportadoras atendem uma cidade/região
(`consultarCobertura`).

### Solicitações de Frete / Cotações
- Abertura de cotação (`NovaCotacaoDialog.tsx`), edição, exclusão.
- **Opções de frete** por cotação (adicionar/editar/remover/selecionar).
- **Comentários** na cotação.
- **Upload de fotos** da carga e remoção.
- **Status workflow** (`updateStatus`) e visão **Minhas Cotações** por usuário.
- **Romaneio em PDF** (`romaneioPdf`, `romaneio.ts` + testes).
- Cotação integrada ao pedido de empacotamento
  (`deleteByEmpacotamentoPedidoId`).
- Busca de dados da OS no ERP para pré-preencher a cotação (`buscarDadosOs`).

### CT-e
Importação de CT-e (`cte.importar`, `cte_importacoes`) com estatísticas.

### Assertividade IA
Comparação entre frete cotado e frete realizado (`assertividade`), marcação de
retrabalho logístico e métricas de retrabalho
(`marcarRetrabalho`, `metricasRetrabalho`), com **análise por IA**
(`logistica.analisarAssertividade`).

### Insights de IA (Logística)
Página dedicada a análises geradas por LLM sobre os dados logísticos.

---

## 10. Empacotamento

**Rota:** `/logistica/empacotamento` — é o módulo mais extenso do sistema
(~2.700 linhas de router, ~20 tabelas).

### Cadastros
- **Modelos** de letreiro e **modelos de caixa** (com produtividade global).
- **Tabela de preços** por modelo.
- **Insumos** gerais, **insumos por caixa** e **insumos por letreiro**.
- **Consumo de caixa** por modelo.
- **Custo por funcionário**.
- **Checklists** configuráveis — por caixa e por letreiro.
- **Configuração de produtividade** e **tempo estimado** calculado.

### Pedidos (Kanban)
- Criação a partir de OS do ERP (`buscarOs`), edição, dimensões,
  **movimentação em Kanban** (`moverKanban`, drag-and-drop via `@dnd-kit`).
- **Upload de arquivos e fotos**, com **anotação sobre a imagem/arquivo**
  (`atualizarFotoAnotada`, `atualizarArquivoPedidoAnotado`).
- **Checklist do pedido** — marcação item a item (caixa e letreiro).
- **Verificação de pendências** antes de expedir (`checkPendencias`).
- Listagem por vendedor.

### Apontamento de tempo
- **Entrada/saída de operadores no pedido** (`pedidoUsuarios.entrar/sair`),
  pedido ativo do operador.
- **Cronômetro com pausas** (`cronometroPausas`) — pausar, retomar,
  pausar todos os ativos, total pausado.
- **Sessões de trabalho** (`sessoes.*`) — iniciar, pausar, retomar, registrar,
  limpar sessões zeradas.
- **Registros de tempo** consolidados.

### Precificação
`precificacao.calcular` — custo/preço do pedido a partir de insumos, caixa,
mão de obra e tabela de preços.

### Relatórios
- **Fechamento** e **resumo do dia**.
- **Produtividade por usuário** e **por colaborador**.
- **Relatório detalhado por período** e **evolução diária**.
- **Ranking de produtividade** semanal e mensal.
- **Previsto × Realizado**.
- **Expedidos completo**.

---

## 11. Administração

**Rotas:** `/admin`, `/admin/usuarios`, `/admin/sincronizacao-cache`

- **Usuários** — CRUD + roles (ver §2).
- **Permissões** — matriz role × página.
- **Sincronização de Cache** (`admin.*`):
  - status da sincronização com o ERP;
  - **forçar sincronização manual**;
  - histórico de execuções (`sync_logs`);
  - **limpeza de cache antigo** (`erp_os_cache`, `mubisys_api_cache`).
- **Sincronização agendada** — `scheduled-sync-os.ts` importa as OS dos
  últimos 30 dias do MubiSys para `erp_os_cache`, disparada por CRON via
  `POST /api/scheduled/sincronizarOS`.

---

## 12. Funcionalidades de IA (LLM)

Todas via OpenAI (`server/_core/llm.ts`).

| Funcionalidade | Onde |
|---|---|
| Insights sobre retrabalhos | `insights.generate` — `/insights` |
| Pergunta e resposta sobre a Base de Conhecimento | `knowledge.askAI` — `/conhecimento` |
| Geração de POP a partir de erro ou categoria | `pops.generateFromError` / `generateFromCategory` |
| Incorporação de erro em POP existente | `pops.incorporateError` |
| Geração de ações de plano de ação (5W2H) | `planosAcao.gerarAcoesIA` |
| Análise financeira mensal em texto | `observacoesFinanceiras.gerarAnalise` |
| Análise de currículo contra cargo/KPIs | `curriculos.uploadAndAnalyze` |
| Extração de texto de PDF/DOCX para busca | `bibliotecaArquivos.upload` / `reextrairTexto` |
| Mensagem motivacional para vendedor | `crm.getMensagemMotivacional` |
| Análise de assertividade de frete | `logistica.analisarAssertividade` |
| Insights de logística | `/logistica/insights-ia` |
| Chat de IA embutido na UI | `AIChatBox.tsx` |

---

## 13. Integrações externas

- **MubiSys (ERP)** — cliente único em `server/integrations/mubisys-client.ts`
  (`mubisys-frete.ts` consome esse cliente para o fluxo de frete). API Open
  v1.0.0, autenticada por header `Access-Token`. Fornece OS, clientes, itens,
  valores, vendedor, prazos e dados de frete. Resultados cacheados em
  `erp_os_cache` e `mubisys_api_cache`. Levantamento completo do contrato da
  API, achados e histórico da consolidação em
  [`docs/integracao-mubisys.md`](integracao-mubisys.md).
- **OpenAI** — chat completions + upload de arquivos.
- **UploadThing / S3** — storage de imagens, fotos e documentos.
- **CRON externo** — dispara a sincronização diária de OS.

---

## 14. Recursos transversais de UI

- **Layout com sidebar por área**, filtrada por permissão do usuário.
- **Tema claro/escuro** (`ThemeContext`, `next-themes`).
- **Error boundary** global e página 404 / 403 dedicadas.
- **Toasts** (`sonner`) e tooltips globais.
- **Barra de filtros reutilizável** (`FilterBar.tsx`).
- **Seletor de usuário** (`UserSelect.tsx`) e upload de imagem
  (`ImageUploadField.tsx`).
- **Editor rich text** TipTap com formatação, listas e fontes.
- **Aviso de sessão inativa** com contagem regressiva.
- **Exportação** para Excel e PDF em vários relatórios.
- **Showcase de componentes** (`ComponentShowcase.tsx`, sem rota registrada).

---

## Observações sobre o estado do código

- Migração MySQL → PostgreSQL + Better Auth: fases 1–3 concluídas; resta a
  fase 5 (remover `mysql2` do `package.json`). Ver
  `docs/migracao-postgres-better-auth.md`.
- Páginas legadas ainda roteadas: `/home` (`Home.tsx`).
- Algumas páginas existem no diretório mas não têm rota própria — são
  sub-componentes (ex.: `CRMConfig.tsx`, `PainelDRE.tsx`, `CustosFixos.tsx`,
  `MarketingFinanceiro.tsx`, `ObservacoesMensais.tsx`, `Metas.tsx` em
  qualidade, `CompletudeTransportadoras.tsx`).
