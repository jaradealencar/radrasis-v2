CREATE TABLE `cliente_novos_contato` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresa` varchar(256) NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`contatado` boolean NOT NULL DEFAULT false,
	`data_contato` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cliente_novos_contato_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `performance_auditada` ADD `lista_clientes_novos` mediumtext;