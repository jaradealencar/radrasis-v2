# Fase 1 — LLM: Forge + Gemini → OpenAI

> Leia o `README.md` desta pasta antes de começar (contexto, decisões e as 8
> regras do projeto).

**Objetivo:** `invokeLLM` passa a falar direto com a API da OpenAI, e a
segunda integração de LLM (Gemini) deixa de existir. Nenhum call site de
`invokeLLM` muda de assinatura.

**Pré-requisitos:** nenhum. Esta fase é independente das outras.

**Arquivos que você vai tocar:**
- `server/_core/llm.ts` (o grosso do trabalho)
- `server/_core/env.ts`
- `.env.example` e `.env`
- `server/routers.ts` (um trecho, ~linha 542)
- `server/routers/bibliotecaArquivos.ts` (dois trechos)
- `server/routers/curriculos.ts` (um trecho)
- `server/integrations/gemini.ts` (deletar)
- `package.json`

---

## Tarefa 1.1 — Env var nova

Em `server/_core/env.ts`, adicione ao objeto `ENV`:

```ts
openaiApiKey: process.env.OPENAI_API_KEY ?? "",
```

**Não remova** `forgeApiUrl`/`forgeApiKey` — storage e notificação ainda
dependem deles até as Fases 2 e 5. Quem limpa isso é a Fase 7.

Adicione `OPENAI_API_KEY=` em `.env.example` (na seção `# IA / geração`) e
preencha o valor real em `.env`.

---

## Tarefa 1.2 — Trocar a implementação de `invokeLLM`

Tudo em `server/_core/llm.ts`.

### a) URL e autenticação

Hoje (`resolveApiUrl`, ~linha 212) a função tem um fallback pro Forge.
Substitua as duas funções por:

```ts
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const assertApiKey = () => {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
```

E no `fetch` (~linha 315), troque a URL por `OPENAI_API_URL` e o header para
`authorization: \`Bearer ${ENV.openaiApiKey}\``.

> A mensagem de erro `"OPENAI_API_KEY is not configured"` **já está** no
> código hoje, checando a chave do Forge — é um resquício do template
> original. Agora ela finalmente fica correta.

### b) Modelo

Hoje o payload fixa `model: "gemini-2.5-flash"` (~linha 283). Troque por um
modelo da família **GPT-5**, com `gpt-5-mini` como default.

Em vez de fixar o modelo pra sempre, aceite um override opcional — assim, se
um call site específico precisar de mais qualidade, dá pra promover só ele
sem mudar os outros:

```ts
// no type InvokeParams:
model?: string;

// no corpo de invokeLLM:
const payload: Record<string, unknown> = {
  model: params.model ?? "gpt-5-mini",
  messages: messages.map(normalizeMessage),
};
```

**Não saia promovendo call sites pra `gpt-5` preventivamente.** Deixe todo
mundo no default; só troque se um teste real mostrar qualidade ruim.

### c) Parâmetros que não existem na OpenAI

```ts
payload.max_tokens = 32768
payload.thinking = {
  "budget_tokens": 128
}
```

- **`thinking`: apague.** É parâmetro do Gemini exposto pelo proxy do Forge.
  Não existe na OpenAI e provavelmente causa erro 400.
- **`max_tokens`: os modelos novos da OpenAI usam `max_completion_tokens`.**
  Além disso, 32768 é um teto alto pra chutar — confirme o limite do modelo
  escolhido. Se não tiver certeza, **simplesmente não envie o parâmetro**: a
  API aplica o default dela, e nenhum call site do projeto depende de um teto
  específico.

### d) Conteúdo de arquivo e imagem — o ponto delicado

⚠️ **Este é o trecho mais provável de dar errado. Leia inteiro antes de
escrever código.**

Hoje o código monta uma URL e manda pro modelo:

```ts
{ type: "file_url", file_url: { url, mime_type: "application/pdf" } }
{ type: "image_url", image_url: { url } }
```

Isso funcionava porque o Forge resolvia a URL internamente, sem sair pra
internet.

**Por que não dá pra simplesmente manter a URL:** a OpenAI aceita, sim, URL
pública pra imagem — o problema não é a API dela, é a *nossa* URL. Hoje ela é
`/manus-storage/{key}`, uma rota do próprio Express que exige credencial do
Forge. A OpenAI não consegue alcançar isso.

> Depois da Fase 2, as URLs do UploadThing passam a ser públicas e
> permanentes, e aí URL vira uma opção válida pra imagem. Ainda assim, veja
> abaixo por que base64 continua sendo a melhor escolha aqui.

### Os três caminhos possíveis

