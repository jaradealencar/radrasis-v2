export type CpqCorAlvo = {
  key: string;
  pathIndex?: number;
  pathIndexes?: number[];
  tipoCor: "solida" | "gradiente" | "complexa" | "desconhecida";
  corHex?: string | null;
  corRgb?: { r: number; g: number; b: number } | null;
  coresGradiente?: string[];
  pantoneCode?: string | null;
  cmyk?: { c: number; m: number; y: number; k: number } | null;
  areaM2?: number | null;
};

export type CpqCorCatalogo = {
  id: number;
  mubisysMateriaPrimaId?: number | null;
  materialNome?: string | null;
  codigo?: string | null;
  linha?: string | null;
  nome?: string | null;
  nomeCor?: string | null;
  tipoVinil?: string | null;
  corHex?: string | null;
  pantoneCode?: string | null;
  cmykC?: string | number | null;
  cmykM?: string | number | null;
  cmykY?: string | number | null;
  cmykK?: string | number | null;
  transmissaoLuzPct?: string | number | null;
  transparenciaTipo?: "opaca" | "translucida" | "transparente" | null;
  principal?: boolean;
  precoM2?: string | number | null;
  ativo?: boolean;
};

export type CpqPrecoImpressaoCor = {
  vinilBrancoM2?: string | number | null;
  vinilBrancoTransmissaoPct?: string | number | null;
  vinilTransparenteM2?: string | number | null;
  vinilTransparenteTransmissaoPct?: string | number | null;
  impressaoM2?: string | number | null;
  laminacaoM2?: string | number | null;
  laminacaoPadrao?: boolean;
} | null;

export type CpqCorrespondenciaCorInput = {
  regiao: CpqCorAlvo;
  chapas: CpqCorCatalogo[];
  adesivos: CpqCorCatalogo[];
  iluminacao: "sem_iluminacao" | "frontlight" | "backlight";
  transmissaoMinimaPct?: number | null;
  baseImpressao: "branco" | "transparente";
  laminar: boolean;
  precos: CpqPrecoImpressaoCor;
  construcaoFace?: "acrilico_total" | "outra" | "nao_informada";
};

export type CpqCorrespondenciaCorResult = {
  regionKey: string;
  tipoCor: CpqCorAlvo["tipoCor"];
  corHex: string | null;
  pantoneCode: string | null;
  coresGradiente: string[];
  pathIndexes: number[];
  corRgb: { r: number; g: number; b: number } | null;
  cmyk: CpqCorAlvo["cmyk"];
  areaM2: number | null;
  tipoSugestao: "chapa" | "imprimax" | "impresso" | "pendente";
  chapaId: number | null;
  chapaMateriaPrimaId: number | null;
  chapaBaseId: number | null;
  chapaBaseMateriaPrimaId: number | null;
  requerChapaBase: boolean;
  requerConfirmacaoConstrucao: boolean;
  imprimaxAdesivoId: number | null;
  deltaE00: number | null;
  custoEstimado: number | null;
  unidadeCusto: "m2" | null;
  avisos: string[];
  alternativas: Array<Record<string, unknown>>;
  precificacao: Record<string, unknown> | null;
  composicaoFace: Record<string, unknown> | null;
};

const DELTA_E_CHAPA_DIRETA = 2;
const DELTA_E_IMPRIMAX_SOLIDO = 5;

const CORES_NOMEADAS: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000",
  blue: "#0000ff", yellow: "#ffff00", cyan: "#00ffff", magenta: "#ff00ff",
  gray: "#808080", grey: "#808080", orange: "#ffa500", purple: "#800080",
  lime: "#00ff00", navy: "#000080", teal: "#008080", silver: "#c0c0c0",
  maroon: "#800000", olive: "#808000", fuchsia: "#ff00ff", aqua: "#00ffff",
};

function atributosSvg(texto: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of texto.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) {
    result[match[1].toLowerCase()] = match[3];
  }
  return result;
}

function estiloSvg(value: string | undefined, property: string): string | null {
  if (!value) return null;
  const declaration = value.split(";").map(item => item.trim()).find(item => item.toLowerCase().startsWith(`${property}:`));
  return declaration?.slice(declaration.indexOf(":") + 1).trim() ?? null;
}

