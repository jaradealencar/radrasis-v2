import pdfParse from "pdf-parse/lib/pdf-parse.js";

export type NfeDadosExtraidos = {
  nfeCnpj: string | null;
  nfeRazaoSocial: string | null;
  nfeNomeFantasia: string | null;
  nfeNumero: string | null;
  nfeSerie: string | null;
  nfeChaveAcesso: string | null;
};

function limparDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

function ehCnpjValido(cnpj: string): boolean {
  const digitos = limparDigitos(cnpj);
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;

  const calcularDigito = (base: string, pesos: number[]) => {
    const soma = [...base].reduce(
      (total, digito, i) => total + Number(digito) * pesos[i],
      0
    );
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const primeiro = calcularDigito(digitos.slice(0, 12), [
    5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2,
  ]);
  if (Number(digitos[12]) !== primeiro) return false;

  const segundo = calcularDigito(digitos.slice(0, 13), [
    6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2,
  ]);
  return Number(digitos[13]) === segundo;
}

function normalizarRotulos(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ºª]/g, caractere => (caractere === "º" ? "o" : "a"))
    .toUpperCase();
}

function limparValor(texto: string): string | null {
  const valor = texto
    .replace(/\s+/g, " ")
    .replace(/^[\s:;|\-]+|[\s|]+$/g, "")
    .trim();
  if (!valor || valor.length < 2) return null;
  return valor.slice(0, 256);
}

function valorAposRotulo(
  linhas: string[],
  rotulos: RegExp,
  rotuloIsolado?: RegExp
): string | null {
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const match = normalizarRotulos(linha).match(rotulos);
    if (match?.index !== undefined) {
      const valor = limparValor(linha.slice(match.index + match[0].length));
      if (valor) return valor;
    }

    if (rotuloIsolado?.test(normalizarRotulos(linha)) && linhas[i + 1]) {
      const seguinte = linhas[i + 1];
      const proximoRotulo =
        /^(?:CNPJ|CPF|IE|INSCRICAO|ENDERECO|CEP|MUNICIPIO|FONE|TELEFONE)\b/i;
      if (!proximoRotulo.test(normalizarRotulos(seguinte))) {
        return limparValor(seguinte);
      }
    }
  }
  return null;
}

function nomeAposIdentificacaoEmitente(linhas: string[]): string | null {
  const indice = linhas.findIndex(linha =>
    /(?:IDENTIFICACAO|DADOS)\s+DO\s+EMITENTE/.test(normalizarRotulos(linha))
  );
  if (indice < 0) return null;

  const rotuloOuInstrucao =
    /^(?:DANFE|DOCUMENTO AUXILIAR|RAZAO SOCIAL|NOME EMPRESARIAL|CNPJ|CPF|INSCRICAO|ENDERECO|CEP|MUNICIPIO|FONE|TELEFONE)\b/i;
  for (const linha of linhas.slice(indice + 1, indice + 5)) {
    if (rotuloOuInstrucao.test(normalizarRotulos(linha))) continue;
    const valor = limparValor(linha);
    if (valor) return valor;
  }
  return null;
}

function extrairCnpj(texto: string): string | null {
  const textoEmitente =
    normalizarRotulos(texto).split(/DESTINATARIO|DESTINATARIO\/REMETENTE/i)[0] ?? texto;
  const rotulados = textoEmitente.matchAll(
    /CNPJ(?:\s*\/\s*CPF)?\s*[:\-]?\s*([\d.\s/-]{14,32})/gi
  );

  for (const match of rotulados) {
    const candidato = limparDigitos(match[1] ?? "").slice(0, 14);
    if (ehCnpjValido(candidato)) return candidato;
  }

  const encontrados =
    textoEmitente.match(/\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}\b/g) ?? [];
  for (const encontrado of encontrados) {
    const candidato = limparDigitos(encontrado);
    if (ehCnpjValido(candidato)) return candidato;
  }
  return null;
}

function extrairChaveAcesso(texto: string): string | null {
  const normalizado = normalizarRotulos(texto);
  const indiceRotulo = normalizado.indexOf("CHAVE DE ACESSO");
  if (indiceRotulo >= 0) {
    const inicioValor = indiceRotulo + "CHAVE DE ACESSO".length;
    const trecho = texto.slice(inicioValor, inicioValor + 180);
    const digitos = limparDigitos(trecho);
    if (digitos.length >= 44) return digitos.slice(0, 44);
  }
  return texto.match(/\b\d{44}\b/)?.[0] ?? null;
}

/**
 * Lê somente a primeira página do DANFE. Os padrões variam entre emissores;
 * qualquer campo sem evidência textual suficiente permanece nulo para revisão.
 */
export async function extrairDadosNfePdf(buffer: Buffer): Promise<NfeDadosExtraidos> {
  const data = await pdfParse(buffer, { max: 1 });
  const texto = data.text ?? "";
  const linhas = texto.split(/\r?\n/).map(linha => linha.trim()).filter(Boolean);
  const textoCompacto = normalizarRotulos(texto).replace(/\s+/g, " ");

  const razaoSocial =
    valorAposRotulo(linhas, /RAZAO\s+SOCIAL\s*[:\-]\s*/i, /^RAZAO\s+SOCIAL$/i) ??
    valorAposRotulo(linhas, /NOME\s+EMPRESARIAL\s*[:\-]\s*/i, /^NOME\s+EMPRESARIAL$/i) ??
    valorAposRotulo(linhas, /EMITENTE\s*[:\-]\s*/i) ??
    nomeAposIdentificacaoEmitente(linhas);
  const nomeFantasia =
    valorAposRotulo(linhas, /NOME\s+FANTASIA\s*[:\-]\s*/i, /^NOME\s+FANTASIA$/i) ??
    valorAposRotulo(linhas, /FANTASIA\s*[:\-]\s*/i, /^FANTASIA$/i);

  const numero =
    textoCompacto
      .match(
        /(?:NUMERO\s+DA\s+(?:NF-?E|NOTA\s+FISCAL)|N\s*O\.?\s*(?:DA\s*)?(?:NF-?E|NOTA\s+FISCAL)?|NOTA\s+FISCAL)\s*[:#.\-]?\s*(\d[\d./-]{0,19})/i
      )?.[1]
      ?.replace(/[./-]+$/, "") ?? null;
  const serie = textoCompacto.match(/SERIE\s*[:#.\-]?\s*(\d{1,5})/i)?.[1] ?? null;

  return {
    nfeCnpj: extrairCnpj(texto),
    nfeRazaoSocial: razaoSocial,
    nfeNomeFantasia: nomeFantasia,
    nfeNumero: numero,
    nfeSerie: serie,
    nfeChaveAcesso: extrairChaveAcesso(texto),
  };
}
