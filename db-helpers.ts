/**
 * Helpers de banco de dados com SQL puro
 * Usa prepared statements para segurança e performance
 */

import { mutationQuery, selectQuery } from './db-connection';

export interface CotacaoFreteData {
  solicitanteNome?: string;
  destinatarioNome: string;
  destinatarioCnpj?: string;
  cepDestino?: string;
  municipio: string;
  estado: string;
  dimensoesLargura?: number;
  dimensoesAltura?: number;
  dimensoesComprimento?: number;
  pesoKg?: number;
  observacoes?: string;
  osNumero?: string;
  quantidadeVolumes?: number;
  volumesJson?: string;
  empacotadores?: string;
  /** Dados próprios da OS consultada (cada OS tem os seus) */
  osAprovacao?: string;
  osEntrega?: string;
  osVendedor?: string;
}

export interface CotacaoFreteResult {
  success: boolean;
  id?: number;
  message?: string;
  error?: string;
}

/**
 * Criar nova cotação de frete usando SQL puro
 * Insere apenas os campos com valores, deixando o banco aplicar defaults
 */
export async function criarCotacaoFrete(
  dados: CotacaoFreteData
): Promise<CotacaoFreteResult> {
  try {
    console.log('📝 [CRIAR-COTACAO] Iniciando criação de cotação...');
    console.log('📝 [CRIAR-COTACAO] Dados:', dados);

    // SQL com prepared statement - insere apenas campos com valor
    // NOTA: tipoMaterial foi removido pois não existe na tabela real
    const sql = `
      INSERT INTO cotacoes_frete 
      (osNumero, solicitanteNome, destinatarioNome, destinatarioCnpj, cepDestino, 
       municipio, estado, dimensoesLargura, dimensoesAltura, 
       dimensoesComprimento, pesoKg, quantidadeVolumes, volumesJson, observacoes, empacotadores,
       osAprovacao, osEntrega, osVendedor, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Valores em ordem exata dos placeholders
    const values = [
      dados.osNumero || null,
      dados.solicitanteNome || null,
      dados.destinatarioNome,
      dados.destinatarioCnpj || null,
      dados.cepDestino || null,
      dados.municipio,
      dados.estado,
      dados.dimensoesLargura || null,
      dados.dimensoesAltura || null,
      dados.dimensoesComprimento || null,
      dados.pesoKg || null,
      dados.quantidadeVolumes || 1,
      dados.volumesJson || null,
      dados.observacoes || null,
      dados.empacotadores || null,
      dados.osAprovacao || null,
      dados.osEntrega || null,
      dados.osVendedor || null,
      'aberta' // Status padrão para novas cotações (enum real no banco: aberta, cotando, cotada, enviada)
    ];

    console.log('📝 [CRIAR-COTACAO] SQL:', sql);
    console.log('📝 [CRIAR-COTACAO] Valores:', values);

    // Executar INSERT
    const result = await mutationQuery(sql, values);

    const insertId = (result as any).insertId;

    console.log('✅ [CRIAR-COTACAO] Sucesso! ID:', insertId);

    return {
      success: true,
      id: insertId,
      message: `Cotação criada com sucesso! ID: ${insertId}`
    };
  } catch (error: any) {
    console.error('❌ [CRIAR-COTACAO] Erro:', error);
    return {
      success: false,
      error: error.message || 'Erro ao criar cotação'
    };
  }
}

/**
 * Buscar cotação por ID
 */
export async function buscarCotacaoPorId(id: number) {
  try {
    const sql = 'SELECT * FROM cotacoes_frete WHERE id = ?';
    const result = await selectQuery(sql, [id]);
    return result[0] || null;
  } catch (error: any) {
    console.error('❌ [BUSCAR-COTACAO] Erro:', error);
    return null;
  }
}

/**
 * Listar cotações com paginação
 */
export async function listarCotacoes(page: number = 1, pageSize: number = 15) {
  try {
    const offset = (page - 1) * pageSize;
    
    const sql = `
      SELECT id, solicitanteNome, destinatarioNome, municipio, estado, 
             pesoKg, status, createdAt 
      FROM cotacoes_frete 
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `;

    const result = await selectQuery(sql, [pageSize, offset]);
    return result;
  } catch (error: any) {
    console.error('❌ [LISTAR-COTACOES] Erro:', error);
    return [];
  }
}

/**
 * Contar total de cotações
 */
export async function contarCotacoes() {
  try {
    const sql = `
      SELECT COUNT(*) as total 
      FROM cotacoes_frete 
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `;

    const result = await selectQuery(sql, []);
    return result[0]?.total || 0;
  } catch (error: any) {
    console.error('❌ [CONTAR-COTACOES] Erro:', error);
    return 0;
  }
}

/**
 * Atualizar status de cotação
 */
export async function atualizarStatusCotacao(id: number, status: string) {
  try {
    const sql = 'UPDATE cotacoes_frete SET status = ? WHERE id = ?';
    const result = await mutationQuery(sql, [status, id]);
    return (result as any).affectedRows > 0;
  } catch (error: any) {
    console.error('❌ [ATUALIZAR-STATUS] Erro:', error);
    return false;
  }
}

export default {
  criarCotacaoFrete,
  buscarCotacaoPorId,
  listarCotacoes,
  contarCotacoes,
  atualizarStatusCotacao
};
