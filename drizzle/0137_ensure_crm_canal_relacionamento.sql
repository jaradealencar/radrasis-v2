-- Reassert this CRM value in environments where the schema lags behind the app.
ALTER TYPE "public"."crm_canal" ADD VALUE IF NOT EXISTS 'relacionamento';
