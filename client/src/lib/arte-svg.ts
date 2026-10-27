import { SVGPathData } from "svg-pathdata";

const NS = "http://www.w3.org/2000/svg";

function lerSvg(texto: string): SVGSVGElement {
  if (texto.length > 1_500_000 || /<!doctype|<!entity/i.test(texto))
    throw new Error("Envie um SVG de até 1,5 MB, sem entidades externas.");
  const doc = new DOMParser().parseFromString(texto, "image/svg+xml");
  if (
    doc.querySelector("parsererror") ||
    doc.documentElement.localName !== "svg"
  )
    throw new Error("O arquivo não é um SVG válido.");
  return doc.documentElement as unknown as SVGSVGElement;
}

export function dimensoesArteSvg(texto: string): {
  x: number;
  y: number;
  largura: number;
  altura: number;
} {
  const svg = lerSvg(texto);
  const vb = svg
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const dimensao = (valor: string | null) => {
    const match = valor?.trim().match(/^([\d.]+)\s*(px|mm|cm|in|pt)?$/);
    if (!match) return Number.NaN;
    const fatores: Record<string, number> = {
      px: 1,
      mm: 96 / 25.4,
      cm: 96 / 2.54,
      in: 96,
      pt: 96 / 72,
    };
    return Number(match[1]) * (fatores[match[2] || "px"] ?? 1);
  };
  const [x, y, largura, altura] =
    vb?.length === 4
      ? vb
      : [
          0,
          0,
          dimensao(svg.getAttribute("width")),
          dimensao(svg.getAttribute("height")),
        ];
  if (
    ![x, y, largura, altura].every(Number.isFinite) ||
    largura <= 0 ||
    altura <= 0 ||
    Math.max(largura, altura) > 1_000_000
  )
    throw new Error("O SVG precisa ter um viewBox ou dimensões válidas.");
  return { x, y, largura, altura };
}

