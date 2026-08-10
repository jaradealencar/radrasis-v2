CREATE TABLE `acoes_corretivas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`retrabalhoid` int NOT NULL,
	`status` enum('aberto','em_tratamento','resolvido') NOT NULL DEFAULT 'aberto',
	`acaoTomada` text,
	`responsavel` varchar(128),
	`prazoResolucao` timestamp,
	`dataResolucao` timestamp,
	`custoAdicional` decimal(10,2) DEFAULT '0',
	`observacoes` text,
	`registradoPor` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `acoes_corretivas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alertas_sistema` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('reincidencia','meta_excedida','sem_acao','prazo_vencido','novo_retrabalho','atraso_expedicao') NOT NULL,
	`severidade` enum('info','aviso','critico') NOT NULL DEFAULT 'aviso',
	`titulo` varchar(256) NOT NULL,
	`descricao` text,
	`referenciaId` int,
	`referenciaTipo` varchar(64),
	`referenciaExtra` varchar(256),
	`status` enum('ativo','lido','arquivado') NOT NULL DEFAULT 'ativo',
	`destinatario` varchar(128),
	`lidoPor` varchar(128),
	`lidoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alertas_sistema_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metas_retrabalho` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ano` int NOT NULL,
	`mes` int,
	`metaMaxRetrabalhosMes` int,
	`metaMaxCustoMes` decimal(12,2),
	`metaMaxPercFaturamento` decimal(5,2),
	`metaMaxPercEvitaveis` decimal(5,2),
	`metaMinResolucaoDias` int,
	`metaMaxReincidencias` int,
	`metasPorSetor` text,
	`observacoes` text,
	`criadoPor` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metas_retrabalho_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `planos_acao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoErro` varchar(20) NOT NULL,
	`setor` varchar(64),
	`titulo` varchar(256) NOT NULL,
	`problemaRaiz` text,
	`acoesPreventivas` text,
	`responsavel` varchar(128),
	`prazo` timestamp,
	`status` enum('pendente','em_andamento','concluido','monitorando') NOT NULL DEFAULT 'pendente',
	`reincidenciasNaAbertura` int DEFAULT 0,
	`reincidenciasAposPlano` int DEFAULT 0,
	`criadoPor` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `planos_acao_id` PRIMARY KEY(`id`)
);
