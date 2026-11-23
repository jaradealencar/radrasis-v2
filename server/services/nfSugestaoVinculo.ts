// ─── MOTOR DE SUGESTÃO: ITEM DA NF → MATÉRIA-PRIMA + CONVERSÃO DE UNIDADE ──
// Zero dependência de I/O. Recebe o que já foi consultado no banco (item da
// NF, candidatos de matéria-prima com seu cadastro técnico, e a memória
// aprendida de confirmações anteriores do mesmo fornecedor) e devolve UMA
// sugestão por item: qual MP, qual unidade do Mubisys, qual fator de
// conversão e — fundamental para auditoria — o texto explicando a conta.
//
// Nunca inventa um fator sem dado técnico suficiente: devolve `pendente` e
// diz exatamente o que falta cadastrar (mesmo texto de pendência que
// `cpqCadastroMateria.ts` já usa em Produtos > Matérias-primas), para o
// gestor corrigir o cadastro de origem em vez de digitar um número solto
// aqui.

import { kgPorMetroPerfil, normalizarFormatoPerfil, pesoChapaKg } from "../../shared/peso";

export type UnidadeCompraNf = "KG" | "UN" | "LT" | "ML" | "M2";
export type UnidadeErp = "KG" | "ML" | "M2" | "UN" | "LT";

/** Subconjunto de materia_prima_cadastros relevante para a conversão (mesmos campos que cpqPeso.ts já consome). */
export interface DadosTecnicosMateriaPrima {
  tipo: "chapa" | "perfil" | "bobina" | "outro" | null;
  espessuraMm: number | null;
  densidadeGCm3: number | null;
  perfilFormato: string | null;
  perfilAlturaMm: number | null;
  perfilLarguraMm: number | null;
}

export interface CandidatoMateriaPrima {
  id: number;
  nome: string;
  mubisysMateriaPrimaId: number;
  unidadeMedida: string; // o que o Mubisys já diz que a MP usa (materias_primas.unidade_medida)
  custoUnitarioCadastrado: number | null;
  dadosTecnicos: DadosTecnicosMateriaPrima | null;
}

/** Linha gravada em nf_mp_vinculos para este fornecedor+código, se existir. */
export interface MemoriaVinculo {
  materiaPrimaId: number;
  unidadeCompraNf?: string | null;
  unidadeCompraConversao?: string | null;
  unidadeErp: UnidadeErp;
  fatorConversao: number;
  origemFator: string;
  baseCalculoTexto: string | null;
  vezesUsado: number;
}

export interface ItemParaSugestao {
  codigoFornecedor: string;
  descricao: string;
  unidadeCompra: UnidadeCompraNf;
}

export type ConfiancaSugestao = "alta" | "media" | "baixa" | "nenhuma";

export interface SugestaoVinculo {
  materiaPrimaId: number | null;
  nomeMateriaPrima: string | null;
  unidadeCompraConversao: UnidadeCompraNf;
  unidadeErp: UnidadeErp | null;
  fatorConversao: number | null;
  origemFator:
    | "memoria"
    | "cadastro_densidade_chapa"
    | "cadastro_densidade_perfil"
    | "unidade_identica"
    | null;
  baseCalculoTexto: string | null;
  confianca: ConfiancaSugestao;
  pendencias: string[]; // o que falta para o sistema conseguir calcular sozinho
}

export const normalizarUnidadeErp = (bruta: string): UnidadeErp | null => {
  const s = bruta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  if (s.includes("metro linear") || s === "ml" || s === "m" || s === "mt") return "ML";
  if (s.includes("metro quadrado") || s === "m2" || s === "m²") return "M2";
  if (s.includes("quilograma") || s === "kg" || s === "kgm" || s === "kgs") return "KG";
  if (s.includes("litro") || s === "lt" || s === "l") return "LT";
  if (
    s.includes("unidade") ||
    ["un", "und", "unid", "pc", "pcs", "pce", "pct", "pacote", "pacotes", "cx", "cxs", "caixa", "caixas", "fdo", "fardo", "fardos", "kit", "rl", "rolo", "rolos", "bobina", "bobinas"].includes(s)
  ) return "UN";
  return null;
};

function descricaoIndicaEmbalagemComMultiplos(texto: string): boolean {
  const normalizada = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /\b(caixa|cx|pacote|pct|kit|fardo|conjunto|rolos?|unidades? por|c\s*\/\s*\d+|com\s+\d+\s*(?:rolos?|unidades?|pecas?))\b/.test(normalizada);
}

