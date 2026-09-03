# AGENTS.md

Guia para agentes de IA (e humanos) trabalhando neste repositório.

## O que é este projeto

Radrasys — sistema interno de gestão (logística, qualidade, comercial,
financeiro, RH) originado do template "Manus webdev fullstack", mas já sem
nenhuma dependência do Forge (Manus) ou do Gemini — banco é Postgres, auth é
Better Auth local-only, LLM é OpenAI, storage é UploadThing (ver
`docs/webdev-template-guide.md` para as convenções originais do
template — **cuidado**: esse doc ainda descreve o template original em
MySQL/Manus OAuth/Forge "puro"; onde ele divergir do que está escrito aqui,
este AGENTS.md vale, não ele).

Stack: React 19 + Tailwind 4 + Vite 7 no client (SPA servida pelo próprio
Express); Express 4 + tRPC 11 no server (`superjson` como transformer —
`Date`/`Map`/etc. atravessam o wire sem serialização manual); Drizzle ORM
**sobre PostgreSQL (Neon)**, driver `pg`/`drizzle-orm/node-postgres`;
autenticação própria via **Better Auth** (local-only, e-mail+senha); LLM via
**OpenAI** (`server/_core/llm.ts`); storage de arquivo via **UploadThing**
(`server/db/storage.ts`).

⚠️ **Migração em andamento MySQL→PostgreSQL + auth própria (Better Auth) —
Fases 1-3 concluídas, falta a Fase 5.** O banco já é Postgres de verdade e
a auth já é 100% Better Auth (Fases 1-3); só falta a Fase 5 (remover
`mysql2` do `package.json` — continua ali só porque nada mais depende
dele, é limpeza final, sem urgência funcional). Plano completo, histórico
do que já foi feito: `docs/migracao-postgres-better-auth.md`.

## Gerenciador de pacotes

**Yarn (classic, 1.x)** — não use `npm install` nem `pnpm`. O projeto foi
migrado de pnpm para yarn; o lockfile é `yarn.lock`.

```bash
yarn install     # instala dependências (roda patch-package automaticamente)
yarn dev         # servidor de desenvolvimento (Vite + Express na mesma porta)
yarn build       # build de produção (client via Vite, server via esbuild)
yarn start       # roda o build de produção
yarn run check   # tsc --noEmit — precisa do "run"! `yarn check` sozinho
                 # dispara o comando nativo do Yarn (valida lockfile), não
                 # o script do package.json, e retorna resultado errado
yarn test        # vitest run
yarn format      # prettier --write .
yarn db:push     # drizzle-kit generate && drizzle-kit migrate
```

Variáveis de ambiente: ver `.env.example`. `DATABASE_URL` (string de conexão
**PostgreSQL**, ex: `postgresql://user:pass@host/db?sslmode=require` — o
projeto roda contra Neon) é obrigatória para rodar o server ou os scripts em
`scripts/`.

## Banco de dados — sempre via migration

Dialeto: **PostgreSQL** (`drizzle.config.ts` tem `dialect: "postgresql"`).
Nunca altere o schema do banco rodando SQL direto (`psql`, script one-off,
`selectQuery`/`mutationQuery` solto para `ALTER TABLE`/`CREATE TYPE`/etc.).
Toda mudança de estrutura (coluna, tipo, enum, índice) segue este fluxo:

1. Edite `drizzle/schema.ts` (tabelas em `pg-core`: `pgTable`, `pgEnum`, etc.
   — Postgres exige enums nomeados, diferente do enum inline do MySQL).
2. Rode `npx drizzle-kit generate` para gerar a migration numerada em `drizzle/`.
3. **Revise o SQL gerado antes de aplicar** — drizzle-kit não lida sozinho
   com tudo (ex: mudar os valores de um enum já em uso exige editar a
   migration à mão para adicionar um `USING CASE ...` que remapeia os
   dados já gravados; senão o `ALTER TYPE` quebra contra linhas existentes).
4. Aplique com `npx drizzle-kit migrate` (ou `yarn db:push`, que já faz
   generate + migrate).

Scripts one-off pra *dado* (backfill pontual, copiar de uma tabela legada)
são aceitáveis fora desse fluxo — a regra é sobre *estrutura*. Migration
sempre vai commitada junto com a mudança de `schema.ts` que a gerou.

Migrations antigas do MySQL (pré-migração) foram arquivadas em
`docs/archive/mysql-migrations/` — não são mais aplicáveis, só referência
histórica caso precise comparar o design de uma tabela antes/depois.

## Autenticação (Better Auth, local-only)

