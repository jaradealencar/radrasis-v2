ALTER TABLE `crm_scripts` ADD `conteudo_voz` mediumtext;--> statement-breakpoint
ALTER TABLE `crm_scripts` ADD `copia_count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `metas_comerciais` ADD `metaOsGeradas` int;--> statement-breakpoint
ALTER TABLE `metas_comerciais` ADD `metaClientesNovos` int;--> statement-breakpoint
ALTER TABLE `metas_comerciais` ADD `metaFaturamentoNovos` decimal(14,2);--> statement-breakpoint
ALTER TABLE `metas_comerciais` ADD `metaTaxaFaturamento` decimal(5,2);--> statement-breakpoint
ALTER TABLE `metas_comerciais` ADD `metaTicketMedioNovos` decimal(12,2);--> statement-breakpoint
ALTER TABLE `metas_comerciais` ADD `metaValorOrcado` decimal(14,2);