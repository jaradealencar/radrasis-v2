import { pathToFileURL } from "node:url";

// Deepnest's native add-on documents Node 14-20 support. Run this isolated
// worker with that runtime instead of loading its native binary in Radrasys.
let stdoutWritten = false;
const writeResult = (value, code = 0) => {
  if (stdoutWritten) return;
  stdoutWritten = true;
  const output = `${JSON.stringify(value)}\n`;
  process.exitCode = code;
  process.stdout.write(output, () => process.exit(code));
};

console.log = (...args) => process.stderr.write(`${args.map(String).join(" ")}\n`);
console.warn = (...args) => process.stderr.write(`${args.map(String).join(" ")}\n`);

const errorText = error => error instanceof Error ? error.message : String(error);

async function readInput() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 64 * 1024 * 1024) throw new Error("A entrada do worker excede o limite de 64 MB.");
    chunks.push(chunk);
  }
  if (!size) throw new Error("O worker não recebeu dados de entrada.");
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("A entrada do worker precisa ser um objeto JSON.");

  const pecas = Array.isArray(input.pecas) && input.pecas.length
    ? input.pecas
    : [{ id: "peca-1", svg: input.svg }];
  if (!pecas.length || pecas.length > 100)
    throw new Error("O worker aceita de uma a cem peças por execução.");
  for (const [index, peca] of pecas.entries()) {
    if (typeof peca?.svg !== "string" || !peca.svg || peca.svg.length > 1_500_000)
      throw new Error(`O SVG da peça ${index + 1} é inválido ou excede 1,5 MB.`);
    if (!/<svg\b[^>]*>/i.test(peca.svg) || !/<path\b/i.test(peca.svg) ||
      /<!doctype|<!entity|<\s*(script|foreignObject|image|use)\b|\son[a-z]+\s*=|(?:href|xlink:href|transform)\s*=/i.test(peca.svg))
      throw new Error(`O SVG da peça ${index + 1} não contém apenas caminhos vetoriais permitidos.`);
    if (peca.larguraMm != null && (!Number.isFinite(peca.larguraMm) || peca.larguraMm <= 0 || peca.larguraMm > 50_000))
      throw new Error(`A largura da peça ${index + 1} é inválida.`);
    if (peca.alturaMm != null && (!Number.isFinite(peca.alturaMm) || peca.alturaMm <= 0 || peca.alturaMm > 50_000))
      throw new Error(`A altura da peça ${index + 1} é inválida.`);
  }
  if (!Number.isFinite(input.larguraMm) || input.larguraMm <= 0 ||
    !Number.isFinite(input.alturaMm) || input.alturaMm <= 0)
    throw new Error("As dimensões da chapa precisam ser positivas e finitas.");
  if (!Number.isFinite(input.espacamentoMm) || input.espacamentoMm < 0 || input.espacamentoMm > 50)
    throw new Error("O espaçamento precisa estar entre 0 e 50 mm.");
  if (!Number.isFinite(input.timeoutMs) || input.timeoutMs < 1_000 || input.timeoutMs > 120_000)
    throw new Error("O timeout do Deepnest precisa estar entre 1 e 120 segundos.");
  return pecas;
}

function areaOf(points) {
  let twiceArea = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    twiceArea += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twiceArea / 2);
}

function perimeterOf(points) {
  let length = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return length;
}

function visitContours(tree, depth = 0, result = { area: 0, perimeter: 0 }) {
  if (!Array.isArray(tree) || tree.length < 3)
    throw new Error("O Deepnest retornou um contorno ausente ou inválido.");
  if (tree.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y)))
    throw new Error("O Deepnest retornou coordenadas não finitas no contorno.");

  const area = areaOf(tree);
  const perimeter = perimeterOf(tree);
  if (!Number.isFinite(area) || !Number.isFinite(perimeter) || area <= 0 || perimeter <= 0)
    throw new Error("O Deepnest retornou área ou perímetro inválidos.");
  result.area += depth % 2 === 0 ? area : -area;
  result.perimeter += perimeter;
  for (const child of tree.children || []) visitContours(child, depth + 1, result);
  return result;
}

function rotatedBounds(tree, degrees, x, y, factor) {
  if (!Array.isArray(tree) || tree.length < 3 ||
    !Number.isFinite(degrees) || !Number.isFinite(x) || !Number.isFinite(y))
    throw new Error("O Deepnest retornou um posicionamento inválido.");
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const points = tree.map(point => ({
    x: point.x * cos - point.y * sin + x,
    y: point.x * sin + point.y * cos + y,
  }));
  const bounds = {
    minX: Math.min(...points.map(point => point.x)) * factor,
    maxX: Math.max(...points.map(point => point.x)) * factor,
    minY: Math.min(...points.map(point => point.y)) * factor,
    maxY: Math.max(...points.map(point => point.y)) * factor,
  };
  if (Object.values(bounds).some(value => !Number.isFinite(value)) ||
    bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY)
    throw new Error("O Deepnest retornou limites geométricos inválidos.");
  return bounds;
}

