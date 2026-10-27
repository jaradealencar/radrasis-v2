import type { Response } from "express";

export type ArteUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
};
export function informarUsoArte(
  res: Response,
  usage?: ArteUsage,
  credits?: string | null
): void {
  // Somente contagens numéricas. Nenhum payload, prompt ou segredo vai para o cabeçalho.
  const numero = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
  res.setHeader(
    "X-Arte-Uso",
    JSON.stringify({
      entrada: numero(usage?.input_tokens ?? usage?.prompt_tokens),
      saida: numero(usage?.output_tokens ?? usage?.completion_tokens),
      total: numero(usage?.total_tokens),
      creditos:
        credits != null && Number.isFinite(Number(credits))
          ? Number(credits)
          : null,
    })
  );
}
