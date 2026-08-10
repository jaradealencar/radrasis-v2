CREATE TABLE `cargos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`titulo` varchar(256) NOT NULL,
	`missao` text NOT NULL,
	`subordinacao` varchar(256),
	`setor` varchar(128) NOT NULL,
	`regime_trabalho` varchar(128),
	`jornada` varchar(256),
	`limites` text,
	`condicoes_trabalho` text,
	`requisitos` text,
	`gestao_riscos` text,
	`ferramentas_recursos` text,
	`integracao_fluxo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cargos_id` PRIMARY KEY(`id`),
	CONSTRAINT `cargos_titulo_unique` UNIQUE(`titulo`)
);
--> statement-breakpoint
CREATE TABLE `kpis_cargo` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cargo_id` int NOT NULL,
	`titulo` varchar(256) NOT NULL,
	`descricao` text NOT NULL,
	`meta` varchar(256),
	`ordem` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kpis_cargo_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `responsabilidades_cargo` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cargo_id` int NOT NULL,
	`titulo` varchar(256) NOT NULL,
	`descricao` text NOT NULL,
	`ordem` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `responsabilidades_cargo_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `kpis_cargo` ADD CONSTRAINT `kpis_cargo_cargo_id_cargos_id_fk` FOREIGN KEY (`cargo_id`) REFERENCES `cargos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `responsabilidades_cargo` ADD CONSTRAINT `responsabilidades_cargo_cargo_id_cargos_id_fk` FOREIGN KEY (`cargo_id`) REFERENCES `cargos`(`id`) ON DELETE cascade ON UPDATE no action;