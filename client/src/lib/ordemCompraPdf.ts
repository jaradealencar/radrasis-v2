import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtBrl, fmtDate, fmtNum } from "@/lib/format";
import type {
  CompradorCompra,
  LinhaOrdemCompra,
} from "@shared/compras-cotacoes";

export function criarOrdemCompraPdf(
  ordem: {
    id: number;
    comprador: CompradorCompra;
    createdAt: Date | string;
    pagamento: string;
    condicaoPagamento: string;
    transportadora: string;
    numeroColeta: string;
    frete: string | number;
    freteModo?: string;
    freteValorInformado?: string | number | null;
    pesoPrevistoKg?: string | number | null;
    total: string | number;
    observacoes: string;
    itens: LinhaOrdemCompra[];
  },
  fornecedor: string
) {
  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`ORDEM DE COMPRA OC-${String(ordem.id).padStart(6, "0")}`, 14, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let y = 28;
  const texto = (s: string) => {
    const linhas = doc.splitTextToSize(s, 180);
    doc.text(linhas, 14, y);
    y += linhas.length * 5 + 2;
  };
  texto(`Emissão: ${fmtDate(ordem.createdAt)}`);
  texto(`Comprador: ${ordem.comprador.nome}`);
  texto(
    `${ordem.comprador.tipo === "empresa" ? "CNPJ" : "CPF"}: ${ordem.comprador.documento}${ordem.comprador.inscricaoEstadual ? ` | IE: ${ordem.comprador.inscricaoEstadual}` : ""}`
  );
  texto(`Endereço: ${ordem.comprador.endereco}`);
  texto(`Fornecedor: ${fornecedor}`);
  texto(
    `Pagamento: ${ordem.pagamento === "a_vista" ? "À vista" : "Faturado"}${ordem.condicaoPagamento ? ` - ${ordem.condicaoPagamento}` : ""}`
  );
  texto(
    `Transportadora: ${ordem.transportadora || "A definir"} | Coleta: ${ordem.numeroColeta || "A definir"}`
  );
  texto(`Enviar nota fiscal para: ${ordem.comprador.emailNf}`);
  autoTable(doc, {
    startY: y + 2,
    head: [["Produto / código", "Qtd.", "Un.", "Preço unit.", "Total"]],
    body: ordem.itens.map(i => [
      `${i.descricao}${i.codigo ? `\nCód.: ${i.codigo}` : ""}`,
      fmtNum(i.quantidade, 3),
      i.unidade,
      fmtBrl(i.precoUnitario),
      fmtBrl(i.total),
    ]),
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
    },
    headStyles: { fillColor: [20, 53, 83] },
    columnStyles: {
      0: { cellWidth: 88 },
      1: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    margin: { top: 16, bottom: 20 },
  });
  y =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 9;
  const bloco = [
    ordem.freteModo === "por_kg"
      ? `Frete: ${fmtBrl(Number(ordem.freteValorInformado))}/kg. Peso previsto: ${ordem.pesoPrevistoKg == null ? "a definir na NF" : `${fmtNum(Number(ordem.pesoPrevistoKg), 3)} kg`}. ${ordem.pesoPrevistoKg == null ? "Subtotal sem frete" : "Total estimado"}: ${fmtBrl(Number(ordem.total))}`
      : `Frete: ${ordem.freteModo === "gratis" ? "Grátis" : fmtBrl(Number(ordem.frete))} | TOTAL: ${fmtBrl(Number(ordem.total))}`,
    ...(ordem.observacoes ? [`Observações: ${ordem.observacoes}`] : []),
  ];
  for (const s of bloco) {
    for (const linha of doc.splitTextToSize(s, 180)) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(linha, 14, y);
      y += 5;
    }
    y += 3;
  }
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.text(
      `OC-${String(ordem.id).padStart(6, "0")} | ${p}/${paginas}`,
      14,
      289
    );
  }
  return doc;
}

export function baixarOrdemCompraPdf(
  ordem: Parameters<typeof criarOrdemCompraPdf>[0],
  fornecedor: string
) {
  criarOrdemCompraPdf(ordem, fornecedor).save(
    `Ordem-de-compra-${ordem.id}.pdf`
  );
}
