# Fase 12 — Varredura final e fechamento

**Depende de:** todas as fases anteriores (1–11).
Só comece quando as 11 estiverem commitadas.

## Objetivo

Recolher o que sobrou, medir o resultado da sprint e fechar. Esta fase
**não** introduz padrão novo — só limpa e documenta.

---

## Parte A — Varredura de sobras

Rode cada comando e trate o que aparecer.

### 1. Tabelas cruas restantes

```bash
grep -rn "<table" --include="*.tsx" client/src/pages
```

**Devem sobrar exatamente 2**, ambas strings de exportação HTML (não JSX):

- `comercial/TabelaPrecos.tsx:716`
- `financeiro/Financeiro.tsx:294`

Qualquer outra é uma tabela esquecida por alguma das fases 6–10 — converta
agora seguindo a receita da Fase 6.

### 2. Componentes locais que deveriam ter sumido

```bash
grep -rn "function KpiCard\|const KpiCard\|CustomTooltip\|PctTooltip" \
  --include="*.tsx" client/src/pages

grep -rn "function formatDate\|function fmtBrl\|function formatCurrency\|function fmtDate" \
  --include="*.tsx" client/src/pages
```

Para cada sobrevivente: ou converta, ou confirme que há justificativa
registrada (ex.: o `KpiCard` com metas de `PerformanceComercial`, os
tooltips com campos extras). Se não houver justificativa, converta.

### 3. Imports órfãos

```bash
yarn run check
```

O `tsc` não reclama de import não usado por padrão. Confie no ESLint se o
projeto tiver, senão faça uma passada nos arquivos mais editados:

```bash
git diff --name-only main...HEAD -- client/src/pages | sort -u
```

Procure especialmente por ícones lucide que ficaram sem uso depois da Fase 3
(o `PageHeader` recebe o componente do ícone, mas se o ícone só era usado no
cabeçalho antigo e agora vem via prop, o import continua válido — cuidado
para não remover o que ainda é usado).

### 4. Arrays de cor restantes

```bash
grep -rn "const COLORS\|const CORES" --include="*.tsx" client/src/pages
```

Devem sobrar só `CORES_SETORES` (`financeiro/AnaliseAtrasos.tsx:51`) e
`CORES_VENDEDORES` (`comercial/EvolucaoVendedor.tsx:18`) — são mapeamentos
nome→cor, não paletas. Ver Fase 5.

### 5. `git status` limpo

```bash
git status
```

Nenhum arquivo `.bak`, `.orig`, script temporário ou arquivo do scratchpad
deve ter entrado no repo.

---

## Parte B — Medição do resultado

Rode e anote:

```bash
# linhas em pages/
find client/src/pages -name "*.tsx" -not -name "*.test.tsx" -exec cat {} + | wc -l

# arquivos usando ui/table
grep -rl "components/ui/table" --include="*.tsx" client/src/pages | wc -l

# tabelas cruas em JSX (esperado: 2, as de export)
grep -rn "<table" --include="*.tsx" client/src/pages | wc -l

# adoção dos componentes shadcn antes zerados
for c in empty spinner skeleton table progress; do
  n=$(grep -rl "ui/$c" --include="*.tsx" client/src/pages | wc -l)
  echo "ui/$c: $n arquivos"
done
```

Preencha a tabela de resultado:

| Métrica | Antes | Meta | Real |
|---|---|---|---|
| Linhas em `pages/` | ~43.200 | ≤ 38.000 | 42.779 |
| `<table>` cru em JSX | 65 | 2 (só export) | 4 (2 export + 2 adiadas, `.tech-table`) |
| Arquivos usando `ui/table` | 2 | ~31 | 28 |
| `KpiCard` locais | 7 | 0 | 2 (justificados) |
| `CustomTooltip` locais | 7 | 0 | 2 (justificados) |
| Formatadores locais | 10+ | 0 | 4 (justificados) |

**Se a redução de linhas ficou bem abaixo da meta, não force.** O número é
uma expectativa, não um contrato — melhor 40.000 linhas consistentes que
37.000 com atalhos. Anote o real e siga.

---

## Parte C — Documentar o padrão

Adicione ao `AGENTS.md`, na seção de convenções do client, um bloco curto
(não mais que 20 linhas) dizendo que:

- Tabela de dados usa `@/components/ui/table` — **não** escreva `<table>` na
  mão. Exceção: HTML montado em string para exportação.
- Cabeçalho de página usa `@/components/PageHeader`.
- Card de indicador usa `@/components/KpiCard`.
- Tooltip de gráfico recharts usa `@/components/ChartTooltip`.
- Formatação de moeda/número/data/percentual vem de `@/lib/format` — não
  crie `toLocaleString` inline nem formatador local.
- Cor de série de gráfico vem de `@/lib/chartColors` (`chartColor(i)` para
  categórica, `STATUS_COLORS` para semântica).
- Estados de carregando e vazio usam `@/components/ui/spinner` e
  `@/components/ui/empty`.

Escreva em português, no tom do resto do arquivo. **Não reescreva outras
seções do `AGENTS.md`.**

---

## Parte D — Fechar a sprint

Atualize o `README.md` desta pasta:

1. Marque cada fase concluída com ✅ na tabela do índice.
2. Preencha a tabela "Meta da sprint" com a coluna de resultado real.
3. Adicione, ao final, uma seção **"Não feito nesta sprint"** listando o que
   ficou pendente e por quê. Candidatos conhecidos:
   - `logistica/Empacotamento.tsx` (5.012 linhas) precisa ser quebrado em
     componentes — sprint própria
   - `comercial/PerformanceComercial.tsx` (2.773 linhas) — idem
   - `operacoes/Performance.tsx` (1.980 linhas) — idem
   - Adoção de `ui/chart.tsx` (shadcn) nos gráficos recharts — sprint própria
   - `ui/field`, `ui/item`, `ui/input-group`, `ui/button-group` seguem com
     adoção zero; os formulários das páginas ainda montam `Label` + `Input`
     na mão
   - `ui/pagination` usado em 1 arquivo; várias listas longas ainda
     renderizam tudo de uma vez
   - Qualquer tabela/tooltip/KpiCard que ficou de fora com justificativa

---

## Verificação final

```bash
yarn run check
yarn test
yarn build
```

Depois, `yarn dev` e um passeio completo: abra **pelo menos uma página de
cada módulo** (raiz, admin, comercial, financeiro, logística, operações,
qualidade, retrabalhos). Procure por:

- tabela desalinhada ou com coluna a mais/menos
- KPI sem valor ou com cor errada
- gráfico sem tooltip, ou tooltip com número cru
- cabeçalho duplicado ou botão de ação sumido
- console do navegador sem warnings novos do React (especialmente
  `Each child in a list should have a unique "key" prop` — sinal de `key`
  perdido em conversão de tabela)

## Definição de pronto

- [ ] Varredura da Parte A limpa (só as 2 tabelas de export sobrando)
- [ ] Métricas da Parte B medidas e anotadas
- [ ] `AGENTS.md` com o bloco de convenções novo
- [ ] `README.md` da sprint atualizado com ✅, resultado real e
      "Não feito nesta sprint"
- [ ] Passeio por todos os módulos, sem warning novo no console
- [ ] `yarn run check`, `yarn test`, `yarn build` passando
- [ ] Commit: `docs: fecha a sprint de refatoração de pages (sprint pages, fase 12)`
