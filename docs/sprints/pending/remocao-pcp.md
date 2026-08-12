# Sprint: remoção do módulo PCP

Sprint curta — 4 tarefas, um commit por tarefa. Remove por completo o módulo
PCP (Programa de Controle de Produção): página, router, helpers, schema e
referências na documentação.

> **Como usar este material.** Cole este arquivo inteiro como contexto
> inicial da conversa. Ele é auto-contido: o inventário abaixo foi levantado
> por busca no repo em 11/08/2026 e cobre 100% da superfície do módulo.

## Contexto

O PCP é um módulo isolado: espelha ordens de serviço do MubiSys em tabelas
locais (`producao_ordens` + setores + alertas), calcula prazo por dias úteis
(descontando feriados) e sinaliza atrasos. **Nenhum outro módulo do sistema
consome nada dele** — a verificação está na tabela de inventário.

Decisão do dono do projeto: o módulo sai do sistema.

---

## Inventário completo (já levantado — não precisa refazer a busca)

### Código que morre por inteiro

| Arquivo | Linhas | O quê |
|---|---|---|
| `client/src/pages/financeiro/PCP.tsx` | 614 | a página |
| `server/routers/pcp.ts` | 280 | o router tRPC (`pcpRouter`) |
| `server/db/pcp-helpers.ts` | 482 | 17 helpers de cálculo/persistência |

### Referências pontuais a apagar

| Local | O quê |
|---|---|
| `client/src/App.tsx:43` | `import PCP from "./pages/financeiro/PCP"` |
| `client/src/App.tsx:109` | `<Route path="/pcp" component={PCP} />` |
| `client/src/components/DashboardLayout.tsx:100` | item de menu `PCP - Controle de Produção` (`pageKey: "pcp"`) |
| `server/routers.ts:13` | `import { pcpRouter } from "./routers/pcp"` |
| `server/routers.ts:1401` | `pcp: pcpRouter,` no router raiz |
| `AGENTS.md:7, 166, 168` | menções ao módulo e aos arquivos |
| `docs/sprint-refatoracao-pages/fase-11-estados-loading-vazio.md:28, 175` | `financeiro/PCP.tsx` na lista de páginas a padronizar |

### Tabelas e enums (Tarefa 3 — tem decisão de negócio no meio)

| Objeto | Só do PCP? |
|---|---|
| `feriados` | sim |
| `motivos_atraso` | sim |
| `producao_ordens` | sim |
| `producao_setores` | sim |
| `producao_alertas` | sim |
| `producao_historico_alteracoes` | sim |
| `producao_ordens_new` (`schema.ts:1956`) | **órfã** — existe no schema e no SQL, zero call sites |
| enum `producao_status_geral` | sim (usado por `producao_ordens` e pela órfã) |
| enum `producao_setor_status` | sim |
| enum `producao_alerta_tipo` | sim |

### ⚠️ O que **NÃO** sai junto (verificado, tem outros consumidores)

- **`server/integrations/mubisys-client.ts` fica.** O PCP importa dele, mas
  também importam: `server/integrations/mubisys-frete.ts`,
  `server/sync/scheduled-sync-os.ts`, `server/routers/logistica.ts` (via
  frete) e `server/routers.ts:1425`. Remova só o import do lado do PCP.
- **`erp_os_cache`, `sync_logs` e o enum `sync_status` ficam.** São do
  módulo de sincronização com o ERP (`server/sync/*`), não do PCP — apesar
  de vizinhos no `schema.ts`.
- **`client/src/pages/financeiro/AnaliseAtrasos.tsx` e `GestaoAtrasos.tsx`
  ficam.** Nome parecido, mas não chamam `trpc.pcp` nem tabela nenhuma do
  PCP (não fazem chamada tRPC alguma hoje).
- **Nada da sprint `docs/sprint-saida-forge/` é afetado.** Nenhum arquivo do
  PCP toca `invokeLLM`, `storage*`, `notifyOwner`, Forge ou Gemini.

### 🪤 Armadilha de nome: existem dois `criarAlerta`

- `server/db/pcp-helpers.ts:378` → insere em `producao_alertas` — **este
  morre nesta sprint**.
- `server/routers/qualidade.ts:16` → insere em `alertas_sistema` — **este
  fica**, e é o que a Fase 5 da sprint-saida-forge vai extrair pra
  `server/db/alertas-helpers.ts`.

Não confunda os dois ao buscar por `criarAlerta`.

---

## ⚠️ Confirmar ANTES da Tarefa 3

**As tabelas do PCP têm dados que alguém ainda quer?** Rode:

```sql
SELECT
  (SELECT count(*) FROM producao_ordens)               AS ordens,
  (SELECT count(*) FROM producao_setores)              AS setores,
  (SELECT count(*) FROM producao_alertas)              AS alertas,
  (SELECT count(*) FROM producao_historico_alteracoes) AS historico,
  (SELECT count(*) FROM feriados)                      AS feriados,
  (SELECT count(*) FROM motivos_atraso)                AS motivos;
```

