CREATE TYPE "public"."modalidade_frete" AS ENUM('cif', 'fob');--> statement-breakpoint
ALTER TABLE "cotacoes_frete" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "cotacoes_frete" ALTER COLUMN "status" SET DEFAULT 'aberta'::text;--> statement-breakpoint
DROP TYPE "public"."cotacao_status";--> statement-breakpoint
CREATE TYPE "public"."cotacao_status" AS ENUM('aberta', 'cotando', 'selecao', 'cotada', 'enviada', 'cancelada');--> statement-breakpoint
ALTER TABLE "cotacoes_frete" ALTER COLUMN "status" SET DEFAULT 'aberta'::"public"."cotacao_status";--> statement-breakpoint
ALTER TABLE "cotacoes_frete" ALTER COLUMN "status" SET DATA TYPE "public"."cotacao_status" USING (CASE "status"
  WHEN 'fila' THEN 'aberta'
  WHEN 'em_cotacao' THEN 'cotando'
  WHEN 'pronto' THEN 'cotada'
  WHEN 'concluido' THEN 'enviada'
  WHEN 'cancelado' THEN 'cancelada'
  ELSE "status"
END)::"public"."cotacao_status";--> statement-breakpoint
ALTER TABLE "cotacoes_frete" ADD COLUMN "osNumero" varchar(32);--> statement-breakpoint
ALTER TABLE "cotacoes_frete" ADD COLUMN "modalidadeFrete" "modalidade_frete";--> statement-breakpoint
ALTER TABLE "cotacoes_frete" ADD COLUMN "quantidadeVolumes" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "cotacoes_frete" ADD COLUMN "volumesJson" text;--> statement-breakpoint
ALTER TABLE "cotacoes_frete" ADD COLUMN "fotosJson" text;--> statement-breakpoint
ALTER TABLE "cotacoes_frete" ADD COLUMN "empacotadores" varchar(512);--> statement-breakpoint
ALTER TABLE "cotacoes_frete" ADD COLUMN "osAprovacao" varchar(64);--> statement-breakpoint
ALTER TABLE "cotacoes_frete" ADD COLUMN "osEntrega" varchar(64);--> statement-breakpoint
ALTER TABLE "cotacoes_frete" ADD COLUMN "osVendedor" varchar(128);