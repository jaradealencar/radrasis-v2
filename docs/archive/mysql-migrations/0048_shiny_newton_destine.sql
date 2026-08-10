CREATE TABLE `crm_scripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`faixa` int NOT NULL,
	`ordem` int NOT NULL DEFAULT 0,
	`titulo` varchar(128),
	`conteudo` mediumtext NOT NULL,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crm_scripts_id` PRIMARY KEY(`id`)
);
