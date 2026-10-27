import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const { session } = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("../_core/auth", () => ({ auth: { api: { getSession: session } } }));
import { registrarRotasNestingArte } from "../routes/cpq-nesting-arte";

let server: Server;
let url: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  registrarRotasNestingArte(app);
  server = await new Promise<Server>(resolve => {
    const running = app.listen(0, "127.0.0.1", () => resolve(running));
  });
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});
beforeEach(() => session.mockResolvedValue({ user: { id: "usuario-teste" } }));

it("exige sessão e recusa origem externa antes de processar a geometria", async () => {
  session.mockResolvedValue(null);
  expect(
    (
      await fetch(`${url}/api/letra-caixa/nesting-arte/preparar`, {
        method: "POST",
      })
    ).status
  ).toBe(401);
  session.mockResolvedValue({ user: { id: "usuario-teste" } });
  expect(
    (
      await fetch(`${url}/api/letra-caixa/nesting-arte/preparar`, {
        method: "POST",
        headers: { Origin: "https://fora.invalid" },
      })
    ).status
  ).toBe(403);
});

it("recusa escala inválida e prepara geometrias sem gravar no banco", async () => {
  const payload = {
    svg: '<svg viewBox="0 0 10 10"><path fill="#000000" d="M0 0H10V10H0Z"/></svg>',
    larguraMm: 100,
    alturaMm: 100,
  };
  const send = (dados: unknown) =>
    fetch(`${url}/api/letra-caixa/nesting-arte/preparar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: url },
      body: JSON.stringify(dados),
    });
  expect((await send({ ...payload, larguraMm: 0 })).status).toBe(400);
  expect(
    (
      await send({
        ...payload,
        svg: payload.svg.replace("<path ", '<path transform="scale(2)" '),
      })
    ).status
  ).toBe(422);
  expect(
    (
      await send({
        ...payload,
        svg: payload.svg.replace("</svg>", "<script>alert(1)</script></svg>"),
      })
    ).status
  ).toBe(422);
  const resposta = await send(payload);
  expect(resposta.status).toBe(200);
  expect(resposta.headers.get("cache-control")).toBe("private, no-store");
  expect((await resposta.json()).pecas).toHaveLength(1);
});
