CREATE TABLE `feriados` (
	`id` int AUTO_INCREMENT NOT NULL,
	`data` date NOT NULL,
	`descricao` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feriados_id` PRIMARY KEY(`id`),
	CONSTRAINT `feriados_data_unique` UNIQUE(`data`)
);
--> statement-breakpoint
CREATE TABLE `motivos_atraso` (
	`id` int AUTO_INCREMENT NOT NULL,
	`motivo` varchar(256) NOT NULL,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `motivos_atraso_id` PRIMARY KEY(`id`),
	CONSTRAINT `motivos_atraso_motivo_unique` UNIQUE(`motivo`)
);
--> statement-breakpoint
CREATE TABLE `producao_alertas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ordemId` int NOT NULL,
	`setorId` int,
	`tipoAlerta` enum('em_risco','atrasado','bloqueado','dependencia_nao_concluida') NOT NULL,
	`motivo` varchar(256),
	`motivoAtrasoId` int,
	`descricao` text,
	`resolvido` boolean NOT NULL DEFAULT false,
	`resolvidoEm` timestamp,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `producao_alertas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `producao_historico_alteracoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ordemId` int NOT NULL,
	`setorId` int,
	`tipoAlteracao` varchar(128) NOT NULL,
	`valorAnterior` text,
	`valorNovo` text,
	`motivo` text,
	`alteradoPor` varchar(128) NOT NULL,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `producao_historico_alteracoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `producao_ordens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`osNumero` varchar(32) NOT NULL,
	`clienteNome` varchar(256) NOT NULL,
	`clienteId` varchar(64),
	`descricaoPedido` text,
	`dataEntrada` date NOT NULL,
	`dataPrazo` date NOT NULL,
	`diasUteisTotais` int NOT NULL,
	`statusGeral` enum('nao_iniciado','em_andamento','concluido','atrasado') NOT NULL DEFAULT 'nao_iniciado',
	`temPintura` boolean NOT NULL DEFAULT false,
	`temPvcExpandido` boolean NOT NULL DEFAULT false,
	`temAcrilico` boolean NOT NULL DEFAULT false,
	`temGalvanizado` boolean NOT NULL DEFAULT false,
	`temInox` boolean NOT NULL DEFAULT false,
	`temPerfil` boolean NOT NULL DEFAULT false,
	`temLed` boolean NOT NULL DEFAULT false,
	`temAdesivo` boolean NOT NULL DEFAULT false,
	`temGabarito` boolean NOT NULL DEFAULT false,
	`criadoPor` varchar(128),
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `producao_ordens_id` PRIMARY KEY(`id`),
	CONSTRAINT `producao_ordens_osNumero_unique` UNIQUE(`osNumero`)
);
--> statement-breakpoint
CREATE TABLE `producao_setores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ordemId` int NOT NULL,
	`setorNome` varchar(128) NOT NULL,
	`sequencia` int NOT NULL,
	`status` enum('nao_iniciado','em_andamento','concluido','atrasado','bloqueado') NOT NULL DEFAULT 'nao_iniciado',
	`diasAlocados` int NOT NULL,
	`dataInicio` date,
	`dataFim` date,
	`dataFimPrevista` date NOT NULL,
	`emRisco` boolean NOT NULL DEFAULT false,
	`dependeDe` varchar(256),
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `producao_setores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `producao_alertas` ADD CONSTRAINT `producao_alertas_ordemId_producao_ordens_id_fk` FOREIGN KEY (`ordemId`) REFERENCES `producao_ordens`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `producao_alertas` ADD CONSTRAINT `producao_alertas_setorId_producao_setores_id_fk` FOREIGN KEY (`setorId`) REFERENCES `producao_setores`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `producao_alertas` ADD CONSTRAINT `producao_alertas_motivoAtrasoId_motivos_atraso_id_fk` FOREIGN KEY (`motivoAtrasoId`) REFERENCES `motivos_atraso`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `producao_historico_alteracoes` ADD CONSTRAINT `producao_historico_alteracoes_ordemId_producao_ordens_id_fk` FOREIGN KEY (`ordemId`) REFERENCES `producao_ordens`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `producao_historico_alteracoes` ADD CONSTRAINT `producao_historico_alteracoes_setorId_producao_setores_id_fk` FOREIGN KEY (`setorId`) REFERENCES `producao_setores`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `producao_setores` ADD CONSTRAINT `producao_setores_ordemId_producao_ordens_id_fk` FOREIGN KEY (`ordemId`) REFERENCES `producao_ordens`(`id`) ON DELETE cascade ON UPDATE no action;