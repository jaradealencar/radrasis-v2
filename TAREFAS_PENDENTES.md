# Tarefas Pendentes - Sistema de Controle de Retrabalhos

## Status Atual
- Versão: manus-webdev://55db9432
- Campo "Quantidade de Volumes" adicionado ao formulário
- 65 testes passando

## Tarefas a Fazer (em ordem de prioridade)

### 1. ✅ Corrigir INSERT para salvar quantidadeVolumes
- Arquivo: `server/routers/logistica.ts` ou `server/db-helpers-select.ts`
- Ação: Adicionar `quantidadeVolumes` ao INSERT INTO cotacoes_frete
- Pega o valor de `form.volumes[0].quantidade` ou soma de todos os volumes

### 2. ✅ Exibir quantidadeVolumes no card do Kanban
- Arquivo: `client/src/pages/logistica/Solicitacoes.tsx`
- Ação: Adicionar campo `quantidadeVolumes` ao card
- Exibir junto com "Peso total: X kg"
- Formato: "Quantidade de volumes: X"

### 3. ✅ Converter "10 DIAS ÚTEIS" em data de calendário
- Arquivo: `client/src/pages/logistica/NovaCotacaoDialog.tsx` e `Solicitacoes.tsx`
- Usar helper: `calcularDataEntrega(osAprovacao, osEntrega)` de `shared/date-utils.ts`
- Aplicar no formulário (campo "Entrega prevista")
- Aplicar no card do Kanban (exibir data em vez de "10 DIAS ÚTEIS")

### 4. ❌ Corrigir erro FORBIDDEN ao criar usuário
- Arquivo: `server/routers/admin.ts` ou `server/_core/context.ts`
- Ação: Verificar permissões (role === 'admin' ou 'master')
- Adicionar middleware de autorização

### 5. ❌ Corrigir layout do modal de Novo Usuário
- Arquivo: `client/src/pages/admin/Usuarios.tsx`
- Problemas:
  - Campo "Função" mostrando texto descritivo (quebra layout)
  - Senha temporária mostrando pontos em vez de asteriscos
  - Inputs vazando do modal
- Ações:
  - Remover texto descritivo do Select (mostrar só o valor)
  - Usar type="password" para o campo de senha
  - Adicionar max-w-md e overflow-hidden ao modal

## Próximas Sessões
- Testar visualmente nos 5 estágios do Kanban
- Publicar versão final
