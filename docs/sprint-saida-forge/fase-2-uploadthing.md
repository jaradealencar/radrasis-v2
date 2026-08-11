# Fase 2 — Storage: Forge (S3 via presign) → UploadThing

> Leia o `README.md` desta pasta antes de começar — inclusive o
> **bloqueador** sobre as credenciais do Forge, que decide se a Tarefa 2.3 é
> viável.

**Objetivo:** `server/db/storage.ts` passa a gravar no UploadThing, os
arquivos já enviados são migrados, e a rota proxy `/manus-storage/*` é
aposentada.

**Pré-requisitos:** nenhum no código. Mas **confirme o bloqueador do README**
antes de começar a Tarefa 2.3.

**Arquivos que você vai tocar:**
- `server/db/storage.ts` (reimplementação)
- `server/scripts/migrar-storage-uploadthing.mjs` (novo, one-off)
- `server/_core/index.ts` (~linha 85) e `server/_core/storageProxy.ts` (remover)
- `package.json`, `.env.example`

---

## Tarefa 2.1 — Setup

```bash
yarn add uploadthing
```

O token **já está configurado** no `.env` como `UPLOADTHING_TOKEN` (token
único que embute apiKey + appId + região). O SDK lê essa variável
automaticamente, então `new UTApi()` funciona sem argumento.

Adicione `UPLOADTHING_TOKEN=` em `.env.example` (sem o valor real — o
`.env.example` é versionado).

> Versões antigas do SDK usavam `UPLOADTHING_SECRET` + `UPLOADTHING_APP_ID`.
> Se a versão que o `yarn add` trouxer reclamar de variável faltando, é isso
> — confira o changelog do pacote antes de inventar env nova.

---

## Tarefa 2.2 — Reimplementar `server/db/storage.ts`

O arquivo hoje tem 4 peças: `getForgeConfig`, `normalizeKey`,
`appendHashSuffix` e as três funções exportadas. Só as exportadas importam
pro resto do app — **as assinaturas delas não podem mudar.**

### `storagePut(relKey, data, contentType)` → `{ key, url }`

Hoje: pede URL presignada ao Forge, depois faz `PUT` direto no S3.
Depois: um único `utapi.uploadFiles(...)`.

```ts
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const fileName = relKey.split("/").pop() ?? relKey;
  const blob = typeof data === "string"
    ? new Blob([data], { type: contentType })
    : new Blob([data as any], { type: contentType });

  const file = new File([blob], fileName, { type: contentType });
  const res = await utapi.uploadFiles(file);

  if (res.error || !res.data) {
    throw new Error(`UploadThing upload failed: ${res.error?.message ?? "unknown"}`);
  }
  return { key: res.data.key, url: res.data.ufsUrl };
}
```

⚠️ **Confirme o nome do campo de URL na resposta.** O SDK já usou `url`,
depois `ufsUrl`; versões diferentes devolvem coisas diferentes e uma delas
pode estar deprecada. Faça um upload de teste e inspecione o objeto
`res.data` antes de fixar o código.

Sobre `appendHashSuffix` (o sufixo aleatório que evita colisão de nome): o
UploadThing **já gera uma key única própria**, então essa função vira
redundante — pode apagar. O `relKey` que os call sites passam (ex:
`biblioteca-arquivos/1699...-contrato.pdf`) deixa de ser a key real e vira só
o nome do arquivo; isso é esperado.

### `storageGet(relKey)` → `{ key, url }`

Hoje devolve `{ key, url: '/manus-storage/{key}' }` — uma rota do próprio
Express, que resolve o arquivo em tempo real via Forge.

Com UploadThing a URL é pública e permanente, então **não existe mais URL pra
"remontar"**: a URL correta é a que foi salva no banco no momento do upload.

Isso deixa `storageGet` numa situação estranha — ela recebe uma key e não
tem como derivar a URL sozinha. Verifique os call sites antes de decidir:

- Se todos eles têm a URL salva no banco ao lado da key (é o caso da maioria
  — `fileUrl`, `arquivoUrl`, `curriculoUrl`...), **remova `storageGet`** e
  faça os call sites usarem a coluna de URL direto.
- Se algum call site realmente só tem a key, aí sim monte a URL a partir do
  padrão de URL pública do UploadThing.

### `storageGetSignedUrl(relKey)`

Só faz sentido se os arquivos forem privados. Com UploadThing público, é
redundante — mesma análise da `storageGet`.

