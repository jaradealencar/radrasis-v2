import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseNfXml } from "../services/nfXmlParser";
import { calcularNfCompra } from "../services/nfCalculo";
import {
  sugerirVinculoItem,
  type CandidatoMateriaPrima,
  type MemoriaVinculo,
} from "../services/nfSugestaoVinculo";
import { kgPorMetroPerfil, secaoPerfilMm2 } from "../../shared/peso";

describe("Auditoria de Custo de Matéria-Prima por NF de Compra", () => {
  const xml = readFileSync(
    join(process.cwd(), "server/__fixtures__/nf-aczinox-213876.xml"),
    "utf-8"
  );

  describe("1. Parser do XML real (NF-e modelo 55 da SEFAZ)", () => {
    it("extrai cabeçalho com número, série, fornecedor, CNPJ e totais", () => {
      const nf = parseNfXml(xml);
      expect(nf.numero).toBe("213876");
      expect(nf.serie).toBe("1");
      expect(nf.cnpjFornecedor).toBe("69184778000102");
      expect(nf.nomeFornecedor).toBe("ACZ INOX COMERCIAL LTDA");
      expect(nf.valorProdutos).toBe(6466.8);
      expect(nf.valorFreteNf).toBe(0); // frete FOB pago à transportadora à parte
      expect(nf.pesoLiquidoTotalKg).toBe(324);
      expect(nf.itens).toHaveLength(3);
    });

    it("extrai cada item com cProd, xProd, quantidade, uCom e vProd", () => {
      const nf = parseNfXml(xml);
      const [i1, i2, i3] = nf.itens;

      expect(i1.codigoFornecedor).toBe("375135");
      expect(i1.descricao).toBe("F304-0,50X80-M-POL-R-PVC-LANOVA");
      expect(i1.unidadeCompra).toBe("KG");
      expect(i1.quantidade).toBe(92);
      expect(i1.valorUnitario).toBe(25.3);
      expect(i1.valorTotalItem).toBe(2327.6);

      expect(i2.codigoFornecedor).toBe("375136");
      expect(i2.quantidade).toBe(92);
      expect(i2.valorTotalItem).toBe(1619.2);

      expect(i3.codigoFornecedor).toBe("375137");
      expect(i3.quantidade).toBe(140);
      expect(i3.valorTotalItem).toBe(2520.0);
    });
  });

  describe("2. Geometria de Perfil Tira (shared/peso.ts)", () => {
    it("calcula seção e peso por metro de tira fina (chapa dobrada 80mm)", () => {
      // Inox 304 (7,93 g/cm³), 80mm largura, 0,50mm espessura
      const secao304 = secaoPerfilMm2("tira", 0, 80, 0.5);
      expect(secao304).toBe(40); // 80 × 0.5 = 40 mm²
      const kgM304 = kgPorMetroPerfil(null, 80, 0.5, 7.93, "tira");
      expect(kgM304).toBeCloseTo(0.3172, 4); // tabela do fabricante dá 0,317

      // Inox 430 (7,70 g/cm³), 80mm largura, 0,60mm espessura
      const kgM430_24 = kgPorMetroPerfil(null, 80, 0.6, 7.7, "tira");
      expect(kgM430_24).toBeCloseTo(0.3696, 4); // tabela dá 0,370

      // Inox 430 (7,70 g/cm³), 80mm largura, 0,50mm espessura
      const kgM430_26 = kgPorMetroPerfil(null, 80, 0.5, 7.7, "tira");
      expect(kgM430_26).toBeCloseTo(0.308, 4); // tabela dá 0,308
    });
  });

  describe("3. Motor de Sugestão e Memória (nfSugestaoVinculo.ts)", () => {
    const mp304: CandidatoMateriaPrima = {
      id: 263,
      nome: "Perfil Inox Polido 80mm - 26\" - Liga 304",
      mubisysMateriaPrimaId: 4326,
      unidadeMedida: "Metro linear",
      custoUnitarioCadastrado: 10.18,
      dadosTecnicos: {
        tipo: "perfil",
        perfilFormato: "tira",
        perfilLarguraMm: 80,
        perfilAlturaMm: null,
        espessuraMm: 0.5,
        densidadeGCm3: 7.93,
      },
    };

    it("sem cadastro técnico, aponta pendência e não inventa fator", () => {
      const mpSemTecnico = { ...mp304, dadosTecnicos: null };
      const s = sugerirVinculoItem(
        { codigoFornecedor: "375135", descricao: "F304", unidadeCompra: "KG" },
        null,
        [mpSemTecnico]
      );
      expect(s.fatorConversao).toBeNull();
      expect(s.confianca).toBe("baixa");
      expect(s.pendencias.length).toBeGreaterThan(0);
    });

    it("com cadastro técnico preenchido, calcula fator e gera texto de auditoria", () => {
      const s = sugerirVinculoItem(
        { codigoFornecedor: "375135", descricao: "F304", unidadeCompra: "KG" },
        null,
        [mp304]
      );
      expect(s.unidadeErp).toBe("ML");
      expect(s.fatorConversao).toBeCloseTo(3.152585, 4);
      expect(s.confianca).toBe("media");
      expect(s.baseCalculoTexto).toContain("80mm largura");
      expect(s.baseCalculoTexto).toContain("0.5mm espessura");
      expect(s.baseCalculoTexto).toContain("7.93 g/cm³");
      expect(s.pendencias).toHaveLength(0);
    });

    it("com memória de confirmação anterior, confiança pula para 'alta'", () => {
      const memoria: MemoriaVinculo = {
        materiaPrimaId: 263,
        unidadeErp: "ML",
        fatorConversao: 3.152585,
        origemFator: "cadastro_densidade_perfil",
        baseCalculoTexto: "Texto original auditado",
        vezesUsado: 2,
      };

      const s = sugerirVinculoItem(
        { codigoFornecedor: "375135", descricao: "F304-novo-lote", unidadeCompra: "KG" },
        memoria,
        [mp304]
      );
      expect(s.materiaPrimaId).toBe(263);
      expect(s.confianca).toBe("alta");
      expect(s.origemFator).toBe("memoria");
      expect(s.baseCalculoTexto).toContain("usado 2× com este fornecedor");
    });
  });

  describe("4. Cálculo puro com os dados reais da NF ACZ Inox (nfCalculo.ts)", () => {
    it("aplica frete R$2,21/kg + ICMS 10% e acusa defasagens reais vs Mubisys", () => {
      const resultado = calcularNfCompra({
        valorMercadoria: 6466.8,
        valorFrete: 0,
        freteValorPorKg: 2.21,
        percentualIcms: 10,
        itens: [
          {
            descricao: "Item 1 - Inox 304 0,50x80",
            quantidade: 92,
            unidadeCompra: "KG",
            valorUnitario: 25.3,
            valorTotalItem: 2327.6,
            unidadeErp: "ML",
            fatorConversao: 1 / 0.3172,
            custoCadastrado: 10.18,
          },
          {
            descricao: "Item 2 - Inox 430 0,60x80",
            quantidade: 92,
            unidadeCompra: "KG",
            valorUnitario: 17.6,
            valorTotalItem: 1619.2,
            unidadeErp: "ML",
            fatorConversao: 1 / 0.3696,
            custoCadastrado: 8.04,
          },
          {
            descricao: "Item 3 - Inox 430 0,50x80",
            quantidade: 140,
            unidadeCompra: "KG",
            valorUnitario: 18.0,
            valorTotalItem: 2520.0,
            unidadeErp: "ML",
            fatorConversao: 1 / 0.308,
            custoCadastrado: 6.58,
          },
        ],
      });

      const [i1, i2, i3] = resultado.itens;

      // Item 1: Inox 304 — real R$ 9,60 vs cadastrado R$ 10,18 (-5,71%)
      expect(i1.custoRealErp).toBeCloseTo(9.5988, 2);
      expect(i1.divergenciaPct).toBeCloseTo(-5.71, 1);
      expect(i1.defasado).toBe(true);

      // Item 2: Inox 430 0,60 — real R$ 8,05 vs cadastrado R$ 8,04 (+0,17%)
      // Prova que acusa defasagem mínima (< 1%), como o usuário pediu
      expect(i2.custoRealErp).toBeCloseTo(8.054, 2);
      expect(i2.divergenciaPct).toBeCloseTo(0.17, 1);
      expect(i2.defasado).toBe(true);

      // Item 3: Inox 430 0,50 — real R$ 6,85 vs cadastrado R$ 6,58 (+4,06%)
      expect(i3.custoRealErp).toBeCloseTo(6.8471, 2);
      expect(i3.divergenciaPct).toBeCloseTo(4.06, 1);
      expect(i3.defasado).toBe(true);
    });
  });
});
