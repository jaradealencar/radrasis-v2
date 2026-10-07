import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type MutableRefObject } from "react";
import { afastamentoGeral, duracaoDaAnimacao, quadroDaMontagem, type ControleAnimacao, type ParteMontagem, type ProgressoPartes } from "../animacaoMontagem";

/** Valores 0..1 animados por frame (sem setState): dia→noite e montada→explodida. */
export interface EstadoCena {
  noite: number;
  explodido: number;
  /** Só durante a animação de montagem: afastamento de cada peça (0 = encaixada). `null` = todas seguem `explodido`. */
  partes: ProgressoPartes | null;
  /** Só durante a animação de montagem: ponto de vista da câmera. */
  camera: { azimute: number; elevacao: number } | null;
}

/** Afastamento atual de uma peça: o dela na animação de montagem, ou o geral da visão explodida. */
export const afastamentoDaParte = (estado: EstadoCena, parte: ParteMontagem): number => estado.partes?.[parte] ?? estado.explodido;

/**
 * Anima `noite` e `explodido` em direção ao alvo com amortecimento exponencial, dentro do `useFrame`. Com `imediato` (captura de
 * preview) os valores já nascem no alvo. Pede novo frame enquanto não chegou (o canvas usa `frameloop="demand"`).
 *
 * Com a animação de montagem ativa (`animacao.current.ativa`), os valores vêm da linha do tempo (`quadroDaMontagem`) e substituem
 * os alvos dos botões. O callback roda com prioridade negativa para atualizar o estado ANTES de as peças lerem o valor no mesmo frame.
 */
export function useEstadoCena(night: boolean, exploded: boolean, imediato = false, animacao?: MutableRefObject<ControleAnimacao>, iluminada = false): MutableRefObject<EstadoCena> {
  const estado = useRef<EstadoCena>({ noite: night ? 1 : 0, explodido: exploded ? 1 : 0, partes: null, camera: null });
  const invalidate = useThree(estadoR3f => estadoR3f.invalidate);
  useEffect(() => {
    if (imediato) estado.current = { noite: night ? 1 : 0, explodido: exploded ? 1 : 0, partes: null, camera: null };
    invalidate();
  }, [night, exploded, imediato, invalidate]);
  useFrame((_, delta) => {
    const atual = estado.current;
    const controle = animacao?.current;
    if (controle?.ativa) {
      const duracao = duracaoDaAnimacao(iluminada);
      if (controle.avanca && controle.t < duracao) controle.t = Math.min(duracao, controle.t + Math.min(delta, 0.1));
      const quadro = quadroDaMontagem(controle.t, iluminada);
      atual.partes = quadro.partes;
      atual.noite = quadro.noite;
      atual.explodido = afastamentoGeral(quadro.partes);
      atual.camera = { azimute: quadro.azimute, elevacao: quadro.elevacao };
      if (controle.avanca && controle.t >= duracao) {
        controle.avanca = false; // congela no último quadro até quem controla o player encerrar a animação
        controle.aoTerminar?.();
      }
      invalidate();
      return;
    }
    atual.partes = null;
    atual.camera = null;
    const alvoNoite = night ? 1 : 0, alvoExplodido = exploded ? 1 : 0;
    if (Math.abs(atual.noite - alvoNoite) < 0.002 && Math.abs(atual.explodido - alvoExplodido) < 0.002) {
      atual.noite = alvoNoite;
      atual.explodido = alvoExplodido;
      return;
    }
    const fator = imediato ? 1 : 1 - Math.exp(-6 * Math.min(delta, 0.1));
    atual.noite += (alvoNoite - atual.noite) * fator;
    atual.explodido += (alvoExplodido - atual.explodido) * fator;
    invalidate();
  }, -10);
  return estado;
}

export const interpolar = (a: number, b: number, t: number): number => a + (b - a) * t;
