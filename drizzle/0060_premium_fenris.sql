CREATE TABLE `mubisys_api_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cache_key` varchar(64) NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`os_data` mediumtext,
	`orc_data` mediumtext,
	`fetched_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mubisys_api_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `mubisys_api_cache_cache_key_unique` UNIQUE(`cache_key`)
);
