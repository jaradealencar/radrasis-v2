import type { ContentJson, MarginRow } from "./price-table";

const AJUSTE_PINTURA_ID = "pintura-galvanizado-pvc-menos-3_5pp-branco-colorido";
const COLUNA_BRANCO_COLORIDO = "Branco + Colorido";
const ESPACO_FAIXA_DERIVADA = 1_000_000_000;

type SecaoTabelaPrecos = {
  id: number;
  page: number;
  sectionTitle: string;
  contentJson: string;
};

function normalizarTexto(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function servicoDePintura(
  section: SecaoTabelaPrecos
): "galvanizado" | "pvc" | null {
  if (section.page !== 3 && section.page !== 13) return null;
  const title = normalizarTexto(section.sectionTitle);
  if (title.includes("servico de pintura galvanizado - pu (poliuretano)")) {
    return "galvanizado";
  }
  if (title.includes("servico de pintura pvc - pu (poliuretano)")) return "pvc";
  return null;
}

function ajustarPontosPercentuais(value: string, pontos: number): string {
  const match = value.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*(%)\s*$/);
  if (!match) return value;

  const numero = Number(match[1].replace(",", ".")) - pontos;
  if (!Number.isFinite(numero)) return value;
  const separador =
    match[1].includes(".") && !match[1].includes(",") ? "." : ",";
  const formatado = numero
    .toFixed(1)
    .replace(/\.0$/, "")
    .replace(".", separador);
  return `${formatado}%`;
}

function indiceColunaDeValores(content: ContentJson): number {
  return content.type === "margin_table_multi" ? 1 : 0;
}

function criarIdFaixaDerivada(sectionId: number, index: number): number {
  return ESPACO_FAIXA_DERIVADA + sectionId * 100 + index;
}

/**
 * Prepara as tabelas de pintura Galvanizado/PVC das abas Clientes Antigos e
 * Novo Cliente. A marca no JSON torna o desconto idempotente quando o conteúdo
 * volta a ser lido depois de uma edição salva.
 */
export function ajustarTabelaDePintura<T extends SecaoTabelaPrecos>(
  section: T
): T {
  const servico = servicoDePintura(section);
  if (!servico) return section;

  let content: ContentJson;
  try {
    content = JSON.parse(section.contentJson) as ContentJson;
  } catch {
    return section;
  }
  if (
    (content.type !== "margin_table" &&
      content.type !== "margin_table_multi") ||
    !Array.isArray(content.columns) ||
    !Array.isArray(content.rows)
  ) {
    return section;
  }

  const ajusteJaAplicado =
    content.appliedAdjustments?.includes(AJUSTE_PINTURA_ID) ?? false;
  const columns = [...content.columns];
  const offset = indiceColunaDeValores(content);
  const rows: MarginRow[] = content.rows.map(row => ({
    ...row,
    values: ajusteJaAplicado
      ? [...row.values]
      : row.values.map(value => ajustarPontosPercentuais(value, 3.5)),
  }));

  if (servico === "galvanizado") {
    const brancoColoridoIndex = columns.findIndex(
      column =>
        normalizarTexto(column.trim()) ===
        normalizarTexto(COLUNA_BRANCO_COLORIDO)
    );
    const brancoIndex = columns.findIndex(
      column => normalizarTexto(column.trim()) === "tinta branca"
    );
    const umaCorIndex = columns.findIndex(
      column => normalizarTexto(column.trim()) === "1 cor"
    );
    const baseColumnIndex = brancoIndex >= 0 ? brancoIndex : umaCorIndex;

    if (brancoColoridoIndex >= 0) {
      const baseValueIndex =
        (brancoIndex >= 0 ? brancoIndex : umaCorIndex) - offset;
      const derivedValueIndex = brancoColoridoIndex - offset;
      if (baseValueIndex >= 0 && derivedValueIndex >= 0) {
        for (const row of rows) {
          const baseValue = row.values[baseValueIndex] ?? "";
          row.values[derivedValueIndex] = ajustarPontosPercentuais(
            baseValue,
            brancoIndex >= 0 ? 3 : 8
          );
        }
      }
    } else if (baseColumnIndex >= 0) {
      const insertColumnIndex = baseColumnIndex + 1;
      const insertValueIndex = insertColumnIndex - offset;
      columns.splice(insertColumnIndex, 0, COLUNA_BRANCO_COLORIDO);
      for (const row of rows) {
        const baseValue = row.values[baseColumnIndex - offset] ?? "";
        const derivedValue = ajustarPontosPercentuais(
          baseValue,
          brancoIndex >= 0 ? 3 : 8
        );
        row.values.splice(insertValueIndex, 0, derivedValue);
      }

      const quantidadeFaixas = Math.max(0, content.columns.length - offset);
      const faixaIds = Array.isArray(content.faixaIds)
        ? [...content.faixaIds]
        : Array.from({ length: quantidadeFaixas }, (_, index) =>
            criarIdFaixaDerivada(section.id, index)
          );
      while (faixaIds.length < quantidadeFaixas) {
        faixaIds.push(criarIdFaixaDerivada(section.id, faixaIds.length));
      }
      let faixaIdDerivada = criarIdFaixaDerivada(section.id, 99);
      while (faixaIds.includes(faixaIdDerivada)) faixaIdDerivada++;
      faixaIds.splice(insertValueIndex, 0, faixaIdDerivada);
      content = { ...content, faixaIds };
    }
  }

  const appliedAdjustments = ajusteJaAplicado
    ? content.appliedAdjustments
    : [...(content.appliedAdjustments ?? []), AJUSTE_PINTURA_ID];
  const adjustedContent = JSON.stringify({
    ...content,
    columns,
    rows,
    appliedAdjustments,
  });
  return adjustedContent === section.contentJson
    ? section
    : { ...section, contentJson: adjustedContent };
}
