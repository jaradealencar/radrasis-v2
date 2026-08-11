# Fase 2 — Formatadores: tudo para `lib/format.ts`

**Depende de:** Fase 1 (assume que `client/src/lib/format.ts` já existe e
exporta `fmtBrl`, `fmtBrlCompact`, `fmtNum`, `fmtPct`, `pct`, `fmtDate`,
`fmtDateTime`, `fmtDateShort`, `MESES`, `MESES_ABREV`).

## Objetivo

Remover todas as funções locais de formatação das páginas e usar as de
`@/lib/format`. Hoje há 10+ implementações da mesma coisa e ~190 chamadas
`toLocaleString(...)` inline espalhadas.

Esta fase é **puramente mecânica**: nenhuma lógica muda, só de onde vem a
função.

---

## Parte A — Deletar funções locais e importar as compartilhadas

Lista fechada. Em cada arquivo: apague a definição local, adicione o import
de `@/lib/format`, e corrija as chamadas se o nome mudar.

| Arquivo | Função local a deletar | Substituir por |
|---|---|---|
| `Auditoria.tsx:47` | `function formatDate(d)` | `fmtDateTime` de `@/lib/format` |
| `comercial/CrmAuditoria.tsx:28` | `function formatDate(iso)` | `fmtDate` |
| `comercial/CrmAuditoria.tsx:33` | `function formatDateShort(iso)` | `fmtDateShort` |
| `comercial/CRM.tsx:60` | `function fmtDate(s)` | `fmtDate` (mesmo nome — só troque por import) |
| `comercial/CRM.tsx:67` | `function fmtShort(d)` | `fmtDateShort` |
| `comercial/EvolucaoDiariaVendedor.tsx:24` | `function fmtBrl(v)` | `fmtBrl` |
| `comercial/EvolucaoDiariaVendedor.tsx:27` | `function fmtNum(v)` | `fmtNum` |
| `comercial/MetasComerciais.tsx:22` | `function pct(real, meta)` | `pct` |
| `logistica/Assertividade.tsx` | `formatDate` local | `fmtDate` |
| `logistica/LogisticaDashboard.tsx` | `formatDate` local | `fmtDate` |
| `logistica/Transportadoras.tsx` | `formatDate` local | `fmtDate` |
| `operacoes/PopRelatorio.tsx` | `formatDate` local | `fmtDate` |
| `retrabalhos/Relatorio.tsx` | `formatCurrency` local | `fmtBrl` |
| `comercial/InteligenteClientes.tsx:34` | `function formatarDataCalculo(d)` | `fmtDateTime` |

### ⚠️ Antes de trocar, compare o comportamento

As funções locais têm cada uma seu jeito de tratar nulo e datas inválidas.
`lib/format.ts` retorna `"—"`. Para **cada** função da tabela acima:

1. Leia a implementação local antes de apagar.
2. Se ela retornava `""`, `"-"`, `"N/A"` ou `"Sem data"` para nulo, veja
   **onde é chamada**:
   - Se o resultado vai direto pra tela (texto de célula, label), pode
     trocar para `"—"` — é melhoria, não regressão.
   - Se o resultado alimenta **comparação, ordenação, `key`, ou é
     concatenado numa URL / string de export**, `"—"` quebra. Nesse caso
     **não converta essa chamada**; deixe a função local, e anote no
     relatório final da fase por quê.
3. Se a função local aplicava **fuso ou parsing especial** (ex.:
   `comercial/CRM.tsx:72 parseDateLocal`, que monta `{y, m, d}` a partir de
   string para evitar shift de timezone), **não a apague** — ela não é
   formatação, é parsing, e está fora do escopo desta fase.

**Não toque nestas, apesar do nome parecido** (são parsing/lógica, não
formatação):

- `comercial/CRM.tsx:72` `parseDateLocal`
- `comercial/CRM.tsx:97` `getDates`
- `comercial/CRM.tsx:104` `toDateKey`
- `comercial/CrmAuditoria.tsx:13` `getWeekRange`
- `comercial/InteligenteClientes.tsx:19` `pad` / `:21` `anoMesAtual` / `:26` `formatarPeriodo`
- `comercial/TabelaPrecos.tsx:39` `extractNumber`

---

## Parte B — Substituir `toLocaleString` inline

Encontre as ocorrências:

