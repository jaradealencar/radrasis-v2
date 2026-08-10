import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { and, desc, eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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
  if (!_db) _db = drizzle(process.env.DATABASE_URL!);
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
    }))
    .mutation(async ({ input }) => {
      const [result] = await db.insert(transportadoras).values(input as any);
      return { id: (result as any).insertId };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().optional(),
      site: z.string().optional(),
      endereco: z.string().optional(),
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
});

// ─── COTAÇÕES DE FRETE ────────────────────────────────────────────────────────

// Busca dados do cliente no Mubisys pelo número da OS
async function fetchDadosOsMub(numeroOs: string): Promise<{ nomeCliente: string; cnpj: string; cep: string; endereco: string; cidade: string; estado: string; valorNf: string; vendedor: string; dataEntregaPrevista: string } | null> {
  const publicKey = process.env.MUBISYS_PUBLIC_KEY ?? "";
  const accessToken = process.env.MUBISYS_ACCESS_TOKEN ?? "";
  if (!publicKey || !accessToken) return null;
  try {
    const url = `https://api.mubisys.com/api/${publicKey}/ordem-servico/numero/${encodeURIComponent(numeroOs)}`;
    const data = await new Promise<string>((resolve, reject) => {
      const req = https.get(url, { headers: { "Access-Token": accessToken, "Accept": "application/json" } }, (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => body += chunk);
        res.on("end", () => resolve(body));
      });
      req.on("error", reject);
      req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
    });
    const json = JSON.parse(data);
    if (!json || json.error || !json.cliente) return null;
    const clienteStr: string = json.cliente ?? "";

    // Tentar campo dedicado de CNPJ/CPF primeiro (alguns endpoints retornam cnpj_cpf ou documento)
    let cnpj = "";
    let nomeCliente = clienteStr.trim();
    const cnpjDedicado: string = json.cnpj_cpf ?? json.cnpj ?? json.cpf_cnpj ?? json.documento ?? "";
    if (cnpjDedicado) {
      const nums = cnpjDedicado.replace(/\D/g, "");
      if (nums.length === 14) {
        cnpj = nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
      } else if (nums.length === 11) {
        cnpj = nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      } else if (nums.length > 0) {
        cnpj = cnpjDedicado.trim();
      }
    }

    // Se não encontrou campo dedicado, tentar extrair do início da string cliente
    // Formato Mubisys: "54.324.273 NOME DO CLIENTE" ou "12.345.678/0001-99 NOME"
    if (!cnpj) {
      // Tenta CNPJ completo (14 dígitos com pontuação) no início
      const cnpjInicioMatch = clienteStr.match(/^(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s/);
      if (cnpjInicioMatch) {
        cnpj = cnpjInicioMatch[1];
        nomeCliente = clienteStr.replace(cnpjInicioMatch[0], "").trim();
      } else {
        // Tenta sequência de dígitos/pontos no início (CNPJ parcial ou CPF)
        const numInicioMatch = clienteStr.match(/^([\d.\/-]{8,20})\s/);
        if (numInicioMatch) {
          const nums = numInicioMatch[1].replace(/\D/g, "");
          if (nums.length >= 8) {
            cnpj = numInicioMatch[1].trim();
            nomeCliente = clienteStr.replace(numInicioMatch[0], "").trim();
          }
        }
      }
    }

    // Fallback: tentar extrair qualquer sequência numérica que pareça CNPJ/CPF em qualquer posição
    if (!cnpj) {
      const cnpjQualquerMatch = clienteStr.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{0,4}-?\d{0,2})/);
      if (cnpjQualquerMatch) {
        cnpj = cnpjQualquerMatch[0].trim();
        nomeCliente = clienteStr.replace(cnpjQualquerMatch[0], "").trim();
      }
    }
    const enderecos: any[] = json.cliente_endereco ?? [];
    const end = enderecos[0] ?? {};
    const cep = (end.cep ?? "").replace(/\D/g, "");
    const endereco = [end.logradouro, end.numero, end.complemento, end.bairro].filter(Boolean).join(", ");
    // Extrair valor total (usado como valor da NF)
    const valorNf = json.valor_total ? String(Number(json.valor_total).toFixed(2)) : "";
    // Extrair nome do vendedor
    const vendedor = json.vendedor ?? "";
    // ── BUSCAR CNPJ VIA ENDPOINT DEDICADO DE CLIENTE ──────────────────────────
    // A OS não retorna cnpj_cpf diretamente. O ID do cliente está em cliente_endereco[0].id
    // Endpoint: GET /api/{publicKey}/cliente/{clienteId} → retorna cnpj_cpf
    console.log(`[Mubisys] OS ${numeroOs} → cliente="${clienteStr}" end.id=${end.id} cnpj_inicial="${cnpj}"`);
    if (!cnpj && end.id) {
      try {
        const clienteUrl = `https://api.mubisys.com/api/${publicKey}/cliente/${end.id}`;
        const clienteData = await new Promise<string>((resolve, reject) => {
          const req2 = https.get(clienteUrl, { headers: { "Access-Token": accessToken, "Accept": "application/json" } }, (res2) => {
            let body2 = "";
            res2.on("data", (c: Buffer) => body2 += c);
            res2.on("end", () => resolve(body2));
          });
          req2.on("error", reject);
          req2.setTimeout(6000, () => { req2.destroy(); reject(new Error("timeout")); });
        });
        const clienteJson = JSON.parse(clienteData);
        const cnpjRaw: string = clienteJson.cnpj_cpf ?? clienteJson.cnpj ?? clienteJson.documento ?? "";
        if (cnpjRaw) {
          const nums = cnpjRaw.replace(/\D/g, "");
          if (nums.length === 14) {
            cnpj = nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
          } else if (nums.length === 11) {
            cnpj = nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
          } else if (nums.length > 0) {
            cnpj = cnpjRaw.trim();
          }
        }
        // Usar razao_social como nome se ainda não temos
        if (!nomeCliente && clienteJson.razao_social) nomeCliente = clienteJson.razao_social;
        console.log(`[Mubisys] cliente/${end.id} → cnpj="${cnpj}" nome="${nomeCliente}"`);
      } catch(e: any) { console.warn(`[Mubisys] Erro ao buscar cliente/${end.id}:`, e.message); }
    }
    const dataEntregaPrevista: string = json.data_entrega ?? "";
    return { nomeCliente, cnpj, cep, endereco, cidade: end.cidade ?? "", estado: end.estado ?? "", valorNf, vendedor, dataEntregaPrevista };
  } catch { return null; }
}

