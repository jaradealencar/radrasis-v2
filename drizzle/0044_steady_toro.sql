CREATE TABLE `cliente_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresa` varchar(256) NOT NULL,
	`empresaOriginal` varchar(256) NOT NULL,
	`status` enum('recorrente','novo') NOT NULL DEFAULT 'recorrente',
	`motivo` text,
	`criadoPor` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cliente_overrides_id` PRIMARY KEY(`id`),
	CONSTRAINT `cliente_overrides_empresa_unique` UNIQUE(`empresa`)
);
