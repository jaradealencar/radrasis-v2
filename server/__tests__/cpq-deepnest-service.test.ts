import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { calcularNestingMultiMaterial } from "../services/cpqNesting";

const servicoPath = resolve(process.cwd(), "server/scripts/cpq-deepnest-service.mjs");
const TOKEN = "segredo-de-teste-123456";

const pecas = [{
  id: "p1",
  svg: '<svg viewBox="0 0 10 5"><path d="M0 0 L10 0 L10 5 L0 5 Z"/></svg>',
  larguraMm: 10,
  alturaMm: 5,
}];
const material = {
  id: 7,
  nome: "Chapa remota",
  custoUnitario: 50,
  unidadeCusto: "m2",
  chapas: [{ id: 1, mubisysMateriaPrimaId: 7, nome: "1000x500", larguraMm: 1000, alturaMm: 500 }],
};

function portaLivre(): Promise<number> {
  return new Promise((ok, falha) => {
    const servidor = createServer();
    servidor.listen(0, "127.0.0.1", () => {
      const { port } = servidor.address() as { port: number };
      servidor.close(() => ok(port));
    });
    servidor.on("error", falha);
  });
}

let pasta = "";
let filho: ChildProcess | null = null;
let porta = 0;

beforeAll(async () => {
  pasta = await mkdtemp(join(tmpdir(), "cpq-deepnest-servico-"));
  const entry = join(pasta, "deepnest-falso.mjs");
  // Motor falso: devolve a peça 10×5 (unidades de 1/72") posicionada, só para exercitar o caminho remoto.
  await writeFile(entry, `
    export async function nest(_svgs, onUpdate) {
      const tree = Object.assign([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }], { children: [] });
      onUpdate({
        elements: [{ polygontree: tree }],
        result: [{ id: 1, source: 0, x: 0, y: 0, rotation: 0 }],
        status: { complete: true, total: 1, placed: 1, better: true },
      });
      return async () => {};
    }
  `, "utf8");
  porta = await portaLivre();
  filho = spawn(process.execPath, [servicoPath], {
    env: { ...process.env, DEEPNEST_SERVICE_TOKEN: TOKEN, DEEPNEST_NODE_ENTRY: entry, DEEPNEST_SERVICE_PORT: String(porta), DEEPNEST_SERVICE_HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((ok, falha) => {
    const limite = setTimeout(() => falha(new Error("serviço não subiu")), 8_000);
    filho!.stdout!.on("data", () => { clearTimeout(limite); ok(); });
    filho!.on("error", falha);
  });
});

afterAll(async () => {
  filho?.kill();
  if (pasta) await rm(pasta, { recursive: true, force: true });
});

afterEach(() => vi.unstubAllEnvs());

describe("serviço Deepnest remoto", () => {
  it("responde /health e exige o token em /nesting", async () => {
    const saude = await fetch(`http://127.0.0.1:${porta}/health`);
    expect(await saude.json()).toEqual({ ok: true });
    const semToken = await fetch(`http://127.0.0.1:${porta}/nesting`, { method: "POST", body: "{}" });
    expect(semToken.status).toBe(401);
  });

  it("o app usa o serviço remoto quando DEEPNEST_REMOTE_URL está configurada", async () => {
    vi.stubEnv("DEEPNEST_REMOTE_URL", `http://127.0.0.1:${porta}/`);
    vi.stubEnv("DEEPNEST_REMOTE_TOKEN", TOKEN);
    const [resultado] = await calcularNestingMultiMaterial({ pecas, materiais: [material] });
    expect(resultado.motor).toBe("deepnest");
    expect(resultado.posicionamentos).toHaveLength(1);
    expect(resultado.area_liquida_m2).toBeGreaterThan(0);
  });

  it("com o token errado o serviço recusa e o app cai no motor interno, sem travar", async () => {
    vi.stubEnv("DEEPNEST_REMOTE_URL", `http://127.0.0.1:${porta}`);
    vi.stubEnv("DEEPNEST_REMOTE_TOKEN", "token-errado-000000");
    const [resultado] = await calcularNestingMultiMaterial({ pecas, materiais: [material] });
    expect(resultado.motor).toBe("interno");
    expect(resultado.posicionamentos).toHaveLength(1);
  });

  it("com o serviço fora do ar o app cai no motor interno", async () => {
    vi.stubEnv("DEEPNEST_REMOTE_URL", `http://127.0.0.1:${await portaLivre()}`);
    vi.stubEnv("DEEPNEST_REMOTE_TOKEN", TOKEN);
    const [resultado] = await calcularNestingMultiMaterial({ pecas, materiais: [material] });
    expect(resultado.motor).toBe("interno");
  });
});
