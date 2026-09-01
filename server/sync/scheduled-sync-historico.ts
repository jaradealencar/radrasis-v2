/**
 * Sincronização de `historico_os` / `historico_orcamentos` a partir da API MubiSys.
 *
 * Diferente de `scheduled-sync-os.ts` (que mantém `erp_os_cache`, uma janela
 * rolante curta e "quente"), este sync grava na base histórica permanente
 * usada pela regra de "cliente novo/reativado/recorrente" (ver
 * `isClienteNovoPorRecencia` em `../routers/performanceComercial.ts`) e por
 * todos os relatórios comerciais que dependem de `historico_os`/
 * `historico_orcamentos`. Por isso é bucketizado por mês-calendário (mes/ano),
 * não por janela de dias, e faz upsert por `osNumero`/`orcNumero` (índice
 * único criado na migration 0012) — rodar duas vezes para o mesmo mês nunca
 * duplica linha, só atualiza (útil pro mês corrente, que muda todo dia, e
 * pro mês fechado, cujo faturamento/status ainda pode mudar por alguns dias).
 *
 * Gravação em lotes (INSERT multi-linha), não um INSERT por OS: um mês cheio
 * tem ~200-800 OS e ~500-800 orçamentos, e um loop de round-trips individuais
 * facilmente estoura o `maxDuration` de 60s da Vercel — mesmo problema já
 * documentado em docs/cron-qstash.md para `erp_os_cache`.
 *
 * Mapeamento de custo é best-effort: a API MubiSys não expõe "mão de obra" e
 * "tarifas financeiras" como campos próprios (usamos valor_processos_realizados
 * e 0, respectivamente) nem uma "contribuição" distinta do resultado — por
 * isso contribuicaoReais/Pct espelham resultadoReais/Pct. Isso é suficiente
 * pra faturamento, ticket médio e a regra de novo/reativado/recorrente
 * (que só dependem de empresa + data + valor), mas não deve ser tratado como
 * DRE granular linha a linha.
 */

import { getPool } from '../db/db-connection';
import { listarOSMubiSys, listarOrcamentosMubiSys, type MubiSysOS, type MubiSysOrcamento } from '../integrations/mubisys-client';

