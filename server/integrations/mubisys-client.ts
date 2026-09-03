/**
 * Cliente HTTP para a API MubiSys Open v1.0.0
 * Documentação: https://api.mubisys.com/api/documentation
 *
 * Autenticação: header Access-Token
 * Base URL: https://api.mubisys.com/api/{publicKey}/...
 */
import { ENV } from "../_core/env";

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

export interface MubiSysCliente {
  id: number;
  razao_social: string;
  cnpj_cpf: string;
  [k: string]: unknown;
}

// ─── Cliente HTTP ────────────────────────────────────────────────────────────

/** Erro de comunicação com o ERP. 404 NÃO produz erro — ver mubisysGetOrNull. */
export class MubiSysError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "MubiSysError";
  }
}

/** Timeout padrão. A listagem de OS é lenta (~25 s/mês) — ver TIMEOUT_LISTA_MS. */
const TIMEOUT_PADRAO_MS = 30_000;

/** Consulta pontual (por número/id/cliente): rápida, ~0,2–1 s medidos. */
export const TIMEOUT_PONTUAL_MS = 10_000;
/** Listagem paginada: ~25 s por mês de janela, medido em 17/08/2026. */
export const TIMEOUT_LISTA_MS = 45_000;

async function mubisysGet<T>(
  path: string,
  params?: Record<string, string>,
  opts?: { timeoutMs?: number },
): Promise<T> {
  const resultado = await mubisysGetOrNull<T>(path, params, opts);
  if (resultado === null) {
    throw new MubiSysError(`MubiSys: recurso não encontrado (${path})`, 404);
  }
  return resultado;
}

