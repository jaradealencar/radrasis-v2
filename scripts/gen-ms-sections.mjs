/**
 * Gera as seções "Clientes MS" (margens -4pp) e renomeia as originais para "Clientes Brasil"
 * para as tabelas de preços principal (page 2) e novo cliente (page 12).
 */

// Dados originais da seção PVC/Acrílico/ACM
const originalContent = {
  type: "margin_table_multi",
  columns: ["Até R$330","R$335~750","R$755~2.500","R$2.505~4.000","R$4.005~4.800","R$4.8k+"],
  rows: [
    { label: "(padrão)",                        values: ["35%","20%","18%","18%","16%","14%"] },
    { label: "PVC 20/30mm",                     values: ["30%","15%","10%","7%","4%","2%"] },
    { label: "Com rasgo fita",                  values: ["30%","20%","15%","12%","10%","7%"] },
    { label: "PVC Plus",                        values: ["32%","22%","17%","14%","12%","9%"] },
    { label: "PVC Plus com rasgo / PVC Inox",   values: ["35%","25%","20%","17%","15%","12%"] },
    { label: "Backlight",                       values: ["20%","10%","8%","6%","4%","2%"] },
  ]
};

// Função para subtrair 4pp de cada valor percentual
function subtract4pp(val) {
  const match = val.match(/^(-?\d+(?:,\d+)?)%$/);
  if (!match) return val; // não é percentual, manter como está
  const num = parseFloat(match[1].replace(",", "."));
  const result = num - 4;
  // Formatar: se resultado for inteiro, sem decimal; senão com vírgula
  const formatted = Number.isInteger(result) ? String(result) : result.toFixed(1).replace(".", ",");
  return `${formatted}%`;
}

// Criar versão MS com margens -4pp
const msContent = {
  ...originalContent,
  rows: originalContent.rows.map(row => ({
    label: row.label,
    values: row.values.map(v => subtract4pp(v))
  }))
};

// Verificar os valores calculados
console.log("=== Versão MS (margens -4pp) ===");
msContent.rows.forEach(row => {
  console.log(`  ${row.label}: ${row.values.join(", ")}`);
});

console.log("\n=== Versão Brasil (original) ===");
originalContent.rows.forEach(row => {
  console.log(`  ${row.label}: ${row.values.join(", ")}`);
});

// Gerar JSON para inserção
const msJson = JSON.stringify(msContent);
const brasilJson = JSON.stringify(originalContent);

console.log("\n=== JSON MS ===");
console.log(msJson);

console.log("\n=== JSON Brasil ===");
console.log(brasilJson);

// Gerar SQL
const sectionTitle = "PVC Expandido (5/10/15/16mm) de todas as cores e acrílico e ACM";
const titleBrasil = `${sectionTitle} — Clientes Brasil`;
const titleMs = `${sectionTitle} — Clientes MS`;

// Para página 2 (tabela principal): seção original id=16, sectionOrder=7
// Para página 12 (tabela novo cliente): seção original id=60016, sectionOrder=7
// Estratégia:
//   1. Renomear seção original para "Clientes Brasil" (sectionOrder=7)
//   2. Inserir nova seção "Clientes MS" (sectionOrder=8, logo após)
//   3. Deslocar seções subsequentes em +1

const sql = `
-- ===================================================================
-- Tabela Principal (page=2): Renomear original e inserir versão MS
-- ===================================================================

-- 1. Deslocar seções com sectionOrder >= 8 na página 2 para abrir espaço
UPDATE price_table_sections SET sectionOrder = sectionOrder + 1 WHERE page = 2 AND sectionOrder >= 8;

-- 2. Renomear seção original (id=16) para "Clientes Brasil"
UPDATE price_table_sections SET sectionTitle = '${titleBrasil}' WHERE id = 16;

-- 3. Inserir nova seção "Clientes MS" logo após (sectionOrder=8)
INSERT INTO price_table_sections (page, sectionOrder, sectionTitle, contentJson)
VALUES (2, 8, '${titleMs}', '${msJson.replace(/'/g, "\\'")}');

-- ===================================================================
-- Tabela Novo Cliente (page=12): Renomear original e inserir versão MS
-- ===================================================================

-- 4. Deslocar seções com sectionOrder >= 8 na página 12 para abrir espaço
UPDATE price_table_sections SET sectionOrder = sectionOrder + 1 WHERE page = 12 AND sectionOrder >= 8;

-- 5. Renomear seção original (id=60016) para "Clientes Brasil"
UPDATE price_table_sections SET sectionTitle = '${titleBrasil}' WHERE id = 60016;

-- 6. Inserir nova seção "Clientes MS" logo após (sectionOrder=8)
INSERT INTO price_table_sections (page, sectionOrder, sectionTitle, contentJson)
VALUES (12, 8, '${titleMs}', '${msJson.replace(/'/g, "\\'")}');
`;

console.log("\n=== SQL Gerado ===");
console.log(sql);