export interface SincronizarHistoricoResultado {
  mes: number;
  ano: number;
  osProcessadas: number;
  orcamentosProcessados: number;
  status: 'SUCESSO' | 'ERRO';
  mensagemErro?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function nomeCliente(clienteRaw: unknown): string {
  if (typeof clienteRaw === 'object' && clienteRaw !== null) {
    return String((clienteRaw as any)?.nome ?? (clienteRaw as any)?.razao_social ?? '');
  }
  return String(clienteRaw ?? '');
}

function primeiroEndereco(os: MubiSysOS): { cidade: string; estado: string } {
  const e = (os as any).cliente_endereco?.[0];
  return { cidade: e?.cidade ?? '', estado: e?.estado ?? '' };
}

const HISTORICO_OS_COLS = [
  'osNumero', 'tipoOs', 'empresa', 'trabalho', 'logistica', 'dataAprovacao', 'dataEntrega', 'dataFaturamento',
  'status', 'vendedor', 'valorTotal', 'descontos', 'valorOs', 'materiaPrima', 'custoFixo', 'maoDeObra',
  'tarifasFinanceiras', 'comissoesInternas', 'comissoesExternas', 'terceirizados', 'tributos', 'custosTotal',
  'resultadoReais', 'resultadoPct', 'contribuicaoReais', 'contribuicaoPct', 'cidade', 'estado', 'mes', 'ano',
];

const HISTORICO_ORC_COLS = [
  'orcNumero', 'empresa', 'trabalho', 'dataCadastro', 'validade', 'vendedor', 'status', 'motivoCancelamento',
  'total', 'custosTotal', 'margemLiquida', 'mes', 'ano',
];

function osParaLinha(os: MubiSysOS, mes: number, ano: number): Record<string, unknown> {
  const valorTotal = Number((os as any).valor_total) || 0;
  const valorDesconto = Number((os as any).valor_desconto) || 0;
  const valorCusto = Number((os as any).valor_custo) || 0;
  const valorMargem = Number((os as any).valor_margem) || 0;
  const resultadoPct = valorTotal > 0 ? (valorMargem / valorTotal) * 100 : 0;
  const { cidade, estado } = primeiroEndereco(os);

  return {
    osNumero: String(os.sequencial_ordem || os.numero_pedido_compra || os.id || ''),
    tipoOs: os.tipo ?? '',
    empresa: nomeCliente(os.cliente),
    trabalho: os.nome_trabalho ?? null,
    logistica: (os as any).logistica ?? null,
    dataAprovacao: os.data_aprovacao ?? null,
    dataEntrega: os.data_entrega ?? null,
    dataFaturamento: (os as any).data_faturamento ?? null,
    status: os.status ?? null,
    vendedor: os.vendedor || os.atendente || null,
    valorTotal: valorTotal.toFixed(2),
    descontos: valorDesconto.toFixed(2),
    valorOs: (valorTotal - valorDesconto).toFixed(2),
    materiaPrima: (Number((os as any).valor_materia_prima) || 0).toFixed(2),
    custoFixo: (Number((os as any).valor_fixo_rateado) || 0).toFixed(2),
    maoDeObra: (Number((os as any).valor_processos_realizados) || 0).toFixed(2),
    tarifasFinanceiras: '0.00',
    comissoesInternas: (Number((os as any).valor_comissao_interna) || 0).toFixed(2),
    comissoesExternas: (Number((os as any).valor_comissao_externa) || 0).toFixed(2),
    terceirizados: (Number((os as any).valor_terceiros) || 0).toFixed(2),
    tributos: (Number((os as any).valor_tributos) || 0).toFixed(2),
    custosTotal: valorCusto.toFixed(2),
    resultadoReais: valorMargem.toFixed(2),
    resultadoPct: resultadoPct.toFixed(2),
    contribuicaoReais: valorMargem.toFixed(2),
    contribuicaoPct: resultadoPct.toFixed(2),
    cidade,
    estado: estado ? String(estado).slice(0, 2) : null,
    mes,
    ano,
  };
}

function orcParaLinha(orc: MubiSysOrcamento, mes: number, ano: number): Record<string, unknown> {
  return {
    orcNumero: String(orc.sequencial_orcamento || orc.id || ''),
    empresa: nomeCliente(orc.cliente),
    trabalho: orc.nome_trabalho ?? null,
    dataCadastro: orc.data_cadastro ?? null,
    validade: (orc as any).validade != null ? String((orc as any).validade) : null,
    vendedor: orc.vendedor ?? null,
    status: orc.status ?? null,
    motivoCancelamento: (orc as any).motivo_cancelamento ?? null,
    total: (Number(orc.valor_total) || 0).toFixed(2),
    custosTotal: (Number((orc as any).valor_custo) || 0).toFixed(2),
    margemLiquida: (Number((orc as any).valor_margem) || 0).toFixed(2),
    mes,
    ano,
  };
}

/** Upsert em lotes por `INSERT ... ON CONFLICT DO UPDATE` — ver nota de topo sobre maxDuration. */
async function upsertEmLotes(table: string, cols: string[], linhas: Record<string, unknown>[], conflictCol: string, batchSize = 150) {
  if (linhas.length === 0) return 0;
  const pool = getPool();
  const colList = cols.map(c => `"${c}"`).join(', ');
  const updateSet = cols.filter(c => c !== conflictCol).map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

  let processadas = 0;
  for (let i = 0; i < linhas.length; i += batchSize) {
    const lote = linhas.slice(i, i + batchSize);
    const values: unknown[] = [];
    const tuplas = lote.map((linha, r) => {
      const base = r * cols.length;
      values.push(...cols.map(c => linha[c] ?? null));
      return '(' + cols.map((_, ci) => `$${base + ci + 1}`).join(', ') + ')';
    });
    const sql = `INSERT INTO ${table} (${colList}) VALUES ${tuplas.join(', ')}
      ON CONFLICT ("${conflictCol}") DO UPDATE SET ${updateSet}`;
    await pool.query(sql, values as any[]);
    processadas += lote.length;
  }
  return processadas;
}

/**
 * Sincroniza um único mês-calendário (mes/ano) de `historico_os` +
 * `historico_orcamentos` a partir da API MubiSys ao vivo.
 */
export async function sincronizarHistoricoDoMubiSys(mes: number, ano: number): Promise<SincronizarHistoricoResultado> {
  const lastDay = new Date(ano, mes, 0).getDate();
  const di = `${ano}-${pad(mes)}-01`;
  const df = `${ano}-${pad(mes)}-${pad(lastDay)}`;

  try {
    console.log(`🔄 [SYNC-HISTORICO] Sincronizando ${pad(mes)}/${ano} (${di}..${df})`);

    const [osResult, orcResult] = await Promise.all([
      listarOSMubiSys({ status: 'TODOS', filtrodata: 'APROVACAO', datainicial: di, datafinal: df }),
      listarOrcamentosMubiSys({ status: 'TODOS', datainicial: di, datafinal: df }),
    ]);

    if (!osResult.completo) console.warn(`⚠️ [SYNC-HISTORICO] Listagem de OS incompleta para ${mes}/${ano} — teto de páginas atingido`);
    if (!orcResult.completo) console.warn(`⚠️ [SYNC-HISTORICO] Listagem de orçamentos incompleta para ${mes}/${ano} — teto de páginas atingido`);

    const linhasOs = osResult.itens
      .map(os => osParaLinha(os, mes, ano))
      .filter(l => l.osNumero);
    const linhasOrc = orcResult.itens
      .map(orc => orcParaLinha(orc, mes, ano))
      .filter(l => l.orcNumero);

    const osProcessadas = await upsertEmLotes('historico_os', HISTORICO_OS_COLS, linhasOs, 'osNumero');
    const orcamentosProcessados = await upsertEmLotes('historico_orcamentos', HISTORICO_ORC_COLS, linhasOrc, 'orcNumero');

    console.log(`✅ [SYNC-HISTORICO] ${pad(mes)}/${ano}: ${osProcessadas} OS, ${orcamentosProcessados} orçamentos`);

    return { mes, ano, osProcessadas, orcamentosProcessados, status: 'SUCESSO' };
  } catch (erro: any) {
    console.error(`❌ [SYNC-HISTORICO] Erro ao sincronizar ${mes}/${ano}:`, erro);
    return { mes, ano, osProcessadas: 0, orcamentosProcessados: 0, status: 'ERRO', mensagemErro: erro?.message || 'Erro desconhecido' };
  }
}

/** Sincroniza o mês corrente e os `mesesAtras` meses anteriores (padrão: mês
 * corrente + anterior, para capturar OS aprovadas no fim do mês passado que
 * só viram faturamento/status atualizado depois de virar o mês). */
export async function sincronizarHistoricoRecente(mesesAtras = 1): Promise<SincronizarHistoricoResultado[]> {
  const hoje = new Date();
  const resultados: SincronizarHistoricoResultado[] = [];
  for (let i = 0; i <= mesesAtras; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    resultados.push(await sincronizarHistoricoDoMubiSys(d.getMonth() + 1, d.getFullYear()));
  }
  return resultados;
}
