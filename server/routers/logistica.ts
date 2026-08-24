import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, like, sql, inArray } from "drizzle-orm";
import {
  listarCotacoesFrete,
  obterCotacaoDetalhes,
  adicionarOpcaoFrete,
  listarOpcoesFrete,
  listarOpcoesPorCotacoes,
  atualizarOpcaoFrete,
  removerOpcaoFrete,
  selecionarOpcaoFrete,
  normalizarOpcao,
} from '../db/db-helpers-select';
import { drizzle } from "drizzle-orm/neon-serverless";
import { getPool } from "../db/db-connection";
import { buscarDadosOSParaFrete, obterCotacoesFreteSimuladas } from "../integrations/mubisys-frete";
import { buscarOSPorNumero, buscarClientePorId } from "../integrations/mubisys-client";
import * as https from "https";
import {
  transportadoras,
  transportadoraCidades,
  transportadoraAvaliacoes,
  transportadoraFiliais,
  cotacoesFrete,
  cotacaoOpcoes,
  cotacaoComentarios,
  cteImportacoes,
  empacotamentoPedidos,
  Transportadora,
  TransportadoraCidade,
  CotacaoFrete,
  CotacaoOpcao,
  CotacaoComentario,
  CteImportacao,
} from "../../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
function getDb() {
  if (!_db) _db = drizzle(getPool());
  return _db;
}
const db = {
  select: () => getDb().select(),
  insert: (t: any) => getDb().insert(t),
  update: (t: any) => getDb().update(t),
  delete: (t: any) => getDb().delete(t),
};

// ─── TRANSPORTADORAS ──────────────────────────────────────────────────────────

