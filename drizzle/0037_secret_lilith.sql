CREATE TABLE `meta_produtos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nomeProduto` varchar(256) NOT NULL,
	`codigoProduto` varchar(64),
	`metaParticipacaoPct` decimal(5,2) NOT NULL DEFAULT '0',
	`ativo` boolean NOT NULL DEFAULT true,
	`observacao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_produtos_id` PRIMARY KEY(`id`)
);
