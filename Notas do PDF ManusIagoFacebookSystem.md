# Notas do PDF ManusIagoFacebookSystem

Fonte: `/home/ubuntu/upload/ManusIagoFacebookSystem.pdf`
Data da análise: 2026-08-08

## Tese principal do documento

O PDF afirma que **não é necessário reconstruir a arquitetura** com Event Sourcing, CQRS, Kafka ou Redis para resolver o problema atual do Kanban. Segundo o documento, o problema é simples e localizado:

1. O **INSERT** já foi corrigido com `mysql2` direto.
2. O **SELECT do Kanban** ainda estaria usando Drizzle ORM e por isso retornando 0 registros ou gerando SQL incorreto.
3. Há também um possível desencontro de status entre o valor gravado no banco e o valor filtrado pelo Kanban.

## Causa raiz proposta pelo PDF

O documento destaca dois problemas concretos:

1. **Status errado no INSERT**
   - registros podem estar sendo salvos com `status='aberta'` enquanto o Kanban filtraria `status='fila'`.

2. **SELECT do Kanban com ORM inadequado**
   - o Drizzle estaria tentando usar colunas que não existem no banco real.
   - a recomendação é usar **mysql2 no SELECT também**, exatamente como foi feito no INSERT.

## Correções propostas no PDF

### Correção 1: verificar status real dos registros
Executar:

```sql
SELECT id, destinatarioNome, status
FROM cotacoes_frete
ORDER BY id DESC
LIMIT 10;
```

Se os registros estiverem com `status='aberta'`, o PDF oferece duas opções:

- mudar o INSERT para gravar `status='fila'`; ou
- mudar o Kanban para filtrar `status='aberta'`.

O PDF recomenda a **Opção A**, assumindo que a coluna "Fila" deveria usar `fila`.

### Correção 2: usar mysql2 direto no SELECT do Kanban
Substituir a query de listagem do Kanban por SQL puro via pool `mysql2`, com `SELECT` explícito na tabela `cotacoes_frete`, `ORDER BY createdAt DESC` e `LIMIT 100`.

Os campos sugeridos pelo PDF para o SELECT são:

- `id`
- `destinatarioNome`
- `destinatarioCnpj`
- `cepDestino`
- `municipio`
- `estado`
- `dimensoesLargura`
- `dimensoesAltura`
- `dimensoesComprimento`
- `pesoKg`
- `valorNf`
- `observacoes`
- `solicitanteNome`
- `tipoMaterial`
- `status`
- `temRetrabalho`
- `createdAt`

Observação importante: o PDF assume filtro `WHERE status = 'fila'`.

### Correção 3: garantir status correto no INSERT
O documento orienta revisar o INSERT para confirmar que ele grava `status='fila'`.

### Correção 4: corrigir registros antigos
Se houver registros antigos com `status='aberta'`, o PDF sugere:

```sql
UPDATE cotacoes_frete
SET status = 'fila'
WHERE status = 'aberta';
```

### Correção 5: simplificar `onSuccess`
No frontend, o PDF recomenda manter o `onSuccess` do `create.mutate` minimalista:

- `toast.success(...)`
- `setOpen(false)`
- `window.location.reload()`

sem `invalidate()` nem `refetch()`.

## Resumo operacional sugerido pelo PDF

1. Verificar status atual dos registros.
2. Se necessário, converter `aberta` para `fila`.
3. Garantir que o INSERT grave `fila`.
4. Substituir o SELECT do Kanban por mysql2 direto.
5. Testar criação de solicitação e confirmar que o card aparece após F5.

## Alertas importantes da análise

Ao comparar o PDF com o estado real já observado no projeto, há um ponto crítico:

- Em uma checagem anterior do banco real, a coluna `status` apareceu como:
  `enum('aberta','cotando','cotada','enviada','cancelada')`

Isso significa que a recomendação do PDF de usar `fila` pode estar **incompatível com o banco real**. Portanto, a parte mais segura e reaproveitável do documento é:

1. **usar mysql2 também no SELECT**;
2. **alinhar o filtro do Kanban ao enum real do banco**, em vez de presumir `fila`.

## Conclusão prática extraída do PDF

A principal recomendação útil do documento é:

> **Trocar o SELECT do Kanban para SQL puro com mysql2, assim como já foi feito no INSERT, e alinhar o filtro de status ao valor real existente no banco.**

Essa é a orientação mais consistente do PDF para resolver rapidamente o problema de o card não aparecer no Kanban.

## Próximo passo técnico sugerido

Implementar um helper de leitura com mysql2 para o Kanban, retornando apenas colunas reais do banco, e revisar o mapeamento de status no frontend para usar os valores reais do enum da tabela `cotacoes_frete`.

## Trechos-chave do PDF

- "Solução definitiva para o Kanban — use mysql2 no SELECT também"
- "Não reconstrua a arquitetura"
- "O SELECT do Kanban retorna 0 registros porque o Drizzle ORM está gerando SQL com colunas que não existem no banco"
- "A solução é a mesma que funcionou para o INSERT: usar mysql2 direto"

EOF
