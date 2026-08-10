CREATE TABLE `price_table_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`page` int NOT NULL,
	`sectionOrder` int NOT NULL DEFAULT 0,
	`sectionTitle` varchar(256) NOT NULL,
	`contentJson` text NOT NULL,
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_table_sections_id` PRIMARY KEY(`id`)
);
