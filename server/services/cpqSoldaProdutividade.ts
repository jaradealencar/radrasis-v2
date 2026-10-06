/**
 * Escolha automática das "Produtividade Solda …" do MubiSys para um orçamento do CPQ.
 *
 * O vendedor informa só o tipo de fixação; o material vem do kit/título/composição e o perímetro de cada faixa de altura
 * (≤ 11 cm e > 11 cm) vem da Ficha técnica. Aqui o sistema pontua as produtividades candidatas, explica cada ponto e diz o
 * quanto confia na escolha. Regras treinadas pelo gestor (cpq_solda_regras) vencem a heurística.
 *
 * Tudo aqui é puro (sem banco nem rede) para ser testado e simulado; quem carrega candidatas e regras é a rota.
 */
import {
  MATERIAIS_SOLDA,
  type MaterialSolda,
  type TamanhoProdutividade,
  type TipoSolda,
} from "../../shared/produtividade-solda";

export type FaixaSolda = TamanhoProdutividade;
export type ConfiancaSolda = "alta" | "media" | "baixa" | "nenhuma";

export interface CandidataSolda {
  id: number;
  nome: string;
  tiposSolda: readonly TipoSolda[];
  /** Tamanhos marcados no cadastro (uma produtividade pode valer para os dois); vazio = não marcado. */
  tamanhos: readonly TamanhoProdutividade[];
  materiais: readonly MaterialSolda[];
}

export interface RegraSolda {
  id: number;
  nome: string;
  ativa: boolean;
  prioridade: number;
  material: MaterialSolda | null;
  tipoProduto: string | null;
  /** Conjunto exato de fixações; `null` = qualquer. */
  fixacaoTipos: readonly TipoSolda[] | null;
  /** Todas as palavras precisam aparecer no título do produto. */
  palavrasTitulo: readonly string[];
  faixa: FaixaSolda | null;
  materiaPrimaId: number;
}

export interface ContextoSolda {
  tiposFixacao: readonly TipoSolda[];
  titulo: string;
  tipoProduto: string | null;
  material: MaterialSolda | null;
}

export interface MotivoSolda {
  texto: string;
  pontos: number;
}

export interface OpcaoSolda {
  id: number;
  nome: string;
  pontos: number;
  motivos: MotivoSolda[];
}

export interface FaixaEntrada {
  faixa: FaixaSolda;
  perimetroM: number;
  elementos: number;
}

export interface SugestaoFaixa extends FaixaEntrada {
  /** Falso quando a faixa não tem elementos nem perímetro: nada a cobrar. */
  necessaria: boolean;
  origem: "regra" | "heuristica" | "nenhuma";
  regraId: number | null;
  confianca: ConfiancaSolda;
  escolhida: OpcaoSolda | null;
  alternativas: OpcaoSolda[];
  avisos: string[];
}

const MAX_ALTERNATIVAS = 6;

/** Minúsculas, sem acento e só com letras e números ("F/F" vira o termo único "f_f"), com espaço nas pontas para casar termos inteiros. */
export function normalizarTexto(texto: string | null | undefined): string {
  const limpo = (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bf\s*\/\s*f\b/g, "f_f")
    .replace(/[^a-z0-9_]+/g, " ")
    .trim();
  return ` ${limpo} `;
}

function contemTermo(textoNormalizado: string, termo: string): boolean {
  const alvo = normalizarTexto(termo).trim();
  return alvo.length > 0 && textoNormalizado.includes(` ${alvo} `);
}

const TERMOS_MATERIAL: Record<MaterialSolda, readonly string[]> = {
  inox: ["inox"],
  galvanizado: ["galvanizado", "galvanizada", "gal"],
  latao: ["latao"],
  acrilico: ["acrilico"],
  aluminio: ["aluminio"],
};

/** Materiais citados no texto, na ordem em que aparecem. */
function materiaisNoTexto(texto: string | null | undefined): MaterialSolda[] {
  const normalizado = normalizarTexto(texto);
  const achados: Array<{ material: MaterialSolda; posicao: number }> = [];
  for (const material of MATERIAIS_SOLDA) {
    let menor = -1;
    for (const termo of TERMOS_MATERIAL[material]) {
      const posicao = normalizado.indexOf(` ${termo} `);
      if (posicao >= 0 && (menor < 0 || posicao < menor)) menor = posicao;
    }
    if (menor >= 0) achados.push({ material, posicao: menor });
  }
  return achados.sort((a, b) => a.posicao - b.posicao).map(item => item.material);
}

export interface DeteccaoMaterial {
  material: MaterialSolda | null;
  origem: "subcategoria" | "tipo" | "titulo" | "composicao" | null;
  evidencias: string[];
  divergencias: string[];
}

