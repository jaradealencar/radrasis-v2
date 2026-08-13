# Fase 7 — Upload direto ao UploadThing: fundação + piloto

**Depende de:** Fase 1 (edita `server/_core/app.ts`).
**A Fase 8 migra os call sites restantes usando o que esta cria.** Não pule.

## Objetivo

Hoje todo arquivo do sistema sobe **como base64 dentro do payload tRPC**. Por
isso `server/_core/app.ts` tem `express.json({ limit: "50mb" })`. O fluxo é:

```
browser → FileReader → base64 → tRPC (JSON) → Express → Buffer → UploadThing
```

A Vercel limita o corpo de uma requisição de função serverless a **4.5 MB**,
sem override possível. Base64 infla ~33%, então o teto real de arquivo vira
**~3.3 MB**. Acima disso o upload falha em produção — e falha de um jeito
ruim, com erro de plataforma antes de o código do app ser executado.

O fluxo novo tira o servidor do meio do caminho do byte:

```
browser → UploadThing (direto)  →  devolve { url, key }
browser → tRPC { url, key, ... } → Express → banco
```

O tRPC continua sendo quem grava no banco e quem aplica as regras de negócio.
Só deixa de transportar o arquivo. **O resultado final é idêntico ao de
hoje:** arquivo no UploadThing, URL no banco.

Esta fase cria a infraestrutura e prova que funciona **num único call site
piloto** — `cargos.uploadImage`, o mais simples dos onze (recebe arquivo,
devolve URL, não toca no banco). Os outros dez são trabalho da Fase 8.

### Inventário completo (para referência; a Fase 8 executa)

| # | Procedure tRPC | Arquivo do server | Call site no client |
|---|---|---|---|
| 1 | `cargos.uploadImage` | `server/routers/cargos.ts:58` | `client/src/components/ImageUploadField.tsx:31` |
| 2 | `curriculos.uploadAndAnalyze` | `server/routers/curriculos.ts:14` | `client/src/components/CurriculumUploadSection.tsx:43` |
| 3 | `pops.uploadImage` | `server/routers.ts:1058` | `client/src/pages/operacoes/Pops.tsx:280` |
| 4 | `errorLibrary.uploadImage` | `server/routers.ts:131` | `client/src/pages/retrabalhos/BibliotecaErros.tsx:400` |
| 5 | `bibliotecaArquivos.criar` | `server/routers/bibliotecaArquivos.ts:150` | `client/src/pages/operacoes/BibliotecaArquivos.tsx:228` |
| 6 | `cotacoesFrete.uploadFotos` | `server/routers/logistica.ts:828` | `NovaCotacaoDialog.tsx:296` e `Solicitacoes.tsx:694` |
| 7 | `empacotamento.uploadArquivo` | `server/routers/empacotamento.ts:935` | `pages/logistica/Empacotamento.tsx` |
| 8 | `empacotamento.uploadFoto` | `server/routers/empacotamento.ts:954` | `pages/logistica/Empacotamento.tsx` |
| 9 | `empacotamento.atualizarFotoAnotada` | `server/routers/empacotamento.ts:985` | `pages/logistica/Empacotamento.tsx` |
| 10 | `empacotamento.atualizarArquivoPedidoAnotado` | `server/routers/empacotamento.ts:1002` | `pages/logistica/Empacotamento.tsx` |

**Nesta fase só o #1 é migrado.**

---

## 7.1 — Instalar as dependências do client

```bash
yarn add @uploadthing/react
```

`uploadthing` já está instalado (é o que `server/db/storage.ts` usa via
`UTApi`). O `@uploadthing/react` é o lado do browser.

## 7.2 — Criar o file router: `server/_core/uploadthing.ts`

O upload direto do browser exige um endpoint que **autorize** o upload e
devolva a URL assinada. É o "file router" do UploadThing.

