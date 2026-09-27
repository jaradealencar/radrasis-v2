/**
 * Agregação diária de OS e orçamentos de um mês — usada pela evolução diária por
 * vendedor (server/routers/performanceComercial.ts, getEvolucaoDiariaMes) e pelo
 * ritmo diário da meta (client/src/pages/comercial/MetasComerciais.tsx).
 *
 * Extraída do router para ser pura e testável isoladamente (sem tRPC/API): quem
 * chama já filtrou `osNormais` (isOsNormalApi) e `orcVersaoAtual` (exclusão de
 * cancelada/excluída) com as mesmas regras usadas no resto do painel.
 */

/** Mesma conta de server/routers/performanceComercial.ts (valorLiquidoOs) — duplicada aqui
 * (não importada de lá) para não criar import circular entre router e service. */
function valorLiquidoOs(os: any): number {
  const total = parseFloat(String(os?.valor_total ?? "0")) || 0;
  const desconto = parseFloat(String(os?.valor_desconto ?? "0")) || 0;
  return total - desconto;
}

export interface PontoDiaEvolucao {
  dia: number;
  label: string;
  /** "YYYY-MM-DD". */
  data: string;
  totalOs: number;
  totalFat: number;
  totalCot: number;
  totalOrc: number;
  totalOsAc: number;
  totalFatAc: number;
  totalCotAc: number;
  totalOrcAc: number;
  /** Chaves dinâmicas por vendedor: "${vendedor}__os", "__fat", "__cot", "__orc" (diário) e as
   * mesmas com sufixo "_ac" (acumulado) — inclui o balde "Sem Vendedor". */
  [chaveVendedor: string]: number | string;
}

/** Agrupa OS (por data de aprovação) e orçamentos (por data de cadastro) por dia do mês,
 * diário e acumulado, por vendedor (raw `os.vendedor`, incluindo "Sem Vendedor") e no total da
 * empresa. Só inclui dias até `hoje` (mês futuro fica vazio; mês passado traz o mês inteiro). */
