# Fase 5 — Gráficos: tooltip e paleta compartilhados

**Depende de:** Fase 1 (`components/ChartTooltip.tsx` e `lib/chartColors.ts`)
e Fase 2 (formatadores — o tooltip usa `fmtBrl`/`fmtNum`).

## Objetivo

Duas coisas, ambas mecânicas:

1. Apagar os **7 `CustomTooltip` locais** e usar `<ChartTooltip>`.
2. Apagar os **arrays de cor locais** (`COLORS`/`CORES`) e usar
   `CHART_COLORS` / `chartColor(i)` / `STATUS_COLORS`.

15 páginas usam recharts. As mais densas: `operacoes/Performance.tsx` (19
`ResponsiveContainer`), `comercial/PerformanceComercial.tsx` (17),
`financeiro/PainelDRE.tsx` (13), `Dashboard.tsx` (9).

---

## Parte A — `CustomTooltip` → `<ChartTooltip>`

### Arquivos (lista fechada)

| Arquivo | Definição local |
|---|---|
| `Dashboard.tsx` | linha 41, `const CustomTooltip` |
| `comercial/EvolucaoVendedor.tsx` | linha 51 |
| `comercial/InteligenteClientes.tsx` | linha 73 |
| `comercial/PerformanceComercial.tsx` | linha 115 |
| `financeiro/Financeiro.tsx` | conferir |
| `financeiro/PainelDRE.tsx` | linha 86 (+ `PctTooltip` na 102) |
| `qualidade/DesempenhoColaborador.tsx` | conferir |

### Conversão

O que variava entre as 7 versões era **só a formatação do valor**. Isso vira
a prop `format`.

```tsx
// ANTES (Dashboard.tsx:41) — formatava R$ quando o nome da série continha "R$"
const CustomTooltip = ({ active, payload, label }: any) => { … };
…
<Tooltip content={<CustomTooltip />} />

// DEPOIS
import ChartTooltip from "@/components/ChartTooltip";
import { fmtNum } from "@/lib/format";
…
<Tooltip content={<ChartTooltip format={fmtNum} />} />
```

```tsx
// ANTES (PainelDRE.tsx:86) — usava fmtFull (moeda) em todo valor
function CustomTooltip({ active, payload, label }: any) { … }
…
<Tooltip content={<CustomTooltip />} />

// DEPOIS
<Tooltip content={<ChartTooltip format={fmtBrl} />} />
```

```tsx
// ANTES (PainelDRE.tsx:102) — tooltip de percentual
function PctTooltip({ active, payload, label }: any) { … }
…
<Tooltip content={<PctTooltip />} />

// DEPOIS
<Tooltip content={<ChartTooltip format={fmtPct} />} />
```

Escolha do `format` por gráfico:

| O gráfico mostra | `format` |
|---|---|
| valores em R$ | `fmtBrl` |
| valores em R$ com eixo apertado | `fmtBrlCompact` |
| contagens / quantidades | `fmtNum` |
| percentuais | `fmtPct` |
| valores decimais (ex.: dias médios) | `(v) => fmtNum(v, 1)` |

### ⚠️ Quando NÃO converter

- **Tooltip que mostra campo extra do `payload`** — ex.: além de nome e
  valor, imprime `payload[0].payload.observacao`, um badge de status, ou
  duas linhas por série. O `ChartTooltip` compartilhado só mostra
  nome + valor. Nesse caso **deixe o tooltip local** e anote no relatório.
- **Tooltip com layout muito diferente** (imagem, mini-tabela, gráfico
  dentro do tooltip). Deixe.
- **`<Tooltip />` sem `content=`** — é o tooltip default do recharts. Não
  mexa, não é duplicação.

---

## Parte B — Arrays de cor locais → `chartColors.ts`

### Alvos conhecidos

```bash
grep -rn "const COLORS\|const CORES" --include="*.tsx" client/src/pages
```

| Arquivo | Linha | Ação |
|---|---|---|
| `Dashboard.tsx` | 19 | deletar, usar `chartColor(i)` |
| `comercial/EvolucaoDiariaVendedor.tsx` | 10 (`CORES`) | deletar, usar `chartColor(i)` |
| `comercial/EvolucaoVendedor.tsx` | 18 (`CORES_VENDEDORES`) | ⚠️ ver abaixo |
| `comercial/InteligenteClientes.tsx` | 572 (`CORES` *dentro do JSX*) | deletar, usar `chartColor(i)` |
| `comercial/PerformanceComercial.tsx` | 1028 (`COLORS` *dentro do JSX*) | deletar, usar `chartColor(i)` |
| `operacoes/Performance.tsx` | 1264 (`COLORS`, 3 cores) | deletar, usar `chartColor(i)` |
| `financeiro/AnaliseAtrasos.tsx` | 51 (`CORES_SETORES`, mapa nome→cor) | ⚠️ **não deletar** |

