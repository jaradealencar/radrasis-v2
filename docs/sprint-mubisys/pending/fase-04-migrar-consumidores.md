# Fase 4 — Migrar os consumidores restantes para o cliente único

**Achados atacados:** A4 (timeout de 90 s numa função de 60 s), A7 (busca de
produto que não filtra).
**Depende de:** Fases 1, 2 e 3.
**Toca:** `server/routers/crm.ts`, `server/routers/performanceComercial.ts`,
`server/routers/performanceAbc.ts`.

É a maior fase da sprint e a que **menos** pode mudar comportamento: os números
de CRM, Performance Comercial e Curva ABC precisam sair idênticos no fim.

---

## 1. O que sobrou

Depois das Fases 1–3, ainda existem três implementações HTTP paralelas:

| Arquivo | Função | Timeout | Problema específico |
|---|---|---|---|
| `crm.ts:59` | `fetchMubisys` + `fetchAllPages` | 25 s | Engole todo erro em `null`; `per_page=100` (a API já dá 500) |
| `performanceComercial.ts:100` | `fetchMubisys` + `fetchMubisysWithRetry` + `fetchAll` | **90 s × 3** | A4: a função morre aos 60 s, o retry nunca roda |
| `performanceAbc.ts:10` e `:446` | `fetchMubisysOsList` + inline | 20 s / 15 s | `if (status !== 201) break` — frágil; e A7 |

## 2. Regra de migração

Para cada um: **substituir o transporte, preservar a lógica de negócio letra por
letra.** Filtros, normalizações de nome, regras de `versao_atual`, exclusão de
retrabalho/amostra/cortesia, cálculo de metas — nada disso muda.

O padrão da troca:

```ts
// ANTES
const resp = await fetchMubisys(publicKey, accessToken, `/orcamento?...&page=${p}&per_page=100`);
const items = resp?.data?.data ?? [];

// DEPOIS
import { listarOrcamentosMubiSys } from "../integrations/mubisys-client";
const { itens, completo } = await listarOrcamentosMubiSys({ datainicial, datafinal, status: "TODOS" });
```

E some do arquivo: `import https from "https"`, `process.env.MUBISYS_*`, a
função `fetchMubisys*` local e o loop de paginação manual.

## 3. Por arquivo

### 3.1 `crm.ts`

Dois call sites (`getPropostas` na linha 168/175, e o de linha ~538) mais um
endpoint de debug (linha ~676). Trocar `fetchAllPages` por
`listarOrcamentosMubiSys`.

⚠️ **Atenção ao silêncio.** Hoje `fetchMubisys` resolve `null` em qualquer
falha, e `fetchAllPages` transforma isso numa lista vazia — o CRM mostra "0
propostas" quando o ERP está fora do ar. Com o cliente da Fase 1, falha lança
`MubiSysError`. **Isso é a correção, não uma regressão:** deixe propagar para
o tRPC, para o usuário ver erro em vez de zero. Só 404 (janela vazia) vira lista
vazia, e isso já está tratado dentro de `listarTudo`.

O endpoint de debug (`// DEBUG: inspecionar estrutura de um orçamento`) só
existia para descobrir o formato da resposta — o que agora está documentado em
`docs/integracao-mubisys.md` §1. **Remover.**

### 3.2 `performanceComercial.ts`

O arquivo mais pesado: ~10 call sites (linhas 286, 658, 669, 1458, 1702, 2120,
2211 e vizinhanças). Migrar todos para `listarOSMubiSys` /
`listarOrcamentosMubiSys`.

Três cuidados:

1. **A4 — timeouts.** `fetchMubisysWithRetry(…, 3, 90000)` sai inteiro. O
   cliente da Fase 1 usa `TIMEOUT_LISTA_MS` (45 s), que cabe no `maxDuration`
   de 60 s. **Não recrie retry aqui:** três tentativas de 45 s não cabem em
   lugar nenhum. Uma tentativa, e o cache persistente cobre a repetição.
2. **Preservar a regra do cache persistente.** A lógica atual só grava em
   `mubisys_api_cache` se **ambas** as buscas foram completas (linha 351) —
   está certa e evita gravar dado parcial. O `completo` devolvido pela Fase 1
   substitui o `osResult.complete` atual, com a mesma semântica.
3. **Não mexer em `filtrodata`.** A linha 341 usa `APROVACAO` e **está certa** —
   decidido em 17/08/2026: o faturamento do mês conta as OS **aprovadas** no
   mês. `todo.md:1404` afirma o contrário e é ele que será corrigido (Fase 6).
   Migre o transporte mantendo `filtrodata=APROVACAO` exatamente como está.

Depois de migrar, comparar antes/depois num mês fechado (ex.: julho/2026): os
totais de OS, cotações e faturamento por vendedor têm que bater **exatamente**.
Limpe o cache antes de cada leitura, senão você compara cache com cache:

```sql
DELETE FROM mubisys_api_cache WHERE mes = 7 AND ano = 2026;
```

### 3.3 `performanceAbc.ts`

- `fetchAllOsForMonth` → `listarOSMubiSys`. O `if (status !== 201) break`
  desaparece junto com o transporte (o cliente da Fase 1 trata a faixa 2xx).
- `getProdutosERP` (linha ~433) → `listarProdutos()` da Fase 1, **com filtro em
  memória** (A7):

```ts
const termo = busca.trim().toLowerCase();
const produtos = (await listarProdutos())
  .map(p => ({
    id: String(p.id ?? p.codigo ?? ""),
    nome: String(p.nome ?? p.descricao ?? ""),
    codigo: String(p.codigo ?? p.id ?? ""),
    categoria: String(p.categoria ?? ""),
    ativo: p.ativo !== false,
  }))
  .filter(p => p.nome && (!termo || p.nome.toLowerCase().includes(termo)));
```

O parâmetro `search` da API é ignorado (verificado: `/produto?search=letreiro`
devolve os mesmos 65 produtos que `/produto`), e o client não refiltra — hoje
digitar "Letreiro" devolve os 20 primeiros produtos do cadastro, quaisquer que
sejam. O cadastro tem 65 produtos, então trazer tudo e filtrar aqui é barato.

## 4. Verificação

```bash
yarn run check
yarn test
grep -rn "https.get\|process.env.MUBISYS" server/routers/    # tem que voltar VAZIO
yarn dev
```

Manual, comparando com a versão anterior (rode antes de migrar e anote):

1. `/comercial/performance` → julho/2026 → cotações, vendas, faturamento por
   vendedor **idênticos**.
2. `/comercial/crm` → propostas abertas: mesma contagem.
3. `/operacoes/performance` → Curva ABC de clientes e de produtos, julho/2026:
   mesmas classes A/B/C.
4. `/operacoes/metas` → "Buscar Produto no ERP" com `letreiro`: agora só
   produtos com "letreiro" no nome (antes: os 20 primeiros do cadastro).

## 5. Critério de pronto

- [ ] `grep -rn "https.get\|process.env.MUBISYS" server/routers/` vazio.
- [ ] Nenhum `fetchMubisys*` local sobrou.
- [ ] Nenhum retry de 90 s sobrou.
- [ ] Busca de produto filtra de verdade.
- [ ] Endpoint de debug do CRM removido.
- [ ] Números de julho/2026 idênticos aos de antes da fase, com cache limpo nas
      duas medições.
