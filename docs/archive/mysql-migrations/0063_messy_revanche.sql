CREATE TABLE `pop_acessos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`popId` int NOT NULL,
	`popCode` varchar(32) NOT NULL,
	`popTitle` varchar(256) NOT NULL,
	`usuarioNome` varchar(128) NOT NULL,
	`usuarioEmail` varchar(256),
	`tipo` enum('visualizacao','download') NOT NULL DEFAULT 'visualizacao',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pop_acessos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `suppliers` ADD `createdByNome` varchar(128);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `updatedByNome` varchar(128);