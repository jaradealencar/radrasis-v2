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

export function getLedPowerSourceTables(): LedPowerSourceTables {
  const modulos24V: LedModuleTable = {
    key: "modules-24v",
    title: "Módulos LED — 24 V",
    subtitle: "Capacidade expressa em unidades de módulo",
    wattsPerModule: WATTS_MODULO_24V,
    rows: fontesParaTensao(24).map((fonte): LedModuleSourceRow => ({
      source: `Fonte chaveada ${fonte.amperagemA}A`,
      voltage: "24 V",
      powerW: fonte.potenciaW,
      recommendedModules: Math.floor((fonte.potenciaW * FATOR_VENDA) / WATTS_MODULO_24V + 1e-9),
      maximumModules: Math.floor(fonte.potenciaW / WATTS_MODULO_24V + 1e-9),
    })),
  };

  return {
    tapes: [
      criarTabelaFitas(24, 17, 1, false),
      criarTabelaFitas(12, 8, 2, true),
    ],
    modules: [
      modulos24V,
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
