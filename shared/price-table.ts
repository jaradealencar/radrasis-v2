/**
 * Formato do `contentJson` de `price_table_sections` (Tabela de Preços).
 * Compartilhado entre client (editor visual em TabelaPrecos.tsx) e server
 * (normalização de IDs em server/integrations/priceTableIds.ts e o export
 * REST em server/routes/price-table-api.ts) para os dois lados concordarem
 * exatamente na forma do JSON gravado no banco.
 *
 * `id` em ConfigItem e MarginRow é um identificador estável e numérico,
 * atribuído automaticamente pelo servidor (nunca pelo client) na primeira
 * vez que a linha/regra é salva, e nunca reaproveitado — existe para o
 * precificador automatizado externo referenciar uma linha/regra específica
 * sem depender do texto do label. `id: 0` é a sentinela "ainda não
 * atribuído" usada pelo client ao criar uma linha/regra nova.
 */
export interface ConfigItem {
  id: number;
  label: string;
  value: string;
  highlight?: string;
  note?: string;
}

export interface MarginRow {
  id: number;
  label: string;
  values: string[];
}

/** Linha técnica da consulta de fontes LED; não participa dos IDs de preço. */
export interface LedSourcePriceRow {
  fonte: string;
  potencia: string;
  saida: string;
  quantidadeModulos: string;
  equivalencia: string;
  limiteMaximo: string;
  preco: string;
}

export interface ContentJson {
  type: "config" | "margin_table" | "margin_table_multi" | "list" | "rich_text" | "led_source_table";
  columns?: string[];
  rows?: MarginRow[];
  items?: ConfigItem[] | string[];
  html?: string;
  moduleDescription?: string;
  sourceRows?: LedSourcePriceRow[];
}
