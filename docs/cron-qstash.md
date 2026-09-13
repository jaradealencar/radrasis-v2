# CRON: sincronização de OS via Upstash QStash

Existem **cinco** jobs agendados pelo **Upstash QStash** (não pelo Vercel
Cron); nenhum agendador vive dentro do repositório:

| Job | Alimenta | Propósito |
|---|---|---|
| `POST /api/scheduled/sincronizarOS` | `erp_os_cache` | janela rolante curta (~32 dias), dados "quentes" pra funcionalidades que só precisam do recente |
| `POST /api/scheduled/sincronizarHistorico` | `historico_os` + `historico_orcamentos` | base histórica permanente, usada pela regra de cliente novo/reativado/recorrente e por todo relatório comercial mensal |
| `POST /api/scheduled/sincronizarCrmAbertos` | `mubisys_api_cache` (chave `crm_abertos_15d`) | orçamentos "em aberto" (15 dias) que o CRM de Propostas mostra — ver seção "Sincronização de abertos do CRM" mais abaixo |
| `POST /api/scheduled/sincronizarCrmFechados` | `mubisys_api_cache` (chave `crm_fechados_45d`) | orçamentos "fechados" (45 dias) usados nas estatísticas do período selecionado no CRM — mesma seção |
| `POST /api/scheduled/sincronizarPerfilCnpj` | `clientes_perfil_cnpj` | enriquece automaticamente o CNPJ de clientes novos que aparecem em `historico_os` (porte, idade, sócios) — ver seção "Sincronização do Perfil de Clientes por CNPJ" mais abaixo |

Este documento cobre o primeiro em detalhe; os outros estão descritos nas
seções "Sincronização de histórico", "Sincronização de abertos do CRM" e
"Sincronização do Perfil de Clientes por CNPJ" mais abaixo.

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

## Sincronização de abertos do CRM (`mubisys_api_cache`, chave `crm_abertos_15d`)

Criado em 12/09/2026 para corrigir o CRM de Propostas (`client/src/pages/comercial/CRM.tsx`
+ `server/routers/crm.ts`), que travava buscando **12 meses** inteiros de orçamentos ao vivo
a cada carregamento de página. Ver `server/sync/crm-abertos-cache.ts` para o racional
completo.

- **Endpoint:** `POST /api/scheduled/sincronizarCrmAbertos`
- **Autenticação:** nenhuma — ver "Sem autenticação por segredo" acima.
- **Sem parâmetros.** Sempre sincroniza a janela padrão (15 dias, `status=ABERTO`).
- **Upsert idempotente:** sobrescreve a mesma linha de `mubisys_api_cache` (chave
  `crm_abertos_15d`) a cada execução — chamadas repetidas ou fora de hora não corrompem nada.

```
POST https://SEU-DOMINIO.com/api/scheduled/sincronizarCrmAbertos
Cron (UTC): */10 * * * *     (a cada 10 minutos)
Retries:    2
```

> ⚠️ **A API MubiSys é muito mais instável do que o volume de dados sugere.**
> Medido em 12/09/2026: a mesma busca de 15 dias levou 25s numa execução e
> 117s em outra, sem mudança de código nem de volume. Por isso a leitura em
> `getPropostas`/`getVendedores` **nunca** trava esperando esta sincronização
> terminar — ela sempre serve o que já estiver em `mubisys_api_cache`, por
> mais velho que esteja (a tela mostra "atualizado há X"), e só faz busca ao
> vivo síncrona no bootstrap (cache nunca populado, ex.: logo após o primeiro
> deploy). Se este cron falhar ou atrasar algumas vezes seguidas, o único
> efeito é a tela ficar mais desatualizada — nunca lenta ou quebrada.
>
> Pelo mesmo motivo, **não crie um segundo schedule para a janela estendida**
> (30 dias, botão "Buscar mais antigas" na tela) — ela é usada sob demanda,
> raramente, e aceita o risco de eventualmente demorar ou falhar num clique
> isolado. Não vale manter mais um job rodando de fundo para isso.

