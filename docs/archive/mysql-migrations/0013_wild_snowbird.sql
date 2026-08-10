CREATE TABLE `cargos_funcoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`titulo` varchar(128) NOT NULL,
	`missao` text,
	`responsabilidades` text,
	`kpis` text,
	`ferramentas` text,
	`integracao` text,
	`riscos` text,
	`requisitos` text,
	`condicoes` text,
	`createdBy` varchar(128),
	`updatedBy` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cargos_funcoes_id` PRIMARY KEY(`id`)
);
