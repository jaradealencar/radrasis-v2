import { describe, expect, it, vi } from "vitest";
import { normalizarTelefoneContato, chaveTelefoneContato, juntarTelefonesOriginais, variantesTelefoneContato } from "../../shared/campanhas-contatos";

describe("normalizarTelefoneContato", () => {
  it("normaliza telefones brasileiros locais, com DDI e nono dígito legado", () => {
    expect(normalizarTelefoneContato("(67) 99999-0000")).toBe("+5567999990000");
    expect(normalizarTelefoneContato("+55 67 9278-4664")).toBe("+5567992784664");
    expect(normalizarTelefoneContato("067 3333-1234")).toBe("+556733331234");
    expect(normalizarTelefoneContato("55 67 3333-1234")).toBe("+556733331234");
  });

  it("aceita internacionais somente com prefixo + ou 00 e preserva o padrão E.164", () => {
    expect(normalizarTelefoneContato("+1 (415) 555-2671")).toBe("+14155552671");
    expect(normalizarTelefoneContato("0044 20 7946 0958")).toBe("+442079460958");
    expect(normalizarTelefoneContato("+358 9 123 4567")).toBe("+35891234567");
    expect(normalizarTelefoneContato("14155552671")).toBeNull();
  });

  it("rejeita valores ambíguos, vazios, curtos e acima do limite E.164", () => {
    for (const valor of ["", "abc", "12345", "+0 12345678", "+1415", "+1234567890123456", "(67) 99999-0000 / (67) 3333-1234"]) {
      expect(normalizarTelefoneContato(valor)).toBeNull();
    }
  });

  it("mantém uma chave numérica de comparação e acrescenta grafias originais sem duplicá-las", () => {
    expect(chaveTelefoneContato("+44 20 7946 0958")).toBe("442079460958");
    expect(juntarTelefonesOriginais(["(67) 99999-0000"], "(67) 99999-0000")).toEqual(["(67) 99999-0000"]);
    expect(juntarTelefonesOriginais(["+5567999990000"], "(67) 99999-0000")).toEqual([
      "+5567999990000", "(67) 99999-0000",
    ]);
  });

  it("busca também pelo telefone móvel brasileiro legado sem o nono dígito", () => {
    expect(variantesTelefoneContato(["+5567990009811"])).toEqual(expect.arrayContaining([
      "5567990009811", "67990009811", "556790009811", "6790009811",
    ]));
  });
});

