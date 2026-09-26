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
import { and, desc, eq, gte, inArray, isNotNull, lte, max } from "drizzle-orm";
import { protectedProcedure, requireRole, router } from "../_core/trpc";
import { getDb } from "../db/db";
import { getPool } from "../db/db-connection";
import {
  campanhasWhatsapp, campanhasWhatsappDisparos, campanhasWhatsappGatilhos, historicoOs,
  type CampanhaWhatsapp,
} from "../../drizzle/schema";
import {
  CATEGORIAS_CAMPANHA, STATUS_CAMPANHA, TIPOS_CAMPANHA,
  calcularProximoEnvio, classificarSemaforo, dataIsoValida, diasEntre, hojeCampoGrande, normalizarTelefone, somarDias,
} from "../../shared/campanhas-whatsapp";
import {
  expandirPrevistos, higienizarLista, listarVendasPosVenda, montarStatusCampanha, resumirCampanhas, resumirVendas,
  type ContatoIgnorado, type ContatoInvalido, type VendaPosVenda,
} from "../services/campanhasWhatsapp";
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

const campanhaBaseSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(160),
  categoria: z.enum(CATEGORIAS_CAMPANHA),
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
      const [row] = await db.insert(campanhasWhatsapp).values({
        ...input,
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
      const tipo = campos.tipo ?? atual.tipo;
      await db.update(campanhasWhatsapp).set({
        ...campos,
        gatilhoAPartirDe: tipo === "gatilho_venda"
          ? (campos.gatilhoAPartirDe === undefined ? atual.gatilhoAPartirDe : campos.gatilhoAPartirDe)
          : null,
        updatedAt: new Date(),
      }).where(eq(campanhasWhatsapp.id, id));
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
});
