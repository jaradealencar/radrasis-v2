/**
 * Dimensionamento de fontes chaveadas para LED (Tabela de Preços > Pág. 4).
 *
 * Regra comercial: a fonte trabalha com 85% da potência (margem de venda). Se a carga passar um pouco disso, até 93%,
 * ainda cabe na mesma fonte e NÃO se sugere outra; acima de 93% entra uma fonte maior ou mais uma fonte. Quando o plano
 * recomendado usa a faixa entre 85% e 93%, o cálculo também devolve a opção que mantém tudo dentro dos 85%.
 *
 * Escolha do plano: menos fontes; depois menor potência instalada; depois a maior fonte do plano é a menor (carga mais
 * repartida). A carga é repartida entre as fontes na proporção da capacidade de cada uma.
 */

export const FATOR_RECOMENDADO = 0.85;
export const FATOR_TOLERANCIA = 0.93;
/** Acima disso a calculadora não decide: o projeto precisa ser dividido em circuitos pela engenharia. */
export const MAX_FONTES_NO_PLANO = 10;

export interface FonteDisponivel {
  nome: string;
  potenciaW: number;
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
}

export interface ResultadoDimensionamento {
  consumoTotalW: number;
  /** Plano recomendado (até 93% por fonte). */
  recomendado: PlanoFontes | null;
  /** Só existe se o recomendado passa de 85% e há um plano que fica em até 85%. */
  comFolga: PlanoFontes | null;
  /** Por que não há plano (quantidade inválida ou grande demais). */
  aviso: string | null;
}

/** Evita que ruído de ponto flutuante (0,1 × 17 = 1,7000000000000002) vire um passo a mais ou a menos. */
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

interface Candidato {
  contagens: number[];
  total: number;
  potencia: number;
  maior: number;
}

function melhorQue(candidato: Candidato, atual: Candidato | null): boolean {
  if (!atual) return true;
  if (candidato.total !== atual.total) return candidato.total < atual.total;
  if (candidato.potencia !== atual.potencia) return candidato.potencia < atual.potencia;
  return candidato.maior < atual.maior;
}

/** Cópias de cada fonte (na ordem de `fontes`) que cobrem `passosTotais`, ou `null` se passar do limite de fontes. */
function melhorCombinacao(
  fontes: readonly FonteDisponivel[],
  capacidades: readonly number[],
  passosTotais: number
): number[] | null {
  const estado: { melhor: Candidato | null } = { melhor: null };
  const contagens = new Array<number>(fontes.length).fill(0);

  const percorrer = (indice: number, restante: number, usadas: number) => {
    if (restante <= 0) {
      const instaladas = contagens.map((copias, i) => ({ copias, potenciaW: fontes[i].potenciaW }));
      const candidato: Candidato = {
        contagens: [...contagens],
        total: usadas,
        potencia: instaladas.reduce((soma, item) => soma + item.copias * item.potenciaW, 0),
        maior: Math.max(0, ...instaladas.filter(item => item.copias > 0).map(item => item.potenciaW)),
      };
      if (melhorQue(candidato, estado.melhor)) estado.melhor = candidato;
      return;
    }
    if (indice >= fontes.length) return;
    for (let copias = 0; copias <= MAX_FONTES_NO_PLANO - usadas; copias++) {
      contagens[indice] = copias;
      percorrer(indice + 1, restante - copias * capacidades[indice], usadas + copias);
      // Esta fonte já cobre o que falta: mais cópias dela só pioram o plano.
      if (copias * capacidades[indice] >= restante) break;
    }
    contagens[indice] = 0;
  };

  percorrer(0, passosTotais, 0);
  return estado.melhor ? estado.melhor.contagens : null;
}

/** Reparte os passos entre as fontes na proporção da capacidade de cada uma (maiores restos), sem estourar nenhuma. */
function repartir(capacidades: readonly number[], passosTotais: number): number[] {
  const somaCapacidades = capacidades.reduce((a, b) => a + b, 0);
  const brutos = capacidades.map(capacidade => (passosTotais * capacidade) / somaCapacidades);
  const base = brutos.map(Math.floor);
  let faltam = passosTotais - base.reduce((a, b) => a + b, 0);
  const porResto = brutos
    .map((valor, i) => ({ i, resto: valor - Math.floor(valor) }))
    .sort((a, b) => b.resto - a.resto || capacidades[b.i] - capacidades[a.i]);
  for (const { i } of porResto) {
    if (faltam <= 0) break;
    if (base[i] < capacidades[i]) {
      base[i]++;
      faltam--;
    }
  }
  return base;
}

