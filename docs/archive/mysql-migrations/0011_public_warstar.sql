CREATE TABLE `transportadora_avaliacoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transportadoraId` int NOT NULL,
	`estrelas` int NOT NULL,
	`comentario` text,
	`autor` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transportadora_avaliacoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transportadora_filiais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transportadoraId` int NOT NULL,
	`nome` varchar(128) NOT NULL,
	`endereco` text,
	`cidade` varchar(128),
	`estado` varchar(2),
	`telefone` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transportadora_filiais_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `transportadoras` ADD `realizaColeta` enum('sim','nao') DEFAULT 'nao';--> statement-breakpoint
ALTER TABLE `transportadoras` ADD `ultAtualizTabela` varchar(16);--> statement-breakpoint
ALTER TABLE `transportadoras` ADD `semTabelaNegociavel` enum('sim','nao') DEFAULT 'nao';--> statement-breakpoint
ALTER TABLE `transportadoras` ADD `whatsappContatoNegocial` varchar(32);--> statement-breakpoint
ALTER TABLE `transportadoras` ADD `portalUrl` varchar(256);--> statement-breakpoint
ALTER TABLE `transportadoras` ADD `portalUsuario` varchar(128);--> statement-breakpoint
ALTER TABLE `transportadoras` ADD `portalEmail` varchar(128);--> statement-breakpoint
ALTER TABLE `transportadoras` ADD `portalObservacao` text;