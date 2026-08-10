import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type PopData = {
  code: string;
  title: string;
  sector: string;
  version?: string | null;
  objective?: string | null;
  steps: string;
  responsible?: string | null;
};

// ─── Extrai texto puro de HTML ────────────────────────────────────────────────
function stripHtml(html: string): string {
  if (!html?.trim()) return "";
  if (!html.trim().startsWith("<")) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

// ─── Monta o HTML completo do POP para renderização ──────────────────────────
function buildPopHtml(pop: PopData): string {
  const objectiveHtml = pop.objective
    ? pop.objective.trim().startsWith("<")
      ? pop.objective
      : `<p>${pop.objective}</p>`
    : "";

  const stepsHtml = pop.steps
    ? pop.steps.trim().startsWith("<")
      ? pop.steps
      : `<p style="white-space:pre-wrap">${pop.steps}</p>`
    : "";

  const metaParts = [
    `<span>Setor: <strong>${pop.sector}</strong></span>`,
    pop.responsible ? `<span>Responsável: <strong>${pop.responsible}</strong></span>` : null,
    `<span>Emitido em: <strong>${new Date().toLocaleDateString("pt-BR")}</strong></span>`,
  ].filter(Boolean).join('<span style="color:#94a3b8;margin:0 8px">•</span>');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    line-height: 1.6;
    color: #1e293b;
    background: #ffffff;
    width: 794px;
    padding: 0;
  }

  /* ── Cabeçalho ── */
  .header {
    background: #0f172a;
    padding: 18px 28px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .header-left {}
  .header-brand {
    font-size: 15px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .header-subtitle {
    font-size: 9px;
    color: #94a3b8;
    margin-top: 2px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .header-right { text-align: right; }
  .header-code {
    font-size: 13px;
    font-weight: 700;
    color: #60a5fa;
    letter-spacing: 0.5px;
  }
  .header-version {
    font-size: 10px;
    color: #94a3b8;
    margin-top: 2px;
  }

  /* ── Corpo ── */
  .body { padding: 24px 28px 28px; }

  /* ── Título ── */
  .pop-title {
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.3;
    margin-bottom: 8px;
  }

  /* ── Meta ── */
  .pop-meta {
    font-size: 11px;
    color: #64748b;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    margin-bottom: 16px;
  }

  /* ── Divisor ── */
  .divider {
    border: none;
    border-top: 1.5px solid #e2e8f0;
    margin-bottom: 20px;
  }

  /* ── Objetivo ── */
  .objective-box {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    padding: 14px 16px;
    margin-bottom: 20px;
  }
  .section-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .section-label.blue { color: #1d4ed8; }
  .section-label.slate { color: #475569; }
  .section-label.amber { color: #b45309; }
  .section-label.green { color: #15803d; }
  .objective-box .section-label::before {
    content: '';
    display: inline-block;
    width: 3px;
    height: 12px;
    background: #3b82f6;
    border-radius: 2px;
  }
  .objective-content {
    font-size: 12.5px;
    color: #1e3a8a;
    line-height: 1.65;
  }
  .objective-content p { margin: 0 0 6px; }
  .objective-content p:last-child { margin-bottom: 0; }
  .objective-content ul, .objective-content ol {
    padding-left: 20px;
    margin: 4px 0 6px;
  }
  .objective-content li { margin: 2px 0; }

  /* ── Seção de passos ── */
  .steps-header {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 14px;
  }
  .steps-header .section-label { margin-bottom: 0; }
  .steps-header .section-label::before {
    content: '';
    display: inline-block;
    width: 3px;
    height: 12px;
    background: #64748b;
    border-radius: 2px;
  }

  /* ── Conteúdo dos passos (HTML do TipTap) ── */
  .steps-content {
    font-size: 12.5px;
    color: #334155;
    line-height: 1.7;
  }
  .steps-content p {
    margin: 0 0 10px;
  }
  .steps-content p:last-child { margin-bottom: 0; }
  .steps-content h2 {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    margin: 14px 0 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e2e8f0;
  }
  .steps-content h3 {
    font-size: 12.5px;
    font-weight: 600;
    color: #1e293b;
    margin: 12px 0 5px;
  }
  .steps-content ul {
    list-style: disc;
    padding-left: 22px;
    margin: 6px 0 10px;
  }
  .steps-content ol {
    list-style: decimal;
    padding-left: 22px;
    margin: 6px 0 10px;
  }
  .steps-content li {
    margin: 4px 0;
    line-height: 1.6;
  }
  .steps-content li p { margin: 0; }
  .steps-content strong { font-weight: 700; color: #0f172a; }
  .steps-content em { font-style: italic; }
  .steps-content u { text-decoration: underline; }

  /* ── Rodapé ── */
  .footer {
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    padding: 10px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 24px;
  }
  .footer-left {
    font-size: 9px;
    color: #94a3b8;
  }
  .footer-right {
    font-size: 9px;
    color: #94a3b8;
  }
  .footer-code {
    font-weight: 600;
    color: #64748b;
  }
</style>
</head>
<body>
  <!-- Cabeçalho -->
  <div class="header">
    <div class="header-left">
      <div class="header-brand">Letreiros Express</div>
      <div class="header-subtitle">Portal de Gestão — Procedimento Operacional Padrão</div>
    </div>
    <div class="header-right">
      <div class="header-code">${pop.code}</div>
      ${pop.version ? `<div class="header-version">v${pop.version}</div>` : ""}
    </div>
  </div>

  <!-- Corpo -->
  <div class="body">
    <div class="pop-title">${pop.title}</div>
    <div class="pop-meta">${metaParts}</div>
    <hr class="divider">

    ${objectiveHtml ? `
    <div class="objective-box">
      <div class="section-label blue">Objetivo</div>
      <div class="objective-content">${objectiveHtml}</div>
    </div>
    ` : ""}

    <div class="steps-header">
      <div class="section-label slate">Passos do Procedimento</div>
    </div>
    <div class="steps-content">${stepsHtml}</div>
  </div>

  <!-- Rodapé -->
  <div class="footer">
    <div class="footer-left">
      <span class="footer-code">${pop.code}</span> — ${pop.title}
    </div>
    <div class="footer-right">
      Letreiros Express • ${new Date().toLocaleDateString("pt-BR")}
    </div>
  </div>
</body>
</html>`;
}

// ─── Exporta o POP como PDF usando html2canvas ────────────────────────────────
export async function downloadPopAsPdf(pop: PopData): Promise<void> {
  // 1. Criar iframe oculto para renderizar o HTML isolado
  const iframe = document.createElement("iframe");
  iframe.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 794px;
    height: 1px;
    border: none;
    visibility: hidden;
  `;
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error("Não foi possível criar o iframe");

    iframeDoc.open();
    iframeDoc.write(buildPopHtml(pop));
    iframeDoc.close();

    // 2. Aguardar fontes e imagens carregarem
    await new Promise<void>((resolve) => {
      const check = () => {
        if (iframeDoc.readyState === "complete") {
          // Aguardar mais um pouco para as fontes do Google carregarem
          setTimeout(resolve, 800);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });

    const iframeBody = iframeDoc.body;
    // Ajustar altura do iframe para o conteúdo real
    const contentHeight = iframeBody.scrollHeight;
    iframe.style.height = `${contentHeight}px`;

    // 3. Renderizar com html2canvas
    const canvas = await html2canvas(iframeBody, {
      scale: 2, // Alta resolução (2x para nitidez)
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: 794,
      height: contentHeight,
      windowWidth: 794,
      logging: false,
    });

    // 4. Gerar PDF A4 com paginação automática
    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const marginMm = 0; // sem margem extra — o HTML já tem padding

    const imgWidthMm = pageWidthMm - marginMm * 2;
    const pxPerMm = canvas.width / imgWidthMm;
    const pageHeightPx = pageHeightMm * pxPerMm;

    const doc = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    });

    let remainingHeight = canvas.height;
    let sourceY = 0;
    let isFirstPage = true;

    while (remainingHeight > 0) {
      const sliceHeight = Math.min(pageHeightPx, remainingHeight);

      // Criar canvas da fatia
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeight;
      const ctx = sliceCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      const imgData = sliceCanvas.toDataURL("image/jpeg", 0.95);
      const sliceHeightMm = sliceHeight / pxPerMm;

      if (!isFirstPage) doc.addPage();
      doc.addImage(imgData, "JPEG", marginMm, marginMm, imgWidthMm, sliceHeightMm);

      sourceY += sliceHeight;
      remainingHeight -= sliceHeight;
      isFirstPage = false;
    }

    // 5. Salvar
    const filename = `${pop.code.replace(/[^a-zA-Z0-9-]/g, "_")}_${pop.title
      .slice(0, 30)
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "_")}.pdf`;
    doc.save(filename);
  } finally {
    document.body.removeChild(iframe);
  }
}
