/**
 * Capitalização de nome próprio (ex.: "ANA KAROLINE" → "Ana Karoline"),
 * tratando conectores comuns em português que ficam minúsculos ("de", "da",
 * "do", "dos", "das", "e"). Isomórfico, sem I/O — usado pelo módulo de
 * Retenção de Clientes Novos para exibir o nome do contato como veio da API
 * MubiSys (normalmente em CAIXA ALTA).
 */

const CONECTORES_MINUSCULOS = new Set(["de", "da", "do", "das", "dos", "e"]);

export function capitalizarNomeProprio(nome: string): string {
  const texto = (nome ?? "").trim();
  if (!texto) return "";
  return texto
    .toLowerCase()
    .split(/\s+/)
    .map((palavra, idx) => {
      if (idx > 0 && CONECTORES_MINUSCULOS.has(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(" ");
}

/** Primeiro nome, já capitalizado (ex.: "ANA KAROLINE SILVA" → "Ana"). */
export function primeiroNome(nomeCompleto: string): string {
  const capitalizado = capitalizarNomeProprio(nomeCompleto);
  return capitalizado.split(" ")[0] ?? "";
}
