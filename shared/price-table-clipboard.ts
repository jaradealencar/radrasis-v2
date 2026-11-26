/**
 * Formata números copiados da Tabela de Preços para campos que usam máscara
 * monetária por dígitos (por exemplo, colar "3100" em um campo "0,00" resulta
 * em R$ 31,00). Percentuais mantêm apenas os algarismos do percentual.
 */
export function formatarValorParaColar(value: string): string {
  const original = value.trim();
  if (!original) return "";

  const numeric = original.replace(/[^\d.,-]/g, "");
  if (!numeric) return original;

  const digits = numeric.replace(/\D/g, "");
  if (original.includes("%")) return digits;

  const separators = [...numeric.matchAll(/[.,]/g)];
  const hasCurrencySymbol = /r\$/i.test(original);
  if (separators.length === 0) {
    return hasCurrencySymbol ? `${digits}00` : digits;
  }

  const lastSeparator = separators[separators.length - 1];
  const separatorIndex = lastSeparator.index ?? -1;
  const integerDigits = numeric.slice(0, separatorIndex).replace(/\D/g, "");
  const decimalDigits = numeric.slice(separatorIndex + 1).replace(/\D/g, "");

  // Um grupo de três dígitos após um único separador é tratado como milhar
  // (por exemplo, "1.250"), não como três casas decimais.
  if (separators.length === 1 && decimalDigits.length === 3) {
    return `${integerDigits}${decimalDigits}00`;
  }

  let cents = decimalDigits.slice(0, 2).padEnd(2, "0");
  let amountInCents = BigInt(`${integerDigits || "0"}${cents}`);
  if (decimalDigits.length > 2 && decimalDigits[2] >= "5") {
    amountInCents += 1n;
  }
  return amountInCents.toString();
}
