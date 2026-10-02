export interface LedTapeSourceRow {
  source: string;
  voltage: string;
  powerW: number;
  recommendedMeters: number;
  maximumMeters: number;
}

export interface LedTapeTable {
  key: "tape-24v" | "tape-12v";
  title: string;
  wattsPerMeter: number;
  decimals: number;
  fixedDecimals: boolean;
  rows: LedTapeSourceRow[];
}

export interface LedModuleSourceRow {
  source: string;
  voltage: string;
  powerW: number;
  recommendedModules: number;
  maximumModules: number;
  currentEquivalence?: string;
}

export interface LedModuleTable {
  key: "modules-24v" | "modules-3030-12v" | "micro-2835-12v";
  title: string;
  subtitle: string;
  rows: LedModuleSourceRow[];
}

export interface LedPowerSourceTables {
  tapes: LedTapeTable[];
  modules: LedModuleTable[];
}
