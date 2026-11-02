import { listarOrcamentosMubiSys, listarOSMubiSys } from "../integrations/mubisys-client";
import {
  HISTORICO_ORC_COLS,
  HISTORICO_OS_COLS,
  orcParaLinha,
  osParaLinha,
  upsertEmLotes,
} from "./scheduled-sync-historico";
import {
  atualizarFatosSeBaseErpSaudavel,
  registrarTentativaSyncErp,
  type RecursoCadenciaErp,
} from "../services/campanhaCadenciaErp";
import { invalidarCacheContextoErp } from "../services/fontesErpCampanhas";
import { hojeIsoCampoGrande } from "../services/campanhaCadenciaRules";

function isoComDeslocamento(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}

function mesAno(data: string | null | undefined): { mes: number; ano: number } {
  const s = String(data ?? "");
  const m = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (m) return { ano: Number(m[1]), mes: Number(m[2]) };
  const br = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (br) return { ano: Number(br[3]), mes: Number(br[2]) };
  const hoje = hojeIsoCampoGrande().split("-").map(Number);
  return { ano: hoje[0], mes: hoje[1] };
}

/** Poll incremental, um recurso por execução para evitar concorrência contra a API MubiSys. */
export async function sincronizarCampanhasWhatsappErp(
  recurso: Extract<RecursoCadenciaErp, "ordens" | "orcamentos">
): Promise<{ recurso: string; inicio: string; fim: string; registros: number; fatosAtualizados: number | null }> {
  const fim = hojeIsoCampoGrande();
  // Janela sobreposta para capturar alterações retroativas de status e pedidos/orçamentos
  // que o ERP registre com atraso. O upsert por identificador mantém a repetição idempotente.
  const inicio = isoComDeslocamento(fim, -7);
  // Marcar a origem e a projeção como incompletas antes da leitura impede o worker
  // de enviar com fatos antigos enquanto a API e o upsert ainda estão em andamento.
  await registrarTentativaSyncErp(recurso, "Sincronização MubiSys em andamento.", false);
  await registrarTentativaSyncErp("fatos", `Aguardando conclusão da sincronização de ${recurso}.`, false);
  try {
    if (recurso === "ordens") {
      const resposta = await listarOSMubiSys({
        status: "TODOS",
        filtrodata: "APROVACAO",
        datainicial: inicio,
        datafinal: fim,
      });
      if (!resposta.completo) throw new Error("A listagem de ordens do MubiSys veio incompleta.");
      const linhas = resposta.itens.map(os => {
        const periodo = mesAno(os.data_aprovacao || os.data_cadastro);
        return osParaLinha(os, periodo.mes, periodo.ano);
      }).filter(l => l.osNumero);
      await upsertEmLotes("historico_os", HISTORICO_OS_COLS, linhas, "osNumero");
      invalidarCacheContextoErp();
      const fatos = await atualizarFatosSeBaseErpSaudavel("ordens");
      await registrarTentativaSyncErp("ordens");
      return { recurso, inicio, fim, registros: linhas.length, fatosAtualizados: fatos.contatos ?? null };
    }

      const resposta = await listarOrcamentosMubiSys({
      status: "TODOS",
      datainicial: inicio,
      datafinal: fim,
        perPage: 50,
      });
    if (!resposta.completo) throw new Error("A listagem de orçamentos do MubiSys veio incompleta.");
    const linhas = resposta.itens.map(orcamento => {
      const periodo = mesAno(orcamento.data_cadastro);
      return orcParaLinha(orcamento, periodo.mes, periodo.ano);
    }).filter(l => l.orcNumero);
    await upsertEmLotes("historico_orcamentos", HISTORICO_ORC_COLS, linhas, "orcNumero");
    invalidarCacheContextoErp();
    const fatos = await atualizarFatosSeBaseErpSaudavel("orcamentos");
    await registrarTentativaSyncErp("orcamentos");
    return { recurso, inicio, fim, registros: linhas.length, fatosAtualizados: fatos.contatos ?? null };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Falha ao consultar o MubiSys.";
    await registrarTentativaSyncErp(recurso, mensagem, false);
    await registrarTentativaSyncErp("fatos", `Falha ao atualizar após sincronização de ${recurso}: ${mensagem}`, false).catch(() => undefined);
    throw error;
  }
}
