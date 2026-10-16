CREATE TABLE "perfil_estoque_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"chave" varchar(160) NOT NULL,
	"mubisys_materia_prima_id" integer,
	"nome" varchar(320) NOT NULL,
	"familia" varchar(64) NOT NULL,
	"unidade" varchar(8) DEFAULT 'm' NOT NULL,
	"estoque_inicial" numeric(16, 4) DEFAULT '0' NOT NULL,
	"alvo_dois_meses" numeric(16, 4),
	"kg_por_metro" numeric(14, 6),
	"ativo" boolean DEFAULT true NOT NULL,
	"observacao" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "perfil_estoque_itens_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
CREATE TABLE "perfil_estoque_movimentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"perfil_item_id" integer NOT NULL,
	"tipo" varchar(24) NOT NULL,
	"quantidade" numeric(16, 4) NOT NULL,
	"unidade" varchar(8) NOT NULL,
	"os_mubisys_id" integer,
	"os_numero" varchar(32),
	"os_item_id" integer,
	"origem_chave" varchar(220) NOT NULL,
	"descricao" text,
	"criado_por" varchar(160),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "perfil_estoque_movimentos_origem_chave_unique" UNIQUE("origem_chave")
);
--> statement-breakpoint
CREATE TABLE "perfil_estoque_os" (
	"os_mubisys_id" integer PRIMARY KEY NOT NULL,
	"os_numero" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"itens_total" integer DEFAULT 0 NOT NULL,
	"itens_mapeados" integer DEFAULT 0 NOT NULL,
	"linhas_consumo" integer DEFAULT 0 NOT NULL,
	"pendencias_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"processado_em" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "perfil_estoque_movimentos" ADD CONSTRAINT "perfil_estoque_movimentos_perfil_item_id_perfil_estoque_itens_id_fk" FOREIGN KEY ("perfil_item_id") REFERENCES "public"."perfil_estoque_itens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "perfil_estoque_itens_familia_idx" ON "perfil_estoque_itens" USING btree ("familia","ativo");--> statement-breakpoint
CREATE INDEX "perfil_estoque_itens_materia_prima_idx" ON "perfil_estoque_itens" USING btree ("mubisys_materia_prima_id");--> statement-breakpoint
CREATE INDEX "perfil_estoque_movimentos_perfil_data_idx" ON "perfil_estoque_movimentos" USING btree ("perfil_item_id","created_at");--> statement-breakpoint
CREATE INDEX "perfil_estoque_movimentos_os_idx" ON "perfil_estoque_movimentos" USING btree ("os_mubisys_id");--> statement-breakpoint
CREATE INDEX "perfil_estoque_os_status_data_idx" ON "perfil_estoque_os" USING btree ("status","processado_em");--> statement-breakpoint
INSERT INTO "perfil_estoque_itens" ("chave", "nome", "familia", "unidade", "alvo_dois_meses", "kg_por_metro", "observacao") VALUES
('p001', 'Perfil Galvanizado 80mm - 26" | Perfil Galvanizado 80mm - 26" (0.50)', 'Galvanizado', 'm', 1511, 0.314, NULL),
('p002', 'Perfil Galvanizado 20mm - 26" | Perfil Galvanizado 20mm - 26" (0.50)', 'Galvanizado', 'm', 466, 0.0785, NULL),
('p003', 'Perfil Galvanizado 100mm - 26" | Perfil Galvanizado 100mm - 26" (0.50)', 'Galvanizado', 'm', 432, 0.3925, NULL),
('p004', 'Perfil Galvanizado 50mm - 26" | Perfil Galvanizado 50mm - 26" (0.50)', 'Galvanizado', 'm', 427, 0.19625, NULL),
('p005', 'Perfil Galvanizado 70mm - 26" | Perfil Galvanizado 70mm - 26" (0.50)', 'Galvanizado', 'm', 327, 0.27475, NULL),
('p006', 'Perfil Galvanizado 40mm - 26" | Perfil Galvanizado 40mm - 26" (0.50)', 'Galvanizado', 'm', 261, 0.157, NULL),
('p007', 'Perfil Galvanizado 80mm - 24" | Perfil Galvanizado 80mm - 24" (0.65)', 'Galvanizado', 'm', 254, 0.4082, NULL),
('p008', 'Perfil Galvanizado 60mm - 26" | Perfil Galvanizado 60mm - 26" (0.50)', 'Galvanizado', 'm', 234, 0.2355, NULL),
('p009', 'Perfil Inox Polido 50mm - 26"- Lig 430 | Perfil Inox Polido 50mm - 26" (0.50) Lig 430', 'Inox 430', 'm', 168, 0.1925, NULL),
('p010', 'Perfil Galvanizado 30mm - 26" | Perfil Galvanizado 30mm - 26" (0.50)', 'Galvanizado', 'm', 148, 0.11775, NULL),
('p011', 'Perfil Inox Escovado 30mm - 26"- Liga 430 | Perfil Inox Escovado 30mm - 26" (0.50) Lig 430', 'Inox 430', 'm', 112, 0.1155, NULL),
('p012', 'Perfil Inox Escovado 50mm - 26"- Lig 430 | Perfil Inox Escovado 50mm - 26" (0.50) Lig 430', 'Inox 430', 'm', 104, 0.1925, NULL),
('p013', 'Perfil Inox Polido 40mm - 26"- Lig 430 | Perfil Inox Polido 40mm - 26" (0.50) Liga 430', 'Inox 430', 'm', 101, 0.154, NULL),
('p014', 'Perfil Inox Polido 80mm - 26"- Liga 430 | Perfil Inox Polido 80mm - 26" (0.50) Liga 430', 'Inox 430', 'm', 78, 0.308, NULL),
('p015', 'Perfil Galvanizado 100mm - 24" | Perfil Galvanizado 100mm - 24" (0.65)', 'Galvanizado', 'm', 72, 0.51025, NULL),
('p016', 'Perfil Inox Polido 30mm - 26"- Liga 430 | Perfil Inox Polido 30mm - 26" (0.50) Liga 430', 'Inox 430', 'm', 68, 0.1155, NULL),
('p017', 'Perfil Inox Escovado 40mm - 26"- Lig 430 | Perfil Inox Escovado 40mm - 26" (0.50) Lig 430', 'Inox 430', 'm', 66, 0.154, NULL),
('p018', 'Perfil Inox Polido 30mm - 26"- Liga 304 | Perfil Inox Polido 30mm - 26" (0.50) Lig 304', 'Inox 304', 'm', 62, 0.1185, NULL),
('p019', 'Perfil Inox Escovado 30mm - 26"- Liga 304 | Perfil Inox Escovado 30mm - 26" (0.50) Lig 304', 'Inox 304', 'm', 62, 0.1185, NULL),
('p020', 'Perfil Inox Polido 80mm - 24"- Lig 430 | Perfil Inox Polido 80mm - 24" (0.65) Lig 430', 'Inox 430', 'm', 58, 0.4004, NULL),
('p021', 'Perfil Inox Escovado 20mm - 26" - Lig 430 | Perfil Inox Escovado 20mm - 26" (0.50) Lig 430', 'Inox 430', 'm', 57, 0.077, NULL),
('p022', 'Perfil Inox Escovado 50mm - 26"- Liga 304 | Perfil Inox Escovado 50mm - 26" (0.50) Lig 304', 'Inox 304', 'm', 45, 0.1975, NULL),
('p023', 'Perfil Inox Polido 50mm - 26"- Liga 304 | Perfil Inox Polido 50mm - 26" (0.50) Lig 304', 'Inox 304', 'm', 37, 0.1975, NULL),
('p024', 'Perfil Inox Polido 20mm - 26"- Lig 430 | Perfil Inox Polido 20mm - 26" (0.50) Lig 430', 'Inox 430', 'm', 34, 0.077, NULL),
('p025', 'Perfil Alumínio 70mm Branco Brilho', 'Alumínio', 'm', NULL, NULL, 'Espessura e histórico em metros pendentes; revise o alvo.'),
('p026', 'Perfil Galvanizado 120mm - 24" | Perfil Galvanizado 80mm - 24" (0.65)', 'Galvanizado', 'm', 22, NULL, 'Validar largura: nome 120 mm e BOM 80 mm.'),
('p027', 'Perfil Galvanizado 150mm - 24"', 'Galvanizado', 'm', 22, NULL, 'Sem correspondência no cadastro e sem espessura.'),
('p028', 'Perfil Inox Polido 60mm - 26"- Liga 430 | Perfil Inox Polido 60mm - 26" (0.50) Lig 430', 'Inox 430', 'm', 15, 0.231, NULL),
('p029', 'Perfil Inox Escovado 70mm - 26"- Lig 430 | Perfil Inox Escovado 70mm - 26" (0.50) Lig 430', 'Inox 430', 'm', 15, 0.2695, NULL),
('p030', 'Perfil Inox Polido 70mm - 26"- Lig 430 | Perfil Inox Polido 70mm - 26" (0.50) Lig 430', 'Inox 430', 'm', 14, 0.2695, NULL),
('p031', 'Perfil Alumínio 70mm Branco Fosco', 'Alumínio', 'm', NULL, NULL, 'Espessura e histórico em metros pendentes; revise o alvo.'),
('p032', 'Perfil Galvanizado 150mm - 22"', 'Galvanizado', 'm', NULL, NULL, 'Espessura e histórico em metros pendentes; revise o alvo.'),
('p033', 'Perfil Inox Polido 100mm - 24"- Lig 430', 'Inox 430', 'm', NULL, NULL, 'Espessura e histórico em metros pendentes; revise o alvo.'),
('p034', 'Perfil Inox Escovado 80mm - 26"- Liga 430 | Perfil Inox Escovado 80mm - 26" (0.50) Lig 430', 'Inox 430', 'm', 7, 0.308, NULL),
('p035', 'Perfil Inox Escovado 80mm - 24"- Lig 430', 'Inox 430', 'm', NULL, NULL, 'Espessura e histórico em metros pendentes; revise o alvo.'),
('p036', 'Perfil Inox Polido 80mm - 26"- Liga 304 | Perfil Inox Polido 80mm - 26" (0.50) Lig 304', 'Inox 304', 'm', 5, 0.316, NULL),
('p037', 'Perfil Alumínio 70mm Verde Brilho', 'Alumínio', 'm', NULL, NULL, 'Espessura e histórico em metros pendentes; revise o alvo.'),
('p038', 'Perfil Inox Escovado 80mm - 26"- Liga 304 | Perfil Inox Polido 80mm - 26" (0.50) Lig 304', 'Inox 304', 'm', 3, 0.316, 'Validar acabamento divergente entre nome e BOM.'),
('p039', 'Perfil Inox Escovado 60mm - 26"- Lig 430', 'Inox 430', 'm', 0, NULL, 'Sem consumo encontrado nas O.S. de 2026.')
ON CONFLICT ("chave") DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role", "pageKey", "canAccess") VALUES
('master', 'operacoes-estoque-perfis', 'sim'),
('admin', 'operacoes-estoque-perfis', 'sim'),
('gestor', 'operacoes-estoque-perfis', 'sim'),
('producao', 'operacoes-estoque-perfis', 'sim'),
('logistica', 'operacoes-estoque-perfis', 'sim');
