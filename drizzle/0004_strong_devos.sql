ALTER TABLE "transportadoras" ADD COLUMN "origem" varchar(40) DEFAULT 'Manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "transportadoras" ADD COLUMN "bairro" varchar(160);--> statement-breakpoint
ALTER TABLE "transportadoras" ADD COLUMN "cep" varchar(20);--> statement-breakpoint
ALTER TABLE "transportadoras" ADD COLUMN "cidade" varchar(160);--> statement-breakpoint
ALTER TABLE "transportadoras" ADD COLUMN "uf" varchar(2);--> statement-breakpoint
ALTER TABLE "transportadoras" ADD COLUMN "cnpj" varchar(24);