Se vier tudo zero (ou só as seeds de `feriados`/`motivos_atraso`), siga a
Tarefa 3 direto. Se houver ordens reais, **exporte antes de dropar**
(`COPY ... TO` ou dump das 6 tabelas) e guarde fora do repo. Decisão de
negócio, não técnica — não descubra isso no meio da implementação.

---

## Tarefa 1 — Remover a página e a rota (client) ✅ feito em 12/08/2026

1. Delete `client/src/pages/financeiro/PCP.tsx`.
2. Em `client/src/App.tsx`, apague o import (linha 43) e a `<Route
   path="/pcp">` (linha 109). Note que essa rota **não** está dentro de
   `<ProtectedRoute>` — é uma linha só, sem wrapper.
3. Em `client/src/components/DashboardLayout.tsx`, apague o item de menu da
   linha 100 (`href: "/pcp"`). Confira se o grupo do menu que o continha não
   fica vazio; se ficar, remova o grupo também.

**Sobre o `pageKey: "pcp"`:** ele não existe em lugar nenhum do código além
desse item de menu — as permissões por página vivem em linhas da tabela
`role_permissions` (`pageKey varchar`). Podem existir linhas com
`pageKey = 'pcp'` no banco. Limpe junto com a Tarefa 3:

```sql
DELETE FROM role_permissions WHERE "pageKey" = 'pcp';
```

**Verificação:** `npx tsc --noEmit`, `yarn build`, e uma busca por `PCP` em
`client/` não retorna nada.

**Commit:** `chore(pcp): remove página e rota do PCP`

