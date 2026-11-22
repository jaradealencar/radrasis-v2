import { calcularNfCompra } from "../server/services/nfCalculo";

console.log("=== VALIDAÇÃO DO CÁLCULO DE NF DE COMPRA ===\n");

// Exemplo 1: Perfil/Slitter — comprado por kg, consumido por metro linear (ml)
// NF: 1.000 kg a R$ 50.000 + frete R$ 3.000
// Fator: 1 kg = 0,4 ml (perfil pesa 2,5 kg/m)
// Custo cadastrado: R$ 120,00/ml
const r1 = calcularNfCompra({
  valorMercadoria: 50000,
  valorFrete: 3000,
  percentualIcms: 10,
  itens: [
    {
      descricao: "SLITTER GALVANIZADO 50MM",
      quantidade: 1000,
      unidadeCompra: "KG",
      valorUnitario: 50,
      valorTotalItem: 50000,
      unidadeErp: "ML",
      fatorConversao: 0.4,
      custoCadastrado: 120,
    },
  ],
});

console.log("--- Exemplo 1: Slitter (kg → ml) ---");
console.log(`Base NF: R$ ${r1.baseNf.toFixed(2)}`);
console.log(`ICMS 10%: R$ ${r1.valorIcms.toFixed(2)}`);
console.log(`Custo total NF: R$ ${r1.custoTotalNf.toFixed(2)}`);
const i1 = r1.itens[0];
console.log(`Rateio frete: R$ ${i1.rateioFrete}`);
console.log(`Rateio ICMS: R$ ${i1.rateioIcms}`);
console.log(`Custo item total: R$ ${i1.custoItemTotal}`);
console.log(`Custo por kg: R$ ${i1.custoPorUnidadeCompra}`);
console.log(`Custo real por ml (ERP): R$ ${i1.custoRealErp}`);
console.log(`Custo cadastrado: R$ ${i1.custoCadastrado}`);
console.log(`Divergência: ${i1.divergenciaPct}%`);
console.log(`Defasado: ${i1.defasado}`);
console.log(`Esperado: R$ 145,75/ml | +21,5% | Defasado: true`);
console.log();

// Exemplo 2: Chapa Galvanizada — comprado por kg, consumido por m²
// NF: 500 kg a R$ 12.500 + frete R$ 1.000
// Fator: 1 kg = 0,0849 m² (chapa 1,5mm: 11,775 kg/m²)
// Custo cadastrado: R$ 300,00/m²
const r2 = calcularNfCompra({
  valorMercadoria: 12500,
  valorFrete: 1000,
  percentualIcms: 10,
  itens: [
    {
      descricao: "CHAPA GALVANIZADA 1,5MM",
      quantidade: 500,
      unidadeCompra: "KG",
      valorUnitario: 25,
      valorTotalItem: 12500,
      unidadeErp: "M2",
      fatorConversao: 0.0849,
      custoCadastrado: 300,
    },
  ],
});

console.log("--- Exemplo 2: Chapa Galvanizada (kg → m²) ---");
console.log(`Base NF: R$ ${r2.baseNf.toFixed(2)}`);
console.log(`Custo total NF: R$ ${r2.custoTotalNf.toFixed(2)}`);
const i2 = r2.itens[0];
console.log(`Custo real por m² (ERP): R$ ${i2.custoRealErp}`);
console.log(`Custo cadastrado: R$ ${i2.custoCadastrado}`);
console.log(`Divergência: ${i2.divergenciaPct}%`);
console.log(`Defasado: ${i2.defasado}`);
console.log(`Esperado: ~R$ 349,82/m² | ~+16,6% | Defasado: true`);
console.log();

// Exemplo 3: Acrílico — comprado por unidade, consumido por m²
// NF: 50 unidades a R$ 8.000 + frete R$ 500
// Chapa 1220×2440 mm = 2,9768 m² → 1 unidade = 2,9768 m²
// Custo cadastrado: R$ 62,82/m²
const r3 = calcularNfCompra({
  valorMercadoria: 8000,
  valorFrete: 500,
  percentualIcms: 10,
  itens: [
    {
      descricao: "ACRILICO 1220X2440MM",
      quantidade: 50,
      unidadeCompra: "UN",
      valorUnitario: 160,
      valorTotalItem: 8000,
      unidadeErp: "M2",
      fatorConversao: 2.9768,
      custoCadastrado: 62.82,
    },
  ],
});

