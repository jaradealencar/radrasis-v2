// @vitest-environment jsdom
/**
 * Gera o romaneio com os dados REAIS do banco (estágio "Pronto — Aguardando Envio")
 * e salva em /tmp/romaneio-real.html para inspeção visual.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { montarRomaneioHtml, type CotacaoRomaneio } from './romaneio';
import { selectQuery } from '../../../../server/db-connection';

describe('Romaneio com dados reais do banco', () => {
  it('gera o documento dos pedidos prontos para despacho', async () => {
    const cotacoes = await selectQuery(
      "SELECT * FROM cotacoes_frete WHERE status = 'cotada' ORDER BY id DESC LIMIT 10",
      [],
    );

    const pedidos: CotacaoRomaneio[] = [];
    for (const c of cotacoes) {
      const ops = await selectQuery(
        'SELECT transportadoraNome, valorFrete, prazoEntrega, selecionada FROM cotacao_opcoes WHERE cotacaoId = ?',
        [c.id],
      );
      pedidos.push({
        ...c,
        opcoes: ops.map((o: any) => ({
          transportadoraNome: o.transportadoraNome,
          valorFrete: o.valorFrete,
          prazoDias: Number(String(o.prazoEntrega ?? '').match(/\d+/)?.[0] ?? 0) || null,
          tipoPrazo: String(o.prazoEntrega ?? '').includes('corrido') ? 'corridos' : 'uteis',
          selecionada: Number(o.selecionada) === 1 ? 'sim' : 'nao',
        })),
      });
    }

    const html = montarRomaneioHtml(pedidos);
    fs.writeFileSync('/tmp/romaneio-real.html', html);

    expect(pedidos.length).toBeGreaterThan(0);
    // Nenhuma fotografia no documento do motorista
    expect(html).not.toContain('<img');
    console.log(`Romaneio gerado com ${pedidos.length} pedido(s) em /tmp/romaneio-real.html`);
  }, 30000);
});
