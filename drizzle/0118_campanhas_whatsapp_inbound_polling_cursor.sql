CREATE TABLE "campanhas_whatsapp_inbound_polling_cursor" (
	"chave" varchar(64) PRIMARY KEY NOT NULL,
	"cursor_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
