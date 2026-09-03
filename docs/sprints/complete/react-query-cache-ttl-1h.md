# Sprint: TTL de cache de 1h no React Query + invalidação manual padronizada

Sprint dividida em **4 tarefas — uma tarefa por commit**. Não introduz
nenhuma lib nova: o app já usa `@tanstack/react-query` via `@trpc/react-query`
em praticamente todas as páginas (68 arquivos com `.useQuery(`). O objetivo é
(1) subir o TTL padrão do cache de 30s para 1h, (2) revisar os overrides
pontuais de `staleTime`/`refetchInterval` que já existem à luz do novo
padrão, e (3) padronizar a invalidação manual — hoje ~22 arquivos chamam
`refetch()` direto no `onSuccess` de mutations, enquanto ~15 arquivos já
usam o padrão correto (`trpc.useUtils()` + `utils.<router>.<query>.invalidate()`).
A sprint uniformiza tudo para o segundo padrão.

> **Como usar este material.** Cole este arquivo inteiro como contexto
> inicial da conversa. Inventário levantado por busca no repo em 27/08/2026.

## Contexto

O client cria um único `QueryClient` em [client/src/main.tsx](../../../client/src/main.tsx)
e o compartilha entre o provider do tRPC e o `QueryClientProvider` puro:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
```

Esse `staleTime: 30_000` (30s) é o **padrão herdado por toda query que não
declara o próprio `staleTime`** — a maioria das ~68 páginas/hooks com
`useQuery`. Não há `gcTime` customizado (fica no default do react-query,
5 min), nem invalidação em nível de `QueryClient` — cada `useMutation` decide
sozinho como atualizar os dados após escrever.

Dois padrões de "atualizar dados após mutation" coexistem hoje:

1. **`refetch()` manual** (~22 arquivos): a query guarda o `refetch` que ela
   mesma retorna e cada `onSuccess` de mutation chama esse `refetch` na mão.
   Funciona, mas é local ao componente — se duas queries diferentes mostram
   o mesmo dado (ex.: uma lista e um dashboard de KPIs), a mutation só
   atualiza a que o componente conhece.
2. **`trpc.useUtils()` + `.invalidate()`** (~15 arquivos, ex.:
   [client/src/pages/retrabalhos/NovoRetrabalho.tsx:15-33](../../../client/src/pages/retrabalhos/NovoRetrabalho.tsx),
   [client/src/pages/comercial/PerformanceComercial.tsx:257](../../../client/src/pages/comercial/PerformanceComercial.tsx)):
   pega o cache pelo `router.query` e invalida por chave — funciona mesmo
   quando o dado é consumido por outra parte da árvore, e é o padrão que o
   react-query recomenda. **Esse é o padrão-alvo desta sprint.**

Um TTL de 1h só é seguro combinado com invalidação manual confiável: se uma
mutation grava um dado nas mesmas ~68 telas e nada invalida a query certa, o
usuário vê dado desatualizado por até 1h em vez de 30s. Por isso as Tarefas
2–4 andam juntas com a Tarefa 1.

---

## Inventário completo (já levantado — não precisa refazer a busca)

### Overrides pontuais de `staleTime`/`refetchInterval` já existentes

| Arquivo | Override | O que é | Decisão |
|---|---|---|---|
| `hooks/useAuth.ts:18` | `staleTime: 30_000` | permissões do usuário (`permissions.myPermissions`) | **manter** — dado sensível a mudança de papel/permissão, não deve herdar 1h |
| `pages/comercial/PerformanceComercial.tsx:287` (`STALE_5MIN`, 9 usos) | `staleTime: 5min` | queries lentas da API MubiSys | **remover o override**, deixar herdar o padrão global (1h) — o comentário já diz que o motivo é "evitar refetch desnecessário", 1h atende melhor que 5min |
| `pages/comercial/EvolucaoVendedor.tsx:106` | `staleTime: 5min` | idem (API MubiSys) | **remover**, mesma razão |
| `pages/comercial/EvolucaoDiariaVendedor.tsx:42` | `staleTime: 5min` | idem | **remover**, mesma razão |
| `pages/comercial/InteligenteClientes.tsx:164` | `staleTime: Infinity` | já usa `invalidate()` manual explícito | **manter** — design intencional, não é o problema desta sprint |
| `pages/comercial/DiagnosticoApi.tsx:27` | `staleTime: 0` | ferramenta de diagnóstico, precisa sempre buscar fresco | **manter** |
| `pages/logistica/Solicitacoes.tsx:464,1821` | `staleTime: 5min` | cobertura de transportadora por cidade | **manter** — dado quase estático, 5min já é curto de propósito |
| `pages/logistica/Solicitacoes.tsx:590` | `staleTime: 30_000` | auto-preenchimento de dados da OS ao abrir modal | **manter** — precisa refletir a OS mais recente ao abrir |
| `pages/logistica/Solicitacoes.tsx:634` | `staleTime: 60_000` | autocomplete de transportadora | **manter** |
| `pages/logistica/Solicitacoes.tsx:1732-1734` | `staleTime: 5min` + `gcTime: 10min` + `refetchInterval: 2min` | painel com refresh em background | **manter** — já tem `refetchInterval`, TTL de leitura não é o que domina o comportamento |
| `pages/logistica/Empacotamento.tsx` (8 usos) | `refetchInterval: 3-30s` + `staleTime: 3s` | kanban de embalagem, precisa ser quase tempo real | **manter todos** — `refetchInterval` já força atualização periódica independente do `staleTime` padrão |
| `hooks/useVendedorAlertas.ts:48-49` | `refetchInterval: 15s` + background | alertas de vendedor | **manter** |
| `pages/admin/SincronizacaoCache.tsx:18,26` | `refetchInterval: 30-60s` | página que monitora o próprio cache de sincronização com o MubiSys | **manter** |
| `pages/operacoes/SugestoesConhecimento.tsx:27` | `refetchInterval: 15s` | fila de sugestões | **manter** |
| `pages/qualidade/Alertas.tsx:34,36` | `refetchInterval: 30s` | contadores de alertas ativos | **manter** |
| `pages/qualidade/AcoesCorretivas.tsx:57` | `refetchInterval: 60s` | idem | **manter** |
| `components/DashboardLayout.tsx:157-158` | `refetchInterval: 60-120s` | badges do menu (alertas, rotinas pendentes) | **manter** |
| `pages/Dashboard.tsx:36` | `refetchInterval: 60s` | KPI do dia | **manter** |

Regra geral usada acima: **override com `refetchInterval` sempre fica**
(ele já dita a frequência de atualização, independente do `staleTime`
default). Override de `staleTime` só fica se o motivo for "este dado
específico precisa ficar mais fresco que o padrão" (formulário sendo aberto,
autocomplete, ferramenta de diagnóstico); os que existem só para "evitar
refetch de API lenta" perdem a razão de ser com o novo default de 1h e devem
ser removidos para simplificar o código.

### Arquivos com `refetch()` manual a migrar para `utils.invalidate()` (Tarefa 3 e 4)

Grupo **operações** (Tarefa 3a):
- `pages/operacoes/Pops.tsx`
- `pages/operacoes/Rotinas.tsx`
- `pages/operacoes/Regulamentos.tsx`
- `pages/operacoes/CargoseFuncoes.tsx`
- `pages/operacoes/Fornecedores.tsx`
- `pages/operacoes/CustoLed.tsx`
- `pages/operacoes/CustoSolda.tsx`
- `pages/operacoes/Conhecimento.tsx`
- `pages/operacoes/SugestoesConhecimento.tsx`
- `pages/operacoes/MetasOperacionais.tsx`
- `pages/operacoes/BibliotecaArquivos.tsx`

Grupo **comercial / qualidade / retrabalhos / financeiro / logística / admin / hooks** (Tarefa 3b):
- `pages/comercial/CRMConfig.tsx`
- `pages/qualidade/DesempenhoColaborador.tsx`
- `pages/qualidade/Alertas.tsx` (só o `refetch()` do botão manual — os dois
  `refetchInterval` da tabela acima ficam)
- `pages/retrabalhos/BibliotecaErros.tsx`
- `pages/logistica/ConsultaCobertura.tsx`
- `pages/financeiro/Financeiro.tsx`
- `pages/admin/SincronizacaoCache.tsx` (só o botão manual, os
  `refetchInterval` ficam)
- `hooks/useAuth.ts` (método `refetch` exposto pelo hook — ver nota abaixo)
- `components/CurriculumUploadSection.tsx`

**Nota sobre `useAuth.ts`:** o `refetch` desse hook chama
`refetchSession()` (do Better Auth, não é tRPC — não migra) e
`permsQuery.refetch()` (tRPC — esse sim vira
`utils.permissions.myPermissions.invalidate()`). Não junte os dois.

---

## Tarefa 1 — TTL padrão global de 1h ✅ concluída (27/08/2026)

`staleTime` alterado para `60 * 60 * 1000` em `main.tsx:13` com comentário
de uma linha. `npx tsc --noEmit`: 0 erros.

1. Em [client/src/main.tsx](../../../client/src/main.tsx), mude
   `staleTime: 30_000` para `staleTime: 60 * 60 * 1000` (1h). Adicione um
   comentário curto de uma linha explicando o valor (ex.:
   `// 1h — dados considerados frescos por padrão; invalidação manual via utils.invalidate() nas mutations`).
