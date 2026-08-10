import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Verificar se já tem dados
const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM price_table_sections");
if (rows[0].cnt > 0) {
  console.log("Seed já aplicado, pulando.");
  await conn.end();
  process.exit(0);
}

// ─── PÁGINA 1 ────────────────────────────────────────────────────────────────
const page1Sections = [
  {
    page: 1,
    sectionOrder: 0,
    sectionTitle: "⚙️ Configurações Gerais",
    contentJson: JSON.stringify({
      type: "config",
      items: [
        { label: "Desconto máximo", value: "2%", highlight: "red", note: "SOMENTE COM APROVAÇÃO DANIEL" },
        { label: "Valor Mínimo", value: "R$160,00", highlight: "yellow" },
      ]
    }),
    notes: "Letreiro Frontlight Galvanizado (aro normal ou recuado) — referência\nLetreiro Frontlight Inox - Liga 304 ou 430\nSomente aro com fundo galvanizado",
  },
  {
    page: 1,
    sectionOrder: 1,
    sectionTitle: "Frontlight Galvanizado (referência)",
    contentJson: JSON.stringify({
      type: "margin_table",
      columns: ["Até R$330", "R$335~750", "R$760~1.300", "R$1.301~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"],
      rows: [{ label: "Margem", values: ["32%", "26%", "24%", "22%", "16%", "9%", "9%"] }]
    }),
    notes: null,
  },
  {
    page: 1,
    sectionOrder: 2,
    sectionTitle: "Somente Aro ou Aro Recuado (sem acrílico e sem fundo em PVC)",
    contentJson: JSON.stringify({
      type: "margin_table",
      columns: ["Até R$330", "R$335~750", "R$760~1.090", "R$1.100~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"],
      rows: [{ label: "Margem", values: ["35%", "29%", "27%", "25%", "19%", "14%", "10%"] }]
    }),
    notes: "Em perfil de 150mm: aumentar 2%, explicar ao cliente. Até 120mm, sem adicional.",
  },
  {
    page: 1,
    sectionOrder: 3,
    sectionTitle: 'Galvanizado padrão 22", 24" e 26" (- 2 pontos)',
    contentJson: JSON.stringify({
      type: "margin_table",
      columns: ["Até R$330", "R$335~750", "R$760~1.290", "R$1.300~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"],
      rows: [{ label: "Margem", values: ["28%", "24%", "22%", "21%", "18,5%", "8%", "4%"] }]
    }),
    notes: "Em perfil de 150mm: aumentar 2%, explicar ao cliente. Até 120mm, sem adicional.",
  },
  {
    page: 1,
    sectionOrder: 4,
    sectionTitle: 'Galvanizado padrão 22", 24" e 26" / Com chapinha (+ 2 pontos)',
    contentJson: JSON.stringify({
      type: "margin_table",
      columns: ["Até R$330", "R$335~750", "R$760~1.090", "R$1.100~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"],
      rows: [{ label: "Margem", values: ["30%", "24%", "22%", "20%", "17%", "11%", "7%"] }]
    }),
    notes: "Em perfil de 150mm: aumentar 2%, explicar ao cliente. Até 120mm, sem adicional.",
  },
  {
    page: 1,
    sectionOrder: 5,
    sectionTitle: 'Galvanizado padrão 18" e 20" (- 4 pontos)',
    contentJson: JSON.stringify({
      type: "margin_table",
      columns: ["Até R$330", "R$335~750", "R$760~1.090", "R$1.100~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"],
      rows: [{ label: "Margem", values: ["25%", "16%", "14%", "15%", "10%", "4%", "1%"] }]
    }),
    notes: "Em perfil de 150mm: aumentar 2%, explicar ao cliente. Até 120mm, sem adicional.",
  },
  {
    page: 1,
    sectionOrder: 6,
    sectionTitle: "Galvanizado fechado frente e fundo / Projetos complexos (+ 5 pontos)",
    contentJson: JSON.stringify({
      type: "margin_table",
      columns: ["Até R$750", "R$760~1.090", "R$1.100~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"],
      rows: [{ label: "Margem", values: ["40%", "30%", "28%", "26%", "23%", "20%"] }]
    }),
    notes: null,
  },
  {
    page: 1,
    sectionOrder: 7,
    sectionTitle: "Letreiro Frontlight Flat",
    contentJson: JSON.stringify({
      type: "margin_table",
      columns: ["Até R$330", "R$335~750", "R$760~1.090", "R$1.100~3.490", "R$3.500~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"],
      rows: [{ label: "Margem", values: ["20%", "13%", "11%", "9%", "7%", "5%", "4%", "2%"] }]
    }),
    notes: null,
  },
];

