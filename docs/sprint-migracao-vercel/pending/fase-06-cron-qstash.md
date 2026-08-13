# Fase 6 — CRON de sincronização de OS via Upstash QStash

**Depende de:** Fase 1, Fase 3 (precisa do `vercel.json`) e Fase 5 (o preview
precisa estar de pé para o teste).
**Idealmente depois da Fase 2** — ela muda a latência de cada query, que é
justamente o que esta fase mede.

## Objetivo

O endpoint `POST /api/scheduled/sincronizarOS` existe e funciona, mas hoje
**nada o chama**: não há agendador nenhum no repositório. Ele depende de algo
externo bater nele — e no servidor de longa duração esse "algo" nunca foi
configurado no código.

A decisão tomada (ver README da sprint) é **Upstash QStash** como agendador,
não Vercel Cron.

A boa notícia: o endpoint já foi desenhado para isso. Ele autentica por
segredo compartilhado no header (`x-cron-secret` comparado com
`CRON_SECRET`, em `server/sync/scheduled-sync-os-handler.ts:18-21`), e o
QStash sabe encaminhar headers customizados. **Então o código do handler não
muda.** Esta fase é 90% configuração e 10% medição.

A má notícia, e o motivo de esta fase ter um passo de medição obrigatório:
`sincronizarOSDoMubiSys()` itera as OS **em série**, fazendo de 2 a 3 queries
por OS (`SELECT` para checar existência, depois `UPDATE` ou `INSERT`). Depois
da Fase 2, cada uma dessas queries é uma requisição HTTP ao proxy do Neon.
Com 500 OS isso vira ~1.000 round trips sequenciais. **Pode estourar o
`maxDuration`.** Medir antes de agendar não é zelo, é requisito.

---

## 6.1 — Medir quanto tempo o job leva

Antes de qualquer configuração. Com o preview da Fase 5 no ar (ou localmente
com `yarn dev`, o que já dá uma ordem de grandeza):

```bash
time curl -s -X POST "https://SUA-URL-DE-PREVIEW.vercel.app/api/scheduled/sincronizarOS" \
  -H "x-cron-secret: $CRON_SECRET" \
  -o /tmp/sync-result.json -w "\nHTTP %{http_code}\n"

cat /tmp/sync-result.json
```

Anote **o tempo** e **`resultado.quantidadeOsImportadas`**. Três desfechos
possíveis:

| Tempo medido | O que fazer |
|---|---|
| < 30s | Siga. Mantenha `maxDuration: 60` no `vercel.json`. |
| 30–55s | Siga, mas **anote o número no commit**. Está apertado: o volume de OS cresce com o tempo. |
| > 55s, ou 504/timeout | **PARE.** Não configure o agendamento. Ver "Se o job não couber" abaixo. |

### Se o job não couber

Isto é uma decisão de arquitetura, e a regra de ouro 8 se aplica: **pare e
pergunte.** Não escolha sozinho. As opções, para você apresentar:

1. **Paralelizar as queries do loop** (processar em lotes de N OS com
   `Promise.all`). Mais rápido, mas mexe em lógica de sincronização — sai do
   "só infraestrutura" desta sprint.
2. **Quebrar em páginas**, com o QStash chamando o endpoint N vezes com um
   offset. Exige mudar a assinatura do handler.
3. **Subir `maxDuration`** (depende do plano da Vercel, que ainda está em
   aberto).
4. **Tirar o job da Vercel** e rodá-lo em outro lugar (GitHub Actions, uma
   VM). O QStash deixa de ser necessário.

## 6.2 — Fixar `maxDuration` com base na medição

Em `vercel.json`, o bloco `functions` já existe desde a Fase 3. Confirme que o
valor bate com o que você mediu e acrescente a justificativa:

```json
  "functions": {
    "api/index.ts": {
      "maxDuration": 60
    }
  },
```

E **não adicione a chave `"crons"`** ao `vercel.json`. O agendador é o QStash;
ter os dois configurados faria o job rodar em duplicidade.

