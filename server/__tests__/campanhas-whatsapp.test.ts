import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calcularProximoEnvio, classificarSemaforo, dataIsoValida, diasEntre, formatarTelefone, hojeCampoGrande,
  formatarDataBr, normalizarTelefone, somarDias,
} from "../../shared/campanhas-whatsapp";
import {
  expandirPrevistos, higienizarLista, listarVendasPosVenda, montarStatusCampanha, resumirCampanhas, resumirVendas,
  type LinhaVenda,
} from "../services/campanhasWhatsapp";
import { checkQuarantineBodySchema, exigirChaveApi, logSendBodySchema } from "../routes/campanhas-whatsapp-api";

describe("normalizarTelefone", () => {
  it("normaliza máscara, +55, zero de tronco e número puro", () => {
    expect(normalizarTelefone("(67) 99999-0000")).toBe("5567999990000");
    expect(normalizarTelefone("+55 67 99999-0000")).toBe("5567999990000");
    expect(normalizarTelefone("067999990000")).toBe("5567999990000");
    expect(normalizarTelefone(67999990000)).toBe("5567999990000");
    expect(normalizarTelefone("(67) 3333-1234")).toBe("556733331234");
  });

  it("distingue DDD 55 (RS) do DDI 55 pelo comprimento", () => {
    expect(normalizarTelefone("(55) 99999-0000")).toBe("5555999990000");
    expect(normalizarTelefone("55 55 99999-0000")).toBe("5555999990000");
  });

  it("rejeita o que não parece telefone brasileiro", () => {
    for (const ruim of ["", "   ", "abc", "12345", "(67) 999-000", "(00) 99999-0000", "+1 415 555 2671", null, undefined]) {
      expect(normalizarTelefone(ruim)).toBeNull();
    }
  });

  it("formatarTelefone só para exibição", () => {
    expect(formatarTelefone("5567999990000")).toBe("(67) 99999-0000");
    expect(formatarTelefone("556733331234")).toBe("(67) 3333-1234");
  });
});

describe("datas", () => {
  it("dataIsoValida rejeita datas impossíveis e formato errado", () => {
    expect(dataIsoValida("2026-02-28")).toBe(true);
    expect(dataIsoValida("2028-02-29")).toBe(true);
    expect(dataIsoValida("2026-02-30")).toBe(false);
    expect(dataIsoValida("26-09-2026")).toBe(false);
    expect(dataIsoValida(20260926)).toBe(false);
  });

  it("somarDias atravessa mês, ano e ano bissexto", () => {
    expect(somarDias("2026-01-31", 30)).toBe("2026-03-02");
    expect(somarDias("2028-02-28", 1)).toBe("2028-02-29");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2026-09-26", -26)).toBe("2026-08-31");
  });

  it("diasEntre é assinado", () => {
    expect(diasEntre("2026-09-01", "2026-09-30")).toBe(29);
    expect(diasEntre("2026-09-30", "2026-09-01")).toBe(-29);
    expect(diasEntre("2026-09-26", "2026-09-26")).toBe(0);
  });

  it("próximo envio = último envio + frequência", () => {
    expect(calcularProximoEnvio("2026-09-26", 15)).toBe("2026-10-11");
    expect(calcularProximoEnvio("2026-12-20", 30)).toBe("2027-01-19");
  });

  it("formatarDataBr não desloca o dia (sem passar por Date/UTC)", () => {
    expect(formatarDataBr("2026-09-26")).toBe("26/09/2026");
    expect(formatarDataBr("2026-01-01")).toBe("01/01/2026");
    expect(formatarDataBr("2026-09-26T03:00:00.000Z")).toBe("26/09/2026");
    expect(formatarDataBr(null)).toBe("—");
    expect(formatarDataBr("lixo")).toBe("—");
  });

  it("hojeCampoGrande usa o calendário de Campo Grande (UTC-4), não o do servidor", () => {
    expect(hojeCampoGrande(new Date("2026-09-27T02:00:00Z"))).toBe("2026-09-26"); // 22h locais
    expect(hojeCampoGrande(new Date("2026-09-26T04:00:00Z"))).toBe("2026-09-26"); // 00h locais
    expect(hojeCampoGrande(new Date("2026-09-26T03:59:59Z"))).toBe("2026-09-25");
  });
});

describe("classificarSemaforo (hoje = 2026-09-26)", () => {
  const hoje = "2026-09-26";
  it.each([
    ["2026-09-10", "vermelho"], // atrasada
    ["2026-09-26", "vermelho"], // dispara hoje
    ["2026-09-27", "amarelo"],
    ["2026-09-29", "amarelo"], // exatamente 3 dias
    ["2026-09-30", "verde"], // 4 dias
    ["2026-12-01", "verde"],
  ])("prazo %s → %s", (proxima, esperado) => {
    expect(classificarSemaforo(proxima, hoje)).toBe(esperado);
  });
});

