import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db/db";
import {
  campanhasWhatsappClienteFatos,
  campanhasWhatsappErpSyncStatus,
  historicoOrcamentos,
  historicoOs,
  mubisysClientesCache,
} from "../../drizzle/schema";
import { isOsNormalDb } from "../routers/performanceComercial";
import { parseDataFlexivel, STATUS_GANHO, STATUS_PERDIDO } from "./inteligenciaClientes";
import { normalizeEmpresaKey } from "./probabilidadeCompra";
import {
  diasEntreDatasIso,
  hojeIsoCampoGrande,
  telefoneParaE164,
  type FatosContatoErp,
} from "./campanhaCadenciaRules";

export const CADENCIA_MAX_FRESCOR_ERP_MS = 30 * 60_000;
export const CADENCIA_MAX_FRESCOR_HISTORICO_MS = 26 * 60 * 60_000;
export const RECURSOS_CADENCIA_ERP = ["ordens", "orcamentos", "fatos", "historico", "clientes"] as const;
export type RecursoCadenciaErp = (typeof RECURSOS_CADENCIA_ERP)[number];

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Campo_Grande",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dataIso(valor: string | Date | null | undefined): string | null {
  if (!valor) return null;
  const parsed = valor instanceof Date ? valor : parseDataFlexivel(String(valor));
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return isoFormatter.format(parsed);
}

function normalizarStatusOrcamento(status: string | null | undefined): FatosContatoErp["quoteStatus"] {
  const chave = (status ?? "").trim().toLowerCase();
  if (!chave) return null;
  if (STATUS_GANHO.has(chave)) return "won";
  if (STATUS_PERDIDO.has(chave)) return "lost";
  if (["em aberto", "aberto", "pendente", "em andamento"].includes(chave)) return "pending";
  return "other";
}

interface Pedido {
  data: string | null;
  nome: string;
  cnpj: string | null;
  clienteId: number | null;
}
interface Orcamento {
  data: string | null;
  status: FatosContatoErp["quoteStatus"];
}

