/**
 * Handler para sincronização diária de OS do MubiSys
 * Executa via CRON job (QStash, em lotes) e atualiza o cache local (erp_os_cache)
 *
 * A janela sincronizada é parametrizável (`dias`/`offset`) porque uma janela de
 * 30 dias não cabe no `maxDuration` de 60s da Vercel — o agendamento real
 * dispara vários lotes menores e escalonados. Ver docs/cron-qstash.md e
 * docs/sprint-mubisys/pending/fase-03-sync-diario.md.
 *
 * ⚠️ Colunas REAIS da tabela erp_os_cache (validado com DESCRIBE):
 *    vendedor (varchar 128) — NÃO existe nomeVendedor
 *    dataAprovacao (varchar 64) — texto livre, não date
 */

import { selectQuery, mutationQuery } from '../db/db-connection';
import { listarOSMubiSys, MubiSysOS } from '../integrations/mubisys-client';
import { normalizarData } from '../utils/date-utils';

export interface SyncLogEntry {
  dataExecucao: Date;
  quantidadeOsImportadas: number;
  status: 'SUCESSO' | 'ERRO';
  mensagemErro?: string;
  tempoExecucaoMs?: number;
}

export interface SincronizarOSOpts {
  /** Tamanho da janela, em dias. Padrão 8. */
  dias?: number;
  /** Quantos dias atrás a janela termina. Padrão 0 (termina hoje). */
  offset?: number;
}

const fmt = (d: Date) => d.toISOString().split('T')[0];

/**
 * Sincroniza OS do MubiSys para o cache local.
 * Janela: de `hoje - offset - dias` até `hoje - offset`.
 */
export async function sincronizarOSDoMubiSys(opts: SincronizarOSOpts = {}): Promise<SyncLogEntry> {
  const dias = opts.dias ?? 8;
  const offset = opts.offset ?? 0;
  const inicio = Date.now();

  const hoje = new Date();
  const dataFim = new Date(hoje);
  dataFim.setDate(dataFim.getDate() - offset);
  const dataInicio = new Date(hoje);
  dataInicio.setDate(dataInicio.getDate() - offset - dias);

  console.log(`🔄 [SYNC-OS] dias=${dias} offset=${offset} janela=${fmt(dataInicio)}..${fmt(dataFim)}`);

  // Registrado ANTES da chamada à API: se a função for morta pelo
  // maxDuration, fica uma linha PENDENTE órfã — sintoma de timeout, não silêncio.
  const logId = await iniciarLogSincronizacao();

  try {
    console.log(`📡 [SYNC-OS] Buscando OS da API MubiSys...`);
    const { itens: osLista, completo } = await listarOSMubiSys({
      datainicial: fmt(dataInicio),
      datafinal: fmt(dataFim),
    });

    if (!completo) {
      console.warn(`⚠️ [SYNC-OS] Listagem incompleta — teto de páginas atingido`);
    }

    console.log(`✅ [SYNC-OS] Recebidas ${osLista.length} OS da API`);

    let quantidadeProcessada = 0;

    for (const os of osLista as MubiSysOS[]) {
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

        const dataAprovacao = os.data_aprovacao || null;
        // `prazo` é texto ("X DIAS ÚTEIS"), não entra como fallback de data.
        const dataEntrega = normalizarData(os.data_entrega);
        const vendedor = os.vendedor || os.atendente || '';

        // Upsert único por numeroOs (índice único erp_os_cache_numero_os_idx):
        // metade das idas ao banco do par SELECT+INSERT/UPDATE anterior, e
        // idempotente — lotes que se sobrepõem só reescrevem o mesmo registro.
        await mutationQuery(
          `INSERT INTO erp_os_cache (
            "numeroOs", "razaoSocial", cnpj, email, cep, municipio, estado, endereco,
            "dataAprovacao", "dataEntregaPrevista", vendedor, "valorTotal", status,
            "dataUltimaAtualizacao", "sincronizadoEm", "criadoEm"
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativa', NOW(), NOW(), NOW())
          ON CONFLICT ("numeroOs") DO UPDATE SET
            "razaoSocial" = EXCLUDED."razaoSocial",
            cnpj = EXCLUDED.cnpj,
            email = EXCLUDED.email,
            cep = EXCLUDED.cep,
            municipio = EXCLUDED.municipio,
            estado = EXCLUDED.estado,
            endereco = EXCLUDED.endereco,
            "dataAprovacao" = EXCLUDED."dataAprovacao",
            "dataEntregaPrevista" = EXCLUDED."dataEntregaPrevista",
            vendedor = EXCLUDED.vendedor,
            "valorTotal" = EXCLUDED."valorTotal",
            "dataUltimaAtualizacao" = NOW(),
            "sincronizadoEm" = NOW()`,
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
            os.valor_total ?? null,
          ]
        );
        quantidadeProcessada++;
      } catch (erro: any) {
        console.error(`❌ [SYNC-OS] Erro ao processar OS:`, erro.message);
        // Continuar com próxima OS
      }
    }

    const tempoExecucaoMs = Date.now() - inicio;
    console.log(`✅ [SYNC-OS] Sincronização concluída: ${quantidadeProcessada} OS processadas em ${tempoExecucaoMs}ms`);

    await finalizarLogSincronizacao(logId, {
      status: 'SUCESSO',
      quantidadeOsImportadas: quantidadeProcessada,
      tempoExecucaoMs,
    });

    return {
      dataExecucao: new Date(),
      quantidadeOsImportadas: quantidadeProcessada,
      status: 'SUCESSO',
      tempoExecucaoMs,
    };
  } catch (erro: any) {
    const tempoExecucaoMs = Date.now() - inicio;
    console.error(`❌ [SYNC-OS] Erro na sincronização:`, erro);

    await finalizarLogSincronizacao(logId, {
      status: 'ERRO',
      quantidadeOsImportadas: 0,
      tempoExecucaoMs,
      mensagemErro: erro?.message || 'Erro desconhecido',
    });

    return {
      dataExecucao: new Date(),
      quantidadeOsImportadas: 0,
      status: 'ERRO',
      mensagemErro: erro?.message || 'Erro desconhecido',
      tempoExecucaoMs,
    };
  }
}

