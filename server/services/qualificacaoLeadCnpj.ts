/**
 * Qualificação determinística de leads B2B a partir de dados de CNPJ.
 * Ver docs/inteligencia-mercado-leads-cnpj.md para a especificação completa
 * (CNAEs-alvo, matriz de score, prompt de IA — não acionado por este código).
 *
 * Função pura, sem I/O: recebe o JSON já obtido de server/integrations/opencnpj-client.ts.
 */

import type { OpenCnpjResponse } from "../integrations/opencnpj-client";

export type NivelConfiancaCnae = "alta" | "media";

export interface CnaeAlvo {
  codigo: string; // formato "9999-9/99", convertido para 7 dígitos na comparação
  descricao: string;
  confianca: NivelConfiancaCnae;
}

/** Lista verificada via WebSearch contra fontes oficiais (IBGE/Concla) — ver
 * docs/inteligencia-mercado-leads-cnpj.md seção 2 e 6. Revisar com o time
 * comercial antes de usar em prospecção em escala. */
export const CNAES_ALVO: CnaeAlvo[] = [
  { codigo: "3299-0/03", descricao: "Fabricação de letras, letreiros e placas de qualquer material, exceto luminosos", confianca: "alta" },
  { codigo: "3299-0/04", descricao: "Fabricação de painéis e letreiros luminosos", confianca: "alta" },
  { codigo: "4329-1/01", descricao: "Instalação de painéis publicitários", confianca: "alta" },
  { codigo: "1813-0/01", descricao: "Impressão de material para uso publicitário", confianca: "media" },
  { codigo: "1813-0/99", descricao: "Impressão de material para outros usos", confianca: "media" },
  { codigo: "7410-2/02", descricao: "Design publicitário e gráfico", confianca: "media" },
  { codigo: "7311-4/00", descricao: "Agências de publicidade", confianca: "media" },
  { codigo: "7319-0/99", descricao: "Outras atividades de publicidade não especificadas anteriormente", confianca: "media" },
];

/** Normaliza um código CNAE para 7 dígitos, aceitando tanto o formato oficial
 * "9999-9/99" quanto o formato sem pontuação retornado pela OpenCNPJ
 * ("99999999" na verdade tem 7 dígitos: "9999999" — a API confirmada nesta
 * sessão devolve algo como "3299003"). */
export function normalizarCodigoCnae(codigo: string): string {
  return codigo.replace(/\D/g, "");
}

const CNAES_ALVO_NORMALIZADOS = CNAES_ALVO.map(c => ({ ...c, codigoNorm: normalizarCodigoCnae(c.codigo) }));

export type ScoreLead = "A" | "B" | "C" | "D";

export interface CnaeBatido {
  codigo: string;
  descricao: string;
  confianca: NivelConfiancaCnae;
  isPrincipal: boolean;
}

export interface ResultadoQualificacaoLead {
  aprovado: boolean;
  motivoRejeicao: string | null;
  cnaesRelevantes: CnaeBatido[];
  melhorConfianca: NivelConfiancaCnae | null;
  score: ScoreLead | null;
  fatoresScore: {
    porte: { valor: string; pontos: number; peso: number };
    capitalSocial: { valorNumerico: number; pontos: number; peso: number };
    idadeAnos: { valor: number; pontos: number; peso: number };
    pontuacaoBruta: number; // 0-100, antes do ajuste por confiança de CNAE
    ajusteConfiancaMedia: boolean; // true quando a letra foi reduzida por não haver CNAE de confiança alta
  } | null;
}

function pontosPorte(porte: string): number {
  const p = porte.trim().toLowerCase();
  if (p === "demais") return 100;
  if (p === "epp") return 80;
  if (p === "me") return 40;
  return 40; // porte desconhecido — tratado como o mais conservador dos conhecidos
}

/** Capital social vem como string brasileira, ex: "120000000000,00". */
function parseCapitalSocial(valor: string): number {
  const limpo = valor.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
}

