import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizarData } from "../utils/date-utils";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resposta real de GET /ordem-servico/numero/6917 (17/08/2026), com CNPJ e
 * nome do cliente anonimizados — estrutura preservada. Ver docs/integracao-mubisys.md §1.
 */
const fixtureOs6917 = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/mubisys-os-6917.json"), "utf-8"),
);

vi.mock("../db/db-connection", () => ({
  selectQuery: vi.fn().mockResolvedValue([]),
  mutationQuery: vi.fn().mockResolvedValue(undefined),
  getPool: vi.fn(),
}));

// As camadas offline não fazem rede de verdade (fetch é mockado), então um
// valor qualquer de credencial serve. Mocar `ENV` em vez de `process.env`
// direto mantém a leitura de credencial centralizada em `_core/env.ts` fora
// de teste (ver regra de ouro #3 da sprint) — preserva o `.env` real quando
// existir, para não atrapalhar o teste de contrato (camada 2, rodado com
// MUBISYS_TESTE_CONTRATO=1).
vi.mock("../_core/env", async (importOriginal) => {
  const real = await importOriginal<typeof import("../_core/env")>();
  return {
    ENV: {
      ...real.ENV,
      MUBISYS_ACCESS_TOKEN: real.ENV.MUBISYS_ACCESS_TOKEN || "token-de-teste-0123456789",
      MUBISYS_PUBLIC_KEY: real.ENV.MUBISYS_PUBLIC_KEY || "tenant-de-teste",
    },
  };
});

const { listarOSMubiSys, buscarOSPorNumero } = await import("../integrations/mubisys-client");
const { buscarDadosOSParaFrete } = await import("../integrations/mubisys-frete");
const { selectQuery } = await import("../db/db-connection");

function respostaJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ─── Camada 1: mapeamento offline (sempre roda, sem rede) ────────────────────

describe("mubisys-client — paginação e erros (offline, fetch mockado)", () => {
  it("envelope de lista com last_page:3 percorre as 3 páginas (A2/A3)", async () => {
    const paginas: Record<number, unknown> = {
      1: { pagination: { current_page: 1, last_page: 3, per_page: 2, total: 6 }, data: [{ id: 1 }, { id: 2 }] },
      2: { pagination: { current_page: 2, last_page: 3, per_page: 2, total: 6 }, data: [{ id: 3 }, { id: 4 }] },
      3: { pagination: { current_page: 3, last_page: 3, per_page: 2, total: 6 }, data: [{ id: 5 }, { id: 6 }] },
    };
    const fetchMock = vi.fn(async (url: string | URL) => {
      const pagina = Number(new URL(url).searchParams.get("page"));
      return respostaJson(paginas[pagina], 201);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { itens, completo } = await listarOSMubiSys({ datainicial: "2026-08-01", datafinal: "2026-08-31" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(completo).toBe(true);
    expect(itens.map((i: any) => i.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("resposta 404 vira null, não exceção (A8)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respostaJson({ error: "Não encontrado" }, 404)));

    await expect(buscarOSPorNumero("999999")).resolves.toBeNull();
  });
});

describe("mubisys-frete — mapeamento de campos da OS (offline, fetch e DB mockados)", () => {
  beforeEach(() => {
    vi.mocked(selectQuery).mockResolvedValue([]); // cache local vazio → força o caminho da API
  });

  it("CNPJ vem de cliente_cnpj_cpf, não de regex sobre o nome do cliente (A1)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respostaJson(fixtureOs6917, 201)));

    const dados = await buscarDadosOSParaFrete("6917");

    expect(dados?.clienteCnpj).toBe(fixtureOs6917.cliente_cnpj_cpf);
  });

  it("endereço vem de cliente_endereco[0], mesmo com cliente_id de outra tabela (A1 pela porta dos fundos)", async () => {
    // O fixture tem cliente_id (2931) ≠ cliente_endereco[0].id (2924) de propósito:
    // são chaves de tabelas diferentes (ver docs/integracao-mubisys.md §1). O
    // mapeamento de frete não faz lookup nenhum por id — usa os campos que já
    // vêm na própria OS.
    expect(fixtureOs6917.cliente_id).not.toBe(fixtureOs6917.cliente_endereco[0].id);

    vi.stubGlobal("fetch", vi.fn(async () => respostaJson(fixtureOs6917, 201)));

    const dados = await buscarDadosOSParaFrete("6917");

    const endereco = fixtureOs6917.cliente_endereco[0];
    expect(dados?.municipio).toBe(endereco.cidade);
    expect(dados?.estado).toBe(endereco.estado);
    expect(dados?.cep).toBe(endereco.cep);
  });
});

describe("normalizarData — contrato da coluna `date` (offline)", () => {
  it("aceita dd/mm/aaaa", () => {
    expect(normalizarData("05/08/2026")).toBe("2026-08-05");
  });

  it("aceita ISO (com ou sem horário)", () => {
    expect(normalizarData("2026-08-05")).toBe("2026-08-05");
    expect(normalizarData("2026-08-05 08:38:30")).toBe("2026-08-05");
  });

  it("devolve null para texto livre — o `prazo` da OS nunca vira data (A5)", () => {
    expect(normalizarData(fixtureOs6917.prazo)).toBeNull(); // "02 dias úteis"
    expect(normalizarData("10 DIAS ÚTEIS")).toBeNull();
  });

  it("devolve null para vazio/ausente", () => {
    expect(normalizarData("")).toBeNull();
    expect(normalizarData(null)).toBeNull();
    expect(normalizarData(undefined)).toBeNull();
  });
});

// ─── Camada 2: teste de contrato (rede real, pulado por padrão) ──────────────

const rodarContrato = process.env.MUBISYS_TESTE_CONTRATO === "1";

describe.skipIf(!rodarContrato)("contrato da API MubiSys (rede)", () => {
  it("busca por número devolve a OS com os campos documentados", async () => {
    vi.unstubAllGlobals(); // usa o fetch real, não o mock das camadas acima
    const os = await buscarOSPorNumero("6917");
    expect(os?.cliente_cnpj_cpf).toBeTruthy();
    expect(os?.cliente_id).toBeTypeOf("number");
  }, 30_000);

  it("OS inexistente devolve null", async () => {
    vi.unstubAllGlobals();
    expect(await buscarOSPorNumero("999999")).toBeNull();
  }, 30_000);
});
