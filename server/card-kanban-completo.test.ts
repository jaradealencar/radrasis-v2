import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { selectQuery, mutationQuery } from './db-connection';
import { listarCotacoesFrete, normalizarOpcao, adicionarOpcaoFrete, atualizarOpcaoFrete } from './db-helpers-select';

/**
 * Garante os requisitos explícitos do card do Kanban:
 * - transportadoras selecionadas chegam ao frontend em TODOS os estágios;
 * - valor e dias úteis persistem em cotacao_opcoes;
 * - CEP, cidade, dimensões e volumes vêm na listagem.
 */
describe('Card do Kanban — dados completos em todos os estágios', () => {
  const OS_TESTE = 'TEST-CARD-9911';
  let cotacaoId = 0;

  beforeAll(async () => {
    const res: any = await mutationQuery(
      `INSERT INTO cotacoes_frete
         ("osNumero", "solicitanteNome", "destinatarioNome", "destinatarioCnpj", "cepDestino",
          municipio, estado, "pesoKg", "quantidadeVolumes", "volumesJson", status, "createdAt", "updatedAt")
       VALUES (?, 'Teste Vitest', 'DESTINATARIO TESTE', '00.000.000/0001-00', '01310-100',
               'SAO PAULO', 'SP', '25.5', 2,
               '[{"largura":40,"comprimento":60,"altura":30,"peso":12.5},{"largura":50,"comprimento":80,"altura":25,"peso":13}]',
               'aberta', NOW(), NOW()) RETURNING id`,
      [OS_TESTE],
    );
    cotacaoId = Number(res?.insertId ?? 0);
    expect(cotacaoId).toBeGreaterThan(0);
  });

  afterAll(async () => {
    if (cotacaoId) {
      await mutationQuery('DELETE FROM cotacao_opcoes WHERE "cotacaoId" = ?', [cotacaoId]);
      await mutationQuery('DELETE FROM cotacoes_frete WHERE id = ?', [cotacaoId]);
    }
  });

  it('traz as transportadoras adicionadas junto da listagem, e não uma lista vazia', async () => {
    await adicionarOpcaoFrete({ cotacaoId, transportadoraNome: 'Braspress Teste', valorFrete: '0', tipoPrazo: 'uteis' });
    await adicionarOpcaoFrete({ cotacaoId, transportadoraNome: 'Jadlog Teste', valorFrete: '0', tipoPrazo: 'uteis' });

    const { data } = await listarCotacoesFrete(1, 100);
    const card = data.find((c: any) => c.osNumero === OS_TESTE);
    expect(card).toBeDefined();
    expect(card.opcoes.length).toBe(2);
    const nomes = card.opcoes.map((o: any) => o.transportadoraNome);
    expect(nomes).toContain('Braspress Teste');
    expect(nomes).toContain('Jadlog Teste');
  });

  it('persiste valor em reais e dias úteis preenchidos no card', async () => {
    const opcoes = await selectQuery(
      'SELECT id FROM cotacao_opcoes WHERE "cotacaoId" = ? ORDER BY id ASC',
      [cotacaoId],
    );
    const alvo = Number(opcoes[0].id);

    await atualizarOpcaoFrete(alvo, { valorFrete: '150,50', prazoDias: 3, tipoPrazo: 'uteis' });

    const { data } = await listarCotacoesFrete(1, 100);
    const card = data.find((c: any) => c.osNumero === OS_TESTE);
    const opcao = card.opcoes.find((o: any) => o.id === alvo);
    expect(Number(opcao.valorFrete)).toBeCloseTo(150.5, 2);
    expect(opcao.prazoDias).toBe(3);
    expect(opcao.tipoPrazo).toBe('uteis');
  });

  it('mantém CEP, cidade, volumes e dimensões na listagem do Kanban', async () => {
    const { data } = await listarCotacoesFrete(1, 100);
    const card = data.find((c: any) => c.osNumero === OS_TESTE);
    expect(card.cepDestino).toBe('01310-100');
    expect(card.municipio).toBe('SAO PAULO');
    expect(card.estado).toBe('SP');
    expect(Number(card.quantidadeVolumes)).toBe(2);
    const vols = JSON.parse(card.volumesJson);
    expect(vols).toHaveLength(2);
    expect(vols[0]).toMatchObject({ largura: 40, comprimento: 60, altura: 30 });
  });

  it('expõe as opções em todos os 5 estágios do Kanban', async () => {
    for (const status of ['aberta', 'cotando', 'selecao', 'cotada', 'enviada']) {
      await mutationQuery('UPDATE cotacoes_frete SET status = ? WHERE id = ?', [status, cotacaoId]);
      const { data } = await listarCotacoesFrete(1, 100);
      const card = data.find((c: any) => c.osNumero === OS_TESTE);
      expect(card, `card ausente no estágio ${status}`).toBeDefined();
      expect(card.status).toBe(status);
      expect(card.opcoes.length, `opções ausentes no estágio ${status}`).toBe(2);
    }
  });

  it('normaliza prazo estruturado e flag de selecionada (enum) vindos do banco', () => {
    const uteis = normalizarOpcao({ id: 1, cotacaoId: 2, prazoDias: 5, tipoPrazo: 'uteis', valorFrete: '99.90', selecionada: 'sim' });
    expect(uteis.prazoDias).toBe(5);
    expect(uteis.tipoPrazo).toBe('uteis');
    expect(uteis.selecionada).toBe('sim');
    expect(uteis.prazoEntrega).toBe('5 dias úteis');

    const corridos = normalizarOpcao({ id: 2, cotacaoId: 2, prazoDias: 7, tipoPrazo: 'corridos', valorFrete: null, selecionada: 'nao' });
    expect(corridos.prazoDias).toBe(7);
    expect(corridos.tipoPrazo).toBe('corridos');
    expect(corridos.selecionada).toBe('nao');
    expect(corridos.valorFrete).toBe('0');
    expect(corridos.prazoEntrega).toBe('7 dias corridos');
  });
});

describe('Cache de OS e log de sincronização', () => {
  it('grava log de sincronização nas colunas reais de sync_logs', async () => {
    const { registrarLogSincronizacao, obterStatusSincronizacao } = await import('./scheduled-sync-os');
    await registrarLogSincronizacao({
      dataExecucao: new Date(),
      quantidadeOsImportadas: 7,
      status: 'SUCESSO',
    });
    const status = await obterStatusSincronizacao();
    expect(status).not.toBeNull();
    expect(status!.status).toBe('SUCESSO');
    expect(Number(status!.totalOsEmCache)).toBeGreaterThan(0);
  });

  it('cache de OS usa a coluna vendedor (e não nomeVendedor)', async () => {
    const colunas = await selectQuery('DESCRIBE erp_os_cache', []);
    const nomes = colunas.map((c: any) => c.Field);
    expect(nomes).toContain('vendedor');
    expect(nomes).toContain('dataAprovacao');
    expect(nomes).not.toContain('nomeVendedor');
  });

  it('cache tem OS com aprovação e vendedor preenchidos pela sincronização', async () => {
    const rows = await selectQuery(
      `SELECT COUNT(*) AS comDados FROM erp_os_cache
       WHERE dataAprovacao IS NOT NULL AND dataAprovacao <> ''
         AND vendedor IS NOT NULL AND vendedor <> ''`,
      [],
    );
    expect(Number(rows[0].comDados)).toBeGreaterThan(0);
  });
});
