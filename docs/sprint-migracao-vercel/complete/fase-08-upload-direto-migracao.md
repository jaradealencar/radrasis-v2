# Fase 8 — Upload direto: migrar os 9 call sites restantes

**Depende de:** Fase 7. Ela criou `client/src/lib/upload.ts`,
`server/_core/uploadthing.ts` e a rota `/api/uploadthing`, e migrou
`cargos.uploadImage` como piloto.

**Não crie nada novo nesta fase.** Se um call site parecer precisar de um
helper que não existe em `client/src/lib/upload.ts`, pare e reporte — não
improvise um segundo caminho de upload.

## Objetivo

Repetir o padrão do piloto nos nove call sites restantes e, no fim, **baixar o
limite do body parser** — que é o que fecha o problema de verdade.

O padrão é sempre o mesmo, em três movimentos:

**1. No client:** troque `FileReader` → base64 por `enviarArquivo(...)` /
`enviarArquivos(...)`, e passe `{ url, key, fileName, mimeType, fileSize }`
para a mutation.

**2. No server:** troque o campo base64 do `.input()` por
`url: z.string().url()` + `key: z.string().min(1)`, e apague o
`Buffer.from(...)` + `storagePut(...)`, usando `input.url` onde antes estava a
`url` devolvida pelo `storagePut`.

**3. Nada mais.** Toda a lógica que vem depois — gravar no banco, atualizar
`attachments`, criar registro de análise, chamar o LLM — **fica exatamente
como está**.

---

## Ordem de execução

Faça nesta ordem. Vai do mais simples ao mais complicado, e os dois últimos
grupos têm particularidades reais.

| Ordem | Call site | Por que nesta posição |
|---|---|---|
| 1 | `errorLibrary.uploadImage` | Idêntico ao piloto, mas grava no banco |
| 2 | `pops.uploadImage` | Igual ao anterior + manipula `attachments` |
| 3 | `curriculos.uploadAndAnalyze` | Primeiro com **documento**, não imagem |
| 4 | `bibliotecaArquivos.criar` | **Tem particularidade** — leia 8.4 antes |
| 5 | `cotacoesFrete.uploadFotos` | Primeiro com **múltiplos** arquivos, 2 call sites no client |
| 6 | `empacotamento` (4 procedures) | **Tem particularidade** — leia 8.6 antes |

## 8.1 — `errorLibrary.uploadImage`

**Server** — `server/routers.ts:131`:

```diff
      uploadImage: protectedProcedure
        .input(z.object({
          code: z.string(),
          fileName: z.string(),
-         fileBase64: z.string(),
+         url: z.string().url(),
+         key: z.string().min(1),
          mimeType: z.string().default("image/jpeg"),
        }))
        .mutation(async ({ input }) => {
-         const { storagePut } = await import("./db/storage");
-         const buffer = Buffer.from(input.fileBase64, "base64");
-         const key = `error-library/${input.code}/${Date.now()}-${input.fileName}`;
-         const { url } = await storagePut(key, buffer, input.mimeType);
-         await updateErrorItem(input.code, { imageUrl: url, imageKey: key } as any);
-         return { url, key };
+         await updateErrorItem(input.code, { imageUrl: input.url, imageKey: input.key } as any);
+         return { url: input.url, key: input.key };
        }),
```

> **A `key` muda de formato.** Antes era um caminho construído pelo app
> (`error-library/{code}/{timestamp}-{nome}`); agora é a key opaca do
> UploadThing. Isso vale para **todos** os call sites desta fase. O campo é
> usado para deletar o arquivo no UploadThing, e a key do UploadThing é
> justamente o identificador certo para isso. Registros antigos mantêm a key
> antiga — nada quebra, porque nada faz parse dessa string.

**Client** — `client/src/pages/retrabalhos/BibliotecaErros.tsx:400`:

```diff
- await uploadImageMut.mutateAsync({ code: item.code, fileName: file.name, fileBase64: base64, mimeType: file.type });
+ const enviado = await enviarArquivo("imagem", file);
+ await uploadImageMut.mutateAsync({
+   code: item.code,
+   fileName: enviado.fileName,
+   url: enviado.url,
+   key: enviado.key,
+   mimeType: enviado.mimeType,
+ });
```

