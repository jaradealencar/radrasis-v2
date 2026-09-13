/**
 * Mapa UF → Região do Brasil, compartilhado entre o server (Score de
 * Probabilidade de Compra — server/services/probabilidadeCompra.ts) e o
 * front (client/src/pages/comercial/AnaliseGeografica.tsx, objeto `REGIOES`).
 *
 * Cópia literal do mapa client-side — não havia nenhuma versão server-side
 * antes desta mudança. Mantenha os dois em sincronia se um dia mudar (o que
 * não deve acontecer: são as 27 UFs oficiais, fixas).
 */
export const UF_PARA_REGIAO: Record<string, string> = {
  AC: "Norte", AM: "Norte", AP: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MS: "Centro-Oeste", MT: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

export { normalizarUf, UFS_VALIDAS } from "../routers/analiseGeografica";
