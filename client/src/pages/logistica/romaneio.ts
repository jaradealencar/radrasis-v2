/**
 * Monta o romaneio de despacho para o motorista.
 *
 * Regra do usuário: inclui TODAS as informações geradas na solicitação,
 * COM EXCEÇÃO das fotografias.
 */

export type VolumeRomaneio = {
  largura?: number | string | null;
  comprimento?: number | string | null;
  altura?: number | string | null;
  peso?: number | string | null;
};

export type OpcaoRomaneio = {
  transportadoraNome?: string | null;
  valorFrete?: string | number | null;
  prazoDias?: number | null;
  tipoPrazo?: string | null;
  selecionada?: string | null;
};

export type CotacaoRomaneio = {
  id: number;
  osNumero?: string | null;
  destinatarioNome?: string | null;
  destinatarioCnpj?: string | null;
  cepDestino?: string | null;
  municipio?: string | null;
  estado?: string | null;
  pesoKg?: string | null;
  quantidadeVolumes?: number | null;
  volumesJson?: string | null;
  dimensoesLargura?: string | null;
  dimensoesComprimento?: string | null;
  dimensoesAltura?: string | null;
  modalidadeFrete?: string | null;
  osAprovacao?: string | null;
  osEntrega?: string | null;
  osVendedor?: string | null;
  empacotadores?: string | null;
  solicitanteNome?: string | null;
  observacoes?: string | null;
  opcoes?: OpcaoRomaneio[];
};

