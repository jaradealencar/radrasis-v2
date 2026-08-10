ALTER TABLE `routines` MODIFY COLUMN `frequency` enum('diaria','semanal','quinzenal','mensal','esporadico') NOT NULL;--> statement-breakpoint
ALTER TABLE `routines` ADD `startDate` timestamp;--> statement-breakpoint
ALTER TABLE `routines` ADD `calendarDates` text;