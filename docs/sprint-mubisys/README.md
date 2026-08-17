# Sprint: consolidação e correção da integração MubiSys

Sprint única, dividida em **6 fases — uma fase por arquivo em `pending/`, uma
fase por commit**. O objetivo é fazer a integração com o ERP parar de produzir
dado errado, caber no ambiente serverless e existir **em um lugar só**.

> **Como usar este material.** Ao atacar uma fase, cole **este README inteiro +
> o arquivo daquela fase** como contexto inicial da conversa. Não carregue as
> outras fases: cada arquivo de fase é auto-contido e diz o que assumir das
> anteriores.
>
> O levantamento que originou esta sprint — com os contratos reais da API,
> medidos, e a lista completa de achados (A1…A13) — está em
> [`docs/integracao-mubisys.md`](../integracao-mubisys.md). **Leia-o antes da
> Fase 1.** As fases referenciam os achados pelo código (A1, A2, …).

## Índice das fases

| # | Arquivo | O que faz | Achados | Depende de |
|---|---------|-----------|---------|------------|
| 1 | [fase-01-cliente-unico.md](pending/fase-01-cliente-unico.md) | Reescreve `mubisys-client.ts` como único caminho HTTP (timeout, 200/201, 404, paginação, busca por número) | A2, A8 | — |
| 2 | [fase-02-dados-errados-frete.md](pending/fase-02-dados-errados-frete.md) | 🔴 Corrige CNPJ/cliente errado no frete e o cache incompleto | A1, A5, A6 | 1 |
| 3 | [fase-03-sync-diario.md](pending/fase-03-sync-diario.md) | Faz o sync diário caber em 60 s e paginar | A3 | 1 |
| 4 | [fase-04-migrar-consumidores.md](pending/fase-04-migrar-consumidores.md) | Migra CRM, Performance Comercial, ABC e Empacotamento para o cliente único | A4, A7 | 1, 2, 3 |
| 5 | [fase-05-seguranca-e-saude.md](pending/fase-05-seguranca-e-saude.md) | Fecha endpoints admin, health check, rotação de token | A9, A10 | 1 |
| 6 | [fase-06-testes-e-docs.md](pending/fase-06-testes-e-docs.md) | Testes reais, documentação, limpeza de código morto | A11, A12, A13 | 1–5 |

**Ordem obrigatória: a Fase 1 vem primeiro.** Ela cria o cliente que todas as
outras consomem. Depois disso:

- **2** é a mais urgente em termos de impacto (dado errado saindo em romaneio e
  CT-e). Se a sprint for interrompida, é a que não pode ficar para trás.
- **3** é a que destrava o agendamento do QStash (bloqueado hoje pela Fase 9 da
  sprint Vercel).
- **5** é independente de 2, 3 e 4 — pode sair a qualquer momento após a 1.
- **4** por último entre as de código: é a maior e a que menos corrige dado
  errado, mas é ela que apaga a dívida de seis clientes paralelos.
- **6** sempre por último.

⚠️ **Nunca rode duas fases em paralelo.** As fases 1, 2, 3 e 4 tocam
`server/integrations/mubisys-client.ts`.

---

## Contexto: por que esta sprint existe

Seis lugares diferentes falam com a API do ERP, cada um com seu transporte, seu
timeout e seu tratamento de erro (tabela completa em
`docs/integracao-mubisys.md`, §2.1). O "cliente oficial",
`server/integrations/mubisys-client.ts`, é usado por apenas dois call sites e
metade das suas funções é código morto.

Isso não é só feio — três consequências concretas já estão em produção:

1. **A cotação de frete grava o CNPJ e a razão social de outro cliente** (A1).
   O código procura o CNPJ em campos que não existem, não acha, e resolve o
   cliente pelo id do *endereço*. Comprovado na OS 6917: o CNPJ gravado é de
   uma empresa sem relação nenhuma com a OS.
2. **O sync diário não termina na Vercel** (A3). A chamada da API leva ~25 s e o
   loop faz ~360 queries em série; o `maxDuration` é 60 s. A função morre no
   meio e nem chega a escrever em `sync_logs`.
3. **A busca de OS por número quase nunca acha a OS** (A2), porque lista 6 meses
   sem paginar em vez de usar `GET /ordem-servico/numero/{n}`, que responde em
   226 ms.

### Contratos da API que valem para toda a sprint

Medidos em 17/08/2026 contra a API de produção. **Não improvise sobre isto:**

