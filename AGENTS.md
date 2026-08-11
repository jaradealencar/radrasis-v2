# AGENTS.md

Guia para agentes de IA (e humanos) trabalhando neste repositório.

## O que é este projeto

Radrasys — sistema interno de gestão (logística, qualidade, PCP, comercial,
financeiro, RH) construído sobre o template "Manus webdev fullstack"
(ver `docs/webdev-template-guide.md` para as convenções originais do template).

Stack: React 19 + Tailwind 4 + Vite 7 no client, Express 4 + tRPC 11 no
server, Drizzle ORM sobre MySQL, autenticação própria (local + OAuth).

## Gerenciador de pacotes

**Yarn (classic, 1.x)** — não use `npm install` nem `pnpm`. O projeto foi
migrado de pnpm para yarn; o lockfile é `yarn.lock`.

```bash
yarn install     # instala dependências (roda patch-package automaticamente)
yarn dev         # servidor de desenvolvimento (Vite + Express na mesma porta)
yarn build       # build de produção (client via Vite, server via esbuild)
yarn start       # roda o build de produção
yarn check       # tsc --noEmit
yarn test        # vitest run
yarn format      # prettier --write .
yarn db:push     # drizzle-kit generate && drizzle-kit migrate
```

Variáveis de ambiente: ver `.env.example`. `DATABASE_URL` (MySQL) é
obrigatória para rodar o server ou os scripts em `scripts/`.

## Banco de dados — sempre via migration

Nunca altere o schema do banco rodando SQL direto (`psql`, script one-off,
`pool.query`/`mutationQuery` solto para `ALTER TABLE`/`CREATE TYPE`/etc.).
Toda mudança de estrutura (coluna, tipo, enum, índice) segue este fluxo:

1. Edite `drizzle/schema.ts`.
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

## Commits por fase de planejamento

Documentos de planejamento/sprint (ex:
`docs/migracao-postgres-better-auth.md`) dividem o trabalho em
fases/tarefas numeradas. Ao concluir uma fase ou tarefa inteira, faça um
commit próprio pra ela antes de seguir pra próxima — não acumule várias
fases num commit só, e não deixe uma fase concluída sem commit. Atualize o
próprio documento (marcando a tarefa como concluída, registrando achados)
como parte desse commit.

## Estrutura

```
client/src/          frontend (Vite root = client/)
  pages/              uma pasta por módulo (logistica/, admin/, comercial/, ...)
  components/         componentes compartilhados entre páginas
  hooks/, lib/, contexts/
server/
  routers.ts          appRouter raiz do tRPC — registra todos os sub-routers
  routers/             sub-routers por domínio (logistica.ts, pcp.ts, admin.ts, ...)
  db/                  acesso a dados (Drizzle + mysql2 puro): db.ts, db-connection.ts,
                       db-helpers*.ts, storage.ts, pcp-helpers.ts
  integrations/        clientes de APIs externas: gemini.ts, mubisys-client.ts, mubisys-frete.ts
  sync/                sincronização com o ERP: sync-erp.ts, scheduled-sync-os*.ts,
                       heartbeat-sync-erp.ts
  utils/               helpers puros: date-utils.ts, transportadoras-completude.ts
  scripts/             scripts de seed do server (seed.mjs, seed-operacoes.mjs)
  __tests__/           testes do server (*.test.ts)
  _core/               infra do template (auth, contexto tRPC, vite dev middleware)
shared/               tipos e constantes usados por client e server
drizzle/              schema.ts + migrations (numeradas, geradas por drizzle-kit)
scripts/              scripts de seed/importação reutilizáveis (rodar com `node scripts/x.mjs`)
                       — scripts de migração/ajuste pontuais já aplicados foram removidos;
                       só ficou o que serve pra popular um banco novo
docs/                 documentação viva + docs/archive (ver abaixo)
```

Import aliases (`vite.config.ts` / `tsconfig.json`): `@/` → `client/src/`,
`@shared/` → `shared/`.

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

- `server/sync/heartbeat-sync-erp.ts` e `server/routers/logistica-refactor.ts`
  são protótipos não finalizados — não são importados por nada e não
  compilam (`heartbeat-sync-erp.ts` referencia um módulo `../_core/heartbeat`
  que não existe; `logistica-refactor.ts` importa um export `db` que
  `server/db/db.ts` não tem). O sync de ERP que está realmente ativo é
  `server/sync/scheduled-sync-os.ts` + `server/sync/scheduled-sync-os-handler.ts`,
  registrado em `server/_core/index.ts`.
- `docs/archive/versoes-divergentes/0003_aromatic_lilith.sql` é uma migration
  órfã (o número 0003 colide com uma migration já existente na sequência
  do Drizzle). Não aplique sem antes conferir contra `drizzle/schema.ts`.
- `yarn check` acusa alguns erros de tipo pré-existentes, sem relação com
  esta reorganização (routers `cargosFuncoes`/`cte` com campos faltando,
  `Cargo.roteiroEntrevista`/`promptAnaliseIA`, paginação em
  `Assertividade.tsx`, `MinhasCotacoes.tsx`, `curriculos.ts`, `qualidade.ts`,
  comparação de role `"master"` em `server/routers.ts:1248`). São bugs do
  código de negócio, não da estrutura do projeto.

## Patches

`wouter` está fixado em `3.7.1` (não use `^`) porque há um patch aplicado
via `patch-package` em `patches/wouter+3.7.1.patch` (injeta
`window.__WOUTER_ROUTES__` para debug). Rodar `yarn install` aplica o patch
automaticamente via `postinstall`.
