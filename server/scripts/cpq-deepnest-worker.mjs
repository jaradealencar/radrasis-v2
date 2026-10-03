import { pathToFileURL } from "node:url";

// Deepnest's native add-on documents Node 14-20 support. Run this isolated
// worker with that runtime instead of loading its native binary in Radrasys.
let stdoutWritten = false;
const writeResult = (value, code = 0) => {
  if (stdoutWritten) return;
  stdoutWritten = true;
  process.stdout.write(`${JSON.stringify(value)}\n`);
  process.exitCode = code;
};
console.log = (...args) =>
  process.stderr.write(`${args.map(String).join(" ")}\n`);
console.warn = (...args) =>
  process.stderr.write(`${args.map(String).join(" ")}\n`);

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

try {
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const entry = process.env.DEEPNEST_NODE_ENTRY;
  if (!entry) throw new Error("DEEPNEST_NODE_ENTRY não foi configurado.");
  const pecas = Array.isArray(input.pecas) && input.pecas.length
    ? input.pecas
    : [{ id: "peca-1", svg: input.svg }];
  if (pecas.length > 100 || pecas.some(peca => typeof peca?.svg !== "string" || !peca.svg)) {
    throw new Error("O worker recebeu uma lista de peças inválida.");
  }
  const { nest } = await import(pathToFileURL(entry).href);
  const factor = 25.4 / 72;
  const areaOf = points => {
    let twiceArea = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      twiceArea += a.x * b.y - b.x * a.y;
    }
    return Math.abs(twiceArea / 2);
  };
  const perimeterOf = points => {
    let length = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      length += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return length;
  };
  const visitContours = (
    tree,
    depth = 0,
    result = { area: 0, perimeter: 0 }
  ) => {
    if (!Array.isArray(tree) || tree.length < 3) return result;
    const area = areaOf(tree);
    result.area += depth % 2 === 0 ? area : -area;
    result.perimeter += perimeterOf(tree);
    for (const child of tree.children || [])
      visitContours(child, depth + 1, result);
    return result;
  };
  const metrics = tree => visitContours(tree);
  const rotatedBounds = (tree, degrees, x, y) => {
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const points = tree.map(point => ({
      x: point.x * cos - point.y * sin + x,
      y: point.x * sin + point.y * cos + y,
    }));
    return {
      minX: Math.min(...points.map(point => point.x)) * factor,
      maxX: Math.max(...points.map(point => point.x)) * factor,
      minY: Math.min(...points.map(point => point.y)) * factor,
      maxY: Math.max(...points.map(point => point.y)) * factor,
    };
  };

  let finishTimer;
  let hardTimer;
  let abort = async () => {};
  let best = null;
  let latestPartial = null;
  const finish = async result => {
    clearTimeout(finishTimer);
    clearTimeout(hardTimer);
    await abort().catch(() => {});
    writeResult(result);
  };

  abort = await nest(
    pecas.map(peca => peca.svg),
    data => {
      const geometries = data.elements.map((element, source) => {
        const tree = element.polygontree;
        return { source, tree, metrics: metrics(tree) };
      });
      const geometryBySource = new Map(
        geometries.map(geometry => [geometry.source, geometry])
      );
      const placements = data.result.map(placement => {
        const geometry = geometryBySource.get(placement.source);
        if (!geometry)
          throw new Error(
            `Deepnest retornou a peça ${placement.source} sem geometria de origem.`
          );
        const bounds = rotatedBounds(
          geometry.tree,
          placement.rotation || 0,
          placement.x || 0,
          placement.y || 0
        );
        return {
          id: placement.id,
          source: placement.source,
          xMm: bounds.minX,
          yMm: bounds.minY,
          larguraMm: bounds.maxX - bounds.minX,
          alturaMm: bounds.maxY - bounds.minY,
          rotacaoGraus: placement.rotation || 0,
          bounds,
        };
      });
      const bounds = placements.length
        ? {
            minX: Math.min(...placements.map(item => item.bounds.minX)),
            maxX: Math.max(...placements.map(item => item.bounds.maxX)),
            minY: Math.min(...placements.map(item => item.bounds.minY)),
            maxY: Math.max(...placements.map(item => item.bounds.maxY)),
          }
        : null;
      const result = {
        completo: data.status.complete,
        quantidadePecas: data.status.total,
        quantidadePosicionada: data.status.placed,
        areaLiquidaMm2:
          geometries.reduce((sum, item) => sum + item.metrics.area, 0) *
          factor *
          factor,
        perimetroTotalMm:
          geometries.reduce((sum, item) => sum + item.metrics.perimeter, 0) *
          factor,
        placements: placements.map(
          ({ bounds: _bounds, ...placement }) => placement
        ),
        bounds,
      };
      latestPartial = result;
      if (result.completo) {
        if (!best || data.status.better) best = result;
        clearTimeout(finishTimer);
        // Let a short optimization window improve the first feasible layout.
        finishTimer = setTimeout(() => {
          void finish(best);
        }, 1_500);
      }
    },
    {
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
    }
  );

  hardTimer = setTimeout(() => {
    void finish(
      best ||
        latestPartial || {
          completo: false,
          quantidadePecas: 0,
          quantidadePosicionada: 0,
          areaLiquidaMm2: 0,
          perimetroTotalMm: 0,
          placements: [],
          bounds: null,
        }
    );
  }, input.timeoutMs);
  if (best)
    finishTimer = setTimeout(() => {
      void finish(best);
    }, 1_500);
} catch (error) {
  writeResult(
    { error: error instanceof Error ? error.message : String(error) },
    1
  );
}
