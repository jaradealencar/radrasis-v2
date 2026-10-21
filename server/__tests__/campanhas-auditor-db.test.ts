import { describe, expect, it } from "vitest";
import { getPool } from "../db/db-connection";

const databaseUrl = process.env.DATABASE_URL;
const isExplicitCiDatabase = (() => {
  if (process.env.AUDITOR_TEST_DATABASE !== "1" || !databaseUrl) return false;
  try {
    const url = new URL(databaseUrl);
    return (
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      url.pathname === "/radrasys_campaigns_ci"
    );
  } catch {
    return false;
  }
})();

describe.skipIf(!isExplicitCiDatabase)(
  "Robô Auditor — histórico isolado",
  () => {
    it("AUDITOR-CRITICAL: protege execuções concluídas contra edição e exclusão", async () => {
      const inserted = await getPool().query(
        `INSERT INTO campanhas_auditor_execucoes
        (escopo, modo, resumo, resultados, finalizada, iniciado_em, concluido_em)
       VALUES ('completo', 'teste_ci', '{}'::jsonb, '[]'::jsonb, false, NOW(), NOW())
       RETURNING id`
      );
      const id = inserted.rows[0]?.id;
      expect(id).toBeTruthy();

      await getPool().query(
        "UPDATE campanhas_auditor_execucoes SET finalizada = true WHERE id = $1",
        [id]
      );
      const saved = await getPool().query(
        "SELECT finalizada FROM campanhas_auditor_execucoes WHERE id = $1",
        [id]
      );
      expect(saved.rows[0]?.finalizada).toBe(true);

      await expect(
        getPool().query(
          "UPDATE campanhas_auditor_execucoes SET resumo = '{}'::jsonb WHERE id = $1",
          [id]
        )
      ).rejects.toThrow(/imutável|imuta.vel/iu);
      await expect(
        getPool().query(
          "DELETE FROM campanhas_auditor_execucoes WHERE id = $1",
          [id]
        )
      ).rejects.toThrow(/imutável|imuta.vel/iu);
    });
  }
);
