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

> Agendamento ainda **não criado**. Só deve ser criado depois que o domínio de
> produção existir (Fase 8) — ver "Armadilhas conhecidas" abaixo. Comando de
> criação em
> `docs/sprint-migracao-vercel/pending/fase-06-cron-qstash.md`, seção 6.3.

## Tempo de execução medido

| Data | OS processadas | Duração |
|---|---|---|
| `<preencher>` | `<preencher>` | `<preencher>` |

`maxDuration` da função está em 60s (`vercel.json`). O job itera as OS em
série com 2–3 queries cada; se o volume de OS crescer, esta é a primeira
coisa a estourar. Refaça a medição periodicamente.

## Como criar/alterar o agendamento

Precisa do `QSTASH_TOKEN` (painel do Upstash → QStash → Details). Ele **não**
é variável de runtime da aplicação e não deve estar configurado na Vercel.

Ver os comandos `curl` em
`docs/sprint-migracao-vercel/pending/fase-06-cron-qstash.md`.

## Status da última execução

`GET /api/scheduled/sincronizarOS/status` — não exige segredo, devolve o
resultado da última sincronização.

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
- **O endpoint de status é público.** `GET .../status` não checa segredo
  nenhum — já era assim antes desta sprint. Não é regressão, mas vale saber.
