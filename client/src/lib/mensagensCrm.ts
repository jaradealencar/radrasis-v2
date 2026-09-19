/**
 * Preenchimento das mensagens (scripts) do CRM com os dados da proposta.
 *
 * Os scripts cadastrados usam tanto o formato `{nome_cliente}` quanto marcadores com colchetes
 * como `[Nome]` — os dois são aceitos.
 */

export interface VariaveisMensagem {
  nomeCliente?: string;
  produto?: string;
  valor?: string;
  vendedor?: string;
}

const MARCADORES = {
  nomeCliente: /\{nome_cliente\}|\[(?:nome(?: do cliente)?|nome_cliente|cliente)\]/gi,
  produto: /\{produto\}|\[produto\]/gi,
  valor: /\{valor\}|\[valor\]/gi,
  vendedor: /\{vendedor\}|\[(?:vendedor|vendedora)\]/gi,
} as const;

/** Troca os marcadores pelos valores. Sem valor para um marcador, ele fica como está no texto. */
export function substituirVariaveis(texto: string, vars: VariaveisMensagem): string {
  let saida = texto;
  for (const chave of Object.keys(MARCADORES) as Array<keyof typeof MARCADORES>) {
    const valor = vars[chave];
    if (valor) saida = saida.replace(MARCADORES[chave], () => valor);
  }
  return saida;
}

/**
 * Só o primeiro nome do contato, com a inicial maiúscula: "JOSE" → "Jose"; "Jorge / Alexandre" →
 * "Jorge"; "Tadeu Mota" → "Tadeu". Vazio quando não há nome.
 */
export function primeiroNome(contato: string | null | undefined): string {
  const primeiro = (contato ?? "").split(/[\/,;&]/)[0].trim().split(/\s+/)[0] ?? "";
  return primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : "";
}
