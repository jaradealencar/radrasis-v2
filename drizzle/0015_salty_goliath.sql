CREATE TABLE `empacotamento_modelos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(128) NOT NULL,
	`descricao` text,
	`ativo` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empacotamento_modelos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empacotamento_pedidos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`numeroPedido` varchar(64) NOT NULL,
	`cliente` varchar(256) NOT NULL,
	`modeloId` int,
	`modeloNome` varchar(128),
	`tipoCaixa` varchar(64) NOT NULL,
	`arquivoUrl` text,
	`arquivoKey` text,
	`arquivoTipo` varchar(16),
	`status` enum('pendente','em_andamento','finalizado') NOT NULL DEFAULT 'pendente',
	`operadorId` int,
	`operadorNome` varchar(128),
	`finalizadoEm` timestamp,
	`valorComissao` decimal(8,2),
	`observacoes` text,
	`createdBy` int,
	`createdByNome` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empacotamento_pedidos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empacotamento_tabela_precos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modeloId` int NOT NULL,
	`tipoCaixa` varchar(64) NOT NULL,
	`valorComissao` decimal(8,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empacotamento_tabela_precos_id` PRIMARY KEY(`id`)
);