export const transportadorasRouter = router({
  list: publicProcedure
    .input(z.object({ search: z.string().optional(), apenasAtivas: z.boolean().optional(), modal: z.string().optional() }))
    .query(async ({ input }) => {
      let rows = await db.select().from(transportadoras).orderBy(transportadoras.nome);
      if (input.apenasAtivas) rows = rows.filter(r => r.ativa === "sim");
      if (input.search) {
        const s = input.search.toLowerCase();
        rows = rows.filter(r =>
          r.nome.toLowerCase().includes(s) ||
          (r.nomeContato ?? "").toLowerCase().includes(s) ||
          (r.whatsappContato ?? "").toLowerCase().includes(s)
        );
      }
      if (input.modal) {
        rows = rows.filter(r => {
          if (!r.modais) return false;
          try { return (JSON.parse(r.modais) as string[]).includes(input.modal!); }
          catch { return false; }
        });
      }
      // Enriquecer com contagem de cidades
      const cidades = await db.select().from(transportadoraCidades);
      return rows.map(t => ({
        ...t,
        totalCidades: cidades.filter(c => c.transportadoraId === t.id).length,
      }));
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [t] = await db.select().from(transportadoras).where(eq(transportadoras.id, input.id));
      if (!t) throw new Error("Transportadora não encontrada");
      const cidades = await db.select().from(transportadoraCidades)
        .where(eq(transportadoraCidades.transportadoraId, input.id))
        .orderBy(transportadoraCidades.estado, transportadoraCidades.cidade);
      const avaliacoes = await db.select().from(transportadoraAvaliacoes)
        .where(eq(transportadoraAvaliacoes.transportadoraId, input.id))
        .orderBy(desc(transportadoraAvaliacoes.createdAt));
      const filiais = await db.select().from(transportadoraFiliais)
        .where(eq(transportadoraFiliais.transportadoraId, input.id))
        .orderBy(transportadoraFiliais.nome);
      return { ...t, cidades, avaliacoes, filiais, totalCidades: cidades.length };
    }),

  create: publicProcedure
    .input(z.object({
      nome: z.string().min(2),
      site: z.string().optional(),
      endereco: z.string().optional(),
      googleMapsUrl: z.string().optional(),
      referencia: z.string().optional(),
      nomeContato: z.string().optional(),
      telefoneContato: z.string().optional(),
      whatsappContato: z.string().optional(),
      nomeContatoNegocial: z.string().optional(),
      telefoneContatoNegocial: z.string().optional(),
      emailContatoNegocial: z.string().optional(),
      whatsappContatoNegocial: z.string().optional(),
      formaCotacao: z.enum(["site", "whatsapp", "telefone", "email"]).optional(),
      linkSiteCotacao: z.string().optional(),
      modais: z.string().optional(),
      pesoMaxKg: z.string().optional(),
      alturaMaxCm: z.string().optional(),
      larguraMaxCm: z.string().optional(),
      comprimentoMaxCm: z.string().optional(),
      somaMaxCm: z.string().optional(),
      horarioLimiteColeta: z.string().optional(),
      horarioLimiteMercadoria: z.string().optional(),
      distanciaSedMin: z.number().optional(),
      realizaColeta: z.enum(["sim", "nao"]).optional(),
      ultAtualizTabela: z.string().optional(),
      semTabelaNegociavel: z.enum(["sim", "nao"]).optional(),
      portalUrl: z.string().optional(),
      portalUsuario: z.string().optional(),
      portalEmail: z.string().optional(),
      portalObservacao: z.string().optional(),
      portalSenha: z.string().optional(),
      ultAtualizCidades: z.string().optional(),
      contatoRastreio: z.string().optional(),
      observacoes: z.string().optional(),
      coberturaTotal: z.number().int().min(0).max(1).optional(),
    }))
    .mutation(async ({ input }) => {
      const [result] = await db.insert(transportadoras).values(input as any).returning({ id: transportadoras.id });
      return { id: result.id };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().optional(),
      site: z.string().optional(),
      endereco: z.string().optional(),
      googleMapsUrl: z.string().optional(),
      referencia: z.string().optional(),
      nomeContato: z.string().optional(),
      telefoneContato: z.string().optional(),
      whatsappContato: z.string().optional(),
      nomeContatoNegocial: z.string().optional(),
      telefoneContatoNegocial: z.string().optional(),
      emailContatoNegocial: z.string().optional(),
      whatsappContatoNegocial: z.string().optional(),
      formaCotacao: z.enum(["site", "whatsapp", "telefone", "email"]).optional(),
      linkSiteCotacao: z.string().optional(),
      modais: z.string().optional(),
      pesoMaxKg: z.string().optional(),
      alturaMaxCm: z.string().optional(),
      larguraMaxCm: z.string().optional(),
      comprimentoMaxCm: z.string().optional(),
      somaMaxCm: z.string().optional(),
      horarioLimiteColeta: z.string().optional(),
      horarioLimiteMercadoria: z.string().optional(),
      distanciaSedMin: z.number().optional(),
      realizaColeta: z.enum(["sim", "nao"]).optional(),
      ultAtualizTabela: z.string().optional(),
      semTabelaNegociavel: z.enum(["sim", "nao"]).optional(),
      portalUrl: z.string().optional(),
      portalUsuario: z.string().optional(),
      portalEmail: z.string().optional(),
      portalObservacao: z.string().optional(),
      portalSenha: z.string().optional(),
      ultAtualizCidades: z.string().optional(),
      contatoRastreio: z.string().optional(),
      observacoes: z.string().optional(),
      ativa: z.enum(["sim", "nao"]).optional(),
      coberturaTotal: z.number().int().min(0).max(1).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.update(transportadoras).set(data as any).where(eq(transportadoras.id, id));
      return { ok: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(transportadoraCidades).where(eq(transportadoraCidades.transportadoraId, input.id));
      await db.delete(transportadoraAvaliacoes).where(eq(transportadoraAvaliacoes.transportadoraId, input.id));
      await db.delete(transportadoraFiliais).where(eq(transportadoraFiliais.transportadoraId, input.id));
      await db.delete(transportadoras).where(eq(transportadoras.id, input.id));
      return { ok: true };
    }),

  addAvaliacao: publicProcedure
    .input(z.object({
      transportadoraId: z.number(),
      estrelas: z.number().min(1).max(5),
      comentario: z.string().optional(),
      autor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.insert(transportadoraAvaliacoes).values(input);
      return { ok: true };
    }),

  deleteAvaliacao: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(transportadoraAvaliacoes).where(eq(transportadoraAvaliacoes.id, input.id));
      return { ok: true };
    }),

  addFilial: publicProcedure
    .input(z.object({
      transportadoraId: z.number(),
      nome: z.string().min(2),
      endereco: z.string().optional(),
      cidade: z.string().optional(),
      estado: z.string().max(2).optional(),
      telefone: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.insert(transportadoraFiliais).values(input);
      return { ok: true };
    }),

  deleteFilial: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(transportadoraFiliais).where(eq(transportadoraFiliais.id, input.id));
      return { ok: true };
    }),

  addCidade: publicProcedure
    .input(z.object({
      transportadoraId: z.number(),
      cidade: z.string(),
      estado: z.string().length(2),
    }))
    .mutation(async ({ input }) => {
      // Inserir cidade (constraint UNIQUE previne duplicatas)
      try {
        await db.insert(transportadoraCidades).values(input);
      } catch (e: any) {
        if (e.code === 'ER_DUP_ENTRY') throw new Error('Cidade já cadastrada para esta transportadora.');
        throw e;
      }
      // Atualizar data de última atualização de cidades automaticamente
      const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      await db.update(transportadoras).set({ ultAtualizCidades: hoje } as any).where(eq(transportadoras.id, input.transportadoraId));
      return { ok: true };
    }),

  buscarMunicipios: publicProcedure
    .input(z.object({ q: z.string().min(2) }))
    .query(async ({ input }) => {
      const termo = input.q.trim();
      // Buscar municípios únicos que correspondem ao termo em qualquer transportadora
      const rows = await getDb()
        .selectDistinct({ cidade: transportadoraCidades.cidade, estado: transportadoraCidades.estado })
        .from(transportadoraCidades)
        .where(like(transportadoraCidades.cidade, `${termo}%`))
        .orderBy(transportadoraCidades.cidade)
        .limit(10);
      return rows;
    }),

  removeCidade: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(transportadoraCidades).where(eq(transportadoraCidades.id, input.id));
      return { ok: true };
    }),

  consultarCobertura: publicProcedure
    .input(z.object({ cidade: z.string(), estado: z.string() }))
    .query(async ({ input }) => {
      const cidades = await db.select().from(transportadoraCidades)
        .where(and(
          like(transportadoraCidades.cidade, `%${input.cidade}%`),
          eq(transportadoraCidades.estado, input.estado.toUpperCase())
        ));
      const idsSet = new Set(cidades.map((c: TransportadoraCidade) => c.transportadoraId));
      const ids = Array.from(idsSet);
      const todas = await db.select().from(transportadoras).where(eq(transportadoras.ativa, "sim"));
      // Transportadoras com coberturaTotal=1 (ex: Braspress, Correios) atendem qualquer cidade
      const atende = todas.filter(t => ids.includes(t.id) || (t.coberturaTotal === 1));
      const naoAtende = todas.filter(t => !ids.includes(t.id) && !(t.coberturaTotal === 1));
      return { atende, naoAtende };
    }),

  // ─── Subaba de completude de dados ──────────────────────────────────────
  /** Contagens gerais: total, ativas, inativas, origem e alcance nacional. */
  panoramaCadastro: publicProcedure.query(async () => {
    const { panoramaCadastro } = await import('../utils/transportadoras-completude');
    return panoramaCadastro();
  }),

  /** Resumo agrupado por campo ausente + progresso geral do cadastro. */
  resumoCompletude: publicProcedure
    .input(z.object({
      status: z.enum(['ativas', 'inativas', 'todas']).optional().default('todas'),
      origem: z.enum(['Frenet', 'Manual', 'todas']).optional().default('todas'),
    }).optional())
    .query(async ({ input }) => {
      const { resumoCompletude } = await import('../utils/transportadoras-completude');
      return resumoCompletude({ status: input?.status, origem: input?.origem });
    }),

  /** Lista transportadoras por estado de um campo (vazios/preenchidos/todos). */
  pendentesPorCampo: publicProcedure
    .input(z.object({
      campo: z.string().optional(),
      busca: z.string().optional(),
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(20),
      status: z.enum(['ativas', 'inativas', 'todas']).optional().default('todas'),
      origem: z.enum(['Frenet', 'Manual', 'todas']).optional().default('todas'),
      modo: z.enum(['vazios', 'preenchidos', 'todos']).optional().default('vazios'),
    }))
    .query(async ({ input }) => {
      const { listarPendentesPorCampo } = await import('../utils/transportadoras-completude');
      return listarPendentesPorCampo(input.campo, input.busca, input.page, input.pageSize, {
        status: input.status,
        origem: input.origem,
        modo: input.modo,
      });
    }),

  /** Salva um único campo direto da subaba de completude. */
  atualizarCampo: publicProcedure
    .input(z.object({
      id: z.number(),
      campo: z.string(),
      valor: z.string().nullable(),
    }))
    .mutation(async ({ input }) => {
      const { atualizarCampoTransportadora } = await import('../utils/transportadoras-completude');
      try {
        return await atualizarCampoTransportadora(input.id, input.campo, input.valor);
      } catch (erro: any) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: erro?.message ?? 'Falha ao salvar campo' });
      }
    }),

  /** Liga/desliga o status ativo direto na listagem da subaba. */
  definirStatus: publicProcedure
    .input(z.object({ id: z.number(), ativa: z.boolean() }))
    .mutation(async ({ input }) => {
      const { definirStatusTransportadora } = await import('../utils/transportadoras-completude');
      return definirStatusTransportadora(input.id, input.ativa);
    }),

  /** Aplica o mesmo valor de um campo a várias transportadoras de uma vez. */
  atualizarCampoEmLote: publicProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1),
      campo: z.string(),
      valor: z.string().nullable(),
    }))
    .mutation(async ({ input }) => {
      const { atualizarCampoEmLote } = await import('../utils/transportadoras-completude');
      try {
        return await atualizarCampoEmLote(input.ids, input.campo, input.valor);
      } catch (erro: any) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: erro?.message ?? 'Falha ao salvar em lote' });
      }
    }),
});

