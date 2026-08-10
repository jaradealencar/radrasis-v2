import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface RetrabalhoRow {
  id: number;
  osRetrabalhada: string;
  osOriginal: string;
  data: Date | string;
  setor: string;
  tipo: string;
  custo: string | number | null;
  frete: string | number | null;
  total: string | number | null;
  codigoErro?: string | null;
  responsavel?: string | null;
  descricao?: string | null;
  classe: string;
  mes?: string | null;
}

// ─── Paleta de cores por setor ────────────────────────────────────────────────
const SETOR_COLORS: Record<string, [number, number, number]> = {
  "SOLDA":       [249, 115,  22],
  "PINTURA":     [168,  85, 247],
  "EXPEDIÇÃO":   [ 59, 130, 246],
  "PROJETO":     [ 99, 102, 241],
  "FIBRA":       [ 34, 197,  94],
  "ROUTER":      [  6, 182, 212],
  "CO2":         [239,  68,  68],
  "DOBRADEIRA":  [234, 179,   8],
  "FORNECEDOR":  [ 20, 184, 166],
  "TRANSPORTE":  [ 14, 165, 233],
  "INSTALAÇÃO":  [132, 204,  22],
  "VENDAS":      [251, 146,  60],
  "POLIMENTO":   [148, 163, 184],
  "OUTROS":      [100, 116, 139],
};

const FALLBACK_COLORS: [number, number, number][] = [
  [59, 130, 246],[239, 68, 68],[34, 197, 94],[249, 115, 22],[168, 85, 247],
  [6, 182, 212],[234, 179, 8],[20, 184, 166],[99, 102, 241],[132, 204, 22],
];

function getSetorColor(setor: string, idx: number): [number, number, number] {
  const key = setor.toUpperCase().trim();
  return SETOR_COLORS[key] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

function darken(rgb: [number, number, number], factor = 0.6): [number, number, number] {
  return [Math.round(rgb[0] * factor), Math.round(rgb[1] * factor), Math.round(rgb[2] * factor)];
}

function lighten(rgb: [number, number, number], factor = 0.92): [number, number, number] {
  return [
    Math.round(rgb[0] + (255 - rgb[0]) * factor),
    Math.round(rgb[1] + (255 - rgb[1]) * factor),
    Math.round(rgb[2] + (255 - rgb[2]) * factor),
  ];
}

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val ?? "0").replace(",", ".")) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function fmtDate(d: Date | string): string {
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
}

