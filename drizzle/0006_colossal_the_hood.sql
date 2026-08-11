ALTER TABLE "local_users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "local_users" CASCADE;--> statement-breakpoint
DROP TABLE "users" CASCADE;--> statement-breakpoint
ALTER TABLE "auditoria_retrabalhos" ALTER COLUMN "usuarioId" SET DATA TYPE text USING "usuarioId"::text;--> statement-breakpoint
ALTER TABLE "cotacao_comentarios" ALTER COLUMN "autorId" SET DATA TYPE text USING "autorId"::text;--> statement-breakpoint
ALTER TABLE "cotacoes_frete" ALTER COLUMN "solicitanteId" SET DATA TYPE text USING "solicitanteId"::text;--> statement-breakpoint
ALTER TABLE "crm_atividade_log" ALTER COLUMN "local_user_id" SET DATA TYPE text USING "local_user_id"::text;--> statement-breakpoint
ALTER TABLE "crm_metas" ALTER COLUMN "usuarioVinculadoId" SET DATA TYPE text USING "usuarioVinculadoId"::text;--> statement-breakpoint
ALTER TABLE "empacotamento_pedido_usuarios" ALTER COLUMN "usuarioId" SET DATA TYPE text USING "usuarioId"::text;--> statement-breakpoint
ALTER TABLE "empacotamento_sessoes" ALTER COLUMN "operadorId" SET DATA TYPE text USING "operadorId"::text;--> statement-breakpoint
ALTER TABLE "knowledge_suggestions" ALTER COLUMN "autorId" SET DATA TYPE text USING "autorId"::text;--> statement-breakpoint
DROP TYPE "public"."oauth_role";