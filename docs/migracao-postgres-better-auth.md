# Migração: MySQL → PostgreSQL + Auth própria (Better Auth)

Plano de trabalho dividido em tarefas independentes. Cada seção abaixo foi
escrita pra ser colada como contexto inicial de uma conversa nova — traga o
arquivo inteiro ou só a seção da tarefa que for atacar.

Decisões já tomadas (não reabrir sem motivo forte):
- Banco final: PostgreSQL (Neon), via `pg` + Drizzle `pg-core`. `mysql2` sai
  de vez só na Fase 5, depois que nada mais depender dele.
- Auth final: Better Auth local-only. OAuth do Manus é removido por completo
  (a plataforma não é mais usada).
- Cada tarefa termina com um commit próprio (atômico, sem misturar com outra
  tarefa) antes de passar pra próxima.

---

## ✅ Concluído

- **Fase 1 — Schema Postgres**: `drizzle/schema.ts` convertido de mysql-core
  pra pg-core (104 tabelas, ~38 enums, 59 triggers de `updatedAt`).
  `drizzle.config.ts` apontando pro dialeto `postgresql`. Migrations antigas
  do MySQL arquivadas em `docs/archive/mysql-migrations/`.
- **Fase 4 (adiantada) — ETL de dados**: `scripts/migrate-mysql-to-postgres.ts`
  já rodou contra a produção real (TiDB) e migrou as ~1600 linhas pro Postgres
  novo, 1592/1592 batendo, 0 divergências. Script fica no repo como registro
  histórico — não precisa rodar de novo a menos que apareçam dados novos no
  MySQL antes do cutover final.
- **Fase 2, parte 1 — `server/db-connection.ts`**: reescrito com `pg.Pool`,
  mesma interface pública (`selectQuery`/`mutationQuery`/`executeQuery`),
  convertendo `?` → `$1,$2,...` internamente.
- **Tarefa 2.2 — `server/db.ts`**: `drizzle-orm/mysql2` → `drizzle-orm/node-postgres`
  (reaproveitando o `pg.Pool` de `db-connection.ts` via `drizzle(getPool())`).
  `.onDuplicateKeyUpdate()` → `.onConflictDoUpdate({ target, set })`.
  `FIELD(...)` (ordenação de meses) → `CASE ... END`; `GROUP_CONCAT(... SEPARATOR)`
  → `STRING_AGG(...)`. Leituras de `.insertId` (mysql2) trocadas por `.returning()`
  (node-postgres não tem `insertId` nativo). **`local_users` resolvido nesta
  tarefa** (ver achado corrigido abaixo) — as 7 funções (`listLocalUsers` etc.)
  agora usam `db.select()/insert()/update()/delete()` normais sobre
  `drizzle/schema.ts`, sem SQL cru.
- **Gap encontrado e corrigido fora do escopo original da 2.2**: três arquivos
  vivos (importados por `server/routers.ts`) ainda instanciavam seu próprio
  `drizzle(process.env.DATABASE_URL!)` com `drizzle-orm/mysql2` — quebrado em
  runtime contra a connection string do Postgres. Corrigidos com o mesmo
  padrão mecânico da 2.2 (trocar driver, reusar `getPool()`):
  - `server/pcp-helpers.ts` — trocado; também tinha `resultado[0].insertId`
    (2 call sites) → `.returning()`.
  - `server/routers/performance.ts` — trocado; `MONTH()/YEAR()` (MySQL) →
    `EXTRACT(MONTH FROM ...)/EXTRACT(YEAR FROM ...)`; `insertId` → `.returning()`.
  - Corrigir esses dois arquivos expôs um problema latente em `drizzle/schema.ts`:
    colunas `date(...)` (`feriados.data`, `producaoOrdens.dataEntrada/dataPrazo`,
    `producaoSetores.dataInicio/dataFim/dataFimPrevista`) usavam o modo padrão
    (`string`) do pg-core, mas o código sempre tratou esses campos como `Date`
    (`.getTime()`, `.toISOString()` etc. — comportamento herdado do mysql2, que
    retorna `Date` para colunas `DATE`). Ajustado pra `date(..., { mode: "date" })`
    nessas 6 colunas. Isso também destravou ~2100 erros de tipo em cascata que
    o `pcp-helpers.ts` quebrado estava propagando pra outros arquivos (69 → 24
    arquivos com erro no `yarn check` geral do repo).
  - **`server/routers/empacotamento.ts` (2725 linhas) tem o mesmo padrão
    quebrado e ainda não foi corrigido** — é grande demais pra essa tarefa,
    ver Tarefa 2.4b abaixo.