function montarPlano(entrada: EntradaDimensionamento, fator: number): PlanoFontes | null {
  const { wattsPorUnidade, passo, quantidade } = entrada;
  const wattsPorPasso = arredondar(wattsPorUnidade * passo, 6);
  const passosTotais = Math.ceil(quantidade / passo - EPS);
  // Fonte que não aguenta nem um passo de LED não entra na conta.
  const fontes = entrada.fontes
    .filter(fonte => capacidadeEmPassos(fonte.potenciaW, wattsPorPasso, fator) >= 1)
    .sort((a, b) => a.potenciaW - b.potenciaW);
  const capacidades = fontes.map(fonte => capacidadeEmPassos(fonte.potenciaW, wattsPorPasso, fator));
  const contagens = melhorCombinacao(fontes, capacidades, passosTotais);
  if (!contagens) return null;

  // Uma entrada por fonte física, da menor para a maior.
  const fisicas = contagens.flatMap((copias, i) => Array.from({ length: copias }, () => i));
  const passosPorFonte = repartir(fisicas.map(i => capacidades[i]), passosTotais);
  const casas = casasDoPasso(passo);

  const itens: FonteDoPlano[] = fisicas.map((i, posicao) => {
    const fonte = fontes[i];
    const cargaW = arredondar(passosPorFonte[posicao] * wattsPorPasso, 2);
    const utilizacao = cargaW / fonte.potenciaW;
    return {
      fonte,
      quantidade: arredondar(passosPorFonte[posicao] * passo, casas),
      cargaW,
      utilizacao,
      faixa: utilizacao <= FATOR_RECOMENDADO + EPS ? "ideal" : "tolerancia",
    };
  });
  const maiorUtilizacao = Math.max(...itens.map(item => item.utilizacao));
  return {
    fontes: itens,
    totalFontes: itens.length,
    potenciaInstaladaW: itens.reduce((soma, item) => soma + item.fonte.potenciaW, 0),
    maiorUtilizacao,
    faixa: maiorUtilizacao <= FATOR_RECOMENDADO + EPS ? "ideal" : "tolerancia",
  };
}

export function dimensionarFontes(entrada: EntradaDimensionamento): ResultadoDimensionamento {
  const { fontes, wattsPorUnidade, passo, quantidade } = entrada;
  const entradaValida = Number.isFinite(quantidade) && quantidade > 0 && wattsPorUnidade > 0 && passo > 0 && fontes.length > 0;
  if (!entradaValida) {
    return { consumoTotalW: 0, recomendado: null, comFolga: null, aviso: "Informe uma quantidade maior que zero." };
  }
  const consumoTotalW = arredondar(quantidade * wattsPorUnidade, 2);

  const recomendado = montarPlano(entrada, FATOR_TOLERANCIA);
  if (!recomendado) {
    return {
      consumoTotalW,
      recomendado: null,
      comFolga: null,
      aviso: `Esta carga pede mais de ${MAX_FONTES_NO_PLANO} fontes. Divida o projeto em circuitos e dimensione cada um, ou consulte a engenharia.`,
    };
  }
  const comFolga = recomendado.faixa === "tolerancia" ? montarPlano(entrada, FATOR_RECOMENDADO) : null;
  return { consumoTotalW, recomendado, comFolga, aviso: null };
}

/** "2 × Fonte 20A" a partir do plano (agrupa fontes iguais, da menor para a maior). */
export function resumirPlano(plano: PlanoFontes): { nome: string; copias: number }[] {
  const grupos = new Map<string, { nome: string; copias: number }>();
  for (const { fonte } of plano.fontes) {
    const atual = grupos.get(fonte.nome);
    if (atual) atual.copias++;
    else grupos.set(fonte.nome, { nome: fonte.nome, copias: 1 });
  }
  return Array.from(grupos.values());
}
