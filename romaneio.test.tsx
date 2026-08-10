// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { montarRomaneioHtml, lerVolumes, transportadoraDefinida, type CotacaoRomaneio } from './romaneio';

const prontoParaEnvio: CotacaoRomaneio = {
  id: 991,
  osNumero: '6782',
  destinatarioNome: 'OBJETIVA CONSTRUCOES',
  destinatarioCnpj: '11.222.333/0001-44',
  cepDestino: '30110-002',
  municipio: 'BELO HORIZONTE',
  estado: 'MG',
  pesoKg: '42.0',
  quantidadeVolumes: 2,
  volumesJson: JSON.stringify([
    { largura: 60, comprimento: 90, altura: 40, peso: 21 },
    { largura: 60, comprimento: 90, altura: 40, peso: 21 },
  ]),
  modalidadeFrete: 'cif',
  osAprovacao: '13/07/2026',
  osEntrega: '21/08/2026',
  osVendedor: 'Letícia Carozzo',
  empacotadores: 'Maurício',
  solicitanteNome: 'Usuário Teste',
  observacoes: 'Carga frágil',
  opcoes: [
    { transportadoraNome: 'Braspress', valorFrete: '320.90', prazoDias: 3, tipoPrazo: 'uteis', selecionada: 'nao' },
    { transportadoraNome: 'Jadlog', valorFrete: '289.40', prazoDias: 5, tipoPrazo: 'uteis', selecionada: 'sim' },
  ],
};

describe('Romaneio de despacho para o motorista', () => {
  it('inclui todos os dados gerados na solicitação', () => {
    const html = montarRomaneioHtml([prontoParaEnvio]);

    expect(html).toContain('OS 6782');
    expect(html).toContain('OBJETIVA CONSTRUCOES');
    expect(html).toContain('11.222.333/0001-44');
    expect(html).toContain('30110-002');
    expect(html).toContain('BELO HORIZONTE/MG');
    expect(html).toContain('13/07/2026');
    expect(html).toContain('21/08/2026');
    expect(html).toContain('Letícia Carozzo');
    expect(html).toContain('Maurício');
    expect(html).toContain('Carga frágil');
    expect(html).toContain('CIF');
  });

  it('NÃO inclui fotografias na impressão', () => {
    const comFotos = {
      ...prontoParaEnvio,
      // mesmo que a cotação tenha fotos, elas não devem sair no romaneio
      fotosJson: JSON.stringify(['https://exemplo.com/foto1.jpg', 'https://exemplo.com/foto2.jpg']),
    } as any;
    const html = montarRomaneioHtml([comFotos]);

    expect(html).not.toContain('<img');
    expect(html).not.toContain('foto1.jpg');
    expect(html).not.toContain('Fotografias');
  });

  it('lista as dimensões e o peso de cada volume', () => {
    const html = montarRomaneioHtml([prontoParaEnvio]);
    expect(html).toContain('<td>60</td>');
    expect(html).toContain('<td>90</td>');
    expect(html).toContain('<td>40</td>');
    expect(html).toContain('21,00');
    expect(html).toContain('42,00 kg');
  });

  it('usa a transportadora marcada como selecionada', () => {
    const escolhida = transportadoraDefinida(prontoParaEnvio);
    expect(escolhida?.transportadoraNome).toBe('Jadlog');
    const html = montarRomaneioHtml([prontoParaEnvio]);
    expect(html).toContain('Jadlog');
    expect(html).toContain('R$');
    expect(html).toContain('5 dias úteis');
  });

  it('quando nenhuma está marcada, usa a de menor valor cotado', () => {
    const semMarcada = {
      ...prontoParaEnvio,
      opcoes: [
        { transportadoraNome: 'Correios', valorFrete: '350.00', prazoDias: 7, tipoPrazo: 'uteis', selecionada: 'nao' },
        { transportadoraNome: 'Andorinha', valorFrete: '150.50', prazoDias: 3, tipoPrazo: 'uteis', selecionada: 'nao' },
      ],
    };
    expect(transportadoraDefinida(semMarcada)?.transportadoraNome).toBe('Andorinha');
  });

  it('agrupa vários pedidos prontos em um único documento', () => {
    const html = montarRomaneioHtml([
      prontoParaEnvio,
      { ...prontoParaEnvio, id: 992, osNumero: '6790', destinatarioNome: 'IMG COMUNICACAO VISUAL' },
    ]);
    expect(html).toContain('OS 6782');
    expect(html).toContain('OS 6790');
    expect(html).toContain('aguardando envio: <strong>2</strong>');
  });

  it('cai para as dimensões soltas quando não há volumesJson', () => {
    const volumes = lerVolumes({
      id: 1,
      volumesJson: null,
      dimensoesLargura: '20',
      dimensoesComprimento: '30',
      dimensoesAltura: '10',
      pesoKg: '5',
    });
    expect(volumes).toHaveLength(1);
    expect(volumes[0]).toMatchObject({ largura: '20', comprimento: '30', altura: '10' });
  });

  it('lida com pedido sem transportadora e sem volumes sem quebrar', () => {
    const html = montarRomaneioHtml([{ id: 5, osNumero: '1234', opcoes: [] }]);
    expect(html).toContain('OS 1234');
    expect(html).toContain('Sem volumes informados');
  });
});
