/**
 * Gerador de PDF para POP — usa jsPDF puro, sem html2canvas.
 * Suporta texto puro e HTML do Tiptap/RichTextEditor.
 * Usa o mesmo padrão htmlToLines do CargoseFuncoes.tsx.
 */
import jsPDF from "jspdf";

export type ParsedPop = {
  popCode: string;
  title: string;
  version?: string | null;
  sector?: string;
  parsed: {
    title?: string;
    objective: string;
    steps: Array<{ step: number; action: string; check: string }>;
    attention_points: string[];
    acceptance_criteria: string;
  };
};

type LineRecord = {
  text: string;
  bold: boolean;
  italic: boolean;
  heading: number;
  listItem: boolean;
  ordered: boolean;
  listIndex?: number;
};

// ─── Converte HTML do TipTap para linhas de texto puro ────────────────────────
function htmlToLines(html: string): LineRecord[] {
  if (!html?.trim()) return [];

  // Se não é HTML, converte texto plano legado
  if (!html.trim().startsWith("<")) {
    return html.split("\n")
      .filter(l => l.trim())
      .map(line => ({
        text: line.replace(/\*\*(.*?)\*\*/g, "$1"),
        bold: false, italic: false, heading: 0, listItem: false, ordered: false,
      }));
  }

  // Ignorar HTML vazio do Tiptap
  const stripped = html.replace(/<[^>]+>/g, "").trim();
  if (!stripped) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const lines: LineRecord[] = [];

  function nodeText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    return Array.from(node.childNodes).map(nodeText).join("");
  }

  function processNode(node: Node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName;

    if (tag === "P" || tag === "DIV") {
      const text = nodeText(el).trim();
      if (text) {
        const hasBold = el.querySelector("strong, b") !== null;
        const hasItalic = el.querySelector("em, i") !== null;
        lines.push({ text, bold: hasBold, italic: hasItalic && !hasBold, heading: 0, listItem: false, ordered: false });
      }
    } else if (tag === "H1" || tag === "H2") {
      const text = nodeText(el).trim();
      if (text) lines.push({ text, bold: true, italic: false, heading: 2, listItem: false, ordered: false });
    } else if (tag === "H3") {
      const text = nodeText(el).trim();
      if (text) lines.push({ text, bold: true, italic: false, heading: 3, listItem: false, ordered: false });
    } else if (tag === "UL") {
      Array.from(el.children).forEach(li => {
        const text = nodeText(li).trim();
        if (text) lines.push({ text, bold: false, italic: false, heading: 0, listItem: true, ordered: false });
      });
    } else if (tag === "OL") {
      Array.from(el.children).forEach((li, idx) => {
        const text = nodeText(li).trim();
        if (text) lines.push({ text, bold: false, italic: false, heading: 0, listItem: true, ordered: true, listIndex: idx + 1 });
      });
    } else if (tag === "STRONG" || tag === "B") {
      const text = nodeText(el).trim();
      if (text) lines.push({ text, bold: true, italic: false, heading: 0, listItem: false, ordered: false });
    } else if (tag === "EM" || tag === "I") {
      const text = nodeText(el).trim();
      if (text) lines.push({ text, bold: false, italic: true, heading: 0, listItem: false, ordered: false });
    } else {
      Array.from(el.childNodes).forEach(child => processNode(child));
    }
  }

  Array.from(doc.body.childNodes).forEach(n => processNode(n));
  return lines.filter(l => l.text.length > 0);
}

// ─── Cor RGB por categoria ────────────────────────────────────────────────────
function getCategoryRgb(category: string): [number, number, number] {
  const map: Record<string, [number, number, number]> = {
    PINTURA:    [147, 51, 234],
    SOLDA:      [249, 115, 22],
    EXPEDICAO:  [59, 130, 246],
    PROJETO:    [99, 102, 241],
    FIBRA:      [34, 197, 94],
    ROUTER:     [6, 182, 212],
    CO2:        [239, 68, 68],
    DOBRADEIRA: [234, 179, 8],
    FORNECEDOR: [20, 184, 166],
    TRANSPORTE: [14, 165, 233],
    INSTALACAO: [132, 204, 22],
    VENDAS:     [251, 146, 60],
    POLIMENTO:  [100, 116, 139],
    ILUMINACAO: [245, 158, 11],
  };
  const key = category.toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
  return map[key] ?? [82, 130, 200];
}

