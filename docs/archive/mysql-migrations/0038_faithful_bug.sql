CREATE TABLE `metas_comerciais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendedor` varchar(256) NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`metaCotacoes` int,
	`metaVendas` int,
	`metaFaturamento` decimal(14,2),
	`metaConversao` decimal(5,2),
	`metaTicketMedio` decimal(12,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metas_comerciais_id` PRIMARY KEY(`id`)
);
