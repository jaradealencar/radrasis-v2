CREATE TABLE `error_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`category` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`correction` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `error_library_id` PRIMARY KEY(`id`),
	CONSTRAINT `error_library_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `retrabalhos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`osRetrabalhada` varchar(32) NOT NULL,
	`osOriginal` varchar(64) NOT NULL,
	`data` timestamp NOT NULL,
	`setor` varchar(64) NOT NULL,
	`tipo` enum('INTERNO','EXTERNO') NOT NULL,
	`custo` decimal(10,2) NOT NULL DEFAULT '0',
	`frete` decimal(10,2) NOT NULL DEFAULT '0',
	`total` decimal(10,2) NOT NULL DEFAULT '0',
	`codigoErro` varchar(20),
	`responsavel` varchar(128),
	`descricao` text,
	`classe` enum('EVITÁVEL','INEVITÁVEL') NOT NULL,
	`mes` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `retrabalhos_id` PRIMARY KEY(`id`)
);
