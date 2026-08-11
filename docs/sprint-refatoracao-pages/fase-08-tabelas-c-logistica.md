# Fase 8 — Tabelas C: logística

**Depende de:** Fase 1 e Fase 6.

## Escopo (lista fechada — 4 arquivos, 10 tabelas)

| Arquivo | Linhas dos `<table>` | Tamanho do arquivo |
|---|---|---|
| `logistica/Assertividade.tsx` | 248, 394 | 616 linhas |
| `logistica/CompletudeTransportadoras.tsx` | 378 | 630 linhas |
| `logistica/LogisticaDashboard.tsx` | 204, 328 | 406 linhas |
| `logistica/Empacotamento.tsx` | 2274, 2764, 2873, 4411, 4976 | **5.012 linhas** ⚠️ |

> Linhas são do início da sprint e andam conforme você edita. Reconfirme com
> `grep -n "<table" client/src/pages/logistica/<arquivo>`.

---

## ⚠️ `Empacotamento.tsx` tem 5.012 linhas — leia isto antes

É de longe o maior arquivo do projeto e concentra metade desta fase.

**Não leia o arquivo inteiro.** Trabalhe tabela por tabela:

```bash
grep -n "<table" client/src/pages/logistica/Empacotamento.tsx
```

Para cada resultado, leia só a janela ao redor (o `<table>` até o `</table>`
correspondente — tipicamente 40 a 120 linhas) e converta só ela.

**Ordem sugerida: de baixo para cima** — 4976, 4411, 2873, 2764, 2274.
Converter de baixo para cima faz com que os números de linha das tabelas
ainda não convertidas não mudem, então o `grep` inicial continua válido a
fase inteira.

**Uma tabela por vez, com `yarn run check` entre elas.** Num arquivo desse
tamanho, acumular cinco conversões antes de verificar torna impossível saber
qual delas quebrou.

**Não refatore mais nada nesse arquivo.** Ele merece uma sprint própria de
quebra em componentes; aqui ele só recebe a troca de tabelas. Resista à
tentação de extrair funções, renomear variáveis ou "aproveitar que está
aberto".

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

## Cuidados específicos da logística

### 1. Tabelas dentro de tabelas (linha expansível)

`logistica/Assertividade.tsx:394` e `logistica/LogisticaDashboard.tsx:328`
estão **aninhadas** — uma tabela de detalhe dentro de um `<td>` de uma linha
expandida da tabela de fora.

Converta **as duas**, de dentro para fora. Cuidados:

- O `<TableCell colSpan={N}>` que hospeda a tabela interna precisa manter o
  `colSpan` **exato** — se ele não cobrir todas as colunas de fora, a tabela
  externa desalinha ao expandir.
- A tabela interna, como `<Table>`, traz o próprio container
  `overflow-x-auto`. Remova qualquer `overflow-x-auto` do wrapper interno,
  senão o detalhe ganha scroll dentro de scroll.
- O estado de expandido/colapsado (`expandedId`, `openRows`, etc.) e a
  renderização condicional (`{isOpen && <TableRow>…}`) ficam **exatamente
  como estão**. Não mexa na lógica.

### 2. Colunas fixas (`sticky`)

As tabelas de transportadoras/cobertura são largas e algumas fixam a
primeira coluna com `sticky left-0 bg-white z-10`. **Mantenha essas classes
intactas** no `<TableCell>` / `<TableHead>`.

⚠️ `sticky` depende do container de scroll. O `<Table>` do shadcn envolve
tudo num `<div className="relative w-full overflow-x-auto">` — que é
exatamente o container que o `sticky` precisa, então continua funcionando.
Mas **confira na tela**: role a tabela horizontalmente e veja se a primeira
coluna fica parada.

### 3. Célula de status com badge

Padrão frequente aqui: `<td><Badge variant={…}>{status}</Badge></td>`. O
`<Badge>` vai inteiro para dentro do `<TableCell>`, sem mudança. Não troque
`Badge` por outra coisa nesta fase.

---

## Verificação

```bash
yarn run check
yarn test
yarn build
```

```bash
# deve ir a 0
grep -rn "<table" --include="*.tsx" client/src/pages/logistica | wc -l
```

Rode `yarn dev` e confira, além do checklist geral:

- [ ] **Empacotamento** — as 5 tabelas. Esta página tem fluxo de trabalho
      real (seleção de itens, romaneio); clique pelo fluxo, não só olhe.
- [ ] **Assertividade** — expandir uma linha mostra a tabela de detalhe
      alinhada, sem scroll duplo
- [ ] **Dashboard de Logística** — idem para a linha expansível
- [ ] **Completude de Transportadoras** — rolar na horizontal mantém a
      primeira coluna fixa
- [ ] Há testes tocando esta pasta (`logistica/romaneio.test.tsx`,
      `logistica/romaneio.real.test.tsx`, `logistica/CardKanban.render.test.tsx`).
      **Todos precisam continuar verdes** — se algum quebrar, é regressão
      real, não teste desatualizado.

## Definição de pronto

- [ ] 10 tabelas convertidas nos 4 arquivos
- [ ] `Empacotamento.tsx` recebeu **apenas** a troca de tabelas
- [ ] Tabelas aninhadas com `colSpan` correto e sem scroll duplo
- [ ] Colunas `sticky` ainda fixas ao rolar
- [ ] Os 3 testes da pasta `logistica/` passando
- [ ] `yarn run check`, `yarn test`, `yarn build` passando
- [ ] Commit: `refactor(pages): tabelas da logística para ui/table (sprint pages, fase 8)`