describe("higienizarLista", () => {
  const envio = "2026-09-26";
  const quarentena = new Map([
    ["5567990000001", "2026-09-10"], // 16 dias atrás
    ["5567990000002", "2026-08-27"], // exatamente 30 dias
    ["5567990000003", "2026-08-28"], // 29 dias
    ["5567990000004", "2026-09-28"], // 2 dias DEPOIS (registro retroativo)
  ]);

  it("ignora quem está dentro do período e libera quem já completou os dias", () => {
    const r = higienizarLista([
      { telefone: "(67) 99000-0001", nome: "Ana" },
      { telefone: "(67) 99000-0002", nome: "Bia" },
      { telefone: "(67) 99000-0003", nome: "Caio" },
      { telefone: "(67) 99000-0004", nome: "Duda" },
      { telefone: "(67) 99000-0005", nome: "Edu" },
    ], quarentena, envio, 30);

    expect(r.enviar.map(c => c.nome)).toEqual(["Bia", "Edu"]);
    expect(r.ignoradosQuarentena.map(c => c.nome)).toEqual(["Ana", "Caio", "Duda"]);
    expect(r.ignoradosQuarentena[0]).toMatchObject({ ultimoContatoEm: "2026-09-10", disponivelEm: "2026-10-10" });
  });

  it("quarentenaDias = 0 desliga a trava", () => {
    const r = higienizarLista([{ telefone: "67990000001" }], quarentena, envio, 0);
    expect(r.enviar).toHaveLength(1);
    expect(r.ignoradosQuarentena).toHaveLength(0);
  });

  it("separa inválidos e duplicados, e a conta fecha", () => {
    const contatos = [
      { telefone: "(67) 99000-0005", nome: "Edu" },
      { telefone: "67 990000005", nome: "Edu de novo" },
      { telefone: "123", nome: "Lixo" },
      { telefone: "", nome: "Vazio" },
      { telefone: "(67) 99000-0001", nome: "Ana" },
    ];
    const r = higienizarLista(contatos, quarentena, envio, 30);
    expect(r.enviar).toHaveLength(1);
    expect(r.ignoradosQuarentena).toHaveLength(1);
    expect(r.invalidos.map(i => i.motivo)).toEqual(["duplicado", "telefone_invalido", "telefone_invalido"]);
    expect(r.enviar.length + r.ignoradosQuarentena.length + r.invalidos.length).toBe(contatos.length);
  });

  it("soma as OS do telefone repetido ao contato mantido (a venda extra não fica pendente para sempre)", () => {
    const r = higienizarLista([
      { telefone: "67990000005", nome: "Edu", osNumero: "100" },
      { telefone: "(67) 99000-0005", nome: "Edu", osNumero: "101" },
      { telefone: "(67) 99000-0005", nome: "Edu", osNumero: "100" },
    ], new Map(), envio, 30);
    expect(r.enviar).toHaveLength(1);
    expect(r.enviar[0].osNumeros).toEqual(["100", "101"]);
    expect(r.invalidos).toHaveLength(2);
  });

  it("OS de contato ignorado por quarentena não vai para a lista de enviados", () => {
    const r = higienizarLista([{ telefone: "67990000001", osNumero: "200" }], quarentena, envio, 30);
    expect(r.enviar).toHaveLength(0);
    expect(r.ignoradosQuarentena).toHaveLength(1);
  });
});

