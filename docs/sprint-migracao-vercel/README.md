# Sprint: migração para deploy na Vercel

Sprint única, dividida em **9 fases — uma fase por arquivo em `pending/`, uma
fase por commit**. O objetivo é fazer o projeto rodar na Vercel (client
estático + funções serverless) **sem mudar uma linha de regra de negócio**.

> **Como usar este material.** Ao atacar uma fase, cole **este README inteiro
> + o arquivo daquela fase** como contexto inicial da conversa. Não carregue
> as outras fases: cada arquivo de fase é auto-contido e diz explicitamente o
> que assumir das fases anteriores.
>
> Este material foi escrito para ser executado por **modelos menores**. Por
> isso cada fase é mecânica, tem lista fechada de arquivos, exemplos literais
> de antes/depois e um comando de verificação objetivo. Se uma fase parecer
> exigir decisão de arquitetura, ela está mal escrita — **pare e pergunte, não
> improvise.**

## Índice das fases

| # | Arquivo | O que faz | Depende de |
|---|---------|-----------|------------|
| 1 | [fase-01-app-serverless.md](pending/fase-01-app-serverless.md) | Separa `createApp()` do `listen()`; cria `api/index.ts` | — |
| 2 | [fase-02-driver-neon.md](pending/fase-02-driver-neon.md) | `pg` → `@neondatabase/serverless` (pool serverless-friendly) | 1 |
| 3 | [fase-03-build-vercel.md](pending/fase-03-build-vercel.md) | `vercel.json`, rewrites, scripts de build | 1 |
| 4 | [fase-04-rate-limit.md](pending/fase-04-rate-limit.md) | Remove rate limit em memória do caminho serverless | 1 |
| 5 | [fase-05-auth-trpc-serverless.md](pending/fase-05-auth-trpc-serverless.md) | Better Auth + tRPC: baseURL, body cru, cookies | 1, 3 |
| 6 | [fase-06-cron-qstash.md](pending/fase-06-cron-qstash.md) | CRON de sync de OS → Upstash QStash | 1, 3 |
| 7 | [fase-07-upload-direto-fundacao.md](pending/fase-07-upload-direto-fundacao.md) | Infra de upload direto ao UploadThing + 1 call site piloto | 1 |
| 8 | [fase-08-upload-direto-migracao.md](pending/fase-08-upload-direto-migracao.md) | Migra os 9 call sites restantes; reduz o body limit | 7 |
| 9 | [fase-09-deploy-e-limpeza.md](pending/fase-09-deploy-e-limpeza.md) | Env vars, deploy de produção, smoke test, fechamento | 1–8 |

**Ordem obrigatória: a Fase 1 vem primeiro.** Ela cria o `server/_core/app.ts`
que todas as outras editam. Depois disso:

- **2** é independente das demais (só toca a camada de banco) — pode sair a
  qualquer momento após a 1.
- **3** deve sair cedo: é ela que torna o projeto *deployável*. As fases 5 e 6
  assumem que o `vercel.json` já existe.
- **4** é independente, pode sair a qualquer momento após a 1.
- **5 → 6** nessa ordem (a 6 testa o endpoint de cron em preview, o que
  depende do deploy estar de pé pela 5).
- **7 → 8** nessa ordem, sempre. Juntas são o bloco mais pesado da sprint e o
  único que toca o client. Independentes das 2–6.
- **9** por último, sempre.

⚠️ **Nunca rode duas fases em paralelo.** As fases 1, 3, 4, 5, 7 e 8 tocam
`server/_core/app.ts`; 3 e 6 tocam `vercel.json`. Em série não há conflito; em
paralelo há.

---

## Contexto: por que esta sprint existe

Hoje o projeto é um **servidor Node único e de longa duração**.
`server/_core/index.ts` monta um Express, embrulha em `http.createServer(app)`
e chama `server.listen(port)`. Tudo depende desse processo continuar vivo:

