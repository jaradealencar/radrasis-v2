/**
 * Subclassificação interna das matérias-primas de "Produtividade" (Produtos > Matérias-primas).
 *
 * As linhas "Produtividade …" do MubiSys (mão de obra da solda e afins) ganham três marcações locais, que o MubiSys não tem:
 * - tipo de solda (fixação): até 3 entre barra roscada, patinha para LED, chapinha dupla-face, orelhinha e sem fixação;
 * - tamanho: menor ou igual a 11 cm e/ou maior que 11 cm (uma produtividade pode valer para os dois tamanhos);
 * - materiais: a quais materiais a solda se aplica (inox, galvanizado, latão, acrílico, alumínio), sem limite;
 * - estilo do letreiro (pedido de 06/10/2026), cada grupo com marcação múltipla: categoria (Frontlight ou Tradicionais, e o aro do
 *   Frontlight: normal ou recuado), formato (cursiva ou tradicional) e fundo (com ou sem fundo).
 *
 * "Sem fixação" é o oposto das demais fixações, então não combina com elas.
 */
export const TIPOS_SOLDA = ["barra_roscada", "patinha_led", "chapinha_dupla_face", "orelhinha", "sem_fixacao"] as const;
export type TipoSolda = (typeof TIPOS_SOLDA)[number];

export const MAX_TIPOS_SOLDA = 3;

export const ROTULO_TIPO_SOLDA: Record<TipoSolda, string> = {
  barra_roscada: "Barra roscada",
  patinha_led: "Patinha para LED",
  chapinha_dupla_face: "Chapinha dupla-face",
  orelhinha: "Orelhinha",
  sem_fixacao: "Sem fixação",
};

export const TAMANHOS_PRODUTIVIDADE = ["ate_11cm", "acima_11cm"] as const;
export type TamanhoProdutividade = (typeof TAMANHOS_PRODUTIVIDADE)[number];

export const ROTULO_TAMANHO_PRODUTIVIDADE: Record<TamanhoProdutividade, string> = {
  ate_11cm: "Menor ou igual a 11 cm",
  acima_11cm: "Maior que 11 cm",
};

export const MATERIAIS_SOLDA = ["inox", "galvanizado", "latao", "acrilico", "aluminio"] as const;
export type MaterialSolda = (typeof MATERIAIS_SOLDA)[number];

export const ROTULO_MATERIAL_SOLDA: Record<MaterialSolda, string> = {
  inox: "Inox",
  galvanizado: "Galvanizado",
  latao: "Latão",
  acrilico: "Acrílico",
  aluminio: "Alumínio",
};

const semAcento = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Matéria-prima de produtividade: o nome contém "produtividade", exceto as "Produtividade Geral …"
 * (ex.: "Produtividade Geral - Hora"), que não são de solda e ficam sem a subclassificação.
 */
export function ehMateriaProdutividade(nome: string | null | undefined): boolean {
  const normalizado = semAcento(nome ?? "");
  return normalizado.includes("produtividade") && !normalizado.startsWith("produtividade geral");
}

export function ehTipoSolda(valor: unknown): valor is TipoSolda {
  return typeof valor === "string" && (TIPOS_SOLDA as readonly string[]).includes(valor);
}

export function ehTamanhoProdutividade(valor: unknown): valor is TamanhoProdutividade {
  return typeof valor === "string" && (TAMANHOS_PRODUTIVIDADE as readonly string[]).includes(valor);
}

/** Lê os tamanhos do banco: descarta desconhecidos e repetidos e devolve na ordem fixa de `TAMANHOS_PRODUTIVIDADE`. */
export function normalizarTamanhosProdutividade(valor: unknown): TamanhoProdutividade[] {
  if (!Array.isArray(valor)) return [];
  return TAMANHOS_PRODUTIVIDADE.filter(tamanho => valor.includes(tamanho));
}