// ─── Função principal ─────────────────────────────────────────────────────────
export function exportarRelatorioPDF(rows: RetrabalhoRow[], filtroDescricao?: string) {
  if (rows.length === 0) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210;
  const PH = 297;
  const ML = 12;
  const MR = 12;
  const CW = PW - ML - MR;
  const BOTTOM_MARGIN = 20; // espaço reservado para rodapé
  const geradoEm = new Date().toLocaleString("pt-BR");

  // ── Controle de página ────────────────────────────────────────────────────
  let pageNum = 1;

  function drawPageFooter() {
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.setFont("helvetica", "normal");
    doc.text("Letreiros Express — Relatório de Retrabalhos", ML, PH - 6);
    doc.text(`Gerado em ${geradoEm}`, PW / 2, PH - 6, { align: "center" });
    doc.text(`Pág. ${pageNum}`, PW - MR, PH - 6, { align: "right" });
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(ML, PH - 9, PW - MR, PH - 9);
  }

  function addPage() {
    doc.addPage();
    pageNum++;
    drawPageFooter();
  }

  // Garante espaço suficiente; se não houver, quebra página
  // Retorna o y atual (possivelmente resetado para 18 após quebra)
  function ensureSpace(y: number, needed: number): number {
    if (y + needed > PH - BOTTOM_MARGIN) {
      addPage();
      return 18;
    }
    return y;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — CAPA
  // ════════════════════════════════════════════════════════════════════════════

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, PW, 68, "F");
  doc.setFillColor(234, 88, 12);
  doc.rect(0, 65, PW, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text("RELATÓRIO DE RETRABALHOS", PW / 2, 28, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Letreiros Express — Portal de Gestão", PW / 2, 38, { align: "center" });

  if (filtroDescricao) {
    doc.setFontSize(9);
    doc.setTextColor(251, 191, 36);
    doc.text(`Filtro: ${filtroDescricao}`, PW / 2, 48, { align: "center" });
  }

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado em ${geradoEm}`, PW / 2, 58, { align: "center" });

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const totalRetrabalhos = rows.length;
  const totalCusto = rows.reduce((s, r) => s + (parseFloat(String(r.custo ?? "0").replace(",", ".")) || 0), 0);
  const totalFrete = rows.reduce((s, r) => s + (parseFloat(String(r.frete ?? "0").replace(",", ".")) || 0), 0);
  const totalGeral = rows.reduce((s, r) => s + (parseFloat(String(r.total ?? "0").replace(",", ".")) || 0), 0);
  const totalEvitavel = rows.filter(r => r.classe === "EVITÁVEL").length;
  const pctEvitavel = totalRetrabalhos > 0 ? Math.round((totalEvitavel / totalRetrabalhos) * 100) : 0;

  const kpiCards = [
    { label: "Total de Retrabalhos", value: String(totalRetrabalhos), color: [59, 130, 246] as [number, number, number] },
    { label: "Custo Total", value: fmt(totalCusto), color: [239, 68, 68] as [number, number, number] },
    { label: "Frete Total", value: fmt(totalFrete), color: [249, 115, 22] as [number, number, number] },
    { label: "Total Geral", value: fmt(totalGeral), color: [220, 38, 38] as [number, number, number] },
    { label: "Evitáveis", value: `${totalEvitavel} (${pctEvitavel}%)`, color: [234, 88, 12] as [number, number, number] },
  ];

  const cardW = (CW - 4 * 3) / 5;
  let cx = ML;
  const cardY = 76;
  kpiCards.forEach((card) => {
    const [r, g, b] = card.color;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(cx, cardY, cardW, 22, 2, 2, "F");
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.4);
    doc.roundedRect(cx, cardY, cardW, 22, 2, 2, "S");
    doc.setFillColor(r, g, b);
    doc.roundedRect(cx, cardY, cardW, 3.5, 2, 2, "F");
    doc.rect(cx, cardY + 1.5, cardW, 2, "F");
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(card.label.toUpperCase(), cx + cardW / 2, cardY + 8.5, { align: "center" });
    doc.setFontSize(card.value.length > 12 ? 7 : 8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(r, g, b);
    doc.text(card.value, cx + cardW / 2, cardY + 16.5, { align: "center" });
    cx += cardW + 3;
  });

  // ── Gráfico de barras por setor ───────────────────────────────────────────
  const setoresMap = new Map<string, number>();
  rows.forEach(r => {
    const s = r.setor?.toUpperCase().trim() || "OUTROS";
    setoresMap.set(s, (setoresMap.get(s) ?? 0) + 1);
  });
  const setoresSorted = [...setoresMap.entries()].sort((a, b) => b[1] - a[1]);

  let sy = cardY + 30;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("DISTRIBUIÇÃO POR SETOR", ML, sy);
  sy += 5;

  const barMaxW = CW;
  const barH = 5;
  const barGap = 2;
  setoresSorted.forEach(([setor, count], idx) => {
    const color = getSetorColor(setor, idx);
    const pct = totalRetrabalhos > 0 ? count / totalRetrabalhos : 0;
    const barW = Math.max(barMaxW * pct, 2);

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(ML, sy, barMaxW, barH, 1, 1, "F");
    doc.setFillColor(...color);
    doc.roundedRect(ML, sy, barW, barH, 1, 1, "F");

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    if (barW > 22) {
      doc.setTextColor(255, 255, 255);
      doc.text(setor, ML + 2.5, sy + barH - 1.3);
    } else {
      doc.setTextColor(30, 41, 59);
      doc.text(setor, ML + barW + 2, sy + barH - 1.3);
    }
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.text(`${count} (${Math.round(pct * 100)}%)`, PW - MR, sy + barH - 1.3, { align: "right" });

    sy += barH + barGap;
    if (sy > PH - BOTTOM_MARGIN) {
      addPage();
      sy = 18;
    }
  });

  drawPageFooter();

  // ════════════════════════════════════════════════════════════════════════════
  // SEÇÕES POR SETOR — SEM addPage() FORÇADO
  // Cada setor continua no fluxo atual da página, quebrando só quando necessário
  // ════════════════════════════════════════════════════════════════════════════

  // Iniciar nova página para as ocorrências (após a capa)
  addPage();
  let y = 18;

  setoresSorted.forEach(([setor], setorIdx) => {
    const setorRows = rows.filter(r => (r.setor?.toUpperCase().trim() || "OUTROS") === setor);
    if (setorRows.length === 0) return;

    const color = getSetorColor(setor, setorIdx);
    const darkColor = darken(color, 0.55);
    const lightColor = lighten(color, 0.88);

    // ── Cabeçalho do setor (altura 13mm) ──────────────────────────────────
    y = ensureSpace(y, 13);

    doc.setFillColor(...color);
    doc.roundedRect(ML, y, CW, 13, 2, 2, "F");

    // Círculo com iniciais
    doc.setFillColor(255, 255, 255);
    doc.circle(ML + 7.5, y + 6.5, 4, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color);
    doc.text(setor.substring(0, 2), ML + 7.5, y + 8.5, { align: "center" });

    // Nome do setor
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(setor, ML + 14, y + 8.5);

    // Contagem (alinhada à direita, dentro da margem)
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${setorRows.length} ocorrência${setorRows.length !== 1 ? "s" : ""}`,
      PW - MR - 2,
      y + 8.5,
      { align: "right" }
    );

    y += 15;

    // ── Mini-cards de totais do setor ──────────────────────────────────────
    y = ensureSpace(y, 14);
    const setorCusto = setorRows.reduce((s, r) => s + (parseFloat(String(r.custo ?? "0").replace(",", ".")) || 0), 0);
    const setorTotal = setorRows.reduce((s, r) => s + (parseFloat(String(r.total ?? "0").replace(",", ".")) || 0), 0);
    const setorEvit = setorRows.filter(r => r.classe === "EVITÁVEL").length;

    const miniCards = [
      { label: "Custo Total", value: fmt(setorCusto) },
      { label: "Total c/ Frete", value: fmt(setorTotal) },
      { label: "Evitáveis", value: `${setorEvit} de ${setorRows.length}` },
    ];
    const mW = (CW - 2 * 3) / 3;
    let mx2 = ML;
    miniCards.forEach((mc) => {
      doc.setFillColor(...lightColor);
      doc.roundedRect(mx2, y, mW, 11, 1.5, 1.5, "F");
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...darkColor);
      doc.text(mc.label.toUpperCase(), mx2 + mW / 2, y + 4, { align: "center" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(mc.value, mx2 + mW / 2, y + 9, { align: "center" });
      mx2 += mW + 3;
    });
    y += 13;

    // ── Ocorrências ────────────────────────────────────────────────────────
    setorRows.forEach((r, rIdx) => {
      const custoVal = parseFloat(String(r.custo ?? "0").replace(",", ".")) || 0;
      const freteVal = parseFloat(String(r.frete ?? "0").replace(",", ".")) || 0;
      const totalVal = parseFloat(String(r.total ?? "0").replace(",", ".")) || 0;

      const descricao = (r.descricao ?? "").trim() || "Sem descrição registrada.";

      // Calcular altura real do card:
      // Linha 1: cabeçalho (OS + data) = 8mm
      // Linha 2: separador = 1mm
      // Linha 3-4: campos (2 linhas de 4 colunas) = 2 × 7 = 14mm
      // Linha 5: label descrição = 5mm
      // Linha 6+: linhas de texto da descrição
      const descWidth = CW - 10; // margem interna
      const descLinesSplit = doc.splitTextToSize(descricao, descWidth);
      const descBlockH = descLinesSplit.length * 4.5;
      const cardHeight = 8 + 1 + 14 + 5 + descBlockH + 4; // +4 padding inferior

      // Se o card não cabe, quebrar página
      y = ensureSpace(y, cardHeight);

      // Fundo alternado
      const bgColor: [number, number, number] = rIdx % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
      doc.setFillColor(...bgColor);
      doc.roundedRect(ML, y, CW, cardHeight, 1.5, 1.5, "F");

      // Borda lateral colorida (3mm)
      doc.setFillColor(...color);
      doc.rect(ML, y, 3, cardHeight, "F");

      // ── Cabeçalho do card ───────────────────────────────────────────────
      // Número
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkColor);
      doc.text(`#${rIdx + 1}`, ML + 5, y + 5.5);

      // OS Retrabalhada
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`OS ${r.osRetrabalhada}`, ML + 13, y + 5.5);

      // Data (direita)
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(fmtDate(r.data), PW - MR - 2, y + 5.5, { align: "right" });

      // Linha separadora
      doc.setDrawColor(...lightColor);
      doc.setLineWidth(0.25);
      doc.line(ML + 4, y + 7.5, PW - MR, y + 7.5);

      // ── Campos em 4 colunas, 2 linhas ──────────────────────────────────
      const fieldY = y + 10;
      const colW = CW / 4;
      const fields: [string, string][] = [
        ["OS Original", String(r.osOriginal ?? "—")],
        ["Tipo",        String(r.tipo ?? "—")],
        ["Classe",      String(r.classe ?? "—")],
        ["Código",      String(r.codigoErro ?? "—")],
        ["Responsável", String(r.responsavel ?? "—")],
        ["Custo",       fmt(custoVal)],
        ["Frete",       fmt(freteVal)],
        ["Total",       fmt(totalVal)],
      ];

      fields.forEach(([label, value], fi) => {
        const col = fi % 4;
        const row = Math.floor(fi / 4);
        const fx = ML + 4 + col * colW;
        const fy = fieldY + row * 7;

        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(label.toUpperCase(), fx, fy);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        if (label === "Classe") {
          doc.setTextColor(
            r.classe === "EVITÁVEL" ? 220 : 180,
            r.classe === "EVITÁVEL" ? 38 : 120,
            r.classe === "EVITÁVEL" ? 38 : 0
          );
        } else if (label === "Total") {
          doc.setTextColor(220, 38, 38);
        } else {
          doc.setTextColor(15, 23, 42);
        }
        doc.text(value, fx, fy + 4);
      });

      // ── Descrição completa ──────────────────────────────────────────────
      const descStartY = fieldY + 14 + 3; // após 2 linhas de campos + espaço

      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...color);
      doc.text("DESCRIÇÃO DO PROBLEMA", ML + 4, descStartY);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(30, 41, 59);
      // Renderizar todas as linhas da descrição
      doc.text(descLinesSplit, ML + 4, descStartY + 4.5);

      y += cardHeight + 2.5;
    });

    // Pequeno espaço entre setores
    y += 4;
  });

  // ════════════════════════════════════════════════════════════════════════════
  // PAINEL DE COLABORADORES
  // ════════════════════════════════════════════════════════════════════════════

  addPage();
  let cy2 = 18;

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(ML, cy2, CW, 13, 2, 2, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("PAINEL DE COLABORADORES", ML + 5, cy2 + 9);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Incidências de retrabalho por responsável", PW - MR - 2, cy2 + 9, { align: "right" });
  cy2 += 18;

  const colaboradorMap = new Map<string, { total: number; evitavel: number; setores: Set<string>; custo: number }>();
  rows.forEach(r => {
    const nome = r.responsavel?.trim() || "Não informado";
    if (!colaboradorMap.has(nome)) {
      colaboradorMap.set(nome, { total: 0, evitavel: 0, setores: new Set(), custo: 0 });
    }
    const entry = colaboradorMap.get(nome)!;
    entry.total++;
    if (r.classe === "EVITÁVEL") entry.evitavel++;
    entry.setores.add(r.setor?.toUpperCase().trim() || "OUTROS");
    entry.custo += parseFloat(String(r.total ?? "0").replace(",", ".")) || 0;
  });

  const colaboradoresSorted = [...colaboradorMap.entries()].sort((a, b) => b[1].total - a[1].total);
  const maxIncidencias = colaboradoresSorted[0]?.[1].total ?? 1;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Total de colaboradores: ${colaboradoresSorted.length}  |  Total de registros: ${rows.length}`, ML, cy2);
  cy2 += 6;

  const tableBody = colaboradoresSorted.map(([nome, data], idx) => {
    const pctEvit = data.total > 0 ? Math.round((data.evitavel / data.total) * 100) : 0;
    return [
      String(idx + 1),
      nome,
      String(data.total),
      String(data.evitavel),
      `${pctEvit}%`,
      [...data.setores].join(", "),
      fmt(data.custo),
    ];
  });

  autoTable(doc, {
    startY: cy2,
    head: [["#", "Colaborador", "Incidências", "Evitáveis", "% Evit.", "Setores", "Custo Total"]],
    body: tableBody,
    margin: { left: ML, right: MR },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      font: "helvetica",
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 38 },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 50 },
      6: { cellWidth: 28, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const count = parseInt(String(data.cell.raw)) || 0;
        const intensity = Math.min(count / maxIncidencias, 1);
        const r2 = Math.round(239 + (220 - 239) * intensity);
        const g2 = Math.round(246 + (38 - 246) * intensity);
        const b2 = Math.round(255 + (38 - 255) * intensity);
        data.cell.styles.fillColor = [r2, g2, b2];
        data.cell.styles.fontStyle = "bold";
        if (intensity > 0.5) data.cell.styles.textColor = [255, 255, 255];
      }
      if (data.section === "body" && data.column.index === 4) {
        const pct = parseInt(String(data.cell.raw)) || 0;
        if (pct > 70) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        } else if (pct > 40) {
          data.cell.styles.textColor = [234, 88, 12];
        }
      }
    },
    didDrawPage: () => {
      drawPageFooter();
    },
  });

  drawPageFooter();

  const dataStr = new Date().toISOString().split("T")[0];
  doc.save(`relatorio_retrabalhos_${dataStr}.pdf`);
}
