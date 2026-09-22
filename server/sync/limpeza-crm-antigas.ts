/**
 * Limpeza única do CRM de Propostas (21/09/2026): esconde da tela as propostas em aberto
 * geradas em `ate` (padrão 2026-09-17) ou antes — pedido explícito do usuário, para o time
 * começar a usar o CRM só com propostas novas (a partir de 18/09/2026).
 *
 * Mecanismo: insere em `crm_contatos` um registro canal='perdida' (numeroContato=99), o MESMO
 * jeito que a tela já usa para esconder uma proposta ("Marcar como perdida" → getPropostas
 * filtra fora qualquer orcamentoId com canal='perdida', ver `perdidasSet` em
 * server/routers/crm.ts). NÃO passa pela mutation `marcarPerdida` da tela — grava a linha
 * direto — então o log de atividade usa uma ação própria ("limpezaInicialCrm", vendedor
 * "Sistema (limpeza CRM)") em vez de "descartar", para não fingir que os vendedores
 * descartaram essas propostas (relatórios de uso do CRM contam "descartes" pela ação
 * "descartar" do log de atividade, não pelo canal em si — ver
 * server/services/relatorioComercialCrm.ts — então isso não polui as estatísticas deles).
 *
 * Escopo: lê o cache já mantido quente pelo cron de sincronização (`crm_abertos_15d`, 21
 * dias rolantes — ver crm-abertos-cache.ts), sem bater no MubiSys de novo. Não busca "todo o
 * histórico": proposta mais antiga que a janela do cache nunca apareceu na tela do CRM (a
 * janela rolante nunca busca além disso), então excluí-la não mudaria nada que o vendedor já
 * via — não há necessidade de olhar mais para trás que isso.
 *
 * Idempotente: pula qualquer orcamentoId que já tenha um registro canal='perdida'.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db/db";
import { crmContatos, crmAtividadeLog } from "../../drizzle/schema";
import { CACHE_KEY_ABERTOS_PADRAO, getCrmAbertosCache } from "./crm-abertos-cache";

// Mesma classificação de "aberto" que server/routers/crm.ts usa para a lista da tela.
const STATUS_ABERTO = new Set(["em aberto", "em andamento", "pendente"]);

export interface CandidataExclusao {
  orcamentoId: string;
  vendedor: string;
  empresa: string;
  dataCadastro: string;
  valor: number;
}

// Mesma extração de nome de cliente que getPropostas usa (server/routers/crm.ts) — só para o
// campo `empresa` do registro (informativo; quem de fato esconde a proposta é o orcamentoId).
function extrairNomeCliente(o: any): string {
  const clienteRaw = o?.cliente;
  const empresaRaw = o?.empresa;
  if (typeof clienteRaw === "object" && clienteRaw !== null) {
    return (clienteRaw as any)?.nome ?? (clienteRaw as any)?.razao_social ?? String(clienteRaw);
  }
  return String(clienteRaw ?? empresaRaw ?? "");
}

/** Função pura: do array bruto do cache, extrai as candidatas a exclusão (fácil de testar). */
export function classificarCandidatasExclusao(itens: any[], ate: string): CandidataExclusao[] {
  return itens
    .filter((o: any) => {
      const dia = (o.data_cadastro || "").slice(0, 10);
      const status = (o.status || "").toLowerCase();
      return !!dia && dia <= ate && STATUS_ABERTO.has(status);
    })
    .map((o: any) => ({
      orcamentoId: String(o.id),
      vendedor: o.vendedor || "(sem vendedor)",
      empresa: extrairNomeCliente(o) || o.vendedor || "",
      dataCadastro: (o.data_cadastro || "").slice(0, 10),
      valor: parseFloat(o.valor_total ?? "0"),
    }));
}

function calcTurno(date: Date): "manha" | "tarde" | "noite" {
  const hBrasilia = ((date.getHours() - 3) + 24) % 24;
  if (hBrasilia >= 6 && hBrasilia < 12) return "manha";
  if (hBrasilia >= 12 && hBrasilia < 18) return "tarde";
  return "noite";
}

export interface ResultadoLimpeza {
  ate: string;
  apply: boolean;
  totalNoCache: number;
  candidatas: number;
  jaMarcadas: number;
  aExcluir: number;
  gravadas: number;
  valorTotal: number;
  porVendedor: Array<{ vendedor: string; qtd: number; valor: number }>;
  amostra: CandidataExclusao[];
}

export async function limparPropostasAntigas(ate: string, apply: boolean): Promise<ResultadoLimpeza> {
  const db = (await getDb())!;
  const cache = await getCrmAbertosCache(CACHE_KEY_ABERTOS_PADRAO);
  const itens = cache?.itens ?? [];
  const candidatas = classificarCandidatasExclusao(itens, ate);

  const jaMarcadas = await db.select({ orcamentoId: crmContatos.orcamentoId })
    .from(crmContatos)
    .where(eq(crmContatos.canal, "perdida" as any));
  const jaMarcadasSet = new Set(jaMarcadas.map(r => r.orcamentoId));

  const aExcluir = candidatas.filter(c => !jaMarcadasSet.has(c.orcamentoId));

  const porVendedorMap: Record<string, { qtd: number; valor: number }> = {};
  for (const c of aExcluir) {
    if (!porVendedorMap[c.vendedor]) porVendedorMap[c.vendedor] = { qtd: 0, valor: 0 };
    porVendedorMap[c.vendedor].qtd++;
    porVendedorMap[c.vendedor].valor += c.valor;
  }
  const porVendedor = Object.entries(porVendedorMap)
    .map(([vendedor, r]) => ({ vendedor, ...r }))
    .sort((a, b) => b.qtd - a.qtd);
  const valorTotal = aExcluir.reduce((s, c) => s + c.valor, 0);

  let gravadas = 0;
  if (apply) {
    const agora = new Date();
    const observacao = `Limpeza inicial do CRM (21/09/2026): proposta gerada até ${ate}, anterior ao início efetivo de uso do CRM (18/09/2026).`;
    for (const c of aExcluir) {
      await db.insert(crmContatos).values({
        orcamentoId: c.orcamentoId, vendedor: c.vendedor, empresa: c.empresa,
        numeroContato: 99, canal: "perdida" as any,
        observacao, contatadoEm: agora,
      } as any);
      await db.insert(crmAtividadeLog).values({
        vendedor: "Sistema (limpeza CRM)",
        acao: "limpezaInicialCrm",
        orcamentoId: c.orcamentoId, empresa: c.empresa,
        detalhe: `proposta de ${c.dataCadastro} excluída (limpeza até ${ate})`,
        realizadaEm: agora,
        turno: calcTurno(agora),
      } as any);
      gravadas++;
    }
  }

  return {
    ate, apply,
    totalNoCache: itens.length,
    candidatas: candidatas.length,
    jaMarcadas: candidatas.length - aExcluir.length,
    aExcluir: aExcluir.length,
    gravadas, valorTotal, porVendedor,
    amostra: aExcluir.slice(0, 15),
  };
}
