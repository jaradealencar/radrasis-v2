/**
 * Campanhas WhatsApp — cadência, quarentena anti-spam e pós-venda (endpoints tRPC).
 *
 * Regra de negócio pura em server/services/campanhasWhatsapp.ts; datas/telefone/semáforo em
 * shared/campanhas-whatsapp.ts. Aqui ficam só o acesso ao banco e a validação de entrada. As funções
 * `registrarDisparoNoBanco` e `checarQuarentenaNoBanco` são exportadas para os webhooks REST
 * (server/routes/campanhas-whatsapp-api.ts) reaproveitarem sem duplicar regra.
 *
 * O registro de um disparo (log + quarentena + vendas contatadas) é UM statement SQL com CTEs, não uma transação:
 * o driver Neon roda em modo HTTP (ver server/db/db-connection.ts) e não suporta `db.transaction`. Um statement
 * com CTEs de escrita é atômico no Postgres — ou grava tudo ou nada.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, inArray, isNotNull, lte, max, sql } from "drizzle-orm";
import { protectedProcedure, requireRole, router } from "../_core/trpc";
import { getDb } from "../db/db";
import { getPool } from "../db/db-connection";
import {
  campanhasWhatsapp, campanhasWhatsappAgendamentos, campanhasWhatsappArquivos, campanhasWhatsappCampanhaFontes,
  campanhasWhatsappCategorias, campanhasWhatsappContatosHistorico, campanhasWhatsappDisparos, campanhasWhatsappFontes,
  campanhasWhatsappGatilhos, campanhasWhatsappScripts, historicoOs,
  type CampanhaWhatsapp,
} from "../../drizzle/schema";
import {
  STATUS_AGENDAMENTO, STATUS_CAMPANHA, TIPOS_CAMPANHA,
  calcularProximoEnvio, classificarSemaforo, dataIsoValida, diasEntre, gerarChaveCategoria, hojeCampoGrande,
  normalizarTelefone, somarDias,
} from "../../shared/campanhas-whatsapp";
import {
  expandirPrevistos, filtrarPorCadenciaCampanha, higienizarLista, listarVendasPosVenda, montarStatusCampanha,
  resumirCampanhas, resumirVendas,
  type ContatoIgnorado, type ContatoInvalido, type VendaPosVenda,
} from "../services/campanhasWhatsapp";
import { lerArquivoDeUrl, resolverFonteErp, type ContatoFonte } from "../services/fontesErpCampanhas";
import { isOsNormalDb } from "./performanceComercial";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Mesmo público da área de Crescimento (Inteligência de Clientes): a aba fica ao lado do ROI Marketing e a lista
 * guarda telefones de clientes, então o gate de role vale também no servidor, não só na tela. */
const campanhasProcedure = protectedProcedure.use(requireRole("admin", "master", "gestor"));

export const MAX_CONTATOS_POR_DISPARO = 20_000;
const MAX_LISTA_TELA = 500;
const MAX_JANELA_CALENDARIO_DIAS = 62;

// ─── Schemas de entrada (exportados: o REST valida com os mesmos) ───────────

export const dataIsoSchema = z.string().refine(dataIsoValida, "Data inválida (use AAAA-MM-DD)");

export const contatosSchema = z.array(z.object({
  telefone: z.union([z.string().max(40), z.number()]),
  nome: z.string().max(200).nullish(),
  osNumero: z.string().max(32).nullish(),
})).min(1, "A lista está vazia").max(MAX_CONTATOS_POR_DISPARO, `Máximo de ${MAX_CONTATOS_POR_DISPARO} contatos por disparo`);

const categoriaLabelSchema = z.string().trim().min(1, "Informe o nome da categoria").max(80);

const campanhaBaseSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(160),
  // Chave de campanhasWhatsappCategorias — validada contra o banco em `criar`/`atualizar` (ver `validarCategoria`),
  // não por z.enum: a lista de categorias é editável pelo usuário, não um conjunto fixo em código.
  categoria: z.string().trim().min(1, "Selecione a categoria").max(64),
  // Anotação livre (objetivo, público-alvo, roteiro combinado...); não entra em nenhuma regra de negócio.
  descricao: z.string().trim().max(2000).nullish(),
  tipo: z.enum(TIPOS_CAMPANHA),
  frequenciaDias: z.number().int().min(1).max(730),
  quarentenaDias: z.number().int().min(0).max(365),
  gatilhoAPartirDe: dataIsoSchema.nullish(),
});

// ─── Utilitários ────────────────────────────────────────────────────────────

/** `date` do Postgres chega como string via drizzle; defensivo caso algum driver devolva `Date`. */
function iso(v: unknown): string {
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

async function obterDb(): Promise<Db> {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  return db;
}

async function buscarCampanha(db: Db, id: number): Promise<CampanhaWhatsapp> {
  const [c] = await db.select().from(campanhasWhatsapp).where(eq(campanhasWhatsapp.id, id)).limit(1);
  if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });
  return c;
}

/** A categoria pode estar arquivada (permitido: uma campanha antiga mantém a categoria) mas precisa existir. */
async function validarCategoria(db: Db, chave: string): Promise<void> {
  const [c] = await db.select({ id: campanhasWhatsappCategorias.id }).from(campanhasWhatsappCategorias)
    .where(eq(campanhasWhatsappCategorias.chave, chave)).limit(1);
  if (!c) throw new TRPCError({ code: "BAD_REQUEST", message: "Categoria inválida — atualize a página e tente de novo." });
}

async function ultimosEnvios(db: Db): Promise<Map<number, string>> {
  const rows = await db
    .select({ campanhaId: campanhasWhatsappDisparos.campanhaId, ultimo: max(campanhasWhatsappDisparos.enviadoEm) })
    .from(campanhasWhatsappDisparos)
    .groupBy(campanhasWhatsappDisparos.campanhaId);
  return new Map(rows.filter(r => r.ultimo).map(r => [r.campanhaId, iso(r.ultimo)]));
}

/**
 * Vendas de pós-venda de várias campanhas de uma vez. O histórico de OS é lido UMA vez (só as colunas necessárias)
 * e cada campanha aplica seu próprio corte; venda já contatada sai da lista.
 */