/** Atualiza a projeção de segmentação em uma transação; nenhuma regra consulta dados parcialmente trocados. */
export async function recalcularFatosContatoErp(): Promise<{ contatos: number }> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para atualizar os fatos de clientes da cadência.");
  const [ordens, orcamentos, clientes] = await Promise.all([
    db.select().from(historicoOs),
    db.select().from(historicoOrcamentos),
    db.select().from(mubisysClientesCache),
  ]);

  const porCliente = new Map(clientes.map(c => [c.id, c]));
  const cadastroPorTelefone = new Map<string, { id: number; razaoSocial: string | null; nomeFantasia: string | null; cnpj: string | null }>();
  const telefonePorEmpresa = new Map<string, string>();
  const telefonePorCnpj = new Map<string, string>();
  for (const cliente of [...clientes].sort((a, b) => b.id - a.id)) {
    const telefone = telefoneParaE164(cliente.telefone);
    if (!telefone) continue;
    const cnpj = cliente.cnpj?.replace(/\D/g, "") ?? "";
    if (cnpj && !telefonePorCnpj.has(cnpj)) telefonePorCnpj.set(cnpj, telefone);
    if (!cadastroPorTelefone.has(telefone)) cadastroPorTelefone.set(telefone, {
      id: cliente.id,
      razaoSocial: cliente.razaoSocial,
      nomeFantasia: cliente.nomeFantasia,
      cnpj: cliente.cnpj,
    });
    for (const nome of [cliente.razaoSocial, cliente.nomeFantasia]) {
      const chave = normalizeEmpresaKey(nome ?? "");
      if (chave && !telefonePorEmpresa.has(chave)) telefonePorEmpresa.set(chave, telefone);
    }
  }

  const comprasPorTelefone = new Map<string, Pedido[]>();
  const metadadoRecente = new Map<string, { data: string; nome: string; cnpj: string | null; clienteId: number | null }>();
  for (const ordem of ordens) {
    if (!isOsNormalDb(ordem)) continue;
    const cadastro = ordem.clienteId ? porCliente.get(ordem.clienteId) : undefined;
    const cnpjOrdem = ordem.cnpj?.replace(/\D/g, "") || null;
    const telefone = telefoneParaE164(ordem.telefone)
      ?? telefoneParaE164(cadastro?.telefone)
      ?? (cnpjOrdem ? telefonePorCnpj.get(cnpjOrdem) : undefined)
      ?? telefonePorEmpresa.get(normalizeEmpresaKey(ordem.empresa ?? ""))
      ?? null;
    if (!telefone) continue;
    const data = dataIso(ordem.dataAprovacao);
    const pedido: Pedido = {
      data,
      nome: (ordem.empresa || cadastro?.razaoSocial || cadastro?.nomeFantasia || "").trim(),
      cnpj: cnpjOrdem || cadastro?.cnpj || null,
      clienteId: ordem.clienteId ?? null,
    };
    const lista = comprasPorTelefone.get(telefone) ?? [];
    lista.push(pedido);
    comprasPorTelefone.set(telefone, lista);
    if (data && (!metadadoRecente.has(telefone) || data >= metadadoRecente.get(telefone)!.data)) {
      metadadoRecente.set(telefone, { data, nome: pedido.nome, cnpj: pedido.cnpj, clienteId: pedido.clienteId });
    }
  }

  const orcamentosPorTelefone = new Map<string, Orcamento[]>();
  for (const orcamento of orcamentos) {
    const cadastro = orcamento.clienteId ? porCliente.get(orcamento.clienteId) : undefined;
    const empresaKey = normalizeEmpresaKey(orcamento.empresa ?? "");
    const telefone = telefoneParaE164(orcamento.telefone)
      ?? telefoneParaE164(cadastro?.telefone)
      ?? telefonePorEmpresa.get(empresaKey)
      ?? null;
    if (!telefone) continue;
    const lista = orcamentosPorTelefone.get(telefone) ?? [];
    lista.push({ data: dataIso(orcamento.dataCadastro), status: normalizarStatusOrcamento(orcamento.status) });
    orcamentosPorTelefone.set(telefone, lista);
    const data = dataIso(orcamento.dataCadastro);
    if (data && (!metadadoRecente.has(telefone) || data >= metadadoRecente.get(telefone)!.data)) {
      metadadoRecente.set(telefone, {
        data,
        nome: (orcamento.empresa || cadastro?.razaoSocial || cadastro?.nomeFantasia || "").trim(),
        cnpj: cadastro?.cnpj ?? null,
        clienteId: orcamento.clienteId ?? null,
      });
    }
  }

  const hoje = hojeIsoCampoGrande();
  const telefones = new Set([...comprasPorTelefone.keys(), ...orcamentosPorTelefone.keys()]);
  const fatos = [...telefones].map(telefoneE164 => {
    const compras = comprasPorTelefone.get(telefoneE164) ?? [];
    const comprasComData = compras.map(p => p.data).filter((d): d is string => !!d).sort();
    const ultimaCompraEm = comprasComData.at(-1) ?? null;
    const pedidos90d = compras.filter(p => p.data && p.data <= hoje && diasEntreDatasIso(p.data, hoje) < 90).length;
    const orcs = (orcamentosPorTelefone.get(telefoneE164) ?? []).filter(o => o.data).sort((a, b) => a.data!.localeCompare(b.data!));
    const ultimoOrcamento = orcs.at(-1) ?? null;
    const ultimoOrcamentoEm = ultimoOrcamento?.data ?? null;
    const pedidosAposOrcamento = ultimoOrcamentoEm
      // Mesma data é tratada como conversão também: sem horário confiável, suprimimos o envio por segurança.
      ? compras.filter(p => p.data && p.data >= ultimoOrcamentoEm).length
      : 0;
    const atual = metadadoRecente.get(telefoneE164);
    const cadastroMaisRecente = cadastroPorTelefone.get(telefoneE164);
    const nome = cadastroMaisRecente?.razaoSocial || cadastroMaisRecente?.nomeFantasia || atual?.nome || "";
    const cnpj = cadastroMaisRecente?.cnpj || atual?.cnpj || null;
    const clienteId = cadastroMaisRecente?.id ?? atual?.clienteId ?? null;
    const diasSemComprar = ultimaCompraEm ? diasEntreDatasIso(ultimaCompraEm, hoje) : null;
    const diasPosOrcamento = ultimoOrcamentoEm ? diasEntreDatasIso(ultimoOrcamentoEm, hoje) : null;
    return {
      telefoneE164,
      nome,
      cnpj,
      clienteId,
      totalPedidos: compras.length,
      pedidosUltimos90Dias: pedidos90d,
      diasSemComprar,
      statusOrcamento: ultimoOrcamento?.status ?? null,
      diasPosOrcamento,
      pedidosAposUltimoOrcamento: pedidosAposOrcamento,
      ultimaCompraEm,
      ultimoOrcamentoEm,
      clienteAtivoErp: compras.length > 0 || pedidos90d > 0,
      atualizadoEm: new Date(),
    };
  });

  await db.transaction(async tx => {
    await tx.delete(campanhasWhatsappClienteFatos);
    for (let i = 0; i < fatos.length; i += 300) {
      await tx.insert(campanhasWhatsappClienteFatos).values(fatos.slice(i, i + 300));
    }
  });
  return { contatos: fatos.length };
}

