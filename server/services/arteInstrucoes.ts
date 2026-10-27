import type { Request } from "express";

/** Cabeçalho codificado para preservar acentos sem colocar o briefing na URL. */
export function lerInstrucoesArte(req: Request): string {
  const raw = req.get("x-arte-instrucoes") ?? "";
  if (raw.length > 24_000)
    throw new Error("Descreva o ajuste em até 2.000 caracteres.");
  let value: string;
  try {
    value = decodeURIComponent(raw).trim();
  } catch {
    throw new Error("A descrição do ajuste é inválida.");
  }
  if (value.length > 2_000)
    throw new Error("Descreva o ajuste em até 2.000 caracteres.");
  return value;
}
