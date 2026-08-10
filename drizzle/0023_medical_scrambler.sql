CREATE TABLE `knowledge_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pergunta` text NOT NULL,
	`conteudoSugerido` text NOT NULL,
	`fonte` varchar(32) NOT NULL DEFAULT 'manual',
	`autorId` int,
	`autorNome` varchar(128),
	`status` varchar(32) NOT NULL DEFAULT 'pendente',
	`tituloSugerido` varchar(256),
	`categoriaSugerida` varchar(64),
	`observacaoMaster` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_suggestions_id` PRIMARY KEY(`id`)
);
