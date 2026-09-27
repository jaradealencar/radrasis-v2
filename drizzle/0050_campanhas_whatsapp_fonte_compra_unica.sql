-- Sem mudança de estrutura: só o seed da 5ª fonte automática do ERP, pedida pelo usuário 27/09/2026
-- ("clientes que compraram uma única vez e não compraram mais, há uns 6 meses") — não coberta pelas 4
-- fontes seedadas em 0049 (ver server/services/fontesErpCampanhas.ts, resolverCompraramUmaVezESumiram).
INSERT INTO "campanhas_whatsapp_fontes" ("tipo", "chave", "label", "descricao", "consulta_erp") VALUES
	('erp', 'erp_compraram_uma_vez_sumiram', 'Compraram 1 vez e sumiram', 'A única compra que já fizeram foi há 6 meses ou mais e nunca recompraram.', 'compraram_uma_vez_sumiram')
ON CONFLICT ("chave") DO NOTHING;
