# Fase 10 — Tabelas E: comercial

**Depende de:** Fase 1 e Fase 6.
**É a maior das fases de tabela — 23 tabelas.** Deixe-a por último entre as
de tabela.

## Escopo (lista fechada — 7 arquivos, 23 tabelas)

| Arquivo | Linhas dos `<table>` | Tamanho |
|---|---|---|
| `comercial/CRM.tsx` | 839, 984, 1117, 1168, 1224, 1277, 1348 | 1.397 linhas |
| `comercial/CrmAuditoria.tsx` | 169, 269, 399 | 523 linhas |
| `comercial/DiagnosticoApi.tsx` | 148 | 262 linhas |
| `comercial/EvolucaoVendedor.tsx` | 452 | 562 linhas |
| `comercial/InteligenteClientes.tsx` | 546 | 684 linhas |
| `comercial/PerformanceComercial.tsx` | 1201, 1352, 1523, 1623, 2097, 2359, 2415, 2588 | **2.773 linhas** ⚠️ |
| `comercial/TabelaPrecos.tsx` | 105, 248 | 1.166 linhas |

> Linhas são do início da sprint e andam conforme você edita. Reconfirme com
> `grep -n "<table" client/src/pages/comercial/<arquivo>`.

### ⛔ NÃO converta

`comercial/TabelaPrecos.tsx:716` monta HTML numa template string para
exportação:

```ts
html += `<table><thead><tr style="background:${color}">`;
```

Não é JSX. **Deixe exatamente como está.** As tabelas a converter nesse
arquivo são só as das linhas 105 e 248.

---

## Estratégia: quebre em 3 sessões

23 tabelas é muito para uma sessão só. Sugestão de divisão (ainda um único
commit ao final, ou três commits — tanto faz, desde que verificados):

1. **Sessão A** — `DiagnosticoApi` (1), `EvolucaoVendedor` (1),
   `InteligenteClientes` (1), `CrmAuditoria` (3) = 6 tabelas
2. **Sessão B** — `CRM` (7) + `TabelaPrecos` (2) = 9 tabelas
3. **Sessão C** — `PerformanceComercial` (8) = 8 tabelas

Em arquivos com muitas tabelas, **converta de baixo para cima** (maior linha
primeiro) — assim os números de linha das restantes não se deslocam.

**`yarn run check` a cada 2 ou 3 tabelas**, sem exceção.

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

## Cuidados específicos do comercial

### 1. `PropostaRow` — linha extraída como componente (`CRM.tsx:121`)

`comercial/CRM.tsx` define `function PropostaRow({ p, vendedor, onRefresh,
showVendedor })` que **retorna um `<tr>`**. Ao converter a tabela que a usa:

- O `<tr>` **dentro do `PropostaRow`** vira `<TableRow>` e os `<td>` viram
  `<TableCell>` — o componente precisa ser convertido junto.
- O `key` fica no **call site** (`<PropostaRow key={p.id} … />`), não dentro
  do componente. Não mova.
- Se `PropostaRow` retornar um fragmento com **duas** linhas (linha principal
  + linha de detalhe expandida), ambas viram `<TableRow>` e o fragmento
  continua sendo fragmento.

Procure por outros componentes que retornam `<tr>` antes de começar:

```bash
grep -rn "return (\s*<tr\|<tr key" --include="*.tsx" client/src/pages/comercial
```

### 2. `MetaCell` — célula editável inline (`PerformanceComercial.tsx:136`)

`function MetaCell({ value, onSave })` renderiza um `<td>` que alterna entre
texto e input. Vira `<TableCell>` **mantendo o padding customizado** — célula
com input precisa de padding apertado, e o `TableCell` padrão é mais folgado.

⚠️ **Não toque em `onSave`, no estado de edição, nem no `onBlur`/`onKeyDown`.**
É a interação mais delicada da página.

### 3. `CelulaRotina` (`CrmAuditoria.tsx:54`)

Retorna uma célula com marcadores de manhã/tarde e contagem de ações.
Mesma regra: `<td>` → `<TableCell>`, resto intocado.

### 4. `TabelaPrecos.tsx` — cores por faixa

A tabela de preços pinta linhas por faixa via `highlightClass(h)`
(`TabelaPrecos.tsx:80`). Toda a chamada vai para o `className` do
`<TableRow>`:

```tsx
<TableRow className={highlightClass(linha.destaque)}>
```

⚠️ Se `highlightClass` devolver classes de **fundo** (`bg-*`), elas vão
competir com o `hover:bg-muted/50` que o `TableRow` traz. Confira na tela:
se o destaque sumir ao passar o mouse, adicione `hover:bg-inherit` ao lado
da classe de destaque. Não remova o destaque.

### 5. Tabelas dentro de `Tabs`

`PerformanceComercial.tsx` e `CRM.tsx` têm várias tabelas distribuídas em
abas — por isso a contagem alta. **Abra cada aba** ao verificar; uma tabela
convertida errado numa aba secundária passa despercebida.

---

## Verificação

```bash
yarn run check
yarn test
yarn build
```

```bash
# deve sobrar exatamente 1: a string de export em TabelaPrecos.tsx:716
grep -rn "<table" --include="*.tsx" client/src/pages/comercial
```

Rode `yarn dev` e confira, além do checklist geral:

- [ ] **CRM** — todas as abas; a lista de propostas (`PropostaRow`) com
      link de WhatsApp e ações da linha funcionando
- [ ] **Performance Comercial** — todas as abas; editar uma meta inline,
      sair do foco, ver salvar
- [ ] **CRM Auditoria** — as 3 tabelas; células de rotina com os marcadores certos
- [ ] **Tabela de Preços** — cores de faixa preservadas, inclusive sob hover;
      **a exportação continua gerando o arquivo** (linha 716 intocada)
- [ ] **Clientes Inteligente**, **Evolução Vendedor**, **Diagnóstico API** —
      colunas e valores idênticos

## Definição de pronto

- [ ] 23 tabelas convertidas nos 7 arquivos
- [ ] `TabelaPrecos.tsx:716` intocado
- [ ] `PropostaRow`, `MetaCell` e `CelulaRotina` convertidos com `key`,
      estado e handlers preservados
- [ ] Todas as abas de `CRM` e `PerformanceComercial` conferidas
- [ ] Destaque de faixa da Tabela de Preços visível inclusive sob hover
- [ ] `yarn run check`, `yarn test`, `yarn build` passando
- [ ] Commit: `refactor(pages): tabelas do comercial para ui/table (sprint pages, fase 10)`
