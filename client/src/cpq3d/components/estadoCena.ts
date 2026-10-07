import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type MutableRefObject } from "react";

/** Valores 0..1 animados por frame (sem setState): dia→noite e montada→explodida. */
export interface EstadoCena {
  noite: number;
  explodido: number;
}

/**
 * Anima `noite` e `explodido` em direção ao alvo com amortecimento exponencial, dentro do `useFrame`. Com `imediato` (captura de
 * preview) os valores já nascem no alvo. Pede novo frame enquanto não chegou (o canvas usa `frameloop="demand"`).
 */
export function useEstadoCena(night: boolean, exploded: boolean, imediato = false): MutableRefObject<EstadoCena> {
  const estado = useRef<EstadoCena>({ noite: night ? 1 : 0, explodido: exploded ? 1 : 0 });
  const invalidate = useThree(estadoR3f => estadoR3f.invalidate);
  useEffect(() => {
    if (imediato) estado.current = { noite: night ? 1 : 0, explodido: exploded ? 1 : 0 };
    invalidate();
  }, [night, exploded, imediato, invalidate]);
  useFrame((_, delta) => {
    const alvoNoite = night ? 1 : 0, alvoExplodido = exploded ? 1 : 0;
    const atual = estado.current;
    if (Math.abs(atual.noite - alvoNoite) < 0.002 && Math.abs(atual.explodido - alvoExplodido) < 0.002) {
      atual.noite = alvoNoite;
      atual.explodido = alvoExplodido;
      return;
    }
    const fator = imediato ? 1 : 1 - Math.exp(-6 * Math.min(delta, 0.1));
    atual.noite += (alvoNoite - atual.noite) * fator;
    atual.explodido += (alvoExplodido - atual.explodido) * fator;
    invalidate();
  });
  return estado;
}

export const interpolar = (a: number, b: number, t: number): number => a + (b - a) * t;
