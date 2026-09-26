-- Converte os cliques acumulados ANTES da tabela de eventos (guia_fornecedores_cliques.cliques)
-- em eventos individuais, para o filtro por período enxergá-los. Só insere o que falta
-- (cliques - eventos já gravados), então é seguro mesmo se já houver eventos reais.
-- Não existe data por clique nos dados antigos: as datas são espalhadas de forma uniforme entre o
-- primeiro (createdAt) e o último (ultimoCliqueEm) clique de cada fornecedor — o total do período
-- fica exato, a distribuição por dia é aproximada. Estado/cidade ficam nulos aqui e são
-- resolvidos na leitura (getEstatisticasPeriodo / getRelatorioMensal).
INSERT INTO "guia_fornecedores_clique_eventos" ("empresaChave", "empresaNome", "createdAt")
SELECT
  c."empresaChave",
  c."empresaNome",
  c."createdAt" + (COALESCE(c."ultimoCliqueEm", c."createdAt") - c."createdAt")
    * ((g.i - 1)::float / GREATEST(faltam.qtd - 1, 1))
FROM "guia_fornecedores_cliques" c
LEFT JOIN (
  SELECT "empresaChave", COUNT(*)::int AS n FROM "guia_fornecedores_clique_eventos" GROUP BY "empresaChave"
) e ON e."empresaChave" = c."empresaChave"
CROSS JOIN LATERAL (SELECT (c."cliques" - COALESCE(e.n, 0)) AS qtd) faltam
CROSS JOIN LATERAL generate_series(1, faltam.qtd) AS g(i)
WHERE faltam.qtd > 0;
