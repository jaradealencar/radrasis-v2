# Fase 7 — Limpeza final do Forge

> ✅ **CONCLUÍDA.** Módulos mortos deletados (7.1), envs residuais (Forge e
> OAuth do template) removidas de `env.ts`/`.env.example` (7.2),
> `vite-plugin-manus-runtime`/`allowedHosts` de domínios Manus removidos de
> `vite.config.ts` — o debug collector (`vitePluginManusDebugCollector`) foi
> mantido por ainda ser útil em dev local (7.2), e `AGENTS.md` atualizado
> (7.3). Busca por `forge`/`gemini` no repo (fora de `docs/archive/`) não
> encontrou código ativo dependendo de nenhum dos dois — os poucos hits em
> `Conhecimento.tsx`/`InsightsLogistica.tsx`/`crm.ts`/`routers.ts` são só
> nomes de campo e texto de UI herdados de quando a Fase 1 usava Gemini
> direto; a chamada por trás já é `invokeLLM` (OpenAI). Renomear isso ficou
> fora do escopo desta fase.

> Leia o `README.md` desta pasta antes de começar.

**Objetivo:** remover do repo tudo que sobrou do Forge e do template Manus,
e atualizar a documentação pra refletir a realidade.

**Pré-requisitos:** Fases 1–6 concluídas **e confirmadas em produção**. Se
qualquer coisa ainda apontar pro Forge, esta fase quebra o app.

**Antes de começar**, rode uma busca por `forge` (case-insensitive) no repo
inteiro, ignorando `docs/archive/`, e confirme que o que sobrou é só o que
esta fase vai remover.

---

## Tarefa 7.1 — Deletar os módulos mortos

Estes quatro **nunca tiveram call site nenhum** em `server/` ou `client/` —
são código do template que nunca foi usado. Já foi confirmado por busca no
repo inteiro:

```
server/_core/imageGeneration.ts     (geração de imagem)
server/_core/dataApi.ts             (API de dados genérica)
server/_core/voiceTranscription.ts  (transcrição de áudio)
server/_core/map.ts                 (proxy de mapas server-side)
```

> `server/_core/map.ts` é diferente de `client/src/components/Map.tsx` (Fase
> 6). O do server nunca foi usado por nada; o do client é o componente
> `MapView`.

Se alguma feature futura precisar de geração de imagem ou transcrição, a
OpenAI cobre as duas — não é motivo pra manter esse código parado.

**Confirme com uma busca antes de deletar cada um.** Se algum tiver ganhado
um call site durante a sprint, pare e reavalie.

---

## Tarefa 7.2 — Remover envs e config residual

### Server
Em `server/_core/env.ts` e `.env.example` / `.env`, remova:
- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`

Enquanto estiver ali, aproveite pra revisar as envs de OAuth do template que
não são mais usadas desde a migração pra Better Auth (`OAUTH_SERVER_URL`,
`VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, `VITE_APP_ID`). **Confirme com
busca** que nenhuma tem leitor no código antes de remover — algumas podem
estar em uso.

### Client
- **Nada a fazer.** `VITE_FRONTEND_FORGE_API_URL` e
  `VITE_FRONTEND_FORGE_API_KEY` nunca existiram no `.env`/`.env.example` —
  eram lidas só pelo `Map.tsx`, que a Fase 6 já deletou. Confirmado.

### Vite
`vite.config.ts` ainda tem resíduo do template:
- o plugin `vite-plugin-manus-runtime`,
- o `vitePluginManusDebugCollector` (escreve logs do browser em
  `.manus-logs/`),
- a lista `allowedHosts` com os domínios `*.manus.computer`,
  `*.manusvm.computer` etc.

**Avalie caso a caso, não remova em bloco.** O debug collector pode ainda ser
útil no dev local, mas os `allowedHosts` de domínios Manus e o plugin de
runtime só fazem sentido rodando dentro da plataforma. Se o deploy não é mais
na Manus, os dois primeiros podem sair (`yarn remove
vite-plugin-manus-runtime`).

---

## Tarefa 7.3 — Atualizar a documentação

Esta tarefa é parte do trabalho, não um extra.

1. **`AGENTS.md`**:
   - seção "O que é este projeto" — o stack não depende mais de Forge/Manus;
   - seção `docs/` — remova as entradas dos dois documentos que esta sprint
     substituiu e aponte pra esta pasta;
   - "Pontas soltas conhecidas" — remova o que foi resolvido, adicione o que
     ficou pra trás.

2. **`docs/webdev-template-guide.md`**: adicione um aviso no topo dizendo que
   a seção de Forge não vale mais pra este repo — mesmo padrão de aviso que o
   `AGENTS.md` já usa pra esse documento.

3. **Esta pasta**: marque as fases como concluídas e registre o que foi
   descoberto no caminho (principalmente o que divergiu do plano).

---

## O que NÃO fazer nesta fase

- Não delete nada sem antes buscar por referências.
- Não mexa em `docs/archive/` — é histórico, e o `AGENTS.md` diz
  explicitamente pra não usar como fonte de verdade nem manter atualizado.
- Não aproveite a limpeza pra "arrumar" os 17 erros de tipo pré-existentes.

---

## Verificação

1. Busca por `forge` / `FORGE` / `gemini` / `GEMINI` no repo inteiro, fora de
   `docs/archive/`: só devem sobrar menções históricas em documentação,
   nenhum código ativo.
2. `npx tsc --noEmit` — mesma contagem de erros de antes (17).
3. `yarn build` roda limpo.
4. `yarn dev` sobe e o app funciona: faça login, abra a Biblioteca de
   Arquivos, faça um upload, gere algo com IA.

**Commit sugerido:** `chore: remove resíduos do Forge/Manus do repo (Fase 7)`