function pontosCapitalSocial(valor: number): number {
  if (valor >= 500_000) return 100;
  if (valor >= 100_000) return 70;
  if (valor >= 20_000) return 40;
  return 15;
}

function idadeAnos(dataInicioAtividade: string, hoje: Date): number {
  const d = new Date(dataInicioAtividade);
  if (isNaN(d.getTime())) return 0;
  return (hoje.getTime() - d.getTime()) / (365.25 * 86400000);
}

function pontosIdade(anos: number): number {
  if (anos >= 3) return 100;
  if (anos >= 1) return 60;
  return 30;
}

function letraDaPontuacao(pontos: number): ScoreLead {
  if (pontos >= 75) return "A";
  if (pontos >= 55) return "B";
  if (pontos >= 35) return "C";
  return "D";
}

function rebaixarLetra(letra: ScoreLead): ScoreLead {
  if (letra === "A") return "B";
  if (letra === "B") return "C";
  if (letra === "C") return "D";
  return "D";
}

export function qualificarLeadCnpj(dados: OpenCnpjResponse, hoje: Date = new Date()): ResultadoQualificacaoLead {
  if ((dados.situacao_cadastral ?? "").trim().toLowerCase() !== "ativa") {
    return {
      aprovado: false,
      motivoRejeicao: `Situação cadastral "${dados.situacao_cadastral}" — só empresas "Ativa" são qualificadas.`,
      cnaesRelevantes: [],
      melhorConfianca: null,
      score: null,
      fatoresScore: null,
    };
  }

  const todosCnaes = dados.cnaes ?? [];
  const cnaesRelevantes: CnaeBatido[] = [];
  for (const cnae of todosCnaes) {
    const codigoNorm = normalizarCodigoCnae(cnae.codigo);
    const alvo = CNAES_ALVO_NORMALIZADOS.find(a => a.codigoNorm === codigoNorm);
    if (alvo) {
      cnaesRelevantes.push({ codigo: cnae.codigo, descricao: alvo.descricao, confianca: alvo.confianca, isPrincipal: cnae.is_principal });
    }
  }

  if (cnaesRelevantes.length === 0) {
    return {
      aprovado: false,
      motivoRejeicao: "Nenhum CNAE (principal ou secundário) corresponde à lista-alvo de gráficas/comunicação visual/sinalização.",
      cnaesRelevantes: [],
      melhorConfianca: null,
      score: null,
      fatoresScore: null,
    };
  }

  const melhorConfianca: NivelConfiancaCnae = cnaesRelevantes.some(c => c.confianca === "alta") ? "alta" : "media";

  const pPorte = pontosPorte(dados.porte_empresa);
  const capitalNum = parseCapitalSocial(dados.capital_social);
  const pCapital = pontosCapitalSocial(capitalNum);
  const anos = idadeAnos(dados.data_inicio_atividade, hoje);
  const pIdade = pontosIdade(anos);

  const pontuacaoBruta = pPorte * 0.4 + pCapital * 0.35 + pIdade * 0.25;
  let letra = letraDaPontuacao(pontuacaoBruta);
  const ajusteConfiancaMedia = melhorConfianca === "media";
  if (ajusteConfiancaMedia) letra = rebaixarLetra(letra);

  return {
    aprovado: true,
    motivoRejeicao: null,
    cnaesRelevantes,
    melhorConfianca,
    score: letra,
    fatoresScore: {
      porte: { valor: dados.porte_empresa, pontos: pPorte, peso: 0.4 },
      capitalSocial: { valorNumerico: capitalNum, pontos: pCapital, peso: 0.35 },
      idadeAnos: { valor: Number(anos.toFixed(1)), pontos: pIdade, peso: 0.25 },
      pontuacaoBruta: Number(pontuacaoBruta.toFixed(1)),
      ajusteConfiancaMedia,
    },
  };
}
