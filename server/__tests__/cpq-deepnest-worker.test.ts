import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const workerPath = resolve(process.cwd(), "server/scripts/cpq-deepnest-worker.mjs");

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function writeFakeDeepnest(source: string) {
  const directory = await mkdtemp(join(tmpdir(), "cpq-deepnest-worker-"));
  temporaryDirectories.push(directory);
  const entry = join(directory, "fake-deepnest.mjs");
  await writeFile(entry, source, "utf8");
  return entry;
}

function executarWorker(entry: string, timeoutMs = 4_000) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [workerPath], {
      env: { ...process.env, DEEPNEST_NODE_ENTRY: entry },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", rejectPromise);
    child.on("close", code => resolvePromise({ code, stdout, stderr }));
    child.stdin.end(JSON.stringify({
      pecas: [{
        id: "teste",
        svg: '<svg viewBox="0 0 10 5"><path d="M0 0 L10 0 L10 5 L0 5 Z"/></svg>',
        larguraMm: 10,
        alturaMm: 5,
      }],
      larguraMm: 1_000,
      alturaMm: 500,
      espacamentoMm: 0,
      timeoutMs,
    }));
  });
}

describe("worker isolado do Deepnest", () => {
  it("translada o layout para X=0 e preserva métricas e dimensões", async () => {
    const entry = await writeFakeDeepnest(`
      export async function nest(_svgs, onUpdate) {
        const tree = Object.assign([
          { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 },
        ], { children: [] });
        onUpdate({
          elements: [{ polygontree: tree }],
          result: [{ id: 1, source: 0, x: 100, y: 50, rotation: 0 }],
          status: { complete: true, total: 1, placed: 1, better: true },
        });
        return async () => {};
      }
    `);
    const processo = await executarWorker(entry);
    const resultado = JSON.parse(processo.stdout);

    expect(processo.code).toBe(0);
    expect(resultado.completo).toBe(true);
    expect(resultado.bounds.minX).toBe(0);
    expect(resultado.placements[0].xMm).toBe(0);
    expect(resultado.bounds.maxX).toBeCloseTo(10 * 25.4 / 72);
    expect(resultado.areaLiquidaMm2).toBeCloseTo(50 * (25.4 / 72) ** 2);
    expect(resultado.perimetroTotalMm).toBeCloseTo(30 * 25.4 / 72);
  });

  it("converte contorno malformado em erro JSON sem deixar exceção escapar do processo", async () => {
    const entry = await writeFakeDeepnest(`
      export async function nest(_svgs, onUpdate) {
        const tree = Object.assign([], { children: [] });
        onUpdate({
          elements: [{ polygontree: tree }],
          result: [{ id: 1, source: 0, x: 0, y: 0, rotation: 0 }],
          status: { complete: true, total: 1, placed: 1, better: true },
        });
        return async () => {};
      }
    `);
    const processo = await executarWorker(entry);
    const resultado = JSON.parse(processo.stdout);

    expect(processo.code).toBe(1);
    expect(resultado.error).toContain("contorno ausente ou inválido");
  });

  it("retorna erro explícito se o motor expira sem produzir layout completo", async () => {
    const entry = await writeFakeDeepnest("export async function nest() { return async () => {}; }");
    const processo = await executarWorker(entry, 1_000);
    const resultado = JSON.parse(processo.stdout);

    expect(processo.code).toBe(1);
    expect(resultado.error).toContain("excedeu o tempo");
  });
});
