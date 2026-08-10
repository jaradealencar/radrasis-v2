CREATE TABLE `crm_atividade_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendedor` varchar(128) NOT NULL,
	`local_user_id` int,
	`acao` varchar(64) NOT NULL,
	`orcamento_id` varchar(32),
	`empresa` varchar(256),
	`detalhe` varchar(512),
	`realizada_em` timestamp NOT NULL DEFAULT (now()),
	`turno` enum('manha','tarde','noite') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crm_atividade_log_id` PRIMARY KEY(`id`)
);