Remova o `FileReader` que produzia `base64` e adicione
`import { enviarArquivo } from "@/lib/upload";`.

## 8.2 — `pops.uploadImage`

**Server** — `server/routers.ts:1058`. Mesma transformação do input. No corpo,
só as três primeiras linhas somem:

```diff
        .mutation(async ({ input }) => {
-         const { storagePut } = await import("./db/storage");
-         const buffer = Buffer.from(input.fileBase64, "base64");
-         const key = `pops/${input.popId}/${Date.now()}-${input.fileName}`;
-         const { url } = await storagePut(key, buffer, input.mimeType);
          // Busca o POP e adiciona a imagem à lista de attachments
          const pop = await getPopById(input.popId);
          if (!pop) throw new TRPCError({ code: "NOT_FOUND", message: "POP não encontrado" });
          let attachments: string[] = [];
          try {
            attachments = pop.attachments ? JSON.parse(pop.attachments as string) : [];
          } catch { attachments = []; }
-         attachments.push(url);
+         attachments.push(input.url);
          await updatePop(input.popId, { attachments: JSON.stringify(attachments) } as any);
-         return { url, attachments };
+         return { url: input.url, attachments };
        }),
```

**Toda a lógica de `attachments` fica intacta.** Se o diff mexer no
`JSON.parse`, no `catch` ou no `updatePop`, está errado.

**Client** — `client/src/pages/operacoes/Pops.tsx:280`, mesmo padrão do 8.1.

## 8.3 — `curriculos.uploadAndAnalyze`

Primeiro que usa a rota `"documento"` (currículos são PDF/DOCX/TXT).

**Server** — `server/routers/curriculos.ts:14`:

```diff
      .input(z.object({
        cargoId: z.number(),
        fileName: z.string(),
-       fileContent: z.string(), // base64 ou texto
+       url: z.string().url(),
+       key: z.string().min(1),
        fileType: z.string(), // application/pdf, text/plain, etc
      }))
      .mutation(async ({ input, ctx }) => {
        try {
-         // 1. Salvar arquivo no S3
-         const buffer = Buffer.from(input.fileContent, "base64");
-         const storageKey = `curriculos/${input.cargoId}/${Date.now()}-${input.fileName}`;
-         const { url, key } = await storagePut(storageKey, buffer, input.fileType);
-
          // 2. Criar registro no banco
          const analise = await createAnaliseCurriculo({
            cargoId: input.cargoId,
            curriculoFileName: input.fileName,
-           curriculoUrl: url,
-           curriculoKey: key,
+           curriculoUrl: input.url,
+           curriculoKey: input.key,
```

⚠️ **Leia o resto da mutation antes de fechar.** Se algum trecho posterior
usar `input.fileContent` para **extrair texto do currículo** (para a análise
por LLM), esse trecho precisa passar a buscar o arquivo pela URL. O padrão
para isso já existe no repo, em
`server/routers/bibliotecaArquivos.ts:210`:

```ts
const fileResp = await fetch(url);
const fileBase64 = Buffer.from(await fileResp.arrayBuffer()).toString("base64");
```

**Client** — `client/src/components/CurriculumUploadSection.tsx:43`, mesmo
padrão, com `enviarArquivo("documento", file)`.

## 8.4 — `bibliotecaArquivos.criar` ⚠️ particularidade

Este call site usa o base64 **duas vezes**: para o `storagePut` **e** para
`extrairTextoArquivo(...)`, que manda o conteúdo para o LLM
(`server/routers/bibliotecaArquivos.ts:163-175`). Tirar o base64 do input
quebra o segundo uso.

A solução já está no próprio arquivo, na linha 210: buscar o arquivo de volta
pela URL. Fica:

```diff
      .mutation(async ({ input }) => {
-       const { storagePut } = await import("../db/storage");
-       const buffer = Buffer.from(input.fileBase64, "base64");
-       const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
-       const key = `biblioteca-arquivos/${Date.now()}-${safeFileName}`;
-       const { url } = await storagePut(key, buffer, input.mimeType);
+       // O arquivo já está no UploadThing (upload direto do browser). Para a
+       // extração de texto precisamos do conteúdo — buscamos de volta pela
+       // URL, mesmo padrão já usado na linha ~210 deste arquivo.
+       const fileResp = await fetch(input.url);
+       const fileBase64 = Buffer.from(await fileResp.arrayBuffer()).toString("base64");

        // Extrair texto do arquivo via LLM
        const conteudoExtraido = await extrairTextoArquivo(
-         input.fileBase64,
+         fileBase64,
          input.mimeType,
          input.fileName,
          input.nome,
          input.descricao
        );
```

