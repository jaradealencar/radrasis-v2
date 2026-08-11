import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db/db";
import { crmMetas, crmContatos, historicoOs, clienteOverrides, crmScripts, crmFaixaEtiquetas, crmAtividadeLog } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

// ─── Helper: calcular turno a partir do horário ───────────────────────────────
function calcTurno(date: Date): "manha" | "tarde" | "noite" {
  const h = date.getHours(); // UTC-3 (Brasília) = UTC - 3
  // Ajusta para horário de Brasília (UTC-3)
  const hBrasilia = ((h - 3) + 24) % 24;
  if (hBrasilia >= 6 && hBrasilia < 12) return "manha";
  if (hBrasilia >= 12 && hBrasilia < 18) return "tarde";
  return "noite";
}

// ─── Helper: registrar atividade no log ──────────────────────────────────────
async function logAtividade(ctx: TrpcContext, opts: {
  vendedor: string;
  acao: string;
  orcamentoId?: string;
  empresa?: string;
  detalhe?: string;
}) {
  try {
    const db = (await getDb())!;
    const agora = new Date();
    await db.insert(crmAtividadeLog).values({
      vendedor: opts.vendedor,
      localUserId: ctx.localUser?.id ?? null,
      acao: opts.acao,
      orcamentoId: opts.orcamentoId ?? null,
      empresa: opts.empresa ?? null,
      detalhe: opts.detalhe ?? null,
      realizadaEm: agora,
      turno: calcTurno(agora),
    } as any);
  } catch {
    // silently ignore — não deixar falha de log quebrar a ação principal
  }
}
import { eq, and, desc, sql } from "drizzle-orm";
import https from "https";
// ─── Helpers Mubisys ──────────────────────────────────────────────────────────

// Normaliza nome de empresa: minúsculas, sem acentos, sem pontuação extra
function normalizeEmpresa(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, "")    // remove pontuação
    .replace(/\s+/g, " ")            // colapsa espaços
    .trim();
}

