# Sprint: sair do Forge (Manus) e do Gemini

Sprint única, dividida em 7 fases — **uma fase por arquivo nesta pasta**, uma
fase por commit. Funde e substitui dois documentos anteriores
(`docs/biblioteca-arquivos-extracao-sem-llm.md` e
`docs/migracao-openai-uploadthing.md`), que mexiam no mesmo código por
motivos diferentes e por isso viraram um plano só.

> **Como usar este material.** Ao atacar uma fase, cole **este README inteiro
> + o arquivo daquela fase** como contexto inicial da conversa. Não é
> necessário (nem recomendado) carregar as outras fases: cada arquivo de fase
> é auto-contido e diz explicitamente o que assumir das fases anteriores.

## Índice das fases

| # | Arquivo | O que faz | Depende de |
|---|---------|-----------|------------|
| 1 | [fase-1-openai.md](fase-1-openai.md) | `invokeLLM` passa a chamar a OpenAI; remove Gemini | — |
| 2 | [fase-2-uploadthing.md](fase-2-uploadthing.md) | `storage.ts` passa a usar UploadThing + migra arquivos já enviados | — |
| 3 | [fase-3-extracao-nativa.md](fase-3-extracao-nativa.md) | Extração de texto real (PDF/DOCX/XLSX) com libs JS, sem LLM | 1 e 2 |
| 4 | [fase-4-testes.md](fase-4-testes.md) | Testes unitários da extração | 3 |
| 5 | [fase-5-notificacao.md](fase-5-notificacao.md) | `notifyOwner` vira alerta dentro do app | — |
| 6 | [fase-6-mapas.md](fase-6-mapas.md) | ✅ **concluída** — `Map.tsx` era código morto e foi deletado | — |
| 7 | [fase-7-limpeza.md](fase-7-limpeza.md) | Remove o que sobrou do Forge do repo | 1–6 |

**Ordem recomendada: 1 → 2 → 3 → 4 → 5 → 7** (a 6 é opcional e pode sair a
qualquer momento). As fases 1, 2, 5 e 6 são independentes entre si e podem
ser feitas em qualquer ordem; a 3 depende das duas primeiras e a 7 depende de
todas.

Por que a 3 vem depois da 1 e da 2: a Fase 3 reescreve trechos de
`server/routers/bibliotecaArquivos.ts` que hoje montam URL do Forge e chamam
o LLM. Fazer a 3 antes obrigaria a escrever esse mesmo trecho duas vezes.

---

## Contexto

O projeto nasceu do template "Manus webdev fullstack" e ainda carrega duas
integrações desse template (o resto já saiu: banco virou Postgres, auth
virou Better Auth — ver `AGENTS.md`):

- **Forge** (`BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY`,
  `forge.manus.im`): gateway único que hoje serve **LLM** (proxy pra
  `gemini-2.5-flash`), **storage de arquivo** (presign PUT/GET sobre S3),
  **notificação** ao dono do projeto e **mapas** (proxy do Google Maps JS).
- **Gemini direto** (`GEMINI_API_KEY`, `@google/generative-ai`): usado só no
  chat da página Conhecimento (`askGemini`, `server/integrations/gemini.ts`).
  É uma segunda integração de LLM fazendo o que `invokeLLM` já faz.

Destino: **OpenAI** pra tudo de IA, **UploadThing** pra arquivo,
**alertas do próprio app** pra notificação.

### Onde o Forge é usado hoje (inventário completo, já levantado)

| Módulo | Status | Fase que resolve |
|---|---|---|
| `server/_core/llm.ts` | **ativo**, ~10 call sites | 1 |
| `server/db/storage.ts` | **ativo**, ~12 call sites | 2 |
| `server/_core/storageProxy.ts` | **ativo** (rota `GET /manus-storage/*`) | 2 |
| `server/_core/notification.ts` | **ativo**, 1 call site | 5 |
| `client/src/components/Map.tsx` | **código morto** (nenhuma página importa) | 6 |
| `server/_core/map.ts` | **código morto** (nenhum call site) | 7 |
| `server/_core/imageGeneration.ts` | **código morto** (nenhum call site) | 7 |
| `server/_core/dataApi.ts` | **código morto** (nenhum call site) | 7 |
| `server/_core/voiceTranscription.ts` | **código morto** (nenhum call site) | 7 |

---

## ⚠️ Bloqueador a verificar ANTES de começar a Fase 2

No `.env` local, `BUILT_IN_FORGE_API_URL` e `BUILT_IN_FORGE_API_KEY` estão
**vazios** (assim como `GEMINI_API_KEY`). Isso significa que, localmente,
storage e LLM já estão quebrados hoje.

