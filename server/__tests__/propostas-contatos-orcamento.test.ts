import { beforeEach, describe, expect, it, vi } from "vitest";

const buscarOrcamentoPorNumero = vi.fn();
vi.mock("../integrations/mubisys-client", async (importOriginal) => {
  const orig: any = await importOriginal();
  return { ...orig, buscarOrcamentoPorNumero: (n: string) => buscarOrcamentoPorNumero(n) };
});

// Banco falso: só o suficiente para getDbCache (select→limit) e setDbCache (select→insert/update)
let linhasCache: any[] = [];
const valoresInseridos: any[] = [];
function cadeia(rows: any[]) {
  const c: any = { from: () => c, where: () => c, orderBy: () => c, limit: async () => rows };
  return c;
}
const dbFalso = {
  select: vi.fn(),
  insert: vi.fn(() => ({ values: vi.fn(async (v: any) => { valoresInseridos.push(v); }) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => {}) })) })),
  delete: vi.fn(() => ({ where: vi.fn(async () => {}) })),
};
vi.mock("../db/db", () => ({ getDb: async () => dbFalso }));

import { obterContatosOrcamentos } from "../routers/performanceComercial";

/** Resposta no formato real de GET /orcamento/numero/{n} (campos relevantes) */
const orcamentoApi = (sequencial: number, id: number, celular: string, nome = "Fulano") => ({
  id,
  sequencial_orcamento: sequencial,
  cliente_contato: [{ nome_contato: nome, celular, status: "Ativo" }],
});

beforeEach(() => {
  buscarOrcamentoPorNumero.mockReset();
  valoresInseridos.length = 0;
  linhasCache = [];
  // 1ª chamada de select = leitura do cache; as seguintes = checagem de existência do setDbCache (sem linha)
  dbFalso.select.mockReset();
  dbFalso.select.mockImplementationOnce(() => cadeia(linhasCache)).mockImplementation(() => cadeia([]));
  dbFalso.insert.mockClear();
});

describe("obterContatosOrcamentos", () => {
  it("busca cada orçamento pelo número, extrai telefone/contato/id e grava uma única vez no banco", async () => {
    buscarOrcamentoPorNumero.mockImplementation(async (n: string) =>
      n === "28775" ? orcamentoApi(28775, 34709, "+556799571798", "Raniel") : orcamentoApi(28762, 34690, "+5516997538403", "JOSE"));

    const r = await obterContatosOrcamentos(9, 2026, ["28775", "28762"]);

    expect(r["28775"]).toEqual({ telefone: "+556799571798", contato: "Raniel", mubisysId: 34709 });
    expect(r["28762"]).toEqual({ telefone: "+5516997538403", contato: "JOSE", mubisysId: 34690 });
    expect(buscarOrcamentoPorNumero).toHaveBeenCalledTimes(2);
    expect(dbFalso.insert).toHaveBeenCalledTimes(1);
    expect(valoresInseridos[0].cacheKey).toBe("orc_contatos_9_2026");
    expect(JSON.parse(valoresInseridos[0].osData)[0]["28775"].mubisysId).toBe(34709);
  });

  it("não chama a API para orçamentos que já estão no cache do banco", async () => {
    const jaSalvo = { "28775": { telefone: "+556799571798", contato: "Raniel", mubisysId: 34709 } };
    // expiresAt no passado: o cache de contatos é lido ignorando expiração (telefone não muda)
    linhasCache = [{ osData: JSON.stringify([jaSalvo]), orcData: "[]", expiresAt: new Date(2020, 0, 1) }];

    const r = await obterContatosOrcamentos(9, 2026, ["28775"]);

    expect(r["28775"].mubisysId).toBe(34709);
    expect(buscarOrcamentoPorNumero).not.toHaveBeenCalled();
    expect(dbFalso.insert).not.toHaveBeenCalled();
  });

  it("descarta resposta de OUTRO orçamento (armadilha: /orcamento/28775 é id interno, não o número)", async () => {
    buscarOrcamentoPorNumero.mockResolvedValue(orcamentoApi(24827, 28775, "+551171369525", "Ariel"));

    const r = await obterContatosOrcamentos(9, 2026, ["28775"]);

    expect(r["28775"]).toBeUndefined();
    expect(dbFalso.insert).not.toHaveBeenCalled(); // nada novo para gravar
  });

  it("falha ou 404 de um orçamento não derruba os outros nem impede de gravar os que deram certo", async () => {
    buscarOrcamentoPorNumero.mockImplementation(async (n: string) => {
      if (n === "1") throw new Error("MubiSys inacessível");
      if (n === "2") return null;
      return orcamentoApi(3, 300, "+5567999990000");
    });

    const r = await obterContatosOrcamentos(9, 2026, ["1", "2", "3"]);

    expect(r["1"]).toBeUndefined();
    expect(r["2"]).toBeUndefined();
    expect(r["3"]?.telefone).toBe("+5567999990000");
    expect(dbFalso.insert).toHaveBeenCalledTimes(1);
  });

  it("orçamento sem telefone no ERP fica registrado (com id) para não ser buscado de novo", async () => {
    buscarOrcamentoPorNumero.mockResolvedValue({ id: 500, sequencial_orcamento: 7, cliente_contato: [] });

    const r = await obterContatosOrcamentos(9, 2026, ["7"]);

    expect(r["7"]).toEqual({ telefone: "", contato: "", mubisysId: 500 });
  });
});
