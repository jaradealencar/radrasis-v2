/**
 * Calcula a data final adicionando dias úteis (pulando fins de semana) a uma data inicial.
 * @param dataInicial - Data de início (Date ou timestamp em ms)
 * @param diasUteis - Número de dias úteis a adicionar
 * @returns Data final como Date
 */
export function adicionarDiasUteis(dataInicial: Date | number, diasUteis: number): Date {
  const data = dataInicial instanceof Date ? new Date(dataInicial) : new Date(dataInicial);
  let diasAdicionados = 0;

  while (diasAdicionados < diasUteis) {
    data.setDate(data.getDate() + 1);
    const diaSemana = data.getDay();
    // 0 = domingo, 6 = sábado
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasAdicionados++;
    }
  }

  return data;
}

/**
 * Formata uma data no padrão dd/mm/yyyy.
 * @param data - Data a formatar
 * @returns String formatada
 */
export function formatarData(data: Date | number): string {
  const d = data instanceof Date ? data : new Date(data);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

/**
 * Converte "X DIAS ÚTEIS" ou "X dias úteis" em número.
 * @param texto - Texto no formato "X DIAS ÚTEIS" ou "X dias úteis"
 * @returns Número de dias úteis, ou null se não conseguir extrair
 */
export function extrairDiasUteis(texto: string): number | null {
  const match = texto.match(/(\d+)\s*(?:DIAS|dias)\s*(?:ÚTEIS|úteis|UTEIS|uteis)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Calcula a data de entrega a partir da data de aprovação e dias úteis.
 * Se o texto for "X DIAS ÚTEIS", converte para data. Caso contrário, retorna o texto original.
 * @param dataAprovacao - Data de aprovação (Date, timestamp em ms, ou string dd/mm/yyyy)
 * @param textoPrazo - Texto do prazo (ex: "10 DIAS ÚTEIS", "26/07/2026", etc)
 * @returns Data formatada (dd/mm/yyyy) ou o texto original se não for "X DIAS ÚTEIS"
 */
export function calcularDataEntrega(
  dataAprovacao: Date | number | string,
  textoPrazo: string
): string {
  const diasUteis = extrairDiasUteis(textoPrazo);

  if (diasUteis === null) {
    // Não é "X DIAS ÚTEIS", retorna o texto original (pode ser uma data ou outro formato)
    return textoPrazo;
  }

  // Converter dataAprovacao para Date
  let data: Date;
  if (typeof dataAprovacao === "string") {
    // Esperado formato dd/mm/yyyy
    const [dia, mes, ano] = dataAprovacao.split("/").map(Number);
    data = new Date(ano, mes - 1, dia);
  } else if (typeof dataAprovacao === "number") {
    data = new Date(dataAprovacao);
  } else {
    data = dataAprovacao;
  }

  const dataEntrega = adicionarDiasUteis(data, diasUteis);
  return formatarData(dataEntrega);
}
