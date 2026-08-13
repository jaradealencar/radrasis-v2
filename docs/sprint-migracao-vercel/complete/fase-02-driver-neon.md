# Fase 2 — Driver de banco serverless: `pg` → `@neondatabase/serverless`

**Depende de:** Fase 1 (só porque toda fase depende dela; esta não toca em
`app.ts` nem em `api/index.ts`).
**Independente das fases 3–8.** Pode sair a qualquer momento depois da 1.

## Objetivo

Hoje `server/db/db-connection.ts` cria um `pg.Pool` com `max: 10` e o memoiza
numa variável de módulo. Isso é o desenho certo para um processo que vive
horas: abre 10 conexões TCP uma vez e reusa.

Em serverless é o desenho errado. Cada instância fria abre conexões TCP novas
(handshake + TLS + autenticação, tudo no caminho crítico da primeira
requisição), e instâncias que morrem deixam conexões penduradas até o timeout
do servidor. Com concorrência alta, o Postgres esgota `max_connections`.

A troca é para o **driver serverless do Neon** — decisão já tomada, ver o
README da sprint. A vantagem dele aqui é ser **drop-in**: o `Pool` do
`@neondatabase/serverless` tem a mesma API do `Pool` do `pg`
(`.query(text, values)` devolvendo `{ rows, rowCount }`). Isso significa que
`executeQuery`, `selectQuery` e `mutationQuery` — e portanto **todos os call
sites do projeto inteiro** — não mudam uma linha.

O que muda de verdade: 3 linhas em `db-connection.ts` e um `import` em 7
arquivos.

---

## 2.0 — Pré-requisito: confirmar que não há transações

Este passo existe porque a solução escolhida depende dele. Rode:

```bash
grep -rn "\.transaction(\|pool.connect(" server/
```

**Precisa devolver zero linhas.** No levantamento inicial devolveu zero — o
projeto não usa transação multi-statement nem checkout manual de conexão,
só queries avulsas.

Se **devolver alguma linha**, pare: significa que o código mudou desde o
levantamento e a configuração de `poolQueryViaFetch` (passo 2.2) precisa ser
revista. **Pergunte, não improvise.**

## 2.1 — Instalar a dependência

```bash
yarn add @neondatabase/serverless
```

**Não remova `pg` nem `@types/pg`.** O `pg` continua sendo usado por
`scripts/migrate-mysql-to-postgres.ts`, e o `@types/pg` é a origem dos tipos
`QueryResult`/`QueryResultRow` que o driver do Neon reexporta. Removê-los
quebra o typecheck.

## 2.2 — Reescrever `server/db/db-connection.ts`

Só o topo do arquivo muda. `toPgPlaceholders`, `executeQuery`, `selectQuery`,
`mutationQuery` e o `export default` ficam **exatamente como estão** — não
toque neles.

**Antes** (linhas 1–27):

```ts
/**
 * Conexão com banco de dados PostgreSQL usando pg (node-postgres)
 * Usa DATABASE_URL para conexão (mesma variável do Drizzle)
 */

import pg from 'pg';

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) {
    return pool;
  }

  try {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });

    console.log('✅ [DB-CONNECTION] Pool de conexões criado com sucesso');
    return pool;
  } catch (error) {
    console.error('❌ [DB-CONNECTION] Erro ao criar pool:', error);
    throw error;
  }
}
```

**Depois:**

```ts
/**
 * Conexão com banco de dados PostgreSQL (Neon) usando o driver serverless.
 * Usa DATABASE_URL para conexão (mesma variável do Drizzle).
 *
 * Por que o driver serverless e não o `pg`: em ambiente serverless (Vercel)
 * cada instância fria abriria conexões TCP novas no caminho crítico da
 * primeira requisição, e instâncias mortas deixariam conexões penduradas até
 * o timeout do servidor. O driver do Neon fala com o banco pelo proxy dele,
 * sem TCP persistente.
 *
 * A API é drop-in compatível com a do `pg` (`.query(text, values)` →
 * `{ rows, rowCount }`), então nada abaixo desta função precisou mudar.
 */

import { Pool, neonConfig, type QueryResult } from '@neondatabase/serverless';

// Faz cada `pool.query()` avulso ir por HTTP (fetch) em vez de abrir uma
// sessão WebSocket. É o modo mais barato e o que serve para 100% do uso
// atual do projeto — não há transação multi-statement nem `pool.connect()`
// em lugar nenhum (validado no passo 2.0 da fase).
//
// ⚠️ Se algum dia o projeto precisar de `db.transaction(...)`, isto aqui
// deixa de bastar: transação exige a sessão WebSocket. Nesse caso, pare e
// trate como decisão de arquitetura.
neonConfig.poolQueryViaFetch = true;

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    console.log('✅ [DB-CONNECTION] Pool (Neon serverless) criado com sucesso');
    return pool;
  } catch (error) {
    console.error('❌ [DB-CONNECTION] Erro ao criar pool:', error);
    throw error;
  }
}
```

Na assinatura de `executeQuery`, troque a referência de tipo:

