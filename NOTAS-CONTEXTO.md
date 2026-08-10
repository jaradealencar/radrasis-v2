# Notas de contexto — Sistema de Retrabalhos (Letreiros Express)

## Fontes externas
- Sistema original publicado: https://retrabctrl-7bbgkjkd.manus.space/
  - Página de transportadoras do original tinha 41 transportadoras cadastradas.
  - Coberturas notáveis: Atual Cargas 6268 cidades, Carvalima 5571, Correios 5571, Gollog 3647, Viopex 765, Andorinha 522, Eucatur 568, Penha 442, União Express 400, Unesul 341, Gontijo 342.
  - Nacionais (cobertura nacional): Braspress, J&T Express, Correios, Jadlog, Azul Cargo, LATAM Cargo, Gollog, Carvalima.
- CSV enviado pelo usuário: `scripts/data/transportadoras_frenet.csv`
  - 794 linhas de dados, colunas: `Nome,Status,Tipo`
  - Status: 791 "Disponível", 3 "Ativo"
  - Tipo: 683 "Por tabela", 107 "Simplificada", 4 "Gestão de etiquetas"
  - Contém "Loggi" (o usuário pediu para EXCLUIR essa transportadora do cadastro)

## Estruturas reais do banco (divergem do schema Drizzle)

### local_users
Colunas reais: `id, nome, setor, ativo (tinyint), createdAt` — NÃO tem `name`, `role`, `active`, `passwordHash`.

### cotacoes_frete
- `status` é ENUM real (5 estágios): `('aberta','cotando','selecao','cotada','enviada','cancelada')`
- Mapeamento no Kanban: aberta=Fila, cotando=Em Cotação, selecao=Seleção do Frete, cotada=Pronto — Aguardando Envio, enviada=Despachado
- Colunas adicionadas ao longo do projeto: `osNumero VARCHAR(32)`, `quantidadeVolumes INT`, `volumesJson TEXT`, `empacotadores VARCHAR(512)`
- Também adicionadas: `modalidadeFrete ENUM('cif','fob') NULL`, `fotosJson TEXT NULL` (array JSON de URLs `/manus-storage/...`)
- Dimensões individuais (largura/altura/comprimento) ficam dentro de `volumesJson`; as colunas soltas costumam ser NULL.

## Estado do cadastro de transportadoras
- Após importar o CSV da Frenet, o cadastro tinha 803 transportadoras. Após o enriquecimento
  com o JSON `transportadoras_radrasys.json` (58 registros), o cadastro tem **808 transportadoras**
  (5 criadas, 52 enriquecidas, 176 cidades atendidas inseridas, 53 com telefone).
- "Loggi" foi excluída conforme pedido do usuário e é ignorada na importação (script `scripts/import-frenet.mjs`).
- A deduplicação usa nome normalizado: sem acentos, minúsculo, sem `[...]`, sem "via Frenet"/"via Melhor Envio" e sem palavras genéricas (transportes, logística, express, cargas).
- Colunas adicionadas para gestão de completude: `origem VARCHAR(40) DEFAULT 'Manual'`,
  `bairro`, `cep`, `cidade`, `uf`, `cnpj`.
- Scripts: `scripts/import-frenet.mjs` (CSV) e `scripts/enriquecer-transportadoras.mjs` (JSON,
  só preenche campos vazios via COALESCE/NULLIF, nunca sobrescreve dado existente).

### Guia recebido do usuário (GuiadeIntegração—MódulodeTransportadorasnoRadrasys.md)
- JSON com 58 transportadoras: 7 ativas, 51 inativas; 55 origem Frenet, 3 Manual (KM, Expresso Queiroz MS, APT Logística).
- Modais: Rodoviário 45, Aéreo 5, Ônibus 8. 176 cidades atendidas.
- 9 campos de completude sugeridos: nome, site, email, telefone, endereco, bairro, cep, cnpj, contatoResponsavel.
- Requisitos de UI: tabela densa, badge [Frenet], completude por linha, painel de dados incompletos,
  filtros por modal/status, toggle de status na listagem, edição com cidades agrupadas por UF.

### cotacao_opcoes
Colunas reais: `id, cotacaoId, transportadoraId, transportadoraNome, prazoEntrega (varchar), valorFrete (decimal), observacoes (text), selecionada (tinyint 0/1), createdAt`
NÃO existem: `modal`, `prazoDias`, `tipoPrazo`. O prazo é gravado como texto ("3 dias úteis").

### transportadoras
- `coberturaTotal INT DEFAULT 0` → 1 = alcance nacional (atende qualquer cidade/CEP)
- `ativa ENUM('sim','nao')`, `modais` guarda JSON de array

### transportadora_cidades
Colunas: `id, transportadoraId, cidade, estado, telefone, observacao, endereco, responsavel, sede, createdAt`

## Regra de ouro do projeto
O schema Drizzle (`drizzle/schema.ts`) NÃO reflete fielmente o banco real. Para qualquer operação em
`cotacoes_frete`, `cotacao_opcoes` e `local_users`, usar mysql2 direto via
`server/db-connection.ts` (`selectQuery`, `mutationQuery`) e os helpers em
`server/db-helpers.ts` / `server/db-helpers-select.ts`.

## Credenciais MubiSys
- PublicKey: `cHVibGljLTM1Mzc3OC1rZXk`
- Token JWT em env (`MUBISYS_ACCESS_TOKEN`)
- Documentação: https://api.mubisys.com/api/documentation
- Cache local de OS: tabela `erp_os_cache` (sincronização diária, últimos 30 dias)

## OS 6956 (PDF enviado pelo usuário) — campos exigidos no card

| Campo | Valor no PDF |
|---|---|
| Aprovação | 07/08/2026 às 15:45 |
| Entrega | 21/08/2026 às 15:30 |
| Vendedor | Letícia Carozzo |
| Cliente | BOX CREATIVE |
| CNPJ | 13.961.221/0001-78 |
| Endereço | RUA GUASSU, 90 - LOJA 01 - NOVO ELDORADO |
| CEP | 32341-150 |
| Cidade/UF | CONTAGEM - MG |
| Ref. | 27726 BLM |

Requisito: Aprovação, Entrega e Vendedor devem aparecer no card de Solicitações de
Frete em TODOS os 5 estágios, junto de destinatário, CEP, cidade, quantidade de
volumes, peso e dimensões.

Colunas novas em `cotacoes_frete`: `osAprovacao VARCHAR(64)`, `osEntrega VARCHAR(64)`,
`osVendedor VARCHAR(128)` — preenchidas na busca da OS (cache `erp_os_cache` ou API MubiSys).
