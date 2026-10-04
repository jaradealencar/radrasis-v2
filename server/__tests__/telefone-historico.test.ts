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
        [{ clienteId: 101 }, { clienteId: 102 }, { clienteId: 103 }], // IDs com telefone pendente
        [{ total: 1 }], // restante com ID (o cliente que falhou)
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

  it("orçamentos sem clienteId só são informados: não consultam a API, não viram falha, não ficam em 'restantes' e não impedem o fim", async () => {
    const mkDb = () => configurarDb({
      clientes: [],
      respostasSelect: [
        [{ total: 0 }], // total de clientes com ID
        [{ total: 2 }], // orçamentos sem clienteId
        [{ total: 0 }], // restante com ID
      ],
    });
    const erroLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const avisoLog = vi.spyOn(console, "warn").mockImplementation(() => {});

    mkDb();
    const resultado = await completarTelefonesClientesOrcamentos(1, 12);

    expect(buscarClientePorIdMock).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({
      consultados: 0, falhas: 0, semClienteVinculado: 2, falhasIds: [], restantes: 0,
      proximaPagina: null, fimAlcancado: true,
    });
    expect(erroLog).not.toHaveBeenCalled();
    expect(avisoLog).toHaveBeenCalledTimes(1);
    expect(avisoLog).toHaveBeenCalledWith(expect.stringContaining("2 orçamento(s) sem clienteId"));

    // Das páginas seguintes em diante o aviso não se repete (era um console.error por orçamento por página).
    mkDb();
    await completarTelefonesClientesOrcamentos(2, 12);
    expect(avisoLog).toHaveBeenCalledTimes(1);
    erroLog.mockRestore();
    avisoLog.mockRestore();
  });

  it("mistura: clientes com ID seguem a paginação própria e os órfãos não somam em 'restantes'", async () => {
    buscarClientePorIdMock.mockResolvedValue({ telefone_pri: "67933334444" });
    configurarDb({
      clientes: [{ clienteId: 301 }],
      respostasSelect: [
        [{ total: 1 }], // 1 cliente com ID
        [{ total: 5000 }], // 5000 órfãos
        [{ clienteId: 301 }], // pendente
        [{ total: 0 }], // nada restante com ID
      ],
    });
    const avisoLog = vi.spyOn(console, "warn").mockImplementation(() => {});

    const resultado = await completarTelefonesClientesOrcamentos(1, 12);

    expect(resultado).toMatchObject({ consultados: 1, comTelefone: 1, restantes: 0, semClienteVinculado: 5000, fimAlcancado: true, proximaPagina: null });
    avisoLog.mockRestore();
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
          clientes.map(({ clienteId }) => ({ clienteId })),
          [{ total: pagina === 1 ? 1 : 0 }],
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