### Achado importante (corrigido na Tarefa 2.2): `local_users` batia com o schema legado do MySQL, não com o Postgres

**Estado antigo (só valia pro MySQL/produção antiga):** a tabela real tinha
colunas `nome, email, setor, cargo, ativo` — diferente de
`name, email, passwordHash, role, active` do `schema.ts`.

**Estado atual (Postgres, pós-ETL):** o ETL (`scripts/migrate-mysql-to-postgres.ts`,
`transformLocalUsersRow`) já fez esse remapeamento na carga — a tabela
`local_users` no Postgres foi criada a partir do `schema.ts`
(`drizzle/0000_abnormal_morlocks.sql`) e **tem exatamente as colunas do
schema**. Ou seja, o schema declarado bate com a tabela real agora; o SQL cru
que existia em `server/db.ts` pra contornar essa divergência não é mais
necessário e foi removido na Tarefa 2.2.

O login por bcrypt continua não funcionando pra a 1 linha real migrada — ela
tem uma senha placeholder inutilizável (ver comentário em
`scripts/migrate-mysql-to-postgres.ts`). Quem pegar a Fase 3 ainda precisa
decidir se recria essa conta do zero via Better Auth ou implementa um fluxo
de reset.

- **Tarefa 2.3 — `server/db-helpers.ts` e `server/db-helpers-select.ts`**:
  reescritos pra Drizzle query builder sobre `cotacoesFrete`/`cotacaoOpcoes`.
  Achado maior que o previsto originalmente nesta tarefa (a nota abaixo sobre
  vocabulário de status estava subestimada) — dois gaps schema-vs-realidade
  foram descobertos comparando a tabela real do Postgres (Neon) contra a
  tabela real do MySQL/TiDB de produção (via credencial fornecida pelo
  usuário na hora, só pra investigação):
  1. **`cotacoes_frete` tinha 9 colunas usadas de verdade pelo front (Kanban,
     `NovaCotacaoDialog`, romaneio) que nunca existiram em `schema.ts`** —
     nem antes da Fase 1 (mesmo padrão do `local_users` pré-2.2, só que não
     detectado até agora): `osNumero`, `modalidadeFrete`, `quantidadeVolumes`,
     `volumesJson`, `fotosJson`, `empacotadores`, `osAprovacao`, `osEntrega`,
     `osVendedor`. Resolvido **estendendo o schema** (não simplificando o
     front): colunas adicionadas em `drizzle/schema.ts`, migration
     `drizzle/0003_far_dorian_gray.sql` aplicada em produção (Neon), e as 2
     linhas reais que tinham esses dados no MySQL foram copiadas via script
     one-off (não é o ETL de `scripts/migrate-mysql-to-postgres.ts` — essas
     tabelas não passaram por ele). `empacotamentoId` (MySQL) **não** foi
     restaurado — já está superado por `empacotamentoPedidoId` +
     `empacotamentoPedidoNumero`, que já existiam no schema e já são usados
     por `create`/`empacotamento.ts`.
  2. **Vocabulário do enum `cotacao_status` divergia do front inteiro.** A
     Fase 1 criou `cotacao_status` como `fila/em_cotacao/pronto/concluido/
     cancelado` — um vocabulário que nunca existiu no MySQL nem no client
     (`Solicitacoes.tsx`, que já está em produção com colunas de Kanban,
     drag-and-drop etc. usando `aberta/cotando/selecao/cotada/enviada/
     cancelada`, idêntico ao enum real do MySQL). Resolvido trocando o pgEnum
     pro vocabulário do MySQL/front (mesma migration `0003`, com `USING CASE`
     pra remapear os 2 valores já gravados em produção: `fila→aberta`,
     `em_cotacao→cotando`). Zero mudança no client. Consumidores que ainda
     usavam o vocabulário velho do pgEnum foram corrigidos: `logistica.ts`
     (`dashboard`, `assertividade`, `metricasRetrabalho`),
     `performanceAbc.ts`, `MinhasCotacoes.tsx`, `Assertividade.tsx` (esta
     também tinha um bug pré-existente não relacionado: lia
     `cotacoesFrete.list.useQuery({})` como se devolvesse um array, mas o
     procedure devolve `{data, pagination}`).
  3. `cotacao_opcoes` **não precisou de mudança de schema** — as colunas
     estruturadas (`prazoDias`/`modal`/`tipoPrazo`/`selecionada` enum
     `sim`/`nao`) já batiam com o design que o resto do código (client
     `romaneio.ts`, `logistica.ts:addOpcao/updateOpcao`) já esperava; só o
     código legado em `db-helpers-select.ts` (e o `romaneioPdf` de
     `logistica.ts`) ainda usava o campo de texto livre `prazoEntrega` (que
     nunca existiu no schema Postgres) e `selecionada` como tinyint 0/1 —
     portado pra usar as colunas estruturadas diretamente.
  - Como consequência direta (arquivo/tabela idênticos), a Tarefa 2.4 abaixo
    já saiu parcialmente resolvida: `server/routers/logistica.ts` também
    tinha `drizzle(process.env.DATABASE_URL!)` com `drizzle-orm/mysql2`
    quebrado (mesmo padrão da 2.2) — corrigido pro pool compartilhado via
    `getPool()`. Todas as procedures de `cotacoesFrete`/`cotacaoOpcoes`
    (`list`, `get`, `getDetalhes`, `create`, `update`, `updateStatus`,
    `listMinhas`, `uploadFotos`, `removerFoto`, `romaneioPdf`, `addOpcao`,
    `listOpcoes`, `updateOpcao`, `removeOpcao`, `selecionarOpcao`,
    `deleteByEmpacotamentoPedidoId`, `dashboard`, `assertividade`,
    `metricasRetrabalho`) foram portadas nesta tarefa. `update` também tinha
    um bug de sintaxe MySQL (crase `` ` `` em vez de aspas duplas) que
    quebrava toda edição de cotação contra Postgres — corrigido junto.
    O resto do arquivo (CRUD de `transportadoras`, `cte_importacoes`) foi
    fechado na Tarefa 2.4 logo abaixo.
  - Testes de `cotacoes_frete`/`cotacao_opcoes` (`kanban-5-estagios.test.ts`,
    `card-kanban-completo.test.ts`, `cotacao-opcoes.test.ts`,
    `romaneio-pdf.test.ts`) tinham o próprio SQL cru de fixture quebrado
    contra Postgres (identificadores camelCase sem aspas, sem `RETURNING
    id`) — corrigidos junto, senão não dava pra validar a tarefa. Todos
    passam agora (`DATABASE_URL` precisa estar no ambiente do shell pra
    `yarn test` rodar essas suítes — `server/_core/index.ts` carrega
    `dotenv/config`, mas os testes importam os módulos direto e pulam esse
    entrypoint).
  - **Gap encontrado e não corrigido (fora do escopo desta tarefa)**: as
    mesmas duas classes de bug (identificador camelCase sem aspas em SQL cru,
    e `mysql2`/sintaxe MySQL solta) também aparecem em
    `server/transportadora-cobertura.test.ts`,
    `server/transportadoras-completude.test.ts` (`coberturaTotal`,
    `transportadoraId`) e no bloco "Cache de OS e log de sincronização" de
    `card-kanban-completo.test.ts` (`erp_os_cache`/`sync_logs`, `DESCRIBE`,
    `dataAprovacao`) — todos já cobertos pelas Tarefas 2.4/2.5 abaixo, só
    confirmando que continuam quebrados.

- **Tarefa 2.4 — `server/routers/logistica.ts` (resto do arquivo)**: acabou
  saindo praticamente de graça da 2.3. O CRUD de `transportadoras`
  (`transportadorasRouter`) e `cte_importacoes` (`cteRouter`) já estava
  todo escrito com Drizzle query builder — só rodava sobre o
  `drizzle(process.env.DATABASE_URL!)`/mysql2 quebrado que a 2.3 já trocou
  pelo `getPool()` compartilhado. Não sobrou SQL cru nenhum no arquivo
  (confirmado por grep). O que restava mesmo: duas linhas de comentário
  desatualizadas ("mysql2 direto") em código que já não fazia isso, e
  `.returning({ id })` faltando em `transportadoras.create`/`cte.create`
  (corrigidos junto na 2.3). `addCidade` tem um catch por
  `e.code === 'ER_DUP_ENTRY'` pra evitar duplicata — mas nunca existiu
  constraint UNIQUE em `transportadora_cidades`, nem no MySQL original
  (conferido em `docs/archive/mysql-migrations/`), então esse catch é código
  morto desde antes da migração — **não é** uma divergência introduzida pelo
  Postgres, por isso não foi mexido aqui (decisão de produto — criar a
  constraint agora mudaria comportamento existente).
  - **Gap encontrado, fora do escopo**: `server/transportadora-cobertura.test.ts`
    e `server/transportadoras-completude.test.ts` têm o mesmo problema de
    identificador camelCase sem aspas em SQL cru de fixture que os testes de
    `cotacoes_frete` tinham (ver Tarefa 2.3) — cobertos pela Tarefa 2.5
    abaixo (`server/transportadoras-completude.ts` já está na lista de
    arquivos dessa tarefa).

- **Tarefa 2.4b — `server/routers/empacotamento.ts` (2725 linhas)**: a doc
  original superestimou o risco aqui — a suspeita de divergência
  schema-vs-tabela-real (baseada em comentários que a doc citava em linhas
  específicas) não se confirmou; esses comentários não existem mais no
  arquivo (ou nunca existiram nessa forma). Conferido column-a-column contra
  o MySQL/TiDB real: as 18 tabelas `empacotamento_*` **de fato têm um design
  bem diferente** entre MySQL e `schema.ts` (não é só rename — algumas,
  como `empacotamento_consumo_caixa` e `empacotamento_custo_funcionario`,
  mudaram de propósito: de log por-pedido pra tabela de fórmula/cadastro de
  taxa) — mas isso não importa pra esta tarefa porque **o arquivo já estava
  100% escrito contra o schema novo**, usando Drizzle query builder em todo
  lugar. Confirmado batendo o client (`Empacotamento.tsx`, 3700+ linhas): usa
  só os nomes de campo novos (`kanbanStatus`, `numeroPedido`, `operadorNome`,
  `marcadoPor`...), zero ocorrência do vocabulário MySQL antigo. Ou seja,
  schema.ts + client + a maior parte do router já estavam alinhados; só
  faltava o mesmo problema mecânico de sempre:
  - `drizzle(process.env.DATABASE_URL!)` com `drizzle-orm/mysql2` (linha
    ~92/118) — trocado pro `getPool()` compartilhado, mesmo padrão da 2.2.
    Isso sozinho já causava um efeito cascata: **324 erros de tipo em
    `client/src/pages/logistica/Empacotamento.tsx`** desapareceram junto
    (mesmo fenômeno do `pcp-helpers.ts` na 2.2 — os tipos do tRPC propagam
    pro client, e um router quebrado gera erro em cascata em quem o
    consome). `yarn check` geral caiu de 782 pra 26 erros.
  - 6 pontos de `.insertId`/`LAST_INSERT_ID()` (padrão mysql2, não existe em
    `pg`) — trocados por `.returning({ id })`. Dois deles usavam
    `LAST_INSERT_ID()` numa segunda query separada só pra setar uma coluna
    (`precoAtualizadoEm`, `fatorM2`) na linha recém-inserida — simplificado
    incluindo o valor direto no INSERT em vez de precisar de uma segunda
    query.
  - Achado à parte, sem relação com o schema do empacotamento: 3 pontos onde
    o router grava `cotacoesFrete.status` (a integração automática que cria
    um card de frete quando um pedido de empacotamento vai pro pátio) usando
    o vocabulário velho do enum (`'fila'`, `'cancelado'`) que a Tarefa 2.3 já
    tinha substituído — corrigido pra `'aberta'`/`'cancelada'`.
  - `server/empacotamento.test.ts` tinha o mesmo `drizzle-orm/mysql2` solto —
    trocado junto. As 14 suítes de teste (modelos, checklist, preços,
    kanban, relatório) passam agora; antes nem chegavam a rodar contra
    Postgres de verdade.
  - `addCidade`/`ER_DUP_ENTRY` do achado da Tarefa 2.4 é o único código morto
    conhecido que sobrou por perto — não relacionado a este arquivo.

## Fase 2 — Camada de conexão e SQL cru (restante)

### Tarefa 2.5 — Portar mecanicamente o SQL cru restante (sintaxe MySQL → Postgres)

Arquivos: `server/transportadoras-completude.ts`, `server/scheduled-sync-os.ts`,
`server/routers/admin.ts`, `server/mubisys-frete.ts`, e os ~82 fragmentos
`sql\`...\`` espalhados em 8 routers (`crm.ts`, `performanceComercial.ts`,
`qualidade.ts`, etc. — `empacotamento.ts` saiu dessa lista, ver Tarefa 2.4b
acima: os fragmentos `sql\`...\`` lá já eram SQL padrão, sem sintaxe MySQL).

Conversões a aplicar:
- `DATE_SUB(NOW(), INTERVAL 30 DAY)` → `NOW() - INTERVAL '30 days'`
- `IFNULL` → `COALESCE`
- `GROUP_CONCAT` → `STRING_AGG`
- Identificadores camelCase em SQL cru precisam de aspas duplas no Postgres
  (`"osNumero"`, não `osNumero` — MySQL não é case-sensitive por padrão pra
  isso, Postgres dobra pra minúsculo sem aspas)
- INSERTs cru que hoje dependem de `result.insertId` (mysql2) precisam
  ganhar `RETURNING id` — `db-connection.ts` já foi ajustado pra preencher
  `insertId` a partir de `RETURNING id` quando presente, mas cada INSERT
  cru individual ainda precisa da cláusula. `grep -rn "\.insertId\|\.affectedRows" server/` lista os ~43 call sites afetados.
- `server/scheduled-sync-os.ts` já tem comentários corretos sobre as colunas
  reais de `erp_os_cache` (vendedor/dataAprovacao) — não devem precisar de
  mudança de nome de coluna, só sintaxe.
- **Verificação**: `yarn check` limpo; `yarn test` sem falhas novas.

---

## Fase 3 — Auth: consolidar em Better Auth (local only)

### Tarefa 3.1 — Instalar e configurar Better Auth

- `yarn add better-auth`, configurar com adapter Drizzle apontando pro
  schema Postgres.
- Decidir o que fazer com a tabela `local_users` (ver achado na seção
  "Concluído" acima — schema já bate com a tabela, só falta o hash de senha
  usável) — as tabelas do Better Auth (`user`, `session`, `account`,
  `verification`) substituem tanto `users` (OAuth) quanto `local_users`.
- Campo `role` do `user` usa o vocabulário de negócio já existente
  (`master, admin, gestor, vendas, logistica, producao, financeiro,
  empacotamento`), não o `"user"|"admin"` genérico do OAuth.
- Configurar verificação de senha customizada com `bcrypt.compare` pros
  hashes que já existem (nenhum local_user real tem hash válido hoje, mas o
  suporte deve existir pra quando alguém recriar contas).

### Tarefa 3.2 — Remover Manus OAuth e unificar `ctx.user`

- Remover: `server/_core/oauth.ts`, `server/_core/sdk.ts`,
  `server/_core/types/manusTypes.ts`, lógica Manus-específica em
  `server/_core/cookies.ts`.
- Reescrever `server/_core/context.ts`: um único `ctx.user` vindo da sessão
  do Better Auth, sem a síntese dupla `ctx.user`/`ctx.localUser` atual.
- Reescrever `server/_core/trpc.ts`: `publicProcedure`, `protectedProcedure`,
  e um helper `requireRole(...roles)` reusável — hoje há ~10+ checagens de
  role feitas à mão espalhadas em `routers.ts`, cada uma reimplementando
  `ctx.localUser?.role ?? ctx.user?.role`. Isso também corrige o bug do
  `"master"` morto em `routers.ts:1248` (compara contra um tipo que nunca
  pode ser `"master"`).

### Tarefa 3.3 — Unificar auth no client

- `client/src/contexts/LocalAuthContext.tsx` + `client/src/_core/hooks/useAuth.ts`
  → um único hook baseado em `better-auth/react`.
- 14 arquivos consomem um ou outro hoje — atualizar os call sites (padrão se
  repete: ler `user`/`role`, checar permissão de página, chamar login/logout).
- `client/src/pages/LocalLogin.tsx`: trocar a chamada tRPC `localAuth.login`
  pelo `signIn` do client do Better Auth.
- **Verificação**: login local funciona ponta a ponta; páginas com
  role-gating continuam bloqueando/liberando certo pros 8 roles de negócio.

---

## Fase 5 — Limpeza final

- `package.json`: remover `mysql2`.
- `.env.example`: remover menção a MySQL; adicionar var de secret do Better
  Auth se precisar.
- `AGENTS.md`: atualizar stack (Postgres em vez de MySQL, Better Auth em vez
  de OAuth Manus + local auth).
- Testes de servidor que hoje falham só por causa do MySQL devem passar a
  rodar de verdade contra o Postgres.
- `yarn check` + `yarn test` como verificação final de toda a migração.
