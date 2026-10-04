import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock, listarPaginaMock } = vi.hoisted(() => ({ getDbMock: vi.fn(), listarPaginaMock: vi.fn() }));
vi.mock("../db/db", () => ({ getDb: getDbMock }));
vi.mock("../integrations/mubisys-client", () => ({ listarClientesPagina: listarPaginaMock }));

import {
  completarTelefonesPeloCadastro, escolherTelefoneCliente, indexarTelefonesClientes, sincronizarClientesLote,
} from "../sync/clientes-mubisys";

describe("escolherTelefoneCliente", () => {
  it("prefere o celular de contato ativo e devolve normalizado", () => {
    expect(escolherTelefoneCliente({
      telefone_pri: "+556732221111",
      contatos: [{ status: "Inativo", celular: "+556799990000" }, { status: "Ativo", celular: "+5567984671066" }],
    })).toBe("5567984671066");
  });

  it("cai para telefone_pri/telefone_sec quando não há contato com número válido", () => {
    expect(escolherTelefoneCliente({ telefone_pri: "abc", telefone_sec: "(67) 99999-0000", contatos: [] })).toBe("5567999990000");
  });

  it("usa contato inativo só como último recurso e devolve null sem número válido", () => {
    expect(escolherTelefoneCliente({ contatos: [{ status: "Inativo", celular: "+556799990000" }] })).toBe("556799990000");
    expect(escolherTelefoneCliente({ telefone_pri: "(00) 00000-0000", contatos: [{ celular: "" }] })).toBeNull();
    expect(escolherTelefoneCliente({})).toBeNull();
    expect(escolherTelefoneCliente(null)).toBeNull();
  });
});

describe("completarTelefonesPeloCadastro", () => {
  const cadastro = indexarTelefonesClientes([
    { id: 1, nomeFantasia: "Gráfica Ágil", razaoSocial: "Ágil Ltda", telefone: "5567911110000" },
    { id: 2, nomeFantasia: "Outra", razaoSocial: null, telefone: "5567922220000" },
    { id: 3, nomeFantasia: "Gráfica Ágil", razaoSocial: null, telefone: "5567933330000" }, // nome repetido: vale o menor id
    { id: 4, nomeFantasia: "Sem Numero", razaoSocial: null, telefone: null },
  ]);

  it("completa por id (exato), senão por nome normalizado (fantasia ou razão), sem sobrescrever o que já existe", () => {
    const linhas = [
      { empresa: "qualquer", telefone: null, clienteId: 2 },
      { empresa: "GRAFICA AGIL", telefone: null },
      { empresa: "Ágil Ltda", telefone: "" },
      { empresa: "Gráfica Ágil", telefone: "5567900000000" },
    ];
    expect(completarTelefonesPeloCadastro(linhas, cadastro)).toBe(3);
    expect(linhas.map(l => l.telefone)).toEqual(["5567922220000", "5567911110000", "5567911110000", "5567900000000"]);
  });

  it("empresa desconhecida, vazia ou cliente sem número continuam sem telefone", () => {
    const linhas = [{ empresa: "Ninguém", telefone: null }, { empresa: "", telefone: null }, { empresa: "Sem Numero", telefone: null }, { empresa: null, telefone: null }];
    expect(completarTelefonesPeloCadastro(linhas, cadastro)).toBe(0);
    expect(linhas.every(l => l.telefone === null)).toBe(true);
  });
});

describe("sincronizarClientesLote", () => {
  let gravacoes: unknown[][];
  beforeEach(() => {
    vi.clearAllMocks();
    gravacoes = [];
    getDbMock.mockResolvedValue({
      insert: () => ({ values: (linhas: unknown[]) => { gravacoes.push(linhas); return { onConflictDoUpdate: async () => {} }; } }),
    });
  });
  const pagina = (n: number, ultima: number, ids: number[]) => ({
    pagination: { current_page: n, last_page: ultima, per_page: 100, total: 0 },
    data: ids.map(id => ({ id, nome_fantasia: `C${id}`, telefone_pri: id % 2 ? "+5567984671066" : "" })),
  });

  it("respeita o limite de páginas, devolve a próxima e conta clientes com telefone", async () => {
    listarPaginaMock.mockImplementation(async (n: number) => pagina(n, 5, [n * 10 + 1, n * 10 + 2]));
    const r = await sincronizarClientesLote(1, 2);
    expect(listarPaginaMock).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ paginasProcessadas: 2, ultimaPagina: 5, proximaPagina: 3, clientes: 4, comTelefone: 2 });
    expect(gravacoes).toHaveLength(2);
  });

  it("termina (proximaPagina null) ao alcançar a última página", async () => {
    listarPaginaMock.mockImplementation(async (n: number) => pagina(n, 3, [n]));
    const r = await sincronizarClientesLote(3, 20);
    expect(r).toMatchObject({ paginasProcessadas: 1, proximaPagina: null });
  });

  it("falha de API lança erro com a página e não deixa passar como lote completo", async () => {
    listarPaginaMock.mockImplementation(async (n: number) => {
      if (n === 2) throw new Error("timeout");
      return pagina(n, 5, [n]);
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sincronizarClientesLote(1, 5)).rejects.toThrow(/página 2/);
    expect(gravacoes).toHaveLength(1); // a página 1 já gravada continua valendo; a 2 não
    log.mockRestore();
  });

  it("ignora linhas sem id válido e rejeita página inicial inválida", async () => {
    listarPaginaMock.mockResolvedValue({ pagination: { current_page: 1, last_page: 1, per_page: 100, total: 2 }, data: [{ id: null }, { id: 7, telefone_pri: "" }] });
    const r = await sincronizarClientesLote(1, 5);
    expect(r.clientes).toBe(1);
    await expect(sincronizarClientesLote(0)).rejects.toThrow(/inteiro positivo/);
  });
});
