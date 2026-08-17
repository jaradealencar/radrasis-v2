CREATE INDEX "historico_orcamentos_mes_ano_idx" ON "historico_orcamentos" USING btree ("mes","ano");--> statement-breakpoint
CREATE INDEX "historico_os_mes_ano_idx" ON "historico_os" USING btree ("mes","ano");--> statement-breakpoint
CREATE INDEX "performance_auditada_mes_ano_idx" ON "performance_auditada" USING btree ("mes","ano");