-- Categoria local de matéria-prima para a mão de obra de solda (as "Produtividade Solda …" do MubiSys). Sem dados técnicos de chapa/bobina/perfil:
-- a classificação da produtividade (material, tipo de solda e tamanho) é por nome e independe da categoria. Idempotente: se a categoria já foi
-- criada pela tela, não mexe nela.
INSERT INTO "materia_prima_categorias" ("nome", "usa_dados_chapa", "usa_dados_bobina", "usa_dados_perfil") VALUES ('Produtividade para soldar', false, false, false)
ON CONFLICT ("nome") DO NOTHING;
