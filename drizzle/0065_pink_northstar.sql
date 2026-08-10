CREATE TABLE `observacoes_financeiras_mensais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`observacoes_manuais` text,
	`analise_ia` text,
	`contextos_especificos` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `observacoes_financeiras_mensais_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `custo_led_lancamentos` ADD `led_tipo_efetivo_id` int;--> statement-breakpoint
ALTER TABLE `error_library` ADD `tipoRegistro` enum('retrabalho','cnq') DEFAULT 'retrabalho' NOT NULL;--> statement-breakpoint
ALTER TABLE `retrabalhos` ADD `tipoRegistro` enum('retrabalho','cnq') DEFAULT 'retrabalho' NOT NULL;