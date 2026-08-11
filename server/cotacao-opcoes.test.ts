import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adicionarOpcaoFrete,
  listarOpcoesFrete,
  atualizarOpcaoFrete,
  removerOpcaoFrete,
  listarOpcoesPorCotacoes,
} from './db-helpers-select';
import { selectQuery, mutationQuery } from './db-connection';

// Cotação de teste criada e removida ao final
let cotacaoId = 0;

describe('cotacao_opcoes — helpers mysql2', () => {
  beforeAll(async () => {
    const res: any = await mutationQuery(
      `INSERT INTO cotacoes_frete ("osNumero", "destinatarioNome", municipio, estado, status)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
      ['TEST-OPC', 'CLIENTE TESTE VITEST', 'ANDRADINA', 'SP', 'cotando'],
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

  it('adiciona várias transportadoras sem erro de SQL', async () => {
    const nomes = ['Andorinha', 'Braspress', 'Gollog', 'KM Transportes'];
    for (const nome of nomes) {
      const r = await adicionarOpcaoFrete({ cotacaoId, transportadoraNome: nome, valorFrete: '0' });
      expect(r.id).toBeGreaterThan(0);
    }
    const opcoes = await listarOpcoesFrete(cotacaoId);
    expect(opcoes.length).toBe(nomes.length);
  });

  it('não duplica a mesma transportadora na mesma cotação', async () => {
    const r = await adicionarOpcaoFrete({ cotacaoId, transportadoraNome: 'Andorinha', valorFrete: '0' });
    expect(r.duplicada).toBe(true);
    const opcoes = await listarOpcoesFrete(cotacaoId);
    expect(opcoes.filter((o: any) => o.transportadoraNome === 'Andorinha').length).toBe(1);
  });

  it('atualiza valor e prazo de uma opção', async () => {
    const opcoes = await listarOpcoesFrete(cotacaoId);
    const alvo = opcoes[0];
    await atualizarOpcaoFrete(Number(alvo.id), { valorFrete: '150,50', prazoDias: 3, tipoPrazo: 'uteis' });
    const rows = await selectQuery('SELECT "valorFrete", "prazoDias", "tipoPrazo" FROM cotacao_opcoes WHERE id = ?', [alvo.id]);
    expect(Number(rows[0].valorFrete)).toBeCloseTo(150.5, 2);
    expect(Number(rows[0].prazoDias)).toBe(3);
    expect(rows[0].tipoPrazo).toBe('uteis');
  });

  it('lista opções de várias cotações de uma vez', async () => {
    const opcoes = await listarOpcoesPorCotacoes([cotacaoId]);
    expect(opcoes.length).toBeGreaterThan(0);
    expect(opcoes.every((o: any) => o.cotacaoId === cotacaoId)).toBe(true);
  });

  it('remove uma opção', async () => {
    const antes = await listarOpcoesFrete(cotacaoId);
    await removerOpcaoFrete(Number(antes[0].id));
    const depois = await listarOpcoesFrete(cotacaoId);
    expect(depois.length).toBe(antes.length - 1);
  });
});
