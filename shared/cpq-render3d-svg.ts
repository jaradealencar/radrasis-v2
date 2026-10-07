/**
 * Inspeção de segurança/complexidade do SVG técnico antes do 3D. Só texto (sem DOM), então roda igual no servidor (resolver) e
 * no navegador (antes do SVGLoader). Não executa nem interpreta o conteúdo: apenas recusa o que nunca deveria estar ali.
 */

export const RENDER3D_SVG_MAX_BYTES = 1_500_000;
export const RENDER3D_SVG_MAX_PATHS = 500;
export const RENDER3D_SVG_MAX_TAGS = 6000;

export interface CpqRender3dSvgInspecao {
  ok: boolean;
  motivos: string[];
  /** `<path>` fora de `<defs>`, na ordem do documento — é o índice usado por `pathIndexes` da análise de cores. */
  pathCount: number;
  tagCount: number;
}

const PROIBIDOS: Array<[RegExp, string]> = [
  [/<\s*script\b/i, "contém <script>"],
  [/<\s*foreignObject\b/i, "contém <foreignObject>"],
  [/<\s*(iframe|object|embed)\b/i, "contém elemento de incorporação"],
  [/<\s*image\b/i, "contém imagem raster embutida ou externa"],
  [/<\s*use\b/i, "contém <use> (referência a outro elemento)"],
  [/<\s*style\b/i, "contém <style>"],
  // `animate\w*` pega animateTransform/animateMotion (o `\b` sozinho depois de "animate" não separava "animateTransform").
  [/<\s*(animate\w*|set)\b/i, "contém animação SVG"],
  // O separador antes do atributo pode ser espaço, "/" (`<svg/onload=…>`) ou aspas (atributos colados).
  [/[\s/"']on[a-z]+\s*=/i, "contém manipulador de evento (onclick etc.)"],
  [/javascript\s*:/i, "contém URL javascript:"],
  [/<!ENTITY/i, "declara entidades XML"],
  [/<!DOCTYPE[^>]*\[/i, "declara DOCTYPE com subconjunto interno"],
  [/(?:xlink:)?href\s*=\s*["'](?!#)/i, "referencia recurso externo (href)"],
  [/url\(\s*["']?(?!#)/i, "referencia recurso externo (url())"],
  [/@import/i, "contém @import"],
];

const INICIO_DEFS = /<\s*defs\b/gi;
const FIM_DEFS = /<\s*\/\s*defs\s*>/gi;

/**
 * Remove os blocos `<defs>…</defs>` (mesmo resultado de `replace(/<\s*defs\b[\s\S]*?<\s*\/\s*defs\s*>/gi, "")`), mas em tempo linear:
 * a regex preguiçosa original era quadrática com `<defs>` sem fechamento (0,7 MB travavam o servidor por ~15 s, achado de 07/10/2026).
 * `<defs>` sem fechamento não remove nada, como antes.
 */
function semDefs(svg: string): string {
  let resultado = "";
  let posicao = 0;
  for (;;) {
    INICIO_DEFS.lastIndex = posicao;
    const inicio = INICIO_DEFS.exec(svg);
    if (!inicio) break;
    FIM_DEFS.lastIndex = inicio.index + inicio[0].length;
    const fim = FIM_DEFS.exec(svg);
    if (!fim) break; // sem fechamento: nenhum `<defs>` posterior fecharia também
    resultado += svg.slice(posicao, inicio.index);
    posicao = fim.index + fim[0].length;
  }
  return resultado + svg.slice(posicao);
}

export function inspecionarSvgRender3d(svg: unknown): CpqRender3dSvgInspecao {
  const motivos: string[] = [];
  if (typeof svg !== "string" || !svg.trim()) return { ok: false, motivos: ["O SVG está vazio."], pathCount: 0, tagCount: 0 };
  // Recusa o grande demais ANTES de qualquer regex: o corpo JSON chega a 2 MB, acima do teto, e não vale gastar CPU com isso.
  if (svg.length > RENDER3D_SVG_MAX_BYTES)
    return { ok: false, motivos: [`O SVG passa de ${Math.round(RENDER3D_SVG_MAX_BYTES / 1000)} KB.`], pathCount: 0, tagCount: 0 };
  if (!/<\s*svg\b/i.test(svg)) motivos.push("O conteúdo não é um SVG.");
  for (const [regra, motivo] of PROIBIDOS) {
    if (regra.test(svg)) motivos.push(`O SVG ${motivo}.`);
  }
  const tagCount = (svg.match(/<\s*[a-zA-Z]/g) ?? []).length;
  if (tagCount > RENDER3D_SVG_MAX_TAGS) motivos.push(`O SVG tem elementos demais (${tagCount}).`);
  const pathCount = (semDefs(svg).match(/<\s*path\b/gi) ?? []).length;
  if (pathCount === 0) motivos.push("O SVG não tem caminhos (<path>).");
  if (pathCount > RENDER3D_SVG_MAX_PATHS) motivos.push(`O SVG tem caminhos demais (${pathCount}; máximo ${RENDER3D_SVG_MAX_PATHS}).`);
  return { ok: motivos.length === 0, motivos, pathCount, tagCount };
}
