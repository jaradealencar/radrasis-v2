CREATE TABLE "estudio_clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"documento" varchar(14) NOT NULL,
	"razao" varchar(256),
	"fantasia" varchar(256),
	"endereco" varchar(1000),
	"email" varchar(320),
	"whatsapp" varchar(40),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "estudio_clientes_documento_idx" ON "estudio_clientes" USING btree ("documento");--> statement-breakpoint
CREATE INDEX "estudio_clientes_razao_idx" ON "estudio_clientes" USING btree ("razao");--> statement-breakpoint
CREATE INDEX "estudio_clientes_updated_at_idx" ON "estudio_clientes" USING btree ("updatedAt");
--> statement-breakpoint
WITH cotacoes_cliente AS (
	SELECT
		regexp_replace(COALESCE(snapshot.dados #>> '{cliente,cnpj}', ''), '[^0-9]', '', 'g') AS documento,
		NULLIF(btrim(snapshot.dados #>> '{cliente,razao}'), '') AS razao,
		NULLIF(btrim(snapshot.dados #>> '{cliente,fantasia}'), '') AS fantasia,
		NULLIF(btrim(snapshot.dados #>> '{cliente,endereco}'), '') AS endereco,
		NULLIF(btrim(snapshot.dados #>> '{cliente,email}'), '') AS email,
		NULLIF(btrim(snapshot.dados #>> '{cliente,whatsapp}'), '') AS whatsapp,
		p."updatedAt" AS atualizado_em
	FROM "propostas" p
	CROSS JOIN LATERAL (
		SELECT CASE
			WHEN left(p."observacoes", length('[ESTUDIO_COTACAO_V1]')) = '[ESTUDIO_COTACAO_V1]'
			THEN substring(p."observacoes" FROM length('[ESTUDIO_COTACAO_V1]') + 1)::jsonb
		END AS dados
	) snapshot
	WHERE left(p."observacoes", length('[ESTUDIO_COTACAO_V1]')) = '[ESTUDIO_COTACAO_V1]'
), clientes_recentes AS (
	SELECT DISTINCT ON (documento)
		documento,
		razao,
		COALESCE(fantasia, CASE WHEN length(documento) = 11 THEN razao END) AS fantasia,
		endereco,
		email,
		whatsapp
	FROM cotacoes_cliente
	WHERE length(documento) IN (11, 14)
	ORDER BY documento, atualizado_em DESC
)
INSERT INTO "estudio_clientes" ("documento", "razao", "fantasia", "endereco", "email", "whatsapp")
SELECT documento, razao, fantasia, endereco, email, whatsapp
FROM clientes_recentes
ON CONFLICT ("documento") DO NOTHING;