- o pool de conexões (`pg.Pool`, `max: 10`) é criado uma vez na inicialização
  e memoizado em variável de módulo (`server/db/db-connection.ts`);
- o rate limiting (`express-rate-limit`) guarda contadores num `MemoryStore`
  in-process;
- o endpoint de CRON (`POST /api/scheduled/sincronizarOS`) só é útil se algo
  externo bater nele — hoje não há agendador nenhum no repo;
- em dev o Vite roda em modo middleware dentro do mesmo Express (`setupVite`);
  em produção o mesmo Express serve `dist/public` como estático
  (`serveStatic`).

Na Vercel nada disso vale: **não existe `listen()`**, cada invocação pode ser
uma instância fria nova, e não há garantia de processo persistente entre
requisições.

### Levantamento (medido no início da sprint)

**Banco: PostgreSQL no Neon.** `drizzle.config.ts` usa `dialect: "postgresql"`,
o driver é `pg` / `drizzle-orm/node-postgres`, e o `.env.example` já traz
`postgresql://…?sslmode=require`. O pool único de `server/db/db-connection.ts`
é consumido por 7 pontos:

| Arquivo | Linha |
|---|---|
| `server/_core/auth.ts` | 15 |
| `server/db/db.ts` | 27 |
| `server/db/db-helpers.ts` | 16 |
| `server/db/db-helpers-select.ts` | 12 |
| `server/routers/performance.ts` | 10 |
| `server/routers/logistica.ts` | 40 |
| `server/routers/empacotamento.ts` | 119 |

`mysql2` ainda está no `package.json`, mas **nada em `server/` o importa** — só
o script one-shot `scripts/migrate-mysql-to-postgres.ts`. Não é problema desta
sprint (ver `docs/migracao-postgres-better-auth.md`).

**Não há WebSocket, SSE nem streaming.** Zero ocorrências de `EventSource`,
`text/event-stream`, `ws` ou `socket.io` no repo. O `server/_core/llm.ts`
(OpenAI) é request/response puro. O tRPC usa só `httpBatchLink`
(`client/src/main.tsx:32`), sem subscriptions. O polling que existe é do lado
do client, via `refetchInterval` do React Query — não depende de nada vivo no
server. **Isso é a melhor notícia do levantamento: é o que torna a migração
viável.**

**Estado em memória no server:** apenas o pool e o rate limiter. Nenhum cache
in-process, nenhum `setInterval` de background job, nenhuma escrita em
filesystem (o único uso de `fs` é `setupVite`/`serveStatic`). Storage de
arquivo é UploadThing — serviço externo, já compatível com serverless.

**Uploads são o ponto quebrado.** O `express.json({ limit: "50mb" })` existe
porque arquivos sobem como **base64 dentro do payload tRPC**. São 11 call
sites de `storagePut` espalhados por `routers.ts`, `bibliotecaArquivos`,
`cargos`, `curriculos`, `empacotamento` e `logistica`. A Vercel corta request
body de função serverless em **4.5 MB**, sem override possível — e base64
infla ~33%, então o teto real vira ~3.3 MB de arquivo. As Fases 7 e 8
resolvem isso.

### Decisões já tomadas (não reabrir)

Estas foram decididas antes da sprint começar. Se uma fase parecer sugerir
outra coisa, a fase está errada:

| Assunto | Decisão |
|---|---|
| Driver de banco | `@neondatabase/serverless` — API drop-in do `pg`, mantém `executeQuery`/`selectQuery`/`mutationQuery` intactos |
| Agendador de CRON | **Upstash QStash**, não Vercel Cron |
| Rate limiting | Remover do caminho serverless e **documentar** a limitação. Sem Redis, sem dependência nova |
| Uploads grandes | Fase própria: upload direto do browser pro UploadThing |

### Ponto ainda em aberto