async function carregarPosVenda(
  db: Db, campanhas: CampanhaWhatsapp[], hoje: string,
): Promise<Map<number, ReturnType<typeof listarVendasPosVenda>>> {
  const resultado = new Map<number, ReturnType<typeof listarVendasPosVenda>>();
  const gatilho = campanhas.filter(c => c.tipo === "gatilho_venda");
  if (gatilho.length === 0) return resultado;

  // `ano` do historico_os pode ser o da aprovação (anterior ao do faturamento): folga de 1 ano no pré-filtro.
  const anoMinimo = gatilho.some(c => !c.gatilhoAPartirDe)
    ? null
    : Math.min(...gatilho.map(c => Number(c.gatilhoAPartirDe!.slice(0, 4)))) - 1;

  const linhas = (await db
    .select({
      osNumero: historicoOs.osNumero, empresa: historicoOs.empresa, telefone: historicoOs.telefone,
      dataFaturamento: historicoOs.dataFaturamento, vendedor: historicoOs.vendedor, valorOs: historicoOs.valorOs,
      tipoOs: historicoOs.tipoOs, status: historicoOs.status,
    })
    .from(historicoOs)
    .where(and(
      isNotNull(historicoOs.osNumero), isNotNull(historicoOs.dataFaturamento),
      anoMinimo === null ? undefined : gte(historicoOs.ano, anoMinimo),
    ))).filter(isOsNormalDb);

  const contatadas = await db
    .select({ campanhaId: campanhasWhatsappGatilhos.campanhaId, osNumero: campanhasWhatsappGatilhos.osNumero })
    .from(campanhasWhatsappGatilhos)
    .where(inArray(campanhasWhatsappGatilhos.campanhaId, gatilho.map(c => c.id)));
  const contatadasPorCampanha = new Map<number, Set<string>>();
  for (const r of contatadas) {
    if (!contatadasPorCampanha.has(r.campanhaId)) contatadasPorCampanha.set(r.campanhaId, new Set());
    contatadasPorCampanha.get(r.campanhaId)!.add(r.osNumero);
  }

  for (const c of gatilho) {
    resultado.set(c.id, listarVendasPosVenda(
      linhas,
      { frequenciaDias: c.frequenciaDias, gatilhoAPartirDe: c.gatilhoAPartirDe ? iso(c.gatilhoAPartirDe) : null },
      hoje,
      contatadasPorCampanha.get(c.id) ?? new Set(),
    ));
  }
  return resultado;
}

/** Último contato de cada telefone informado (telefones já normalizados). Uma ida ao banco. */
async function buscarQuarentena(telefones: string[]): Promise<Map<string, string>> {
  if (telefones.length === 0) return new Map();
  const r = await getPool().query(
    `SELECT telefone, ultimo_contato_em::text AS ultimo
       FROM campanhas_whatsapp_quarentena WHERE telefone = ANY($1::text[])`,
    [telefones],
  );
  return new Map(r.rows.map((row: { telefone: string; ultimo: string }) => [row.telefone, row.ultimo]));
}

// ─── Verificação de quarentena (tRPC e REST) ────────────────────────────────

export interface ResultadoVerificacao {
  quarentenaDias: number;
  resultados: Array<{
    original: string;
    /** `null` quando o número não parece um telefone brasileiro válido. */
    telefone: string | null;
    emQuarentena: boolean;
    ultimoContatoEm: string | null;
    disponivelEm: string | null;
  }>;
  resumo: { total: number; emQuarentena: number; disponiveis: number; invalidos: number };
}

export async function checarQuarentenaNoBanco(
  telefones: Array<string | number>, quarentenaDias: number, dataReferencia: string = hojeCampoGrande(),
): Promise<ResultadoVerificacao> {
  const normalizados = telefones.map(t => normalizarTelefone(t));
  const mapa = await buscarQuarentena([...new Set(normalizados.filter((t): t is string => !!t))]);

  const resultados = telefones.map((original, i) => {
    const telefone = normalizados[i];
    const ultimo = telefone ? mapa.get(telefone) ?? null : null;
    const emQuarentena = !!ultimo && quarentenaDias > 0 && Math.abs(diasEntre(ultimo, dataReferencia)) < quarentenaDias;
    return {
      original: String(original),
      telefone,
      emQuarentena,
      ultimoContatoEm: ultimo,
      disponivelEm: ultimo && quarentenaDias > 0 ? somarDias(ultimo, quarentenaDias) : null,
    };
  });

  const invalidos = resultados.filter(r => !r.telefone).length;
  const emQuarentena = resultados.filter(r => r.emQuarentena).length;
  return {
    quarentenaDias,
    resultados,
    resumo: { total: resultados.length, emQuarentena, invalidos, disponiveis: resultados.length - emQuarentena - invalidos },
  };
}

// ─── Registro de disparo (tRPC e REST) ──────────────────────────────────────

export interface ParametrosDisparo {
  campanhaId: number;
  dataEnvio: string;
  contatos: z.infer<typeof contatosSchema>;
  observacoes?: string | null;
  arquivoUrl?: string | null;
  arquivoNome?: string | null;
  origem: "app" | "api";
  registradoPor: string;
  /**
   * `true` (tela): a lista ainda NÃO foi enviada — quem está em quarentena sai dela.
   * `false` (webhook): a lista JÁ foi enviada — tudo que é válido é registrado e a quarentena só é reportada
   * (`violacoesQuarentena`), porque descartar do registro quem de fato recebeu deixaria a trava cega.
   */
  aplicarQuarentena: boolean;
}

export interface ResultadoDisparo {
  /** `false` quando nenhum contato pôde ser enviado: nada é gravado (não faz sentido adiar o próximo envio). */
  registrado: boolean;
  disparoId: number | null;
  proximaData: string | null;
  recebidos: number;
  enviados: number;
  ignorados: number;
  invalidos: number;
  violacoesQuarentena: number;
  enviar: Array<{ telefone: string; nome: string }>;
  ignoradosQuarentena: ContatoIgnorado[];
  invalidosLista: ContatoInvalido[];
}

