import { invokeLLM } from "../_core/llm";

export interface ItemCotacaoExtraido {
  codigo?: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  precoTotal?: number;
}

export interface CotacaoExtraida {
  fornecedor?: string;
  cnpjFornecedor?: string;
  dataCotacao?: string;
  validadeDias?: number;
  condicaoPagamento?: string;
  prazoEntrega?: string;
  freteModo?: "valor_total" | "por_kg" | "gratis" | null;
  valorFrete?: number | null;
  pesoFreteKg?: number | null;
  valorTotal?: number;
  itens: ItemCotacaoExtraido[];
}

/**
 * Extrai texto de um PDF de orçamento/cotação e usa LLM para estruturar
 * os itens e preços cotados.
 */
export async function extrairCotacaoDePdf(pdfBuffer: Buffer, fileName = "cotacao.pdf"): Promise<CotacaoExtraida> {
  let textoPdf = "";
  try {
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const parsed = await pdfParse(pdfBuffer);
    textoPdf = parsed.text?.trim() ?? "";
  } catch (err: any) {
    console.warn("[PDF-PARSE] Falha no parse direto do PDF:", err?.message);
  }

  const promptExtracao = `Você é um assistente especialista em compras industriais e leitura de propostas comerciais / orçamentos em PDF.
Analise o texto deste orçamento de fornecedor e extraia com máxima precisão os dados comerciais e os itens cotados.

DOCUMENTO DA COTAÇÃO:
"""
${textoPdf.slice(0, 30000)}
"""

Retorne OBRIGATORIAMENTE um JSON estrito no seguinte formato (sem markdown, apenas o JSON):
{
  "fornecedor": "Nome da empresa emissora do orçamento",
  "cnpjFornecedor": "CNPJ se encontrado ou null",
  "dataCotacao": "Data da proposta no formato YYYY-MM-DD ou DD/MM/YYYY se encontrada",
  "validadeDias": 10,
  "condicaoPagamento": "Ex: 28 DDL, À vista, etc",
  "prazoEntrega": "Ex: 5 dias úteis, Imediato",
  "freteModo": null,
  "valorFrete": null,
  "pesoFreteKg": null,
  "valorTotal": 0,
  "itens": [
    {
      "codigo": "Código do produto ou null",
      "descricao": "Descrição exata do material (ex: Chapa Inox 430 0,60x1250x3000mm)",
      "quantidade": 10,
      "unidade": "KG, UN, PC, M2, ML ou LT",
      "precoUnitario": 25.50,
      "precoTotal": 255.00
    }
  ]
}
Importante:
- Converta valores numéricos para números (não strings). Use ponto como separador decimal.
- Se houver frete mencionado, extraia a modalidade: "por_kg" para tarifa explícita em R$/kg, "gratis" quando o documento disser que é grátis, e "valor_total" para frete total/fixo. Se o documento não informar frete, retorne freteModo=null e valorFrete=null; nunca presuma frete zero.
- Extraia pesoFreteKg somente se o peso total da carga estiver explicitamente escrito no documento e convertido para kg. Se não houver peso total explícito, retorne null; nunca estime o peso pelas descrições ou quantidades dos itens.
- Extraia cada linha de produto individualmente.`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "Você é um extrator de dados de orçamentos de fornecedores. Responda apenas com JSON válido.",
      },
      {
        role: "user",
        content: promptExtracao,
      },
    ],
    response_format: { type: "json_object" },
  });

  const rawJson = response.choices[0]?.message.content;
  if (!rawJson) {
    throw new Error("A IA não retornou resposta para a extração do PDF.");
  }

  try {
    const parsed = JSON.parse(typeof rawJson === "string" ? rawJson : JSON.stringify(rawJson)) as CotacaoExtraida;
    return parsed;
  } catch (e) {
    throw new Error("Falha ao interpretar os dados JSON extraídos pela IA.");
  }
}
