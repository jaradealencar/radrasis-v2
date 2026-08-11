# Fase 4 — `KpiCard` local → `components/KpiCard.tsx`

**Depende de:** Fase 1 (`components/KpiCard.tsx` criado) e Fase 2
(formatadores já centralizados — os KPIs formatam valores).

## Objetivo

Apagar as **7 definições locais de `KpiCard`** e usar a compartilhada.
Também unificar os `ProgressBar` locais (3 arquivos), que vivem no mesmo
contexto de KPI.

## Lista fechada de arquivos

| Arquivo | Linha da definição local | Variante equivalente |
|---|---|---|
| `Dashboard.tsx` | 21 | `accent` |
| `comercial/PerformanceComercial.tsx` | 73 | `accent` |
| `comercial/InteligenteClientes.tsx` | 43 | conferir no arquivo |
| `financeiro/CustosFixos.tsx` | 83 | `border` |
| `financeiro/MarketingFinanceiro.tsx` | conferir | conferir |
| `financeiro/PainelDRE.tsx` | conferir | conferir |
| `operacoes/Performance.tsx` | conferir | conferir |

Para os marcados "conferir": leia a definição local e escolha a variante pela
estrutura visual —

- Se o card é um `<Card className="border-l-4" style={{ borderLeftColor }}>`
  → `variant="border"`.
- Se é uma `<div>` com faixa de gradiente no topo e ícone em caixa
  tonalizada → `variant="accent"`.

## API do componente (referência)

```tsx
import KpiCard from "@/components/KpiCard";
import { fmtBrl } from "@/lib/format";
import { STATUS_COLORS } from "@/lib/chartColors";

<KpiCard
  label="Custo total"
  value={fmtBrl(total)}
  sub="últimos 30 dias"
  icon={DollarSign}          // componente lucide OU nó pronto
  color={STATUS_COLORS.negativo}
  variant="border"           // "accent" (default) | "border"
  onClick={() => abrirDetalhe()}   // opcional
/>
```

## Renomeação de props

As versões locais usam nomes diferentes. Mapeamento:

| Prop local (pt) | Prop local (en) | Prop do compartilhado |
|---|---|---|
| `titulo` | `label` | `label` |
| `valor` | `value` | `value` |
| `sub` | `sub` | `sub` |
| `cor` | `color` | `color` |
| `icon` | `icon` | `icon` |
| `destaque` | `accent` | ver abaixo ⚠️ |

⚠️ **`destaque` e `accent` não são a mesma coisa** e nenhum dos dois vira
prop do componente compartilhado:

- Em `financeiro/CustosFixos.tsx`, `destaque` só adiciona `shadow-md`. Se
  algum call site passava `destaque`, adicione `className="shadow-md"` nesse
  call site.
- Em `Dashboard.tsx`, `accent` liga/desliga a faixa de gradiente. O
  `variant="accent"` compartilhado **sempre** desenha a faixa. Se algum call
  site passava `accent={false}` (ou omitia), o card ganha uma faixa fina de
  2px que antes não tinha — **isso é aceitável**, é a padronização. Não crie
  prop nova para preservar a diferença.

## `icon`: dois formatos aceitos

O componente compartilhado aceita os dois estilos que existem hoje, então
**não precisa converter**:

```tsx
icon={DollarSign}                    // componente lucide — cor e tamanho aplicados pelo card
icon={<DollarSign size={16} />}      // nó pronto — o card só aplica a cor
```

Prefira o primeiro formato quando o call site já passava um componente.

---

## Passo a passo por arquivo

1. Leia a definição local do `KpiCard` inteira.
2. Anote a variante e qualquer diferença visual real (borda, sombra,
   gradiente, tamanho da fonte do valor).
3. Delete a definição local.
4. Adicione `import KpiCard from "@/components/KpiCard";`.
5. Em cada call site, renomeie as props conforme a tabela e adicione
   `variant` se for `"border"`.
6. Se o call site passava uma cor em hex solto, troque por `STATUS_COLORS.*`
   quando houver equivalente óbvio:
   - `#22c55e` / `#16a34a` → `STATUS_COLORS.positivo`
   - `#ef4444` / `#dc2626` → `STATUS_COLORS.negativo`
   - `#f59e0b` → `STATUS_COLORS.atencao`
   - `#3b82f6` / `#1e6fd9` → `STATUS_COLORS.info`
   - `#8b5cf6` → `STATUS_COLORS.destaque`
   - `#64748b` / `#94a3b8` → `STATUS_COLORS.neutro`

   Qualquer outro hex: **deixe o hex**. Não force um token semântico errado.

---

## Parte B — `ProgressBar`

Três arquivos definem o próprio: `comercial/MetasComerciais.tsx:27`,
`comercial/PerformanceComercial.tsx:175`, `qualidade/PlanosAcao.tsx`.

O projeto já tem `client/src/components/ui/progress.tsx` (shadcn, adoção
zero). **Antes de converter, leia as três implementações locais.**

- Se as três forem "barra de fundo cinza + barra preenchida colorida por
  percentual", troque pelas do shadcn:

  ```tsx
  import { Progress } from "@/components/ui/progress";
  <Progress value={pct(real, meta)} className="h-2" />
  ```

  A cor do preenchimento no shadcn vem do tema. Se o local pintava por
  faixa (verde ≥100%, âmbar ≥70%, vermelho abaixo), preserve com
  `className` no indicador ou **deixe o componente local** — não perca a
  semântica de cor só para usar o shadcn.

- Se alguma versão local tiver rótulo embutido, marcador de meta, ou
  animação própria, **deixe como está** e anote no relatório.

Esta parte B é opcional se as implementações divergirem demais. **Não gaste
mais que um terço da fase nela.**

---

## Verificação

```bash
yarn run check
yarn test
yarn build
```

```bash
# deve ir a zero
grep -rn "function KpiCard\|const KpiCard" --include="*.tsx" client/src/pages | wc -l
```

Rode `yarn dev` e abra **todas as 7 páginas** da lista. Os cards de KPI são
a primeira coisa que se vê em cada uma — se algum ficar sem valor, sem
ícone, ou com cor errada, é regressão. Confira em especial:

- **Dashboard** — muitos cards, alguns clicáveis (abre modal). O `onClick`
  precisa continuar funcionando.
- **Performance Comercial** — os cards têm `meta`/`metaReal`/`metaTarget`
  na versão local. Se o `KpiCard` compartilhado não cobrir isso, **mantenha
  o componente local desse arquivo** (renomeado para `KpiCardComMeta`) e
  anote. Não é derrota: é o card que tem responsabilidade a mais.

## Definição de pronto

- [ ] 7 definições locais de `KpiCard` removidas (ou justificadas, caso do
      `PerformanceComercial`)
- [ ] Props renomeadas em todos os call sites
- [ ] Hex trocados por `STATUS_COLORS` onde havia equivalente óbvio
- [ ] `onClick` dos cards clicáveis do Dashboard funcionando
- [ ] As 7 páginas conferidas visualmente
- [ ] `yarn run check`, `yarn test`, `yarn build` passando
- [ ] Commit: `refactor(pages): unifica KpiCard e ProgressBar (sprint pages, fase 4)`
