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
  priceRange?: string;
}

export interface LedModuleTable {
  key: "modules-24v" | "modules-shielded-24v" | "modules-7025-12v" | "modules-3030-12v" | "micro-2835-12v";
  title: string;
  subtitle: string;
  sourceLabel?: string;
  imageSubject?: "LED" | "fonte";
  /** Consumo de cada módulo (W): base das colunas de capacidade e da calculadora de fontes. */
  wattsPerModule: number;
  rows: LedModuleSourceRow[];
}

export interface LedPowerSourceTables {
  tapes: LedTapeTable[];
  modules: LedModuleTable[];
}

export type LedPowerSourceTextOverrides = Record<string, string>;

export const ledPowerSourceTextKey = {
  page: (part: "tableTabLabel" | "tapesTab" | "modulesTab" | "pdfTitle" | "pdfSubtitle" | "tapesHeading" | "modulesHeading") => `page.${part}`,
  common: (part: "powerUnit" | "meterUnit" | "moduleUnit" | "moduleRecommendedPrefix") => `common.${part}`,
  title: (tableKey: LedTapeTable["key"] | LedModuleTable["key"]) => `${tableKey}.title`,
  subtitle: (tableKey: LedTapeTable["key"] | LedModuleTable["key"]) => `${tableKey}.subtitle`,
  image: (tableKey: LedTapeTable["key"] | LedModuleTable["key"]) => `${tableKey}.imageUrl`,
  column: (
    tableKey: LedTapeTable["key"] | LedModuleTable["key"],
    column: "source" | "voltage" | "power" | "priceRange" | "recommended" | "maximum"
  ) => `${tableKey}.column.${column}`,
  row: (
    tableKey: LedTapeTable["key"] | LedModuleTable["key"],
    rowIndex: number,
    field: "source" | "voltage" | "priceRange"
  ) => `${tableKey}.row.${rowIndex}.${field}`,
} as const;