const ROTULO_MATERIAL: Record<MaterialSolda, string> = {
  inox: "Inox",
  galvanizado: "Galvanizado",
  latao: "Latão",
  acrilico: "Acrílico",
  aluminio: "Alumínio",
};

/**
 * Material do letreiro. Ordem de confiança: subcategoria cadastrada no kit (Galvanizado, Inox, Latão, Alumínio), tipo do produto
 * (ex.: Acrílico montado), título e, por último, o que a composição mais cita. Divergências entre as fontes são só informadas:
 * um letreiro de inox pode ter fundo galvanizado na composição.
 */
export function detectarMaterialLetreiro(entrada: {
  subcategoria?: string | null;
  tipoProduto?: string | null;
  titulo?: string | null;
  nomesComposicao?: readonly string[];
}): DeteccaoMaterial {
  const doSubcategoria = materiaisNoTexto(entrada.subcategoria)[0] ?? null;
  const doTipo = materiaisNoTexto(entrada.tipoProduto)[0] ?? null;
  const doTitulo = materiaisNoTexto(entrada.titulo)[0] ?? null;

  const contagem = new Map<MaterialSolda, number>();
  for (const nome of entrada.nomesComposicao ?? []) {
    for (const material of new Set(materiaisNoTexto(nome))) contagem.set(material, (contagem.get(material) ?? 0) + 1);
  }
  const ordenada = [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  const doComposicao = ordenada.length && (ordenada.length === 1 || ordenada[0][1] > ordenada[1][1]) ? ordenada[0][0] : null;

  const fontes: Array<{ origem: NonNullable<DeteccaoMaterial["origem"]>; material: MaterialSolda | null; rotulo: string }> = [
    { origem: "subcategoria", material: doSubcategoria, rotulo: "a subcategoria do produto" },
    { origem: "tipo", material: doTipo, rotulo: "o tipo do produto" },
    { origem: "titulo", material: doTitulo, rotulo: "o título do produto" },
    { origem: "composicao", material: doComposicao, rotulo: "a composição" },
  ];
  const principal = fontes.find(fonte => fonte.material);
  if (!principal?.material) return { material: null, origem: null, evidencias: [], divergencias: [] };

  const evidencias = fontes
    .filter(fonte => fonte.material === principal.material)
    .map(fonte => `${fonte.rotulo[0].toUpperCase()}${fonte.rotulo.slice(1)} indica ${ROTULO_MATERIAL[principal.material!]}.`);
  const divergencias = fontes
    .filter(fonte => fonte.material && fonte.material !== principal.material)
    .map(fonte => `${fonte.rotulo[0].toUpperCase()}${fonte.rotulo.slice(1)} indica ${ROTULO_MATERIAL[fonte.material!]}, mas ${principal.rotulo} indica ${ROTULO_MATERIAL[principal.material!]}.`);
  return { material: principal.material, origem: principal.origem, evidencias, divergencias };
}

/** Estilos de solda que aparecem no nome das produtividades e no título/tipo dos produtos. */
const ESTILOS: Record<string, { rotulo: string; termos: readonly string[] }> = {
  cursivo: { rotulo: "cursivo", termos: ["cursivo", "cursiva"] },
  aro_recuado: { rotulo: "aro recuado", termos: ["aro recuado", "recuado"] },
  frontlight: { rotulo: "frontlight", termos: ["frontlight", "frontilight", "front"] },
  letra_bloco: { rotulo: "letra bloco", termos: ["letra bloco", "bloco"] },
  complexo: { rotulo: "complexo", termos: ["complexo"] },
  flat: { rotulo: "flat", termos: ["flat", "frontflat", "front flat"] },
  fundo_pvc: { rotulo: "fundo PVC", termos: ["fundo pvc"] },
  no_meio: { rotulo: "face no meio", termos: ["no meio"] },
  frente_fundo: { rotulo: "frente e fundo (F/F)", termos: ["f/f", "frente e fundo", "frente fundo"] },
};

function estilosNoTexto(texto: string | null | undefined): Set<string> {
  const normalizado = normalizarTexto(texto);
  const achados = new Set<string>();
  for (const [chave, estilo] of Object.entries(ESTILOS)) {
    if (estilo.termos.some(termo => contemTermo(normalizado, termo))) achados.add(chave);
  }
  return achados;
}

/** O nome da produtividade diz que é para letras pequenas (≤ 11 cm)? */
function nomeIndicaPequena(nomeNormalizado: string): boolean {
  return (/\b11 ?cm\b/.test(nomeNormalizado) && /\b(menor|ate|igual)\b/.test(nomeNormalizado)) || /\b8 11 ?cm\b/.test(nomeNormalizado);
}

function mesmoConjunto(a: readonly string[], b: readonly string[]): boolean {
  return new Set(a).size === new Set(b).size && [...new Set(a)].every(item => new Set(b).has(item));
}

interface Pontuacao {
  pontos: number;
  motivos: MotivoSolda[];
  excluida: boolean;
}

function pontuar(candidata: CandidataSolda, contexto: ContextoSolda, faixa: FaixaSolda, estilosPedidos: Set<string>): Pontuacao {
  const motivos: MotivoSolda[] = [];
  let excluida = false;
  const somar = (pontos: number, texto: string) => motivos.push({ texto, pontos });
  const nome = normalizarTexto(candidata.nome);

  // Tamanho: a marcação do cadastro manda (pode valer para os dois tamanhos, o que pontua menos que a marca exata); sem ela, só o nome indica.
  if (candidata.tamanhos.length) {
    if (!candidata.tamanhos.includes(faixa)) excluida = true;
    else if (candidata.tamanhos.length > 1) somar(20, "Cadastrada para os dois tamanhos (≤ 11 cm e > 11 cm).");
    else somar(30, `Tamanho marcado como ${faixa === "ate_11cm" ? "≤ 11 cm" : "> 11 cm"}.`);
  } else if (nomeIndicaPequena(nome)) {
    if (faixa === "ate_11cm") somar(15, "O nome indica letras de até 11 cm.");
    else excluida = true;
  } else if (faixa === "ate_11cm") {
    somar(-15, "O nome não indica letras pequenas e o tamanho não foi marcado no cadastro.");
  } else {
    somar(10, "Sem marca de letra pequena no nome: vale para letras maiores.");
  }

  // Fixação: conjunto exato marcado no cadastro; sem marcação, só a chapinha aparece no nome.
  const fixacao = contexto.tiposFixacao;
  if (fixacao.length) {
    if (candidata.tiposSolda.length) {
      if (mesmoConjunto(candidata.tiposSolda, fixacao)) somar(40, "Tipo de fixação igual ao escolhido.");
      else if (candidata.tiposSolda.some(tipo => fixacao.includes(tipo))) somar(10, "Tipo de fixação parcialmente igual ao escolhido.");
      else somar(-40, "Tipo de fixação diferente do escolhido.");
    } else {
      const citaChapinha = contemTermo(nome, "chapinha");
      const pedeChapinha = fixacao.includes("chapinha_dupla_face");
      if (citaChapinha && pedeChapinha) somar(20, "O nome cita chapinha e a fixação escolhida inclui chapinha dupla-face.");
      else if (citaChapinha) somar(-30, "O nome cita chapinha, mas a fixação escolhida não inclui chapinha dupla-face.");
    }
  }

  // Material: marcação do cadastro; sem ela, o que o nome cita.
  if (contexto.material) {
    if (candidata.materiais.length) {
      if (candidata.materiais.includes(contexto.material)) somar(30, `Material marcado: ${ROTULO_MATERIAL[contexto.material]}.`);
      else somar(-60, `A produtividade não está marcada para ${ROTULO_MATERIAL[contexto.material]}.`);
    } else {
      const citados = materiaisNoTexto(candidata.nome);
      if (citados.includes(contexto.material)) somar(15, `O nome cita ${ROTULO_MATERIAL[contexto.material]}.`);
      else if (citados.length) somar(-40, `O nome cita ${citados.map(item => ROTULO_MATERIAL[item]).join(" ou ")}, não ${ROTULO_MATERIAL[contexto.material]}.`);
    }
  }

  // Estilo: variante especial no nome só vale se o produto a pede; o que o produto pede e o nome não cita desfavorece.
  const estilosDoNome = estilosNoTexto(candidata.nome);
  for (const chave of estilosDoNome) {
    const { rotulo } = ESTILOS[chave];
    if (estilosPedidos.has(chave)) somar(20, `O produto pede ${rotulo}.`);
    else somar(-25, `Variante ${rotulo} que o produto não pede.`);
  }
  for (const chave of estilosPedidos) {
    if (!estilosDoNome.has(chave)) somar(-10, `O produto pede ${ESTILOS[chave].rotulo} e o nome não cita.`);
  }

  return { pontos: motivos.reduce((total, motivo) => total + motivo.pontos, 0), motivos, excluida };
}

function regraAplica(regra: RegraSolda, contexto: ContextoSolda, faixa: FaixaSolda): boolean {
  if (!regra.ativa) return false;
  if (regra.faixa && regra.faixa !== faixa) return false;
  if (regra.material && regra.material !== contexto.material) return false;
  if (regra.tipoProduto && normalizarTexto(regra.tipoProduto) !== normalizarTexto(contexto.tipoProduto)) return false;
  if (regra.fixacaoTipos && !mesmoConjunto(regra.fixacaoTipos, contexto.tiposFixacao)) return false;
  const titulo = normalizarTexto(contexto.titulo);
  return regra.palavrasTitulo.every(palavra => contemTermo(titulo, palavra));
}

function especificidade(regra: RegraSolda): number {
  return (regra.faixa ? 1 : 0) + (regra.material ? 1 : 0) + (regra.tipoProduto ? 1 : 0) + (regra.fixacaoTipos ? 1 : 0) + regra.palavrasTitulo.length;
}

function ordenarRegras(regras: readonly RegraSolda[]): RegraSolda[] {
  return [...regras].sort((a, b) => b.prioridade - a.prioridade || especificidade(b) - especificidade(a) || a.id - b.id);
}

function confiancaDoRanking(ranking: readonly OpcaoSolda[]): ConfiancaSolda {
  if (!ranking.length) return "nenhuma";
  const [primeira, segunda] = ranking;
  const margem = segunda ? primeira.pontos - segunda.pontos : Number.POSITIVE_INFINITY;
  if (margem >= 20 && primeira.pontos >= 50) return "alta";
  if (margem >= 10 && primeira.pontos >= 20) return "media";
  return "baixa";
}

/**
 * Sugere a produtividade de cada faixa de altura. Faixas sem perímetro e sem elementos ficam marcadas como não necessárias.
 * A primeira regra treinada que se aplica (e cuja produtividade ainda existe no catálogo) vence; sem regra, vale a pontuação.
 */
export function sugerirProdutividades(
  contexto: ContextoSolda,
  faixas: readonly FaixaEntrada[],
  candidatas: readonly CandidataSolda[],
  regras: readonly RegraSolda[] = [],
): SugestaoFaixa[] {
  const estilosPedidos = estilosNoTexto(`${contexto.titulo} ${contexto.tipoProduto ?? ""}`);
  const regrasOrdenadas = ordenarRegras(regras);
  const candidataPorId = new Map(candidatas.map(candidata => [candidata.id, candidata]));

  return faixas.map(entrada => {
    const necessaria = entrada.perimetroM > 0 || entrada.elementos > 0;
    const base: SugestaoFaixa = {
      ...entrada, necessaria, origem: "nenhuma", regraId: null, confianca: "nenhuma", escolhida: null, alternativas: [], avisos: [],
    };
    if (!necessaria) return base;

    const avisos: string[] = [];
    if (!contexto.tiposFixacao.length) avisos.push("O tipo de fixação não foi informado: a escolha não considera a fixação.");
    if (!contexto.material) avisos.push("Não consegui identificar o material do letreiro: a escolha não considera o material.");

    const pontuadas = candidatas.map(candidata => ({ candidata, ...pontuar(candidata, contexto, entrada.faixa, estilosPedidos) }));
    const ranking: OpcaoSolda[] = pontuadas
      .filter(item => !item.excluida)
      .map(({ candidata, pontos, motivos }) => ({ id: candidata.id, nome: candidata.nome, pontos, motivos }))
      .sort((a, b) => b.pontos - a.pontos || a.id - b.id);

    for (const regra of regrasOrdenadas) {
      if (!regraAplica(regra, contexto, entrada.faixa)) continue;
      if (!candidataPorId.has(regra.materiaPrimaId)) {
        avisos.push(`A regra "${regra.nome}" aponta para uma produtividade que não está mais no catálogo e foi ignorada.`);
        continue;
      }
      const alvo = pontuadas.find(item => item.candidata.id === regra.materiaPrimaId)!;
      const escolhida: OpcaoSolda = {
        id: alvo.candidata.id,
        nome: alvo.candidata.nome,
        pontos: alvo.pontos,
        motivos: [{ texto: `Regra treinada "${regra.nome}".`, pontos: 0 }, ...alvo.motivos],
      };
      return {
        ...base, origem: "regra", regraId: regra.id, confianca: "alta", escolhida, avisos,
        alternativas: ranking.filter(opcao => opcao.id !== escolhida.id).slice(0, MAX_ALTERNATIVAS),
      };
    }

    if (!ranking.length) {
      avisos.push("Nenhuma produtividade de solda do cadastro serve para esta faixa de altura.");
      return { ...base, avisos };
    }
    let confianca = confiancaDoRanking(ranking);
    if (confianca === "alta" && (!contexto.tiposFixacao.length || !contexto.material)) confianca = "media";
    if (confianca === "baixa") avisos.push("Há mais de uma produtividade igualmente provável: confira e, se trocar, a correção alimenta o treino.");
    return {
      ...base, origem: "heuristica", confianca, escolhida: ranking[0], avisos,
      alternativas: ranking.slice(1, 1 + MAX_ALTERNATIVAS),
    };
  });
}
