import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";

export type CpqChapa = {
  id: number;
  mubisysMateriaPrimaId: number;
  nome: string;
  larguraMm: number;
  alturaMm: number;
};

export type CpqMaterial = {
  id: number;
  nome: string;
  custoUnitario: number;
  unidadeCusto: string;
  chapas: CpqChapa[];
};

export type CpqNestingPlacement = {
  id: number;
  xMm: number;
  yMm: number;
  larguraMm: number;
  alturaMm: number;
  rotacaoGraus: number;
};

type DeepnestWorkerResult = {
  completo: boolean;
  quantidadePecas: number;
  quantidadePosicionada: number;
  areaLiquidaMm2: number;
  perimetroTotalMm: number;
  placements: CpqNestingPlacement[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
};

export type CpqNestingMaterialResult = {
  id_materia_prima: number;
  materia_prima: string;
  custo_unitario: number | null;
  unidade_custo: string;
  custo_material_estimado: number | null;
  alerta_custo: string | null;
  area_liquida_m2: number;
  perimetro_total_m: number;
  area_chapa_utilizada_m2: number;
  porcentagem_aproveitamento: number;
  id_chapa_utilizada: number;
  nome_chapa_utilizada: string;
  chapa: { largura_mm: number; altura_mm: number };
  posicionamentos: CpqNestingPlacement[];
};

export class CpqNestingError extends Error {
  constructor(
    message: string,
    readonly code: "configuration" | "engine" | "no_fit" | "invalid_geometry"
  ) {
    super(message);
    this.name = "CpqNestingError";
  }
}

function dimensoesLandscape(chapa: CpqChapa): {
  larguraMm: number;
  alturaMm: number;
} {
  return {
    larguraMm: Math.max(chapa.larguraMm, chapa.alturaMm),
    alturaMm: Math.min(chapa.larguraMm, chapa.alturaMm),
  };
}

/** Ordena as opções por área crescente; a primeira chapa que couber vence. */
export function ordenarChapasMenoresPrimeiro(chapas: CpqChapa[]): CpqChapa[] {
  return [...chapas].sort((a, b) => {
    const areaA = a.larguraMm * a.alturaMm;
    const areaB = b.larguraMm * b.alturaMm;
    return (
      areaA - areaB ||
      Math.max(a.larguraMm, a.alturaMm) - Math.max(b.larguraMm, b.alturaMm) ||
      a.id - b.id
    );
  });
}

/** Retângulo de consumo alinhado à borda esquerda X=0 após a translação do nesting. */
export function calcularBoundingBoxEsquerdo(
  bounds: DeepnestWorkerResult["bounds"]
): { larguraMm: number; alturaMm: number; areaM2: number } {
  if (!bounds)
    throw new CpqNestingError(
      "O motor não retornou os limites das peças posicionadas.",
      "invalid_geometry"
    );
  const larguraMm = bounds.maxX - bounds.minX;
  const alturaMm = bounds.maxY - bounds.minY;
  if (!(larguraMm > 0) || !(alturaMm > 0)) {
    throw new CpqNestingError(
      "O bounding box do nesting tem dimensões inválidas.",
      "invalid_geometry"
    );
  }
  return { larguraMm, alturaMm, areaM2: (larguraMm * alturaMm) / 1_000_000 };
}

function normalizarSvgFisico(
  svg: string,
  larguraSvgMm: number,
  alturaSvgMm: number
): string {
  if (
    svg.length > 1_500_000 ||
    /<!doctype|<!entity|<\s*(script|foreignObject|image|use)\b|\son[a-z]+\s*=|(?:href|xlink:href|transform)\s*=/i.test(
      svg
    )
  ) {
    throw new CpqNestingError(
      "O SVG excede o limite ou contém conteúdo não permitido para nesting.",
      "invalid_geometry"
    );
  }
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (
    !root ||
    !/<path\b/i.test(svg) ||
    /<\s*(rect|circle|ellipse|polygon|polyline|line|text)\b/i.test(svg)
  ) {
    throw new CpqNestingError(
      "Envie um SVG com caminhos vetoriais fechados e sem formas fora de path.",
      "invalid_geometry"
    );
  }
  const viewBox = root.match(/\bviewBox\s*=\s*(["'])([^"']+)\1/i)?.[2];
  const dims = viewBox
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    !dims ||
    dims.length !== 4 ||
    !dims.every(Number.isFinite) ||
    dims[2] <= 0 ||
    dims[3] <= 0
  ) {
    throw new CpqNestingError(
      "O SVG precisa ter um viewBox válido.",
      "invalid_geometry"
    );
  }
  const novoRoot = root
    .replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/>$/, ` width="${larguraSvgMm}mm" height="${alturaSvgMm}mm">`);
  return svg.replace(root, novoRoot);
}

function executarMotor(
  svg: string,
  larguraMm: number,
  alturaMm: number,
  espacamentoMm: number,
  timeoutMs: number
): Promise<DeepnestWorkerResult> {
  const nodeBin = process.env.DEEPNEST_NODE_BIN;
  const deepnestEntry = process.env.DEEPNEST_NODE_ENTRY;
  if (!nodeBin || !deepnestEntry) {
    throw new CpqNestingError(
      "Configure DEEPNEST_NODE_BIN e DEEPNEST_NODE_ENTRY para habilitar o motor Deepnest local.",
      "configuration"
    );
  }

  const workerPath = resolve(
    process.cwd(),
    "server",
    "scripts",
    "cpq-deepnest-worker.mjs"
  );
  const child = spawn(nodeBin, [resolve(workerPath)], {
    env: { ...process.env, DEEPNEST_NODE_ENTRY: resolve(deepnestEntry) },
    cwd: dirname(resolve(deepnestEntry)),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  return new Promise((resolvePromise, rejectPromise) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 12_000_000) child.kill();
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-12_000);
    });
    child.on("error", error => {
      clearTimeout(timeout);
      rejectPromise(
        new CpqNestingError(
          `Não foi possível iniciar o worker Deepnest: ${error.message}`,
          "engine"
        )
      );
    });
    child.on("close", code => {
      clearTimeout(timeout);
      try {
        const resultado = JSON.parse(stdout) as
          DeepnestWorkerResult | { error?: string };
        if (code !== 0 || "error" in resultado) {
          const mensagem = "error" in resultado ? resultado.error : undefined;
          rejectPromise(
            new CpqNestingError(
              mensagem ||
                stderr ||
                "O worker Deepnest encerrou com erro.",
              "engine"
            )
          );
          return;
        }
        resolvePromise(resultado as DeepnestWorkerResult);
      } catch {
        rejectPromise(
          new CpqNestingError(
            stderr || "O worker Deepnest não devolveu um resultado válido.",
            "engine"
          )
        );
      }
    });
    child.stdin.end(
      JSON.stringify({ svg, larguraMm, alturaMm, espacamentoMm, timeoutMs })
    );
  });
}

