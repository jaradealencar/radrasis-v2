-- Relatório: OS de letreiro em INOX nos últimos 3 meses — contagem e faixas
-- de margem de contribuição.
--
-- Rode isto no SQL Editor do console da Neon, apontando para o banco de
-- PRODUÇÃO (o .env local do projeto aponta para um banco de teste — ver
-- AGENTS.md/docs/protecao-ambientes-banco-publicacao.md). Depois de rodar,
-- use o botão de exportar/baixar resultado como CSV do próprio SQL Editor.
--
-- ─── Como o dado é identificado (leia antes de confiar no número) ──────────
--
-- 1. "Inox" é detectado por TEXTO no nome do trabalho (historico_os.trabalho,
--    que vem de nome_trabalho na API MubiSys — é o título digitado pelo
--    vendedor, ex. "Letreiro Caixa Inox", "Fachada Inox Escovado"). NÃO existe
--    hoje um campo estruturado de "material" na OS/histórico do MubiSys (isso
--    só existe para o CPQ Letreiros Express, via matéria-prima/composição —
--    ver AGENTS.md seção "CPQ renderização 3D"/"Cadastro de matérias-primas").
--    Se o vendedor não escreveu "inox" no título do trabalho, essa OS NÃO
--    entra na contagem, mesmo que o letreiro seja de inox. Isso provavelmente
--    SUBESTIMA o total real.
-- 2. "Últimos 3 meses" = mês de aprovação atual + 2 meses anteriores
--    (historico_os.mes/ano vêm do sync filtrado por filtrodata=APROVACAO,
--    ver server/sync/scheduled-sync-historico.ts). Não é uma janela rolante
--    de 90 dias por data exata, é mês-calendário.
-- 3. OS "normais" = mesma regra usada em todo o app (isOsNormalDb em
--    server/routers/performanceComercial.ts): exclui tipoOs iniciado por
--    "Retrabalho", "Amostra", "Cortesia", status "Cancelada" e tipoOs nulo
--    (OS nulo = importação antiga sem custo, não dá para calcular margem).
-- 4. "Margem de contribuição" = historico_os.contribuicaoPct. Importante:
--    o comentário de topo de scheduled-sync-historico.ts documenta que a API
--    MubiSys não expõe uma "contribuição" distinta do resultado líquido —
--    contribuicaoPct hoje é uma CÓPIA de resultadoPct (= valor_margem /
--    valor_total da OS, em %). Ou seja, este número é a margem líquida da
--    OS como o MubiSys a calcula (valor - custo, sobre valor), não uma
--    margem de contribuição "de verdade" com mão de obra/custo fixo
--    separados de forma diferente do resultado.

-- ─── Passo 0: confira se os 3 meses já estão sincronizados localmente ───────
-- Se um desses 3 meses aparecer com contagem muito baixa/zero, sincronize-o
-- antes de confiar no resultado: POST /api/scheduled/sincronizarHistorico
-- com query params ?mes=N&ano=AAAA (ver docs/cron-qstash.md, "Como disparar
-- manualmente"). O cron diário roda com mesesAtras=1 (mês atual + 1 anterior),
-- então o 3º mês (2 atrás) só está lá se já tiver sido sincronizado antes.
SELECT ano, mes, COUNT(*) AS total_os_no_mes
FROM "historico_os"
WHERE (ano * 100 + mes) BETWEEN
    (EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '2 months')::int * 100 + EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '2 months')::int)
  AND (EXTRACT(YEAR FROM CURRENT_DATE)::int * 100 + EXTRACT(MONTH FROM CURRENT_DATE)::int)
GROUP BY ano, mes
ORDER BY ano, mes;