`server/_core/auth.ts` — instância `betterAuth()` sobre o Drizzle adapter
(mesmo Postgres/Neon do resto do app). Só e-mail+senha (sem OAuth/social —
a plataforma Manus não é mais usada). Pontos que fogem do padrão "out of
the box" do Better Auth, todos por causa do vocabulário de negócio já
existente antes da migração (`master, admin, gestor, vendas, logistica,
producao, financeiro, empacotamento`, ver `AppRole`/`APP_ROLES` em
`drizzle/schema.ts`):

- **Hash de senha em bcrypt** (`emailAndPassword.password.hash/verify`
  sobrescritos com `bcryptjs`), não o scrypt padrão do Better Auth — mesma
  lib usada em todo o resto do app pra senha admin-provisionada.
- **Plugin `admin`**: `roles` precisa listar as 8 roles de negócio (não só
  `admin`/`user`) — o plugin rejeita em runtime qualquer `role` passado
  pra `createUser`/`setRole` que não seja uma chave desse mapa, mesmo já
  validado pelo enum do Postgres.
- **Plugin `username`**: login por e-mail OU por nome (roles sem e-mail
  real, ex. `producao`/`empacotamento`, continuam logando só com o nome).
  Usuários sem e-mail ganham um e-mail sintético interno
  (`<slug-do-nome>@local.internal`, nunca exibido) só pra satisfazer a
  coluna `email` (núcleo, obrigatória mesmo com o plugin `username`
  habilitado); o `username` de fato é o e-mail normalizado (com e-mail
  real) ou o slug do nome (sem e-mail). O client (`LocalLogin.tsx`)
  normaliza o texto digitado do mesmo jeito antes de chamar
  `signIn.username()` — replicar essa normalização (`slugifyName`) em
  qualquer novo ponto que crie ou autentique usuário sem e-mail.
- `active: "sim"/"nao"` (vocabulário usado no resto do app) é mapeado a
  partir de `banned` do Better Auth em `localUsers.list`/`.update`
  (`server/routers.ts`) — banir/desbanir via `auth.api.banUser`/`unbanUser`.

`ctx.user` (único, sem mais a síntese dupla `user`/`localUser` de antes)
é resolvido em `server/_core/context.ts` via
`auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`.
`server/_core/trpc.ts` expõe `requireRole(...roles)` — middleware reusável
pra checagem de role de negócio, usado tanto em procedures
(`.use(requireRole("admin","master"))`) quanto redefinindo `adminProcedure`.
CRUD administrativo de usuários (`localUsers.create/update/delete` em
`server/routers.ts`) continua com lógica própria (modo bootstrap: se não
há nenhum usuário ainda, qualquer um pode criar o primeiro) chamando
`auth.api.createUser`/`adminUpdateUser`/`setUserPassword`/`removeUser`
diretamente — sem equivalente pronto no plugin admin pra essas regras.

Client: hook único `client/src/hooks/useAuth.ts` (substitui os antigos
`useAuth` do OAuth Manus e `useLocalAuth`) — usa
`client/src/lib/auth-client.ts` (`createAuthClient`/`useSession` do
Better Auth) pra identidade/sessão, combinado com a query tRPC
`permissions.myPermissions` (tabela `role_permissions`, intocada pela
migração) pra permissão por página. Sem sessão: sistema aberto, tudo
visível (`canAccess` retorna `true`) — comportamento deliberado, não um
bug. Gate de rota por página: `client/src/components/ProtectedRoute.tsx`.
Login: `client/src/pages/LocalLogin.tsx`.

Endpoint de CRON (`POST /api/scheduled/sincronizarOS`,
`server/sync/scheduled-sync-os-handler.ts`) usa um segredo compartilhado
simples (header `x-cron-secret` == env `CRON_SECRET`) — antes da Fase 3
checava um campo (`user.isCron`) que nunca existiu de verdade no SDK do
Manus (achado durante a migração: só funcionava por acaso/nunca, escondido
atrás de um cast `as any`). Se algo externo dispara esse endpoint
periodicamente, precisa ser reconfigurado com o novo header/segredo.

## Commits ao final de sprint/tarefa/fix

**Toda sprint, tarefa ou fix concluído termina com um commit** — não deixe
trabalho pronto (e validado: typecheck/testes relevantes rodados) parado
sem commitar, e não acumule várias tarefas/fixes não relacionados num
commit só. Isso vale tanto pra fases numeradas de um doc de planejamento
(ex: `docs/migracao-postgres-better-auth.md`) quanto pra qualquer tarefa
avulsa (bugfix, ajuste pontual, feature pequena) pedida fora de um doc de
sprint.

- Documentos de planejamento/sprint dividem o trabalho em fases/tarefas
  numeradas. Ao concluir uma fase ou tarefa inteira, faça um commit
  próprio pra ela antes de seguir pra próxima. Atualize o próprio
  documento (marcando a tarefa como concluída, registrando achados) como
  parte desse commit.