function fetchMubisys(publicKey: string, accessToken: string, path: string): Promise<any> {
  return new Promise((resolve) => {
    const url = `https://api.mubisys.com/api/${publicKey}${path}`;
    const req = https.get(url, { headers: { "Access-Token": accessToken, Accept: "application/json" } }, (res) => {
      let body = "";
      res.on("data", (c: Buffer) => (body += c));
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(25000, () => { req.destroy(); resolve(null); });
  });
}

async function fetchAllPages(publicKey: string, accessToken: string, path: string) {
  let page = 1;
  const all: any[] = [];
  while (true) {
    const resp: any = await fetchMubisys(publicKey, accessToken, `${path}&page=${page}&per_page=100`);
    const data = resp?.data ?? resp;
    const items: any[] = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    all.push(...items);
    const lastPage = data?.pagination?.last_page ?? 1;
    if (page >= lastPage || items.length === 0) break;
    page++;
  }
  return all;
}

function parseDate(str: string | null | undefined): Date | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function diasDesde(str: string | null | undefined): number | null {
  const d = parseDate(str);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// Janela de follow-up sugerida com base nos dados históricos
function janelaSugerida(diasCriado: number): string {
  if (diasCriado <= 3) return "urgente";      // dentro da janela de 60%
  if (diasCriado <= 7) return "atencao";      // janela de 13,6%
  if (diasCriado <= 15) return "risco";       // janela de 11,1%
  if (diasCriado <= 30) return "critico";     // janela de 7,9%
  return "perdido";                            // >30 dias
}

// ─── Mensagens motivacionais ──────────────────────────────────────────────────
const MOTIVACIONAL_PROMPTS = [
  "Gere uma mensagem motivacional curta (máximo 2 frases) para um vendedor de uma empresa de letreiros e comunicação visual. Mencione que ontem ele fez {propostas} propostas e que há {pendentes} propostas esperando follow-up. Use tom animado, direto e encorajador. Foque em transformar o mês em resultado.",
  "Crie uma mensagem de incentivo curta (máximo 2 frases) para um vendedor. Ele fez {propostas} propostas ontem. Tem {pendentes} oportunidades abertas esperando contato. Use metáfora de conquista ou desafio. Tom: energético e positivo.",
  "Escreva uma mensagem motivacional rápida (máximo 2 frases) para um vendedor de comunicação visual. Ontem: {propostas} propostas enviadas. Agora: {pendentes} clientes aguardando seu contato. Use linguagem de vendas, foco em resultado.",
  "Crie uma frase de motivação para vendas (máximo 2 frases). O vendedor tem {pendentes} propostas abertas e fez {propostas} ontem. Mencione que cada contato pode ser o fechamento que falta para bater a meta.",
  "Gere uma mensagem curta (máximo 2 frases) de incentivo para um vendedor. Contexto: {propostas} propostas enviadas ontem, {pendentes} aguardando follow-up. Use tom de desafio e superação.",
];

// ─── Router ───────────────────────────────────────────────────────────────────
export const crmRouter = router({

  // Buscar propostas abertas do vendedor logado (ou de um vendedor específico para diretor)
  getPropostas: protectedProcedure
    .input(z.object({
      vendedor: z.string().optional(), // se omitido, usa o nome do usuário logado
      mes: z.number().min(1).max(12).optional(),
      ano: z.number().optional(),
      dataInicio: z.string().optional(), // YYYY-MM-DD — filtro manual de datas
      dataFim: z.string().optional(),
      preset: z.enum(["hoje", "7dias", "15dias", "mes", "personalizado"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const publicKey = process.env.MUBISYS_PUBLIC_KEY!;
      const accessToken = process.env.MUBISYS_ACCESS_TOKEN!;

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

      // Calcular datas com base no preset
      let di: string;
      let df: string;
      const preset = input.preset ?? "mes";
      if (preset === "hoje") {
        di = fmtDate(now); df = fmtDate(now);
      } else if (preset === "7dias") {
        const d7 = new Date(now); d7.setDate(now.getDate() - 7);
        di = fmtDate(d7); df = fmtDate(now);
      } else if (preset === "15dias") {
        const d15 = new Date(now); d15.setDate(now.getDate() - 15);
        di = fmtDate(d15); df = fmtDate(now);
      } else if (preset === "personalizado" && input.dataInicio && input.dataFim) {
        di = input.dataInicio; df = input.dataFim;
      } else {
        // mes (default)
        const mes = input.mes ?? now.getMonth() + 1;
        const ano = input.ano ?? now.getFullYear();
        const lastDay = new Date(ano, mes, 0).getDate();
        di = input.dataInicio ?? `${ano}-${pad(mes)}-01`;
        df = input.dataFim ?? `${ano}-${pad(mes)}-${pad(lastDay)}`;
      }

      // Buscar propostas em aberto: usa período amplo (12 meses) para capturar todas,
      // independente de quando foram criadas (evita perder propostas antigas ainda abertas)
      const diAberto = fmtDate(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
      const dfAberto = fmtDate(now);
      const todosAbertos = await fetchAllPages(publicKey, accessToken, `/orcamento?status=TODOS&filtrodata=CADASTRO&datainicial=${diAberto}&datafinal=${dfAberto}`);
      const abertos = todosAbertos.filter((o: any) => {
        const s = (o.status || "").toLowerCase();
        return s === "em aberto" || s === "em andamento" || s === "pendente";
      });

      // Buscar propostas fechadas: usa o período selecionado pelo usuário (para stats do mês)
      const todosPeriodo = await fetchAllPages(publicKey, accessToken, `/orcamento?status=TODOS&filtrodata=CADASTRO&datainicial=${di}&datafinal=${df}`);
      const fechados = todosPeriodo.filter((o: any) => {
        const s = (o.status || "").toLowerCase();
        return s === "aprovado" || s === "faturado" || s === "concluido" || s === "concluído";
      });

      // Filtrar por vendedor
      // Se vendedor não informado, retorna TODOS (não filtra por usuário logado)
      const vendedorFiltro = input.vendedor ?? "";
      const filtrar = (list: any[]) =>
        vendedorFiltro
          ? list.filter(o => (o.vendedor || "").toLowerCase().includes(vendedorFiltro.toLowerCase()))
          : list;

      const propostasAbertas = filtrar(abertos);
      const propostasFechadas = filtrar(fechados);

      // Buscar contatos registrados para essas propostas
      const idsAbertos = propostasAbertas.map((o: any) => String(o.id));
      const db = (await getDb())!;
      // Buscar contatos de todas as propostas abertas (sem filtro de vendedor no DB)
      const contatosDb = idsAbertos.length > 0
        ? await db.select().from(crmContatos)
            .orderBy(desc(crmContatos.contatadoEm))
        : [];

      // Mapear contatos por orcamentoId
      type ContatoRow = typeof contatosDb[0];
      const contatosPorOrc: Record<string, ContatoRow[]> = {};
      for (const c of contatosDb) {
        if (!contatosPorOrc[c.orcamentoId]) contatosPorOrc[c.orcamentoId] = [];
        contatosPorOrc[c.orcamentoId].push(c);
      }

      // Enriquecer propostas abertas com dados de follow-up
      const propostas = propostasAbertas.map((o: any) => {
        const orcId = String(o.id);
        const contatos = contatosPorOrc[orcId] ?? [];
        const diasCriado = diasDesde(o.data_cadastro) ?? 0;
        const primeiroContato = contatos.find(c => c.numeroContato === 1);
        const segundoContato = contatos.find(c => c.numeroContato === 2);
        const diasAteContato1 = primeiroContato
          ? Math.floor((new Date(primeiroContato.contatadoEm).getTime() - new Date(o.data_cadastro).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        // Extrair nome do contato do orçamento
        const contatosOrc: any[] = Array.isArray(o.cliente_contato) ? o.cliente_contato : [];
        const primeiroContatoOrc = contatosOrc[0];
        const nomeContato = primeiroContatoOrc?.nome_contato ?? primeiroContatoOrc?.nome ?? "";
        return {
          id: orcId,
          sequencial: o.sequencial_orcamento,
          nomeContato,
          empresa: o.empresa,
          vendedor: o.vendedor,
          valor: parseFloat(o.valor_total ?? "0"),
          dataCriacao: o.data_cadastro,
          diasAberto: diasCriado,
          janela: janelaSugerida(diasCriado),
          contato1: primeiroContato ? {
            data: primeiroContato.contatadoEm,
            canal: primeiroContato.canal,
            obs: primeiroContato.observacao,
          } : null,
          contato2: segundoContato ? {
            data: segundoContato.contatadoEm,
            canal: segundoContato.canal,
            obs: segundoContato.observacao,
          } : null,
          qtdContatos: contatos.length,
          contato1NoPrazo: diasAteContato1 !== null ? diasAteContato1 <= 3 : null,
          meta2Contatos: contatos.length >= 2,
        };
      });

      // Estatísticas do mês
      const totalFechado = propostasFechadas.reduce((s: number, o: any) => s + parseFloat(o.valor_total ?? "0"), 0);
      const qtdFechadas = propostasFechadas.length;

      // Propostas de ontem (para mensagem motivacional)
      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);
      const ontemStr = `${ontem.getFullYear()}-${pad(ontem.getMonth() + 1)}-${pad(ontem.getDate())}`;
      const propostasOntem = propostasAbertas.filter((o: any) =>
        (o.data_cadastro ?? "").startsWith(ontemStr)
      ).length + propostasFechadas.filter((o: any) =>
        (o.data_aprovacao ?? "").startsWith(ontemStr)
      ).length;

      // Pendentes de follow-up (abertas sem 2 contatos)
      const pendentesFollowup = propostas.filter(p => p.qtdContatos < 2).length;

      // Extrair telefone direto do campo cliente_contato (array embutido no orçamento)
      const telefonesMap: Record<string, string> = {};
      for (const o of propostasAbertas) {
        const contatos: any[] = Array.isArray(o.cliente_contato) ? o.cliente_contato : [];
        const tel = contatos.find((c: any) => c.celular || c.telefone);
        if (tel) telefonesMap[String(o.id)] = tel.celular || tel.telefone;
      }
      // Contador de contatos feitos hoje
      const hoje = new Date();
      const hojeStr = `${hoje.getFullYear()}-${pad(hoje.getMonth()+1)}-${pad(hoje.getDate())}`;
      const contatosHoje = contatosDb.filter(c => {
        const d = new Date(c.contatadoEm);
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` === hojeStr;
      }).length;
      // Buscar propostas perdidas (excluídas manualmente)
      const perdidasDb = await db.select({ orcamentoId: crmContatos.orcamentoId })
        .from(crmContatos)
        .where(
          vendedorFiltro
            ? sql`${crmContatos.vendedor} = ${vendedorFiltro} AND ${crmContatos.canal} = 'perdida'`
            : sql`${crmContatos.canal} = 'perdida'`
        );
      const perdidasSet = new Set(perdidasDb.map(p => p.orcamentoId));
      const propostasFiltradas = propostas.filter(p => !perdidasSet.has(p.id));
      // Identificar clientes com compra — usar banco local (historicoOs) para evitar falha de DNS
      // Usar a mesma lógica do módulo Performance Comercial: .toLowerCase().trim() (sem normalização extra)
      // O banco historico_os armazena nomes em MAIÚSCULAS sem acentos, então toLowerCase() é suficiente
      const clientesComCompra = new Set<string>();
      const overrideMap = new Map<string, "recorrente" | "novo">();
      try {
        const osEntregues = await db.select({ empresa: historicoOs.empresa }).from(historicoOs);
        for (const row of osEntregues) {
          const nome = (row.empresa ?? "").trim();
          if (nome) clientesComCompra.add(nome.toLowerCase());
        }
        // Carregar overrides manuais (ex: cliente marcado como recorrente manualmente)
        const overrides = await db.select().from(clienteOverrides);
        for (const ov of overrides) {
          overrideMap.set(ov.empresa, ov.status);
        }
      } catch {
        // Se falhar, clientesComCompra fica vazio — nenhuma estrela será exibida (evita falso positivo)
      }
      // Enriquecer com telefone e clienteNovo
      const propostasComTelefone = propostasFiltradas.map(p => {
        const telefone = telefonesMap[p.id] ?? null;
        const orc = propostasAbertas.find((o: any) => String(o.id) === p.id);
        // Extrair nome do cliente do orçamento
        // Na API MubiSys: 'empresa' = empresa emissora (RADRA), 'cliente' = cliente do orçamento
        const clienteRaw = orc?.cliente;
        const empresaRaw = orc?.empresa; // emissora — não usar para exibir
        const nomeCliente = typeof clienteRaw === "object" && clienteRaw !== null
          ? (clienteRaw as any)?.nome ?? (clienteRaw as any)?.razao_social ?? String(clienteRaw)
          : String(clienteRaw ?? empresaRaw ?? "");
        const clienteKey = (nomeCliente || "").toLowerCase().trim();
        // Verificar override manual: "recorrente" exclui estrela; "novo" força estrela
        const overrideStatus = overrideMap.get(clienteKey);
        const isNovoByHistory = clientesComCompra.size > 0 && !clientesComCompra.has(clienteKey);
        const clienteNovo = overrideStatus === "recorrente" ? false
          : overrideStatus === "novo" ? true
          : isNovoByHistory;
        return { ...p, telefone, nomeCliente, nomeContato: p.nomeContato ?? "", clienteNovo };
      });
      return {
        propostas: propostasComTelefone.sort((a, b) => a.qtdContatos - b.qtdContatos || b.diasAberto - a.diasAberto),
        stats: {
          totalAberto: propostasComTelefone.length,
          totalFechado: qtdFechadas,
          valorFechado: totalFechado,
          pendentesFollowup,
          propostasOntem,
          contatosHoje,
          semContato: propostasComTelefone.filter(p => p.qtdContatos === 0).length,
          com1Contato: propostasComTelefone.filter(p => p.qtdContatos === 1).length,
          com2Contatos: propostasComTelefone.filter(p => p.qtdContatos >= 2).length,
          urgente: propostasComTelefone.filter(p => p.janela === "urgente").length,
          atencao: propostasComTelefone.filter(p => p.janela === "atencao").length,
          risco: propostasComTelefone.filter(p => p.janela === "risco").length,
          critico: propostasComTelefone.filter(p => p.janela === "critico").length,
        },
      };
    }),
  // Desfazer contato registrado
  desfazarContato: protectedProcedure
    .input(z.object({
      orcamentoId: z.string(),
      data: z.string(), // ISO string da data do contato a remover
    }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const todos = await db.select().from(crmContatos)
        .where(eq(crmContatos.orcamentoId, input.orcamentoId))
        .orderBy(desc(crmContatos.contatadoEm));
      const dataAlvo = new Date(input.data);
      const alvo = todos.find(c => {
        const d = new Date(c.contatadoEm);
        return d.getFullYear() === dataAlvo.getFullYear() &&
          d.getMonth() === dataAlvo.getMonth() &&
          d.getDate() === dataAlvo.getDate();
      });
      if (!alvo) throw new TRPCError({ code: "NOT_FOUND", message: "Contato não encontrado para essa data." });
      await db.delete(crmContatos).where(eq(crmContatos.id, alvo.id));
      const vendedor = ctx.localUser?.name ?? "desconhecido";
      await logAtividade(ctx, { vendedor, acao: "desfazarContato", orcamentoId: input.orcamentoId, detalhe: `contato de ${input.data} removido` });
      return { ok: true };
    }),
  // Marcar proposta como ganha
  marcarGanha: protectedProcedure
    .input(z.object({ orcamentoId: z.string(), vendedor: z.string(), empresa: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      // Registra como contato com canal 'garantiu_fechamento' para histórico
      const existing = await db.select().from(crmContatos)
        .where(sql`${crmContatos.orcamentoId} = ${input.orcamentoId} AND ${crmContatos.canal} = 'garantiu_fechamento'`)
        .limit(1);
      if (existing.length === 0) {
        await db.insert(crmContatos).values({
          orcamentoId: input.orcamentoId,
          vendedor: input.vendedor,
          empresa: input.empresa,
          numeroContato: 99,
          canal: "garantiu_fechamento" as any,
          observacao: "Proposta marcada como ganha",
        } as any);
      }
      await logAtividade(ctx, { vendedor: input.vendedor, acao: "marcarGanha", orcamentoId: input.orcamentoId, empresa: input.empresa });
      return { ok: true };
    }),

  // Marcar proposta como perdida
  marcarPerdida: protectedProcedure
    .input(z.object({ orcamentoId: z.string(), vendedor: z.string(), empresa: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      // Verifica se já existe
      const existing = await db.select().from(crmContatos)
        .where(sql`${crmContatos.orcamentoId} = ${input.orcamentoId} AND ${crmContatos.canal} = 'perdida'`)
        .limit(1);
      if (existing.length === 0) {
        await db.insert(crmContatos).values({
          orcamentoId: input.orcamentoId,
          vendedor: input.vendedor,
          empresa: input.empresa,
          numeroContato: 99,
          canal: "perdida" as "whatsapp",
          observacao: "Proposta marcada como perdida",
        } as any);
      }
      await logAtividade(ctx, { vendedor: input.vendedor, acao: "descartar", orcamentoId: input.orcamentoId, empresa: input.empresa, detalhe: "proposta marcada como perdida" });
      return { ok: true };
    }),

  // Mensagem motivacional via Gemini
  getMensagemMotivacional: protectedProcedure
    .input(z.object({
      propostasOntem: z.number(),
      pendentesFollowup: z.number(),
      nomeVendedor: z.string(),
    }))
    .query(async ({ input }) => {
      const promptTemplate = MOTIVACIONAL_PROMPTS[Math.floor(Math.random() * MOTIVACIONAL_PROMPTS.length)];
      const prompt = promptTemplate
        .replace("{propostas}", String(input.propostasOntem))
        .replace("{pendentes}", String(input.pendentesFollowup));

      try {
        const resp: any = await invokeLLM({
          messages: [
            { role: "system", content: `Você é um coach de vendas motivacional. Responda APENAS com a mensagem, sem aspas, sem prefixo. Personalize para ${input.nomeVendedor}.` },
            { role: "user", content: prompt },
          ],
        });
        const msg = resp?.choices?.[0]?.message?.content ?? "";
        return { mensagem: msg.trim() };
      } catch {
        return { mensagem: `${input.nomeVendedor}, você tem ${input.pendentesFollowup} propostas esperando seu contato. Cada ligação pode ser o fechamento que falta! 🚀` };
      }
    }),

  // Registrar contato
  registrarContato: protectedProcedure
    .input(z.object({
      orcamentoId: z.string(),
      empresa: z.string(),
      vendedor: z.string(),
      canal: z.enum(["nao_retornou", "esperando_cliente", "garantiu_fechamento"]),
      observacao: z.string().nullable().optional(),
      dataContato: z.string().optional(), // ISO string da data clicada
    }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      // Determinar número do contato (1 ou 2) baseado em quantos já existem
      const existentes = await db.select().from(crmContatos)
        .where(and(
          eq(crmContatos.orcamentoId, input.orcamentoId),
          sql`${crmContatos.canal} NOT IN ('perdida', 'garantiu_fechamento')`,
        ));
      const numeroContato = existentes.length + 1;
      if (numeroContato > 2) {
        throw new TRPCError({ code: "CONFLICT", message: "Máximo de 2 contatos já registrados para esta proposta." });
      }
      const contatadoEm = input.dataContato ? new Date(input.dataContato) : new Date();
      await db.insert(crmContatos).values({
        orcamentoId: input.orcamentoId,
        vendedor: input.vendedor,
        empresa: input.empresa,
        numeroContato,
        canal: input.canal as any,
        observacao: input.observacao ?? null,
        contatadoEm,
      } as any);
      // Determinar faixa com base na data de criação do orçamento (diasCriado)
      // O frontend passa o orcamentoId; a faixa é calculada no log pelo painel de auditoria
      await logAtividade(ctx, {
        vendedor: input.vendedor,
        acao: "registrarContato",
        orcamentoId: input.orcamentoId,
        empresa: input.empresa,
        detalhe: `canal=${input.canal} contato#${numeroContato}`,
      });
      return { ok: true };
    }),

  // Buscar/salvar meta do vendedor
  getMeta: protectedProcedure
    .input(z.object({ vendedor: z.string(), mes: z.number(), ano: z.number() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const rows = await db.select().from(crmMetas)
        .where(and(
          eq(crmMetas.vendedor, input.vendedor),
          eq(crmMetas.mes, input.mes),
          eq(crmMetas.ano, input.ano),
        ));
      return rows[0] ?? null;
    }),

  saveMeta: protectedProcedure
    .input(z.object({
      vendedor: z.string(),
      mes: z.number(),
      ano: z.number(),
      metaValor: z.number(),
      metaQtdOs: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      const existing = await db.select().from(crmMetas)
        .where(and(
          eq(crmMetas.vendedor, input.vendedor),
          eq(crmMetas.mes, input.mes),
          eq(crmMetas.ano, input.ano),
        ));
      if (existing.length > 0) {
        await db.update(crmMetas)
          .set({ metaValor: String(input.metaValor), metaQtdOs: input.metaQtdOs })
          .where(eq(crmMetas.id, existing[0].id));
      } else {
        await db.insert(crmMetas).values({
          vendedor: input.vendedor,
          mes: input.mes,
          ano: input.ano,
          metaValor: String(input.metaValor),
          metaQtdOs: input.metaQtdOs,
        });
      }
      return { ok: true };
    }),

  // Visão do diretor: todos os vendedores
  getVendedores: protectedProcedure.query(async () => {
    const publicKey = process.env.MUBISYS_PUBLIC_KEY!;
    const accessToken = process.env.MUBISYS_ACCESS_TOKEN!;

    const now = new Date();
    const mes = now.getMonth() + 1;
    const ano = now.getFullYear();
    const pad = (n: number) => String(n).padStart(2, "0");
    const lastDay = new Date(ano, mes, 0).getDate();
    const di = `${ano}-${pad(mes)}-01`;
    const df = `${ano}-${pad(mes)}-${pad(lastDay)}`;
    // Período amplo para capturar todas as propostas em aberto (independente de quando foram criadas)
    const diAberto = `${ano - 1}-${pad(mes)}-${pad(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).getDate())}`;
    const dfAberto = df;

    const todosAbertos = await fetchAllPages(publicKey, accessToken, `/orcamento?status=TODOS&filtrodata=CADASTRO&datainicial=${diAberto}&datafinal=${dfAberto}`);
    const abertos = todosAbertos.filter((o: any) => { const s = (o.status||"").toLowerCase(); return s==="em aberto"||s==="em andamento"||s==="pendente"; });
    const todosPeriodo = await fetchAllPages(publicKey, accessToken, `/orcamento?status=TODOS&filtrodata=CADASTRO&datainicial=${di}&datafinal=${df}`);
    const fechados = todosPeriodo.filter((o: any) => { const s = (o.status||"").toLowerCase(); return s==="aprovado"||s==="faturado"||s==="concluido"||s==="concluído"; });

    // Agrupar por vendedor
    const vendedores: Record<string, { abertos: number; valorAberto: number; fechados: number; valorFechado: number }> = {};
    for (const o of abertos) {
      const v = o.vendedor || "Sem Vendedor";
      if (!vendedores[v]) vendedores[v] = { abertos: 0, valorAberto: 0, fechados: 0, valorFechado: 0 };
      vendedores[v].abertos++;
      vendedores[v].valorAberto += parseFloat(o.valor_total ?? "0");
    }
    for (const o of fechados) {
      const v = o.vendedor || "Sem Vendedor";
      if (!vendedores[v]) vendedores[v] = { abertos: 0, valorAberto: 0, fechados: 0, valorFechado: 0 };
      vendedores[v].fechados++;
      vendedores[v].valorFechado += parseFloat(o.valor_total ?? "0");
    }

    // Buscar metas do mês
    const db = (await getDb())!;
    const metas = await db.select().from(crmMetas)
      .where(and(eq(crmMetas.mes, mes), eq(crmMetas.ano, ano)));
    const metaMap: Record<string, typeof metas[0]> = {};
    for (const m of metas) metaMap[m.vendedor] = m;

    return Object.entries(vendedores)
      .map(([nome, dados]) => ({
        nome,
        ...dados,
        meta: metaMap[nome] ?? null,
        pctMeta: metaMap[nome]
          ? Math.round((dados.valorFechado / parseFloat(String(metaMap[nome].metaValor))) * 100)
          : null,
      }))
      .sort((a, b) => b.valorFechado - a.valorFechado);
  }),

  // Contatos já registrados de uma proposta
  getContatos: protectedProcedure
    .input(z.object({ orcamentoId: z.string() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      return db.select().from(crmContatos)
        .where(eq(crmContatos.orcamentoId, input.orcamentoId))
        .orderBy(crmContatos.numeroContato);
    }),

  // Buscar metas do mês com usuário vinculado
  getMetas: protectedProcedure
    .input(z.object({ mes: z.number().optional(), ano: z.number().optional() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const now = new Date();
      const mes = input.mes ?? (now.getMonth() + 1);
      const ano = input.ano ?? now.getFullYear();
      return db.select().from(crmMetas)
        .where(and(eq(crmMetas.mes, mes), eq(crmMetas.ano, ano)))
        .orderBy(crmMetas.vendedor);
    }),

  // Salvar meta (cria ou atualiza)
  salvarMeta: protectedProcedure
    .input(z.object({
      vendedor: z.string(),
      mes: z.number(),
      ano: z.number(),
      metaValor: z.number().optional(),
      metaQtdOs: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      const existing = await db.select().from(crmMetas)
        .where(and(eq(crmMetas.vendedor, input.vendedor), eq(crmMetas.mes, input.mes), eq(crmMetas.ano, input.ano)))
        .limit(1);
      if (existing.length > 0) {
        await db.update(crmMetas)
          .set({ metaValor: String(input.metaValor ?? 0), metaQtdOs: input.metaQtdOs ?? 0 })
          .where(and(eq(crmMetas.vendedor, input.vendedor), eq(crmMetas.mes, input.mes), eq(crmMetas.ano, input.ano)));
      } else {
        await db.insert(crmMetas).values({
          vendedor: input.vendedor,
          mes: input.mes,
          ano: input.ano,
          metaValor: String(input.metaValor ?? 0),
          metaQtdOs: input.metaQtdOs ?? 0,
        });
      }
      return { ok: true };
    }),

  // Vincular usuário do sistema a um vendedor
  vincularUsuarioMeta: protectedProcedure
    .input(z.object({
      vendedor: z.string(),
      mes: z.number(),
      ano: z.number(),
      usuarioId: z.number().nullable(),
      usuarioNome: z.string().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      const existing = await db.select().from(crmMetas)
        .where(and(eq(crmMetas.vendedor, input.vendedor), eq(crmMetas.mes, input.mes), eq(crmMetas.ano, input.ano)))
        .limit(1);
      if (existing.length > 0) {
        await db.update(crmMetas)
          .set({ usuarioVinculadoId: input.usuarioId, usuarioVinculadoNome: input.usuarioNome })
          .where(and(eq(crmMetas.vendedor, input.vendedor), eq(crmMetas.mes, input.mes), eq(crmMetas.ano, input.ano)));
      } else {
        await db.insert(crmMetas).values({
          vendedor: input.vendedor,
          mes: input.mes,
          ano: input.ano,
          metaValor: "0",
          metaQtdOs: 0,
          usuarioVinculadoId: input.usuarioId,
          usuarioVinculadoNome: input.usuarioNome,
        });
      }
      return { ok: true };
    }),

  // DEBUG: inspecionar estrutura de um orçamento da API MubiSys
  debugOrcamento: protectedProcedure
    .input(z.object({ orcamentoId: z.string().optional() }))
    .query(async ({ input }) => {
      const publicKey = process.env.MUBISYS_PUBLIC_KEY!;
      const accessToken = process.env.MUBISYS_ACCESS_TOKEN!;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const mes = now.getMonth() + 1;
      const ano = now.getFullYear();
      const lastDay = new Date(ano, mes, 0).getDate();
      const di = `${ano}-${pad(mes)}-01`;
      const df = `${ano}-${pad(mes)}-${pad(lastDay)}`;
      const todos = await fetchAllPages(publicKey, accessToken, `/orcamento?status=TODOS&filtrodata=CADASTRO&datainicial=${di}&datafinal=${df}`);
      const sample = input.orcamentoId
        ? todos.find((o: any) => String(o.id) === input.orcamentoId)
        : todos[0];
      if (!sample) return { error: "Nenhum orçamento encontrado", keys: [] };
      return { keys: Object.keys(sample), sample };
    }),

  // Excluir vendedor das metas (remove todos os registros de metas do vendedor)
  excluirVendedorMeta: protectedProcedure
    .input(z.object({ vendedor: z.string(), mes: z.number(), ano: z.number() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      await db.delete(crmMetas)
        .where(and(eq(crmMetas.vendedor, input.vendedor), eq(crmMetas.mes, input.mes), eq(crmMetas.ano, input.ano)));
      return { ok: true };
    }),

  // ─── Scripts de vendas por faixa ─────────────────────────────────────────────
  listScripts: protectedProcedure
    .input(z.object({ faixa: z.number().min(1).max(20) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      return db.select().from(crmScripts)
        .where(and(eq(crmScripts.faixa, input.faixa), eq(crmScripts.ativo, true)))
        .orderBy(crmScripts.ordem);
    }),

  updateScript: protectedProcedure
    .input(z.object({
      id: z.number(),
      titulo: z.string().max(128).optional(),
      conteudo: z.string().min(1),
      conteudo_voz: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      await db.update(crmScripts)
        .set({ titulo: input.titulo, conteudo: input.conteudo, conteudo_voz: input.conteudo_voz ?? null })
        .where(eq(crmScripts.id, input.id));
      return { ok: true };
    }),

  addScript: protectedProcedure
    .input(z.object({
      faixa: z.number().min(1).max(20),
      titulo: z.string().max(128).optional(),
      conteudo: z.string().min(1),
      conteudo_voz: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      // Pega a maior ordem atual para essa faixa
      const existing = await db.select({ ordem: crmScripts.ordem })
        .from(crmScripts)
        .where(eq(crmScripts.faixa, input.faixa))
        .orderBy(desc(crmScripts.ordem))
        .limit(1);
      const nextOrdem = (existing[0]?.ordem ?? 0) + 1;
      const [inserted] = await db.insert(crmScripts).values({
        faixa: input.faixa,
        ordem: nextOrdem,
        titulo: input.titulo,
        conteudo: input.conteudo,
        conteudo_voz: input.conteudo_voz ?? null,
      });
      return { ok: true, id: (inserted as any).insertId };
    }),

  deleteScript: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      await db.update(crmScripts)
        .set({ ativo: false })
        .where(eq(crmScripts.id, input.id));
      return { ok: true };
    }),

  incrementCopiaCount: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      await db.execute(sql`UPDATE crm_scripts SET copia_count = copia_count + 1 WHERE id = ${input.id}`);
      return { ok: true };
    }),

  reorderScripts: protectedProcedure
    .input(z.object({
      faixa: z.number().min(1).max(20),
      orderedIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      await Promise.all(
        input.orderedIds.map((id, index) =>
          db.update(crmScripts)
            .set({ ordem: index })
            .where(eq(crmScripts.id, id))
        )
      );
      return { ok: true };
    }),

  // ─── Etiquetas das Faixas ────────────────────────────────────────────────────
  getFaixaEtiquetas: protectedProcedure
    .query(async () => {
      const db = (await getDb())!;
      const rows = await db.select().from(crmFaixaEtiquetas).orderBy(crmFaixaEtiquetas.faixa);
      // Garantir que as 3 faixas existam com valores padrão
      const defaults: Record<number, string> = { 1: 'Faixa 1 (1-3 du)', 2: 'Faixa 2 (4-7 du)', 3: 'Faixa 3 (8-15 du)' };
      const result: Record<number, string> = { ...defaults };
      for (const row of rows) result[row.faixa] = row.label;
      return result;
    }),

  saveFaixaEtiqueta: protectedProcedure
    .input(z.object({
      faixa: z.number().min(1).max(3),
      label: z.string().min(1).max(128),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      const existing = await db.select().from(crmFaixaEtiquetas).where(eq(crmFaixaEtiquetas.faixa, input.faixa));
      if (existing.length > 0) {
        await db.update(crmFaixaEtiquetas).set({ label: input.label }).where(eq(crmFaixaEtiquetas.faixa, input.faixa));
      } else {
        await db.insert(crmFaixaEtiquetas).values({ faixa: input.faixa, label: input.label });
      }
      return { ok: true };
    }),

  // ─── AUDITORIA DO CRM ────────────────────────────────────────────────────────

  /**
   * Retorna o painel de auditoria completo para um período (data inicial e final).
   * Inclui os 7 blocos: rotina, volume por faixa, descartes, limbo, velocidade suspeita,
   * ranking e diagnóstico.
   */
  getAuditoria: protectedProcedure
    .input(z.object({
      dataInicio: z.string(), // ISO date "YYYY-MM-DD"
      dataFim: z.string(),    // ISO date "YYYY-MM-DD"
      vendedor: z.string().optional(), // undefined = todos
    }))
    .query(async ({ input }) => {
      const db = (await getDb())!;

      // Converter para UTC considerando Brasília (UTC-3): 00:00 Brasília = 03:00 UTC
      const inicio = new Date(input.dataInicio + "T03:00:00.000Z");
      const fim = new Date(input.dataFim + "T26:59:59.999Z"); // 23:59 Brasília = 02:59 UTC do dia seguinte

      // Buscar todos os logs no período (com filtro opcional de vendedor)
      const logsWhere = input.vendedor
        ? and(
            sql`${crmAtividadeLog.realizadaEm} >= ${inicio}`,
            sql`${crmAtividadeLog.realizadaEm} <= ${fim}`,
            eq(crmAtividadeLog.vendedor, input.vendedor),
          )
        : and(
            sql`${crmAtividadeLog.realizadaEm} >= ${inicio}`,
            sql`${crmAtividadeLog.realizadaEm} <= ${fim}`,
          );
      const logs = await db.select().from(crmAtividadeLog)
        .where(logsWhere)
        .orderBy(crmAtividadeLog.realizadaEm);

      // Buscar todos os orçamentos do CRM para calcular limbo
      const contatos = await db.select().from(crmContatos)
        .where(sql`${crmContatos.canal} NOT IN ('perdida', 'garantiu_fechamento')`);

      // ── BLOCO A: Cumprimento de rotina manhã/tarde por dia por vendedor ──────
      // Gerar lista de dias no período
      const dias: string[] = [];
      const d = new Date(inicio);
      while (d <= fim) {
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        dias.push(`${yyyy}-${mm}-${dd}`);
        d.setUTCDate(d.getUTCDate() + 1);
      }

      // Agrupar logs por vendedor + dia + turno
      const rotinaPorVendedorDiaTurno: Record<string, Record<string, { manha: boolean; tarde: boolean; acoes: number }>> = {};
      for (const log of logs) {
        const dt = new Date(log.realizadaEm);
        // Ajusta para Brasília (UTC-3)
        const hBrasilia = ((dt.getUTCHours() - 3) + 24) % 24;
        const dtBrasilia = new Date(dt.getTime() - 3 * 60 * 60 * 1000);
        const diaStr = `${dtBrasilia.getUTCFullYear()}-${String(dtBrasilia.getUTCMonth() + 1).padStart(2, "0")}-${String(dtBrasilia.getUTCDate()).padStart(2, "0")}`;
        const turno = hBrasilia >= 6 && hBrasilia < 12 ? "manha" : hBrasilia >= 12 && hBrasilia < 18 ? "tarde" : "noite";
        const v = log.vendedor;
        if (!rotinaPorVendedorDiaTurno[v]) rotinaPorVendedorDiaTurno[v] = {};
        if (!rotinaPorVendedorDiaTurno[v][diaStr]) rotinaPorVendedorDiaTurno[v][diaStr] = { manha: false, tarde: false, acoes: 0 };
        if (turno === "manha") rotinaPorVendedorDiaTurno[v][diaStr].manha = true;
        if (turno === "tarde") rotinaPorVendedorDiaTurno[v][diaStr].tarde = true;
        rotinaPorVendedorDiaTurno[v][diaStr].acoes++;
      }

      // Calcular aderência por vendedor
      const vendedores = Array.from(new Set(logs.map(l => l.vendedor))).sort();
      const blocoA = vendedores.map(v => {
        let manhasOk = 0, tardesOk = 0;
        const diasDetalhes: Record<string, { manha: boolean; tarde: boolean; acoes: number }> = {};
        for (const dia of dias) {
          const r = rotinaPorVendedorDiaTurno[v]?.[dia] ?? { manha: false, tarde: false, acoes: 0 };
          diasDetalhes[dia] = r;
          if (r.manha) manhasOk++;
          if (r.tarde) tardesOk++;
        }
        const totalDias = dias.length;
        const aderencia = totalDias > 0 ? Math.round(((manhasOk + tardesOk) / (totalDias * 2)) * 100) : 0;
        return { vendedor: v, manhasOk, tardesOk, totalDias, aderencia, dias: diasDetalhes };
      });

      // ── BLOCO B: Volume por faixa ─────────────────────────────────────────────
      // Faixa é determinada pela ação registrarContato e o detalhe "faixa=X"
      // Como não temos a faixa no log diretamente, usamos a tabela crm_contatos
      // e calculamos a faixa com base nos dias desde a criação do orçamento
      const contatosNoPeriodo = await db.select().from(crmContatos)
        .where(and(
          sql`${crmContatos.contatadoEm} >= ${inicio}`,
          sql`${crmContatos.contatadoEm} <= ${fim}`,
          sql`${crmContatos.canal} NOT IN ('perdida', 'garantiu_fechamento')`,
        ));

      // Para calcular a faixa, precisamos do orçamento original
      // Faixa 1: 0-3 dias, Faixa 2: 4-15 dias, Faixa 3: 16-30 dias
      // Como não temos a data de criação do orçamento aqui, usamos o número do contato como proxy
      // numeroContato=1 ≈ Faixa 1, numeroContato=2 ≈ Faixa 2+
      // Melhor: usar o log com detalhe para extrair a faixa
      const blocoB = vendedores.map(v => {
        const logsFaixa = logs.filter(l => l.vendedor === v && l.acao === "registrarContato");
        // Extrair faixa do detalhe: "canal=xxx contato#N"
        let faixa1 = 0, faixa2 = 0, faixa3 = 0;
        for (const l of logsFaixa) {
          const match = (l.detalhe ?? "").match(/contato#(\d+)/);
          const numContato = match ? parseInt(match[1]) : 1;
          if (numContato === 1) faixa1++;
          else if (numContato === 2) faixa2++;
          else faixa3++;
        }
        return { vendedor: v, faixa1, faixa2, faixa3, total: faixa1 + faixa2 + faixa3 };
      });

      // ── BLOCO C: Descartes ────────────────────────────────────────────────────
      const blocoC = vendedores.map(v => {
        const descartes = logs.filter(l => l.vendedor === v && l.acao === "descartar").length;
        return { vendedor: v, descartes };
      });

      // ── BLOCO D: Propostas no limbo ───────────────────────────────────────────
      // Propostas com 0 contatos registrados há mais de 3 dias
      // Busca orçamentos do CRM que não têm contato há mais de 3 dias
      const agora = new Date();
      const orcamentosComContato = new Map<string, { ultimoContato: Date; vendedor: string; empresa: string }>();
      for (const c of contatos) {
        const prev = orcamentosComContato.get(c.orcamentoId);
        const dt = new Date(c.contatadoEm);
        if (!prev || dt > prev.ultimoContato) {
          orcamentosComContato.set(c.orcamentoId, { ultimoContato: dt, vendedor: c.vendedor, empresa: c.empresa });
        }
      }
      // Buscar orçamentos sem nenhum contato (nunca foram contatados)
      const orcamentosComContatoIds = new Set(contatos.map(c => c.orcamentoId));
      // Buscar todos os orçamentos do CRM (incluindo os sem contato)
      const todosOrcamentos = await db.select().from(crmContatos)
        .where(sql`${crmContatos.canal} = 'perdida' OR ${crmContatos.canal} = 'garantiu_fechamento'`)
        .limit(0); // apenas para ter o tipo
      void todosOrcamentos;

      const limbo: Array<{ orcamentoId: string; empresa: string; vendedor: string; diasSemContato: number; risco: string }> = [];
      for (const [orcId, info] of orcamentosComContato.entries()) {
        const diasSemContato = Math.floor((agora.getTime() - info.ultimoContato.getTime()) / (1000 * 60 * 60 * 24));
        if (diasSemContato > 3) {
          let risco = "baixo";
          if (diasSemContato >= 16) risco = "critico";
          else if (diasSemContato >= 7) risco = "alto";
          else if (diasSemContato >= 4) risco = "medio";
          limbo.push({ orcamentoId: orcId, empresa: info.empresa, vendedor: info.vendedor, diasSemContato, risco });
        }
      }
      limbo.sort((a, b) => b.diasSemContato - a.diasSemContato);

      // ── BLOCO E: Velocidade suspeita ──────────────────────────────────────────
      // Detecta vendedores que registraram >= 15 ações em < 10 minutos
      const JANELA_MS = 10 * 60 * 1000; // 10 minutos
      const LIMITE_ACOES = 15;
      const alertasVelocidade: Array<{ vendedor: string; dataHora: string; qtdAcoes: number; intervaloMedioSeg: number }> = [];
      for (const v of vendedores) {
        const logsV = logs
          .filter(l => l.vendedor === v)
          .sort((a, b) => new Date(a.realizadaEm).getTime() - new Date(b.realizadaEm).getTime());
        // Janela deslizante
        for (let i = 0; i < logsV.length; i++) {
          const tInicio = new Date(logsV[i].realizadaEm).getTime();
          let count = 1;
          let j = i + 1;
          while (j < logsV.length && new Date(logsV[j].realizadaEm).getTime() - tInicio <= JANELA_MS) {
            count++;
            j++;
          }
          if (count >= LIMITE_ACOES) {
            const intervaloMedioSeg = count > 1
              ? Math.round((new Date(logsV[j - 1].realizadaEm).getTime() - tInicio) / ((count - 1) * 1000))
              : 0;
            alertasVelocidade.push({
              vendedor: v,
              dataHora: logsV[i].realizadaEm.toISOString(),
              qtdAcoes: count,
              intervaloMedioSeg,
            });
            i = j - 1; // avança para não duplicar alertas
          }
        }
      }

      // ── BLOCO F: Ranking de engajamento ───────────────────────────────────────
      const blocoF = vendedores.map(v => {
        const totalContatos = logs.filter(l => l.vendedor === v && l.acao === "registrarContato").length;
        const totalDescartes = logs.filter(l => l.vendedor === v && l.acao === "descartar").length;
        const aderencia = blocoA.find(b => b.vendedor === v)?.aderencia ?? 0;
        const score = totalContatos * 2 + totalDescartes + aderencia;
        return { vendedor: v, totalContatos, totalDescartes, aderencia, score };
      }).sort((a, b) => b.score - a.score);

      // ── BLOCO G: Diagnóstico executivo ───────────────────────────────────────
      // Identifica o principal gargalo
      const menorAderencia = [...blocoA].sort((a, b) => a.aderencia - b.aderencia)[0];
      const maiorLimbo = limbo.length;
      const temAlertaVelocidade = alertasVelocidade.length > 0;
      let diagnostico = "";
      if (temAlertaVelocidade) {
        diagnostico = `⚠️ Alerta crítico: ${alertasVelocidade[0].vendedor} registrou ${alertasVelocidade[0].qtdAcoes} ações em menos de 10 minutos — possível preenchimento aleatório. Recomenda-se conversa imediata.`;
      } else if (menorAderencia && menorAderencia.aderencia < 60) {
        diagnostico = `🚨 ${menorAderencia.vendedor} está com ${menorAderencia.aderencia}% de aderência à rotina de CRM (meta: 80%). Verificar se há sobrecarga operacional ou resistência ao método.`;
      } else if (maiorLimbo > 5) {
        diagnostico = `💤 Há ${maiorLimbo} propostas paradas no limbo sem contato há mais de 3 dias. O principal gargalo é o follow-up de Faixa 2 e 3.`;
      } else {
        diagnostico = `✅ Rotina de CRM está sendo cumprida pelo time. Nenhum alerta crítico identificado no período.`;
      }

      // ── BLOCO H: Exclusões de contato com detalhe de faixas ─────────────────
      // Busca logs de ação 'desfazer_contato' no período
      const logsExclusao = logs.filter(l => l.acao === "desfazer_contato");
      // Para cada exclusão, verificar quantas faixas o orçamento tinha preenchidas
      // Buscar todos os contatos dos orçamentos excluídos
      const orcIdsExcluidos = Array.from(new Set(logsExclusao.map(l => l.orcamentoId).filter(Boolean))) as string[];
      const contatosExcluidos = orcIdsExcluidos.length > 0
        ? await db.select().from(crmContatos)
            .where(sql`${crmContatos.orcamentoId} IN (${sql.join(orcIdsExcluidos.map(id => sql`${id}`), sql`, `)})`)
        : [];
      // Mapear contatos por orcamentoId
      const contatosPorOrcExcluido: Record<string, typeof contatosExcluidos> = {};
      for (const c of contatosExcluidos) {
        if (!contatosPorOrcExcluido[c.orcamentoId]) contatosPorOrcExcluido[c.orcamentoId] = [];
        contatosPorOrcExcluido[c.orcamentoId].push(c);
      }
      // Montar lista de exclusões com detalhe de faixas
      const blocoH = logsExclusao.map(l => {
        const orcId = l.orcamentoId ?? "";
        const contatosDoOrc = contatosPorOrcExcluido[orcId] ?? [];
        // Calcular quais faixas tinham contato (faixa = numeroContato: 1=F1, 2=F2, 3=F3)
        const numContatos = contatosDoOrc.filter(c => !['perdida','garantiu_fechamento'].includes(c.canal)).length;
        const temFaixa1 = contatosDoOrc.some(c => c.numeroContato === 1 && !['perdida','garantiu_fechamento'].includes(c.canal));
        const temFaixa2 = contatosDoOrc.some(c => c.numeroContato === 2 && !['perdida','garantiu_fechamento'].includes(c.canal));
        const temFaixa3 = contatosDoOrc.some(c => c.numeroContato >= 3 && !['perdida','garantiu_fechamento'].includes(c.canal));
        const faixasCompletas = [temFaixa1, temFaixa2, temFaixa3].filter(Boolean).length;
        return {
          orcamentoId: orcId,
          empresa: l.empresa ?? "",
          vendedor: l.vendedor,
          dataExclusao: l.realizadaEm.toISOString(),
          detalhe: l.detalhe ?? "",
          numContatosAntes: numContatos + 1, // +1 porque o excluído já foi removido
          temFaixa1,
          temFaixa2,
          temFaixa3,
          faixasCompletas,
          todasFaixas: temFaixa1 && temFaixa2 && temFaixa3,
        };
      }).sort((a, b) => new Date(b.dataExclusao).getTime() - new Date(a.dataExclusao).getTime());

      // Totais de exclusões
      const totalExclusoes = blocoH.length;
      const exclusoesComTodasFaixas = blocoH.filter(e => e.todasFaixas).length;
      const exclusoesSemNenhumaFaixa = blocoH.filter(e => !e.temFaixa1 && !e.temFaixa2 && !e.temFaixa3).length;

      return {
        periodo: { inicio: input.dataInicio, fim: input.dataFim },
        vendedorFiltro: input.vendedor ?? null,
        dias,
        vendedores,
        blocoA,
        blocoB,
        blocoC,
        blocoD: limbo.slice(0, 20), // top 20 propostas no limbo
        blocoE: alertasVelocidade,
        blocoF,
        blocoG: diagnostico,
        blocoH,
        resumoExclusoes: { total: totalExclusoes, comTodasFaixas: exclusoesComTodasFaixas, semNenhumaFaixa: exclusoesSemNenhumaFaixa },
      };
    }),

  /**
   * Retorna o log bruto de atividade de um vendedor em um dia específico.
   * Usado para drill-down no calendário.
   */
  getLogDia: protectedProcedure
    .input(z.object({
      vendedor: z.string(),
      data: z.string(), // "YYYY-MM-DD"
    }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const inicio = new Date(input.data + "T03:00:00.000Z"); // 00:00 Brasília = 03:00 UTC
      const fim = new Date(input.data + "T26:59:59.999Z");    // 23:59 Brasília = 02:59 UTC+1d
      const logs = await db.select().from(crmAtividadeLog)
        .where(and(
          eq(crmAtividadeLog.vendedor, input.vendedor),
          sql`${crmAtividadeLog.realizadaEm} >= ${inicio}`,
          sql`${crmAtividadeLog.realizadaEm} <= ${fim}`,
        ))
        .orderBy(crmAtividadeLog.realizadaEm);
      return logs.map(l => ({
        ...l,
        realizadaEm: l.realizadaEm.toISOString(),
        horaBrasilia: (() => {
          const dt = new Date(l.realizadaEm);
          const hBr = ((dt.getUTCHours() - 3) + 24) % 24;
          const mBr = dt.getUTCMinutes();
          return `${String(hBr).padStart(2, "0")}:${String(mBr).padStart(2, "0")}`;
        })(),
      }));
    }),
});
