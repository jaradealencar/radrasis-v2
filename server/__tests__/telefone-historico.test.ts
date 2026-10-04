import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock, buscarClientePorIdMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  buscarClientePorIdMock: vi.fn(),
}));

vi.mock("../db/db", () => ({ getDb: getDbMock }));
vi.mock("../integrations/mubisys-client", () => ({
  listarOSMubiSys: vi.fn(),
  listarOrcamentosMubiSys: vi.fn(),
  buscarClientePorId: buscarClientePorIdMock,
}));

import { completarTelefonesClientesOrcamentos } from "../sync/telefone-historico";

type DbResposta = unknown[];

function query(resposta: DbResposta) {
  const builder: any = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    offset: vi.fn(() => builder),
    then: (resolve: (value: DbResposta) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(resposta).then(resolve, reject),
  };
  return builder;
}

function configurarDb(args: {
  clientes: Array<{ clienteId: number }>;
  respostasSelect: DbResposta[];
  linhasAtualizadas?: number;
}) {
  const respostasSelect = [...args.respostasSelect];
  const db: any = {
    selectDistinctOn: vi.fn(() => query(args.clientes)),
    select: vi.fn(() => query(respostasSelect.shift() ?? [])),
    update: vi.fn(() => {
      const builder: any = {
        set: vi.fn(() => builder),
        where: vi.fn(() => builder),
        returning: vi.fn().mockResolvedValue(
          Array.from({ length: args.linhasAtualizadas ?? 1 }, (_, id) => ({ id })),
        ),
      };
      return builder;
    }),
  };
  getDbMock.mockResolvedValue(db);
  return db;
}

describe("backfill paginado de telefones dos orçamentos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isola timeout da API por cliente, contabiliza a falha e segue com o restante do lote", async () => {
    const erroTimeout = new Error("timeout MubiSys");
    buscarClientePorIdMock.mockImplementation(async (id: number) => {
      if (id === 102) throw erroTimeout;
      if (id === 103) return null;
      return { telefone_pri: "67911112222" };
    });
    configurarDb({
      clientes: [{ clienteId: 101 }, { clienteId: 102 }, { clienteId: 103 }],
      respostasSelect: [
        [{ total: 3 }], // total de clientes com ID
        [{ total: 0 }], // total sem clienteId
        [], // página de orçamentos corrompidos
        [{ clienteId: 101 }, { clienteId: 102 }, { clienteId: 103 }], // IDs com telefone pendente
        [{ total: 1 }], // restante com ID (o cliente que falhou)
        [{ total: 0 }], // restante sem ID
      ],
      linhasAtualizadas: 1,
    });
    const erroLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await completarTelefonesClientesOrcamentos(1, 12);

    expect(buscarClientePorIdMock).toHaveBeenCalledTimes(3);
    expect(resultado).toMatchObject({
      consultados: 3,
      comTelefone: 1,
      semTelefone: 1,
      falhas: 1,
      falhasIds: [102],
      atualizadas: 2,
      restantes: 1,
    });
    expect(erroLog).toHaveBeenCalledWith(expect.stringContaining("cliente 102"), erroTimeout);
    erroLog.mockRestore();
  });

  it("contabiliza e pula orçamentos corrompidos sem clienteId sem consultar a API", async () => {
    configurarDb({
      clientes: [],
      respostasSelect: [
        [{ total: 0 }], // total de clientes com ID
        [{ total: 2 }], // total sem clienteId
        [{ id: 9, orcNumero: null }, { id: 10, orcNumero: "ORC-10" }],
        [{ total: 0 }], // restante com ID
        [{ total: 2 }], // restante sem ID
      ],
    });
    const erroLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await completarTelefonesClientesOrcamentos(1, 12);

    expect(buscarClientePorIdMock).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({
      consultados: 0,
      falhas: 2,
      falhasSemClienteId: 2,
      falhasIds: [],
      restantes: 2,
    });
    expect(erroLog).toHaveBeenCalledTimes(2);
    expect(erroLog).toHaveBeenCalledWith(expect.stringContaining("Orçamento 9 sem clienteId;"));
    erroLog.mockRestore();
  });

  it("processa lote final parcial e sinaliza fim sem próxima página", async () => {
    const carregarPagina = (pagina: 1 | 2) => {
      const clientes = pagina === 1
        ? [{ clienteId: 201 }, { clienteId: 202 }]
        : [{ clienteId: 203 }];
      configurarDb({
        clientes,
        respostasSelect: [
          [{ total: 3 }], // total permanece estável nas páginas
          [{ total: 0 }],
          [],
          clientes.map(({ clienteId }) => ({ clienteId })),
          [{ total: pagina === 1 ? 1 : 0 }],
          [{ total: 0 }],
        ],
      });
      buscarClientePorIdMock.mockResolvedValue({ telefone_pri: "67922223333" });
    };

    carregarPagina(1);
    const primeira = await completarTelefonesClientesOrcamentos(1, 2);
    expect(primeira).toMatchObject({ pagina: 1, proximaPagina: 2, fimAlcancado: false });

    carregarPagina(2);
    const ultima = await completarTelefonesClientesOrcamentos(2, 2);
    expect(ultima.consultados).toBe(1); // menos registros que o limite de 2
    expect(ultima.proximaPagina).toBeNull();
    expect(ultima.fimAlcancado).toBe(true);
  });
});
