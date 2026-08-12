# Fase 9 — Tabelas D: operações

**Depende de:** Fase 1 e Fase 6.

## Escopo (lista fechada — 4 arquivos, 15 tabelas)

| Arquivo | Linhas dos `<table>` | Tamanho |
|---|---|---|
| `operacoes/CustoLed.tsx` | 380, 450 | 733 linhas |
| `operacoes/MetasOperacionais.tsx` | 640, 700 | 816 linhas |
| `operacoes/PopRelatorio.tsx` | 113, 215 | 257 linhas |
| `operacoes/Performance.tsx` | 789, 884, 920, 956, 1081, 1105, 1129, 1302, 1838 | **1.980 linhas** ⚠️ |

> Linhas são do início da sprint e andam conforme você edita. Reconfirme com
> `grep -n "<table" client/src/pages/operacoes/<arquivo>`.

`operacoes/Performance.tsx` sozinho tem **9 das 15 tabelas**. É a fase com
maior densidade de tabelas por arquivo.

---

## Estratégia para `Performance.tsx`

```bash
grep -n "<table" client/src/pages/operacoes/Performance.tsx
```

**Converta de baixo para cima** — 1838, 1302, 1129, 1105, 1081, 956, 920,
884, 789. Assim os números de linha das tabelas ainda não convertidas não se
deslocam, e o `grep` inicial vale a fase inteira.

**Rode `yarn run check` a cada 2 ou 3 tabelas.** Nove conversões seguidas
sem verificação tornam impossível localizar o erro.

Note o bloco 884 / 920 / 956 e o bloco 1081 / 1105 / 1129: são grupos de
tabelas quase idênticas, provavelmente lado a lado num grid comparativo.
Converta cada uma **individualmente**. Não tente extrair um componente
compartilhado — isso é mudança estrutural, fora do escopo desta sprint.

---

## Receita (resumo — a versão completa está na Fase 6)

```tsx
import {
  Table, TableHeader, TableBody, TableFooter,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";
```

| Antes | Depois |
|---|---|
| `<table>` `<thead>` `<tbody>` `<tfoot>` | `<Table>` `<TableHeader>` `<TableBody>` `<TableFooter>` |
| `<tr>` `<th>` `<td>` | `<TableRow>` `<TableHead>` `<TableCell>` |

**Remova** do JSX: `w-full` e `text-sm` no `<table>`; `overflow-x-auto` no
div wrapper; `border-b` e `hover:bg-*` no `<tr>`; `text-left` /
`font-medium` / `text-muted-foreground` e padding padrão no `<th>`/`<td>`.

**Mantenha:** `text-right`, `text-center`, larguras fixas,
`whitespace-nowrap`, `font-mono`, `sticky`, classes condicionais.

**Nunca perca:** `key`, `colSpan`, `rowSpan`, `onClick`, `title`, `aria-*`.

---

## Cuidados específicos de operações

### 1. Tabelas de custo com célula editável

`operacoes/CustoLed.tsx` e `operacoes/CustoSolda.tsx` têm células que viram
`<Input>` ao clicar, ou já são `<Input>` direto dentro do `<td>`.

```tsx
// ANTES
<td className="px-2 py-1">
  <Input value={v} onChange={e => setV(e.target.value)} className="h-8 text-right" />
</td>

// DEPOIS — o Input vai inteiro, sem mudança
<TableCell className="px-2 py-1">
  <Input value={v} onChange={e => setV(e.target.value)} className="h-8 text-right" />
</TableCell>
```

⚠️ Aqui **mantenha o padding customizado** (`px-2 py-1`). O `TableCell`
padrão tem padding maior, feito para texto; numa linha de inputs isso
engorda a tabela e pode quebrar o layout. Padding apertado em célula com
input é intencional, não é resíduo.

⚠️ **Não mexa em `onChange`, `onBlur`, `value` nem no estado.** Se a célula
salva ao sair do foco, esse comportamento tem que sobreviver intacto.

### 2. `PopRelatorio.tsx` — tabelas de impressão

As duas tabelas de `operacoes/PopRelatorio.tsx` fazem parte de um relatório
pensado para impressão/PDF. Antes de converter, procure no arquivo por:

- classes `print:` (`print:hidden`, `print:text-black`, `print:break-inside-avoid`)
- `@media print` no CSS
- uso em `lib/popPdf.ts` / `lib/popPdfFromParsed.ts` / `lib/exportarRelatorioPDF.ts`

Se houver classes `print:` na tabela, **elas vão junto** para o `<Table>` /
`<TableRow>` / `<TableCell>`.

⚠️ Se o PDF for gerado a partir do DOM renderizado (html2canvas, `window.print`,
puppeteer), **teste a impressão** depois de converter — o container extra
`<div class="overflow-x-auto">` que o `<Table>` adiciona pode cortar a
tabela na impressão. Se cortar, **não converta essas duas** e anote no
relatório: tabela de impressão com layout frágil é caso legítimo de exceção.

### 3. `MetasOperacionais.tsx`

As duas tabelas (640, 700) são de metas × realizado, com célula de status
colorida por comparação. Toda a expressão condicional de cor vai para o
`className` do `<TableCell>`. Confira que os limiares (verde/âmbar/vermelho)
continuam batendo com os de antes.

---

## Verificação

```bash
yarn run check
yarn test
yarn build
```

```bash
# deve ir a 0 (ou 2, se as de PopRelatorio ficaram de fora — com nota)
grep -rn "<table" --include="*.tsx" client/src/pages/operacoes | wc -l
```

Rode `yarn dev` e confira, além do checklist geral:

- [ ] **Performance (operações)** — as 9 tabelas. Compare com a versão
      anterior lado a lado; é fácil perder uma coluna no meio de 9 conversões.
- [ ] **Custo LED** — editar uma célula, sair do foco, ver o valor salvar.
      Nenhum input pode ter ficado maior/menor a ponto de quebrar a linha.
- [ ] **Metas Operacionais** — cores de status nos mesmos limiares
- [ ] **Relatório de POP** — visualização normal **e** `Ctrl+P` / geração de
      PDF

## Definição de pronto

- [ ] 15 tabelas convertidas (ou 13 + nota sobre `PopRelatorio`)
- [ ] Células editáveis com padding apertado preservado e salvamento funcionando
- [ ] Classes `print:` preservadas; impressão conferida
- [ ] Nenhum componente foi extraído das tabelas semelhantes de `Performance.tsx`
- [ ] `yarn run check`, `yarn test`, `yarn build` passando
- [ ] Commit: `refactor(pages): tabelas de operações para ui/table (sprint pages, fase 9)`
