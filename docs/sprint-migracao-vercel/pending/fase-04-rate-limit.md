# Fase 4 — Rate limiting: tirar do caminho serverless e documentar

**Depende de:** Fase 1 (edita `server/_core/app.ts`).
**Independente das fases 2, 3, 5, 6 e 7.**

## Objetivo

`express-rate-limit` guarda os contadores num `MemoryStore` dentro do
processo. Isso é correto num servidor único e de vida longa. Em serverless é
**pior do que não ter nada**:

- cada instância tem o próprio contador, então o limite real vira
  `300 × número de instâncias vivas` — um número que ninguém controla;
- uma instância fria começa com contador zerado, o que dá ao atacante um
  reset grátis a cada cold start;
- o limite de login (10/min), que é o que de fato importa contra
  brute-force, é o mais fácil de furar assim — basta forçar instâncias novas.

Ou seja: o middleware daria uma **falsa sensação de proteção**. A decisão
tomada (ver README da sprint) foi **remover do caminho serverless e
documentar a limitação** — sem Redis, sem dependência nova, sem serviço
externo.

O que esta fase **não** faz: remover o rate limiting do servidor Node
tradicional. `yarn dev` e `yarn start` continuam com ele funcionando
exatamente como hoje, porque ali o `MemoryStore` faz sentido.

---

## 4.1 — Detectar o ambiente serverless em `server/_core/app.ts`

A Vercel define `process.env.VERCEL = "1"` em build e em runtime, em todos os
ambientes (produção e preview). É o sinal mais confiável e não exige variável
nova.

No topo de `server/_core/app.ts`, logo depois dos imports:

```ts
/**
 * `true` quando o app está rodando como função serverless na Vercel.
 *
 * A Vercel define VERCEL=1 em runtime, em produção e em preview. Usamos isso
 * para desligar middlewares que dependem de estado in-process — hoje só o
 * rate limiting (ver bloco abaixo).
 */
const IS_SERVERLESS = process.env.VERCEL === "1";
```

## 4.2 — Envolver os limiters no guard

Substitua o bloco inteiro de rate limiting de `createApp()` (o que hoje vai do
comentário `// ── Segurança: Rate Limiting ──` até
`app.use("/api/auth/sign-up", loginLimiter);`) por:

```ts
  // ── Segurança: Rate Limiting ──────────────────────────────────────────────
  // Só no servidor Node de vida longa (yarn dev / yarn start).
  //
  // O `express-rate-limit` conta requisições num MemoryStore dentro do
  // processo. Em serverless cada instância teria o seu próprio contador, o
  // limite efetivo viraria "300 × instâncias vivas" e todo cold start daria
  // um reset grátis — proteção nenhuma, com a aparência de proteção. Pior
  // que não ter.
  //
  // ⚠️ CONSEQUÊNCIA ACEITA E CONHECIDA: na Vercel a API roda SEM rate
  // limiting de aplicação. A proteção que resta é a mitigação de DDoS nativa
  // da plataforma (camada de rede) e, no login, o próprio Better Auth. Se
  // isso deixar de ser aceitável, a saída é um store distribuído (Redis) ou
  // regra de firewall na Vercel — nenhuma das duas está no escopo desta
  // sprint. Ver docs/sprint-migracao-vercel/README.md.
  if (!IS_SERVERLESS) {
    // Limite geral: 300 requisições por minuto por IP (proteção contra DDoS/scraping)
    const generalLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Muitas requisições. Tente novamente em alguns instantes." },
      skip: (req) => req.path.startsWith("/__manus__"), // Não limitar ferramentas internas
    });
    app.use("/api", generalLimiter);

    // Limite estrito para login: 10 tentativas por minuto por IP (proteção contra brute-force)
    const loginLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Muitas tentativas de login. Aguarde 1 minuto e tente novamente." },
    });
    app.use("/api/auth/sign-in", loginLimiter);
    app.use("/api/auth/sign-up", loginLimiter);
  }
```

