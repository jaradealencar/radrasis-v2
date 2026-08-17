# CRON: sincronização de OS via Upstash QStash

O job `POST /api/scheduled/sincronizarOS` é agendado pelo **Upstash QStash**,
não pelo Vercel Cron. Não existe agendador dentro do repositório.

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
| Autenticação | header `x-cron-secret`, encaminhado pelo QStash via `Upstash-Forward-x-cron-secret` |
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
`docs/sprint-migracao-vercel/complete/fase-06-cron-qstash.md`.

## Status da última execução

`GET /api/scheduled/sincronizarOS/status` — desde a Fase 5, exige o mesmo
header `x-cron-secret` do POST. Devolve 403 sem o header ou com o valor
errado. O painel `/admin/sincronizacao-cache` não usa esta rota; ele lê o
status via procedure tRPC `admin.obterStatusSincronizacao` (protegido por
`adminProcedure`).

## Armadilhas conhecidas

- **A URL do destino no QStash é a de produção, não a de preview.** URLs de
  preview mudam a cada deploy; um agendamento apontando para uma delas para
  de funcionar sozinho. Só criar o agendamento depois que o domínio final
  existir (Fase 8).
- **Expressão cron em UTC.** `0 6 * * *` não é 6h da manhã no Brasil.
- **Sem `CRON_SECRET` configurado na Vercel, o endpoint devolve 403** — e o
  handler trata "segredo ausente" e "segredo errado" da mesma forma. Se o
  QStash reportar 403 em série, a primeira hipótese é variável de ambiente
  faltando, não header errado.
- **Não adicionar `@upstash/qstash` como dependência.** A verificação de
  assinatura do QStash (`Receiver`) seria uma proteção *adicional* à do
  `x-cron-secret`, mas trocaria configuração por código novo e uma
  dependência. Fora do escopo; se for desejável depois, é tarefa separada.
- **O endpoint de status exige `x-cron-secret`** (corrigido na Fase 5; antes
  disso era público e vazava data da última execução, contagem de OS e a
  mensagem de erro crua do ERP). Se algo que consultava a rota sem o header
  parar de funcionar, é este o motivo.
