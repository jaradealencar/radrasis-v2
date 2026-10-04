/**
 * Espelho local do cadastro de clientes do MubiSys (`mubisys_clientes_cache`).
 *
 * Por que existe: `historico_os.telefone` só foi gravado a partir de 21/09/2026 e `historico_orcamentos` nunca teve
 * telefone, mas o cadastro de clientes tem o número de quase todos. A listagem paginada da API (100 por página, ~1s)
 * traz a base inteira em ~1 minuto — bem mais barato que uma consulta por cliente. As campanhas completam o telefone
 * em memória a partir deste espelho (ver `carregarContextoErp`), sem alterar o histórico.
 *
 * A sincronização é retomável e idempotente: cada chamada processa até `maxPaginas` páginas e devolve a próxima, para
 * caber nos 60s da Vercel. Falha de API numa página lança erro (não grava página parcial como se fosse completa).
 */
import { count, isNotNull, min, sql } from "drizzle-orm";
import { getDb } from "../db/db";
import { mubisysClientesCache } from "../../drizzle/schema";
import { listarClientesPagina } from "../integrations/mubisys-client";
import { normalizarTelefone } from "../../shared/campanhas-whatsapp";
import { normalizeEmpresaKey } from "../services/probabilidadeCompra";

export const MAX_PAGINAS_POR_LOTE = 20;
/** Orçamento de tempo de um lote: para antes dos 60s da Vercel (retentativas de 429 podem alongar as páginas). */
export const ORCAMENTO_LOTE_MS = 40_000;
/** Depois disso o espelho é considerado velho e a tela o atualiza sozinha. */
export const CACHE_CLIENTES_VALIDADE_HORAS = 24;

/** Melhor número de WhatsApp do cadastro: celular de contato ativo, depois os telefones do cliente e, por último,
 * qualquer contato. Só vale número que `normalizarTelefone` aceita; devolve já normalizado (ou null). */
export function escolherTelefoneCliente(cliente: any): string | null {
  const contatos: any[] = Array.isArray(cliente?.contatos) ? cliente.contatos : [];
  const ativo = (c: any) => String(c?.status ?? "").toLowerCase() !== "inativo";
  const candidatos = [
    ...contatos.filter(ativo).map(c => c?.celular),
    cliente?.telefone_pri,
    cliente?.telefone_sec,
    ...contatos.filter(ativo).map(c => c?.telefone),
    ...contatos.filter(c => !ativo(c)).map(c => c?.celular),
  ];
  for (const bruto of candidatos) {
    const n = normalizarTelefone(bruto);
    if (n) return n;
  }
  return null;
}

export interface LoteClientes {
  paginaInicial: number; paginasProcessadas: number; ultimaPagina: number;
  /** `null` quando a base inteira foi lida. */
  proximaPagina: number | null; clientes: number; comTelefone: number;
}

export async function sincronizarClientesLote(paginaInicial = 1, maxPaginas = MAX_PAGINAS_POR_LOTE): Promise<LoteClientes> {
  if (!Number.isInteger(paginaInicial) || paginaInicial < 1) throw new Error("A página inicial deve ser um inteiro positivo.");
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para sincronizar clientes.");

  const inicio = Date.now();
  let pagina = paginaInicial, ultimaPagina = paginaInicial, clientes = 0, comTelefone = 0, processadas = 0;
  while (processadas < maxPaginas && pagina <= ultimaPagina && Date.now() - inicio < ORCAMENTO_LOTE_MS) {
    let resposta;
    try {
      resposta = await listarClientesPagina(pagina);
    } catch (erro) {
      const detalhe = erro instanceof Error ? erro.message : String(erro);
      console.error(`[CLIENTES-MUBISYS] página ${pagina}:`, erro);
      throw new Error(`Falha ao ler a página ${pagina} do cadastro de clientes do MubiSys: ${detalhe}`);
    }
    ultimaPagina = resposta.pagination?.last_page ?? pagina;
    const linhas = resposta.data
      .filter(c => Number.isInteger(c?.id) && c.id > 0)
      .map(c => ({
        id: c.id as number,
        nomeFantasia: c.nome_fantasia ? String(c.nome_fantasia).slice(0, 256) : null,
        razaoSocial: c.razao_social ? String(c.razao_social).slice(0, 256) : null,
        telefone: escolherTelefoneCliente(c),
      }));
    if (linhas.length > 0) {
      await db.insert(mubisysClientesCache).values(linhas).onConflictDoUpdate({
        target: mubisysClientesCache.id,
        set: {
          nomeFantasia: sql`excluded.nome_fantasia`, razaoSocial: sql`excluded.razao_social`,
          telefone: sql`excluded.telefone`, atualizadoEm: sql`now()`,
        },
      });
    }
    clientes += linhas.length;
    comTelefone += linhas.filter(l => l.telefone).length;
    processadas++;
    pagina++;
  }
  return { paginaInicial, paginasProcessadas: processadas, ultimaPagina, proximaPagina: pagina <= ultimaPagina ? pagina : null, clientes, comTelefone };
}