Os valores (`300`, `10`, `60 * 1000`), o `skip` e as mensagens em português
são **os mesmos de hoje** — só ganharam um `if` em volta e mais dois níveis de
indentação. Se algum número mudou, o diff está errado.

> **Mantenha o import de `rateLimit`.** Ele continua sendo usado dentro do
> `if`. E **não remova `express-rate-limit` do `package.json`** — a dependência
> continua ativa no caminho local.

## 4.3 — Manter o `trust proxy`

`app.set("trust proxy", 1)` está logo acima do bloco que você acabou de
alterar. **Não mexa nele.** Embora o comentário original mencione rate
limiting, ele também é o que faz `req.ip` e `req.protocol` funcionarem atrás
do proxy da Vercel — o que importa para logs e para o Better Auth. Só atualize
o comentário:

```diff
- // Confiar no proxy reverso (necessário para rate limiting correto em produção)
+ // Confiar no proxy reverso: faz req.ip / req.protocol refletirem o cliente
+ // real por trás do proxy (Vercel em produção, qualquer reverse proxy no
+ // deploy Node tradicional).
  app.set("trust proxy", 1);
```

## 4.4 — Registrar a limitação no `AGENTS.md`

A seção **"Pontas soltas conhecidas"** do `AGENTS.md` é onde o projeto já
guarda esse tipo de dívida assumida. Acrescente um item no fim da lista
(antes da seção `## Patches`):

```markdown
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
```

---

## Armadilhas conhecidas

- **Não troque `process.env.VERCEL` por `NODE_ENV === "production"`.** São
  coisas diferentes: `yarn start` local também roda em produção e *deve*
  manter o rate limiting.
- **Não crie uma variável de ambiente nova para isso.** `VERCEL` já é
  injetada pela plataforma; inventar `IS_SERVERLESS=true` só adicionaria mais
  uma coisa para alguém esquecer de configurar.
- **Não substitua por um limiter "caseiro" com `Map` no escopo do módulo.**
  Tem exatamente o mesmo problema do MemoryStore, com a agravante de ser
  código novo para manter.

## Verificação

```bash
yarn run check
yarn test
yarn build
yarn dev
```

Com `yarn dev` de pé, prove que o rate limiting **continua ligado** localmente:

```bash
# 12 tentativas de login seguidas — as últimas têm que dar 429
for i in $(seq 1 12); do \
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/api/auth/sign-in/email \
    -H "Content-Type: application/json" \
    -d '{"email":"nao-existe@teste.com","password":"errado"}'; \
done
```

Esperado: os primeiros retornos são 4xx de credencial inválida e, a partir da
11ª, **429**. Se nenhum 429 aparecer, o `if` está errado (provavelmente
`VERCEL` definido no `.env` local — confira).

E prove que **desliga** em modo serverless:

```bash
VERCEL=1 yarn dev
# repita o loop acima — agora nenhum 429, todos 4xx de credencial
```

> Este segundo teste é o único momento da sprint em que se roda `yarn dev` com
> `VERCEL=1`. Não deixe essa variável no `.env`.

## Definição de pronto

- [ ] `IS_SERVERLESS` definido em `server/_core/app.ts`
- [ ] Bloco de rate limiting envolvido em `if (!IS_SERVERLESS)`, com os
      valores originais preservados
- [ ] Comentário explicando a consequência aceita, no código
- [ ] `app.set("trust proxy", 1)` mantido, comentário atualizado
- [ ] `express-rate-limit` **ainda** no `package.json`
- [ ] Item novo em "Pontas soltas conhecidas" do `AGENTS.md`
- [ ] Teste dos 429: aparecem sem `VERCEL=1`, somem com `VERCEL=1`
- [ ] `yarn run check`, `yarn test`, `yarn build`, `yarn dev` OK
- [ ] Commit: `chore(deploy): desativa rate limiting em memória no caminho serverless (sprint vercel, fase 4)`
