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

- **Tarefa 2.5 — Porte mecânico do SQL cru restante (sintaxe MySQL →
  Postgres) em 3 partes, fecha a Fase 2**:
  1. `server/transportadoras-completude.ts` (painel de completude de
     cadastro): mesmo achado de coluna faltante que `cotacoes_frete` teve na
     2.3 — `origem/bairro/cep/cidade/uf/cnpj` existem nas 808 transportadoras
     reais do MySQL/TiDB mas nunca foram portadas pro schema; resolvido
     estendendo `drizzle/schema.ts` (migration `0004_strong_devos.sql`) e
     fazendo backfill das 808 linhas. Sintaxe corrigida: crase → aspas
     duplas, `CAST(x AS CHAR)` → `AS TEXT`, e um bug sutil de dialeto que só
     aparece em runtime: `SUM(<expressão booleana>)` funciona no MySQL
     (coerção implícita bool→int) mas o Postgres recusa (`function sum(boolean)
     does not exist`) — precisa de `SUM(CASE WHEN ... THEN 1 ELSE 0 END)`.
  2. `server/sync/scheduled-sync-os.ts`, `server/routers/admin.ts`,
     `server/integrations/mubisys-frete.ts` (fluxo de sincronização de OS —
     `erp_os_cache`/`sync_logs`): mesmo problema de identificador sem aspas,
     espalhado pelos 3 arquivos. Um bug real e silencioso: `ORDER BY
     dataExecucao` sem aspas em `obterStatusSincronizacao()` fazia a query
     falhar e cair no `catch`, reportando status `ERRO` no painel mesmo
     logo depois de uma sincronização bem-sucedida (`SUCESSO`) — só ficou
     visível ao rodar os testes de verdade contra Postgres.
  3. Varredura geral no resto do server: só **3** fragmentos MySQL-específicos
     de verdade sobraram nos ~35 usos de `sql\`...\`` dos routers restantes —
     `DATE_FORMAT(...)` em `qualidade.ts` (trocado por `TO_CHAR(..., 'YYYY-MM')`).
     A maioria dos `sql\`...\`` já usava sintaxe padrão (como os de
     `empacotamento.ts` na 2.4b). Separado disso, uma varredura por
     `.insertId` sem `.returning()` (o mesmo padrão mecânico já usado em
     toda a Fase 2) achou **17 call sites** ainda quebrados em 9 arquivos
     (`bibliotecaArquivos.ts`, `crm.ts`, `custoLed.ts`, `desempenhoColabMensal.ts`,
     `financeiro.ts`, `metaProdutos.ts`, `metas.ts`, `qualidade.ts`,
     `routers.ts` via `db/db.ts:createPop`) — todo INSERT nesses pontos
     devolvia `id: undefined` pro client, silenciosamente.
  - **Verificação**: `yarn check` (26 → 18 erros, todos pré-existentes e sem
    relação com a migração — ver "Pontas soltas conhecidas" no `AGENTS.md`);
    `yarn test` com 135 passando, só 2 falhas de variável de ambiente
    `MUBISYS_ACCESS_TOKEN`/`MUBISYS_PUBLIC_KEY` ausente (não relacionadas ao
    banco).

**Fase 2 encerrada** — toda a camada de acesso a dados do app (`server/`,
exceto os arquivos mortos já documentados no `AGENTS.md`) roda sobre
`drizzle-orm/node-postgres` (via `getPool()` compartilhado) ou SQL cru já
portado pra sintaxe Postgres. Incluídos de brinde nesta tarefa (achados ao
varrer `mysql2` no repo inteiro): `server/scripts/seed.mjs` e
`server/scripts/seed-operacoes.mjs` (scripts de seed pra popular um banco
novo) também foram portados pro driver `pg`.

**Não incluído, e não deveria ser tocado sem necessidade**: o diretório
`scripts/` (raiz do repo, diferente de `server/scripts/`) ainda tem ~8
scripts com `mysql2` (`create-master.mjs`, `enriquecer-transportadoras.mjs`,
`import-frenet.mjs`, `seed-custos-fixos.mjs`, `seed-knowledge-base.mjs`,
`seed-price-table.mjs`, `seed-transportadoras*.mjs`, `setup-price-history.mjs`).
Mesma categoria de `scripts/migrate-mysql-to-postgres.ts` (já documentado
acima): scripts pontuais de importação/enriquecimento já aplicados contra a
produção antiga — ficam como registro histórico, não precisam portar a
menos que alguém precise rodá-los de novo contra uma base nova.

---

