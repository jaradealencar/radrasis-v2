ALTER TABLE `crm_contatos` MODIFY COLUMN `canal` enum('whatsapp','telefone','email','visita','outro','perdida','nao_retornou','esperando_cliente','garantiu_fechamento') NOT NULL DEFAULT 'whatsapp';--> statement-breakpoint
ALTER TABLE `crm_metas` ADD `usuarioVinculadoId` int;--> statement-breakpoint
ALTER TABLE `crm_metas` ADD `usuarioVinculadoNome` varchar(128);