// ─── PÁGINA 2 ────────────────────────────────────────────────────────────────
const page2Sections = [
  {
    page: 2,
    sectionOrder: 0,
    sectionTitle: "⚙️ Configurações Gerais — Inox / PVC",
    contentJson: JSON.stringify({
      type: "config",
      items: [
        { label: "Valor Mínimo Inox", value: "R$170,00", highlight: "yellow" },
        { label: "Valor Mínimo PVC/Acrílico", value: "R$120,00", highlight: "yellow" },
        { label: "Desconto máximo", value: "2%", highlight: "red", note: "SOMENTE COM APROVAÇÃO DANIEL" },
      ]
    }),
    notes: "Letreiro Inox Padrão (22, 24 ou 26) — Polido ou Escovado (430 ou 304)\nAcrílico com inox na frente",
  },
  {
    page: 2,
    sectionOrder: 1,
    sectionTitle: "Inox somente corte (sem solda), mas com polimento",
    contentJson: JSON.stringify({
      type: "margin_table",
      columns: ["Até R$330", "R$335~750", "R$760~1.090", "R$1.100~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"],
      rows: [{ label: "Margem", values: ["42%", "35%", "31%", "29%", "27%", "21%", "16%"] }]
    }),
    notes: null,
  },
  {
    page: 2,
    sectionOrder: 2,
    sectionTitle: "Fixação barra roscada ou patinha arame (Projetos muito complexos + 5 pontos)",
    contentJson: JSON.stringify({
      type: "margin_table",
      columns: ["Até R$330", "R$335~750", "R$760~1.090", "R$1.100~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"],
      rows: [{ label: "Margem", values: ["32%", "25%", "21%", "19%", "17%", "11%", "6%"] }]
    }),
    notes: null,
  },
  {
    page: 2,
    sectionOrder: 3,
    sectionTitle: "Fixação com chapinha (+ 2 pontos)",
    contentJson: JSON.stringify({
      type: "margin_table",
      columns: ["Até R$330", "R$335~750", "R$760~1.090", "R$1.100~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"],
      rows: [{ label: "Margem", values: ["34%", "27%", "23%", "24%", "19%", "13%", "8%"] }]
    }),
    notes: null,
  },
  {
    page: 2,
    sectionOrder: 4,
    sectionTitle: "Se TODAS as letras forem menor que 11cm (+ 6 pontos) [SOMENTE A PARTIR DE 30 PCS]",
    contentJson: JSON.stringify({
      type: "margin_table",
      columns: ["Até R$330", "R$335~750", "R$760~1.090", "R$1.100~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"],
      rows: [{ label: "Margem", values: ["38%", "31%", "27%", "26%", "21%", "17%", "12%"] }]
    }),
    notes: null,
  },
  {
    page: 2,
    sectionOrder: 5,
    sectionTitle: "Latão (- 45%)",
    contentJson: JSON.stringify({
      type: "margin_table",
      columns: ["Até R$330", "R$335~750", "R$760~1.090", "R$1.100~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"],
      rows: [{ label: "Margem", values: ["20%", "18%", "16%", "14%", "12%", "10%", "8%"] }]
    }),
    notes: null,
  },
  {
    page: 2,
    sectionOrder: 6,
    sectionTitle: "Latão em que todas as letras menores que 11cm (+ 5 pontos)",
    contentJson: JSON.stringify({
      type: "margin_table",
      columns: ["Até R$330", "R$335~750", "R$760~1.090", "R$1.100~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"],
      rows: [{ label: "Margem", values: ["24,2%", "117,75%", "15,55%", "15%", "13,25%", "11,05%", "8,3%"] }]
    }),
    notes: null,
  },
  {
    page: 2,
    sectionOrder: 7,
    sectionTitle: "PVC (5/10/15/16mm) de todas as cores e acrílico e ACM",
    contentJson: JSON.stringify({
      type: "margin_table_multi",
      columns: ["Até R$330", "R$335~750", "R$755~2.500", "R$2.505~4.000", "R$4.005~4.800", "R$4.8k+"],
      rows: [
        { label: "(padrão)", values: ["35%", "20%", "18%", "18%", "16%", "14%"] },
        { label: "PVC 20/30mm", values: ["30%", "15%", "10%", "7%", "4%", "2%"] },
        { label: "Com rasgo fita", values: ["30%", "20%", "15%", "12%", "10%", "7%"] },
        { label: "PVC Plus", values: ["32%", "22%", "17%", "14%", "12%", "9%"] },
        { label: "PVC Plus com rasgo / PVC Inox", values: ["35%", "25%", "20%", "17%", "15%", "12%"] },
        { label: "Backlight", values: ["20%", "10%", "8%", "6%", "4%", "2%"] },
      ]
    }),
    notes: "Preencher Perímetro. Vender fixador como venda direta (letras pequenas apenas 2 ou 3 por peça).",
  },
  {
    page: 2,
    sectionOrder: 8,
    sectionTitle: "Letreiro Acrílico Montado",
    contentJson: JSON.stringify({
      type: "margin_table",
      columns: ["Até R$330", "R$335~750", "R$760~1.090", "R$1.100~3.490", "R$3.500~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"],
      rows: [{ label: "Margem", values: ["40%", "35%", "32%", "30%", "28%", "26%", "22%", "18%"] }]
    }),
    notes: null,
  },
];