describe("pool do banco isolado", () => {
  it("recusa DATABASE_URL remota quando o modo de teste está ativo", async () => {
    vi.stubEnv("AUDITOR_TEST_DATABASE", "1");
    vi.stubEnv("DATABASE_URL", "postgresql://tester:secret@example.invalid/radrasys_ci");
    vi.resetModules();
    const logErro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { getPool } = await import("../db/db-connection");
      expect(() => getPool()).toThrow("só pode usar host local");
    } finally {
      logErro.mockRestore();
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

const habilitarBanco = process.env.AUDITOR_TEST_DATABASE === "1";
const suiteBanco = habilitarBanco ? describe : describe.skip;

suiteBanco("rastreamento de contatos no PostgreSQL isolado", () => {
  it("não duplica identidade por formatação, guarda múltiplos telefones e audita vínculo e reversão", async () => {
    const { campanhasWhatsappContatosRouter } = await import("../routers/campanhasWhatsappContatos");
    const { registrarTentativasDeContatos } = await import("../services/campanhasContatoTracking");
    const { getPool } = await import("../db/db-connection");
    const pool = getPool();
    const ctxAdmin: any = { user: { id: "test-contact-admin", name: "Teste Contatos", email: "test@example.invalid", role: "admin" }, req: {}, res: {} };
    const caller = campanhasWhatsappContatosRouter.createCaller(ctxAdmin);
    const first = await caller.criar({ telefone: "(67) 99000-9811", nome: "Lead teste", campanhaOrigemId: null });
    expect(first.id).toBeGreaterThan(0);
    await expect(caller.criar({ telefone: "+55 67 99000-9811", nome: "Duplicado", campanhaOrigemId: null })).rejects.toMatchObject({ code: "CONFLICT" });

    await caller.adicionarTelefone({ contatoId: first.id, telefone: "+44 20 7946 0958" });
    await registrarTentativasDeContatos({
      campanhaId: 987_654_321, campanhaNome: "TESTE identidade", dataEnvio: "2026-10-20", disparoId: null,
      origem: "teste", resultado: "registrado", contatos: [{ telefone: "(67) 99000-9811", nome: "Lead teste" }],
    });
    await registrarTentativasDeContatos({
      campanhaId: 987_654_321, campanhaNome: "TESTE identidade", dataEnvio: "2026-10-20", disparoId: null,
      origem: "teste", resultado: "registrado", contatos: [{ telefone: "+55 67 99000-9811", nome: "Lead teste" }],
    });
    const detail = await caller.detalhar({ contatoId: first.id });
    expect(detail.telefones.map(row => row.telefoneE164)).toEqual(["+5567990009811", "+442079460958"]);
    expect(detail.telefones[0]?.valoresOriginais).toEqual(expect.arrayContaining(["(67) 99000-9811", "+55 67 99000-9811"]));
    expect(detail.campanhas).toEqual(expect.arrayContaining([expect.objectContaining({ campanhaId: 987_654_321, tentativas: 2, historicoCompleto: true })]));

    const clienteTesteId = 1_900_000_000 + Math.floor(Math.random() * 100_000);
    await pool.query(
      `INSERT INTO mubisys_clientes_cache (id, nome_fantasia, telefone) VALUES ($1, 'CLIENTE TESTE CONTATOS', '(67) 99000-9811')
       ON CONFLICT (id) DO UPDATE SET nome_fantasia = EXCLUDED.nome_fantasia, telefone = EXCLUDED.telefone`, [clienteTesteId],
    );
    const sufixo = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const orcamentoTeste = `TCT-${sufixo}`.slice(0, 32);
    const osTeste = `TCT-${sufixo}`.slice(0, 32);
    await pool.query(
      `INSERT INTO historico_orcamentos ("orcNumero", empresa, telefone, mes, ano)
       VALUES ($1, 'ORÇAMENTO TESTE CONTATOS', '(67) 9000-9811', 10, 2026)`, [orcamentoTeste],
    );
    await pool.query(
      `INSERT INTO historico_os ("osNumero", empresa, telefone, mes, ano)
       VALUES ($1, 'OS TESTE CONTATOS', '(67) 9000-9811', 10, 2026)`, [osTeste],
    );
    await caller.vincularEntidade({ contatoId: first.id, entidade: { tipo: "mubisys_cliente", chave: String(clienteTesteId) }, justificativa: "Correspondência conferida no cadastro de teste." });
    await caller.vincularEntidade({ contatoId: first.id, entidade: { tipo: "orcamento", chave: orcamentoTeste }, justificativa: "Orçamento conferido no histórico de teste." });
    await caller.vincularEntidade({ contatoId: first.id, entidade: { tipo: "ordem_servico", chave: osTeste }, justificativa: "Ordem de serviço conferida no histórico de teste." });
    const detailComSugestoes = await caller.detalhar({ contatoId: first.id });
    expect(detailComSugestoes.sugestoes.orcamentos).toEqual(expect.arrayContaining([expect.objectContaining({ chave: orcamentoTeste })]));
    expect(detailComSugestoes.sugestoes.ordensServico).toEqual(expect.arrayContaining([expect.objectContaining({ chave: osTeste })]));
    const second = await caller.criar({ telefone: "+1 415 555 2671", nome: "Outra pessoa do mesmo cliente", campanhaOrigemId: null });
    await caller.vincularEntidade({ contatoId: second.id, entidade: { tipo: "mubisys_cliente", chave: String(clienteTesteId) }, justificativa: "Segundo telefone confirmado como outro interlocutor." });
    const linksCliente = await pool.query(
      "SELECT count(*)::int AS total FROM campanhas_whatsapp_contato_vinculos WHERE tipo_entidade = 'mubisys_cliente' AND chave_entidade = $1 AND ativo = true",
      [String(clienteTesteId)],
    );
    expect(linksCliente.rows[0]?.total).toBe(2);
    const vinculo = (await caller.detalhar({ contatoId: first.id })).vinculos[0];
    expect(vinculo?.chave).toBe(String(clienteTesteId));
    await caller.desvincularEntidade({ vinculoId: vinculo.id, justificativa: "Correção solicitada no cenário de teste." });
    const audit = (await caller.detalhar({ contatoId: first.id })).auditoria;
    expect(audit.map(item => item.acao)).toEqual(["desvinculado", "vinculado"]);
  });
});
