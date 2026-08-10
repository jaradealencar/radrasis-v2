ALTER TABLE `cotacoes_frete` ADD `temRetrabalho` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `cotacoes_frete` ADD `tipoRetrabalho` varchar(64);--> statement-breakpoint
ALTER TABLE `cotacoes_frete` ADD `motivoRetrabalho` text;--> statement-breakpoint
ALTER TABLE `cotacoes_frete` ADD `retrabalhoVinculadoId` int;