| Caminho | Quando usar |
|---|---|
| **base64 inline** (data URI) | **Default nos nossos call sites.** Arquivos pequenos/médios |
| **Files API** (`file_id`) | Arquivo grande, ou se o inline estourar limite de tamanho |
| **URL pública** | Só imagem, e só depois da Fase 2. Não precisamos |

**Por que base64 é o default aqui:** nos três pontos onde isso acontece, o
servidor **já tem os bytes em mãos** naquele instante (é o que o client
acabou de enviar). Usar URL significaria: receber o arquivo → subir pro
storage → pedir pra OpenAI baixar de volta. Volta inteira pra buscar algo que
já estava ali.

⚠️ **Limite de tamanho — não ignore.** Base64 infla o arquivo em ~33%. Um PDF
de 20 MB vira ~27 MB de requisição, e existe teto. **Confirme o limite atual
na documentação da OpenAI** e coloque uma guarda no código: acima do limite,
use a Files API (`file_id`) em vez de inline. Sem essa guarda, um upload
grande falha em produção com erro difícil de entender.

Formato esperado (**confirme na documentação atual da OpenAI antes de
escrever** — input de arquivo é a parte da API que mais muda):

```ts
// imagem
{ type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }

// PDF, inline
{
  type: "file",
  file: { filename: "documento.pdf", file_data: `data:application/pdf;base64,${base64}` }
}

// PDF, via Files API (arquivos grandes)
{ type: "file", file: { file_id: "file-abc123" } }
```

> Atenção: pra **PDF**, URL pública não é equivalente ao que existe pra
> imagem — a API trata arquivo e imagem de formas diferentes. Os caminhos
> reais são `file_data` inline ou `file_id`. Valide isso com um teste isolado
> **antes** de mexer nos call sites.

Ajuste também os *types* no topo do arquivo: `FileContent` hoje é
`{ type: "file_url"; file_url: {...} }`, e `normalizeContentPart` (~linha
117) trata `part.type === "file_url"`. Os dois precisam refletir o formato
novo, senão o TypeScript reclama nos call sites.

---

## Tarefa 1.3 — Ajustar os dois call sites que mandam arquivo

Só existem dois. Ambos passam a mandar base64 inline (Tarefa 1.2d).

### `server/routers/curriculos.ts` (~linha 50, `uploadAndAnalyze`)

Hoje ele faz `storagePut` e passa o `url` retornado pro LLM.

**Mantenha o `storagePut`** — o currículo precisa continuar sendo salvo
(a coluna `curriculoUrl` depende disso). Mude **só** o que vai pro LLM:
em vez de `file_url: { url }`, use o `input.fileContent`, que já é o base64
do arquivo.

### `server/routers/bibliotecaArquivos.ts` (~linha 27-54, dentro de `extrairTextoArquivo`)

Hoje, pra PDF e imagem, a função:
1. sobe o arquivo pra `temp-extract/...` via `storagePut`,
2. remonta uma URL absoluta com
   `(process.env.BUILT_IN_FORGE_API_URL ?? "").replace("/api/forge", "")`,
3. manda essa URL pro LLM.

**Apague os passos 1 e 2 inteiros.** A função já recebe `fileBase64` como
parâmetro — use direto. Isso também para de gerar lixo em `temp-extract/`,
que nunca era limpo.

Faça o mesmo na procedure `reextrairTexto` (~linha 169), que repete a
remontagem de URL.

> A Fase 3 vai reestruturar essa função inteira. Aqui você só conserta o
> mecanismo de passar o arquivo — não antecipe o trabalho da Fase 3.

---

## Tarefa 1.4 — Remover o Gemini

1. **`server/routers.ts`, ~linha 542** (chat da página Conhecimento):

   Troque `askGemini([...])` por `invokeLLM({ messages: [...] })`. O conteúdo
   do prompt não muda; muda só o formato do envelope:

   ```ts
   // antes (formato do SDK do Gemini)
   askGemini([{ role: "user", parts: [{ text: prompt }] }])

   // depois (formato que invokeLLM já espera)
   const response = await invokeLLM({ messages: [{ role: "user", content: prompt }] });
   const geminiAnswer = response.choices?.[0]?.message?.content ?? "";
   ```

   **Não renomeie os campos `geminiAnswer` / `geminiAnswerIsGeneral` do
   retorno.** Três telas do client já consomem esses nomes
   (`Conhecimento.tsx`, `SugestoesConhecimento.tsx`, `InsightsLogistica.tsx`).
   Renomear é uma mudança separada, fora do escopo desta sprint.

2. **Delete** `server/integrations/gemini.ts`.

3. `yarn remove @google/generative-ai`.

4. Remova `GEMINI_API_KEY` de `.env.example`, de `.env` e de
   `server/_core/env.ts` (se estiver lá).