function rgbParaHex(rgb: [number, number, number]): string {
  return `#${rgb.map(channel => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0")).join("")}`;
}

function lerCorSvg(value: string | null | undefined): string | null {
  if (!value) return null;
  const paint = value.trim().toLowerCase();
  if (CORES_NOMEADAS[paint]) return CORES_NOMEADAS[paint];
  const hex = hexParaRgb(paint);
  if (hex) return rgbParaHex(hex);
  const rgb = paint.match(/^rgba?\(\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?(?:\s*,\s*[\d.]+)?\s*\)$/);
  if (!rgb) return null;
  const percent = /%/.test(paint);
  const channels = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  if (channels.some(channel => !Number.isFinite(channel))) return null;
  return rgbParaHex(channels.map(channel => percent ? channel * 2.55 : channel) as [number, number, number]);
}

function lerCMYK(value: string | undefined): CpqCorAlvo["cmyk"] {
  if (!value) return null;
  const match = value.match(/^\s*([\d.]+)\s*[,/]\s*([\d.]+)\s*[,/]\s*([\d.]+)\s*[,/]\s*([\d.]+)\s*$/);
  if (!match) return null;
  const channels = match.slice(1).map(Number);
  if (channels.some(channel => !Number.isFinite(channel) || channel < 0 || channel > 100)) return null;
  return { c: channels[0], m: channels[1], y: channels[2], k: channels[3] };
}