## 6.3 — Criar o agendamento no QStash

Não é código — é uma chamada única à API do QStash. Precisa do `QSTASH_TOKEN`
(painel do Upstash → QStash → Details).

> **`QSTASH_TOKEN` não é variável de runtime da aplicação.** Ela só serve para
> *criar/gerenciar* agendamentos, a partir da sua máquina. **Não** a adicione
> às variáveis de ambiente da Vercel.

O truque que mantém o handler intacto é o prefixo `Upstash-Forward-`: tudo que
vem depois dele é repassado como header normal para o destino. Ou seja,
`Upstash-Forward-x-cron-secret` chega no Express como `x-cron-secret` — que é
exatamente o que o handler já espera.

```bash
curl -X POST "https://qstash.upstash.io/v2/schedules/https://SEU-DOMINIO.com/api/scheduled/sincronizarOS" \
  -H "Authorization: Bearer $QSTASH_TOKEN" \
  -H "Upstash-Cron: 0 6 * * *" \
  -H "Upstash-Forward-x-cron-secret: $CRON_SECRET" \
  -H "Upstash-Retries: 2"
```

- **`Upstash-Cron: 0 6 * * *`** — 06:00 **UTC**, ou seja 03:00 em
  Brasília (UTC−3). O job busca OS dos últimos 30 dias; rodar de madrugada
  evita competir com o uso do sistema. Ajuste se o time preferir outro
  horário, mas **lembre que a expressão é em UTC**.
- **`Upstash-Retries: 2`** — o QStash reentrega em caso de falha. Isso é
  seguro aqui: o job é idempotente (para cada OS ele faz `SELECT` e decide
  entre `UPDATE` e `INSERT`, ver `scheduled-sync-os.ts:78-133`), então rodar
  duas vezes produz o mesmo estado final. **Se algum dia o job deixar de ser
  idempotente, este header precisa ir para 0.**

Guarde o `scheduleId` que a resposta devolve — você vai precisar dele para
alterar ou remover o agendamento:

```bash
# listar agendamentos
curl -s "https://qstash.upstash.io/v2/schedules" -H "Authorization: Bearer $QSTASH_TOKEN"

# remover um agendamento
curl -X DELETE "https://qstash.upstash.io/v2/schedules/SCHEDULE_ID" \
  -H "Authorization: Bearer $QSTASH_TOKEN"
```

## 6.4 — Documentar o agendamento no repositório

Configuração que só existe no painel de um serviço externo é configuração que
se perde. Crie `docs/cron-qstash.md`:

```markdown
# CRON: sincronização de OS via Upstash QStash

O job `POST /api/scheduled/sincronizarOS` é agendado pelo **Upstash QStash**,
não pelo Vercel Cron. Não existe agendador dentro do repositório.

## Agendamento ativo

| Campo | Valor |
|---|---|
| Destino | `https://SEU-DOMINIO.com/api/scheduled/sincronizarOS` |
| Cron | `0 6 * * *` (06:00 UTC = 03:00 BRT) |
| Retries | 2 |
| Autenticação | header `x-cron-secret`, encaminhado pelo QStash via `Upstash-Forward-x-cron-secret` |
| Schedule ID | `<preencher com o id devolvido na criação>` |

## Tempo de execução medido

| Data | OS processadas | Duração |
|---|---|---|
| `<preencher>` | `<preencher>` | `<preencher>` |

`maxDuration` da função está em 60s (`vercel.json`). O job itera as OS em
série com 2–3 queries cada; se o volume de OS crescer, esta é a primeira
coisa a estourar. Refaça a medição periodicamente.

## Como alterar o agendamento

Precisa do `QSTASH_TOKEN` (painel do Upstash → QStash → Details). Ele **não**
é variável de runtime da aplicação e não deve estar configurado na Vercel.

