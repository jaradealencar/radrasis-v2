import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, desc, inArray, ilike, isNull, or, sql } from "drizzle-orm";
import {
  comprasLogisticaHistorico,
  comprasOrdemHistorico,
  comprasOrdemRecebimentos,
} from "../../drizzle/schema";
import {
  calcularFreteCompra,
  logisticaCompraSchema,
} from "../../shared/compras-frete";
import {
  consultarOrdemFrete,
  snapshotFreteNf,
} from "../services/comprasFrete";
import { router, protectedProcedure, requireRole } from "../_core/trpc";
import { getDb } from "../db/db";
import {
  comprasCotacoes as cotacoes,
  comprasCotacaoItens as itens,
  comprasOrdens as ordens,
  comprasOrdemNfs as vinculos,
  comprasCompradores as compradores,
  comprasPoliticas as politicas,
  fornecedorCompras,
  materiasPrimas,
  nfCompraImportacoes as nfs,
  nfCompraItens as nfItens,
  suppliers,
} from "../../drizzle/schema";
import { simularCustoFinalCotacao } from "../../shared/compras-cotacao-simulacao";
import { integrarFornecedorDocumento, normalizarNomeFornecedorDocumento } from "../services/fornecedorDocumentos";
import {
  cotacaoCompraSchema,
  editarOrdemCompraSchema,
  ordemCompraSchema,
  precoConsumo,
  unidadeConsumo,
  menorCotacaoDisponivel,
  recebimentoCompraSchema,
  decisaoCotacaoCompraSchema,
  cotacoesMesmoEscopo,
  calcularTotaisItemFornecedor,
  quantidadeAceitaNoRecebimento,
  type ComparacaoCotacoesSnapshot,
  type LinhaOrdemCompra,
} from "../../shared/compras-cotacoes";

