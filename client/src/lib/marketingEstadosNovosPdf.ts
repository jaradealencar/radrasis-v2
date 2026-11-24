import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { fmtBrl, fmtDate, fmtNum, fmtPct } from "@/lib/format";

export interface MarketingEstadosNovosPdfLinha {
  estado: string;
  cotacoes: number;
  pedidos: number;
  faturamento: number;
  conversao: number | null;
  clientesUnicos: number;
  clientesComRecompra: number;
  taxaRecompra: number | null;
}

export interface MarketingEstadosNovosPdfResumo {
  cotacoes: number;
  pedidos: number;
  faturamento: number;
  conversao: number | null;
  clientesUnicos: number;
  clientesComRecompra: number;
  taxaRecompra: number | null;
}

export function exportarMarketingEstadosNovosPdf(args: {
  periodo: string;
  linhas: MarketingEstadosNovosPdfLinha[];
  total: MarketingEstadosNovosPdfResumo;
  media: MarketingEstadosNovosPdfResumo | null;
  fontesIndisponiveis?: string[];
  cotacoesSemValor: number;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const larguraUtil = doc.internal.pageSize.getWidth() - 28;
  const pct = (valor: number | null) => valor == null ? "—" : fmtPct(valor, 1);
  const taxaRecompraComBase = (taxa: number | null, clientesComRecompra: number, clientesUnicos: number, casas = 0) =>
    taxa == null ? "—" : `${fmtPct(taxa, 1)}\n${fmtNum(clientesComRecompra, casas)} / ${fmtNum(clientesUnicos, casas)} clientes`;

  doc.setProperties({
    title: "ROI Marketing — Cotações, pedidos e faturamento por Estado",
    subject: `Desempenho de novos clientes por Estado, ${args.periodo}`,
  });
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ROI Marketing | Desempenho por Estado", 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Período: ${args.periodo}  |  Gerado em: ${fmtDate(new Date())}`, 14, 25);

  const metodo = "Inclui cotações e O.S. normais de clientes sem compra em meses anteriores; clientes marcados como recorrentes ficam fora. Cada O.S. conta como uma venda. Taxa Conv. Novos = pedidos (O.S.) ÷ cotações por UF; como o ERP não relaciona a O.S. à cotação de origem, a taxa compara volumes por Estado. Clientes únicos são empresas com primeira compra no período, agrupadas pela UF da primeira compra. Taxa de recompra = percentual desses clientes com outra O.S. normal depois da compra de entrada, observada até hoje; coortes recentes tiveram menos tempo para recomprar. A média por Estado considera as UFs identificadas; registros sem UF entram no total geral, mas não na média.";
  const metodoLinhas = doc.splitTextToSize(metodo, larguraUtil);
  doc.text(metodoLinhas, 14, 31);

  let inicioTabela = 31 + metodoLinhas.length * 4.2 + 3;
  if (args.fontesIndisponiveis?.length) {
    doc.setTextColor(180, 83, 9);
    const alerta = doc.splitTextToSize(`Fontes indisponíveis: ${args.fontesIndisponiveis.join(", ")}. Os dados podem estar incompletos.`, larguraUtil);
    doc.text(alerta, 14, inicioTabela);
    inicioTabela += alerta.length * 4.2 + 3;
  }

  const corpo = args.linhas.length
    ? args.linhas.map(linha => [
        linha.estado,
        fmtNum(linha.cotacoes),
        fmtNum(linha.pedidos),
        fmtNum(linha.clientesUnicos),
        fmtBrl(linha.faturamento),
        pct(linha.conversao),
        taxaRecompraComBase(linha.taxaRecompra, linha.clientesComRecompra, linha.clientesUnicos),
      ])
    : [["Nenhum Estado com dados no período", "—", "—", "—", "—", "—", "—"]];
  const linhaMedia = args.media
    ? ["Média por Estado", fmtNum(args.media.cotacoes, 1), fmtNum(args.media.pedidos, 1), fmtNum(args.media.clientesUnicos, 1), fmtBrl(args.media.faturamento), pct(args.media.conversao), taxaRecompraComBase(args.media.taxaRecompra, args.media.clientesComRecompra, args.media.clientesUnicos, 1)]
    : ["Média por Estado", "—", "—", "—", "—", "—", "—"];

  autoTable(doc, {
    startY: inicioTabela,
    margin: { left: 14, right: 14, top: 14, bottom: 18 },
    head: [["Estado", "Cotações", "Pedidos (O.S.)", "Clientes únicos", "Faturamento", "Taxa Conv. Novos", "Taxa Recompra"]],
    body: corpo,
    foot: [
      [
        "Total geral",
        fmtNum(args.total.cotacoes),
        fmtNum(args.total.pedidos),
        fmtNum(args.total.clientesUnicos),
        fmtBrl(args.total.faturamento),
        pct(args.total.conversao),
        taxaRecompraComBase(args.total.taxaRecompra, args.total.clientesComRecompra, args.total.clientesUnicos),
      ],
      linhaMedia,
    ],
    showFoot: "lastPage",
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.2,
      cellPadding: 1.9,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
    },
    headStyles: { fillColor: [30, 64, 103], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 24, halign: "right" },
      2: { cellWidth: 28, halign: "right" },
      3: { cellWidth: 29, halign: "right" },
      4: { cellWidth: 36, halign: "right" },
      5: { cellWidth: 37, halign: "right" },
      6: { cellWidth: 52, halign: "right" },
    },
    didParseCell: celula => {
      if (celula.section === "foot" && celula.row.index === 1) {
        celula.cell.styles.fillColor = [241, 245, 249];
        celula.cell.styles.fontStyle = "normal";
      }
    },
  });

  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const rodapeY = doc.internal.pageSize.getHeight() - 7;
    doc.text("Faturamento da O.S. após descontos do ERP; não representa lucro. Recompra observada até hoje.", 14, rodapeY);
    doc.text(`Página ${pagina} de ${paginas}`, doc.internal.pageSize.getWidth() - 14, rodapeY, { align: "right" });
  }

  if (args.cotacoesSemValor > 0) {
    doc.setPage(paginas);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${fmtNum(args.cotacoesSemValor)} cotações sem valor disponível.`, 14, doc.internal.pageSize.getHeight() - 12);
  }

  doc.save(`roi-marketing-estados-${args.periodo.replace(/\//g, "-").replace(/\s+/g, "-")}.pdf`);
}