console.log("--- Exemplo 3: Acrílico (un → m²) ---");
console.log(`Base NF: R$ ${r3.baseNf.toFixed(2)}`);
console.log(`Custo total NF: R$ ${r3.custoTotalNf.toFixed(2)}`);
const i3 = r3.itens[0];
console.log(`Custo real por m² (ERP): R$ ${i3.custoRealErp}`);
console.log(`Custo cadastrado: R$ ${i3.custoCadastrado}`);
console.log(`Divergência: ${i3.divergenciaPct}%`);
console.log(`Defasado: ${i3.defasado}`);
console.log(`Esperado: ~R$ 62,82/m² | ~0,0% | Defasado: false`);
console.log();

// Exemplo 4: Defasagem mínima de 1% (usuário quer ver até 1%)
// Item com custo cadastrado R$ 100,00 e real R$ 101,00
const r4 = calcularNfCompra({
  valorMercadoria: 100,
  valorFrete: 0,
  percentualIcms: 0,
  itens: [
    {
      descricao: "ITEM TESTE 1%",
      quantidade: 1,
      unidadeCompra: "UN",
      valorUnitario: 100,
      valorTotalItem: 100,
      custoCadastrado: 100,
      custoRealErp: 101, // será sobrescrito pelo cálculo, mas vamos forçar via fator
    },
  ],
});

// Para forçar custoRealErp = 101 com custoCadastrado = 100:
// fatorConversao tal que custoItemTotal/quantidade/fator = 101
// 100 / 1 / fator = 101 → fator = 100/101 = 0.990099
const r4b = calcularNfCompra({
  valorMercadoria: 100,
  valorFrete: 0,
  percentualIcms: 0,
  itens: [
    {
      descricao: "ITEM TESTE 1%",
      quantidade: 1,
      unidadeCompra: "UN",
      valorUnitario: 100,
      valorTotalItem: 100,
      unidadeErp: "UN",
      fatorConversao: 100 / 101, // força custo real = 101
      custoCadastrado: 100,
    },
  ],
});

console.log("--- Exemplo 4: Defasagem de 1% (deve ser detectada) ---");
const i4 = r4b.itens[0];
console.log(`Custo real: R$ ${i4.custoRealErp}`);
console.log(`Custo cadastrado: R$ ${i4.custoCadastrado}`);
console.log(`Divergência: ${i4.divergenciaPct}%`);
console.log(`Defasado: ${i4.defasado}`);
console.log(`Esperado: +1,00% | Defasado: true`);
console.log();

// Exemplo 5: Múltiplos itens na mesma NF (rateio proporcional)
const r5 = calcularNfCompra({
  valorMercadoria: 10000,
  valorFrete: 1000,
  percentualIcms: 10,
  itens: [
    {
      descricao: "ITEM A - 60% do valor",
      quantidade: 100,
      unidadeCompra: "KG",
      valorUnitario: 60,
      valorTotalItem: 6000,
      unidadeErp: "ML",
      fatorConversao: 0.5,
      custoCadastrado: 110,
    },
    {
      descricao: "ITEM B - 40% do valor",
      quantidade: 200,
      unidadeCompra: "KG",
      valorUnitario: 20,
      valorTotalItem: 4000,
      unidadeErp: "ML",
      fatorConversao: 0.5,
      custoCadastrado: 55,
    },
  ],
});

console.log("--- Exemplo 5: Múltiplos itens com rateio ---");
console.log(`Base NF: R$ ${r5.baseNf.toFixed(2)} | ICMS: R$ ${r5.valorIcms.toFixed(2)} | Total: R$ ${r5.custoTotalNf.toFixed(2)}`);
r5.itens.forEach((i) => {
  console.log(`  ${i.descricao}: real R$ ${i.custoRealErp} | cadastrado R$ ${i.custoCadastrado} | div ${i.divergenciaPct}% | defasado ${i.defasado}`);
});

console.log("\n=== VALIDAÇÃO CONCLUÍDA ===");
