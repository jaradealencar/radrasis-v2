# Fase 5 — Better Auth e tRPC em ambiente serverless

**Depende de:** Fase 1 (edita `server/_core/app.ts`) e Fase 3 (o `vercel.json`
precisa existir para o teste desta fase).
**Faça antes da Fase 6.**

## Objetivo

Esta é a fase com mais risco real da sprint. São dois problemas concretos, e
nenhum dos dois aparece no `yarn run check` — os dois só aparecem em runtime,
e só na Vercel:

**Problema 1 — a `baseURL` do Better Auth é fixa.** `server/_core/auth.ts:20`
faz `baseURL: process.env.BETTER_AUTH_URL`. Na Vercel a URL muda: produção tem
o domínio final, e **cada deploy de preview tem uma URL própria e nova**. Com
a `baseURL` errada, o Better Auth rejeita as requisições por origem inválida e
monta os links/cookies apontando para o lugar errado.

**Problema 2 — o body já vem consumido.** O comentário em
`server/_core/app.ts` (herdado do `index.ts` original) explica que
`toNodeHandler(auth)` precisa vir **antes** do `express.json()`, porque o
handler do Better Auth lê o corpo direto do stream. Só que o runtime Node da
Vercel **já leu esse stream** antes de invocar a função: ele entrega
`req.body` pronto e o stream vazio. Resultado: `toNodeHandler` fica esperando
um corpo que nunca vem, e a requisição de login pendura até o timeout.

Este é o modo de falha mais traiçoeiro da migração inteira, porque **funciona
perfeitamente em local** e falha só depois do deploy.

**tRPC não tem nenhum dos dois problemas:** o `createExpressMiddleware` usa
`req.body` quando ele já existe. Esta fase só o *verifica*, não o altera. E
não há streaming em lugar nenhum do projeto (sem subscriptions, sem SSE, sem
`stream: true` no OpenAI), então o modelo request/response da Vercel serve.

---

## 5.1 — `baseURL` dinâmica em `server/_core/auth.ts`

A Vercel injeta `VERCEL_URL` (o host daquele deploy específico, **sem**
esquema) em runtime. Use-a como fallback quando `BETTER_AUTH_URL` não estiver
definida.

No topo de `server/_core/auth.ts`, depois dos imports e antes de
`const db = drizzle(getPool());`:

```ts
/**
 * URL base do Better Auth.
 *
 * - Local e produção: `BETTER_AUTH_URL` explícita (é o domínio final, estável).
 * - Preview na Vercel: cada deploy ganha um host novo em `VERCEL_URL`, então
 *   não dá para fixar por variável — derivamos dele.
 *
 * Se as duas faltarem, `undefined` faz o Better Auth inferir a URL a partir
 * dos headers da requisição. Funciona, mas é o caminho menos previsível —
 * por isso `BETTER_AUTH_URL` está na tabela obrigatória da Fase 8.
 */
function resolveBaseURL(): string | undefined {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return undefined;
}
```

E na chamada de `betterAuth({...})`:

```diff
    secret: process.env.BETTER_AUTH_SECRET,
-   baseURL: process.env.BETTER_AUTH_URL,
+   baseURL: resolveBaseURL(),
+   // Deploys de preview: cada um tem host próprio, e o Better Auth barra
+   // origem que não conhece. `baseURL` já entra na lista automaticamente;
+   // isto cobre o caso de a requisição chegar pelo domínio de produção
+   // enquanto a função roda num deploy de preview.
+   trustedOrigins: [
+     ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
+     ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
+   ],
```

**Não toque em mais nada deste arquivo.** Os plugins `admin`/`username`, o
hash bcrypt e o `cookiePrefix: "radrasys"` ficam exatamente como estão — são
regra de negócio/compatibilidade de dados, fora do escopo desta sprint.

> **O client não precisa de mudança.** `client/src/lib/auth-client.ts` chama
> `createAuthClient({ plugins: [...] })` sem `baseURL`, o que faz o SDK usar
> a origem da própria página. Como a API é servida no mesmo domínio (via
> rewrite do `vercel.json`), isso já está certo em preview e em produção.
> **Não adicione `baseURL` nem `VITE_` nenhuma ali.**

## 5.2 — Criar `server/_core/auth-web-handler.ts`