// ─── COTAÇÕES DE FRETE ────────────────────────────────────────────────────────

/** Formata CNPJ/CPF cru ou já pontuado. Devolve "" se não for nem um nem outro. */
function formatarDocumento(valor: string | null | undefined): string {
  const nums = String(valor ?? "").replace(/\D/g, "");
  if (nums.length === 14) return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (nums.length === 11) return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return String(valor ?? "").trim();
}

// Busca dados do cliente no Mubisys pelo número da OS
async function fetchDadosOsMub(numeroOs: string): Promise<{ nomeCliente: string; cnpj: string; cep: string; endereco: string; cidade: string; estado: string; valorNf: string; vendedor: string; dataEntregaPrevista: string; dataAprovacao: string } | null> {
  const os = await buscarOSPorNumero(numeroOs);
  if (!os) return null;

  const end = os.cliente_endereco?.[0];

  // O CNPJ vem na própria OS. A chamada extra a /cliente só existe para o caso
  // (raro) de a OS vir sem ele — e usa cliente_id, NUNCA o id do endereço.
  let cnpj = formatarDocumento(os.cliente_cnpj_cpf);
  let nomeCliente = String(os.cliente ?? "").trim();

  if (!cnpj && os.cliente_id) {
    const cli = await buscarClientePorId(os.cliente_id);
    if (cli) {
      cnpj = formatarDocumento(cli.cnpj_cpf);
      if (!nomeCliente) nomeCliente = cli.razao_social ?? "";
    }
  }

  return {
    nomeCliente,
    cnpj,
    cep: (end?.cep ?? "").replace(/\D/g, ""),
    endereco: [end?.logradouro, end?.numero, (end as any)?.complemento, end?.bairro].filter(Boolean).join(", "),
    cidade: end?.cidade ?? "",
    estado: end?.estado ?? "",
    valorNf: os.valor_total ? String(Number(os.valor_total).toFixed(2)) : "",
    vendedor: os.vendedor ?? "",
    // `prazo` é texto livre ("02 dias úteis") — não serve como data. Só
    // data_entrega entra aqui.
    dataEntregaPrevista: os.data_entrega ?? "",
    dataAprovacao: os.data_aprovacao ?? "",
  };
}