- Fora de um doc de sprint: ao terminar qualquer tarefa/fix pedido, revise
  o que está pendente (`git status`/`git diff`) e commit antes de
  considerar a tarefa encerrada — não espere o usuário pedir o commit
  explicitamente.
- Exceção: se o próprio usuário pedir explicitamente pra não commitar
  ainda (quer revisar antes, trabalho intermediário/experimental), respeite
  e avise que o commit ficou pendente.

**Ao final de toda tarefa** (não só as de um doc de planejamento — vale pra
qualquer trabalho concluído no repo), verifique se este `AGENTS.md`
precisa de ajuste antes de considerar a tarefa pronta: stack/dependência
nova, comando novo ou trocado, pasta/arquivo que mudou de lugar, ponta
solta que foi resolvida (remova da lista), ponta solta nova que ficou pra
trás, ou uma fase da migração que avançou (ex: Fase 3/Better Auth
concluída deve atualizar a seção de Autenticação e o aviso no topo). Se
nada mudou, não precisa tocar no arquivo — mas o hábito é checar, não
assumir que continua certo.

## Estrutura

```
client/src/          frontend (Vite root = client/)
  pages/              uma pasta por módulo (logistica/, admin/, comercial/, ...)
  components/         componentes compartilhados entre páginas
  hooks/               hooks do app, incluindo useAuth.ts (identidade/permissões)
  lib/                 trpc.ts, auth-client.ts (client do Better Auth)
server/
  routers.ts          appRouter raiz do tRPC — registra todos os sub-routers
  routers/             sub-routers por domínio (logistica.ts, admin.ts, ...)
  db/                  acesso a dados (Drizzle + pg puro via getPool()): db.ts, db-connection.ts,
                       db-helpers*.ts, storage.ts
  integrations/        clientes de APIs externas: mubisys-client.ts, mubisys-frete.ts
  sync/                sincronização com o ERP: scheduled-sync-os.ts,
                       scheduled-sync-os-handler.ts
  utils/               helpers puros: date-utils.ts, transportadoras-completude.ts
  scripts/             scripts de seed do server (seed.mjs, seed-operacoes.mjs)
  __tests__/           testes do server (*.test.ts)
  _core/               infra do server: auth.ts (Better Auth), context.ts/trpc.ts
                       (contexto e middlewares tRPC), vite dev middleware
shared/               tipos e constantes usados por client e server
drizzle/              schema.ts + migrations (numeradas, geradas por drizzle-kit)
scripts/              scripts de seed/importação reutilizáveis (rodar com `node scripts/x.mjs`)
                       — scripts de migração/ajuste pontuais já aplicados foram removidos;
                       só ficou o que serve pra popular um banco novo
docs/                 documentação viva + docs/archive (ver abaixo)
```

Import aliases (`vite.config.ts` / `tsconfig.json`): `@/` → `client/src/`,
`@shared/` → `shared/`.

## Convenções do client (`client/src/pages`)

Fruto da sprint de refatoração de `pages/` — reaproveite estes componentes
em vez de reescrever o padrão:

- Tabela de dados usa `@/components/ui/table` — **não** escreva `<table>` na
  mão. Exceção: HTML montado em string para exportação (Excel/impressão).
- Cabeçalho de página usa `@/components/PageHeader`.
- Card de indicador usa `@/components/KpiCard`.
- Tooltip de gráfico recharts usa `@/components/ChartTooltip`.
- Formatação de moeda/número/data/percentual vem de `@/lib/format` — não
  crie `toLocaleString` inline nem formatador local.
- Cor de série de gráfico vem de `@/lib/chartColors` (`chartColor(i)` para
  categórica, `STATUS_COLORS` para semântica).
- Estados de carregando e vazio usam `@/components/ui/spinner` e
  `@/components/ui/empty`.

## Testes

`yarn test` (vitest, `environment: "node"`) roda tudo que casar com
`server/**/*.test.ts` (config em `vitest.config.ts`). **`DATABASE_URL`
precisa estar exportada no shell antes de rodar** — os testes importam os
módulos de `server/db/` direto e pulam `server/_core/index.ts` (que é quem
normalmente carrega `dotenv/config`), então sem a env var no ambiente as
suítes que tocam banco falham na conexão, não só pulam. Vários testes usam
o banco real (Neon) via fixtures de SQL cru — não há banco de teste isolado
nem mocks da camada de dados.

## docs/ — quais valem como fonte de verdade

- `docs/migracao-postgres-better-auth.md` — plano ativo da migração
  MySQL→Postgres/Better Auth (ver aviso no topo deste arquivo). **O doc mais
  importante pra entender o estado real do banco/auth agora.**
- `docs/webdev-template-guide.md` — guia original do template Manus
  webdev fullstack. Descreve o template genérico (MySQL, só OAuth) — várias
  partes já não valem pra este repo, ver aviso na seção "O que é este
  projeto" acima.