⚠️ **`CORES_SETORES` e `CORES_VENDEDORES` não são paleta, são mapeamento
estável.** Elas garantem que "Setor X" tenha sempre a mesma cor entre
gráficos e entre sessões. Se você trocar por índice, a cor de cada setor
passa a depender da ordem dos dados e muda a cada filtro. **Deixe esses dois
como estão.**

### Conversão

```tsx
// ANTES
const COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7", "#ec4899"];
…
{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}

// DEPOIS
import { chartColor } from "@/lib/chartColors";
…
{data.map((_, i) => <Cell key={i} fill={chartColor(i)} />)}
```

Repare que a paleta compartilhada tem 10 cores e algumas locais tinham 8 ou
3. **As cores das séries vão mudar de tom em alguns gráficos.** Isso é
esperado e é o objetivo — não tente preservar a cor exata de cada série.

### Hex soltos em `fill=` / `stroke=` / `style={{ color }}`

Onde uma cor for **semântica** (verde = bom, vermelho = ruim, âmbar =
atenção), troque pelo token:

```tsx
// ANTES
<Bar dataKey="ok" fill="#22c55e" />
<Bar dataKey="falha" fill="#ef4444" />

// DEPOIS
import { STATUS_COLORS } from "@/lib/chartColors";
<Bar dataKey="ok" fill={STATUS_COLORS.positivo} />
<Bar dataKey="falha" fill={STATUS_COLORS.negativo} />
```

Tabela de equivalência (a mesma da Fase 4):

| Hex | Token |
|---|---|
| `#22c55e`, `#16a34a`, `#10b981` | `STATUS_COLORS.positivo` |
| `#ef4444`, `#dc2626` | `STATUS_COLORS.negativo` |
| `#f59e0b` | `STATUS_COLORS.atencao` |
| `#3b82f6`, `#1e6fd9` | `STATUS_COLORS.info` |
| `#8b5cf6` | `STATUS_COLORS.destaque` |
| `#64748b`, `#94a3b8` | `STATUS_COLORS.neutro` |

**Não converta** hex que é cor de fundo, borda, sombra ou gradiente
decorativo (`#f1f5f9`, `#e2e8f0`, `#0f172a`). Só cor de dado.

---

## Fora de escopo nesta fase

- **`ui/chart.tsx` (shadcn) tem adoção zero.** Adotá-lo exigiria reescrever
  cada gráfico com `ChartContainer`/`ChartConfig` — é uma sprint própria.
  **Não comece isso aqui.**
- Mudar tipo de gráfico, eixos, `domain`, `tickFormatter`, ordenação de
  série, ou responsividade.

---

## Verificação

```bash
yarn run check
yarn test
yarn build
```

```bash
# deve ir a zero (ou sobrar só os justificados)
grep -rn "CustomTooltip\|PctTooltip" --include="*.tsx" client/src/pages | wc -l

# deve sobrar só CORES_SETORES e CORES_VENDEDORES
grep -rn "const COLORS\|const CORES" --include="*.tsx" client/src/pages
```

Rode `yarn dev` e **passe o mouse sobre os gráficos** de: Dashboard, Painel
DRE, Performance Comercial, Evolução Vendedor, Desempenho Colaborador. O
tooltip precisa aparecer, com o nome da série e o valor **formatado na
unidade certa** — R$ onde é dinheiro, % onde é percentual. Tooltip mostrando
`1234.5678` cru é erro de `format`.

## Definição de pronto

- [ ] 7 `CustomTooltip` locais removidos (ou justificados)
- [ ] `format` correto por gráfico (conferido passando o mouse)
- [ ] Arrays `COLORS`/`CORES` removidos, exceto `CORES_SETORES` e `CORES_VENDEDORES`
- [ ] Hex semânticos trocados por `STATUS_COLORS`
- [ ] `ui/chart.tsx` NÃO foi adotado (fora de escopo)
- [ ] `yarn run check`, `yarn test`, `yarn build` passando
- [ ] Commit: `refactor(pages): unifica tooltip e paleta de gráficos (sprint pages, fase 5)`
