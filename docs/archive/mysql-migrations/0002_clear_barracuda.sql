CREATE TABLE `faturamento` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mes` varchar(20) NOT NULL,
	`ano` int NOT NULL,
	`valorFaturado` decimal(14,2) NOT NULL,
	`totalPedidos` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faturamento_id` PRIMARY KEY(`id`),
	CONSTRAINT `faturamento_mes_unique` UNIQUE(`mes`)
);