Este é o adaptador que resolve o Problema 2. Em vez de ler o stream (que na
Vercel já foi consumido), ele monta um `Request` da Web API a partir do que o
Express tem em mãos e chama `auth.handler()` — a interface web-standard do
Better Auth, que é a mesma coisa que o `toNodeHandler` embrulha.

Crie o arquivo:

```ts
import type { Request, Response } from "express";
import { auth } from "./auth";

/**
 * Adaptador do Better Auth para ambiente serverless.
 *
 * Em servidor Node tradicional usamos `toNodeHandler(auth)`, que lê o corpo
 * direto do stream da requisição — por isso ele é montado ANTES do
 * `express.json()`.
 *
 * Na Vercel isso não funciona: o runtime já consumiu o stream e entrega o
 * corpo pronto em `req.body`. O `toNodeHandler` ficaria esperando bytes que
 * nunca chegam e a requisição penduraria até o timeout.
 *
 * Aqui invertemos: deixamos o `express.json()` rodar primeiro e
 * reconstruímos um `Request` web a partir de `req.body`, entregando ao
 * `auth.handler()` — a mesma interface que o `toNodeHandler` embrulha.
 */
export async function authWebHandler(req: Request, res: Response) {
  const host = req.get("host") ?? "localhost";
  const url = new URL(req.originalUrl, `${req.protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  // O corpo é reserializado abaixo, então o content-length original não vale
  // mais — deixar o antigo faz o fetch interno truncar ou rejeitar.
  headers.delete("content-length");

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (typeof req.body === "string") {
      body = req.body;
    } else if (req.body != null && Object.keys(req.body).length > 0) {
      body = JSON.stringify(req.body);
      headers.set("content-type", "application/json");
    }
  }

  const response = await auth.handler(
    new Request(url.toString(), { method: req.method, headers, body })
  );

  res.status(response.status);

  // Set-Cookie é o único header que pode repetir; `getSetCookie()` devolve
  // todos separados. Colapsar em string única quebraria o login.
  const setCookie = response.headers.getSetCookie();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });
  if (setCookie.length > 0) res.setHeader("set-cookie", setCookie);

  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}
```

## 5.3 — Escolher o handler por ambiente em `server/_core/app.ts`

A ordem dos middlewares muda entre os dois ambientes, e é isso que o bloco
abaixo expressa. Substitua o trecho que hoje vai do comentário
`// ── Better Auth ──` até `app.use(express.urlencoded(...))` por:

```ts
  // ── Better Auth + body parser ─────────────────────────────────────────────
  // A ordem entre os dois é INVERTIDA entre os ambientes, de propósito:
  //
  // • Node tradicional: `toNodeHandler` lê o corpo do stream, então precisa
  //   vir ANTES do express.json() — se o parser rodar primeiro, o client do
  //   Better Auth fica pendurado em "pending".
  //
  // • Serverless (Vercel): o runtime já consumiu o stream antes de invocar a
  //   função. O `toNodeHandler` esperaria para sempre. Então deixamos o
  //   parser rodar primeiro e reconstruímos o Request web a partir de
  //   req.body (ver ./auth-web-handler).
  //
  // Não "simplifique" isto para um caminho só sem testar OS DOIS ambientes.
  if (IS_SERVERLESS) {
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

    const { authWebHandler } = await import("./auth-web-handler");
    app.all("/api/auth/*", authWebHandler);
  } else {
    app.all("/api/auth/*", toNodeHandler(auth));

    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));
  }
```

`IS_SERVERLESS` já existe se a Fase 4 saiu antes. **Se a Fase 4 ainda não
saiu**, adicione a constante agora, no topo do arquivo (é a mesma linha, o
código não conflita):

```ts
const IS_SERVERLESS = process.env.VERCEL === "1";
```

## 5.4 — Verificar o tRPC (sem alterar nada)

O `createExpressMiddleware` do tRPC lê `req.body` quando ele já está
parseado — que é exatamente o caso nos dois caminhos acima. **Nenhuma
mudança de código é necessária aqui.** O que esta fase exige é a
*verificação*, no passo de teste abaixo.

Dois pontos para conferir e não perder de vista:

- **`superjson` continua funcionando.** Ele é o transformer configurado em
  `server/_core/trpc.ts`; opera sobre o objeto já parseado, não sobre o
  stream. `Date`/`Map` continuam atravessando o wire.
- **Batching gera URL longa em queries GET.** O `httpBatchLink`
  (`client/src/main.tsx:32`) junta várias queries numa URL só. A Vercel aceita
  até 14 KB de URL. Nenhuma tela do projeto chega perto disso hoje, mas se
  alguma página começar a dar 414 depois do deploy, é aqui que se olha.

