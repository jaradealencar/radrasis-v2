# Proteção dos ambientes, banco e publicação — ARQUIVADO

> **Obsoleto desde 22/11/2026.** Este documento preserva o histórico de uma proposta anterior de publicação com workflow manual, aprovação por environment e validações externas. Não siga os procedimentos abaixo nem trate os estados registrados como atuais.

## Fluxo vigente

Consulte `AGENTS.md` na raiz. A regra atual é: sincronizar a branch com `origin/main` antes de gerar qualquer migration Drizzle; validar `yarn run check` e `yarn build:vercel` localmente; aplicar a migration no banco de destino, se houver; integrar e commitar em `main`; executar `git push origin main` para disparar a publicação automática da Vercel.

Este arquivo não é fonte de verdade para configurações do GitHub, Vercel ou PostgreSQL. Essas configurações externas não foram alteradas por esta limpeza.
