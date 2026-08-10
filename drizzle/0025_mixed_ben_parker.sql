ALTER TABLE `cotacao_opcoes` ADD `tipoPrazo` enum('uteis','corridos') DEFAULT 'uteis';--> statement-breakpoint
ALTER TABLE `cotacoes_frete` ADD `horarioDecisaoMs` varchar(8);