## 5.5 — Registrar `BETTER_AUTH_URL` no `.env.example`

O comentário atual (`# Better Auth (Fase 3 da migração — local-only)`) ficou
desatualizado. Atualize:

```diff
- # Better Auth (Fase 3 da migração — local-only)
+ # Better Auth. BETTER_AUTH_URL é a URL pública do app, COM esquema e SEM
+ # barra no fim. Em deploy de preview na Vercel pode ficar vazia — o código
+ # cai no fallback de VERCEL_URL (ver server/_core/auth.ts).
  BETTER_AUTH_SECRET=
  BETTER_AUTH_URL=http://localhost:3000
```

---

## Armadilhas conhecidas

- **`Set-Cookie` colapsado é o bug clássico deste adaptador.** O Better Auth
  emite mais de um `Set-Cookie` no login. Se você usar
  `headers.forEach` sem tratar esse header à parte, os cookies viram uma
  string única separada por vírgula e o browser descarta — o login "funciona"
  (200) mas a sessão não persiste. O `getSetCookie()` no 5.2 é o que evita
  isso. **Não refatore aquele trecho.**
- **`VERCEL_URL` não tem esquema.** Vem `meu-app-abc123.vercel.app`, sem
  `https://`. Concatenar sem o esquema produz uma URL inválida silenciosamente.
- **Não remova o `toNodeHandler`** nem o import dele. Ele continua sendo o
  caminho local.
- **Não mude o `cookiePrefix`.** Mudar invalida a sessão de todo mundo que já
  está logado.
- **Sessão não persiste entre invocações — e não precisa.** A sessão do Better
  Auth vive no banco + cookie, não em memória. Não há nada a "resolver" aqui;
  se alguém propuser cache de sessão em variável de módulo, é regressão.

## Verificação

```bash
yarn run check
yarn test
yarn build
```

**Teste 1 — local, caminho tradicional (não pode ter regressão):**

```bash
yarn dev
```

Faça login pela UI, navegue para uma página com dados, dê refresh (a sessão
tem que sobreviver), e faça logout. Tudo tem que funcionar como antes.

**Teste 2 — local, simulando o caminho serverless:**

```bash
VERCEL=1 yarn dev
```

Repita **o mesmo roteiro**: login, navegar, refresh, logout. Este teste é o
que valida o `auth-web-handler`. Preste atenção especial ao **refresh depois
do login** — é ali que um `Set-Cookie` mal propagado aparece.

> Se o login pendurar sem responder neste teste, o problema é ordem de
> middleware (o `toNodeHandler` ficou no caminho). Se responder 200 mas o
> refresh cair para a tela de login, é o `Set-Cookie`.

**Teste 3 — deploy de preview de verdade (o único que fecha a fase):**

```bash
npx vercel        # deploy de preview; anote a URL que ele imprime
```

Na URL do preview: login, refresh, uma página com dados (prova que o tRPC
respondeu), logout. Configure as variáveis de ambiente pelo painel se o
deploy reclamar — a lista completa está na Fase 8, aqui basta
`DATABASE_URL`, `BETTER_AUTH_SECRET` e `JWT_SECRET`.

> **Não faça deploy de produção nesta fase.** Preview só.

## Definição de pronto

- [ ] `resolveBaseURL()` + `trustedOrigins` em `server/_core/auth.ts`
- [ ] `server/_core/auth-web-handler.ts` criado, com tratamento de
      `getSetCookie()`
- [ ] `server/_core/app.ts` escolhendo o handler por `IS_SERVERLESS`, com a
      ordem de body parser invertida em cada caminho
- [ ] `client/src/lib/auth-client.ts` **não** foi alterado
- [ ] `.env.example` com o comentário atualizado de `BETTER_AUTH_URL`
- [ ] Teste 1 (`yarn dev`): login, refresh, tRPC, logout OK
- [ ] Teste 2 (`VERCEL=1 yarn dev`): login, refresh, tRPC, logout OK
- [ ] Teste 3 (preview na Vercel): login, refresh, tRPC, logout OK
- [ ] `yarn run check`, `yarn test`, `yarn build` passando
- [ ] Commit: `chore(deploy): adapta Better Auth e valida tRPC para serverless (sprint vercel, fase 5)`