## Sincronização de fechados do CRM (`mubisys_api_cache`, chave `crm_fechados_45d`)

Job irmão do anterior, mesma motivação. As estatísticas do período selecionado
na tela (propostas fechadas/valor fechado) também bateram ao vivo no MubiSys
sem cache — mesmo risco de demora/instabilidade. Ver
`buscarOrcamentosPeriodo` em `server/routers/crm.ts`.

- **Endpoint:** `POST /api/scheduled/sincronizarCrmFechados`
- **Autenticação:** nenhuma.
- **Sem parâmetros.** Sincroniza uma janela rolante de 45 dias (sem filtro de
  `status` na chamada — o filtro de quais status contam como "fechado" é
  sempre feito client-side).
- **Por que 45 dias e não 15:** cobre com folga o preset "Este mês" do front
  (até ~31 dias) mais margem. Um período customizado mais antigo que isso cai
  fora do cache e ainda faz busca ao vivo (raro, aceitável).

```
POST https://SEU-DOMINIO.com/api/scheduled/sincronizarCrmFechados
Cron (UTC): */15 * * * *     (a cada 15 minutos — não precisa ser tão frequente quanto o de abertos)
Retries:    2
```

Mesmo aviso do job de abertos sobre instabilidade da API MubiSys se aplica
aqui: rodar como job SEPARADO (não somado ao de abertos na mesma invocação)
é intencional — as duas buscas já podem sozinhas se aproximar do
`maxDuration` de 60s quando a API está lenta.

## Sincronização do Perfil de Clientes por CNPJ (`clientes_perfil_cnpj`)

Criado em 13/09/2026 a pedido do usuário: até então, a tabela
`clientes_perfil_cnpj` (usada pela sub-aba Inteligência de Clientes → Perfil
CNPJ, ver `server/routers/perfilClientesCnpj.ts`) só crescia quando alguém
clicava manualmente em "Preencher automaticamente via MubiSys" — clientes
novos que passavam a comprar não entravam sozinhos. Este job fecha esse loop:
todo cliente novo que aparece em `historico_os` e ainda não tem CNPJ vinculado
é enriquecido automaticamente, na próxima execução do cron.

- **Endpoint:** `POST /api/scheduled/sincronizarPerfilCnpj`
- **Autenticação:** nenhuma — ver "Sem autenticação por segredo" acima.
- **Sem parâmetros.**
- **Lógica:** idêntica à do botão manual (`enriquecerViaMubisys`) e ao script
  de backfill completo (`server/scripts/backfill-cnpj-todos-clientes.ts`) —
  ver `server/sync/scheduled-sync-perfil-cnpj.ts`. Para cada cliente sem CNPJ
  vinculado, busca uma OS de referência dele no MubiSys (que traz
  `cliente_cnpj_cpf`), classifica CPF x CNPJ, e para CNPJ consulta a OpenCNPJ
  e grava o perfil.
- **Orçamento por execução:** no máximo 40 candidatos OU 45s de execução
  (o que vier primeiro) — o restante fica para a próxima execução, mesmo
  princípio de "restantes" já usado na tela manual. Como poucos clientes
  novos aparecem por dia, isso é folgado na prática; o teto existe só para
  nunca se aproximar do `maxDuration` de 60s da Vercel mesmo num dia atípico.
- **Idempotente:** nunca reprocessa quem já está em `clientes_perfil_cnpj`.

```
POST https://SEU-DOMINIO.com/api/scheduled/sincronizarPerfilCnpj
Cron (UTC): 0 8 * * *     (1x por dia, depois do sincronizarHistorico)
Retries:    2
```

**Nota (13/09/2026):** o Score de Probabilidade de Compra
(`server/services/probabilidadeCompra.ts`) hoje **não** usa este perfil de
CNPJ como fator — o próprio arquivo documenta isso como "fora de escopo"
deliberado. Fazer o perfil de CNPJ "participar da análise de preditividade"
(porte, idade da empresa, sócios como fator do score) é uma mudança de
metodologia do score já calibrado e usado tanto no CRM quanto na Performance
Comercial — decisão pendente do usuário, não implementada neste job.
