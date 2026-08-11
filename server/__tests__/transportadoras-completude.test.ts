import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { selectQuery, mutationQuery } from '../db/db-connection';
import {
  resumoCompletude,
  listarPendentesPorCampo,
  atualizarCampoTransportadora,
  atualizarCampoEmLote,
  definirStatusTransportadora,
  panoramaCadastro,
  CAMPOS_COMPLETUDE,
} from '../utils/transportadoras-completude';

const NOME_TESTE = 'ZZZ VITEST COMPLETUDE';
let id = 0;
let idSecundario = 0;

describe('Completude de dados das transportadoras', () => {
  beforeAll(async () => {
    const res: any = await mutationQuery(
      `INSERT INTO transportadoras (nome, ativa, modais, "coberturaTotal") VALUES (?, 'sim', ?, 0) RETURNING id`,
      [NOME_TESTE, JSON.stringify(['rodoviario'])],
    );
    id = Number(res?.insertId ?? 0);
    expect(id).toBeGreaterThan(0);

    const res2: any = await mutationQuery(
      `INSERT INTO transportadoras (nome, ativa, modais, "coberturaTotal", endereco) VALUES (?, 'sim', ?, 0, ?) RETURNING id`,
      [`${NOME_TESTE} B`, JSON.stringify(['rodoviario']), 'Rua Preenchida, 10'],
    );
    idSecundario = Number(res2?.insertId ?? 0);
    expect(idSecundario).toBeGreaterThan(0);
  });

  afterAll(async () => {
    if (id) await mutationQuery('DELETE FROM transportadoras WHERE id = ?', [id]);
    if (idSecundario) await mutationQuery('DELETE FROM transportadoras WHERE id = ?', [idSecundario]);
  });

  it('resume os campos ausentes com percentuais e prioridades', async () => {
    const resumo = await resumoCompletude({ status: 'ativas' });
    expect(resumo.total).toBeGreaterThan(0);
    expect(resumo.grupos).toHaveLength(CAMPOS_COMPLETUDE.length);
    expect(resumo.percentualGeral).toBeGreaterThanOrEqual(0);
    expect(resumo.percentualGeral).toBeLessThanOrEqual(100);
    // Campos críticos precisam vir primeiro na ordenação
    expect(resumo.grupos[0].prioridade).toBe(1);
    for (const g of resumo.grupos) {
      expect(g.faltando + g.preenchidos).toBe(resumo.total);
    }
  });

  it('monitora os campos de endereço e documento pedidos pelo usuário', () => {
    const nomes = CAMPOS_COMPLETUDE.map(c => c.campo);
    for (const esperado of ['endereco', 'bairro', 'cep', 'cidade', 'uf', 'cnpj', 'telefoneContato']) {
      expect(nomes).toContain(esperado);
    }
  });

  it('retorna o panorama com status e origem fechando no total', async () => {
    const p = await panoramaCadastro();
    expect(p.total).toBeGreaterThan(0);
    expect(p.ativas + p.inativas).toBe(p.total);
    expect(p.frenet + p.manual).toBe(p.total);
  });

  it('lista a transportadora de teste entre os pendentes do campo nomeContato', async () => {
    const res = await listarPendentesPorCampo('nomeContato', NOME_TESTE, 1, 20, { status: 'ativas' });
    expect(res.data.some((t: any) => Number(t.id) === id)).toBe(true);
  });

  it('separa quem tem e quem não tem o dado no mesmo campo', async () => {
    const semDado = await listarPendentesPorCampo('endereco', NOME_TESTE, 1, 50, {
      status: 'todas',
      modo: 'vazios',
    });
    const idsSem = semDado.data.map((t: any) => Number(t.id));
    expect(idsSem).toContain(id);
    expect(idsSem).not.toContain(idSecundario);

    const comDado = await listarPendentesPorCampo('endereco', NOME_TESTE, 1, 50, {
      status: 'todas',
      modo: 'preenchidos',
    });
    const idsCom = comDado.data.map((t: any) => Number(t.id));
    expect(idsCom).toContain(idSecundario);
    expect(idsCom).not.toContain(id);

    const todos = await listarPendentesPorCampo('endereco', NOME_TESTE, 1, 50, {
      status: 'todas',
      modo: 'todos',
    });
    const idsTodos = todos.data.map((t: any) => Number(t.id));
    expect(idsTodos).toContain(id);
    expect(idsTodos).toContain(idSecundario);
  });

  it('filtra por status ativa/inativa após o toggle', async () => {
    await definirStatusTransportadora(idSecundario, false);

    const inativas = await listarPendentesPorCampo('endereco', NOME_TESTE, 1, 50, {
      status: 'inativas',
      modo: 'todos',
    });
    expect(inativas.data.map((t: any) => Number(t.id))).toContain(idSecundario);

    const ativas = await listarPendentesPorCampo('endereco', NOME_TESTE, 1, 50, {
      status: 'ativas',
      modo: 'todos',
    });
    expect(ativas.data.map((t: any) => Number(t.id))).not.toContain(idSecundario);

    await definirStatusTransportadora(idSecundario, true);
  });

  it('aplica o mesmo valor a várias transportadoras em lote', async () => {
    const r = await atualizarCampoEmLote([id, idSecundario], 'formaCotacao', 'whatsapp');
    expect(r.afetados).toBe(2);
    const rows = await selectQuery(
      'SELECT "formaCotacao" FROM transportadoras WHERE id IN (?, ?)',
      [id, idSecundario],
    );
    expect(rows.every((l: any) => l.formaCotacao === 'whatsapp')).toBe(true);
  });

  it('preenche o campo e o registro sai da lista de pendentes', async () => {
    await atualizarCampoTransportadora(id, 'nomeContato', 'Maria da Logística');

    const rows = await selectQuery('SELECT "nomeContato" FROM transportadoras WHERE id = ?', [id]);
    expect(rows[0].nomeContato).toBe('Maria da Logística');

    const depoisLista = await listarPendentesPorCampo('nomeContato', NOME_TESTE, 1, 20, { status: 'ativas' });
    expect(depoisLista.data.some((t: any) => Number(t.id) === id)).toBe(false);

    // O resumo passa a contabilizar o registro como preenchido
    const depois = await resumoCompletude({ status: 'ativas' });
    const grupo = depois.grupos.find(g => g.campo === 'nomeContato')!;
    expect(grupo.preenchidos).toBeGreaterThan(0);
    expect(grupo.faltando + grupo.preenchidos).toBe(depois.total);
  });

  it('trata string em branco como campo não preenchido', async () => {
    await atualizarCampoTransportadora(id, 'site', '   ');
    const res = await listarPendentesPorCampo('site', NOME_TESTE, 1, 20, { status: 'ativas' });
    expect(res.data.some((t: any) => Number(t.id) === id)).toBe(true);
  });

  it('rejeita campos fora da lista monitorada (proteção contra SQL injection)', async () => {
    await expect(atualizarCampoTransportadora(id, 'nome', 'HACK')).rejects.toThrow(/não editável/i);
    await expect(atualizarCampoEmLote([id], 'portalSenha', 'HACK')).rejects.toThrow(/não editável/i);
    await expect(
      listarPendentesPorCampo('id = 1; DROP TABLE', undefined, 1, 5, { modo: 'vazios' }),
    ).rejects.toThrow(/não monitorado/i);
  });
});
