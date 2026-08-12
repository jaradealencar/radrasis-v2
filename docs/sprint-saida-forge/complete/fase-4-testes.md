# Fase 4 — Testes da extração

> Leia o `README.md` desta pasta antes de começar.

**Objetivo:** travar o comportamento da Fase 3 com testes, pra que ninguém
reintroduza a chamada de LLM por acidente.

**Pré-requisitos:** Fase 3 concluída.

**Arquivo novo:** `server/__tests__/bibliotecaArquivos.test.ts`

---

## Antes de escrever qualquer teste

`DATABASE_URL` **precisa estar exportada no shell**, senão as suítes que
tocam banco falham na conexão (não pulam — falham). Os testes deste projeto
importam `server/db/` direto e não passam por `server/_core/index.ts`, que é
quem normalmente carrega o `dotenv/config`.

```bash
export DATABASE_URL="postgresql://..."   # bash
$env:DATABASE_URL = "postgresql://..."   # powershell
yarn test
```

Rode `yarn test` **antes** de escrever qualquer coisa e anote quais suítes já
falham hoje. O objetivo da fase é não aumentar essa lista.

---

## Tarefa 4.1 — Testes unitários de `extrairTextoArquivo`

Gere os arquivos de teste **como buffers em memória**, não como fixtures em
disco — evita commitar binário no repo e deixa o teste auto-explicativo.

Cobertura mínima:

1. **PDF/DOCX/XLSX extraem o conteúdo certo** — o texto retornado contém o
   conteúdo que você colocou no buffer.

2. **Esses 3 tipos NÃO chamam o LLM.** Mocke o módulo `../_core/llm` e afirme
   **zero chamadas** de `invokeLLM`. Este é o teste mais importante da fase —
   é ele que impede a regressão que a Fase 3 acabou de consertar.

3. **O fallback ainda dispara.** Mocke o `pdf-parse` retornando string vazia
   e confirme que `invokeLLM` **é** chamado nesse caso. Sem este teste, uma
   "otimização" futura pode remover o fallback e ninguém percebe até chegar
   um PDF escaneado em produção.

Gerar um XLSX mínimo em memória é fácil com a própria lib `xlsx`
(`XLSX.utils.book_new()` + `XLSX.write(wb, { type: "buffer" })`). Pra DOCX e
PDF, se montar um binário válido à mão ficar penoso, é aceitável mockar a lib
correspondente e testar só o **roteamento por `mimeType`** — o valor está em
provar que o tipo certo vai pro extrator certo, não em re-testar bibliotecas
de terceiros.

---

## O que NÃO fazer nesta fase

- Não escreva testes que batem no banco real ou na API da OpenAI. Esta suíte
  tem que rodar offline e em milissegundos.
- Não tente consertar suítes que já estavam falhando antes de você começar.
- Não commite arquivos de fixture binários.

---

## Verificação

`yarn test` sem **falhas novas** em relação à lista que você anotou no começo.

**Commit sugerido:** `test(biblioteca): cobre extração nativa e fallback de LLM (Fase 4)`

---

## Status: concluída (2026-08-12)

Criado `server/__tests__/bibliotecaArquivos.test.ts` com 5 testes cobrindo a
Tarefa 4.1.

### Descobertas / desvios do plano

- **`extrairTextoArquivo` precisou virar `export`** em
  `server/routers/bibliotecaArquivos.ts` — antes só era usada internamente
  pelo router. Sem isso não dava pra importar a função no teste.
- **DOCX e PDF testados via mock das libs** (`mammoth`, `pdf-parse`), como o
  próprio plano permitia — provando o roteamento por `mimeType` e o
  conteúdo retornado, sem montar binário válido à mão.
- **XLSX testado com arquivo real em memória** via `XLSX.utils.book_new()` +
  `XLSX.write(wb, { type: "buffer" })`, sem mock — mais barato que mockar
  nesse caso.
- Ao importar `mammoth` no teste, usar `import * as mammoth from "mammoth"`
  (namespace), não `import mammoth from "mammoth"` (default) — o código
  fonte também acessa via `await import("mammoth")` (namespace), e o mock
  de `vi.mock("mammoth", ...)` só expõe os exports nomeados.

### Baseline anotado antes de começar

`yarn test` já falhava em 2 testes antes desta fase, ambos em
`mubisys.test.ts` (`MUBISYS_ACCESS_TOKEN`/`MUBISYS_PUBLIC_KEY` não
configurados no ambiente local — credencial ausente, não bug). Depois da
fase: mesmos 2 falhando, 138 passando (5 novos, todos verdes).