/** Grava a linha PENDENTE que marca o início da execução. Devolve o id para o UPDATE final. */
async function iniciarLogSincronizacao(): Promise<number | null> {
  try {
    const resultado = await mutationQuery(
      `INSERT INTO sync_logs (status) VALUES ('PENDENTE') RETURNING id`,
      []
    );
    return resultado.insertId ?? null;
  } catch (erro: any) {
    console.error(`❌ [SYNC-OS] Erro ao registrar início da execução:`, erro.message);
    return null;
  }
}

/** Fecha a linha PENDENTE em SUCESSO/ERRO. Sem `id` (falha ao iniciar o log), grava uma linha avulsa. */
async function finalizarLogSincronizacao(
  id: number | null,
  dados: {
    status: 'SUCESSO' | 'ERRO';
    quantidadeOsImportadas: number;
    tempoExecucaoMs: number;
    mensagemErro?: string;
  }
): Promise<void> {
  if (id == null) {
    await registrarLogSincronizacao({
      dataExecucao: new Date(),
      quantidadeOsImportadas: dados.quantidadeOsImportadas,
      status: dados.status,
      mensagemErro: dados.mensagemErro,
    });
    return;
  }

  try {
    await mutationQuery(
      `UPDATE sync_logs SET
        status = ?, "quantidadeOsImportadas" = ?, "tempoExecucaoMs" = ?, "mensagemErro" = ?
      WHERE id = ?`,
      [dados.status, dados.quantidadeOsImportadas, dados.tempoExecucaoMs, dados.mensagemErro || null, id]
    );
  } catch (erro: any) {
    console.error(`❌ [SYNC-OS] Erro ao finalizar log:`, erro.message);
  }
}

/**
 * Registra log de sincronização na tabela sync_logs (linha avulsa, sem fase PENDENTE).
 * Mantido para o fallback de iniciarLogSincronizacao e para uso direto em testes.
 */
export async function registrarLogSincronizacao(log: SyncLogEntry): Promise<void> {
  try {
    await mutationQuery(
      `INSERT INTO sync_logs
        ("dataExecucao", "quantidadeOsImportadas", status, "mensagemErro", "tempoExecucaoMs")
      VALUES (?, ?, ?, ?, ?)`,
      [
        log.dataExecucao,
        log.quantidadeOsImportadas,
        log.status,
        log.mensagemErro || null,
        log.tempoExecucaoMs ?? null,
      ]
    );
  } catch (erro: any) {
    console.error(`❌ [SYNC-OS] Erro ao registrar log:`, erro.message);
  }
}

/**
 * Retorna o status da última sincronização (uma linha = um lote).
 * Para o total agregado das últimas 24h, ver adminRouter.obterStatusSincronizacao.
 */
export async function obterStatusSincronizacao() {
  try {
    const logs = await selectQuery(
      `SELECT * FROM sync_logs ORDER BY "dataExecucao" DESC LIMIT 1`,
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
