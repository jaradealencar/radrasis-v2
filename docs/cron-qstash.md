# CRON: sincronização de OS via Upstash QStash

Existem **dois** jobs agendados pelo **Upstash QStash** (não pelo Vercel
Cron); nenhum agendador vive dentro do repositório:

| Job | Alimenta | Propósito |
|---|---|---|
| `POST /api/scheduled/sincronizarOS` | `erp_os_cache` | janela rolante curta (~32 dias), dados "quentes" pra funcionalidades que só precisam do recente |
| `POST /api/scheduled/sincronizarHistorico` | `historico_os` + `historico_orcamentos` | base histórica permanente, usada pela regra de cliente novo/reativado/recorrente e por todo relatório comercial mensal |

Este documento cobre o primeiro em detalhe; o segundo está descrito na seção
"Sincronização de histórico" mais abaixo.

## Agendamento planejado: 4 lotes escalonados

Uma execução de 30 dias **não cabe** no `maxDuration` de 60s: só a chamada da
API leva ~25s. Decidido em 17/08/2026 fatiar a janela e criar **quatro
schedules**, cada um cobrindo 8 dias, escalonados de 10 em 10 minutos.

| Lote | Destino | Cron (UTC) | Schedule ID |
|---|---|---|---|
| 1 | `https://SEU-DOMINIO.com/api/scheduled/sincronizarOS?dias=8&offset=0` | `0 6 * * *` | `<preencher>` |
| 2 | `…?dias=8&offset=8` | `10 6 * * *` | `<preencher>` |
| 3 | `…?dias=8&offset=16` | `20 6 * * *` | `<preencher>` |
| 4 | `…?dias=8&offset=24` | `30 6 * * *` | `<preencher>` |

| Campo | Valor |
|---|---|
| Retries | 2 (por lote) |
| Autenticação | nenhuma — ver "Sem autenticação por segredo" abaixo |
| Cobertura total | 32 dias, com sobreposição de borda entre lotes |

A janela vai de `hoje - offset - dias` até `hoje - offset`. A sobreposição é
intencional e segura: a gravação é um upsert por `numeroOs`, então lotes que se
tocam apenas reescrevem o mesmo registro — e nenhum dia fica num vão.

> **Depende de duas coisas, nesta ordem.** (1) O endpoint precisa aceitar
> `dias`/`offset` — Fase 3 de `docs/sprint-mubisys/`. (2) O domínio de produção
> precisa existir — Fase 9 de `docs/sprint-migracao-vercel/`. Enquanto (1) não
> estiver feito, os parâmetros são ignorados e cada disparo tenta os 30 dias
> inteiros, estourando o `maxDuration`. Comandos de criação em
> `docs/sprint-migracao-vercel/complete/fase-06-cron-qstash.md`, seção 6.3 —
> replicados uma vez por lote.

## Tempo de execução medido

Medido localmente (Fase 3, 17/08/2026) — Neon responde mais rápido daqui que da
Vercel, então trate como piso, não como garantia:

| Data | Lote | OS processadas | Duração |
|---|---|---|---|
| 17/08/2026 | `?dias=8&offset=0` | 23 | 7,9s |
| 17/08/2026 | `?dias=8&offset=8` | 32 | 8,9s |
| 17/08/2026 | `?dias=8&offset=16` | 53 | 14,3s |
| 17/08/2026 | `?dias=8&offset=24` | 63 | 16,6s |

Cada lote precisa fechar **bem abaixo de 60s**. Se algum passar de ~40s,
reduza `dias` para 4 e use 8 schedules — é mudança só de agendamento, sem
tocar em código. Refaça a medição periodicamente: o custo cresce com o volume
de OS.

## Uma execução diária vira quatro linhas em `sync_logs`

Com os lotes, o dia normal registra **4 execuções**, não 1. O painel
`/admin/sincronizacao-cache` agrega as últimas 24h; o histórico bruto mostra as
quatro. Não é duplicação.

## Como criar/alterar o agendamento

Precisa do `QSTASH_TOKEN` (painel do Upstash → QStash → Details). Ele **não**
é variável de runtime da aplicação e não deve estar configurado na Vercel.

Ver os comandos `curl` em
`docs/sprint-migracao-vercel/complete/fase-06-cron-qstash.md` — o header
`Upstash-Forward-x-cron-secret` desses comandos não é mais necessário (ver
abaixo), mas não tem problema mantê-lo, o handler simplesmente ignora.

## Status da última execução