export async function registrarTentativaSyncErp(
  recurso: RecursoCadenciaErp,
  erro?: string | null,
  completo = true
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para registrar a sincronização ERP.");
  const agora = new Date();
  const sucesso = !erro && completo;
  await db.insert(campanhasWhatsappErpSyncStatus).values({
    recurso,
    status: sucesso ? "sucesso" : "erro",
    completo: sucesso,
    ultimaTentativaEm: agora,
    ultimoSucessoEm: sucesso ? agora : null,
    erro: sucesso ? null : (erro || "A resposta do MubiSys foi incompleta.").slice(0, 4000),
    updatedAt: agora,
  }).onConflictDoUpdate({
    target: campanhasWhatsappErpSyncStatus.recurso,
    set: {
      status: sucesso ? "sucesso" : "erro",
      completo: sucesso,
      ultimaTentativaEm: agora,
      ...(sucesso ? { ultimoSucessoEm: agora } : {}),
      erro: sucesso ? null : (erro || "A resposta do MubiSys foi incompleta.").slice(0, 4000),
      updatedAt: agora,
    },
  });
}

export async function obterSaudeSyncErp(): Promise<{
  ok: boolean;
  detalhes: Array<{ recurso: string; status: string; idadeMs: number | null; erro: string | null }>;
}> {
  const db = await getDb();
  if (!db) return { ok: false, detalhes: [] };
  const rows = await db.select().from(campanhasWhatsappErpSyncStatus)
    .where(inArray(campanhasWhatsappErpSyncStatus.recurso, [...RECURSOS_CADENCIA_ERP]));
  const porRecurso = new Map(rows.map(r => [r.recurso, r]));
  const agora = Date.now();
  const detalhes = RECURSOS_CADENCIA_ERP.map(recurso => {
    const row = porRecurso.get(recurso);
    const idadeMs = row?.ultimoSucessoEm ? agora - row.ultimoSucessoEm.getTime() : null;
    const limiteMs = recurso === "historico" || recurso === "clientes" ? CADENCIA_MAX_FRESCOR_HISTORICO_MS : CADENCIA_MAX_FRESCOR_ERP_MS;
    return {
      recurso,
      status: row?.status ?? "nunca",
      idadeMs,
      erro: row?.erro ?? null,
      limiteMs,
    };
  });
  return {
    ok: detalhes.every(d => d.status === "sucesso" && d.idadeMs !== null && d.idadeMs <= d.limiteMs),
    detalhes,
  };
}

export async function atualizarFatosSeBaseErpSaudavel(
  recursoConcluido?: Extract<RecursoCadenciaErp, "ordens" | "orcamentos">
): Promise<{ ok: boolean; contatos?: number }> {
  const db = await getDb();
  if (!db) return { ok: false };
  const rows = await db.select().from(campanhasWhatsappErpSyncStatus)
    .where(inArray(campanhasWhatsappErpSyncStatus.recurso, ["ordens", "orcamentos"]));
  const mapa = new Map(rows.map(r => [r.recurso, r]));
  const saudavel = ["ordens", "orcamentos"].every(recurso => {
    const row = mapa.get(recurso);
    // The current poll has already fetched and upserted successfully; its persisted health
    // deliberately remains "erro" until this new projection is committed.
    if (recurso === recursoConcluido && row?.status === "erro") return true;
    return row?.status === "sucesso" && row.completo && row.ultimoSucessoEm
      && Date.now() - row.ultimoSucessoEm.getTime() <= CADENCIA_MAX_FRESCOR_ERP_MS;
  });
  if (!saudavel) return { ok: false };
  try {
    const resultado = await recalcularFatosContatoErp();
    await registrarTentativaSyncErp("fatos");
    return { ok: true, contatos: resultado.contatos };
  } catch (error) {
    await registrarTentativaSyncErp("fatos", error instanceof Error ? error.message : "Falha ao atualizar projeção de clientes.", false);
    throw error;
  }
}

export async function buscarFatosContatoErp(telefoneE164: string): Promise<FatosContatoErp | null> {
  const db = await getDb();
  if (!db) return null;
  const [fato] = await db.select().from(campanhasWhatsappClienteFatos)
    .where(eq(campanhasWhatsappClienteFatos.telefoneE164, telefoneE164)).limit(1);
  if (!fato) return null;
  return {
    telefoneE164: fato.telefoneE164,
    nome: fato.nome,
    cnpj: fato.cnpj,
    clienteId: fato.clienteId,
    totalOrders: fato.totalPedidos,
    ordersLast90Days: fato.pedidosUltimos90Dias,
    daysSincePurchase: fato.diasSemComprar,
    quoteStatus: fato.statusOrcamento as FatosContatoErp["quoteStatus"],
    daysSinceQuote: fato.diasPosOrcamento,
    ordersAfterLatestQuote: fato.pedidosAposUltimoOrcamento,
    ultimaCompraEm: fato.ultimaCompraEm,
    ultimoOrcamentoEm: fato.ultimoOrcamentoEm,
  };
}

export async function obterContatosErpAtivos(): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();
  const rows = await db.select({ telefoneE164: campanhasWhatsappClienteFatos.telefoneE164 })
    .from(campanhasWhatsappClienteFatos)
    .where(eq(campanhasWhatsappClienteFatos.clienteAtivoErp, true));
  return new Set(rows.map(r => r.telefoneE164));
}