export function agregarEvolucaoDiaria(
  osNormais: any[],
  orcVersaoAtual: any[],
  mes: number,
  ano: number,
  hoje: Date = new Date(),
): { dias: PontoDiaEvolucao[]; vendedores: string[] } {
  // Agrupar OS por dia de aprovação
  const osPorDia: Record<string, Record<string, { os: number; faturamento: number }>> = {};
  for (const os of osNormais) {
    const dataAprov = (os.data_aprovacao || os.data_cadastro || "").substring(0, 10);
    if (!dataAprov) continue;
    const vendedor = os.vendedor || "Sem Vendedor";
    const valor = valorLiquidoOs(os);
    if (!osPorDia[dataAprov]) osPorDia[dataAprov] = {};
    if (!osPorDia[dataAprov][vendedor]) osPorDia[dataAprov][vendedor] = { os: 0, faturamento: 0 };
    osPorDia[dataAprov][vendedor].os++;
    osPorDia[dataAprov][vendedor].faturamento += valor;
  }

  // Agrupar cotações por dia de cadastro
  const orcPorDia: Record<string, Record<string, { cotacoes: number; valorOrcado: number }>> = {};
  for (const orc of orcVersaoAtual) {
    const dataCad = (orc.data_cadastro || "").substring(0, 10);
    if (!dataCad) continue;
    const vendedor = orc.vendedor || "Sem Vendedor";
    const vt = parseFloat(String(orc.valor_total ?? "0")) || 0;
    const vc = parseFloat(String(orc.valor_custo ?? "0")) || 0;
    const vm = parseFloat(String(orc.valor_margem ?? "0")) || 0;
    const valor = vt > 0 ? vt : (vc + vm);
    if (!orcPorDia[dataCad]) orcPorDia[dataCad] = {};
    if (!orcPorDia[dataCad][vendedor]) orcPorDia[dataCad][vendedor] = { cotacoes: 0, valorOrcado: 0 };
    orcPorDia[dataCad][vendedor].cotacoes++;
    orcPorDia[dataCad][vendedor].valorOrcado += valor;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(ano, mes, 0).getDate();
  const todayStr = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;

  const acumOs: Record<string, number> = {};
  const acumFat: Record<string, number> = {};
  const acumCot: Record<string, number> = {};
  const acumOrc: Record<string, number> = {};
  let totalOsAc = 0, totalFatAc = 0, totalCotAc = 0, totalOrcAc = 0;
  const dias: PontoDiaEvolucao[] = [];

  for (let d = 1; d <= lastDay; d++) {
    const dStr = `${ano}-${pad(mes)}-${pad(d)}`;
    if (dStr > todayStr) break;
    const label = `${pad(d)}/${pad(mes)}`;
    const osHoje = osPorDia[dStr] ?? {};
    const orcHoje = orcPorDia[dStr] ?? {};
    const todosVend = new Set([...Object.keys(osHoje), ...Object.keys(orcHoje)]);
    for (const v of todosVend) {
      acumOs[v] = (acumOs[v] ?? 0) + (osHoje[v]?.os ?? 0);
      acumFat[v] = (acumFat[v] ?? 0) + (osHoje[v]?.faturamento ?? 0);
      acumCot[v] = (acumCot[v] ?? 0) + (orcHoje[v]?.cotacoes ?? 0);
      acumOrc[v] = (acumOrc[v] ?? 0) + (orcHoje[v]?.valorOrcado ?? 0);
    }

    const totalOsDia = Object.values(osHoje).reduce((s, x) => s + x.os, 0);
    const totalFatDia = Object.values(osHoje).reduce((s, x) => s + x.faturamento, 0);
    const totalCotDia = Object.values(orcHoje).reduce((s, x) => s + x.cotacoes, 0);
    const totalOrcDia = Object.values(orcHoje).reduce((s, x) => s + x.valorOrcado, 0);
    totalOsAc += totalOsDia;
    totalFatAc += totalFatDia;
    totalCotAc += totalCotDia;
    totalOrcAc += totalOrcDia;

    const ponto: PontoDiaEvolucao = {
      dia: d, label, data: dStr,
      totalOs: totalOsDia, totalFat: parseFloat(totalFatDia.toFixed(2)),
      totalCot: totalCotDia, totalOrc: parseFloat(totalOrcDia.toFixed(2)),
      totalOsAc, totalFatAc: parseFloat(totalFatAc.toFixed(2)),
      totalCotAc, totalOrcAc: parseFloat(totalOrcAc.toFixed(2)),
    };
    // Diário por vendedor
    for (const v of todosVend) {
      ponto[`${v}__os`] = osHoje[v]?.os ?? 0;
      ponto[`${v}__fat`] = parseFloat((osHoje[v]?.faturamento ?? 0).toFixed(2));
      ponto[`${v}__cot`] = orcHoje[v]?.cotacoes ?? 0;
      ponto[`${v}__orc`] = parseFloat((orcHoje[v]?.valorOrcado ?? 0).toFixed(2));
    }
    // Acumulado por vendedor
    for (const v of Object.keys(acumOs)) {
      ponto[`${v}__os_ac`] = acumOs[v];
      ponto[`${v}__fat_ac`] = parseFloat(acumFat[v].toFixed(2));
    }
    for (const v of Object.keys(acumCot)) {
      ponto[`${v}__cot_ac`] = acumCot[v];
      ponto[`${v}__orc_ac`] = parseFloat(acumOrc[v].toFixed(2));
    }
    dias.push(ponto);
  }

  const vendedores = Array.from(new Set([
    ...Object.keys(acumOs),
    ...Object.keys(acumCot),
  ])).filter(v => v !== "Sem Vendedor").sort();

  return { dias, vendedores };
}
