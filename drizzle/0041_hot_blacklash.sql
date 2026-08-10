CREATE TABLE `crm_contatos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orcamentoId` varchar(32) NOT NULL,
	`vendedor` varchar(128) NOT NULL,
	`empresa` varchar(256) NOT NULL,
	`numeroContato` int NOT NULL,
	`canal` enum('whatsapp','telefone','email','visita','outro') NOT NULL DEFAULT 'whatsapp',
	`observacao` text,
	`contatadoEm` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crm_contatos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_metas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendedor` varchar(128) NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`metaValor` decimal(14,2) NOT NULL DEFAULT '0',
	`metaQtdOs` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crm_metas_id` PRIMARY KEY(`id`)
);
