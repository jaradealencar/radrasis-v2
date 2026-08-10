-- Substitui o "ON UPDATE CURRENT_TIMESTAMP" do MySQL (sem equivalente nativo no Postgres):
-- uma função de trigger por nome de coluna, reaplicada em cada tabela que tinha onUpdateNow().
--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_data_modificacao() RETURNS trigger AS $$
BEGIN
  NEW."dataModificacao" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_atualizado_em() RETURNS trigger AS $$
BEGIN
  NEW."atualizadoEm" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_data_ultima_atualizacao() RETURNS trigger AS $$
BEGIN
  NEW."dataUltimaAtualizacao" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER users_updatedat_trigger BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER retrabalhos_updatedat_trigger BEFORE UPDATE ON "retrabalhos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER faturamento_updatedat_trigger BEFORE UPDATE ON "faturamento" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER knowledge_base_updatedat_trigger BEFORE UPDATE ON "knowledge_base" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER suppliers_updatedat_trigger BEFORE UPDATE ON "suppliers" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER routines_updatedat_trigger BEFORE UPDATE ON "routines" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER regulations_updatedat_trigger BEFORE UPDATE ON "regulations" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER pops_updatedat_trigger BEFORE UPDATE ON "pops" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER price_table_sections_updatedat_trigger BEFORE UPDATE ON "price_table_sections" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER price_table_meta_datamodificacao_trigger BEFORE UPDATE ON "price_table_meta" FOR EACH ROW EXECUTE FUNCTION set_data_modificacao();
--> statement-breakpoint
CREATE TRIGGER local_users_updatedat_trigger BEFORE UPDATE ON "local_users" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER transportadoras_updatedat_trigger BEFORE UPDATE ON "transportadoras" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER cotacoes_frete_updatedat_trigger BEFORE UPDATE ON "cotacoes_frete" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER performance_mensal_updatedat_trigger BEFORE UPDATE ON "performance_mensal" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER cargos_funcoes_updatedat_trigger BEFORE UPDATE ON "cargos_funcoes" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER empacotamento_modelos_updatedat_trigger BEFORE UPDATE ON "empacotamento_modelos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER empacotamento_tabela_precos_updatedat_trigger BEFORE UPDATE ON "empacotamento_tabela_precos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER empacotamento_modelos_caixa_updatedat_trigger BEFORE UPDATE ON "empacotamento_modelos_caixa" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER empacotamento_pedidos_updatedat_trigger BEFORE UPDATE ON "empacotamento_pedidos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER empacotamento_insumos_updatedat_trigger BEFORE UPDATE ON "empacotamento_insumos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER empacotamento_consumo_caixa_updatedat_trigger BEFORE UPDATE ON "empacotamento_consumo_caixa" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER empacotamento_custo_funcionario_updatedat_trigger BEFORE UPDATE ON "empacotamento_custo_funcionario" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER empacotamento_insumos_letreiro_updatedat_trigger BEFORE UPDATE ON "empacotamento_insumos_letreiro" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER empacotamento_config_produtividade_updatedat_trigger BEFORE UPDATE ON "empacotamento_config_produtividade" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER empacotamento_sessoes_updatedat_trigger BEFORE UPDATE ON "empacotamento_sessoes" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER knowledge_suggestions_updatedat_trigger BEFORE UPDATE ON "knowledge_suggestions" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER acoes_corretivas_updatedat_trigger BEFORE UPDATE ON "acoes_corretivas" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER planos_acao_updatedat_trigger BEFORE UPDATE ON "planos_acao" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER acoes_5w2h_updatedat_trigger BEFORE UPDATE ON "acoes_5w2h" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER metas_retrabalho_updatedat_trigger BEFORE UPDATE ON "metas_retrabalho" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER biblioteca_arquivos_updatedat_trigger BEFORE UPDATE ON "biblioteca_arquivos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER abc_cache_updatedat_trigger BEFORE UPDATE ON "abc_cache" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER metas_operacionais_updatedat_trigger BEFORE UPDATE ON "metas_operacionais" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER financeiro_mensal_updatedat_trigger BEFORE UPDATE ON "financeiro_mensal" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER observacoes_financeiras_mensais_updatedat_trigger BEFORE UPDATE ON "observacoes_financeiras_mensais" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER desempenho_colaborador_mensal_updatedat_trigger BEFORE UPDATE ON "desempenho_colaborador_mensal" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER meta_produtos_updatedat_trigger BEFORE UPDATE ON "meta_produtos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER metas_comerciais_updatedat_trigger BEFORE UPDATE ON "metas_comerciais" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER crm_metas_updatedat_trigger BEFORE UPDATE ON "crm_metas" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER cliente_overrides_updatedat_trigger BEFORE UPDATE ON "cliente_overrides" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER custo_marketing_updatedat_trigger BEFORE UPDATE ON "custo_marketing" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER custos_fixos_updatedat_trigger BEFORE UPDATE ON "custos_fixos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER dividas_parcelamentos_updatedat_trigger BEFORE UPDATE ON "dividas_parcelamentos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER dre_mensal_updatedat_trigger BEFORE UPDATE ON "dre_mensal" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER crm_scripts_updatedat_trigger BEFORE UPDATE ON "crm_scripts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER led_tipos_updatedat_trigger BEFORE UPDATE ON "led_tipos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER custo_led_lancamentos_updatedat_trigger BEFORE UPDATE ON "custo_led_lancamentos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER crm_faixa_etiquetas_updatedat_trigger BEFORE UPDATE ON "crm_faixa_etiquetas" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER performance_auditada_updatedat_trigger BEFORE UPDATE ON "performance_auditada" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER cliente_novos_contato_updatedat_trigger BEFORE UPDATE ON "cliente_novos_contato" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER mubisys_api_cache_updatedat_trigger BEFORE UPDATE ON "mubisys_api_cache" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER financeiros_mensais_updatedat_trigger BEFORE UPDATE ON "financeiros_mensais" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER cargos_updatedat_trigger BEFORE UPDATE ON "cargos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER analise_curriculos_updatedat_trigger BEFORE UPDATE ON "analise_curriculos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER motivos_atraso_updatedat_trigger BEFORE UPDATE ON "motivos_atraso" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER producao_ordens_atualizadoem_trigger BEFORE UPDATE ON "producao_ordens" FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
--> statement-breakpoint
CREATE TRIGGER producao_setores_atualizadoem_trigger BEFORE UPDATE ON "producao_setores" FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
--> statement-breakpoint
CREATE TRIGGER producao_alertas_atualizadoem_trigger BEFORE UPDATE ON "producao_alertas" FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
--> statement-breakpoint
CREATE TRIGGER erp_os_cache_dataultimaatualizacao_trigger BEFORE UPDATE ON "erp_os_cache" FOR EACH ROW EXECUTE FUNCTION set_data_ultima_atualizacao();
--> statement-breakpoint