export async function registrarDisparoNoBanco(p: ParametrosDisparo): Promise<ResultadoDisparo> {
  const db = await obterDb();
  const campanha = await buscarCampanha(db, p.campanhaId);
  if (campanha.status !== "ativa") {
    throw new TRPCError({ code: "BAD_REQUEST", message: `A campanha está ${campanha.status}; reative-a para registrar disparos.` });
  }
  if (p.dataEnvio > hojeCampoGrande()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A data do envio não pode estar no futuro." });
  }

  const telefonesDaLista = [...new Set(p.contatos.map(c => normalizarTelefone(c.telefone)).filter((t): t is string => !!t))];
  const quarentena = await buscarQuarentena(telefonesDaLista);

  const limpeza = higienizarLista(p.contatos, quarentena, p.dataEnvio, p.aplicarQuarentena ? campanha.quarentenaDias : 0);
  const enviados = new Set(limpeza.enviar.map(e => e.telefone));
  const violacoesQuarentena = p.aplicarQuarentena
    ? 0
    : higienizarLista(p.contatos, quarentena, p.dataEnvio, campanha.quarentenaDias)
        .ignoradosQuarentena.filter(i => enviados.has(i.telefone)).length;

  const base = {
    recebidos: p.contatos.length,
    enviados: limpeza.enviar.length,
    ignorados: limpeza.ignoradosQuarentena.length,
    invalidos: limpeza.invalidos.length,
    violacoesQuarentena,
    enviar: limpeza.enviar.map(c => ({ telefone: c.telefone, nome: c.nome })),
    ignoradosQuarentena: limpeza.ignoradosQuarentena,
    invalidosLista: limpeza.invalidos,
  };
  if (limpeza.enviar.length === 0) return { registrado: false, disparoId: null, proximaData: null, ...base };

  const proximaData = campanha.tipo === "recorrente" ? calcularProximoEnvio(p.dataEnvio, campanha.frequenciaDias) : null;

  // OS cobertas pelos contatos enviados (só faz sentido em gatilho_venda); ignoradas por quarentena continuam pendentes.
  const vendas = campanha.tipo === "gatilho_venda"
    ? new Map(limpeza.enviar.flatMap(c => c.osNumeros.map(os => [os, c.telefone] as const)))
    : new Map<string, string>();

  const r = await getPool().query(
    `WITH novo AS (
       INSERT INTO campanhas_whatsapp_disparos
         (campanha_id, enviado_em, proxima_data, contatos_recebidos, contatos_enviados, contatos_ignorados,
          contatos_invalidos, arquivo_url, arquivo_nome, origem, observacoes, registrado_por)
       VALUES ($1::int, $2::date, $3::date, $4::int, $5::int, $6::int, $7::int, $8, $9, $10, $11, $12)
       RETURNING id
     ), quarentena AS (
       INSERT INTO campanhas_whatsapp_quarentena AS q (telefone, ultima_campanha_id, ultimo_contato_em, updated_at)
       SELECT t, $1::int, $2::date, now() FROM unnest($13::text[]) AS t
       ON CONFLICT (telefone) DO UPDATE
         SET ultima_campanha_id = EXCLUDED.ultima_campanha_id,
             ultimo_contato_em = EXCLUDED.ultimo_contato_em,
             updated_at = now()
         WHERE q.ultimo_contato_em <= EXCLUDED.ultimo_contato_em
       RETURNING 1
     ), gatilhos AS (
       INSERT INTO campanhas_whatsapp_gatilhos (campanha_id, disparo_id, os_numero, telefone)
       SELECT $1::int, novo.id, v.os, v.tel FROM novo, unnest($14::text[], $15::text[]) AS v(os, tel)
       ON CONFLICT (campanha_id, os_numero) DO NOTHING
       RETURNING 1
     ), historico_campanha AS (
       -- "Checagem de Cadência da Campanha" pedida pelo usuário: histórico granular por (campanha, telefone),
       -- separado da quarentena global acima ("qualquer campanha"). Gravado sempre (não custa nada); só é
       -- CONSULTADO (para bloquear reenvio) no fluxo de geração de lista a partir de Fontes — ver
       -- gerarListaDaCampanha. O upload manual/webhook continua sem essa trava adicional.
       INSERT INTO campanhas_whatsapp_contatos_historico AS h (campanha_id, telefone, ultimo_envio_em, disparo_id, updated_at)
       SELECT $1::int, t, $2::date, novo.id, now() FROM novo, unnest($13::text[]) AS t
       ON CONFLICT (campanha_id, telefone) DO UPDATE
         SET ultimo_envio_em = EXCLUDED.ultimo_envio_em, disparo_id = EXCLUDED.disparo_id, updated_at = now()
         WHERE h.ultimo_envio_em <= EXCLUDED.ultimo_envio_em
       RETURNING 1
     )
     SELECT id FROM novo`,
    [
      campanha.id, p.dataEnvio, proximaData,
      base.recebidos, base.enviados, base.ignorados, base.invalidos,
      p.arquivoUrl ?? null, p.arquivoNome ?? null, p.origem, p.observacoes?.trim() || null, p.registradoPor,
      limpeza.enviar.map(c => c.telefone),
      [...vendas.keys()], [...vendas.values()],
    ],
  );

  return { registrado: true, disparoId: r.rows[0].id as number, proximaData, ...base };
}

// ─── Router ─────────────────────────────────────────────────────────────────

