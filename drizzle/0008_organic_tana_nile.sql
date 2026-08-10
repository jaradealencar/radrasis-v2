CREATE TABLE `cotacao_comentarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cotacaoId` int NOT NULL,
	`autorId` int,
	`autorNome` varchar(128) NOT NULL DEFAULT 'Sistema',
	`texto` text,
	`audioUrl` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cotacao_comentarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cotacao_opcoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cotacaoId` int NOT NULL,
	`transportadoraId` int,
	`transportadoraNome` varchar(128),
	`valorFrete` decimal(10,2) NOT NULL,
	`prazoDias` int,
	`modal` varchar(32),
	`observacoes` text,
	`selecionada` enum('sim','nao') NOT NULL DEFAULT 'nao',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cotacao_opcoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cotacoes_frete` (
	`id` int AUTO_INCREMENT NOT NULL,
	`solicitanteId` int,
	`solicitanteNome` varchar(128),
	`destinatarioNome` varchar(256),
	`destinatarioCnpj` varchar(32),
	`cepDestino` varchar(10),
	`municipio` varchar(128),
	`estado` varchar(2),
	`dimensoesLargura` decimal(8,2),
	`dimensoesAltura` decimal(8,2),
	`dimensoesComprimento` decimal(8,2),
	`pesoKg` decimal(8,2),
	`valorNf` decimal(12,2),
	`observacoes` text,
	`status` enum('fila','em_cotacao','pronto','concluido','cancelado') NOT NULL DEFAULT 'fila',
	`transportadoraSelecionadaId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cotacoes_frete_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cte_importacoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`numeroCte` varchar(64) NOT NULL,
	`transportadoraId` int,
	`transportadoraNome` varchar(128),
	`valor` decimal(12,2),
	`dataEmissao` timestamp,
	`remetente` varchar(256),
	`destinatario` varchar(256),
	`municipioDestino` varchar(128),
	`estadoDestino` varchar(2),
	`rawData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cte_importacoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transportadora_cidades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transportadoraId` int NOT NULL,
	`cidade` varchar(128) NOT NULL,
	`estado` varchar(2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transportadora_cidades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transportadoras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(128) NOT NULL,
	`site` varchar(256),
	`endereco` text,
	`referencia` text,
	`nomeContato` varchar(128),
	`telefoneContato` varchar(32),
	`whatsappContato` varchar(32),
	`nomeContatoNegocial` varchar(128),
	`telefoneContatoNegocial` varchar(32),
	`emailContatoNegocial` varchar(128),
	`formaCotacao` enum('site','whatsapp','telefone','email') DEFAULT 'site',
	`linkSiteCotacao` varchar(256),
	`modais` text,
	`pesoMaxKg` decimal(10,2),
	`alturaMaxCm` decimal(8,2),
	`larguraMaxCm` decimal(8,2),
	`comprimentoMaxCm` decimal(8,2),
	`somaMaxCm` decimal(8,2),
	`horarioLimiteColeta` varchar(8),
	`horarioLimiteMercadoria` varchar(8),
	`distanciaSedMin` int,
	`observacoes` text,
	`ativa` enum('sim','nao') NOT NULL DEFAULT 'sim',
	`logoUrl` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transportadoras_id` PRIMARY KEY(`id`)
);
