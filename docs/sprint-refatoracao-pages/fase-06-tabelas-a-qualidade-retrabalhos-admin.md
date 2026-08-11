# Fase 6 — Tabelas A: qualidade, retrabalhos, admin e raiz

**Depende de:** Fase 1.
**É a primeira das 5 fases de tabela e estabelece o padrão.** As fases 7–10
repetem a mesma receita em outros módulos. Faça esta antes delas.

## Contexto

O projeto tem `client/src/components/ui/table.tsx` (shadcn) instalado e
usado em apenas 2 arquivos. Em paralelo, **29 páginas escrevem `<table>` na
mão** — 65 tabelas cruas no total, cada uma repetindo as mesmas classes de
borda, padding e hover.

Esta fase converte as **8 tabelas mais simples**, em 8 arquivos.

## Escopo (lista fechada — 8 arquivos, 8 tabelas)

| Arquivo | Linha do `<table>` |
|---|---|
| `qualidade/DesempenhoColaborador.tsx` | 427 |
| `qualidade/PlanosAcao.tsx` | 292 |
| `retrabalhos/InserirRapido.tsx` | 181 |
| `retrabalhos/Relatorio.tsx` | 386 |
| `retrabalhos/Retrabalhos.tsx` | 69 |
| `admin/Usuarios.tsx` | 138 |
| `Auditoria.tsx` | 330 |
| `qualidade/Metas.tsx` | 199 — **já feita na Fase 1**, sirva-se dela de exemplo |

> Números de linha são do início da sprint e andam conforme você edita.
> Reconfirme com:
> `grep -n "<table" client/src/pages/<arquivo>`

---

## A receita (vale para todas as fases de tabela)

### Import

```tsx
import {
  Table, TableHeader, TableBody, TableFooter,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";
```

Importe **só o que usar**. `TableFooter` só se a tabela tiver `<tfoot>`.

### Mapeamento de tags

| Antes | Depois |
|---|---|
| `<table>` | `<Table>` |
| `<thead>` | `<TableHeader>` |
| `<tbody>` | `<TableBody>` |
| `<tfoot>` | `<TableFooter>` |
| `<tr>` | `<TableRow>` |
| `<th>` | `<TableHead>` |
| `<td>` | `<TableCell>` |

### Exemplo completo

```tsx
// ANTES
<div className="overflow-x-auto rounded-xl border border-slate-200">
  <table className="w-full text-xs">
    <thead>
      <tr className="border-b bg-slate-50">
        <th className="text-left px-4 py-3 font-semibold text-slate-600">Ano</th>
        <th className="text-right px-4 py-3 font-semibold text-slate-600">Custo</th>
      </tr>
    </thead>
    <tbody>
      {linhas.map((l) => (
        <tr key={l.id} className="border-b hover:bg-slate-50">
          <td className="px-4 py-3">{l.ano}</td>
          <td className="px-4 py-3 text-right">{fmtBrl(l.custo)}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

// DEPOIS
<div className="rounded-xl border border-slate-200">
  <Table className="text-xs">
    <TableHeader>
      <TableRow className="bg-slate-50">
        <TableHead>Ano</TableHead>
        <TableHead className="text-right">Custo</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {linhas.map((l) => (
        <TableRow key={l.id}>
          <TableCell>{l.ano}</TableCell>
          <TableCell className="text-right">{fmtBrl(l.custo)}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

### Classes que o shadcn já dá — **remova** do JSX

O `ui/table.tsx` já aplica:

| Classe a remover | Onde | Porque |
|---|---|---|
| `w-full`, `text-sm` | no `<table>` | `Table` já traz `w-full caption-bottom text-sm` |
| `overflow-x-auto` | no **div wrapper** | `Table` já se envolve num container com `overflow-x-auto` — manter os dois cria scroll duplo |
| `border-b` | em `<tr>` | `TableRow` já traz `border-b` |
| `hover:bg-slate-50`, `hover:bg-muted/50` | em `<tr>` | `TableRow` já traz `hover:bg-muted/50` |
| `text-left`, `font-medium`, `text-muted-foreground`, `px-*`/`py-*` padrão | em `<th>` | `TableHead` já traz alinhamento à esquerda, peso e padding |
| `px-*`/`py-*` padrão | em `<td>` | `TableCell` já traz padding |

**Mantenha** tudo que é específico daquela tabela: `text-right`,
`text-center`, `w-[120px]`, `whitespace-nowrap`, `font-mono`, cores
condicionais (`className={atrasado ? "text-red-600" : ""}`),
`bg-amber-50` de destaque, `sticky left-0`.

Se a classe do `text-sm` original era **diferente** (`text-xs`,
`text-base`), mantenha-a no `<Table>` — o `cn()` faz o merge e a sua vence.

### Div wrapper: quando remover, quando manter

```tsx
// só overflow → REMOVA o div
<div className="overflow-x-auto"><table>…  →  <Table>…