-- ─── Passo 1: base filtrada (OS normais, inox, últimos 3 meses-calendário) ──
WITH limites AS (
  SELECT
    (EXTRACT(YEAR FROM CURRENT_DATE)::int * 100 + EXTRACT(MONTH FROM CURRENT_DATE)::int) AS periodo_fim,
    (EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '2 months')::int * 100 + EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '2 months')::int) AS periodo_inicio
),
base AS (
  SELECT
    h."osNumero", h."trabalho", h."vendedor", h."empresa", h."dataAprovacao",
    h.mes, h.ano,
    COALESCE(h."valorOs", '0')::numeric AS valor_os,
    COALESCE(h."contribuicaoReais", '0')::numeric AS contribuicao_reais,
    COALESCE(h."contribuicaoPct", '0')::numeric AS contribuicao_pct
  FROM "historico_os" h, limites l
  WHERE (h.ano * 100 + h.mes) BETWEEN l.periodo_inicio AND l.periodo_fim
    AND h."tipoOs" IS NOT NULL
    AND lower(h."tipoOs") NOT LIKE 'retrabalho%'
    AND lower(h."tipoOs") <> 'amostra'
    AND lower(h."tipoOs") <> 'cortesia'
    AND lower(COALESCE(h."status", '')) <> 'cancelada'
    AND h."trabalho" ILIKE '%inox%'
),
-- Faixas de 5 pontos percentuais (ex.: "35 a 40%" é a faixa que contém 38%).
-- floor() arredonda pra baixo mesmo com margem negativa (ex.: -3% cai em "-5 a 0%").
faixas AS (
  SELECT
    *,
    (floor(contribuicao_pct / 5) * 5)::int AS faixa_inicio
  FROM base
)
SELECT
  faixa_inicio || '% a ' || (faixa_inicio + 5) || '%' AS "Faixa de margem de contribuição",
  COUNT(*) AS "Qtd. OS",
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS "% do total",
  ROUND(AVG(contribuicao_pct), 1) AS "Margem média na faixa (%)",
  SUM(valor_os) AS "Valor OS somado (R$)",
  SUM(contribuicao_reais) AS "Contribuição somada (R$)"
FROM faixas
GROUP BY faixa_inicio
ORDER BY faixa_inicio;

-- ─── Passo 2: resumo geral (confira contra a soma das faixas acima) ────────
WITH limites AS (
  SELECT
    (EXTRACT(YEAR FROM CURRENT_DATE)::int * 100 + EXTRACT(MONTH FROM CURRENT_DATE)::int) AS periodo_fim,
    (EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '2 months')::int * 100 + EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '2 months')::int) AS periodo_inicio
),
base AS (
  SELECT
    COALESCE(h."valorOs", '0')::numeric AS valor_os,
    COALESCE(h."contribuicaoReais", '0')::numeric AS contribuicao_reais,
    COALESCE(h."contribuicaoPct", '0')::numeric AS contribuicao_pct
  FROM "historico_os" h, limites l
  WHERE (h.ano * 100 + h.mes) BETWEEN l.periodo_inicio AND l.periodo_fim
    AND h."tipoOs" IS NOT NULL
    AND lower(h."tipoOs") NOT LIKE 'retrabalho%'
    AND lower(h."tipoOs") <> 'amostra'
    AND lower(h."tipoOs") <> 'cortesia'
    AND lower(COALESCE(h."status", '')) <> 'cancelada'
    AND h."trabalho" ILIKE '%inox%'
)
SELECT
  COUNT(*) AS "Total de OS de letreiro inox (3 meses)",
  SUM(valor_os) AS "Valor OS somado (R$)",
  ROUND(AVG(contribuicao_pct), 1) AS "Margem de contribuição média (%)",
  ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY contribuicao_pct))::numeric, 1) AS "Margem de contribuição mediana (%)",
  ROUND(MIN(contribuicao_pct), 1) AS "Margem mínima (%)",
  ROUND(MAX(contribuicao_pct), 1) AS "Margem máxima (%)"
FROM base;

-- ─── Passo 3 (opcional): lista linha a linha, pra auditar os casos de borda ─
-- Descomente para ver cada OS individualmente (número, trabalho, valor, margem).
-- Útil pra confirmar que o filtro "trabalho ILIKE '%inox%'" não está pegando
-- falso-positivo (ex.: um trabalho cujo nome do CLIENTE contém "inox" por
-- acaso) nem perdendo caso em que "inox" foi digitado com erro de grafia.
--
-- WITH limites AS (
--   SELECT
--     (EXTRACT(YEAR FROM CURRENT_DATE)::int * 100 + EXTRACT(MONTH FROM CURRENT_DATE)::int) AS periodo_fim,
--     (EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '2 months')::int * 100 + EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '2 months')::int) AS periodo_inicio
-- )
-- SELECT h."osNumero", h."empresa", h."trabalho", h."vendedor", h."dataAprovacao",
--        h."valorOs", h."contribuicaoReais", h."contribuicaoPct"
-- FROM "historico_os" h, limites l
-- WHERE (h.ano * 100 + h.mes) BETWEEN l.periodo_inicio AND l.periodo_fim
--   AND h."tipoOs" IS NOT NULL
--   AND lower(h."tipoOs") NOT LIKE 'retrabalho%'
--   AND lower(h."tipoOs") <> 'amostra'
--   AND lower(h."tipoOs") <> 'cortesia'
--   AND lower(COALESCE(h."status", '')) <> 'cancelada'
--   AND h."trabalho" ILIKE '%inox%'
-- ORDER BY h."dataAprovacao" DESC;
