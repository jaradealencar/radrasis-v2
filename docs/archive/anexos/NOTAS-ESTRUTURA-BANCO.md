# Notas de estrutura real do banco (validado com DESCRIBE)

Estas notas existem porque o schema do Drizzle divergiu do banco real. Sempre
confirmar com `DESCRIBE <tabela>` antes de escrever SQL para estas tabelas.

## erp_os_cache

Colunas reais relevantes: `numeroOs`, `razaoSocial`, `cnpj`, `email`, `cep`,
`municipio`, `estado`, `endereco`, `telefone`, `dataEmissao`,
`dataEntregaPrevista` (DATE), `status`, `valorTotal`, `descricao`,
`dataUltimaAtualizacao`, `sincronizadoEm`, `criadoEm`, `vendedor` (varchar 128),
`dataAprovacao` (varchar 64).

Armadilhas confirmadas:

- **Não existe `nomeVendedor`.** A coluna correta é `vendedor`. Usar o nome
  errado fazia o card exibir Aprovação/Entrega/Vendedor em branco.
- `dataAprovacao` é **varchar**, guarda o texto do ERP; `dataEntregaPrevista` é
  **DATE** e exige normalização de `dd/mm/aaaa` para `aaaa-mm-dd`.
- Havia um índice **único** em `cnpj` (`erp_os_cache_cnpj_idx`) que descartava
  OS de clientes repetidos com `ER_DUP_ENTRY`. Índice removido, pois um mesmo
  CNPJ legitimamente tem várias OS.

## sync_logs

Colunas reais: `id`, `dataExecucao`, `quantidadeOsImportadas`,
`status` ENUM('SUCESSO','ERRO','PENDENTE'), `mensagemErro`, `tempoExecucaoMs`,
`proximaExecucao`, `criadoEm`. São camelCase, não snake_case.

## cotacao_opcoes

Colunas reais: `cotacaoId`, `transportadoraId`, `transportadoraNome`,
`prazoEntrega` (varchar), `valorFrete` (decimal), `observacoes`,
`selecionada` (tinyint/enum). Não existem `modal`, `prazoDias` nem `tipoPrazo`.

## local_users

Colunas reais: `nome`, `setor`, `ativo` (TINYINT), `cargo`, `email`. O schema do
Drizzle declara `name`/`role`/`active`, por isso as consultas usam alias em SQL
direto via mysql2.

## Sincronização de OS

- Endpoint CRON: `POST /api/scheduled/sincronizarOS` (task `sync-os-diaria`,
  uid `FF2M9mBYjs26Cb3J9RXhXL`, diário às 02:00 UTC).
- Script manual: `npx tsx scripts/run-sync-os.ts`.
- Última execução manual validada: 155 OS no cache, 154 com aprovação e 154 com
  vendedor (entrega prevista só existe em parte das OS no próprio ERP).