function arredondar(valor: number, casas: number): number {
  return Number(valor.toFixed(casas));
}

/**
 * Resolve o fator de conversão (1 unidade de compra = fator unidade ERP) a
 * partir do cadastro técnico da MP já existente em materia_prima_cadastros —
 * a MESMA fórmula que o CPQ usa para calcular o peso do letreiro
 * (shared/peso.ts: kgPorMetroPerfil / pesoChapaKg), só que invertida (quantos
 * ml/m² rendem 1 kg, em vez de quantos kg pesa 1 ml/m²).
 *
 * Devolve `null` com a lista de pendências quando o cadastro não tem dado
 * suficiente — nunca assume um valor.
 */
function resolverFatorPorCadastroTecnico(
  unidadeCompra: UnidadeCompraNf,
  mp: CandidatoMateriaPrima,
): { unidadeErp: UnidadeErp; fatorConversao: number; origemFator: SugestaoVinculo["origemFator"]; baseCalculoTexto: string } | { pendencias: string[] } {
  const unidadeErpCadastro = normalizarUnidadeErp(mp.unidadeMedida);
  const tecnico = mp.dadosTecnicos;

  // Caso simples: a unidade de compra já é a mesma que o Mubisys usa (ex:
  // comprou em metro linear, consome em metro linear) — fator 1, sem precisar
  // de densidade nem geometria.
  if (unidadeErpCadastro && unidadeCompra === unidadeErpCadastro) {
    return {
      unidadeErp: unidadeErpCadastro,
      fatorConversao: 1,
      origemFator: "unidade_identica",
      baseCalculoTexto: `Unidade de compra (${unidadeCompra}) já é igual à unidade do Mubisys (${unidadeErpCadastro}) — fator 1:1, sem conversão.`,
    };
  }

  // kg → ml (perfil/tira: lateral, retorno, aro soldado)
  if (unidadeCompra === "KG" && unidadeErpCadastro === "ML") {
    if (!tecnico || tecnico.tipo !== "perfil")
      return { pendencias: ["Esta matéria-prima não está classificada como categoria de perfil em Administração > Produtos > Matérias-primas — sem isso não há como calcular kg → metro linear automaticamente."] };
    const formato = normalizarFormatoPerfil(tecnico.perfilFormato);
    const pendencias: string[] = [];
    if (!(tecnico.perfilLarguraMm && tecnico.perfilLarguraMm > 0)) pendencias.push("largura/diâmetro do perfil");
    if (!(tecnico.densidadeGCm3 && tecnico.densidadeGCm3 > 0)) pendencias.push("densidade");
    if (formato !== "barra" && formato !== "redonda" && !(tecnico.espessuraMm && tecnico.espessuraMm > 0))
      pendencias.push("espessura");
    // "tira" (chapa dobrada, ex.: lateral/retorno/aro soldado) só precisa de
    // largura + espessura + densidade, nunca de altura — diferente de
    // tubo/cantoneira/U, que são seções fechadas.
    if (pendencias.length) return { pendencias: pendencias.map(p => `Perfil sem ${p} cadastrada.`) };

    const kgPorM = kgPorMetroPerfil(
      tecnico.perfilAlturaMm,
      tecnico.perfilLarguraMm as number,
      tecnico.espessuraMm,
      tecnico.densidadeGCm3 as number,
      formato,
    );
    if (kgPorM == null || kgPorM <= 0)
      return { pendencias: ["Medidas do perfil incompatíveis (a parede/espessura não forma uma seção válida) — confira o cadastro técnico."] };

    const fator = arredondar(1 / kgPorM, 8);
    return {
      unidadeErp: "ML",
      fatorConversao: fator,
      origemFator: "cadastro_densidade_perfil",
      baseCalculoTexto:
        `Perfil (${formato}): ${tecnico.perfilLarguraMm}mm largura` +
        (tecnico.perfilAlturaMm ? ` × ${tecnico.perfilAlturaMm}mm altura` : "") +
        (tecnico.espessuraMm ? ` × ${tecnico.espessuraMm}mm espessura` : "") +
        ` × ${tecnico.densidadeGCm3} g/cm³ = ${arredondar(kgPorM, 4)} kg/m → 1 kg = ${fator} ml.`,
    };
  }

  // kg → m² (chapa plana: galvanizado, inox, alumínio em chapa, PVC expandido)
  if (unidadeCompra === "KG" && unidadeErpCadastro === "M2") {
    if (!tecnico || tecnico.tipo !== "chapa")
      return { pendencias: ["Esta matéria-prima não está classificada como categoria de chapa em Administração > Produtos > Matérias-primas — sem isso não há como calcular kg → m² automaticamente."] };
    const pendencias: string[] = [];
    if (!(tecnico.espessuraMm && tecnico.espessuraMm > 0)) pendencias.push("espessura");
    if (!(tecnico.densidadeGCm3 && tecnico.densidadeGCm3 > 0)) pendencias.push("densidade");
    if (pendencias.length) return { pendencias: pendencias.map(p => `Chapa sem ${p} cadastrada.`) };

    const kgPorM2 = pesoChapaKg(1, tecnico.espessuraMm as number, tecnico.densidadeGCm3 as number);
    if (!(kgPorM2 > 0)) return { pendencias: ["Espessura/densidade da chapa resultaram em peso por m² inválido."] };

    const fator = arredondar(1 / kgPorM2, 8);
    return {
      unidadeErp: "M2",
      fatorConversao: fator,
      origemFator: "cadastro_densidade_chapa",
      baseCalculoTexto: `Chapa: ${tecnico.espessuraMm}mm espessura × ${tecnico.densidadeGCm3} g/cm³ = ${arredondar(kgPorM2, 4)} kg/m² → 1 kg = ${fator} m².`,
    };
  }

  // unidade → m² (acrílico/PVC vendido em chapa inteira) é resolvido à parte,
  // por quem chama, usando as dimensões de estudio_chapas (este módulo não
  // tem acesso a essa tabela — ver resolverFatorUnidadeParaChapaM2 abaixo).
  return {
    pendencias: [
      `Conversão de ${unidadeCompra} para ${unidadeErpCadastro ?? mp.unidadeMedida} ainda não é automática para esta combinação — informe o fator manualmente desta vez; a próxima NF deste fornecedor com o mesmo código já virá preenchida.`,
    ],
  };
}