```bash
grep -rn "toLocaleString\|Intl.NumberFormat" --include="*.tsx" client/src/pages
```

Concentração por arquivo (as maiores primeiro — ataque nesta ordem):

| Arquivo | Ocorrências |
|---|---|
| `comercial/PerformanceComercial.tsx` | 53 |
| `Dashboard.tsx` | 16 |
| `retrabalhos/Relatorio.tsx` | 10 |
| `comercial/MetasComerciais.tsx` | 9 |
| `logistica/Solicitacoes.tsx` | 6 |
| `operacoes/Performance.tsx` | 4 |
| `logistica/ImportarCte.tsx` | 4 |
| `logistica/Empacotamento.tsx` | 4 |
| `comercial/EvolucaoVendedor.tsx` | 4 |
| `retrabalhos/Reincidencia.tsx`, `qualidade/Metas.tsx` | 3 cada |
| ~13 arquivos restantes | 1–2 cada |

### Mapeamento literal

```tsx
// ANTES
v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
// DEPOIS
fmtBrl(v)

// ANTES
v.toLocaleString("pt-BR")
// DEPOIS
fmtNum(v)

// ANTES
v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// DEPOIS
fmtNum(v, 2)

// ANTES
`R$ ${v.toFixed(2)}`
// DEPOIS
fmtBrl(v)

// ANTES
`${v.toFixed(1)}%`
// DEPOIS
fmtPct(v)

// ANTES
d.toLocaleDateString("pt-BR")
// DEPOIS
fmtDate(d)

// ANTES
d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
// DEPOIS
fmtDateShort(d)
```

### ⚠️ Não converta estes casos

- **`toLocaleString` com opções que `format.ts` não cobre** — ex.:
  `{ month: "long", year: "numeric" }`, `{ weekday: "short" }`,
  `notation: "compact"` com configuração diferente. Deixe como está. Não
  invente função nova em `format.ts` (isso seria trabalho da Fase 1).
- **`toLocaleString` fora de JSX de exibição** — dentro de geração de CSV,
  de HTML para Excel (`financeiro/Financeiro.tsx:294`,
  `comercial/TabelaPrecos.tsx:716`) ou de `sort()`. Formato de export é
  contrato com o Excel; não mexa.
- **`toFixed` usado em cálculo**, não em exibição (ex.:
  `Number(x.toFixed(2))` para arredondar antes de somar). Isso é lógica.

---

## Parte C — Arrays de meses duplicados

Vários arquivos declaram o próprio array de meses. Troque por `MESES` /
`MESES_ABREV` de `@/lib/format`:

```bash
grep -rn "const MESES" --include="*.tsx" client/src/pages
```

Regras:
- Se o array local for **exatamente** `["Janeiro", …, "Dezembro"]` → use `MESES`.
- Se for `["Jan", …, "Dez"]` → use `MESES_ABREV`.
- Se for **maiúsculo** (`["JANEIRO", …]`, como em `components/FilterBar.tsx`)
  ou tiver ordem/conteúdo diferente → **deixe como está**. Não normalize
  caixa nesta fase; isso mudaria o que aparece na tela.

---

## Verificação

```bash
yarn run check
yarn test
yarn build
```

Contagens que devem cair:

```bash
# deve cair de ~190 para bem menos
grep -rn "toLocaleString" --include="*.tsx" client/src/pages | wc -l

# deve ir a zero (as definições locais da tabela da Parte A)
grep -rn "function formatDate\|function fmtBrl\|function formatCurrency" \
  --include="*.tsx" client/src/pages | wc -l
```

Rode `yarn dev` e confira **pelo menos** estas páginas, que são as mais
afetadas: Performance Comercial, Dashboard, Relatório de Retrabalhos, Metas
Comerciais. Valores em R$ e datas devem estar idênticos aos de antes.

## Definição de pronto

- [ ] Todas as 14 funções locais da Parte A removidas ou justificadas
- [ ] `toLocaleString` inline substituído onde o mapeamento se aplica
- [ ] Arrays de meses duplicados consolidados
- [ ] Nenhum valor na tela mudou (conferido em 4 páginas)
- [ ] `yarn run check`, `yarn test`, `yarn build` passando
- [ ] Commit: `refactor(pages): centraliza formatadores em lib/format (sprint pages, fase 2)`