/** Mensagem de erro se houver tamanhos repetidos; `null` se estiver ok. */
export function erroTamanhosProdutividade(tamanhos: readonly TamanhoProdutividade[]): string | null {
  return new Set(tamanhos).size !== tamanhos.length ? "Há tamanhos repetidos." : null;
}

/** Marca ou desmarca um tamanho, mantendo a ordem fixa (uma produtividade pode valer para os dois). */
export function alternarTamanhoProdutividade(selecionados: readonly TamanhoProdutividade[], tamanho: TamanhoProdutividade): TamanhoProdutividade[] {
  return TAMANHOS_PRODUTIVIDADE.filter(item => (item === tamanho ? !selecionados.includes(item) : selecionados.includes(item)));
}

export function ehMaterialSolda(valor: unknown): valor is MaterialSolda {
  return typeof valor === "string" && (MATERIAIS_SOLDA as readonly string[]).includes(valor);
}

/** Lê os materiais do banco: descarta desconhecidos e repetidos e devolve na ordem fixa de `MATERIAIS_SOLDA`. */
export function normalizarMateriaisSolda(valor: unknown): MaterialSolda[] {
  if (!Array.isArray(valor)) return [];
  return MATERIAIS_SOLDA.filter(material => valor.includes(material));
}

/** Mensagem de erro se houver materiais repetidos; `null` se estiver ok. */
export function erroMateriaisSolda(materiais: readonly MaterialSolda[]): string | null {
  return new Set(materiais).size !== materiais.length ? "Há materiais repetidos." : null;
}

/** Marca ou desmarca um material, mantendo a ordem fixa. */
export function alternarMaterialSolda(selecionados: readonly MaterialSolda[], material: MaterialSolda): MaterialSolda[] {
  return MATERIAIS_SOLDA.filter(item => (item === material ? !selecionados.includes(item) : selecionados.includes(item)));
}

/** Lê o que veio do banco: descarta valores desconhecidos e repetidos e devolve na ordem fixa de `TIPOS_SOLDA`. */
export function normalizarTiposSolda(valor: unknown): TipoSolda[] {
  if (!Array.isArray(valor)) return [];
  return TIPOS_SOLDA.filter(tipo => valor.includes(tipo));
}

/** Mensagem de erro se a escolha não for permitida (mais de 3, repetidos ou "sem fixação" junto de outra fixação); `null` se estiver ok. */
export function erroTiposSolda(tipos: readonly TipoSolda[]): string | null {
  if (new Set(tipos).size !== tipos.length) return "Há tipos de solda repetidos.";
  if (tipos.length > MAX_TIPOS_SOLDA) return `Escolha no máximo ${MAX_TIPOS_SOLDA} tipos de solda.`;
  if (tipos.includes("sem_fixacao") && tipos.length > 1) return "\"Sem fixação\" não combina com outro tipo de solda.";
  return null;
}

/**
 * Alterna um tipo na seleção respeitando as regras: "sem fixação" desmarca as demais (e vice-versa) e o limite de 3 impede
 * marcar mais um. Devolve a nova seleção (ou a mesma, se a marcação não for permitida).
 */
export function alternarTipoSolda(selecionados: readonly TipoSolda[], tipo: TipoSolda): TipoSolda[] {
  if (selecionados.includes(tipo)) return selecionados.filter(item => item !== tipo);
  if (tipo === "sem_fixacao") return ["sem_fixacao"];
  const comOutros: readonly TipoSolda[] = selecionados.filter(item => item !== "sem_fixacao");
  if (comOutros.length >= MAX_TIPOS_SOLDA) return [...selecionados];
  return TIPOS_SOLDA.filter(item => item === tipo || comOutros.includes(item));
}

// ─── Estilo do letreiro: categoria (+ aro do Frontlight), formato e fundo ─────────────────────────────────────────

export const CATEGORIAS_PRODUTIVIDADE = ["frontlight", "tradicional"] as const;
export type CategoriaProdutividade = (typeof CATEGORIAS_PRODUTIVIDADE)[number];
export const ROTULO_CATEGORIA_PRODUTIVIDADE: Record<CategoriaProdutividade, string> = {
  frontlight: "Frontlight",
  tradicional: "Tradicionais",
};