export function lerVolumes(cotacao: CotacaoRomaneio): VolumeRomaneio[] {
  if (cotacao.volumesJson) {
    try {
      const parsed = JSON.parse(cotacao.volumesJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      /* volumesJson inválido: cai para as dimensões soltas */
    }
  }
  if (cotacao.dimensoesLargura || cotacao.dimensoesComprimento || cotacao.dimensoesAltura) {
    return [
      {
        largura: cotacao.dimensoesLargura,
        comprimento: cotacao.dimensoesComprimento,
        altura: cotacao.dimensoesAltura,
        peso: cotacao.pesoKg,
      },
    ];
  }
  return [];
}

/** Transportadora escolhida; se nenhuma foi marcada, usa a de menor valor cotado. */
export function transportadoraDefinida(cotacao: CotacaoRomaneio): OpcaoRomaneio | null {
  const opcoes = cotacao.opcoes ?? [];
  if (opcoes.length === 0) return null;
  const marcada = opcoes.find(o => o.selecionada === 'sim');
  if (marcada) return marcada;
  const comValor = opcoes.filter(o => Number(o.valorFrete ?? 0) > 0);
  if (comValor.length === 0) return opcoes[0];
  return comValor.reduce((a, b) => (Number(a.valorFrete) <= Number(b.valorFrete) ? a : b));
}

function moeda(valor?: string | number | null) {
  const n = Number(valor ?? 0);
  if (!n) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapar(texto?: string | null) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function prazoTexto(opcao: OpcaoRomaneio | null) {
  if (!opcao?.prazoDias) return '—';
  return `${opcao.prazoDias} dias ${opcao.tipoPrazo === 'corridos' ? 'corridos' : 'úteis'}`;
}

/**
 * Gera o HTML do romaneio. Nenhuma tag <img> é emitida: as fotografias são
 * deliberadamente omitidas da impressão do motorista.
 */
export function montarRomaneioHtml(cotacoes: CotacaoRomaneio[], geradoEm = new Date()): string {
  const dataHora = geradoEm.toLocaleString('pt-BR');

  const pedidos = cotacoes
    .map(c => {
      const volumes = lerVolumes(c);
      const escolhida = transportadoraDefinida(c);
      const pesoTotal = volumes.reduce((s, v) => s + (Number(v.peso) || 0), 0) || Number(c.pesoKg ?? 0);

      const linhasVolumes = volumes.length
        ? volumes
            .map(
              (v, i) => `<tr>
          <td>${i + 1}</td>
          <td>${Number(v.largura ?? 0) || '—'}</td>
          <td>${Number(v.comprimento ?? 0) || '—'}</td>
          <td>${Number(v.altura ?? 0) || '—'}</td>
          <td>${(Number(v.peso ?? 0) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>`,
            )
            .join('')
        : '<tr><td colspan="5">Sem volumes informados</td></tr>';

      return `<section class="pedido">
  <header>
    <h2>OS ${escapar(c.osNumero) || `#${c.id}`}</h2>
    <span class="modalidade">${(c.modalidadeFrete ?? 'cif').toUpperCase()}</span>
  </header>
  <table class="dados">
    <tr><th>Destinatário</th><td>${escapar(c.destinatarioNome) || '—'}</td><th>CNPJ</th><td>${escapar(c.destinatarioCnpj) || '—'}</td></tr>
    <tr><th>CEP</th><td>${escapar(c.cepDestino) || '—'}</td><th>Cidade/UF</th><td>${escapar(c.municipio) || '—'}/${escapar(c.estado) || '—'}</td></tr>
    <tr><th>Aprovação da OS</th><td>${escapar(c.osAprovacao) || '—'}</td><th>Entrega prevista</th><td>${escapar(c.osEntrega) || '—'}</td></tr>
    <tr><th>Vendedor</th><td>${escapar(c.osVendedor) || '—'}</td><th>Solicitante</th><td>${escapar(c.solicitanteNome) || '—'}</td></tr>
    <tr><th>Empacotadores</th><td>${escapar(c.empacotadores) || '—'}</td><th>Volumes</th><td>${volumes.length || Number(c.quantidadeVolumes ?? 0)} · ${pesoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td></tr>
    <tr><th>Transportadora</th><td>${escapar(escolhida?.transportadoraNome) || '—'}</td><th>Frete / Prazo</th><td>${moeda(escolhida?.valorFrete)} · ${prazoTexto(escolhida)}</td></tr>
  </table>
  <table class="volumes">
    <thead><tr><th>Vol.</th><th>Largura (cm)</th><th>Compr. (cm)</th><th>Altura (cm)</th><th>Peso (kg)</th></tr></thead>
    <tbody>${linhasVolumes}</tbody>
  </table>
  ${c.observacoes ? `<p class="obs"><strong>Observações:</strong> ${escapar(c.observacoes)}</p>` : ''}
  <p class="assinatura">Recebido por: ____________________________  Data: ____/____/______</p>
</section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Romaneio de Despacho — ${dataHora}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 16px; font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .cabecalho { border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 12px; }
  .cabecalho p { margin: 2px 0; color: #444; }
  .pedido { border: 1px solid #999; border-radius: 4px; padding: 8px 10px; margin-bottom: 12px; page-break-inside: avoid; }
  .pedido header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; margin-bottom: 6px; padding-bottom: 4px; }
  .pedido h2 { font-size: 14px; margin: 0; }
  .modalidade { font-size: 11px; font-weight: bold; border: 1px solid #111; border-radius: 3px; padding: 1px 6px; }
  table { width: 100%; border-collapse: collapse; }
  .dados th { text-align: left; width: 15%; color: #333; font-weight: bold; padding: 2px 4px; vertical-align: top; }
  .dados td { width: 35%; padding: 2px 4px; }
  .volumes { margin-top: 6px; }
  .volumes th, .volumes td { border: 1px solid #bbb; padding: 2px 4px; text-align: center; }
  .volumes th { background: #eee; }
  .obs { margin: 6px 0 0; }
  .assinatura { margin: 10px 0 0; color: #333; }
  @media print { body { margin: 8mm; } .pedido { page-break-inside: avoid; } }
</style>
</head>
<body>
  <div class="cabecalho">
    <h1>Romaneio de Despacho — Letreiros Express</h1>
    <p>Pedidos prontos aguardando envio: <strong>${cotacoes.length}</strong></p>
    <p>Emitido em ${dataHora}</p>
  </div>
  ${pedidos || '<p>Nenhum pedido pronto para despacho.</p>'}
</body>
</html>`;
}
