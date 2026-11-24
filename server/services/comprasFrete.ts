import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db/db";
import {
  comprasOrdens,
  comprasCotacoes,
  comprasOrdemNfs,
  nfCompraImportacoes,
} from "../../drizzle/schema";
import {
  calcularFreteCompra,
  validarFreteNf,
  type FreteCompraSnapshot,
} from "../../shared/compras-frete";

type Executor = Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "select">;
export function fornecedorDaOrdemConfere(
  ordem: { cnpjFornecedor: string | null; fornecedor: string },
  nf: { cnpjFornecedor: string; nomeFornecedor?: string | null }
) {
  const cnpj = (s: string | null) => (s ?? "").replace(/\D/g, "");
  const nome = (s: string | null | undefined) =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .replace(/\b(S A|SA|LTDA|EPP|ME|LIMITADA)\b/g, "")
      .replace(/[^A-Z0-9]/g, "");
  return ordem.cnpjFornecedor && cnpj(ordem.cnpjFornecedor).length === 14
    ? cnpj(ordem.cnpjFornecedor) === cnpj(nf.cnpjFornecedor)
    : Boolean(
        nome(ordem.fornecedor) &&
        nome(ordem.fornecedor) === nome(nf.nomeFornecedor)
      );
}
export async function consultarOrdemFrete(
  db: Executor,
  id: number,
  travar = false
) {
  let query = db
    .select({
      ordem: comprasOrdens,
      fornecedor: comprasCotacoes.fornecedor,
      cnpjFornecedor: comprasCotacoes.cnpjFornecedor,
    })
    .from(comprasOrdens)
    .innerJoin(comprasCotacoes, eq(comprasCotacoes.id, comprasOrdens.cotacaoId))
    .where(eq(comprasOrdens.id, id));
  const [dados] = await (travar
    ? query.for("update", { of: comprasOrdens })
    : query);
  if (!dados || dados.ordem.excluidaEm)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Ordem de compra não encontrada.",
    });
  const vinculadas = await db
    .select({
      nf: nfCompraImportacoes,
      snapshot: comprasOrdemNfs.logisticaSnapshot,
    })
    .from(comprasOrdemNfs)
    .innerJoin(
      nfCompraImportacoes,
      eq(nfCompraImportacoes.id, comprasOrdemNfs.importacaoId)
    )
    .where(eq(comprasOrdemNfs.ordemId, id));
  const utilizado = vinculadas.reduce(
    (s, v) => s + Number(v.snapshot?.freteAplicado ?? v.nf.valorFreteNf),
    0
  );
  return {
    ...dados,
    utilizado,
    saldo: Math.max(
      0,
      Math.round((Number(dados.ordem.frete) - utilizado) * 100) / 100
    ),
    vinculadas,
  };
}
export function snapshotFreteNf(
  dados: Awaited<ReturnType<typeof consultarOrdemFrete>>,
  aplicado: number,
  peso: number | null
): FreteCompraSnapshot {
  try {
    const modo = dados.ordem.freteModo as "valor_total" | "por_kg" | "gratis" | "cif";
    const tarifa =
      dados.ordem.freteValorInformado == null
        ? Number(dados.ordem.frete)
        : Number(dados.ordem.freteValorInformado);
    const total =
      modo === "valor_total" || modo === "cif"
        ? aplicado
        : calcularFreteCompra(modo, tarifa, peso).total;
    if (total == null)
      throw new Error(
        "Informe o peso da NF para calcular o frete por kg acordado na ordem."
      );
    const calculo = validarFreteNf({
      totalOrdem: Number(dados.ordem.frete),
      utilizado: dados.utilizado,
      aplicado: total,
      pesoKg: peso,
      confirmado: dados.ordem.freteConfirmado,
      modo,
    });
    return {
      revisao: dados.ordem.logisticaRevisao,
      freteOrdem: Number(dados.ordem.frete),
      freteAplicado: calculo.aplicado,
      pesoNfKg: peso,
      valorPorKg: calculo.valorPorKg,
      transportadora: dados.ordem.transportadora,
      numeroColeta: dados.ordem.numeroColeta,
      modo,
      tarifaKg: modo === "por_kg" ? tarifa : null,
    };
  } catch (e) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: e instanceof Error ? e.message : "Confira o frete da ordem.",
    });
  }
}