/** Subcategoria do Frontlight: só vale quando a produtividade também está marcada como Frontlight. */
export const AROS_FRONTLIGHT = ["normal", "recuado"] as const;
export type AroFrontlight = (typeof AROS_FRONTLIGHT)[number];
export const ROTULO_ARO_FRONTLIGHT: Record<AroFrontlight, string> = {
  normal: "Aro normal",
  recuado: "Aro recuado",
};

export const FORMATOS_PRODUTIVIDADE = ["cursiva", "tradicional"] as const;
export type FormatoProdutividade = (typeof FORMATOS_PRODUTIVIDADE)[number];
export const ROTULO_FORMATO_PRODUTIVIDADE: Record<FormatoProdutividade, string> = {
  cursiva: "Cursiva",
  tradicional: "Tradicional",
};

export const FUNDOS_PRODUTIVIDADE = ["com_fundo", "sem_fundo"] as const;
export type FundoProdutividade = (typeof FUNDOS_PRODUTIVIDADE)[number];
export const ROTULO_FUNDO_PRODUTIVIDADE: Record<FundoProdutividade, string> = {
  com_fundo: "Com fundo",
  sem_fundo: "Sem fundo",
};

/** Lê uma lista do banco: descarta desconhecidos e repetidos e devolve na ordem fixa de `ordem`. */
function normalizarPorOrdem<T extends string>(valor: unknown, ordem: readonly T[]): T[] {
  if (!Array.isArray(valor)) return [];
  return ordem.filter(item => valor.includes(item));
}

/** Marca ou desmarca `item`, mantendo a ordem fixa (o grupo aceita mais de uma marcação). */
function alternarPorOrdem<T extends string>(selecionados: readonly T[], ordem: readonly T[], item: T): T[] {
  return ordem.filter(opcao => (opcao === item ? !selecionados.includes(opcao) : selecionados.includes(opcao)));
}

export const normalizarCategoriasProdutividade = (valor: unknown) => normalizarPorOrdem(valor, CATEGORIAS_PRODUTIVIDADE);
export const normalizarArosFrontlight = (valor: unknown) => normalizarPorOrdem(valor, AROS_FRONTLIGHT);
export const normalizarFormatosProdutividade = (valor: unknown) => normalizarPorOrdem(valor, FORMATOS_PRODUTIVIDADE);
export const normalizarFundosProdutividade = (valor: unknown) => normalizarPorOrdem(valor, FUNDOS_PRODUTIVIDADE);

export const alternarFormatoProdutividade = (selecionados: readonly FormatoProdutividade[], formato: FormatoProdutividade) =>
  alternarPorOrdem(selecionados, FORMATOS_PRODUTIVIDADE, formato);
export const alternarFundoProdutividade = (selecionados: readonly FundoProdutividade[], fundo: FundoProdutividade) =>
  alternarPorOrdem(selecionados, FUNDOS_PRODUTIVIDADE, fundo);
export const alternarAroFrontlight = (selecionados: readonly AroFrontlight[], aro: AroFrontlight) =>
  alternarPorOrdem(selecionados, AROS_FRONTLIGHT, aro);

export interface EstiloProdutividade {
  categorias: CategoriaProdutividade[];
  aros: AroFrontlight[];
  formatos: FormatoProdutividade[];
  fundos: FundoProdutividade[];
}

export const ESTILO_PRODUTIVIDADE_VAZIO: EstiloProdutividade = { categorias: [], aros: [], formatos: [], fundos: [] };

/**
 * Alterna uma categoria. Desmarcar Frontlight leva junto os aros (eles só existem dentro do Frontlight); devolve a nova
 * categoria e os aros que sobraram.
 */