/** Igual a mubisysGet, mas devolve null em 404 em vez de lançar. */
async function mubisysGetOrNull<T>(
  path: string,
  params?: Record<string, string>,
  opts?: { timeoutMs?: number },
): Promise<T | null> {
  const token = ENV.MUBISYS_ACCESS_TOKEN;
  const publicKey = ENV.MUBISYS_PUBLIC_KEY;
  if (!token || !publicKey) {
    throw new MubiSysError(
      "Credenciais MubiSys não configuradas (MUBISYS_ACCESS_TOKEN e MUBISYS_PUBLIC_KEY)",
      0,
    );
  }

  const url = new URL(`${BASE_URL}/${publicKey}/${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "Access-Token": token, Accept: "application/json" },
      signal: AbortSignal.timeout(opts?.timeoutMs ?? TIMEOUT_PADRAO_MS),
    });
  } catch (erro: any) {
    // AbortSignal.timeout() lança TimeoutError; falha de rede lança TypeError.
    throw new MubiSysError(`MubiSys inacessível (${erro?.name ?? "erro"}): ${path}`, 0);
  }

  // 404 = "não existe" ou "janela sem resultado". É resposta válida, não falha.
  if (response.status === 404) return null;

  // ⚠️ A API responde 201 em listagens e 200 em /cliente/{id}. Testar por
  // faixa, nunca por igualdade — ver docs/integracao-mubisys.md §1.
  if (response.status < 200 || response.status >= 300) {
    const body = await response.text().catch(() => "");
    throw new MubiSysError(
      `MubiSys API error ${response.status}: ${body.slice(0, 200)}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

/**
 * A API do MubiSys corta `datainicial`/`datafinal` de um jeito que perde
 * registros perto da borda do primeiro dia do período (155 vs 160 OS
 * aprovadas em um mês, medido em 01/09/2026 contra o painel web — ver
 * docs/integracao-mubisys.md §1 "datainicial/datafinal cortam a borda").
 * Contorno: pedir a API com 1 dia de folga em cada ponta e refiltrar aqui
 * pelo campo de data real (sem timezone, ex. "2026-08-03 08:38:30"),
 * comparando só a parte "YYYY-MM-DD" contra a janela pedida originalmente.
 */
function ajustarDias(dataISO: string, dias: number): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function refiltrarPorJanela<T>(
  itens: T[],
  campo: keyof T,
  datainicial: string,
  datafinal: string,
): T[] {
  return itens.filter((item) => {
    const valor = item[campo] as unknown as string | null;
    const dia = valor?.slice(0, 10);
    return !!dia && dia >= datainicial && dia <= datafinal;
  });
}

/** Percorre todas as páginas de um endpoint de lista do ERP. */
async function listarTudo<T>(
  path: string,
  params: Record<string, string>,
  opts?: { timeoutMs?: number; maxPaginas?: number; perPage?: number },
): Promise<{ itens: T[]; completo: boolean }> {
  const maxPaginas = opts?.maxPaginas ?? 50;
  const perPage = opts?.perPage ?? 500;
  const itens: T[] = [];
  let pagina = 1;

  while (pagina <= maxPaginas) {
    const resp = await mubisysGetOrNull<MubiSysListResponse<T>>(
      path,
      { ...params, page: String(pagina), per_page: String(perPage) },
      opts,
    );
    // 404 na primeira página = janela sem resultado. Não é erro.
    if (!resp) return { itens, completo: true };

    itens.push(...resp.data);
    const ultima = resp.pagination?.last_page ?? 1;
    if (pagina >= ultima || resp.data.length === 0) return { itens, completo: true };
    pagina++;
  }

  // Estourou o teto de páginas: o chamador precisa saber que os dados estão
  // incompletos (não gravar em cache persistente nesse caso).
  return { itens, completo: false };
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

/** Campo de data em MubiSysOS correspondente a cada valor de `filtrodata`.
 *  `PREV_ENTREGA` não tem entrada: `prazo` é texto livre ("02 dias úteis"),
 *  não há data para refiltrar — esse modo não recebe o contorno de borda. */
const CAMPO_DATA_OS: Partial<Record<OSFiltroDatas, keyof MubiSysOS>> = {
  CADASTRO: "data_cadastro",
  APROVACAO: "data_aprovacao",
  ENTREGA: "data_entrega",
  FATURAMENTO: "data_faturamento",
  CANCELAMENTO: "data_cancelamento",
};

export async function listarOSMubiSys(opts: {
  status?: OSStatus;
  filtrodata?: OSFiltroDatas;
  datainicial: string;
  datafinal: string;
}): Promise<{ itens: MubiSysOS[]; completo: boolean }> {
  const filtrodata = opts.filtrodata ?? "CADASTRO";
  const campo = CAMPO_DATA_OS[filtrodata];

  const { itens, completo } = await listarTudo<MubiSysOS>(
    "ordem-servico",
    {
      status: opts.status ?? "TODOS",
      filtrodata,
      datainicial: campo ? ajustarDias(opts.datainicial, -1) : opts.datainicial,
      datafinal: campo ? ajustarDias(opts.datafinal, 1) : opts.datafinal,
    },
    { timeoutMs: TIMEOUT_LISTA_MS },
  );

  if (!campo) return { itens, completo };
  return { itens: refiltrarPorJanela(itens, campo, opts.datainicial, opts.datafinal), completo };
}

export async function buscarOSPorId(id: number): Promise<MubiSysOS | null> {
  return mubisysGetOrNull<MubiSysOS>(`ordem-servico/${id}`, undefined, {
    timeoutMs: TIMEOUT_PONTUAL_MS,
  });
}

/**
 * Busca uma OS pelo número visível (sequencial_ordem).
 * Endpoint não documentado na coleção Postman, mas em produção e rápido
 * (~0,2 s). Devolve null quando a OS não existe (404).
 */
export async function buscarOSPorNumero(numero: string): Promise<MubiSysOS | null> {
  return mubisysGetOrNull<MubiSysOS>(
    `ordem-servico/numero/${encodeURIComponent(numero)}`,
    undefined,
    { timeoutMs: TIMEOUT_PONTUAL_MS },
  );
}

// ─── Orçamentos ──────────────────────────────────────────────────────────────

export async function listarOrcamentosMubiSys(opts: {
  status?: "TODOS" | "ABERTO" | "CANCELADO" | "APROVADO";
  datainicial: string;
  datafinal: string;
}): Promise<{ itens: MubiSysOrcamento[]; completo: boolean }> {
  const { itens, completo } = await listarTudo<MubiSysOrcamento>(
    "orcamento",
    {
      status: opts.status ?? "TODOS",
      filtrodata: "CADASTRO",
      datainicial: ajustarDias(opts.datainicial, -1),
      datafinal: ajustarDias(opts.datafinal, 1),
    },
    // per_page=500 (padrão de listarTudo) estoura TIMEOUT_LISTA_MS em janelas de
    // mês cheio (~800 orçamentos) — medido em 17/08/2026. 200 reduz o payload por
    // página o bastante para caber no orçamento de tempo sem precisar de retry.
    { timeoutMs: TIMEOUT_LISTA_MS, perPage: 200 },
  );
  return {
    itens: refiltrarPorJanela(itens, "data_cadastro", opts.datainicial, opts.datafinal),
    completo,
  };
}

// ─── Clientes ────────────────────────────────────────────────────────────────

/** GET /cliente/{id} — responde 200 (não 201). Use SEMPRE o `cliente_id` da
 *  OS, nunca o id de `cliente_endereco[0]`: são tabelas diferentes e a API
 *  aceita os dois, devolvendo clientes distintos (ver achado A1). */
export async function buscarClientePorId(clienteId: number): Promise<MubiSysCliente | null> {
  return mubisysGetOrNull<MubiSysCliente>(`cliente/${clienteId}`, undefined, {
    timeoutMs: TIMEOUT_PONTUAL_MS,
  });
}

/** GET /produto — o parâmetro `search` da API é ignorado (verificado); filtre
 *  em memória no chamador. */
export async function listarProdutos(): Promise<any[]> {
  const { itens } = await listarTudo<any>("produto", {}, { timeoutMs: TIMEOUT_PONTUAL_MS });
  return itens;
}

// ─── Token: aviso de expiração ───────────────────────────────────────────────

/** Decodifica o `exp` (epoch em segundos) do JWT em MUBISYS_ACCESS_TOKEN, sem
 *  validar assinatura — só para diagnóstico, não para autenticação. */
function decodificarExpToken(): number | undefined {
  const token = ENV.MUBISYS_ACCESS_TOKEN;
  if (!token) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return typeof payload?.exp === "number" ? payload.exp : undefined;
  } catch {
    // Token não-JWT ou formato inesperado: não é motivo para derrubar nada.
    return undefined;
  }
}

function expDoToken(): string | undefined {
  const exp = decodificarExpToken();
  return exp ? new Date(exp * 1000).toISOString() : undefined;
}

/** Avisa se o token está vencido. A API hoje não valida `exp` — se um dia
 *  validar, toda a integração cai de uma vez e este log é a única pista. */
function avisarSeTokenVencido(): void {
  const exp = decodificarExpToken();
  if (exp && exp * 1000 < Date.now()) {
    console.warn(
      `⚠️ [MubiSys] Token com exp vencido em ${new Date(exp * 1000).toISOString()}. ` +
        `A API ainda aceita, mas isso pode mudar sem aviso — renove no painel do ERP.`,
    );
  }
}
avisarSeTokenVencido();

// ─── Verificar conectividade ─────────────────────────────────────────────────

/**
 * Health check barato: uma consulta pontual (`buscarClientePorId`), não a
 * listagem de OS (~25 s/mês). 404 conta como saudável — a autenticação
 * funcionou, só o cliente 1 não existe. Só falha de rede/timeout ou erro de
 * autorização (`MubiSysError`) marca `ok: false`.
 */
export async function verificarConexaoMubiSys(): Promise<{
  ok: boolean;
  tokenExpiradoEm?: string;
  latenciaMs?: number;
  erro?: string;
}> {
  const inicio = Date.now();
  try {
    await buscarClientePorId(1);
    return { ok: true, latenciaMs: Date.now() - inicio, tokenExpiradoEm: expDoToken() };
  } catch (erro: any) {
    return { ok: false, latenciaMs: Date.now() - inicio, erro: erro?.message, tokenExpiradoEm: expDoToken() };
  }
}
