-- Os 7 grupos de clientes de Campanhas WhatsApp (pedido do usuário 03/10/2026): Outbound, Primeira compra,
-- Pós-venda, Reativação de inativos, Orçaram e não compraram, Uma só compra e Ativos 5+ compras.
-- Só dado (categorias, 1 fonte do ERP e campanhas iniciais); nenhuma mudança de estrutura.

-- 1) Categorias: "Orçamento perdido" vira "Orçaram e não compraram" (a chave muda junto com as campanhas que a
--    usam); "Novo lead" sai da lista (arquivada: campanhas antigas dela continuam funcionando).
UPDATE "campanhas_whatsapp_categorias" SET "chave" = 'orcaram_nao_compraram', "label" = 'Orçaram e não compraram', "updated_at" = now()
WHERE "chave" = 'orcamento_perdido';--> statement-breakpoint
UPDATE "campanhas_whatsapp" SET "categoria" = 'orcaram_nao_compraram' WHERE "categoria" = 'orcamento_perdido';--> statement-breakpoint
UPDATE "campanhas_whatsapp_categorias" SET "ativo" = false, "ordem" = 99, "updated_at" = now() WHERE "chave" = 'novo_lead';--> statement-breakpoint

INSERT INTO "campanhas_whatsapp_categorias" ("chave", "label", "ordem") VALUES
	('primeira_compra', 'Primeira compra', 2),
	('uma_so_compra', 'Uma só compra', 6),
	('ativos_5_mais', 'Ativos (5+ compras)', 7)
ON CONFLICT ("chave") DO NOTHING;--> statement-breakpoint

UPDATE "campanhas_whatsapp_categorias" SET "label" = v.label, "ordem" = v.ordem, "ativo" = true, "updated_at" = now()
FROM (VALUES
	('outbound', 'Outbound', 1),
	('primeira_compra', 'Primeira compra', 2),
	('pos_venda', 'Pós-venda', 3),
	('reativacao_inativo', 'Reativação de inativos', 4),
	('orcaram_nao_compraram', 'Orçaram e não compraram', 5),
	('uma_so_compra', 'Uma só compra', 6),
	('ativos_5_mais', 'Ativos (5+ compras)', 7)
) AS v(chave, label, ordem)
WHERE "campanhas_whatsapp_categorias"."chave" = v.chave;--> statement-breakpoint

-- 2) Fonte nova do ERP (as outras já existem) e descrições alinhadas às regras novas.
INSERT INTO "campanhas_whatsapp_fontes" ("tipo", "chave", "label", "descricao", "consulta_erp") VALUES
	('erp', 'erp_ativos_5_mais_6m', 'Ativos com 5+ compras (6 meses)', 'Fizeram 5 compras ou mais nos últimos 6 meses; entram quando completam a 5ª compra.', 'ativos_5_mais_6m')
ON CONFLICT ("chave") DO NOTHING;--> statement-breakpoint
UPDATE "campanhas_whatsapp_fontes" SET "label" = 'Primeira compra',
	"descricao" = 'Primeira compra da vida dentro do período escolhido (sem período, últimos 60 dias). Quem já recomprou continua no grupo daquele período.'
WHERE "chave" = 'erp_primeira_compra';--> statement-breakpoint

-- 3) Campanhas iniciais dos grupos que ainda não têm nenhuma (cadência e quarentena de 15 dias são ponto de
--    partida editável). Outbound não tem fonte do ERP (usa listas externas) e não é criada aqui.
INSERT INTO "campanhas_whatsapp" ("nome", "categoria", "descricao", "tipo", "frequencia_dias", "quarentena_dias", "status")
SELECT v.nome, v.categoria, v.descricao, v.tipo::"campanha_whatsapp_tipo", v.frequencia, 15, 'ativa'::"campanha_whatsapp_status"
FROM (VALUES
	('Primeira compra', 'primeira_compra', 'Clientes que compraram pela primeira vez no período escolhido.', 'recorrente', 30),
	('Pós-venda', 'pos_venda', 'Clientes que compraram: contato só depois de 16 dias úteis da aprovação da venda.', 'gatilho_venda', 16),
	('Orçaram e não compraram', 'orcaram_nao_compraram', 'Clientes que fizeram uma cotação, mas não fecharam a compra.', 'recorrente', 30),
	('Uma só compra', 'uma_so_compra', 'Clientes que compraram uma única vez e não recompraram.', 'recorrente', 60),
	('Ativos 5+ compras', 'ativos_5_mais', 'Clientes ativos com 5 ou mais compras nos últimos 6 meses.', 'recorrente', 30)
) AS v(nome, categoria, descricao, tipo, frequencia)
WHERE NOT EXISTS (SELECT 1 FROM "campanhas_whatsapp" c WHERE c."categoria" = v.categoria);--> statement-breakpoint

-- 4) Vincula a fonte do ERP de cada campanha inicial (Pós-venda não usa fonte: lista vendas pendentes).
INSERT INTO "campanhas_whatsapp_campanha_fontes" ("campanha_id", "fonte_id")
SELECT c."id", f."id"
FROM (VALUES
	('Primeira compra', 'primeira_compra', 'erp_primeira_compra'),
	('Orçaram e não compraram', 'orcaram_nao_compraram', 'erp_orcaram_nao_compraram'),
	('Uma só compra', 'uma_so_compra', 'erp_compraram_uma_vez'),
	('Ativos 5+ compras', 'ativos_5_mais', 'erp_ativos_5_mais_6m')
) AS v(nome, categoria, fonte)
JOIN "campanhas_whatsapp" c ON c."nome" = v.nome AND c."categoria" = v.categoria
JOIN "campanhas_whatsapp_fontes" f ON f."chave" = v.fonte
WHERE NOT EXISTS (
	SELECT 1 FROM "campanhas_whatsapp_campanha_fontes" cf WHERE cf."campanha_id" = c."id" AND cf."fonte_id" = f."id"
);
