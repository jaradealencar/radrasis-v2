import { z } from "zod";
import crypto from "crypto";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db/db";
import { radarMercadoConfig, sinaisMercado } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { buscarNaWeb, buscaConfigurada } from "../integrations/google-search-client";
import { invokeLLM } from "../_core/llm";

// ─── Configuração padrão combinada com o usuário em 2026-09 ──────────────────
// Regiões Centro-Oeste, Sudeste e Sul (sem representatividade nas demais
// regiões, confirmado pela Análise Geográfica do sistema); público-alvo
// restrito a gráficas e empresas de comunicação visual.
const UFS_PADRAO = ["MS", "MT", "GO", "DF", "MG", "SP", "RJ", "ES", "PR", "SC", "RS"];
const SEGMENTOS_PADRAO = ["Gráficas", "Comunicação visual", "Sinalização"];
const TERMOS_BUSCA_PADRAO = [
  "gráfica nova inauguração",
  "empresa de comunicação visual inauguração",
  "gráfica rápida abre loja",
  "edital licitação sinalização comunicação visual",
];

async function carregarConfig(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const rows = await db.select().from(radarMercadoConfig).where(eq(radarMercadoConfig.id, 1)).limit(1);
  if (rows.length === 0) {
    const [row] = await db.insert(radarMercadoConfig).values({
      id: 1,
      regioesJson: JSON.stringify(UFS_PADRAO),
      segmentosAlvoJson: JSON.stringify(SEGMENTOS_PADRAO),
      termosBuscaJson: JSON.stringify(TERMOS_BUSCA_PADRAO),
    }).returning();
    return row;
  }
  return rows[0];
}

function parseConfig(row: typeof radarMercadoConfig.$inferSelect) {
  return {
    regioes: JSON.parse(row.regioesJson) as string[],
    segmentosAlvo: JSON.parse(row.segmentosAlvoJson) as string[],
    concorrentesConhecidos: JSON.parse(row.concorrentesConhecidosJson) as string[],
    termosBusca: JSON.parse(row.termosBuscaJson) as string[],
    exclusoes: JSON.parse(row.exclusoesJson) as string[],
    updatedAt: row.updatedAt,
  };
}

function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}

const MAX_ITENS_POR_EXECUCAO = 20; // limite de chamadas de IA por execução — controla custo e tempo