// ─── PÁGINA 3 ────────────────────────────────────────────────────────────────
const page3Sections = [
  {
    page: 3,
    sectionOrder: 0,
    sectionTitle: "⚙️ Configurações Gerais — Pintura",
    contentJson: JSON.stringify({
      type: "config",
      items: [
        { label: "Valor Mínimo Pintura Galvanizado", value: "R$200,00", highlight: "yellow" },
        { label: "Valor Mínimo Verniz Dourado Inox", value: "R$340,00", highlight: "yellow" },
        { label: "Pintura Mínima Objeto Pequeno", value: "Complementar R$95,00", highlight: "blue" },
      ]
    }),
    notes: "SEM VERNIZ\nNÃO REALIZAMOS MAIS PINTURA DEGRADÊ\nPoliéster Dourado Prata Bronze: + 1 dia | Sintético Dourado",
  },
  {
    page: 3,
    sectionOrder: 1,
    sectionTitle: "Serviço de Pintura Galvanizado - PU (Poliuretano)",
    contentJson: JSON.stringify({
      type: "margin_table_multi",
      columns: ["Área", "1 cor", "2 cores", "3/4 cores", "Sintético 1 cor"],
      rows: [
        { label: "Menor que 0,34m²", values: ["27%", "29%", "32%", "20%"] },
        { label: "Entre 0,35 e 0,60m²", values: ["27%", "29%", "32%", "20%"] },
        { label: "Entre 0,62 e 1m²", values: ["33%", "38%", "NÃO DISPONÍVEL", "18%"] },
        { label: "Entre 1,1 e 1,5m²", values: ["29%", "34%", "37%", "18%"] },
        { label: "Entre 1,51m² e 4m²", values: ["27%", "32%", "35%", "15%"] },
        { label: "Entre 4,1m² e 8m²", values: ["25%", "30%", "33%", "15%"] },
        { label: "Entre 8,1m² e 12m²", values: ["23%", "28%", "31%", "13%"] },
        { label: "Acima de 12,1m²", values: ["21%", "26%", "29%", "13%"] },
      ]
    }),
    notes: "Acima de 14 metros usar somente tabela de uma cor, mesmo que tenha até 3 cores.\nBranco e preto fosco: mesmo valor. Sem necessidade de verniz.\nTem acabamento para adicionar pintura interna e acabamento para pintar fundo:\n- Pintura Interna Frontlight\n- Pintura Fundo Frontlight",
  },
  {
    page: 3,
    sectionOrder: 2,
    sectionTitle: "Serviço de Pintura PVC - PU (Poliuretano)",
    contentJson: JSON.stringify({
      type: "margin_table_multi",
      columns: ["Área", "1 cor", "2 cores", "3/4 cores", "Dourado 1 cor"],
      rows: [
        { label: "Menor que 0,34m²", values: ["31%", "33%", "36%", "25%"] },
        { label: "Entre 0,35 e 0,60m²", values: ["31%", "33%", "36%", "25%"] },
        { label: "Entre 0,62 e 1m²", values: ["38%", "43%", "—", "23%"] },
        { label: "Entre 1,1 e 1,5m²", values: ["34%", "39%", "42%", "23%"] },
        { label: "Entre 1,51m² e 4m²", values: ["32%", "37%", "40%", "20%"] },
        { label: "Entre 4,1m² e 8m²", values: ["30%", "35%", "38%", "20%"] },
        { label: "Entre 8,1m² e 12m²", values: ["28%", "33%", "36%", "18%"] },
        { label: "Acima de 12,1m²", values: ["26%", "31%", "34%", "18%"] },
      ]
    }),
    notes: "Acima de 14 metros usar somente tabela de uma cor, mesmo que tenha até 3 cores.\nCobrar adicional para peças menores que 18cm. Mínimo mínimo Entre 10 e 18 cm (VENDA DIRETA)\nNÃO PASSAMOS MASSA NAS LATERAIS",
  },
  {
    page: 3,
    sectionOrder: 3,
    sectionTitle: "Verniz Dourado Inox — Somente áreas internas",
    contentJson: JSON.stringify({
      type: "margin_table_multi",
      columns: ["Área", "Margem"],
      rows: [
        { label: "Menor que 0,34m²", values: ["33%"] },
        { label: "Entre 0,35 e 0,75m²", values: ["33%"] },
        { label: "Entre 0,75 e 1m²", values: ["27%"] },
        { label: "Entre 1m² e 1,5m²", values: ["27%"] },
        { label: "Entre 1,6m² e 4m²", values: ["22%"] },
        { label: "Entre 4,1m² e 8m²", values: ["22%"] },
        { label: "Entre 8,1m² e 12m²", values: ["24%"] },
        { label: "Acima de 12,1m²", values: ["24%"] },
      ]
    }),
    notes: null,
  },
  {
    page: 3,
    sectionOrder: 4,
    sectionTitle: "Mínimos e Serviços Especiais",
    contentJson: JSON.stringify({
      type: "list",
      items: [
        "Mínimo gabarito kraft: R$39,90",
        "Mínimo gabarito Eucadur: R$49,90",
        "Mínimo gabarito papelão: R$44,90",
        "Mínimo montagem de LEDs backlight: R$80,00",
        "Mínimo montagem de LEDs frontlight: R$100,00",
        "Acabamentos especiais: a) Aplicação de adesivo em acrílico; b) Aplicação Verniz Brilho; c) Aplicação Verniz Fosco",
      ]
    }),
    notes: null,
  },
];

const allSections = [...page1Sections, ...page2Sections, ...page3Sections];

for (const s of allSections) {
  await conn.execute(
    "INSERT INTO price_table_sections (page, sectionOrder, sectionTitle, contentJson, notes) VALUES (?, ?, ?, ?, ?)",
    [s.page, s.sectionOrder, s.sectionTitle, s.contentJson, s.notes ?? null]
  );
}

console.log(`Seed aplicado: ${allSections.length} seções inseridas.`);
await conn.end();