A Fase 2 precisa **baixar do Forge** todos os arquivos já enviados pra
reenviar ao UploadThing. Isso só é possível enquanto a conta Forge/Manus
estiver viva e as credenciais existirem em algum lugar (provavelmente no
ambiente de produção, não no `.env` local).

**Antes de planejar a Fase 2, confirme com o dono do projeto:** as
credenciais do Forge de produção ainda funcionam? Se não funcionarem mais, os
arquivos já enviados podem estar inacessíveis, e a Fase 2 vira "migrar só o
código, aceitar a perda dos arquivos antigos" — decisão de negócio, não
técnica. Não descubra isso no meio da implementação.

---

## Decisões já tomadas (não reabrir sem motivo forte)

**IA / LLM**
- **OpenAI, família GPT-5.** Default `gpt-5-mini`; promover call site
  específico pra `gpt-5` só se a qualidade não bastar depois de testada.
- **Preservar a assinatura de `invokeLLM`** (`server/_core/llm.ts`). O
  payload que ela monta já é formato OpenAI Chat Completions — é assim que o
  Forge conseguia fazer proxy pro Gemini. Trocar só a implementação interna
  evita tocar nos ~10 call sites.
- **Sem o SDK `openai` do npm.** O padrão do repo pra API externa é `fetch`
  cru com tipos próprios (ver `server/integrations/mubisys-client.ts` e o
  próprio `llm.ts`). Não adicionar dependência só pra trocar a URL de um
  `fetch`.
- **Nada de Gemini sobra.** `askGemini` e `@google/generative-ai` somem.

**Storage**
- **`storagePut`/`storageGet`/`storageGetSignedUrl` mudam de implementação,
  não de assinatura.** ~12 call sites esperam `{ key, url }`; nenhum precisa
  saber que o backend mudou.
- **UploadThing via SDK server-side (`UTApi`)**, não via widget de upload no
  browser. O fluxo atual (client manda base64 por tRPC → server grava) já
  funciona; trocar pro widget reescreveria telas sem ganho.
- **Migrar os bytes é obrigatório.** Ver bloqueador acima.

**Extração de texto**
- **Sem MarkItDown/Python.** O stack é 100% Node/TS; libs JS nativas cobrem
  o que precisamos.
- **LLM só onde é insubstituível**: imagem (visão) e PDF escaneado sem camada
  de texto — fallback, nunca default.
- **Formatos fora de PDF/DOCX/XLSX** (pptx, odt...) continuam com o resumo
  especulativo atual. Não é escopo cobrir todo formato existente.

**Notificação**
- **Vira alerta dentro do app**, reaproveitando `alertasSistema` /
  `alertasRouter` / `Alertas.tsx`, que já existem. Sem provedor externo. A
  opção "e-mail via Resend", levantada antes, foi **descartada**.

---

## Regras do projeto que valem em TODAS as fases

Estas não são sugestões — quebrar qualquer uma delas gera retrabalho.

1. **Yarn, nunca npm/pnpm.** `yarn add x`, `yarn remove x`. O lockfile é
   `yarn.lock`.
2. **Type-check é `npx tsc --noEmit`.** Não use `yarn check` — esse dispara o
   comando nativo do Yarn (valida lockfile) e devolve resultado errado.
3. **`npx tsc --noEmit` já acusa 17 erros pré-existentes** — inclusive em
   `server/routers/curriculos.ts` e `server/routers/qualidade.ts`, que esta
   sprint encosta. **Não tente corrigir esses erros.** Antes de começar,
   rode o comando e guarde a saída; ao terminar, compare: o objetivo é *não
   aumentar* a contagem, não zerá-la.
4. **Mudança de schema só via migration.** Editar `drizzle/schema.ts` →
   `npx drizzle-kit generate` → **revisar o SQL gerado** → `npx drizzle-kit
   migrate`. Nunca rode `ALTER TABLE` solto.
5. **Testes ficam em `server/__tests__/*.test.ts`.** Rodar com `yarn test`.
   `DATABASE_URL` precisa estar exportada no shell, senão as suítes que tocam
   banco falham na conexão.
6. **Um commit por fase**, e atualize o arquivo da fase (marcando tarefas
   concluídas, registrando o que descobriu) como parte desse commit.
7. **Ao fechar uma fase, verifique se `AGENTS.md` precisa de ajuste** —
   dependência nova, arquivo que sumiu, ponta solta resolvida.
8. **Não refatore o que a fase não pede.** Se encontrar algo feio fora do
   escopo, anote no arquivo da fase e siga.

## Convenção sobre números de linha

Os arquivos de fase citam linhas (ex: `llm.ts:212`) pra você achar o trecho
rápido. **Elas envelhecem.** Confirme sempre pelo nome da função/variável
citada junto, não pelo número puro.
