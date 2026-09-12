/**
 * Perfil de clientes por CNPJ — agregação para ajudar a definir público-alvo.
 * Ver docs/inteligencia-clientes.md. Fonte: OpenCNPJ, um cliente de cada vez
 * (historico_os não guarda CNPJ — ver limitação documentada no schema,
 * tabela clientes_perfil_cnpj). Todo agregado aqui é sobre a AMOSTRA já
 * mapeada, nunca sobre a carteira inteira — a cobertura é sempre exposta.
 */

export interface ClientePerfilRow {
  empresaExibicao: string;
  idadeAnos: string | number | null; // decimal do banco vem como string
  porte: string | null;
  naturezaJuridica: string | null;
  qtdSocios: number | null;
  uf: string | null;
}

export interface FaixaContagem {
  chave: string;
  quantidade: number;
  pct: number;
}

export interface PerfilAgregadoClientes {
  totalClientesBase: number; // total de clientes distintos em historico_os
  totalMapeados: number; // quantos têm perfil de CNPJ vinculado
  coberturaPct: number;
  pctIdadeMaior3Anos: number | null; // entre os mapeados
  pctDoisOuMaisSocios: number | null; // entre os mapeados (exige QSA — nem todo perfil tem)
  distribuicaoPorte: FaixaContagem[];
  distribuicaoNaturezaJuridica: FaixaContagem[]; // top 8
  distribuicaoUf: FaixaContagem[]; // top 8
  distribuicaoIdade: FaixaContagem[]; // <1 ano / 1-3 anos / 3-10 anos / 10+ anos
}

function contarDistribuicao(valores: Array<string | null>, topN?: number): FaixaContagem[] {
  const total = valores.filter(v => v !== null).length;
  const contagem = new Map<string, number>();
  for (const v of valores) {
    if (v === null) continue;
    contagem.set(v, (contagem.get(v) ?? 0) + 1);
  }
  let entradas = [...contagem.entries()].map(([chave, quantidade]) => ({ chave, quantidade, pct: total > 0 ? (quantidade / total) * 100 : 0 }));
  entradas.sort((a, b) => b.quantidade - a.quantidade);
  if (topN) entradas = entradas.slice(0, topN);
  return entradas;
}

export function calcularPerfilAgregado(perfis: ClientePerfilRow[], totalClientesBase: number): PerfilAgregadoClientes {
  const totalMapeados = perfis.length;
  const comIdade = perfis.filter(p => p.idadeAnos !== null);
  const maior3Anos = comIdade.filter(p => Number(p.idadeAnos) >= 3).length;
  const comSocios = perfis.filter(p => p.qtdSocios !== null);
  const doisOuMaisSocios = comSocios.filter(p => (p.qtdSocios ?? 0) >= 2).length;

  const faixasIdade = [
    { chave: "menos de 1 ano", min: 0, max: 1 },
    { chave: "1 a 3 anos", min: 1, max: 3 },
    { chave: "3 a 10 anos", min: 3, max: 10 },
    { chave: "10+ anos", min: 10, max: Infinity },
  ];
  const distribuicaoIdade: FaixaContagem[] = faixasIdade.map(f => {
    const qtd = comIdade.filter(p => { const a = Number(p.idadeAnos); return a >= f.min && a < f.max; }).length;
    return { chave: f.chave, quantidade: qtd, pct: comIdade.length > 0 ? (qtd / comIdade.length) * 100 : 0 };
  });

  return {
    totalClientesBase,
    totalMapeados,
    coberturaPct: totalClientesBase > 0 ? (totalMapeados / totalClientesBase) * 100 : 0,
    pctIdadeMaior3Anos: comIdade.length > 0 ? (maior3Anos / comIdade.length) * 100 : null,
    pctDoisOuMaisSocios: comSocios.length > 0 ? (doisOuMaisSocios / comSocios.length) * 100 : null,
    distribuicaoPorte: contarDistribuicao(perfis.map(p => p.porte)),
    distribuicaoNaturezaJuridica: contarDistribuicao(perfis.map(p => p.naturezaJuridica), 8),
    distribuicaoUf: contarDistribuicao(perfis.map(p => p.uf), 8),
    distribuicaoIdade,
  };
}