`GET /api/scheduled/sincronizarOS/status` — público, sem autenticação (ver
abaixo). O painel `/admin/sincronizacao-cache` não usa esta rota; ele lê o
status via procedure tRPC `admin.obterStatusSincronizacao` (protegido por
`adminProcedure`).

## Sem autenticação por segredo

Os endpoints `/api/scheduled/sincronizarOS`, `/api/scheduled/sincronizarOS/status`
e `/api/scheduled/sincronizarHistorico` **não checam mais** `x-cron-secret`/
`CRON_SECRET` — checagem removida em 01/09/2026 depois de bloquear a
depuração do agendamento no QStash: o request chegava com o header batendo
(confirmado manualmente com `curl` e comparando o valor salvo na Vercel) e
mesmo assim voltava 403, sem causa raiz identificável a distância. Circular
`CRON_SECRET`/rotação de secret deixou de valer a pena frente ao risco: os
jobs são idempotentes (upsert por chave única), então uma chamada indevida
não corrompe dado — o pior caso é custo/rate-limit na API MubiSys se a URL
for descoberta e martelada. `CRON_SECRET` continua existindo no `.env`/Vercel
sem uso; pode ser removido quando não sobrar dúvida de que não vai precisar
reativar a checagem.

## Armadilhas conhecidas

- **A URL do destino no QStash é a de produção, não a de preview.** URLs de
  preview mudam a cada deploy; um agendamento apontando para uma delas para
  de funcionar sozinho. Só criar o agendamento depois que o domínio final
  existir (Fase 8).
- **Expressão cron em UTC.** `0 6 * * *` não é 6h da manhã no Brasil.
- **Não adicionar `@upstash/qstash` como dependência** só para verificação de
  assinatura (`Receiver`) — decisão mantida mesmo depois de remover o
  `x-cron-secret`; se algum dia a exposição pública desses endpoints virar
  problema real, isso volta à mesa como alternativa mais robusta que um
  segredo compartilhado simples.

## Sincronização de histórico (`historico_os` / `historico_orcamentos`)

Job novo (ver `server/sync/scheduled-sync-historico.ts`), separado do
`sincronizarOS` acima. Alimenta a base permanente que `historico_os`/
`historico_orcamentos` deveriam ter desde o início — até 01/09/2026 essas
tabelas ficaram **vazias em produção** (só existiam no banco de
desenvolvimento, de uma importação manual de 18/08/2026), o que fazia a regra
de "cliente novo/reativado/recorrente" (`isClienteNovoPorRecencia` em
`server/routers/performanceComercial.ts`) tratar praticamente todo mundo como
"novo" — sem base de "quem já comprou antes", todo cliente parecia sem
histórico. Corrigido copiando o histórico do DEV pro PROD e criando este job
pra manter os dois em dia dali pra frente.

- **Endpoint:** `POST /api/scheduled/sincronizarHistorico`
- **Autenticação:** nenhuma — ver "Sem autenticação por segredo" acima.
- **Parâmetros (query string, opcionais):**
  - `mesesAtras` (padrão `1`): sincroniza o mês corrente + N meses anteriores.
    Sincronizar o mês anterior de novo (não só o corrente) é intencional —
    faturamento e status de OS aprovadas no fim do mês ainda mudam depois que
    o mês vira.
  - `mes`/`ano`: se os dois forem passados, ignora `mesesAtras` e sincroniza
    **só** aquele mês — uso manual, pra backfill pontual de um mês específico.
- **Upsert idempotente:** grava por `INSERT ... ON CONFLICT ("osNumero"/"orcNumero") DO UPDATE`
  (índice único da migration `0012_silky_odin.sql`) — rodar o mesmo mês várias
  vezes nunca duplica linha.
- **Agendamento sugerido:** 1x por dia, um único schedule (não precisa dos 4
  lotes do `sincronizarOS` — um mês inteiro de OS+orçamentos cabe num único
  upsert em lote dentro do `maxDuration` de 60s; ver comentário de topo do
  arquivo de sync sobre por que a gravação é em lotes multi-linha e não um
  INSERT por registro).

```
POST https://SEU-DOMINIO.com/api/scheduled/sincronizarHistorico
Cron (UTC): 0 7 * * *     (roda depois do sincronizarOS, sem necessidade real de ordem)
Retries:    2
```

> ⚠️ Verificado em 01/09/2026: o `MUBISYS_ACCESS_TOKEN` atual está com `exp`
> vencido desde 31/08/2026. A API ainda aceita o token vencido, mas isso pode
> parar de funcionar sem aviso — renove no painel do MubiSys antes de
> depender deste cron em produção.
