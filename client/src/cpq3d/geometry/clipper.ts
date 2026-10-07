/**
 * Offsets e operações booleanas de regiões 2D com clipper-lib (inteiros em micrômetros: o mundo do 3D está em metros).
 * É daqui que saem a parede oca (retorno), o fundo recuado, a faixa útil dos LEDs e o halo do backlight.
 */
import * as ClipperNs from "clipper-lib";
import { normalizarRegiao, type Regiao, type Vec } from "./geometryUtils";

// clipper-lib é CommonJS: conforme o empacotador (Vite/Rollup/Node), o objeto vem em `default` ou no próprio namespace.
const ClipperLib = ((ClipperNs as unknown as { default?: typeof ClipperNs }).default ?? ClipperNs) as typeof ClipperNs;

/** 1 metro = 1_000_000 unidades inteiras (1 µm). */
const ESCALA = 1_000_000;

function paraCaminho(anel: readonly Vec[]): ClipperNs.Path {
  return anel.map(ponto => ({ X: Math.round(ponto.x * ESCALA), Y: Math.round(ponto.y * ESCALA) }));
}

function deCaminho(caminho: ClipperNs.Path): Vec[] {
  return caminho.map(ponto => ({ x: ponto.X / ESCALA, y: ponto.Y / ESCALA }));
}

/** Regiões normalizadas (externo anti-horário, vazados horários) -> caminhos para o Clipper. */
function caminhosDe(regioes: readonly Regiao[]): ClipperNs.Paths {
  const caminhos: ClipperNs.Paths = [];
  for (const regiao of regioes) {
    const normal = normalizarRegiao(regiao);
    if (!normal) continue;
    caminhos.push(paraCaminho(normal.outer));
    for (const anel of normal.holes) caminhos.push(paraCaminho(anel));
  }
  return caminhos;
}

/** PolyTree do Clipper -> regiões (externo + vazados; ilhas dentro de vazados viram novas regiões). */
function regioesDaArvore(arvore: ClipperNs.PolyTree): Regiao[] {
  const regioes: Regiao[] = [];
  const visitar = (no: ClipperNs.PolyNode) => {
    for (const filho of no.Childs()) {
      if (filho.IsHole()) { visitar(filho); continue; }
      const holes = filho.Childs().filter(neto => neto.IsHole()).map(neto => deCaminho(neto.Contour()));
      const normal = normalizarRegiao({ outer: deCaminho(filho.Contour()), holes });
      if (normal) regioes.push(normal);
      // ilhas dentro dos vazados
      for (const neto of filho.Childs()) visitar(neto);
    }
  };
  visitar(arvore);
  return regioes;
}

export type JuncaoOffset = "round" | "miter";

/**
 * Desloca o contorno de cada região. `delta` em metros: positivo expande, negativo encolhe (e faz os vazados crescerem).
 * Resultado vazio = a região some (mais fina que 2×|delta|).
 */
export function deslocarRegioes(regioes: readonly Regiao[], delta: number, juncao: JuncaoOffset = "round"): Regiao[] {
  const caminhos = caminhosDe(regioes);
  if (!caminhos.length) return [];
  if (Math.abs(delta) < 1 / ESCALA) return regioes.flatMap(regiao => (normalizarRegiao(regiao) ? [normalizarRegiao(regiao)!] : []));
  // Tolerância de arco de 0,05 mm: o suficiente para o desenho, sem explodir o número de pontos.
  const co = new ClipperLib.ClipperOffset(2, 0.05 * 0.001 * ESCALA);
  co.AddPaths(caminhos, juncao === "round" ? ClipperLib.JoinType.jtRound : ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const arvore = new ClipperLib.PolyTree();
  co.Execute(arvore, delta * ESCALA);
  return regioesDaArvore(arvore);
}

function operar(tipo: ClipperNs.ClipType, sujeito: readonly Regiao[], recorte: readonly Regiao[]): Regiao[] {
  const cpr = new ClipperLib.Clipper();
  cpr.AddPaths(caminhosDe(sujeito), ClipperLib.PolyType.ptSubject, true);
  if (recorte.length) cpr.AddPaths(caminhosDe(recorte), ClipperLib.PolyType.ptClip, true);
  const arvore = new ClipperLib.PolyTree();
  cpr.Execute(tipo, arvore, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return regioesDaArvore(arvore);
}

/** `sujeito - recorte`. */
export function diferencaDeRegioes(sujeito: readonly Regiao[], recorte: readonly Regiao[]): Regiao[] {
  return operar(ClipperLib.ClipType.ctDifference, sujeito, recorte);
}

export function uniaoDeRegioes(regioes: readonly Regiao[]): Regiao[] {
  return operar(ClipperLib.ClipType.ctUnion, regioes, []);
}
