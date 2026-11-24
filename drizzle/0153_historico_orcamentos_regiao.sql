ALTER TABLE "historico_orcamentos" ADD COLUMN "cidade" varchar(128);--> statement-breakpoint
ALTER TABLE "historico_orcamentos" ADD COLUMN "estado" varchar(2);--> statement-breakpoint
CREATE INDEX "historico_orcamentos_estado_idx" ON "historico_orcamentos" USING btree ("estado");