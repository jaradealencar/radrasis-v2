import type {
  LedModuleSourceRow,
  LedModuleTable,
  LedPowerSourceTables,
  LedTapeTable,
} from "@shared/led-power-sources";

const CORRENTES = [10, 20, 30, 50] as const;
const FATOR_VENDA = 0.85;
/** Módulo 24 V: 136/272/408/680 módulos a 85% e 160/320/480/800 no limite (fontes de 10/20/30/50 A) saem de 1,5 W cada. */
const WATTS_MODULO_24V = 1.5;

export interface LedDirectSaleData {
  enabled: boolean | null;
  price: number | null;
}

export const LED_24V_MUBISYS_IDS = {
  switched: { 10: 4513, 20: 4514, 30: 4515, 50: 4516 },
  shielded: { "2.5": 4533, 5: 4531, 6: 4532, 15: 4528, 25: 4529, 30: 4530 },
} as const;

/** A API publica do MubiSys informa preco final zero para estes dois itens e
 * nao expoe as faixas cadastradas em "Precos por demanda". Valores conferidos
 * no cadastro comercial em 14/10/2026. */
const LED_24V_PRECOS_POR_DEMANDA: Partial<Record<number, LedModuleSourceRow["directSaleDemandPrices"]>> = {
  [LED_24V_MUBISYS_IDS.switched[30]]: [
    { minQuantity: 1, maxQuantity: 2, unitPrice: 213.40 },
    { minQuantity: 3, maxQuantity: 5, unitPrice: 190.00 },
    { minQuantity: 6, maxQuantity: 8, unitPrice: 180.00 },
  ],
  [LED_24V_MUBISYS_IDS.switched[50]]: [
    { minQuantity: 1, maxQuantity: 2, unitPrice: 262.00 },
    { minQuantity: 3, maxQuantity: 5, unitPrice: 240.00 },
    { minQuantity: 6, maxQuantity: 8, unitPrice: 230.00 },
  ],
};

function arredondarParaBaixo(valor: number, casas: number): number {
  const escala = 10 ** casas;
  return Math.floor((valor + Number.EPSILON * 8) * escala) / escala;
}

function fontesParaTensao(tensaoV: 12 | 24) {
  return CORRENTES.map(amperagemA => ({
    amperagemA,
    potenciaW: amperagemA * tensaoV,
    fonte: `Fonte ${amperagemA}A`,
    tensao: `${tensaoV}V DC`,
  }));
}

function criarTabelaFitas(
  tensaoV: 12 | 24,
  wattsPorMetro: number,
  casasDecimais: number,
  casasFixas: boolean
): LedTapeTable {
  return {
    key: tensaoV === 12 ? "tape-12v" : "tape-24v",
    title: `Fitas LED lineares — ${tensaoV} V`,
    wattsPerMeter: wattsPorMetro,
    decimals: casasDecimais,
    fixedDecimals: casasFixas,
    rows: fontesParaTensao(tensaoV).map(fonte => ({
      source: fonte.fonte,
      voltage: fonte.tensao,
      powerW: fonte.potenciaW,
      recommendedMeters: arredondarParaBaixo(
        (fonte.potenciaW * FATOR_VENDA) / wattsPorMetro,
        casasDecimais
      ),
      maximumMeters: arredondarParaBaixo(
        fonte.potenciaW / wattsPorMetro,
        casasDecimais
      ),
    })),
  };
}

function criarTabelaModulos12V(
  key: "modules-7025-12v" | "modules-3030-12v" | "micro-2835-12v",
  title: string,
  wattsPorModulo: number
): LedModuleTable {
  return {
    key,
    title,
    subtitle: `Módulos por unidade · ${wattsPorModulo === 1.5 ? "1,5" : "3"} W por módulo`,
    wattsPerModule: wattsPorModulo,
    rows: fontesParaTensao(12).map(fonte => {
      const recomendados = Math.floor(
        (fonte.potenciaW * FATOR_VENDA) / wattsPorModulo + 1e-9
      );
      const maximos = Math.floor(fonte.potenciaW / wattsPorModulo + 1e-9);
      return {
        source: fonte.fonte,
        voltage: fonte.tensao,
        powerW: fonte.potenciaW,
        recommendedModules: recomendados,
        maximumModules: maximos,
      };
    }),
  };
}

