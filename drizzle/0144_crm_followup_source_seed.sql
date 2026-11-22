INSERT INTO "campanhas_whatsapp_fontes" ("tipo", "chave", "label", "descricao", "ativo") VALUES
	('crm_propostas', 'crm_propostas', 'CRM - propostas abertas', 'Origem exclusiva para inscricoes explicitas do CRM. Nao importa contatos automaticamente; cada proposta exige confirmacao individual de opt-in.', true)
ON CONFLICT ("chave") DO NOTHING;
