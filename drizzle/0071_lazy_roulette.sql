CREATE TABLE `analise_curriculos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cargoId` int NOT NULL,
	`curriculoFileName` varchar(256) NOT NULL,
	`curriculoUrl` text NOT NULL,
	`curriculoKey` text NOT NULL,
	`resultado` text,
	`status` enum('pendente','analisando','concluido','erro') NOT NULL DEFAULT 'pendente',
	`erroMensagem` text,
	`uploadedBy` varchar(128),
	`uploadedByName` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `analise_curriculos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `analise_curriculos` ADD CONSTRAINT `analise_curriculos_cargoId_cargos_funcoes_id_fk` FOREIGN KEY (`cargoId`) REFERENCES `cargos_funcoes`(`id`) ON DELETE cascade ON UPDATE no action;