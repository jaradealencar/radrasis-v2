# Fase 3 — `vercel.json`, rewrites e scripts de build

**Depende de:** Fase 1 (precisa do `api/index.ts` existindo).
**As fases 5 e 6 assumem que esta já saiu.** Faça-a cedo.

## Objetivo

Hoje um único processo Express serve **as duas coisas**: a API e os arquivos
do client. Na Vercel isso vira duas coisas separadas, e essa separação é o
ponto inteiro desta fase:

| O quê | Onde vive na Vercel | Quem constrói |
|---|---|---|
| `client/` compilado | CDN estática (`dist/public`) | `vite build` |
| `api/index.ts` | Função serverless | Runtime Node da Vercel, automático |

O `serveStatic` de `server/_core/vite.ts` **deixa de ter papel em produção na
Vercel** — quem serve o HTML/JS/CSS é a CDN. Mas ele continua existindo e
sendo usado pelo `yarn start` local, que não morre nesta sprint.

Ao fim desta fase o projeto está *deployável*. Ele ainda pode ter bugs de
runtime em auth (Fase 5) e o cron ainda não tem agendador (Fase 6) — mas
`vercel build` passa e o site sobe.

---

## 3.1 — Criar `vercel.json` na raiz

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "buildCommand": "yarn build:client",
  "outputDirectory": "dist/public",
  "functions": {
    "api/index.ts": {
      "maxDuration": 60
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

Linha a linha, porque cada uma resolve um problema específico:

- **`"framework": null`** — impede a Vercel de auto-detectar o preset "Vite" e
  sobrescrever `buildCommand`/`outputDirectory` com os defaults dela. Aqui o
  `outDir` do Vite é `dist/public` (ver `vite.config.ts:167`), não o `dist/`
  que o preset esperaria.
- **`"buildCommand": "yarn build:client"`** — script novo, criado no passo 3.2.
  O `yarn build` atual roda `vite build && esbuild server/…`, e o esbuild do
  server **não serve para nada na Vercel** (a função é construída pelo runtime
  Node dela, a partir de `api/index.ts`). Rodar mesmo assim só queima minuto de
  build e pode falhar por motivo irrelevante.
- **`"functions"`** — declara `api/index.ts` como função e fixa o teto de
  duração. Ver a nota sobre `maxDuration` logo abaixo.
- **primeiro rewrite** — manda `/api/qualquer/coisa` para a função única. Sem
  ele, a Vercel só serviria `/api/index` e todas as rotas do Express
  (`/api/trpc/…`, `/api/auth/…`, `/api/scheduled/…`) dariam 404. **O Express
  continua recebendo a URL original**, então o roteamento interno dele não
  muda.
- **segundo rewrite** — fallback de SPA. É o equivalente do
  `app.use("*", → index.html)` do `serveStatic`. O `(?!api/)` é o que impede
  este rewrite de sequestrar as rotas de API — **não remova esse
  negative-lookahead**, é o bug mais comum desta configuração.

> **Sobre `maxDuration: 60`.** O plano da Vercel ainda não foi definido (ver
> "Ponto ainda em aberto" no README da sprint). 60s é o valor que funciona no
> Pro e é o teto do Hobby em Fluid Compute. Se o deploy for recusado por causa
> deste número, **baixe para 10 e reporte** — não suba o plano por conta
> própria. A Fase 6 mede o tempo real do job de sync e é lá que este número é
> confirmado.

## 3.2 — Adicionar o script `build:client`

Em `package.json`, na seção `scripts`:

```diff
    "dev": "cross-env NODE_ENV=development tsx watch server/_core/index.ts",
    "build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
+   "build:client": "vite build",
    "start": "cross-env NODE_ENV=production node dist/index.js",
```

**Não altere o `build` existente.** Ele continua sendo o build "servidor Node
completo", usado por `yarn start` e pelo portão de verificação de todas as
fases desta sprint. `build:client` é um segundo caminho, não um substituto.

## 3.3 — Fixar a versão do Node

A Vercel escolhe a versão do Node pelo campo `engines` — sem ele, você pega o
default dela, que muda sem aviso. Em `package.json`, logo depois de
`"license"`:

```diff
    "license": "MIT",
+   "engines": {
+     "node": "22.x"
+   },
    "scripts": {
```

> Por que 22 e não 24: 22 é a versão LTS suportada pelo runtime Node da Vercel.
> O ambiente local do time roda 24, e o código não usa nada exclusivo de 24 —
> mas se `yarn run check` ou `yarn build` quebrar depois deste passo, é sinal
> de que usa. Nesse caso, reporte.

## 3.4 — Criar `.vercelignore` na raiz

Reduz o que sobe no deploy. Sem isso, `docs/` (megabytes de markdown e zips de
snapshot) e `.manus-logs/` vão junto a cada push.

```
node_modules
dist
docs
.manus-logs
attached_assets
drizzle/meta
scripts
server/__tests__
**/*.test.ts
**/*.test.tsx
```

> **Cuidado com `drizzle/`:** o `.vercelignore` acima ignora só
> `drizzle/meta` (metadados do drizzle-kit). O `drizzle/schema.ts` **precisa**
> subir — é importado por `server/_core/auth.ts` e por `server/db/db.ts`. Não
> generalize essa linha para `drizzle`.
>
> **Cuidado com `scripts/`:** só é seguro ignorar porque nada em `server/`
> importa de lá. Confirme antes:
> `grep -rn "from \"\.\./\.\./scripts\|from '../../scripts" server/` tem que
> devolver zero.

## 3.5 — Ignorar artefatos da Vercel no git

Em `.gitignore`, na seção "Build outputs":

```diff
  # Build outputs
  dist/
  build/
  *.dist
+ .vercel/
```

---

## Armadilhas conhecidas

- **`dist/public` versus `dist/`.** O `vite.config.ts` manda o build para
  `dist/public` (`outDir` na linha 167) e o esbuild do server manda para
  `dist/`. Se `outputDirectory` no `vercel.json` apontar para `dist`, a
  Vercel serve o bundle do *servidor* como se fosse site estático e você
  recebe 404 em tudo. É `dist/public`.
- **Não adicione `"builds"` no `vercel.json`.** É a API antiga; usá-la
  desativa `buildCommand`, `outputDirectory` e `functions` de uma vez, e o
  sintoma (build "passa" mas o site não existe) é confuso de diagnosticar.
- **`patch-package` roda sozinho.** O `postinstall` do `package.json` chama
  `patch-package`, que está em `devDependencies` — e a Vercel instala
  devDependencies durante o build. O patch de `wouter` é aplicado
  normalmente. Não mova `patch-package` para `dependencies`.
- **Variáveis de ambiente ainda não foram configuradas.** Esta fase faz o
  build passar; o *runtime* vai falhar por falta de `DATABASE_URL` e
  companhia até a Fase 8. Isso é esperado.

## Verificação

O portão desta fase é diferente das outras — é reproduzir o build da Vercel
localmente, sem deployar nada:

```bash
yarn run check
yarn test
yarn build          # o build "clássico" continua tendo que passar
npx vercel build    # NOVO: reproduz o build da Vercel
```

`npx vercel build` vai pedir para vincular o projeto na primeira vez. Ao
terminar, confira que ele produziu as duas metades:

```bash
ls .vercel/output/static/index.html      # o client estático
ls .vercel/output/functions/api          # a função serverless
```

Se `functions/api` não existir, a Vercel não reconheceu `api/index.ts` como
função — quase sempre é a pasta `api/` no lugar errado (tem que ser na raiz)
ou o `.vercelignore` excluindo ela sem querer.

E, como sempre:

```bash
yarn dev            # tem que continuar subindo igual (regra de ouro 2)
```

## Definição de pronto

- [ ] `vercel.json` criado, com os dois rewrites (incluindo o `(?!api/)`)
- [ ] `outputDirectory` apontando para `dist/public`
- [ ] Script `build:client` adicionado; `build` original intacto
- [ ] `engines.node` fixado em `package.json`
- [ ] `.vercelignore` criado; `drizzle/schema.ts` **não** está ignorado
- [ ] `.vercel/` no `.gitignore`
- [ ] `npx vercel build` passa e gera `static/index.html` **e** `functions/api`
- [ ] `yarn run check`, `yarn test`, `yarn build`, `yarn dev` OK
- [ ] Commit: `chore(deploy): adiciona vercel.json, rewrites e build do client (sprint vercel, fase 3)`