export const cotacoesFreteRouter = router({
  /**
   * Gera o romaneio de despacho em PDF real (jsPDF), para o motorista.
   * Regra do usuário: traz todas as informações da solicitação, EXCETO as fotografias.
   */
  romaneioPdf: publicProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      const { jsPDF } = await import("jspdf");

      const cotacoes = await db.select().from(cotacoesFrete).where(inArray(cotacoesFrete.id, input.ids));

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margem = 40;
      const limiteY = 800;
      let y = 48;

      const escreve = (texto: string, negrito = false, tamanho = 9) => {
        if (y > limiteY) {
          doc.addPage();
          y = 48;
        }
        doc.setFont("helvetica", negrito ? "bold" : "normal");
        doc.setFontSize(tamanho);
        doc.text(texto, margem, y);
        y += tamanho + 4;
      };

      const moeda = (v: any) => {
        const n = Number(v ?? 0);
        return n ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
      };

      escreve("Romaneio de Despacho — Letreiros Express", true, 14);
      escreve(`Pedidos prontos aguardando envio: ${cotacoes.length}`);
      escreve(`Emitido em ${new Date().toLocaleString("pt-BR")}`);
      y += 8;

      for (const c of cotacoes) {
        const ops = await getDb()
          .select({
            transportadoraNome: cotacaoOpcoes.transportadoraNome,
            valorFrete: cotacaoOpcoes.valorFrete,
            prazoDias: cotacaoOpcoes.prazoDias,
            tipoPrazo: cotacaoOpcoes.tipoPrazo,
            selecionada: cotacaoOpcoes.selecionada,
          })
          .from(cotacaoOpcoes)
          .where(eq(cotacaoOpcoes.cotacaoId, c.id));
        const escolhida =
          ops.find((o) => o.selecionada === "sim") ??
          ops.filter((o) => Number(o.valorFrete) > 0).sort((a, b) => Number(a.valorFrete) - Number(b.valorFrete))[0] ??
          null;

        let volumes: any[] = [];
        try {
          volumes = c.volumesJson ? JSON.parse(c.volumesJson) : [];
        } catch {
          volumes = [];
        }
        if (volumes.length === 0 && (c.dimensoesLargura || c.dimensoesAltura)) {
          volumes = [{
            largura: c.dimensoesLargura,
            comprimento: c.dimensoesComprimento,
            altura: c.dimensoesAltura,
            peso: c.pesoKg,
          }];
        }
        const pesoTotal = volumes.reduce((s, v) => s + (Number(v.peso) || 0), 0) || Number(c.pesoKg ?? 0);

        y += 6;
        escreve(`OS ${c.osNumero ?? `#${c.id}`}  ·  ${(c.modalidadeFrete ?? "cif").toUpperCase()}`, true, 11);
        escreve(`Destinatário: ${c.destinatarioNome ?? "—"}   |   CNPJ: ${c.destinatarioCnpj ?? "—"}`);
        escreve(`CEP: ${c.cepDestino ?? "—"}   |   Cidade/UF: ${c.municipio ?? "—"}/${c.estado ?? "—"}`);
        escreve(`Aprovação da OS: ${c.osAprovacao ?? "—"}   |   Entrega prevista: ${c.osEntrega ?? "—"}`);
        escreve(`Vendedor: ${c.osVendedor ?? "—"}   |   Solicitante: ${c.solicitanteNome ?? "—"}`);
        escreve(`Empacotadores: ${c.empacotadores ?? "—"}`);
        escreve(`Volumes: ${volumes.length || Number(c.quantidadeVolumes ?? 0)}   |   Peso total: ${pesoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} kg`);
        volumes.forEach((v, i) => {
          escreve(`   Vol ${i + 1}: ${Number(v.largura ?? 0)}×${Number(v.comprimento ?? 0)}×${Number(v.altura ?? 0)} cm · ${(Number(v.peso ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} kg`);
        });
        const prazo = escolhida?.prazoDias != null
          ? `${escolhida.prazoDias} dias ${escolhida.tipoPrazo === "corridos" ? "corridos" : "úteis"}`
          : "—";
        escreve(`Transportadora: ${escolhida?.transportadoraNome ?? "—"}   |   Frete: ${moeda(escolhida?.valorFrete)}   |   Prazo: ${prazo}`);
        if (c.observacoes) escreve(`Observações: ${c.observacoes}`);
        escreve("Recebido por: ______________________________   Data: ____/____/______");
        y += 4;
      }

      const pdfBase64 = doc.output("datauristring").split(",")[1];
      return {
        pdfBase64,
        fileName: `romaneio-${new Date().toISOString().slice(0, 10)}.pdf`,
        totalPedidos: cotacoes.length,
      };
    }),

  list: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      solicitanteId: z.string().optional(),
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(15),
    }))
    .query(async ({ input }) => {
      // ⚠️ NÃO aplicar filtro padrão de status: o Kanban precisa de TODOS os status
      // (aberta/cotando/selecao/cotada/enviada) para distribuir os cards nas colunas.
      // Só filtra quando o cliente pedir explicitamente um status.
      const result = await listarCotacoesFrete(input.page, input.pageSize || 15, input.status);

      return {
        data: result.data,
        pagination: {
          page: result.pagination.page,
          pageSize: result.pagination.pageSize,
          totalRegistros: result.pagination.total,
          totalPages: result.pagination.totalPages,
          hasNextPage: input.page < result.pagination.totalPages,
          hasPrevPage: input.page > 1,
        },
      };
    }),

  // ✅ NOVO: Buscar detalhes completos (sob demanda, após clicar)
  getDetalhes: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      console.log("🔍 [DETALHES] Buscando cotação completa ID:", input.id);
      const c = await obterCotacaoDetalhes(input.id);
      const opcoes = await listarOpcoesFrete(input.id);
      const comentarios = await db.select().from(cotacaoComentarios)
        .where(eq(cotacaoComentarios.cotacaoId, input.id))
        .orderBy(desc(cotacaoComentarios.createdAt));
      console.log("✅ [DETALHES] Retornando cotação completa com", opcoes.length, "opções");
      return { ...c, opcoes, comentarios };
    }),
  
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const c = await obterCotacaoDetalhes(input.id);
      const opcoes = await listarOpcoesFrete(input.id);
      const comentarios = await db.select().from(cotacaoComentarios)
        .where(eq(cotacaoComentarios.cotacaoId, input.id))
        .orderBy(cotacaoComentarios.createdAt);
      return { ...c, opcoes, comentarios };
    }),

  create: publicProcedure
    .input(z.object({
      solicitanteId: z.string().optional(),
      solicitanteNome: z.string().optional(),
      destinatarioNome: z.string(),
      destinatarioCnpj: z.string().optional(),
      cepDestino: z.string().optional(),
      municipio: z.string(),
      estado: z.string().length(2),
      dimensoesLargura: z.string().optional(),
      dimensoesAltura: z.string().optional(),
      dimensoesComprimento: z.string().optional(),
      pesoKg: z.string().optional(),
      valorNf: z.string().optional(),
      observacoes: z.string().optional(),
      observacaoGol: z.string().optional(),
      fotoUrl: z.string().optional(),
      empacotamentoPedidoId: z.number().optional(),
      empacotamentoPedidoNumero: z.string().optional(),
      tipoMaterial: z.string().optional(),
      dataEntregaPrevista: z.string().optional(),
      dimensoes: z.string().optional(),   // legado — mantido para compatibilidade
      osNumero: z.string().optional(),
      volumesJson: z.string().optional(),
      quantidadeVolumes: z.number().optional(),
      pedidoCnpj: z.string().optional(),
      pedidoEndereco: z.string().optional(),
      pedidoCep: z.string().optional(),
      empacotadores: z.string().optional(),
      // Dados próprios da OS consultada (cache/API MubiSys)
      osAprovacao: z.string().optional(),
      osEntrega: z.string().optional(),
      osVendedor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // ✅ Mapear APENAS os campos que o banco aceita (evitar undefined)
      // ✅ SOLUÇÃO BACKEND: Parse de dimensões, tipagem correta, remover campos inválidos
      
      // Extrair dimensões do JSON se enviado como string
      let dimensoesLargura: number | null = null;
      let dimensoesAltura: number | null = null;
      let dimensoesComprimento: number | null = null;
      let pesoKg: number | null = null;
      
      if (input.dimensoes) {
        try {
          const volumes = JSON.parse(input.dimensoes);
          if (Array.isArray(volumes) && volumes.length > 0) {
            const v = volumes[0];
            dimensoesLargura = Number(v.largura) || null;
            dimensoesAltura = Number(v.altura) || null;
            dimensoesComprimento = Number(v.comprimento) || null;
            pesoKg = volumes.reduce((acc: number, vol: any) => acc + (Number(vol.peso) || 0), 0) || null;
          }
        } catch (e) {
          console.error('❌ Erro ao parsear dimensões:', e);
        }
      }
      
      if (!pesoKg && input.pesoKg) {
        pesoKg = parseFloat(input.pesoKg);
      }
      
      // ✅ CORREÇÃO OBRIGATÓRIA: Inserir APENAS colunas com valores reais
      // Deixar o banco aplicar defaults automaticamente para outros campos
      const insertData: Partial<Record<keyof typeof cotacoesFrete.$inferInsert, any>> = {};
      
      // Campos obrigatórios
      insertData.destinatarioNome = input.destinatarioNome;
      insertData.municipio = input.municipio;
      insertData.estado = input.estado;
      // status tem default "fila" no schema, não precisa enviar
      // temRetrabalho tem default false no schema, não precisa enviar
      
      // Campos opcionais - adicionar APENAS se tiverem valor
      if (input.solicitanteId) insertData.solicitanteId = input.solicitanteId;
      if (input.solicitanteNome) insertData.solicitanteNome = input.solicitanteNome;
      if (input.destinatarioCnpj) insertData.destinatarioCnpj = input.destinatarioCnpj;
      if (input.cepDestino) insertData.cepDestino = input.cepDestino;
      if (dimensoesLargura !== null) insertData.dimensoesLargura = dimensoesLargura.toString();
      if (dimensoesAltura !== null) insertData.dimensoesAltura = dimensoesAltura.toString();
      if (dimensoesComprimento !== null) insertData.dimensoesComprimento = dimensoesComprimento.toString();
      if (pesoKg !== null && pesoKg > 0) insertData.pesoKg = pesoKg.toString();
      if (input.valorNf) insertData.valorNf = input.valorNf;
      if (input.observacoes) insertData.observacoes = input.observacoes;
      if (input.observacaoGol) insertData.observacaoGol = input.observacaoGol;
      if (input.fotoUrl) insertData.fotoUrl = input.fotoUrl;
      if (input.empacotamentoPedidoId) insertData.empacotamentoPedidoId = input.empacotamentoPedidoId;
      if (input.empacotamentoPedidoNumero) insertData.empacotamentoPedidoNumero = input.empacotamentoPedidoNumero;
      if (input.tipoMaterial) insertData.tipoMaterial = input.tipoMaterial;
      if (input.dataEntregaPrevista) insertData.dataEntregaPrevista = input.dataEntregaPrevista;
      if (input.osNumero) insertData.osNumero = input.osNumero;
      if (input.volumesJson || input.dimensoes) insertData.volumesJson = input.volumesJson || input.dimensoes;
      if (input.quantidadeVolumes) insertData.quantidadeVolumes = input.quantidadeVolumes;
      if (input.empacotadores) insertData.empacotadores = input.empacotadores;
      if (input.osAprovacao) insertData.osAprovacao = input.osAprovacao;
      if (input.osEntrega || input.dataEntregaPrevista) insertData.osEntrega = input.osEntrega || input.dataEntregaPrevista;
      if (input.osVendedor) insertData.osVendedor = input.osVendedor;

      try {
        const [resultado] = await db.insert(cotacoesFrete).values(insertData as typeof cotacoesFrete.$inferInsert).returning({ id: cotacoesFrete.id });

        console.log("✅ [CREATE] Cotação criada com sucesso! ID:", resultado.id);
        return { success: true, id: resultado.id };
      } catch (error: any) {
        console.error("❌ [CREATE] ERRO:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Erro ao criar cotação: ${error.message}`
        });
      }
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      destinatarioNome: z.string().optional(),
      destinatarioCnpj: z.string().optional(),
      municipio: z.string().optional(),
      estado: z.string().optional(),
      cepDestino: z.string().optional(),
      pesoKg: z.string().optional(),
      valorNf: z.string().optional(),
      observacoes: z.string().optional(),
      observacaoGol: z.string().optional(),
      solicitanteNome: z.string().optional(),
      horarioDecisaoMs: z.string().optional(),
      dataEntregaPrevista: z.string().optional(),
      modalidadeFrete: z.enum(["cif", "fob"]).nullable().optional(),
      fotosJson: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;
      const sets: Partial<typeof cotacoesFrete.$inferInsert> = {};
      if (fields.destinatarioNome !== undefined) sets.destinatarioNome = fields.destinatarioNome;
      if (fields.destinatarioCnpj !== undefined) sets.destinatarioCnpj = fields.destinatarioCnpj;
      if (fields.municipio !== undefined) sets.municipio = fields.municipio;
      if (fields.estado !== undefined) sets.estado = fields.estado;
      if (fields.cepDestino !== undefined) sets.cepDestino = fields.cepDestino;
      if (fields.pesoKg !== undefined) sets.pesoKg = fields.pesoKg;
      if (fields.valorNf !== undefined) sets.valorNf = fields.valorNf;
      if (fields.observacoes !== undefined) sets.observacoes = fields.observacoes;
      if (fields.observacaoGol !== undefined) sets.observacaoGol = fields.observacaoGol;
      if (fields.solicitanteNome !== undefined) sets.solicitanteNome = fields.solicitanteNome;
      if (fields.horarioDecisaoMs !== undefined) sets.horarioDecisaoMs = fields.horarioDecisaoMs;
      if (fields.dataEntregaPrevista !== undefined) sets.dataEntregaPrevista = fields.dataEntregaPrevista as any;
      if (fields.modalidadeFrete !== undefined) sets.modalidadeFrete = fields.modalidadeFrete;
      if (fields.fotosJson !== undefined) sets.fotosJson = fields.fotosJson;
      if (Object.keys(sets).length === 0) return { ok: true };
      sets.updatedAt = new Date();
      await db.update(cotacoesFrete).set(sets).where(eq(cotacoesFrete.id, id));
      return { ok: true };
    }),

  listMinhas: publicProcedure
    .input(z.object({ solicitanteId: z.string().optional(), solicitanteNome: z.string().optional() }))
    .query(async ({ input }) => {
      let rows = await db.select().from(cotacoesFrete).orderBy(desc(cotacoesFrete.createdAt));
      if (input.solicitanteId) {
        rows = rows.filter(r => r.solicitanteId === input.solicitanteId);
      } else if (input.solicitanteNome) {
        const nome = input.solicitanteNome.toLowerCase().trim();
        rows = rows.filter(r => (r.solicitanteNome ?? "").toLowerCase().trim() === nome);
      }
      const ids = rows.map(r => r.id);
      const opcoes = await listarOpcoesPorCotacoes(ids);
      return rows.map(c => ({
        ...c,
        opcoes: opcoes.filter((o: any) => o.cotacaoId === c.id).map(normalizarOpcao),
      }));
    }),

  updateStatus: publicProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["aberta", "cotando", "selecao", "cotada", "enviada", "cancelada"]),
    }))
    .mutation(async ({ input }) => {
      const result = await db
        .update(cotacoesFrete)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(cotacoesFrete.id, input.id))
        .returning({ id: cotacoesFrete.id });
      console.log(`✅ [UPDATE-STATUS] Cotação #${input.id} → ${input.status} (${result.length} linha(s))`);
      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Cotação #${input.id} não encontrada` });
      }
      return { ok: true, id: input.id, status: input.status };
    }),

  /**
   * Anexa fotografias à cotação. As imagens já sobem direto para o
   * UploadThing pelo client; aqui só gravamos as URLs em `fotosJson`.
   */
  uploadFotos: publicProcedure
    .input(z.object({
      id: z.number(),
      fotos: z.array(z.object({
        nome: z.string(),
        url: z.string().url(),
        key: z.string().min(1),
        tipo: z.string().optional(),
      })).min(1).max(10),
    }))
    .mutation(async ({ input }) => {
      const [atual] = await getDb().select({ fotosJson: cotacoesFrete.fotosJson }).from(cotacoesFrete).where(eq(cotacoesFrete.id, input.id));
      if (!atual) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Cotação #${input.id} não encontrada` });
      }
      let urls: string[] = [];
      try { urls = atual.fotosJson ? JSON.parse(atual.fotosJson) : []; } catch { urls = []; }

      for (const foto of input.fotos) {
        urls.push(foto.url);
      }

      await db.update(cotacoesFrete).set({ fotosJson: JSON.stringify(urls), updatedAt: new Date() }).where(eq(cotacoesFrete.id, input.id));
      console.log(`✅ [FOTOS] Cotação #${input.id} agora tem ${urls.length} foto(s)`);
      return { ok: true, fotos: urls };
    }),

  /** Remove uma fotografia da cotação pelo índice. */
  removerFoto: publicProcedure
    .input(z.object({ id: z.number(), indice: z.number().min(0) }))
    .mutation(async ({ input }) => {
      const [row] = await getDb().select({ fotosJson: cotacoesFrete.fotosJson }).from(cotacoesFrete).where(eq(cotacoesFrete.id, input.id));
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Cotação #${input.id} não encontrada` });
      }
      let urls: string[] = [];
      try { urls = row.fotosJson ? JSON.parse(row.fotosJson) : []; } catch { urls = []; }
      urls.splice(input.indice, 1);
      await db.update(cotacoesFrete).set({ fotosJson: JSON.stringify(urls), updatedAt: new Date() }).where(eq(cotacoesFrete.id, input.id));
      return { ok: true, fotos: urls };
    }),

  addOpcao: publicProcedure
    .input(z.object({
      cotacaoId: z.number(),
      transportadoraId: z.number().optional(),
      transportadoraNome: z.string(),
      valorFrete: z.string(),
      prazoDias: z.number().optional(),
      tipoPrazo: z.enum(["uteis", "corridos"]).optional().default("uteis"),
      modal: z.string().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const res = await adicionarOpcaoFrete({
        cotacaoId: input.cotacaoId,
        transportadoraId: input.transportadoraId ?? null,
        transportadoraNome: input.transportadoraNome,
        valorFrete: input.valorFrete,
        prazoDias: input.prazoDias ?? null,
        tipoPrazo: input.tipoPrazo,
        observacoes: input.observacoes ?? null,
      });
      return { ok: true, id: res.id, duplicada: res.duplicada };
    }),

  listOpcoes: publicProcedure
    .input(z.object({ cotacaoId: z.number() }))
    .query(async ({ input }) => {
      return await listarOpcoesFrete(input.cotacaoId);
    }),

  updateOpcao: publicProcedure
    .input(z.object({
      opcaoId: z.number(),
      valorFrete: z.string().optional(),
      prazoDias: z.number().optional(),
      tipoPrazo: z.enum(["uteis", "corridos"]).optional().default("uteis"),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await atualizarOpcaoFrete(input.opcaoId, {
        valorFrete: input.valorFrete,
        prazoDias: input.prazoDias,
        tipoPrazo: input.tipoPrazo,
        observacoes: input.observacoes,
      });
      return { ok: true };
    }),

  removeOpcao: publicProcedure
    .input(z.object({ opcaoId: z.number() }))
    .mutation(async ({ input }) => {
      await removerOpcaoFrete(input.opcaoId);
      return { ok: true };
    }),

  selecionarOpcao: publicProcedure
    .input(z.object({ cotacaoId: z.number(), opcaoId: z.number() }))
    .mutation(async ({ input }) => {
      return await selecionarOpcaoFrete(input.cotacaoId, input.opcaoId);
    }),

  addComentario: publicProcedure
    .input(z.object({
      cotacaoId: z.number(),
      autorNome: z.string().default("Equipe"),
      texto: z.string(),
    }))
    .mutation(async ({ input }) => {
      await db.insert(cotacaoComentarios).values(input as any);
      return { ok: true };
    }),

  deleteComentario: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(cotacaoComentarios).where(eq(cotacaoComentarios.id, input.id));
      return { ok: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { excluirCotacaoFrete } = await import('../db/db-helpers-select');
      await excluirCotacaoFrete(input.id);
      return { ok: true };
    }),

  deleteByEmpacotamentoPedidoId: publicProcedure
    .input(z.object({ empacotamentoPedidoId: z.number() }))
    .mutation(async ({ input }) => {
      const rows = await db.select().from(cotacoesFrete).where(eq(cotacoesFrete.empacotamentoPedidoId, input.empacotamentoPedidoId));
      for (const row of rows) {
        await db.delete(cotacaoOpcoes).where(eq(cotacaoOpcoes.cotacaoId, row.id));
        await db.delete(cotacaoComentarios).where(eq(cotacaoComentarios.cotacaoId, row.id));
      }
      await db.delete(cotacoesFrete).where(eq(cotacoesFrete.empacotamentoPedidoId, input.empacotamentoPedidoId));
      return { ok: true, deletados: rows.length };
    }),
  dashboard: publicProcedure.query(async () => {
    const todas = await db.select().from(cotacoesFrete).orderBy(desc(cotacoesFrete.createdAt));
    const total = todas.length;
    const concluidas = todas.filter(c => c.status === "enviada").length;
    const emAndamento = todas.filter(c => ["cotando", "selecao", "cotada"].includes(c.status)).length;
    const fila = todas.filter(c => c.status === "aberta").length;
    // Últimos 30 dias
    const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentes = todas.filter(c => new Date(c.createdAt) >= limite);
    // Agrupamento mensal (últimos 6 meses)
    const porMes: Record<string, number> = {};
    todas.forEach(c => {
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      porMes[key] = (porMes[key] ?? 0) + 1;
    });
     return { total, concluidas, emAndamento, fila, recentes: recentes.length, porMes };
  }),

  // Busca dados do cliente pelo número da OS: tenta Mubisys primeiro, depois BrasilAPI pelo CNPJ
  buscarDadosOs: publicProcedure
    .input(z.object({
      numeroOs: z.string().optional(),
      cnpj: z.string().optional(),
    }))
    .query(async ({ input }) => {
      // 1. Cache local primeiro (rápido), depois API MubiSys
      if (input.numeroOs) {
        const doCache = await buscarDadosOSParaFrete(input.numeroOs);
        if (doCache && (doCache.municipio || doCache.cep)) {
          return {
            fonte: "cache" as const,
            nomeCliente: doCache.clienteNome,
            cnpj: doCache.clienteCnpj,
            cep: doCache.cep,
            endereco: doCache.endereco,
            cidade: doCache.municipio,
            estado: doCache.estado,
            valorNf: doCache.valor_nf ? String(doCache.valor_nf) : "",
            vendedor: doCache.vendedor ?? "",
            dataEntregaPrevista: doCache.entrega ?? "",
            dataAprovacao: doCache.aprovacao ?? "",
          };
        }
        const mub = await fetchDadosOsMub(input.numeroOs);
        if (mub && (mub.cidade || mub.cep)) {
          return { fonte: "mub" as const, ...mub };
        }
      }
      // 2. Fallback: BrasilAPI pelo CNPJ
      const cnpjLimpo = (input.cnpj ?? "").replace(/\D/g, "");
      if (cnpjLimpo.length === 14) {
        try {
          const resp = await new Promise<string>((resolve, reject) => {
            const req = https.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, { headers: { "Accept": "application/json" } }, (res) => {
              let body = "";
              res.on("data", (c: Buffer) => body += c);
              res.on("end", () => resolve(body));
            });
            req.on("error", reject);
            req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
          });
          const d = JSON.parse(resp);
          if (d && d.municipio) {
            const cepFmt = (d.cep ?? "").replace(/\D/g, "");
            return {
              fonte: "brasilapi" as const,
              nomeCliente: d.razao_social ?? "",
              cnpj: cnpjLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"),
              cep: cepFmt,
              endereco: [d.logradouro, d.numero, d.complemento, d.bairro].filter(Boolean).join(", "),
              cidade: d.municipio ?? "",
              estado: d.uf ?? "",
              valorNf: "",
              vendedor: "",
              dataEntregaPrevista: "",
              dataAprovacao: "",
            };
          }
        } catch { /* ignora */ }
      }
      return null;
    }),
  assertividade: publicProcedure
    .input(z.object({
      de: z.string().optional(),
      ate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      // Buscar todas as cotações concluídas com dataDespacho preenchido
      const rows = await db.select().from(cotacoesFrete)
        .where(eq(cotacoesFrete.status, "enviada"))
        .orderBy(desc(cotacoesFrete.dataDespacho));
      // Filtrar apenas as que têm dataDespacho e dataEntregaPrevista
      const comDatas = rows.filter(r => r.dataDespacho && r.dataEntregaPrevista);
      // Aplicar filtro de período se fornecido
      let filtrados = comDatas;
      if (input.de) {
        const de = new Date(input.de);
        filtrados = filtrados.filter(r => new Date(r.dataDespacho as unknown as string) >= de);
      }
      if (input.ate) {
        const ate = new Date(input.ate);
        ate.setHours(23, 59, 59, 999);
        filtrados = filtrados.filter(r => new Date(r.dataDespacho as unknown as string) <= ate);
      }
      // Calcular métricas
      const total = filtrados.length;
      const noPrazo = filtrados.filter(r => {
        const despacho = new Date(r.dataDespacho as unknown as string);
        const previsto = new Date(r.dataEntregaPrevista as unknown as string);
        return despacho <= previsto;
      });
      const antecipados = filtrados.filter(r => {
        const despacho = new Date(r.dataDespacho as unknown as string);
        const previsto = new Date(r.dataEntregaPrevista as unknown as string);
        // Antecipado = despachado mais de 1 dia antes do prazo
        const diffDias = (previsto.getTime() - despacho.getTime()) / (1000 * 60 * 60 * 24);
        return diffDias > 1;
      });
      const atrasados = filtrados.filter(r => {
        const despacho = new Date(r.dataDespacho as unknown as string);
        const previsto = new Date(r.dataEntregaPrevista as unknown as string);
        return despacho > previsto;
      });
      const pedidos = filtrados.map(r => {
        const despacho = new Date(r.dataDespacho as unknown as string);
        const previsto = new Date(r.dataEntregaPrevista as unknown as string);
        const diffDias = Math.round((despacho.getTime() - previsto.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: r.id,
          destinatarioNome: r.destinatarioNome,
          municipio: r.municipio,
          estado: r.estado,
          empacotamentoPedidoNumero: r.empacotamentoPedidoNumero,
          tipoMaterial: r.tipoMaterial,
          dataEntregaPrevista: r.dataEntregaPrevista,
          dataDespacho: r.dataDespacho,
          diffDias,
          situacao: diffDias > 1 ? "antecipado" : diffDias <= 0 ? "no_prazo" : "atrasado",
        };
      });
      return {
        total,
        noPrazo: noPrazo.length,
        antecipados: antecipados.length,
        atrasados: atrasados.length,
        pctNoPrazo: total > 0 ? Math.round((noPrazo.length / total) * 100) : 0,
        pctAntecipados: total > 0 ? Math.round((antecipados.length / total) * 100) : 0,
        pctAtrasados: total > 0 ? Math.round((atrasados.length / total) * 100) : 0,
        pedidos,
      };
    }),

  // ── Marcar/desmarcar retrabalho em uma cotação ──────────────────────────────
  marcarRetrabalho: publicProcedure
    .input(z.object({
      id: z.number(),
      temRetrabalho: z.boolean(),
      tipoRetrabalho: z.string().optional(),
      motivoRetrabalho: z.string().optional(),
      retrabalhoVinculadoId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.update(cotacoesFrete)
        .set({
          temRetrabalho: input.temRetrabalho,
          tipoRetrabalho: input.tipoRetrabalho ?? null,
          motivoRetrabalho: input.motivoRetrabalho ?? null,
          retrabalhoVinculadoId: input.retrabalhoVinculadoId ?? null,
        } as any)
        .where(eq(cotacoesFrete.id, input.id));
      return { ok: true };
    }),

  // ── Métricas de retrabalho nos pedidos atrasados ────────────────────────────
  metricasRetrabalho: publicProcedure
    .input(z.object({
      de: z.string().optional(),
      ate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      // Buscar todos os pedidos com dataDespacho e dataEntregaPrevista
      const todos = await db.select().from(cotacoesFrete)
        .where(eq(cotacoesFrete.status, "enviada"));
      const comDatas = todos.filter(r => r.dataDespacho && r.dataEntregaPrevista);
      let filtrados = comDatas;
      if (input.de) {
        const de = new Date(input.de);
        filtrados = filtrados.filter(r => new Date(r.dataDespacho as unknown as string) >= de);
      }
      if (input.ate) {
        const ate = new Date(input.ate);
        ate.setHours(23, 59, 59, 999);
        filtrados = filtrados.filter(r => new Date(r.dataDespacho as unknown as string) <= ate);
      }
      // Separar atrasados
      const atrasados = filtrados.filter(r => {
        const despacho = new Date(r.dataDespacho as unknown as string);
        const previsto = new Date(r.dataEntregaPrevista as unknown as string);
        return despacho > previsto;
      });
      const totalAtrasados = atrasados.length;
      const atrasadosComRetrabalho = atrasados.filter(r => r.temRetrabalho);
      const pctAtrasadosComRetrabalho = totalAtrasados > 0
        ? Math.round((atrasadosComRetrabalho.length / totalAtrasados) * 100)
        : 0;
      // Distribuição por tipo de retrabalho
      const tipoMap: Record<string, number> = {};
      atrasadosComRetrabalho.forEach(r => {
        const tipo = r.tipoRetrabalho ?? "Não categorizado";
        tipoMap[tipo] = (tipoMap[tipo] ?? 0) + 1;
      });
      const distribuicaoPorTipo = Object.entries(tipoMap)
        .map(([tipo, count]) => ({ tipo, count, pct: Math.round((count / (atrasadosComRetrabalho.length || 1)) * 100) }))
        .sort((a, b) => b.count - a.count);
      // Tendência mensal (últimos 6 meses)
      const agora = new Date();
      const tendencia = [];
      for (let i = 5; i >= 0; i--) {
        const mes = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const fimMes = new Date(agora.getFullYear(), agora.getMonth() - i + 1, 0, 23, 59, 59);
        const atrasadosMes = filtrados.filter(r => {
          const d = new Date(r.dataDespacho as unknown as string);
          const p = new Date(r.dataEntregaPrevista as unknown as string);
          return d > p && d >= mes && d <= fimMes;
        });
        const comRetMes = atrasadosMes.filter(r => r.temRetrabalho).length;
        tendencia.push({
          mes: mes.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          totalAtrasados: atrasadosMes.length,
          comRetrabalho: comRetMes,
          pct: atrasadosMes.length > 0 ? Math.round((comRetMes / atrasadosMes.length) * 100) : 0,
        });
      }
      // Lista detalhada dos atrasados com retrabalho
      const lista = atrasados.map(r => {
        const despacho = new Date(r.dataDespacho as unknown as string);
        const previsto = new Date(r.dataEntregaPrevista as unknown as string);
        const diffDias = Math.round((despacho.getTime() - previsto.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: r.id,
          empacotamentoPedidoNumero: r.empacotamentoPedidoNumero,
          destinatarioNome: r.destinatarioNome,
          municipio: r.municipio,
          estado: r.estado,
          tipoMaterial: r.tipoMaterial,
          dataEntregaPrevista: r.dataEntregaPrevista,
          dataDespacho: r.dataDespacho,
          diffDias,
          temRetrabalho: r.temRetrabalho ?? false,
          tipoRetrabalho: r.tipoRetrabalho,
          motivoRetrabalho: r.motivoRetrabalho,
        };
      });
      return {
        totalAtrasados,
        comRetrabalho: atrasadosComRetrabalho.length,
        semRetrabalho: totalAtrasados - atrasadosComRetrabalho.length,
        pctComRetrabalho: pctAtrasadosComRetrabalho,
        distribuicaoPorTipo,
        tendencia,
        lista,
      };
    }),
});
// ─── CT-e ─────────────────────────────────────────────────────────────────────

export const cteRouter = router({
  list: publicProcedure
    .input(z.object({ transportadoraId: z.number().optional() }))
    .query(async ({ input }) => {
      let rows = await db.select().from(cteImportacoes).orderBy(desc(cteImportacoes.createdAt));
      if (input.transportadoraId) rows = rows.filter(r => r.transportadoraId === input.transportadoraId);
      return rows;
    }),

  importar: publicProcedure
    .input(z.array(z.object({
      numeroCte: z.string(),
      transportadoraId: z.number().optional(),
      transportadoraNome: z.string().optional(),
      valor: z.string().optional(),
      dataEmissao: z.string().optional(),
      remetente: z.string().optional(),
      destinatario: z.string().optional(),
      municipioDestino: z.string().optional(),
      estadoDestino: z.string().optional(),
    })))
    .mutation(async ({ input }) => {
      let inserted = 0;
      for (const item of input) {
        try {
          await db.insert(cteImportacoes).values({
            ...item,
            dataEmissao: item.dataEmissao ? new Date(item.dataEmissao) : undefined,
          } as any);
          inserted++;
        } catch {
          // ignorar duplicatas
        }
      }
      return { inserted };
    }),

  create: publicProcedure
    .input(z.object({
      numeroCte: z.string(),
      transportadoraId: z.number().optional(),
      transportadoraNome: z.string().optional(),
      valor: z.string().optional(),
      dataEmissao: z.string().optional(),
      remetente: z.string().optional(),
      destinatario: z.string().optional(),
      municipioDestino: z.string().optional(),
      estadoDestino: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Buscar nome da transportadora se ID foi fornecido
      let transportadoraNome = input.transportadoraNome;
      if (input.transportadoraId && !transportadoraNome) {
        const [t] = await db.select().from(transportadoras).where(eq(transportadoras.id, input.transportadoraId));
        transportadoraNome = t?.nome;
      }
      const [result] = await db.insert(cteImportacoes).values({
        ...input,
        transportadoraNome,
        dataEmissao: input.dataEmissao ? new Date(input.dataEmissao) : undefined,
      } as any).returning({ id: cteImportacoes.id });
      return { id: result.id };
    }),

  stats: publicProcedure.query(async () => {
    const rows = await db.select().from(cteImportacoes);
    const total = rows.length;
    const totalValor = rows.reduce((acc, r) => acc + parseFloat((r.valor ?? "0").replace(",", ".")), 0);
    const transportadoraMap: Record<string, { total: number; totalValor: number }> = {};
    rows.forEach(r => {
      const nome = r.transportadoraNome ?? "Desconhecida";
      if (!transportadoraMap[nome]) transportadoraMap[nome] = { total: 0, totalValor: 0 };
      transportadoraMap[nome].total += 1;
      transportadoraMap[nome].totalValor += parseFloat((r.valor ?? "0").replace(",", "."));
    });
    const porTransportadora = Object.entries(transportadoraMap)
      .map(([transportadoraNome, v]) => ({ transportadoraNome, ...v }))
      .sort((a, b) => b.total - a.total);
    return { total, totalValor, porTransportadora };
  }),
  
  // ───── FRETE AUTOMÁTICO ─────────────────────────────────────────────────────
  
  buscarDadosOS: publicProcedure
    .input(z.object({ osNumero: z.string() }))
    .query(async ({ input }) => {
      try {
        const dados = await buscarDadosOSParaFrete(input.osNumero);
        return dados;
      } catch (error) {
        console.error("[Frete] Erro ao buscar OS:", error);
        return null;
      }
    }),
  
  obterCotacoes: publicProcedure
    .input(z.object({
      municipio: z.string(),
      estado: z.string(),
      peso_kg: z.number().positive(),
      valor_nf: z.number().positive(),
    }))
    .query(async ({ input }) => {
      try {
        const cotacoes = await obterCotacoesFreteSimuladas(
          input.municipio,
          input.estado,
          input.peso_kg,
          input.valor_nf
        );
        return cotacoes;
      } catch (error) {
        console.error("[Frete] Erro ao obter cotações:", error);
        return [];
      }
    }),
});