async function banco() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Banco indisponível.",
    });
  return db;
}
const perfilSchema = z.object({
  nome: z.string().trim().min(3).max(256),
  documento: z.string().max(18),
  inscricaoEstadual: z.string().max(32),
});
const cadastrosSchema = z.object({
  empresa: perfilSchema,
  pessoa: perfilSchema,
  endereco: z.string().max(512),
  emailNf: z.string().max(256),
});
const filtrosSchema = z.object({
  materiaPrimaId: z.number().int().positive().optional(),
  inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  fim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const uploadThingDomains = ["ufs.sh", "utfs.io", "uploadthing.com"];
function identidadeFornecedorCompra(cnpj: string | null, nome: string) {
  const normalizado = (cnpj ?? "").replace(/\D/g, "");
  return normalizado.length === 14
    ? `cnpj:${normalizado}`
    : `nome:${normalizarNomeFornecedorDocumento(nome) || nome.trim().toUpperCase()}`;
}

function arquivoUploadThingValido(urlBruta: string, key: string) {
  try {
    const url = new URL(urlBruta);
    const host = url.hostname.toLowerCase();
    const partes = url.pathname.split("/").filter(Boolean);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      uploadThingDomains.some(d => host === d || host.endsWith(`.${d}`)) &&
      partes.length === 2 && partes[0] === "f" && decodeURIComponent(partes[1]) === key;
  } catch {
    return false;
  }
}

function snapshotOrdem(ordem: typeof ordens.$inferSelect) {
  return {
    cotacaoId: ordem.cotacaoId,
    nomeComprador: ordem.nomeComprador,
    comprador: ordem.comprador,
    pagamento: ordem.pagamento,
    condicaoPagamento: ordem.condicaoPagamento,
    dataPrevistaEntrega: ordem.dataPrevistaEntrega,
    comparacaoCotacoes: ordem.comparacaoCotacoes,
    itens: ordem.itens,
    frete: ordem.frete,
    freteModo: ordem.freteModo,
    freteValorInformado: ordem.freteValorInformado,
    pesoPrevistoKg: ordem.pesoPrevistoKg,
    descontoTotal: ordem.descontoTotal,
    total: ordem.total,
    statusAprovacao: ordem.statusAprovacao,
    aprovacaoNome: ordem.aprovacaoNome,
    aprovacaoEm: ordem.aprovacaoEm,
    observacoes: ordem.observacoes,
  };
}


export const comprasRouter = router({
  compradores: protectedProcedure.query(async () => {
    const db = await banco();
    const [cadastro] = await db
      .select()
      .from(compradores)
      .where(eq(compradores.id, 1));
    // Dados da empresa conferidos no destinatário da NF-e nf-aczinox-213876.xml.
    return (
      cadastro?.dados ?? {
        empresa: {
          nome: "Radra Indústria LTDA",
          documento: "11.073.532/0001-75",
          inscricaoEstadual: "283557532",
        },
        pessoa: {
          nome: "Daniel Jara de Alencar",
          documento: "744.911.131-49",
          inscricaoEstadual: "",
        },
        endereco:
          "Rua Pedro de Toledo, 306, Vila Piratininga, CEP 79081-030, Campo Grande/MS",
        emailNf: "radrafinanceiro@gmail.com",
      }
    );
  }),
  salvarCompradores: protectedProcedure
    .input(cadastrosSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await banco();
      await db
        .insert(compradores)
        .values({ id: 1, dados: input, atualizadoPor: ctx.user.id })
        .onConflictDoUpdate({
          target: compradores.id,
          set: {
            dados: input,
            atualizadoPor: ctx.user.id,
            updatedAt: new Date(),
          },
        });
      return { ok: true };
    }),
  salvarCotacao: protectedProcedure
    .input(cotacaoCompraSchema)
    .mutation(async ({ input, ctx }) => {
      const metadadosArquivo = [input.arquivoPdfUrl, input.arquivoPdfKey, input.arquivoPdfSha256, input.arquivoPdfTamanho];
      if (metadadosArquivo.some(valor => valor != null) && (
        !input.arquivoPdfUrl || !input.arquivoPdfKey || !input.arquivoPdfSha256 ||
        !input.arquivoPdfTamanho || !arquivoUploadThingValido(input.arquivoPdfUrl, input.arquivoPdfKey)
      )) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "O PDF original da cotação precisa ter metadados válidos do UploadThing." });
      }
      await integrarFornecedorDocumento({
        cnpj: input.cnpjFornecedor ?? null,
        nome: input.fornecedor,
        criadoPor: ctx.user.name,
      });
      const db = await banco();
      return db.transaction(async tx => {
        const [existente] = await tx
          .select()
          .from(cotacoes)
          .where(eq(cotacoes.chave, input.chave));
        if (existente) return { id: existente.id };
        const ids = [
          ...new Set(
            input.itens.flatMap(i =>
              i.materiaPrimaId ? [i.materiaPrimaId] : []
            )
          ),
        ];
        const mps = ids.length
          ? await tx
              .select()
              .from(materiasPrimas)
              .where(inArray(materiasPrimas.id, ids))
          : [];
        const catalogo = new Map(mps.map(mp => [mp.id, mp]));
        const linhas = input.itens.map(i => {
          const mp = i.materiaPrimaId ? catalogo.get(i.materiaPrimaId) : null;
          if (i.materiaPrimaId && !mp)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Matéria-prima não encontrada.",
            });
          const destino = mp
            ? unidadeConsumo(mp.unidadeMedida)
            : i.unidadeDestino
              ? unidadeConsumo(i.unidadeDestino)
              : null;
          const identica = destino && unidadeConsumo(i.unidade) === destino;
          const fator = i.fatorConversao ?? (identica ? 1 : null);
          if (
            fator &&
            (!destino ||
              (i.unidadeDestino &&
                unidadeConsumo(i.unidadeDestino) !== destino))
          )
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "A unidade de consumo deve ser igual à do cadastro da matéria-prima.",
            });
          return {
            codigo: i.codigo,
            descricao: i.descricao,
            materiaPrimaId: i.materiaPrimaId,
            nomeMateriaPrima: mp?.nome,
            quantidade: String(i.quantidade),
            unidade: i.unidade,
            precoUnitario: String(i.precoUnitario),
            icmsAliquota: i.icmsAliquota == null ? null : String(i.icmsAliquota),
            icmsValor: i.icmsValor == null ? null : String(i.icmsValor),
            ipiAliquota: i.ipiAliquota == null ? null : String(i.ipiAliquota),
            ipiValor: i.ipiValor == null ? null : String(i.ipiValor),
            totalFornecedor: i.totalFornecedor == null ? null : String(i.totalFornecedor),
            pesoUnitarioKg: i.pesoUnitarioKg == null ? null : String(i.pesoUnitarioKg),
            pesoTotalKg: i.pesoTotalKg == null ? null : String(i.pesoTotalKg),
            unidadeOrigem: i.unidadeOrigem ?? i.unidade,
            unidadeDestino: destino,
            fatorConversao: fator ? String(fator) : null,
            formula: i.formula,
            custoMubisys: mp?.custoUnitario,
          };
        });
        const valorFreteInformado = input.freteModo === "cif" && input.freteValorInformado == null
          ? null
          : input.freteValorInformado ?? input.frete;
        const freteCalculado = calcularFreteCompra(
          input.freteModo,
          valorFreteInformado,
          input.pesoFreteKg
        ).total;
        const total =
          input.itens.reduce(
            (s, i) =>
              s + Math.round(i.quantidade * i.precoUnitario * 100) / 100,
            0
          ) + (freteCalculado ?? 0);
        const [cotacao] = await tx
          .insert(cotacoes)
          .values({
            ...input,
            total: total.toFixed(2),
            frete: freteCalculado == null ? null : freteCalculado.toFixed(2),
            freteValorInformado: valorFreteInformado == null ? null : String(valorFreteInformado),
            pesoFreteKg: input.pesoFreteKg == null ? null : String(input.pesoFreteKg),
            criadoPor: ctx.user.id,
          })
          .onConflictDoNothing({ target: cotacoes.chave })
          .returning();
        if (!cotacao) {
          const [outra] = await tx
            .select()
            .from(cotacoes)
            .where(eq(cotacoes.chave, input.chave));
          return { id: outra.id };
        }
        await tx
          .insert(itens)
          .values(linhas.map(i => ({ ...i, cotacaoId: cotacao.id })));
        return { id: cotacao.id };
      });
    }),
  listarCotacoes: protectedProcedure.query(async () =>
    (await banco())
      .select()
      .from(cotacoes)
      .orderBy(desc(cotacoes.id))
      .limit(200)
  ),
  obterCotacao: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await banco();
      const [cotacao] = await db
        .select()
        .from(cotacoes)
        .where(eq(cotacoes.id, input.id));
      if (!cotacao)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cotação não encontrada.",
        });
      return {
        ...cotacao,
        itens: await db
          .select()
          .from(itens)
          .where(eq(itens.cotacaoId, input.id))
          .orderBy(itens.id),
      };
    }),
  emitirOrdem: protectedProcedure
    .input(ordemCompraSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await banco();
      return db.transaction(async tx => {
        const [anterior] = await tx
          .select()
          .from(ordens)
          .where(eq(ordens.chave, input.chave));
        if (anterior) return anterior;
        const [cotacao] = await tx
          .select()
          .from(cotacoes)
          .where(eq(cotacoes.id, input.cotacaoId));
        if (!cotacao)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Cotação não encontrada.",
          });
        let decisaoPersistida: ComparacaoCotacoesSnapshot | null = null;
        if (input.comparacaoCotacoes) {
          const decisao = decisaoCotacaoCompraSchema.safeParse(input.comparacaoCotacoes);
          if (!decisao.success || decisao.data.cotacaoEscolhidaId !== cotacao.id) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "A cotação escolhida não corresponde à ordem." });
          }
          const ids = decisao.data.cotacoesComparadasIds;
          const propostas = await tx.select().from(cotacoes).where(inArray(cotacoes.id, ids));
          if (propostas.length !== ids.length) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Uma das cotações comparadas não foi encontrada." });
          }
          const linhasComparadas = await tx.select().from(itens).where(inArray(itens.cotacaoId, ids));
          const porCotacao = new Map<number, typeof linhasComparadas>();
          for (const linha of linhasComparadas) porCotacao.set(linha.cotacaoId, [...(porCotacao.get(linha.cotacaoId) ?? []), linha]);
          const escopos = propostas.map(proposta => ({ itens: (porCotacao.get(proposta.id) ?? []).map(linha => ({
            materiaPrimaId: linha.materiaPrimaId,
            codigo: linha.codigo,
            descricao: linha.descricao,
            quantidade: Number(linha.quantidade),
            unidade: linha.unidade,
            unidadeDestino: linha.unidadeDestino,
            fatorConversao: linha.fatorConversao == null ? null : Number(linha.fatorConversao),
          })) }));
          const equivalente = cotacoesMesmoEscopo(escopos);
          const calculos = propostas.map(proposta => {
            const linhasCotacao = porCotacao.get(proposta.id) ?? [];
            const subtotalCotado = linhasCotacao.reduce((soma, linha) => soma + Math.round(Number(linha.quantidade) * Number(linha.precoUnitario) * 100) / 100, 0);
            const modo = (proposta.freteModo ?? "valor_total") as "valor_total" | "por_kg" | "gratis" | "cif";
            const informado = modo === "gratis" ? 0 : modo === "cif" && proposta.freteValorInformado == null ? null : proposta.freteValorInformado == null ? proposta.frete == null ? null : Number(proposta.frete) : Number(proposta.freteValorInformado);
            const freteEstimado = informado == null ? null : calcularFreteCompra(modo, informado, proposta.pesoFreteKg == null ? null : Number(proposta.pesoFreteKg)).total;
            const totalFinalEstimado = freteEstimado == null ? null : Number(((subtotalCotado + freteEstimado) * 1.1).toFixed(2));
            return { proposta, linhasCotacao, subtotalCotado, freteEstimado, totalFinalEstimado };
          });
          const menorFinal = equivalente && calculos.every(c => c.totalFinalEstimado != null)
            ? Math.min(...calculos.map(c => c.totalFinalEstimado!))
            : null;
          const escolhida = calculos.find(c => c.proposta.id === cotacao.id);
          const eMenor = menorFinal != null && escolhida?.totalFinalEstimado != null && Math.abs(escolhida.totalFinalEstimado - menorFinal) <= 0.01;
          const motivoEscolha = decisao.data.motivoEscolha.trim();
          if ((!equivalente || !eMenor) && motivoEscolha.length < 3) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o motivo quando a cotação escolhida não tiver o menor custo final comparável." });
          }
          decisaoPersistida = {
            cotacaoEscolhidaId: cotacao.id,
            comparacaoEquivalente: equivalente,
            motivoEscolha: motivoEscolha || "Menor preço final estimado entre propostas equivalentes.",
            menorFinalEstimado: menorFinal,
            cotacoesComparadas: calculos.map(c => ({
              id: c.proposta.id,
              fornecedor: c.proposta.fornecedor,
              cnpjFornecedor: c.proposta.cnpjFornecedor,
              dataCotacao: c.proposta.dataCotacao,
              validadeDias: c.proposta.validadeDias,
              condicaoPagamento: c.proposta.condicaoPagamento,
              prazoEntrega: c.proposta.prazoEntrega,
              totalOriginalComFrete: c.freteEstimado == null ? null : Number((c.subtotalCotado + c.freteEstimado).toFixed(2)),
              subtotalCotado: c.subtotalCotado,
              freteEstimado: c.freteEstimado,
              totalFinalEstimado: c.totalFinalEstimado,
              itens: c.linhasCotacao.map(linha => ({
                materiaPrimaId: linha.materiaPrimaId,
                descricao: linha.descricao,
                quantidade: linha.quantidade,
                unidade: linha.unidade,
                unidadeDestino: linha.unidadeDestino,
                precoUnitario: linha.precoUnitario,
              })),
            })),
          };
        }
        if (
          input.comprador.tipo === "empresa" &&
          !input.comprador.inscricaoEstadual.trim()
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Informe a inscrição estadual da empresa.",
          });
        const origens = await tx
          .select()
          .from(itens)
          .where(eq(itens.cotacaoId, input.cotacaoId));
        const linhas: LinhaOrdemCompra[] = input.itens.map(i => {
          const origem = origens.find(o => o.id === i.itemId);
          if (!origem)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Item não pertence à cotação.",
            });
          const precoCotado = Number(origem.precoUnitario);
          const preco = i.precoUnitario ?? precoCotado;
          if (i.precoUnitario == null && !(precoCotado > 0))
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "O preço deste item não está disponível na cotação. Atualize o preço antes de emitir a ordem.",
            });
          const tributos = calcularTotaisItemFornecedor({
            quantidade: i.quantidade,
            precoUnitario: preco,
            quantidadeCotada: Number(origem.quantidade),
            precoUnitarioCotado: precoCotado,
            totalFornecedorCotado: origem.totalFornecedor == null ? null : Number(origem.totalFornecedor),
            icmsAliquota: origem.icmsAliquota == null ? null : Number(origem.icmsAliquota),
            icmsValorCotado: origem.icmsValor == null ? null : Number(origem.icmsValor),
            ipiAliquota: origem.ipiAliquota == null ? null : Number(origem.ipiAliquota),
            ipiValorCotado: origem.ipiValor == null ? null : Number(origem.ipiValor),
          });
          return {
            itemId: origem.id,
            materiaPrimaId: origem.materiaPrimaId,
            codigo: origem.codigo,
            descricao: origem.descricao,
            unidade: origem.unidade,
            quantidade: i.quantidade,
            precoUnitario: preco,
            precoCotadoUnitario: precoCotado,
            icmsAliquota: origem.icmsAliquota == null ? null : Number(origem.icmsAliquota),
            icmsValor: tributos.icmsValor,
            ipiAliquota: origem.ipiAliquota == null ? null : Number(origem.ipiAliquota),
            ipiValor: tributos.ipiValor,
            pesoUnitarioKg: origem.pesoUnitarioKg == null ? null : Number(origem.pesoUnitarioKg),
            pesoTotalKg: origem.pesoTotalKg == null ? null : Number(origem.pesoTotalKg),
            total: tributos.total,
            totalFornecedor: tributos.totalFornecedor,
            unidadeDestino: origem.unidadeDestino,
            fatorConversao: origem.fatorConversao
              ? Number(origem.fatorConversao)
              : null,
            formula: origem.formula,
          };
        });
        const valorInformado = input.freteModo === "cif" && input.freteValorInformado == null
          ? null
          : input.freteValorInformado ?? input.frete;
        const frete = calcularFreteCompra(
          input.freteModo,
          valorInformado,
          input.pesoPrevistoKg
        ).total;
        const subtotal = linhas.reduce((s, l) => s + (l.totalFornecedor ?? l.total), 0);
        const totalBruto = Math.round((subtotal + (frete ?? 0)) * 100) / 100;
        const descontoTotal = Math.round(input.descontoTotal * 100) / 100;
        if (descontoTotal > totalBruto) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O desconto obtido não pode superar o total da ordem.",
          });
        }
        const total = totalBruto - descontoTotal;
        const [politicaAprovacao] = await tx
          .select()
          .from(politicas)
          .where(eq(politicas.id, 1));
        const limiteAprovacao = politicaAprovacao?.limiteAprovacao == null
          ? null
          : Number(politicaAprovacao.limiteAprovacao);
        const statusAprovacao = limiteAprovacao != null && total >= limiteAprovacao
          ? "pendente"
          : "dispensada";
        const [ordem] = await tx
          .insert(ordens)
          .values({
            ...input,
            comparacaoCotacoes: decisaoPersistida,
            dataPrevistaEntrega: input.dataPrevistaEntrega ?? null,
            statusAprovacao,
            descontoTotal: descontoTotal.toFixed(2),
            nomeComprador: input.nomeComprador ?? input.comprador.nome,
            itens: linhas,
            frete: (frete ?? 0).toFixed(2),
            freteValorInformado: valorInformado == null ? null : String(valorInformado),
            freteConfirmado: input.freteModo === "cif",
            pesoPrevistoKg:
              input.freteModo === "cif" || input.pesoPrevistoKg == null
                ? null
                : String(input.pesoPrevistoKg),
            volumePrevistoM3:
              input.volumePrevistoM3 == null
                ? null
                : String(input.volumePrevistoM3),
            total: total.toFixed(2),
            criadoPor: ctx.user.id,
          })
          .onConflictDoNothing({ target: ordens.chave })
          .returning();
        if (ordem) {
          await tx.insert(comprasOrdemHistorico).values({
            ordemId: ordem.id,
            evento: "criada",
            antes: null,
            depois: snapshotOrdem(ordem),
            motivo: decisaoPersistida ? String(decisaoPersistida.motivoEscolha ?? "") : null,
            criadoPor: ctx.user.id,
            nomeUsuario: ctx.user.name,
          });
          return ordem;
        }
        const [outra] = await tx
          .select()
          .from(ordens)
          .where(eq(ordens.chave, input.chave));
        return outra;
      });
    }),
  listarOrdens: protectedProcedure
    .input(
      z
        .object({
          busca: z.string().max(256).optional(),
          inicio: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          fim: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          pagina: z.number().int().nonnegative().default(0),
          cnpjFornecedor: z.string().optional(),
        })
        .default({ pagina: 0 })
    )
    .query(async ({ input }) =>
      (await banco())
        .select({ ordem: ordens, fornecedor: cotacoes.fornecedor })
        .from(ordens)
        .innerJoin(cotacoes, eq(cotacoes.id, ordens.cotacaoId))
        .where(
          and(
            isNull(ordens.excluidaEm),
            input.busca
              ? or(
                  ilike(cotacoes.fornecedor, `%${input.busca}%`),
                  ilike(ordens.transportadora, `%${input.busca}%`),
                  sql`cast(${ordens.id} as text) = ${input.busca}`
                )
              : undefined,
            input.inicio
              ? sql`(${ordens.createdAt} at time zone 'UTC' at time zone 'America/Campo_Grande')::date >= ${input.inicio}::date`
              : undefined,
            input.fim
              ? sql`(${ordens.createdAt} at time zone 'UTC' at time zone 'America/Campo_Grande')::date <= ${input.fim}::date`
              : undefined,
            input.cnpjFornecedor
              ? sql`regexp_replace(coalesce(${cotacoes.cnpjFornecedor}, ''), '[^0-9]', '', 'g') = ${input.cnpjFornecedor.replace(/\D/g, "")}`
              : undefined
          )
        )
        .orderBy(desc(ordens.id))
        .limit(50)
        .offset(input.pagina * 50)
    ),
  descontosObtidos: protectedProcedure
    .input(
      z
        .object({
          inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        })
        .default({})
    )
    .query(async ({ input }) => {
      const db = await banco();
      const nomeComprador = sql<string>`coalesce(nullif(btrim(${ordens.nomeComprador}), ''), 'Não informado')`;
      const linhas = await db
        .select({
          comprador: nomeComprador,
          descontoTotal: sql<string>`coalesce(sum(${ordens.descontoTotal}), 0)`,
          quantidadeOrdens: sql<number>`count(*)::int`,
        })
        .from(ordens)
        .where(
          and(
            isNull(ordens.excluidaEm),
            input.inicio
              ? sql`(${ordens.createdAt} at time zone 'UTC' at time zone 'America/Campo_Grande')::date >= ${input.inicio}::date`
              : undefined,
            input.fim
              ? sql`(${ordens.createdAt} at time zone 'UTC' at time zone 'America/Campo_Grande')::date <= ${input.fim}::date`
              : undefined
          )
        )
        .groupBy(nomeComprador)
        .orderBy(desc(sql`sum(${ordens.descontoTotal})`), nomeComprador);
      const porComprador = linhas.map(linha => ({
        comprador: linha.comprador,
        descontoTotal: Number(linha.descontoTotal),
        quantidadeOrdens: Number(linha.quantidadeOrdens),
      }));
      return {
        descontoTotal: porComprador.reduce(
          (total, linha) => total + linha.descontoTotal,
          0
        ),
        quantidadeOrdens: porComprador.reduce(
          (total, linha) => total + linha.quantidadeOrdens,
          0
        ),
        porComprador,
      };
    }),
  politicaAprovacao: protectedProcedure.query(async ({ ctx }) => {
    const db = await banco();
    const [politica] = await db.select().from(politicas).where(eq(politicas.id, 1));
    return {
      limiteAprovacao: politica?.limiteAprovacao == null ? null : Number(politica.limiteAprovacao),
      atualizadoEm: politica?.updatedAt ?? null,
      podeConfigurar: ["admin", "master", "gestor"].includes(String(ctx.user.role)),
      podeAprovar: ["admin", "master", "gestor"].includes(String(ctx.user.role)),
    };
  }),
  salvarPoliticaAprovacao: protectedProcedure
    .use(requireRole("gestor", "admin", "master"))
    .input(z.object({ limiteAprovacao: z.number().finite().positive().max(1e9).nullable() }))
    .mutation(async ({ input, ctx }) => {
      const db = await banco();
      await db.insert(politicas).values({
        id: 1,
        limiteAprovacao: input.limiteAprovacao == null ? null : input.limiteAprovacao.toFixed(2),
        atualizadoPor: ctx.user.id,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: politicas.id,
        set: {
          limiteAprovacao: input.limiteAprovacao == null ? null : input.limiteAprovacao.toFixed(2),
          atualizadoPor: ctx.user.id,
          updatedAt: new Date(),
        },
      });
      return { ok: true };
    }),
  aprovarOrdem: protectedProcedure
    .use(requireRole("gestor", "admin", "master"))
    .input(z.object({ id: z.number().int().positive(), motivo: z.string().trim().max(1000).default("") }))
    .mutation(async ({ input, ctx }) => {
      const db = await banco();
      return db.transaction(async tx => {
        const [atual] = await tx.select().from(ordens).where(eq(ordens.id, input.id)).for("update");
        if (!atual || atual.excluidaEm) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem não encontrada." });
        if (atual.statusAprovacao !== "pendente") throw new TRPCError({ code: "CONFLICT", message: "Esta ordem não está aguardando aprovação." });
        const [salva] = await tx.update(ordens).set({
          statusAprovacao: "aprovada",
          aprovacaoPor: ctx.user.id,
          aprovacaoNome: ctx.user.name,
          aprovacaoEm: new Date(),
        }).where(eq(ordens.id, input.id)).returning();
        await tx.insert(comprasOrdemHistorico).values({
          ordemId: input.id,
          evento: "aprovada",
          antes: snapshotOrdem(atual),
          depois: snapshotOrdem(salva),
          motivo: input.motivo || "Aprovação por limite de valor configurado.",
          criadoPor: ctx.user.id,
          nomeUsuario: ctx.user.name,
        });
        return salva;
      });
    }),
  editarOrdem: protectedProcedure
    .input(editarOrdemCompraSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await banco();
      return db.transaction(async tx => {
        const [atual] = await tx
          .select()
          .from(ordens)
          .where(eq(ordens.id, input.id))
          .for("update");
        if (!atual || atual.excluidaEm)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Ordem de compra não encontrada.",
          });
        const [nfVinculada] = await tx
          .select({ id: vinculos.id })
          .from(vinculos)
          .where(eq(vinculos.ordemId, input.id))
          .limit(1);
        if (nfVinculada)
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Esta ordem já tem NF vinculada e foi bloqueada para preservar a auditoria. Edite somente a logística.",
          });
        if (
          input.comprador.tipo === "empresa" &&
          !input.comprador.inscricaoEstadual.trim()
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Informe a inscrição estadual da empresa.",
          });
        const recebimentosExistentes = await tx
          .select()
          .from(comprasOrdemRecebimentos)
          .where(eq(comprasOrdemRecebimentos.ordemId, input.id));
        const origens = await tx
          .select()
          .from(itens)
          .where(eq(itens.cotacaoId, atual.cotacaoId));
        const linhas: LinhaOrdemCompra[] = input.itens.map(i => {
          const origem = origens.find(o => o.id === i.itemId);
          if (!origem)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Item não pertence à cotação desta ordem.",
            });
          const precoCotado = Number(origem.precoUnitario);
          const tributos = calcularTotaisItemFornecedor({
            quantidade: i.quantidade,
            precoUnitario: i.precoUnitario,
            quantidadeCotada: Number(origem.quantidade),
            precoUnitarioCotado: precoCotado,
            totalFornecedorCotado: origem.totalFornecedor == null ? null : Number(origem.totalFornecedor),
            icmsAliquota: origem.icmsAliquota == null ? null : Number(origem.icmsAliquota),
            icmsValorCotado: origem.icmsValor == null ? null : Number(origem.icmsValor),
            ipiAliquota: origem.ipiAliquota == null ? null : Number(origem.ipiAliquota),
            ipiValorCotado: origem.ipiValor == null ? null : Number(origem.ipiValor),
          });
          return {
            itemId: origem.id,
            materiaPrimaId: origem.materiaPrimaId,
            codigo: origem.codigo,
            descricao: origem.descricao,
            unidade: origem.unidade,
            quantidade: i.quantidade,
            precoUnitario: i.precoUnitario,
            precoCotadoUnitario: precoCotado,
            icmsAliquota: origem.icmsAliquota == null ? null : Number(origem.icmsAliquota),
            icmsValor: tributos.icmsValor,
            ipiAliquota: origem.ipiAliquota == null ? null : Number(origem.ipiAliquota),
            ipiValor: tributos.ipiValor,
            pesoUnitarioKg: origem.pesoUnitarioKg == null ? null : Number(origem.pesoUnitarioKg),
            pesoTotalKg: origem.pesoTotalKg == null ? null : Number(origem.pesoTotalKg),
            total: tributos.total,
            totalFornecedor: tributos.totalFornecedor,
            unidadeDestino: origem.unidadeDestino,
            fatorConversao: origem.fatorConversao
              ? Number(origem.fatorConversao)
              : null,
            formula: origem.formula,
          };
        });
        const recebidoPorItem = new Map<number, number>();
        const entregueFisicamentePorItem = new Map<number, number>();
        for (const recebimento of recebimentosExistentes) {
          for (const linha of recebimento.itens) {
            recebidoPorItem.set(linha.itemId, (recebidoPorItem.get(linha.itemId) ?? 0) + quantidadeAceitaNoRecebimento(linha));
            entregueFisicamentePorItem.set(linha.itemId, (entregueFisicamentePorItem.get(linha.itemId) ?? 0) + linha.quantidadeRecebida);
          }
        }
        for (const [itemId, quantidadeFisica] of entregueFisicamentePorItem) {
          if (quantidadeFisica > 0 && !linhas.some(linha => linha.itemId === itemId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Um item com recebimento fÃ­sico nÃ£o pode ser removido da ordem." });
          }
        }
        for (const [itemId, quantidadeRecebida] of recebidoPorItem) {
          const linhaNova = linhas.find(linha => linha.itemId === itemId);
          if (!linhaNova || linhaNova.quantidade + 1e-6 < quantidadeRecebida) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "A quantidade da ordem não pode ficar abaixo do que já foi recebido." });
          }
        }
        const subtotal = linhas.reduce((s, linha) => s + (linha.totalFornecedor ?? linha.total), 0);
        const frete = calcularFreteCompra(
          atual.freteModo as "valor_total" | "por_kg" | "gratis" | "cif",
          atual.freteModo === "cif" && atual.freteValorInformado == null
            ? null
            : atual.freteValorInformado == null
            ? Number(atual.frete)
            : Number(atual.freteValorInformado),
          atual.pesoPrevistoKg == null ? null : Number(atual.pesoPrevistoKg)
        ).total;
        const totalBruto = Math.round((subtotal + (frete ?? 0)) * 100) / 100;
        const descontoTotal = Math.round(
          (input.descontoTotal ?? Number(atual.descontoTotal ?? 0)) * 100
        ) / 100;
        if (descontoTotal > totalBruto) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O desconto obtido não pode superar o total da ordem.",
          });
        }
        const totalLiquido = totalBruto - descontoTotal;
        const [politicaAprovacao] = await tx
          .select()
          .from(politicas)
          .where(eq(politicas.id, 1));
        const limiteAprovacao = politicaAprovacao?.limiteAprovacao == null
          ? null
          : Number(politicaAprovacao.limiteAprovacao);
        const statusAprovacao = limiteAprovacao != null && totalLiquido >= limiteAprovacao
          ? "pendente"
          : "dispensada";
        const antes = snapshotOrdem(atual);
        const [salva] = await tx
          .update(ordens)
          .set({
            nomeComprador: input.nomeComprador,
            dataPrevistaEntrega: input.dataPrevistaEntrega,
            descontoTotal: descontoTotal.toFixed(2),
            comprador: input.comprador,
            pagamento: input.pagamento,
            condicaoPagamento: input.condicaoPagamento,
            observacoes: input.observacoes,
            itens: linhas,
            total: totalLiquido.toFixed(2),
            statusAprovacao,
            aprovacaoPor: null,
            aprovacaoNome: null,
            aprovacaoEm: null,
          })
          .where(eq(ordens.id, input.id))
          .returning();
        await tx.insert(comprasOrdemHistorico).values({
          ordemId: input.id,
          evento: "editada",
          antes,
          depois: snapshotOrdem(salva),
          motivo: input.motivoAlteracao || null,
          criadoPor: ctx.user.id,
          nomeUsuario: ctx.user.name,
        });
        return salva;
      });
    }),
  excluirOrdem: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await banco();
      return db.transaction(async tx => {
        const [atual] = await tx
          .select()
          .from(ordens)
          .where(eq(ordens.id, input.id))
          .for("update");
        if (!atual || atual.excluidaEm)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Ordem de compra não encontrada.",
          });
        const [nfVinculada] = await tx
          .select({ id: vinculos.id })
          .from(vinculos)
          .where(eq(vinculos.ordemId, input.id))
          .limit(1);
        const [recebimento] = await tx
          .select({ id: comprasOrdemRecebimentos.id })
          .from(comprasOrdemRecebimentos)
          .where(eq(comprasOrdemRecebimentos.ordemId, input.id))
          .limit(1);
        if (nfVinculada || recebimento)
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Esta ordem já tem NF ou recebimento físico registrado. Ela permanece preservada para auditoria.",
          });
        const [excluida] = await tx
          .update(ordens)
          .set({ excluidaEm: new Date(), excluidaPor: ctx.user.id })
          .where(eq(ordens.id, input.id))
          .returning();
        if (!excluida) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de compra nÃ£o encontrada." });
        await tx.insert(comprasOrdemHistorico).values({
          ordemId: input.id,
          evento: "excluida",
          antes: snapshotOrdem(atual),
          depois: { ...snapshotOrdem(excluida), excluida: true },
          motivo: "ExclusÃ£o lÃ³gica da ordem.",
          criadoPor: ctx.user.id,
          nomeUsuario: ctx.user.name,
        });
        return { ok: true };
      });
    }),
  obterOrdemFrete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await banco();
      return {
        ...(await consultarOrdemFrete(db, input.id)),
        historico: await db
          .select()
          .from(comprasLogisticaHistorico)
          .where(eq(comprasLogisticaHistorico.ordemId, input.id))
          .orderBy(desc(comprasLogisticaHistorico.revisao)),
      };
    }),
  atualizarLogistica: protectedProcedure
    .input(logisticaCompraSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await banco();
      return db.transaction(async tx => {
        const atual = await consultarOrdemFrete(tx, input.ordemId, true);
        if (atual.ordem.logisticaRevisao !== input.revisao)
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "A logística foi alterada. Reabra a ordem para atualizar os dados.",
          });
        const valorFreteInformado = input.freteModo === "cif" && input.freteValorInformado == null
          ? null
          : input.freteValorInformado ?? input.frete;
        const frete = calcularFreteCompra(
          input.freteModo,
          valorFreteInformado,
          input.pesoPrevistoKg
        ).total;
        if (frete != null && input.freteModo !== "por_kg" && frete + 0.001 < atual.utilizado)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "O frete total não pode ser menor que o valor já aplicado às NFs.",
          });
        const revisao = input.revisao + 1;
        const { ordemId, revisao: _, ...dados } = input;
        const subtotal = atual.ordem.itens.reduce((s, i) => s + (i.totalFornecedor ?? i.total), 0);
        const descontoTotal = Number(atual.ordem.descontoTotal ?? 0);
        const totalLiquido = Math.max(0, subtotal + (frete ?? 0) - descontoTotal);
        const [politicaAprovacao] = await tx.select().from(politicas).where(eq(politicas.id, 1));
        const limiteAprovacao = politicaAprovacao?.limiteAprovacao == null ? null : Number(politicaAprovacao.limiteAprovacao);
        const statusAprovacao = limiteAprovacao != null && totalLiquido >= limiteAprovacao ? "pendente" : "dispensada";
        const antes = snapshotOrdem(atual.ordem);
        const [salva] = await tx
          .update(ordens)
          .set({
            ...dados,
            frete: (frete ?? 0).toFixed(2),
            freteValorInformado: valorFreteInformado == null ? null : String(valorFreteInformado),
            pesoPrevistoKg:
              input.pesoPrevistoKg == null
                ? null
                : String(input.pesoPrevistoKg),
            volumePrevistoM3:
              input.volumePrevistoM3 == null
                ? null
                : String(input.volumePrevistoM3),
            logisticaRevisao: revisao,
            total: totalLiquido.toFixed(2),
            statusAprovacao,
            aprovacaoPor: null,
            aprovacaoNome: null,
            aprovacaoEm: null,
          })
          .where(eq(ordens.id, ordemId))
          .returning();
        await tx
          .insert(comprasLogisticaHistorico)
          .values({ ordemId, revisao, dados, criadoPor: ctx.user.id });
        await tx.insert(comprasOrdemHistorico).values({
          ordemId,
          evento: "logistica_atualizada",
          antes,
          depois: snapshotOrdem(salva),
          motivo: "Revisão de frete/coleta.",
          criadoPor: ctx.user.id,
          nomeUsuario: ctx.user.name,
        });
        return { ok: true };
      });
    }),
  vincularNf: protectedProcedure
    .input(
      z.object({
        ordemId: z.number().int().positive(),
        importacaoId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await banco();
      return db.transaction(async tx => {
        const ordemFrete = await consultarOrdemFrete(tx, input.ordemId, true);
        if (ordemFrete.ordem.statusAprovacao === "pendente") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A ordem precisa ser aprovada antes de vincular a NF." });
        }
        const [registro] = await tx
          .select({ cnpj: cotacoes.cnpjFornecedor, nome: cotacoes.fornecedor })
          .from(ordens)
          .innerJoin(cotacoes, eq(cotacoes.id, ordens.cotacaoId))
          .where(eq(ordens.id, input.ordemId));
        const [nf] = await tx
          .select()
          .from(nfs)
          .where(eq(nfs.id, input.importacaoId))
          .for("update");
        if (!registro || !nf || nf.status !== "concluida")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione uma ordem e uma NF concluída.",
          });
        const digitos = (s: string | null) => (s ?? "").replace(/\D/g, "");
        const nome = (s: string | null) =>
          (s ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
        if (
          registro.cnpj
            ? digitos(registro.cnpj) !== digitos(nf.cnpjFornecedor)
            : nome(registro.nome) !== nome(nf.nomeFornecedor)
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A NF pertence a outro fornecedor.",
          });
        const [existente] = await tx
          .select()
          .from(vinculos)
          .where(eq(vinculos.importacaoId, input.importacaoId));
        if (existente && existente.ordemId !== input.ordemId)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Esta NF já está associada a outra ordem.",
          });
        if (existente) return { ok: true };
        const snapshot = snapshotFreteNf(
          ordemFrete,
          Number(nf.valorFreteNf),
          nf.pesoLiquidoTotalKg ? Number(nf.pesoLiquidoTotalKg) : null
        );
        if (Math.abs(snapshot.freteAplicado - Number(nf.valorFreteNf)) > 0.005)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "O frete desta NF já auditada difere da tarifa da ordem. Revise os valores antes de vincular; o custo antigo não será alterado silenciosamente.",
          });
        const [vinculo] = await tx
          .insert(vinculos)
          .values({
            ...input,
            criadoPor: ctx.user.id,
            logisticaSnapshot: snapshot,
          })
          .onConflictDoNothing()
          .returning();
        if (vinculo) {
          await tx.insert(comprasOrdemHistorico).values({
            ordemId: input.ordemId,
            evento: "nf_vinculada",
            antes: null,
            depois: { importacaoId: input.importacaoId, numeroNf: nf.numero, snapshotFrete: snapshot },
            motivo: "NF concluÃ­da vinculada Ã  ordem.",
            criadoPor: ctx.user.id,
            nomeUsuario: ctx.user.name,
          });
        }
        return { ok: true };
      });
    }),
  registrarRecebimento: protectedProcedure
    .input(recebimentoCompraSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await banco();
      return db.transaction(async tx => {
        const [ordem] = await tx.select().from(ordens).where(eq(ordens.id, input.ordemId)).for("update");
        if (!ordem || ordem.excluidaEm) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem não encontrada." });
        if (ordem.statusAprovacao === "pendente") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A ordem precisa ser aprovada antes de registrar o recebimento." });
        const itensOrdem = new Map(ordem.itens.map(item => [item.itemId, item]));
        const existentes = await tx.select().from(comprasOrdemRecebimentos).where(eq(comprasOrdemRecebimentos.ordemId, input.ordemId));
        const recebidoPorItem = new Map<number, number>();
        for (const recebimento of existentes) {
          for (const linha of recebimento.itens) recebidoPorItem.set(linha.itemId, (recebidoPorItem.get(linha.itemId) ?? 0) + quantidadeAceitaNoRecebimento(linha));
        }
        const linhas = input.itens.map(linha => {
          const item = itensOrdem.get(linha.itemId);
          if (!item) throw new TRPCError({ code: "BAD_REQUEST", message: "O item não pertence a esta ordem." });
          const totalAceitoNovo = (recebidoPorItem.get(linha.itemId) ?? 0) + quantidadeAceitaNoRecebimento(linha);
          if (totalAceitoNovo > item.quantidade + 1e-6) throw new TRPCError({ code: "BAD_REQUEST", message: `A quantidade aceita de ${item.descricao} supera a quantidade pedida.` });
          return {
            itemId: item.itemId,
            descricao: item.descricao,
            codigo: item.codigo,
            unidade: item.unidade,
            quantidadePedida: item.quantidade,
            quantidadeRecebida: linha.quantidadeRecebida,
            quantidadeRecusada: linha.quantidadeRecusada,
          };
        });
        const [registro] = await tx.insert(comprasOrdemRecebimentos).values({
          ordemId: input.ordemId,
          dataRecebimento: input.dataRecebimento,
          itens: linhas,
          observacoes: input.observacoes,
          recebidoPor: ctx.user.id,
          nomeRecebedor: ctx.user.name,
        }).returning();
        await tx.insert(comprasOrdemHistorico).values({
          ordemId: input.ordemId,
          evento: "recebimento_registrado",
          antes: null,
          depois: { dataRecebimento: registro.dataRecebimento, itens: registro.itens, observacoes: registro.observacoes },
          motivo: registro.observacoes || "Recebimento físico registrado.",
          criadoPor: ctx.user.id,
          nomeUsuario: ctx.user.name,
        });
        return registro;
      });
    }),
  historicoOrdem: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await banco();
      return db.select().from(comprasOrdemHistorico)
        .where(eq(comprasOrdemHistorico.ordemId, input.id))
        .orderBy(desc(comprasOrdemHistorico.createdAt), desc(comprasOrdemHistorico.id));
    }),
  painel: protectedProcedure.input(filtrosSchema).query(async ({ input }) => {
    const db = await banco();
    const cotados = await db
      .select({ item: itens, cotacao: cotacoes })
      .from(itens)
      .innerJoin(cotacoes, eq(cotacoes.id, itens.cotacaoId))
      .where(
        input.materiaPrimaId
          ? eq(itens.materiaPrimaId, input.materiaPrimaId)
          : undefined
      )
      .orderBy(desc(cotacoes.dataCotacao), desc(itens.id))
      .limit(5000);
    const comprados = await db
      .select({
        item: nfItens,
        nf: nfs,
        ordemId: vinculos.ordemId,
        dataOrdem: ordens.createdAt,
        nome: materiasPrimas.nome,
      })
      .from(nfItens)
      .innerJoin(nfs, eq(nfs.id, nfItens.importacaoId))
      .leftJoin(vinculos, eq(vinculos.importacaoId, nfs.id))
      .leftJoin(ordens, eq(ordens.id, vinculos.ordemId))
      .leftJoin(materiasPrimas, eq(materiasPrimas.id, nfItens.materiaPrimaId))
      .where(
        and(
          eq(nfs.status, "concluida"),
          input.materiaPrimaId
            ? eq(nfItens.materiaPrimaId, input.materiaPrimaId)
            : undefined
        )
      )
      .orderBy(desc(nfs.createdAt), desc(nfItens.id))
      .limit(5000);
    const referencias = cotados.map(({ item, cotacao }) => ({
      materiaPrimaId: item.materiaPrimaId,
      unidade: item.unidadeDestino ?? "",
      preco: precoConsumo(
        Number(item.precoUnitario),
        item.fatorConversao ? Number(item.fatorConversao) : null,
        item.unidadeDestino
      ),
      data: cotacao.dataCotacao,
      fornecedor: cotacao.fornecedor,
      cotacaoId: cotacao.id,
      validadeDias: cotacao.validadeDias,
      quantidade: Number(item.quantidade),
      fator: item.fatorConversao ? Number(item.fatorConversao) : null,
    }));
    const noPeriodo = (d: string) =>
      (!input.inicio || d >= input.inicio) && (!input.fim || d <= input.fim);
    const pontos = cotados.map(({ item, cotacao }) => ({
      origem: "Cotação" as const,
      id: item.id,
      documentoId: cotacao.id,
      data: cotacao.dataCotacao,
      materiaPrimaId: item.materiaPrimaId,
      nome: item.nomeMateriaPrima ?? item.descricao,
      fornecedor: cotacao.fornecedor,
      unidade: item.unidadeDestino ?? item.unidade,
      preco: precoConsumo(
        Number(item.precoUnitario),
        item.fatorConversao ? Number(item.fatorConversao) : null,
        item.unidadeDestino
      ),
      precoOriginal: Number(item.precoUnitario),
      unidadeOriginal: item.unidade,
      quantidade: Number(item.quantidade),
      custoFinal: null as number | null,
      ordemId: null as number | null,
      menor: null as (typeof referencias)[number] | null,
      diferenca: null as number | null,
    }));
    for (const { item, nf, ordemId, dataOrdem, nome } of comprados) {
      const data = (nf.dataEmissao ?? nf.createdAt.toISOString()).slice(0, 10);
      const fator = item.fatorConversao ? Number(item.fatorConversao) : null;
      const preco = precoConsumo(
        Number(item.valorUnitario),
        fator,
        item.unidadeErp
      );
      const dataDecisao = dataOrdem
        ? dataOrdem.toLocaleDateString("en-CA", {
            timeZone: "America/Campo_Grande",
          })
        : data;
      const menor =
        preco == null
          ? null
          : menorCotacaoDisponivel(referencias, {
              materiaPrimaId: item.materiaPrimaId,
              unidade: item.unidadeErp ?? "",
              data: dataDecisao,
              quantidade: Number(item.quantidadeErp ?? 0),
            });
      pontos.push({
        origem: "NF" as "Cotação",
        id: item.id,
        documentoId: nf.id,
        data,
        materiaPrimaId: item.materiaPrimaId,
        nome: nome ?? item.descricaoNf,
        fornecedor: nf.nomeFornecedor ?? nf.cnpjFornecedor,
        unidade: item.unidadeErp ?? item.unidadeCompra,
        preco,
        precoOriginal: Number(item.valorUnitario),
        unidadeOriginal: item.unidadeCompra,
        quantidade: Number(item.quantidade),
        custoFinal: item.custoRealErp ? Number(item.custoRealErp) : null,
        ordemId,
        menor,
        diferenca:
          menor && preco != null
            ? (preco - menor.preco!) * Number(item.quantidadeErp ?? 0)
            : null,
      });
    }
    return {
      pontos: pontos
        .filter(p => noPeriodo(p.data))
        .sort((a, b) => a.data.localeCompare(b.data)),
      limiteAtingido: cotados.length === 5000 || comprados.length === 5000,
    };
  }),
  sincronizarCadastroFornecedores: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await banco();
    const cotacoesSalvas = await db.select({ fornecedor: cotacoes.fornecedor, cnpjFornecedor: cotacoes.cnpjFornecedor }).from(cotacoes);
    const unicas = new Map<string, { fornecedor: string; cnpjFornecedor: string | null }>();
    for (const cotacao of cotacoesSalvas) {
      const chave = identidadeFornecedorCompra(cotacao.cnpjFornecedor, cotacao.fornecedor);
      if (!unicas.has(chave)) unicas.set(chave, cotacao);
    }
    let cadastrosCriados = 0;
    for (const cotacao of unicas.values()) {
      const resultado = await integrarFornecedorDocumento({
        cnpj: cotacao.cnpjFornecedor,
        nome: cotacao.fornecedor,
        criadoPor: ctx.user.name,
      });
      if (resultado?.criado) cadastrosCriados++;
    }
    return { fornecedoresSincronizados: unicas.size, cadastrosCriados };
  }),
  indicadoresFornecedores: protectedProcedure.query(async () => {
    const db = await banco();
    const [listaOrdens, cotacoesSalvas, cadastroFornecedores, comprasCadastro, mpConciliadas] = await Promise.all([
      db
        .select({ ordem: ordens, fornecedor: cotacoes.fornecedor, cnpj: cotacoes.cnpjFornecedor })
        .from(ordens)
        .innerJoin(cotacoes, eq(cotacoes.id, ordens.cotacaoId))
        .where(isNull(ordens.excluidaEm)),
      db.select().from(cotacoes).orderBy(desc(cotacoes.dataCotacao), desc(cotacoes.id)),
      db.select().from(suppliers),
      db.select({ fornecedorId: fornecedorCompras.fornecedorId }).from(fornecedorCompras),
      db
        .select({ total: sql<number>`count(distinct ${nfItens.materiaPrimaId})` })
        .from(nfItens)
        .innerJoin(nfs, eq(nfs.id, nfItens.importacaoId))
        .where(and(
          eq(nfs.status, "concluida"),
          sql`${nfItens.materiaPrimaId} is not null`,
          sql`${nfItens.quantidadeErp} > 0`,
          sql`${nfItens.unidadeErp} is not null`,
          sql`${nfItens.custoRealErp} > 0`,
        )),
    ]);

    const digitos = (valor: string | null | undefined) => (valor ?? "").replace(/\D/g, "");
    const porCnpj = new Map<string, typeof cadastroFornecedores>();
    const porNome = new Map<string, typeof cadastroFornecedores>();
    for (const fornecedor of cadastroFornecedores) {
      const cnpj = digitos(fornecedor.nfeCnpj);
      if (cnpj.length === 14) porCnpj.set(cnpj, [...(porCnpj.get(cnpj) ?? []), fornecedor]);
      const nomes = [fornecedor.name, fornecedor.company, fornecedor.nfeRazaoSocial, fornecedor.nfeNomeFantasia];
      for (const nome of nomes) {
        if (!nome) continue;
        const chave = normalizarNomeFornecedorDocumento(nome);
        if (chave) porNome.set(chave, [...(porNome.get(chave) ?? []), fornecedor]);
      }
    }
    const localizarCadastro = (cnpjFornecedor: string | null, nomeFornecedor: string) => {
      const cnpj = digitos(cnpjFornecedor);
      if (cnpj.length === 14) {
        const exatos = porCnpj.get(cnpj) ?? [];
        if (exatos.length === 1) return exatos[0];
        if (exatos.length > 1) return null;
      }
      const nome = normalizarNomeFornecedorDocumento(nomeFornecedor);
      const candidatos = [...new Map((porNome.get(nome) ?? [])
        .filter(s => !cnpj || !s.nfeCnpj || digitos(s.nfeCnpj) === cnpj)
        .map(s => [s.id, s])).values()];
      return candidatos.length === 1 ? candidatos[0] : null;
    };
    const fornecedoresDasCotacoes = new Map<string, { fornecedor: string; cnpj: string | null; cadastro: typeof cadastroFornecedores[number] | null }>();
    for (const cotacao of cotacoesSalvas) {
      const chave = identidadeFornecedorCompra(cotacao.cnpjFornecedor, cotacao.fornecedor);
      if (!fornecedoresDasCotacoes.has(chave)) {
        fornecedoresDasCotacoes.set(chave, {
          fornecedor: cotacao.fornecedor,
          cnpj: cotacao.cnpjFornecedor,
          cadastro: localizarCadastro(cotacao.cnpjFornecedor, cotacao.fornecedor),
        });
      }
    }
    const idsFornecedoresIntegrados = new Set(
      [...fornecedoresDasCotacoes.values()].flatMap(f => f.cadastro ? [f.cadastro.id] : [])
    );

    const cotacaoIds = cotacoesSalvas.map(c => c.id);
    const itensDasCotacoes = cotacaoIds.length
      ? await db.select().from(itens).where(inArray(itens.cotacaoId, cotacaoIds)).orderBy(itens.id)
      : [];
    const itensPorCotacao = new Map<number, typeof itensDasCotacoes>();
    for (const linha of itensDasCotacoes) itensPorCotacao.set(linha.cotacaoId, [...(itensPorCotacao.get(linha.cotacaoId) ?? []), linha]);

    const rankingMaisRecentePorFornecedor = new Map<string, {
      cotacaoId: number;
      fornecedor: string;
      cnpj: string | null;
      cadastroFornecedorId: number | null;
      cadastroFornecedorNome: string | null;
      cadastroConcluido: boolean | null;
      dataCotacao: string;
      validadeDias: number | null;
      fretePorKg: number;
      percentualFretePrecoFinalMp: number | null;
      materiasPrimas: Array<{
        materiaPrimaId: number;
        nome: string;
        unidade: string;
        precoFinalUnitario: number;
        freteUnitario: number;
        percentualFretePrecoFinal: number;
      }>;
    }>();
    let cotacoesSemPesoParaFreteKg = 0;
    for (const cotacao of cotacoesSalvas) {
      const linhas = itensPorCotacao.get(cotacao.id) ?? [];
      const modo = (cotacao.freteModo ?? "valor_total") as "valor_total" | "por_kg" | "gratis" | "cif";
      const peso = cotacao.pesoFreteKg == null ? null : Number(cotacao.pesoFreteKg);
      let informado: number | null = modo === "gratis"
        ? 0
        : modo === "cif" && cotacao.freteValorInformado == null
          ? null
        : cotacao.freteValorInformado == null
          ? modo === "por_kg"
            ? peso != null && peso > 0 && cotacao.frete != null ? Number(cotacao.frete) / peso : null
            : cotacao.frete == null ? null : Number(cotacao.frete)
          : Number(cotacao.freteValorInformado);
      const freteCalculado = informado == null
        ? null
        : calcularFreteCompra(modo, informado, peso).total;
      let fretePorKg: number | null = null;
      if (modo === "gratis") fretePorKg = 0;
      else if (modo === "por_kg" && informado != null) fretePorKg = informado;
      else if (modo === "valor_total" && freteCalculado != null && peso != null && peso > 0) fretePorKg = freteCalculado / peso;
      if (fretePorKg == null && modo === "valor_total" && informado != null && !(peso != null && peso > 0)) cotacoesSemPesoParaFreteKg++;
      if (fretePorKg == null) continue;

      const simulacao = simularCustoFinalCotacao({
        itens: linhas.map(linha => ({
          quantidade: Number(linha.quantidade),
          unidade: linha.unidade,
          precoUnitario: Number(linha.precoUnitario),
        })),
        freteModo: modo,
        valorFreteInformado: informado,
        pesoTotalKg: peso,
      });
      const partesPorMp = new Map<number, {
        nome: string;
        unidade: string;
        quantidadeDestino: number;
        totalFinal: number;
        frete: number;
      }>();
      linhas.forEach((linha, indice) => {
        const materiaPrimaId = linha.materiaPrimaId;
        const destino = linha.unidadeDestino;
        const fatorInformado = linha.fatorConversao == null ? null : Number(linha.fatorConversao);
        const fator = fatorInformado ?? (destino && unidadeConsumo(linha.unidade) === unidadeConsumo(destino) ? 1 : null);
        const quantidade = Number(linha.quantidade);
        const custo = simulacao.itens[indice];
        if (!materiaPrimaId || !destino || !fator || !(fator > 0) || !(quantidade > 0) || !custo || !(custo.custoFinalTotal > 0)) return;
        const atual = partesPorMp.get(materiaPrimaId) ?? {
          nome: linha.nomeMateriaPrima ?? linha.descricao,
          unidade: destino,
          quantidadeDestino: 0,
          totalFinal: 0,
          frete: 0,
        };
        atual.quantidadeDestino += quantidade * fator;
        atual.totalFinal += custo.custoFinalTotal;
        atual.frete += custo.rateioFrete;
        partesPorMp.set(materiaPrimaId, atual);
      });
      const materiasPrimasDaCotacao = [...partesPorMp.entries()].map(([materiaPrimaId, mp]) => ({
        materiaPrimaId,
        nome: mp.nome,
        unidade: mp.unidade,
        precoFinalUnitario: mp.quantidadeDestino > 0 ? Number((mp.totalFinal / mp.quantidadeDestino).toFixed(6)) : 0,
        freteUnitario: mp.quantidadeDestino > 0 ? Number((mp.frete / mp.quantidadeDestino).toFixed(6)) : 0,
        percentualFretePrecoFinal: mp.totalFinal > 0 ? Number((mp.frete / mp.totalFinal * 100).toFixed(2)) : 0,
      }));
      const totalFinalMp = [...partesPorMp.values()].reduce((soma, mp) => soma + mp.totalFinal, 0);
      const totalFreteMp = [...partesPorMp.values()].reduce((soma, mp) => soma + mp.frete, 0);
      const chave = identidadeFornecedorCompra(cotacao.cnpjFornecedor, cotacao.fornecedor);
      if (rankingMaisRecentePorFornecedor.has(chave)) continue;
      const cadastro = localizarCadastro(cotacao.cnpjFornecedor, cotacao.fornecedor);
      rankingMaisRecentePorFornecedor.set(chave, {
        cotacaoId: cotacao.id,
        fornecedor: cotacao.fornecedor,
        cnpj: cotacao.cnpjFornecedor,
        cadastroFornecedorId: cadastro?.id ?? null,
        cadastroFornecedorNome: cadastro?.company || cadastro?.name || null,
        cadastroConcluido: cadastro?.cadastroConcluido ?? null,
        dataCotacao: cotacao.dataCotacao,
        validadeDias: cotacao.validadeDias,
        fretePorKg: Number(fretePorKg.toFixed(4)),
        percentualFretePrecoFinalMp: totalFinalMp > 0 ? Number((totalFreteMp / totalFinalMp * 100).toFixed(2)) : null,
        materiasPrimas: materiasPrimasDaCotacao,
      });
    }

    const ids = listaOrdens.map(linha => linha.ordem.id);
    const recebimentos = ids.length
      ? await db.select().from(comprasOrdemRecebimentos).where(inArray(comprasOrdemRecebimentos.ordemId, ids))
      : [];
    const nfVinculadas = ids.length ? await db
      .select({ ordemId: vinculos.ordemId, item: nfItens })
      .from(vinculos)
      .innerJoin(nfs, eq(nfs.id, vinculos.importacaoId))
      .innerJoin(nfItens, eq(nfItens.importacaoId, nfs.id))
      .where(and(inArray(vinculos.ordemId, ids), eq(nfs.status, "concluida"))) : [];
    const porOrdemRecebimento = new Map<number, typeof recebimentos>();
    for (const recebimento of recebimentos) porOrdemRecebimento.set(recebimento.ordemId, [...(porOrdemRecebimento.get(recebimento.ordemId) ?? []), recebimento]);
    const nfsPorOrdem = new Map<number, typeof nfVinculadas>();
    for (const linha of nfVinculadas) nfsPorOrdem.set(linha.ordemId, [...(nfsPorOrdem.get(linha.ordemId) ?? []), linha]);
    const agregados = new Map<string, {
      fornecedor: string; cnpj: string | null; quantidadeOrdens: number; valorComprado: number; descontos: number;
      quantidadeRecebida: number; ordensComRecebimento: number; recebimentosComRecusa: number;
      diasEntrega: number[]; ordensComPrazo: number; entregasNoPrazo: number; ordensComDivergenciaNf: number;
    }>();
    for (const { ordem, fornecedor, cnpj } of listaOrdens) {
      if (ordem.statusAprovacao === "pendente") continue;
      const chave = (cnpj ?? "").replace(/\D/g, "") || fornecedor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      const atual = agregados.get(chave) ?? {
        fornecedor, cnpj, quantidadeOrdens: 0, valorComprado: 0, descontos: 0,
        quantidadeRecebida: 0, ordensComRecebimento: 0, recebimentosComRecusa: 0, diasEntrega: [], ordensComPrazo: 0,
        entregasNoPrazo: 0, ordensComDivergenciaNf: 0,
      };
      atual.quantidadeOrdens++;
      atual.valorComprado += Number(ordem.total);
      atual.descontos += Number(ordem.descontoTotal ?? 0);
      const recebimentosOrdem = porOrdemRecebimento.get(ordem.id) ?? [];
      const recebido = new Map<number, number>();
      for (const recebimento of recebimentosOrdem) for (const linha of recebimento.itens) {
        atual.quantidadeRecebida += linha.quantidadeRecebida;
        recebido.set(linha.itemId, (recebido.get(linha.itemId) ?? 0) + quantidadeAceitaNoRecebimento(linha));
      }
      atual.recebimentosComRecusa += recebimentosOrdem.filter(recebimento => recebimento.itens.some(linha => linha.quantidadeRecusada > 0)).length;
      if (recebimentosOrdem.length) {
        atual.ordensComRecebimento++;
        const primeiro = recebimentosOrdem.map(r => r.dataRecebimento).sort()[0];
        const inicio = ordem.createdAt.toLocaleDateString("en-CA", { timeZone: "America/Campo_Grande" });
        const dias = Math.max(0, Math.floor((new Date(`${primeiro}T12:00:00Z`).getTime() - new Date(`${inicio}T12:00:00Z`).getTime()) / 86400000));
        atual.diasEntrega.push(dias);
      }
      const recebeuTudo = ordem.itens.length > 0 && ordem.itens.every(item => (recebido.get(item.itemId) ?? 0) + Math.max(0.001, item.quantidade * 0.01) >= item.quantidade);
      if (recebeuTudo && ordem.dataPrevistaEntrega) {
        const acumuladoPorData = new Map<number, number>();
        let dataConclusao: string | null = null;
        for (const recebimento of [...recebimentosOrdem].sort((a, b) => a.dataRecebimento.localeCompare(b.dataRecebimento) || a.id - b.id)) {
          for (const linha of recebimento.itens) {
            acumuladoPorData.set(linha.itemId, (acumuladoPorData.get(linha.itemId) ?? 0) + quantidadeAceitaNoRecebimento(linha));
          }
          const completoNaData = ordem.itens.every(item => (acumuladoPorData.get(item.itemId) ?? 0) + Math.max(0.001, item.quantidade * 0.01) >= item.quantidade);
          if (completoNaData) {
            dataConclusao = recebimento.dataRecebimento;
            break;
          }
        }
        if (dataConclusao) {
          atual.ordensComPrazo++;
          if (dataConclusao <= ordem.dataPrevistaEntrega) atual.entregasNoPrazo++;
        }
      }
      const notasDaOrdem = nfsPorOrdem.get(ordem.id) ?? [];
      if (recebeuTudo && notasDaOrdem.length) {
        const pedidoMp = new Map<string, number>();
        const nfMp = new Map<string, number>();
        for (const item of ordem.itens) if (item.materiaPrimaId && item.unidadeDestino) {
          const key = `${item.materiaPrimaId}|${unidadeConsumo(item.unidadeDestino)}`;
          pedidoMp.set(key, (pedidoMp.get(key) ?? 0) + item.quantidade * (item.fatorConversao ?? 1));
        }
        for (const { item } of notasDaOrdem) if (item.materiaPrimaId && item.unidadeErp) {
          const key = `${item.materiaPrimaId}|${unidadeConsumo(item.unidadeErp)}`;
          nfMp.set(key, (nfMp.get(key) ?? 0) + Number(item.quantidadeErp ?? 0));
        }
        const divergente = [...pedidoMp].some(([key, quantidade]) => {
          const faturado = nfMp.get(key);
          return faturado != null && Math.abs(faturado - quantidade) > Math.max(0.001, quantidade * 0.01);
        });
        if (divergente) atual.ordensComDivergenciaNf++;
      }
      agregados.set(chave, atual);
    }
    const fornecedores = [...agregados.values()].map(a => ({
      fornecedor: a.fornecedor,
      cnpj: a.cnpj,
      quantidadeOrdens: a.quantidadeOrdens,
      valorComprado: Number(a.valorComprado.toFixed(2)),
      descontos: Number(a.descontos.toFixed(2)),
      recebimentosComRecusa: a.recebimentosComRecusa,
      percentualEntregaNoPrazo: a.ordensComPrazo > 0 ? Number((a.entregasNoPrazo / a.ordensComPrazo * 100).toFixed(1)) : null,
      prazoMedioPrimeiroRecebimentoDias: a.diasEntrega.length ? Number((a.diasEntrega.reduce((s, d) => s + d, 0) / a.diasEntrega.length).toFixed(1)) : null,
      ordensComRecebimento: a.ordensComRecebimento,
      ordensComDivergenciaNf: a.ordensComDivergenciaNf,
      ordensComPrazo: a.ordensComPrazo,
    })).sort((a, b) => b.valorComprado - a.valorComprado);
    return {
      resumo: {
        materiasPrimasConciliadas: Number(mpConciliadas[0]?.total ?? 0),
        fornecedoresCadastrados: cadastroFornecedores.length,
        fornecedoresComCompraRegistrada: new Set(comprasCadastro.map(c => c.fornecedorId)).size,
        documentosDeCompraNoCadastro: comprasCadastro.length,
        fornecedoresNasCotacoes: fornecedoresDasCotacoes.size,
        fornecedoresVinculadosAoCadastro: idsFornecedoresIntegrados.size,
        fornecedoresSemCadastro: [...fornecedoresDasCotacoes.values()].filter(f => !f.cadastro).length,
        cadastrosPendentes: cadastroFornecedores.filter(f => !f.cadastroConcluido).length,
      },
      rankingFretePorKg: [...rankingMaisRecentePorFornecedor.values()].sort((a, b) => b.fretePorKg - a.fretePorKg || a.fornecedor.localeCompare(b.fornecedor, "pt-BR")),
      cotacoesSemPesoParaFreteKg,
      fornecedores,
    };
  }),
  auditarOrdem: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await banco();
      const [ordem] = await db
        .select()
        .from(ordens)
        .where(eq(ordens.id, input.id));
      if (!ordem || ordem.excluidaEm)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ordem não encontrada.",
        });
      const recebidos = await db
        .select({ item: nfItens, nf: nfs })
        .from(vinculos)
        .innerJoin(nfs, eq(nfs.id, vinculos.importacaoId))
        .innerJoin(nfItens, eq(nfItens.importacaoId, nfs.id))
        .where(eq(vinculos.ordemId, input.id));
      return {
        ordem,
        recebidos,
        recebimentosFisicos: await db
          .select()
          .from(comprasOrdemRecebimentos)
          .where(eq(comprasOrdemRecebimentos.ordemId, input.id))
          .orderBy(desc(comprasOrdemRecebimentos.dataRecebimento), desc(comprasOrdemRecebimentos.id)),
        nfs: [...new Map(recebidos.map(r => [r.nf.id, r.nf])).values()],
      };
    }),
});
