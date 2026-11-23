// ─── PARSER DE XML DE NF-e (padrão SEFAZ, modelo 55) ───────────────────────
// Zero dependência de I/O e zero biblioteca XML nova: a tag é sempre a mesma
// e sem atributos que mudem o sentido do conteúdo (diferente de HTML real),
// então extração por regex é confiável e evita adicionar `fast-xml-parser`/
// `xml2js` só para isto. Testado contra o XML real (ver
// server/__fixtures__/nf-aczinox-213876.xml).

export interface NfXmlItem {
  numeroItem: number;
  codigoFornecedor: string; // cProd
  descricao: string; // xProd
  ncm: string | null;
  unidadeCompra: string; // uCom — valor cru do XML (KG, UN, M, M2, LT...)
  quantidade: number; // qCom
  valorUnitario: number; // vUnCom
  valorTotalItem: number; // vProd
  valorIpi: number; // vIPI do imposto do item (zero quando ausente)
}

export interface NfXmlParseada {
  numero: string;
  serie: string;
  chaveAcesso: string | null;
  dataEmissao: string | null; // ISO, de dhEmi
  cnpjFornecedor: string;
  nomeFornecedor: string;
  valorProdutos: number; // vProd do total (ICMSTot)
  valorFreteNf: number; // vFrete do total — quase sempre 0 quando o frete é cobrado à parte pelo transportador (modFrete=1, FOB)
  pesoLiquidoTotalKg: number | null; // pesoL do vol
  itens: NfXmlItem[];
}

export class NfXmlParseError extends Error {}

function extrairTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match ? match[1] : null;
}

function extrairBloco(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? match[1] : null;
}

function extrairTodosBlocos(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  const blocos: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) blocos.push(match[1]);
  return blocos;
}

function numeroOuErro(valor: string | null, campo: string): number {
  if (valor == null) throw new NfXmlParseError(`Campo ${campo} ausente no XML da NF.`);
  const n = Number(valor);
  if (!Number.isFinite(n)) throw new NfXmlParseError(`Campo ${campo} não é um número válido: "${valor}".`);
  return n;
}

function textoOuErro(valor: string | null, campo: string): string {
  if (valor == null || valor.trim() === "") throw new NfXmlParseError(`Campo ${campo} ausente no XML da NF.`);
  return valor.trim();
}

/** Decodifica entidades XML básicas (o XML da SEFAZ não costuma usar nada além disso nos textos de produto). */
function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Faz o parse de um XML de NF-e (nfeProc ou NFe isolada) e devolve os dados
 * necessários para a auditoria de custo de matéria-prima. Lança
 * `NfXmlParseError` com uma mensagem específica quando um campo obrigatório
 * está ausente — nunca assume valor zero/vazio silenciosamente.
 */
export function parseNfXml(xmlRaw: string): NfXmlParseada {
  const infNFe = extrairBloco(xmlRaw, "infNFe");
  if (!infNFe) throw new NfXmlParseError("XML não contém a tag <infNFe> — não parece ser uma NF-e válida.");

  const chaveMatch = xmlRaw.match(/Id="NFe(\d{44})"/);
  const chaveAcesso = chaveMatch ? chaveMatch[1] : null;

  const ide = extrairBloco(infNFe, "ide");
  if (!ide) throw new NfXmlParseError("Bloco <ide> ausente no XML.");
  const numero = textoOuErro(extrairTag(ide, "nNF"), "número da NF (nNF)");
  const serie = extrairTag(ide, "serie") ?? "1";
  const dataEmissao = extrairTag(ide, "dhEmi");

  const emit = extrairBloco(infNFe, "emit");
  if (!emit) throw new NfXmlParseError("Bloco <emit> (emitente/fornecedor) ausente no XML.");
  const cnpjFornecedor = textoOuErro(extrairTag(emit, "CNPJ"), "CNPJ do fornecedor");
  const nomeFornecedor = textoOuErro(extrairTag(emit, "xNome"), "nome do fornecedor");

  const detsRaw = extrairTodosBlocos(infNFe, "det");
  if (detsRaw.length === 0) throw new NfXmlParseError("Nenhum item (<det>) encontrado no XML da NF.");

  const itens: NfXmlItem[] = detsRaw.map((detBloco, idx) => {
    const prod = extrairBloco(detBloco, "prod");
    if (!prod) throw new NfXmlParseError(`Item ${idx + 1}: bloco <prod> ausente.`);
    const imposto = extrairBloco(detBloco, "imposto");
    return {
      numeroItem: idx + 1,
      codigoFornecedor: textoOuErro(extrairTag(prod, "cProd"), `item ${idx + 1}: código do produto (cProd)`),
      descricao: decodificarEntidades(textoOuErro(extrairTag(prod, "xProd"), `item ${idx + 1}: descrição (xProd)`)),
      ncm: extrairTag(prod, "NCM"),
      unidadeCompra: textoOuErro(extrairTag(prod, "uCom"), `item ${idx + 1}: unidade comercial (uCom)`).toUpperCase(),
      quantidade: numeroOuErro(extrairTag(prod, "qCom"), `item ${idx + 1}: quantidade (qCom)`),
      valorUnitario: numeroOuErro(extrairTag(prod, "vUnCom"), `item ${idx + 1}: valor unitário (vUnCom)`),
      valorTotalItem: numeroOuErro(extrairTag(prod, "vProd"), `item ${idx + 1}: valor total do produto (vProd)`),
      valorIpi: imposto ? Number(extrairTag(imposto, "vIPI") ?? "0") || 0 : 0,
    };
  });

  const total = extrairBloco(infNFe, "total");
  const icmsTot = total ? extrairBloco(total, "ICMSTot") : null;
  if (!icmsTot) throw new NfXmlParseError("Bloco <ICMSTot> (totais da NF) ausente no XML.");
  const valorProdutos = numeroOuErro(extrairTag(icmsTot, "vProd"), "valor total dos produtos (vProd do ICMSTot)");
  const valorFreteNf = Number(extrairTag(icmsTot, "vFrete") ?? "0") || 0;

  const transp = extrairBloco(infNFe, "transp");
  const vol = transp ? extrairBloco(transp, "vol") : null;
  const pesoLTexto = vol ? extrairTag(vol, "pesoL") : null;
  const pesoLiquidoTotalKg = pesoLTexto != null ? Number(pesoLTexto) : null;

  return {
    numero,
    serie,
    chaveAcesso,
    dataEmissao,
    cnpjFornecedor,
    nomeFornecedor,
    valorProdutos,
    valorFreteNf,
    pesoLiquidoTotalKg,
    itens,
  };
}
