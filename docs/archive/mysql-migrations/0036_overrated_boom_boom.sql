CREATE TABLE `acoes_5w2h` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planoId` int NOT NULL,
	`what` text NOT NULL,
	`why` text,
	`where` varchar(128),
	`who` varchar(128),
	`when` varchar(64),
	`how` text,
	`howMuch` varchar(64),
	`status` enum('pendente','em_andamento','concluido') DEFAULT 'pendente',
	`causaId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `acoes_5w2h_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ishikawa_causas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planoId` int NOT NULL,
	`categoria` enum('maquina','mao_de_obra','material','metodo','medida','meio_ambiente') NOT NULL,
	`causa` text NOT NULL,
	`prioridade` enum('alta','media','baixa') DEFAULT 'media',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ishikawa_causas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `faturamento` DROP INDEX `faturamento_mes_unique`;--> statement-breakpoint
ALTER TABLE `biblioteca_arquivos` ADD `visualizacoes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `metas_operacionais` ADD `metaLucratividadeAnual` decimal(16,2);--> statement-breakpoint
ALTER TABLE `metas_operacionais` ADD `numSoldadores` int;--> statement-breakpoint
ALTER TABLE `metas_operacionais` ADD `metaMediaSoldaPorSoldador` decimal(10,2);--> statement-breakpoint
ALTER TABLE `metas_operacionais` ADD `metaOsGeradasMes` int;--> statement-breakpoint
ALTER TABLE `performance_mensal` ADD `totalPedidos` int;--> statement-breakpoint
ALTER TABLE `planos_acao` ADD `errosPrevenidos` text;--> statement-breakpoint
ALTER TABLE `planos_acao` ADD `errosResolvidos` text;--> statement-breakpoint
ALTER TABLE `planos_acao` ADD `metodologia` varchar(32) DEFAULT 'ambos';--> statement-breakpoint
ALTER TABLE `planos_acao` ADD `codigosErro` text;--> statement-breakpoint
ALTER TABLE `faturamento` ADD CONSTRAINT `faturamento_mes_ano_unique` UNIQUE(`mes`,`ano`);--> statement-breakpoint
ALTER TABLE `biblioteca_arquivos` DROP COLUMN `downloads`;