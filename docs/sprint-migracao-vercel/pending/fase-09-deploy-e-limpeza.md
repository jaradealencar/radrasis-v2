# Fase 9 — Variáveis de ambiente, deploy de produção e fechamento

**Depende de:** todas as fases anteriores (1–8).
**É a última.** Não comece se alguma fase anterior estiver aberta.

## Objetivo

Configurar as variáveis de ambiente na Vercel, fazer o primeiro deploy de
produção, rodar um smoke test que exercite todos os caminhos que a sprint
tocou, e atualizar a documentação do repositório para refletir a realidade
nova.

Esta fase é a única que produz um efeito **externo e visível** — o app no ar,
num domínio real. Trate a ordem dos passos como obrigatória: variáveis antes
do deploy, deploy antes do smoke test, smoke test antes do agendamento do
cron.

---

## 9.1 — Configurar as variáveis de ambiente

No painel da Vercel (Project → Settings → Environment Variables), ou via CLI
(`npx vercel env add NOME production`).

Configure para **Production** *e* **Preview** — deploy de preview sem banco não
serve para testar nada.

| Variável | Obrigatória | Observação |
|---|---|---|
| `DATABASE_URL` | **sim** | String do Neon. O driver serverless (Fase 2) usa a mesma de sempre |
| `BETTER_AUTH_SECRET` | **sim** | Sem ela a sessão não é assinada |
| `BETTER_AUTH_URL` | **sim (produção)** | Domínio final, com `https://` e **sem barra no fim**. Em Preview pode ficar vazia: o código cai no fallback de `VERCEL_URL` (Fase 5) |
| `JWT_SECRET` | **sim** | `ENV.cookieSecret` em `server/_core/env.ts` |
| `UPLOADTHING_TOKEN` | **sim** | Usado tanto pela `UTApi` quanto pelo file router (Fase 7) |
| `CRON_SECRET` | **sim** | O QStash encaminha este valor (Fase 6). Sem ela o endpoint devolve 403 |
| `MUBISYS_ACCESS_TOKEN` | **sim** | Sem ela o sync de OS falha |
| `MUBISYS_PUBLIC_KEY` | **sim** | idem |
| `OPENAI_API_KEY` | **sim** | Análise de currículo, extração de texto, sugestões |

**Não configure:**

- `PORT` — não existe `listen()` em serverless; a variável é ignorada.
- `NODE_ENV` — a Vercel define sozinha. Definir manualmente pode quebrar o
  build.
- `VERCEL` / `VERCEL_URL` — injetadas pela plataforma. Definir na mão
  atrapalha (`VERCEL` é o que liga o caminho serverless nas fases 4 e 5).
- `QSTASH_TOKEN` — só serve para *criar* agendamentos, a partir da sua
  máquina. Não é variável de runtime (Fase 6).

Confira o que ficou configurado:

```bash
npx vercel env ls
```

## 9.2 — Deploy de produção

```bash
npx vercel --prod
```

Se o build falhar, o problema é da Fase 3 e o log da Vercel diz onde. Se o
build passar e o site der erro **em runtime**, é quase sempre variável faltando
— confira em Deployments → o deploy → Functions → Logs.

## 9.3 — Smoke test

Cada item existe para exercitar uma fase específica. **Faça todos**, mesmo os
que parecem redundantes.

**Caminho estático (Fase 3)**

- [ ] A URL raiz carrega a SPA
- [ ] Navegar para uma rota interna e dar **F5** carrega a página (é o teste do
      rewrite de fallback; se der 404, o `(?!api/)` está errado)
- [ ] Um asset com hash (JS/CSS) carrega da CDN, não da função

**Autenticação (Fase 5)**

- [ ] Login com e-mail e senha
- [ ] Login por **username** (roles sem e-mail real, ex. produção/empacotamento)
- [ ] F5 depois de logado mantém a sessão
- [ ] Logout
- [ ] Rota protegida sem sessão redireciona para o login

**Banco (Fase 2)**

- [ ] Dashboard carrega (Drizzle)
- [ ] Empacotamento carrega (SQL cru via `selectQuery`)
- [ ] Uma mutation grava e o valor aparece após refresh (`mutationQuery`)
- [ ] Uma exclusão funciona (prova que `rowCount` chega certo)

