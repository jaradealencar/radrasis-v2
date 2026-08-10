/**
 * Handler para sincronização diária de OS do MubiSys
 * Executa via CRON job e atualiza o cache local (erp_os_cache)
 * 
 * Busca todas as OS dos últimos 30 dias e atualiza:
 * - numeroOs, razaoSocial, cnpj, email, cep, municipio, estado
 * - dataAprovacao, dataEntregaPrevista, vendedor
 *
 * ⚠️ Colunas REAIS da tabela erp_os_cache (validado com DESCRIBE):
 *    vendedor (varchar 128) — NÃO existe nomeVendedor
 *    dataAprovacao (varchar 64) — texto livre, não date
 */

import { selectQuery, mutationQuery } from './db-connection';
import { listarOSMubiSys, MubiSysListResponse, MubiSysOS } from './mubisys-client';

export interface SyncLogEntry {
  dataExecucao: Date;
  quantidadeOsImportadas: number;
  status: 'SUCESSO' | 'ERRO';
  mensagemErro?: string;
}

/**
 * Sincroniza OS do MubiSys para o cache local
 * Busca apenas OS dos últimos 30 dias para economizar tempo
 */
export async function sincronizarOSDoMubiSys(): Promise<SyncLogEntry> {
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - 30);
  
  console.log(`🔄 [SYNC-OS] Iniciando sincronização de OS dos últimos 30 dias...`);
  console.log(`📅 [SYNC-OS] Data de início: ${dataInicio.toISOString()}`);

  try {
    // 1. Buscar todas as OS do MubiSys
    console.log(`📡 [SYNC-OS] Buscando OS da API MubiSys...`);
    const response = await listarOSMubiSys({ datainicial: dataInicio.toISOString().split('T')[0], datafinal: new Date().toISOString().split('T')[0] });
    const osLista = response?.data || [];
    
    if (!osLista || osLista.length === 0) {
      console.warn(`⚠️ [SYNC-OS] API retornou lista vazia`);
      return {
        dataExecucao: new Date(),
        quantidadeOsImportadas: 0,
        status: 'SUCESSO',
        mensagemErro: 'API retornou lista vazia',
      };
    }

    console.log(`✅ [SYNC-OS] Recebidas ${osLista.length} OS da API`);

    // 2. Filtrar apenas OS dos últimos 30 dias
    const osRecentes = osLista.filter((os: any) => {
      const dataEmissao = new Date(os.data_cadastro || os.dataEmissao || '');
      return dataEmissao >= dataInicio;
    });

    console.log(`📊 [SYNC-OS] Filtrando: ${osRecentes.length} OS nos últimos 30 dias`);

    // 3. Inserir/atualizar no cache local
    let quantidadeInserida = 0;
    let quantidadeAtualizada = 0;

    for (const os of osRecentes as MubiSysOS[]) {
      try {
        const numeroOs = String(os.sequencial_ordem || os.numero_pedido_compra || os.id || '').trim();
        if (!numeroOs) {
          console.warn(`⚠️ [SYNC-OS] OS sem número identificável, pulando...`);
          continue;
        }

        // Extrair primeiro endereço
        const endereco = os.cliente_endereco?.[0];
        const cep = endereco?.cep || '';
        const municipio = endereco?.cidade || '';
        const estado = endereco?.estado || '';

        // Verificar se já existe no cache
        const existente = await selectQuery(
          'SELECT id FROM erp_os_cache WHERE numeroOs = ?',
          [numeroOs]
        );

        const dataAprovacao = os.data_aprovacao || null;
        const dataEntrega = normalizarData(os.data_entrega || os.prazo || null);
        const vendedor = os.vendedor || os.atendente || '';

        if (existente && existente.length > 0) {
          // Atualizar
          await mutationQuery(
            `UPDATE erp_os_cache SET 
              razaoSocial = ?, cnpj = ?, email = ?, cep = ?, 
              municipio = ?, estado = ?, endereco = ?,
              dataAprovacao = ?, dataEntregaPrevista = ?, vendedor = ?,
              dataUltimaAtualizacao = NOW(), sincronizadoEm = NOW()
            WHERE numeroOs = ?`,
            [
              os.cliente,
              os.cliente_cnpj_cpf,
              os.cliente_contato?.[0]?.email || '',
              cep,
              municipio,
              estado,
              endereco?.logradouro || '',
              dataAprovacao,
              dataEntrega,
              vendedor,
              numeroOs,
            ]
          );
          quantidadeAtualizada++;
        } else {
          // Inserir
          await mutationQuery(
            `INSERT INTO erp_os_cache 
              (numeroOs, razaoSocial, cnpj, email, cep, municipio, estado, endereco,
               dataAprovacao, dataEntregaPrevista, vendedor, status, 
               dataUltimaAtualizacao, sincronizadoEm, criadoEm)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
            [
              numeroOs,
              os.cliente,
              os.cliente_cnpj_cpf,
              os.cliente_contato?.[0]?.email || '',
              cep,
              municipio,
              estado,
              endereco?.logradouro || '',
              dataAprovacao,
              dataEntrega,
              vendedor,
              'ativa',
            ]
          );
          quantidadeInserida++;
        }
      } catch (erro: any) {
        console.error(`❌ [SYNC-OS] Erro ao processar OS:`, erro.message);
        // Continuar com próxima OS
      }
    }

    const totalProcessado = quantidadeInserida + quantidadeAtualizada;
    console.log(`✅ [SYNC-OS] Sincronização concluída: ${quantidadeInserida} inseridas, ${quantidadeAtualizada} atualizadas`);

    // 4. Registrar log de sucesso
    await registrarLogSincronizacao({
      dataExecucao: new Date(),
      quantidadeOsImportadas: totalProcessado,
      status: 'SUCESSO',
    });

    return {
      dataExecucao: new Date(),
      quantidadeOsImportadas: totalProcessado,
      status: 'SUCESSO',
    };
  } catch (erro: any) {
    console.error(`❌ [SYNC-OS] Erro na sincronização:`, erro);

    // Registrar log de erro
    await registrarLogSincronizacao({
      dataExecucao: new Date(),
      quantidadeOsImportadas: 0,
      status: 'ERRO',
      mensagemErro: erro?.message || 'Erro desconhecido',
    });

    return {
      dataExecucao: new Date(),
      quantidadeOsImportadas: 0,
      status: 'ERRO',
      mensagemErro: erro?.message || 'Erro desconhecido',
    };
  }
}

/**
 * Registra log de sincronização na tabela sync_logs
 */
function normalizarData(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  // dd/mm/yyyy -> yyyy-mm-dd (coluna dataEntregaPrevista é DATE)
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  // já em ISO ou yyyy-mm-dd
  const iso = texto.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  return null;
}

export async function registrarLogSincronizacao(log: SyncLogEntry): Promise<void> {
  try {
    await mutationQuery(
      // ⚠️ Colunas reais (DESCRIBE sync_logs): dataExecucao, quantidadeOsImportadas,
      //    status ENUM('SUCESSO','ERRO','PENDENTE'), mensagemErro
      `INSERT INTO sync_logs
        (dataExecucao, quantidadeOsImportadas, status, mensagemErro)
      VALUES (?, ?, ?, ?)`,
      [
        log.dataExecucao,
        log.quantidadeOsImportadas,
        log.status,
        log.mensagemErro || null,
      ]
    );
  } catch (erro: any) {
    console.error(`❌ [SYNC-OS] Erro ao registrar log:`, erro.message);
  }
}

/**
 * Retorna o status da última sincronização
 */
export async function obterStatusSincronizacao() {
  try {
    const logs = await selectQuery(
      `SELECT * FROM sync_logs ORDER BY dataExecucao DESC LIMIT 1`,
      []
    );

    if (!logs || logs.length === 0) {
      return {
        ultimaExecucao: null,
        status: 'NUNCA_EXECUTADO',
        totalOsEmCache: 0,
      };
    }

    const ultimoLog = logs[0];
    const totalOsEmCache = await selectQuery(
      `SELECT COUNT(*) as total FROM erp_os_cache`,
      []
    );

    return {
      ultimaExecucao: ultimoLog.dataExecucao,
      status: ultimoLog.status,
      quantidadeOsImportadas: ultimoLog.quantidadeOsImportadas,
      mensagemErro: ultimoLog.mensagemErro,
      totalOsEmCache: totalOsEmCache[0]?.total || 0,
    };
  } catch (erro: any) {
    console.error(`❌ [SYNC-OS] Erro ao obter status:`, erro.message);
    return {
      ultimaExecucao: null,
      status: 'ERRO',
      totalOsEmCache: 0,
    };
  }
}
