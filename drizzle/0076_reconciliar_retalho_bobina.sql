-- Reconciles the retalho setting added to 0075 after that migration had already
-- been applied in one environment. The IF NOT EXISTS also makes this safe in
-- databases where the current 0075 file already created the column.
ALTER TABLE "estudio_precos_impressao"
  ADD COLUMN IF NOT EXISTS "retalho_reutilizavel" boolean DEFAULT false NOT NULL;