**Uploads (Fases 7 e 8)**

- [ ] Upload de imagem > 5 MB numa tela qualquer
- [ ] Upload de PDF em Currículos, com a análise rodando
- [ ] Biblioteca de Arquivos: upload + texto extraído gravado

**CRON (Fase 6)**

- [ ] `POST /api/scheduled/sincronizarOS` com o header correto: `{ ok: true }`
- [ ] O mesmo POST **sem** o header: `403`
- [ ] `GET /api/scheduled/sincronizarOS/status` responde

**Rate limiting (Fase 4)**

- [ ] 12 tentativas de login seguidas **não** dão 429 (é o comportamento
      esperado e documentado em produção — se der 429, o guard
      `IS_SERVERLESS` não está pegando)

**Logs**

- [ ] Deployments → Functions → Logs não mostra erro não tratado nem
      `unhandled rejection`

## 9.4 — Agendar o cron apontando para produção

Só agora, com o domínio final no ar. Volte ao passo **6.3** da Fase 6 e crie o
agendamento no QStash usando a URL de produção. Preencha o `scheduleId` e a
medição de tempo em `docs/cron-qstash.md`.

> Se você já tinha criado um agendamento apontando para uma URL de preview
> durante a Fase 6, **apague-o agora** (`DELETE /v2/schedules/ID`). Preview
> morre; agendamento apontando para preview vira falha silenciosa diária.

## 9.5 — Reduzir o ruído de log do banco

`server/db/db-connection.ts` loga **três linhas por query** (`📝 SQL`,
`📝 Values`, `✅ Sucesso`). Num servidor local isso é útil; na Vercel vira
volume de log — e `Values` pode carregar dado sensível para dentro da
plataforma de observabilidade.

```diff
  export async function executeQuery(
    sql: string,
    values: any[] = []
  ): Promise<QueryResult> {
    const pool = getPool();

+   const verbose = process.env.NODE_ENV !== "production";
+
    try {
-     console.log('📝 [QUERY] SQL:', sql);
-     console.log('📝 [QUERY] Values:', values);
+     if (verbose) {
+       console.log('📝 [QUERY] SQL:', sql);
+       console.log('📝 [QUERY] Values:', values);
+     }

      const result = await pool.query(toPgPlaceholders(sql), values);

-     console.log('✅ [QUERY] Sucesso');
+     if (verbose) console.log('✅ [QUERY] Sucesso');
      return result;
    } catch (error) {
      console.error('❌ [QUERY] Erro:', error);
      throw error;
    }
  }
```

**O `console.error` do catch fica.** Erro de query em produção é exatamente o
que você quer ver no log.

## 9.6 — Criar `docs/deploy-vercel.md`

O documento de referência de quem for mexer nisso depois. A sprint em si
(`docs/sprint-migracao-vercel/`) descreve *como se chegou aqui*; este descreve
*como está*.

