CREATE TABLE `empacotamento_checklist_letreiro_itens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modeloLetreitoId` int NOT NULL,
	`ordem` int NOT NULL DEFAULT 0,
	`descricao` varchar(512) NOT NULL,
	`obrigatorio` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `empacotamento_checklist_letreiro_itens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empacotamento_config_produtividade` (
	`id` int AUTO_INCREMENT NOT NULL,
	`valorPorMinuto` decimal(10,4) NOT NULL DEFAULT '0.15',
	`bonusPorcentagem` decimal(5,2) NOT NULL DEFAULT '20.00',
	`penalidadePorcentagem` decimal(5,2) NOT NULL DEFAULT '30.00',
	`descricao` varchar(255),
	`ativo` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empacotamento_config_produtividade_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empacotamento_cronometro_pausas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedidoUsuarioId` int NOT NULL,
	`pausadoEm` timestamp NOT NULL,
	`retomadoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `empacotamento_cronometro_pausas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empacotamento_insumos_letreiro` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modeloLetreiId` int NOT NULL,
	`insumoId` int NOT NULL,
	`quantidade` decimal(10,4) NOT NULL DEFAULT '1',
	`fatorM2` decimal(10,4),
	`observacao` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empacotamento_insumos_letreiro_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empacotamento_pedido_checklist_letreiro` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedidoId` int NOT NULL,
	`itemId` int NOT NULL,
	`marcado` int NOT NULL DEFAULT 0,
	`marcadoPor` varchar(128),
	`marcadoEm` timestamp,
	CONSTRAINT `empacotamento_pedido_checklist_letreiro_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empacotamento_sessoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedidoId` int NOT NULL,
	`operadorId` int NOT NULL,
	`operadorNome` varchar(128) NOT NULL,
	`iniciadoEm` int NOT NULL,
	`finalizadoEm` int,
	`totalSegundos` int NOT NULL DEFAULT 0,
	`status` varchar(32) NOT NULL DEFAULT 'ativo',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empacotamento_sessoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empacotamento_sessoes_pausas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessaoId` int NOT NULL,
	`pausadoEm` int NOT NULL,
	`retomadoEm` int,
	CONSTRAINT `empacotamento_sessoes_pausas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_table_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`versao` varchar(16) NOT NULL,
	`sectionId` int NOT NULL,
	`sectionTitle` varchar(256),
	`autor` varchar(128) DEFAULT 'sistema',
	`campoAlterado` varchar(64),
	`valorAnterior` text,
	`valorNovo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_table_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_table_meta` (
	`id` int AUTO_INCREMENT NOT NULL,
	`versao` varchar(16) NOT NULL DEFAULT '001',
	`dataModificacao` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`descricao` text,
	CONSTRAINT `price_table_meta_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `transportadora_filiais` MODIFY COLUMN `telefone` varchar(256);--> statement-breakpoint
ALTER TABLE `cotacoes_frete` ADD `observacaoGol` text;--> statement-breakpoint
ALTER TABLE `cotacoes_frete` ADD `fotoUrl` text;--> statement-breakpoint
ALTER TABLE `cotacoes_frete` ADD `empacotamentoPedidoId` int;--> statement-breakpoint
ALTER TABLE `cotacoes_frete` ADD `empacotamentoPedidoNumero` varchar(64);--> statement-breakpoint
ALTER TABLE `empacotamento_insumos` ADD `precoAtualizadoEm` timestamp;--> statement-breakpoint
ALTER TABLE `empacotamento_modelos` ADD `tempoPorM2Min` decimal(8,2);--> statement-breakpoint
ALTER TABLE `empacotamento_modelos` ADD `valorProdutividadePorMinLetreiro` decimal(10,4);--> statement-breakpoint
ALTER TABLE `empacotamento_modelos_caixa` ADD `tipoCaixa` varchar(32) DEFAULT 'padronizada' NOT NULL;--> statement-breakpoint
ALTER TABLE `empacotamento_modelos_caixa` ADD `custoAquisicao` decimal(10,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `empacotamento_modelos_caixa` ADD `custoAquisicaoAtualizadoEm` timestamp;--> statement-breakpoint
ALTER TABLE `empacotamento_modelos_caixa` ADD `tempoPorM2Min` decimal(8,2);--> statement-breakpoint
ALTER TABLE `empacotamento_modelos_caixa` ADD `tempoPorM3Min` decimal(8,2);--> statement-breakpoint
ALTER TABLE `empacotamento_modelos_caixa` ADD `tempoPorMetroArestaMin` decimal(8,2);--> statement-breakpoint
ALTER TABLE `empacotamento_modelos_caixa` ADD `valorProdutividadePorCm2` decimal(10,6);--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` ADD `larguraCm` decimal(8,2);--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` ADD `alturaCm` decimal(8,2);--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` ADD `profundidadeCm` decimal(8,2);--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` ADD `pesoKg` decimal(8,2);--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` ADD `metrosQuadrados` decimal(10,4);--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` ADD `cnpjCliente` varchar(32);--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` ADD `cepCliente` varchar(16);--> statement-breakpoint
ALTER TABLE `empacotamento_pedidos` ADD `enderecoCliente` varchar(512);--> statement-breakpoint
ALTER TABLE `transportadora_cidades` ADD `telefone` varchar(256);--> statement-breakpoint
ALTER TABLE `transportadora_cidades` ADD `observacao` varchar(512);--> statement-breakpoint
ALTER TABLE `transportadora_cidades` ADD `endereco` varchar(512);--> statement-breakpoint
ALTER TABLE `transportadora_cidades` ADD `responsavel` varchar(128);--> statement-breakpoint
ALTER TABLE `transportadora_cidades` ADD `sede` varchar(128);--> statement-breakpoint
ALTER TABLE `transportadoras` ADD `coberturaTotal` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `empacotamento_modelos_caixa` DROP COLUMN `tempoLimiteMin`;--> statement-breakpoint
ALTER TABLE `empacotamento_modelos_caixa` DROP COLUMN `valorComissao`;