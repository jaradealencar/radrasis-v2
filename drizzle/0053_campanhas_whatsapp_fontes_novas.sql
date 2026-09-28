-- Sem mudança de estrutura: seed de 4 novas fontes automáticas do ERP + ajuste de descrição da fonte
-- "Inativos 6+ meses" — pedidas pelo usuário 28/09/2026 (ver server/services/fontesErpCampanhas.ts).
INSERT INTO "campanhas_whatsapp_fontes" ("tipo", "chave", "label", "descricao", "consulta_erp") VALUES
	('erp', 'erp_compraram_uma_vez', 'Compraram apenas 1 vez (todo o histórico)', 'Só fizeram uma compra na vida, seja há quanto tempo for — sem filtro de data.', 'compraram_uma_vez'),
	('erp', 'erp_novos_do_mes', 'Novos clientes do mês', 'Primeira compra da vida caiu dentro do mês corrente.', 'novos_do_mes'),
	('erp', 'erp_reativados_do_mes', 'Reativados do mês', 'Já tinham comprado antes, mas a compra deste mês veio depois de 6+ meses parados.', 'reativados_do_mes'),
	('erp', 'erp_reducao_volume', 'Redução de volume (3 meses)', 'Compraram menos nos últimos 3 meses do que nos 3 meses anteriores (queda de 30% ou mais).', 'reducao_volume')
ON CONFLICT ("chave") DO NOTHING;

-- Alinhado ao aumento do backfill de telefone de 13 para 24 meses (server/sync/telefone-historico.ts) —
-- a fonte agora tem um teto de 24 meses, não é mais "todo o histórico sem limite".
UPDATE "campanhas_whatsapp_fontes" SET "descricao" = 'Já compraram alguma vez, mas a última compra foi entre 6 e 24 meses atrás.'
WHERE "chave" = 'erp_inativos_6m';

-- Descrição ficou desatualizada desde a migration 0050 (removido o limite de 90 dias do código,
-- mas não da descrição seedada aqui) — corrigindo agora, sem mudança de comportamento.
UPDATE "campanhas_whatsapp_fontes" SET "descricao" = 'Orçamento com status que não é venda ganha, em todo o histórico (sem limite de data).'
WHERE "chave" = 'erp_orcaram_nao_compraram';