```markdown
# Deploy na Vercel

O app roda na Vercel como **client estático + uma função serverless**.

| Parte | Onde | Construído por |
|---|---|---|
| SPA (`client/`) | CDN, a partir de `dist/public` | `yarn build:client` (`vite build`) |
| API (Express + tRPC + auth) | função serverless única, `api/index.ts` | runtime Node da Vercel |

`api/index.ts` importa `createApp()` de `server/_core/app.ts` — o mesmo app do
servidor local, sem `listen()`. Os rewrites de `vercel.json` mandam `/api/*`
para a função e todo o resto para `index.html` (fallback de SPA).

## O que muda entre serverless e servidor Node

`server/_core/app.ts` bifurca em `IS_SERVERLESS` (`process.env.VERCEL === "1"`):

| | Node tradicional | Vercel |
|---|---|---|
| Rate limiting | ativo (300/min; 10/min no login) | **desativado** — MemoryStore não funciona entre instâncias |
| Better Auth | `toNodeHandler`, antes do body parser | `authWebHandler`, depois do body parser (o runtime já consumiu o stream) |
| Client | servido pelo Express (`serveStatic`/`setupVite`) | servido pela CDN |

## Variáveis de ambiente

Ver a tabela na Fase 9 de `docs/sprint-migracao-vercel/`. Resumo do que **não**
se configura: `PORT`, `NODE_ENV`, `VERCEL*`, `QSTASH_TOKEN`.

## CRON

Agendado pelo Upstash QStash, não pelo Vercel Cron. Ver `docs/cron-qstash.md`.

## Uploads

Arquivos sobem **direto do browser para o UploadThing**
(`client/src/lib/upload.ts` + `server/_core/uploadthing.ts`), nunca pelo
payload do tRPC. Isso é obrigatório, não preferência: a Vercel limita o corpo
de requisição a 4.5 MB. O `express.json` está em `2mb` justamente para que
qualquer regressão apareça cedo.

## Deploy local do servidor Node continua funcionando

`yarn build && yarn start` sobem o Express tradicional servindo a SPA, como
antes da migração. Nada nesta sprint removeu esse caminho.
```

## 9.7 — Atualizar o `AGENTS.md`

Três pontos ficaram desatualizados. Corrija:

1. Na seção **"O que é este projeto"**, onde se lê que o client é "SPA servida
   pelo próprio Express": acrescente que **na Vercel** a SPA é servida pela CDN
   e o Express roda como função serverless, com ponteiro para
   `docs/deploy-vercel.md`.

2. Na seção **"Pontas soltas conhecidas"**, o item sobre o sync diz que
   `scheduled-sync-os-handler.ts` está "registrado em `server/_core/index.ts`".
   Depois da Fase 1 ele é registrado em **`server/_core/app.ts`**. Corrija a
   referência.

3. Na seção **"Gerenciador de pacotes"** (a lista de scripts), acrescente:

   ```
   yarn build:client  # só o client (Vite) — é o que a Vercel roda
   ```

> O item sobre rate limiting já foi acrescentado na Fase 4. Não duplique.

## 9.8 — Mover a sprint para `complete/`

Seguindo a convenção de `docs/sprint-refatoracao-pages/`:

```bash
git mv docs/sprint-migracao-vercel/pending/*.md docs/sprint-migracao-vercel/complete/
```

E atualize os links da tabela de índice do `README.md` da sprint, de
`pending/` para `complete/`.

---

## Armadilhas conhecidas

- **`BETTER_AUTH_URL` com barra no fim** quebra a validação de origem e o
  sintoma é login que dá 200 e não persiste. É o erro de configuração mais
  comum aqui.
- **Variável configurada só em Production.** O deploy de preview vira uma
  tela branca com 500 nas chamadas de API. Configure nos dois ambientes.
- **Não apague `server/_core/vite.ts` nem o script `start`.** O caminho de
  servidor Node tradicional continua suportado, e é o plano B se algo na
  Vercel se mostrar inviável.
- **Não remova `mysql2` neste commit.** É limpeza de outra migração
  (`docs/migracao-postgres-better-auth.md`), e misturar as duas coisas
  atrapalha o histórico.

## Verificação

```bash
yarn run check
yarn test
yarn build
yarn dev            # o caminho local tem que continuar de pé no fim de tudo
yarn start          # e o servidor Node tradicional também
```

Mais o smoke test do 9.3 **inteiro**, em produção.

## Definição de pronto

- [ ] Todas as variáveis da tabela 9.1 configuradas em Production e Preview
- [ ] `npx vercel --prod` concluído com sucesso
- [ ] Smoke test do 9.3 completo, todos os itens marcados
- [ ] Agendamento do QStash apontando para o domínio de produção; qualquer
      agendamento antigo apontando para preview foi removido
- [ ] `docs/cron-qstash.md` sem `<preencher>` sobrando
- [ ] Log de query silenciado em produção (9.5)
- [ ] `docs/deploy-vercel.md` criado
- [ ] `AGENTS.md` atualizado nos três pontos
- [ ] Arquivos da sprint movidos para `complete/` e índice do README corrigido
- [ ] `yarn dev` e `yarn start` funcionando localmente
- [ ] Commit: `chore(deploy): configura ambiente, publica na Vercel e documenta o deploy (sprint vercel, fase 9)`
