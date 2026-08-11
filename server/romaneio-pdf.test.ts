import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from './routers';
import { selectQuery, mutationQuery } from './db-connection';

/**
 * Valida que o endpoint romaneioPdf produz um PDF real (assinatura %PDF)
 * e que as fotografias não entram no documento do motorista.
 */
describe('Romaneio em PDF (endpoint romaneioPdf)', () => {
  let cotacaoId = 0;

  beforeAll(async () => {
    const res: any = await mutationQuery(
      `INSERT INTO cotacoes_frete
        ("osNumero", "destinatarioNome", "destinatarioCnpj", "cepDestino", municipio, estado,
         "dimensoesLargura", "dimensoesComprimento", "dimensoesAltura", "pesoKg", "quantidadeVolumes", "volumesJson",
         status, "modalidadeFrete", "osAprovacao", "osEntrega", "osVendedor", empacotadores, "solicitanteNome",
         observacoes, "fotosJson")
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
      [
        'PDF-TEST', 'CLIENTE PDF', '99.888.777/0001-66', '01310-100', 'SAO PAULO', 'SP',
        50, 70, 30, 18.5, 1,
        JSON.stringify([{ largura: 50, comprimento: 70, altura: 30, peso: 18.5 }]),
        'cotada', 'fob', '01/08/2026', '15/08/2026', 'Vendedor PDF', 'Maurício', 'Solicitante PDF',
        'Observação do romaneio', JSON.stringify(['https://exemplo.com/foto-secreta.jpg']),
      ],
    );
    cotacaoId = Number(res.insertId);

    await mutationQuery(
      `INSERT INTO cotacao_opcoes ("cotacaoId", "transportadoraId", "transportadoraNome", "valorFrete", "prazoDias", "tipoPrazo", selecionada)
       VALUES (?,?,?,?,?,?,?)`,
      [cotacaoId, 1, 'Braspress', 412.35, 4, 'uteis', 'sim'],
    );
  }, 30000);

  afterAll(async () => {
    if (cotacaoId) {
      await mutationQuery('DELETE FROM cotacao_opcoes WHERE "cotacaoId" = ?', [cotacaoId]);
      await mutationQuery('DELETE FROM cotacoes_frete WHERE id = ?', [cotacaoId]);
    }
  }, 30000);

  it('gera um arquivo PDF válido com os dados do pedido', async () => {
    const caller = appRouter.createCaller({ user: null } as any);
    const res = await caller.cotacoesFrete.romaneioPdf({ ids: [cotacaoId] });

    expect(res.totalPedidos).toBe(1);
    expect(res.fileName).toMatch(/^romaneio-\d{4}-\d{2}-\d{2}\.pdf$/);

    const buffer = Buffer.from(res.pdfBase64, 'base64');
    // Assinatura de arquivo PDF
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  }, 30000);

  it('não embute as fotografias no PDF', async () => {
    const caller = appRouter.createCaller({ user: null } as any);
    const res = await caller.cotacoesFrete.romaneioPdf({ ids: [cotacaoId] });
    const conteudo = Buffer.from(res.pdfBase64, 'base64').toString('latin1');

    expect(conteudo).not.toContain('foto-secreta');
    // Nenhum objeto de imagem no PDF
    expect(conteudo).not.toContain('/Subtype /Image');
  }, 30000);

  it('mantém o pedido no estágio Pronto — Aguardando Envio', async () => {
    const rows = await selectQuery('SELECT status FROM cotacoes_frete WHERE id = ?', [cotacaoId]);
    expect(rows[0].status).toBe('cotada');
  }, 30000);
});