```ts
import { createUploadthing, type FileRouter } from "uploadthing/express";
import { UploadThingError } from "uploadthing/server";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth";

const f = createUploadthing();

/**
 * Autoriza o upload: só usuário logado sobe arquivo.
 *
 * É a mesma checagem de sessão que `createContext` faz para o tRPC
 * (`server/_core/context.ts`) — antes desta sprint a autorização vinha de
 * graça, porque o arquivo passava por uma `protectedProcedure`. Com o upload
 * direto, o browser fala com o UploadThing sem passar pelo tRPC, então a
 * checagem precisa acontecer aqui.
 */
async function requireUser(req: any) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) throw new UploadThingError("Não autenticado");
  return { userId: session.user.id };
}

export const uploadRouter = {
  /**
   * Imagens: fotos de cotação, imagens de POP, biblioteca de erros, cargos,
   * fotos e anotações de empacotamento.
   */
  imagem: f({
    image: { maxFileSize: "16MB", maxFileCount: 10 },
  })
    .middleware(({ req }) => requireUser(req))
    .onUploadComplete(({ file, metadata }) => {
      // O client recebe o retorno desta função junto com url/key.
      return { uploadedBy: metadata.userId, name: file.name };
    }),

  /**
   * Documentos: currículos (PDF/DOCX/TXT) e biblioteca de arquivos.
   */
  documento: f({
    pdf: { maxFileSize: "32MB", maxFileCount: 1 },
    text: { maxFileSize: "8MB", maxFileCount: 1 },
    blob: { maxFileSize: "32MB", maxFileCount: 1 },
  })
    .middleware(({ req }) => requireUser(req))
    .onUploadComplete(({ file, metadata }) => {
      return { uploadedBy: metadata.userId, name: file.name };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
```

> **Sobre os limites de tamanho:** foram escolhidos com folga sobre o que o
> sistema recebe hoje, e são o **único** teto agora — não há mais o limite de
> 4.5 MB da Vercel no caminho, porque o arquivo não passa mais pela função.
> Se o time quiser limites mais apertados por tipo, é ajuste de uma linha
> aqui.

> **Sobre as chaves das rotas (`imagem`/`documento`):** duas rotas cobrem os
> onze call sites. Não crie uma rota por call site — vira configuração morta.

## 7.3 — Montar a rota em `server/_core/app.ts`

Dentro de `createApp()`, **depois** do body parser e **antes** do
`app.use("/api/trpc", ...)`:

```ts
  // ── UploadThing: rota de upload direto do browser ─────────────────────────
  // O arquivo NÃO passa por aqui — este endpoint só assina a permissão de
  // upload e recebe o callback de conclusão. Ver docs/sprint-migracao-vercel,
  // Fase 7: em serverless o corpo de uma requisição é limitado a 4.5 MB, o
  // que inviabilizava o upload via base64 no payload do tRPC.
  const { createRouteHandler } = await import("uploadthing/express");
  const { uploadRouter } = await import("./uploadthing");
  app.use("/api/uploadthing", createRouteHandler({ router: uploadRouter }));
```

O `UPLOADTHING_TOKEN` já existe no `.env.example` e já é usado pela `UTApi` —
o `createRouteHandler` lê a mesma variável. **Nenhuma env nova.**

## 7.4 — Criar o helper do client: `client/src/lib/upload.ts`

Um helper único, usado por todos os call sites, para que a Fase 8 seja
substituição mecânica e não onze implementações diferentes.