describe("listarVendasPosVenda (hoje = 2026-09-26, frequência 30)", () => {
  const hoje = "2026-09-26";
  const venda = (osNumero: string | null, dataFaturamento: string | null, extra: Partial<LinhaVenda> = {}): LinhaVenda => ({
    osNumero, dataFaturamento, empresa: `Empresa ${osNumero}`, telefone: "(67) 99999-0000", vendedor: "Ana", valorOs: "1500.50", ...extra,
  });
  const linhas = [
    venda("A", "28/08/2026"), // prazo 27/09 → ainda vai vencer
    venda("B", "2026-08-20 14:30:00"), // prazo 19/09 → 7 dias de atraso (formato ISO com hora)
    venda("C", "26/08/2026 09:15"), // prazo 25/09 → 1 dia de atraso (dd/mm/aaaa com hora)
    venda("D", "01/08/2026"), // já contatada
    venda("E", "24/08/2026", { telefone: null }), // vencida, sem telefone
    venda("F", "30/09/2026"), // faturamento no futuro = erro de cadastro
    venda("G", null),
    venda(" ", "01/08/2026"),
    venda("H", "lixo"),
  ];

  it("separa vencidas de a vencer, aceita os dois formatos de data e ordena do prazo mais antigo", () => {
    const { pendentes, proximas } = listarVendasPosVenda(linhas, { frequenciaDias: 30, gatilhoAPartirDe: null }, hoje, new Set(["D"]));
    expect(pendentes.map(v => [v.osNumero, v.prazo, v.diasAtraso])).toEqual([
      ["B", "2026-09-19", 7], ["E", "2026-09-23", 3], ["C", "2026-09-25", 1],
    ]);
    expect(proximas.map(v => [v.osNumero, v.prazo, v.diasAtraso])).toEqual([["A", "2026-09-27", -1]]);
    expect(pendentes.find(v => v.osNumero === "E")!.telefone).toBeNull();
    expect(pendentes[0]).toMatchObject({ telefone: "5567999990000", valor: 1500.5, empresa: "Empresa B" });
  });

  it("gatilhoAPartirDe descarta vendas faturadas antes da data", () => {
    const { pendentes } = listarVendasPosVenda(linhas, { frequenciaDias: 30, gatilhoAPartirDe: "2026-08-21" }, hoje, new Set());
    expect(pendentes.map(v => v.osNumero)).toEqual(["E", "C"]);
  });

  it("resumirVendas: prazo mais próximo é o da pendente mais atrasada; sem pendentes, o da próxima", () => {
    const com = listarVendasPosVenda(linhas, { frequenciaDias: 30, gatilhoAPartirDe: null }, hoje, new Set());
    expect(resumirVendas(com)).toEqual({ pendentes: 4, prazoMaisProximo: "2026-08-31" });
    const sem = listarVendasPosVenda([venda("A", "28/08/2026")], { frequenciaDias: 30, gatilhoAPartirDe: null }, hoje, new Set());
    expect(resumirVendas(sem)).toEqual({ pendentes: 0, prazoMaisProximo: "2026-09-27" });
    expect(resumirVendas({ pendentes: [], proximas: [] })).toEqual({ pendentes: 0, prazoMaisProximo: null });
  });
});

describe("montarStatusCampanha (hoje = 2026-09-26)", () => {
  const hoje = "2026-09-26";
  const recorrente = { tipo: "recorrente", status: "ativa", frequenciaDias: 15, criadaEm: "2026-09-01" } as const;

  it("recorrente: último envio + frequência", () => {
    expect(montarStatusCampanha(recorrente, "2026-09-10", hoje)).toMatchObject({ proximoEnvio: "2026-09-25", semaforo: "vermelho" });
    expect(montarStatusCampanha(recorrente, "2026-09-20", hoje)).toMatchObject({ proximoEnvio: "2026-10-05", semaforo: "verde" });
    expect(montarStatusCampanha(recorrente, "2026-09-14", hoje)).toMatchObject({ proximoEnvio: "2026-09-29", semaforo: "amarelo" });
  });

  it("editar a frequência muda o próximo envio na hora", () => {
    expect(montarStatusCampanha({ ...recorrente, frequenciaDias: 60 }, "2026-09-10", hoje))
      .toMatchObject({ proximoEnvio: "2026-11-09", semaforo: "verde" });
  });

  it("recorrente nunca disparada nasce vermelha, com prazo na data de criação", () => {
    expect(montarStatusCampanha(recorrente, null, hoje))
      .toMatchObject({ proximoEnvio: "2026-09-01", semaforo: "vermelho", primeiroDisparoPendente: true });
  });

  it("pausada/arquivada não tem semáforo nem próximo envio", () => {
    expect(montarStatusCampanha({ ...recorrente, status: "pausada" }, "2026-09-10", hoje))
      .toEqual({ semaforo: null, ultimoEnvio: "2026-09-10", proximoEnvio: null, primeiroDisparoPendente: false });
  });

  it("gatilho: vermelho com vendas vencidas; senão semáforo do menor prazo futuro; sem vendas, verde", () => {
    const gatilho = { tipo: "gatilho_venda", status: "ativa", frequenciaDias: 30, criadaEm: "2026-09-01" } as const;
    expect(montarStatusCampanha(gatilho, null, hoje, { pendentes: 2, prazoMaisProximo: "2026-09-19" }))
      .toMatchObject({ semaforo: "vermelho", proximoEnvio: "2026-09-19" });
    expect(montarStatusCampanha(gatilho, null, hoje, { pendentes: 0, prazoMaisProximo: "2026-09-28" }))
      .toMatchObject({ semaforo: "amarelo", proximoEnvio: "2026-09-28" });
    expect(montarStatusCampanha(gatilho, null, hoje, { pendentes: 0, prazoMaisProximo: null }))
      .toMatchObject({ semaforo: "verde", proximoEnvio: null });
  });

  it("resumirCampanhas conta ativas, vermelhas e as que vencem entre amanhã e +7 dias", () => {
    const r = resumirCampanhas([
      { status: "ativa", semaforo: "vermelho", proximoEnvio: "2026-09-20" },
      { status: "ativa", semaforo: "vermelho", proximoEnvio: "2026-09-26" },
      { status: "ativa", semaforo: "amarelo", proximoEnvio: "2026-09-28" },
      { status: "ativa", semaforo: "verde", proximoEnvio: "2026-10-03" }, // +7 → entra
      { status: "ativa", semaforo: "verde", proximoEnvio: "2026-10-04" }, // +8 → fora
      { status: "ativa", semaforo: "verde", proximoEnvio: null },
      { status: "pausada", semaforo: null, proximoEnvio: null },
    ], hoje);
    expect(r).toEqual({ ativas: 6, pendentesHoje: 2, daSemana: 2 });
  });
});

