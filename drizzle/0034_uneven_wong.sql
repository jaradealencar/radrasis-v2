CREATE TABLE `desempenho_colaborador_mensal` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(120) NOT NULL,
	`categoria` varchar(40) NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`numFaltas` int DEFAULT 0,
	`metrosSoldados` decimal(10,2),
	`numRetrabalhos` int DEFAULT 0,
	`numPropostas` int DEFAULT 0,
	`numVendas` int DEFAULT 0,
	`faturamentoVendedor` decimal(14,2),
	`ticketMedioVendedor` decimal(12,2),
	`numTrabalhos` int DEFAULT 0,
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `desempenho_colaborador_mensal_id` PRIMARY KEY(`id`)
);
