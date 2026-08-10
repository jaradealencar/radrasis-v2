CREATE TABLE `abc_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`tipo` enum('clientes','produtos') NOT NULL,
	`dados` text NOT NULL,
	`totalOs` int DEFAULT 0,
	`faturamentoTotal` decimal(14,2),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `abc_cache_id` PRIMARY KEY(`id`)
);