export const cotacoesFreteRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      solicitanteId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      let rows = await db.select().from(cotacoesFrete).orderBy(desc(cotacoesFrete.createdAt));
      if (input.status) rows = rows.filter(r => r.status === input.status);
      if (input.solicitanteId) rows = rows.filter(r => r.solicitanteId === input.solicitanteId);
      // Enriquecer com opções
      const opcoes = await db.select().from(cotacaoOpcoes);
      // Buscar dados do pedido de empacotamento vinculado (CNPJ, CEP, endereço)
      const pedidoIds = Array.from(new Set(rows.filter(r => r.empacotamentoPedidoId).map(r => r.empacotamentoPedidoId!)));
      let pedidosMap: Record<number, { cnpjCliente: string | null; cepCliente: string | null; enderecoCliente: string | null }> = {};
      if (pedidoIds.length > 0) {
        const pedidos = await db.select().from(empacotamentoPedidos);
        pedidos.forEach((p: any) => {
          pedidosMap[p.id] = { cnpjCliente: p.cnpjCliente ?? null, cepCliente: p.cepCliente ?? null, enderecoCliente: p.enderecoCliente ?? null };
        });
      }
      return rows.map(c => ({
        ...c,
        opcoes: opcoes.filter(o => o.cotacaoId === c.id),
        pedidoCnpj: c.empacotamentoPedidoId ? (pedidosMap[c.empacotamentoPedidoId]?.cnpjCliente ?? null) : null,
        pedidoCep: c.empacotamentoPedidoId ? (pedidosMap[c.empacotamentoPedidoId]?.cepCliente ?? null) : null,
        pedidoEndereco: c.empacotamentoPedidoId ? (pedidosMap[c.empacotamentoPedidoId]?.enderecoCliente ?? null) : null,
      }));
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [c] = await db.select().from(cotacoesFrete).where(eq(cotacoesFrete.id, input.id));
      if (!c) throw new Error("Cotação não encontrada");
      const opcoes = await db.select().from(cotacaoOpcoes).where(eq(cotacaoOpcoes.cotacaoId, input.id));
      const comentarios = await db.select().from(cotacaoComentarios)
        .where(eq(cotacaoComentarios.cotacaoId, input.id))
        .orderBy(cotacaoComentarios.createdAt);
      return { ...c, opcoes, comentarios };
    }),

  create: publicProcedure
    .input(z.object({
      solicitanteId: z.number().optional(),
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
    }))
    .mutation(async ({ input }) => {
      const [result] = await db.insert(cotacoesFrete).values(input as any);
      return { id: (result as any).insertId };
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
    }))
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;
      await db.update(cotacoesFrete)
        .set(fields as any)
        .where(eq(cotacoesFrete.id, id));
      return { ok: true };
    }),

  listMinhas: publicProcedure
    .input(z.object({ solicitanteId: z.number().optional(), solicitanteNome: z.string().optional() }))
    .query(async ({ input }) => {
      let rows = await db.select().from(cotacoesFrete).orderBy(desc(cotacoesFrete.createdAt));
      if (input.solicitanteId) {
        rows = rows.filter(r => r.solicitanteId === input.solicitanteId);
      } else if (input.solicitanteNome) {
        const nome = input.solicitanteNome.toLowerCase().trim();
        rows = rows.filter(r => (r.solicitanteNome ?? "").toLowerCase().trim() === nome);
      }
      const opcoes = await db.select().from(cotacaoOpcoes);
      return rows.map(c => ({
        ...c,
        opcoes: opcoes.filter(o => o.cotacaoId === c.id),
      }));
    }),

  updateStatus: publicProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["fila", "em_cotacao", "pronto", "concluido", "cancelado"]),
    }))
    .mutation(async ({ input }) => {
      const updateData: any = { status: input.status };
      if (input.status === "concluido") {
        updateData.dataDespacho = new Date();
      }
      await db.update(cotacoesFrete)
        .set(updateData)
        .where(eq(cotacoesFrete.id, input.id));
      return { ok: true };
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
      await db.insert(cotacaoOpcoes).values(input as any);
      return { ok: true };
    }),

  selecionarOpcao: publicProcedure
    .input(z.object({ cotacaoId: z.number(), opcaoId: z.number() }))
    .mutation(async ({ input }) => {
      // Desmarcar todas as opções da cotação
      await db.update(cotacaoOpcoes)
        .set({ selecionada: "nao" })
        .where(eq(cotacaoOpcoes.cotacaoId, input.cotacaoId));
      // Marcar a opção selecionada
      await db.update(cotacaoOpcoes)
        .set({ selecionada: "sim" })
        .where(eq(cotacaoOpcoes.id, input.opcaoId));
      // Buscar a opção para pegar transportadoraId
      const [opcao] = await db.select().from(cotacaoOpcoes).where(eq(cotacaoOpcoes.id, input.opcaoId));
      await db.update(cotacoesFrete)
        .set({ status: "concluido", transportadoraSelecionadaId: opcao?.transportadoraId ?? null })
        .where(eq(cotacoesFrete.id, input.cotacaoId));
      return { ok: true };
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
      await db.delete(cotacaoOpcoes).where(eq(cotacaoOpcoes.cotacaoId, input.id));
      await db.delete(cotacaoComentarios).where(eq(cotacaoComentarios.cotacaoId, input.id));
      await db.delete(cotacoesFrete).where(eq(cotacoesFrete.id, input.id));
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
    const concluidas = todas.filter(c => c.status === "concluido").length;
    const emAndamento = todas.filter(c => ["fila", "em_cotacao", "pronto"].includes(c.status)).length;
    const fila = todas.filter(c => c.status === "fila").length;
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
      // 1. Tentar Mubisys pelo número da OS
      if (input.numeroOs) {
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
        .where(eq(cotacoesFrete.status, "concluido"))
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
        .where(eq(cotacoesFrete.status, "concluido"));
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
      } as any);
      return { id: (result as any).insertId };
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
});
