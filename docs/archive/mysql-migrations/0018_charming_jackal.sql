ALTER TABLE `empacotamento_consumo_caixa` ADD `formulaConsumo` varchar(32) DEFAULT 'fixo' NOT NULL;--> statement-breakpoint
ALTER TABLE `empacotamento_consumo_caixa` ADD `fator` decimal(8,4) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `empacotamento_modelos` ADD `modeloCaixaIdPadrao` int;