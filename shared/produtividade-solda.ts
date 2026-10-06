/**
 * Subclassificação interna das matérias-primas de "Produtividade" (Produtos > Matérias-primas).
 *
 * As linhas "Produtividade …" do MubiSys (mão de obra da solda e afins) ganham três marcações locais, que o MubiSys não tem:
 * - tipo de solda (fixação): até 3 entre barra roscada, patinha para LED, chapinha dupla-face, orelhinha e sem fixação;
 * - tamanho: menor ou igual a 11 cm, ou maior que 11 cm;
 * - materiais: a quais materiais a solda se aplica (inox, galvanizado, latão, acrílico, alumínio), sem limite.
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