describe("expandirPrevistos", () => {
  it("projeta a cadeia dentro do intervalo", () => {
    expect(expandirPrevistos("2026-09-30", 15, "2026-09-26", "2026-09-01", "2026-11-15"))
      .toEqual(["2026-09-30", "2026-10-15", "2026-10-30", "2026-11-14"]);
  });

  it("prazo vencido: mantém a data vencida e recomeça a cadeia de hoje", () => {
    expect(expandirPrevistos("2026-09-20", 15, "2026-09-26", "2026-09-01", "2026-10-31"))
      .toEqual(["2026-09-20", "2026-10-11", "2026-10-26"]);
  });

  it("respeita o início do intervalo e ignora frequência inválida", () => {
    expect(expandirPrevistos("2026-09-30", 15, "2026-09-26", "2026-10-10", "2026-10-31")).toEqual(["2026-10-15", "2026-10-30"]);
    expect(expandirPrevistos("2026-09-30", 0, "2026-09-26", "2026-09-01", "2026-10-31")).toEqual([]);
  });
});

describe("webhooks REST — autenticação e validação", () => {
  const resFalso = () => {
    const res: any = { statusCode: 0, body: undefined };
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (b: unknown) => { res.body = b; return res; };
    return res;
  };
  const chamar = (headers: Record<string, string>) => {
    const res = resFalso();
    const next = vi.fn();
    exigirChaveApi({ headers } as any, res, next);
    return { res, next };
  };
  let original: string | undefined;
  beforeEach(() => { original = process.env.CAMPANHAS_API_KEY; });
  afterEach(() => {
    if (original === undefined) delete process.env.CAMPANHAS_API_KEY; else process.env.CAMPANHAS_API_KEY = original;
  });

  it("503 quando CAMPANHAS_API_KEY não está configurada (nunca fica aberto)", () => {
    delete process.env.CAMPANHAS_API_KEY;
    const { res, next } = chamar({ authorization: "Bearer qualquer" });
    expect(res.statusCode).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("401 sem chave ou com chave errada", () => {
    process.env.CAMPANHAS_API_KEY = "segredo-de-teste";
    for (const headers of [{}, { authorization: "Bearer errada" }, { authorization: "segredo-de-teste" }, { "x-api-key": "segredo-de-teste-" }]) {
      const { res, next } = chamar(headers);
      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it("aceita Bearer e x-api-key corretos", () => {
    process.env.CAMPANHAS_API_KEY = "segredo-de-teste";
    for (const headers of [{ authorization: "Bearer segredo-de-teste" }, { "x-api-key": "segredo-de-teste" }]) {
      const { next } = chamar(headers);
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it("valida o corpo de log-send e check-quarantine", () => {
    expect(logSendBodySchema.safeParse({ contacts: [] }).success).toBe(false);
    expect(logSendBodySchema.safeParse({ contacts: [{ phone: "67999990000" }], sent_at: "2026-02-30" }).success).toBe(false);
    const ok = logSendBodySchema.parse({ contacts: [{ phone: 67999990000, name: "Ana" }], sent_at: "2026-09-26" });
    expect(ok.apply_quarantine).toBe(false); // a lista já foi enviada: registra tudo que é válido
    expect(checkQuarantineBodySchema.safeParse({ phones: [] }).success).toBe(false);
    expect(checkQuarantineBodySchema.safeParse({ phones: ["67999990000"], quarantine_days: 30 }).success).toBe(true);
  });
});
