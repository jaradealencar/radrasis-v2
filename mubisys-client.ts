/**
 * Cliente HTTP para a API MubiSys Open v1.0.0
 * Documentação: https://api.mubisys.com/api/documentation
 *
 * Autenticação: header Access-Token
 * Base URL: https://api.mubisys.com/api/{publicKey}/...
 */
import { ENV } from "./_core/env";

const BASE_URL = "https://api.mubisys.com/api";

// ─── Tipos da API MubiSys ────────────────────────────────────────────────────

export interface MubiSysOS {
  id: number;
  empresa: string;
  cliente: string;
  cliente_id: number;
  cliente_cnpj_cpf: string;
  cliente_contato: Array<{
    id: number;
    nome_contato: string;
    celular: string;
    email: string;
    departamento: string;
    status: string;
  }>;
  cliente_endereco: Array<{
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
  }>;
  sequencial_ordem: number;
  numero_pedido_compra: string;
  status: string;
  status_financeiro: string;
  nome_trabalho: string;
  tipo: string;
  logistica: string;
  prazo: string;
  data_entrega: string | null;
  data_cadastro: string;
  data_aprovacao: string | null;
  data_faturamento: string | null;
  data_cancelamento: string | null;
  motivo_cancelamento: string | null;
  observacao_geral: string;
  observacao_producao: string;
  valor_total: number;
  valor_custo: number;
  valor_margem: number;
  processos_previstos: string;
  tempo_total_previsto: number;
  vendedor: string;
  atendente: string;
  itens: Array<{
    id: number;
    posicao: number;
    item: string;
    modelo: string;
    variacao: string;
    descricao: string;
    largura: string;
    altura: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
  }>;
  imagens: string[];
}

export interface MubiSysListResponse<T> {
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  data: T[];
}

export interface MubiSysOrcamento {
  id: number;
  sequencial_orcamento: number;
  cliente: string;
  cliente_id: number;
  status: string;
  nome_trabalho: string;
  data_cadastro: string;
  data_aprovacao: string | null;
  valor_total: number;
  vendedor: string;
  itens: Array<{
    item: string;
    descricao: string;
    quantidade: number;
    valor_total: number;
  }>;
}

// ─── Cliente HTTP ────────────────────────────────────────────────────────────

async function mubisysGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = ENV.MUBISYS_ACCESS_TOKEN;
  const publicKey = ENV.MUBISYS_PUBLIC_KEY;

  if (!token || !publicKey) {
    throw new Error("Credenciais MubiSys não configuradas (MUBISYS_ACCESS_TOKEN e MUBISYS_PUBLIC_KEY)");
  }

  const url = new URL(`${BASE_URL}/${publicKey}/${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const response = await fetch(url.toString(), {
    headers: {
      "Access-Token": token,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`MubiSys API error ${response.status}: ${body.slice(0, 200)}`);
  }

  return response.json() as Promise<T>;
}

// ─── Ordens de Serviço ───────────────────────────────────────────────────────

export type OSStatus =
  | "TODOS"
  | "PENDENTE"
  | "PRODUCAO"
  | "CANCELADO"
  | "CONCLUIDO"
  | "PAUSADO"
  | "ENTREGUE";

export type OSFiltroDatas =
  | "CADASTRO"
  | "PREV_ENTREGA"
  | "APROVACAO"
  | "ENTREGA"
  | "FATURAMENTO"
  | "CANCELAMENTO";

export async function listarOSMubiSys(opts: {
  status?: OSStatus;
  filtrodata?: OSFiltroDatas;
  datainicial: string;
  datafinal: string;
}): Promise<MubiSysListResponse<MubiSysOS>> {
  return mubisysGet<MubiSysListResponse<MubiSysOS>>("ordem-servico", {
    status: opts.status ?? "TODOS",
    filtrodata: opts.filtrodata ?? "CADASTRO",
    datainicial: opts.datainicial,
    datafinal: opts.datafinal,
  });
}

export async function buscarOSPorId(id: number): Promise<MubiSysOS> {
  return mubisysGet<MubiSysOS>(`ordem-servico/${id}`);
}

export async function buscarOSPorNumero(numero: string): Promise<MubiSysOS | null> {
  // A API não tem busca por número diretamente — busca nos últimos 6 meses
  const hoje = new Date();
  const seisAtras = new Date(hoje);
  seisAtras.setMonth(seisAtras.getMonth() - 6);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const resp = await listarOSMubiSys({
    status: "TODOS",
    datainicial: fmt(seisAtras),
    datafinal: fmt(hoje),
  });

  const encontrada = resp.data.find(
    (os) =>
      String(os.sequencial_ordem) === String(numero) ||
      String(os.id) === String(numero) ||
      os.numero_pedido_compra === numero
  );
  return encontrada ?? null;
}

// ─── Orçamentos ──────────────────────────────────────────────────────────────

export async function listarOrcamentosMubiSys(opts: {
  status?: "TODOS" | "ABERTO" | "CANCELADO" | "APROVADO";
  datainicial: string;
  datafinal: string;
}): Promise<MubiSysListResponse<MubiSysOrcamento>> {
  return mubisysGet<MubiSysListResponse<MubiSysOrcamento>>("orcamento", {
    status: opts.status ?? "TODOS",
    filtrodata: "CADASTRO",
    datainicial: opts.datainicial,
    datafinal: opts.datafinal,
  });
}

// ─── Clientes ────────────────────────────────────────────────────────────────

export async function listarClientesMubiSys(): Promise<any[]> {
  const resp = await mubisysGet<any>("cliente");
  return Array.isArray(resp) ? resp : (resp as any).data ?? [];
}

// ─── Verificar conectividade ─────────────────────────────────────────────────

export async function verificarConexaoMubiSys(): Promise<{
  ok: boolean;
  empresa?: string;
  totalOS?: number;
  erro?: string;
}> {
  try {
    const hoje = new Date();
    const mesAtras = new Date(hoje);
    mesAtras.setMonth(mesAtras.getMonth() - 1);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const resp = await listarOSMubiSys({
      status: "TODOS",
      datainicial: fmt(mesAtras),
      datafinal: fmt(hoje),
    });

    const empresa = resp.data[0]?.empresa ?? "Empresa não identificada";
    return { ok: true, empresa, totalOS: resp.pagination.total };
  } catch (err: any) {
    return { ok: false, erro: err.message };
  }
}
