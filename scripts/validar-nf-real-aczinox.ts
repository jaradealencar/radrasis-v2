import { calcularNfCompra } from "../server/services/nfCalculo";

// ─── NF REAL: ACZ INOX COMERCIAL LTDA — NF 213.876, 29/07/2026 ───
// Peso líquido total da NF (XML): 324,000 kg (bate com 92+92+140)
// Frete informado pelo usuário: R$ 2,21/kg (média cobrada pela MartinsLog)
// ICMS: 10% sobre (valor do item + frete do item) — fórmula definida pelo usuário
//
// Custo cadastrado no Radrasys (consultado no banco real, espelho Mubisys):
//   ID 4326 — Perfil Inox Polido 80mm 26" Liga 304 — R$ 10,18/ml (ref. 30/01/2026)
//   ID 4299 — Perfil Inox Polido 80mm 24" Liga 430 — R$ 8,04/ml  (ref. 08/02/2026)
//   ID 4276 — Perfil Inox Polido 80mm 26" Liga 430 — R$ 6,58/ml  (ref. 08/02/2026)
//
// Fator de conversão kg → ml, da tabela de peso por metro que o usuário enviou:
//   Item 1 (F304-0,50X80, liga 304, esp. 0,50mm): 0,317 kg/m  → 1 kg = 1/0,317 ml
//   Item 2 (F430-0,60X80, liga 430, esp. 0,60mm): 0,370 kg/m  → 1 kg = 1/0,370 ml
//   Item 3 (F430-0,50X80, liga 430, esp. 0,50mm): 0,308 kg/m  → 1 kg = 1/0,308 ml

const resultado = calcularNfCompra({
  valorMercadoria: 6466.8, // total dos 3 itens, confere com vProd do XML
  valorFrete: 0,           // não usado: o frete é calculado por kg abaixo
  freteValorPorKg: 2.21,
  percentualIcms: 10,
  itens: [
    {
      descricao: "4326 - F304-0,50X80-M-POL-R-PVC-LANOVA (Perfil Inox 80mm 26\" Liga 304)",
      quantidade: 92,
      unidadeCompra: "KG",
      valorUnitario: 25.3,
      valorTotalItem: 2327.6,
      materiaPrimaId: 4326,
      unidadeErp: "ML",
      fatorConversao: 1 / 0.317, // kg → ml: 0,317 kg por metro
      custoCadastrado: 10.18,
    },
    {
      descricao: "4299 - F430-0,60X80-M-POL-R-PVC-LANOVA (Perfil Inox 80mm 24\" Liga 430)",
      quantidade: 92,
      unidadeCompra: "KG",
      valorUnitario: 17.6,
      valorTotalItem: 1619.2,
      materiaPrimaId: 4299,
      unidadeErp: "ML",
      fatorConversao: 1 / 0.37, // kg → ml: 0,370 kg por metro
      custoCadastrado: 8.04,
    },
    {
      descricao: "4276 - F430-0,50X80-M-POL-R-PVC-LANOVA (Perfil Inox 80mm 26\" Liga 430)",
      quantidade: 140,
      unidadeCompra: "KG",
      valorUnitario: 18.0,
      valorTotalItem: 2520.0,
      materiaPrimaId: 4276,
      unidadeErp: "ML",
      fatorConversao: 1 / 0.308, // kg → ml: 0,308 kg por metro
      custoCadastrado: 6.58,
    },
  ],
});

console.log("=== NF ACZ INOX 213.876 — VALIDAÇÃO COM DADOS REAIS ===\n");
console.log(`Valor mercadoria: R$ ${resultado.baseNf - 0}`); // baseNf já soma frete, então mostramos componentes abaixo
console.log();

let totalFrete = 0;
let totalIcms = 0;
let totalCustoNf = 0;
let pesoTotal = 0;

for (const item of resultado.itens) {
  totalFrete += item.rateioFrete;
  totalIcms += item.rateioIcms;
  totalCustoNf += item.custoItemTotal;
  pesoTotal += item.quantidade;

  console.log(`--- ${item.descricao} ---`);
  console.log(`  Peso: ${item.quantidade} kg | Valor NF: R$ ${item.valorTotalItem.toFixed(2)}`);
  console.log(`  Frete (R$ 2,21/kg): R$ ${item.rateioFrete.toFixed(2)}`);
  console.log(`  ICMS 10% s/ (valor+frete): R$ ${item.rateioIcms.toFixed(2)}`);
  console.log(`  Custo total do item: R$ ${item.custoItemTotal.toFixed(2)}`);
  console.log(`  Custo por kg: R$ ${item.custoPorUnidadeCompra.toFixed(4)}`);
  console.log(`  Fator conversão (kg→ml): ${item.fatorConversao?.toFixed(4)}`);
  console.log(`  Metros lineares equivalentes: ${item.quantidadeErp?.toFixed(2)} ml`);
  console.log(`  >>> CUSTO REAL: R$ ${item.custoRealErp.toFixed(2)}/ml`);
  console.log(`  >>> CUSTO CADASTRADO (Mubisys): R$ ${item.custoCadastrado?.toFixed(2)}/ml`);
  console.log(`  >>> DIVERGÊNCIA: ${item.divergenciaPct}% ${item.defasado ? "⚠️ DEFASADO" : "✅ OK"}`);
  console.log();
}

console.log("=== RESUMO DA NF ===");
console.log(`Peso total: ${pesoTotal} kg (NF informa pesoL=324,000 kg)`);
console.log(`Valor mercadoria: R$ 6.466,80`);
console.log(`Frete total (R$ 2,21/kg × ${pesoTotal}kg): R$ ${totalFrete.toFixed(2)}`);
console.log(`ICMS total: R$ ${totalIcms.toFixed(2)}`);
console.log(`Custo total (mercadoria+frete+ICMS): R$ ${totalCustoNf.toFixed(2)}`);
console.log();
console.log("=== RESUMO DE DEFASAGEM ===");
for (const item of resultado.itens) {
  const sinal = (item.divergenciaPct ?? 0) >= 0 ? "+" : "";
  console.log(
    `${item.descricao.slice(0, 4)} | Real: R$ ${item.custoRealErp.toFixed(2)}/ml | Cadastrado: R$ ${item.custoCadastrado?.toFixed(2)}/ml | ${sinal}${item.divergenciaPct}%`
  );
}