// overflow + borda/arredondamento → MANTENHA o div, tire só o overflow
<div className="overflow-x-auto rounded-xl border">  →  <div className="rounded-xl border">
```

---

## Regras que não podem ser quebradas

1. **`key` sobrevive.** Todo `<tr key={…}>` vira `<TableRow key={…}>` com o
   mesmo `key`. Perder isso é bug de render silencioso.
2. **`colSpan` / `rowSpan` sobrevivem.** Vão iguais para
   `<TableCell colSpan={5}>`. Muito usado nas linhas de "nenhum resultado".
3. **Handlers sobrevivem.** `onClick`, `onDoubleClick`, `onMouseEnter`,
   `title`, `data-testid`, `role`, `aria-*` — tudo vai junto.
4. **Não mude a ordem nem a quantidade de colunas.** O número de `<th>` do
   header tem que continuar batendo com o de `<td>` de cada linha.
5. **Não converta `<table>` dentro de template string.** Só JSX. Nesta fase
   não há nenhum caso, mas a regra vale sempre.

---

## Cuidado específico desta fase: a classe `tech-table`

`retrabalhos/Retrabalhos.tsx` e `retrabalhos/Relatorio.tsx` usam
`<table className="w-full tech-table">`. A classe `tech-table` é do projeto,
definida em `client/src/index.css:274-290`, e estiliza `th`, `td` e
`tr:hover` com seletores de descendente.

Como o `ui/table` renderiza `<table>`/`<th>`/`<td>` de verdade por baixo,
**`tech-table` continua funcionando** se você mantiver a classe no `<Table>`:

```tsx
<Table className="tech-table">
```

Mas as regras vão **colidir** com as do shadcn (padding e hover aplicados
duas vezes, com precedência decidida pela ordem no CSS, não pelo `cn()`).
Duas saídas, nesta ordem de preferência:

1. **Preferida:** remova `tech-table` e deixe o estilo do shadcn assumir.
   Confira na tela se o resultado é aceitável.
2. Se a tabela ficar visualmente muito diferente do resto da página,
   **mantenha `tech-table` e não converta esses dois arquivos nesta fase** —
   anote no relatório final. É melhor deixar 2 tabelas para depois do que
   entregar uma página com estilo quebrado.

---

## Verificação

```bash
yarn run check
yarn test
yarn build
```

```bash
# tabelas cruas restantes no escopo desta fase — deve ser 0
grep -rn "<table" --include="*.tsx" \
  client/src/pages/qualidade client/src/pages/retrabalhos \
  client/src/pages/admin client/src/pages/Auditoria.tsx | wc -l
```

Rode `yarn dev` e abra as 7 páginas. Para cada tabela, confira:

- [ ] mesmas colunas, na mesma ordem
- [ ] mesmos dados nas células
- [ ] cabeçalho fixo/sticky ainda fixo, se era
- [ ] scroll horizontal funciona e **não há duas barras de scroll**
- [ ] clique na linha (quando havia) ainda abre o que abria
- [ ] a linha de "nenhum registro" ainda ocupa a largura toda (`colSpan`)

## Definição de pronto

- [ ] 7 arquivos convertidos (ou 5, se `tech-table` foi adiada — com nota)
- [ ] Nenhum `key`, `colSpan` ou handler perdido
- [ ] Sem scroll horizontal duplicado
- [ ] `yarn run check`, `yarn test`, `yarn build` passando
- [ ] Commit: `refactor(pages): tabelas de qualidade/retrabalhos/admin para ui/table (sprint pages, fase 6)`