// ─── Gerador principal ────────────────────────────────────────────────────────
export function downloadPopParsedAsPdf(pop: ParsedPop): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const pageW = 210;
  const pageH = 297;
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR; // 182mm
  const FOOTER_Y = 280;
  const MAX_Y = FOOTER_Y - 5;

  const title = pop.parsed.title ?? pop.title;
  const version = pop.version ?? "1.0";
  const sector = pop.sector ?? pop.popCode.replace("POP-", "");
  const dateStr = new Date().toLocaleDateString("pt-BR");
  const [r, g, b] = getCategoryRgb(sector);
  const dr = Math.max(0, r - 50);
  const dg = Math.max(0, g - 50);
  const db = Math.max(0, b - 50);

  let y = 0;

  // ── Cabeçalho ────────────────────────────────────────────────────────────────
  function drawHeader(isFirst: boolean) {
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setFillColor(dr, dg, db);
    doc.rect(0, 28, pageW, 11, "F");

    // Nome empresa
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("LETREIROS EXPRESS", marginL, 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text("PROCEDIMENTO OPERACIONAL PADRÃO  —  TREINAMENTO E OPERAÇÃO", marginL, 19);

    // Caixa código
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageW - marginR - 32, 4, 32, 18, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(r, g, b);
    doc.text(pop.popCode, pageW - marginR - 16, 13, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(dr, dg, db);
    doc.text(`v${version}`, pageW - marginR - 16, 19, { align: "center" });

    if (isFirst) {
      // Título na faixa escura
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      const titleLines = doc.splitTextToSize(title, contentW - 38) as string[];
      doc.text(titleLines, marginL, 34);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(220, 220, 220);
      doc.text(`Setor: ${sector}   •   Emissão: ${dateStr}`, marginL, 36 + titleLines.length * 4);
      y = 46;
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(title, marginL, 34);
      y = 42;
    }
  }

  // ── Rodapé ────────────────────────────────────────────────────────────────────
  function drawFooter(page: number, total: number) {
    doc.setFillColor(248, 250, 252);
    doc.rect(0, FOOTER_Y, pageW, 17, "F");
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.4);
    doc.line(0, FOOTER_Y, pageW, FOOTER_Y);

    // Linhas de assinatura
    const sigY = FOOTER_Y + 11;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(marginL, sigY, marginL + 52, sigY);
    doc.line(marginL + 62, sigY, marginL + 114, sigY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text("Responsável", marginL + 26, sigY + 3, { align: "center" });
    doc.text("Aprovado por", marginL + 88, sigY + 3, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${pop.popCode}  —  v${version}`, pageW - marginR, FOOTER_Y + 6, { align: "right" });
    doc.text(`Página ${page} de ${total}`, pageW - marginR, FOOTER_Y + 11, { align: "right" });
  }

  // ── Verificação de quebra de página ──────────────────────────────────────────
  function checkPageBreak(needed: number) {
    if (y + needed > MAX_Y) {
      doc.addPage();
      drawHeader(false);
    }
  }

  // ── Escreve linhas de texto com formatação ────────────────────────────────────
  function writeLines(lines: LineRecord[], xOffset = 0, maxW = contentW, colorRgb: [number, number, number] = [51, 65, 85]) {
    for (const line of lines) {
      if (!line.text.trim()) continue;

      const prefix = line.listItem
        ? (line.ordered ? `${line.listIndex ?? "•"}.  ` : "•  ")
        : "";
      const fullText = prefix + line.text;
      const effectiveW = maxW - xOffset - (line.listItem ? 4 : 0);

      const fontSize = line.heading === 2 ? 11 : line.heading === 3 ? 10 : 9;
      const fontStyle = line.bold ? "bold" : line.italic ? "italic" : "normal";
      const textColor: [number, number, number] = line.heading > 0 ? [15, 23, 42] : colorRgb;

      doc.setFont("helvetica", fontStyle);
      doc.setFontSize(fontSize);
      doc.setTextColor(...textColor);

      const wrapped = doc.splitTextToSize(fullText, effectiveW) as string[];
      const lineH = line.heading > 0 ? 6 : 5.2;
      const blockH = wrapped.length * lineH;

      checkPageBreak(blockH + 2);

      const textX = marginL + xOffset + (line.listItem ? 4 : 0);
      doc.text(wrapped, textX, y);
      y += blockH + (line.heading > 0 ? 2 : 1);
    }
  }

  // ── Seção header colorida ─────────────────────────────────────────────────────
  function drawSectionHeader(label: string) {
    checkPageBreak(10);
    doc.setFillColor(r, g, b);
    doc.rect(marginL, y, contentW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(label, marginL + 3, y + 4.8);
    y += 9;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERIZAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════

  drawHeader(true);

  // ── OBJETIVO ─────────────────────────────────────────────────────────────────
  const objLines = htmlToLines(pop.parsed.objective);
  if (objLines.length > 0) {
    checkPageBreak(20);

    // Estimar altura
    const estLines = objLines.flatMap(l =>
      (doc.splitTextToSize(l.text, contentW - 10) as string[])
    );
    const boxH = estLines.length * 5.2 + 14;

    doc.setFillColor(r, g, b);
    doc.rect(marginL, y, 3, boxH, "F");
    doc.setFillColor(245, 248, 255);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.2);
    doc.rect(marginL + 3, y, contentW - 3, boxH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(r, g, b);
    doc.text("OBJETIVO DO PROCEDIMENTO", marginL + 6, y + 5.5);
    y += 10;

    writeLines(objLines, 6, contentW - 10, [30, 58, 138]);
    y += 4;
  }

  // ── PASSOS ───────────────────────────────────────────────────────────────────
  drawSectionHeader("PASSOS DO PROCEDIMENTO");

  for (let i = 0; i < pop.parsed.steps.length; i++) {
    const s = pop.parsed.steps[i];
    const actionLines = htmlToLines(s.action);
    const checkLines = htmlToLines(s.check);

    // Largura disponível para o texto dentro do bloco
    // Faixa lateral: 11mm | padding esquerdo: 3mm | padding direito: 3mm
    const textW = contentW - 11 - 3 - 3; // = 165mm

    // Calcular altura necessária
    const aLines = actionLines.flatMap(l => {
      const prefix = l.listItem ? (l.ordered ? `${l.listIndex}.  ` : "•  ") : "";
      return doc.splitTextToSize(prefix + l.text, textW) as string[];
    });
    const cLines = checkLines.flatMap(l =>
      doc.splitTextToSize(l.text, textW - 6) as string[]
    );

    const lineH = 5.2;
    const actionH = Math.max(aLines.length * lineH, 8);
    const checkH = cLines.length > 0 ? cLines.length * 4.8 + 7 : 0;
    const blockH = actionH + checkH + 10;

    checkPageBreak(blockH + 3);

    // Fundo alternado
    doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(marginL, y, contentW, blockH, "FD");

    // Faixa lateral com número
    doc.setFillColor(r, g, b);
    doc.rect(marginL, y, 11, blockH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(String(s.step), marginL + 5.5, y + blockH / 2 + 1.5, { align: "center" });

    // Texto da ação
    const textX = marginL + 14; // após faixa (11) + padding (3)
    let innerY = y + 5;

    // Salvar y global e usar innerY local para o conteúdo do bloco
    const savedY = y;

    for (const line of actionLines) {
      if (!line.text.trim()) continue;
      const prefix = line.listItem ? (line.ordered ? `${line.listIndex}.  ` : "•  ") : "";
      const fullText = prefix + line.text;
      const fontStyle = line.bold ? "bold" : line.italic ? "italic" : "bold";
      doc.setFont("helvetica", fontStyle);
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const wrapped = doc.splitTextToSize(fullText, textW) as string[];
      doc.text(wrapped, textX, innerY);
      innerY += wrapped.length * lineH;
    }

    // Verificação (check)
    if (checkLines.length > 0) {
      innerY += 2;
      const checkBoxH = cLines.length * 4.8 + 5;
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(0.25);
      doc.rect(textX, innerY - 1, textW + 3, checkBoxH, "FD");

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(21, 128, 61);
      let checkY = innerY + 3;
      for (const line of checkLines) {
        const wrapped = doc.splitTextToSize("✓  " + line.text, textW - 2) as string[];
        doc.text(wrapped, textX + 2, checkY);
        checkY += wrapped.length * 4.8;
      }
    }

    y = savedY + blockH + 2;
  }

  // ── PONTOS DE ATENÇÃO ─────────────────────────────────────────────────────────
  if (pop.parsed.attention_points.length > 0) {
    y += 3;
    const allPtLines = pop.parsed.attention_points.flatMap(pt => htmlToLines(pt));
    if (allPtLines.length > 0) {
      const estLines = allPtLines.flatMap(l =>
        doc.splitTextToSize("▸  " + l.text, contentW - 10) as string[]
      );
      const boxH = estLines.length * 5.2 + 14;
      checkPageBreak(boxH + 4);

      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(253, 230, 138);
      doc.setLineWidth(0.3);
      doc.roundedRect(marginL, y, contentW, boxH, 2, 2, "FD");
      doc.setFillColor(217, 119, 6);
      doc.rect(marginL, y, 3, boxH, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(180, 83, 9);
      doc.text("PONTOS DE ATENÇÃO", marginL + 6, y + 6);
      y += 11;

      for (const line of allPtLines) {
        const wrapped = doc.splitTextToSize("▸  " + line.text, contentW - 10) as string[];
        checkPageBreak(wrapped.length * 5.2 + 2);
        doc.setFont("helvetica", line.bold ? "bold" : "normal");
        doc.setFontSize(9);
        doc.setTextColor(120, 53, 15);
        doc.text(wrapped, marginL + 6, y);
        y += wrapped.length * 5.2 + 2;
      }
      y += 5;
    }
  }

  // ── CRITÉRIO DE ACEITAÇÃO ─────────────────────────────────────────────────────
  const critLines = htmlToLines(pop.parsed.acceptance_criteria);
  if (critLines.length > 0) {
    const estLines = critLines.flatMap(l =>
      doc.splitTextToSize(l.text, contentW - 10) as string[]
    );
    const boxH = estLines.length * 5.2 + 14;
    checkPageBreak(boxH + 4);

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginL, y, contentW, boxH, 2, 2, "FD");
    doc.setFillColor(22, 163, 74);
    doc.rect(marginL, y, 3, boxH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(21, 128, 61);
    doc.text("CRITÉRIO DE ACEITAÇÃO", marginL + 6, y + 6);
    y += 11;

    for (const line of critLines) {
      const wrapped = doc.splitTextToSize(line.text, contentW - 10) as string[];
      checkPageBreak(wrapped.length * 5.2 + 2);
      doc.setFont("helvetica", line.bold ? "bold" : "normal");
      doc.setFontSize(9);
      doc.setTextColor(20, 83, 45);
      doc.text(wrapped, marginL + 6, y);
      y += wrapped.length * 5.2 + 2;
    }
  }

  // ── Rodapé em todas as páginas ────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  const safeName = title
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "").trim()
    .replace(/\s+/g, "_").slice(0, 40);
  doc.save(`${pop.popCode}_v${version}_${safeName}.pdf`);
}
