ALTER TABLE "compras_cotacao_itens" ADD COLUMN "icms_aliquota" numeric(8, 4);--> statement-breakpoint
ALTER TABLE "compras_cotacao_itens" ADD COLUMN "icms_valor" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "compras_cotacao_itens" ADD COLUMN "ipi_aliquota" numeric(8, 4);--> statement-breakpoint
ALTER TABLE "compras_cotacao_itens" ADD COLUMN "ipi_valor" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "compras_cotacao_itens" ADD COLUMN "total_fornecedor" numeric(18, 2);