import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import {
  historicoOs, guiaFornecedoresCliques, guiaFornecedoresVisitas, guiaFornecedoresOverrides, guiaFornecedoresConfig,
} from "../../drizzle/schema";
import { isOsNormalDb, normalizeEmpresaKey, isClienteNovoPorRecencia, formatarLinkWhatsApp } from "./performanceComercial";

/**
 * Guia de Fornecedores — página pública (sem login) que indica a consumidor final os clientes
 * da Letreiros Express que compraram 2+ vezes nos últimos 12 meses e continuam ativos.
 * Servida em dois lugares que consomem este MESMO router:
 *  - client/src/pages/comercial/GuiaFornecedores.tsx — aba interna (protegida) para o Daniel
 *    gerenciar (ver estatísticas, incluir/excluir manualmente).
 *  - o site espelho, em domínio separado, para os clientes finais (sem acesso ao radrasis).
 *
 * REGRA DE NEGÓCIO (nome de referência: "Guia de Fornecedores — critério de ativo", distinta
 * da "Lógica do Cliente Novo e Reativado" de 6 meses usada no Performance Comercial — aqui o
 * limite de inatividade é 4 meses, escolha deliberada do Daniel em 21/09/2026, não usar
 * MESES_INATIVIDADE_PARA_NOVO por engano):
 *   um fornecedor aparece no guia se (a) teve 2+ O.S. válidas nos últimos 12 meses corridos
 *   (rolante, não ano civil — recalculado a cada consulta) E (b) a última O.S. válida foi há
 *   no máximo 4 meses. A condição (b) pesa mais: um fornecedor com 5 compras só que a última
 *   foi há 5 meses SAI do guia mesmo assim.
 */

const MESES_JANELA_CONTAGEM = 12;
const MESES_LIMITE_INATIVIDADE = 4;

/** Texto padrão do botão de WhatsApp — o "*negrito*" é a sintaxe de formatação do próprio
 * WhatsApp (renderiza em negrito no app), não é markdown a converter aqui. Editável pela aba
 * interna (guiaFornecedoresConfig); isto é só o valor inicial da linha única da tabela. */
export const MENSAGEM_WHATSAPP_PADRAO =
  "Oi, peguei o contato de vocês da lista de indicações da *Letreiros Express*, preciso de um orçamento.";

// Contas administrativas/teste do MubiSys, não são clientes de verdade — mesma descoberta de
// 19-21/09/2026 (e-mail "@@@", CNPJ "aa", contato = nome da própria conta).
const CONTAS_NAO_SAO_FORNECEDORES = new Set(["mubis", "cliente diversos", "cliente teste contratos"]);

/** "+55 (00) 00000-0000" tem 13 dígitos e passaria despercebido por uma checagem só de
 * tamanho — descoberta em 19/09/2026 processando o cadastro de clientes manual; mantido aqui
 * como guarda geral porque o mesmo padrão de placeholder pode aparecer no cliente_contato
 * bruto da API MubiSys. */
function pareceTelefonePlaceholder(digitos: string): boolean {
  const semDDI = digitos.length >= 12 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
  const ddd = semDDI.slice(0, 2);
  const resto = semDDI.slice(2);
  if (ddd === "00") return true;
  if (/^0+$/.test(resto)) return true;
  if (new Set(resto.split("")).size === 1) return true;
  return false;
}

function telefoneValido(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const digitos = tel.replace(/\D/g, "").replace(/^0+/, "");
  if (digitos.length < 10 || digitos.length > 13) return null;
  if (pareceTelefonePlaceholder(digitos)) return null;
  return digitos;
}

const CONECTIVOS_CIDADE = new Set(["de", "da", "do", "das", "dos", "e"]);
function titleCase(s: string): string {
  return s.toLowerCase().split(" ")
    .map((p, i) => (i > 0 && CONECTIVOS_CIDADE.has(p) ? p : p.replace(/(^|-)([a-zà-ú])/g, (_, sep, c) => sep + c.toUpperCase())))
    .join(" ");
}
function chaveSemAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const ESTADOS_NOME: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

interface FornecedorCalculado {
  chave: string;
  nome: string;
  cidade: string;
  estado: string;
  telefone: string | null;
  origem: "automatico" | "manual";
}

/** Monta a lista de fornecedores ativos: calcula a partir de historico_os e aplica os
 * overrides manuais (incluir força a entrada mesmo sem qualificar; excluir tira mesmo
 * qualificando). Função pura — sem I/O — para poder testar a regra isoladamente. */