function main() {
  return readInput().then(async input => {
    const pecas = validateInput(input);
    const entry = process.env.DEEPNEST_NODE_ENTRY;
    if (!entry) throw new Error("DEEPNEST_NODE_ENTRY não foi configurado.");
    const { nest } = await import(pathToFileURL(entry).href);
    if (typeof nest !== "function") throw new Error("A entrada configurada não exporta a função nest do Deepnest.");

    const factor = 25.4 / 72;
    let finishTimer;
    let hardTimer;
    let abort = () => {};
    let best = null;
    let settled = false;

    const finish = (result, code = 0) => {
      if (settled) return;
      settled = true;
      clearTimeout(finishTimer);
      clearTimeout(hardTimer);
      // Do not let an abort implementation that hangs prevent the result from
      // being returned to the parent process.
      Promise.resolve().then(() => abort()).catch(() => {});
      writeResult(result, code);
    };

    const hardTimeout = () => {
      if (best) finish(best);
      else finish({ error: "O Deepnest excedeu o tempo sem concluir um layout válido." }, 1);
    };
    hardTimer = setTimeout(hardTimeout, input.timeoutMs);

    const onUpdate = data => {
      try {
        if (!data || !Array.isArray(data.elements) || !Array.isArray(data.result) ||
          !data.status || !Number.isInteger(data.status.total) || !Number.isInteger(data.status.placed))
          throw new Error("O Deepnest retornou uma estrutura de resultado inválida.");

        const geometries = data.elements.map((element, source) => {
          if (!element?.polygontree) throw new Error(`A peça ${source + 1} não possui contorno retornado pelo Deepnest.`);
          return { source, tree: element.polygontree, metrics: visitContours(element.polygontree) };
        });
        const geometryBySource = new Map(geometries.map(geometry => [geometry.source, geometry]));
        const placements = data.result.map(placement => {
          const geometry = geometryBySource.get(placement?.source);
          if (!geometry) throw new Error(`O Deepnest retornou peça sem geometria de origem (${placement?.source}).`);
          const rotation = placement.rotation ?? 0;
          const x = placement.x ?? 0;
          const y = placement.y ?? 0;
          const bounds = rotatedBounds(geometry.tree, rotation, x, y, factor);
          return {
            id: placement.id,
            source: placement.source,
            xMm: bounds.minX,
            yMm: bounds.minY,
            larguraMm: bounds.maxX - bounds.minX,
            alturaMm: bounds.maxY - bounds.minY,
            rotacaoGraus: rotation,
            bounds,
          };
        });
        const rawBounds = placements.length ? {
          minX: Math.min(...placements.map(item => item.bounds.minX)),
          maxX: Math.max(...placements.map(item => item.bounds.maxX)),
          minY: Math.min(...placements.map(item => item.bounds.minY)),
          maxY: Math.max(...placements.map(item => item.bounds.maxY)),
        } : null;
        const complete = data.status.complete === true &&
          data.status.placed === data.status.total && placements.length === data.status.total;
        const outputPlacements = rawBounds
          ? placements.map(({ bounds: _bounds, ...placement }) => ({
              ...placement,
              // Translate the whole layout, preserving relative positions, so
              // the leftmost cut starts at the physical sheet origin X=0.
              xMm: placement.xMm - rawBounds.minX,
            }))
          : [];
        const bounds = rawBounds ? {
          minX: 0,
          maxX: rawBounds.maxX - rawBounds.minX,
          minY: rawBounds.minY,
          maxY: rawBounds.maxY,
        } : null;
        const result = {
          completo: complete,
          quantidadePecas: data.status.total,
          quantidadePosicionada: data.status.placed,
          areaLiquidaMm2: geometries.reduce((sum, item) => sum + item.metrics.area, 0) * factor * factor,
          perimetroTotalMm: geometries.reduce((sum, item) => sum + item.metrics.perimeter, 0) * factor,
          placements: outputPlacements,
          bounds,
        };
        if (!Number.isFinite(result.areaLiquidaMm2) || result.areaLiquidaMm2 < 0 ||
          !Number.isFinite(result.perimetroTotalMm) || result.perimetroTotalMm < 0)
          throw new Error("O Deepnest retornou métricas não finitas.");

        if (complete) {
          if (!best || data.status.better) best = result;
          clearTimeout(finishTimer);
          finishTimer = setTimeout(() => finish(best), 1_500);
        }
      } catch (error) {
        finish({ error: errorText(error) }, 1);
      }
    };

    try {
      abort = await nest(pecas.map(peca => peca.svg), onUpdate, {
        bin: { width: input.larguraMm, height: input.alturaMm },
        units: "mm",
        scale: 72,
        timeout: input.timeoutMs,
        spacing: input.espacamentoMm,
        curveTolerance: 0.3,
        rotations: 72,
        populationSize: 10,
        mutationRate: 10,
        threads: 1,
        placementType: "gravity",
        mergeLines: false,
        timeRatio: 0,
        simplify: false,
      });
    } catch (error) {
      finish({ error: errorText(error) }, 1);
      return;
    }

    if (best && !settled) {
      clearTimeout(finishTimer);
      finishTimer = setTimeout(() => finish(best), 1_500);
    }
  });
}

main().catch(error => writeResult({ error: errorText(error) }, 1));
