import { describe, it, expect, afterAll } from 'vitest';
import { selectQuery, mutationQuery } from '../db/db-connection';

const NOME_TESTE = 'TRANSPORTADORA VITEST NACIONAL';
let idTeste = 0;

describe('transportadoras — alcance nacional (coberturaTotal)', () => {
  afterAll(async () => {
    if (idTeste) {
      await mutationQuery('DELETE FROM transportadora_cidades WHERE "transportadoraId" = ?', [idTeste]);
      await mutationQuery('DELETE FROM transportadoras WHERE id = ?', [idTeste]);
    }
  });

  it('cria transportadora sem alcance nacional (coberturaTotal = 0)', async () => {
    const res: any = await mutationQuery(
      'INSERT INTO transportadoras (nome, ativa, "coberturaTotal") VALUES (?, ?, ?) RETURNING id',
      [NOME_TESTE, 'sim', 0],
    );
    idTeste = Number(res?.insertId ?? 0);
    expect(idTeste).toBeGreaterThan(0);

    const rows = await selectQuery('SELECT "coberturaTotal" FROM transportadoras WHERE id = ?', [idTeste]);
    expect(Number(rows[0].coberturaTotal)).toBe(0);
  });

  it('ativa o alcance nacional (coberturaTotal = 1)', async () => {
    await mutationQuery('UPDATE transportadoras SET "coberturaTotal" = ? WHERE id = ?', [1, idTeste]);
    const rows = await selectQuery('SELECT "coberturaTotal" FROM transportadoras WHERE id = ?', [idTeste]);
    expect(Number(rows[0].coberturaTotal)).toBe(1);
  });

  it('transportadora nacional aparece em qualquer cidade, mesmo sem cidades cadastradas', async () => {
    // Simula a lógica de consultarCobertura: atende se estiver na lista de cidades OU coberturaTotal = 1
    const cidade = 'CIDADE INEXISTENTE VITEST';
    const estado = 'SP';

    const cidadesRows = await selectQuery(
      'SELECT "transportadoraId" FROM transportadora_cidades WHERE cidade LIKE ? AND estado = ?',
      [`%${cidade}%`, estado],
    );
    const ids = cidadesRows.map((c: any) => Number(c.transportadoraId));

    const todas = await selectQuery(
      `SELECT id, nome, "coberturaTotal" FROM transportadoras WHERE ativa = 'sim'`,
      [],
    );
    const atende = todas.filter(
      (t: any) => ids.includes(Number(t.id)) || Number(t.coberturaTotal) === 1,
    );

    expect(atende.some((t: any) => Number(t.id) === idTeste)).toBe(true);
  });

  it('desativa o alcance nacional e ela deixa de atender cidade sem cadastro', async () => {
    await mutationQuery('UPDATE transportadoras SET "coberturaTotal" = ? WHERE id = ?', [0, idTeste]);

    const todas = await selectQuery(
      `SELECT id, "coberturaTotal" FROM transportadoras WHERE ativa = 'sim'`,
      [],
    );
    const atende = todas.filter((t: any) => Number(t.coberturaTotal) === 1);
    expect(atende.some((t: any) => Number(t.id) === idTeste)).toBe(false);
  });
});
