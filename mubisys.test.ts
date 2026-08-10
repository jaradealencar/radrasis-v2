import { describe, expect, it } from "vitest";

describe("MubiSys API credentials", () => {
  it("should have MUBISYS_ACCESS_TOKEN configured", () => {
    const token = process.env.MUBISYS_ACCESS_TOKEN;
    expect(token).toBeTruthy();
    expect(token?.length).toBeGreaterThan(10);
  });

  it("should have MUBISYS_PUBLIC_KEY configured", () => {
    const key = process.env.MUBISYS_PUBLIC_KEY;
    expect(key).toBeTruthy();
    expect(key?.length).toBeGreaterThan(5);
  });

  it("should successfully connect to MubiSys API", async () => {
    const token = process.env.MUBISYS_ACCESS_TOKEN;
    const publicKey = process.env.MUBISYS_PUBLIC_KEY;

    if (!token || !publicKey) {
      console.warn("Skipping API test: credentials not set");
      return;
    }

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split("T")[0];
    const end = today.toISOString().split("T")[0];

    // A API do ERP é externa e pode ficar lenta. Nesse caso o teste não deve
    // falhar, pois indicaria indisponibilidade do ERP e não regressão no código.
    const controller = new AbortController();
    const limite = setTimeout(() => controller.abort(), 20000);
    let response: Response;
    try {
      response = await fetch(
        `https://api.mubisys.com/api/${publicKey}/ordem-servico?status=TODOS&filtrodata=CADASTRO&datainicial=${start}&datafinal=${end}`,
        { headers: { "Access-Token": token }, signal: controller.signal }
      );
    } catch (erro: any) {
      console.warn(`MubiSys indisponível ou lento (${erro?.name ?? "erro"}) — teste de conexão ignorado`);
      return;
    } finally {
      clearTimeout(limite);
    }

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty("data");
    expect(Array.isArray(data.data)).toBe(true);
    console.log(`✅ MubiSys conectado: ${data.pagination?.total ?? data.data.length} OSs encontradas`);
  }, 40000);
});
