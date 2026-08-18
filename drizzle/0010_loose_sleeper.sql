ALTER TABLE "historico_os" ADD COLUMN "cidade" varchar(128);--> statement-breakpoint
ALTER TABLE "historico_os" ADD COLUMN "estado" varchar(2);--> statement-breakpoint
CREATE INDEX "historico_os_estado_idx" ON "historico_os" USING btree ("estado");