export const radarMercadoRouter = router({
  buscaConfigurada: publicProcedure.query(() => ({ configurada: buscaConfigurada() })),

  getConfig: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    return parseConfig(await carregarConfig(db));
  }),

  atualizarConfig: protectedProcedure
    .input(z.object({
      regioes: z.array(z.string()).optional(),
      segmentosAlvo: z.array(z.string()).optional(),
      concorrentesConhecidos: z.array(z.string()).optional(),
      termosBusca: z.array(z.string()).optional(),
      exclusoes: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await carregarConfig(db); // garante que a linha id=1 existe
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (input.regioes) set.regioesJson = JSON.stringify(input.regioes);
      if (input.segmentosAlvo) set.segmentosAlvoJson = JSON.stringify(input.segmentosAlvo);
      if (input.concorrentesConhecidos) set.concorrentesConhecidosJson = JSON.stringify(input.concorrentesConhecidos);
      if (input.termosBusca) set.termosBuscaJson = JSON.stringify(input.termosBusca);
      if (input.exclusoes) set.exclusoesJson = JSON.stringify(input.exclusoes);
      await db.update(radarMercadoConfig).set(set).where(eq(radarMercadoConfig.id, 1));
      return { ok: true };
    }),

  listarSinais: publicProcedure
    .input(z.object({
      status: z.enum(["novo", "qualificando", "oportunidade", "associado_cliente", "descartado", "expirado"]).optional(),
      uf: z.string().length(2).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const filtros = [] as any[];
      if (input.status) filtros.push(eq(sinaisMercado.status, input.status));
      if (input.uf) filtros.push(eq(sinaisMercado.uf, input.uf));
      return db.select().from(sinaisMercado)
        .where(filtros.length > 0 ? and(...filtros) : undefined)
        .orderBy(desc(sinaisMercado.dataColeta));
    }),

  atualizarSinal: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["novo", "qualificando", "oportunidade", "associado_cliente", "descartado", "expirado"]).optional(),
      proximoPasso: z.string().nullable().optional(),
      jaClienteEmpresaKey: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const { id, ...campos } = input;
      await db.update(sinaisMercado).set({ ...campos, updatedAt: new Date() }).where(eq(sinaisMercado.id, id));
      return { ok: true };
    }),

  /** Roda a busca configurada, extrai sinais estruturados via IA e grava os
   * novos (deduplicados por URL). Nunca inventa dado — descarta resultado que
   * a IA classificar como não relacionado ao nosso catálogo/segmento. */
  buscarSinais: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    if (!buscaConfigurada()) {
      throw new Error("Radar sem busca configurada — falta GOOGLE_SEARCH_API_KEY/GOOGLE_SEARCH_CX no servidor (ver .env.example).");
    }
    const config = parseConfig(await carregarConfig(db));

    const existentes = new Set((await db.select({ urlHash: sinaisMercado.urlHash }).from(sinaisMercado)).map(r => r.urlHash));

    let resultadosBrutos = 0, novosResultados = 0, salvos = 0, ignorados = 0;
    const erros: string[] = [];

    for (const termo of config.termosBusca) {
      if (novosResultados >= MAX_ITENS_POR_EXECUCAO) break;
      let itens;
      try {
        itens = await buscarNaWeb(termo, 10);
      } catch (e: any) {
        erros.push(`${termo}: ${e?.message ?? "erro na busca"}`);
        continue;
      }
      resultadosBrutos += itens.length;

      for (const item of itens) {
        if (novosResultados >= MAX_ITENS_POR_EXECUCAO) break;
        const hash = hashUrl(item.link);
        if (existentes.has(hash)) continue;
        existentes.add(hash);
        novosResultados++;

        const dominioExcluido = config.exclusoes.some(ex => item.displayLink.includes(ex) || item.link.includes(ex));
        if (dominioExcluido) { ignorados++; continue; }

        try {
          const resp = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `Você extrai sinais comerciais de resultados de busca para uma fábrica de letras/letreiros/fachadas que vende por terceirização para gráficas e empresas de comunicação visual, nas regiões Centro-Oeste, Sudeste e Sul do Brasil. Analise o título e trecho fornecidos. Marque relevante=false se não tiver relação plausível com esse contexto (ex: notícia genérica sem relação, empresa de outro ramo, fora das regiões-alvo quando identificável). Nunca invente dados que não estejam no texto — campos desconhecidos ficam null. nivelConfianca="confirmado" só se o trecho afirma o fato diretamente (não inferência sua); senão "inferencia".`,
              },
              { role: "user", content: `Título: ${item.title}\nTrecho: ${item.snippet}\nURL: ${item.link}\nSite: ${item.displayLink}\nTermo de busca que trouxe este resultado: ${termo}` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "sinal_mercado",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    relevante: { type: "boolean" },
                    empresa: { type: ["string", "null"] },
                    uf: { type: ["string", "null"] },
                    municipio: { type: ["string", "null"] },
                    tipoEvento: { type: ["string", "null"], enum: ["inauguracao", "reforma", "expansao", "edital", "concorrente", "outro", null] },
                    relacaoProdutos: { type: ["string", "null"] },
                    nivelConfianca: { type: "string", enum: ["confirmado", "inferencia"] },
                  },
                  required: ["relevante", "empresa", "uf", "municipio", "tipoEvento", "relacaoProdutos", "nivelConfianca"],
                  additionalProperties: false,
                },
              },
            },
          });
          const conteudo = resp.choices?.[0]?.message?.content;
          const extraido = JSON.parse(typeof conteudo === "string" ? conteudo : "{}");
          if (!extraido.relevante) { ignorados++; continue; }

          await db.insert(sinaisMercado).values({
            empresa: extraido.empresa ?? item.title,
            localizacaoTexto: [extraido.municipio, extraido.uf].filter(Boolean).join("/") || null,
            uf: extraido.uf ?? null,
            municipio: extraido.municipio ?? null,
            tipoEvento: extraido.tipoEvento ?? "outro",
            evidenciaTrecho: item.snippet,
            url: item.link,
            urlHash: hash,
            publicador: item.displayLink,
            nivelConfianca: extraido.nivelConfianca === "confirmado" ? "confirmado" : "inferencia",
            relacaoProdutos: extraido.relacaoProdutos ?? null,
            termoBuscaOrigem: termo,
            status: "novo",
          });
          salvos++;
        } catch (e: any) {
          erros.push(`${item.link}: ${e?.message ?? "falha ao processar"}`);
          ignorados++;
        }
      }
    }

    return { resultadosBrutos, novosResultados, salvos, ignorados, erros };
  }),
});
