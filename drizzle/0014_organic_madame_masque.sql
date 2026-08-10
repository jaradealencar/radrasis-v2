ALTER TABLE `performance_mensal` ADD `faturamentoRealizado` decimal(14,2);--> statement-breakpoint
ALTER TABLE `performance_mensal` ADD `metaFaturamento` decimal(14,2);--> statement-breakpoint
ALTER TABLE `performance_mensal` ADD `projetosEntregues` int;--> statement-breakpoint
ALTER TABLE `performance_mensal` ADD `projetosNoPrazo` int;--> statement-breakpoint
ALTER TABLE `performance_mensal` ADD `projetosForaPrazo` int;--> statement-breakpoint
ALTER TABLE `performance_mensal` ADD `metaEntregaNoPrazoPct` decimal(5,2);--> statement-breakpoint
ALTER TABLE `performance_mensal` ADD `metaRetrabalhoPct` decimal(5,2);