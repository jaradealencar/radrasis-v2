import { and, count, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { fornecedorCompras, suppliers } from "../../drizzle/schema";
import { getDb } from "../db/db";

export function normalizarNomeFornecedorDocumento(nome: string) {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ").replace(/\b(S A|SA|LTDA|LIMITADA|EIRELI|ME|EPP)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

export function identidadeNfFornecedor(dados: { cnpj?: string | null; chave?: string | null; numero?: string | null; serie?: string | null }) {
  const chave = (dados.chave ?? "").replace(/\D/g, "");
  if (chave.length === 44) return `nfe:${chave}`;
  const cnpj = (dados.cnpj ?? "").replace(/\D/g, "");
  const numero = dados.numero?.trim().replace(/^0+(?=\d)/, "");
  const serie = dados.serie?.trim().replace(/^0+(?=\d)/, "");
  return cnpj.length === 14 && numero && serie ? `nf:${cnpj}:${serie}:${numero}` : null;
}

/** Cotação identifica o fornecedor; somente uma NF identificável registra compra. */
export async function integrarFornecedorDocumento(dados: {
  cnpj?: string | null;
  nome?: string | null;
  criadoPor?: string | null;
  fornecedorId?: number;
  nf?: { chave?: string | null; numero?: string | null; serie?: string | null; dataEmissao?: string | null; valorProdutos?: number | null; origem: string };
}) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
  const chave = dados.nf?.chave?.replace(/\D/g, "");
  const cnpjInformado = (dados.cnpj ?? "").replace(/\D/g, "");
  if (chave?.length === 44 && cnpjInformado.length === 14 && chave.slice(6, 20) !== cnpjInformado) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O CNPJ informado não corresponde ao emitente da chave da NF." });
  }
  let cnpj = cnpjInformado.length === 14 ? cnpjInformado : chave?.length === 44 ? chave.slice(6, 20) : "";
  if (dados.nf && chave?.length === 44) {
    dados = { ...dados, nf: { ...dados.nf, numero: dados.nf.numero || chave.slice(25, 34), serie: dados.nf.serie || chave.slice(22, 25) } };
  }
  const nome = dados.nome?.trim() || "";
  if (!cnpj && !nome && !dados.fornecedorId) return null;
  return db.transaction(async tx => {
    // Serializa a identificação por nome/CNPJ e evita criar dois cadastros em uploads simultâneos.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(714402)`);
    const cadastrados = await tx.select().from(suppliers);
    let fornecedor = dados.fornecedorId ? cadastrados.find(s => s.id === dados.fornecedorId) : undefined;
    if (dados.fornecedorId && !fornecedor) throw new TRPCError({ code: "NOT_FOUND", message: "Fornecedor não encontrado." });
    if (!cnpj && fornecedor?.nfeCnpj) cnpj = fornecedor.nfeCnpj.replace(/\D/g, "");
    if (fornecedor?.nfeCnpj && cnpj.length === 14 && fornecedor.nfeCnpj.replace(/\D/g, "") !== cnpj) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "O CNPJ da NF não corresponde ao fornecedor selecionado." });
    }
    if (!fornecedor && cnpj.length === 14) {
      const exatos = cadastrados.filter(s => s.nfeCnpj?.replace(/\D/g, "") === cnpj);
      if (exatos.length > 1) throw new TRPCError({ code: "CONFLICT", message: "Há fornecedores duplicados com este CNPJ. Revise os cadastros." });
      fornecedor = exatos[0];
    }
    if (!fornecedor && nome) {
      const nomeNormalizado = normalizarNomeFornecedorDocumento(nome);
      const candidatos = cadastrados.filter(s => (!cnpj || !s.nfeCnpj || s.nfeCnpj.replace(/\D/g, "") === cnpj) &&
        [s.name, s.company, s.nfeRazaoSocial, s.nfeNomeFantasia].some(n => n && normalizarNomeFornecedorDocumento(n) === nomeNormalizado));
      if (candidatos.length > 1) throw new TRPCError({ code: "CONFLICT", message: "Mais de um fornecedor corresponde ao documento. Preencha o CNPJ nos cadastros para identificar corretamente." });
      fornecedor = candidatos[0];
    }
    let criado = false;
    if (!fornecedor) {
      [fornecedor] = await tx.insert(suppliers).values({
        name: (nome || `Fornecedor ${cnpj}`).slice(0, 128), company: nome.slice(0, 128) || null,
        category: "Outros", nfeCnpj: cnpj.length === 14 ? cnpj : null,
        nfeRazaoSocial: nome.slice(0, 256) || null, cadastroConcluido: false,
        createdByNome: (dados.criadoPor || "Leitura de documento").slice(0, 128),
      }).returning();
      criado = true;
    } else if (!fornecedor.nfeCnpj && cnpj.length === 14) {
      await tx.update(suppliers).set({ nfeCnpj: cnpj, updatedAt: new Date() }).where(eq(suppliers.id, fornecedor.id));
    }
    let compraRegistrada = false;
    const documento = dados.nf ? identidadeNfFornecedor({ cnpj, ...dados.nf }) : null;
    if (dados.nf && documento) {
      // A mesma NF pode entrar com chave no XML e só número/série no PDF.
      const alternativa = identidadeNfFornecedor({ cnpj, numero: dados.nf.numero, serie: dados.nf.serie });
      const [existente] = await tx.select().from(fornecedorCompras).where(sql`${fornecedorCompras.documento} IN (${documento}, ${alternativa ?? documento})`);
      if (existente && existente.fornecedorId !== fornecedor.id) {
        throw new TRPCError({ code: "CONFLICT", message: "Esta NF já está registrada em outro cadastro de fornecedor. Revise os cadastros duplicados." });
      }
      const [porNumero] = dados.nf.numero && dados.nf.serie ? await tx.select().from(fornecedorCompras).where(and(
        eq(fornecedorCompras.fornecedorId, fornecedor.id),
        sql`ltrim(${fornecedorCompras.numero}, '0') = ${dados.nf.numero.trim().replace(/^0+/, "")}`,
        sql`ltrim(${fornecedorCompras.serie}, '0') = ${dados.nf.serie.trim().replace(/^0+/, "")}`
      )).limit(1) : [];
      if (!existente && !porNumero) {
        await tx.insert(fornecedorCompras).values({ fornecedorId: fornecedor.id, documento,
          numero: dados.nf.numero, serie: dados.nf.serie, dataEmissao: dados.nf.dataEmissao,
          valorProdutos: dados.nf.valorProdutos == null ? null : String(dados.nf.valorProdutos), origem: dados.nf.origem,
        }).onConflictDoNothing();
        compraRegistrada = true;
      }
    }
    const [total] = await tx.select({ quantidade: count() }).from(fornecedorCompras).where(eq(fornecedorCompras.fornecedorId, fornecedor.id));
    return { id: fornecedor.id, nome: fornecedor.company || fornecedor.name, criado,
      cadastroConcluido: fornecedor.cadastroConcluido, totalCompras: total.quantidade,
      compraRegistrada, nfSemIdentificacao: Boolean(dados.nf && !documento) };
  });
}