/** Lê os preenchimentos por caminho da arte original, antes da normalização monocromática do CNC. */
export function extrairRegioesCorSvg(svg: string): CpqCorAlvo[] {
  if (svg.length > 1_500_000
    || /<!doctype|<!entity|<\s*(script|style|a|foreignObject|image|use|clipPath|mask|filter|pattern|marker)\b|\son[a-z]+\s*=|\btransform\s*=/i.test(svg)
    || /\b(?:display|visibility)\s*=\s*["'](?:none|hidden)["']/i.test(svg)
    || /\b(?:opacity|fill-opacity|stroke-opacity)\s*=\s*["'](?!1(?:\.0*)?["'])\d*\.?\d+["']/i.test(svg))
    throw new Error("A arte colorida excede o limite ou contém elementos não permitidos.");
  const paths: Array<{ attributes: Record<string, string>; inheritedFill: string; index: number }> = [];
  const groupFills: string[] = [];
  const rootAttributes = atributosSvg(svg.match(/<svg\b([^>]*)>/i)?.[1] ?? "");
  let inheritedFill = estiloSvg(rootAttributes.style, "fill") ?? rootAttributes.fill ?? "#000000";
  let defsDepth = 0;
  const tags = /<\s*(\/?)\s*(g|defs|path)\b([^>]*)>/gi;
  for (const match of svg.matchAll(tags)) {
    const closing = match[1] === "/";
    const tagName = match[2].toLowerCase();
    const source = match[3];
    const selfClosing = /\/\s*$/.test(source);
    const attrs = atributosSvg(source);
    if (tagName === "defs") {
      if (closing) defsDepth = Math.max(0, defsDepth - 1);
      else if (!selfClosing) defsDepth += 1;
      continue;
    }
    if (tagName === "g") {
      if (closing) {
        inheritedFill = groupFills.pop() ?? "#000000";
      } else if (!selfClosing) {
        groupFills.push(inheritedFill);
        inheritedFill = estiloSvg(attrs.style, "fill") ?? attrs.fill ?? inheritedFill;
      }
      continue;
    }
    if (!closing && defsDepth === 0) {
      paths.push({ attributes: attrs, inheritedFill, index: paths.length });
    }
  }
  if (!paths.length || paths.length > 500)
    throw new Error("A arte colorida precisa conter de 1 a 500 caminhos SVG.");

  const gradients = new Map<string, string[]>();
  for (const match of svg.matchAll(/<(?:linearGradient|radialGradient)\b([^>]*)>([\s\S]*?)<\/(?:linearGradient|radialGradient)\s*>/gi)) {
    const id = atributosSvg(match[1]).id;
    if (!id) continue;
    const stops = [...match[2].matchAll(/<stop\b([^>]*)\/?>/gi)].flatMap(stop => {
      const attrs = atributosSvg(stop[1]);
      const paint = attrs["stop-color"] ?? estiloSvg(attrs.style, "stop-color");
      const color = lerCorSvg(paint);
      return color ? [color] : [];
    });
    gradients.set(id, [...new Set(stops)]);
  }

  const seenKeys = new Map<string, number>();
  return paths.map(({ attributes: attrs, inheritedFill, index: pathIndex }) => {
    const fill = estiloSvg(attrs.style, "fill") ?? attrs.fill ?? inheritedFill;
    const key = (attrs.id || `path-${pathIndex + 1}`).slice(0, 80);
    const duplicateKeyCount = seenKeys.get(key) ?? 0;
    seenKeys.set(key, duplicateKeyCount + 1);
    const uniqueKey = duplicateKeyCount ? `${key}-${pathIndex}` : key;
    const gradientRef = fill.match(/^url\(\s*["']?#([\w.-]+)["']?\s*\)$/i)?.[1];
    const gradientColors = gradientRef ? gradients.get(gradientRef) ?? [] : [];
    const pantoneCode = attrs["data-pantone"] ?? attrs["data-pantone-code"] ?? null;
    const cmyk = lerCMYK(attrs["data-cmyk"]);
    if (gradientRef) {
      return {
        key: uniqueKey, pathIndex, tipoCor: "gradiente", corHex: null,
        coresGradiente: gradientColors, pantoneCode, cmyk,
      };
    }
    const corHex = fill.trim().toLowerCase() === "none" ? null : lerCorSvg(fill);
    return {
      key: uniqueKey,
      pathIndex,
      tipoCor: corHex || pantoneCode || cmyk ? "solida" : fill.trim().toLowerCase() === "none" ? "desconhecida" : "complexa",
      corHex,
      pantoneCode,
      cmyk,
    };
  });
}

function valor(input: string | number | null | undefined): number | null {
  if (input == null || input === "") return null;
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizarPantone(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/\s+/g, "").replace(/®/g, "");
}

function hexParaRgb(hex: string | null | undefined): [number, number, number] | null {
  const value = (hex ?? "").trim().replace(/^#/, "");
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) return null;
  const full = value.length === 3 ? [...value].map(char => char + char).join("") : value;
  return [0, 2, 4].map(offset => parseInt(full.slice(offset, offset + 2), 16)) as [number, number, number];
}

function cmykParaRgb(cmyk: { c: number; m: number; y: number; k: number }): [number, number, number] {
  const c = Math.max(0, Math.min(100, cmyk.c)) / 100;
  const m = Math.max(0, Math.min(100, cmyk.m)) / 100;
  const y = Math.max(0, Math.min(100, cmyk.y)) / 100;
  const k = Math.max(0, Math.min(100, cmyk.k)) / 100;
  return [
    Math.round(255 * (1 - c) * (1 - k)),
    Math.round(255 * (1 - m) * (1 - k)),
    Math.round(255 * (1 - y) * (1 - k)),
  ];
}

function rgbParaLab(rgb: [number, number, number]): [number, number, number] {
  const linear = rgb.map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = linear;
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (value: number) => value > 216 / 24389 ? Math.cbrt(value) : (24389 / 27 * value + 16) / 116;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 (parametric factors kL=kC=kH=1), com Lab D65. */
export function deltaE2000(lab1: [number, number, number], lab2: [number, number, number]): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (a: number, b: number) => {
    if (a === 0 && b === 0) return 0;
    const degrees = Math.atan2(b, a) * 180 / Math.PI;
    return degrees < 0 ? degrees + 360 : degrees;
  };
  const h1p = h(a1p, b1), h2p = h(a2p, b2);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * Math.PI / 180);
  const Lbarp = (L1 + L2) / 2, Cbarp = (C1p + C2p) / 2;
  let hbarp = h1p + h2p;
  if (C1p * C2p === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
  else hbarp = (h1p + h2p - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hbarp - 30) * Math.PI / 180)
    + 0.24 * Math.cos(2 * hbarp * Math.PI / 180)
    + 0.32 * Math.cos((3 * hbarp + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * hbarp - 63) * Math.PI / 180);
  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7));
  const Sl = 1 + 0.015 * ((Lbarp - 50) ** 2) / Math.sqrt(20 + ((Lbarp - 50) ** 2));
  const Sc = 1 + 0.045 * Cbarp, Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(2 * dTheta * Math.PI / 180) * Rc;
  const l = dLp / Sl, c = dCp / Sc, hTerm = dHp / Sh;
  return Math.sqrt(Math.max(0, l * l + c * c + hTerm * hTerm + Rt * c * hTerm));
}

function alvoLab(regiao: CpqCorAlvo): [number, number, number] | null {
  const rgb = hexParaRgb(regiao.corHex) ?? (regiao.cmyk ? cmykParaRgb(regiao.cmyk) : null);
  return rgb ? rgbParaLab(rgb) : null;
}

function labCatalogo(material: CpqCorCatalogo): [number, number, number] | null {
  const rgb = hexParaRgb(material.corHex) ?? (() => {
    const c = valor(material.cmykC), m = valor(material.cmykM), y = valor(material.cmykY), k = valor(material.cmykK);
    return c == null || m == null || y == null || k == null ? null : cmykParaRgb({ c, m, y, k });
  })();
  return rgb ? rgbParaLab(rgb) : null;
}

function luzCompativel(material: CpqCorCatalogo, input: CpqCorrespondenciaCorInput): { ok: boolean; avisos: string[] } {
  if (input.iluminacao === "sem_iluminacao") return { ok: true, avisos: [] };
  if (input.iluminacao === "backlight" && input.transmissaoMinimaPct == null)
    return { ok: false, avisos: ["Informe a transmiss\u00e3o m\u00ednima definida pela engenharia para avaliar uma face backlight."] };
  const transmission = valor(material.transmissaoLuzPct);
  if (transmission == null) return { ok: false, avisos: ["Transmiss\u00e3o de luz n\u00e3o cadastrada; n\u00e3o sugerir para face iluminada."] };
  if (transmission <= 0) return { ok: false, avisos: ["Material sem transmiss\u00e3o de luz; incompat\u00edvel com face iluminada."] };
  if (input.transmissaoMinimaPct == null)
    return { ok: true, avisos: ["Transmiss\u00e3o positiva cadastrada; engenharia precisa confirmar se atende ao n\u00edvel de ilumina\u00e7\u00e3o do projeto."] };
  if (transmission < input.transmissaoMinimaPct)
    return { ok: false, avisos: ["Transmiss\u00e3o de " + transmission + "% abaixo do m\u00ednimo informado (" + input.transmissaoMinimaPct + "%)."] };
  return { ok: true, avisos: [] };
}

function candidatos(
  lista: CpqCorCatalogo[],
  alvo: CpqCorAlvo,
  lab: [number, number, number] | null,
  input: CpqCorrespondenciaCorInput,
  identidade: "chapa" | "imprimax"
) {
  return lista.filter(item => item.ativo !== false).map(item => {
    const pantoneExato = !!normalizarPantone(alvo.pantoneCode)
      && normalizarPantone(alvo.pantoneCode) === normalizarPantone(item.pantoneCode);
    const labItem = labCatalogo(item);
    const deltaE = pantoneExato ? 0 : lab && labItem ? deltaE2000(lab, labItem) : null;
    const luz = luzCompativel(item, input);
    return {
      kind: identidade,
      id: item.id,
      mubisysMateriaPrimaId: item.mubisysMateriaPrimaId ?? null,
      materialNome: item.materialNome ?? null,
      codigo: item.codigo ?? null,
      linha: item.linha ?? null,
      nome: item.nomeCor ?? item.nome ?? "",
      tipoVinil: item.tipoVinil ?? null,
      corHex: item.corHex ?? null,
      pantoneCode: item.pantoneCode ?? null,
      deltaE00: deltaE == null ? null : Number(deltaE.toFixed(3)),
      transmissaoLuzPct: valor(item.transmissaoLuzPct),
      transparenciaTipo: item.transparenciaTipo ?? null,
      principal: item.principal ?? false,
      precoM2: valor(item.precoM2),
      compativelIluminacao: luz.ok,
      avisosIluminacao: luz.avisos,
      raw: item,
    };
  }).filter(item => item.compativelIluminacao && item.deltaE00 != null)
    .sort((a, b) => a.deltaE00! - b.deltaE00!);
}

function planoComposicaoFace(input: CpqCorrespondenciaCorInput, avisos: string[]) {
  const requerChapaBase = input.iluminacao !== "sem_iluminacao" || input.construcaoFace === "acrilico_total";
  const requerConfirmacaoConstrucao = input.iluminacao === "sem_iluminacao"
    && input.construcaoFace !== "acrilico_total"
    && input.construcaoFace !== "outra";
  const basesTransparentes = input.chapas.filter(item => item.ativo !== false
    && item.transparenciaTipo === "transparente"
    && item.mubisysMateriaPrimaId != null
    && luzCompativel(item, input).ok);
  const basesPorMaterial = new Map<number, CpqCorCatalogo[]>();
  for (const chapa of basesTransparentes) {
    const id = Number(chapa.mubisysMateriaPrimaId);
    basesPorMaterial.set(id, [...(basesPorMaterial.get(id) ?? []), chapa]);
  }
  const basesPreferenciais = [...basesPorMaterial.values()].filter(opcoes => opcoes.some(item => item.principal));
  const baseSelecionada = basesPreferenciais.length === 1
    ? basesPreferenciais[0].find(item => item.principal)!
    : basesPorMaterial.size === 1
      ? [...basesPorMaterial.values()][0].find(item => item.principal) ?? [...basesPorMaterial.values()][0][0]
      : null;
  if (requerChapaBase && !baseSelecionada)
    avisos.push(basesPorMaterial.size > 1
      ? "Há mais de uma matéria-prima transparente compatível; marque uma como principal ou confirme qual deve ser usada na face."
      : "Não há chapa transparente cadastrada e compatível; classifique a matéria-prima da face para compor acrílico transparente + adesivo.");
  if (requerConfirmacaoConstrucao)
    avisos.push("Confirme se a face é de acrílico ou de outro substrato para definir a composição da região sem correspondência sólida.");
  return {
    chapaBaseId: baseSelecionada?.id ?? null,
    chapaBaseMateriaPrimaId: baseSelecionada?.mubisysMateriaPrimaId ?? null,
    requerChapaBase,
    requerConfirmacaoConstrucao,
    composicaoFace: requerChapaBase && baseSelecionada ? {
      papel: "Face",
      base: "chapa_transparente",
      chapaId: baseSelecionada.id,
      mubisysMateriaPrimaId: baseSelecionada.mubisysMateriaPrimaId,
      transparenciaTipo: baseSelecionada.transparenciaTipo,
      transmissaoLuzPct: valor(baseSelecionada.transmissaoLuzPct),
      aplicarAutomaticamenteSeFaceUnica: true,
    } : null,
  };
}

function impresso(input: CpqCorrespondenciaCorInput, avisos: string[]): CpqCorrespondenciaCorResult {
  const area = input.regiao.areaM2 != null && Number.isFinite(input.regiao.areaM2) && input.regiao.areaM2 >= 0
    ? input.regiao.areaM2 : null;
  const vinil = valor(input.baseImpressao === "branco" ? input.precos?.vinilBrancoM2 : input.precos?.vinilTransparenteM2);
  const transmissao = valor(input.baseImpressao === "branco" ? input.precos?.vinilBrancoTransmissaoPct : input.precos?.vinilTransparenteTransmissaoPct);
  const impressao = valor(input.precos?.impressaoM2);
  const laminacao = input.laminar ? valor(input.precos?.laminacaoM2) : 0;
  const iluminacaoRequerTransmissao = input.iluminacao !== "sem_iluminacao";
  const transmissaoCompativel = !iluminacaoRequerTransmissao
    || (transmissao != null && transmissao > 0
      && (input.transmissaoMinimaPct == null || transmissao >= input.transmissaoMinimaPct));
  const complete = area != null && vinil != null && impressao != null && laminacao != null && transmissaoCompativel;
  if (area == null) avisos.push("Área física não calculada; confirme escala e extração da região.");
  if (vinil == null) avisos.push(`Custo por m² do vinil ${input.baseImpressao} não cadastrado.`);
  if (iluminacaoRequerTransmissao && transmissao == null) avisos.push(`Transmissão de luz do vinil ${input.baseImpressao} não cadastrada; confirme a compatibilidade antes de aprovar.`);
  else if (iluminacaoRequerTransmissao && transmissao === 0) avisos.push(`Vinil ${input.baseImpressao} sem transmissão de luz; incompatível com a face iluminada.`);
  else if (iluminacaoRequerTransmissao && input.transmissaoMinimaPct != null && transmissao! < input.transmissaoMinimaPct)
    avisos.push(`Transmissão de ${transmissao}% do vinil ${input.baseImpressao} abaixo do mínimo informado (${input.transmissaoMinimaPct}%).`);
  else if (iluminacaoRequerTransmissao && input.transmissaoMinimaPct == null)
    avisos.push("Transmissão do vinil cadastrada; engenharia precisa confirmar se atende ao nível de iluminação do projeto.");
  if (impressao == null) avisos.push("Custo de impressão digital por m² não cadastrado.");
  if (input.laminar && laminacao == null) avisos.push("Custo de laminação por m² não cadastrado.");
  const unit = complete ? vinil! + impressao! + laminacao! : null;
  const planoFace = planoComposicaoFace(input, avisos);
  return {
    regionKey: input.regiao.key,
    tipoCor: input.regiao.tipoCor,
    corHex: input.regiao.corHex ?? null,
    pantoneCode: input.regiao.pantoneCode ?? null,
    corRgb: input.regiao.corRgb ?? null,
    cmyk: input.regiao.cmyk ?? null,
    coresGradiente: input.regiao.coresGradiente ?? [],
    pathIndexes: input.regiao.pathIndexes ?? (input.regiao.pathIndex == null ? [] : [input.regiao.pathIndex]),
    areaM2: area == null ? null : Number(area.toFixed(6)),
    tipoSugestao: "impresso",
    chapaId: null,
    chapaMateriaPrimaId: null,
    ...planoFace,
    imprimaxAdesivoId: null,
    deltaE00: null,
    custoEstimado: unit != null ? Number((unit * area!).toFixed(4)) : null,
    unidadeCusto: unit == null ? null : "m2",
    avisos,
    alternativas: [],
    precificacao: unit == null ? null : {
      base: input.baseImpressao,
      areaM2: area,
      vinilM2: vinil,
      transmissaoLuzPct: transmissao,
      impressaoM2: impressao,
      laminacaoM2: input.laminar ? laminacao : 0,
      custoUnitarioM2: unit,
      laminar: input.laminar,
    },
  };
}

export function sugerirMaterialParaCor(input: CpqCorrespondenciaCorInput): CpqCorrespondenciaCorResult {
  const target = input.regiao;
  const avisos: string[] = [];
  if (target.cmyk && !target.corHex)
    avisos.push("CMYK foi convertido por aproximação para sRGB; confirme perfil ICC e prova física antes de fabricar.");
  const rgb = hexParaRgb(target.corHex) ?? (target.cmyk ? cmykParaRgb(target.cmyk) : null);
  const corRgb = target.corRgb ?? (rgb ? { r: rgb[0], g: rgb[1], b: rgb[2] } : null);
  const cmyk = target.cmyk ?? (rgb ? (() => {
    const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    const k = 1 - Math.max(r, g, b);
    if (k >= 0.999999) return { c: 0, m: 0, y: 0, k: 100 };
    const factor = 1 - k;
    return { c: Number(((1 - r - k) / factor * 100).toFixed(2)), m: Number(((1 - g - k) / factor * 100).toFixed(2)), y: Number(((1 - b - k) / factor * 100).toFixed(2)), k: Number((k * 100).toFixed(2)) };
  })() : null);
  if (target.tipoCor !== "solida") {
    avisos.push(target.tipoCor === "gradiente"
      ? "Gradiente/degradê exige impressão digital; não há equivalência confiável em cor sólida."
      : "Região complexa ou sem cor sólida identificável: classificada para impressão digital.");
    return { ...impresso(input, avisos), corRgb, cmyk };
  }
  const area = target.areaM2 != null && Number.isFinite(target.areaM2) && target.areaM2 >= 0
    ? Number(target.areaM2.toFixed(6)) : null;
  const lab = alvoLab(target);
  const chapa = candidatos(input.chapas, target, lab, input, "chapa");
  const direta = chapa.find(item => item.deltaE00! <= DELTA_E_CHAPA_DIRETA);
  if (direta) {
    avisos.push(...direta.avisosIluminacao);
    if (area == null) avisos.push("Área física não calculada; sugestão cromática pode ser revisada, mas consumo fica pendente.");
    avisos.push("Correspondência interna direta por Pantone ou CIEDE2000; confirme a amostra física do lote.");
    return {
      regionKey: target.key, tipoCor: target.tipoCor, corHex: target.corHex ?? null,
      pantoneCode: target.pantoneCode ?? null,
      coresGradiente: target.coresGradiente ?? [],
      pathIndexes: target.pathIndexes ?? (target.pathIndex == null ? [] : [target.pathIndex]), areaM2: area,
      corRgb, cmyk,
      tipoSugestao: "chapa", chapaId: Number(direta.id), imprimaxAdesivoId: null,
      chapaMateriaPrimaId: direta.mubisysMateriaPrimaId == null ? null : Number(direta.mubisysMateriaPrimaId),
      chapaBaseId: null, chapaBaseMateriaPrimaId: null, requerChapaBase: false, requerConfirmacaoConstrucao: false,
      deltaE00: direta.deltaE00, custoEstimado: null, unidadeCusto: null, avisos,
      alternativas: chapa.slice(0, 5).map(({ raw: _raw, ...item }) => item), precificacao: null,
      composicaoFace: direta.mubisysMateriaPrimaId == null ? null : {
        papel: "Face", base: "chapa_colorida", chapaId: direta.id,
        mubisysMateriaPrimaId: Number(direta.mubisysMateriaPrimaId), aplicarAutomaticamenteSeFaceUnica: true,
      },
    };
  }

  const vinis = candidatos(input.adesivos, target, lab, input, "imprimax");
  const solido = vinis.find(item => item.deltaE00! <= DELTA_E_IMPRIMAX_SOLIDO && item.raw.tipoVinil !== "transparente");
  if (solido) {
    avisos.push(...solido.avisosIluminacao);
    const price = valor(solido.raw.precoM2);
    if (area == null) avisos.push("Área física não calculada; confirme escala antes de fechar consumo do vinil.");
    if (price == null) avisos.push("Preço de compra do adesivo não cadastrado; o custo desta região está pendente.");
    avisos.push("Sugestão de vinil sólido Imprimax pela menor diferença CIEDE2000; confirme código e amostra física.");
    const planoFace = planoComposicaoFace(input, avisos);
    return {
      regionKey: target.key, tipoCor: target.tipoCor, corHex: target.corHex ?? null,
      pantoneCode: target.pantoneCode ?? null,
      coresGradiente: target.coresGradiente ?? [],
      pathIndexes: target.pathIndexes ?? (target.pathIndex == null ? [] : [target.pathIndex]), areaM2: area,
      corRgb, cmyk,
      tipoSugestao: "imprimax", chapaId: null, imprimaxAdesivoId: Number(solido.id),
      chapaMateriaPrimaId: null,
      ...planoFace,
      deltaE00: solido.deltaE00,
      custoEstimado: area != null && price != null ? Number((area * price).toFixed(4)) : null,
      unidadeCusto: price == null ? null : "m2", avisos,
      alternativas: vinis.slice(0, 5).map(({ raw: _raw, ...item }) => item),
      precificacao: area != null && price != null ? { areaM2: area, precoM2: price } : null,
    };
  }
  if (!vinis.length) avisos.push("Nenhuma amostra cromática Imprimax compatível com a iluminação foi importada.");
  else avisos.push(`A melhor cor sólida Imprimax excede ΔE00 ${DELTA_E_IMPRIMAX_SOLIDO}; impressão digital evita uma substituição visivelmente distante.`);
  return { ...impresso(input, avisos), corRgb, cmyk };
}
