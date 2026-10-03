import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtBrl, fmtDate } from "@/lib/format";

export interface PropostaParaPdf {
  clienteNome: string;
  vendedorNome: string;
  createdAt: Date | string;
  itens: { produtoNome: string; descricao?: string | null; variacoes?: { nome: string; valor: string }[]; quantidade: string | number; precoUnitario: string | number; ativo: boolean }[];
  valorTotal: number;
  prazoFabricacaoDiasUteis: number | null;
  formasPagamento: string[];
  condicaoPagamentoObs?: string | null;
}

export function gerarPdfProposta(p: PropostaParaPdf) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Proposta comercial", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Cliente: ${p.clienteNome}`, 14, 26);
  doc.text(`Vendedor: ${p.vendedorNome}`, 14, 32);
  doc.text(`Data: ${fmtDate(p.createdAt)}`, 14, 38);
  if (p.prazoFabricacaoDiasUteis != null) {
    doc.text(`Prazo de fabricação: ${p.prazoFabricacaoDiasUteis} dias úteis`, 14, 44);
  }

  const itensAtivos = p.itens.filter((i) => i.ativo);
  autoTable(doc, {
    startY: 50,
    head: [["Produto", "Qtd", "Preço unit.", "Subtotal"]],
    body: itensAtivos.map((i) => {
      const detalhes = [
        i.variacoes?.length ? `Variações: ${i.variacoes.map((variacao) => `${variacao.nome}: ${variacao.valor}`).join(", ")}` : "",
        i.descricao?.trim() ?? "",
      ].filter(Boolean).join("\n");
      return [
        detalhes ? `${i.produtoNome}\n${detalhes}` : i.produtoNome,
        String(Number(i.quantidade)),
        fmtBrl(Number(i.precoUnitario)),
        fmtBrl(Number(i.precoUnitario) * Number(i.quantidade)),
      ];
    }),
    foot: [["", "", "Total", fmtBrl(p.valorTotal)]],
    theme: "grid",
    headStyles: { fillColor: [30, 111, 217] },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(30);
  if (p.formasPagamento.length) {
    doc.text(`Formas de pagamento: ${p.formasPagamento.join(", ")}`, 14, finalY);
  }
  if (p.condicaoPagamentoObs) {
    doc.text(`Condições: ${p.condicaoPagamentoObs}`, 14, finalY + 6);
  }

  doc.save(`proposta-${p.clienteNome.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