E o input troca `fileBase64` por `url` + `key`, como nos outros. `fileSize`
continua vindo do client (o helper `enviarArquivo` devolve).

> **Isso adiciona um round trip** (a função baixa o arquivo do UploadThing).
> Para os tamanhos em jogo é irrelevante perto do tempo da chamada ao LLM, que
> já domina essa mutation.

**Client** — `client/src/pages/operacoes/BibliotecaArquivos.tsx:228`.

## 8.5 — `cotacoesFrete.uploadFotos`

Primeiro com **múltiplos arquivos** e **dois call sites** no client.

**Server** — `server/routers/logistica.ts:828`. O input hoje é um array de
`{ nome, conteudoBase64, tipo }`. Vira array de `{ nome, url, key, tipo }`, e
o loop perde o `Buffer.from` + `storagePut` — o resto (gravação no banco,
associação à cotação) fica igual. Note que `logistica.ts:848` faz
`.replace(/^data:[^;]+;base64,/, '')` porque o client manda **data URL**, não
base64 puro; esse tratamento some junto.

**Client** — dois arquivos:

- `client/src/pages/logistica/NovaCotacaoDialog.tsx:256-296` — o estado
  `fotosPendentes` guarda `{ nome, conteudoBase64, tipo, preview }`. O
  `conteudoBase64` também serve de **preview** (`preview: conteudo`). Ao
  migrar, use `URL.createObjectURL(file)` para o preview e guarde o `File` no
  estado; o upload acontece na hora de salvar, com
  `enviarArquivos("imagem", files)`.
- `client/src/pages/logistica/Solicitacoes.tsx:694` — mesma transformação, sem
  a questão do preview. Repare no `.slice(0, 10)`: **preserve esse limite**, e
  note que ele bate com o `maxFileCount: 10` da rota `imagem` no file router.

## 8.6 — `empacotamento` (4 procedures) ⚠️ particularidade

`server/routers/empacotamento.ts`, procedures `uploadArquivo` (935),
`uploadFoto` (954), `atualizarFotoAnotada` (985) e
`atualizarArquivoPedidoAnotado` (1002). As transformações do server são as
mesmas dos itens anteriores.

