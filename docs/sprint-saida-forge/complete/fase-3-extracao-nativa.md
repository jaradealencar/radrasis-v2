# Fase 3 — Extração de texto real via libs JS (sem LLM)

> Leia o `README.md` desta pasta antes de começar.

**Objetivo:** parar de gastar uma chamada de LLM por upload. PDF, DOCX e XLSX
passam a ter o texto extraído de verdade, in-process. O LLM vira fallback.

**Pré-requisitos:** **Fases 1 e 2 concluídas.** Esta fase reescreve a função
que as duas encostaram; fazer fora de ordem gera retrabalho.

**Arquivos que você vai tocar:**
- `server/routers/bibliotecaArquivos.ts` (o trabalho todo)
- `package.json`

---

## O problema que esta fase resolve

`extrairTextoArquivo` hoje manda **todo** upload pro LLM, mas só PDF e imagem
têm o arquivo de verdade lido. Pra Word, Excel, PowerPoint e qualquer outro
tipo, a função **não abre o arquivo**: ela pede pro LLM *chutar* um resumo a
partir do nome e da descrição que o usuário digitou.

Esse chute é salvo em `conteudoExtraido` e é o que a busca (`list.busca`)
vasculha. Ou seja: a busca da Biblioteca de Arquivos hoje procura dentro de
um texto inventado, que pode não ter relação com o conteúdo real do arquivo.
Além de errado, custa uma chamada de LLM síncrona por upload.

---

## Tarefa 3.1 — Dependências

```bash
yarn add mammoth pdf-parse
```

Além disso, **mova `xlsx` de `devDependencies` para `dependencies`** no
`package.json`. Ele já está instalado, mas hoje só é usado em scripts/build;
agora passa a rodar em runtime do server.

### ⚠️ Armadilha do `pdf-parse`

A v1 do pacote tem um bloco de debug no `index.js` que roda quando o módulo é
carregado como entrypoint (`require.main === module`): ele tenta ler um PDF
de teste em `./test/data/...` e **quebra o import** em alguns bundlers.

**Importe sempre o arquivo interno, nunca a raiz do pacote:**

```ts
// certo
const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;

// errado — pode quebrar no build
import pdfParse from "pdf-parse";
```

Confirme que funciona **nos dois ambientes** antes de fechar a tarefa:
`yarn dev` (tsx) e `yarn build` (esbuild com `--bundle`).

---

## Tarefa 3.2 — Refatorar `extrairTextoArquivo`

A função recebe `(fileBase64, mimeType, fileName, nome, descricao)`. Troque o
roteamento por tipo:

| `mimeType` | O que fazer |
|---|---|
| `text/plain` | Sem mudança — já decodifica o buffer direto |
| `application/pdf` | `pdf-parse` no buffer. **Se o texto vier vazio ou < ~50 caracteres, caia no fallback de LLM visão** (é PDF escaneado, sem camada de texto) |
| `...wordprocessingml.document` (`.docx`) | `mammoth.extractRawText({ buffer })` |
| `...spreadsheetml.sheet` (`.xlsx`) e `application/vnd.ms-excel` (`.xls`) | `XLSX.read(buffer)`, percorrer todas as sheets, concatenar com `XLSX.utils.sheet_to_csv` |
| `image/*` | Sem mudança — continua LLM visão |
| Qualquer outro (pptx, odt...) | Sem mudança — continua o resumo especulativo |

Sobre o último caso: **deixe um comentário curto no código** dizendo que é
uma limitação conhecida e deliberada, não um esquecimento. Senão alguém
"conserta" isso daqui a seis meses sem saber que foi decidido.

Sobre o CSV do XLSX: não é o formato mais bonito, mas mantém a estrutura de
tabela legível o suficiente pra busca textual, que é o único consumidor de
`conteudoExtraido`.

O fallback de LLM (imagem e PDF escaneado) **já foi consertado na Fase 1**
pra mandar base64 inline. Não mexa nesse mecanismo — só o coloque atrás da
checagem do `pdf-parse`.

---

## Tarefa 3.3 — Eliminar a duplicação com `reextrairTexto`

A procedure `reextrairTexto` reimplementa o caminho de PDF por conta própria,
em vez de reusar `extrairTextoArquivo`. Depois da 3.2 isso vira duas fontes
de verdade que vão divergir.

Faça `reextrairTexto`:
1. baixar o arquivo do storage (com UploadThing a URL salva no banco é
   pública — um `fetch` direto resolve),
2. converter pra base64,
3. chamar `extrairTextoArquivo`.

Resultado: **um único lugar** decide, pelo `mimeType`, qual extrator usar.

---

## O que NÃO fazer nesta fase

- Não tente cobrir pptx/odt/etc. Foi decidido que o escopo são os 3 formatos
  que aparecem de verdade nos uploads.
- Não troque a busca (`list.busca`) por full-text search do Postgres. É uma
  melhoria real, mas é outra sprint.
- Não escreva os testes aqui — é a Fase 4.
- Não mexa em `server/_core/llm.ts`.

---

## Verificação

1. `npx tsc --noEmit` — mesma contagem de erros de antes (17).
2. `yarn build` roda sem erro (é o teste que pega a armadilha do `pdf-parse`).
3. Upload manual de **um PDF com texto real, um `.docx` e um `.xlsx`**,
   confirmando que `conteudoExtraido` bate com o conteúdo de verdade do
   arquivo — não com um resumo genérico. Olhe o valor salvo no banco.
4. Upload de um **PDF escaneado** (ou uma imagem salva como PDF) e confirme
   que o fallback de LLM dispara.
5. `reextrairTexto` chamado num arquivo já existente de cada tipo continua
   funcionando.

**Commit sugerido:** `feat(biblioteca): extrai texto real de PDF/DOCX/XLSX sem LLM (Fase 3)`