```diff
  export async function executeQuery(
    sql: string,
    values: any[] = []
- ): Promise<pg.QueryResult> {
+ ): Promise<QueryResult> {
```

> **Sobre o `max: 10` ter sumido:** é proposital. Com `poolQueryViaFetch`,
> cada query é uma requisição HTTP independente — não existe pool de sockets
> para dimensionar. Deixar `max` ali seria configuração morta enganando quem
> lê.

## 2.3 — Trocar o adapter do Drizzle em 7 arquivos

O `drizzle-orm/node-postgres` espera o `Pool` do `pg`. Passar o `Pool` do Neon
para ele até *funciona* por acidente de tipagem em alguns casos, mas o adapter
correto é `drizzle-orm/neon-serverless` (já vem no `drizzle-orm`, não precisa
instalar nada).

Em **cada** um dos 7 arquivos abaixo, a mudança é a mesma linha de import:

```diff
- import { drizzle } from "drizzle-orm/node-postgres";
+ import { drizzle } from "drizzle-orm/neon-serverless";
```

| # | Arquivo | Linha do `drizzle(getPool())` |
|---|---|---|
| 1 | `server/_core/auth.ts` | 15 |
| 2 | `server/db/db.ts` | 27 |
| 3 | `server/db/db-helpers.ts` | 16 |
| 4 | `server/db/db-helpers-select.ts` | 12 |
| 5 | `server/routers/performance.ts` | 10 |
| 6 | `server/routers/logistica.ts` | 40 |
| 7 | `server/routers/empacotamento.ts` | 119 |

**Não mexa na chamada `drizzle(getPool())` em si** — ela continua idêntica. Só
o `from` do import muda.

Confira que não sobrou nenhum:

```bash
grep -rn "drizzle-orm/node-postgres" server/
# não pode devolver NADA
```

> `server/__tests__/empacotamento.test.ts:38` também chama
> `drizzle(getPool())`. Se ele importar de `node-postgres`, troque também —
> o grep acima pega. Se importar de outro lugar, deixe como está.

## 2.4 — Anotar no `.env.example`

O formato da `DATABASE_URL` não muda (o driver do Neon aceita a mesma string),
mas vale registrar a dependência nova. Ajuste o comentário da primeira linha:

```diff
- # Banco de dados (PostgreSQL, ex: Neon) — usado pelo Drizzle e pelas queries SQL diretas (pg)
+ # Banco de dados (PostgreSQL / Neon) — usado pelo Drizzle e pelas queries SQL
+ # diretas. Driver: @neondatabase/serverless (ver server/db/db-connection.ts).
+ # A string é a mesma de sempre; funciona tanto local quanto na Vercel.
  DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

---

## Armadilhas conhecidas

- **O driver do Neon só fala com o Neon.** Se alguém apontar `DATABASE_URL`
  para um Postgres comum (um container local, um RDS), **não vai conectar**.
  Se o time usa Postgres local para desenvolver, isso é um bloqueio real —
  pare e reporte antes de seguir.
- **`console.log` de query continua ligado.** `executeQuery` loga SQL e values
  a cada chamada. Isso não é problema desta fase (já era assim), mas na Vercel
  vira volume de log. Está anotado na Fase 8 como item de limpeza — **não
  remova aqui.**
- **Não troque `getPool()` por `neon()` (o cliente HTTP puro).** A assinatura
  é diferente (template tag) e quebraria os 4 helpers e todos os call sites.
  A escolha do `Pool` é justamente para não mexer neles.

## Verificação

```bash
yarn run check
yarn test
yarn build
yarn dev
```

Com o `yarn dev` de pé, o teste que importa é **bater no banco de verdade**:

1. Login (`/api/auth/*` → passa pelo Drizzle do Better Auth, arquivo 1 da
   tabela).
2. Uma página que use query Drizzle comum — Dashboard, por exemplo (arquivo 2).
3. Uma página que use os helpers de SQL cru — **Empacotamento** (logística) é
   a mais pesada e exercita `selectQuery`/`mutationQuery` (arquivos 6 e 7).
4. Uma mutation qualquer que grave: confira que `mutationQuery` continua
   devolvendo `rowCount`/`affectedRows` certos (crie e apague um registro de
   teste).

O item 4 é o que pega regressão silenciosa: se `rowCount` viesse `undefined`,
várias telas mostrariam "0 registros afetados" sem erro nenhum no console.

## Definição de pronto

- [ ] `grep -rn "\.transaction(\|pool.connect(" server/` devolveu zero (passo 2.0)
- [ ] `@neondatabase/serverless` instalado; `pg` e `@types/pg` **mantidos**
- [ ] `server/db/db-connection.ts` usando `Pool` do Neon + `poolQueryViaFetch`
- [ ] `grep -rn "drizzle-orm/node-postgres" server/` devolve zero
- [ ] `.env.example` com o comentário atualizado
- [ ] `yarn run check`, `yarn test`, `yarn build` passando
- [ ] Login, leitura e escrita testados na mão com `yarn dev`
- [ ] Commit: `chore(deploy): troca driver pg pelo @neondatabase/serverless (sprint vercel, fase 2)`