2. Não mexa em `gcTime` — o default do react-query (5min) já é maior que
   qualquer necessidade aqui, e mudar isso é escopo diferente (memória do
   client, não frequência de request).
3. Não mexa em nenhum dos overrides listados no inventário acima nesta
   tarefa — isso é a Tarefa 2.

**Verificação:** `npx tsc --noEmit` (baseline: 0 erros, medido em
27/08/2026 — a contagem final tem que continuar 0), e abrir o app: login,
navegar entre 2-3 páginas, confirmar que carrega normalmente.

**Commit:** `feat(query): sobe staleTime padrão do react-query para 1h`

---

## Tarefa 2 — Remover overrides de `staleTime` que perderam a razão de ser ✅ concluída (27/08/2026)

`STALE_5MIN` em `PerformanceComercial.tsx` virou `RETRY_1` (só
`refetchOnWindowFocus`/`retry`, sem `staleTime`) nos 9 usos.
`EvolucaoVendedor.tsx` perdeu o `staleTime`, mantendo
`refetchOnWindowFocus: false`. `EvolucaoDiariaVendedor.tsx` teve o objeto
de opções removido por inteiro (só tinha `staleTime`). `npx tsc --noEmit`:
0 erros.

Segue a coluna "Decisão" do inventário acima. Remova **apenas** os 3
overrides marcados "remover o override" / "remover":

