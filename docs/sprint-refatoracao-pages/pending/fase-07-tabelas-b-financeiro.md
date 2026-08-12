# Fase 7 — Tabelas B: financeiro

**Depende de:** Fase 1 e Fase 6 (a 6 estabeleceu o padrão; se ela não saiu,
faça-a antes).

## Escopo (lista fechada — 5 arquivos, 9 tabelas)

| Arquivo | Linhas dos `<table>` |
|---|---|
| `financeiro/AnaliseAtrasos.tsx` | 336, 453 |
| `financeiro/CustosFixos.tsx` | 432, 582 |
| `financeiro/GestaoAtrasos.tsx` | 379 |
| `financeiro/MarketingFinanceiro.tsx` | 379 |
| `financeiro/PainelDRE.tsx` | 416, 737, 807 |

> Linhas são do início da sprint e andam conforme você edita. Reconfirme com
> `grep -n "<table" client/src/pages/financeiro/<arquivo>`.

### ⛔ NÃO converta

`financeiro/Financeiro.tsx:294` tem `<table>` **dentro de uma template
string** que monta um HTML de exportação para Excel:

```ts
const html = `<html …><body><table>${tableRows}</table></body></html>`;
```

Isso não é JSX, é contrato com o Excel. **Deixe exatamente como está.**

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

**Remova** do JSX (o shadcn já dá): `w-full` e `text-sm` no `<table>`;
`overflow-x-auto` no div wrapper; `border-b` e `hover:bg-*` no `<tr>`;
`text-left`/`font-medium`/`text-muted-foreground` e padding padrão no
`<th>`/`<td>`.

**Mantenha:** `text-right`, `text-center`, larguras fixas,
`whitespace-nowrap`, `font-mono`, `sticky`, e toda classe condicional.

**Nunca perca:** `key`, `colSpan`, `rowSpan`, `onClick`, `title`, `aria-*`.

---

## Cuidados específicos do financeiro

Este módulo tem as tabelas mais "de planilha" do sistema. Três armadilhas:

### 1. Tabelas de matriz mês a mês

`financeiro/CustosFixos.tsx:582` gera as colunas por `MESES_ABREV.map(...)`
e pinta a coluna do mês corrente:

```tsx
{MESES_ABREV.map(m => (
  <th key={m} className={`text-right py-2 px-2 … ${
    MESES_ABREV[mesDivida - 1] === m ? "text-amber-600 bg-amber-50" : "text-muted-foreground"
  }`}>{m}</th>
))}
```

Vira `<TableHead>` mantendo **o `key`, o `text-right` e toda a expressão
condicional de cor**. Só o padding padrão e o `text-muted-foreground` do
ramo "else" saem (o `TableHead` já é `text-muted-foreground`):

```tsx
{MESES_ABREV.map(m => (
  <TableHead key={m} className={`text-right ${
    MESES_ABREV[mesDivida - 1] === m ? "text-amber-600 bg-amber-50" : ""
  }`}>{m}</TableHead>
))}
```

⚠️ **A contagem de colunas do header tem que continuar batendo com a do
corpo.** Nessas tabelas o corpo também gera 12 células por `.map()`. Se você
mexer em uma e não na outra, a tabela desalinha inteira.

### 2. Linhas de total / subtotal

O DRE tem linhas de fechamento (`Total`, `Margem`, `Resultado`) com fundo e
peso próprios, às vezes num `<tfoot>`, às vezes como último `<tr>` do
`<tbody>` com `className="font-bold bg-slate-100"`.

- Se está em `<tfoot>` → `<TableFooter>`. Ele já traz `bg-muted/50 border-t
  font-medium`; remova as classes equivalentes do JSX, mantenha
  `font-bold` se o original era mais pesado que `font-medium`.
- Se é um `<tr>` dentro do `<tbody>` → vira `<TableRow>` normal **mantendo
  todas as classes de destaque**. Não promova para `<TableFooter>`: isso
  mudaria a posição no scroll.

### 3. Células com valor negativo colorido

Padrão comum aqui:

```tsx
<td className={`text-right ${v < 0 ? "text-red-600" : "text-slate-700"}`}>
```

A expressão inteira vai para o `<TableCell className={...}>`. **Não
simplifique o ramo "else" para vazio** neste caso — `text-slate-700` é
diferente do default do `TableCell`, e apagá-lo muda a cor da coluna.

---

## Verificação

```bash
yarn run check
yarn test
yarn build
```

```bash
# deve sobrar exatamente 1: a string de export em Financeiro.tsx:294
grep -rn "<table" --include="*.tsx" client/src/pages/financeiro
```

Rode `yarn dev` e abra as 5 páginas. Além do checklist geral, confira aqui:

- [ ] **Painel DRE** — as 3 tabelas alinhadas; linhas de total no lugar; sinais e cores de negativo preservados
- [ ] **Custos Fixos** — a matriz de 12 meses com o mês corrente destacado; nenhuma coluna a mais ou a menos
- [ ] **Análise de Atrasos** e **Gestão de Atrasos** — ordenação por coluna (se houver) ainda funciona
- [ ] **Marketing Financeiro** — valores em R$ idênticos aos de antes
- [ ] A exportação para Excel de `Financeiro.tsx` continua gerando o arquivo

## Definição de pronto

- [ ] 9 tabelas convertidas nos 5 arquivos
- [ ] `Financeiro.tsx:294` intocado
- [ ] Contagem de colunas header × corpo conferida nas tabelas de matriz
- [ ] Linhas de total preservadas
- [ ] `yarn run check`, `yarn test`, `yarn build` passando
- [ ] Commit: `refactor(pages): tabelas do financeiro para ui/table (sprint pages, fase 7)`