export function getLedPowerSourceTables(directSaleByMubisysId: ReadonlyMap<number, LedDirectSaleData> = new Map()): LedPowerSourceTables {
  const directSaleFields = (mubisysMateriaPrimaId: number) => {
    const commercial = directSaleByMubisysId.get(mubisysMateriaPrimaId);
    return {
      mubisysMateriaPrimaId,
      directSaleEnabled: commercial?.enabled ?? null,
      directSalePrice: commercial?.price ?? null,
      directSaleDemandPrices: LED_24V_PRECOS_POR_DEMANDA[mubisysMateriaPrimaId],
    };
  };
  const modulos24V: LedModuleTable = {
    key: "modules-24v",
    title: "Módulos LED — 24 V",
    subtitle: "Capacidade expressa em unidades de módulo",
    calculatorGroup: "modules-led-24v",
    sourceFamilyLabel: "Fontes chaveadas",
    wattsPerModule: WATTS_MODULO_24V,
    rows: fontesParaTensao(24).map((fonte): LedModuleSourceRow => ({
      ...directSaleFields(LED_24V_MUBISYS_IDS.switched[fonte.amperagemA]),
      source: `Fonte chaveada ${fonte.amperagemA}A`,
      voltage: "24 V",
      powerW: fonte.potenciaW,
      recommendedModules: Math.floor((fonte.potenciaW * FATOR_VENDA) / WATTS_MODULO_24V + 1e-9),
      maximumModules: Math.floor(fonte.potenciaW / WATTS_MODULO_24V + 1e-9),
    })),
  };

  const fontesBlindadas24V: LedModuleTable = {
    key: "modules-shielded-24v",
    title: "Fontes Blindadas — 24 V",
    subtitle: "Módulo LED de referência: 1,5 W em 24 V",
    sourceLabel: "Fonte Blindada",
    imageSubject: "fonte",
    calculatorGroup: "modules-led-24v",
    sourceFamilyLabel: "Fontes blindadas",
    wattsPerModule: WATTS_MODULO_24V,
    rows: [
      { source: "Fonte Blindada 2,5 A", amperage: "2,5 A", powerW: 60, mubisysMateriaPrimaId: LED_24V_MUBISYS_IDS.shielded["2.5"] },
      { source: "Fonte Blindada 5 A", amperage: "5,0 A", powerW: 120, mubisysMateriaPrimaId: LED_24V_MUBISYS_IDS.shielded[5] },
      { source: "Fonte Blindada 6 A", amperage: "6,0 A", powerW: 150, mubisysMateriaPrimaId: LED_24V_MUBISYS_IDS.shielded[6] },
      { source: "Fonte Blindada 15 A", amperage: "15,0 A", powerW: 360, mubisysMateriaPrimaId: LED_24V_MUBISYS_IDS.shielded[15] },
      { source: "Fonte Blindada 25 A", amperage: "25,0 A", powerW: 600, mubisysMateriaPrimaId: LED_24V_MUBISYS_IDS.shielded[25] },
      { source: "Fonte Blindada 30 A", amperage: "30,0 A", powerW: 720, mubisysMateriaPrimaId: LED_24V_MUBISYS_IDS.shielded[30] },
    ].map(row => ({
      ...row,
      ...directSaleFields(row.mubisysMateriaPrimaId),
      voltage: "24 V",
      recommendedModules: Math.floor((row.powerW * FATOR_VENDA) / WATTS_MODULO_24V + 1e-9),
      maximumModules: Math.floor(row.powerW / WATTS_MODULO_24V + 1e-9),
    })),
  };

  return {
    tapes: [
      criarTabelaFitas(24, 17, 1, false),
      criarTabelaFitas(12, 8, 2, true),
    ],
    modules: [
      modulos24V,
      fontesBlindadas24V,
      criarTabelaModulos12V(
        "modules-7025-12v",
        "MÓDULO LED 7025 (12V)",
        1.5
      ),
      criarTabelaModulos12V("modules-3030-12v", "MÓDULO 3030 3W (12V)", 3),
      criarTabelaModulos12V(
        "micro-2835-12v",
        "MICRO MÓDULO 2835 1,5W (12V)",
        1.5
      ),
    ],
  };
}
