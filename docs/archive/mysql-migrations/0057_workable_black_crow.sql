CREATE TABLE `crm_faixa_etiquetas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`faixa` int NOT NULL,
	`label` varchar(128) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crm_faixa_etiquetas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custo_led_lancamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`os` varchar(64) NOT NULL,
	`led_tipo_id` int NOT NULL,
	`qtd_prevista` decimal(10,4) NOT NULL DEFAULT '0',
	`qtd_efetiva` decimal(10,4),
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`observacao` text,
	`vendedor` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custo_led_lancamentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `led_tipos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(128) NOT NULL,
	`descricao` text,
	`custo_unitario` decimal(10,4) NOT NULL DEFAULT '0',
	`unidade` varchar(16) NOT NULL DEFAULT 'un',
	`ativo` varchar(4) NOT NULL DEFAULT 'sim',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `led_tipos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `performance_auditada` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`cotacoes` int NOT NULL DEFAULT 0,
	`os_normais` int NOT NULL DEFAULT 0,
	`taxa_conversao` decimal(5,2) NOT NULL DEFAULT '0',
	`faturamento` decimal(14,2) NOT NULL DEFAULT '0',
	`valor_orcado` decimal(14,2) NOT NULL DEFAULT '0',
	`clientes_novos` int NOT NULL DEFAULT 0,
	`taxa_conv_novos` decimal(5,2) NOT NULL DEFAULT '0',
	`faturamento_novos` decimal(14,2) NOT NULL DEFAULT '0',
	`status_validacao` enum('pendente','validado','corrigido_excel') NOT NULL DEFAULT 'pendente',
	`congelado` boolean NOT NULL DEFAULT false,
	`fonte_excel` varchar(512),
	`observacoes` text,
	`auditado_por` varchar(128) NOT NULL DEFAULT 'sistema',
	`data_auditoria` timestamp NOT NULL DEFAULT (now()),
	`data_congelamento` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `performance_auditada_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `inteligencia_clientes_cache` ADD `periodo_key` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `retrabalhos` ADD `horasImpacto` decimal(6,2);--> statement-breakpoint
ALTER TABLE `inteligencia_clientes_cache` DROP COLUMN `ano`;