import type {
  LedModuleSourceRow,
  LedModuleTable,
  LedPowerSourceTables,
  LedTapeTable,
} from "@shared/led-power-sources";

const CORRENTES = [10, 20, 30, 50] as const;
const FATOR_VENDA = 0.85;

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

function equivalenciaCorrentes(modulos: number): string {
  const correntesPlenas = Math.floor(modulos / 20);
  const modulosRestantes = modulos % 20;
  if (modulosRestantes === 0) return `${correntesPlenas} correntes plenas`;
  const corrente = correntesPlenas === 1 ? "corrente" : "correntes";
  return `${correntesPlenas} ${corrente} + ${modulosRestantes} módulos`;
}

function criarTabelaModulos12V(
  key: "modules-3030-12v" | "micro-2835-12v",
  title: string,
  wattsPorModulo: number
): LedModuleTable {
  return {
    key,
    title,
    subtitle: `Módulos por unidade · ${wattsPorModulo === 1.5 ? "1,5" : "3"} W por módulo`,
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
        currentEquivalence: equivalenciaCorrentes(recomendados),
      };
    }),
  };
}

export function getLedPowerSourceTables(): LedPowerSourceTables {
  const fontes24V = fontesParaTensao(24);
  const modulos24VPorFonte = [
    { recommendedModules: 136, maximumModules: 160 },
    { recommendedModules: 272, maximumModules: 320 },
    { recommendedModules: 408, maximumModules: 480 },
    { recommendedModules: 680, maximumModules: 800 },
  ];

  const modulos24V: LedModuleTable = {
    key: "modules-24v",
    title: "Módulos LED — 24 V",
    subtitle: "Capacidade expressa em unidades de módulo",
    rows: fontes24V.map((fonte, i): LedModuleSourceRow => ({
      source: `Fonte chaveada ${fonte.amperagemA}A`,
      voltage: "24 V",
      powerW: fonte.potenciaW,
      ...modulos24VPorFonte[i],
    })),
  };

  return {
    tapes: [
      criarTabelaFitas(24, 17, 1, false),
      criarTabelaFitas(12, 8, 2, true),
    ],
    modules: [
      modulos24V,
      criarTabelaModulos12V("modules-3030-12v", "MÓDULO 3030 3W (12V)", 3),
      criarTabelaModulos12V(
        "micro-2835-12v",
        "MICRO MÓDULO 2835 1,5W (12V)",
        1.5
      ),
    ],
  };
}
