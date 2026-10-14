/**
 * Dimensionamento de fontes para LED (Tabela de Preços > Pág. 4).
 *
 * Regra comercial: usa a fonte de maior potência repetidamente a 85% da
 * capacidade. Quando resta uma carga menor, escolhe a menor fonte que suporta
 * essa sobra; somente essa última fonte pode chegar a 92%. Assim o plano evita
 * repartir a carga por igual e prioriza a menor quantidade prática de fontes.
 */

export const FATOR_RECOMENDADO = 0.85;
export const FATOR_TOLERANCIA = 0.92;
/** Acima disso a calculadora não decide: o projeto precisa ser dividido em circuitos pela engenharia. */
export const MAX_FONTES_NO_PLANO = 10;

export interface FonteDisponivel {
  nome: string;
  potenciaW: number;
  mubisysMateriaPrimaId?: number;
  vendaDireta?: boolean | null;
  precoVendaDireta?: number | null;
}

export interface EntradaDimensionamento {
  fontes: readonly FonteDisponivel[];
  /** Consumo de uma unidade de LED: W por metro (fita) ou W por módulo. */
  wattsPorUnidade: number;
  /** Menor fração que se pode pedir: 0,1 m para fita, 1 para módulo. */
  passo: number;
  quantidade: number;
}

export type FaixaCarga = "ideal" | "tolerancia";

export interface FonteDoPlano {
  fonte: FonteDisponivel;
  /** Quantidade de LED ligada a esta fonte (na unidade da entrada). */
  quantidade: number;
  cargaW: number;
  /** Carga ÷ potência da fonte, de 0 a 1. */
  utilizacao: number;
  faixa: FaixaCarga;
}

export interface PlanoFontes {
  fontes: FonteDoPlano[];
  totalFontes: number;
  potenciaInstaladaW: number;
  maiorUtilizacao: number;
  faixa: FaixaCarga;
  /** Total pelos preços de venda direta do MubiSys; null quando algum preço está pendente. */
  valorVendaDiretaTotal: number | null;
  /** Fontes selecionadas sem venda direta válida/preço maior que zero no MubiSys. */
  precosVendaDiretaPendentes: string[];
}

export interface ResultadoDimensionamento {
  consumoTotalW: number;
  recomendado: PlanoFontes | null;
  /** Mantido no contrato para compatibilidade; a calculadora agora apresenta um único plano. */
  comFolga: PlanoFontes | null;
  aviso: string | null;
}

const EPS = 1e-9;

const arredondar = (valor: number, casas: number) => {
  const escala = 10 ** casas;
  return Math.round((valor + Number.EPSILON) * escala) / escala;
};

const casasDoPasso = (passo: number) => (Number.isInteger(passo) ? 0 : Math.min(4, String(passo).split(".")[1]?.length ?? 0));

/** Quantos passos de LED uma fonte aguenta sem passar do fator de carga. */
function capacidadeEmPassos(potenciaW: number, wattsPorPasso: number, fator: number): number {
  return Math.floor((potenciaW * fator) / wattsPorPasso + EPS);
}

