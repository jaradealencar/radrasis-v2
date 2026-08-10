import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { selectQuery, mutationQuery } from './db-connection';
import { listarCotacoesFrete } from './db-helpers-select';
import { criarCotacaoFrete } from './db-helpers';

let cotacaoId = 0;
let cotacaoViaHelperId = 0;

describe('Kanban de frete — 5 estágios, CIF/FOB e fotos', () => {
  beforeAll(async () => {
    const res: any = await mutationQuery(
      `INSERT INTO cotacoes_frete (osNumero, destinatarioNome, destinatarioCnpj, cepDestino, municipio, estado, pesoKg, quantidadeVolumes, volumesJson, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'TEST-KB5', 'CLIENTE KANBAN VITEST', '00.000.000/0001-00', '16900-000',
        'ANDRADINA', 'SP', '12.5', 2,
        JSON.stringify([
          { largura: 30, comprimento: 40, altura: 20, peso: 5 },
          { largura: 50, comprimento: 60, altura: 25, peso: 7.5 },
        ]),
        'aberta',
      ],
    );
    cotacaoId = Number(res?.insertId ?? 0);
    expect(cotacaoId).toBeGreaterThan(0);
  });

  afterAll(async () => {
    if (cotacaoId) {
      await mutationQuery('DELETE FROM cotacao_opcoes WHERE cotacaoId = ?', [cotacaoId]);
      await mutationQuery('DELETE FROM cotacoes_frete WHERE id = ?', [cotacaoId]);
    }
    if (cotacaoViaHelperId) {
      await mutationQuery('DELETE FROM cotacao_opcoes WHERE cotacaoId = ?', [cotacaoViaHelperId]);
      await mutationQuery('DELETE FROM cotacoes_frete WHERE id = ?', [cotacaoViaHelperId]);
    }
  });

  it('aceita os 5 estágios do fluxo, incluindo o novo "selecao"', async () => {
    const fluxo = ['aberta', 'cotando', 'selecao', 'cotada', 'enviada'];
    for (const status of fluxo) {
      await mutationQuery('UPDATE cotacoes_frete SET status = ? WHERE id = ?', [status, cotacaoId]);
      const rows = await selectQuery('SELECT status FROM cotacoes_frete WHERE id = ?', [cotacaoId]);
      expect(rows[0].status).toBe(status);
    }
  });

  it('a listagem do Kanban devolve o card em qualquer estágio', async () => {
    for (const status of ['aberta', 'cotando', 'selecao', 'cotada', 'enviada']) {
      await mutationQuery('UPDATE cotacoes_frete SET status = ? WHERE id = ?', [status, cotacaoId]);
      const res = await listarCotacoesFrete(1, 100);
      const achado = res.data.find((c: any) => Number(c.id) === cotacaoId);
      expect(achado, `card deveria aparecer com status ${status}`).toBeTruthy();
      expect(achado.status).toBe(status);
    }
  });

  it('a listagem devolve os campos essenciais exigidos em todos os estágios', async () => {
    const res = await listarCotacoesFrete(1, 100);
    const card = res.data.find((c: any) => Number(c.id) === cotacaoId);
    expect(card.destinatarioNome).toBe('CLIENTE KANBAN VITEST');
    expect(card.cepDestino).toBe('16900-000');
    expect(card.municipio).toBe('ANDRADINA');
    expect(card.estado).toBe('SP');
    const vols = JSON.parse(card.volumesJson);
    expect(vols).toHaveLength(2);
    expect(vols[0]).toMatchObject({ largura: 30, comprimento: 40, altura: 20 });
    // Colunas novas precisam vir no SELECT (mesmo que nulas)
    expect(card).toHaveProperty('modalidadeFrete');
    expect(card).toHaveProperty('fotosJson');
  });

  it('grava e alterna a modalidade de frete entre CIF e FOB', async () => {
    for (const modalidade of ['cif', 'fob']) {
      await mutationQuery('UPDATE cotacoes_frete SET modalidadeFrete = ? WHERE id = ?', [modalidade, cotacaoId]);
      const rows = await selectQuery('SELECT modalidadeFrete FROM cotacoes_frete WHERE id = ?', [cotacaoId]);
      expect(rows[0].modalidadeFrete).toBe(modalidade);
    }
    await mutationQuery('UPDATE cotacoes_frete SET modalidadeFrete = NULL WHERE id = ?', [cotacaoId]);
    const rows = await selectQuery('SELECT modalidadeFrete FROM cotacoes_frete WHERE id = ?', [cotacaoId]);
    expect(rows[0].modalidadeFrete).toBeNull();
  });

  it('armazena e remove URLs de fotografias em fotosJson', async () => {
    const urls = ['/manus-storage/foto-a.jpg', '/manus-storage/foto-b.jpg'];
    await mutationQuery('UPDATE cotacoes_frete SET fotosJson = ? WHERE id = ?', [JSON.stringify(urls), cotacaoId]);
    let rows = await selectQuery('SELECT fotosJson FROM cotacoes_frete WHERE id = ?', [cotacaoId]);
    expect(JSON.parse(rows[0].fotosJson)).toEqual(urls);

    const restantes = urls.slice(1);
    await mutationQuery('UPDATE cotacoes_frete SET fotosJson = ? WHERE id = ?', [JSON.stringify(restantes), cotacaoId]);
    rows = await selectQuery('SELECT fotosJson FROM cotacoes_frete WHERE id = ?', [cotacaoId]);
    expect(JSON.parse(rows[0].fotosJson)).toEqual(restantes);
  });

  it('grava os dados próprios da OS (aprovação, entrega e vendedor) no INSERT', async () => {
    const res: any = await criarCotacaoFrete({
      osNumero: 'TEST-OS-DADOS',
      solicitanteNome: 'VITEST SOLICITANTE',
      destinatarioNome: 'CLIENTE DADOS OS',
      destinatarioCnpj: '11.111.111/0001-11',
      cepDestino: '16900-111',
      municipio: 'ANDRADINA',
      estado: 'SP',
      pesoKg: '3',
      quantidadeVolumes: 1,
      volumesJson: JSON.stringify([{ largura: 10, comprimento: 10, altura: 10, peso: 3 }]),
      osAprovacao: '2026-08-07',
      osEntrega: '2026-08-21',
      osVendedor: 'Letícia Carozzo',
    } as any);

    cotacaoViaHelperId = Number(res?.id ?? res?.insertId ?? 0);
    expect(cotacaoViaHelperId).toBeGreaterThan(0);

    const rows = await selectQuery(
      'SELECT osAprovacao, osEntrega, osVendedor FROM cotacoes_frete WHERE id = ?',
      [cotacaoViaHelperId],
    );
    expect(rows[0].osAprovacao).toBe('2026-08-07');
    expect(rows[0].osEntrega).toBe('2026-08-21');
    expect(rows[0].osVendedor).toBe('Letícia Carozzo');
  });

  it('a listagem do Kanban devolve aprovação, entrega e vendedor em todos os estágios', async () => {
    expect(cotacaoViaHelperId).toBeGreaterThan(0);
    for (const status of ['aberta', 'cotando', 'selecao', 'cotada', 'enviada']) {
      await mutationQuery('UPDATE cotacoes_frete SET status = ? WHERE id = ?', [status, cotacaoViaHelperId]);
      const res = await listarCotacoesFrete(1, 200);
      const card = res.data.find((c: any) => Number(c.id) === cotacaoViaHelperId);
      expect(card, `card deveria aparecer no estágio ${status}`).toBeTruthy();
      expect(card.osVendedor).toBe('Letícia Carozzo');
      expect(String(card.osAprovacao)).toContain('2026-08-07');
      expect(String(card.osEntrega)).toContain('2026-08-21');
    }
  });

  it('cada OS mantém seus próprios dados, sem herdar de outra solicitação', async () => {
    const rows = await selectQuery(
      'SELECT id, osVendedor FROM cotacoes_frete WHERE id IN (?, ?)',
      [cotacaoId, cotacaoViaHelperId],
    );
    const doPrimeiro = rows.find((r: any) => Number(r.id) === cotacaoId);
    const doSegundo = rows.find((r: any) => Number(r.id) === cotacaoViaHelperId);
    expect(doPrimeiro.osVendedor).toBeNull();
    expect(doSegundo.osVendedor).toBe('Letícia Carozzo');
  });
});