export function alternarCategoriaProdutividade(
  estilo: Pick<EstiloProdutividade, "categorias" | "aros">,
  categoria: CategoriaProdutividade
): Pick<EstiloProdutividade, "categorias" | "aros"> {
  const categorias = alternarPorOrdem(estilo.categorias, CATEGORIAS_PRODUTIVIDADE, categoria);
  return { categorias, aros: categorias.includes("frontlight") ? [...estilo.aros] : [] };
}

/** Lê o estilo do banco ou do formulário: normaliza cada grupo e tira os aros de quem não é Frontlight. */
export function normalizarEstiloProdutividade(entrada: { categorias?: unknown; aros?: unknown; formatos?: unknown; fundos?: unknown }): EstiloProdutividade {
  const categorias = normalizarCategoriasProdutividade(entrada.categorias);
  return {
    categorias,
    aros: categorias.includes("frontlight") ? normalizarArosFrontlight(entrada.aros) : [],
    formatos: normalizarFormatosProdutividade(entrada.formatos),
    fundos: normalizarFundosProdutividade(entrada.fundos),
  };
}

/** Mensagem de erro se o estilo enviado não for permitido (repetidos, ou aro sem Frontlight); `null` se estiver ok. */
export function erroEstiloProdutividade(estilo: EstiloProdutividade): string | null {
  const grupos: Array<[readonly string[], string]> = [
    [estilo.categorias, "Há categorias repetidas."],
    [estilo.aros, "Há aros repetidos."],
    [estilo.formatos, "Há formatos repetidos."],
    [estilo.fundos, "Há fundos repetidos."],
  ];
  for (const [lista, mensagem] of grupos) if (new Set(lista).size !== lista.length) return mensagem;
  if (estilo.aros.length > 0 && !estilo.categorias.includes("frontlight")) return "Aro normal ou recuado só vale para Frontlight.";
  return null;
}

/**
 * Rótulos do estilo para exibir (tabela, cadastro, PDF): o Frontlight com aro vira "Frontlight · Aro recuado" (um por aro);
 * sem aro, só "Frontlight". Depois vêm categoria Tradicionais, formatos e fundos. Sem marcação, lista vazia.
 */
export function rotulosEstiloProdutividade(estilo: EstiloProdutividade): string[] {
  const categorias = estilo.categorias.flatMap(categoria => {
    if (categoria !== "frontlight" || estilo.aros.length === 0) return [ROTULO_CATEGORIA_PRODUTIVIDADE[categoria]];
    return estilo.aros.map(aro => `${ROTULO_CATEGORIA_PRODUTIVIDADE.frontlight} · ${ROTULO_ARO_FRONTLIGHT[aro]}`);
  });
  return [
    ...categorias,
    ...estilo.formatos.map(formato => ROTULO_FORMATO_PRODUTIVIDADE[formato]),
    ...estilo.fundos.map(fundo => ROTULO_FUNDO_PRODUTIVIDADE[fundo]),
  ];
}

/** True se algum grupo do estilo tem marcação. */
export const temEstiloProdutividade = (estilo: EstiloProdutividade) =>
  estilo.categorias.length + estilo.aros.length + estilo.formatos.length + estilo.fundos.length > 0;

/** Categoria de produto (cadastro de kit do CPQ) que pode ligar produtividades de solda: só os Letreiros. */
export const CATEGORIA_COM_PRODUTIVIDADES = "Letreiros";

/** Teto de produtividades ligadas a um produto (são 42 no catálogo de 05/10/2026). */
export const MAX_PRODUTIVIDADES_RELACIONADAS = 100;

/** Categoria local (migration 0093) das matérias-primas que são mão de obra de solda ("Produtividade …" do MubiSys). */
export const CATEGORIA_PRODUTIVIDADE_SOLDA = "Produtividade para soldar";

export function ehCategoriaProdutividade(nome: string | null | undefined): boolean {
  return semAcento(nome ?? "") === semAcento(CATEGORIA_PRODUTIVIDADE_SOLDA);
}