function montarPlano(entrada: EntradaDimensionamento): PlanoFontes | null {
  const { wattsPorUnidade, passo, quantidade } = entrada;
  const wattsPorPasso = arredondar(wattsPorUnidade * passo, 6);
  const passosTotais = Math.ceil(quantidade / passo - EPS);
  const fontes = entrada.fontes
    .filter(fonte => capacidadeEmPassos(fonte.potenciaW, wattsPorPasso, FATOR_RECOMENDADO) >= 1)
    .slice()
    .sort((a, b) => a.potenciaW - b.potenciaW);
  if (!fontes.length) return null;

  const maiorFonte = fontes[fontes.length - 1];
  const capacidadeIdealMaior = capacidadeEmPassos(maiorFonte.potenciaW, wattsPorPasso, FATOR_RECOMENDADO);
  const capacidadeToleradaMaior = capacidadeEmPassos(maiorFonte.potenciaW, wattsPorPasso, FATOR_TOLERANCIA);
  const fontesPrincipais = Math.max(0, Math.ceil((passosTotais - capacidadeToleradaMaior) / capacidadeIdealMaior));
  const passosRestantes = passosTotais - fontesPrincipais * capacidadeIdealMaior;
  const fonteDaSobra = fontes.find(fonte => capacidadeEmPassos(fonte.potenciaW, wattsPorPasso, FATOR_TOLERANCIA) >= passosRestantes);
  if (!fonteDaSobra || fontesPrincipais + 1 > MAX_FONTES_NO_PLANO) return null;

  const distribuicao = [
    ...Array.from({ length: fontesPrincipais }, () => ({ fonte: maiorFonte, passos: capacidadeIdealMaior })),
    { fonte: fonteDaSobra, passos: passosRestantes },
  ];
  const casas = casasDoPasso(passo);
  const itens: FonteDoPlano[] = distribuicao.map(({ fonte, passos }) => {
    const cargaW = arredondar(passos * wattsPorPasso, 2);
    const utilizacao = cargaW / fonte.potenciaW;
    return {
      fonte,
      quantidade: arredondar(passos * passo, casas),
      cargaW,
      utilizacao,
      faixa: utilizacao <= FATOR_RECOMENDADO + EPS ? "ideal" : "tolerancia",
    };
  });

  const fontesComCadastroComercial = itens.filter(item => item.fonte.mubisysMateriaPrimaId != null);
  const precosVendaDiretaPendentes = [...new Set(fontesComCadastroComercial
    .filter(item => item.fonte.vendaDireta !== true || !(Number(item.fonte.precoVendaDireta) > 0))
    .map(item => item.fonte.nome))];
  const valorVendaDiretaTotal = fontesComCadastroComercial.length > 0 && precosVendaDiretaPendentes.length === 0
    ? arredondar(fontesComCadastroComercial.reduce((total, item) => total + Number(item.fonte.precoVendaDireta), 0), 2)
    : null;
  const maiorUtilizacao = Math.max(...itens.map(item => item.utilizacao));
  return {
    fontes: itens,
    totalFontes: itens.length,
    potenciaInstaladaW: itens.reduce((soma, item) => soma + item.fonte.potenciaW, 0),
    maiorUtilizacao,
    faixa: maiorUtilizacao <= FATOR_RECOMENDADO + EPS ? "ideal" : "tolerancia",
    valorVendaDiretaTotal,
    precosVendaDiretaPendentes,
  };
}

export function dimensionarFontes(entrada: EntradaDimensionamento): ResultadoDimensionamento {
  const { fontes, wattsPorUnidade, passo, quantidade } = entrada;
  const entradaValida = Number.isFinite(quantidade) && quantidade > 0 && wattsPorUnidade > 0 && passo > 0 && fontes.length > 0;
  if (!entradaValida) {
    return { consumoTotalW: 0, recomendado: null, comFolga: null, aviso: "Informe uma quantidade maior que zero." };
  }
  const consumoTotalW = arredondar(quantidade * wattsPorUnidade, 2);
  const recomendado = montarPlano(entrada);
  if (!recomendado) {
    return {
      consumoTotalW,
      recomendado: null,
      comFolga: null,
      aviso: `Esta carga pede mais de ${MAX_FONTES_NO_PLANO} fontes. Divida o projeto em circuitos e dimensione cada um, ou consulte a engenharia.`,
    };
  }
  return { consumoTotalW, recomendado, comFolga: null, aviso: null };
}

/** Agrupa fontes iguais na ordem em que aparecem no plano. */
export function resumirPlano(plano: PlanoFontes): { nome: string; copias: number }[] {
  const grupos = new Map<string, { nome: string; copias: number }>();
  for (const { fonte } of plano.fontes) {
    const atual = grupos.get(fonte.nome);
    if (atual) atual.copias++;
    else grupos.set(fonte.nome, { nome: fonte.nome, copias: 1 });
  }
  return Array.from(grupos.values());
}
