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

---

## Fase 2 — Camada de conexão e SQL cru (restante)

### Tarefa 2.3 — Modernizar `server/db-helpers-select.ts` (21 queries cruas) e `server/db-helpers.ts` (6 queries cruas)

- Mesma ideia da 2.2: converter pra `db.select()/insert()/update()` sobre o
  schema Postgres.
- Ficar atento a `excluirCotacoesPorStatus` (`db-helpers-select.ts:148`, usa
  status `'aberta'` como default) e ao comentário em `db-helpers.ts:79` sobre
  o "enum real no banco: aberta, cotando, cotada, enviada" — esse é o mesmo
  vocabulário antigo de `cotacoes_frete.status` que o ETL já teve que
  remapear pro vocabulário novo do pgEnum (`fila/em_cotacao/pronto/
  concluido/cancelado`, ver `scripts/migrate-mysql-to-postgres.ts`). Esse
  código legado provavelmente ainda escreve no vocabulário antigo — ajustar
  pra escrever/comparar com os valores novos do enum ao portar.
- **Verificação**: `yarn check` limpo.

### Tarefa 2.4 — Modernizar `server/routers/logistica.ts` (15 queries cruas)

- Converter pra Drizzle query builder.
- Reconciliar os pontos onde comentários já apontam divergência schema-vs-
  tabela-real (mesmo padrão do `erp_os_cache` que a Fase 1 já corrigiu — ver
  `drizzle/0002_fix_erp_os_cache.sql` como referência do tipo de ajuste
  necessário).
- **Verificação**: `yarn check` limpo; testes relacionados a logística.

### Tarefa 2.4b — Modernizar `server/routers/empacotamento.ts` (2725 linhas)

- Mesmo problema estrutural que a 2.2 resolveu em `db.ts`: o arquivo instancia
  seu próprio `drizzle(process.env.DATABASE_URL!)` com `drizzle-orm/mysql2` —
  quebrado em runtime contra Postgres (o router está registrado em
  `server/routers.ts`, então isso está ativo em produção agora).
- Comentários no próprio arquivo (`✅ mysql2 direto — o schema do Drizzle não
  reflete as colunas reais`, linhas ~587/725/784/809/836/992) sugerem que,
  como em `local_users`, pode haver divergência schema-vs-tabela-real que
  precisa ser conferida linha a linha antes de portar — não assumir que é só
  trocar o driver.
- `server/empacotamento.test.ts` também importa `drizzle-orm/mysql2` direto —
  portar junto.
- **Verificação**: `yarn check` limpo; `yarn test` sem falhas novas; testes de
  empacotamento (kanban, apontamento de tempo, checklist) passando.

### Tarefa 2.5 — Portar mecanicamente o SQL cru restante (sintaxe MySQL → Postgres)

Arquivos: `server/transportadoras-completude.ts`, `server/scheduled-sync-os.ts`,
`server/routers/admin.ts`, `server/mubisys-frete.ts`, e os ~82 fragmentos
`sql\`...\`` espalhados em 9 routers (`crm.ts`, `empacotamento.ts`,
`performanceComercial.ts`, `qualidade.ts`, etc.).

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