1. `pages/comercial/PerformanceComercial.tsx`: apague a constante
   `STALE_5MIN` (linha 287) e o comentário da linha 283, e troque os 9 usos
   de `, STALE_5MIN)` / `...STALE_5MIN` pelas opções que sobrarem depois de
   tirar o staleTime (`refetchOnWindowFocus: false, retry: 1` continuam
   valendo — só o `staleTime: 5 * 60 * 1000` sai). Confira as 2 chamadas
   que fazem spread (`...STALE_5MIN` nas linhas ~326 e ~350) — viram
   `refetchOnWindowFocus: false, retry: 1` inline ou uma constante menor,
   sua escolha.
2. `pages/comercial/EvolucaoVendedor.tsx:106`: tire `staleTime: 5 * 60 * 1000,`
   do objeto de opções, mantenha `refetchOnWindowFocus: false`.
3. `pages/comercial/EvolucaoDiariaVendedor.tsx:42`: tire o objeto de opções
   inteiro se `staleTime` for a única chave, ou só a chave se houver mais.

**Não toque** nos demais overrides do inventário (todos marcados
"manter") — cada um tem motivo específico documentado na tabela.

**Verificação:** `npx tsc --noEmit` (0 erros), abrir
`PerformanceComercial`, `EvolucaoVendedor` e `EvolucaoDiariaVendedor` e
confirmar que os dados carregam.

**Commit:** `refactor(query): remove overrides de staleTime obsoletos com o novo default de 1h`

---

## Tarefa 3 — Padronizar invalidação manual (operações) ✅ concluída (27/08/2026)

Os 11 arquivos do grupo operações migraram de `refetch()` para
`utils.<router>.<query>.invalidate()`. Notas do que fugiu do óbvio:
- `Rotinas.tsx`: as 4 mutations invalidam tanto `routines.list` quanto
  `routines.pending`, já que os badges de "rotinas pendentes" usam a
  segunda query.
- `CustoLed.tsx` tem dois componentes (`CustoSoldaTab`, `CustoLedTab`);
  em `CustoLedTab`, as mutations de tipo de LED (`upsertTipo`/`deleteTipo`)
  também invalidam `getResumoMensal`, pois o custo por tipo entra no
  cálculo do resumo.
- `SugestoesConhecimento.tsx`: `approve` invalida também
  `knowledge.list` (não só `knowledgeSuggestions.list`), porque aprovar
  uma sugestão cria um artigo que aparece na Base de Conhecimento
  (`Conhecimento.tsx`).
- `BibliotecaArquivos.tsx`: upload/update/delete invalidam `list`,
  `categorias` e `stats` juntos.
- `refetchInterval` das tabelas do inventário (`SugestoesConhecimento.tsx`
  15s) não foi tocado, como esperado.

`npx tsc --noEmit`: 0 erros.

