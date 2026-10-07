import type { Cpq3dLegacyBridge, CpqRender3dSnapshot } from "@shared/cpq-render3d";

/** Linha da composição do orçamento (REAL.kit), como a ilha precisa para confirmar o papel 3D. */
export interface LinhaKit3d {
  index: number;
  matId: number | null;
  nome: string;
  papel: string;
  renderRole: string | null;
}

/** Ponte entre o HTML legado do CPQ e a ilha React. O HTML a instala em `window.CPQ3D_BRIDGE`. */
export interface Cpq3dBridgeCompleta extends Cpq3dLegacyBridge {
  getLinhasKit(): LinhaKit3d[];
  /** Guarda a aprovação e o bloco `render3d` do snapshot; libera o passo seguinte. */
  setApproval(approval: import("@shared/cpq-render3d").CpqRender3dApproval | null, render3d?: CpqRender3dSnapshot | null): void;
  /** Produto sem construção 3D cadastrada: o 3D não se aplica e o orçamento segue sem ele. */
  dispensar(): void;
  isDispensado(): boolean;
}

export interface Cpq3dIlha {
  /** Procura os pontos de montagem no DOM do legado e (re)posiciona os hosts persistentes. Chamado após cada render do legado. */
  sync(): void;
  sugerirRenderRole: typeof import("@shared/cpq-render3d").sugerirRenderRole;
  versao: string;
}

declare global {
  interface Window {
    CPQ3D_BRIDGE?: Cpq3dBridgeCompleta;
    CPQ3DIsland?: Cpq3dIlha;
  }
}

export function obterBridge(): Cpq3dBridgeCompleta | null {
  return typeof window !== "undefined" ? window.CPQ3D_BRIDGE ?? null : null;
}

/* Pequeno armazenamento de versão: o legado avisa (via sync) quando algo mudou e os componentes releem a ponte. */
const ouvintes = new Set<() => void>();
let versao = 0;

export function notificarMudancaDoLegado(): void {
  versao += 1;
  ouvintes.forEach(ouvinte => ouvinte());
}

export const assinarMudancas = (ouvinte: () => void) => {
  ouvintes.add(ouvinte);
  return () => { ouvintes.delete(ouvinte); };
};

export const versaoAtual = () => versao;