- `docs/sprint-saida-forge/` — **sprint concluída**: tirou a dependência do
  Forge (Manus) e do Gemini do repo (LLM na OpenAI, storage no UploadThing,
  notificação via alertas do próprio app, extração de texto sem LLM, e
  limpeza final dos módulos/envs/config residuais). **Formato diferente dos
  outros docs de sprint: é uma pasta, com `README.md` (contexto + decisões)
  e um arquivo por fase, cada fase concluída movida pra
  `docs/sprint-saida-forge/complete/`.** Mantida como histórico — não é mais
  plano ativo.
- `docs/base-conhecimento-*.md`, `docs/tabela-precos-conteudo.md` —
  conteúdo/dados de negócio usados para popular features específicas (base
  de conhecimento do chat, tabela de preços), não documentação de
  arquitetura.
- `docs/archive/` — histórico, nunca fonte de verdade (ver seção abaixo).

## docs/archive/

Este projeto foi reorganizado a partir de dois estados divergentes: um
export em zip do Manus (já extraído — o zip original foi descartado por
ser redundante) e ~50 arquivos soltos na raiz do repo que representavam
edições feitas depois desse export. Onde os dois lados divergiam de verdade, a versão mais
recente (a solta) venceu; a versão do zip que perdeu ficou arquivada em
`docs/archive/versoes-divergentes/*.zip-snapshot.*` só para referência —
não são mais usadas pelo app.

`docs/archive/anexos/` tem PDFs, screenshots (`pasted_file_*.png`) e
relatórios de diagnóstico (`.md`) que eram anexos de conversas, sem valor
de código — mantidos só como histórico.

**Não use nada dentro de `docs/archive/` como fonte de verdade.** Se
precisar investigar uma decisão antiga, é aí que está, mas o código ativo
é sempre o que está fora dessa pasta.

## Pontas soltas conhecidas (não introduzidas por esta reorganização)

- `docs/archive/versoes-divergentes/0003_aromatic_lilith.sql` é uma migration
  órfã (o número 0003 colide com uma migration já existente na sequência
  do Drizzle). Não aplique sem antes conferir contra `drizzle/schema.ts`.
- `npx tsc --noEmit` (rode assim, não `yarn check` — esse é o comando nativo
  do Yarn pra checar o lockfile, não o script `check` do `package.json`) não
  acusa erros de tipo (checado na Fase 6 do `docs/sprint-mubisys/`, 17/08/2026).
  Os protótipos mortos citados em versões anteriores desta nota
  (`server/sync/heartbeat-sync-erp.ts`, `server/routers/logistica-refactor.ts`)
  não existem mais no repo.
- **Nomenclatura "Gemini" sobrevivendo na UI e em nomes de campo**, apesar de
  o LLM já ser 100% OpenAI desde a Fase 1 do `docs/sprint-saida-forge`:
  `geminiAnswer`/`geminiAnswerIsGeneral` (`server/routers.ts`,
  `client/src/pages/operacoes/Conhecimento.tsx`), o enum
  `z.enum(["gemini", "manual"])` em `server/routers.ts`, e textos "Powered by
  Gemini"/"Gemini está analisando..." em
  `client/src/pages/logistica/InsightsLogistica.tsx` e
  `client/src/pages/operacoes/SugestoesConhecimento.tsx`. Não é integração
  ativa (não chama SDK/API do Gemini) — é só nome/copy que ficou pra trás.
  Fora do escopo da Fase 7 (que tratava só de módulos/env/config mortos do
  Forge); renomear é tarefa separada, cuidado com o enum `"gemini"` que pode
  estar persistido em dados existentes.
- **Sem rate limiting de aplicação quando roda na Vercel.** O
  `express-rate-limit` de `server/_core/app.ts` fica atrás de um
  `if (!IS_SERVERLESS)`: o MemoryStore dele conta por processo, e em
  serverless isso significa um contador por instância — limite efetivo
  indeterminado e reset a cada cold start. Foi uma decisão consciente da
  `docs/sprint-migracao-vercel` (Fase 4), não um esquecimento. No `yarn dev` /
  `yarn start` o rate limiting continua ativo e inalterado (300 req/min geral,
  10/min em sign-in e sign-up). Para reativar em produção seria preciso um
  store distribuído (Redis) ou regra de firewall na Vercel — nenhum dos dois
  está implementado.

## Patches

`wouter` está fixado em `3.7.1` (não use `^`) porque há um patch aplicado
via `patch-package` em `patches/wouter+3.7.1.patch` (injeta
`window.__WOUTER_ROUTES__` para debug). Rodar `yarn install` aplica o patch
automaticamente via `postinstall`.
