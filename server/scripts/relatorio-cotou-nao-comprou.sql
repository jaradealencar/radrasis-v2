-- Relatório: clientes que fizeram orçamento/cotação mas nunca converteram em OS válida.
--
-- Rode isto no SQL Editor do console da Neon, apontando para o banco de PRODUÇÃO
-- (o .env local do projeto aponta para um banco de teste — ver memória
-- "banco_local_diferente_de_producao"). Depois de rodar, use o botão de
-- exportar/baixar resultado como CSV do próprio SQL Editor da Neon.
--
-- Lógica replicada fielmente do código já usado em Performance Comercial /
-- Inteligência de Clientes / CRM (server/routers/performanceComercial.ts e
-- server/services/inteligenciaClientes.ts):
--   - Chave do cliente = nome da empresa normalizado (minúsculas, sem acentos,
--     sem pontuação) — não há CNPJ confiável em historico_os para cruzar.
--   - "Comprou" = tem pelo menos 1 linha em historico_os que passa em
--     isOsNormalDb (exclui Retrabalho*, Amostra, Cortesia, Cancelada e tipoOs
--     nulo).
--   - "Cotou" = qualquer linha em historico_orcamentos, independente do status
--     (o status de historico_orcamentos é pouco confiável: ~79% ficam parados
--     em "Em aberto" e a equipe raramente fecha como Reprovado/Cancelada).

-- Necessário para remover acentos na normalização do nome (padrão do Postgres,
-- normalmente permitido para o owner do banco na Neon). Se der "permission
-- denied", ver a alternativa com translate() comentada mais abaixo.
CREATE EXTENSION IF NOT EXISTS unaccent;

WITH orc AS (
  SELECT
    "id",
    "empresa",
    trim(regexp_replace(unaccent(lower(coalesce("empresa", ''))), '[^a-z0-9 ]', '', 'g')) AS empresa_key,
    "status",
    "total",
    "vendedor",
    "dataCadastro",
    CASE
      WHEN "dataCadastro" ~ '^\d{2}/\d{2}/\d{4}' THEN to_date(substring("dataCadastro" from 1 for 10), 'DD/MM/YYYY')
      WHEN "dataCadastro" ~ '^\d{4}-\d{2}-\d{2}' THEN to_date(substring("dataCadastro" from 1 for 10), 'YYYY-MM-DD')
      ELSE NULL
    END AS data_cadastro_parsed
  FROM "historico_orcamentos"
  WHERE coalesce("empresa", '') <> ''
),
os_validas AS (
  SELECT DISTINCT
    trim(regexp_replace(unaccent(lower(coalesce("empresa", ''))), '[^a-z0-9 ]', '', 'g')) AS empresa_key
  FROM "historico_os"
  WHERE "tipoOs" IS NOT NULL
    AND lower("tipoOs") NOT LIKE 'retrabalho%'
    AND lower("tipoOs") <> 'amostra'
    AND lower("tipoOs") <> 'cortesia'
    AND lower(coalesce("status", '')) <> 'cancelada'
    AND coalesce("empresa", '') <> ''
),
orc_filtrado AS (
  SELECT *
  FROM orc
  WHERE empresa_key <> ''
    AND empresa_key NOT IN (SELECT empresa_key FROM os_validas)
),
nome_exibicao AS (
  -- Usa o nome de exibição (não normalizado) tal como grafado no orçamento mais recente do cliente.
  SELECT DISTINCT ON (empresa_key)
    empresa_key,
    "empresa" AS empresa_exibicao
  FROM orc_filtrado
  ORDER BY empresa_key, data_cadastro_parsed DESC NULLS LAST, id DESC
)
SELECT
  n.empresa_exibicao AS "Cliente",
  COUNT(*) AS "Qtd. Orçamentos",
  SUM(o.total) AS "Valor Total Orçado",
  ROUND(AVG(o.total), 2) AS "Ticket Médio",
  MIN(o.data_cadastro_parsed) AS "Primeiro Orçamento",
  MAX(o.data_cadastro_parsed) AS "Orçamento Mais Recente",
  (CURRENT_DATE - MAX(o.data_cadastro_parsed))::int AS "Dias Sem Retorno",
  string_agg(DISTINCT o.status, ', ') AS "Status Encontrados",
  (array_agg(o.vendedor ORDER BY o.data_cadastro_parsed DESC NULLS LAST))[1] AS "Último Vendedor"
FROM orc_filtrado o
JOIN nome_exibicao n ON n.empresa_key = o.empresa_key
GROUP BY n.empresa_exibicao
ORDER BY "Valor Total Orçado" DESC NULLS LAST;

-- ─── Alternativa sem a extensão unaccent (se CREATE EXTENSION der permission denied) ───
-- Troque cada ocorrência de:
--   unaccent(lower(coalesce("empresa", '')))
-- por:
--   translate(lower(coalesce("empresa", '')), 'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
-- em orc e em os_validas (não cobre 100% dos acentos, mas cobre todos os comuns em português).
