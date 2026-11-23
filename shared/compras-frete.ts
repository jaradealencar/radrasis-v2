import { z } from "zod";

export const logisticaCompraSchema = z.object({
  ordemId: z.number().int().positive(),
  revisao: z.number().int().nonnegative(),
  frete: z.number().finite().nonnegative().max(1e9),
  freteModo: z.enum(["valor_total", "por_kg", "gratis"]).default("valor_total"),
  freteValorInformado: z
    .number()
    .finite()
    .nonnegative()
    .max(1e9)
    .nullable()
    .default(null),
  freteConfirmado: z.boolean(),
  pesoPrevistoKg: z.number().finite().positive().max(1e9).nullable(),
  transportadora: z.string().trim().max(256),
  numeroColeta: z.string().trim().max(128),
});
export type FreteCompraSnapshot = {
  revisao: number;
  freteOrdem: number;
  freteAplicado: number;
  pesoNfKg: number | null;
  valorPorKg: number | null;
  transportadora: string;
  numeroColeta: string;
  modo?: "valor_total" | "por_kg" | "gratis";
  tarifaKg?: number | null;
};
export function calcularFreteCompra(
  modo: "valor_total" | "por_kg" | "gratis",
  valor: number | null,
  peso: number | null
) {
  if (modo === "gratis") return { total: 0, pendente: false };
  if (valor == null || !Number.isFinite(valor) || valor < 0)
    return { total: null, pendente: true };
  if (modo === "valor_total")
    return { total: Math.round(valor * 100) / 100, pendente: false };
  if (peso == null || !Number.isFinite(peso) || peso <= 0)
    return { total: null, pendente: true };
  return { total: Math.round(valor * peso * 100) / 100, pendente: false };
}
export function resumoFreteCompra(
  total: number,
  utilizado: number,
  pesoKg: number | null
) {
  if (
    !Number.isFinite(total) ||
    total < 0 ||
    !Number.isFinite(utilizado) ||
    utilizado < 0
  )
    throw new Error("Valores de frete inválidos.");
  return {
    total,
    utilizado,
    saldo: Math.max(0, Math.round((total - utilizado) * 100) / 100),
    valorPorKg:
      pesoKg != null && Number.isFinite(pesoKg) && pesoKg > 0
        ? total / pesoKg
        : null,
  };
}
export function validarFreteNf(args: {
  totalOrdem: number;
  utilizado: number;
  aplicado: number;
  pesoKg: number | null;
  confirmado: boolean;
  modo?: string;
}) {
  if (!args.confirmado)
    throw new Error(
      "Confirme o frete na ordem de compra antes de lançar a NF (inclusive frete grátis)."
    );
  if (!Number.isFinite(args.aplicado) || args.aplicado < 0)
    throw new Error("Informe um valor de frete válido para esta NF.");
  const resumo = resumoFreteCompra(
    args.totalOrdem,
    args.utilizado,
    args.pesoKg
  );
  if (args.modo !== "por_kg" && args.aplicado > resumo.saldo + 0.001)
    throw new Error(
      "O frete desta NF excede o saldo disponível na ordem de compra."
    );
  if (
    args.aplicado > 0 &&
    !(args.pesoKg != null && Number.isFinite(args.pesoKg) && args.pesoKg > 0)
  )
    throw new Error("Informe o peso da NF em kg para calcular o frete por kg.");
  return {
    ...resumo,
    aplicado: Math.round(args.aplicado * 100) / 100,
    valorPorKg:
      args.pesoKg && args.pesoKg > 0 ? args.aplicado / args.pesoKg : null,
  };
}
