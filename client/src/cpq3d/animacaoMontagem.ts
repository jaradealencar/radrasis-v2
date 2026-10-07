/**
 * Linha do tempo da animação de montagem do letreiro: as peças começam afastadas (visão explodida) e se encaixam de trás para a
 * frente — fixadores, fundo, LEDs, retorno/perfil e, por último, a face —, com a câmera girando para o ponto de vista de
 * apresentação; em construção iluminada, o letreiro acende no final.
 *
 * É uma função pura do tempo (segundos): o mesmo `t` gera sempre o mesmo quadro. Isso serve ao player ao vivo (o tempo avança por
 * frame) e à exportação em GIF (o tempo avança por passos fixos, sem depender da velocidade do computador).
 */

export const PARTES_MONTAGEM = ["fixadores", "fundo", "leds", "retorno", "face"] as const;
export type ParteMontagem = (typeof PARTES_MONTAGEM)[number];

/** Progresso de afastamento de cada peça: 1 = totalmente afastada (explodida), 0 = encaixada. */
export type ProgressoPartes = Record<ParteMontagem, number>;

export interface QuadroMontagem {
  partes: ProgressoPartes;
  /** 0 = dia, 1 = noite (letreiro aceso). */
  noite: number;
  /** Ponto de vista da câmera (radianos), no mesmo formato de `PoseCamera`. */
  azimute: number;
  elevacao: number;
}

/** Pose da câmera no começo (peças abertas) e no fim (peças encaixadas) da montagem. */
export const POSE_INICIAL_MONTAGEM = { azimute: 0.62, elevacao: 0.21 } as const;
export const POSE_FINAL_MONTAGEM = { azimute: 0.3, elevacao: 0.17 } as const;

const ABERTO_ANTES_S = 0.9;
const DURACAO_PECA_S = 1.25;
const INTERVALO_ENTRE_PECAS_S = 0.9;
const ASSENTADO_DEPOIS_S = 0.6;
const ACENDER_S = 1.1;
const ACESO_DEPOIS_S = 1.6;

/** Ordem de chegada: do fundo do conjunto (junto da parede) para a frente. */
const ORDEM_DE_ENCAIXE: readonly ParteMontagem[] = ["fixadores", "fundo", "leds", "retorno", "face"];

const limitar = (valor: number, minimo = 0, maximo = 1) => Math.min(maximo, Math.max(minimo, valor));
export const suavizar = (x: number): number => {
  const t = limitar(x);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; // ease in-out cúbico
};

function inicioDaPeca(parte: ParteMontagem): number {
  return ABERTO_ANTES_S + ORDEM_DE_ENCAIXE.indexOf(parte) * INTERVALO_ENTRE_PECAS_S;
}

/** Instante em que a última peça termina de encaixar. */
export const FIM_DO_ENCAIXE_S = inicioDaPeca("face") + DURACAO_PECA_S;

/** Duração total: com iluminação, inclui o acendimento e uma pausa com o letreiro aceso. */
export function duracaoDaAnimacao(iluminada: boolean): number {
  return FIM_DO_ENCAIXE_S + ASSENTADO_DEPOIS_S + (iluminada ? ACENDER_S + ACESO_DEPOIS_S : 0.9);
}

export function quadroDaMontagem(t: number, iluminada: boolean): QuadroMontagem {
  const partes = {} as ProgressoPartes;
  for (const parte of PARTES_MONTAGEM) partes[parte] = 1 - suavizar((t - inicioDaPeca(parte)) / DURACAO_PECA_S);

  const inicioAcender = FIM_DO_ENCAIXE_S + ASSENTADO_DEPOIS_S;
  const noite = iluminada ? suavizar((t - inicioAcender) / ACENDER_S) : 0;

  // A câmera gira durante todo o encaixe, mais devagar no começo e no fim.
  const giro = suavizar((t - ABERTO_ANTES_S * 0.5) / (FIM_DO_ENCAIXE_S - ABERTO_ANTES_S * 0.5));
  const azimute = POSE_INICIAL_MONTAGEM.azimute + (POSE_FINAL_MONTAGEM.azimute - POSE_INICIAL_MONTAGEM.azimute) * giro;
  const elevacao = POSE_INICIAL_MONTAGEM.elevacao + (POSE_FINAL_MONTAGEM.elevacao - POSE_INICIAL_MONTAGEM.elevacao) * giro;
  return { partes, noite, azimute, elevacao };
}

/** Afastamento "geral" do quadro (a peça mais afastada): leva a parede a sumir e o enquadramento da câmera a se ajustar. */
export function afastamentoGeral(partes: ProgressoPartes): number {
  return Math.max(...PARTES_MONTAGEM.map(parte => partes[parte]));
}

/** Estado do player: o tempo é dado por quem controla (relógio do viewer ou passos fixos da exportação). */
export interface ControleAnimacao {
  ativa: boolean;
  /** Segundos desde o início da animação. */
  t: number;
  /** Verdadeiro = o tempo avança a cada frame (player ao vivo); falso = quem exporta define `t` a cada passo. */
  avanca: boolean;
  /** Chamado uma vez, quando o player ao vivo chega ao fim. */
  aoTerminar?: () => void;
}

export const novoControleAnimacao = (): ControleAnimacao => ({ ativa: false, t: 0, avanca: true });
