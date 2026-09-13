/**
 * Dias úteis (seg-sex, sem descontar feriados — o sistema não tem calendário
 * de feriados) para calibrar prazos de follow-up comercial. Isomórfico
 * (client + server): funções puras, sem I/O, sem dependência de fuso horário
 * além do relógio local do ambiente onde rodam.
 */

export function ehDiaUtil(d: Date): boolean {
  const diaSemana = d.getDay(); // 0 = domingo, 6 = sábado
  return diaSemana !== 0 && diaSemana !== 6;
}

/** Soma `diasUteis` dias úteis a `dataInicial` (não conta o próprio dia inicial). */
export function adicionarDiasUteis(dataInicial: Date | number, diasUteis: number): Date {
  const data = new Date(dataInicial);
  let diasAdicionados = 0;
  while (diasAdicionados < diasUteis) {
    data.setDate(data.getDate() + 1);
    if (ehDiaUtil(data)) diasAdicionados++;
  }
  return data;
}

/** Conta os dias úteis estritamente entre `inicio` e `fim` — cada dia de
 * semana de (inicio, fim], sem contar o próprio dia inicial. Se `fim` for
 * anterior ou igual a `inicio`, retorna 0. */
export function diasUteisEntre(inicio: Date, fim: Date): number {
  if (fim <= inicio) return 0;
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const alvo = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  let count = 0;
  while (cursor < alvo) {
    cursor.setDate(cursor.getDate() + 1);
    if (ehDiaUtil(cursor)) count++;
  }
  return count;
}

/** Gera as próximas `quantidade` datas úteis após `dataInicial` (D+1º dia
 * útil, D+2º dia útil, ...), na ordem. Usada para listar as datas de contato
 * de cada faixa de follow-up a partir da data de criação da proposta. */
export function gerarDatasUteis(dataInicial: Date, quantidade: number): Date[] {
  const datas: Date[] = [];
  const cursor = new Date(dataInicial);
  while (datas.length < quantidade) {
    cursor.setDate(cursor.getDate() + 1);
    if (ehDiaUtil(cursor)) datas.push(new Date(cursor));
  }
  return datas;
}
