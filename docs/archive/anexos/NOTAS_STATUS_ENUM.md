# Nota técnica: valores de status em cotacoes_frete

Data: 2026-08-08

## Fato verificado no banco de produção

```sql
SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'cotacoes_frete' AND COLUMN_NAME = 'status';
-- resultado:
-- enum('aberta','cotando','cotada','enviada','cancelada')
```

O valor `'fila'` **NÃO existe** no enum. Tentativas de gravar `'fila'` retornam:
`Data truncated for column 'status' at row 1`.

## Convenção adotada

| Coluna no Kanban (UI)     | Valor real no banco |
|---------------------------|---------------------|
| Fila                      | `aberta`            |
| Em Cotação                | `cotando`           |
| Pronto — Aguardando Envio | `cotada`            |
| Concluído                 | `enviada`           |
| (cancelado)               | `cancelada`         |

O rótulo "Fila" é apenas texto de interface; o dado persistido é `aberta`.

## Causa raiz real do card não aparecer (resolvida)

Não era o status. Eram dois defeitos em série:

1. `server/db-helpers-select.ts` chamava `pool.execute()` sobre a Promise
   retornada por `getPool()` (função async), gerando
   `TypeError: pool.execute is not a function`.
   Corrigido usando o helper `selectQuery()` de `db-connection.ts`.

2. `client/src/pages/logistica/Solicitacoes.tsx` lia `paginatedData.cotacoes`,
   mas o endpoint retorna `{ data, pagination }`.
   Corrigido para `paginatedData.data` e `paginatedData.pagination.totalPages`.

## Se um dia quiserem literalmente 'fila' no banco

Seria necessária uma migração de enum, não um UPDATE:

```sql
ALTER TABLE cotacoes_frete
  MODIFY COLUMN status ENUM('fila','aberta','cotando','cotada','enviada','cancelada')
  NOT NULL DEFAULT 'fila';
UPDATE cotacoes_frete SET status = 'fila' WHERE status = 'aberta';
```

Isso quebraria compatibilidade com dados históricos e com o schema Drizzle,
portanto não foi feito.
