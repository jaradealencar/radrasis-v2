CREATE TABLE `financeiro_mensal` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`faturamentoOficial` decimal(14,2),
	`despesasFixas` decimal(14,2),
	`despesasVariaveis` decimal(14,2),
	`numColaboradores` int,
	`lucroBruto` decimal(14,2),
	`lucroLiquido` decimal(14,2),
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financeiro_mensal_id` PRIMARY KEY(`id`)
);