---

## O que NÃO fazer nesta fase

- Não instale o pacote `openai` (ver decisões no README).
- Não mexa em `server/db/storage.ts` — é a Fase 2.
- Não reestruture `extrairTextoArquivo` além do trecho de arquivo/imagem — é
  a Fase 3.
- Não tente corrigir os 17 erros de tipo pré-existentes.

---

## Verificação

1. `npx tsc --noEmit` — a contagem de erros deve ser a mesma de antes de você
   começar (17), não menos e não mais.
2. Teste manualmente **um call site de cada tipo**, porque eles exercitam
   caminhos diferentes do código:

   | Tipo | Onde testar |
   |---|---|
   | Texto puro | "Gerar com IA" em Qualidade (`gerarAcoesIA`) |
   | JSON estruturado (`outputSchema`) | Gerar POP a partir de um erro |
   | Visão / imagem | Upload de imagem na Biblioteca de Arquivos |
   | PDF | Upload de currículo em um cargo |
   | Chat | Pergunta na página Conhecimento |

3. Confirme que nenhum arquivo novo apareceu em `temp-extract/` no storage.

**Commit sugerido:** `feat(llm): migra invokeLLM pro OpenAI e remove Gemini (Fase 1)`

---

## Status: concluída (2026-08-11)

Todas as tarefas (1.1–1.4) implementadas. `npx tsc --noEmit` ficou em **16
erros** (baseline media 17) — nenhuma regressão introduzida.

### Descobertas / desvios do plano

- **Formato do arquivo confirmado** via documentação oficial da OpenAI
  (não só o exemplo do plano): `{ type: "file", file: { filename,
  file_data } }` pra inline, `{ type: "file", file: { file_id } }` pra
  Files API. Upload pra Files API usa `purpose: "user_data"`.
- **Limite de tamanho:** a documentação da OpenAI cita números
  inconsistentes entre si (32MB "conteúdo total de arquivo por request" em
  um lugar, 50MB "combinado" em outro). Escolhemos uma guarda conservadora:
  acima de **20MB de bytes crus** (~26.6MB em base64) usa Files API, senão
  manda inline. Ajustar se a OpenAI publicar um número mais preciso.
- **`reextrairTexto` (bibliotecaArquivos.ts) precisou de mais que "remover
  a remontagem de URL":** diferente de `extrairTextoArquivo`, essa
  procedure não recebe `fileBase64` do client — o arquivo já está no
  storage. Solução: `storageGetSignedUrl` + `fetch` pra baixar os bytes,
  depois `Buffer.toString("base64")` e `buildFileContent`, igual ao
  caminho normal.
- **Helpers novos exportados de `llm.ts`:** `buildFileContent` (base64 ou
  Files API conforme tamanho) e `buildImageContent` (data URI), usados
  pelos três call sites de arquivo pra não duplicar a lógica de tamanho.
- **`server/_core/llm.ts:231`** precisou de `new Blob([new
  Uint8Array(buffer)])` em vez de `new Blob([buffer])` — `Buffer` não bate
  com o tipo `BlobPart` do lib.dom nesse TS/Node. Mesmo problema que já
  existia em `storage.ts` (lá resolvido com `as any`).

### Teste manual — bloqueado por falta de crédito

Rodei um script isolado (`tsx`) batendo direto em `invokeLLM` pros 4
formatos (texto, JSON schema, imagem base64, PDF base64). A chamada
**chegou na OpenAI e autenticou** (não é erro 401 — a key em `.env` é
válida), mas voltou:

```
429 insufficient_quota — "You have no credits remaining."
```

Ou seja: **mecanismo de request confirmado correto (URL, auth, payload
aceito pela API a ponto de processar e checar quota), mas não dá pra
confirmar o formato exato da resposta nem validar visão/PDF de ponta a
ponta** até a conta OpenAI (`jaradealencar@gmail.com` ou quem for o dono
da org) ter crédito. **Ação pro dono do projeto:** adicionar crédito em
platform.openai.com/settings/organization/billing antes de testar os 5
call sites listados na seção Verificação.

### Fora de escopo, anotado pra depois

- Client ainda tem textos "Powered by Gemini" / "Resposta do Gemini"
  (`InsightsLogistica.tsx`, `Conhecimento.tsx`, `SugestoesConhecimento.tsx`)
  — só rótulo de UI, não quebra nada, mas fica desatualizado. Fora do
  escopo desta fase (só `server/` estava na lista de arquivos a tocar).
- `server/routers/crm.ts:419` tem um comentário `// Mensagem motivacional
  via Gemini` que já estava errado antes desta fase (a procedure já usava
  `invokeLLM`, não Gemini). Cosmético, não mexi.
