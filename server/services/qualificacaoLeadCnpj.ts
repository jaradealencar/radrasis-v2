/**
 * Qualificação determinística de leads B2B a partir de dados de CNPJ.
 * Ver docs/inteligencia-mercado-leads-cnpj.md para a especificação completa
 * (CNAEs-alvo, matriz de score, prompt de IA).
 *
 * O cálculo de score (`qualificarLeadCnpj`) é puro, sem I/O. O prompt de IA
 * (`PROMPT_LEAD_CNPJ_V1` + `montarMensagemLeadCnpj`) também é puro — quem
 * efetivamente chama o LLM é o router (`server/routers/leadsCnpj.ts`), que é
 * quem tem acesso a `invokeLLM`. Mantém a mesma separação entre cálculo
 * determinístico e chamada de IA usada no resto do sistema.
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

/** A OpenCNPJ devolve o porte por extenso com a sigla entre parênteses (ex.
 * "Microempresa (ME)", "Empresa de Pequeno Porte (EPP)"), confirmado por
 * chamada real — não a sigla sozinha. Casar por substring, não igualdade. */
function pontosPorte(porte: string): number {
  const p = porte.trim().toLowerCase();
  if (p.includes("demais") || p.includes("grande")) return 100;
  if (p.includes("epp") || p.includes("pequeno porte")) return 80;
  if (p.includes("me") || p.includes("microempresa")) return 40;
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

// ─── Prompt de IA (v1) — ver docs/inteligencia-mercado-leads-cnpj.md seção 4 ──

export const VERSAO_PROMPT_LEAD_CNPJ = "v1";

export const PROMPT_LEAD_CNPJ_V1 = `Você é um analista de qualificação de leads B2B para uma fábrica de letras metálicas, letras-caixa, letreiros luminosos e fachadas comerciais que vende exclusivamente por terceirização — para gráficas, agências de comunicação visual, birôs de impressão e empresas de sinalização, nunca para o cliente final.

Você recebe: os dados cadastrais de uma empresa já aprovada pela regra de filtro (situação ativa, CNAE compatível) e o score determinístico (A/B/C/D) já calculado pelo sistema, com os fatores que o compuseram. Não recalcule o score nem invente dados que não estejam no JSON fornecido.

Produza três seções, curtas e diretas:

1. "Potencial do lead": com base em porte, capital social, idade da empresa e o(s) CNAE(s) que bateram na lista-alvo, estime se a empresa provavelmente compra letreiro em volume alto, médio ou baixo — e diga explicitamente que é uma estimativa por porte cadastral, não um dado de compra real (o sistema não tem acesso ao volume de compras dessa empresa).

2. "Argumento de venda B2B": aponte a dor de terceirização mais provável para o perfil dessa empresa (ex.: uma empresa de instalação de painéis sem CNAE de fabricação provavelmente terceiriza 100% da produção; uma agência de design provavelmente não tem estrutura fabril nenhuma; uma gráfica com CNAE de impressão publicitária pode estar tentando expandir para letreiro sem ter maquinário). Formule como uma pergunta ou abertura de conversa, nunca como afirmação de fato sobre a empresa específica.

3. "Quem abordar": olhando o QSA, identifique o(s) sócio(s) com qualificação mais provável de decidir sobre fornecedores (ex.: "Administrador", "Sócio-Administrador", "Diretor") — se houver mais de um nome plausível, liste todos sem apontar um único "responsável" fabricado. Se o QSA não tiver ninguém com qualificação decisória clara, diga isso e sugira abordar pelo contato institucional da empresa.

Nunca prometa condições comerciais, nunca afirme que a empresa "com certeza" compra ou vai comprar, e nunca trate o score de aderência como uma garantia. Separe sempre fato cadastral (o que está no JSON) de hipótese comercial (o que você está inferindo). Responda em português do Brasil.`;

/** Monta a mensagem de usuário enviada ao LLM: só os campos relevantes já
 * aprovados e o resultado do scorer — nunca a base de clientes nem dados de
 * outros leads (princípio de contexto mínimo necessário). */
export function montarMensagemLeadCnpj(dados: OpenCnpjResponse, resultado: ResultadoQualificacaoLead): string {
  const cadastro = {
    razao_social: dados.razao_social,
    nome_fantasia: dados.nome_fantasia,
    municipio: dados.municipio,
    uf: dados.uf,
    porte_empresa: dados.porte_empresa,
    capital_social: dados.capital_social,
    data_inicio_atividade: dados.data_inicio_atividade,
    natureza_juridica: dados.natureza_juridica,
    QSA: (dados.QSA ?? []).map(s => ({ nome: s.nome_socio, qualificacao: s.qualificacao_socio, desde: s.data_entrada_sociedade })),
  };
  return JSON.stringify({
    dadosCadastrais: cadastro,
    cnaesQueBateramNaListaAlvo: resultado.cnaesRelevantes,
    scoreCalculado: resultado.score,
    fatoresDoScore: resultado.fatoresScore,
  }, null, 2);
}