function estimarCusto(
  material: CpqMaterial,
  areaChapaM2: number,
  perimetroM: number
): { custo: number | null; alerta: string | null } {
  if (!Number.isFinite(material.custoUnitario) || material.custoUnitario <= 0) {
    return {
      custo: null,
      alerta:
        "Matéria-prima sem custo válido no MubiSys; a precificação deve ficar bloqueada.",
    };
  }
  const unidade = material.unidadeCusto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (["m2", "m²", "metro quadrado", "metros quadrados"].includes(unidade)) {
    return { custo: areaChapaM2 * material.custoUnitario, alerta: null };
  }
  if (
    ["m", "ml", "metro linear", "metros lineares", "perimetro"].includes(
      unidade
    )
  ) {
    return { custo: perimetroM * material.custoUnitario, alerta: null };
  }
  if (["un", "und", "unidade", "unidades", "chapa"].includes(unidade)) {
    return { custo: material.custoUnitario, alerta: null };
  }
  return {
    custo: null,
    alerta: `Unidade de custo "${material.unidadeCusto}" sem conversão automática; revise a regra antes de emitir a proposta.`,
  };
}

/** Nesting sequencial por matéria-prima e por tamanho de chapa, menor primeiro. */
export async function calcularNestingMultiMaterial(input: {
  svg: string;
  larguraSvgMm: number;
  alturaSvgMm: number;
  espacamentoMm?: number;
  materiais: CpqMaterial[];
}): Promise<CpqNestingMaterialResult[]> {
  if (input.materiais.length === 0)
    throw new CpqNestingError(
      "Selecione ao menos um material de chapa.",
      "invalid_geometry"
    );
  if (
    !Number.isFinite(input.larguraSvgMm) ||
    !Number.isFinite(input.alturaSvgMm) ||
    input.larguraSvgMm <= 0 ||
    input.alturaSvgMm <= 0 ||
    input.larguraSvgMm > 50_000 ||
    input.alturaSvgMm > 50_000
  ) {
    throw new CpqNestingError(
      "As dimensões físicas do SVG precisam ser válidas em milímetros.",
      "invalid_geometry"
    );
  }
  const espacamentoMm = input.espacamentoMm ?? 0;
  if (
    !Number.isFinite(espacamentoMm) ||
    espacamentoMm < 0 ||
    espacamentoMm > 50
  ) {
    throw new CpqNestingError(
      "O espaçamento entre peças precisa ficar entre 0 e 50 mm.",
      "invalid_geometry"
    );
  }
  const svg = normalizarSvgFisico(
    input.svg,
    input.larguraSvgMm,
    input.alturaSvgMm
  );
  const resultados: CpqNestingMaterialResult[] = [];
  const ids = new Set<number>();

  for (const material of input.materiais) {
    if (ids.has(material.id)) continue;
    ids.add(material.id);
    const chapas = ordenarChapasMenoresPrimeiro(
      material.chapas.filter(
        chapa =>
          chapa.mubisysMateriaPrimaId === material.id &&
          Number.isInteger(chapa.larguraMm) &&
          chapa.larguraMm > 0 &&
          Number.isInteger(chapa.alturaMm) &&
          chapa.alturaMm > 0
      )
    );
    if (chapas.length === 0) {
      throw new CpqNestingError(
        `Não há formato de chapa cadastrado para ${material.nome} (matéria-prima ${material.id}).`,
        "no_fit"
      );
    }

    let chapaEscolhida: CpqChapa | null = null;
    let nestingEscolhido: DeepnestWorkerResult | null = null;
    for (const chapa of chapas) {
      const dimensoes = dimensoesLandscape(chapa);
      const nesting = await executarMotor(
        svg,
        dimensoes.larguraMm,
        dimensoes.alturaMm,
        espacamentoMm,
        20_000
      );
      if (
        nesting.completo &&
        nesting.quantidadePosicionada > 0 &&
        nesting.placements.length === nesting.quantidadePecas
      ) {
        chapaEscolhida = chapa;
        nestingEscolhido = nesting;
        break;
      }
    }
    if (!chapaEscolhida || !nestingEscolhido) {
      throw new CpqNestingError(
        `As peças de ${material.nome} não couberam em nenhum dos formatos de chapa cadastrados.`,
        "no_fit"
      );
    }

    const caixa = calcularBoundingBoxEsquerdo(nestingEscolhido.bounds);
    const chapa = dimensoesLandscape(chapaEscolhida);
    const areaChapaTotalM2 = (chapa.larguraMm * chapa.alturaMm) / 1_000_000;
    const custo = estimarCusto(
      material,
      caixa.areaM2,
      nestingEscolhido.perimetroTotalMm / 1000
    );
    resultados.push({
      id_materia_prima: material.id,
      materia_prima: material.nome,
      custo_unitario:
        material.custoUnitario > 0 ? material.custoUnitario : null,
      unidade_custo: material.unidadeCusto,
      custo_material_estimado: custo.custo,
      alerta_custo: custo.alerta,
      area_liquida_m2: nestingEscolhido.areaLiquidaMm2 / 1_000_000,
      perimetro_total_m: nestingEscolhido.perimetroTotalMm / 1000,
      area_chapa_utilizada_m2: caixa.areaM2,
      porcentagem_aproveitamento:
        areaChapaTotalM2 > 0 ? (caixa.areaM2 / areaChapaTotalM2) * 100 : 0,
      id_chapa_utilizada: chapaEscolhida.id,
      nome_chapa_utilizada: chapaEscolhida.nome,
      chapa: { largura_mm: chapa.larguraMm, altura_mm: chapa.alturaMm },
      posicionamentos: nestingEscolhido.placements.map(position => ({
        ...position,
        xMm: position.xMm - (nestingEscolhido?.bounds?.minX ?? 0),
      })),
    });
  }
  return resultados;
}
