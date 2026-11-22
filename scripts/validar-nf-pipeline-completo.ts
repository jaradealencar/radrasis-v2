import { readFileSync } from "fs";
import { join } from "path";
import { parseNfXml } from "../server/services/nfXmlParser";
import { sugerirVinculoItem, type CandidatoMateriaPrima, type MemoriaVinculo } from "../server/services/nfSugestaoVinculo";
import { calcularNfCompra } from "../server/services/nfCalculo";

console.log("=== PASSO 1: PARSE DO XML REAL (NF ACZ Inox 213.876) ===\n");

const xml = readFileSync(join(process.cwd(), "server/__fixtures__/nf-aczinox-213876.xml"), "utf-8");
const nf = parseNfXml(xml);

console.log(`Número: ${nf.numero}/${nf.serie} | Fornecedor: ${nf.nomeFornecedor} (${nf.cnpjFornecedor})`);
console.log(`Valor produtos: R$ ${nf.valorProdutos} | Frete na NF: R$ ${nf.valorFreteNf} | Peso líquido: ${nf.pesoLiquidoTotalKg} kg`);
console.log(`Itens extraídos: ${nf.itens.length}`);
nf.itens.forEach(i => console.log(`  [${i.numeroItem}] cProd=${i.codigoFornecedor} | ${i.descricao} | ${i.quantidade} ${i.unidadeCompra} × R$ ${i.valorUnitario} = R$ ${i.valorTotalItem}`));

// ─── Candidatos de MP: dados reais consultados no banco anteriormente ───
// (ver scripts/check-mps-nf.ts) — materia_prima_cadastros ainda não tem
// linha para estes 3 IDs, então o cadastro técnico vem vazio de propósito,
// para provar que o motor acusa a pendência em vez de inventar fator.
const candidatosPorCodigo: Record<string, CandidatoMateriaPrima[]> = {
  "375135": [{
    id: 263, nome: "Perfil Inox Polido 80mm - 26\" - Liga 304", mubisysMateriaPrimaId: 4326,
    unidadeMedida: "Metro linear", custoUnitarioCadastrado: 10.18,
    dadosTecnicos: null, // cadastro técnico ainda não preenchido (confirmado no banco)
  }],
  "375136": [{
    id: 262, nome: "Perfil Inox Polido 80mm - 24\" - Lig 430", mubisysMateriaPrimaId: 4299,
    unidadeMedida: "Metro linear", custoUnitarioCadastrado: 8.04,
    dadosTecnicos: null,
  }],
  "375137": [{
    id: 264, nome: "Perfil Inox Polido 80mm - 26\" - Liga 430", mubisysMateriaPrimaId: 4276,
    unidadeMedida: "Metro linear", custoUnitarioCadastrado: 6.58,
    dadosTecnicos: null,
  }],
};

console.log("\n=== PASSO 2: SUGESTÃO SEM MEMÓRIA (1ª NF deste fornecedor) ===\n");

for (const item of nf.itens) {
  const sugestao = sugerirVinculoItem(
    { codigoFornecedor: item.codigoFornecedor, descricao: item.descricao, unidadeCompra: item.unidadeCompra as any },
    null, // sem memória ainda
    candidatosPorCodigo[item.codigoFornecedor] ?? [],
  );
  console.log(`--- Item ${item.numeroItem} (cProd ${item.codigoFornecedor}) ---`);
  console.log(`  MP sugerida: ${sugestao.nomeMateriaPrima}`);
  console.log(`  Confiança: ${sugestao.confianca}`);
  console.log(`  Fator: ${sugestao.fatorConversao ?? "— (pendente)"}`);
  if (sugestao.pendencias.length) sugestao.pendencias.forEach(p => console.log(`  ⚠️  ${p}`));
}

console.log("\n=== PASSO 3: AGORA COM O CADASTRO TÉCNICO PREENCHIDO (gestor cadastrou densidade/largura) ===\n");