export function calcularFornecedoresAtivos(
  linhas: Array<{ empresa: string | null; cidade: string | null; estado: string | null; telefone: string | null; tipoOs: string | null; status: string | null; mes: number; ano: number }>,
  overrides: Array<{ empresaChave: string; empresaNome: string; acao: "incluir" | "excluir"; telefone: string | null; cidade: string | null; estado: string | null }>,
  hoje: Date = new Date(),
): FornecedorCalculado[] {
  const mesAtual = hoje.getMonth() + 1, anoAtual = hoje.getFullYear();
  // Início da janela rolante de 12 meses (inclui o mês corrente parcial)
  const inicioJanela = anoAtual * 12 + mesAtual - (MESES_JANELA_CONTAGEM - 1);

  type Grupo = { nomes: Map<string, number>; qtdJanela: number; ultima: { mes: number; ano: number; cidade: string; estado: string; telefone: string | null } | null };
  const porCliente = new Map<string, Grupo>();

  for (const l of linhas) {
    if (!isOsNormalDb(l)) continue;
    const nome = (l.empresa ?? "").trim();
    if (!nome) continue;
    const chave = normalizeEmpresaKey(nome);
    if (CONTAS_NAO_SAO_FORNECEDORES.has(chave)) continue;

    if (!porCliente.has(chave)) porCliente.set(chave, { nomes: new Map(), qtdJanela: 0, ultima: null });
    const g = porCliente.get(chave)!;
    g.nomes.set(nome, (g.nomes.get(nome) ?? 0) + 1);

    const chaveMes = l.ano * 12 + l.mes;
    if (chaveMes >= inicioJanela) g.qtdJanela++;
    if (!g.ultima || chaveMes > g.ultima.ano * 12 + g.ultima.mes) {
      g.ultima = { mes: l.mes, ano: l.ano, cidade: l.cidade ?? "", estado: (l.estado ?? "").toUpperCase(), telefone: l.telefone };
    }
  }

  const porOverride = new Map(overrides.map(o => [o.empresaChave, o]));
  const resultado: FornecedorCalculado[] = [];

  for (const [chave, g] of porCliente) {
    const override = porOverride.get(chave);
    if (override?.acao === "excluir") continue;

    const ativo = g.ultima ? !isClienteNovoPorRecencia({ mes: g.ultima.mes, ano: g.ultima.ano }, mesAtual, anoAtual, MESES_LIMITE_INATIVIDADE) : false;
    const qualifica = g.qtdJanela >= 2 && ativo;
    if (!qualifica && override?.acao !== "incluir") continue;

    const nomeDisplay = [...g.nomes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    resultado.push({
      chave,
      nome: nomeDisplay,
      cidade: override?.cidade || g.ultima?.cidade || "",
      estado: (override?.estado || g.ultima?.estado || "").toUpperCase(),
      telefone: telefoneValido(override?.telefone || g.ultima?.telefone),
      origem: qualifica ? "automatico" : "manual",
    });
  }

  // Fornecedores incluídos manualmente que não têm NENHUMA O.S. no período consultado
  // (chave nem aparece em porCliente) — ex.: parceiro estratégico que não compra com frequência.
  for (const o of overrides) {
    if (o.acao !== "incluir" || porCliente.has(o.empresaChave)) continue;
    resultado.push({
      chave: o.empresaChave, nome: o.empresaNome,
      cidade: o.cidade || "", estado: (o.estado || "").toUpperCase(),
      telefone: telefoneValido(o.telefone), origem: "manual",
    });
  }

  return resultado;
}

export interface FornecedorGuia {
  nome: string;
  cidade: string;
  telefone: string | null;
  whatsapp: string | null;
}
export interface EstadoGuia {
  uf: string;
  nome: string;
  total: number;
  cidades: Array<{ cidade: string; fornecedores: FornecedorGuia[] }>;
}
export interface GuiaFornecedoresResultado {
  geradoEm: string;
  totalFornecedores: number;
  estados: EstadoGuia[];
}

/** Agrupa por estado > cidade (unificando grafias com/sem acento da mesma cidade) e monta o
 * formato final da resposta, na mesma ordem/estrutura usada pelo guia. `mensagemWhatsapp` vai
 * já embutida no link (`?text=`), para o consumidor final não precisar digitar nada. */
function agruparPorEstadoCidade(fornecedores: FornecedorCalculado[], mensagemWhatsapp: string): GuiaFornecedoresResultado {
  const comLocal = fornecedores.filter(f => f.estado);

  // Unifica grafias de cidade dentro do mesmo estado (ex.: "Varzea Grande"/"Várzea Grande")
  const porEstadoCidade = new Map<string, Map<string, number>>();
  for (const f of comLocal) {
    const cidadeTitulo = f.cidade ? titleCase(f.cidade) : "(cidade não informada)";
    const k = `${f.estado}|${chaveSemAcento(cidadeTitulo)}`;
    if (!porEstadoCidade.has(k)) porEstadoCidade.set(k, new Map());
    const m = porEstadoCidade.get(k)!;
    m.set(cidadeTitulo, (m.get(cidadeTitulo) ?? 0) + 1);
  }
  const canonico = new Map<string, string>();
  for (const [k, grafias] of porEstadoCidade) {
    const qtdAcentos = (s: string) => (s.normalize("NFD").match(/[̀-ͯ]/g) ?? []).length;
    canonico.set(k, [...grafias.entries()].sort((a, b) => qtdAcentos(b[0]) - qtdAcentos(a[0]) || b[1] - a[1])[0][0]);
  }

  const porEstado = new Map<string, Map<string, FornecedorGuia[]>>();
  for (const f of comLocal) {
    const cidadeTitulo = f.cidade ? titleCase(f.cidade) : "(cidade não informada)";
    const cidadeFinal = canonico.get(`${f.estado}|${chaveSemAcento(cidadeTitulo)}`) ?? cidadeTitulo;
    if (!porEstado.has(f.estado)) porEstado.set(f.estado, new Map());
    const porCidade = porEstado.get(f.estado)!;
    if (!porCidade.has(cidadeFinal)) porCidade.set(cidadeFinal, []);
    const link = f.telefone ? formatarLinkWhatsApp(f.telefone) : "";
    porCidade.get(cidadeFinal)!.push({
      nome: f.nome, cidade: cidadeFinal, telefone: f.telefone,
      whatsapp: link ? `${link}?text=${encodeURIComponent(mensagemWhatsapp)}` : null,
    });
  }

  const ufsOrdenadas = [...porEstado.keys()].sort((a, b) => (ESTADOS_NOME[a] ?? a).localeCompare(ESTADOS_NOME[b] ?? b, "pt-BR"));
  const estados: EstadoGuia[] = ufsOrdenadas.map(uf => {
    const porCidade = porEstado.get(uf)!;
    const cidades = [...porCidade.keys()].sort((a, b) => a.localeCompare(b, "pt-BR")).map(cidade => ({
      cidade,
      fornecedores: porCidade.get(cidade)!.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    }));
    return { uf, nome: ESTADOS_NOME[uf] ?? uf, total: cidades.reduce((s, c) => s + c.fornecedores.length, 0), cidades };
  });

  return {
    geradoEm: new Date().toISOString(),
    totalFornecedores: estados.reduce((s, e) => s + e.total, 0),
    estados,
  };
}

async function obterMensagemWhatsapp(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<string> {
  const [linha] = await db.select().from(guiaFornecedoresConfig).where(eq(guiaFornecedoresConfig.id, 1)).limit(1);
  return linha?.mensagemWhatsapp || MENSAGEM_WHATSAPP_PADRAO;
}

async function montarGuia(): Promise<GuiaFornecedoresResultado> {
  const db = await getDb();
  if (!db) return { geradoEm: new Date().toISOString(), totalFornecedores: 0, estados: [] };

  const linhas = await db.select({
    empresa: historicoOs.empresa, cidade: historicoOs.cidade, estado: historicoOs.estado,
    telefone: historicoOs.telefone, tipoOs: historicoOs.tipoOs, status: historicoOs.status,
    mes: historicoOs.mes, ano: historicoOs.ano,
  }).from(historicoOs);

  const [overridesRows, mensagemWhatsapp] = await Promise.all([
    db.select().from(guiaFornecedoresOverrides),
    obterMensagemWhatsapp(db),
  ]);
  const fornecedores = calcularFornecedoresAtivos(linhas, overridesRows);
  return agruparPorEstadoCidade(fornecedores, mensagemWhatsapp);
}

export const guiaFornecedoresRouter = router({
  /** Lista pública — usada pela aba interna (preview) e pelo site espelho. Sem dado sensível:
   * nem contagem de compras, nem valor, nem cliques — só nome/cidade/telefone. */
  listarPublico: publicProcedure.query(() => montarGuia()),

  /** Uma linha por carregamento de página; front-end manda um id anônimo gerado no navegador
   * (localStorage), nunca IP ou dado que identifique a pessoa. */
  registrarVisita: publicProcedure
    .input(z.object({ visitanteId: z.string().trim().min(8).max(64) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      await db.insert(guiaFornecedoresVisitas).values({ visitanteId: input.visitanteId });
      return { ok: true };
    }),

  /** Conta 1 clique no botão de WhatsApp de um fornecedor (upsert por nome normalizado). */
  registrarClique: publicProcedure
    .input(z.object({ empresa: z.string().trim().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      const chave = normalizeEmpresaKey(input.empresa);
      const agora = new Date();
      await db.insert(guiaFornecedoresCliques)
        .values({ empresaChave: chave, empresaNome: input.empresa, cliques: 1, ultimoCliqueEm: agora })
        .onConflictDoUpdate({
          target: guiaFornecedoresCliques.empresaChave,
          set: { cliques: sql`${guiaFornecedoresCliques.cliques} + 1`, ultimoCliqueEm: agora, empresaNome: input.empresa, updatedAt: agora },
        });
      return { ok: true };
    }),

  // ─── Aba interna (protegida) ────────────────────────────────────────────────

  /** Estatísticas para o painel interno: visitas totais/únicas (30 dias) e cliques por
   * fornecedor. Também devolve `naoQualificados` — fornecedores que têm clique registrado mas
   * já saíram da lista automática, útil para o Daniel decidir se cria um "incluir" manual. */
  getEstatisticas: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { visitasTotais: 0, visitantesUnicos: 0, cliques: [] as Array<{ empresaNome: string; cliques: number; ultimoCliqueEm: Date | null; ativoNoGuia: boolean }> };

    const desde30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [{ total, unicos }] = await db.select({
      total: sql<number>`count(*)::int`,
      unicos: sql<number>`count(distinct ${guiaFornecedoresVisitas.visitanteId})::int`,
    }).from(guiaFornecedoresVisitas).where(sql`${guiaFornecedoresVisitas.createdAt} >= ${desde30d}`);

    const cliquesRows = await db.select().from(guiaFornecedoresCliques).orderBy(desc(guiaFornecedoresCliques.cliques));
    const guiaAtual = await montarGuia();
    const chavesNoGuia = new Set(guiaAtual.estados.flatMap(e => e.cidades.flatMap(c => c.fornecedores.map(f => normalizeEmpresaKey(f.nome)))));

    return {
      visitasTotais: total, visitantesUnicos: unicos,
      cliques: cliquesRows.map(c => ({
        empresaNome: c.empresaNome, cliques: c.cliques, ultimoCliqueEm: c.ultimoCliqueEm,
        ativoNoGuia: chavesNoGuia.has(c.empresaChave),
      })),
    };
  }),

  /** Config atual (mensagem do WhatsApp). Sempre devolve algo, mesmo sem linha salva ainda. */
  getConfig: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { mensagemWhatsapp: MENSAGEM_WHATSAPP_PADRAO, usuarioNome: null, updatedAt: null };
    const [linha] = await db.select().from(guiaFornecedoresConfig).where(eq(guiaFornecedoresConfig.id, 1)).limit(1);
    return linha ?? { mensagemWhatsapp: MENSAGEM_WHATSAPP_PADRAO, usuarioNome: null, updatedAt: null };
  }),

  salvarConfig: protectedProcedure
    .input(z.object({ mensagemWhatsapp: z.string().trim().min(1).max(1000) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const dados = { mensagemWhatsapp: input.mensagemWhatsapp, usuarioNome: ctx.user?.name ?? "Desconhecido", updatedAt: new Date() };
      await db.insert(guiaFornecedoresConfig)
        .values({ id: 1, ...dados })
        .onConflictDoUpdate({ target: guiaFornecedoresConfig.id, set: dados });
      return { ok: true };
    }),

  listarOverrides: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(guiaFornecedoresOverrides).orderBy(desc(guiaFornecedoresOverrides.updatedAt));
  }),

  /** Cria/atualiza um ajuste manual. `acao: "incluir"` aceita telefone/cidade/estado (para um
   * fornecedor sem O.S. recente o suficiente para ter esses dados em historico_os). */
  salvarOverride: protectedProcedure
    .input(z.object({
      empresa: z.string().trim().min(1).max(256),
      acao: z.enum(["incluir", "excluir"]),
      telefone: z.string().trim().max(32).optional(),
      cidade: z.string().trim().max(128).optional(),
      estado: z.string().trim().length(2).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const chave = normalizeEmpresaKey(input.empresa);
      const agora = new Date();
      const dados = {
        empresaNome: input.empresa, acao: input.acao,
        telefone: input.telefone || null, cidade: input.cidade || null, estado: input.estado?.toUpperCase() || null,
        usuarioId: ctx.user?.id ?? null, usuarioNome: ctx.user?.name ?? "Desconhecido", updatedAt: agora,
      };
      await db.insert(guiaFornecedoresOverrides)
        .values({ empresaChave: chave, ...dados })
        .onConflictDoUpdate({ target: guiaFornecedoresOverrides.empresaChave, set: dados });
      return { ok: true };
    }),

  removerOverride: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.delete(guiaFornecedoresOverrides).where(eq(guiaFornecedoresOverrides.id, input.id));
      return { ok: true };
    }),
});
