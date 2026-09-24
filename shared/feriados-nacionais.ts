/**
 * Feriados nacionais (Brasil) para o cálculo de "dias úteis" do módulo de
 * Retenção de Clientes Novos. Isomórfico (client+server), sem I/O.
 *
 * Calculados por fórmula a partir do ano (Páscoa via algoritmo de
 * Meeus/Jones/Butcher) em vez de uma lista fixa por ano — funciona para
 * qualquer ano sem manutenção anual. Usado só neste módulo: não altera
 * `shared/dias-uteis.ts` (usado por produção/logística), que continua
 * contando só seg-sex de propósito.
 */

/** Domingo de Páscoa do ano informado. */
function calcularPascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function somarDias(d: Date, dias: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
}

const cacheFeriadosPorAno = new Map<number, Set<string>>();

/** Feriados nacionais fixos + móveis do ano, como chaves "aaaa-mm-dd". */
export function feriadosNacionaisDoAno(ano: number): Set<string> {
  const cache = cacheFeriadosPorAno.get(ano);
  if (cache) return cache;

  const pascoa = calcularPascoa(ano);
  const feriados = new Set<string>([
    `${ano}-01-01`, // Confraternização Universal
    `${ano}-04-21`, // Tiradentes
    `${ano}-05-01`, // Dia do Trabalho
    `${ano}-09-07`, // Independência
    `${ano}-10-12`, // Nossa Senhora Aparecida
    `${ano}-11-02`, // Finados
    `${ano}-11-15`, // Proclamação da República
    `${ano}-11-20`, // Consciência Negra (Lei 14.759/2023)
    `${ano}-12-25`, // Natal
    chaveDia(somarDias(pascoa, -48)), // Segunda de Carnaval
    chaveDia(somarDias(pascoa, -47)), // Terça de Carnaval
    chaveDia(somarDias(pascoa, -2)),  // Sexta-feira Santa
  ]);

  cacheFeriadosPorAno.set(ano, feriados);
  return feriados;
}

export function ehFeriadoNacional(d: Date): boolean {
  return feriadosNacionaisDoAno(d.getFullYear()).has(chaveDia(d));
}

/** Como `ehDiaUtil` de shared/dias-uteis.ts, mas também descontando feriados nacionais. */
export function ehDiaUtilComFeriados(d: Date): boolean {
  const diaSemana = d.getDay();
  if (diaSemana === 0 || diaSemana === 6) return false;
  return !ehFeriadoNacional(d);
}

/** Soma `diasUteis` dias úteis (seg-sex, sem feriado nacional) a `dataInicial`
 * (não conta o próprio dia inicial) — usado pela jornada de retenção para
 * calcular a data do marco "16 dias úteis". */
export function adicionarDiasUteisComFeriados(dataInicial: Date | number, diasUteis: number): Date {
  const data = new Date(dataInicial);
  let diasAdicionados = 0;
  while (diasAdicionados < diasUteis) {
    data.setDate(data.getDate() + 1);
    if (ehDiaUtilComFeriados(data)) diasAdicionados++;
  }
  return data;
}

/** Dias úteis (seg-sex, sem feriado nacional) estritamente entre `inicio` e
 * `fim` — cada dia útil de (inicio, fim], sem contar o próprio dia inicial. */
export function diasUteisComFeriadosEntre(inicio: Date, fim: Date): number {
  if (fim <= inicio) return 0;
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const alvo = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  let count = 0;
  while (cursor < alvo) {
    cursor.setDate(cursor.getDate() + 1);
    if (ehDiaUtilComFeriados(cursor)) count++;
  }
  return count;
}
