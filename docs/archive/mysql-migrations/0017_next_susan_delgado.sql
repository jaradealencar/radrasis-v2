CREATE TABLE `empacotamento_consumo_caixa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modeloCaixaId` int NOT NULL,
	`insumoId` int NOT NULL,
	`quantidadePorCaixa` decimal(10,4) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empacotamento_consumo_caixa_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empacotamento_custo_funcionario` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(128) NOT NULL DEFAULT 'Padrão',
	`salarioMensal` decimal(10,2) NOT NULL DEFAULT '0',
	`horasMes` decimal(6,2) NOT NULL DEFAULT '220',
	`custoHora` decimal(10,4),
	`ativo` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empacotamento_custo_funcionario_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empacotamento_insumos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(128) NOT NULL,
	`unidadeMedida` varchar(32) NOT NULL,
	`custoUnitario` decimal(10,4) NOT NULL DEFAULT '0',
	`categoria` varchar(64),
	`ativo` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empacotamento_insumos_id` PRIMARY KEY(`id`)
);
