import { normalizarTelefone } from "./campanhas-whatsapp";

/**
 * Normaliza a chave de identidade do contato para E.164.
 *
 * Números sem DDI são tratados como brasileiros e passam pela validação usada
 * pelo módulo atual. Números internacionais precisam trazer `+` ou `00`.
 * Para DDIs diferentes de 55, a função valida o formato E.164 (8 a 15 dígitos),
 * mas não consulta operadora nem confirma que a linha está ativa.
 */
export function normalizarTelefoneContato(valor: unknown): string | null {
  const original = String(valor ?? "").trim();
  if (!original || original.length > 40 || /[/;,|]|\s+e\s+/i.test(original)) return null;

  const internacional = original.startsWith("+") || original.startsWith("00");
  if (!internacional) {
    const brasil = normalizarTelefone(original);
    return brasil ? `+${brasil}` : null;
  }

  let digitos = original.replace(/\D/g, "");
  if (original.startsWith("00")) digitos = digitos.slice(2);
  if (!/^[1-9]\d{7,14}$/.test(digitos)) return null;

  // Para o DDI brasileiro preservamos a validação de DDD e o ajuste histórico
  // do nono dígito usado pelas campanhas locais.
  if (digitos.startsWith("55")) {
    const brasil = normalizarTelefone(digitos);
    return brasil ? `+${brasil}` : null;
  }

  return `+${digitos}`;
}

/** Remove caracteres de um E.164 já normalizado para comparação no SQL. */
export function chaveTelefoneContato(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Variantes de busca no ERP, incluindo registros brasileiros que ainda não têm o 9º dígito. */
export function variantesTelefoneContato(telefonesE164: readonly string[]): string[] {
  const variantes = new Set<string>();
  for (const telefone of telefonesE164) {
    const digitos = chaveTelefoneContato(telefone);
    if (!digitos) continue;
    variantes.add(digitos);
    if (!digitos.startsWith("55")) continue;
    const local = digitos.slice(2);
    variantes.add(local);
    if (local.length === 11 && local[2] === "9") {
      const legado = `${local.slice(0, 2)}${local.slice(3)}`;
      variantes.add(legado);
      variantes.add(`55${legado}`);
    }
  }
  return [...variantes];
}

/** Mantém as grafias originais sem repetir valores idênticos. */
export function juntarTelefonesOriginais(atuais: readonly string[], novo: string): string[] {
  const resultado = [...atuais];
  if (!resultado.includes(novo)) resultado.push(novo);
  return resultado;
}