**Não remova nenhuma das duas no automático.** Rode uma busca por
`storageGet` e `storageGetSignedUrl` no repo, olhe cada uso, e só então
decida. São poucos.

---

## Tarefa 2.3 — Migrar os arquivos já enviados

> **Pare e confirme o bloqueador do README antes desta tarefa.** Se as
> credenciais do Forge não funcionarem mais, esta tarefa é impossível e vira
> uma conversa com o dono do projeto, não um problema de código.

**Rode esta tarefa ANTES da Tarefa 2.2**, ou guarde uma cópia da
implementação antiga de `storageGetSignedUrl` — o script precisa falar com o
Forge pra *baixar*, e com o UploadThing pra *subir*, ao mesmo tempo.

Crie `server/scripts/migrar-storage-uploadthing.mjs` (convenção do projeto —
ver `server/scripts/clean-db.mjs`).

### Inventário de colunas que podem apontar pro Forge

Levantado do `drizzle/schema.ts`. **Confirme cada uma** — algumas podem
guardar URL externa, não do Forge:

| Tabela | Coluna(s) | schema.ts |
|---|---|---|
| `errorLibrary` | `imageUrl` | 66 |
| `pops` | `attachments` (JSON array de URLs) | 197 |
| `cotacoesFrete` | `fotoUrl`, `fotosJson` (JSON array) | 484, 490 |
| `cotacaoComentarios` | `audioUrl` | 535 |
| `cargosFuncoes` | `imagemDivulgacaoUrl`, `imagemDivulgacaoKey` | 641-642 |
| `empacotamentoPedidos` | `arquivoUrl`/`arquivoKey`, `fotografiaUrl`/`fotografiaKey` | 722-723, 738-739 |
| `empacotamentoPedidoFotos` | `url`, `storageKey` | 766-767 |
| `bibliotecaArquivos` | `fileUrl`, `fileKey` | 1048-1049 |
| `analiseCurriculos` | `curriculoUrl`, `curriculoKey` | 1631-1632 |

**Regra pra decidir o que migrar:** só migre valores que começam com
`/manus-storage/`. Qualquer outra coisa (URL externa, campo vazio) fica como
está. Isso também serve de filtro SQL:
`WHERE "fileUrl" LIKE '/manus-storage/%'`.

### Requisitos do script

- **Reentrante**: pular linhas cuja URL já é do UploadThing, pra poder rodar
  de novo se cair no meio.
- **Lote pequeno + log de progresso**: podem ser muitos arquivos (fotos de
  empacotamento e currículos acumulam rápido).
- **Não apagar nada do Forge.** O script só copia e atualiza o banco. Se algo
  der errado, a origem tem que continuar lá.
- **Contar e reportar no fim**: quantas linhas migradas, quantas puladas,
  quantas falharam (e quais).
- Atenção às colunas **JSON** (`pops.attachments`, `cotacoesFrete.fotosJson`):
  são arrays serializados; é preciso parsear, migrar cada item e re-serializar.

---

## Tarefa 2.4 — Aposentar o proxy

Só depois que a 2.3 rodar limpo.

1. Rode uma query de verificação em **todas** as colunas da tabela acima,
   procurando o que ainda casa com `/manus-storage/%`. O resultado tem que
   ser zero linhas.
2. Remova a chamada `registerStorageProxy(app)` de `server/_core/index.ts`
   (~linha 85).
3. Delete `server/_core/storageProxy.ts`.

---

## O que NÃO fazer nesta fase

- Não troque o fluxo de upload do client (base64 via tRPC) pelo widget do
  UploadThing. Ver decisões no README.
- Não mexa em `server/_core/llm.ts` — é a Fase 1.
- Não delete nada do lado do Forge.

---

## Verificação

1. `npx tsc --noEmit` — mesma contagem de erros de antes (17).
2. Faça um upload manual em **cada uma das 5 telas** que gravam arquivo, e
   confirme que o arquivo abre pela URL nova:
   - Biblioteca de Arquivos
   - Currículo em um cargo
   - Imagem em Cargos e Funções
   - Empacotamento (anexo e foto de pedido)
   - Foto em cotação de frete
3. Abra um arquivo **enviado antes da migração** e confirme que ele ainda
   carrega — é o teste que prova que a Tarefa 2.3 funcionou.

**Commit sugerido:** `feat(storage): migra storage do Forge pro UploadThing (Fase 2)`