export interface StatusCacheClientes { total: number; comTelefone: number; atualizadoEm: Date | null; obsoleto: boolean }

export async function statusCacheClientes(agora: Date = new Date()): Promise<StatusCacheClientes> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const [r] = await db.select({
    total: count(), comTelefone: count(mubisysClientesCache.telefone), ultima: min(mubisysClientesCache.atualizadoEm),
  }).from(mubisysClientesCache);
  const atualizadoEm = r?.ultima ? new Date(r.ultima) : null;
  const idadeH = atualizadoEm ? (agora.getTime() - atualizadoEm.getTime()) / 3_600_000 : Infinity;
  return { total: Number(r?.total ?? 0), comTelefone: Number(r?.comTelefone ?? 0), atualizadoEm, obsoleto: idadeH > CACHE_CLIENTES_VALIDADE_HORAS };
}

export interface TelefonesClientes { porId: Map<number, string>; porNome: Map<string, string> }

/** Telefones do espelho indexados por id do cliente e por nome normalizado (fantasia e razão social). Nome repetido
 * entre clientes diferentes: vale o de menor id, de forma determinística. */
export async function carregarTelefonesClientes(): Promise<TelefonesClientes> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const rows = await db.select({
    id: mubisysClientesCache.id, nomeFantasia: mubisysClientesCache.nomeFantasia,
    razaoSocial: mubisysClientesCache.razaoSocial, telefone: mubisysClientesCache.telefone,
  }).from(mubisysClientesCache).where(isNotNull(mubisysClientesCache.telefone)).orderBy(mubisysClientesCache.id);
  return indexarTelefonesClientes(rows);
}

export function indexarTelefonesClientes(
  rows: Array<{ id: number; nomeFantasia: string | null; razaoSocial: string | null; telefone: string | null }>,
): TelefonesClientes {
  const porId = new Map<number, string>(), porNome = new Map<string, string>();
  for (const r of rows) {
    if (!r.telefone) continue;
    porId.set(r.id, r.telefone);
    for (const nome of [r.nomeFantasia, r.razaoSocial]) {
      const chave = normalizeEmpresaKey(nome ?? "");
      if (chave && !porNome.has(chave)) porNome.set(chave, r.telefone);
    }
  }
  return { porId, porNome };
}

/** Preenche (em memória) o telefone que falta: por id do cliente quando a linha o traz, senão pelo nome da empresa.
 * Nunca sobrescreve um telefone já gravado. Devolve quantas linhas foram completadas. */
export function completarTelefonesPeloCadastro<T extends { empresa: string | null; telefone: string | null; clienteId?: number | null }>(
  linhas: T[], cadastro: TelefonesClientes,
): number {
  let completadas = 0;
  for (const l of linhas) {
    if (l.telefone && l.telefone.trim()) continue;
    const doCadastro = (l.clienteId != null ? cadastro.porId.get(l.clienteId) : undefined)
      ?? cadastro.porNome.get(normalizeEmpresaKey(l.empresa ?? ""));
    if (doCadastro) { l.telefone = doCadastro; completadas++; }
  }
  return completadas;
}