**Notas da execução:** `npx tsc --noEmit` deu 0 erros antes e depois (o
baseline de 16 erros de 11/08 não existe mais — provavelmente corrigido em
commit posterior; não investigado, fora de escopo). O grupo de menu
"Produção" em `DashboardLayout.tsx` não ficou vazio (ainda tem "Gestão de
Atrasos" e "Análise de Atrasos"), então só a linha do PCP foi removida. O
`DELETE FROM role_permissions WHERE "pageKey" = 'pcp';` fica pendente para
a Tarefa 3 (precisa de acesso ao banco).

---

## Tarefa 2 — Remover o router e os helpers (server) ✅ feito em 12/08/2026

1. Delete `server/routers/pcp.ts` e `server/db/pcp-helpers.ts`.
2. Em `server/routers.ts`, apague o import (linha 13) e a entrada `pcp:
   pcpRouter,` (linha 1401).

Não toque em `server/integrations/mubisys-client.ts` — ver o aviso do
inventário. Depois de deletar os dois arquivos, confirme que os exports do
`mubisys-client` que **só** o PCP usava continuam sendo usados por outros
(`buscarOSPorNumero`, `listarOSMubiSys`, `buscarOSPorId`,
`verificarConexaoMubiSys`). Se algum ficar sem nenhum call site, anote aqui
neste arquivo — **não remova nesta sprint**, é outro escopo.

**Verificação:** `npx tsc --noEmit` (ver baseline abaixo), `yarn test`, e o
app sobe sem erro de router faltando.

**Commit:** `chore(pcp): remove pcpRouter e pcp-helpers`

**Notas da execução:** `npx tsc --noEmit` deu 0 erros depois. `yarn test`
tem 19 testes falhando, todos por falta de `DATABASE_URL`/credenciais MubiSys
no shell (erro de conexão Postgres / env var ausente) — nenhuma falha é do
PCP, não existe `pcp.test.ts`. Confirmado: `buscarOSPorId` e
`verificarConexaoMubiSys`, exports de `mubisys-client.ts`, ficaram **sem
nenhum call site** depois da remoção do `pcp.ts` — não removidos nesta
sprint (fora de escopo), registrados aqui para decisão futura.

---

## Tarefa 3 — Remover schema e tabelas (depende da confirmação acima) ✅ feito em 12/08/2026

Ordem obrigatória, seguindo a regra de migrations do projeto:

1. Em `drizzle/schema.ts`, apague a seção
   `─── PCP: Programa de Controle de Produção ───` (a partir da linha ~1644):
   as 6 tabelas, seus tipos `$inferSelect`/`$inferInsert`, e **pare antes** de
   `─── SINCRONIZAÇÃO COM ERP ───` (`sync_logs`/`erp_os_cache` ficam).
2. Apague também `producaoOrdensNew` e seus tipos (~linha 1956) — tabela
   órfã, criada por engano numa migração antiga e nunca usada por nada.
3. Apague os enums das linhas 47–49 (`producaoStatusGeralEnum`,
   `producaoSetorStatusEnum`, `producaoAlertaTipoEnum`). **Mantenha a linha
   50** (`syncStatusEnum`).
4. `npx drizzle-kit generate` → **revise o SQL gerado** antes de aplicar.
   Confirme que ele: dropa as 7 tabelas e os 3 enums, e **não** encosta em
   `sync_logs`, `erp_os_cache` nem em nenhuma tabela de outro módulo.
5. Adicione o `DELETE FROM role_permissions WHERE "pageKey" = 'pcp';` da
   Tarefa 1 ao SQL gerado (ou rode como migration separada).
6. `npx drizzle-kit migrate`.

**Sobre os triggers:** `drizzle/0001_updated_at_triggers.sql` cria triggers
em `motivos_atraso`, `producao_ordens`, `producao_setores` e
`producao_alertas` (linhas 140–146). Eles caem sozinhos com o `DROP TABLE`
(o Postgres dropa triggers junto da tabela) — **não edite a migration
antiga**, migrations já aplicadas são imutáveis.

**Alternativa, se a confirmação acima travar:** faça as Tarefas 1, 2 e 4 e
pare. O código morre, as tabelas ficam órfãs no banco até a decisão sair.
Nesse caso registre aqui a pendência e não remova nada do `schema.ts` —
schema e banco têm que continuar batendo.

**Verificação:** `npx tsc --noEmit`, `yarn test` (as suítes que tocam banco
precisam de `DATABASE_URL` exportada no shell), e o app sobe e navega.

**Commit:** `chore(pcp): dropa tabelas e enums do PCP`

**Notas da execução:** Confirmação de dados rodada em 12/08/2026 — as 6
tabelas (`producao_ordens`, `producao_setores`, `producao_alertas`,
`producao_historico_alteracoes`, `feriados`, `motivos_atraso`) estavam
todas com 0 linhas, inclusive as seeds. Owner do projeto autorizou seguir
direto com o DROP, sem exportar dados. Migration `0008_mixed_pestilence.sql`
gerada e revisada: dropa as 7 tabelas (`producao_ordens_new` incluída) e os
3 enums do PCP, mantém `sync_logs`/`erp_os_cache`/`syncStatusEnum`
intactos. O `DELETE FROM role_permissions WHERE "pageKey" = 'pcp'` foi
adicionado à mesma migration (em vez de rodado à parte). Migration aplicada
com `npx drizzle-kit migrate` e verificada por query direta pós-aplicação:
as 7 tabelas e 3 enums não existem mais, `sync_logs`/`erp_os_cache`/
`sync_status` seguem existindo, e `role_permissions` tem 0 linhas com
`pageKey = 'pcp'`. `npx tsc --noEmit` deu 0 erros; `yarn test` manteve as
mesmas 19 falhas pré-existentes por falta de `DATABASE_URL`/credenciais
MubiSys no shell de teste (nenhuma nova falha).

---

## Tarefa 4 — Documentação

1. `AGENTS.md`: linha 7 (descrição do sistema — tirar "PCP" da lista de
   domínios), linha 166 (`routers/` cita `pcp.ts`) e linha 168 (`db/` cita
   `pcp-helpers.ts`).
2. `docs/sprint-refatoracao-pages/fase-11-estados-loading-vazio.md`: a linha
   28 lista `financeiro/PCP.tsx (5)` entre as páginas com estados a
   padronizar, e a linha 175 pede verificação manual no PCP. Remova as duas
   menções e ajuste a contagem total de itens da fase, se houver.
3. **Não mexa em `docs/archive/versoes-divergentes/`** — os snapshots
   `pcp*.zip-snapshot.*` são registro histórico de versões divergentes, não
   código vivo.
4. Mova este arquivo de `docs/sprints/pending/` para `docs/sprints/complete/`.

**Commit:** `docs(pcp): atualiza AGENTS.md e sprints após remoção do PCP`

---

## Regras do projeto (valem em todas as tarefas)

1. **Yarn, nunca npm/pnpm.**
2. **Type-check é `npx tsc --noEmit`** — não use `yarn check` (esse dispara o
   comando nativo do Yarn e devolve resultado errado).
3. **Baseline: `npx tsc --noEmit` acusa 16 erros pré-existentes**, medidos em
   11/08/2026, **nenhum deles em arquivo do PCP**. Rode antes de começar e
   guarde a saída; ao terminar, a contagem tem que ser 16 ou menos. Não tente
   corrigir os erros pré-existentes.
4. **Mudança de schema só via migration** (`drizzle-kit generate` → revisar
   SQL → `drizzle-kit migrate`). Nunca `DROP TABLE` solto.
5. **Um commit por tarefa**, atualizando este arquivo (marcando o que foi
   feito e o que descobriu) no mesmo commit.
6. **Não refatore o que a tarefa não pede.** Achou algo feio fora do escopo,
   anote aqui e siga.

## Convenção sobre números de linha

Os números citados envelhecem — e nesta sprint envelhecem rápido, porque
cada tarefa apaga linhas dos arquivos seguintes. Confirme sempre pelo nome da
função/variável citada junto, não pelo número puro.
