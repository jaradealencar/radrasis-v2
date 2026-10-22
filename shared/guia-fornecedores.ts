/**
 * Constantes e tipos compartilhados para o Guia de Fornecedores e Questionário de Parceiros.
 */

export const PRODUTOS_FORNECEDOR_PADRAO = [
  { id: "letreiros", label: "Letreiros (Letra Caixa, ACM, etc.)" },
  { id: "banner_faixas", label: "Banner e faixas" },
  { id: "adesivos", label: "Adesivos (Impressão digital e vinil)" },
  { id: "totens", label: "Totens" },
  { id: "placas", label: "Placas (Fachadas e sinalização)" },
  { id: "luminosos", label: "Luminosos (Backlight, Frontlight)" },
  { id: "materiais_pdv", label: "Materiais de PDV (Displays, etc.)" },
  { id: "envelopamento_carros", label: "Envelopamento de carros e frotas" },
  { id: "sinalizacao_corporativa", label: "Sinalização corporativa" },
  { id: "brindes", label: "Brindes personalizados" },
  { id: "panfletos_folders", label: "Panfletos e folders" },
] as const;

export type ProdutoFornecedorId = typeof PRODUTOS_FORNECEDOR_PADRAO[number]["id"];

export interface PerfilFornecedorEnriquecido {
  logoUrl?: string | null;
  atendeCidadesVizinhas: boolean;
  raioAtendimentoKm?: number | null;
  cidadesAtendidas?: string | null;
  produtos: string[];
  outrosProdutos?: string[] | null;
  telefoneContato?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  site?: string | null;
  descricao?: string | null;
}