Ver os comandos `curl` em
`docs/sprint-migracao-vercel/pending/fase-06-cron-qstash.md`.

## Status da última execução

`GET /api/scheduled/sincronizarOS/status` — não exige segredo, devolve o
resultado da última sincronização.
```

## 6.5 — Anotar `CRON_SECRET` no `.env.example`

A linha já existe; só o comentário desatualiza:

```diff
- # Segredo compartilhado pro endpoint de CRON (POST /api/scheduled/sincronizarOS)
+ # Segredo compartilhado do endpoint de CRON (POST /api/scheduled/sincronizarOS).
+ # Quem agenda é o Upstash QStash, que encaminha este valor como header
+ # `x-cron-secret`. Ver docs/cron-qstash.md.
  CRON_SECRET=
```

---

## Armadilhas conhecidas

- **A URL do destino no QStash é a de produção, não a de preview.** URLs de
  preview mudam a cada deploy; um agendamento apontando para uma delas para
  de funcionar sozinho. Configure o agendamento só depois de ter o domínio
  final (o que na prática significa: **depois da Fase 8**, mesmo que você
  escreva esta fase agora). Se precisar testar antes, faça um `publish` avulso
  ao preview em vez de um `schedule`.
- **Expressão cron em UTC.** `0 6 * * *` não é 6h da manhã no Brasil.
- **Sem `CRON_SECRET` configurado na Vercel, o endpoint devolve 403** — e o
  handler trata "segredo ausente" e "segredo errado" da mesma forma
  (`!cronSecret || req.headers[...] !== cronSecret`). Se o QStash reportar 403
  em série, a primeira hipótese é variável de ambiente faltando, não header
  errado.
- **Não adicione `@upstash/qstash` como dependência.** A verificação de
  assinatura do QStash (`Receiver`) seria uma proteção *adicional* à do
  `x-cron-secret`, mas trocaria configuração por código novo e uma
  dependência. Fora do escopo; se for desejável depois, é tarefa separada.
- **O endpoint de status é público.** `GET .../status` não checa segredo
  nenhum — já era assim antes desta sprint. Não é regressão, mas vale saber.

## Verificação

```bash
yarn run check
yarn test
yarn build
yarn dev
```

Nenhum código de aplicação mudou nesta fase (só `vercel.json` e documentação),
então os portões acima são formalidade. O teste real é o comportamental:

1. **Chamada manual autenticada** (passo 6.1) devolve `{ ok: true, resultado:
   {...} }` e um tempo dentro do orçamento.
2. **Chamada sem o header** devolve **403**:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST \
     "https://SUA-URL/api/scheduled/sincronizarOS"
   # esperado: 403
   ```
3. **Status** responde:
   ```bash
   curl -s "https://SUA-URL/api/scheduled/sincronizarOS/status"
   ```
4. **Primeira execução agendada.** No painel do QStash → Events, confirme uma
   entrega com status `DELIVERED` no horário previsto. Se o agendamento
   estiver marcado para as 03:00 BRT, isso significa **conferir no dia
   seguinte** — a fase só fecha depois disso. Para não travar a sprint, é
   aceitável fechar o commit e deixar este item como verificação pendente
   registrada no `docs/cron-qstash.md`.

## Definição de pronto

- [ ] Tempo de execução do job medido e anotado
- [ ] `maxDuration` do `vercel.json` compatível com o tempo medido
- [ ] `vercel.json` **sem** a chave `"crons"`
- [ ] Agendamento criado no QStash com `Upstash-Forward-x-cron-secret`
- [ ] `scheduleId` guardado
- [ ] `docs/cron-qstash.md` criado e preenchido (sem `<preencher>` sobrando,
      exceto o item de execução agendada se ainda estiver pendente)
- [ ] `.env.example` com o comentário atualizado de `CRON_SECRET`
- [ ] Chamada sem header devolve 403
- [ ] Commit: `chore(deploy): agenda sync de OS via Upstash QStash (sprint vercel, fase 6)`
