DROP TABLE "feriados" CASCADE;--> statement-breakpoint
DROP TABLE "motivos_atraso" CASCADE;--> statement-breakpoint
DROP TABLE "producao_alertas" CASCADE;--> statement-breakpoint
DROP TABLE "producao_historico_alteracoes" CASCADE;--> statement-breakpoint
DROP TABLE "producao_ordens" CASCADE;--> statement-breakpoint
DROP TABLE "producao_ordens_new" CASCADE;--> statement-breakpoint
DROP TABLE "producao_setores" CASCADE;--> statement-breakpoint
DROP TYPE "public"."producao_alerta_tipo";--> statement-breakpoint
DROP TYPE "public"."producao_setor_status";--> statement-breakpoint
DROP TYPE "public"."producao_status_geral";--> statement-breakpoint
DELETE FROM "role_permissions" WHERE "pageKey" = 'pcp';