CREATE TABLE `auditoria_retrabalhos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`retrabalhoId` int,
	`osRetrabalhada` varchar(32),
	`osOriginal` varchar(64),
	`acao` enum('CRIACAO','EDICAO','EXCLUSAO') NOT NULL,
	`usuarioId` int,
	`usuarioNome` varchar(128),
	`usuarioRole` varchar(32),
	`detalhes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditoria_retrabalhos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `transportadoras` ADD `portalSenha` varchar(256);--> statement-breakpoint
ALTER TABLE `transportadoras` ADD `ultAtualizCidades` varchar(16);--> statement-breakpoint
ALTER TABLE `transportadoras` ADD `contatoRastreio` text;