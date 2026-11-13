-- Normaliza notas antigas e novas a partir dos pontos gravados, na escala 0–10.
-- Recalcular pela razão preserva a escala correta mesmo se a migration rodar
-- depois do deploy do código que já salva notas nessa escala.
UPDATE "training_attempts"
SET "score" = ROUND(("points_earned"::numeric / "points_possible"::numeric) * 10, 2)
WHERE "status" = 'completed'
  AND "score" IS NOT NULL
  AND "points_earned" IS NOT NULL
  AND "points_possible" IS NOT NULL
  AND "points_possible"::numeric > 0;