A particularidade está nas **duas de anotação** (#9 e #10 do inventário): elas
não recebem arquivo de `<input type="file">` — recebem um **PNG gerado pelo
canvas** no browser (`CanvasAnnotatorArquivo`,
`client/src/pages/logistica/Empacotamento.tsx:4519`, que entrega base64 via
`onSaved`). Não há `File` para passar ao helper.

É para isso que a Fase 7 criou `base64ParaFile`:

```ts
import { base64ParaFile, enviarArquivo } from "@/lib/upload";

// dentro do handleSalvar (Empacotamento.tsx:4474)
const file = base64ParaFile(base64, `anotacao-${Date.now()}.png`, "image/png");
const enviado = await enviarArquivo("imagem", file);
await atualizarFotoAnotadaMut.mutateAsync({ /* ...ids... */, url: enviado.url, key: enviado.key });
```

> **`Empacotamento.tsx` tem 5.012 linhas.** Não refatore nada além dos
> trechos de upload. Não quebre o arquivo, não reorganize imports, não formate.

## 8.7 — Baixar o limite do body parser

**Só depois de todos os nove estarem migrados e testados.** Este é o passo
que efetivamente fecha o problema da fase.

Em `server/_core/app.ts`, nos **dois** caminhos (serverless e tradicional, se
a Fase 5 já tiver criado a bifurcação):

```diff
- app.use(express.json({ limit: "50mb" }));
- app.use(express.urlencoded({ limit: "50mb", extended: true }));
+ // 2mb é folga larga para payload de mutation tRPC (JSON de formulário).
+ // Arquivos NÃO passam mais por aqui — sobem direto para o UploadThing
+ // (ver client/src/lib/upload.ts). O limite antigo de 50mb existia por causa
+ // do base64 embutido no payload, e nem funcionaria em serverless: a Vercel
+ // corta o corpo da requisição em 4.5mb, sem override.
+ app.use(express.json({ limit: "2mb" }));
+ app.use(express.urlencoded({ limit: "2mb", extended: true }));
```

Se **qualquer** tela quebrar com `PayloadTooLargeError` depois disso, é sinal
de que sobrou um call site com base64 — não suba o limite de volta, ache o
call site.

## 8.8 — Varredura final

```bash
# não pode sobrar nenhum campo base64 em input de tRPC de upload
grep -rn "fileBase64\|conteudoBase64\|base64: z.string()\|fileContent: z.string()" server/

# no client, nenhum FileReader alimentando mutation de upload
grep -rn "readAsDataURL" client/src

# storagePut só deve continuar em uso onde o SERVER gera o arquivo
grep -rn "storagePut" server/
```

O primeiro e o segundo devem estar vazios (ou, no segundo, sobrar só usos que
não têm relação com upload — preview de imagem, por exemplo; confira um a um).

O terceiro **não** precisa zerar: `storagePut` continua legítimo se algum
ponto do server **gera** um arquivo (PDF, planilha) e o salva. Se sobrar algum
uso, confirme que é esse o caso e deixe.

---

## Armadilhas conhecidas

- **Um call site por vez, testando cada um.** A tentação de fazer os nove de
  uma vez e testar no fim é grande e é por onde essa fase dá errado. Se ficar
  desconfortável num commit só, é legítimo quebrar em dois commits
  (`fase 8a` / `fase 8b`) — mas não em duas conversas paralelas.
- **`fileSize` vem do client e não é confiável.** Já era assim antes desta
  sprint (`bibliotecaArquivos` recebe `fileSize` do input). Não é regressão, e
  o limite real é imposto pelo file router. Não "melhore" isso aqui.
- **Preview de imagem que dependia do base64.** `NovaCotacaoDialog` usa o
  próprio base64 como `src` do preview. Troque por
  `URL.createObjectURL(file)` — e lembre de `URL.revokeObjectURL` ao
  descartar, para não vazar memória.
- **`.slice(0, 10)` em `Solicitacoes.tsx`** é regra de negócio. Preserve.
- **Não delete arquivos antigos do storage.** Registros existentes apontam
  para keys no formato velho. Nada nesta fase toca em dado já gravado.

## Verificação

```bash
yarn run check
yarn test
yarn build
yarn dev
```

Teste manual, **um por tela** — todas com um arquivo grande (> 5 MB) pelo
menos uma vez:

- [ ] Biblioteca de Erros (retrabalhos) — upload de imagem
- [ ] POPs (operações) — upload de imagem, e a imagem aparece nos anexos
- [ ] Currículos — upload de PDF **e a análise por LLM continua rodando**
- [ ] Biblioteca de Arquivos (operações) — upload **e o texto extraído
      continua sendo gravado** (é o teste do 8.4)
- [ ] Nova Cotação (logística) — múltiplas fotos, **com preview funcionando**
- [ ] Solicitações (logística) — múltiplas fotos, limite de 10 preservado
- [ ] Empacotamento — upload de arquivo, upload de foto, **e as duas telas de
      anotação de canvas**

Na aba Network, em qualquer um deles: a chamada `/api/trpc/...` tem que ser
pequena.

## Definição de pronto

- [ ] Os 9 call sites migrados (server + client)
- [ ] `curriculos` e `bibliotecaArquivos` continuam extraindo texto (8.3, 8.4)
- [ ] Preview de foto em `NovaCotacaoDialog` funcionando sem base64
- [ ] Anotações de canvas do Empacotamento funcionando via `base64ParaFile`
- [ ] `express.json` reduzido para `2mb` nos dois caminhos
- [ ] Varredura do 8.8 limpa
- [ ] Todas as telas da lista de verificação testadas com arquivo > 5 MB
- [ ] `yarn run check`, `yarn test`, `yarn build`, `yarn dev` OK
- [ ] Commit: `chore(deploy): migra uploads restantes para upload direto e reduz body limit (sprint vercel, fase 8)`