/**
 * Resolve o fator UN → M² para chapa vendida em unidade inteira (acrílico,
 * PVC expandido), a partir das dimensões já cadastradas em `estudio_chapas`
 * (altura × largura). Função separada porque fica em outra tabela.
 */
export function resolverFatorUnidadeParaChapaM2(params: {
  alturaMm: number;
  larguraMm: number;
}): { unidadeErp: "M2"; fatorConversao: number; baseCalculoTexto: string } {
  const areaM2 = (params.alturaMm * params.larguraMm) / 1_000_000;
  return {
    unidadeErp: "M2",
    fatorConversao: arredondar(areaM2, 8),
    baseCalculoTexto: `Chapa de ${params.alturaMm}×${params.larguraMm}mm = ${arredondar(areaM2, 4)} m² por unidade comprada.`,
  };
}

/**
 * Sugere, para UM item da NF, qual matéria-prima vincular e qual conversão
 * usar — nesta ordem de prioridade:
 *   1. Memória (fornecedor + código do produto já confirmados antes) — confiança alta.
 *   2. Cadastro técnico da MP já escolhida/candidata — confiança média.
 *   3. Nada resolvível automaticamente — confiança nenhuma, lista pendências.
 */
export function sugerirVinculoItem(
  item: ItemParaSugestao,
  memoria: MemoriaVinculo | null,
  candidatos: CandidatoMateriaPrima[],
): SugestaoVinculo {
  const unidadeCompraNormalizada = (
    normalizarUnidadeErp(item.unidadeCompra) ?? item.unidadeCompra
  ) as UnidadeCompraNf;

  if (memoria) {
    const mp = candidatos.find(c => c.id === memoria.materiaPrimaId);
    const unidadeErpAtual = mp ? normalizarUnidadeErp(mp.unidadeMedida) : null;
    const unidadeErp = unidadeErpAtual ?? memoria.unidadeErp;
    const unidadeCompraNfAtual = normalizarUnidadeErp(item.unidadeCompra) ?? item.unidadeCompra;
    const unidadeCompraNfMudou = Boolean(
      memoria.unidadeCompraNf &&
      (normalizarUnidadeErp(memoria.unidadeCompraNf) ?? memoria.unidadeCompraNf) !== unidadeCompraNfAtual
    );
    const unidadeCompraConversao = unidadeCompraNfMudou
      ? unidadeCompraNfAtual as UnidadeCompraNf
      : (memoria.unidadeCompraConversao ?? unidadeCompraNfAtual) as UnidadeCompraNf;
    const unidadeMudou = unidadeErp !== memoria.unidadeErp;
    const fatorIncompativel = unidadeMudou || unidadeCompraNfMudou;
    return {
      materiaPrimaId: memoria.materiaPrimaId,
      nomeMateriaPrima: mp?.nome ?? null,
      unidadeCompraConversao,
      unidadeErp,
      fatorConversao: fatorIncompativel ? null : memoria.fatorConversao,
      origemFator: fatorIncompativel ? null : "memoria",
      baseCalculoTexto: fatorIncompativel
        ? unidadeMudou
          ? `A unidade desta matéria-prima mudou no MubiSys de ${memoria.unidadeErp} para ${unidadeErp}; o fator salvo foi descartado para evitar custo em unidade incorreta. Recalcule a conversão.`
          : `A unidade da NF mudou de ${memoria.unidadeCompraNf} para ${item.unidadeCompra}; o fator salvo foi descartado. Confirme o par de unidades e recalcule.`
        : (memoria.baseCalculoTexto ?? "Vínculo salvo de uma confirmação anterior.") +
          ` (usado ${memoria.vezesUsado}× com este fornecedor)`,
      confianca: fatorIncompativel ? "media" : "alta",
      pendencias: fatorIncompativel
        ? [unidadeMudou
          ? `A unidade MubiSys foi atualizada para ${unidadeErp}; confirme um novo fator de conversão.`
          : `A unidade da NF mudou para ${item.unidadeCompra}; confirme a origem e o fator de conversão.`]
        : [],
    };
  }

  if (candidatos.length === 0) {
    return {
      materiaPrimaId: null,
      nomeMateriaPrima: null,
      unidadeCompraConversao: unidadeCompraNormalizada,
      unidadeErp: null,
      fatorConversao: null,
      origemFator: null,
      baseCalculoTexto: null,
      confianca: "nenhuma",
      pendencias: ["Nenhuma matéria-prima vinculada ainda — busque e selecione manualmente."],
    };
  }

  // Sem memória: usa o 1º candidato (a tela deixa o usuário trocar) e tenta
  // resolver o fator pelo cadastro técnico dele.
  const mp = candidatos[0];
  const unidadeErpCandidata = normalizarUnidadeErp(mp.unidadeMedida);
  // UN na NF pode representar uma caixa/pacote com várias unidades internas.
  // Nesse caso, a igualdade do código da unidade não é prova de equivalência;
  // exige que o usuário informe o conteúdo no assistente. Memórias confirmadas
  // continuam sendo tratadas acima e preservam o fator já aprovado.
  if (
    unidadeCompraNormalizada === "UN" &&
    unidadeErpCandidata === "UN" &&
    descricaoIndicaEmbalagemComMultiplos(item.descricao + " " + mp.nome)
  ) {
    return {
      materiaPrimaId: mp.id,
      nomeMateriaPrima: mp.nome,
      unidadeCompraConversao: unidadeCompraNormalizada,
      unidadeErp: "UN",
      fatorConversao: null,
      origemFator: null,
      baseCalculoTexto: null,
      confianca: "baixa",
      pendencias: ["A descrição indica embalagem com múltiplas unidades — informe quantas unidades internas correspondem a 1 UN da NF."],
    };
  }
  const resolucao = resolverFatorPorCadastroTecnico(unidadeCompraNormalizada, mp);

  if ("pendencias" in resolucao) {
    return {
      materiaPrimaId: mp.id,
      nomeMateriaPrima: mp.nome,
      unidadeCompraConversao: unidadeCompraNormalizada,
      unidadeErp: normalizarUnidadeErp(mp.unidadeMedida),
      fatorConversao: null,
      origemFator: null,
      baseCalculoTexto: null,
      confianca: "baixa",
      pendencias: resolucao.pendencias,
    };
  }

  return {
    materiaPrimaId: mp.id,
    nomeMateriaPrima: mp.nome,
    unidadeCompraConversao: unidadeCompraNormalizada,
    unidadeErp: resolucao.unidadeErp,
    fatorConversao: resolucao.fatorConversao,
    origemFator: resolucao.origemFator,
    baseCalculoTexto: resolucao.baseCalculoTexto,
    confianca: "media",
    pendencias: [],
  };
}
