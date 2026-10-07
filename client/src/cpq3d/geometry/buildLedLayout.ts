/**
 * Posições determinísticas dos módulos LED (e dos fixadores) no interior do letreiro, em metros.
 * Sem aleatoriedade: a mesma entrada gera sempre os mesmos pontos (o hash do spec e os previews dependem disso).
 */
import { deslocarRegioes } from "./clipper";
import { areaDaRegiao, caixaDasRegioes, pontoInterior, pontoNaRegiao, type Regiao, type Vec } from "./geometryUtils";

export interface PontoLed extends Vec {
  /** Índice da região (ilha) a que o ponto pertence. */
  ilha: number;
}

export interface EntradaLeds {
  silhueta: readonly Regiao[];
  passoM: number | null;
  folgaBordaM: number;
  moduloLarguraM: number | null;
  moduloAlturaM: number | null;
  /** Quantidade física da composição; nula = distribuir pelo passo. */
  quantidade: number | null;
  maximo?: number;
}

export interface LayoutLeds {
  pontos: PontoLed[];
  avisos: string[];
}

const MAXIMO_PADRAO = 4000;

function grade(regioes: readonly Regiao[], passo: number): PontoLed[] {
  const pontos: PontoLed[] = [];
  regioes.forEach((regiao, ilha) => {
    const caixa = caixaDasRegioes([regiao]);
    if (!caixa) return;
    // Âncora na caixa da própria região, meio passo para dentro: simétrico e estável.
    for (let y = caixa.minY + passo / 2; y <= caixa.maxY; y += passo)
      for (let x = caixa.minX + passo / 2; x <= caixa.maxX; x += passo)
        if (pontoNaRegiao({ x, y }, regiao)) pontos.push({ x, y, ilha });
  });
  return pontos;
}

/** Escolhe exatamente `quantidade` pontos espalhados por igual na ordem determinística (ilha, y, x). */
function distribuir(candidatos: PontoLed[], quantidade: number): PontoLed[] {
  if (candidatos.length <= quantidade) return candidatos;
  return Array.from({ length: quantidade }, (_, k) => candidatos[Math.floor(((k + 0.5) * candidatos.length) / quantidade)]);
}

export function construirLayoutLeds(entrada: EntradaLeds): LayoutLeds {
  const avisos: string[] = [];
  const maximo = entrada.maximo ?? MAXIMO_PADRAO;
  const meioModulo = Math.max(entrada.moduloLarguraM ?? 0, entrada.moduloAlturaM ?? 0) / 2;
  const margem = entrada.folgaBordaM + meioModulo;
  const utilizavel = margem > 0 ? deslocarRegioes(entrada.silhueta, -margem) : [...entrada.silhueta];
  if (!utilizavel.length) {
    // Achado no teste real (07/10/2026): letras com haste mais fina que 2 × (folga + meio módulo) perdem todo o interior, e o letreiro
    // ficava apagado à noite. Mesmo fallback das hastes finas: um LED central ilustrativo por região, sempre com aviso.
    const centrais: PontoLed[] = [];
    entrada.silhueta.forEach((regiao, ilha) => {
      const meio = pontoInterior(regiao);
      if (meio) centrais.push({ ...meio, ilha });
    });
    return centrais.length
      ? { pontos: centrais, avisos: ["Elementos mais finos que a folga da borda somada à metade do módulo: um LED central por região (ilustrativo)."] }
      : { pontos: [], avisos: ["Nenhum LED coube: a folga da borda deixou a área útil vazia."] };
  }
  const area = utilizavel.reduce((total, regiao) => total + areaDaRegiao(regiao), 0);
  const quantidade = entrada.quantidade && entrada.quantidade > 0 ? Math.min(Math.round(entrada.quantidade), maximo) : null;
  const passoBase = entrada.passoM && entrada.passoM > 0 ? entrada.passoM : quantidade ? Math.sqrt(area / quantidade) : null;
  if (!passoBase || !(passoBase > 0)) return { pontos: [], avisos: ["Sem passo nem quantidade de LEDs: nada a distribuir."] };

  let pontos: PontoLed[] = [];
  if (quantidade) {
    // Refina a grade até haver candidatos suficientes; depois escolhe exatamente a quantidade da composição.
    for (const divisor of [1, 1.5, 2, 3, 4, 6]) {
      pontos = grade(utilizavel, passoBase / divisor);
      if (pontos.length >= quantidade) break;
    }
    if (pontos.length < quantidade)
      avisos.push(`Só ${pontos.length} dos ${quantidade} módulos LED couberam na área útil (formas finas).`);
    pontos = distribuir(pontos, quantidade);
  } else {
    pontos = grade(utilizavel, passoBase);
  }
  if (!pontos.length) {
    // Formas finas (hastes): um módulo ilustrativo no meio de cada região, para o desenho não ficar apagado.
    utilizavel.forEach((regiao, ilha) => {
      const meio = pontoInterior(regiao);
      if (meio) pontos.push({ ...meio, ilha });
    });
    if (pontos.length) avisos.push("Elementos finos demais para a grade: um LED central por região (ilustrativo).");
  }
  if (pontos.length > maximo) {
    avisos.push(`Há mais de ${maximo} LEDs; o 3D mostra uma amostra uniforme.`);
    pontos = distribuir(pontos, maximo);
  }
  return { pontos, avisos };
}

export interface PontoFixador extends Vec {
  ilha: number;
}

/** Âncoras de fixação: até 4 por região (cantos internos), 1 nas peças pequenas; sempre dentro da área recuada. */
export function construirLayoutFixadores(silhueta: readonly Regiao[], recuoM: number, maximo = 64): PontoFixador[] {
  const pontos: PontoFixador[] = [];
  const interior = recuoM > 0 ? deslocarRegioes(silhueta, -recuoM) : [...silhueta];
  interior.forEach((regiao, ilha) => {
    const caixa = caixaDasRegioes([regiao]);
    if (!caixa) return;
    const pequena = areaDaRegiao(regiao) < 0.0004; // < 4 cm²
    const sondas: Vec[] = pequena
      ? []
      : [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].map(([fx, fy]) => ({ x: caixa.minX + (caixa.maxX - caixa.minX) * fx, y: caixa.minY + (caixa.maxY - caixa.minY) * fy }));
    const validos = sondas.filter(sonda => pontoNaRegiao(sonda, regiao));
    if (!validos.length) {
      const meio = pontoInterior(regiao);
      if (meio) validos.push(meio);
    }
    for (const ponto of validos) pontos.push({ ...ponto, ilha });
  });
  return pontos.slice(0, maximo);
}