export const campanhasWhatsappRouter = router({
  /** Painel: campanhas com último/próximo envio, semáforo e os 3 contadores do topo. */
  listar: campanhasProcedure.query(async () => {
    const db = await obterDb();
    const hoje = hojeCampoGrande();
    const campanhas = await db.select().from(campanhasWhatsapp).orderBy(desc(campanhasWhatsapp.createdAt));
    const [ultimos, posVenda] = await Promise.all([
      ultimosEnvios(db),
      carregarPosVenda(db, campanhas.filter(c => c.status === "ativa"), hoje),
    ]);

    const rank = { vermelho: 0, amarelo: 1, verde: 2 } as const;
    const linhas = campanhas.map(c => {
      const vendas = posVenda.get(c.id);
      const status = montarStatusCampanha(
        { tipo: c.tipo, status: c.status, frequenciaDias: c.frequenciaDias, criadaEm: hojeCampoGrande(c.createdAt) },
        ultimos.get(c.id) ?? null, hoje, vendas ? resumirVendas(vendas) : undefined,
      );
      return {
        ...c,
        gatilhoAPartirDe: c.gatilhoAPartirDe ? iso(c.gatilhoAPartirDe) : null,
        ...status,
        vendasPendentes: vendas?.pendentes.length ?? null,
        vendasSemTelefone: vendas?.pendentes.filter(v => !v.telefone).length ?? null,
      };
    }).sort((a, b) =>
      (a.semaforo ? rank[a.semaforo] : 3) - (b.semaforo ? rank[b.semaforo] : 3)
      || (a.proximoEnvio ?? "9999").localeCompare(b.proximoEnvio ?? "9999")
      || a.nome.localeCompare(b.nome));

    return { hoje, campanhas: linhas, resumo: resumirCampanhas(linhas, hoje) };
  }),

  criar: campanhasProcedure
    .input(campanhaBaseSchema)
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await validarCategoria(db, input.categoria);
      const [row] = await db.insert(campanhasWhatsapp).values({
        ...input,
        descricao: input.descricao?.trim() || null,
        gatilhoAPartirDe: input.tipo === "gatilho_venda" ? input.gatilhoAPartirDe ?? null : null,
      }).returning();
      return row;
    }),

  /** Edita campos e também pausa/reativa/arquiva (`status`). */
  atualizar: campanhasProcedure
    .input(campanhaBaseSchema.partial().extend({ id: z.number().int(), status: z.enum(STATUS_CAMPANHA).optional() }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      const { id, ...campos } = input;
      const atual = await buscarCampanha(db, id);
      if (campos.categoria !== undefined) await validarCategoria(db, campos.categoria);
      const tipo = campos.tipo ?? atual.tipo;
      await db.update(campanhasWhatsapp).set({
        ...campos,
        descricao: campos.descricao === undefined ? undefined : (campos.descricao?.trim() || null),
        gatilhoAPartirDe: tipo === "gatilho_venda"
          ? (campos.gatilhoAPartirDe === undefined ? atual.gatilhoAPartirDe : campos.gatilhoAPartirDe)
          : null,
        updatedAt: new Date(),
      }).where(eq(campanhasWhatsapp.id, id));
      return { ok: true };
    }),

  /**
   * Duplica uma campanha existente (nome, categoria, tipo, cadência/quarentena, fontes vinculadas e modelos
   * de mensagem) sob um nome novo — pedido do usuário 27/09/2026 para criar rapidamente "subcampanhas"
   * parecidas (ex.: uma "Prospecção Google Maps — MS" e depois duplicar trocando só o nome e a fonte de cada
   * estado). NÃO copia: arquivos da pasta da campanha (cada cópia deve receber sua própria lista/arquivo),
   * histórico de disparos, nem a cadência já registrada por telefone — a cópia nasce "zerada" (status ativa,
   * sem nenhum envio ainda).
   */
  duplicarCampanha: campanhasProcedure
    .input(z.object({ id: z.number().int(), novoNome: z.string().trim().min(1, "Informe o nome da cópia").max(160) }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      const original = await buscarCampanha(db, input.id);
      const [copia] = await db.insert(campanhasWhatsapp).values({
        nome: input.novoNome,
        categoria: original.categoria,
        descricao: original.descricao,
        tipo: original.tipo,
        frequenciaDias: original.frequenciaDias,
        quarentenaDias: original.quarentenaDias,
        status: "ativa",
        gatilhoAPartirDe: original.tipo === "gatilho_venda" ? original.gatilhoAPartirDe : null,
      }).returning();

      const [fontes, scripts] = await Promise.all([
        db.select({ fonteId: campanhasWhatsappCampanhaFontes.fonteId }).from(campanhasWhatsappCampanhaFontes)
          .where(eq(campanhasWhatsappCampanhaFontes.campanhaId, original.id)),
        db.select().from(campanhasWhatsappScripts)
          .where(and(eq(campanhasWhatsappScripts.campanhaId, original.id), eq(campanhasWhatsappScripts.ativo, true))),
      ]);
      if (fontes.length) {
        await db.insert(campanhasWhatsappCampanhaFontes)
          .values(fontes.map(f => ({ campanhaId: copia.id, fonteId: f.fonteId })));
      }
      if (scripts.length) {
        await db.insert(campanhasWhatsappScripts).values(scripts.map(s => ({
          campanhaId: copia.id, ordem: s.ordem, titulo: s.titulo, conteudo: s.conteudo,
        })));
      }
      return copia;
    }),

  /**
   * Exclusão definitiva — remove a campanha e tudo que depende dela (disparos, agendamentos, scripts, arquivos
   * da pasta, vínculo com fontes e histórico de cadência) via `ON DELETE CASCADE` do banco (ver
   * `drizzle/schema.ts`). A quarentena global por telefone (`campanhas_whatsapp_quarentena`) não é apagada —
   * só perde a referência a esta campanha (`ON DELETE SET NULL`), pois a trava anti-spam vale entre campanhas.
   * Diferente de arquivar (`atualizar` com `status: "arquivada"`), que só tira da lista ativa sem apagar nada —
   * prefira arquivar quando o histórico de disparos importar; isto é para campanha criada por engano/teste.
   */
  excluir: campanhasProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await buscarCampanha(db, input.id); // 404 se não existe
      await db.delete(campanhasWhatsapp).where(eq(campanhasWhatsapp.id, input.id));
      return { ok: true };
    }),

  // ─── Categorias (editáveis pelo usuário — ver comentário em drizzle/schema.ts) ────────────────

  /** `emUso`: quantas campanhas usam a categoria — a tela só oferece excluir (em vez de arquivar) quando é 0. */
  listarCategorias: campanhasProcedure.query(async () => {
    const db = await obterDb();
    const [categorias, usos] = await Promise.all([
      db.select().from(campanhasWhatsappCategorias)
        .orderBy(campanhasWhatsappCategorias.ordem, campanhasWhatsappCategorias.id),
      db.select({ categoria: campanhasWhatsapp.categoria, total: count() })
        .from(campanhasWhatsapp).groupBy(campanhasWhatsapp.categoria),
    ]);
    const usoPorChave = new Map(usos.map(u => [u.categoria, Number(u.total)]));
    return categorias.map(c => ({ ...c, emUso: usoPorChave.get(c.chave) ?? 0 }));
  }),

  criarCategoria: campanhasProcedure
    .input(z.object({ label: categoriaLabelSchema }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      const existentes = await db.select({ chave: campanhasWhatsappCategorias.chave }).from(campanhasWhatsappCategorias);
      const chaves = new Set(existentes.map(e => e.chave));
      const base = gerarChaveCategoria(input.label);
      let chave = base;
      for (let n = 2; chaves.has(chave); n++) chave = `${base}_${n}`;
      const [{ maxOrdem }] = await db.select({ maxOrdem: max(campanhasWhatsappCategorias.ordem) }).from(campanhasWhatsappCategorias);
      const [row] = await db.insert(campanhasWhatsappCategorias)
        .values({ chave, label: input.label, ordem: (maxOrdem ?? 0) + 1 }).returning();
      return row;
    }),

  /** Só o label muda — a chave gravada nas campanhas existentes é imutável. */
  renomearCategoria: campanhasProcedure
    .input(z.object({ id: z.number().int(), label: categoriaLabelSchema }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await db.update(campanhasWhatsappCategorias)
        .set({ label: input.label, updatedAt: new Date() })
        .where(eq(campanhasWhatsappCategorias.id, input.id));
      return { ok: true };
    }),

  /** Arquivar/reativar: sai (ou volta) da lista oferecida ao criar/editar campanha, sem apagar nada. */
  arquivarCategoria: campanhasProcedure
    .input(z.object({ id: z.number().int(), ativo: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await db.update(campanhasWhatsappCategorias)
        .set({ ativo: input.ativo, updatedAt: new Date() })
        .where(eq(campanhasWhatsappCategorias.id, input.id));
      return { ok: true };
    }),

  /** Só permite excluir de fato quando nenhuma campanha usa a categoria — senão, oriente a arquivar. */
  excluirCategoria: campanhasProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      const [cat] = await db.select().from(campanhasWhatsappCategorias).where(eq(campanhasWhatsappCategorias.id, input.id)).limit(1);
      if (!cat) throw new TRPCError({ code: "NOT_FOUND", message: "Categoria não encontrada" });
      const [{ total }] = await db.select({ total: count() }).from(campanhasWhatsapp).where(eq(campanhasWhatsapp.categoria, cat.chave));
      if (Number(total) > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${total} campanha(s) usam "${cat.label}" — arquive em vez de excluir.`,
        });
      }
      await db.delete(campanhasWhatsappCategorias).where(eq(campanhasWhatsappCategorias.id, input.id));
      return { ok: true };
    }),

  historico: campanhasProcedure
    .input(z.object({ campanhaId: z.number().int(), limite: z.number().int().min(1).max(200).default(100) }))
    .query(async ({ input }) => {
      const db = await obterDb();
      const campanha = await buscarCampanha(db, input.campanhaId);
      const disparos = await db.select().from(campanhasWhatsappDisparos)
        .where(eq(campanhasWhatsappDisparos.campanhaId, input.campanhaId))
        .orderBy(desc(campanhasWhatsappDisparos.enviadoEm), desc(campanhasWhatsappDisparos.id))
        .limit(input.limite);
      return { campanha: { id: campanha.id, nome: campanha.nome }, disparos };
    }),

  registrarDisparo: campanhasProcedure
    .input(z.object({
      campanhaId: z.number().int(),
      dataEnvio: dataIsoSchema.optional(),
      contatos: contatosSchema,
      observacoes: z.string().max(2000).nullish(),
      arquivoUrl: z.string().url().max(512).nullish(),
      arquivoNome: z.string().max(256).nullish(),
    }))
    .mutation(({ input, ctx }) => registrarDisparoNoBanco({
      ...input,
      dataEnvio: input.dataEnvio ?? hojeCampoGrande(),
      origem: "app",
      registradoPor: ctx.user.name ?? ctx.user.email ?? "desconhecido",
      aplicarQuarentena: true,
    })),

  /** Consulta a trava sem registrar nada: usa a quarentena da campanha ou um número de dias avulso. */
  verificarQuarentena: campanhasProcedure
    .input(z.object({
      telefones: z.array(z.union([z.string().max(40), z.number()])).min(1).max(5000),
      campanhaId: z.number().int().optional(),
      quarentenaDias: z.number().int().min(0).max(365).optional(),
    }))
    .query(async ({ input }) => {
      let dias = input.quarentenaDias;
      if (dias === undefined) {
        if (input.campanhaId === undefined) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe campanhaId ou quarentenaDias" });
        dias = (await buscarCampanha(await obterDb(), input.campanhaId)).quarentenaDias;
      }
      return checarQuarentenaNoBanco(input.telefones, dias);
    }),

  /** Pós-venda: vendas com prazo vencido (`pendentes`, ordenadas da mais atrasada) e as que ainda vão vencer. */
  vendasPosVenda: campanhasProcedure
    .input(z.object({ campanhaId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await obterDb();
      const campanha = await buscarCampanha(db, input.campanhaId);
      if (campanha.tipo !== "gatilho_venda") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Só campanhas de gatilho de venda têm lista de vendas." });
      }
      const listas = (await carregarPosVenda(db, [campanha], hojeCampoGrande())).get(campanha.id)!;
      const recorte = (vs: VendaPosVenda[]) => vs.slice(0, MAX_LISTA_TELA);
      return {
        totalPendentes: listas.pendentes.length,
        pendentesSemTelefone: listas.pendentes.filter(v => !v.telefone).length,
        pendentes: recorte(listas.pendentes),
        /** Para "Usar vendas pendentes" no disparo: todas as pendentes com telefone, sem o recorte da tela. */
        contatosDisparo: listas.pendentes.filter(v => v.telefone).map(v => ({ telefone: v.telefone!, nome: v.empresa, osNumero: v.osNumero })),
        totalProximas: listas.proximas.length,
        proximas: recorte(listas.proximas),
      };
    }),

  /** Eventos do calendário no intervalo: disparos feitos (`executado`) e datas previstas (`previsto`). */
  calendario: campanhasProcedure
    .input(z.object({ inicio: dataIsoSchema, fim: dataIsoSchema }))
    .query(async ({ input }) => {
      if (input.fim < input.inicio || diasEntre(input.inicio, input.fim) > MAX_JANELA_CALENDARIO_DIAS) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Intervalo inválido (máximo ${MAX_JANELA_CALENDARIO_DIAS} dias).` });
      }
      const db = await obterDb();
      const hoje = hojeCampoGrande();
      const campanhas = await db.select().from(campanhasWhatsapp);
      const porId = new Map(campanhas.map(c => [c.id, c]));
      const ativas = campanhas.filter(c => c.status === "ativa");

      const [ultimos, posVenda, disparos] = await Promise.all([
        ultimosEnvios(db),
        carregarPosVenda(db, ativas, hoje),
        db.select().from(campanhasWhatsappDisparos)
          .where(and(gte(campanhasWhatsappDisparos.enviadoEm, input.inicio), lte(campanhasWhatsappDisparos.enviadoEm, input.fim)))
          .orderBy(campanhasWhatsappDisparos.enviadoEm),
      ]);

      type Evento = {
        data: string; campanhaId: number; nome: string; categoria: CampanhaWhatsapp["categoria"]; tipo: CampanhaWhatsapp["tipo"];
        evento: "executado" | "previsto"; semaforo: ReturnType<typeof classificarSemaforo> | null;
        /** Contatos enviados (executado) ou vendas com prazo no dia (previsto de gatilho). */
        quantidade: number | null;
      };
      const eventos: Evento[] = [];
      const base = (c: CampanhaWhatsapp) => ({ campanhaId: c.id, nome: c.nome, categoria: c.categoria, tipo: c.tipo });

      for (const d of disparos) {
        const c = porId.get(d.campanhaId);
        if (c) eventos.push({ ...base(c), data: iso(d.enviadoEm), evento: "executado", semaforo: null, quantidade: d.contatosEnviados });
      }

      for (const c of ativas) {
        if (c.tipo === "recorrente") {
          const st = montarStatusCampanha(
            { tipo: c.tipo, status: c.status, frequenciaDias: c.frequenciaDias, criadaEm: hojeCampoGrande(c.createdAt) },
            ultimos.get(c.id) ?? null, hoje,
          );
          for (const data of expandirPrevistos(st.proximoEnvio!, c.frequenciaDias, hoje, input.inicio, input.fim)) {
            eventos.push({ ...base(c), data, evento: "previsto", semaforo: classificarSemaforo(data, hoje), quantidade: null });
          }
        } else {
          const listas = posVenda.get(c.id);
          const porDia = new Map<string, number>();
          for (const v of [...(listas?.pendentes ?? []), ...(listas?.proximas ?? [])]) {
            if (v.prazo >= input.inicio && v.prazo <= input.fim) porDia.set(v.prazo, (porDia.get(v.prazo) ?? 0) + 1);
          }
          for (const [data, qtd] of porDia) {
            eventos.push({ ...base(c), data, evento: "previsto", semaforo: classificarSemaforo(data, hoje), quantidade: qtd });
          }
        }
      }

      eventos.sort((a, b) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome));
      return { hoje, eventos };
    }),

  // ─── Modelos de mensagem por campanha (mesmo padrão de crm_scripts/retencao_scripts) ────────────

  listScripts: campanhasProcedure
    .input(z.object({ campanhaId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await obterDb();
      return db.select().from(campanhasWhatsappScripts)
        .where(and(eq(campanhasWhatsappScripts.campanhaId, input.campanhaId), eq(campanhasWhatsappScripts.ativo, true)))
        .orderBy(campanhasWhatsappScripts.ordem);
    }),

  addScript: campanhasProcedure
    .input(z.object({
      campanhaId: z.number().int(),
      titulo: z.string().trim().max(128).optional(),
      conteudo: z.string().trim().min(1, "Escreva o texto do script"),
    }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await buscarCampanha(db, input.campanhaId); // 404 se a campanha não existe
      const [{ maxOrdem }] = await db.select({ maxOrdem: max(campanhasWhatsappScripts.ordem) })
        .from(campanhasWhatsappScripts).where(eq(campanhasWhatsappScripts.campanhaId, input.campanhaId));
      const [row] = await db.insert(campanhasWhatsappScripts).values({
        campanhaId: input.campanhaId, titulo: input.titulo || null, conteudo: input.conteudo, ordem: (maxOrdem ?? 0) + 1,
      }).returning();
      return row;
    }),

  updateScript: campanhasProcedure
    .input(z.object({ id: z.number().int(), titulo: z.string().trim().max(128).optional(), conteudo: z.string().trim().min(1) }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await db.update(campanhasWhatsappScripts)
        .set({ titulo: input.titulo || null, conteudo: input.conteudo, updatedAt: new Date() })
        .where(eq(campanhasWhatsappScripts.id, input.id));
      return { ok: true };
    }),

  /** Soft delete (ativo=false) — mesmo padrão de crm_scripts/retencao_scripts. */
  deleteScript: campanhasProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await db.update(campanhasWhatsappScripts).set({ ativo: false, updatedAt: new Date() }).where(eq(campanhasWhatsappScripts.id, input.id));
      return { ok: true };
    }),

  incrementCopiaScript: campanhasProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await db.execute(sql`UPDATE campanhas_whatsapp_scripts SET copia_count = copia_count + 1 WHERE id = ${input.id}`);
      return { ok: true };
    }),

  reorderScripts: campanhasProcedure
    .input(z.object({ campanhaId: z.number().int(), orderedIds: z.array(z.number().int()) }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await Promise.all(input.orderedIds.map((id, index) =>
        db.update(campanhasWhatsappScripts).set({ ordem: index }).where(eq(campanhasWhatsappScripts.id, id))
      ));
      return { ok: true };
    }),

  // ─── Arquivos da campanha — "pasta" para listas de contatos e afins ─────────────────────────────
  // O upload em si vai direto ao UploadThing (client/src/lib/upload.ts, rota "documento"); aqui só se
  // registra a referência. Diferente de campanhas_whatsapp_disparos.arquivo_url: não precisa ter sido
  // usado num disparo, é um repositório livre por campanha.

  listArquivos: campanhasProcedure
    .input(z.object({ campanhaId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await obterDb();
      return db.select().from(campanhasWhatsappArquivos)
        .where(eq(campanhasWhatsappArquivos.campanhaId, input.campanhaId))
        .orderBy(desc(campanhasWhatsappArquivos.createdAt));
    }),

  adicionarArquivo: campanhasProcedure
    .input(z.object({
      // Opcional: um arquivo pode nascer "solto" (cadastrado direto na tela de Fontes, sem pertencer a
      // nenhuma campanha) para servir de audiência reutilizável — ver campanhas_whatsapp_fontes.
      campanhaId: z.number().int().nullish(),
      nome: z.string().trim().min(1).max(256),
      url: z.string().url().max(1024),
      tamanhoBytes: z.number().int().min(0).max(64 * 1024 * 1024).default(0),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await obterDb();
      if (input.campanhaId != null) await buscarCampanha(db, input.campanhaId);
      const [row] = await db.insert(campanhasWhatsappArquivos).values({
        campanhaId: input.campanhaId ?? null, nome: input.nome, url: input.url, tamanhoBytes: input.tamanhoBytes,
        enviadoPor: ctx.user.name ?? ctx.user.email ?? "desconhecido",
      }).returning();
      return row;
    }),

  /** Remove só o registro — o arquivo em si continua no UploadThing (mesmo padrão de biblioteca_arquivos). */
  removerArquivo: campanhasProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await db.delete(campanhasWhatsappArquivos).where(eq(campanhasWhatsappArquivos.id, input.id));
      return { ok: true };
    }),

  // ─── Fontes de Dados: ERP (histórico local) + arquivo (upload, reaproveita "Arquivos") ─────────
  // Ver drizzle/schema.ts (comentário em campanhasWhatsappFontes) e docs/campanhas-whatsapp.md.

  /** Todas as fontes (as 4 "erp" são seed fixo da migration 0049; "arquivo" são criadas pelo usuário). */
  listarFontes: campanhasProcedure.query(async () => {
    const db = await obterDb();
    const fontes = await db.select().from(campanhasWhatsappFontes).orderBy(campanhasWhatsappFontes.tipo, campanhasWhatsappFontes.id);
    const arquivoIds = fontes.map(f => f.arquivoId).filter((id): id is number => id !== null);
    const arquivos = arquivoIds.length
      ? await db.select().from(campanhasWhatsappArquivos).where(inArray(campanhasWhatsappArquivos.id, arquivoIds))
      : [];
    const arquivoPorId = new Map(arquivos.map(a => [a.id, a]));
    return fontes.map(f => ({ ...f, arquivo: f.arquivoId ? arquivoPorId.get(f.arquivoId) ?? null : null }));
  }),

  /** Cria uma fonte tipo "arquivo" apontando para um arquivo já salvo (solto ou de qualquer campanha) —
   * o client sobe/registra o arquivo primeiro via adicionarArquivo, depois chama isto com o id retornado. */
  criarFonteArquivo: campanhasProcedure
    .input(z.object({ label: z.string().trim().min(1).max(120), descricao: z.string().trim().max(500).nullish(), arquivoId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      const [arquivo] = await db.select({ id: campanhasWhatsappArquivos.id }).from(campanhasWhatsappArquivos)
        .where(eq(campanhasWhatsappArquivos.id, input.arquivoId)).limit(1);
      if (!arquivo) throw new TRPCError({ code: "NOT_FOUND", message: "Arquivo não encontrado" });
      const existentes = await db.select({ chave: campanhasWhatsappFontes.chave }).from(campanhasWhatsappFontes);
      const chaves = new Set(existentes.map(e => e.chave));
      const base = gerarChaveCategoria(input.label); // mesmo slugify de categorias — serve igual aqui
      let chave = base;
      for (let n = 2; chaves.has(chave); n++) chave = `${base}_${n}`;
      const [row] = await db.insert(campanhasWhatsappFontes).values({
        tipo: "arquivo", chave, label: input.label, descricao: input.descricao || null, arquivoId: input.arquivoId,
      }).returning();
      return row;
    }),

  /** Arquivar/reativar qualquer fonte (inclusive "erp", se um dia não fizer mais sentido oferecê-la). */
  arquivarFonte: campanhasProcedure
    .input(z.object({ id: z.number().int(), ativo: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await db.update(campanhasWhatsappFontes).set({ ativo: input.ativo, updatedAt: new Date() }).where(eq(campanhasWhatsappFontes.id, input.id));
      return { ok: true };
    }),

  /** Substitui o conjunto de fontes vinculadas a uma campanha (multi-seleção: ERP + externas ao mesmo tempo). */
  vincularFontes: campanhasProcedure
    .input(z.object({ campanhaId: z.number().int(), fonteIds: z.array(z.number().int()).max(50) }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await buscarCampanha(db, input.campanhaId);
      await db.delete(campanhasWhatsappCampanhaFontes).where(eq(campanhasWhatsappCampanhaFontes.campanhaId, input.campanhaId));
      if (input.fonteIds.length) {
        await db.insert(campanhasWhatsappCampanhaFontes)
          .values(input.fonteIds.map(fonteId => ({ campanhaId: input.campanhaId, fonteId })));
      }
      return { ok: true };
    }),

  listarFontesDaCampanha: campanhasProcedure
    .input(z.object({ campanhaId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await obterDb();
      return db.select({ fonte: campanhasWhatsappFontes })
        .from(campanhasWhatsappCampanhaFontes)
        .innerJoin(campanhasWhatsappFontes, eq(campanhasWhatsappFontes.id, campanhasWhatsappCampanhaFontes.fonteId))
        .where(eq(campanhasWhatsappCampanhaFontes.campanhaId, input.campanhaId))
        .then(rows => rows.map(r => r.fonte));
    }),

  /**
   * Motor de filtragem (pipeline pedido): resolve as fontes vinculadas (ERP ao vivo do histórico local +
   * arquivo parseado sob demanda) → concatena → higienizarLista (normaliza, desduplica ENTRE fontes, aplica
   * quarentena global) → filtrarPorCadenciaCampanha (esta campanha especificamente). Só CONSULTA — não grava
   * nada; o client passa o resultado (`aprovados`) para `registrarDisparo` como faz hoje com "vendas pendentes".
   */
  gerarListaDaCampanha: campanhasProcedure
    .input(z.object({ campanhaId: z.number().int(), dataEnvio: dataIsoSchema.optional() }))
    .query(async ({ input }) => {
      const db = await obterDb();
      const campanha = await buscarCampanha(db, input.campanhaId);
      const dataEnvio = input.dataEnvio ?? hojeCampoGrande();

      const fontes = await db.select({ fonte: campanhasWhatsappFontes })
        .from(campanhasWhatsappCampanhaFontes)
        .innerJoin(campanhasWhatsappFontes, eq(campanhasWhatsappFontes.id, campanhasWhatsappCampanhaFontes.fonteId))
        .where(and(eq(campanhasWhatsappCampanhaFontes.campanhaId, input.campanhaId), eq(campanhasWhatsappFontes.ativo, true)));
      if (fontes.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhuma fonte vinculada a esta campanha. Vincule ao menos uma em \"Fontes de dados\"." });
      }

      const porFonte: Array<{ fonte: string; total: number; semTelefone: number }> = [];
      const brutos: Array<{ telefone: unknown; nome: string }> = [];
      for (const { fonte } of fontes) {
        let contatos: ContatoFonte[];
        if (fonte.tipo === "erp") {
          if (!fonte.consultaErp) continue;
          contatos = await resolverFonteErp(fonte.consultaErp, dataEnvio);
        } else {
          if (!fonte.arquivoId) continue;
          const [arquivo] = await db.select().from(campanhasWhatsappArquivos).where(eq(campanhasWhatsappArquivos.id, fonte.arquivoId)).limit(1);
          if (!arquivo) continue;
          const leitura = await lerArquivoDeUrl(arquivo.url, arquivo.nome);
          if (!leitura.ok) {
            porFonte.push({ fonte: fonte.label, total: 0, semTelefone: 0 });
            continue;
          }
          contatos = leitura.contatos.map(c => ({ telefone: c.telefone || null, nome: c.nome }));
        }
        porFonte.push({ fonte: fonte.label, total: contatos.length, semTelefone: contatos.filter(c => !c.telefone).length });
        for (const c of contatos) brutos.push({ telefone: c.telefone, nome: c.nome });
      }

      // Quarentena global (0 dias = sem trava, mesma convenção do resto do módulo).
      const telefonesNormalizados = [...new Set(brutos.map(c => normalizarTelefone(c.telefone)).filter((t): t is string => !!t))];
      const quarentenaGlobal = await buscarQuarentena(telefonesNormalizados);
      const higienizado = higienizarLista(brutos, quarentenaGlobal, dataEnvio, campanha.quarentenaDias);

      // Cadência DESTA campanha — só aqui, não no registrarDisparo genérico (ver comentário na migration/schema).
      const historicoRows = telefonesNormalizados.length
        ? await getPool().query(
            `SELECT telefone, ultimo_envio_em::text AS ultimo FROM campanhas_whatsapp_contatos_historico
               WHERE campanha_id = $1 AND telefone = ANY($2::text[])`,
            [campanha.id, telefonesNormalizados],
          )
        : { rows: [] as Array<{ telefone: string; ultimo: string }> };
      const historicoCampanha = new Map(historicoRows.rows.map(r => [r.telefone, r.ultimo]));
      const { aprovados, descartadosCadencia } = filtrarPorCadenciaCampanha(higienizado.enviar, historicoCampanha, dataEnvio, campanha.frequenciaDias);

      return {
        dataEnvio,
        porFonte,
        totalResolvido: brutos.length,
        aprovados: aprovados.map(c => ({ telefone: c.telefone, nome: c.nome })),
        ignoradosQuarentenaGlobal: higienizado.ignoradosQuarentena,
        ignoradosCadenciaCampanha: descartadosCadencia,
        invalidosOuDuplicados: higienizado.invalidos,
      };
    }),

  // ─── Planner: agendamentos de campanha no calendário ────────────────────────────────────────────
  // Um agendamento é só um plano/lembrete ("disparar esta campanha neste dia") — independente do log real
  // de disparo (campanhas_whatsapp_disparos). Pedido do usuário 27/09/2026: calendário visual para AGENDAR
  // (não só ver a previsão calculada pela cadência) + um botão simples para depois confirmar se aquele
  // disparo agendado realmente aconteceu, sem precisar passar pelo fluxo pesado de "Registrar disparo".

  listarAgendamentos: campanhasProcedure
    .input(z.object({ inicio: dataIsoSchema, fim: dataIsoSchema }))
    .query(async ({ input }) => {
      const db = await obterDb();
      const rows = await db.select({
        id: campanhasWhatsappAgendamentos.id,
        campanhaId: campanhasWhatsappAgendamentos.campanhaId,
        nome: campanhasWhatsapp.nome,
        categoria: campanhasWhatsapp.categoria,
        dataAgendada: campanhasWhatsappAgendamentos.dataAgendada,
        status: campanhasWhatsappAgendamentos.status,
        observacoes: campanhasWhatsappAgendamentos.observacoes,
      })
        .from(campanhasWhatsappAgendamentos)
        .innerJoin(campanhasWhatsapp, eq(campanhasWhatsapp.id, campanhasWhatsappAgendamentos.campanhaId))
        .where(and(gte(campanhasWhatsappAgendamentos.dataAgendada, input.inicio), lte(campanhasWhatsappAgendamentos.dataAgendada, input.fim)))
        .orderBy(campanhasWhatsappAgendamentos.dataAgendada);
      return rows.map(r => ({ ...r, dataAgendada: iso(r.dataAgendada) }));
    }),

  criarAgendamento: campanhasProcedure
    .input(z.object({ campanhaId: z.number().int(), dataAgendada: dataIsoSchema, observacoes: z.string().trim().max(500).nullish() }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await buscarCampanha(db, input.campanhaId);
      const [row] = await db.insert(campanhasWhatsappAgendamentos).values({
        campanhaId: input.campanhaId, dataAgendada: input.dataAgendada, observacoes: input.observacoes || null,
      }).returning();
      return row;
    }),

  /** O botão "disparada"/"não disparada"/"voltar a planejado" do calendário e do relatório. */
  marcarAgendamento: campanhasProcedure
    .input(z.object({ id: z.number().int(), status: z.enum(STATUS_AGENDAMENTO) }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await db.update(campanhasWhatsappAgendamentos)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(campanhasWhatsappAgendamentos.id, input.id));
      return { ok: true };
    }),

  removerAgendamento: campanhasProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await obterDb();
      await db.delete(campanhasWhatsappAgendamentos).where(eq(campanhasWhatsappAgendamentos.id, input.id));
      return { ok: true };
    }),

  // ─── Relatório por período ───────────────────────────────────────────────────────────────────────
  // Pedido do usuário 27/09/2026: campanhas ativas/inativas, contatos alcançados e disparos realizados
  // dentro de um recorte de datas, com o detalhamento por campanha (para agendar/marcar disparo ali mesmo).

  relatorioPeriodo: campanhasProcedure
    .input(z.object({ inicio: dataIsoSchema, fim: dataIsoSchema }))
    .query(async ({ input }) => {
      if (input.fim < input.inicio || diasEntre(input.inicio, input.fim) > 366) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Período inválido (máximo 366 dias)." });
      }
      const db = await obterDb();
      const [campanhas, disparosPeriodo, agendamentosPeriodo, contatosDistintos] = await Promise.all([
        db.select().from(campanhasWhatsapp),
        db.select().from(campanhasWhatsappDisparos)
          .where(and(gte(campanhasWhatsappDisparos.enviadoEm, input.inicio), lte(campanhasWhatsappDisparos.enviadoEm, input.fim))),
        db.select().from(campanhasWhatsappAgendamentos)
          .where(and(gte(campanhasWhatsappAgendamentos.dataAgendada, input.inicio), lte(campanhasWhatsappAgendamentos.dataAgendada, input.fim))),
        getPool().query<{ total: number }>(
          `SELECT COUNT(DISTINCT telefone)::int AS total FROM campanhas_whatsapp_contatos_historico
             WHERE ultimo_envio_em BETWEEN $1 AND $2`,
          [input.inicio, input.fim],
        ),
      ]);

      const porCampanhaAgg = new Map<number, { disparos: number; contatosEnviados: number }>();
      for (const d of disparosPeriodo) {
        const atual = porCampanhaAgg.get(d.campanhaId) ?? { disparos: 0, contatosEnviados: 0 };
        atual.disparos++;
        atual.contatosEnviados += d.contatosEnviados;
        porCampanhaAgg.set(d.campanhaId, atual);
      }
      const agendamentosPorCampanha = new Map<number, typeof agendamentosPeriodo>();
      for (const a of agendamentosPeriodo) {
        if (!agendamentosPorCampanha.has(a.campanhaId)) agendamentosPorCampanha.set(a.campanhaId, []);
        agendamentosPorCampanha.get(a.campanhaId)!.push(a);
      }

      const porCampanha = campanhas
        .map(c => ({
          id: c.id,
          nome: c.nome,
          categoria: c.categoria,
          status: c.status,
          disparosNoPeriodo: porCampanhaAgg.get(c.id)?.disparos ?? 0,
          contatosEnviadosNoPeriodo: porCampanhaAgg.get(c.id)?.contatosEnviados ?? 0,
          agendamentos: (agendamentosPorCampanha.get(c.id) ?? [])
            .map(a => ({ id: a.id, dataAgendada: iso(a.dataAgendada), status: a.status, observacoes: a.observacoes }))
            .sort((x, y) => x.dataAgendada.localeCompare(y.dataAgendada)),
        }))
        .sort((a, b) => b.disparosNoPeriodo - a.disparosNoPeriodo || b.agendamentos.length - a.agendamentos.length || a.nome.localeCompare(b.nome));

      return {
        periodo: { inicio: input.inicio, fim: input.fim },
        kpis: {
          campanhasAtivas: campanhas.filter(c => c.status === "ativa").length,
          campanhasInativas: campanhas.filter(c => c.status !== "ativa").length,
          // "Contatos cadastrados" acompanha o período filtrado (decisão do usuário 27/09/2026) — telefones
          // distintos cujo ÚLTIMO envio de qualquer campanha caiu dentro do recorte. Ver limitação no doc:
          // campanhas_whatsapp_contatos_historico só guarda o envio mais recente por (campanha, telefone).
          contatosCadastradosNoPeriodo: contatosDistintos.rows[0]?.total ?? 0,
          disparosRealizadosNoPeriodo: disparosPeriodo.length,
          contatosEnviadosNoPeriodo: disparosPeriodo.reduce((soma, d) => soma + d.contatosEnviados, 0),
        },
        porCampanha,
      };
    }),
});
