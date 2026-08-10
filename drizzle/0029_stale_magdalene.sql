CREATE TABLE `biblioteca_arquivos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(256) NOT NULL,
	`descricao` text,
	`categoria` varchar(64) NOT NULL DEFAULT 'Geral',
	`subcategoria` varchar(64),
	`tags` text,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(1024) NOT NULL,
	`fileName` varchar(256) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`fileSize` int NOT NULL DEFAULT 0,
	`uploadedBy` varchar(128),
	`downloads` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `biblioteca_arquivos_id` PRIMARY KEY(`id`)
);
