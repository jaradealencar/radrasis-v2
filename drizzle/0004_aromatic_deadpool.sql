CREATE TABLE `local_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(256) NOT NULL,
	`role` enum('master','admin','vendas','logistica','producao','financeiro') NOT NULL DEFAULT 'vendas',
	`active` enum('sim','nao') NOT NULL DEFAULT 'sim',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `local_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role` enum('master','admin','vendas','logistica','producao','financeiro') NOT NULL,
	`pageKey` varchar(64) NOT NULL,
	`canAccess` enum('sim','nao') NOT NULL DEFAULT 'nao',
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`)
);
