CREATE TABLE `inteligencia_clientes_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ano` int NOT NULL,
	`dados_json` mediumtext NOT NULL,
	`calculado_em` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inteligencia_clientes_cache_id` PRIMARY KEY(`id`)
);