| Fato | Consequência para o código |
|---|---|
| Sucesso é **201** em listagens e `/ordem-servico/{id}`, **200** em `/cliente/{id}` | Nunca teste `status === 200`. Aceite `>= 200 && < 300` |
| "Nada encontrado" é **404** + `{"error":"Não encontrado"}` | 404 é resultado vazio, não falha |
| `per_page` padrão já é **500** | Ainda assim, sempre pagine por `pagination.last_page` |
| `/ordem-servico?...` de 1 mês leva **~25 s** e ~1 MB | Não cabe mais de uma dessas por requisição serverless |
| `/ordem-servico/numero/{n}` leva **~0,2 s** | É o caminho certo para busca pontual |
| `cliente_cnpj_cpf` já vem na OS | Não extraia CNPJ por regex, nunca |
| `cliente_id` ≠ `cliente_endereco[0].id` | `GET /cliente/{id}` aceita os dois e devolve clientes diferentes |
| `prazo` é texto (`"02 dias úteis"`), `data_entrega` é data | Não trate `prazo` como fallback de data |

### Decisões já tomadas (não reabrir)

| Assunto | Decisão |
|---|---|
| Transporte HTTP | `fetch` global com `AbortSignal.timeout()`. Sai `https.get` de todos os call sites — Node 22 (ver `engines`) |
| Onde vive o cliente | `server/integrations/mubisys-client.ts`, arquivo único |
| Credenciais | Sempre via `ENV` (`server/_core/env.ts`). Nenhum `process.env.MUBISYS_*` fora dele |
| Cache | Mantém as tabelas atuais (`erp_os_cache`, `mubisys_api_cache`, `abc_cache`). Nenhuma tabela nova, nenhuma migração de schema nesta sprint |
| Frete simulado (A13) | **Fora do escopo.** Só ganha um comentário deixando explícito que é placeholder |
| **Sync diário que não cabe em 60 s** | **Lotes via QStash** (decidido em 17/08/2026). O endpoint passa a aceitar janela parametrizada e o QStash dispara vários lotes escalonados. Não é janela menor nem `maxDuration` maior — ver Fase 3 |
| **`filtrodata` do faturamento** | **`APROVACAO`** (decidido em 17/08/2026). O código já está certo; quem está errado é `todo.md:1404`, corrigido na Fase 6 |

### O que esta sprint NÃO faz

- **Não muda regra de negócio.** Os números de Performance Comercial, CRM e
  Curva ABC precisam continuar iguais depois da Fase 4. Se mudarem, é bug.
- **Não toca em `drizzle/schema.ts`.** Zero migrações.
- **Não implementa cotação de frete real** (A13).
- **Não cria o agendamento no QStash.** Continua dependendo do domínio de
  produção (Fase 9 da sprint Vercel). A Fase 3 deixa o endpoint pronto para os
  lotes e escreve os comandos de criação; **executá-los é da outra sprint.**
- **Não muda o `filtrodata`.** Ficou decidido `APROVACAO`, que é o que o código
  já faz. A Fase 6 só corrige o `todo.md`.

---

## Regras de ouro (valem para todas as fases)

1. **Uma fase = um commit.** Mensagem: `fix(erp): <o que fez> (sprint mubisys,
   fase N)`.
2. **Nenhum `https.get` novo.** Se a fase precisa de HTTP, usa o cliente da
   Fase 1.
3. **Nenhuma leitura de `process.env.MUBISYS_*` fora de `env.ts`.**
4. **Não invente campo.** Se um campo não está na tabela de contratos acima nem
   na resposta real, ele não existe. Cascatas de `??` sobre nomes alternativos
   são exatamente o que causou A1 — não replique o padrão.
5. **Nada de segredo no client.** O `Access-Token` nunca sai do servidor.
6. **Não formate arquivo inteiro.** Edite só o trecho alvo.
7. **Nunca use `git checkout --`, `git reset --hard` ou `git clean`.** Se errou,
   corrija editando.
8. **Se a fase exigir decisão que não está em "Decisões já tomadas" — pare e
   pergunte.**

## Verificação (rode ao fim de toda fase, sem exceção)

```bash
yarn run check    # tsc --noEmit — precisa do "run"! (ver AGENTS.md)
yarn test         # vitest run
yarn dev          # tem que subir e a tela afetada tem que funcionar no browser
```

Fases que tocam telas (2, 4) exigem verificação manual no browser, com o número
de OS indicado na própria fase.

## Meta da sprint

| Métrica | Antes | Meta |
|---|---|---|
| Implementações HTTP do ERP | 6 | 1 |
| Leituras de `process.env.MUBISYS_*` fora do `env.ts` | 10 | 0 |
| CNPJ correto na cotação de frete | não | sim |
| Sync diário conclui na Vercel | não | sim |
| Busca de OS por número | lista 6 meses (~25 s, falha) | endpoint direto (~0,2 s) |
| Endpoints admin da sync sem auth | 4 | 0 |
| Testes reais da integração | 0 | mapeamento + paginação + 404 |
