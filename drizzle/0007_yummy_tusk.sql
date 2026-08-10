CREATE TABLE `knowledge_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`knowledgeId` int NOT NULL,
	`author` varchar(128) NOT NULL DEFAULT 'Equipe',
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledge_comments_id` PRIMARY KEY(`id`)
);