## Fase 3 — Auth: consolidar em Better Auth (local only) ✅ Concluída

- **Tarefa 3.1 — Instalar e configurar Better Auth**: `yarn add better-auth`
  (pacote principal, `1.6.26` na época) — achado não previsto pela doc: o
  adapter Drizzle (`better-auth/adapters/drizzle`) re-exporta em runtime de
  `@better-auth/drizzle-adapter`, um pacote **separado** não listado nas
  `dependencies` do pacote principal; precisou `yarn add
  @better-auth/drizzle-adapter @better-auth/core` também, senão quebra em
  runtime (`Cannot find package`). `drizzle-orm` teve que subir de
  `^0.44.5` pra `^0.45.2` (peer dependency do Better Auth) — sem impacto,
  `npx tsc --noEmit` continuou nos mesmos 18 erros pré-existentes depois do
  bump.
  - `drizzle/schema.ts` ganhou as 4 tabelas (`user`, `session`, `account`,
    `verification`) — nomes em singular (convenção do Better Auth, não do
    resto do arquivo) precisam bater com as chaves do módulo de schema
    passado pro adapter. `user.id` é `text` (string gerada), não `serial`
    como o resto do schema — consequência que só apareceu na Tarefa 3.2
    (ver achado abaixo).
  - `server/_core/auth.ts`: `emailAndPassword.password.hash/verify`
    sobrescritos com `bcryptjs` (mesma lib do resto do app). Plugin
    `admin`: **achado** — `adminRoles: ["admin","master"]` sozinho não
    basta, o plugin valida esses valores contra `roles` (mapa de
    permissão) e falha na inicialização se não achar; e só declarar
    `admin`/`master` em `roles` não bastava depois (Tarefa 3.2), porque
    `createUser`/`setRole` também validam o `role` do **usuário sendo
    criado** contra esse mesmo mapa — teve que cobrir as 8 roles de
    negócio inteiras (as 6 sem gerência de usuário ganham `userAc`, sem
    permissão extra). Plugin `username`: validador padrão só aceita
    alfanumérico+underscore, mas o username pode ser um e-mail (com `@`/`.`)
    ou o slug de um nome (com `.`) — precisou de `usernameValidator` custom.
  - Tabelas antigas (`users`/`local_users`) só foram dropadas na Tarefa 3.2,
    junto do código que ainda as consumia — mantém cada commit num estado
    verificável (não dava pra tirar as tabelas sem tirar quem as usa).

- **Tarefa 3.2 — Remover Manus OAuth e unificar `ctx.user`**: removidos
  `server/_core/oauth.ts`, `sdk.ts`, `types/manusTypes.ts`,
  `types/cookie.d.ts` (shim só usado pelo sdk.ts) e `cookies.ts`
  (`getSessionCookieOptions` não tinha mais nenhum consumidor fora desses
  arquivos — achado: a doc suspeitava que teria "lógica Manus-específica"
  dentro dele, mas o arquivo já era genérico, só ficou órfão). Handler do
  Better Auth montado em `app.all("/api/auth/*", toNodeHandler(auth))`
  **antes** do `express.json()` — gotcha real do Better Auth, senão o
  client trava em "pending". `context.ts` reescrito com um único `ctx.user`
  via `auth.api.getSession`; `trpc.ts` ganhou `requireRole(...roles)`, e
  `adminProcedure` passou a checar role de negócio (`admin`/`master`) em
  vez do `"user"|"admin"` genérico do OAuth — corrige de brinde o bug morto
  de `routers.ts:1248` (branch `oauthRole === "master"` que nunca era
  verdadeira, a branch inteira deixou de existir).
  - **Achado maior, fora do escopo original da tarefa**: `user.id` (Better
    Auth) é `text`, não `integer` como `local_users.id` era — quebra
    qualquer coluna que guardava esse id como FK informal (sem constraint
    de verdade, só convenção). Achadas e migradas pra `text` (migration
    `0006_colossal_the_hood.sql`, com `USING col::text` explícito —
    drizzle-kit não gera isso sozinho e o cast integer→text não é
    implícito no Postgres): `cotacoes_frete.solicitanteId`,
    `crm_atividade_log.local_user_id`, `cotacao_comentarios.autorId`,
    `auditoria_retrabalhos.usuarioId`,
    `empacotamento_pedido_usuarios.usuarioId`,
    `empacotamento_sessoes.operadorId`, `knowledge_suggestions.autorId`,
    `crm_metas.usuarioVinculadoId` — 8 colunas ao todo, só 2 delas citadas
    na doc original. Zod schemas (`z.number()` → `z.string()`) e o client
    (Empacotamento.tsx, MinhasCotacoes.tsx, Auditoria.tsx, crm.ts) ajustados
    junto — só comparações de igualdade/exibição, nenhuma lógica numérica
    dependia desses ids, então o porte foi mecânico.
  - **Achado à parte, sem relação com auth**: `server/sync/scheduled-sync-os-handler.ts`
    autenticava o endpoint de CRON (`POST /api/scheduled/sincronizarOS`)
    checando `sdk.authenticateRequest(req).isCron`/`.taskUid` — campos que
    **nunca existiram** no tipo `User` real (só acessíveis via um cast
    `as any` que escondia o erro de tipo); não há nenhuma outra referência
    a `isCron`/`taskUid` no repo nem config de cron externo versionada.
    Susbtituído por um segredo compartilhado simples (header
    `x-cron-secret` == env `CRON_SECRET`) — quem dispara esse endpoint
    externamente precisa ser reconfigurado com o header novo.
  - `localUsers.create/update/delete` reescritos sobre
    `auth.api.createUser/adminUpdateUser/setUserPassword/removeUser`
    (`banned` mapeado de/pra `active: "sim"/"nao"` só na resposta, pra não
    precisar reescrever a UI existente). `createUser` é chamado **sem**
    `headers` (chamada "server-trusted") deliberadamente — o próprio
    Better Auth trata chamadas sem headers como internas/confiáveis e pula
    a checagem de sessão dele, o que é necessário pro modo bootstrap (criar
    o primeiro usuário sem ninguém logado) funcionar; a autorização de
    verdade já é feita antes, à mão (`assertAdminOrMaster`/contagem de
    usuários). Já `adminUpdateUser`/`setUserPassword`/`removeUser`/
    `banUser`/`unbanUser` exigem uma sessão Better Auth válida com role
    admin/master — por isso passam `headers: fromNodeHeaders(ctx.req.headers)`.

