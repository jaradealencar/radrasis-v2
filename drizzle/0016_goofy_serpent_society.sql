CREATE TABLE `empacotamento_checklist_itens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modeloCaixaId` int NOT NULL,
	`ordem` int NOT NULL DEFAULT 0,
	`descricao` varchar(256) NOT NULL,
	`obrigatorio` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `empacotamento_checklist_itens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empacotamento_modelos_caixa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(128) NOT NULL,
	`descricao` text,
	`larguraCm` decimal(8,2),
	`alturaCm` decimal(8,2),
	`profundidadeCm` decimal(8,2),
	`tempoLimiteMin` int,
	`valorComissao` decimal(8,2) NOT NULL DEFAULT '0',
	`ativo` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empacotamento_modelos_caixa_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empacotamento_pedido_checklist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedidoId` int NOT NULL,
	`itemId` int NOT NULL,
	`marcado` int NOT NULL DEFAULT 0,
	`marcadoPor` varchar(128),
	`marcadoEm` timestamp,
	CONSTRAINT `empacotamento_pedido_checklist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empacotamento_pedido_fotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedidoId` int NOT NULL,
	`storageKey` text NOT NULL,
	`url` text NOT NULL,
	`usuarioNome` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `empacotamento_pedido_fotos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empacotamento_pedido_usuarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedidoId` int NOT NULL,
	`usuarioId` int,
	`usuarioNome` varchar(128) NOT NULL,
	`iniciadoEm` timestamp,
	`finalizadoEm` timestamp,
	`tempoSegundos` int DEFAULT 0,
	`ativo` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `empacotamento_pedido_usuarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` MODIFY COLUMN `tipoCaixa` varchar(64) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `local_users` MODIFY COLUMN `role` enum('master','admin','vendas','logistica','producao','financeiro','empacotamento') NOT NULL DEFAULT 'vendas';--> statement-breakpoint
ALTER TABLE `role_permissions` MODIFY COLUMN `role` enum('master','admin','vendas','logistica','producao','financeiro','empacotamento') NOT NULL;--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` ADD `modeloCaixaId` int;--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` ADD `modeloCaixaNome` varchar(128);--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` ADD `kanbanStatus` enum('aguardando','embalando','patio','abandonado') DEFAULT 'aguardando' NOT NULL;--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` ADD `prazoEntrega` timestamp;--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` ADD `horarioMaximo` varchar(8);--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` DROP COLUMN `status`;--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` DROP COLUMN `operadorId`;--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` DROP COLUMN `operadorNome`;