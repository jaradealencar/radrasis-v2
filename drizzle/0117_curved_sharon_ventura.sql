CREATE TABLE "campanhas_whatsapp_contato_campanhas" (
	"contato_id" integer NOT NULL,
	"campanha_id" integer NOT NULL,
	"campanha_nome" varchar(160) NOT NULL,
	"primeira_tentativa_em" timestamp NOT NULL,
	"ultima_tentativa_em" timestamp NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"historico_completo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campanhas_whatsapp_contato_campanhas_pk" PRIMARY KEY("contato_id","campanha_id")
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_contato_telefones" (
	"id" serial PRIMARY KEY NOT NULL,
	"contato_id" integer NOT NULL,
	"telefone_e164" varchar(16) NOT NULL,
	"valores_originais" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"origem" varchar(32) NOT NULL,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campanhas_whatsapp_contato_telefones_telefone_e164_unique" UNIQUE("telefone_e164")
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_contato_tentativas" (
	"id" serial PRIMARY KEY NOT NULL,
	"contato_id" integer NOT NULL,
	"telefone_id" integer NOT NULL,
	"telefone_e164" varchar(16) NOT NULL,
	"telefone_original" text NOT NULL,
	"campanha_id" integer NOT NULL,
	"campanha_nome" varchar(160) NOT NULL,
	"disparo_id" integer,
	"resultado" varchar(24) NOT NULL,
	"origem" varchar(32) NOT NULL,
	"idempotency_key" varchar(160),
	"ocorrido_em" timestamp DEFAULT now() NOT NULL,
	"data_envio" date,
	CONSTRAINT "campanhas_whatsapp_contato_tentativas_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_contato_vinculo_auditoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"contato_id" integer NOT NULL,
	"vinculo_id" integer,
	"tipo_entidade" varchar(24) NOT NULL,
	"chave_entidade" varchar(80) NOT NULL,
	"acao" varchar(16) NOT NULL,
	"justificativa" text NOT NULL,
	"usuario_id" text,
	"usuario_nome" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_contato_vinculos" (
	"id" serial PRIMARY KEY NOT NULL,
	"contato_id" integer NOT NULL,
	"tipo_entidade" varchar(24) NOT NULL,
	"chave_entidade" varchar(80) NOT NULL,
	"rotulo_entidade" varchar(256) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"metodo" varchar(16) DEFAULT 'manual' NOT NULL,
	"confianca" integer,
	"justificativa" text NOT NULL,
	"vinculado_por_id" text,
	"vinculado_por_nome" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_contatos" (
	"id" serial PRIMARY KEY NOT NULL,
	"telefone_inicial_e164" varchar(16) NOT NULL,
	"nome" varchar(200),
	"origem" varchar(32) NOT NULL,
	"campanha_origem_id" integer,
	"campanha_origem_nome" varchar(160),
	"criado_por_id" text,
	"criado_por_nome" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campanhas_whatsapp_contatos_telefone_inicial_e164_unique" UNIQUE("telefone_inicial_e164")
);
--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_contato_campanhas" ADD CONSTRAINT "campanhas_whatsapp_contato_campanhas_contato_id_campanhas_whatsapp_contatos_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."campanhas_whatsapp_contatos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_contato_telefones" ADD CONSTRAINT "campanhas_whatsapp_contato_telefones_contato_id_campanhas_whatsapp_contatos_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."campanhas_whatsapp_contatos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_contato_tentativas" ADD CONSTRAINT "campanhas_whatsapp_contato_tentativas_contato_id_campanhas_whatsapp_contatos_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."campanhas_whatsapp_contatos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_contato_tentativas" ADD CONSTRAINT "campanhas_whatsapp_contato_tentativas_telefone_id_campanhas_whatsapp_contato_telefones_id_fk" FOREIGN KEY ("telefone_id") REFERENCES "public"."campanhas_whatsapp_contato_telefones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_contato_tentativas" ADD CONSTRAINT "campanhas_whatsapp_contato_tentativas_disparo_id_campanhas_whatsapp_disparos_id_fk" FOREIGN KEY ("disparo_id") REFERENCES "public"."campanhas_whatsapp_disparos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_contato_vinculo_auditoria" ADD CONSTRAINT "campanhas_whatsapp_contato_vinculo_auditoria_contato_id_campanhas_whatsapp_contatos_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."campanhas_whatsapp_contatos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_contato_vinculos" ADD CONSTRAINT "campanhas_whatsapp_contato_vinculos_contato_id_campanhas_whatsapp_contatos_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."campanhas_whatsapp_contatos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_contato_campanhas_campanha_idx" ON "campanhas_whatsapp_contato_campanhas" USING btree ("campanha_id");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_contato_telefones_contato_idx" ON "campanhas_whatsapp_contato_telefones" USING btree ("contato_id");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_contato_tentativas_contato_idx" ON "campanhas_whatsapp_contato_tentativas" USING btree ("contato_id","ocorrido_em");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_contato_tentativas_campanha_idx" ON "campanhas_whatsapp_contato_tentativas" USING btree ("campanha_id","ocorrido_em");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_contato_tentativas_disparo_idx" ON "campanhas_whatsapp_contato_tentativas" USING btree ("disparo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_contato_tentativas_disparo_telefone_unique" ON "campanhas_whatsapp_contato_tentativas" USING btree ("disparo_id","telefone_e164") WHERE "campanhas_whatsapp_contato_tentativas"."disparo_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_contato_vinculo_auditoria_contato_idx" ON "campanhas_whatsapp_contato_vinculo_auditoria" USING btree ("contato_id","created_at");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_contato_vinculos_contato_idx" ON "campanhas_whatsapp_contato_vinculos" USING btree ("contato_id","ativo");--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_contato_vinculos_entidade_ativa_unique" ON "campanhas_whatsapp_contato_vinculos" USING btree ("contato_id","tipo_entidade","chave_entidade") WHERE "campanhas_whatsapp_contato_vinculos"."ativo" = true;--> statement-breakpoint

-- Migra o que as tabelas antigas ainda conseguem provar. O histórico antigo
-- guardava só a ocorrência mais recente por campanha/telefone; esses totais são
-- marcados como incompletos em vez de inventar tentativas que nunca foram salvas.
WITH eventos AS (
  SELECT regexp_replace(i.telefone, '[^0-9]', '', 'g') AS telefone_digitos,
         d.campanha_id, c.nome AS campanha_nome, i.nome,
         i.created_at AS ocorrido_em, d.enviado_em AS data_envio, d.id AS disparo_id,
         'historico_item'::text AS resultado, ('historico_item_' || i.origem)::varchar(32) AS origem,
         ('legado:item:' || i.id)::varchar(160) AS idempotency_key, 0 AS prioridade
  FROM campanhas_whatsapp_disparo_itens i
  JOIN campanhas_whatsapp_disparos d ON d.id = i.disparo_id
  JOIN campanhas_whatsapp c ON c.id = d.campanha_id
  UNION ALL
  SELECT regexp_replace(h.telefone, '[^0-9]', '', 'g'),
         h.campanha_id, c.nome, NULL::varchar, h.ultimo_envio_em::timestamp,
         h.ultimo_envio_em, h.disparo_id, 'historico_reconstruido'::text,
         'historico_ultima_ocorrencia'::varchar(32),
         ('legado:historico:' || h.campanha_id || ':' || regexp_replace(h.telefone, '[^0-9]', '', 'g'))::varchar(160), 1
  FROM campanhas_whatsapp_contatos_historico h
  JOIN campanhas_whatsapp c ON c.id = h.campanha_id
), eventos_validos AS (
  SELECT * FROM eventos WHERE telefone_digitos ~ '^[1-9][0-9]{7,14}$'
), eventos_unicos AS (
  SELECT DISTINCT ON (campanha_id, telefone_digitos, disparo_id)
         telefone_digitos, campanha_id, campanha_nome, nome, ocorrido_em,
         data_envio, disparo_id, resultado, origem, idempotency_key
  FROM eventos_validos
  ORDER BY campanha_id, telefone_digitos, disparo_id, prioridade, ocorrido_em, idempotency_key
), primeiro_evento AS (
  SELECT DISTINCT ON (telefone_digitos)
         telefone_digitos, nome, campanha_id, campanha_nome, ocorrido_em
  FROM eventos_unicos
  ORDER BY telefone_digitos, ocorrido_em, campanha_id
)
INSERT INTO campanhas_whatsapp_contatos
  (telefone_inicial_e164, nome, origem, campanha_origem_id, campanha_origem_nome, created_at, updated_at)
SELECT '+' || telefone_digitos, NULLIF(nome, ''), 'historico_migrado', campanha_id,
       campanha_nome, ocorrido_em, now()
FROM primeiro_evento
ON CONFLICT (telefone_inicial_e164) DO NOTHING;--> statement-breakpoint

INSERT INTO campanhas_whatsapp_contato_telefones
  (contato_id, telefone_e164, valores_originais, origem)
WITH origens AS (
  SELECT regexp_replace(i.telefone, '[^0-9]', '', 'g') AS telefone_digitos, i.telefone AS telefone_original
  FROM campanhas_whatsapp_disparo_itens i
  UNION ALL
  SELECT regexp_replace(h.telefone, '[^0-9]', '', 'g'), h.telefone
  FROM campanhas_whatsapp_contatos_historico h
), origens_validas AS (
  SELECT * FROM origens WHERE telefone_digitos ~ '^[1-9][0-9]{7,14}$'
)
SELECT c.id, c.telefone_inicial_e164,
       COALESCE(jsonb_agg(DISTINCT o.telefone_original) FILTER (WHERE o.telefone_original IS NOT NULL),
                jsonb_build_array(substr(c.telefone_inicial_e164, 2))),
       'historico_migrado'
FROM campanhas_whatsapp_contatos c
LEFT JOIN origens_validas o ON '+' || o.telefone_digitos = c.telefone_inicial_e164
WHERE c.origem = 'historico_migrado'
GROUP BY c.id, c.telefone_inicial_e164
ON CONFLICT (telefone_e164) DO NOTHING;--> statement-breakpoint

WITH eventos AS (
  SELECT regexp_replace(i.telefone, '[^0-9]', '', 'g') AS telefone_digitos, i.telefone AS telefone_original,
         d.campanha_id, c.nome AS campanha_nome, i.created_at AS ocorrido_em,
         d.enviado_em AS data_envio, d.id AS disparo_id, 'historico_item'::text AS resultado,
         ('historico_item_' || i.origem)::varchar(32) AS origem,
         ('legado:item:' || i.id)::varchar(160) AS idempotency_key, i.id AS ordem
  FROM campanhas_whatsapp_disparo_itens i
  JOIN campanhas_whatsapp_disparos d ON d.id = i.disparo_id
  JOIN campanhas_whatsapp c ON c.id = d.campanha_id
  UNION ALL
  SELECT regexp_replace(h.telefone, '[^0-9]', '', 'g'), h.telefone, h.campanha_id, c.nome,
         h.ultimo_envio_em::timestamp, h.ultimo_envio_em, h.disparo_id,
         'historico_reconstruido'::text, 'historico_ultima_ocorrencia'::varchar(32),
         ('legado:historico:' || h.campanha_id || ':' || regexp_replace(h.telefone, '[^0-9]', '', 'g'))::varchar(160),
         h.id
  FROM campanhas_whatsapp_contatos_historico h
  JOIN campanhas_whatsapp c ON c.id = h.campanha_id
), eventos_validos AS (
  SELECT * FROM eventos WHERE telefone_digitos ~ '^[1-9][0-9]{7,14}$'
), eventos_unicos AS (
  SELECT DISTINCT ON (campanha_id, telefone_digitos, disparo_id)
         telefone_digitos, telefone_original, campanha_id, campanha_nome, ocorrido_em, data_envio,
         disparo_id, resultado, origem, idempotency_key
  FROM eventos_validos
  ORDER BY campanha_id, telefone_digitos, disparo_id,
           CASE WHEN origem LIKE 'historico_item_%' THEN 0 ELSE 1 END,
           ocorrido_em, idempotency_key
)
INSERT INTO campanhas_whatsapp_contato_tentativas
  (contato_id, telefone_id, telefone_e164, telefone_original, campanha_id, campanha_nome,
   disparo_id, resultado, origem, idempotency_key, ocorrido_em, data_envio)
SELECT c.id, p.id, '+' || e.telefone_digitos, e.telefone_original,
       e.campanha_id, e.campanha_nome, e.disparo_id, e.resultado, e.origem,
       e.idempotency_key, e.ocorrido_em, e.data_envio
FROM eventos_unicos e
JOIN campanhas_whatsapp_contatos c ON c.telefone_inicial_e164 = '+' || e.telefone_digitos
JOIN campanhas_whatsapp_contato_telefones p ON p.telefone_e164 = '+' || e.telefone_digitos
ON CONFLICT (disparo_id, telefone_e164) WHERE disparo_id IS NOT NULL DO NOTHING;--> statement-breakpoint

INSERT INTO campanhas_whatsapp_contato_campanhas
  (contato_id, campanha_id, campanha_nome, primeira_tentativa_em, ultima_tentativa_em,
   tentativas, historico_completo)
SELECT contato_id, campanha_id, max(campanha_nome), min(ocorrido_em), max(ocorrido_em),
       count(*)::int, false
FROM campanhas_whatsapp_contato_tentativas
WHERE origem LIKE 'historico_%'
GROUP BY contato_id, campanha_id
ON CONFLICT (contato_id, campanha_id) DO UPDATE SET
  campanha_nome = EXCLUDED.campanha_nome,
  primeira_tentativa_em = LEAST(campanhas_whatsapp_contato_campanhas.primeira_tentativa_em, EXCLUDED.primeira_tentativa_em),
  ultima_tentativa_em = GREATEST(campanhas_whatsapp_contato_campanhas.ultima_tentativa_em, EXCLUDED.ultima_tentativa_em),
  tentativas = campanhas_whatsapp_contato_campanhas.tentativas + EXCLUDED.tentativas,
  historico_completo = false,
  updated_at = now();--> statement-breakpoint

CREATE OR REPLACE FUNCTION campanhas_whatsapp_contato_vinculo_auditoria_proteger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Auditoria de vínculos de contatos é append-only';
END;
$$;--> statement-breakpoint

CREATE TRIGGER campanhas_whatsapp_contato_vinculo_auditoria_immutability
BEFORE UPDATE OR DELETE ON campanhas_whatsapp_contato_vinculo_auditoria
FOR EACH ROW EXECUTE FUNCTION campanhas_whatsapp_contato_vinculo_auditoria_proteger();