```ts
import { generateReactHelpers } from "@uploadthing/react";
import type { UploadRouter } from "../../../server/_core/uploadthing";

export const { useUploadThing } = generateReactHelpers<UploadRouter>();

/** O que todo call site recebe de volta depois de subir um arquivo. */
export interface ArquivoEnviado {
  url: string;
  key: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Sobe arquivos direto para o UploadThing, sem passar pelo servidor.
 *
 * Antes desta sprint os arquivos iam em base64 dentro do payload tRPC. Isso
 * não sobrevive ao limite de 4.5 MB de corpo de requisição da Vercel (base64
 * infla ~33%, então o teto real era ~3.3 MB de arquivo).
 *
 * O fluxo agora é: sobe aqui → recebe { url, key } → manda só isso para a
 * mutation tRPC, que segue gravando no banco como sempre fez.
 */
export async function enviarArquivos(
  rota: "imagem" | "documento",
  arquivos: File[],
  opts?: { onProgress?: (pct: number) => void },
): Promise<ArquivoEnviado[]> {
  const { uploadFiles } = await import("@uploadthing/react");
  const helpers = generateReactHelpers<UploadRouter>();
  const res = await helpers.uploadFiles(rota, {
    files: arquivos,
    onUploadProgress: opts?.onProgress,
  });

  return res.map((r, i) => ({
    url: r.ufsUrl,
    key: r.key,
    fileName: arquivos[i].name,
    mimeType: arquivos[i].type || "application/octet-stream",
    fileSize: arquivos[i].size,
  }));
}

/** Conveniência para os call sites que sobem um arquivo só. */
export async function enviarArquivo(
  rota: "imagem" | "documento",
  arquivo: File,
  opts?: { onProgress?: (pct: number) => void },
): Promise<ArquivoEnviado> {
  const [enviado] = await enviarArquivos(rota, [arquivo], opts);
  return enviado;
}

/**
 * Converte um data URL / base64 de canvas em File, para os call sites que
 * geram a imagem no browser em vez de receber de um `<input type="file">`
 * (as anotações de canvas do Empacotamento).
 */
export function base64ParaFile(
  base64: string,
  fileName: string,
  mimeType = "image/png",
): File {
  const limpo = base64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(limpo);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], fileName, { type: mimeType });
}
```

> **`base64ParaFile` não é usado nesta fase.** Está aqui porque a Fase 8
> precisa dele nos call sites #9 e #10 (anotações de canvas), e a regra de
> ouro 2 do README da sprint pages vale aqui também: primitivas se criam na
> fase de fundação, não no meio da migração.

## 7.5 — Piloto: migrar `cargos.uploadImage`

### Server — `server/routers/cargos.ts:58`

**Antes:**

```ts
  uploadImage: protectedProcedure
    .input(z.object({
      base64: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const buffer = Buffer.from(input.base64, "base64");
        const storageKey = `cargos/imagens/${Date.now()}-${input.fileName}`;
        const { url, key } = await storagePut(storageKey, buffer, input.mimeType);
        return { url, key, success: true };
      } catch (error) {
        console.error("[Cargos] Erro ao fazer upload de imagem:", error);
        throw new Error("Falha ao fazer upload da imagem");
      }
    }),
```

**Depois:**

```ts
  /**
   * O arquivo agora sobe direto do browser para o UploadThing (ver
   * client/src/lib/upload.ts); esta procedure só recebe o resultado.
   * Mantida para não quebrar o contrato do client e para o caso de passar a
   * registrar o upload no banco.
   */
  uploadImage: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      key: z.string().min(1),
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      return { url: input.url, key: input.key, success: true };
    }),
```

Se `storagePut` deixar de ser usado neste arquivo, **remova o import**
(`server/routers/cargos.ts:3`) — o `yarn run check` acusa se sobrar.

### Client — `client/src/components/ImageUploadField.tsx`

Localize o trecho que lê o arquivo com `FileReader` e chama a mutation com
`base64`. Substitua a leitura pelo helper:

```diff
- const base64Data = /* resultado do FileReader */;
- const res = await uploadMut.mutateAsync({
-   base64: base64Data,
-   fileName: file.name,
-   mimeType: file.type,
- });
+ const enviado = await enviarArquivo("imagem", file);
+ const res = await uploadMut.mutateAsync({
+   url: enviado.url,
+   key: enviado.key,
+   fileName: enviado.fileName,
+   mimeType: enviado.mimeType,
+ });
```

Com o import no topo:

```ts
import { enviarArquivo } from "@/lib/upload";
```

