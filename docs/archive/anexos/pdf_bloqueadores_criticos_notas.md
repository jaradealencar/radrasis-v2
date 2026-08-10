# Notas do PDF `retrabalho-system-permanente.pdf`

Fonte: `/home/ubuntu/upload/retrabalho-system-permanente.pdf`
Data de leitura: 2026-08-08

## Título do documento
**INSTRUÇÕES DE CORREÇÃO — 3 BLOQUEADORES CRÍTICOS**

## Contexto geral
- Projeto: `retrabalho-system-permanente`
- Arquivos citados como afetados:
  - `client/src/pages/logistica/`
  - `server/routers/logistica.ts`
- Prioridade declarada: **CRÍTICA**
- Impacto: o sistema está impedido de criar novas solicitações de frete, interrompendo a operação logística.

## Bloqueador 1 — Erro SQL ao clicar em "Criar Solicitação"
### Sintoma
- Ao submeter o formulário de criação, ocorre erro de execução de query no insert de `cotacoes_frete`.

### Causas prováveis apontadas no PDF
1. Ausência de campos obrigatórios no `INSERT`.
2. Inconsistência de tipagem, especialmente no campo `peso`.
3. Má formatação e mistura indevida entre `cnpj` e nome do destinatário.

### Direção de correção sugerida
- Limpar e normalizar dados antes do insert.
- Separar corretamente `destinatario` de `cnpj`.
- Calcular `pesoTotal` a partir dos volumes quando necessário.
- Adicionar logs detalhados do erro e dos dados enviados.

## Bloqueador 2 — Perda de dados ao alternar abas/janelas no Chrome
### Diagnóstico
- O `Dialog` sofre desmontagem (`unmount`) quando o navegador gerencia recursos.
- Como o estado fica apenas em `useState`, os dados preenchidos são perdidos.

### Direção de correção sugerida
- Persistência contínua em `sessionStorage`.
- Restauração automática no mount / reabertura.
- Sincronização do estado do formulário com a chave sugerida no PDF:
  - `solicitacao-frete-dados`

## Bloqueador 3 — Latência excessiva no carregamento
### Causa raiz
- A query de listagem faz varredura ampla / sem filtro temporal, processando registros históricos desnecessários.

### Direção de correção sugerida
- Restringir consulta aos últimos 30 dias.
- Limitar retorno a 100 registros.
- Ordenar por `createdAt desc`.

## Resumo de prioridades do PDF
| ID | Problema | Severidade | Ação corretiva |
|---|---|---|---|
| 1 | Erro SQL Insert | CRÍTICA | Sanitização de strings e normalização de float |
| 2 | Perda de Estado | ALTA | Implementação de sessionStorage no Dialog |
| 3 | Lentidão de Página | ALTA | Filtro temporal de 30 dias e limite de registros |
| 4 | Mapeamento API | MÉDIA | Separação de CNPJ e Nome do Destinatário |

## Observação crítica do documento
> O Bloqueador 1 impede qualquer teste funcional e deve ser tratado como prioridade zero.
> Não considerar a tarefa concluída sem validar a separação estrita entre nome do destinatário e CNPJ.

## Implicações para a implementação atual
- Revisar o `create` em `server/routers/logistica.ts` para garantir que nenhum campo `undefined` vá para o banco.
- Garantir tipagem numérica consistente para dimensões, peso e valor.
- Revalidar o parsing de nome/CNPJ vindo da API.
- Confirmar que o Dialog permanece restaurável após troca de aba/janela.
- Confirmar que a listagem está realmente limitada temporalmente e por quantidade de registros.
- Validar tudo com teste funcional de criação real de solicitação.

