import { selectQuery, mutationQuery } from './db-connection';

/**
 * Helper para SELECT do Kanban usando mysql2 direto (SQL puro).
 * Retorna apenas colunas que realmente existem na tabela cotacoes_frete.
 */
export async function listarCotacoesFrete(
  page: number = 1,
  pageSize: number = 15,
  status?: string,
) {
  const safePageSize = Math.max(1, Math.min(Number(pageSize) || 15, 100));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safePageSize;

  const whereClause = status ? 'WHERE status = ?' : '';
  const baseParams: any[] = status ? [status] : [];

    const rows = await selectQuery(
    `SELECT
       id,
       osNumero,
       solicitanteId,
       solicitanteNome,
       destinatarioNome,
       destinatarioCnpj,
       cepDestino,
       municipio,
       estado,
       dimensoesLargura,
       dimensoesAltura,
       dimensoesComprimento,
       pesoKg,
       quantidadeVolumes,
       volumesJson,
       fotosJson,
       modalidadeFrete,
       empacotadores,
       osAprovacao,
       osEntrega,
       osVendedor,
       valorNf,
       observacoes,
       observacaoGol,
       fotoUrl,
       empacotamentoId,
       status,
       createdAt,
       updatedAt
     FROM cotacoes_frete
     ${whereClause}
     ORDER BY createdAt DESC
     LIMIT ${safePageSize} OFFSET ${offset}`,
    baseParams,
  );

  const countRows = await selectQuery(
    `SELECT COUNT(*) AS total FROM cotacoes_frete ${whereClause}`,
    baseParams,
  );

  const total = Number(countRows?.[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  console.log(
    `✅ [SELECT Kanban] ${rows.length} registros (página ${safePage}/${totalPages}, status=${status ?? 'todos'})`,
  );

  // As opções de frete precisam vir junto: o card exibe as transportadoras
  // selecionadas com valor e dias úteis em TODOS os estágios. Antes isso vinha
  // como [] e o card nunca mostrava nada, mesmo com registros no banco.
  const ids = rows.map((r: any) => Number(r.id));
  const opcoes = await listarOpcoesPorCotacoes(ids);
  const porCotacao = new Map<number, any[]>();
  for (const op of opcoes as any[]) {
    const chave = Number(op.cotacaoId);
    if (!porCotacao.has(chave)) porCotacao.set(chave, []);
    porCotacao.get(chave)!.push(normalizarOpcao(op));
  }
  console.log(`✅ [SELECT Kanban] ${opcoes.length} opção(ões) de frete carregada(s) para ${ids.length} cotação(ões)`);

  return {
    data: rows.map((row: any) => ({ ...row, opcoes: porCotacao.get(Number(row.id)) ?? [] })),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Converte a linha crua de cotacao_opcoes para o formato que o frontend espera:
 * prazoEntrega (texto) → prazoDias + tipoPrazo, selecionada (0/1) → "sim"/"nao".
 */
export function normalizarOpcao(op: any) {
  const textoPrazo = String(op.prazoEntrega ?? '');
  const casado = textoPrazo.match(/(\d+)/);
  const prazoDias = casado ? Number(casado[1]) : null;
  const tipoPrazo = /corrido/i.test(textoPrazo) ? 'corridos' : 'uteis';
  const selecionada =
    op.selecionada === 1 || op.selecionada === '1' || op.selecionada === 'sim' ? 'sim' : 'nao';
  return {
    id: Number(op.id),
    cotacaoId: Number(op.cotacaoId),
    transportadoraId: op.transportadoraId ?? null,
    transportadoraNome: op.transportadoraNome ?? null,
    valorFrete: op.valorFrete == null ? '0' : String(op.valorFrete),
    prazoDias,
    tipoPrazo,
    prazoEntrega: op.prazoEntrega ?? null,
    observacoes: op.observacoes ?? null,
    selecionada,
    createdAt: op.createdAt ?? null,
  };
}

/**
 * Buscar uma cotação específica com todas as colunas reais.
 */
export async function obterCotacaoDetalhes(id: number) {
  const rows = await selectQuery('SELECT * FROM cotacoes_frete WHERE id = ?', [id]);
  const cotacao = rows?.[0];
  if (!cotacao) {
    throw new Error(`Cotação #${id} não encontrada`);
  }
  return cotacao;
}

/**
 * Excluir uma cotação e seus registros dependentes (opções e comentários).
 * Usa SQL puro para não depender do mapeamento de colunas do Drizzle.
 */
export async function excluirCotacaoFrete(id: number) {
  await mutationQuery('DELETE FROM cotacao_opcoes WHERE cotacaoId = ?', [id]);
  await mutationQuery('DELETE FROM cotacao_comentarios WHERE cotacaoId = ?', [id]);
  const result: any = await mutationQuery('DELETE FROM cotacoes_frete WHERE id = ?', [id]);
  const afetados = Number(result?.affectedRows ?? 0);
  console.log(`🗑️ [DELETE] Cotação #${id} removida (${afetados} registro(s))`);
  return { id, afetados };
}

/**
 * Excluir TODAS as cotações de um determinado status (padrão: 'aberta').
 * Usado para limpar cards de teste do Kanban.
 */
export async function excluirCotacoesPorStatus(status: string = 'aberta') {
  const ids = await selectQuery('SELECT id FROM cotacoes_frete WHERE status = ?', [status]);

  for (const row of ids) {
    await mutationQuery('DELETE FROM cotacao_opcoes WHERE cotacaoId = ?', [row.id]);
    await mutationQuery('DELETE FROM cotacao_comentarios WHERE cotacaoId = ?', [row.id]);
  }

  const result: any = await mutationQuery('DELETE FROM cotacoes_frete WHERE status = ?', [status]);
  const afetados = Number(result?.affectedRows ?? 0);
  console.log(`🗑️ [DELETE EM MASSA] ${afetados} cotação(ões) com status='${status}' removidas`);
  return { afetados };
}

// ─── OPÇÕES DE FRETE (cotacao_opcoes) ────────────────────────────────────────
// Colunas REAIS da tabela: id, cotacaoId, transportadoraId, transportadoraNome,
// prazoEntrega (varchar), valorFrete (decimal), observacoes (text),
// selecionada (tinyint 0/1), createdAt.
// O schema do Drizzle declara colunas inexistentes (modal, prazoDias, tipoPrazo),
// por isso todas as operações abaixo usam mysql2 direto.

export interface OpcaoFreteInput {
  cotacaoId: number;
  transportadoraId?: number | null;
  transportadoraNome: string;
  valorFrete?: string | number | null;
  prazoDias?: number | null;
  tipoPrazo?: string | null;
  observacoes?: string | null;
}

/** Monta o texto de prazoEntrega a partir de dias + tipo (úteis/corridos). */
function montarPrazoEntrega(prazoDias?: number | null, tipoPrazo?: string | null) {
  if (prazoDias == null || Number.isNaN(Number(prazoDias))) return null;
  const tipo = tipoPrazo === 'corridos' ? 'corridos' : 'úteis';
  return `${Number(prazoDias)} dias ${tipo}`;
}

/** Insere uma opção de frete evitando duplicar a mesma transportadora na cotação. */
export async function adicionarOpcaoFrete(input: OpcaoFreteInput) {
  const valor =
    input.valorFrete == null || input.valorFrete === ''
      ? null
      : Number(String(input.valorFrete).replace(',', '.'));

  // Evita duplicidade da mesma transportadora na mesma cotação
  const existentes = await selectQuery(
    'SELECT id FROM cotacao_opcoes WHERE cotacaoId = ? AND transportadoraNome = ? LIMIT 1',
    [input.cotacaoId, input.transportadoraNome],
  );
  if (existentes.length > 0) {
    console.log(`ℹ️ [OPCAO] ${input.transportadoraNome} já existe na cotação #${input.cotacaoId}`);
    return { id: Number(existentes[0].id), duplicada: true };
  }

  const result: any = await mutationQuery(
    `INSERT INTO cotacao_opcoes
       (cotacaoId, transportadoraId, transportadoraNome, prazoEntrega, valorFrete, observacoes, selecionada)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [
      input.cotacaoId,
      input.transportadoraId ?? null,
      input.transportadoraNome,
      montarPrazoEntrega(input.prazoDias, input.tipoPrazo),
      valor,
      input.observacoes ?? null,
    ],
  );

  const id = Number(result?.insertId ?? 0);
  console.log(`✅ [OPCAO] ${input.transportadoraNome} adicionada à cotação #${input.cotacaoId} (id ${id})`);
  return { id, duplicada: false };
}

/** Lista as opções de frete de uma cotação. */
export async function listarOpcoesFrete(cotacaoId: number) {
  const rows = await selectQuery(
    `SELECT id, cotacaoId, transportadoraId, transportadoraNome,
            prazoEntrega, valorFrete, observacoes, selecionada, createdAt
     FROM cotacao_opcoes
     WHERE cotacaoId = ?
     ORDER BY id ASC`,
    [cotacaoId],
  );
  return rows;
}

/** Lista as opções de várias cotações de uma vez (para o Kanban). */
export async function listarOpcoesPorCotacoes(ids: number[]) {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  return await selectQuery(
    `SELECT id, cotacaoId, transportadoraId, transportadoraNome,
            prazoEntrega, valorFrete, observacoes, selecionada, createdAt
     FROM cotacao_opcoes
     WHERE cotacaoId IN (${placeholders})
     ORDER BY id ASC`,
    ids,
  );
}

/** Atualiza valor e/ou prazo de uma opção de frete. */
export async function atualizarOpcaoFrete(
  opcaoId: number,
  dados: { valorFrete?: string | number | null; prazoDias?: number | null; tipoPrazo?: string | null; observacoes?: string | null },
) {
  const sets: string[] = [];
  const params: any[] = [];

  if (dados.valorFrete !== undefined) {
    const valor =
      dados.valorFrete == null || dados.valorFrete === ''
        ? null
        : Number(String(dados.valorFrete).replace(',', '.'));
    sets.push('valorFrete = ?');
    params.push(valor);
  }
  if (dados.prazoDias !== undefined) {
    sets.push('prazoEntrega = ?');
    params.push(montarPrazoEntrega(dados.prazoDias, dados.tipoPrazo));
  }
  if (dados.observacoes !== undefined) {
    sets.push('observacoes = ?');
    params.push(dados.observacoes ?? null);
  }
  if (sets.length === 0) return { afetados: 0 };

  params.push(opcaoId);
  const result: any = await mutationQuery(
    `UPDATE cotacao_opcoes SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
  return { afetados: Number(result?.affectedRows ?? 0) };
}

/** Remove uma opção de frete. */
export async function removerOpcaoFrete(opcaoId: number) {
  const result: any = await mutationQuery('DELETE FROM cotacao_opcoes WHERE id = ?', [opcaoId]);
  return { afetados: Number(result?.affectedRows ?? 0) };
}

/** Marca uma opção como selecionada e move a cotação para 'enviada'. */
export async function selecionarOpcaoFrete(cotacaoId: number, opcaoId: number) {
  await mutationQuery('UPDATE cotacao_opcoes SET selecionada = 0 WHERE cotacaoId = ?', [cotacaoId]);
  await mutationQuery('UPDATE cotacao_opcoes SET selecionada = 1 WHERE id = ?', [opcaoId]);

  const rows = await selectQuery('SELECT transportadoraId FROM cotacao_opcoes WHERE id = ?', [opcaoId]);
  const transportadoraId = rows?.[0]?.transportadoraId ?? null;

  await mutationQuery(
    'UPDATE cotacoes_frete SET status = ?, transportadoraSelecionadaId = ?, updatedAt = NOW() WHERE id = ?',
    ['enviada', transportadoraId, cotacaoId],
  );

  console.log(`✅ [OPCAO] Opção #${opcaoId} selecionada para cotação #${cotacaoId}`);
  return { ok: true, transportadoraId };
}