**Remova o `FileReader` que ficou órfão** — inclusive a `Promise` que o
embrulha, se houver. Deixar código morto aqui atrapalha a Fase 8, que usa
este arquivo como modelo.

**Não mude o resto do componente:** estados de loading, mensagens de erro,
preview da imagem, validações. Só a origem da URL muda.

## 7.6 — Baixar o limite do body parser? **Ainda não.**

Tentador, mas errado nesta fase: os outros dez call sites continuam mandando
base64 até a Fase 8. Baixar o limite agora quebraria todos eles em
desenvolvimento. **O `express.json({ limit: "50mb" })` só é reduzido na Fase
8.**

---

## Armadilhas conhecidas

- **A autorização mudou de lugar.** Antes o `protectedProcedure` garantia que
  só usuário logado subia arquivo. Agora o browser fala direto com o
  UploadThing, e quem barra é o `.middleware()` do file router. Se você
  criar uma rota nova no `uploadthing.ts` **sem** `.middleware(requireUser)`,
  abriu um endpoint de upload anônimo. Não faça isso.
- **`ufsUrl`, não `url`.** O retorno do UploadThing tem os dois em versões
  diferentes do SDK; `server/db/storage.ts:24` já usa `res.data.ufsUrl`, então
  o helper segue o mesmo campo por consistência. Se o typecheck reclamar, é
  aqui que se olha.
- **O import de tipo em `client/src/lib/upload.ts` atravessa a fronteira
  client↔server.** É `import type`, então é apagado na compilação e nada do
  server vai parar no bundle. **Tem que continuar sendo `import type`** — sem
  a palavra `type`, você arrasta `auth.ts`, Drizzle e o banco inteiro para
  dentro do bundle do browser.
- **UploadThing precisa de token válido em dev.** Se `UPLOADTHING_TOKEN`
  estiver vazio no `.env` local, o upload direto falha logo no
  `/api/uploadthing`. Antes falhava mais tarde (no `storagePut`), o que dava a
  falsa impressão de funcionar.

## Verificação

```bash
yarn run check
yarn test
yarn build
yarn dev
```

Teste manual, na tela de **Cargos e Funções** (operações):

1. Suba uma imagem pequena (< 1 MB). Tem que aparecer normalmente.
2. Suba uma imagem **grande, acima de 5 MB**. Este é o teste que dá sentido à
   fase: antes o payload teria ~6.7 MB de base64; agora o tRPC recebe algumas
   centenas de bytes.
3. Na aba **Network** do browser, confirme o desenho novo: uma requisição para
   `/api/uploadthing`, uma requisição de upload para o domínio do UploadThing,
   e só então uma chamada `/api/trpc/...` **pequena**.
4. Deslogue e tente subir (via console, forçando a chamada): tem que ser
   rejeitado pelo middleware.

O item 3 é o que prova que a migração aconteceu de verdade. Se a chamada
`/api/trpc` ainda estiver com megabytes de payload, o `FileReader` velho
ficou no caminho.

## Definição de pronto

- [ ] `@uploadthing/react` instalado
- [ ] `server/_core/uploadthing.ts` criado, com `requireUser` nas duas rotas
- [ ] `/api/uploadthing` montado em `server/_core/app.ts`
- [ ] `client/src/lib/upload.ts` criado, com `import type` na referência ao server
- [ ] `cargos.uploadImage` recebendo `{ url, key }` em vez de base64
- [ ] `ImageUploadField.tsx` usando `enviarArquivo`, sem `FileReader` órfão
- [ ] `express.json({ limit: "50mb" })` **inalterado** (é a Fase 8 que mexe)
- [ ] Upload de imagem > 5 MB funcionando na tela de Cargos
- [ ] Network mostrando o payload tRPC pequeno
- [ ] `yarn run check`, `yarn test`, `yarn build`, `yarn dev` OK
- [ ] Commit: `chore(deploy): adiciona upload direto ao UploadThing e migra cargos como piloto (sprint vercel, fase 7)`