// Dados técnicos vindos da tabela que o usuário enviou (Aço Inox 304 e 430,
// bitola #26 0,50mm 80mm e #24 0,60mm 80mm) — é o que ficaria em
// materia_prima_cadastros depois de o gestor preencher em Administração.
const candidatosComTecnico: Record<string, CandidatoMateriaPrima[]> = {
  "375135": [{ ...candidatosPorCodigo["375135"][0], dadosTecnicos: { tipo: "perfil", espessuraMm: 0.50, densidadeGCm3: 7.93, perfilFormato: "tira", perfilAlturaMm: null, perfilLarguraMm: 80 } }],
  "375136": [{ ...candidatosPorCodigo["375136"][0], dadosTecnicos: { tipo: "perfil", espessuraMm: 0.60, densidadeGCm3: 7.70, perfilFormato: "tira", perfilAlturaMm: null, perfilLarguraMm: 80 } }],
  "375137": [{ ...candidatosPorCodigo["375137"][0], dadosTecnicos: { tipo: "perfil", espessuraMm: 0.50, densidadeGCm3: 7.70, perfilFormato: "tira", perfilAlturaMm: null, perfilLarguraMm: 80 } }],
};

const sugestoesResolvidas = nf.itens.map(item => {
  const sugestao = sugerirVinculoItem(
    { codigoFornecedor: item.codigoFornecedor, descricao: item.descricao, unidadeCompra: item.unidadeCompra as any },
    null,
    candidatosComTecnico[item.codigoFornecedor] ?? [],
  );
  console.log(`--- Item ${item.numeroItem} (cProd ${item.codigoFornecedor}) ---`);
  console.log(`  MP sugerida: ${sugestao.nomeMateriaPrima} | Confiança: ${sugestao.confianca}`);
  console.log(`  Unidade ERP: ${sugestao.unidadeErp} | Fator: ${sugestao.fatorConversao}`);
  console.log(`  Base do cálculo (texto de auditoria): "${sugestao.baseCalculoTexto}"`);
  return { item, sugestao };
});

console.log("\n=== PASSO 4: CÁLCULO FINAL (frete R$2,21/kg + ICMS 10%) ===\n");

const resultado = calcularNfCompra({
  valorMercadoria: nf.valorProdutos,
  valorFrete: 0,
  freteValorPorKg: 2.21,
  percentualIcms: 10,
  itens: sugestoesResolvidas.map(({ item, sugestao }) => ({
    descricao: item.descricao,
    quantidade: item.quantidade,
    unidadeCompra: item.unidadeCompra as any,
    valorUnitario: item.valorUnitario,
    valorTotalItem: item.valorTotalItem,
    unidadeErp: sugestao.unidadeErp as any,
    fatorConversao: sugestao.fatorConversao ?? undefined,
    custoCadastrado: candidatosComTecnico[item.codigoFornecedor][0].custoUnitarioCadastrado ?? undefined,
  })),
});

resultado.itens.forEach((r, i) => {
  console.log(`[${nf.itens[i].codigoFornecedor}] Real: R$ ${r.custoRealErp}/${sugestoesResolvidas[i].sugestao.unidadeErp} | Cadastrado: R$ ${r.custoCadastrado} | Divergência: ${r.divergenciaPct}% | ${r.defasado ? "⚠️ DEFASADO" : "✅ OK"}`);
});

console.log("\n=== PASSO 5: SIMULANDO MEMÓRIA (2ª NF do mesmo fornecedor, código já visto) ===\n");

// Suponha que o usuário confirmou o item 375135 na 1ª NF. A memória gravada:
const memoriaSimulada: MemoriaVinculo = {
  materiaPrimaId: 263,
  unidadeErp: "ML",
  fatorConversao: sugestoesResolvidas[0].sugestao.fatorConversao as number,
  origemFator: "cadastro_densidade_perfil",
  baseCalculoTexto: sugestoesResolvidas[0].sugestao.baseCalculoTexto,
  vezesUsado: 1,
};

const sugestaoComMemoria = sugerirVinculoItem(
  { codigoFornecedor: "375135", descricao: "F304-0,50X80-M-POL-R-PVC-LANOVA (nova NF, mesmo fornecedor)", unidadeCompra: "KG" },
  memoriaSimulada,
  candidatosComTecnico["375135"],
);

console.log(`Item com código 375135 numa NOVA nota do mesmo fornecedor:`);
console.log(`  MP: ${sugestaoComMemoria.nomeMateriaPrima} | Confiança: ${sugestaoComMemoria.confianca} (era "media", agora é "alta" — zero digitação)`);
console.log(`  Fator: ${sugestaoComMemoria.fatorConversao} | Origem: ${sugestaoComMemoria.origemFator}`);
console.log(`  Texto de auditoria: "${sugestaoComMemoria.baseCalculoTexto}"`);

console.log("\n=== VALIDAÇÃO CONCLUÍDA ===");
