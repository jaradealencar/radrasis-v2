/**
 * Cliente para a API pública OpenCNPJ (https://opencnpj.org) — gratuita, sem
 * chave de autenticação. Ver docs/inteligencia-mercado-leads-cnpj.md para o
 * schema completo confirmado por chamada real nesta sessão.
 */

export interface OpenCnpjCnae {
  codigo: string;
  descricao: string;
  is_principal: boolean;
}

export interface OpenCnpjSocio {
  nome_socio: string;
  cnpj_cpf_socio: string; // mascarado pela API, ex: "***345856**"
  qualificacao_socio: string;
  data_entrada_sociedade: string;
  identificador_socio: string;
  faixa_etaria: string;
}

export interface OpenCnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  data_situacao_cadastral: string;
  data_inicio_atividade: string;
  cnae_principal: string;
  cnaes_secundarios: string[];
  cnaes: OpenCnpjCnae[];
  natureza_juridica: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cep: string;
  uf: string;
  municipio: string;
  capital_social: string; // ex: "120000000000,00" — vírgula decimal
  porte_empresa: string; // "ME" | "EPP" | "Demais"
  QSA: OpenCnpjSocio[];
}

export class CnpjNaoEncontradoError extends Error {
  constructor(cnpj: string) {
    super(`CNPJ ${cnpj} não encontrado na base da Receita Federal.`);
    this.name = "CnpjNaoEncontradoError";
  }
}

/** Remove pontuação do CNPJ (aceita com ou sem máscara) e valida o formato
 * mínimo (14 dígitos) antes de consultar a API. */
export function normalizarCnpj(cnpj: string): string {
  const limpo = cnpj.replace(/[^\dA-Za-z]/g, "");
  if (limpo.length !== 14) {
    throw new Error(`CNPJ inválido: "${cnpj}" (esperado 14 caracteres após remover pontuação, recebido ${limpo.length}).`);
  }
  return limpo;
}

export async function consultarCnpj(cnpj: string): Promise<OpenCnpjResponse> {
  const cnpjLimpo = normalizarCnpj(cnpj);
  let resp: Response;
  try {
    resp = await fetch(`https://api.opencnpj.org/${cnpjLimpo}`, {
      headers: { Accept: "application/json" },
    });
  } catch (e: any) {
    throw new Error(`Falha de rede ao consultar OpenCNPJ: ${e?.message ?? "erro desconhecido"}`);
  }
  if (resp.status === 404) throw new CnpjNaoEncontradoError(cnpjLimpo);
  if (!resp.ok) throw new Error(`OpenCNPJ retornou status ${resp.status} para o CNPJ ${cnpjLimpo}.`);
  return (await resp.json()) as OpenCnpjResponse;
}