- **Tarefa 3.3 — Unificar auth no client**: hook único
  `client/src/hooks/useAuth.ts` substitui `LocalAuthContext.tsx` (removido,
  não precisa mais de Provider — o client do Better Auth é um store global)
  e o antigo `client/src/_core/hooks/useAuth.ts` (removido, `_core/`
  ficou vazio nos dois lados — client e server — e foi removido). Novo
  `client/src/lib/auth-client.ts` (`createAuthClient` + plugins
  `adminClient`/`usernameClient`). 15 arquivos (não 14 — achado:
  `SugestoesConhecimento.tsx` chamava `trpc.localAuth.myLocalRole` direto,
  fora do padrão dos outros 14) atualizados. `LocalLogin.tsx`: removido o
  botão "Login com Manus/Google"; login por e-mail OU nome preservado
  normalizando o texto digitado (mesmo slug usado no `localUsers.create`)
  antes de chamar `authClient.signIn.username()`. `client/src/const.ts`
  (só tinha `getLoginUrl`/`startLogin`, Manus) e o redirect-pra-Manus em
  `main.tsx` removidos — sem sessão, o app já é aberto por design, não tem
  mais URL externa de login pra redirecionar.
  - **Verificação end-to-end** (via curl contra o servidor local, banco
    Neon real, limpo depois): bootstrap (0 usuários → cria o primeiro sem
    sessão) → login por e-mail → `localUsers.list` como master → criação de
    usuário `producao` sem e-mail → login pelo nome digitado igual o
    usuário via de fato ("João da Silva", com acento) → `banUser`
    (desativar) → tentativa de login de usuário banido rejeitada →
    `permissions.myPermissions` → sign-out → endpoint de CRON rejeitando
    sem `CRON_SECRET` e aceitando com o secret certo. Todos os passos
    funcionaram como esperado. `npx tsc --noEmit`: 17 erros (os mesmos
    pré-existentes, um a menos que antes — o de `routers.ts:1248` foi
    corrigido). `yarn test`: 133/135 (as 2 falhas são de
    `card-kanban-completo.test.ts`, dependem de haver OS reais no MubiSys
    num intervalo de datas — sem relação com auth, já falhavam antes).

---

## Fase 5 — Limpeza final

- `package.json`: remover `mysql2` (único item que falta — `.env.example`
  e `AGENTS.md` já foram atualizados na Fase 3).
- Testes de servidor que hoje falham só por causa do MySQL devem passar a
  rodar de verdade contra o Postgres.
- `npx tsc --noEmit` + `yarn test` como verificação final de toda a migração.