**O plano da Vercel (Hobby vs. Pro) não foi definido.** Isso afeta só o
`maxDuration` das funções. As fases foram escritas de forma agnóstica: o
`vercel.json` declara `maxDuration` explicitamente e a Fase 6 tem um passo de
**medir o tempo real** do job de sync antes de fixar o valor. Se o job estourar
o limite, a Fase 6 diz o que fazer — e esse "o que fazer" é um ponto de parada
para perguntar, não para improvisar.

### O que esta sprint NÃO faz

- **Não muda comportamento de negócio.** Nenhuma query, nenhum cálculo,
  nenhuma regra. Só a camada de infraestrutura/deploy. A única exceção
  autorizada são as Fases 7 e 8, que mudam *como o byte do arquivo chega ao
  servidor* — o resultado final (arquivo no UploadThing, URL no banco) é
  idêntico.
- **Não quebra `yarn dev`.** O fluxo local (Express + Vite na mesma porta,
  HMR, uma porta só) continua funcionando exatamente igual em todas as fases.
  Se depois de uma fase o `yarn dev` não sobe ou o HMR morreu, a fase está
  errada.
- **Não remove `mysql2`.** É limpeza de outra migração.
- **Não migra para Next.js.** O client continua sendo SPA Vite + wouter.
- **Não toca em `drizzle/schema.ts`.** Nenhuma migração de banco nesta sprint.

---

## Regras de ouro (valem para todas as fases)

1. **Uma fase = um commit.** Mensagem no padrão do repo:
   `chore(deploy): <o que fez> (sprint vercel, fase N)`.
2. **`yarn dev` é sagrado.** Toda fase termina com `yarn dev` subindo e a
   aplicação abrindo no browser. Não vale "quebrou o dev mas o deploy
   funciona".
3. **Nada de `import` de Vite fora do caminho de dev.** O arquivo
   `server/_core/vite.ts` importa `vite` e o `vite.config.ts` inteiro. Se ele
   for parar na árvore de imports da função serverless, o bundle da função
   estoura e o build quebra. A Fase 1 estabelece a fronteira; as fases
   seguintes **não podem** atravessá-la.
4. **Não crie variável de ambiente nova sem registrar** no `.env.example`
   **e** na tabela da Fase 8.
5. **Segredo nunca vai pro client.** Nada de `VITE_` em chave de API. O
   client só recebe o que já recebe hoje.
6. **Nunca use `git checkout --`, `git reset --hard` ou `git clean`** para
   "desfazer" um passo. Se errou, corrija editando.
7. **Não formate arquivo inteiro.** Rodar `yarn format` num arquivo grande
   gera um diff impossível de revisar. Edite só o trecho alvo.
8. **Se uma fase exigir decisão de arquitetura que não está na tabela de
   "Decisões já tomadas" acima — pare e pergunte.**

## Verificação (rode ao fim de toda fase, sem exceção)

```bash
yarn run check    # tsc --noEmit — precisa do "run"! (ver AGENTS.md)
yarn test         # vitest run
yarn build        # o build precisa passar
yarn dev          # tem que subir e abrir no browser (regra de ouro 2)
```

`yarn run check` é o portão mais importante: quase todo erro desta sprint
(import quebrado ao mover código, tipo de handler errado, driver com
assinatura diferente) aparece ali.

A partir da Fase 3 existe um segundo portão, o build da própria Vercel:

```bash
npx vercel build      # reproduz o build da Vercel localmente, sem deployar
```

Cada fase diz qual dos dois usar.

## Meta da sprint

| Métrica | Antes | Meta |
|---|---|---|
| `server.listen()` no caminho de produção | 1 | 0 |
| Pool TCP persistente por invocação | sim | não (Neon serverless) |
| Estado in-process necessário para correção | rate limiter | nenhum |
| Agendador do CRON | nenhum (endpoint órfão) | QStash |
| Teto de upload em produção | ~3.3 MB (quebrado) | limite do UploadThing |
| Deploy na Vercel | impossível | `git push` → preview |
