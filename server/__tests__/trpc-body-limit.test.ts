import type { AddressInfo } from "net";
import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../_core/app";

/**
 * As imagens da biblioteca de mídias e do WhatsApp vão em base64 dentro da mutation do tRPC: o
 * navegador reduz o PNG para ≤ ~2,4 MB, o que dá ≈ 3,3 MB de JSON. Com o limite de 2 MB do
 * express.json, o servidor respondia uma página HTML de erro 413 e o navegador mostrava
 * "Unexpected token '<', "<!DOCTYPE "... is not valid JSON". Estes testes garantem que:
 *  - a rota /api/trpc aceita esse corpo (e responde JSON, no caso UNAUTHORIZED por não haver login);
 *  - o resto da API continua com o limite de 2 MB.
 */
let servidor: Server;
let base: string;

beforeAll(async () => {
  const app = await createApp();
  await new Promise<void>(ok => { servidor = app.listen(0, "127.0.0.1", ok); });
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise(ok => servidor.close(ok)); });

const corpoDe = (bytes: number) => JSON.stringify({ json: { nomeArquivo: "x.png", base64: "A".repeat(bytes) } });
const enviar = (caminho: string, corpo: string) =>
  fetch(base + caminho, { method: "POST", headers: { "content-type": "application/json" }, body: corpo });

describe("limite do corpo da requisição", () => {
  it("/api/trpc aceita ~3,3 MB (imagem em base64) e responde JSON — sem login, UNAUTHORIZED", async () => {
    const r = await enviar("/api/trpc/midiasBiblioteca.add", corpoDe(3_300_000));
    expect(r.headers.get("content-type")).toMatch(/application\/json/);
    expect(r.status).toBe(401);
  });

  it("/api/trpc ainda recusa o que passa do teto da Vercel (4,5 MB)", async () => {
    const r = await enviar("/api/trpc/midiasBiblioteca.add", corpoDe(4_600_000));
    expect(r.status).toBe(413);
  });

  it("o resto da API continua com o limite de 2 MB", async () => {
    const r = await enviar("/api/qualquer-outra-rota", corpoDe(2_500_000));
    expect(r.status).toBe(413);
  });
});