Para cada arquivo do "Grupo operações" no inventário:

1. No topo do componente/hook, adicione `const utils = trpc.useUtils();`
   (se ainda não existir).
2. Ache os `useMutation({ onSuccess: () => { refetch(); ... } })` do
   arquivo (`grep -n "refetch()" <arquivo>` ajuda a achar todos).
3. Troque `refetch()` por `utils.<router>.<query>.invalidate(<mesmos args
   da query original>)` — o router/query certo é o mesmo que a linha
   `trpc.<router>.<query>.useQuery(...)` daquele arquivo já usa. Se a query
   tiver argumentos (ex.: filtro, id), passe os mesmos argumentos para
   `invalidate()` para invalidar só aquela entrada — sem argumentos,
   `invalidate()` sozinho invalida todas as variações daquela query.
4. Se o `refetch` da query local não for mais usado em nenhum outro lugar
   do arquivo depois da troca, remova-o da desestruturação do `useQuery`.
5. Confira se alguma outra tela do app deveria ver o mesmo dado atualizado
   (ex.: um dashboard que soma os mesmos dados) — se sim, invalide também
   aquela query. Não é o caso comum nesse grupo, mas confira antes de
   assumir que não é.

**Verificação:** `npx tsc --noEmit` (0 erros), abrir cada uma das 11
páginas do grupo, criar/editar/remover um registro em pelo menos 2 delas e
confirmar que a lista atualiza sem precisar de F5.

**Commit:** `refactor(query): padroniza invalidação manual via utils.invalidate() (operações)`

---

## Tarefa 4 — Padronizar invalidação manual (demais módulos) ✅ concluída (27/08/2026)

Os 9 arquivos migraram de `refetch()` para `utils.invalidate()`. Notas:
- `Alertas.tsx` e `ConsultaCobertura.tsx`: os `refetch()` restantes são
  botão manual de "Atualizar" e disparo de busca (`enabled: false`),
  não `onSuccess` de mutation — ficaram como estavam, como esperado.
- `SincronizacaoCache.tsx`: só o `refetch()` do botão "forçar
  sincronização" virou `utils.admin.obterStatusSincronizacao.invalidate()`;
  os dois `refetchInterval` (30s/60s) não foram tocados.
- `useAuth.ts`: só `permsQuery.refetch()` virou
  `utils.permissions.myPermissions.invalidate()`; `refetchSession()`
  (Better Auth) não muda, como a nota do inventário já previa.
- `BibliotecaErros.tsx` e `Financeiro.tsx` já tinham `trpc.useUtils()`
  declarado no componente — reaproveitado em vez de duplicar.

`npx tsc --noEmit`: 0 erros.

Mesmo procedimento da Tarefa 3, para o "Grupo comercial / qualidade /
retrabalhos / financeiro / logística / admin / hooks" do inventário (9
arquivos). Atenção aos dois casos com nota:

- `pages/qualidade/Alertas.tsx` e `pages/admin/SincronizacaoCache.tsx`: só
  migre o(s) `refetch()` do botão/ação manual. Os `refetchInterval` da
  tabela do inventário ficam como estão — não são o alvo desta tarefa.
- `hooks/useAuth.ts`: só `permsQuery.refetch()` vira
  `utils.permissions.myPermissions.invalidate()`. `refetchSession()`
  (Better Auth) não muda.

**Verificação:** `npx tsc --noEmit` (0 erros), fluxo de login/logout,
abrir cada uma das 9 telas e testar uma ação de escrita em pelo menos 3
delas.

**Commit:** `refactor(query): padroniza invalidação manual via utils.invalidate() (demais módulos)`

---

## Regras do projeto (valem em todas as tarefas)

1. **Yarn, nunca npm/pnpm.**
2. **Type-check é `npx tsc --noEmit`** — não use `yarn check`.
3. **Baseline: `npx tsc --noEmit` está em 0 erros**, medido em 27/08/2026.
   A contagem final de cada tarefa tem que continuar 0.
4. **Um commit por tarefa**, atualizando este arquivo (marcando o que foi
   feito e o que descobriu, igual às sprints anteriores) no mesmo commit.
5. **Não refatore o que a tarefa não pede.** Achou um `refetch()` fora dos
   grupos listados, ou uma query nova sem `staleTime`? Anote aqui e siga —
   não é escopo desta sprint alcançar 100% do repo, é alcançar os arquivos
   já inventariados.
6. Ao terminar a Tarefa 4, mova este arquivo de `docs/sprints/pending/`
   para `docs/sprints/complete/`.
