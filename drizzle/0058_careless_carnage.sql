ALTER TABLE "proposta_itens" ADD COLUMN "grupoId" varchar(36);--> statement-breakpoint
ALTER TABLE "proposta_itens" ADD COLUMN "grupoDescricao" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "proposta_itens_propostaId_grupoId_idx" ON "proposta_itens" USING btree ("propostaId","grupoId");