/** Reconstrói somente formas permitidas e achata transforms antes de enviar à geometria do servidor. */
export function normalizarSvgArte(texto: string): string {
  const fonte = lerSvg(texto);
  if (fonte.querySelector("style"))
    throw new Error(
      "Converta os estilos CSS do SVG em atributos dos caminhos antes do nesting."
    );
  const vb = dimensoesArteSvg(texto);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.largura} ${vb.altura}`);
  svg.setAttribute("width", String(vb.largura));
  svg.setAttribute("height", String(vb.altura));
  svg.style.cssText = `position:fixed;left:-2000000px;top:0;visibility:hidden;width:${vb.largura}px;height:${vb.altura}px;max-width:none;`;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const contexto = canvas.getContext("2d", { willReadFrequently: true });
  if (!contexto) throw new Error("Não foi possível ler as cores no navegador.");
  const caminhos: SVGPathElement[] = [];
  const clonar = (
    origem: Element,
    destino: Element,
    herdado: { fill: string; stroke: string; rule: string; color: string }
  ) => {
    const tag = origem.localName.toLowerCase();
    if (["defs", "title", "desc", "metadata"].includes(tag)) return;
    if (
      ![
        "svg",
        "g",
        "path",
        "rect",
        "circle",
        "ellipse",
        "polygon",
        "polyline",
      ].includes(tag) ||
      (tag === "svg" && origem !== fonte)
    )
      throw new Error(
        `Converta <${tag}> em caminhos antes do nesting. Imagens, texto, máscaras e recortes não são peças de corte.`
      );
    const estilo = (origem as SVGElement).style;
    if (estilo.transform)
      throw new Error(
        "Converta as transformações CSS do SVG em caminhos antes do nesting."
      );
    if (
      estilo.display === "none" ||
      origem.getAttribute("display") === "none" ||
      estilo.visibility === "hidden" ||
      origem.getAttribute("visibility") === "hidden" ||
      (estilo.opacity || origem.getAttribute("opacity")) === "0"
    )
      return;
    if (
      ["clip-path", "mask", "filter"].some(
        attr => origem.hasAttribute(attr) || estilo.getPropertyValue(attr)
      )
    )
      throw new Error(
        "Aplique máscaras, filtros e recortes aos caminhos antes do nesting."
      );
    const atual = {
      fill: estilo.fill || origem.getAttribute("fill") || herdado.fill,
      stroke: estilo.stroke || origem.getAttribute("stroke") || herdado.stroke,
      rule: estilo.fillRule || origem.getAttribute("fill-rule") || herdado.rule,
      color: estilo.color || origem.getAttribute("color") || herdado.color,
    };
    for (const chave of ["fill", "stroke", "rule", "color"] as const)
      if (atual[chave] === "inherit" || atual[chave] === "unset")
        atual[chave] = herdado[chave];
    const opacidade = Number(
      estilo.opacity || origem.getAttribute("opacity") || 1
    );
    const opacidadeCor = Number(
      estilo.fillOpacity || origem.getAttribute("fill-opacity") || 1
    );
    if (
      (opacidade > 0 && opacidade < 1) ||
      (opacidadeCor > 0 && opacidadeCor < 1)
    )
      throw new Error(
        "Aplique transparências e use cores opacas nos caminhos antes do nesting."
      );
    const grupo = document.createElementNS(NS, "g");
    const transform = origem.getAttribute("transform");
    if (transform) {
      if (
        !/^[\s\d.,eE+()\-a-zA-Z]+$/.test(transform) ||
        /[^\s\d.,eE+()\-]/.test(
          transform.replace(/matrix|translate|scale|rotate|skewX|skewY/g, "")
        )
      )
        throw new Error("O SVG tem uma transformação inválida.");
      grupo.setAttribute("transform", transform);
    }
    destino.append(grupo);
    if (tag === "g" || tag === "svg") {
      for (const filho of origem.children) clonar(filho, grupo, atual);
      return;
    }
    if (
      atual.fill === "none" ||
      (estilo.fillOpacity || origem.getAttribute("fill-opacity")) === "0"
    ) {
      if (atual.stroke !== "none")
        throw new Error(
          "Transforme os traços sem preenchimento em contornos fechados antes do nesting."
        );
      return;
    }
    if (
      atual.stroke !== "none" &&
      parseFloat(
        estilo.strokeWidth || origem.getAttribute("stroke-width") || "1"
      ) !== 0
    )
      throw new Error(
        "Converta os traços em contornos antes do nesting para preservar suas medidas."
      );
    const cor = atual.fill === "currentColor" ? atual.color : atual.fill;
    if (!CSS.supports("color", cor) || /url\(|var\(/i.test(cor))
      throw new Error(
        "Substitua degradês e referências de cor por cores chapadas antes do nesting."
      );
    contexto.clearRect(0, 0, 1, 1);
    contexto.fillStyle = cor;
    contexto.fillRect(0, 0, 1, 1);
    const rgba = contexto.getImageData(0, 0, 1, 1).data;
    if (rgba[3] === 0) return;
    if (rgba[3] !== 255)
      throw new Error(
        "Use cores opacas e chapadas para separar as peças do nesting."
      );
    const hex =
      "#" +
      [...rgba]
        .slice(0, 3)
        .map(valor => valor.toString(16).padStart(2, "0"))
        .join("");
    const n = (attr: string, padrao = 0) => {
      const raw = origem.getAttribute(attr);
      const valor = raw == null ? padrao : Number(raw);
      if (!Number.isFinite(valor))
        throw new Error(
          `A medida ${attr} do SVG precisa estar em unidades numéricas.`
        );
      return valor;
    };
    let d = origem.getAttribute("d") || "";
    if (tag === "rect") {
      const x = n("x"),
        y = n("y"),
        w = n("width"),
        h = n("height");
      if (!(w > 0 && h > 0)) return;
      const rx = Math.max(0, Math.min(w / 2, n("rx", n("ry"))));
      const ry = Math.max(0, Math.min(h / 2, n("ry", rx)));
      d =
        rx && ry
          ? `M${x + rx} ${y} H${x + w - rx} A${rx} ${ry} 0 0 1 ${x + w} ${y + ry} V${y + h - ry} A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h} H${x + rx} A${rx} ${ry} 0 0 1 ${x} ${y + h - ry} V${y + ry} A${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`
          : `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
    } else if (tag === "circle" || tag === "ellipse") {
      const x = n("cx"),
        y = n("cy"),
        rx = n(tag === "circle" ? "r" : "rx"),
        ry = tag === "circle" ? rx : n("ry");
      if (!(rx > 0 && ry > 0)) return;
      d = `M${x - rx} ${y} A${rx} ${ry} 0 1 0 ${x + rx} ${y} A${rx} ${ry} 0 1 0 ${x - rx} ${y} Z`;
    } else if (tag === "polygon" || tag === "polyline") {
      const pontos = (origem.getAttribute("points") || "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (
        pontos.length < 6 ||
        pontos.length % 2 ||
        !pontos.every(Number.isFinite)
      )
        throw new Error("Há um polígono inválido no SVG.");
      d =
        `M${pontos[0]} ${pontos[1]} ` +
        pontos
          .slice(2)
          .reduce(
            (acc, valor, i) => acc + (i % 2 ? `${valor} ` : `L${valor} `),
            ""
          ) +
        "Z";
    }
    if (!d || d.length > 250_000)
      throw new Error("Há um caminho vazio ou complexo demais no SVG.");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", hex);
    path.setAttribute(
      "fill-rule",
      atual.rule === "evenodd" ? "evenodd" : "nonzero"
    );
    grupo.append(path);
    caminhos.push(path);
  };
  try {
    clonar(fonte, svg, {
      fill: "#000000",
      stroke: "none",
      rule: "nonzero",
      color: "#000000",
    });
    if (!caminhos.length || caminhos.length > 500)
      throw new Error("O nesting aceita entre 1 e 500 caminhos preenchidos.");
    document.body.append(svg);
    const resultado = document.createElementNS(NS, "svg");
    resultado.setAttribute("xmlns", NS);
    resultado.setAttribute("viewBox", `0 0 ${vb.largura} ${vb.altura}`);
    for (const path of caminhos) {
      const m = path.getCTM();
      if (!m)
        throw new Error("Não foi possível aplicar as transformações do vetor.");
      const d = new SVGPathData(path.getAttribute("d")!)
        .toAbs()
        .normalizeHVZ(false)
        .normalizeST()
        .qtToC()
        .aToC()
        .matrix(m.a, m.b, m.c, m.d, m.e, m.f)
        .round(1e5)
        .encode();
      const plano = document.createElementNS(NS, "path");
      plano.setAttribute("d", d);
      plano.setAttribute("fill", path.getAttribute("fill")!);
      plano.setAttribute("fill-rule", path.getAttribute("fill-rule")!);
      resultado.append(plano);
    }
    // A escala corresponde à arte inteira, sem o espaço vazio da prancheta SVG.
    resultado.style.cssText =
      "position:fixed;left:-2000000px;top:0;visibility:hidden;";
    document.body.append(resultado);
    try {
      const bounds = resultado.getBBox();
      if (
        ![bounds.x, bounds.y, bounds.width, bounds.height].every(
          Number.isFinite
        ) ||
        bounds.width <= 0 ||
        bounds.height <= 0
      )
        throw new Error(
          "O vetor não tem uma área preenchida válida para dimensionar."
        );
      resultado.setAttribute(
        "viewBox",
        `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`
      );
      resultado.removeAttribute("style");
      return new XMLSerializer().serializeToString(resultado);
    } finally {
      resultado.remove();
    }
  } finally {
    svg.remove();
  }
}
