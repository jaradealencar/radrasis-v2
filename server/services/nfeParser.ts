import pdfParse from "pdf-parse";

/**
 * Extrai dados do fornecedor de um PDF de NF-e.
 *
 * Retorna os campos que costuma ser possível ler de uma NF-e brasileira (DANFE):
 * CNPJ do emitente, razão social, nome fantasia, número, série e chave de acesso.
 * Como o DANFE varia de emissor para emissor, a extração é heurística por regex
 * sobre o texto da primeira página; campos que não forem encontrados vêm como null.
 * Nunca inventa valor: se não achar, deixa nulo e o usuário preenche manualmente.
 */
export type NfeDadosExtraidos = {
  nfeCnpj: string | null;
  nfeRazaoSocial: string | null;
  nfeNomeFantasia: string | null;
  nfeNumero: string | null;
  nfeSerie: string | null;
  nfeChaveAcesso: string | null;
};

function limparCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

function ehCnpjValido(cnpj: string): boolean {
  const d = limparCnpj(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  let soma = 0;
  let peso;
  for (let i = 0; i < 12; i++) {
    peso = i < 4 ? 5 - i : 13 - i;
    soma += parseInt(d.charAt(i), 10) * peso;
  }
  let digito = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (parseInt(d.charAt(12), 10) !== digito) return false;
  soma = 0;
  for (let i = 0; i < 13; i++) {
    peso = i < 5 ? 6 - i : 14 - i;
    soma += parseInt(d.charAt(i), 10) * peso;
  }
  digito = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return parseInt(d.charAt(13), 10) === digito;
}

function primeiraOcorrencia(texto: string, regex: RegExp): string | null {
  const m = texto.match(regex);
  return m ? m[1].trim() : null;
}

/**
 * Lê o buffer do PDF da NF-e e tenta extrair os dados do fornecedor/emitente.
 * Lança erro se não for um PDF legível.
 */
export async function extrairDadosNfePdf(buffer: Buffer): Promise<NfeDadosExtraidos> {
  const data = await pdfParse(buffer);
  const texto = data.text || "";

  const linhas = texto.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
  const textoUnido = linhas.join(" ");

  // CNPJ do emitente — padrões comuns no DANFE
  const cnpjRegex = /CNPJ[:\s]*([\d.\-/]{9})\s*\/?\s*([\d]{0,4})?/i;
  const mCnpj = textoUnido.match(cnpjRegex);
  let cnpj: string | null = null;
  if (mCnpj) {
    const candidato = limparCnpj(mCnpj[1]);
    if (ehCnpjValido(candidato)) cnpj = candidato;
  }
  // Fallback: procurar qualquer CNPJ válido no texto
  if (!cnpj) {
    const todosCnpjs = textoUnido.match(/[\d]{2}[\.\-/]?[\d]{3}[\.\-/]?[\d]{3}[\/\-]?[\d]{4}[\-\/]?[\d]{2}/g);
    for (const c of (todosCnpjs ?? [])) {
      const limpo = limparCnpj(c);
      if (ehCnpjValido(limpo)) { cnpj = limpo; break; }
    }
  }

  // Razão social — costuma vir após "Emitente", "Razão Social", "Nome Empresarial"
  const razaoSocial =
    primeiraOcorrencia(textoUnido, /Raz[aã]o\s+Social[:\s\-]*([^\n|]{4,120})/i) ||
    primeiraOcorrencia(textoUnido, /Emitente[:\s\-]*([^\n|]{4,120})/i) ||
    primeiraOcorrencia(textoUnido, /Nome\s+Empresarial[:\s\-]*([^\n|]{4,120})/i) ||
    null;

  // Nome fantasia
  const nomeFantasia =
    primeiraOcorrencia(textoUnido, /Nome\s+Fantasia[:\s\-]*([^\n|]{4,120})/i) ||
    primeiraOcorrencia(textoUnido, /Fantasia[:\s\-]*([^\n|]{4,120})/i) ||
    null;

  // Número da NF-e
  const numero =
    primeiraOcorrencia(textoUnido, /N[ºo]\.?\s*(?:da\s+)?(?:NF-e|Nota\s+Fiscal)[:\s\-]*([^\s|]{1,20})/i) ||
    primeiraOcorrencia(textoUnido, /Nota\s+Fiscal[^\n]{0,40}?(\d{1,10})/i) ||
    primeiraOcorrencia(textoUnido, /N[ºo]\s*[:#\-]?\s*(\d{1,10})/i) ||
    null;

  // Série
  const serie =
    primeiraOcorrencia(textoUnido, /S[ée]rie[:\s\-]*(\d{1,5})/i) ||
    primeiraOcorrencia(textoUnido, /SER[:\s\-]*(\d{1,5})/i) ||
    null;

  // Chave de acesso (44 dígitos)
  const chaveAcesso = primeiraOcorrencia(textoUnido, /Chave\s+de\s+Acesso[:\s\-]*([\d]{44})/i) ||
    primeiraOcorrencia(textoUnido, /(\d{44})/) ||
    null;

  return {
    nfeCnpj: cnpj,
    nfeRazaoSocial: razaoSocial,
    nfeNomeFantasia: nomeFantasia,
    nfeNumero: numero,
    nfeSerie: serie,
    nfeChaveAcesso: chaveAcesso,
  };
}
